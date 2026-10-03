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
    let categoriesData = [];
    let categoryTypesData = [];
    let selectedBankStatementForCreate = null;
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
        if (tableSection) {
            tableSection.style.display = '';
            tableSection.classList.remove('hidden');
        }
        if (gridSection) {
            gridSection.style.display = 'none';
            gridSection.classList.add('hidden');
        }
        if (tablePagContainer)
            tablePagContainer.classList.remove('hidden');
        if (gridPagContainer)
            gridPagContainer.classList.add('hidden');
        if (!btnList || !btnGrid)
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
        }
        else {
            btnGrid.className = active;
            btnGrid.querySelector('.check-icon')?.classList.remove('hidden');
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
    function populateCreateModalBanks() {
        const selBank = getById('stmtCreateBank');
        if (!selBank)
            return;
        const prev = selBank.value;
        selBank.innerHTML = '<option value="">Selecione uma conta...</option>';
        banksData.forEach((b) => {
            selBank.innerHTML += `<option value="${b.public_id}">${b.name}</option>`;
        });
        if (prev) {
            selBank.value = prev;
        }
        else if (banksData.length === 1) {
            selBank.value = banksData[0].public_id;
        }
    }
    function populateCreateModalCategories(type) {
        const selCat = getById('stmtCreateCategory');
        if (!selCat)
            return;
        const targetType = type === 'expense' ? 'expense' : 'income';
        const filtered = categoriesData.filter((c) => {
            if (!c.type || c.type === 'both')
                return true;
            return c.type === targetType || c.type === type;
        });
        selCat.innerHTML = '<option value="">Selecione a categoria...</option>';
        filtered.forEach((c) => {
            const typeSuffix = c.finance_category_type_name ? ` (${c.finance_category_type_name})` : '';
            selCat.innerHTML += `<option value="${c.public_id}">${c.name}${typeSuffix}</option>`;
        });
        if (filtered.length === 1) {
            selCat.value = filtered[0].public_id;
        }
    }
    function updateModalTypeVisuals(type) {
        const badgeType = getById('stmtModalTypeBadge');
        const expenseLabel = getById('stmtTypeExpenseLabel');
        const revenueLabel = getById('stmtTypeRevenueLabel');
        if (badgeType) {
            if (type === 'revenue') {
                badgeType.className = 'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50';
                badgeType.textContent = 'Receita (Entrada)';
            }
            else {
                badgeType.className = 'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-700/50';
                badgeType.textContent = 'Despesa (Saída)';
            }
        }
        if (expenseLabel && revenueLabel) {
            if (type === 'expense') {
                expenseLabel.className = 'flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-red-500 bg-red-50/80 dark:bg-red-950/40 cursor-pointer transition-all shadow-xs';
                revenueLabel.className = 'flex items-center justify-center gap-2 p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 cursor-pointer transition-all hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 opacity-70 hover:opacity-100';
            }
            else {
                revenueLabel.className = 'flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 cursor-pointer transition-all shadow-xs';
                expenseLabel.className = 'flex items-center justify-center gap-2 p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 cursor-pointer transition-all hover:bg-red-50/50 dark:hover:bg-red-950/20 opacity-70 hover:opacity-100';
            }
        }
    }
    function openCreateFromStatementModal(statementPublicId) {
        const stmt = bankStatementsData.find((s) => s.public_id === statementPublicId);
        if (!stmt)
            return;
        selectedBankStatementForCreate = stmt;
        const modal = getById('createFromStatementModal');
        const hiddenId = getById('stmtCreateBankStatementId');
        const dateInput = getById('stmtCreateDate');
        const amountInput = getById('stmtCreateAmount');
        const descInput = getById('stmtCreateDescription');
        const bankSelect = getById('stmtCreateBank');
        const radioExpense = getById('stmtTypeExpense');
        const radioRevenue = getById('stmtTypeRevenue');
        const autoReconcile = getById('stmtCreateAutoReconcile');
        if (hiddenId)
            hiddenId.value = stmt.public_id;
        // Regra estrita de tipo: Despesa vai para Despesa, Receita vai para Receita
        const rawAmount = parseFloat(stmt.amount) || 0;
        const isExpense = stmt.type === 'expense' || stmt.type === 'debit' || (stmt.type !== 'income' && stmt.type !== 'revenue' && rawAmount < 0);
        const initialType = isExpense ? 'expense' : 'revenue';
        if (radioExpense && radioRevenue) {
            radioExpense.checked = isExpense;
            radioRevenue.checked = !isExpense;
        }
        updateModalTypeVisuals(initialType);
        if (dateInput) {
            dateInput.value = stmt.date ? String(stmt.date).split('T')[0] : '';
        }
        if (amountInput) {
            const absVal = Math.abs(rawAmount);
            let formatted = absVal.toFixed(2).replace('.', ',');
            formatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
            amountInput.value = 'R$ ' + formatted;
        }
        if (descInput) {
            descInput.value = stmt.description || '';
        }
        populateCreateModalBanks();
        if (bankSelect) {
            const currentBankId = getById('filterBankSelect')?.value || getById('filterSysBank')?.value || stmt.bank_account_public_id;
            if (currentBankId) {
                bankSelect.value = currentBankId;
            }
            else if (banksData.length > 0) {
                bankSelect.value = banksData[0].public_id;
            }
        }
        populateCreateModalCategories(initialType);
        const paySelect = getById('stmtCreatePaymentMethod');
        if (paySelect) {
            const descLower = (stmt.description || '').toLowerCase();
            if (descLower.includes('pix'))
                paySelect.value = 'pix';
            else if (descLower.includes('ted') || descLower.includes('doc') || descLower.includes('transf'))
                paySelect.value = 'transfer';
            else if (descLower.includes('bol') || descLower.includes('deb'))
                paySelect.value = 'boleto';
            else
                paySelect.value = 'pix';
        }
        const statusSelect = getById('stmtCreateStatus');
        if (statusSelect)
            statusSelect.value = 'paid';
        if (autoReconcile)
            autoReconcile.checked = true;
        if (modal) {
            modal.classList.remove('hidden');
        }
    }
    function closeCreateFromStatementModal() {
        const modal = getById('createFromStatementModal');
        if (modal)
            modal.classList.add('hidden');
        selectedBankStatementForCreate = null;
    }
    function populateQuickCategoryTypeDropdown() {
        const sel = getById('quickCategoryFinanceType');
        if (!sel)
            return;
        sel.innerHTML = '<option value="">Nenhum</option>' +
            categoryTypesData.map((t) => `<option value="${t.public_id}">${t.name}</option>`).join('');
    }
    function openQuickCategoryModal() {
        const isRevenue = getById('stmtTypeRevenue')?.checked;
        const catType = isRevenue ? 'income' : 'expense';
        const typeSelect = getById('quickCategoryType');
        const nameInput = getById('quickCategoryName');
        const finTypeSelect = getById('quickCategoryFinanceType');
        populateQuickCategoryTypeDropdown();
        if (typeSelect)
            typeSelect.value = catType;
        if (finTypeSelect)
            finTypeSelect.value = '';
        if (nameInput) {
            nameInput.value = '';
            setTimeout(() => nameInput.focus(), 50);
        }
        const modal = getById('quickCategoryModal');
        if (modal)
            modal.classList.remove('hidden');
    }
    function closeQuickCategoryModal() {
        const modal = getById('quickCategoryModal');
        if (modal)
            modal.classList.add('hidden');
    }
    // ─── Busca de dados ───────────────────────────────────────────────────────────
    async function fetchStatements() {
        try {
            const [expRes, revRes, bankRes, catRes, catTypeRes] = await Promise.all([
                api('/finance/expenses'),
                api('/finance/revenues'),
                api('/bank-accounts'),
                api('/finance/categories'),
                api('/finance/category-types').catch(() => ({ data: [] })),
            ]);
            banksData = bankRes.data || [];
            categoriesData = catRes.data || [];
            categoryTypesData = catTypeRes?.data || [];
            populateBankFilters();
            populateCreateModalBanks();
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
    // ─── Helpers de data para Período ─────────────────────────────────────────────
    const formatLocalDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    function updateDatesFromPeriod(periodId, startId, endId) {
        const periodEl = getById(periodId);
        const startEl = getById(startId);
        const endEl = getById(endId);
        if (!periodEl || !startEl || !endEl)
            return false;
        const period = periodEl.value;
        if (period === 'custom')
            return false;
        let startVal = '';
        let endVal = '';
        const now = new Date();
        if (period === 'today') {
            const todayStr = formatLocalDate(now);
            startVal = todayStr;
            endVal = todayStr;
        }
        else if (period === 'yesterday') {
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            const yesterdayStr = formatLocalDate(yesterday);
            startVal = yesterdayStr;
            endVal = yesterdayStr;
        }
        else if (period === 'this_month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            startVal = formatLocalDate(start);
            endVal = formatLocalDate(end);
        }
        else if (period === 'last_month') {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0);
            startVal = formatLocalDate(start);
            endVal = formatLocalDate(end);
        }
        else if (period === 'this_year') {
            const start = new Date(now.getFullYear(), 0, 1);
            const end = new Date(now.getFullYear(), 11, 31);
            startVal = formatLocalDate(start);
            endVal = formatLocalDate(end);
        }
        let changed = false;
        if (startEl.value !== startVal) {
            startEl.value = startVal;
            changed = true;
        }
        if (endEl.value !== endVal) {
            endEl.value = endVal;
            changed = true;
        }
        return changed;
    }
    function saveFilters() {
        const sysSelectors = ['filterSysPeriod', 'filterSysStart', 'filterSysEnd', 'filterSysBank', 'filterSysType', 'filterSysStatus', 'filterSysSearch'];
        sysSelectors.forEach((id) => {
            const el = getById(id);
            if (el) {
                if (window.CompanyStorage) {
                    window.CompanyStorage.setItem(`system_statements_filter_${id}`, el.value);
                }
                else {
                    localStorage.setItem(`system_statements_filter_${id}`, el.value);
                }
            }
        });
        const bankSelectors = ['filterBankPeriod', 'filterBankStart', 'filterBankEnd', 'filterBankSelect', 'filterBankType', 'filterBankReconciled', 'filterBankSearch'];
        bankSelectors.forEach((id) => {
            const el = getById(id);
            if (el) {
                if (window.CompanyStorage) {
                    window.CompanyStorage.setItem(`bank_statements_filter_${id}`, el.value);
                }
                else {
                    localStorage.setItem(`bank_statements_filter_${id}`, el.value);
                }
            }
        });
    }
    function restoreFilters() {
        const sysSelectors = ['filterSysPeriod', 'filterSysStart', 'filterSysEnd', 'filterSysBank', 'filterSysType', 'filterSysStatus', 'filterSysSearch'];
        sysSelectors.forEach((id) => {
            const saved = window.CompanyStorage?.getItem(`system_statements_filter_${id}`) ?? localStorage.getItem(`system_statements_filter_${id}`);
            if (saved !== null && saved !== undefined) {
                const el = getById(id);
                if (el)
                    el.value = saved;
            }
        });
        const bankSelectors = ['filterBankPeriod', 'filterBankStart', 'filterBankEnd', 'filterBankSelect', 'filterBankType', 'filterBankReconciled', 'filterBankSearch'];
        bankSelectors.forEach((id) => {
            const saved = window.CompanyStorage?.getItem(`bank_statements_filter_${id}`) ?? localStorage.getItem(`bank_statements_filter_${id}`);
            if (saved !== null && saved !== undefined) {
                const el = getById(id);
                if (el)
                    el.value = saved;
            }
        });
        // Default period for System if not set
        const sysPeriodEl = getById('filterSysPeriod');
        const savedSysPeriod = window.CompanyStorage?.getItem('system_statements_filter_filterSysPeriod') ?? localStorage.getItem('system_statements_filter_filterSysPeriod');
        if (savedSysPeriod === null || savedSysPeriod === undefined) {
            if (sysPeriodEl)
                sysPeriodEl.value = 'this_month';
            updateDatesFromPeriod('filterSysPeriod', 'filterSysStart', 'filterSysEnd');
        }
        else if (savedSysPeriod !== 'custom' && savedSysPeriod !== '') {
            if (sysPeriodEl)
                sysPeriodEl.value = savedSysPeriod;
            updateDatesFromPeriod('filterSysPeriod', 'filterSysStart', 'filterSysEnd');
        }
        // Default period for Bank if not set
        const bankPeriodEl = getById('filterBankPeriod');
        const savedBankPeriod = window.CompanyStorage?.getItem('bank_statements_filter_filterBankPeriod') ?? localStorage.getItem('bank_statements_filter_filterBankPeriod');
        if (savedBankPeriod === null || savedBankPeriod === undefined) {
            if (bankPeriodEl)
                bankPeriodEl.value = 'this_month';
            updateDatesFromPeriod('filterBankPeriod', 'filterBankStart', 'filterBankEnd');
        }
        else if (savedBankPeriod !== 'custom' && savedBankPeriod !== '') {
            if (bankPeriodEl)
                bankPeriodEl.value = savedBankPeriod;
            updateDatesFromPeriod('filterBankPeriod', 'filterBankStart', 'filterBankEnd');
        }
    }
    function setupFilters() {
        // 1. Accordion Sistema ERP
        const SYS_FILTER_STORAGE_KEY = 'system_statements_filter_open';
        const toggleSysFilterBtn = getById('toggleSysFilterBtn');
        const sysFilterBody = getById('sysFilterBody');
        const sysFilterChevron = getById('sysFilterChevron');
        let sysFilterIsOpen = (window.CompanyStorage?.getItem(SYS_FILTER_STORAGE_KEY) ?? localStorage.getItem(SYS_FILTER_STORAGE_KEY)) === 'true';
        if (sysFilterBody && sysFilterChevron) {
            sysFilterBody.style.transition = 'none';
            sysFilterBody.style.maxHeight = sysFilterIsOpen ? `${sysFilterBody.scrollHeight}px` : '0px';
            sysFilterChevron.style.transform = sysFilterIsOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
            requestAnimationFrame(() => {
                sysFilterBody.style.transition = 'max-height 0.3s ease';
            });
            if (toggleSysFilterBtn) {
                toggleSysFilterBtn.addEventListener('click', () => {
                    sysFilterIsOpen = !sysFilterIsOpen;
                    if (window.CompanyStorage) {
                        window.CompanyStorage.setItem(SYS_FILTER_STORAGE_KEY, sysFilterIsOpen ? 'true' : 'false');
                    }
                    else {
                        localStorage.setItem(SYS_FILTER_STORAGE_KEY, sysFilterIsOpen ? 'true' : 'false');
                    }
                    sysFilterBody.style.maxHeight = sysFilterIsOpen ? `${sysFilterBody.scrollHeight}px` : '0px';
                    sysFilterChevron.style.transform = sysFilterIsOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
                });
            }
        }
        // 2. Accordion Extrato do Banco
        const BANK_FILTER_STORAGE_KEY = 'bank_statements_filter_open';
        const toggleBankFilterBtn = getById('toggleBankFilterBtn');
        const bankFilterBody = getById('bankFilterBody');
        const bankFilterChevron = getById('bankFilterChevron');
        let bankFilterIsOpen = (window.CompanyStorage?.getItem(BANK_FILTER_STORAGE_KEY) ?? localStorage.getItem(BANK_FILTER_STORAGE_KEY)) === 'true';
        if (bankFilterBody && bankFilterChevron) {
            bankFilterBody.style.transition = 'none';
            bankFilterBody.style.maxHeight = bankFilterIsOpen ? `${bankFilterBody.scrollHeight}px` : '0px';
            bankFilterChevron.style.transform = bankFilterIsOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
            requestAnimationFrame(() => {
                bankFilterBody.style.transition = 'max-height 0.3s ease';
            });
            if (toggleBankFilterBtn) {
                toggleBankFilterBtn.addEventListener('click', () => {
                    bankFilterIsOpen = !bankFilterIsOpen;
                    if (window.CompanyStorage) {
                        window.CompanyStorage.setItem(BANK_FILTER_STORAGE_KEY, bankFilterIsOpen ? 'true' : 'false');
                    }
                    else {
                        localStorage.setItem(BANK_FILTER_STORAGE_KEY, bankFilterIsOpen ? 'true' : 'false');
                    }
                    bankFilterBody.style.maxHeight = bankFilterIsOpen ? `${bankFilterBody.scrollHeight}px` : '0px';
                    bankFilterChevron.style.transform = bankFilterIsOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
                });
            }
        }
        restoreFilters();
        // Eventos Sistema
        const sysPeriodEl = getById('filterSysPeriod');
        const sysStartEl = getById('filterSysStart');
        const sysEndEl = getById('filterSysEnd');
        if (sysPeriodEl) {
            sysPeriodEl.addEventListener('change', () => {
                updateDatesFromPeriod('filterSysPeriod', 'filterSysStart', 'filterSysEnd');
                saveFilters();
                renderAllSystem();
            });
        }
        if (sysStartEl) {
            sysStartEl.addEventListener('change', () => {
                if (sysPeriodEl && sysPeriodEl.value !== 'custom') {
                    sysPeriodEl.value = 'custom';
                }
                saveFilters();
                renderAllSystem();
            });
        }
        if (sysEndEl) {
            sysEndEl.addEventListener('change', () => {
                if (sysPeriodEl && sysPeriodEl.value !== 'custom') {
                    sysPeriodEl.value = 'custom';
                }
                saveFilters();
                renderAllSystem();
            });
        }
        ['filterSysBank', 'filterSysType', 'filterSysStatus'].forEach((id) => {
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
        const btnClearSys = getById('btnClearSysFilters');
        if (btnClearSys) {
            btnClearSys.addEventListener('click', () => {
                ['filterSysBank', 'filterSysType', 'filterSysStatus', 'filterSysSearch'].forEach((id) => {
                    const el = getById(id);
                    if (el)
                        el.value = '';
                    if (window.CompanyStorage) {
                        window.CompanyStorage.removeItem(`system_statements_filter_${id}`);
                    }
                    else {
                        localStorage.removeItem(`system_statements_filter_${id}`);
                    }
                });
                if (sysPeriodEl)
                    sysPeriodEl.value = 'this_month';
                updateDatesFromPeriod('filterSysPeriod', 'filterSysStart', 'filterSysEnd');
                saveFilters();
                renderAllSystem();
            });
        }
        // Eventos Extrato do Banco
        const bankPeriodEl = getById('filterBankPeriod');
        const bankStartEl = getById('filterBankStart');
        const bankEndEl = getById('filterBankEnd');
        if (bankPeriodEl) {
            bankPeriodEl.addEventListener('change', () => {
                updateDatesFromPeriod('filterBankPeriod', 'filterBankStart', 'filterBankEnd');
                saveFilters();
                void loadBankStatements();
            });
        }
        if (bankStartEl) {
            bankStartEl.addEventListener('change', () => {
                if (bankPeriodEl && bankPeriodEl.value !== 'custom') {
                    bankPeriodEl.value = 'custom';
                }
                saveFilters();
                void loadBankStatements();
            });
        }
        if (bankEndEl) {
            bankEndEl.addEventListener('change', () => {
                if (bankPeriodEl && bankPeriodEl.value !== 'custom') {
                    bankPeriodEl.value = 'custom';
                }
                saveFilters();
                void loadBankStatements();
            });
        }
        getById('filterBankSelect')?.addEventListener('change', () => {
            saveFilters();
            void loadBankStatements();
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
        const btnClearBank = getById('btnClearBankFilters');
        if (btnClearBank) {
            btnClearBank.addEventListener('click', () => {
                ['filterBankType', 'filterBankReconciled', 'filterBankSearch'].forEach((id) => {
                    const el = getById(id);
                    if (el)
                        el.value = '';
                    if (window.CompanyStorage) {
                        window.CompanyStorage.removeItem(`bank_statements_filter_${id}`);
                    }
                    else {
                        localStorage.removeItem(`bank_statements_filter_${id}`);
                    }
                });
                if (bankPeriodEl)
                    bankPeriodEl.value = 'this_month';
                updateDatesFromPeriod('filterBankPeriod', 'filterBankStart', 'filterBankEnd');
                saveFilters();
                void loadBankStatements();
            });
        }
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
            tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum lançamento no extrato para este período/conta.</td></tr>`;
            return;
        }
        tableBody.innerHTML = finalStatements
            .map((t) => {
            const isRevenue = t.type === 'income' || t.type === 'revenue';
            const amountColor = isRevenue ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400';
            const sign = isRevenue ? '+' : '-';
            const isReconciled = t.status === 'reconciled';
            const typeBadge = isRevenue
                ? `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">Receita</span>`
                : `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">Despesa</span>`;
            const rowClass = isReconciled
                ? 'opacity-60 bg-gray-50 dark:bg-slate-800/50'
                : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors';
            const checkboxHtml = isReconciled
                ? `<div class="w-4 h-4 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"><svg class="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg></div>`
                : `<input type="checkbox" class="chk-bank rounded border-gray-300 text-emerald-600 focus:ring-emerald-500/30 dark:bg-slate-700 dark:border-slate-600" data-id="${t.public_id}" data-amount="${t.amount}" data-type="${t.type}">`;
            const actionHtml = isReconciled
                ? `<div class="flex items-center justify-center gap-1.5">
                 <span class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50 shadow-xs" title="Lançamento já Conciliado">
                     <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                 </span>
                 <button type="button" class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 active:bg-red-200 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/60 shadow-xs transition-all btn-unreconcile cursor-pointer group" data-id="${t.public_id}" title="Desfazer conciliação">
                     <svg class="w-3.5 h-3.5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                 </button>
             </div>`
                : `<div class="flex items-center justify-center gap-1.5">
                 <button type="button" class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs transition-all btn-create-from-statement cursor-pointer group" data-id="${t.public_id}" title="Lançar no ERP (Criar ${isRevenue ? 'Receita' : 'Despesa'})">
                     <svg class="w-3.5 h-3.5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
                 </button>
                 <button type="button" class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs transition-all btn-conciliate-single cursor-pointer group" data-id="${t.public_id}" title="Conciliar com lançamento do ERP">
                     <svg class="w-3.5 h-3.5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                 </button>
             </div>`;
            return `
        <tr class="${rowClass}">
            <td class="px-4 py-4 whitespace-nowrap w-12 text-center">
                ${checkboxHtml}
            </td>
            <td class="px-3 py-4 whitespace-nowrap text-[11px] text-gray-500 dark:text-gray-400 font-medium">${formatDate(t.date)}</td>
            <td class="px-3 py-4 whitespace-nowrap">${typeBadge}</td>
            <td class="px-3 py-4 text-xs text-gray-900 dark:text-gray-100 font-medium ${isReconciled ? 'line-through decoration-gray-300 dark:decoration-slate-600' : ''}">${t.description}</td>
            <td class="px-3 py-4 whitespace-nowrap text-right text-xs font-bold ${amountColor}">${sign} ${formatCurrency(t.amount)}</td>
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
            const createBtn = target?.closest?.('.btn-create-from-statement');
            if (createBtn) {
                e.preventDefault();
                e.stopPropagation();
                const public_id = createBtn.dataset.id;
                if (public_id)
                    openCreateFromStatementModal(public_id);
                return;
            }
            const unreconcileBtn = target?.closest?.('.btn-unreconcile');
            if (unreconcileBtn) {
                e.preventDefault();
                e.stopPropagation();
                const public_id = unreconcileBtn.dataset.id;
                if (!confirm('Deseja realmente remover a conciliação deste lançamento?'))
                    return;
                try {
                    unreconcileBtn.disabled = true;
                    unreconcileBtn.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
                    await api('/finance/reconcile/undo', {
                        method: 'POST',
                        body: JSON.stringify({ bank_statement_id: public_id }),
                    });
                    UI.showAlert('alertMessage', 'Conciliação removida com sucesso!', 'success');
                    void fetchStatements();
                    void loadBankStatements();
                }
                catch (err) {
                    unreconcileBtn.disabled = false;
                    unreconcileBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>`;
                    UI.showAlert('alertMessage', err?.message || 'Erro ao desconciliar registro', 'error');
                }
                return;
            }
            const conciliateBtn = target?.closest?.('.btn-conciliate-single');
            if (conciliateBtn) {
                e.preventDefault();
                e.stopPropagation();
                const public_id = conciliateBtn.dataset.id;
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
                            conciliateBtn.disabled = true;
                            conciliateBtn.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
                            await api('/finance/reconcile', {
                                method: 'POST',
                                body: JSON.stringify({ system_ids: [matches[0].public_id], bank_statement_ids: [public_id] }),
                            });
                            UI.showAlert('alertMessage', 'Conciliação realizada com sucesso!', 'success');
                            await fetchStatements();
                            await loadBankStatements();
                        }
                        catch (err) {
                            conciliateBtn.disabled = false;
                            conciliateBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>`;
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
        // Event listeners para o Modal de Lançamento a partir do Extrato
        getById('btnCancelCreateFromStatementModal')?.addEventListener('click', closeCreateFromStatementModal);
        getById('btnCloseCreateFromStatementModal')?.addEventListener('click', closeCreateFromStatementModal);
        getById('createFromStatementModalBackdrop')?.addEventListener('click', closeCreateFromStatementModal);
        // Event listeners para o Modal de Cadastro Rápido de Categoria
        getById('btnOpenQuickCategoryModal')?.addEventListener('click', openQuickCategoryModal);
        getById('btnOpenQuickCategoryModalIcon')?.addEventListener('click', openQuickCategoryModal);
        getById('btnCloseQuickCategoryModal')?.addEventListener('click', closeQuickCategoryModal);
        getById('btnCancelQuickCategoryModal')?.addEventListener('click', closeQuickCategoryModal);
        getById('quickCategoryModalBackdrop')?.addEventListener('click', closeQuickCategoryModal);
        getById('quickCategoryForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = getById('btnSubmitQuickCategory');
            const nameInput = getById('quickCategoryName');
            const typeSelect = getById('quickCategoryType');
            const finTypeSelect = getById('quickCategoryFinanceType');
            const name = nameInput?.value?.trim();
            const type = typeSelect?.value || 'expense';
            const finance_category_type_public_id = finTypeSelect?.value || null;
            if (!name || name.length < 2) {
                UI.showAlert('alertMessage', 'Informe um nome com pelo menos 2 caracteres para a categoria.', 'warning');
                return;
            }
            try {
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<svg class="w-4 h-4 animate-spin inline-block mr-1.5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> <span>Salvando...</span>';
                }
                const res = await api('/finance/categories', {
                    method: 'POST',
                    body: JSON.stringify({ name, type, finance_category_type_public_id }),
                });
                const createdCategory = res?.data;
                // Recarrega lista completa de categorias
                const catRes = await api('/finance/categories');
                categoriesData = catRes.data || [];
                // Atualiza o select de categorias no modal de lançamento
                const isRevenue = getById('stmtTypeRevenue')?.checked;
                const activeType = isRevenue ? 'revenue' : 'expense';
                populateCreateModalCategories(activeType);
                // Seleciona automaticamente a categoria recém criada
                const stmtCatSelect = getById('stmtCreateCategory');
                if (stmtCatSelect && createdCategory?.public_id) {
                    stmtCatSelect.value = createdCategory.public_id;
                }
                UI.showAlert('alertMessage', `Categoria "${name}" cadastrada com sucesso!`, 'success');
                closeQuickCategoryModal();
            }
            catch (err) {
                console.error('Erro ao cadastrar categoria:', err);
                UI.showAlert('alertMessage', err?.message || 'Erro ao cadastrar categoria.', 'error');
            }
            finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> <span>Salvar Categoria</span>';
                }
            }
        });
        getById('stmtTypeExpense')?.addEventListener('change', () => {
            populateCreateModalCategories('expense');
            updateModalTypeVisuals('expense');
        });
        getById('stmtTypeRevenue')?.addEventListener('change', () => {
            populateCreateModalCategories('revenue');
            updateModalTypeVisuals('revenue');
        });
        const stmtAmountInput = getById('stmtCreateAmount');
        if (stmtAmountInput) {
            stmtAmountInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value === '')
                    value = '0';
                let formatted = (parseInt(value, 10) / 100).toFixed(2) + '';
                formatted = formatted.replace('.', ',');
                formatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
                e.target.value = 'R$ ' + formatted;
            });
        }
        getById('createFromStatementForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = getById('btnSubmitCreateFromStatement');
            const isRevenue = getById('stmtTypeRevenue')?.checked;
            const type = isRevenue ? 'revenue' : 'expense';
            const date = getById('stmtCreateDate')?.value;
            const amountStr = getById('stmtCreateAmount')?.value || '0';
            const description = getById('stmtCreateDescription')?.value?.trim();
            const bank_account_public_id = getById('stmtCreateBank')?.value;
            const category_public_id = getById('stmtCreateCategory')?.value;
            const payment_method = getById('stmtCreatePaymentMethod')?.value || null;
            const status = getById('stmtCreateStatus')?.value || 'paid';
            const autoReconcile = getById('stmtCreateAutoReconcile')?.checked;
            const cleanAmount = amountStr.replace(/[^\d,]/g, '').replace(',', '.');
            const amount = parseFloat(cleanAmount);
            if (!date || isNaN(amount) || amount <= 0 || !description || !bank_account_public_id || !category_public_id) {
                UI.showAlert('alertMessage', 'Por favor, preencha todos os campos obrigatórios (Data, Valor, Descrição, Conta e Categoria).', 'warning');
                return;
            }
            try {
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<svg class="w-4 h-4 animate-spin inline-block mr-1.5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> <span>Salvando...</span>';
                }
                let createdTxPublicId = null;
                if (type === 'expense') {
                    const payload = {
                        description,
                        amount,
                        date,
                        bank_account_public_id,
                        category_public_id,
                        payment_method,
                        status,
                    };
                    const res = await api('/finance/expenses', {
                        method: 'POST',
                        body: JSON.stringify(payload),
                    });
                    createdTxPublicId = res?.data?.public_id || null;
                }
                else {
                    const payload = {
                        description,
                        amount,
                        date,
                        received_at: date,
                        bank_account_public_id,
                        category_public_id,
                        payment_method,
                        status,
                    };
                    const res = await api('/finance/revenues', {
                        method: 'POST',
                        body: JSON.stringify(payload),
                    });
                    createdTxPublicId = res?.data?.public_id || null;
                }
                if (autoReconcile && selectedBankStatementForCreate?.public_id && createdTxPublicId) {
                    try {
                        await api('/finance/reconcile', {
                            method: 'POST',
                            body: JSON.stringify({
                                system_ids: [createdTxPublicId],
                                bank_statement_ids: [selectedBankStatementForCreate.public_id],
                            }),
                        });
                        UI.showAlert('alertMessage', 'Lançamento criado e conciliado com o extrato com sucesso!', 'success');
                    }
                    catch (recErr) {
                        console.error('Erro ao conciliar automaticamente:', recErr);
                        UI.showAlert('alertMessage', 'Lançamento criado com sucesso, mas a conciliação automática falhou: ' + (recErr.message || ''), 'warning');
                    }
                }
                else {
                    UI.showAlert('alertMessage', 'Lançamento criado com sucesso no sistema!', 'success');
                }
                closeCreateFromStatementModal();
                await Promise.all([
                    fetchStatements(),
                    loadBankStatements(),
                ]);
            }
            catch (err) {
                console.error('Erro ao criar lançamento a partir do extrato:', err);
                UI.showAlert('alertMessage', err?.message || 'Erro ao criar lançamento no sistema', 'error');
            }
            finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> <span>Salvar e Lançar</span>';
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
