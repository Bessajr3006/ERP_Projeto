(function initCustomersPage() {

const forge: any = (window as any).forge;

let customersManager: any;
let customerDocMask: any = null;
let customerPhoneMask: any = null;
let customerZipMask: any = null;
let customerIbgeStates: Array<{ uf?: string; name?: string }> = [];
let allSellers: any[] = [];

const getById = (id: string): any => document.getElementById(id);
const qs = (selector: string): any => document.querySelector(selector);
const qsa = (selector: string): any => document.querySelectorAll(selector);

const makeMask: any =
    (window as any).createMaskAdapter ||
    ((input: any, options: any) => (window as any).IMask(input, options));

function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

function setMaskedValue(maskInstance, inputId, value) {
    if (maskInstance) {
        maskInstance.unmaskedValue = onlyDigits(value);
        return;
    }
    const input = getById(inputId);
    if (input) input.value = value || '';
}

function getMaskedValue(maskInstance, inputId) {
    if (maskInstance) return maskInstance.unmaskedValue || '';
    return onlyDigits(getById(inputId)?.value || '');
}

function getTrimmedValue(inputId) {
    return String(getById(inputId)?.value || '').trim();
}

function formatDoc(doc) {
    if (!doc) return '-';
    const clean = String(doc).replace(/\D/g, '');
    if (clean.length === 11) return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (clean.length === 14) return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return doc;
}

function formatPhone(phone) {
    if (!phone) return '-';
    const clean = String(phone).replace(/\D/g, '');
    if (clean.length === 10) return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    if (clean.length === 11) return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (clean.length === 12) return clean.replace(/(\d{2})(\d{2})(\d{4})(\d{4})/, '+$1 ($2) $3-$4');
    if (clean.length === 13) return clean.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
    return phone;
}

function formatCustomerLocation(item) {
    const city = String(item.city || '').trim();
    const state = String(item.state || '').trim();
    if (!city && !state) return 'Não informado';
    return [city, state].filter(Boolean).join(' / ');
}

const getBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(String(reader.result || '').split(',')[1]);
    reader.onerror = error => reject(error);
});

function populateCustomerStateOptions(selectedValue = '') {
    const stateSelect = getById('customerState');
    if (!stateSelect || !customerIbgeStates.length) return;

    const normalizedSelectedValue = String(selectedValue || '').trim().toUpperCase();
    stateSelect.innerHTML = [
        '<option value="">Selecione...</option>',
        ...customerIbgeStates.map((state) => `<option value="${state.uf}">${state.uf} - ${state.name}</option>`),
    ].join('');
    stateSelect.value = customerIbgeStates.some((state) => state.uf === normalizedSelectedValue) ? normalizedSelectedValue : '';
}

function populateSellersDropdown(selectedValue = '') {
    const select = getById('customerSellerParam');
    if (!select) return;
    
    select.innerHTML = [
        '<option value="">Nenhum</option>',
        ...allSellers.map(s => `<option value="${s.public_id}">${s.full_name}</option>`)
    ].join('');
    
    select.value = selectedValue || '';
}

async function loadDependencies(selectedState = '', selectedSeller = '') {
    try {
        const [statesRes, usersRes] = await Promise.all([
            customerIbgeStates.length ? { data: customerIbgeStates } : api('/companies/states').catch(() => ({ data: [] })),
            api('/users').catch(() => ({ data: [] }))
        ]);

        if (!customerIbgeStates.length) customerIbgeStates = statesRes.data || [];
        populateCustomerStateOptions(selectedState);
        
        allSellers = (usersRes.data || []).filter(u => u.role === 'seller');
        populateSellersDropdown(selectedSeller);
    } catch (error) {
        console.error('Falha ao carregar dependências do form', error);
    }
}

async function lookupAddressByCep(cep) {
    const normalizedCep = onlyDigits(cep);
    if (normalizedCep.length !== 8) return null;

    let data: any = null;
    let cepNotFound = false;

    try {
        const viaCepResponse = await fetch(`https://viacep.com.br/ws/${normalizedCep}/json/`);
        if (viaCepResponse.ok) {
            const viaCepData = await viaCepResponse.json();
            if (!viaCepData.erro) {
                data = {
                    street: viaCepData.logradouro,
                    neighborhood: viaCepData.bairro,
                    city: viaCepData.localidade,
                    state: viaCepData.uf,
                    complement: viaCepData.complemento,
                };
            } else {
                cepNotFound = true;
            }
        }
    } catch (_error) {}

    return data;
}

