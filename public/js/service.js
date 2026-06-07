(() => {
    const VIEW_STORAGE_KEY = 'services_view';
    const MUNICIPAL_TAX_STORAGE_KEY = 'municipal_taxation_references';
    const FEDERAL_TAX_STORAGE_KEY = 'federal_taxation_references';
    const PAGE_SIZE = 20;
    const Paginator = window.Paginator;
    const getById = (id) => document.getElementById(id);
    const qsa = (selector) => document.querySelectorAll(selector);

    let services = [];
    let serviceTypes = [];
    let municipalTaxReferences = [];
    let federalTaxReferences = [];
    let filteredServices = [];
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

    function showAlert(message, type = 'success') {
        const el = getById('alertMessage');
        if (!el) return;

        el.textContent = message;
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

    function parsePrice(raw) {
        const normalized = String(raw || '').trim().replace(',', '.');
        return Number(normalized);
    }

    function normalizeOptionalText(value) {
        const normalized = normalizeText(value);
        return normalized || null;
    }

    function populateServiceTypeSelect(selectedPublicId = '') {
        const select = getById('serviceType');
        if (!select) return;

        const options = ['<option value="">Selecione...</option>']
            .concat(serviceTypes.map((item) => `<option value="${escapeHtml(item.public_id)}">${escapeHtml(item.name)}</option>`));
        select.innerHTML = options.join('');
        select.value = selectedPublicId || '';
    }

    function loadMunicipalTaxReferences() {
        try {
            const raw = localStorage.getItem(MUNICIPAL_TAX_STORAGE_KEY);
            municipalTaxReferences = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(municipalTaxReferences)) municipalTaxReferences = [];
        } catch (_error) {
            municipalTaxReferences = [];
        }
    }

    function populateMunicipalTaxReferenceSelect(selectedId = '') {
        const select = getById('serviceMunicipalTaxReference');
        if (!select) return;

        const options = ['<option value="">Selecione uma referência (opcional)</option>']
            .concat(municipalTaxReferences.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.referenceName || 'Referência sem nome')}</option>`));
        select.innerHTML = options.join('');
        select.value = selectedId || '';
    }

    function loadFederalTaxReferences() {
        try {
            const raw = localStorage.getItem(FEDERAL_TAX_STORAGE_KEY);
            federalTaxReferences = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(federalTaxReferences)) federalTaxReferences = [];
        } catch (_error) {
            federalTaxReferences = [];
        }
    }

    function populateFederalTaxReferenceSelect(selectedId = '') {
        const select = getById('serviceFederalTaxReference');
        if (!select) return;

        const options = ['<option value="">Selecione uma referência (opcional)</option>']
            .concat(federalTaxReferences.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.referenceName || 'Referência sem nome')}</option>`));
        select.innerHTML = options.join('');
        select.value = selectedId || '';
    }

    function formatPrice(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(numeric);
    }

    function updateResultsFooter(visibleCount = 0, totalCount = filteredServices.length) {
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
        const tableSection = getById('servicesSection');
        const gridSection = getById('servicesGridSection');
        const tablePagination = getById('servicesPaginationContainer');
        const gridPagination = getById('servicesGridPaginationContainer');
        if (!tableSection || !gridSection) return;

        if (!btnList || !btnGrid) {
            currentView = 'list';
            localStorage.setItem(VIEW_STORAGE_KEY, 'list');
            tableSection.classList.remove('hidden');
            tableSection.classList.add('flex');
            gridSection.classList.remove('grid');
            gridSection.classList.add('hidden');
            tablePagination?.classList.remove('hidden');
            gridPagination?.classList.add('hidden');
            updateResultsFooter(listVisibleCount);
            return;
        }

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

    function renderTable(items = filteredServices) {
        const tbody = getById('servicesTable');
        if (!tbody) return;

        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum serviço cadastrado.</td></tr>';
            return;
        }

        tbody.innerHTML = items.map((item) => `
            <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="px-3 py-4 whitespace-nowrap">
                    <input type="checkbox" value="${item.public_id}" class="item-checkbox rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" data-bwignore="true" data-lpignore="true" placeholder="">
                </td>
                <td class="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100">${escapeHtml(item.name)}</td>
                <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">${escapeHtml(item.service_type_name || '-')}</td>
                <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">${escapeHtml(formatPrice(item.price))}</td>
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
            btn.addEventListener('click', () => removeService(btn.dataset.id));
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

    function renderGrid(items = filteredServices) {
        const grid = getById('servicesGridSection');
        if (!grid) return;

        if (items.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">Nenhum serviço encontrado.</div>';
            return;
        }

        grid.innerHTML = items.map((item) => `
            <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col border border-gray-100 dark:border-slate-700">
                <h4 class="text-lg font-bold text-gray-900 dark:text-gray-100">${escapeHtml(item.name)}</h4>
                <p class="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Tipo: ${escapeHtml(item.service_type_name || '-')}</p>
                <p class="mt-1 text-sm font-semibold text-brand-700 dark:text-brand-300">${escapeHtml(formatPrice(item.price))}</p>
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

        qsa('#servicesGridSection .edit-btn').forEach((btn) => {
            btn.addEventListener('click', () => openModal(btn.dataset.id));
        });
        qsa('#servicesGridSection .delete-btn').forEach((btn) => {
            btn.addEventListener('click', () => removeService(btn.dataset.id));
        });
    }

    function closeModal() {
        getById('serviceModal')?.classList.add('hidden');
    }

    function openModal(id = null) {
        const form = getById('serviceForm');
        const title = getById('modalTitle');
        form?.reset();
        getById('serviceId').value = '';
        populateServiceTypeSelect();
        loadMunicipalTaxReferences();
        populateMunicipalTaxReferenceSelect();
        loadFederalTaxReferences();
        populateFederalTaxReferenceSelect();

        if (id) {
            const item = services.find((service) => String(service.public_id) === String(id));
            if (item) {
                title.textContent = 'Editar Serviço';
                getById('serviceId').value = String(item.public_id);
                getById('serviceName').value = item.name || '';
                getById('servicePrice').value = Number(item.price || 0).toFixed(2);
                getById('serviceDescription').value = item.description || '';
                populateServiceTypeSelect(item.service_type_public_id || '');
                populateMunicipalTaxReferenceSelect(item.municipal_tax_reference_id || '');
                populateFederalTaxReferenceSelect(item.federal_tax_reference_id || '');
                getById('serviceNationalTaxCode').value = item.national_tax_code || '';
                getById('serviceMunicipalTaxCode').value = item.municipal_tax_code || '';
                getById('serviceNbsItem').value = item.nbs_item || '';
            }
        } else {
            title.textContent = 'Novo Serviço';
        }

        getById('serviceModal')?.classList.remove('hidden');
        getById('serviceName')?.focus();
    }

    function removeService(id) {
        const item = services.find((service) => String(service.public_id) === String(id));
        if (!item) return;
        if (!window.confirm(`Deseja excluir o serviço "${item.name}"?`)) return;

        api(`/estoque/services/${id}`, { method: 'DELETE' })
            .then(() => {
                showAlert('Serviço excluído com sucesso!', 'success');
                return loadServices();
            })
            .catch((error) => {
                showAlert(error.message || 'Erro ao excluir serviço.', 'error');
            });
    }

    async function handleSubmit(event) {
        event.preventDefault();
        const id = normalizeText(getById('serviceId').value);
        const name = normalizeText(getById('serviceName').value);
        const priceRaw = normalizeText(getById('servicePrice').value);
        const description = normalizeText(getById('serviceDescription').value);
        const serviceTypePublicId = normalizeText(getById('serviceType')?.value);
        const municipalTaxReferenceId = normalizeText(getById('serviceMunicipalTaxReference')?.value);
        const federalTaxReferenceId = normalizeText(getById('serviceFederalTaxReference')?.value);
        const nationalTaxCode = normalizeOptionalText(getById('serviceNationalTaxCode')?.value);
        const municipalTaxCode = normalizeOptionalText(getById('serviceMunicipalTaxCode')?.value);
        const nbsItem = normalizeOptionalText(getById('serviceNbsItem')?.value);
        const saveBtn = getById('saveBtn');
        const price = parsePrice(priceRaw);

        if (!name) {
            showAlert('Informe o nome do serviço.', 'error');
            getById('serviceName')?.focus();
            return;
        }

        if (!Number.isFinite(price) || price < 0) {
            showAlert('Informe um preço válido.', 'error');
            getById('servicePrice')?.focus();
            return;
        }

        if (!serviceTypePublicId) {
            showAlert('Selecione o tipo de serviço.', 'error');
            getById('serviceType')?.focus();
            return;
        }

        const selectedMunicipalRef = municipalTaxReferenceId
            ? municipalTaxReferences.find((item) => String(item.id) === municipalTaxReferenceId)
            : null;
        const selectedFederalRef = federalTaxReferenceId
            ? federalTaxReferences.find((item) => String(item.id) === federalTaxReferenceId)
            : null;

        const payload = {
            name,
            price,
            description: description || null,
            service_type_public_id: serviceTypePublicId,
            municipal_tax_reference_id: municipalTaxReferenceId || null,
            municipal_tax_reference_name: selectedMunicipalRef?.referenceName ? String(selectedMunicipalRef.referenceName) : null,
            federal_tax_reference_id: federalTaxReferenceId || null,
            federal_tax_reference_name: selectedFederalRef?.referenceName ? String(selectedFederalRef.referenceName) : null,
            national_tax_code: nationalTaxCode,
            municipal_tax_code: municipalTaxCode,
            nbs_item: nbsItem,
        };

        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';

        try {
            if (id) {
                await api(`/estoque/services/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                });
                showAlert('Serviço atualizado com sucesso!', 'success');
            } else {
                await api('/estoque/services', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                showAlert('Serviço cadastrado com sucesso!', 'success');
            }

            await loadServices();
            closeModal();
        } catch (error) {
            showAlert(error.message || 'Erro ao salvar serviço.', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar';
        }
    }

    function ensurePaginators() {
        if (!Paginator) return;

        if (!tablePager) {
            tablePager = new Paginator({
                containerId: 'servicesPaginationContainer',
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
                containerId: 'servicesGridPaginationContainer',
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

        filteredServices = services.filter((item) => {
            if (!search) return true;
            const name = String(item.name || '').toLowerCase();
            const description = String(item.description || '').toLowerCase();
            return name.includes(search) || description.includes(search);
        });

        if (tablePager && gridPager) {
            tablePager.setData(filteredServices);
            gridPager.setData(filteredServices);
            listPage = tablePager.currentPage;
            gridPage = gridPager.currentPage;
        } else {
            listVisibleCount = filteredServices.length;
            gridVisibleCount = filteredServices.length;
            listPage = 1;
            gridPage = 1;
            renderTable(filteredServices);
            renderGrid(filteredServices);
            updateResultsFooter(currentView === 'list' ? listVisibleCount : gridVisibleCount);
        }
    }

    function renderAll() {
        applyFilters();
        updateViewToggle();
    }

    async function loadServices() {
        try {
            const response = await api('/estoque/services');
            services = Array.isArray(response?.data) ? response.data : [];
            filteredServices = [...services];
            renderAll();
        } catch (error) {
            services = [];
            filteredServices = [];
            renderAll();
            showAlert(error.message || 'Erro ao carregar serviços.', 'error');
        }
    }

    async function loadServiceTypes() {
        const response = await api('/estoque/service-types');
        serviceTypes = Array.isArray(response?.data) ? response.data : [];
        populateServiceTypeSelect();
    }

    document.addEventListener('DOMContentLoaded', async () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }

        ensurePaginators();

        try {
            await Promise.all([loadServiceTypes(), loadServices()]);
        } catch (error) {
            showAlert(error.message || 'Erro ao carregar dados da tela de serviços.', 'error');
        }

        getById('btnOpenModal')?.addEventListener('click', () => openModal());
        getById('btnCancelModal')?.addEventListener('click', closeModal);
        getById('modalBackdrop')?.addEventListener('click', closeModal);
        getById('serviceForm')?.addEventListener('submit', handleSubmit);

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
