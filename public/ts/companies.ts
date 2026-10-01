
(function initCompaniesPage() {

type Company = any;

let companiesData: Company[] = [];
let filteredCompanies: Company[] = [];
let currentView: 'list' | 'grid' = 'list';
const selectedCompanyIds = new Set<string>();
let companyDocMask: any;
let companyPhoneMask: any;
let companyZipMask: any;
let companyIbgeStates: Array<{ uf?: string; name?: string }> = [];

const getById = (id: string): any => document.getElementById(id);
const qs = (selector: string): any => document.querySelector(selector);
const qsa = (selector: string): any => document.querySelectorAll(selector);

const makeMask: any =
    (window as any).createMaskAdapter ||
    ((input: any, options: any) => (window as any).IMask(input, options));

function isCompactViewport() {
    return window.matchMedia('(max-width: 767px)').matches;
}

function getCompanySelectionKey(item) {
    return String(item.public_id || item.id || '');
}

function getVisibleSelectedCount(items) {
    return items.filter((item) => selectedCompanyIds.has(getCompanySelectionKey(item))).length;
}

function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

function formatCNPJ(value) {
    const clean = String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (clean.length !== 14) return value || '-';
    return clean.replace(/^([a-zA-Z0-9]{2})([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{4})([a-zA-Z0-9]{2})$/, "$1.$2.$3/$4-$5");
}

function formatPhone(value) {
    const digits = onlyDigits(value);
    if (digits.length === 11) {
        return digits.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    } else if (digits.length === 10) {
        return digits.replace(/^(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    return value || '-';
}

function setMaskedValue(maskInstance, inputId, value) {
    if (maskInstance) {
        maskInstance.unmaskedValue = onlyDigits(value);
        return;
    }

    const input = getById(inputId);
    if (input) {
        input.value = value || '';
    }
}

function getMaskedValue(maskInstance, inputId) {
    if (maskInstance) {
        return maskInstance.unmaskedValue || '';
    }

    const val = getById(inputId)?.value || '';
    if (inputId === 'companyCnpj') {
        return String(val).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    }
    return onlyDigits(val);
}

function populateCompanyStateOptions(selectedValue = '') {
    const stateSelect = getById('companyState');
    if (!stateSelect || !companyIbgeStates.length) return;

    const normalizedSelectedValue = String(selectedValue || '').trim().toUpperCase();
    stateSelect.innerHTML = [
        '<option value="">Selecione...</option>',
        ...companyIbgeStates.map((state) => `<option value="${state.uf}">${state.uf} - ${state.name}</option>`),
    ].join('');
    stateSelect.value = companyIbgeStates.some((state) => state.uf === normalizedSelectedValue) ? normalizedSelectedValue : '';
}

async function loadCompanyStateOptions() {
    try {
        const response = await api('/companies/states');
        companyIbgeStates = response.data || [];
        populateCompanyStateOptions(getById('companyState')?.value || '');
    } catch (error) {
        console.error('Falha ao carregar UFs do IBGE', error);
    }
}

async function lookupAddressByCep(cep) {
    const normalizedCep = onlyDigits(cep);
    if (normalizedCep.length !== 8) return null;

    let data: any = null;
    let cepNotFound = false;

    try {
        const viaCepResponse = await fetch(`https://viacep.com.br/ws/${normalizedCep}/json/`);
        if (viaCepResponse.ok) {
            const viaCepData = await viaCepResponse.json();
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
        // Fallback to BrasilAPI below.
    }

    if (!data && !cepNotFound) {
        try {
            const brasilApiResponse = await fetch(`https://brasilapi.com.br/api/cep/v1/${normalizedCep}`);
            if (brasilApiResponse.ok) {
                data = await brasilApiResponse.json();
            } else if (brasilApiResponse.status === 404) {
                cepNotFound = true;
            }
        } catch (_error) {
            // Keep null and let caller handle the fallback.
        }
    }

    return data;
}

function applyCepLookupResult(data) {
    if (!data) return;

    getById('companyStreet').value = data.street || '';
    getById('companyNeighborhood').value = data.neighborhood || '';
    getById('companyCity').value = data.city || '';
    getById('companyComplement').value = data.complement || '';
    populateCompanyStateOptions(data.state || '');
}

async function handleCompanyCepLookup() {
    const cep = getMaskedValue(companyZipMask, 'companyZipcode');
    if (cep.length !== 8) return;

    try {
        const data = await lookupAddressByCep(cep);
        if (data && (data.street || data.city)) {
            applyCepLookupResult(data);
        } else {
            UI.showAlert('alertMessage', 'CEP não encontrado ou inválido.', 'error');
        }
    } catch (error) {
        console.error('Falha ao consultar CEP', error);
    }
}

async function handleCompanyCnpjLookup() {
    const cnpj = getMaskedValue(companyDocMask, 'companyCnpj');
    if (cnpj.length !== 14) return;

    try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
        const data = await response.json();

        if (!response.ok || !data?.razao_social) {
            UI.showAlert('alertMessage', 'CNPJ não encontrado ou inválido.', 'error');
            return;
        }

        getById('companyLegalName').value = data.razao_social || '';
        if (!getById('companyTradeName').value.trim()) {
            getById('companyTradeName').value = data.nome_fantasia || data.razao_social || '';
        }
        getById('companyTaxRegime').value = data.opcao_pelo_simples ? 'Simples Nacional' : (getById('companyTaxRegime').value || '');
        getById('companyEmail').value = data.email || getById('companyEmail').value || '';
        setMaskedValue(companyPhoneMask, 'companyPhone', data.ddd_telefone_1 || '');
        setMaskedValue(companyZipMask, 'companyZipcode', data.cep || '');
        getById('companyStreet').value = data.logradouro || getById('companyStreet').value || '';
        getById('companyNumber').value = data.numero || getById('companyNumber').value || '';
        getById('companyComplement').value = data.complemento || getById('companyComplement').value || '';
        getById('companyNeighborhood').value = data.bairro || getById('companyNeighborhood').value || '';
        getById('companyCity').value = data.municipio || getById('companyCity').value || '';
        populateCompanyStateOptions(data.uf || '');

        if (data.cep) {
            const cepData = await lookupAddressByCep(data.cep);
            if (cepData) {
                applyCepLookupResult({
                    ...cepData,
                    complement: cepData.complement || data.complemento || '',
                });
            }
        }
    } catch (error) {
        console.error('Falha ao consultar CNPJ', error);
    }
}

function setupCompanyFormEnhancements() {
    const cnpjInput = getById('companyCnpj');
    const phoneInput = getById('companyPhone');
    const cepInput = getById('companyZipcode');

    if (cnpjInput && !companyDocMask) {
        companyDocMask = makeMask(cnpjInput, {
            mask: [
                { mask: '000.000.000-00' },
                { 
                    mask: 'XX.XXX.XXX/XXXX-XX',
                    definitions: {
                        'X': /[a-zA-Z0-9]/
                    }
                },
            ],
            prepare: (str: string) => str.toUpperCase()
        });
        cnpjInput.addEventListener('blur', handleCompanyCnpjLookup);
    }

    if (phoneInput && !companyPhoneMask) {
        companyPhoneMask = makeMask(phoneInput, {
            mask: [
                { mask: '(00) 0000-0000' },
                { mask: '(00) 00000-0000' },
            ],
        });
    }

    if (cepInput && !companyZipMask) {
        companyZipMask = makeMask(cepInput, { mask: '00000-000' });
        companyZipMask.on('complete', handleCompanyCepLookup);
    }
}

function updateViewToggle() {
    const btnList = getById('btnListView');
    const btnGrid = getById('btnGridView');
    const tableSection = getById('companiesSection');
    const gridSection = getById('companiesGridSection');

    if (tableSection && gridSection) {
        if (currentView === 'list') {
            tableSection.classList.remove('hidden');
            tableSection.classList.add('flex');
            gridSection.classList.add('hidden');
        } else {
            tableSection.classList.add('hidden');
            tableSection.classList.remove('flex');
            gridSection.classList.remove('hidden');
        }
    }

    if (btnList && btnGrid) {
        btnList.className = 'flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1';
        btnGrid.className = 'flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1';

        btnList.querySelector('.check-icon')?.classList.add('hidden');
        btnGrid.querySelector('.check-icon')?.classList.add('hidden');

        if (currentView === 'list') {
            btnList.className = 'flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1';
            btnList.querySelector('.check-icon')?.classList.remove('hidden');
        } else {
            btnGrid.className = 'flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1';
            btnGrid.querySelector('.check-icon')?.classList.remove('hidden');
        }
    }

    updateSummaryFooters(filteredCompanies);
}

function getCompanyByPublicId(publicId) {
    return companiesData.find((item) => String(item.public_id) === String(publicId)) || null;
}

function syncCompanyGroupMasterVisibility() {
    const groupSelect = getById('companyGroup') as HTMLSelectElement | null;
    const isGroupMasterCheckbox = getById('companyIsGroupMaster') as HTMLInputElement | null;
    if (!groupSelect || !isGroupMasterCheckbox) return;

    if (!groupSelect.value && isGroupMasterCheckbox.checked) {
        isGroupMasterCheckbox.checked = false;
    }
}

function resetCompanyForm() {
    getById('companyForm')?.reset();
    getById('companyId').value = '';
    const isGeneralAdminCheckbox = getById('companyIsGeneralAdmin');
    if (isGeneralAdminCheckbox) isGeneralAdminCheckbox.checked = false;
    const isGroupMasterCheckbox = getById('companyIsGroupMaster');
    if (isGroupMasterCheckbox) isGroupMasterCheckbox.checked = false;
    const groupSelect = getById('companyGroup');
    if (groupSelect) groupSelect.value = '';
    syncCompanyGroupMasterVisibility();
    getById('companyModalTitle').textContent = 'Nova Empresa';
    getById('companyModalStatus').textContent = 'Cadastre uma nova empresa para o ambiente global.';
    setMaskedValue(companyDocMask, 'companyCnpj', '');
    setMaskedValue(companyPhoneMask, 'companyPhone', '');
    setMaskedValue(companyZipMask, 'companyZipcode', '');
    populateCompanyStateOptions('');

    // Exibe seção do primeiro usuário e torna campos obrigatórios
    const section = getById('initialUserSection');
    if (section) section.classList.remove('hidden');
    getById('initialUserName')?.setAttribute('required', 'required');
    getById('initialUserEmail')?.setAttribute('required', 'required');
    getById('initialUserPassword')?.setAttribute('required', 'required');
    getById('initialUserName').value = '';
    getById('initialUserEmail').value = '';
    getById('initialUserPassword').value = '';
    getById('initialUserRole').value = 'supervisor';
}

function fillCompanyForm(item) {
    getById('companyId').value = item.public_id || '';
    const isGeneralAdminCheckbox = getById('companyIsGeneralAdmin');
    if (isGeneralAdminCheckbox) isGeneralAdminCheckbox.checked = item.is_general_admin === true || item.is_general_admin === 1;
    const isGroupMasterCheckbox = getById('companyIsGroupMaster');
    if (isGroupMasterCheckbox) isGroupMasterCheckbox.checked = item.is_group_master === true || item.is_group_master === 1;
    const groupSelect = getById('companyGroup');
    if (groupSelect) groupSelect.value = item.company_group_public_id || '';
    syncCompanyGroupMasterVisibility();
    getById('companyTradeName').value = item.trade_name || '';
    getById('companyLegalName').value = item.company_name || '';
    getById('companyTaxRegime').value = item.tax_regime || '';
    getById('companyEmail').value = item.email || '';
    getById('companyStreet').value = item.street || '';
    getById('companyNumber').value = item.number || '';
    getById('companyComplement').value = item.complement || '';
    getById('companyNeighborhood').value = item.neighborhood || '';
    getById('companyCity').value = item.city || '';
    setMaskedValue(companyDocMask, 'companyCnpj', item.cnpj || '');
    setMaskedValue(companyPhoneMask, 'companyPhone', item.phone || '');
    setMaskedValue(companyZipMask, 'companyZipcode', item.zipcode || '');
    populateCompanyStateOptions(item.state || '');
    getById('companyModalTitle').textContent = 'Editar Empresa';
    getById('companyModalStatus').textContent = `Status atual: ${item.is_active !== false && item.is_active !== 0 ? 'Ativa' : 'Inativa'}.`;

    // Mantém seção do primeiro usuário visível, mas campos opcionais na edição
    const section = getById('initialUserSection');
    if (section) section.classList.remove('hidden');
    getById('initialUserName')?.removeAttribute('required');
    getById('initialUserEmail')?.removeAttribute('required');
    getById('initialUserPassword')?.removeAttribute('required');
    getById('initialUserName').value = '';
    getById('initialUserEmail').value = '';
    getById('initialUserPassword').value = '';
    getById('initialUserRole').value = 'supervisor';
}

function openCompanyModal(item = null) {
    if (item) {
        fillCompanyForm(item);
    } else {
        resetCompanyForm();
    }

    getById('companyModal')?.classList.remove('hidden');
    getById('companyTradeName')?.focus();
}

function closeCompanyModal() {
    getById('companyModal')?.classList.add('hidden');
}

function getCompanyFormPayload(isEdit = false) {
    const payload: any = {
        trade_name: getById('companyTradeName').value.trim(),
        company_name: getById('companyLegalName').value.trim(),
        cnpj: getMaskedValue(companyDocMask, 'companyCnpj'),
        tax_regime: getById('companyTaxRegime').value.trim(),
        email: getById('companyEmail').value.trim(),
        phone: getMaskedValue(companyPhoneMask, 'companyPhone'),
        zipcode: getMaskedValue(companyZipMask, 'companyZipcode'),
        street: getById('companyStreet').value.trim(),
        number: getById('companyNumber').value.trim(),
        complement: getById('companyComplement').value.trim(),
        neighborhood: getById('companyNeighborhood').value.trim(),
        city: getById('companyCity').value.trim(),
        state: getById('companyState').value.trim(),
        is_general_admin: getById('companyIsGeneralAdmin')?.checked || false,
        is_group_master: getById('companyIsGroupMaster')?.checked || false,
        company_group_public_id: getById('companyGroup')?.value || null,
    };

    const initialUserName = getById('initialUserName').value.trim();
    const initialUserEmail = getById('initialUserEmail').value.trim();
    const initialUserPassword = getById('initialUserPassword').value;

    if (!isEdit || (initialUserName && initialUserEmail && initialUserPassword)) {
        payload.initial_user = {
            full_name: initialUserName,
            email: initialUserEmail,
            passwordRaw: initialUserPassword,
            role: getById('initialUserRole').value,
        };
    }

    return payload;
}

async function submitCompanyForm(event) {
    event.preventDefault();

    const companyId = getById('companyId').value;
    const isEdit = Boolean(companyId);
    const payload = getCompanyFormPayload(isEdit);

    if (!payload.trade_name) {
        UI.showAlert('alertMessage', 'O nome fantasia / responsável é obrigatório.', 'error');
        getById('companyTradeName')?.focus();
        return;
    }

    if (payload.is_group_master && !payload.company_group_public_id) {
        UI.showAlert('alertMessage', 'Para definir a empresa como Principal do Grupo, selecione um Grupo de Empresa.', 'error');
        getById('companyGroup')?.focus();
        return;
    }

    if (!isEdit) {
        const u = payload.initial_user;
        if (!u.full_name) {
            UI.showAlert('alertMessage', 'O nome do usuário é obrigatório.', 'error');
            getById('initialUserName')?.focus();
            return;
        }
        if (!u.email) {
            UI.showAlert('alertMessage', 'O email do usuário é obrigatório.', 'error');
            getById('initialUserEmail')?.focus();
            return;
        }
        if (!u.passwordRaw || u.passwordRaw.length < 6) {
            UI.showAlert('alertMessage', 'A senha do usuário deve ter no mínimo 6 caracteres.', 'error');
            getById('initialUserPassword')?.focus();
            return;
        }
    }

    const saveButton = getById('saveCompanyBtn');
    const originalText = saveButton?.textContent || 'Salvar';
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = 'Salvando...';
    }

    try {
        await api(isEdit ? `/companies/${companyId}` : '/companies', {
            method: isEdit ? 'PUT' : 'POST',
            body: JSON.stringify(payload),
        });

        closeCompanyModal();
        UI.showAlert('alertMessage', `Empresa ${isEdit ? 'atualizada' : 'cadastrada'} com sucesso!`, 'success');
        await loadCompanies();
    } catch (error) {
        UI.showAlert('alertMessage', error.message || 'Falha ao salvar empresa.', 'error');
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = originalText;
        }
    }
}

async function toggleCompanyStatus(publicId) {
    const company = getCompanyByPublicId(publicId);
    if (!company) return;

    const isActive = company.is_active !== false && company.is_active !== 0;
    const nextStatus = !isActive;
    const actionLabel = nextStatus ? 'ativar' : 'inativar';

    if (!window.confirm(`Deseja ${actionLabel} a empresa "${getCompanyDisplayName(company)}"?`)) {
        return;
    }

    try {
        await api(`/companies/${publicId}`, {
            method: 'PUT',
            body: JSON.stringify({ is_active: nextStatus }),
        });

        UI.showAlert('alertMessage', `Empresa ${nextStatus ? 'ativada' : 'inativada'} com sucesso!`, 'success');
        await loadCompanies();
    } catch (error) {
        UI.showAlert('alertMessage', error.message || 'Falha ao atualizar o status da empresa.', 'error');
    }
}

async function deleteCompany(publicId) {
    const company = getCompanyByPublicId(publicId);
    if (!company) return;

    const displayName = getCompanyDisplayName(company);
    const confirmName = window.prompt(`⚠ ATENÇÃO: Esta ação é IRREVERSÍVEL!\n\nTodos os dados financeiros, produtos, notas fiscais e usuários desta empresa serão APAGADOS permanentEMENTE.\n\nPara confirmar a exclusão da empresa "${displayName}", digite exatamente o nome dela abaixo:`);

    if (confirmName !== displayName) {
        if (confirmName !== null) alert('Nome incorreto. Exclusão cancelada.');
        return;
    }

    try {
        const btn = qs(`button[data-id="${publicId}"].delete-company-btn`);
        if (btn) btn.disabled = true;

        await api(`/companies/${publicId}`, { method: 'DELETE' });

        UI.showAlert('alertMessage', `Empresa "${displayName}" e todos os seus dados foram removidos do sistema.`, 'success');
        await loadCompanies();
    } catch (error) {
        UI.showAlert('alertMessage', error.message || 'Falha ao excluir empresa.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '/';
        return;
    }

    try {
        const authResponse = await api('/auth/me');
        const currentUser = authResponse?.data?.user || null;

        const currentCompany = authResponse?.data?.company || null;
        const isGeneralAdminCompany = currentCompany?.is_general_admin === true || currentCompany?.is_general_admin === 1;
        const hasGeneralAdminContext = Boolean(currentUser?.general_admin_company_id);
        const isGroupMasterCompany = (currentCompany?.is_group_master === true || currentCompany?.is_group_master === 1) && !!currentCompany?.company_group_id;
        const hasGroupMasterContext = Boolean(currentUser?.group_master_company_id);

        const isSuperOrGeneralAdmin = currentUser?.role === 'super_admin' || isGeneralAdminCompany || hasGeneralAdminContext;

        if (!currentUser || (!isSuperOrGeneralAdmin && !isGroupMasterCompany && !hasGroupMasterContext)) {
            window.location.href = '/pages/dashboard.html';
            return;
        }

        const generalAdminContainer = getById('companyGeneralAdminContainer');
        if (generalAdminContainer) {
            generalAdminContainer.classList.toggle('hidden', !isSuperOrGeneralAdmin);
        }

        const userGreeting = getById('userGreeting');
        if (userGreeting && currentUser.full_name) {
            userGreeting.textContent = `Olá, ${currentUser.full_name}`;
        }
    } catch (error) {
        console.error('Falha ao validar sessão do super admin', error);
        window.location.href = '/';
        return;
    }

    currentView = 'list';
    localStorage.setItem('companiesView', 'list');
    setupCompanyFormEnhancements();
    await loadCompanyStateOptions();
    await loadCompanyGroupsOptions();

    async function loadCompanyGroupsOptions() {
        try {
            const res = await api('/company-groups');
            const groups = res.data || [];
            const select = getById('companyGroup');
            if (select) {
                select.innerHTML = '<option value="">Nenhum grupo</option>';
                groups.forEach((g) => {
                    select.innerHTML += `<option value="${g.public_id}">${g.name}</option>`;
                });
            }
            syncCompanyGroupMasterVisibility();
        } catch (e) {
            console.error('Erro ao carregar grupos de empresa', e);
        }
    }

    window.FilterPanel.mount({
        storageKey: 'companies_filter_panel',
        fields: [
            { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Empresa, CNPJ, cidade ou contato' },
            {
                id: 'filterStatus',
                type: 'select',
                label: 'Status',
                options: [
                    { value: '', label: 'Todos' },
                    { value: 'active', label: 'Ativas' },
                    { value: 'inactive', label: 'Inativas' },
                ],
            },
            {
                id: 'filterState',
                type: 'select',
                label: 'UF',
                options: [{ value: '', label: 'Todas' }],
            },
        ],
        gridClass: 'grid grid-cols-1 md:grid-cols-3 gap-3 items-end',
    });

    getById('btnListView')?.addEventListener('click', () => {
        currentView = 'list';
        localStorage.setItem('companiesView', 'list');
        renderTable(filteredCompanies);
        updateViewToggle();
    });

    getById('btnGridView')?.addEventListener('click', () => {
        currentView = 'grid';
        localStorage.setItem('companiesView', 'grid');
        renderGrid(filteredCompanies);
        updateViewToggle();
    });

    let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    getById('filterSearch')?.addEventListener('input', () => {
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
        }
        searchDebounceTimer = setTimeout(() => {
            applyFilters();
            searchDebounceTimer = null;
        }, 180);
    });
    getById('filterStatus')?.addEventListener('change', applyFilters);
    getById('filterState')?.addEventListener('change', applyFilters);
    getById('companyGroup')?.addEventListener('change', syncCompanyGroupMasterVisibility);
    getById('companyIsGroupMaster')?.addEventListener('change', (e: any) => {
        const groupSelect = getById('companyGroup') as HTMLSelectElement | null;
        if (e.target.checked && !groupSelect?.value) {
            UI.showAlert('alertMessage', 'Selecione um Grupo de Empresa para definir esta empresa como Principal do Grupo.', 'info');
            groupSelect?.focus();
        }
    });
    getById('btnOpenCompanyModal')?.addEventListener('click', () => openCompanyModal());
    getById('btnCancelCompanyModal')?.addEventListener('click', closeCompanyModal);
    getById('companyModalBackdrop')?.addEventListener('click', closeCompanyModal);
    getById('companyForm')?.addEventListener('submit', submitCompanyForm);

    setupDetailsModalTabs();
    updateViewToggle();
    loadCompanies();
});

async function loadCompanies() {
    try {
        const response = await api('/companies');
        companiesData = response.data || [];
        updateSummary(companiesData);
        populateStateFilter(companiesData);
        applyFilters();
    } catch (error) {
        console.error('Falha ao carregar empresas cadastradas', error);
        UI.showAlert('alertMessage', error.message || 'Erro ao carregar a relação de empresas.', 'error');
    }
}

function updateSummary(items) {
    const total = items.length;
    const active = items.filter((item) => item.is_active !== false && item.is_active !== 0).length;
    const states = new Set(items.map((item) => String(item.state || '').trim()).filter(Boolean));

    const elTotal = getById('companiesCount');
    if (elTotal) elTotal.textContent = String(total);
    
    const elActive = getById('companiesActiveCount');
    if (elActive) elActive.textContent = String(active);
    
    const elStates = getById('companiesStatesCount');
    if (elStates) elStates.textContent = String(states.size);
}

function populateStateFilter(items) {
    const select = getById('filterState');
    if (!select) return;

    const currentValue = select.value || '';
    const states = Array.from(new Set(items.map((item) => String(item.state || '').trim()).filter(Boolean))).sort();

    select.innerHTML = [
        '<option value="">Todas</option>',
        ...states.map((state) => `<option value="${state}">${state}</option>`),
    ].join('');

    select.value = states.includes(currentValue) ? currentValue : '';
}

function applyFilters() {
    const search = window.FilterPanel.normalizeText(getById('filterSearch')?.value);
    const status = getById('filterStatus')?.value || '';
    const state = getById('filterState')?.value || '';

    filteredCompanies = companiesData.filter((item) => {
        if (!window.FilterPanel.matchesSearch(item, ['trade_name', 'company_name', 'cnpj', 'email', 'phone', 'city', 'state'], search)) {
            return false;
        }

        const isActive = item.is_active !== false && item.is_active !== 0;
        if (status === 'active' && !isActive) {
            return false;
        }
        if (status === 'inactive' && isActive) {
            return false;
        }

        if (state && String(item.state || '').trim() !== state) {
            return false;
        }

        return true;
    });

    renderTable(filteredCompanies);
    renderGrid(filteredCompanies);
    updateResultsFooter(filteredCompanies);
    updateSummaryFooters(filteredCompanies);
    updateViewToggle();
}

function updateResultsFooter(items) {
    const footer = getById('companiesResultsFooter');
    if (!footer) return;

    if (items.length === 0) {
        footer.textContent = 'Nenhuma empresa encontrada com os filtros atuais.';
        return;
    }

    const selectedVisibleCount = getVisibleSelectedCount(items);
    footer.textContent = `${items.length} empresa(s) exibida(s) nesta visão global.${selectedVisibleCount > 0 ? ` ${selectedVisibleCount} marcada(s).` : ''}`;
}

function updateSummaryFooters(items) {
    window.GridSummaryFooter?.update({
        footerId: 'companiesListSummaryFooter',
        anchorId: 'companiesSection',
        count: items.length,
        label: 'empresa(s) exibida(s)',
    });

    window.GridSummaryFooter?.update({
        footerId: 'companiesGridSummaryFooter',
        anchorId: 'companiesGridSection',
        count: items.length,
        label: 'empresa(s) exibida(s)',
    });

    const listFooter = getById('companiesListSummaryFooter');
    if (listFooter) {
        listFooter.classList.toggle('hidden', currentView !== 'list');
    }

    const gridFooter = getById('companiesGridSummaryFooter');
    if (gridFooter) {
        gridFooter.classList.toggle('hidden', currentView !== 'grid');
    }
}

function getStatusBadge(item) {
    const isActive = item.is_active !== false && item.is_active !== 0;
    return isActive
        ? '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Ativa</span>'
        : '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Inativa</span>';
}

function getCompanyDisplayName(item) {
    return item.trade_name || item.company_name || 'Empresa sem nome';
}

function getCompanyLegalName(item) {
    if (!item.company_name || item.company_name === item.trade_name) {
        return 'Razão social alinhada ao nome principal';
    }

    return item.company_name;
}

function getLocation(item) {
    const city = String(item.city || '').trim();
    const state = String(item.state || '').trim();
    const zipcode = String(item.zipcode || '').trim();
    const cityState = [city, state].filter(Boolean).join(' / ');
    return [cityState, zipcode].filter(Boolean).join(' • ') || 'Localização não informada';
}

function getContact(item) {
    return [item.email, formatPhone(item.phone)].filter(Boolean).join(' • ') || 'Contato não informado';
}

function getCompanySequence(item, index) {
    return String(item.id || index + 1).padStart(4, '0');
}

function getStatusToggleActionLabel(item) {
    return item.is_active !== false && item.is_active !== 0 ? 'Inativar' : 'Ativar';
}

function getStatusToggleActionClasses(item) {
    return item.is_active !== false && item.is_active !== 0
        ? 'text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40'
        : 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40';
}

function getEditActionIcon() {
    return `
        <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
        </svg>
    `;
}

function getStatusToggleActionIcon(item) {
    if (item.is_active !== false && item.is_active !== 0) {
        return `
            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path>
            </svg>
        `;
    }

    return `
        <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
    `;
}

async function switchCompanyContext(publicId) {
    const company = getCompanyByPublicId(publicId);
    if (!company) return;

    if (!window.confirm(`Deseja migrar seu acesso para a empresa "${getCompanyDisplayName(company)}"? Você verá os dados como se fosse um administrador desta unidade.`)) {
        return;
    }

    try {
        const response = await api(`/companies/${publicId}/switch-context`, {
            method: 'POST'
        });

        if (response && response.data && response.data.token) {
            Auth.setToken(response.data.token);
            
            // Salvar o nome da empresa no localStorage para o footer carregar instantaneamente na próxima página
            const companyName = getCompanyDisplayName(company);
            localStorage.setItem('keystone_last_company_name', companyName);
            if (company.cnpj) localStorage.setItem('keystone_last_company_cnpj', company.cnpj);
            if (company.public_id) localStorage.setItem('keystone_last_company_public_id', company.public_id);
            localStorage.setItem('erp_last_company_name', companyName);
            if (company.cnpj) localStorage.setItem('erp_last_company_cnpj', company.cnpj);

            // Redireciona para o dashboard com o novo contexto
            window.location.href = '/pages/dashboard.html';
        } else {
            throw new Error('Resposta do servidor inválida ao trocar contexto.');
        }
    } catch (error) {
        console.error('Falha ao trocar contexto da empresa', error);
        UI.showAlert('alertMessage', error.message || 'Falha ao acessar a empresa selecionada.', 'error');
    }
}

function syncSelectAllCheckbox(items) {
    const selectAllCheckbox = getById('selectAllCheckbox');
    if (!selectAllCheckbox) return;

    const selectedCount = getVisibleSelectedCount(items);
    selectAllCheckbox.checked = items.length > 0 && selectedCount === items.length;
    selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < items.length;
}

function bindTableActionEvents() {
    qsa('#companiesTable .edit-company-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const company = getCompanyByPublicId(button.dataset.id);
            if (company) openCompanyModal(company);
        });
    });

    qsa('#companiesTable .toggle-company-status-btn').forEach((button) => {
        button.addEventListener('click', () => {
            if (button.dataset.id) toggleCompanyStatus(button.dataset.id);
        });
    });

    qsa('#companiesTable .switch-company-btn').forEach((button) => {
        button.addEventListener('click', () => {
            if (button.dataset.id) switchCompanyContext(button.dataset.id);
        });
    });

    qsa('#companiesTable .delete-company-btn').forEach((button) => {
        button.addEventListener('click', () => {
            if (button.dataset.id) deleteCompany(button.dataset.id);
        });
    });

    qsa('#companiesTable .view-company-details-btn').forEach((button) => {
        button.addEventListener('click', () => {
            if (button.dataset.id) openViewDetailsModal(button.dataset.id);
        });
    });
}

function bindGridActionEvents() {
    qsa('#companiesGridSection .edit-company-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const company = getCompanyByPublicId(button.dataset.id);
            if (company) openCompanyModal(company);
        });
    });

    qsa('#companiesGridSection .toggle-company-status-btn').forEach((button) => {
        button.addEventListener('click', () => {
            if (button.dataset.id) toggleCompanyStatus(button.dataset.id);
        });
    });

    qsa('#companiesGridSection .switch-company-btn').forEach((button) => {
        button.addEventListener('click', () => {
            if (button.dataset.id) switchCompanyContext(button.dataset.id);
        });
    });

    qsa('#companiesGridSection .delete-company-btn').forEach((button) => {
        button.addEventListener('click', () => {
            if (button.dataset.id) deleteCompany(button.dataset.id);
        });
    });

    qsa('#companiesGridSection .view-company-details-btn').forEach((button) => {
        button.addEventListener('click', () => {
            if (button.dataset.id) openViewDetailsModal(button.dataset.id);
        });
    });
}

