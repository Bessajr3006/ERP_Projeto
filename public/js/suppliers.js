(() => {
    const api = window.api;
    const Auth = window.Auth;
    const UI = window.UI;
    const DateUtils = window.DateUtils;
    const CrudManager = window.CrudManager;
    const FilterPanel = window.FilterPanel;
    const Paginator = window.Paginator;
    const forge = window.forge;
    let suppliersData = [];
    let suppliersManager;
    document.addEventListener('DOMContentLoaded', () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }
        // Load User info for the navbar
        api('/auth/me')
            .then((res) => {
            const userGreeting = document.getElementById('userGreeting');
            if (userGreeting && res.data && res.data.user) {
                userGreeting.textContent = `Olá, ${res.data.user.full_name || 'Usuário'}`;
            }
            else if (userGreeting && res.data) {
                userGreeting.textContent = `Olá, ${res.data.full_name || 'Usuário'}`;
            }
        })
            .catch((err) => {
            console.error('Falha ao carregar usuário', err);
        });
        document.title = 'KEYSTONE - Fornecedores';
        suppliersManager = new CrudManager({
            entityName: 'Fornecedor',
            endpoint: '/entities/suppliers',
            tableId: 'suppliersTable',
            gridSectionId: 'suppliersGridSection',
            tableSectionId: 'suppliersSection',
            modalId: 'entityModal',
            filterConfig: {
                storageKey: 'suppliers_filter_panel',
                footerId: 'suppliersResultsFooter',
                fields: [{ id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome, documento, e-mail ou telefone' }],
            },
            renderTable: null,
            renderGrid: null,
            applyFilters: (data) => {
                const search = FilterPanel.normalizeText(document.getElementById('filterSearch')?.value);
                const searchDigits = FilterPanel.onlyDigits(search);
                const filtered = data.filter((item) => {
                    if (!search)
                        return true;
                    if (FilterPanel.matchesSearch(item, ['name', 'email', 'phone', 'cnpj_cpf'], search))
                        return true;
                    if (!searchDigits)
                        return false;
                    return [item.phone, item.cnpj_cpf]
                        .map((value) => FilterPanel.onlyDigits(value))
                        .some((value) => value.includes(searchDigits));
                });
                if (_tablePager)
                    _tablePager.setData(filtered);
                if (_gridPager)
                    _gridPager.setData(filtered);
                return filtered;
            },
            onEdit: (data) => {
                window.openModal('supplier', data);
            },
        });
        suppliersManager.loadData = async function () {
            try {
                const response = await api('/entities/suppliers');
                this.data = (response.data || []).map((item) => {
                    const safe = { ...item };
                    if (safe.certificate_base64)
                        safe.certificate_base64 = true;
                    if (safe.social_contract_base64)
                        safe.social_contract_base64 = true;
                    if (safe.cnpj_document_base64)
                        safe.cnpj_document_base64 = true;
                    return safe;
                });
                suppliersData = this.data;
                if (!_tablePager) {
                    _tablePager = new Paginator({
                        containerId: 'suppliersPaginationContainer',
                        pageSize: 20,
                        onChange: (pageItems, state) => {
                            renderTable('suppliersTable', pageItems, (state.currentPage - 1) * state.pageSize);
                            suppliersManager._bindActionEvents();
                        },
                    });
                }
                if (!_gridPager) {
                    _gridPager = new Paginator({
                        containerId: 'suppliersGridPaginationContainer',
                        pageSize: 20,
                        onChange: (pageItems, state) => {
                            renderGrid('suppliersGridSection', pageItems, (state.currentPage - 1) * state.pageSize);
                            suppliersManager._bindActionEvents();
                        },
                    });
                }
                this.applyFilters();
            }
            catch (error) {
                console.error('Failed to load entities', error);
                UI.showAlert('alertMessage', 'Erro ao carregar dados. Verifique a conexão.');
            }
        };
        suppliersManager.init();
        const btnOpen = document.getElementById('btnOpenModal');
        if (btnOpen) {
            btnOpen.addEventListener('click', () => {
                window.openModal('supplier');
            });
        }
        applySupplierPrefillFromQuery();
    });
    // ── Paginadores ─────────────────────────────────────────────
    let _tablePager = null;
    let _gridPager = null;
    const makeMask = window.createMaskAdapter || ((input, options) => window.IMask(input, options));
    let docMask = null;
    let phoneMask = null;
    let zipMask = null;
    let entityIbgeStates = [];
    function onlyDigits(value) {
        return String(value || '').replace(/\D/g, '');
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
    function applySupplierPrefillFromQuery() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('prefill') !== 'supplier')
            return;
        const prefillName = String(params.get('name') || '').trim();
        const prefillPhoneRaw = onlyDigits(params.get('phone') || '');
        const prefillPhone = (prefillPhoneRaw.length === 12 || prefillPhoneRaw.length === 13) && prefillPhoneRaw.startsWith('55')
            ? prefillPhoneRaw.slice(2)
            : prefillPhoneRaw;
        const openModalBtn = document.getElementById('btnOpenModal');
        if (openModalBtn) {
            openModalBtn.click();
        }
        else {
            openModal('supplier');
        }
        window.requestAnimationFrame(() => {
            const nameInput = document.getElementById('entityName');
            const currentName = String(nameInput?.value || '').trim();
            if (nameInput && !currentName && prefillName) {
                nameInput.value = prefillName;
            }
            const currentPhone = phoneMask
                ? String(phoneMask.unmaskedValue || '')
                : onlyDigits(document.getElementById('entityPhone')?.value || '');
            if (!currentPhone && prefillPhone) {
                setMaskedValue(phoneMask, 'entityPhone', prefillPhone);
            }
        });
        if (typeof UI !== 'undefined' && UI.showAlert) {
            UI.showAlert('alertMessage', 'Preenchimento aplicado. Revise os dados e clique em Salvar.', 'success', 4500);
        }
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('prefill');
        cleanUrl.searchParams.delete('name');
        cleanUrl.searchParams.delete('phone');
        window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
    }
    function populateEntityStateOptions(selectedValue = '') {
        const stateSelect = document.getElementById('entityState');
        if (!stateSelect || !entityIbgeStates.length)
            return;
        const normalizedSelectedValue = String(selectedValue || '').trim().toUpperCase();
        stateSelect.innerHTML = [
            '<option value="">Selecione...</option>',
            ...entityIbgeStates.map((state) => `<option value="${state.uf}">${state.uf} - ${state.name}</option>`),
        ].join('');
        stateSelect.value = entityIbgeStates.some((state) => state.uf === normalizedSelectedValue) ? normalizedSelectedValue : '';
    }
    async function loadEntityStateOptions(selectedValue = '') {
        try {
            if (!entityIbgeStates.length) {
                const response = await api('/companies/states');
                entityIbgeStates = response.data || [];
            }
            populateEntityStateOptions(selectedValue);
        }
        catch (error) {
            console.error('Falha ao carregar UFs do IBGE para fornecedores', error);
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
        catch (_error) {
            // Fallback para BrasilAPI abaixo.
        }
        if (!data && !cepNotFound) {
            try {
                const brasilApiResponse = await fetch(`https://brasilapi.com.br/api/cep/v1/${normalizedCep}`);
                if (brasilApiResponse.ok) {
                    data = (await brasilApiResponse.json());
                }
            }
            catch (_error) {
                // Mantém null para o chamador tratar.
            }
        }
        return data;
    }
    function applyEntityCepLookupResult(data) {
        if (!data)
            return;
        const street = document.getElementById('entityStreet');
        const neighborhood = document.getElementById('entityNeighborhood');
        const city = document.getElementById('entityCity');
        const complement = document.getElementById('entityComplement');
        if (street)
            street.value = data.street || '';
        if (neighborhood)
            neighborhood.value = data.neighborhood || '';
        if (city)
            city.value = data.city || '';
        if (complement)
            complement.value = data.complement || '';
        populateEntityStateOptions(data.state || '');
    }
    async function handleEntityCepLookup() {
        const loader = document.getElementById('cepLoading');
        const cep = zipMask
            ? zipMask.unmaskedValue
            : onlyDigits(document.getElementById('entityZipcode')?.value || '');
        if (cep.length !== 8)
            return;
        if (loader)
            loader.classList.remove('hidden');
        try {
            const data = await lookupAddressByCep(cep);
            if (data && (data.street || data.city)) {
                applyEntityCepLookupResult(data);
            }
            else {
                UI.showAlert('alertMessage', 'CEP não encontrado ou inválido.', 'error');
            }
        }
        catch (error) {
            console.error('Falha ao consultar CEP do fornecedor', error);
        }
        finally {
            if (loader)
                loader.classList.add('hidden');
        }
    }
    async function handleEntityCnpjLookup() {
        const documentValue = docMask
            ? docMask.unmaskedValue
            : onlyDigits(document.getElementById('entityDoc')?.value || '');
        if (documentValue.length !== 14)
            return;
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${documentValue}`);
            const data = await response.json();
            if (!response.ok || !data?.razao_social) {
                UI.showAlert('alertMessage', 'CNPJ não encontrado ou inválido.', 'error');
                return;
            }
            const nameInput = document.getElementById('entityName');
            if (nameInput && !nameInput.value.trim()) {
                nameInput.value = data.nome_fantasia || data.razao_social || '';
            }
            const emailEl = document.getElementById('entityEmail');
            const streetEl = document.getElementById('entityStreet');
            const numberEl = document.getElementById('entityNumber');
            const complementEl = document.getElementById('entityComplement');
            const neighborhoodEl = document.getElementById('entityNeighborhood');
            const cityEl = document.getElementById('entityCity');
            if (emailEl)
                emailEl.value = data.email || emailEl.value || '';
            setMaskedValue(phoneMask, 'entityPhone', data.ddd_telefone_1 || '');
            setMaskedValue(zipMask, 'entityZipcode', data.cep || '');
            if (streetEl)
                streetEl.value = data.logradouro || streetEl.value || '';
            if (numberEl)
                numberEl.value = data.numero || numberEl.value || '';
            if (complementEl)
                complementEl.value = data.complemento || complementEl.value || '';
            if (neighborhoodEl)
                neighborhoodEl.value = data.bairro || neighborhoodEl.value || '';
            if (cityEl)
                cityEl.value = data.municipio || cityEl.value || '';
            populateEntityStateOptions(data.uf || '');
            if (data.cep) {
                const cepData = await lookupAddressByCep(data.cep);
                if (cepData) {
                    applyEntityCepLookupResult({
                        ...cepData,
                        complement: cepData.complement || data.complemento || '',
                    });
                }
            }
        }
        catch (error) {
            console.error('Falha ao consultar CNPJ do fornecedor', error);
        }
    }
    // Modal Logic
    function openModal(type, data = null) {
        setValue('entityType', type);
        const isEdit = !!(data && data.public_id);
        const modalTitle = document.getElementById('modalTitle');
        if (modalTitle)
            modalTitle.textContent = isEdit ? 'Editar Fornecedor' : data ? 'Duplicar Fornecedor' : 'Novo Fornecedor';
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn)
            saveBtn.className =
                'w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-brand-600 text-base font-medium text-white hover:bg-brand-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm';
        if (data) {
            setValue('entityId', isEdit ? data.public_id : '');
            setValue('entityName', data.name || '');
            setValue('entityEmail', data.email || '');
            setValue('entityStreet', data.street || '');
            setValue('entityNumber', data.number || '');
            setValue('entityComplement', data.complement || '');
            setValue('entityNeighborhood', data.neighborhood || '');
            setValue('entityCity', data.city || '');
            setText('entityCertFileName', data.certificate_base64 ? 'Documento salvo. Selecione outro para substituir.' : 'Nenhum arquivo selecionado');
            setValue('entityCertPassword', data.certificate_password || '');
            setValue('entityCertExpiration', data.certificate_expiration ? String(data.certificate_expiration).split('T')[0] : '');
            setText('entityContractFileName', data.social_contract_base64 ? 'Documento salvo. Selecione outro para substituir.' : 'Nenhum arquivo selecionado');
            setText('entityCnpjFileName', data.cnpj_document_base64 ? 'Documento salvo. Selecione outro para substituir.' : 'Nenhum arquivo selecionado');
        }
        else {
            document.getElementById('entityForm')?.reset();
            setValue('entityId', '');
            setText('entityCertFileName', 'Nenhum arquivo selecionado');
            setValue('entityCertPassword', '');
            setValue('entityCertExpiration', '');
            setText('entityContractFileName', 'Nenhum arquivo selecionado');
            setText('entityCnpjFileName', 'Nenhum arquivo selecionado');
            void loadEntityStateOptions('');
        }
        // Initialize or Update Masks
        // Masks must be initialized BEFORE setting values so IMask can format them
        const docInput = document.getElementById('entityDoc');
        const phoneInput = document.getElementById('entityPhone');
        const zipInput = document.getElementById('entityZipcode');
        if (docInput && !docMask) {
            docMask = makeMask(docInput, {
                mask: [{ mask: '000.000.000-00' }, { mask: '00.000.000/0000-00' }],
            });
            docInput.addEventListener('blur', () => {
                void handleEntityCnpjLookup();
            });
        }
        if (phoneInput && !phoneMask) {
            phoneMask = makeMask(phoneInput, {
                mask: [{ mask: '(00) 0000-0000' }, { mask: '(00) 00000-0000' }],
            });
        }
        if (zipInput && !zipMask) {
            zipMask = makeMask(zipInput, { mask: '00000-000' });
            if (zipMask?.on) {
                zipMask.on('complete', () => {
                    void handleEntityCepLookup();
                });
            }
        }
        void loadEntityStateOptions(data ? data.state || '' : '');
        setMaskedValue(docMask, 'entityDoc', data ? data.cnpj_cpf || '' : '');
        setMaskedValue(phoneMask, 'entityPhone', data ? data.phone || '' : '');
        setMaskedValue(zipMask, 'entityZipcode', data ? data.zipcode || '' : '');
        if (window.switchEntityTab)
            window.switchEntityTab('data');
        document.getElementById('entityModal')?.classList.remove('hidden');
    }
    function setValue(id, value) {
        const el = document.getElementById(id);
        if (el)
            el.value = value;
    }
    function setText(id, value) {
        const el = document.getElementById(id);
        if (el)
            el.textContent = value;
    }
    window.openModal = openModal;
    const setupFileInput = (inputId, displayId) => {
        const input = document.getElementById(inputId);
        const display = document.getElementById(displayId);
        if (input && display) {
            input.addEventListener('change', (e) => {
                const target = e.target;
                const files = target?.files;
                if (files && files.length > 0) {
                    display.textContent = files[0].name;
                }
                else {
                    display.textContent = 'Nenhum arquivo selecionado';
                }
            });
        }
    };
    setupFileInput('entityCertFile', 'entityCertFileName');
    setupFileInput('entityContractFile', 'entityContractFileName');
    setupFileInput('entityCnpjFile', 'entityCnpjFileName');
    const tryExtractCertDate = () => {
        const fileInput = document.getElementById('entityCertFile');
        const passInput = document.getElementById('entityCertPassword');
        const expInput = document.getElementById('entityCertExpiration');
        if (!fileInput || !passInput || !expInput)
            return;
        if (!forge || !fileInput.files || fileInput.files.length === 0)
            return;
        const password = passInput.value;
        if (!password)
            return;
        const file = fileInput.files[0];
        const ext = file.name.toLowerCase();
        if (!ext.endsWith('.pfx') && !ext.endsWith('.p12'))
            return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const arrayBuffer = e.target?.result;
                if (!arrayBuffer)
                    return;
                const bytes = new Uint8Array(arrayBuffer);
                let binary = '';
                for (let i = 0; i < bytes.length; i++)
                    binary += String.fromCharCode(bytes[i]);
                const p12Asn1 = forge.asn1.fromDer(binary);
                const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);
                for (const safeBag of p12.safeContents) {
                    if (safeBag.safeBags) {
                        for (const bag of safeBag.safeBags) {
                            if (bag.type === forge.pki.oids.certBag && bag.cert) {
                                expInput.value = DateUtils.toDateInputValue(bag.cert.validity.notAfter);
                                return;
                            }
                        }
                    }
                }
            }
            catch (err) {
                console.warn('Autoparse PKCS12 failed (possibly wrong password or incompatible format)', err?.message || String(err));
            }
        };
        reader.readAsArrayBuffer(file);
    };
    if (document.getElementById('entityCertFile')) {
        document.getElementById('entityCertFile')?.addEventListener('change', tryExtractCertDate);
    }
    if (document.getElementById('entityCertPassword')) {
        // try whenever typing stops or changes
        document.getElementById('entityCertPassword')?.addEventListener('input', () => {
            clearTimeout(window.certParseTimer);
            window.certParseTimer = setTimeout(tryExtractCertDate, 800);
        });
    }
    // Form Logic
    document.getElementById('entityForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = document.getElementById('entityType')?.value;
        const entityId = document.getElementById('entityId')?.value;
        const isEdit = !!entityId;
        const payload = {
            name: document.getElementById('entityName')?.value.trim(),
            cnpj_cpf: docMask
                ? docMask.unmaskedValue
                : document.getElementById('entityDoc')?.value.trim(),
            email: document.getElementById('entityEmail')?.value.trim(),
            phone: phoneMask
                ? phoneMask.unmaskedValue
                : document.getElementById('entityPhone')?.value.trim(),
            zipcode: (zipMask
                ? zipMask.unmaskedValue
                : document.getElementById('entityZipcode')?.value.trim()) || null,
            street: document.getElementById('entityStreet')?.value.trim() || null,
            number: document.getElementById('entityNumber')?.value.trim() || null,
            complement: document.getElementById('entityComplement')?.value.trim() || null,
            neighborhood: document.getElementById('entityNeighborhood')?.value.trim() || null,
            city: document.getElementById('entityCity')?.value.trim() || null,
            state: document.getElementById('entityState')?.value.trim() || null,
            certificate_password: document.getElementById('entityCertPassword')?.value.trim() || null,
            certificate_expiration: document.getElementById('entityCertExpiration')?.value || null,
        };
        if (!payload.name) {
            UI.showAlert('alertMessage', 'O Nome / Razão Social é obrigatório', 'error');
            if (window.switchEntityTab)
                window.switchEntityTab('data');
            setTimeout(() => document.getElementById('entityName')?.focus(), 100);
            return;
        }
        const fileInputs = [
            { id: 'entityCertFile', key: 'certificate_base64' },
            { id: 'entityContractFile', key: 'social_contract_base64' },
            { id: 'entityCnpjFile', key: 'cnpj_document_base64' },
        ];
        const getBase64 = (file) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(String(reader.result).split(',')[1]);
            reader.onerror = (error) => reject(error);
        });
        for (const input of fileInputs) {
            const fileElement = document.getElementById(input.id);
            if (fileElement?.files && fileElement.files.length > 0) {
                payload[input.key] = await getBase64(fileElement.files[0]);
            }
        }
        const saveBtn = document.getElementById('saveBtn');
        const originalText = saveBtn?.textContent || '';
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Salvando...';
        }
        const endpoint = isEdit ? `/entities/suppliers/${entityId}` : '/entities/suppliers';
        const method = isEdit ? 'PUT' : 'POST';
        try {
            await api(endpoint, {
                method,
                body: JSON.stringify(payload),
            });
            UI.showAlert('alertMessage', `Fornecedor ${isEdit ? 'atualizado' : 'cadastrado'} com sucesso!`, 'success');
            suppliersManager.closeModal();
            void suppliersManager.loadData(); // Reload tables
        }
        catch (error) {
            alert(error?.message); // Usar alert nativo para erros do modal pra simplificar
        }
        finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = originalText || 'Salvar';
            }
        }
    });
    function formatDoc(doc) {
        if (!doc)
            return '';
        const clean = doc.replace(/\D/g, '');
        if (clean.length === 11) {
            return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        }
        else if (clean.length === 14) {
            return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        }
        return doc;
    }
    function formatPhone(phone) {
        if (!phone)
            return '-';
        const clean = String(phone).replace(/\D/g, '');
        if (clean.length === 10) {
            return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        }
        if (clean.length === 11) {
            return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        }
        if (clean.length === 12) {
            return clean.replace(/(\d{2})(\d{2})(\d{4})(\d{4})/, '+$1 ($2) $3-$4');
        }
        if (clean.length === 13) {
            return clean.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
        }
        return String(phone);
    }
    function renderTable(elementId, items, offset = 0) {
        const tbody = document.getElementById(elementId);
        if (!tbody)
            return;
        if (items.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum fornecedor encontrado.</td></tr>';
            return;
        }
        tbody.innerHTML = items
            .map((item, index) => `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors group">
            <td class="px-3 py-4 whitespace-nowrap text-left w-12">
                <input type="checkbox" value="${item.public_id}" class="item-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" data-bwignore="true" data-lpignore="true" placeholder="">
            </td>
            <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                #${String(offset + index + 1).padStart(4, '0')}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">${item.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${formatDoc(item.cnpj_cpf) || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                ${item.email ? `<div class="truncate w-32" title="${item.email}">${item.email}</div>` : ''}
                ${item.phone ? `<div>${formatPhone(item.phone)}</div>` : '-'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button type="button" title="Editar" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-3 edit-btn" data-item='${JSON.stringify(item).replace(/'/g, '&#39;')}'>
                    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button type="button" title="Duplicar" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mr-3 duplicate-btn" data-item='${JSON.stringify(item).replace(/'/g, '&#39;')}'>
                    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                </button>
                <button type="button" title="Excluir" class="text-red-600 hover:text-red-900 dark:hover:text-red-400 delete-btn" data-id="${item.public_id}">
                    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </td>
        </tr>
    `)
            .join('');
    }
    function renderGrid(elementId, items, offset = 0) {
        const grid = document.getElementById(elementId);
        if (!grid)
            return;
        if (items.length === 0) {
            grid.innerHTML =
                '<div class="col-span-full flex flex-col items-center justify-center py-12 gap-2"><svg class="w-10 h-10 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><p class="text-sm text-gray-400 dark:text-gray-500">Nenhum fornecedor encontrado.</p></div>';
            return;
        }
        grid.innerHTML = items
            .map((item, index) => `
        <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col relative border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors group">
            <div class="flex-1">
                <div class="flex justify-between items-center mb-3">
                    <input type="checkbox" value="${item.public_id}" class="item-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" data-bwignore="true" data-lpignore="true" placeholder="">
                    <span class="text-xs font-mono text-gray-400 dark:text-gray-500">#${String(offset + index + 1).padStart(4, '0')}</span>
                </div>
                <h4 class="text-base leading-snug font-bold text-gray-900 dark:text-gray-100 pr-2 wrap-break-word" title="${item.name}">${item.name}</h4>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">${formatDoc(item.cnpj_cpf) || 'Sem documento'}</p>
                
                <div class="mt-4 space-y-2">
                    <div class="flex items-center text-sm text-gray-600 dark:text-gray-300">
                        <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                        ${item.email ? `<span class="truncate" title="${item.email}">${item.email}</span>` : 'Não informado'}
                    </div>
                    <div class="flex items-center text-sm text-gray-600 dark:text-gray-300">
                        <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                        ${item.phone || 'Não informado'}
                    </div>
                </div>
            </div>
            
            <div class="mt-5 pt-4 border-t border-transparent flex justify-end space-x-2">
                <button type="button" title="Editar" class="text-brand-600 hover:bg-brand-50 p-1.5 rounded-full dark:hover:bg-brand-900/30 edit-btn" data-item='${JSON.stringify(item).replace(/'/g, '&#39;')}'>
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button type="button" title="Duplicar" class="text-gray-500 hover:bg-gray-100 p-1.5 rounded-full dark:hover:bg-slate-700 dark:text-gray-400 duplicate-btn" data-item='${JSON.stringify(item).replace(/'/g, '&#39;')}'>
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                </button>
                <button type="button" title="Excluir" class="text-red-500 hover:bg-red-50 p-1.5 rounded-full dark:hover:bg-red-900/30 delete-btn" data-id="${item.public_id}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        </div>
    `)
            .join('');
    }
    document.addEventListener('DOMContentLoaded', () => {
        const tabBtnData = document.getElementById('tabBtn-data');
        const tabBtnDocs = document.getElementById('tabBtn-docs');
        if (tabBtnData) {
            tabBtnData.addEventListener('click', () => switchEntityTab('data'));
        }
        if (tabBtnDocs) {
            tabBtnDocs.addEventListener('click', () => switchEntityTab('docs'));
        }
        const btnToggleCertPassword = document.getElementById('btnToggleCertPassword');
        if (btnToggleCertPassword) {
            btnToggleCertPassword.addEventListener('click', () => {
                if (window.togglePasswordVisibility) {
                    window.togglePasswordVisibility('entityCertPassword');
                }
            });
        }
    });
    // UI function to toggle tabs
    function switchEntityTab(tabName) {
        const tabs = ['data', 'docs'];
        tabs.forEach((tab) => {
            const btn = document.getElementById(`tabBtn-${tab}`);
            const content = document.getElementById(`tabContent-${tab}`);
            if (!btn || !content)
                return;
            if (tab === tabName) {
                btn.classList.add('active', 'text-brand-600', 'border-brand-600', 'dark:text-brand-500', 'dark:border-brand-500');
                btn.classList.remove('border-transparent', 'hover:text-gray-600', 'hover:border-gray-300', 'text-gray-500');
                content.classList.remove('hidden');
                content.classList.add('block');
            }
            else {
                btn.classList.remove('active', 'text-brand-600', 'border-brand-600', 'dark:text-brand-500', 'dark:border-brand-500');
                btn.classList.add('border-transparent', 'hover:text-gray-600', 'hover:border-gray-300', 'text-gray-500');
                content.classList.add('hidden');
                content.classList.remove('block');
            }
        });
    }
    // Expose
    window.switchEntityTab = switchEntityTab;
    function togglePasswordVisibility(inputId) {
        const input = document.getElementById(inputId);
        if (!input)
            return;
        // Find the SVG paths inside the button that toggle the visibility
        const button = input.nextElementSibling;
        const svg = button?.querySelector('svg');
        if (!svg)
            return;
        if (input.type === 'password') {
            input.type = 'text';
            svg.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        `;
        }
        else {
            input.type = 'password';
            svg.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        `;
        }
    }
    window.togglePasswordVisibility = togglePasswordVisibility;
})();
