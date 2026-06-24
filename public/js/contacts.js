/// <reference path="./globals.d.ts" />
/// <reference path="./api.ts" />
/// <reference path="./components/crud-manager.ts" />
(function initContactsPage() {
    let contactsManager;
    let contactsDocMask = null;
    let contactsPhoneMask = null;
    let contactsZipMask = null;
    let contactsIbgeStates = [];
    const getById = (id) => document.getElementById(id);
    const qs = (selector) => document.querySelector(selector);
    const qsa = (selector) => document.querySelectorAll(selector);
    const makeMask = window.createMaskAdapter ||
        ((input, options) => window.IMask(input, options));
    function onlyDigits(value) {
        return String(value || '').replace(/\D/g, '');
    }
    function setMaskedValue(maskInstance, inputId, value) {
        if (maskInstance) {
            maskInstance.unmaskedValue = onlyDigits(value);
            return;
        }
        const input = getById(inputId);
        if (input)
            input.value = value || '';
    }
    function getMaskedValue(maskInstance, inputId) {
        if (maskInstance)
            return maskInstance.unmaskedValue || '';
        return onlyDigits(getById(inputId)?.value || '');
    }
    function getTrimmedValue(inputId) {
        return String(getById(inputId)?.value || '').trim();
    }
    function formatDoc(doc) {
        if (!doc)
            return '-';
        const clean = String(doc).replace(/\D/g, '');
        if (clean.length === 11)
            return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        if (clean.length === 14)
            return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        return doc;
    }
    function formatPhone(phone) {
        if (!phone)
            return '-';
        const clean = String(phone).replace(/\D/g, '');
        if (clean.length === 10)
            return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        if (clean.length === 11)
            return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        if (clean.length === 12)
            return clean.replace(/(\d{2})(\d{2})(\d{4})(\d{4})/, '+$1 ($2) $3-$4');
        if (clean.length === 13)
            return clean.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
        return phone;
    }
    function formatContactLocation(item) {
        const city = String(item.city || '').trim();
        const state = String(item.state || '').trim();
        if (!city && !state)
            return 'Não informado';
        return [city, state].filter(Boolean).join(' / ');
    }
    function populateContactStateOptions(selectedValue = '') {
        const stateSelect = getById('contactsState');
        if (!stateSelect || !contactsIbgeStates.length)
            return;
        const normalizedSelectedValue = String(selectedValue || '').trim().toUpperCase();
        stateSelect.innerHTML = [
            '<option value="">Selecione...</option>',
            ...contactsIbgeStates.map((state) => `<option value="${state.uf}">${state.uf} - ${state.name}</option>`),
        ].join('');
        stateSelect.value = contactsIbgeStates.some((state) => state.uf === normalizedSelectedValue) ? normalizedSelectedValue : '';
    }
    async function loadDependencies(selectedState = '') {
        try {
            const statesRes = contactsIbgeStates.length ? { data: contactsIbgeStates } : await api('/companies/states').catch(() => ({ data: [] }));
            if (!contactsIbgeStates.length)
                contactsIbgeStates = statesRes.data || [];
            populateContactStateOptions(selectedState);
        }
        catch (error) {
            console.error('Falha ao carregar dependências do form', error);
        }
    }
    async function lookupAddressByCep(cep) {
        const normalizedCep = onlyDigits(cep);
        if (normalizedCep.length !== 8)
            return null;
        let data = null;
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
                }
                else {
                    cepNotFound = true;
                }
            }
        }
        catch (_error) { }
        return data;
    }
    function applyContactCepLookupResult(data) {
        if (!data)
            return;
        getById('contactsStreet').value = data.street || '';
        getById('contactsNeighborhood').value = data.neighborhood || '';
        getById('contactsCity').value = data.city || '';
        getById('contactsComplement').value = data.complement || '';
        populateContactStateOptions(data.state || '');
    }
    async function handleContactCepLookup() {
        const loader = getById('contactsCepLoading');
        const cep = getMaskedValue(contactsZipMask, 'contactsZipcode');
        if (cep.length !== 8)
            return;
        if (loader)
            loader.classList.remove('hidden');
        try {
            const data = await lookupAddressByCep(cep);
            if (data && (data.street || data.city)) {
                applyContactCepLookupResult(data);
            }
            else {
                UI.showAlert('alertMessage', 'CEP do contato não encontrado ou inválido.', 'error');
            }
        }
        catch (error) {
            console.error('Falha ao consultar CEP', error);
        }
        finally {
            if (loader)
                loader.classList.add('hidden');
        }
    }
    function setupContactFormEnhancements() {
        const documentInput = getById('contactsDocument');
        const phoneInput = getById('contactsPhone');
        const zipcodeInput = getById('contactsZipcode');
        if (documentInput && !contactsDocMask) {
            contactsDocMask = makeMask(documentInput, {
                mask: [
                    { mask: '000.000.000-00' },
                    { mask: '00.000.000/0000-00' },
                ],
            });
        }
        if (phoneInput && !contactsPhoneMask) {
            contactsPhoneMask = makeMask(phoneInput, {
                mask: [
                    { mask: '(00) 0000-0000' },
                    { mask: '(00) 00000-0000' },
                ],
            });
        }
        if (zipcodeInput && !contactsZipMask) {
            contactsZipMask = makeMask(zipcodeInput, { mask: '00000-000' });
            contactsZipMask.on('complete', handleContactCepLookup);
        }
    }
    function applyContactPrefillFromQuery() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('prefill') !== 'contacts')
            return;
        const prefillName = String(params.get('name') || '').trim();
        const prefillPhoneRaw = onlyDigits(params.get('phone') || '');
        const prefillPhone = (prefillPhoneRaw.length === 12 || prefillPhoneRaw.length === 13) && prefillPhoneRaw.startsWith('55')
            ? prefillPhoneRaw.slice(2)
            : prefillPhoneRaw;
        const openModalBtn = getById('btnOpenModal');
        if (openModalBtn) {
            openModalBtn.click();
        }
        else {
            getById('entityModal')?.classList.remove('hidden');
        }
        window.requestAnimationFrame(() => {
            const currentName = getTrimmedValue('contactsName');
            if (!currentName && prefillName) {
                getById('contactsName').value = prefillName;
            }
            const currentPhone = getMaskedValue(contactsPhoneMask, 'contactsPhone');
            if (!currentPhone && prefillPhone) {
                setMaskedValue(contactsPhoneMask, 'contactsPhone', prefillPhone);
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
        setupContactFormEnhancements();
        loadDependencies();
        api('/auth/me').then((res) => {
            const userGreeting = getById('userGreeting');
            if (userGreeting && res.data && res.data.user) {
                userGreeting.textContent = `Olá, ${res.data.user.full_name || 'Usuário'}`;
            }
            else if (userGreeting && res.data) {
                userGreeting.textContent = `Olá, ${res.data.full_name || 'Usuário'}`;
            }
        }).catch(console.error);
        contactsManager = new CrudManager({
            entityName: 'Contato',
            endpoint: '/entities/contacts',
            tableId: 'contactsTable',
            tableSectionId: 'contactsSection',
            modalId: 'entityModal',
            disableSummaryFooter: true,
            filterConfig: {
                storageKey: 'contacts_filter_panel',
                fields: [
                    { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome, documento, email...' },
                ]
            },
            applyFilters: (data) => {
                const search = window.FilterPanel.normalizeText(getById('filterSearch')?.value);
                const searchDigits = window.FilterPanel.onlyDigits(search);
                const filtered = data.filter((item) => {
                    if (!search)
                        return true;
                    if (window.FilterPanel.matchesSearch(item, ['name', 'email', 'cnpj_cpf', 'phone', 'city', 'state'], search))
                        return true;
                    if (!searchDigits)
                        return false;
                    return [item.cnpj_cpf, item.phone]
                        .map((value) => window.FilterPanel.onlyDigits(value))
                        .some((value) => value.includes(searchDigits));
                });
                window.GridSummaryFooter?.update({
                    footerId: 'contactsResultsFooter',
                    anchorId: 'contactsGridSection',
                    count: filtered.length,
                    label: 'contato(s) exibido(s)'
                });
                return filtered;
            },
            renderTable: (items) => {
                const tbody = getById('contactsTable');
                if (items.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum contato encontrado.</td></tr>';
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
            onEdit: (data) => {
                getById('entityForm')?.reset();
                const contactsIdInput = getById('contactsId');
                const modalTitle = getById('modalTitle');
                if (data && data.public_id) {
                    modalTitle.textContent = 'Editar Contato';
                    contactsIdInput.value = data.public_id || '';
                    getById('contactsName').value = data.name || '';
                    getById('contactsEmail').value = data.email || '';
                    getById('contactsBirthDate').value = data.birth_date ? String(data.birth_date).split('T')[0] : '';
                    getById('contactsStreet').value = data.street || '';
                    getById('contactsNumber').value = data.number || '';
                    getById('contactsComplement').value = data.complement || '';
                    getById('contactsNeighborhood').value = data.neighborhood || '';
                    getById('contactsCity').value = data.city || '';
                    setMaskedValue(contactsDocMask, 'contactsDocument', data.cnpj_cpf || '');
                    setMaskedValue(contactsPhoneMask, 'contactsPhone', data.phone || '');
                    setMaskedValue(contactsZipMask, 'contactsZipcode', data.zipcode || '');
                    loadDependencies(data.state || '');
                }
                else {
                    modalTitle.textContent = 'Novo Contato';
                    contactsIdInput.value = '';
                    getById('contactsBirthDate').value = '';
                    setMaskedValue(contactsDocMask, 'contactsDocument', '');
                    setMaskedValue(contactsPhoneMask, 'contactsPhone', '');
                    setMaskedValue(contactsZipMask, 'contactsZipcode', '');
                    loadDependencies('');
                }
                getById('entityModal').classList.remove('hidden');
            }
        });
        contactsManager.init();
        applyContactPrefillFromQuery();
        // Delete global action
        document.addEventListener('click', async (e) => {
            const btn = e.target?.closest?.('.delete-btn');
            if (btn) {
                const id = btn.getAttribute('data-id');
                if (!confirm('Tem certeza que deseja excluir este contato?'))
                    return;
                try {
                    await api(`/entities/contacts/${id}`, { method: 'DELETE' });
                    UI.showAlert('alertMessage', 'Contato excluído com sucesso!', 'success');
                    await contactsManager.loadData();
                }
                catch (error) {
                    UI.showAlert('alertMessage', error.message || 'Erro ao excluir o contato.', 'error');
                }
            }
        });
        getById('entityForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const saveBtn = getById('saveBtn');
            const contactsId = getTrimmedValue('contactsId');
            const isEditing = Boolean(contactsId);
            const payload = {
                name: getTrimmedValue('contactsName'),
                email: getTrimmedValue('contactsEmail'),
                birth_date: getTrimmedValue('contactsBirthDate') || undefined,
                cnpj_cpf: getMaskedValue(contactsDocMask, 'contactsDocument') || undefined,
                phone: getMaskedValue(contactsPhoneMask, 'contactsPhone') || undefined,
                zipcode: getMaskedValue(contactsZipMask, 'contactsZipcode') || undefined,
                street: getTrimmedValue('contactsStreet') || undefined,
                number: getTrimmedValue('contactsNumber') || undefined,
                complement: getTrimmedValue('contactsComplement') || undefined,
                neighborhood: getTrimmedValue('contactsNeighborhood') || undefined,
                city: getTrimmedValue('contactsCity') || undefined,
                state: getById('contactsState')?.value || undefined
            };
            saveBtn.disabled = true;
            saveBtn.textContent = 'Salvando...';
            try {
                const endpoint = isEditing ? `/entities/contacts/${contactsId}` : '/entities/contacts';
                const method = isEditing ? 'PUT' : 'POST';
                await api(endpoint, {
                    method,
                    body: JSON.stringify(payload),
                });
                UI.showAlert('alertMessage', isEditing ? 'Contato atualizado com sucesso!' : 'Contato cadastrado com sucesso!', 'success');
                contactsManager.closeModal();
                await contactsManager.loadData();
            }
            catch (error) {
                UI.showAlert('alertMessage', error.message || 'Erro ao salvar contato.', 'error');
            }
            finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Salvar';
            }
        });
    });
})();
