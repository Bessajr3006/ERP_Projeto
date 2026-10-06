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
        const totalAReceber = Number(summary.totalAReceber || 0);
        const totalVencido = Number(summary.totalVencido || 0);
        const totalAVencer = Number(summary.totalAVencer || 0);
        const qtdCupons = Number(summary.qtdCupons || 0);
        const qtdVencidos = Number(summary.qtdVencidos || 0);
        const qtdAVencer = Number(summary.qtdAVencer || 0);
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
        let sumReceber = 0;
        let sumVencido = 0;
        let sumAVencer = 0;
        filtered.forEach((r) => {
            const val = Number(r.saldoPendente || 0);
            sumReceber += val;
            if (r.isVencido)
                sumVencido += val;
            else
                sumAVencer += val;
        });
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
            const totalCartoesLotes = currentCartoesData?.loaded ? (currentCartoesData.summary?.totalLancamentos || 0) : null;
            const totalCuponsReceber = currentCrediarioReceberData?.loaded ? (currentCrediarioReceberData.summary?.qtdCupons || 0) : null;
            const extraDetails = [];
            if (totalCartoesLotes !== null)
                extraDetails.push(`${totalCartoesLotes} lotes de cartões`);
            if (totalCuponsReceber !== null)
                extraDetails.push(`${totalCuponsReceber} cupons a receber`);
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
            void loadReport();
        });
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
        // ─── Global Keyboard Listener (ESC to close any modal) ───────────────
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!getEl('modalCartoesNaoBaixados')?.classList.contains('hidden')) {
                    closeModalCartoes();
                }
                if (!getEl('modalCrediarioReceber')?.classList.contains('hidden')) {
                    closeModalCrediario();
                }
            }
        });
        // Initial fetch
        await loadReport();
    });
})();
