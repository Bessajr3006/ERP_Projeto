(() => {
    const getById = (id) => document.getElementById(id);

    let customers = [];
    let services = [];
    let revenueCategories = [];
    let bankAccounts = [];
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

    function customerLabel(customer) {
        return customer?.trade_name || customer?.name || customer?.full_name || customer?.company_name || 'Cliente';
    }

    function populateCustomers() {
        const select = getById('launchCustomer');
        if (!select) return;

        const options = ['<option value="">Selecione...</option>']
            .concat(customers.map((item) => `<option value="${escapeHtml(item.public_id)}">${escapeHtml(customerLabel(item))}</option>`));
        select.innerHTML = options.join('');
    }

    function populateServices() {
        const select = getById('launchService');
        if (!select) return;

        const options = ['<option value="">Selecione...</option>']
            .concat(services.map((item) => `<option value="${escapeHtml(item.public_id)}">${escapeHtml(item.name)} (${escapeHtml(formatCurrency(item.price))})</option>`));
        select.innerHTML = options.join('');
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
        const quantity = parseNumber(getById('launchQuantity')?.value);
        const unitPrice = parseNumber(getById('launchUnitPrice')?.value);
        const totalInput = getById('launchTotal');

        if (!totalInput) return;

        if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
            totalInput.value = formatCurrency(0);
            return;
        }

        totalInput.value = formatCurrency(quantity * unitPrice);
    }

    function openReceipt(pubId) {
        if (!pubId) return;
        let url = '/api/v1/finance/revenues/' + pubId + '/receipt';
        const jwtToken = localStorage.getItem('erp_token');
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
        const service = findService(launch.service_public_id);
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

        const serviceName = service?.name || launch.service_name || '—';
        const serviceDescription = service?.description || launch.observation || '';
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
.wrap{width:100%;max-width:195mm;margin:0 auto;border:1.5px solid #000}

/* CABEÇALHO */
.hdr{display:flex;align-items:stretch;border-bottom:1.5px solid #000;background:#ecf3fb}
.hdr-logo{width:30mm;min-width:30mm;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:5px;border-right:1px solid #000;text-align:center}
.logo-badge{background:#1a56a0;color:#fff;font-size:10pt;font-weight:900;padding:3px 8px;border-radius:4px;letter-spacing:2px;margin-bottom:3px}
.logo-sub{font-size:5pt;color:#1a3a6a;font-weight:bold;line-height:1.3;text-transform:uppercase}
.hdr-title{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:5px 8px;text-align:center;border-right:1px solid #000}
.hdr-title .dt{font-size:11pt;font-weight:900;text-transform:uppercase;color:#1a3a6a;letter-spacing:1px}
.hdr-title .ds{font-size:6.5pt;color:#444;margin-top:1px}
.hdr-title .vb{display:inline-block;background:#1a56a0;color:#fff;font-size:5pt;font-weight:bold;padding:1px 6px;border-radius:2px;margin-top:3px}
.hdr-muni{width:38mm;min-width:38mm;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:5px;text-align:center}
.hdr-muni .ml{font-size:5pt;font-weight:bold;text-transform:uppercase;color:#555}
.hdr-muni .mn{font-size:8pt;font-weight:bold;color:#1a3a6a}
.hdr-muni .mu{font-size:6pt;color:#444}

/* CHAVE / QR */
.chave-row{display:flex;align-items:stretch;border-bottom:1px solid #000}
.chave-qr{width:28mm;min-width:28mm;display:flex;align-items:center;justify-content:center;padding:4px;border-right:1px solid #000}
.chave-qr img{width:22mm;height:22mm;display:block}
.chave-body{flex:1;padding:4px 6px;display:flex;flex-direction:column;justify-content:center}
.chave-body .fl{font-size:5.5pt;font-weight:bold;text-transform:uppercase;color:#555;margin-bottom:1px}
.chave-body .cv{font-family:'Courier New',Courier,monospace;font-size:7.5pt;font-weight:bold;letter-spacing:0.5px;color:#000;word-break:break-all;margin-bottom:3px}
.chave-body .auth{font-size:5pt;color:#555;font-style:italic;line-height:1.4}
.nfse-num{width:40mm;min-width:40mm;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px 6px;border-left:1px solid #000;text-align:center;background:#f5f8fd}
.nfse-num .nl{font-size:5.5pt;font-weight:bold;text-transform:uppercase;color:#555}
.nfse-num .nv{font-size:15pt;font-weight:900;color:#1a56a0;line-height:1;margin:1px 0}
.nfse-num .dv{font-size:6.5pt;color:#333;margin-top:2px}

/* SEÇÕES */
.sec{border-bottom:1px solid #000}
.sec:last-child{border-bottom:none}
.sec-hdr{background:#d0e4f7;padding:2px 6px;font-size:6pt;font-weight:bold;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #b0c8e8;color:#1a3a6a}
.sec-body{padding:3px 6px}
.frow{display:flex;flex-wrap:wrap}
.f{padding:2px 4px;display:flex;flex-direction:column}
.fl2{font-size:5.5pt;font-weight:bold;text-transform:uppercase;color:#666}
.fv{font-size:7pt;font-weight:bold;color:#000;overflow:hidden;text-overflow:ellipsis}
.fv.wrap{white-space:normal}
.w100{width:100%}.w75{width:75%}.w66{width:66.66%}.w50{width:50%}.w33{width:33.33%}.w25{width:25%}

/* DISCRIMINAÇÃO */
.disc{padding:4px 6px;min-height:25mm}
.disc .st{font-size:8.5pt;font-weight:bold;color:#000;margin-bottom:4px}
.disc .sd{font-size:6.5pt;color:#333;white-space:pre-wrap;line-height:1.4}
.disc .sq{margin-top:6px;display:flex;flex-wrap:wrap;gap:14px;font-size:7pt}
.disc .sq span{font-weight:bold}

/* TRIBUTOS */
.trib-tbl{width:100%;border-collapse:collapse;margin-bottom:1px}
.trib-tbl th{background:#d0e4f7;border:1px solid #aac;padding:2px 3px;font-size:5.5pt;font-weight:bold;text-transform:uppercase;text-align:center;color:#1a3a6a}
.trib-tbl td{border:1px solid #ccc;padding:2.5px 3px;font-size:7pt;font-weight:bold;text-align:center;color:#000}

/* TOTAL DESTAQUE */
.total-bar{display:flex;align-items:center;background:#d0e4f7;padding:4px 8px;border-top:1.5px solid #000;border-bottom:1px solid #000}
.total-bar .tl{flex:1;font-size:6.5pt;font-weight:bold;text-transform:uppercase;color:#1a3a6a}
.total-bar .tv{font-size:13pt;font-weight:900;color:#1a3a6a}

/* RODAPÉ */
.footer{padding:4px 6px;font-size:5.5pt;color:#555;text-align:center;line-height:1.5;background:#fafcff}
.footer strong{color:#1a3a6a}

/* RASCUNHO */
.draft-bar{background:#fff3cd;border-bottom:2px dashed #f0ad4e;color:#7d5a00;font-size:7pt;font-weight:bold;text-align:center;padding:5px 8px}
.watermark{position:fixed;top:45%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:52pt;font-weight:900;color:rgba(200,0,0,.07);pointer-events:none;z-index:9999;white-space:nowrap;letter-spacing:6px}
</style>
</head>
<body>

${!isTransmitted ? `<div class="draft-bar">⚠️ DOCUMENTO SEM VALOR FISCAL — RASCUNHO / SIMULAÇÃO — Não transmitido à prefeitura municipal</div><div class="watermark">RASCUNHO</div>` : ''}

<div class="wrap">

<!-- ═══ CABEÇALHO ═══════════════════════════════════════════════ -->
<div class="hdr">
  <div class="hdr-logo">
    <div class="logo-badge">NFS-e</div>
    <div class="logo-sub">Nota Fiscal de<br>Serviços Eletrônica<br>Padrão Nacional</div>
  </div>
  <div class="hdr-title">
    <div class="dt">DANFSe</div>
    <div class="ds">Documento Auxiliar da Nota Fiscal de Serviços Eletrônica</div>
    <div class="ds">República Federativa do Brasil — Sistema Nacional NFS-e (CGNFS-e)</div>
    <span class="vb">v2.0 — Nota Técnica 008/2026</span>
  </div>
  <div class="hdr-muni">
    <div class="ml">Município do Prestador</div>
    <div class="mn">${escapeHtml(providerCity)}</div>
    <div class="mu">Estado: ${escapeHtml(providerState)}</div>
  </div>
</div>

<!-- ═══ CHAVE DE ACESSO / QR CODE / NÚMERO ════════════════════ -->
<div class="chave-row">
  <div class="chave-qr">
    <img src="${qrCodeSrc}" alt="QR Code" onerror="this.style.opacity='.2'">
  </div>
  <div class="chave-body">
    <div class="fl">Chave de Acesso (50 dígitos)</div>
    <div class="cv">${escapeHtml(formattedKey)}</div>
    <div class="auth">A autenticidade desta NFS-e pode ser verificada pela leitura do QR Code ou pela consulta da chave de acesso em <strong>www.nfse.gov.br</strong></div>
  </div>
  <div class="nfse-num">
    <div class="nl">Número da NFS-e</div>
    <div class="nv">${escapeHtml(invoiceNumber)}</div>
    <div class="nl" style="margin-top:4px">Data / Hora de Emissão</div>
    <div class="dv">${escapeHtml(issueDate)}</div>
  </div>
</div>

<!-- ═══ PRESTADOR ═════════════════════════════════════════════ -->
<div class="sec">
  <div class="sec-hdr">Prestador de Serviços / Fornecedor</div>
  <div class="sec-body">
    <div class="frow">
      <div class="f w66"><span class="fl2">Razão Social / Nome Empresarial</span><span class="fv wrap">${escapeHtml(providerName)}</span></div>
      <div class="f w33"><span class="fl2">CNPJ / CPF</span><span class="fv">${escapeHtml(providerCnpj)}</span></div>
    </div>
    <div class="frow">
      <div class="f w25"><span class="fl2">Inscrição Municipal</span><span class="fv">${escapeHtml(providerIm)}</span></div>
      <div class="f w50"><span class="fl2">Endereço</span><span class="fv wrap">${escapeHtml(providerAddress || '—')}</span></div>
      <div class="f w25"><span class="fl2">Município / UF</span><span class="fv">${escapeHtml(providerCity)} - ${escapeHtml(providerState)}</span></div>
    </div>
    ${providerEmail || providerPhone ? `<div class="frow">
      ${providerEmail ? `<div class="f w50"><span class="fl2">E-mail</span><span class="fv">${escapeHtml(providerEmail)}</span></div>` : ''}
      ${providerPhone ? `<div class="f w50"><span class="fl2">Telefone</span><span class="fv">${escapeHtml(providerPhone)}</span></div>` : ''}
    </div>` : ''}
  </div>
</div>

<!-- ═══ TOMADOR ══════════════════════════════════════════════ -->
<div class="sec">
  <div class="sec-hdr">Tomador de Serviços / Adquirente</div>
  <div class="sec-body">
    <div class="frow">
      <div class="f w66"><span class="fl2">Razão Social / Nome</span><span class="fv wrap">${escapeHtml(customerName)}</span></div>
      <div class="f w33"><span class="fl2">CNPJ / CPF</span><span class="fv">${escapeHtml(customerCnpj)}</span></div>
    </div>
    <div class="frow">
      <div class="f w66"><span class="fl2">Endereço</span><span class="fv wrap">${escapeHtml(customerAddress)}</span></div>
      <div class="f w33"><span class="fl2">Município / UF</span><span class="fv">${escapeHtml(customerCity)} - ${escapeHtml(customerState)}</span></div>
    </div>
    ${customerEmail || customerPhone ? `<div class="frow">
      ${customerEmail ? `<div class="f w50"><span class="fl2">E-mail</span><span class="fv">${escapeHtml(customerEmail)}</span></div>` : ''}
      ${customerPhone ? `<div class="f w50"><span class="fl2">Telefone</span><span class="fv">${escapeHtml(customerPhone)}</span></div>` : ''}
    </div>` : ''}
  </div>
</div>

<!-- ═══ DISCRIMINAÇÃO DOS SERVIÇOS ═══════════════════════════ -->
<div class="sec">
  <div class="sec-hdr">Discriminação dos Serviços</div>
  <div class="disc">
    <div class="st">${escapeHtml(serviceName)}</div>
    ${serviceDescription ? `<div class="sd">${escapeHtml(serviceDescription)}</div>` : ''}
    <div class="sq">
      <div>Cód. Tributação (LC 116/2003): <span>${escapeHtml(serviceTaxCode)}</span></div>
      <div>Quantidade: <span>${qtyVal.toFixed(3)}</span></div>
      <div>Valor Unitário: <span>${formatCurrency(priceVal)}</span></div>
      <div>Valor Total Bruto: <span>${formatCurrency(totalVal)}</span></div>
    </div>
  </div>
</div>

<!-- ═══ VALORES E TRIBUTOS ════════════════════════════════════ -->
<div class="sec">
  <div class="sec-hdr">Valores e Tributos</div>
  <div class="sec-body" style="padding:4px">
    <table class="trib-tbl">
      <thead>
        <tr>
          <th>Valor Bruto do Serviço</th>
          <th>(-) Deduções / Descontos</th>
          <th>Base de Cálculo ISSQN</th>
          <th>Alíquota ISSQN</th>
          <th>Valor ISSQN</th>
          <th>ISSQN Retido?</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${formatCurrency(totalVal)}</td>
          <td>R$ 0,00</td>
          <td>${formatCurrency(totalVal)}</td>
          <td>${issRateVal.toFixed(2)}%</td>
          <td>${formatCurrency(issValueVal)}</td>
          <td>Não</td>
        </tr>
      </tbody>
    </table>
    <table class="trib-tbl" style="margin-top:3px">
      <thead>
        <tr>
          <th>PIS (0,00%)</th>
          <th>COFINS (0,00%)</th>
          <th>INSS Retido (0,00%)</th>
          <th>IR Retido (0,00%)</th>
          <th>CSLL Retido (0,00%)</th>
          <th>IBS — Reforma Trib.</th>
          <th>CBS — Reforma Trib.</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>R$ 0,00</td>
          <td>R$ 0,00</td>
          <td>R$ 0,00</td>
          <td>R$ 0,00</td>
          <td>R$ 0,00</td>
          <td>R$ 0,00</td>
          <td>R$ 0,00</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

<!-- ═══ TOTAL DESTAQUE ═══════════════════════════════════════ -->
<div class="total-bar">
  <div class="tl">Valor Líquido da NFS-e&nbsp;&nbsp;(Bruto − ISSQN Retido − Retenções Federais)</div>
  <div class="tv">${formatCurrency(liquidValue)}</div>
</div>

<!-- ═══ OUTRAS INFORMAÇÕES ══════════════════════════════════ -->
<div class="sec">
  <div class="sec-hdr">Outras Informações</div>
  <div class="sec-body">
    <div class="frow">
      <div class="f w33"><span class="fl2">Código de Verificação</span><span class="fv" style="font-family:monospace">${escapeHtml(verificationCode)}</span></div>
      <div class="f w33"><span class="fl2">Competência / Data de Emissão</span><span class="fv">${escapeHtml(issueDate)}</span></div>
      <div class="f w33"><span class="fl2">Regime Especial de Tributação</span><span class="fv">Sem regime especial</span></div>
    </div>
    <div class="frow">
      <div class="f w100"><span class="fl2">Observações / Informações Complementares</span><span class="fv wrap">${escapeHtml(launch.observation || '—')}</span></div>
    </div>
  </div>
</div>

<!-- ═══ RODAPÉ ══════════════════════════════════════════════ -->
<div class="footer">
  ${isTransmitted
    ? `<strong>NFS-e HOMOLOGADA</strong> — Transmitida e registrada com sucesso no Sistema Nacional de NFS-e (CGNFS-e). Este é o <strong>DANFSe v2.0</strong> (Documento Auxiliar da Nota Fiscal de Serviços Eletrônica), emitido conforme Nota Técnica 008/2026.<br>Autenticidade verificável em <strong>www.nfse.gov.br</strong> pela chave de acesso ou QR Code.`
    : `<strong>ATENÇÃO:</strong> Este documento é um <strong>RASCUNHO PARA VISUALIZAÇÃO PRÉVIA</strong>, sem qualquer valor fiscal. A NFS-e somente terá validade jurídica após transmissão ao sistema municipal.`
  }<br>
  Gerado por <strong>KEYSTONE ERP</strong> — Sistema de Gestão Empresarial
</div>

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
            tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum lançamento cadastrado.</td></tr>';
            return;
        }

        tbody.innerHTML = filteredLaunches.map((item) => `
            <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">${escapeHtml(item.customer_name)}</td>
                <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">${escapeHtml(item.service_name)}</td>
                <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">${escapeHtml(String(item.quantity))}</td>
                <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">${escapeHtml(formatCurrency(item.unit_price))}</td>
                <td class="px-6 py-4 text-sm font-semibold text-gray-700 dark:text-gray-300">${escapeHtml(formatCurrency(item.total_price))}</td>
                <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">${escapeHtml(formatDateTime(item.created_at))}</td>
                <td class="px-6 py-4 text-sm">
                    ${item.nfse_status === 'transmitted' 
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
                    <button type="button" title="Nota de Serviço" class="text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-400 mr-3 open-nfse-btn" data-id="${item.public_id}">
                        <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v13a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z"/></svg>
                    </button>
                    ${item.revenue_public_id ? `
                    <button type="button" title="Recibo" class="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 mr-3 open-receipt-btn" data-id="${item.revenue_public_id}">
                        <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    </button>
                    ` : ''}
                    <button type="button" title="Excluir" class="text-red-600 hover:text-red-900 dark:hover:text-red-400 delete-btn" data-id="${item.public_id}">
                        <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </td>
            </tr>
        `).join('');

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
    }

    function applyFilters() {
        const search = normalizeText(getById('filterSearch')?.value).toLowerCase();

        filteredLaunches = launches.filter((item) => {
            if (!search) return true;
            return String(item.customer_name || '').toLowerCase().includes(search)
                || String(item.service_name || '').toLowerCase().includes(search)
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
        getById('launchQuantity').value = '1';
        getById('launchCreateRevenue').checked = false;
        toggleRevenueFields();

        if (id) {
            const item = launches.find((entry) => String(entry.public_id) === String(id));
            if (!item) return;
            title.textContent = 'Editar Lançamento de Serviço';
            getById('serviceLaunchId').value = String(item.public_id);
            getById('launchCustomer').value = item.customer_public_id || '';
            getById('launchService').value = item.service_public_id || '';
            getById('launchQuantity').value = String(item.quantity || 1);
            getById('launchUnitPrice').value = Number(item.unit_price || 0).toFixed(2);
            getById('launchObservation').value = item.observation || '';

            if (item.revenue_public_id) {
                getById('launchCreateRevenue').checked = true;
                toggleRevenueFields();
                getById('launchRevenueCategory').value = item.revenue_category_public_id || '';
                getById('launchRevenueBank').value = item.revenue_bank_account_public_id || '';
                getById('launchRevenueDate').value = toDateInputValue(item.revenue_date);
                getById('launchRevenuePaymentMethod').value = item.revenue_payment_method || '';
            }
        } else {
            title.textContent = 'Novo Lançamento de Serviço';
        }

        updateCalculatedTotal();
        getById('serviceLaunchModal')?.classList.remove('hidden');
        getById('launchCustomer')?.focus();
    }

    function removeLaunch(id) {
        const item = launches.find((entry) => String(entry.public_id) === String(id));
        if (!item) return;
        if (!window.confirm(`Deseja excluir o lançamento de ${item.service_name}?`)) return;

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
        const serviceId = normalizeText(getById('launchService')?.value);
        const quantity = parseNumber(getById('launchQuantity')?.value);
        const unitPrice = parseNumber(getById('launchUnitPrice')?.value);
        const observation = normalizeText(getById('launchObservation')?.value);
        const createRevenue = Boolean(getById('launchCreateRevenue')?.checked);
        const revenueCategoryId = normalizeText(getById('launchRevenueCategory')?.value);
        const revenueBankId = normalizeText(getById('launchRevenueBank')?.value);
        const revenueDate = normalizeText(getById('launchRevenueDate')?.value);
        const revenuePaymentMethod = normalizeText(getById('launchRevenuePaymentMethod')?.value);
        const saveBtn = getById('saveBtn');

        const customer = findCustomer(customerId);
        const service = findService(serviceId);

        if (!customerId || !customer) {
            showAlert('Selecione um cliente válido.', 'error');
            getById('launchCustomer')?.focus();
            return;
        }

        if (!serviceId || !service) {
            showAlert('Selecione um serviço válido.', 'error');
            getById('launchService')?.focus();
            return;
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
            showAlert('Informe uma quantidade válida.', 'error');
            getById('launchQuantity')?.focus();
            return;
        }

        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            showAlert('Informe um valor unitário válido.', 'error');
            getById('launchUnitPrice')?.focus();
            return;
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

        const payload = {
            customer_public_id: customerId,
            service_public_id: serviceId,
            quantity,
            unit_price: unitPrice,
            observation: observation || null,
        };

        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';

        try {
            let launchPublicId = id;
            if (id) {
                await api(`/estoque/service-launches/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                });
                showAlert('Lançamento atualizado com sucesso!', 'success');
            } else {
                const createLaunchResponse = await api('/estoque/service-launches', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                launchPublicId = String(createLaunchResponse?.data?.public_id || '');
                showAlert('Lançamento cadastrado com sucesso!', 'success');
            }

            if (createRevenue) {
                const totalAmount = Number((quantity * unitPrice).toFixed(2));
                const launchRef = launchPublicId ? ` [SL:${launchPublicId}]` : '';
                const revenuePayload = {
                    description: `Lançamento de serviço - ${service?.name || 'Serviço'} - ${customerLabel(customer)}${launchRef}`,
                    amount: totalAmount,
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
        const [customersResponse, servicesResponse, categoriesResponse, banksResponse] = await Promise.all([
            api('/entities/customers'),
            api('/estoque/services'),
            api('/finance/categories'),
            api('/bank-accounts'),
        ]);

        customers = Array.isArray(customersResponse?.data) ? customersResponse.data : [];
        services = Array.isArray(servicesResponse?.data) ? servicesResponse.data : [];
        revenueCategories = Array.isArray(categoriesResponse?.data)
            ? categoriesResponse.data.filter((item) => String(item.type) === 'income')
            : [];
        bankAccounts = Array.isArray(banksResponse?.data) ? banksResponse.data : [];

        populateCustomers();
        populateServices();
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

        getById('launchService')?.addEventListener('change', () => {
            const selected = findService(getById('launchService')?.value);
            if (selected) {
                getById('launchUnitPrice').value = Number(selected.price || 0).toFixed(2);
            }
            updateCalculatedTotal();
        });

        getById('launchQuantity')?.addEventListener('input', updateCalculatedTotal);
        getById('launchUnitPrice')?.addEventListener('input', updateCalculatedTotal);

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
