(() => {
    /**
     * receivable-types.ts
     * Gerencia a tela de Tipos de Recebíveis do módulo Financeiro
     */
    let g_types = [];
    let g_banks = [];
    let g_filteredTypes = [];
    let g_editingId = null;
    const FilterPanel = window.FilterPanel;
    const api = window.api;
    const getEl = (id) => document.getElementById(id);
    document.addEventListener('DOMContentLoaded', () => {
        void init();
        let currentView = localStorage.getItem('receivableTypesView') || 'list';
        function updateViewToggle() {
            const btnList = getEl('btnListView');
            const btnGrid = getEl('btnGridView');
            const tableSection = getEl('receivableTypesSection');
            const gridSection = getEl('receivableTypesGridSection');
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
            localStorage.setItem('receivableTypesView', 'list');
            updateViewToggle();
        });
        const btnGridView = getEl('btnGridView');
        btnGridView?.addEventListener('click', () => {
            currentView = 'grid';
            localStorage.setItem('receivableTypesView', 'grid');
            updateViewToggle();
        });
        updateViewToggle();
        // Event Delegation: Ações na Tabela e Grid
        function handleTypeAction(e) {
            const target = e.target;
            const btn = target?.closest('button[data-action]');
            if (!btn)
                return;
            const action = btn.getAttribute('data-action');
            const id = btn.getAttribute('data-id');
            if (action === 'edit')
                window.editType?.(id);
            if (action === 'delete')
                window.deleteType?.(id);
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
        getEl('receivableTypesSection')?.addEventListener('click', handleTypeAction);
        getEl('receivableTypesGridSection')?.addEventListener('click', handleTypeAction);
        getEl('btnOpenModal')?.addEventListener('click', () => openModal());
        getEl('btnCancelModal')?.addEventListener('click', closeModal);
        getEl('modalBackdrop')?.addEventListener('click', closeModal);
        getEl('receivableTypeForm')?.addEventListener('submit', handleSaveType);
        FilterPanel.mount({
            storageKey: 'receivable_types_filter_panel',
            fields: [
                { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome ou conta' },
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
            await fetchBanks();
            await fetchTypes();
        }
        catch (err) {
            console.error('Erro na inicialização:', err);
        }
    }
    // --- API Calls ---
    async function fetchBanks() {
        try {
            const res = await api('/bank-accounts');
            g_banks = res.data || [];
            const select = getEl('receivableTypeBankAccount');
            if (select) {
                select.innerHTML = '<option value="">Selecione uma conta...</option>';
                g_banks.forEach((bank) => {
                    select.innerHTML += `<option value="${bank.id}">${bank.name}</option>`;
                });
            }
        }
        catch (error) {
            console.error('Erro ao buscar contas bancárias:', error);
            showAlert('Erro ao carregar contas bancárias.', 'error');
        }
    }
    async function fetchTypes() {
        try {
            const res = await api('/receivable-types');
            g_types = res.data || [];
            applyFilters();
        }
        catch (error) {
            console.error('Erro ao buscar tipos de recebíveis:', error);
            showAlert('Erro ao carregar tipos de recebíveis.', 'error');
        }
    }
    async function handleSaveType(e) {
        e.preventDefault();
        const name = getEl('receivableTypeName')?.value;
        const bankAccountIdStr = getEl('receivableTypeBankAccount')?.value;
        if (!name || !bankAccountIdStr) {
            showAlert('Por favor, preencha todos os campos obrigatórios.', 'error');
            return;
        }
        const data = {
            name: name.trim(),
            bank_account_id: parseInt(bankAccountIdStr, 10),
        };
        const btn = getEl('saveBtn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Salvando...';
        }
        try {
            if (g_editingId) {
                await api(`/receivable-types/${g_editingId}`, {
                    method: 'PUT',
                    body: JSON.stringify(data),
                });
                showAlert('Tipo de recebível atualizado com sucesso!', 'success');
            }
            else {
                await api('/receivable-types', {
                    method: 'POST',
                    body: JSON.stringify(data),
                });
                showAlert('Tipo de recebível cadastrado com sucesso!', 'success');
            }
            closeModal();
            await fetchTypes();
        }
        catch (error) {
            console.error('Erro ao salvar:', error);
            showAlert(error?.message || 'Erro ao salvar tipo de recebível.', 'error');
        }
        finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Gravar';
            }
        }
    }
    window.deleteType = async (id) => {
        if (!confirm('Tem certeza que deseja excluir este tipo de recebível?'))
            return;
        try {
            await api(`/receivable-types/${id}`, {
                method: 'DELETE',
            });
            showAlert('Tipo de recebível excluído com sucesso!', 'success');
            await fetchTypes();
        }
        catch (error) {
            console.error('Erro ao excluir:', error);
            showAlert(error?.message || 'Erro ao excluir tipo de recebível.', 'error');
        }
    };
    // --- UI / Rendering ---
    function renderTable() {
        const tbody = getEl('receivableTypesTable');
        if (!tbody)
            return;
        const items = g_filteredTypes;
        tbody.innerHTML = '';
        if (items.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhum tipo de recebível encontrado.
                </td>
            </tr>
        `;
            return;
        }
        tbody.innerHTML = items
            .map((typeObj) => {
            return `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
            <td class="px-6 py-4 whitespace-nowrap">
                <input type="checkbox" class="item-checkbox h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 dark:border-slate-600 rounded cursor-pointer" value="${typeObj.public_id || ''}" data-bwignore="true" data-lpignore="true">
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400 font-mono">#${String(typeObj.id || '').padStart(4, '0')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">
                <div>${typeObj.name || ''}</div>
                <div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    <span class="font-mono text-[10px] select-all">${typeObj.public_id || ''}</span>
                    <button type="button" data-action="view-id" data-id="${typeObj.public_id || ''}" data-pid="${typeObj.public_id || ''}" class="view-id-btn text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transform transition-all duration-200 ease-out" title="Copiar ID: ${typeObj.public_id || ''}">
                        <svg class="h-3.5 w-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                        </svg>
                    </button>
                </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                ${typeObj.bank_account_name || '<span class="italic text-gray-400">Sem conta associada</span>'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                <div class="flex items-center justify-center space-x-3">
                    <button data-action="edit" data-id="${typeObj.public_id || ''}" class="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 transition-colors" title="Editar">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button data-action="delete" data-id="${typeObj.public_id || ''}" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors" title="Excluir">
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
        const grid = getEl('receivableTypesGridSection');
        if (!grid)
            return;
        const items = g_filteredTypes;
        if (items.length === 0) {
            grid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-12 gap-2">
            <svg class="w-10 h-10 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <p class="text-sm text-gray-400 dark:text-gray-500">Nenhum tipo de recebível encontrado.</p>
        </div>`;
            return;
        }
        grid.innerHTML = items
            .map((typeObj) => {
            return `
        <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col border border-gray-100 dark:border-slate-700 relative group transition-all duration-200 hover:shadow-md">
            <!-- Top Row: Checkbox and Short ID -->
            <div class="flex justify-between items-center mb-4">
                <div class="flex items-center z-10">
                    <input type="checkbox" value="${typeObj.public_id || ''}" class="item-checkbox rounded border-gray-300 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800 dark:border-slate-600" data-bwignore="true" data-lpignore="true">
                    <span class="ml-2 text-xs font-mono font-medium text-gray-500 dark:text-gray-400">#${String(typeObj.id || '').padStart(4, '0')}</span>
                </div>
            </div>

            <!-- Content Area: Title and Badge -->
            <div class="flex-1 min-w-0 mb-4">
                <h4 class="text-base font-bold text-gray-900 dark:text-gray-100 truncate">${typeObj.name || ''}</h4>
                <div class="mt-2 flex flex-wrap gap-1 items-start">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-brand-50/50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 border border-brand-200/50 dark:border-brand-800/40">${typeObj.bank_account_name || 'Sem conta'}</span>
                </div>
            </div>

            <!-- Footer: Public ID and Actions -->
            <div class="mt-auto pt-3 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center text-xs text-gray-400">
                <div class="flex items-center gap-1.5 min-w-0">
                    <span class="font-mono text-[10px] select-all truncate max-w-[120px] sm:max-w-none">${typeObj.public_id || ''}</span>
                    <button type="button" data-action="view-id" data-id="${typeObj.public_id || ''}" data-pid="${typeObj.public_id || ''}" class="text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 shrink-0 transform transition-all duration-200 ease-out" title="Copiar ID: ${typeObj.public_id || ''}">
                        <svg class="h-3.5 w-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                        </svg>
                    </button>
                </div>
                <div class="flex space-x-1 shrink-0">
                    <button data-action="edit" data-id="${typeObj.public_id || ''}" class="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-md transition-colors" title="Editar">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button data-action="delete" data-id="${typeObj.public_id || ''}" class="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-md transition-colors" title="Excluir">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
        g_filteredTypes = g_types.filter((item) => {
            if (!FilterPanel.matchesSearch(item, ['name', 'bank_account_name'], search)) {
                return false;
            }
            return true;
        });
        renderTable();
        renderGrid();
    }
    // --- Modal Actions ---
    function openModal(typeObj = null) {
        g_editingId = typeObj ? typeObj.public_id || null : null;
        const title = getEl('modalTitle');
        if (title)
            title.textContent = typeObj ? 'Editar Tipo de Recebível' : 'Cadastrar Tipo de Recebível';
        const nameInput = getEl('receivableTypeName');
        const bankSelect = getEl('receivableTypeBankAccount');
        const idInput = getEl('receivableTypeId');
        const form = getEl('receivableTypeForm');
        if (typeObj) {
            if (nameInput)
                nameInput.value = typeObj.name || '';
            if (bankSelect)
                bankSelect.value = String(typeObj.bank_account_id || '');
            if (idInput)
                idInput.value = typeObj.public_id || '';
        }
        else {
            form?.reset();
            if (idInput)
                idInput.value = '';
        }
        getEl('receivableTypeModal')?.classList.remove('hidden');
        setTimeout(() => {
            nameInput?.focus();
        }, 100);
    }
    function closeModal() {
        getEl('receivableTypeModal')?.classList.add('hidden');
        getEl('receivableTypeForm')?.reset();
        g_editingId = null;
    }
    window.editType = (publicId) => {
        const t = g_types.find((item) => item.public_id === publicId);
        if (t)
            openModal(t);
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
