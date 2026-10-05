// @ts-nocheck
/**
 * fin_solidcon_vision.ts
 * Painel Analítico de Receitas vs Despesas do Banco Solidcon
 * Suporte a Checklist Separado por Receitas e Despesas (vwaporttec_contas)
 * e Recálculo Dinâmico do Comparativo Anual (12 Meses)
 */
(() => {
    let rawData = null;
    let isLoading = false;
    // Checklist State: Keys formatted as "receita:TipoDeConta" and "despesa:TipoDeConta"
    let selectedCategoryKeys = new Set();
    let revenueCategoriesList = [];
    let expenseCategoriesList = [];
    let categorySearchTerm = '';
    const MONTH_NAMES = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const getEl = (id) => document.getElementById(id);
    const formatCurrency = (val) => {
        const num = Number(val || 0);
        return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };
    const formatDate = (dateStr) => {
        if (!dateStr)
            return '-';
        const parts = String(dateStr).split('T')[0].split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    };
    const normalizeAccountType = (tc) => {
        if (!tc || !tc.trim())
            return '(Sem Tipo)';
        return tc.trim();
    };
    const makeKey = (tipo, tc) => {
        return `${tipo}:${normalizeAccountType(tc)}`;
    };
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    // ─── Persistence Helpers ──────────────────────────────────────────────────
    const saveCategorySelection = (targetCompany) => {
        const companyParam = targetCompany || getEl('filterCompany')?.value || 'default';
        try {
            localStorage.setItem(`fin_solidcon_vision_cat_saved_${companyParam}`, 'true');
            localStorage.setItem(`fin_solidcon_vision_categories_${companyParam}`, JSON.stringify(Array.from(selectedCategoryKeys)));
        }
        catch (e) {
            console.warn('Falha ao salvar categorias no localStorage:', e);
        }
    };
    const restoreCategorySelection = (companyParam, allCategories) => {
        const compKey = companyParam || 'default';
        const hasSaved = localStorage.getItem(`fin_solidcon_vision_cat_saved_${compKey}`) === 'true';
        selectedCategoryKeys = new Set();
        if (hasSaved) {
            try {
                const raw = localStorage.getItem(`fin_solidcon_vision_categories_${compKey}`);
                if (raw) {
                    const arr = JSON.parse(raw);
                    if (Array.isArray(arr)) {
                        arr.forEach((k) => selectedCategoryKeys.add(k));
                    }
                }
            }
            catch (e) {
                console.warn('Falha ao restaurar categorias do localStorage:', e);
                allCategories.forEach(c => selectedCategoryKeys.add(makeKey(c.tipo, c.tipoconta)));
            }
        }
        else {
            // Padrão na primeira vez: seleciona todas as categorias
            allCategories.forEach(c => selectedCategoryKeys.add(makeKey(c.tipo, c.tipoconta)));
        }
    };
    const populateYearDropdown = () => {
        const select = getEl('filterAno');
        if (!select)
            return;
        const currentYear = new Date().getFullYear();
        const savedYear = localStorage.getItem('fin_solidcon_vision_ano');
        select.innerHTML = '';
        for (let y = currentYear; y >= currentYear - 4; y--) {
            const opt = document.createElement('option');
            opt.value = String(y);
            opt.textContent = String(y);
            if (savedYear ? String(y) === savedYear : y === currentYear) {
                opt.selected = true;
            }
            select.appendChild(opt);
        }
        if (savedYear && !select.querySelector(`option[value="${savedYear}"]`)) {
            const opt = document.createElement('option');
            opt.value = savedYear;
            opt.textContent = savedYear;
            opt.selected = true;
            select.appendChild(opt);
        }
    };
    // ─── Company & Solidcon Connections ──────────────────────────────────────
    let accessibleCompanies = [];
    let currentCompanyPublicId = '';
    async function loadCompanies() {
        const compSelect = getEl('filterCompany');
        if (!compSelect)
            return;
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
                }
                catch (e) { }
            }
            if (list.length === 0 && activeCompany) {
                list = [activeCompany];
            }
            accessibleCompanies = list;
            const savedCompanyId = localStorage.getItem('fin_solidcon_vision_company');
            compSelect.innerHTML = accessibleCompanies.map((c) => {
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
        }
        catch (err) {
            console.warn('Falha ao carregar lista de empresas:', err);
            compSelect.innerHTML = '<option value="">Minha Empresa</option>';
        }
    }
    const loadSolidconConnections = async (targetCompany) => {
        const select = getEl('filterConnection');
        if (!select)
            return;
        const companyParam = targetCompany || getEl('filterCompany')?.value || '';
        try {
            select.innerHTML = '<option value="">Carregando conexões...</option>';
            const url = `/finance/reports/solidcon-connections${companyParam ? `?targetCompanyId=${encodeURIComponent(companyParam)}` : ''}`;
            const res = await api(url);
            const conns = res?.data || [];
            select.innerHTML = '<option value="">Padrão da Empresa (Solidcon)</option>';
            conns.forEach((c) => {
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
        }
        catch (e) {
            select.innerHTML = '<option value="">Padrão da Empresa (Solidcon)</option>';
        }
    };
    const updateStatusBadge = (status, text) => {
        const badge = getEl('statusBadge');
        if (!badge)
            return;
        if (status === 'loading') {
            badge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
            badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span> ' + (text || 'Consultando...');
        }
        else if (status === 'success') {
            badge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
            badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span> ' + (text || 'Conectado ao Solidcon');
        }
        else if (status === 'error') {
            badge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
            badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-500"></span> ' + (text || 'Falha na Conexão');
        }
        else {
            badge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700';
            badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-gray-400"></span> ' + (text || 'Pronto para consultar');
        }
    };
    const showAlert = (message, type) => {
        const box = getEl('alertMessage');
        if (!box)
            return;
        let bgClass = 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200 border-blue-200 dark:border-blue-800';
        if (type === 'error')
            bgClass = 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200 border-rose-200 dark:border-rose-800';
        if (type === 'success')
            bgClass = 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800';
        if (type === 'warning')
            bgClass = 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 border-amber-200 dark:border-amber-800';
        box.className = `p-4 rounded-xl text-sm border ${bgClass} mb-6`;
        box.innerHTML = message;
        box.classList.remove('hidden');
    };
    const hideAlert = () => {
        const box = getEl('alertMessage');
        if (box)
            box.classList.add('hidden');
    };
    // ─── Extract & Separate Categories (Receitas e Despesas) ──────────────────
    const extractSeparatedCategories = (data) => {
        const recMap = new Map();
        const despMap = new Map();
        // 1. Current month transactions
        (data.transactions || []).forEach(t => {
            const tc = normalizeAccountType(t.tipoconta);
            const val = Number(t.valor || 0);
            if (t.tipo === 'receita') {
                if (!recMap.has(tc))
                    recMap.set(tc, { tipoconta: tc, valor: 0, qtd: 0 });
                const item = recMap.get(tc);
                item.valor += val;
                item.qtd += 1;
            }
            else {
                if (!despMap.has(tc))
                    despMap.set(tc, { tipoconta: tc, valor: 0, qtd: 0 });
                const item = despMap.get(tc);
                item.valor += val;
                item.qtd += 1;
            }
        });
        // 2. Month byCategory
        if (Array.isArray(data.byCategory)) {
            data.byCategory.forEach(c => {
                const tc = normalizeAccountType(c.tipoconta);
                const val = Number(c.valor || 0);
                const qtd = c.qtd || 1;
                if (c.tipo === 'receita') {
                    if (!recMap.has(tc))
                        recMap.set(tc, { tipoconta: tc, valor: val, qtd });
                }
                else {
                    if (!despMap.has(tc))
                        despMap.set(tc, { tipoconta: tc, valor: val, qtd });
                }
            });
        }
        // 3. Annual byCategory (to make sure all categories of the whole year are visible)
        if (Array.isArray(data.annualByCategory)) {
            data.annualByCategory.forEach(c => {
                const tc = normalizeAccountType(c.tipoconta);
                const val = Number(c.valor || 0);
                const qtd = c.qtd || 1;
                if (c.tipo === 'receita') {
                    if (!recMap.has(tc)) {
                        recMap.set(tc, { tipoconta: tc, valor: 0, qtd: 0 });
                    }
                }
                else {
                    if (!despMap.has(tc)) {
                        despMap.set(tc, { tipoconta: tc, valor: 0, qtd: 0 });
                    }
                }
            });
        }
        const revenues = Array.from(recMap.values()).map(r => ({
            tipo: 'receita',
            tipoconta: r.tipoconta,
            valor: r.valor,
            qtd: r.qtd
        })).sort((a, b) => b.valor - a.valor);
        const expenses = Array.from(despMap.values()).map(d => ({
            tipo: 'despesa',
            tipoconta: d.tipoconta,
            valor: d.valor,
            qtd: d.qtd
        })).sort((a, b) => b.valor - a.valor);
        return { revenues, expenses };
    };
    // ─── Recalculate Active Data based on Checklist ──────────────────────────
    const getRecalculatedData = () => {
        if (!rawData)
            return null;
        const allTrans = rawData.transactions || [];
        const activeTransactions = allTrans.filter(t => {
            const key = makeKey(t.tipo, t.tipoconta);
            return selectedCategoryKeys.has(key);
        });
        let totalReceita = 0;
        let totalDespesa = 0;
        let qtdReceita = 0;
        let qtdDespesa = 0;
        // Daily Evolution map (1..31)
        const dailyMap = new Map();
        // Bank Map
        const bankMap = new Map();
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
        const topRecs = [];
        const topDesps = [];
        activeTransactions.forEach(t => {
            const val = Number(t.valor || 0);
            const isRec = t.tipo === 'receita';
            if (isRec) {
                totalReceita += val;
                qtdReceita += 1;
                topRecs.push(t);
            }
            else {
                totalDespesa += val;
                qtdDespesa += 1;
                topDesps.push(t);
            }
            // Day evolution
            let dayNum = 1;
            if (t.data) {
                const parts = String(t.data).split('T')[0].split('-');
                if (parts.length === 3)
                    dayNum = parseInt(parts[2], 10) || 1;
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
            const dayItem = dailyMap.get(dayNum);
            if (isRec) {
                dayItem.receita += val;
                dayItem.qtd_receita += 1;
            }
            else {
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
            const bItem = bankMap.get(bankKey);
            if (isRec) {
                bItem.receita += val;
            }
            else {
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
        // ── Recalculate 12-Month Comparison with Checklist Categories ────────
        let monthlyComparison = rawData.monthlyComparison || [];
        if (Array.isArray(rawData.annualByCategory) && rawData.annualByCategory.length > 0) {
            const annualMap = new Map();
            for (let m = 1; m <= 12; m++) {
                annualMap.set(m, {
                    mes: m,
                    receita: 0,
                    despesa: 0,
                    qtd_receita: 0,
                    qtd_despesa: 0
                });
            }
            rawData.annualByCategory.forEach(c => {
                const key = makeKey(c.tipo, c.tipoconta);
                if (selectedCategoryKeys.has(key)) {
                    const item = annualMap.get(c.mes);
                    if (item) {
                        if (c.tipo === 'receita') {
                            item.receita += Number(c.valor || 0);
                            item.qtd_receita += Number(c.qtd || 0);
                        }
                        else {
                            item.despesa += Number(c.valor || 0);
                            item.qtd_despesa += Number(c.qtd || 0);
                        }
                    }
                }
            });
            monthlyComparison = Array.from(annualMap.values()).map((m, idx) => ({
                mes: m.mes,
                mesNome: MONTH_NAMES[idx] || '',
                mesSigla: (MONTH_NAMES[idx] || '').slice(0, 3),
                receita: m.receita,
                despesa: m.despesa,
                saldo: m.receita - m.despesa,
                qtd_receita: m.qtd_receita,
                qtd_despesa: m.qtd_despesa
            }));
        }
        const activeData = {
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
            monthlyComparison,
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
            selectedCount: selectedCategoryKeys.size
        };
    };
    // ─── Renderers ────────────────────────────────────────────────────────────
    const renderKPIs = (data) => {
        const s = data.summary;
        if (getEl('kpiReceita'))
            getEl('kpiReceita').textContent = formatCurrency(s.totalReceita);
        if (getEl('kpiQtdReceita'))
            getEl('kpiQtdReceita').textContent = String(s.qtdReceita);
        if (getEl('kpiDespesa'))
            getEl('kpiDespesa').textContent = formatCurrency(s.totalDespesa);
        if (getEl('kpiQtdDespesa'))
            getEl('kpiQtdDespesa').textContent = String(s.qtdDespesa);
        const saldoEl = getEl('kpiSaldo');
        const saldoBar = getEl('kpiSaldoBar');
        const saldoIcon = getEl('kpiSaldoIconWrap');
        if (saldoEl) {
            saldoEl.textContent = formatCurrency(s.saldoLiquido);
            if (s.saldoLiquido >= 0) {
                saldoEl.className = 'mt-2 text-2xl lg:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight';
                if (saldoBar)
                    saldoBar.className = 'absolute top-0 left-0 right-0 h-1 bg-emerald-500';
                if (saldoIcon)
                    saldoIcon.className = 'p-3 bg-emerald-100 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400';
            }
            else {
                saldoEl.className = 'mt-2 text-2xl lg:text-3xl font-black text-rose-600 dark:text-rose-400 font-mono tracking-tight';
                if (saldoBar)
                    saldoBar.className = 'absolute top-0 left-0 right-0 h-1 bg-rose-500';
                if (saldoIcon)
                    saldoIcon.className = 'p-3 bg-rose-100 dark:bg-rose-950/60 rounded-xl text-rose-600 dark:text-rose-400';
            }
        }
        if (getEl('kpiMargem')) {
            getEl('kpiMargem').textContent = `${s.margemPercent > 0 ? '+' : ''}${s.margemPercent.toFixed(1)}%`;
        }
        if (getEl('kpiVolume'))
            getEl('kpiVolume').textContent = formatCurrency(s.totalMovimentado);
        if (getEl('kpiQtdTotal'))
            getEl('kpiQtdTotal').textContent = String(s.qtdReceita + s.qtdDespesa);
        // Proportion Bar
        const propReceita = s.totalMovimentado > 0 ? (s.totalReceita / s.totalMovimentado) * 100 : 50;
        const propDespesa = s.totalMovimentado > 0 ? (s.totalDespesa / s.totalMovimentado) * 100 : 50;
        if (getEl('propReceitaLabel'))
            getEl('propReceitaLabel').textContent = `Receita: ${propReceita.toFixed(1)}% (${formatCurrency(s.totalReceita)})`;
        if (getEl('propDespesaLabel'))
            getEl('propDespesaLabel').textContent = `Despesa: ${propDespesa.toFixed(1)}% (${formatCurrency(s.totalDespesa)})`;
        if (getEl('propReceitaBar'))
            getEl('propReceitaBar').style.width = `${propReceita}%`;
        if (getEl('propDespesaBar'))
            getEl('propDespesaBar').style.width = `${propDespesa}%`;
    };
    const renderDailyChart = (data) => {
        const container = getEl('chartDailyContainer');
        if (!container)
            return;
        if (getEl('chartDailyMonthLabel')) {
            getEl('chartDailyMonthLabel').textContent = `— ${data.params.mesNome} de ${data.params.ano}`;
        }
        const days = data.dailyEvolution || [];
        if (days.length === 0 || (data.summary.totalMovimentado === 0)) {
            container.innerHTML = '<div class="w-full text-center py-12 text-gray-400 text-xs">Sem movimentação selecionada para os dias deste mês.</div>';
            return;
        }
        let maxVal = 1;
        days.forEach(d => {
            if (d.receita > maxVal)
                maxVal = d.receita;
            if (d.despesa > maxVal)
                maxVal = d.despesa;
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
    const renderAnnualChart = (data) => {
        const container = getEl('chartAnnualContainer');
        if (!container)
            return;
        if (getEl('chartAnnualYearLabel')) {
            getEl('chartAnnualYearLabel').textContent = `— Ano ${data.params.ano}`;
        }
        const months = data.monthlyComparison || [];
        let maxVal = 1;
        months.forEach(m => {
            if (m.receita > maxVal)
                maxVal = m.receita;
            if (m.despesa > maxVal)
                maxVal = m.despesa;
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
        container.querySelectorAll('.annual-month-bar').forEach(el => {
            el.addEventListener('click', () => {
                const mesVal = el.getAttribute('data-mes');
                const mesSelect = getEl('filterMes');
                if (mesSelect && mesVal) {
                    mesSelect.value = mesVal;
                    void loadFinanceVision();
                }
            });
        });
    };
    const renderBankDistribution = (data) => {
        const tbody = getEl('bankTableBody');
        if (!tbody)
            return;
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
    const renderTopRankings = (data) => {
        const despContainer = getEl('topDespesasContainer');
        const recContainer = getEl('topReceitasContainer');
        if (despContainer) {
            const desps = data.topDespesas || [];
            if (desps.length === 0) {
                despContainer.innerHTML = '<p class="text-xs text-gray-400">Sem despesas registradas.</p>';
            }
            else {
                despContainer.innerHTML = desps.slice(0, 3).map((d) => `
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
            }
            else {
                recContainer.innerHTML = recs.slice(0, 3).map((r) => `
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
    // ─── Render Sales by Modality (PDV / Caixa / Boletim) ────────────────────
    const getModalityStyle = (modalityName) => {
        const name = (modalityName || '').toUpperCase();
        if (name.includes('DINHEIRO') || name.includes('ESPECIE') || name.includes('ESPÉCIE')) {
            return {
                icon: `<svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>`,
                badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
                barColor: 'bg-emerald-500'
            };
        }
        if (name.includes('PIX')) {
            return {
                icon: `<svg class="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`,
                badgeClass: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800',
                barColor: 'bg-teal-500'
            };
        }
        if (name.includes('VISA')) {
            return {
                icon: `<svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>`,
                badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
                barColor: 'bg-blue-500'
            };
        }
        if (name.includes('MASTER') || name.includes('MAESTRO')) {
            return {
                icon: `<svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>`,
                badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
                barColor: 'bg-amber-500'
            };
        }
        if (name.includes('ELO')) {
            return {
                icon: `<svg class="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>`,
                badgeClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
                barColor: 'bg-yellow-500'
            };
        }
        if (name.includes('CONVENIO') || name.includes('CONVÊNIO') || name.includes('CONV')) {
            return {
                icon: `<svg class="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>`,
                badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
                barColor: 'bg-purple-500'
            };
        }
        if (name.includes('AMEX')) {
            return {
                icon: `<svg class="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>`,
                badgeClass: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
                barColor: 'bg-cyan-500'
            };
        }
        return {
            icon: `<svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>`,
            badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
            barColor: 'bg-indigo-500'
        };
    };
    const renderSalesByModality = (data) => {
        const tbody = getEl('salesModalityTableBody');
        const countBadge = getEl('salesModalitiesCountBadge');
        const totalLiquidoBadge = getEl('salesTotalLiquidoBadge');
        const kpiBruto = getEl('salesKpiTotalBruto');
        const kpiLiquido = getEl('salesKpiTotalLiquido');
        const kpiQtd = getEl('salesKpiQtdTotal');
        const kpiTicket = getEl('salesKpiTicketMedio');
        const footQtd = getEl('salesFootQtd');
        const footTicket = getEl('salesFootTicket');
        const footBruto = getEl('salesFootBruto');
        const footLiquido = getEl('salesFootLiquido');
        const modalities = data?.salesByModality || [];
        const summary = data?.salesSummary || {
            totalBruto: modalities.reduce((acc, m) => acc + (m.valor_bruto || 0), 0),
            totalLiquido: modalities.reduce((acc, m) => acc + (m.valor_liquido || 0), 0),
            qtdOperacoes: modalities.reduce((acc, m) => acc + (m.qtd_operacoes || 0), 0),
            ticketMedio: 0
        };
        if (!summary.ticketMedio && summary.qtdOperacoes > 0) {
            summary.ticketMedio = summary.totalLiquido / summary.qtdOperacoes;
        }
        // Update KPIs
        if (kpiBruto)
            kpiBruto.textContent = formatCurrency(summary.totalBruto);
        if (kpiLiquido)
            kpiLiquido.textContent = formatCurrency(summary.totalLiquido);
        if (kpiQtd)
            kpiQtd.textContent = Number(summary.qtdOperacoes || 0).toLocaleString('pt-BR');
        if (kpiTicket)
            kpiTicket.textContent = formatCurrency(summary.ticketMedio);
        // Update Footers
        if (footQtd)
            footQtd.textContent = Number(summary.qtdOperacoes || 0).toLocaleString('pt-BR');
        if (footTicket)
            footTicket.textContent = formatCurrency(summary.ticketMedio);
        if (footBruto)
            footBruto.textContent = formatCurrency(summary.totalBruto);
        if (footLiquido)
            footLiquido.textContent = formatCurrency(summary.totalLiquido);
        // Update Badges
        if (countBadge)
            countBadge.textContent = `${modalities.length} modalidades`;
        if (totalLiquidoBadge)
            totalLiquidoBadge.textContent = `Total Líquido: ${formatCurrency(summary.totalLiquido)}`;
        if (!tbody)
            return;
        if (modalities.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-8 text-center text-gray-400">
                        Nenhuma venda registrada na tabela de boletim para o período selecionado.
                    </td>
                </tr>
            `;
            return;
        }
        tbody.innerHTML = modalities.map((m) => {
            const style = getModalityStyle(m.modalidade);
            const pct = typeof m.percentual === 'number' ? m.percentual : 0;
            const ticket = m.ticket_medio || (m.qtd_operacoes > 0 ? m.valor_liquido / m.qtd_operacoes : 0);
            return `
                <tr class="hover:bg-gray-50/80 dark:hover:bg-slate-700/40 transition-colors">
                    <td class="py-2.5 px-3">
                        <div class="flex items-center gap-2.5">
                            <span class="p-1.5 rounded-lg border flex items-center justify-center shrink-0 ${style.badgeClass}">
                                ${style.icon}
                            </span>
                            <div>
                                <span class="font-bold text-gray-900 dark:text-white">${escapeHtml(m.modalidade)}</span>
                            </div>
                        </div>
                    </td>
                    <td class="py-2.5 px-3 text-center">
                        <span class="inline-block px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-700 font-mono font-semibold text-gray-700 dark:text-gray-300">
                            ${Number(m.qtd_operacoes || 0).toLocaleString('pt-BR')}
                        </span>
                    </td>
                    <td class="py-2.5 px-3 text-right font-mono text-gray-600 dark:text-gray-300">
                        ${formatCurrency(ticket)}
                    </td>
                    <td class="py-2.5 px-3 text-right font-mono text-gray-500 dark:text-gray-400">
                        ${formatCurrency(m.valor_bruto)}
                    </td>
                    <td class="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ${formatCurrency(m.valor_liquido)}
                    </td>
                    <td class="py-2.5 px-3">
                        <div class="space-y-1">
                            <div class="flex items-center justify-between text-[11px] font-mono">
                                <span class="font-bold text-gray-700 dark:text-gray-200">${pct.toFixed(1)}%</span>
                            </div>
                            <div class="w-full h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div class="h-full rounded-full transition-all duration-500 ${style.barColor}" style="width: ${Math.min(100, Math.max(pct > 0 ? 2 : 0, pct))}%;"></div>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    };
    // ─── Render Recebimento de Convênio do Período ────────────────────────────
    let activeConvTab = 'clientes';
    let convSearchTerm = '';
    const renderConvenioCard = (data) => {
        const convData = data?.convenioData;
        const summary = convData?.summary || {
            totalEmitido: 0,
            totalQuitado: 0,
            totalPendente: 0,
            qtdCupons: 0,
            ticketMedio: 0,
            totalRecebidoBaixas: 0,
            totalJuros: 0,
            qtdBaixas: 0,
            pctQuitado: 0
        };
        const periodBadge = getEl('convenioPeriodBadge');
        const totalRecBadge = getEl('convenioTotalRecebidoBadge');
        const kpiEmitido = getEl('convKpiTotalEmitido');
        const kpiQuitado = getEl('convKpiTotalQuitado');
        const kpiPendente = getEl('convKpiTotalPendente');
        const kpiBaixas = getEl('convKpiTotalBaixas');
        const kpiQtdCupons = getEl('convKpiQtdCupons');
        const kpiTicketMedio = getEl('convKpiTicketMedio');
        const kpiPctQuitado = getEl('convKpiPctQuitado');
        const kpiPctBar = getEl('convKpiPctBar');
        const kpiTotalJuros = getEl('convKpiTotalJuros');
        const kpiQtdBaixas = getEl('convKpiQtdBaixas');
        // Period Badges
        const mesNome = data?.params?.mesNome || '';
        const ano = data?.params?.ano || '';
        if (periodBadge)
            periodBadge.textContent = `${mesNome}/${ano}`;
        if (totalRecBadge) {
            const liquidadoVal = summary.totalRecebidoBaixas || summary.totalQuitado;
            totalRecBadge.textContent = `Total Liquidado: ${formatCurrency(liquidadoVal)}`;
        }
        // Top Chips
        if (kpiEmitido)
            kpiEmitido.textContent = formatCurrency(summary.totalEmitido);
        if (kpiQuitado)
            kpiQuitado.textContent = formatCurrency(summary.totalQuitado);
        if (kpiPendente)
            kpiPendente.textContent = formatCurrency(summary.totalPendente);
        if (kpiBaixas)
            kpiBaixas.textContent = formatCurrency(summary.totalRecebidoBaixas);
        // Mini KPIs
        if (kpiQtdCupons)
            kpiQtdCupons.textContent = Number(summary.qtdCupons || 0).toLocaleString('pt-BR');
        if (kpiTicketMedio)
            kpiTicketMedio.textContent = formatCurrency(summary.ticketMedio);
        if (kpiPctQuitado)
            kpiPctQuitado.textContent = `${summary.pctQuitado.toFixed(1)}%`;
        if (kpiPctBar)
            kpiPctBar.style.width = `${Math.min(100, Math.max(summary.pctQuitado > 0 ? 2 : 0, summary.pctQuitado))}%`;
        if (kpiTotalJuros)
            kpiTotalJuros.textContent = formatCurrency(summary.totalJuros);
        if (kpiQtdBaixas)
            kpiQtdBaixas.textContent = `${Number(summary.qtdBaixas || 0).toLocaleString('pt-BR')} baixas efetuadas`;
        // Render Tab 1: Clientes / Convênios
        const clientsTbody = getEl('convClientsTableBody');
        const footQtd = getEl('convFootQtd');
        const footTicket = getEl('convFootTicket');
        const footEmitido = getEl('convFootEmitido');
        const footQuitado = getEl('convFootQuitado');
        const footPendente = getEl('convFootPendente');
        const footPct = getEl('convFootPct');
        const allClients = convData?.topClientes || [];
        const term = convSearchTerm.trim().toLowerCase();
        const filteredClients = term
            ? allClients.filter(c => c.cliente.toLowerCase().includes(term))
            : allClients;
        if (footQtd)
            footQtd.textContent = Number(summary.qtdCupons || 0).toLocaleString('pt-BR');
        if (footTicket)
            footTicket.textContent = formatCurrency(summary.ticketMedio);
        if (footEmitido)
            footEmitido.textContent = formatCurrency(summary.totalEmitido);
        if (footQuitado)
            footQuitado.textContent = formatCurrency(summary.totalQuitado);
        if (footPendente)
            footPendente.textContent = formatCurrency(summary.totalPendente);
        if (footPct)
            footPct.textContent = `${summary.pctQuitado.toFixed(1)}%`;
        if (clientsTbody) {
            if (filteredClients.length === 0) {
                clientsTbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="py-8 text-center text-gray-400">
                            ${term ? 'Nenhum convênio encontrado para a busca.' : 'Nenhum cupom ou convênio emitido no período.'}
                        </td>
                    </tr>
                `;
            }
            else {
                clientsTbody.innerHTML = filteredClients.map(c => {
                    const pct = c.pct_pago || 0;
                    const isFullyPaid = pct >= 99.9;
                    const statusBadge = isFullyPaid
                        ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">100% Quitado</span>'
                        : pct > 0
                            ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">${pct.toFixed(1)}% Pago</span>`
                            : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Pendente</span>';
                    return `
                        <tr class="hover:bg-gray-50/80 dark:hover:bg-slate-700/40 transition-colors">
                            <td class="py-2.5 px-3">
                                <div class="flex items-center gap-2">
                                    <div class="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-xs shrink-0">
                                        ${escapeHtml(c.cliente.charAt(0).toUpperCase())}
                                    </div>
                                    <span class="font-bold text-gray-900 dark:text-white truncate max-w-64" title="${escapeHtml(c.cliente)}">
                                        ${escapeHtml(c.cliente)}
                                    </span>
                                </div>
                            </td>
                            <td class="py-2.5 px-3 text-center">
                                <span class="inline-block px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-700 font-mono font-semibold text-gray-700 dark:text-gray-300 text-xs">
                                    ${Number(c.qtd_operacoes || 0).toLocaleString('pt-BR')}
                                </span>
                            </td>
                            <td class="py-2.5 px-3 text-right font-mono text-gray-600 dark:text-gray-300">
                                ${formatCurrency(c.ticket_medio)}
                            </td>
                            <td class="py-2.5 px-3 text-right font-mono font-medium text-gray-800 dark:text-gray-200">
                                ${formatCurrency(c.total_valor)}
                            </td>
                            <td class="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                ${formatCurrency(c.total_quitado)}
                            </td>
                            <td class="py-2.5 px-3 text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                                ${formatCurrency(c.saldo_pendente)}
                            </td>
                            <td class="py-2.5 px-3">
                                <div class="space-y-1">
                                    <div class="flex items-center justify-between">
                                        ${statusBadge}
                                    </div>
                                    <div class="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div class="h-full rounded-full transition-all duration-500 ${isFullyPaid ? 'bg-emerald-500' : 'bg-blue-500'}" style="width: ${Math.min(100, Math.max(pct > 0 ? 2 : 0, pct))}%;"></div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }
        // Render Tab 2: Baixas Recentes
        const baixasTbody = getEl('convBaixasTableBody');
        const recentBaixas = convData?.recentBaixas || [];
        if (baixasTbody) {
            if (recentBaixas.length === 0) {
                baixasTbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="py-8 text-center text-gray-400">
                            Nenhum registro de baixa/liquidação financeira de convênio para este período.
                        </td>
                    </tr>
                `;
            }
            else {
                baixasTbody.innerHTML = recentBaixas.map(b => `
                    <tr class="hover:bg-gray-50/80 dark:hover:bg-slate-700/40 transition-colors">
                        <td class="py-2.5 px-3 whitespace-nowrap font-mono text-gray-600 dark:text-gray-300">
                            ${formatDate(b.data)}
                        </td>
                        <td class="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                            #${escapeHtml(b.id)}
                        </td>
                        <td class="py-2.5 px-3 font-mono text-gray-500 dark:text-gray-400">
                            ${escapeHtml(b.documento)}
                        </td>
                        <td class="py-2.5 px-3 text-gray-800 dark:text-gray-200">
                            ${escapeHtml(b.historico)}
                        </td>
                        <td class="py-2.5 px-3 text-gray-600 dark:text-gray-400">
                            ${escapeHtml(b.banco)}
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                            ${formatCurrency(b.valor)}
                        </td>
                    </tr>
                `).join('');
            }
        }
        // Render Tab 3: Diário
        const dailyTbody = getEl('convDailyTableBody');
        const dailyEvolution = convData?.dailyEvolution || [];
        if (dailyTbody) {
            if (dailyEvolution.length === 0) {
                dailyTbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="py-8 text-center text-gray-400">
                            Nenhuma movimentação diária de convênio registrada no mês.
                        </td>
                    </tr>
                `;
            }
            else {
                dailyTbody.innerHTML = dailyEvolution.map(d => {
                    const emit = d.total_emitido || 0;
                    const quit = d.total_quitado || 0;
                    const pct = emit > 0 ? (quit / emit) * 100 : 0;
                    return `
                        <tr class="hover:bg-gray-50/80 dark:hover:bg-slate-700/40 transition-colors">
                            <td class="py-2 px-3 font-bold text-gray-900 dark:text-white">
                                Dia ${d.dia} <span class="text-xs font-normal text-gray-400">(${formatDate(d.data)})</span>
                            </td>
                            <td class="py-2 px-3 text-center font-mono">
                                ${Number(d.qtd_cupons || 0).toLocaleString('pt-BR')}
                            </td>
                            <td class="py-2 px-3 text-right font-mono font-medium text-gray-800 dark:text-gray-200">
                                ${formatCurrency(emit)}
                            </td>
                            <td class="py-2 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                ${formatCurrency(quit)}
                            </td>
                            <td class="py-2 px-3 text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                                ${formatCurrency(d.saldo_pendente)}
                            </td>
                            <td class="py-2 px-3">
                                <div class="space-y-1">
                                    <span class="text-[11px] font-mono font-bold text-gray-700 dark:text-gray-300">${pct.toFixed(1)}%</span>
                                    <div class="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div class="h-full bg-emerald-500 rounded-full transition-all duration-500" style="width: ${Math.min(100, Math.max(pct > 0 ? 2 : 0, pct))}%;"></div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }
    };
    // ─── Render Separated Category Checklist Panels ──────────────────────────
    const renderCategoryDistribution = () => {
        const recTbody = getEl('recCategoryTableBody');
        const despTbody = getEl('despCategoryTableBody');
        const countBadge = getEl('categoryCountBadge');
        const selectedBadge = getEl('categorySelectedBadge');
        const totalSumBadge = getEl('categoryTotalSelectedSum');
        const recCountBadge = getEl('recCategoryCountBadge');
        const despCountBadge = getEl('despCategoryCountBadge');
        const chkMasterRec = getEl('chkSelectAllRecCategories');
        const chkMasterDesp = getEl('chkSelectAllDespCategories');
        const totalCategories = revenueCategoriesList.length + expenseCategoriesList.length;
        if (countBadge)
            countBadge.textContent = `${totalCategories} tipos`;
        const selectedCount = selectedCategoryKeys.size;
        if (selectedBadge) {
            selectedBadge.textContent = `${selectedCount} selecionado${selectedCount === 1 ? '' : 's'}`;
            if (selectedCount === 0) {
                selectedBadge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold font-mono';
            }
            else if (selectedCount === totalCategories) {
                selectedBadge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold font-mono';
            }
            else {
                selectedBadge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold font-mono';
            }
        }
        const search = (categorySearchTerm || '').trim().toLowerCase();
        // ── 1. RECEITAS PANEL ─────────────────────────────
        const filteredRecList = revenueCategoriesList.filter(c => !search || c.tipoconta.toLowerCase().includes(search));
        if (recCountBadge)
            recCountBadge.textContent = `${revenueCategoriesList.length} ${revenueCategoriesList.length === 1 ? 'tipo' : 'tipos'}`;
        let totalRecSelected = 0;
        let countRecSelected = 0;
        revenueCategoriesList.forEach(c => {
            if (selectedCategoryKeys.has(makeKey('receita', c.tipoconta))) {
                totalRecSelected += c.valor;
                countRecSelected += 1;
            }
        });
        if (chkMasterRec) {
            if (revenueCategoriesList.length > 0 && countRecSelected === revenueCategoriesList.length) {
                chkMasterRec.checked = true;
                chkMasterRec.indeterminate = false;
            }
            else if (countRecSelected > 0 && countRecSelected < revenueCategoriesList.length) {
                chkMasterRec.checked = false;
                chkMasterRec.indeterminate = true;
            }
            else {
                chkMasterRec.checked = false;
                chkMasterRec.indeterminate = false;
            }
        }
        if (getEl('recCategoryFootCount')) {
            getEl('recCategoryFootCount').textContent = `(${countRecSelected} de ${revenueCategoriesList.length})`;
        }
        if (getEl('recCategoryFootTotal')) {
            getEl('recCategoryFootTotal').textContent = formatCurrency(totalRecSelected);
        }
        if (recTbody) {
            if (revenueCategoriesList.length === 0) {
                recTbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-gray-400">Nenhum tipo de receita no período.</td></tr>';
            }
            else if (filteredRecList.length === 0) {
                recTbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-gray-400">Nenhum tipo corresponde à busca.</td></tr>';
            }
            else {
                const maxRec = Math.max(...revenueCategoriesList.map(c => c.valor), 1);
                const grandTotalRec = revenueCategoriesList.reduce((acc, c) => acc + c.valor, 0) || 1;
                recTbody.innerHTML = filteredRecList.map(c => {
                    const key = makeKey('receita', c.tipoconta);
                    const isChecked = selectedCategoryKeys.has(key);
                    const sharePercent = (c.valor / grandTotalRec) * 100;
                    const widthPercent = Math.min(Math.round((c.valor / maxRec) * 100), 100);
                    const rowOpacityClass = isChecked ? '' : 'opacity-40 bg-gray-50/50 dark:bg-slate-900/30';
                    const textLineClass = isChecked ? '' : 'line-through text-gray-400';
                    return `
                        <tr class="hover:bg-emerald-50/50 dark:hover:bg-slate-700/40 transition-colors category-row ${rowOpacityClass}" data-tipo="receita" data-tipoconta="${escapeHtml(c.tipoconta)}">
                            <td class="py-2 px-2.5 text-center">
                                <input type="checkbox" class="chk-category-item rounded border-gray-300 text-emerald-600 focus:ring-emerald-500/30 dark:bg-slate-700 dark:border-slate-600 cursor-pointer" data-tipo="receita" data-tipoconta="${escapeHtml(c.tipoconta)}" ${isChecked ? 'checked' : ''}>
                            </td>
                            <td class="py-2 px-2.5">
                                <div class="font-bold text-gray-900 dark:text-gray-100 ${textLineClass} flex items-center justify-between gap-1">
                                    <span class="truncate">${escapeHtml(c.tipoconta)}</span>
                                    <button type="button" class="btn-filter-transactions text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer shrink-0" data-tipoconta="${escapeHtml(c.tipoconta)}" data-tipo="receita" title="Ver lançamentos deste tipo">
                                        Ver &darr;
                                    </button>
                                </div>
                                <div class="w-full bg-gray-100 dark:bg-slate-700 h-1.5 rounded-full mt-1 overflow-hidden">
                                    <div class="bg-emerald-500 h-full transition-all duration-300" style="width: ${Math.max(widthPercent, 1)}%;"></div>
                                </div>
                            </td>
                            <td class="py-2 px-2 text-center font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap text-[11px]">
                                ${c.qtd}
                            </td>
                            <td class="py-2 px-2.5 text-right font-mono text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                ${sharePercent.toFixed(1)}%
                            </td>
                            <td class="py-2 px-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap text-xs ${textLineClass}">
                                ${formatCurrency(c.valor)}
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }
        // ── 2. DESPESAS PANEL ─────────────────────────────
        const filteredDespList = expenseCategoriesList.filter(c => !search || c.tipoconta.toLowerCase().includes(search));
        if (despCountBadge)
            despCountBadge.textContent = `${expenseCategoriesList.length} ${expenseCategoriesList.length === 1 ? 'tipo' : 'tipos'}`;
        let totalDespSelected = 0;
        let countDespSelected = 0;
        expenseCategoriesList.forEach(c => {
            if (selectedCategoryKeys.has(makeKey('despesa', c.tipoconta))) {
                totalDespSelected += c.valor;
                countDespSelected += 1;
            }
        });
        if (chkMasterDesp) {
            if (expenseCategoriesList.length > 0 && countDespSelected === expenseCategoriesList.length) {
                chkMasterDesp.checked = true;
                chkMasterDesp.indeterminate = false;
            }
            else if (countDespSelected > 0 && countDespSelected < expenseCategoriesList.length) {
                chkMasterDesp.checked = false;
                chkMasterDesp.indeterminate = true;
            }
            else {
                chkMasterDesp.checked = false;
                chkMasterDesp.indeterminate = false;
            }
        }
        if (getEl('despCategoryFootCount')) {
            getEl('despCategoryFootCount').textContent = `(${countDespSelected} de ${expenseCategoriesList.length})`;
        }
        if (getEl('despCategoryFootTotal')) {
            getEl('despCategoryFootTotal').textContent = formatCurrency(totalDespSelected);
        }
        if (despTbody) {
            if (expenseCategoriesList.length === 0) {
                despTbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-gray-400">Nenhum tipo de despesa no período.</td></tr>';
            }
            else if (filteredDespList.length === 0) {
                despTbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-gray-400">Nenhum tipo corresponde à busca.</td></tr>';
            }
            else {
                const maxDesp = Math.max(...expenseCategoriesList.map(c => c.valor), 1);
                const grandTotalDesp = expenseCategoriesList.reduce((acc, c) => acc + c.valor, 0) || 1;
                despTbody.innerHTML = filteredDespList.map(c => {
                    const key = makeKey('despesa', c.tipoconta);
                    const isChecked = selectedCategoryKeys.has(key);
                    const sharePercent = (c.valor / grandTotalDesp) * 100;
                    const widthPercent = Math.min(Math.round((c.valor / maxDesp) * 100), 100);
                    const rowOpacityClass = isChecked ? '' : 'opacity-40 bg-gray-50/50 dark:bg-slate-900/30';
                    const textLineClass = isChecked ? '' : 'line-through text-gray-400';
                    return `
                        <tr class="hover:bg-rose-50/50 dark:hover:bg-slate-700/40 transition-colors category-row ${rowOpacityClass}" data-tipo="despesa" data-tipoconta="${escapeHtml(c.tipoconta)}">
                            <td class="py-2 px-2.5 text-center">
                                <input type="checkbox" class="chk-category-item rounded border-gray-300 text-rose-600 focus:ring-rose-500/30 dark:bg-slate-700 dark:border-slate-600 cursor-pointer" data-tipo="despesa" data-tipoconta="${escapeHtml(c.tipoconta)}" ${isChecked ? 'checked' : ''}>
                            </td>
                            <td class="py-2 px-2.5">
                                <div class="font-bold text-gray-900 dark:text-gray-100 ${textLineClass} flex items-center justify-between gap-1">
                                    <span class="truncate">${escapeHtml(c.tipoconta)}</span>
                                    <button type="button" class="btn-filter-transactions text-[10px] text-rose-600 dark:text-rose-400 hover:underline cursor-pointer shrink-0" data-tipoconta="${escapeHtml(c.tipoconta)}" data-tipo="despesa" title="Ver lançamentos deste tipo">
                                        Ver &darr;
                                    </button>
                                </div>
                                <div class="w-full bg-gray-100 dark:bg-slate-700 h-1.5 rounded-full mt-1 overflow-hidden">
                                    <div class="bg-rose-500 h-full transition-all duration-300" style="width: ${Math.max(widthPercent, 1)}%;"></div>
                                </div>
                            </td>
                            <td class="py-2 px-2 text-center font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap text-[11px]">
                                ${c.qtd}
                            </td>
                            <td class="py-2 px-2.5 text-right font-mono text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                ${sharePercent.toFixed(1)}%
                            </td>
                            <td class="py-2 px-2.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap text-xs ${textLineClass}">
                                ${formatCurrency(c.valor)}
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }
        // Global Combined Header Summary
        const saldoSelected = totalRecSelected - totalDespSelected;
        const movSelected = totalRecSelected + totalDespSelected;
        if (totalSumBadge) {
            if (saldoSelected >= 0) {
                totalSumBadge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold font-mono';
            }
            else {
                totalSumBadge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold font-mono';
            }
            totalSumBadge.textContent = `Saldo: ${formatCurrency(saldoSelected)} (Mov: ${formatCurrency(movSelected)})`;
        }
        // Wire Checkbox Handlers for Both Tables
        document.querySelectorAll('.chk-category-item').forEach(chk => {
            chk.addEventListener('change', (e) => {
                e.stopPropagation();
                const tipo = chk.dataset.tipo;
                const tc = chk.dataset.tipoconta;
                if (!tipo || !tc)
                    return;
                const key = makeKey(tipo, tc);
                if (chk.checked) {
                    selectedCategoryKeys.add(key);
                }
                else {
                    selectedCategoryKeys.delete(key);
                }
                saveCategorySelection();
                recalculateAndRenderAll();
            });
        });
        // Wire Shortcut to filter transactions table
        document.querySelectorAll('.btn-filter-transactions').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tc = btn.dataset.tipoconta;
                const tipo = btn.dataset.tipo;
                if (!tc)
                    return;
                const typeSelect = getEl('transTypeFilter');
                if (typeSelect && tipo) {
                    typeSelect.value = tipo;
                    populateAccountTypeFilter();
                }
                const accSelect = getEl('transAccountTypeFilter');
                if (accSelect) {
                    accSelect.value = tc;
                }
                renderTransactionsTable();
                getEl('transTableBody')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    };
    // ─── Populate Account Type Filter in Transactions Table ──────────────────
    const populateAccountTypeFilter = () => {
        const select = getEl('transAccountTypeFilter');
        if (!select || !rawData)
            return;
        const currentVal = select.value;
        const typeFilter = (getEl('transTypeFilter')?.value || 'all').toLowerCase();
        const set = new Set();
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
            if (tc === currentVal)
                opt.selected = true;
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
        if (!tbody || !rawData)
            return;
        const filterType = (getEl('transTypeFilter')?.value || 'all').toLowerCase();
        const filterAccountType = (getEl('transAccountTypeFilter')?.value || 'all').toLowerCase();
        const search = (getEl('transSearchInput')?.value || '').trim().toLowerCase();
        const filtered = (rawData.transactions || []).filter(t => {
            const tc = normalizeAccountType(t.tipoconta);
            const key = makeKey(t.tipo, tc);
            // 1. Must be checked in category checklist
            if (!selectedCategoryKeys.has(key))
                return false;
            // 2. Type filter
            if (filterType !== 'all' && t.tipo !== filterType)
                return false;
            // 3. Dropdown Account Type filter
            if (filterAccountType !== 'all' && tc.toLowerCase() !== filterAccountType)
                return false;
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
            }
            else {
                totalDespesa += val;
            }
        });
        const saldo = totalReceita - totalDespesa;
        if (countBadge)
            countBadge.textContent = String(filtered.length);
        // Update Total Sum Badge
        const totalSumBadge = getEl('transTotalSumBadge');
        if (totalSumBadge) {
            if (filterType === 'receita') {
                totalSumBadge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold font-mono';
                totalSumBadge.textContent = `Total: ${formatCurrency(totalReceita)}`;
            }
            else if (filterType === 'despesa') {
                totalSumBadge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold font-mono';
                totalSumBadge.textContent = `Total: ${formatCurrency(totalDespesa)}`;
            }
            else {
                if (saldo >= 0) {
                    totalSumBadge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold font-mono';
                }
                else {
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
            getEl('transFootCount').textContent = `(${filtered.length} ${filtered.length === 1 ? 'item' : 'itens'})`;
        }
        if (getEl('transFootBreakdown')) {
            getEl('transFootBreakdown').innerHTML = `Rec: <span class="text-emerald-600 dark:text-emerald-400 font-bold">${formatCurrency(totalReceita)}</span> | Desp: <span class="text-rose-600 dark:text-rose-400 font-bold">${formatCurrency(totalDespesa)}</span>`;
        }
        if (getEl('transFootTotal')) {
            const footTotal = getEl('transFootTotal');
            if (filterType === 'receita') {
                footTotal.className = 'py-3 px-3 text-right font-mono text-sm font-black text-emerald-600 dark:text-emerald-400';
                footTotal.textContent = formatCurrency(totalReceita);
            }
            else if (filterType === 'despesa') {
                footTotal.className = 'py-3 px-3 text-right font-mono text-sm font-black text-rose-600 dark:text-rose-400';
                footTotal.textContent = formatCurrency(totalDespesa);
            }
            else {
                footTotal.className = `py-3 px-3 text-right font-mono text-sm font-black ${saldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`;
                footTotal.textContent = formatCurrency(saldo);
            }
        }
        if (filtered.length === 0) {
            if (selectedCategoryKeys.size === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-gray-400">Nenhum tipo de conta selecionado no checklist acima. Marque os tipos de conta para visualizar os lançamentos.</td></tr>';
            }
            else {
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
        if (!res)
            return;
        renderKPIs(res.activeData);
        renderDailyChart(res.activeData);
        renderAnnualChart(res.activeData);
        renderBankDistribution(res.activeData);
        renderTopRankings(res.activeData);
        renderSalesByModality(res.activeData);
        renderConvenioCard(res.activeData);
        renderCategoryDistribution();
        renderTransactionsTable();
    };
    // ─── Export CSV ──────────────────────────────────────────────────────────
    const exportToCSV = () => {
        if (!rawData || !rawData.transactions.length) {
            alert('Não há dados carregados para exportação.');
            return;
        }
        const filterType = (getEl('transTypeFilter')?.value || 'all').toLowerCase();
        const filterAccountType = (getEl('transAccountTypeFilter')?.value || 'all').toLowerCase();
        const search = (getEl('transSearchInput')?.value || '').trim().toLowerCase();
        const filtered = (rawData.transactions || []).filter(t => {
            const tc = normalizeAccountType(t.tipoconta);
            const key = makeKey(t.tipo, tc);
            if (!selectedCategoryKeys.has(key))
                return false;
            if (filterType !== 'all' && t.tipo !== filterType)
                return false;
            if (filterAccountType !== 'all' && tc.toLowerCase() !== filterAccountType)
                return false;
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
        if (isLoading)
            return;
        isLoading = true;
        hideAlert();
        updateStatusBadge('loading', 'Consultando Solidcon (vwaporttec_contas)...');
        const companyParam = getEl('filterCompany')?.value || '';
        const ano = getEl('filterAno')?.value || String(new Date().getFullYear());
        const mes = getEl('filterMes')?.value || String(new Date().getMonth() + 1);
        const filial = getEl('filterFilial')?.value || '';
        const source = getEl('filterSource')?.value || 'conta_baixa';
        const connId = getEl('filterConnection')?.value || '';
        // Persist filter settings
        try {
            if (companyParam)
                localStorage.setItem('fin_solidcon_vision_company', companyParam);
            if (ano)
                localStorage.setItem('fin_solidcon_vision_ano', ano);
            if (mes)
                localStorage.setItem('fin_solidcon_vision_mes', mes);
            if (source)
                localStorage.setItem('fin_solidcon_vision_source', source);
            if (connId !== undefined) {
                localStorage.setItem(`fin_solidcon_vision_conn_${companyParam || 'default'}`, connId);
            }
            if (filial !== undefined) {
                localStorage.setItem(`fin_solidcon_vision_filial_${companyParam || 'default'}`, filial);
            }
        }
        catch (e) {
            console.warn('Falha ao salvar filtros no localStorage:', e);
        }
        const filterBtn = getEl('btnFilterApply');
        const filterIcon = getEl('btnFilterIcon');
        if (filterBtn)
            filterBtn.disabled = true;
        if (filterIcon)
            filterIcon.classList.add('animate-spin');
        try {
            let url = `/finance/solidcon-vision?ano=${encodeURIComponent(ano)}&mes=${encodeURIComponent(mes)}&source=${encodeURIComponent(source)}`;
            if (companyParam)
                url += `&targetCompanyId=${encodeURIComponent(companyParam)}`;
            if (filial)
                url += `&cdFilial=${encodeURIComponent(filial)}`;
            if (connId)
                url += `&connectionId=${encodeURIComponent(connId)}`;
            const res = await api(url);
            const data = res?.data;
            if (!data) {
                throw new Error('Nenhum dado retornado do servidor.');
            }
            rawData = data;
            // Extract separated categories (incorporating month & annual categories)
            const { revenues, expenses } = extractSeparatedCategories(data);
            revenueCategoriesList = revenues;
            expenseCategoriesList = expenses;
            // Restore saved categories or select all by default
            restoreCategorySelection(companyParam, [...revenues, ...expenses]);
            // Update Filial select if new filiais returned
            if (data.filiais && data.filiais.length > 0) {
                const filialSelect = getEl('filterFilial');
                if (filialSelect) {
                    const currentVal = filialSelect.value;
                    const savedFilial = localStorage.getItem(`fin_solidcon_vision_filial_${companyParam || 'default'}`);
                    filialSelect.innerHTML = '<option value="">Todas as Filiais</option>';
                    data.filiais.forEach((f) => {
                        const opt = document.createElement('option');
                        const fId = typeof f === 'object' ? String(f.id) : String(f);
                        const fNome = typeof f === 'object' ? (f.nome || `Filial ${f.id}`) : `Filial ${f}`;
                        opt.value = fId;
                        opt.textContent = fNome;
                        filialSelect.appendChild(opt);
                    });
                    const targetFilial = currentVal || savedFilial || '';
                    if (targetFilial && filialSelect.querySelector(`option[value="${targetFilial}"]`)) {
                        filialSelect.value = targetFilial;
                    }
                }
            }
            if (getEl('connectionBadge')) {
                const compDisplay = res.company?.trade_name || res.company?.company_name || '';
                const connDisplay = res.connection?.name || 'Solidcon Principal';
                getEl('connectionBadge').textContent = `• ${compDisplay ? `${compDisplay} | ` : ''}${connDisplay}`;
            }
            updateStatusBadge('success', `Conectado (${data.summary.qtdReceita + data.summary.qtdDespesa} lançamentos)`);
            populateAccountTypeFilter();
            recalculateAndRenderAll();
        }
        catch (err) {
            const msg = err?.message || String(err);
            updateStatusBadge('error', 'Falha na Conexão');
            showAlert(`Erro ao carregar dados do Solidcon: ${msg}`, 'error');
        }
        finally {
            isLoading = false;
            if (filterBtn)
                filterBtn.disabled = false;
            if (filterIcon)
                filterIcon.classList.remove('animate-spin');
        }
    };
    // ─── Setup Checklist Action Handlers ─────────────────────────────────────
    const setupChecklistActions = () => {
        // Global "Marcar Todos"
        getEl('btnSelectAllCategories')?.addEventListener('click', () => {
            revenueCategoriesList.forEach(r => selectedCategoryKeys.add(makeKey('receita', r.tipoconta)));
            expenseCategoriesList.forEach(e => selectedCategoryKeys.add(makeKey('despesa', e.tipoconta)));
            saveCategorySelection();
            recalculateAndRenderAll();
        });
        // Global "Desmarcar Todos"
        getEl('btnDeselectAllCategories')?.addEventListener('click', () => {
            selectedCategoryKeys.clear();
            saveCategorySelection();
            recalculateAndRenderAll();
        });
        // Master Receitas Checkbox
        getEl('chkSelectAllRecCategories')?.addEventListener('change', (e) => {
            const chk = e.target;
            if (chk.checked) {
                revenueCategoriesList.forEach(r => selectedCategoryKeys.add(makeKey('receita', r.tipoconta)));
            }
            else {
                revenueCategoriesList.forEach(r => selectedCategoryKeys.delete(makeKey('receita', r.tipoconta)));
            }
            saveCategorySelection();
            recalculateAndRenderAll();
        });
        // Receitas "Todas" button
        getEl('btnSelectAllRecCategories')?.addEventListener('click', () => {
            revenueCategoriesList.forEach(r => selectedCategoryKeys.add(makeKey('receita', r.tipoconta)));
            saveCategorySelection();
            recalculateAndRenderAll();
        });
        // Receitas "Nenhuma" button
        getEl('btnDeselectAllRecCategories')?.addEventListener('click', () => {
            revenueCategoriesList.forEach(r => selectedCategoryKeys.delete(makeKey('receita', r.tipoconta)));
            saveCategorySelection();
            recalculateAndRenderAll();
        });
        // Master Despesas Checkbox
        getEl('chkSelectAllDespCategories')?.addEventListener('change', (e) => {
            const chk = e.target;
            if (chk.checked) {
                expenseCategoriesList.forEach(e => selectedCategoryKeys.add(makeKey('despesa', e.tipoconta)));
            }
            else {
                expenseCategoriesList.forEach(e => selectedCategoryKeys.delete(makeKey('despesa', e.tipoconta)));
            }
            saveCategorySelection();
            recalculateAndRenderAll();
        });
        // Despesas "Todas" button
        getEl('btnSelectAllDespCategories')?.addEventListener('click', () => {
            expenseCategoriesList.forEach(e => selectedCategoryKeys.add(makeKey('despesa', e.tipoconta)));
            saveCategorySelection();
            recalculateAndRenderAll();
        });
        // Despesas "Nenhuma" button
        getEl('btnDeselectAllDespCategories')?.addEventListener('click', () => {
            expenseCategoriesList.forEach(e => selectedCategoryKeys.delete(makeKey('despesa', e.tipoconta)));
            saveCategorySelection();
            recalculateAndRenderAll();
        });
        // Category Search Input
        getEl('categorySearchInput')?.addEventListener('input', (e) => {
            categorySearchTerm = e.target.value;
            renderCategoryDistribution();
        });
    };
    // ─── Setup Convenio Action Handlers ──────────────────────────────────────
    const setupConvenioActions = () => {
        const btnClientes = getEl('btnConvTabClientes');
        const btnBaixas = getEl('btnConvTabBaixas');
        const btnDiario = getEl('btnConvTabDiario');
        const tabClientes = getEl('convTabContentClientes');
        const tabBaixas = getEl('convTabContentBaixas');
        const tabDiario = getEl('convTabContentDiario');
        const searchWrap = getEl('convClientSearchWrap');
        const switchTab = (tab) => {
            activeConvTab = tab;
            // Reset buttons
            [btnClientes, btnBaixas, btnDiario].forEach(b => {
                if (!b)
                    return;
                b.className = 'px-3 py-1.5 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 transition-all cursor-pointer';
            });
            // Hide tabs
            tabClientes?.classList.add('hidden');
            tabBaixas?.classList.add('hidden');
            tabDiario?.classList.add('hidden');
            if (tab === 'clientes') {
                if (btnClientes)
                    btnClientes.className = 'px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-600 text-white shadow-sm transition-all cursor-pointer';
                tabClientes?.classList.remove('hidden');
                if (searchWrap)
                    searchWrap.style.display = 'block';
            }
            else if (tab === 'baixas') {
                if (btnBaixas)
                    btnBaixas.className = 'px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-600 text-white shadow-sm transition-all cursor-pointer';
                tabBaixas?.classList.remove('hidden');
                if (searchWrap)
                    searchWrap.style.display = 'none';
            }
            else if (tab === 'diario') {
                if (btnDiario)
                    btnDiario.className = 'px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-600 text-white shadow-sm transition-all cursor-pointer';
                tabDiario?.classList.remove('hidden');
                if (searchWrap)
                    searchWrap.style.display = 'none';
            }
        };
        btnClientes?.addEventListener('click', () => switchTab('clientes'));
        btnBaixas?.addEventListener('click', () => switchTab('baixas'));
        btnDiario?.addEventListener('click', () => switchTab('diario'));
        getEl('convClientSearchInput')?.addEventListener('input', (e) => {
            convSearchTerm = e.target.value;
            if (rawData) {
                const res = getRecalculatedData();
                if (res)
                    renderConvenioCard(res.activeData);
            }
        });
    };
    // ─── DOMContentLoaded Init ───────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', async () => {
        populateYearDropdown();
        // Set saved or current month in select
        const mesSelect = getEl('filterMes');
        if (mesSelect) {
            const savedMes = localStorage.getItem('fin_solidcon_vision_mes');
            if (savedMes && mesSelect.querySelector(`option[value="${savedMes}"]`)) {
                mesSelect.value = savedMes;
            }
            else {
                mesSelect.value = String(new Date().getMonth() + 1);
            }
        }
        // Set saved data source
        const sourceSelect = getEl('filterSource');
        if (sourceSelect) {
            const savedSource = localStorage.getItem('fin_solidcon_vision_source');
            if (savedSource && sourceSelect.querySelector(`option[value="${savedSource}"]`)) {
                sourceSelect.value = savedSource;
            }
        }
        // Set saved transaction type filter
        const transTypeSelect = getEl('transTypeFilter');
        if (transTypeSelect) {
            const savedTransType = localStorage.getItem('fin_solidcon_vision_trans_type');
            if (savedTransType && transTypeSelect.querySelector(`option[value="${savedTransType}"]`)) {
                transTypeSelect.value = savedTransType;
            }
        }
        setupChecklistActions();
        setupConvenioActions();
        await loadCompanies();
        const initialCompany = getEl('filterCompany')?.value || '';
        await loadSolidconConnections(initialCompany);
        getEl('filterForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            void loadFinanceVision();
        });
        getEl('filterCompany')?.addEventListener('change', async () => {
            const selectedCompany = getEl('filterCompany')?.value || '';
            localStorage.setItem('fin_solidcon_vision_company', selectedCompany);
            await loadSolidconConnections(selectedCompany);
            await loadFinanceVision();
        });
        getEl('filterConnection')?.addEventListener('change', () => {
            const companyParam = getEl('filterCompany')?.value || '';
            const connVal = getEl('filterConnection')?.value || '';
            localStorage.setItem(`fin_solidcon_vision_conn_${companyParam || 'default'}`, connVal);
            void loadFinanceVision();
        });
        getEl('filterAno')?.addEventListener('change', () => {
            const val = getEl('filterAno')?.value || '';
            if (val)
                localStorage.setItem('fin_solidcon_vision_ano', val);
            void loadFinanceVision();
        });
        getEl('filterMes')?.addEventListener('change', () => {
            const val = getEl('filterMes')?.value || '';
            if (val)
                localStorage.setItem('fin_solidcon_vision_mes', val);
            void loadFinanceVision();
        });
        getEl('filterSource')?.addEventListener('change', () => {
            const val = getEl('filterSource')?.value || '';
            if (val)
                localStorage.setItem('fin_solidcon_vision_source', val);
            void loadFinanceVision();
        });
        getEl('filterFilial')?.addEventListener('change', () => {
            const companyParam = getEl('filterCompany')?.value || '';
            const val = getEl('filterFilial')?.value || '';
            localStorage.setItem(`fin_solidcon_vision_filial_${companyParam || 'default'}`, val);
            void loadFinanceVision();
        });
        getEl('transTypeFilter')?.addEventListener('change', () => {
            const val = getEl('transTypeFilter')?.value || 'all';
            localStorage.setItem('fin_solidcon_vision_trans_type', val);
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
