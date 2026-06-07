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
            tableBody: getById('dreTableBody'),
            loadingOverlay: getById('loadingOverlay'),
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
            footerIconBg: getById('footerIconBg'),
            footerIcon: getById('footerIcon'),
            footerTitle: getById('footerTitle'),
            footerValue: getById('footerValue'),
            footerAv: getById('footerAv'),
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
        // --- Data Loaders ---
        async function loadData() {
            if (els.loadingOverlay) {
                els.loadingOverlay.classList.remove('hidden');
                els.loadingOverlay.classList.add('flex');
            }
            try {
                const [accRes, entRes] = await Promise.all([
                    api('/accounting/chart-of-accounts'),
                    api('/accounting/entries'),
                ]);
                chartOfAccounts = accRes?.data || [];
                entries = Array.isArray(entRes) ? entRes : entRes?.data || [];
                renderDRE();
            }
            catch (e) {
                console.error('Erro loadData', e);
                if (els.alertMessage) {
                    els.alertMessage.textContent = 'Erro ao carregar dados da DRE.';
                    els.alertMessage.classList.remove('hidden');
                    els.alertMessage.classList.add('bg-red-50', 'text-red-700', 'border-red-200');
                }
            }
            finally {
                if (els.loadingOverlay) {
                    els.loadingOverlay.classList.add('hidden');
                    els.loadingOverlay.classList.remove('flex');
                }
            }
        }
        // --- DRE Processor Logic ---
        function getProcessedDRE() {
            let filteredEntries = entries;
            if (filters.startDate) {
                filteredEntries = filteredEntries.filter((e) => String(e?.entry_date || '').substring(0, 10) >= filters.startDate);
            }
            if (filters.endDate) {
                filteredEntries = filteredEntries.filter((e) => String(e?.entry_date || '').substring(0, 10) <= filters.endDate);
            }
            const accountMap = {};
            chartOfAccounts.forEach((acc) => {
                if (acc.code?.startsWith('3') || acc.code?.startsWith('4') || acc.code?.startsWith('5')) {
                    accountMap[acc.code] = { ...acc, balance: 0, children_total: 0 };
                }
            });
            filteredEntries.forEach((entry) => {
                const amount = parseFloat(entry.amount) || 0;
                if (accountMap[entry.debit_account_code])
                    accountMap[entry.debit_account_code].balance += amount;
                if (accountMap[entry.credit_account_code])
                    accountMap[entry.credit_account_code].balance -= amount;
            });
            // Rollup
            const sortedCodesDesc = Object.keys(accountMap).sort().reverse();
            sortedCodesDesc.forEach((code) => {
                const acc = accountMap[code];
                const accTotal = acc.balance + acc.children_total;
                let parentCode = null;
                const lastSep = Math.max(code.lastIndexOf('.'), code.lastIndexOf('-'));
                if (lastSep > 0)
                    parentCode = code.substring(0, lastSep);
                while (parentCode && !accountMap[parentCode] && (parentCode.includes('.') || parentCode.includes('-'))) {
                    const nextSep = Math.max(parentCode.lastIndexOf('.'), parentCode.lastIndexOf('-'));
                    if (nextSep > 0)
                        parentCode = parentCode.substring(0, nextSep);
                    else
                        parentCode = null;
                }
                if (parentCode && accountMap[parentCode]) {
                    accountMap[parentCode].children_total += accTotal;
                }
            });
            const rootReceita = accountMap['3'];
            const totalReceitasBrutas = rootReceita ? Math.abs(rootReceita.balance + rootReceita.children_total) : 0;
            const rows = [];
            const sortedCodesAsc = Object.keys(accountMap).sort();
            sortedCodesAsc.forEach((code) => {
                const acc = accountMap[code];
                const rawBalance = acc.balance + acc.children_total;
                const isSynthetic = acc.type === 'synthetic';
                if (filters.hideZeros && rawBalance === 0)
                    return;
                if (filters.onlySynthetic && !isSynthetic)
                    return;
                let displayValue = 0;
                let cssClass = '';
                if (code.startsWith('3')) {
                    displayValue = rawBalance * -1;
                    cssClass = 'text-green-600 dark:text-green-400';
                }
                else if (code.startsWith('4') || code.startsWith('5')) {
                    displayValue = rawBalance;
                    cssClass = 'text-red-600 dark:text-red-400';
                }
                if (displayValue === 0)
                    cssClass = 'text-gray-900 dark:text-gray-100';
                const level = code.split(/[\.\-]/).length - 1;
                const av = totalReceitasBrutas > 0 ? (displayValue / totalReceitasBrutas) * 100 : 0;
                const showValue = filters.onlySynthetic ? true : !isSynthetic;
                rows.push({
                    code: acc.code,
                    name: acc.name,
                    isSynthetic,
                    displayValue,
                    av,
                    indent: level * 1.5,
                    cssClass,
                    showValue,
                });
            });
            let totalRaw = 0;
            ['3', '4', '5'].forEach((rootCode) => {
                if (accountMap[rootCode]) {
                    totalRaw += accountMap[rootCode].balance + accountMap[rootCode].children_total;
                }
            });
            const resultadoFinal = totalRaw * -1;
            const isProfit = resultadoFinal >= 0;
            return { rows, totals: { totalReceitasBrutas, resultadoFinal, isProfit } };
        }
        // --- Render ---
        function renderDRE() {
            const data = getProcessedDRE();
            const rows = data.rows;
            const totals = data.totals;
            if (rows.length === 0) {
                if (els.tableBody) {
                    els.tableBody.innerHTML =
                        '<tr><td colspan="3" class="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum dado encontrado para o período / filtros aplicados.</td></tr>';
                }
                els.footerTotals?.classList.add('hidden');
                return;
            }
            let html = '';
            rows.forEach((row) => {
                const rowClass = row.isSynthetic ? 'font-bold' : 'font-medium';
                const showValueStr = row.showValue ? formatCurrency(row.displayValue) : '';
                const avStr = row.showValue ? row.av.toFixed(1) + '%' : '';
                html += `
                <tr class="hover:bg-gray-50/50 dark:hover:bg-slate-700/50 transition-colors">
                    <td class="px-3 py-2 text-xs text-gray-900 dark:text-gray-100 ${rowClass}" style="padding-left: ${0.75 + row.indent}rem">
                        ${row.code} - ${row.name}
                    </td>
                    <td class="px-3 py-2 text-right text-xs ${rowClass} ${row.cssClass}">
                        ${showValueStr}
                    </td>
                    <td class="px-3 py-2 text-right text-xs text-gray-500 dark:text-gray-400 ${row.isSynthetic ? 'font-bold' : ''}">
                        ${avStr}
                    </td>
                </tr>
            `;
            });
            if (els.tableBody)
                els.tableBody.innerHTML = html;
            // Render Footer
            els.footerTotals?.classList.remove('hidden');
            els.footerTotals?.classList.add('flex');
            if (els.footerIconBg) {
                els.footerIconBg.className = totals.isProfit
                    ? 'bg-green-100 dark:bg-green-900/30 p-2 rounded-lg'
                    : 'bg-red-100 dark:bg-red-900/30 p-2 rounded-lg';
            }
            if (els.footerIcon) {
                els.footerIcon.className = totals.isProfit
                    ? 'text-green-600 dark:text-green-400 h-6 w-6'
                    : 'text-red-600 dark:text-red-400 h-6 w-6';
            }
            if (els.footerTitle) {
                els.footerTitle.className = totals.isProfit
                    ? 'text-[11px] font-semibold uppercase tracking-wider text-green-600 dark:text-green-400'
                    : 'text-[11px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400';
                els.footerTitle.textContent = totals.isProfit ? 'Lucro Líquido Apurado' : 'Prejuízo Líquido Apurado';
            }
            if (els.footerValue) {
                els.footerValue.className = totals.isProfit
                    ? 'block text-xl font-black text-green-600 dark:text-green-400'
                    : 'block text-xl font-black text-red-600 dark:text-red-400';
                els.footerValue.textContent = formatCurrency(Math.abs(totals.resultadoFinal));
            }
            const avTotal = totals.totalReceitasBrutas > 0
                ? ((Math.abs(totals.resultadoFinal) / totals.totalReceitasBrutas) * 100).toFixed(1) + '%'
                : '0.0%';
            if (els.footerAv)
                els.footerAv.textContent = avTotal;
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
                renderDRE();
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
                renderDRE();
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
                    renderDRE();
                });
            }
            // View-layer toggles should immediately repaint the datagrid
            [els.filterHideZeros, els.filterOnlySynthetic]
                .filter(Boolean)
                .forEach((chk) => {
                chk.addEventListener('change', () => {
                    filters.hideZeros = !!els.filterHideZeros?.checked;
                    filters.onlySynthetic = !!els.filterOnlySynthetic?.checked;
                    if (chartOfAccounts.length > 0) {
                        renderDRE();
                    }
                });
            });
            getById('btnPrint')?.addEventListener('click', () => {
                window.print();
            });
        }
    });
})();
