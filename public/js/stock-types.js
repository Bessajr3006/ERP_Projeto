(() => {
    const VIEW_STORAGE_KEY = 'stock_types_view';
    const PAGE_SIZE = 20;
    const Paginator = window.Paginator;
    const getById = (id) => document.getElementById(id);
    const qsa = (selector) => document.querySelectorAll(selector);

    let stockTypes = [];
    let filteredStockTypes = [];
    let currentView = localStorage.getItem(VIEW_STORAGE_KEY) || 'list';
    let tablePager = null;
    let gridPager = null;
    let listVisibleCount = 0;
    let gridVisibleCount = 0;
    let listPage = 1;
    let gridPage = 1;

    function normalizeText(value) {
        return String(value || '').trim();
    }

    function showAlert(msg, type = 'success') {
        const el = getById('alertMessage');
        if (!el) return;
        el.textContent = msg;
        el.className = `mx-4 sm:mx-0 mb-4 p-4 rounded-xl text-sm ${type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 3500);
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function updateResultsFooter(visibleCount = 0, totalCount = filteredStockTypes.length) {
        const rangeEl = document.querySelector('[data-grid-footer-range]');
        const totalEl = document.querySelector('[data-grid-footer-total]');

        const currentPage = currentView === 'list' ? listPage : gridPage;
        const start = visibleCount > 0 ? ((currentPage - 1) * PAGE_SIZE) + 1 : 0;
        const end = visibleCount > 0 ? start + visibleCount - 1 : 0;

        if (rangeEl) rangeEl.textContent = `${start}-${end}`;
        if (totalEl) totalEl.textContent = String(totalCount);
    }

    function updateViewToggle() {
        const btnList = getById('btnListView');
        const btnGrid = getById('btnGridView');
        const tableSection = getById('stockTypesSection');
        const gridSection = getById('stockTypesGridSection');
        const tablePagination = getById('stockTypesPaginationContainer');
        const gridPagination = getById('stockTypesGridPaginationContainer');
        if (!btnList || !btnGrid || !tableSection || !gridSection) return;

        const activeClasses = 'flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1';
        const inactiveClasses = 'flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1';

        btnList.className = inactiveClasses;
        btnGrid.className = inactiveClasses;
        btnList.querySelector('.check-icon')?.classList.add('hidden');
        btnGrid.querySelector('.check-icon')?.classList.add('hidden');

        if (currentView === 'list') {
            btnList.className = activeClasses;
            btnList.querySelector('.check-icon')?.classList.remove('hidden');
            tableSection.classList.remove('hidden');
            tableSection.classList.add('flex');
            gridSection.classList.remove('grid');
            gridSection.classList.add('hidden');
            tablePagination?.classList.remove('hidden');
            gridPagination?.classList.add('hidden');
            updateResultsFooter(listVisibleCount);
        } else {
            btnGrid.className = activeClasses;
            btnGrid.querySelector('.check-icon')?.classList.remove('hidden');
            tableSection.classList.add('hidden');
            tableSection.classList.remove('flex');
            gridSection.classList.remove('hidden');
            gridSection.classList.add('grid');
            tablePagination?.classList.add('hidden');
            gridPagination?.classList.remove('hidden');
            updateResultsFooter(gridVisibleCount);
        }
    }

    function bindCopyEvents(selector) {
        qsa(selector).forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const pid = btn.getAttribute('data-id') || '';
                navigator.clipboard.writeText(pid).then(() => {
                    const b = btn;
                    if (b.classList.contains('animating')) return;
                    b.classList.add('animating');
                    const orig = b.innerHTML;
                    const svgSize = 'h-3.5 w-3.5 inline';

                    b.classList.add('scale-75', 'opacity-0');
                    setTimeout(() => {
                        b.innerHTML = `<svg class="animate-spin h-3.5 w-3.5 text-brand-600 dark:text-brand-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
                        b.classList.remove('scale-75', 'opacity-0');

                        setTimeout(() => {
                            b.classList.add('scale-75', 'opacity-0');
                            setTimeout(() => {
                                b.innerHTML = `<svg class="${svgSize} text-green-500 transition-all duration-300 transform scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
                                b.classList.remove('scale-75', 'opacity-0');
                                b.classList.add('scale-110', 'opacity-100');

                                setTimeout(() => {
                                    b.classList.remove('scale-110');
                                }, 100);

                                setTimeout(() => {
                                    b.classList.add('scale-75', 'opacity-0');
                                    setTimeout(() => {
                                        b.innerHTML = orig;
                                        b.classList.remove('scale-75', 'opacity-0', 'animating');
                                    }, 200);
                                }, 1000);
                            }, 200);
                        }, 400);
                    }, 200);
                });
            });
        });
    }

    function renderTable(items = filteredStockTypes) {
        const tbody = getById('stockTypesTable');
        if (!tbody) return;

        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum tipo de estoque cadastrado.</td></tr>';
            return;
        }

        tbody.innerHTML = items.map((item) => `
            <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="px-3 py-4 whitespace-nowrap">
                    <input type="checkbox" value="${item.public_id}" class="item-checkbox rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" data-bwignore="true" data-lpignore="true" placeholder="">
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">#${String(item.id).padStart(4, '0')}</td>
                <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    <div class="font-semibold">${escapeHtml(item.name)}</div>
                    <div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span class="font-mono text-[10px] select-all">${item.public_id}</span>
                        <button type="button" data-action="view-id" data-id="${item.public_id}" data-pid="${item.public_id}" class="view-id-btn text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transform transition-all duration-200 ease-out" title="Copiar ID: ${item.public_id}">
                            <svg class="h-3.5 w-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                            </svg>
                        </button>
                    </div>
                </td>
                <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">${escapeHtml(item.description || '-')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button type="button" title="Editar" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-3 edit-btn" data-id="${item.public_id}">
                        <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    <button type="button" title="Excluir" class="text-red-600 hover:text-red-900 dark:hover:text-red-400 delete-btn" data-id="${item.public_id}">
                        <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </td>
            </tr>
        `).join('');

        qsa('.edit-btn').forEach((btn) => {
            btn.addEventListener('click', () => openModal(btn.dataset.id));
        });
        qsa('.delete-btn').forEach((btn) => {
            btn.addEventListener('click', () => removeStockType(btn.dataset.id));
        });

        bindCopyEvents('#stockTypesTable .view-id-btn');

        const selectAll = getById('selectAll');
        if (selectAll) {
            selectAll.checked = false;
            selectAll.onchange = () => {
                qsa('.item-checkbox').forEach((cb) => {
                    cb.checked = selectAll.checked;
                });
            };
        }
    }

    function renderGrid(items = filteredStockTypes) {
        const grid = getById('stockTypesGridSection');
        if (!grid) return;

        if (items.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">Nenhum tipo de estoque encontrado.</div>';
            return;
        }

        grid.innerHTML = items.map((item) => `
            <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col border border-gray-100 dark:border-slate-700">
                <div class="flex justify-between items-start">
                    <h4 class="text-lg font-bold text-gray-900 dark:text-gray-100">${escapeHtml(item.name)}</h4>
                    <span class="text-xs font-mono text-gray-400 dark:text-gray-500">#${String(item.id).padStart(4, '0')}</span>
                </div>
                <div class="flex items-center gap-1.5 mt-0.5">
                    <span class="font-mono text-[10px] text-gray-400 dark:text-gray-500 select-all">${item.public_id}</span>
                    <button type="button" data-action="view-id" data-id="${item.public_id}" data-pid="${item.public_id}" class="view-id-btn text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transform transition-all duration-200 ease-out" title="Copiar ID: ${item.public_id}">
                        <svg class="h-3.5 w-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                        </svg>
                    </button>
                </div>
                <p class="mt-2 text-sm text-gray-600 dark:text-gray-300 min-h-14">${escapeHtml(item.description || 'Sem descrição.')}</p>
                <div class="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-2">
                    <button type="button" title="Editar" class="text-brand-600 hover:bg-brand-50 p-1.5 rounded-full dark:hover:bg-brand-900/30 edit-btn" data-id="${item.public_id}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    <button type="button" title="Excluir" class="text-red-500 hover:bg-red-50 p-1.5 rounded-full dark:hover:bg-red-900/30 delete-btn" data-id="${item.public_id}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>
        `).join('');

        qsa('#stockTypesGridSection .edit-btn').forEach((btn) => {
            btn.addEventListener('click', () => openModal(btn.dataset.id));
        });
        qsa('#stockTypesGridSection .delete-btn').forEach((btn) => {
            btn.addEventListener('click', () => removeStockType(btn.dataset.id));
        });

        bindCopyEvents('#stockTypesGridSection .view-id-btn');
    }

    function closeModal() {
        getById('stockTypeModal')?.classList.add('hidden');
    }

    function openModal(id = null) {
        const form = getById('stockTypeForm');
        const title = getById('modalTitle');
        form?.reset();
        getById('stockTypeId').value = '';

        if (id) {
            const item = stockTypes.find((stockType) => String(stockType.public_id) === String(id));
            if (item) {
                title.textContent = 'Editar Tipo de Estoque';
                getById('stockTypeId').value = String(item.public_id);
                getById('stockTypeName').value = item.name || '';
                getById('stockTypeDescription').value = item.description || '';
            }
        } else {
            title.textContent = 'Novo Tipo de Estoque';
        }

        getById('stockTypeModal')?.classList.remove('hidden');
        getById('stockTypeName')?.focus();
    }

    function removeStockType(id) {
        const item = stockTypes.find((stockType) => String(stockType.public_id) === String(id));
        if (!item) return;
        if (!window.confirm(`Deseja excluir o tipo de estoque "${item.name}"?`)) return;

        api(`/estoque/stock-types/${id}`, { method: 'DELETE' })
            .then(() => {
                showAlert('Tipo de estoque excluído com sucesso!', 'success');
                return loadStockTypes();
            })
            .catch((error) => {
                showAlert(error.message || 'Erro ao excluir tipo de estoque.', 'error');
            });
    }

    async function handleSubmit(event) {
        event.preventDefault();
        const id = normalizeText(getById('stockTypeId').value);
        const name = normalizeText(getById('stockTypeName').value);
        const description = normalizeText(getById('stockTypeDescription').value);
        const saveBtn = getById('saveBtn');

        if (!name) {
            showAlert('Informe o tipo de estoque.', 'error');
            getById('stockTypeName')?.focus();
            return;
        }

        const payload = {
            name,
            description: description || null,
        };

        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';

        try {
            if (id) {
                await api(`/estoque/stock-types/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                });
                showAlert('Tipo de estoque atualizado com sucesso!', 'success');
            } else {
                await api('/estoque/stock-types', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                showAlert('Tipo de estoque cadastrado com sucesso!', 'success');
            }

            await loadStockTypes();
            closeModal();
        } catch (error) {
            showAlert(error.message || 'Erro ao salvar tipo de estoque.', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar';
        }
    }

    function ensurePaginators() {
        if (!Paginator) return;

        if (!tablePager) {
            tablePager = new Paginator({
                containerId: 'stockTypesPaginationContainer',
                pageSize: PAGE_SIZE,
                onChange: (pageItems, state) => {
                    listVisibleCount = pageItems.length;
                    listPage = state.currentPage;
                    renderTable(pageItems);
                    if (currentView === 'list') updateResultsFooter(listVisibleCount);
                },
            });
        }

        if (!gridPager) {
            gridPager = new Paginator({
                containerId: 'stockTypesGridPaginationContainer',
                pageSize: PAGE_SIZE,
                onChange: (pageItems, state) => {
                    gridVisibleCount = pageItems.length;
                    gridPage = state.currentPage;
                    renderGrid(pageItems);
                    if (currentView === 'grid') updateResultsFooter(gridVisibleCount);
                },
            });
        }
    }

    function applyFilters() {
        const search = normalizeText(getById('filterSearch')?.value).toLowerCase();

        filteredStockTypes = stockTypes.filter((item) => {
            if (!search) return true;
            const name = String(item.name || '').toLowerCase();
            const description = String(item.description || '').toLowerCase();
            return name.includes(search) || description.includes(search);
        });

        if (tablePager && gridPager) {
            tablePager.setData(filteredStockTypes);
            gridPager.setData(filteredStockTypes);
            listPage = tablePager.currentPage;
            gridPage = gridPager.currentPage;
        } else {
            listVisibleCount = filteredStockTypes.length;
            gridVisibleCount = filteredStockTypes.length;
            listPage = 1;
            gridPage = 1;
            renderTable(filteredStockTypes);
            renderGrid(filteredStockTypes);
            updateResultsFooter(currentView === 'list' ? listVisibleCount : gridVisibleCount);
        }
    }

    function renderAll() {
        applyFilters();
        updateViewToggle();
    }

    async function loadStockTypes() {
        try {
            const response = await api('/estoque/stock-types');
            stockTypes = Array.isArray(response?.data) ? response.data : [];
            filteredStockTypes = [...stockTypes];
            renderAll();
        } catch (error) {
            stockTypes = [];
            filteredStockTypes = [];
            renderAll();
            showAlert(error.message || 'Erro ao carregar tipos de estoque.', 'error');
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }

        ensurePaginators();

        loadStockTypes();

        getById('btnOpenModal')?.addEventListener('click', () => openModal());
        getById('btnCancelModal')?.addEventListener('click', closeModal);
        getById('modalBackdrop')?.addEventListener('click', closeModal);
        getById('stockTypeForm')?.addEventListener('submit', handleSubmit);

        getById('btnListView')?.addEventListener('click', () => {
            currentView = 'list';
            localStorage.setItem(VIEW_STORAGE_KEY, 'list');
            updateViewToggle();
        });
        getById('btnGridView')?.addEventListener('click', () => {
            currentView = 'grid';
            localStorage.setItem(VIEW_STORAGE_KEY, 'grid');
            updateViewToggle();
        });

        getById('filterSearch')?.addEventListener('input', applyFilters);
    });
})();