function updateGridCardSelection(card, isSelected) {
    if (!card) return;

    card.classList.toggle('border-brand-300', isSelected);
    card.classList.toggle('dark:border-brand-500', isSelected);
    card.classList.toggle('ring-2', isSelected);
    card.classList.toggle('ring-brand-100', isSelected);
    card.classList.toggle('dark:ring-brand-900/40', isSelected);
}

function bindTableSelectionEvents(items) {
    const selectAllCheckbox = getById('selectAllCheckbox');
    if (selectAllCheckbox) {
        const nextSelectAllCheckbox = selectAllCheckbox.cloneNode(true);
        selectAllCheckbox.parentNode.replaceChild(nextSelectAllCheckbox, selectAllCheckbox);
        syncSelectAllCheckbox(items);

        nextSelectAllCheckbox.addEventListener('change', (event) => {
            items.forEach((item) => {
                const key = getCompanySelectionKey(item);
                if (event.target.checked) {
                    selectedCompanyIds.add(key);
                } else {
                    selectedCompanyIds.delete(key);
                }
            });

            renderTable(items);
            renderGrid(items);
            updateResultsFooter(items);
            updateSummaryFooters(items);
        });
    }

    qsa('#companiesTable .item-checkbox').forEach((checkbox) => {
        checkbox.addEventListener('change', (event) => {
            const key = String(event.currentTarget.value || '');
            if (event.currentTarget.checked) {
                selectedCompanyIds.add(key);
            } else {
                selectedCompanyIds.delete(key);
            }

            renderGrid(items);
            syncSelectAllCheckbox(items);
            updateResultsFooter(items);
            updateSummaryFooters(items);
        });
    });
}

