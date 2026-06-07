(() => {
    const getById = (id) => document.getElementById(id);

    let customers = [];
    let services = [];
    let revenueCategories = [];
    let bankAccounts = [];
    let launches = [];
    let filteredLaunches = [];

    function normalizeText(value) {
        return String(value || '').trim();
    }

    function parseNumber(value) {
        const normalized = normalizeText(value).replace(',', '.');
        return Number(normalized);
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatCurrency(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numeric);
    }

    function getCurrentDateValue() {
        const now = new Date();
        const timezoneOffset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
    }

    function formatDateTime(value) {
        if (!value) return '-';
        return window.DateUtils?.formatDateTime ? window.DateUtils.formatDateTime(value) : String(value);
    }

    function toDateInputValue(value) {
        if (!value) return '';
        const asString = String(value);
        if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) return asString;
        const parsed = new Date(asString);
        if (Number.isNaN(parsed.getTime())) return '';
        const timezoneOffset = parsed.getTimezoneOffset() * 60000;
        return new Date(parsed.getTime() - timezoneOffset).toISOString().slice(0, 10);
    }

    function showAlert(message, type = 'success') {
        const el = getById('alertMessage');
        if (!el) return;

        el.textContent = message;
        el.className = `mx-4 sm:mx-0 mb-4 p-4 rounded-xl text-sm ${type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`;
        el.classList.remove('hidden');

        setTimeout(() => el.classList.add('hidden'), 3500);
    }

    function loadLaunchesFromResponse(response) {
        launches = Array.isArray(response?.data) ? response.data : [];
        filteredLaunches = [...launches];
    }

    async function loadLaunches() {
        const response = await api('/estoque/service-launches');
        loadLaunchesFromResponse(response);
    }

    function customerLabel(customer) {
        return customer?.trade_name || customer?.name || customer?.full_name || customer?.company_name || 'Cliente';
    }

    function populateCustomers() {
        const select = getById('launchCustomer');
        if (!select) return;

        const options = ['<option value="">Selecione...</option>']
            .concat(customers.map((item) => `<option value="${escapeHtml(item.public_id)}">${escapeHtml(customerLabel(item))}</option>`));
        select.innerHTML = options.join('');
    }

    function populateServices() {
        const select = getById('launchService');
        if (!select) return;

        const options = ['<option value="">Selecione...</option>']
            .concat(services.map((item) => `<option value="${escapeHtml(item.public_id)}">${escapeHtml(item.name)} (${escapeHtml(formatCurrency(item.price))})</option>`));
        select.innerHTML = options.join('');
    }

    function populateRevenueCategories() {
        const select = getById('launchRevenueCategory');
        if (!select) return;

        const options = ['<option value="">Selecione...</option>']
            .concat(revenueCategories.map((item) => `<option value="${escapeHtml(item.public_id)}">${escapeHtml(item.name)}</option>`));
        select.innerHTML = options.join('');
    }

    function populateBankAccounts() {
        const select = getById('launchRevenueBank');
        if (!select) return;

        const options = ['<option value="">Selecione...</option>']
            .concat(bankAccounts.map((item) => `<option value="${escapeHtml(item.public_id)}">${escapeHtml(item.name)}</option>`));
        select.innerHTML = options.join('');
    }

    function toggleRevenueFields() {
        const shouldCreate = Boolean(getById('launchCreateRevenue')?.checked);
        const container = getById('launchRevenueFields');
        const category = getById('launchRevenueCategory');
        const bank = getById('launchRevenueBank');
        const date = getById('launchRevenueDate');
        const paymentMethod = getById('launchRevenuePaymentMethod');

        if (!container || !category || !bank || !date || !paymentMethod) return;

        container.classList.toggle('hidden', !shouldCreate);
        container.classList.toggle('grid', shouldCreate);
        category.required = shouldCreate;
        bank.required = shouldCreate;
        date.required = shouldCreate;
        paymentMethod.required = shouldCreate;

        if (!shouldCreate) {
            category.value = '';
            bank.value = '';
            date.value = '';
            paymentMethod.value = '';
        } else if (!date.value) {
            date.value = getCurrentDateValue();
        }
    }

    function findCustomer(publicId) {
        return customers.find((item) => String(item.public_id) === String(publicId)) || null;
    }

    function findService(publicId) {
        return services.find((item) => String(item.public_id) === String(publicId)) || null;
    }

    function updateCalculatedTotal() {
        const quantity = parseNumber(getById('launchQuantity')?.value);
        const unitPrice = parseNumber(getById('launchUnitPrice')?.value);
        const totalInput = getById('launchTotal');

        if (!totalInput) return;

        if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
            totalInput.value = formatCurrency(0);
            return;
        }

        totalInput.value = formatCurrency(quantity * unitPrice);
    }

    function renderTable() {
        const tbody = getById('serviceLaunchTable');
        if (!tbody) return;

        if (filteredLaunches.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum lançamento cadastrado.</td></tr>';
            return;
        }

        tbody.innerHTML = filteredLaunches.map((item) => `
            <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">${escapeHtml(item.customer_name)}</td>
                <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">${escapeHtml(item.service_name)}</td>
                <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">${escapeHtml(String(item.quantity))}</td>
                <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">${escapeHtml(formatCurrency(item.unit_price))}</td>
                <td class="px-6 py-4 text-sm font-semibold text-gray-700 dark:text-gray-300">${escapeHtml(formatCurrency(item.total_price))}</td>
                <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">${escapeHtml(formatDateTime(item.created_at))}</td>
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

        document.querySelectorAll('.edit-btn').forEach((btn) => {
            btn.addEventListener('click', () => openModal(btn.dataset.id));
        });
        document.querySelectorAll('.delete-btn').forEach((btn) => {
            btn.addEventListener('click', () => removeLaunch(btn.dataset.id));
        });
    }

    function applyFilters() {
        const search = normalizeText(getById('filterSearch')?.value).toLowerCase();

        filteredLaunches = launches.filter((item) => {
            if (!search) return true;
            return String(item.customer_name || '').toLowerCase().includes(search)
                || String(item.service_name || '').toLowerCase().includes(search)
                || String(item.observation || '').toLowerCase().includes(search);
        });

        renderTable();
    }

    function closeModal() {
        getById('serviceLaunchModal')?.classList.add('hidden');
    }

    function openModal(id = null) {
        const form = getById('serviceLaunchForm');
        const title = getById('modalTitle');
        form?.reset();
        getById('serviceLaunchId').value = '';
        getById('launchQuantity').value = '1';
        getById('launchCreateRevenue').checked = false;
        toggleRevenueFields();

        if (id) {
            const item = launches.find((entry) => String(entry.public_id) === String(id));
            if (!item) return;
            title.textContent = 'Editar Lançamento de Serviço';
            getById('serviceLaunchId').value = String(item.public_id);
            getById('launchCustomer').value = item.customer_public_id || '';
            getById('launchService').value = item.service_public_id || '';
            getById('launchQuantity').value = String(item.quantity || 1);
            getById('launchUnitPrice').value = Number(item.unit_price || 0).toFixed(2);
            getById('launchObservation').value = item.observation || '';

            if (item.revenue_public_id) {
                getById('launchCreateRevenue').checked = true;
                toggleRevenueFields();
                getById('launchRevenueCategory').value = item.revenue_category_public_id || '';
                getById('launchRevenueBank').value = item.revenue_bank_account_public_id || '';
                getById('launchRevenueDate').value = toDateInputValue(item.revenue_date);
                getById('launchRevenuePaymentMethod').value = item.revenue_payment_method || '';
            }
        } else {
            title.textContent = 'Novo Lançamento de Serviço';
        }

        updateCalculatedTotal();
        getById('serviceLaunchModal')?.classList.remove('hidden');
        getById('launchCustomer')?.focus();
    }

    function removeLaunch(id) {
        const item = launches.find((entry) => String(entry.public_id) === String(id));
        if (!item) return;
        if (!window.confirm(`Deseja excluir o lançamento de ${item.service_name}?`)) return;

        api(`/estoque/service-launches/${id}`, { method: 'DELETE' })
            .then(() => loadLaunches())
            .then(() => {
                applyFilters();
                showAlert('Lançamento excluído com sucesso!', 'success');
            })
            .catch((error) => {
                showAlert(error.message || 'Erro ao excluir lançamento.', 'error');
            });
    }

    async function handleSubmit(event) {
        event.preventDefault();

        const id = normalizeText(getById('serviceLaunchId')?.value);
        const customerId = normalizeText(getById('launchCustomer')?.value);
        const serviceId = normalizeText(getById('launchService')?.value);
        const quantity = parseNumber(getById('launchQuantity')?.value);
        const unitPrice = parseNumber(getById('launchUnitPrice')?.value);
        const observation = normalizeText(getById('launchObservation')?.value);
        const createRevenue = Boolean(getById('launchCreateRevenue')?.checked);
        const revenueCategoryId = normalizeText(getById('launchRevenueCategory')?.value);
        const revenueBankId = normalizeText(getById('launchRevenueBank')?.value);
        const revenueDate = normalizeText(getById('launchRevenueDate')?.value);
        const revenuePaymentMethod = normalizeText(getById('launchRevenuePaymentMethod')?.value);
        const saveBtn = getById('saveBtn');

        const customer = findCustomer(customerId);
        const service = findService(serviceId);

        if (!customerId || !customer) {
            showAlert('Selecione um cliente válido.', 'error');
            getById('launchCustomer')?.focus();
            return;
        }

        if (!serviceId || !service) {
            showAlert('Selecione um serviço válido.', 'error');
            getById('launchService')?.focus();
            return;
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
            showAlert('Informe uma quantidade válida.', 'error');
            getById('launchQuantity')?.focus();
            return;
        }

        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            showAlert('Informe um valor unitário válido.', 'error');
            getById('launchUnitPrice')?.focus();
            return;
        }

        if (createRevenue && !revenueCategoryId) {
            showAlert('Selecione a categoria da receita.', 'error');
            getById('launchRevenueCategory')?.focus();
            return;
        }

        if (createRevenue && !revenueBankId) {
            showAlert('Selecione a conta de destino da receita.', 'error');
            getById('launchRevenueBank')?.focus();
            return;
        }

        if (createRevenue && !revenueDate) {
            showAlert('Informe a data da receita.', 'error');
            getById('launchRevenueDate')?.focus();
            return;
        }

        if (createRevenue && !revenuePaymentMethod) {
            showAlert('Selecione a forma de pagamento da receita.', 'error');
            getById('launchRevenuePaymentMethod')?.focus();
            return;
        }

        const payload = {
            customer_public_id: customerId,
            service_public_id: serviceId,
            quantity,
            unit_price: unitPrice,
            observation: observation || null,
        };

        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';

        try {
            let launchPublicId = id;
            if (id) {
                await api(`/estoque/service-launches/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                });
                showAlert('Lançamento atualizado com sucesso!', 'success');
            } else {
                const createLaunchResponse = await api('/estoque/service-launches', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                launchPublicId = String(createLaunchResponse?.data?.public_id || '');
                showAlert('Lançamento cadastrado com sucesso!', 'success');
            }

            if (createRevenue) {
                const totalAmount = Number((quantity * unitPrice).toFixed(2));
                const launchRef = launchPublicId ? ` [SL:${launchPublicId}]` : '';
                const revenuePayload = {
                    description: `Lançamento de serviço - ${service?.name || 'Serviço'} - ${customerLabel(customer)}${launchRef}`,
                    amount: totalAmount,
                    date: revenueDate,
                    category_public_id: revenueCategoryId,
                    bank_account_public_id: revenueBankId,
                    customer_public_id: customerId,
                    payment_method: revenuePaymentMethod,
                    status: 'progress',
                };

                await api('/finance/revenues', {
                    method: 'POST',
                    body: JSON.stringify(revenuePayload),
                });
                showAlert('Lançamento salvo e receita criada com sucesso!', 'success');
            }

            await loadLaunches();
            applyFilters();
            closeModal();
        } catch (error) {
            showAlert(error.message || 'Erro ao salvar lançamento.', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar';
        }
    }

    async function loadCustomersAndServices() {
        const [customersResponse, servicesResponse, categoriesResponse, banksResponse] = await Promise.all([
            api('/entities/customers'),
            api('/estoque/services'),
            api('/finance/categories'),
            api('/bank-accounts'),
        ]);

        customers = Array.isArray(customersResponse?.data) ? customersResponse.data : [];
        services = Array.isArray(servicesResponse?.data) ? servicesResponse.data : [];
        revenueCategories = Array.isArray(categoriesResponse?.data)
            ? categoriesResponse.data.filter((item) => String(item.type) === 'income')
            : [];
        bankAccounts = Array.isArray(banksResponse?.data) ? banksResponse.data : [];

        populateCustomers();
        populateServices();
        populateRevenueCategories();
        populateBankAccounts();
    }

    function bindEvents() {
        getById('btnOpenModal')?.addEventListener('click', () => openModal());
        getById('btnCancelModal')?.addEventListener('click', closeModal);
        getById('modalBackdrop')?.addEventListener('click', closeModal);
        getById('serviceLaunchForm')?.addEventListener('submit', handleSubmit);
        getById('filterSearch')?.addEventListener('input', applyFilters);
        getById('launchCreateRevenue')?.addEventListener('change', toggleRevenueFields);

        getById('launchService')?.addEventListener('change', () => {
            const selected = findService(getById('launchService')?.value);
            if (selected) {
                getById('launchUnitPrice').value = Number(selected.price || 0).toFixed(2);
            }
            updateCalculatedTotal();
        });

        getById('launchQuantity')?.addEventListener('input', updateCalculatedTotal);
        getById('launchUnitPrice')?.addEventListener('input', updateCalculatedTotal);
    }

    document.addEventListener('DOMContentLoaded', async () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }

        bindEvents();

        try {
            await Promise.all([loadCustomersAndServices(), loadLaunches()]);
            applyFilters();
        } catch (error) {
            showAlert(error.message || 'Erro ao carregar dados de lançamento de serviço.', 'error');
        }
    });
})();
