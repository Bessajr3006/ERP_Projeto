(() => {

    interface MonthOverview {
        month: number;
        monthName: string;
        competencia: string;
        entriesCount: number;
        totalDebit: number;
        totalCredit: number;
        difference: number;
        isBalanced: boolean;
        lastImportDate: string | null;
        importStatus: 'imported' | 'divergent' | 'not_imported' | 'closed';
        accountingStatus: 'open' | 'in_progress' | 'closed' | 'audited';
        faturamento: number;
        compras: number;
        pis: number;
        cofins: number;
        icms: number;
        fecp: number;
        iss: number;
        simplesDas: number;
        irpjMensal: number;
        csllMensal: number;
        totalImpostos: number;
        aliquotaEfetiva: number;
        taxStatus: 'open' | 'calculated' | 'closed' | 'paid';
        pisCredito: number;
        cofinsCredito: number;
        icmsCredito: number;
        pisSource: 'sped' | 'accounting' | 'estimated' | 'none';
        cofinsSource: 'sped' | 'accounting' | 'estimated' | 'none';
        icmsSource: 'sped' | 'accounting' | 'estimated' | 'none';
        despesaFolha: number;
        despesaOperacional: number;
        despesaAdm: number;
        despesaCmv: number;
        closedAt: string | null;
        notes: string | null;
    }

    interface QuarterOverview {
        quarter: number;
        quarterName: string;
        months: number[];
        faturamento: number;
        baseIrpj: number;
        irpjNormal: number;
        irpjAdicional: number;
        totalIrpj: number;
        baseCsll: number;
        totalCsll: number;
        totalIrpjCsll: number;
        totalPis: number;
        totalCofins: number;
        totalIcms: number;
        totalFecp: number;
        totalTaxes: number;
        aliquotaEfetiva: number;
        quotas: { number: number; value: number; dueDate: string }[];
        status: 'open' | 'calculated' | 'closed';
        notes: string | null;
    }

    interface SemesterOverview {
        semester: number;
        semesterName: string;
        months: number[];
        faturamento: number;
        compras: number;
        despesasTotais: number;
        totalPis: number;
        totalCofins: number;
        totalIcms: number;
        totalFecp: number;
        totalIrpj: number;
        totalCsll: number;
        totalImpostos: number;
        resultadoBruto: number;
        resultadoOperacional: number;
        margemLiquida: number;
        status: 'open' | 'in_progress' | 'closed';
        notes: string | null;
    }

    interface AnnualOverview {
        year: number;
        faturamentoTotal: number;
        comprasTotais: number;
        despesasTotais: number;
        totalImpostosGeral: number;
        aliquotaEfetivaAnual: number;
        totalLancamentos: number;
        totalDebitos: number;
        totalCreditos: number;
        diferencaContabil: number;
        isBalancedAnual: boolean;
        impostosPorTipo: {
            pis: number;
            cofins: number;
            icms: number;
            fecp: number;
            iss: number;
            simples: number;
            irpj: number;
            csll: number;
            pisCredito: number;
            cofinsCredito: number;
            icmsCredito: number;
        };
        obrigacoes: {
            code: string;
            name: string;
            prazo: string;
            status: 'pending' | 'delivered' | 'waived';
        }[];
        status: 'open' | 'closed' | 'audited';
        notes: string | null;
    }

    interface ClosingData {
        year: number;
        companyId: number;
        summary: {
            importedMonthsCount: number;
            closedMonthsCount: number;
            totalYearRevenue: number;
            totalYearTaxes: number;
            totalYearPis: number;
            totalYearCofins: number;
            totalYearIcms: number;
            totalYearFecp: number;
            totalYearEntries: number;
            isFullyBalanced: boolean;
        };
        months: MonthOverview[];
        quarters: QuarterOverview[];
        semesters: SemesterOverview[];
        annual: AnnualOverview;
    }

    const getById = (id: string): any => document.getElementById(id);

    const formatCurrency = (val: number | null | undefined): string =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    const formatPercent = (val: number | null | undefined): string =>
        `${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

    const formatDate = (isoString: string | null | undefined): string => {
        if (!isoString) return '-';
        try {
            const d = new Date(isoString);
            return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return String(isoString);
        }
    };

    const getSourceBadge = (source: 'sped' | 'accounting' | 'estimated' | 'none', labelCustom?: string): string => {
        if (source === 'sped') {
            return `<span class="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300" title="Apuração oficial SPED Fiscal">SPED</span>`;
        } else if (source === 'accounting') {
            return `<span class="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300" title="Lançamentos contábeis a recolher">Contábil</span>`;
        } else if (source === 'estimated') {
            return `<span class="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300" title="Alíquota presumida s/ receita">${labelCustom || 'Estim.'}</span>`;
        }
        return '';
    };

    document.addEventListener('DOMContentLoaded', async () => {
        if (typeof Auth !== 'undefined' && !Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }

        const currentYear = new Date().getFullYear();
        let selectedYear = currentYear;
        let closingData: ClosingData | null = null;

        // Elements
        const els = {
            selectYear: getById('selectYear') as HTMLSelectElement,
            btnPrevYear: getById('btnPrevYear'),
            btnNextYear: getById('btnNextYear'),
            btnRefresh: getById('btnRefresh'),
            btnPrint: getById('btnPrint'),
            refreshIcon: getById('refreshIcon'),
            alertMessage: getById('alertMessage'),
            loadingOverlay: getById('loadingOverlay'),

            // KPIs
            kpiImportedMonths: getById('kpiImportedMonths'),
            kpiImportStatusBadge: getById('kpiImportStatusBadge'),
            kpiImportedEntries: getById('kpiImportedEntries'),
            kpiAnnualRevenue: getById('kpiAnnualRevenue'),
            kpiAnnualTaxes: getById('kpiAnnualTaxes'),
            kpiEffectiveTaxRate: getById('kpiEffectiveTaxRate'),
            kpiTaxMiniBreakdown: getById('kpiTaxMiniBreakdown'),
            kpiClosedMonths: getById('kpiClosedMonths'),
            kpiAnnualStatus: getById('kpiAnnualStatus'),

            // Tab 2 Quick Summary Mini Cards
            sumIcmsCard: getById('sumIcmsCard'),
            sumPisCard: getById('sumPisCard'),
            sumCofinsCard: getById('sumCofinsCard'),
            sumTotalTaxesCard: getById('sumTotalTaxesCard'),

            // Containers
            monthsGrid: getById('monthsGrid'),
            monthlyTaxesTableBody: getById('monthlyTaxesTableBody'),
            monthlyTaxesTableFoot: getById('monthlyTaxesTableFoot'),
            quartersGrid: getById('quartersGrid'),
            semestersGrid: getById('semestersGrid'),

            // Annual items
            annualHeaderTitle: getById('annualHeaderTitle'),
            btnToggleAnnualStatus: getById('btnToggleAnnualStatus'),
            annualDRE_Revenue: getById('annualDRE_Revenue'),
            annualDRE_Taxes: getById('annualDRE_Taxes'),
            annualDRE_Purchases: getById('annualDRE_Purchases'),
            annualDRE_Expenses: getById('annualDRE_Expenses'),
            annualDRE_NetResult: getById('annualDRE_NetResult'),

            annualTax_Icms: getById('annualTax_Icms'),
            annualTax_Pis: getById('annualTax_Pis'),
            annualTax_Cofins: getById('annualTax_Cofins'),
            annualTax_IrpjCsll: getById('annualTax_IrpjCsll'),
            annualTax_Total: getById('annualTax_Total'),
            annualTax_Credits: getById('annualTax_Credits'),

            annualAudit_Debit: getById('annualAudit_Debit'),
            annualAudit_Credit: getById('annualAudit_Credit'),
            annualAudit_Diff: getById('annualAudit_Diff'),
            annualAudit_Count: getById('annualAudit_Count'),
            annualAudit_StatusBadge: getById('annualAudit_StatusBadge'),
            annualObligationsList: getById('annualObligationsList'),

            // Modal
            modalStatus: getById('modalStatus'),
            modalStatusTitle: getById('modalStatusTitle'),
            formModalStatus: getById('formModalStatus'),
            modalPeriodType: getById('modalPeriodType'),
            modalPeriodNumber: getById('modalPeriodNumber'),
            modalYear: getById('modalYear'),
            modalAccountingStatus: getById('modalAccountingStatus'),
            modalTaxStatus: getById('modalTaxStatus'),
            modalNotes: getById('modalNotes'),
            btnCloseModalStatus: getById('btnCloseModalStatus'),
            btnCancelModalStatus: getById('btnCancelModalStatus')
        };

        // Populate Years (Current Year - 4 up to Current Year + 2)
        function initYears() {
            if (!els.selectYear) return;
            els.selectYear.innerHTML = '';
            for (let y = currentYear + 2; y >= currentYear - 4; y--) {
                const opt = document.createElement('option');
                opt.value = String(y);
                opt.textContent = `Exercício ${y}`;
                if (y === selectedYear) opt.selected = true;
                els.selectYear.appendChild(opt);
            }
        }

        // Setup Tab Navigation
        function setupTabs() {
            const tabButtons = document.querySelectorAll<HTMLButtonElement>('.tab-button');
            const tabContents = document.querySelectorAll<HTMLElement>('.tab-content');

            tabButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const targetId = btn.getAttribute('data-target');
                    if (!targetId) return;

                    tabButtons.forEach(b => {
                        b.setAttribute('aria-selected', 'false');
                        b.className = 'tab-button inline-flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border-transparent transition-colors';
                    });

                    btn.setAttribute('aria-selected', 'true');
                    btn.className = 'tab-button inline-flex items-center gap-2 py-3 px-1 border-b-2 font-bold text-sm text-brand-600 dark:text-brand-400 border-brand-600 dark:border-brand-400 transition-colors';

                    tabContents.forEach(content => {
                        if (content.id === targetId) {
                            content.classList.remove('hidden');
                        } else {
                            content.classList.add('hidden');
                        }
                    });
                });
            });
        }

        // Show/Hide Alert Message
        function showAlert(msg: string, type: 'success' | 'error' | 'info' = 'info') {
            if (!els.alertMessage) return;
            els.alertMessage.classList.remove('hidden', 'bg-emerald-50', 'text-emerald-800', 'border-emerald-200', 'bg-red-50', 'text-red-800', 'border-red-200', 'bg-blue-50', 'text-blue-800', 'border-blue-200');
            
            if (type === 'success') {
                els.alertMessage.classList.add('bg-emerald-50', 'text-emerald-800', 'border-emerald-200', 'dark:bg-emerald-950/40', 'dark:text-emerald-300', 'dark:border-emerald-800');
            } else if (type === 'error') {
                els.alertMessage.classList.add('bg-red-50', 'text-red-800', 'border-red-200', 'dark:bg-red-950/40', 'dark:text-red-300', 'dark:border-red-800');
            } else {
                els.alertMessage.classList.add('bg-blue-50', 'text-blue-800', 'border-blue-200', 'dark:bg-blue-950/40', 'dark:text-blue-300', 'dark:border-blue-800');
            }
            els.alertMessage.textContent = msg;
            setTimeout(() => {
                els.alertMessage?.classList.add('hidden');
            }, 6000);
        }

        // Load Data from Backend
        async function loadOverview() {
            if (els.loadingOverlay) els.loadingOverlay.classList.remove('hidden');
            if (els.refreshIcon) els.refreshIcon.classList.add('animate-spin');

            try {
                const res = await api(`/accounting/closings/overview?year=${selectedYear}`);
                if (res && res.status === 'success' && res.data) {
                    closingData = res.data;
                    renderAll();
                } else {
                    showAlert(res?.message || 'Não foi possível carregar os dados de fechamento.', 'error');
                }
            } catch (err: any) {
                console.error('Erro ao carregar fechamento:', err);
                showAlert(err?.message || 'Erro ao comunicar com o servidor.', 'error');
            } finally {
                if (els.loadingOverlay) els.loadingOverlay.classList.add('hidden');
                if (els.refreshIcon) els.refreshIcon.classList.remove('animate-spin');
            }
        }

        // Main Render Function
        function renderAll() {
            if (!closingData) return;

            renderKPIs();
            renderTab1ImportedMonths();
            renderTab2MonthlyTaxes();
            renderTab3QuarterlyTaxes();
            renderTab4SemiannualAndAnnual();
        }

        // 1. Render KPIs
        function renderKPIs() {
            if (!closingData) return;
            const { summary } = closingData;

            if (els.kpiImportedMonths) {
                els.kpiImportedMonths.textContent = `${summary.importedMonthsCount} / 12`;
            }
            if (els.kpiImportStatusBadge) {
                if (summary.importedMonthsCount === 12) {
                    els.kpiImportStatusBadge.textContent = '100% Importado';
                    els.kpiImportStatusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
                } else if (summary.importedMonthsCount > 0) {
                    els.kpiImportStatusBadge.textContent = `${Math.round((summary.importedMonthsCount / 12) * 100)}% Concluído`;
                    els.kpiImportStatusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
                } else {
                    els.kpiImportStatusBadge.textContent = 'Pendente';
                    els.kpiImportStatusBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
                }
            }
            if (els.kpiImportedEntries) {
                els.kpiImportedEntries.textContent = `${summary.totalYearEntries.toLocaleString('pt-BR')} Lançamentos Contábeis`;
            }
            if (els.kpiAnnualRevenue) {
                els.kpiAnnualRevenue.textContent = formatCurrency(summary.totalYearRevenue);
            }
            if (els.kpiAnnualTaxes) {
                els.kpiAnnualTaxes.textContent = formatCurrency(summary.totalYearTaxes);
            }
            if (els.kpiEffectiveTaxRate) {
                const effRate = summary.totalYearRevenue > 0 ? (summary.totalYearTaxes / summary.totalYearRevenue) * 100 : 0;
                els.kpiEffectiveTaxRate.textContent = `Alíq: ${formatPercent(effRate)}`;
            }
            if (els.kpiTaxMiniBreakdown) {
                els.kpiTaxMiniBreakdown.textContent = `ICMS ${formatCurrency(summary.totalYearIcms)} | PIS/COF ${formatCurrency((summary.totalYearPis || 0) + (summary.totalYearCofins || 0))}`;
            }
            if (els.kpiClosedMonths) {
                els.kpiClosedMonths.textContent = `${summary.closedMonthsCount} Fechados`;
            }
            if (els.kpiAnnualStatus) {
                if (closingData.annual.status === 'closed' || closingData.annual.status === 'audited') {
                    els.kpiAnnualStatus.textContent = 'Exercício Encerrado';
                    els.kpiAnnualStatus.className = 'text-xs font-semibold text-emerald-600 dark:text-emerald-400 block';
                } else {
                    els.kpiAnnualStatus.textContent = `${12 - summary.closedMonthsCount} Meses em Aberto`;
                    els.kpiAnnualStatus.className = 'text-xs font-semibold text-gray-500 dark:text-gray-400 block';
                }
            }
        }

        // 2. Render Tab 1: 12 Month Cards (com PIS, COFINS, ICMS detalhados)
        function renderTab1ImportedMonths() {
            if (!closingData || !els.monthsGrid) return;
            els.monthsGrid.innerHTML = '';

            closingData.months.forEach(m => {
                const card = document.createElement('div');
                card.className = 'bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-4 flex flex-col justify-between transition-all hover:border-brand-500/50 dark:hover:border-brand-400/50';

                // Status Badge
                let statusBadgeHtml = '';
                if (m.accountingStatus === 'closed' || m.accountingStatus === 'audited') {
                    statusBadgeHtml = `<span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                        Fechado
                    </span>`;
                } else if (m.entriesCount > 0) {
                    statusBadgeHtml = `<span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                        Importado
                    </span>`;
                } else {
                    statusBadgeHtml = `<span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        Pendente
                    </span>`;
                }

                // Balance indicator
                const balanceHtml = m.entriesCount > 0
                    ? `<span class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                        Balanço D = C (${formatCurrency(m.totalDebit)})
                       </span>`
                    : `<span class="text-[11px] text-gray-400 dark:text-gray-500">Sem movimentação contábil</span>`;

                const lastDay = new Date(selectedYear, m.month, 0).getDate();
                const startDateStr = `${selectedYear}-${String(m.month).padStart(2, '0')}-01`;
                const endDateStr = `${selectedYear}-${String(m.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

                const pisBadge = getSourceBadge(m.pisSource, '0,65%');
                const cofinsBadge = getSourceBadge(m.cofinsSource, '3,00%');
                const icmsBadge = getSourceBadge(m.icmsSource);

                card.innerHTML = `
                    <div>
                        <div class="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-2.5 mb-2.5">
                            <div class="flex items-center gap-2">
                                <span class="w-6 h-6 rounded-md bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 font-black text-xs flex items-center justify-center">${String(m.month).padStart(2, '0')}</span>
                                <h4 class="text-sm font-bold text-gray-900 dark:text-white">${m.monthName}</h4>
                            </div>
                            ${statusBadgeHtml}
                        </div>

                        <div class="space-y-1.5 text-xs">
                            <div class="flex justify-between py-0.5">
                                <span class="text-gray-500 dark:text-gray-400">Lançamentos / Faturamento:</span>
                                <span class="font-bold text-gray-900 dark:text-white">${m.entriesCount.toLocaleString('pt-BR')} lcts | ${formatCurrency(m.faturamento)}</span>
                            </div>

                            <!-- Box de Tributos: PIS, COFINS, ICMS -->
                            <div class="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-2.5 border border-gray-100 dark:border-slate-700/60 space-y-1">
                                <div class="flex justify-between items-center text-[11px]">
                                    <span class="text-gray-600 dark:text-gray-400 flex items-center gap-1">PIS ${pisBadge}:</span>
                                    <span class="font-bold text-emerald-600 dark:text-emerald-400">${formatCurrency(m.pis)}</span>
                                </div>
                                <div class="flex justify-between items-center text-[11px]">
                                    <span class="text-gray-600 dark:text-gray-400 flex items-center gap-1">COFINS ${cofinsBadge}:</span>
                                    <span class="font-bold text-amber-600 dark:text-amber-400">${formatCurrency(m.cofins)}</span>
                                </div>
                                <div class="flex justify-between items-center text-[11px]">
                                    <span class="text-gray-600 dark:text-gray-400 flex items-center gap-1">ICMS ${icmsBadge}:</span>
                                    <span class="font-bold text-blue-600 dark:text-blue-400">${formatCurrency(m.icms)}</span>
                                </div>
                                ${m.fecp > 0 ? `
                                <div class="flex justify-between items-center text-[11px]">
                                    <span class="text-gray-600 dark:text-gray-400">FECP:</span>
                                    <span class="font-bold text-gray-700 dark:text-gray-300">${formatCurrency(m.fecp)}</span>
                                </div>` : ''}
                                <div class="pt-1 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center text-xs font-black">
                                    <span class="text-gray-800 dark:text-gray-200">Total Impostos:</span>
                                    <span class="text-brand-600 dark:text-brand-400">${formatCurrency(m.totalImpostos)}</span>
                                </div>
                            </div>

                            <div class="pt-1.5 flex justify-between items-center">
                                ${balanceHtml}
                            </div>
                            <div class="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                                Sincronização: ${formatDate(m.lastImportDate)}
                            </div>
                        </div>
                    </div>

                    <div class="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-700 flex items-center gap-2">
                        <a href="/pages/accounting_entries.html?startDate=${startDateStr}&endDate=${endDateStr}" class="flex-1 text-center px-2 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors" title="Ver lançamentos deste mês">
                            Ver Lançamentos
                        </a>
                        <button type="button" class="btn-open-status px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors" data-period-type="monthly" data-period-num="${m.month}" data-acc-status="${m.accountingStatus}" data-tax-status="${m.taxStatus}" data-notes="${encodeURIComponent(m.notes || '')}">
                            ${m.accountingStatus === 'closed' ? 'Reabrir' : 'Fechar'}
                        </button>
                    </div>
                `;

                els.monthsGrid.appendChild(card);
            });

            attachStatusButtons();
        }

        // 3. Render Tab 2: Monthly Taxes Table (com PIS, COFINS, ICMS destacados)
        function renderTab2MonthlyTaxes() {
            if (!closingData || !els.monthlyTaxesTableBody || !els.monthlyTaxesTableFoot) return;
            els.monthlyTaxesTableBody.innerHTML = '';
            els.monthlyTaxesTableFoot.innerHTML = '';

            let sumFat = 0;
            let sumPis = 0;
            let sumCofins = 0;
            let sumIcms = 0;
            let sumFecp = 0;
            let sumIssSimples = 0;
            let sumTotalTaxes = 0;

            closingData.months.forEach(m => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors';

                const issOrSimples = m.simplesDas > 0 ? m.simplesDas : m.iss;

                sumFat += m.faturamento;
                sumPis += m.pis;
                sumCofins += m.cofins;
                sumIcms += m.icms;
                sumFecp += m.fecp;
                sumIssSimples += issOrSimples;
                sumTotalTaxes += m.totalImpostos;

                let taxBadge = '';
                if (m.taxStatus === 'closed' || m.taxStatus === 'paid') {
                    taxBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">Fechado</span>`;
                } else if (m.taxStatus === 'calculated') {
                    taxBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">Apurado</span>`;
                } else {
                    taxBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300">Aberto</span>`;
                }

                const pisPill = getSourceBadge(m.pisSource, '0,65%');
                const cofinsPill = getSourceBadge(m.cofinsSource, '3,00%');
                const icmsPill = getSourceBadge(m.icmsSource);

                tr.innerHTML = `
                    <td class="px-3 py-2.5 font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <span class="w-5 h-5 rounded bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-[10px] flex items-center justify-center font-bold">${String(m.month).padStart(2, '0')}</span>
                        ${m.monthName}
                    </td>
                    <td class="px-3 py-2.5 text-right font-semibold text-gray-900 dark:text-white">${formatCurrency(m.faturamento)}</td>
                    <td class="px-3 py-2.5 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                        ${formatCurrency(m.pis)} ${pisPill}
                    </td>
                    <td class="px-3 py-2.5 text-right text-amber-600 dark:text-amber-400 font-bold">
                        ${formatCurrency(m.cofins)} ${cofinsPill}
                    </td>
                    <td class="px-3 py-2.5 text-right text-blue-600 dark:text-blue-400 font-bold">
                        ${formatCurrency(m.icms)} ${icmsPill}
                    </td>
                    <td class="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300">${formatCurrency(m.fecp)}</td>
                    <td class="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300">${formatCurrency(issOrSimples)}</td>
                    <td class="px-3 py-2.5 text-right font-black text-brand-600 dark:text-brand-400 bg-brand-50/40 dark:bg-brand-900/10">${formatCurrency(m.totalImpostos)}</td>
                    <td class="px-3 py-2.5 text-center font-bold ${m.aliquotaEfetiva > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}">${formatPercent(m.aliquotaEfetiva)}</td>
                    <td class="px-3 py-2.5 text-center">${taxBadge}</td>
                    <td class="px-3 py-2.5 text-center">
                        <button type="button" class="btn-open-status text-xs text-brand-600 dark:text-brand-400 hover:underline font-bold" data-period-type="monthly" data-period-num="${m.month}" data-acc-status="${m.accountingStatus}" data-tax-status="${m.taxStatus}" data-notes="${encodeURIComponent(m.notes || '')}">
                            Alterar
                        </button>
                    </td>
                `;

                els.monthlyTaxesTableBody.appendChild(tr);
            });

            // Update Tab 2 mini cards
            if (els.sumIcmsCard) els.sumIcmsCard.textContent = formatCurrency(sumIcms);
            if (els.sumPisCard) els.sumPisCard.textContent = formatCurrency(sumPis);
            if (els.sumCofinsCard) els.sumCofinsCard.textContent = formatCurrency(sumCofins);
            if (els.sumTotalTaxesCard) els.sumTotalTaxesCard.textContent = formatCurrency(sumTotalTaxes);

            const overallEffRate = sumFat > 0 ? (sumTotalTaxes / sumFat) * 100 : 0;

            els.monthlyTaxesTableFoot.innerHTML = `
                <tr>
                    <td class="px-3 py-3 uppercase text-gray-900 dark:text-white">Total Geral (${selectedYear})</td>
                    <td class="px-3 py-3 text-right text-emerald-600 dark:text-emerald-400 font-black">${formatCurrency(sumFat)}</td>
                    <td class="px-3 py-3 text-right text-emerald-600 dark:text-emerald-400 font-black">${formatCurrency(sumPis)}</td>
                    <td class="px-3 py-3 text-right text-amber-600 dark:text-amber-400 font-black">${formatCurrency(sumCofins)}</td>
                    <td class="px-3 py-3 text-right text-blue-600 dark:text-blue-400 font-black">${formatCurrency(sumIcms)}</td>
                    <td class="px-3 py-3 text-right text-gray-900 dark:text-white font-bold">${formatCurrency(sumFecp)}</td>
                    <td class="px-3 py-3 text-right text-gray-900 dark:text-white font-bold">${formatCurrency(sumIssSimples)}</td>
                    <td class="px-3 py-3 text-right text-brand-600 dark:text-brand-400 font-black bg-brand-100/50 dark:bg-brand-900/30">${formatCurrency(sumTotalTaxes)}</td>
                    <td class="px-3 py-3 text-center text-amber-600 dark:text-amber-400 font-black">${formatPercent(overallEffRate)}</td>
                    <td colspan="2"></td>
                </tr>
            `;

            attachStatusButtons();
        }

        // 4. Render Tab 3: Quarterly Taxes Cards (com IRPJ, CSLL, PIS, COFINS, ICMS)
        function renderTab3QuarterlyTaxes() {
            if (!closingData || !els.quartersGrid) return;
            els.quartersGrid.innerHTML = '';

            closingData.quarters.forEach(q => {
                const card = document.createElement('div');
                card.className = 'bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-5 flex flex-col justify-between';

                let statusBadge = '';
                if (q.status === 'closed') {
                    statusBadge = `<span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">Fechado</span>`;
                } else if (q.status === 'calculated') {
                    statusBadge = `<span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">Apurado</span>`;
                } else {
                    statusBadge = `<span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300">Em Aberto</span>`;
                }

                const quotasHtml = q.quotas.map(qt => `
                    <div class="flex justify-between items-center text-xs py-1 border-b border-gray-50 dark:border-slate-700/50">
                        <span class="text-gray-600 dark:text-gray-400">${qt.number}ª Quota IRPJ/CSLL (Venc. ${qt.dueDate}):</span>
                        <span class="font-bold text-gray-900 dark:text-white">${formatCurrency(qt.value)}</span>
                    </div>
                `).join('');

                card.innerHTML = `
                    <div class="space-y-3">
                        <div class="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-3">
                            <div class="flex items-center gap-2">
                                <span class="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold text-xs">Q${q.quarter}</span>
                                <h4 class="text-base font-bold text-gray-900 dark:text-white">${q.quarterName}</h4>
                            </div>
                            ${statusBadge}
                        </div>

                        <div class="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-slate-900/40 rounded-xl p-3 border border-gray-100 dark:border-slate-700/60">
                            <div>
                                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Faturamento do Trimestre</span>
                                <span class="text-sm font-black text-emerald-600 dark:text-emerald-400">${formatCurrency(q.faturamento)}</span>
                            </div>
                            <div>
                                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Carga Total do Trimestre</span>
                                <span class="text-sm font-black text-brand-600 dark:text-brand-400">${formatCurrency(q.totalTaxes)}</span>
                            </div>
                        </div>

                        <!-- Detalhamento de Tributos do Trimestre -->
                        <div class="space-y-1.5 text-xs">
                            <div class="flex justify-between py-0.5">
                                <span class="text-gray-500 dark:text-gray-400">Total PIS no Trimestre:</span>
                                <span class="font-bold text-emerald-600 dark:text-emerald-400">${formatCurrency(q.totalPis)}</span>
                            </div>
                            <div class="flex justify-between py-0.5">
                                <span class="text-gray-500 dark:text-gray-400">Total COFINS no Trimestre:</span>
                                <span class="font-bold text-amber-600 dark:text-amber-400">${formatCurrency(q.totalCofins)}</span>
                            </div>
                            <div class="flex justify-between py-0.5">
                                <span class="text-gray-500 dark:text-gray-400">Total ICMS (+ FECP) no Trimestre:</span>
                                <span class="font-bold text-blue-600 dark:text-blue-400">${formatCurrency(q.totalIcms + q.totalFecp)}</span>
                            </div>
                            <div class="flex justify-between py-0.5 border-t border-gray-100 dark:border-slate-700">
                                <span class="text-gray-500 dark:text-gray-400">IRPJ Presumido (Normal + Adic.):</span>
                                <span class="font-semibold text-gray-900 dark:text-white">${formatCurrency(q.totalIrpj)}</span>
                            </div>
                            <div class="flex justify-between py-0.5">
                                <span class="text-gray-500 dark:text-gray-400">CSLL Presumida (12% base / 9%):</span>
                                <span class="font-semibold text-gray-900 dark:text-white">${formatCurrency(q.totalCsll)}</span>
                            </div>
                            <div class="flex justify-between py-0.5 border-t border-gray-100 dark:border-slate-700 font-black text-indigo-600 dark:text-indigo-400">
                                <span>Total IRPJ + CSLL:</span>
                                <span>${formatCurrency(q.totalIrpjCsll)}</span>
                            </div>
                        </div>

                        <!-- Simulação de Quotas IRPJ/CSLL -->
                        <div class="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Simulação de Pagamento IRPJ/CSLL em 3 Quotas</span>
                            ${quotasHtml}
                        </div>
                    </div>

                    <div class="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700 flex justify-end">
                        <button type="button" class="btn-open-status px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors" data-period-type="quarterly" data-period-num="${q.quarter}" data-acc-status="open" data-tax-status="${q.status}" data-notes="${encodeURIComponent(q.notes || '')}">
                            ${q.status === 'closed' ? 'Reabrir Trimestre' : 'Fechar Trimestre'}
                        </button>
                    </div>
                `;

                els.quartersGrid.appendChild(card);
            });

            attachStatusButtons();
        }

        // 5. Render Tab 4: Semiannual & Annual Closing
        function renderTab4SemiannualAndAnnual() {
            if (!closingData) return;

            // Semesters
            if (els.semestersGrid) {
                els.semestersGrid.innerHTML = '';
                closingData.semesters.forEach(s => {
                    const card = document.createElement('div');
                    card.className = 'bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-4 flex flex-col justify-between';

                    let statusBadge = '';
                    if (s.status === 'closed') {
                        statusBadge = `<span class="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">Fechado</span>`;
                    } else {
                        statusBadge = `<span class="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">Em Aberto</span>`;
                    }

                    card.innerHTML = `
                        <div>
                            <div class="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-2.5 mb-3">
                                <h4 class="text-sm font-bold text-gray-900 dark:text-white">${s.semesterName}</h4>
                                ${statusBadge}
                            </div>
                            <div class="space-y-1.5 text-xs">
                                <div class="flex justify-between py-0.5">
                                    <span class="text-gray-500 dark:text-gray-400">Receita Bruta Semestral:</span>
                                    <span class="font-bold text-emerald-600 dark:text-emerald-400">${formatCurrency(s.faturamento)}</span>
                                </div>
                                <div class="flex justify-between py-0.5">
                                    <span class="text-gray-500 dark:text-gray-400">Compras / CMV:</span>
                                    <span class="font-bold text-gray-700 dark:text-gray-300">${formatCurrency(s.compras)}</span>
                                </div>
                                <div class="flex justify-between py-0.5">
                                    <span class="text-gray-500 dark:text-gray-400">PIS + COFINS no Semestre:</span>
                                    <span class="font-semibold text-gray-800 dark:text-gray-200">${formatCurrency(s.totalPis + s.totalCofins)}</span>
                                </div>
                                <div class="flex justify-between py-0.5">
                                    <span class="text-gray-500 dark:text-gray-400">ICMS (+ FECP) no Semestre:</span>
                                    <span class="font-semibold text-gray-800 dark:text-gray-200">${formatCurrency(s.totalIcms + s.totalFecp)}</span>
                                </div>
                                <div class="flex justify-between py-0.5">
                                    <span class="text-gray-500 dark:text-gray-400">IRPJ + CSLL no Semestre:</span>
                                    <span class="font-semibold text-gray-800 dark:text-gray-200">${formatCurrency(s.totalIrpj + s.totalCsll)}</span>
                                </div>
                                <div class="flex justify-between py-0.5 border-t border-gray-100 dark:border-slate-700">
                                    <span class="text-gray-500 dark:text-gray-400">Total Tributos Semestrais:</span>
                                    <span class="font-bold text-amber-600 dark:text-amber-400">${formatCurrency(s.totalImpostos)}</span>
                                </div>
                                <div class="flex justify-between py-1.5 border-t border-gray-100 dark:border-slate-700 font-bold">
                                    <span class="text-gray-900 dark:text-white">Resultado Operacional Estimado:</span>
                                    <span class="text-purple-600 dark:text-purple-400">${formatCurrency(s.resultadoOperacional)}</span>
                                </div>
                                <div class="flex justify-between py-0.5">
                                    <span class="text-gray-500 dark:text-gray-400">Margem Líquida:</span>
                                    <span class="font-bold text-gray-900 dark:text-white">${formatPercent(s.margemLiquida)}</span>
                                </div>
                            </div>
                        </div>

                        <div class="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700 flex justify-end">
                            <button type="button" class="btn-open-status px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition-colors" data-period-type="semiannual" data-period-num="${s.semester}" data-acc-status="${s.status}" data-tax-status="open" data-notes="${encodeURIComponent(s.notes || '')}">
                                ${s.status === 'closed' ? 'Reabrir Semestre' : 'Fechar Semestre'}
                            </button>
                        </div>
                    `;

                    els.semestersGrid.appendChild(card);
                });
            }

            // Annual DRE and Balanço
            const { annual } = closingData;
            if (els.annualHeaderTitle) {
                els.annualHeaderTitle.textContent = `Fechamento do Exercício Anual — ${selectedYear}`;
            }
            if (els.annualDRE_Revenue) els.annualDRE_Revenue.textContent = formatCurrency(annual.faturamentoTotal);
            if (els.annualDRE_Taxes) els.annualDRE_Taxes.textContent = `-${formatCurrency(annual.totalImpostosGeral)}`;
            if (els.annualDRE_Purchases) els.annualDRE_Purchases.textContent = `-${formatCurrency(annual.comprasTotais)}`;
            if (els.annualDRE_Expenses) els.annualDRE_Expenses.textContent = `-${formatCurrency(annual.despesasTotais)}`;
            
            const netAnnual = annual.faturamentoTotal - annual.comprasTotais - annual.despesasTotais - annual.totalImpostosGeral;
            if (els.annualDRE_NetResult) els.annualDRE_NetResult.textContent = formatCurrency(netAnnual);

            // Tributos Consolidados Card
            if (els.annualTax_Icms) els.annualTax_Icms.textContent = formatCurrency(annual.impostosPorTipo.icms);
            if (els.annualTax_Pis) els.annualTax_Pis.textContent = formatCurrency(annual.impostosPorTipo.pis);
            if (els.annualTax_Cofins) els.annualTax_Cofins.textContent = formatCurrency(annual.impostosPorTipo.cofins);
            if (els.annualTax_IrpjCsll) els.annualTax_IrpjCsll.textContent = formatCurrency((annual.impostosPorTipo.irpj || 0) + (annual.impostosPorTipo.csll || 0));
            if (els.annualTax_Total) els.annualTax_Total.textContent = formatCurrency(annual.totalImpostosGeral);
            if (els.annualTax_Credits) {
                const totalCred = (annual.impostosPorTipo.pisCredito || 0) + (annual.impostosPorTipo.cofinsCredito || 0) + (annual.impostosPorTipo.icmsCredito || 0);
                els.annualTax_Credits.textContent = `Créditos s/ compras: ${formatCurrency(totalCred)}`;
            }

            if (els.annualAudit_Debit) els.annualAudit_Debit.textContent = formatCurrency(annual.totalDebitos);
            if (els.annualAudit_Credit) els.annualAudit_Credit.textContent = formatCurrency(annual.totalCreditos);
            if (els.annualAudit_Diff) els.annualAudit_Diff.textContent = formatCurrency(annual.diferencaContabil);
            if (els.annualAudit_Count) els.annualAudit_Count.textContent = annual.totalLancamentos.toLocaleString('pt-BR');

            if (els.annualAudit_StatusBadge) {
                if (annual.isBalancedAnual) {
                    els.annualAudit_StatusBadge.textContent = 'Balanço Equilibrado (D = C)';
                    els.annualAudit_StatusBadge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
                } else if (annual.totalLancamentos === 0) {
                    els.annualAudit_StatusBadge.textContent = 'Sem Lançamentos no Ano';
                    els.annualAudit_StatusBadge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300';
                } else {
                    els.annualAudit_StatusBadge.textContent = 'Divergência Contábil';
                    els.annualAudit_StatusBadge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
                }
            }

            // Obligations
            if (els.annualObligationsList) {
                els.annualObligationsList.innerHTML = '';
                annual.obrigacoes.forEach(ob => {
                    const li = document.createElement('li');
                    li.className = 'flex items-center justify-between py-1 border-b border-gray-100 dark:border-slate-700/60';
                    li.innerHTML = `
                        <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full ${ob.status === 'delivered' ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
                            <span class="font-semibold text-gray-800 dark:text-gray-200">${ob.name}</span>
                        </div>
                        <span class="text-gray-500 dark:text-gray-400 font-mono text-[11px]">Prazo: ${ob.prazo}</span>
                    `;
                    els.annualObligationsList.appendChild(li);
                });
            }

            // Annual toggle button listener
            if (els.btnToggleAnnualStatus) {
                els.btnToggleAnnualStatus.onclick = () => {
                    openModalStatus('annual', 1, annual.status, 'open', annual.notes || '');
                };
            }

            attachStatusButtons();
        }

        // Attach Click Listeners to Status Buttons
        function attachStatusButtons() {
            const buttons = document.querySelectorAll<HTMLButtonElement>('.btn-open-status');
            buttons.forEach(btn => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    const periodType = btn.getAttribute('data-period-type') as any || 'monthly';
                    const periodNum = Number(btn.getAttribute('data-period-num')) || 1;
                    const accStatus = btn.getAttribute('data-acc-status') || 'open';
                    const taxStatus = btn.getAttribute('data-tax-status') || 'open';
                    const rawNotes = btn.getAttribute('data-notes') || '';
                    const notes = decodeURIComponent(rawNotes);

                    openModalStatus(periodType, periodNum, accStatus, taxStatus, notes);
                };
            });
        }

        // Modal Open
        function openModalStatus(periodType: string, periodNum: number, accStatus: string, taxStatus: string, notes: string) {
            if (!els.modalStatus) return;

            let title = '';
            if (periodType === 'monthly') {
                const monthName = closingData?.months.find(m => m.month === periodNum)?.monthName || `Mês ${periodNum}`;
                title = `Fechamento Contábil & Fiscal — ${monthName}/${selectedYear}`;
            } else if (periodType === 'quarterly') {
                title = `Fechamento do ${periodNum}º Trimestre/${selectedYear}`;
            } else if (periodType === 'semiannual') {
                title = `Fechamento do ${periodNum}º Semestre/${selectedYear}`;
            } else {
                title = `Encerramento do Exercício Anual — ${selectedYear}`;
            }

            if (els.modalStatusTitle) els.modalStatusTitle.textContent = title;
            if (els.modalPeriodType) els.modalPeriodType.value = periodType;
            if (els.modalPeriodNumber) els.modalPeriodNumber.value = String(periodNum);
            if (els.modalYear) els.modalYear.value = String(selectedYear);
            if (els.modalAccountingStatus) els.modalAccountingStatus.value = accStatus;
            if (els.modalTaxStatus) els.modalTaxStatus.value = taxStatus;
            if (els.modalNotes) els.modalNotes.value = notes || '';

            els.modalStatus.classList.remove('hidden');
            els.modalStatus.classList.add('flex');
        }

        // Modal Close
        function closeModalStatus() {
            if (els.modalStatus) {
                els.modalStatus.classList.add('hidden');
                els.modalStatus.classList.remove('flex');
            }
        }

        if (els.btnCloseModalStatus) els.btnCloseModalStatus.onclick = closeModalStatus;
        if (els.btnCancelModalStatus) els.btnCancelModalStatus.onclick = closeModalStatus;

        // Modal Form Submit
        if (els.formModalStatus) {
            els.formModalStatus.onsubmit = async (e: Event) => {
                e.preventDefault();
                const periodType = els.modalPeriodType.value;
                const periodNumber = Number(els.modalPeriodNumber.value);
                const year = Number(els.modalYear.value);
                const accountingStatus = els.modalAccountingStatus.value;
                const taxStatus = els.modalTaxStatus.value;
                const notes = els.modalNotes.value;

                try {
                    const res = await api('/accounting/closings/toggle-status', {
                        method: 'POST',
                        body: JSON.stringify({
                            periodType,
                            year,
                            periodNumber,
                            accountingStatus,
                            taxStatus,
                            notes
                        })
                    });

                    if (res && res.status === 'success') {
                        showAlert('Status de fechamento atualizado com sucesso!', 'success');
                        closeModalStatus();
                        await loadOverview();
                    } else {
                        showAlert(res?.message || 'Erro ao atualizar status', 'error');
                    }
                } catch (err: any) {
                    console.error('Erro ao salvar status:', err);
                    showAlert(err?.message || 'Erro ao salvar alterações.', 'error');
                }
            };
        }

        // Year Change Handlers
        if (els.selectYear) {
            els.selectYear.addEventListener('change', () => {
                selectedYear = Number(els.selectYear.value);
                loadOverview();
            });
        }

        if (els.btnPrevYear) {
            els.btnPrevYear.addEventListener('click', () => {
                selectedYear--;
                if (els.selectYear) els.selectYear.value = String(selectedYear);
                loadOverview();
            });
        }

        if (els.btnNextYear) {
            els.btnNextYear.addEventListener('click', () => {
                selectedYear++;
                if (els.selectYear) els.selectYear.value = String(selectedYear);
                loadOverview();
            });
        }

        if (els.btnRefresh) {
            els.btnRefresh.addEventListener('click', () => {
                loadOverview();
            });
        }

        if (els.btnPrint) {
            els.btnPrint.addEventListener('click', () => {
                window.print();
            });
        }

        // Initialize Page
        initYears();
        setupTabs();
        await loadOverview();
    });
})();
