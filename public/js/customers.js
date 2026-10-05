(function initCustomersPage() {
    const forge = window.forge;
    let customersManager;
    let customerDocMask = null;
    let customerPhoneMask = null;
    let customerPhoneLandlineMask = null;
    let customerZipMask = null;
    let customCompanyUser = null;
    let customerIbgeStates = [];
    let allSellers = [];
    let allUsers = [];
    let allCustomerGroups = [];
    let allActivityGroups = [];
    let renameDocIdx = null;
    let renameDocsList = [];
    let renameEntityId = null;
    let activeRenderDetailsDocsList = null;
    let deleteDocIdx = null;
    let deleteDocsList = [];
    let deleteEntityId = null;
    const getById = (id) => document.getElementById(id);
    const qs = (selector) => document.querySelector(selector);
    const qsa = (selector) => document.querySelectorAll(selector);
    const makeMask = window.createMaskAdapter ||
        ((input, options) => window.IMask(input, options));
    function onlyDigits(value) {
        return String(value || '').replace(/\D/g, '');
    }
    function checkCompanyCnpj(cnpj) {
        const registerAsCompanyCheckbox = getById('customerRegisterAsCompany');
        if (!registerAsCompanyCheckbox || !window.isGeneralAdminCompany)
            return;
        const cleanCustomerCnpj = String(cnpj || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (!cleanCustomerCnpj) {
            registerAsCompanyCheckbox.disabled = false;
            return;
        }
        (window.api)('/companies').then((res) => {
            const companiesList = res?.data || [];
            const companyExists = companiesList.some((comp) => {
                const cleanCompCnpj = String(comp.cnpj || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                return cleanCompCnpj === cleanCustomerCnpj;
            });
            if (companyExists) {
                registerAsCompanyCheckbox.checked = true;
                registerAsCompanyCheckbox.disabled = true;
            }
            else {
                registerAsCompanyCheckbox.disabled = false;
            }
        }).catch((err) => {
            console.error('[checkCompanyCnpj] Error checking company CNPJ:', err);
        });
    }
    const getTaxRegimeBadge = (regime) => {
        if (!regime)
            return '-';
        let colors = 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-gray-200';
        if (regime === 'Pessoa Física') {
            colors = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300';
        }
        else if (regime === 'Simples Nacional') {
            colors = 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300';
        }
        else if (regime === 'MEI') {
            colors = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300';
        }
        else if (regime === 'Lucro Presumido') {
            colors = 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300';
        }
        else if (regime === 'Lucro Real') {
            colors = 'bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300';
        }
        return `<span class="px-2.5 py-0.5 inline-flex text-[10px] leading-5 font-semibold rounded-full ${colors}">${regime}</span>`;
    };
    const getIsCompanyBadge = (item) => {
        const isCompany = item.is_registered_as_company === 1 ||
            item.is_registered_as_company === true ||
            Boolean(item.registered_company_id) ||
            Boolean(item.registered_company_name);
        if (!isCompany)
            return '';
        const title = item.registered_company_name
            ? `Cliente também cadastrado como Empresa no ERP: ${item.registered_company_name}`
            : 'Cliente também cadastrado como Empresa no ERP';
        return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 gap-1 shadow-xs" title="${title}">
        <svg class="w-3 h-3 text-indigo-600 dark:text-indigo-400 inline shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
        </svg>
        Empresa
    </span>`;
    };
    const getDocCount = (docUrlField) => {
        if (!docUrlField)
            return 0;
        try {
            if (docUrlField.trim().startsWith('[')) {
                const parsed = JSON.parse(docUrlField);
                return Array.isArray(parsed) ? parsed.filter(d => d && (typeof d === 'string' || d.url)).length : 0;
            }
            return 1;
        }
        catch (e) {
            return 1;
        }
    };
    const getDocCountBadge = (docUrlField) => {
        const count = getDocCount(docUrlField);
        if (count === 0) {
            return `<span class="inline-flex items-center text-xs text-gray-400 dark:text-gray-600 gap-1 select-none">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            0
        </span>`;
        }
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 select-none">
        <svg class="w-3.5 h-3.5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        ${count}
    </span>`;
    };
    const getNotesCountBadge = (count) => {
        const n = Number(count || 0);
        if (n === 0) {
            return `<span class="inline-flex items-center text-xs text-gray-400 dark:text-gray-600 gap-1 select-none" title="Nenhuma anotação">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg>
            0
        </span>`;
        }
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 select-none" title="${n} anotação(ões)">
        <svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg>
        ${n}
    </span>`;
    };
    const getTasksCountBadge = (count) => {
        const n = Number(count || 0);
        if (n === 0) {
            return `<span class="inline-flex items-center text-xs text-gray-400 dark:text-gray-600 gap-1 select-none" title="Nenhuma tarefa">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
            0
        </span>`;
        }
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 select-none" title="${n} tarefa(s)">
        <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
        ${n}
    </span>`;
    };
    function setMaskedValue(maskInstance, inputId, value) {
        if (maskInstance) {
            maskInstance.unmaskedValue = onlyDigits(value);
            return;
        }
        const input = getById(inputId);
        if (input)
            input.value = value || '';
    }
    function getMaskedValue(maskInstance, inputId) {
        if (maskInstance)
            return maskInstance.unmaskedValue || '';
        const val = getById(inputId)?.value || '';
        if (inputId === 'customerDocument') {
            return String(val).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        }
        return onlyDigits(val);
    }
    function getTrimmedValue(inputId) {
        return String(getById(inputId)?.value || '').trim();
    }
    function formatDoc(doc) {
        if (!doc)
            return '-';
        const clean = String(doc).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (clean.length === 11)
            return clean.replace(/([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{2})/, '$1.$2.$3-$4');
        if (clean.length === 14)
            return clean.replace(/([a-zA-Z0-9]{2})([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{4})([a-zA-Z0-9]{2})/, '$1.$2.$3/$4-$5');
        return doc;
    }
    function formatPhone(phone) {
        if (!phone)
            return '-';
        const clean = String(phone).replace(/\D/g, '');
        if (clean.length === 10)
            return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        if (clean.length === 11)
            return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        if (clean.length === 12)
            return clean.replace(/(\d{2})(\d{2})(\d{4})(\d{4})/, '+$1 ($2) $3-$4');
        if (clean.length === 13)
            return clean.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
        return phone;
    }
    function formatCustomerLocation(item) {
        const city = String(item.city || '').trim();
        const state = String(item.state || '').trim();
        if (!city && !state)
            return 'Não informado';
        return [city, state].filter(Boolean).join(' / ');
    }
    const getBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(String(reader.result || '').split(',')[1]);
        reader.onerror = error => reject(error);
    });
    function populateCustomerStateOptions(selectedValue = '') {
        const stateSelect = getById('customerState');
        if (!stateSelect || !customerIbgeStates.length)
            return;
        const normalizedSelectedValue = String(selectedValue || '').trim().toUpperCase();
        stateSelect.innerHTML = [
            '<option value="">Selecione...</option>',
            ...customerIbgeStates.map((state) => `<option value="${state.uf}">${state.uf} - ${state.name}</option>`),
        ].join('');
        stateSelect.value = customerIbgeStates.some((state) => state.uf === normalizedSelectedValue) ? normalizedSelectedValue : '';
    }
    function populateSellersDropdown(selectedValue = '') {
        const select = getById('customerSellerParam');
        if (!select)
            return;
        select.innerHTML = [
            '<option value="">Nenhum</option>',
            ...allSellers.map(s => `<option value="${s.public_id}">${s.full_name}</option>`)
        ].join('');
        select.value = selectedValue || '';
    }
    function populateCustomerGroupsDropdown(selectedValue = '') {
        const select = getById('customerGroupParam');
        if (!select)
            return;
        select.innerHTML = [
            '<option value="">Nenhum</option>',
            ...allCustomerGroups.map(g => `<option value="${g.public_id}">${g.name}</option>`)
        ].join('');
        select.value = selectedValue || '';
    }
    function populateActivityGroupsDropdown(selectedValues = []) {
        const container = getById('customerActivitiesContainer');
        if (!container)
            return;
        if (allActivityGroups.length === 0) {
            container.innerHTML = '<span class="text-xs text-gray-500 dark:text-gray-400">Nenhum grupo de atividade cadastrado.</span>';
            return;
        }
        container.innerHTML = allActivityGroups.map(ag => {
            const isChecked = selectedValues.includes(ag.public_id) ? 'checked' : '';
            return `
            <label class="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" name="customerActivityGroups" value="${ag.public_id}" ${isChecked} class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 bg-white dark:bg-slate-700 dark:border-slate-600">
                <span>${ag.name}</span>
            </label>
        `;
        }).join('');
    }
    function populateCustomerGroupsFilter() {
        const select = getById('filterCustomerGroup');
        if (!select)
            return;
        const currentVal = select.value;
        select.innerHTML = [
            '<option value="">Todos</option>',
            '<option value="none">Sem grupo</option>',
            ...allCustomerGroups.map(g => `<option value="${g.public_id}">${g.name}</option>`)
        ].join('');
        select.value = currentVal;
    }
    function populateActivityGroupsFilter() {
        const select = getById('filterActivityGroup');
        if (!select)
            return;
        const currentVal = select.value;
        select.innerHTML = [
            '<option value="">Todos</option>',
            '<option value="none">Sem grupo de atividade</option>',
            ...allActivityGroups.map(ag => `<option value="${ag.public_id}">${ag.name}</option>`)
        ].join('');
        select.value = currentVal;
    }
    async function loadDependencies(selectedState = '', selectedSeller = '', selectedGroup = '', selectedActivities = []) {
        try {
            const [statesRes, usersRes, groupsRes, activitiesRes] = await Promise.all([
                customerIbgeStates.length ? { data: customerIbgeStates } : (window.api)('/companies/states').catch(() => ({ data: [] })),
                (window.api)('/users').catch(() => ({ data: [] })),
                (window.api)('/customer-groups').catch(() => ({ data: [] })),
                (window.api)('/activity-groups').catch(() => ({ data: [] }))
            ]);
            if (!customerIbgeStates.length)
                customerIbgeStates = statesRes.data || [];
            populateCustomerStateOptions(selectedState);
            allUsers = usersRes.data || [];
            allSellers = allUsers.filter((u) => u.role === 'seller');
            populateSellersDropdown(selectedSeller);
            allCustomerGroups = groupsRes.data || [];
            populateCustomerGroupsDropdown(selectedGroup);
            populateCustomerGroupsFilter();
            allActivityGroups = activitiesRes.data || [];
            populateActivityGroupsDropdown(selectedActivities);
            populateActivityGroupsFilter();
        }
        catch (error) {
            console.error('Falha ao carregar dependências do form', error);
        }
    }
    async function lookupAddressByCep(cep) {
        const normalizedCep = onlyDigits(cep);
        if (normalizedCep.length !== 8)
            return null;
        let data = null;
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
                }
                else {
                    cepNotFound = true;
                }
            }
        }
        catch (_error) { }
        return data;
    }
    function applyCustomerCepLookupResult(data) {
        if (!data)
            return;
        getById('customerStreet').value = data.street || '';
        getById('customerNeighborhood').value = data.neighborhood || '';
        getById('customerCity').value = data.city || '';
        getById('customerComplement').value = data.complement || '';
        populateCustomerStateOptions(data.state || '');
    }
    async function handleCustomerCepLookup() {
        const loader = getById('customerCepLoading');
        const cep = getMaskedValue(customerZipMask, 'customerZipcode');
        if (cep.length !== 8)
            return;
        if (loader)
            loader.classList.remove('hidden');
        try {
            const data = await lookupAddressByCep(cep);
            if (data && (data.street || data.city)) {
                applyCustomerCepLookupResult(data);
            }
            else {
                window.UI.showAlert('alertMessage', 'CEP do cliente não encontrado ou inválido.', 'error');
            }
        }
        catch (error) {
            console.error('Falha ao consultar CEP', error);
        }
        finally {
            if (loader)
                loader.classList.add('hidden');
        }
    }
    async function handleCustomerDocumentLookup() {
        const documentValue = getMaskedValue(customerDocMask, 'customerDocument');
        if (documentValue.length !== 14)
            return;
        // Auto complete via BrasilAPI for CNPJ
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${documentValue}`);
            const data = await response.json();
            if (!response.ok || !data?.razao_social)
                return;
            if (!getTrimmedValue('customerName'))
                getById('customerName').value = data.razao_social || '';
            if (!getTrimmedValue('customerTradeName'))
                getById('customerTradeName').value = data.nome_fantasia || '';
            if (!getTrimmedValue('customerEmail'))
                getById('customerEmail').value = data.email || '';
            if (!getMaskedValue(customerPhoneMask, 'customerPhone'))
                setMaskedValue(customerPhoneMask, 'customerPhone', data.ddd_telefone_1 || '');
            if (!getMaskedValue(customerPhoneLandlineMask, 'customerPhoneLandline'))
                setMaskedValue(customerPhoneLandlineMask, 'customerPhoneLandline', data.ddd_telefone_2 || '');
            if (!getMaskedValue(customerZipMask, 'customerZipcode'))
                setMaskedValue(customerZipMask, 'customerZipcode', data.cep || '');
            if (!getTrimmedValue('customerStreet'))
                getById('customerStreet').value = data.logradouro || '';
            if (!getTrimmedValue('customerNumber'))
                getById('customerNumber').value = data.numero || '';
            if (!getTrimmedValue('customerComplement'))
                getById('customerComplement').value = data.complemento || '';
            if (!getTrimmedValue('customerNeighborhood'))
                getById('customerNeighborhood').value = data.bairro || '';
            if (!getTrimmedValue('customerCity'))
                getById('customerCity').value = data.municipio || '';
            populateCustomerStateOptions(data.uf || '');
        }
        catch (error) {
            console.error('Falha ao consultar CNPJ', error);
        }
    }
    function extractCertDate() {
        const fileInput = getById('customerCertFile');
        if (!fileInput || !fileInput.files || fileInput.files.length === 0)
            return;
        const password = getById('customerCertPassword').value;
        if (!password)
            return;
        const file = fileInput.files[0];
        const ext = file.name.toLowerCase();
        if (!ext.endsWith('.pfx') && !ext.endsWith('.p12'))
            return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const bytes = new Uint8Array(e.target.result);
                let binary = '';
                for (let i = 0; i < bytes.length; i++)
                    binary += String.fromCharCode(bytes[i]);
                if (typeof forge === 'undefined')
                    return;
                const p12Asn1 = forge.asn1.fromDer(binary);
                const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);
                for (const safeBag of p12.safeContents) {
                    if (safeBag.safeBags) {
                        for (const bag of safeBag.safeBags) {
                            if (bag.type === forge.pki.oids.certBag && bag.cert) {
                                const dateStr = bag.cert.validity.notAfter.toISOString().split('T')[0];
                                getById('customerCertExpiration').value = dateStr;
                                return;
                            }
                        }
                    }
                }
            }
            catch (err) {
                console.warn('Falha no parse do PFX:', err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }
    function setupCustomerModalTabs() {
        const tabButtons = document.querySelectorAll('.customer-modal-tab');
        tabButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-customer-tab-target');
                if (!targetId)
                    return;
                tabButtons.forEach((b) => {
                    const isActive = b === btn;
                    b.setAttribute('aria-selected', String(isActive));
                    b.classList.toggle('border-brand-500', isActive);
                    b.classList.toggle('text-brand-600', isActive);
                    b.classList.toggle('dark:text-brand-300', isActive);
                    b.classList.toggle('border-transparent', !isActive);
                    b.classList.toggle('text-gray-500', !isActive);
                    b.classList.toggle('dark:text-gray-400', !isActive);
                });
                document.querySelectorAll('.customer-modal-tab-panel').forEach((panel) => {
                    if (panel.id === targetId) {
                        panel.classList.remove('hidden');
                    }
                    else {
                        panel.classList.add('hidden');
                    }
                });
            });
        });
    }
    function resetCustomerModalTabs() {
        const tabButtons = document.querySelectorAll('.customer-modal-tab');
        tabButtons.forEach((btn, index) => {
            const isFirst = index === 0;
            btn.setAttribute('aria-selected', String(isFirst));
            btn.classList.toggle('border-brand-500', isFirst);
            btn.classList.toggle('text-brand-600', isFirst);
            btn.classList.toggle('dark:text-brand-300', isFirst);
            btn.classList.toggle('border-transparent', !isFirst);
            btn.classList.toggle('text-gray-500', !isFirst);
            btn.classList.toggle('dark:text-gray-400', !isFirst);
        });
        document.querySelectorAll('.customer-modal-tab-panel').forEach((panel, index) => {
            if (index === 0) {
                panel.classList.remove('hidden');
            }
            else {
                panel.classList.add('hidden');
            }
        });
    }
    function setupDetailsModalTabs() {
        const tabButtons = document.querySelectorAll('.details-modal-tab');
        tabButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-details-tab-target');
                if (!targetId)
                    return;
                tabButtons.forEach((b) => {
                    const isActive = b === btn;
                    b.setAttribute('aria-selected', String(isActive));
                    b.classList.toggle('border-brand-500', isActive);
                    b.classList.toggle('text-brand-600', isActive);
                    b.classList.toggle('dark:text-brand-300', isActive);
                    b.classList.toggle('border-transparent', !isActive);
                    b.classList.toggle('text-gray-500', !isActive);
                    b.classList.toggle('dark:text-gray-400', !isActive);
                });
                document.querySelectorAll('.details-modal-tab-panel').forEach((panel) => {
                    if (panel.id === targetId) {
                        panel.classList.remove('hidden');
                    }
                    else {
                        panel.classList.add('hidden');
                    }
                });
            });
        });
    }
    function resetDetailsModalTabs() {
        const tabButtons = Array.from(document.querySelectorAll('.details-modal-tab'));
        const visibleButtons = tabButtons.filter((btn) => !btn.classList.contains('hidden'));
        tabButtons.forEach((btn) => {
            const isSelected = visibleButtons.length > 0 && btn === visibleButtons[0];
            btn.setAttribute('aria-selected', String(isSelected));
            btn.classList.toggle('border-brand-500', isSelected);
            btn.classList.toggle('text-brand-600', isSelected);
            btn.classList.toggle('dark:text-brand-300', isSelected);
            btn.classList.toggle('border-transparent', !isSelected);
            btn.classList.toggle('text-gray-500', !isSelected);
            btn.classList.toggle('dark:text-gray-400', !isSelected);
        });
        document.querySelectorAll('.details-modal-tab-panel').forEach((panel) => {
            const panelId = panel.getAttribute('id');
            const correspondingBtn = tabButtons.find((btn) => btn.getAttribute('aria-controls') === panelId);
            const shouldBeVisible = correspondingBtn && visibleButtons.length > 0 && correspondingBtn === visibleButtons[0];
            if (shouldBeVisible) {
                panel.classList.remove('hidden');
            }
            else {
                panel.classList.add('hidden');
            }
        });
    }
    async function openViewDetailsModal(customerId, customerName) {
        const modal = getById('viewCustomerDetailsModal');
        const nameSpan = getById('viewDetailsCustomerName');
        if (!modal)
            return;
        if (nameSpan)
            nameSpan.textContent = customerName;
        const hasViewPermission = (moduleName) => {
            const authCtx = window.gNavbarAuthContext;
            if (!authCtx)
                return true; // fallback
            const role = authCtx.user?.role || '';
            if (role === 'super_admin' || role === 'admin' || role === 'supervisor')
                return true;
            const permissions = authCtx.permissions || [];
            if (permissions.length === 0)
                return true; // fallback
            return permissions.some((p) => p.module === moduleName && p.can_view);
        };
        const tabConfig = [
            { id: 'tabButtonPedido', module: 'sales' },
            { id: 'tabButtonServico', module: 'service_launches' },
            { id: 'tabButtonFinanceiro', module: 'revenues' },
            { id: 'tabButtonDocumento', module: 'customers' },
            { id: 'tabButtonNotas', module: 'customers' },
            { id: 'tabButtonTarefas', module: 'tasks' },
            { id: 'tabButtonMapa', module: 'customers' }
        ];
        tabConfig.forEach(conf => {
            const btn = getById(conf.id);
            if (btn) {
                if (!hasViewPermission(conf.module)) {
                    btn.classList.add('hidden');
                }
                else {
                    btn.classList.remove('hidden');
                }
            }
        });
        resetDetailsModalTabs();
        const ordersTable = getById('viewDetailsOrdersTable');
        const servicesTable = getById('viewDetailsServicesTable');
        const financialsTable = getById('viewDetailsFinancialsTable');
        if (ordersTable)
            ordersTable.innerHTML = '<tr><td colspan="4" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td></tr>';
        if (servicesTable)
            servicesTable.innerHTML = '<tr><td colspan="4" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td></tr>';
        if (financialsTable)
            financialsTable.innerHTML = '<tr><td colspan="5" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td></tr>';
        modal.classList.remove('hidden');
        const docContainer = getById('viewDetailsDocumentContainer');
        if (docContainer) {
            docContainer.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Carregando documento...</p>';
        }
        const customer = customersManager?.data?.find((c) => c.public_id === customerId);
        const vencimentoDiaSpan = getById('viewDetailsVencimentoDia');
        const limiteSpan = getById('viewDetailsLimite');
        const descontoSpan = getById('viewDetailsDesconto');
        if (vencimentoDiaSpan) {
            vencimentoDiaSpan.textContent = customer?.vencimento_dia ? `Dia ${customer.vencimento_dia}` : 'Não definido';
        }
        if (limiteSpan) {
            const limitVal = Number(customer?.limite || 0);
            limiteSpan.textContent = limitVal > 0 ? limitVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Sem limite';
        }
        if (descontoSpan) {
            const descVal = Number(customer?.discount_value || 0);
            const descType = customer?.discount_type || 'percentage';
            if (descVal > 0) {
                descontoSpan.textContent = descType === 'percentage' ? `${descVal}%` : descVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            }
            else {
                descontoSpan.textContent = 'Sem desconto';
            }
        }
        const vendedorSpan = getById('viewDetailsVendedor');
        if (vendedorSpan) {
            vendedorSpan.textContent = customer?.seller_name || 'Sem Vendedor';
        }
        const grupoSpan = getById('viewDetailsGrupoCliente');
        if (grupoSpan) {
            grupoSpan.textContent = customer?.customer_group_name || 'Nenhum';
        }
        const activityGroupsSpan = getById('viewDetailsGrupoAtividade');
        if (activityGroupsSpan) {
            const activities = customer?.activity_groups || [];
            if (activities.length > 0) {
                activityGroupsSpan.innerHTML = activities.map((ag) => `
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300">
                    ${ag.name}
                </span>
            `).join('');
            }
            else {
                activityGroupsSpan.innerHTML = '<span class="text-sm font-medium text-gray-900 dark:text-gray-100">Sem atividades</span>';
            }
        }
        const onlyPixSpan = getById('viewDetailsOnlyPix');
        if (onlyPixSpan) {
            if (customer?.only_pix === 1 || customer?.only_pix === true) {
                onlyPixSpan.innerHTML = '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 gap-1"><svg class="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>Travado (Somente PIX)</span>';
            }
            else {
                onlyPixSpan.innerHTML = '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Liberado</span>';
            }
        }
        const onlySolidconBaixaSpan = getById('viewDetailsOnlySolidconBaixa');
        if (onlySolidconBaixaSpan) {
            if (customer?.only_solidcon_baixa === 1 || customer?.only_solidcon_baixa === true) {
                onlySolidconBaixaSpan.innerHTML = '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 gap-1"><svg class="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>Travado (Exclusiva Solidcon)</span>';
            }
            else {
                onlySolidconBaixaSpan.innerHTML = '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Liberado no Keystone</span>';
            }
        }
        const exemptInterestFineSpan = getById('viewDetailsExemptInterestFine');
        if (exemptInterestFineSpan) {
            if (customer?.exempt_interest_fine === 1 || customer?.exempt_interest_fine === true) {
                exemptInterestFineSpan.innerHTML = '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 gap-1"><svg class="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Isento (Não Cobrar)</span>';
            }
            else {
                exemptInterestFineSpan.innerHTML = '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-slate-700/60 dark:text-gray-300">Cobrança Normal</span>';
            }
        }
        const hideInRevenuesSpan = getById('viewDetailsHideInRevenues');
        if (hideInRevenuesSpan) {
            if (customer?.hide_in_revenues_grid === 1 || customer?.hide_in_revenues_grid === true) {
                hideInRevenuesSpan.innerHTML = '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 gap-1"><svg class="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>Não Exibir no Grid</span>';
            }
            else {
                hideInRevenuesSpan.innerHTML = '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-slate-700/60 dark:text-gray-300">Exibição Normal</span>';
            }
        }
        // Map configuration
        const mapCustomerAddressSpan = getById('mapCustomerAddress');
        const googleMapsIframe = getById('googleMapsIframe');
        const btnOpenWaze = getById('btnOpenWaze');
        const btnOpenGoogleMaps = getById('btnOpenGoogleMaps');
        if (customer) {
            const customerAddressParts = [
                customer.street,
                customer.number,
                customer.neighborhood,
                customer.city,
                customer.state,
                customer.zipcode
            ].filter(Boolean);
            const customerAddressStr = customerAddressParts.join(', ');
            if (mapCustomerAddressSpan) {
                mapCustomerAddressSpan.textContent = customerAddressStr || 'Endereço não cadastrado';
            }
            const authCtx = window.gNavbarAuthContext;
            const company = authCtx?.company;
            const companyAddressParts = company ? [
                company.street,
                company.number,
                company.neighborhood,
                company.city,
                company.state,
                company.zipcode
            ].filter(Boolean) : [];
            const companyAddressStr = companyAddressParts.join(', ');
            if (customerAddressStr) {
                let embedUrl = '';
                let mapsUrl = '';
                let wazeUrl = '';
                if (companyAddressStr) {
                    // If company address exists, show directions/route
                    embedUrl = `https://maps.google.com/maps?saddr=${encodeURIComponent(companyAddressStr)}&daddr=${encodeURIComponent(customerAddressStr)}&output=embed`;
                    mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(companyAddressStr)}&destination=${encodeURIComponent(customerAddressStr)}`;
                    wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(customerAddressStr)}&navigate=yes`;
                }
                else {
                    // Otherwise just show customer location
                    embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(customerAddressStr)}&output=embed`;
                    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customerAddressStr)}`;
                    wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(customerAddressStr)}&navigate=yes`;
                }
                if (googleMapsIframe) {
                    googleMapsIframe.src = embedUrl;
                }
                if (btnOpenWaze) {
                    btnOpenWaze.href = wazeUrl;
                    btnOpenWaze.classList.remove('hidden');
                }
                if (btnOpenGoogleMaps) {
                    btnOpenGoogleMaps.href = mapsUrl;
                    btnOpenGoogleMaps.classList.remove('hidden');
                }
            }
            else {
                if (googleMapsIframe)
                    googleMapsIframe.removeAttribute('src');
                if (btnOpenWaze)
                    btnOpenWaze.classList.add('hidden');
                if (btnOpenGoogleMaps)
                    btnOpenGoogleMaps.classList.add('hidden');
            }
        }
        else {
            if (mapCustomerAddressSpan)
                mapCustomerAddressSpan.textContent = 'Cliente não encontrado';
            if (googleMapsIframe)
                googleMapsIframe.removeAttribute('src');
            if (btnOpenWaze)
                btnOpenWaze.classList.add('hidden');
            if (btnOpenGoogleMaps)
                btnOpenGoogleMaps.classList.add('hidden');
        }
        const viewDetailsRegisterAsCompanyWrapper = getById('viewDetailsRegisterAsCompanyWrapper');
        if (viewDetailsRegisterAsCompanyWrapper) {
            viewDetailsRegisterAsCompanyWrapper.classList.add('hidden');
            viewDetailsRegisterAsCompanyWrapper.classList.remove('flex');
            if (window.isGeneralAdminCompany) {
                const cleanCustomerCnpj = String(customer?.cnpj_cpf || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                if (cleanCustomerCnpj) {
                    (window.api)('/companies').then((res) => {
                        const companiesList = res?.data || [];
                        const companyExists = companiesList.some((comp) => {
                            const cleanCompCnpj = String(comp.cnpj || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                            return cleanCompCnpj === cleanCustomerCnpj;
                        });
                        if (companyExists) {
                            viewDetailsRegisterAsCompanyWrapper.classList.remove('hidden');
                            viewDetailsRegisterAsCompanyWrapper.classList.add('flex');
                        }
                        else {
                            viewDetailsRegisterAsCompanyWrapper.classList.add('hidden');
                            viewDetailsRegisterAsCompanyWrapper.classList.remove('flex');
                        }
                    }).catch((err) => {
                        console.error('[openViewDetailsModal] Error checking company CNPJ:', err);
                        viewDetailsRegisterAsCompanyWrapper.classList.add('hidden');
                        viewDetailsRegisterAsCompanyWrapper.classList.remove('flex');
                    });
                }
            }
        }
        const docUrlField = customer?.cnpj_document_url;
        let docsList = [];
        if (docUrlField) {
            try {
                let parsed = [];
                if (docUrlField.trim().startsWith('[')) {
                    parsed = JSON.parse(docUrlField);
                }
                else {
                    parsed = [docUrlField];
                }
                docsList = parsed.map(item => {
                    if (typeof item === 'string') {
                        return { name: item.substring(item.lastIndexOf('/') + 1), url: item, attachedAt: new Date(2026, 0, 1).toISOString() };
                    }
                    return {
                        name: item.name || item.url.substring(item.url.lastIndexOf('/') + 1),
                        url: item.url,
                        attachedAt: item.attachedAt || new Date().toISOString()
                    };
                }).filter(d => d && d.url);
            }
            catch (e) {
                const url = docUrlField;
                docsList = [{ name: url.substring(url.lastIndexOf('/') + 1), url, attachedAt: new Date().toISOString() }];
            }
        }
        const formatAttachedDate = (isoStr) => {
            if (!isoStr)
                return '';
            try {
                const d = new Date(isoStr);
                if (isNaN(d.getTime()))
                    return '';
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                const hour = String(d.getHours()).padStart(2, '0');
                const min = String(d.getMinutes()).padStart(2, '0');
                return `${day}/${month}/${year} às ${hour}:${min}`;
            }
            catch (e) {
                return '';
            }
        };
        const renderDetailsDocsList = () => {
            if (!docContainer)
                return;
            // Sort by attached date (newest first)
            docsList.sort((a, b) => new Date(b.attachedAt || 0).getTime() - new Date(a.attachedAt || 0).getTime());
            if (docsList.length === 0) {
                docContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 gap-2 text-gray-400 dark:text-gray-500 w-full">
                    <svg class="w-12 h-12 text-gray-300 dark:text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <p class="text-sm font-medium">Nenhum documento anexado para este cliente.</p>
                </div>
            `;
                return;
            }
            const cardsHtml = docsList.map((doc, idx) => {
                const fileName = doc.url.substring(doc.url.lastIndexOf('/') + 1);
                const dateStr = formatAttachedDate(doc.attachedAt);
                return `
                <div class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:border-brand-300 dark:hover:border-brand-700 transition-all">
                    <button type="button" class="btn-view-pdf-modal flex items-center gap-3 flex-1 min-w-0 mr-4 group text-left cursor-pointer" data-url="${doc.url}" data-name="${doc.name || fileName}">
                        <div class="p-2 rounded bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/60 transition-colors">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                        </div>
                        <div class="flex-1 min-w-0 font-sans">
                            <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">${doc.name}</p>
                            <p class="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">${fileName}</p>
                            ${dateStr ? `
                                <p class="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-1 flex items-center gap-1">
                                    <svg class="w-3.5 h-3.5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                    ${dateStr}
                                </p>
                            ` : ''}
                        </div>
                    </button>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <button type="button" class="btn-rename-detail-doc p-1.5 rounded text-gray-500 hover:text-brand-600 hover:bg-brand-50 dark:text-gray-400 dark:hover:text-brand-400 dark:hover:bg-brand-950/30 transition-colors" data-index="${idx}" title="Renomear documento">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                            </svg>
                        </button>
                        <button type="button" class="btn-delete-detail-doc p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-950/30 transition-colors" data-index="${idx}" title="Excluir documento">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
            }).join('');
            docContainer.innerHTML = `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full font-sans">
                ${cardsHtml}
            </div>
        `;
            // Bind Rename Buttons
            docContainer.querySelectorAll('.btn-rename-detail-doc').forEach((btn) => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const idx = parseInt(btn.dataset.index);
                    if (isNaN(idx))
                        return;
                    renameDocIdx = idx;
                    renameDocsList = docsList;
                    renameEntityId = customerId;
                    activeRenderDetailsDocsList = renderDetailsDocsList;
                    const renameModal = getById('renameDocumentModal');
                    const renameInput = getById('renameDocumentInput');
                    if (renameInput) {
                        renameInput.value = docsList[idx].name || '';
                    }
                    renameModal?.classList.remove('hidden');
                    renameInput?.focus();
                });
            });
            // Bind Delete Buttons
            docContainer.querySelectorAll('.btn-delete-detail-doc').forEach((btn) => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const idx = parseInt(btn.dataset.index);
                    if (isNaN(idx))
                        return;
                    deleteDocIdx = idx;
                    deleteDocsList = docsList;
                    deleteEntityId = customerId;
                    activeRenderDetailsDocsList = renderDetailsDocsList;
                    const deleteModal = getById('deleteDocumentModal');
                    const docNameSpan = getById('deleteDocumentName');
                    if (docNameSpan) {
                        docNameSpan.textContent = docsList[idx].name || '';
                    }
                    deleteModal?.classList.remove('hidden');
                });
            });
        };
        // Bind Upload Button in Details Panel
        const detailCnpjFileInput = getById('detailCnpjFile');
        if (detailCnpjFileInput) {
            // Clone to strip old listeners
            const newFileInput = detailCnpjFileInput.cloneNode(true);
            detailCnpjFileInput.parentNode?.replaceChild(newFileInput, detailCnpjFileInput);
            newFileInput.addEventListener('change', async (e) => {
                const input = e.target;
                const files = Array.from(input.files || []);
                if (files.length === 0)
                    return;
                const uploads = [];
                for (const file of files) {
                    const f = file;
                    try {
                        const b64 = (await getBase64(f));
                        const defaultName = f.name.substring(0, f.name.lastIndexOf('.')) || f.name;
                        uploads.push({
                            name: defaultName,
                            base64: b64,
                            attachedAt: new Date().toISOString(),
                            filename: f.name
                        });
                    }
                    catch (err) {
                        console.error('Erro ao ler arquivo para upload imediato', err);
                    }
                }
                if (uploads.length > 0) {
                    try {
                        newFileInput.disabled = true;
                        if (docContainer) {
                            docContainer.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Enviando documentos...</p>';
                        }
                        await (window.api)(`/entities/customers/${customerId}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                                cnpj_document_url: JSON.stringify(docsList),
                                cnpj_document_uploads: uploads
                            })
                        });
                        window.UI.showAlert('alertMessage', 'Documentos anexados com sucesso!', 'success');
                        await customersManager.loadData();
                        const updatedCustomer = customersManager?.data?.find((c) => c.public_id === customerId);
                        const updatedField = updatedCustomer?.cnpj_document_url;
                        docsList = [];
                        if (updatedField) {
                            try {
                                let parsed = [];
                                if (updatedField.trim().startsWith('[')) {
                                    parsed = JSON.parse(updatedField);
                                }
                                else {
                                    parsed = [updatedField];
                                }
                                docsList = parsed.map(item => {
                                    if (typeof item === 'string') {
                                        return { name: item.substring(item.lastIndexOf('/') + 1), url: item, attachedAt: new Date(2026, 0, 1).toISOString() };
                                    }
                                    return { name: item.name || item.url.substring(item.url.lastIndexOf('/') + 1), url: item.url, attachedAt: item.attachedAt || new Date().toISOString() };
                                }).filter(d => d && d.url);
                            }
                            catch (e) {
                                const url = updatedField;
                                docsList = [{ name: url.substring(url.lastIndexOf('/') + 1), url, attachedAt: new Date().toISOString() }];
                            }
                        }
                        renderDetailsDocsList();
                    }
                    catch (err) {
                        console.error('Erro ao anexar documentos', err);
                        alert(err.message || 'Erro ao anexar documentos.');
                        renderDetailsDocsList();
                    }
                    finally {
                        newFileInput.disabled = false;
                        newFileInput.value = '';
                    }
                }
            });
        }
        if (docsList.length > 0) {
            renderDetailsDocsList();
        }
        else {
            renderDetailsDocsList();
        }
        modal.classList.remove('hidden');
        try {
            const [salesRes, servicesRes, revenuesRes, tasksRes] = await Promise.all([
                (window.api)(`/orders/customers/${customerId}/sales`).catch(() => ({ data: [] })),
                (window.api)('/estoque/service-launches').catch(() => ({ data: [] })),
                (window.api)('/finance/revenues').catch(() => ({ data: [] })),
                (window.api)('/tasks').catch(() => ({ data: [] }))
            ]);
            const sales = salesRes.data || [];
            const services = (servicesRes.data || []).filter((item) => item.customer_public_id === customerId);
            const revenues = (revenuesRes.data || []).filter((item) => item.customer_public_id === customerId || item.entity_public_id === customerId);
            const tasks = (tasksRes.data || []).filter((item) => item.personType === 'customer' && item.personId === customerId);
            if (ordersTable) {
                if (sales.length === 0) {
                    ordersTable.innerHTML = '<tr><td colspan="4" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum pedido encontrado.</td></tr>';
                }
                else {
                    ordersTable.innerHTML = sales.map((sale) => {
                        const date = sale.created_at ? new Date(sale.created_at).toLocaleDateString('pt-BR') : '-';
                        const formattedVal = Number(sale.total_amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                        return `
                        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">#${sale.public_id.slice(-6).toUpperCase()}</td>
                            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">${date}</td>
                            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">${sale.status || 'Pendente'}</span>
                            </td>
                            <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right font-mono">${formattedVal}</td>
                        </tr>
                    `;
                    }).join('');
                }
            }
            if (servicesTable) {
                if (services.length === 0) {
                    servicesTable.innerHTML = '<tr><td colspan="4" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum lançamento de serviço encontrado.</td></tr>';
                }
                else {
                    servicesTable.innerHTML = services.map((srv) => {
                        const formattedVal = Number(srv.total_amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                        return `
                        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">#${srv.public_id.slice(-6).toUpperCase()}</td>
                            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">${srv.service_name || srv.description || '-'}</td>
                            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200">${srv.nfse_status || 'Pendente'}</span>
                            </td>
                            <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right font-mono">${formattedVal}</td>
                        </tr>
                    `;
                    }).join('');
                }
            }
            if (financialsTable) {
                if (revenues.length === 0) {
                    financialsTable.innerHTML = '<tr><td colspan="5" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum lançamento financeiro encontrado.</td></tr>';
                }
                else {
                    financialsTable.innerHTML = revenues.map((rev) => {
                        let date = '-';
                        if (rev.date) {
                            try {
                                const d = new Date(rev.date);
                                if (!isNaN(d.getTime())) {
                                    const str = typeof rev.date === 'string' ? rev.date : d.toISOString();
                                    const matches = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
                                    if (matches) {
                                        date = `${matches[3]}/${matches[2]}/${matches[1]}`;
                                    }
                                    else {
                                        date = d.toLocaleDateString('pt-BR');
                                    }
                                }
                            }
                            catch (e) { }
                        }
                        const formattedVal = Number(rev.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                        const statusColor = rev.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200';
                        const statusText = rev.status === 'paid' ? 'Pago' : 'Pendente';
                        const escapeAttr = (str) => String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                        const jwtToken = window.Auth?.getToken?.() || localStorage.getItem('erp_token') || sessionStorage.getItem('erp_token') || '';
                        const tokenParam = jwtToken ? `?token=${encodeURIComponent(jwtToken)}` : '';
                        const receiptUrl = `/api/v1/finance/revenues/${rev.public_id}/receipt${tokenParam}`;
                        const hasBoleto = rev.payment_method === 'boleto' && rev.billet_url;
                        const delim = tokenParam ? '&' : '?';
                        const boletoUrl = hasBoleto ? `/api/v1/finance/revenues/${rev.public_id}/boleto-pdf${tokenParam}${delim}nossoNumero=${encodeURIComponent(rev.billet_url)}` : '';
                        return `
                        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">${rev.description || '-'}</td>
                            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">${date}</td>
                            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">${statusText}</span>
                            </td>
                            <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right font-mono">${formattedVal}</td>
                            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                                <div class="flex items-center justify-center gap-1.5">
                                    <button type="button" class="btn-view-pdf-modal inline-flex items-center gap-1 px-2 py-1 rounded bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:hover:bg-brand-900/60 dark:text-brand-300 text-[11px] font-medium transition-colors cursor-pointer" data-url="${receiptUrl}" data-name="Recibo: ${escapeAttr(rev.description)}" title="Visualizar Recibo de Cobrança">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                                        <span>Recibo</span>
                                    </button>
                                    ${hasBoleto ? `
                                        <button type="button" class="btn-view-pdf-modal inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 text-[11px] font-medium transition-colors cursor-pointer" data-url="${boletoUrl}" data-name="Boleto: ${escapeAttr(rev.description)}" title="Visualizar Boleto PDF">
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2zM9 16h6"/></svg>
                                            <span>Boleto</span>
                                        </button>
                                    ` : ''}
                                </div>
                            </td>
                        </tr>
                    `;
                    }).join('');
                }
            }
            // Bind Save Note Button
            const saveNoteBtn = getById('btnSaveCustomerNote');
            if (saveNoteBtn) {
                const newSaveBtn = saveNoteBtn.cloneNode(true);
                saveNoteBtn.parentNode?.replaceChild(newSaveBtn, saveNoteBtn);
                newSaveBtn.addEventListener('click', async () => {
                    const txtArea = getById('txtNewCustomerNote');
                    const noteText = txtArea?.value || '';
                    if (!noteText.trim()) {
                        alert('A anotação não pode estar vazia.');
                        return;
                    }
                    try {
                        newSaveBtn.disabled = true;
                        await (window.api)(`/entities/customers/${customerId}/notes`, {
                            method: 'POST',
                            body: JSON.stringify({ note: noteText })
                        });
                        if (txtArea)
                            txtArea.value = '';
                        window.UI.showAlert('alertMessage', 'Anotação salva com sucesso!', 'success');
                        fetchAndRenderCustomerNotes(customerId);
                    }
                    catch (err) {
                        console.error('Erro ao salvar nota', err);
                        alert(err.message || 'Erro ao salvar anotação.');
                    }
                    finally {
                        newSaveBtn.disabled = false;
                    }
                });
            }
            const txtArea = getById('txtNewCustomerNote');
            if (txtArea)
                txtArea.value = '';
            fetchAndRenderCustomerNotes(customerId);
            const tasksList = getById('customerTasksList');
            const escapeHtml = (str) => String(str || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            let currentCustomerViewMode = 'list';
            let currentCustomerTaskFilter = 'pending';
            let detailCalendarDate = new Date();
            let detailAgendaDayDate = new Date();
            const updateFilterButtons = () => {
                document.querySelectorAll('#tabPanelTarefas .task-filter-btn').forEach((btn) => {
                    const filter = btn.getAttribute('data-filter') || 'all';
                    const isActive = filter === currentCustomerTaskFilter;
                    if (isActive) {
                        btn.className = 'task-filter-btn flex items-center justify-center p-2 rounded-lg transition-colors text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30';
                    }
                    else {
                        btn.className = 'task-filter-btn flex items-center justify-center p-2 rounded-lg hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors text-gray-500';
                    }
                });
            };
            updateFilterButtons();
            document.querySelectorAll('#tabPanelTarefas .task-filter-btn').forEach((btn) => {
                btn.onclick = () => {
                    currentCustomerTaskFilter = btn.getAttribute('data-filter') || 'all';
                    updateFilterButtons();
                    renderTasksForDetails();
                };
            });
            document.querySelectorAll('.customer-view-mode-btn').forEach((btn) => {
                const isList = btn.getAttribute('data-view') === 'list';
                btn.classList.toggle('active', isList);
                btn.classList.toggle('text-brand-700', isList);
                btn.classList.toggle('dark:text-brand-300', isList);
                btn.classList.toggle('bg-white', isList);
                btn.classList.toggle('dark:bg-slate-700', isList);
                btn.classList.toggle('shadow-sm', isList);
                btn.classList.toggle('text-gray-500', !isList);
                btn.classList.toggle('dark:text-gray-400', !isList);
                btn.onclick = () => {
                    document.querySelectorAll('.customer-view-mode-btn').forEach((b) => {
                        b.classList.remove('active', 'text-brand-700', 'dark:text-brand-300', 'bg-white', 'dark:bg-slate-700', 'shadow-sm');
                        b.classList.add('text-gray-500', 'dark:text-gray-400');
                    });
                    btn.classList.add('active', 'text-brand-700', 'dark:text-brand-300', 'bg-white', 'dark:bg-slate-700', 'shadow-sm');
                    btn.classList.remove('text-gray-500', 'dark:text-gray-400');
                    currentCustomerViewMode = btn.getAttribute('data-view') || 'list';
                    renderTasksForDetails();
                };
            });
            const renderTasksForDetails = () => {
                if (!tasksList)
                    return;
                const todayStr = new Date().toISOString().split('T')[0];
                const activeTasks = tasks.filter((t) => {
                    const status = t.status || 'pending';
                    if (currentCustomerTaskFilter === 'all')
                        return true;
                    return status === currentCustomerTaskFilter;
                });
                if (currentCustomerViewMode === 'list') {
                    if (tasksList) {
                        tasksList.classList.remove('max-h-[300px]', 'max-h-[450px]', 'max-h-[500px]', 'max-h-[600px]');
                        tasksList.classList.add('max-h-[450px]');
                    }
                    if (activeTasks.length === 0) {
                        tasksList.innerHTML = '<div class="py-8 text-center text-sm text-gray-500 dark:text-gray-400 font-sans">Nenhuma tarefa relacionada encontrada.</div>';
                        return;
                    }
                    activeTasks.sort((a, b) => {
                        if (a.status === b.status) {
                            if (!a.dueDate && !b.dueDate)
                                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                            if (!a.dueDate)
                                return 1;
                            if (!b.dueDate)
                                return -1;
                            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                        }
                        return a.status === 'completed' ? 1 : -1;
                    });
                    tasksList.innerHTML = activeTasks.map((t) => {
                        const isDone = t.status === 'completed';
                        const user = allUsers.find((u) => (u.public_id || u.id) === t.userId);
                        const userName = user ? (user.full_name || user.name) : 'Todos';
                        let statusBadge = '';
                        if (t.status === 'pending')
                            statusBadge = '<span class="inline-flex items-center rounded-full bg-gray-100 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-gray-800 dark:text-gray-200 shadow-sm border border-gray-200 dark:border-slate-600">A Fazer</span>';
                        if (t.status === 'progress')
                            statusBadge = '<span class="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 text-xs font-medium text-blue-800 dark:text-blue-300 shadow-sm border border-blue-200 dark:border-blue-800">Em Andamento</span>';
                        if (t.status === 'completed')
                            statusBadge = '<span class="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 shadow-sm border border-emerald-200 dark:border-emerald-800">Concluída</span>';
                        let dueBadge = '';
                        if (t.dueDate) {
                            const parts = t.dueDate.split('T');
                            const datePart = parts[0];
                            const timePart = parts.length > 1 ? parts[1] : '';
                            const [y, m, d] = datePart.split('-');
                            let colorClass = 'text-gray-500 dark:text-gray-400';
                            if (!isDone) {
                                if (datePart < todayStr)
                                    colorClass = 'text-red-500 font-semibold';
                                else if (datePart === todayStr)
                                    colorClass = 'text-orange-500 font-semibold';
                                else
                                    colorClass = 'text-brand-600 dark:text-brand-400';
                            }
                            const timeDisplay = timePart ? ` às ${timePart}` : '';
                            dueBadge = `
                            <div class="flex items-center text-xs ${colorClass} gap-1" title="Vencimento Agendado">
                                <svg class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                <span>${d}/${m}/${y}${timeDisplay}</span>
                            </div>
                        `;
                        }
                        const circleClass = isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 dark:border-slate-500 bg-transparent text-transparent hover:border-emerald-400 dark:hover:border-emerald-500';
                        return `
                        <div class="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700 shadow-sm flex gap-3 items-start hover:shadow-md transition-shadow">
                            <button type="button" data-action="toggle-task" data-task-id="${t.id}" class="mt-0.5 shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${circleClass}">
                                <svg class="h-3.5 w-3.5 pointer-events-none" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
                            </button>
                            <div class="flex-1 min-w-0 font-sans">
                                <p class="text-sm font-semibold transition-all ${isDone ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'}">${escapeHtml(t.title)}</p>
                                <div class="mt-2 flex flex-wrap items-center gap-3">
                                    ${statusBadge}
                                    ${dueBadge}
                                    <div class="flex items-center text-xs text-gray-500 dark:text-gray-400 gap-1" title="Responsável">
                                        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        <span>${userName}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    }).join('');
                }
                else if (currentCustomerViewMode === 'day') {
                    if (tasksList) {
                        tasksList.classList.remove('max-h-[300px]', 'max-h-[450px]', 'max-h-[500px]', 'max-h-[600px]');
                        tasksList.classList.add('max-h-[600px]');
                    }
                    const dy = detailAgendaDayDate.getFullYear();
                    const dm = String(detailAgendaDayDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(detailAgendaDayDate.getDate()).padStart(2, '0');
                    const dateStr = `${dy}-${dm}-${dd}`;
                    const fullDateStr = detailAgendaDayDate.toLocaleString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
                    const tasksForDay = activeTasks.filter((t) => (t.dueDate ? t.dueDate.split('T')[0] : null) === dateStr);
                    let dayHtml = `
                    <div class="bg-white dark:bg-slate-800/40 rounded-xl p-3 border border-gray-200 dark:border-slate-700/80 shadow-sm">
                        <div class="flex items-center justify-between mb-3">
                            <button type="button" data-detail-nav="prev-day" class="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition">
                                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <div class="text-center">
                                <h5 class="text-xs font-bold text-gray-900 dark:text-gray-100 capitalize leading-tight font-sans">${fullDateStr}</h5>
                            </div>
                            <button type="button" data-detail-nav="next-day" class="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition">
                                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                        
                        <div class="flex flex-col border border-gray-100 dark:border-slate-800/60 rounded-xl bg-white dark:bg-slate-900/20 overflow-hidden font-sans">
                `;
                    for (let h = 8; h <= 20; h++) {
                        const hourStr = String(h).padStart(2, '0');
                        const hourTasks = tasksForDay.filter((t) => {
                            if (!t.dueDate || !t.dueDate.includes('T'))
                                return false;
                            const timePart = t.dueDate.split('T')[1];
                            if (!timePart)
                                return false;
                            return timePart.split(':')[0] === hourStr;
                        });
                        let hourTasksHtml = '';
                        if (hourTasks.length > 0) {
                            hourTasksHtml = hourTasks.map((t) => {
                                const isDone = t.status === 'completed';
                                const datePart = t.dueDate ? t.dueDate.split('T')[0] : '';
                                let bgClass = 'bg-brand-50 text-brand-700 border-brand-100 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-900/30';
                                if (isDone)
                                    bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/30 opacity-70 line-through';
                                else if (datePart && datePart < todayStr)
                                    bgClass = 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/30';
                                const circleClass = isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-current bg-transparent text-transparent hover:opacity-75';
                                const timeText = t.dueDate.split('T')[1] || '';
                                return `
                            <div class="p-1.5 rounded-lg transition border flex items-center justify-between gap-2 ${bgClass} w-full" title="${t.title}">
                                <div class="flex items-center gap-1.5 flex-1 min-w-0">
                                    <button type="button" data-action="toggle-task" data-task-id="${t.id}" class="shrink-0 h-3.5 w-3.5 rounded-full border flex items-center justify-center transition-colors focus:outline-none ${circleClass}">
                                        <svg class="h-2.5 w-2.5 pointer-events-none" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
                                    </button>
                                    <span class="text-xs truncate flex-1 font-semibold">${escapeHtml(t.title)}</span>
                                </div>
                                <span class="text-[10px] opacity-70 font-semibold shrink-0">${timeText}</span>
                            </div>`;
                            }).join('');
                        }
                        else {
                            hourTasksHtml = `<span class="text-[10px] text-gray-400 dark:text-slate-650 font-medium ml-2">---</span>`;
                        }
                        const isCurrentHour = new Date().getHours() === h && dateStr === todayStr;
                        const hourHeaderBg = isCurrentHour ? 'text-brand-600 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-900/20' : 'text-gray-400 dark:text-slate-500 bg-gray-50/50 dark:bg-slate-900/40';
                        dayHtml += `
                    <div class="flex border-b border-gray-100 dark:border-slate-800/60 min-h-10 last:border-0 hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition">
                        <div class="w-12 shrink-0 flex items-center justify-end pr-2 text-[10px] font-bold ${hourHeaderBg} border-r border-gray-100 dark:border-slate-800/60">${hourStr}:00</div>
                        <div class="flex-1 p-1 flex flex-col gap-1 justify-center ${isCurrentHour ? 'bg-brand-50/10' : ''}">
                            ${hourTasksHtml}
                        </div>
                    </div>`;
                    }
                    dayHtml += `</div></div>`;
                    tasksList.innerHTML = dayHtml;
                }
                else if (currentCustomerViewMode === 'calendar') {
                    if (tasksList) {
                        tasksList.classList.remove('max-h-[300px]', 'max-h-[450px]', 'max-h-[500px]', 'max-h-[600px]');
                        tasksList.classList.add('max-h-[600px]');
                    }
                    const year = detailCalendarDate.getFullYear();
                    const month = detailCalendarDate.getMonth();
                    const firstDay = new Date(year, month, 1).getDay();
                    const lastDate = new Date(year, month + 1, 0).getDate();
                    const monthName = detailCalendarDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
                    let calendarGrid = `
                    <div class="bg-white dark:bg-slate-800/40 rounded-xl p-3 border border-gray-200 dark:border-slate-700/80 shadow-sm">
                        <div class="flex items-center justify-between mb-3">
                            <button type="button" data-detail-nav="prev-month" class="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition">
                                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <h5 class="text-xs font-bold text-gray-900 dark:text-gray-100 capitalize font-sans">${monthName}</h5>
                            <button type="button" data-detail-nav="next-month" class="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition">
                                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                        
                        <div class="grid grid-cols-7 gap-1 text-center text-[9px] font-semibold text-gray-400 dark:text-slate-500 mb-1 uppercase tracking-wider font-sans">
                            <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
                        </div>
                        <div class="grid grid-cols-7 gap-1 auto-rows-fr font-sans">
                `;
                    for (let i = 0; i < firstDay; i++) {
                        calendarGrid += `<div class="p-1 bg-gray-50/20 dark:bg-slate-900/10 rounded-lg border border-dashed border-gray-100/50 dark:border-slate-800/40 min-h-14"></div>`;
                    }
                    for (let d = 1; d <= lastDate; d++) {
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const tasksForDay = activeTasks.filter((t) => (t.dueDate ? t.dueDate.split('T')[0] : null) === dateStr);
                        const isToday = dateStr === todayStr;
                        const dayBadge = isToday
                            ? `<span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white text-[10px] font-bold cursor-pointer shadow-sm hover:bg-brand-700 transition" data-detail-action="go-to-day" data-date="${dateStr}">${d}</span>`
                            : `<span class="inline-block px-1 text-gray-700 dark:text-slate-300 text-[10px] font-bold cursor-pointer hover:text-brand-600 dark:hover:text-brand-400 transition" data-detail-action="go-to-day" data-date="${dateStr}">${d}</span>`;
                        let tasksListHtml = tasksForDay.slice(0, 2).map((t) => {
                            const isDone = t.status === 'completed';
                            const datePart = t.dueDate ? t.dueDate.split('T')[0] : '';
                            let bgClass = 'bg-brand-50 text-brand-700 border-brand-100 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-900/30';
                            if (isDone)
                                bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/30 opacity-70 line-through';
                            else if (datePart && datePart < todayStr)
                                bgClass = 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/30';
                            return `
                        <div class="mt-0.5 px-1 py-0.5 rounded text-[8px] truncate font-semibold border ${bgClass}" title="${escapeHtml(t.title)}">
                            ${escapeHtml(t.title)}
                        </div>`;
                        }).join('');
                        if (tasksForDay.length > 2) {
                            tasksListHtml += `<div class="text-[8px] text-gray-400 dark:text-slate-500 text-center font-bold mt-0.5">+${tasksForDay.length - 2}</div>`;
                        }
                        const todayBorder = isToday ? 'ring-2 ring-brand-500 ring-inset bg-brand-50/10 dark:bg-brand-950/5' : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800/60 hover:bg-gray-50 dark:hover:bg-slate-700/20';
                        calendarGrid += `
                    <div class="p-1 border rounded-lg flex flex-col min-h-14 transition-colors ${todayBorder}">
                        <div class="text-right mb-0.5">${dayBadge}</div>
                        <div class="flex-1 flex flex-col gap-0.5 overflow-hidden">
                            ${tasksListHtml}
                        </div>
                    </div>`;
                    }
                    calendarGrid += `</div></div>`;
                    tasksList.innerHTML = calendarGrid;
                }
            };
            if (tasksList) {
                tasksList.onclick = async (e) => {
                    const button = e.target.closest('[data-action="toggle-task"]');
                    if (button) {
                        const taskId = button.getAttribute('data-task-id');
                        const task = tasks.find((t) => t.id === taskId);
                        if (!task)
                            return;
                        const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
                        const nextCompletedAt = nextStatus === 'completed' ? new Date().toISOString() : null;
                        button.disabled = true;
                        try {
                            const res = await (window.api)(`/tasks/${taskId}`, {
                                method: 'PUT',
                                body: JSON.stringify({
                                    title: task.title,
                                    dueDate: task.dueDate || null,
                                    userId: task.userId || null,
                                    status: nextStatus,
                                    personType: task.personType || null,
                                    personId: task.personId || null,
                                    attachments: task.attachments || [],
                                    completedAt: nextCompletedAt
                                })
                            });
                            if (res && res.data) {
                                const updatedIdx = tasks.findIndex((t) => t.id === taskId);
                                if (updatedIdx !== -1) {
                                    tasks[updatedIdx] = res.data;
                                }
                            }
                            renderTasksForDetails();
                        }
                        catch (err) {
                            console.error('Erro ao atualizar tarefa', err);
                            alert(err.message || 'Erro ao atualizar tarefa.');
                            button.disabled = false;
                        }
                        return;
                    }
                    const navPrevDay = e.target.closest('[data-detail-nav="prev-day"]');
                    if (navPrevDay) {
                        detailAgendaDayDate.setDate(detailAgendaDayDate.getDate() - 1);
                        renderTasksForDetails();
                        return;
                    }
                    const navNextDay = e.target.closest('[data-detail-nav="next-day"]');
                    if (navNextDay) {
                        detailAgendaDayDate.setDate(detailAgendaDayDate.getDate() + 1);
                        renderTasksForDetails();
                        return;
                    }
                    const navPrevMonth = e.target.closest('[data-detail-nav="prev-month"]');
                    if (navPrevMonth) {
                        detailCalendarDate.setMonth(detailCalendarDate.getMonth() - 1);
                        renderTasksForDetails();
                        return;
                    }
                    const navNextMonth = e.target.closest('[data-detail-nav="next-month"]');
                    if (navNextMonth) {
                        detailCalendarDate.setMonth(detailCalendarDate.getMonth() + 1);
                        renderTasksForDetails();
                        return;
                    }
                    const goDayBtn = e.target.closest('[data-detail-action="go-to-day"]');
                    if (goDayBtn) {
                        const dateStr = goDayBtn.getAttribute('data-date');
                        if (dateStr) {
                            detailAgendaDayDate = new Date(dateStr + 'T12:00:00');
                            currentCustomerViewMode = 'day';
                            document.querySelectorAll('.customer-view-mode-btn').forEach((btn) => {
                                const isDay = btn.getAttribute('data-view') === 'day';
                                btn.classList.toggle('active', isDay);
                                btn.classList.toggle('text-brand-700', isDay);
                                btn.classList.toggle('dark:text-brand-300', isDay);
                                btn.classList.toggle('bg-white', isDay);
                                btn.classList.toggle('dark:bg-slate-700', isDay);
                                btn.classList.toggle('shadow-sm', isDay);
                                btn.classList.toggle('text-gray-500', !isDay);
                                btn.classList.toggle('dark:text-gray-400', !isDay);
                            });
                            renderTasksForDetails();
                        }
                        return;
                    }
                };
                renderTasksForDetails();
            }
        }
        catch (error) {
            console.error('Erro ao buscar detalhes do cliente', error);
            window.UI.showAlert('alertMessage', 'Falha ao carregar histórico do cliente.', 'error');
        }
    }
    async function fetchAndRenderCustomerNotes(customerId) {
        const listContainer = getById('customerNotesList');
        if (!listContainer)
            return;
        listContainer.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 animate-pulse">Carregando anotações...</p>';
        try {
            const res = await (window.api)(`/entities/customers/${customerId}/notes`);
            const notes = res.data || [];
            if (notes.length === 0) {
                listContainer.innerHTML = `
                <div class="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
                    Nenhuma anotação registrada para este cliente.
                </div>
            `;
                return;
            }
            listContainer.innerHTML = notes.map((n) => {
                const dateStr = n.created_at ? formatNoteDate(n.created_at) : '';
                return `
                <div class="p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm flex justify-between items-start gap-4">
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-semibold text-brand-600 dark:text-brand-400 font-sans mb-1">
                            ${n.user_name || 'Usuário'} · <span class="text-gray-400 dark:text-gray-500 font-normal font-mono text-[10px]">${dateStr}</span>
                        </p>
                        <p class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-sans">${n.note}</p>
                    </div>
                    <button type="button" class="btn-delete-customer-note text-gray-400 hover:text-red-500 p-1 rounded transition-colors" data-id="${n.public_id}" title="Excluir anotação">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            `;
            }).join('');
            // Bind delete buttons
            listContainer.querySelectorAll('.btn-delete-customer-note').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const noteId = btn.dataset.id;
                    if (!noteId)
                        return;
                    if (!confirm('Deseja realmente excluir esta anotação?'))
                        return;
                    try {
                        btn.disabled = true;
                        await (window.api)(`/entities/customers/${customerId}/notes/${noteId}`, {
                            method: 'DELETE'
                        });
                        window.UI.showAlert('alertMessage', 'Anotação excluída com sucesso!', 'success');
                        fetchAndRenderCustomerNotes(customerId);
                    }
                    catch (err) {
                        console.error('Erro ao excluir nota', err);
                        alert(err.message || 'Erro ao excluir anotação.');
                        btn.disabled = false;
                    }
                });
            });
        }
        catch (err) {
            console.error('Erro ao buscar notas', err);
            listContainer.innerHTML = '<p class="text-sm text-red-500">Erro ao carregar anotações.</p>';
        }
    }
    function formatNoteDate(isoStr) {
        if (!isoStr)
            return '';
        try {
            const d = new Date(isoStr);
            if (isNaN(d.getTime()))
                return '';
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            const hour = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            return `${day}/${month}/${year} às ${hour}:${min}`;
        }
        catch (e) {
            return '';
        }
    }
    function setupCustomerFormEnhancements() {
        const documentInput = getById('customerDocument');
        const phoneInput = getById('customerPhone');
        const zipcodeInput = getById('customerZipcode');
        const btnSearchCnpj = getById('btnSearchCnpj');
        const certFile = getById('customerCertFile');
        const certPass = getById('customerCertPassword');
        if (documentInput && !customerDocMask) {
            customerDocMask = makeMask(documentInput, {
                mask: [
                    { mask: '000.000.000-00' },
                    {
                        mask: 'XX.XXX.XXX/XXXX-XX',
                        definitions: {
                            'X': /[a-zA-Z0-9]/
                        }
                    },
                ],
                prepare: (str) => str.toUpperCase()
            });
        }
        if (documentInput) {
            documentInput.addEventListener('blur', () => {
                const val = documentInput.value || '';
                checkCompanyCnpj(val);
            });
        }
        if (btnSearchCnpj)
            btnSearchCnpj.addEventListener('click', handleCustomerDocumentLookup);
        if (phoneInput && !customerPhoneMask) {
            customerPhoneMask = makeMask(phoneInput, {
                mask: [
                    { mask: '(00) 0000-0000' },
                    { mask: '(00) 00000-0000' },
                ],
            });
        }
        const phoneLandlineInput = getById('customerPhoneLandline');
        if (phoneLandlineInput && !customerPhoneLandlineMask) {
            customerPhoneLandlineMask = makeMask(phoneLandlineInput, {
                mask: [
                    { mask: '(00) 0000-0000' },
                    { mask: '(00) 00000-0000' },
                ],
            });
        }
        if (zipcodeInput && !customerZipMask) {
            customerZipMask = makeMask(zipcodeInput, { mask: '00000-000' });
            customerZipMask.on('complete', handleCustomerCepLookup);
        }
        if (certFile)
            certFile.addEventListener('change', extractCertDate);
        if (certPass)
            certPass.addEventListener('blur', extractCertDate);
        const registerAsCompanyCheckbox = getById('customerRegisterAsCompany');
        const companyUserModal = getById('companyUserModal');
        const companyUserForm = getById('companyUserForm');
        const btnDefaultCompanyUser = getById('btnDefaultCompanyUser');
        const btnCancelCompanyUser = getById('btnCancelCompanyUser');
        if (registerAsCompanyCheckbox) {
            registerAsCompanyCheckbox.addEventListener('change', () => {
                // Ao marcar, não exibe confirmação nem modal. Apenas cadastra com os dados padrões da empresa.
                customCompanyUser = null;
            });
        }
        if (companyUserForm && companyUserModal) {
            companyUserForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const fullName = getById('companyUserFullName').value.trim();
                const email = getById('companyUserEmail').value.trim();
                const password = getById('companyUserPassword').value.trim();
                const role = getById('companyUserRole').value;
                if (!fullName || !email || !password) {
                    alert('Por favor, preencha todos os campos do usuário (Nome, E-mail e Senha) para confirmar.');
                    return;
                }
                customCompanyUser = {
                    full_name: fullName,
                    email: email,
                    password: password,
                    role: role,
                };
                companyUserModal.classList.add('hidden');
            });
        }
        if (btnDefaultCompanyUser && companyUserModal) {
            btnDefaultCompanyUser.addEventListener('click', () => {
                customCompanyUser = null;
                companyUserModal.classList.add('hidden');
            });
        }
        if (btnCancelCompanyUser && companyUserModal && registerAsCompanyCheckbox) {
            btnCancelCompanyUser.addEventListener('click', () => {
                customCompanyUser = null;
                registerAsCompanyCheckbox.checked = false;
                companyUserModal.classList.add('hidden');
            });
        }
    }
    function applyCustomerPrefillFromQuery() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('prefill') !== 'customer')
            return;
        const prefillName = String(params.get('name') || '').trim();
        const prefillPhoneRaw = onlyDigits(params.get('phone') || '');
        const prefillPhone = (prefillPhoneRaw.length === 12 || prefillPhoneRaw.length === 13) && prefillPhoneRaw.startsWith('55')
            ? prefillPhoneRaw.slice(2)
            : prefillPhoneRaw;
        const openModalBtn = getById('btnOpenModal');
        if (openModalBtn) {
            openModalBtn.click();
        }
        else {
            getById('entityModal')?.classList.remove('hidden');
        }
        window.requestAnimationFrame(() => {
            const currentName = getTrimmedValue('customerName');
            if (!currentName && prefillName) {
                getById('customerName').value = prefillName;
            }
            const currentPhone = getMaskedValue(customerPhoneMask, 'customerPhone');
            if (!currentPhone && prefillPhone) {
                setMaskedValue(customerPhoneMask, 'customerPhone', prefillPhone);
            }
        });
        if (typeof window.UI !== 'undefined' && window.UI.showAlert) {
            window.UI.showAlert('alertMessage', 'Preenchimento aplicado. Revise os dados e clique em Salvar.', 'success', 4500);
        }
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('prefill');
        cleanUrl.searchParams.delete('name');
        cleanUrl.searchParams.delete('phone');
        window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
    }
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }
        setupCustomerFormEnhancements();
        setupCustomerModalTabs();
        setupDetailsModalTabs();
        const closeViewDetailsModal = () => getById('viewCustomerDetailsModal')?.classList.add('hidden');
        getById('btnCloseViewDetailsModal')?.addEventListener('click', closeViewDetailsModal);
        getById('btnCancelViewDetailsModal')?.addEventListener('click', closeViewDetailsModal);
        const viewDetailsModalBackdrop = getById('viewDetailsModalBackdrop');
        if (viewDetailsModalBackdrop) {
            viewDetailsModalBackdrop.addEventListener('click', (e) => {
                if (e.target === viewDetailsModalBackdrop)
                    closeViewDetailsModal();
            });
        }
        document.addEventListener('click', (e) => {
            const btn = e.target?.closest('.view-details-btn');
            if (btn) {
                const customerId = btn.getAttribute('data-id');
                const customerName = btn.getAttribute('data-name');
                if (customerId && customerName) {
                    openViewDetailsModal(customerId, customerName);
                }
            }
        });
        // PDF Viewer Modal setup
        const pdfViewerModal = getById('pdfViewerModal');
        const pdfIframe = getById('pdfIframe');
        const pdfViewerModalTitle = getById('pdfViewerModalTitle');
        const downloadPdfModal = getById('downloadPdfModal');
        const closePdfModalBtn = getById('closePdfModal');
        const pdfViewerModalBackdrop = getById('pdfViewerModalBackdrop');
        const openPdfViewer = (url, title) => {
            if (!pdfViewerModal || !pdfIframe)
                return;
            pdfIframe.src = url;
            if (downloadPdfModal) {
                downloadPdfModal.href = url;
                downloadPdfModal.download = title || 'documento';
            }
            if (pdfViewerModalTitle) {
                pdfViewerModalTitle.textContent = title || 'Visualizar Documento';
            }
            pdfViewerModal.classList.remove('hidden');
        };
        const closePdfViewer = () => {
            if (!pdfViewerModal)
                return;
            pdfViewerModal.classList.add('hidden');
            if (pdfIframe)
                pdfIframe.src = '';
            if (downloadPdfModal)
                downloadPdfModal.href = '';
        };
        closePdfModalBtn?.addEventListener('click', closePdfViewer);
        if (pdfViewerModalBackdrop) {
            pdfViewerModalBackdrop.addEventListener('click', (e) => {
                if (e.target === pdfViewerModalBackdrop)
                    closePdfViewer();
            });
        }
        document.addEventListener('click', (e) => {
            const btn = e.target?.closest('.btn-view-pdf-modal');
            if (btn) {
                e.preventDefault();
                const url = btn.getAttribute('data-url');
                const name = btn.getAttribute('data-name');
                if (url) {
                    openPdfViewer(url, name || 'Visualizar Documento');
                }
            }
        });
        loadDependencies();
        // Setup Rename Document Modal
        const renameModal = getById('renameDocumentModal');
        const renameForm = getById('renameDocumentForm');
        const renameInput = getById('renameDocumentInput');
        const closeRenameModalBtn = getById('closeRenameDocumentModal');
        const cancelRenameModalBtn = getById('btnCancelRenameDocument');
        const renameModalBackdrop = getById('renameDocumentModalBackdrop');
        const closeRenameModal = () => {
            renameModal?.classList.add('hidden');
            renameDocIdx = null;
        };
        closeRenameModalBtn?.addEventListener('click', closeRenameModal);
        cancelRenameModalBtn?.addEventListener('click', closeRenameModal);
        if (renameModalBackdrop) {
            renameModalBackdrop.addEventListener('click', (e) => {
                if (e.target === renameModalBackdrop)
                    closeRenameModal();
            });
        }
        renameForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (renameDocIdx === null || !renameInput || !renameEntityId)
                return;
            const newName = renameInput.value.trim();
            if (!newName) {
                alert('O nome do documento não pode ser vazio.');
                return;
            }
            const doc = renameDocsList[renameDocIdx];
            if (newName === doc.name) {
                closeRenameModal();
                return;
            }
            doc.name = newName;
            const submitBtn = renameForm.querySelector('button[type="submit"]');
            try {
                if (submitBtn)
                    submitBtn.disabled = true;
                await (window.api)(`/entities/customers/${renameEntityId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        cnpj_document_url: JSON.stringify(renameDocsList)
                    })
                });
                window.UI.showAlert('alertMessage', 'Documento renomeado com sucesso!', 'success');
                await customersManager.loadData();
                closeRenameModal();
                if (activeRenderDetailsDocsList) {
                    activeRenderDetailsDocsList();
                }
            }
            catch (err) {
                console.error('Erro ao renomear documento', err);
                alert(err.message || 'Erro ao renomear documento.');
            }
            finally {
                if (submitBtn)
                    submitBtn.disabled = false;
            }
        });
        // Setup Delete Document Modal
        const deleteModal = getById('deleteDocumentModal');
        const closeDeleteModalBtn = getById('closeRenameDocumentModal'); // Wait, let's make sure if there is a close button or use cancel
        const cancelDeleteModalBtn = getById('btnCancelDeleteDocument');
        const confirmDeleteModalBtn = getById('btnConfirmDeleteDocument');
        const deleteModalBackdrop = getById('deleteDocumentModalBackdrop');
        const closeDeleteModal = () => {
            deleteModal?.classList.add('hidden');
            deleteDocIdx = null;
        };
        cancelDeleteModalBtn?.addEventListener('click', closeDeleteModal);
        if (deleteModalBackdrop) {
            deleteModalBackdrop.addEventListener('click', (e) => {
                if (e.target === deleteModalBackdrop)
                    closeDeleteModal();
            });
        }
        confirmDeleteModalBtn?.addEventListener('click', async () => {
            if (deleteDocIdx === null || !deleteEntityId)
                return;
            deleteDocsList.splice(deleteDocIdx, 1);
            try {
                if (confirmDeleteModalBtn)
                    confirmDeleteModalBtn.disabled = true;
                await (window.api)(`/entities/customers/${deleteEntityId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        cnpj_document_url: JSON.stringify(deleteDocsList)
                    })
                });
                window.UI.showAlert('alertMessage', 'Documento excluído com sucesso!', 'success');
                await customersManager.loadData();
                closeDeleteModal();
                if (activeRenderDetailsDocsList) {
                    activeRenderDetailsDocsList();
                }
            }
            catch (err) {
                console.error('Erro ao excluir documento', err);
                alert(err.message || 'Erro ao excluir documento.');
            }
            finally {
                if (confirmDeleteModalBtn)
                    confirmDeleteModalBtn.disabled = false;
            }
        });
        let solidconFetchedPayload = null;
        const clearSolidconStatus = () => {
            const solidconImportStatus = getById('solidconCustomersStatus');
            if (solidconImportStatus) {
                solidconImportStatus.className = 'hidden mt-3 text-sm rounded-md px-3 py-2';
                solidconImportStatus.innerHTML = '';
            }
            const solidconImportDetails = getById('solidconCustomersDetails');
            if (solidconImportDetails) {
                solidconImportDetails.className = 'hidden mt-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-100';
                solidconImportDetails.innerHTML = '';
            }
        };
        const openSolidconCustomersModal = () => {
            const modal = getById('solidconCustomersModal');
            if (!modal)
                return;
            solidconFetchedPayload = null;
            clearSolidconStatus();
            const now = new Date();
            const tzOffset = now.getTimezoneOffset() * 60000;
            const firstDay = new Date(new Date(now.getFullYear(), now.getMonth(), 1).getTime() - tzOffset).toISOString().split('T')[0];
            const lastDay = new Date(new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime() - tzOffset).toISOString().split('T')[0];
            const startEl = getById('solidconStartDate');
            const endEl = getById('solidconEndDate');
            if (startEl && !startEl.value) {
                startEl.value = firstDay || '';
            }
            if (endEl && !endEl.value) {
                endEl.value = lastDay || '';
            }
            modal.classList.remove('hidden');
        };
        const closeSolidconCustomersModal = () => {
            getById('solidconCustomersModal')?.classList.add('hidden');
            solidconFetchedPayload = null;
            clearSolidconStatus();
        };
        getById('btnOpenSolidconCustomersModal')?.addEventListener('click', openSolidconCustomersModal);
        getById('btnCloseSolidconCustomersModal')?.addEventListener('click', closeSolidconCustomersModal);
        getById('btnCancelSolidconCustomersModal')?.addEventListener('click', closeSolidconCustomersModal);
        const solidconCustomersModalBackdrop = getById('solidconCustomersModalBackdrop');
        if (solidconCustomersModalBackdrop) {
            solidconCustomersModalBackdrop.addEventListener('click', (e) => {
                if (e.target === solidconCustomersModalBackdrop)
                    closeSolidconCustomersModal();
            });
        }
        (window.api)('/auth/me').then((res) => {
            const userGreeting = getById('userGreeting');
            if (userGreeting && res.data && res.data.user) {
                userGreeting.textContent = `Olá, ${res.data.user.full_name || 'Usuário'}`;
            }
            else if (userGreeting && res.data) {
                userGreeting.textContent = `Olá, ${res.data.full_name || 'Usuário'}`;
            }
            const company = res?.data?.company || res?.data?.user?.company || res?.data?.user?.company_info;
            if (company) {
                window.isGeneralAdminCompany = company.is_general_admin === true || company.is_general_admin === 1;
                window.currentSolidconUrls = [
                    company.solidcon_url_1 || '',
                    company.solidcon_url_2 || '',
                    company.solidcon_url_3 || '',
                    company.solidcon_url_4 || '',
                    company.solidcon_url_5 || '',
                ];
                const showSolidcon = company.show_solidcon !== false && company.show_solidcon !== 0;
                const btn = getById('btnOpenSolidconCustomersModal');
                if (btn) {
                    if (!showSolidcon) {
                        btn.classList.add('hidden');
                        btn.classList.remove('inline-flex');
                        btn.style.setProperty('display', 'none', 'important');
                    }
                    else {
                        btn.classList.remove('hidden');
                        btn.classList.add('inline-flex');
                        btn.style.display = '';
                    }
                }
            }
        }).catch(console.error);
        customersManager = new window.CrudManager({
            entityName: 'Cliente',
            endpoint: '/entities/customers',
            tableId: 'customersTable',
            gridSectionId: 'customersGridSection',
            tableSectionId: 'customersSection',
            modalId: 'entityModal',
            disableSummaryFooter: true,
            filterConfig: {
                storageKey: 'customers_filter_panel',
                fields: [
                    { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome, documento, email...' },
                    {
                        id: 'filterCustomerGroup',
                        type: 'select',
                        label: 'Grupo de Cliente',
                        options: [
                            { value: '', label: 'Todos' },
                            { value: 'none', label: 'Sem grupo' }
                        ]
                    },
                    {
                        id: 'filterActivityGroup',
                        type: 'select',
                        label: 'Grupo de Atividade',
                        options: [
                            { value: '', label: 'Todos' },
                            { value: 'none', label: 'Sem grupo de atividade' }
                        ]
                    },
                    {
                        id: 'filterTaxRegime',
                        type: 'select',
                        label: 'Regime Tributário',
                        options: [
                            { value: '', label: 'Todos' },
                            { value: 'none', label: 'Não informado' },
                            { value: 'Pessoa Física', label: 'Pessoa Física' },
                            { value: 'Simples Nacional', label: 'Simples Nacional' },
                            { value: 'MEI', label: 'MEI' },
                            { value: 'Lucro Presumido', label: 'Lucro Presumido' },
                            { value: 'Lucro Real', label: 'Lucro Real' },
                            { value: 'Outros / Isento', label: 'Outros / Isento' }
                        ]
                    },
                    {
                        id: 'filterOnlyPix',
                        type: 'select',
                        label: 'Emissão Boleto / PIX',
                        options: [
                            { value: '', label: 'Todos' },
                            { value: 'only_pix', label: 'Somente PIX (Travados)' },
                            { value: 'boleto_allowed', label: 'Boleto Liberado' }
                        ]
                    },
                    {
                        id: 'filterOnlySolidconBaixa',
                        type: 'select',
                        label: 'Baixa Solidcon / Keystone',
                        options: [
                            { value: '', label: 'Todos' },
                            { value: 'only_solidcon_baixa', label: 'Baixa Exclusiva Solidcon' },
                            { value: 'keystone_baixa_allowed', label: 'Baixa Keystone Liberada' }
                        ]
                    },
                    {
                        id: 'filterExemptInterestFine',
                        type: 'select',
                        label: 'Isenção Juros / Multa',
                        options: [
                            { value: '', label: 'Todos' },
                            { value: 'exempt', label: 'Isentos de Juros e Multa' },
                            { value: 'not_exempt', label: 'Cobrança Normal' }
                        ]
                    },
                    {
                        id: 'filterIsCompany',
                        type: 'select',
                        label: 'Empresa Vinculada',
                        options: [
                            { value: '', label: 'Todos' },
                            { value: 'company', label: 'Cadastrado como Empresa' },
                            { value: 'not_company', label: 'Apenas Clientes (Não Empresa)' }
                        ]
                    },
                    {
                        id: 'filterSortOrder',
                        type: 'select',
                        label: 'Ordenar Por',
                        options: [
                            { value: 'name', label: 'Nome' },
                            { value: 'tax_regime', label: 'Regime Tributário' },
                            { value: 'customer_group', label: 'Grupo de Cliente' }
                        ]
                    }
                ]
            },
            applyFilters: (data) => {
                const filterPanel = window.FilterPanel;
                const normalizeText = typeof filterPanel?.normalizeText === 'function'
                    ? filterPanel.normalizeText
                    : (value) => String(value || '').trim().toLowerCase();
                const onlyDigitsFn = typeof filterPanel?.onlyDigits === 'function'
                    ? filterPanel.onlyDigits
                    : onlyDigits;
                const matchesSearch = typeof filterPanel?.matchesSearch === 'function'
                    ? filterPanel.matchesSearch
                    : (item, fields, term) => fields.some((field) => normalizeText(item?.[field]).includes(term));
                const search = normalizeText(getById('filterSearch')?.value);
                const searchDigits = onlyDigitsFn(search);
                const groupFilter = getById('filterCustomerGroup')?.value;
                const activityGroupFilter = getById('filterActivityGroup')?.value;
                const taxRegimeFilter = getById('filterTaxRegime')?.value;
                const filtered = data.filter((item) => {
                    if (groupFilter) {
                        if (groupFilter === 'none') {
                            if (item.customer_group_public_id)
                                return false;
                        }
                        else {
                            if (item.customer_group_public_id !== groupFilter)
                                return false;
                        }
                    }
                    if (activityGroupFilter) {
                        if (activityGroupFilter === 'none') {
                            if (item.activity_groups && item.activity_groups.length > 0)
                                return false;
                        }
                        else {
                            const hasActivity = item.activity_groups && item.activity_groups.some((ag) => ag.public_id === activityGroupFilter);
                            if (!hasActivity)
                                return false;
                        }
                    }
                    if (taxRegimeFilter) {
                        if (taxRegimeFilter === 'none') {
                            if (item.tax_regime)
                                return false;
                        }
                        else {
                            if (item.tax_regime !== taxRegimeFilter)
                                return false;
                        }
                    }
                    const isCompanyFilter = getById('filterIsCompany')?.value;
                    if (isCompanyFilter) {
                        const isCompany = item.is_registered_as_company === 1 || item.is_registered_as_company === true || Boolean(item.registered_company_id) || Boolean(item.registered_company_name);
                        if (isCompanyFilter === 'company' && !isCompany)
                            return false;
                        if (isCompanyFilter === 'not_company' && isCompany)
                            return false;
                    }
                    const onlyPixFilter = getById('filterOnlyPix')?.value;
                    if (onlyPixFilter) {
                        const isOnlyPix = item.only_pix === 1 || item.only_pix === true;
                        if (onlyPixFilter === 'only_pix' && !isOnlyPix)
                            return false;
                        if (onlyPixFilter === 'boleto_allowed' && isOnlyPix)
                            return false;
                    }
                    const onlySolidconBaixaFilter = getById('filterOnlySolidconBaixa')?.value;
                    if (onlySolidconBaixaFilter) {
                        const isOnlySolidconBaixa = item.only_solidcon_baixa === 1 || item.only_solidcon_baixa === true;
                        if (onlySolidconBaixaFilter === 'only_solidcon_baixa' && !isOnlySolidconBaixa)
                            return false;
                        if (onlySolidconBaixaFilter === 'keystone_baixa_allowed' && isOnlySolidconBaixa)
                            return false;
                    }
                    const exemptInterestFineFilter = getById('filterExemptInterestFine')?.value;
                    if (exemptInterestFineFilter) {
                        const isExempt = item.exempt_interest_fine === 1 || item.exempt_interest_fine === true;
                        if (exemptInterestFineFilter === 'exempt' && !isExempt)
                            return false;
                        if (exemptInterestFineFilter === 'not_exempt' && isExempt)
                            return false;
                    }
                    if (!search)
                        return true;
                    if (matchesSearch(item, ['name', 'email', 'cnpj_cpf', 'phone', 'city', 'state', 'seller_name'], search))
                        return true;
                    if (!searchDigits)
                        return false;
                    return [item.cnpj_cpf, item.phone]
                        .map((value) => onlyDigitsFn(value))
                        .some((value) => value.includes(searchDigits));
                });
                const sortOrder = getById('filterSortOrder')?.value || 'name';
                filtered.sort((a, b) => {
                    if (sortOrder === 'tax_regime') {
                        const regA = a.tax_regime || '';
                        const regB = b.tax_regime || '';
                        if (regA !== regB)
                            return regA.localeCompare(regB, 'pt-BR');
                    }
                    else if (sortOrder === 'customer_group') {
                        const grpA = a.customer_group_name || '';
                        const grpB = b.customer_group_name || '';
                        if (grpA !== grpB)
                            return grpA.localeCompare(grpB, 'pt-BR');
                    }
                    const nameA = a.name || '';
                    const nameB = b.name || '';
                    return nameA.localeCompare(nameB, 'pt-BR');
                });
                window.GridSummaryFooter?.update({
                    footerId: 'customersResultsFooter',
                    anchorId: 'customersGridSection',
                    count: filtered.length,
                    label: 'cliente(s) exibido(s)'
                });
                return filtered;
            },
            renderTable: (items) => {
                const tbody = getById('customersTable');
                if (items.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum cliente encontrado.</td></tr>';
                    return;
                }
                tbody.innerHTML = items.map((item, index) => `
                <tr>
                    <td class="px-3 py-4 whitespace-nowrap text-left w-12">
                        <input type="checkbox" value="${item.public_id}" class="item-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" data-bwignore="true" data-lpignore="true" placeholder="">
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <div class="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5 flex-wrap">
                            <span>${item.name}</span>
                            <span class="text-[10px] font-mono bg-gray-100 text-gray-600 dark:bg-slate-700/60 dark:text-gray-300 px-1.5 py-0.5 rounded">ID: ${item.public_id}</span>
                            ${getIsCompanyBadge(item)}
                            ${(item.only_pix === 1 || item.only_pix === true) ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 gap-1" title="Emissão de boleto travada (Somente PIX)"><svg class="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>Somente PIX</span>` : ''}
                            ${(item.only_solidcon_baixa === 1 || item.only_solidcon_baixa === true) ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 gap-1" title="Baixa manual no Keystone travada (Exclusiva Solidcon)"><svg class="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>Baixa Solidcon</span>` : ''}
                            ${(item.exempt_interest_fine === 1 || item.exempt_interest_fine === true) ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 gap-1" title="Cliente isento de cobrança de juros e multa"><svg class="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Isento Juros/Multa</span>` : ''}
                            ${(item.hide_in_revenues_grid === 1 || item.hide_in_revenues_grid === true) ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 gap-1" title="Cliente oculto no grid de receitas (revenues.html)"><svg class="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>Oculto no Grid Receita</span>` : ''}
                            ${item.customer_group_name ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">${item.customer_group_name}</span>` : ''}
                            ${(item.activity_groups || []).map((ag) => `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">${ag.name}</span>`).join('')}
                        </div>
                        ${item.trade_name ? `<div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">${item.trade_name}</div>` : ''}
                        <div class="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5 flex flex-wrap items-center gap-x-2">
                            <span>${formatDoc(item.cnpj_cpf) || '-'}</span>
                            ${item.inscricao_estadual ? `<span class="text-[11px] text-gray-400 dark:text-gray-500">| IE: ${item.inscricao_estadual}</span>` : ''}
                            ${item.inscricao_municipal ? `<span class="text-[11px] text-gray-400 dark:text-gray-500">| IM: ${item.inscricao_municipal}</span>` : ''}
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div class="block w-56 max-w-full truncate" title="${item.email || ''}">${item.email || '-'}</div>
                        <div>${formatPhone(item.phone)}</div>
                        ${item.phone_landline ? `<div class="text-xs text-gray-400 font-sans mt-0.5" title="Telefone Fixo">${formatPhone(item.phone_landline)} (Fixo)</div>` : ''}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center">
                        <div class="flex flex-col gap-1 items-center justify-center">
                            ${getTaxRegimeBadge(item.tax_regime)}
                            <div class="flex items-center gap-1.5 justify-center">
                                ${getDocCountBadge(item.cnpj_document_url)}
                                ${getNotesCountBadge(item.notes_count)}
                                ${getTasksCountBadge(item.tasks_count)}
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button type="button" title="Visualizar" class="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400 mr-2 view-details-btn" data-id="${item.public_id}" data-name="${item.name}">
                            <svg class="w-5 h-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </button>
                        <button type="button" title="Editar" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-2 edit-btn" data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}'>
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button type="button" title="Excluir" class="text-red-500 hover:text-red-700 dark:hover:text-red-400 delete-btn" data-id="${item.public_id}">
                             <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </td>
                </tr>
            `).join('');
            },
            renderGrid: (items) => {
                const grid = getById('customersGridSection');
                if (!grid)
                    return;
                if (items.length === 0) {
                    grid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-12 gap-2">
                    <svg class="w-10 h-10 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <p class="text-sm text-gray-400 dark:text-gray-500">Nenhum cliente encontrado.</p>
                </div>`;
                    return;
                }
                grid.innerHTML = items.map((item, index) => `
                <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col relative border border-gray-100 dark:border-slate-700 group">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex items-center pt-1 z-10">
                            <input type="checkbox" value="${item.public_id}" class="item-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" data-bwignore="true" data-lpignore="true" placeholder="">
                            <span class="ml-2 text-xs font-mono font-medium text-gray-500 dark:text-gray-400">#${String(index + 1).padStart(4, '0')}</span>
                        </div>

                        <div class="flex space-x-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10 -mr-1 -mt-1">
                            <button class="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 bg-gray-50 hover:bg-blue-50 dark:bg-slate-700 dark:hover:bg-blue-900/30 rounded view-details-btn" data-id="${item.public_id}" data-name="${item.name}" title="Visualizar">
                                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            </button>
                            <button class="p-1.5 text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400 bg-gray-50 hover:bg-brand-50 dark:bg-slate-700 dark:hover:bg-brand-900/30 rounded edit-btn" data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}' title="Editar">
                                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button class="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 bg-gray-50 hover:bg-red-50 dark:bg-slate-700 dark:hover:bg-red-900/30 rounded delete-btn" data-id="${item.public_id}" title="Excluir">
                                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    </div>

                    <div class="flex-1 mt-0">
                        <div class="flex justify-between items-start gap-2">
                            <h4 class="text-[16px] font-bold text-gray-900 dark:text-gray-100 leading-tight mb-2 wrap-break-word flex-1 flex items-center gap-1.5 flex-wrap" title="${item.name}">
                                <span>${item.name}</span>
                                <span class="text-[10px] font-mono font-normal bg-gray-100 text-gray-600 dark:bg-slate-700/60 dark:text-gray-300 px-1.5 py-0.5 rounded">ID: ${item.public_id}</span>
                                ${getIsCompanyBadge(item)}
                                ${(item.only_pix === 1 || item.only_pix === true) ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 gap-1" title="Emissão de boleto travada (Somente PIX)"><svg class="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>Somente PIX</span>` : ''}
                                ${(item.only_solidcon_baixa === 1 || item.only_solidcon_baixa === true) ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 gap-1" title="Baixa manual no Keystone travada (Exclusiva Solidcon)"><svg class="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>Baixa Solidcon</span>` : ''}
                                ${(item.exempt_interest_fine === 1 || item.exempt_interest_fine === true) ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 gap-1" title="Cliente isento de cobrança de juros e multa"><svg class="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Isento Juros/Multa</span>` : ''}
                                ${(item.hide_in_revenues_grid === 1 || item.hide_in_revenues_grid === true) ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 gap-1" title="Cliente oculto no grid de receitas (revenues.html)"><svg class="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>Oculto no Grid Receita</span>` : ''}
                            </h4>
                        </div>
                        ${item.trade_name ? `<div class="text-xs text-gray-600 dark:text-gray-400 font-semibold mb-2">${item.trade_name}</div>` : ''}
                        <div class="flex flex-wrap items-center gap-2 mb-4">
                            <div class="flex items-center gap-1.5 text-xs font-mono text-gray-500">
                                <span>${formatDoc(item.cnpj_cpf) || 'S/ Documento'}</span>
                                ${item.inscricao_estadual ? `<span class="text-[10px] font-normal text-gray-600 bg-gray-100 dark:bg-slate-700/60 dark:text-gray-300 px-1.5 py-0.5 rounded">IE: ${item.inscricao_estadual}</span>` : ''}
                            </div>
                            ${item.inscricao_municipal ? `<div class="text-[10px] font-mono text-gray-600 bg-gray-100 dark:bg-slate-700/60 dark:text-gray-300 px-1.5 py-0.5 rounded">IM: ${item.inscricao_municipal}</div>` : ''}
                            ${item.tax_regime ? `<div>${getTaxRegimeBadge(item.tax_regime)}</div>` : ''}
                            <div>${getDocCountBadge(item.cnpj_document_url)}</div>
                            <div>${getNotesCountBadge(item.notes_count)}</div>
                            <div>${getTasksCountBadge(item.tasks_count)}</div>
                        </div>

                        <div class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                            ${item.email ? `<div class="flex items-center gap-2">
                                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                <span class="truncate">${item.email}</span>
                            </div>` : ''}
                            ${item.phone ? `<div class="flex items-center gap-2">
                                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                <span>${formatPhone(item.phone)}</span>
                            </div>` : ''}
                            ${item.phone_landline ? `<div class="flex items-center gap-2 text-xs text-gray-500">
                                <svg class="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                <span>${formatPhone(item.phone_landline)} (Fixo)</span>
                            </div>` : ''}
                            <div class="flex items-center gap-2">
                                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5V4H2v16h5m10 0v-2a4 4 0 00-8 0v2m8 0H9m8 0H9m4-9a4 4 0 100-8 4 4 0 000 8z"></path></svg>
                                <span class="truncate">${item.seller_name || 'S/ Vendedor'}</span>
                            </div>
                            <div class="flex items-center gap-2" title="Grupo do Cliente">
                                <svg class="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                                <span class="truncate font-medium text-blue-600 dark:text-blue-400">${item.customer_group_name || 'Sem Grupo'}</span>
                            </div>
                            <div class="flex items-center gap-2 flex-wrap" title="Grupo de Atividade">
                                <svg class="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                <span class="truncate font-medium text-emerald-600 dark:text-emerald-400">
                                    ${item.activity_groups && item.activity_groups.length > 0
                    ? item.activity_groups.map((ag) => ag.name).join(', ')
                    : 'Sem Atividades'}
                                </span>
                            </div>
                            ${item.contact ? `<div class="flex items-center gap-2" title="Contato">
                                <svg class="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                <span class="truncate font-medium">${item.contact}</span>
                            </div>` : ''}
                            <div class="flex items-center gap-2 text-xs text-gray-500" title="Data de Cadastro">
                                <svg class="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                <span>Cadastrado em: ${item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : 'S/ Data'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
            },
            onEdit: (data) => {
                customCompanyUser = null;
                getById('entityForm')?.reset();
                resetCustomerModalTabs();
                const customerIdInput = getById('customerId');
                const modalTitle = getById('modalTitle');
                const certFileInput = getById('customerCertFile');
                const docSavedIndicator = getById('docSavedIndicator');
                const registerAsCompanyWrapper = getById('registerAsCompanyWrapper');
                const registerAsCompanyCheckbox = getById('customerRegisterAsCompany');
                if (data && data.public_id) {
                    modalTitle.textContent = 'Editar Cliente';
                    customerIdInput.value = data.public_id || '';
                    getById('customerName').value = data.name || '';
                    getById('customerContact').value = data.contact || '';
                    const createdAtInput = getById('customerCreatedAt');
                    const createdAtWrapper = getById('customerCreatedAtWrapper');
                    if (createdAtInput && data.created_at) {
                        createdAtInput.value = new Date(data.created_at).toLocaleString('pt-BR');
                        createdAtWrapper?.classList.remove('hidden');
                    }
                    else {
                        createdAtWrapper?.classList.add('hidden');
                    }
                    getById('customerEmail').value = data.email || '';
                    getById('customerStreet').value = data.street || '';
                    getById('customerNumber').value = data.number || '';
                    getById('customerComplement').value = data.complement || '';
                    getById('customerNeighborhood').value = data.neighborhood || '';
                    getById('customerCity').value = data.city || '';
                    getById('customerCdMunicipio').value = data.cd_municipio || '';
                    if (getById('customerTaxRegime'))
                        getById('customerTaxRegime').value = data.tax_regime || '';
                    if (getById('customerOpeningDate'))
                        getById('customerOpeningDate').value = data.opening_date ? data.opening_date.split('T')[0] : '';
                    if (getById('customerTradeName'))
                        getById('customerTradeName').value = data.trade_name || '';
                    getById('customerCertPassword').value = data.certificate_password || '';
                    getById('customerCertExpiration').value = data.certificate_expiration ? data.certificate_expiration.split('T')[0] : '';
                    getById('customerDueDay').value = data.vencimento_dia ?? '';
                    getById('customerCreditLimit').value = data.limite ?? '';
                    if (getById('customerOnlyPix'))
                        getById('customerOnlyPix').checked = data.only_pix === 1 || data.only_pix === true;
                    if (getById('customerOnlySolidconBaixa'))
                        getById('customerOnlySolidconBaixa').checked = data.only_solidcon_baixa === 1 || data.only_solidcon_baixa === true;
                    if (getById('customerExemptInterestFine'))
                        getById('customerExemptInterestFine').checked = data.exempt_interest_fine === 1 || data.exempt_interest_fine === true;
                    if (getById('customerHideInRevenues'))
                        getById('customerHideInRevenues').checked = data.hide_in_revenues_grid === 1 || data.hide_in_revenues_grid === true;
                    if (getById('customerDiscountValue'))
                        getById('customerDiscountValue').value = data.discount_value ?? '';
                    if (getById('customerDiscountType'))
                        getById('customerDiscountType').value = data.discount_type || 'percentage';
                    if (getById('customerInscricaoEstadual'))
                        getById('customerInscricaoEstadual').value = data.inscricao_estadual || '';
                    if (getById('customerInscricaoMunicipal'))
                        getById('customerInscricaoMunicipal').value = data.inscricao_municipal || '';
                    setMaskedValue(customerDocMask, 'customerDocument', data.cnpj_cpf || '');
                    setMaskedValue(customerPhoneMask, 'customerPhone', data.phone || '');
                    setMaskedValue(customerPhoneLandlineMask, 'customerPhoneLandline', data.phone_landline || '');
                    setMaskedValue(customerZipMask, 'customerZipcode', data.zipcode || '');
                    const selectedActivities = (data.activity_groups || []).map((ag) => ag.public_id);
                    loadDependencies(data.state || '', data.seller_public_id || '', data.customer_group_public_id || '', selectedActivities);
                    if (data.certificate_url) {
                        if (certFileInput)
                            certFileInput.dataset.hasDoc = 'true';
                    }
                    else {
                        if (certFileInput)
                            certFileInput.dataset.hasDoc = 'false';
                    }
                    if (registerAsCompanyCheckbox) {
                        registerAsCompanyCheckbox.checked = false;
                        registerAsCompanyCheckbox.disabled = false;
                    }
                    if (registerAsCompanyWrapper && window.isGeneralAdminCompany) {
                        registerAsCompanyWrapper.classList.remove('hidden');
                        if (data.cnpj_cpf) {
                            checkCompanyCnpj(data.cnpj_cpf);
                        }
                    }
                    else if (registerAsCompanyWrapper) {
                        registerAsCompanyWrapper.classList.add('hidden');
                    }
                }
                else {
                    modalTitle.textContent = 'Novo Cliente';
                    customerIdInput.value = '';
                    getById('customerContact').value = '';
                    const createdAtWrapper = getById('customerCreatedAtWrapper');
                    if (createdAtWrapper) {
                        createdAtWrapper.classList.add('hidden');
                    }
                    if (getById('customerTradeName'))
                        getById('customerTradeName').value = '';
                    if (getById('customerInscricaoEstadual'))
                        getById('customerInscricaoEstadual').value = '';
                    if (getById('customerInscricaoMunicipal'))
                        getById('customerInscricaoMunicipal').value = '';
                    if (getById('customerOnlyPix'))
                        getById('customerOnlyPix').checked = false;
                    if (getById('customerOnlySolidconBaixa'))
                        getById('customerOnlySolidconBaixa').checked = false;
                    if (getById('customerExemptInterestFine'))
                        getById('customerExemptInterestFine').checked = false;
                    if (getById('customerHideInRevenues'))
                        getById('customerHideInRevenues').checked = false;
                    setMaskedValue(customerDocMask, 'customerDocument', '');
                    setMaskedValue(customerPhoneMask, 'customerPhone', '');
                    setMaskedValue(customerPhoneLandlineMask, 'customerPhoneLandline', '');
                    setMaskedValue(customerZipMask, 'customerZipcode', '');
                    loadDependencies('', '', '', []);
                    if (certFileInput)
                        certFileInput.dataset.hasDoc = 'false';
                    if (registerAsCompanyCheckbox) {
                        registerAsCompanyCheckbox.checked = false;
                        registerAsCompanyCheckbox.disabled = false;
                    }
                    if (registerAsCompanyWrapper && window.isGeneralAdminCompany) {
                        registerAsCompanyWrapper.classList.remove('hidden');
                    }
                    else if (registerAsCompanyWrapper) {
                        registerAsCompanyWrapper.classList.add('hidden');
                    }
                }
                // Clear File inputs
                if (certFileInput)
                    certFileInput.value = '';
                getById('entityModal').classList.remove('hidden');
            }
        });
        customersManager.init();
        applyCustomerPrefillFromQuery();
        const solidconUrlSelect = getById('solidconCustomerUrlSelect');
        const solidconJsonInput = getById('solidconCustomersJsonInput');
        const btnFetchSolidconJson = getById('btnFetchSolidconCustomers');
        const solidconImportForm = getById('solidconCustomersImportForm');
        const solidconConnectionType = getById('solidconConnectionType');
        const solidconCustomerUrlContainer = getById('solidconCustomerUrlContainer');
        if (solidconConnectionType && solidconCustomerUrlContainer) {
            solidconConnectionType.addEventListener('change', () => {
                if (solidconConnectionType.value === 'api') {
                    solidconCustomerUrlContainer.classList.remove('hidden');
                }
                else {
                    solidconCustomerUrlContainer.classList.add('hidden');
                }
            });
        }
        const setSolidconStatus = (message, type = 'info') => {
            const solidconImportStatus = getById('solidconCustomersStatus');
            if (!solidconImportStatus)
                return;
            clearSolidconStatus();
            let bgClass = '';
            if (type === 'success') {
                bgClass = 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/30';
            }
            else if (type === 'error') {
                bgClass = 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/30';
            }
            else if (type === 'warning') {
                bgClass = 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/30';
            }
            else {
                bgClass = 'bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900/30';
            }
            solidconImportStatus.className = `mt-3 text-sm rounded-md px-3 py-2 ${bgClass}`;
            solidconImportStatus.textContent = message;
            solidconImportStatus.classList.remove('hidden');
        };
        const showSolidconIgnoredDetails = (errors) => {
            const solidconImportDetails = getById('solidconCustomersDetails');
            if (!solidconImportDetails || !errors || !errors.length)
                return;
            const reasonsMap = new Map();
            errors.forEach((item) => {
                const key = String(item?.reason || 'Motivo não informado').trim();
                reasonsMap.set(key, (reasonsMap.get(key) || 0) + 1);
            });
            const reasonSummary = Array.from(reasonsMap.entries())
                .map(([reason, count]) => `• ${reason}: <strong>${count}</strong> item(ns)`)
                .join('<br>');
            const examples = errors.slice(0, 20)
                .map((item) => `Item #${Number(item?.index || 0) + 1}: ${item?.reason || 'Motivo não informado.'}`)
                .join('<br>');
            solidconImportDetails.innerHTML = `<div class="font-semibold">Por que foi ignorado</div><div class="mt-1">${reasonSummary}</div><div class="mt-2 font-semibold">Exemplos</div><div class="mt-1">${examples}${errors.length > 20 ? `<br>... mais ${errors.length - 20} item(ns)` : ''}</div>`;
            solidconImportDetails.classList.remove('hidden');
        };
        const getSelectedSolidconUrl = () => {
            const index = Number(solidconUrlSelect?.value || 1) - 1;
            const urls = window.currentSolidconUrls || [];
            return urls[index] || urls.find((url) => String(url || '').trim()) || '';
        };
        if (btnFetchSolidconJson) {
            btnFetchSolidconJson.addEventListener('click', async () => {
                clearSolidconStatus();
                const connectionType = solidconConnectionType?.value || 'api';
                const startVal = getById('solidconStartDate')?.value;
                const endVal = getById('solidconEndDate')?.value;
                if (!startVal || !endVal) {
                    setSolidconStatus('Preencha as datas Inicial e Final.', 'warning');
                    return;
                }
                btnFetchSolidconJson.disabled = true;
                const originalHtml = btnFetchSolidconJson.innerHTML;
                btnFetchSolidconJson.textContent = 'Consultando...';
                const reqBody = {
                    connectionType,
                    startDate: startVal,
                    endDate: endVal,
                    target: 'customers'
                };
                if (connectionType === 'api') {
                    const url = getSelectedSolidconUrl();
                    if (!url) {
                        setSolidconStatus('URL Solidcon não configurada. Salve na tela Minha Empresa > API/Solidcon.', 'warning');
                        btnFetchSolidconJson.innerHTML = originalHtml;
                        btnFetchSolidconJson.disabled = false;
                        return;
                    }
                    let fullUrl = url;
                    try {
                        const urlObj = new URL(url);
                        urlObj.searchParams.set('dataInicial', startVal);
                        urlObj.searchParams.set('dataFinal', endVal);
                        fullUrl = urlObj.toString();
                    }
                    catch {
                        const separator = url.includes('?') ? '&' : '?';
                        fullUrl = `${url}${separator}dataInicial=${startVal}&dataFinal=${endVal}`;
                    }
                    reqBody.url = fullUrl;
                }
                try {
                    const response = await (window.api)('/companies/proxy-consulta', {
                        method: 'POST',
                        body: JSON.stringify(reqBody)
                    });
                    const payload = response?.data ?? response;
                    solidconFetchedPayload = payload;
                    if (solidconJsonInput) {
                        solidconJsonInput.value = JSON.stringify(payload, null, 2);
                    }
                    const items = Array.isArray(payload)
                        ? payload
                        : (payload?.data || payload?.items || payload?.rows || payload?.customers || payload?.clientes || []);
                    const count = Array.isArray(items) ? items.length : 0;
                    setSolidconStatus(`Dados carregados com sucesso (${count} registros). Clique em "Importar" para salvar.`, 'success');
                }
                catch (err) {
                    const msg = String(err?.message || '').trim();
                    if (msg.toLowerCase().includes('fora') ||
                        msg.toLowerCase().includes('timeout') ||
                        msg.toLowerCase().includes('failed to connect') ||
                        msg.toLowerCase().includes('inacessivel') ||
                        msg.toLowerCase().includes('inacessível') ||
                        msg.toLowerCase().includes('conexão') ||
                        msg.toLowerCase().includes('conexao') ||
                        msg.toLowerCase().includes('refused') ||
                        msg.toLowerCase().includes('network') ||
                        msg.toLowerCase().includes('fetch failed')) {
                        setSolidconStatus(msg || 'Não foi possível conectar ao banco de dados Solidcon. O servidor está fora do ar ou inacessível no momento.', 'error');
                    }
                    else {
                        setSolidconStatus(msg || 'Não foi possível conectar ao banco de dados Solidcon. O servidor está fora do ar.', 'error');
                    }
                }
                finally {
                    btnFetchSolidconJson.innerHTML = originalHtml;
                    btnFetchSolidconJson.disabled = false;
                }
            });
        }
        if (solidconImportForm) {
            solidconImportForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                clearSolidconStatus();
                let payloadToImport = solidconFetchedPayload;
                if (!payloadToImport && solidconJsonInput) {
                    const raw = String(solidconJsonInput.value || '').trim();
                    if (raw) {
                        try {
                            payloadToImport = JSON.parse(raw);
                        }
                        catch (_err) {
                            setSolidconStatus('JSON inválido na opção manual. Verifique a formatação.', 'error');
                            return;
                        }
                    }
                }
                if (!payloadToImport) {
                    setSolidconStatus('Nenhum dado carregado. Por favor, clique em "Consulta" antes de importar.', 'warning');
                    return;
                }
                const submitBtn = getById('btnImportSolidconCustomers');
                const cancelBtn = getById('btnCancelSolidconCustomersModal');
                const closeBtn = getById('btnCloseSolidconCustomersModal');
                if (submitBtn)
                    submitBtn.disabled = true;
                if (cancelBtn)
                    cancelBtn.disabled = true;
                if (closeBtn)
                    closeBtn.disabled = true;
                const originalBtnText = submitBtn ? submitBtn.textContent : 'Importar';
                if (submitBtn)
                    submitBtn.textContent = 'Importando...';
                try {
                    const result = await (window.api)('/entities/customers/solidcon-import', {
                        method: 'POST',
                        body: JSON.stringify({ payload: payloadToImport })
                    });
                    const data = result?.data || {};
                    const created = data.created ?? 0;
                    const updated = data.updated ?? 0;
                    const skipped = data.skipped ?? 0;
                    const errors = Array.isArray(data.errors) ? data.errors : [];
                    setSolidconStatus(`Importação concluída: ${created} novos, ${updated} atualizados, ${skipped} ignorados.`, created || updated ? 'success' : 'warning');
                    showSolidconIgnoredDetails(errors);
                    await customersManager.loadData();
                }
                catch (err) {
                    setSolidconStatus(err.message || 'Erro ao importar clientes da Solidcon.', 'error');
                }
                finally {
                    if (submitBtn) {
                        submitBtn.textContent = originalBtnText;
                        submitBtn.disabled = false;
                    }
                    if (cancelBtn)
                        cancelBtn.disabled = false;
                    if (closeBtn)
                        closeBtn.disabled = false;
                }
            });
        }
        // ==========================================
        // Bulk Update Customers Logic
        // ==========================================
        const btnBulkUpdateCustomers = getById('btnBulkUpdateCustomers');
        const bulkUpdateCustomersModal = getById('bulkUpdateCustomersModal');
        const btnCloseBulkUpdateModal = getById('btnCloseBulkUpdateModal');
        const btnCancelBulkUpdateModal = getById('btnCancelBulkUpdateModal');
        const bulkUpdateModalBackdrop = getById('bulkUpdateModalBackdrop');
        const bulkUpdateCustomersForm = getById('bulkUpdateCustomersForm');
        const closeBulkUpdateModal = () => {
            bulkUpdateCustomersModal?.classList.add('hidden');
        };
        if (btnBulkUpdateCustomers) {
            btnBulkUpdateCustomers.addEventListener('click', () => {
                const checkedBoxes = document.querySelectorAll('.item-checkbox:checked');
                const count = checkedBoxes.length;
                if (count === 0)
                    return;
                if (bulkUpdateCustomersForm) {
                    bulkUpdateCustomersForm.reset();
                }
                // Populate Sellers dropdown in Bulk Modal
                const bulkSellerSelect = getById('bulkCustomerSellerParam');
                if (bulkSellerSelect) {
                    bulkSellerSelect.innerHTML = [
                        '<option value="">Não alterar</option>',
                        '<option value="clear">Remover vendedor (Nenhum)</option>',
                        ...allSellers.map(s => `<option value="${s.public_id}">${s.full_name}</option>`)
                    ].join('');
                    bulkSellerSelect.value = '';
                }
                // Populate Customer Groups dropdown in Bulk Modal
                const bulkGroupSelect = getById('bulkCustomerGroupParam');
                if (bulkGroupSelect) {
                    bulkGroupSelect.innerHTML = [
                        '<option value="">Não alterar</option>',
                        '<option value="clear">Remover grupo (Nenhum)</option>',
                        ...allCustomerGroups.map(g => `<option value="${g.public_id}">${g.name}</option>`)
                    ].join('');
                    bulkGroupSelect.value = '';
                }
                const countSpan = getById('bulkModalCustomersCount');
                if (countSpan)
                    countSpan.textContent = String(count);
                bulkUpdateCustomersModal?.classList.remove('hidden');
            });
        }
        btnCloseBulkUpdateModal?.addEventListener('click', closeBulkUpdateModal);
        btnCancelBulkUpdateModal?.addEventListener('click', closeBulkUpdateModal);
        bulkUpdateModalBackdrop?.addEventListener('click', (e) => {
            if (e.target === bulkUpdateModalBackdrop)
                closeBulkUpdateModal();
        });
        const btnBulkDeleteCustomers = getById('btnBulkDeleteCustomers');
        if (btnBulkDeleteCustomers) {
            btnBulkDeleteCustomers.addEventListener('click', async () => {
                const checkedBoxes = document.querySelectorAll('.item-checkbox:checked');
                const count = checkedBoxes.length;
                if (count === 0)
                    return;
                const confirmMsg = count === 1
                    ? 'Deseja realmente excluir o cliente selecionado?'
                    : `Deseja realmente excluir os ${count} clientes selecionados?`;
                if (!confirm(confirmMsg))
                    return;
                const customerIds = Array.from(checkedBoxes).map((cb) => cb.value);
                btnBulkDeleteCustomers.disabled = true;
                const originalText = btnBulkDeleteCustomers.innerHTML;
                btnBulkDeleteCustomers.textContent = 'Excluindo...';
                try {
                    const response = await (window.api)('/entities/customers/bulk-delete', {
                        method: 'POST',
                        body: JSON.stringify({ customerIds })
                    });
                    window.UI.showAlert('alertMessage', response.message || 'Clientes excluídos com sucesso!', 'success');
                    // Uncheck selectAll and all item checkboxes
                    const selectAll = getById('selectAll');
                    if (selectAll)
                        selectAll.checked = false;
                    document.querySelectorAll('.item-checkbox').forEach(cb => cb.checked = false);
                    // Update bulk buttons visibility
                    updateBulkButtonsVisibility();
                    await customersManager.loadData();
                }
                catch (error) {
                    alert(error.message || 'Erro ao excluir clientes.');
                }
                finally {
                    btnBulkDeleteCustomers.disabled = false;
                    btnBulkDeleteCustomers.innerHTML = originalText;
                }
            });
        }
        if (bulkUpdateCustomersForm) {
            bulkUpdateCustomersForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const checkedBoxes = document.querySelectorAll('.item-checkbox:checked');
                const customerIds = Array.from(checkedBoxes).map((cb) => cb.value);
                if (customerIds.length === 0)
                    return;
                const sellerVal = getById('bulkCustomerSellerParam')?.value;
                const groupVal = getById('bulkCustomerGroupParam')?.value;
                const dueDayVal = getById('bulkCustomerDueDay')?.value;
                const creditLimitVal = getById('bulkCustomerCreditLimit')?.value;
                const onlyPixVal = getById('bulkCustomerOnlyPix')?.value;
                const onlySolidconBaixaVal = getById('bulkCustomerOnlySolidconBaixa')?.value;
                const exemptInterestFineVal = getById('bulkCustomerExemptInterestFine')?.value;
                const payload = {
                    customerIds
                };
                if (sellerVal === 'clear') {
                    payload.seller_public_id = null;
                }
                else if (sellerVal) {
                    payload.seller_public_id = sellerVal;
                }
                if (groupVal === 'clear') {
                    payload.customer_group_public_id = null;
                }
                else if (groupVal) {
                    payload.customer_group_public_id = groupVal;
                }
                if (dueDayVal !== '') {
                    payload.vencimento_dia = Number(dueDayVal);
                }
                if (creditLimitVal !== '') {
                    payload.limite = Number(creditLimitVal);
                }
                if (onlyPixVal !== '') {
                    payload.only_pix = Number(onlyPixVal);
                }
                if (onlySolidconBaixaVal !== '') {
                    payload.only_solidcon_baixa = Number(onlySolidconBaixaVal);
                }
                if (exemptInterestFineVal !== '') {
                    payload.exempt_interest_fine = Number(exemptInterestFineVal);
                }
                const hideInRevenuesVal = getById('bulkCustomerHideInRevenues')?.value;
                if (hideInRevenuesVal !== '' && hideInRevenuesVal !== undefined) {
                    payload.hide_in_revenues_grid = Number(hideInRevenuesVal);
                }
                // If nothing is selected to change, alert the user
                if (payload.seller_public_id === undefined && payload.customer_group_public_id === undefined && payload.vencimento_dia === undefined && payload.limite === undefined && payload.only_pix === undefined && payload.only_solidcon_baixa === undefined && payload.exempt_interest_fine === undefined && payload.hide_in_revenues_grid === undefined) {
                    alert('Selecione ao menos um campo para alterar.');
                    return;
                }
                const saveBtn = getById('bulkSaveBtn');
                if (saveBtn) {
                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Aplicando...';
                }
                try {
                    const response = await (window.api)('/entities/customers/bulk-update', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    closeBulkUpdateModal();
                    window.UI.showAlert('alertMessage', response.message || 'Clientes atualizados com sucesso!', 'success');
                    // Uncheck selectAll and all item checkboxes
                    const selectAll = getById('selectAll');
                    if (selectAll)
                        selectAll.checked = false;
                    document.querySelectorAll('.item-checkbox').forEach(cb => cb.checked = false);
                    // Update bulk buttons visibility
                    updateBulkButtonsVisibility();
                    await customersManager.loadData();
                }
                catch (error) {
                    alert(error.message || 'Erro ao atualizar clientes.');
                }
                finally {
                    if (saveBtn) {
                        saveBtn.disabled = false;
                        saveBtn.textContent = 'Aplicar Alterações';
                    }
                }
            });
        }
        const updateBulkButtonsVisibility = () => {
            const checkedBoxes = document.querySelectorAll('.item-checkbox:checked');
            const count = checkedBoxes.length;
            const btnBulkUpdate = getById('btnBulkUpdateCustomers');
            const btnBulkDelete = getById('btnBulkDeleteCustomers');
            if (btnBulkUpdate) {
                if (count > 0) {
                    btnBulkUpdate.classList.remove('hidden');
                    btnBulkUpdate.classList.add('inline-flex');
                    const countSpan = getById('bulkUpdateCustomersCount');
                    if (countSpan)
                        countSpan.textContent = String(count);
                }
                else {
                    btnBulkUpdate.classList.add('hidden');
                    btnBulkUpdate.classList.remove('inline-flex');
                }
            }
            if (btnBulkDelete) {
                if (count > 0) {
                    btnBulkDelete.classList.remove('hidden');
                    btnBulkDelete.classList.add('inline-flex');
                    const countSpan = getById('bulkCustomersCount');
                    if (countSpan)
                        countSpan.textContent = String(count);
                }
                else {
                    btnBulkDelete.classList.add('hidden');
                    btnBulkDelete.classList.remove('inline-flex');
                }
            }
        };
        document.addEventListener('change', (e) => {
            if (e.target && (e.target.classList.contains('item-checkbox') || e.target.id === 'selectAll')) {
                setTimeout(updateBulkButtonsVisibility, 0);
            }
        });
        // Also hide bulk buttons when loading data
        const originalLoadData = customersManager.loadData;
        customersManager.loadData = async function (...args) {
            const res = await originalLoadData.apply(this, args);
            updateBulkButtonsVisibility();
            return res;
        };
        // Delete global action
        document.addEventListener('click', async (e) => {
            const btn = e.target?.closest?.('.delete-btn');
            if (btn) {
                const id = btn.getAttribute('data-id');
                if (!confirm('Tem certeza que deseja excluir este cliente?'))
                    return;
                try {
                    await (window.api)(`/entities/customers/${id}`, { method: 'DELETE' });
                    window.UI.showAlert('alertMessage', 'Cliente excluído com sucesso!', 'success');
                    await customersManager.loadData();
                }
                catch (error) {
                    window.UI.showAlert('alertMessage', error.message || 'Erro ao excluir o cliente.', 'error');
                }
            }
        });
        getById('entityForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const saveBtn = getById('saveBtn');
            const customerId = getTrimmedValue('customerId');
            const isEditing = Boolean(customerId);
            const nameValue = getTrimmedValue('customerName');
            if (!nameValue) {
                // Garantir que a aba Dados esteja visível antes de mostrar o erro
                const infoTab = getById('customerInfoTab');
                const infoTabBtn = getById('customerInfoTabButton');
                if (infoTab && infoTab.classList.contains('hidden')) {
                    infoTabBtn?.click();
                }
                getById('customerName')?.focus();
                return;
            }
            const payload = {
                name: getTrimmedValue('customerName'),
                trade_name: getTrimmedValue('customerTradeName') || undefined,
                contact: getTrimmedValue('customerContact') || undefined,
                email: getTrimmedValue('customerEmail'),
                seller_public_id: getById('customerSellerParam')?.value || undefined,
                customer_group_public_id: getById('customerGroupParam')?.value || undefined,
                cnpj_cpf: getMaskedValue(customerDocMask, 'customerDocument') || undefined,
                inscricao_estadual: getTrimmedValue('customerInscricaoEstadual') || undefined,
                inscricao_municipal: getTrimmedValue('customerInscricaoMunicipal') || undefined,
                phone: getMaskedValue(customerPhoneMask, 'customerPhone') || undefined,
                phone_landline: getMaskedValue(customerPhoneLandlineMask, 'customerPhoneLandline') || undefined,
                zipcode: getMaskedValue(customerZipMask, 'customerZipcode') || undefined,
                street: getTrimmedValue('customerStreet') || undefined,
                number: getTrimmedValue('customerNumber') || undefined,
                complement: getTrimmedValue('customerComplement') || undefined,
                neighborhood: getTrimmedValue('customerNeighborhood') || undefined,
                city: getTrimmedValue('customerCity') || undefined,
                state: getById('customerState')?.value || undefined,
                cd_municipio: getTrimmedValue('customerCdMunicipio') ? Number(getTrimmedValue('customerCdMunicipio')) : undefined,
                tax_regime: getById('customerTaxRegime')?.value || undefined,
                opening_date: getTrimmedValue('customerOpeningDate') || undefined,
                certificate_password: getTrimmedValue('customerCertPassword') || undefined,
                certificate_expiration: getTrimmedValue('customerCertExpiration') || undefined,
                vencimento_dia: getById('customerDueDay')?.value !== '' ? Number(getById('customerDueDay')?.value) : undefined,
                limite: getById('customerCreditLimit')?.value !== '' ? Number(getById('customerCreditLimit')?.value) : undefined,
                only_pix: getById('customerOnlyPix')?.checked ? 1 : 0,
                only_solidcon_baixa: getById('customerOnlySolidconBaixa')?.checked ? 1 : 0,
                exempt_interest_fine: getById('customerExemptInterestFine')?.checked ? 1 : 0,
                hide_in_revenues_grid: getById('customerHideInRevenues')?.checked ? 1 : 0,
                discount_type: getById('customerDiscountType')?.value || undefined,
                discount_value: getById('customerDiscountValue')?.value !== '' ? Number(getById('customerDiscountValue')?.value) : undefined,
                activity_groups_public_ids: Array.from(document.querySelectorAll('input[name="customerActivityGroups"]:checked')).map((el) => el.value),
            };
            const registerAsCompanyCheckbox = getById('customerRegisterAsCompany');
            if (registerAsCompanyCheckbox) {
                payload.register_as_company = registerAsCompanyCheckbox.checked;
                if (registerAsCompanyCheckbox.checked && customCompanyUser) {
                    payload.company_user = customCompanyUser;
                }
            }
            saveBtn.disabled = true;
            saveBtn.textContent = 'Salvando...';
            try {
                const certFileInput = getById('customerCertFile');
                if (certFileInput && certFileInput.files.length > 0) {
                    payload.certificate_base64 = await getBase64(certFileInput.files[0]);
                }
                const endpoint = isEditing ? `/entities/customers/${customerId}` : '/entities/customers';
                const method = isEditing ? 'PUT' : 'POST';
                await (window.api)(endpoint, {
                    method,
                    body: JSON.stringify(payload),
                });
                let successMsg = isEditing ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!';
                if (!isEditing && registerAsCompanyCheckbox && registerAsCompanyCheckbox.checked) {
                    successMsg = 'Cliente cadastrado com sucesso! Empresa correspondente criada no sistema.';
                }
                window.UI.showAlert('alertMessage', successMsg, 'success');
                customersManager.closeModal();
                await customersManager.loadData();
            }
            catch (error) {
                window.UI.showAlert('alertMessage', error.message || 'Erro ao salvar cliente.', 'error');
            }
            finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Salvar';
            }
        });
    });
})();