function bindGridSelectionEvents(items) {
    qsa('#companiesGridSection .item-checkbox').forEach((checkbox) => {
        checkbox.addEventListener('change', (event) => {
            const key = String(event.currentTarget.value || '');
            const isSelected = event.currentTarget.checked;
            const card = event.currentTarget.closest('[data-company-card]');

            if (isSelected) {
                selectedCompanyIds.add(key);
            } else {
                selectedCompanyIds.delete(key);
            }

            updateGridCardSelection(card, isSelected);
            syncSelectAllCheckbox(items);
            updateResultsFooter(items);
            updateSummaryFooters(items);
        });
    });
}

function renderTable(items) {
    const tbody = getById('companiesTable');
    if (!tbody) return;

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhuma empresa encontrada.</td></tr>';
        syncSelectAllCheckbox(items);
        return;
    }

    tbody.innerHTML = items.map((item) => {
        const key = getCompanySelectionKey(item);
        const isSelected = selectedCompanyIds.has(key);

        return `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
            <td class="px-3 py-4 whitespace-nowrap text-left w-12">
                <input type="checkbox" value="${key}" class="item-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" ${isSelected ? 'checked' : ''} data-bwignore="true" data-lpignore="true" placeholder="">
            </td>
            <td class="px-6 py-4 text-sm">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-semibold text-gray-900 dark:text-gray-100">${getCompanyDisplayName(item)}</span>
                    <span class="text-[10px] font-mono bg-gray-100 text-gray-600 dark:bg-slate-700/60 dark:text-gray-300 px-1.5 py-0.5 rounded">ID: ${item.public_id}</span>
                    ${item.company_group_name ? `
                        <span class="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-sm select-none">${item.company_group_name}</span>
                    ` : ''}
                    ${item.is_group_master === true || item.is_group_master === 1 ? `
                        <span class="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-sm select-none">Principal do Grupo</span>
                    ` : ''}
                    ${item.is_general_admin === true || item.is_general_admin === 1 ? `
                        <span class="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 text-xs font-semibold text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-sm select-none">Adm Geral</span>
                    ` : ''}
                </div>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">${getCompanyLegalName(item)}</p>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${formatCNPJ(item.cnpj)}</td>
            <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">${getContact(item)}</td>
            <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">${getLocation(item)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">${getStatusBadge(item)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex items-center justify-end gap-2">
                    <button type="button" title="Acessar Empresa" aria-label="Acessar empresa ${getCompanyDisplayName(item)}" class="switch-company-btn text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300" data-id="${item.public_id}">
                        <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013 3v1" />
                        </svg>
                    </button>
                    <button type="button" title="Visualizar Detalhes" aria-label="Visualizar empresa ${getCompanyDisplayName(item)}" class="view-company-details-btn text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300" data-id="${item.public_id}">
                        <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </button>
                    <button type="button" title="Editar" aria-label="Editar empresa ${getCompanyDisplayName(item)}" class="edit-company-btn text-brand-600 hover:text-brand-900 dark:hover:text-brand-400" data-id="${item.public_id}">
                        ${getEditActionIcon()}
                    </button>
                    <button type="button" title="${getStatusToggleActionLabel(item)}" aria-label="${getStatusToggleActionLabel(item)} empresa ${getCompanyDisplayName(item)}" class="toggle-company-status-btn ${getStatusToggleActionClasses(item)}" data-id="${item.public_id}">
                        ${getStatusToggleActionIcon(item)}
                    </button>
                    <button type="button" title="Excluir Permanentemente" aria-label="Excluir empresa ${getCompanyDisplayName(item)}" class="delete-company-btn text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors" data-id="${item.public_id}">
                        <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `;
    }).join('');

    bindTableSelectionEvents(items);
    bindTableActionEvents();
    syncSelectAllCheckbox(items);
}

