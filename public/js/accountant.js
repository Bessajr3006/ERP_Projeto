(() => {
    let accountantsManager;
    let accountantDocMask = null;
    let accountantPhoneMask = null;
    let accountantZipMask = null;
    let accountantIbgeStates = [];
    const api = window.api;
    const Auth = window.Auth;
    const UI = window.UI;
    const getById = (id) => document.getElementById(id);
    const makeMask = window.createMaskAdapter || ((input, options) => window.IMask(input, options));
    const onlyDigits = (value) => String(value || '').replace(/\D/g, '');
    const setMaskedValue = (maskInstance, inputId, value) => {
        if (maskInstance) {
            if (inputId === 'accountantDocument') {
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
    };
    const getMaskedValue = (maskInstance, inputId) => {
        if (maskInstance)
            return maskInstance.unmaskedValue || '';
        const val = getById(inputId)?.value || '';
        if (inputId === 'accountantDocument') {
            return String(val).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        }
        return onlyDigits(val);
    };
    const getTrimmedValue = (inputId) => String(getById(inputId)?.value || '').trim();
    const formatDoc = (doc) => {
        if (!doc)
            return '-';
        const clean = String(doc).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (clean.length === 11)
            return clean.replace(/([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{2})/, '$1.$2.$3-$4');
        if (clean.length === 14)
            return clean.replace(/([a-zA-Z0-9]{2})([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{4})([a-zA-Z0-9]{2})/, '$1.$2.$3/$4-$5');
        return String(doc);
    };
    const formatPhone = (phone) => {
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
        return String(phone);
    };
    const formatAccountantLocation = (item) => {
        const city = String(item.city || '').trim();
        const state = String(item.state || '').trim();
        if (!city && !state)
            return 'Não informado';
        return [city, state].filter(Boolean).join(' / ');
    };
    const populateAccountantStateOptions = (selectedValue = '') => {
        const stateSelect = getById('accountantState');
        if (!stateSelect || !accountantIbgeStates.length)
            return;
        const normalizedSelectedValue = String(selectedValue || '').trim().toUpperCase();
        stateSelect.innerHTML = [
            '<option value="">Selecione...</option>',
            ...accountantIbgeStates.map((state) => `<option value="${state.uf}">${state.uf} - ${state.name}</option>`),
        ].join('');
        stateSelect.value = accountantIbgeStates.some((state) => state.uf === normalizedSelectedValue)
            ? normalizedSelectedValue
            : '';
    };
    const loadAccountantStateOptions = async (selectedValue = '') => {
        try {
            if (!accountantIbgeStates.length) {
                const response = await api('/companies/states');
                accountantIbgeStates = response.data || [];
            }
            populateAccountantStateOptions(selectedValue);
        }
        catch (error) {
            console.error('Falha ao carregar UFs do IBGE para contadores', error);
        }
    };
    const lookupAddressByCep = async (cep) => {
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
        if (!data && !cepNotFound) {
            try {
                const brasilApiResponse = await fetch(`https://brasilapi.com.br/api/cep/v1/${normalizedCep}`);
                if (brasilApiResponse.ok) {
                    data = await brasilApiResponse.json();
                }
            }
            catch (_error) { }
        }
        return data;
    };
    const applyAccountantCepLookupResult = (data) => {
        if (!data)
            return;
        getById('accountantStreet').value = data.street || '';
        getById('accountantNeighborhood').value = data.neighborhood || '';
        getById('accountantCity').value = data.city || '';
        getById('accountantComplement').value = data.complement || '';
        populateAccountantStateOptions(data.state || '');
    };
    const handleAccountantCepLookup = async () => {
        const loader = getById('accountantCepLoading');
        const cep = getMaskedValue(accountantZipMask, 'accountantZipcode');
        if (cep.length !== 8)
            return;
        if (loader)
            loader.classList.remove('hidden');
        try {
            const data = await lookupAddressByCep(cep);
            if (data && (data.street || data.city)) {
                applyAccountantCepLookupResult(data);
            }
            else {
                UI.showAlert('alertMessage', 'CEP do contador não encontrado ou inválido.', 'error');
            }
        }
        catch (error) {
            console.error('Falha ao consultar CEP', error);
        }
        finally {
            if (loader)
                loader.classList.add('hidden');
        }
    };
    const handleAccountantDocumentLookup = async () => {
        const documentValue = getMaskedValue(accountantDocMask, 'accountantDocument');
        if (documentValue.length !== 14)
            return;
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${documentValue}`);
            const data = await response.json();
            if (!response.ok || !data?.razao_social) {
                UI.showAlert('alertMessage', 'CNPJ do contador não encontrado ou inválido.', 'error');
                return;
            }
            if (!getTrimmedValue('accountantName'))
                getById('accountantName').value = data.nome_fantasia || data.razao_social || '';
            if (!getTrimmedValue('accountantEmail'))
                getById('accountantEmail').value = data.email || '';
            if (!getMaskedValue(accountantPhoneMask, 'accountantPhone'))
                setMaskedValue(accountantPhoneMask, 'accountantPhone', data.ddd_telefone_1 || '');
            if (!getMaskedValue(accountantZipMask, 'accountantZipcode'))
                setMaskedValue(accountantZipMask, 'accountantZipcode', data.cep || '');
            if (!getTrimmedValue('accountantStreet'))
                getById('accountantStreet').value = data.logradouro || '';
            if (!getTrimmedValue('accountantNumber'))
                getById('accountantNumber').value = data.numero || '';
            if (!getTrimmedValue('accountantComplement'))
                getById('accountantComplement').value = data.complemento || '';
            if (!getTrimmedValue('accountantNeighborhood'))
                getById('accountantNeighborhood').value = data.bairro || '';
            if (!getTrimmedValue('accountantCity'))
                getById('accountantCity').value = data.municipio || '';
            populateAccountantStateOptions(data.uf || '');
            if (data.cep) {
                const cepData = await lookupAddressByCep(data.cep);
                if (cepData) {
                    applyAccountantCepLookupResult({
                        ...cepData,
                        complement: cepData.complement || getTrimmedValue('accountantComplement') || data.complemento || '',
                    });
                }
            }
        }
        catch (error) {
            console.error('Falha ao consultar documento', error);
        }
    };
    const setupAccountantFormEnhancements = () => {
        const documentInput = getById('accountantDocument');
        const phoneInput = getById('accountantPhone');
        const zipcodeInput = getById('accountantZipcode');
        if (documentInput && !accountantDocMask) {
            accountantDocMask = makeMask(documentInput, {
                mask: [
                    { mask: '000.000.000-00' },
                    {
                        mask: 'XX.XXX.XXX/XXXX-XX',
                        definitions: {
                            'X': /[a-zA-Z0-9]/
                        }
                    }
                ],
                prepare: (str) => str.toUpperCase()
            });
            documentInput.addEventListener('blur', handleAccountantDocumentLookup);
        }
        if (phoneInput && !accountantPhoneMask) {
            accountantPhoneMask = makeMask(phoneInput, {
                mask: [{ mask: '(00) 0000-0000' }, { mask: '(00) 00000-0000' }],
            });
        }
        if (zipcodeInput && !accountantZipMask) {
            accountantZipMask = makeMask(zipcodeInput, { mask: '00000-000' });
            accountantZipMask.on('complete', handleAccountantCepLookup);
        }
        const btnSearchAccountantCep = document.getElementById('btnSearchAccountantCep');
        if (btnSearchAccountantCep) {
            btnSearchAccountantCep.addEventListener('click', () => {
                void handleAccountantCepLookup();
            });
        }
    };
    const applyAccountantPrefillFromQuery = () => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('prefill') !== 'accountant')
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
            const nameInput = getById('accountantName');
            const currentName = String(nameInput?.value || '').trim();
            if (nameInput && !currentName && prefillName) {
                nameInput.value = prefillName;
            }
            const currentPhone = getMaskedValue(accountantPhoneMask, 'accountantPhone');
            if (!currentPhone && prefillPhone) {
                setMaskedValue(accountantPhoneMask, 'accountantPhone', prefillPhone);
            }
        });
        UI?.showAlert?.('alertMessage', 'Preenchimento aplicado. Revise os dados e clique em Salvar.', 'success', 4500);
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('prefill');
        cleanUrl.searchParams.delete('name');
        cleanUrl.searchParams.delete('phone');
        window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
    };
    document.addEventListener('DOMContentLoaded', () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }
        setupAccountantFormEnhancements();
        loadAccountantStateOptions('');
        setupDetailsModalTabs();
        api('/auth/me')
            .then((res) => {
            const userGreeting = getById('userGreeting');
            if (userGreeting && res.data && res.data.user) {
                userGreeting.textContent = `Olá, ${res.data.user.full_name || 'Usuário'}`;
            }
            else if (userGreeting && res.data) {
                userGreeting.textContent = `Olá, ${res.data.full_name || 'Usuário'}`;
            }
        })
            .catch(console.error);
        const FilterPanel = window.FilterPanel;
        accountantsManager = new window.CrudManager({
            entityName: 'Contador',
            endpoint: '/users',
            tableId: 'accountantsTable',
            tableSectionId: 'accountantsSection',
            modalId: 'entityModal',
            disableSummaryFooter: true,
            filterConfig: {
                storageKey: 'accountants_filter_panel',
                fields: [
                    { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome, documento, email...' },
                    {
                        id: 'filterStatus',
                        type: 'select',
                        label: 'Status',
                        options: [
                            { value: '', label: 'Todos' },
                            { value: 'active', label: 'Ativos' },
                            { value: 'inactive', label: 'Inativos' },
                        ],
                    },
                ],
            },
            applyFilters: (data) => {
                const search = FilterPanel.normalizeText(getById('filterSearch')?.value);
                const searchDigits = FilterPanel.onlyDigits(search);
                const status = getById('filterStatus')?.value || '';
                const filtered = data.filter((item) => {
                    if (item.role !== 'accountant')
                        return false;
                    if (status === 'active' && !item.is_active)
                        return false;
                    if (status === 'inactive' && item.is_active)
                        return false;
                    if (!search)
                        return true;
                    if (FilterPanel.matchesSearch(item, ['full_name', 'email', 'cpf_cnpj', 'phone', 'city', 'state'], search))
                        return true;
                    if (!searchDigits)
                        return false;
                    return [item.cpf_cnpj, item.phone]
                        .map((value) => FilterPanel.onlyDigits(value))
                        .some((value) => String(value).includes(searchDigits));
                });
                window.GridSummaryFooter?.update({
                    footerId: 'accountantsResultsFooter',
                    anchorId: 'accountantsSection',
                    count: filtered.length,
                    label: 'contador(es) exibido(s)',
                });
                return filtered;
            },
            renderTable: (items) => {
                const tbody = getById('accountantsTable');
                if (items.length === 0) {
                    tbody.innerHTML =
                        '<tr><td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum contador encontrado.</td></tr>';
                    return;
                }
                tbody.innerHTML = items
                    .map((item, index) => {
                    const isDefaultSigner = Boolean(item.is_default_declaration_signer);
                    return `
                <tr class="${!item.is_active ? 'opacity-50' : ''}">
                    <td class="px-3 py-4 whitespace-nowrap text-left w-12">
                        <input type="checkbox" id="chk_tbl_${item.public_id}" name="accountantSelect[]" value="${item.public_id}" placeholder="" data-bwignore="true" class="item-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800">
                    </td>
                    <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">#${String(index + 1).padStart(4, '0')}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        <div class="flex items-center gap-2">
                            <span>${item.full_name}</span>
                            ${isDefaultSigner
                        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" title="Contador padrão para assinatura de declarações e relatórios fiscais">
                                     <svg class="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                                     Padrão
                                   </span>`
                        : ''}
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${formatDoc(item.cpf_cnpj)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div class="truncate max-w-55" title="${item.email || ''}">${item.email || '-'}</div>
                        <div>${formatPhone(item.phone)}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${formatAccountantLocation(item)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        ${item.is_active
                        ? '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Ativo</span>'
                        : '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Inativo</span>'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button type="button" title="${isDefaultSigner ? 'Contador padrão para declarações' : 'Definir como contador padrão para declarações'}" class="mr-2 set-default-signer-btn transition-colors ${isDefaultSigner ? 'text-amber-500 hover:text-amber-600 dark:text-amber-400' : 'text-gray-400 hover:text-amber-500 dark:hover:text-amber-400'}" data-id="${item.public_id}" data-name="${item.full_name}" data-is-default="${isDefaultSigner}">
                            <svg class="w-5 h-5 inline ${isDefaultSigner ? 'fill-amber-400 text-amber-500' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
                        </button>
                        <button type="button" title="Detalhes" class="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 mr-2 open-details-btn" data-id="${item.public_id}" data-name="${item.full_name}">
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        </button>
                        <button type="button" title="Editar" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-2 edit-btn" data-item='${JSON.stringify(item).replace(/'/g, '&#39;')}' data-id="${item.public_id}">
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        ${item.is_active
                        ? `<button type="button" title="Desativar" class="text-red-600 hover:text-red-900 dark:hover:text-red-400 mr-2 toggle-status-btn" data-id="${item.public_id}" data-action="false">
                                 <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                               </button>`
                        : `<button type="button" title="Ativar" class="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 mr-2 toggle-status-btn" data-id="${item.public_id}" data-action="true">
                                 <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                               </button>`}
                    </td>
                </tr>
            `;
                })
                    .join('');
            },
            onEdit: (data) => {
                getById('entityForm')?.reset();
                const accountantIdInput = getById('accountantId');
                const modalTitle = getById('modalTitle');
                const passwordInput = getById('accountantPassword');
                const passwordHint = getById('passwordHint');
                const statusSelect = getById('accountantStatus');
                const isDefaultCheckbox = getById('accountantIsDefaultSigner');
                if (data && data.public_id) {
                    modalTitle.textContent = 'Editar Contador';
                    accountantIdInput.value = data.public_id || '';
                    getById('accountantName').value = data.full_name || '';
                    getById('accountantEmail').value = data.email || '';
                    getById('accountantCrc').value = data.crc || '';
                    getById('accountantStreet').value = data.street || '';
                    getById('accountantNumber').value = data.number || '';
                    getById('accountantComplement').value = data.complement || '';
                    getById('accountantNeighborhood').value = data.neighborhood || '';
                    getById('accountantCity').value = data.city || '';
                    if (statusSelect) {
                        statusSelect.value = data.is_active === false ? 'inactive' : 'active';
                    }
                    if (isDefaultCheckbox) {
                        isDefaultCheckbox.checked = Boolean(data.is_default_declaration_signer);
                    }
                    setMaskedValue(accountantDocMask, 'accountantDocument', data.cpf_cnpj || '');
                    setMaskedValue(accountantPhoneMask, 'accountantPhone', data.phone || '');
                    setMaskedValue(accountantZipMask, 'accountantZipcode', data.zipcode || '');
                    loadAccountantStateOptions(data.state || '');
                    passwordInput.removeAttribute('required');
                    passwordHint.classList.remove('hidden');
                }
                else {
                    modalTitle.textContent = 'Novo Contador';
                    accountantIdInput.value = '';
                    setMaskedValue(accountantDocMask, 'accountantDocument', '');
                    setMaskedValue(accountantPhoneMask, 'accountantPhone', '');
                    setMaskedValue(accountantZipMask, 'accountantZipcode', '');
                    if (statusSelect) {
                        statusSelect.value = 'active';
                    }
                    if (isDefaultCheckbox) {
                        isDefaultCheckbox.checked = false;
                    }
                    loadAccountantStateOptions('');
                    passwordInput.setAttribute('required', 'true');
                    passwordHint.classList.add('hidden');
                }
                getById('entityModal').classList.remove('hidden');
            },
        });
        accountantsManager.init();
        applyAccountantPrefillFromQuery();
        document.addEventListener('click', async (e) => {
            const defaultBtn = e.target?.closest?.('.set-default-signer-btn');
            if (defaultBtn) {
                const id = defaultBtn.getAttribute('data-id');
                const name = defaultBtn.getAttribute('data-name') || 'Contador';
                const isCurrentlyDefault = defaultBtn.getAttribute('data-is-default') === 'true';
                if (isCurrentlyDefault) {
                    UI.showAlert('alertMessage', `${name} já é o contador padrão para assinatura de declarações.`, 'info');
                    return;
                }
                if (!confirm(`Deseja definir ${name} como o contador padrão para assinar as declarações fiscais e de faturamento?`)) {
                    return;
                }
                try {
                    await api(`/users/${id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ is_default_declaration_signer: true }),
                    });
                    UI.showAlert('alertMessage', `${name} definido como contador padrão de declarações com sucesso!`, 'success');
                    await accountantsManager.loadData();
                }
                catch (error) {
                    UI.showAlert('alertMessage', error.message || 'Erro ao definir contador padrão.', 'error');
                }
                return;
            }
            const btn = e.target?.closest?.('.toggle-status-btn');
            if (btn) {
                const id = btn.getAttribute('data-id');
                const action = btn.getAttribute('data-action') === 'true';
                if (!confirm(`Tem certeza que deseja ${action ? 'ativar' : 'desativar'} este contador?`))
                    return;
                try {
                    await api(`/users/${id}/status`, {
                        method: 'PATCH',
                        body: JSON.stringify({ is_active: action }),
                    });
                    UI.showAlert('alertMessage', `Contador ${action ? 'ativado' : 'desativado'} com sucesso!`, 'success');
                    await accountantsManager.loadData();
                }
                catch (error) {
                    UI.showAlert('alertMessage', error.message || 'Erro ao atualizar status do contador.', 'error');
                }
            }
        });
        getById('entityForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const saveBtn = getById('saveBtn');
            const accountantId = getTrimmedValue('accountantId');
            const isEditing = Boolean(accountantId);
            const payload = {
                full_name: getTrimmedValue('accountantName'),
                email: getTrimmedValue('accountantEmail'),
                passwordRaw: getTrimmedValue('accountantPassword'),
                role: 'accountant',
                is_active: (getById('accountantStatus')?.value || 'active') !== 'inactive',
                is_default_declaration_signer: Boolean(getById('accountantIsDefaultSigner')?.checked),
                cpf_cnpj: getMaskedValue(accountantDocMask, 'accountantDocument') || undefined,
                crc: getTrimmedValue('accountantCrc') || undefined,
                phone: getMaskedValue(accountantPhoneMask, 'accountantPhone') || undefined,
                zipcode: getMaskedValue(accountantZipMask, 'accountantZipcode') || undefined,
                street: getTrimmedValue('accountantStreet') || undefined,
                number: getTrimmedValue('accountantNumber') || undefined,
                complement: getTrimmedValue('accountantComplement') || undefined,
                neighborhood: getTrimmedValue('accountantNeighborhood') || undefined,
                city: getTrimmedValue('accountantCity') || undefined,
                state: getTrimmedValue('accountantState') || undefined,
            };
            if (isEditing && !payload.passwordRaw) {
                payload.passwordRaw = '';
            }
            saveBtn.disabled = true;
            saveBtn.textContent = 'Salvando...';
            const endpoint = isEditing ? `/users/${accountantId}` : '/users';
            const method = isEditing ? 'PATCH' : 'POST';
            try {
                await api(endpoint, {
                    method,
                    body: JSON.stringify(payload),
                });
                UI.showAlert('alertMessage', isEditing ? 'Contador atualizado com sucesso!' : 'Contador cadastrado com sucesso!', 'success');
                accountantsManager.closeModal();
                await accountantsManager.loadData();
            }
            catch (error) {
                UI.showAlert('alertMessage', error.message || 'Erro ao salvar contador.', 'error');
            }
            finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Salvar';
            }
        });
        document.addEventListener('click', (e) => {
            const target = e.target;
            const btn = target?.closest('.open-details-btn');
            if (btn) {
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name') || '';
                if (id) {
                    void openViewDetailsModal(id, name);
                }
            }
        });
        function setupDetailsModalTabs() {
            const tabButtons = document.querySelectorAll('#viewAccountantDetailsModal .details-modal-tab');
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
                    document.querySelectorAll('#viewAccountantDetailsModal .details-modal-tab-panel').forEach((panel) => {
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
            const tabButtons = Array.from(document.querySelectorAll('#viewAccountantDetailsModal .details-modal-tab'));
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
            document.querySelectorAll('#viewAccountantDetailsModal .details-modal-tab-panel').forEach((panel) => {
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
        async function openViewDetailsModal(accountantId, accountantName) {
            const modal = getById('viewAccountantDetailsModal');
            const closeBtn = modal?.querySelector('#btnCloseViewDetailsModal');
            const cancelBtn = modal?.querySelector('#btnCancelViewDetailsModal');
            const backdrop = modal?.querySelector('#viewDetailsModalBackdrop');
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
            // Populate basic accountant details
            const accountant = accountantsManager?.data?.find((c) => c.public_id === accountantId);
            const docEl = modal.querySelector('#viewDetailsDocument');
            const emailEl = modal.querySelector('#viewDetailsEmail');
            const phoneEl = modal.querySelector('#viewDetailsPhone');
            const locEl = modal.querySelector('#viewDetailsLocation');
            const titleNameEl = modal.querySelector('#viewDetailsAccountantName');
            if (titleNameEl)
                titleNameEl.textContent = accountantName;
            if (docEl)
                docEl.textContent = formatDoc(accountant?.cpf_cnpj);
            if (emailEl) {
                emailEl.textContent = accountant?.email || 'Não informado';
                emailEl.title = accountant?.email || '';
            }
            if (phoneEl)
                phoneEl.textContent = formatPhone(accountant?.phone);
            if (locEl)
                locEl.textContent = formatAccountantLocation(accountant || {});
            // Map configuration
            const mapAccountantAddressSpan = modal.querySelector('#mapAccountantAddress');
            const googleMapsIframe = modal.querySelector('#googleMapsIframe');
            const btnOpenWaze = modal.querySelector('#btnOpenWaze');
            const btnOpenGoogleMaps = modal.querySelector('#btnOpenGoogleMaps');
            if (accountant) {
                const addressParts = [
                    accountant.street,
                    accountant.number,
                    accountant.neighborhood,
                    accountant.city,
                    accountant.state,
                    accountant.zipcode
                ].filter(Boolean);
                const addressStr = addressParts.join(', ');
                if (mapAccountantAddressSpan) {
                    mapAccountantAddressSpan.textContent = addressStr || 'Endereço não cadastrado';
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
                if (addressStr) {
                    let embedUrl = '';
                    let mapsUrl = '';
                    let wazeUrl = '';
                    if (companyAddressStr) {
                        embedUrl = `https://maps.google.com/maps?saddr=${encodeURIComponent(companyAddressStr)}&daddr=${encodeURIComponent(addressStr)}&output=embed`;
                        mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(companyAddressStr)}&destination=${encodeURIComponent(addressStr)}`;
                        wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(addressStr)}&navigate=yes`;
                    }
                    else {
                        embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(addressStr)}&output=embed`;
                        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressStr)}`;
                        wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(addressStr)}&navigate=yes`;
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
                if (mapAccountantAddressSpan)
                    mapAccountantAddressSpan.textContent = 'Não encontrado';
                if (googleMapsIframe)
                    googleMapsIframe.removeAttribute('src');
                if (btnOpenWaze)
                    btnOpenWaze.classList.add('hidden');
                if (btnOpenGoogleMaps)
                    btnOpenGoogleMaps.classList.add('hidden');
            }
            resetDetailsModalTabs();
            const docContainer = modal.querySelector('#viewDetailsDocumentContainer');
            let docsList = [];
            const parseCnpjDocuments = (val) => {
                if (!val)
                    return [];
                let list = [];
                if (Array.isArray(val)) {
                    list = val;
                }
                else {
                    try {
                        if (typeof val === 'string' && val.trim().startsWith('[')) {
                            list = JSON.parse(val);
                        }
                        else if (typeof val === 'string' && val.trim() !== '') {
                            list = [val];
                        }
                    }
                    catch (e) { }
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
                }).filter(Boolean);
            };
            docsList = parseCnpjDocuments(accountant?.cnpj_document_url);
            const getBase64 = (file) => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                });
            };
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
            const detailCnpjFileInput = modal.querySelector('#detailCnpjFile');
            if (detailCnpjFileInput) {
                const newFileInput = detailCnpjFileInput.cloneNode(true);
                detailCnpjFileInput.parentNode?.replaceChild(newFileInput, detailCnpjFileInput);
                newFileInput.addEventListener('change', async (e) => {
                    const files = Array.from(newFileInput.files || []);
                    if (files.length === 0)
                        return;
                    const uploads = [];
                    for (const file of files) {
                        try {
                            const b64 = (await getBase64(file));
                            const defaultName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                            uploads.push({
                                name: defaultName,
                                base64: b64,
                                attachedAt: new Date().toISOString(),
                                filename: file.name
                            });
                        }
                        catch (err) {
                            console.error(err);
                        }
                    }
                    if (uploads.length > 0) {
                        try {
                            newFileInput.disabled = true;
                            if (docContainer)
                                docContainer.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 animate-pulse font-sans">Enviando documentos...</p>';
                            await api(`/users/${accountantId}`, {
                                method: 'PUT',
                                body: JSON.stringify({
                                    cnpj_document_uploads: uploads
                                })
                            });
                            window.UI.showAlert('alertMessage', 'Documentos anexados com sucesso!', 'success');
                            await accountantsManager.loadData();
                            const updatedAccountant = accountantsManager?.data?.find((c) => c.public_id === accountantId);
                            docsList = parseCnpjDocuments(updatedAccountant?.cnpj_document_url);
                            renderDetailsDocsList();
                        }
                        catch (err) {
                            console.error(err);
                            window.UI.showAlert('alertMessage', err.message || 'Erro ao enviar documentos.', 'error');
                            renderDetailsDocsList();
                        }
                        finally {
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
                newDocContainer.addEventListener('click', async (e) => {
                    const target = e.target;
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
                                    await api(`/users/${accountantId}`, {
                                        method: 'PUT',
                                        body: JSON.stringify({
                                            cnpj_document_url: JSON.stringify(docsList)
                                        })
                                    });
                                    window.UI.showAlert('alertMessage', 'Documento renomeado com sucesso!', 'success');
                                    await accountantsManager.loadData();
                                    renderDetailsDocsList();
                                }
                                catch (err) {
                                    console.error(err);
                                    window.UI.showAlert('alertMessage', 'Erro ao renomear documento.', 'error');
                                }
                            }
                        }
                    }
                    if (deleteBtn) {
                        const idx = parseInt(deleteBtn.getAttribute('data-index') || '0', 10);
                        if (confirm('Deseja realmente excluir este documento?')) {
                            docsList.splice(idx, 1);
                            try {
                                await api(`/users/${accountantId}`, {
                                    method: 'PUT',
                                    body: JSON.stringify({
                                        cnpj_document_url: JSON.stringify(docsList)
                                    })
                                });
                                window.UI.showAlert('alertMessage', 'Documento excluído com sucesso!', 'success');
                                await accountantsManager.loadData();
                                renderDetailsDocsList();
                            }
                            catch (err) {
                                console.error(err);
                                window.UI.showAlert('alertMessage', 'Erro ao excluir documento.', 'error');
                            }
                        }
                    }
                });
            }
            // ── Loader / API calls ──
            const financialsTable = modal.querySelector('#viewDetailsFinancialsTable');
            const tasksTable = modal.querySelector('#viewDetailsTasksTable');
            if (financialsTable)
                financialsTable.innerHTML = '<tr><td colspan="4" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans animate-pulse">Carregando...</td></tr>';
            if (tasksTable)
                tasksTable.innerHTML = '<tr><td colspan="3" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans animate-pulse">Carregando...</td></tr>';
            try {
                const [revenuesRes, expensesRes, tasksRes] = await Promise.all([
                    api('/finance/revenues').catch(() => ({ data: [] })),
                    api('/finance/expenses').catch(() => ({ data: [] })),
                    api('/tasks').catch(() => ({ data: [] }))
                ]);
                // Filter transactions
                const revenues = (revenuesRes.data || []).filter((tx) => tx.related_user_public_id === accountantId);
                const expenses = (expensesRes.data || []).filter((tx) => tx.related_user_public_id === accountantId);
                const transactions = [...revenues, ...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                if (financialsTable) {
                    if (transactions.length === 0) {
                        financialsTable.innerHTML = '<tr><td colspan="4" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans">Nenhum lançamento financeiro encontrado.</td></tr>';
                    }
                    else {
                        financialsTable.innerHTML = transactions.map((t) => `
                        <tr>
                            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 font-sans">${t.description}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-sans">${new Date(t.date).toLocaleDateString('pt-BR')}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-sans">${t.status === 'paid' ? 'Pago' : 'Pendente'}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-mono ${t.type === 'revenue' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                                ${t.type === 'revenue' ? '+' : '-'}${Number(t.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                        </tr>
                    `).join('');
                    }
                }
                // Filter tasks
                const tasks = (tasksRes.data || []).filter((t) => t.personType === 'accountant' && t.personId === accountantId);
                if (tasksTable) {
                    if (tasks.length === 0) {
                        tasksTable.innerHTML = '<tr><td colspan="3" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans">Nenhuma tarefa encontrada.</td></tr>';
                    }
                    else {
                        tasksTable.innerHTML = tasks.map((t) => `
                        <tr>
                            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 font-sans">${t.title}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-sans">${t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-BR') : '-'}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-sans">${t.status}</td>
                        </tr>
                    `).join('');
                    }
                }
            }
            catch (error) {
                console.error('Erro ao buscar dados do contador:', error);
            }
        }
    });
})();
