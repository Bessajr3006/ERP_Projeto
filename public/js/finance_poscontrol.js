(() => {
    const getById = (id) => document.getElementById(id);
    document.addEventListener('DOMContentLoaded', async () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }
        // Set default dates to today
        const today = new Date().toISOString().split('T')[0];
        const startDateInput = getById('startDate');
        const endDateInput = getById('endDate');
        if (startDateInput)
            startDateInput.value = today;
        if (endDateInput)
            endDateInput.value = today;
        let companyPublicId = '';
        let companyDetails = null;
        try {
            const userRes = await api('/auth/me');
            companyPublicId = userRes.data?.company?.public_id;
            if (companyPublicId) {
                const compRes = await api(`/companies/${companyPublicId}`);
                companyDetails = compRes.data || null;
                // Check if POS-Control config exists
                const configRes = await api(`/companies/${companyPublicId}/poscontrol-configs`);
                const configs = configRes.data || [];
                const apiStatusBadge = getById('apiStatusBadge');
                if (configs.length > 0) {
                    if (apiStatusBadge) {
                        apiStatusBadge.textContent = 'Configurado';
                        apiStatusBadge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
                    }
                }
                else {
                    if (apiStatusBadge) {
                        apiStatusBadge.textContent = 'Não Configurado';
                        apiStatusBadge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
                    }
                }
                // Load categories and bank accounts
                try {
                    const [categoriesRes, bankAccountsRes] = await Promise.all([
                        api('/finance/categories?type=income'),
                        api('/bank-accounts')
                    ]);
                    const categories = categoriesRes.data || [];
                    const bankAccounts = bankAccountsRes.data || [];
                    const categorySelect = getById('categorySelect');
                    if (categorySelect) {
                        categorySelect.innerHTML = '<option value="">Selecione uma categoria...</option>';
                        categories.forEach((cat) => {
                            const option = document.createElement('option');
                            option.value = cat.public_id;
                            option.textContent = cat.name;
                            categorySelect.appendChild(option);
                        });
                    }
                    const bankAccountSelect = getById('bankAccountSelect');
                    if (bankAccountSelect) {
                        bankAccountSelect.innerHTML = '<option value="">Selecione uma conta...</option>';
                        bankAccounts.forEach((bank) => {
                            const option = document.createElement('option');
                            option.value = bank.public_id;
                            option.textContent = bank.name;
                            bankAccountSelect.appendChild(option);
                        });
                    }
                }
                catch (err) {
                    console.error('Failed to load categories/bank accounts', err);
                }
            }
        }
        catch (err) {
            console.error('Failed to load POS-Control configurations', err);
        }
        let salesList = [];
        let currentlyExportingSales = [];
        const renderSalesTable = () => {
            const salesContainer = getById('salesContainer');
            const salesTableBody = getById('salesTableBody');
            const periodTotalValue = getById('periodTotalValue');
            if (salesTableBody) {
                salesTableBody.innerHTML = '';
                if (salesList.length === 0) {
                    salesTableBody.innerHTML = `
                        <tr>
                            <td colspan="7" class="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                Nenhuma venda encontrada para o período selecionado.
                            </td>
                        </tr>
                    `;
                }
                else {
                    const sentKey = `solidcon_sent_sales_${companyPublicId}`;
                    const sentCodes = JSON.parse(localStorage.getItem(sentKey) || '[]');
                    let totalSum = 0;
                    salesList.forEach((sale, idx) => {
                        totalSum += sale.total;
                        const dateFormatted = new Date(sale.date).toLocaleString('pt-BR');
                        const totalFormatted = sale.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                        const statusClass = sale.status === 'Finalizada'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
                        const isSent = sentCodes.includes(sale.salePosCodeId);
                        const detailsKey = `solidcon_sent_details_${companyPublicId}`;
                        const sentDetails = JSON.parse(localStorage.getItem(detailsKey) || '{}');
                        const detailMsg = sentDetails[sale.salePosCodeId] || (isSent ? 'Enviado' : '');
                        let solidconBadge = `<span class="text-gray-400 dark:text-gray-600">-</span>`;
                        if (detailMsg) {
                            if (detailMsg.startsWith('Erro:')) {
                                const cleanMsg = detailMsg.replace(/"/g, '&quot;');
                                solidconBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" title="${cleanMsg}">${detailMsg}</span>`;
                            }
                            else {
                                solidconBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">${detailMsg}</span>`;
                            }
                        }
                        const isSuccessSent = detailMsg && !detailMsg.startsWith('Erro:') && detailMsg !== 'Cancelado';
                        const cancelButton = isSuccessSent
                            ? `<button type="button" class="cancel-solidcon-btn inline-flex items-center text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 ml-2" data-idx="${idx}">Cancelar</button>`
                            : '';
                        const row = document.createElement('tr');
                        row.className = 'hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors';
                        row.innerHTML = `
                            <td class="px-4 py-3 text-center">
                                <input type="checkbox" class="row-checkbox rounded border-gray-300 text-brand-600 focus:ring-brand-500 h-4 w-4" data-idx="${idx}">
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-100 font-semibold select-all">
                                ${sale.salePosCodeId}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${dateFormatted}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">${sale.paymentType}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm">
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">
                                    ${sale.status}
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm">
                                ${solidconBadge}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-bold text-gray-900 dark:text-gray-100">${totalFormatted}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-center">
                                <button type="button" class="view-details-btn inline-flex items-center text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300" data-idx="${idx}">
                                    Ver Detalhes
                                </button>
                                ${cancelButton}
                            </td>
                        `;
                        salesTableBody.appendChild(row);
                    });
                    if (periodTotalValue) {
                        periodTotalValue.textContent = totalSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    }
                }
            }
            // Reset header checkbox and update bulk button state
            const selectAllSales = getById('selectAllSales');
            if (selectAllSales) {
                selectAllSales.checked = false;
                selectAllSales.indeterminate = false;
            }
            updateSelectionState();
            if (salesContainer) {
                salesContainer.classList.remove('hidden');
            }
        };
        // Handle Sync Form Submit (to fetch sales from POS-Control)
        const syncForm = getById('syncForm');
        if (syncForm) {
            syncForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = getById('btnFetchSales');
                const originalText = btn ? btn.innerHTML : 'Buscar Vendas';
                try {
                    if (btn) {
                        btn.disabled = true;
                        btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Buscando...`;
                    }
                    if (!companyPublicId) {
                        throw new Error('Empresa do usuário não identificada.');
                    }
                    const startDate = getById('startDate')?.value;
                    const endDate = getById('endDate')?.value;
                    if (!startDate || !endDate) {
                        throw new Error('Por favor, informe a Data Inicial e Data Final.');
                    }
                    // Just fetch sales from API (GET route)
                    const fetchRes = await api(`/companies/${companyPublicId}/poscontrol-sync/sales?startDate=${startDate}&endDate=${endDate}`, {
                        method: 'GET'
                    });
                    salesList = fetchRes.data || [];
                    renderSalesTable();
                }
                catch (err) {
                    UI.showAlert('alertMessage', err.message || 'Erro ao buscar vendas do Pos-Controll.', 'error');
                }
                finally {
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = originalText;
                    }
                }
            });
        }
        // Checkbox selection logic
        const selectAllSales = getById('selectAllSales');
        const btnSyncSelected = getById('btnSyncSelected');
        const btnSendSolidconSelected = getById('btnSendSolidconSelected');
        const selectedCount = getById('selectedCount');
        const updateSelectionState = () => {
            const checkedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
            const totalCheckboxes = document.querySelectorAll('.row-checkbox');
            if (selectedCount) {
                selectedCount.textContent = String(checkedCheckboxes.length);
            }
            if (btnSyncSelected) {
                btnSyncSelected.disabled = checkedCheckboxes.length === 0;
            }
            if (btnSendSolidconSelected) {
                btnSendSolidconSelected.disabled = checkedCheckboxes.length === 0;
            }
            if (selectAllSales && totalCheckboxes.length > 0) {
                selectAllSales.checked = checkedCheckboxes.length === totalCheckboxes.length;
                selectAllSales.indeterminate = checkedCheckboxes.length > 0 && checkedCheckboxes.length < totalCheckboxes.length;
            }
        };
        if (selectAllSales) {
            selectAllSales.addEventListener('change', () => {
                const checkboxes = document.querySelectorAll('.row-checkbox');
                checkboxes.forEach((cb) => {
                    cb.checked = selectAllSales.checked;
                });
                updateSelectionState();
            });
        }
        // Delegate checkbox changes in table body
        const salesTableBody = getById('salesTableBody');
        if (salesTableBody) {
            salesTableBody.addEventListener('change', (e) => {
                const target = e.target;
                if (target && target.classList.contains('row-checkbox')) {
                    updateSelectionState();
                }
            });
        }
        // Handle Sync Selected Button Click
        if (btnSyncSelected) {
            btnSyncSelected.addEventListener('click', async () => {
                const categorySelect = getById('categorySelect');
                const bankAccountSelect = getById('bankAccountSelect');
                const category_public_id = categorySelect.value;
                const bank_account_public_id = bankAccountSelect.value;
                if (!category_public_id) {
                    UI.showAlert('alertMessage', 'Por favor, selecione uma Categoria de Receita.', 'error');
                    return;
                }
                if (!bank_account_public_id) {
                    UI.showAlert('alertMessage', 'Por favor, selecione uma Conta Bancária.', 'error');
                    return;
                }
                const originalText = btnSyncSelected.innerHTML;
                btnSyncSelected.disabled = true;
                btnSyncSelected.innerHTML = `
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processando...
                `;
                try {
                    const checkedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
                    const selectedSales = [];
                    checkedCheckboxes.forEach((cb) => {
                        const idx = Number(cb.dataset.idx);
                        selectedSales.push(salesList[idx]);
                    });
                    const syncRes = await api(`/companies/${companyPublicId}/poscontrol-sync/sales/sync`, {
                        method: 'POST',
                        body: JSON.stringify({
                            category_public_id,
                            bank_account_public_id,
                            selectedSales
                        })
                    });
                    // Update last import badge
                    const lastImportTime = getById('lastImportTime');
                    if (lastImportTime) {
                        const now = new Date();
                        lastImportTime.textContent = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    }
                    UI.showAlert('alertMessage', syncRes.message || 'Sincronização concluída com sucesso.', 'success');
                    // Uncheck everything
                    if (selectAllSales)
                        selectAllSales.checked = false;
                    const checkboxes = document.querySelectorAll('.row-checkbox');
                    checkboxes.forEach((cb) => {
                        cb.checked = false;
                    });
                    updateSelectionState();
                }
                catch (err) {
                    UI.showAlert('alertMessage', err.message || 'Erro ao sincronizar vendas do Pos-Controll.', 'error');
                }
                finally {
                    btnSyncSelected.disabled = false;
                    btnSyncSelected.innerHTML = originalText;
                    updateSelectionState();
                }
            });
        }
        // Details Modal event listener delegation
        document.addEventListener('click', (e) => {
            const target = e.target;
            if (target && target.classList.contains('view-details-btn')) {
                const idx = Number(target.dataset.idx);
                const sale = salesList[idx];
                if (!sale)
                    return;
                getById('detailSaleId').textContent = sale.salePosCodeId;
                getById('detailSaleDate').textContent = new Date(sale.date).toLocaleString('pt-BR');
                getById('detailSalePayment').textContent = sale.paymentType;
                getById('detailSaleTotal').textContent = sale.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const cardDetailsContainer = getById('cardDetailsContainer');
                if (sale.cardInfo) {
                    getById('detailCardBrand').textContent = sale.cardInfo.brand || '-';
                    getById('detailCardNumber').textContent = sale.cardInfo.card || '-';
                    getById('detailCardNetwork').textContent = sale.cardInfo.network || '-';
                    getById('detailCardAuth').textContent = sale.cardInfo.authorization || '-';
                    getById('detailCardNsu').textContent = sale.cardInfo.nsu || '-';
                    getById('detailCardInstallments').textContent = sale.cardInfo.installments || '1';
                    if (cardDetailsContainer)
                        cardDetailsContainer.classList.remove('hidden');
                }
                else {
                    if (cardDetailsContainer)
                        cardDetailsContainer.classList.add('hidden');
                }
                const itemsBody = getById('detailItemsBody');
                if (itemsBody) {
                    itemsBody.innerHTML = '';
                    if (!sale.items || sale.items.length === 0) {
                        itemsBody.innerHTML = `
                            <tr>
                                <td colspan="4" class="px-4 py-3 text-center text-xs text-gray-500">Sem itens registrados.</td>
                            </tr>
                        `;
                    }
                    else {
                        sale.items.forEach((item) => {
                            const priceFormatted = item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                            const row = document.createElement('tr');
                            row.innerHTML = `
                                <td class="px-4 py-2 text-left text-gray-500 dark:text-gray-400 font-mono">${item.ean || '-'}</td>
                                <td class="px-4 py-2 text-left text-gray-900 dark:text-gray-200 font-semibold">${item.name}</td>
                                <td class="px-4 py-2 text-center text-gray-500 font-mono">${item.quantity}</td>
                                <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100 font-mono">${priceFormatted}</td>
                            `;
                            itemsBody.appendChild(row);
                        });
                    }
                }
                getById('saleDetailsModal').classList.remove('hidden');
            }
            if (target && target.classList.contains('cancel-solidcon-btn')) {
                const idx = Number(target.dataset.idx);
                const sale = salesList[idx];
                if (!sale)
                    return;
                const detailsKey = `solidcon_sent_details_${companyPublicId}`;
                const sentDetails = JSON.parse(localStorage.getItem(detailsKey) || '{}');
                const detailMsg = sentDetails[sale.salePosCodeId] || '';
                const match = detailMsg.match(/Ref:\s*(\d+)/);
                const orderNum = match ? match[1] : '';
                let baseUrl = 'https://api.solidcon.com.br/api';
                const exportUrl = getById('solidconExportUrl')?.value || '';
                if (exportUrl) {
                    try {
                        const parsed = new URL(exportUrl);
                        const pIdx = parsed.href.indexOf('/Pedido');
                        if (pIdx !== -1) {
                            baseUrl = parsed.href.substring(0, pIdx);
                        }
                        else {
                            baseUrl = parsed.origin + '/api';
                        }
                    }
                    catch { }
                }
                const defaultUrlPattern = `${baseUrl}/Pedido/{cdPedido}/Ecom/{cdEcom}/PutCancelamentoPedido`;
                const updateCancelUrl = () => {
                    const p = getById('solidconCancelCdPedido')?.value || '';
                    const e = getById('solidconCancelCdEcom')?.value || '1';
                    const pattern = companyDetails?.solidcon_url_5 || defaultUrlPattern;
                    let finalUrl = pattern
                        .replace(/{cdPedido}/g, p)
                        .replace(/{cdEcom}/g, e)
                        .replace(/{cdpedido}/g, p)
                        .replace(/{cdecom}/g, e);
                    getById('solidconCancelUrl').value = finalUrl;
                };
                getById('solidconCancelCdPedido').value = orderNum;
                getById('solidconCancelCdEcom').value = '1';
                getById('solidconCancelJson').value = '{}';
                // Set initial URL
                updateCancelUrl();
                // Setup listener inputs
                getById('solidconCancelCdPedido').oninput = updateCancelUrl;
                getById('solidconCancelCdEcom').oninput = updateCancelUrl;
                // Clear any previous alerts
                const alertEl = getById('solidconCancelModalAlert');
                if (alertEl) {
                    alertEl.innerHTML = '';
                    alertEl.classList.add('hidden');
                }
                // Associate sale with confirm button for references
                getById('btnConfirmCancelSolidcon').dataset.saleId = sale.salePosCodeId;
                getById('solidconCancelModal').classList.remove('hidden');
            }
        });
        // Close details modal logic
        const closeDetailsModal = () => {
            getById('saleDetailsModal').classList.add('hidden');
        };
        const closeBtn = getById('closeDetailsModalBtn');
        const closeBg = getById('closeDetailsModalBg');
        if (closeBtn)
            closeBtn.addEventListener('click', closeDetailsModal);
        if (closeBg)
            closeBg.addEventListener('click', closeDetailsModal);
        // Solidcon Export Modal logic
        const closeSolidconModal = () => {
            getById('solidconExportModal').classList.add('hidden');
        };
        const closeSolidconBtn = getById('closeSolidconModalBtn');
        const closeSolidconBg = getById('closeSolidconModalBg');
        if (closeSolidconBtn)
            closeSolidconBtn.addEventListener('click', closeSolidconModal);
        if (closeSolidconBg)
            closeSolidconBg.addEventListener('click', closeSolidconModal);
        if (btnSendSolidconSelected) {
            btnSendSolidconSelected.addEventListener('click', () => {
                const checkedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
                const selectedSales = [];
                checkedCheckboxes.forEach((cb) => {
                    const idx = Number(cb.dataset.idx);
                    selectedSales.push(salesList[idx]);
                });
                if (selectedSales.length === 0)
                    return;
                currentlyExportingSales = selectedSales;
                const missingExternalCodes = [];
                selectedSales.forEach(sale => {
                    (sale.items || []).forEach((it) => {
                        const code = parseInt(it.externalCode || '0') || 0;
                        if (code === 0) {
                            missingExternalCodes.push(it.name || `Produto #${it.InternalCode || 'Sem Código'}`);
                        }
                    });
                });
                const mappedOrders = selectedSales.map((sale) => {
                    const cnpjVal = parseInt(String(companyDetails?.cnpj || '0').replace(/\D/g, '')) || 0;
                    const parseToIso = (dStr) => {
                        try {
                            const d = new Date(dStr);
                            return !isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString();
                        }
                        catch {
                            return new Date().toISOString();
                        }
                    };
                    const isoDate = parseToIso(sale.date);
                    const mappedItens = (sale.items || []).map((it, itemIdx) => {
                        return {
                            "numero": itemIdx + 1,
                            "ean": parseInt(String(it.ean || '0').replace(/\D/g, '')) || 0,
                            "quantidade": it.quantity,
                            "quantidadeAtendida": it.quantity,
                            "valorUnitario": it.price,
                            "valorDesconto": 0,
                            "nmProduto": it.name || "",
                            "obs": "",
                            "inCodigoInterno": true,
                            "cdProduto": parseInt(it.externalCode || '0') || 0
                        };
                    });
                    const rawPayload = {
                        "cnpj": cnpjVal,
                        "numero": Math.floor(100000 + Math.random() * 900000), // Random number
                        "data": isoDate,
                        "valorDesconto": 0,
                        "obs": "Importado do POS-Controll",
                        "ecommerceSolidcon": true,
                        "ecommerceSolidconStatus": 1,
                        "cdEcomPedido": 0,
                        "codEcom": 1,
                        "valorFrete": 0,
                        "aceitaTroca": 0,
                        "hrCombinada": isoDate,
                        "hrEntrega": isoDate,
                        "cancelado": false,
                        "retiraNaLoja": true,
                        "dav": 0,
                        "hrRegistro": isoDate,
                        "pdv": 0,
                        "cupom": 0,
                        "valorRegistrado": sale.total,
                        "cep": companyDetails?.zipcode || "",
                        "cdTransportadora": 0,
                        "itens": mappedItens,
                        "pagamentoPIX": (sale.paymentType || '').toLowerCase().includes('pix'),
                        "inEntregaExpressa": false,
                        "prDesconto": 0,
                        "prDescontoPagamento": 0,
                        "idPedidoIFood": "",
                        "referencia": "",
                        "obsInterna": "",
                        "inPrioridadeSeparacao": false,
                        "itensSubstituto": [],
                        "cliente": {
                            "cpf": parseInt(String(companyDetails?.solidcon_customer_cpf || '11111111188').replace(/\D/g, '')) || 11111111188,
                            "nome": companyDetails?.solidcon_customer_name || "Consumidor final",
                            "telefone": companyDetails?.phone || "",
                            "endereco": {
                                "logradouro": companyDetails?.street || "",
                                "numero": companyDetails?.number || "",
                                "complemento": companyDetails?.complement || "",
                                "bairro": companyDetails?.neighborhood || "",
                                "cidade": companyDetails?.city || "",
                                "cdMunicipio": 3550308,
                                "cep": companyDetails?.zipcode || "",
                                "estado": companyDetails?.state || ""
                            },
                            "cdCNP_": "",
                            "dtNascimento": "",
                            "dtCadastro": "",
                            "sexo": "",
                            "nrDependentes": 0,
                            "email": companyDetails?.email || "",
                            "celular": companyDetails?.phone || "",
                            "idClienteIFood": ""
                        },
                        "pagamento": {
                            "formaPagamento": sale.paymentType || "Dinheiro",
                            "tef": sale.cardInfo ? {
                                "nsuHost": sale.cardInfo.nsu || "",
                                "autorizacao": sale.cardInfo.authorization || "",
                                "codigoCartao": 0,
                                "codigoTipo": 0,
                                "codigoParcela": 0,
                                "codigoOperadora": 0,
                                "cartaoValorReservado": sale.total,
                                "idPagamento": "",
                                "bandeira": sale.cardInfo.brand || "",
                                "parcela": parseInt(sale.cardInfo.installments) || 1,
                                "parcelaModalidade": 0
                            } : null
                        }
                    };
                    // Helper to clean empty properties
                    const cleanObject = (o) => {
                        if (o === null || o === undefined)
                            return undefined;
                        if (Array.isArray(o)) {
                            if (o.length === 0)
                                return undefined;
                            const arr = o.map(cleanObject).filter(v => v !== undefined);
                            return arr.length > 0 ? arr : undefined;
                        }
                        if (typeof o === 'object') {
                            const cleaned = {};
                            for (const [k, v] of Object.entries(o)) {
                                const cleanedVal = cleanObject(v);
                                if (cleanedVal !== undefined && cleanedVal !== null && cleanedVal !== "") {
                                    cleaned[k] = cleanedVal;
                                }
                            }
                            return Object.keys(cleaned).length > 0 ? cleaned : undefined;
                        }
                        return o;
                    };
                    return cleanObject(rawPayload) || {};
                });
                const payloadToShow = mappedOrders.length === 1 ? mappedOrders[0] : mappedOrders;
                const exportUrlInput = getById('solidconExportUrl');
                const exportJsonTextarea = getById('solidconExportJson');
                const modalAlert = getById('solidconModalAlert');
                if (modalAlert) {
                    modalAlert.classList.add('hidden');
                    modalAlert.textContent = '';
                }
                if (exportUrlInput) {
                    exportUrlInput.value = companyDetails?.solidcon_url_4 || "";
                }
                if (exportJsonTextarea) {
                    exportJsonTextarea.value = JSON.stringify(payloadToShow, null, 2);
                }
                getById('solidconExportModal').classList.remove('hidden');
                if (missingExternalCodes.length > 0) {
                    UI.showAlert('solidconModalAlert', `Aviso: Os seguintes produtos não possuem o Código Externo (Solidcon) configurado no cadastro de produtos e foram mapeados como 0: ${[...new Set(missingExternalCodes)].join(', ')}. Você pode corrigir os códigos manualmente no JSON abaixo antes de enviar.`, 'warning');
                }
                if (!companyDetails?.cnpj || String(companyDetails.cnpj).replace(/\D/g, '') === '') {
                    UI.showAlert('solidconModalAlert', 'Aviso: O CNPJ da empresa não está configurado. O campo cnpj foi enviado como 0 no JSON. Verifique o cadastro da empresa.', 'warning');
                }
            });
        }
        // Copy JSON logic
        const btnCopySolidconJson = getById('btnCopySolidconJson');
        if (btnCopySolidconJson) {
            btnCopySolidconJson.addEventListener('click', async () => {
                const textarea = getById('solidconExportJson');
                if (!textarea)
                    return;
                try {
                    await navigator.clipboard.writeText(textarea.value);
                    UI.showAlert('alertMessage', 'JSON copiado para a área de transferência.', 'success');
                }
                catch (err) {
                    textarea.select();
                    UI.showAlert('alertMessage', 'Selecione o texto e copie manualmente.', 'error');
                }
            });
        }
        // Confirm Send logic
        const btnConfirmSendSolidcon = getById('btnConfirmSendSolidcon');
        if (btnConfirmSendSolidcon) {
            btnConfirmSendSolidcon.addEventListener('click', async () => {
                const url = getById('solidconExportUrl')?.value || '';
                const jsonText = getById('solidconExportJson')?.value || '';
                if (!url) {
                    UI.showAlert('solidconModalAlert', 'A URL do Solidcon é obrigatória.', 'error');
                    return;
                }
                if (!jsonText) {
                    UI.showAlert('solidconModalAlert', 'O JSON do Pedido é obrigatório.', 'error');
                    return;
                }
                const originalText = btnConfirmSendSolidcon.innerHTML;
                btnConfirmSendSolidcon.disabled = true;
                btnConfirmSendSolidcon.innerHTML = `
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Enviando...
                `;
                try {
                    let parsedPayload;
                    try {
                        parsedPayload = JSON.parse(jsonText);
                    }
                    catch (e) {
                        throw new Error(`JSON inválido: ${e.message}. Por favor, verifique a sintaxe.`);
                    }
                    const payloadsToSend = Array.isArray(parsedPayload) ? parsedPayload : [parsedPayload];
                    let lastResponse = null;
                    for (const singlePayload of payloadsToSend) {
                        lastResponse = await api('/companies/proxy-consulta', {
                            method: 'POST',
                            body: JSON.stringify({
                                url,
                                method: 'POST',
                                payload: singlePayload
                            })
                        });
                    }
                    // Save to sent sales list in localStorage
                    const sentKey = `solidcon_sent_sales_${companyPublicId}`;
                    const detailsKey = `solidcon_sent_details_${companyPublicId}`;
                    const sentCodes = JSON.parse(localStorage.getItem(sentKey) || '[]');
                    const sentDetails = JSON.parse(localStorage.getItem(detailsKey) || '{}');
                    currentlyExportingSales.forEach((sale, index) => {
                        if (!sentCodes.includes(sale.salePosCodeId)) {
                            sentCodes.push(sale.salePosCodeId);
                        }
                        const currentPayload = payloadsToSend[index] || {};
                        let summary = 'Enviado';
                        if (currentPayload.numero) {
                            summary = `Ref: ${currentPayload.numero}`;
                        }
                        if (lastResponse) {
                            if (lastResponse.data) {
                                if (typeof lastResponse.data === 'string') {
                                    summary += ` - ${lastResponse.data}`;
                                }
                                else if (typeof lastResponse.data === 'object') {
                                    const codeVal = lastResponse.data.codigo || lastResponse.data.id || lastResponse.data.numero || lastResponse.data.message || '';
                                    if (codeVal) {
                                        summary += ` (${codeVal})`;
                                    }
                                }
                            }
                            else if (lastResponse.message) {
                                summary += ` (${lastResponse.message})`;
                            }
                        }
                        sentDetails[sale.salePosCodeId] = summary;
                    });
                    localStorage.setItem(sentKey, JSON.stringify(sentCodes));
                    localStorage.setItem(detailsKey, JSON.stringify(sentDetails));
                    closeSolidconModal();
                    renderSalesTable();
                    UI.showAlert('alertMessage', lastResponse?.message || 'Pedido enviado com sucesso para o Solidcon.', 'success');
                }
                catch (err) {
                    let msg = err.message || 'Erro ao enviar pedido para o Solidcon.';
                    if (typeof msg === 'string') {
                        if (msg.includes('Object reference not set') || msg.includes('instance of an object')) {
                            msg += ' (Dica: Este erro indica que algum código no JSON não foi encontrado no Solidcon, como o codigoInterno de um produto, o CNPJ da empresa, o código da formaPagamento, ou cdMunicipio do endereço.)';
                        }
                        else if (msg.includes('JSON inválido') || msg.includes('Unexpected')) {
                            const posMatch = msg.match(/position (\d+)/i);
                            const lineColMatch = msg.match(/(line \d+ column \d+)/i);
                            let highlightedPart = '';
                            if (lineColMatch) {
                                highlightedPart = lineColMatch[1];
                            }
                            else if (posMatch) {
                                highlightedPart = `position ${posMatch[1]}`;
                            }
                            if (highlightedPart) {
                                msg = msg.replace(highlightedPart, `<span class="bg-red-200 dark:bg-red-950 text-red-900 dark:text-red-100 px-1.5 py-0.5 rounded font-bold border border-red-300">${highlightedPart}</span>`);
                            }
                            if (posMatch) {
                                const pos = parseInt(posMatch[1], 10);
                                if (!isNaN(pos)) {
                                    setTimeout(() => {
                                        const textarea = getById('solidconExportJson');
                                        if (textarea) {
                                            textarea.focus();
                                            textarea.setSelectionRange(Math.max(0, pos - 1), pos + 2);
                                        }
                                    }, 50);
                                }
                            }
                        }
                    }
                    // Save failure message to localStorage for the active sales!
                    try {
                        const detailsKey = `solidcon_sent_details_${companyPublicId}`;
                        const sentDetails = JSON.parse(localStorage.getItem(detailsKey) || '{}');
                        currentlyExportingSales.forEach(sale => {
                            const cleanText = msg.replace(/<[^>]*>/g, '');
                            sentDetails[sale.salePosCodeId] = `Erro: ${cleanText}`;
                        });
                        localStorage.setItem(detailsKey, JSON.stringify(sentDetails));
                        renderSalesTable();
                    }
                    catch (e) {
                        console.error('Failed to save error status to localStorage', e);
                    }
                    const el = getById('solidconModalAlert');
                    if (el) {
                        el.innerHTML = msg;
                        el.classList.remove('hidden', 'bg-yellow-100', 'text-yellow-800', 'dark:bg-yellow-900/40', 'dark:text-yellow-300', 'bg-green-100', 'text-green-700', 'dark:bg-green-900/40', 'dark:text-green-300');
                        el.classList.add('bg-red-100', 'text-red-700', 'dark:bg-red-900/40', 'dark:text-red-300');
                    }
                }
                finally {
                    btnConfirmSendSolidcon.disabled = false;
                    btnConfirmSendSolidcon.innerHTML = originalText;
                }
            });
        }
        // Cancel Modal close events
        const closeCancelModal = () => {
            getById('solidconCancelModal').classList.add('hidden');
        };
        const closeCancelBtn = getById('closeCancelModalBtn');
        const closeCancelBg = getById('closeCancelModalBg');
        const cancelCancelBtn = getById('btnCancelCancelModal');
        if (closeCancelBtn)
            closeCancelBtn.addEventListener('click', closeCancelModal);
        if (closeCancelBg)
            closeCancelBg.addEventListener('click', closeCancelModal);
        if (cancelCancelBtn)
            cancelCancelBtn.addEventListener('click', closeCancelModal);
        // Confirm cancellation handler
        const btnConfirmCancelSolidcon = getById('btnConfirmCancelSolidcon');
        if (btnConfirmCancelSolidcon) {
            btnConfirmCancelSolidcon.addEventListener('click', async () => {
                const url = getById('solidconCancelUrl')?.value || '';
                const bodyText = getById('solidconCancelJson')?.value || '{}';
                const saleId = btnConfirmCancelSolidcon.dataset.saleId || '';
                if (!url) {
                    UI.showAlert('solidconCancelModalAlert', 'A URL do Endpoint é obrigatória.', 'error');
                    return;
                }
                let payload = null;
                if (bodyText && bodyText !== '{}') {
                    try {
                        payload = JSON.parse(bodyText);
                    }
                    catch (e) {
                        UI.showAlert('solidconCancelModalAlert', `JSON inválido: ${e.message}`, 'error');
                        return;
                    }
                }
                const originalText = btnConfirmCancelSolidcon.innerHTML;
                btnConfirmCancelSolidcon.disabled = true;
                btnConfirmCancelSolidcon.innerHTML = `
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Cancelando...
                `;
                try {
                    const response = await api('/companies/proxy-consulta', {
                        method: 'POST',
                        body: JSON.stringify({
                            url,
                            method: 'PUT',
                            payload
                        })
                    });
                    // Save 'Cancelado' status
                    const detailsKey = `solidcon_sent_details_${companyPublicId}`;
                    const sentDetails = JSON.parse(localStorage.getItem(detailsKey) || '{}');
                    if (saleId) {
                        sentDetails[saleId] = 'Cancelado';
                        localStorage.setItem(detailsKey, JSON.stringify(sentDetails));
                    }
                    closeCancelModal();
                    renderSalesTable();
                    UI.showAlert('alertMessage', response.message || 'Pedido cancelado com sucesso no Solidcon.', 'success');
                }
                catch (err) {
                    const msg = err.message || 'Erro ao cancelar pedido no Solidcon.';
                    const alertEl = getById('solidconCancelModalAlert');
                    if (alertEl) {
                        alertEl.innerHTML = msg;
                        alertEl.className = 'p-4 rounded-xl text-sm bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
                    }
                }
                finally {
                    btnConfirmCancelSolidcon.disabled = false;
                    btnConfirmCancelSolidcon.innerHTML = originalText;
                }
            });
        }
    });
})();
