(() => {
    const getById = (id) => document.getElementById(id);

    let customers = [];
    let customerGroups = [];
    let services = [];
    let products = [];
    let revenueCategories = [];
    let bankAccounts = [];
    let receivableTypes = [];
    let launches = [];
    let filteredLaunches = [];
    let companyInfo = null;

    function normalizeText(value) {
        return String(value || '').trim();
    }

    function parseNumber(value) {
        const normalized = normalizeText(value).replace(',', '.');
        return Number(normalized);
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatCurrency(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numeric);
    }

    function getCurrentDateValue() {
        const now = new Date();
        const timezoneOffset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
    }

    function formatDateTime(value) {
        if (!value) return '-';
        return window.DateUtils?.formatDateTime ? window.DateUtils.formatDateTime(value) : String(value);
    }

    function toDateInputValue(value) {
        if (!value) return '';
        const asString = String(value);
        if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) return asString;
        const parsed = new Date(asString);
        if (Number.isNaN(parsed.getTime())) return '';
        const timezoneOffset = parsed.getTimezoneOffset() * 60000;
        return new Date(parsed.getTime() - timezoneOffset).toISOString().slice(0, 10);
    }

    function showAlert(message, type = 'success') {
        const el = getById('alertMessage');
        if (!el) return;

        el.textContent = message;
        el.className = `mx-4 sm:mx-0 mb-4 p-4 rounded-xl text-sm ${type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`;
        el.classList.remove('hidden');

        setTimeout(() => el.classList.add('hidden'), 3500);
    }

    function loadLaunchesFromResponse(response) {
        launches = Array.isArray(response?.data) ? response.data : [];
        filteredLaunches = [...launches];
    }

    async function loadLaunches() {
        const response = await api('/estoque/service-launches');
        loadLaunchesFromResponse(response);
    }

    function formatDoc(doc) {
        if (!doc) return 'Sem doc';
        const clean = doc.replace(/\D/g, '');
        if (clean.length === 11) {
            return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        }
        if (clean.length === 14) {
            return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        }
        return doc;
    }

    function customerLabel(customer) {
        return customer?.trade_name || customer?.name || customer?.full_name || customer?.company_name || 'Cliente';
    }

    function populateCustomerGroups() {
        const select = getById('launchCustomerGroup');
        if (!select) return;

        const options = ['<option value="">Todos os grupos</option>']
            .concat(customerGroups.map((item) => `<option value="${escapeHtml(item.public_id)}">${escapeHtml(item.name)}</option>`));
        select.innerHTML = options.join('');
    }

    function populateCustomers() {
        const select = getById('launchCustomer');
        if (!select) return;

        const selectedGroup = getById('launchCustomerGroup')?.value || '';
        const filteredCustomers = selectedGroup
            ? customers.filter((item) => String(item.customer_group_public_id) === String(selectedGroup))
            : customers;

        const options = ['<option value="">Selecione...</option>']
            .concat(filteredCustomers.map((item) => {
                const label = item.company_name || item.name || item.trade_name || 'Cliente';
                const doc = item.cnpj_cpf ? formatDoc(item.cnpj_cpf) : 'S/ Documento';
                return `<option value="${escapeHtml(item.public_id)}">${escapeHtml(label)} (${escapeHtml(doc)})</option>`;
            }));
        select.innerHTML = options.join('');
    }

    function getServiceOptionsHtml() {
        return ['<option value="">Selecione...</option>']
            .concat(services.map((item) => `<option value="${escapeHtml(item.public_id)}">${escapeHtml(item.name)} (${escapeHtml(formatCurrency(item.price))})</option>`))
            .join('');
    }

    function getProductOptionsHtml() {
        return ['<option value="">Selecione...</option>']
            .concat(products.map((item) => `<option value="${escapeHtml(item.public_id)}">${escapeHtml(item.name)} (${escapeHtml(formatCurrency(item.selling_price))})</option>`))
            .join('');
    }

    function findProduct(publicId) {
        return products.find((item) => String(item.public_id) === String(publicId)) || null;
    }

    function addServiceRow(type = 'service', itemPublicId = '', quantity = 1, unitPrice = 0, isEdit = false) {
        const container = getById('serviceRowsContainer');
        if (!container) return null;

        const rowId = 'row_' + Math.random().toString(36).substring(2, 9);
        const row = document.createElement('div');
        row.id = rowId;
        row.className = 'service-row grid grid-cols-12 gap-2 items-end border-b border-gray-150 dark:border-slate-800 pb-3 last:border-b-0 last:pb-0';
        
        row.innerHTML = `
            <div class="col-span-12 sm:col-span-2">
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tipo <span class="text-red-500">*</span></label>
                <select class="item-type-select block w-full bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm py-1.5 px-3 focus:outline-none sm:text-sm">
                    <option value="service" ${type === 'service' ? 'selected' : ''}>Serviço</option>
                    <option value="product" ${type === 'product' ? 'selected' : ''}>Produto</option>
                </select>
            </div>
            <div class="col-span-12 sm:col-span-4">
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Item <span class="text-red-500">*</span></label>
                <select class="service-select block w-full bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm py-1.5 px-3 focus:outline-none sm:text-sm" required>
                    <!-- Dinâmico -->
                </select>
            </div>
            <div class="col-span-4 sm:col-span-2">
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Qtd. <span class="text-red-500">*</span></label>
                <input type="number" class="service-qty block w-full bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm py-1.5 px-3 focus:outline-none sm:text-sm" min="0.01" step="0.01" value="${quantity}" required>
            </div>
            <div class="col-span-4 sm:col-span-2">
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Unitário <span class="text-red-500">*</span></label>
                <input type="number" class="service-price block w-full bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm py-1.5 px-3 focus:outline-none sm:text-sm" min="0" step="0.01" value="${unitPrice > 0 ? unitPrice.toFixed(2) : ''}" required>
            </div>
            <div class="col-span-3 sm:col-span-1 text-right">
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Total</label>
                <span class="service-total text-sm font-semibold text-gray-700 dark:text-gray-300 block py-1.5">R$ 0,00</span>
            </div>
            <div class="col-span-1 text-center remove-btn-col">
                <button type="button" class="btn-remove-row text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1.5 focus:outline-none" title="Remover Item">
                    <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
        `;

        container.appendChild(row);

        const typeSelect = row.querySelector('.item-type-select');
        const select = row.querySelector('.service-select');
        const qtyInput = row.querySelector('.service-qty');
        const priceInput = row.querySelector('.service-price');
        const totalSpan = row.querySelector('.service-total');
        const removeBtn = row.querySelector('.btn-remove-row');

        const populateItems = (currentType, preselectedValue = '') => {
            if (currentType === 'product') {
                select.innerHTML = getProductOptionsHtml();
            } else {
                select.innerHTML = getServiceOptionsHtml();
            }
            if (preselectedValue) {
                select.value = preselectedValue;
            }
        };

        populateItems(type, itemPublicId);

        const updateRowTotal = () => {
            const q = Number(qtyInput.value || 0);
            const p = Number(priceInput.value || 0);
            totalSpan.textContent = formatCurrency(q * p);
            updateCalculatedTotal();
        };

        typeSelect.addEventListener('change', () => {
            populateItems(typeSelect.value);
            priceInput.value = '';
            updateRowTotal();
        });

        select.addEventListener('change', () => {
            const currentType = typeSelect.value;
            if (currentType === 'product') {
                const selected = findProduct(select.value);
                if (selected) {
                    priceInput.value = Number(selected.selling_price || 0).toFixed(2);
                }
            } else {
                const selected = findService(select.value);
                if (selected) {
                    priceInput.value = Number(selected.price || 0).toFixed(2);
                }
            }
            updateRowTotal();
        });

        qtyInput.addEventListener('input', updateRowTotal);
        priceInput.addEventListener('input', updateRowTotal);

        removeBtn.addEventListener('click', () => {
            const rows = container.querySelectorAll('.service-row');
            if (rows.length <= 1 && !isEdit) {
                typeSelect.value = 'service';
                populateItems('service');
                qtyInput.value = '1';
                priceInput.value = '';
                updateRowTotal();
                return;
            }
            row.remove();
            updateCalculatedTotal();
        });

        if (isEdit) {
            typeSelect.disabled = true;
            select.disabled = true;
            removeBtn.classList.add('hidden');
        }

        updateRowTotal();
        return row;
    }

    function populateRevenueCategories() {
        const select = getById('launchRevenueCategory');
        if (!select) return;

        const options = ['<option value="">Selecione...</option>']
            .concat(revenueCategories.map((item) => `<option value="${escapeHtml(item.public_id)}">${escapeHtml(item.name)}</option>`));
        select.innerHTML = options.join('');
    }

    function populateBankAccounts() {
        const select = getById('launchRevenueBank');
        if (!select) return;

        const options = ['<option value="">Selecione...</option>']
            .concat(bankAccounts.map((item) => `<option value="${escapeHtml(item.public_id)}">${escapeHtml(item.name)}</option>`));
        select.innerHTML = options.join('');
    }

    function mapReceivableTypeNameToEnum(name) {
        const raw = String(name || '').toLowerCase();
        if (raw.includes('pix')) return 'pix';
        if (raw.includes('boleto')) return 'boleto';
        if (raw.includes('credito') || raw.includes('credit') || raw.includes('crédito')) return 'credit';
        if (raw.includes('debito') || raw.includes('debit') || raw.includes('débito')) return 'debit';
        if (raw.includes('dinheiro') || raw.includes('cash')) return 'cash';
        if (raw.includes('transferencia') || raw.includes('transferência') || raw.includes('transfer') || raw.includes('ted') || raw.includes('doc')) return 'transfer';
        return 'cash';
    }

    function updatePaymentMethodOptions() {
        const bankSelect = getById('launchRevenueBank');
        const paymentEl = getById('launchRevenuePaymentMethod');
        if (!paymentEl || !bankSelect) return;

        const selectedBankPublicId = bankSelect.value;
        const bankObj = bankAccounts.find(b => b.public_id === selectedBankPublicId);
        const bankId = bankObj ? bankObj.id : null;

        const filteredTypes = bankId
            ? receivableTypes.filter(rt => rt.bank_account_id === bankId)
            : [];

        if (!selectedBankPublicId) {
            paymentEl.innerHTML = '<option value="">Selecione uma conta de destino primeiro...</option>';
            paymentEl.disabled = true;
        } else if (filteredTypes.length > 0) {
            paymentEl.disabled = false;
            paymentEl.innerHTML = '<option value="">Selecione...</option>' +
                filteredTypes.map(rt => {
                    const enumValue = mapReceivableTypeNameToEnum(rt.name);
                    return `<option value="${escapeHtml(enumValue)}">${escapeHtml(rt.name)}</option>`;
                }).join('');

            if (filteredTypes.length === 1) {
                paymentEl.value = mapReceivableTypeNameToEnum(filteredTypes[0].name);
            } else {
                const firstPix = filteredTypes.find(rt => rt.name.toLowerCase().includes('pix'));
                if (firstPix) {
                    paymentEl.value = 'pix';
                }
            }
        } else {
            paymentEl.disabled = false;
            const isCashAccount = bankObj && bankObj.type === 'cash';

            if (isCashAccount) {
                paymentEl.innerHTML = `
                    <option value="">Selecione...</option>
                    <option value="cash">Dinheiro</option>
                `;
                paymentEl.value = 'cash';
            } else {
                paymentEl.innerHTML = `
                    <option value="">Selecione...</option>
                    <option value="pix">PIX</option>
                    <option value="transfer">Transferência</option>
                    <option value="boleto">Boleto</option>
                    <option value="credit">Cartão de Crédito</option>
                    <option value="debit">Cartão de Débito</option>
                `;
                if (bankObj && bankObj.pix_key) {
                    paymentEl.value = 'pix';
                } else {
                    paymentEl.value = 'transfer';
                }
            }
        }
    }

    function toggleRevenueFields() {
        const shouldCreate = Boolean(getById('launchCreateRevenue')?.checked);
        const container = getById('launchRevenueFields');
        const category = getById('launchRevenueCategory');
        const bank = getById('launchRevenueBank');
        const date = getById('launchRevenueDate');
        const paymentMethod = getById('launchRevenuePaymentMethod');

        if (!container || !category || !bank || !date || !paymentMethod) return;

        container.classList.toggle('hidden', !shouldCreate);
        container.classList.toggle('grid', shouldCreate);
        category.required = shouldCreate;
        bank.required = shouldCreate;
        date.required = shouldCreate;
        paymentMethod.required = shouldCreate;

        if (!shouldCreate) {
            category.value = '';
            bank.value = '';
            date.value = '';
            paymentMethod.value = '';
        } else if (!date.value) {
            date.value = getCurrentDateValue();
        }
    }

    function findCustomer(publicId) {
        return customers.find((item) => String(item.public_id) === String(publicId)) || null;
    }

    function findService(publicId) {
        return services.find((item) => String(item.public_id) === String(publicId)) || null;
    }

    function updateCalculatedTotal() {
        const rows = document.querySelectorAll('.service-row');
        let grandTotal = 0;

        rows.forEach(row => {
            const qty = parseNumber(row.querySelector('.service-qty')?.value);
            const price = parseNumber(row.querySelector('.service-price')?.value);
            if (Number.isFinite(qty) && qty > 0 && Number.isFinite(price) && price >= 0) {
                grandTotal += (qty * price);
            }
        });

        const grandTotalSpan = getById('launchGrandTotal');
        if (grandTotalSpan) {
            grandTotalSpan.textContent = formatCurrency(grandTotal);
        }
    }

    function openReceipt(pubId) {
        if (!pubId) return;
        let url = '/api/v1/finance/revenues/' + pubId + '/receipt';
        const jwtToken = sessionStorage.getItem('erp_token');
        if (jwtToken) {
            url += '?token=' + jwtToken;
        }

        const pdfIframe = getById('pdfIframe');
        const printPdfBtn = getById('printPdfBtn');
        const pdfModalTitleText = getById('pdfModalTitleText');
        if (pdfIframe) pdfIframe.src = url;
        if (printPdfBtn) printPdfBtn.classList.remove('hidden');
        if (pdfModalTitleText) pdfModalTitleText.textContent = 'Recibo';
        getById('pdfModal')?.classList.remove('hidden');
    }

    function openNfse(launchId) {
        if (!launchId) return;
        const launch = launches.find((item) => String(item.public_id) === String(launchId));
        if (!launch) return;

        const customer = findCustomer(launch.customer_public_id);
        const service = launch.service_public_id ? findService(launch.service_public_id) : null;
        const product = launch.product_public_id ? findProduct(launch.product_public_id) : null;
        const isTransmitted = launch.nfse_status === 'transmitted';

        const issueDate = isTransmitted ? formatDateTime(launch.nfse_issued_at) : formatDateTime(launch.created_at);
        const invoiceNumber = isTransmitted ? String(launch.nfse_number || '').padStart(8, '0') : String(launch.id || '1').padStart(8, '0');
        const verificationCode = isTransmitted ? (launch.nfse_verification_code || '') : 'RASCUNHO';

        const providerName = companyInfo?.company_name || companyInfo?.trade_name || 'Empresa Prestadora de Serviços Ltda';
        const providerCnpj = companyInfo?.cnpj || '00.000.000/0001-00';
        const providerIm = companyInfo?.im || '—';
        const providerAddress = [
            companyInfo?.street, companyInfo?.number, companyInfo?.complement,
            companyInfo?.neighborhood ? '- ' + companyInfo.neighborhood : '',
            companyInfo?.zipcode ? 'CEP: ' + companyInfo.zipcode : ''
        ].filter(Boolean).join(', ');
        const providerCity = companyInfo?.city || 'Município';
        const providerState = companyInfo?.state || 'UF';
        const providerEmail = companyInfo?.email || '';
        const providerPhone = companyInfo?.phone || '';

        const customerName = customerLabel(customer);
        const customerCnpj = customer?.cnpj_cpf || 'NÃO INFORMADO';
        const customerAddress = [
            customer?.street, customer?.number, customer?.complement,
            customer?.neighborhood ? '- ' + customer.neighborhood : '',
            customer?.zipcode ? 'CEP: ' + customer.zipcode : ''
        ].filter(Boolean).join(', ') || 'Endereço não informado';
        const customerCity = customer?.city || '—';
        const customerState = customer?.state || '—';
        const customerEmail = customer?.email || '';
        const customerPhone = customer?.phone || '';

        const serviceName = service?.name || launch.service_name || product?.name || launch.product_name || '—';
        const serviceDescription = service?.description || product?.description || launch.observation || '';
        const qtyVal = Number(launch.quantity || 1);
        const priceVal = Number(launch.unit_price || 0);
        const totalVal = qtyVal * priceVal;
        const serviceTaxCode = service?.municipal_tax_code || service?.national_tax_code || '—';

        const issRateVal = 2.00;
        const issValueVal = totalVal * (issRateVal / 100);
        const liquidValue = totalVal - issValueVal;

        // Chave de acesso simulada de 50 dígitos
        const cnpjClean = providerCnpj.replace(/\D/g, '').padStart(14, '0');
        const vcClean = verificationCode.replace(/[^0-9A-Z]/gi, '').toUpperCase().padEnd(36, '0');
        const accessKey50 = (cnpjClean + vcClean).substring(0, 50).padEnd(50, '0');
        const formattedKey = accessKey50.match(/.{1,5}/g)?.join(' ') || accessKey50;
        const qrValue = isTransmitted
            ? `https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${accessKey50}`
            : 'RASCUNHO-SEM-VALOR-FISCAL';
        const qrCodeSrc = `https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(qrValue)}`;

        const nfseHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>DANFSe – Documento Auxiliar da NFS-e</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;font-size:7pt;color:#000;background:#fff;padding:6mm}
.wrap{width:100%;max-width:195mm;margin:0 auto;border:1.5px solid #000;background:#fff}
table{width:100%;border-collapse:collapse;margin-top:-1px}
td{border:1px solid #000;padding:4px 6px;vertical-align:top}
.shdr{background:#fff;border:1px solid #000;padding:4px 6px;font-size:7pt;font-weight:bold;text-transform:uppercase;color:#000}
.lbl{font-size:5.5pt;font-weight:bold;text-transform:uppercase;color:#000;display:block;margin-bottom:2px}
.val{font-size:7.5pt;font-weight:normal;color:#000;display:block}
.val-bold{font-weight:bold}
.draft-bar{background:#fff3cd;border-bottom:2px dashed #f0ad4e;color:#7d5a00;font-size:7.5pt;font-weight:bold;text-align:center;padding:5px 8px;margin-bottom:5px}
.watermark{position:fixed;top:45%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:52pt;font-weight:900;color:rgba(200,0,0,.07);pointer-events:none;z-index:9999;white-space:nowrap;letter-spacing:6px}
</style>
</head>
<body>

${!isTransmitted ? `<div class="draft-bar">⚠️ DOCUMENTO SEM VALOR FISCAL — RASCUNHO / SIMULAÇÃO — Não transmitido à prefeitura municipal</div><div class="watermark">RASCUNHO</div>` : ''}

<div class="wrap">

  <!-- ═══ CABEÇALHO (ESTILO NITERÓI) ════════════════════════════ -->
  <table style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="width: 30%; border: 1px solid #000; padding: 6px; vertical-align: middle;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 16pt; font-weight: 900; color: #2e7d32; font-family: Arial, sans-serif; letter-spacing: -1px;">NFSe</span>
          <div style="font-size: 5.5pt; font-weight: bold; line-height: 1.2; text-transform: uppercase;">
            Nota Fiscal de<br>Serviço eletrônica
          </div>
        </div>
      </td>
      <td style="width: 40%; border: 1px solid #000; padding: 6px; text-align: center; vertical-align: middle;">
        <div style="font-size: 10pt; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">DANFSe v1.0</div>
        <div style="font-size: 7.5pt; font-weight: bold; color: #000; margin-top: 2px;">Documento Auxiliar da NFS-e</div>
      </td>
      <td style="width: 30%; border: 1px solid #000; padding: 6px; vertical-align: middle;">
        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
          <div style="font-size: 5.5pt; font-weight: bold; line-height: 1.2; text-align: right; text-transform: uppercase;">
            Prefeitura de Niterói<br>Secretaria Municipal de Fazenda<br>iss@fazenda.niteroi.rj.gov.br
          </div>
          <div style="width: 24px; height: 24px; border: 1.5px solid #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 5pt; font-weight: bold;">
            NIT
          </div>
        </div>
      </td>
    </tr>
  </table>

  <!-- ═══ CHAVE DE ACESSO / NÚMERO / QR CODE ═════════════════════ -->
  <table style="width: 100%; border-collapse: collapse; margin-top: -1px;">
    <tr>
      <td colspan="3" style="width: 75%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Chave de Acesso da NFS-e</span>
        <span class="val" style="font-family: monospace; font-size: 8.5pt; font-weight: bold; letter-spacing: 0.5px;">${escapeHtml(accessKey50)}</span>
      </td>
      <td rowspan="3" style="width: 25%; border: 1px solid #000; padding: 6px; text-align: center; vertical-align: top;">
        <img src="${qrCodeSrc}" style="width: 60px; height: 60px; display: block; margin: 0 auto 4px;" alt="QR Code">
        <div style="font-size: 4.5pt; color: #000; line-height: 1.2; text-align: left;">
          A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e
        </div>
      </td>
    </tr>
    <tr>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Número da NFS-e</span>
        <span class="val" style="font-weight: bold; font-size: 8.5pt;">${escapeHtml(invoiceNumber)}</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Competência da NFS-e</span>
        <span class="val">${escapeHtml(issueDate.split(' ')[0])}</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Data e Hora da emissão da NFS-e</span>
        <span class="val">${escapeHtml(issueDate)}</span>
      </td>
    </tr>
    <tr>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Número da DPS</span>
        <span class="val">${escapeHtml(launch.id || '32')}</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Série da DPS</span>
        <span class="val">70000</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Data e Hora da emissão da DPS</span>
        <span class="val">${escapeHtml(issueDate)}</span>
      </td>
    </tr>
  </table>

  <!-- ═══ PRESTADOR DE SERVIÇO ══════════════════════════════════ -->
  <table style="width: 100%; border-collapse: collapse; margin-top: -1px;">
    <tr>
      <td colspan="4" class="shdr" style="border: 1px solid #000;">
        EMITENTE DA NFS-e <span style="font-weight: normal; font-size: 5.5pt; margin-left: 10px;">Prestador do Serviço</span>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="width: 50%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Nome / Nome Empresarial</span>
        <span class="val" style="font-weight: bold;">${escapeHtml(providerName)}</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">CNPJ / CPF / NIF</span>
        <span class="val">${escapeHtml(providerCnpj)}</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Inscrição Municipal</span>
        <span class="val">${escapeHtml(providerIm)}</span>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="width: 50%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Endereço</span>
        <span class="val">${escapeHtml(providerAddress || '—')}</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Município / UF</span>
        <span class="val">${escapeHtml(providerCity)} - ${escapeHtml(providerState)}</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">CEP</span>
        <span class="val">${escapeHtml(companyInfo?.zipcode || '—')}</span>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="width: 50%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">E-mail</span>
        <span class="val">${escapeHtml(providerEmail || '—')}</span>
      </td>
      <td colspan="2" style="width: 50%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Telefone</span>
        <span class="val">${escapeHtml(providerPhone || '—')}</span>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="width: 50%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Simples Nacional na Data de Competência</span>
        <span class="val">Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)</span>
      </td>
      <td colspan="2" style="width: 50%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Regime de Apuração Tributária pelo SN</span>
        <span class="val">Regime de apuração dos tributos federais e municipal pelo Simples Nacional</span>
      </td>
    </tr>
  </table>

  <!-- ═══ TOMADOR DE SERVIÇO ════════════════════════════════════ -->
  <table style="width: 100%; border-collapse: collapse; margin-top: -1px;">
    <tr>
      <td colspan="4" class="shdr" style="border: 1px solid #000;">
        TOMADOR DO SERVIÇO
      </td>
    </tr>
    <tr>
      <td colspan="2" style="width: 50%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Nome / Nome Empresarial</span>
        <span class="val" style="font-weight: bold;">${escapeHtml(customerName)}</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">CNPJ / CPF / NIF</span>
        <span class="val">${escapeHtml(customerCnpj)}</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Inscrição Municipal</span>
        <span class="val">—</span>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="width: 50%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Endereço</span>
        <span class="val">${escapeHtml(customerAddress || '—')}</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Município / UF</span>
        <span class="val">${escapeHtml(customerCity)} - ${escapeHtml(customerState)}</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">CEP</span>
        <span class="val">${escapeHtml(customer?.zipcode || '—')}</span>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="width: 50%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">E-mail</span>
        <span class="val">${escapeHtml(customerEmail || '—')}</span>
      </td>
      <td colspan="2" style="width: 50%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Telefone</span>
        <span class="val">${escapeHtml(customerPhone || '—')}</span>
      </td>
    </tr>
  </table>

  <!-- ═══ INTERMEDIÁRIO ═════════════════════════════════════════ -->
  <table style="width: 100%; border-collapse: collapse; margin-top: -1px;">
    <tr>
      <td class="shdr" style="border: 1px solid #000; text-align: center;">
        INTERMEDIÁRIO DO SERVIÇO NÃO IDENTIFICADO NA NFS-e
      </td>
    </tr>
  </table>

  <!-- ═══ SERVIÇO PRESTADO ══════════════════════════════════════ -->
  <table style="width: 100%; border-collapse: collapse; margin-top: -1px;">
    <tr>
      <td colspan="4" class="shdr" style="border: 1px solid #000;">
        SERVIÇO PRESTADO
      </td>
    </tr>
    <tr>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Código de Tributação Nacional</span>
        <span class="val">${escapeHtml(service?.national_tax_code || '—')}</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Código de Tributação Municipal</span>
        <span class="val">${escapeHtml(serviceTaxCode)}</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Local da Prestação</span>
        <span class="val">${escapeHtml(providerCity)} - ${escapeHtml(providerState)}</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">País da Prestação</span>
        <span class="val">—</span>
      </td>
    </tr>
    <tr>
      <td colspan="4" style="border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Descrição do Serviço</span>
        <span class="val" style="font-weight: bold; white-space: pre-wrap;">${escapeHtml(serviceDescription || serviceName)}</span>
      </td>
    </tr>
  </table>

  <!-- ═══ TRIBUTAÇÃO MUNICIPAL ══════════════════════════════════ -->
  <table style="width: 100%; border-collapse: collapse; margin-top: -1px;">
    <tr>
      <td colspan="4" class="shdr" style="border: 1px solid #000;">
        TRIBUTAÇÃO MUNICIPAL
      </td>
    </tr>
    <tr>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Tributação do ISSQN</span>
        <span class="val">Operação Tributável</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">País Resultado da Prestação do Serviço</span>
        <span class="val">—</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Município de Incidência do ISSQN</span>
        <span class="val">${escapeHtml(providerCity)} - ${escapeHtml(providerState)}</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Regime Especial de Tributação</span>
        <span class="val">Nenhum</span>
      </td>
    </tr>
    <tr>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Tipo de Imunidade</span>
        <span class="val">—</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Suspensão da Exigibilidade do ISSQN</span>
        <span class="val">Não</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Número Processo Suspensão</span>
        <span class="val">—</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Benefício Municipal</span>
        <span class="val">—</span>
      </td>
    </tr>
    <tr>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Valor do Serviço</span>
        <span class="val">${formatCurrency(totalVal)}</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Desconto Incondicionado</span>
        <span class="val">—</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Total Deduções/Reduções</span>
        <span class="val">—</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Cálculo do BM</span>
        <span class="val">—</span>
      </td>
    </tr>
    <tr>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">BC ISSQN</span>
        <span class="val">${formatCurrency(totalVal)}</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Alíquota Aplicada</span>
        <span class="val">${issRateVal.toFixed(2)}%</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Retenção do ISSQN</span>
        <span class="val">Não Retido</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">ISSQN Apurado</span>
        <span class="val">${formatCurrency(issValueVal)}</span>
      </td>
    </tr>
  </table>

  <!-- ═══ TRIBUTAÇÃO FEDERAL ════════════════════════════════════ -->
  <table style="width: 100%; border-collapse: collapse; margin-top: -1px;">
    <tr>
      <td colspan="4" class="shdr" style="border: 1px solid #000;">
        TRIBUTAÇÃO FEDERAL
      </td>
    </tr>
    <tr>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">IRRF</span>
        <span class="val">—</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Contribuição Previdenciária - Retida</span>
        <span class="val">—</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Contribuições Sociais - Retidas</span>
        <span class="val">—</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Descrição Contrib. Sociais - Retidas</span>
        <span class="val">—</span>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="width: 50%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">PIS - Débito Apuração Própria</span>
        <span class="val">—</span>
      </td>
      <td colspan="2" style="width: 50%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">COFINS - Débito Apuração Própria</span>
        <span class="val">—</span>
      </td>
    </tr>
  </table>

  <!-- ═══ VALOR TOTAL ═══════════════════════════════════════════ -->
  <table style="width: 100%; border-collapse: collapse; margin-top: -1px;">
    <tr>
      <td colspan="4" class="shdr" style="border: 1px solid #000;">
        VALOR TOTAL DA NFS-E
      </td>
    </tr>
    <tr>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Valor do Serviço</span>
        <span class="val" style="font-weight: bold;">${formatCurrency(totalVal)}</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Desconto Condicionado</span>
        <span class="val">—</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Desconto Incondicionado</span>
        <span class="val">—</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">ISSQN Retido</span>
        <span class="val">—</span>
      </td>
    </tr>
    <tr>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Total das Retenções Federais</span>
        <span class="val">—</span>
      </td>
      <td style="width: 25%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">PIS/COFINS - Débito Apur. Própria</span>
        <span class="val">—</span>
      </td>
      <td colspan="2" style="width: 50%; border: 1px solid #000; padding: 6px; background: #fafcff; vertical-align: middle;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="lbl" style="font-size: 7.5pt; color: #000; font-weight: bold; margin: 0;">Valor Líquido da NFS-e</span>
          <span style="font-size: 13pt; font-weight: 900; color: #000;">${formatCurrency(liquidValue)}</span>
        </div>
      </td>
    </tr>
  </table>

  <!-- ═══ TOTAIS APROXIMADOS ════════════════════════════════════ -->
  <table style="width: 100%; border-collapse: collapse; margin-top: -1px;">
    <tr>
      <td colspan="3" class="shdr" style="border: 1px solid #000;">
        TOTAIS APROXIMADOS DOS TRIBUTOS
      </td>
    </tr>
    <tr>
      <td style="width: 33.33%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Federais</span>
        <span class="val">—</span>
      </td>
      <td style="width: 33.33%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Estaduais</span>
        <span class="val">—</span>
      </td>
      <td style="width: 33.33%; border: 1px solid #000; padding: 4px 6px; vertical-align: top;">
        <span class="lbl">Municipais</span>
        <span class="val">—</span>
      </td>
    </tr>
  </table>

  <!-- ═══ INFORMAÇÕES COMPLEMENTARES ════════════════════════════ -->
  <table style="width: 100%; border-collapse: collapse; margin-top: -1px;">
    <tr>
      <td class="shdr" style="border: 1px solid #000;">
        INFORMAÇÕES COMPLEMENTARES
      </td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 6px 8px; min-height: 15mm; vertical-align: top; font-size: 7pt; line-height: 1.4; color: #000;">
        ${escapeHtml(launch.observation || '—')}
      </td>
    </tr>
  </table>

</div>
</body>
</html>`;

        const pdfIframe = getById('pdfIframe');
        const printPdfBtn = getById('printPdfBtn');
        const pdfModalTitleText = getById('pdfModalTitleText');
        const transmitNfseBtn = getById('transmitNfseBtn');
        const cancelNfseBtn = getById('cancelNfseBtn');


        if (pdfIframe) {
            pdfIframe.src = 'about:blank';
            setTimeout(() => {
                const doc = pdfIframe.contentDocument || pdfIframe.contentWindow.document;
                doc.open();
                doc.write(nfseHtml);
                doc.close();
            }, 100);
        }

        if (printPdfBtn) printPdfBtn.classList.remove('hidden');
        if (pdfModalTitleText) {
            pdfModalTitleText.textContent = isTransmitted
                ? 'DANFSe — Nota Fiscal de Serviço Eletrônica'
                : 'DANFSe — Rascunho (sem valor fiscal)';
        }
        if (transmitNfseBtn) {
            if (isTransmitted) {
                transmitNfseBtn.classList.add('hidden');
            } else {
                transmitNfseBtn.classList.remove('hidden');
                transmitNfseBtn.dataset.launchId = launchId;
            }
        }
        if (cancelNfseBtn) {
            if (isTransmitted) {
                cancelNfseBtn.classList.remove('hidden');
                cancelNfseBtn.dataset.launchId = launchId;
            } else {
                cancelNfseBtn.classList.add('hidden');
                delete cancelNfseBtn.dataset.launchId;
            }
        }

        getById('pdfModal')?.classList.remove('hidden');
    }

    function renderTable() {
        const tbody = getById('serviceLaunchTable');
        if (!tbody) return;

        if (filteredLaunches.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum lançamento cadastrado.</td></tr>';
            return;
        }

        tbody.innerHTML = filteredLaunches.map((item) => {
            return `
            <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" class="row-checkbox rounded border-gray-300 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50" value="${item.public_id}"></td>
                <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">${escapeHtml(item.customer_name)}</td>
                <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">${escapeHtml(item.service_name || item.product_name || '—')}</td>
                <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">${escapeHtml(String(item.quantity))}</td>
                <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">${escapeHtml(formatCurrency(item.unit_price))}</td>
                <td class="px-6 py-4 text-sm font-semibold text-gray-700 dark:text-gray-300">${escapeHtml(formatCurrency(item.total_price))}</td>
                <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">${escapeHtml(formatDateTime(item.created_at))}</td>
                <td class="px-6 py-4 text-sm">
                    ${item.type === 'product'
                        ? '<span class="text-xs text-gray-400 font-medium">N/A</span>'
                        : item.nfse_status === 'transmitted' 
                        ? `<span class="w-3.5 h-3.5 rounded-full bg-green-500 dark:bg-green-400 inline-block" title="Transmitida"></span>` 
                        : item.nfse_status === 'cancelled'
                        ? `<span class="w-3.5 h-3.5 rounded-full bg-red-500 dark:bg-red-400 inline-block" title="Cancelada"></span>`
                        : `<span class="w-3.5 h-3.5 rounded-full bg-yellow-400 inline-block" title="Não gerada"></span>`
                    }
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button type="button" title="Editar" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-3 edit-btn" data-id="${item.public_id}">
                        <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    ${item.type !== 'product' ? `
                    <button type="button" title="Nota de Serviço" class="text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-400 mr-3 open-nfse-btn" data-id="${item.public_id}">
                        <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v13a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z"/></svg>
                    </button>
                    ` : ''}
                    ${item.revenue_public_id ? `
                    <button type="button" title="Recibo" class="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 mr-3 open-receipt-btn" data-id="${item.revenue_public_id}">
                        <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    </button>
                    ` : ''}
                    <button type="button" title="Excluir" class="text-red-600 hover:text-red-900 dark:hover:text-red-400 delete-btn" data-id="${item.public_id}">
                        <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </td>
            </tr>`;
        }).join('');

        document.querySelectorAll('.edit-btn').forEach((btn) => {
            btn.addEventListener('click', () => openModal(btn.dataset.id));
        });
        document.querySelectorAll('.delete-btn').forEach((btn) => {
            btn.addEventListener('click', () => removeLaunch(btn.dataset.id));
        });
        document.querySelectorAll('.open-receipt-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openReceipt(btn.dataset.id);
            });
        });
        document.querySelectorAll('.open-nfse-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openNfse(btn.dataset.id);
            });
        });

        // Row Selection Logic
        document.querySelectorAll('.row-checkbox').forEach(chk => {
            chk.addEventListener('change', updateSelectAllState);
        });
        updateSelectAllState();
    }

    function updateSelectAllState() {
        const selectAll = getById('selectAllLaunches');
        const checkboxes = document.querySelectorAll('.row-checkbox');
        if (!selectAll || checkboxes.length === 0) return;
        const allChecked = Array.from(checkboxes).every(c => c.checked);
        const someChecked = Array.from(checkboxes).some(c => c.checked);
        selectAll.checked = allChecked;
        selectAll.indeterminate = someChecked && !allChecked;
    }

    function applyFilters() {
        const search = normalizeText(getById('filterSearch')?.value).toLowerCase();

        filteredLaunches = launches.filter((item) => {
            if (!search) return true;
            return String(item.customer_name || '').toLowerCase().includes(search)
                || String(item.service_name || '').toLowerCase().includes(search)
                || String(item.product_name || '').toLowerCase().includes(search)
                || String(item.observation || '').toLowerCase().includes(search);
        });

        renderTable();
    }

    function closeModal() {
        getById('serviceLaunchModal')?.classList.add('hidden');
    }

    function openModal(id = null) {
        const form = getById('serviceLaunchForm');
        const title = getById('modalTitle');
        form?.reset();
        getById('serviceLaunchId').value = '';
        getById('launchCreateRevenue').checked = false;
        
        const container = getById('serviceRowsContainer');
        if (container) container.innerHTML = '';
        
        toggleRevenueFields();

        let launch = null;
        if (id) {
            launch = launches.find((entry) => String(entry.public_id) === String(id));
        }

        const btnAddServiceRow = getById('btnAddServiceRow');

        if (launch) {
            title.textContent = 'Editar Lançamento';
            getById('serviceLaunchId').value = String(launch.public_id);
            
            const cust = customers.find((c) => String(c.public_id) === String(launch.customer_public_id));
            if (cust) {
                getById('launchCustomerGroup').value = cust.customer_group_public_id || '';
            } else {
                getById('launchCustomerGroup').value = '';
            }
            populateCustomers();
            
            getById('launchCustomer').value = launch.customer_public_id || '';
            getById('launchObservation').value = launch.observation || '';
            
            if (btnAddServiceRow) btnAddServiceRow.classList.add('hidden');
            
            if (launch.product_public_id) {
                addServiceRow('product', launch.product_public_id, Number(launch.quantity), Number(launch.unit_price), true);
            } else {
                addServiceRow('service', launch.service_public_id, Number(launch.quantity), Number(launch.unit_price), true);
            }

            if (launch.revenue_public_id) {
                getById('launchCreateRevenue').checked = true;
                toggleRevenueFields();
                getById('launchRevenueCategory').value = launch.revenue_category_public_id || '';
                getById('launchRevenueBank').value = launch.revenue_bank_account_public_id || '';
                updatePaymentMethodOptions();
                getById('launchRevenuePaymentMethod').value = launch.revenue_payment_method || '';
                getById('launchRevenueDate').value = toDateInputValue(launch.revenue_date);
            }
        } else {
            title.textContent = 'Novo Lançamento';
            getById('launchCustomerGroup').value = '';
            populateCustomers();
            if (btnAddServiceRow) btnAddServiceRow.classList.remove('hidden');
            
            addServiceRow('service', '', 1, 0, false);
        }

        updateCalculatedTotal();
        getById('serviceLaunchModal')?.classList.remove('hidden');
        getById('launchCustomer')?.focus();
    }

    function removeLaunch(id) {
        const item = launches.find((entry) => String(entry.public_id) === String(id));
        if (!item) return;
        if (!window.confirm(`Deseja excluir o lançamento de ${item.service_name || item.product_name || 'Item'}?`)) return;

        api(`/estoque/service-launches/${id}`, { method: 'DELETE' })
            .then(() => loadLaunches())
            .then(() => {
                applyFilters();
                showAlert('Lançamento excluído com sucesso!', 'success');
            })
            .catch((error) => {
                showAlert(error.message || 'Erro ao excluir lançamento.', 'error');
            });
    }

    async function handleSubmit(event) {
        event.preventDefault();

        const id = normalizeText(getById('serviceLaunchId')?.value);
        const customerId = normalizeText(getById('launchCustomer')?.value);
        const observation = normalizeText(getById('launchObservation')?.value);
        const createRevenue = Boolean(getById('launchCreateRevenue')?.checked);
        const revenueCategoryId = normalizeText(getById('launchRevenueCategory')?.value);
        const revenueBankId = normalizeText(getById('launchRevenueBank')?.value);
        const revenueDate = normalizeText(getById('launchRevenueDate')?.value);
        const revenuePaymentMethod = normalizeText(getById('launchRevenuePaymentMethod')?.value);
        const saveBtn = getById('saveBtn');

        const customer = findCustomer(customerId);

        if (!customerId || !customer) {
            showAlert('Selecione um cliente válido.', 'error');
            getById('launchCustomer')?.focus();
            return;
        }

        const rows = Array.from(document.querySelectorAll('.service-row'));
        if (rows.length === 0) {
            showAlert('Adicione pelo menos um item.', 'error');
            return;
        }

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const select = row.querySelector('.service-select');
            const qtyInput = row.querySelector('.service-qty');
            const priceInput = row.querySelector('.service-price');

            if (!select.value) {
                showAlert(`Selecione o item na linha ${i + 1}.`, 'error');
                select.focus();
                return;
            }

            const qty = parseNumber(qtyInput.value);
            if (!Number.isFinite(qty) || qty <= 0) {
                showAlert(`Informe uma quantidade válida na linha ${i + 1}.`, 'error');
                qtyInput.focus();
                return;
            }

            const price = parseNumber(priceInput.value);
            if (!Number.isFinite(price) || price < 0) {
                showAlert(`Informe um valor unitário válido na linha ${i + 1}.`, 'error');
                priceInput.focus();
                return;
            }
        }

        if (createRevenue && !revenueCategoryId) {
            showAlert('Selecione a categoria da receita.', 'error');
            getById('launchRevenueCategory')?.focus();
            return;
        }

        if (createRevenue && !revenueBankId) {
            showAlert('Selecione a conta de destino da receita.', 'error');
            getById('launchRevenueBank')?.focus();
            return;
        }

        if (createRevenue && !revenueDate) {
            showAlert('Informe a data da receita.', 'error');
            getById('launchRevenueDate')?.focus();
            return;
        }

        if (createRevenue && !revenuePaymentMethod) {
            showAlert('Selecione a forma de pagamento da receita.', 'error');
            getById('launchRevenuePaymentMethod')?.focus();
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';

        try {
            let launchPublicId = id;
            if (id) {
                const row = rows[0];
                const itemType = row.querySelector('.item-type-select').value;
                const itemId = row.querySelector('.service-select').value;
                const qty = parseNumber(row.querySelector('.service-qty').value);
                const price = parseNumber(row.querySelector('.service-price').value);

                const payload = {
                    customer_public_id: customerId,
                    service_public_id: itemType === 'service' ? itemId : null,
                    product_public_id: itemType === 'product' ? itemId : null,
                    quantity: qty,
                    unit_price: price,
                    observation: observation || null,
                };

                await api(`/estoque/service-launches/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                });
                showAlert('Lançamento atualizado com sucesso!', 'success');
            } else {
                const promises = rows.map(row => {
                    const itemType = row.querySelector('.item-type-select').value;
                    const itemId = row.querySelector('.service-select').value;
                    const qty = parseNumber(row.querySelector('.service-qty').value);
                    const price = parseNumber(row.querySelector('.service-price').value);

                    const payload = {
                        customer_public_id: customerId,
                        service_public_id: itemType === 'service' ? itemId : null,
                        product_public_id: itemType === 'product' ? itemId : null,
                        quantity: qty,
                        unit_price: price,
                        observation: observation || null,
                    };

                    return api('/estoque/service-launches', {
                        method: 'POST',
                        body: JSON.stringify(payload),
                    });
                });

                const responses = await Promise.all(promises);
                launchPublicId = String(responses[0]?.data?.public_id || '');
                showAlert('Lançamentos cadastrados com sucesso!', 'success');
            }

            if (createRevenue) {
                let totalAmount = 0;
                rows.forEach(row => {
                    const qty = parseNumber(row.querySelector('.service-qty').value);
                    const price = parseNumber(row.querySelector('.service-price').value);
                    totalAmount += (qty * price);
                });

                const launchRef = launchPublicId ? ` [SL:${launchPublicId}]` : '';
                
                const mainRow = rows[0];
                const mainItemType = mainRow.querySelector('.item-type-select')?.value;
                const mainItemId = mainRow.querySelector('.service-select')?.value;
                const mainItemName = mainItemType === 'product'
                    ? (findProduct(mainItemId)?.name || 'Produto')
                    : (findService(mainItemId)?.name || 'Serviço');
                
                const desc = rows.length > 1
                    ? `Lançamento de múltiplos itens (${rows.length}) - ${customerLabel(customer)}`
                    : `Lançamento de item - ${mainItemName} - ${customerLabel(customer)}${launchRef}`;

                const revenuePayload = {
                    description: desc,
                    amount: Number(totalAmount.toFixed(2)),
                    date: revenueDate,
                    category_public_id: revenueCategoryId,
                    bank_account_public_id: revenueBankId,
                    customer_public_id: customerId,
                    payment_method: revenuePaymentMethod,
                    status: 'progress',
                };

                await api('/finance/revenues', {
                    method: 'POST',
                    body: JSON.stringify(revenuePayload),
                });
                showAlert('Lançamento salvo e receita criada com sucesso!', 'success');
            }

            await loadLaunches();
            applyFilters();
            closeModal();
        } catch (error) {
            showAlert(error.message || 'Erro ao salvar lançamento.', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar';
        }
    }

    async function loadCustomersAndServices() {
        const [customersResponse, servicesResponse, productsResponse, categoriesResponse, banksResponse, receivableTypesResponse, customerGroupsResponse] = await Promise.all([
            api('/entities/customers'),
            api('/estoque/services'),
            api('/products'),
            api('/finance/categories'),
            api('/bank-accounts'),
            api('/receivable-types'),
            api('/customer-groups'),
        ]);

        customers = Array.isArray(customersResponse?.data) ? customersResponse.data : [];
        services = Array.isArray(servicesResponse?.data) ? servicesResponse.data : [];
        products = Array.isArray(productsResponse?.data) ? productsResponse.data : [];
        revenueCategories = Array.isArray(categoriesResponse?.data)
            ? categoriesResponse.data.filter((item) => String(item.type) === 'income')
            : [];
        bankAccounts = Array.isArray(banksResponse?.data) ? banksResponse.data : [];
        receivableTypes = Array.isArray(receivableTypesResponse?.data) ? receivableTypesResponse.data : [];
        customerGroups = Array.isArray(customerGroupsResponse?.data) ? customerGroupsResponse.data : [];

        populateCustomerGroups();
        populateCustomers();
        populateRevenueCategories();
        populateBankAccounts();
    }

    function bindEvents() {
        getById('btnOpenModal')?.addEventListener('click', () => openModal());
        getById('btnCancelModal')?.addEventListener('click', closeModal);
        getById('modalBackdrop')?.addEventListener('click', closeModal);
        getById('serviceLaunchForm')?.addEventListener('submit', handleSubmit);
        getById('filterSearch')?.addEventListener('input', applyFilters);
        getById('launchCreateRevenue')?.addEventListener('change', toggleRevenueFields);
        getById('launchCustomerGroup')?.addEventListener('change', () => {
            populateCustomers();
        });
        getById('launchRevenueBank')?.addEventListener('change', () => {
            updatePaymentMethodOptions();
        });

        getById('selectAllLaunches')?.addEventListener('change', (e) => {
            const checked = e.target.checked;
            document.querySelectorAll('.row-checkbox').forEach(chk => {
                chk.checked = checked;
            });
        });

        getById('btnAddServiceRow')?.addEventListener('click', () => {
            addServiceRow('', 1, 0, false);
        });

        const closePdfModal = () => {
            getById('pdfModal')?.classList.add('hidden');
            const pdfIframe = getById('pdfIframe');
            if (pdfIframe) pdfIframe.src = '';
            const transmitBtn = getById('transmitNfseBtn');
            if (transmitBtn) {
                transmitBtn.classList.add('hidden');
                delete transmitBtn.dataset.launchId;
            }
            const cancelBtn = getById('cancelNfseBtn');
            if (cancelBtn) {
                cancelBtn.classList.add('hidden');
                delete cancelBtn.dataset.launchId;
            }
        };

        getById('closePdfModalBtn')?.addEventListener('click', closePdfModal);
        getById('closePdfModalCross')?.addEventListener('click', closePdfModal);
        getById('closePdfModalBackdrop')?.addEventListener('click', closePdfModal);

        getById('printPdfBtn')?.addEventListener('click', () => {
            const pdfIframe = getById('pdfIframe');
            pdfIframe?.contentWindow?.focus();
            pdfIframe?.contentWindow?.print();
        });

        getById('transmitNfseBtn')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const launchId = btn.dataset.launchId;
            if (!launchId) return;

            if (!window.confirm('Deseja transmitir esta Nota Fiscal de Serviço para a prefeitura municipal?')) {
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Transmitindo...';

            try {
                const res = await api('/estoque/service-launches/' + launchId + '/transmit', {
                    method: 'POST'
                });

                if (res && res.status === 'success') {
                    showAlert('Nota Fiscal de Serviço transmitida com sucesso!', 'success');
                    
                    // Update launch in local lists
                    const updatedLaunch = res.data;
                    const index = launches.findIndex((item) => String(item.public_id) === String(launchId));
                    if (index !== -1) {
                        launches[index] = updatedLaunch;
                    }
                    applyFilters();

                    // Reload the NFS-e modal with the transmitted view
                    openNfse(launchId);
                } else {
                    showAlert(res.message || 'Erro ao transmitir Nota Fiscal.', 'error');
                }
            } catch (err) {
                showAlert(err.message || 'Erro de conexão ao transmitir Nota Fiscal.', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Transmitir';
            }
        });

        getById('cancelNfseBtn')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const launchId = btn.dataset.launchId;
            if (!launchId) return;

            if (!window.confirm('Tem certeza que deseja CANCELAR esta Nota Fiscal de Serviço? Esta ação não poderá ser desfeita.')) {
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Cancelando...';

            try {
                const res = await api('/estoque/service-launches/' + launchId + '/cancel', {
                    method: 'POST'
                });

                if (res && res.status === 'success') {
                    showAlert('Nota Fiscal de Serviço cancelada com sucesso!', 'success');

                    const updatedLaunch = res.data;
                    const index = launches.findIndex((item) => String(item.public_id) === String(launchId));
                    if (index !== -1) {
                        launches[index] = updatedLaunch;
                    }
                    applyFilters();

                    // Recarrega o modal com o estado cancelado
                    openNfse(launchId);
                } else {
                    showAlert(res.message || 'Erro ao cancelar Nota Fiscal.', 'error');
                }
            } catch (err) {
                showAlert(err.message || 'Erro de conexão ao cancelar Nota Fiscal.', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Cancelar NFS-e';
            }
        });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }

        bindEvents();

        try {
            const meRes = await api('/auth/me');
            if (meRes && meRes.status === 'success') {
                companyInfo = meRes.data?.company;
            }
        } catch (err) {
            console.error('Erro ao buscar dados da empresa:', err);
        }

        try {
            await Promise.all([loadCustomersAndServices(), loadLaunches()]);
            applyFilters();
        } catch (error) {
            showAlert(error.message || 'Erro ao carregar dados de lançamento de serviço.', 'error');
        }
    });
})();
