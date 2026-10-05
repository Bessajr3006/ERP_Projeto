// @ts-nocheck
/**
 * fin_solidcon_vision.ts
 * Painel Analítico de Receitas vs Despesas do Banco Solidcon
 * Suporte a Checklist Interativo de Tipos de Conta (vwaporttec_contas)
 */

(() => {
    interface VisionTransaction {
        id: string | number;
        cdcontabaixa?: string | number;
        data: string;
        documento: string;
        historico: string;
        tipo: 'receita' | 'despesa';
        valor: number;
        banco: string;
        filial: number | string;
        nome_filial?: string;
        tipoconta?: string;
        conta?: string;
        referencia?: string;
    }

    interface CategoryItem {
        tipoconta: string;
        tipo: 'receita' | 'despesa' | 'misto';
        valor: number;
        receita: number;
        despesa: number;
        qtd: number;
        qtdReceita: number;
        qtdDespesa: number;
    }

    interface VisionData {
        params: {
            ano: number;
            mes: number;
            mesNome: string;
            cdFilial: string | null;
            source: string;
        };
        summary: {
            totalReceita: number;
            totalDespesa: number;
            saldoLiquido: number;
            totalMovimentado: number;
            margemPercent: number;
            qtdReceita: number;
            qtdDespesa: number;
            ticketMedioReceita: number;
            ticketMedioDespesa: number;
        };
        monthlyComparison: Array<{
            mes: number;
            mesNome: string;
            mesSigla: string;
            receita: number;
            despesa: number;
            saldo: number;
            qtd_receita: number;
            qtd_despesa: number;
        }>;
        dailyEvolution: Array<{
            dia: number;
            data: string;
            receita: number;
            despesa: number;
            saldo: number;
            qtd_receita: number;
            qtd_despesa: number;
        }>;
        byBank: Array<{
            banco: string;
            conta_numero: string;
            receita: number;
            despesa: number;
            saldo: number;
            total_movimentado: number;
            qtd: number;
        }>;
        byCategory?: Array<{
            tipo: 'receita' | 'despesa';
            tipoconta: string;
            valor: number;
            qtd: number;
        }>;
        topReceitas: Array<any>;
        topDespesas: Array<any>;
        transactions: Array<VisionTransaction>;
        filiais: Array<{ id: number | string; nome: string } | number | string>;
    }

    let rawData: VisionData | null = null;
    let isLoading = false;

    // Checklist State
    let selectedAccountTypes: Set<string> = new Set();
    let allCategoriesList: CategoryItem[] = [];
    let categorySearchTerm: string = '';

    const getEl = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
        document.getElementById(id) as T | null;

    const formatCurrency = (val: number | string | null | undefined): string => {
        const num = Number(val || 0);
        return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return '-';
        const parts = String(dateStr).split('T')[0].split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    };

    const normalizeAccountType = (tc?: string | null): string => {
        if (!tc || !tc.trim()) return '(Sem Tipo)';
        return tc.trim();
    };

    function escapeHtml(value: any): string {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    const populateYearDropdown = () => {
        const select = getEl<HTMLSelectElement>('filterAno');
        if (!select) return;

        const currentYear = new Date().getFullYear();
        select.innerHTML = '';

        for (let y = currentYear; y >= currentYear - 4; y--) {
            const opt = document.createElement('option');
            opt.value = String(y);
            opt.textContent = String(y);
            if (y === currentYear) opt.selected = true;
            select.appendChild(opt);
        }
    };

    // ─── Company & Solidcon Connections ──────────────────────────────────────
    let accessibleCompanies: any[] = [];
    let currentCompanyPublicId = '';

    async function loadCompanies(): Promise<void> {
        const compSelect = getEl<HTMLSelectElement>('filterCompany');
        if (!compSelect) return;

        try {
            const meRes = await api('/auth/me');
            const activeCompany = meRes?.data?.company;
            currentCompanyPublicId = activeCompany?.public_id || '';

            let list = meRes?.data?.companies || [];
            if (!Array.isArray(list) || list.length === 0) {
                try {
                    const compRes = await api('/companies');
                    if (Array.isArray(compRes?.data)) {
                        list = compRes.data;
                    }
                } catch (e) {}
            }

            if (list.length === 0 && activeCompany) {
                list = [activeCompany];
            }

            accessibleCompanies = list;

            const savedCompanyId = localStorage.getItem('fin_solidcon_vision_company');

            compSelect.innerHTML = accessibleCompanies.map((c: any) => {
                const idVal = c.public_id || c.id;
                const displayName = c.trade_name || c.company_name || c.name || `Empresa #${c.id}`;
                const isSelected = savedCompanyId 
                    ? (idVal === savedCompanyId || String(c.id) === String(savedCompanyId)) 
                    : (idVal === currentCompanyPublicId);
                return `<option value="${idVal}" ${isSelected ? 'selected' : ''}>${escapeHtml(displayName)}</option>`;
            }).join('');

            if (compSelect.options.length > 0 && compSelect.selectedIndex === -1) {
                compSelect.selectedIndex = 0;
            }
        } catch (err) {
            console.warn('Falha ao carregar lista de empresas:', err);
            compSelect.innerHTML = '<option value="">Minha Empresa</option>';
        }
    }

    const loadSolidconConnections = async (targetCompany?: string) => {
        const select = getEl<HTMLSelectElement>('filterConnection');
        if (!select) return;

        const companyParam = targetCompany || getEl<HTMLSelectElement>('filterCompany')?.value || '';

        try {
            select.innerHTML = '<option value="">Carregando conexões...</option>';
            const url = `/finance/reports/solidcon-connections${companyParam ? `?targetCompanyId=${encodeURIComponent(companyParam)}` : ''}`;
            const res = await api(url);
            const conns = res?.data || [];

            select.innerHTML = '<option value="">Padrão da Empresa (Solidcon)</option>';

            conns.forEach((c: any) => {
                const opt = document.createElement('option');
                opt.value = String(c.id);
                opt.textContent = `${c.name || 'Conexão'} (${c.serv_solidcon || ''}/${c.bd_solidcon || 'solidcon'})`;
                if (c.is_default) {
                    opt.textContent += ' [Padrão]';
                }
                select.appendChild(opt);
            });

            const savedConnectionId = localStorage.getItem(`fin_solidcon_vision_conn_${companyParam || 'default'}`);
            if (savedConnectionId) {
                select.value = savedConnectionId;
            }
        } catch (e) {
            select.innerHTML = '<option value="">Padrão da Empresa (Solidcon)</option>';
        }
    };

    const updateStatusBadge = (status: 'loading' | 'success' | 'error' | 'idle', text?: string) => {
        const badge = getEl('statusBadge');
        if (!badge) return;

        if (status === 'loading') {
            badge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
            badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span> ' + (text || 'Consultando...');
        } else if (status === 'success') {
            badge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
            badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span> ' + (text || 'Conectado ao Solidcon');
        } else if (status === 'error') {
            badge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
            badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-500"></span> ' + (text || 'Falha na Conexão');
        } else {
            badge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700';
            badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-gray-400"></span> ' + (text || 'Pronto para consultar');
        }
    };

    const showAlert = (message: string, type: 'error' | 'success' | 'warning' | 'info') => {
        const box = getEl('alertMessage');
        if (!box) return;

        let bgClass = 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200 border-blue-200 dark:border-blue-800';
        if (type === 'error') bgClass = 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200 border-rose-200 dark:border-rose-800';
        if (type === 'success') bgClass = 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800';
        if (type === 'warning') bgClass = 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 border-amber-200 dark:border-amber-800';

        box.className = `p-4 rounded-xl text-sm border ${bgClass} mb-6`;
        box.innerHTML = message;
        box.classList.remove('hidden');
    };

    const hideAlert = () => {
        const box = getEl('alertMessage');
        if (box) box.classList.add('hidden');
    };

    // ─── Extract & Build Category List from Raw Transactions ─────────────────
    const buildCategoriesList = (data: VisionData): CategoryItem[] => {
        const map = new Map<string, {
            tipoconta: string;
            receita: number;
            despesa: number;
            qtdReceita: number;
            qtdDespesa: number;
        }>();

        (data.transactions || []).forEach(t => {
            const tc = normalizeAccountType(t.tipoconta);
            if (!map.has(tc)) {
                map.set(tc, {
                    tipoconta: tc,
                    receita: 0,
                    despesa: 0,
                    qtdReceita: 0,
                    qtdDespesa: 0
                });
            }
            const item = map.get(tc)!;
            const val = Number(t.valor || 0);
            if (t.tipo === 'receita') {
                item.receita += val;
                item.qtdReceita += 1;
            } else {
                item.despesa += val;
                item.qtdDespesa += 1;
            }
        });

        // Also merge any categories from byCategory if present but not in transactions
        if (Array.isArray(data.byCategory)) {
            data.byCategory.forEach(c => {
                const tc = normalizeAccountType(c.tipoconta);
                if (!map.has(tc)) {
                    map.set(tc, {
                        tipoconta: tc,
                        receita: c.tipo === 'receita' ? Number(c.valor || 0) : 0,
                        despesa: c.tipo === 'despesa' ? Number(c.valor || 0) : 0,
                        qtdReceita: c.tipo === 'receita' ? (c.qtd || 1) : 0,
                        qtdDespesa: c.tipo === 'despesa' ? (c.qtd || 1) : 0
                    });
                }
            });
        }

        const list: CategoryItem[] = [];
        map.forEach(item => {
            const totalVal = item.receita + item.despesa;
            const totalQtd = item.qtdReceita + item.qtdDespesa;
            let tipo: 'receita' | 'despesa' | 'misto' = 'receita';
            if (item.receita > 0 && item.despesa > 0) tipo = 'misto';
            else if (item.despesa > 0) tipo = 'despesa';

            list.push({
                tipoconta: item.tipoconta,
                tipo,
                valor: totalVal,
                receita: item.receita,
                despesa: item.despesa,
                qtd: totalQtd,
                qtdReceita: item.qtdReceita,
                qtdDespesa: item.qtdDespesa
            });
        });

        // Sort by total value descending
        list.sort((a, b) => b.valor - a.valor);
        return list;
    };

    // ─── Recalculate Active Data based on Checklist ──────────────────────────
    const getRecalculatedData = (): {
        activeData: VisionData;
        activeTransactions: VisionTransaction[];
        totalSelectedRevenue: number;
        totalSelectedExpense: number;
        totalSelectedBalance: number;
        totalSelectedSum: number;
        selectedCount: number;
    } | null => {
        if (!rawData) return null;

        const allTrans = rawData.transactions || [];
        const activeTransactions = allTrans.filter(t => {
            const tc = normalizeAccountType(t.tipoconta);
            return selectedAccountTypes.has(tc);
        });

        let totalReceita = 0;
        let totalDespesa = 0;
        let qtdReceita = 0;
        let qtdDespesa = 0;

        // Daily Evolution map (1..31)
        const dailyMap = new Map<number, {
            dia: number;
            data: string;
            receita: number;
            despesa: number;
            saldo: number;
            qtd_receita: number;
            qtd_despesa: number;
        }>();

        // Bank Map
        const bankMap = new Map<string, {
            banco: string;
            conta_numero: string;
            receita: number;
            despesa: number;
            saldo: number;
            total_movimentado: number;
            qtd: number;
        }>();

        // Initialize daily map from rawData dailyEvolution to keep full month days
        (rawData.dailyEvolution || []).forEach(d => {
            dailyMap.set(d.dia, {
                dia: d.dia,
                data: d.data,
                receita: 0,
                despesa: 0,
                saldo: 0,
                qtd_receita: 0,
                qtd_despesa: 0
            });
        });

        const topRecs: VisionTransaction[] = [];
        const topDesps: VisionTransaction[] = [];

        activeTransactions.forEach(t => {
            const val = Number(t.valor || 0);
            const isRec = t.tipo === 'receita';

            if (isRec) {
                totalReceita += val;
                qtdReceita += 1;
                topRecs.push(t);
            } else {
                totalDespesa += val;
                qtdDespesa += 1;
                topDesps.push(t);
            }

            // Day evolution
            let dayNum = 1;
            if (t.data) {
                const parts = String(t.data).split('T')[0].split('-');
                if (parts.length === 3) dayNum = parseInt(parts[2], 10) || 1;
            }

            if (!dailyMap.has(dayNum)) {
                dailyMap.set(dayNum, {
                    dia: dayNum,
                    data: t.data,
                    receita: 0,
                    despesa: 0,
                    saldo: 0,
                    qtd_receita: 0,
                    qtd_despesa: 0
                });
            }

            const dayItem = dailyMap.get(dayNum)!;
            if (isRec) {
                dayItem.receita += val;
                dayItem.qtd_receita += 1;
            } else {
                dayItem.despesa += val;
                dayItem.qtd_despesa += 1;
            }
            dayItem.saldo = dayItem.receita - dayItem.despesa;

            // Bank distribution
            const bankKey = String(t.banco || 'Outros').trim() || 'Outros';
            if (!bankMap.has(bankKey)) {
                bankMap.set(bankKey, {
                    banco: bankKey,
                    conta_numero: String(t.conta || ''),
                    receita: 0,
                    despesa: 0,
                    saldo: 0,
                    total_movimentado: 0,
                    qtd: 0
                });
            }
            const bItem = bankMap.get(bankKey)!;
            if (isRec) {
                bItem.receita += val;
            } else {
                bItem.despesa += val;
            }
            bItem.total_movimentado += val;
            bItem.saldo = bItem.receita - bItem.despesa;
            bItem.qtd += 1;
        });

        const saldoLiquido = totalReceita - totalDespesa;
        const totalMovimentado = totalReceita + totalDespesa;
        const margemPercent = totalReceita > 0 
            ? (saldoLiquido / totalReceita) * 100 
            : (totalDespesa > 0 ? -100 : 0);

        const ticketMedioReceita = qtdReceita > 0 ? totalReceita / qtdReceita : 0;
        const ticketMedioDespesa = qtdDespesa > 0 ? totalDespesa / qtdDespesa : 0;

        // Sort Daily Evolution by day number
        const dailyEvolution = Array.from(dailyMap.values()).sort((a, b) => a.dia - b.dia);

        // Sort Banks by total_movimentado descending
        const byBank = Array.from(bankMap.values()).sort((a, b) => b.total_movimentado - a.total_movimentado);

        // Sort Top Rankings
        topRecs.sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0));
        topDesps.sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0));

        const activeData: VisionData = {
            ...rawData,
            summary: {
                totalReceita,
                totalDespesa,
                saldoLiquido,
                totalMovimentado,
                margemPercent,
                qtdReceita,
                qtdDespesa,
                ticketMedioReceita,
                ticketMedioDespesa
            },
            dailyEvolution,
            byBank,
            topReceitas: topRecs.slice(0, 5),
            topDespesas: topDesps.slice(0, 5),
            transactions: activeTransactions
        };

        return {
            activeData,
            activeTransactions,
            totalSelectedRevenue: totalReceita,
            totalSelectedExpense: totalDespesa,
            totalSelectedBalance: saldoLiquido,
            totalSelectedSum: totalMovimentado,
            selectedCount: selectedAccountTypes.size
        };
    };

    // ─── Renderers ────────────────────────────────────────────────────────────

    const renderKPIs = (data: VisionData) => {
        const s = data.summary;

        if (getEl('kpiReceita')) getEl('kpiReceita')!.textContent = formatCurrency(s.totalReceita);
        if (getEl('kpiQtdReceita')) getEl('kpiQtdReceita')!.textContent = String(s.qtdReceita);

        if (getEl('kpiDespesa')) getEl('kpiDespesa')!.textContent = formatCurrency(s.totalDespesa);
        if (getEl('kpiQtdDespesa')) getEl('kpiQtdDespesa')!.textContent = String(s.qtdDespesa);

        const saldoEl = getEl('kpiSaldo');
        const saldoBar = getEl('kpiSaldoBar');
        const saldoIcon = getEl('kpiSaldoIconWrap');
        if (saldoEl) {
            saldoEl.textContent = formatCurrency(s.saldoLiquido);
            if (s.saldoLiquido >= 0) {
                saldoEl.className = 'mt-2 text-2xl lg:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight';
                if (saldoBar) saldoBar.className = 'absolute top-0 left-0 right-0 h-1 bg-emerald-500';
                if (saldoIcon) saldoIcon.className = 'p-3 bg-emerald-100 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400';
            } else {
                saldoEl.className = 'mt-2 text-2xl lg:text-3xl font-black text-rose-600 dark:text-rose-400 font-mono tracking-tight';
                if (saldoBar) saldoBar.className = 'absolute top-0 left-0 right-0 h-1 bg-rose-500';
                if (saldoIcon) saldoIcon.className = 'p-3 bg-rose-100 dark:bg-rose-950/60 rounded-xl text-rose-600 dark:text-rose-400';
            }
        }

        if (getEl('kpiMargem')) {
            getEl('kpiMargem')!.textContent = `${s.margemPercent > 0 ? '+' : ''}${s.margemPercent.toFixed(1)}%`;
        }

        if (getEl('kpiVolume')) getEl('kpiVolume')!.textContent = formatCurrency(s.totalMovimentado);
        if (getEl('kpiQtdTotal')) getEl('kpiQtdTotal')!.textContent = String(s.qtdReceita + s.qtdDespesa);

        // Proportion Bar
        const propReceita = s.totalMovimentado > 0 ? (s.totalReceita / s.totalMovimentado) * 100 : 50;
        const propDespesa = s.totalMovimentado > 0 ? (s.totalDespesa / s.totalMovimentado) * 100 : 50;

        if (getEl('propReceitaLabel')) getEl('propReceitaLabel')!.textContent = `Receita: ${propReceita.toFixed(1)}% (${formatCurrency(s.totalReceita)})`;
        if (getEl('propDespesaLabel')) getEl('propDespesaLabel')!.textContent = `Despesa: ${propDespesa.toFixed(1)}% (${formatCurrency(s.totalDespesa)})`;
        if (getEl('propReceitaBar')) (getEl('propReceitaBar') as HTMLElement).style.width = `${propReceita}%`;
        if (getEl('propDespesaBar')) (getEl('propDespesaBar') as HTMLElement).style.width = `${propDespesa}%`;
    };

    const renderDailyChart = (data: VisionData) => {
        const container = getEl('chartDailyContainer');
        if (!container) return;

        if (getEl('chartDailyMonthLabel')) {
            getEl('chartDailyMonthLabel')!.textContent = `— ${data.params.mesNome} de ${data.params.ano}`;
        }

        const days = data.dailyEvolution || [];
        if (days.length === 0 || (data.summary.totalMovimentado === 0)) {
            container.innerHTML = '<div class="w-full text-center py-12 text-gray-400 text-xs">Sem movimentação selecionada para os dias deste mês.</div>';
            return;
        }

        let maxVal = 1;
        days.forEach(d => {
            if (d.receita > maxVal) maxVal = d.receita;
            if (d.despesa > maxVal) maxVal = d.despesa;
        });

        const chartHeight = 220; // px

        let html = '';
        days.forEach(d => {
            const hRec = Math.max(Math.round((d.receita / maxVal) * chartHeight), d.receita > 0 ? 4 : 0);
            const hDesp = Math.max(Math.round((d.despesa / maxVal) * chartHeight), d.despesa > 0 ? 4 : 0);

            html += `
                <div class="flex-1 min-w-4.5 max-w-8 flex flex-col items-center gap-1 group relative cursor-pointer" title="Dia ${d.dia}: Receita ${formatCurrency(d.receita)} | Despesa ${formatCurrency(d.despesa)} | Saldo ${formatCurrency(d.saldo)}">
                    <!-- Tooltip -->
                    <div class="hidden group-hover:block absolute bottom-full mb-2 z-20 pointer-events-none bg-slate-900 text-white text-[11px] rounded-lg p-2.5 shadow-xl whitespace-nowrap border border-slate-700">
                        <div class="font-bold border-b border-slate-700 pb-1 mb-1 text-gray-300">Dia ${d.dia} (${formatDate(d.data)})</div>
                        <div class="text-emerald-400">Receita: ${formatCurrency(d.receita)} (${d.qtd_receita} ops)</div>
                        <div class="text-rose-400">Despesa: ${formatCurrency(d.despesa)} (${d.qtd_despesa} ops)</div>
                        <div class="font-semibold text-gray-200 pt-1 border-t border-slate-700 mt-1">Saldo: ${formatCurrency(d.saldo)}</div>
                    </div>

                    <!-- Bars Stack -->
                    <div class="w-full h-55 flex items-end justify-center gap-0.5">
                        <!-- Receita Bar -->
                        <div class="w-1/2 bg-emerald-500 hover:bg-emerald-400 rounded-t transition-all duration-300" style="height: ${hRec}px;"></div>
                        <!-- Despesa Bar -->
                        <div class="w-1/2 bg-rose-500 hover:bg-rose-400 rounded-t transition-all duration-300" style="height: ${hDesp}px;"></div>
                    </div>

                    <!-- Day Label -->
                    <span class="text-[10px] font-mono text-gray-500 dark:text-gray-400 group-hover:font-bold group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        ${d.dia}
                    </span>
                </div>
            `;
        });

        container.innerHTML = html;
    };

    const renderAnnualChart = (data: VisionData) => {
        const container = getEl('chartAnnualContainer');
        if (!container) return;

        if (getEl('chartAnnualYearLabel')) {
            getEl('chartAnnualYearLabel')!.textContent = `— Ano ${data.params.ano}`;
        }

        const months = data.monthlyComparison || [];
        let maxVal = 1;
        months.forEach(m => {
            if (m.receita > maxVal) maxVal = m.receita;
            if (m.despesa > maxVal) maxVal = m.despesa;
        });

        const chartHeight = 220; // px
        const activeMonth = data.params.mes;

        let html = '';
        months.forEach(m => {
            const isSelected = m.mes === activeMonth;
            const hRec = Math.max(Math.round((m.receita / maxVal) * chartHeight), m.receita > 0 ? 6 : 0);
            const hDesp = Math.max(Math.round((m.despesa / maxVal) * chartHeight), m.despesa > 0 ? 6 : 0);

            html += `
                <div class="flex-1 flex flex-col items-center gap-1 group relative cursor-pointer annual-month-bar ${isSelected ? 'bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl px-1 border border-emerald-300 dark:border-emerald-800/60' : ''}" 
                     data-mes="${m.mes}" title="Clique para abrir ${m.mesNome}: Receita ${formatCurrency(m.receita)} | Despesa ${formatCurrency(m.despesa)}">
                    
                    <!-- Tooltip -->
                    <div class="hidden group-hover:block absolute bottom-full mb-2 z-20 pointer-events-none bg-slate-900 text-white text-[11px] rounded-lg p-2.5 shadow-xl whitespace-nowrap border border-slate-700">
                        <div class="font-bold border-b border-slate-700 pb-1 mb-1 text-gray-300">${m.mesNome} de ${data.params.ano}</div>
                        <div class="text-emerald-400">Receita: ${formatCurrency(m.receita)} (${m.qtd_receita} ops)</div>
                        <div class="text-rose-400">Despesa: ${formatCurrency(m.despesa)} (${m.qtd_despesa} ops)</div>
                        <div class="font-semibold text-gray-200 pt-1 border-t border-slate-700 mt-1">Saldo: ${formatCurrency(m.saldo)}</div>
                    </div>

                    <!-- Bars Stack -->
                    <div class="w-full h-55 flex items-end justify-center gap-1">
                        <!-- Receita Bar -->
                        <div class="w-1/2 bg-emerald-500 hover:bg-emerald-400 rounded-t transition-all duration-300 ${isSelected ? 'ring-2 ring-emerald-400 ring-offset-1' : ''}" style="height: ${hRec}px;"></div>
                        <!-- Despesa Bar -->
                        <div class="w-1/2 bg-rose-500 hover:bg-rose-400 rounded-t transition-all duration-300 ${isSelected ? 'ring-2 ring-rose-400 ring-offset-1' : ''}" style="height: ${hDesp}px;"></div>
                    </div>

                    <!-- Month Label -->
                    <span class="text-[11px] font-semibold ${isSelected ? 'text-emerald-600 dark:text-emerald-400 font-bold underline' : 'text-gray-600 dark:text-gray-400'} group-hover:text-emerald-600 transition-colors">
                        ${m.mesSigla}
                    </span>
                </div>
            `;
        });

        container.innerHTML = html;

        // Click handler to quickly switch month
        container.querySelectorAll('.annual-month-bar').forEach(el => {
            el.addEventListener('click', () => {
                const mesVal = el.getAttribute('data-mes');
                const mesSelect = getEl<HTMLSelectElement>('filterMes');
                if (mesSelect && mesVal) {
                    mesSelect.value = mesVal;
                    void loadFinanceVision();
                }
            });
        });
    };

    const renderBankDistribution = (data: VisionData) => {
        const tbody = getEl('bankTableBody');
        if (!tbody) return;

        const banks = data.byBank || [];
        if (banks.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-gray-400">Nenhum banco com movimentação para os tipos de conta selecionados.</td></tr>';
            return;
        }

        const maxTotal = Math.max(...banks.map(b => b.total_movimentado), 1);

        tbody.innerHTML = banks.map(b => {
            const widthPercent = Math.min(Math.round((b.total_movimentado / maxTotal) * 100), 100);
            const isPositive = b.saldo >= 0;

            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
                    <td class="py-3 px-3">
                        <div class="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
                            <span>${escapeHtml(b.banco)}</span>
                        </div>
                        ${b.conta_numero ? `<div class="text-[11px] text-gray-500 dark:text-gray-400 font-mono">Conta: ${escapeHtml(b.conta_numero)}</div>` : ''}
                        <div class="w-full bg-gray-100 dark:bg-slate-700 h-1 rounded-full mt-1.5 overflow-hidden">
                            <div class="bg-emerald-500 h-full" style="width: ${widthPercent}%;"></div>
                        </div>
                    </td>
                    <td class="py-3 px-3 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        ${formatCurrency(b.receita)}
                    </td>
                    <td class="py-3 px-3 text-right font-mono font-medium text-rose-600 dark:text-rose-400">
                        ${formatCurrency(b.despesa)}
                    </td>
                    <td class="py-3 px-3 text-right font-mono font-bold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
                        ${formatCurrency(b.saldo)}
                    </td>
                </tr>
            `;
        }).join('');
    };

    const renderTopRankings = (data: VisionData) => {
        const despContainer = getEl('topDespesasContainer');
        const recContainer = getEl('topReceitasContainer');

        if (despContainer) {
            const desps = data.topDespesas || [];
            if (desps.length === 0) {
                despContainer.innerHTML = '<p class="text-xs text-gray-400">Sem despesas registradas.</p>';
            } else {
                despContainer.innerHTML = desps.slice(0, 3).map((d: any) => `
                    <div class="p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 flex items-center justify-between gap-2">
                        <div class="min-w-0 flex-1">
                            <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate" title="${escapeHtml(d.historico || d.referencia || d.conta || '')}">${escapeHtml(d.historico || d.referencia || d.conta || 'Despesa')}</p>
                            <p class="text-[10px] text-gray-500 dark:text-gray-400 font-mono">${formatDate(d.data)} • ${escapeHtml(d.banco || '')}${d.tipoconta ? ` • ${escapeHtml(d.tipoconta)}` : ''}</p>
                        </div>
                        <span class="text-xs font-bold font-mono text-rose-600 dark:text-rose-400 shrink-0">${formatCurrency(d.valor)}</span>
                    </div>
                `).join('');
            }
        }

        if (recContainer) {
            const recs = data.topReceitas || [];
            if (recs.length === 0) {
                recContainer.innerHTML = '<p class="text-xs text-gray-400">Sem receitas registradas.</p>';
            } else {
                recContainer.innerHTML = recs.slice(0, 3).map((r: any) => `
                    <div class="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between gap-2">
                        <div class="min-w-0 flex-1">
                            <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate" title="${escapeHtml(r.historico || r.referencia || r.conta || '')}">${escapeHtml(r.historico || r.referencia || r.conta || 'Receita')}</p>
                            <p class="text-[10px] text-gray-500 dark:text-gray-400 font-mono">${formatDate(r.data)} • ${escapeHtml(r.banco || '')}${r.tipoconta ? ` • ${escapeHtml(r.tipoconta)}` : ''}</p>
                        </div>
                        <span class="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 shrink-0">${formatCurrency(r.valor)}</span>
                    </div>
                `).join('');
            }
        }
    };

    // ─── Render Category Checklist Table ─────────────────────────────────────
    const renderCategoryDistribution = () => {
        const tbody = getEl('categoryTableBody');
        const countBadge = getEl('categoryCountBadge');
        const selectedBadge = getEl('categorySelectedBadge');
        const totalSumBadge = getEl('categoryTotalSelectedSum');
        const chkMaster = getEl<HTMLInputElement>('chkSelectAllCategories');
        if (!tbody) return;

        const totalCategories = allCategoriesList.length;
        if (countBadge) countBadge.textContent = `${totalCategories} ${totalCategories === 1 ? 'tipo' : 'tipos'}`;

        const selectedCount = selectedAccountTypes.size;
        if (selectedBadge) {
            selectedBadge.textContent = `${selectedCount} selecionado${selectedCount === 1 ? '' : 's'}`;
            if (selectedCount === 0) {
                selectedBadge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold font-mono';
            } else if (selectedCount === totalCategories) {
                selectedBadge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold font-mono';
            } else {
                selectedBadge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold font-mono';
            }
        }

        // Master Checkbox State
        if (chkMaster) {
            if (totalCategories > 0 && selectedCount === totalCategories) {
                chkMaster.checked = true;
                chkMaster.indeterminate = false;
            } else if (selectedCount > 0 && selectedCount < totalCategories) {
                chkMaster.checked = false;
                chkMaster.indeterminate = true;
            } else {
                chkMaster.checked = false;
                chkMaster.indeterminate = false;
            }
        }

        if (totalCategories === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-gray-400">Nenhum tipo de conta encontrado para este período.</td></tr>';
            if (getEl('categoryFootCount')) getEl('categoryFootCount')!.textContent = '(0 itens)';
            if (getEl('categoryFootBreakdown')) getEl('categoryFootBreakdown')!.innerHTML = 'Rec: R$ 0,00 | Desp: R$ 0,00';
            if (getEl('categoryFootTotal')) getEl('categoryFootTotal')!.textContent = 'R$ 0,00';
            if (totalSumBadge) totalSumBadge.textContent = 'Total: R$ 0,00';
            return;
        }

        // Filter list by categorySearchTerm
        const search = (categorySearchTerm || '').trim().toLowerCase();
        const displayList = allCategoriesList.filter(c => {
            if (!search) return true;
            return c.tipoconta.toLowerCase().includes(search);
        });

        // Totals of selected categories
        let sumSelectedRec = 0;
        let sumSelectedDesp = 0;
        let sumSelectedTotal = 0;
        let countSelectedItems = 0;

        allCategoriesList.forEach(c => {
            if (selectedAccountTypes.has(c.tipoconta)) {
                sumSelectedRec += c.receita;
                sumSelectedDesp += c.despesa;
                sumSelectedTotal += c.valor;
                countSelectedItems += 1;
            }
        });

        const selectedSaldo = sumSelectedRec - sumSelectedDesp;

        if (totalSumBadge) {
            if (selectedSaldo >= 0) {
                totalSumBadge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold font-mono';
            } else {
                totalSumBadge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold font-mono';
            }
            totalSumBadge.textContent = `Saldo: ${formatCurrency(selectedSaldo)} (Mov: ${formatCurrency(sumSelectedTotal)})`;
        }

        // Update Foot
        if (getEl('categoryFootCount')) {
            getEl('categoryFootCount')!.textContent = `(${countSelectedItems} de ${totalCategories} selecionados)`;
        }
        if (getEl('categoryFootBreakdown')) {
            getEl('categoryFootBreakdown')!.innerHTML = `Rec: <span class="text-emerald-600 dark:text-emerald-400 font-bold">${formatCurrency(sumSelectedRec)}</span> | Desp: <span class="text-rose-600 dark:text-rose-400 font-bold">${formatCurrency(sumSelectedDesp)}</span>`;
        }
        if (getEl('categoryFootTotal')) {
            const footTotal = getEl('categoryFootTotal')!;
            if (selectedSaldo >= 0) {
                footTotal.className = 'py-2.5 px-3 text-right font-mono text-xs font-black text-emerald-600 dark:text-emerald-400';
            } else {
                footTotal.className = 'py-2.5 px-3 text-right font-mono text-xs font-black text-rose-600 dark:text-rose-400';
            }
            footTotal.textContent = formatCurrency(selectedSaldo);
        }

        if (displayList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-gray-400">Nenhum tipo de conta corresponde à busca.</td></tr>';
            return;
        }

        const maxVal = Math.max(...allCategoriesList.map(c => c.valor), 1);
        const grandTotalRevenue = allCategoriesList.reduce((acc, c) => acc + c.receita, 0) || 1;
        const grandTotalExpense = allCategoriesList.reduce((acc, c) => acc + c.despesa, 0) || 1;

        tbody.innerHTML = displayList.map(c => {
            const isChecked = selectedAccountTypes.has(c.tipoconta);
            const isRec = c.tipo === 'receita';
            const isMisto = c.tipo === 'misto';

            let badge = '';
            let barClass = 'bg-emerald-500';
            let sharePercent = 0;
            let shareLabel = '';

            if (isMisto) {
                badge = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">Receita & Despesa</span>';
                barClass = 'bg-purple-500';
                sharePercent = ((c.receita + c.despesa) / (grandTotalRevenue + grandTotalExpense)) * 100;
                shareLabel = 'do volume total';
            } else if (isRec) {
                badge = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">Receita</span>';
                barClass = 'bg-emerald-500';
                sharePercent = (c.receita / grandTotalRevenue) * 100;
                shareLabel = 'das receitas';
            } else {
                badge = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">Despesa</span>';
                barClass = 'bg-rose-500';
                sharePercent = (c.despesa / grandTotalExpense) * 100;
                shareLabel = 'das despesas';
            }

            const widthPercent = Math.min(Math.round((c.valor / maxVal) * 100), 100);
            const rowOpacityClass = isChecked ? '' : 'opacity-40 bg-gray-50/50 dark:bg-slate-900/30';
            const textLineClass = isChecked ? '' : 'line-through text-gray-400';

            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors category-row ${rowOpacityClass}" data-tipoconta="${escapeHtml(c.tipoconta)}">
                    <td class="py-2.5 px-3 text-center">
                        <input type="checkbox" class="chk-account-type rounded border-gray-300 text-emerald-600 focus:ring-emerald-500/30 dark:bg-slate-700 dark:border-slate-600 cursor-pointer" data-tipoconta="${escapeHtml(c.tipoconta)}" ${isChecked ? 'checked' : ''} title="Marcar/desmarcar para incluir nos cálculos">
                    </td>
                    <td class="py-2.5 px-3">
                        <div class="font-bold text-gray-900 dark:text-gray-100 ${textLineClass} flex items-center justify-between gap-2">
                            <span>${escapeHtml(c.tipoconta)}</span>
                            <button type="button" class="btn-filter-transactions text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer" data-tipoconta="${escapeHtml(c.tipoconta)}" title="Ver lançamentos deste tipo">
                                Ver lançamentos &darr;
                            </button>
                        </div>
                        <div class="w-full bg-gray-100 dark:bg-slate-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div class="${barClass} h-full transition-all duration-300" style="width: ${Math.max(widthPercent, 1)}%;"></div>
                        </div>
                    </td>
                    <td class="py-2.5 px-3 text-center whitespace-nowrap">
                        ${badge}
                    </td>
                    <td class="py-2.5 px-3 text-center font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        <span class="font-semibold">${c.qtd}</span> <span class="text-[10px] text-gray-400 font-normal">lanç.</span>
                    </td>
                    <td class="py-2.5 px-3 text-right font-mono text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        <span class="font-semibold">${sharePercent.toFixed(1)}%</span>
                        <span class="text-[10px] text-gray-400 block">${shareLabel}</span>
                    </td>
                    <td class="py-2.5 px-3 text-right font-mono font-bold ${isRec ? 'text-emerald-600 dark:text-emerald-400' : (isMisto ? 'text-purple-600 dark:text-purple-400' : 'text-rose-600 dark:text-rose-400')} whitespace-nowrap text-sm ${textLineClass}">
                        ${formatCurrency(c.valor)}
                    </td>
                </tr>
            `;
        }).join('');

        // Wire Row Checkboxes
        tbody.querySelectorAll<HTMLInputElement>('.chk-account-type').forEach(chk => {
            chk.addEventListener('change', (e) => {
                e.stopPropagation();
                const tc = chk.dataset.tipoconta;
                if (!tc) return;
                if (chk.checked) {
                    selectedAccountTypes.add(tc);
                } else {
                    selectedAccountTypes.delete(tc);
                }
                recalculateAndRenderAll();
            });
        });

        // Wire Shortcut to filter transactions table
        tbody.querySelectorAll<HTMLButtonElement>('.btn-filter-transactions').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tc = btn.dataset.tipoconta;
                if (!tc) return;
                const select = getEl<HTMLSelectElement>('transAccountTypeFilter');
                if (select) {
                    select.value = tc;
                    renderTransactionsTable();
                    getEl('transTableBody')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    };

    // ─── Populate Account Type Filter in Transactions Table ──────────────────
    const populateAccountTypeFilter = () => {
        const select = getEl<HTMLSelectElement>('transAccountTypeFilter');
        if (!select || !rawData) return;

        const currentVal = select.value;
        const typeFilter = (getEl<HTMLSelectElement>('transTypeFilter')?.value || 'all').toLowerCase();

        const set = new Set<string>();
        (rawData.transactions || []).forEach(t => {
            const tc = normalizeAccountType(t.tipoconta);
            if (typeFilter === 'all' || t.tipo === typeFilter) {
                set.add(tc);
            }
        });

        const sorted = Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));

        select.innerHTML = '<option value="all">Todos os Tipos de Conta</option>';
        sorted.forEach(tc => {
            const opt = document.createElement('option');
            opt.value = tc;
            opt.textContent = tc;
            if (tc === currentVal) opt.selected = true;
            select.appendChild(opt);
        });

        if (currentVal && currentVal !== 'all' && !set.has(currentVal)) {
            select.value = 'all';
        }
    };

    // ─── Render Detailed Transactions Table ──────────────────────────────────
    const renderTransactionsTable = () => {
        const tbody = getEl('transTableBody');
        const countBadge = getEl('transCountBadge');
        if (!tbody || !rawData) return;

        const filterType = (getEl<HTMLSelectElement>('transTypeFilter')?.value || 'all').toLowerCase();
        const filterAccountType = (getEl<HTMLSelectElement>('transAccountTypeFilter')?.value || 'all').toLowerCase();
        const search = (getEl<HTMLInputElement>('transSearchInput')?.value || '').trim().toLowerCase();

        const filtered = (rawData.transactions || []).filter(t => {
            const tc = normalizeAccountType(t.tipoconta);

            // 1. Must be checked in category checklist
            if (!selectedAccountTypes.has(tc)) return false;

            // 2. Type filter
            if (filterType !== 'all' && t.tipo !== filterType) return false;

            // 3. Dropdown Account Type filter
            if (filterAccountType !== 'all' && tc.toLowerCase() !== filterAccountType) return false;

            // 4. Text search
            if (search) {
                const doc = String(t.documento || '').toLowerCase();
                const cdbaixa = String(t.cdcontabaixa || t.id || '').toLowerCase();
                const hist = String(t.historico || '').toLowerCase();
                const banco = String(t.banco || '').toLowerCase();
                const tipoconta = tc.toLowerCase();
                const conta = String(t.conta || '').toLowerCase();
                const ref = String(t.referencia || '').toLowerCase();
                const filial = String(t.nome_filial || t.filial || '').toLowerCase();
                if (!doc.includes(search) && !cdbaixa.includes(search) && !hist.includes(search) && !banco.includes(search) && !tipoconta.includes(search) && !conta.includes(search) && !ref.includes(search) && !filial.includes(search)) {
                    return false;
                }
            }
            return true;
        });

        let totalReceita = 0;
        let totalDespesa = 0;
        let totalGeral = 0;

        filtered.forEach(t => {
            const val = Number(t.valor || 0);
            totalGeral += val;
            if (t.tipo === 'receita') {
                totalReceita += val;
            } else {
                totalDespesa += val;
            }
        });

        const saldo = totalReceita - totalDespesa;

        if (countBadge) countBadge.textContent = String(filtered.length);

        // Update Total Sum Badge
        const totalSumBadge = getEl('transTotalSumBadge');
        if (totalSumBadge) {
            if (filterType === 'receita') {
                totalSumBadge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold font-mono';
                totalSumBadge.textContent = `Total: ${formatCurrency(totalReceita)}`;
            } else if (filterType === 'despesa') {
                totalSumBadge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold font-mono';
                totalSumBadge.textContent = `Total: ${formatCurrency(totalDespesa)}`;
            } else {
                if (saldo >= 0) {
                    totalSumBadge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold font-mono';
                } else {
                    totalSumBadge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold font-mono';
                }
                totalSumBadge.textContent = `Saldo: ${formatCurrency(saldo)} (Total: ${formatCurrency(totalGeral)})`;
            }
        }

        // Update Subtotals
        const subtotals = getEl('transSubtotals');
        if (subtotals) {
            subtotals.innerHTML = `Receitas: <strong class="text-emerald-600 dark:text-emerald-400">${formatCurrency(totalReceita)}</strong> | Despesas: <strong class="text-rose-600 dark:text-rose-400">${formatCurrency(totalDespesa)}</strong> | Saldo: <strong class="${saldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">${formatCurrency(saldo)}</strong>`;
        }

        // Update Table Foot
        if (getEl('transFootCount')) {
            getEl('transFootCount')!.textContent = `(${filtered.length} ${filtered.length === 1 ? 'item' : 'itens'})`;
        }
        if (getEl('transFootBreakdown')) {
            getEl('transFootBreakdown')!.innerHTML = `Rec: <span class="text-emerald-600 dark:text-emerald-400 font-bold">${formatCurrency(totalReceita)}</span> | Desp: <span class="text-rose-600 dark:text-rose-400 font-bold">${formatCurrency(totalDespesa)}</span>`;
        }
        if (getEl('transFootTotal')) {
            const footTotal = getEl('transFootTotal')!;
            if (filterType === 'receita') {
                footTotal.className = 'py-3 px-3 text-right font-mono text-sm font-black text-emerald-600 dark:text-emerald-400';
                footTotal.textContent = formatCurrency(totalReceita);
            } else if (filterType === 'despesa') {
                footTotal.className = 'py-3 px-3 text-right font-mono text-sm font-black text-rose-600 dark:text-rose-400';
                footTotal.textContent = formatCurrency(totalDespesa);
            } else {
                footTotal.className = `py-3 px-3 text-right font-mono text-sm font-black ${saldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`;
                footTotal.textContent = formatCurrency(saldo);
            }
        }

        if (filtered.length === 0) {
            if (selectedAccountTypes.size === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-gray-400">Nenhum tipo de conta selecionado no checklist acima. Marque os tipos de conta para visualizar os lançamentos.</td></tr>';
            } else {
                tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-gray-400">Nenhum lançamento corresponde ao filtro.</td></tr>';
            }
            return;
        }

        tbody.innerHTML = filtered.map(t => {
            const isRec = t.tipo === 'receita';
            const typeBadge = isRec
                ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">Receita</span>'
                : '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">Despesa</span>';

            const valClass = isRec ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold';

            const displayCdBaixa = t.cdcontabaixa ?? t.id ?? '-';
            const displayFilial = t.nome_filial ? t.nome_filial : `Filial ${t.filial}`;
            const normalizedTc = normalizeAccountType(t.tipoconta);
            const displayTipoConta = normalizedTc !== '(Sem Tipo)' ? `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300">${escapeHtml(normalizedTc)}</span>` : '<span class="text-gray-400">-</span>';
            const displayConta = t.conta ? `<div class="font-semibold text-gray-900 dark:text-gray-100">${escapeHtml(t.conta)}</div>` : '';
            const displayRef = t.referencia ? `<div class="text-[11px] text-gray-500 dark:text-gray-400">${escapeHtml(t.referencia)}</div>` : (t.historico ? `<div class="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-xs" title="${escapeHtml(t.historico)}">${escapeHtml(t.historico)}</div>` : '');

            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
                    <td class="py-2.5 px-3 font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">${formatDate(t.data)}</td>
                    <td class="py-2.5 px-3 font-mono text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-700/80 text-gray-800 dark:text-gray-200 text-[11px] font-mono font-semibold">#${displayCdBaixa}</span>
                    </td>
                    <td class="py-2.5 px-3 text-center whitespace-nowrap">${typeBadge}</td>
                    <td class="py-2.5 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-[11px] font-medium">${escapeHtml(displayFilial)}</td>
                    <td class="py-2.5 px-3 whitespace-nowrap">${displayTipoConta}</td>
                    <td class="py-2.5 px-3">
                        ${displayConta}
                        ${displayRef}
                    </td>
                    <td class="py-2.5 px-3 text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">${escapeHtml(t.banco)}</td>
                    <td class="py-2.5 px-3 text-right font-mono ${valClass} whitespace-nowrap">${formatCurrency(t.valor)}</td>
                </tr>
            `;
        }).join('');
    };

    // ─── Recalculate & Re-render Everything ──────────────────────────────────
    const recalculateAndRenderAll = () => {
        const res = getRecalculatedData();
        if (!res) return;

        renderKPIs(res.activeData);
        renderDailyChart(res.activeData);
        renderBankDistribution(res.activeData);
        renderTopRankings(res.activeData);
        renderCategoryDistribution();
        renderTransactionsTable();
    };

    // ─── Export CSV ──────────────────────────────────────────────────────────
    const exportToCSV = () => {
        if (!rawData || !rawData.transactions.length) {
            alert('Não há dados carregados para exportação.');
            return;
        }

        const filterType = (getEl<HTMLSelectElement>('transTypeFilter')?.value || 'all').toLowerCase();
        const filterAccountType = (getEl<HTMLSelectElement>('transAccountTypeFilter')?.value || 'all').toLowerCase();
        const search = (getEl<HTMLInputElement>('transSearchInput')?.value || '').trim().toLowerCase();

        const filtered = (rawData.transactions || []).filter(t => {
            const tc = normalizeAccountType(t.tipoconta);
            if (!selectedAccountTypes.has(tc)) return false;
            if (filterType !== 'all' && t.tipo !== filterType) return false;
            if (filterAccountType !== 'all' && tc.toLowerCase() !== filterAccountType) return false;
            if (search) {
                const doc = String(t.documento || '').toLowerCase();
                const hist = String(t.historico || '').toLowerCase();
                const banco = String(t.banco || '').toLowerCase();
                const tipoconta = tc.toLowerCase();
                const conta = String(t.conta || '').toLowerCase();
                const ref = String(t.referencia || '').toLowerCase();
                const filial = String(t.nome_filial || t.filial || '').toLowerCase();
                if (!doc.includes(search) && !hist.includes(search) && !banco.includes(search) && !tipoconta.includes(search) && !conta.includes(search) && !ref.includes(search) && !filial.includes(search)) {
                    return false;
                }
            }
            return true;
        });

        if (filtered.length === 0) {
            alert('Nenhum registro corresponde aos filtros e tipos de conta selecionados para exportação.');
            return;
        }

        const headers = ['Data', 'cdcontabaixa', 'Tipo', 'Filial', 'Tipo de Conta', 'Conta', 'Referência / Histórico', 'Banco / Caixa', 'Valor (R$)'];
        const rows = filtered.map(t => [
            t.data,
            String(t.cdcontabaixa ?? t.id ?? ''),
            t.tipo.toUpperCase(),
            `"${String(t.nome_filial || t.filial).replace(/"/g, '""')}"`,
            `"${String(t.tipoconta || '').replace(/"/g, '""')}"`,
            `"${String(t.conta || '').replace(/"/g, '""')}"`,
            `"${String(t.referencia || t.historico || '').replace(/"/g, '""')}"`,
            `"${String(t.banco).replace(/"/g, '""')}"`,
            t.valor.toFixed(2).replace('.', ',')
        ]);

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `visao_fin_solidcon_${rawData.params.ano}_${rawData.params.mes}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ─── Fetch Data from API ─────────────────────────────────────────────────
    const loadFinanceVision = async () => {
        if (isLoading) return;
        isLoading = true;
        hideAlert();
        updateStatusBadge('loading', 'Consultando Solidcon (vwaporttec_contas)...');

        const companyParam = getEl<HTMLSelectElement>('filterCompany')?.value || '';
        const ano = getEl<HTMLSelectElement>('filterAno')?.value || String(new Date().getFullYear());
        const mes = getEl<HTMLSelectElement>('filterMes')?.value || String(new Date().getMonth() + 1);
        const filial = getEl<HTMLSelectElement>('filterFilial')?.value || '';
        const source = getEl<HTMLSelectElement>('filterSource')?.value || 'conta_baixa';
        const connId = getEl<HTMLSelectElement>('filterConnection')?.value || '';

        const filterBtn = getEl<HTMLButtonElement>('btnFilterApply');
        const filterIcon = getEl('btnFilterIcon');
        if (filterBtn) filterBtn.disabled = true;
        if (filterIcon) filterIcon.classList.add('animate-spin');

        try {
            let url = `/finance/solidcon-vision?ano=${encodeURIComponent(ano)}&mes=${encodeURIComponent(mes)}&source=${encodeURIComponent(source)}`;
            if (companyParam) url += `&targetCompanyId=${encodeURIComponent(companyParam)}`;
            if (filial) url += `&cdFilial=${encodeURIComponent(filial)}`;
            if (connId) url += `&connectionId=${encodeURIComponent(connId)}`;

            const res = await api(url);
            const data: VisionData = res?.data;

            if (!data) {
                throw new Error('Nenhum dado retornado do servidor.');
            }

            rawData = data;

            // Build categories list
            allCategoriesList = buildCategoriesList(data);

            // Select all categories by default on new fetch
            selectedAccountTypes = new Set(allCategoriesList.map(c => c.tipoconta));

            // Update Filial select if new filiais returned
            if (data.filiais && data.filiais.length > 0) {
                const filialSelect = getEl<HTMLSelectElement>('filterFilial');
                if (filialSelect) {
                    const currentVal = filialSelect.value;
                    filialSelect.innerHTML = '<option value="">Todas as Filiais</option>';
                    data.filiais.forEach((f: any) => {
                        const opt = document.createElement('option');
                        const fId = typeof f === 'object' ? String(f.id) : String(f);
                        const fNome = typeof f === 'object' ? (f.nome || `Filial ${f.id}`) : `Filial ${f}`;
                        opt.value = fId;
                        opt.textContent = fNome;
                        if (fId === currentVal) opt.selected = true;
                        filialSelect.appendChild(opt);
                    });
                }
            }

            if (getEl('connectionBadge')) {
                const compDisplay = res.company?.trade_name || res.company?.company_name || '';
                const connDisplay = res.connection?.name || 'Solidcon Principal';
                getEl('connectionBadge')!.textContent = `• ${compDisplay ? `${compDisplay} | ` : ''}${connDisplay}`;
            }

            updateStatusBadge('success', `Conectado (${data.summary.qtdReceita + data.summary.qtdDespesa} lançamentos)`);
            
            renderAnnualChart(data); // Static annual overview for reference
            populateAccountTypeFilter();
            recalculateAndRenderAll();
        } catch (err: any) {
            const msg = err?.message || String(err);
            updateStatusBadge('error', 'Falha na Conexão');
            showAlert(`Erro ao carregar dados do Solidcon: ${msg}`, 'error');
        } finally {
            isLoading = false;
            if (filterBtn) filterBtn.disabled = false;
            if (filterIcon) filterIcon.classList.remove('animate-spin');
        }
    };

    // ─── Setup Checklist Action Handlers ─────────────────────────────────────
    const setupChecklistActions = () => {
        // Master Checkbox
        getEl('chkSelectAllCategories')?.addEventListener('change', (e) => {
            const chk = e.target as HTMLInputElement;
            if (chk.checked) {
                selectedAccountTypes = new Set(allCategoriesList.map(c => c.tipoconta));
            } else {
                selectedAccountTypes.clear();
            }
            recalculateAndRenderAll();
        });

        // "Marcar Todos" button
        getEl('btnSelectAllCategories')?.addEventListener('click', () => {
            selectedAccountTypes = new Set(allCategoriesList.map(c => c.tipoconta));
            recalculateAndRenderAll();
        });

        // "Desmarcar Todos" button
        getEl('btnDeselectAllCategories')?.addEventListener('click', () => {
            selectedAccountTypes.clear();
            recalculateAndRenderAll();
        });

        // "Somente Receitas" button
        getEl('btnSelectOnlyRevenueCategories')?.addEventListener('click', () => {
            selectedAccountTypes.clear();
            allCategoriesList.forEach(c => {
                if (c.tipo === 'receita' || c.receita > 0) {
                    selectedAccountTypes.add(c.tipoconta);
                }
            });
            recalculateAndRenderAll();
        });

        // "Somente Despesas" button
        getEl('btnSelectOnlyExpenseCategories')?.addEventListener('click', () => {
            selectedAccountTypes.clear();
            allCategoriesList.forEach(c => {
                if (c.tipo === 'despesa' || c.despesa > 0) {
                    selectedAccountTypes.add(c.tipoconta);
                }
            });
            recalculateAndRenderAll();
        });

        // Category Search Input
        getEl('categorySearchInput')?.addEventListener('input', (e) => {
            categorySearchTerm = (e.target as HTMLInputElement).value;
            renderCategoryDistribution();
        });
    };

    // ─── DOMContentLoaded Init ───────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', async () => {
        populateYearDropdown();

        // Set current month in select
        const mesSelect = getEl<HTMLSelectElement>('filterMes');
        if (mesSelect) {
            mesSelect.value = String(new Date().getMonth() + 1);
        }

        setupChecklistActions();

        await loadCompanies();
        const initialCompany = getEl<HTMLSelectElement>('filterCompany')?.value || '';
        await loadSolidconConnections(initialCompany);

        getEl('filterForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            void loadFinanceVision();
        });

        getEl('filterCompany')?.addEventListener('change', async () => {
            const selectedCompany = getEl<HTMLSelectElement>('filterCompany')?.value || '';
            localStorage.setItem('fin_solidcon_vision_company', selectedCompany);
            await loadSolidconConnections(selectedCompany);
            await loadFinanceVision();
        });

        getEl('filterConnection')?.addEventListener('change', () => {
            const companyParam = getEl<HTMLSelectElement>('filterCompany')?.value || '';
            const connVal = getEl<HTMLSelectElement>('filterConnection')?.value || '';
            localStorage.setItem(`fin_solidcon_vision_conn_${companyParam || 'default'}`, connVal);
            void loadFinanceVision();
        });

        getEl('filterAno')?.addEventListener('change', () => void loadFinanceVision());
        getEl('filterMes')?.addEventListener('change', () => void loadFinanceVision());
        getEl('filterSource')?.addEventListener('change', () => void loadFinanceVision());
        getEl('filterFilial')?.addEventListener('change', () => void loadFinanceVision());

        getEl('transTypeFilter')?.addEventListener('change', () => {
            populateAccountTypeFilter();
            renderTransactionsTable();
        });
        getEl('transAccountTypeFilter')?.addEventListener('change', renderTransactionsTable);
        getEl('transSearchInput')?.addEventListener('input', renderTransactionsTable);
        getEl('btnExportCsv')?.addEventListener('click', exportToCSV);

        // Initial fetch
        await loadFinanceVision();
    });
})();
