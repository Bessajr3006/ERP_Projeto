(() => {
    const getById = (id) => document.getElementById(id);
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    const formatCurrencyInput = (value) => {
        const cleanValue = String(value || '').replace(/\D/g, '');
        if (cleanValue === '')
            return 'R$ 0,00';
        let formattedValue = (Number(cleanValue) / 100).toFixed(2).toString();
        formattedValue = formattedValue.replace('.', ',');
        formattedValue = formattedValue.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        return `R$ ${formattedValue}`;
    };
    const parseNumber = (val) => {
        if (!val)
            return 0;
        const strVal = String(val).replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.');
        return parseFloat(strVal) || 0;
    };
    let currentView = localStorage.getItem('banksView') || 'list';
    let _banksData = [];
    const updateViewToggle = () => {
        const btnList = getById('btnListView');
        const btnGrid = getById('btnGridView');
        const tableSection = getById('banksSection');
        const gridSection = getById('banksGridSection');
        if (!btnList || !btnGrid || !tableSection || !gridSection)
            return;
        btnList.className =
            'flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1';
        btnGrid.className =
            'flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1';
        btnList.querySelector('.check-icon')?.classList.add('hidden');
        btnGrid.querySelector('.check-icon')?.classList.add('hidden');
        if (currentView === 'list') {
            btnList.className =
                'flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1';
            btnList.querySelector('.check-icon')?.classList.remove('hidden');
            tableSection.classList.remove('hidden');
            tableSection.style.display = '';
            gridSection.classList.add('hidden');
            gridSection.style.display = 'none';
        }
        else {
            btnGrid.className =
                'flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1';
            btnGrid.querySelector('.check-icon')?.classList.remove('hidden');
            tableSection.classList.add('hidden');
            tableSection.style.display = 'none';
            gridSection.classList.remove('hidden');
            gridSection.style.display = '';
        }
    };
    const switchTab = (tabName) => {
        const tabGeral = getById('tabContentGeral');
        const tabApi = getById('tabContentApi');
        const btnGeral = getById('tabBtnGeral');
        const btnApi = getById('tabBtnApi');
        const activeClasses = ['border-brand-500', 'text-brand-600'];
        const inactiveClasses = [
            'border-transparent',
            'text-gray-500',
            'hover:text-gray-700',
            'hover:border-gray-300',
            'dark:text-gray-400',
            'dark:hover:text-gray-300',
            'dark:hover:border-gray-500',
        ];
        if (tabName === 'geral') {
            tabGeral.classList.remove('hidden');
            tabGeral.classList.add('block');
            tabApi.classList.remove('block');
            tabApi.classList.add('hidden');
            btnGeral.classList.remove(...inactiveClasses);
            btnGeral.classList.add(...activeClasses);
            btnApi.classList.remove(...activeClasses);
            btnApi.classList.add(...inactiveClasses);
        }
        else if (tabName === 'api') {
            tabApi.classList.remove('hidden');
            tabApi.classList.add('block');
            tabGeral.classList.remove('block');
            tabGeral.classList.add('hidden');
            btnApi.classList.remove(...inactiveClasses);
            btnApi.classList.add(...activeClasses);
            btnGeral.classList.remove(...activeClasses);
            btnGeral.classList.add(...inactiveClasses);
        }
    };
    const setupFileDropzones = () => {
        const setupZone = (dropzoneId, fileInputId, textareaId, filenameDivId, filenameTextId, clearBtnId) => {
            const dropzone = getById(dropzoneId);
            const fileInput = getById(fileInputId);
            const textarea = getById(textareaId);
            const filenameDiv = getById(filenameDivId);
            const filenameText = getById(filenameTextId);
            const clearBtn = getById(clearBtnId);
            if (!dropzone || !fileInput)
                return;
            const handleFile = (file) => {
                if (!file)
                    return;
                filenameText.textContent = file.name;
                dropzone.classList.add('hidden');
                dropzone.style.display = 'none';
                filenameDiv.classList.remove('hidden');
                filenameDiv.style.display = '';
                const reader = new FileReader();
                reader.onload = (e) => {
                    textarea.value = e?.target?.result || '';
                };
                reader.readAsText(file);
            };
            fileInput.addEventListener('change', (e) => {
                if (e.target?.files?.length > 0)
                    handleFile(e.target.files[0]);
            });
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, false);
            });
            ['dragenter', 'dragover'].forEach((eventName) => {
                dropzone.addEventListener(eventName, () => dropzone.classList.add('border-brand-500', 'bg-brand-50', 'dark:bg-slate-700/50'), false);
            });
            ['dragleave', 'drop'].forEach((eventName) => {
                dropzone.addEventListener(eventName, () => dropzone.classList.remove('border-brand-500', 'bg-brand-50', 'dark:bg-slate-700/50'), false);
            });
            dropzone.addEventListener('drop', (e) => {
                const files = e.dataTransfer?.files;
                if (files && files.length > 0) {
                    fileInput.files = files;
                    handleFile(files[0]);
                }
            });
            clearBtn.addEventListener('click', () => {
                fileInput.value = '';
                textarea.value = '';
                filenameDiv.classList.add('hidden');
                filenameDiv.style.display = 'none';
                dropzone.classList.remove('hidden');
                dropzone.style.display = '';
            });
        };
        setupZone('dropzoneCert', 'fileCertificado', 'apiCertificado', 'filenameCert', 'filenameCertText', 'clearCertBtn');
        setupZone('dropzoneKey', 'fileKey', 'apiKey', 'filenameKey', 'filenameKeyText', 'clearKeyBtn');
    };
    const resetFileDropzonesUI = () => {
        ['Cert', 'Key'].forEach((type) => {
            const dropzone = getById(`dropzone${type}`);
            const filenameDiv = getById(`filename${type}`);
            const fileInput = getById(`file${type === 'Cert' ? 'Certificado' : 'Key'}`);
            if (dropzone) {
                dropzone.classList.remove('hidden');
                dropzone.style.display = '';
                filenameDiv.classList.add('hidden');
                filenameDiv.style.display = 'none';
                if (fileInput)
                    fileInput.value = '';
            }
        });
    };
    const populateFileDropzoneUI = (type, hasContent) => {
        const dropzone = getById(`dropzone${type}`);
        const filenameDiv = getById(`filename${type}`);
        const filenameText = getById(`filename${type}Text`);
        if (dropzone && filenameDiv && filenameText) {
            if (hasContent) {
                dropzone.classList.add('hidden');
                filenameDiv.classList.remove('hidden');
                filenameText.textContent = `Arquivo ${type === 'Cert' ? '.crt' : '.key'} carregado do banco`;
            }
            else {
                dropzone.classList.remove('hidden');
                filenameDiv.classList.add('hidden');
            }
        }
    };
    const closeModal = () => {
        getById('bankModal').classList.add('hidden');
    };
    const openModal = () => {
        getById('bankForm').reset();
        getById('bankId').value = '';
        const initialBalanceInputEl = getById('initialBalance');
        if (initialBalanceInputEl)
            initialBalanceInputEl.value = 'R$ 0,00';
        getById('modalTitle').textContent = 'Nova Conta Bancária';
        switchTab('geral');
        resetFileDropzonesUI();
        getById('btnTestApi').style.display = 'none';
        getById('bankModal').classList.remove('hidden');
    };
    const renderTable = (elementId, items) => {
        const tbody = getById(elementId);
        if (items.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum registro encontrado.</td></tr>';
            return;
        }
        const typeLabels = {
            checking: '<span class="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs rounded-md font-medium">Conta Corrente</span>',
            savings: '<span class="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs rounded-md font-medium">Poupança</span>',
            cash: '<span class="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 text-xs rounded-md font-medium">Caixa Físico</span>',
        };
        tbody.innerHTML = items
            .map((b, index) => `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors group">
            <td class="px-3 py-4 whitespace-nowrap text-left w-12">
                <input type="checkbox" name="bankSelection" value="${b.public_id}" class="item-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800">
            </td>
            <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">#${String(index + 1).padStart(4, '0')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">${b.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">${typeLabels[b.type] || b.type}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${b.institution || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100 text-right">${formatCurrency(b.current_balance)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                <button class="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mr-3 transition-colors view-id-btn" data-id="${b.public_id}" title="Ver / Copiar ID: ${b.public_id}">
                    <svg class="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                </button>
                <button class="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 mr-3 edit-btn" data-id="${b.public_id}" title="Editar">
                    <svg class="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mr-3 duplicate-btn" data-id="${b.public_id}" title="Duplicar">
                    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                </button>
                <button class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 delete-btn" data-id="${b.public_id}" title="Excluir">
                    <svg class="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </td>
        </tr>
    `)
            .join('');
        const selectAllBtn = getById('selectAllCheckbox');
        if (selectAllBtn) {
            const newSelectAll = selectAllBtn.cloneNode(true);
            selectAllBtn.parentNode?.replaceChild(newSelectAll, selectAllBtn);
            newSelectAll.addEventListener('change', (e) => {
                document.querySelectorAll('.item-checkbox').forEach((cb) => {
                    cb.checked = e.target.checked;
                });
            });
            document.querySelectorAll('.item-checkbox').forEach((cb) => {
                cb.addEventListener('change', () => {
                    if (!cb.checked && newSelectAll) {
                        newSelectAll.checked = false;
                    }
                });
            });
        }
    };
    const renderGrid = (elementId, items) => {
        const grid = getById(elementId);
        if (items.length === 0) {
            grid.innerHTML =
                '<div class="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">Nenhum registro encontrado.</div>';
            return;
        }
        const typeLabels = {
            checking: '<span class="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs rounded-md font-medium">Conta Corrente</span>',
            savings: '<span class="px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs rounded-md font-medium">Poupança</span>',
            cash: '<span class="px-2 py-0.5 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 text-xs rounded-md font-medium">Caixa Físico</span>',
        };
        grid.innerHTML = items
            .map((b, index) => `
        <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col relative border border-gray-100 dark:border-slate-700 group">
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center z-10 pt-1">
                    <input type="checkbox" name="bankSelection" value="${b.public_id}" class="item-checkbox rounded border-gray-300 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800 dark:border-slate-600 cursor-pointer">
                    <span class="ml-2 text-xs font-mono font-medium text-gray-500 dark:text-gray-400">#${String(index + 1).padStart(4, '0')}</span>
                </div>

                <div class="flex space-x-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10 -mr-1 -mt-1">
                    <button class="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-md transition-colors view-id-btn" data-id="${b.public_id}" title="Ver / Copiar ID: ${b.public_id}">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    </button>
                    <button class="p-1.5 text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400 bg-gray-50 hover:bg-brand-50 dark:bg-slate-700 dark:hover:bg-brand-900/30 rounded edit-btn" data-id="${b.public_id}" title="Editar">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button class="p-1.5 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 bg-gray-50 hover:bg-indigo-50 dark:bg-slate-700 dark:hover:bg-indigo-900/30 rounded duplicate-btn" data-id="${b.public_id}" title="Duplicar">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </button>
                    <button class="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 bg-gray-50 hover:bg-red-50 dark:bg-slate-700 dark:hover:bg-red-900/30 rounded delete-btn" data-id="${b.public_id}" title="Excluir">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            </div>

            <div class="flex-1 mt-1">
                <div class="flex justify-between items-start">
                    <h4 class="text-lg font-bold text-gray-900 dark:text-gray-100 truncate pr-2">${b.name}</h4>
                    <div>${typeLabels[b.type] || b.type}</div>
                </div>

                <div class="mt-4">
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Instituição:</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100">${b.institution || 'Não especificada'}</span>
                    </div>
                </div>
            </div>

            <div class="mt-5 pt-0 flex justify-end items-center">
                <div class="text-right">
                    <span class="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Saldo Atual</span>
                    <span class="text-lg font-bold text-brand-600 dark:text-brand-400 leading-none">${formatCurrency(b.current_balance)}</span>
                </div>
            </div>
        </div>
    `)
            .join('');
    };
    const bindActionEvents = () => {
        document.querySelectorAll('.view-id-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const pid = e.currentTarget.getAttribute('data-id') || '';
                navigator.clipboard.writeText(pid).then(() => {
                    const b = e.currentTarget;
                    const orig = b.innerHTML;
                    b.innerHTML = '<svg class="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
                    setTimeout(() => { b.innerHTML = orig; }, 1500);
                });
            });
        });
        document.querySelectorAll('.edit-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                editBank(id);
            });
        });
        document.querySelectorAll('.duplicate-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                duplicateBank(id);
            });
        });
        document.querySelectorAll('.delete-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                deleteBank(id);
            });
        });
    };
    const applyFilters = () => {
        const FilterPanel = window.FilterPanel;
        const search = FilterPanel.normalizeText(getById('filterSearch')?.value);
        const type = getById('filterType')?.value || '';
        const filtered = _banksData.filter((item) => {
            if (!FilterPanel.matchesSearch(item, ['name', 'institution', 'agency_number', 'account_number'], search)) {
                return false;
            }
            if (type && item.type !== type)
                return false;
            return true;
        });
        renderTable('banksTable', filtered);
        renderGrid('banksGridSection', filtered);
        window.GridSummaryFooter?.update({
            footerId: 'banksResultsFooter',
            anchorId: 'banksGridSection',
            count: filtered.length,
            label: 'conta(s) exibida(s)',
        });
        bindActionEvents();
    };
    const loadBanks = async () => {
        try {
            const response = await api('/bank-accounts');
            _banksData = response.data || [];
            applyFilters();
        }
        catch (error) {
            console.error('Failed to load banks', error);
            UI.showAlert('alertMessage', 'Erro ao carregar dados. Verifique a conexão.');
        }
    };
    const editBank = (id) => {
        const bank = _banksData.find((b) => b.public_id === id);
        if (!bank)
            return;
        getById('bankId').value = bank.public_id;
        getById('bankName').value = bank.name;
        getById('institution').value = bank.institution || '';
        getById('bankType').value = bank.type;
        getById('agencyNumber').value = bank.agency_number || '';
        getById('accountNumber').value = bank.account_number || '';
        getById('pixKey').value = bank.pix_key || '';
        getById('apiClientId').value = bank.api_client_id || '';
        getById('apiClientSecret').value = bank.api_client_secret || '';
        getById('apiCertificado').value = bank.api_certificate ? atob(bank.api_certificate) : '';
        getById('apiKey').value = bank.api_key ? atob(bank.api_key) : '';
        populateFileDropzoneUI('Cert', !!bank.api_certificate);
        populateFileDropzoneUI('Key', !!bank.api_key);
        const initialBalanceInput = getById('initialBalance');
        initialBalanceInput.value = formatCurrencyInput(String(bank.current_balance * 100));
        initialBalanceInput.disabled = false;
        getById('modalTitle').textContent = 'Editar Conta Bancária';
        getById('btnTestApi').style.display = '';
        getById('bankModal').classList.remove('hidden');
    };
    const duplicateBank = (id) => {
        const bank = _banksData.find((b) => b.public_id === id);
        if (!bank)
            return;
        getById('bankId').value = '';
        getById('bankName').value = `${bank.name} (Cópia)`;
        getById('institution').value = bank.institution || '';
        getById('bankType').value = bank.type;
        getById('agencyNumber').value = bank.agency_number || '';
        getById('accountNumber').value = bank.account_number || '';
        getById('pixKey').value = bank.pix_key || '';
        getById('apiClientId').value = bank.api_client_id || '';
        getById('apiClientSecret').value = bank.api_client_secret || '';
        getById('apiCertificado').value = bank.api_certificate ? atob(bank.api_certificate) : '';
        getById('apiKey').value = bank.api_key ? atob(bank.api_key) : '';
        populateFileDropzoneUI('Cert', !!bank.api_certificate);
        populateFileDropzoneUI('Key', !!bank.api_key);
        const initialBalanceInput = getById('initialBalance');
        initialBalanceInput.value = formatCurrencyInput(String(bank.current_balance * 100));
        initialBalanceInput.disabled = false;
        getById('modalTitle').textContent = 'Duplicar Conta Bancária';
        getById('btnTestApi').style.display = 'none';
        getById('bankModal').classList.remove('hidden');
    };
    const deleteBank = async (id) => {
        if (!confirm('Tem certeza que deseja excluir esta conta bancária? Esta ação não pode ser desfeita.'))
            return;
        try {
            await api(`/bank-accounts/${id}`, { method: 'DELETE' });
            UI.showAlert('alertMessage', 'Conta bancária excluída com sucesso!', 'success');
            loadBanks();
        }
        catch (error) {
            alert(error.message || 'Erro ao excluir conta.');
        }
    };
    const testApiConnection = async () => {
        const bankId = getById('bankId').value;
        if (!bankId)
            return;
        const btn = getById('btnTestApi');
        const originalText = btn.innerHTML;
        const requiredFields = ['apiClientId', 'apiClientSecret', 'apiCertificado', 'apiKey'];
        const missingFields = requiredFields.some((id) => !getById(id).value);
        if (missingFields) {
            UI.showAlert('alertMessage', 'Por favor, preencha as 4 credenciais (ID, Secret, Certificado e Chave) e SALVE antes de testar.', 'error');
            return;
        }
        btn.disabled = true;
        btn.innerHTML =
            '<svg class="animate-spin h-5 w-5 text-amber-700 dark:text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
        try {
            const response = await api(`/bank-accounts/${bankId}/test-connection`, {
                method: 'POST',
            });
            UI.showAlert('alertMessage', response.message || 'Conexão estabelecida com sucesso!', 'success');
        }
        catch (error) {
            UI.showAlert('alertMessage', error.message || 'Falha ao testar conexão com a API.', 'error');
        }
        finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    };
    // Expose same APIs as legacy JS
    window.switchTab = switchTab;
    window.setupFileDropzones = setupFileDropzones;
    window.resetFileDropzonesUI = resetFileDropzonesUI;
    window.populateFileDropzoneUI = populateFileDropzoneUI;
    window.openModal = openModal;
    window.closeModal = closeModal;
    window.editBank = editBank;
    window.duplicateBank = duplicateBank;
    window.deleteBank = deleteBank;
    // Wire events
    document.addEventListener('DOMContentLoaded', () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }
        loadBanks();
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
            .catch((err) => {
            console.error('Falha ao carregar usuário', err);
        });
        const btnOpen = getById('btnOpenModal');
        btnOpen?.addEventListener('click', () => openModal());
        const initialBalanceInputEl = getById('initialBalance');
        initialBalanceInputEl?.addEventListener('input', (e) => {
            e.target.value = formatCurrencyInput(e.target.value);
        });
        getById('btnCancelModal')?.addEventListener('click', closeModal);
        const backdrop = getById('modalBackdrop');
        backdrop?.addEventListener('click', (e) => {
            if (e.target === backdrop)
                closeModal();
        });
        setupFileDropzones();
        getById('tabBtnGeral')?.addEventListener('click', () => switchTab('geral'));
        getById('tabBtnApi')?.addEventListener('click', () => switchTab('api'));
        getById('btnListView')?.addEventListener('click', () => {
            currentView = 'list';
            localStorage.setItem('banksView', 'list');
            updateViewToggle();
        });
        getById('btnGridView')?.addEventListener('click', () => {
            currentView = 'grid';
            localStorage.setItem('banksView', 'grid');
            updateViewToggle();
        });
        updateViewToggle();
        window.FilterPanel.mount({
            storageKey: 'banks_filter_panel',
            fields: [
                { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome, instituição, agência ou conta' },
                {
                    id: 'filterType',
                    type: 'select',
                    label: 'Tipo',
                    options: [
                        { value: '', label: 'Todos' },
                        { value: 'checking', label: 'Conta Corrente' },
                        { value: 'savings', label: 'Poupança' },
                        { value: 'cash', label: 'Caixa Físico' },
                    ],
                },
            ],
            gridClass: 'grid grid-cols-1 md:grid-cols-2 gap-3 items-end',
        });
        let searchDebounceTimer = null;
        getById('filterSearch')?.addEventListener('input', () => {
            if (searchDebounceTimer) {
                clearTimeout(searchDebounceTimer);
            }
            searchDebounceTimer = setTimeout(() => {
                applyFilters();
                searchDebounceTimer = null;
            }, 180);
        });
        getById('filterType')?.addEventListener('change', applyFilters);
    });
    // form + test api handlers (script loads at end of body)
    getById('bankForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = getById('saveBtn');
        const bankId = getById('bankId').value;
        const payload = {
            name: getById('bankName').value,
            institution: getById('institution').value || undefined,
            type: getById('bankType').value,
            initial_balance: parseNumber(getById('initialBalance').value),
            current_balance: parseNumber(getById('initialBalance').value),
            agency_number: getById('agencyNumber').value || null,
            account_number: getById('accountNumber').value || null,
            pix_key: getById('pixKey').value || null,
            api_client_id: getById('apiClientId').value || null,
            api_client_secret: getById('apiClientSecret').value || null,
            api_certificate: getById('apiCertificado').value ? btoa(getById('apiCertificado').value) : null,
            api_key: getById('apiKey').value ? btoa(getById('apiKey').value) : null,
        };
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';
        try {
            if (bankId) {
                await api(`/bank-accounts/${bankId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        name: payload.name,
                        institution: payload.institution,
                        type: payload.type,
                        current_balance: payload.current_balance,
                        agency_number: payload.agency_number,
                        account_number: payload.account_number,
                        pix_key: payload.pix_key,
                        api_client_id: payload.api_client_id,
                        api_client_secret: payload.api_client_secret,
                        api_certificate: payload.api_certificate,
                        api_key: payload.api_key,
                    }),
                });
                UI.showAlert('alertMessage', 'Conta bancária atualizada com sucesso!', 'success');
            }
            else {
                await api('/bank-accounts', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                UI.showAlert('alertMessage', 'Conta bancária adicionada com sucesso!', 'success');
            }
            closeModal();
            loadBanks();
        }
        catch (error) {
            alert(error.message);
        }
        finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar';
        }
    });
    getById('btnTestApi')?.addEventListener('click', testApiConnection);
})();
