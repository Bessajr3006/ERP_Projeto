// @ts-nocheck
(() => {
    // ─── Controller: Extrato e Movimentações ─────────────────────────────────────
    let statementsData = []; // Todos os lançamentos mesclados (receitas + despesas)
    let banksData = [];
    let currentView = window.CompanyStorage?.getItem('statementsView') || localStorage.getItem('statementsView') || 'list';
    let _tablePager = null;
    let _gridPager = null;
    // Banco
    let bankStatementsData = [];
    const getById = (id) => document.getElementById(id);
    const FilterPanel = window.FilterPanel;
    const Paginator = window.Paginator;
    const DateUtilsRef = window.DateUtils || (typeof DateUtils !== 'undefined' ? DateUtils : null);
    // ─── Formatação ───────────────────────────────────────────────────────────────
    const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const formatDate = (iso) => {
        // Evita shift de fuso ao parsear apenas a data (YYYY-MM-DD)
        const [y, m, d] = String(iso).split('T')[0].split('-');
        return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('pt-BR');
    };
    // ─── Alternância de view (lista / cards) ──────────────────────────────────────
    function updateViewToggle() {
        const btnList = getById('btnListView');
        const btnGrid = getById('btnGridView');
        const tableSection = getById('statementsSection');
        const gridSection = getById('statementsGridSection');
        const tablePagContainer = getById('statementsPaginationContainer');
        const gridPagContainer = getById('statementsGridPaginationContainer');
        if (!btnList || !btnGrid || !tableSection || !gridSection)
            return;
        const inactive = 'flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1';
        const active = 'flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1';
        btnList.className = inactive;
        btnGrid.className = inactive;
        btnList.querySelector('.check-icon')?.classList.add('hidden');
        btnGrid.querySelector('.check-icon')?.classList.add('hidden');
        if (currentView === 'list') {
            btnList.className = active;
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
            btnGrid.className = active;
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
    // ─── Actions Action Bar ───────────────────────────────────────────────────────
    function updateConciliationBar() {
        const sysChecked = document.querySelectorAll('.chk-system:checked').length;
        const bankChecked = document.querySelectorAll('.chk-bank:checked').length;
        const bar = getById('conciliationActionBar');
        const btn = getById('btnConciliate');
        if (!bar || !btn)
            return;
        if (sysChecked > 0 || bankChecked > 0) {
            bar.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
            bar.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
        }
        else {
            bar.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
            bar.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
        }
        const sysCount = getById('concilSystemCount');
        const bankCount = getById('concilBankCount');
        if (sysCount)
            sysCount.textContent = `${sysChecked} ERP`;
        if (bankCount)
            bankCount.textContent = `${bankChecked} Banco`;
        getById('concilSystemDotActive')?.classList.toggle('hidden', sysChecked === 0);
        getById('concilSystemDotInactive')?.classList.toggle('hidden', sysChecked > 0);
        getById('concilBankDotActive')?.classList.toggle('hidden', bankChecked === 0);
        getById('concilBankDotInactive')?.classList.toggle('hidden', bankChecked > 0);
        let sysSum = 0;
        document.querySelectorAll('.chk-system:checked').forEach((chk) => {
            const amt = parseFloat(chk.dataset.amount) || 0;
            const type = chk.dataset.type;
            sysSum += type === 'revenue' || type === 'income' ? amt : -amt;
        });
        let bankSum = 0;
        document.querySelectorAll('.chk-bank:checked').forEach((chk) => {
            const amt = parseFloat(chk.dataset.amount) || 0;
            const type = chk.dataset.type;
            bankSum += type === 'revenue' || type === 'income' ? amt : -amt;
        });
        const diff = Math.abs(sysSum - bankSum);
        const isValid = sysChecked > 0 && bankChecked > 0 && diff < 0.01;
        btn.disabled = !isValid;
        if (!isValid && sysChecked > 0 && bankChecked > 0) {
            btn.innerHTML = `<svg class="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg> 
                         Diferença: ${formatCurrency(diff)}`;
            btn.classList.replace('bg-emerald-600', 'bg-amber-600');
            btn.classList.replace('hover:bg-emerald-500', 'hover:bg-amber-500');
        }
        else {
            btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg> 
                         Conciliar Selecionados`;
            btn.classList.replace('bg-amber-600', 'bg-emerald-600');
            btn.classList.replace('hover:bg-amber-500', 'hover:bg-emerald-500');
        }
    }
    // ─── Filtros ──────────────────────────────────────────────────────────────────
    function summarizeItems(items) {
        const totalIn = items.filter((t) => t.type === 'revenue' && t.status === 'paid').reduce((sum, t) => sum + Number(t.amount), 0);
        const totalOut = items.filter((t) => t.type === 'expense' && t.status === 'paid').reduce((sum, t) => sum + Number(t.amount), 0);
        const balance = totalIn - totalOut;
        return { totalIn, totalOut, balance };
    }
    function getFilteredSystemStatements() {
        const bankFilter = getById('filterSysBank')?.value || '';
        const typeFilter = getById('filterSysType')?.value || '';
        const statusFilter = getById('filterSysStatus')?.value || '';
        const startFilter = getById('filterSysStart')?.value || '';
        const endFilter = getById('filterSysEnd')?.value || '';
        const searchFilter = getById('filterSysSearch')?.value || '';
        return statementsData.filter((t) => {
            if (bankFilter && t.bank_account_public_id !== bankFilter)
                return false;
            if (typeFilter && t.type !== typeFilter)
                return false;
            if (statusFilter) {
                const isPaid = t.status === 'paid';
                const isOverdue = !isPaid && DateUtilsRef?.isBeforeToday?.(t.date);
                const isPending = !isPaid && !isOverdue;
                if (statusFilter === 'paid' && !isPaid)
                    return false;
                if (statusFilter === 'pending' && !isPending)
                    return false;
                if (statusFilter === 'overdue' && !isOverdue)
                    return false;
            }
            if (startFilter || endFilter) {
                const tDate = t.date ? String(t.date).split('T')[0] : '';
                const tReceived = t.received_at ? String(t.received_at).split('T')[0] : '';
                const tScheduled = t.scheduled_at ? String(t.scheduled_at).split('T')[0] : '';
                const matchDate = (d) => {
                    if (!d)
                        return false;
                    if (startFilter && d < startFilter)
                        return false;
                    if (endFilter && d > endFilter)
                        return false;
                    return true;
                };
                const hasAnyDateMatch = matchDate(tDate) || matchDate(tReceived) || matchDate(tScheduled);
                if (!hasAnyDateMatch)
                    return false;
            }
            if (searchFilter) {
                if (!FilterPanel.matchesSearch(t, ['description', 'category_name', 'bank_account_name', 'entity_name'], searchFilter)) {
                    return false;
                }
            }
            return true;
        });
    }
    function updateFooter(items) {
        const footerCount = getById('footerCount');
        const footerTotalIn = getById('footerTotalIn');
        const footerTotalOut = getById('footerTotalOut');
        const footerBalance = getById('footerBalance');
        if (!footerCount || !footerTotalIn || !footerTotalOut || !footerBalance)
            return;
        const { totalIn, totalOut, balance } = summarizeItems(items);
        footerCount.textContent = String(items.length);
        footerTotalIn.textContent = formatCurrency(totalIn);
        footerTotalOut.textContent = formatCurrency(totalOut);
        footerBalance.textContent = formatCurrency(balance);
        footerBalance.className =
            balance >= 0
                ? 'mt-1 block text-sm font-bold text-emerald-600 dark:text-emerald-400'
                : 'mt-1 block text-sm font-bold text-red-600 dark:text-red-400';
    }
    // ─── Mapeamento de método de pagamento ────────────────────────────────────────
    function paymentLabel(method) {
        const MAP = {
            pix: 'PIX',
            credit: 'Crédito',
            debit: 'Débito',
            cash: 'Dinheiro',
            transfer: 'Transferência',
            boleto: 'Boleto',
        };
        return MAP[String(method)] || '-';
    }
    function getStatementStatusMeta(statement) {
        const isOverdue = statement.status !== 'paid' && DateUtilsRef?.isBeforeToday?.(statement.date);
        if (statement.status === 'paid') {
            return {
                tableBadge: statement.type === 'revenue' ? 'Recebido' : 'Pago',
                tableClasses: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300',
                cardText: statement.type === 'revenue' ? 'Recebido' : 'Pago',
                cardClasses: 'text-green-800 bg-green-100 dark:bg-green-900/40 dark:text-green-300',
            };
        }
        if (isOverdue) {
            return {
                tableBadge: 'Vencido',
                tableClasses: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
                cardText: 'Vencido',
                cardClasses: 'text-red-800 bg-red-100 dark:bg-red-900/40 dark:text-red-300',
            };
        }
        return {
            tableBadge: 'Pendente',
            tableClasses: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
            cardText: 'Pendente',
            cardClasses: 'text-yellow-800 bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-300',
        };
    }
    // ─── Render: tabela ───────────────────────────────────────────────────────────
    function renderTable(items) {
        const tbody = getById('statementsTable');
        if (!tbody)
            return;
        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            Nenhuma movimentação encontrada para os filtros selecionados.</td></tr>`;
            return;
        }
        tbody.innerHTML = items
            .map((t) => {
            const isRevenue = t.type === 'revenue';
            const valueClass = isRevenue
                ? 'text-right text-xs font-bold text-green-600 dark:text-green-400'
                : 'text-right text-xs font-bold text-red-500 dark:text-red-400';
            const sign = isRevenue ? '+' : '-';
            const statusMeta = getStatementStatusMeta(t);
            const typeBadge = isRevenue
                ? `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">Receita</span>`
                : `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">Despesa</span>`;
            const statusBadge = `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMeta.tableClasses}">${statusMeta.tableBadge}</span>`;
            const isPaid = !!t.is_reconciled;
            const checkboxHtml = isPaid
                ? `<div class="w-4 h-4 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"><svg class="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg></div>`
                : `<input type="checkbox" class="chk-system rounded border-gray-300 text-brand-600 focus:ring-brand-500/30 dark:bg-slate-700 dark:border-slate-600" data-id="${t.public_id}" data-amount="${t.amount}" data-type="${t.type}">`;
            const effectiveDate = (t.status === 'paid' && t.received_at) ? t.received_at : t.date;
            const hasDiffDueDate = t.status === 'paid' && t.received_at && String(t.received_at).split('T')[0] !== String(t.date).split('T')[0];
            return `
        <tr class="${isPaid ? 'opacity-60 bg-gray-50 dark:bg-slate-800/50' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors'}">
            <td class="px-3 py-4 whitespace-nowrap w-12 text-center">
                ${checkboxHtml}
            </td>
            <td class="px-3 py-4 whitespace-nowrap text-[11px] font-medium text-gray-500 dark:text-gray-400">
                <div class="font-medium text-gray-900 dark:text-gray-100" title="${t.status === 'paid' ? 'Data de Recebimento / Pagamento' : 'Data de Vencimento'}">${formatDate(effectiveDate)}</div>
                ${hasDiffDueDate ? `
                    <div class="text-[10px] text-gray-400 dark:text-gray-500" title="Vencimento original: ${formatDate(t.date)}">Venc: ${formatDate(t.date)}</div>
                ` : ''}
            </td>
            <td class="px-3 py-4 whitespace-nowrap">${typeBadge}</td>
            <td class="px-3 py-4 text-xs text-gray-900 dark:text-gray-100">
                <div class="font-medium">
                    ${t.description}
                    ${t.entity_name ? `<span class="text-[10px] text-gray-500 dark:text-gray-400 font-normal ml-1.5">(${t.entity_name})</span>` : ''}
                </div>
                <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                    ${t.category_name ? `<span class="mr-2">${t.category_name}</span>` : ''}
                    ${t.payment_method ? `<span class="text-gray-400 dark:text-gray-500">· ${paymentLabel(t.payment_method)}</span>` : ''}
                </div>
            </td>
            <td class="px-3 py-4 whitespace-nowrap text-[11px] text-gray-500 dark:text-gray-400">
                <div>${t.bank_account_name || '-'}</div>
                <div class="mt-0.5">${statusBadge}</div>
            </td>
            <td class="px-3 py-4 whitespace-nowrap ${valueClass}">
                ${sign} ${formatCurrency(t.amount)}
            </td>
        </tr>`;
        })
            .join('');
    }
    // ─── Render: cards (grid view) ─────────────────────────────────────────────────
    function renderGrid(items) {
        const grid = getById('statementsGridContainer');
        if (!grid)
            return;
        if (items.length === 0) {
            grid.innerHTML = `<div class="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">Nenhuma movimentação encontrada para os filtros selecionados.</div>`;
            return;
        }
        grid.innerHTML = items
            .map((t, index) => {
            const isRevenue = t.type === 'revenue';
            const amountColor = isRevenue ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
            const sign = isRevenue ? '+' : '-';
            const statusMeta = getStatementStatusMeta(t);
            const typeBadge = isRevenue
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
            const effectiveDate = (t.status === 'paid' && t.received_at) ? t.received_at : t.date;
            const hasDiffDueDate = t.status === 'paid' && t.received_at && String(t.received_at).split('T')[0] !== String(t.date).split('T')[0];
            return `
        <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col relative border border-gray-100 dark:border-slate-700 group">
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center z-10 pt-1">
                    <span class="text-xs font-mono font-medium text-gray-500 dark:text-gray-400">#${String(index + 1).padStart(4, '0')}</span>
                </div>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeBadge}">
                    ${isRevenue ? 'Receita' : 'Despesa'}
                </span>
            </div>

            <div class="flex-1 mt-1">
                <div class="flex justify-between items-start gap-2">
                    <h4 class="text-base font-bold text-gray-900 dark:text-gray-100 wrap-break-word flex-1 leading-tight pr-2">${t.description}</h4>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        ${t.category_name || 'Geral'}
                    </span>
                </div>

                <div class="mt-4 grid grid-cols-2 gap-4">
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300">
                        <span class="text-xs text-gray-500 dark:text-gray-400">${t.status === 'paid' ? 'Recebido/Pago:' : 'Data:'}</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100">${DateUtilsRef?.formatDate?.(effectiveDate) || formatDate(effectiveDate)}</span>
                        ${hasDiffDueDate ? `<span class="text-[10px] text-gray-400 dark:text-gray-500">Venc: ${formatDate(t.date)}</span>` : ''}
                    </div>
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Valor:</span>
                        <span class="font-medium ${amountColor}">${sign} ${formatCurrency(t.amount)}</span>
                    </div>
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300 col-span-2">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Conta:</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100">${t.bank_account_name || '-'}</span>
                    </div>
                    ${t.entity_name ? `
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300 col-span-2">
                        <span class="text-xs text-gray-500 dark:text-gray-400">${t.type === 'revenue' ? 'Cliente' : 'Fornecedor'}:</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100">${t.entity_name}</span>
                    </div>
                    ` : ''}
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Status:</span>
                        <span class="inline-flex max-w-min px-2 py-0.5 mt-0.5 rounded-md text-xs font-medium ${statusMeta.cardClasses}">
                            ${statusMeta.cardText}
                        </span>
                    </div>
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Forma Pgto.:</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100">${paymentLabel(t.payment_method)}</span>
                    </div>
                </div>
            </div>
        </div>`;
        })
            .join('');
    }
    // ─── Render principal do Sistema ──────────────────────────────────────────────
    function renderAllSystem() {
        const items = getFilteredSystemStatements();
        updateFooter(items);
        renderTable(items);
        renderGrid(items);
        updateViewToggle();
    }
    function renderAll() {
        renderAllSystem();
        renderBankStatements();
    }
    // ─── Carregar filtros dinâmicos de bancos ──────────────────────────────────────
    function populateBankFilters() {
        const selSys = getById('filterSysBank');
        const selBank = getById('filterBankSelect');
        if (selSys) {
            const prevSys = selSys.value;
            selSys.innerHTML = '<option value="">Todas as contas</option>';
            banksData.forEach((b) => {
                selSys.innerHTML += `<option value="${b.public_id}">${b.name}</option>`;
            });
            if (prevSys)
                selSys.value = prevSys;
        }
        if (selBank) {
            const prevBank = selBank.value;
            selBank.innerHTML = '<option value="">Selecione uma conta</option>';
            banksData.forEach((b) => {
                selBank.innerHTML += `<option value="${b.public_id}">${b.name}</option>`;
            });
            if (prevBank) {
                selBank.value = prevBank;
            }
            else if (banksData.length === 1) {
                selBank.value = banksData[0].public_id;
            }
        }
    }
    // ─── Busca de dados ───────────────────────────────────────────────────────────
    async function fetchStatements() {
        try {
            const [expRes, revRes, bankRes] = await Promise.all([
                api('/finance/expenses'),
                api('/finance/revenues'),
                api('/bank-accounts'),
            ]);
            banksData = bankRes.data || [];
            populateBankFilters();
            const expenses = (expRes.data || []).map((e) => ({ ...e, type: 'expense' }));
            const revenues = (revRes.data || []).map((r) => ({ ...r, type: 'revenue' }));
            // Ordena cronologico decrescente (mais recente primeiro usando data de efetivação quando pago)
            statementsData = [...expenses, ...revenues].sort((a, b) => {
                const da = String((a.status === 'paid' && a.received_at) ? a.received_at : a.date).split('T')[0];
                const db = String((b.status === 'paid' && b.received_at) ? b.received_at : b.date).split('T')[0];
                return db.localeCompare(da);
            });
            renderAllSystem();
        }
        catch (err) {
            console.error('[Statements] Erro ao carregar movimentações:', err);
            UI.showAlert('alertMessage', 'Erro ao carregar movimentações. Tente novamente.', 'error');
        }
    }
    function setupFilters() {
        // 1. Filtro dos Lançamentos do Sistema ERP (Coluna Esquerda)
        FilterPanel.mount({
            afterElementId: 'systemFilterAnchor',
            panelId: 'system-statements-filter-panel',
            title: 'Filtro - Lançamentos do Sistema',
            storageKey: 'system_statements_filters',
            defaultOpen: false,
            fields: [
                { id: 'filterSysStart', label: 'Data Início', type: 'date' },
                { id: 'filterSysEnd', label: 'Data Fim', type: 'date' },
                {
                    id: 'filterSysBank',
                    label: 'Conta Bancária',
                    type: 'select',
                    options: [{ value: '', label: 'Todas as contas' }],
                },
                {
                    id: 'filterSysType',
                    label: 'Tipo',
                    type: 'select',
                    options: [
                        { value: '', label: 'Todos' },
                        { value: 'revenue', label: 'Receitas' },
                        { value: 'expense', label: 'Despesas' },
                    ],
                },
                {
                    id: 'filterSysStatus',
                    label: 'Status',
                    type: 'select',
                    options: [
                        { value: '', label: 'Todos' },
                        { value: 'paid', label: 'Pagos / Recebidos' },
                        { value: 'pending', label: 'Pendentes' },
                        { value: 'overdue', label: 'Vencidos' },
                    ],
                },
                { id: 'filterSysSearch', label: 'Busca', type: 'text', placeholder: 'Descrição, categoria, entidade...' },
            ],
            gridClass: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end',
        });
        // 2. Filtro do Extrato do Banco (Coluna Direita)
        FilterPanel.mount({
            afterElementId: 'bankFilterAnchor',
            panelId: 'bank-statements-filter-panel',
            title: 'Filtro - Extrato do Banco',
            storageKey: 'bank_statements_filters',
            defaultOpen: false,
            fields: [
                { id: 'filterBankStart', label: 'Data Início', type: 'date' },
                { id: 'filterBankEnd', label: 'Data Fim', type: 'date' },
                {
                    id: 'filterBankSelect',
                    label: 'Conta Bancária',
                    type: 'select',
                    options: [{ value: '', label: 'Selecione uma conta' }],
                },
                {
                    id: 'filterBankType',
                    label: 'Tipo',
                    type: 'select',
                    options: [
                        { value: '', label: 'Todos' },
                        { value: 'income', label: 'Entradas' },
                        { value: 'expense', label: 'Saídas' },
                    ],
                },
                {
                    id: 'filterBankReconciled',
                    label: 'Status',
                    type: 'select',
                    options: [
                        { value: '', label: 'Todos' },
                        { value: 'unreconciled', label: 'Não Conciliados' },
                        { value: 'reconciled', label: 'Conciliados' },
                    ],
                },
                { id: 'filterBankSearch', label: 'Busca', type: 'text', placeholder: 'Descrição no extrato...' },
            ],
            gridClass: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end',
        });
        restoreFilters();
        // Eventos do Sistema
        ['filterSysStart', 'filterSysEnd', 'filterSysBank', 'filterSysType', 'filterSysStatus'].forEach((id) => {
            getById(id)?.addEventListener('change', () => {
                saveFilters();
                renderAllSystem();
            });
        });
        let sysSearchTimer = null;
        getById('filterSysSearch')?.addEventListener('input', () => {
            if (sysSearchTimer)
                clearTimeout(sysSearchTimer);
            sysSearchTimer = setTimeout(() => {
                saveFilters();
                renderAllSystem();
                sysSearchTimer = null;
            }, 180);
        });
        // Eventos do Banco
        ['filterBankStart', 'filterBankEnd', 'filterBankSelect'].forEach((id) => {
            getById(id)?.addEventListener('change', () => {
                saveFilters();
                void loadBankStatements();
            });
        });
        ['filterBankType', 'filterBankReconciled'].forEach((id) => {
            getById(id)?.addEventListener('change', () => {
                saveFilters();
                renderBankStatements();
            });
        });
        let bankSearchTimer = null;
        getById('filterBankSearch')?.addEventListener('input', () => {
            if (bankSearchTimer)
                clearTimeout(bankSearchTimer);
            bankSearchTimer = setTimeout(() => {
                saveFilters();
                renderBankStatements();
                bankSearchTimer = null;
            }, 180);
        });
    }
    function saveFilters() {
        const sysFilters = {
            filterSysStart: getById('filterSysStart')?.value || '',
            filterSysEnd: getById('filterSysEnd')?.value || '',
            filterSysBank: getById('filterSysBank')?.value || '',
            filterSysType: getById('filterSysType')?.value || '',
            filterSysStatus: getById('filterSysStatus')?.value || '',
            filterSysSearch: getById('filterSysSearch')?.value || '',
        };
        const bankFilters = {
            filterBankStart: getById('filterBankStart')?.value || '',
            filterBankEnd: getById('filterBankEnd')?.value || '',
            filterBankSelect: getById('filterBankSelect')?.value || '',
            filterBankType: getById('filterBankType')?.value || '',
            filterBankReconciled: getById('filterBankReconciled')?.value || '',
            filterBankSearch: getById('filterBankSearch')?.value || '',
        };
        if (window.CompanyStorage) {
            window.CompanyStorage.setItem('system_statements_filters_values', JSON.stringify(sysFilters));
            window.CompanyStorage.setItem('bank_statements_filters_values', JSON.stringify(bankFilters));
        }
        else {
            localStorage.setItem('system_statements_filters_values', JSON.stringify(sysFilters));
            localStorage.setItem('bank_statements_filters_values', JSON.stringify(bankFilters));
        }
    }
    function restoreFilters() {
        const savedSys = window.CompanyStorage?.getItem('system_statements_filters_values') ?? localStorage.getItem('system_statements_filters_values');
        if (savedSys) {
            try {
                const filters = JSON.parse(savedSys);
                if (getById('filterSysStart'))
                    getById('filterSysStart').value = filters.filterSysStart || '';
                if (getById('filterSysEnd'))
                    getById('filterSysEnd').value = filters.filterSysEnd || '';
                if (getById('filterSysBank'))
                    getById('filterSysBank').value = filters.filterSysBank || '';
                if (getById('filterSysType'))
                    getById('filterSysType').value = filters.filterSysType || '';
                if (getById('filterSysStatus'))
                    getById('filterSysStatus').value = filters.filterSysStatus || '';
                if (getById('filterSysSearch'))
                    getById('filterSysSearch').value = filters.filterSysSearch || '';
            }
            catch (e) {
                console.error('[Statements] Erro ao restaurar filtros do sistema:', e);
            }
        }
        const savedBank = window.CompanyStorage?.getItem('bank_statements_filters_values') ?? localStorage.getItem('bank_statements_filters_values');
        if (savedBank) {
            try {
                const filters = JSON.parse(savedBank);
                if (getById('filterBankStart'))
                    getById('filterBankStart').value = filters.filterBankStart || '';
                if (getById('filterBankEnd'))
                    getById('filterBankEnd').value = filters.filterBankEnd || '';
                if (getById('filterBankSelect'))
                    getById('filterBankSelect').value = filters.filterBankSelect || '';
                if (getById('filterBankType'))
                    getById('filterBankType').value = filters.filterBankType || '';
                if (getById('filterBankReconciled'))
                    getById('filterBankReconciled').value = filters.filterBankReconciled || '';
                if (getById('filterBankSearch'))
                    getById('filterBankSearch').value = filters.filterBankSearch || '';
            }
            catch (e) {
                console.error('[Statements] Erro ao restaurar filtros do banco:', e);
            }
        }
    }
    // ─── Filtro rápido do mês corrente por default ────────────────────────────────
    function setDefaultPeriods() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const start = `${y}-${m}-01`;
        const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
        const end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
        const sysStart = getById('filterSysStart');
        const sysEnd = getById('filterSysEnd');
        if (sysStart && !sysStart.value)
            sysStart.value = start;
        if (sysEnd && !sysEnd.value)
            sysEnd.value = end;
        const bankStart = getById('filterBankStart');
        const bankEnd = getById('filterBankEnd');
        if (bankStart && !bankStart.value)
            bankStart.value = start;
        if (bankEnd && !bankEnd.value)
            bankEnd.value = end;
    }
    // ─── Integração API Banco ─────────────────────────────────────────────────────
    function updateBankFooter(items) {
        const footerCount = getById('footerBankCount');
        const footerTotalIn = getById('footerBankTotalIn');
        const footerTotalOut = getById('footerBankTotalOut');
        const footerBalance = getById('footerBankBalance');
        if (!footerCount || !footerTotalIn || !footerTotalOut || !footerBalance)
            return;
        let totalIn = 0, totalOut = 0;
        items.forEach((t) => {
            if (t.type === 'income' || t.type === 'revenue')
                totalIn += Number(t.amount);
            else
                totalOut += Number(t.amount);
        });
        const balance = totalIn - totalOut;
        footerCount.textContent = String(items.length);
        footerTotalIn.textContent = formatCurrency(totalIn);
        footerTotalOut.textContent = formatCurrency(totalOut);
        footerBalance.textContent = formatCurrency(balance);
        footerBalance.className =
            balance >= 0
                ? 'mt-0.5 block text-xs font-bold text-emerald-600 dark:text-emerald-400'
                : 'mt-0.5 block text-xs font-bold text-red-600 dark:text-red-400';
    }
    function getFilteredBankStatements(data) {
        const statements = Array.isArray(data) ? data : bankStatementsData || [];
        const startDate = getById('filterBankStart')?.value || '';
        const endDate = getById('filterBankEnd')?.value || '';
        const typeFilter = getById('filterBankType')?.value || '';
        const reconciledFilter = getById('filterBankReconciled')?.value || '';
        const searchFilter = getById('filterBankSearch')?.value || '';
        return statements.filter((s) => {
            if (startDate || endDate) {
                const dateStr = String(s.date || '').split('T')[0];
                if (startDate && dateStr < startDate)
                    return false;
                if (endDate && dateStr > endDate)
                    return false;
            }
            if (typeFilter && s.type !== typeFilter)
                return false;
            if (reconciledFilter) {
                const isReconciled = s.status === 'reconciled';
                if (reconciledFilter === 'reconciled' && !isReconciled)
                    return false;
                if (reconciledFilter === 'unreconciled' && isReconciled)
                    return false;
            }
            if (searchFilter) {
                if (!FilterPanel.matchesSearch(s, ['description'], searchFilter)) {
                    return false;
                }
            }
            return true;
        });
    }
    function renderBankStatements(data) {
        const tableBody = getById('bankStatementsTable');
        if (!tableBody)
            return;
        const finalStatements = getFilteredBankStatements(data);
        updateBankFooter(finalStatements);
        if (finalStatements.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum lançamento no extrato para este período/conta.</td></tr>`;
            return;
        }
        tableBody.innerHTML = finalStatements
            .map((t) => {
            const isRevenue = t.type === 'income' || t.type === 'revenue';
            const amountColor = isRevenue ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400';
            const sign = isRevenue ? '+' : '-';
            const isReconciled = t.status === 'reconciled';
            const rowClass = isReconciled
                ? 'opacity-60 bg-gray-50 dark:bg-slate-800/50'
                : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors';
            const checkboxHtml = isReconciled
                ? `<div class="w-4 h-4 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"><svg class="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg></div>`
                : `<input type="checkbox" class="chk-bank rounded border-gray-300 text-emerald-600 focus:ring-emerald-500/30 dark:bg-slate-700 dark:border-slate-600" data-id="${t.public_id}" data-amount="${t.amount}" data-type="${t.type}">`;
            const actionHtml = isReconciled
                ? `<div class="flex flex-col items-center gap-1">
                 <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 gap-1"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Conciliado</span>
                 <button class="text-[9px] text-red-500 hover:text-red-700 underline underline-offset-2 transition-colors btn-unreconcile" data-id="${t.public_id}">Desconciliar</button>
               </div>`
                : `<button class="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded font-bold hover:bg-emerald-100 transition-colors dark:bg-emerald-900/30 dark:text-emerald-400 btn-conciliate-single" data-id="${t.public_id}">Conciliar</button>`;
            return `
        <tr class="${rowClass}">
            <td class="px-4 py-4 whitespace-nowrap w-12 text-center">
                ${checkboxHtml}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-[11px] text-gray-500 dark:text-gray-400 font-medium">${formatDate(t.date)}</td>
            <td class="px-6 py-4 text-xs text-gray-900 dark:text-gray-100 font-medium ${isReconciled ? 'line-through decoration-gray-300 dark:decoration-slate-600' : ''}">${t.description}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-xs font-bold ${amountColor}">${sign} ${formatCurrency(t.amount)}</td>
            <td class="px-4 py-4 whitespace-nowrap text-center">
                ${actionHtml}
            </td>
        </tr>`;
        })
            .join('');
    }
    async function loadBankStatements() {
        const bankId = getById('filterBankSelect')?.value || getById('filterSysBank')?.value;
        const startDate = getById('filterBankStart')?.value || '';
        const endDate = getById('filterBankEnd')?.value || '';
        const emptyState = getById('bankStatementsEmptyState');
        const table = document.querySelector('#bankStatementsTable')?.closest('table');
        if (!bankId) {
            if (emptyState)
                emptyState.style.display = 'flex';
            if (table)
                table.classList.add('opacity-30', 'select-none', 'pointer-events-none');
            bankStatementsData = [];
            renderBankStatements([]);
            return;
        }
        try {
            const res = await api(`/finance/bank-statements?bankAccountPublicId=${bankId}&startDate=${startDate}&endDate=${endDate}`);
            if (emptyState)
                emptyState.style.display = 'none';
            if (table)
                table.classList.remove('opacity-30', 'select-none', 'pointer-events-none');
            bankStatementsData = res.data || [];
            renderBankStatements();
        }
        catch (err) {
            console.error('Erro ao carregar extrato:', err);
        }
    }
    async function syncBankStatementsViaApi() {
        const bankId = getById('filterBankSelect')?.value || getById('filterSysBank')?.value;
        const startDate = getById('filterBankStart')?.value || getById('filterSysStart')?.value;
        const endDate = getById('filterBankEnd')?.value || getById('filterSysEnd')?.value;
        if (!bankId) {
            UI.showAlert('alertMessage', 'Selecione uma Conta Bancária no filtro do Extrato do Banco antes de sincronizar.', 'warning');
            return;
        }
        if (!startDate || !endDate) {
            UI.showAlert('alertMessage', 'Defina a Data Início e Fim no filtro do Extrato para sincronizar.', 'warning');
            return;
        }
        try {
            const btn1 = getById('btnSyncBankApi');
            const btn2 = getById('btnSyncBankApiCenter');
            const btn3 = getById('btnHeaderSyncBankApi');
            const oldText1 = btn1?.innerHTML || '';
            const oldText2 = btn2?.innerHTML || '';
            const oldText3 = btn3?.innerHTML || '';
            if (btn1)
                btn1.innerHTML = 'Sincronizando...';
            if (btn2)
                btn2.innerHTML = 'Sincronizando...';
            if (btn3)
                btn3.innerHTML = 'Sincronizando...';
            const res = await api('/finance/bank-statements/sync', {
                method: 'POST',
                body: JSON.stringify({ bankAccountPublicId: bankId, startDate, endDate }),
            });
            UI.showAlert('alertMessage', res.message || 'Sincronização concluída com sucesso!', 'success');
            if (btn1)
                btn1.innerHTML = oldText1;
            if (btn2)
                btn2.innerHTML = oldText2 || 'Consultar Extrato via API';
            if (btn3)
                btn3.innerHTML = oldText3 || 'Consultar API';
            await loadBankStatements();
        }
        catch (err) {
            console.error('Sync banco err:', err);
            UI.showAlert('alertMessage', err?.message || 'Erro ao sincronizar extrato com o Banco.', 'error');
            const btn1 = getById('btnSyncBankApi');
            const btn2 = getById('btnSyncBankApiCenter');
            const btn3 = getById('btnHeaderSyncBankApi');
            if (btn1) {
                btn1.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> Consultar API`;
            }
            if (btn2) {
                btn2.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg> Consultar Extrato via API`;
            }
            if (btn3) {
                btn3.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> Consultar API`;
            }
        }
    }
    // ─── DOMContentLoaded ─────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', async () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }
        document.title = 'KEYSTONE - Extrato';
        // Alterna view lista/cards
        getById('btnListView')?.addEventListener('click', () => {
            currentView = 'list';
            if (window.CompanyStorage) {
                window.CompanyStorage.setItem('statementsView', 'list');
            }
            else {
                localStorage.setItem('statementsView', 'list');
            }
            updateViewToggle();
        });
        getById('btnGridView')?.addEventListener('click', () => {
            currentView = 'grid';
            if (window.CompanyStorage) {
                window.CompanyStorage.setItem('statementsView', 'grid');
            }
            else {
                localStorage.setItem('statementsView', 'grid');
            }
            updateViewToggle();
        });
        getById('btnSyncBankApi')?.addEventListener('click', syncBankStatementsViaApi);
        getById('btnSyncBankApiCenter')?.addEventListener('click', syncBankStatementsViaApi);
        getById('btnHeaderSyncBankApi')?.addEventListener('click', syncBankStatementsViaApi);
        updateViewToggle();
        setupFilters();
        setDefaultPeriods();
        // Eventos para Select All Checkboxes
        getById('chkAllSystem')?.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.chk-system');
            const checked = !!e?.target?.checked;
            checkboxes.forEach((chk) => (chk.checked = checked));
            updateConciliationBar();
        });
        getById('chkAllBank')?.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.chk-bank');
            const checked = !!e?.target?.checked;
            checkboxes.forEach((chk) => (chk.checked = checked));
            updateConciliationBar();
        });
        document.addEventListener('change', (e) => {
            const target = e?.target;
            if (target?.matches?.('.chk-system') || target?.matches?.('.chk-bank')) {
                updateConciliationBar();
            }
        });
        document.addEventListener('click', async (e) => {
            const target = e?.target;
            if (target?.matches?.('.btn-unreconcile')) {
                e.preventDefault();
                e.stopPropagation();
                const public_id = target?.dataset?.id;
                if (!confirm('Deseja realmente remover a conciliação deste lançamento?'))
                    return;
                try {
                    target.innerHTML = 'Desfazendo...';
                    target.disabled = true;
                    await api('/finance/reconcile/undo', {
                        method: 'POST',
                        body: JSON.stringify({ bank_statement_id: public_id }),
                    });
                    UI.showAlert('alertMessage', 'Conciliação removida com sucesso!', 'success');
                    void fetchStatements();
                    void loadBankStatements();
                }
                catch (err) {
                    target.innerHTML = 'Desconciliar';
                    target.disabled = false;
                    UI.showAlert('alertMessage', err?.message || 'Erro ao desconciliar registro', 'error');
                }
            }
            if (target?.matches?.('.btn-conciliate-single')) {
                e.preventDefault();
                e.stopPropagation();
                const public_id = target?.dataset?.id;
                // Find the statement row's data
                const stmt = bankStatementsData.find((s) => s.public_id === public_id);
                if (!stmt)
                    return;
                const stmtAmount = parseFloat(stmt.amount) || 0;
                const isExpense = stmt.type === 'expense';
                const matches = statementsData.filter((t) => {
                    if (t.is_reconciled)
                        return false;
                    const tAmount = parseFloat(t.amount) || 0;
                    const isTExpense = t.type === 'expense';
                    return isExpense === isTExpense && Math.abs(tAmount - stmtAmount) < 0.01;
                });
                const isIncome = stmt.type === 'income' || stmt.type === 'revenue';
                if (isIncome) {
                    // Received/deposit value: do NOT auto-reconcile and do NOT auto-check system transaction checkbox.
                    // Let the user choose manually to avoid wrong reconciliation.
                    document.querySelectorAll('.chk-system, .chk-bank').forEach((chk) => chk.checked = false);
                    const bankChk = document.querySelector(`.chk-bank[data-id="${public_id}"]`);
                    if (bankChk)
                        bankChk.checked = true;
                    if (matches.length > 0) {
                        UI.showAlert('alertMessage', `${matches.length} lançamento(s) correspondente(s) encontrado(s) no ERP. Selecione o correto na tabela da esquerda para conciliar.`, 'info');
                    }
                    else {
                        UI.showAlert('alertMessage', 'Nenhum lançamento correspondente encontrado no ERP com este valor.', 'warn');
                    }
                    updateConciliationBar();
                }
                else {
                    if (matches.length === 1) {
                        // Exactly one match! Let's automatically check them and reconcile
                        try {
                            target.innerHTML = 'Processando...';
                            target.disabled = true;
                            await api('/finance/reconcile', {
                                method: 'POST',
                                body: JSON.stringify({ system_ids: [matches[0].public_id], bank_statement_ids: [public_id] }),
                            });
                            UI.showAlert('alertMessage', 'Conciliação realizada com sucesso!', 'success');
                            await fetchStatements();
                            await loadBankStatements();
                        }
                        catch (err) {
                            target.innerHTML = 'Conciliar';
                            target.disabled = false;
                            UI.showAlert('alertMessage', err?.message || 'Erro ao conciliar registro', 'error');
                        }
                    }
                    else if (matches.length > 1) {
                        // Multiple matches: Check the bank statement checkbox and highlight the matching system checkboxes
                        // so the user can choose which one to reconcile.
                        UI.showAlert('alertMessage', 'Múltiplos lançamentos encontrados no ERP com este valor. Selecione um deles para conciliar.', 'info');
                        // Uncheck everything first
                        document.querySelectorAll('.chk-system, .chk-bank').forEach((chk) => chk.checked = false);
                        // Check this bank statement checkbox
                        const bankChk = document.querySelector(`.chk-bank[data-id="${public_id}"]`);
                        if (bankChk)
                            bankChk.checked = true;
                        // Check the first matching system checkbox to guide the user
                        const firstSysChk = document.querySelector(`.chk-system[data-id="${matches[0].public_id}"]`);
                        if (firstSysChk)
                            firstSysChk.checked = true;
                        updateConciliationBar();
                    }
                    else {
                        // No matches: just check the bank statement checkbox to let the user find/create a transaction manually
                        UI.showAlert('alertMessage', 'Nenhum lançamento correspondente encontrado no ERP com este valor.', 'warn');
                        // Check this bank statement checkbox
                        const bankChk = document.querySelector(`.chk-bank[data-id="${public_id}"]`);
                        if (bankChk)
                            bankChk.checked = true;
                        updateConciliationBar();
                    }
                }
            }
        });
        getById('btnConciliate')?.addEventListener('click', async () => {
            const sysSelected = Array.from(document.querySelectorAll('.chk-system:checked')).map((chk) => chk.dataset.id);
            const bankSelected = Array.from(document.querySelectorAll('.chk-bank:checked')).map((chk) => chk.dataset.id);
            if (sysSelected.length === 0 || bankSelected.length === 0)
                return;
            try {
                const btn = getById('btnConciliate');
                if (btn) {
                    btn.innerHTML = 'Conciliando...';
                    btn.disabled = true;
                }
                await api('/finance/reconcile', {
                    method: 'POST',
                    body: JSON.stringify({ system_ids: sysSelected, bank_statement_ids: bankSelected }),
                });
                UI.showAlert('alertMessage', 'Conciliação realizada com sucesso!', 'success');
                const chkSys = getById('chkAllSystem');
                const chkBank = getById('chkAllBank');
                if (chkSys)
                    chkSys.checked = false;
                if (chkBank)
                    chkBank.checked = false;
                document.querySelectorAll('.chk-system:checked, .chk-bank:checked').forEach((chk) => {
                    chk.checked = false;
                });
                updateConciliationBar();
                await fetchStatements();
                await loadBankStatements();
            }
            catch (err) {
                UI.showAlert('alertMessage', err?.message || 'Erro ao conciliar registros', 'error');
            }
            finally {
                const btn = getById('btnConciliate');
                if (btn) {
                    btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg> Conciliar Selecionados`;
                    updateConciliationBar();
                }
            }
        });
        getById('btnBatchDeleteBank')?.addEventListener('click', async () => {
            const selected = Array.from(document.querySelectorAll('.chk-bank:checked')).map((chk) => chk.dataset.id);
            if (selected.length === 0) {
                UI.showAlert('alertMessage', 'Selecione pelo menos um lançamento no extrato para excluir.', 'warn');
                return;
            }
            const email = prompt(`Você está tentando excluir ${selected.length} registro(s) do extrato.\n\nInforme o E-MAIL do Administrador:`);
            if (!email)
                return;
            const password = prompt('Informe a SENHA do Administrador:');
            if (!password)
                return;
            try {
                const res = await api('/finance/bank-statements/batch-delete', {
                    method: 'POST',
                    body: JSON.stringify({
                        ids: selected,
                        email: email,
                        password: password,
                    }),
                });
                UI.showAlert('alertMessage', res.message || 'Lançamentos excluídos com sucesso.', 'success');
                const chkAll = getById('chkAllBank');
                if (chkAll)
                    chkAll.checked = false;
                void loadBankStatements();
            }
            catch (error) {
                UI.showAlert('alertMessage', error?.message || 'Falha ao excluir os lançamentos. Verifique suas credenciais.', 'error');
            }
        });
        // Toggle para o Menu de Ações do Extrato
        const btnBankMenuToggle = getById('btnBankActionsToggle');
        const bankActionsMenu = getById('bankActionsMenu');
        if (btnBankMenuToggle && bankActionsMenu) {
            btnBankMenuToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                bankActionsMenu.classList.toggle('hidden');
            });
            document.addEventListener('click', (e) => {
                const target = e?.target;
                if (!bankActionsMenu.contains(target) && target !== btnBankMenuToggle) {
                    bankActionsMenu.classList.add('hidden');
                }
            });
        }
        // --- Importação de OFX ---
        const btnImportOfx = getById('btnImportOfx');
        const fileOfx = getById('fileOfx');
        if (btnImportOfx && fileOfx) {
            btnImportOfx.addEventListener('click', () => {
                const bankId = getById('filterBankSelect')?.value || getById('filterSysBank')?.value;
                if (!bankId) {
                    UI.showAlert('alertMessage', 'Selecione uma conta bancária no painel de Filtros do Extrato primeiro para associar a importação.', 'warn');
                    return;
                }
                fileOfx.click();
                if (bankActionsMenu)
                    bankActionsMenu.classList.add('hidden');
            });
            fileOfx.addEventListener('change', (e) => {
                const file = e?.target?.files?.[0];
                if (!file)
                    return;
                const bankId = getById('filterBankSelect')?.value || getById('filterSysBank')?.value;
                if (!bankId)
                    return;
                const reader = new FileReader();
                reader.onload = async (evt) => {
                    const ofxContent = evt?.target?.result;
                    try {
                        UI.showAlert('alertMessage', 'Processando arquivo OFX...', 'info');
                        const res = await api('/finance/bank-statements/sync-ofx', {
                            method: 'POST',
                            body: JSON.stringify({
                                bankAccountPublicId: bankId,
                                ofxContent: ofxContent,
                            }),
                        });
                        UI.showAlert('alertMessage', res.message || 'OFX Registrado com sucesso!', 'success');
                        void loadBankStatements();
                    }
                    catch (err) {
                        UI.showAlert('alertMessage', err?.message || 'Falha ao processar arquivo OFX.', 'error');
                    }
                    finally {
                        fileOfx.value = ''; // Clear the input
                    }
                };
                reader.readAsText(file);
            });
        }
        // Carrega os dados
        await fetchStatements();
        await loadBankStatements(); // carrega local table for the right side if bank selected
    });
})();
