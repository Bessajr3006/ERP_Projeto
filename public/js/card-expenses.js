(function initCardExpensesPage() {
    let cardExpensesManager;
    let categoriesData = [];
    let cardDebitsData = [];
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
        cardExpensesManager = new CrudManager({
            entityName: 'CardExpense',
            endpoint: '/card-expenses',
            tableId: 'cardExpensesTable',
            tableSectionId: 'listSection',
            modalId: 'expenseModal',
            filterConfig: {
                footerId: 'resultsFooter'
            },
            footerLabel: 'despesa(s) exibida(s)',
            applyFilters: (data) => {
                const search = (getById('filterSearch')?.value || '').trim().toLowerCase();
                const period = getById('filterPeriod')?.value || '';
                const cardDebitPublicId = getById('filterCardDebit')?.value || '';
                return data.filter((item) => {
                    const matchesSearch = !search || item.description.toLowerCase().includes(search);
                    const matchesPeriod = !period || item.period === period;
                    const matchesCardDebit = !cardDebitPublicId || item.card_debit_public_id === cardDebitPublicId;
                    return matchesSearch && matchesPeriod && matchesCardDebit;
                });
            },
            renderTable: (items) => {
                const selectAllCheckbox = getById('selectAll');
                if (selectAllCheckbox)
                    selectAllCheckbox.checked = false;
                const btnBulkDelete = getById('btnBulkDelete');
                if (btnBulkDelete) {
                    btnBulkDelete.disabled = true;
                    const bulkDeleteCountSpan = getById('bulkDeleteCount');
                    if (bulkDeleteCountSpan)
                        bulkDeleteCountSpan.textContent = '0';
                }
                // Calculate totals
                let sumInstallments = 0;
                let sumParcelasTempo = 0;
                let sumSemTempo = 0;
                let sumTimeValue = 0;
                items.forEach((c) => {
                    const val = Number(c.value) || 0;
                    sumInstallments += val;
                    let hasTempo = false;
                    let installments = 1;
                    if (c.tempo && typeof c.tempo === 'string') {
                        const match = c.tempo.match(/(\d+)\/(\d+)/);
                        if (match && match[2]) {
                            installments = parseInt(match[2], 10) || 1;
                            hasTempo = true;
                        }
                    }
                    if (hasTempo) {
                        sumParcelasTempo += val;
                    }
                    else {
                        sumSemTempo += val;
                    }
                    sumTimeValue += val * installments;
                });
                const totalInstallmentsSumEl = getById('totalInstallmentsSum');
                const totalParcelasTempoEl = getById('totalParcelasTempo');
                const totalSemTempoEl = getById('totalSemTempo');
                const totalTimeValueSumEl = getById('totalTimeValueSum');
                if (totalInstallmentsSumEl) {
                    totalInstallmentsSumEl.textContent = sumInstallments.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                }
                if (totalParcelasTempoEl) {
                    totalParcelasTempoEl.textContent = sumParcelasTempo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                }
                if (totalSemTempoEl) {
                    totalSemTempoEl.textContent = sumSemTempo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                }
                if (totalTimeValueSumEl) {
                    totalTimeValueSumEl.textContent = sumTimeValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                }
                const tbody = getById('cardExpensesTable');
                if (items.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="10" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhuma despesa de cartão encontrada.</td></tr>`;
                    return;
                }
                tbody.innerHTML = items.map((c) => {
                    // Format Date YYYY-MM-DD to DD/MM/YYYY
                    const formattedDate = c.date ? DateUtils.formatDate(c.date) : '-';
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
                            <input type="checkbox" class="item-checkbox h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 dark:border-slate-600 rounded cursor-pointer" value="${c.public_id}" title="Selecionar despesa" aria-label="Selecionar despesa" data-bwignore="true" data-lpignore="true">
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${formattedDate}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">${c.description}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${c.card_debit_description || '-'}</td>
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
                    title.textContent = 'Editar Despesa de Cartão';
                    getById('expenseId').value = expense.public_id;
                    getById('expenseDate').value = expense.date ? DateUtils.toDateInputValue(expense.date) : '';
                    getById('expenseDescription').value = expense.description || '';
                    getById('expensePeriod').value = expense.period || '';
                    getById('expenseTempo').value = expense.tempo || '';
                    getById('expenseCategory').value = expense.category_public_id || '';
                    getById('expenseCardDebit').value = expense.card_debit_public_id || '';
                    getById('expenseValue').value = expense.value ? formatCurrency(expense.value) : '';
                    getById('expenseObservation').value = expense.observation || '';
                    form.dataset.id = expense.public_id;
                }
                else {
                    title.textContent = 'Cadastrar Despesa de Cartão';
                    getById('expenseId').value = '';
                    // Default date to today
                    getById('expenseDate').value = DateUtils.toDateInputValue(new Date());
                    // Default period to current month
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    getById('expensePeriod').value = `${year}-${month}`;
                    getById('expenseTempo').value = '';
                    getById('expenseCategory').value = '';
                    getById('expenseCardDebit').value = '';
                    delete form.dataset.id;
                }
                getById('expenseModal').classList.remove('hidden');
            }
        });
        // Add filter change listeners
        getById('filterSearch')?.addEventListener('input', () => cardExpensesManager.applyFilters());
        getById('filterPeriod')?.addEventListener('change', () => cardExpensesManager.applyFilters());
        getById('filterCardDebit')?.addEventListener('change', () => cardExpensesManager.applyFilters());
        getById('btnClearFilters')?.addEventListener('click', () => {
            const filterSearch = getById('filterSearch');
            const filterPeriod = getById('filterPeriod');
            const filterCardDebit = getById('filterCardDebit');
            if (filterSearch)
                filterSearch.value = '';
            if (filterPeriod)
                filterPeriod.value = '';
            if (filterCardDebit)
                filterCardDebit.value = '';
            cardExpensesManager.applyFilters();
        });
        // PDF Import triggers
        const btnImportPdf = getById('btnImportPdf');
        const btnImportPdfFile = getById('btnImportPdfFile');
        const importPreviewModal = getById('importPreviewModal');
        const importPreviewTableBody = getById('importPreviewTableBody');
        const btnCancelImport = getById('btnCancelImport');
        const btnConfirmImport = getById('btnConfirmImport');
        const selectAllImport = getById('selectAllImport');
        const importDefaultPeriod = getById('importDefaultPeriod');
        const updateImportTotals = () => {
            const rows = qsa('.import-row');
            let total = 0;
            let count = 0;
            let totalWithTempo = 0;
            let countWithTempo = 0;
            let totalWithoutTempo = 0;
            let countWithoutTempo = 0;
            rows.forEach((row) => {
                const checkbox = row.querySelector('.import-item-checkbox');
                if (checkbox && checkbox.checked) {
                    const valInput = row.querySelector('input[name="value"]');
                    const tempoInput = row.querySelector('input[name="tempo"]');
                    let val = 0;
                    if (valInput) {
                        const rawVal = valInput.value;
                        val = parseFloat(rawVal.replace(/[^\d]/g, '')) / 100;
                        if (!isNaN(val) && val > 0) {
                            total += val;
                        }
                    }
                    const hasTempo = tempoInput && tempoInput.value.trim() !== '';
                    if (hasTempo) {
                        totalWithTempo += val;
                        countWithTempo++;
                    }
                    else {
                        totalWithoutTempo += val;
                        countWithoutTempo++;
                    }
                    count++;
                }
            });
            const importTotalValue = getById('importTotalValue');
            const importCheckedCount = getById('importCheckedCount');
            const importTotalWithTempo = getById('importTotalWithTempo');
            const importCheckedWithTempo = getById('importCheckedWithTempo');
            const importTotalWithoutTempo = getById('importTotalWithoutTempo');
            const importCheckedWithoutTempo = getById('importCheckedWithoutTempo');
            if (importTotalValue) {
                importTotalValue.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            }
            if (importCheckedCount) {
                importCheckedCount.textContent = String(count);
            }
            if (importTotalWithTempo) {
                importTotalWithTempo.textContent = totalWithTempo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            }
            if (importCheckedWithTempo) {
                importCheckedWithTempo.textContent = String(countWithTempo);
            }
            if (importTotalWithoutTempo) {
                importTotalWithoutTempo.textContent = totalWithoutTempo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            }
            if (importCheckedWithoutTempo) {
                importCheckedWithoutTempo.textContent = String(countWithoutTempo);
            }
        };
        const importPdfDropdownMenu = getById('importPdfDropdownMenu');
        const btnImportBradesco = getById('btnImportBradesco');
        if (btnImportPdf && importPdfDropdownMenu) {
            btnImportPdf.addEventListener('click', (e) => {
                e.stopPropagation();
                importPdfDropdownMenu.classList.toggle('hidden');
                // Rotate the arrow icon
                const arrow = btnImportPdf.querySelector('svg:last-child');
                if (arrow) {
                    if (importPdfDropdownMenu.classList.contains('hidden')) {
                        arrow.classList.remove('rotate-180');
                    }
                    else {
                        arrow.classList.add('rotate-180');
                    }
                }
            });
            // Close on click outside
            document.addEventListener('click', () => {
                importPdfDropdownMenu.classList.add('hidden');
                const arrow = btnImportPdf.querySelector('svg:last-child');
                if (arrow)
                    arrow.classList.remove('rotate-180');
            });
        }
        if (btnImportBradesco && btnImportPdfFile) {
            btnImportBradesco.addEventListener('click', () => {
                btnImportPdfFile.click();
            });
        }
        if (btnImportPdfFile) {
            btnImportPdfFile.addEventListener('change', async (e) => {
                const target = e.target;
                const file = target.files?.[0];
                if (!file)
                    return;
                if (file.type !== 'application/pdf') {
                    alert('Por favor, selecione um arquivo PDF válido.');
                    target.value = '';
                    return;
                }
                const originalBtnText = btnImportPdf.innerHTML;
                btnImportPdf.disabled = true;
                btnImportPdf.textContent = 'Processando...';
                try {
                    const reader = new FileReader();
                    reader.onload = async (evt) => {
                        const result = String(evt.target?.result || '');
                        try {
                            const response = await api('/card-expenses/parse-pdf', {
                                method: 'POST',
                                body: JSON.stringify({ pdf_base64: result })
                            });
                            const data = response.data || { period: '', transactions: [] };
                            // Popula o período
                            if (importDefaultPeriod && data.period) {
                                importDefaultPeriod.value = data.period;
                            }
                            // Auto-select matching card debit by period
                            const importCardDebit = getById('importCardDebit');
                            if (importCardDebit && data.period) {
                                const matchingDebit = cardDebitsData.find(d => d.period === data.period);
                                if (matchingDebit) {
                                    importCardDebit.value = matchingDebit.public_id;
                                }
                                else {
                                    importCardDebit.value = '';
                                }
                            }
                            // Popula a tabela
                            if (importPreviewTableBody) {
                                if (data.transactions.length === 0) {
                                    importPreviewTableBody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum lançamento detectado no extrato PDF.</td></tr>`;
                                }
                                else {
                                    importPreviewTableBody.innerHTML = data.transactions.map((tx, idx) => `
                                        <tr class="import-row hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td class="px-4 py-2.5">
                                                <input type="checkbox" checked class="import-item-checkbox h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 dark:border-slate-600 rounded cursor-pointer" data-bwignore="true" data-lpignore="true">
                                            </td>
                                            <td class="px-4 py-2.5">
                                                <input type="date" name="date" value="${tx.date}" required
                                                    class="block w-full bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-md py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500">
                                            </td>
                                            <td class="px-4 py-2.5">
                                                <input type="text" name="description" value="${tx.description.replace(/'/g, "&#39;")}" required
                                                    class="block w-full bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-md py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500">
                                            </td>
                                            <td class="px-4 py-2.5">
                                                <select name="category_public_id"
                                                    class="block w-full bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-md py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500">
                                                    <option value="">Selecione...</option>
                                                    ${categoriesData.map((c) => `<option value="${c.public_id}">${c.name}</option>`).join('')}
                                                </select>
                                            </td>
                                            <td class="px-4 py-2.5">
                                                <input type="text" name="tempo" value="${tx.tempo || ''}" placeholder="Ex: 01/12"
                                                    class="block w-full bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-md py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500">
                                            </td>
                                            <td class="px-4 py-2.5">
                                                <input type="text" name="value" value="${formatCurrency(tx.value)}" required
                                                    class="block w-full bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-md py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 text-right">
                                            </td>
                                            <td class="px-4 py-2.5">
                                                <input type="text" name="observation" placeholder="Opcional"
                                                    class="block w-full bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-md py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500">
                                            </td>
                                        </tr>
                                    `).join('');
                                }
                                updateImportTotals();
                            }
                            // Mostra o modal
                            if (importPreviewModal) {
                                importPreviewModal.classList.remove('hidden');
                            }
                        }
                        catch (error) {
                            alert(error.message || 'Erro ao processar arquivo.');
                        }
                        finally {
                            btnImportPdf.disabled = false;
                            btnImportPdf.innerHTML = originalBtnText;
                            target.value = '';
                        }
                    };
                    reader.readAsDataURL(file);
                }
                catch (error) {
                    alert('Falha ao ler arquivo.');
                    btnImportPdf.disabled = false;
                    btnImportPdf.innerHTML = originalBtnText;
                    target.value = '';
                }
            });
        }
        // Modal Action: Toggle select all
        if (selectAllImport) {
            selectAllImport.addEventListener('change', (e) => {
                const checked = e.target.checked;
                qsa('.import-item-checkbox').forEach((cb) => {
                    cb.checked = checked;
                });
                updateImportTotals();
            });
        }
        // Delegate updates from preview table inputs/checkboxes
        if (importPreviewTableBody) {
            importPreviewTableBody.addEventListener('change', (e) => {
                const target = e.target;
                if (target.classList.contains('import-item-checkbox')) {
                    updateImportTotals();
                }
            });
            importPreviewTableBody.addEventListener('input', (e) => {
                const target = e.target;
                if (target.name === 'value') {
                    let value = target.value.replace(/\D/g, '');
                    if (value === '')
                        value = '0';
                    let formatted = (parseInt(value, 10) / 100).toFixed(2) + '';
                    formatted = formatted.replace('.', ',');
                    formatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
                    target.value = 'R$ ' + formatted;
                    updateImportTotals();
                }
                else if (target.name === 'tempo') {
                    updateImportTotals();
                }
            });
        }
        // Modal Action: Cancel
        if (btnCancelImport && importPreviewModal) {
            btnCancelImport.addEventListener('click', () => {
                importPreviewModal.classList.add('hidden');
            });
        }
        // Modal Action: Confirm Import
        if (btnConfirmImport && importPreviewModal) {
            btnConfirmImport.addEventListener('click', async () => {
                const rows = qsa('.import-row');
                const transactionsToImport = [];
                const defaultPeriod = importDefaultPeriod?.value || '';
                const cardDebitPublicId = getById('importCardDebit')?.value || null;
                if (!cardDebitPublicId) {
                    alert('Por favor, selecione o Pagamento de Cartão (Fatura) para realizar a importação.');
                    return;
                }
                rows.forEach((row) => {
                    const checkbox = row.querySelector('.import-item-checkbox');
                    if (checkbox && checkbox.checked) {
                        const dateInput = row.querySelector('input[name="date"]');
                        const descInput = row.querySelector('input[name="description"]');
                        const valInput = row.querySelector('input[name="value"]');
                        const obsInput = row.querySelector('input[name="observation"]');
                        const tempoInput = row.querySelector('input[name="tempo"]');
                        const catSelect = row.querySelector('select[name="category_public_id"]');
                        if (dateInput && descInput && valInput) {
                            const date = dateInput.value;
                            const description = descInput.value.trim();
                            const tempo = tempoInput?.value.trim() || null;
                            const category_public_id = catSelect?.value || null;
                            const rawVal = valInput.value;
                            const value = parseFloat(rawVal.replace(/[^\d]/g, '')) / 100;
                            const observation = obsInput?.value.trim() || null;
                            // Period extracted from date (YYYY-MM)
                            const period = date ? date.substring(0, 7) : defaultPeriod;
                            if (date && description && !isNaN(value) && value > 0 && period) {
                                transactionsToImport.push({
                                    date,
                                    description,
                                    value,
                                    period,
                                    tempo,
                                    category_public_id,
                                    card_debit_public_id: cardDebitPublicId,
                                    observation
                                });
                            }
                        }
                    }
                });
                if (transactionsToImport.length === 0) {
                    alert('Nenhum lançamento válido selecionado para importação.');
                    return;
                }
                btnConfirmImport.disabled = true;
                btnConfirmImport.textContent = 'Importando...';
                try {
                    await api('/card-expenses/bulk', {
                        method: 'POST',
                        body: JSON.stringify({ transactions: transactionsToImport })
                    });
                    const filterPeriod = getById('filterPeriod');
                    if (filterPeriod) {
                        filterPeriod.value = '';
                    }
                    UI.showAlert('alertMessage', `${transactionsToImport.length} despesas importadas com sucesso!`, 'success');
                    importPreviewModal.classList.add('hidden');
                    cardExpensesManager.loadData();
                }
                catch (error) {
                    alert(error.message || 'Erro ao importar despesas.');
                }
                finally {
                    btnConfirmImport.disabled = false;
                    btnConfirmImport.textContent = 'Confirmar Importação';
                }
            });
        }
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
        async function loadCardDebits() {
            try {
                const res = await api('/card-debits');
                cardDebitsData = res?.data || [];
                // Form dropdown option HTML
                const optionsHtml = '<option value="">Selecione o Cartão/Fatura...</option>' +
                    cardDebitsData.map(c => {
                        let formattedPeriod = c.period || '';
                        if (formattedPeriod.includes('-')) {
                            const [y, m] = formattedPeriod.split('-');
                            formattedPeriod = `${m}/${y}`;
                        }
                        const cardText = `${c.description} - ${c.card_name || 'Sem nome'} (Final ${c.card_number || 'xxxx'}) - Período ${formattedPeriod}`;
                        return `<option value="${c.public_id}">${cardText}</option>`;
                    }).join('');
                const selectEl = getById('expenseCardDebit');
                if (selectEl) {
                    selectEl.innerHTML = optionsHtml;
                }
                const importSelectEl = getById('importCardDebit');
                if (importSelectEl) {
                    importSelectEl.innerHTML = '<option value="">Selecione o Cartão...</option>' +
                        cardDebitsData.map(c => {
                            let formattedPeriod = c.period || '';
                            if (formattedPeriod.includes('-')) {
                                const [y, m] = formattedPeriod.split('-');
                                formattedPeriod = `${m}/${y}`;
                            }
                            const cardText = `${c.description} - ${c.card_name || 'Sem nome'} (Final ${c.card_number || 'xxxx'}) - Período ${formattedPeriod}`;
                            return `<option value="${c.public_id}">${cardText}</option>`;
                        }).join('');
                }
                const filterSelectEl = getById('filterCardDebit');
                if (filterSelectEl) {
                    filterSelectEl.innerHTML = '<option value="">Todos os Cartões...</option>' +
                        cardDebitsData.map(c => {
                            let formattedPeriod = c.period || '';
                            if (formattedPeriod.includes('-')) {
                                const [y, m] = formattedPeriod.split('-');
                                formattedPeriod = `${m}/${y}`;
                            }
                            const cardText = `${c.description} - ${c.card_name || 'Sem nome'} (Final ${c.card_number || 'xxxx'}) - Período ${formattedPeriod}`;
                            return `<option value="${c.public_id}">${cardText}</option>`;
                        }).join('');
                }
            }
            catch (err) {
                console.error('[loadCardDebits] Error loading card debits:', err);
            }
        }
        // Event delegation for all checkbox change events (including selectAll and item-checkbox)
        document.addEventListener('change', (e) => {
            const target = e.target;
            if (!target)
                return;
            // Handle Select All checkbox change
            if (target.id === 'selectAll') {
                const selectAllCheckbox = target;
                const isChecked = selectAllCheckbox.checked;
                qsa('.item-checkbox').forEach((cb) => {
                    cb.checked = isChecked;
                    const tr = cb.closest('tr');
                    if (tr) {
                        if (isChecked) {
                            tr.classList.add('bg-brand-500/10', 'dark:bg-brand-500/25');
                        }
                        else {
                            tr.classList.remove('bg-brand-500/10', 'dark:bg-brand-500/25');
                        }
                    }
                });
                updateBulkDeleteState();
            }
            // Handle individual item-checkbox change
            if (target.classList.contains('item-checkbox')) {
                const itemCheckbox = target;
                const tr = itemCheckbox.closest('tr');
                if (tr) {
                    if (itemCheckbox.checked) {
                        tr.classList.add('bg-brand-500/10', 'dark:bg-brand-500/25');
                    }
                    else {
                        tr.classList.remove('bg-brand-500/10', 'dark:bg-brand-500/25');
                    }
                }
                const selectAllCheckbox = getById('selectAll');
                if (selectAllCheckbox && !itemCheckbox.checked) {
                    selectAllCheckbox.checked = false;
                }
                else if (selectAllCheckbox) {
                    const totalCheckboxes = qsa('.item-checkbox').length;
                    const checkedCheckboxes = Array.from(qsa('.item-checkbox')).filter((cb) => cb.checked).length;
                    selectAllCheckbox.checked = (totalCheckboxes === checkedCheckboxes && totalCheckboxes > 0);
                }
                updateBulkDeleteState();
            }
        });
        function updateBulkDeleteState() {
            const checkboxes = Array.from(qsa('.item-checkbox'));
            const checkedCount = checkboxes.filter(cb => cb.checked).length;
            const btnBulkDelete = getById('btnBulkDelete');
            const bulkDeleteCountSpan = getById('bulkDeleteCount');
            if (btnBulkDelete) {
                btnBulkDelete.disabled = checkedCount === 0;
                if (bulkDeleteCountSpan) {
                    bulkDeleteCountSpan.textContent = String(checkedCount);
                }
            }
        }
        function hideBulkDeleteButton() {
            const btnBulkDelete = getById('btnBulkDelete');
            if (btnBulkDelete) {
                btnBulkDelete.disabled = true;
                const bulkDeleteCountSpan = getById('bulkDeleteCount');
                if (bulkDeleteCountSpan)
                    bulkDeleteCountSpan.textContent = '0';
            }
            const selectAllCheckbox = getById('selectAll');
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = false;
            }
        }
        // Add bulk delete button click handler
        const btnBulkDelete = getById('btnBulkDelete');
        if (btnBulkDelete) {
            btnBulkDelete.addEventListener('click', async () => {
                const checkboxes = Array.from(qsa('.item-checkbox'));
                const selectedIds = checkboxes.filter(cb => cb.checked).map(cb => cb.value);
                if (selectedIds.length === 0)
                    return;
                if (confirm(`Deseja realmente excluir ${selectedIds.length} despesa(s) de cartão selecionada(s) em lote?`)) {
                    const originalHtml = btnBulkDelete.innerHTML;
                    btnBulkDelete.disabled = true;
                    btnBulkDelete.textContent = 'Excluindo...';
                    try {
                        const response = await api('/card-expenses/bulk-delete', {
                            method: 'POST',
                            body: JSON.stringify({ publicIds: selectedIds })
                        });
                        UI.showAlert('alertMessage', response.message || 'Despesas excluídas com sucesso!', 'success');
                        // Hide bulk button
                        hideBulkDeleteButton();
                        await cardExpensesManager.loadData();
                    }
                    catch (error) {
                        UI.showAlert('alertMessage', error.message || 'Erro ao excluir despesas em lote.', 'error');
                    }
                    finally {
                        btnBulkDelete.disabled = false;
                        btnBulkDelete.innerHTML = originalHtml;
                    }
                }
            });
        }
        Promise.all([loadCategories(), loadCardDebits()]).then(() => {
            cardExpensesManager.init();
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
            tempo: getById('expenseTempo').value || null,
            category_public_id: getById('expenseCategory').value || null,
            card_debit_public_id: getById('expenseCardDebit').value || null,
            value: parsedValue,
            observation: getById('expenseObservation').value || null
        };
        if (!payload.card_debit_public_id) {
            alert('Por favor, selecione o Pagamento de Cartão (Fatura).');
            return;
        }
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';
        try {
            if (id) {
                await api(`/card-expenses/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                UI.showAlert('alertMessage', 'Despesa de cartão atualizada com sucesso!', 'success');
            }
            else {
                await api('/card-expenses', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                UI.showAlert('alertMessage', 'Despesa de cartão salva com sucesso!', 'success');
            }
            cardExpensesManager.closeModal();
            cardExpensesManager.loadData();
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
