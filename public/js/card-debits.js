(function initCardDebitsPage() {
    let cardDebitsManager;
    let categoriesData = [];
    const getById = (id) => document.getElementById(id);
    const qs = (selector) => document.querySelector(selector);
    const qsa = (selector) => document.querySelectorAll(selector);
    const api = window.api;
    const Auth = window.Auth;
    const UI = window.UI;
    const DateUtils = window.DateUtils;
    const CrudManager = window.CrudManager;
    const formatCurrency = (val) => {
        const num = parseFloat(val || 0);
        let valStr = num.toFixed(2);
        let digitsOnly = valStr.replace(/\D/g, '');
        let formatted = (parseInt(digitsOnly, 10) / 100).toFixed(2) + '';
        formatted = formatted.replace('.', ',');
        formatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        return 'R$ ' + formatted;
    };
    document.addEventListener('DOMContentLoaded', () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }
        // Set default filter period to empty (show all)
        const filterPeriodInput = getById('filterPeriod');
        if (filterPeriodInput) {
            filterPeriodInput.value = '';
        }
        cardDebitsManager = new CrudManager({
            entityName: 'CardDebit',
            endpoint: '/card-debits',
            tableId: 'cardDebitsTable',
            tableSectionId: 'listSection',
            modalId: 'expenseModal',
            filterConfig: {
                footerId: 'resultsFooter'
            },
            footerLabel: 'pagamento(s) exibido(s)',
            applyFilters: (data) => {
                const search = (getById('filterSearch')?.value || '').trim().toLowerCase();
                const period = getById('filterPeriod')?.value || '';
                return data.filter((item) => {
                    const matchesSearch = !search || item.description.toLowerCase().includes(search);
                    const matchesPeriod = !period || item.period === period;
                    return matchesSearch && matchesPeriod;
                });
            },
            renderTable: (items) => {
                const tbody = getById('cardDebitsTable');
                if (items.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="13" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum pagamento de cartão encontrado.</td></tr>`;
                    return;
                }
                tbody.innerHTML = items.map((c) => {
                    // Format Date YYYY-MM-DD to DD/MM/YYYY
                    const formattedDate = c.date ? DateUtils.formatDate(c.date) : '-';
                    const formattedDueDate = c.due_date ? DateUtils.formatDate(c.due_date) : '-';
                    // Format period YYYY-MM to MM/YYYY
                    let formattedPeriod = c.period || '';
                    if (formattedPeriod.includes('-')) {
                        const [y, m] = formattedPeriod.split('-');
                        formattedPeriod = `${m}/${y}`;
                    }
                    const formattedValue = c.value ? Number(c.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
                    return `
                    <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td class="px-6 py-4 whitespace-nowrap">
                            <input type="checkbox" class="item-checkbox h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 dark:border-slate-600 rounded cursor-pointer" value="${c.public_id}" title="Selecionar pagamento" aria-label="Selecionar pagamento" data-bwignore="true" data-lpignore="true">
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${formattedDate}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">${c.description}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${c.card_name || '-'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${c.card_number || '-'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${formattedDueDate}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${c.card_expense_description || '-'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${c.category_name || '-'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${formattedPeriod}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${c.tempo || '-'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-semibold">${formattedValue}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs" title="${c.observation || ''}">${c.observation || '-'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                            <button type="button" title="Editar" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-3 edit-btn" data-item='${JSON.stringify(c).replace(/'/g, "&#39;")}'>
                                <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </button>
                            <button type="button" title="Excluir" class="text-red-600 hover:text-red-900 dark:hover:text-red-400 delete-btn" data-id="${c.public_id}">
                                <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </td>
                    </tr>`;
                }).join('');
            },
            onEdit: (expense) => {
                const title = getById('modalTitle');
                const form = getById('expenseForm');
                form.reset();
                if (expense) {
                    title.textContent = 'Editar Pagamento de Cartão';
                    getById('expenseId').value = expense.public_id;
                    getById('expenseDate').value = expense.date ? DateUtils.toDateInputValue(expense.date) : '';
                    getById('expenseDescription').value = expense.description || '';
                    getById('expensePeriod').value = expense.period || '';
                    getById('expenseCardName').value = expense.card_name || '';
                    getById('expenseCardNumber').value = expense.card_number || '';
                    getById('expenseDueDate').value = expense.due_date ? DateUtils.toDateInputValue(expense.due_date) : '';
                    getById('expenseCardExpense').value = expense.card_expense_public_id || '';
                    getById('expenseTempo').value = expense.tempo || '';
                    getById('expenseCategory').value = expense.category_public_id || '';
                    getById('expenseValue').value = expense.value ? formatCurrency(expense.value) : '';
                    getById('expenseObservation').value = expense.observation || '';
                    form.dataset.id = expense.public_id;
                }
                else {
                    title.textContent = 'Cadastrar Pagamento de Cartão';
                    getById('expenseId').value = '';
                    // Default date to today
                    getById('expenseDate').value = DateUtils.toDateInputValue(new Date());
                    // Default period to current month
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    getById('expensePeriod').value = `${year}-${month}`;
                    getById('expenseCardName').value = '';
                    getById('expenseCardNumber').value = '';
                    getById('expenseDueDate').value = '';
                    getById('expenseCardExpense').value = '';
                    getById('expenseTempo').value = '';
                    getById('expenseCategory').value = '';
                    delete form.dataset.id;
                }
                getById('expenseModal').classList.remove('hidden');
            }
        });
        // Add filter change listeners
        getById('filterSearch')?.addEventListener('input', () => cardDebitsManager.applyFilters());
        getById('filterPeriod')?.addEventListener('change', () => cardDebitsManager.applyFilters());
        getById('btnClearFilters')?.addEventListener('click', () => {
            const filterSearch = getById('filterSearch');
            const filterPeriod = getById('filterPeriod');
            if (filterSearch)
                filterSearch.value = '';
            if (filterPeriod) {
                filterPeriod.value = '';
            }
            cardDebitsManager.applyFilters();
        });
        const expenseValue = getById('expenseValue');
        if (expenseValue) {
            expenseValue.addEventListener('input', (e) => {
                const target = e.target;
                let value = target.value.replace(/\D/g, '');
                if (value === '')
                    value = '0';
                let formatted = (parseInt(value, 10) / 100).toFixed(2) + '';
                formatted = formatted.replace('.', ',');
                formatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
                target.value = 'R$ ' + formatted;
            });
        }
        async function loadCategories() {
            try {
                const res = await api('/finance/categories');
                categoriesData = (res?.data || []).filter((c) => c.type === 'expense');
                const select = getById('expenseCategory');
                if (select) {
                    select.innerHTML = '<option value="">Selecione...</option>' +
                        categoriesData.map(c => `<option value="${c.public_id}">${c.name}</option>`).join('');
                }
            }
            catch (err) {
                console.error('[loadCategories] Error loading finance categories:', err);
            }
        }
        async function loadCardExpenses() {
            try {
                const res = await api('/card-expenses');
                const expenses = res?.data || [];
                const select = getById('expenseCardExpense');
                if (select) {
                    select.innerHTML = '<option value="">Nenhuma...</option>' +
                        expenses.map((e) => {
                            const datePart = e.date ? DateUtils.formatDate(e.date) : '';
                            const valPart = e.value ? Number(e.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
                            return `<option value="${e.public_id}">${e.description} (${datePart} - ${valPart})</option>`;
                        }).join('');
                }
            }
            catch (err) {
                console.error('[loadCardExpenses] Error loading card expenses:', err);
            }
        }
        void Promise.all([loadCategories(), loadCardExpenses()]).then(() => {
            cardDebitsManager.init();
        });
    });
    // Form logic submission
    getById('expenseForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = getById('saveBtn');
        const form = getById('expenseForm');
        const id = getById('expenseId').value;
        const rawValue = getById('expenseValue').value;
        const parsedValue = parseFloat(rawValue.replace(/[^\d]/g, '')) / 100;
        const payload = {
            date: getById('expenseDate').value,
            description: getById('expenseDescription').value,
            period: getById('expensePeriod').value,
            card_name: getById('expenseCardName').value || null,
            card_number: getById('expenseCardNumber').value || null,
            due_date: getById('expenseDueDate').value || null,
            card_expense_public_id: getById('expenseCardExpense').value || null,
            tempo: getById('expenseTempo').value || null,
            category_public_id: getById('expenseCategory').value || null,
            value: parsedValue,
            observation: getById('expenseObservation').value || null
        };
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';
        try {
            if (id) {
                await api(`/card-debits/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                UI.showAlert('alertMessage', 'Pagamento de cartão atualizado com sucesso!', 'success');
            }
            else {
                await api('/card-debits', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                UI.showAlert('alertMessage', 'Pagamento de cartão salvo com sucesso!', 'success');
            }
            cardDebitsManager.closeModal();
            cardDebitsManager.loadData();
        }
        catch (error) {
            alert(error.message || 'Erro ao gravar dados.');
        }
        finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Gravar';
        }
    });
})();
