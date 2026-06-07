(() => {
    const AuthRef = window.Auth;
    const api = window.api;
    const UI = window.UI;
    const CrudManager = window.CrudManager;
    const FilterPanel = window.FilterPanel;
    const GridSummaryFooter = window.GridSummaryFooter;
    const makeMask = window.createMaskAdapter || ((input, options) => window.IMask(input, options));
    let sellersManager;
    let sellerDocMask = null;
    let sellerPhoneMask = null;
    let sellerZipMask = null;
    let sellerIbgeStates = [];
    const getEl = (id) => document.getElementById(id);
    const onlyDigits = (value) => String(value || '').replace(/\D/g, '');
    function setMaskedValue(maskInstance, inputId, value) {
        if (maskInstance) {
            maskInstance.unmaskedValue = onlyDigits(value);
            return;
        }
        const input = getEl(inputId);
        if (input)
            input.value = value || '';
    }
    function getMaskedValue(maskInstance, inputId) {
        if (maskInstance)
            return maskInstance.unmaskedValue || '';
        return onlyDigits(getEl(inputId)?.value || '');
    }
    function getTrimmedValue(inputId) {
        return String(getEl(inputId)?.value || '').trim();
    }
    function formatDoc(doc) {
        if (!doc)
            return '-';
        const clean = String(doc).replace(/\D/g, '');
        if (clean.length === 11)
            return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        if (clean.length === 14)
            return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        return String(doc);
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
        return String(phone);
    }
    function formatSellerLocation(item) {
        const city = String(item.city || '').trim();
        const state = String(item.state || '').trim();
        if (!city && !state)
            return 'Não informado';
        return [city, state].filter(Boolean).join(' / ');
    }
    function populateSellerStateOptions(selectedValue = '') {
        const stateSelect = getEl('sellerState');
        if (!stateSelect || !sellerIbgeStates.length)
            return;
        const normalizedSelectedValue = String(selectedValue || '').trim().toUpperCase();
        stateSelect.innerHTML = [
            '<option value="">Selecione...</option>',
            ...sellerIbgeStates.map((state) => `<option value="${state.uf}">${state.uf} - ${state.name}</option>`),
        ].join('');
        stateSelect.value = sellerIbgeStates.some((state) => state.uf === normalizedSelectedValue) ? normalizedSelectedValue : '';
    }
    async function loadSellerStateOptions(selectedValue = '') {
        try {
            if (!sellerIbgeStates.length) {
                const response = await api('/companies/states');
                sellerIbgeStates = response.data || [];
            }
            populateSellerStateOptions(selectedValue);
        }
        catch (error) {
            console.error('Falha ao carregar UFs do IBGE para vendedores', error);
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
        catch {
            // ignore
        }
        if (!data && !cepNotFound) {
            try {
                const brasilApiResponse = await fetch(`https://brasilapi.com.br/api/cep/v1/${normalizedCep}`);
                if (brasilApiResponse.ok) {
                    data = (await brasilApiResponse.json());
                }
            }
            catch {
                // ignore
            }
        }
        return data;
    }
    function applySellerCepLookupResult(data) {
        if (!data)
            return;
        const street = getEl('sellerStreet');
        const neighborhood = getEl('sellerNeighborhood');
        const city = getEl('sellerCity');
        const complement = getEl('sellerComplement');
        if (street)
            street.value = data.street || '';
        if (neighborhood)
            neighborhood.value = data.neighborhood || '';
        if (city)
            city.value = data.city || '';
        if (complement)
            complement.value = data.complement || '';
        populateSellerStateOptions(data.state || '');
    }
    async function handleSellerCepLookup() {
        const loader = getEl('sellerCepLoading');
        const cep = getMaskedValue(sellerZipMask, 'sellerZipcode');
        if (cep.length !== 8)
            return;
        if (loader)
            loader.classList.remove('hidden');
        try {
            const data = await lookupAddressByCep(cep);
            if (data && (data.street || data.city)) {
                applySellerCepLookupResult(data);
            }
            else {
                UI?.showAlert?.('alertMessage', 'CEP do vendedor não encontrado ou inválido.', 'error');
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
    async function handleSellerDocumentLookup() {
        const documentValue = getMaskedValue(sellerDocMask, 'sellerDocument');
        if (documentValue.length !== 14)
            return;
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${documentValue}`);
            const data = await response.json();
            if (!response.ok || !data?.razao_social) {
                UI?.showAlert?.('alertMessage', 'CNPJ do vendedor não encontrado ou inválido.', 'error');
                return;
            }
            const name = getEl('sellerName');
            const email = getEl('sellerEmail');
            const street = getEl('sellerStreet');
            const number = getEl('sellerNumber');
            const complement = getEl('sellerComplement');
            const neighborhood = getEl('sellerNeighborhood');
            const city = getEl('sellerCity');
            if (name && !getTrimmedValue('sellerName'))
                name.value = data.nome_fantasia || data.razao_social || '';
            if (email && !getTrimmedValue('sellerEmail'))
                email.value = data.email || '';
            if (!getMaskedValue(sellerPhoneMask, 'sellerPhone'))
                setMaskedValue(sellerPhoneMask, 'sellerPhone', data.ddd_telefone_1 || '');
            if (!getMaskedValue(sellerZipMask, 'sellerZipcode'))
                setMaskedValue(sellerZipMask, 'sellerZipcode', data.cep || '');
            if (street && !getTrimmedValue('sellerStreet'))
                street.value = data.logradouro || '';
            if (number && !getTrimmedValue('sellerNumber'))
                number.value = data.numero || '';
            if (complement && !getTrimmedValue('sellerComplement'))
                complement.value = data.complemento || '';
            if (neighborhood && !getTrimmedValue('sellerNeighborhood'))
                neighborhood.value = data.bairro || '';
            if (city && !getTrimmedValue('sellerCity'))
                city.value = data.municipio || '';
            populateSellerStateOptions(data.uf || '');
            if (data.cep) {
                const cepData = await lookupAddressByCep(data.cep);
                if (cepData) {
                    applySellerCepLookupResult({
                        ...cepData,
                        complement: cepData.complement || getTrimmedValue('sellerComplement') || data.complemento || '',
                    });
                }
            }
        }
        catch (error) {
            console.error('Falha ao consultar documento', error);
        }
    }
    function setupSellerFormEnhancements() {
        const documentInput = getEl('sellerDocument');
        const phoneInput = getEl('sellerPhone');
        const zipcodeInput = getEl('sellerZipcode');
        if (documentInput && !sellerDocMask) {
            sellerDocMask = makeMask(documentInput, {
                mask: [{ mask: '000.000.000-00' }, { mask: '00.000.000/0000-00' }],
            });
            documentInput.addEventListener('blur', () => void handleSellerDocumentLookup());
        }
        if (phoneInput && !sellerPhoneMask) {
            sellerPhoneMask = makeMask(phoneInput, {
                mask: [{ mask: '(00) 0000-0000' }, { mask: '(00) 00000-0000' }],
            });
        }
        if (zipcodeInput && !sellerZipMask) {
            sellerZipMask = makeMask(zipcodeInput, { mask: '00000-000' });
            sellerZipMask.on('complete', () => void handleSellerCepLookup());
        }
    }
    function applySellerPrefillFromQuery() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('prefill') !== 'seller')
            return;
        const prefillName = String(params.get('name') || '').trim();
        const prefillPhoneRaw = onlyDigits(params.get('phone') || '');
        const prefillPhone = (prefillPhoneRaw.length === 12 || prefillPhoneRaw.length === 13) && prefillPhoneRaw.startsWith('55')
            ? prefillPhoneRaw.slice(2)
            : prefillPhoneRaw;
        const openModalBtn = getEl('btnOpenModal');
        if (openModalBtn) {
            openModalBtn.click();
        }
        else {
            getEl('entityModal')?.classList.remove('hidden');
        }
        window.requestAnimationFrame(() => {
            const nameInput = getEl('sellerName');
            const currentName = String(nameInput?.value || '').trim();
            if (nameInput && !currentName && prefillName) {
                nameInput.value = prefillName;
            }
            const currentPhone = getMaskedValue(sellerPhoneMask, 'sellerPhone');
            if (!currentPhone && prefillPhone) {
                setMaskedValue(sellerPhoneMask, 'sellerPhone', prefillPhone);
            }
        });
        UI?.showAlert?.('alertMessage', 'Preenchimento aplicado. Revise os dados e clique em Salvar.', 'success', 4500);
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('prefill');
        cleanUrl.searchParams.delete('name');
        cleanUrl.searchParams.delete('phone');
        window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
    }
    document.addEventListener('DOMContentLoaded', () => {
        if (!AuthRef?.isAuthenticated?.()) {
            window.location.href = '/';
            return;
        }
        setupSellerFormEnhancements();
        void loadSellerStateOptions('');
        api('/auth/me')
            .then((res) => {
            const userGreeting = getEl('userGreeting');
            if (userGreeting && res.data && res.data.user) {
                userGreeting.textContent = `Olá, ${res.data.user.full_name || 'Usuário'}`;
            }
            else if (userGreeting && res.data) {
                userGreeting.textContent = `Olá, ${res.data.full_name || 'Usuário'}`;
            }
        })
            .catch(console.error);
        sellersManager = new CrudManager({
            entityName: 'Vendedor',
            endpoint: '/users',
            tableId: 'sellersTable',
            gridSectionId: 'sellersGridSection',
            tableSectionId: 'sellersSection',
            modalId: 'entityModal',
            disableSummaryFooter: true,
            filterConfig: {
                storageKey: 'sellers_filter_panel',
                fields: [
                    { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome, documento, email...' },
                    {
                        id: 'filterStatus',
                        type: 'select',
                        label: 'Status',
                        options: [
                            { value: '', label: 'Todos' },
                            { value: 'active', label: 'Ativos' },
                            { value: 'inactive', label: 'Inativos' },
                        ],
                    },
                ],
            },
            applyFilters: (data) => {
                const search = FilterPanel.normalizeText(getEl('filterSearch')?.value);
                const searchDigits = FilterPanel.onlyDigits(search);
                const status = getEl('filterStatus')?.value || '';
                const filtered = data.filter((item) => {
                    if (item.role !== 'seller')
                        return false;
                    if (status === 'active' && !item.is_active)
                        return false;
                    if (status === 'inactive' && item.is_active)
                        return false;
                    if (!search)
                        return true;
                    if (FilterPanel.matchesSearch(item, ['full_name', 'email', 'cpf_cnpj', 'phone', 'city', 'state'], search))
                        return true;
                    if (!searchDigits)
                        return false;
                    return [item.cpf_cnpj, item.phone]
                        .map((value) => FilterPanel.onlyDigits(value))
                        .some((value) => value.includes(searchDigits));
                });
                GridSummaryFooter?.update?.({
                    footerId: 'sellersResultsFooter',
                    anchorId: 'sellersGridSection',
                    count: filtered.length,
                    label: 'vendedor(es) exibido(s)',
                });
                return filtered;
            },
            renderTable: (items) => {
                const tbody = getEl('sellersTable');
                if (!tbody)
                    return;
                if (items.length === 0) {
                    tbody.innerHTML =
                        '<tr><td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum vendedor encontrado.</td></tr>';
                    return;
                }
                tbody.innerHTML = items
                    .map((item, index) => `
                <tr class="${!item.is_active ? 'opacity-50' : ''}">
                    <td class="px-3 py-4 whitespace-nowrap text-left w-12">
                        <input type="checkbox" value="${item.public_id}" class="item-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" data-bwignore="true" data-lpignore="true" placeholder="">
                    </td>
                    <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">#${String(index + 1).padStart(4, '0')}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">${item.full_name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${formatDoc(item.cpf_cnpj)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div class="block w-56 max-w-full truncate" title="${item.email || ''}">${item.email || '-'}</div>
                        <div>${formatPhone(item.phone)}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${formatSellerLocation(item)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        ${item.is_active
                    ? '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Ativo</span>'
                    : '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Inativo</span>'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button type="button" title="Editar" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-2 edit-btn" data-item='${JSON.stringify(item).replace(/'/g, '&#39;')}'>
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        ${item.is_active
                    ? `<button type="button" title="Desativar" class="text-red-600 hover:text-red-900 dark:hover:text-red-400 mr-2 toggle-status-btn" data-id="${item.public_id}" data-action="false">
                                  <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                                </button>`
                    : `<button type="button" title="Ativar" class="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 mr-2 toggle-status-btn" data-id="${item.public_id}" data-action="true">
                                  <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                                </button>`}
                    </td>
                </tr>
            `)
                    .join('');
            },
            renderGrid: (items) => {
                const grid = getEl('sellersGridSection');
                if (!grid)
                    return;
                if (items.length === 0) {
                    grid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-12 gap-2">
                    <svg class="w-10 h-10 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <p class="text-sm text-gray-400 dark:text-gray-500">Nenhum vendedor encontrado.</p>
                </div>`;
                    return;
                }
                grid.innerHTML = items
                    .map((item, index) => `
                <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col relative border border-gray-100 dark:border-slate-700 ${!item.is_active ? 'opacity-50' : ''}">
                    <div class="flex-1">
                        <div class="flex justify-between items-center mb-3">
                            <input type="checkbox" value="${item.public_id}" class="item-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" data-bwignore="true" data-lpignore="true" placeholder="">
                            <span class="text-xs font-mono text-gray-400 dark:text-gray-500">#${String(index + 1).padStart(4, '0')}</span>
                        </div>
                        <div class="flex justify-between items-start gap-3">
                            <h4 class="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">${item.full_name}</h4>
                            <span class="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Vendedor</span>
                        </div>

                        <div class="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                            <p>${formatDoc(item.cpf_cnpj)}</p>
                            <p class="truncate" title="${item.email || ''}">${item.email || 'Sem email'}</p>
                            <p>${formatPhone(item.phone)}</p>
                            <p>${formatSellerLocation(item)}</p>
                            <p>${item.is_active
                    ? '<span class="w-2.5 h-2.5 bg-green-500 rounded-full inline-block mr-1"></span>Ativo'
                    : '<span class="w-2.5 h-2.5 bg-red-500 rounded-full inline-block mr-1"></span>Inativo'}</p>
                        </div>
                    </div>

                    <div class="mt-5 pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-end space-x-2">
                        <button type="button" title="Editar" class="text-brand-600 hover:bg-brand-50 p-1.5 rounded-full dark:hover:bg-brand-900/30 edit-btn" data-item='${JSON.stringify(item).replace(/'/g, '&#39;')}' data-id="${item.public_id}">
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        ${item.is_active
                    ? `<button type="button" title="Desativar" class="text-red-600 hover:bg-red-50 p-1.5 rounded-full dark:hover:bg-red-900/30 toggle-status-btn" data-id="${item.public_id}" data-action="false">
                                  <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                                </button>`
                    : `<button type="button" title="Ativar" class="text-brand-600 hover:bg-brand-50 p-1.5 rounded-full dark:hover:bg-brand-900/30 toggle-status-btn" data-id="${item.public_id}" data-action="true">
                                  <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                                </button>`}
                    </div>
                </div>
            `)
                    .join('');
            },
            onEdit: (data) => {
                getEl('entityForm')?.reset();
                const sellerIdInput = getEl('sellerId');
                const modalTitle = getEl('modalTitle');
                const passwordInput = getEl('sellerPassword');
                const passwordHint = getEl('passwordHint');
                if (data && data.public_id) {
                    if (modalTitle)
                        modalTitle.textContent = 'Editar Vendedor';
                    if (sellerIdInput)
                        sellerIdInput.value = data.public_id || '';
                    const name = getEl('sellerName');
                    const email = getEl('sellerEmail');
                    const street = getEl('sellerStreet');
                    const number = getEl('sellerNumber');
                    const complement = getEl('sellerComplement');
                    const neighborhood = getEl('sellerNeighborhood');
                    const city = getEl('sellerCity');
                    if (name)
                        name.value = data.full_name || '';
                    if (email)
                        email.value = data.email || '';
                    if (street)
                        street.value = data.street || '';
                    if (number)
                        number.value = data.number || '';
                    if (complement)
                        complement.value = data.complement || '';
                    if (neighborhood)
                        neighborhood.value = data.neighborhood || '';
                    if (city)
                        city.value = data.city || '';
                    setMaskedValue(sellerDocMask, 'sellerDocument', data.cpf_cnpj || '');
                    setMaskedValue(sellerPhoneMask, 'sellerPhone', data.phone || '');
                    setMaskedValue(sellerZipMask, 'sellerZipcode', data.zipcode || '');
                    void loadSellerStateOptions(data.state || '');
                    passwordInput?.removeAttribute('required');
                    passwordHint?.classList.remove('hidden');
                }
                else {
                    if (modalTitle)
                        modalTitle.textContent = 'Novo Vendedor';
                    if (sellerIdInput)
                        sellerIdInput.value = '';
                    setMaskedValue(sellerDocMask, 'sellerDocument', '');
                    setMaskedValue(sellerPhoneMask, 'sellerPhone', '');
                    setMaskedValue(sellerZipMask, 'sellerZipcode', '');
                    void loadSellerStateOptions('');
                    passwordInput?.setAttribute('required', 'true');
                    passwordHint?.classList.add('hidden');
                }
                getEl('entityModal')?.classList.remove('hidden');
            },
        });
        sellersManager.init();
        applySellerPrefillFromQuery();
        // Custom toggle status action delegated globally
        document.addEventListener('click', async (e) => {
            const target = e.target;
            const btn = target?.closest('.toggle-status-btn');
            if (!btn)
                return;
            const id = btn.getAttribute('data-id');
            const action = btn.getAttribute('data-action') === 'true';
            if (!confirm(`Tem certeza que deseja ${action ? 'ativar' : 'desativar'} este vendedor?`))
                return;
            try {
                await api(`/users/${id}/status`, {
                    method: 'PATCH',
                    body: JSON.stringify({ is_active: action }),
                });
                UI?.showAlert?.('alertMessage', `Vendedor ${action ? 'ativado' : 'desativado'} com sucesso!`, 'success');
                await sellersManager.loadData();
            }
            catch (error) {
                UI?.showAlert?.('alertMessage', error?.message || 'Erro ao atualizar status do vendedor.', 'error');
            }
        });
        getEl('entityForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const saveBtn = getEl('saveBtn');
            const sellerId = getTrimmedValue('sellerId');
            const isEditing = Boolean(sellerId);
            const payload = {
                full_name: getTrimmedValue('sellerName'),
                email: getTrimmedValue('sellerEmail'),
                passwordRaw: getTrimmedValue('sellerPassword'),
                role: 'seller',
                cpf_cnpj: getMaskedValue(sellerDocMask, 'sellerDocument') || undefined,
                phone: getMaskedValue(sellerPhoneMask, 'sellerPhone') || undefined,
                zipcode: getMaskedValue(sellerZipMask, 'sellerZipcode') || undefined,
                street: getTrimmedValue('sellerStreet') || undefined,
                number: getTrimmedValue('sellerNumber') || undefined,
                complement: getTrimmedValue('sellerComplement') || undefined,
                neighborhood: getTrimmedValue('sellerNeighborhood') || undefined,
                city: getTrimmedValue('sellerCity') || undefined,
                state: getTrimmedValue('sellerState') || undefined,
            };
            if (isEditing && !payload.passwordRaw) {
                payload.passwordRaw = '';
            }
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Salvando...';
            }
            const endpoint = isEditing ? `/users/${sellerId}` : '/users';
            const method = isEditing ? 'PATCH' : 'POST';
            try {
                await api(endpoint, {
                    method,
                    body: JSON.stringify(payload),
                });
                UI?.showAlert?.('alertMessage', isEditing ? 'Vendedor atualizado com sucesso!' : 'Vendedor cadastrado com sucesso!', 'success');
                sellersManager.closeModal();
                await sellersManager.loadData();
            }
            catch (error) {
                UI?.showAlert?.('alertMessage', error?.message || 'Erro ao salvar vendedor.', 'error');
            }
            finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Salvar';
                }
            }
        });
    });
})();
