(() => {
    const getById = (id) => document.getElementById(id);
    document.addEventListener('DOMContentLoaded', async () => {
        const Formatters = {
            formatCurrency: (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value),
        };
        const filterEndDate = getById('filterEndDate');
        const btnApplyFilter = getById('btnApplyFilter');
        const chkHideZero = getById('chkHideZero');
        const chkOnlySynthetic = getById('chkOnlySynthetic');
        const balancoTableBody = getById('balancoTableBody');
        const balancoTableFooter = getById('balancoTableFooter');
        const today = new Date().toISOString().split('T')[0];
        if (filterEndDate)
            filterEndDate.value = today;
        let chartOfAccounts = [];
        let entries = [];
        const showLoading = () => {
            const overlay = getById('loading-overlay');
            overlay?.classList.remove('hidden');
            overlay?.classList.add('flex');
        };
        const hideLoading = () => {
            const overlay = getById('loading-overlay');
            overlay?.classList.add('hidden');
            overlay?.classList.remove('flex');
        };
        const generateBalanco = () => {
            const endDate = filterEndDate?.value;
            const accountMap = {};
            chartOfAccounts.forEach((acc) => {
                if (acc.code?.startsWith('1') || acc.code?.startsWith('2')) {
                    accountMap[acc.code] = {
                        ...acc,
                        balance: 0,
                        children_total: 0,
                    };
                }
            });
            entries.forEach((entry) => {
                if (endDate && String(entry.entry_date || '').substring(0, 10) > endDate) {
                    return;
                }
                const amount = parseFloat(entry.amount) || 0;
                const debitAcc = accountMap[entry.debit_account_code];
                const creditAcc = accountMap[entry.credit_account_code];
                if (debitAcc && debitAcc.code?.startsWith('1'))
                    debitAcc.balance += amount;
                if (creditAcc && creditAcc.code?.startsWith('1'))
                    creditAcc.balance -= amount;
                if (creditAcc && creditAcc.code?.startsWith('2'))
                    creditAcc.balance += amount;
                if (debitAcc && debitAcc.code?.startsWith('2'))
                    debitAcc.balance -= amount;
            });
            const sortedCodes = Object.keys(accountMap).sort().reverse();
            sortedCodes.forEach((code) => {
                const acc = accountMap[code];
                const accTotal = acc.balance + acc.children_total;
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
                    accountMap[parentCode].children_total += accTotal;
                }
            });
            const rows = [];
            const totalAtivo = accountMap['1'] ? accountMap['1'].balance + accountMap['1'].children_total : 0;
            const totalPassivo = accountMap['2'] ? accountMap['2'].balance + accountMap['2'].children_total : 0;
            const codesToRender = Object.keys(accountMap).sort();
            const hideZero = chkHideZero ? chkHideZero.checked : true;
            const onlySynthetic = chkOnlySynthetic ? chkOnlySynthetic.checked : false;
            codesToRender.forEach((code) => {
                const acc = accountMap[code];
                const rawBalance = acc.balance + acc.children_total;
                const isSynthetic = acc.type === 'synthetic';
                if (hideZero && Math.abs(rawBalance) < 0.001)
                    return;
                if (onlySynthetic && !isSynthetic)
                    return;
                let showValue = false;
                if (onlySynthetic) {
                    showValue = true;
                }
                else {
                    showValue = !isSynthetic;
                }
                let cssClass = '';
                if (code.startsWith('1'))
                    cssClass = 'text-blue-600 dark:text-blue-400';
                else
                    cssClass = 'text-indigo-600 dark:text-indigo-400';
                const displayValue = showValue ? Formatters.formatCurrency(rawBalance) : '';
                let av = 0;
                if (code.startsWith('1') && totalAtivo > 0)
                    av = (rawBalance / totalAtivo) * 100;
                if (code.startsWith('2') && totalPassivo > 0)
                    av = (rawBalance / totalPassivo) * 100;
                const displayAv = showValue ? av.toFixed(1) + '%' : '';
                const level = code.split(/[\.\-]/).length - 1;
                const indent = level * 1.5;
                rows.push(`
          <tr class="hover:bg-gray-50/50 dark:hover:bg-slate-700/50 transition-colors">
              <td class="px-3 py-2 text-xs text-gray-900 dark:text-gray-100 ${isSynthetic ? 'font-bold' : ''}" style="padding-left: ${0.75 + indent}rem">
                  ${acc.code} - ${acc.name}
              </td>
              <td class="px-3 py-2 text-right text-xs ${isSynthetic ? 'font-bold' : 'font-medium'} ${cssClass}">
                  ${displayValue}
              </td>
              <td class="px-3 py-2 text-right text-xs text-gray-500 dark:text-gray-400 ${isSynthetic ? 'font-bold' : ''}">
                  ${displayAv}
              </td>
          </tr>
        `);
            });
            if (rows.length === 0) {
                if (balancoTableBody) {
                    balancoTableBody.innerHTML =
                        '<tr><td colspan="3" class="px-3 py-4 text-center text-gray-500 font-medium">Nenhum dado encontrado para o período.</td></tr>';
                }
                if (balancoTableFooter)
                    balancoTableFooter.className = 'hidden';
                return;
            }
            if (balancoTableBody)
                balancoTableBody.innerHTML = rows.join('');
            const resultadoExercicio = totalAtivo - totalPassivo;
            const totalPassivoEB = totalPassivo + resultadoExercicio;
            let diffAlertHtml = '';
            if (Math.abs(resultadoExercicio) > 0.01) {
                const isLucro = resultadoExercicio > 0;
                diffAlertHtml = `
          <div class="mt-4 p-3 bg-${isLucro ? 'green' : 'orange'}-100 dark:bg-${isLucro ? 'green' : 'orange'}-900/30 rounded-lg flex flex-wrap items-center justify-between">
              <span class="text-xs font-semibold text-${isLucro ? 'green' : 'orange'}-800 dark:text-${isLucro ? 'green' : 'orange'}-300">
                  Resultado Acumulado (DRE) não encerrado no Passivo
              </span>
              <span class="text-sm font-bold text-${isLucro ? 'green' : 'orange'}-600 dark:text-${isLucro ? 'green' : 'orange'}-400">
                  ${Formatters.formatCurrency(resultadoExercicio)}
              </span>
          </div>
        `;
            }
            if (balancoTableFooter) {
                balancoTableFooter.innerHTML = `
          <div class="flex flex-col gap-2 w-full">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div class="flex items-center gap-3">
                      <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <svg class="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                          </svg>
                      </div>
                      <div class="flex flex-col">
                          <span class="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Balanço Consolidado</span>
                          <span class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ativos x Passivos & PL</span>
                      </div>
                  </div>

                  <div class="flex gap-4 sm:gap-8 items-center justify-end w-full sm:w-auto">
                      <div class="text-right">
                          <span class="block text-[10px] font-bold uppercase tracking-wider text-gray-500">Total do Ativo</span>
                          <span class="block text-xl font-black text-blue-600 dark:text-blue-400">${Formatters.formatCurrency(totalAtivo)}</span>
                      </div>
                      <div class="text-right pr-2">
                          <span class="block text-[10px] font-bold uppercase tracking-wider text-gray-500">Passivo + PL</span>
                          <span class="block text-xl font-black text-indigo-600 dark:text-indigo-400">${Formatters.formatCurrency(totalPassivoEB)}</span>
                      </div>
                  </div>
              </div>
              ${diffAlertHtml}
          </div>
        `;
                balancoTableFooter.className =
                    'shrink-0 bg-white dark:bg-slate-800 border border-t-0 border-gray-200 dark:border-slate-700 px-6 py-4 rounded-b-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between transition-colors';
            }
        };
        const loadData = async () => {
            showLoading();
            try {
                const [accRes, entRes] = await Promise.all([
                    api('/accounting/chart-of-accounts'),
                    api('/accounting/entries'),
                ]);
                chartOfAccounts = accRes.data || [];
                entries = Array.isArray(entRes) ? entRes : entRes.data || [];
                generateBalanco();
            }
            catch (err) {
                console.error(err);
                if (balancoTableBody) {
                    balancoTableBody.innerHTML =
                        '<tr><td colspan="3" class="px-3 py-4 text-center text-red-500 font-medium">Erro ao carregar dados do Balanço.</td></tr>';
                }
            }
            finally {
                hideLoading();
            }
        };
        btnApplyFilter?.addEventListener('click', generateBalanco);
        chkHideZero?.addEventListener('change', generateBalanco);
        chkOnlySynthetic?.addEventListener('change', generateBalanco);
        await loadData();
    });
})();
