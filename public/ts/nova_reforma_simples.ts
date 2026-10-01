// @ts-nocheck
/**
 * nova_reforma_simples.ts
 * Controlador interativo para o Portal de Informações da Nova Reforma Tributária no Simples Nacional
 * Cobre: Comércio, Restaurantes/Bares e Prestadores de Serviços.
 */

interface SimulatorState {
    sector: 'comercio' | 'restaurante' | 'servico' | 'servico_tecnico';
    revenue: number;
    b2bShare: number; // 0 to 100
    costShare: number; // 0 to 100
    currentSimplesRate: number; // in percent (e.g. 6.5)
    standardIvaRate: number; // in percent (e.g. 26.5)
}

const DEFAULT_SIMULATOR_STATE: SimulatorState = {
    sector: 'comercio',
    revenue: 50000,
    b2bShare: 20,
    costShare: 60,
    currentSimplesRate: 6.8,
    standardIvaRate: 26.5
};

let currentSimulatorState: SimulatorState = { ...DEFAULT_SIMULATOR_STATE };

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initSearchFilter();
    initFaqAccordion();
    initSimulator();
    initPrintAction();
});

/**
 * Gerenciamento de Abas
 */
function initTabs() {
    const tabButtons = document.querySelectorAll<HTMLButtonElement>('[data-tab-target]');
    const tabPanels = document.querySelectorAll<HTMLElement>('[data-tab-panel]');

    const activateTab = (targetId: string) => {
        tabButtons.forEach(btn => {
            const isTarget = btn.getAttribute('data-tab-target') === targetId;
            if (isTarget) {
                btn.classList.add('bg-brand-600', 'text-white', 'shadow-sm');
                btn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-gray-700', 'dark:text-gray-300', 'hover:bg-gray-100', 'dark:hover:bg-slate-700');
            } else {
                btn.classList.remove('bg-brand-600', 'text-white', 'shadow-sm');
                btn.classList.add('bg-white', 'dark:bg-slate-800', 'text-gray-700', 'dark:text-gray-300', 'hover:bg-gray-100', 'dark:hover:bg-slate-700');
            }
        });

        tabPanels.forEach(panel => {
            const panelId = panel.getAttribute('data-tab-panel');
            if (panelId === targetId) {
                panel.classList.remove('hidden');
                panel.classList.add('block');
            } else {
                panel.classList.add('hidden');
                panel.classList.remove('block');
            }
        });

        // Scroll top of the content container smoothly
        const contentContainer = document.getElementById('taxReformContent');
        if (contentContainer) {
            contentContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-tab-target');
            if (target) {
                activateTab(target);
                // Atualiza hash da URL sem scroll brusco
                history.replaceState(null, '', `#${target}`);
            }
        });
    });

    // Lê hash inicial da URL ou default 'overview'
    const initialHash = window.location.hash.replace('#', '');
    if (initialHash && document.querySelector(`[data-tab-panel="${initialHash}"]`)) {
        activateTab(initialHash);
    } else {
        activateTab('overview');
    }

    // Botões de atalho internos para navegar entre abas
    document.querySelectorAll<HTMLElement>('[data-goto-tab]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = el.getAttribute('data-goto-tab');
            if (targetTab) {
                activateTab(targetTab);
                history.replaceState(null, '', `#${targetTab}`);
            }
        });
    });
}

/**
 * Busca / Filtro em Tempo Real
 */
function initSearchFilter() {
    const searchInput = document.getElementById('taxReformSearchInput') as HTMLInputElement | null;
    const clearBtn = document.getElementById('taxReformClearSearchBtn');
    const cards = document.querySelectorAll<HTMLElement>('.searchable-card');
    const searchCountBadge = document.getElementById('searchMatchCount');

    if (!searchInput) return;

    const performSearch = () => {
        const query = (searchInput.value || '').trim().toLowerCase();
        let matches = 0;

        if (clearBtn) {
            if (query.length > 0) {
                clearBtn.classList.remove('hidden');
                clearBtn.classList.add('flex');
            } else {
                clearBtn.classList.add('hidden');
                clearBtn.classList.remove('flex');
            }
        }

        cards.forEach(card => {
            const text = (card.textContent || '').toLowerCase();
            const tags = (card.getAttribute('data-search-tags') || '').toLowerCase();
            const fullContent = `${text} ${tags}`;

            if (query === '' || fullContent.includes(query)) {
                card.style.removeProperty('display');
                card.classList.remove('opacity-30');
                matches++;
            } else {
                card.style.setProperty('display', 'none', 'important');
            }
        });

        if (searchCountBadge) {
            if (query.length > 0) {
                searchCountBadge.textContent = `${matches} tópicos encontrados`;
                searchCountBadge.classList.remove('hidden');
            } else {
                searchCountBadge.classList.add('hidden');
            }
        }
    };

    searchInput.addEventListener('input', performSearch);

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            performSearch();
            searchInput.focus();
        });
    }
}

