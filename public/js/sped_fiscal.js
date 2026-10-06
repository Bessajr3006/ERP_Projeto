// @ts-nocheck
/**
 * sped_fiscal.ts
 * Lógica da tela de Importação e Análise de SPED Fiscal (EFD ICMS/IPI)
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Requires Authentication
    if (typeof Auth !== 'undefined' && !Auth.isAuthenticated()) {
        return;
    }
    // DOM Elements
    const customerSelect = document.getElementById('customerSelect');
    const customerDetailsCard = document.getElementById('customerDetailsCard');
    const customerCnpjVal = document.getElementById('customerCnpjVal');
    const customerRegimeVal = document.getElementById('customerRegimeVal');
    const customerCompanyAlert = document.getElementById('customerCompanyAlert');
    const customerRegularAlert = document.getElementById('customerRegularAlert');
    const customerCompanyNameVal = document.getElementById('customerCompanyNameVal');
    const dropzoneContainer = document.getElementById('dropzoneContainer');
    const spedFileInput = document.getElementById('spedFileInput');
    const dropzonePrompt = document.getElementById('dropzonePrompt');
    const selectedFileInfo = document.getElementById('selectedFileInfo');
    const selectedFileName = document.getElementById('selectedFileName');
    const selectedFileSize = document.getElementById('selectedFileSize');
    const btnRemoveFile = document.getElementById('btnRemoveFile');
    const btnProcessSped = document.getElementById('btnProcessSped');
    const processIcon = document.getElementById('processIcon');
    const processSpinner = document.getElementById('processSpinner');
    const processBtnText = document.getElementById('processBtnText');
    const btnResetAll = document.getElementById('btnResetAll');
    const btnGoToFechamento = document.getElementById('btnGoToFechamento');
    const alertMessage = document.getElementById('alertMessage');
    const resultsSection = document.getElementById('resultsSection');
    // Company Sync Banner Elements
    const targetCompanyBanner = document.getElementById('targetCompanyBanner');
    const syncCompanyName = document.getElementById('syncCompanyName');
    const syncCustomersCount = document.getElementById('syncCustomersCount');
    const syncSuppliersCount = document.getElementById('syncSuppliersCount');
    const syncProductsCount = document.getElementById('syncProductsCount');
    const syncActionBadge = document.getElementById('syncActionBadge');
    const syncCompanyDesc = document.getElementById('syncCompanyDesc');
    const tabBadgeProdCount = document.getElementById('tabBadgeProdCount');
    // Reimport Notice Banner
    const reimportNoticeBanner = document.getElementById('reimportNoticeBanner');
    const reimportCompetenciaVal = document.getElementById('reimportCompetenciaVal');
    // Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    // Searches
    const searchCfop = document.getElementById('searchCfop');
    const searchDocs = document.getElementById('searchDocs');
    const searchParticipants = document.getElementById('searchParticipants');
    const searchProducts = document.getElementById('searchProducts');
    let allCustomers = [];
    let selectedFile = null;
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
    // Load Customers from backend
    async function loadCustomers() {
        try {
            const response = await api('/entities/customers');
            allCustomers = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
            customerSelect.innerHTML = '<option value="">Selecione um cliente...</option>';
            allCustomers.forEach((cust) => {
                const opt = document.createElement('option');
                opt.value = cust.id;
                const doc = cust.cnpj_cpf ? ` (${cust.cnpj_cpf})` : '';
                const isEmpresa = !!(cust.is_registered_as_company || cust.registered_company_name || cust.registered_company_id);
                const prefix = isEmpresa ? '🏢 [Empresa ERP] ' : '';
                opt.textContent = `${prefix}${cust.name || cust.razao_social || 'Cliente #' + cust.id}${doc}`;
                customerSelect.appendChild(opt);
            });
        }
        catch (err) {
            console.error('Erro ao carregar clientes:', err);
            customerSelect.innerHTML = '<option value="">Erro ao carregar clientes</option>';
            showAlert('Erro ao carregar lista de clientes do servidor.', 'error');
        }
    }
    // Customer Selection Change
    customerSelect.addEventListener('change', () => {
        const custId = customerSelect.value;
        if (!custId) {
            customerDetailsCard.classList.add('hidden');
            customerCompanyAlert?.classList.add('hidden');
            customerRegularAlert?.classList.add('hidden');
            updateProcessButtonState();
            return;
        }
        const selectedCust = allCustomers.find((c) => String(c.id) === String(custId));
        if (selectedCust) {
            customerCnpjVal.textContent = selectedCust.cnpj_cpf || 'Não informado';
            customerRegimeVal.textContent = selectedCust.tax_regime || selectedCust.regime_tributario || 'Simples Nacional';
            const isEmpresa = !!(selectedCust.is_registered_as_company || selectedCust.registered_company_name || selectedCust.registered_company_id);
            if (isEmpresa) {
                if (customerCompanyNameVal)
                    customerCompanyNameVal.textContent = selectedCust.registered_company_name || selectedCust.name || 'Empresa Identificada';
                customerCompanyAlert?.classList.remove('hidden');
                customerRegularAlert?.classList.add('hidden');
            }
            else {
                customerCompanyAlert?.classList.add('hidden');
                customerRegularAlert?.classList.remove('hidden');
            }
            customerDetailsCard.classList.remove('hidden');
        }
        else {
            customerDetailsCard.classList.add('hidden');
            customerCompanyAlert?.classList.add('hidden');
            customerRegularAlert?.classList.add('hidden');
        }
        updateProcessButtonState();
    });
    // File selection & Dropzone handlers
    async function handleSelectedFile(file) {
        if (!file.name.toLowerCase().endsWith('.txt')) {
            showAlert('Por favor, selecione um arquivo de texto válido (.TXT) do SPED Fiscal.', 'error');
            resetFileInput();
            return;
        }
        selectedFile = file;
        selectedFileName.textContent = file.name;
        selectedFileSize.textContent = formatFileSize(file.size);
        dropzonePrompt.classList.add('hidden');
        selectedFileInfo.classList.remove('hidden');
        hideAlert();
        // Auto-detect declaring company from SPED header (|0000|)
        try {
            const headerChunk = await readFileSliceAsText(file, 0, 8192);
            const lines = headerChunk.split(/\r?\n/);
            for (const line of lines) {
                const parts = line.split('|');
                if (parts[1]?.toUpperCase() === '0000') {
                    const nome = parts[6] || '';
                    const cnpj = (parts[7] || '').replace(/\D/g, '');
                    const cpf = (parts[8] || '').replace(/\D/g, '');
                    const doc = cnpj || cpf;
                    if (doc || nome) {
                        const matched = allCustomers.find((c) => {
                            const cDoc = (c.cnpj_cpf || '').replace(/\D/g, '');
                            if (doc && cDoc && cDoc === doc)
                                return true;
                            if (nome && c.name && c.name.toLowerCase().trim() === nome.toLowerCase().trim())
                                return true;
                            return false;
                        });
                        if (matched) {
                            customerSelect.value = String(matched.id);
                            customerSelect.dispatchEvent(new Event('change'));
                            showAlert(`🏢 <strong>Empresa identificada no SPED:</strong> ${matched.name || nome} (${doc || 'Sem CNPJ'}). Todo o movimento fiscal será amarrado a esta empresa.`, 'info');
                        }
                        else if (nome) {
                            showAlert(`🏢 <strong>Empresa declarante no SPED:</strong> ${nome} (${doc || 'Sem CNPJ'}). O movimento fiscal será vinculado e sincronizado a esta empresa no ERP.`, 'info');
                        }
                    }
                    break;
                }
            }
        }
        catch (e) {
            console.warn('Não foi possível ler cabeçalho prévio do SPED:', e);
        }
        updateProcessButtonState();
    }
    function readFileSliceAsText(file, start, end) {
        return new Promise((resolve, reject) => {
            const slice = file.slice(start, end);
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result || '');
            reader.onerror = () => reject(new Error('Erro ao ler pedaço do arquivo SPED.'));
            reader.readAsText(slice, 'ISO-8859-1');
        });
    }
    function formatFileSize(bytes) {
        if (bytes < 1024)
            return bytes + ' bytes';
        if (bytes < 1024 * 1024)
            return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
    function resetFileInput() {
        selectedFile = null;
        if (spedFileInput)
            spedFileInput.value = '';
        dropzonePrompt.classList.remove('hidden');
        selectedFileInfo.classList.add('hidden');
        updateProcessButtonState();
    }
    spedFileInput.addEventListener('change', () => {
        if (spedFileInput.files && spedFileInput.files.length > 0) {
            handleSelectedFile(spedFileInput.files[0]);
        }
    });
    btnRemoveFile.addEventListener('click', (e) => {
        e.stopPropagation();
        resetFileInput();
    });
    // Drag & Drop
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzoneContainer.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzoneContainer.classList.add('border-brand-500', 'bg-brand-50/50', 'dark:bg-slate-700/50');
        }, false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropzoneContainer.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzoneContainer.classList.remove('border-brand-500', 'bg-brand-50/50', 'dark:bg-slate-700/50');
        }, false);
    });
    dropzoneContainer.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
            handleSelectedFile(dt.files[0]);
        }
    });
    function updateProcessButtonState() {
        const hasFile = !!selectedFile;
        btnProcessSped.disabled = !hasFile;
    }
    // Process SPED
    btnProcessSped.addEventListener('click', async () => {
        if (!selectedFile) {
            showAlert('Selecione o arquivo SPED Fiscal para continuar.', 'warning');
            return;
        }
        const customerId = customerSelect.value ? Number(customerSelect.value) : null;
        try {
            // Set loading state
            btnProcessSped.disabled = true;
            processIcon.classList.add('hidden');
            processSpinner.classList.remove('hidden');
            processBtnText.textContent = 'Processando SPED...';
            hideAlert();
            const fileText = await readFileAsText(selectedFile);
            const response = await api('/fechamentos/import-sped-fiscal', {
                method: 'POST',
                body: JSON.stringify({
                    customerId: customerId || undefined,
                    fileContent: fileText
                })
            });
            if (!response || response.status === 'error') {
                throw new Error(response?.message || 'Falha ao processar arquivo SPED Fiscal.');
            }
            const data = response.data || response;
            currentSpedData = data;
            // Se uma empresa/cliente correspondente foi identificada, sincroniza a seleção no dropdown
            if (data.header?.cnpj_cpf || data.targetCompany?.id) {
                const docClean = (data.header?.cnpj_cpf || '').replace(/\D/g, '');
                const matched = allCustomers.find((c) => {
                    const cDoc = (c.cnpj_cpf || '').replace(/\D/g, '');
                    return docClean && cDoc === docClean;
                });
                if (matched && String(customerSelect.value) !== String(matched.id)) {
                    customerSelect.value = String(matched.id);
                    customerSelect.dispatchEvent(new Event('change'));
                }
            }
            renderSpedResults(data);
            const impStats = data.importedStats;
            const isUpdate = !!(impStats?.isUpdate || impStats?.fechamentoAction === 'updated');
            const compName = impStats?.companyName || data.header?.nome;
            if (isUpdate) {
                showAlert(`🔄 <strong>Alteração realizada com sucesso!</strong> O Fechamento Fiscal da competência <strong>${impStats?.competencia || ''}</strong> foi <strong>atualizado</strong> e vinculado à empresa <strong>${compName || 'do arquivo'}</strong> (${impStats?.importedCustomersCount || 0} clientes, ${impStats?.importedSuppliersCount || 0} fornecedores e ${impStats?.importedProductsCount || 0} produtos sincronizados).`, 'info');
            }
            else {
                showAlert(`✨ <strong>Importação realizada com sucesso!</strong> O Fechamento Fiscal da competência <strong>${impStats?.competencia || ''}</strong> foi <strong>lançado</strong> e vinculado à empresa <strong>${compName || 'do arquivo'}</strong> (${impStats?.importedCustomersCount || 0} clientes, ${impStats?.importedSuppliersCount || 0} fornecedores e ${impStats?.importedProductsCount || 0} produtos cadastrados).`, 'success');
            }
        }
        catch (err) {
            console.error('Erro no processamento do SPED:', err);
            showAlert(err.message || 'Erro inesperado ao processar o arquivo SPED Fiscal.', 'error');
        }
        finally {
            btnProcessSped.disabled = false;
            processIcon.classList.remove('hidden');
            processSpinner.classList.add('hidden');
            processBtnText.textContent = 'Processar Arquivo SPED';
        }
    });
    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Erro ao ler o conteúdo do arquivo.'));
            reader.readAsText(file, 'ISO-8859-1'); // SPED files are usually ISO-8859-1 / Windows-1252
        });
    }
    // Render results
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
        // Banner de Reimportação / Alteração
        const isUpdate = !!(impStats?.isUpdate || impStats?.fechamentoAction === 'updated');
        if (reimportNoticeBanner) {
            if (isUpdate) {
                reimportNoticeBanner.classList.remove('hidden');
                if (reimportCompetenciaVal) {
                    let compDisplay = impStats?.competencia || '';
                    if (!compDisplay && header.dt_ini && header.dt_ini.includes('/')) {
                        const parts = header.dt_ini.split('/');
                        if (parts.length === 3)
                            compDisplay = `${parts[1]}/${parts[2]}`;
                    }
                    reimportCompetenciaVal.textContent = compDisplay || 'do período';
                }
            }
            else {
                reimportNoticeBanner.classList.add('hidden');
            }
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
                if (syncActionBadge) {
                    if (isUpdate) {
                        syncActionBadge.textContent = 'Reimportação / Atualização';
                        syncActionBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-200 dark:bg-sky-900 text-sky-800 dark:text-sky-300';
                    }
                    else {
                        syncActionBadge.textContent = 'Empresa Identificada';
                        syncActionBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300';
                    }
                }
                if (syncCompanyDesc) {
                    if (isUpdate) {
                        syncCompanyDesc.textContent = 'Atenção: Os dados deste período foram atualizados com sucesso no fechamento fiscal e nos cadastros da empresa vinculada.';
                    }
                    else {
                        syncCompanyDesc.textContent = 'Como este cliente corresponde a uma empresa cadastrada no ERP, os participantes e produtos do SPED foram integrados e o fechamento fiscal foi salvo automaticamente.';
                    }
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
        if (tabBadgeProdCount)
            tabBadgeProdCount.textContent = String(data.products?.length || stats.totalProducts || 0);
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
        // Tab 2: CFOPs Table
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
            let comp = '';
            if (header.dt_ini && header.dt_ini.includes('/')) {
                const parts = header.dt_ini.split('/');
                if (parts.length === 3)
                    comp = `${parts[2]}-${parts[1]}`;
            }
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
            tbody.innerHTML = `<tr><td colspan="5" class="px-3 py-3 text-center text-gray-400">Nenhuma guia E116 informada no arquivo SPED.</td></tr>`;
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
            tbody.innerHTML = `<tr><td colspan="5" class="px-3 py-3 text-center text-gray-400">Nenhuma guia de FECP detalhada individualmente no arquivo.</td></tr>`;
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
    // Render CFOPs
    function renderCfopTable(cfopList) {
        const tbody = document.getElementById('cfopTableBody');
        const countSpan = document.getElementById('cfopCountSummary');
        const query = (searchCfop?.value || '').toLowerCase().trim();
        const filtered = cfopList.filter(item => {
            if (!query)
                return true;
            return item.cfop.toLowerCase().includes(query) || item.type.toLowerCase().includes(query);
        });
        countSpan.textContent = `${filtered.length} CFOPs encontrados`;
        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-6 text-center text-gray-400">Nenhum CFOP corresponde à busca.</td></tr>`;
            return;
        }
        tbody.innerHTML = filtered.map(item => {
            const isSaida = item.type === 'Saída';
            const badgeClass = isSaida
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300';
            const barClass = isSaida ? 'bg-emerald-500' : 'bg-blue-500';
            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td class="px-4 py-3 font-mono font-bold text-gray-900 dark:text-gray-100">${item.cfop}</td>
                    <td class="px-4 py-3">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${badgeClass}">
                            ${item.type}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-right font-mono font-semibold text-gray-900 dark:text-gray-100">${formatBRL(item.total)}</td>
                    <td class="px-4 py-3">
                        <div class="flex items-center gap-2">
                            <div class="flex-1 bg-gray-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                <div class="${barClass} h-full rounded-full" style="width: ${Math.min(100, item.percent)}%"></div>
                            </div>
                            <span class="font-mono text-xs text-gray-500 dark:text-gray-400 w-12 text-right">${item.percent.toFixed(1)}%</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
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
            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td class="px-4 py-2.5 font-mono text-gray-600 dark:text-gray-400">${doc.reg || 'C100'}</td>
                    <td class="px-4 py-2.5">
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${badgeClass}">
                            ${doc.type}
                        </span>
                    </td>
                    <td class="px-4 py-2.5 font-mono font-medium text-gray-900 dark:text-gray-100">
                        ${doc.numDoc || '-'}${doc.serie ? ' / ' + doc.serie : ''}
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
                            Sincronizado
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
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
                b.classList.remove('active', 'border-brand-500', 'text-brand-600', 'dark:text-brand-400');
                b.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            });
            tabPanels.forEach(p => p.classList.add('hidden'));
            btn.classList.add('active', 'border-brand-500', 'text-brand-600', 'dark:text-brand-400');
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
    // Reset all
    btnResetAll.addEventListener('click', () => {
        customerSelect.value = '';
        customerDetailsCard.classList.add('hidden');
        customerCompanyAlert?.classList.add('hidden');
        customerRegularAlert?.classList.add('hidden');
        if (targetCompanyBanner)
            targetCompanyBanner.classList.add('hidden');
        if (reimportNoticeBanner)
            reimportNoticeBanner.classList.add('hidden');
        resetFileInput();
        resultsSection.classList.add('hidden');
        currentSpedData = null;
        hideAlert();
    });
    // Initial load
    await loadCustomers();
});
