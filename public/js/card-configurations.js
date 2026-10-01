(() => {
    /**
     * card-configurations.ts
     * Gerencia a tela de Configurações de Cartões do módulo Financeiro
     */
    let g_configs = [];
    let g_types = [];
    let g_brands = [];
    let g_filteredConfigs = [];
    let g_editingId = null;
    const FilterPanel = window.FilterPanel;
    const api = window.api;
    const getEl = (id) => document.getElementById(id);
    document.addEventListener('DOMContentLoaded', () => {
        void init();
        let currentView = localStorage.getItem('cardConfigurationsView') || 'list';
        function updateViewToggle() {
            const btnList = getEl('btnListView');
            const btnGrid = getEl('btnGridView');
            const tableSection = getEl('cardConfigsSection');
            const gridSection = getEl('cardConfigsGridSection');
            if (tableSection && gridSection) {
                if (currentView === 'list') {
                    tableSection.classList.remove('hidden');
                    gridSection.classList.add('hidden');
                }
                else {
                    tableSection.classList.add('hidden');
                    gridSection.classList.remove('hidden');
                }
            }
            if (btnList && btnGrid) {
                btnList.className =
                    'flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1';
                btnGrid.className =
                    'flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1';
                if (currentView === 'list') {
                    btnList.className =
                        'flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1';
                }
                else {
                    btnGrid.className =
                        'flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1';
                }
            }
        }
        const btnListView = getEl('btnListView');
        btnListView?.addEventListener('click', () => {
            currentView = 'list';
            localStorage.setItem('cardConfigurationsView', 'list');
            updateViewToggle();
        });
        const btnGridView = getEl('btnGridView');
        btnGridView?.addEventListener('click', () => {
            currentView = 'grid';
            localStorage.setItem('cardConfigurationsView', 'grid');
            updateViewToggle();
        });
        updateViewToggle();
        // Event Delegation: Ações na Tabela e Grid
        function handleConfigAction(e) {
            const target = e.target;
            const btn = target?.closest('button[data-action]');
            if (!btn)
                return;
            const action = btn.getAttribute('data-action');
            const id = btn.getAttribute('data-id');
            if (action === 'edit')
                window.editConfig?.(id);
            if (action === 'duplicate')
                window.duplicateConfig?.(id);
            if (action === 'delete')
                window.deleteConfig?.(id);
            if (action === 'view-id') {
                const pid = btn.getAttribute('data-pid') || '';
                navigator.clipboard.writeText(pid).then(() => {
                    if (btn.classList.contains('animating'))
                        return;
                    btn.classList.add('animating');
                    const orig = btn.innerHTML;
                    const svgSize = 'h-3.5 w-3.5 inline';
                    btn.classList.add('scale-75', 'opacity-0');
                    setTimeout(() => {
                        btn.innerHTML = `<svg class="animate-spin h-3.5 w-3.5 text-brand-600 dark:text-brand-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
                        btn.classList.remove('scale-75', 'opacity-0');
                        setTimeout(() => {
                            btn.classList.add('scale-75', 'opacity-0');
                            setTimeout(() => {
                                btn.innerHTML = `<svg class="${svgSize} text-green-500 transition-all duration-300 transform scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
                                btn.classList.remove('scale-75', 'opacity-0');
                                btn.classList.add('scale-110', 'opacity-100');
                                setTimeout(() => {
                                    btn.classList.remove('scale-110');
                                }, 100);
                                setTimeout(() => {
                                    btn.classList.add('scale-75', 'opacity-0');
                                    setTimeout(() => {
                                        btn.innerHTML = orig;
                                        btn.classList.remove('scale-75', 'opacity-0', 'animating');
                                    }, 150);
                                }, 1000);
                            }, 150);
                        }, 400);
                    }, 150);
                });
            }
        }
        getEl('cardConfigsSection')?.addEventListener('click', handleConfigAction);
        getEl('cardConfigsGridSection')?.addEventListener('click', handleConfigAction);
        getEl('btnOpenModal')?.addEventListener('click', () => {
            if (g_types.length === 0) {
                if (confirm('Você precisa cadastrar pelo menos um Tipo de Recebível primeiro. Deseja ir para a página de cadastros agora?')) {
                    window.location.href = '/pages/receivable-types.html';
                }
                return;
            }
            openModal();
        });
        getEl('btnCancelModal')?.addEventListener('click', closeModal);
        getEl('modalBackdrop')?.addEventListener('click', closeModal);
        getEl('cardConfigForm')?.addEventListener('submit', handleSaveConfig);
        FilterPanel.mount({
            storageKey: 'card_configurations_filter_panel',
            fields: [
                { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Recebível, receber ou bandeira' },
            ],
            gridClass: 'grid grid-cols-1 gap-3 items-end',
        });
        let searchDebounceTimer = null;
        getEl('filterSearch')?.addEventListener('input', () => {
            if (searchDebounceTimer) {
                clearTimeout(searchDebounceTimer);
            }
            searchDebounceTimer = setTimeout(() => {
                applyFilters();
                searchDebounceTimer = null;
            }, 180);
        });
    });
    async function init() {
        try {
            await fetchTypes();
            await fetchBrands();
            await fetchConfigs();
        }
        catch (err) {
            console.error('Erro na inicialização:', err);
        }
    }
    // --- API Calls ---
    async function fetchTypes() {
        try {
            const res = await api('/receivable-types');
            g_types = res.data || [];
            const select = getEl('cardConfigReceivableType');
            const warningBanner = getEl('dependencyWarning');
            if (select) {
                if (g_types.length === 0) {
                    select.innerHTML = '<option value="">Sem tipos de recebíveis (cadastre um primeiro)...</option>';
                    if (warningBanner)
                        warningBanner.style.display = 'flex';
                }
                else {
                    select.innerHTML = '<option value="">Selecione um tipo de recebível...</option>';
                    g_types.forEach((t) => {
                        select.innerHTML += `<option value="${t.id}">${t.name}</option>`;
                    });
                    if (warningBanner)
                        warningBanner.style.display = 'none';
                }
            }
        }
        catch (error) {
            console.error('Erro ao buscar tipos de recebíveis:', error);
            showAlert('Erro ao carregar tipos de recebíveis.', 'error');
        }
    }
    async function fetchBrands() {
        try {
            const res = await api('/card-brands');
            g_brands = res.data || [];
            const select = getEl('cardConfigCardBrand');
            if (select) {
                select.innerHTML = '<option value="">Nenhuma</option>';
                g_brands.forEach((b) => {
                    select.innerHTML += `<option value="${b.id}">${b.name}</option>`;
                });
            }
        }
        catch (error) {
            console.error('Erro ao buscar bandeiras de cartões:', error);
            showAlert('Erro ao carregar bandeiras de cartões.', 'error');
        }
    }
    async function fetchConfigs() {
        try {
            const res = await api('/card-configurations');
            g_configs = res.data || [];
            applyFilters();
        }
        catch (error) {
            console.error('Erro ao buscar configurações de cartões:', error);
            showAlert('Erro ao carregar configurações de cartões.', 'error');
        }
    }
    async function handleSaveConfig(e) {
        e.preventDefault();
        const receivableTypeIdStr = getEl('cardConfigReceivableType')?.value;
        const cardBrandIdStr = getEl('cardConfigCardBrand')?.value;
        const paymentType = getEl('cardConfigPaymentType')?.value;
        const taxRateStr = getEl('cardConfigTaxRate')?.value;
        const dueDaysStr = getEl('cardConfigDueDays')?.value;
        const serviceFeeStr = getEl('cardConfigServiceFee')?.value;
        if (!receivableTypeIdStr || !paymentType || !taxRateStr || !dueDaysStr || !serviceFeeStr) {
            showAlert('Por favor, preencha todos os campos obrigatórios.', 'error');
            return;
        }
        const cleanFloat = (val) => {
            if (!val)
                return 0;
            const parsed = parseFloat(val.replace(',', '.'));
            return isNaN(parsed) ? 0 : parsed;
        };
        const cleanInt = (val) => {
            if (!val)
                return 0;
            const parsed = parseInt(val.replace(',', '.'), 10);
            return isNaN(parsed) ? 0 : parsed;
        };
        const data = {
            receivable_type_id: parseInt(receivableTypeIdStr, 10),
            card_brand_id: cardBrandIdStr ? parseInt(cardBrandIdStr, 10) : null,
            payment_type: paymentType,
            tax_rate: cleanFloat(taxRateStr),
            due_days: cleanInt(dueDaysStr),
            service_fee: cleanFloat(serviceFeeStr),
        };
        const btn = getEl('saveBtn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Salvando...';
        }
        try {
            if (g_editingId) {
                await api(`/card-configurations/${g_editingId}`, {
                    method: 'PUT',
                    body: JSON.stringify(data),
                });
                showAlert('Configuração de cartão atualizada com sucesso!', 'success');
            }
            else {
                await api('/card-configurations', {
                    method: 'POST',
                    body: JSON.stringify(data),
                });
                showAlert('Configuração de cartão cadastrada com sucesso!', 'success');
            }
            closeModal();
            await fetchConfigs();
        }
        catch (error) {
            console.error('Erro ao salvar:', error);
            showAlert(error?.message || 'Erro ao salvar configuração de cartão.', 'error');
        }
        finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Gravar';
            }
        }
    }
    window.deleteConfig = async (id) => {
        if (!confirm('Tem certeza que deseja excluir esta configuração de cartão?'))
            return;
        try {
            await api(`/card-configurations/${id}`, {
                method: 'DELETE',
            });
            showAlert('Configuração de cartão excluída com sucesso!', 'success');
            await fetchConfigs();
        }
        catch (error) {
            console.error('Erro ao excluir:', error);
            showAlert(error?.message || 'Erro ao excluir configuração de cartão.', 'error');
        }
    };
    // --- UI / Rendering ---
    function formatCurrency(val) {
        if (val === undefined || val === null)
            return 'R$ 0,00';
        const num = parseFloat(String(val));
        return isNaN(num) ? 'R$ 0,00' : num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    function formatPaymentType(type) {
        if (type === 'vista')
            return 'À Vista';
        if (type === 'debito')
            return 'Débito';
        if (type === 'credito')
            return 'Crédito';
        return type || '';
    }
    function renderTable() {
        const tbody = getEl('cardConfigsTable');
        if (!tbody)
            return;
        const items = g_filteredConfigs;
        tbody.innerHTML = '';
        if (items.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="9" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhuma configuração de cartão encontrada.
                </td>
            </tr>
        `;
            return;
        }
        tbody.innerHTML = items
            .map((configObj) => {
            return `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
            <td class="px-6 py-4 whitespace-nowrap">
                <input type="checkbox" class="item-checkbox h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 dark:border-slate-600 rounded cursor-pointer" value="${configObj.public_id || ''}" data-bwignore="true" data-lpignore="true">
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400 font-mono">#${String(configObj.id || '').padStart(4, '0')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">
                <div>${configObj.receivable_type_name || ''}</div>
                <div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    <span class="font-mono text-[10px] select-all">${configObj.public_id || ''}</span>
                    <button type="button" data-action="view-id" data-id="${configObj.public_id || ''}" data-pid="${configObj.public_id || ''}" class="view-id-btn text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transform transition-all duration-200 ease-out" title="Copiar ID: ${configObj.public_id || ''}">
                        <svg class="h-3.5 w-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                        </svg>
                    </button>
                </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 font-medium">
                ${formatPaymentType(configObj.payment_type)}
            </td>
            <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 font-medium">
                ${configObj.card_brand_name || '<span class="italic text-gray-400 dark:text-slate-500">Qualquer</span>'}
            </td>
            <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                ${configObj.tax_rate !== undefined && configObj.tax_rate !== null ? `${parseFloat(String(configObj.tax_rate)).toFixed(2)}%` : '0.00%'}
            </td>
            <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                ${configObj.due_days !== undefined ? `${configObj.due_days} dia(s)` : '0 dia(s)'}
            </td>
            <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                ${formatCurrency(configObj.service_fee)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                <div class="flex items-center justify-center space-x-3">
                    <button data-action="edit" data-id="${configObj.public_id || ''}" class="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 transition-colors" title="Editar">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button data-action="duplicate" data-id="${configObj.public_id || ''}" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors" title="Duplicar">
                        <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </button>
                    <button data-action="delete" data-id="${configObj.public_id || ''}" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors" title="Excluir">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </td>
        </tr>`;
        })
            .join('');
        const selectAllBtn = getEl('selectAll');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('change', (e) => {
                const checked = !!e.target?.checked;
                document.querySelectorAll('.item-checkbox').forEach((cb) => {
                    cb.checked = checked;
                });
            });
        }
        document.querySelectorAll('.item-checkbox').forEach((cb) => {
            cb.addEventListener('change', () => {
                if (!cb.checked && selectAllBtn) {
                    selectAllBtn.checked = false;
                }
            });
        });
    }
    function renderGrid() {
        const grid = getEl('cardConfigsGridSection');
        if (!grid)
            return;
        const items = g_filteredConfigs;
        if (items.length === 0) {
            grid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-12 gap-2">
            <svg class="w-10 h-10 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <p class="text-sm text-gray-400 dark:text-gray-500">Nenhuma configuração de cartão encontrada.</p>
        </div>`;
            return;
        }
        grid.innerHTML = items
            .map((configObj) => {
            return `
        <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col border border-gray-100 dark:border-slate-700 relative group">
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center z-10 pt-1">
                    <input type="checkbox" value="${configObj.public_id || ''}" class="item-checkbox rounded border-gray-300 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800 dark:border-slate-600" data-bwignore="true" data-lpignore="true">
                    <span class="ml-2 text-xs font-mono font-medium text-gray-500 dark:text-gray-400">#${String(configObj.id || '').padStart(4, '0')}</span>
                </div>

                <div class="flex space-x-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10 -mr-1 -mt-1">
                    <button data-action="edit" data-id="${configObj.public_id || ''}" class="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-md transition-colors" title="Editar">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button data-action="duplicate" data-id="${configObj.public_id || ''}" class="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-md transition-colors" title="Duplicar">
                        <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </button>
                    <button data-action="delete" data-id="${configObj.public_id || ''}" class="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-md transition-colors" title="Excluir">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>

            <div class="flex-1 mt-0">
                <div class="flex justify-between items-start gap-2">
                    <h4 class="text-base font-bold text-gray-900 dark:text-gray-100 wrap-break-word flex-1 leading-tight">${configObj.receivable_type_name || ''}</h4>
                </div>

                <div class="mt-2 text-sm text-gray-500 dark:text-gray-400 space-y-1">
                    <div>Receber: <span class="font-medium text-gray-800 dark:text-gray-200">${formatPaymentType(configObj.payment_type)}</span></div>
                    <div>Bandeira: <span class="font-medium text-gray-850 dark:text-gray-150">${configObj.card_brand_name || 'Qualquer'}</span></div>
                    <div>Taxa: <span class="font-medium text-gray-800 dark:text-gray-200">${configObj.tax_rate !== undefined && configObj.tax_rate !== null ? `${parseFloat(String(configObj.tax_rate)).toFixed(2)}%` : '0.00%'}</span></div>
                    <div>Recebimento: <span class="font-medium text-gray-800 dark:text-gray-200">${configObj.due_days !== undefined ? `${configObj.due_days} dia(s)` : '0 dia(s)'}</span></div>
                    <div>Valor para Serviço: <span class="font-medium text-gray-800 dark:text-gray-200">${formatCurrency(configObj.service_fee)}</span></div>
                </div>

                <div class="mt-3 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-medium">
                    <span class="font-mono text-[10px] select-all">${configObj.public_id || ''}</span>
                    <button type="button" data-action="view-id" data-id="${configObj.public_id || ''}" data-pid="${configObj.public_id || ''}" class="text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transform transition-all duration-200 ease-out font-normal" title="Copiar ID: ${configObj.public_id || ''}">
                        <svg class="h-3.5 w-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>`;
        })
            .join('');
    }
    function applyFilters() {
        const search = FilterPanel.normalizeText(getEl('filterSearch')?.value);
        g_filteredConfigs = g_configs.filter((item) => {
            if (!FilterPanel.matchesSearch(item, ['receivable_type_name', 'card_brand_name', 'payment_type'], search)) {
                return false;
            }
            return true;
        });
        renderTable();
        renderGrid();
        window.GridSummaryFooter?.update({
            footerId: 'cardConfigsResultsFooter',
            anchorId: 'cardConfigsGridSection',
            count: g_filteredConfigs.length,
            label: 'configuração(ões) de cartão exibida(s)',
        });
    }
    // --- Modal Actions ---
    function openModal(configObj = null) {
        g_editingId = configObj ? configObj.public_id || null : null;
        const title = getEl('modalTitle');
        if (title)
            title.textContent = configObj ? 'Editar Configuração de Cartão' : 'Cadastrar Configuração de Cartão';
        const typeSelect = getEl('cardConfigReceivableType');
        const brandSelect = getEl('cardConfigCardBrand');
        const paymentSelect = getEl('cardConfigPaymentType');
        const taxInput = getEl('cardConfigTaxRate');
        const dueInput = getEl('cardConfigDueDays');
        const feeInput = getEl('cardConfigServiceFee');
        const idInput = getEl('cardConfigId');
        const form = getEl('cardConfigForm');
        if (configObj) {
            if (typeSelect)
                typeSelect.value = configObj.receivable_type_id ? String(configObj.receivable_type_id) : '';
            if (brandSelect)
                brandSelect.value = configObj.card_brand_id ? String(configObj.card_brand_id) : '';
            if (paymentSelect)
                paymentSelect.value = configObj.payment_type || 'credito';
            if (taxInput)
                taxInput.value = configObj.tax_rate !== undefined ? String(configObj.tax_rate) : '';
            if (dueInput)
                dueInput.value = configObj.due_days !== undefined ? String(configObj.due_days) : '';
            if (feeInput)
                feeInput.value = configObj.service_fee !== undefined ? String(configObj.service_fee) : '';
            if (idInput)
                idInput.value = configObj.public_id || '';
        }
        else {
            form?.reset();
            if (idInput)
                idInput.value = '';
            if (paymentSelect)
                paymentSelect.value = 'credito';
        }
        getEl('cardConfigModal')?.classList.remove('hidden');
        setTimeout(() => {
            typeSelect?.focus();
        }, 100);
    }
    function closeModal() {
        getEl('cardConfigModal')?.classList.add('hidden');
        getEl('cardConfigForm')?.reset();
        g_editingId = null;
    }
    window.editConfig = (publicId) => {
        const c = g_configs.find((item) => item.public_id === publicId);
        if (c)
            openModal(c);
    };
    window.duplicateConfig = (publicId) => {
        const c = g_configs.find((item) => item.public_id === publicId);
        if (c) {
            const dup = { ...c, public_id: '' };
            openModal(dup);
        }
    };
    // --- Utils ---
    function showAlert(message, type = 'success') {
        const alertEl = getEl('alertMessage');
        if (!alertEl)
            return;
        alertEl.textContent = message;
        alertEl.className = `mx-4 sm:mx-0 mb-4 p-4 rounded-md text-sm ${type === 'success'
            ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800'
            : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'}`;
        alertEl.classList.remove('hidden');
        setTimeout(() => {
            alertEl.classList.add('hidden');
        }, 5000);
    }
})();