/**
 * FAQ Accordions
 */
function initFaqAccordion() {
    const faqToggles = document.querySelectorAll<HTMLButtonElement>('.faq-toggle-btn');

    faqToggles.forEach(btn => {
        btn.addEventListener('click', () => {
            const answer = btn.nextElementSibling as HTMLElement | null;
            const icon = btn.querySelector('.faq-icon');
            if (!answer) return;

            const isExpanded = btn.getAttribute('aria-expanded') === 'true';

            if (isExpanded) {
                btn.setAttribute('aria-expanded', 'false');
                answer.classList.add('hidden');
                if (icon) icon.classList.remove('rotate-180');
            } else {
                btn.setAttribute('aria-expanded', 'true');
                answer.classList.remove('hidden');
                if (icon) icon.classList.add('rotate-180');
            }
        });
    });
}

/**
 * Simulador Estratégico de Regime do Simples
 */
function initSimulator() {
    const sectorSelect = document.getElementById('simSector') as HTMLSelectElement | null;
    const revenueInput = document.getElementById('simRevenue') as HTMLInputElement | null;
    const b2bShareInput = document.getElementById('simB2bShare') as HTMLInputElement | null;
    const costShareInput = document.getElementById('simCostShare') as HTMLInputElement | null;
    const simplesRateInput = document.getElementById('simSimplesRate') as HTMLInputElement | null;
    const standardIvaRateInput = document.getElementById('simStandardIvaRate') as HTMLInputElement | null;

    // Sliders & value labels
    const b2bShareVal = document.getElementById('simB2bShareVal');
    const costShareVal = document.getElementById('simCostShareVal');

    if (!sectorSelect || !revenueInput) return;

    // Presets por setor
    const applySectorPresets = (sector: string) => {
        if (sector === 'comercio') {
            currentSimulatorState.currentSimplesRate = 6.8;
            currentSimulatorState.costShare = 65;
            currentSimulatorState.b2bShare = 25;
        } else if (sector === 'restaurante') {
            currentSimulatorState.currentSimplesRate = 7.5;
            currentSimulatorState.costShare = 45;
            currentSimulatorState.b2bShare = 10;
        } else if (sector === 'servico') {
            currentSimulatorState.currentSimplesRate = 8.5;
            currentSimulatorState.costShare = 20;
            currentSimulatorState.b2bShare = 70;
        } else if (sector === 'servico_tecnico') {
            currentSimulatorState.currentSimplesRate = 15.5;
            currentSimulatorState.costShare = 15;
            currentSimulatorState.b2bShare = 85;
        }

        if (simplesRateInput) simplesRateInput.value = String(currentSimulatorState.currentSimplesRate);
        if (costShareInput) costShareInput.value = String(currentSimulatorState.costShare);
        if (b2bShareInput) b2bShareInput.value = String(currentSimulatorState.b2bShare);

        if (b2bShareVal) b2bShareVal.textContent = `${currentSimulatorState.b2bShare}%`;
        if (costShareVal) costShareVal.textContent = `${currentSimulatorState.costShare}%`;

        calculateAndRenderSimulator();
    };

    sectorSelect.addEventListener('change', () => {
        currentSimulatorState.sector = sectorSelect.value as any;
        applySectorPresets(sectorSelect.value);
    });

    const updateStateFromInputs = () => {
        currentSimulatorState.sector = (sectorSelect.value as any) || 'comercio';
        currentSimulatorState.revenue = Math.max(0, parseFloat(revenueInput.value.replace(/\D/g, '')) || 0);
        currentSimulatorState.b2bShare = parseFloat(b2bShareInput?.value || '0');
        currentSimulatorState.costShare = parseFloat(costShareInput?.value || '0');
        currentSimulatorState.currentSimplesRate = parseFloat(simplesRateInput?.value || '0');
        currentSimulatorState.standardIvaRate = parseFloat(standardIvaRateInput?.value || '26.5');

        if (b2bShareVal) b2bShareVal.textContent = `${currentSimulatorState.b2bShare}%`;
        if (costShareVal) costShareVal.textContent = `${currentSimulatorState.costShare}%`;

        calculateAndRenderSimulator();
    };

    // Format currency input
    revenueInput.addEventListener('input', () => {
        let val = revenueInput.value.replace(/\D/g, '');
        if (!val) val = '0';
        const num = parseFloat(val);
        revenueInput.value = formatBRL(num);
        updateStateFromInputs();
    });

    b2bShareInput?.addEventListener('input', updateStateFromInputs);
    costShareInput?.addEventListener('input', updateStateFromInputs);
    simplesRateInput?.addEventListener('input', updateStateFromInputs);
    standardIvaRateInput?.addEventListener('input', updateStateFromInputs);

    // Initial state
    revenueInput.value = formatBRL(DEFAULT_SIMULATOR_STATE.revenue);
    applySectorPresets('comercio');
}

