(function initContactsPage() {
    let contactsManager;
    let contactsDocMask = null;
    let contactsPhoneMask = null;
    let contactsZipMask = null;
    let contactsIbgeStates = [];
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
    function setMaskedValue(maskInstance, inputId, value) {
        if (maskInstance) {
            if (inputId === 'contactsDocument') {
                maskInstance.unmaskedValue = String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            }
            else {
                maskInstance.unmaskedValue = onlyDigits(value);
            }
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
        if (inputId === 'contactsDocument') {
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
    function formatContactLocation(item) {
        const city = String(item.city || '').trim();
        const state = String(item.state || '').trim();
        if (!city && !state)
            return 'Não informado';
        return [city, state].filter(Boolean).join(' / ');
    }
    function populateContactStateOptions(selectedValue = '') {
        const stateSelect = getById('contactsState');
        if (!stateSelect || !contactsIbgeStates.length)
            return;
        const normalizedSelectedValue = String(selectedValue || '').trim().toUpperCase();
        stateSelect.innerHTML = [
            '<option value="">Selecione...</option>',
            ...contactsIbgeStates.map((state) => `<option value="${state.uf}">${state.uf} - ${state.name}</option>`),
        ].join('');
        stateSelect.value = contactsIbgeStates.some((state) => state.uf === normalizedSelectedValue) ? normalizedSelectedValue : '';
    }
    async function loadDependencies(selectedState = '') {
        try {
            const statesRes = contactsIbgeStates.length ? { data: contactsIbgeStates } : await api('/companies/states').catch(() => ({ data: [] }));
            if (!contactsIbgeStates.length)
                contactsIbgeStates = statesRes.data || [];
            populateContactStateOptions(selectedState);
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
    function applyContactCepLookupResult(data) {
        if (!data)
            return;
        getById('contactsStreet').value = data.street || '';
        getById('contactsNeighborhood').value = data.neighborhood || '';
        getById('contactsCity').value = data.city || '';
        getById('contactsComplement').value = data.complement || '';
        populateContactStateOptions(data.state || '');
    }
    async function handleContactCepLookup() {
        const loader = getById('contactsCepLoading');
        const cep = getMaskedValue(contactsZipMask, 'contactsZipcode');
        if (cep.length !== 8)
            return;
        if (loader)
            loader.classList.remove('hidden');
        try {
            const data = await lookupAddressByCep(cep);
            if (data && (data.street || data.city)) {
                applyContactCepLookupResult(data);
            }
            else {
                UI.showAlert('alertMessage', 'CEP do contato não encontrado ou inválido.', 'error');
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
    function setupContactFormEnhancements() {
        const documentInput = getById('contactsDocument');
        const phoneInput = getById('contactsPhone');
        const zipcodeInput = getById('contactsZipcode');
        if (documentInput && !contactsDocMask) {
            contactsDocMask = makeMask(documentInput, {
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
        if (phoneInput && !contactsPhoneMask) {
            contactsPhoneMask = makeMask(phoneInput, {
                mask: [
                    { mask: '(00) 0000-0000' },
                    { mask: '(00) 00000-0000' },
                ],
            });
        }
        if (zipcodeInput && !contactsZipMask) {
            contactsZipMask = makeMask(zipcodeInput, { mask: '00000-000' });
            contactsZipMask.on('complete', handleContactCepLookup);
        }
    }
    function applyContactPrefillFromQuery() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('prefill') !== 'contacts')
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
            const currentName = getTrimmedValue('contactsName');
            if (!currentName && prefillName) {
                getById('contactsName').value = prefillName;
            }
            const currentPhone = getMaskedValue(contactsPhoneMask, 'contactsPhone');
            if (!currentPhone && prefillPhone) {
                setMaskedValue(contactsPhoneMask, 'contactsPhone', prefillPhone);
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
    document.addEventListener('DOMContentLoaded', () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }
        setupContactFormEnhancements();
        loadDependencies();
        setupDetailsModalTabs();
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
                await api(`/entities/contacts/${renameEntityId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        cnpj_document_url: JSON.stringify(renameDocsList)
                    })
                });
                UI.showAlert('alertMessage', 'Documento renomeado com sucesso!', 'success');
                await contactsManager.loadData();
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
                await api(`/entities/contacts/${deleteEntityId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        cnpj_document_url: JSON.stringify(deleteDocsList)
                    })
                });
                UI.showAlert('alertMessage', 'Documento excluído com sucesso!', 'success');
                await contactsManager.loadData();
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
        api('/auth/me').then((res) => {
            const userGreeting = getById('userGreeting');
            if (userGreeting && res.data && res.data.user) {
                userGreeting.textContent = `Olá, ${res.data.user.full_name || 'Usuário'}`;
            }
            else if (userGreeting && res.data) {
                userGreeting.textContent = `Olá, ${res.data.full_name || 'Usuário'}`;
            }
        }).catch(console.error);
        contactsManager = new CrudManager({
            entityName: 'Contato',
            endpoint: '/entities/contacts',
            tableId: 'contactsTable',
            tableSectionId: 'contactsSection',
            modalId: 'entityModal',
            disableSummaryFooter: true,
            filterConfig: {
                storageKey: 'contacts_filter_panel',
                fields: [
                    { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome, documento, email...' },
                ]
            },
            applyFilters: (data) => {
                const search = window.FilterPanel.normalizeText(getById('filterSearch')?.value);
                const searchDigits = window.FilterPanel.onlyDigits(search);
                const filtered = data.filter((item) => {
                    if (!search)
                        return true;
                    if (window.FilterPanel.matchesSearch(item, ['name', 'email', 'cnpj_cpf', 'phone', 'city', 'state'], search))
                        return true;
                    if (!searchDigits)
                        return false;
                    return [item.cnpj_cpf, item.phone]
                        .map((value) => window.FilterPanel.onlyDigits(value))
                        .some((value) => value.includes(searchDigits));
                });
                window.GridSummaryFooter?.update({
                    footerId: 'contactsResultsFooter',
                    anchorId: 'contactsSection',
                    count: filtered.length,
                    label: 'contato(s) exibido(s)'
                });
                return filtered;
            },
            renderTable: (items) => {
                const tbody = getById('contactsTable');
                if (items.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum contato encontrado.</td></tr>';
                    return;
                }
                tbody.innerHTML = items.map((item, index) => {
                    let docsCount = 0;
                    try {
                        if (item.cnpj_document_url) {
                            const parsed = JSON.parse(item.cnpj_document_url);
                            if (Array.isArray(parsed)) {
                                docsCount = parsed.length;
                            }
                        }
                    }
                    catch (e) { }
                    return `
                <tr>
                    <td class="px-3 py-4 whitespace-nowrap text-left w-12">
                        <input type="checkbox" value="${item.public_id}" class="item-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" data-bwignore="true" data-lpignore="true" placeholder="">
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">${item.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">${formatDoc(item.cnpj_cpf) || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div class="block w-56 max-w-full truncate" title="${item.email || ''}">${item.email || '-'}</div>
                        <div>${formatPhone(item.phone)}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center">
                        <div class="flex items-center gap-1.5 justify-center">
                            ${getDocCountBadge(item.cnpj_document_url)}
                            ${getNotesCountBadge(item.notes_count)}
                            ${getTasksCountBadge(item.tasks_count)}
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
                `;
                }).join('');
            },
            onEdit: (data) => {
                getById('entityForm')?.reset();
                const contactsIdInput = getById('contactsId');
                const modalTitle = getById('modalTitle');
                if (data && data.public_id) {
                    modalTitle.textContent = 'Editar Contato';
                    contactsIdInput.value = data.public_id || '';
                    getById('contactsName').value = data.name || '';
                    getById('contactsEmail').value = data.email || '';
                    getById('contactsBirthDate').value = data.birth_date ? String(data.birth_date).split('T')[0] : '';
                    getById('contactsStreet').value = data.street || '';
                    getById('contactsNumber').value = data.number || '';
                    getById('contactsComplement').value = data.complement || '';
                    getById('contactsNeighborhood').value = data.neighborhood || '';
                    getById('contactsCity').value = data.city || '';
                    setMaskedValue(contactsDocMask, 'contactsDocument', data.cnpj_cpf || '');
                    setMaskedValue(contactsPhoneMask, 'contactsPhone', data.phone || '');
                    setMaskedValue(contactsZipMask, 'contactsZipcode', data.zipcode || '');
                    loadDependencies(data.state || '');
                }
                else {
                    modalTitle.textContent = 'Novo Contato';
                    contactsIdInput.value = '';
                    getById('contactsBirthDate').value = '';
                    setMaskedValue(contactsDocMask, 'contactsDocument', '');
                    setMaskedValue(contactsPhoneMask, 'contactsPhone', '');
                    setMaskedValue(contactsZipMask, 'contactsZipcode', '');
                    loadDependencies('');
                }
                getById('entityModal').classList.remove('hidden');
            }
        });
        contactsManager.init();
        applyContactPrefillFromQuery();
        // Delete global action
        document.addEventListener('click', async (e) => {
            const btn = e.target?.closest?.('.delete-btn');
            if (btn) {
                const id = btn.getAttribute('data-id');
                if (!confirm('Tem certeza que deseja excluir este contato?'))
                    return;
                try {
                    await api(`/entities/contacts/${id}`, { method: 'DELETE' });
                    UI.showAlert('alertMessage', 'Contato excluído com sucesso!', 'success');
                    await contactsManager.loadData();
                }
                catch (error) {
                    UI.showAlert('alertMessage', error.message || 'Erro ao excluir o contato.', 'error');
                }
            }
        });
        getById('entityForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const saveBtn = getById('saveBtn');
            const contactsId = getTrimmedValue('contactsId');
            const isEditing = Boolean(contactsId);
            const payload = {
                name: getTrimmedValue('contactsName'),
                email: getTrimmedValue('contactsEmail'),
                birth_date: getTrimmedValue('contactsBirthDate') || undefined,
                cnpj_cpf: getMaskedValue(contactsDocMask, 'contactsDocument') || undefined,
                phone: getMaskedValue(contactsPhoneMask, 'contactsPhone') || undefined,
                zipcode: getMaskedValue(contactsZipMask, 'contactsZipcode') || undefined,
                street: getTrimmedValue('contactsStreet') || undefined,
                number: getTrimmedValue('contactsNumber') || undefined,
                complement: getTrimmedValue('contactsComplement') || undefined,
                neighborhood: getTrimmedValue('contactsNeighborhood') || undefined,
                city: getTrimmedValue('contactsCity') || undefined,
                state: getById('contactsState')?.value || undefined
            };
            saveBtn.disabled = true;
            saveBtn.textContent = 'Salvando...';
            try {
                const endpoint = isEditing ? `/entities/contacts/${contactsId}` : '/entities/contacts';
                const method = isEditing ? 'PUT' : 'POST';
                await api(endpoint, {
                    method,
                    body: JSON.stringify(payload),
                });
                UI.showAlert('alertMessage', isEditing ? 'Contato atualizado com sucesso!' : 'Contato cadastrado com sucesso!', 'success');
                contactsManager.closeModal();
                await contactsManager.loadData();
            }
            catch (error) {
                UI.showAlert('alertMessage', error.message || 'Erro ao salvar contato.', 'error');
            }
            finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Salvar';
            }
        });
        // ── DETAILS MODAL CONTROL ──
        document.addEventListener('click', (e) => {
            const btn = e.target?.closest('.view-details-btn');
            if (btn) {
                const contactId = btn.getAttribute('data-id');
                const contactName = btn.getAttribute('data-name');
                if (contactId && contactName) {
                    openViewDetailsModal(contactId, contactName);
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
        async function openViewDetailsModal(contactId, contactName) {
            const modal = getById('viewContactDetailsModal');
            const closeBtn = getById('btnCloseViewDetailsModal');
            const cancelBtn = getById('btnCancelViewDetailsModal');
            const backdrop = getById('viewDetailsModalBackdrop');
            if (!modal)
                return;
            // Close modal actions
            const closeModal = () => {
                modal.classList.add('hidden');
            };
            closeBtn?.addEventListener('click', closeModal, { once: true });
            cancelBtn?.addEventListener('click', closeModal, { once: true });
            backdrop?.addEventListener('click', closeModal, { once: true });
            modal.classList.remove('hidden');
            // Populate basic contact details
            let contact = contactsManager?.data?.find((c) => c.public_id === contactId);
            const docEl = getById('viewDetailsDocument');
            const emailEl = getById('viewDetailsEmail');
            const phoneEl = getById('viewDetailsPhone');
            const locEl = getById('viewDetailsLocation');
            const titleNameEl = getById('viewDetailsContactName');
            if (titleNameEl)
                titleNameEl.textContent = contactName;
            if (docEl)
                docEl.textContent = formatDoc(contact?.cnpj_cpf);
            if (emailEl) {
                emailEl.textContent = contact?.email || 'Não informado';
                emailEl.title = contact?.email || '';
            }
            if (phoneEl)
                phoneEl.textContent = formatPhone(contact?.phone);
            if (locEl)
                locEl.textContent = formatContactLocation(contact);
            const updateDetailsModalCertExpirationHeader = (currentContact) => {
                const certExpEl = getById('viewDetailsCertExpiration');
                if (!certExpEl)
                    return;
                let expirationFormatted = 'Sem Certificado';
                if (currentContact && currentContact.certificate_url) {
                    if (currentContact.certificate_expiration) {
                        const expDate = new Date(currentContact.certificate_expiration);
                        if (!isNaN(expDate.getTime())) {
                            expirationFormatted = expDate.toLocaleDateString('pt-BR');
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            if (expDate < today) {
                                expirationFormatted += ' (Expirado)';
                            }
                        }
                        else {
                            expirationFormatted = 'Não informada';
                        }
                    }
                    else {
                        expirationFormatted = 'Não informada';
                    }
                }
                certExpEl.textContent = expirationFormatted;
                if (expirationFormatted === 'Sem Certificado') {
                    certExpEl.className = 'text-sm font-medium text-gray-400 dark:text-slate-500';
                }
                else if (expirationFormatted.includes('Expirado')) {
                    certExpEl.className = 'text-sm font-semibold text-red-600 dark:text-red-400';
                }
                else {
                    certExpEl.className = 'text-sm font-medium text-emerald-600 dark:text-emerald-400';
                }
            };
            // Render initial expiration header status
            updateDetailsModalCertExpirationHeader(contact);
            // Map configuration
            const mapContactAddressSpan = getById('mapContactAddress');
            const googleMapsIframe = getById('googleMapsIframe');
            const btnOpenWaze = getById('btnOpenWaze');
            const btnOpenGoogleMaps = getById('btnOpenGoogleMaps');
            if (contact) {
                const contactAddressParts = [
                    contact.street,
                    contact.number,
                    contact.neighborhood,
                    contact.city,
                    contact.state,
                    contact.zipcode
                ].filter(Boolean);
                const contactAddressStr = contactAddressParts.join(', ');
                if (mapContactAddressSpan) {
                    mapContactAddressSpan.textContent = contactAddressStr || 'Endereço não cadastrado';
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
                if (contactAddressStr) {
                    let embedUrl = '';
                    let mapsUrl = '';
                    let wazeUrl = '';
                    if (companyAddressStr) {
                        embedUrl = `https://maps.google.com/maps?saddr=${encodeURIComponent(companyAddressStr)}&daddr=${encodeURIComponent(contactAddressStr)}&output=embed`;
                        mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(companyAddressStr)}&destination=${encodeURIComponent(contactAddressStr)}`;
                        wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(contactAddressStr)}&navigate=yes`;
                    }
                    else {
                        embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(contactAddressStr)}&output=embed`;
                        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contactAddressStr)}`;
                        wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(contactAddressStr)}&navigate=yes`;
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
                if (mapContactAddressSpan)
                    mapContactAddressSpan.textContent = 'Contato não encontrado';
                if (googleMapsIframe)
                    googleMapsIframe.removeAttribute('src');
                if (btnOpenWaze)
                    btnOpenWaze.classList.add('hidden');
                if (btnOpenGoogleMaps)
                    btnOpenGoogleMaps.classList.add('hidden');
            }
            // Check permissions and hide tabs accordingly
            const tabConfig = [
                { id: 'tabButtonFinanceiro', module: 'revenues' },
                { id: 'tabButtonDocumento', module: 'contacts' },
                { id: 'tabButtonAnotacoes', module: 'contacts' },
                { id: 'tabButtonCertificado', module: 'contacts' },
                { id: 'tabButtonTarefas', module: 'tasks' },
                { id: 'tabButtonMapa', module: 'contacts' }
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
            // Certificate configuration inside Details Modal
            const renderDetailsModalCertificate = (currentContact) => {
                const detailCertStatusBadge = getById('detailCertStatusBadge');
                const detailCertHasContent = getById('detailCertHasContent');
                const detailCertNoContent = getById('detailCertNoContent');
                const detailCertFilenameText = getById('detailCertFilenameText');
                const detailCertExpirationText = getById('detailCertExpirationText');
                const detailCertPasswordText = getById('detailCertPasswordText');
                const btnToggleDetailCertPassword = getById('btnToggleDetailCertPassword');
                const btnDownloadDetailCert = getById('btnDownloadDetailCert');
                const detailCertEditFormContainer = getById('detailCertEditFormContainer');
                // Hide form by default
                detailCertEditFormContainer?.classList.add('hidden');
                if (currentContact && currentContact.certificate_url) {
                    detailCertHasContent?.classList.remove('hidden');
                    detailCertNoContent?.classList.add('hidden');
                    if (detailCertFilenameText) {
                        const filename = currentContact.certificate_name || currentContact.certificate_url.split('/').pop() || 'certificado.pfx';
                        detailCertFilenameText.textContent = filename;
                        detailCertFilenameText.setAttribute('title', filename);
                    }
                    let expirationFormatted = 'Não informada';
                    let isExpired = false;
                    if (currentContact.certificate_expiration) {
                        const expDate = new Date(currentContact.certificate_expiration);
                        if (!isNaN(expDate.getTime())) {
                            expirationFormatted = expDate.toLocaleDateString('pt-BR');
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            if (expDate < today) {
                                isExpired = true;
                            }
                        }
                    }
                    if (detailCertExpirationText) {
                        detailCertExpirationText.textContent = expirationFormatted;
                    }
                    const passwordVal = currentContact.certificate_password || '';
                    if (detailCertPasswordText) {
                        detailCertPasswordText.textContent = '••••••••';
                        detailCertPasswordText.setAttribute('data-password', passwordVal);
                    }
                    if (btnToggleDetailCertPassword) {
                        btnToggleDetailCertPassword.textContent = 'Mostrar';
                        const newBtn = btnToggleDetailCertPassword.cloneNode(true);
                        btnToggleDetailCertPassword.parentNode?.replaceChild(newBtn, btnToggleDetailCertPassword);
                        newBtn.addEventListener('click', () => {
                            if (detailCertPasswordText) {
                                const isHidden = detailCertPasswordText.textContent === '••••••••';
                                detailCertPasswordText.textContent = isHidden ? (detailCertPasswordText.getAttribute('data-password') || '') : '••••••••';
                                newBtn.textContent = isHidden ? 'Ocultar' : 'Mostrar';
                            }
                        });
                    }
                    if (detailCertStatusBadge) {
                        if (isExpired) {
                            detailCertStatusBadge.innerHTML = `<span class="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/50 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:text-red-300 shadow-sm border border-red-200 dark:border-red-800">Expirado</span>`;
                        }
                        else {
                            detailCertStatusBadge.innerHTML = `<span class="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 shadow-sm border border-emerald-200 dark:border-emerald-800">Válido</span>`;
                        }
                    }
                    if (btnDownloadDetailCert) {
                        btnDownloadDetailCert.href = currentContact.certificate_url;
                        if (currentContact.certificate_name) {
                            btnDownloadDetailCert.setAttribute('download', currentContact.certificate_name);
                        }
                        else {
                            btnDownloadDetailCert.setAttribute('download', '');
                        }
                    }
                }
                else {
                    detailCertHasContent?.classList.add('hidden');
                    detailCertNoContent?.classList.remove('hidden');
                    if (detailCertStatusBadge) {
                        detailCertStatusBadge.innerHTML = `<span class="inline-flex items-center rounded-full bg-gray-100 dark:bg-slate-700 px-2.5 py-0.5 text-xs font-semibold text-gray-800 dark:text-gray-200 shadow-sm border border-gray-200 dark:border-slate-650">Sem Certificado</span>`;
                    }
                    if (btnDownloadDetailCert) {
                        btnDownloadDetailCert.removeAttribute('href');
                    }
                }
            };
            // Render initial certificate panel state
            renderDetailsModalCertificate(contact);
            // Form trigger buttons setup
            const btnCreateDetailCert = getById('btnCreateDetailCert');
            const btnEditDetailCert = getById('btnEditDetailCert');
            const btnCancelDetailCertSave = getById('btnCancelDetailCertSave');
            const btnSaveDetailCert = getById('btnSaveDetailCert');
            const detailCertEditFormContainer = getById('detailCertEditFormContainer');
            const detailCertHasContent = getById('detailCertHasContent');
            const detailCertNoContent = getById('detailCertNoContent');
            const showEditForm = () => {
                detailCertHasContent?.classList.add('hidden');
                detailCertNoContent?.classList.add('hidden');
                detailCertEditFormContainer?.classList.remove('hidden');
                // Populate current values in inputs
                const passwordInput = getById('detailCertPasswordInput');
                const expirationInput = getById('detailCertExpirationInput');
                const fileInput = getById('detailCertFileInput');
                if (passwordInput)
                    passwordInput.value = contact?.certificate_password || '';
                if (expirationInput)
                    expirationInput.value = contact?.certificate_expiration ? contact.certificate_expiration.split('T')[0] : '';
                if (fileInput) {
                    fileInput.value = ''; // Reset file input
                    // Clear old expiration date input as soon as a new file is chosen
                    const handleFileChange = () => {
                        if (fileInput.files && fileInput.files.length > 0) {
                            if (expirationInput)
                                expirationInput.value = '';
                        }
                    };
                    fileInput.removeEventListener('change', handleFileChange);
                    fileInput.addEventListener('change', handleFileChange);
                }
            };
            const hideEditForm = () => {
                detailCertEditFormContainer?.classList.add('hidden');
                if (contact && contact.certificate_url) {
                    detailCertHasContent?.classList.remove('hidden');
                }
                else {
                    detailCertNoContent?.classList.remove('hidden');
                }
            };
            btnCreateDetailCert?.addEventListener('click', showEditForm);
            btnEditDetailCert?.addEventListener('click', showEditForm);
            btnCancelDetailCertSave?.addEventListener('click', hideEditForm);
            btnSaveDetailCert?.addEventListener('click', async () => {
                const passwordInput = getById('detailCertPasswordInput');
                const expirationInput = getById('detailCertExpirationInput');
                const fileInput = getById('detailCertFileInput');
                const saveBtn = btnSaveDetailCert;
                if (saveBtn) {
                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Salvando...';
                }
                try {
                    const payload = {
                        certificate_password: passwordInput?.value || undefined,
                        certificate_expiration: expirationInput?.value || undefined
                    };
                    if (fileInput && fileInput.files && fileInput.files.length > 0) {
                        payload.certificate_base64 = await getBase64(fileInput.files[0]);
                        payload.certificate_name = fileInput.files[0].name;
                    }
                    await api(`/entities/contacts/${contactId}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                    if (typeof UI !== 'undefined' && UI.showAlert) {
                        UI.showAlert('alertMessage', 'Certificado atualizado com sucesso!', 'success');
                    }
                    // Reload all contacts data in the manager
                    await contactsManager.loadData();
                    // Get the updated contact object
                    const updatedContact = contactsManager?.data?.find((c) => c.public_id === contactId);
                    // Update our local contact reference
                    if (updatedContact) {
                        contact = updatedContact;
                    }
                    // Render the updated certificate panel details
                    renderDetailsModalCertificate(contact);
                    // Update the header expiration status card
                    updateDetailsModalCertExpirationHeader(contact);
                }
                catch (error) {
                    if (typeof UI !== 'undefined' && UI.showAlert) {
                        UI.showAlert('alertMessage', error.message || 'Erro ao salvar o certificado.', 'error');
                    }
                }
                finally {
                    if (saveBtn) {
                        saveBtn.disabled = false;
                        saveBtn.textContent = 'Salvar Certificado';
                    }
                }
            });
            resetDetailsModalTabs();
            // ── Loader / API calls ──
            const financialsTable = getById('viewDetailsFinancialsTable');
            const tasksTable = getById('viewDetailsTasksTable');
            const notesList = getById('viewDetailsNotesList');
            const docContainer = getById('viewDetailsDocumentContainer');
            if (financialsTable)
                financialsTable.innerHTML = '<tr><td colspan="5" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans animate-pulse">Carregando...</td></tr>';
            if (tasksTable)
                tasksTable.innerHTML = '<tr><td colspan="3" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans animate-pulse">Carregando...</td></tr>';
            if (notesList)
                notesList.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 font-sans animate-pulse">Carregando...</p>';
            if (docContainer)
                docContainer.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 font-sans animate-pulse">Carregando...</p>';
            try {
                const [revenuesRes, expensesRes, tasksRes] = await Promise.all([
                    api('/finance/revenues').catch(() => ({ data: [] })),
                    api('/finance/expenses').catch(() => ({ data: [] })),
                    api('/tasks').catch(() => ({ data: [] }))
                ]);
                // Filter by contact's public ID (mapped to entity_public_id when transactions are loaded)
                const revenues = (revenuesRes.data || []).filter((item) => item.entity_public_id === contactId);
                const expenses = (expensesRes.data || []).filter((item) => item.entity_public_id === contactId);
                const allTransactions = [
                    ...revenues.map((r) => ({ ...r, txType: 'Receita' })),
                    ...expenses.map((e) => ({ ...e, txType: 'Despesa' }))
                ];
                // Sort by date desc
                allTransactions.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
                // Render Financials
                if (financialsTable) {
                    if (allTransactions.length === 0) {
                        financialsTable.innerHTML = '<tr><td colspan="5" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans">Nenhum lançamento financeiro encontrado.</td></tr>';
                    }
                    else {
                        financialsTable.innerHTML = allTransactions.map((tx) => {
                            let dateStr = '-';
                            if (tx.date) {
                                try {
                                    const d = new Date(tx.date);
                                    if (!isNaN(d.getTime())) {
                                        const str = typeof tx.date === 'string' ? tx.date : d.toISOString();
                                        const matches = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
                                        if (matches) {
                                            dateStr = `${matches[3]}/${matches[2]}/${matches[1]}`;
                                        }
                                        else {
                                            dateStr = d.toLocaleDateString('pt-BR');
                                        }
                                    }
                                }
                                catch (e) { }
                            }
                            const formattedVal = Number(tx.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                            const statusColor = tx.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200';
                            const statusText = tx.status === 'paid' ? 'Pago' : 'Pendente';
                            const typeColor = tx.txType === 'Receita' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
                            return `
                            <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                <td class="px-4 py-3 text-sm font-semibold ${typeColor} font-sans">${tx.txType}</td>
                                <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-sans">${tx.description || '-'}</td>
                                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono">${dateStr}</td>
                                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-sans">
                                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">${statusText}</span>
                                </td>
                                <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right font-mono">${formattedVal}</td>
                            </tr>
                        `;
                        }).join('');
                    }
                }
                // Filter & Render Tasks
                const tasks = (tasksRes.data || []).filter((t) => t.personType === 'contact' && t.personId === contactId);
                if (tasksTable) {
                    if (tasks.length === 0) {
                        tasksTable.innerHTML = '<tr><td colspan="3" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans">Nenhuma tarefa encontrada.</td></tr>';
                    }
                    else {
                        tasksTable.innerHTML = tasks.map((tk) => {
                            let dateStr = '-';
                            if (tk.due_date) {
                                try {
                                    const d = new Date(tk.due_date);
                                    if (!isNaN(d.getTime())) {
                                        dateStr = d.toLocaleDateString('pt-BR');
                                    }
                                }
                                catch (e) { }
                            }
                            const statusColor = tk.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200';
                            const statusText = tk.status === 'completed' ? 'Concluída' : 'Pendente';
                            return `
                            <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-sans">${tk.title}</td>
                                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono">${dateStr}</td>
                                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-sans">
                                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">${statusText}</span>
                                </td>
                            </tr>
                        `;
                        }).join('');
                    }
                }
                // ── Notes Handlers ──
                const fetchAndRenderNotes = async () => {
                    if (!notesList)
                        return;
                    try {
                        const res = await api(`/entities/contacts/${contactId}/notes`);
                        const notes = res.data || [];
                        if (notes.length === 0) {
                            notesList.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 font-sans text-center py-4">Nenhuma anotação registrada.</p>';
                            return;
                        }
                        notesList.innerHTML = notes.map((n) => {
                            const dateStr = n.created_at ? formatNoteDate(n.created_at) : '';
                            return `
                            <div class="p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm flex justify-between items-start gap-4">
                                <div class="flex-1 min-w-0">
                                    <p class="text-xs font-semibold text-brand-600 dark:text-brand-400 font-sans mb-1">
                                        ${n.user_name || 'Usuário'} · <span class="text-gray-400 dark:text-gray-500 font-normal font-mono text-[10px]">${dateStr}</span>
                                    </p>
                                    <p class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-sans">${n.note}</p>
                                </div>
                                <button type="button" class="btn-delete-contact-note text-gray-400 hover:text-red-500 p-1 rounded transition-colors" data-id="${n.public_id}" title="Excluir anotação">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                    </svg>
                                </button>
                            </div>
                        `;
                        }).join('');
                        // Bind note delete buttons
                        notesList.querySelectorAll('.btn-delete-contact-note').forEach((btn) => {
                            btn.addEventListener('click', async () => {
                                const noteId = btn.dataset.id;
                                if (!noteId)
                                    return;
                                if (!confirm('Deseja realmente excluir esta anotação?'))
                                    return;
                                try {
                                    btn.disabled = true;
                                    await api(`/entities/contacts/${contactId}/notes/${noteId}`, { method: 'DELETE' });
                                    UI.showAlert('alertMessage', 'Anotação excluída com sucesso!', 'success');
                                    await fetchAndRenderNotes();
                                }
                                catch (err) {
                                    alert(err.message || 'Erro ao excluir anotação.');
                                    btn.disabled = false;
                                }
                            });
                        });
                    }
                    catch (err) {
                        notesList.innerHTML = '<p class="text-sm text-red-500 font-sans">Erro ao carregar anotações.</p>';
                    }
                };
                await fetchAndRenderNotes();
                // Bind Note Form Submit
                const notesForm = getById('viewDetailsNotesForm');
                if (notesForm) {
                    const newForm = notesForm.cloneNode(true);
                    notesForm.parentNode.replaceChild(newForm, notesForm);
                    newForm.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const txtInput = getById('detailNoteText');
                        const val = txtInput?.value?.trim();
                        if (!val)
                            return;
                        const submitBtn = getById('btnSubmitDetailNote');
                        try {
                            if (submitBtn)
                                submitBtn.disabled = true;
                            await api(`/entities/contacts/${contactId}/notes`, {
                                method: 'POST',
                                body: JSON.stringify({ note: val })
                            });
                            if (txtInput)
                                txtInput.value = '';
                            UI.showAlert('alertMessage', 'Anotação adicionada!', 'success');
                            await fetchAndRenderNotes();
                        }
                        catch (err) {
                            alert(err.message || 'Erro ao criar anotação.');
                        }
                        finally {
                            if (submitBtn)
                                submitBtn.disabled = false;
                        }
                    });
                }
                // ── Documents Handlers ──
                let docUrlField = contact?.cnpj_document_url;
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
                                return { name: item.substring(item.lastIndexOf('/') + 1), url: item, attachedAt: new Date().toISOString() };
                            }
                            return {
                                name: item.name || item.url.substring(item.url.lastIndexOf('/') + 1),
                                url: item.url,
                                attachedAt: item.attachedAt || new Date().toISOString()
                            };
                        }).filter(d => d && d.url);
                    }
                    catch (e) {
                        docsList = [{ name: docUrlField.substring(docUrlField.lastIndexOf('/') + 1), url: docUrlField, attachedAt: new Date().toISOString() }];
                    }
                }
                const renderDetailsDocsList = () => {
                    if (!docContainer)
                        return;
                    docsList.sort((a, b) => new Date(b.attachedAt || 0).getTime() - new Date(a.attachedAt || 0).getTime());
                    if (docsList.length === 0) {
                        docContainer.innerHTML = `
                        <div class="flex flex-col items-center justify-center py-12 gap-2 text-gray-400 dark:text-gray-500 w-full font-sans">
                            <svg class="w-12 h-12 text-gray-300 dark:text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                            </svg>
                            <p class="text-sm font-medium">Nenhum documento anexado para este contato.</p>
                        </div>
                    `;
                        return;
                    }
                    const cardsHtml = docsList.map((doc, idx) => {
                        const fileName = doc.url.substring(doc.url.lastIndexOf('/') + 1);
                        const attachedDateStr = formatAttachedDate(doc.attachedAt);
                        return `
                        <div class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:border-brand-300 dark:hover:border-brand-700 transition-all font-sans font-medium">
                            <button type="button" class="btn-view-pdf-modal flex items-center gap-3 flex-1 min-w-0 mr-4 group text-left cursor-pointer" data-url="${doc.url}" data-name="${doc.name || fileName}">
                                <div class="p-2 rounded bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/60 transition-colors">
                                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                    </svg>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">${doc.name}</p>
                                    <p class="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">${fileName}</p>
                                    ${attachedDateStr ? `
                                        <p class="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-1 flex items-center gap-1">
                                            <svg class="w-3.5 h-3.5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                            ${attachedDateStr}
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
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
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
                            renameEntityId = contactId;
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
                            deleteEntityId = contactId;
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
                renderDetailsDocsList();
                // Bind Upload File Input Change in Details Tab
                const detailCnpjFileInput = getById('detailCnpjFile');
                if (detailCnpjFileInput) {
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
                                console.error('Erro ao ler arquivo para upload', err);
                            }
                        }
                        if (uploads.length > 0) {
                            try {
                                newFileInput.disabled = true;
                                if (docContainer) {
                                    docContainer.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Enviando documentos...</p>';
                                }
                                await api(`/entities/contacts/${contactId}`, {
                                    method: 'PUT',
                                    body: JSON.stringify({
                                        cnpj_document_url: JSON.stringify(docsList),
                                        cnpj_document_uploads: uploads
                                    })
                                });
                                UI.showAlert('alertMessage', 'Documentos anexados com sucesso!', 'success');
                                await contactsManager.loadData();
                                const updatedContact = contactsManager?.data?.find((c) => c.public_id === contactId);
                                const updatedField = updatedContact?.cnpj_document_url;
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
                                                return { name: item.substring(item.lastIndexOf('/') + 1), url: item, attachedAt: new Date().toISOString() };
                                            }
                                            return {
                                                name: item.name || item.url.substring(item.url.lastIndexOf('/') + 1),
                                                url: item.url,
                                                attachedAt: item.attachedAt || new Date().toISOString()
                                            };
                                        }).filter(d => d && d.url);
                                    }
                                    catch (e) {
                                        docsList = [{ name: updatedField.substring(updatedField.lastIndexOf('/') + 1), url: updatedField, attachedAt: new Date().toISOString() }];
                                    }
                                }
                                renderDetailsDocsList();
                            }
                            catch (err) {
                                alert(err.message || 'Erro ao anexar documentos.');
                            }
                            finally {
                                newFileInput.disabled = false;
                                newFileInput.value = '';
                            }
                        }
                    });
                }
            }
            catch (error) {
                console.error('Erro ao carregar detalhes do contato:', error);
                UI.showAlert('alertMessage', 'Falha ao carregar detalhes.', 'error');
            }
        }
        function getBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
        }
        function formatAttachedDate(isoStr) {
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
        const hasViewPermission = (moduleName) => {
            const authCtx = window.gNavbarAuthContext;
            if (!authCtx)
                return true;
            const role = authCtx.user?.role || '';
            if (role === 'super_admin' || role === 'admin' || role === 'supervisor')
                return true;
            const permissions = authCtx.permissions || [];
            if (permissions.length === 0)
                return true;
            return permissions.some((p) => p.module === moduleName && p.can_view);
        };
        function setupDetailsModalTabs() {
            const tabButtons = document.querySelectorAll('#viewContactDetailsModal .details-modal-tab');
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
                    document.querySelectorAll('#viewContactDetailsModal .details-modal-tab-panel').forEach((panel) => {
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
            const tabButtons = Array.from(document.querySelectorAll('#viewContactDetailsModal .details-modal-tab'));
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
            document.querySelectorAll('#viewContactDetailsModal .details-modal-tab-panel').forEach((panel) => {
                const panelId = panel.getAttribute('id');
                const correspondingBtn = tabButtons.find((btn) => btn.getAttribute('data-details-tab-target') === panelId);
                const shouldBeVisible = correspondingBtn && visibleButtons.length > 0 && correspondingBtn === visibleButtons[0];
                if (shouldBeVisible) {
                    panel.classList.remove('hidden');
                }
                else {
                    panel.classList.add('hidden');
                }
            });
        }
    });
})();
