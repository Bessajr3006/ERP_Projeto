// @ts-nocheck
/**
 * sped_fiscal_vision.ts
 * Lógica da tela de Visão Analítica do SPED Fiscal (EFD ICMS/IPI)
 * Exclusivo para empresas cadastradas no sistema.
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Requires Authentication
    if (typeof Auth !== 'undefined' && !Auth.isAuthenticated()) {
        return;
    }
    // DOM Elements
    const customerSelect = document.getElementById('customerSelect');
    const competenciaInput = document.getElementById('competenciaInput');
    const btnFilterSpedVision = document.getElementById('btnFilterSpedVision');
    const filterIcon = document.getElementById('filterIcon');
    const filterSpinner = document.getElementById('filterSpinner');
    const filterBtnText = document.getElementById('filterBtnText');
    const btnResetAll = document.getElementById('btnResetAll');
    const btnGoToFechamento = document.getElementById('btnGoToFechamento');
    const customerDetailsCard = document.getElementById('customerDetailsCard');
    const customerCnpjVal = document.getElementById('customerCnpjVal');
    const customerRegimeVal = document.getElementById('customerRegimeVal');
    const customerCompanyNameVal = document.getElementById('customerCompanyNameVal');
    const alertMessage = document.getElementById('alertMessage');
    const resultsSection = document.getElementById('resultsSection');
    // Company Banner Elements
    const targetCompanyBanner = document.getElementById('targetCompanyBanner');
    const syncCompanyName = document.getElementById('syncCompanyName');
    const syncCustomersCount = document.getElementById('syncCustomersCount');
    const syncSuppliersCount = document.getElementById('syncSuppliersCount');
    const syncProductsCount = document.getElementById('syncProductsCount');
    // Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    // Searches
    const searchCfop = document.getElementById('searchCfop');
    const searchDocs = document.getElementById('searchDocs');
    const searchParticipants = document.getElementById('searchParticipants');
    const searchProducts = document.getElementById('searchProducts');
    let allRegisteredCompanies = [];
    let currentSpedData = null;
    // Formatters
    const formatBRL = (val) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    };
    const formatNumber = (val) => {
        return new Intl.NumberFormat('pt-BR').format(val || 0);
    };
    const showAlert = (message, type = 'info') => {
        if (!alertMessage)
            return;
        alertMessage.classList.remove('hidden', 'bg-emerald-50', 'text-emerald-800', 'border-emerald-200', 'bg-rose-50', 'text-rose-800', 'border-rose-200', 'bg-amber-50', 'text-amber-800', 'border-amber-200', 'bg-blue-50', 'text-blue-800', 'border-blue-200');
        let colorClasses = ['bg-blue-50', 'text-blue-800', 'border', 'border-blue-200', 'dark:bg-blue-950/40', 'dark:text-blue-300', 'dark:border-blue-800/60'];
        if (type === 'success') {
            colorClasses = ['bg-emerald-50', 'text-emerald-800', 'border', 'border-emerald-200', 'dark:bg-emerald-950/40', 'dark:text-emerald-300', 'dark:border-emerald-800/60'];
        }
        else if (type === 'error') {
            colorClasses = ['bg-rose-50', 'text-rose-800', 'border', 'border-rose-200', 'dark:bg-rose-950/40', 'dark:text-rose-300', 'dark:border-rose-800/60'];
        }
        else if (type === 'warning') {
            colorClasses = ['bg-amber-50', 'text-amber-800', 'border', 'border-amber-200', 'dark:bg-amber-950/40', 'dark:text-amber-300', 'dark:border-amber-800/60'];
        }
        alertMessage.classList.add(...colorClasses);
        alertMessage.innerHTML = `<div class="flex items-center gap-2 font-medium">${message}</div>`;
        alertMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    const hideAlert = () => {
        if (alertMessage)
            alertMessage.classList.add('hidden');
    };
    // Initialize Default Competência (Current month or previous month)
    function initDefaultCompetencia() {
        if (competenciaInput) {
            const now = new Date();
            // Default to previous month or current month
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            competenciaInput.value = `${year}-${month}`;
        }
    }
    // Helper to clean doc
    const cleanDoc = (doc) => String(doc || '').replace(/\D/g, '');
    // Load Customers and filter ONLY registered companies
    async function loadRegisteredCompanies() {
        try {
            // 1. Obter os dados da empresa logada no sistema
            let loggedCompany = null;
            try {
                const authResponse = await api('/auth/me');
                if (authResponse?.data?.company) {
                    loggedCompany = authResponse.data.company;
                }
            }
            catch (authErr) {
                console.warn('Não foi possível obter dados de /auth/me:', authErr);
            }
            if (!loggedCompany && window.gNavbarAuthContext?.company) {
                loggedCompany = window.gNavbarAuthContext.company;
            }
            if (!loggedCompany) {
                const cachedName = localStorage.getItem('keystone_last_company_name');
                const cachedCnpj = localStorage.getItem('keystone_last_company_cnpj');
                const cachedPublicId = localStorage.getItem('keystone_last_company_public_id');
                if (cachedName || cachedCnpj) {
                    loggedCompany = {
                        id: 0,
                        company_name: cachedName,
                        trade_name: cachedName,
                        cnpj: cachedCnpj,
                        public_id: cachedPublicId
                    };
                }
            }
            const response = await api('/entities/customers');
            const raw = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
            // Filter only registered companies
            allRegisteredCompanies = raw.filter((c) => c.is_registered_as_company === 1 ||
                c.is_registered_as_company === true ||
                !!c.registered_company_name ||
                !!c.registered_company_id);
            // Identifica se a empresa logada já existe na lista filtrada ou nos clientes gerais
            const loggedCnpjClean = cleanDoc(loggedCompany?.cnpj);
            let loggedCompanyItem = allRegisteredCompanies.find((c) => {
                if (loggedCompany?.id && c.registered_company_id && String(c.registered_company_id) === String(loggedCompany.id))
                    return true;
                if (loggedCnpjClean && cleanDoc(c.cnpj_cpf) === loggedCnpjClean)
                    return true;
                return false;
            });
            // Se a empresa logada estiver na lista geral de clientes mas não nos filtrados, adiciona
            if (!loggedCompanyItem && loggedCnpjClean) {
                const rawMatch = raw.find((c) => cleanDoc(c.cnpj_cpf) === loggedCnpjClean);
                if (rawMatch) {
                    rawMatch.is_registered_as_company = 1;
                    rawMatch.registered_company_id = loggedCompany?.id || rawMatch.registered_company_id;
                    rawMatch.registered_company_name = loggedCompany?.trade_name || loggedCompany?.company_name || rawMatch.name;
                    allRegisteredCompanies.unshift(rawMatch);
                    loggedCompanyItem = rawMatch;
                }
            }
            // Se a empresa logada ainda não foi encontrada na lista de clientes, cria uma entrada representativa
            if (!loggedCompanyItem && loggedCompany) {
                loggedCompanyItem = {
                    id: loggedCompany.id || 0,
                    name: loggedCompany.trade_name || loggedCompany.company_name || 'Empresa Logada',
                    trade_name: loggedCompany.trade_name,
                    company_name: loggedCompany.company_name,
                    cnpj_cpf: loggedCompany.cnpj || '',
                    tax_regime: loggedCompany.tax_regime || 'Simples Nacional',
                    regime_tributario: loggedCompany.tax_regime || 'Simples Nacional',
                    registered_company_name: loggedCompany.trade_name || loggedCompany.company_name,
                    registered_company_id: loggedCompany.id,
                    is_registered_as_company: 1,
                    is_logged_company: true
                };
                allRegisteredCompanies.unshift(loggedCompanyItem);
            }
            customerSelect.innerHTML = '<option value="">Selecione uma empresa cadastrada...</option>';
            if (allRegisteredCompanies.length === 0) {
                customerSelect.innerHTML = '<option value="">Nenhuma empresa cadastrada encontrada</option>';
                showAlert('Nenhum cliente registrado como Empresa foi encontrado no sistema.', 'warning');
                return;
            }
            allRegisteredCompanies.forEach((cust) => {
                const opt = document.createElement('option');
                opt.value = cust.id;
                const doc = cust.cnpj_cpf ? ` (${cust.cnpj_cpf})` : '';
                const isLogged = loggedCompanyItem && String(cust.id) === String(loggedCompanyItem.id);
                const prefix = isLogged ? '🏢 [Empresa Logada] ' : '🏢 [Empresa ERP] ';
                opt.textContent = `${prefix}${cust.name || cust.razao_social || 'Empresa #' + cust.id}${doc}`;
                customerSelect.appendChild(opt);
            });
            // Check URL parameters for auto-selection
            const urlParams = new URLSearchParams(window.location.search);
            const paramCustId = urlParams.get('customerId');
            const paramComp = urlParams.get('competencia');
            if (paramComp && competenciaInput) {
                competenciaInput.value = paramComp;
            }
            // Se o parâmetro customerId foi informado, usa ele; se o campo estiver vazio, define a empresa logada
            if (paramCustId) {
                customerSelect.value = paramCustId;
            }
            else if (loggedCompanyItem) {
                customerSelect.value = String(loggedCompanyItem.id);
            }
            if (customerSelect.value) {
                handleCustomerChange();
                if (paramComp || competenciaInput.value) {
                    await fetchSpedVision();
                }
            }
        }
        catch (err) {
            console.error('Erro ao carregar empresas cadastradas:', err);
            customerSelect.innerHTML = '<option value="">Erro ao carregar empresas</option>';
            showAlert('Erro ao carregar lista de empresas cadastradas do servidor.', 'error');
        }
    }
    // Customer Selection Change
    function handleCustomerChange() {
        const custId = customerSelect.value;
        if (!custId) {
            customerDetailsCard.classList.add('hidden');
            return;
        }
        const selectedCust = allRegisteredCompanies.find((c) => String(c.id) === String(custId));
        if (selectedCust) {
            customerCnpjVal.textContent = selectedCust.cnpj_cpf || 'Não informado';
            customerRegimeVal.textContent = selectedCust.tax_regime || selectedCust.regime_tributario || 'Simples Nacional';
            customerCompanyNameVal.textContent = selectedCust.registered_company_name || selectedCust.trade_name || selectedCust.name || 'Empresa Identificada';
            customerDetailsCard.classList.remove('hidden');
            if (competenciaInput.value && /^\d{4}-\d{2}$/.test(competenciaInput.value)) {
                fetchSpedVision();
            }
        }
        else {
            customerDetailsCard.classList.add('hidden');
        }
    }
    customerSelect.addEventListener('change', handleCustomerChange);
    // Fetch SPED Vision Data
    async function fetchSpedVision() {
        const customerId = customerSelect.value;
        const competencia = competenciaInput.value;
        if (!customerId) {
            showAlert('Por favor, selecione uma empresa cadastrada.', 'warning');
            customerSelect.focus();
            return;
        }
        if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
            showAlert('Por favor, selecione uma competência válida (Mês e Ano).', 'warning');
            competenciaInput.focus();
            return;
        }
        try {
            btnFilterSpedVision.disabled = true;
            filterIcon.classList.add('hidden');
            filterSpinner.classList.remove('hidden');
            filterBtnText.textContent = 'Carregando Visão...';
            hideAlert();
            const response = await api(`/fechamentos/sped-vision?customerId=${customerId}&competencia=${competencia}`);
            if (!response || response.status === 'error') {
                throw new Error(response?.message || 'Falha ao consultar visão do SPED Fiscal.');
            }
            const data = response.data || response;
            currentSpedData = data;
            renderSpedResults(data);
            showAlert(`✨ <strong>Visão carregada com sucesso!</strong> Exibindo dados fiscais da competência <strong>${competencia}</strong>.`, 'success');
        }
        catch (err) {
            console.error('Erro ao consultar visão do SPED:', err);
            resultsSection.classList.add('hidden');
            currentSpedData = null;
            showAlert(err.message || 'Erro inesperado ao consultar a visão do SPED Fiscal.', 'error');
        }
        finally {
            btnFilterSpedVision.disabled = false;
            filterIcon.classList.remove('hidden');
            filterSpinner.classList.add('hidden');
            filterBtnText.textContent = 'Consultar';
        }
    }
    btnFilterSpedVision.addEventListener('click', fetchSpedVision);
    // Render results (matching SPED process output)
    function renderSpedResults(data) {
        const totals = data.totals || {};
        const header = data.header || {};
        const stats = data.stats || {};
        const apuracao = data.apuracao || {};
        const cfopDetails = data.cfopDetails || [];
        const documents = data.documents || [];
        const participants = data.participants || [];
        // Dados da apuração de ICMS e FECP
        const icms = apuracao.icms || {
            vl_tot_debitos: 0,
            vl_aj_debitos: 0,
            vl_tot_creditos: 0,
            vl_aj_creditos: 0,
            vl_estornos_deb: 0,
            vl_estornos_cred: 0,
            vl_sld_credor_ant: 0,
            vl_sld_apurado: 0,
            vl_tot_ded: 0,
            vl_icms_recolher: totals.apuracao_icms || 0,
            vl_sld_credor_transportar: 0,
            obrigacoes: [],
            tem_registro_e110: false
        };
        const fecp = apuracao.fecp || {
            base_calculo: totals.venda_bs_icms || 0,
            aliquota: 2.0,
            vl_tot_debitos: totals.apuracao_fecp || 0,
            vl_tot_creditos: 0,
            vl_fecp_recolher: totals.apuracao_fecp || 0,
            vl_sld_credor_transportar: 0,
            obrigacoes: [],
            tem_registro_fecp: false
        };
        const icmsSt = apuracao.icms_st || {
            vl_icms_st_recolher: 0,
            vl_sld_credor_transportar: 0,
            obrigacoes: [],
            tem_registro_e210: false
        };
        const totaisRecolher = apuracao.totais_recolher || {
            icms_proprio: icms.vl_icms_recolher || 0,
            fecp: fecp.vl_fecp_recolher || 0,
            icms_st: icmsSt.vl_icms_st_recolher || 0,
            total_a_pagar: (icms.vl_icms_recolher || 0) + (fecp.vl_fecp_recolher || 0) + (icmsSt.vl_icms_st_recolher || 0)
        };
        // Header info
        document.getElementById('resHeaderNome').textContent = header.nome || 'Razão Social não identificada';
        document.getElementById('resHeaderCnpj').textContent = header.cnpj_cpf || header.cnpj || '-';
        document.getElementById('resHeaderUf').textContent = header.uf || '-';
        document.getElementById('resHeaderIe').textContent = header.ie || '-';
        document.getElementById('resHeaderFinalidade').textContent = header.finalidade || 'Original';
        document.getElementById('resHeaderPeriodo').textContent = (header.dt_ini && header.dt_fin) ? `${header.dt_ini} a ${header.dt_fin}` : 'Período não informado';
        const impStats = data.importedStats;
        const targetComp = data.targetCompany;
        const companyPubId = header.company_public_id || targetComp?.public_id || impStats?.companyPublicId || null;
        const resHeaderCompanyPublicId = document.getElementById('resHeaderCompanyPublicId');
        if (resHeaderCompanyPublicId) {
            resHeaderCompanyPublicId.textContent = companyPubId || '-';
        }
        // Banner da Empresa Vinculada
        if (targetCompanyBanner) {
            if (impStats?.isCompany || targetComp) {
                targetCompanyBanner.classList.remove('hidden');
                if (syncCompanyName)
                    syncCompanyName.textContent = targetComp?.trade_name || targetComp?.name || impStats?.companyName || 'Empresa Vinculada';
                if (syncCustomersCount)
                    syncCustomersCount.textContent = String(impStats?.importedCustomersCount || 0);
                if (syncSuppliersCount)
                    syncSuppliersCount.textContent = String(impStats?.importedSuppliersCount || 0);
                if (syncProductsCount)
                    syncProductsCount.textContent = String(impStats?.importedProductsCount || 0);
                const syncCompanyPublicIdWrapper = document.getElementById('syncCompanyPublicIdWrapper');
                const syncCompanyPublicId = document.getElementById('syncCompanyPublicId');
                if (syncCompanyPublicId && companyPubId) {
                    syncCompanyPublicId.textContent = companyPubId;
                    if (syncCompanyPublicIdWrapper)
                        syncCompanyPublicIdWrapper.classList.remove('hidden');
                }
                else if (syncCompanyPublicIdWrapper) {
                    syncCompanyPublicIdWrapper.classList.add('hidden');
                }
            }
            else {
                targetCompanyBanner.classList.add('hidden');
            }
        }
        // ── TOP KPI CARDS ──────────────────────────────────────────────
        // Card 1: ICMS Próprio
        const icmsRecolher = icms.vl_icms_recolher || 0;
        const icmsCredor = icms.vl_sld_credor_transportar || 0;
        const badgeIcmsStatus = document.getElementById('badgeIcmsStatus');
        if (icmsRecolher > 0) {
            badgeIcmsStatus.textContent = 'A Pagar';
            badgeIcmsStatus.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300';
            document.getElementById('cardIcmsRecolher').textContent = formatBRL(icmsRecolher);
            document.getElementById('cardIcmsRecolher').className = 'text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono';
        }
        else if (icmsCredor > 0) {
            badgeIcmsStatus.textContent = 'Saldo Credor';
            badgeIcmsStatus.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300';
            document.getElementById('cardIcmsRecolher').textContent = formatBRL(icmsCredor);
            document.getElementById('cardIcmsRecolher').className = 'text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono';
        }
        else {
            badgeIcmsStatus.textContent = 'Zerado';
            badgeIcmsStatus.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300';
            document.getElementById('cardIcmsRecolher').textContent = formatBRL(0);
            document.getElementById('cardIcmsRecolher').className = 'text-xl sm:text-2xl font-bold text-gray-700 dark:text-gray-300 font-mono';
        }
        document.getElementById('cardIcmsDebitos').textContent = formatBRL(icms.vl_tot_debitos || 0);
        document.getElementById('cardIcmsCreditos').textContent = formatBRL(icms.vl_tot_creditos || 0);
        document.getElementById('cardIcmsCredorTransp').textContent = formatBRL(icmsCredor);
        // Card 2: FECP (Fundo Estadual de Combate à Pobreza)
        const fecpRecolher = fecp.vl_fecp_recolher || 0;
        document.getElementById('cardFecpRecolher').textContent = formatBRL(fecpRecolher);
        document.getElementById('cardFecpBase').textContent = formatBRL(fecp.base_calculo || totals.venda_bs_icms || 0);
        document.getElementById('cardFecpAliquota').textContent = `${(fecp.aliquota || 2).toFixed(2).replace('.', ',')}%`;
        document.getElementById('badgeFecpStatus').textContent = `${(fecp.aliquota || 2).toFixed(2).replace('.', ',')}%`;
        document.getElementById('cardFecpOrigem').textContent = fecp.tem_registro_fecp ? 'SPED EFD' : 'Estimado (2%)';
        // Card 3: Total Tributos Estaduais
        document.getElementById('cardTotalImpostosRecolher').textContent = formatBRL(totaisRecolher.total_a_pagar || (icmsRecolher + fecpRecolher));
        document.getElementById('cardSubIcmsProprio').textContent = formatBRL(totaisRecolher.icms_proprio || icmsRecolher);
        document.getElementById('cardSubFecp').textContent = formatBRL(totaisRecolher.fecp || fecpRecolher);
        document.getElementById('cardSubIcmsSt').textContent = formatBRL(totaisRecolher.icms_st || icmsSt.vl_icms_st_recolher || 0);
        // Card 4: Volume e Documentos
        document.getElementById('cardTotalDocumentos').textContent = `${formatNumber(stats.totalDocuments || documents.length)} docs`;
        document.getElementById('cardVolumeSaidas').textContent = formatBRL(totals.venda_valor);
        document.getElementById('cardVolumeEntradas').textContent = formatBRL(totals.compra_valor);
        document.getElementById('cardCountParticipants').textContent = formatNumber(stats.totalParticipants || participants.length);
        // Tab Badges
        document.getElementById('tabBadgeCfopCount').textContent = String(cfopDetails.length);
        document.getElementById('tabBadgeDocCount').textContent = String(stats.totalDocuments || documents.length);
        document.getElementById('tabBadgePartCount').textContent = String(participants.length);
        const prodCountBadge = document.getElementById('tabBadgeProdCount');
        if (prodCountBadge)
            prodCountBadge.textContent = String(data.products?.length || stats.totalProducts || 0);
        // ── TAB 1: APURAÇÃO DO ICMS (BLOCO E110) ───────────────────────
        document.getElementById('badgeIcmsOrigem').textContent = icms.tem_registro_e110 ? 'Registro E110 (SPED)' : 'Calculado por Documentos';
        const totalDebCalculado = (icms.vl_tot_debitos || 0) + (icms.vl_aj_debitos || 0) + (icms.vl_estornos_cred || 0);
        const totalCredCalculado = (icms.vl_tot_creditos || 0) + (icms.vl_aj_creditos || 0) + (icms.vl_estornos_deb || 0) + (icms.vl_sld_credor_ant || 0);
        document.getElementById('apurIcmsTotDebitos').textContent = formatBRL(totalDebCalculado);
        document.getElementById('apurIcmsDebSaidas').textContent = formatBRL(icms.vl_tot_debitos || 0);
        document.getElementById('apurIcmsAjDebitos').textContent = formatBRL(icms.vl_aj_debitos || 0);
        document.getElementById('apurIcmsEstornoCred').textContent = formatBRL(icms.vl_estornos_cred || 0);
        document.getElementById('apurIcmsTotCreditos').textContent = formatBRL(totalCredCalculado);
        document.getElementById('apurIcmsCredEntradas').textContent = formatBRL(icms.vl_tot_creditos || 0);
        document.getElementById('apurIcmsAjCreditos').textContent = formatBRL(icms.vl_aj_creditos || 0);
        document.getElementById('apurIcmsEstornoDeb').textContent = formatBRL(icms.vl_estornos_deb || 0);
        document.getElementById('apurIcmsSaldoCredorAnt').textContent = formatBRL(icms.vl_sld_credor_ant || 0);
        document.getElementById('apurIcmsSaldoApurado').textContent = formatBRL(icms.vl_sld_apurado || Math.max(0, totalDebCalculado - totalCredCalculado));
        document.getElementById('apurIcmsRecolherVal').textContent = formatBRL(icms.vl_icms_recolher || 0);
        document.getElementById('apurIcmsCredorTransportarVal').textContent = formatBRL(icms.vl_sld_credor_transportar || 0);
        // Render E116 Obrigações do ICMS
        renderIcmsObrigacoesTable(icms.obrigacoes || []);
        // ── TAB 1: APURAÇÃO DO FECP ────────────────────────────────────
        document.getElementById('badgeFecpOrigem').textContent = fecp.tem_registro_fecp ? 'Bloco E310 / 1920 (SPED)' : 'Estimado (Base x 2%)';
        document.getElementById('dtlFecpBase').textContent = formatBRL(fecp.base_calculo || totals.venda_bs_icms || 0);
        document.getElementById('dtlFecpAliquota').textContent = `${(fecp.aliquota || 2).toFixed(2).replace('.', ',')}%`;
        document.getElementById('dtlFecpRecolher').textContent = formatBRL(fecp.vl_fecp_recolher || 0);
        document.getElementById('dtlFecpTransp').textContent = formatBRL(fecp.vl_sld_credor_transportar || 0);
        // Render FECP Obrigações
        renderFecpObrigacoesTable(fecp.obrigacoes || []);
        // ── TAB 1: RESUMO DE ENTRADAS E SAÍDAS ─────────────────────────
        document.getElementById('apuracaoTotalEntradaBadge').textContent = formatBRL(totals.compra_valor);
        document.getElementById('dtlEntradaValor').textContent = formatBRL(totals.compra_valor);
        document.getElementById('dtlEntradaBcIcms').textContent = formatBRL(totals.compra_bs_icms);
        document.getElementById('dtlEntradaIsento').textContent = formatBRL(totals.compra_isento);
        document.getElementById('dtlEntradaOutros').textContent = formatBRL(totals.compra_outros);
        document.getElementById('dtlEntradaPis').textContent = formatBRL(totals.compra_pis);
        document.getElementById('dtlEntradaCofins').textContent = formatBRL(totals.compra_cofins);
        document.getElementById('apuracaoTotalSaidaBadge').textContent = formatBRL(totals.venda_valor);
        document.getElementById('dtlSaidaValor').textContent = formatBRL(totals.venda_valor);
        document.getElementById('dtlSaidaBcIcms').textContent = formatBRL(totals.venda_bs_icms);
        document.getElementById('dtlSaidaIsento').textContent = formatBRL(totals.venda_isento);
        document.getElementById('dtlSaidaOutros').textContent = formatBRL(totals.venda_outros);
        document.getElementById('dtlSaidaPis').textContent = formatBRL(totals.venda_pis);
        document.getElementById('dtlSaidaCofins').textContent = formatBRL(totals.venda_cofins);
        // Tab 1 & Tab 2: Saídas por Alíquota e CFOPs
        const saidasPorAliquota = data.saidasPorAliquota || [];
        const totalSaidasVal = Number(totals.venda_valor || 0);
        // Tab 1 Mini Saídas por Alíquota
        renderTab1SaidasAliquotaMini(saidasPorAliquota);
        // Tab 2: Quadro de Saídas por Alíquota e Valor
        renderSaidasPorAliquotaCards(saidasPorAliquota, totalSaidasVal);
        renderSaidasPorAliquotaTable(saidasPorAliquota, totalSaidasVal);
        // Tab 2: Tabela Analítica Geral por CFOP e Alíquota
        renderCfopTable(cfopDetails);
        // Tab 3: Documents Table
        renderDocsTable(documents);
        // Tab 4: Participants Table
        renderParticipantsTable(participants);
        // Tab 5: Products Table (0200)
        renderProductsTable(data.products || []);
        // Tab 6: Declarante Info (0000)
        document.getElementById('declNome').textContent = header.nome || '-';
        document.getElementById('declCnpj').textContent = header.cnpj_cpf || header.cnpj || '-';
        document.getElementById('declIe').textContent = header.ie || '-';
        document.getElementById('declPeriodo').textContent = (header.dt_ini && header.dt_fin) ? `${header.dt_ini} a ${header.dt_fin}` : '-';
        document.getElementById('declUfMun').textContent = `${header.uf || '-'} (${header.cod_mun || '-'})`;
        document.getElementById('declFinalidade').textContent = header.finalidade || 'Original';
        // Configure "Ir para Fechamento"
        if (btnGoToFechamento) {
            const custId = customerSelect.value;
            const comp = competenciaInput.value;
            btnGoToFechamento.href = `/pages/fechamento.html?customerId=${custId}${comp ? '&competencia=' + comp : ''}`;
            btnGoToFechamento.classList.remove('hidden');
        }
        resultsSection.classList.remove('hidden');
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
    // Render ICMS Obrigações (E116)
    function renderIcmsObrigacoesTable(list) {
        const tbody = document.getElementById('icmsObrigacoesTableBody');
        if (!tbody)
            return;
        if (!list || list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="px-3 py-3 text-center text-gray-400">Nenhuma guia E116 cadastrada no período.</td></tr>`;
            return;
        }
        tbody.innerHTML = list.map(item => `
            <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="px-3 py-2 font-mono font-medium text-gray-700 dark:text-gray-300">${item.cod_or || '000'}</td>
                <td class="px-3 py-2 font-mono font-semibold text-rose-600 dark:text-rose-400">${item.cod_rec || '-'}</td>
                <td class="px-3 py-2 font-mono text-gray-800 dark:text-gray-200">${item.dt_vcto || '-'}</td>
                <td class="px-3 py-2 text-gray-600 dark:text-gray-300 truncate max-w-xs" title="${item.txt_compl || ''}">${item.txt_compl || 'ICMS Próprio a Recolher'}</td>
                <td class="px-3 py-2 text-right font-mono font-bold text-rose-600 dark:text-rose-400">${formatBRL(item.vl_or || 0)}</td>
            </tr>
        `).join('');
    }
    // Render FECP Obrigações (E316 / 1926 / E116)
    function renderFecpObrigacoesTable(list) {
        const tbody = document.getElementById('fecpObrigacoesTableBody');
        if (!tbody)
            return;
        if (!list || list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="px-3 py-3 text-center text-gray-400">Nenhuma guia de FECP cadastrada no período.</td></tr>`;
            return;
        }
        tbody.innerHTML = list.map(item => `
            <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="px-3 py-2">
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                        ${item.origem || 'E316'}
                    </span>
                </td>
                <td class="px-3 py-2 font-mono font-semibold text-amber-600 dark:text-amber-400">${item.cod_rec || '-'}</td>
                <td class="px-3 py-2 font-mono text-gray-800 dark:text-gray-200">${item.dt_vcto || '-'}</td>
                <td class="px-3 py-2 text-gray-600 dark:text-gray-300 truncate max-w-xs" title="${item.txt_compl || ''}">${item.txt_compl || 'FECP a Recolher'}</td>
                <td class="px-3 py-2 text-right font-mono font-bold text-amber-600 dark:text-amber-400">${formatBRL(item.vl_or || 0)}</td>
            </tr>
        `).join('');
    }
    // Render Mini-breakdown on Tab 1
    function renderTab1SaidasAliquotaMini(saidasList) {
        const container = document.getElementById('tab1SaidasAliquotaSection');
        const listDiv = document.getElementById('tab1SaidasAliquotaList');
        if (!container || !listDiv)
            return;
        if (!saidasList || saidasList.length === 0) {
            container.classList.add('hidden');
            return;
        }
        container.classList.remove('hidden');
        listDiv.innerHTML = saidasList.map(item => {
            const isAliq = item.aliquota > 0;
            const badgeClass = isAliq
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
            const cfopLabel = (item.cfops && item.cfops.length > 0) ? `CFOP ${item.cfops.join(', ')}` : 'Saída';
            return `
                <div class="flex items-center justify-between py-1 text-xs border-b border-emerald-100/60 dark:border-emerald-900/20 last:border-0">
                    <div class="flex items-center gap-1.5">
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${badgeClass}">
                            ${item.aliquotaLabel || (item.aliquota > 0 ? `${item.aliquota}%` : '0%')}
                        </span>
                        <span class="text-gray-600 dark:text-gray-400 text-[11px] truncate max-w-36">${cfopLabel}</span>
                    </div>
                    <div class="text-right font-mono">
                        <span class="font-bold text-gray-900 dark:text-gray-100">${formatBRL(item.valorTotal)}</span>
                        ${item.valorIcms > 0 ? `<span class="text-[10px] text-emerald-600 dark:text-emerald-400 ml-1 font-semibold">(ICMS: ${formatBRL(item.valorIcms)})</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
    // Render Saídas por Alíquota Cards (KPI Grid)
    function renderSaidasPorAliquotaCards(saidasList, totalSaidas) {
        const grid = document.getElementById('saidasAliquotaCardsGrid');
        if (!grid)
            return;
        if (!saidasList || saidasList.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full p-4 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 text-center text-xs text-gray-400">
                    Nenhum lançamento analítico de saída encontrado para esta competência.
                </div>
            `;
            return;
        }
        grid.innerHTML = saidasList.map(item => {
            const isAliq = item.aliquota > 0;
            const cardBg = isAliq
                ? 'bg-white dark:bg-slate-800 border-emerald-200/80 dark:border-emerald-900/50'
                : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700';
            const badgeBg = isAliq
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
            const iconBg = isAliq ? 'bg-emerald-500' : 'bg-slate-400';
            return `
                <div class="p-3.5 sm:p-4 rounded-xl border ${cardBg} shadow-xs hover:shadow-md transition-shadow">
                    <div class="flex items-center justify-between mb-2">
                        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold ${badgeBg}">
                            <span class="w-1.5 h-1.5 rounded-full ${iconBg}"></span>
                            ${item.aliquotaLabel || (item.aliquota > 0 ? `${item.aliquota.toFixed(2).replace('.', ',')}%` : '0,00%')}
                        </span>
                        <span class="text-[11px] font-mono font-semibold text-gray-500 dark:text-gray-400">
                            ${item.percent.toFixed(1)}% das Saídas
                        </span>
                    </div>

                    <div class="mb-2">
                        <span class="text-[10px] uppercase font-semibold text-gray-400 dark:text-gray-500 block">Valor da Operação / Total</span>
                        <span class="text-base sm:text-lg font-bold font-mono text-gray-900 dark:text-gray-100">${formatBRL(item.valorTotal)}</span>
                    </div>

                    <div class="pt-2 border-t border-gray-100 dark:border-slate-700/60 grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                            <span class="text-gray-500 dark:text-gray-400 block text-[10px]">Base ICMS:</span>
                            <span class="font-mono font-medium text-gray-800 dark:text-gray-200">${formatBRL(item.baseCalculo)}</span>
                        </div>
                        <div class="text-right">
                            <span class="text-gray-500 dark:text-gray-400 block text-[10px]">ICMS Debitado:</span>
                            <span class="font-mono font-bold ${item.valorIcms > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}">${formatBRL(item.valorIcms)}</span>
                        </div>
                    </div>

                    ${item.cfops && item.cfops.length > 0 ? `
                        <div class="mt-2.5 pt-2 border-t border-gray-100 dark:border-slate-700/40 flex items-center gap-1 flex-wrap">
                            <span class="text-[10px] text-gray-400">CFOPs:</span>
                            ${item.cfops.map((c) => `<span class="px-1.5 py-0.2 rounded font-mono text-[10px] font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300">${c}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }
    // Render Saídas por Alíquota Table
    function renderSaidasPorAliquotaTable(saidasList, totalSaidas) {
        const tbody = document.getElementById('saidasAliquotaTableBody');
        const tfoot = document.getElementById('saidasAliquotaTableFoot');
        const totalHeader = document.getElementById('saidasConsolidadoTotalVal');
        if (!tbody)
            return;
        if (totalHeader)
            totalHeader.textContent = formatBRL(totalSaidas);
        if (!saidasList || saidasList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-6 text-center text-gray-400">Nenhum dado analítico de saída encontrado.</td></tr>`;
            if (tfoot)
                tfoot.innerHTML = '';
            return;
        }
        let totBase = 0;
        let totVal = 0;
        let totIcms = 0;
        tbody.innerHTML = saidasList.map(item => {
            totBase += (item.baseCalculo || 0);
            totVal += (item.valorTotal || 0);
            totIcms += (item.valorIcms || 0);
            const isAliq = item.aliquota > 0;
            const badgeClass = isAliq
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
            let descr = 'Tributada Integralmente';
            if (!isAliq) {
                if (item.csts?.includes('060') || item.csts?.includes('500') || item.cfops?.some((c) => c.endsWith('405'))) {
                    descr = 'Substituição Tributária (ST Retido)';
                }
                else {
                    descr = 'Isenta / Não Tributada';
                }
            }
            else if (item.aliquota === 12 || item.aliquota === 7 || item.aliquota === 4) {
                descr = 'Operação Interestadual / Diferenciada';
            }
            else if (item.aliquota >= 18) {
                descr = 'Alíquota Padrão Interna Estadual';
            }
            const cfopTags = (item.cfops || []).map((c) => `
                <span class="inline-block px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200">
                    ${c}
                </span>
            `).join(' ');
            return `
                <tr class="hover:bg-emerald-50/40 dark:hover:bg-slate-700/50 transition-colors">
                    <td class="px-4 py-3">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${badgeClass}">
                            ${item.aliquotaLabel || (item.aliquota > 0 ? `${item.aliquota.toFixed(2).replace('.', ',')}%` : '0,00%')}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium">
                        ${descr}
                    </td>
                    <td class="px-4 py-3">
                        <div class="flex items-center gap-1 flex-wrap">
                            ${cfopTags || '-'}
                        </div>
                    </td>
                    <td class="px-4 py-3 text-right font-mono font-medium text-gray-800 dark:text-gray-200">
                        ${formatBRL(item.baseCalculo)}
                    </td>
                    <td class="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-gray-100">
                        ${formatBRL(item.valorTotal)}
                    </td>
                    <td class="px-4 py-3 text-right font-mono font-bold ${item.valorIcms > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}">
                        ${formatBRL(item.valorIcms)}
                    </td>
                    <td class="px-4 py-3">
                        <div class="flex items-center gap-2">
                            <div class="flex-1 bg-gray-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                <div class="bg-emerald-500 h-full rounded-full" style="width: ${Math.min(100, item.percent)}%"></div>
                            </div>
                            <span class="font-mono text-xs text-gray-500 dark:text-gray-400 w-12 text-right">${item.percent.toFixed(1)}%</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        if (tfoot) {
            tfoot.innerHTML = `
                <tr>
                    <td colspan="3" class="px-4 py-3 text-right uppercase tracking-wider text-xs font-bold">Total Consolidado de Saídas:</td>
                    <td class="px-4 py-3 text-right font-mono font-bold">${formatBRL(totBase)}</td>
                    <td class="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">${formatBRL(totVal)}</td>
                    <td class="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">${formatBRL(totIcms)}</td>
                    <td class="px-4 py-3 text-right font-mono text-xs font-bold">100,0%</td>
                </tr>
            `;
        }
    }
    let currentCfopFilter = 'all';
    // Render CFOPs & Analítico
    function renderCfopTable(cfopList) {
        const tbody = document.getElementById('cfopTableBody');
        const tfoot = document.getElementById('cfopTableFoot');
        const countSpan = document.getElementById('cfopCountSummary');
        const query = (searchCfop?.value || '').toLowerCase().trim();
        const filtered = (cfopList || []).filter(item => {
            // Filter by Tab/Button (all, saida, entrada)
            if (currentCfopFilter === 'saida' && item.type !== 'Saída')
                return false;
            if (currentCfopFilter === 'entrada' && item.type !== 'Entrada')
                return false;
            if (!query)
                return true;
            const cfopStr = String(item.cfop || '').toLowerCase();
            const typeStr = String(item.type || '').toLowerCase();
            const aliqStr = String(item.aliquota || '').toLowerCase();
            const aliqLabel = String(item.aliquotaLabel || '').toLowerCase();
            const cstStr = String(item.cstIcms || '').toLowerCase();
            return cfopStr.includes(query) || typeStr.includes(query) || aliqStr.includes(query) || aliqLabel.includes(query) || cstStr.includes(query);
        });
        if (countSpan)
            countSpan.textContent = `${filtered.length} registro(s) analítico(s)`;
        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-6 text-center text-gray-400">Nenhum lançamento analítico corresponde aos filtros.</td></tr>`;
            if (tfoot)
                tfoot.innerHTML = '';
            return;
        }
        let totBase = 0;
        let totVal = 0;
        let totIcms = 0;
        tbody.innerHTML = filtered.map(item => {
            const isSaida = item.type === 'Saída';
            const badgeClass = isSaida
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300';
            const barClass = isSaida ? 'bg-emerald-500' : 'bg-blue-500';
            const aliqVal = Number(item.aliquota || 0);
            const aliqBadge = aliqVal > 0
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300';
            const baseVal = Number(item.baseCalculo || (aliqVal > 0 ? item.total : 0));
            const icmsVal = Number(item.valorIcms || (aliqVal > 0 ? baseVal * (aliqVal / 100) : 0));
            const itemTotal = Number(item.total || 0);
            totBase += baseVal;
            totVal += itemTotal;
            totIcms += icmsVal;
            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td class="px-4 py-3 font-mono font-bold text-gray-900 dark:text-gray-100">${item.cfop}</td>
                    <td class="px-4 py-3">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${badgeClass}">
                            ${item.type}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-center font-mono text-gray-600 dark:text-gray-300 font-semibold">
                        ${item.cstIcms || '-'}
                    </td>
                    <td class="px-4 py-3 text-center">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono ${aliqBadge}">
                            ${item.aliquotaLabel || (aliqVal > 0 ? `${aliqVal.toFixed(2).replace('.', ',')}%` : '0,00%')}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-right font-mono text-gray-800 dark:text-gray-200">${formatBRL(baseVal)}</td>
                    <td class="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-gray-100">${formatBRL(itemTotal)}</td>
                    <td class="px-4 py-3 text-right font-mono font-bold ${icmsVal > 0 ? (isSaida ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400') : 'text-gray-400'}">${formatBRL(icmsVal)}</td>
                    <td class="px-4 py-3">
                        <div class="flex items-center gap-2">
                            <div class="flex-1 bg-gray-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                <div class="${barClass} h-full rounded-full" style="width: ${Math.min(100, item.percent || 0)}%"></div>
                            </div>
                            <span class="font-mono text-xs text-gray-500 dark:text-gray-400 w-12 text-right">${(item.percent || 0).toFixed(1)}%</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        if (tfoot) {
            tfoot.innerHTML = `
                <tr>
                    <td colspan="4" class="px-4 py-3 text-right uppercase tracking-wider text-xs font-bold">Total Filtrado:</td>
                    <td class="px-4 py-3 text-right font-mono font-bold">${formatBRL(totBase)}</td>
                    <td class="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-gray-100">${formatBRL(totVal)}</td>
                    <td class="px-4 py-3 text-right font-mono font-bold text-teal-600 dark:text-teal-400">${formatBRL(totIcms)}</td>
                    <td class="px-4 py-3 text-right font-mono text-xs font-bold">-</td>
                </tr>
            `;
        }
    }
    // Render Documents
    function renderDocsTable(docList) {
        const tbody = document.getElementById('docsTableBody');
        const countSpan = document.getElementById('docCountSummary');
        const query = (searchDocs?.value || '').toLowerCase().trim();
        const filtered = docList.filter(doc => {
            if (!query)
                return true;
            return ((doc.numDoc && doc.numDoc.toLowerCase().includes(query)) ||
                (doc.chvDoc && doc.chvDoc.toLowerCase().includes(query)) ||
                (doc.partName && doc.partName.toLowerCase().includes(query)) ||
                (doc.type && doc.type.toLowerCase().includes(query)));
        });
        countSpan.textContent = `Exibindo ${filtered.length} de ${docList.length} documentos`;
        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-6 text-center text-gray-400">Nenhum documento encontrado.</td></tr>`;
            return;
        }
        tbody.innerHTML = filtered.map(doc => {
            const isSaida = doc.type === 'Saída';
            const badgeClass = isSaida
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300';
            const isCancelado = doc.codSit === '02' || doc.codSit === '03' || doc.codSit === '04' || doc.codSit === '05';
            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td class="px-4 py-2.5 font-mono text-gray-600 dark:text-gray-400">${doc.reg || 'C100'}</td>
                    <td class="px-4 py-2.5">
                        <div class="flex items-center gap-1.5">
                            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${badgeClass}">
                                ${doc.type}
                            </span>
                            ${isCancelado ? '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">Canc.</span>' : ''}
                        </div>
                    </td>
                    <td class="px-4 py-2.5 font-mono font-medium text-gray-900 dark:text-gray-100" title="${doc.chvDoc ? 'Chave: ' + doc.chvDoc : ''}">
                        <div>${doc.numDoc || '-'}${doc.serie ? ' / ' + doc.serie : ''}</div>
                        ${doc.chvDoc ? `<span class="text-[10px] text-gray-400 dark:text-gray-500 font-mono block truncate max-w-35">${doc.chvDoc}</span>` : ''}
                    </td>
                    <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300 font-mono">${doc.dtDoc || '-'}</td>
                    <td class="px-4 py-2.5 text-gray-900 dark:text-gray-100 max-w-55 truncate" title="${doc.partName || ''}">
                        ${doc.partName || 'Consumidor / Não ident.'}
                    </td>
                    <td class="px-4 py-2.5 text-right font-mono font-bold text-gray-900 dark:text-gray-100">${formatBRL(doc.vlDoc)}</td>
                    <td class="px-4 py-2.5 text-right font-mono text-gray-700 dark:text-gray-300">${formatBRL(doc.vlIcms)}</td>
                    <td class="px-4 py-2.5 text-right font-mono text-gray-700 dark:text-gray-300">${formatBRL((doc.vlPis || 0) + (doc.vlCofins || 0))}</td>
                </tr>
            `;
        }).join('');
    }
    // Render Participants
    function renderParticipantsTable(partList) {
        const tbody = document.getElementById('participantsTableBody');
        const countSpan = document.getElementById('participantCountSummary');
        const query = (searchParticipants?.value || '').toLowerCase().trim();
        const filtered = partList.filter(part => {
            if (!query)
                return true;
            return ((part.name && part.name.toLowerCase().includes(query)) ||
                (part.cnpj_cpf && part.cnpj_cpf.toLowerCase().includes(query)) ||
                (part.codPart && part.codPart.toLowerCase().includes(query)) ||
                (part.city && part.city.toLowerCase().includes(query)));
        });
        countSpan.textContent = `${filtered.length} participantes exibidos`;
        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-gray-400">Nenhum participante encontrado.</td></tr>`;
            return;
        }
        tbody.innerHTML = filtered.map(part => {
            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td class="px-4 py-2.5 font-mono text-gray-500 dark:text-gray-400 font-bold">${part.codPart}</td>
                    <td class="px-4 py-2.5 font-semibold text-gray-900 dark:text-gray-100">${part.name}</td>
                    <td class="px-4 py-2.5 font-mono text-gray-700 dark:text-gray-300">${part.cnpj_cpf || '-'}</td>
                    <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">${part.city ? part.city + (part.state ? ' / ' + part.state : '') : '-'}</td>
                    <td class="px-4 py-2.5">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-gray-300">
                            ${part.role || 'Participante'}
                        </span>
                    </td>
                    <td class="px-4 py-2.5 text-center">
                        <span class="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Sincronizado
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    }
    // Render Products (0200)
    function renderProductsTable(prodList) {
        const tbody = document.getElementById('productsTableBody');
        const countSpan = document.getElementById('productCountSummary');
        if (!tbody)
            return;
        const query = (searchProducts?.value || '').toLowerCase().trim();
        const filtered = prodList.filter(prod => {
            if (!query)
                return true;
            return ((prod.codItem && prod.codItem.toLowerCase().includes(query)) ||
                (prod.descrItem && prod.descrItem.toLowerCase().includes(query)) ||
                (prod.codBarra && prod.codBarra.toLowerCase().includes(query)) ||
                (prod.codNcm && prod.codNcm.toLowerCase().includes(query)) ||
                (prod.cest && prod.cest.toLowerCase().includes(query)));
        });
        if (countSpan)
            countSpan.textContent = `${filtered.length} produtos exibidos`;
        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-6 text-center text-gray-400">Nenhum produto encontrado.</td></tr>`;
            return;
        }
        tbody.innerHTML = filtered.map(prod => {
            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td class="px-4 py-2.5 font-mono font-bold text-gray-900 dark:text-gray-100">${prod.codItem || '-'}</td>
                    <td class="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100 max-w-xs truncate" title="${prod.descrItem || ''}">
                        ${prod.descrItem || '-'}
                    </td>
                    <td class="px-4 py-2.5 font-mono text-gray-700 dark:text-gray-300">${prod.codBarra || '-'}</td>
                    <td class="px-4 py-2.5 text-center font-mono text-gray-600 dark:text-gray-300 font-semibold">${prod.unidInv || 'UN'}</td>
                    <td class="px-4 py-2.5 font-mono text-gray-600 dark:text-gray-300">${prod.codNcm || '-'}</td>
                    <td class="px-4 py-2.5 font-mono text-gray-600 dark:text-gray-300">${prod.cest || '-'}</td>
                    <td class="px-4 py-2.5 text-center">
                        <span class="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            Cadastrado
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    }
    // CFOP Filter Function
    function setCfopFilter(filter) {
        currentCfopFilter = filter;
        const filterBtns = document.querySelectorAll('.filter-cfop-btn');
        filterBtns.forEach(btn => {
            const f = btn.getAttribute('data-filter');
            if (f === filter) {
                btn.classList.add('active', 'bg-white', 'dark:bg-slate-800', 'text-gray-900', 'dark:text-gray-100', 'shadow-xs', 'font-semibold');
                btn.classList.remove('font-medium');
            }
            else {
                btn.classList.remove('active', 'bg-white', 'dark:bg-slate-800', 'shadow-xs', 'font-semibold');
                btn.classList.add('font-medium');
            }
        });
        if (currentSpedData?.cfopDetails) {
            renderCfopTable(currentSpedData.cfopDetails);
        }
    }
    document.getElementById('btnFilterCfopAll')?.addEventListener('click', () => setCfopFilter('all'));
    document.getElementById('btnFilterCfopSaidas')?.addEventListener('click', () => setCfopFilter('saida'));
    document.getElementById('btnFilterCfopEntradas')?.addEventListener('click', () => setCfopFilter('entrada'));
    // Link do mini-quadro na Aba 1 para ir direto ao analítico de Saídas
    const btnTab1VerAliquotas = document.getElementById('btnTab1VerAliquotas');
    if (btnTab1VerAliquotas) {
        btnTab1VerAliquotas.addEventListener('click', () => {
            const tabCfopBtn = document.getElementById('tabCfopBtn');
            if (tabCfopBtn) {
                tabCfopBtn.click();
                setCfopFilter('saida');
                setTimeout(() => {
                    document.getElementById('tabPanelCfop')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        });
    }
    // Search event listeners
    searchCfop?.addEventListener('input', () => {
        if (currentSpedData?.cfopDetails)
            renderCfopTable(currentSpedData.cfopDetails);
    });
    searchDocs?.addEventListener('input', () => {
        if (currentSpedData?.documents)
            renderDocsTable(currentSpedData.documents);
    });
    searchParticipants?.addEventListener('input', () => {
        if (currentSpedData?.participants)
            renderParticipantsTable(currentSpedData.participants);
    });
    searchProducts?.addEventListener('input', () => {
        if (currentSpedData?.products)
            renderProductsTable(currentSpedData.products);
    });
    // Tab Switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => {
                b.classList.remove('active', 'border-teal-500', 'text-teal-600', 'dark:text-teal-400');
                b.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            });
            tabPanels.forEach(p => p.classList.add('hidden'));
            btn.classList.add('active', 'border-teal-500', 'text-teal-600', 'dark:text-teal-400');
            btn.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            const btnId = btn.id;
            if (btnId === 'tabApuracaoBtn')
                document.getElementById('tabPanelApuracao')?.classList.remove('hidden');
            else if (btnId === 'tabCfopBtn')
                document.getElementById('tabPanelCfop')?.classList.remove('hidden');
            else if (btnId === 'tabDocsBtn')
                document.getElementById('tabPanelDocs')?.classList.remove('hidden');
            else if (btnId === 'tabParticipantsBtn')
                document.getElementById('tabPanelParticipants')?.classList.remove('hidden');
            else if (btnId === 'tabProductsBtn')
                document.getElementById('tabPanelProducts')?.classList.remove('hidden');
            else if (btnId === 'tabHeaderBtn')
                document.getElementById('tabPanelHeader')?.classList.remove('hidden');
        });
    });
    // Delete Movement Modal Elements
    const btnOpenDeleteModal = document.getElementById('btnOpenDeleteModal');
    const deleteMovementModal = document.getElementById('deleteMovementModal');
    const btnCancelDeleteModal = document.getElementById('btnCancelDeleteModal');
    const btnConfirmDeleteMovement = document.getElementById('btnConfirmDeleteMovement');
    const deleteModalCompanyName = document.getElementById('deleteModalCompanyName');
    const deleteModalCompetencia = document.getElementById('deleteModalCompetencia');
    const deleteModalSpinner = document.getElementById('deleteModalSpinner');
    const deleteModalBtnText = document.getElementById('deleteModalBtnText');
    function openDeleteModal() {
        const customerId = customerSelect.value;
        const competencia = competenciaInput.value;
        if (!customerId) {
            showAlert('Por favor, selecione uma empresa cadastrada para apagar o movimento.', 'warning');
            customerSelect.focus();
            return;
        }
        if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
            showAlert('Por favor, selecione a competência (Mês/Ano) do movimento a ser apagado.', 'warning');
            competenciaInput.focus();
            return;
        }
        const selectedCust = allRegisteredCompanies.find((c) => String(c.id) === String(customerId));
        const compName = selectedCust?.name || selectedCust?.registered_company_name || 'Empresa #' + customerId;
        if (deleteModalCompanyName)
            deleteModalCompanyName.textContent = compName;
        if (deleteModalCompetencia)
            deleteModalCompetencia.textContent = competencia;
        deleteMovementModal?.classList.remove('hidden');
        deleteMovementModal?.classList.add('flex');
    }
    function closeDeleteModal() {
        deleteMovementModal?.classList.add('hidden');
        deleteMovementModal?.classList.remove('flex');
    }
    async function confirmDeleteMovement() {
        const customerId = customerSelect.value;
        const competencia = competenciaInput.value;
        if (!customerId || !competencia) {
            closeDeleteModal();
            return;
        }
        try {
            if (btnConfirmDeleteMovement)
                btnConfirmDeleteMovement.disabled = true;
            deleteModalSpinner?.classList.remove('hidden');
            if (deleteModalBtnText)
                deleteModalBtnText.textContent = 'Apagando...';
            const response = await api(`/fechamentos/imported-sped-movement?customerId=${customerId}&competencia=${competencia}`, {
                method: 'DELETE'
            });
            if (!response || response.status === 'error') {
                throw new Error(response?.message || 'Falha ao apagar movimento do SPED.');
            }
            closeDeleteModal();
            showAlert(`🗑️ <strong>${response?.message || 'Movimento importado do SPED apagado com sucesso!'}</strong>`, 'success');
            // Clear results view
            resultsSection?.classList.add('hidden');
            currentSpedData = null;
        }
        catch (err) {
            console.error('Erro ao apagar movimento do SPED:', err);
            showAlert(err.message || 'Erro ao apagar o movimento importado.', 'error');
            closeDeleteModal();
        }
        finally {
            if (btnConfirmDeleteMovement)
                btnConfirmDeleteMovement.disabled = false;
            deleteModalSpinner?.classList.add('hidden');
            if (deleteModalBtnText)
                deleteModalBtnText.textContent = 'Sim, Apagar Movimento';
        }
    }
    btnOpenDeleteModal?.addEventListener('click', openDeleteModal);
    btnCancelDeleteModal?.addEventListener('click', closeDeleteModal);
    btnConfirmDeleteMovement?.addEventListener('click', confirmDeleteMovement);
    // Close modal on backdrop click
    deleteMovementModal?.addEventListener('click', (e) => {
        if (e.target === deleteMovementModal)
            closeDeleteModal();
    });
    // Reset all
    btnResetAll?.addEventListener('click', () => {
        customerSelect.value = '';
        initDefaultCompetencia();
        customerDetailsCard.classList.add('hidden');
        resultsSection.classList.add('hidden');
        currentSpedData = null;
        hideAlert();
    });
    // Initial load
    initDefaultCompetencia();
    await loadRegisteredCompanies();
});