function calculateAndRenderSimulator() {
    const { revenue, b2bShare, costShare, currentSimplesRate, standardIvaRate, sector } = currentSimulatorState;

    // Estimativa da fatia de IBS/CBS dentro do DAS do Simples por setor
    // No Comércio: ICMS + PIS/COFINS representa aprox. 38% da guia DAS
    // Em Restaurantes: aprox. 35%
    // Em Serviços: ISS + PIS/COFINS representa aprox. 32%
    let ivaShareInDas = 0.38;
    if (sector === 'restaurante') ivaShareInDas = 0.35;
    if (sector === 'servico' || sector === 'servico_tecnico') ivaShareInDas = 0.32;

    const b2bRevenue = revenue * (b2bShare / 100);
    const b2cRevenue = revenue - b2bRevenue;
    const purchasedInputs = revenue * (costShare / 100);

    // ==========================================
    // CENÁRIO A: SIMPLES NACIONAL UNIFICADO (DAS)
    // ==========================================
    const dasTotal = revenue * (currentSimplesRate / 100);
    const effectiveIvaInsideDas = currentSimplesRate * ivaShareInDas; // % de crédito gerado
    const creditTransferredToB2B_A = b2bRevenue * (effectiveIvaInsideDas / 100);
    const clientB2BNetCost_A = b2bRevenue - creditTransferredToB2B_A;

    // ==========================================
    // CENÁRIO B: SIMPLES HÍBRIDO (CBS/IBS POR FORA)
    // ==========================================
    const ivaRateDecimal = standardIvaRate / 100;
    const grossIvaDebit = revenue * ivaRateDecimal;
    const grossIvaCreditFromPurchases = purchasedInputs * ivaRateDecimal;
    const netIvaPayable = Math.max(0, grossIvaDebit - grossIvaCreditFromPurchases);

    // No DAS paga apenas IRPJ/CSLL/CPP (o DAS residual sem ICMS/ISS/PIS/COFINS)
    const residualDasRate = currentSimplesRate * (1 - ivaShareInDas);
    const residualDasAmount = revenue * (residualDasRate / 100);

    const totalTaxesPaid_B = netIvaPayable + residualDasAmount;
    const creditTransferredToB2B_B = b2bRevenue * ivaRateDecimal; // Crédito integral de 26,5%
    const clientB2BNetCost_B = b2bRevenue - creditTransferredToB2B_B;

    // Diferenças
    const taxDifferenceForCompany = totalTaxesPaid_B - dasTotal; // Positivo = paga mais no híbrido
    const clientSavingsInB = clientB2BNetCost_A - clientB2BNetCost_B; // Economia do cliente PJ comprando no híbrido

    // ==========================================
    // RENDERIZAÇÃO NO DOM
    // ==========================================
    const setElemText = (id: string, text: string) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    // Cenário A
    setElemText('simResultDasTotal', formatCurrency(dasTotal));
    setElemText('simResultDasRate', `${currentSimplesRate.toFixed(1)}%`);
    setElemText('simResultCreditTransferredA', formatCurrency(creditTransferredToB2B_A));
    setElemText('simResultCreditRateA', `${effectiveIvaInsideDas.toFixed(2)}%`);
    setElemText('simResultClientNetCostA', formatCurrency(clientB2BNetCost_A));

    // Cenário B
    setElemText('simResultIvaDebit', formatCurrency(grossIvaDebit));
    setElemText('simResultIvaCredit', formatCurrency(grossIvaCreditFromPurchases));
    setElemText('simResultNetIva', formatCurrency(netIvaPayable));
    setElemText('simResultResidualDas', formatCurrency(residualDasAmount));
    setElemText('simResultTotalTaxB', formatCurrency(totalTaxesPaid_B));
    setElemText('simResultEffectiveRateB', `${((totalTaxesPaid_B / (revenue || 1)) * 100).toFixed(1)}%`);
    setElemText('simResultCreditTransferredB', formatCurrency(creditTransferredToB2B_B));
    setElemText('simResultClientNetCostB', formatCurrency(clientB2BNetCost_B));

    // Comparativo & Veredito Estratégico
    const verdictBadge = document.getElementById('simVerdictBadge');
    const verdictTitle = document.getElementById('simVerdictTitle');
    const verdictDesc = document.getElementById('simVerdictDesc');

    if (verdictBadge && verdictTitle && verdictDesc) {
        if (b2bShare <= 25) {
            // Predominantemente B2C (consumidor final) -> Simples Nacional no DAS é amplamente superior!
            verdictBadge.className = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
            verdictBadge.textContent = 'RECOMENDAÇÃO: MANTER NO SIMPLES UNIFICADO (DAS)';
            verdictTitle.textContent = 'Permanecer 100% no Simples Nacional (Guia DAS)';
            verdictDesc.textContent = `Como ${ (100 - b2bShare).toFixed(0) }% de suas vendas são para consumidor final (PF) ou empresas que não tomam crédito, manter todos os tributos no DAS gera uma economia direta de ${formatCurrency(Math.abs(taxDifferenceForCompany))} por mês para sua empresa, sem exigir apuração complexa de débitos e créditos de CBS/IBS.`;
        } else if (b2bShare >= 60 && clientSavingsInB > taxDifferenceForCompany * 0.7) {
            // Forte B2B onde clientes PJ ganham muito crédito
            verdictBadge.className = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
            verdictBadge.textContent = 'AVALIAR RECOLHER CBS/IBS POR FORA (REGIME HÍBRIDO)';
            verdictTitle.textContent = 'Estudar Apuração de CBS/IBS no Regime Geral';
            verdictDesc.textContent = `Com ${b2bShare.toFixed(0)}% de vendas para empresas PJ, seus clientes ganharão ${formatCurrency(clientSavingsInB)} adicionais em créditos integrais de CBS/IBS. Isso aumenta muito sua competitividade comercial perante grandes empresas compradoras, justificando o recolhimento do IVA por fora.`;
        } else {
            // Cenário equilibrado / Neutro
            verdictBadge.className = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
            verdictBadge.textContent = 'ANÁLISE DE TRANSIÇÃO: SIMPLES DAS PREVALECE';
            verdictTitle.textContent = 'Manter no Simples no Início da Transição (2026-2028)';
            verdictDesc.textContent = `A carga direta no DAS (${formatCurrency(dasTotal)}) é menor do que no regime híbrido (${formatCurrency(totalTaxesPaid_B)}). Recomenda-se iniciar no DAS tradicional e monitorar as exigências contratuais de seus clientes PJ durante a fase de transição.`;
        }
    }
}

/**
 * Utilitários de Formatação
 */
function formatBRL(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

/**
 * Ação de Imprimir / Exportar Resumo
 */
function initPrintAction() {
    const printBtn = document.getElementById('taxReformPrintBtn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
}
