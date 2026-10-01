(() => {
    const api = window.api;
    const UI = window.UI;
    const CrudManager = window.CrudManager;
    const FilterPanel = window.FilterPanel;
    const GridSummaryFooter = window.GridSummaryFooter;
    const makeMask = window.createMaskAdapter || ((input, options) => window.IMask(input, options));
    let employeesManager;
    let employeeCpfMask = null;
    let employeePhoneMask = null;
    let employeeZipMask = null;
    let employeeIbgeStates = [];
    const getEl = (id) => document.getElementById(id);
    const onlyDigits = (value) => String(value || '').replace(/\D/g, '');
    function setMaskedValue(maskInstance, inputId, value) {
        if (maskInstance) {
            maskInstance.unmaskedValue = onlyDigits(value);
            return;
        }
        const input = getEl(inputId);
        if (input)
            input.value = value || '';
    }
    function getMaskedValue(maskInstance, inputId) {
        if (maskInstance)
            return maskInstance.unmaskedValue || '';
        return onlyDigits(getEl(inputId)?.value || '');
    }
    function getTrimmedValue(inputId) {
        return String(getEl(inputId)?.value || '').trim();
    }
    function formatCpf(cpf) {
        if (!cpf)
            return '-';
        const clean = String(cpf).replace(/\D/g, '');
        if (clean.length === 11)
            return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        return String(cpf);
    }
    function formatPhone(phone) {
        if (!phone)
            return '-';
        const clean = String(phone).replace(/\D/g, '');
        if (clean.length === 10)
            return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        if (clean.length === 11)
            return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        return String(phone);
    }
    function formatMoney(value) {
        const val = parseFloat(value);
        if (isNaN(val))
            return 'R$ 0,00';
        return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    function formatDate(dateStr) {
        if (!dateStr)
            return '-';
        const date = new Date(dateStr);
        if (isNaN(date.getTime()))
            return String(dateStr);
        // Adjust timezone offset to get correct calendar date
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
        return adjustedDate.toLocaleDateString('pt-BR');
    }
    function formatDateForInput(dateStr) {
        if (!dateStr)
            return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime()))
            return '';
        // Format to YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    function populateEmployeeStateOptions(selectedValue = '') {
        const stateSelect = getEl('employeeState');
        if (!stateSelect || !employeeIbgeStates.length)
            return;
        const normalizedSelectedValue = String(selectedValue || '').trim().toUpperCase();
        stateSelect.innerHTML = [
            '<option value="">Selecione...</option>',
            ...employeeIbgeStates.map((state) => `<option value="${state.uf}">${state.uf} - ${state.name}</option>`),
        ].join('');
        stateSelect.value = employeeIbgeStates.some((state) => state.uf === normalizedSelectedValue) ? normalizedSelectedValue : '';
    }
    async function loadEmployeeStateOptions(selectedValue = '') {
        try {
            if (!employeeIbgeStates.length) {
                const response = await api('/companies/states');
                employeeIbgeStates = response.data || [];
            }
            populateEmployeeStateOptions(selectedValue);
        }
        catch (error) {
            console.error('Falha ao carregar UFs do IBGE para colaboradores', error);
        }
    }
    async function lookupAddressByCep(cep) {
        const normalizedCep = onlyDigits(cep);
        if (normalizedCep.length !== 8)
            return null;
        try {
            const response = await api(`/companies/cep/${normalizedCep}`);
            return response.data || null;
        }
        catch (error) {
            console.error('Falha ao consultar CEP', error);
            return null;
        }
    }
    async function handleEmployeeCepLookup() {
        const cep = getMaskedValue(employeeZipMask, 'employeeZipCode');
        if (!cep)
            return;
        try {
            const data = await lookupAddressByCep(cep);
            if (!data)
                return;
            const street = getEl('employeeAddress');
            const city = getEl('employeeCity');
            if (street)
                street.value = [data.logradouro, data.bairro].filter(Boolean).join(', ') || '';
            if (city)
                city.value = data.localidade || '';
            populateEmployeeStateOptions(data.uf || '');
        }
        catch (e) {
            console.error(e);
        }
    }
    function showTab(tab) {
        const tabBtnDados = getEl('tabBtnDados');
        const tabBtnDocumento = getEl('tabBtnDocumento');
        const tabBtnContrato = getEl('tabBtnContrato');
        const tabContentDados = getEl('tabContentDados');
        const tabContentDocumento = getEl('tabContentDocumento');
        const tabContentContrato = getEl('tabContentContrato');
        if (!tabBtnDados || !tabBtnDocumento || !tabBtnContrato || !tabContentDados || !tabContentDocumento || !tabContentContrato)
            return;
        const activeClasses = ['border-brand-500', 'text-brand-600', 'dark:text-brand-400', 'border-b-2'];
        const inactiveClasses = ['border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300', 'dark:text-gray-400', 'dark:hover:text-gray-200'];
        const tabs = [
            { name: 'dados', btn: tabBtnDados, content: tabContentDados },
            { name: 'documento', btn: tabBtnDocumento, content: tabContentDocumento },
            { name: 'contrato', btn: tabBtnContrato, content: tabContentContrato }
        ];
        tabs.forEach(t => {
            if (t.name === tab) {
                t.content.classList.remove('hidden');
                t.content.classList.add('grid');
                t.btn.classList.add(...activeClasses);
                t.btn.classList.remove(...inactiveClasses);
                t.btn.setAttribute('aria-current', 'page');
            }
            else {
                t.content.classList.add('hidden');
                t.content.classList.remove('grid');
                t.btn.classList.remove(...activeClasses);
                t.btn.classList.add(...inactiveClasses);
                t.btn.removeAttribute('aria-current');
            }
        });
    }
    function setupTabs() {
        const tabBtnDados = getEl('tabBtnDados');
        const tabBtnDocumento = getEl('tabBtnDocumento');
        const tabBtnContrato = getEl('tabBtnContrato');
        tabBtnDados?.addEventListener('click', () => showTab('dados'));
        tabBtnDocumento?.addEventListener('click', () => showTab('documento'));
        tabBtnContrato?.addEventListener('click', () => showTab('contrato'));
    }
    function setupEmployeeFormEnhancements() {
        const cpfInput = getEl('employeeCpf');
        const phoneInput = getEl('employeePhone');
        const zipcodeInput = getEl('employeeZipCode');
        if (cpfInput && !employeeCpfMask) {
            employeeCpfMask = makeMask(cpfInput, { mask: '000.000.000-00' });
        }
        if (phoneInput && !employeePhoneMask) {
            employeePhoneMask = makeMask(phoneInput, {
                mask: [{ mask: '(00) 0000-0000' }, { mask: '(00) 00000-0000' }],
            });
        }
        if (zipcodeInput && !employeeZipMask) {
            employeeZipMask = makeMask(zipcodeInput, { mask: '00000-000' });
            employeeZipMask.on('complete', () => void handleEmployeeCepLookup());
        }
    }
    document.addEventListener('DOMContentLoaded', () => {
        setupEmployeeFormEnhancements();
        employeesManager = new CrudManager({
            entityName: 'Colaborador',
            endpoint: '/employees',
            tableId: 'employeesTable',
            tableSectionId: 'employeesSection',
            modalId: 'employeeModal',
            disableSummaryFooter: true,
            filterConfig: {
                storageKey: 'employees_filter_panel',
                fields: [
                    { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome, CPF, cargo...' },
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
                const search = FilterPanel.normalizeText(getEl('filterSearch')?.value);
                const searchDigits = FilterPanel.onlyDigits(search);
                const status = getEl('filterStatus')?.value || '';
                const filtered = data.filter((item) => {
                    if (status === 'active' && item.status !== 'active')
                        return false;
                    if (status === 'inactive' && item.status !== 'inactive')
                        return false;
                    if (!search)
                        return true;
                    if (FilterPanel.matchesSearch(item, ['name', 'position', 'email', 'city', 'state'], search))
                        return true;
                    if (!searchDigits)
                        return false;
                    return [item.cpf, item.phone]
                        .map((value) => FilterPanel.onlyDigits(value))
                        .some((value) => value.includes(searchDigits));
                });
                window.GridSummaryFooter?.update?.({
                    footerId: 'employeesResultsFooter',
                    anchorId: 'employeesGridSection',
                    count: filtered.length,
                    label: 'colaborador(es) exibido(s)',
                });
                return filtered;
            },
            renderGrid: (data) => {
                const grid = getEl('employeesGridSection');
                if (!grid)
                    return;
                if (data.length === 0) {
                    grid.innerHTML = `
            <div class="col-span-full py-8 text-center text-gray-500 dark:text-gray-400">
              Nenhum colaborador encontrado.
            </div>
          `;
                    return;
                }
                grid.innerHTML = data
                    .map((item) => `
            <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow flex flex-col p-5 relative">
              
              <!-- Checkbox selection header -->
              <div class="flex items-center justify-between mb-3">
                <input type="checkbox" name="selected_entities" value="${item.public_id}" title="Selecionar ${item.name}" aria-label="Selecionar ${item.name}"
                       class="entity-checkbox h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 dark:border-slate-600 rounded cursor-pointer" data-bwignore="true" data-lpignore="true">
                <div class="flex items-center gap-2">
                  ${item.status === 'active'
                    ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Ativo</span>'
                    : '<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Inativo</span>'}
                </div>
              </div>

              <!-- Content details -->
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">${item.name}</h4>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">${item.position || 'Sem cargo'}</p>
                <div class="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700 space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
                  <div class="flex justify-between">
                    <span class="text-gray-400">CPF:</span>
                    <span class="font-medium">${formatCpf(item.cpf)}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-400">Admissão:</span>
                    <span class="font-medium">${formatDate(item.admission_date)}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-400">Salário:</span>
                    <span class="font-semibold text-brand-600 dark:text-brand-400">${formatMoney(item.salary)}</span>
                  </div>
                  ${item.phone ? `
                  <div class="flex justify-between truncate">
                    <span class="text-gray-400">Fone:</span>
                    <span class="font-medium">${formatPhone(item.phone)}</span>
                  </div>` : ''}
                </div>
              </div>

              <!-- Actions footer row -->
              <div class="flex justify-end items-center mt-4 pt-3 border-t border-gray-100 dark:border-slate-700 gap-2">
                <button type="button" title="Editar" class="p-1 text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 edit-btn" data-id="${item.public_id}">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button type="button" title="Excluir" class="p-1 text-red-600 hover:text-red-900 dark:hover:text-red-400 delete-btn" data-id="${item.public_id}">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              </div>
            </div>
          `)
                    .join('');
            },
            renderTable: (data) => {
                const tbody = getEl('employeesTable');
                if (!tbody)
                    return;
                if (data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum colaborador encontrado.</td></tr>';
                    return;
                }
                tbody.innerHTML = data
                    .map((item) => `
            <tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                <input type="checkbox" name="selected_entities" value="${item.public_id}" title="Selecionar" aria-label="Selecionar"
                       class="entity-checkbox h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 dark:border-slate-600 rounded cursor-pointer" data-bwignore="true" data-lpignore="true">
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100">
                <div>${item.name}</div>
                <div class="text-xs text-gray-400 font-normal">CPF: ${formatCpf(item.cpf)}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                <div>${item.position || 'Não informado'}</div>
                <div class="text-xs text-brand-600 dark:text-brand-400 font-medium">${formatMoney(item.salary)}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${formatDate(item.admission_date)}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                <div>${item.email || '-'}</div>
                <div class="text-xs text-gray-400">${formatPhone(item.phone)}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-center">
                ${item.status === 'active'
                    ? '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Ativo</span>'
                    : '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Inativo</span>'}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button type="button" title="Editar" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-3 edit-btn" data-id="${item.public_id}">
                  <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button type="button" title="Excluir" class="text-red-600 hover:text-red-900 dark:hover:text-red-400 delete-btn" data-id="${item.public_id}">
                  <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              </td>
            </tr>
          `)
                    .join('');
            },
            onEdit: (data) => {
                showTab('dados');
                getEl('employeeForm')?.reset();
                const employeeIdInput = getEl('employeeId');
                const modalTitle = getEl('modalTitle');
                if (data && data.public_id) {
                    if (modalTitle)
                        modalTitle.textContent = 'Editar Colaborador';
                    if (employeeIdInput)
                        employeeIdInput.value = data.public_id || '';
                    const name = getEl('employeeName');
                    const status = getEl('employeeStatus');
                    const position = getEl('employeePosition');
                    const salary = getEl('employeeSalary');
                    const admissionDate = getEl('employeeAdmissionDate');
                    const resignationDate = getEl('employeeResignationDate');
                    const birthDate = getEl('employeeBirthDate');
                    const email = getEl('employeeEmail');
                    const address = getEl('employeeAddress');
                    const city = getEl('employeeCity');
                    if (name)
                        name.value = data.name || '';
                    if (status)
                        status.value = data.status || 'active';
                    if (position)
                        position.value = data.position || '';
                    if (salary)
                        salary.value = data.salary ? String(data.salary) : '';
                    if (admissionDate)
                        admissionDate.value = formatDateForInput(data.admission_date);
                    if (resignationDate)
                        resignationDate.value = formatDateForInput(data.resignation_date);
                    if (birthDate)
                        birthDate.value = formatDateForInput(data.birth_date);
                    if (email)
                        email.value = data.email || '';
                    if (address)
                        address.value = data.address || '';
                    if (city)
                        city.value = data.city || '';
                    setMaskedValue(employeeCpfMask, 'employeeCpf', data.cpf || '');
                    setMaskedValue(employeePhoneMask, 'employeePhone', data.phone || '');
                    setMaskedValue(employeeZipMask, 'employeeZipCode', data.zip_code || '');
                    void loadEmployeeStateOptions(data.state || '');
                }
                else {
                    if (modalTitle)
                        modalTitle.textContent = 'Novo Colaborador';
                    if (employeeIdInput)
                        employeeIdInput.value = '';
                    setMaskedValue(employeeCpfMask, 'employeeCpf', '');
                    setMaskedValue(employeePhoneMask, 'employeePhone', '');
                    setMaskedValue(employeeZipMask, 'employeeZipCode', '');
                    void loadEmployeeStateOptions('');
                }
                getEl('employeeModal')?.classList.remove('hidden');
            },
        });
        employeesManager.init();
        setupTabs();
        getEl('employeeForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const saveBtn = getEl('saveBtn');
            const employeeId = getTrimmedValue('employeeId');
            const isEditing = Boolean(employeeId);
            const payload = {
                name: getTrimmedValue('employeeName'),
                cpf: getMaskedValue(employeeCpfMask, 'employeeCpf') || null,
                rg: getTrimmedValue('employeeRg') || null,
                birth_date: getTrimmedValue('employeeBirthDate') || null,
                admission_date: getTrimmedValue('employeeAdmissionDate') || null,
                resignation_date: getTrimmedValue('employeeResignationDate') || null,
                salary: getTrimmedValue('employeeSalary') ? parseFloat(getTrimmedValue('employeeSalary')) : 0,
                position: getTrimmedValue('employeePosition') || null,
                phone: getMaskedValue(employeePhoneMask, 'employeePhone') || null,
                email: getTrimmedValue('employeeEmail') || null,
                address: getTrimmedValue('employeeAddress') || null,
                city: getTrimmedValue('employeeCity') || null,
                state: getTrimmedValue('employeeState') || null,
                zip_code: getMaskedValue(employeeZipMask, 'employeeZipCode') || null,
                status: getTrimmedValue('employeeStatus') || 'active',
            };
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Salvando...';
            }
            const endpoint = isEditing ? `/employees/${employeeId}` : '/employees';
            const method = isEditing ? 'PUT' : 'POST';
            try {
                await api(endpoint, {
                    method,
                    body: JSON.stringify(payload),
                });
                UI?.showAlert?.('alertMessage', isEditing ? 'Colaborador atualizado com sucesso!' : 'Colaborador cadastrado com sucesso!', 'success');
                employeesManager.closeModal();
                await employeesManager.loadData();
            }
            catch (error) {
                UI?.showAlert?.('alertMessage', error?.message || 'Erro ao salvar colaborador.', 'error');
            }
            finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Gravar';
                }
            }
        });
    });
})();
