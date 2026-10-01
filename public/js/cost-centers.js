(() => {
    /**
     * cost-centers.ts
     * Gerencia a tela de Centros de Custo do módulo Financeiro
     */
    let g_items = [];
    let g_filteredItems = [];
    let g_editingId = null;
    const FilterPanel = window.FilterPanel;
    const api = window.api;
    const getEl = (id) => document.getElementById(id);
    document.addEventListener('DOMContentLoaded', () => {
        void init();
        // Forçado a exibir sempre em Lista (Tabela) por solicitação do usuário
        const tableSection = getEl('costCentersSection');
        if (tableSection) {
            tableSection.classList.remove('hidden');
        }
        // Event Delegation: Ações na Tabela e Grid
        function handleAction(e) {
            const target = e.target;
            const btn = target?.closest('button[data-action]');
            if (!btn)
                return;
            const action = btn.getAttribute('data-action');
            const id = btn.getAttribute('data-id');
            if (action === 'edit')
                window.editCostCenter?.(id);
            if (action === 'delete')
                window.deleteCostCenter?.(id);
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
        getEl('costCentersSection')?.addEventListener('click', handleAction);
        getEl('btnOpenModal')?.addEventListener('click', () => openModal());
        getEl('btnCancelModal')?.addEventListener('click', closeModal);
        getEl('modalBackdrop')?.addEventListener('click', closeModal);
        getEl('costCenterForm')?.addEventListener('submit', handleSaveItem);
        FilterPanel.mount({
            storageKey: 'cost_centers_filter_panel',
            fields: [
                { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome ou descrição' },
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
            await fetchItems();
        }
        catch (err) {
            console.error('Erro na inicialização:', err);
        }
    }
    // --- API Calls ---
    async function fetchItems() {
        try {
            const res = await api('/cost-centers');
            g_items = res.data || [];
            applyFilters();
        }
        catch (error) {
            console.error('Erro ao buscar centros de custo:', error);
            showAlert('Erro ao carregar centros de custo.', 'error');
        }
    }
    async function handleSaveItem(e) {
        e.preventDefault();
        const name = getEl('costCenterName')?.value;
        const description = getEl('costCenterDescription')?.value || '';
        const isActive = getEl('costCenterActive')?.checked ?? true;
        if (!name) {
            showAlert('Por favor, preencha todos os campos obrigatórios.', 'error');
            return;
        }
        const data = {
            name: name.trim(),
            description: description.trim() || null,
            is_active: isActive ? 1 : 0
        };
        const btn = getEl('saveBtn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Salvando...';
        }
        try {
            if (g_editingId) {
                await api(`/cost-centers/${g_editingId}`, {
                    method: 'PUT',
                    body: JSON.stringify(data),
                });
                showAlert('Centro de custo atualizado com sucesso!', 'success');
            }
            else {
                await api('/cost-centers', {
                    method: 'POST',
                    body: JSON.stringify(data),
                });
                showAlert('Centro de custo cadastrado com sucesso!', 'success');
            }
            closeModal();
            await fetchItems();
        }
        catch (error) {
            console.error('Erro ao salvar:', error);
            showAlert(error?.message || 'Erro ao salvar centro de custo.', 'error');
        }
        finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Gravar';
            }
        }
    }
    window.deleteCostCenter = async (id) => {
        if (!confirm('Tem certeza que deseja excluir este centro de custo?'))
            return;
        try {
            await api(`/cost-centers/${id}`, {
                method: 'DELETE',
            });
            showAlert('Centro de custo excluído com sucesso!', 'success');
            await fetchItems();
        }
        catch (error) {
            console.error('Erro ao excluir:', error);
            showAlert(error?.message || 'Erro ao excluir centro de custo.', 'error');
        }
    };
    // --- UI / Rendering ---
    function renderTable() {
        const tbody = getEl('costCentersTable');
        if (!tbody)
            return;
        const items = g_filteredItems;
        tbody.innerHTML = '';
        if (items.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhum centro de custo encontrado.
                </td>
            </tr>
        `;
            return;
        }
        tbody.innerHTML = items
            .map((itemObj) => {
            const badgeClass = itemObj.is_active
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
            const badgeLabel = itemObj.is_active ? 'Ativo' : 'Inativo';
            return `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
            <td class="px-6 py-4 whitespace-nowrap">
                <input type="checkbox" class="item-checkbox h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 dark:border-slate-600 rounded cursor-pointer" value="${itemObj.public_id || ''}" data-bwignore="true" data-lpignore="true">
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400 font-mono">#${String(itemObj.id || '').padStart(4, '0')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                <div class="font-bold">${itemObj.name || ''}</div>
                ${itemObj.description ? `<div class="text-xs text-gray-500 dark:text-gray-400 max-w-md truncate">${itemObj.description}</div>` : ''}
                <div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-normal">
                    <span class="font-mono text-[10px] select-all">${itemObj.public_id || ''}</span>
                    <button type="button" data-action="view-id" data-id="${itemObj.public_id || ''}" data-pid="${itemObj.public_id || ''}" class="view-id-btn text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transform transition-all duration-200 ease-out" title="Copiar ID: ${itemObj.public_id || ''}">
                        <svg class="h-3.5 w-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                        </svg>
                    </button>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                <span class="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeClass}">${badgeLabel}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                <div class="flex items-center justify-center space-x-3">
                    <button data-action="edit" data-id="${itemObj.public_id || ''}" class="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 transition-colors" title="Editar">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button data-action="delete" data-id="${itemObj.public_id || ''}" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors" title="Excluir">
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
    function applyFilters() {
        const search = FilterPanel.normalizeText(getEl('filterSearch')?.value);
        g_filteredItems = g_items.filter((item) => {
            if (!FilterPanel.matchesSearch(item, ['name', 'description'], search)) {
                return false;
            }
            return true;
        });
        renderTable();
        const countEl = getEl('footerCount');
        if (countEl) {
            countEl.textContent = String(g_filteredItems.length);
        }
    }
    function openModal(id = null) {
        g_editingId = id;
        const modal = getEl('costCenterModal');
        const form = getEl('costCenterForm');
        const title = getEl('modalTitle');
        if (!modal || !form)
            return;
        if (id) {
            const item = g_items.find((x) => x.public_id === id);
            if (item) {
                if (title)
                    title.textContent = 'Editar Centro de Custo';
                getEl('costCenterId').value = item.public_id || '';
                getEl('costCenterName').value = item.name || '';
                getEl('costCenterDescription').value = item.description || '';
                getEl('costCenterActive').checked = !!item.is_active;
            }
        }
        else {
            if (title)
                title.textContent = 'Cadastrar Centro de Custo';
            form.reset();
            getEl('costCenterId').value = '';
            getEl('costCenterActive').checked = true;
        }
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    }
    function closeModal() {
        const modal = getEl('costCenterModal');
        if (!modal)
            return;
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    }
    window.editCostCenter = (id) => {
        openModal(id);
    };
    function showAlert(msg, type = 'success') {
        const alertEl = getEl('alertMessage');
        if (!alertEl)
            return;
        alertEl.textContent = msg;
        alertEl.className = `mx-4 sm:mx-0 mb-4 p-4 rounded-xl text-sm transition-all duration-300 ${type === 'success'
            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800/30'
            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800/30'}`;
        alertEl.classList.remove('hidden');
        setTimeout(() => {
            alertEl.classList.add('hidden');
        }, 4000);
    }
})();
