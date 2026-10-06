// @ts-nocheck
/**
 * rel_valor_empresa.ts
 * Relatório Analítico de Valores por Empresa
 */

(() => {
    // ─── DOM Helpers ──────────────────────────────────────────────────────────
    const getEl = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
        document.getElementById(id) as T | null;

    let isLoading = false;
    let accessibleCompanies: any[] = [];
    let currentCompanyPublicId = '';

    // State for Cartões Não Baixados
    let currentCartoesData: any = null;
    let rawLancamentos: any[] = [];
    let currentPeriodLabel = '';

    // State for Relatório Financeiro 125
    let currentRel125Data: any = null;
    let rawTransactions125: any[] = [];

    function escapeHtml(value: any): string {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    const formatMoney = (val: number): string => {
        const num = Number(val || 0);
        return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatDateBR = (isoDateStr: string): string => {
        if (!isoDateStr) return '-';
        const clean = String(isoDateStr).slice(0, 10);
        const parts = clean.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return clean;
    };

    // ─── Status & Alert Helpers ───────────────────────────────────────────────
    const updateStatusBadge = (type: 'ready' | 'loading' | 'success' | 'error', text: string) => {
        const badge = getEl('statusBadge');
        if (!badge) return;

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

    const showAlert = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
        const box = getEl('alertMessage');
        if (!box) return;

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
        if (box) box.classList.add('hidden');
    };

    // ─── Year Dropdown Population ─────────────────────────────────────────────
    const populateYearDropdown = () => {
        const select = getEl<HTMLSelectElement>('filterAno');
        if (!select) return;

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

            const savedCompanyId = localStorage.getItem('rel_valor_empresa_company');

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
            console.warn('[Rel.Valor_Empresa] Falha ao carregar lista de empresas:', err);
            compSelect.innerHTML = '<option value="">Minha Empresa</option>';
        }
    }

    // ─── Load Solidcon Connections for Company ────────────────────────────────
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

            const savedConnectionId = localStorage.getItem(`rel_valor_empresa_conn_${companyParam || 'default'}`);
            if (savedConnectionId) {
                select.value = savedConnectionId;
            }
        } catch (err) {
            console.warn('[Rel.Valor_Empresa] Falha ao carregar conexões Solidcon:', err);
            select.innerHTML = '<option value="">Padrão da Empresa (Solidcon)</option>';
        }
    };

    // ─── Render Card: Cartões Não Baixados ────────────────────────────────────
    const renderCartoesCard = (cartoesData: any) => {
        if (!cartoesData) return;

        const summary = cartoesData.summary || {};
        const totalLiquido = Number(summary.totalLiquido || 0);
        const totalBruto = Number(summary.totalBruto || 0);
        const totalTaxa = Number(summary.totalTaxa || 0);
        const totalOperacoes = Number(summary.totalOperacoes || 0);
        const totalLancamentos = Number(summary.totalLancamentos || 0);
        const ticketMedio = Number(summary.ticketMedio || 0);

        const taxaMediaPct = totalBruto > 0 ? ((totalTaxa / totalBruto) * 100).toFixed(2) : '0.00';

        if (getEl('cardCartoesTotalLiquido')) {
            getEl('cardCartoesTotalLiquido')!.textContent = formatMoney(totalLiquido);
        }
        if (getEl('cardCartoesTotalBruto')) {
            getEl('cardCartoesTotalBruto')!.textContent = formatMoney(totalBruto);
        }
        if (getEl('cardCartoesTotalTaxa')) {
            getEl('cardCartoesTotalTaxa')!.textContent = formatMoney(totalTaxa);
        }
        if (getEl('cardCartoesTaxaPercent')) {
            getEl('cardCartoesTaxaPercent')!.textContent = `Taxa média: ${taxaMediaPct}%`;
        }
        if (getEl('cardCartoesTotalOperacoes')) {
            getEl('cardCartoesTotalOperacoes')!.textContent = totalOperacoes.toLocaleString('pt-BR');
        }
        if (getEl('cardCartoesTicketMedio')) {
            getEl('cardCartoesTicketMedio')!.textContent = `Ticket Médio: ${formatMoney(ticketMedio)} (${totalLancamentos} lotes)`;
        }
        if (getEl('badgeCardLancamentosCount')) {
            getEl('badgeCardLancamentosCount')!.textContent = String(totalLancamentos);
        }
        if (getEl('badgeCartoesStatus')) {
            getEl('badgeCartoesStatus')!.textContent = totalLancamentos > 0 ? `${totalLancamentos} Pendentes` : 'Tudo Baixado';
            getEl('badgeCartoesStatus')!.className = totalLancamentos > 0
                ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                : 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60';
        }

        // Render modalidade distribution pills
        const modContainer = getEl('cardCartoesModalidadesContainer');
        if (modContainer) {
            const byModalidade = cartoesData.byModalidade || [];
            if (byModalidade.length === 0) {
                modContainer.innerHTML = '<span class="text-xs text-gray-400">Nenhum lote pendente no período</span>';
            } else {
                modContainer.innerHTML = byModalidade.map((m: any) => {
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
    const populateModalFilters = (cartoesData: any) => {
        const modSelect = getEl<HTMLSelectElement>('modalCartoesFilterModalidade');
        const filSelect = getEl<HTMLSelectElement>('modalCartoesFilterFilial');

        if (modSelect) {
            const modalidades = (cartoesData.byModalidade || []).map((m: any) => m.modalidade);
            modSelect.innerHTML = '<option value="">Todas as Modalidades</option>' +
                modalidades.map((m: string) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
        }

        if (filSelect) {
            const filiais = cartoesData.byFilial || [];
            filSelect.innerHTML = '<option value="">Todas as Filiais</option>' +
                filiais.map((f: any) => `<option value="${escapeHtml(f.filial)}">${escapeHtml(f.nomeFilial || `Filial ${f.filial}`)}</option>`).join('');
        }
    };

    const renderModalTable = (list: any[]) => {
        const tbody = getEl('modalCartoesTableBody');
        if (!tbody) return;

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

        tbody.innerHTML = list.map((item: any) => {
            const modalidadeUpper = String(item.modalidade || '').toUpperCase();
            const modBadgeClass = modalidadeUpper.includes('CRED')
                ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40'
                : modalidadeUpper.includes('DEB')
                ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40'
                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40';

            const taxaPct = item.vlBruto > 0 ? ((item.vlTaxa / item.vlBruto) * 100).toFixed(1) : '0.0';

            return `
                <tr class="hover:bg-gray-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td class="py-2.5 px-4 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        ${formatDateBR(item.dtVenda)}
                    </td>
                    <td class="py-2.5 px-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        ${formatDateBR(item.dtPrevisao)}
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
                    <td class="py-2.5 px-4 text-center whitespace-nowrap">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                            Não Baixado
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    };

    const applyModalFilters = () => {
        const query = (getEl<HTMLInputElement>('modalCartoesSearch')?.value || '').toLowerCase().trim();
        const selectedMod = getEl<HTMLSelectElement>('modalCartoesFilterModalidade')?.value || '';
        const selectedFilial = getEl<HTMLSelectElement>('modalCartoesFilterFilial')?.value || '';

        const filtered = rawLancamentos.filter((item: any) => {
            if (selectedMod && item.modalidade !== selectedMod) {
                return false;
            }
            if (selectedFilial && String(item.filial) !== selectedFilial) {
                return false;
            }
            if (query) {
                const combined = `${item.bandeira} ${item.modalidade} ${item.nome_filial} ${item.dtVenda} ${item.dtPrevisao} ${item.historico}`.toLowerCase();
                if (!combined.includes(query)) return false;
            }
            return true;
        });

        // Update Ribbon Summary
        let sumLiquido = 0;
        let sumBruto = 0;
        let sumTaxa = 0;
        filtered.forEach((r: any) => {
            sumLiquido += Number(r.vlLiquido || 0);
            sumBruto += Number(r.vlBruto || 0);
            sumTaxa += Number(r.vlTaxa || 0);
        });

        if (getEl('modalSummaryTotalLiquido')) {
            getEl('modalSummaryTotalLiquido')!.textContent = formatMoney(sumLiquido);
        }
        if (getEl('modalSummaryTotalBruto')) {
            getEl('modalSummaryTotalBruto')!.textContent = formatMoney(sumBruto);
        }
        if (getEl('modalSummaryTotalTaxa')) {
            getEl('modalSummaryTotalTaxa')!.textContent = formatMoney(sumTaxa);
        }
        if (getEl('modalCartoesItemCount')) {
            getEl('modalCartoesItemCount')!.textContent = `Exibindo ${filtered.length} de ${rawLancamentos.length} lançamentos`;
        }

        renderModalTable(filtered);
    };

    const openModalCartoes = () => {
        const modal = getEl('modalCartoesNaoBaixados');
        if (!modal) return;

        if (getEl('modalCartoesBadgePeriodo')) {
            getEl('modalCartoesBadgePeriodo')!.textContent = currentPeriodLabel;
        }

        // Reset search & filters
        if (getEl<HTMLInputElement>('modalCartoesSearch')) {
            getEl<HTMLInputElement>('modalCartoesSearch')!.value = '';
        }
        if (getEl<HTMLSelectElement>('modalCartoesFilterModalidade')) {
            getEl<HTMLSelectElement>('modalCartoesFilterModalidade')!.value = '';
        }
        if (getEl<HTMLSelectElement>('modalCartoesFilterFilial')) {
            getEl<HTMLSelectElement>('modalCartoesFilterFilial')!.value = '';
        }

        applyModalFilters();
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    };

    const closeModalCartoes = () => {
        const modal = getEl('modalCartoesNaoBaixados');
        if (!modal) return;
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    };

    const exportCartoesCsv = () => {
        if (!rawLancamentos || rawLancamentos.length === 0) {
            showAlert('Não há dados para exportar.', 'info');
            return;
        }

        const headers = ['Data Venda', 'Previsão Recebimento', 'Filial', 'Modalidade', 'Bandeira / Operadora', 'Qtd Vendas', 'Valor Bruto', 'Taxa (R$)', 'Valor Líquido', 'Status'];
        const rows = rawLancamentos.map((item: any) => [
            formatDateBR(item.dtVenda),
            formatDateBR(item.dtPrevisao),
            `"${(item.nome_filial || `Filial ${item.filial}`).replace(/"/g, '""')}"`,
            `"${(item.modalidade || '').replace(/"/g, '""')}"`,
            `"${(item.bandeira || '').replace(/"/g, '""')}"`,
            item.qtd || 1,
            Number(item.vlBruto || 0).toFixed(2).replace('.', ','),
            Number(item.vlTaxa || 0).toFixed(2).replace('.', ','),
            Number(item.vlLiquido || 0).toFixed(2).replace('.', ','),
            '"Não Baixado"'
        ]);

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

    // ─── Render Card: Relatório Financeiro nº 125 ─────────────────────────────
    const renderRel125Card = (data: any) => {
        if (!data) return;

        const summary = data.summary || {};
        const totalReceita = Number(summary.totalReceita || 0);
        const totalDespesa = Number(summary.totalDespesa || 0);
        const saldoLiquido = Number(summary.saldoLiquido || 0);
        const totalMovimentado = Number(summary.totalMovimentado || (totalReceita + totalDespesa));
        const margemPercent = Number(summary.margemPercent || 0);
        const qtdReceita = Number(summary.qtdReceita || 0);
        const qtdDespesa = Number(summary.qtdDespesa || 0);
        const totalLancamentos = qtdReceita + qtdDespesa;

        if (getEl('cardRel125TotalReceitas')) {
            getEl('cardRel125TotalReceitas')!.textContent = formatMoney(totalReceita);
        }
        if (getEl('cardRel125QtdReceitas')) {
            getEl('cardRel125QtdReceitas')!.textContent = `${qtdReceita.toLocaleString('pt-BR')} lançamentos de receita`;
        }

        if (getEl('cardRel125TotalDespesas')) {
            getEl('cardRel125TotalDespesas')!.textContent = formatMoney(totalDespesa);
        }
        if (getEl('cardRel125QtdDespesas')) {
            getEl('cardRel125QtdDespesas')!.textContent = `${qtdDespesa.toLocaleString('pt-BR')} lançamentos de despesa`;
        }

        if (getEl('cardRel125SaldoLiquido')) {
            const saldoEl = getEl('cardRel125SaldoLiquido')!;
            saldoEl.textContent = formatMoney(saldoLiquido);
            saldoEl.className = `text-2xl sm:text-3xl font-black mt-1 tracking-tight ${
                saldoLiquido >= 0 
                    ? 'text-indigo-700 dark:text-indigo-400' 
                    : 'text-rose-600 dark:text-rose-400'
            }`;
        }
        if (getEl('cardRel125MargemPercent')) {
            getEl('cardRel125MargemPercent')!.textContent = `Margem Líquida: ${margemPercent.toFixed(1)}%`;
        }

        if (getEl('cardRel125TotalMovimentado')) {
            getEl('cardRel125TotalMovimentado')!.textContent = formatMoney(totalMovimentado);
        }
        if (getEl('cardRel125QtdTotal')) {
            getEl('cardRel125QtdTotal')!.textContent = `${totalLancamentos.toLocaleString('pt-BR')} lançamentos no total`;
        }

        if (getEl('badgeRel125Status')) {
            getEl('badgeRel125Status')!.textContent = `${totalLancamentos.toLocaleString('pt-BR')} Lançamentos`;
        }
        if (getEl('badgeRel125LancamentosCount')) {
            getEl('badgeRel125LancamentosCount')!.textContent = String(totalLancamentos);
        }

        // Render Top Receitas Categorias
        const topRecContainer = getEl('cardRel125TopReceitasContainer');
        const byCategory = data.byCategory || [];
        const recCategories = byCategory
            .filter((c: any) => c.tipo === 'receita')
            .sort((a: any, b: any) => Number(b.valor || 0) - Number(a.valor || 0));

        if (getEl('cardRel125CountTopReceitas')) {
            getEl('cardRel125CountTopReceitas')!.textContent = `${recCategories.length} tipos`;
        }

        if (topRecContainer) {
            if (recCategories.length === 0) {
                topRecContainer.innerHTML = '<span class="text-gray-400 dark:text-gray-500 text-[11px]">Nenhuma receita no período</span>';
            } else {
                topRecContainer.innerHTML = recCategories.slice(0, 5).map((item: any) => {
                    const pct = totalReceita > 0 ? ((Number(item.valor || 0) / totalReceita) * 100).toFixed(1) : '0.0';
                    return `
                        <div class="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white/70 dark:bg-slate-800/70 border border-emerald-100/80 dark:border-emerald-900/30">
                            <span class="truncate font-medium text-gray-800 dark:text-gray-200" title="${escapeHtml(item.tipoconta)}">
                                ${escapeHtml(item.tipoconta || 'Outras Receitas')}
                            </span>
                            <div class="flex items-center gap-2 shrink-0 ml-2">
                                <span class="text-[10px] text-gray-400 dark:text-gray-500 font-mono">${pct}%</span>
                                <span class="font-bold font-mono text-emerald-600 dark:text-emerald-400">${formatMoney(item.valor)}</span>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // Render Top Despesas Categorias
        const topDespContainer = getEl('cardRel125TopDespesasContainer');
        const despCategories = byCategory
            .filter((c: any) => c.tipo === 'despesa')
            .sort((a: any, b: any) => Number(b.valor || 0) - Number(a.valor || 0));

        if (getEl('cardRel125CountTopDespesas')) {
            getEl('cardRel125CountTopDespesas')!.textContent = `${despCategories.length} tipos`;
        }

        if (topDespContainer) {
            if (despCategories.length === 0) {
                topDespContainer.innerHTML = '<span class="text-gray-400 dark:text-gray-500 text-[11px]">Nenhuma despesa no período</span>';
            } else {
                topDespContainer.innerHTML = despCategories.slice(0, 5).map((item: any) => {
                    const pct = totalDespesa > 0 ? ((Number(item.valor || 0) / totalDespesa) * 100).toFixed(1) : '0.0';
                    return `
                        <div class="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white/70 dark:bg-slate-800/70 border border-rose-100/80 dark:border-rose-900/30">
                            <span class="truncate font-medium text-gray-800 dark:text-gray-200" title="${escapeHtml(item.tipoconta)}">
                                ${escapeHtml(item.tipoconta || 'Outras Despesas')}
                            </span>
                            <div class="flex items-center gap-2 shrink-0 ml-2">
                                <span class="text-[10px] text-gray-400 dark:text-gray-500 font-mono">${pct}%</span>
                                <span class="font-bold font-mono text-rose-600 dark:text-rose-400">${formatMoney(item.valor)}</span>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    };

    // ─── Modal Relatório 125: Populate & Filter ───────────────────────────────
    const populateModalRel125Filters = (data: any) => {
        const tipoContaSelect = getEl<HTMLSelectElement>('modalRel125FilterTipoConta');
        const filialSelect = getEl<HTMLSelectElement>('modalRel125FilterFilial');

        if (tipoContaSelect) {
            const byCategory = data.byCategory || [];
            const uniqueTipos = Array.from(new Set(byCategory.map((c: any) => c.tipoconta).filter(Boolean))).sort();
            tipoContaSelect.innerHTML = '<option value="">Todos os Tipos de Conta</option>' +
                uniqueTipos.map((tc: any) => `<option value="${escapeHtml(tc)}">${escapeHtml(tc)}</option>`).join('');
        }

        if (filialSelect) {
            const filiais = data.filiais || [];
            filialSelect.innerHTML = '<option value="">Todas as Filiais</option>' +
                filiais.map((f: any) => {
                    const fId = typeof f === 'object' ? String(f.id) : String(f);
                    const fNome = typeof f === 'object' ? (f.nome || `Filial ${f.id}`) : `Filial ${f}`;
                    return `<option value="${escapeHtml(fId)}">${escapeHtml(fNome)}</option>`;
                }).join('');
        }
    };

    const renderModalRel125Table = (list: any[]) => {
        const tbody = getEl('modalRel125TableBody');
        if (!tbody) return;

        if (!list || list.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="py-12 text-center text-gray-500 dark:text-gray-400">
                        <div class="flex flex-col items-center justify-center gap-2">
                            <svg class="w-8 h-8 text-gray-400 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            <span class="font-medium">Nenhum lançamento encontrado para os filtros selecionados.</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = list.map((item: any) => {
            const isReceita = item.tipo === 'receita';
            const tipoBadgeClass = isReceita
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40';

            const valorClass = isReceita
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400';

            return `
                <tr class="hover:bg-gray-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td class="py-2.5 px-4 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        ${formatDateBR(item.data)}
                    </td>
                    <td class="py-2.5 px-4 font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap text-[11px]">
                        ${escapeHtml(item.cdcontabaixa || item.id || '-')}
                    </td>
                    <td class="py-2.5 px-4 text-center whitespace-nowrap">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${tipoBadgeClass}">
                            ${isReceita ? 'Receita' : 'Despesa'}
                        </span>
                    </td>
                    <td class="py-2.5 px-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        ${escapeHtml(item.nome_filial || (item.filial ? `Filial ${item.filial}` : '-'))}
                    </td>
                    <td class="py-2.5 px-4 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                        ${escapeHtml(item.tipoconta || '-')}
                    </td>
                    <td class="py-2.5 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        ${escapeHtml(item.conta || item.referencia || '-')}
                    </td>
                    <td class="py-2.5 px-4 text-gray-700 dark:text-gray-300 max-w-xs truncate" title="${escapeHtml(item.historico || item.documento || '')}">
                        ${escapeHtml(item.historico || item.documento || '-')}
                    </td>
                    <td class="py-2.5 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        ${escapeHtml(item.banco || '-')}
                    </td>
                    <td class="py-2.5 px-4 text-right font-mono font-bold ${valorClass} whitespace-nowrap">
                        ${formatMoney(item.valor)}
                    </td>
                </tr>
            `;
        }).join('');
    };

    const applyModalRel125Filters = () => {
        const query = (getEl<HTMLInputElement>('modalRel125Search')?.value || '').toLowerCase().trim();
        const selectedTipo = getEl<HTMLSelectElement>('modalRel125FilterTipo')?.value || 'all';
        const selectedTipoConta = getEl<HTMLSelectElement>('modalRel125FilterTipoConta')?.value || '';
        const selectedFilial = getEl<HTMLSelectElement>('modalRel125FilterFilial')?.value || '';

        const filtered = rawTransactions125.filter((item: any) => {
            if (selectedTipo !== 'all' && item.tipo !== selectedTipo) {
                return false;
            }
            if (selectedTipoConta && item.tipoconta !== selectedTipoConta) {
                return false;
            }
            if (selectedFilial && String(item.filial) !== selectedFilial) {
                return false;
            }
            if (query) {
                const combined = `${item.historico || ''} ${item.documento || ''} ${item.tipoconta || ''} ${item.conta || ''} ${item.referencia || ''} ${item.banco || ''} ${item.cdcontabaixa || ''} ${item.nome_filial || ''}`.toLowerCase();
                if (!combined.includes(query)) return false;
            }
            return true;
        });

        // Update Ribbon Summary
        let sumReceita = 0;
        let sumDespesa = 0;
        filtered.forEach((r: any) => {
            const val = Number(r.valor || 0);
            if (r.tipo === 'receita') sumReceita += val;
            else sumDespesa += val;
        });
        const saldo = sumReceita - sumDespesa;

        if (getEl('modalRel125SummaryReceitas')) {
            getEl('modalRel125SummaryReceitas')!.textContent = formatMoney(sumReceita);
        }
        if (getEl('modalRel125SummaryDespesas')) {
            getEl('modalRel125SummaryDespesas')!.textContent = formatMoney(sumDespesa);
        }
        if (getEl('modalRel125SummarySaldo')) {
            const saldoEl = getEl('modalRel125SummarySaldo')!;
            saldoEl.textContent = formatMoney(saldo);
            saldoEl.className = `font-bold ${saldo >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`;
        }
        if (getEl('modalRel125ItemCount')) {
            getEl('modalRel125ItemCount')!.textContent = `Exibindo ${filtered.length} de ${rawTransactions125.length} lançamentos`;
        }

        renderModalRel125Table(filtered);
    };

    const openModalRel125 = () => {
        const modal = getEl('modalRelatorio125');
        if (!modal) return;

        if (getEl('modalRel125BadgePeriodo')) {
            getEl('modalRel125BadgePeriodo')!.textContent = currentPeriodLabel;
        }

        // Reset search & filters
        if (getEl<HTMLInputElement>('modalRel125Search')) {
            getEl<HTMLInputElement>('modalRel125Search')!.value = '';
        }
        if (getEl<HTMLSelectElement>('modalRel125FilterTipo')) {
            getEl<HTMLSelectElement>('modalRel125FilterTipo')!.value = 'all';
        }
        if (getEl<HTMLSelectElement>('modalRel125FilterTipoConta')) {
            getEl<HTMLSelectElement>('modalRel125FilterTipoConta')!.value = '';
        }
        if (getEl<HTMLSelectElement>('modalRel125FilterFilial')) {
            getEl<HTMLSelectElement>('modalRel125FilterFilial')!.value = '';
        }

        applyModalRel125Filters();
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    };

    const closeModalRel125 = () => {
        const modal = getEl('modalRelatorio125');
        if (!modal) return;
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    };

    const exportRel125Csv = () => {
        if (!rawTransactions125 || rawTransactions125.length === 0) {
            showAlert('Não há lançamentos para exportar.', 'info');
            return;
        }

        const headers = ['Data', 'cdContaBaixa', 'Tipo', 'Filial', 'Tipo de Conta', 'Conta / Referência', 'Histórico / Documento', 'Banco', 'Valor'];
        const rows = rawTransactions125.map((item: any) => [
            formatDateBR(item.data),
            item.cdcontabaixa || item.id || '',
            item.tipo === 'receita' ? '"Receita"' : '"Despesa"',
            `"${(item.nome_filial || `Filial ${item.filial}`).replace(/"/g, '""')}"`,
            `"${(item.tipoconta || '').replace(/"/g, '""')}"`,
            `"${(item.conta || item.referencia || '').replace(/"/g, '""')}"`,
            `"${(item.historico || item.documento || '').replace(/"/g, '""')}"`,
            `"${(item.banco || '').replace(/"/g, '""')}"`,
            Number(item.valor || 0).toFixed(2).replace('.', ',')
        ]);

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio_125_solidcon_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // ─── Load Data Action ─────────────────────────────────────────────────────
    const loadReport = async () => {
        if (isLoading) return;
        isLoading = true;
        hideAlert();

        const filterBtn = getEl<HTMLButtonElement>('btnFilterApply');
        const filterIcon = getEl('btnFilterIcon');
        if (filterBtn) filterBtn.disabled = true;
        if (filterIcon) filterIcon.classList.add('animate-spin');

        updateStatusBadge('loading', 'Consultando...');

        try {
            const companyParam = getEl<HTMLSelectElement>('filterCompany')?.value || '';
            const ano = getEl<HTMLSelectElement>('filterAno')?.value || String(new Date().getFullYear());
            const mes = getEl<HTMLSelectElement>('filterMes')?.value || String(new Date().getMonth() + 1);
            const filial = getEl<HTMLSelectElement>('filterFilial')?.value || '';
            const source = getEl<HTMLSelectElement>('filterSource')?.value || 'conta_baixa';
            const connId = getEl<HTMLSelectElement>('filterConnection')?.value || '';

            currentPeriodLabel = `${String(mes).padStart(2, '0')}/${ano}`;

            // Persist selections
            if (companyParam) localStorage.setItem('rel_valor_empresa_company', companyParam);
            if (ano) localStorage.setItem('rel_valor_empresa_ano', ano);
            if (mes) localStorage.setItem('rel_valor_empresa_mes', mes);
            if (source) localStorage.setItem('rel_valor_empresa_source', source);
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

            if (!data) throw new Error('Estrutura de dados inválida retornada pelo servidor.');

            // Update Filial select if new filiais returned
            if (data.filiais && data.filiais.length > 0) {
                const filialSelect = getEl<HTMLSelectElement>('filterFilial');
                if (filialSelect) {
                    const currentVal = filialSelect.value;
                    const savedFilial = localStorage.getItem(`rel_valor_empresa_filial_${companyParam || 'default'}`);
                    filialSelect.innerHTML = '<option value="">Todas as Filiais</option>';
                    data.filiais.forEach((f: any) => {
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
                getEl('connectionBadge')!.textContent = `• ${compDisplay ? `${compDisplay} | ` : ''}${connDisplay}`;
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

            // Process & Render Relatório 125
            currentRel125Data = data;
            rawTransactions125 = data.transactions || [];

            renderRel125Card(currentRel125Data);
            populateModalRel125Filters(currentRel125Data);

            const totalCartoesLotes = currentCartoesData.summary?.totalLancamentos || 0;
            const total125Lancamentos = rawTransactions125.length;
            updateStatusBadge('success', `Conectado (${total125Lancamentos} lançamentos / ${totalCartoesLotes} cartões)`);
        } catch (err: any) {
            const msg = err?.message || String(err);
            updateStatusBadge('error', 'Falha na Conexão');
            showAlert(`Erro ao carregar dados: ${msg}`, 'error');
        } finally {
            isLoading = false;
            if (filterBtn) filterBtn.disabled = false;
            if (filterIcon) filterIcon.classList.remove('animate-spin');
        }
    };

    // ─── DOMContentLoaded Init ───────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', async () => {
        populateYearDropdown();

        // Set saved or current month in select
        const mesSelect = getEl<HTMLSelectElement>('filterMes');
        if (mesSelect) {
            const savedMes = localStorage.getItem('rel_valor_empresa_mes');
            if (savedMes && mesSelect.querySelector(`option[value="${savedMes}"]`)) {
                mesSelect.value = savedMes;
            } else {
                mesSelect.value = String(new Date().getMonth() + 1);
            }
        }

        // Set saved data source
        const sourceSelect = getEl<HTMLSelectElement>('filterSource');
        if (sourceSelect) {
            const savedSource = localStorage.getItem('rel_valor_empresa_source');
            if (savedSource && sourceSelect.querySelector(`option[value="${savedSource}"]`)) {
                sourceSelect.value = savedSource;
            }
        }

        await loadCompanies();
        const initialCompany = getEl<HTMLSelectElement>('filterCompany')?.value || '';
        await loadSolidconConnections(initialCompany);

        // Filter Form Submissions
        getEl('filterForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            void loadReport();
        });

        getEl('filterCompany')?.addEventListener('change', async () => {
            const selectedCompany = getEl<HTMLSelectElement>('filterCompany')?.value || '';
            localStorage.setItem('rel_valor_empresa_company', selectedCompany);
            await loadSolidconConnections(selectedCompany);
            await loadReport();
        });

        getEl('filterConnection')?.addEventListener('change', () => {
            const companyParam = getEl<HTMLSelectElement>('filterCompany')?.value || '';
            const connVal = getEl<HTMLSelectElement>('filterConnection')?.value || '';
            localStorage.setItem(`rel_valor_empresa_conn_${companyParam || 'default'}`, connVal);
            void loadReport();
        });

        getEl('filterAno')?.addEventListener('change', () => {
            const val = getEl<HTMLSelectElement>('filterAno')?.value || '';
            if (val) localStorage.setItem('rel_valor_empresa_ano', val);
            void loadReport();
        });

        getEl('filterMes')?.addEventListener('change', () => {
            const val = getEl<HTMLSelectElement>('filterMes')?.value || '';
            if (val) localStorage.setItem('rel_valor_empresa_mes', val);
            void loadReport();
        });

        getEl('filterSource')?.addEventListener('change', () => {
            const val = getEl<HTMLSelectElement>('filterSource')?.value || '';
            if (val) localStorage.setItem('rel_valor_empresa_source', val);
            void loadReport();
        });

        getEl('filterFilial')?.addEventListener('change', () => {
            const companyParam = getEl<HTMLSelectElement>('filterCompany')?.value || '';
            const val = getEl<HTMLSelectElement>('filterFilial')?.value || '';
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

        getEl('modalCartoesFilterModalidade')?.addEventListener('change', () => {
            applyModalFilters();
        });

        getEl('modalCartoesFilterFilial')?.addEventListener('change', () => {
            applyModalFilters();
        });

        getEl('btnExportCartoesCsv')?.addEventListener('click', () => {
            exportCartoesCsv();
        });

        // ─── Modal Relatório 125 Listeners ────────────────────────────────────
        getEl('btnOpenModalRel125')?.addEventListener('click', () => {
            openModalRel125();
        });

        getEl('btnCloseModalRel125')?.addEventListener('click', () => {
            closeModalRel125();
        });

        getEl('btnCloseModalRel125Footer')?.addEventListener('click', () => {
            closeModalRel125();
        });

        getEl('modalRelatorio125')?.addEventListener('click', (e) => {
            if (e.target === getEl('modalRelatorio125')) {
                closeModalRel125();
            }
        });

        getEl('modalRel125Search')?.addEventListener('input', () => {
            applyModalRel125Filters();
        });

        getEl('modalRel125FilterTipo')?.addEventListener('change', () => {
            applyModalRel125Filters();
        });

        getEl('modalRel125FilterTipoConta')?.addEventListener('change', () => {
            applyModalRel125Filters();
        });

        getEl('modalRel125FilterFilial')?.addEventListener('change', () => {
            applyModalRel125Filters();
        });

        getEl('btnExportRel125Csv')?.addEventListener('click', () => {
            exportRel125Csv();
        });

        // ─── Global Keyboard Listener (ESC to close any modal) ───────────────
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!getEl('modalCartoesNaoBaixados')?.classList.contains('hidden')) {
                    closeModalCartoes();
                }
                if (!getEl('modalRelatorio125')?.classList.contains('hidden')) {
                    closeModalRel125();
                }
            }
        });

        // Initial fetch
        await loadReport();
    });
})();

