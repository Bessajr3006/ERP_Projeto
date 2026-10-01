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
let companyDocsList: { name: string; url: string; attachedAt?: string }[] = [];

const parseCnpjDocuments = (val: any): { name: string; url: string; attachedAt?: string }[] => {
    if (!val) return [];
    let list: any[] = [];
    if (Array.isArray(val)) {
        list = val;
    } else {
        try {
            if (typeof val === 'string' && val.trim().startsWith('[')) {
                list = JSON.parse(val);
            } else if (typeof val === 'string' && val.trim() !== '') {
                list = [val];
            }
        } catch (e) {}
    }
    return list.map(item => {
        if (typeof item === 'string') {
            const fileName = item.substring(item.lastIndexOf('/') + 1);
            return { name: fileName, url: item, attachedAt: new Date(2026, 0, 1).toISOString() };
        }
        if (item && typeof item === 'object' && item.url) {
            return {
                name: item.name || item.url.substring(item.url.lastIndexOf('/') + 1),
                url: item.url,
                attachedAt: item.attachedAt || new Date().toISOString()
            };
        }
        return null;
    }).filter(Boolean) as { name: string; url: string; attachedAt: string }[];
};

function renderCompanyDocsList() {
    const docContainer = document.getElementById('companyDocumentContainer');
    if (!docContainer) return;
    
    companyDocsList.sort((a: any, b: any) => new Date(b.attachedAt || 0).getTime() - new Date(a.attachedAt || 0).getTime());
    
    if (companyDocsList.length === 0) {
        docContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 gap-2 text-gray-400 dark:text-gray-500 w-full">
                <svg class="w-12 h-12 text-gray-300 dark:text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <p class="text-sm font-medium">Nenhum documento anexado.</p>
            </div>
        `;
        return;
    }
    
    docContainer.innerHTML = companyDocsList.map((doc, idx) => {
        const fileName = doc.url.substring(doc.url.lastIndexOf('/') + 1);
        const d = doc.attachedAt ? new Date(doc.attachedAt) : null;
        const dateStr = d ? `Anexado em ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '';
        const dateHtml = dateStr ? `
            <p class="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-1 flex items-center gap-1">
                <svg class="w-3.5 h-3.5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                ${dateStr}
            </p>
        ` : '';

        return `
            <div class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:border-brand-300 dark:hover:border-brand-700 transition-all font-sans mb-3">
                <a href="${doc.url}" class="btn-preview-company-doc flex items-center gap-3 flex-1 min-w-0 mr-4 group text-left cursor-pointer decoration-none" data-index="${idx}">
                    <div class="p-2 rounded bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/60 transition-colors">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">${doc.name}</p>
                        <p class="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">${fileName}</p>
                        ${dateHtml}
                    </div>
                </a>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" class="btn-rename-company-doc p-1.5 rounded text-gray-500 hover:text-brand-600 hover:bg-brand-50 dark:text-gray-400 dark:hover:text-brand-400 dark:hover:bg-brand-950/30 transition-colors" data-index="${idx}" title="Renomear documento">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                        </svg>
                    </button>
                    <button type="button" class="btn-delete-company-doc p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-950/30 transition-colors" data-index="${idx}" title="Excluir documento">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

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
    if (!preview || !container || !actions || !fileNameLabel) return;

    preview.src = src;
    preview.classList.toggle('hidden', !showPreview);
    container.classList.toggle('hidden', showPreview);
    actions.classList.toggle('hidden', !showPreview);
    actions.classList.toggle('flex', showPreview);
    fileNameLabel.textContent = fileName;
}

function getCompanyLogoBase64Src(logoBase64) {
    if (!logoBase64) return '';
    const value = String(logoBase64);
    return value.startsWith('data:') ? value : `data:image/jpeg;base64,${value}`;
}

function setCompanyLogoDropzoneActive(isActive) {
    const dropzone = document.getElementById('companyLogoDropzone');
    if (!dropzone) return;

    dropzone.classList.toggle('border-brand-500', isActive);
    dropzone.classList.toggle('bg-brand-50', isActive);
    dropzone.classList.toggle('dark:border-brand-400', isActive);
    dropzone.classList.toggle('ring-2', isActive);
    dropzone.classList.toggle('ring-brand-100', isActive);
}

function syncStoredCompanyLogoState() {
    const logoInput = document.getElementById('companyLogoFile');
    const logoInfo = document.getElementById('companyLogoInfo');
    if (logoInput) logoInput.value = '';
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
        if (logoInfo) logoInfo.textContent = g_companySnapshot.logo_filename ? `Logo atual: ${g_companySnapshot.logo_filename}` : 'Logo atual salva.';
        return;
    }

    setCompanyLogoPreviewState();
    if (logoInfo) logoInfo.textContent = 'Nenhuma logo salva.';
}

function setMaskedValue(maskInstance, inputId, value) {
    if (maskInstance) {
        if (inputId === 'cnpj') {
            maskInstance.unmaskedValue = String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        } else {
            maskInstance.unmaskedValue = onlyDigits(value);
        }
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

    const val = document.getElementById(inputId)?.value || '';
    if (inputId === 'cnpj') {
        return String(val).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    }
    return onlyDigits(val);
}

function populateIbgeStateOptions(selectedValue = '') {
    const stateSelect = document.getElementById('state');
    if (!stateSelect || !g_ibgeStates.length) return;

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
    } catch (error) {
        console.error('Falha ao carregar estados do IBGE', error);
    }
}

async function lookupAddressByCep(cep) {
    const normalizedCep = onlyDigits(cep);
    if (normalizedCep.length !== 8) return null;

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
            } else {
                cepNotFound = true;
            }
        }
    } catch (_error) {
        // Fallback handled below.
    }

    if (!data && !cepNotFound) {
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${normalizedCep}`);
            if (response.ok) {
                data = await response.json();
            }
        } catch (_error) {
            // Ignore and let caller handle null.
        }
    }

    return data;
}

function applyCepResultToCompanyProfile(data) {
    if (!data) return;

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
    if (cep.length !== 8) return;

    const loader = document.getElementById('cepLoading');
    if (loader) loader.classList.remove('hidden');

    try {
        const data = await lookupAddressByCep(cep);

        if (data && (data.street || data.city)) {
            applyCepResultToCompanyProfile(data);
        } else {
            UI.showAlert('alertMessage', 'CEP não encontrado ou inválido.', 'error', 3000);
            document.getElementById('street').value = '';
            document.getElementById('neighborhood').value = '';
            document.getElementById('city').value = '';
            populateIbgeStateOptions('');
        }
    } catch (error) {
        console.error('CEP Error:', error);
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}

async function handleCompanyProfileCnpjLookup() {
    const cnpj = getMaskedValue(docMask, 'cnpj');
    if (cnpj.length !== 14) return;

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
    } catch (error) {
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
    if (!resultEl) return;

    if (typeof value === 'string') {
        resultEl.value = value;
        return;
    }

    resultEl.value = JSON.stringify(value, null, 2);
}

function openCompanyDocPreview(doc: any) {
    const modal = document.getElementById('companyDocPreviewModal');
    const title = document.getElementById('companyDocPreviewModalTitle');
    const content = document.getElementById('companyDocPreviewContent');
    const downloadBtn = document.getElementById('btnDownloadCompanyDoc') as HTMLAnchorElement | null;

    if (!modal || !title || !content) return;

    title.textContent = doc.name;

    if (downloadBtn) {
        downloadBtn.href = doc.url;
        const fileExt = doc.url.substring(doc.url.lastIndexOf('.')) || '';
        downloadBtn.download = `${doc.name}${fileExt}`;
    }

    content.innerHTML = '';
    const fileUrlLower = doc.url.toLowerCase();
    const isImage = fileUrlLower.endsWith('.png') || fileUrlLower.endsWith('.jpg') || fileUrlLower.endsWith('.jpeg') || fileUrlLower.endsWith('.webp') || fileUrlLower.endsWith('.gif') || fileUrlLower.endsWith('.svg');
    const isPdf = fileUrlLower.endsWith('.pdf');

    if (isImage) {
        content.innerHTML = `<img src="${doc.url}" alt="${doc.name}" class="max-w-full max-h-[60vh] object-contain rounded shadow-sm" />`;
    } else if (isPdf) {
        content.innerHTML = `<iframe src="${doc.url}" class="w-full h-[60vh] rounded border border-gray-200 dark:border-slate-700"></iframe>`;
    } else {
        content.innerHTML = `
            <div class="flex flex-col items-center justify-center p-8 gap-4 text-center text-gray-500 dark:text-gray-400">
                <svg class="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <div>
                    <p class="text-base font-semibold text-gray-855 dark:text-gray-200">Pré-visualização indisponível</p>
                    <p class="text-sm mt-1">Este tipo de arquivo não pode ser pré-visualizado no navegador. Use o botão abaixo para baixar.</p>
                </div>
            </div>
        `;
    }

    modal.classList.remove('hidden');
}

function closeCompanyDocPreview() {
    const modal = document.getElementById('companyDocPreviewModal');
    if (modal) modal.classList.add('hidden');
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
    } catch (error) {
        setConsultaJson({
            error: error?.message || 'Falha ao consultar a URL Solidcon.',
            url,
        });
    }
}

function setInputValue(id: string, value: any) {
    const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
    if (el) {
        el.value = value !== undefined && value !== null ? String(value) : '';
    }
}

function setInputChecked(id: string, checked: boolean) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) {
        el.checked = !!checked;
    }
}

async function populateBoletoWhatsappSenders(company: any, fallbackUser?: any) {
    const boletoSendWhatsappNameEl = document.getElementById('boletoSendWhatsappName') as HTMLSelectElement | null;
    const boletoSendWhatsappNumberEl = document.getElementById('boletoSendWhatsappNumber') as HTMLInputElement | null;
    if (!boletoSendWhatsappNameEl) return;

    let usersMap = new Map<string | number, any>();
    if (fallbackUser) {
        usersMap.set(fallbackUser.public_id || fallbackUser.id || 'current', fallbackUser);
    }

    let sessionsList: any[] = [];
    let companyWhatsappSession: any = null;

    try {
        const [usersRes, waSessionRes, companyDetailsRes] = await Promise.all([
            api('/users').catch(() => null),
            g_companyPublicId ? api(`/companies/${g_companyPublicId}/whatsapp-business/session`).catch(() => null) : null,
            g_companyPublicId ? api(`/companies/${g_companyPublicId}`).catch(() => null) : null
        ]);

        if (usersRes && usersRes.data && Array.isArray(usersRes.data)) {
            usersRes.data.forEach((u: any) => {
                usersMap.set(u.public_id || u.id, u);
            });
        }
        if (companyDetailsRes && companyDetailsRes.data && Array.isArray(companyDetailsRes.data.users)) {
            companyDetailsRes.data.users.forEach((u: any) => {
                const key = u.public_id || u.id;
                if (usersMap.has(key)) {
                    usersMap.set(key, { ...usersMap.get(key), ...u });
                } else {
                    usersMap.set(key, u);
                }
            });
        }
        if (companyDetailsRes && companyDetailsRes.data && Array.isArray(companyDetailsRes.data.whatsapp_sessions)) {
            sessionsList = companyDetailsRes.data.whatsapp_sessions;
        }
        if (waSessionRes && waSessionRes.data) {
            companyWhatsappSession = waSessionRes.data;
        } else {
            companyWhatsappSession = sessionsList.find((s: any) => s.owner_type === 'company') || null;
        }
    } catch (err) {
        console.warn('Erro ao carregar usuários ou sessões WhatsApp:', err);
    }

    const currentSelected = boletoSendWhatsappNameEl.value || company?.boleto_send_whatsapp_name || '';
    boletoSendWhatsappNameEl.innerHTML = '<option value="">Selecione...</option>';

    // 1. Sessão corporativa da empresa
    if (companyWhatsappSession && (companyWhatsappSession.status === 'authenticated' || companyWhatsappSession.status === 'ready') && companyWhatsappSession.connected_number) {
        const opt = document.createElement('option');
        opt.value = 'Geral';
        opt.textContent = `🏢 Geral / Empresa (WhatsApp Conectado: ${companyWhatsappSession.connected_number})`;
        opt.setAttribute('data-number', companyWhatsappSession.connected_number || '');
        boletoSendWhatsappNameEl.appendChild(opt);
    }

    // 2. Usuários cadastrados
    const allUsers = Array.from(usersMap.values());
    allUsers.filter((u: any) => u.is_active !== false && u.is_active !== 0).forEach((u: any) => {
        const userName = u.full_name || u.name || 'Usuário';
        const userSession = sessionsList.find((s: any) => s.owner_type === 'user' && (s.owner_id === u.id || s.owner_id === u.user_id));
        const isConnected = u.whatsapp_status === 'authenticated' || u.whatsapp_status === 'ready' || (userSession && (userSession.status === 'authenticated' || userSession.status === 'ready'));
        const connectedNum = u.whatsapp_number || userSession?.connected_number || '';
        const registeredPhone = u.phone || '';

        const opt = document.createElement('option');
        opt.value = userName;

        if (isConnected && connectedNum) {
            opt.textContent = `👤 ${userName} (WhatsApp Conectado: ${connectedNum})`;
            opt.setAttribute('data-number', connectedNum);
        } else if (registeredPhone) {
            opt.textContent = `👤 ${userName} (WhatsApp Cadastrado: ${registeredPhone})`;
            opt.setAttribute('data-number', registeredPhone);
        } else {
            opt.textContent = `👤 ${userName}`;
            opt.setAttribute('data-number', '');
        }
        boletoSendWhatsappNameEl.appendChild(opt);
    });

    // Selecionar valor salvo ou anterior
    const targetName = (currentSelected || '').trim();
    if (targetName) {
        let found = false;
        for (let i = 0; i < boletoSendWhatsappNameEl.options.length; i++) {
            if (boletoSendWhatsappNameEl.options[i].value.toLowerCase() === targetName.toLowerCase()) {
                boletoSendWhatsappNameEl.selectedIndex = i;
                found = true;
                break;
            }
        }
        if (!found) {
            const customOpt = document.createElement('option');
            customOpt.value = targetName;
            const targetNum = company?.boleto_send_whatsapp_number || '';
            customOpt.textContent = `👤 ${targetName}${targetNum ? ` (${targetNum})` : ''}`;
            customOpt.setAttribute('data-number', targetNum);
            boletoSendWhatsappNameEl.appendChild(customOpt);
            boletoSendWhatsappNameEl.value = targetName;
        }
    }

    if (boletoSendWhatsappNumberEl) {
        if (!boletoSendWhatsappNumberEl.value && boletoSendWhatsappNameEl.selectedIndex > 0) {
            const opt = boletoSendWhatsappNameEl.options[boletoSendWhatsappNameEl.selectedIndex];
            boletoSendWhatsappNumberEl.value = opt?.getAttribute('data-number') || '';
        }

        boletoSendWhatsappNameEl.onchange = () => {
            const opt = boletoSendWhatsappNameEl.options[boletoSendWhatsappNameEl.selectedIndex];
            boletoSendWhatsappNumberEl.value = opt?.getAttribute('data-number') || '';
        };
    }
}

