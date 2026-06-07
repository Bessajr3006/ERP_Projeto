(() => {
    const getById = (id) => document.getElementById(id);
    document.addEventListener('DOMContentLoaded', async () => {
        // --- State ---
        let chartOfAccounts = [];
        let entries = [];
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
        let filters = {
            startDate: firstDay,
            endDate: lastDay,
            hideZeros: true,
            onlySynthetic: false,
        };
        // --- Elements ---
        const els = {
            tableBody: getById('balanceteTableBody'),
            loadingOverlay: getById('loadingOverlay'),
            balanceteSection: getById('balanceteSection'),
            filterBody: getById('filterBody'),
            toggleFilterBtn: getById('toggleFilterBtn'),
            filterChevron: getById('filterChevron'),
            filterForm: getById('filterForm'),
            filterStartDate: getById('filterStartDate'),
            filterEndDate: getById('filterEndDate'),
            filterHideZeros: getById('filterHideZeros'),
            filterOnlySynthetic: getById('filterOnlySynthetic'),
            btnClearFilters: getById('btnClearFilters'),
            btnClearFiltersKeepDate: getById('btnClearFiltersKeepDate'),
            footerTotals: getById('footerTotals'),
            footerSumDb: getById('footerSumDb'),
            footerSumCr: getById('footerSumCr'),
            alertMessage: getById('alertMessage'),
        };
        // --- Setup Filter Initial Values ---
        if (els.filterStartDate)
            els.filterStartDate.value = filters.startDate;
        if (els.filterEndDate)
            els.filterEndDate.value = filters.endDate;
        if (els.filterHideZeros)
            els.filterHideZeros.checked = filters.hideZeros;
        if (els.filterOnlySynthetic)
            els.filterOnlySynthetic.checked = filters.onlySynthetic;
        // --- Helpers ---
        const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
        // --- Init ---
        if (typeof Auth !== 'undefined' && !Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }
        setupListeners();
        await loadData();
        // Do not auto-render as per user request to use button
        // --- Data Loaders ---
        async function loadData() {
            try {
                const [accRes, entRes] = await Promise.all([
                    api('/accounting/chart-of-accounts'),
                    api('/accounting/entries'),
                ]);
                chartOfAccounts = accRes?.data || [];
                entries = Array.isArray(entRes) ? entRes : entRes?.data || [];
                if (els.tableBody) {
                    els.tableBody.innerHTML =
                        "<tr><td colspan=\"5\" class=\"px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400\">Clique em 'Gerar Balancete de Verificação' para visualizar os dados.</td></tr>";
                }
                if (els.balanceteSection) {
                    els.balanceteSection.classList.remove('hidden');
                    els.balanceteSection.classList.add('flex');
                }
            }
            catch (e) {
                console.error('Erro loadData', e);
                if (els.alertMessage) {
                    els.alertMessage.textContent = 'Erro ao carregar dados do Balancete.';
                    els.alertMessage.classList.remove('hidden');
                    els.alertMessage.classList.add('bg-red-50', 'text-red-700', 'border-red-200');
                }
            }
        }
        // --- Balancete Processor Logic ---
        function getProcessedBalancete() {
            const accountMap = {};
            chartOfAccounts.forEach((acc) => {
                accountMap[acc.code] = {
                    ...acc,
                    saldoAnteriorDb: 0,
                    saldoAnteriorCr: 0,
                    debitosPeriodo: 0,
                    creditosPeriodo: 0,
                    children_saldoAnteriorDb: 0,
                    children_saldoAnteriorCr: 0,
                    children_debitosPeriodo: 0,
                    children_creditosPeriodo: 0,
                };
            });
            entries.forEach((entry) => {
                const amount = parseFloat(entry.amount) || 0;
                const entryDate = String(entry.entry_date || '').substring(0, 10);
                const isBefore = !!(filters.startDate && entryDate < filters.startDate);
                const isAfter = !!(filters.endDate && entryDate > filters.endDate);
                if (isAfter)
                    return;
                const debitAcc = accountMap[entry.debit_account_code];
                const creditAcc = accountMap[entry.credit_account_code];
                if (isBefore) {
                    if (debitAcc)
                        debitAcc.saldoAnteriorDb += amount;
                    if (creditAcc)
                        creditAcc.saldoAnteriorCr += amount;
                }
                else {
                    if (debitAcc)
                        debitAcc.debitosPeriodo += amount;
                    if (creditAcc)
                        creditAcc.creditosPeriodo += amount;
                }
            });
            // Rollup analíticas -> sintéticas
            const sortedCodesDesc = Object.keys(accountMap).sort().reverse();
            sortedCodesDesc.forEach((code) => {
                const acc = accountMap[code];
                const totalSADb = acc.saldoAnteriorDb + acc.children_saldoAnteriorDb;
                const totalSACr = acc.saldoAnteriorCr + acc.children_saldoAnteriorCr;
                const totalDb = acc.debitosPeriodo + acc.children_debitosPeriodo;
                const totalCr = acc.creditosPeriodo + acc.children_creditosPeriodo;
                let parentCode = null;
                const lastSep = Math.max(code.lastIndexOf('.'), code.lastIndexOf('-'));
                if (lastSep > 0) {
                    parentCode = code.substring(0, lastSep);
                }
                while (parentCode && !accountMap[parentCode] && (parentCode.includes('.') || parentCode.includes('-'))) {
                    const nextSep = Math.max(parentCode.lastIndexOf('.'), parentCode.lastIndexOf('-'));
                    if (nextSep > 0) {
                        parentCode = parentCode.substring(0, nextSep);
                    }
                    else {
                        parentCode = null;
                    }
                }
                if (parentCode && accountMap[parentCode]) {
                    accountMap[parentCode].children_saldoAnteriorDb += totalSADb;
                    accountMap[parentCode].children_saldoAnteriorCr += totalSACr;
                    accountMap[parentCode].children_debitosPeriodo += totalDb;
                    accountMap[parentCode].children_creditosPeriodo += totalCr;
                }
            });
            // Build array
            const rows = [];
            const sortedCodesAsc = Object.keys(accountMap).sort();
            let sumDb = 0;
            let sumCr = 0;
            const getDC = (val) => (val > 0.001 ? '(D)' : val < -0.001 ? '(C)' : '');
            const getDCAbs = (val) => (Math.abs(val) < 0.001 ? '' : getDC(val));
            sortedCodesAsc.forEach((code) => {
                const acc = accountMap[code];
                const isSynthetic = acc.type === 'synthetic';
                const saDb = acc.saldoAnteriorDb + acc.children_saldoAnteriorDb;
                const saCr = acc.saldoAnteriorCr + acc.children_saldoAnteriorCr;
                const saLiquido = saDb - saCr;
                const db = acc.debitosPeriodo + acc.children_debitosPeriodo;
                const cr = acc.creditosPeriodo + acc.children_creditosPeriodo;
                const sfLiquido = saLiquido + db - cr;
                const isZero = saLiquido === 0 && db === 0 && cr === 0 && sfLiquido === 0;
                if (filters.hideZeros && isZero)
                    return;
                if (filters.onlySynthetic && !isSynthetic)
                    return;
                if (!isSynthetic) {
                    sumDb += acc.debitosPeriodo;
                    sumCr += acc.creditosPeriodo;
                }
                const displaySa = formatCurrency(Math.abs(saLiquido)) +
                    ' <span class="text-gray-400 text-[10px] ml-1">' +
                    getDCAbs(saLiquido) +
                    '</span>';
                const displayDb = db > 0 ? formatCurrency(db) : formatCurrency(0);
                const displayCr = cr > 0 ? formatCurrency(cr) : formatCurrency(0);
                const displaySf = formatCurrency(Math.abs(sfLiquido)) +
                    ' <span class="text-gray-400 text-[10px] ml-1">' +
                    getDCAbs(sfLiquido) +
                    '</span>';
                const level = code.split(/[\.\-]/).length - 1;
                rows.push({
                    code: acc.code,
                    name: acc.name,
                    isSynthetic,
                    indent: level * 1.5,
                    displaySa,
                    displayDb,
                    displayCr,
                    displaySf,
                });
            });
            return { rows, totals: { sumDb, sumCr } };
        }
        // --- Render ---
        function renderBalancete() {
            if (els.loadingOverlay) {
                els.loadingOverlay.classList.remove('hidden');
                els.loadingOverlay.classList.add('flex');
            }
            // Timeout para forçar a UI renderizar o loader
            setTimeout(() => {
                const data = getProcessedBalancete();
                const rows = data.rows;
                const totals = data.totals;
                if (rows.length === 0) {
                    if (els.tableBody) {
                        els.tableBody.innerHTML =
                            '<tr><td colspan="5" class="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum dado encontrado para o período / filtros aplicados.</td></tr>';
                    }
                    if (els.footerTotals)
                        els.footerTotals.classList.add('hidden');
                    if (els.loadingOverlay) {
                        els.loadingOverlay.classList.add('hidden');
                        els.loadingOverlay.classList.remove('flex');
                    }
                    return;
                }
                let html = '';
                rows.forEach((row) => {
                    const titleClass = row.isSynthetic ? 'font-bold' : '';
                    const valuesClass = row.isSynthetic ? 'font-bold' : 'font-medium';
                    html += `
                    <tr class="hover:bg-gray-50/50 dark:hover:bg-slate-700/50 transition-colors">
                        <td class="px-3 py-2 text-xs text-gray-900 dark:text-gray-100 ${titleClass}" style="padding-left: ${0.75 + row.indent}rem">
                            ${row.code} - ${row.name}
                        </td>
                        <td class="px-3 py-2 text-right text-xs text-gray-600 dark:text-gray-400 ${valuesClass}">
                            ${row.displaySa}
                        </td>
                        <td class="px-3 py-2 text-right text-xs text-blue-600 dark:text-blue-400 ${valuesClass}">
                            ${row.displayDb}
                        </td>
                        <td class="px-3 py-2 text-right text-xs text-orange-600 dark:text-orange-400 ${valuesClass}">
                            ${row.displayCr}
                        </td>
                        <td class="px-3 py-2 text-right text-xs text-gray-800 dark:text-gray-200 ${valuesClass}">
                            ${row.displaySf}
                        </td>
                    </tr>
                `;
                });
                if (els.tableBody)
                    els.tableBody.innerHTML = html;
                // Render Footer
                if (els.footerTotals) {
                    els.footerTotals.classList.remove('hidden');
                    els.footerTotals.classList.add('flex');
                }
                if (els.footerSumDb)
                    els.footerSumDb.textContent = formatCurrency(totals.sumDb);
                if (els.footerSumCr)
                    els.footerSumCr.textContent = formatCurrency(totals.sumCr);
                if (els.loadingOverlay) {
                    els.loadingOverlay.classList.add('hidden');
                    els.loadingOverlay.classList.remove('flex');
                }
            }, 50);
        }
        // --- Listeners Setup ---
        function setupListeners() {
            els.toggleFilterBtn?.addEventListener('click', () => {
                if (!els.filterBody || !els.filterChevron)
                    return;
                els.filterBody.classList.toggle('collapsed');
                if (els.filterBody.classList.contains('collapsed')) {
                    els.filterChevron.classList.remove('rotate-0');
                    els.filterChevron.classList.add('-rotate-90');
                }
                else {
                    els.filterChevron.classList.add('rotate-0');
                    els.filterChevron.classList.remove('-rotate-90');
                }
            });
            els.filterForm?.addEventListener('submit', (e) => {
                e.preventDefault();
                filters.startDate = els.filterStartDate?.value || '';
                filters.endDate = els.filterEndDate?.value || '';
                filters.hideZeros = !!els.filterHideZeros?.checked;
                filters.onlySynthetic = !!els.filterOnlySynthetic?.checked;
                if (!filters.startDate || !filters.endDate) {
                    alert('Atenção: Para gerar o balancete é altamente recomendável informar Data Início e Fim.');
                }
                renderBalancete();
                // Auto collapse the filter after search to see more of the table
                if (els.filterBody && els.filterChevron) {
                    els.filterBody.classList.add('collapsed');
                    els.filterChevron.classList.remove('rotate-0');
                    els.filterChevron.classList.add('-rotate-90');
                }
            });
            els.btnClearFilters?.addEventListener('click', () => {
                els.filterForm?.reset();
                if (els.filterStartDate)
                    els.filterStartDate.value = '';
                if (els.filterEndDate)
                    els.filterEndDate.value = '';
                if (els.filterHideZeros)
                    els.filterHideZeros.checked = false;
                if (els.filterOnlySynthetic)
                    els.filterOnlySynthetic.checked = false;
                filters = { startDate: '', endDate: '', hideZeros: false, onlySynthetic: false };
                if (els.tableBody) {
                    els.tableBody.innerHTML =
                        "<tr><td colspan=\"5\" class=\"px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400\">Clique em 'Gerar Balancete de Verificação' para visualizar os dados.</td></tr>";
                }
                els.footerTotals?.classList.add('hidden');
            });
            if (els.btnClearFiltersKeepDate) {
                els.btnClearFiltersKeepDate.addEventListener('click', () => {
                    if (els.filterHideZeros)
                        els.filterHideZeros.checked = false;
                    if (els.filterOnlySynthetic)
                        els.filterOnlySynthetic.checked = false;
                    filters = {
                        startDate: els.filterStartDate?.value || '',
                        endDate: els.filterEndDate?.value || '',
                        hideZeros: false,
                        onlySynthetic: false,
                    };
                });
            }
            // View-layer toggles should immediately repaint the datagrid
            [els.filterHideZeros, els.filterOnlySynthetic]
                .filter(Boolean)
                .forEach((chk) => {
                chk.addEventListener('change', () => {
                    filters.hideZeros = !!els.filterHideZeros?.checked;
                    filters.onlySynthetic = !!els.filterOnlySynthetic?.checked;
                    if (els.balanceteSection && !els.balanceteSection.classList.contains('hidden') && chartOfAccounts.length > 0) {
                        renderBalancete();
                    }
                });
            });
            getById('btnPrint')?.addEventListener('click', () => {
                window.print();
            });
        }
    });
})();