function applyCustomerCepLookupResult(data) {
    if (!data) return;
    getById('customerStreet').value = data.street || '';
    getById('customerNeighborhood').value = data.neighborhood || '';
    getById('customerCity').value = data.city || '';
    getById('customerComplement').value = data.complement || '';
    populateCustomerStateOptions(data.state || '');
}

async function handleCustomerCepLookup() {
    const loader = getById('customerCepLoading');
    const cep = getMaskedValue(customerZipMask, 'customerZipcode');
    if (cep.length !== 8) return;

    if (loader) loader.classList.remove('hidden');
    try {
        const data = await lookupAddressByCep(cep);
        if (data && (data.street || data.city)) {
            applyCustomerCepLookupResult(data);
        } else {
            UI.showAlert('alertMessage', 'CEP do cliente não encontrado ou inválido.', 'error');
        }
    } catch (error) {
        console.error('Falha ao consultar CEP', error);
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}

async function handleCustomerDocumentLookup() {
    const documentValue = getMaskedValue(customerDocMask, 'customerDocument');
    if (documentValue.length !== 14) return;
    
    // Auto complete via BrasilAPI for CNPJ
    try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${documentValue}`);
        const data = await response.json();

        if (!response.ok || !data?.razao_social) return;

        if (!getTrimmedValue('customerName')) getById('customerName').value = data.nome_fantasia || data.razao_social || '';
        if (!getTrimmedValue('customerEmail')) getById('customerEmail').value = data.email || '';
        if (!getMaskedValue(customerPhoneMask, 'customerPhone')) setMaskedValue(customerPhoneMask, 'customerPhone', data.ddd_telefone_1 || '');
        if (!getMaskedValue(customerZipMask, 'customerZipcode')) setMaskedValue(customerZipMask, 'customerZipcode', data.cep || '');
        if (!getTrimmedValue('customerStreet')) getById('customerStreet').value = data.logradouro || '';
        if (!getTrimmedValue('customerNumber')) getById('customerNumber').value = data.numero || '';
        if (!getTrimmedValue('customerComplement')) getById('customerComplement').value = data.complemento || '';
        if (!getTrimmedValue('customerNeighborhood')) getById('customerNeighborhood').value = data.bairro || '';
        if (!getTrimmedValue('customerCity')) getById('customerCity').value = data.municipio || '';
        populateCustomerStateOptions(data.uf || '');
    } catch (error) {
        console.error('Falha ao consultar CNPJ', error);
    }
}

function extractCertDate() {
    const fileInput = getById('customerCertFile');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;
    
    const password = getById('customerCertPassword').value;
    if (!password) return;

    const file = fileInput.files[0];
    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.pfx') && !ext.endsWith('.p12')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const bytes = new Uint8Array((e.target as any).result);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            
            if (typeof forge === 'undefined') return;
            
            const p12Asn1 = forge.asn1.fromDer(binary);
            const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

            for (const safeBag of p12.safeContents) {
                if (safeBag.safeBags) {
                    for (const bag of safeBag.safeBags) {
                        if (bag.type === forge.pki.oids.certBag && bag.cert) {
                            const dateStr = bag.cert.validity.notAfter.toISOString().split('T')[0];
                            getById('customerCertExpiration').value = dateStr;
                            return;
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('Falha no parse do PFX:', err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

function setupCustomerModalTabs() {
    const tabButtons = document.querySelectorAll('.customer-modal-tab');
    tabButtons.forEach((btn: any) => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-customer-tab-target');
            if (!targetId) return;
            tabButtons.forEach((b: any) => {
                const isActive = b === btn;
                b.setAttribute('aria-selected', String(isActive));
                b.classList.toggle('border-brand-500', isActive);
                b.classList.toggle('text-brand-600', isActive);
                b.classList.toggle('dark:text-brand-300', isActive);
                b.classList.toggle('border-transparent', !isActive);
                b.classList.toggle('text-gray-500', !isActive);
                b.classList.toggle('dark:text-gray-400', !isActive);
            });
            document.querySelectorAll('.customer-modal-tab-panel').forEach((panel: any) => {
                if (panel.id === targetId) {
                    panel.classList.remove('hidden');
                } else {
                    panel.classList.add('hidden');
                }
            });
        });
    });
}

function resetCustomerModalTabs() {
    const tabButtons = document.querySelectorAll('.customer-modal-tab');
    tabButtons.forEach((btn: any, index: number) => {
        const isFirst = index === 0;
        btn.setAttribute('aria-selected', String(isFirst));
        btn.classList.toggle('border-brand-500', isFirst);
        btn.classList.toggle('text-brand-600', isFirst);
        btn.classList.toggle('dark:text-brand-300', isFirst);
        btn.classList.toggle('border-transparent', !isFirst);
        btn.classList.toggle('text-gray-500', !isFirst);
        btn.classList.toggle('dark:text-gray-400', !isFirst);
    });
    document.querySelectorAll('.customer-modal-tab-panel').forEach((panel: any, index: number) => {
        if (index === 0) {
            panel.classList.remove('hidden');
        } else {
            panel.classList.add('hidden');
        }
    });
}

function setupCustomerFormEnhancements() {
    const documentInput = getById('customerDocument');
    const phoneInput = getById('customerPhone');
    const zipcodeInput = getById('customerZipcode');
    const btnSearchCnpj = getById('btnSearchCnpj');
    const certFile = getById('customerCertFile');
    const certPass = getById('customerCertPassword');

    if (documentInput && !customerDocMask) {
        customerDocMask = makeMask(documentInput, {
            mask: [
                { mask: '000.000.000-00' },
                { mask: '00.000.000/0000-00' },
            ],
        });
    }

    if (btnSearchCnpj) btnSearchCnpj.addEventListener('click', handleCustomerDocumentLookup);

    if (phoneInput && !customerPhoneMask) {
        customerPhoneMask = makeMask(phoneInput, {
            mask: [
                { mask: '(00) 0000-0000' },
                { mask: '(00) 00000-0000' },
            ],
        });
    }

    if (zipcodeInput && !customerZipMask) {
        customerZipMask = makeMask(zipcodeInput, { mask: '00000-000' });
        customerZipMask.on('complete', handleCustomerCepLookup);
    }
    
    if (certFile) certFile.addEventListener('change', extractCertDate);
    if (certPass) certPass.addEventListener('blur', extractCertDate);
}

function applyCustomerPrefillFromQuery() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('prefill') !== 'customer') return;

    const prefillName = String(params.get('name') || '').trim();
    const prefillPhoneRaw = onlyDigits(params.get('phone') || '');
    const prefillPhone = (prefillPhoneRaw.length === 12 || prefillPhoneRaw.length === 13) && prefillPhoneRaw.startsWith('55')
        ? prefillPhoneRaw.slice(2)
        : prefillPhoneRaw;

    const openModalBtn = getById('btnOpenModal');
    if (openModalBtn) {
        openModalBtn.click();
    } else {
        getById('entityModal')?.classList.remove('hidden');
    }

    window.requestAnimationFrame(() => {
        const currentName = getTrimmedValue('customerName');
        if (!currentName && prefillName) {
            getById('customerName').value = prefillName;
        }

        const currentPhone = getMaskedValue(customerPhoneMask, 'customerPhone');
        if (!currentPhone && prefillPhone) {
            setMaskedValue(customerPhoneMask, 'customerPhone', prefillPhone);
        }
    });

    if (typeof UI !== 'undefined' && UI.showAlert) {
        UI.showAlert('alertMessage', 'Preenchimento aplicado. Revise os dados e clique em Salvar.', 'success', 4500);
    }

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('prefill');
    cleanUrl.searchParams.delete('name');
    cleanUrl.searchParams.delete('phone');
    window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
}

document.addEventListener('DOMContentLoaded', () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '/';
        return;
    }

    setupCustomerFormEnhancements();
    setupCustomerModalTabs();
    loadDependencies();

    const openSolidconCustomersModal = () => getById('solidconCustomersModal')?.classList.remove('hidden');
    const closeSolidconCustomersModal = () => getById('solidconCustomersModal')?.classList.add('hidden');

    getById('btnOpenSolidconCustomersModal')?.addEventListener('click', openSolidconCustomersModal);
    getById('btnCloseSolidconCustomersModal')?.addEventListener('click', closeSolidconCustomersModal);

    const solidconCustomersModalBackdrop = getById('solidconCustomersModalBackdrop');
    if (solidconCustomersModalBackdrop) {
        solidconCustomersModalBackdrop.addEventListener('click', (e) => {
            if (e.target === solidconCustomersModalBackdrop) closeSolidconCustomersModal();
        });
    }

    api('/auth/me').then((res) => {
        const userGreeting = getById('userGreeting');
        if (userGreeting && res.data && res.data.user) {
            userGreeting.textContent = `Olá, ${res.data.user.full_name || 'Usuário'}`;
        } else if (userGreeting && res.data) {
            userGreeting.textContent = `Olá, ${res.data.full_name || 'Usuário'}`;
        }

        const company = res?.data?.company || res?.data?.user?.company || res?.data?.user?.company_info;
        if (company) {
            (window as any).currentSolidconUrls = [
                company.solidcon_url_1 || '',
                company.solidcon_url_2 || '',
                company.solidcon_url_3 || '',
                company.solidcon_url_4 || '',
                company.solidcon_url_5 || '',
            ];
        }
    }).catch(console.error);

    customersManager = new CrudManager({
        entityName: 'Cliente',
        endpoint: '/entities/customers',
        tableId: 'customersTable',
        gridSectionId: 'customersGridSection',
        tableSectionId: 'customersSection',
        modalId: 'entityModal',
        disableSummaryFooter: true,

        filterConfig: {
            storageKey: 'customers_filter_panel',
            fields: [
                { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome, documento, email...' },
            ]
        },

        applyFilters: (data) => {
            const search = window.FilterPanel.normalizeText(getById('filterSearch')?.value);
            const searchDigits = window.FilterPanel.onlyDigits(search);

            const filtered = data.filter((item) => {
                if (!search) return true;

                if (window.FilterPanel.matchesSearch(item, ['name', 'email', 'cnpj_cpf', 'phone', 'city', 'state', 'seller_name'], search)) return true;
                if (!searchDigits) return false;

                return [item.cnpj_cpf, item.phone]
                    .map((value) => window.FilterPanel.onlyDigits(value))
                    .some((value) => value.includes(searchDigits));
            });

            window.GridSummaryFooter?.update({
                footerId: 'customersResultsFooter',
                anchorId: 'customersGridSection',
                count: filtered.length,
                label: 'cliente(s) exibido(s)'
            });
            return filtered;
        },

        renderTable: (items) => {
            const tbody = getById('customersTable');
            if (items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum cliente encontrado.</td></tr>';
                return;
            }

            tbody.innerHTML = items.map((item, index) => `
                <tr>
                    <td class="px-3 py-4 whitespace-nowrap text-left w-12">
                        <input type="checkbox" value="${item.public_id}" class="item-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" data-bwignore="true" data-lpignore="true" placeholder="">
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">${item.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">${formatDoc(item.cnpj_cpf) || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div class="block w-56 max-w-full truncate" title="${item.email || ''}">${item.email || '-'}</div>
                        <div>${formatPhone(item.phone)}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center">${item.vencimento_dia ? 'Dia ' + item.vencimento_dia : '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-right font-mono">${item.limite != null && item.limite !== '' && Number(item.limite) > 0 ? 'R$ ' + Number(item.limite).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${item.seller_name || 'Sem Vendedor'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button type="button" title="Editar" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-2 edit-btn" data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}'>
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button type="button" title="Excluir" class="text-red-500 hover:text-red-700 dark:hover:text-red-400 delete-btn" data-id="${item.public_id}">
                             <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </td>
                </tr>
            `).join('');
        },

        renderGrid: (items) => {
            const grid = getById('customersGridSection');
            if (items.length === 0) {
                grid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-12 gap-2">
                    <svg class="w-10 h-10 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <p class="text-sm text-gray-400 dark:text-gray-500">Nenhum cliente encontrado.</p>
                </div>`;
                return;
            }

            grid.innerHTML = items.map((item, index) => `
                <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col relative border border-gray-100 dark:border-slate-700">
                    <div class="flex-1">
                        <div class="flex justify-between items-center mb-3">
                            <input type="checkbox" value="${item.public_id}" class="item-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" data-bwignore="true" data-lpignore="true" placeholder="">
                        </div>
                        <div class="flex justify-between items-start gap-3">
                            <h4 class="text-[16px] font-bold text-gray-900 dark:text-gray-100 leading-tight mb-2 line-clamp-2" title="${item.name}">${item.name}</h4>
                        </div>
                        <div class="text-xs font-mono text-gray-500 mb-4">${formatDoc(item.cnpj_cpf) || 'S/ Documento'}</div>

                        <div class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                            ${item.email ? `<div class="flex items-center gap-2">
                                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                <span class="truncate">${item.email}</span>
                            </div>` : ''}
                            ${item.phone ? `<div class="flex items-center gap-2">
                                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                <span>${formatPhone(item.phone)}</span>
                            </div>` : ''}
                            <div class="flex items-center gap-2">
                                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5V4H2v16h5m10 0v-2a4 4 0 00-8 0v2m8 0H9m8 0H9m4-9a4 4 0 100-8 4 4 0 000 8z"></path></svg>
                                <span class="truncate">${item.seller_name || 'S/ Vendedor'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="mt-5 pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-2">
                        <button type="button" title="Editar" class="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors edit-btn" data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}'>
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button type="button" title="Excluir" class="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors delete-btn" data-id="${item.public_id}">
                             <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>
            `).join('');
        },

        onEdit: (data) => {
            getById('entityForm')?.reset();
            resetCustomerModalTabs();
            const customerIdInput = getById('customerId');
            const modalTitle = getById('modalTitle');
            const certFileInput = getById('customerCertFile');
            const cnpjFileInput = getById('customerCnpjFile');
            const docSavedIndicator = getById('docSavedIndicator');

            if (data && data.public_id) {
                modalTitle.textContent = 'Editar Cliente';
                customerIdInput.value = data.public_id || '';
                getById('customerName').value = data.name || '';
                getById('customerEmail').value = data.email || '';
                getById('customerStreet').value = data.street || '';
                getById('customerNumber').value = data.number || '';
                getById('customerComplement').value = data.complement || '';
                getById('customerNeighborhood').value = data.neighborhood || '';
                getById('customerCity').value = data.city || '';
                getById('customerCertPassword').value = data.certificate_password || '';
                getById('customerCertExpiration').value = data.certificate_expiration ? data.certificate_expiration.split('T')[0] : '';
                (getById('customerDueDay') as HTMLInputElement).value = data.vencimento_dia ?? '';
                (getById('customerCreditLimit') as HTMLInputElement).value = data.limite ?? '';
                
                setMaskedValue(customerDocMask, 'customerDocument', data.cnpj_cpf || '');
                setMaskedValue(customerPhoneMask, 'customerPhone', data.phone || '');
                setMaskedValue(customerZipMask, 'customerZipcode', data.zipcode || '');
                loadDependencies(data.state || '', data.seller_public_id || '');
                
                // Keep references to if document existed
                if (data.cnpj_document_base64) {
                    cnpjFileInput.dataset.hasDoc = 'true';
                    docSavedIndicator?.classList.remove('hidden');
                } else {
                    cnpjFileInput.dataset.hasDoc = 'false';
                    docSavedIndicator?.classList.add('hidden');
                }
                if (data.certificate_base64) {
                    certFileInput.dataset.hasDoc = 'true';
                } else {
                    certFileInput.dataset.hasDoc = 'false';
                }
            } else {
                modalTitle.textContent = 'Novo Cliente';
                customerIdInput.value = '';
                setMaskedValue(customerDocMask, 'customerDocument', '');
                setMaskedValue(customerPhoneMask, 'customerPhone', '');
                setMaskedValue(customerZipMask, 'customerZipcode', '');
                loadDependencies('', '');
                
                cnpjFileInput.dataset.hasDoc = 'false';
                certFileInput.dataset.hasDoc = 'false';
                docSavedIndicator?.classList.add('hidden');
            }
            // Clear File inputs
            if (certFileInput) certFileInput.value = '';
            if (cnpjFileInput) cnpjFileInput.value = '';
            
            getById('entityModal').classList.remove('hidden');
        }
    });

    customersManager.init();
    applyCustomerPrefillFromQuery();

    const solidconUrlSelect = getById('solidconCustomerUrlSelect');
    const solidconJsonInput = getById('solidconCustomersJsonInput');
    const btnFetchSolidconJson = getById('btnFetchSolidconCustomers');
    const btnImportSolidconJson = getById('btnImportSolidconCustomers');
    const solidconImportStatus = getById('solidconCustomersStatus');

    const setSolidconStatus = (message, type = 'info') => {
        if (!solidconImportStatus) return;
        solidconImportStatus.classList.remove('hidden');
        let classes = 'text-gray-700 bg-gray-100 dark:bg-slate-700 dark:text-gray-200';
        if (type === 'success') {
            classes = 'text-green-700 bg-green-50 dark:bg-green-900/30 dark:text-green-200';
        } else if (type === 'error') {
            classes = 'text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-200';
        } else if (type === 'warning') {
            classes = 'text-yellow-700 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-200';
        }
        solidconImportStatus.className = `mt-3 text-sm rounded-md px-3 py-2 ${classes}`;
        solidconImportStatus.textContent = message;
    };

    const clearSolidconStatus = () => {
        if (!solidconImportStatus) return;
        solidconImportStatus.classList.add('hidden');
        solidconImportStatus.textContent = '';
        solidconImportStatus.className = 'hidden mt-3 text-sm rounded-md px-3 py-2';
    };

    const getSelectedSolidconUrl = () => {
        const index = Number(solidconUrlSelect?.value || 1) - 1;
        const urls = (window as any).currentSolidconUrls || [];
        return urls[index] || '';
    };

    if (btnFetchSolidconJson && solidconJsonInput) {
        btnFetchSolidconJson.addEventListener('click', async () => {
            clearSolidconStatus();
            const url = getSelectedSolidconUrl();
            if (!url) {
                setSolidconStatus('URL Solidcon nao configurada. Salve na tela Minha Empresa > API/Solidcon.', 'warning');
                return;
            }

            btnFetchSolidconJson.disabled = true;
            const originalText = btnFetchSolidconJson.textContent;
            btnFetchSolidconJson.textContent = 'Buscando...';

            try {
                const response = await api('/companies/proxy-consulta', {
                    method: 'POST',
                    body: JSON.stringify({ url })
                });
                const payload = response?.data ?? response;
                solidconJsonInput.value = JSON.stringify(payload, null, 2);
                setSolidconStatus('JSON carregado com sucesso.', 'success');
            } catch (err) {
                setSolidconStatus(err.message || 'Erro ao buscar JSON da Solidcon.', 'error');
            } finally {
                btnFetchSolidconJson.textContent = originalText;
                btnFetchSolidconJson.disabled = false;
            }
        });
    }

    if (btnImportSolidconJson && solidconJsonInput) {
        btnImportSolidconJson.addEventListener('click', async () => {
            clearSolidconStatus();
            const raw = String(solidconJsonInput.value || '').trim();
            if (!raw) {
                setSolidconStatus('Cole o JSON ou clique em "Buscar JSON" antes de importar.', 'warning');
                return;
            }

            let parsed = null;
            try {
                parsed = JSON.parse(raw);
            } catch (_error) {
                setSolidconStatus('JSON invalido. Verifique o conteudo e tente novamente.', 'error');
                return;
            }

            btnImportSolidconJson.disabled = true;
            const originalText = btnImportSolidconJson.textContent;
            btnImportSolidconJson.textContent = 'Importando...';

            try {
                const result = await api('/entities/customers/solidcon-import', {
                    method: 'POST',
                    body: JSON.stringify({ payload: parsed })
                });
                const data = result?.data || {};
                const created = data.created ?? 0;
                const updated = data.updated ?? 0;
                const skipped = data.skipped ?? 0;
                setSolidconStatus(`Importacao concluida: ${created} novos, ${updated} atualizados, ${skipped} ignorados.`, 'success');
                await customersManager.loadData();
            } catch (err) {
                setSolidconStatus(err.message || 'Erro ao importar clientes da Solidcon.', 'error');
            } finally {
                btnImportSolidconJson.textContent = originalText;
                btnImportSolidconJson.disabled = false;
            }
        });
    }

    // Delete global action
    document.addEventListener('click', async (e) => {
        const btn = (e.target as any)?.closest?.('.delete-btn');
        if (btn) {
            const id = btn.getAttribute('data-id');
            if (!confirm('Tem certeza que deseja excluir este cliente?')) return;

            try {
                await api(`/entities/customers/${id}`, { method: 'DELETE' });
                UI.showAlert('alertMessage', 'Cliente excluído com sucesso!', 'success');
                await customersManager.loadData();
            } catch (error) {
                UI.showAlert('alertMessage', error.message || 'Erro ao excluir o cliente.', 'error');
            }
        }
    });

    getById('entityForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();

        const saveBtn = getById('saveBtn');
        const customerId = getTrimmedValue('customerId');
        const isEditing = Boolean(customerId);

        const nameValue = getTrimmedValue('customerName');
        if (!nameValue) {
            // Garantir que a aba Dados esteja visível antes de mostrar o erro
            const infoTab = getById('customerInfoTab');
            const infoTabBtn = getById('customerInfoTabButton');
            if (infoTab && infoTab.classList.contains('hidden')) {
                infoTabBtn?.click();
            }
            getById('customerName')?.focus();
            return;
        }

        const payload: any = {
            name: getTrimmedValue('customerName'),
            email: getTrimmedValue('customerEmail'),
            seller_public_id: getById('customerSellerParam')?.value || undefined,
            cnpj_cpf: getMaskedValue(customerDocMask, 'customerDocument') || undefined,
            phone: getMaskedValue(customerPhoneMask, 'customerPhone') || undefined,
            zipcode: getMaskedValue(customerZipMask, 'customerZipcode') || undefined,
            street: getTrimmedValue('customerStreet') || undefined,
            number: getTrimmedValue('customerNumber') || undefined,
            complement: getTrimmedValue('customerComplement') || undefined,
            neighborhood: getTrimmedValue('customerNeighborhood') || undefined,
            city: getTrimmedValue('customerCity') || undefined,
            state: getById('customerState')?.value || undefined,
            certificate_password: getTrimmedValue('customerCertPassword') || undefined,
            certificate_expiration: getTrimmedValue('customerCertExpiration') || undefined,
            vencimento_dia: (getById('customerDueDay') as HTMLInputElement)?.value !== '' ? Number((getById('customerDueDay') as HTMLInputElement)?.value) : undefined,
            limite: (getById('customerCreditLimit') as HTMLInputElement)?.value !== '' ? Number((getById('customerCreditLimit') as HTMLInputElement)?.value) : undefined,
        };

        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';

        try {
            const certFileInput = getById('customerCertFile');
            const cnpjFileInput = getById('customerCnpjFile');

            if (certFileInput && certFileInput.files.length > 0) {
                payload.certificate_base64 = await getBase64(certFileInput.files[0]);
            }
            if (cnpjFileInput && cnpjFileInput.files.length > 0) {
                payload.cnpj_document_base64 = await getBase64(cnpjFileInput.files[0]);
            }

            const endpoint = isEditing ? `/entities/customers/${customerId}` : '/entities/customers';
            const method = isEditing ? 'PUT' : 'POST';

            await api(endpoint, {
                method,
                body: JSON.stringify(payload),
            });

            UI.showAlert('alertMessage', isEditing ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!', 'success');
            customersManager.closeModal();
            await customersManager.loadData();
        } catch (error) {
            UI.showAlert('alertMessage', error.message || 'Erro ao salvar cliente.', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar';
        }
    });
});

})();
