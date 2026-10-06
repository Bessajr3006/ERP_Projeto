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
    // ─── Year Dropdown Population ─────────────────────────────────────────────
    const populateYearDropdown = () => {
        const select = getEl('filterAno');
        if (!select)
            return;
        const currentYear = new Date().getFullYear();
        const savedYear = localStorage.getItem('rel_valor_empresa_ano');
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
            const savedCompanyId = localStorage.getItem('rel_valor_empresa_company');
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
            const savedConnectionId = localStorage.getItem(`rel_valor_empresa_conn_${companyParam || 'default'}`);
            if (savedConnectionId) {
                select.value = savedConnectionId;
            }
        }
        catch (err) {
            console.warn('[Rel.Valor_Empresa] Falha ao carregar conexões Solidcon:', err);
            select.innerHTML = '<option value="">Padrão da Empresa (Solidcon)</option>';
        }
    };
    // ─── Render Card: Cartões Não Baixados ────────────────────────────────────
    const renderCartoesCard = (cartoesData) => {
        if (!cartoesData)
            return;
        const summary = cartoesData.summary || {};
        const totalLiquido = Number(summary.totalLiquido || 0);
        const totalBruto = Number(summary.totalBruto || 0);
        const totalTaxa = Number(summary.totalTaxa || 0);
        const totalOperacoes = Number(summary.totalOperacoes || 0);
        const totalLancamentos = Number(summary.totalLancamentos || 0);
        const ticketMedio = Number(summary.ticketMedio || 0);
        const totalAVencer = Number(summary.totalAVencer || 0);
        const totalVencido = Number(summary.totalVencido || 0);
        const qtdAVencer = Number(summary.qtdAVencer || 0);
        const qtdVencidos = Number(summary.qtdVencidos || 0);
        const taxaMediaPct = totalBruto > 0 ? ((totalTaxa / totalBruto) * 100).toFixed(2) : '0.00';
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
        if (getEl('cardCartoesTotalBruto')) {
            getEl('cardCartoesTotalBruto').textContent = formatMoney(totalBruto);
        }
        if (getEl('cardCartoesTotalTaxa')) {
            getEl('cardCartoesTotalTaxa').textContent = formatMoney(totalTaxa);
        }
        if (getEl('cardCartoesTaxaPercent')) {
            getEl('cardCartoesTaxaPercent').textContent = `Taxa média: ${taxaMediaPct}%`;
        }
        if (getEl('cardCartoesTotalOperacoes')) {
            getEl('cardCartoesTotalOperacoes').textContent = totalOperacoes.toLocaleString('pt-BR');
        }
        if (getEl('cardCartoesTicketMedio')) {
            getEl('cardCartoesTicketMedio').textContent = `Ticket Médio: ${formatMoney(ticketMedio)}`;
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
        if (getEl('modalSummaryTotalBruto')) {
            getEl('modalSummaryTotalBruto').textContent = formatMoney(sumBruto);
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
        if (getEl('modalCartoesBadgePeriodo')) {
            getEl('modalCartoesBadgePeriodo').textContent = currentPeriodLabel;
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
    // ─── Render Card: Crediário e Convênio a Receber (até 2999) ───────────────
    const renderCrediarioReceberCard = (data) => {
        if (!data)
            return;
        const summary = data.summary || {};
        const totalAReceber = Number(summary.totalAReceber || 0);
        const totalVencido = Number(summary.totalVencido || 0);
        const totalAVencer = Number(summary.totalAVencer || 0);
        const totalEmitido = Number(summary.totalEmitido || 0);
        const totalQuitado = Number(summary.totalQuitado || 0);
        const qtdCupons = Number(summary.qtdCupons || 0);
        const qtdVencidos = Number(summary.qtdVencidos || 0);
        const qtdAVencer = Number(summary.qtdAVencer || 0);
        const qtdClientes = Number(summary.qtdClientes || 0);
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
        if (getEl('cardCrediarioTotalEmitido')) {
            getEl('cardCrediarioTotalEmitido').textContent = formatMoney(totalEmitido);
        }
        if (getEl('cardCrediarioEmitidoInfo')) {
            getEl('cardCrediarioEmitidoInfo').textContent = `Quitado: ${formatMoney(totalQuitado)} • ${qtdClientes.toLocaleString('pt-BR')} clientes`;
        }
        if (getEl('badgeCrediarioStatus')) {
            getEl('badgeCrediarioStatus').textContent = `${qtdCupons.toLocaleString('pt-BR')} Cupons a Receber`;
        }
        if (getEl('badgeCardCrediarioCount')) {
            getEl('badgeCardCrediarioCount').textContent = String(qtdCupons);
        }
        // Render Top Clientes com maior pendência
        const topContainer = getEl('cardCrediarioTopClientesContainer');
        const topClientes = data.topClientes || [];
        if (getEl('cardCrediarioCountTopClientes')) {
            getEl('cardCrediarioCountTopClientes').textContent = `${topClientes.length} devedores em destaque`;
        }
        if (topContainer) {
            if (topClientes.length === 0) {
                topContainer.innerHTML = '<span class="text-xs text-gray-400 dark:text-gray-500 col-span-full">Nenhum saldo pendente encontrado no período</span>';
            }
            else {
                topContainer.innerHTML = topClientes.slice(0, 5).map((item, idx) => {
                    return `
                        <div class="p-2.5 rounded-xl bg-gray-50/80 dark:bg-slate-900/60 border border-indigo-100/80 dark:border-indigo-950/50 flex flex-col justify-between">
                            <div class="flex items-center justify-between gap-1 mb-1">
                                <span class="font-bold text-[11px] text-gray-800 dark:text-gray-200 truncate" title="${escapeHtml(item.cliente)}">
                                    #${idx + 1} ${escapeHtml(item.cliente)}
                                </span>
                                <span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 shrink-0">
                                    ${item.percentual}%
                                </span>
                            </div>
                            <div class="flex items-center justify-between text-xs mt-1">
                                <span class="text-[10px] text-gray-400 dark:text-gray-500">${item.qtdCupons} cupons</span>
                                <span class="font-bold font-mono text-indigo-600 dark:text-indigo-400">${formatMoney(item.totalAReceber)}</span>
                            </div>
                        </div>
                    `;
                }).join('');
            }
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
        const filtered = rawCrediarioCupons.filter((item) => {
            if (selectedStatus === 'vencidos' && !item.isVencido)
                return false;
            if (selectedStatus === 'a_vencer' && item.isVencido)
                return false;
            if (selectedFilial && String(item.filial) !== selectedFilial)
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
            const filial = getEl('filterFilial')?.value || '';
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
            if (filial) {
                localStorage.setItem(`rel_valor_empresa_filial_${companyParam || 'default'}`, filial);
            }
            const queryParams = new URLSearchParams({
                ano,
                mes,
                source,
                ...(companyParam ? { company_id: companyParam } : {}),
                ...(filial ? { cdFilial: filial, filial } : {}),
                ...(connId ? { connectionId: connId, connection_id: connId } : {})
            });
            const res = await api(`/finance/solidcon-vision?${queryParams.toString()}`);
            const data = res?.data;
            if (!data)
                throw new Error('Estrutura de dados inválida retornada pelo servidor.');
            // Update Filial select if new filiais returned
            if (data.filiais && data.filiais.length > 0) {
                const filialSelect = getEl('filterFilial');
                if (filialSelect) {
                    const currentVal = filialSelect.value;
                    const savedFilial = localStorage.getItem(`rel_valor_empresa_filial_${companyParam || 'default'}`);
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
            // Process & Render Cartões Não Baixados
            currentCartoesData = data.cartoesNaoBaixados || {
                summary: { totalBruto: 0, totalLiquido: 0, totalTaxa: 0, totalOperacoes: 0, totalLancamentos: 0, ticketMedio: 0 },
                byBandeira: [],
                byModalidade: [],
                byFilial: [],
                lancamentos: []
            };
            rawLancamentos = currentCartoesData.lancamentos || [];
            renderCartoesCard(currentCartoesData);
            populateModalFilters(currentCartoesData);
            // Process & Render Crediário e Convênio a Receber
            currentCrediarioReceberData = data.crediarioReceber || {
                summary: { totalAReceber: 0, totalEmitido: 0, totalQuitado: 0, totalVencido: 0, totalAVencer: 0, qtdCupons: 0, qtdVencidos: 0, qtdAVencer: 0, qtdClientes: 0, ticketMedio: 0 },
                topClientes: [],
                byFilial: [],
                lancamentos: []
            };
            rawCrediarioCupons = currentCrediarioReceberData.lancamentos || [];
            renderCrediarioReceberCard(currentCrediarioReceberData);
            populateModalCrediarioFilters(currentCrediarioReceberData);
            const totalCartoesLotes = currentCartoesData.summary?.totalLancamentos || 0;
            const totalCuponsReceber = currentCrediarioReceberData.summary?.qtdCupons || 0;
            updateStatusBadge('success', `Conectado (${totalCartoesLotes} lotes de cartões / ${totalCuponsReceber} cupons a receber)`);
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
        populateYearDropdown();
        // Set saved or current month in select
        const mesSelect = getEl('filterMes');
        if (mesSelect) {
            const savedMes = localStorage.getItem('rel_valor_empresa_mes');
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
            const savedSource = localStorage.getItem('rel_valor_empresa_source');
            if (savedSource && sourceSelect.querySelector(`option[value="${savedSource}"]`)) {
                sourceSelect.value = savedSource;
            }
        }
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
            await loadSolidconConnections(selectedCompany);
            await loadReport();
        });
        getEl('filterConnection')?.addEventListener('change', () => {
            const companyParam = getEl('filterCompany')?.value || '';
            const connVal = getEl('filterConnection')?.value || '';
            localStorage.setItem(`rel_valor_empresa_conn_${companyParam || 'default'}`, connVal);
            void loadReport();
        });
        getEl('filterAno')?.addEventListener('change', () => {
            const val = getEl('filterAno')?.value || '';
            if (val)
                localStorage.setItem('rel_valor_empresa_ano', val);
            void loadReport();
        });
        getEl('filterMes')?.addEventListener('change', () => {
            const val = getEl('filterMes')?.value || '';
            if (val)
                localStorage.setItem('rel_valor_empresa_mes', val);
            void loadReport();
        });
        getEl('filterSource')?.addEventListener('change', () => {
            const val = getEl('filterSource')?.value || '';
            if (val)
                localStorage.setItem('rel_valor_empresa_source', val);
            void loadReport();
        });
        getEl('filterFilial')?.addEventListener('change', () => {
            const companyParam = getEl('filterCompany')?.value || '';
            const val = getEl('filterFilial')?.value || '';
            localStorage.setItem(`rel_valor_empresa_filial_${companyParam || 'default'}`, val);
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