function renderGrid(items) {
    const grid = getById('companiesGridSection');
    if (!grid) return;

    if (items.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">Nenhuma empresa encontrada.</div>';
        return;
    }

    grid.innerHTML = items.map((item, index) => {
        const key = getCompanySelectionKey(item);
        const isSelected = selectedCompanyIds.has(key);

        return `
        <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col relative border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors group ${isSelected ? 'border-brand-300 dark:border-brand-500 ring-2 ring-brand-100 dark:ring-brand-900/40' : ''}" data-company-card="${key}">
            <div class="flex-1">
                <div class="flex justify-between items-center mb-3">
                    <input type="checkbox" aria-label="Selecionar empresa ${getCompanyDisplayName(item)}" value="${key}" class="item-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" ${isSelected ? 'checked' : ''} data-bwignore="true" data-lpignore="true" placeholder="">
                    <span class="text-xs font-mono text-gray-400 dark:text-gray-500">#${getCompanySequence(item, index)}</span>
                </div>
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h4 class="text-base leading-snug font-bold text-gray-900 dark:text-gray-100 pr-2 wrap-break-word flex flex-wrap items-center gap-1.5">
                                <span>${getCompanyDisplayName(item)}</span>
                                <span class="text-[10px] font-mono font-normal bg-gray-100 text-gray-600 dark:bg-slate-700/60 dark:text-gray-300 px-1.5 py-0.5 rounded">ID: ${item.public_id}</span>
                            </h4>
                            ${item.company_group_name ? `
                                <span class="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-sm select-none">${item.company_group_name}</span>
                            ` : ''}
                            ${item.is_group_master === true || item.is_group_master === 1 ? `
                                <span class="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-sm select-none">Principal do Grupo</span>
                            ` : ''}
                            ${item.is_general_admin === true || item.is_general_admin === 1 ? `
                                <span class="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 text-xs font-semibold text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-sm select-none">Adm Geral</span>
                            ` : ''}
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">${getCompanyLegalName(item)}</p>
                    </div>
                    <div class="shrink-0">${getStatusBadge(item)}</div>
                </div>

                <div class="mt-4 space-y-2">
                    <div class="text-sm text-gray-600 dark:text-gray-300">
                        <span class="block text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">CNPJ</span>
                        <span class="block mt-1">${formatCNPJ(item.cnpj)}</span>
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-300">
                        <span class="block text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">Contato</span>
                        <span class="block mt-1 wrap-break-word">${getContact(item)}</span>
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-300">
                        <span class="block text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">Localização</span>
                        <span class="block mt-1">${getLocation(item)}</span>
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-300">
                        <span class="block text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">Cadastro</span>
                        <span class="block mt-1">${DateUtils.formatDateTime(item.created_at)}</span>
                    </div>
                </div>
                <div class="mt-5 flex items-center justify-between gap-2 border-t border-gray-200 pt-4 dark:border-slate-700">
                    <div class="flex gap-2">
                        <button type="button" title="Acessar Empresa" aria-label="Acessar empresa ${getCompanyDisplayName(item)}" class="switch-company-btn p-1.5 rounded-full text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30" data-id="${item.public_id}">
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                            </svg>
                        </button>
                        <button type="button" title="Visualizar Detalhes" aria-label="Visualizar empresa ${getCompanyDisplayName(item)}" class="view-company-details-btn p-1.5 rounded-full text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30" data-id="${item.public_id}">
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </button>
                        <button type="button" title="Editar" aria-label="Editar empresa ${getCompanyDisplayName(item)}" class="edit-company-btn p-1.5 rounded-full text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900/30" data-id="${item.public_id}">
                            ${getEditActionIcon()}
                        </button>
                    </div>
                    <button type="button" title="${getStatusToggleActionLabel(item)}" aria-label="${getStatusToggleActionLabel(item)} empresa ${getCompanyDisplayName(item)}" class="toggle-company-status-btn p-1.5 rounded-full ${getStatusToggleActionClasses(item)}" data-id="${item.public_id}">
                        ${getStatusToggleActionIcon(item)}
                    </button>
                    <button type="button" title="Excluir Permanentemente" aria-label="Excluir empresa ${getCompanyDisplayName(item)}" class="delete-company-btn p-1.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" data-id="${item.public_id}">
                        <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;
    }).join('');

    bindGridSelectionEvents(items);
    bindGridActionEvents();
}

function setupDetailsModalTabs() {
    const tabButtons = document.querySelectorAll('#viewCompanyDetailsModal .details-modal-tab');
    tabButtons.forEach((btn: any) => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-details-tab-target');
            if (!targetId) return;
            tabButtons.forEach((b: any) => {
                const isActive = b === btn;
                b.setAttribute('aria-selected', String(isActive));
                b.classList.toggle('border-brand-500', isActive);
                b.classList.toggle('text-brand-600', isActive);
                b.classList.toggle('dark:text-brand-300', isActive);
                b.classList.toggle('border-transparent', !isActive);
                b.classList.toggle('text-gray-500', !isActive);
                b.classList.toggle('dark:text-gray-400', !isActive);
            });
            document.querySelectorAll('#viewCompanyDetailsModal .details-modal-tab-panel').forEach((panel: any) => {
                if (panel.id === targetId) {
                    panel.classList.remove('hidden');
                } else {
                    panel.classList.add('hidden');
                }
            });
        });
    });
}

function resetDetailsModalTabs() {
    const tabButtons = Array.from(document.querySelectorAll('#viewCompanyDetailsModal .details-modal-tab'));
    tabButtons.forEach((btn: any, idx) => {
        const isSelected = idx === 0;
        btn.setAttribute('aria-selected', String(isSelected));
        btn.classList.toggle('border-brand-500', isSelected);
        btn.classList.toggle('text-brand-600', isSelected);
        btn.classList.toggle('dark:text-brand-300', isSelected);
        btn.classList.toggle('border-transparent', !isSelected);
        btn.classList.toggle('text-gray-500', !isSelected);
        btn.classList.toggle('dark:text-gray-400', !isSelected);
    });

    document.querySelectorAll('#viewCompanyDetailsModal .details-modal-tab-panel').forEach((panel: any, idx) => {
        if (idx === 0) {
            panel.classList.remove('hidden');
        } else {
            panel.classList.add('hidden');
        }
    });
}

async function openViewDetailsModal(companyId: string) {
    const modal = getById('viewCompanyDetailsModal');
    const closeBtn = getById('btnCloseViewDetailsModal');
    const cancelBtn = getById('btnCancelViewDetailsModal');
    const backdrop = getById('viewDetailsModalBackdrop');
    
    if (!modal) return;

    const closeModal = () => {
        modal.classList.add('hidden');
    };
    closeBtn?.addEventListener('click', closeModal, { once: true });
    cancelBtn?.addEventListener('click', closeModal, { once: true });
    backdrop?.addEventListener('click', closeModal, { once: true });

    modal.classList.remove('hidden');

    const company = getCompanyByPublicId(companyId);
    if (!company) return;

    // Set text values
    getById('viewDetailsCompanyTradeName').textContent = company.trade_name || '';
    getById('viewDetailsCompanyName').textContent = company.company_name || 'Não informado';
    getById('viewDetailsCnpj').textContent = formatCNPJ(company.cnpj);
    getById('viewDetailsTaxRegime').textContent = company.tax_regime || 'Não informado';
    const groupText = company.company_group_name 
        ? `${company.company_group_name}${company.is_group_master === true || company.is_group_master === 1 ? ' (Principal)' : ''}` 
        : 'Nenhum grupo';
    if (getById('viewDetailsCompanyGroup')) {
        getById('viewDetailsCompanyGroup').textContent = groupText;
    }
    getById('viewDetailsActiveStatus').textContent = company.is_active ? 'Ativa' : 'Inativa';
    getById('viewDetailsEmail').textContent = company.email || 'Não informado';
    getById('viewDetailsPhone').textContent = formatPhone(company.phone);
    getById('viewDetailsLocation').textContent = [
        company.street,
        company.number,
        company.neighborhood,
        company.city,
        company.state,
        company.zipcode
    ].filter(Boolean).join(', ') || 'Endereço não informado';

    // Map setup
    const mapCompanyAddressSpan = getById('mapCompanyAddress');
    const googleMapsIframe = getById('googleMapsIframe') as HTMLIFrameElement | null;
    const btnOpenWaze = getById('btnOpenWaze') as HTMLAnchorElement | null;
    const btnOpenGoogleMaps = getById('btnOpenGoogleMaps') as HTMLAnchorElement | null;

    const companyAddressParts = [
        company.street,
        company.number,
        company.neighborhood,
        company.city,
        company.state,
        company.zipcode
    ].filter(Boolean);
    const companyAddressStr = companyAddressParts.join(', ');

    if (mapCompanyAddressSpan) {
        mapCompanyAddressSpan.textContent = companyAddressStr || 'Endereço não cadastrado';
    }

    if (companyAddressStr) {
        const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(companyAddressStr)}&output=embed`;
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(companyAddressStr)}`;
        const wazeUrl = company.waze_url || `https://waze.com/ul?q=${encodeURIComponent(companyAddressStr)}&navigate=yes`;

        if (googleMapsIframe) googleMapsIframe.src = embedUrl;
        if (btnOpenWaze) {
            btnOpenWaze.href = wazeUrl;
            btnOpenWaze.classList.remove('hidden');
            btnOpenWaze.classList.add('inline-flex');
        }
        if (btnOpenGoogleMaps) {
            btnOpenGoogleMaps.href = mapsUrl;
            btnOpenGoogleMaps.classList.remove('hidden');
            btnOpenGoogleMaps.classList.add('inline-flex');
        }
    } else {
        if (googleMapsIframe) googleMapsIframe.removeAttribute('src');
        if (btnOpenWaze) {
            btnOpenWaze.classList.add('hidden');
            btnOpenWaze.classList.remove('inline-flex');
        }
        if (btnOpenGoogleMaps) {
            btnOpenGoogleMaps.classList.add('hidden');
            btnOpenGoogleMaps.classList.remove('inline-flex');
        }
    }

    resetDetailsModalTabs();

    // Documents logic
    const docContainer = getById('viewDetailsDocumentContainer');
    let docsList: { name: string; url: string; attachedAt?: string }[] = [];
    
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

    docsList = parseCnpjDocuments(company.cnpj_document_url);

    const getBase64 = (file: File) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    };

    const renderDetailsDocsList = () => {
        if (!docContainer) return;
        docsList.sort((a: any, b: any) => new Date(b.attachedAt || 0).getTime() - new Date(a.attachedAt || 0).getTime());
        if (docsList.length === 0) {
            docContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 gap-2 text-gray-400 dark:text-gray-500 w-full font-sans">
                    <svg class="w-12 h-12 text-gray-300 dark:text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <p class="text-sm font-medium">Nenhum documento anexado.</p>
                </div>
            `;
            return;
        }
        docContainer.innerHTML = docsList.map((doc, idx) => {
            const fileName = doc.url.substring(doc.url.lastIndexOf('/') + 1);
            const d = doc.attachedAt ? new Date(doc.attachedAt) : null;
            const dateStr = d ? `Anexado em ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '';
            return `
                <div class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:border-brand-300 dark:hover:border-brand-700 transition-all font-sans mb-3">
                    <a href="${doc.url}" target="_blank" class="flex items-center gap-3 flex-1 min-w-0 mr-4 group text-left cursor-pointer decoration-none">
                        <div class="p-2 rounded bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/60 transition-colors">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">${doc.name}</p>
                            <p class="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">${fileName}</p>
                            ${dateStr ? `
                                <p class="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-1 flex items-center gap-1">
                                    <svg class="w-3.5 h-3.5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                    ${dateStr}
                                </p>
                            ` : ''}
                        </div>
                    </a>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <button type="button" class="btn-rename-doc p-1.5 rounded text-gray-500 hover:text-brand-600 hover:bg-brand-50 dark:text-gray-400 dark:hover:text-brand-400 dark:hover:bg-brand-950/30 transition-colors" data-index="${idx}" title="Renomear documento">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                            </svg>
                        </button>
                        <button type="button" class="btn-delete-doc p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-950/30 transition-colors" data-index="${idx}" title="Excluir documento">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    };

    renderDetailsDocsList();

    // Bind upload input
    const detailCnpjFileInput = modal.querySelector('#detailCnpjFile') as HTMLInputElement | null;
    if (detailCnpjFileInput) {
        const newFileInput = detailCnpjFileInput.cloneNode(true) as HTMLInputElement;
        detailCnpjFileInput.parentNode?.replaceChild(newFileInput, detailCnpjFileInput);
        newFileInput.addEventListener('change', async (e: any) => {
            const files = Array.from(newFileInput.files || []);
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
                    newFileInput.disabled = true;
                    if (docContainer) docContainer.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 animate-pulse font-sans">Enviando documentos...</p>';
                    const response = await api(`/companies/${companyId}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                            cnpj_document_uploads: uploads
                        })
                    });
                    
                    const idx = companiesData.findIndex((c) => String(c.public_id) === String(companyId));
                    if (idx >= 0) companiesData[idx] = response.data;
                    filteredCompanies = [...companiesData];

                    (window as any).UI.showAlert('alertMessage', 'Documentos anexados com sucesso!', 'success');
                    docsList = parseCnpjDocuments(response.data?.cnpj_document_url);
                    renderDetailsDocsList();
                } catch (err: any) {
                    console.error(err);
                    (window as any).UI.showAlert('alertMessage', err.message || 'Erro ao enviar documentos.', 'error');
                    renderDetailsDocsList();
                } finally {
                    newFileInput.disabled = false;
                    newFileInput.value = '';
                }
            }
        });
    }

    // Bind clicks for rename and delete within document container
    if (docContainer) {
        const newDocContainer = docContainer.cloneNode(true);
        docContainer.parentNode?.replaceChild(newDocContainer, docContainer);
        
        newDocContainer.addEventListener('click', async (e: Event) => {
            const target = e.target as HTMLElement | null;
            const renameBtn = target?.closest('.btn-rename-doc');
            const deleteBtn = target?.closest('.btn-delete-doc');
            
            if (renameBtn) {
                const idx = parseInt(renameBtn.getAttribute('data-index') || '0', 10);
                const doc = docsList[idx];
                if (doc) {
                    const newName = prompt('Digite o novo nome para o documento:', doc.name);
                    if (newName && newName.trim()) {
                        docsList[idx].name = newName.trim();
                        try {
                            const response = await api(`/companies/${companyId}`, {
                                method: 'PUT',
                                body: JSON.stringify({
                                    cnpj_document_url: JSON.stringify(docsList)
                                })
                            });
                            const cIdx = companiesData.findIndex((c) => String(c.public_id) === String(companyId));
                            if (cIdx >= 0) companiesData[cIdx] = response.data;
                            filteredCompanies = [...companiesData];

                            (window as any).UI.showAlert('alertMessage', 'Documento renomeado com sucesso!', 'success');
                            renderDetailsDocsList();
                        } catch (err: any) {
                            console.error(err);
                            (window as any).UI.showAlert('alertMessage', 'Erro ao renomear documento.', 'error');
                        }
                    }
                }
            }
            
            if (deleteBtn) {
                const idx = parseInt(deleteBtn.getAttribute('data-index') || '0', 10);
                if (confirm('Deseja realmente excluir este documento?')) {
                    docsList.splice(idx, 1);
                    try {
                        const response = await api(`/companies/${companyId}`, {
                                method: 'PUT',
                                body: JSON.stringify({
                                    cnpj_document_url: JSON.stringify(docsList)
                                })
                            });
                            const cIdx = companiesData.findIndex((c) => String(c.public_id) === String(companyId));
                            if (cIdx >= 0) companiesData[cIdx] = response.data;
                            filteredCompanies = [...companiesData];

                            (window as any).UI.showAlert('alertMessage', 'Documento excluído com sucesso!', 'success');
                            renderDetailsDocsList();
                    } catch (err: any) {
                        console.error(err);
                        (window as any).UI.showAlert('alertMessage', 'Erro ao excluir documento.', 'error');
                    }
                }
            }
        });
    }
}

})();