async function initCompanyPage() {
    // Setup masks
    const docInput = document.getElementById('cnpj');
    if (docInput) {
        docMask = makeMask(docInput, {
            mask: [
                { mask: '000.000.000-00' }, // CPF
                { 
                    mask: 'XX.XXX.XXX/XXXX-XX',
                    definitions: {
                        'X': /[a-zA-Z0-9]/
                    }
                } // CNPJ
            ],
            prepare: (str) => str.toUpperCase()
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

    try {
        await loadIbgeStateOptions(document.getElementById('state')?.value || '');
    } catch (e) {}

    try {
        const groupsRes = await api('/customer-groups');
        if (groupsRes && groupsRes.status === 'success') {
            const customerGroups = groupsRes.data || [];
            const defaultGroupSelect = document.getElementById('defaultCustomerGroupPublicId') as HTMLSelectElement | null;
            if (defaultGroupSelect) {
                defaultGroupSelect.innerHTML = '<option value="">Nenhum</option>' + 
                    customerGroups.map((g: any) => `<option value="${g.public_id}">${g.name}</option>`).join('');
            }
        }
    } catch (err) {
        console.error('Erro ao carregar grupos de cliente', err);
    }

    try {
        const banksRes = await api('/bank-accounts');
        if (banksRes && banksRes.status === 'success') {
            const bankAccounts = banksRes.data || [];
            const defaultBankSelect = document.getElementById('defaultBankAccountPublicId') as HTMLSelectElement | null;
            if (defaultBankSelect) {
                defaultBankSelect.innerHTML = '<option value="">Nenhum</option>' + 
                    bankAccounts.map((b: any) => `<option value="${b.public_id}">${b.name}</option>`).join('');
            }
        }
    } catch (err) {
        console.error('Erro ao carregar contas bancarias', err);
    }

    try {
        const receivablesRes = await api('/receivable-types');
        if (receivablesRes && receivablesRes.status === 'success') {
            const receivableTypes = receivablesRes.data || [];
            const defaultReceivableSelect = document.getElementById('defaultReceivableTypePublicId') as HTMLSelectElement | null;
            if (defaultReceivableSelect) {
                defaultReceivableSelect.innerHTML = '<option value="">Nenhum</option>' + 
                    receivableTypes.map((r: any) => `<option value="${r.public_id}">${r.name}</option>`).join('');
            }
        }
    } catch (err) {
        console.error('Erro ao carregar formas de recebimento', err);
    }

    try {
        const userInfo = await api('/auth/me');
        if (userInfo && userInfo.data && userInfo.data.company) {
            let company = userInfo.data.company;
            g_companySnapshot = { ...company };
            g_companyPublicId = company.public_id;

            setInputValue('companyPublicId', company.public_id);
            setInputValue('companyDbId', company.id);

            const createdAtEl = document.getElementById('companyCreatedAt') as HTMLInputElement | null;
            if (createdAtEl) {
                if (company.created_at) {
                    const date = new Date(company.created_at);
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    createdAtEl.value = `${day}/${month}/${year} ${hours}:${minutes}`;
                } else {
                    createdAtEl.value = '-';
                }
            }

            const copyIdBtn = document.getElementById('copyCompanyIdBtn');
            if (copyIdBtn) {
                copyIdBtn.addEventListener('click', () => {
                    const pid = company.public_id || '';
                    if (!pid) return;
                    navigator.clipboard.writeText(pid).then(() => {
                        const orig = copyIdBtn.innerHTML;
                        copyIdBtn.innerHTML = '<svg class="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
                        setTimeout(() => { copyIdBtn.innerHTML = orig; }, 1500);
                    });
                });
            }

            setInputValue('tradeName', company.trade_name);
            setInputValue('companyName', company.company_name);
            setInputValue('email', company.email);
            setInputValue('street', company.street);
            setInputValue('number', company.number);
            setInputValue('complement', company.complement);
            setInputValue('neighborhood', company.neighborhood);
            setInputValue('city', company.city);
            setInputValue('wazeUrl', company.waze_url);
            setInputValue('parameterTaxRegime', company.tax_regime);

            setInputChecked('companyActive', company.is_active !== false);
            setInputChecked('allowPrintWithoutConfirmation', !!company.allow_print_without_confirmation);
            setInputChecked('showNewMeasureButton', company.show_new_measure_button !== false);
            setInputChecked('autoSendBoletoWhatsapp', !!company.auto_send_boleto_whatsapp);

            setInputValue('boletoSendTime', company.boleto_send_time || '08:00');
            setInputValue('boletoSendWhatsappNumber', company.boleto_send_whatsapp_number);

            // Popula lista de remetentes de WhatsApp
            await populateBoletoWhatsappSenders(company, userInfo.data.user);

            setInputValue('parameterStatePreview', company.state || 'Não definido');
            populateIbgeStateOptions(company.state || '');

            if (docMask && company.cnpj) {
                setMaskedValue(docMask, 'cnpj', company.cnpj);
                setInputValue('cert_cnpj_hidden', company.cnpj);
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
                if(testBtn) {
                    testBtn.classList.remove('hidden');
                    testBtn.classList.add('inline-flex');
                }
            }
            if (company.api_token) {
                const apiTokenEl = document.getElementById('apiToken');
                if (apiTokenEl) apiTokenEl.value = company.api_token;
            }
            if (company.solidcon_api_token) {
                const solidconTokenEl = document.getElementById('solidconToken');
                if (solidconTokenEl) solidconTokenEl.value = company.solidcon_api_token;
            }
            if (company.swagger_api_token) {
                const swaggerTokenEl = document.getElementById('swaggerToken');
                if (swaggerTokenEl) swaggerTokenEl.value = company.swagger_api_token;
            }
            for (let i = 1; i <= 5; i++) {
                if (company[`solidcon_url_${i}`]) {
                    const el = document.getElementById(`solidconUrl${i}`);
                    if (el) el.value = company[`solidcon_url_${i}`];
                }
            }
            const solidconFields = {
                'serv_solidcon': 'servSolidcon',
                'bd_solidcon': 'bdSolidcon',
                'login_solidcon': 'loginSolidcon',
                'senha_solidcon': 'senhaSolidcon',
                'serv_dorsal': 'servDorsal',
                'bd_dorsal': 'bdDorsal',
                'login_dorsal': 'loginDorsal',
                'senha_dorsal': 'senhaDorsal',
                'cdfilial': 'cdFilial',
                'cdpdv': 'cdPdv',
                'solidcon_customer_cpf': 'solidconCustomerCpf',
                'solidcon_customer_name': 'solidconCustomerName'
            };
            for (const [modelProp, domId] of Object.entries(solidconFields)) {
                const el = document.getElementById(domId) as HTMLInputElement | null;
                if (el && company[modelProp] !== undefined && company[modelProp] !== null) {
                    el.value = String(company[modelProp]);
                }
            }

            if (company.show_solidcon !== undefined && company.show_solidcon !== null) {
                const el = document.getElementById('showSolidcon') as HTMLSelectElement | null;
                if (el) el.value = company.show_solidcon ? '1' : '0';
            }

            const alterdataFields = {
                'serv_alterdata': 'servAlterdata',
                'bd_alterdata': 'bdAlterdata',
                'login_alterdata': 'loginAlterdata',
                'senha_alterdata': 'senhaAlterdata',
                'porta_alterdata': 'portaAlterdata',
                'cdempresa_alterdata': 'cdempresaAlterdata'
            };
            for (const [modelProp, domId] of Object.entries(alterdataFields)) {
                const el = document.getElementById(domId) as HTMLInputElement | null;
                if (el && company[modelProp] !== undefined && company[modelProp] !== null) {
                    el.value = String(company[modelProp]);
                }
            }

            if (company.show_alterdata !== undefined && company.show_alterdata !== null) {
                const el = document.getElementById('showAlterdata') as HTMLSelectElement | null;
                if (el) el.value = company.show_alterdata ? '1' : '0';
            }

            if (company.default_customer_group_public_id !== undefined && company.default_customer_group_public_id !== null) {
                const el = document.getElementById('defaultCustomerGroupPublicId') as HTMLSelectElement | null;
                if (el) el.value = company.default_customer_group_public_id;
            }

            if (company.default_bank_account_public_id !== undefined && company.default_bank_account_public_id !== null) {
                const el = document.getElementById('defaultBankAccountPublicId') as HTMLSelectElement | null;
                if (el) el.value = company.default_bank_account_public_id;
            }

            if (company.default_receivable_type_public_id !== undefined && company.default_receivable_type_public_id !== null) {
                const el = document.getElementById('defaultReceivableTypePublicId') as HTMLSelectElement | null;
                if (el) el.value = company.default_receivable_type_public_id;
            }

            if (company.auto_generate_billets !== undefined && company.auto_generate_billets !== null) {
                const el = document.getElementById('autoGenerateBillets') as HTMLSelectElement | null;
                if (el) el.value = company.auto_generate_billets ? '1' : '0';
            }

            if (company.auto_generate_billets_time !== undefined && company.auto_generate_billets_time !== null) {
                const el = document.getElementById('autoGenerateBilletsTime') as HTMLInputElement | null;
                if (el) el.value = company.auto_generate_billets_time;
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

            companyDocsList = parseCnpjDocuments(company.cnpj_document_url);
            renderCompanyDocsList();
            await loadPosControlConfigs();
            await loadSolidconConfigs();
            await loadDorsalConfigs();
            await loadAlterdataConfigs();
        }
    } catch (e) {
        console.error('Falha ao inicializar a tela Minha Empresa', e);
        if (!g_companySnapshot?.public_id) {
            UI.showAlert('alertMessage', 'Erro ao carregar os dados da empresa. Tente fazer login novamente.', 'error');
        }
    }

    // Token logic (Pos-Controll)
    const btnGenerateToken = document.getElementById('generateTokenBtn');
    if (btnGenerateToken) {
        btnGenerateToken.addEventListener('click', async () => {
            if(!confirm('Atenção: Gerar um novo token invalidará o token anterior. Tem certeza que deseja gerar um novo token de API?')) return;
            
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
            } catch (err) {
                UI.showAlert('alertMessage', err.message || 'Erro ao gerar token', 'error');
            } finally {
                btnGenerateToken.textContent = originalText;
                btnGenerateToken.disabled = false;
            }
        });
    }

    // Token logic (Solidcon)
    const btnGenerateSolidconToken = document.getElementById('generateSolidconTokenBtn');
    if (btnGenerateSolidconToken) {
        btnGenerateSolidconToken.addEventListener('click', async () => {
            if(!confirm('Atenção: Gerar um novo token invalidará a integração Solidcon anterior. Confirmar?')) return;
            
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
            } catch (err) {
                UI.showAlert('alertMessage', err.message || 'Erro ao gerar token Solidcon', 'error');
            } finally {
                btnGenerateSolidconToken.textContent = originalText;
                btnGenerateSolidconToken.disabled = false;
            }
        });
    }

    // Token logic (Swagger)
    const btnGenerateSwaggerToken = document.getElementById('generateSwaggerTokenBtn');
    if (btnGenerateSwaggerToken) {
        btnGenerateSwaggerToken.addEventListener('click', async () => {
            if(!confirm('Atenção: Gerar um novo token invalidará o token anterior. Confirmar?')) return;

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
                localStorage.setItem('bessa_swagger_token', newToken);
                refreshParameterSummary();
                UI.showAlert('alertMessage', 'Token Swagger gerado com sucesso!', 'success');
            } catch (err) {
                UI.showAlert('alertMessage', err.message || 'Erro ao gerar token Swagger', 'error');
            } finally {
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
            } catch (_error) {
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
            if (btn) { btn.textContent = 'Salvando...'; btn.disabled = true; }

            try {
                if (!g_companyPublicId) {
                    throw new Error('ID da empresa não processado. Tente recarregar a página.');
                }

                const updateData = {};
                for (let i = 1; i <= 5; i++) {
                    updateData[`solidcon_url_${i}`] = document.getElementById(`solidconUrl${i}`)?.value?.trim() || '';
                }
                const solidconFields = {
                    'serv_solidcon': 'servSolidcon',
                    'bd_solidcon': 'bdSolidcon',
                    'login_solidcon': 'loginSolidcon',
                    'senha_solidcon': 'senhaSolidcon',
                    'serv_dorsal': 'servDorsal',
                    'bd_dorsal': 'bdDorsal',
                    'login_dorsal': 'loginDorsal',
                    'senha_dorsal': 'senhaDorsal',
                    'cdfilial': 'cdFilial',
                    'cdpdv': 'cdPdv',
                    'solidcon_customer_cpf': 'solidconCustomerCpf',
                    'solidcon_customer_name': 'solidconCustomerName'
                };
                for (const [modelProp, domId] of Object.entries(solidconFields)) {
                    const el = document.getElementById(domId) as HTMLInputElement | null;
                    if (!el) continue;
                    const val = el.value?.trim();
                    if ((modelProp === 'senha_solidcon' || modelProp === 'senha_dorsal') && !val) {
                        continue;
                    }
                    updateData[modelProp] = val || '';
                }

                const showSolidconEl = document.getElementById('showSolidcon') as HTMLSelectElement | null;
                if (showSolidconEl) {
                    updateData['show_solidcon'] = showSolidconEl.value === '1';
                }

                const defaultGroupEl = document.getElementById('defaultCustomerGroupPublicId') as HTMLSelectElement | null;
                if (defaultGroupEl) {
                    updateData['default_customer_group_public_id'] = defaultGroupEl.value || null;
                }

                const defaultBankEl = document.getElementById('defaultBankAccountPublicId') as HTMLSelectElement | null;
                if (defaultBankEl) {
                    updateData['default_bank_account_public_id'] = defaultBankEl.value || null;
                }

                const defaultReceivableEl = document.getElementById('defaultReceivableTypePublicId') as HTMLSelectElement | null;
                if (defaultReceivableEl) {
                    updateData['default_receivable_type_public_id'] = defaultReceivableEl.value || null;
                }

                const autoGenEl = document.getElementById('autoGenerateBillets') as HTMLSelectElement | null;
                if (autoGenEl) {
                    updateData['auto_generate_billets'] = autoGenEl.value === '1';
                }

                const autoGenTimeEl = document.getElementById('autoGenerateBilletsTime') as HTMLInputElement | null;
                if (autoGenTimeEl) {
                    updateData['auto_generate_billets_time'] = autoGenTimeEl.value || null;
                }

                await api(`/companies/${g_companyPublicId}`, {
                    method: 'PUT',
                    body: JSON.stringify(updateData)
                });

                g_companySnapshot = { ...(g_companySnapshot || {}), ...updateData };
                refreshParameterSummary();
                UI.showAlert('alertMessage', 'Integração Solidcon salva com sucesso!', 'success');
            } catch (err) {
                UI.showAlert('alertMessage', err.message || 'Erro ao salvar integração Solidcon', 'error');
            } finally {
                if (btn) { btn.textContent = originalText; btn.disabled = false; }
            }
        });
    }

    const alterdataForm = document.getElementById('alterdataForm');
    if (alterdataForm) {
        alterdataForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('saveAlterdataBtn') as HTMLButtonElement | null;
            const originalText = btn ? btn.textContent : '';
            if (btn) { btn.textContent = 'Salvando...'; btn.disabled = true; }

            try {
                if (!g_companyPublicId) {
                    throw new Error('ID da empresa não processado. Tente recarregar a página.');
                }

                const updateData: any = {};
                const showAlterdataEl = document.getElementById('showAlterdata') as HTMLSelectElement | null;
                if (showAlterdataEl) {
                    updateData['show_alterdata'] = showAlterdataEl.value === '1';
                }

                await api(`/companies/${g_companyPublicId}`, {
                    method: 'PUT',
                    body: JSON.stringify(updateData)
                });

                g_companySnapshot = { ...(g_companySnapshot || {}), ...updateData };
                refreshParameterSummary();
                UI.showAlert('alertMessage', 'Integração Alterdata salva com sucesso!', 'success');
            } catch (err: any) {
                UI.showAlert('alertMessage', err.message || 'Erro ao salvar integração Alterdata', 'error');
            } finally {
                if (btn) { btn.textContent = originalText; btn.disabled = false; }
            }
        });
    }

    const wazeForm = document.getElementById('wazeForm');
    if (wazeForm) {
        wazeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('saveWazeBtn');
            const originalText = btn ? btn.textContent : '';
            if (btn) { btn.textContent = 'Salvando...'; btn.disabled = true; }

            try {
                if (!g_companyPublicId) {
                    throw new Error('ID da empresa não processado. Tente recarregar a página.');
                }

                const wazeUrlVal = (document.getElementById('wazeUrl') as HTMLInputElement)?.value?.trim() || '';
                const updateData = {
                    waze_url: wazeUrlVal
                };

                await api(`/companies/${g_companyPublicId}`, {
                    method: 'PUT',
                    body: JSON.stringify(updateData)
                });

                g_companySnapshot = { ...(g_companySnapshot || {}), ...updateData };
                UI.showAlert('alertMessage', 'Configuração do Waze salva com sucesso!', 'success');
            } catch (err) {
                UI.showAlert('alertMessage', err.message || 'Erro ao salvar configuração do Waze', 'error');
            } finally {
                if (btn) { btn.textContent = originalText; btn.disabled = false; }
            }
        });
    }

    document.getElementById('btnConsultSolidconUrl1')?.addEventListener('click', () => {
        void consultSolidconUrl('solidconUrl1');
    });

    document.getElementById('btnConsultSolidconUrl2')?.addEventListener('click', () => {
        void consultSolidconUrl('solidconUrl2');
    });

    document.getElementById('btnConsultSolidconUrl3')?.addEventListener('click', () => {
        void consultSolidconUrl('solidconUrl3');
    });
 
    document.getElementById('btnConsultSolidconUrl4')?.addEventListener('click', () => {
        openConsultaModal({
            "Example Value": {
                "cnpj": 0,
                "numero": 0,
                "data": "2026-08-06T23:19:24.362Z",
                "valorDesconto": 0,
                "obs": "string",
                "ecommerceSolidcon": true,
                "ecommerceSolidconStatus": 1,
                "cdEcomPedido": 0,
                "codEcom": 1,
                "valorFrete": 0,
                "aceitaTroca": 0,
                "hrCombinada": "2026-08-06T23:19:24.362Z",
                "retiraNaLoja": true,
                "dav": 0,
                "hrRegistro": "2026-08-06T23:19:24.362Z",
                "pdv": 0,
                "cupom": 0,
                "valorRegistrado": 0,
                "itens": [
                    {
                        "numero": 0,
                        "codigoInterno": 0,
                        "quantidade": 0,
                        "quantidadeAtendida": 0,
                        "valorUnitario": 0,
                        "valorDesconto": 0,
                        "obs": "string"
                    }
                ],
                "itensSubstituto": [
                    {
                        "numero": 0,
                        "codigo": 0,
                        "ean": 0,
                        "quantidadeSubstituto": 0,
                        "valorUnitario": 0
                    }
                ],
                "cliente": {
                    "cpf": 0,
                    "nome": "string",
                    "telefone": "string",
                    "endereco": {
                        "logradouro": "string",
                        "numero": "string",
                        "complemento": "string",
                        "bairro": "string",
                        "cidade": "string",
                        "cdMunicipio": 0,
                        "cep": "string",
                        "estado": "string"
                    },
                    "cdCNP_": "string",
                    "dtNascimento": "2026-08-06T23:19:24.362Z",
                    "dtCadastro": "2026-08-06T23:19:24.362Z",
                    "sexo": "string",
                    "nrDependentes": 0,
                    "email": "string",
                    "celular": "string",
                    "idClienteIFood": "string"
                },
                "pagamento": {
                    "formaPagamento": "string",
                    "tef": {
                        "nsuHost": "string",
                        "autorizacao": "string",
                        "codigoCartao": 0,
                        "codigoTipo": 0,
                        "codigoParcela": 0,
                        "codigoOperadora": 0,
                        "cartaoValorReservado": 0,
                        "idPagamento": "string",
                        "bandeira": "string",
                        "parcela": 0,
                        "parcelaModalidade": 0
                    }
                },
                "pagamentoPIX": true
            },
            "Responses": {
                "200": {
                    "status": "success",
                    "message": "Pedido integrado com sucesso."
                },
                "400": {
                    "status": "error",
                    "message": "Dados de requisição inválidos."
                }
            }
        });
    });

    document.getElementById('btnConsultSolidconUrl5')?.addEventListener('click', () => {
        openConsultaModal({
            "Method": "PUT",
            "Route": "/api/Pedido/{cdPedido}/Ecom/{cdEcom}/PutCancelamentoPedido",
            "Path Parameters": {
                "cdPedido": "Número randômico do pedido gerado (ex: 837482)",
                "cdEcom": "Código da integração (ex: 1)"
            },
            "Payload Example": {},
            "Responses": {
                "200": {
                    "status": "success",
                    "message": "Pedido cancelado com sucesso no Solidcon."
                },
                "400": {
                    "status": "error",
                    "message": "Parâmetros inválidos ou erro de processamento."
                }
            }
        });
    });

    document.querySelectorAll('.btn-close-consulta, .modal-backdrop').forEach((element) => {
        element.addEventListener('click', closeConsultaModal);
    });

    document.querySelectorAll('.btn-close-doc-preview, #companyDocPreviewModalBackdrop').forEach((element) => {
        element.addEventListener('click', closeCompanyDocPreview);
    });

    document.getElementById('btnCopyConsultaJson')?.addEventListener('click', async () => {
        const resultEl = document.getElementById('consultaResult');
        const value = resultEl?.value || '';
        if (!value) return;

        try {
            await navigator.clipboard.writeText(value);
            UI.showAlert('alertMessage', 'JSON copiado para a área de transferência.', 'success');
        } catch (_error) {
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
            } catch (err) {
                UI.showAlert('alertMessage', err.message || 'Erro ao atualizar dados da empresa', 'error');
            } finally {
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
        } else {
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
    function attemptToExtractDate(file, password) {}

    function bindCertificatePasswordLookup(file) {
        if (!file) return;

        const pwdInput = document.getElementById('certificatePassword');
        if (!pwdInput) return;

        pwdInput.onchange = () => attemptToExtractDate(file, pwdInput.value);
        if (pwdInput.value) {
            attemptToExtractDate(file, pwdInput.value);
        }
    }

    function applyCertificateSelection(file) {
        if (!file || !certFileNameDisplay) return;

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
        if (!certUploadZone) return;
        certUploadZone.classList.toggle('border-brand-500', isActive);
        certUploadZone.classList.toggle('bg-brand-50', isActive);
        certUploadZone.classList.toggle('dark:border-brand-400', isActive);
    }

    function applyCertificateFromFileList(fileList) {
        if (!fileList || !fileList.length) return;
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
        if (!file) return;

        if (!COMPANY_LOGO_ALLOWED_TYPES.has(file.type)) {
            UI.showAlert('alertMessage', 'Formato de logo inválido. Use PNG, JPG, JPEG ou WEBP.', 'error');
            if (logoFileInput) logoFileInput.value = '';
            return;
        }

        if (file.size > COMPANY_LOGO_MAX_BYTES) {
            UI.showAlert('alertMessage', 'A logo deve ter no máximo 2MB.', 'error');
            if (logoFileInput) logoFileInput.value = '';
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
            if (logoInfo) logoInfo.textContent = 'Ao salvar, esta logo será gravada para a empresa.';
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
            if (logoFileInput) logoFileInput.value = '';
            setCompanyLogoPreviewState();
            const logoInfo = document.getElementById('companyLogoInfo');
            if (logoInfo) logoInfo.textContent = 'Ao salvar, a logo atual será removida.';
        });
    }

    if (logoForm) {
        logoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('saveLogoBtn');
            const originalText = btn ? btn.textContent : '';
            if (btn) { btn.textContent = 'Salvando...'; btn.disabled = true; }

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
                } else if (logoMarkedForRemoval) {
                    updateData.logo_base64 = null;
                    updateData.logo_filename = null;
                } else {
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
            } catch (err) {
                UI.showAlert('alertMessage', err.message || 'Erro ao salvar logo', 'error');
            } finally {
                if (btn) { btn.textContent = originalText; btn.disabled = false; }
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
    const tabBtnAlterdata = document.getElementById('tabBtn-alterdata');
    if (tabBtnAlterdata) {
        tabBtnAlterdata.addEventListener('click', () => switchTab('alterdata'));
    }
    const tabBtnSwagger = document.getElementById('tabBtn-swagger');
    if (tabBtnSwagger) {
        tabBtnSwagger.addEventListener('click', () => switchTab('swagger'));
    }
    const tabBtnWaze = document.getElementById('tabBtn-waze');
    if (tabBtnWaze) {
        tabBtnWaze.addEventListener('click', () => switchTab('waze'));
    }
    const tabBtnDocument = document.getElementById('tabBtn-document');
    if (tabBtnDocument) {
        tabBtnDocument.addEventListener('click', () => switchTab('document'));
    }

    const getBase64 = (file: File) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    };

    const companyCnpjFileInput = document.getElementById('companyCnpjFile') as HTMLInputElement | null;
    if (companyCnpjFileInput) {
        companyCnpjFileInput.addEventListener('change', async (e: any) => {
            const files = Array.from(companyCnpjFileInput.files || []);
            if (files.length === 0) return;
            
            const uploads: { name: string; base64: string; attachedAt: string; filename?: string }[] = [];
            for (const file of files) {
                try {
                    const b64 = (await getBase64(file)) as string;
                    const defaultName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                    uploads.push({
                        name: defaultName,
                        base64: b64,
                        attachedAt: new Date().toISOString(),
                        filename: file.name
                    });
                } catch (err) {
                    console.error(err);
                }
            }
            
            if (uploads.length > 0) {
                try {
                    companyCnpjFileInput.disabled = true;
                    const docContainer = document.getElementById('companyDocumentContainer');
                    if (docContainer) docContainer.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 animate-pulse font-sans">Enviando documentos...</p>';
                    
                    const response = await api(`/companies/${g_companyPublicId}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                            cnpj_document_uploads: uploads
                        })
                    });
                    
                    UI.showAlert('alertMessage', 'Documentos anexados com sucesso!', 'success');
                    companyDocsList = parseCnpjDocuments(response.data?.cnpj_document_url);
                    renderCompanyDocsList();
                } catch (err: any) {
                    console.error(err);
                    UI.showAlert('alertMessage', err.message || 'Erro ao enviar documentos.', 'error');
                    renderCompanyDocsList();
                } finally {
                    companyCnpjFileInput.disabled = false;
                    companyCnpjFileInput.value = '';
                }
            }
        });
    }

    const companyDocContainer = document.getElementById('companyDocumentContainer');
    if (companyDocContainer) {
        companyDocContainer.addEventListener('click', async (e: Event) => {
            const target = e.target as HTMLElement | null;
            const previewBtn = target?.closest('.btn-preview-company-doc');
            const renameBtn = target?.closest('.btn-rename-company-doc');
            const deleteBtn = target?.closest('.btn-delete-company-doc');
            
            if (previewBtn) {
                e.preventDefault();
                const idx = parseInt(previewBtn.getAttribute('data-index') || '0', 10);
                const doc = companyDocsList[idx];
                if (doc) {
                    openCompanyDocPreview(doc);
                }
                return;
            }
            
            if (renameBtn) {
                const idx = parseInt(renameBtn.getAttribute('data-index') || '0', 10);
                const doc = companyDocsList[idx];
                if (doc) {
                    const newName = prompt('Digite o novo nome para o documento:', doc.name);
                    if (newName && newName.trim()) {
                        companyDocsList[idx].name = newName.trim();
                        try {
                            const response = await api(`/companies/${g_companyPublicId}`, {
                                method: 'PUT',
                                body: JSON.stringify({
                                    cnpj_document_url: JSON.stringify(companyDocsList)
                                })
                            });
                            UI.showAlert('alertMessage', 'Documento renomeado com sucesso!', 'success');
                            renderCompanyDocsList();
                        } catch (err: any) {
                            console.error(err);
                            UI.showAlert('alertMessage', 'Erro ao renomear documento.', 'error');
                        }
                    }
                }
            }
            
            if (deleteBtn) {
                const idx = parseInt(deleteBtn.getAttribute('data-index') || '0', 10);
                if (confirm('Deseja realmente excluir este documento?')) {
                    companyDocsList.splice(idx, 1);
                    try {
                        const response = await api(`/companies/${g_companyPublicId}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                                    cnpj_document_url: JSON.stringify(companyDocsList)
                                })
                            });
                            UI.showAlert('alertMessage', 'Documento excluído com sucesso!', 'success');
                            renderCompanyDocsList();
                        } catch (err: any) {
                            console.error(err);
                            UI.showAlert('alertMessage', 'Erro ao excluir documento.', 'error');
                        }
                    }
                }
            });
        }

    const companyActive = document.getElementById('companyActive');
    if (companyActive) {
        companyActive.addEventListener('change', refreshParameterSummary);
    }

    const allowPrintWithoutConfirmation = document.getElementById('allowPrintWithoutConfirmation');
    if (allowPrintWithoutConfirmation) {
        allowPrintWithoutConfirmation.addEventListener('change', refreshParameterSummary);
    }

    const showNewMeasureButton = document.getElementById('showNewMeasureButton');
    if (showNewMeasureButton) {
        showNewMeasureButton.addEventListener('change', refreshParameterSummary);
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
            if (!pwdInput) return;
            const isPassword = pwdInput.type === 'password';
            pwdInput.type = isPassword ? 'text' : 'password';
            if (eyeIcon) eyeIcon.classList.toggle('hidden', isPassword);
            if (eyeOffIcon) eyeOffIcon.classList.toggle('hidden', !isPassword);
        });
    }

    const bindPasswordToggle = (btnId: string, inputId: string) => {
        const btn = document.getElementById(btnId);
        btn?.addEventListener('click', () => {
            const input = document.getElementById(inputId) as HTMLInputElement | null;
            if (!input) return;
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            btn.querySelector('.eye-icon')?.classList.toggle('hidden', isPassword);
            btn.querySelector('.eye-off-icon')?.classList.toggle('hidden', !isPassword);
        });
    };
    bindPasswordToggle('toggleSenhaSolidconBtn', 'senhaSolidcon');
    bindPasswordToggle('toggleSenhaDorsalBtn', 'senhaDorsal');
    bindPasswordToggle('toggleSenhaAlterdataBtn', 'senhaAlterdata');

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
            } catch (err) {
                UI.showAlert('alertMessage', err.message || 'Erro ao testar certificado', 'error', 10000);
            } finally {
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
            if (btn) { btn.textContent = 'Salvando...'; btn.disabled = true; }

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
            } catch (err) {
                UI.showAlert('alertMessage', err.message || 'Erro ao salvar certificado', 'error');
            } finally {
                if (btn) { btn.textContent = originalText; btn.disabled = false; }
            }
        });
    }

    const notasForm = document.getElementById('notasForm');
    if (notasForm) {
        notasForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('saveNotasBtn');
            const originalText = btn ? btn.textContent : '';
            if (btn) { btn.textContent = 'Salvando...'; btn.disabled = true; }

            try {
                if (!g_companyPublicId) {
                    throw new Error("ID da empresa não processado. Tente recarregar a página.");
                }

                const parseOptionalInt = (id: string) => {
                    const val = (document.getElementById(id) as HTMLInputElement)?.value?.trim();
                    if (!val) return null;
                    const parsed = parseInt(val, 10);
                    return isNaN(parsed) ? null : parsed;
                };

                const updateData = {
                    ie: (document.getElementById('inscricaoEstadual') as HTMLInputElement)?.value?.trim() || null,
                    im: (document.getElementById('inscricaoMunicipal') as HTMLInputElement)?.value?.trim() || null,
                    cnae_principal: (document.getElementById('cnae') as HTMLInputElement)?.value?.trim() || null,
                    nfe_environment: parseOptionalInt('nfeAmbiente'),
                    nfe_series: parseOptionalInt('nfeSerie'),
                    nfe_number: parseOptionalInt('nfeNumero'),
                    nfce_series: parseOptionalInt('nfceSerie'),
                    nfce_number: parseOptionalInt('nfceNumero'),
                    csc_token: (document.getElementById('cscToken') as HTMLInputElement)?.value?.trim() || null,
                    csc_id: (document.getElementById('cscId') as HTMLInputElement)?.value?.trim() || null
                };

                await api(`/companies/${g_companyPublicId}`, {
                    method: 'PUT',
                    body: JSON.stringify(updateData)
                });

                g_companySnapshot = { ...(g_companySnapshot || {}), ...updateData };
                refreshParameterSummary();
                UI.showAlert('alertMessage', 'Configurações fiscais salvas com sucesso!', 'success');
            } catch (err) {
                UI.showAlert('alertMessage', err.message || 'Erro ao salvar configurações fiscais', 'error');
            } finally {
                if (btn) { btn.textContent = originalText; btn.disabled = false; }
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
                    show_new_measure_button: !!document.getElementById('showNewMeasureButton')?.checked,
                    is_active: !!document.getElementById('companyActive')?.checked,
                    auto_send_boleto_whatsapp: !!document.getElementById('autoSendBoletoWhatsapp')?.checked,
                    boleto_send_time: (document.getElementById('boletoSendTime') as HTMLInputElement)?.value || '08:00',
                    boleto_send_whatsapp_number: (document.getElementById('boletoSendWhatsappNumber') as HTMLInputElement)?.value || null,
                    boleto_send_whatsapp_name: (document.getElementById('boletoSendWhatsappName') as HTMLInputElement)?.value || null
                };

                await api(`/companies/${g_companyPublicId}`, {
                    method: 'PUT',
                    body: JSON.stringify(updateData)
                });

                g_companySnapshot = { ...(g_companySnapshot || {}), ...updateData };
                refreshParameterSummary();
                UI.showAlert('alertMessage', 'Parâmetros atualizados com sucesso!', 'success');
            } catch (err) {
                UI.showAlert('alertMessage', err.message || 'Erro ao atualizar parâmetros', 'error');
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initCompanyPage().catch(err => console.error('Erro ao inicializar página da empresa:', err));
    });
} else {
    initCompanyPage().catch(err => console.error('Erro ao inicializar página da empresa:', err));
}

