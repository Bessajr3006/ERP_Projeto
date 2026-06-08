(() => {
    const api = window.api;
    const Auth = window.Auth;
    const UI = window.UI;
    const DateUtils = window.DateUtils;
    const Paginator = window.Paginator;
    let expensesData = [];
    let categoriesData = [];
    let banksData = [];
    let g_editId = null;
    let currentView = (localStorage.getItem('expensesView') || 'list') === 'grid' ? 'grid' : 'list';
    function getInputValue(id) {
        return document.getElementById(id)?.value || '';
    }
    function setInputValue(id, value) {
        const el = document.getElementById(id);
        if (el)
            el.value = value;
    }
    function setCurrencyValue(inputId, numValue) {
        const el = document.getElementById(inputId);
        if (!el)
            return;
        let valStr = parseFloat(numValue || 0).toFixed(2);
        let digitsOnly = valStr.replace(/\D/g, '');
        let formatted = (parseInt(digitsOnly, 10) / 100).toFixed(2) + '';
        formatted = formatted.replace('.', ',');
        formatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        el.value = 'R$ ' + formatted;
    }
    function updateViewToggle() {
        const btnList = document.getElementById('btnListView');
        const btnGrid = document.getElementById('btnGridView');
        const tableSection = document.getElementById('expensesSection');
        const gridSection = document.getElementById('expensesGridSection');
        const tablePagContainer = document.getElementById('expensesPaginationContainer');
        const gridPagContainer = document.getElementById('expensesGridPaginationContainer');
        if (!btnList || !btnGrid || !tableSection || !gridSection)
            return;
        btnList.className =
            'flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1';
        btnGrid.className =
            'flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1';
        btnList.querySelector('.check-icon')?.classList.add('hidden');
        btnGrid.querySelector('.check-icon')?.classList.add('hidden');
        if (currentView === 'list') {
            btnList.className =
                'flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1';
            btnList.querySelector('.check-icon')?.classList.remove('hidden');
            tableSection.style.display = '';
            tableSection.classList.remove('hidden');
            gridSection.style.display = 'none';
            gridSection.classList.add('hidden');
            if (tablePagContainer)
                tablePagContainer.classList.remove('hidden');
            if (gridPagContainer)
                gridPagContainer.classList.add('hidden');
        }
        else {
            btnGrid.className =
                'flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1';
            btnGrid.querySelector('.check-icon')?.classList.remove('hidden');
            tableSection.style.display = 'none';
            tableSection.classList.add('hidden');
            gridSection.style.display = 'flex';
            gridSection.classList.remove('hidden');
            if (tablePagContainer)
                tablePagContainer.classList.add('hidden');
            if (gridPagContainer)
                gridPagContainer.classList.remove('hidden');
        }
    }
    // ── Paginadores ─────────────────────────────────────────────
    let _tablePager = null;
    let _gridPager = null;
    document.addEventListener('DOMContentLoaded', async () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }
        document.title = 'KEYSTONE - Despesas';
        const btnOpenModal = document.getElementById('btnOpenModal');
        if (btnOpenModal)
            btnOpenModal.addEventListener('click', openModal);
        const btnCancelModal = document.getElementById('btnCancelModal');
        if (btnCancelModal)
            btnCancelModal.addEventListener('click', closeModal);
        const expenseForm = document.getElementById('expenseForm');
        if (expenseForm)
            expenseForm.addEventListener('submit', handleSaveExpense);
        const valueEl = document.getElementById('value');
        if (valueEl) {
            valueEl.addEventListener('input', (e) => {
                const target = e.target;
                if (!target)
                    return;
                let value = target.value.replace(/\D/g, '');
                if (value === '')
                    value = '0';
                let formatted = (parseInt(value, 10) / 100).toFixed(2) + '';
                formatted = formatted.replace('.', ',');
                formatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
                target.value = 'R$ ' + formatted;
            });
        }
        const btnListView = document.getElementById('btnListView');
        if (btnListView) {
            btnListView.addEventListener('click', () => {
                currentView = 'list';
                localStorage.setItem('expensesView', 'list');
                updateViewToggle();
            });
        }
        const btnGridView = document.getElementById('btnGridView');
        if (btnGridView) {
            btnGridView.addEventListener('click', () => {
                currentView = 'grid';
                localStorage.setItem('expensesView', 'grid');
                updateViewToggle();
            });
        }
        const toggleFilterBtn = document.getElementById('toggleFilterBtn');
        const filterBody = document.getElementById('filterBody');
        const filterChevron = document.getElementById('filterChevron');
        let filterIsOpen = false;
        if (filterBody && filterChevron) {
            filterBody.style.transition = 'none';
            filterBody.style.maxHeight = filterIsOpen ? `${filterBody.scrollHeight}px` : '0px';
            filterChevron.style.transform = filterIsOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
            requestAnimationFrame(() => {
                filterBody.style.transition = '';
            });
            if (toggleFilterBtn) {
                toggleFilterBtn.addEventListener('click', () => {
                    filterIsOpen = !filterIsOpen;
                    filterBody.style.maxHeight = filterIsOpen ? `${filterBody.scrollHeight}px` : '0px';
                    filterChevron.style.transform = filterIsOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
                });
            }
        }
        const filterSelectors = ['filterStartDate', 'filterEndDate', 'filterPaymentMethod', 'filterStatus', 'filterBank'];
        filterSelectors.forEach((id) => {
            const el = document.getElementById(id);
            if (el)
                el.addEventListener('change', applyFilters);
        });
        updateViewToggle();
        await loadDependencies();
        void fetchExpenses();
    });
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    async function loadDependencies() {
        try {
            const [catsRes, banksRes] = await Promise.all([api('/finance/categories'), api('/bank-accounts')]);
            categoriesData = (catsRes.data || []).filter((c) => c.type === 'expense') || [];
            banksData = banksRes.data || [];
            const catSelect = document.getElementById('category');
            if (catSelect) {
                catSelect.innerHTML = '<option value="">Selecione...</option>';
                categoriesData.forEach((c) => {
                    catSelect.innerHTML += `<option value="${c.public_id}">${c.name}</option>`;
                });
            }
            const bankSelect = document.getElementById('bankSelect');
            const filterBank = document.getElementById('filterBank');
            if (bankSelect)
                bankSelect.innerHTML = '<option value="">Selecione a conta...</option>';
            if (filterBank)
                filterBank.innerHTML = '<option value="">Todas as Contas</option>';
            banksData.forEach((b) => {
                if (bankSelect)
                    bankSelect.innerHTML += `<option value="${b.public_id}">${b.name}</option>`;
                if (filterBank)
                    filterBank.innerHTML += `<option value="${b.public_id}">${b.name}</option>`;
            });
        }
        catch (e) {
            console.error('Falha ao carregar categorias ou bancos', e);
        }
    }
    async function fetchExpenses() {
        try {
            const res = await api('/finance/expenses');
            expensesData = res.data || [];
            applyFilters();
        }
        catch (e) {
            console.error('Falha ao carregar despesas', e);
            UI.showAlert('alertMessage', 'Erro ao listar despesas', 'error');
        }
    }
    function applyFilters() {
        const startDate = getInputValue('filterStartDate');
        const endDate = getInputValue('filterEndDate');
        const paymentMethod = getInputValue('filterPaymentMethod');
        const status = getInputValue('filterStatus');
        const bank = getInputValue('filterBank');
        const filtered = expensesData.filter((expense) => {
            let match = true;
            if (startDate && DateUtils.compareDateOnly(expense.date, startDate) < 0)
                match = false;
            if (endDate && DateUtils.compareDateOnly(expense.date, endDate) > 0)
                match = false;
            if (paymentMethod && expense.payment_method !== paymentMethod)
                match = false;
            if (bank && expense.bank_account_public_id !== bank)
                match = false;
            if (status) {
                const isOverdue = expense.status !== 'paid' && DateUtils.isBeforeToday(expense.date);
                if (status === 'paid' && expense.status !== 'paid')
                    match = false;
                if (status === 'pending' && expense.status === 'paid')
                    match = false;
                if (status === 'pending' && !isOverdue && expense.status !== 'pending')
                    match = false;
            }
            return match;
        });
        if (!_tablePager) {
            _tablePager = new Paginator({
                containerId: 'expensesPaginationContainer',
                pageSize: 20,
                onChange: (pageItems) => {
                    renderTable(pageItems);
                },
            });
        }
        if (!_gridPager) {
            _gridPager = new Paginator({
                containerId: 'expensesGridPaginationContainer',
                pageSize: 20,
                onChange: (pageItems) => {
                    renderGrid('expensesGridContainer', pageItems);
                },
            });
        }
        _tablePager.setData(filtered);
        _gridPager.setData(filtered);
        updateFooter(filtered);
    }
    function updateFooter(data = []) {
        const countEl = document.getElementById('footerCount');
        const totalEl = document.getElementById('footerTotal');
        if (!countEl || !totalEl)
            return;
        const count = data.length;
        const total = data.reduce((sum, expense) => sum + (parseFloat(String(expense.amount)) || 0), 0);
        countEl.textContent = String(count);
        totalEl.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    function renderTable(items = expensesData) {
        const tbody = document.getElementById('expensesTable');
        if (!tbody)
            return;
        if (items.length === 0) {
            tbody.innerHTML = `<tr>
            <td colspan="10" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhuma despesa no momento.</td>
         </tr>`;
            return;
        }
        tbody.innerHTML =
            items
                .map((e) => {
                const isOverdue = e.status !== 'paid' && DateUtils.isBeforeToday(e.date);
                let statusBadge = '';
                if (e.status === 'paid') {
                    statusBadge =
                        '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-green-800 bg-green-100 dark:bg-green-900/40 dark:text-green-300 whitespace-nowrap">Pago</span>';
                }
                else if (isOverdue) {
                    statusBadge =
                        '<span class="badge-overdue inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-red-800 bg-red-100 dark:bg-red-900/40 dark:text-red-300 whitespace-nowrap">Venc.</span>';
                }
                else {
                    statusBadge =
                        '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-yellow-800 bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-300 whitespace-nowrap">Pend.</span>';
                }
                return `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
            <td class="px-3 py-3 whitespace-nowrap">
                <input type="checkbox" class="item-checkbox h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 dark:border-slate-600 rounded cursor-pointer" value="${e.public_id}">
            </td>
            <td class="px-2 py-3 whitespace-nowrap text-xs font-medium text-gray-500 dark:text-gray-400 font-mono hidden sm:table-cell">#${String(e.id).padStart(4, '0')}</td>
            <td class="px-2 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">${e.description}</td>
            <td class="px-3 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">${e.category_name || 'Geral'}</td>
            <td class="px-2 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">${DateUtils.formatDate(e.date)}</td>
            <td class="px-3 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">${e.bank_account_name || '-'}</td>
            <td class="px-2 py-3 whitespace-nowrap text-left text-sm font-medium">${statusBadge}</td>
            <td class="px-3 py-3 whitespace-nowrap text-center text-sm font-medium hidden sm:table-cell">
                <div class="flex items-center justify-center space-x-1 text-gray-500 dark:text-gray-400">
                    ${e.payment_method === 'pix'
                    ? '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11.517 0a.725.725 0 0 0-.517.213L.213 11A.725.725 0 0 0 0 11.517a.725.725 0 0 0 .213.517L11 22.82c.137.138.32.214.517.214s.38-.076.517-.214l10.787-10.787a.725.725 0 0 0 .214-.517.725.725 0 0 0-.214-.517L12.034.213A.725.725 0 0 0 11.517 0zm.012 3.66a2.6 2.6 0 0 1 1.838.761 2.6 2.6 0 0 1 0 3.676 2.6 2.6 0 0 1-3.676 0 2.6 2.6 0 0 1 0-3.676 2.593 2.593 0 0 1 1.838-.761zm7.98 7.844-7.98 7.98-7.98-7.98 7.98-7.98 7.98 7.98z"/></svg> <span class="text-xs">PIX</span>'
                    : e.payment_method === 'credit'
                        ? '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg> <span class="text-xs">Crédito</span>'
                        : e.payment_method === 'debit'
                            ? '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg> <span class="text-xs">Débito</span>'
                            : e.payment_method === 'cash'
                                ? '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> <span class="text-xs">Dinheiro</span>'
                                : e.payment_method === 'transfer'
                                    ? '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg> <span class="text-xs">Transferência</span>'
                                    : e.payment_method === 'boleto'
                                        ? '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v1a3 3 0 106 0v-1M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> <span class="text-xs">Boleto</span>'
                                        : '<span class="text-xs">-</span>'}
                </div>
            </td>
            <td class="px-2 py-3 whitespace-nowrap text-right text-sm font-medium text-red-600 dark:text-red-400">- ${formatCurrency(e.amount)}</td>
            <td class="px-2 py-3 whitespace-nowrap text-center text-sm font-medium">
                <div class="flex items-center justify-center space-x-3">
                    <button type="button" class="edit-btn text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 transition-colors" data-id="${e.public_id}" title="Editar">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button type="button" class="duplicate-btn text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors" data-id="${e.public_id}" title="Duplicar">
                        <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </button>
                    <button type="button" class="delete-btn text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors" data-id="${e.public_id}" title="Excluir">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `;
            })
                .join('');
        const selectAllBtn = document.getElementById('selectAllCheckbox');
        if (selectAllBtn) {
            selectAllBtn.onchange = (e) => {
                const target = e.target;
                const checked = !!target?.checked;
                document.querySelectorAll('#expensesTable .item-checkbox').forEach((cb) => {
                    cb.checked = checked;
                });
            };
        }
        document.querySelectorAll('#expensesTable .item-checkbox').forEach((cb) => {
            cb.addEventListener('change', () => {
                if (!cb.checked && selectAllBtn) {
                    selectAllBtn.checked = false;
                }
            });
        });
    }
    function renderGrid(elementId, items) {
        const grid = document.getElementById(elementId);
        if (!grid)
            return;
        if (items.length === 0) {
            grid.innerHTML =
                '<div class="col-span-full py-8 text-center text-gray-500 font-medium bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">Nenhuma despesa no momento.</div>';
            return;
        }
        grid.innerHTML =
            items
                .map((e) => {
                const isOverdue = e.status !== 'paid' && DateUtils.isBeforeToday(e.date);
                let statusBadge = '';
                if (e.status === 'paid') {
                    statusBadge =
                        '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">Pago</span>';
                }
                else if (isOverdue) {
                    statusBadge =
                        '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">Vencido</span>';
                }
                else {
                    statusBadge =
                        '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">Pendente</span>';
                }
                return `
        <div class="bg-white dark:bg-slate-800 shadow-sm rounded-xl p-5 flex flex-col relative border border-gray-100 dark:border-slate-700 group">
            
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center z-10 pt-1">
                    <input type="checkbox" value="${e.public_id}" class="item-checkbox rounded border-gray-300 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800 dark:border-slate-600">
                    <span class="ml-2 text-xs font-mono font-medium text-gray-500 dark:text-gray-400">#${String(e.id).padStart(4, '0')}</span>
                </div>

                <div class="flex space-x-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10 -mr-1 -mt-1">
                    <button type="button" class="edit-btn p-1.5 text-gray-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-900/30 rounded-lg transition-colors" data-id="${e.public_id}" title="Editar">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button type="button" class="duplicate-btn p-1.5 text-gray-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-900/30 rounded-lg transition-colors" data-id="${e.public_id}" title="Duplicar">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </button>
                    <button type="button" class="delete-btn p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors" data-id="${e.public_id}" title="Excluir">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="flex-1 mt-0">
                <div class="flex justify-between items-start gap-2">
                    <h4 class="text-base font-bold text-gray-900 dark:text-gray-100 wrap-break-word flex-1 leading-tight pr-2">${e.description}</h4>
                </div>
                
                <div class="mt-2 flex flex-col gap-1 items-start">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        ${e.category_name || 'Geral'}
                    </span>
                    <div class="mt-1">${statusBadge}</div>
                </div>

                <div class="mt-4 grid grid-cols-2 gap-4">
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Data:</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100">${DateUtils.formatDate(e.date)}</span>
                    </div>
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Valor:</span>
                        <span class="font-medium text-red-600 dark:text-red-400">- ${formatCurrency(e.amount)}</span>
                    </div>
                     <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300 col-span-2">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Conta:</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100">${e.bank_account_name || '-'}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
            })
                .join('');
    }
    function openModal() {
        g_editId = null;
        document.getElementById('expenseForm')?.reset();
        setCurrencyValue('value', 0);
        setInputValue('dueDate', DateUtils.getTodayDateInputValue());
        const statusEl = document.getElementById('status');
        if (statusEl)
            statusEl.value = 'pending';
        const modalTitle = document.getElementById('modalTitle');
        if (modalTitle)
            modalTitle.textContent = 'Nova Despesa';
        document.getElementById('expenseModal')?.classList.remove('hidden');
    }
    function duplicateExpense(id) {
        const exp = expensesData.find((e) => e.public_id === id);
        if (!exp)
            return;
        document.getElementById('expenseForm')?.reset();
        setInputValue('description', exp.description + ' (Cópia)');
        setCurrencyValue('value', exp.amount);
        setInputValue('dueDate', DateUtils.toDateInputValue(exp.date));
        setInputValue('category', String(exp.category_public_id || ''));
        setInputValue('bankSelect', String(exp.bank_account_public_id || ''));
        const paymentEl = document.getElementById('paymentMethod');
        if (paymentEl)
            paymentEl.value = exp.payment_method || '';
        const statusEl = document.getElementById('status');
        if (statusEl)
            statusEl.value = exp.status || 'paid';
        const modalTitle = document.getElementById('modalTitle');
        if (modalTitle)
            modalTitle.textContent = 'Duplicar Despesa';
        document.getElementById('expenseModal')?.classList.remove('hidden');
    }
    function editExpense(id) {
        const exp = expensesData.find((e) => e.public_id === id);
        if (!exp)
            return;
        g_editId = id;
        document.getElementById('expenseForm')?.reset();
        setInputValue('description', exp.description);
        setCurrencyValue('value', exp.amount);
        setInputValue('dueDate', DateUtils.toDateInputValue(exp.date));
        setInputValue('category', String(exp.category_public_id || ''));
        setInputValue('bankSelect', String(exp.bank_account_public_id || ''));
        const paymentEl = document.getElementById('paymentMethod');
        if (paymentEl)
            paymentEl.value = exp.payment_method || '';
        const statusEl = document.getElementById('status');
        if (statusEl)
            statusEl.value = exp.status || 'paid';
        const modalTitle = document.getElementById('modalTitle');
        if (modalTitle)
            modalTitle.textContent = 'Editar Despesa';
        document.getElementById('expenseModal')?.classList.remove('hidden');
    }
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (!target)
            return;
        const duplicateBtn = target.closest('.duplicate-btn');
        if (duplicateBtn) {
            const id = duplicateBtn.getAttribute('data-id');
            if (id)
                window.duplicateExpense(id);
        }
        const editBtn = target.closest('.edit-btn');
        if (editBtn) {
            const id = editBtn.getAttribute('data-id');
            if (id)
                window.editExpense(id);
        }
        const deleteBtn = target.closest('.delete-btn');
        if (deleteBtn) {
            const id = deleteBtn.getAttribute('data-id');
            if (id)
                window.confirmDeleteExpense(id);
        }
    });
    function closeModal() {
        g_editId = null;
        document.getElementById('expenseModal')?.classList.add('hidden');
    }
    async function handleSaveExpense(e) {
        e.preventDefault();
        const rawValue = getInputValue('value');
        const amountVal = parseFloat(rawValue.replace(/[^\d]/g, '')) / 100;
        if (!amountVal || amountVal <= 0) {
            UI.showAlert('alertMessage', 'Informe um valor maior que zero.', 'error');
            return;
        }
        const data = {
            description: getInputValue('description'),
            amount: amountVal,
            date: getInputValue('dueDate'),
            category_public_id: getInputValue('category'),
            bank_account_public_id: getInputValue('bankSelect'),
        };
        const paymentMethod = getInputValue('paymentMethod');
        if (paymentMethod)
            data.payment_method = paymentMethod;
        const status = getInputValue('status');
        if (status)
            data.status = status;
        const btn = document.getElementById('saveBtn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Processando...';
        }
        try {
            if (g_editId) {
                await api(`/finance/expenses/${g_editId}`, {
                    method: 'PUT',
                    body: JSON.stringify(data),
                });
                UI.showAlert('alertMessage', 'Despesa atualizada com sucesso!', 'success');
            }
            else {
                await api('/finance/expenses', {
                    method: 'POST',
                    body: JSON.stringify(data),
                });
                UI.showAlert('alertMessage', 'Despesa registrada com sucesso!', 'success');
            }
            closeModal();
            await fetchExpenses();
            await loadDependencies(); // atualiza saldos
        }
        catch (err) {
            alert(err?.message || 'Erro ao salvar despesa');
        }
        finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Salvar';
            }
        }
    }
    // Global scope required for html onclick handlers
    let g_deleteId = null;
    function confirmDeleteExpense(id) {
        g_deleteId = id;
        document.getElementById('deleteModal')?.classList.remove('hidden');
    }
    function closeDeleteModal() {
        g_deleteId = null;
        document.getElementById('deleteModal')?.classList.add('hidden');
    }
    window.duplicateExpense = duplicateExpense;
    window.editExpense = editExpense;
    window.confirmDeleteExpense = confirmDeleteExpense;
    window.closeDeleteModal = closeDeleteModal;
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
        if (!g_deleteId)
            return;
        const btn = document.getElementById('confirmDeleteBtn');
        const originalText = btn?.textContent || '';
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Excluindo...';
        }
        try {
            await api(`/finance/transactions/${g_deleteId}`, {
                method: 'DELETE',
            });
            UI.showAlert('alertMessage', 'Despesa excluída com sucesso!', 'success');
            closeDeleteModal();
            await fetchExpenses();
            await loadDependencies(); // Atualiza contador de bancos no topo
        }
        catch (err) {
            alert(err?.message || 'Erro ao excluir despesa');
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }
    });
    document.getElementById('btnCancelDeleteModal')?.addEventListener('click', closeDeleteModal);
    document.getElementById('closeDeleteModalBackdrop')?.addEventListener('click', closeDeleteModal);
})();
