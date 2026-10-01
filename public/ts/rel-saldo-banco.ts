// @ts-nocheck
(() => {
  interface RealtimeInfo {
    status: 'success' | 'not_configured' | 'error';
    disponivel: number;
    bloqueadoCheque: number;
    bloqueadoJudicial: number;
    bloqueadoAdministrativo: number;
    totalBloqueado: number;
    limite: number;
    totalMaster: number;
    consulted_at: string;
    error_message?: string;
  }

  interface BankAccountRealtime {
    id: number;
    public_id?: string;
    name: string;
    type: string;
    institution?: string;
    agency_number?: string;
    account_number?: string;
    pix_key?: string;
    has_api: boolean;
    current_balance: number;
    initial_balance: number;
    realtime: RealtimeInfo;
    difference: number;
  }

  interface SummaryKPIs {
    totalDisponivel: number;
    totalBloqueado: number;
    totalLimite: number;
    totalGeral: number;
    totalContas: number;
    totalIntegradas: number;
  }

  // ─── State ─────────────────────────────────────────────────────────
  let accountsData: BankAccountRealtime[] = [];
  let summaryData: SummaryKPIs = {
    totalDisponivel: 0,
    totalBloqueado: 0,
    totalLimite: 0,
    totalGeral: 0,
    totalContas: 0,
    totalIntegradas: 0
  };
  let currentView: 'cards' | 'table' = 'cards';
  let isFetching = false;
  let autoRefreshTimer: any = null;

  const STORAGE_KEY_VIEW = 'erp_rel_saldo_banco_view_mode';
  const STORAGE_KEY_AUTO = 'erp_rel_saldo_banco_auto_refresh';

  const getById = (id: string): any => document.getElementById(id);

  // ─── Formatters ───────────────────────────────────────────────────
  const formatCurrency = (val: any): string => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  const formatTimeOnly = (dateStr: string | Date | undefined): string => {
    if (!dateStr) return '--:--:--';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '--:--:--';
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '--:--:--';
    }
  };

  const formatAccountType = (type: string): string => {
    switch (String(type || '').toLowerCase()) {
      case 'checking': return 'Conta Corrente';
      case 'savings': return 'Poupança';
      case 'investment': return 'Investimento';
      case 'cash': return 'Caixa Físico';
      default: return type || 'Conta';
    }
  };

  // ─── Institution Theme Detection ───────────────────────────────────
  function getInstitutionBrand(institution?: string, name?: string) {
    const text = `${institution || ''} ${name || ''}`.toLowerCase();
    
    if (text.includes('inter')) {
      return {
        name: 'Banco Inter',
        badgeColor: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
        gradient: 'from-orange-500 to-amber-500',
        logoBg: 'bg-orange-500 text-white',
        initials: 'IN',
        borderColor: 'border-orange-500/30'
      };
    }
    if (text.includes('itaú') || text.includes('itau')) {
      return {
        name: 'Banco Itaú',
        badgeColor: 'bg-amber-600/10 text-amber-700 dark:text-amber-400 border-amber-600/20',
        gradient: 'from-orange-600 to-blue-800',
        logoBg: 'bg-amber-600 text-white',
        initials: 'IT',
        borderColor: 'border-amber-500/30'
      };
    }
    if (text.includes('bradesco')) {
      return {
        name: 'Bradesco',
        badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        gradient: 'from-red-600 to-rose-700',
        logoBg: 'bg-red-600 text-white',
        initials: 'BD',
        borderColor: 'border-rose-500/30'
      };
    }
    if (text.includes('brasil') || text.includes('bb')) {
      return {
        name: 'Banco do Brasil',
        badgeColor: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
        gradient: 'from-blue-700 to-yellow-500',
        logoBg: 'bg-blue-700 text-yellow-300',
        initials: 'BB',
        borderColor: 'border-blue-500/30'
      };
    }
    if (text.includes('caixa') || text.includes('cef')) {
      return {
        name: 'Caixa Econômica',
        badgeColor: 'bg-blue-600/10 text-blue-700 dark:text-blue-400 border-blue-600/20',
        gradient: 'from-blue-600 to-sky-500',
        logoBg: 'bg-blue-600 text-white',
        initials: 'CX',
        borderColor: 'border-blue-500/30'
      };
    }
    if (text.includes('santander')) {
      return {
        name: 'Santander',
        badgeColor: 'bg-red-600/10 text-red-700 dark:text-red-400 border-red-600/20',
        gradient: 'from-red-600 to-red-800',
        logoBg: 'bg-red-600 text-white',
        initials: 'ST',
        borderColor: 'border-red-500/30'
      };
    }
    if (text.includes('nubank') || text.includes('nu pagamentos')) {
      return {
        name: 'Nubank',
        badgeColor: 'bg-purple-600/10 text-purple-700 dark:text-purple-400 border-purple-600/20',
        gradient: 'from-purple-600 to-violet-800',
        logoBg: 'bg-purple-600 text-white',
        initials: 'NU',
        borderColor: 'border-purple-500/30'
      };
    }
    if (text.includes('sicoob')) {
      return {
        name: 'Sicoob',
        badgeColor: 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border-emerald-600/20',
        gradient: 'from-emerald-700 to-teal-800',
        logoBg: 'bg-teal-700 text-white',
        initials: 'SC',
        borderColor: 'border-emerald-500/30'
      };
    }
    if (text.includes('sicredi')) {
      return {
        name: 'Sicredi',
        badgeColor: 'bg-green-600/10 text-green-700 dark:text-green-400 border-green-600/20',
        gradient: 'from-green-600 to-emerald-800',
        logoBg: 'bg-green-600 text-white',
        initials: 'SI',
        borderColor: 'border-green-500/30'
      };
    }
    if (text.includes('safra')) {
      return {
        name: 'Banco Safra',
        badgeColor: 'bg-amber-700/10 text-amber-800 dark:text-amber-400 border-amber-700/20',
        gradient: 'from-amber-800 to-slate-900',
        logoBg: 'bg-amber-900 text-amber-200',
        initials: 'SF',
        borderColor: 'border-amber-600/30'
      };
    }
    if (text.includes('c6')) {
      return {
        name: 'C6 Bank',
        badgeColor: 'bg-slate-600/10 text-slate-700 dark:text-slate-300 border-slate-600/20',
        gradient: 'from-slate-800 to-slate-950',
        logoBg: 'bg-slate-900 text-white',
        initials: 'C6',
        borderColor: 'border-slate-500/30'
      };
    }

    // Default Fallback
    const cleanName = institution || name || 'Banco';
    const initials = cleanName.substring(0, 2).toUpperCase();
    return {
      name: cleanName,
      badgeColor: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20',
      gradient: 'from-brand-600 to-indigo-700',
      logoBg: 'bg-brand-600 text-white',
      initials: initials || 'BC',
      borderColor: 'border-brand-500/30'
    };
  }

  // ─── Fetch Realtime Balances ─────────────────────────────────────────
  async function loadBalances(showLoading = true): Promise<void> {
    if (isFetching) return;
    isFetching = true;

    const btnRefresh = getById('btnRefreshAll');
    const iconRefresh = getById('iconRefreshAll');
    const loadingEl = getById('loadingState');

    if (iconRefresh) iconRefresh.classList.add('animate-spin');
    if (btnRefresh) btnRefresh.disabled = true;

    if (showLoading && accountsData.length === 0) {
      if (loadingEl) loadingEl.classList.remove('hidden');
      if (getById('cardsView')) getById('cardsView').classList.add('hidden');
      if (getById('tableView')) getById('tableView').classList.add('hidden');
      if (getById('emptyState')) getById('emptyState').classList.add('hidden');
    }

    try {
      const response = typeof (window as any).api === 'function' 
        ? await (window as any).api('/bank-accounts/realtime-balances')
        : await api('/bank-accounts/realtime-balances');
      const data = response?.data || response;

      accountsData = Array.isArray(data?.accounts) ? data.accounts : [];
      summaryData = data?.summary || {
        totalDisponivel: 0,
        totalBloqueado: 0,
        totalLimite: 0,
        totalGeral: 0,
        totalContas: 0,
        totalIntegradas: 0
      };

      updateKPISummary();
      renderCurrentView();

      const lastUpdateEl = getById('statusBarLastUpdate');
      if (lastUpdateEl) {
        lastUpdateEl.textContent = `Atualizado em: ${formatTimeOnly(new Date())}`;
      }
    } catch (err: any) {
      console.error('Erro ao buscar saldos realtime:', err);
      if ((window as any).Utils?.showToast) {
        (window as any).Utils.showToast('Erro ao carregar saldos bancários em tempo real', 'error');
      } else {
        alert('Erro ao carregar saldos bancários em tempo real: ' + (err?.message || 'Erro desconhecido'));
      }
    } finally {
      isFetching = false;
      if (iconRefresh) iconRefresh.classList.remove('animate-spin');
      if (btnRefresh) btnRefresh.disabled = false;
      if (loadingEl) loadingEl.classList.add('hidden');
    }
  }

  // ─── Update KPI Summary Cards ───────────────────────────────────────
  function updateKPISummary(): void {
    const kpiDisponivel = getById('kpiTotalDisponivel');
    const kpiBloqueado = getById('kpiTotalBloqueado');
    const kpiLimite = getById('kpiTotalLimite');
    const kpiGeral = getById('kpiTotalGeral');
    const kpiIntegradas = getById('kpiTotalIntegradas');

    if (kpiDisponivel) kpiDisponivel.textContent = formatCurrency(summaryData.totalDisponivel);
    if (kpiBloqueado) kpiBloqueado.textContent = formatCurrency(summaryData.totalBloqueado);
    if (kpiLimite) kpiLimite.textContent = formatCurrency(summaryData.totalLimite);
    if (kpiGeral) kpiGeral.textContent = formatCurrency(summaryData.totalGeral);
    if (kpiIntegradas) kpiIntegradas.textContent = `${summaryData.totalIntegradas} / ${summaryData.totalContas}`;
  }

  // ─── Filtering Logic ───────────────────────────────────────────────
  function getFilteredAccounts(): BankAccountRealtime[] {
    const searchVal = (getById('filterSearch')?.value || '').toLowerCase().trim();
    const typeVal = getById('filterType')?.value || '';
    const apiStatusVal = getById('filterApiStatus')?.value || '';

    return accountsData.filter((acc) => {
      // Search text match
      if (searchVal) {
        const textToMatch = [
          acc.name,
          acc.institution,
          acc.agency_number,
          acc.account_number,
          acc.pix_key,
          acc.public_id,
          formatAccountType(acc.type)
        ].filter(Boolean).join(' ').toLowerCase();

        if (!textToMatch.includes(searchVal)) return false;
      }

      // Type match
      if (typeVal && acc.type !== typeVal) {
        return false;
      }

      // API Status match
      if (apiStatusVal) {
        if (apiStatusVal === 'api' && acc.realtime?.status !== 'success') return false;
        if (apiStatusVal === 'manual' && acc.realtime?.status !== 'not_configured') return false;
        if (apiStatusVal === 'error' && acc.realtime?.status !== 'error') return false;
      }

      return true;
    });
  }

  // ─── Render View Controller ────────────────────────────────────────
  function renderCurrentView(): void {
    const filtered = getFilteredAccounts();
    const emptyState = getById('emptyState');
    const cardsView = getById('cardsView');
    const tableView = getById('tableView');
    const statusBarCount = getById('statusBarCount');

    if (statusBarCount) {
      statusBarCount.textContent = `${filtered.length} de ${accountsData.length} contas`;
    }

    if (filtered.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (cardsView) cardsView.classList.add('hidden');
      if (tableView) tableView.classList.add('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    if (currentView === 'cards') {
      if (cardsView) cardsView.classList.remove('hidden');
      if (tableView) tableView.classList.add('hidden');
      renderCards(filtered);
    } else {
      if (cardsView) cardsView.classList.add('hidden');
      if (tableView) tableView.classList.remove('hidden');
      renderTable(filtered);
    }
  }

  // ─── Render Cards ─────────────────────────────────────────────────
  function renderCards(accounts: BankAccountRealtime[]): void {
    const container = getById('cardsView');
    if (!container) return;

    container.innerHTML = accounts.map((acc) => {
      const brand = getInstitutionBrand(acc.institution, acc.name);
      const isRealtime = acc.realtime?.status === 'success';
      const isError = acc.realtime?.status === 'error';
      const dispBal = acc.realtime?.disponivel ?? acc.current_balance ?? 0;
      const bloqueado = acc.realtime?.totalBloqueado || 0;
      const limite = acc.realtime?.limite || 0;
      const consultedAt = acc.realtime?.consulted_at ? formatTimeOnly(acc.realtime.consulted_at) : '--:--:--';
      const diff = acc.difference || 0;

      // Status Badge
      let statusBadge = '';
      if (isRealtime) {
        statusBadge = `
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            API Realtime
          </span>
        `;
      } else if (isError) {
        statusBadge = `
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20" title="${acc.realtime?.error_message || 'Erro de conexão'}">
            <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Erro API
          </span>
        `;
      } else {
        statusBadge = `
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600">
            <span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
            Saldo ERP
          </span>
        `;
      }

      // Difference reconciliation pill
      let diffHtml = '';
      if (isRealtime) {
        if (Math.abs(diff) < 0.01) {
          diffHtml = `
            <div class="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 py-1 border-t border-gray-100 dark:border-slate-700/60">
              <span>Conciliação ERP:</span>
              <span class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                100% Sincronizado
              </span>
            </div>
          `;
        } else {
          const diffFormatted = formatCurrency(Math.abs(diff));
          const diffLabel = diff > 0 ? `+${diffFormatted} (API > ERP)` : `-${diffFormatted} (ERP > API)`;
          diffHtml = `
            <div class="flex items-center justify-between text-[11px] py-1 border-t border-gray-100 dark:border-slate-700/60">
              <span class="text-amber-600 dark:text-amber-400 font-medium">Divergência ERP:</span>
              <span class="font-mono text-xs font-bold text-amber-600 dark:text-amber-400" title="Saldo ERP: ${formatCurrency(acc.current_balance)} | Saldo Realtime: ${formatCurrency(dispBal)}">
                ${diffLabel}
              </span>
            </div>
          `;
        }
      }

      return `
        <div class="group relative rounded-2xl bg-white dark:bg-slate-800 border ${brand.borderColor} dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
          
          <!-- Top Colored Accent Bar -->
          <div class="h-1.5 w-full bg-linear-to-r ${brand.gradient}"></div>

          <!-- Card Header -->
          <div class="p-5 pb-3">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl ${brand.logoBg} font-bold text-sm flex items-center justify-center shadow-xs shrink-0">
                  ${brand.initials}
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <h3 class="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">${acc.name}</h3>
                    ${acc.public_id ? `<span class="text-[10px] text-gray-400 font-mono">#${acc.public_id}</span>` : ''}
                  </div>
                  <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    <span>${acc.institution || brand.name}</span>
                    <span>•</span>
                    <span class="font-medium">${formatAccountType(acc.type)}</span>
                  </div>
                </div>
              </div>
              <div class="shrink-0">
                ${statusBadge}
              </div>
            </div>

            <!-- Agency / Account details -->
            <div class="mt-3 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-slate-900/60 rounded-lg p-2 font-mono">
              <div>
                <span class="text-gray-400">Ag:</span> ${acc.agency_number || '---'}
              </div>
              <div>
                <span class="text-gray-400">Conta:</span> ${acc.account_number || '---'}
              </div>
              ${acc.pix_key ? `
                <div class="truncate max-w-27.5" title="Chave PIX: ${acc.pix_key}">
                  <span class="text-gray-400">PIX:</span> ${acc.pix_key}
                </div>
              ` : ''}
            </div>

            <!-- Main Available Balance -->
            <div class="mt-4">
              <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                ${isRealtime ? 'Saldo Disponível Realtime' : 'Saldo Atual (ERP)'}
              </div>
              <div class="text-2xl font-black font-mono mt-0.5 ${dispBal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
                ${formatCurrency(dispBal)}
              </div>
            </div>

            <!-- Breakdown: Bloqueado & Limite -->
            <div class="mt-3 space-y-1">
              ${bloqueado > 0 ? `
                <div class="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300 py-0.5" title="Cheque: ${formatCurrency(acc.realtime?.bloqueadoCheque)} | Judicial: ${formatCurrency(acc.realtime?.bloqueadoJudicial)} | Admin: ${formatCurrency(acc.realtime?.bloqueadoAdministrativo)}">
                  <span class="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    Bloqueado:
                  </span>
                  <span class="font-mono font-semibold text-amber-600 dark:text-amber-400">${formatCurrency(bloqueado)}</span>
                </div>
              ` : ''}

              ${limite > 0 ? `
                <div class="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300 py-0.5">
                  <span class="text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                    Limite de Crédito:
                  </span>
                  <span class="font-mono font-semibold text-indigo-600 dark:text-indigo-400">${formatCurrency(limite)}</span>
                </div>
              ` : ''}

              <!-- Reconciliation difference -->
              ${diffHtml}

              ${isError ? `
                <div class="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-[11px] mt-2">
                  <span class="font-bold">Aviso API:</span> ${acc.realtime?.error_message || 'Falha de comunicação'}
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Card Footer Actions -->
          <div class="px-5 py-3 bg-gray-50 dark:bg-slate-900/40 border-t border-gray-100 dark:border-slate-700/60 flex items-center justify-between gap-2 text-xs">
            <span class="text-[10px] text-gray-400" title="Última consulta">
              Cons: ${consultedAt}
            </span>
            <div class="flex items-center gap-2">
              <a href="/pages/statements.html?bankId=${acc.id}" 
                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                Extrato
              </a>
              <button type="button" data-refresh-id="${acc.id}"
                class="btn-refresh-single inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 shadow-2xs transition-colors cursor-pointer">
                <svg class="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                Atualizar
              </button>
            </div>
          </div>

        </div>
      `;
    }).join('');

    // Attach single refresh button listeners
    container.querySelectorAll('.btn-refresh-single').forEach((btn: any) => {
      btn.addEventListener('click', (e: Event) => {
        e.preventDefault();
        loadBalances(false);
      });
    });
  }

  // ─── Render Table ─────────────────────────────────────────────────
  function renderTable(accounts: BankAccountRealtime[]): void {
    const tbody = getById('tableBody');
    if (!tbody) return;

    tbody.innerHTML = accounts.map((acc) => {
      const brand = getInstitutionBrand(acc.institution, acc.name);
      const isRealtime = acc.realtime?.status === 'success';
      const isError = acc.realtime?.status === 'error';
      const dispBal = acc.realtime?.disponivel ?? acc.current_balance ?? 0;
      const bloqueado = acc.realtime?.totalBloqueado || 0;
      const limite = acc.realtime?.limite || 0;
      const consultedAt = acc.realtime?.consulted_at ? formatTimeOnly(acc.realtime.consulted_at) : '--:--:--';
      const diff = acc.difference || 0;

      let statusBadge = '';
      if (isRealtime) {
        statusBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Tempo Real</span>`;
      } else if (isError) {
        statusBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300" title="${acc.realtime?.error_message || ''}">Erro API</span>`;
      } else {
        statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">Manual (ERP)</span>`;
      }

      let diffCell = `<span class="text-gray-400 font-mono">R$ 0,00</span>`;
      if (isRealtime && Math.abs(diff) >= 0.01) {
        diffCell = `<span class="text-amber-600 dark:text-amber-400 font-mono font-bold">${diff > 0 ? '+' : ''}${formatCurrency(diff)}</span>`;
      }

      return `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
          <td class="px-4 py-3">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg ${brand.logoBg} font-bold text-xs flex items-center justify-center shrink-0">
                ${brand.initials}
              </div>
              <div>
                <div class="font-bold text-gray-900 dark:text-gray-100">${acc.name}</div>
                <div class="text-[10px] text-gray-400">${acc.institution || brand.name}</div>
              </div>
            </div>
          </td>
          <td class="px-3 py-3 font-mono text-gray-700 dark:text-gray-300">
            <div>Ag: ${acc.agency_number || '---'}</div>
            <div>Cc: ${acc.account_number || '---'}</div>
          </td>
          <td class="px-3 py-3 text-gray-600 dark:text-gray-300">
            ${formatAccountType(acc.type)}
          </td>
          <td class="px-4 py-3 text-right font-mono font-bold text-sm ${dispBal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
            ${formatCurrency(dispBal)}
          </td>
          <td class="px-3 py-3 text-right font-mono text-amber-600 dark:text-amber-400">
            ${bloqueado > 0 ? formatCurrency(bloqueado) : '-'}
          </td>
          <td class="px-3 py-3 text-right font-mono text-indigo-600 dark:text-indigo-400">
            ${limite > 0 ? formatCurrency(limite) : '-'}
          </td>
          <td class="px-3 py-3 text-right font-mono text-gray-600 dark:text-gray-300">
            ${formatCurrency(acc.current_balance)}
          </td>
          <td class="px-3 py-3 text-right">
            ${diffCell}
          </td>
          <td class="px-3 py-3 text-center">
            ${statusBadge}
          </td>
          <td class="px-3 py-3 text-gray-500 font-mono text-[11px]">
            ${consultedAt}
          </td>
          <td class="px-3 py-3 text-center no-print">
            <div class="flex items-center justify-center gap-1">
              <a href="/pages/statements.html?bankId=${acc.id}" title="Ver Extrato"
                class="p-1 rounded-md text-gray-500 hover:text-brand-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              </a>
              <button type="button" data-refresh-id="${acc.id}" title="Atualizar Saldo"
                class="btn-refresh-single p-1 rounded-md text-emerald-600 hover:text-emerald-700 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach single refresh button listeners
    tbody.querySelectorAll('.btn-refresh-single').forEach((btn: any) => {
      btn.addEventListener('click', (e: Event) => {
        e.preventDefault();
        loadBalances(false);
      });
    });
  }

  // ─── Setup Auto-Refresh ───────────────────────────────────────────
  function setupAutoRefresh(seconds: number): void {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
    if (seconds > 0) {
      autoRefreshTimer = setInterval(() => {
        loadBalances(false);
      }, seconds * 1000);
    }
    if ((window as any).CompanyStorage) {
      (window as any).CompanyStorage.setItem(STORAGE_KEY_AUTO, String(seconds));
    } else {
      localStorage.setItem(STORAGE_KEY_AUTO, String(seconds));
    }
  }

  // ─── Setup View Switcher ──────────────────────────────────────────
  function setViewMode(mode: 'cards' | 'table'): void {
    currentView = mode;
    if ((window as any).CompanyStorage) {
      (window as any).CompanyStorage.setItem(STORAGE_KEY_VIEW, mode);
    } else {
      localStorage.setItem(STORAGE_KEY_VIEW, mode);
    }

    const btnCards = getById('btnViewCards');
    const btnTable = getById('btnViewTable');

    if (mode === 'cards') {
      btnCards?.classList.add('bg-brand-500', 'text-white');
      btnCards?.classList.remove('text-gray-500', 'dark:text-gray-400');
      btnTable?.classList.remove('bg-brand-500', 'text-white');
      btnTable?.classList.add('text-gray-500', 'dark:text-gray-400');
    } else {
      btnTable?.classList.add('bg-brand-500', 'text-white');
      btnTable?.classList.remove('text-gray-500', 'dark:text-gray-400');
      btnCards?.classList.remove('bg-brand-500', 'text-white');
      btnCards?.classList.add('text-gray-500', 'dark:text-gray-400');
    }

    renderCurrentView();
  }

  // ─── DOM Events Initialization ────────────────────────────────────
  function initEvents(): void {
    // Refresh All Button
    getById('btnRefreshAll')?.addEventListener('click', () => {
      loadBalances(true);
    });

    // View Switchers
    getById('btnViewCards')?.addEventListener('click', () => setViewMode('cards'));
    getById('btnViewTable')?.addEventListener('click', () => setViewMode('table'));

    // Print Button
    getById('btnPrint')?.addEventListener('click', () => {
      window.print();
    });

    // Auto-refresh selector
    const autoSel = getById('selectAutoRefresh');
    if (autoSel) {
      const savedAuto = (window as any).CompanyStorage?.getItem(STORAGE_KEY_AUTO) ?? localStorage.getItem(STORAGE_KEY_AUTO);
      if (savedAuto) {
        autoSel.value = savedAuto;
        setupAutoRefresh(Number(savedAuto));
      }
      autoSel.addEventListener('change', (e: any) => {
        setupAutoRefresh(Number(e.target.value));
      });
    }

    // Filter Listeners
    getById('filterSearch')?.addEventListener('input', () => renderCurrentView());
    getById('filterType')?.addEventListener('change', () => renderCurrentView());
    getById('filterApiStatus')?.addEventListener('change', () => renderCurrentView());

    // Reset Filters
    getById('btnResetFilters')?.addEventListener('click', () => {
      const s = getById('filterSearch');
      const t = getById('filterType');
      const st = getById('filterApiStatus');
      if (s) s.value = '';
      if (t) t.value = '';
      if (st) st.value = '';
      renderCurrentView();
    });

    // Load saved view mode
    const savedView = (window as any).CompanyStorage?.getItem(STORAGE_KEY_VIEW) ?? localStorage.getItem(STORAGE_KEY_VIEW);
    if (savedView === 'table' || savedView === 'cards') {
      setViewMode(savedView);
    }
  }

  // ─── Bootstrap ───────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    loadBalances(true);
  });
})();
