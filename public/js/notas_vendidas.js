// @ts-nocheck
(function () {
    const button = document.getElementById('btnImportNotasXml');
    const input = document.getElementById('inputImportNotasXml');
    const tbody = document.getElementById('notasVendidasTbody');
    const modal = document.getElementById('importNotasXmlModal');
    const modalClose = document.getElementById('btnCloseImportNotasXmlModal');
    const modalCancel = document.getElementById('btnCancelImportNotasXml');
    const modalConfirm = document.getElementById('btnConfirmImportNotasXml');
    const selectAllNotasCheckbox = document.getElementById('selectAllNotasCheckbox');
    const btnDeleteSelectedNotas = document.getElementById('btnDeleteSelectedNotas');
    const toggleFilterBtn = document.getElementById('toggleFilterBtn');
    const filterChevron = document.getElementById('filterChevron');
    const filterBody = document.getElementById('filterBody');
    const filterSearch = document.getElementById('notasFilterSearch');
    const filterNfeKey = document.getElementById('notasFilterNfeKey');
    const filterStatus = document.getElementById('notasFilterStatus');
    const filterNfeStartDate = document.getElementById('notasFilterNfeStartDate');
    const filterStartDate = document.getElementById('notasFilterStartDate');
    const filterEndDate = document.getElementById('notasFilterEndDate');
    const filterNfeEndDate = document.getElementById('notasFilterNfeEndDate');
    const footerCount = document.getElementById('footerCount');
    const footerTotal = document.getElementById('footerTotal');
    const footerTotalIcms = document.getElementById('footerTotalIcms');
    const footerTotalPis = document.getElementById('footerTotalPis');
    const footerTotalCofins = document.getElementById('footerTotalCofins');
    const footerTotalTrib = document.getElementById('footerTotalTrib');
    const bankSelect = document.getElementById('importNotasXmlBankAccount');
    const categorySelect = document.getElementById('importNotasXmlCategory');
    const notaItensModal = document.getElementById('notaItensModal');
    const notaItensModalTitle = document.getElementById('notaItensModalTitle');
    const notaItensModalBody = document.getElementById('notaItensModalBody');
    const btnCloseNotaItensModal = document.getElementById('btnCloseNotaItensModal');
    const btnPrintNotaItens = document.getElementById('btnPrintNotaItens');
    if (!button || !tbody || !modal || !modalClose || !modalCancel || !modalConfirm || !selectAllNotasCheckbox || !btnDeleteSelectedNotas || !toggleFilterBtn || !filterChevron || !filterBody || !filterSearch || !filterNfeKey || !filterStatus || !filterNfeStartDate || !filterStartDate || !filterEndDate || !filterNfeEndDate || !footerCount || !footerTotal || !bankSelect || !categorySelect || !notaItensModal || !notaItensModalTitle || !notaItensModalBody || !btnCloseNotaItensModal || !btnPrintNotaItens)
        return;
    let importOptionsLoaded = false;
    let currentSaleForPrint = null;
    let allSales = [];
    function showPageAlert(message, type = 'error', durationMillis = 4000) {
        if (window.UI && typeof window.UI.showAlert === 'function') {
            window.UI.showAlert('alertMessage', message, type, durationMillis);
            return;
        }
        if (typeof window.showAlert === 'function') {
            window.showAlert(message, type, durationMillis);
        }
    }
    const statusLabel = {
        pending: 'Pendente',
        progress: 'Em Andamento',
        completed: 'Concluida',
        cancelled: 'Cancelada',
        separated: 'Separada',
        invoiced: 'Faturada',
    };
    const statusClass = {
        pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
        progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
        cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        separated: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
        invoiced: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    };
    function getSaleTaxTotals(sale) {
        if (!sale)
            return { vBC: 0, vICMS: 0, vBCST: 0, vST: 0, vPIS: 0, vCOFINS: 0, vIPI: 0, vTotTrib: 0 };
        if (sale._taxTotals)
            return sale._taxTotals;
        const header = parseJsonSafe(sale.nfe_header_json) || {};
        const totalNode = header.total || {};
        let vBC = Number(totalNode.vBC ?? header.vBC ?? 0) || 0;
        let vICMS = Number(totalNode.vICMS ?? header.vICMS ?? 0) || 0;
        let vBCST = Number(totalNode.vBCST ?? header.vBCST ?? 0) || 0;
        let vST = Number(totalNode.vST ?? header.vST ?? 0) || 0;
        let vPIS = Number(totalNode.vPIS ?? header.vPIS ?? 0) || 0;
        let vCOFINS = Number(totalNode.vCOFINS ?? header.vCOFINS ?? 0) || 0;
        let vIPI = Number(totalNode.vIPI ?? header.vIPI ?? 0) || 0;
        let vTotTrib = Number(totalNode.vTotTrib ?? header.tributosTotal ?? header.vTotTrib ?? 0) || 0;
        // Se temos XML bruto, podemos validar/completar direto da tag ICMSTot
        if ((!vBC && !vICMS && !vPIS && !vCOFINS && !vIPI && !vTotTrib) && sale.nfe_xml) {
            const doc = parseXmlSafe(sale.nfe_xml);
            if (doc) {
                const icmsTot = doc.getElementsByTagName('ICMSTot')[0];
                if (icmsTot) {
                    const getVal = (tag) => Number(icmsTot.getElementsByTagName(tag)[0]?.textContent || 0) || 0;
                    vBC = getVal('vBC');
                    vICMS = getVal('vICMS');
                    vBCST = getVal('vBCST');
                    vST = getVal('vST');
                    vPIS = getVal('vPIS');
                    vCOFINS = getVal('vCOFINS');
                    vIPI = getVal('vIPI');
                    vTotTrib = getVal('vTotTrib') || Number(doc.getElementsByTagName('vTotTrib')[0]?.textContent || 0) || 0;
                }
            }
        }
        // Fallback para soma dos itens
        if ((!vICMS && !vPIS && !vCOFINS && !vIPI && !vTotTrib) && Array.isArray(sale.items)) {
            sale.items.forEach((item) => {
                const xml = parseJsonSafe(item.xml_item_data) || {};
                vICMS += Number(xml.vICMS || xml.imposto?.icms?.vICMS || 0) || 0;
                vPIS += Number(xml.vPIS || xml.imposto?.pis?.vPIS || 0) || 0;
                vCOFINS += Number(xml.vCOFINS || xml.imposto?.cofins?.vCOFINS || 0) || 0;
                vIPI += Number(xml.vIPI || xml.imposto?.ipi?.vIPI || 0) || 0;
                vTotTrib += Number(xml.vTotTrib || 0) || 0;
            });
        }
        const totals = { vBC, vICMS, vBCST, vST, vPIS, vCOFINS, vIPI, vTotTrib };
        sale._taxTotals = totals;
        return totals;
    }
    function formatTaxCell(val, colorClass = '') {
        const num = Number(val || 0);
        if (!num || num === 0) {
            return '<span class="text-gray-400 dark:text-gray-600">-</span>';
        }
        const text = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
        return `<span class="font-medium ${colorClass}">${text}</span>`;
    }
    function renderEmptyState() {
        tbody.innerHTML = `
            <tr>
                <td colspan="14" class="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhuma nota vendida para exibir no momento.
                </td>
            </tr>
        `;
        footerCount.textContent = '0';
        footerTotal.textContent = 'R$ 0,00';
        if (footerTotalIcms)
            footerTotalIcms.textContent = 'R$ 0,00';
        if (footerTotalPis)
            footerTotalPis.textContent = 'R$ 0,00';
        if (footerTotalCofins)
            footerTotalCofins.textContent = 'R$ 0,00';
        if (footerTotalTrib)
            footerTotalTrib.textContent = 'R$ 0,00';
        selectAllNotasCheckbox.checked = false;
        updateBatchDeleteButtonState();
    }
    function updateFooterMetrics(sales) {
        const list = Array.isArray(sales) ? sales : [];
        let totalAmount = 0;
        let totalIcms = 0;
        let totalPis = 0;
        let totalCofins = 0;
        let totalTrib = 0;
        list.forEach((sale) => {
            totalAmount += Number(sale?.total_amount || 0) || 0;
            const taxes = getSaleTaxTotals(sale);
            totalIcms += taxes.vICMS;
            totalPis += taxes.vPIS;
            totalCofins += taxes.vCOFINS;
            totalTrib += taxes.vTotTrib;
        });
        const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
        footerCount.textContent = String(list.length);
        footerTotal.textContent = fmt(totalAmount);
        if (footerTotalIcms)
            footerTotalIcms.textContent = fmt(totalIcms);
        if (footerTotalPis)
            footerTotalPis.textContent = fmt(totalPis);
        if (footerTotalCofins)
            footerTotalCofins.textContent = fmt(totalCofins);
        if (footerTotalTrib)
            footerTotalTrib.textContent = fmt(totalTrib);
    }
    function closeNotaItensModal() {
        notaItensModal.classList.add('hidden');
        notaItensModal.classList.remove('flex');
    }
    function getSelectedSaleIds() {
        return Array.from(tbody.querySelectorAll('.nota-checkbox:checked'))
            .map((checkbox) => Number(checkbox.getAttribute('data-sale-id')))
            .filter((id) => Number.isFinite(id));
    }
    function updateBatchDeleteButtonState() {
        const hasSelection = getSelectedSaleIds().length > 0;
        btnDeleteSelectedNotas.disabled = !hasSelection;
        if (hasSelection) {
            btnDeleteSelectedNotas.classList.remove('hidden');
            btnDeleteSelectedNotas.classList.add('inline-flex');
        }
        else {
            btnDeleteSelectedNotas.classList.add('hidden');
            btnDeleteSelectedNotas.classList.remove('inline-flex');
        }
    }
    function parseJsonSafe(value) {
        if (!value)
            return null;
        if (typeof value === 'object')
            return value;
        if (typeof value !== 'string')
            return null;
        try {
            return JSON.parse(value);
        }
        catch (_) {
            return null;
        }
    }
    function getSaleNfeDateText(sale) {
        const rawDate = sale?.nfe_issue_date || null;
        if (!rawDate)
            return '-';
        return window.DateUtils?.formatDate(rawDate) || '-';
    }
    function getSaleNfeHeaderSummary(sale) {
        const header = parseJsonSafe(sale?.nfe_header_json);
        if (!header)
            return '-';
        const numero = header.numero ? `NF ${header.numero}` : '';
        const serie = header.serie ? `Serie ${header.serie}` : '';
        const natOp = header.naturezaOperacao || '';
        const tributosValue = Number(header.tributosTotal);
        const tributos = Number.isFinite(tributosValue) && tributosValue > 0
            ? `Tributos ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tributosValue)}`
            : '';
        return [numero, serie, natOp, tributos].filter(Boolean).join(' | ') || '-';
    }
    function parseXmlSafe(xmlString) {
        if (!xmlString || typeof xmlString !== 'string' || xmlString.trim().length < 20)
            return null;
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlString, 'text/xml');
            if (doc.getElementsByTagName('parsererror').length > 0)
                return null;
            return doc;
        }
        catch (_) {
            return null;
        }
    }
    function extractXmlItemsFromDoc(doc) {
        if (!doc)
            return [];
        const detNodes = Array.from(doc.getElementsByTagName('det'));
        return detNodes.map((det, index) => {
            const getTag = (parent, tag) => {
                const node = parent?.getElementsByTagName(tag)[0];
                return node ? String(node.textContent || '').trim() : '';
            };
            const prod = det.getElementsByTagName('prod')[0];
            const imposto = det.getElementsByTagName('imposto')[0];
            const nItem = det.getAttribute('nItem') || String(index + 1);
            const cProd = getTag(prod, 'cProd');
            const cEAN = getTag(prod, 'cEAN');
            const xProd = getTag(prod, 'xProd');
            const ncm = getTag(prod, 'NCM');
            const cest = getTag(prod, 'CEST');
            const cfop = getTag(prod, 'CFOP');
            const uCom = getTag(prod, 'uCom');
            const qCom = Number(getTag(prod, 'qCom')) || 0;
            const vUnCom = Number(getTag(prod, 'vUnCom')) || 0;
            const vProd = Number(getTag(prod, 'vProd')) || (qCom * vUnCom);
            const vDesc = Number(getTag(prod, 'vDesc')) || 0;
            const infAdProd = getTag(det, 'infAdProd');
            // Impostos
            const vTotTrib = Number(getTag(imposto, 'vTotTrib')) || 0;
            const icmsGroup = imposto?.getElementsByTagName('ICMS')[0]?.firstElementChild;
            const cstIcms = getTag(icmsGroup, 'CST') || getTag(icmsGroup, 'CSOSN') || '';
            const pICMS = Number(getTag(icmsGroup, 'pICMS')) || 0;
            const vICMS = Number(getTag(icmsGroup, 'vICMS')) || 0;
            const pisGroup = imposto?.getElementsByTagName('PIS')[0]?.firstElementChild;
            const vPIS = Number(getTag(pisGroup, 'vPIS')) || 0;
            const cofinsGroup = imposto?.getElementsByTagName('COFINS')[0]?.firstElementChild;
            const vCOFINS = Number(getTag(cofinsGroup, 'vCOFINS')) || 0;
            const ipiGroup = imposto?.getElementsByTagName('IPI')[0]?.firstElementChild;
            const vIPI = Number(getTag(ipiGroup, 'vIPI')) || 0;
            return {
                nItem,
                product_name: xProd || 'Item sem nome',
                sku: cProd,
                cProd,
                cEAN: cEAN && cEAN.toUpperCase() !== 'SEM GTIN' ? cEAN : '-',
                ncm: ncm || '-',
                cest: cest || '-',
                cfop: cfop || '-',
                cstCsosn: cstIcms || '-',
                uCom: uCom || '-',
                quantity: qCom,
                unit_price: vUnCom,
                vDesc,
                total_price: vProd,
                vTotTrib,
                vICMS,
                pICMS,
                vPIS,
                vCOFINS,
                vIPI,
                infAdProd: infAdProd || null,
            };
        });
    }
    function printCurrentSaleItems() {
        if (!currentSaleForPrint)
            return;
        const sale = currentSaleForPrint;
        const header = parseJsonSafe(sale?.nfe_header_json) || {};
        const nfNum = header.numero || sale.id || '-';
        let items = [];
        if (sale.nfe_xml) {
            const doc = parseXmlSafe(sale.nfe_xml);
            if (doc) {
                items = extractXmlItemsFromDoc(doc);
            }
        }
        if (items.length === 0 && Array.isArray(sale.items)) {
            items = sale.items.map((item, idx) => {
                const xml = parseJsonSafe(item.xml_item_data) || {};
                const qty = Number(item.quantity || xml.qCom || 0);
                const unitPrice = Number(item.unit_price || xml.vUnCom || 0);
                const vProd = Number(item.total_price || xml.vProd || (qty * unitPrice));
                const vDesc = Number(xml.vDesc || 0);
                const cstCsosn = xml.csosn || xml.cst_icms || xml.icms?.csosn || xml.icms?.cst || '-';
                return {
                    nItem: xml.nItem || String(idx + 1),
                    product_name: item.product_name || xml.xProd || 'Produto sem nome',
                    sku: item.sku || xml.cProd || '-',
                    cProd: xml.cProd || item.sku || '-',
                    cEAN: xml.cEAN || item.ean || '-',
                    ncm: xml.ncm || '-',
                    cest: xml.cest || '-',
                    cfop: xml.cfop || '-',
                    cstCsosn,
                    uCom: xml.uCom || '-',
                    quantity: qty,
                    unit_price: unitPrice,
                    vDesc,
                    total_price: vProd,
                };
            });
        }
        const totalAmount = Number(sale.total_amount || 0);
        const totalAmountText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount);
        const printWindow = window.open('', '_blank', 'width=1000,height=750');
        if (!printWindow)
            return;
        const rows = items.map((item) => {
            const qty = Number(item.quantity || 0);
            const unitPrice = Number(item.unit_price || 0);
            const total = Number(item.total_price || (qty * unitPrice));
            const unitPriceText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(unitPrice);
            const totalText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);
            const vDesc = Number(item.vDesc || 0);
            const vDescText = vDesc > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vDesc) : '-';
            return `<tr>
                <td style="text-align:center;">${item.nItem}</td>
                <td>${item.product_name || 'Produto sem nome'}</td>
                <td>${item.cProd || item.sku || '-'}</td>
                <td>${item.cEAN || '-'}</td>
                <td>${item.ncm || '-'}</td>
                <td>${item.cest || '-'}</td>
                <td>${item.cfop || '-'}</td>
                <td>${item.cstCsosn || '-'}</td>
                <td style="text-align:center;">${item.uCom || '-'}</td>
                <td style="text-align:right;">${qty}</td>
                <td style="text-align:right;">${unitPriceText}</td>
                <td style="text-align:right;">${vDescText}</td>
                <td style="text-align:right; font-weight: bold;">${totalText}</td>
            </tr>`;
        }).join('');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Itens da Nota #${nfNum}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
                        h1 { margin: 0 0 4px; font-size: 18px; }
                        p { margin: 0 0 12px; color: #374151; font-size: 12px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th, td { border: 1px solid #d1d5db; padding: 6px 8px; font-size: 11px; }
                        th { background: #f3f4f6; text-align: left; }
                        .summary { margin-top: 14px; font-weight: 700; font-size: 14px; text-align: right; }
                    </style>
                </head>
                <body>
                    <h1>Itens da Nota Fiscal #${nfNum}</h1>
                    <p><strong>Cliente:</strong> ${sale.customer_name || header.destinatarioNome || 'Consumidor Final'} | <strong>Chave:</strong> ${sale.nfe_key || '-'}</p>
                    <table>
                        <thead>
                            <tr>
                                <th style="text-align:center;">#</th>
                                <th>Produto</th>
                                <th>cProd</th>
                                <th>EAN</th>
                                <th>NCM</th>
                                <th>CEST</th>
                                <th>CFOP</th>
                                <th>CST/CSOSN</th>
                                <th style="text-align:center;">Un.</th>
                                <th style="text-align:right;">Qtd</th>
                                <th style="text-align:right;">Unit.</th>
                                <th style="text-align:right;">Desc.</th>
                                <th style="text-align:right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows || '<tr><td colspan="13" style="text-align:center;">Nenhum item para exibir.</td></tr>'}
                        </tbody>
                    </table>
                    <p class="summary">Total da Nota: ${totalAmountText}</p>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }
    function openNotaItensModal(sale) {
        currentSaleForPrint = sale;
        const saleId = sale?.id || '-';
        const header = parseJsonSafe(sale?.nfe_header_json) || {};
        const nfNum = header.numero || saleId;
        const modalTitle = document.getElementById('notaItensModalTitle');
        const countBadge = document.getElementById('notaItensModalCountBadge');
        const subtitle = document.getElementById('notaItensModalSubtitle');
        const customerEl = document.getElementById('notaItensModalCustomer');
        const dateEl = document.getElementById('notaItensModalDate');
        const natOpEl = document.getElementById('notaItensModalNatOp');
        const tributosEl = document.getElementById('notaItensModalTributos');
        const totalEl = document.getElementById('notaItensModalTotal');
        const btnDownloadXml = document.getElementById('btnDownloadNotaXml');
        if (modalTitle)
            modalTitle.textContent = `Itens da Nota Fiscal #${nfNum}`;
        if (subtitle) {
            subtitle.textContent = sale.nfe_key ? `Chave NFe: ${sale.nfe_key}` : `Pedido / Venda #${saleId}`;
        }
        if (customerEl)
            customerEl.textContent = sale.customer_name || header.destinatarioNome || 'Consumidor Final';
        if (dateEl)
            dateEl.textContent = getSaleNfeDateText(sale);
        if (natOpEl)
            natOpEl.textContent = header.naturezaOperacao || header.ide?.natOp || '-';
        const totalAmount = Number(sale.total_amount || 0);
        if (totalEl) {
            totalEl.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount);
        }
        const tributosTotalVal = Number(header.tributosTotal || header.total?.vTotTrib || 0);
        if (tributosEl) {
            tributosEl.textContent = tributosTotalVal > 0
                ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tributosTotalVal)
                : 'R$ 0,00';
        }
        // Configura botão de download do XML original caso exista
        if (btnDownloadXml) {
            if (sale.nfe_xml && typeof sale.nfe_xml === 'string' && sale.nfe_xml.trim().length > 20) {
                btnDownloadXml.classList.remove('hidden');
                btnDownloadXml.onclick = () => {
                    const blob = new Blob([sale.nfe_xml], { type: 'application/xml;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${sale.nfe_key || 'nota-' + sale.id}.xml`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                };
            }
            else {
                btnDownloadXml.classList.add('hidden');
                btnDownloadXml.onclick = null;
            }
        }
        let items = [];
        // Se houver XML bruto salvo, extrai todos os itens do XML com fidelidade total
        if (sale.nfe_xml) {
            const doc = parseXmlSafe(sale.nfe_xml);
            if (doc) {
                items = extractXmlItemsFromDoc(doc);
            }
        }
        // Fallback para os itens salvos em banco
        if (items.length === 0 && Array.isArray(sale.items)) {
            items = sale.items.map((item, idx) => {
                const xml = parseJsonSafe(item.xml_item_data) || {};
                const qty = Number(item.quantity || xml.qCom || 0);
                const unitPrice = Number(item.unit_price || xml.vUnCom || 0);
                const vProd = Number(item.total_price || xml.vProd || (qty * unitPrice));
                const vDesc = Number(xml.vDesc || 0);
                const cstCsosn = xml.csosn || xml.cst_icms || xml.icms?.csosn || xml.icms?.cst || '-';
                return {
                    nItem: xml.nItem || String(idx + 1),
                    product_name: item.product_name || xml.xProd || 'Produto sem nome',
                    sku: item.sku || xml.cProd || '-',
                    cProd: xml.cProd || item.sku || '-',
                    cEAN: xml.cEAN || item.ean || '-',
                    ncm: xml.ncm || '-',
                    cest: xml.cest || '-',
                    cfop: xml.cfop || '-',
                    cstCsosn,
                    uCom: xml.uCom || '-',
                    quantity: qty,
                    unit_price: unitPrice,
                    vDesc,
                    total_price: vProd,
                    vTotTrib: Number(xml.vTotTrib || 0),
                    vICMS: Number(xml.vICMS || xml.imposto?.icms?.vICMS || 0),
                    pICMS: Number(xml.pICMS || xml.imposto?.icms?.pICMS || 0),
                    vPIS: Number(xml.vPIS || xml.imposto?.pis?.vPIS || 0),
                    vCOFINS: Number(xml.vCOFINS || xml.imposto?.cofins?.vCOFINS || 0),
                    vIPI: Number(xml.vIPI || xml.imposto?.ipi?.vIPI || 0),
                    infAdProd: xml.infAdProd || null,
                };
            });
        }
        if (countBadge) {
            countBadge.textContent = `${items.length} item(ns)`;
        }
        if (items.length === 0) {
            notaItensModalBody.innerHTML = '<tr><td colspan="14" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum item para exibir.</td></tr>';
        }
        else {
            notaItensModalBody.innerHTML = items.map((item) => {
                const qty = Number(item.quantity || 0);
                const unitPrice = Number(item.unit_price || 0);
                const total = Number(item.total_price || (qty * unitPrice));
                const unitPriceText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(unitPrice);
                const totalText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);
                const vDesc = Number(item.vDesc || 0);
                const vDescText = vDesc > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vDesc) : '-';
                // Badges de Impostos
                const taxBadges = [];
                if (item.vICMS > 0 || item.pICMS > 0) {
                    const icmsLabel = item.pICMS > 0 ? `ICMS: ${item.pICMS}% (R$ ${item.vICMS.toFixed(2)})` : `ICMS: R$ ${item.vICMS.toFixed(2)}`;
                    taxBadges.push(`<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">${icmsLabel}</span>`);
                }
                if (item.vPIS > 0) {
                    taxBadges.push(`<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">PIS: R$ ${item.vPIS.toFixed(2)}</span>`);
                }
                if (item.vCOFINS > 0) {
                    taxBadges.push(`<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">COF: R$ ${item.vCOFINS.toFixed(2)}</span>`);
                }
                if (item.vIPI > 0) {
                    taxBadges.push(`<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">IPI: R$ ${item.vIPI.toFixed(2)}</span>`);
                }
                if (item.vTotTrib > 0) {
                    taxBadges.push(`<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Trib: R$ ${item.vTotTrib.toFixed(2)}</span>`);
                }
                const taxInfoHtml = taxBadges.length > 0 ? `<div class="flex flex-wrap gap-1">${taxBadges.join('')}</div>` : '<span class="text-gray-400">-</span>';
                const infAdProdHtml = item.infAdProd
                    ? `<p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 italic">${item.infAdProd}</p>`
                    : '';
                return `
                    <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
                        <td class="px-3 py-2 text-center font-mono text-gray-500 dark:text-gray-400">${item.nItem}</td>
                        <td class="px-3 py-2 text-gray-900 dark:text-gray-100 font-medium">
                            <div>${item.product_name}</div>
                            ${infAdProdHtml}
                        </td>
                        <td class="px-3 py-2 text-gray-600 dark:text-gray-300 font-mono">${item.cProd || '-'}</td>
                        <td class="px-3 py-2 text-gray-600 dark:text-gray-300 font-mono">${item.cEAN || '-'}</td>
                        <td class="px-3 py-2 text-gray-600 dark:text-gray-300 font-mono">${item.ncm || '-'}</td>
                        <td class="px-3 py-2 text-gray-600 dark:text-gray-300 font-mono">${item.cest || '-'}</td>
                        <td class="px-3 py-2 text-gray-600 dark:text-gray-300 font-mono">${item.cfop || '-'}</td>
                        <td class="px-3 py-2">
                            <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">${item.cstCsosn || '-'}</span>
                        </td>
                        <td class="px-3 py-2 text-center text-gray-600 dark:text-gray-300 font-mono">${item.uCom || '-'}</td>
                        <td class="px-3 py-2 text-right font-medium text-gray-800 dark:text-gray-200">${qty}</td>
                        <td class="px-3 py-2 text-right text-gray-700 dark:text-gray-300">${unitPriceText}</td>
                        <td class="px-3 py-2 text-right text-gray-600 dark:text-gray-400">${vDescText}</td>
                        <td class="px-3 py-2 text-right font-bold text-gray-900 dark:text-gray-100">${totalText}</td>
                        <td class="px-3 py-2">${taxInfoHtml}</td>
                    </tr>
                `;
            }).join('');
        }
        notaItensModal.classList.remove('hidden');
        notaItensModal.classList.add('flex');
    }
    function renderRows(sales) {
        if (!Array.isArray(sales) || sales.length === 0) {
            renderEmptyState();
            return;
        }
        updateFooterMetrics(sales);
        tbody.innerHTML = sales.map((sale) => {
            const nfeIssueDateText = getSaleNfeDateText(sale);
            const nfeKeyText = sale?.nfe_key || '-';
            const total = Number(sale.total_amount || 0);
            const formattedTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);
            const normalizedStatus = String(sale.status || 'pending').toLowerCase();
            const statusText = statusLabel[normalizedStatus] || sale.status || 'Pendente';
            const badgeClass = statusClass[normalizedStatus] || statusClass.pending;
            const taxes = getSaleTaxTotals(sale);
            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/40">
                    <td class="px-3 py-2.5 text-left">
                        <input type="checkbox" class="nota-checkbox rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" data-sale-id="${sale.id || ''}" title="Selecionar nota #${sale.id || ''}" aria-label="Selecionar nota #${sale.id || ''}">
                    </td>
                    <td class="px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-gray-100">#${sale.id || '-'}</td>
                    <td class="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200">${nfeIssueDateText}</td>
                    <td class="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-200 font-mono">${nfeKeyText}</td>
                    <td class="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200">${sale.customer_name || 'Consumidor Final'}</td>
                    <td class="px-3 py-2.5 text-sm text-right text-gray-900 dark:text-gray-100 font-bold">${formattedTotal}</td>
                    <td class="px-3 py-2.5 text-sm text-right text-gray-600 dark:text-gray-300">${formatTaxCell(taxes.vBC)}</td>
                    <td class="px-3 py-2.5 text-sm text-right">${formatTaxCell(taxes.vICMS, 'text-blue-600 dark:text-blue-400')}</td>
                    <td class="px-3 py-2.5 text-sm text-right">${formatTaxCell(taxes.vPIS, 'text-indigo-600 dark:text-indigo-400')}</td>
                    <td class="px-3 py-2.5 text-sm text-right">${formatTaxCell(taxes.vCOFINS, 'text-purple-600 dark:text-purple-400')}</td>
                    <td class="px-3 py-2.5 text-sm text-right">${formatTaxCell(taxes.vIPI, 'text-amber-600 dark:text-amber-400')}</td>
                    <td class="px-3 py-2.5 text-sm text-right">${formatTaxCell(taxes.vTotTrib, 'text-emerald-600 dark:text-emerald-400')}</td>
                    <td class="px-3 py-2.5 text-center">
                        <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}">${statusText}</span>
                    </td>
                    <td class="px-3 py-2.5 text-center">
                        <button type="button" class="btnShowNotaItens inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/30 dark:hover:bg-brand-900/50 border border-brand-200 dark:border-brand-800/60 shadow-xs transition-all hover:scale-[1.03] cursor-pointer" data-sale-id="${sale.id || ''}" title="Visualizar todos os itens do XML">
                            <svg class="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span>Itens</span>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        tbody.querySelectorAll('.btnShowNotaItens').forEach((btn) => {
            btn.addEventListener('click', () => {
                const saleId = Number(btn.getAttribute('data-sale-id'));
                if (!Number.isFinite(saleId))
                    return;
                const selectedSale = sales.find((sale) => Number(sale.id) === saleId);
                if (!selectedSale)
                    return;
                openNotaItensModal(selectedSale);
            });
        });
        const rowCheckboxes = Array.from(tbody.querySelectorAll('.nota-checkbox'));
        selectAllNotasCheckbox.checked = rowCheckboxes.length > 0 && rowCheckboxes.every((checkbox) => checkbox.checked);
        updateBatchDeleteButtonState();
        rowCheckboxes.forEach((checkbox) => {
            checkbox.addEventListener('change', () => {
                const allChecked = rowCheckboxes.length > 0 && rowCheckboxes.every((item) => item.checked);
                selectAllNotasCheckbox.checked = allChecked;
                updateBatchDeleteButtonState();
            });
        });
    }
    function applySalesFilters() {
        const searchTerm = String(filterSearch.value || '').trim().toLowerCase();
        const nfeKeyTerm = String(filterNfeKey.value || '').trim().toLowerCase();
        const selectedStatus = String(filterStatus.value || '').trim().toLowerCase();
        const nfeStartDate = String(filterNfeStartDate.value || '').trim();
        const startDate = String(filterStartDate.value || '').trim();
        const endDate = String(filterEndDate.value || '').trim();
        const nfeEndDate = String(filterNfeEndDate.value || '').trim();
        const filtered = allSales.filter((sale) => {
            const saleId = String(sale?.id || '').toLowerCase();
            const customerName = String(sale?.customer_name || 'Consumidor Final').toLowerCase();
            const saleNfeKey = String(sale?.nfe_key || '').toLowerCase();
            const saleStatus = String(sale?.status || '').toLowerCase();
            const saleDate = window.DateUtils?.toDateInputValue(sale?.date) || '';
            const saleNfeDate = window.DateUtils?.toDateInputValue(sale?.nfe_issue_date) || '';
            const matchSearch = !searchTerm || saleId.includes(searchTerm) || customerName.includes(searchTerm) || saleNfeKey.includes(searchTerm);
            const matchNfeKey = !nfeKeyTerm || saleNfeKey.includes(nfeKeyTerm);
            const matchStatus = !selectedStatus || saleStatus === selectedStatus;
            const matchNfeStartDate = !nfeStartDate || (saleNfeDate && saleNfeDate >= nfeStartDate);
            const matchStartDate = !startDate || (saleDate && saleDate >= startDate);
            const matchEndDate = !endDate || (saleDate && saleDate <= endDate);
            const matchNfeEndDate = !nfeEndDate || (saleNfeDate && saleNfeDate <= nfeEndDate);
            return matchSearch && matchNfeKey && matchStatus && matchNfeStartDate && matchStartDate && matchEndDate && matchNfeEndDate;
        });
        renderRows(filtered);
    }
    async function deleteSelectedSales() {
        const selectedIds = getSelectedSaleIds();
        if (selectedIds.length === 0) {
            showPageAlert('Selecione ao menos uma nota para excluir.', 'warning', 3000);
            return;
        }
        const confirmed = window.confirm(`Deseja excluir ${selectedIds.length} nota(s) selecionada(s)?`);
        if (!confirmed)
            return;
        const originalHtml = btnDeleteSelectedNotas.innerHTML;
        btnDeleteSelectedNotas.disabled = true;
        btnDeleteSelectedNotas.innerHTML = 'Excluindo...';
        let successCount = 0;
        let failedCount = 0;
        try {
            await Promise.all(selectedIds.map(async (saleId) => {
                try {
                    await window.api(`/sales/${saleId}`, { method: 'DELETE' });
                    successCount += 1;
                }
                catch (_) {
                    failedCount += 1;
                }
            }));
            if (failedCount === 0) {
                showPageAlert(`${successCount} nota(s) excluida(s) com sucesso.`, 'success', 3500);
            }
            else {
                showPageAlert(`${successCount} nota(s) excluida(s) e ${failedCount} falha(s).`, 'warning', 4000);
            }
            await loadSales();
            selectAllNotasCheckbox.checked = false;
        }
        finally {
            btnDeleteSelectedNotas.innerHTML = originalHtml;
            updateBatchDeleteButtonState();
        }
    }
    async function loadSales() {
        try {
            const response = await window.api('/sales/sales');
            allSales = Array.isArray(response?.data) ? response.data : [];
            applySalesFilters();
        }
        catch (error) {
            console.error('Erro ao carregar notas vendidas', error);
            allSales = [];
            renderEmptyState();
        }
    }
    const companySelect = document.getElementById('importNotasXmlCompany');
    const dropzone = document.getElementById('importDropzone');
    const summaryContainer = document.getElementById('importXmlFilesSummaryContainer');
    const countBadge = document.getElementById('importXmlCountBadge');
    const archiveInfo = document.getElementById('importXmlArchiveInfo');
    const filesList = document.getElementById('importXmlFilesList');
    const btnClearFiles = document.getElementById('btnClearSelectedXmlFiles');
    const progressContainer = document.getElementById('importProgressContainer');
    const progressBar = document.getElementById('importProgressBar');
    const progressText = document.getElementById('importProgressText');
    const progressPercent = document.getElementById('importProgressPercent');
    let selectedXmlItems = [];
    let accessibleCompanies = [];
    let activeCompanyPublicId = null;
    async function loadCompaniesForImport() {
        if (!companySelect)
            return;
        try {
            let companies = [];
            try {
                const compRes = await window.api('/companies');
                if (Array.isArray(compRes?.data)) {
                    companies = compRes.data;
                }
            }
            catch (_) { }
            if (companies.length === 0) {
                try {
                    const meRes = await window.api('/users/me');
                    if (Array.isArray(meRes?.data?.companies) && meRes.data.companies.length > 0) {
                        companies = meRes.data.companies;
                    }
                }
                catch (_) { }
            }
            accessibleCompanies = companies;
            companySelect.innerHTML = '<option value="">Automático pelo CNPJ do emitente do XML</option>' + companies.map((c) => {
                const idVal = c.public_id || c.id;
                const name = c.trade_name || c.company_name || c.name || `Empresa #${c.id}`;
                const cnpj = c.cnpj ? ` - CNPJ: ${c.cnpj}` : '';
                return `<option value="${idVal}">${name}${cnpj}</option>`;
            }).join('');
            // Não pré-seleciona empresa por padrão (modo automático ativo)
            companySelect.value = '';
        }
        catch (error) {
            console.error('Erro ao carregar lista de empresas', error);
            companySelect.innerHTML = '<option value="">Automático pelo CNPJ do emitente do XML</option>';
        }
    }
    function extractNfeEmitterInfo(xmlContent) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlContent, 'text/xml');
            const emitNode = doc.getElementsByTagName('emit')[0];
            if (!emitNode)
                return { cnpj: null, name: null, nNF: null };
            const cnpj = emitNode.getElementsByTagName('CNPJ')[0]?.textContent?.trim()
                || emitNode.getElementsByTagName('CPF')[0]?.textContent?.trim()
                || null;
            const name = emitNode.getElementsByTagName('xNome')[0]?.textContent?.trim() || null;
            const nNF = doc.getElementsByTagName('nNF')[0]?.textContent?.trim() || null;
            return { cnpj, name, nNF };
        }
        catch (_) {
            return { cnpj: null, name: null, nNF: null };
        }
    }
    function findCompanyByDocument(doc) {
        if (!doc || !Array.isArray(accessibleCompanies))
            return null;
        const cleanDoc = String(doc).replace(/\D/g, '');
        if (!cleanDoc)
            return null;
        return accessibleCompanies.find((c) => {
            const cDoc = String(c.cnpj || c.cpf || '').replace(/\D/g, '');
            return cDoc === cleanDoc;
        }) || null;
    }
    async function loadImportOptions() {
        if (importOptionsLoaded)
            return;
        try {
            const [banksResponse, categoriesResponse] = await Promise.all([
                window.api('/bank-accounts').catch(() => ({ data: [] })),
                window.api('/finance/categories?type=income').catch(() => ({ data: [] }))
            ]);
            const banks = Array.isArray(banksResponse?.data) ? banksResponse.data : [];
            const categories = Array.isArray(categoriesResponse?.data) ? categoriesResponse.data : [];
            bankSelect.innerHTML = '<option value="">Automático (primeira conta)</option>' + banks.map((bank) => {
                const label = bank.name || bank.bank_name || `Conta ${bank.id || ''}`;
                return `<option value="${bank.public_id}">${label}</option>`;
            }).join('');
            categorySelect.innerHTML = '<option value="">Automático (categoria padrão)</option>' + categories.map((category) => {
                return `<option value="${category.public_id}">${category.name}</option>`;
            }).join('');
            importOptionsLoaded = true;
        }
        catch (error) {
            console.warn('Erro ao carregar opções bancárias/categoria', error);
        }
    }
    function renderSelectedXmlFilesPreview() {
        if (!summaryContainer || !countBadge || !filesList || !modalConfirm)
            return;
        if (selectedXmlItems.length === 0) {
            summaryContainer.classList.add('hidden');
            modalConfirm.disabled = true;
            modalConfirm.innerHTML = `
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Importar Notas</span>
            `;
            return;
        }
        summaryContainer.classList.remove('hidden');
        countBadge.textContent = `${selectedXmlItems.length} XML(s) pronto(s)`;
        const zipCount = selectedXmlItems.filter((item) => item.archiveName).length;
        if (archiveInfo) {
            if (zipCount > 0) {
                archiveInfo.textContent = `(${zipCount} extraído(s) de arquivo ZIP)`;
            }
            else {
                archiveInfo.textContent = '';
            }
        }
        filesList.innerHTML = selectedXmlItems.map((item, index) => {
            const kbSize = item.size ? `${(item.size / 1024).toFixed(1)} KB` : '';
            const zipBadge = item.archiveName
                ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 shrink-0">ZIP</span>`
                : `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 shrink-0">XML</span>`;
            let companyBadge = '';
            if (item.matchedCompany) {
                const cName = item.matchedCompany.trade_name || item.matchedCompany.company_name || item.matchedCompany.name;
                companyBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 shrink-0" title="Empresa identificada pelo CNPJ do emitente: ${item.emitCnpj}">🏢 ${cName}</span>`;
            }
            else if (item.emitCnpj) {
                companyBadge = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 shrink-0" title="CNPJ do emitente da nota">CNPJ: ${item.emitCnpj}</span>`;
            }
            const nfTitle = item.nNF ? `NF #${item.nNF} • ` : '';
            return `
                <div class="py-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-gray-100 dark:border-slate-700/60 last:border-0">
                    <div class="flex items-center gap-2 truncate min-w-0">
                        ${zipBadge}
                        <span class="truncate font-mono text-xs text-gray-800 dark:text-gray-200" title="${item.name}">${nfTitle}${item.name}</span>
                        <span class="text-gray-400 text-[10px] shrink-0">${kbSize}</span>
                    </div>
                    <div class="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                        ${companyBadge}
                        <button type="button" class="btn-remove-xml text-gray-400 hover:text-red-500 transition-colors p-1" data-index="${index}" title="Remover este arquivo">
                            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        filesList.querySelectorAll('.btn-remove-xml').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = Number(btn.getAttribute('data-index'));
                if (Number.isFinite(idx) && idx >= 0 && idx < selectedXmlItems.length) {
                    selectedXmlItems.splice(idx, 1);
                    renderSelectedXmlFilesPreview();
                }
            });
        });
        modalConfirm.disabled = false;
        modalConfirm.innerHTML = `
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Importar ${selectedXmlItems.length} Nota(s)</span>
        `;
    }
    async function processFiles(files) {
        const fileList = Array.from(files || []);
        if (fileList.length === 0)
            return;
        if (progressContainer) {
            progressContainer.classList.remove('hidden');
            progressText.textContent = 'Lendo e identificando empresas pelo CNPJ...';
            progressBar.style.width = '15%';
            progressPercent.textContent = '15%';
        }
        let addedCount = 0;
        for (const file of fileList) {
            const isZip = /\.zip$/i.test(file.name) || ['application/zip', 'application/x-zip-compressed', 'multipart/x-zip'].includes(file.type || '');
            const isXml = /\.xml$/i.test(file.name) || ['text/xml', 'application/xml'].includes(file.type || '');
            if (isZip) {
                try {
                    if (typeof window.JSZip === 'undefined') {
                        showPageAlert('Biblioteca JSZip não carregada. Atualize a página.', 'error', 4000);
                        continue;
                    }
                    const zip = await window.JSZip.loadAsync(file);
                    const entries = Object.values(zip.files);
                    for (const entry of entries) {
                        if (!entry.dir && entry.name.toLowerCase().endsWith('.xml') && !entry.name.includes('__MACOSX')) {
                            const xmlContent = await entry.async('string');
                            if (xmlContent && xmlContent.trim().length >= 20) {
                                const baseName = entry.name.split('/').pop() || entry.name;
                                const emitterInfo = extractNfeEmitterInfo(xmlContent);
                                const matchedCompany = findCompanyByDocument(emitterInfo.cnpj);
                                selectedXmlItems.push({
                                    name: baseName,
                                    content: xmlContent,
                                    size: xmlContent.length,
                                    archiveName: file.name,
                                    emitCnpj: emitterInfo.cnpj,
                                    emitName: emitterInfo.name,
                                    nNF: emitterInfo.nNF,
                                    matchedCompany
                                });
                                addedCount += 1;
                            }
                        }
                    }
                }
                catch (zipErr) {
                    console.error('Erro ao descompactar arquivo ZIP', zipErr);
                    showPageAlert(`Erro ao descompactar ${file.name}: ${zipErr.message}`, 'warning', 4000);
                }
            }
            else if (isXml) {
                try {
                    const xmlContent = await file.text();
                    if (xmlContent && xmlContent.trim().length >= 20) {
                        const emitterInfo = extractNfeEmitterInfo(xmlContent);
                        const matchedCompany = findCompanyByDocument(emitterInfo.cnpj);
                        selectedXmlItems.push({
                            name: file.name,
                            content: xmlContent,
                            size: file.size || xmlContent.length,
                            emitCnpj: emitterInfo.cnpj,
                            emitName: emitterInfo.name,
                            nNF: emitterInfo.nNF,
                            matchedCompany
                        });
                        addedCount += 1;
                    }
                }
                catch (readErr) {
                    console.error('Erro ao ler arquivo XML', readErr);
                }
            }
            else {
                showPageAlert(`Arquivo ignorado (formato inválido): ${file.name}. Envie apenas .xml ou .zip.`, 'warning', 3500);
            }
        }
        if (progressContainer) {
            progressContainer.classList.add('hidden');
            progressBar.style.width = '0%';
            progressPercent.textContent = '0%';
        }
        renderSelectedXmlFilesPreview();
        if (addedCount > 0) {
            showPageAlert(`${addedCount} arquivo(s) XML pronto(s) para importação.`, 'success', 3000);
        }
    }
    async function openImportModal() {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        await Promise.all([loadCompaniesForImport(), loadImportOptions()]);
        renderSelectedXmlFilesPreview();
    }
    function closeImportModal() {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        selectedXmlItems = [];
        if (input)
            input.value = '';
        if (progressContainer) {
            progressContainer.classList.add('hidden');
            progressBar.style.width = '0%';
            progressPercent.textContent = '0%';
        }
        renderSelectedXmlFilesPreview();
    }
    async function submitXmlImport() {
        if (!Array.isArray(selectedXmlItems) || selectedXmlItems.length === 0) {
            showPageAlert('Nenhum arquivo XML selecionado para importação.', 'warning', 3500);
            return;
        }
        // Empresa de destino é opcional: se não selecionada, o backend identifica pelo CNPJ do emitente do XML
        const targetCompany = companySelect && companySelect.value ? companySelect.value : null;
        const originalButtonHtml = button.innerHTML;
        const originalConfirmHtml = modalConfirm.innerHTML;
        button.disabled = true;
        button.classList.add('opacity-70', 'cursor-not-allowed');
        modalConfirm.disabled = true;
        if (progressContainer) {
            progressContainer.classList.remove('hidden');
            progressBar.style.width = '5%';
            progressPercent.textContent = '5%';
            progressText.textContent = `Iniciando importação de ${selectedXmlItems.length} nota(s)...`;
        }
        const batchSize = 10;
        const total = selectedXmlItems.length;
        let processed = 0;
        let successCount = 0;
        let failedCount = 0;
        let importedItemsTotal = 0;
        const failedReasons = [];
        try {
            for (let i = 0; i < total; i += batchSize) {
                const chunk = selectedXmlItems.slice(i, i + batchSize);
                const currentBatchLabel = `Lote ${Math.floor(i / batchSize) + 1} (${i + 1} a ${Math.min(i + chunk.length, total)} de ${total})`;
                if (progressText) {
                    progressText.textContent = `Processando e identificando empresas: ${currentBatchLabel}...`;
                }
                try {
                    const response = await window.api('/sales/sales/import-xml-batch', {
                        method: 'POST',
                        body: JSON.stringify({
                            company_public_id: targetCompany,
                            bank_account_public_id: bankSelect?.value || null,
                            category_public_id: categorySelect?.value || null,
                            files: chunk.map((item) => ({
                                file_name: item.name,
                                xml_content: item.content
                            }))
                        })
                    });
                    const data = response?.data || {};
                    successCount += Number(data.imported || 0);
                    failedCount += Number(data.failed || 0);
                    importedItemsTotal += Number(data.imported_items || 0);
                    if (Array.isArray(data.errors) && data.errors.length > 0) {
                        for (const err of data.errors) {
                            failedReasons.push(`${err.file_name}: ${err.error}`);
                        }
                    }
                }
                catch (batchError) {
                    console.warn(`Erro no lote ${currentBatchLabel}, tentando envio individual...`, batchError);
                    // Fallback para envio individual caso o batch falhe
                    for (const item of chunk) {
                        try {
                            const singleRes = await window.api('/sales/sales/import-xml', {
                                method: 'POST',
                                body: JSON.stringify({
                                    company_public_id: targetCompany,
                                    xml_content: item.content,
                                    file_name: item.name,
                                    bank_account_public_id: bankSelect?.value || null,
                                    category_public_id: categorySelect?.value || null
                                })
                            });
                            successCount += 1;
                            importedItemsTotal += Number(singleRes?.data?.imported_items || 0);
                        }
                        catch (singleErr) {
                            failedCount += 1;
                            failedReasons.push(`${item.name}: ${singleErr.message || 'Falha ao importar XML'}`);
                        }
                    }
                }
                processed += chunk.length;
                const pct = Math.min(100, Math.round((processed / total) * 100));
                if (progressBar)
                    progressBar.style.width = `${pct}%`;
                if (progressPercent)
                    progressPercent.textContent = `${pct}%`;
            }
            if (failedCount === 0) {
                showPageAlert(`Importação concluída com sucesso! ${successCount} XML(s) importado(s), ${importedItemsTotal} item(ns) vinculados. Arquivos arquivados na pasta Impkey.`, 'success', 5500);
            }
            else if (successCount === 0) {
                const details = failedReasons.slice(0, 3).join(' | ');
                showPageAlert(`Importação não realizada. ${details}`, 'error', 7000);
            }
            else {
                const details = failedReasons.slice(0, 2).join(' | ');
                showPageAlert(`Importação parcial: ${successCount} nota(s) importada(s) e salvas em Impkey, ${failedCount} falha(s). ${details}`, 'warning', 7000);
            }
            if (successCount > 0) {
                await loadSales();
            }
            closeImportModal();
        }
        catch (error) {
            console.error('Erro geral ao importar notas XML', error);
            showPageAlert(error?.message || 'Falha ao processar importação.', 'error', 4000);
        }
        finally {
            button.disabled = false;
            button.classList.remove('opacity-70', 'cursor-not-allowed');
            button.innerHTML = originalButtonHtml;
            modalConfirm.disabled = false;
            modalConfirm.innerHTML = originalConfirmHtml;
        }
    }
    // Eventos do Botão Principal e Modal
    button.addEventListener('click', () => {
        openImportModal();
    });
    modalClose.addEventListener('click', () => {
        closeImportModal();
    });
    modalCancel.addEventListener('click', () => {
        closeImportModal();
    });
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeImportModal();
        }
    });
    if (btnClearFiles) {
        btnClearFiles.addEventListener('click', () => {
            selectedXmlItems = [];
            if (input)
                input.value = '';
            renderSelectedXmlFilesPreview();
        });
    }
    // Dropzone e Seleção de Arquivos
    if (dropzone && input) {
        dropzone.addEventListener('click', () => {
            input.click();
        });
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('border-brand-500', 'bg-brand-50/30', 'dark:bg-brand-900/20');
        });
        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropzone.classList.remove('border-brand-500', 'bg-brand-50/30', 'dark:bg-brand-900/20');
        });
        dropzone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropzone.classList.remove('border-brand-500', 'bg-brand-50/30', 'dark:bg-brand-900/20');
            if (e.dataTransfer?.files?.length) {
                await processFiles(e.dataTransfer.files);
            }
        });
        input.addEventListener('change', async () => {
            if (input.files?.length) {
                await processFiles(input.files);
            }
        });
    }
    modalConfirm.addEventListener('click', async () => {
        await submitXmlImport();
    });
    btnCloseNotaItensModal.addEventListener('click', () => {
        closeNotaItensModal();
    });
    btnPrintNotaItens.addEventListener('click', () => {
        printCurrentSaleItems();
    });
    notaItensModal.addEventListener('click', (event) => {
        if (event.target === notaItensModal) {
            closeNotaItensModal();
        }
    });
    filterSearch.addEventListener('input', applySalesFilters);
    filterNfeKey.addEventListener('input', applySalesFilters);
    filterStatus.addEventListener('change', applySalesFilters);
    filterNfeStartDate.addEventListener('change', applySalesFilters);
    filterStartDate.addEventListener('change', applySalesFilters);
    filterEndDate.addEventListener('change', applySalesFilters);
    filterNfeEndDate.addEventListener('change', applySalesFilters);
    selectAllNotasCheckbox.addEventListener('change', () => {
        const shouldCheck = selectAllNotasCheckbox.checked;
        tbody.querySelectorAll('.nota-checkbox').forEach((checkbox) => {
            checkbox.checked = shouldCheck;
        });
        updateBatchDeleteButtonState();
    });
    btnDeleteSelectedNotas.addEventListener('click', async () => {
        await deleteSelectedSales();
    });
    toggleFilterBtn.addEventListener('click', () => {
        const isHidden = filterBody.classList.contains('hidden');
        if (isHidden) {
            filterBody.classList.remove('hidden');
            filterChevron.classList.remove('-rotate-90');
        }
        else {
            filterBody.classList.add('hidden');
            filterChevron.classList.add('-rotate-90');
        }
    });
    loadSales();
})();
