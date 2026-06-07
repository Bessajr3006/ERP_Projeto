(() => {
    const getById = (id) => document.getElementById(id);
    const qs = (selector) => document.querySelector(selector);
    const qsa = (selector) => document.querySelectorAll(selector);
    const makeMask = window.createMaskAdapter || ((input, options) => window.IMask(input, options));
    function onlyDigits(value) {
        return String(value || '').replace(/\D/g, '');
    }
    function setMaskedValue(maskInstance, inputId, value) {
        if (maskInstance) {
            maskInstance.unmaskedValue = onlyDigits(value);
            return;
        }
        const input = getById(inputId);
        if (input) {
            input.value = value || '';
        }
    }
    function getMaskedValue(maskInstance, inputId) {
        if (maskInstance) {
            return maskInstance.unmaskedValue || '';
        }
        return onlyDigits(getById(inputId)?.value || '');
    }
    function getTrimmedValue(inputId) {
        return String(getById(inputId)?.value || '').trim();
    }
    function formatDoc(doc) {
        if (!doc)
            return '-';
        const clean = String(doc).replace(/\D/g, '');
        if (clean.length === 11) {
            return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        }
        if (clean.length === 14) {
            return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        }
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
        catch (_error) {
            // Fallback
        }
        if (!data && !cepNotFound) {
            try {
                const brasilApiResponse = await fetch(`https://brasilapi.com.br/api/cep/v1/${normalizedCep}`);
                if (brasilApiResponse.ok) {
                    data = await brasilApiResponse.json();
                }
            }
            catch (_error) {
            }
        }
        return data;
    }
    window.initUserRoleDirectory = function initUserRoleDirectory(config) {
        const state = {
            docMask: null,
            phoneMask: null,
            zipMask: null,
            ibgeStates: [],
        };
        const cfg = {
            role: 'user',
            moduleId: 'users',
            singularLabel: 'Usuário',
            pluralLabel: 'Usuários',
            singularLower: 'usuário',
            pluralLower: 'usuários',
            summaryLabel: 'registro(s) exibido(s)',
            badgeClass: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
            viewStorageKey: 'usersView',
            filterStorageKey: 'users_filter_panel',
            pageTitle: 'Usuários',
            listTitle: 'Usuários Cadastrados',
            createdMessage: 'Cadastro realizado com sucesso!',
            updatedMessage: 'Cadastro atualizado com sucesso!',
            tableId: 'entitiesTable',
            gridSectionId: 'entitiesGridSection',
            tableSectionId: 'entitiesSection',
            resultsFooterId: 'entitiesResultsFooter',
            toggledMessage(active) {
                return `${cfg.singularLabel} ${active ? 'ativado' : 'desativado'} com sucesso!`;
            },
            ...config,
        };
        function formatLocation(item) {
            const city = String(item.city || '').trim();
            const stateValue = String(item.state || '').trim();
            if (!city && !stateValue)
                return 'Não informado';
            return [city, stateValue].filter(Boolean).join(' / ');
        }
        function populateStateOptions(selectedValue = '') {
            const stateSelect = getById('entityState');
            if (!stateSelect || !state.ibgeStates.length)
                return;
            const normalizedSelectedValue = String(selectedValue || '').trim().toUpperCase();
            stateSelect.innerHTML = [
                '<option value="">Selecione...</option>',
                ...state.ibgeStates.map((item) => `<option value="${item.uf}">${item.uf} - ${item.name}</option>`),
            ].join('');
            stateSelect.value = state.ibgeStates.some((item) => item.uf === normalizedSelectedValue) ? normalizedSelectedValue : '';
        }
        async function loadStateOptions(selectedValue = '') {
            try {
                if (!state.ibgeStates.length) {
                    const response = await api('/companies/states');
                    state.ibgeStates = response.data || [];
                }
                populateStateOptions(selectedValue);
            }
            catch (error) {
                console.error(`Falha ao carregar UFs do IBGE para ${cfg.pluralLower}`, error);
            }
        }
        function applyCepLookupResult(data) {
            if (!data)
                return;
            getById('entityStreet').value = data.street || '';
            getById('entityNeighborhood').value = data.neighborhood || '';
            getById('entityCity').value = data.city || '';
            getById('entityComplement').value = data.complement || '';
            populateStateOptions(data.state || '');
        }
        async function handleCepLookup() {
            const loader = getById('entityCepLoading');
            const cep = getMaskedValue(state.zipMask, 'entityZipcode');
            if (cep.length !== 8)
                return;
            if (loader)
                loader.classList.remove('hidden');
            try {
                const data = await lookupAddressByCep(cep);
                if (data && (data.street || data.city)) {
                    applyCepLookupResult(data);
                }
                else {
                    UI.showAlert('alertMessage', `CEP do ${cfg.singularLower} não encontrado ou inválido.`, 'error');
                }
            }
            catch (error) {
                console.error(`Falha ao consultar CEP do ${cfg.singularLower}`, error);
            }
            finally {
                if (loader)
                    loader.classList.add('hidden');
            }
        }
        async function handleDocumentLookup() {
            const documentValue = getMaskedValue(state.docMask, 'entityDocument');
            if (documentValue.length !== 14)
                return;
            try {
                const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${documentValue}`);
                const data = await response.json();
                if (!response.ok || !data?.razao_social) {
                    UI.showAlert('alertMessage', `CNPJ do ${cfg.singularLower} não encontrado ou inválido.`, 'error');
                    return;
                }
                if (!getTrimmedValue('entityName'))
                    getById('entityName').value = data.nome_fantasia || data.razao_social || '';
                if (!getTrimmedValue('entityEmail'))
                    getById('entityEmail').value = data.email || '';
                if (!getMaskedValue(state.phoneMask, 'entityPhone'))
                    setMaskedValue(state.phoneMask, 'entityPhone', data.ddd_telefone_1 || '');
                if (!getMaskedValue(state.zipMask, 'entityZipcode'))
                    setMaskedValue(state.zipMask, 'entityZipcode', data.cep || '');
                if (!getTrimmedValue('entityStreet'))
                    getById('entityStreet').value = data.logradouro || '';
                if (!getTrimmedValue('entityNumber'))
                    getById('entityNumber').value = data.numero || '';
                if (!getTrimmedValue('entityComplement'))
                    getById('entityComplement').value = data.complemento || '';
                if (!getTrimmedValue('entityNeighborhood'))
                    getById('entityNeighborhood').value = data.bairro || '';
                if (!getTrimmedValue('entityCity'))
                    getById('entityCity').value = data.municipio || '';
                populateStateOptions(data.uf || '');
                if (data.cep) {
                    const cepData = await lookupAddressByCep(data.cep);
                    if (cepData) {
                        applyCepLookupResult({
                            ...cepData,
                            complement: cepData.complement || getTrimmedValue('entityComplement') || data.complemento || '',
                        });
                    }
                }
            }
            catch (error) {
                console.error(`Falha ao consultar documento do ${cfg.singularLower}`, error);
            }
        }
        function setupFormEnhancements() {
            const documentInput = getById('entityDocument');
            const phoneInput = getById('entityPhone');
            const zipcodeInput = getById('entityZipcode');
            if (documentInput && !state.docMask) {
                state.docMask = makeMask(documentInput, {
                    mask: [
                        { mask: '000.000.000-00' },
                        { mask: '00.000.000/0000-00' },
                    ],
                });
                documentInput.addEventListener('blur', handleDocumentLookup);
            }
            if (phoneInput && !state.phoneMask) {
                state.phoneMask = makeMask(phoneInput, {
                    mask: [
                        { mask: '(00) 0000-0000' },
                        { mask: '(00) 00000-0000' },
                    ],
                });
            }
            if (zipcodeInput && !state.zipMask) {
                state.zipMask = makeMask(zipcodeInput, { mask: '00000-000' });
                state.zipMask?.on?.('complete', handleCepLookup);
            }
        }
        function applyRolePrefillFromQuery(roleManager) {
            const params = new URLSearchParams(window.location.search);
            if (params.get('prefill') !== cfg.role)
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
                roleManager?.onEdit?.(null);
                getById('entityModal')?.classList.remove('hidden');
            }
            window.requestAnimationFrame(() => {
                const nameInput = getById('entityName');
                const currentName = String(nameInput?.value || '').trim();
                if (nameInput && !currentName && prefillName) {
                    nameInput.value = prefillName;
                }
                const currentPhone = getMaskedValue(state.phoneMask, 'entityPhone');
                if (!currentPhone && prefillPhone) {
                    setMaskedValue(state.phoneMask, 'entityPhone', prefillPhone);
                }
            });
            UI.showAlert('alertMessage', 'Preenchimento aplicado. Revise os dados e clique em Salvar.', 'success', 4500);
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
            document.title = `KEYSTONE - ${cfg.pageTitle}`;
            setupFormEnhancements();
            loadStateOptions('');
            const roleManager = new CrudManager({
                entityName: cfg.singularLabel,
                endpoint: '/users',
                tableId: cfg.tableId,
                gridSectionId: cfg.gridSectionId,
                tableSectionId: cfg.tableSectionId,
                modalId: 'entityModal',
                filterConfig: {
                    storageKey: cfg.filterStorageKey,
                    footerId: cfg.resultsFooterId,
                    fields: [
                        { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome, documento, e-mail, telefone ou cidade' },
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
                    gridClass: 'grid grid-cols-1 md:grid-cols-2 gap-3 items-end',
                },
                applyFilters: (data) => {
                    const search = window.FilterPanel.normalizeText(getById('filterSearch')?.value);
                    const searchDigits = window.FilterPanel.onlyDigits(search);
                    const status = getById('filterStatus')?.value || '';
                    const filtered = data.filter((item) => {
                        if (status === 'active' && !item.is_active)
                            return false;
                        if (status === 'inactive' && item.is_active)
                            return false;
                        if (!search)
                            return true;
                        if (window.FilterPanel.matchesSearch(item, ['full_name', 'email', 'cpf_cnpj', 'phone', 'city', 'state'], search))
                            return true;
                        if (!searchDigits)
                            return false;
                        return [item.cpf_cnpj, item.phone].map(v => window.FilterPanel.onlyDigits(v)).some(v => v.includes(searchDigits));
                    });
                    window.GridSummaryFooter?.update({
                        footerId: cfg.resultsFooterId,
                        anchorId: cfg.gridSectionId,
                        count: filtered.length,
                        label: cfg.summaryLabel,
                    });
                    return filtered;
                },
                renderTable: (items) => {
                    const tbody = getById(cfg.tableId);
                    if (!tbody)
                        return;
                    if (items.length === 0) {
                        tbody.innerHTML = `<tr><td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum ${cfg.singularLower} encontrado.</td></tr>`;
                        return;
                    }
                    tbody.innerHTML = items.map((item, index) => `
                        <tr class="${!item.is_active ? 'opacity-50' : ''}">
                            <td class="px-3 py-4 whitespace-nowrap text-left w-12">
                                <input type="checkbox" value="${item.public_id}" class="item-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" data-bwignore="true" data-lpignore="true" placeholder="">
                            </td>
                            <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                                #${String(index + 1).padStart(4, '0')}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">${item.full_name}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${formatDoc(item.cpf_cnpj)}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                <div class="block w-56 max-w-full truncate" title="${item.email || ''}">${item.email || '-'}</div>
                                <div>${formatPhone(item.phone)}</div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${formatLocation(item)}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm">
                                ${item.is_active ? '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Ativo</span>' : '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Inativo</span>'}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button type="button" title="Editar" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-2 edit-btn" data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}'>
                                    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
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
                    `).join('');
                    const selectAllBtn = getById('selectAllCheckbox');
                    if (selectAllBtn) {
                        const newSelectAll = selectAllBtn.cloneNode(true);
                        selectAllBtn.parentNode.replaceChild(newSelectAll, selectAllBtn);
                        newSelectAll.addEventListener('change', (event) => {
                            qsa('.item-checkbox').forEach((checkbox) => {
                                checkbox.checked = event.target.checked;
                            });
                        });
                    }
                },
                renderGrid: (items) => {
                    const grid = getById(cfg.gridSectionId);
                    if (!grid)
                        return;
                    if (items.length === 0) {
                        grid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-12 gap-2">
                            <svg class="w-10 h-10 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                            </svg>
                            <p class="text-sm text-gray-400 dark:text-gray-500">Nenhum ${cfg.singularLower} encontrado.</p>
                        </div>`;
                        return;
                    }
                    grid.innerHTML = items.map((item, index) => `
                        <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col relative border border-gray-100 dark:border-slate-700 ${!item.is_active ? 'opacity-50' : ''}">
                            <div class="flex-1">
                                <div class="flex justify-between items-center mb-3">
                                    <input type="checkbox" value="${item.public_id}" class="item-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" data-bwignore="true" data-lpignore="true" placeholder="">
                                    <span class="text-xs font-mono text-gray-400 dark:text-gray-500">#${String(index + 1).padStart(4, '0')}</span>
                                </div>
                                <div class="flex justify-between items-start gap-3">
                                    <h4 class="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">${item.full_name}</h4>
                                    <span class="px-2 py-0.5 rounded text-xs font-medium ${cfg.badgeClass}">${cfg.singularLabel}</span>
                                </div>

                                <div class="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                                    <p>${formatDoc(item.cpf_cnpj)}</p>
                                    <p class="truncate" title="${item.email || ''}">${item.email || 'Sem email informado'}</p>
                                    <p>${formatPhone(item.phone)}</p>
                                    <p>${formatLocation(item)}</p>
                                    <p>${item.is_active ? '<span class="w-2.5 h-2.5 bg-green-500 rounded-full inline-block mr-1"></span>Ativo' : '<span class="w-2.5 h-2.5 bg-red-500 rounded-full inline-block mr-1"></span>Inativo'}</p>
                                </div>
                            </div>
                            <div class="mt-5 pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-end space-x-2">
                                <button type="button" title="Editar" class="text-brand-600 hover:bg-brand-50 p-1.5 rounded-full dark:hover:bg-brand-900/30 edit-btn" data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}'>
                                    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
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
                    `).join('');
                },
                onEdit: (data) => {
                    data = data || {};
                    getById('entityForm')?.reset();
                    setupFormEnhancements();
                    const entityIdInput = getById('entityId');
                    const modalTitle = getById('modalTitle');
                    const passwordInput = getById('entityPassword');
                    const passwordHint = getById('passwordHint');
                    const statusSelect = getById('entityStatus');
                    if (data && data.public_id) {
                        modalTitle.textContent = `Editar ${cfg.singularLabel}`;
                        entityIdInput.value = data.public_id || '';
                        getById('entityName').value = data.full_name || '';
                        getById('entityEmail').value = data.email || '';
                        getById('entityStreet').value = data.street || '';
                        getById('entityNumber').value = data.number || '';
                        getById('entityComplement').value = data.complement || '';
                        getById('entityNeighborhood').value = data.neighborhood || '';
                        getById('entityCity').value = data.city || '';
                        setMaskedValue(state.docMask, 'entityDocument', data.cpf_cnpj || '');
                        setMaskedValue(state.phoneMask, 'entityPhone', data.phone || '');
                        setMaskedValue(state.zipMask, 'entityZipcode', data.zipcode || '');
                        loadStateOptions(data.state || '');
                        if (statusSelect) {
                            statusSelect.value = data.is_active === false ? 'inactive' : 'active';
                        }
                        passwordInput.removeAttribute('required');
                        passwordHint.classList.remove('hidden');
                    }
                    else {
                        modalTitle.textContent = `Novo ${cfg.singularLabel}`;
                        entityIdInput.value = '';
                        setMaskedValue(state.docMask, 'entityDocument', '');
                        setMaskedValue(state.phoneMask, 'entityPhone', '');
                        setMaskedValue(state.zipMask, 'entityZipcode', '');
                        loadStateOptions('');
                        if (statusSelect) {
                            statusSelect.value = 'active';
                        }
                        passwordInput.setAttribute('required', 'true');
                        passwordHint.classList.add('hidden');
                    }
                    getById('entityModal').classList.remove('hidden');
                }
            });
            roleManager.loadData = async function () {
                try {
                    const response = await api(this.endpoint);
                    this.data = (response.data || []).filter((user) => user.role === cfg.role);
                    this.applyFilters();
                }
                catch (error) {
                    console.error(`Falha ao carregar ${cfg.pluralLower}`, error);
                    UI.showAlert('alertMessage', `Erro ao carregar ${cfg.pluralLower}. Verifique a conexão.`, 'error');
                }
            };
            let searchDebounceTimer = null;
            getById('filterSearch')?.addEventListener('input', () => {
                if (searchDebounceTimer) {
                    clearTimeout(searchDebounceTimer);
                }
                searchDebounceTimer = setTimeout(() => {
                    roleManager.applyFilters();
                    searchDebounceTimer = null;
                }, 180);
            });
            getById('filterStatus')?.addEventListener('change', () => roleManager.applyFilters());
            getById('entityForm')?.addEventListener('submit', async (event) => {
                event.preventDefault();
                const saveBtn = getById('saveBtn');
                const entityId = getTrimmedValue('entityId');
                const isEditing = Boolean(entityId);
                const payload = {
                    full_name: getTrimmedValue('entityName'),
                    email: getTrimmedValue('entityEmail'),
                    passwordRaw: getTrimmedValue('entityPassword'),
                    role: cfg.role,
                    is_active: (getById('entityStatus')?.value || 'active') !== 'inactive',
                    cpf_cnpj: getMaskedValue(state.docMask, 'entityDocument') || undefined,
                    phone: getMaskedValue(state.phoneMask, 'entityPhone') || undefined,
                    zipcode: getMaskedValue(state.zipMask, 'entityZipcode') || undefined,
                    street: getTrimmedValue('entityStreet') || undefined,
                    number: getTrimmedValue('entityNumber') || undefined,
                    complement: getTrimmedValue('entityComplement') || undefined,
                    neighborhood: getTrimmedValue('entityNeighborhood') || undefined,
                    city: getTrimmedValue('entityCity') || undefined,
                    state: getTrimmedValue('entityState') || undefined,
                };
                if (isEditing && !payload.passwordRaw) {
                    payload.passwordRaw = '';
                }
                saveBtn.disabled = true;
                saveBtn.textContent = 'Salvando...';
                const endpoint = isEditing ? `/users/${entityId}` : '/users';
                const method = isEditing ? 'PATCH' : 'POST';
                try {
                    await api(endpoint, {
                        method,
                        body: JSON.stringify(payload),
                    });
                    UI.showAlert('alertMessage', isEditing ? cfg.updatedMessage : cfg.createdMessage, 'success');
                    roleManager.closeModal();
                    await roleManager.loadData();
                }
                catch (error) {
                    UI.showAlert('alertMessage', error.message || `Erro ao salvar ${cfg.singularLower}.`, 'error');
                }
                finally {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Salvar';
                }
            });
            document.addEventListener('click', async (e) => {
                const btn = e.target?.closest?.('.toggle-status-btn');
                if (!btn)
                    return;
                const id = btn.getAttribute('data-id');
                const active = btn.getAttribute('data-action') === 'true';
                if (!confirm(`Tem certeza que deseja ${active ? 'ativar' : 'desativar'} este ${cfg.singularLower}?`)) {
                    return;
                }
                try {
                    await api(`/users/${id}/status`, {
                        method: 'PATCH',
                        body: JSON.stringify({ is_active: active }),
                    });
                    UI.showAlert('alertMessage', cfg.toggledMessage(active), 'success');
                    await roleManager.loadData();
                }
                catch (error) {
                    UI.showAlert('alertMessage', error.message || `Erro ao atualizar status do ${cfg.singularLower}.`, 'error');
                }
            });
            roleManager.init();
            applyRolePrefillFromQuery(roleManager);
        });
    };
})();
