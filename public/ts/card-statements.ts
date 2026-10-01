// @ts-nocheck
(() => {
  // ─── State Management ────────────────────────────────────────────────────────
  let systemTransactions: any[] = [];
  let cardStatements: any[] = [];

  const getById = (id: string): any => document.getElementById(id);
  const FilterPanel: any = (window as any).FilterPanel;

  // ─── Formatter Helpers ────────────────────────────────────────────────────────
  const formatCurrency = (v: any): string =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const formatDate = (iso: any): string => {
    if (!iso) return '';
    const [y, m, d] = String(iso).split('T')[0].split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('pt-BR');
  };

  const paymentLabel = (method: string): string => {
    const map: Record<string, string> = {
      credit: 'C. Crédito',
      debit: 'C. Débito',
      pix: 'Pix',
      cash: 'Dinheiro',
      transfer: 'Transferência',
      boleto: 'Boleto'
    };
    return map[String(method).toLowerCase()] || method;
  };

  // ─── Filter Panel Implementation ─────────────────────────────────────────────
  function setupFilters(): void {
    if (!FilterPanel) return;

    FilterPanel.mount({
      storageKey: 'card_statements_filters',
      fields: [
        { id: 'filterStart', label: 'Data Início', type: 'date' },
        { id: 'filterEnd', label: 'Data Fim', type: 'date' },
        {
          id: 'filterType',
          label: 'Tipo',
          type: 'select',
          options: [
            { value: '', label: 'Todos' },
            { value: 'income', label: 'Entradas' },
            { value: 'expense', label: 'Saídas' },
          ],
        },
        {
          id: 'filterApplyTo',
          label: 'Aplicar em:',
          type: 'select',
          options: [
            { value: 'both', label: 'Sistema + Extrato' },
            { value: 'system', label: 'Apenas Sistema' },
            { value: 'bank', label: 'Apenas Extrato' },
          ],
        },
        { id: 'filterSearch', label: 'Busca', type: 'text', placeholder: 'Descrição ou conta' },
      ],
      gridClass: 'grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3 items-end',
    });

    restoreFilters();

    // Default period setup if empty
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const start = `${y}-${m}-01`;
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    const end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;

    const startEl = getById('filterStart');
    const endEl = getById('filterEnd');
    if (startEl && !startEl.value) startEl.value = start;
    if (endEl && !endEl.value) endEl.value = end;

    // Listen to changes
    ['filterStart', 'filterEnd', 'filterType', 'filterApplyTo'].forEach((id) => {
      getById(id)?.addEventListener('change', () => {
        saveFilters();
        renderAll();
      });
    });

    let searchDebounceTimer: any = null;
    getById('filterSearch')?.addEventListener('input', () => {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        saveFilters();
        renderAll();
      }, 300);
    });

    // Clear filters event
    const clearBtn = getById('card_statements_filters-filter-panel-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        setTimeout(() => {
          if (startEl) startEl.value = start;
          if (endEl) endEl.value = end;
          saveFilters();
          renderAll();
        }, 50);
      });
    }
  }

  function saveFilters(): void {
    const values = {
      filterStart: getById('filterStart')?.value || '',
      filterEnd: getById('filterEnd')?.value || '',
      filterType: getById('filterType')?.value || '',
      filterApplyTo: getById('filterApplyTo')?.value || 'both',
      filterSearch: getById('filterSearch')?.value || '',
    };
    localStorage.setItem('card_statements_filters_values', JSON.stringify(values));
  }

  function restoreFilters(): void {
    const saved = localStorage.getItem('card_statements_filters_values');
    if (!saved) return;
    try {
      const filters = JSON.parse(saved);
      if (getById('filterStart')) getById('filterStart').value = filters.filterStart || '';
      if (getById('filterEnd')) getById('filterEnd').value = filters.filterEnd || '';
      if (getById('filterType')) getById('filterType').value = filters.filterType || '';
      if (getById('filterApplyTo')) getById('filterApplyTo').value = filters.filterApplyTo || 'both';
      if (getById('filterSearch')) getById('filterSearch').value = filters.filterSearch || '';
    } catch (e) {
      console.error('Erro ao restaurar filtros:', e);
    }
  }

  // ─── Filter Calculations ─────────────────────────────────────────────────────
  function getFilteredSystemTransactions(): any[] {
    const startFilter = getById('filterStart')?.value || '';
    const endFilter = getById('filterEnd')?.value || '';
    const typeFilter = getById('filterType')?.value || '';
    const applyTo = getById('filterApplyTo')?.value || 'both';
    const searchFilter = getById('filterSearch')?.value || '';

    return systemTransactions.filter((t: any) => {
      // Filter by type
      if (typeFilter && t.type !== typeFilter) return false;

      // Filter by date
      if (applyTo === 'both' || applyTo === 'system') {
        if (startFilter || endFilter) {
          const tDate = t.date ? String(t.date).split('T')[0] : '';
          if (startFilter && tDate < startFilter) return false;
          if (endFilter && tDate > endFilter) return false;
        }
      }

      // Filter by search
      if ((applyTo === 'both' || applyTo === 'system') && searchFilter) {
        const query = searchFilter.toLowerCase().trim();
        const desc = String(t.description || '').toLowerCase();
        const bankName = String(t.bank_account_name || '').toLowerCase();
        const cat = String(t.category_name || '').toLowerCase();
        if (!desc.includes(query) && !bankName.includes(query) && !cat.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }

  function getFilteredCardStatements(): any[] {
    const startFilter = getById('filterStart')?.value || '';
    const endFilter = getById('filterEnd')?.value || '';
    const typeFilter = getById('filterType')?.value || '';
    const applyTo = getById('filterApplyTo')?.value || 'both';
    const searchFilter = getById('filterSearch')?.value || '';

    return cardStatements.filter((t: any) => {
      // Filter by type
      if (typeFilter && t.type !== typeFilter) return false;

      // Filter by date
      if (applyTo === 'both' || applyTo === 'bank') {
        if (startFilter || endFilter) {
          const tDate = t.date ? String(t.date).split('T')[0] : '';
          if (startFilter && tDate < startFilter) return false;
          if (endFilter && tDate > endFilter) return false;
        }
      }

      // Filter by search
      if ((applyTo === 'both' || applyTo === 'bank') && searchFilter) {
        const query = searchFilter.toLowerCase().trim();
        const desc = String(t.description || '').toLowerCase();
        if (!desc.includes(query)) return false;
      }

      return true;
    });
  }

  // ─── Render All Lists ────────────────────────────────────────────────────────
  function renderAll(): void {
    renderSystemTable();
    renderCardTable();
    updateConciliationBar();
  }

  // ─── Conciliation Bar Calculation & Update ──────────────────────────────────
  function updateConciliationBar(): void {
    const sysChecked = document.querySelectorAll('.chk-system:checked').length;
    const cardChecked = document.querySelectorAll('.chk-card:checked').length;

    const bar = getById('conciliationActionBar');
    const btn = getById('btnConciliate');
    if (!bar || !btn) return;

    if (sysChecked > 0 || cardChecked > 0) {
      bar.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
      bar.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
    } else {
      bar.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
      bar.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
    }

    const sysCount = getById('concilSystemCount');
    const cardCount = getById('concilCardCount');
    if (sysCount) sysCount.textContent = `${sysChecked} ERP`;
    if (cardCount) cardCount.textContent = `${cardChecked} Cartão`;

    getById('concilSystemDotActive')?.classList.toggle('hidden', sysChecked === 0);
    getById('concilSystemDotInactive')?.classList.toggle('hidden', sysChecked > 0);
    getById('concilCardDotActive')?.classList.toggle('hidden', cardChecked === 0);
    getById('concilCardDotInactive')?.classList.toggle('hidden', cardChecked > 0);

    let sysSum = 0;
    document.querySelectorAll('.chk-system:checked').forEach((chk: any) => {
      const amt = parseFloat(chk.dataset.amount) || 0;
      const type = chk.dataset.type;
      sysSum += type === 'revenue' || type === 'income' ? amt : -amt;
    });

    let cardSum = 0;
    document.querySelectorAll('.chk-card:checked').forEach((chk: any) => {
      const amt = parseFloat(chk.dataset.amount) || 0;
      const type = chk.dataset.type;
      cardSum += type === 'revenue' || type === 'income' ? amt : -amt;
    });

    const diff = Math.abs(sysSum - cardSum);
    const isValid = sysChecked > 0 && cardChecked > 0 && diff < 0.01;

    btn.disabled = !isValid;

    if (!isValid && sysChecked > 0 && cardChecked > 0) {
      btn.innerHTML = `<svg class="w-4 h-4 text-amber-300 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg> 
                         Diferença: ${formatCurrency(diff)}`;
      btn.className = "flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-semibold rounded-full shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 cursor-pointer";
    } else {
      btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg> 
                         Conciliar Selecionados`;
      btn.className = "flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-full shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 cursor-pointer";
    }
  }

  // ─── Render: Left Table (ERP Transactions) ──────────────────────────────────
  function renderSystemTable(): void {
    const tbody = getById('statementsTable');
    if (!tbody) return;

    const filtered = getFilteredSystemTransactions();

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum lançamento de cartão encontrado no sistema.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map((t: any) => {
        const isRevenue = t.type === 'income';
        const valueClass = isRevenue ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400';
        const sign = isRevenue ? '+' : '-';

        const typeBadge = isRevenue
          ? `<span class="px-2 inline-flex text-[10px] leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">Entrada</span>`
          : `<span class="px-2 inline-flex text-[10px] leading-5 font-semibold rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">Saída</span>`;

        const isReconciled = t.status === 'paid';
        const checkboxHtml = isReconciled
          ? `<div class="w-4 h-4 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"><svg class="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg></div>`
          : `<input type="checkbox" class="chk-system rounded border-gray-300 text-brand-600 focus:ring-brand-500/30 dark:bg-slate-700 dark:border-slate-600" data-id="${t.public_id}" data-amount="${t.amount}" data-type="${t.type}">`;

        return `
        <tr class="${isReconciled ? 'opacity-60 bg-gray-50 dark:bg-slate-800/50' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors'}">
            <td class="px-3 py-4 whitespace-nowrap w-12 text-center">
                ${checkboxHtml}
            </td>
            <td class="px-3 py-4 whitespace-nowrap text-[11px] font-medium text-gray-500 dark:text-gray-400">${formatDate(t.date)}</td>
            <td class="px-3 py-4 whitespace-nowrap">${typeBadge}</td>
            <td class="px-3 py-4 text-xs text-gray-900 dark:text-gray-100 font-medium">
                <div>${t.description}</div>
                <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                    ${t.category_name ? `<span class="mr-2">${t.category_name}</span>` : ''}
                    <span class="text-gray-400 dark:text-gray-500">· ${paymentLabel(t.payment_method)}</span>
                </div>
            </td>
            <td class="px-3 py-4 whitespace-nowrap text-[11px] text-gray-500 dark:text-gray-400">
                <div>${t.bank_account_name || '-'}</div>
            </td>
            <td class="px-3 py-4 whitespace-nowrap text-right text-xs font-bold ${valueClass}">${sign} ${formatCurrency(t.amount)}</td>
        </tr>`;
      })
      .join('');

    // Bind system checkbox event listeners
    document.querySelectorAll('.chk-system').forEach(chk => {
      chk.addEventListener('change', updateConciliationBar);
    });

    // Summary calculation
    const totalIn = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
    const totalOut = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
    const balance = totalIn - totalOut;

    getById('footerCount').textContent = filtered.length;
    getById('footerTotalIn').textContent = formatCurrency(totalIn);
    getById('footerTotalOut').textContent = formatCurrency(totalOut);
    
    const balEl = getById('footerBalance');
    balEl.textContent = formatCurrency(balance);
    balEl.className = balance >= 0 
      ? 'mt-0.5 block text-xs font-bold text-emerald-600 dark:text-emerald-400'
      : 'mt-0.5 block text-xs font-bold text-red-600 dark:text-red-400';
  }

  // ─── Render: Right Table (Card Statement) ──────────────────────────────────
  function renderCardTable(): void {
    const tbody = getById('cardStatementsTable');
    const tableEl = tbody?.closest('table');
    const emptyState = getById('cardStatementsEmptyState');
    if (!tbody || !emptyState || !tableEl) return;

    const filtered = getFilteredCardStatements();

    if (cardStatements.length === 0) {
      emptyState.classList.remove('hidden');
      tableEl.classList.add('opacity-30', 'select-none', 'pointer-events-none');
      tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-gray-400 dark:text-gray-500">Nenhum lançamento no extrato.</td></tr>`;
      return;
    }

    emptyState.classList.add('hidden');
    tableEl.classList.remove('opacity-30', 'select-none', 'pointer-events-none');

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum lançamento encontrado para os filtros selecionados.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map((t: any) => {
        const isRevenue = t.type === 'income';
        const amountColor = isRevenue ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400';
        const sign = isRevenue ? '+' : '-';
        const isReconciled = t.status === 'reconciled';

        const rowClass = isReconciled
          ? 'opacity-60 bg-gray-50 dark:bg-slate-800/50'
          : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors';

        const checkboxHtml = isReconciled
          ? `<div class="w-4 h-4 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"><svg class="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg></div>`
          : `<input type="checkbox" class="chk-card rounded border-gray-300 text-emerald-600 focus:ring-emerald-500/30 dark:bg-slate-700 dark:border-slate-600" data-id="${t.public_id}" data-amount="${t.amount}" data-type="${t.type}">`;

        const actionHtml = isReconciled
          ? `<div class="flex flex-col items-center gap-1">
                 <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 gap-1"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Conciliado</span>
                 <button class="text-[9px] text-red-500 hover:text-red-700 underline underline-offset-2 transition-colors btn-unreconcile cursor-pointer" data-id="${t.public_id}">Desconciliar</button>
               </div>`
          : `<button class="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded font-bold hover:bg-emerald-100 transition-colors dark:bg-emerald-900/30 dark:text-emerald-400 btn-conciliate-single cursor-pointer" data-id="${t.public_id}">Conciliar</button>`;

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

    // Bind card checkbox event listeners
    document.querySelectorAll('.chk-card').forEach(chk => {
      chk.addEventListener('change', updateConciliationBar);
    });

    // Bind unreconcile button event listeners
    document.querySelectorAll('.btn-unreconcile').forEach(btn => {
      btn.addEventListener('click', async (e: any) => {
        const stmtId = e.currentTarget.dataset.id;
        if (confirm('Deseja desfazer a conciliação deste lançamento?')) {
          try {
            await api('/finance/card-reconcile/undo', {
              method: 'POST',
              body: JSON.stringify({ card_statement_id: stmtId })
            });
            UI.showAlert('alertMessage', 'Conciliação desfeita com sucesso!', 'success');
            await loadData();
          } catch (err: any) {
            UI.showAlert('alertMessage', err?.message || 'Falha ao desconciliar.', 'error');
          }
        }
      });
    });

    // Bind single conciliate button event listeners
    document.querySelectorAll('.btn-conciliate-single').forEach(btn => {
      btn.addEventListener('click', async (e: any) => {
        const stmtId = e.currentTarget.dataset.id;
        const stmt = cardStatements.find(s => s.public_id === stmtId);
        if (!stmt) return;

        // Try to find a system transaction with matching amount and date close enough, or just let them pick
        const matched = systemTransactions.filter(t => t.status === 'pending' && Math.abs(Number(t.amount) - Number(stmt.amount)) < 0.01);
        if (matched.length === 1) {
          if (confirm(`Conciliar com o lançamento de ERP "${matched[0].description}" de valor ${formatCurrency(matched[0].amount)}?`)) {
            try {
              await api('/finance/card-reconcile', {
                method: 'POST',
                body: JSON.stringify({
                  system_ids: [matched[0].public_id],
                  card_statement_ids: [stmtId]
                })
              });
              UI.showAlert('alertMessage', 'Conciliado com sucesso!', 'success');
              await loadData();
            } catch (err: any) {
              UI.showAlert('alertMessage', err?.message || 'Falha ao conciliar.', 'error');
            }
          }
        } else {
          // Check the left side checkbox and match manually
          UI.showAlert('alertMessage', 'Selecione o lançamento correspondente no ERP (lado esquerdo) e clique em Conciliar Selecionados.', 'warn');
        }
      });
    });

    // Summary calculation
    const totalIn = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
    const totalOut = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
    const balance = totalIn - totalOut;

    getById('footerCardCount').textContent = filtered.length;
    getById('footerCardTotalIn').textContent = formatCurrency(totalIn);
    getById('footerCardTotalOut').textContent = formatCurrency(totalOut);

    const balEl = getById('footerCardBalance');
    balEl.textContent = formatCurrency(balance);
    balEl.className = balance >= 0 
      ? 'mt-0.5 block text-xs font-bold text-emerald-600 dark:text-emerald-400'
      : 'mt-0.5 block text-xs font-bold text-red-600 dark:text-red-400';
  }

  // ─── Load Data ──────────────────────────────────────────────────────────────
  async function loadData(): Promise<void> {
    try {
      const [sysRes, stmtRes] = await Promise.all([
        api('/finance/card-transactions'),
        api('/finance/card-statements')
      ]);

      systemTransactions = sysRes?.data || [];
      cardStatements = stmtRes?.data || [];

      renderAll();
    } catch (err: any) {
      UI.showAlert('alertMessage', 'Falha ao carregar lançamentos de cartões.', 'error');
    }
  }

  // ─── Initialize Event Listeners ──────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    setupFilters();
    await loadData();

    // Reconcile Button Action
    const btnConciliate = getById('btnConciliate');
    if (btnConciliate) {
      btnConciliate.addEventListener('click', async () => {
        const sysIds: string[] = [];
        document.querySelectorAll('.chk-system:checked').forEach((chk: any) => {
          sysIds.push(chk.dataset.id);
        });

        const cardIds: string[] = [];
        document.querySelectorAll('.chk-card:checked').forEach((chk: any) => {
          cardIds.push(chk.dataset.id);
        });

        try {
          await api('/finance/card-reconcile', {
            method: 'POST',
            body: JSON.stringify({
              system_ids: sysIds,
              card_statement_ids: cardIds
            })
          });
          UI.showAlert('alertMessage', 'Lançamentos conciliados com sucesso!', 'success');
          await loadData();
        } catch (err: any) {
          UI.showAlert('alertMessage', err?.message || 'Falha ao conciliar.', 'error');
        }
      });
    }

    // Select All Listeners
    const chkAllSystem = getById('chkAllSystem');
    if (chkAllSystem) {
      chkAllSystem.addEventListener('change', () => {
        const state = chkAllSystem.checked;
        document.querySelectorAll('.chk-system').forEach((chk: any) => {
          if (!chk.disabled) chk.checked = state;
        });
        updateConciliationBar();
      });
    }

    const chkAllCard = getById('chkAllCard');
    if (chkAllCard) {
      chkAllCard.addEventListener('change', () => {
        const state = chkAllCard.checked;
        document.querySelectorAll('.chk-card').forEach((chk: any) => {
          if (!chk.disabled) chk.checked = state;
        });
        updateConciliationBar();
      });
    }

    // Batch Delete Action
    const btnBatchDeleteCard = getById('btnBatchDeleteCard');
    if (btnBatchDeleteCard) {
      btnBatchDeleteCard.addEventListener('click', async () => {
        const cardIds: string[] = [];
        document.querySelectorAll('.chk-card:checked').forEach((chk: any) => {
          cardIds.push(chk.dataset.id);
        });

        if (cardIds.length === 0) {
          UI.showAlert('alertMessage', 'Nenhum lançamento do extrato selecionado.', 'warn');
          return;
        }

        if (confirm(`Deseja realmente remover os ${cardIds.length} lançamentos do extrato selecionados?`)) {
          try {
            await api('/finance/card-statements/batch-delete', {
              method: 'POST',
              body: JSON.stringify({ ids: cardIds })
            });
            UI.showAlert('alertMessage', 'Lançamentos de extratos de cartões removidos com sucesso.', 'success');
            await loadData();
          } catch (err: any) {
            UI.showAlert('alertMessage', err?.message || 'Falha ao remover extratos.', 'error');
          }
        }
      });
    }

    // OFX File Uploader
    const fileOfx = getById('fileOfx');
    const btnImportOfx = getById('btnImportOfx');
    const btnImportOfxCenter = getById('btnImportOfxCenter');

    const triggerUpload = () => {
      if (fileOfx) fileOfx.click();
    };

    if (btnImportOfx) btnImportOfx.addEventListener('click', triggerUpload);
    if (btnImportOfxCenter) btnImportOfxCenter.addEventListener('click', triggerUpload);

    if (fileOfx) {
      fileOfx.addEventListener('change', (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt: any) => {
          const ofxContent = evt.target?.result;
          try {
            UI.showAlert('alertMessage', 'Processando arquivo de extrato de cartão...', 'info');
            const res = await api('/finance/card-statements/sync-ofx', {
              method: 'POST',
              body: JSON.stringify({ ofxContent })
            });
            UI.showAlert('alertMessage', res.message || 'OFX de Cartão importado com sucesso!', 'success');
            await loadData();
          } catch (err: any) {
            UI.showAlert('alertMessage', err?.message || 'Falha ao processar arquivo OFX de cartão.', 'error');
          } finally {
            fileOfx.value = '';
          }
        };
        reader.readAsText(file);
      });
    }
  });
})();
