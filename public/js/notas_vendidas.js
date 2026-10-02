// @ts-nocheck
(function () {
    const button = document.getElementById('btnImportNotasXml');
    const input = document.getElementById('inputImportNotasXml');
    const fileNameLabel = document.getElementById('importNotasXmlFileName');
    const tbody = document.getElementById('notasVendidasTbody');
    const modal = document.getElementById('importNotasXmlModal');
    const modalClose = document.getElementById('btnCloseImportNotasXmlModal');
    const modalCancel = document.getElementById('btnCancelImportNotasXml');
    const modalConfirm = document.getElementById('btnConfirmImportNotasXml');
    const modalFileName = document.getElementById('importNotasXmlModalFileName');
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
    const bankSelect = document.getElementById('importNotasXmlBankAccount');
    const categorySelect = document.getElementById('importNotasXmlCategory');
    const notaItensModal = document.getElementById('notaItensModal');
    const notaItensModalTitle = document.getElementById('notaItensModalTitle');
    const notaItensModalBody = document.getElementById('notaItensModalBody');
    const btnCloseNotaItensModal = document.getElementById('btnCloseNotaItensModal');
    const btnPrintNotaItens = document.getElementById('btnPrintNotaItens');
    if (!button || !input || !tbody || !modal || !modalClose || !modalCancel || !modalConfirm || !modalFileName || !selectAllNotasCheckbox || !btnDeleteSelectedNotas || !toggleFilterBtn || !filterChevron || !filterBody || !filterSearch || !filterNfeKey || !filterStatus || !filterNfeStartDate || !filterStartDate || !filterEndDate || !filterNfeEndDate || !footerCount || !footerTotal || !bankSelect || !categorySelect || !notaItensModal || !notaItensModalTitle || !notaItensModalBody || !btnCloseNotaItensModal || !btnPrintNotaItens)
        return;
    let selectedXmlFiles = [];
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
    function renderEmptyState() {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhuma nota vendida para exibir no momento.
                </td>
            </tr>
        `;
        footerCount.textContent = '0';
        footerTotal.textContent = 'R$ 0,00';
        selectAllNotasCheckbox.checked = false;
        updateBatchDeleteButtonState();
    }
    function updateFooterMetrics(sales) {
        const list = Array.isArray(sales) ? sales : [];
        const totalAmount = list.reduce((acc, sale) => acc + Number(sale?.total_amount || 0), 0);
        footerCount.textContent = String(list.length);
        footerTotal.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount);
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
    function printCurrentSaleItems() {
        if (!currentSaleForPrint)
            return;
        const sale = currentSaleForPrint;
        const items = Array.isArray(sale.items) ? sale.items : [];
        const totalAmount = Number(sale.total_amount || 0);
        const totalAmountText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount);
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow)
            return;
        const rows = items.map((item) => {
            const qty = Number(item.quantity || 0);
            const unitPrice = Number(item.unit_price || 0);
            const total = Number(item.total_price || qty * unitPrice);
            const unitPriceText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(unitPrice);
            const totalText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);
            const xml = parseJsonSafe(item.xml_item_data) || {};
            return `<tr><td>${item.product_name || 'Produto sem nome'}</td><td>${item.sku || '-'}</td><td>${xml.cProd || '-'}</td><td>${xml.cEAN || '-'}</td><td>${xml.ncm || '-'}</td><td>${xml.cfop || '-'}</td><td>${xml.uCom || '-'}</td><td style="text-align:right;">${qty}</td><td style="text-align:right;">${unitPriceText}</td><td style="text-align:right;">${totalText}</td></tr>`;
        }).join('');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Nota #${sale.id || '-'}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
                        h1 { margin: 0 0 8px; font-size: 20px; }
                        p { margin: 0 0 16px; color: #374151; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; }
                        th { background: #f3f4f6; text-align: left; }
                        .summary { margin-top: 14px; font-weight: 700; }
                    </style>
                </head>
                <body>
                    <h1>Itens da Nota #${sale.id || '-'}</h1>
                    <p>Cliente: ${sale.customer_name || 'Consumidor Final'}</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Produto</th>
                                <th>SKU</th>
                                <th>cProd</th>
                                <th>EAN</th>
                                <th>NCM</th>
                                <th>CFOP</th>
                                <th>Un.</th>
                                <th>Qtd</th>
                                <th>Unit.</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows || '<tr><td colspan="10" style="text-align:center;">Nenhum item para exibir.</td></tr>'}
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
        notaItensModalTitle.textContent = `Itens da Nota #${saleId}`;
        const items = Array.isArray(sale?.items) ? sale.items : [];
        if (items.length === 0) {
            notaItensModalBody.innerHTML = '<tr><td colspan="10" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum item para exibir.</td></tr>';
        }
        else {
            notaItensModalBody.innerHTML = items.map((item) => {
                const qty = Number(item.quantity || 0);
                const unitPrice = Number(item.unit_price || 0);
                const total = Number(item.total_price || qty * unitPrice);
                const unitPriceText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(unitPrice);
                const totalText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);
                const xml = parseJsonSafe(item.xml_item_data) || {};
                return `
                    <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/40">
                        <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">${item.product_name || 'Produto sem nome'}</td>
                        <td class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">${item.sku || '-'}</td>
                        <td class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">${xml.cProd || '-'}</td>
                        <td class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">${xml.cEAN || '-'}</td>
                        <td class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">${xml.ncm || '-'}</td>
                        <td class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">${xml.cfop || '-'}</td>
                        <td class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">${xml.uCom || '-'}</td>
                        <td class="px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-300">${qty}</td>
                        <td class="px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-300">${unitPriceText}</td>
                        <td class="px-4 py-2 text-sm text-right font-semibold text-gray-900 dark:text-gray-100">${totalText}</td>
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
            const dateText = window.DateUtils?.formatDate(sale.date) || '-';
            const nfeIssueDateText = getSaleNfeDateText(sale);
            const nfeKeyText = sale?.nfe_key || '-';
            const nfeHeaderSummary = getSaleNfeHeaderSummary(sale);
            const total = Number(sale.total_amount || 0);
            const formattedTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);
            const normalizedStatus = String(sale.status || 'pending').toLowerCase();
            const statusText = statusLabel[normalizedStatus] || sale.status || 'Pendente';
            const badgeClass = statusClass[normalizedStatus] || statusClass.pending;
            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/40">
                    <td class="px-3 py-2.5 text-left">
                        <input type="checkbox" class="nota-checkbox rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" data-sale-id="${sale.id || ''}" title="Selecionar nota #${sale.id || ''}" aria-label="Selecionar nota #${sale.id || ''}">
                    </td>
                    <td class="px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-gray-100">#${sale.id || '-'}</td>
                    <td class="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200">${nfeIssueDateText}</td>
                    <td class="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-200">${nfeKeyText}</td>
                    <td class="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-200">${nfeHeaderSummary}</td>
                    <td class="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200">${sale.customer_name || 'Consumidor Final'}</td>
                    <td class="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200">${dateText}</td>
                    <td class="px-3 py-2.5 text-sm text-right text-gray-900 dark:text-gray-100 font-semibold">${formattedTotal}</td>
                    <td class="px-3 py-2.5 text-center">
                        <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}">${statusText}</span>
                    </td>
                    <td class="px-3 py-2.5 text-center">
                        <button type="button" class="btnShowNotaItens inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600" data-sale-id="${sale.id || ''}">Ver Itens</button>
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
    async function loadImportOptions() {
        if (importOptionsLoaded)
            return;
        const [banksResponse, categoriesResponse] = await Promise.all([
            window.api('/bank-accounts'),
            window.api('/finance/categories?type=income')
        ]);
        const banks = Array.isArray(banksResponse?.data) ? banksResponse.data : [];
        const categories = Array.isArray(categoriesResponse?.data) ? categoriesResponse.data : [];
        bankSelect.innerHTML = '<option value="">Automatico (primeira conta)</option>' + banks.map((bank) => {
            const label = bank.name || bank.bank_name || `Conta ${bank.id || ''}`;
            return `<option value="${bank.public_id}">${label}</option>`;
        }).join('');
        categorySelect.innerHTML = '<option value="">Automatico (categoria de venda)</option>' + categories.map((category) => {
            return `<option value="${category.public_id}">${category.name}</option>`;
        }).join('');
        importOptionsLoaded = true;
    }
    function openImportModal() {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    function closeImportModal() {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    function formatImportFailureDetails(reasons) {
        const uniqueReasons = Array.from(new Set(Array.isArray(reasons) ? reasons : []));
        if (uniqueReasons.length === 0) {
            return 'Falha ao importar XML.';
        }
        const hasCnpjMismatch = uniqueReasons.some((reason) => /cnpj/i.test(String(reason || '')));
        const highlighted = hasCnpjMismatch
            ? 'CNPJ da nota diferente do CNPJ da empresa. '
            : '';
        const details = uniqueReasons.slice(0, 2).join(' | ');
        const suffix = uniqueReasons.length > 2 ? ` | +${uniqueReasons.length - 2} erro(s)` : '';
        return `${highlighted}${details}${suffix}`;
    }
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    function isTooManyRequestsError(error) {
        const status = Number(error?.status || error?.statusCode || error?.response?.status || 0);
        if (status === 429) {
            return true;
        }
        const message = String(error?.message || '').toLowerCase();
        return message.includes('muitas requisi') || message.includes('too many requests');
    }
    async function importXmlWithRetry(payload, maxAttempts = 4) {
        let lastError = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await window.api('/sales/sales/import-xml', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
            }
            catch (error) {
                lastError = error;
                const shouldRetry = isTooManyRequestsError(error) && attempt < maxAttempts;
                if (!shouldRetry) {
                    throw error;
                }
                const backoffMs = 1200 * attempt;
                await wait(backoffMs);
            }
        }
        throw lastError || new Error('Falha ao importar XML.');
    }
    async function submitXmlImport() {
        if (!Array.isArray(selectedXmlFiles) || selectedXmlFiles.length === 0) {
            closeImportModal();
            return;
        }
        const originalButtonHtml = button.innerHTML;
        const originalConfirmText = modalConfirm.textContent;
        button.disabled = true;
        button.classList.add('opacity-70', 'cursor-not-allowed');
        button.innerHTML = 'Importando XML...';
        modalConfirm.disabled = true;
        modalConfirm.textContent = 'Importando...';
        try {
            let successCount = 0;
            let failedCount = 0;
            let importedItemsTotal = 0;
            let unmatchedTotal = 0;
            const failedReasons = [];
            for (const file of selectedXmlFiles) {
                try {
                    const xmlContent = await file.text();
                    const response = await importXmlWithRetry({
                        xml_content: xmlContent,
                        bank_account_public_id: bankSelect.value || null,
                        category_public_id: categorySelect.value || null,
                    });
                    successCount += 1;
                    importedItemsTotal += Number(response?.data?.imported_items || 0);
                    unmatchedTotal += Array.isArray(response?.data?.unmatched_items) ? response.data.unmatched_items.length : 0;
                }
                catch (error) {
                    failedCount += 1;
                    console.error('Erro ao importar XML da nota', error);
                    const reason = String(error?.message || 'Falha desconhecida ao importar XML.').trim();
                    failedReasons.push(`${file.name}: ${reason}`);
                }
            }
            if (failedCount === 0) {
                showPageAlert(`Importacao concluida. ${successCount} XML(s) importado(s), ${importedItemsTotal} item(ns) processado(s). Itens nao vinculados: ${unmatchedTotal}.`, 'success', 4500);
            }
            else if (successCount === 0) {
                const details = formatImportFailureDetails(failedReasons);
                showPageAlert(`Importacao nao realizada. ${details}`, 'error', 7000);
            }
            else {
                const details = formatImportFailureDetails(failedReasons);
                showPageAlert(`Importacao finalizada com ressalvas. Sucesso: ${successCount}, falhas: ${failedCount}, itens processados: ${importedItemsTotal}, nao vinculados: ${unmatchedTotal}. ${details}`, 'warning', 7000);
            }
            if (successCount > 0) {
                await loadSales();
            }
            closeImportModal();
        }
        catch (error) {
            console.error('Erro ao importar XML da nota', error);
            showPageAlert(error?.message || 'Falha ao importar XML da nota.', 'error', 3500);
        }
        finally {
            button.disabled = false;
            button.classList.remove('opacity-70', 'cursor-not-allowed');
            button.innerHTML = originalButtonHtml;
            modalConfirm.disabled = false;
            modalConfirm.textContent = originalConfirmText;
            input.value = '';
            selectedXmlFiles = [];
        }
    }
    button.addEventListener('click', () => {
        input.click();
    });
    modalClose.addEventListener('click', () => {
        closeImportModal();
    });
    modalCancel.addEventListener('click', () => {
        closeImportModal();
        selectedXmlFiles = [];
        input.value = '';
    });
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeImportModal();
        }
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
    modalConfirm.addEventListener('click', async () => {
        await submitXmlImport();
    });
    input.addEventListener('change', async () => {
        const selectedFiles = Array.from(input.files || []);
        if (selectedFiles.length === 0) {
            return;
        }
        const invalidFile = selectedFiles.find((file) => {
            const isXmlByName = /\.xml$/i.test(file.name);
            const isXmlByType = ['text/xml', 'application/xml', 'application/octet-stream'].includes(file.type || '');
            return !isXmlByName && !isXmlByType;
        });
        if (invalidFile) {
            input.value = '';
            showPageAlert(`Arquivo invalido: ${invalidFile.name}. Selecione apenas XML de nota fiscal.`, 'warning', 3500);
            return;
        }
        selectedXmlFiles = selectedFiles;
        if (selectedFiles.length === 1) {
            modalFileName.textContent = `Arquivo: ${selectedFiles[0].name}`;
        }
        else {
            const previewNames = selectedFiles.slice(0, 3).map((file) => file.name).join(', ');
            const suffix = selectedFiles.length > 3 ? ', ...' : '';
            modalFileName.textContent = `Arquivos (${selectedFiles.length}): ${previewNames}${suffix}`;
        }
        try {
            await loadImportOptions();
            openImportModal();
        }
        catch (error) {
            console.error('Erro ao carregar opcoes para importacao', error);
            selectedXmlFiles = [];
            input.value = '';
            showPageAlert('Nao foi possivel carregar conta/categoria para importacao.', 'error', 3500);
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
