// @ts-nocheck
(() => {
    let g_companyPublicId = null;
    let g_companySnapshot = null;
    let docMask, phoneMask, zipMask;
    let g_ibgeStates = [];
    const makeMask = window.createMaskAdapter || ((input, options) => window.IMask(input, options));
    const COMPANY_LOGO_MAX_BYTES = 2 * 1024 * 1024;
    const COMPANY_LOGO_ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
    let g_companyLogoPreviewVersion = 0;
    function onlyDigits(value) {
        return String(value || '').replace(/\D/g, '');
    }
    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    function setCompanyLogoPreviewState({ src = '', fileName = '', showPreview = false } = {}) {
        const preview = document.getElementById('companyLogoPreview');
        const container = document.getElementById('companyLogoPreviewContainer');
        const actions = document.getElementById('companyLogoActions');
        const fileNameLabel = document.getElementById('companyLogoFileName');
        if (!preview || !container || !actions || !fileNameLabel)
            return;
        preview.src = src;
        preview.classList.toggle('hidden', !showPreview);
        container.classList.toggle('hidden', showPreview);
        actions.classList.toggle('hidden', !showPreview);
        actions.classList.toggle('flex', showPreview);
        fileNameLabel.textContent = fileName;
    }
    function getCompanyLogoBase64Src(logoBase64) {
        if (!logoBase64)
            return '';
        const value = String(logoBase64);
        return value.startsWith('data:') ? value : `data:image/jpeg;base64,${value}`;
    }
    function setCompanyLogoDropzoneActive(isActive) {
        const dropzone = document.getElementById('companyLogoDropzone');
        if (!dropzone)
            return;
        dropzone.classList.toggle('border-brand-500', isActive);
        dropzone.classList.toggle('bg-brand-50', isActive);
        dropzone.classList.toggle('dark:border-brand-400', isActive);
        dropzone.classList.toggle('ring-2', isActive);
        dropzone.classList.toggle('ring-brand-100', isActive);
    }
    function syncStoredCompanyLogoState() {
        const logoInput = document.getElementById('companyLogoFile');
        const logoInfo = document.getElementById('companyLogoInfo');
        if (logoInput)
            logoInput.value = '';
        setCompanyLogoDropzoneActive(false);
        const logoBase64Src = getCompanyLogoBase64Src(g_companySnapshot?.logo_base64);
        if (logoBase64Src || g_companySnapshot?.logo_url) {
            const logoUrl = String(g_companySnapshot?.logo_url || '');
            const separator = logoUrl.includes('?') ? '&' : '?';
            setCompanyLogoPreviewState({
                src: logoBase64Src || (g_companyLogoPreviewVersion ? `${logoUrl}${separator}v=${g_companyLogoPreviewVersion}` : logoUrl),
                fileName: g_companySnapshot.logo_filename || 'Logo atual da empresa',
                showPreview: true,
            });
            if (logoInfo)
                logoInfo.textContent = g_companySnapshot.logo_filename ? `Logo atual: ${g_companySnapshot.logo_filename}` : 'Logo atual salva.';
            return;
        }
        setCompanyLogoPreviewState();
        if (logoInfo)
            logoInfo.textContent = 'Nenhuma logo salva.';
    }
    function setMaskedValue(maskInstance, inputId, value) {
        if (maskInstance) {
            maskInstance.unmaskedValue = onlyDigits(value);
            return;
        }
        const input = document.getElementById(inputId);
        if (input) {
            input.value = value || '';
        }
    }
    function getMaskedValue(maskInstance, inputId) {
        if (maskInstance) {
            return maskInstance.unmaskedValue || '';
        }
        return onlyDigits(document.getElementById(inputId)?.value || '');
    }
    function populateIbgeStateOptions(selectedValue = '') {
        const stateSelect = document.getElementById('state');
        if (!stateSelect || !g_ibgeStates.length)
            return;
        const normalizedSelectedValue = String(selectedValue || '').trim().toUpperCase();
        stateSelect.innerHTML = [
            '<option value="">Selecione...</option>',
            ...g_ibgeStates.map((state) => `<option value="${state.uf}">${state.uf} - ${state.name}</option>`),
        ].join('');
        stateSelect.value = g_ibgeStates.some((state) => state.uf === normalizedSelectedValue) ? normalizedSelectedValue : '';
    }
    async function loadIbgeStateOptions(selectedValue = '') {
        try {
            const response = await api('/companies/states');
            g_ibgeStates = response.data || [];
            populateIbgeStateOptions(selectedValue);
        }
        catch (error) {
            console.error('Falha ao carregar estados do IBGE', error);
        }
    }
    async function lookupAddressByCep(cep) {
        const normalizedCep = onlyDigits(cep);
        if (normalizedCep.length !== 8)
            return null;
        let data = null;
        let cepNotFound = false;
        try {
            const response = await fetch(`https://viacep.com.br/ws/${normalizedCep}/json/`);
            if (response.ok) {
                const viaCepData = await response.json();
                if (!viaCepData.erro) {
                    data = {
                        street: viaCepData.logradouro,
                        neighborhood: viaCepData.bairro,
                        city: viaCepData.localidade,
                        state: viaCepData.uf,
                        complement: viaCepData.complemento,
                    };
                }
                else {
                    cepNotFound = true;
                }
            }
        }
        catch (_error) {
            // Fallback handled below.
        }
        if (!data && !cepNotFound) {
            try {
                const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${normalizedCep}`);
                if (response.ok) {
                    data = await response.json();
                }
            }
            catch (_error) {
                // Ignore and let caller handle null.
            }
        }
        return data;
    }
    function applyCepResultToCompanyProfile(data) {
        if (!data)
            return;
        document.getElementById('street').value = data.street || '';
        document.getElementById('neighborhood').value = data.neighborhood || '';
        document.getElementById('city').value = data.city || '';
        if (data.complement && !document.getElementById('complement').value.trim()) {
            document.getElementById('complement').value = data.complement;
        }
        populateIbgeStateOptions(data.state || '');
    }
    async function handleCompanyProfileCepLookup() {
        const cep = getMaskedValue(zipMask, 'zipcode');
        if (cep.length !== 8)
            return;
        const loader = document.getElementById('cepLoading');
        if (loader)
            loader.classList.remove('hidden');
        try {
            const data = await lookupAddressByCep(cep);
            if (data && (data.street || data.city)) {
                applyCepResultToCompanyProfile(data);
            }
            else {
                UI.showAlert('alertMessage', 'CEP não encontrado ou inválido.', 'error', 3000);
                document.getElementById('street').value = '';
                document.getElementById('neighborhood').value = '';
                document.getElementById('city').value = '';
                populateIbgeStateOptions('');
            }
        }
        catch (error) {
            console.error('CEP Error:', error);
        }
        finally {
            if (loader)
                loader.classList.add('hidden');
        }
    }
    async function handleCompanyProfileCnpjLookup() {
        const cnpj = getMaskedValue(docMask, 'cnpj');
        if (cnpj.length !== 14)
            return;
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
            const data = await response.json();
            if (!response.ok || !data?.razao_social) {
                UI.showAlert('alertMessage', 'CNPJ não encontrado ou inválido.', 'error', 3000);
                return;
            }
            document.getElementById('companyName').value = data.razao_social || '';
            if (!document.getElementById('tradeName').value.trim()) {
                document.getElementById('tradeName').value = data.nome_fantasia || data.razao_social || '';
            }
            if (data.opcao_pelo_simples && !document.getElementById('parameterTaxRegime').value.trim()) {
                document.getElementById('parameterTaxRegime').value = 'Simples Nacional';
            }
            if (!document.getElementById('email').value.trim()) {
                document.getElementById('email').value = data.email || '';
            }
            if (!getMaskedValue(phoneMask, 'phone')) {
                setMaskedValue(phoneMask, 'phone', data.ddd_telefone_1 || '');
            }
            if (data.cep) {
                setMaskedValue(zipMask, 'zipcode', data.cep);
            }
            document.getElementById('street').value = data.logradouro || document.getElementById('street').value || '';
            document.getElementById('number').value = data.numero || document.getElementById('number').value || '';
            document.getElementById('complement').value = data.complemento || document.getElementById('complement').value || '';
            document.getElementById('neighborhood').value = data.bairro || document.getElementById('neighborhood').value || '';
            document.getElementById('city').value = data.municipio || document.getElementById('city').value || '';
            populateIbgeStateOptions(data.uf || '');
            if (data.cep) {
                const cepData = await lookupAddressByCep(data.cep);
                if (cepData) {
                    applyCepResultToCompanyProfile({
                        ...cepData,
                        complement: cepData.complement || data.complemento || '',
                    });
                }
            }
        }
        catch (error) {
            console.error('CNPJ Error:', error);
        }
    }
    function refreshParameterSummary() {
        const activeToggle = document.getElementById('companyActive');
        const autoPrintToggle = document.getElementById('allowPrintWithoutConfirmation');
        const activeBadge = document.getElementById('parameterStatusBadge');
        const activeHint = document.getElementById('parameterActiveHint');
        const printHint = document.getElementById('parameterPrintHint');
        const printModeTitle = document.getElementById('parameterPrintModeTitle');
        const printModeMeta = document.getElementById('parameterPrintModeMeta');
        const printImpact = document.getElementById('parameterPrintImpact');
        const stateSource = document.getElementById('state');
        const statePreview = document.getElementById('parameterStatePreview');
        const active = activeToggle ? activeToggle.checked : (g_companySnapshot?.is_active !== false);
        if (activeBadge) {
            activeBadge.textContent = active ? 'Operação ativa' : 'Operação inativa';
            activeBadge.className = active
                ? 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
        }
        if (activeHint) {
            activeHint.textContent = active
                ? 'A empresa está apta para operar e receber movimentações.'
                : 'A empresa está marcada como inativa e deve ser revisada antes de operar.';
        }
        if (statePreview) {
            statePreview.value = (stateSource?.value || g_companySnapshot?.state || '').trim() || 'Não definido';
        }
        if (printHint) {
            const autoPrint = autoPrintToggle ? autoPrintToggle.checked : !!g_companySnapshot?.allow_print_without_confirmation;
            printHint.textContent = autoPrint
                ? 'O comprovante será impresso automaticamente ao concluir a venda.'
                : 'O sistema vai perguntar antes de imprimir o comprovante da venda.';
            if (printModeTitle) {
                printModeTitle.textContent = autoPrint ? 'Impressão automática' : 'Solicitar confirmação';
            }
            if (printModeMeta) {
                printModeMeta.textContent = autoPrint
                    ? 'Agiliza o fechamento e elimina a etapa manual de confirmação.'
                    : 'Mais controle para o operador no fechamento da venda.';
            }
            if (printImpact) {
                printImpact.textContent = autoPrint
                    ? 'Ideal para operação contínua em balcão, quando toda venda deve sair com comprovante sem intervenção adicional.'
                    : 'Indicado para caixas que precisam confirmar a impressão manualmente a cada venda.';
            }
        }
    }
    function formatDateTimeDisplay(value) {
        if (!value) {
            return '-';
        }
        const numericValue = Number(value);
        const parsed = Number.isFinite(numericValue) && String(value).trim() !== ''
            ? new Date(numericValue < 1000000000000 ? numericValue * 1000 : numericValue)
            : new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return String(value);
        }
        return parsed.toLocaleString('pt-BR');
    }
    function setConsultaJson(value) {
        const resultEl = document.getElementById('consultaResult');
        if (!resultEl)
            return;
        if (typeof value === 'string') {
            resultEl.value = value;
            return;
        }
        resultEl.value = JSON.stringify(value, null, 2);
    }
    function openConsultaModal(value = '') {
        setConsultaJson(value);
        document.getElementById('consultaModal')?.classList.remove('hidden');
    }
    function closeConsultaModal() {
        document.getElementById('consultaModal')?.classList.add('hidden');
    }
    async function consultSolidconUrl(inputId) {
        const input = document.getElementById(inputId);
        const url = String(input?.value || '').trim();
        if (!url) {
            openConsultaModal({ error: 'Informe a URL de integração antes de consultar.' });
            return;
        }
        openConsultaModal({ status: 'consultando', url });
        try {
            const response = await api('/companies/proxy-consulta', {
                method: 'POST',
                body: JSON.stringify({ url }),
            });
            setConsultaJson(response?.data || response);
        }
        catch (error) {
            setConsultaJson({
                error: error?.message || 'Falha ao consultar a URL Solidcon.',
                url,
            });
        }
    }
    document.addEventListener('DOMContentLoaded', async () => {
        // Setup masks
        const docInput = document.getElementById('cnpj');
        if (docInput) {
            docMask = makeMask(docInput, {
                mask: [
                    { mask: '000.000.000-00' }, // CPF
                    { mask: '00.000.000/0000-00' } // CNPJ
                ]
            });
            docInput.addEventListener('blur', handleCompanyProfileCnpjLookup);
        }
        const phoneInput = document.getElementById('phone');
        if (phoneInput) {
            phoneMask = makeMask(phoneInput, {
                mask: [
                    { mask: '(00) 0000-0000' }, // Fixo
                    { mask: '(00) 00000-0000' } // Celular
                ]
            });
        }
        const zipInput = document.getElementById('zipcode');
        if (zipInput) {
            zipMask = makeMask(zipInput, { mask: '00000-000' });
            zipMask.on('complete', handleCompanyProfileCepLookup);
        }
        await loadIbgeStateOptions(document.getElementById('state')?.value || '');
        try {
            const userInfo = await api('/auth/me');
            if (userInfo && userInfo.data && userInfo.data.company) {
                const company = userInfo.data.company;
                g_companySnapshot = { ...company };
                g_companyPublicId = company.public_id;
                const publicIdEl = document.getElementById('companyPublicId');
                if (publicIdEl)
                    publicIdEl.value = company.public_id || '';
                const copyIdBtn = document.getElementById('copyCompanyIdBtn');
                if (copyIdBtn) {
                    copyIdBtn.addEventListener('click', () => {
                        const pid = company.public_id || '';
                        if (!pid)
                            return;
                        navigator.clipboard.writeText(pid).then(() => {
                            const orig = copyIdBtn.innerHTML;
                            copyIdBtn.innerHTML = '<svg class="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
                            setTimeout(() => { copyIdBtn.innerHTML = orig; }, 1500);
                        });
                    });
                }
                document.getElementById('tradeName').value = company.trade_name || '';
                document.getElementById('companyName').value = company.company_name || '';
                document.getElementById('email').value = company.email || '';
                document.getElementById('street').value = company.street || '';
                document.getElementById('number').value = company.number || '';
                document.getElementById('complement').value = company.complement || '';
                document.getElementById('neighborhood').value = company.neighborhood || '';
                document.getElementById('city').value = company.city || '';
                const taxRegimeEl = document.getElementById('parameterTaxRegime');
                if (taxRegimeEl)
                    taxRegimeEl.value = company.tax_regime || '';
                const companyActiveEl = document.getElementById('companyActive');
                if (companyActiveEl)
                    companyActiveEl.checked = company.is_active !== false;
                const allowPrintEl = document.getElementById('allowPrintWithoutConfirmation');
                if (allowPrintEl)
                    allowPrintEl.checked = !!company.allow_print_without_confirmation;
                const statePreviewEl = document.getElementById('parameterStatePreview');
                if (statePreviewEl)
                    statePreviewEl.value = company.state || 'Não definido';
                populateIbgeStateOptions(company.state || '');
                if (docMask && company.cnpj) {
                    setMaskedValue(docMask, 'cnpj', company.cnpj);
                    const hiddenUser = document.getElementById('cert_cnpj_hidden');
                    if (hiddenUser)
                        hiddenUser.value = company.cnpj;
                }
                if (phoneMask && company.phone) {
                    setMaskedValue(phoneMask, 'phone', company.phone);
                }
                if (zipMask && company.zipcode) {
                    setMaskedValue(zipMask, 'zipcode', company.zipcode);
                }
                const pwdInput = document.getElementById('certificatePassword');
                if (pwdInput && company.certificate_password) {
                    pwdInput.value = company.certificate_password;
                }
                if (company.certificate_expiration) {
                    const testBtn = document.getElementById('testNfeBtn');
                    if (testBtn) {
                        testBtn.classList.remove('hidden');
                        testBtn.classList.add('inline-flex');
                    }
                }
                if (company.api_token) {
                    const apiTokenEl = document.getElementById('apiToken');
                    if (apiTokenEl)
                        apiTokenEl.value = company.api_token;
                }
                if (company.solidcon_api_token) {
                    const solidconTokenEl = document.getElementById('solidconToken');
                    if (solidconTokenEl)
                        solidconTokenEl.value = company.solidcon_api_token;
                }
                if (company.swagger_api_token) {
                    const swaggerTokenEl = document.getElementById('swaggerToken');
                    if (swaggerTokenEl)
                        swaggerTokenEl.value = company.swagger_api_token;
                }
                for (let i = 1; i <= 5; i++) {
                    if (company[`solidcon_url_${i}`]) {
                        const el = document.getElementById(`solidconUrl${i}`);
                        if (el)
                            el.value = company[`solidcon_url_${i}`];
                    }
                }
                syncStoredCompanyLogoState();
                // Populate Notas fields
                const notasMapping = {
                    'inscricaoEstadual': 'ie',
                    'inscricaoMunicipal': 'im',
                    'cnae': 'cnae_principal',
                    'nfeAmbiente': 'nfe_environment',
                    'nfeSerie': 'nfe_series',
                    'nfeNumero': 'nfe_number',
                    'nfceSerie': 'nfce_series',
                    'nfceNumero': 'nfce_number',
                    'cscToken': 'csc_token',
                    'cscId': 'csc_id'
                };
                for (const [domId, modelProp] of Object.entries(notasMapping)) {
                    const el = document.getElementById(domId);
                    if (el && company[modelProp] !== undefined && company[modelProp] !== null) {
                        el.value = String(company[modelProp]);
                    }
                }
                refreshParameterSummary();
            }
        }
        catch (e) {
            console.error('Falha ao inicializar a tela Minha Empresa', e);
            if (!g_companySnapshot?.public_id) {
                UI.showAlert('alertMessage', 'Erro ao carregar os dados da empresa. Tente fazer login novamente.', 'error');
            }
        }
        // Token logic (Pos-Controll)
        const btnGenerateToken = document.getElementById('generateTokenBtn');
        if (btnGenerateToken) {
            btnGenerateToken.addEventListener('click', async () => {
                if (!confirm('Atenção: Gerar um novo token invalidará o token anterior. Tem certeza que deseja gerar um novo token de API?'))
                    return;
                const originalText = btnGenerateToken.textContent;
                btnGenerateToken.textContent = 'Gerando...';
                btnGenerateToken.disabled = true;
                // Generate an alphanumeric token
                const newToken = 'pt_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
                    .map(b => b.toString(16).padStart(2, '0')).join('');
                try {
                    // Save it right away
                    await api(`/companies/${g_companyPublicId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ api_token: newToken })
                    });
                    g_companySnapshot = { ...(g_companySnapshot || {}), api_token: newToken };
                    document.getElementById('apiToken').value = newToken;
                    refreshParameterSummary();
                    UI.showAlert('alertMessage', 'Novo Token de API gerado com sucesso!', 'success');
                }
                catch (err) {
                    UI.showAlert('alertMessage', err.message || 'Erro ao gerar token', 'error');
                }
                finally {
                    btnGenerateToken.textContent = originalText;
                    btnGenerateToken.disabled = false;
                }
            });
        }
        // Token logic (Solidcon)
        const btnGenerateSolidconToken = document.getElementById('generateSolidconTokenBtn');
        if (btnGenerateSolidconToken) {
            btnGenerateSolidconToken.addEventListener('click', async () => {
                if (!confirm('Atenção: Gerar um novo token invalidará a integração Solidcon anterior. Confirmar?'))
                    return;
                const originalText = btnGenerateSolidconToken.textContent;
                btnGenerateSolidconToken.textContent = 'Gerando...';
                btnGenerateSolidconToken.disabled = true;
                // Generate an alphanumeric token
                const newToken = 'sdc_' + Array.from(crypto.getRandomValues(new Uint8Array(20)))
                    .map(b => b.toString(16).padStart(2, '0')).join('');
                try {
                    // Save it right away
                    await api(`/companies/${g_companyPublicId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ solidcon_api_token: newToken })
                    });
                    g_companySnapshot = { ...(g_companySnapshot || {}), solidcon_api_token: newToken };
                    document.getElementById('solidconToken').value = newToken;
                    refreshParameterSummary();
                    UI.showAlert('alertMessage', 'Token Solidcon gerado com sucesso!', 'success');
                }
                catch (err) {
                    UI.showAlert('alertMessage', err.message || 'Erro ao gerar token Solidcon', 'error');
                }
                finally {
                    btnGenerateSolidconToken.textContent = originalText;
                    btnGenerateSolidconToken.disabled = false;
                }
            });
        }
        // Token logic (Swagger)
        const btnGenerateSwaggerToken = document.getElementById('generateSwaggerTokenBtn');
        if (btnGenerateSwaggerToken) {
            btnGenerateSwaggerToken.addEventListener('click', async () => {
                if (!confirm('Atenção: Gerar um novo token invalidará o token anterior. Confirmar?'))
                    return;
                const originalText = btnGenerateSwaggerToken.textContent;
                btnGenerateSwaggerToken.textContent = 'Gerando...';
                btnGenerateSwaggerToken.disabled = true;
                const newToken = 'swg_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
                    .map(b => b.toString(16).padStart(2, '0')).join('');
                try {
                    await api(`/companies/${g_companyPublicId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ swagger_api_token: newToken })
                    });
                    g_companySnapshot = { ...(g_companySnapshot || {}), swagger_api_token: newToken };
                    document.getElementById('swaggerToken').value = newToken;
                    refreshParameterSummary();
                    UI.showAlert('alertMessage', 'Token Swagger gerado com sucesso!', 'success');
                }
                catch (err) {
                    UI.showAlert('alertMessage', err.message || 'Erro ao gerar token Swagger', 'error');
                }
                finally {
                    btnGenerateSwaggerToken.textContent = originalText;
                    btnGenerateSwaggerToken.disabled = false;
                }
            });
        }
        const btnCopySwaggerToken = document.getElementById('copySwaggerTokenBtn');
        if (btnCopySwaggerToken) {
            btnCopySwaggerToken.addEventListener('click', async () => {
                const tokenValue = String(document.getElementById('swaggerToken')?.value || '').trim();
                if (!tokenValue) {
                    UI.showAlert('alertMessage', 'Nenhum token Swagger para copiar.', 'warning');
                    return;
                }
                try {
                    await navigator.clipboard.writeText(tokenValue);
                    UI.showAlert('alertMessage', 'Token copiado para a área de transferência.', 'success');
                }
                catch (_error) {
                    const input = document.getElementById('swaggerToken');
                    input?.select?.();
                    UI.showAlert('alertMessage', 'Selecione o token e copie manualmente.', 'error');
                }
            });
        }
        const solidconForm = document.getElementById('solidconForm');
        if (solidconForm) {
            solidconForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('saveSolidconBtn');
                const originalText = btn ? btn.textContent : '';
                if (btn) {
                    btn.textContent = 'Salvando...';
                    btn.disabled = true;
                }
                try {
                    if (!g_companyPublicId) {
                        throw new Error('ID da empresa não processado. Tente recarregar a página.');
                    }
                    const updateData = {};
                    for (let i = 1; i <= 5; i++) {
                        updateData[`solidcon_url_${i}`] = document.getElementById(`solidconUrl${i}`)?.value?.trim() || '';
                    }
                    await api(`/companies/${g_companyPublicId}`, {
                        method: 'PUT',
                        body: JSON.stringify(updateData)
                    });
                    g_companySnapshot = { ...(g_companySnapshot || {}), ...updateData };
                    refreshParameterSummary();
                    UI.showAlert('alertMessage', 'Integração Solidcon salva com sucesso!', 'success');
                }
                catch (err) {
                    UI.showAlert('alertMessage', err.message || 'Erro ao salvar integração Solidcon', 'error');
                }
                finally {
                    if (btn) {
                        btn.textContent = originalText;
                        btn.disabled = false;
                    }
                }
            });
        }
        document.getElementById('btnConsultSolidconUrl1')?.addEventListener('click', () => {
            void consultSolidconUrl('solidconUrl1');
        });
        document.getElementById('btnConsultSolidconUrl2')?.addEventListener('click', () => {
            void consultSolidconUrl('solidconUrl2');
        });
        document.querySelectorAll('.btn-close-consulta, .modal-backdrop').forEach((element) => {
            element.addEventListener('click', closeConsultaModal);
        });
        document.getElementById('btnCopyConsultaJson')?.addEventListener('click', async () => {
            const resultEl = document.getElementById('consultaResult');
            const value = resultEl?.value || '';
            if (!value)
                return;
            try {
                await navigator.clipboard.writeText(value);
                UI.showAlert('alertMessage', 'JSON copiado para a área de transferência.', 'success');
            }
            catch (_error) {
                resultEl?.select?.();
                UI.showAlert('alertMessage', 'Selecione o JSON e copie manualmente.', 'error');
            }
        });
        const form = document.getElementById('companyForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('saveBtn');
                const originalText = btn.textContent;
                btn.textContent = 'Salvando...';
                btn.disabled = true;
                const data = {
                    trade_name: document.getElementById('tradeName').value,
                    company_name: document.getElementById('companyName').value || undefined,
                    cnpj: docMask ? docMask.unmaskedValue : (document.getElementById('cnpj').value || undefined),
                    email: document.getElementById('email').value || undefined,
                    phone: phoneMask ? phoneMask.unmaskedValue : (document.getElementById('phone').value || undefined),
                    zipcode: zipMask ? zipMask.unmaskedValue : (document.getElementById('zipcode').value || undefined),
                    street: document.getElementById('street').value || undefined,
                    number: document.getElementById('number').value || undefined,
                    complement: document.getElementById('complement').value || undefined,
                    neighborhood: document.getElementById('neighborhood').value || undefined,
                    city: document.getElementById('city').value || undefined,
                    state: document.getElementById('state').value || undefined
                };
                try {
                    if (!g_companyPublicId) {
                        throw new Error("ID da empresa não processado. Tente recarregar a página.");
                    }
                    await api(`/companies/${g_companyPublicId}`, {
                        method: 'PUT',
                        body: JSON.stringify(data)
                    });
                    g_companySnapshot = { ...(g_companySnapshot || {}), ...data };
                    refreshParameterSummary();
                    UI.showAlert('alertMessage', 'Dados da empresa atualizados com sucesso!', 'success');
                }
                catch (err) {
                    UI.showAlert('alertMessage', err.message || 'Erro ao atualizar dados da empresa', 'error');
                }
                finally {
                    btn.textContent = originalText;
                    btn.disabled = false;
                }
            });
        }
        // Certificate tab logic
        const certFileInput = document.getElementById('certificateFile');
        const certUploadZone = document.getElementById('certificateUploadZone');
        const certFileNameDisplay = document.getElementById('certificateFileName');
        const certInstalledInfo = document.getElementById('certificateInstalledInfo');
        const clearCertificateFileBtn = document.getElementById('clearCertificateFileBtn');
        let selectedCertificateFile = null;
        const certificateInputs = [certFileInput].filter(Boolean);
        function getStoredCertificateLabel() {
            if (!g_companySnapshot?.certificate_expiration && !g_companySnapshot?.certificate_name && !g_companySnapshot?.certificate_base64) {
                return 'Nenhum certificado salvo no banco de dados.';
            }
            const parts = [];
            if (g_companySnapshot?.certificate_name) {
                parts.push(`Instalado: ${g_companySnapshot.certificate_name}`);
            }
            else {
                parts.push('Certificado instalado no banco');
            }
            if (g_companySnapshot?.certificate_expiration) {
                parts.push(`Validade: ${g_companySnapshot.certificate_expiration.split('T')[0]}`);
            }
            return parts.join(' | ');
        }
        function syncCertificateFileUi(file = null) {
            const certFileActions = document.getElementById('certFileActions');
            if (certFileNameDisplay) {
                certFileNameDisplay.textContent = file ? file.name : '';
            }
            if (certFileActions) {
                certFileActions.classList.toggle('hidden', !file);
                certFileActions.classList.toggle('flex', !!file);
            }
            if (certInstalledInfo) {
                certInstalledInfo.textContent = file && g_companySnapshot?.certificate_name
                    ? `Ao salvar, o certificado atual (${g_companySnapshot.certificate_name}) será substituído.`
                    : file
                        ? 'Ao salvar, o novo certificado será gravado no banco de dados.'
                        : getStoredCertificateLabel();
            }
        }
        function restoreStoredCertificateState() {
            selectedCertificateFile = null;
            certificateInputs.forEach((input) => {
                input.value = '';
            });
            const validityInput = document.getElementById('certificateValidity');
            if (validityInput) {
                validityInput.value = g_companySnapshot?.certificate_expiration
                    ? g_companySnapshot.certificate_expiration.split('T')[0]
                    : '';
            }
            syncCertificateFileUi(null);
        }
        // Stub: client-side PFX expiry extraction not implemented — field stays blank until server processes it
        function attemptToExtractDate(file, password) { }
        function bindCertificatePasswordLookup(file) {
            if (!file)
                return;
            const pwdInput = document.getElementById('certificatePassword');
            if (!pwdInput)
                return;
            pwdInput.onchange = () => attemptToExtractDate(file, pwdInput.value);
            if (pwdInput.value) {
                attemptToExtractDate(file, pwdInput.value);
            }
        }
        function applyCertificateSelection(file) {
            if (!file || !certFileNameDisplay)
                return;
            const lowerName = String(file.name || '').toLowerCase();
            if (!lowerName.endsWith('.pfx') && !lowerName.endsWith('.p12')) {
                UI.showAlert('alertMessage', 'Selecione um certificado digital no formato .pfx ou .p12.', 'error');
                certificateInputs.forEach((input) => {
                    input.value = '';
                });
                selectedCertificateFile = null;
                restoreStoredCertificateState();
                return;
            }
            selectedCertificateFile = file;
            UI.hideAlert('alertMessage');
            syncCertificateFileUi(file);
            bindCertificatePasswordLookup(file);
            refreshParameterSummary();
        }
        function updateCertificateUploadZoneState(isActive) {
            if (!certUploadZone)
                return;
            certUploadZone.classList.toggle('border-brand-500', isActive);
            certUploadZone.classList.toggle('bg-brand-50', isActive);
            certUploadZone.classList.toggle('dark:border-brand-400', isActive);
        }
        function applyCertificateFromFileList(fileList) {
            if (!fileList || !fileList.length)
                return;
            applyCertificateSelection(fileList[0]);
        }
        if (certFileInput) {
            certFileInput.addEventListener('change', (e) => {
                applyCertificateFromFileList(e.target.files);
            });
        }
        if (certUploadZone) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
                certUploadZone.addEventListener(eventName, (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                });
            });
            ['dragenter', 'dragover'].forEach((eventName) => {
                certUploadZone.addEventListener(eventName, () => updateCertificateUploadZoneState(true));
            });
            ['dragleave', 'drop'].forEach((eventName) => {
                certUploadZone.addEventListener(eventName, () => updateCertificateUploadZoneState(false));
            });
            certUploadZone.addEventListener('drop', (event) => {
                applyCertificateFromFileList(event.dataTransfer?.files);
            });
        }
        if (clearCertificateFileBtn) {
            clearCertificateFileBtn.addEventListener('click', () => {
                restoreStoredCertificateState();
            });
        }
        if (g_companySnapshot) {
            restoreStoredCertificateState();
        }
        // Logo tab logic
        const logoFileInput = document.getElementById('companyLogoFile');
        const logoDropzone = document.getElementById('companyLogoDropzone');
        const btnRemoveLogo = document.getElementById('btnRemoveCompanyLogo');
        const logoForm = document.getElementById('logoForm');
        let selectedLogoFile = null;
        let logoMarkedForRemoval = false;
        function applyCompanyLogoFile(file) {
            if (!file)
                return;
            if (!COMPANY_LOGO_ALLOWED_TYPES.has(file.type)) {
                UI.showAlert('alertMessage', 'Formato de logo inválido. Use PNG, JPG, JPEG ou WEBP.', 'error');
                if (logoFileInput)
                    logoFileInput.value = '';
                return;
            }
            if (file.size > COMPANY_LOGO_MAX_BYTES) {
                UI.showAlert('alertMessage', 'A logo deve ter no máximo 2MB.', 'error');
                if (logoFileInput)
                    logoFileInput.value = '';
                return;
            }
            selectedLogoFile = file;
            logoMarkedForRemoval = false;
            const reader = new FileReader();
            reader.onload = (evt) => {
                setCompanyLogoPreviewState({
                    src: String(evt.target?.result || ''),
                    fileName: file.name,
                    showPreview: true,
                });
                const logoInfo = document.getElementById('companyLogoInfo');
                if (logoInfo)
                    logoInfo.textContent = 'Ao salvar, esta logo será gravada para a empresa.';
            };
            reader.readAsDataURL(file);
            UI.hideAlert('alertMessage');
        }
        if (logoFileInput) {
            logoFileInput.addEventListener('change', (event) => {
                applyCompanyLogoFile(event.target?.files?.[0]);
            });
        }
        if (logoDropzone) {
            ['dragenter', 'dragover'].forEach((eventName) => {
                logoDropzone.addEventListener(eventName, (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setCompanyLogoDropzoneActive(true);
                });
            });
            ['dragleave', 'drop'].forEach((eventName) => {
                logoDropzone.addEventListener(eventName, (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setCompanyLogoDropzoneActive(false);
                });
            });
            logoDropzone.addEventListener('drop', (event) => {
                applyCompanyLogoFile(event.dataTransfer?.files?.[0]);
            });
        }
        if (btnRemoveLogo) {
            btnRemoveLogo.addEventListener('click', () => {
                selectedLogoFile = null;
                logoMarkedForRemoval = true;
                if (logoFileInput)
                    logoFileInput.value = '';
                setCompanyLogoPreviewState();
                const logoInfo = document.getElementById('companyLogoInfo');
                if (logoInfo)
                    logoInfo.textContent = 'Ao salvar, a logo atual será removida.';
            });
        }
        if (logoForm) {
            logoForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('saveLogoBtn');
                const originalText = btn ? btn.textContent : '';
                if (btn) {
                    btn.textContent = 'Salvando...';
                    btn.disabled = true;
                }
                try {
                    if (!g_companyPublicId) {
                        throw new Error('ID da empresa não processado. Tente recarregar a página.');
                    }
                    const updateData = {};
                    if (selectedLogoFile) {
                        const base64 = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => {
                                const result = String(reader.result || '');
                                resolve(result);
                            };
                            reader.onerror = () => reject(new Error('Falha ao ler o arquivo da logo.'));
                            reader.readAsDataURL(selectedLogoFile);
                        });
                        updateData.logo_base64 = base64;
                        updateData.logo_filename = selectedLogoFile.name;
                    }
                    else if (logoMarkedForRemoval) {
                        updateData.logo_base64 = null;
                        updateData.logo_filename = null;
                    }
                    else {
                        UI.showAlert('alertMessage', 'Selecione uma logo ou remova a logo atual antes de salvar.', 'warning');
                        return;
                    }
                    const logoResponse = await api(`/companies/${g_companyPublicId}`, {
                        method: 'PUT',
                        body: JSON.stringify(updateData)
                    });
                    g_companySnapshot = logoResponse?.data ?? { ...(g_companySnapshot || {}), ...updateData };
                    selectedLogoFile = null;
                    logoMarkedForRemoval = false;
                    g_companyLogoPreviewVersion = Date.now();
                    syncStoredCompanyLogoState();
                    UI.showAlert('alertMessage', 'Logo salva com sucesso!', 'success');
                }
                catch (err) {
                    UI.showAlert('alertMessage', err.message || 'Erro ao salvar logo', 'error');
                }
                finally {
                    if (btn) {
                        btn.textContent = originalText;
                        btn.disabled = false;
                    }
                }
            });
        }
        // Tab buttons event listeners to replace inline onclick (CSP policy stringency)
        const tabBtnData = document.getElementById('tabBtn-data');
        if (tabBtnData) {
            tabBtnData.addEventListener('click', () => switchTab('data'));
        }
        const tabBtnParam = document.getElementById('tabBtn-param');
        if (tabBtnParam) {
            tabBtnParam.addEventListener('click', () => switchTab('param'));
        }
        const tabBtnCert = document.getElementById('tabBtn-cert');
        if (tabBtnCert) {
            tabBtnCert.addEventListener('click', () => switchTab('cert'));
        }
        const tabBtnLogo = document.getElementById('tabBtn-logo');
        if (tabBtnLogo) {
            tabBtnLogo.addEventListener('click', () => switchTab('logo'));
        }
        const tabBtnNotas = document.getElementById('tabBtn-notas');
        if (tabBtnNotas) {
            tabBtnNotas.addEventListener('click', () => switchTab('notas'));
        }
        const tabBtnApi = document.getElementById('tabBtn-api');
        if (tabBtnApi) {
            tabBtnApi.addEventListener('click', () => switchTab('api'));
        }
        const tabBtnSolidcon = document.getElementById('tabBtn-solidcon');
        if (tabBtnSolidcon) {
            tabBtnSolidcon.addEventListener('click', () => switchTab('solidcon'));
        }
        const tabBtnSwagger = document.getElementById('tabBtn-swagger');
        if (tabBtnSwagger) {
            tabBtnSwagger.addEventListener('click', () => switchTab('swagger'));
        }
        const companyActive = document.getElementById('companyActive');
        if (companyActive) {
            companyActive.addEventListener('change', refreshParameterSummary);
        }
        const allowPrintWithoutConfirmation = document.getElementById('allowPrintWithoutConfirmation');
        if (allowPrintWithoutConfirmation) {
            allowPrintWithoutConfirmation.addEventListener('change', refreshParameterSummary);
        }
        const parameterTaxRegime = document.getElementById('parameterTaxRegime');
        if (parameterTaxRegime) {
            parameterTaxRegime.addEventListener('change', refreshParameterSummary);
        }
        const stateField = document.getElementById('state');
        if (stateField) {
            stateField.addEventListener('change', refreshParameterSummary);
        }
        const togglePasswordBtn = document.getElementById('togglePasswordBtn');
        if (togglePasswordBtn) {
            togglePasswordBtn.addEventListener('click', () => {
                const pwdInput = document.getElementById('certificatePassword');
                const eyeIcon = document.getElementById('eyeIcon');
                const eyeOffIcon = document.getElementById('eyeOffIcon');
                if (!pwdInput)
                    return;
                const isPassword = pwdInput.type === 'password';
                pwdInput.type = isPassword ? 'text' : 'password';
                if (eyeIcon)
                    eyeIcon.classList.toggle('hidden', isPassword);
                if (eyeOffIcon)
                    eyeOffIcon.classList.toggle('hidden', !isPassword);
            });
        }
        const testNfeBtn = document.getElementById('testNfeBtn');
        if (testNfeBtn) {
            testNfeBtn.addEventListener('click', async () => {
                const originalHtml = testNfeBtn.innerHTML;
                testNfeBtn.disabled = true;
                testNfeBtn.textContent = 'Testando...';
                try {
                    const result = await api('/nfe/test-certificate', { method: 'POST', body: JSON.stringify({}) });
                    const type = result.status === 'warning' ? 'warn' : 'success';
                    UI.showAlert('alertMessage', result.message || 'Certificado válido!', type, 10000);
                    if (result.data?.notAfter) {
                        const exp = new Date(result.data.notAfter).toLocaleDateString('pt-BR');
                        const sub = result.data.subject ? ` — ${result.data.subject}` : '';
                        UI.showAlert('alertMessage', `${result.message}${sub} | Validade: ${exp}`, type, 12000);
                    }
                }
                catch (err) {
                    UI.showAlert('alertMessage', err.message || 'Erro ao testar certificado', 'error', 10000);
                }
                finally {
                    testNfeBtn.disabled = false;
                    testNfeBtn.innerHTML = originalHtml;
                }
            });
        }
        const certForm = document.getElementById('certForm');
        if (certForm) {
            certForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('saveCertBtn');
                const originalText = btn ? btn.textContent : '';
                if (btn) {
                    btn.textContent = 'Salvando...';
                    btn.disabled = true;
                }
                try {
                    if (!g_companyPublicId) {
                        throw new Error('ID da empresa não processado. Tente recarregar a página.');
                    }
                    const password = document.getElementById('certificatePassword')?.value || '';
                    if (!password) {
                        throw new Error('Informe a senha do certificado digital.');
                    }
                    const updateData = { certificate_password: password };
                    if (selectedCertificateFile) {
                        const base64 = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => {
                                const result = reader.result;
                                resolve(result.split(',')[1] ?? result);
                            };
                            reader.onerror = () => reject(new Error('Falha ao ler o arquivo do certificado.'));
                            reader.readAsDataURL(selectedCertificateFile);
                        });
                        updateData.certificate_base64 = base64;
                        updateData.certificate_name = selectedCertificateFile.name;
                        const validityInput = document.getElementById('certificateValidity');
                        if (validityInput?.value) {
                            updateData.certificate_expiration = validityInput.value;
                        }
                    }
                    const certResponse = await api(`/companies/${g_companyPublicId}`, {
                        method: 'PUT',
                        body: JSON.stringify(updateData)
                    });
                    g_companySnapshot = certResponse?.data ?? { ...(g_companySnapshot || {}), ...updateData };
                    restoreStoredCertificateState();
                    UI.showAlert('alertMessage', 'Certificado digital salvo com sucesso!', 'success');
                }
                catch (err) {
                    UI.showAlert('alertMessage', err.message || 'Erro ao salvar certificado', 'error');
                }
                finally {
                    if (btn) {
                        btn.textContent = originalText;
                        btn.disabled = false;
                    }
                }
            });
        }
        const parameterForm = document.getElementById('parameterForm');
        if (parameterForm) {
            parameterForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('saveParameterBtn');
                const originalText = btn.textContent;
                btn.textContent = 'Salvando...';
                btn.disabled = true;
                try {
                    if (!g_companyPublicId) {
                        throw new Error("ID da empresa não processado. Tente recarregar a página.");
                    }
                    const updateData = {
                        tax_regime: document.getElementById('parameterTaxRegime')?.value,
                        allow_print_without_confirmation: !!document.getElementById('allowPrintWithoutConfirmation')?.checked,
                        is_active: !!document.getElementById('companyActive')?.checked
                    };
                    await api(`/companies/${g_companyPublicId}`, {
                        method: 'PUT',
                        body: JSON.stringify(updateData)
                    });
                    g_companySnapshot = { ...(g_companySnapshot || {}), ...updateData };
                    refreshParameterSummary();
                    UI.showAlert('alertMessage', 'Parâmetros atualizados com sucesso!', 'success');
                }
                catch (err) {
                    UI.showAlert('alertMessage', err.message || 'Erro ao atualizar parâmetros', 'error');
                }
                finally {
                    btn.textContent = originalText;
                    btn.disabled = false;
                }
            });
        }
    });
    // UI function to toggle tabs
    window.switchTab = function (tabName) {
        const tabs = ['data', 'param', 'cert', 'logo', 'notas', 'api', 'solidcon', 'swagger'];
        tabs.forEach(tab => {
            const btn = document.getElementById(`tabBtn-${tab}`);
            const content = document.getElementById(`tabContent-${tab}`);
            if (!btn || !content)
                return;
            if (tab === tabName) {
                btn.classList.add('active', 'text-brand-600', 'border-brand-600', 'dark:text-brand-500', 'dark:border-brand-500');
                btn.classList.remove('border-transparent', 'hover:text-gray-600', 'hover:border-gray-300', 'text-gray-500');
                content.classList.remove('hidden');
                content.classList.add('block');
                if (tab === 'param') {
                    refreshParameterSummary();
                }
            }
            else {
                btn.classList.remove('active', 'text-brand-600', 'border-brand-600', 'dark:text-brand-500', 'dark:border-brand-500');
                btn.classList.add('border-transparent', 'hover:text-gray-600', 'hover:border-gray-300', 'text-gray-500');
                content.classList.add('hidden');
                content.classList.remove('block');
            }
        });
    };
})();
