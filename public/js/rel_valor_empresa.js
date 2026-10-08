// @ts-nocheck
/**
 * rel_valor_empresa.ts
 * Relatório Analítico de Valores por Empresa
 */
(() => {
    // ─── DOM Helpers ──────────────────────────────────────────────────────────
    const getEl = (id) => document.getElementById(id);
    let isLoading = false;
    let accessibleCompanies = [];
    let currentCompanyPublicId = '';
    // State for Cartões Não Baixados
    let currentCartoesData = null;
    let rawLancamentos = [];
    let currentPeriodLabel = '';
    // State for Crediário e Convênio a Receber (até 2999)
    let currentCrediarioReceberData = null;
    let rawCrediarioCupons = [];
    // State for Contas a Pagar (Solidcon)
    let currentContasPagarData = null;
    let rawContasPagarLancamentos = [];
    let isContasPagarLoading = false;
    // State for Contas Geral Solidcon (BI / RDUPHOLD_CONTAS_A_PAGAR_BI)
    let currentContasGeralData = null;
    let rawContasGeralLancamentos = [];
    let isContasGeralLoading = false;
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    const formatMoney = (val) => {
        const num = Number(val || 0);
        return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };
    const formatDateBR = (isoDateStr) => {
        if (!isoDateStr)
            return '-';
        const clean = String(isoDateStr).slice(0, 10);
        const parts = clean.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return clean;
    };
    // ─── Status & Alert Helpers ───────────────────────────────────────────────
    const updateStatusBadge = (type, text) => {
        const badge = getEl('statusBadge');
        if (!badge)
            return;
        const colorMap = {
            ready: {
                dot: 'bg-emerald-500',
                bg: 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700'
            },
            loading: {
                dot: 'bg-amber-500 animate-ping',
                bg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
            },
            success: {
                dot: 'bg-emerald-500',
                bg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
            },
            error: {
                dot: 'bg-rose-500',
                bg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
            }
        };
        const config = colorMap[type] || colorMap.ready;
        badge.className = `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${config.bg}`;
        badge.innerHTML = `<span class="w-2 h-2 rounded-full ${config.dot}"></span><span>${text}</span>`;
    };
    const showAlert = (message, type = 'info') => {
        const box = getEl('alertMessage');
        if (!box)
            return;
        const classes = {
            info: 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800',
            success: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800',
            error: 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
        };
        box.className = `${classes[type]} p-4 rounded-xl text-sm mb-6 flex items-center justify-between shadow-sm`;
        box.innerHTML = `
            <div class="flex items-center gap-2">
                <span>${message}</span>
            </div>
            <button type="button" class="text-xs font-bold uppercase tracking-wider hover:opacity-75 cursor-pointer ml-4" onclick="this.parentElement.classList.add('hidden')">
                Fechar
            </button>
        `;
        box.classList.remove('hidden');
    };
    const hideAlert = () => {
        const box = getEl('alertMessage');
        if (box)
            box.classList.add('hidden');
    };
    // ─── Load Companies ───────────────────────────────────────────────────────
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
            const isGeneralAdmin = meRes?.data?.user?.role === 'super_admin' ||
                activeCompany?.is_general_admin === 1 ||
                activeCompany?.is_general_admin === true;
            if (isGeneralAdmin) {
                compSelect.disabled = false;
                const savedCompanyId = localStorage.getItem('rel_valor_empresa_company');
                compSelect.innerHTML = accessibleCompanies.map((c) => {
                    const idVal = c.public_id || c.id;
                    const displayName = c.trade_name || c.company_name || c.name || `Empresa #${c.id}`;
                    const isSelected = savedCompanyId
                        ? (idVal === savedCompanyId || String(c.id) === String(savedCompanyId))
                        : (idVal === currentCompanyPublicId);
                    return `<option value="${idVal}" ${isSelected ? 'selected' : ''}>${escapeHtml(displayName)}</option>`;
                }).join('');
            }
            else {
                const displayName = activeCompany?.trade_name || activeCompany?.company_name || activeCompany?.name || 'Minha Empresa';
                const idVal = activeCompany?.public_id || activeCompany?.id || '';
                compSelect.innerHTML = `<option value="${idVal}" selected>${escapeHtml(displayName)}</option>`;
                compSelect.value = idVal;
                compSelect.disabled = true;
            }
            if (compSelect.options.length > 0 && compSelect.selectedIndex === -1) {
                compSelect.selectedIndex = 0;
            }
        }
        catch (err) {
            console.warn('[Rel.Valor_Empresa] Falha ao carregar lista de empresas:', err);
            compSelect.innerHTML = '<option value="">Minha Empresa</option>';
        }
    }
    // ─── Load Solidcon Connections for Company ────────────────────────────────
    const loadSolidconConnections = async (targetCompany) => {
        const select = getEl('filterConnection');
        if (!select)
            return;
        const companyParam = targetCompany || getEl('filterCompany')?.value || '';
        try {
            select.innerHTML = '<option value="all">Carregando conexões...</option>';
            const url = `/finance/reports/solidcon-connections${companyParam ? `?targetCompanyId=${encodeURIComponent(companyParam)}` : ''}`;
            const res = await api(url);
            const conns = res?.data || [];
            select.innerHTML = `
                <option value="all">Todas as Conexões</option>
                <option value="">Padrão da Empresa (Solidcon)</option>
            `;
            conns.forEach((c) => {
                const opt = document.createElement('option');
                opt.value = String(c.id);
                opt.textContent = `${c.name || 'Conexão'} (${c.serv_solidcon || ''}/${c.bd_solidcon || 'solidcon'})`;
                if (c.is_default) {
                    opt.textContent += ' [Padrão]';
                }
                select.appendChild(opt);
            });
            const savedConnectionId = localStorage.getItem(`rel_valor_empresa_conn_${companyParam || 'default'}`);
            if (savedConnectionId && select.querySelector(`option[value="${savedConnectionId}"]`)) {
                select.value = savedConnectionId;
            }
            else {
                select.value = 'all';
            }
        }
        catch (err) {
            console.warn('[Rel.Valor_Empresa] Falha ao carregar conexões Solidcon:', err);
            select.innerHTML = `
                <option value="all">Todas as Conexões</option>
                <option value="">Padrão da Empresa (Solidcon)</option>
            `;
        }
    };
    // ─── Render Card: Cartões Não Baixados ────────────────────────────────────
    const renderCartoesCard = (cartoesData) => {
        if (!cartoesData || !cartoesData.loaded) {
            if (getEl('cardCartoesTotalLiquido'))
                getEl('cardCartoesTotalLiquido').textContent = 'R$ 0,00';
            if (getEl('cardCartoesTotalAVencer'))
                getEl('cardCartoesTotalAVencer').textContent = 'R$ 0,00';
            if (getEl('cardCartoesQtdAVencer'))
                getEl('cardCartoesQtdAVencer').textContent = 'Defina o período e filtre';
            if (getEl('cardCartoesTotalVencido'))
                getEl('cardCartoesTotalVencido').textContent = 'R$ 0,00';
            if (getEl('cardCartoesQtdVencido'))
                getEl('cardCartoesQtdVencido').textContent = 'Defina o período e filtre';
            if (getEl('badgeCardLancamentosCount'))
                getEl('badgeCardLancamentosCount').textContent = '-';
            if (getEl('badgeCartoesStatus')) {
                getEl('badgeCartoesStatus').textContent = 'Aguardando Filtro';
                getEl('badgeCartoesStatus').className = 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-slate-700/80 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600';
            }
            if (getEl('cardCartoesPeriodoBadge'))
                getEl('cardCartoesPeriodoBadge').textContent = 'Clique em Filtrar para carregar';
            if (getEl('modalCartoesBadgePeriodo'))
                getEl('modalCartoesBadgePeriodo').textContent = 'Não Consultado';
            if (getEl('cardCartoesModalidadesContainer')) {
                getEl('cardCartoesModalidadesContainer').innerHTML = '<span class="text-xs text-gray-400">Clique em Filtrar para carregar as modalidades</span>';
            }
            return;
        }
        const summary = cartoesData.summary || {};
        const totalLiquido = Number(summary.totalLiquido || 0);
        const totalLancamentos = Number(summary.totalLancamentos || 0);
        const totalAVencer = Number(summary.totalAVencer || 0);
        const totalVencido = Number(summary.totalVencido || 0);
        const qtdAVencer = Number(summary.qtdAVencer || 0);
        const qtdVencidos = Number(summary.qtdVencidos || 0);
        if (getEl('cardCartoesTotalLiquido')) {
            getEl('cardCartoesTotalLiquido').textContent = formatMoney(totalLiquido);
        }
        if (getEl('cardCartoesTotalAVencer')) {
            getEl('cardCartoesTotalAVencer').textContent = formatMoney(totalAVencer);
        }
        if (getEl('cardCartoesQtdAVencer')) {
            getEl('cardCartoesQtdAVencer').textContent = `${qtdAVencer} lote${qtdAVencer === 1 ? '' : 's'} com previsão futura`;
        }
        if (getEl('cardCartoesTotalVencido')) {
            getEl('cardCartoesTotalVencido').textContent = formatMoney(totalVencido);
        }
        if (getEl('cardCartoesQtdVencido')) {
            getEl('cardCartoesQtdVencido').textContent = `${qtdVencidos} lote${qtdVencidos === 1 ? '' : 's'} com previsão expirada`;
        }
        if (getEl('badgeCardLancamentosCount')) {
            getEl('badgeCardLancamentosCount').textContent = String(totalLancamentos);
        }
        if (getEl('badgeCartoesStatus')) {
            getEl('badgeCartoesStatus').textContent = totalLancamentos > 0 ? `${qtdAVencer} a Vencer • ${qtdVencidos} Vencidos` : 'Tudo Baixado';
            getEl('badgeCartoesStatus').className = totalLancamentos > 0
                ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                : 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60';
        }
        // Render modalidade distribution pills
        const modContainer = getEl('cardCartoesModalidadesContainer');
        if (modContainer) {
            const byModalidade = cartoesData.byModalidade || [];
            if (byModalidade.length === 0) {
                modContainer.innerHTML = '<span class="text-xs text-gray-400">Nenhum lote pendente no período</span>';
            }
            else {
                modContainer.innerHTML = byModalidade.map((m) => {
                    const badgeColor = m.modalidade.includes('CRED')
                        ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/50'
                        : m.modalidade.includes('DEB')
                            ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50'
                            : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50';
                    return `
                        <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${badgeColor}">
                            <span>${escapeHtml(m.modalidade)}:</span>
                            <span class="font-bold">${formatMoney(m.totalLiquido)}</span>
                            <span class="text-[10px] opacity-75">(${m.percentual}%)</span>
                        </div>
                    `;
                }).join('');
            }
        }
        // Filtros aplicados & Badges de Período Cartões
        const filtros = cartoesData.filtrosAplicados || {};
        const dtIni = filtros.dtInicio || '';
        const dtFim = filtros.dtFim || '';
        const tipoDt = filtros.tipoData || 'previsao';
        const tipoLabel = tipoDt === 'venda' ? 'Data Venda' : 'Previsão';
        let badgePeriodoText = `Mês ${currentPeriodLabel}`;
        if (dtIni && dtFim) {
            badgePeriodoText = `${formatDateBR(dtIni)} a ${formatDateBR(dtFim)} (${tipoLabel})`;
        }
        else if (dtIni) {
            badgePeriodoText = `A partir de ${formatDateBR(dtIni)} (${tipoLabel})`;
        }
        else if (dtFim) {
            badgePeriodoText = `Até ${formatDateBR(dtFim)} (${tipoLabel})`;
        }
        if (getEl('cardCartoesPeriodoBadge')) {
            getEl('cardCartoesPeriodoBadge').textContent = badgePeriodoText;
        }
        if (getEl('modalCartoesBadgePeriodo')) {
            getEl('modalCartoesBadgePeriodo').textContent = badgePeriodoText;
        }
    };
    // ─── Modal Cartões: Populate & Filter ─────────────────────────────────────
    const populateModalFilters = (cartoesData) => {
        const modSelect = getEl('modalCartoesFilterModalidade');
        const filSelect = getEl('modalCartoesFilterFilial');
        if (modSelect) {
            const modalidades = (cartoesData.byModalidade || []).map((m) => m.modalidade);
            modSelect.innerHTML = '<option value="">Todas as Modalidades</option>' +
                modalidades.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
        }
        if (filSelect) {
            const filiais = cartoesData.byFilial || [];
            filSelect.innerHTML = '<option value="">Todas as Filiais</option>' +
                filiais.map((f) => `<option value="${escapeHtml(f.filial)}">${escapeHtml(f.nomeFilial || `Filial ${f.filial}`)}</option>`).join('');
        }
    };
    const renderModalTable = (list) => {
        const tbody = getEl('modalCartoesTableBody');
        if (!tbody)
            return;
        if (!currentCartoesData || !currentCartoesData.loaded) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="py-12 text-center text-gray-500 dark:text-gray-400">
                        <div class="flex flex-col items-center justify-center gap-2">
                            <svg class="w-8 h-8 text-amber-400 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
                            <span class="font-medium text-gray-700 dark:text-gray-200">Cartões Não Baixados não consultados</span>
                            <span class="text-xs text-gray-500 dark:text-gray-400">Defina o período acima e clique em "Consultar Servidor" ou "Filtrar" para carregar os lotes de cartões.</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        if (!list || list.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="py-12 text-center text-gray-500 dark:text-gray-400">
                        <div class="flex flex-col items-center justify-center gap-2">
                            <svg class="w-8 h-8 text-gray-400 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            <span class="font-medium">Nenhum lançamento encontrado para os filtros selecionados.</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        tbody.innerHTML = list.map((item) => {
            const modalidadeUpper = String(item.modalidade || '').toUpperCase();
            const modBadgeClass = modalidadeUpper.includes('CRED')
                ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40'
                : modalidadeUpper.includes('DEB')
                    ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40'
                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40';
            const taxaPct = item.vlBruto > 0 ? ((item.vlTaxa / item.vlBruto) * 100).toFixed(1) : '0.0';
            const isAVencer = Boolean(item.isAVencer === 1 || item.isAVencer === true);
            const dias = Number(item.diasVencimento || 0);
            let statusBadge = '';
            if (isAVencer) {
                if (dias === 0) {
                    statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">Vence Hoje</span>`;
                }
                else {
                    statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">A Vencer (${dias}d)</span>`;
                }
            }
            else {
                statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">Vencido (${Math.abs(dias)}d)</span>`;
            }
            return `
                <tr class="hover:bg-gray-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td class="py-2.5 px-4 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        ${formatDateBR(item.dtVenda)}
                    </td>
                    <td class="py-2.5 px-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        ${formatDateBR(item.dtPrevisao)}
                    </td>
                    <td class="py-2.5 px-4 text-center whitespace-nowrap">
                        ${statusBadge}
                    </td>
                    <td class="py-2.5 px-4 text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">
                        ${escapeHtml(item.nome_filial || `Filial ${item.filial}`)}
                    </td>
                    <td class="py-2.5 px-4 whitespace-nowrap">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${modBadgeClass}">
                            ${escapeHtml(item.modalidade)}
                        </span>
                    </td>
                    <td class="py-2.5 px-4 font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                        ${escapeHtml(item.bandeira)}
                    </td>
                    <td class="py-2.5 px-4 text-center font-mono font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        ${Number(item.qtd || 1).toLocaleString('pt-BR')}
                    </td>
                    <td class="py-2.5 px-4 text-right font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        ${formatMoney(item.vlBruto)}
                    </td>
                    <td class="py-2.5 px-4 text-right font-mono text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        ${formatMoney(item.vlTaxa)} <span class="text-[10px] text-gray-400">(${taxaPct}%)</span>
                    </td>
                    <td class="py-2.5 px-4 text-right font-mono font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        ${formatMoney(item.vlLiquido)}
                    </td>
                </tr>
            `;
        }).join('');
    };
    const applyModalFilters = () => {
        if (!currentCartoesData || !currentCartoesData.loaded) {
            if (getEl('modalSummaryTotalLiquido'))
                getEl('modalSummaryTotalLiquido').textContent = 'R$ 0,00';
            if (getEl('modalSummaryTotalAVencer'))
                getEl('modalSummaryTotalAVencer').textContent = 'R$ 0,00';
            if (getEl('modalSummaryTotalVencido'))
                getEl('modalSummaryTotalVencido').textContent = 'R$ 0,00';
            if (getEl('modalSummaryTotalTaxa'))
                getEl('modalSummaryTotalTaxa').textContent = 'R$ 0,00';
            if (getEl('modalCartoesItemCount'))
                getEl('modalCartoesItemCount').textContent = '0 lançamentos';
            renderModalTable([]);
            return;
        }
        const query = (getEl('modalCartoesSearch')?.value || '').toLowerCase().trim();
        const selectedStatus = getEl('modalCartoesFilterStatus')?.value || 'all';
        const selectedMod = getEl('modalCartoesFilterModalidade')?.value || '';
        const selectedFilial = getEl('modalCartoesFilterFilial')?.value || '';
        const filtered = rawLancamentos.filter((item) => {
            const isAVencer = Boolean(item.isAVencer === 1 || item.isAVencer === true);
            if (selectedStatus === 'a_vencer' && !isAVencer) {
                return false;
            }
            if (selectedStatus === 'vencidos' && isAVencer) {
                return false;
            }
            if (selectedMod && item.modalidade !== selectedMod) {
                return false;
            }
            if (selectedFilial && String(item.filial) !== selectedFilial) {
                return false;
            }
            if (query) {
                const combined = `${item.bandeira} ${item.modalidade} ${item.nome_filial} ${item.dtVenda} ${item.dtPrevisao} ${item.historico}`.toLowerCase();
                if (!combined.includes(query))
                    return false;
            }
            return true;
        });
        // Update Ribbon Summary
        let sumLiquido = 0;
        let sumBruto = 0;
        let sumTaxa = 0;
        let sumAVencer = 0;
        let sumVencido = 0;
        filtered.forEach((r) => {
            const vl = Number(r.vlLiquido || 0);
            const vb = Number(r.vlBruto || 0);
            const vt = Number(r.vlTaxa || 0);
            const isAVencer = Boolean(r.isAVencer === 1 || r.isAVencer === true);
            sumLiquido += vl;
            sumBruto += vb;
            sumTaxa += vt;
            if (isAVencer) {
                sumAVencer += vl;
            }
            else {
                sumVencido += vl;
            }
        });
        if (getEl('modalSummaryTotalLiquido')) {
            getEl('modalSummaryTotalLiquido').textContent = formatMoney(sumLiquido);
        }
        if (getEl('modalSummaryTotalAVencer')) {
            getEl('modalSummaryTotalAVencer').textContent = formatMoney(sumAVencer);
        }
        if (getEl('modalSummaryTotalVencido')) {
            getEl('modalSummaryTotalVencido').textContent = formatMoney(sumVencido);
        }
        if (getEl('modalSummaryTotalTaxa')) {
            getEl('modalSummaryTotalTaxa').textContent = formatMoney(sumTaxa);
        }
        if (getEl('modalCartoesItemCount')) {
            getEl('modalCartoesItemCount').textContent = `Exibindo ${filtered.length} de ${rawLancamentos.length} lançamentos`;
        }
        renderModalTable(filtered);
    };
    const openModalCartoes = () => {
        const modal = getEl('modalCartoesNaoBaixados');
        if (!modal)
            return;
        // Sync card dates into modal
        const cardDtInicio = getEl('cardCartoesDtInicio')?.value || '';
        const cardDtFim = getEl('cardCartoesDtFim')?.value || '';
        const cardTipoData = getEl('cardCartoesTipoData')?.value || 'previsao';
        if (getEl('modalCartoesDtInicio')) {
            getEl('modalCartoesDtInicio').value = cardDtInicio;
        }
        if (getEl('modalCartoesDtFim')) {
            getEl('modalCartoesDtFim').value = cardDtFim;
        }
        if (getEl('modalCartoesTipoData')) {
            getEl('modalCartoesTipoData').value = cardTipoData;
        }
        // Reset search & filters
        if (getEl('modalCartoesSearch')) {
            getEl('modalCartoesSearch').value = '';
        }
        if (getEl('modalCartoesFilterStatus')) {
            getEl('modalCartoesFilterStatus').value = 'all';
        }
        if (getEl('modalCartoesFilterModalidade')) {
            getEl('modalCartoesFilterModalidade').value = '';
        }
        if (getEl('modalCartoesFilterFilial')) {
            getEl('modalCartoesFilterFilial').value = '';
        }
        applyModalFilters();
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    };
    const closeModalCartoes = () => {
        const modal = getEl('modalCartoesNaoBaixados');
        if (!modal)
            return;
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    };
    const exportCartoesCsv = () => {
        if (!rawLancamentos || rawLancamentos.length === 0) {
            showAlert('Não há dados para exportar.', 'info');
            return;
        }
        const headers = ['Data Venda', 'Previsão Recebimento', 'Status Vencimento', 'Dias Previsão', 'Filial', 'Modalidade', 'Bandeira / Operadora', 'Qtd Vendas', 'Valor Bruto', 'Taxa (R$)', 'Valor Líquido'];
        const rows = rawLancamentos.map((item) => {
            const isAVencer = Boolean(item.isAVencer === 1 || item.isAVencer === true);
            const dias = Number(item.diasVencimento || 0);
            const statusLabel = isAVencer ? (dias === 0 ? 'Vence Hoje' : 'A Vencer') : 'Vencido';
            return [
                formatDateBR(item.dtVenda),
                formatDateBR(item.dtPrevisao),
                `"${statusLabel}"`,
                dias,
                `"${(item.nome_filial || `Filial ${item.filial}`).replace(/"/g, '""')}"`,
                `"${(item.modalidade || '').replace(/"/g, '""')}"`,
                `"${(item.bandeira || '').replace(/"/g, '""')}"`,
                item.qtd || 1,
                Number(item.vlBruto || 0).toFixed(2).replace('.', ','),
                Number(item.vlTaxa || 0).toFixed(2).replace('.', ','),
                Number(item.vlLiquido || 0).toFixed(2).replace('.', ',')
            ];
        });
        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cartoes_nao_baixados_solidcon_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    // ─── Render Card: Crediário e Convênio a Receber (Sob Demanda) ──────────
    const renderCrediarioReceberCard = (data) => {
        if (!data || !data.loaded) {
            if (getEl('cardCrediarioTotalReceber'))
                getEl('cardCrediarioTotalReceber').textContent = 'R$ 0,00';
            if (getEl('cardCrediarioTotalVencido'))
                getEl('cardCrediarioTotalVencido').textContent = 'R$ 0,00';
            if (getEl('cardCrediarioQtdVencidos'))
                getEl('cardCrediarioQtdVencidos').textContent = 'Defina o período e filtre';
            if (getEl('cardCrediarioTotalAVencer'))
                getEl('cardCrediarioTotalAVencer').textContent = 'R$ 0,00';
            if (getEl('cardCrediarioQtdAVencer'))
                getEl('cardCrediarioQtdAVencer').textContent = 'Defina o período e filtre';
            if (getEl('badgeCrediarioStatus'))
                getEl('badgeCrediarioStatus').textContent = 'Aguardando Filtro';
            if (getEl('badgeCardCrediarioCount'))
                getEl('badgeCardCrediarioCount').textContent = '-';
            if (getEl('cardCrediarioPeriodoBadge'))
                getEl('cardCrediarioPeriodoBadge').textContent = 'Clique em Filtrar para carregar';
            if (getEl('modalCrediarioBadgePeriodo'))
                getEl('modalCrediarioBadgePeriodo').textContent = 'Não Consultado';
            return;
        }
        const summary = data.summary || {};
        const totalVencido = Number(summary.totalVencido || 0);
        const totalAVencer = Number(summary.totalAVencer || 0);
        const totalAReceber = (totalVencido + totalAVencer > 0)
            ? (totalVencido + totalAVencer)
            : Number(summary.totalAReceber || summary.totalReceber || 0);
        const qtdVencidos = Number(summary.qtdVencidos || 0);
        const qtdAVencer = Number(summary.qtdAVencer || 0);
        const qtdCupons = (qtdVencidos + qtdAVencer > 0)
            ? (qtdVencidos + qtdAVencer)
            : Number(summary.qtdCupons || 0);
        if (getEl('cardCrediarioTotalReceber')) {
            getEl('cardCrediarioTotalReceber').textContent = formatMoney(totalAReceber);
        }
        if (getEl('cardCrediarioTotalVencido')) {
            getEl('cardCrediarioTotalVencido').textContent = formatMoney(totalVencido);
        }
        if (getEl('cardCrediarioQtdVencidos')) {
            getEl('cardCrediarioQtdVencidos').textContent = `${qtdVencidos.toLocaleString('pt-BR')} cupons vencidos`;
        }
        if (getEl('cardCrediarioTotalAVencer')) {
            getEl('cardCrediarioTotalAVencer').textContent = formatMoney(totalAVencer);
        }
        if (getEl('cardCrediarioQtdAVencer')) {
            getEl('cardCrediarioQtdAVencer').textContent = `${qtdAVencer.toLocaleString('pt-BR')} cupons a vencer`;
        }
        if (getEl('badgeCrediarioStatus')) {
            getEl('badgeCrediarioStatus').textContent = `${qtdCupons.toLocaleString('pt-BR')} Cupons a Receber`;
        }
        if (getEl('badgeCardCrediarioCount')) {
            getEl('badgeCardCrediarioCount').textContent = String(qtdCupons);
        }
        // Filtros aplicados & Badges de Período
        const filtros = data.filtrosAplicados || {};
        const dtIni = filtros.dtInicio || '';
        const dtFim = filtros.dtFim || '';
        const tipoDt = filtros.tipoData || 'vencimento';
        const tipoLabel = tipoDt === 'emissao' ? 'Emissão' : 'Vencimento';
        let badgePeriodoText = 'Acumulado até 2999';
        if (dtIni && dtFim) {
            badgePeriodoText = `${formatDateBR(dtIni)} a ${formatDateBR(dtFim)} (${tipoLabel})`;
        }
        else if (dtIni) {
            badgePeriodoText = `A partir de ${formatDateBR(dtIni)} (${tipoLabel})`;
        }
        else if (dtFim) {
            badgePeriodoText = `Até ${formatDateBR(dtFim)} (${tipoLabel})`;
        }
        if (getEl('cardCrediarioPeriodoBadge')) {
            getEl('cardCrediarioPeriodoBadge').textContent = badgePeriodoText;
        }
        if (getEl('modalCrediarioBadgePeriodo')) {
            getEl('modalCrediarioBadgePeriodo').textContent = badgePeriodoText;
        }
    };
    // ─── Modal Crediário/Convênio: Populate & Filter ───────────────────────────
    const populateModalCrediarioFilters = (data) => {
        const filialSelect = getEl('modalCrediarioFilterFilial');
        if (filialSelect) {
            const filiais = data.byFilial || [];
            filialSelect.innerHTML = '<option value="">Todas as Filiais</option>' +
                filiais.map((f) => `<option value="${escapeHtml(f.filial)}">${escapeHtml(f.nomeFilial || `Filial ${f.filial}`)}</option>`).join('');
        }
    };
    const renderModalCrediarioTable = (list) => {
        const tbody = getEl('modalCrediarioTableBody');
        if (!tbody)
            return;
        if (!currentCrediarioReceberData || !currentCrediarioReceberData.loaded) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="py-12 text-center text-gray-500 dark:text-gray-400">
                        <div class="flex flex-col items-center justify-center gap-2">
                            <svg class="w-8 h-8 text-indigo-400 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
                            <span class="font-medium text-gray-700 dark:text-gray-200">Crediário e Convênio não consultados</span>
                            <span class="text-xs text-gray-500 dark:text-gray-400">Defina o período acima e clique em "Consultar Servidor" ou "Filtrar" para carregar os títulos.</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        if (!list || list.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="py-12 text-center text-gray-500 dark:text-gray-400">
                        <div class="flex flex-col items-center justify-center gap-2">
                            <svg class="w-8 h-8 text-gray-400 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            <span class="font-medium">Nenhum cupom a receber encontrado para os filtros selecionados.</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        tbody.innerHTML = list.map((item) => {
            const isVencido = item.isVencido;
            const statusBadgeClass = isVencido
                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40';
            const statusText = isVencido
                ? `Vencido (${item.diasAtraso}d)`
                : 'A Vencer';
            return `
                <tr class="hover:bg-gray-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td class="py-2.5 px-4 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        ${formatDateBR(item.dtEmissao)}
                    </td>
                    <td class="py-2.5 px-4 font-medium ${isVencido ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-gray-700 dark:text-gray-300'} whitespace-nowrap">
                        ${formatDateBR(item.dtVencimento)}
                    </td>
                    <td class="py-2.5 px-4 text-center whitespace-nowrap">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${statusBadgeClass}">
                            ${statusText}
                        </span>
                    </td>
                    <td class="py-2.5 px-4 font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap text-[11px]">
                        #${item.nrCupom || item.id}
                    </td>
                    <td class="py-2.5 px-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        ${escapeHtml(item.nomeFilial || `Filial ${item.filial}`)}
                    </td>
                    <td class="py-2.5 px-4 text-gray-900 dark:text-gray-100 font-medium max-w-xs truncate" title="${escapeHtml(item.cliente)} (${escapeHtml(item.cdCrediario)})">
                        ${escapeHtml(item.cliente)}
                    </td>
                    <td class="py-2.5 px-4 text-right font-mono font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                        ${formatMoney(item.vlCrediario)}
                    </td>
                    <td class="py-2.5 px-4 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ${formatMoney(item.vlQuitado)}
                    </td>
                    <td class="py-2.5 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        ${formatMoney(item.saldoPendente)}
                    </td>
                </tr>
            `;
        }).join('');
    };
    const applyModalCrediarioFilters = () => {
        const query = (getEl('modalCrediarioSearch')?.value || '').toLowerCase().trim();
        const selectedStatus = getEl('modalCrediarioFilterStatus')?.value || 'all';
        const selectedFilial = getEl('modalCrediarioFilterFilial')?.value || '';
        const dtInicio = getEl('modalCrediarioDtInicio')?.value || '';
        const dtFim = getEl('modalCrediarioDtFim')?.value || '';
        const tipoData = getEl('modalCrediarioTipoData')?.value || 'vencimento';
        const filtered = rawCrediarioCupons.filter((item) => {
            if (selectedStatus === 'vencidos' && !item.isVencido)
                return false;
            if (selectedStatus === 'a_vencer' && item.isVencido)
                return false;
            if (selectedFilial && String(item.filial) !== selectedFilial)
                return false;
            const targetDate = tipoData === 'emissao' ? item.dtEmissao : item.dtVencimento;
            if (dtInicio && targetDate && targetDate < dtInicio)
                return false;
            if (dtFim && targetDate && targetDate > dtFim)
                return false;
            if (query) {
                const combined = `${item.cliente || ''} ${item.cdCrediario || ''} ${item.nrCupom || ''} ${item.nomeFilial || ''} ${item.operador || ''} ${item.obs || ''}`.toLowerCase();
                if (!combined.includes(query))
                    return false;
            }
            return true;
        });
        // Update Ribbon Summary
        let sumVencido = 0;
        let sumAVencer = 0;
        filtered.forEach((r) => {
            const val = Number(r.saldoPendente || 0);
            if (r.isVencido)
                sumVencido += val;
            else
                sumAVencer += val;
        });
        const sumReceber = sumVencido + sumAVencer;
        if (getEl('modalCrediarioSummaryReceber')) {
            getEl('modalCrediarioSummaryReceber').textContent = formatMoney(sumReceber);
        }
        if (getEl('modalCrediarioSummaryVencido')) {
            getEl('modalCrediarioSummaryVencido').textContent = formatMoney(sumVencido);
        }
        if (getEl('modalCrediarioSummaryAVencer')) {
            getEl('modalCrediarioSummaryAVencer').textContent = formatMoney(sumAVencer);
        }
        if (getEl('modalCrediarioItemCount')) {
            getEl('modalCrediarioItemCount').textContent = `Exibindo ${filtered.length} de ${rawCrediarioCupons.length} cupons`;
        }
        renderModalCrediarioTable(filtered);
    };
    const openModalCrediario = () => {
        const modal = getEl('modalCrediarioReceber');
        if (!modal)
            return;
        if (getEl('modalCrediarioSearch')) {
            getEl('modalCrediarioSearch').value = '';
        }
        if (getEl('modalCrediarioFilterStatus')) {
            getEl('modalCrediarioFilterStatus').value = 'all';
        }
        if (getEl('modalCrediarioFilterFilial')) {
            getEl('modalCrediarioFilterFilial').value = '';
        }
        // Sync card dates into modal
        const cardDtInicio = getEl('cardCrediarioDtInicio')?.value || '';
        const cardDtFim = getEl('cardCrediarioDtFim')?.value || '';
        const cardTipoData = getEl('cardCrediarioTipoData')?.value || 'vencimento';
        if (getEl('modalCrediarioDtInicio')) {
            getEl('modalCrediarioDtInicio').value = cardDtInicio;
        }
        if (getEl('modalCrediarioDtFim')) {
            getEl('modalCrediarioDtFim').value = cardDtFim;
        }
        if (getEl('modalCrediarioTipoData')) {
            getEl('modalCrediarioTipoData').value = cardTipoData;
        }
        applyModalCrediarioFilters();
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    };
    const closeModalCrediario = () => {
        const modal = getEl('modalCrediarioReceber');
        if (!modal)
            return;
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    };
    const exportCrediarioCsv = () => {
        if (!rawCrediarioCupons || rawCrediarioCupons.length === 0) {
            showAlert('Não há cupons a receber para exportar.', 'info');
            return;
        }
        const headers = ['Emissão', 'Vencimento', 'Status', 'Dias de Atraso', 'Cupom nº', 'Filial', 'CPF/CNPJ Cliente', 'Cliente / Convênio', 'Valor Emitido', 'Valor Quitado', 'Saldo a Receber', 'Operador', 'Obs'];
        const rows = rawCrediarioCupons.map((item) => [
            formatDateBR(item.dtEmissao),
            formatDateBR(item.dtVencimento),
            item.isVencido ? '"Vencido"' : '"A Vencer"',
            item.diasAtraso || 0,
            item.nrCupom || item.id || '',
            `"${(item.nomeFilial || `Filial ${item.filial}`).replace(/"/g, '""')}"`,
            `"${(item.cdCrediario || '').replace(/"/g, '""')}"`,
            `"${(item.cliente || '').replace(/"/g, '""')}"`,
            Number(item.vlCrediario || 0).toFixed(2).replace('.', ','),
            Number(item.vlQuitado || 0).toFixed(2).replace('.', ','),
            Number(item.saldoPendente || 0).toFixed(2).replace('.', ','),
            `"${(item.operador || '').replace(/"/g, '""')}"`,
            `"${(item.obs || '').replace(/"/g, '""')}"`
        ]);
        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `crediario_convenio_a_receber_solidcon_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    // ─── Contas a Pagar (Solidcon): Render Card ────────────────────────────────
    const renderContasPagarCard = (data) => {
        const card = getEl('cardContasPagar');
        if (!card)
            return;
        if (!data || !data.loaded) {
            if (getEl('cardContasPagarTotalPagar'))
                getEl('cardContasPagarTotalPagar').textContent = 'R$ 0,00';
            if (getEl('cardContasPagarSubtitle'))
                getEl('cardContasPagarSubtitle').textContent = 'Defina o período e clique em Filtrar';
            if (getEl('cardContasPagarTotalVencido'))
                getEl('cardContasPagarTotalVencido').textContent = 'R$ 0,00';
            if (getEl('cardContasPagarQtdVencidos'))
                getEl('cardContasPagarQtdVencidos').textContent = 'Defina o período e filtre';
            if (getEl('cardContasPagarTotalAVencer'))
                getEl('cardContasPagarTotalAVencer').textContent = 'R$ 0,00';
            if (getEl('cardContasPagarQtdAVencer'))
                getEl('cardContasPagarQtdAVencer').textContent = 'Defina o período e filtre';
            if (getEl('cardContasPagarTotalPermuta'))
                getEl('cardContasPagarTotalPermuta').textContent = 'R$ 0,00';
            if (getEl('cardContasPagarQtdPermuta'))
                getEl('cardContasPagarQtdPermuta').textContent = 'Defina o período e filtre';
            if (getEl('badgeContasPagarStatus'))
                getEl('badgeContasPagarStatus').textContent = 'Aguardando Filtro';
            if (getEl('badgeCardContasPagarCount'))
                getEl('badgeCardContasPagarCount').textContent = '-';
            if (getEl('cardContasPagarPeriodoBadge'))
                getEl('cardContasPagarPeriodoBadge').textContent = 'Clique em Filtrar para carregar';
            if (getEl('modalContasPagarBadgePeriodo'))
                getEl('modalContasPagarBadgePeriodo').textContent = 'Não Consultado';
            if (getEl('cardContasPagarFiliaisCount'))
                getEl('cardContasPagarFiliaisCount').textContent = '0 filiais';
            if (getEl('cardContasPagarFiliaisCards')) {
                getEl('cardContasPagarFiliaisCards').innerHTML = '<span class="text-xs text-gray-400 col-span-full">Clique em Filtrar para carregar as filiais</span>';
            }
            return;
        }
        const summary = data.summary || {};
        const totalVencido = Number(summary.totalVencido || 0);
        const totalAVencer = Number(summary.totalAVencer || 0);
        const totalAPagar = Number(summary.totalAPagar !== undefined ? summary.totalAPagar : (totalVencido + totalAVencer));
        const qtdVencidos = Number(summary.qtdVencidos || 0);
        const qtdAVencer = Number(summary.qtdAVencer || 0);
        const qtdTitulos = (qtdVencidos + qtdAVencer > 0)
            ? (qtdVencidos + qtdAVencer)
            : Number(summary.qtdTitulos || 0);
        const totalPermuta = Number(summary.totalPermuta || 0);
        const qtdPermuta = Number(summary.qtdPermuta || 0);
        if (getEl('cardContasPagarTotalPagar')) {
            getEl('cardContasPagarTotalPagar').textContent = formatMoney(totalAPagar);
        }
        if (getEl('cardContasPagarSubtitle')) {
            getEl('cardContasPagarSubtitle').textContent = `${qtdTitulos.toLocaleString('pt-BR')} ${qtdTitulos === 1 ? 'título a pagar' : 'títulos a pagar'}`;
        }
        if (getEl('cardContasPagarTotalVencido')) {
            getEl('cardContasPagarTotalVencido').textContent = formatMoney(totalVencido);
        }
        if (getEl('cardContasPagarQtdVencidos')) {
            getEl('cardContasPagarQtdVencidos').textContent = `${qtdVencidos.toLocaleString('pt-BR')} títulos vencidos`;
        }
        if (getEl('cardContasPagarTotalAVencer')) {
            getEl('cardContasPagarTotalAVencer').textContent = formatMoney(totalAVencer);
        }
        if (getEl('cardContasPagarQtdAVencer')) {
            getEl('cardContasPagarQtdAVencer').textContent = `${qtdAVencer.toLocaleString('pt-BR')} títulos a vencer`;
        }
        if (getEl('cardContasPagarTotalPermuta')) {
            getEl('cardContasPagarTotalPermuta').textContent = formatMoney(totalPermuta);
        }
        if (getEl('cardContasPagarQtdPermuta')) {
            getEl('cardContasPagarQtdPermuta').textContent = `${qtdPermuta.toLocaleString('pt-BR')} ${qtdPermuta === 1 ? 'título de permuta' : 'títulos de permuta'}`;
        }
        if (getEl('badgeContasPagarStatus')) {
            getEl('badgeContasPagarStatus').textContent = `${qtdTitulos.toLocaleString('pt-BR')} Títulos a Pagar`;
        }
        if (getEl('badgeCardContasPagarCount')) {
            getEl('badgeCardContasPagarCount').textContent = String(qtdTitulos);
        }
        // Filtros aplicados & Badges de Período
        const filtros = data.filtrosAplicados || {};
        const dtIni = filtros.dtInicio || '';
        const dtFim = filtros.dtFim || '';
        const tipoDt = filtros.tipoData || 'vencimento';
        const tipoLabel = tipoDt === 'emissao' ? 'Emissão' : 'Vencimento';
        let badgePeriodoText = 'Acumulado até 2999';
        if (dtIni && dtFim) {
            badgePeriodoText = `${formatDateBR(dtIni)} a ${formatDateBR(dtFim)} (${tipoLabel})`;
        }
        else if (dtIni) {
            badgePeriodoText = `A partir de ${formatDateBR(dtIni)} (${tipoLabel})`;
        }
        else if (dtFim) {
            badgePeriodoText = `Até ${formatDateBR(dtFim)} (${tipoLabel})`;
        }
        if (getEl('cardContasPagarPeriodoBadge')) {
            getEl('cardContasPagarPeriodoBadge').textContent = badgePeriodoText;
        }
        if (getEl('modalContasPagarBadgePeriodo')) {
            getEl('modalContasPagarBadgePeriodo').textContent = badgePeriodoText;
        }
        // Render Filiais on Main Card
        const mainFiliaisContainer = getEl('cardContasPagarFiliaisCards');
        const mainCountBadge = getEl('cardContasPagarFiliaisCount');
        if (mainFiliaisContainer) {
            const filiais = data.byFilial || [];
            if (mainCountBadge) {
                mainCountBadge.textContent = `${filiais.length} ${filiais.length === 1 ? 'filial' : 'filiais'}`;
            }
            if (filiais.length === 0) {
                mainFiliaisContainer.innerHTML = '<span class="text-xs text-gray-400 col-span-full">Nenhum título a pagar no período</span>';
            }
            else {
                mainFiliaisContainer.innerHTML = filiais.map((f) => {
                    const fId = String(f.filial);
                    const fVenc = Number(f.totalVencido || 0);
                    const fAVenc = Number(f.totalAVencer || 0);
                    const fTotal = (fVenc + fAVenc > 0) ? (fVenc + fAVenc) : Number(f.totalAPagar || 0);
                    const fQtd = Number(f.qtdTitulos || 0);
                    return `
                        <button type="button" data-filial="${escapeHtml(fId)}" class="card-filial-pagar-btn text-left p-3.5 rounded-xl border border-rose-200/80 dark:border-slate-700/80 bg-rose-50/40 dark:bg-slate-900/50 hover:bg-rose-100/60 dark:hover:bg-slate-800/80 hover:border-rose-400 transition-all cursor-pointer flex flex-col justify-between group shadow-2xs">
                            <div class="flex items-center justify-between gap-1 mb-1.5">
                                <span class="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-rose-600 transition-colors" title="${escapeHtml(f.nomeFilial || `Filial ${f.filial}`)}">
                                    ${escapeHtml(f.nomeFilial || `Filial ${f.filial}`)}
                                </span>
                                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
                                    ${fQtd} tit.
                                </span>
                            </div>
                            <div class="text-base font-black text-rose-700 dark:text-rose-400">
                                ${formatMoney(fTotal)}
                            </div>
                        </button>
                    `;
                }).join('');
                mainFiliaisContainer.querySelectorAll('.card-filial-pagar-btn').forEach((btn) => {
                    btn.addEventListener('click', () => {
                        const targetFilial = btn.getAttribute('data-filial') || '';
                        openModalContasPagar(targetFilial);
                    });
                });
            }
        }
    };
    // ─── Modal Contas a Pagar: Filiais Cards, Populate & Filter ─────────────
    const renderModalContasPagarFiliaisCards = (data) => {
        const targetData = data || currentContasPagarData;
        const container = getEl('modalContasPagarFiliaisCards');
        const countBadge = getEl('modalContasPagarFiliaisCount');
        if (!container)
            return;
        if (!targetData || !targetData.loaded) {
            container.innerHTML = `
                <div class="col-span-full py-3 text-center text-xs text-gray-500 dark:text-gray-400">
                    Aguardando consulta do servidor...
                </div>
            `;
            if (countBadge)
                countBadge.textContent = '0 filiais';
            return;
        }
        const filiais = targetData.byFilial || [];
        if (countBadge) {
            countBadge.textContent = `${filiais.length} ${filiais.length === 1 ? 'filial' : 'filiais'}`;
        }
        const currentSelectedFilial = getEl('modalContasPagarFilterFilial')?.value || '';
        const summary = targetData.summary || {};
        const totalVencido = Number(summary.totalVencido || 0);
        const totalAVencer = Number(summary.totalAVencer || 0);
        const totalAPagar = Number(summary.totalAPagar !== undefined ? summary.totalAPagar : (totalVencido + totalAVencer));
        const qtdTitulos = (Number(summary.qtdVencidos || 0) + Number(summary.qtdAVencer || 0) > 0)
            ? (Number(summary.qtdVencidos || 0) + Number(summary.qtdAVencer || 0))
            : Number(summary.qtdTitulos || 0);
        const isAllActive = currentSelectedFilial === '';
        let html = `
            <!-- Card Todas as Filiais -->
            <button type="button" data-filial="" class="filial-card-btn text-left p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${isAllActive
            ? 'border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 ring-2 ring-rose-500/40 shadow-xs'
            : 'border-gray-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 hover:border-rose-300 dark:hover:border-rose-700/60 hover:bg-rose-50/30'}">
                <div class="flex items-center justify-between gap-1 mb-1">
                    <span class="text-[11px] font-bold text-gray-900 dark:text-white truncate">Todas as Filiais</span>
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${isAllActive ? 'bg-rose-200 text-rose-800 dark:bg-rose-900 dark:text-rose-200' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'}">
                        ${qtdTitulos} tit.
                    </span>
                </div>
                <div class="text-sm font-extrabold text-rose-700 dark:text-rose-400">
                    ${formatMoney(totalAPagar)}
                </div>
                <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-1 flex items-center justify-between">
                    <span class="text-red-600 dark:text-red-400 font-semibold">${formatMoney(totalVencido)} venc.</span>
                    <span class="text-amber-600 dark:text-amber-400 font-semibold">${formatMoney(totalAVencer)} a venc.</span>
                </div>
            </button>
        `;
        filiais.forEach((f) => {
            const filialId = String(f.filial);
            const isActive = currentSelectedFilial === filialId;
            const fVenc = Number(f.totalVencido || 0);
            const fAVenc = Number(f.totalAVencer || 0);
            const fTotal = Number(f.totalAPagar !== undefined ? f.totalAPagar : (fVenc + fAVenc));
            const fQtd = (Number(f.qtdVencidos || 0) + Number(f.qtdAVencer || 0) > 0)
                ? (Number(f.qtdVencidos || 0) + Number(f.qtdAVencer || 0))
                : Number(f.qtdTitulos || 0);
            html += `
                <button type="button" data-filial="${escapeHtml(filialId)}" class="filial-card-btn text-left p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${isActive
                ? 'border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 ring-2 ring-rose-500/40 shadow-xs'
                : 'border-gray-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 hover:border-rose-300 dark:hover:border-rose-700/60 hover:bg-rose-50/30'}">
                    <div class="flex items-center justify-between gap-1 mb-1">
                        <span class="text-[11px] font-bold text-gray-900 dark:text-white truncate" title="${escapeHtml(f.nomeFilial || `Filial ${f.filial}`)}">
                            ${escapeHtml(f.nomeFilial || `Filial ${f.filial}`)}
                        </span>
                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${isActive ? 'bg-rose-200 text-rose-800 dark:bg-rose-900 dark:text-rose-200' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'}">
                            ${fQtd} tit.
                        </span>
                    </div>
                    <div class="text-sm font-extrabold text-rose-700 dark:text-rose-400">
                        ${formatMoney(fTotal)}
                    </div>
                    <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-1 flex items-center justify-between">
                        <span class="text-red-600 dark:text-red-400 font-semibold">${formatMoney(fVenc)} venc.</span>
                        <span class="text-amber-600 dark:text-amber-400 font-semibold">${formatMoney(fAVenc)} a venc.</span>
                    </div>
                </button>
            `;
        });
        container.innerHTML = html;
        // Attach click listeners to cards
        container.querySelectorAll('.filial-card-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const targetFilial = btn.getAttribute('data-filial') || '';
                const select = getEl('modalContasPagarFilterFilial');
                if (select) {
                    select.value = targetFilial;
                }
                renderModalContasPagarFiliaisCards(currentContasPagarData);
                applyModalContasPagarFilters();
            });
        });
    };
    const populateModalContasPagarFilters = (data) => {
        const filialSelect = getEl('modalContasPagarFilterFilial');
        const filiais = data.byFilial || [];
        if (filialSelect) {
            const currentVal = filialSelect.value;
            filialSelect.innerHTML = '<option value="">Todas as Filiais</option>' +
                filiais.map((f) => `<option value="${escapeHtml(f.filial)}">${escapeHtml(f.nomeFilial || `Filial ${f.filial}`)}</option>`).join('');
            if (currentVal && filiais.some((f) => String(f.filial) === currentVal)) {
                filialSelect.value = currentVal;
            }
        }
        renderModalContasPagarFiliaisCards(data);
    };
    const renderModalContasPagarTable = (list) => {
        const tbody = getEl('modalContasPagarTableBody');
        if (!tbody)
            return;
        if (!currentContasPagarData || !currentContasPagarData.loaded) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" class="py-12 text-center text-gray-500 dark:text-gray-400">
                        <div class="flex flex-col items-center justify-center gap-2">
                            <svg class="w-8 h-8 text-rose-400 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <span class="font-medium text-gray-700 dark:text-gray-200">Contas a Pagar não consultadas</span>
                            <span class="text-xs text-gray-500 dark:text-gray-400">Defina o período acima e clique em "Consultar Servidor" ou "Filtrar" para carregar os títulos a pagar.</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        if (!list || list.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" class="py-12 text-center text-gray-500 dark:text-gray-400">
                        <div class="flex flex-col items-center justify-center gap-2">
                            <svg class="w-8 h-8 text-gray-400 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            <span class="font-medium">Nenhum título a pagar encontrado para os filtros selecionados.</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        // Group list items by Filial
        const groupsMap = new Map();
        list.forEach((item) => {
            const filialId = item.filial !== undefined && item.filial !== null ? String(item.filial) : '0';
            const nomeFilial = item.nomeFilial || `Filial ${filialId}`;
            const key = filialId;
            if (!groupsMap.has(key)) {
                groupsMap.set(key, {
                    filialKey: key,
                    filialId: item.filial,
                    nomeFilial,
                    items: [],
                    totalParcela: 0,
                    totalPermutado: 0,
                    totalPago: 0,
                    saldoPendente: 0,
                    totalVencido: 0,
                    totalAVencer: 0,
                    totalPermuta: 0,
                    qtdVencidos: 0,
                    qtdAVencer: 0,
                    qtdPermuta: 0
                });
            }
            const group = groupsMap.get(key);
            group.items.push(item);
            const parcela = Number(item.vlParcela || 0);
            const pago = Number(item.vlPago || 0);
            const saldo = Number(item.saldoPendente || 0);
            const isPermuta = Boolean(item.isPermuta);
            const vlPermutado = Number(item.vlPermutado !== undefined ? item.vlPermutado : (isPermuta ? parcela : 0));
            group.totalParcela += parcela;
            group.totalPermutado += vlPermutado;
            group.totalPago += pago;
            group.saldoPendente += saldo;
            const isPago = item.status === 'PAGO' || saldo <= 0.01;
            const isCancelado = Boolean(item.isCancelado);
            const isVencido = Boolean(item.isVencido) && !isPago && !isCancelado;
            if (isCancelado || isPago || saldo <= 0.01) {
                // cancelado ou quitado/pago não soma em vencido/a vencer
            }
            else {
                if (isVencido) {
                    group.totalVencido += saldo;
                    group.qtdVencidos += 1;
                }
                else {
                    group.totalAVencer += saldo;
                    group.qtdAVencer += 1;
                }
            }
            if (isPermuta || vlPermutado > 0) {
                group.totalPermuta += vlPermutado;
                group.qtdPermuta += 1;
            }
        });
        // Sort groups by filial ID or name
        const groups = Array.from(groupsMap.values()).sort((a, b) => {
            const numA = Number(a.filialId);
            const numB = Number(b.filialId);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return a.nomeFilial.localeCompare(b.nomeFilial);
        });
        let html = '';
        groups.forEach((group) => {
            if (groups.length > 1) {
                const pendentesFilial = group.qtdVencidos + group.qtdAVencer;
                const pendentesText = (pendentesFilial > 0 && pendentesFilial !== group.items.length)
                    ? `${pendentesFilial} a pagar de ${group.items.length} listados`
                    : `${pendentesFilial > 0 ? pendentesFilial : group.items.length} ${group.saldoPendente > 0.01 ? 'títulos a pagar' : 'títulos'}`;
                html += `
                    <tr class="bg-gray-100/90 dark:bg-slate-800/90 border-t-2 border-b border-gray-300 dark:border-slate-700 text-xs text-gray-800 dark:text-gray-200">
                        <td colspan="8" class="py-2 px-3 font-extrabold">
                            <div class="inline-flex items-center gap-1.5">
                                <span class="text-rose-600 dark:text-rose-400 font-bold">🏢 ${escapeHtml(group.nomeFilial)}</span>
                                <span class="text-[11px] font-medium text-gray-500 dark:text-gray-400">(${pendentesText})</span>
                            </div>
                        </td>
                        <td class="py-2 px-3 text-right font-mono font-bold text-gray-600 dark:text-gray-400 whitespace-nowrap text-[11px]">
                            ${formatMoney(group.totalParcela)}
                        </td>
                        <td class="py-2 px-3 text-right font-mono font-bold text-purple-700 dark:text-purple-400 whitespace-nowrap text-[11px]">
                            ${group.totalPermutado > 0 ? formatMoney(group.totalPermutado) : '-'}
                        </td>
                        <td class="py-2 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap text-[11px]">
                            ${formatMoney(group.totalPago)}
                        </td>
                        <td class="py-2 px-3 text-right font-mono font-black text-rose-700 dark:text-rose-400 whitespace-nowrap text-[11px]">
                            ${formatMoney(group.saldoPendente)}
                        </td>
                        <td class="py-2 px-3"></td>
                    </tr>
                `;
            }
            // Individual Title Rows for this Filial
            group.items.forEach((item) => {
                const isCancelado = Boolean(item.isCancelado);
                const isVencido = Boolean(item.isVencido);
                const isPermuta = Boolean(item.isPermuta);
                const saldoPendente = Number(item.saldoPendente || 0);
                const isPago = item.status === 'PAGO' || saldoPendente <= 0.01;
                const vlPermutado = Number(item.vlPermutado !== undefined ? item.vlPermutado : (isPermuta ? item.vlParcela : 0));
                let statusBadgeHtml = '';
                if (isCancelado) {
                    statusBadgeHtml = `
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700">
                            <span class="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
                            Cancelado
                        </span>
                    `;
                }
                else if (isPago) {
                    statusBadgeHtml = `
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            ${isPermuta ? 'Pago (Permuta)' : 'Pago'}
                        </span>
                    `;
                }
                else if (isVencido) {
                    statusBadgeHtml = `
                        <div class="inline-flex flex-col items-center">
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
                                <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                Aberto
                            </span>
                            <span class="text-[10px] font-bold text-red-600 dark:text-red-400 mt-0.5 whitespace-nowrap">
                                Vencido (${item.diasAtraso || 0}d)
                            </span>
                        </div>
                    `;
                }
                else {
                    statusBadgeHtml = `
                        <div class="inline-flex flex-col items-center">
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                                <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                Aberto
                            </span>
                            <span class="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5 whitespace-nowrap">
                                A Vencer
                            </span>
                        </div>
                    `;
                }
                const permutaBadgeHtml = isPermuta
                    ? `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60" title="Conta com Permuta">🔄 Permuta</span>`
                    : '';
                html += `
                    <tr class="hover:bg-rose-50/30 dark:hover:bg-slate-800/50 transition-colors ${isCancelado ? 'opacity-60 bg-zinc-50/40 dark:bg-zinc-950/30' : (isPago ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : '')}">
                        <td class="py-2.5 px-3 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                            ${formatDateBR(item.dtEmissao)}
                        </td>
                        <td class="py-2.5 px-3 font-medium ${isVencido && !isCancelado && !isPago ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-700 dark:text-gray-300'} whitespace-nowrap">
                            ${formatDateBR(item.dtVencimento)}
                        </td>
                        <td class="py-2.5 px-3 text-center whitespace-nowrap">
                            ${statusBadgeHtml}
                        </td>
                        <td class="py-2.5 px-3 font-mono text-gray-800 dark:text-gray-200 whitespace-nowrap text-xs font-semibold" title="Conta #${item.cdConta}">
                            <div class="inline-flex items-center gap-1.5">
                                <span>${escapeHtml(item.numeroDocumento || `#${item.cdConta}`)}</span>
                                ${permutaBadgeHtml}
                            </div>
                        </td>
                        <td class="py-2.5 px-2 text-center font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                            ${item.cdContaParcela || 1}
                        </td>
                        <td class="py-2.5 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs">
                            ${escapeHtml(item.nomeFilial || `Filial ${item.filial}`)}
                        </td>
                        <td class="py-2.5 px-3 text-gray-900 dark:text-gray-100 font-medium max-w-xs truncate text-xs" title="${escapeHtml(item.fornecedor)} - ${escapeHtml(item.historico || '')}">
                            ${escapeHtml(item.fornecedor)}
                        </td>
                        <td class="py-2.5 px-3 font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                            ${escapeHtml(item.documentoPessoa || '-')}
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                            ${formatMoney(item.vlParcela)}
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono font-bold ${isPermuta || vlPermutado > 0 ? 'text-purple-700 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500'} whitespace-nowrap">
                            ${isPermuta || vlPermutado > 0 ? formatMoney(vlPermutado) : '-'}
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            ${formatMoney(item.vlPago)}
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono font-bold ${saldoPendente <= 0.01 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} whitespace-nowrap">
                            ${formatMoney(item.saldoPendente)}
                        </td>
                        <td class="py-2.5 px-3 text-center whitespace-nowrap">
                            <button type="button" class="btn-view-contas-pagar-historico p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 shadow-2xs hover:scale-110 transition-all cursor-pointer inline-flex items-center justify-center" data-id="${item.id}" title="Visualizar Histórico e Detalhes do Lançamento">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                </svg>
                            </button>
                        </td>
                    </tr>
                `;
            });
        });
        // Grand Total Consolidado Row (when there are multiple groups or titles)
        if (groups.length > 0) {
            let gParcela = 0;
            let gPermutado = 0;
            let gPago = 0;
            let gSaldo = 0;
            let gTitulos = 0;
            let gTitulosPendente = 0;
            groups.forEach(g => {
                gParcela += g.totalParcela;
                gPermutado += g.totalPermutado;
                gPago += g.totalPago;
                gSaldo += g.saldoPendente;
                gTitulos += g.items.length;
                gTitulosPendente += (g.qtdVencidos + g.qtdAVencer);
            });
            const titulosLabel = (gTitulosPendente > 0 && gTitulosPendente !== gTitulos)
                ? `${gTitulosPendente} a pagar de ${gTitulos} listados`
                : `${gTitulos} títulos ${gSaldo > 0.01 ? 'a pagar' : 'listados'}`;
            html += `
                <tr class="bg-linear-to-r from-gray-100 via-rose-50 to-gray-100 dark:from-slate-900 dark:via-rose-950/40 dark:to-slate-900 font-bold border-t-2 border-b-2 border-rose-300 dark:border-rose-800 text-xs text-gray-900 dark:text-white sticky bottom-0 z-10 shadow-md">
                    <td colspan="8" class="py-3 px-4 text-right">
                        <div class="inline-flex items-center gap-1.5 uppercase tracking-wider text-gray-800 dark:text-gray-200 font-extrabold">
                            <svg class="w-4 h-4 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                            <span>Totais Consolidados (${titulosLabel}):</span>
                        </div>
                    </td>
                    <td class="py-3 px-3 text-right font-mono font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap" title="Total Nominal Emitido das Parcelas">
                        <div class="text-[10px] uppercase font-semibold text-gray-400 dark:text-gray-400 font-sans">Emitido</div>
                        <div>${formatMoney(gParcela)}</div>
                    </td>
                    <td class="py-3 px-3 text-right font-mono font-bold text-purple-800 dark:text-purple-300 whitespace-nowrap" title="Total Quitado por Permuta">
                        <div class="text-[10px] uppercase font-semibold text-purple-500/80 font-sans">Permutado</div>
                        <div>${gPermutado > 0 ? formatMoney(gPermutado) : '-'}</div>
                    </td>
                    <td class="py-3 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap" title="Total Pago/Baixado">
                        <div class="text-[10px] uppercase font-semibold text-emerald-600/80 font-sans">Pago</div>
                        <div>${formatMoney(gPago)}</div>
                    </td>
                    <td class="py-3 px-3 text-right font-mono font-black text-rose-700 dark:text-rose-300 whitespace-nowrap bg-rose-100/60 dark:bg-rose-950/60 rounded-lg" title="Saldo Líquido em Aberto a Pagar">
                        <div class="text-[10px] uppercase font-black text-rose-700 dark:text-rose-300 font-sans">Saldo a Pagar</div>
                        <div class="text-sm font-black">${formatMoney(gSaldo)}</div>
                    </td>
                    <td class="py-3 px-3"></td>
                </tr>
            `;
        }
        tbody.innerHTML = html;
        // Attach click listener for eye (historico) buttons
        tbody.querySelectorAll('.btn-view-contas-pagar-historico').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                if (id) {
                    openModalContasPagarHistorico(id);
                }
            });
        });
    };
    const applyModalContasPagarFilters = () => {
        const query = (getEl('modalContasPagarSearch')?.value || '').toLowerCase().trim();
        const selectedStatus = getEl('modalContasPagarFilterStatus')?.value || 'all';
        const selectedFilial = getEl('modalContasPagarFilterFilial')?.value || '';
        const dtInicio = getEl('modalContasPagarDtInicio')?.value || '';
        const dtFim = getEl('modalContasPagarDtFim')?.value || '';
        const tipoData = getEl('modalContasPagarTipoData')?.value || 'vencimento';
        const filtered = rawContasPagarLancamentos.filter((item) => {
            const saldo = Number(item.saldoPendente || 0);
            const isPago = item.status === 'PAGO' || saldo <= 0.01;
            if (selectedStatus === 'ativos' && (item.isCancelado || isPago))
                return false;
            if (selectedStatus === 'pagos' && (item.isCancelado || !isPago))
                return false;
            if (selectedStatus === 'vencidos' && (item.isCancelado || isPago || !item.isVencido))
                return false;
            if (selectedStatus === 'a_vencer' && (item.isCancelado || isPago || item.isVencido))
                return false;
            if (selectedStatus === 'permutas' && (!item.isPermuta || item.isCancelado))
                return false;
            if (selectedStatus === 'sem_permutas' && (item.isPermuta || item.isCancelado))
                return false;
            if (selectedStatus === 'cancelados' && !item.isCancelado)
                return false;
            if (selectedFilial && String(item.filial) !== selectedFilial)
                return false;
            const targetDate = tipoData === 'emissao' ? item.dtEmissao : item.dtVencimento;
            if (dtInicio && targetDate && targetDate < dtInicio)
                return false;
            if (dtFim && targetDate && targetDate > dtFim)
                return false;
            if (query) {
                const combined = `${item.fornecedor || ''} ${item.documentoPessoa || ''} ${item.numeroDocumento || ''} ${item.cdConta || ''} ${item.nomeFilial || ''} ${item.historico || ''}`.toLowerCase();
                if (!combined.includes(query))
                    return false;
            }
            return true;
        });
        // Update Ribbon Summary
        let sumVencido = 0;
        let sumAVencer = 0;
        let sumPermuta = 0;
        filtered.forEach((r) => {
            if (r.isCancelado)
                return; // cancelados não somam no saldo a pagar
            const val = Number(r.saldoPendente || 0);
            const vlPerm = Number(r.vlPermutado !== undefined ? r.vlPermutado : (r.isPermuta ? r.vlParcela : 0));
            if (r.isPermuta || vlPerm > 0)
                sumPermuta += vlPerm;
            const isPago = r.status === 'PAGO' || val <= 0.01;
            if (!isPago && val > 0.01) {
                if (r.isVencido)
                    sumVencido += val;
                else
                    sumAVencer += val;
            }
        });
        const sumPagar = sumVencido + sumAVencer;
        if (getEl('modalContasPagarSummaryPagar')) {
            getEl('modalContasPagarSummaryPagar').textContent = formatMoney(sumPagar);
        }
        if (getEl('modalContasPagarSummaryVencido')) {
            getEl('modalContasPagarSummaryVencido').textContent = formatMoney(sumVencido);
        }
        if (getEl('modalContasPagarSummaryAVencer')) {
            getEl('modalContasPagarSummaryAVencer').textContent = formatMoney(sumAVencer);
        }
        if (getEl('modalContasPagarSummaryPermuta')) {
            getEl('modalContasPagarSummaryPermuta').textContent = formatMoney(sumPermuta);
        }
        const filteredPending = filtered.filter((r) => !r.isCancelado && r.status !== 'PAGO' && Number(r.saldoPendente || 0) > 0.01).length;
        if (getEl('modalContasPagarItemCount')) {
            getEl('modalContasPagarItemCount').textContent = `Exibindo ${filtered.length} de ${rawContasPagarLancamentos.length} títulos${filteredPending !== filtered.length ? ` (${filteredPending} a pagar)` : ''}`;
        }
        renderModalContasPagarTable(filtered);
    };
    const openModalContasPagar = (initialFilial) => {
        const modal = getEl('modalContasPagar');
        if (!modal)
            return;
        if (getEl('modalContasPagarSearch')) {
            getEl('modalContasPagarSearch').value = '';
        }
        if (getEl('modalContasPagarFilterStatus')) {
            getEl('modalContasPagarFilterStatus').value = 'all';
        }
        if (getEl('modalContasPagarFilterFilial')) {
            getEl('modalContasPagarFilterFilial').value = initialFilial || '';
        }
        // Sync card dates into modal
        const cardDtInicio = getEl('cardContasPagarDtInicio')?.value || '';
        const cardDtFim = getEl('cardContasPagarDtFim')?.value || '';
        const cardTipoData = getEl('cardContasPagarTipoData')?.value || 'vencimento';
        if (getEl('modalContasPagarDtInicio')) {
            getEl('modalContasPagarDtInicio').value = cardDtInicio;
        }
        if (getEl('modalContasPagarDtFim')) {
            getEl('modalContasPagarDtFim').value = cardDtFim;
        }
        if (getEl('modalContasPagarTipoData')) {
            getEl('modalContasPagarTipoData').value = cardTipoData;
        }
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        // Se ainda não estiver carregado, dispara automaticamente a consulta das contas a pagar por filial
        if (!currentContasPagarData || !currentContasPagarData.loaded) {
            void loadContasPagar({ targetFilial: initialFilial });
        }
        else {
            populateModalContasPagarFilters(currentContasPagarData);
            if (initialFilial !== undefined) {
                const filialSelect = getEl('modalContasPagarFilterFilial');
                if (filialSelect)
                    filialSelect.value = initialFilial;
                renderModalContasPagarFiliaisCards(currentContasPagarData);
            }
            applyModalContasPagarFilters();
        }
    };
    const closeModalContasPagar = () => {
        const modal = getEl('modalContasPagar');
        if (!modal)
            return;
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    };
    // ─── Modal Histórico do Lançamento ───────────────────────────────────────
    const openModalContasPagarHistorico = (id) => {
        const item = rawContasPagarLancamentos.find((x) => String(x.id) === String(id));
        if (!item) {
            showAlert('Lançamento não encontrado.', 'error');
            return;
        }
        const modal = getEl('modalContasPagarHistorico');
        if (!modal)
            return;
        // Populate header
        if (getEl('histModalDocNum')) {
            getEl('histModalDocNum').textContent = item.numeroDocumento || `#${item.cdConta}`;
        }
        const isCancelado = Boolean(item.isCancelado);
        const isVencido = Boolean(item.isVencido);
        const isPermuta = Boolean(item.isPermuta);
        const saldoPendente = Number(item.saldoPendente || 0);
        const isPago = item.status === 'PAGO' || saldoPendente <= 0.01;
        // Status Badge (Ativo vs Pago vs Cancelado)
        const statusBadge = getEl('histModalStatusBadge');
        if (statusBadge) {
            if (isCancelado) {
                statusBadge.textContent = 'Cancelado';
                statusBadge.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700';
            }
            else if (isPago) {
                statusBadge.textContent = isPermuta ? 'Pago (Permuta)' : 'Pago';
                statusBadge.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
            }
            else {
                statusBadge.textContent = 'Em Aberto';
                statusBadge.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
            }
        }
        // Filial Badge
        if (getEl('histModalFilialBadge')) {
            getEl('histModalFilialBadge').textContent = item.nomeFilial || `Filial ${item.filial}`;
        }
        // Situação Badge (Vencido vs A Vencer vs Quitado vs Cancelado)
        const situacaoBadge = getEl('histModalSituacaoBadge');
        if (situacaoBadge) {
            if (isCancelado) {
                situacaoBadge.textContent = 'Título Cancelado';
                situacaoBadge.className = 'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700';
            }
            else if (isPago) {
                situacaoBadge.textContent = isPermuta ? 'Quitado por Permuta' : 'Quitado / Pago';
                situacaoBadge.className = 'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60';
            }
            else if (isVencido) {
                situacaoBadge.textContent = `Vencido há ${item.diasAtraso || 0} dias`;
                situacaoBadge.className = 'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/60';
            }
            else {
                situacaoBadge.textContent = 'A Vencer (Dentro do Prazo)';
                situacaoBadge.className = 'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50';
            }
        }
        // Permuta Badge
        const permutaBadgeEl = getEl('histModalPermutaBadge');
        if (permutaBadgeEl) {
            if (isPermuta) {
                permutaBadgeEl.classList.remove('hidden');
            }
            else {
                permutaBadgeEl.classList.add('hidden');
            }
        }
        // Saldo Pendente
        if (getEl('histModalSaldoPendente')) {
            getEl('histModalSaldoPendente').textContent = formatMoney(item.saldoPendente);
        }
        // Identificação & Fornecedor
        if (getEl('histModalFornecedor'))
            getEl('histModalFornecedor').textContent = item.fornecedor || '-';
        if (getEl('histModalDocumentoPessoa'))
            getEl('histModalDocumentoPessoa').textContent = item.documentoPessoa || '-';
        if (getEl('histModalCdPessoaComercial'))
            getEl('histModalCdPessoaComercial').textContent = item.cdPessoaComercial ? `#${item.cdPessoaComercial}` : '-';
        if (getEl('histModalNumeroDocumento'))
            getEl('histModalNumeroDocumento').textContent = item.numeroDocumento || `#${item.cdConta}`;
        if (getEl('histModalNomeFilial'))
            getEl('histModalNomeFilial').textContent = item.nomeFilial || `Filial ${item.filial}`;
        if (getEl('histModalParcela'))
            getEl('histModalParcela').textContent = String(item.cdContaParcela || 1);
        // Valores
        const vlPermutado = Number(item.vlPermutado !== undefined ? item.vlPermutado : (isPermuta ? item.vlParcela : 0));
        if (getEl('histModalVlParcela'))
            getEl('histModalVlParcela').textContent = formatMoney(item.vlParcela);
        if (getEl('histModalVlPermutado'))
            getEl('histModalVlPermutado').textContent = isPermuta || vlPermutado > 0 ? formatMoney(vlPermutado) : 'R$ 0,00';
        if (getEl('histModalVlPago'))
            getEl('histModalVlPago').textContent = formatMoney(item.vlPago);
        if (getEl('histModalSaldo'))
            getEl('histModalSaldo').textContent = formatMoney(item.saldoPendente);
        if (getEl('histModalVlMulta'))
            getEl('histModalVlMulta').textContent = formatMoney(item.vlMulta || 0);
        if (getEl('histModalVlMora'))
            getEl('histModalVlMora').textContent = formatMoney(item.vlMora || 0);
        if (getEl('histModalVlDesconto'))
            getEl('histModalVlDesconto').textContent = formatMoney(item.vlDesconto || 0);
        // Datas
        if (getEl('histModalDtEmissao'))
            getEl('histModalDtEmissao').textContent = formatDateBR(item.dtEmissao);
        if (getEl('histModalDtVencimento'))
            getEl('histModalDtVencimento').textContent = formatDateBR(item.dtVencimento);
        if (getEl('histModalDtCompetencia'))
            getEl('histModalDtCompetencia').textContent = formatDateBR(item.dtCompetencia) || '-';
        if (getEl('histModalDtBaixa'))
            getEl('histModalDtBaixa').textContent = formatDateBR(item.dtBaixa) || '-';
        // Histórico
        if (getEl('histModalHistorico')) {
            const hist = (item.historico || '').trim();
            getEl('histModalHistorico').textContent = hist || 'Nenhum histórico informado no lançamento.';
        }
        const histBaixaContainer = getEl('histModalHistoricoBaixaContainer');
        const histBaixaEl = getEl('histModalHistoricoBaixa');
        if (histBaixaContainer && histBaixaEl) {
            const histBaixa = (item.historicoBaixa || '').trim();
            if (histBaixa) {
                histBaixaEl.textContent = histBaixa;
                histBaixaContainer.classList.remove('hidden');
            }
            else {
                histBaixaContainer.classList.add('hidden');
            }
        }
        // Rastreabilidade Solidcon
        if (getEl('histModalCdConta'))
            getEl('histModalCdConta').textContent = `#${item.cdConta}`;
        if (getEl('histModalCdContaParcela'))
            getEl('histModalCdContaParcela').textContent = String(item.cdContaParcela || 1);
        if (getEl('histModalCdContaBaixa'))
            getEl('histModalCdContaBaixa').textContent = item.cdContaBaixa ? `#${item.cdContaBaixa}` : 'Nenhuma';
        if (getEl('histModalCdBancoContaMovimento'))
            getEl('histModalCdBancoContaMovimento').textContent = item.cdBancoContaMovimento ? `#${item.cdBancoContaMovimento}` : 'Nenhum';
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    };
    const closeModalContasPagarHistorico = () => {
        const modal = getEl('modalContasPagarHistorico');
        if (!modal)
            return;
        modal.classList.add('hidden');
        // If main contas pagar modal is still visible, maintain body overflow-hidden
        if (getEl('modalContasPagar')?.classList.contains('hidden')) {
            document.body.classList.remove('overflow-hidden');
        }
    };
    const exportContasPagarCsv = () => {
        if (!rawContasPagarLancamentos || rawContasPagarLancamentos.length === 0) {
            showAlert('Não há títulos a pagar para exportar.', 'info');
            return;
        }
        const headers = ['Emissão', 'Vencimento', 'Situação', 'Status', 'Tipo Operação', 'Dias de Atraso', 'Documento/NF', 'Parcela', 'Filial', 'CNPJ/CPF Fornecedor', 'Fornecedor', 'Histórico', 'Valor Parcela', 'Total Permutado', 'Valor Pago', 'Saldo a Pagar'];
        const rows = rawContasPagarLancamentos.map((item) => {
            const isPermuta = Boolean(item.isPermuta);
            const vlPerm = Number(item.vlPermutado !== undefined ? item.vlPermutado : (isPermuta ? item.vlParcela : 0));
            const saldo = Number(item.saldoPendente || 0);
            const isPago = item.status === 'PAGO' || saldo <= 0.01;
            const situacaoStr = item.isCancelado ? 'Cancelado' : (isPago ? 'Pago' : 'Em Aberto');
            const statusStr = item.isCancelado ? 'Cancelado' : (isPago ? (isPermuta ? 'Pago (Permuta)' : 'Pago') : (item.isVencido ? 'Vencido' : 'A Vencer'));
            return [
                formatDateBR(item.dtEmissao),
                formatDateBR(item.dtVencimento),
                `"${situacaoStr}"`,
                `"${statusStr}"`,
                isPermuta ? '"Permuta"' : '"Comum"',
                item.diasAtraso || 0,
                `"${(item.numeroDocumento || `#${item.cdConta}`).replace(/"/g, '""')}"`,
                item.cdContaParcela || 1,
                `"${(item.nomeFilial || `Filial ${item.filial}`).replace(/"/g, '""')}"`,
                `"${(item.documentoPessoa || '').replace(/"/g, '""')}"`,
                `"${(item.fornecedor || '').replace(/"/g, '""')}"`,
                `"${(item.historico || '').replace(/"/g, '""')}"`,
                Number(item.vlParcela || 0).toFixed(2).replace('.', ','),
                vlPerm.toFixed(2).replace('.', ','),
                Number(item.vlPago || 0).toFixed(2).replace('.', ','),
                saldo.toFixed(2).replace('.', ',')
            ];
        });
        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contas_a_pagar_solidcon_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    // ─── Load Contas a Pagar (Sob Demanda) ────────────────────────────────────
    const loadContasPagar = async (options) => {
        if (isContasPagarLoading)
            return;
        isContasPagarLoading = true;
        const btnCard = getEl('btnFilterContasPagarCard');
        const btnModal = getEl('btnFilterContasPagarModal');
        const origBtnCardHtml = btnCard?.innerHTML;
        const origBtnModalHtml = btnModal?.innerHTML;
        if (btnCard) {
            btnCard.disabled = true;
            btnCard.classList.add('opacity-70');
            btnCard.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Filtrando...</span>`;
        }
        if (btnModal) {
            btnModal.disabled = true;
            btnModal.classList.add('opacity-70');
            btnModal.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Consultando...</span>`;
        }
        try {
            if (options?.resetDates) {
                if (getEl('cardContasPagarDtInicio'))
                    getEl('cardContasPagarDtInicio').value = '';
                if (getEl('cardContasPagarDtFim'))
                    getEl('cardContasPagarDtFim').value = '';
                if (getEl('cardContasPagarTipoData'))
                    getEl('cardContasPagarTipoData').value = 'vencimento';
                if (getEl('modalContasPagarDtInicio'))
                    getEl('modalContasPagarDtInicio').value = '';
                if (getEl('modalContasPagarDtFim'))
                    getEl('modalContasPagarDtFim').value = '';
                if (getEl('modalContasPagarTipoData'))
                    getEl('modalContasPagarTipoData').value = 'vencimento';
            }
            const companyParam = getEl('filterCompany')?.value || '';
            const connId = getEl('filterConnection')?.value || '';
            const cardDtInicio = getEl('cardContasPagarDtInicio')?.value || '';
            const cardDtFim = getEl('cardContasPagarDtFim')?.value || '';
            const cardTipoData = getEl('cardContasPagarTipoData')?.value || 'vencimento';
            // Also synchronize into modal
            if (getEl('modalContasPagarDtInicio'))
                getEl('modalContasPagarDtInicio').value = cardDtInicio;
            if (getEl('modalContasPagarDtFim'))
                getEl('modalContasPagarDtFim').value = cardDtFim;
            if (getEl('modalContasPagarTipoData'))
                getEl('modalContasPagarTipoData').value = cardTipoData;
            const queryParams = new URLSearchParams({
                includeContasPagar: '1',
                ...(companyParam ? { company_id: companyParam } : {}),
                ...(connId ? { connectionId: connId, connection_id: connId } : {}),
                ...(cardDtInicio ? { dtInicioContasPagar: cardDtInicio } : {}),
                ...(cardDtFim ? { dtFimContasPagar: cardDtFim } : {}),
                ...(cardTipoData ? { tipoDataContasPagar: cardTipoData } : {})
            });
            const res = await api(`/finance/solidcon-vision?${queryParams.toString()}`);
            const data = res?.data;
            if (!data)
                throw new Error('Falha ao obter dados de contas a pagar do servidor.');
            currentContasPagarData = data.contasPagar || {
                loaded: true,
                summary: { totalAPagar: 0, totalVencido: 0, totalAVencer: 0, totalPermuta: 0, qtdTitulos: 0, qtdVencidos: 0, qtdAVencer: 0, qtdPermuta: 0, ticketMedio: 0 },
                topFornecedores: [],
                byFilial: [],
                lancamentos: []
            };
            currentContasPagarData.loaded = true;
            rawContasPagarLancamentos = currentContasPagarData.lancamentos || [];
            renderContasPagarCard(currentContasPagarData);
            populateModalContasPagarFilters(currentContasPagarData);
            if (options?.targetFilial !== undefined) {
                const filialSelect = getEl('modalContasPagarFilterFilial');
                if (filialSelect)
                    filialSelect.value = options.targetFilial;
                renderModalContasPagarFiliaisCards(currentContasPagarData);
            }
            if (!getEl('modalContasPagar')?.classList.contains('hidden')) {
                applyModalContasPagarFilters();
            }
            const totalTitulos = currentContasPagarData.summary?.qtdTitulos || 0;
            showAlert(`Contas a pagar carregadas com sucesso (${totalTitulos.toLocaleString('pt-BR')} títulos).`, 'success');
        }
        catch (err) {
            showAlert(`Erro ao carregar Contas a Pagar: ${err?.message || err}`, 'error');
        }
        finally {
            isContasPagarLoading = false;
            if (btnCard) {
                btnCard.disabled = false;
                btnCard.classList.remove('opacity-70');
                if (origBtnCardHtml)
                    btnCard.innerHTML = origBtnCardHtml;
            }
            if (btnModal) {
                btnModal.disabled = false;
                btnModal.classList.remove('opacity-70');
                if (origBtnModalHtml)
                    btnModal.innerHTML = origBtnModalHtml;
            }
        }
    };
    // ─── Contas Geral Solidcon (BI): Render Card ─────────────────────────────
    const renderContasGeralCard = (data) => {
        const card = getEl('cardContasGeralSolidcon');
        if (!card)
            return;
        if (!data || !data.loaded) {
            if (getEl('cardContasGeralTotalPago'))
                getEl('cardContasGeralTotalPago').textContent = 'R$ 0,00';
            if (getEl('cardContasGeralQtdPago'))
                getEl('cardContasGeralQtdPago').textContent = 'Defina o período e filtre';
            if (getEl('cardContasGeralTotalAberto'))
                getEl('cardContasGeralTotalAberto').textContent = 'R$ 0,00';
            if (getEl('cardContasGeralQtdAberto'))
                getEl('cardContasGeralQtdAberto').textContent = 'Defina o período e filtre';
            if (getEl('cardContasGeralSubAberto'))
                getEl('cardContasGeralSubAberto').textContent = 'Vencidos: R$ 0,00 • A Vencer: R$ 0,00';
            if (getEl('cardContasGeralTotalGeral'))
                getEl('cardContasGeralTotalGeral').textContent = 'R$ 0,00';
            if (getEl('cardContasGeralQtdTotal'))
                getEl('cardContasGeralQtdTotal').textContent = 'Defina o período e filtre';
            if (getEl('cardContasGeralTotalPermuta'))
                getEl('cardContasGeralTotalPermuta').textContent = 'R$ 0,00';
            if (getEl('cardContasGeralQtdPermuta'))
                getEl('cardContasGeralQtdPermuta').textContent = 'Defina o período e filtre';
            if (getEl('badgeContasGeralStatus')) {
                getEl('badgeContasGeralStatus').textContent = 'Aguardando Filtro';
                getEl('badgeContasGeralStatus').className = 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-slate-700/80 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600';
            }
            if (getEl('badgeCardContasGeralCount'))
                getEl('badgeCardContasGeralCount').textContent = '0';
            if (getEl('cardContasGeralPeriodoBadge'))
                getEl('cardContasGeralPeriodoBadge').textContent = 'Clique em Filtrar para carregar';
            if (getEl('modalContasGeralBadgePeriodo'))
                getEl('modalContasGeralBadgePeriodo').textContent = 'Não Consultado';
            if (getEl('cardContasGeralFiliaisCount'))
                getEl('cardContasGeralFiliaisCount').textContent = '0 filiais';
            if (getEl('cardContasGeralFiliaisCards')) {
                getEl('cardContasGeralFiliaisCards').innerHTML = '<span class="text-xs text-gray-400 col-span-full">Clique em Filtrar para carregar as filiais</span>';
            }
            return;
        }
        const summary = data.summary || {};
        const totalPago = Number(summary.totalPago || 0);
        const totalAberto = Number(summary.totalAberto || 0);
        const totalVencido = Number(summary.totalVencido || 0);
        const totalAVencer = Number(summary.totalAVencer || 0);
        const totalEmitido = Number(summary.totalEmitido || 0);
        const totalPermuta = Number(summary.totalPermuta || 0);
        const qtdTitulos = Number(summary.qtdTitulos || 0);
        const qtdPagos = Number(summary.qtdPagos || 0);
        const qtdAberto = Number(summary.qtdAberto || 0);
        const qtdVencidos = Number(summary.qtdVencidos || 0);
        const qtdAVencer = Number(summary.qtdAVencer || 0);
        const qtdPermuta = Number(summary.qtdPermuta || 0);
        if (getEl('cardContasGeralTotalPago')) {
            getEl('cardContasGeralTotalPago').textContent = formatMoney(totalPago);
        }
        if (getEl('cardContasGeralQtdPago')) {
            getEl('cardContasGeralQtdPago').textContent = `${qtdPagos.toLocaleString('pt-BR')} ${qtdPagos === 1 ? 'título pago' : 'títulos pagos'}`;
        }
        if (getEl('cardContasGeralTotalAberto')) {
            getEl('cardContasGeralTotalAberto').textContent = formatMoney(totalAberto);
        }
        if (getEl('cardContasGeralQtdAberto')) {
            getEl('cardContasGeralQtdAberto').textContent = `${qtdAberto.toLocaleString('pt-BR')} ${qtdAberto === 1 ? 'título em aberto' : 'títulos em aberto'}`;
        }
        if (getEl('cardContasGeralSubAberto')) {
            getEl('cardContasGeralSubAberto').textContent = `Vencidos: ${formatMoney(totalVencido)} (${qtdVencidos}) • A Vencer: ${formatMoney(totalAVencer)} (${qtdAVencer})`;
        }
        if (getEl('cardContasGeralTotalGeral')) {
            getEl('cardContasGeralTotalGeral').textContent = formatMoney(totalEmitido);
        }
        if (getEl('cardContasGeralQtdTotal')) {
            getEl('cardContasGeralQtdTotal').textContent = `${qtdTitulos.toLocaleString('pt-BR')} ${qtdTitulos === 1 ? 'título no total' : 'títulos no total'}`;
        }
        if (getEl('cardContasGeralTotalPermuta')) {
            getEl('cardContasGeralTotalPermuta').textContent = formatMoney(totalPermuta);
        }
        if (getEl('cardContasGeralQtdPermuta')) {
            getEl('cardContasGeralQtdPermuta').textContent = `${qtdPermuta.toLocaleString('pt-BR')} ${qtdPermuta === 1 ? 'título de permuta' : 'títulos de permuta'}`;
        }
        if (getEl('badgeContasGeralStatus')) {
            getEl('badgeContasGeralStatus').textContent = `${qtdTitulos.toLocaleString('pt-BR')} Títulos BI`;
            getEl('badgeContasGeralStatus').className = 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
        }
        if (getEl('badgeCardContasGeralCount')) {
            getEl('badgeCardContasGeralCount').textContent = String(qtdTitulos);
        }
        // Badges Período
        const filtros = data.filtrosAplicados || {};
        const dtIni = filtros.dtInicio || '';
        const dtFim = filtros.dtFim || '';
        const tipoDt = filtros.tipoData || 'vencimento';
        const tipoLabelMap = {
            vencimento: 'Vencimento',
            pagamento: 'Pagamento',
            emissao: 'Emissão',
            competencia: 'Competência'
        };
        const tipoLabel = tipoLabelMap[tipoDt] || 'Vencimento';
        let badgePeriodoText = 'Todos os Lançamentos';
        if (dtIni && dtFim) {
            badgePeriodoText = `${formatDateBR(dtIni)} a ${formatDateBR(dtFim)} (${tipoLabel})`;
        }
        else if (dtIni) {
            badgePeriodoText = `A partir de ${formatDateBR(dtIni)} (${tipoLabel})`;
        }
        else if (dtFim) {
            badgePeriodoText = `Até ${formatDateBR(dtFim)} (${tipoLabel})`;
        }
        if (getEl('cardContasGeralPeriodoBadge')) {
            getEl('cardContasGeralPeriodoBadge').textContent = badgePeriodoText;
        }
        if (getEl('modalContasGeralBadgePeriodo')) {
            getEl('modalContasGeralBadgePeriodo').textContent = badgePeriodoText;
        }
        // Filiais no Card Principal
        const mainFiliaisContainer = getEl('cardContasGeralFiliaisCards');
        const mainCountBadge = getEl('cardContasGeralFiliaisCount');
        if (mainFiliaisContainer) {
            const filiais = data.byFilial || [];
            if (mainCountBadge) {
                mainCountBadge.textContent = `${filiais.length} ${filiais.length === 1 ? 'filial' : 'filiais'}`;
            }
            if (filiais.length === 0) {
                mainFiliaisContainer.innerHTML = '<span class="text-xs text-gray-400 col-span-full">Nenhum título no período</span>';
            }
            else {
                mainFiliaisContainer.innerHTML = filiais.map((f) => {
                    const fId = String(f.filial);
                    const fEmit = Number(f.totalEmitido || 0);
                    const fPago = Number(f.totalPago || 0);
                    const fAberto = Number(f.totalAberto || 0);
                    const fQtd = Number(f.qtdTitulos || 0);
                    const fQtdPago = Number(f.qtdPagos || 0);
                    const fQtdAberto = Number(f.qtdAberto || 0);
                    return `
                        <button type="button" data-filial="${escapeHtml(fId)}" class="card-filial-geral-btn text-left p-3.5 rounded-xl border border-blue-200/80 dark:border-slate-700/80 bg-blue-50/40 dark:bg-slate-900/50 hover:bg-blue-100/60 dark:hover:bg-slate-800/80 hover:border-blue-400 transition-all cursor-pointer flex flex-col justify-between group shadow-2xs">
                            <div class="flex items-center justify-between gap-1 mb-1.5">
                                <span class="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-600 transition-colors" title="${escapeHtml(fId)}">
                                    ${escapeHtml(fId)}
                                </span>
                                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                                    ${fQtd} tit.
                                </span>
                            </div>
                            <div class="space-y-1 mt-1">
                                <div class="flex items-center justify-between text-xs">
                                    <span class="text-emerald-700 dark:text-emerald-400 font-semibold">Pago (${fQtdPago}):</span>
                                    <strong class="text-emerald-700 dark:text-emerald-400 font-mono">${formatMoney(fPago)}</strong>
                                </div>
                                <div class="flex items-center justify-between text-xs">
                                    <span class="text-amber-700 dark:text-amber-400 font-semibold">Aberto (${fQtdAberto}):</span>
                                    <strong class="text-amber-700 dark:text-amber-400 font-mono font-bold">${formatMoney(fAberto)}</strong>
                                </div>
                                <div class="pt-1 border-t border-blue-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                                    <span>Total Emitido:</span>
                                    <span class="font-mono font-bold text-gray-800 dark:text-gray-200">${formatMoney(fEmit)}</span>
                                </div>
                            </div>
                        </button>
                    `;
                }).join('');
                mainFiliaisContainer.querySelectorAll('.card-filial-geral-btn').forEach((btn) => {
                    btn.addEventListener('click', () => {
                        const targetFilial = btn.getAttribute('data-filial');
                        openModalContasGeral(targetFilial);
                    });
                });
            }
        }
    };
    // ─── Modal Contas Geral (BI): Filiais Cards & Populate ───────────────────
    const renderModalContasGeralFiliaisCards = (data) => {
        const targetData = data || currentContasGeralData;
        const container = getEl('modalContasGeralFiliaisCards');
        const countBadge = getEl('modalContasGeralFiliaisCount');
        if (!container)
            return;
        if (!targetData || !targetData.loaded) {
            container.innerHTML = `
                <div class="col-span-full py-3 text-center text-xs text-gray-500 dark:text-gray-400">
                    Aguardando consulta do servidor...
                </div>
            `;
            if (countBadge)
                countBadge.textContent = '0 filiais';
            return;
        }
        const filiais = targetData.byFilial || [];
        if (countBadge) {
            countBadge.textContent = `${filiais.length} ${filiais.length === 1 ? 'filial' : 'filiais'}`;
        }
        const currentSelectedFilial = getEl('modalContasGeralFilterFilial')?.value || '';
        const summary = targetData.summary || {};
        const totalPago = Number(summary.totalPago || 0);
        const totalAberto = Number(summary.totalAberto || 0);
        const qtdTitulos = Number(summary.qtdTitulos || 0);
        const isAllActive = currentSelectedFilial === '';
        let html = `
            <!-- Card Todas as Filiais -->
            <button type="button" data-filial="" class="filial-geral-card-btn text-left p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${isAllActive
            ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 ring-2 ring-blue-500/40 shadow-xs'
            : 'border-gray-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-700/60 hover:bg-blue-50/30'}">
                <div class="flex items-center justify-between gap-1 mb-1">
                    <span class="text-[11px] font-bold text-gray-900 dark:text-white truncate">Todas as Filiais</span>
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${isAllActive ? 'bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'}">
                        ${qtdTitulos} tit.
                    </span>
                </div>
                <div class="text-xs space-y-0.5 mt-0.5">
                    <div class="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span>Pago:</span>
                        <span class="font-mono">${formatMoney(totalPago)}</span>
                    </div>
                    <div class="flex items-center justify-between text-amber-600 dark:text-amber-400 font-bold">
                        <span>Aberto:</span>
                        <span class="font-mono">${formatMoney(totalAberto)}</span>
                    </div>
                </div>
            </button>
        `;
        filiais.forEach((f) => {
            const filialId = String(f.filial);
            const isActive = currentSelectedFilial === filialId;
            const fPago = Number(f.totalPago || 0);
            const fAberto = Number(f.totalAberto || 0);
            const fQtd = Number(f.qtdTitulos || 0);
            html += `
                <button type="button" data-filial="${escapeHtml(filialId)}" class="filial-geral-card-btn text-left p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${isActive
                ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 ring-2 ring-blue-500/40 shadow-xs'
                : 'border-gray-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-700/60 hover:bg-blue-50/30'}">
                    <div class="flex items-center justify-between gap-1 mb-1">
                        <span class="text-[11px] font-bold text-gray-900 dark:text-white truncate" title="${escapeHtml(filialId)}">
                            ${escapeHtml(filialId)}
                        </span>
                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${isActive ? 'bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'}">
                            ${fQtd} tit.
                        </span>
                    </div>
                    <div class="text-xs space-y-0.5 mt-0.5">
                        <div class="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                            <span>Pago:</span>
                            <span class="font-mono">${formatMoney(fPago)}</span>
                        </div>
                        <div class="flex items-center justify-between text-amber-600 dark:text-amber-400 font-bold">
                            <span>Aberto:</span>
                            <span class="font-mono">${formatMoney(fAberto)}</span>
                        </div>
                    </div>
                </button>
            `;
        });
        container.innerHTML = html;
        container.querySelectorAll('.filial-geral-card-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const targetFilial = btn.getAttribute('data-filial') || '';
                const select = getEl('modalContasGeralFilterFilial');
                if (select) {
                    select.value = targetFilial;
                }
                renderModalContasGeralFiliaisCards(currentContasGeralData);
                applyModalContasGeralFilters();
            });
        });
    };
    const populateModalContasGeralFilters = (data) => {
        const filialSelect = getEl('modalContasGeralFilterFilial');
        const filiais = data.byFilial || [];
        if (filialSelect) {
            const currentVal = filialSelect.value;
            filialSelect.innerHTML = '<option value="">Todas as Filiais</option>' +
                filiais.map((f) => `<option value="${escapeHtml(f.filial)}">${escapeHtml(f.filial)}</option>`).join('');
            if (currentVal && filiais.some((f) => String(f.filial) === currentVal)) {
                filialSelect.value = currentVal;
            }
        }
        renderModalContasGeralFiliaisCards(data);
    };
    const renderModalContasGeralTable = (list) => {
        const tbody = getEl('modalContasGeralTableBody');
        if (!tbody)
            return;
        if (!currentContasGeralData || !currentContasGeralData.loaded) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="14" class="py-12 text-center text-gray-500 dark:text-gray-400">
                        <div class="flex flex-col items-center justify-center gap-2">
                            <svg class="w-8 h-8 text-blue-400 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                            <span class="font-medium text-gray-700 dark:text-gray-200">Contas Geral (BI) não consultadas</span>
                            <span class="text-xs text-gray-500 dark:text-gray-400">Defina o período acima e clique em "Consultar Servidor" ou "Filtrar" para carregar os títulos.</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        if (!list || list.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="14" class="py-12 text-center text-gray-500 dark:text-gray-400">
                        <div class="flex flex-col items-center justify-center gap-2">
                            <svg class="w-8 h-8 text-gray-400 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <span class="font-medium text-gray-700 dark:text-gray-200">Nenhum título encontrado com os filtros selecionados</span>
                            <span class="text-xs text-gray-500 dark:text-gray-400">Tente ajustar a busca, a situação de pagamento, a filial ou o período.</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        const filiaisMap = {};
        list.forEach(item => {
            const fKey = String(item.Filial || 'Matriz / Geral').trim();
            if (!filiaisMap[fKey]) {
                filiaisMap[fKey] = {
                    filialName: fKey,
                    items: [],
                    totalParcela: 0,
                    totalPago: 0,
                    totalAberto: 0,
                    totalPermuta: 0,
                    qtdPagos: 0,
                    qtdAberto: 0,
                    qtdVencidos: 0,
                    qtdAVencer: 0
                };
            }
            const isPago = item.hasPagto || (item.Pagto !== null && item.Pagto !== undefined && String(item.Pagto).trim() !== '');
            const vlParcela = Number(item.vlParcela || 0);
            const vlPago = isPago ? Number(item.vlPago || vlParcela || 0) : 0;
            const saldoAberto = isPago ? 0 : (Number(item.saldoAberto ?? 0) > 0 ? Number(item.saldoAberto) : Math.max(0, vlParcela - Number(item.vlDesconto || 0)));
            const vlPermuta = Number(item.vlPermuta || 0);
            const g = filiaisMap[fKey];
            g.items.push(item);
            g.totalParcela += vlParcela;
            g.totalPago += vlPago;
            g.totalAberto += saldoAberto;
            g.totalPermuta += vlPermuta;
            if (isPago) {
                g.qtdPagos++;
            }
            else {
                g.qtdAberto++;
                if (item.situacao === 'vencido')
                    g.qtdVencidos++;
                else
                    g.qtdAVencer++;
            }
        });
        const groups = Object.values(filiaisMap).sort((a, b) => b.totalAberto - a.totalAberto);
        let html = '';
        groups.forEach(g => {
            html += `
                <tr class="bg-linear-to-r from-blue-50/80 via-blue-50/30 to-transparent dark:from-blue-950/40 dark:via-slate-900 dark:to-slate-900 border-t-2 border-b border-blue-200 dark:border-blue-900/60 sticky top-10 z-5 font-bold text-xs">
                    <td colspan="14" class="py-2.5 px-4">
                        <div class="flex flex-wrap items-center justify-between gap-3">
                            <div class="flex items-center gap-2">
                                <span class="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-xs"></span>
                                <span class="text-sm font-black text-gray-900 dark:text-white tracking-tight">${escapeHtml(g.filialName)}</span>
                                <span class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                                    ${g.items.length} ${g.items.length === 1 ? 'título' : 'títulos'}
                                </span>
                            </div>
                            <div class="flex flex-wrap items-center gap-4 text-xs">
                                <span class="text-gray-500 dark:text-gray-400">Total Emitido: <strong class="font-mono text-gray-800 dark:text-gray-200">${formatMoney(g.totalParcela)}</strong></span>
                                <span class="text-emerald-700 dark:text-emerald-400 font-semibold">Pago (${g.qtdPagos}): <strong class="font-mono">${formatMoney(g.totalPago)}</strong></span>
                                <span class="text-amber-700 dark:text-amber-400 font-black">Aberto (${g.qtdAberto}): <strong class="font-mono">${formatMoney(g.totalAberto)}</strong></span>
                                ${g.totalPermuta > 0 ? `<span class="text-purple-700 dark:text-purple-300 font-semibold">Permuta: <strong class="font-mono">${formatMoney(g.totalPermuta)}</strong></span>` : ''}
                            </div>
                        </div>
                    </td>
                </tr>
            `;
            g.items.forEach((item, idx) => {
                const isPago = item.hasPagto || (item.Pagto !== null && item.Pagto !== undefined && String(item.Pagto).trim() !== '');
                const isVencido = !isPago && item.situacao === 'vencido';
                const vlPermuta = Number(item.vlPermuta || 0);
                const vlParcela = Number(item.vlParcela || 0);
                const vlPago = isPago ? Number(item.vlPago || vlParcela || 0) : 0;
                const saldoAberto = isPago ? 0 : (Number(item.saldoAberto ?? 0) > 0 ? Number(item.saldoAberto) : Math.max(0, vlParcela - Number(item.vlDesconto || 0)));
                let statusBadgeHtml = '';
                if (isPago) {
                    statusBadgeHtml = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Pago</span>`;
                }
                else if (isVencido) {
                    statusBadgeHtml = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-200 dark:border-red-800"><span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>Vencido</span>`;
                }
                else {
                    statusBadgeHtml = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>A Vencer</span>`;
                }
                let pagtoBadgeHtml = '';
                if (item.Pagto) {
                    pagtoBadgeHtml = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">${formatDateBR(item.Pagto)}</span>`;
                }
                else {
                    pagtoBadgeHtml = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Em Aberto</span>`;
                }
                const rawIndex = rawContasGeralLancamentos.indexOf(item);
                html += `
                    <tr class="hover:bg-blue-50/40 dark:hover:bg-slate-800/60 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/50 dark:bg-slate-900/40' : ''}">
                        <td class="py-2.5 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                            ${formatDateBR(item.dtEmissao)}
                        </td>
                        <td class="py-2.5 px-3 font-medium ${isVencido ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-700 dark:text-gray-300'} whitespace-nowrap">
                            ${formatDateBR(item.dtParcela)}
                        </td>
                        <td class="py-2.5 px-3 whitespace-nowrap">
                            ${pagtoBadgeHtml}
                        </td>
                        <td class="py-2.5 px-3 text-center whitespace-nowrap">
                            ${statusBadgeHtml}
                        </td>
                        <td class="py-2.5 px-3 font-mono text-gray-800 dark:text-gray-200 whitespace-nowrap text-xs font-semibold" title="Conta #${item.cdConta}">
                            ${escapeHtml(item.Documento || `#${item.cdConta}`)}
                        </td>
                        <td class="py-2.5 px-2 text-center font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                            ${escapeHtml(item.NumeroParcela || '1')}
                        </td>
                        <td class="py-2.5 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs">
                            ${escapeHtml(item.Filial || '-')}
                        </td>
                        <td class="py-2.5 px-3 text-gray-900 dark:text-gray-100 font-medium max-w-xs truncate text-xs" title="${escapeHtml(item.Fornecedor)} - ${escapeHtml(item.Historico || '')}">
                            ${escapeHtml(item.Fornecedor || '-')}
                        </td>
                        <td class="py-2.5 px-3 font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                            ${escapeHtml(item.CNPJ_CPF || '-')}
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                            ${formatMoney(vlParcela)}
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono font-bold ${vlPermuta > 0 ? 'text-purple-700 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500'} whitespace-nowrap">
                            ${vlPermuta > 0 ? formatMoney(vlPermuta) : '-'}
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            ${formatMoney(vlPago)}
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono font-bold ${saldoAberto <= 0.01 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'} whitespace-nowrap">
                            ${formatMoney(saldoAberto)}
                        </td>
                        <td class="py-2.5 px-3 text-center whitespace-nowrap">
                            <button type="button" class="btn-view-contas-geral-detalhes p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 shadow-2xs hover:scale-110 transition-all cursor-pointer inline-flex items-center justify-center" data-index="${rawIndex >= 0 ? rawIndex : idx}" title="Visualizar Detalhes do Lançamento">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                </svg>
                            </button>
                        </td>
                    </tr>
                `;
            });
        });
        // Sticky Grand Total Consolidado Row
        if (groups.length > 0) {
            let gParcela = 0;
            let gPermuta = 0;
            let gPago = 0;
            let gSaldo = 0;
            let gTitulos = 0;
            let gPagos = 0;
            let gAberto = 0;
            groups.forEach(g => {
                gParcela += g.totalParcela;
                gPermuta += g.totalPermuta;
                gPago += g.totalPago;
                gSaldo += g.totalAberto;
                gTitulos += g.items.length;
                gPagos += g.qtdPagos;
                gAberto += g.qtdAberto;
            });
            html += `
                <tr class="bg-linear-to-r from-gray-100 via-blue-50 to-gray-100 dark:from-slate-900 dark:via-blue-950/40 dark:to-slate-900 font-bold border-t-2 border-b-2 border-blue-300 dark:border-blue-800 text-xs text-gray-900 dark:text-white sticky bottom-0 z-10 shadow-md">
                    <td colspan="9" class="py-3 px-4 text-right">
                        <div class="inline-flex items-center gap-1.5 uppercase tracking-wider text-gray-800 dark:text-gray-200 font-extrabold">
                            <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                            <span>Totais Consolidados (${gTitulos} títulos | ${gPagos} pagos • ${gAberto} em aberto):</span>
                        </div>
                    </td>
                    <td class="py-3 px-3 text-right font-mono font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap" title="Total Emitido das Parcelas">
                        <div class="text-[10px] uppercase font-semibold text-gray-400 dark:text-gray-400 font-sans">Emitido</div>
                        <div>${formatMoney(gParcela)}</div>
                    </td>
                    <td class="py-3 px-3 text-right font-mono font-bold text-purple-800 dark:text-purple-300 whitespace-nowrap" title="Total Permutado">
                        <div class="text-[10px] uppercase font-semibold text-purple-500/80 font-sans">Permuta</div>
                        <div>${gPermuta > 0 ? formatMoney(gPermuta) : '-'}</div>
                    </td>
                    <td class="py-3 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap" title="Total Pago">
                        <div class="text-[10px] uppercase font-semibold text-emerald-600/80 font-sans">Pago</div>
                        <div>${formatMoney(gPago)}</div>
                    </td>
                    <td class="py-3 px-3 text-right font-mono font-black text-amber-700 dark:text-amber-300 whitespace-nowrap bg-amber-100/60 dark:bg-amber-950/60 rounded-lg" title="Saldo em Aberto">
                        <div class="text-[10px] uppercase font-black text-amber-700 dark:text-amber-300 font-sans">Saldo Aberto</div>
                        <div class="text-sm font-black">${formatMoney(gSaldo)}</div>
                    </td>
                    <td class="py-3 px-3"></td>
                </tr>
            `;
        }
        tbody.innerHTML = html;
        tbody.querySelectorAll('.btn-view-contas-geral-detalhes').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idxStr = btn.getAttribute('data-index');
                if (idxStr !== null) {
                    const idx = parseInt(idxStr, 10);
                    const item = rawContasGeralLancamentos[idx] || list[idx];
                    if (item) {
                        openModalContasGeralDetalhes(item);
                    }
                }
            });
        });
    };
    const applyModalContasGeralFilters = () => {
        const query = (getEl('modalContasGeralSearch')?.value || '').toLowerCase().trim();
        const selectedStatus = getEl('modalContasGeralFilterStatus')?.value || 'all';
        const selectedFilial = getEl('modalContasGeralFilterFilial')?.value || '';
        const dtInicio = getEl('modalContasGeralDtInicio')?.value || '';
        const dtFim = getEl('modalContasGeralDtFim')?.value || '';
        const tipoData = getEl('modalContasGeralTipoData')?.value || 'vencimento';
        const filtered = rawContasGeralLancamentos.filter((item) => {
            const hasPagto = item.hasPagto || (item.Pagto !== null && item.Pagto !== undefined && String(item.Pagto).trim() !== '');
            const isVencido = !hasPagto && item.situacao === 'vencido';
            const isAVencer = !hasPagto && item.situacao === 'a_vencer';
            const vlPermuta = Number(item.vlPermuta || 0);
            if (selectedStatus === 'com_pagto' && !hasPagto)
                return false;
            if (selectedStatus === 'sem_pagto' && hasPagto)
                return false;
            if (selectedStatus === 'vencidos' && !isVencido)
                return false;
            if (selectedStatus === 'a_vencer' && !isAVencer)
                return false;
            if (selectedStatus === 'permutas' && vlPermuta <= 0)
                return false;
            if (selectedFilial && String(item.Filial || '') !== selectedFilial && String(item.FilialDebito || '') !== selectedFilial) {
                return false;
            }
            let targetDate = item.dtParcela;
            if (tipoData === 'pagamento')
                targetDate = item.Pagto;
            else if (tipoData === 'emissao')
                targetDate = item.dtEmissao;
            else if (tipoData === 'competencia')
                targetDate = item.dtCompetencia;
            if (dtInicio && targetDate && targetDate < dtInicio)
                return false;
            if (dtFim && targetDate && targetDate > dtFim)
                return false;
            if (query) {
                const combined = `${item.Fornecedor || ''} ${item.CNPJ_CPF || ''} ${item.Documento || ''} ${item.Historico || ''} ${item.Filial || ''} ${item.FilialDebito || ''} ${item.SmartContabil || ''} ${item.OrigemModuloERP || ''} ${item.CentroCusto || ''} ${item.ContaCorrente || ''} ${item.Comprador || ''}`.toLowerCase();
                if (!combined.includes(query))
                    return false;
            }
            return true;
        });
        // Update Ribbon Summary
        let sumGeral = 0;
        let sumPago = 0;
        let sumAberto = 0;
        let sumVencido = 0;
        let sumAVencer = 0;
        let sumPermuta = 0;
        let countPagos = 0;
        let countAberto = 0;
        filtered.forEach((r) => {
            const hasPagto = r.hasPagto || (r.Pagto !== null && r.Pagto !== undefined && String(r.Pagto).trim() !== '');
            const parcela = Number(r.vlParcela || 0);
            const pago = hasPagto ? Number(r.vlPago || parcela || 0) : 0;
            const saldo = hasPagto ? 0 : (Number(r.saldoAberto ?? 0) > 0 ? Number(r.saldoAberto) : Math.max(0, parcela - Number(r.vlDesconto || 0)));
            const perm = Number(r.vlPermuta || 0);
            sumGeral += parcela;
            sumPago += pago;
            sumAberto += saldo;
            sumPermuta += perm;
            if (hasPagto) {
                countPagos++;
            }
            else {
                countAberto++;
                if (r.situacao === 'vencido')
                    sumVencido += saldo;
                else
                    sumAVencer += saldo;
            }
        });
        if (getEl('modalContasGeralSummaryGeral')) {
            getEl('modalContasGeralSummaryGeral').textContent = formatMoney(sumGeral);
        }
        if (getEl('modalContasGeralSummaryPago')) {
            getEl('modalContasGeralSummaryPago').textContent = formatMoney(sumPago);
        }
        if (getEl('modalContasGeralSummaryAberto')) {
            getEl('modalContasGeralSummaryAberto').textContent = formatMoney(sumAberto);
        }
        if (getEl('modalContasGeralSummaryVencido')) {
            getEl('modalContasGeralSummaryVencido').textContent = formatMoney(sumVencido);
        }
        if (getEl('modalContasGeralSummaryAVencer')) {
            getEl('modalContasGeralSummaryAVencer').textContent = formatMoney(sumAVencer);
        }
        if (getEl('modalContasGeralSummaryPermuta')) {
            getEl('modalContasGeralSummaryPermuta').textContent = formatMoney(sumPermuta);
        }
        if (getEl('modalContasGeralItemCount')) {
            getEl('modalContasGeralItemCount').textContent = `Exibindo ${filtered.length} de ${rawContasGeralLancamentos.length} títulos (${countPagos} pagos • ${countAberto} em aberto)`;
        }
        renderModalContasGeralTable(filtered);
    };
    const openModalContasGeral = (initialFilial) => {
        const modal = getEl('modalContasGeralSolidcon');
        if (!modal)
            return;
        if (getEl('modalContasGeralSearch')) {
            getEl('modalContasGeralSearch').value = '';
        }
        if (getEl('modalContasGeralFilterStatus')) {
            getEl('modalContasGeralFilterStatus').value = 'all';
        }
        if (getEl('modalContasGeralFilterFilial')) {
            getEl('modalContasGeralFilterFilial').value = initialFilial || '';
        }
        // Sync card dates into modal
        const cardDtIni = getEl('cardContasGeralDtInicio')?.value || '';
        const cardDtFim = getEl('cardContasGeralDtFim')?.value || '';
        const cardTipo = getEl('cardContasGeralTipoData')?.value || 'vencimento';
        if (getEl('modalContasGeralDtInicio'))
            getEl('modalContasGeralDtInicio').value = cardDtIni;
        if (getEl('modalContasGeralDtFim'))
            getEl('modalContasGeralDtFim').value = cardDtFim;
        if (getEl('modalContasGeralTipoData'))
            getEl('modalContasGeralTipoData').value = cardTipo;
        renderModalContasGeralFiliaisCards(currentContasGeralData);
        applyModalContasGeralFilters();
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    };
    const closeModalContasGeral = () => {
        const modal = getEl('modalContasGeralSolidcon');
        if (modal) {
            modal.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
        }
    };
    const openModalContasGeralDetalhes = (item) => {
        const modal = getEl('modalContasGeralDetalhes');
        if (!modal || !item)
            return;
        const isPago = item.hasPagto || (item.Pagto !== null && item.Pagto !== undefined && String(item.Pagto).trim() !== '');
        const isVencido = !isPago && item.situacao === 'vencido';
        const vlParcela = Number(item.vlParcela || 0);
        const vlDesconto = Number(item.vlDesconto || 0);
        const vlPago = isPago ? Number(item.vlPago || vlParcela || 0) : 0;
        const saldoAberto = isPago ? 0 : (Number(item.saldoAberto ?? 0) > 0 ? Number(item.saldoAberto) : Math.max(0, vlParcela - vlDesconto));
        if (getEl('modalGeralDetDocNum')) {
            getEl('modalGeralDetDocNum').textContent = item.Documento || `#${item.cdConta || '-'}`;
        }
        if (getEl('modalGeralDetStatusBadge')) {
            if (isPago) {
                getEl('modalGeralDetStatusBadge').textContent = 'Pago / Baixado';
                getEl('modalGeralDetStatusBadge').className = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
            }
            else if (isVencido) {
                getEl('modalGeralDetStatusBadge').textContent = 'Vencido em Aberto';
                getEl('modalGeralDetStatusBadge').className = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
            }
            else {
                getEl('modalGeralDetStatusBadge').textContent = 'A Vencer em Aberto';
                getEl('modalGeralDetStatusBadge').className = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
            }
        }
        if (getEl('modalGeralDetFilialBadge')) {
            getEl('modalGeralDetFilialBadge').textContent = item.Filial || 'Matriz';
        }
        if (getEl('modalGeralDetSituacaoBadge')) {
            getEl('modalGeralDetSituacaoBadge').textContent = isPago ? 'Quitado' : (isVencido ? 'Vencido' : 'A Vencer');
            getEl('modalGeralDetSituacaoBadge').className = `inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${isPago ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200' : (isVencido ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200' : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200')}`;
        }
        if (getEl('modalGeralDetPermutaBadge')) {
            const vlPerm = Number(item.vlPermuta || 0);
            if (vlPerm > 0) {
                getEl('modalGeralDetPermutaBadge').classList.remove('hidden');
            }
            else {
                getEl('modalGeralDetPermutaBadge').classList.add('hidden');
            }
        }
        if (getEl('modalGeralDetSaldoPendente')) {
            getEl('modalGeralDetSaldoPendente').textContent = formatMoney(saldoAberto);
        }
        if (getEl('modalGeralDetVlParcela')) {
            getEl('modalGeralDetVlParcela').textContent = formatMoney(vlParcela);
        }
        if (getEl('modalGeralDetVlPermuta')) {
            getEl('modalGeralDetVlPermuta').textContent = formatMoney(item.vlPermuta);
        }
        if (getEl('modalGeralDetVlPago')) {
            getEl('modalGeralDetVlPago').textContent = formatMoney(vlPago);
        }
        if (getEl('modalGeralDetSaldoAberto')) {
            getEl('modalGeralDetSaldoAberto').textContent = formatMoney(saldoAberto);
        }
        if (getEl('modalGeralDetVlDesconto')) {
            getEl('modalGeralDetVlDesconto').textContent = formatMoney(vlDesconto);
        }
        if (getEl('modalGeralDetVlMulta')) {
            getEl('modalGeralDetVlMulta').textContent = formatMoney(item.vlMulta);
        }
        if (getEl('modalGeralDetVlMora')) {
            getEl('modalGeralDetVlMora').textContent = formatMoney(item.vlMora);
        }
        if (getEl('modalGeralDetFornecedor')) {
            getEl('modalGeralDetFornecedor').textContent = item.Fornecedor || '-';
        }
        if (getEl('modalGeralDetCNPJ')) {
            getEl('modalGeralDetCNPJ').textContent = item.CNPJ_CPF || '-';
        }
        if (getEl('modalGeralDetTipoFaturamento')) {
            getEl('modalGeralDetTipoFaturamento').textContent = item.TipoFaturamento || '-';
        }
        if (getEl('modalGeralDetComprador')) {
            getEl('modalGeralDetComprador').textContent = item.Comprador || '-';
        }
        if (getEl('modalGeralDetFilial')) {
            getEl('modalGeralDetFilial').textContent = item.Filial || '-';
        }
        if (getEl('modalGeralDetFilialDebito')) {
            getEl('modalGeralDetFilialDebito').textContent = item.FilialDebito || '-';
        }
        if (getEl('modalGeralDetDocumento')) {
            getEl('modalGeralDetDocumento').textContent = item.Documento || '-';
        }
        if (getEl('modalGeralDetParcela')) {
            getEl('modalGeralDetParcela').textContent = item.NumeroParcela || '1';
        }
        if (getEl('modalGeralDetDtEmissao')) {
            getEl('modalGeralDetDtEmissao').textContent = formatDateBR(item.dtEmissao);
        }
        if (getEl('modalGeralDetDtParcela')) {
            getEl('modalGeralDetDtParcela').textContent = formatDateBR(item.dtParcela);
        }
        if (getEl('modalGeralDetPagto')) {
            getEl('modalGeralDetPagto').textContent = item.Pagto ? formatDateBR(item.Pagto) : 'Em Aberto (Sem Pagto)';
        }
        if (getEl('modalGeralDetDtCompetencia')) {
            getEl('modalGeralDetDtCompetencia').textContent = formatDateBR(item.dtCompetencia);
        }
        if (getEl('modalGeralDetDtMovimento')) {
            getEl('modalGeralDetDtMovimento').textContent = formatDateBR(item.dtMovimento);
        }
        if (getEl('modalGeralDetHistorico')) {
            getEl('modalGeralDetHistorico').textContent = item.Historico || 'Nenhum histórico registrado no lançamento.';
        }
        const histBaixaContainer = getEl('modalGeralDetHistBaixaContainer');
        const histBaixaEl = getEl('modalGeralDetHistBaixa');
        if (histBaixaContainer && histBaixaEl) {
            if (item.HistBaixa && String(item.HistBaixa).trim()) {
                histBaixaContainer.classList.remove('hidden');
                histBaixaEl.textContent = item.HistBaixa;
            }
            else {
                histBaixaContainer.classList.add('hidden');
                histBaixaEl.textContent = '-';
            }
        }
        if (getEl('modalGeralDetCdConta')) {
            getEl('modalGeralDetCdConta').textContent = item.cdConta || '-';
        }
        if (getEl('modalGeralDetCdContaBaixa')) {
            getEl('modalGeralDetCdContaBaixa').textContent = item.cdContaBaixa || '-';
        }
        if (getEl('modalGeralDetContaCorrente')) {
            getEl('modalGeralDetContaCorrente').textContent = item.ContaCorrente || '-';
        }
        if (getEl('modalGeralDetSmartContabil')) {
            getEl('modalGeralDetSmartContabil').textContent = item.SmartContabil || '-';
        }
        if (getEl('modalGeralDetOrigemModulo')) {
            getEl('modalGeralDetOrigemModulo').textContent = item.OrigemModuloERP || '-';
        }
        if (getEl('modalGeralDetCentroCusto')) {
            getEl('modalGeralDetCentroCusto').textContent = item.CentroCusto || '-';
        }
        if (getEl('modalGeralDetCdReceDesp')) {
            getEl('modalGeralDetCdReceDesp').textContent = item.cdReceDesp || '-';
        }
        if (getEl('modalGeralDetCdReceDespTipo')) {
            getEl('modalGeralDetCdReceDespTipo').textContent = item.cdReceDespTipo || '-';
        }
        modal.classList.remove('hidden');
    };
    const closeModalContasGeralDetalhes = () => {
        const modal = getEl('modalContasGeralDetalhes');
        if (modal) {
            modal.classList.add('hidden');
        }
    };
    const exportContasGeralCsv = () => {
        if (!rawContasGeralLancamentos || rawContasGeralLancamentos.length === 0) {
            showAlert('Não há dados de Contas Geral Solidcon para exportar.', 'error');
            return;
        }
        const query = (getEl('modalContasGeralSearch')?.value || '').toLowerCase().trim();
        const selectedStatus = getEl('modalContasGeralFilterStatus')?.value || 'all';
        const selectedFilial = getEl('modalContasGeralFilterFilial')?.value || '';
        const dtInicio = getEl('modalContasGeralDtInicio')?.value || '';
        const dtFim = getEl('modalContasGeralDtFim')?.value || '';
        const tipoData = getEl('modalContasGeralTipoData')?.value || 'vencimento';
        const filtered = rawContasGeralLancamentos.filter((item) => {
            const hasPagto = item.hasPagto || (item.Pagto !== null && item.Pagto !== undefined && String(item.Pagto).trim() !== '');
            const isVencido = !hasPagto && item.situacao === 'vencido';
            const isAVencer = !hasPagto && item.situacao === 'a_vencer';
            const vlPermuta = Number(item.vlPermuta || 0);
            if (selectedStatus === 'com_pagto' && !hasPagto)
                return false;
            if (selectedStatus === 'sem_pagto' && hasPagto)
                return false;
            if (selectedStatus === 'vencidos' && !isVencido)
                return false;
            if (selectedStatus === 'a_vencer' && !isAVencer)
                return false;
            if (selectedStatus === 'permutas' && vlPermuta <= 0)
                return false;
            if (selectedFilial && String(item.Filial || '') !== selectedFilial && String(item.FilialDebito || '') !== selectedFilial) {
                return false;
            }
            let targetDate = item.dtParcela;
            if (tipoData === 'pagamento')
                targetDate = item.Pagto;
            else if (tipoData === 'emissao')
                targetDate = item.dtEmissao;
            else if (tipoData === 'competencia')
                targetDate = item.dtCompetencia;
            if (dtInicio && targetDate && targetDate < dtInicio)
                return false;
            if (dtFim && targetDate && targetDate > dtFim)
                return false;
            if (query) {
                const combined = `${item.Fornecedor || ''} ${item.CNPJ_CPF || ''} ${item.Documento || ''} ${item.Historico || ''} ${item.Filial || ''} ${item.FilialDebito || ''} ${item.SmartContabil || ''} ${item.OrigemModuloERP || ''} ${item.CentroCusto || ''} ${item.ContaCorrente || ''} ${item.Comprador || ''}`.toLowerCase();
                if (!combined.includes(query))
                    return false;
            }
            return true;
        });
        const headers = [
            'Filial',
            'Fornecedor',
            'CNPJ_CPF',
            'Documento',
            'NumeroParcela',
            'dtEmissao',
            'dtParcela_Vencimento',
            'Data_Pagamento',
            'Situacao',
            'Valor_Parcela',
            'Total_Permutado',
            'Valor_Pago',
            'Saldo_Aberto',
            'Desconto',
            'Multa',
            'Mora_Juros',
            'TipoFaturamento',
            'Comprador',
            'ContaCorrente',
            'SmartContabil',
            'OrigemModuloERP',
            'CentroCusto',
            'cdConta',
            'cdContaBaixa',
            'dtCompetencia',
            'dtMovimento',
            'cdReceDesp',
            'cdReceDespTipo',
            'Historico',
            'HistBaixa'
        ];
        const rows = filtered.map((item) => {
            const hasPagto = item.hasPagto || (item.Pagto !== null && item.Pagto !== undefined && String(item.Pagto).trim() !== '');
            const situacaoText = hasPagto ? 'Pago' : (item.situacao === 'vencido' ? 'Vencido' : 'A Vencer');
            const vlParcela = Number(item.vlParcela || 0);
            const vlDesconto = Number(item.vlDesconto || 0);
            const vlPago = hasPagto ? Number(item.vlPago || vlParcela || 0) : 0;
            const saldoAberto = hasPagto ? 0 : (Number(item.saldoAberto ?? 0) > 0 ? Number(item.saldoAberto) : Math.max(0, vlParcela - vlDesconto));
            return [
                `"${(item.Filial || '').replace(/"/g, '""')}"`,
                `"${(item.Fornecedor || '').replace(/"/g, '""')}"`,
                `"${(item.CNPJ_CPF || '').replace(/"/g, '""')}"`,
                `"${(item.Documento || '').replace(/"/g, '""')}"`,
                `"${(item.NumeroParcela || '1').replace(/"/g, '""')}"`,
                formatDateBR(item.dtEmissao),
                formatDateBR(item.dtParcela),
                item.Pagto ? formatDateBR(item.Pagto) : 'Em Aberto',
                situacaoText,
                vlParcela.toFixed(2).replace('.', ','),
                Number(item.vlPermuta || 0).toFixed(2).replace('.', ','),
                vlPago.toFixed(2).replace('.', ','),
                saldoAberto.toFixed(2).replace('.', ','),
                vlDesconto.toFixed(2).replace('.', ','),
                Number(item.vlMulta || 0).toFixed(2).replace('.', ','),
                Number(item.vlMora || 0).toFixed(2).replace('.', ','),
                `"${(item.TipoFaturamento || '').replace(/"/g, '""')}"`,
                `"${(item.Comprador || '').replace(/"/g, '""')}"`,
                `"${(item.ContaCorrente || '').replace(/"/g, '""')}"`,
                `"${(item.SmartContabil || '').replace(/"/g, '""')}"`,
                `"${(item.OrigemModuloERP || '').replace(/"/g, '""')}"`,
                `"${(item.CentroCusto || '').replace(/"/g, '""')}"`,
                item.cdConta || '',
                item.cdContaBaixa || '',
                formatDateBR(item.dtCompetencia),
                formatDateBR(item.dtMovimento),
                item.cdReceDesp || '',
                item.cdReceDespTipo || '',
                `"${(item.Historico || '').replace(/"/g, '""')}"`,
                `"${(item.HistBaixa || '').replace(/"/g, '""')}"`
            ];
        });
        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contas_geral_solidcon_bi_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    // ─── Load Contas Geral Solidcon (BI / Sob Demanda) ───────────────────────
    const loadContasGeralSolidconBI = async (options) => {
        if (isContasGeralLoading)
            return;
        isContasGeralLoading = true;
        const btnCard = getEl('btnFilterContasGeralCard');
        const btnModal = getEl('btnFilterContasGeralModal');
        const origBtnCardHtml = btnCard?.innerHTML;
        const origBtnModalHtml = btnModal?.innerHTML;
        if (btnCard) {
            btnCard.disabled = true;
            btnCard.classList.add('opacity-70');
            btnCard.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Filtrando...</span>`;
        }
        if (btnModal) {
            btnModal.disabled = true;
            btnModal.classList.add('opacity-70');
            btnModal.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Consultando...</span>`;
        }
        try {
            if (options?.resetDates) {
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
                const defaultIni = `${y}-${m}-01`;
                const defaultFim = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
                if (getEl('cardContasGeralDtInicio'))
                    getEl('cardContasGeralDtInicio').value = defaultIni;
                if (getEl('cardContasGeralDtFim'))
                    getEl('cardContasGeralDtFim').value = defaultFim;
                if (getEl('cardContasGeralTipoData'))
                    getEl('cardContasGeralTipoData').value = 'vencimento';
                if (getEl('modalContasGeralDtInicio'))
                    getEl('modalContasGeralDtInicio').value = defaultIni;
                if (getEl('modalContasGeralDtFim'))
                    getEl('modalContasGeralDtFim').value = defaultFim;
                if (getEl('modalContasGeralTipoData'))
                    getEl('modalContasGeralTipoData').value = 'vencimento';
            }
            const companyParam = getEl('filterCompany')?.value || '';
            const connId = getEl('filterConnection')?.value || '';
            const cardDtInicio = getEl('cardContasGeralDtInicio')?.value || '';
            const cardDtFim = getEl('cardContasGeralDtFim')?.value || '';
            const cardTipoData = getEl('cardContasGeralTipoData')?.value || 'vencimento';
            if (getEl('modalContasGeralDtInicio'))
                getEl('modalContasGeralDtInicio').value = cardDtInicio;
            if (getEl('modalContasGeralDtFim'))
                getEl('modalContasGeralDtFim').value = cardDtFim;
            if (getEl('modalContasGeralTipoData'))
                getEl('modalContasGeralTipoData').value = cardTipoData;
            const queryParams = new URLSearchParams({
                ...(companyParam ? { targetCompanyId: companyParam } : {}),
                ...(connId ? { connectionId: connId } : {}),
                ...(cardDtInicio ? { dtInicio: cardDtInicio } : {}),
                ...(cardDtFim ? { dtFim: cardDtFim } : {}),
                ...(cardTipoData ? { tipoData: cardTipoData } : {})
            });
            const res = await api(`/finance/reports/contas-geral-solidcon-bi?${queryParams.toString()}`);
            const data = res?.data;
            if (!data)
                throw new Error('Falha ao obter dados de Contas Geral Solidcon (BI).');
            currentContasGeralData = {
                ...data,
                loaded: true
            };
            rawContasGeralLancamentos = currentContasGeralData.lancamentos || [];
            renderContasGeralCard(currentContasGeralData);
            populateModalContasGeralFilters(currentContasGeralData);
            if (options?.targetFilial !== undefined) {
                const filialSelect = getEl('modalContasGeralFilterFilial');
                if (filialSelect)
                    filialSelect.value = options.targetFilial;
                renderModalContasGeralFiliaisCards(currentContasGeralData);
            }
            if (!getEl('modalContasGeralSolidcon')?.classList.contains('hidden')) {
                applyModalContasGeralFilters();
            }
            const totalTitulos = currentContasGeralData.summary?.qtdTitulos || 0;
            showAlert(`Contas Geral Solidcon (BI) carregadas com sucesso (${totalTitulos.toLocaleString('pt-BR')} títulos).`, 'success');
        }
        catch (err) {
            showAlert(`Erro ao carregar Contas Geral Solidcon (BI): ${err?.message || err}`, 'error');
        }
        finally {
            isContasGeralLoading = false;
            if (btnCard) {
                btnCard.disabled = false;
                btnCard.classList.remove('opacity-70');
                if (origBtnCardHtml)
                    btnCard.innerHTML = origBtnCardHtml;
            }
            if (btnModal) {
                btnModal.disabled = false;
                btnModal.classList.remove('opacity-70');
                if (origBtnModalHtml)
                    btnModal.innerHTML = origBtnModalHtml;
            }
        }
    };
    // ─── Load Cartões Não Baixados (Sob Demanda) ──────────────────────────────
    let isCartoesLoading = false;
    const loadCartoesNaoBaixados = async (options) => {
        if (isCartoesLoading)
            return;
        isCartoesLoading = true;
        const btnCard = getEl('btnFilterCartoesCard');
        const btnModal = getEl('btnFilterCartoesModal');
        const origBtnCardHtml = btnCard?.innerHTML;
        const origBtnModalHtml = btnModal?.innerHTML;
        if (btnCard) {
            btnCard.disabled = true;
            btnCard.classList.add('opacity-70');
            btnCard.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Filtrando...</span>`;
        }
        if (btnModal) {
            btnModal.disabled = true;
            btnModal.classList.add('opacity-70');
            btnModal.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Consultando...</span>`;
        }
        try {
            if (options?.resetDates) {
                if (getEl('cardCartoesDtInicio'))
                    getEl('cardCartoesDtInicio').value = '';
                if (getEl('cardCartoesDtFim'))
                    getEl('cardCartoesDtFim').value = '';
                if (getEl('cardCartoesTipoData'))
                    getEl('cardCartoesTipoData').value = 'previsao';
                if (getEl('modalCartoesDtInicio'))
                    getEl('modalCartoesDtInicio').value = '';
                if (getEl('modalCartoesDtFim'))
                    getEl('modalCartoesDtFim').value = '';
                if (getEl('modalCartoesTipoData'))
                    getEl('modalCartoesTipoData').value = 'previsao';
            }
            const companyParam = getEl('filterCompany')?.value || '';
            const ano = getEl('filterAno')?.value || String(new Date().getFullYear());
            const mes = getEl('filterMes')?.value || String(new Date().getMonth() + 1);
            const source = getEl('filterSource')?.value || 'conta_baixa';
            const connId = getEl('filterConnection')?.value || '';
            const cardDtInicio = getEl('cardCartoesDtInicio')?.value || '';
            const cardDtFim = getEl('cardCartoesDtFim')?.value || '';
            const cardTipoData = getEl('cardCartoesTipoData')?.value || 'previsao';
            // Also synchronize into modal
            if (getEl('modalCartoesDtInicio'))
                getEl('modalCartoesDtInicio').value = cardDtInicio;
            if (getEl('modalCartoesDtFim'))
                getEl('modalCartoesDtFim').value = cardDtFim;
            if (getEl('modalCartoesTipoData'))
                getEl('modalCartoesTipoData').value = cardTipoData;
            const queryParams = new URLSearchParams({
                includeCartoes: '1',
                ano,
                mes,
                source,
                ...(companyParam ? { company_id: companyParam } : {}),
                ...(connId ? { connectionId: connId, connection_id: connId } : {}),
                ...(cardDtInicio ? { dtInicioCartoes: cardDtInicio } : {}),
                ...(cardDtFim ? { dtFimCartoes: cardDtFim } : {}),
                ...(cardTipoData ? { tipoDataCartoes: cardTipoData } : {})
            });
            const res = await api(`/finance/solidcon-vision?${queryParams.toString()}`);
            const data = res?.data;
            if (!data)
                throw new Error('Falha ao obter dados de cartões do servidor.');
            currentCartoesData = data.cartoesNaoBaixados || {
                loaded: true,
                summary: { totalBruto: 0, totalLiquido: 0, totalTaxa: 0, totalOperacoes: 0, totalLancamentos: 0, ticketMedio: 0, totalAVencer: 0, totalVencido: 0, qtdAVencer: 0, qtdVencidos: 0 },
                byBandeira: [],
                byModalidade: [],
                byFilial: [],
                lancamentos: []
            };
            currentCartoesData.loaded = true;
            rawLancamentos = currentCartoesData.lancamentos || [];
            renderCartoesCard(currentCartoesData);
            populateModalFilters(currentCartoesData);
            if (!getEl('modalCartoesNaoBaixados')?.classList.contains('hidden')) {
                applyModalFilters();
            }
            const totalLotes = currentCartoesData.summary?.totalLancamentos || 0;
            showAlert(`Cartões não baixados carregados com sucesso (${totalLotes.toLocaleString('pt-BR')} lotes).`, 'success');
        }
        catch (err) {
            showAlert(`Erro ao carregar Cartões Não Baixados: ${err?.message || err}`, 'error');
        }
        finally {
            isCartoesLoading = false;
            if (btnCard) {
                btnCard.disabled = false;
                btnCard.classList.remove('opacity-70');
                if (origBtnCardHtml)
                    btnCard.innerHTML = origBtnCardHtml;
            }
            if (btnModal) {
                btnModal.disabled = false;
                btnModal.classList.remove('opacity-70');
                if (origBtnModalHtml)
                    btnModal.innerHTML = origBtnModalHtml;
            }
        }
    };
    // ─── Load Crediário e Convênio a Receber (Sob Demanda) ─────────────────────
    let isCrediarioLoading = false;
    const loadCrediarioReceber = async (options) => {
        if (isCrediarioLoading)
            return;
        isCrediarioLoading = true;
        const btnCard = getEl('btnFilterCrediarioCard');
        const btnModal = getEl('btnFilterCrediarioModal');
        const origBtnCardHtml = btnCard?.innerHTML;
        const origBtnModalHtml = btnModal?.innerHTML;
        if (btnCard) {
            btnCard.disabled = true;
            btnCard.classList.add('opacity-70');
            btnCard.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Filtrando...</span>`;
        }
        if (btnModal) {
            btnModal.disabled = true;
            btnModal.classList.add('opacity-70');
            btnModal.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Consultando...</span>`;
        }
        try {
            if (options?.resetDates) {
                if (getEl('cardCrediarioDtInicio'))
                    getEl('cardCrediarioDtInicio').value = '';
                if (getEl('cardCrediarioDtFim'))
                    getEl('cardCrediarioDtFim').value = '';
                if (getEl('cardCrediarioTipoData'))
                    getEl('cardCrediarioTipoData').value = 'vencimento';
                if (getEl('modalCrediarioDtInicio'))
                    getEl('modalCrediarioDtInicio').value = '';
                if (getEl('modalCrediarioDtFim'))
                    getEl('modalCrediarioDtFim').value = '';
                if (getEl('modalCrediarioTipoData'))
                    getEl('modalCrediarioTipoData').value = 'vencimento';
            }
            const companyParam = getEl('filterCompany')?.value || '';
            const connId = getEl('filterConnection')?.value || '';
            const cardDtInicio = getEl('cardCrediarioDtInicio')?.value || '';
            const cardDtFim = getEl('cardCrediarioDtFim')?.value || '';
            const cardTipoData = getEl('cardCrediarioTipoData')?.value || 'vencimento';
            // Also synchronize into modal
            if (getEl('modalCrediarioDtInicio'))
                getEl('modalCrediarioDtInicio').value = cardDtInicio;
            if (getEl('modalCrediarioDtFim'))
                getEl('modalCrediarioDtFim').value = cardDtFim;
            if (getEl('modalCrediarioTipoData'))
                getEl('modalCrediarioTipoData').value = cardTipoData;
            const queryParams = new URLSearchParams({
                includeCrediario: '1',
                ...(companyParam ? { company_id: companyParam } : {}),
                ...(connId ? { connectionId: connId, connection_id: connId } : {}),
                ...(cardDtInicio ? { dtInicioCrediario: cardDtInicio } : {}),
                ...(cardDtFim ? { dtFimCrediario: cardDtFim } : {}),
                ...(cardTipoData ? { tipoDataCrediario: cardTipoData } : {})
            });
            const res = await api(`/finance/solidcon-vision?${queryParams.toString()}`);
            const data = res?.data;
            if (!data)
                throw new Error('Falha ao obter dados de crediário do servidor.');
            currentCrediarioReceberData = data.crediarioReceber || {
                loaded: true,
                summary: { totalAReceber: 0, totalEmitido: 0, totalQuitado: 0, totalVencido: 0, totalAVencer: 0, qtdCupons: 0, qtdVencidos: 0, qtdAVencer: 0, qtdClientes: 0, ticketMedio: 0 },
                topClientes: [],
                byFilial: [],
                lancamentos: []
            };
            currentCrediarioReceberData.loaded = true;
            rawCrediarioCupons = currentCrediarioReceberData.lancamentos || [];
            renderCrediarioReceberCard(currentCrediarioReceberData);
            populateModalCrediarioFilters(currentCrediarioReceberData);
            if (!getEl('modalCrediarioReceber')?.classList.contains('hidden')) {
                applyModalCrediarioFilters();
            }
            const totalCupons = currentCrediarioReceberData.summary?.qtdCupons || 0;
            showAlert(`Crediário e convênio carregados com sucesso (${totalCupons.toLocaleString('pt-BR')} cupons).`, 'success');
        }
        catch (err) {
            showAlert(`Erro ao carregar Crediário/Convênio: ${err?.message || err}`, 'error');
        }
        finally {
            isCrediarioLoading = false;
            if (btnCard) {
                btnCard.disabled = false;
                btnCard.classList.remove('opacity-70');
                if (origBtnCardHtml)
                    btnCard.innerHTML = origBtnCardHtml;
            }
            if (btnModal) {
                btnModal.disabled = false;
                btnModal.classList.remove('opacity-70');
                if (origBtnModalHtml)
                    btnModal.innerHTML = origBtnModalHtml;
            }
        }
    };
    // ─── Load Data Action ─────────────────────────────────────────────────────
    const loadReport = async () => {
        if (isLoading)
            return;
        isLoading = true;
        hideAlert();
        const filterBtn = getEl('btnFilterApply');
        const filterIcon = getEl('btnFilterIcon');
        if (filterBtn)
            filterBtn.disabled = true;
        if (filterIcon)
            filterIcon.classList.add('animate-spin');
        updateStatusBadge('loading', 'Consultando...');
        try {
            const companyParam = getEl('filterCompany')?.value || '';
            const ano = getEl('filterAno')?.value || String(new Date().getFullYear());
            const mes = getEl('filterMes')?.value || String(new Date().getMonth() + 1);
            const source = getEl('filterSource')?.value || 'conta_baixa';
            const connId = getEl('filterConnection')?.value || '';
            currentPeriodLabel = `${String(mes).padStart(2, '0')}/${ano}`;
            // Persist selections
            if (companyParam)
                localStorage.setItem('rel_valor_empresa_company', companyParam);
            if (ano)
                localStorage.setItem('rel_valor_empresa_ano', ano);
            if (mes)
                localStorage.setItem('rel_valor_empresa_mes', mes);
            if (source)
                localStorage.setItem('rel_valor_empresa_source', source);
            if (connId) {
                localStorage.setItem(`rel_valor_empresa_conn_${companyParam || 'default'}`, connId);
            }
            const queryParams = new URLSearchParams({
                ano,
                mes,
                source,
                ...(companyParam ? { company_id: companyParam } : {}),
                ...(connId ? { connectionId: connId, connection_id: connId } : {})
            });
            const res = await api(`/finance/solidcon-vision?${queryParams.toString()}`);
            const data = res?.data;
            if (!data)
                throw new Error('Estrutura de dados inválida retornada pelo servidor.');
            if (getEl('connectionBadge')) {
                const compDisplay = res.company?.trade_name || res.company?.company_name || '';
                const connDisplay = res.connection?.name || 'Solidcon Principal';
                getEl('connectionBadge').textContent = `• ${compDisplay ? `${compDisplay} | ` : ''}${connDisplay}`;
            }
            // Process & Render Cartões Não Baixados (Sob Demanda)
            if (data.cartoesNaoBaixados && data.cartoesNaoBaixados.loaded) {
                currentCartoesData = data.cartoesNaoBaixados;
                rawLancamentos = currentCartoesData.lancamentos || [];
                renderCartoesCard(currentCartoesData);
                populateModalFilters(currentCartoesData);
            }
            else if (!currentCartoesData || !currentCartoesData.loaded) {
                currentCartoesData = {
                    loaded: false,
                    summary: { totalBruto: 0, totalLiquido: 0, totalTaxa: 0, totalOperacoes: 0, totalLancamentos: 0, ticketMedio: 0, totalAVencer: 0, totalVencido: 0, qtdAVencer: 0, qtdVencidos: 0 },
                    byBandeira: [],
                    byModalidade: [],
                    byFilial: [],
                    lancamentos: []
                };
                rawLancamentos = [];
                renderCartoesCard(currentCartoesData);
            }
            // Process & Render Crediário e Convênio a Receber (Sob Demanda)
            if (data.crediarioReceber && data.crediarioReceber.loaded) {
                currentCrediarioReceberData = data.crediarioReceber;
                rawCrediarioCupons = currentCrediarioReceberData.lancamentos || [];
                renderCrediarioReceberCard(currentCrediarioReceberData);
                populateModalCrediarioFilters(currentCrediarioReceberData);
            }
            else if (!currentCrediarioReceberData || !currentCrediarioReceberData.loaded) {
                currentCrediarioReceberData = {
                    loaded: false,
                    summary: { totalAReceber: 0, totalEmitido: 0, totalQuitado: 0, totalVencido: 0, totalAVencer: 0, qtdCupons: 0, qtdVencidos: 0, qtdAVencer: 0, qtdClientes: 0, ticketMedio: 0 },
                    topClientes: [],
                    byFilial: [],
                    lancamentos: []
                };
                rawCrediarioCupons = [];
                renderCrediarioReceberCard(currentCrediarioReceberData);
            }
            // Process & Render Contas a Pagar (Sob Demanda)
            if (data.contasPagar && data.contasPagar.loaded) {
                currentContasPagarData = data.contasPagar;
                rawContasPagarLancamentos = currentContasPagarData.lancamentos || [];
                renderContasPagarCard(currentContasPagarData);
                populateModalContasPagarFilters(currentContasPagarData);
            }
            else if (!currentContasPagarData || !currentContasPagarData.loaded) {
                currentContasPagarData = {
                    loaded: false,
                    summary: { totalAPagar: 0, totalVencido: 0, totalAVencer: 0, totalPermuta: 0, qtdTitulos: 0, qtdVencidos: 0, qtdAVencer: 0, qtdPermuta: 0, ticketMedio: 0 },
                    topFornecedores: [],
                    byFilial: [],
                    lancamentos: []
                };
                rawContasPagarLancamentos = [];
                renderContasPagarCard(currentContasPagarData);
            }
            const totalCartoesLotes = currentCartoesData?.loaded ? (currentCartoesData.summary?.totalLancamentos || 0) : null;
            const totalCuponsReceber = currentCrediarioReceberData?.loaded ? (currentCrediarioReceberData.summary?.qtdCupons || 0) : null;
            const totalTitulosPagar = currentContasPagarData?.loaded ? (currentContasPagarData.summary?.qtdTitulos || 0) : null;
            const extraDetails = [];
            if (totalCartoesLotes !== null)
                extraDetails.push(`${totalCartoesLotes} lotes de cartões`);
            if (totalCuponsReceber !== null)
                extraDetails.push(`${totalCuponsReceber} cupons a receber`);
            if (totalTitulosPagar !== null)
                extraDetails.push(`${totalTitulosPagar} títulos a pagar`);
            const badgeMsg = extraDetails.length > 0
                ? `Conectado (${extraDetails.join(' / ')})`
                : 'Conectado';
            updateStatusBadge('success', badgeMsg);
        }
        catch (err) {
            const msg = err?.message || String(err);
            updateStatusBadge('error', 'Falha na Conexão');
            showAlert(`Erro ao carregar dados: ${msg}`, 'error');
        }
        finally {
            isLoading = false;
            if (filterBtn)
                filterBtn.disabled = false;
            if (filterIcon)
                filterIcon.classList.remove('animate-spin');
        }
    };
    // ─── DOMContentLoaded Init ───────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', async () => {
        await loadCompanies();
        const initialCompany = getEl('filterCompany')?.value || '';
        await loadSolidconConnections(initialCompany);
        // Filter Form Submissions
        getEl('filterForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            void loadReport();
        });
        getEl('filterCompany')?.addEventListener('change', async () => {
            const selectedCompany = getEl('filterCompany')?.value || '';
            localStorage.setItem('rel_valor_empresa_company', selectedCompany);
            // Reset cartoes so stale data from prior company isn't shown
            currentCartoesData = {
                loaded: false,
                summary: { totalBruto: 0, totalLiquido: 0, totalTaxa: 0, totalOperacoes: 0, totalLancamentos: 0, ticketMedio: 0, totalAVencer: 0, totalVencido: 0, qtdAVencer: 0, qtdVencidos: 0 },
                byBandeira: [],
                byModalidade: [],
                byFilial: [],
                lancamentos: []
            };
            rawLancamentos = [];
            renderCartoesCard(currentCartoesData);
            // Reset crediario so stale data from prior company isn't shown
            currentCrediarioReceberData = {
                loaded: false,
                summary: { totalAReceber: 0, totalEmitido: 0, totalQuitado: 0, totalVencido: 0, totalAVencer: 0, qtdCupons: 0, qtdVencidos: 0, qtdAVencer: 0, qtdClientes: 0, ticketMedio: 0 },
                topClientes: [],
                byFilial: [],
                lancamentos: []
            };
            rawCrediarioCupons = [];
            renderCrediarioReceberCard(currentCrediarioReceberData);
            // Reset contas a pagar so stale data from prior company isn't shown
            currentContasPagarData = {
                loaded: false,
                summary: { totalAPagar: 0, totalVencido: 0, totalAVencer: 0, totalPermuta: 0, qtdTitulos: 0, qtdVencidos: 0, qtdAVencer: 0, qtdPermuta: 0, ticketMedio: 0 },
                topFornecedores: [],
                byFilial: [],
                lancamentos: []
            };
            rawContasPagarLancamentos = [];
            renderContasPagarCard(currentContasPagarData);
            // Reset contas geral solidcon bi so stale data from prior company isn't shown
            currentContasGeralData = {
                loaded: false,
                summary: { totalGeral: 0, totalPago: 0, totalAberto: 0, totalVencido: 0, totalAVencer: 0, totalPermuta: 0, qtdTitulos: 0, qtdPagos: 0, qtdAbertos: 0, qtdVencidos: 0, qtdAVencer: 0, qtdPermuta: 0, ticketMedio: 0 },
                topFornecedores: [],
                byFilial: [],
                lancamentos: []
            };
            rawContasGeralLancamentos = [];
            renderContasGeralCard(currentContasGeralData);
            await loadSolidconConnections(selectedCompany);
            await loadReport();
        });
        getEl('filterConnection')?.addEventListener('change', () => {
            const companyParam = getEl('filterCompany')?.value || '';
            const connVal = getEl('filterConnection')?.value || '';
            localStorage.setItem(`rel_valor_empresa_conn_${companyParam || 'default'}`, connVal);
            // Reset cartoes
            currentCartoesData = {
                loaded: false,
                summary: { totalBruto: 0, totalLiquido: 0, totalTaxa: 0, totalOperacoes: 0, totalLancamentos: 0, ticketMedio: 0, totalAVencer: 0, totalVencido: 0, qtdAVencer: 0, qtdVencidos: 0 },
                byBandeira: [],
                byModalidade: [],
                byFilial: [],
                lancamentos: []
            };
            rawLancamentos = [];
            renderCartoesCard(currentCartoesData);
            // Reset crediario
            currentCrediarioReceberData = {
                loaded: false,
                summary: { totalAReceber: 0, totalEmitido: 0, totalQuitado: 0, totalVencido: 0, totalAVencer: 0, qtdCupons: 0, qtdVencidos: 0, qtdAVencer: 0, qtdClientes: 0, ticketMedio: 0 },
                topClientes: [],
                byFilial: [],
                lancamentos: []
            };
            rawCrediarioCupons = [];
            renderCrediarioReceberCard(currentCrediarioReceberData);
            // Reset contas a pagar
            currentContasPagarData = {
                loaded: false,
                summary: { totalAPagar: 0, totalVencido: 0, totalAVencer: 0, totalPermuta: 0, qtdTitulos: 0, qtdVencidos: 0, qtdAVencer: 0, qtdPermuta: 0, ticketMedio: 0 },
                topFornecedores: [],
                byFilial: [],
                lancamentos: []
            };
            rawContasPagarLancamentos = [];
            renderContasPagarCard(currentContasPagarData);
            // Reset contas geral solidcon bi
            currentContasGeralData = {
                loaded: false,
                summary: { totalGeral: 0, totalPago: 0, totalAberto: 0, totalVencido: 0, totalAVencer: 0, totalPermuta: 0, qtdTitulos: 0, qtdPagos: 0, qtdAbertos: 0, qtdVencidos: 0, qtdAVencer: 0, qtdPermuta: 0, ticketMedio: 0 },
                topFornecedores: [],
                byFilial: [],
                lancamentos: []
            };
            rawContasGeralLancamentos = [];
            renderContasGeralCard(currentContasGeralData);
            void loadReport();
        });
        // Initialize default dates for Contas Geral Card and Modal
        const nowGeral = new Date();
        const yGeral = nowGeral.getFullYear();
        const mGeral = String(nowGeral.getMonth() + 1).padStart(2, '0');
        const lastDayGeral = new Date(yGeral, nowGeral.getMonth() + 1, 0).getDate();
        const defaultIniGeral = `${yGeral}-${mGeral}-01`;
        const defaultFimGeral = `${yGeral}-${mGeral}-${String(lastDayGeral).padStart(2, '0')}`;
        if (getEl('cardContasGeralDtInicio') && !getEl('cardContasGeralDtInicio').value) {
            getEl('cardContasGeralDtInicio').value = defaultIniGeral;
        }
        if (getEl('cardContasGeralDtFim') && !getEl('cardContasGeralDtFim').value) {
            getEl('cardContasGeralDtFim').value = defaultFimGeral;
        }
        if (getEl('modalContasGeralDtInicio') && !getEl('modalContasGeralDtInicio').value) {
            getEl('modalContasGeralDtInicio').value = defaultIniGeral;
        }
        if (getEl('modalContasGeralDtFim') && !getEl('modalContasGeralDtFim').value) {
            getEl('modalContasGeralDtFim').value = defaultFimGeral;
        }
        // ─── Modal Cartões Listeners ──────────────────────────────────────────
        getEl('btnOpenModalCartoes')?.addEventListener('click', () => {
            openModalCartoes();
        });
        getEl('btnCloseModalCartoes')?.addEventListener('click', () => {
            closeModalCartoes();
        });
        getEl('btnCloseModalCartoesFooter')?.addEventListener('click', () => {
            closeModalCartoes();
        });
        getEl('modalCartoesNaoBaixados')?.addEventListener('click', (e) => {
            if (e.target === getEl('modalCartoesNaoBaixados')) {
                closeModalCartoes();
            }
        });
        getEl('modalCartoesSearch')?.addEventListener('input', () => {
            applyModalFilters();
        });
        getEl('modalCartoesFilterStatus')?.addEventListener('change', () => {
            applyModalFilters();
        });
        getEl('modalCartoesFilterModalidade')?.addEventListener('change', () => {
            applyModalFilters();
        });
        getEl('modalCartoesFilterFilial')?.addEventListener('change', () => {
            applyModalFilters();
        });
        getEl('btnExportCartoesCsv')?.addEventListener('click', () => {
            exportCartoesCsv();
        });
        // ─── Cartões Card Date Filter Listeners ────────────────────────────────
        getEl('btnFilterCartoesCard')?.addEventListener('click', () => {
            void loadCartoesNaoBaixados();
        });
        getEl('btnResetCartoesCard')?.addEventListener('click', () => {
            void loadCartoesNaoBaixados({ resetDates: true });
        });
        const onCardCartoesInputKey = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                void loadCartoesNaoBaixados();
            }
        };
        getEl('cardCartoesDtInicio')?.addEventListener('keydown', onCardCartoesInputKey);
        getEl('cardCartoesDtFim')?.addEventListener('keydown', onCardCartoesInputKey);
        getEl('btnFilterCartoesModal')?.addEventListener('click', () => {
            const dtIni = getEl('modalCartoesDtInicio')?.value || '';
            const dtFim = getEl('modalCartoesDtFim')?.value || '';
            const tipo = getEl('modalCartoesTipoData')?.value || 'previsao';
            if (getEl('cardCartoesDtInicio'))
                getEl('cardCartoesDtInicio').value = dtIni;
            if (getEl('cardCartoesDtFim'))
                getEl('cardCartoesDtFim').value = dtFim;
            if (getEl('cardCartoesTipoData'))
                getEl('cardCartoesTipoData').value = tipo;
            void loadCartoesNaoBaixados();
        });
        getEl('btnResetCartoesModal')?.addEventListener('click', () => {
            void loadCartoesNaoBaixados({ resetDates: true });
        });
        // ─── Crediário Card Date Filter Listeners ─────────────────────────────
        getEl('btnFilterCrediarioCard')?.addEventListener('click', () => {
            void loadCrediarioReceber();
        });
        getEl('btnResetCrediarioCard')?.addEventListener('click', () => {
            void loadCrediarioReceber({ resetDates: true });
        });
        const onCardCrediarioInputKey = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                void loadCrediarioReceber();
            }
        };
        getEl('cardCrediarioDtInicio')?.addEventListener('keydown', onCardCrediarioInputKey);
        getEl('cardCrediarioDtFim')?.addEventListener('keydown', onCardCrediarioInputKey);
        // ─── Modal Crediário/Convênio Listeners ────────────────────────────────
        getEl('btnOpenModalCrediario')?.addEventListener('click', () => {
            openModalCrediario();
        });
        getEl('btnCloseModalCrediario')?.addEventListener('click', () => {
            closeModalCrediario();
        });
        getEl('btnCloseModalCrediarioFooter')?.addEventListener('click', () => {
            closeModalCrediario();
        });
        getEl('modalCrediarioReceber')?.addEventListener('click', (e) => {
            if (e.target === getEl('modalCrediarioReceber')) {
                closeModalCrediario();
            }
        });
        getEl('modalCrediarioSearch')?.addEventListener('input', () => {
            applyModalCrediarioFilters();
        });
        getEl('modalCrediarioFilterStatus')?.addEventListener('change', () => {
            applyModalCrediarioFilters();
        });
        getEl('modalCrediarioFilterFilial')?.addEventListener('change', () => {
            applyModalCrediarioFilters();
        });
        getEl('modalCrediarioDtInicio')?.addEventListener('change', () => {
            applyModalCrediarioFilters();
        });
        getEl('modalCrediarioDtFim')?.addEventListener('change', () => {
            applyModalCrediarioFilters();
        });
        getEl('modalCrediarioTipoData')?.addEventListener('change', () => {
            applyModalCrediarioFilters();
        });
        getEl('btnFilterCrediarioModal')?.addEventListener('click', () => {
            const dtIni = getEl('modalCrediarioDtInicio')?.value || '';
            const dtFim = getEl('modalCrediarioDtFim')?.value || '';
            const tipo = getEl('modalCrediarioTipoData')?.value || 'vencimento';
            if (getEl('cardCrediarioDtInicio'))
                getEl('cardCrediarioDtInicio').value = dtIni;
            if (getEl('cardCrediarioDtFim'))
                getEl('cardCrediarioDtFim').value = dtFim;
            if (getEl('cardCrediarioTipoData'))
                getEl('cardCrediarioTipoData').value = tipo;
            void loadCrediarioReceber();
        });
        getEl('btnResetCrediarioModal')?.addEventListener('click', () => {
            void loadCrediarioReceber({ resetDates: true });
        });
        getEl('btnExportCrediarioCsv')?.addEventListener('click', () => {
            exportCrediarioCsv();
        });
        // ─── Contas a Pagar Card Date Filter Listeners ────────────────────────
        getEl('btnFilterContasPagarCard')?.addEventListener('click', () => {
            void loadContasPagar();
        });
        getEl('btnResetContasPagarCard')?.addEventListener('click', () => {
            void loadContasPagar({ resetDates: true });
        });
        const onCardContasPagarInputKey = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                void loadContasPagar();
            }
        };
        getEl('cardContasPagarDtInicio')?.addEventListener('keydown', onCardContasPagarInputKey);
        getEl('cardContasPagarDtFim')?.addEventListener('keydown', onCardContasPagarInputKey);
        // ─── Modal Contas a Pagar Listeners ───────────────────────────────────
        getEl('btnOpenModalContasPagar')?.addEventListener('click', () => {
            openModalContasPagar();
        });
        getEl('btnCloseModalContasPagar')?.addEventListener('click', () => {
            closeModalContasPagar();
        });
        getEl('btnCloseModalContasPagarFooter')?.addEventListener('click', () => {
            closeModalContasPagar();
        });
        getEl('modalContasPagar')?.addEventListener('click', (e) => {
            if (e.target === getEl('modalContasPagar')) {
                closeModalContasPagar();
            }
        });
        getEl('modalContasPagarSearch')?.addEventListener('input', () => {
            applyModalContasPagarFilters();
        });
        getEl('modalContasPagarFilterStatus')?.addEventListener('change', () => {
            applyModalContasPagarFilters();
        });
        getEl('modalContasPagarFilterFilial')?.addEventListener('change', () => {
            renderModalContasPagarFiliaisCards(currentContasPagarData);
            applyModalContasPagarFilters();
        });
        getEl('modalContasPagarDtInicio')?.addEventListener('change', () => {
            applyModalContasPagarFilters();
        });
        getEl('modalContasPagarDtFim')?.addEventListener('change', () => {
            applyModalContasPagarFilters();
        });
        getEl('modalContasPagarTipoData')?.addEventListener('change', () => {
            applyModalContasPagarFilters();
        });
        getEl('btnFilterContasPagarModal')?.addEventListener('click', () => {
            const dtIni = getEl('modalContasPagarDtInicio')?.value || '';
            const dtFim = getEl('modalContasPagarDtFim')?.value || '';
            const tipo = getEl('modalContasPagarTipoData')?.value || 'vencimento';
            if (getEl('cardContasPagarDtInicio'))
                getEl('cardContasPagarDtInicio').value = dtIni;
            if (getEl('cardContasPagarDtFim'))
                getEl('cardContasPagarDtFim').value = dtFim;
            if (getEl('cardContasPagarTipoData'))
                getEl('cardContasPagarTipoData').value = tipo;
            void loadContasPagar();
        });
        getEl('btnResetContasPagarModal')?.addEventListener('click', () => {
            void loadContasPagar({ resetDates: true });
        });
        getEl('btnExportContasPagarCsv')?.addEventListener('click', () => {
            exportContasPagarCsv();
        });
        // ─── Modal Histórico Contas a Pagar Listeners ────────────────────────
        getEl('btnCloseModalContasPagarHistorico')?.addEventListener('click', () => {
            closeModalContasPagarHistorico();
        });
        getEl('btnCloseModalContasPagarHistoricoFooter')?.addEventListener('click', () => {
            closeModalContasPagarHistorico();
        });
        getEl('modalContasPagarHistorico')?.addEventListener('click', (e) => {
            if (e.target === getEl('modalContasPagarHistorico')) {
                closeModalContasPagarHistorico();
            }
        });
        // ─── Contas Geral Solidcon (BI) Card Date Filter Listeners ────────────
        getEl('btnFilterContasGeralCard')?.addEventListener('click', () => {
            void loadContasGeralSolidconBI();
        });
        getEl('btnResetContasGeralCard')?.addEventListener('click', () => {
            void loadContasGeralSolidconBI({ resetDates: true });
        });
        const onCardContasGeralInputKey = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                void loadContasGeralSolidconBI();
            }
        };
        getEl('cardContasGeralDtInicio')?.addEventListener('keydown', onCardContasGeralInputKey);
        getEl('cardContasGeralDtFim')?.addEventListener('keydown', onCardContasGeralInputKey);
        // ─── Modal Contas Geral Solidcon Listeners ────────────────────────────
        getEl('btnOpenModalContasGeral')?.addEventListener('click', () => {
            openModalContasGeral();
        });
        getEl('btnCloseModalContasGeral')?.addEventListener('click', () => {
            closeModalContasGeral();
        });
        getEl('btnCloseModalContasGeralFooter')?.addEventListener('click', () => {
            closeModalContasGeral();
        });
        getEl('modalContasGeralSolidcon')?.addEventListener('click', (e) => {
            if (e.target === getEl('modalContasGeralSolidcon')) {
                closeModalContasGeral();
            }
        });
        getEl('modalContasGeralSearch')?.addEventListener('input', () => {
            applyModalContasGeralFilters();
        });
        getEl('modalContasGeralFilterStatus')?.addEventListener('change', () => {
            applyModalContasGeralFilters();
        });
        getEl('modalContasGeralFilterFilial')?.addEventListener('change', () => {
            renderModalContasGeralFiliaisCards(currentContasGeralData);
            applyModalContasGeralFilters();
        });
        getEl('modalContasGeralDtInicio')?.addEventListener('change', () => {
            applyModalContasGeralFilters();
        });
        getEl('modalContasGeralDtFim')?.addEventListener('change', () => {
            applyModalContasGeralFilters();
        });
        getEl('modalContasGeralTipoData')?.addEventListener('change', () => {
            applyModalContasGeralFilters();
        });
        getEl('btnFilterContasGeralModal')?.addEventListener('click', () => {
            const dtIni = getEl('modalContasGeralDtInicio')?.value || '';
            const dtFim = getEl('modalContasGeralDtFim')?.value || '';
            const tipo = getEl('modalContasGeralTipoData')?.value || 'vencimento';
            if (getEl('cardContasGeralDtInicio'))
                getEl('cardContasGeralDtInicio').value = dtIni;
            if (getEl('cardContasGeralDtFim'))
                getEl('cardContasGeralDtFim').value = dtFim;
            if (getEl('cardContasGeralTipoData'))
                getEl('cardContasGeralTipoData').value = tipo;
            void loadContasGeralSolidconBI();
        });
        getEl('btnResetContasGeralModal')?.addEventListener('click', () => {
            void loadContasGeralSolidconBI({ resetDates: true });
        });
        getEl('btnExportContasGeralCsv')?.addEventListener('click', () => {
            exportContasGeralCsv();
        });
        // ─── Modal Detalhes Contas Geral Listeners ───────────────────────────
        getEl('btnCloseModalContasGeralDetalhes')?.addEventListener('click', () => {
            closeModalContasGeralDetalhes();
        });
        getEl('btnCloseModalContasGeralDetalhesFooter')?.addEventListener('click', () => {
            closeModalContasGeralDetalhes();
        });
        getEl('modalContasGeralDetalhes')?.addEventListener('click', (e) => {
            if (e.target === getEl('modalContasGeralDetalhes')) {
                closeModalContasGeralDetalhes();
            }
        });
        // ─── Global Keyboard Listener (ESC to close any modal) ───────────────
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!getEl('modalContasGeralDetalhes')?.classList.contains('hidden')) {
                    closeModalContasGeralDetalhes();
                    return;
                }
                if (!getEl('modalContasGeralSolidcon')?.classList.contains('hidden')) {
                    closeModalContasGeral();
                    return;
                }
                if (!getEl('modalContasPagarHistorico')?.classList.contains('hidden')) {
                    closeModalContasPagarHistorico();
                    return;
                }
                if (!getEl('modalCartoesNaoBaixados')?.classList.contains('hidden')) {
                    closeModalCartoes();
                    return;
                }
                if (!getEl('modalCrediarioReceber')?.classList.contains('hidden')) {
                    closeModalCrediario();
                    return;
                }
                if (!getEl('modalContasPagar')?.classList.contains('hidden')) {
                    closeModalContasPagar();
                    return;
                }
            }
        });
        // Initial fetch
        await loadReport();
    });
})();
