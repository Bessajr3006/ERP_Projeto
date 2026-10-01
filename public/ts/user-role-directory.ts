(() => {
    const getById = (id: string): any => document.getElementById(id);
    const qs = (selector: string): any => document.querySelector(selector);
    const qsa = (selector: string): any => document.querySelectorAll(selector);

    const makeMask = window.createMaskAdapter || ((input, options) => window.IMask(input, options));

    function onlyDigits(value) {
        return String(value || '').replace(/\D/g, '');
    }

    function setMaskedValue(maskInstance, inputId, value) {
        if (maskInstance) {
            if (inputId === 'entityDocument') {
                maskInstance.unmaskedValue = String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            } else {
                maskInstance.unmaskedValue = onlyDigits(value);
            }
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

        const val = getById(inputId)?.value || '';
        if (inputId === 'entityDocument') {
            return String(val).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        }
        return onlyDigits(val);
    }

    function getTrimmedValue(inputId) {
        return String(getById(inputId)?.value || '').trim();
    }

    function formatDoc(doc) {
        if (!doc) return '-';
        const clean = String(doc).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

        if (clean.length === 11) {
            return clean.replace(/([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{2})/, '$1.$2.$3-$4');
        }

        if (clean.length === 14) {
            return clean.replace(/([a-zA-Z0-9]{2})([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{4})([a-zA-Z0-9]{2})/, '$1.$2.$3/$4-$5');
        }

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

    async function lookupAddressByCep(cep: any): Promise<any> {
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
        } catch (_error) {
            // Fallback
        }

        if (!data && !cepNotFound) {
            try {
                const brasilApiResponse = await fetch(`https://brasilapi.com.br/api/cep/v1/${normalizedCep}`);
                if (brasilApiResponse.ok) {
                    data = await brasilApiResponse.json();
                }
            } catch (_error) {
            }
        }

        return data;
    }

    window.initUserRoleDirectory = function initUserRoleDirectory(config: any) {
        const state: { docMask: any; phoneMask: any; zipMask: any; ibgeStates: any[] } = {
            docMask: null,
            phoneMask: null,
            zipMask: null,
            ibgeStates: [] as any[],
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
            if (!city && !stateValue) return 'Não informado';
            return [city, stateValue].filter(Boolean).join(' / ');
        }

        function populateStateOptions(selectedValue = '') {
            const stateSelect = getById('entityState');
            if (!stateSelect || !state.ibgeStates.length) return;
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
            } catch (error) {
                console.error(`Falha ao carregar UFs do IBGE para ${cfg.pluralLower}`, error);
            }
        }

        function applyCepLookupResult(data) {
            if (!data) return;
            getById('entityStreet').value = data.street || '';
            getById('entityNeighborhood').value = data.neighborhood || '';
            getById('entityCity').value = data.city || '';
            getById('entityComplement').value = data.complement || '';
            populateStateOptions(data.state || '');
        }

        async function handleCepLookup() {
            const loader = getById('entityCepLoading');
            const cep = getMaskedValue(state.zipMask, 'entityZipcode');
            if (cep.length !== 8) return;
            if (loader) loader.classList.remove('hidden');

            try {
                const data = await lookupAddressByCep(cep);
                if (data && (data.street || data.city)) {
                    applyCepLookupResult(data);
                } else {
                    UI.showAlert('alertMessage', `CEP do ${cfg.singularLower} não encontrado ou inválido.`, 'error');
                }
            } catch (error) {
                console.error(`Falha ao consultar CEP do ${cfg.singularLower}`, error);
            } finally {
                if (loader) loader.classList.add('hidden');
            }
        }

        async function handleDocumentLookup() {
            const documentValue = getMaskedValue(state.docMask, 'entityDocument');
            if (documentValue.length !== 14) return;

            try {
                const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${documentValue}`);
                const data = await response.json();

                if (!response.ok || !data?.razao_social) {
                    UI.showAlert('alertMessage', `CNPJ do ${cfg.singularLower} não encontrado ou inválido.`, 'error');
                    return;
                }

                if (!getTrimmedValue('entityName')) getById('entityName').value = data.nome_fantasia || data.razao_social || '';
                if (!getTrimmedValue('entityEmail')) getById('entityEmail').value = data.email || '';
                if (!getMaskedValue(state.phoneMask, 'entityPhone')) setMaskedValue(state.phoneMask, 'entityPhone', data.ddd_telefone_1 || '');
                if (!getMaskedValue(state.zipMask, 'entityZipcode')) setMaskedValue(state.zipMask, 'entityZipcode', data.cep || '');
                if (!getTrimmedValue('entityStreet')) getById('entityStreet').value = data.logradouro || '';
                if (!getTrimmedValue('entityNumber')) getById('entityNumber').value = data.numero || '';
                if (!getTrimmedValue('entityComplement')) getById('entityComplement').value = data.complemento || '';
                if (!getTrimmedValue('entityNeighborhood')) getById('entityNeighborhood').value = data.bairro || '';
                if (!getTrimmedValue('entityCity')) getById('entityCity').value = data.municipio || '';
                
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
            } catch (error) {
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
                        { 
                            mask: 'XX.XXX.XXX/XXXX-XX',
                            definitions: {
                                'X': /[a-zA-Z0-9]/
                            }
                        },
                    ],
                    prepare: (str: string) => str.toUpperCase()
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

            const btnSearchEntityCep = getById('btnSearchEntityCep');
            if (btnSearchEntityCep) {
                btnSearchEntityCep.addEventListener('click', handleCepLookup);
            }
        }

        function applyRolePrefillFromQuery(roleManager: any) {
            const params = new URLSearchParams(window.location.search);
            if (params.get('prefill') !== cfg.role) return;

            const prefillName = String(params.get('name') || '').trim();
            const prefillPhoneRaw = onlyDigits(params.get('phone') || '');
            const prefillPhone = (prefillPhoneRaw.length === 12 || prefillPhoneRaw.length === 13) && prefillPhoneRaw.startsWith('55')
                ? prefillPhoneRaw.slice(2)
                : prefillPhoneRaw;

            const openModalBtn = getById('btnOpenModal');
            if (openModalBtn) {
                openModalBtn.click();
            } else {
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
            setupDetailsModalTabs();
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
                        if (status === 'active' && !item.is_active) return false;
                        if (status === 'inactive' && item.is_active) return false;
                        if (!search) return true;
                        if (window.FilterPanel.matchesSearch(item, ['full_name', 'email', 'cpf_cnpj', 'phone', 'city', 'state'], search)) return true;
                        if (!searchDigits) return false;
                        return [item.cpf_cnpj, item.phone].map(v => window.FilterPanel.onlyDigits(v)).some(v => v.includes(searchDigits));
                    });

                    const anchorEl = document.getElementById(cfg.gridSectionId) || document.getElementById(cfg.tableSectionId);
                    if (anchorEl) {
                        window.GridSummaryFooter?.update({
                            footerId: cfg.resultsFooterId,
                            anchorId: anchorEl.id,
                            count: filtered.length,
                            label: cfg.summaryLabel,
                        });
                    }
                    return filtered;
                },

                renderTable: (items) => {
                    const tbody = getById(cfg.tableId);
                    if (!tbody) return;
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
                                <button type="button" title="Detalhes" class="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 mr-2 open-details-btn" data-id="${item.public_id}" data-name="${item.full_name}">
                                    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                </button>
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
                    if (!grid) return;
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
                                <button type="button" title="Detalhes" class="text-indigo-600 hover:bg-brand-50 p-1.5 rounded-full dark:hover:bg-brand-900/30 open-details-btn" data-id="${item.public_id}" data-name="${item.full_name}">
                                    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                </button>
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
                    } else {
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

            roleManager.loadData = async function() {
                try {
                    const response = await api(this.endpoint);
                    this.data = (response.data || []).filter((user) => user.role === cfg.role);
                    this.applyFilters();
                } catch (error) {
                    console.error(`Falha ao carregar ${cfg.pluralLower}`, error);
                    UI.showAlert('alertMessage', `Erro ao carregar ${cfg.pluralLower}. Verifique a conexão.`, 'error');
                }
            };

            let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
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
                } catch (error) {
                    UI.showAlert('alertMessage', error.message || `Erro ao salvar ${cfg.singularLower}.`, 'error');
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Salvar';
                }
            });

            document.addEventListener('click', async (e: any) => {
                const target = e.target as HTMLElement | null;
                const openDetailsBtn = target?.closest?.('.open-details-btn');
                if (openDetailsBtn) {
                    const id = openDetailsBtn.getAttribute('data-id');
                    const name = openDetailsBtn.getAttribute('data-name') || '';
                    if (id) {
                        void openViewDetailsModal(id, name);
                    }
                    return;
                }

                const btn = target?.closest?.('.toggle-status-btn') as HTMLElement | null;
                if (!btn) return;

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
                } catch (error) {
                    UI.showAlert('alertMessage', error.message || `Erro ao atualizar status do ${cfg.singularLower}.`, 'error');
                }
            });

            roleManager.init();
            applyRolePrefillFromQuery(roleManager);

        function setupDetailsModalTabs() {
            const modalElement = getById(cfg.role === 'buyer' ? 'viewBuyerDetailsModal' : 'viewServiceProviderDetailsModal');
            if (!modalElement) return;
            const tabButtons = modalElement.querySelectorAll('.details-modal-tab');
            tabButtons.forEach((btn: any) => {
                btn.addEventListener('click', () => {
                    const targetId = btn.getAttribute('data-details-tab-target');
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
                    modalElement.querySelectorAll('.details-modal-tab-panel').forEach((panel: any) => {
                        if (panel.id === targetId) {
                            panel.classList.remove('hidden');
                        } else {
                            panel.classList.add('hidden');
                        }
                    });
                });
            });
        }

        function resetDetailsModalTabs() {
            const modalElement = getById(cfg.role === 'buyer' ? 'viewBuyerDetailsModal' : 'viewServiceProviderDetailsModal');
            if (!modalElement) return;
            const tabButtons = Array.from(modalElement.querySelectorAll('.details-modal-tab'));
            const visibleButtons = tabButtons.filter((btn: any) => !btn.classList.contains('hidden'));
            
            tabButtons.forEach((btn: any) => {
                const isSelected = visibleButtons.length > 0 && btn === visibleButtons[0];
                btn.setAttribute('aria-selected', String(isSelected));
                btn.classList.toggle('border-brand-500', isSelected);
                btn.classList.toggle('text-brand-600', isSelected);
                btn.classList.toggle('dark:text-brand-300', isSelected);
                btn.classList.toggle('border-transparent', !isSelected);
                btn.classList.toggle('text-gray-500', !isSelected);
                btn.classList.toggle('dark:text-gray-400', !isSelected);
            });

            modalElement.querySelectorAll('.details-modal-tab-panel').forEach((panel: any) => {
                const panelId = panel.getAttribute('id');
                const correspondingBtn = tabButtons.find((btn: any) => btn.getAttribute('aria-controls') === panelId);
                const shouldBeVisible = correspondingBtn && visibleButtons.length > 0 && correspondingBtn === visibleButtons[0];
                if (shouldBeVisible) {
                    panel.classList.remove('hidden');
                } else {
                    panel.classList.add('hidden');
                }
            });
        }

        async function openViewDetailsModal(entityId: string, entityName: string) {
            const modal = getById(cfg.role === 'buyer' ? 'viewBuyerDetailsModal' : 'viewServiceProviderDetailsModal');
            if (!modal) return;

            const closeBtn = modal.querySelector('#btnCloseViewDetailsModal');
            const cancelBtn = modal.querySelector('#btnCancelViewDetailsModal');
            const backdrop = modal.querySelector('#viewDetailsModalBackdrop');

            // Close modal actions
            const closeModal = () => {
                modal.classList.add('hidden');
            };
            closeBtn?.addEventListener('click', closeModal, { once: true });
            cancelBtn?.addEventListener('click', closeModal, { once: true });
            backdrop?.addEventListener('click', closeModal, { once: true });

            modal.classList.remove('hidden');

            // Populate basic details
            const item = roleManager?.data?.find((c: any) => c.public_id === entityId);
            
            const docEl = modal.querySelector('#viewDetailsDocument');
            const emailEl = modal.querySelector('#viewDetailsEmail');
            const phoneEl = modal.querySelector('#viewDetailsPhone');
            const locEl = modal.querySelector('#viewDetailsLocation');
            const titleNameEl = modal.querySelector(cfg.role === 'buyer' ? '#viewDetailsBuyerName' : '#viewDetailsServiceProviderName');

            if (titleNameEl) titleNameEl.textContent = entityName;
            if (docEl) docEl.textContent = formatDoc(item?.cpf_cnpj);
            if (emailEl) {
                emailEl.textContent = item?.email || 'Não informado';
                emailEl.title = item?.email || '';
            }
            if (phoneEl) phoneEl.textContent = formatPhone(item?.phone);
            if (locEl) locEl.textContent = formatLocation(item || {});

            // Map configuration
            const mapBuyerAddressSpan = modal.querySelector(cfg.role === 'buyer' ? '#mapBuyerAddress' : '#mapServiceProviderAddress');
            const googleMapsIframe = modal.querySelector('#googleMapsIframe') as HTMLIFrameElement | null;
            const btnOpenWaze = modal.querySelector('#btnOpenWaze') as HTMLAnchorElement | null;
            const btnOpenGoogleMaps = modal.querySelector('#btnOpenGoogleMaps') as HTMLAnchorElement | null;

            if (item) {
                const addressParts = [
                    item.street,
                    item.number,
                    item.neighborhood,
                    item.city,
                    item.state,
                    item.zipcode
                ].filter(Boolean);
                const addressStr = addressParts.join(', ');

                if (mapBuyerAddressSpan) {
                    mapBuyerAddressSpan.textContent = addressStr || 'Endereço não cadastrado';
                }

                const authCtx = (window as any).gNavbarAuthContext;
                const company = authCtx?.company;
                const companyAddressParts = company ? [
                    company.street,
                    company.number,
                    company.neighborhood,
                    company.city,
                    company.state,
                    company.zipcode
                ].filter(Boolean) : [];
                const companyAddressStr = companyAddressParts.join(', ');

                if (addressStr) {
                    let embedUrl = '';
                    let mapsUrl = '';
                    let wazeUrl = '';

                    if (companyAddressStr) {
                        embedUrl = `https://maps.google.com/maps?saddr=${encodeURIComponent(companyAddressStr)}&daddr=${encodeURIComponent(addressStr)}&output=embed`;
                        mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(companyAddressStr)}&destination=${encodeURIComponent(addressStr)}`;
                        wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(addressStr)}&navigate=yes`;
                    } else {
                        embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(addressStr)}&output=embed`;
                        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressStr)}`;
                        wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(addressStr)}&navigate=yes`;
                    }

                    if (googleMapsIframe) {
                        googleMapsIframe.src = embedUrl;
                    }
                    if (btnOpenWaze) {
                        btnOpenWaze.href = wazeUrl;
                        btnOpenWaze.classList.remove('hidden');
                    }
                    if (btnOpenGoogleMaps) {
                        btnOpenGoogleMaps.href = mapsUrl;
                        btnOpenGoogleMaps.classList.remove('hidden');
                    }
                } else {
                    if (googleMapsIframe) googleMapsIframe.removeAttribute('src');
                    if (btnOpenWaze) btnOpenWaze.classList.add('hidden');
                    if (btnOpenGoogleMaps) btnOpenGoogleMaps.classList.add('hidden');
                }
            } else {
                if (mapBuyerAddressSpan) mapBuyerAddressSpan.textContent = 'Não encontrado';
                if (googleMapsIframe) googleMapsIframe.removeAttribute('src');
                if (btnOpenWaze) btnOpenWaze.classList.add('hidden');
                if (btnOpenGoogleMaps) btnOpenGoogleMaps.classList.add('hidden');
            }

            resetDetailsModalTabs();

            const docContainer = modal.querySelector('#viewDetailsDocumentContainer');
            let docsList: { name: string; url: string; attachedAt?: string }[] = [];
            
            const parseCnpjDocuments = (val: any): { name: string; url: string; attachedAt?: string }[] => {
                if (!val) return [];
                let list: any[] = [];
                if (Array.isArray(val)) {
                    list = val;
                } else {
                    try {
                        if (typeof val === 'string' && val.trim().startsWith('[')) {
                            list = JSON.parse(val);
                        } else if (typeof val === 'string' && val.trim() !== '') {
                            list = [val];
                        }
                    } catch (e) {}
                }
                return list.map(item => {
                    if (typeof item === 'string') {
                        const fileName = item.substring(item.lastIndexOf('/') + 1);
                        return { name: fileName, url: item, attachedAt: new Date(2026, 0, 1).toISOString() };
                    }
                    if (item && typeof item === 'object' && item.url) {
                        return {
                            name: item.name || item.url.substring(item.url.lastIndexOf('/') + 1),
                            url: item.url,
                            attachedAt: item.attachedAt || new Date().toISOString()
                        };
                    }
                    return null;
                }).filter(Boolean) as { name: string; url: string; attachedAt: string }[];
            };

            docsList = parseCnpjDocuments(item?.cnpj_document_url);

            const getBase64 = (file: File) => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                });
            };

            const renderDetailsDocsList = () => {
                if (!docContainer) return;
                docsList.sort((a: any, b: any) => new Date(b.attachedAt || 0).getTime() - new Date(a.attachedAt || 0).getTime());
                if (docsList.length === 0) {
                    docContainer.innerHTML = `
                        <div class="flex flex-col items-center justify-center py-12 gap-2 text-gray-400 dark:text-gray-500 w-full font-sans">
                            <svg class="w-12 h-12 text-gray-300 dark:text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                            </svg>
                            <p class="text-sm font-medium">Nenhum documento anexado.</p>
                        </div>
                    `;
                    return;
                }
                docContainer.innerHTML = docsList.map((doc, idx) => {
                    const fileName = doc.url.substring(doc.url.lastIndexOf('/') + 1);
                    const d = doc.attachedAt ? new Date(doc.attachedAt) : null;
                    const dateStr = d ? `Anexado em ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '';
                    return `
                        <div class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:border-brand-300 dark:hover:border-brand-700 transition-all font-sans mb-3">
                            <a href="${doc.url}" target="_blank" class="flex items-center gap-3 flex-1 min-w-0 mr-4 group text-left cursor-pointer decoration-none">
                                <div class="p-2 rounded bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/60 transition-colors">
                                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                    </svg>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">${doc.name}</p>
                                    <p class="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">${fileName}</p>
                                    ${dateStr ? `
                                        <p class="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-1 flex items-center gap-1">
                                            <svg class="w-3.5 h-3.5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                            ${dateStr}
                                        </p>
                                    ` : ''}
                                </div>
                            </a>
                            <div class="flex items-center gap-1.5 shrink-0">
                                <button type="button" class="btn-rename-doc p-1.5 rounded text-gray-500 hover:text-brand-600 hover:bg-brand-50 dark:text-gray-400 dark:hover:text-brand-400 dark:hover:bg-brand-950/30 transition-colors" data-index="${idx}" title="Renomear documento">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                                    </svg>
                                </button>
                                <button type="button" class="btn-delete-doc p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-950/30 transition-colors" data-index="${idx}" title="Excluir documento">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            };

            renderDetailsDocsList();

            // Bind upload input
            const detailCnpjFileInput = modal.querySelector('#detailCnpjFile') as HTMLInputElement | null;
            if (detailCnpjFileInput) {
                const newFileInput = detailCnpjFileInput.cloneNode(true) as HTMLInputElement;
                detailCnpjFileInput.parentNode?.replaceChild(newFileInput, detailCnpjFileInput);
                newFileInput.addEventListener('change', async (e: any) => {
                    const files = Array.from(newFileInput.files || []);
                    if (files.length === 0) return;
                    
                    const uploads: { name: string; base64: string; attachedAt: string; filename?: string }[] = [];
                    for (const file of files) {
                        try {
                            const b64 = (await getBase64(file)) as string;
                            const defaultName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                            uploads.push({
                                name: defaultName,
                                base64: b64,
                                attachedAt: new Date().toISOString(),
                                filename: file.name
                            });
                        } catch (err) {
                            console.error(err);
                        }
                    }
                    
                    if (uploads.length > 0) {
                        try {
                            newFileInput.disabled = true;
                            if (docContainer) docContainer.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 animate-pulse font-sans">Enviando documentos...</p>';
                            await api(`/users/${entityId}`, {
                                method: 'PUT',
                                body: JSON.stringify({
                                    cnpj_document_uploads: uploads
                                })
                            });
                            (window as any).UI.showAlert('alertMessage', 'Documentos anexados com sucesso!', 'success');
                            
                            await roleManager.loadData();
                            const updatedItem = roleManager?.data?.find((c: any) => c.public_id === entityId);
                            docsList = parseCnpjDocuments(updatedItem?.cnpj_document_url);
                            renderDetailsDocsList();
                        } catch (err: any) {
                            console.error(err);
                            (window as any).UI.showAlert('alertMessage', err.message || 'Erro ao enviar documentos.', 'error');
                            renderDetailsDocsList();
                        } finally {
                            newFileInput.disabled = false;
                            newFileInput.value = '';
                        }
                    }
                });
            }

            // Bind clicks for rename and delete within document container
            if (docContainer) {
                const newDocContainer = docContainer.cloneNode(true);
                docContainer.parentNode?.replaceChild(newDocContainer, docContainer);
                
                newDocContainer.addEventListener('click', async (e: Event) => {
                    const target = e.target as HTMLElement | null;
                    const renameBtn = target?.closest('.btn-rename-doc');
                    const deleteBtn = target?.closest('.btn-delete-doc');
                    
                    if (renameBtn) {
                        const idx = parseInt(renameBtn.getAttribute('data-index') || '0', 10);
                        const doc = docsList[idx];
                        if (doc) {
                            const newName = prompt('Digite o novo nome para o documento:', doc.name);
                            if (newName && newName.trim()) {
                                docsList[idx].name = newName.trim();
                                try {
                                    await api(`/users/${entityId}`, {
                                        method: 'PUT',
                                        body: JSON.stringify({
                                            cnpj_document_url: JSON.stringify(docsList)
                                        })
                                    });
                                    (window as any).UI.showAlert('alertMessage', 'Documento renomeado com sucesso!', 'success');
                                    await roleManager.loadData();
                                    renderDetailsDocsList();
                                } catch (err: any) {
                                    console.error(err);
                                    (window as any).UI.showAlert('alertMessage', 'Erro ao renomear documento.', 'error');
                                }
                            }
                        }
                    }
                    
                    if (deleteBtn) {
                        const idx = parseInt(deleteBtn.getAttribute('data-index') || '0', 10);
                        if (confirm('Deseja realmente excluir este documento?')) {
                            docsList.splice(idx, 1);
                            try {
                                await api(`/users/${entityId}`, {
                                        method: 'PUT',
                                        body: JSON.stringify({
                                            cnpj_document_url: JSON.stringify(docsList)
                                        })
                                    });
                                    (window as any).UI.showAlert('alertMessage', 'Documento excluído com sucesso!', 'success');
                                    await roleManager.loadData();
                                    renderDetailsDocsList();
                            } catch (err: any) {
                                console.error(err);
                                (window as any).UI.showAlert('alertMessage', 'Erro ao excluir documento.', 'error');
                            }
                        }
                    }
                });
            }

            resetDetailsModalTabs();

            // ── Loader / API calls ──
            const financialsTable = modal.querySelector('#viewDetailsFinancialsTable');
            const tasksTable = modal.querySelector('#viewDetailsTasksTable');

            if (financialsTable) financialsTable.innerHTML = '<tr><td colspan="4" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans animate-pulse">Carregando...</td></tr>';
            if (tasksTable) tasksTable.innerHTML = '<tr><td colspan="3" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans animate-pulse">Carregando...</td></tr>';

            try {
                const [revenuesRes, expensesRes, tasksRes] = await Promise.all([
                    api('/finance/revenues').catch(() => ({ data: [] })),
                    api('/finance/expenses').catch(() => ({ data: [] })),
                    api('/tasks').catch(() => ({ data: [] }))
                ]);

                // Filter transactions
                const revenues = (revenuesRes.data || []).filter((tx: any) => tx.related_user_public_id === entityId);
                const expenses = (expensesRes.data || []).filter((tx: any) => tx.related_user_public_id === entityId);
                const transactions = [...revenues, ...expenses].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

                if (financialsTable) {
                    if (transactions.length === 0) {
                        financialsTable.innerHTML = '<tr><td colspan="4" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans">Nenhum lançamento financeiro encontrado.</td></tr>';
                    } else {
                        financialsTable.innerHTML = transactions.map((t: any) => `
                            <tr>
                                <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 font-sans">${t.description}</td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-sans">${new Date(t.date).toLocaleDateString('pt-BR')}</td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-sans">${t.status === 'paid' ? 'Pago' : 'Pendente'}</td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-mono ${t.type === 'revenue' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                                    ${t.type === 'revenue' ? '+' : '-'}${Number(t.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </td>
                            </tr>
                        `).join('');
                    }
                }

                // Filter tasks
                const tasks = (tasksRes.data || []).filter((t: any) => t.personType === cfg.role && t.personId === entityId);
                if (tasksTable) {
                    if (tasks.length === 0) {
                        tasksTable.innerHTML = '<tr><td colspan="3" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans">Nenhuma tarefa encontrada.</td></tr>';
                    } else {
                        tasksTable.innerHTML = tasks.map((t: any) => `
                            <tr>
                                <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 font-sans">${t.title}</td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-sans">${t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-BR') : '-'}</td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-sans">${t.status}</td>
                            </tr>
                        `).join('');
                    }
                }
            } catch (error) {
                console.error('Erro ao buscar dados do comprador:', error);
            }
        }
    });
};
})();
