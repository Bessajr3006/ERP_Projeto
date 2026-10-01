// @ts-nocheck
/**
 * fin_solidcon_vision.ts
 * Painel Analítico de Receitas vs Despesas do Banco Solidcon
 */

(() => {
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
        transactions: Array<{
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
        }>;
        filiais: Array<{ id: number | string; nome: string } | number | string>;
    }

    let currentData: VisionData | null = null;
    let isLoading = false;

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

    function escapeHtml(value: any): string {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

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
            // fallback default
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
        if (days.length === 0) {
            container.innerHTML = '<div class="w-full text-center py-12 text-gray-400 text-xs">Sem movimentação registrada para este mês.</div>';
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
                        <div class="text-emerald-400">Receita: ${formatCurrency(d.receita)}</div>
                        <div class="text-rose-400">Despesa: ${formatCurrency(d.despesa)}</div>
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
            tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-gray-400">Nenhum banco com movimentação no período.</td></tr>';
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
                            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>${b.banco}</span>
                        </div>
                        ${b.conta_numero ? `<div class="text-[11px] text-gray-500 dark:text-gray-400 font-mono">Conta: ${b.conta_numero}</div>` : ''}
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
                    <td class="py-3 px-3 text-right font-mono text-gray-700 dark:text-gray-300">
                        ${formatCurrency(b.total_movimentado)}
                        <div class="text-[10px] text-gray-400 font-normal">${b.qtd} ops</div>
                    </td>
                </tr>
            `;
        }).join('');
    };

    const renderCategoryDistribution = (data: VisionData) => {
        const tbody = getEl('categoryTableBody');
        const countBadge = getEl('categoryCountBadge');
        if (!tbody) return;

        const cats = data.byCategory || [];
        if (countBadge) countBadge.textContent = String(cats.length);

        if (cats.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-gray-400">Nenhuma categoria encontrada no período.</td></tr>';
            return;
        }

        const maxVal = Math.max(...cats.map(c => c.valor), 1);
        const totalRec = data.summary?.totalReceita || 1;
        const totalDesp = data.summary?.totalDespesa || 1;

        tbody.innerHTML = cats.map(c => {
            const isRec = c.tipo === 'receita';
            const groupTotal = isRec ? totalRec : totalDesp;
            const sharePercent = groupTotal > 0 ? (c.valor / groupTotal) * 100 : 0;
            const widthPercent = Math.min(Math.round((c.valor / maxVal) * 100), 100);

            const badge = isRec
                ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">Receita</span>'
                : '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">Despesa</span>';
            const barClass = isRec ? 'bg-emerald-500' : 'bg-rose-500';

            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors cursor-pointer category-row" data-tipoconta="${c.tipoconta}" title="Clique para filtrar lançamentos por '${c.tipoconta}'">
                    <td class="py-2.5 px-3">
                        <div class="font-bold text-gray-900 dark:text-gray-100">
                            ${c.tipoconta}
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
                        <span class="text-[10px] text-gray-400 block">${isRec ? 'das receitas' : 'das despesas'}</span>
                    </td>
                    <td class="py-2.5 px-3 text-right font-mono font-bold ${isRec ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} whitespace-nowrap text-sm">
                        ${formatCurrency(c.valor)}
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll<HTMLTableRowElement>('.category-row').forEach(row => {
            row.addEventListener('click', () => {
                const tc = row.dataset.tipoconta;
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
                            <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate" title="${d.historico}">${d.historico}</p>
                            <p class="text-[10px] text-gray-500 dark:text-gray-400 font-mono">${formatDate(d.data)} • ${d.banco || ''}</p>
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
                            <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate" title="${r.historico}">${r.historico}</p>
                            <p class="text-[10px] text-gray-500 dark:text-gray-400 font-mono">${formatDate(r.data)} • ${r.banco || ''}</p>
                        </div>
                        <span class="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 shrink-0">${formatCurrency(r.valor)}</span>
                    </div>
                `).join('');
            }
        }
    };

    const populateAccountTypeFilter = () => {
        const select = getEl<HTMLSelectElement>('transAccountTypeFilter');
        if (!select || !currentData) return;

        const currentVal = select.value;
        const typeFilter = (getEl<HTMLSelectElement>('transTypeFilter')?.value || 'all').toLowerCase();

        const set = new Set<string>();
        (currentData.transactions || []).forEach(t => {
            if (t.tipoconta && t.tipoconta.trim()) {
                if (typeFilter === 'all' || t.tipo === typeFilter) {
                    set.add(t.tipoconta.trim());
                }
            }
        });

        if (currentData.byCategory) {
            currentData.byCategory.forEach(c => {
                if (c.tipoconta && c.tipoconta.trim()) {
                    if (typeFilter === 'all' || c.tipo === typeFilter) {
                        set.add(c.tipoconta.trim());
                    }
                }
            });
        }

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

    const renderTransactionsTable = () => {
        const tbody = getEl('transTableBody');
        const countBadge = getEl('transCountBadge');
        if (!tbody || !currentData) return;

        const filterType = (getEl<HTMLSelectElement>('transTypeFilter')?.value || 'all').toLowerCase();
        const filterAccountType = (getEl<HTMLSelectElement>('transAccountTypeFilter')?.value || 'all').toLowerCase();
        const search = (getEl<HTMLInputElement>('transSearchInput')?.value || '').trim().toLowerCase();

        const filtered = (currentData.transactions || []).filter(t => {
            if (filterType !== 'all' && t.tipo !== filterType) return false;
            if (filterAccountType !== 'all' && String(t.tipoconta || '').trim().toLowerCase() !== filterAccountType) return false;
            if (search) {
                const doc = String(t.documento || '').toLowerCase();
                const cdbaixa = String(t.cdcontabaixa || t.id || '').toLowerCase();
                const hist = String(t.historico || '').toLowerCase();
                const banco = String(t.banco || '').toLowerCase();
                const tipoconta = String(t.tipoconta || '').toLowerCase();
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
            tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-gray-400">Nenhum lançamento corresponde ao filtro.</td></tr>';
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
            const displayTipoConta = t.tipoconta ? `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300">${t.tipoconta}</span>` : '-';
            const displayConta = t.conta ? `<div class="font-semibold text-gray-900 dark:text-gray-100">${t.conta}</div>` : '';
            const displayRef = t.referencia ? `<div class="text-[11px] text-gray-500 dark:text-gray-400">${t.referencia}</div>` : (t.historico ? `<div class="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-xs" title="${t.historico}">${t.historico}</div>` : '');

            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
                    <td class="py-2.5 px-3 font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">${formatDate(t.data)}</td>
                    <td class="py-2.5 px-3 font-mono text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-700/80 text-gray-800 dark:text-gray-200 text-[11px] font-mono font-semibold">#${displayCdBaixa}</span>
                    </td>
                    <td class="py-2.5 px-3 text-center whitespace-nowrap">${typeBadge}</td>
                    <td class="py-2.5 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-[11px] font-medium">${displayFilial}</td>
                    <td class="py-2.5 px-3 whitespace-nowrap">${displayTipoConta}</td>
                    <td class="py-2.5 px-3">
                        ${displayConta}
                        ${displayRef}
                    </td>
                    <td class="py-2.5 px-3 text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">${t.banco}</td>
                    <td class="py-2.5 px-3 text-right font-mono ${valClass} whitespace-nowrap">${formatCurrency(t.valor)}</td>
                </tr>
            `;
        }).join('');
    };

    const exportToCSV = () => {
        if (!currentData || !currentData.transactions.length) {
            alert('Não há dados carregados para exportação.');
            return;
        }

        const filterType = (getEl<HTMLSelectElement>('transTypeFilter')?.value || 'all').toLowerCase();
        const filterAccountType = (getEl<HTMLSelectElement>('transAccountTypeFilter')?.value || 'all').toLowerCase();
        const search = (getEl<HTMLInputElement>('transSearchInput')?.value || '').trim().toLowerCase();

        const filtered = (currentData.transactions || []).filter(t => {
            if (filterType !== 'all' && t.tipo !== filterType) return false;
            if (filterAccountType !== 'all' && String(t.tipoconta || '').trim().toLowerCase() !== filterAccountType) return false;
            if (search) {
                const doc = String(t.documento || '').toLowerCase();
                const hist = String(t.historico || '').toLowerCase();
                const banco = String(t.banco || '').toLowerCase();
                const tipoconta = String(t.tipoconta || '').toLowerCase();
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
            alert('Nenhum registro corresponde aos filtros selecionados para exportação.');
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
        link.setAttribute('download', `visao_fin_solidcon_${currentData.params.ano}_${currentData.params.mes}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

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

            currentData = data;

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
            renderKPIs(data);
            renderDailyChart(data);
            renderAnnualChart(data);
            renderBankDistribution(data);
            renderCategoryDistribution(data);
            renderTopRankings(data);
            populateAccountTypeFilter();
            renderTransactionsTable();
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

    // Event Listeners
    document.addEventListener('DOMContentLoaded', async () => {
        populateYearDropdown();

        // Set current month in select
        const mesSelect = getEl<HTMLSelectElement>('filterMes');
        if (mesSelect) {
            mesSelect.value = String(new Date().getMonth() + 1);
        }

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
