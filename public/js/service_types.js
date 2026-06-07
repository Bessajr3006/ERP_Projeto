(() => {
    const VIEW_STORAGE_KEY = 'service_types_view';
    const PAGE_SIZE = 20;
    const Paginator = window.Paginator;
    const getById = (id) => document.getElementById(id);
    const qsa = (selector) => document.querySelectorAll(selector);

    let serviceTypes = [];
    let filteredServiceTypes = [];
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

    function updateResultsFooter(visibleCount = 0, totalCount = filteredServiceTypes.length) {
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
        const tableSection = getById('serviceTypesSection');
        const gridSection = getById('serviceTypesGridSection');
        const tablePagination = getById('serviceTypesPaginationContainer');
        const gridPagination = getById('serviceTypesGridPaginationContainer');
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

    function renderTable(items = filteredServiceTypes) {
        const tbody = getById('serviceTypesTable');
        if (!tbody) return;

        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum tipo de serviço cadastrado.</td></tr>';
            return;
        }

        tbody.innerHTML = items.map((item) => `
            <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="px-3 py-4 whitespace-nowrap">
                    <input type="checkbox" value="${item.public_id}" class="item-checkbox rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" data-bwignore="true" data-lpignore="true" placeholder="">
                </td>
                <td class="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100">${escapeHtml(item.name)}</td>
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
            btn.addEventListener('click', () => removeServiceType(btn.dataset.id));
        });

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

    function renderGrid(items = filteredServiceTypes) {
        const grid = getById('serviceTypesGridSection');
        if (!grid) return;

        if (items.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">Nenhum tipo de serviço encontrado.</div>';
            return;
        }

        grid.innerHTML = items.map((item) => `
            <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col border border-gray-100 dark:border-slate-700">
                <h4 class="text-lg font-bold text-gray-900 dark:text-gray-100">${escapeHtml(item.name)}</h4>
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

        qsa('#serviceTypesGridSection .edit-btn').forEach((btn) => {
            btn.addEventListener('click', () => openModal(btn.dataset.id));
        });
        qsa('#serviceTypesGridSection .delete-btn').forEach((btn) => {
            btn.addEventListener('click', () => removeServiceType(btn.dataset.id));
        });
    }

    function closeModal() {
        getById('serviceTypeModal')?.classList.add('hidden');
    }

    function openModal(id = null) {
        const form = getById('serviceTypeForm');
        const title = getById('modalTitle');
        form?.reset();
        getById('serviceTypeId').value = '';

        if (id) {
            const item = serviceTypes.find((serviceType) => String(serviceType.public_id) === String(id));
            if (item) {
                title.textContent = 'Editar Tipo de Serviço';
                getById('serviceTypeId').value = String(item.public_id);
                getById('serviceTypeName').value = item.name || '';
                getById('serviceTypeDescription').value = item.description || '';
            }
        } else {
            title.textContent = 'Novo Tipo de Serviço';
        }

        getById('serviceTypeModal')?.classList.remove('hidden');
        getById('serviceTypeName')?.focus();
    }

    function removeServiceType(id) {
        const item = serviceTypes.find((serviceType) => String(serviceType.public_id) === String(id));
        if (!item) return;
        if (!window.confirm(`Deseja excluir o tipo de serviço "${item.name}"?`)) return;

        api(`/estoque/service-types/${id}`, { method: 'DELETE' })
            .then(() => {
                showAlert('Tipo de serviço excluído com sucesso!', 'success');
                return loadServiceTypes();
            })
            .catch((error) => {
                showAlert(error.message || 'Erro ao excluir tipo de serviço.', 'error');
            });
    }

    async function handleSubmit(event) {
        event.preventDefault();
        const id = normalizeText(getById('serviceTypeId').value);
        const name = normalizeText(getById('serviceTypeName').value);
        const description = normalizeText(getById('serviceTypeDescription').value);
        const saveBtn = getById('saveBtn');

        if (!name) {
            showAlert('Informe o tipo de serviço.', 'error');
            getById('serviceTypeName')?.focus();
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
                await api(`/estoque/service-types/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                });
                showAlert('Tipo de serviço atualizado com sucesso!', 'success');
            } else {
                await api('/estoque/service-types', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                showAlert('Tipo de serviço cadastrado com sucesso!', 'success');
            }

            await loadServiceTypes();
            closeModal();
        } catch (error) {
            showAlert(error.message || 'Erro ao salvar tipo de serviço.', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar';
        }
    }

    function ensurePaginators() {
        if (!Paginator) return;

        if (!tablePager) {
            tablePager = new Paginator({
                containerId: 'serviceTypesPaginationContainer',
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
                containerId: 'serviceTypesGridPaginationContainer',
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

        filteredServiceTypes = serviceTypes.filter((item) => {
            if (!search) return true;
            const name = String(item.name || '').toLowerCase();
            const description = String(item.description || '').toLowerCase();
            return name.includes(search) || description.includes(search);
        });

        if (tablePager && gridPager) {
            tablePager.setData(filteredServiceTypes);
            gridPager.setData(filteredServiceTypes);
            listPage = tablePager.currentPage;
            gridPage = gridPager.currentPage;
        } else {
            listVisibleCount = filteredServiceTypes.length;
            gridVisibleCount = filteredServiceTypes.length;
            listPage = 1;
            gridPage = 1;
            renderTable(filteredServiceTypes);
            renderGrid(filteredServiceTypes);
            updateResultsFooter(currentView === 'list' ? listVisibleCount : gridVisibleCount);
        }
    }

    function renderAll() {
        applyFilters();
        updateViewToggle();
    }

    async function loadServiceTypes() {
        try {
            const response = await api('/estoque/service-types');
            serviceTypes = Array.isArray(response?.data) ? response.data : [];
            filteredServiceTypes = [...serviceTypes];
            renderAll();
        } catch (error) {
            serviceTypes = [];
            filteredServiceTypes = [];
            renderAll();
            showAlert(error.message || 'Erro ao carregar tipos de serviço.', 'error');
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }

        ensurePaginators();

        loadServiceTypes();

        getById('btnOpenModal')?.addEventListener('click', () => openModal());
        getById('btnCancelModal')?.addEventListener('click', closeModal);
        getById('modalBackdrop')?.addEventListener('click', closeModal);
        getById('serviceTypeForm')?.addEventListener('submit', handleSubmit);

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