// UI function to toggle tabs
window.switchTab = function (tabName) {
    const tabs = ['data', 'param', 'cert', 'logo', 'notas', 'api', 'solidcon', 'alterdata', 'swagger', 'waze', 'document'];

    tabs.forEach(tab => {
        const btn = document.getElementById(`tabBtn-${tab}`);
        const content = document.getElementById(`tabContent-${tab}`);

        if (!btn || !content) return;

        if (tab === tabName) {
            btn.classList.add('active', 'text-brand-600', 'border-brand-600', 'dark:text-brand-500', 'dark:border-brand-500');
            btn.classList.remove('border-transparent', 'hover:text-gray-600', 'hover:border-gray-300', 'text-gray-500');
            content.classList.remove('hidden');
            content.classList.add('flex');
            if (tab === 'param') {
                refreshParameterSummary();
                const boletoSelect = document.getElementById('boletoSendWhatsappName') as HTMLSelectElement | null;
                if (boletoSelect && boletoSelect.options.length <= 1) {
                    populateBoletoWhatsappSenders(g_companySnapshot);
                }
            }
        } else {
            btn.classList.remove('active', 'text-brand-600', 'border-brand-600', 'dark:text-brand-500', 'dark:border-brand-500');
            btn.classList.add('border-transparent', 'hover:text-gray-600', 'hover:border-gray-300', 'text-gray-500');
            content.classList.add('hidden');
            content.classList.remove('flex');
        }
    });
};

    let g_poscontrolConfigs: any[] = [];
    let g_editingPoscontrolConfigId: number | null = null;

    async function loadPosControlConfigs() {
        if (!g_companyPublicId) return;
        try {
            const res = await api(`/companies/${g_companyPublicId}/poscontrol-configs`);
            g_poscontrolConfigs = res.data || [];
            renderPosControlConfigs();
        } catch (err) {
            console.error('Erro ao carregar credenciais PosControl:', err);
        }
    }

    function renderPosControlConfigs() {
        const tbody = document.getElementById('posControlConfigsTableBody');
        if (!tbody) return;

        if (g_poscontrolConfigs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400 font-sans">Nenhuma credencial configurada.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = g_poscontrolConfigs.map((cfg: any) => `
            <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 font-mono truncate max-w-xs">${cfg.ocp_apim_subscription_key || '-'}</td>
                <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 font-mono truncate max-w-xs">${cfg.poscontrol_username || '-'}</td>
                <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 font-mono truncate max-w-xs">${cfg.poscontrol_password ? '••••••••' : '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                    <button type="button" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 btn-edit-poscontrol" data-id="${cfg.id}">Editar</button>
                    <button type="button" class="text-red-600 hover:text-red-900 dark:hover:text-red-400 btn-delete-poscontrol" data-id="${cfg.id}">Excluir</button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-edit-poscontrol').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number((e.currentTarget as HTMLElement).dataset.id);
                const cfg = g_poscontrolConfigs.find((c: any) => c.id === id);
                if (cfg) {
                    g_editingPoscontrolConfigId = id;
                    (document.getElementById('poscontrolOcpApimSubKey') as HTMLInputElement).value = cfg.ocp_apim_subscription_key || '';
                    (document.getElementById('poscontrolUsername') as HTMLInputElement).value = cfg.poscontrol_username || '';
                    const inputPassword = document.getElementById('poscontrolPassword') as HTMLInputElement;
                    if (inputPassword) {
                        inputPassword.value = cfg.poscontrol_password || '';
                        inputPassword.setAttribute('type', 'password');
                        document.getElementById('eyeIconOpen')?.classList.remove('hidden');
                        document.getElementById('eyeIconOpenOuter')?.classList.remove('hidden');
                        document.getElementById('eyeIconClosed')?.classList.add('hidden');
                    }
                    const titleEl = document.getElementById('poscontrol-modal-title');
                    if (titleEl) titleEl.textContent = 'Editar Credencial Pos-Controll';
                    document.getElementById('posControlConfigModal')?.classList.remove('hidden');
                }
            });
        });

        tbody.querySelectorAll('.btn-delete-poscontrol').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = Number((e.currentTarget as HTMLElement).dataset.id);
                if (!confirm('Deseja realmente excluir esta credencial do Pos-Controll?')) return;
                try {
                    await api(`/companies/${g_companyPublicId}/poscontrol-configs/${id}`, { method: 'DELETE' });
                    UI.showAlert('alertMessage', 'Credencial excluída com sucesso!', 'success');
                    await loadPosControlConfigs();
                } catch (err: any) {
                    UI.showAlert('alertMessage', err.message || 'Erro ao excluir credencial', 'error');
                }
            });
        });
    }

    const btnNewPosControlConfig = document.getElementById('btnNewPosControlConfig');
    if (btnNewPosControlConfig) {
        btnNewPosControlConfig.addEventListener('click', () => {
            g_editingPoscontrolConfigId = null;
            (document.getElementById('poscontrolOcpApimSubKey') as HTMLInputElement).value = '';
            (document.getElementById('poscontrolUsername') as HTMLInputElement).value = '';
            const inputPassword = document.getElementById('poscontrolPassword') as HTMLInputElement;
            if (inputPassword) {
                inputPassword.value = '';
                inputPassword.setAttribute('type', 'password');
                document.getElementById('eyeIconOpen')?.classList.remove('hidden');
                document.getElementById('eyeIconOpenOuter')?.classList.remove('hidden');
                document.getElementById('eyeIconClosed')?.classList.add('hidden');
            }
            const titleEl = document.getElementById('poscontrol-modal-title');
            if (titleEl) titleEl.textContent = 'Nova Credencial Pos-Controll';
            document.getElementById('posControlConfigModal')?.classList.remove('hidden');
        });
    }

    const closePosControlConfigModal = () => {
        document.getElementById('posControlConfigModal')?.classList.add('hidden');
    };

    document.querySelectorAll('.btn-close-poscontrol').forEach(btn => {
        btn.addEventListener('click', closePosControlConfigModal);
    });
    document.getElementById('posControlConfigModalBackdrop')?.addEventListener('click', closePosControlConfigModal);

    const btnTogglePassword = document.getElementById('btnTogglePosControlPassword');
    const inputPasswordToggle = document.getElementById('poscontrolPassword') as HTMLInputElement;
    if (btnTogglePassword && inputPasswordToggle) {
        btnTogglePassword.addEventListener('click', () => {
            const isPassword = inputPasswordToggle.getAttribute('type') === 'password';
            inputPasswordToggle.setAttribute('type', isPassword ? 'text' : 'password');
            
            const openIcon = document.getElementById('eyeIconOpen');
            const openOuter = document.getElementById('eyeIconOpenOuter');
            const closedIcon = document.getElementById('eyeIconClosed');
            
            if (isPassword) {
                openIcon?.classList.add('hidden');
                openOuter?.classList.add('hidden');
                closedIcon?.classList.remove('hidden');
            } else {
                openIcon?.classList.remove('hidden');
                openOuter?.classList.remove('hidden');
                closedIcon?.classList.add('hidden');
            }
        });
    }

    const posControlConfigForm = document.getElementById('posControlConfigForm');
    if (posControlConfigForm) {
        posControlConfigForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSave = document.getElementById('btnSavePosControlConfig') as HTMLButtonElement;
            const originalText = btnSave.textContent;
            btnSave.disabled = true;
            btnSave.textContent = 'Salvando...';

            const payload = {
                subscription_key: (document.getElementById('poscontrolOcpApimSubKey') as HTMLInputElement).value,
                ocp_apim_subscription_key: (document.getElementById('poscontrolOcpApimSubKey') as HTMLInputElement).value,
                poscontrol_username: (document.getElementById('poscontrolUsername') as HTMLInputElement).value,
                poscontrol_password: (document.getElementById('poscontrolPassword') as HTMLInputElement).value
            };

            try {
                if (g_editingPoscontrolConfigId) {
                    await api(`/companies/${g_companyPublicId}/poscontrol-configs/${g_editingPoscontrolConfigId}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                    UI.showAlert('alertMessage', 'Credencial atualizada com sucesso!', 'success');
                } else {
                    await api(`/companies/${g_companyPublicId}/poscontrol-configs`, {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    UI.showAlert('alertMessage', 'Credencial salva com sucesso!', 'success');
                }
                closePosControlConfigModal();
                await loadPosControlConfigs();
            } catch (err: any) {
                UI.showAlert('alertMessage', err.message || 'Erro ao salvar credencial', 'error');
            } finally {
                btnSave.disabled = false;
                btnSave.textContent = originalText;
            }
        });
    }

    // Solidcon Database Connections logic
    let g_solidconConfigs: any[] = [];
    let g_editingSolidconConfigId: number | null = null;

    async function loadSolidconConfigs() {
        if (!g_companyPublicId) return;
        try {
            const res = await api(`/companies/${g_companyPublicId}/solidcon-configs`);
            g_solidconConfigs = res.data || [];
            renderSolidconConfigs();
        } catch (err) {
            console.error('Erro ao carregar conexões Solidcon:', err);
        }
    }

    function renderSolidconConfigs() {
        const tbody = document.getElementById('solidconConfigsTableBody');
        if (!tbody) return;

        if (g_solidconConfigs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400 font-sans">Nenhuma conexão cadastrada. Clique em "Nova Conexão" para adicionar.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = g_solidconConfigs.map((cfg: any) => `
            <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 font-sans truncate max-w-xs">
                    <div class="flex items-center gap-2">
                        <span>${escapeHtml(cfg.name || 'Conexão Solidcon')}</span>
                        ${cfg.is_default ? '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">Padrão</span>' : ''}
                    </div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono truncate max-w-xs">${escapeHtml(cfg.serv_solidcon || '-')}</td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono truncate max-w-xs">${escapeHtml(cfg.bd_solidcon || '-')}</td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono truncate max-w-xs">${escapeHtml(cfg.cdfilial ? `Filial: ${cfg.cdfilial}${cfg.cdpdv ? ` | PDV: ${cfg.cdpdv}` : ''}` : (cfg.cdpdv ? `PDV: ${cfg.cdpdv}` : '-'))}</td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono truncate max-w-xs">${escapeHtml(cfg.login_solidcon || '-')}</td>
                <td class="px-4 py-3 text-center text-sm font-medium">
                    ${cfg.is_default 
                        ? '<span class="text-green-600 dark:text-green-400 font-bold inline-flex items-center justify-center"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg></span>' 
                        : '<span class="text-gray-400 dark:text-gray-500">-</span>'}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button type="button" class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 btn-test-solidcon cursor-pointer" data-id="${cfg.id}" title="Testar conexão">Testar</button>
                    <button type="button" class="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 btn-edit-solidcon cursor-pointer" data-id="${cfg.id}" title="Editar">Editar</button>
                    <button type="button" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 btn-delete-solidcon cursor-pointer" data-id="${cfg.id}" title="Excluir">Excluir</button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-edit-solidcon').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number((e.currentTarget as HTMLElement).dataset.id);
                const cfg = g_solidconConfigs.find((c: any) => c.id === id);
                if (cfg) {
                    openSolidconConfigModal(cfg);
                }
            });
        });

        tbody.querySelectorAll('.btn-test-solidcon').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const targetBtn = e.currentTarget as HTMLButtonElement;
                const id = Number(targetBtn.dataset.id);
                const originalText = targetBtn.textContent;
                targetBtn.disabled = true;
                targetBtn.textContent = 'Testando...';

                try {
                    const res = await api(`/companies/${g_companyPublicId}/solidcon-configs/${id}/test`, {
                        method: 'POST'
                    });
                    if (res.status === 'success' && res.connected) {
                        UI.showAlert('alertMessage', `Conexão "${res.config?.name || 'Solidcon'}" realizada com sucesso!`, 'success');
                    } else {
                        UI.showAlert('alertMessage', res.message || 'Falha ao conectar com o banco Solidcon.', 'error');
                    }
                } catch (err: any) {
                    UI.showAlert('alertMessage', err.message || 'Erro ao testar conexão Solidcon.', 'error');
                } finally {
                    targetBtn.disabled = false;
                    targetBtn.textContent = originalText;
                }
            });
        });

        tbody.querySelectorAll('.btn-delete-solidcon').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = Number((e.currentTarget as HTMLElement).dataset.id);
                const cfg = g_solidconConfigs.find((c: any) => c.id === id);
                const name = cfg ? `"${cfg.name}"` : 'esta conexão';
                if (!confirm(`Deseja realmente excluir ${name}?`)) return;
                try {
                    await api(`/companies/${g_companyPublicId}/solidcon-configs/${id}`, { method: 'DELETE' });
                    UI.showAlert('alertMessage', 'Conexão Solidcon excluída com sucesso!', 'success');
                    await loadSolidconConfigs();
                } catch (err: any) {
                    UI.showAlert('alertMessage', err.message || 'Erro ao excluir conexão Solidcon', 'error');
                }
            });
        });
    }

    function openSolidconConfigModal(cfg?: any) {
        const modalAlert = document.getElementById('solidconConfigModalAlert');
        if (modalAlert) {
            modalAlert.className = 'hidden p-3 rounded-lg text-xs font-medium border';
            modalAlert.textContent = '';
        }

        const nameInput = document.getElementById('solidconConfigName') as HTMLInputElement;
        const serverInput = document.getElementById('solidconConfigServer') as HTMLInputElement;
        const dbInput = document.getElementById('solidconConfigDatabase') as HTMLInputElement;
        const userInput = document.getElementById('solidconConfigUser') as HTMLInputElement;
        const passInput = document.getElementById('solidconConfigPassword') as HTMLInputElement;
        const cdFilialInput = document.getElementById('solidconConfigCdFilial') as HTMLInputElement;
        const cdPdvInput = document.getElementById('solidconConfigCdPdv') as HTMLInputElement;
        const defaultInput = document.getElementById('solidconConfigIsDefault') as HTMLInputElement;
        const titleEl = document.getElementById('solidcon-config-modal-title');

        if (cfg) {
            g_editingSolidconConfigId = cfg.id;
            if (titleEl) titleEl.textContent = 'Editar Conexão Banco de Dados Solidcon';
            if (nameInput) nameInput.value = cfg.name || '';
            if (serverInput) serverInput.value = cfg.serv_solidcon || '';
            if (dbInput) dbInput.value = cfg.bd_solidcon || '';
            if (userInput) userInput.value = cfg.login_solidcon || '';
            if (passInput) {
                passInput.value = '';
                passInput.placeholder = '•••••••• (manter atual)';
                passInput.setAttribute('type', 'password');
            }
            if (cdFilialInput) cdFilialInput.value = cfg.cdfilial || '';
            if (cdPdvInput) cdPdvInput.value = cfg.cdpdv || '';
            if (defaultInput) defaultInput.checked = !!cfg.is_default;
        } else {
            g_editingSolidconConfigId = null;
            if (titleEl) titleEl.textContent = 'Nova Conexão Banco de Dados Solidcon';
            if (nameInput) nameInput.value = '';
            if (serverInput) serverInput.value = '';
            if (dbInput) dbInput.value = '';
            if (userInput) userInput.value = '';
            if (passInput) {
                passInput.value = '';
                passInput.placeholder = '••••••••';
                passInput.setAttribute('type', 'password');
            }
            if (cdFilialInput) cdFilialInput.value = '';
            if (cdPdvInput) cdPdvInput.value = '';
            if (defaultInput) defaultInput.checked = g_solidconConfigs.length === 0;
        }

        const eye = document.querySelector('#btnToggleSolidconConfigPassword .eye-icon');
        const eyeOff = document.querySelector('#btnToggleSolidconConfigPassword .eye-off-icon');
        eye?.classList.remove('hidden');
        eyeOff?.classList.add('hidden');

        document.getElementById('solidconConfigModal')?.classList.remove('hidden');
    }

    function closeSolidconConfigModal() {
        document.getElementById('solidconConfigModal')?.classList.add('hidden');
    }

    const btnNewSolidconConfig = document.getElementById('btnNewSolidconConfig');
    if (btnNewSolidconConfig) {
        btnNewSolidconConfig.addEventListener('click', () => {
            openSolidconConfigModal();
        });
    }

    document.querySelectorAll('.btn-close-solidcon-config').forEach(btn => {
        btn.addEventListener('click', closeSolidconConfigModal);
    });
    document.getElementById('solidconConfigModalBackdrop')?.addEventListener('click', closeSolidconConfigModal);

    const btnToggleSolidconPass = document.getElementById('btnToggleSolidconConfigPassword');
    const inputSolidconPass = document.getElementById('solidconConfigPassword') as HTMLInputElement;
    if (btnToggleSolidconPass && inputSolidconPass) {
        btnToggleSolidconPass.addEventListener('click', () => {
            const isPassword = inputSolidconPass.getAttribute('type') === 'password';
            inputSolidconPass.setAttribute('type', isPassword ? 'text' : 'password');
            const eye = btnToggleSolidconPass.querySelector('.eye-icon');
            const eyeOff = btnToggleSolidconPass.querySelector('.eye-off-icon');
            if (isPassword) {
                eye?.classList.add('hidden');
                eyeOff?.classList.remove('hidden');
            } else {
                eye?.classList.remove('hidden');
                eyeOff?.classList.add('hidden');
            }
        });
    }

    const btnTestSolidconModal = document.getElementById('btnTestSolidconConfigModal') as HTMLButtonElement;
    if (btnTestSolidconModal) {
        btnTestSolidconModal.addEventListener('click', async () => {
            const modalAlert = document.getElementById('solidconConfigModalAlert');
            const serv_solidcon = (document.getElementById('solidconConfigServer') as HTMLInputElement)?.value?.trim();
            const bd_solidcon = (document.getElementById('solidconConfigDatabase') as HTMLInputElement)?.value?.trim();
            const login_solidcon = (document.getElementById('solidconConfigUser') as HTMLInputElement)?.value?.trim();
            const senha_solidcon = (document.getElementById('solidconConfigPassword') as HTMLInputElement)?.value?.trim();

            if (!serv_solidcon || !bd_solidcon || !login_solidcon) {
                if (modalAlert) {
                    modalAlert.className = 'p-3 rounded-lg text-xs font-medium border bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
                    modalAlert.textContent = 'Preencha Servidor, Banco de Dados e Login para testar.';
                }
                return;
            }

            const originalText = btnTestSolidconModal.textContent;
            btnTestSolidconModal.disabled = true;
            btnTestSolidconModal.textContent = 'Testando...';

            if (modalAlert) {
                modalAlert.className = 'p-3 rounded-lg text-xs font-medium border bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
                modalAlert.textContent = 'Testando conexão com o banco de dados Solidcon...';
            }

            try {
                const payload: any = {
                    serv_solidcon,
                    bd_solidcon,
                    login_solidcon,
                    senha_solidcon
                };
                if (g_editingSolidconConfigId) {
                    payload.id = g_editingSolidconConfigId;
                }

                const res = await api(`/companies/${g_companyPublicId}/solidcon-configs/test`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                if (modalAlert) {
                    if (res.status === 'success' && res.connected) {
                        modalAlert.className = 'p-3 rounded-lg text-xs font-medium border bg-green-50 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
                        modalAlert.textContent = `Conexão bem-sucedida! Banco de dados Solidcon acessível.`;
                    } else {
                        modalAlert.className = 'p-3 rounded-lg text-xs font-medium border bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
                        modalAlert.textContent = res.message || 'Falha ao conectar com o banco de dados Solidcon.';
                    }
                }
            } catch (err: any) {
                if (modalAlert) {
                    modalAlert.className = 'p-3 rounded-lg text-xs font-medium border bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
                    modalAlert.textContent = err.message || 'Erro ao testar conexão com o banco Solidcon.';
                }
            } finally {
                btnTestSolidconModal.disabled = false;
                btnTestSolidconModal.textContent = originalText;
            }
        });
    }

    const solidconConfigForm = document.getElementById('solidconConfigForm');
    if (solidconConfigForm) {
        solidconConfigForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSave = document.getElementById('btnSaveSolidconConfig') as HTMLButtonElement;
            const originalText = btnSave ? btnSave.textContent : '';
            if (btnSave) {
                btnSave.disabled = true;
                btnSave.textContent = 'Salvando...';
            }

            const name = (document.getElementById('solidconConfigName') as HTMLInputElement)?.value?.trim();
            const serv_solidcon = (document.getElementById('solidconConfigServer') as HTMLInputElement)?.value?.trim();
            const bd_solidcon = (document.getElementById('solidconConfigDatabase') as HTMLInputElement)?.value?.trim();
            const login_solidcon = (document.getElementById('solidconConfigUser') as HTMLInputElement)?.value?.trim();
            const senha_solidcon = (document.getElementById('solidconConfigPassword') as HTMLInputElement)?.value?.trim();
            const cdfilial = (document.getElementById('solidconConfigCdFilial') as HTMLInputElement)?.value?.trim();
            const cdpdv = (document.getElementById('solidconConfigCdPdv') as HTMLInputElement)?.value?.trim();
            const is_default = (document.getElementById('solidconConfigIsDefault') as HTMLInputElement)?.checked;

            if (!name || !serv_solidcon || !bd_solidcon || !login_solidcon) {
                UI.showAlert('alertMessage', 'Preencha todos os campos obrigatórios.', 'warning');
                if (btnSave) {
                    btnSave.disabled = false;
                    btnSave.textContent = originalText;
                }
                return;
            }

            const payload: any = {
                name,
                serv_solidcon,
                bd_solidcon,
                login_solidcon,
                cdfilial: cdfilial || null,
                cdpdv: cdpdv || null,
                is_default
            };
            if (senha_solidcon) {
                payload.senha_solidcon = senha_solidcon;
            }

            try {
                if (g_editingSolidconConfigId) {
                    await api(`/companies/${g_companyPublicId}/solidcon-configs/${g_editingSolidconConfigId}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                    UI.showAlert('alertMessage', 'Conexão Solidcon atualizada com sucesso!', 'success');
                } else {
                    await api(`/companies/${g_companyPublicId}/solidcon-configs`, {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    UI.showAlert('alertMessage', 'Conexão Solidcon criada com sucesso!', 'success');
                }
                closeSolidconConfigModal();
                await loadSolidconConfigs();
            } catch (err: any) {
                const modalAlert = document.getElementById('solidconConfigModalAlert');
                if (modalAlert) {
                    modalAlert.className = 'p-3 rounded-lg text-xs font-medium border bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
                    modalAlert.textContent = err.message || 'Erro ao salvar conexão Solidcon.';
                } else {
                    UI.showAlert('alertMessage', err.message || 'Erro ao salvar conexão Solidcon', 'error');
                }
            } finally {
                if (btnSave) {
                    btnSave.disabled = false;
                    btnSave.textContent = originalText;
                }
            }
        });
    }

    // Dorsal Database Connections logic
    let g_dorsalConfigs: any[] = [];
    let g_editingDorsalConfigId: number | null = null;

    async function loadDorsalConfigs() {
        if (!g_companyPublicId) return;
        try {
            const res = await api(`/companies/${g_companyPublicId}/dorsal-configs`);
            g_dorsalConfigs = res.data || [];
            renderDorsalConfigs();
        } catch (err) {
            console.error('Erro ao carregar conexões Dorsal:', err);
        }
    }

    function renderDorsalConfigs() {
        const tbody = document.getElementById('dorsalConfigsTableBody');
        if (!tbody) return;

        if (g_dorsalConfigs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400 font-sans">Nenhuma conexão cadastrada. Clique em "Nova Conexão" para adicionar.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = g_dorsalConfigs.map((cfg: any) => `
            <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 font-sans truncate max-w-xs">
                    <div class="flex items-center gap-2">
                        <span>${escapeHtml(cfg.name || 'Conexão Dorsal')}</span>
                        ${cfg.is_default ? '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">Padrão</span>' : ''}
                    </div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono truncate max-w-xs">${escapeHtml(cfg.serv_dorsal || '-')}</td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono truncate max-w-xs">${escapeHtml(cfg.bd_dorsal || '-')}</td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono truncate max-w-xs">${escapeHtml(cfg.cdfilial ? `Filial: ${cfg.cdfilial}${cfg.cdpdv ? ` | PDV: ${cfg.cdpdv}` : ''}` : (cfg.cdpdv ? `PDV: ${cfg.cdpdv}` : '-'))}</td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono truncate max-w-xs">${escapeHtml(cfg.login_dorsal || '-')}</td>
                <td class="px-4 py-3 text-center text-sm font-medium">
                    ${cfg.is_default 
                        ? '<span class="text-green-600 dark:text-green-400 font-bold inline-flex items-center justify-center"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg></span>' 
                        : '<span class="text-gray-400 dark:text-gray-500">-</span>'}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button type="button" class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 btn-test-dorsal cursor-pointer" data-id="${cfg.id}" title="Testar conexão">Testar</button>
                    <button type="button" class="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 btn-edit-dorsal cursor-pointer" data-id="${cfg.id}" title="Editar">Editar</button>
                    <button type="button" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 btn-delete-dorsal cursor-pointer" data-id="${cfg.id}" title="Excluir">Excluir</button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-edit-dorsal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number((e.currentTarget as HTMLElement).dataset.id);
                const cfg = g_dorsalConfigs.find((c: any) => c.id === id);
                if (cfg) {
                    openDorsalConfigModal(cfg);
                }
            });
        });

        tbody.querySelectorAll('.btn-test-dorsal').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const targetBtn = e.currentTarget as HTMLButtonElement;
                const id = Number(targetBtn.dataset.id);
                const originalText = targetBtn.textContent;
                targetBtn.disabled = true;
                targetBtn.textContent = 'Testando...';

                try {
                    const res = await api(`/companies/${g_companyPublicId}/dorsal-configs/${id}/test`, {
                        method: 'POST'
                    });
                    if (res.status === 'success' && res.connected) {
                        UI.showAlert('alertMessage', `Conexão "${res.config?.name || 'Dorsal'}" realizada com sucesso!`, 'success');
                    } else {
                        UI.showAlert('alertMessage', res.message || 'Falha ao conectar com o banco Dorsal.', 'error');
                    }
                } catch (err: any) {
                    UI.showAlert('alertMessage', err.message || 'Erro ao testar conexão Dorsal.', 'error');
                } finally {
                    targetBtn.disabled = false;
                    targetBtn.textContent = originalText;
                }
            });
        });

        tbody.querySelectorAll('.btn-delete-dorsal').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = Number((e.currentTarget as HTMLElement).dataset.id);
                const cfg = g_dorsalConfigs.find((c: any) => c.id === id);
                const name = cfg ? `"${cfg.name}"` : 'esta conexão';
                if (!confirm(`Deseja realmente excluir ${name}?`)) return;
                try {
                    await api(`/companies/${g_companyPublicId}/dorsal-configs/${id}`, { method: 'DELETE' });
                    UI.showAlert('alertMessage', 'Conexão Dorsal excluída com sucesso!', 'success');
                    await loadDorsalConfigs();
                } catch (err: any) {
                    UI.showAlert('alertMessage', err.message || 'Erro ao excluir conexão Dorsal', 'error');
                }
            });
        });
    }

    function openDorsalConfigModal(cfg?: any) {
        const modalAlert = document.getElementById('dorsalConfigModalAlert');
        if (modalAlert) {
            modalAlert.className = 'hidden p-3 rounded-lg text-xs font-medium border';
            modalAlert.textContent = '';
        }

        const nameInput = document.getElementById('dorsalConfigName') as HTMLInputElement;
        const serverInput = document.getElementById('dorsalConfigServer') as HTMLInputElement;
        const dbInput = document.getElementById('dorsalConfigDatabase') as HTMLInputElement;
        const userInput = document.getElementById('dorsalConfigUser') as HTMLInputElement;
        const passInput = document.getElementById('dorsalConfigPassword') as HTMLInputElement;
        const cdFilialInput = document.getElementById('dorsalConfigCdFilial') as HTMLInputElement;
        const cdPdvInput = document.getElementById('dorsalConfigCdPdv') as HTMLInputElement;
        const defaultInput = document.getElementById('dorsalConfigIsDefault') as HTMLInputElement;
        const titleEl = document.getElementById('dorsal-config-modal-title');

        if (cfg) {
            g_editingDorsalConfigId = cfg.id;
            if (titleEl) titleEl.textContent = 'Editar Conexão Banco de Dados Dorsal';
            if (nameInput) nameInput.value = cfg.name || '';
            if (serverInput) serverInput.value = cfg.serv_dorsal || '';
            if (dbInput) dbInput.value = cfg.bd_dorsal || '';
            if (userInput) userInput.value = cfg.login_dorsal || '';
            if (passInput) {
                passInput.value = '';
                passInput.placeholder = '•••••••• (manter atual)';
                passInput.setAttribute('type', 'password');
            }
            if (cdFilialInput) cdFilialInput.value = cfg.cdfilial || '';
            if (cdPdvInput) cdPdvInput.value = cfg.cdpdv || '';
            if (defaultInput) defaultInput.checked = !!cfg.is_default;
        } else {
            g_editingDorsalConfigId = null;
            if (titleEl) titleEl.textContent = 'Nova Conexão Banco de Dados Dorsal';
            if (nameInput) nameInput.value = '';
            if (serverInput) serverInput.value = '';
            if (dbInput) dbInput.value = '';
            if (userInput) userInput.value = '';
            if (passInput) {
                passInput.value = '';
                passInput.placeholder = '••••••••';
                passInput.setAttribute('type', 'password');
            }
            if (cdFilialInput) cdFilialInput.value = '';
            if (cdPdvInput) cdPdvInput.value = '';
            if (defaultInput) defaultInput.checked = g_dorsalConfigs.length === 0;
        }

        const eye = document.querySelector('#btnToggleDorsalConfigPassword .eye-icon');
        const eyeOff = document.querySelector('#btnToggleDorsalConfigPassword .eye-off-icon');
        eye?.classList.remove('hidden');
        eyeOff?.classList.add('hidden');

        document.getElementById('dorsalConfigModal')?.classList.remove('hidden');
    }

    function closeDorsalConfigModal() {
        document.getElementById('dorsalConfigModal')?.classList.add('hidden');
    }

    const btnNewDorsalConfig = document.getElementById('btnNewDorsalConfig');
    if (btnNewDorsalConfig) {
        btnNewDorsalConfig.addEventListener('click', () => {
            openDorsalConfigModal();
        });
    }

    document.querySelectorAll('.btn-close-dorsal-config').forEach(btn => {
        btn.addEventListener('click', closeDorsalConfigModal);
    });
    document.getElementById('dorsalConfigModalBackdrop')?.addEventListener('click', closeDorsalConfigModal);

    const btnToggleDorsalPass = document.getElementById('btnToggleDorsalConfigPassword');
    const inputDorsalPass = document.getElementById('dorsalConfigPassword') as HTMLInputElement;
    if (btnToggleDorsalPass && inputDorsalPass) {
        btnToggleDorsalPass.addEventListener('click', () => {
            const isPassword = inputDorsalPass.getAttribute('type') === 'password';
            inputDorsalPass.setAttribute('type', isPassword ? 'text' : 'password');
            const eye = btnToggleDorsalPass.querySelector('.eye-icon');
            const eyeOff = btnToggleDorsalPass.querySelector('.eye-off-icon');
            if (isPassword) {
                eye?.classList.add('hidden');
                eyeOff?.classList.remove('hidden');
            } else {
                eye?.classList.remove('hidden');
                eyeOff?.classList.add('hidden');
            }
        });
    }

    const btnTestDorsalModal = document.getElementById('btnTestDorsalConfigModal') as HTMLButtonElement;
    if (btnTestDorsalModal) {
        btnTestDorsalModal.addEventListener('click', async () => {
            const modalAlert = document.getElementById('dorsalConfigModalAlert');
            const serv_dorsal = (document.getElementById('dorsalConfigServer') as HTMLInputElement)?.value?.trim();
            const bd_dorsal = (document.getElementById('dorsalConfigDatabase') as HTMLInputElement)?.value?.trim();
            const login_dorsal = (document.getElementById('dorsalConfigUser') as HTMLInputElement)?.value?.trim();
            const senha_dorsal = (document.getElementById('dorsalConfigPassword') as HTMLInputElement)?.value?.trim();

            if (!serv_dorsal || !bd_dorsal || !login_dorsal) {
                if (modalAlert) {
                    modalAlert.className = 'p-3 rounded-lg text-xs font-medium border bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
                    modalAlert.textContent = 'Preencha Servidor, Banco de Dados e Login para testar.';
                }
                return;
            }

            const originalText = btnTestDorsalModal.textContent;
            btnTestDorsalModal.disabled = true;
            btnTestDorsalModal.textContent = 'Testando...';

            if (modalAlert) {
                modalAlert.className = 'p-3 rounded-lg text-xs font-medium border bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
                modalAlert.textContent = 'Testando conexão com o banco de dados Dorsal...';
            }

            try {
                const payload: any = {
                    serv_dorsal,
                    bd_dorsal,
                    login_dorsal,
                    senha_dorsal
                };
                if (g_editingDorsalConfigId) {
                    payload.id = g_editingDorsalConfigId;
                }

                const res = await api(`/companies/${g_companyPublicId}/dorsal-configs/test`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                if (modalAlert) {
                    if (res.status === 'success' && res.connected) {
                        modalAlert.className = 'p-3 rounded-lg text-xs font-medium border bg-green-50 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
                        modalAlert.textContent = `Conexão bem-sucedida! Banco de dados Dorsal acessível.`;
                    } else {
                        modalAlert.className = 'p-3 rounded-lg text-xs font-medium border bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
                        modalAlert.textContent = res.message || 'Falha ao conectar com o banco de dados Dorsal.';
                    }
                }
            } catch (err: any) {
                if (modalAlert) {
                    modalAlert.className = 'p-3 rounded-lg text-xs font-medium border bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
                    modalAlert.textContent = err.message || 'Erro ao testar conexão com o banco Dorsal.';
                }
            } finally {
                btnTestDorsalModal.disabled = false;
                btnTestDorsalModal.textContent = originalText;
            }
        });
    }

    const dorsalConfigForm = document.getElementById('dorsalConfigForm');
    if (dorsalConfigForm) {
        dorsalConfigForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSave = document.getElementById('btnSaveDorsalConfig') as HTMLButtonElement;
            const originalText = btnSave ? btnSave.textContent : '';
            if (btnSave) {
                btnSave.disabled = true;
                btnSave.textContent = 'Salvando...';
            }

            const name = (document.getElementById('dorsalConfigName') as HTMLInputElement)?.value?.trim();
            const serv_dorsal = (document.getElementById('dorsalConfigServer') as HTMLInputElement)?.value?.trim();
            const bd_dorsal = (document.getElementById('dorsalConfigDatabase') as HTMLInputElement)?.value?.trim();
            const login_dorsal = (document.getElementById('dorsalConfigUser') as HTMLInputElement)?.value?.trim();
            const senha_dorsal = (document.getElementById('dorsalConfigPassword') as HTMLInputElement)?.value?.trim();
            const cdfilial = (document.getElementById('dorsalConfigCdFilial') as HTMLInputElement)?.value?.trim();
            const cdpdv = (document.getElementById('dorsalConfigCdPdv') as HTMLInputElement)?.value?.trim();
            const is_default = (document.getElementById('dorsalConfigIsDefault') as HTMLInputElement)?.checked;

            if (!name || !serv_dorsal || !bd_dorsal || !login_dorsal) {
                UI.showAlert('alertMessage', 'Preencha todos os campos obrigatórios.', 'warning');
                if (btnSave) {
                    btnSave.disabled = false;
                    btnSave.textContent = originalText;
                }
                return;
            }

            const payload: any = {
                name,
                serv_dorsal,
                bd_dorsal,
                login_dorsal,
                cdfilial: cdfilial || null,
                cdpdv: cdpdv || null,
                is_default
            };
            if (senha_dorsal) {
                payload.senha_dorsal = senha_dorsal;
            }

            try {
                if (g_editingDorsalConfigId) {
                    await api(`/companies/${g_companyPublicId}/dorsal-configs/${g_editingDorsalConfigId}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                    UI.showAlert('alertMessage', 'Conexão Dorsal atualizada com sucesso!', 'success');
                } else {
                    await api(`/companies/${g_companyPublicId}/dorsal-configs`, {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    UI.showAlert('alertMessage', 'Conexão Dorsal criada com sucesso!', 'success');
                }
                closeDorsalConfigModal();
                await loadDorsalConfigs();
            } catch (err: any) {
                const modalAlert = document.getElementById('dorsalConfigModalAlert');
                if (modalAlert) {
                    modalAlert.className = 'p-3 rounded-lg text-xs font-medium border bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
                    modalAlert.textContent = err.message || 'Erro ao salvar conexão Dorsal.';
                } else {
                    UI.showAlert('alertMessage', err.message || 'Erro ao salvar conexão Dorsal', 'error');
                }
            } finally {
                if (btnSave) {
                    btnSave.disabled = false;
                    btnSave.textContent = originalText;
                }
            }
        });
    }

    // Alterdata Database Connections logic
    let g_alterdataConfigs: any[] = [];
    let g_editingAlterdataConfigId: number | null = null;

    async function loadAlterdataConfigs() {
        if (!g_companyPublicId) return;
        try {
            const res = await api(`/companies/${g_companyPublicId}/alterdata-configs`);
            g_alterdataConfigs = res.data || [];
            renderAlterdataConfigs();
        } catch (err) {
            console.error('Erro ao carregar conexões Alterdata:', err);
        }
    }

    function renderAlterdataConfigs() {
        const tbody = document.getElementById('alterdataConfigsTableBody');
        if (!tbody) return;

        if (g_alterdataConfigs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400 font-sans">Nenhuma conexão cadastrada. Clique em "Nova Conexão" para adicionar.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = g_alterdataConfigs.map((cfg: any) => `
            <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 font-sans truncate max-w-xs">
                    <div class="flex items-center gap-2">
                        <span>${escapeHtml(cfg.name || 'Conexão Alterdata')}</span>
                        ${cfg.is_default ? '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">Padrão</span>' : ''}
                    </div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono truncate max-w-xs">${escapeHtml(cfg.serv_alterdata || '-')}${cfg.porta_alterdata ? `:${escapeHtml(String(cfg.porta_alterdata))}` : ''}</td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono truncate max-w-xs">${escapeHtml(cfg.bd_alterdata || '-')}</td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono truncate max-w-xs">${escapeHtml(cfg.cdempresa_alterdata || '-')}</td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono truncate max-w-xs">${escapeHtml(cfg.login_alterdata || '-')}</td>
                <td class="px-4 py-3 text-center text-sm font-medium">
                    ${cfg.is_default 
                        ? '<span class="text-green-600 dark:text-green-400 font-bold inline-flex items-center justify-center"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg></span>' 
                        : '<span class="text-gray-400 dark:text-gray-500">-</span>'}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button type="button" class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 btn-test-alterdata cursor-pointer" data-id="${cfg.id}" title="Testar conexão">Testar</button>
                    <button type="button" class="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 btn-edit-alterdata cursor-pointer" data-id="${cfg.id}" title="Editar">Editar</button>
                    <button type="button" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 btn-delete-alterdata cursor-pointer" data-id="${cfg.id}" title="Excluir">Excluir</button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-edit-alterdata').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number((e.currentTarget as HTMLElement).dataset.id);
                const cfg = g_alterdataConfigs.find((c: any) => c.id === id);
                if (cfg) {
                    openAlterdataConfigModal(cfg);
                }
            });
        });

        tbody.querySelectorAll('.btn-test-alterdata').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const targetBtn = e.currentTarget as HTMLButtonElement;
                const id = Number(targetBtn.dataset.id);
                const originalText = targetBtn.textContent;
                targetBtn.disabled = true;
                targetBtn.textContent = 'Testando...';

                try {
                    const res = await api(`/companies/${g_companyPublicId}/alterdata-configs/${id}/test`, {
                        method: 'POST'
                    });
                    if (res.status === 'success' && res.connected) {
                        UI.showAlert('alertMessage', `Conexão "${res.config?.name || 'Alterdata'}" realizada com sucesso!`, 'success');
                    } else {
                        UI.showAlert('alertMessage', res.message || 'Falha ao conectar com o banco Alterdata.', 'error');
                    }
                } catch (err: any) {
                    UI.showAlert('alertMessage', err.message || 'Erro ao testar conexão Alterdata.', 'error');
                } finally {
                    targetBtn.disabled = false;
                    targetBtn.textContent = originalText;
                }
            });
        });

        tbody.querySelectorAll('.btn-delete-alterdata').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = Number((e.currentTarget as HTMLElement).dataset.id);
                const cfg = g_alterdataConfigs.find((c: any) => c.id === id);
                const name = cfg ? `"${cfg.name}"` : 'esta conexão';
                if (!confirm(`Deseja realmente excluir ${name}?`)) return;
                try {
                    await api(`/companies/${g_companyPublicId}/alterdata-configs/${id}`, { method: 'DELETE' });
                    UI.showAlert('alertMessage', 'Conexão Alterdata excluída com sucesso!', 'success');
                    await loadAlterdataConfigs();
                } catch (err: any) {
                    UI.showAlert('alertMessage', err.message || 'Erro ao excluir conexão Alterdata', 'error');
                }
            });
        });
    }

    function openAlterdataConfigModal(cfg?: any) {
        const modalAlert = document.getElementById('alterdataConfigModalAlert');
        if (modalAlert) {
            modalAlert.className = 'hidden p-3 rounded-lg text-xs font-medium border';
            modalAlert.textContent = '';
        }

        const nameInput = document.getElementById('alterdataConfigName') as HTMLInputElement;
        const serverInput = document.getElementById('alterdataConfigServer') as HTMLInputElement;
        const portInput = document.getElementById('alterdataConfigPort') as HTMLInputElement;
        const dbInput = document.getElementById('alterdataConfigDatabase') as HTMLInputElement;
        const cdEmpresaInput = document.getElementById('alterdataConfigCdEmpresa') as HTMLInputElement;
        const userInput = document.getElementById('alterdataConfigUser') as HTMLInputElement;
        const passInput = document.getElementById('alterdataConfigPassword') as HTMLInputElement;
        const defaultInput = document.getElementById('alterdataConfigIsDefault') as HTMLInputElement;
        const titleEl = document.getElementById('alterdata-config-modal-title');

        if (cfg) {
            g_editingAlterdataConfigId = cfg.id;
            if (titleEl) titleEl.textContent = 'Editar Conexão Banco de Dados Alterdata';
            if (nameInput) nameInput.value = cfg.name || '';
            if (serverInput) serverInput.value = cfg.serv_alterdata || '';
            if (portInput) portInput.value = cfg.porta_alterdata ? String(cfg.porta_alterdata) : '1433';
            if (dbInput) dbInput.value = cfg.bd_alterdata || '';
            if (cdEmpresaInput) cdEmpresaInput.value = cfg.cdempresa_alterdata || '';
            if (userInput) userInput.value = cfg.login_alterdata || '';
            if (passInput) {
                passInput.value = '';
                passInput.placeholder = '•••••••• (manter atual)';
                passInput.setAttribute('type', 'password');
            }
            if (defaultInput) defaultInput.checked = !!cfg.is_default;
        } else {
            g_editingAlterdataConfigId = null;
            if (titleEl) titleEl.textContent = 'Nova Conexão Banco de Dados Alterdata';
            if (nameInput) nameInput.value = '';
            if (serverInput) serverInput.value = '';
            if (portInput) portInput.value = '1433';
            if (dbInput) dbInput.value = '';
            if (cdEmpresaInput) cdEmpresaInput.value = '';
            if (userInput) userInput.value = '';
            if (passInput) {
                passInput.value = '';
                passInput.placeholder = '••••••••';
                passInput.setAttribute('type', 'password');
            }
            if (defaultInput) defaultInput.checked = g_alterdataConfigs.length === 0;
        }

        const eye = document.querySelector('#btnToggleAlterdataConfigPassword .eye-icon');
        const eyeOff = document.querySelector('#btnToggleAlterdataConfigPassword .eye-off-icon');
        eye?.classList.remove('hidden');
        eyeOff?.classList.add('hidden');

        document.getElementById('alterdataConfigModal')?.classList.remove('hidden');
    }

    function closeAlterdataConfigModal() {
        document.getElementById('alterdataConfigModal')?.classList.add('hidden');
    }

    const btnNewAlterdataConfig = document.getElementById('btnNewAlterdataConfig');
    if (btnNewAlterdataConfig) {
        btnNewAlterdataConfig.addEventListener('click', () => {
            openAlterdataConfigModal();
        });
    }

    document.querySelectorAll('.btn-close-alterdata-config').forEach(btn => {
        btn.addEventListener('click', closeAlterdataConfigModal);
    });
    document.getElementById('alterdataConfigModalBackdrop')?.addEventListener('click', closeAlterdataConfigModal);

    const btnToggleAlterdataPass = document.getElementById('btnToggleAlterdataConfigPassword');
    const inputAlterdataPass = document.getElementById('alterdataConfigPassword') as HTMLInputElement;
    if (btnToggleAlterdataPass && inputAlterdataPass) {
        btnToggleAlterdataPass.addEventListener('click', () => {
            const isPassword = inputAlterdataPass.getAttribute('type') === 'password';
            inputAlterdataPass.setAttribute('type', isPassword ? 'text' : 'password');
            const eye = btnToggleAlterdataPass.querySelector('.eye-icon');
            const eyeOff = btnToggleAlterdataPass.querySelector('.eye-off-icon');
            if (isPassword) {
                eye?.classList.add('hidden');
                eyeOff?.classList.remove('hidden');
            } else {
                eye?.classList.remove('hidden');
                eyeOff?.classList.add('hidden');
            }
        });
    }

    const btnTestAlterdataModal = document.getElementById('btnTestAlterdataConfigModal') as HTMLButtonElement;
    if (btnTestAlterdataModal) {
        btnTestAlterdataModal.addEventListener('click', async () => {
            const modalAlert = document.getElementById('alterdataConfigModalAlert');
            const serv_alterdata = (document.getElementById('alterdataConfigServer') as HTMLInputElement)?.value?.trim();
            const porta_alterdata_str = (document.getElementById('alterdataConfigPort') as HTMLInputElement)?.value?.trim();
            const porta_alterdata = porta_alterdata_str ? parseInt(porta_alterdata_str, 10) : undefined;
            const bd_alterdata = (document.getElementById('alterdataConfigDatabase') as HTMLInputElement)?.value?.trim();
            const cdempresa_alterdata = (document.getElementById('alterdataConfigCdEmpresa') as HTMLInputElement)?.value?.trim();
            const login_alterdata = (document.getElementById('alterdataConfigUser') as HTMLInputElement)?.value?.trim();
            const senha_alterdata = (document.getElementById('alterdataConfigPassword') as HTMLInputElement)?.value?.trim();

            if (!serv_alterdata || !bd_alterdata || !login_alterdata) {
                if (modalAlert) {
                    modalAlert.className = 'p-3 rounded-lg text-xs font-medium border bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
                    modalAlert.textContent = 'Preencha Servidor, Banco de Dados e Login para testar.';
                }
                return;
            }

            const originalText = btnTestAlterdataModal.textContent;
            btnTestAlterdataModal.disabled = true;
            btnTestAlterdataModal.textContent = 'Testando...';

            if (modalAlert) {
                modalAlert.className = 'p-3 rounded-lg text-xs font-medium border bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
                modalAlert.textContent = 'Testando conexão com o banco de dados Alterdata...';
            }

            try {
                const payload: any = {
                    serv_alterdata,
                    porta_alterdata,
                    bd_alterdata,
                    cdempresa_alterdata,
                    login_alterdata,
                    senha_alterdata
                };
                if (g_editingAlterdataConfigId) {
                    payload.id = g_editingAlterdataConfigId;
                }

                const res = await api(`/companies/${g_companyPublicId}/alterdata-configs/test`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                if (modalAlert) {
                    if (res.status === 'success' && res.connected) {
                        modalAlert.className = 'p-3 rounded-lg text-xs font-medium border bg-green-50 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
                        modalAlert.textContent = `Conexão bem-sucedida! Banco de dados Alterdata acessível.`;
                    } else {
                        modalAlert.className = 'p-3 rounded-lg text-xs font-medium border bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
                        modalAlert.textContent = res.message || 'Falha ao conectar com o banco de dados Alterdata.';
                    }
                }
            } catch (err: any) {
                if (modalAlert) {
                    modalAlert.className = 'p-3 rounded-lg text-xs font-medium border bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
                    modalAlert.textContent = err.message || 'Erro ao testar conexão com o banco Alterdata.';
                }
            } finally {
                btnTestAlterdataModal.disabled = false;
                btnTestAlterdataModal.textContent = originalText;
            }
        });
    }

    const alterdataConfigForm = document.getElementById('alterdataConfigForm');
    if (alterdataConfigForm) {
        alterdataConfigForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSave = document.getElementById('btnSaveAlterdataConfig') as HTMLButtonElement;
            const originalText = btnSave ? btnSave.textContent : '';
            if (btnSave) {
                btnSave.disabled = true;
                btnSave.textContent = 'Salvando...';
            }

            const name = (document.getElementById('alterdataConfigName') as HTMLInputElement)?.value?.trim();
            const serv_alterdata = (document.getElementById('alterdataConfigServer') as HTMLInputElement)?.value?.trim();
            const porta_alterdata_str = (document.getElementById('alterdataConfigPort') as HTMLInputElement)?.value?.trim();
            const porta_alterdata = porta_alterdata_str ? parseInt(porta_alterdata_str, 10) : 1433;
            const bd_alterdata = (document.getElementById('alterdataConfigDatabase') as HTMLInputElement)?.value?.trim();
            const cdempresa_alterdata = (document.getElementById('alterdataConfigCdEmpresa') as HTMLInputElement)?.value?.trim();
            const login_alterdata = (document.getElementById('alterdataConfigUser') as HTMLInputElement)?.value?.trim();
            const senha_alterdata = (document.getElementById('alterdataConfigPassword') as HTMLInputElement)?.value?.trim();
            const is_default = (document.getElementById('alterdataConfigIsDefault') as HTMLInputElement)?.checked;

            if (!name || !serv_alterdata || !bd_alterdata || !login_alterdata) {
                UI.showAlert('alertMessage', 'Preencha todos os campos obrigatórios.', 'warning');
                if (btnSave) {
                    btnSave.disabled = false;
                    btnSave.textContent = originalText;
                }
                return;
            }

            const payload: any = {
                name,
                serv_alterdata,
                porta_alterdata,
                bd_alterdata,
                cdempresa_alterdata: cdempresa_alterdata || null,
                login_alterdata,
                is_default
            };
            if (senha_alterdata) {
                payload.senha_alterdata = senha_alterdata;
            }

            try {
                if (g_editingAlterdataConfigId) {
                    await api(`/companies/${g_companyPublicId}/alterdata-configs/${g_editingAlterdataConfigId}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                    UI.showAlert('alertMessage', 'Conexão Alterdata atualizada com sucesso!', 'success');
                } else {
                    await api(`/companies/${g_companyPublicId}/alterdata-configs`, {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    UI.showAlert('alertMessage', 'Conexão Alterdata criada com sucesso!', 'success');
                }
                closeAlterdataConfigModal();
                await loadAlterdataConfigs();
            } catch (err: any) {
                const modalAlert = document.getElementById('alterdataConfigModalAlert');
                if (modalAlert) {
                    modalAlert.className = 'p-3 rounded-lg text-xs font-medium border bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
                    modalAlert.textContent = err.message || 'Erro ao salvar conexão Alterdata.';
                } else {
                    UI.showAlert('alertMessage', err.message || 'Erro ao salvar conexão Alterdata', 'error');
                }
            } finally {
                if (btnSave) {
                    btnSave.disabled = false;
                    btnSave.textContent = originalText;
                }
            }
        });
    }
})();
