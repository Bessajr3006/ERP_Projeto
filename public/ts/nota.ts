(() => {
document.addEventListener('DOMContentLoaded', async () => {
    // --- State ---
    const state: any = {
        sales: [],
        filteredSales: [],
        viewMode: localStorage.getItem('nota_view') || 'grid',
        selectedBatchSaleIds: new Set(),
        
        loading: true,
        generatingId: null,
        transmittingId: null,
        cancelingId: null,
        emitting: false,
        
        danfeData: { saleId: null, xml: '', html: '' },
        xmlViewMode: 'danfe',
        
        emitData: { saleIds: [], type: '55', emittedAt: '' }
    };

    // --- DOM Elements ---
    const els: any = {
        notesContainer: document.getElementById('notesContainer'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        emptyState: document.getElementById('emptyState'),
        
        filterBody: document.getElementById('filterBody'),
        toggleFilterBtn: document.getElementById('toggleFilterBtn'),
        filterChevron: document.getElementById('filterChevron'),
        filterSearch: document.getElementById('filterSearch'),
        filterStatus: document.getElementById('filterStatus'),
        btnClearFilters: document.getElementById('btnClearFilters'),
        
        btnRefresh: document.getElementById('btnRefresh'),
        viewModeBtns: document.querySelectorAll('#viewModeToggles .view-btn'),
        
        batchToolbar: document.getElementById('batchToolbar'),
        batchSelectAll: document.getElementById('batchSelectAll'),
        batchSelectedCount: document.getElementById('batchSelectedCount'),
        btnEmitBatch: document.getElementById('btnEmitBatch'),
        
        alertMessage: document.getElementById('alertMessage'),
        
        // Modals
        itemsModal: document.getElementById('itemsModal'),
        itemsModalTitle: document.getElementById('itemsModalTitle'),
        itemsModalBody: document.getElementById('itemsModalBody'),
        closeItemsModalBtns: document.querySelectorAll('.close-items-modal'),
        
        emitModal: document.getElementById('emitModal'),
        emitModalTitle: document.getElementById('emitModalTitle'),
        emitModalDesc: document.getElementById('emitModalDesc'),
        emitForm: document.getElementById('emitForm'),
        emitType: document.getElementById('emitType'),
        emitEmittedAt: document.getElementById('emitEmittedAt'),
        closeEmitModalBtns: document.querySelectorAll('.close-emit-modal'),
        confirmEmitBtn: document.getElementById('confirmEmitBtn'),
        
        xmlModal: document.getElementById('xmlModal'),
        xmlModalTitle: document.getElementById('xmlModalTitle'),
        xmlModalBody: document.getElementById('xmlModalBody'),
        closeXmlModalBtns: document.querySelectorAll('.close-xml-modal'),
        btnToggleXmlDanfe: document.getElementById('btnToggleXmlDanfe'),
        btnDownloadXml: document.getElementById('btnDownloadXml'),
    };

    // --- Helpers ---
    const formatCurrency = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const formatDate = dateStr => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'});
    };
    const getModeLabel = id => (localStorage.getItem(`mock_nf_type_${id}`) || '55') === '65' ? 'NFC-e' : 'NFe';
    
    function showAlert(message, type = 'success', timeout = 5000) {
        els.alertMessage.textContent = message;
        els.alertMessage.className = `mx-4 sm:mx-0 mb-4 p-4 rounded-xl text-sm border font-medium ${
            type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
            type === 'warn' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
            type === 'info' ? 'bg-blue-50 text-blue-700 border-blue-200' :
            'bg-green-50 text-green-700 border-green-200'
        }`;
        els.alertMessage.classList.remove('hidden');
        setTimeout(() => els.alertMessage.classList.add('hidden'), timeout);
    }
    
    // --- Data Loaders ---
    async function loadSales() {
        state.loading = true;
        renderState();
        try {
            const res = await api('/sales/sales');
            if (res && res.status === 'success') {
                state.sales = (res.data || []).filter(s => s.status === 'separated' || s.status === 'invoiced');
                
                // Cleanup selected
                const eligibleIds = new Set(getBatchEligibleSales().map(s => s.id.toString()));
                const newSelected = new Set();
                state.selectedBatchSaleIds.forEach(id => { if (eligibleIds.has(id.toString())) newSelected.add(id); });
                state.selectedBatchSaleIds = newSelected;
            }
        } catch (e) {
            showAlert('Erro ao carregar notas.', 'error');
        } finally {
            state.loading = false;
            applyFilters();
        }
    }
    
    // --- Filtering ---
    function applyFilters() {
        let res = state.sales;
        const qSearch = els.filterSearch.value.toLowerCase().trim();
        const qStatus = els.filterStatus.value;
        
        if (qStatus === 'pending') res = res.filter(s => s.status !== 'invoiced');
        if (qStatus === 'invoiced') res = res.filter(s => s.status === 'invoiced');
        
        if (qSearch) {
            res = res.filter(s => 
                String(s.id).includes(qSearch) || 
                (s.customer_name || 'Consumidor Final').toLowerCase().includes(qSearch)
            );
        }
        
        state.filteredSales = res;
        renderViewToggles();
        renderBatchToolbar();
        renderGrid();
    }
    
    function getBatchEligibleSales() {
        return state.sales.filter(s => s.status !== 'invoiced');
    }

    // --- Renderers ---
    function renderState() {
        if (state.loading) {
            els.loadingOverlay.classList.remove('hidden');
            els.notesContainer.innerHTML = '';
            els.emptyState.classList.add('hidden');
            els.batchToolbar.classList.add('hidden');
        } else {
            els.loadingOverlay.classList.add('hidden');
        }
    }

    function renderViewToggles() {
        els.notesContainer.className = state.viewMode === 'list' 
            ? 'flex-1 min-h-0 overflow-y-auto p-1 pb-10 content-start grid gap-4 grid-cols-1' 
            : 'flex-1 min-h-0 overflow-y-auto p-1 pb-10 content-start grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
            
        els.viewModeBtns.forEach(btn => {
            const isSelected = btn.dataset.view === state.viewMode;
            btn.className = `view-btn flex items-center justify-center px-3 py-1.5 rounded-lg transition-all gap-1 ${
                isSelected ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-200'
            }`;
            const checkIcon = btn.querySelector('.check-icon');
            if (checkIcon) {
                if (isSelected) checkIcon.classList.remove('hidden');
                else checkIcon.classList.add('hidden');
            }
        });
    }

    function renderBatchToolbar() {
        if (state.selectedBatchSaleIds.size > 0) {
            els.batchToolbar.classList.remove('hidden');
            els.batchToolbar.classList.add('flex');
            els.batchSelectedCount.textContent = `${state.selectedBatchSaleIds.size} selecionado(s)`;
            
            const eligibles = getBatchEligibleSales();
            
            els.batchSelectAll.checked = eligibles.length > 0 && Array.from(state.selectedBatchSaleIds).length === eligibles.length;
            els.batchSelectAll.indeterminate = state.selectedBatchSaleIds.size > 0 && state.selectedBatchSaleIds.size < eligibles.length;
        } else {
            els.batchToolbar.classList.add('hidden');
            els.batchToolbar.classList.remove('flex');
            els.batchSelectAll.checked = false;
            els.batchSelectAll.indeterminate = false;
        }
    }

    function renderGrid() {
        if (!state.loading && state.filteredSales.length === 0) {
            els.emptyState.classList.remove('hidden');
        } else {
            els.emptyState.classList.add('hidden');
        }

        els.notesContainer.innerHTML = state.filteredSales.map(s => {
            const isInvoiced = s.status === 'invoiced';
            const borderTopColor = isInvoiced ? 'border-t-green-500' : 'border-t-blue-500';
            const statusBadge = isInvoiced 
                ? '<span class="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-medium bg-green-50 text-green-700 border border-green-200">Emitida</span>'
                : `<label class="inline-flex items-center gap-2 text-xs font-medium text-gray-500 cursor-pointer">
                       <input type="checkbox" value="${s.id}" class="batch-sale-chk rounded text-brand-600 shadow-sm" ${state.selectedBatchSaleIds.has(s.id.toString()) ? 'checked' : ''}> Lote
                   </label>`;
            
            const reqBadgeColor = isInvoiced ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
            const datesHtml = isInvoiced 
                ? `<div class="flex flex-col items-end gap-1">
                       <span class="text-[11px] text-gray-500 flex items-center gap-1" title="Data do Pedido"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg> ${formatDate(s.created_at || s.date)}</span>
                       <span class="text-[11px] font-medium text-green-600 flex items-center gap-1" title="Emissão da Nota"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> ${s.nfe_emitted_at ? formatDate(s.nfe_emitted_at) : formatDate(s.created_at || s.date)}</span>
                   </div>`
                : `<span class="text-xs text-gray-400 font-mono">${formatDate(s.created_at || s.date)}</span>`;

            const modeLabel = isInvoiced ? getModeLabel(s.id) : '';
            const statusTextHtml = isInvoiced
                ? `<div class="flex flex-col items-start gap-2 mb-4">
                       <div class="flex items-center text-sm font-medium text-green-600 gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> <span>${modeLabel} Autorizada</span></div>
                       <div class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">OBS: TRANSMITIDA</div>
                   </div>`
                : `<div class="flex items-center text-sm text-gray-500 mb-4 gap-2">
                       <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>Aguardando emissão
                   </div>`;

            const btnGenDisabled = state.generatingId === s.id ? 'opacity-50 cursor-wait' : '';
            const btnGenIcon = state.generatingId === s.id 
                ? `<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>` 
                : `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 6H7a2 2 0 00-2 2v11m0 5l4-4m-4 4l-4-4m4 4V13"></path></svg>`;
                
            const btnTxIcon = state.transmittingId === s.id
                ? `<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>`
                : `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>`;

            const btnCancelIcon = state.cancelingId === s.id
                ? `<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>`
                : `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;

            const actsHtml = isInvoiced
                ? `<button type="button" class="btn-generate bg-brand-50 text-brand-600 border border-brand-200 p-2 rounded-lg text-sm font-bold shadow-sm flex items-center justify-center hover:bg-brand-100 transition-colors ${btnGenDisabled}" data-id="${s.id}" title="Visualizar ${modeLabel}">
                        ${btnGenIcon}
                   </button>
                   <div class="flex w-full sm:w-auto gap-2">
                       <button type="button" class="btn-transmit flex-1 sm:flex-none bg-blue-50 text-blue-600 border border-blue-200 px-3 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center justify-center hover:bg-blue-100 transition-colors" data-id="${s.id}" title="Transmitir para SEFAZ">
                           ${btnTxIcon}
                       </button>
                       <button type="button" class="btn-cancel flex-1 sm:flex-none bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center justify-center hover:bg-red-100 transition-colors" data-id="${s.id}" title="Cancelar NF">
                           ${btnCancelIcon}
                       </button>
                   </div>`
                : `<button type="button" class="btn-emit-single flex items-center justify-center p-2 bg-brand-600 text-white hover:bg-brand-700 rounded-lg transition-colors shadow-sm" data-id="${s.id}" title="Emitir NFe">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                   </button>`;  

            return `
            <div class="bg-white dark:bg-slate-800 border-t-4 ${borderTopColor} border-gray-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                <div>
                    <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div class="flex flex-wrap items-center gap-3 min-w-0">
                            ${statusBadge}
                            <span class="${reqBadgeColor} inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold">Pedido #${s.id}</span>
                        </div>
                        ${datesHtml}
                    </div>
                    <h3 class="font-bold text-gray-900 dark:text-gray-100 text-lg mb-1 leading-tight line-clamp-2">${s.customer_name || 'Consumidor Final'}</h3>
                    ${statusTextHtml}
                </div>
                
                <div class="mt-2 flex flex-col gap-3 border-t border-gray-100 dark:border-slate-700 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <span class="font-black text-gray-900 dark:text-gray-100 text-lg">${formatCurrency(s.total_amount)}</span>
                    <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
                        <button type="button" class="btn-items flex items-center justify-center p-2 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors shadow-sm text-gray-700 dark:text-gray-300" data-id="${s.id}" title="Ver produtos">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                        </button>
                        ${actsHtml}
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    // --- Actions ---
    function openItemsModal(saleId) {
        const sale = state.filteredSales.find(s => s.id.toString() === saleId.toString());
        if (!sale) return;
        
        els.itemsModalTitle.textContent = `Pedido #${sale.id} - ${sale.customer_name || 'Consumidor Final'}`;
        
        if (!sale.items || sale.items.length === 0) {
            els.itemsModalBody.innerHTML = `<div class="text-center py-6 text-gray-500 font-medium">Este pedido não possui itens.</div>`;
        } else {
            els.itemsModalBody.innerHTML = `
                <div class="bg-white dark:bg-slate-800 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700">
                    ${sale.items.map(item => `
                    <div class="flex flex-col gap-3 p-4 border-b border-gray-100 dark:border-slate-700 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                        <div class="flex justify-between items-start w-full">
                            <div>
                                <p class="font-bold text-[15px] mb-1 leading-tight text-gray-900 dark:text-gray-100">${item.product_name}</p>
                                <p class="text-xs text-gray-500 font-mono">${item.ean ? 'EAN: '+item.ean : ''} ${item.sku ? 'SKU: '+item.sku : ''}</p>
                            </div>
                        </div>
                        <div class="flex items-center justify-between text-sm bg-gray-50 dark:bg-slate-900 p-2.5 rounded-lg border border-gray-200 dark:border-slate-700">
                            <div class="flex flex-col"><span class="text-[10px] text-gray-400 font-bold tracking-wider">UNITÁRIO</span><span class="font-bold font-mono text-gray-700 dark:text-gray-300">${formatCurrency(item.unit_price)}</span></div>
                            <div class="flex flex-col items-center"><span class="text-[10px] text-gray-400 font-bold tracking-wider">QTD</span><span class="font-black text-blue-600 dark:text-blue-400 text-base">${item.quantity}</span></div>
                            <div class="flex flex-col items-end"><span class="text-[10px] text-gray-400 font-bold tracking-wider">TOTAL</span><span class="font-bold text-green-600 dark:text-green-400 font-mono text-base">${formatCurrency(item.unit_price * item.quantity)}</span></div>
                        </div>
                    </div>`).join('')}
                </div>`;
        }
        els.itemsModal.classList.remove('hidden');
        els.itemsModal.classList.add('flex');
    }

    function openEmitModal(ids) {
        state.emitData.saleIds = ids;
        state.emitData.type = '55';
        
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        state.emitData.emittedAt = now.toISOString().slice(0, 16);
        
        els.emitType.value = '55';
        els.emitEmittedAt.value = state.emitData.emittedAt;
        
        els.emitModalTitle.textContent = ids.length > 1 ? 'Emitir Notas em Lote' : 'Emitir Nota Fiscal';
        els.emitModalDesc.textContent = ids.length > 1 
            ? `Escolha o modelo de nota a ser emitido para os ${ids.length} pedidos selecionados.` 
            : 'Escolha o modelo de nota a ser emitido para este pedido.';

        els.emitModal.classList.remove('hidden');
        els.emitModal.classList.add('flex');
    }

    async function confirmEmit(e) {
        e.preventDefault();
        
        state.emitting = true;
        els.confirmEmitBtn.disabled = true;
        els.confirmEmitBtn.textContent = 'Emitindo...';
        
        const successes: string[] = [];
        const failures: string[] = [];
        const mode = els.emitType.value;
        const dt = els.emitEmittedAt.value ? els.emitEmittedAt.value + ':00' : null;

        for (const id of state.emitData.saleIds) {
            try {
                await api('/sales/' + id + '/status', {
                    method: 'PATCH',
                    body: JSON.stringify({ status: 'invoiced', nfType: mode, nfe_emitted_at: dt })
                });
                localStorage.setItem(`mock_nf_type_${id}`, mode);
                successes.push(id);
            } catch(err) {
                failures.push(id);
            }
        }
        
        if (failures.length === 0) {
            showAlert(`${successes.length} nota(s) emitida(s) com sucesso!`, 'success');
            state.selectedBatchSaleIds.clear();
        } else if (successes.length === 0) {
            showAlert(`Falha ao emitir. Erros: ${failures.join(', ')}`, 'error');
        } else {
            showAlert(`${successes.length} sucesso e ${failures.length} falhas.`, 'warn');
            // Keep failed selected
            state.selectedBatchSaleIds.clear();
            failures.forEach(f => state.selectedBatchSaleIds.add(f.toString()));
        }
        
        els.emitModal.classList.add('hidden');
        els.emitModal.classList.remove('flex');
        
        state.emitting = false;
        els.confirmEmitBtn.disabled = false;
        els.confirmEmitBtn.textContent = 'Confirmar Emissão';
        
        await loadSales();
    }

    async function cancelNota(id) {
        if (!confirm('Deseja cancelar esta Nota Fiscal? O processo não pode ser revertido.')) return;
        state.cancelingId = id;
        renderGrid();
        try {
            await api('/sales/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ status: 'separated' }) });
            showAlert(`Nota #${id} cancelada com sucesso.`, 'error');
            await loadSales();
        } catch(e) {
            showAlert(`Erro: ${e.message}`, 'error');
        } finally {
            state.cancelingId = null;
            renderGrid();
        }
    }

    async function transmitToSefaz(id) {
        if (!confirm('Deseja transmitir os dados da NFe para SEFAZ Estadual?')) return;
        state.transmittingId = id;
        renderGrid();
        try {
            await new Promise(r => setTimeout(r, 1500)); // Mocking
            showAlert(`NFe (${id}) autorizada na SEFAZ (Ambiente de Teste / Homologação).`, 'info');
        } catch(e) {
            showAlert(`Erro transmitindo nota.`, 'error');
        } finally {
            state.transmittingId = null;
            renderGrid();
        }
    }

    async function generateAndShowXml(id) {
        state.generatingId = id;
        renderGrid();
        try {
            const storedMode = localStorage.getItem(`mock_nf_type_${id}`) || '55';
            const res = await api('/nfe/generate', {
                method: 'POST',
                body: JSON.stringify({ mockTest: true, orderId: id, nfType: storedMode })
            });
            
            const nfeResult = res?.data || res;
            if (!nfeResult || !nfeResult.xml) throw new Error("XML não retornado.");
            
            state.danfeData.saleId = id;
            state.danfeData.xml = nfeResult.xml;
            state.danfeData.html = parseXmlToDanfe(nfeResult.xml, storedMode);
            
            state.xmlViewMode = 'danfe';
            renderXmlModalBody();
            
            els.xmlModalTitle.innerHTML = `Visualização NFe/DANFE (Pedido #${id})`;
            els.xmlModal.classList.remove('hidden');
            els.xmlModal.classList.add('flex');
        } catch(e) {
            const detail = e?.message || '';
            const msg = detail
                ? `Erro ao gerar NFe: ${detail}`
                : 'Erro na compilação. Certifique-se de que os dados Fiscais da empresa estão preenchidos.';
            showAlert(msg, 'error', 12000);
        } finally {
            state.generatingId = null;
            renderGrid();
        }
    }

    function renderXmlModalBody() {
        if (state.xmlViewMode === 'xml') {
            els.xmlModalBody.innerHTML = `<div class="xml-container text-xs sm:text-sm text-green-400 bg-gray-900 overflow-auto flex-1 p-4 w-full h-full">${state.danfeData.xml.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
            els.btnToggleXmlDanfe.innerHTML = `<svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> Ver DANFE Impressa`;
        } else {
            els.xmlModalBody.innerHTML = `<div class="w-full min-w-0 min-h-0 flex justify-start sm:justify-center py-3 sm:py-6 px-2 sm:px-4">${state.danfeData.html}</div>`;
            els.btnToggleXmlDanfe.innerHTML = `<svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg> Ver XML Raw`;
        }
    }

    // --- Listeners Setup ---
    function setupListeners() {
        // Init Check
        if (typeof Auth !== 'undefined' && !Auth.isAuthenticated()) {
            window.location.href = '/'; return;
        }

        // View Toggles
        els.viewModeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                state.viewMode = btn.dataset.view;
                localStorage.setItem('nota_view', state.viewMode);
                renderViewToggles();
            });
        });

        // Filters
        els.toggleFilterBtn.addEventListener('click', () => {
            els.filterBody.classList.toggle('collapsed');
            if (els.filterBody.classList.contains('collapsed')) {
                els.filterChevron.classList.remove('rotate-0');
                els.filterChevron.classList.add('-rotate-90');
            } else {
                els.filterChevron.classList.add('rotate-0');
                els.filterChevron.classList.remove('-rotate-90');
            }
        });
        
        [els.filterSearch, els.filterStatus].forEach(el => {
            el.addEventListener('input', applyFilters);
            el.addEventListener('change', applyFilters);
        });

        els.btnClearFilters.addEventListener('click', () => {
            els.filterSearch.value = '';
            els.filterStatus.value = '';
            applyFilters();
        });

        els.btnRefresh.addEventListener('click', loadSales);

        // Batch Action
        els.batchSelectAll.addEventListener('change', (e) => {
            if (e.target.checked) {
                const eligibles = getBatchEligibleSales();
                eligibles.forEach(s => state.selectedBatchSaleIds.add(s.id.toString()));
            } else {
                state.selectedBatchSaleIds.clear();
            }
            applyFilters();
        });

        els.btnEmitBatch.addEventListener('click', () => {
            openEmitModal(Array.from(state.selectedBatchSaleIds));
        });

        // Event Delegation for Grid Items
        els.notesContainer.addEventListener('click', (e) => {
            const btnItems = e.target.closest('.btn-items');
            if (btnItems) openItemsModal(btnItems.dataset.id);

            const btnEmitSingle = e.target.closest('.btn-emit-single');
            if (btnEmitSingle) openEmitModal([btnEmitSingle.dataset.id]);

            const btnCancel = e.target.closest('.btn-cancel');
            if (btnCancel) cancelNota(btnCancel.dataset.id);

            const btnTx = e.target.closest('.btn-transmit');
            if (btnTx) transmitToSefaz(btnTx.dataset.id);

            const btnGen = e.target.closest('.btn-generate');
            if (btnGen) generateAndShowXml(btnGen.dataset.id);
        });
        
        els.notesContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('batch-sale-chk')) {
                const id = e.target.value;
                if (e.target.checked) state.selectedBatchSaleIds.add(id);
                else state.selectedBatchSaleIds.delete(id);
                renderBatchToolbar();
            }
        });

        // Modals Closing
        els.closeItemsModalBtns.forEach(btn => btn.addEventListener('click', () => {
            els.itemsModal.classList.add('hidden');
            els.itemsModal.classList.remove('flex');
        }));
        els.closeEmitModalBtns.forEach(btn => btn.addEventListener('click', () => {
            els.emitModal.classList.add('hidden');
            els.emitModal.classList.remove('flex');
        }));
        els.closeXmlModalBtns.forEach(btn => btn.addEventListener('click', () => {
            els.xmlModal.classList.add('hidden');
            els.xmlModal.classList.remove('flex');
        }));

        // Emit Form
        els.emitForm.addEventListener('submit', confirmEmit);

        // XML Toggle & Download
        els.btnToggleXmlDanfe.addEventListener('click', () => {
            state.xmlViewMode = state.xmlViewMode === 'xml' ? 'danfe' : 'xml';
            renderXmlModalBody();
        });

        els.btnDownloadXml.addEventListener('click', () => {
            const blob = new Blob([state.danfeData.xml], { type: 'application/xml' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `nfe_${state.danfeData.saleId}.xml`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        });
    }
    
    // --- Parse XML -> HTML ---
    function parseXmlToDanfe(xmlStr, mode) {
        const parser = new DOMParser();
        const dom = parser.parseFromString(xmlStr, "application/xml");
        
        const nfeId = dom.querySelector('infNFe')?.getAttribute('Id')?.replace('NFe', '') || '';
        const dhEmi = dom.querySelector('dhEmi')?.textContent || '';
        const natOp = dom.querySelector('natOp')?.textContent || '';
        
        const emitName = dom.querySelector('emit > xNome')?.textContent || '';
        const emitCNPJ = dom.querySelector('emit > CNPJ')?.textContent || '';
        const emitLgr = dom.querySelector('emit > enderEmit > xLgr')?.textContent || '';
        const emitNro = dom.querySelector('emit > enderEmit > nro')?.textContent || '';
        const emitBairro = dom.querySelector('emit > enderEmit > xBairro')?.textContent || '';
        const emitMun = dom.querySelector('emit > enderEmit > xMun')?.textContent || '';
        const emitUF = dom.querySelector('emit > enderEmit > UF')?.textContent || '';
        
        const destName = dom.querySelector('dest > xNome')?.textContent || 'CONSUMIDOR FINAL';
        const rawDestCNPJ = dom.querySelector('dest > CNPJ')?.textContent || dom.querySelector('dest > CPF')?.textContent || '';
        const destLgr = dom.querySelector('dest > enderDest > xLgr')?.textContent || 'S/N';
        const destNro = dom.querySelector('dest > enderDest > nro')?.textContent || 'S/N';
        const destBairro = dom.querySelector('dest > enderDest > xBairro')?.textContent || '';
        const destMun = dom.querySelector('dest > enderDest > xMun')?.textContent || '';
        const destUF = dom.querySelector('dest > enderDest > UF')?.textContent || '';
        
        const vNF = dom.querySelector('ICMSTot > vNF')?.textContent || '0.00';
        
        let itemsHtml = '';
        let itemsNFCeHtml = '';
        
        dom.querySelectorAll('det').forEach(det => {
            const cProd = det.querySelector('prod > cProd')?.textContent || '';
            const xProd = det.querySelector('prod > xProd')?.textContent || '';
            const ncm = det.querySelector('prod > NCM')?.textContent || '';
            const cfop = det.querySelector('prod > CFOP')?.textContent || '';
            const un = det.querySelector('prod > uCom')?.textContent || '';
            const qCom = det.querySelector('prod > qCom')?.textContent || '0';
            const vUn = det.querySelector('prod > vUnCom')?.textContent || '0';
            const vProd = det.querySelector('prod > vProd')?.textContent || '0';
            const vIcms = det.querySelector('ICMS * vICMS')?.textContent || '0.00';
            const vIpi = det.querySelector('IPI * vIPI')?.textContent || '0.00';
            
            itemsHtml += `
            <tr class="text-[10px] border-b border-gray-200 text-gray-800">
                <td class="px-2 py-1">${cProd}</td>
                <td class="px-2 py-1">${xProd}</td>
                <td class="px-2 py-1">${ncm}</td>
                <td class="px-2 py-1">${cfop}</td>
                <td class="px-2 py-1">${un}</td>
                <td class="px-2 py-1 text-right">${parseFloat(qCom).toFixed(2)}</td>
                <td class="px-2 py-1 text-right">${parseFloat(vUn).toFixed(2)}</td>
                <td class="px-2 py-1 text-right">${parseFloat(vProd).toFixed(2)}</td>
                <td class="px-2 py-1 text-right">${vIcms}</td>
                <td class="px-2 py-1 text-right">${vIpi}</td>
            </tr>`;

            itemsNFCeHtml += `
            <tr class="border-b border-gray-200 border-dashed pb-1">
                <td class="py-1 wrap-break-word leading-tight pr-1">${cProd}</td>
                <td class="py-1 wrap-break-word leading-tight uppercase px-1">${xProd}</td>
                <td class="py-1 text-center align-middle">${parseFloat(qCom).toFixed(2)}</td>
                <td class="py-1 text-center align-middle">${un}</td>
                <td class="py-1 text-right font-medium align-middle">${parseFloat(vProd).toFixed(2)}</td>
            </tr>`;
        });

        const formattedCNPJEmit = emitCNPJ.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
        let formattedCNPJDest = 'ISENTO / NÃO INFORMADO';
        if (rawDestCNPJ) {
            formattedCNPJDest = rawDestCNPJ.length === 11 ? rawDestCNPJ.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : rawDestCNPJ.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
        }
        
        if (mode === '65') {
            return `
            <div class="bg-white text-gray-900 mx-auto w-full max-w-[80mm] min-h-25 p-2 shadow-xl border border-gray-300" style="font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.2;">
                <!-- CABEÇALHO -->
                <div class="text-center font-bold uppercase mb-1 leading-tight">
                    ${emitName}<br>
                    CNPJ: ${formattedCNPJEmit}<br>
                    ${emitLgr}, ${emitNro} - ${emitBairro}<br>
                    ${emitMun} - ${emitUF}
                </div>
                
                <div class="text-center font-bold text-[11px] mt-4 mb-2 border-t border-b border-dashed border-gray-500 py-1">
                    Documento Auxiliar da Nota Fiscal<br>de Consumidor Eletrônica
                </div>
                
                <!-- ITENS -->
                <table class="w-full text-left mt-2" style="font-size: 10px;">
                    <thead>
                        <tr class="border-b border-dashed border-gray-500">
                            <th class="py-1 w-8 pr-1">CÓD</th>
                            <th class="py-1 px-1">DESCRIÇÃO</th>
                            <th class="py-1 text-center w-8">QTD</th>
                            <th class="py-1 text-center w-8">UN</th>
                            <th class="py-1 text-right w-14">VL TOT</th>
                        </tr>
                    </thead>
                    <tbody class="align-top">${itemsNFCeHtml}</tbody>
                </table>
                
                <!-- TOTAIS -->
                <div class="mt-2 border-t border-dashed border-gray-500 pt-2 text-[12px]">
                    <div class="flex justify-between font-bold text-[13px] mb-1">
                        <span>VALOR TOTAL R$</span><span>${parseFloat(vNF).toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between mt-1 text-[10px] text-gray-700">
                        <span>FORMA DE PAGAMENTO</span><span>VALOR PAGO</span>
                    </div>
                    <div class="flex justify-between text-[11px] font-medium">
                        <span>Sistema (Padrão)</span><span>${parseFloat(vNF).toFixed(2)}</span>
                    </div>
                </div>
                
                <!-- INFOS NFC-e -->
                <div class="text-center mt-4 border-t border-dashed border-gray-500 pt-3 text-[10px]">
                    <p class="mb-1"><strong>Emissão:</strong> ${dhEmi.replace('T', ' ')}</p>
                    <p class="mt-3">Consulte pela Chave de Acesso em</p>
                    <p class="mb-1" style="font-size: 9px;">http://nfce.fazenda.${(destUF || 'SP').toLowerCase()}.gov.br/consulta</p>
                    <p class="font-bold tracking-tighter mt-1" style="font-size: 10px;">${nfeId.replace(/(.{4})/g, '$1 ')}</p>
                </div>
                
                <!-- CONSUMIDOR -->
                <div class="text-center mt-3 border-t border-dashed border-gray-500 pt-2 text-[10px] break-all">
                    <p><strong>CONSUMIDOR:</strong> ${destName}</p>
                    <p>${formattedCNPJDest === 'ISENTO / NÃO INFORMADO' ? 'CPF/CNPJ NÃO INFORMADO' : 'CPF/CNPJ: ' + formattedCNPJDest}</p>
                </div>
                
                <!-- QR CODE (placeholder) -->
                <div class="flex justify-center mt-4 mb-2">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('nfeId='+nfeId)}" class="w-32 h-32 grayscale mix-blend-multiply">
                </div>
            </div>`;
        } else {
            return `
            <div class="bg-white border border-gray-400 shadow-xl text-gray-900 mx-auto w-full max-w-[210mm] min-h-[297mm]" style="font-family: Arial, sans-serif;">
                <!-- Top Header -->
                <div class="flex flex-col border-b border-black sm:flex-row">
                    <div class="w-full p-2 px-3 border-b border-black sm:w-1/2 sm:border-b-0 sm:border-r flex flex-col justify-center">
                        <h2 class="font-bold text-sm uppercase tracking-tight">${emitName}</h2>
                        <p class="text-[10px] mt-1 uppercase">${emitLgr}, ${emitNro} - ${emitBairro}</p>
                        <p class="text-[10px] uppercase">${emitMun} - ${emitUF}</p>
                        <p class="text-[10px] font-bold mt-1">CNPJ: ${formattedCNPJEmit}</p>
                    </div>
                    <div class="w-full border-b border-black text-center p-2 flex flex-col justify-center items-center sm:w-1/4 sm:border-b-0 sm:border-r">
                        <h1 class="font-bold text-xl uppercase">DANFE</h1>
                        <p class="text-[9px] uppercase leading-tight mt-1 text-gray-700">Documento Auxiliar da<br>Nota Fiscal Eletrônica</p>
                        <span class="border border-black rounded px-2 mt-2 font-bold text-xs">1 - SAÍDA</span>
                    </div>
                    <div class="w-full p-2 flex flex-col items-center justify-center bg-gray-50 sm:w-1/4">
                        <p class="text-[9px] font-bold text-gray-600 mb-1">CHAVE DE ACESSO</p>
                        <p class="text-[11px] font-mono font-bold tracking-tighter text-center wrap-break-word max-w-37.5 leading-tight">${nfeId.replace(/(.{4})/g, '$1 ')}</p>
                    </div>
                </div>

                <!-- Protocol -->
                <div class="flex flex-col border-b border-black text-[10px] sm:flex-row">
                     <div class="w-full border-b border-black p-1 px-2 sm:w-1/2 sm:border-b-0 sm:border-r">
                         <span class="block text-[8px] uppercase text-gray-600">NATUREZA DA OPERAÇÃO</span> 
                         <span class="font-bold uppercase">${natOp}</span>
                     </div>
                     <div class="w-full p-1 px-2 sm:w-1/2">
                         <span class="block text-[8px] uppercase text-gray-600">PROTOCOLO DE AUTORIZAÇÃO DE USO</span> 
                         <span class="font-bold">135230912345678 - ${dhEmi.replace('T', ' ')}</span>
                     </div>
                </div>
                
                <div class="p-1 px-2 pb-0"><h3 class="font-bold text-[10px] uppercase mt-1">DESTINATÁRIO / REMETENTE</h3></div>
                <div class="border border-black m-2 mt-0 flex flex-wrap text-[10px]">
                    <div class="w-full md:w-[60%] p-1 px-2 border-b md:border-b-0 md:border-r border-black">
                        <span class="block text-[8px] font-bold uppercase text-gray-600">NOME / RAZÃO SOCIAL</span>
                        <span class="uppercase font-bold">${destName}</span>
                    </div>
                    <div class="w-1/2 md:w-[25%] p-1 px-2 border-b md:border-b-0 md:border-r border-black">
                        <span class="block text-[8px] font-bold uppercase text-gray-600">CNPJ / CPF</span>
                        <span>${formattedCNPJDest}</span>
                    </div>
                    <div class="w-1/2 md:w-[15%] p-1 px-2 border-b md:border-b-0 border-black">
                        <span class="block text-[8px] font-bold uppercase text-gray-600">DATA DA EMISSÃO</span>
                        <span>${dhEmi.split('T')[0]}</span>
                    </div>
                    <div class="w-full md:w-[60%] p-1 px-2 border-t border-black md:border-r">
                        <span class="block text-[8px] font-bold uppercase text-gray-600">ENDEREÇO</span>
                        <span class="uppercase">${destLgr}, ${destNro} - ${destBairro}</span>
                    </div>
                    <div class="w-1/2 md:w-[25%] p-1 px-2 border-t border-black md:border-r">
                        <span class="block text-[8px] font-bold uppercase text-gray-600">MUNICÍPIO / UF</span>
                        <span class="uppercase">${destMun} - ${destUF}</span>
                    </div>
                    <div class="w-1/2 md:w-[15%] p-1 px-2 border-t border-black bg-gray-100 flex flex-col items-center">
                        <span class="block text-[8px] font-bold uppercase text-gray-600">VALOR TOTAL</span>
                        <span class="font-bold text-sm">R$ ${parseFloat(vNF).toFixed(2)}</span>
                    </div>
                </div>
                
                <!-- Itens -->
                <div class="p-1 px-2 pb-0"><h3 class="font-bold text-[10px] uppercase mt-1">DADOS DOS PRODUTOS / SERVIÇOS</h3></div>
                <div class="border border-black m-2 mt-0 overflow-x-auto">
                    <table class="w-full text-left border-collapse min-w-150">
                        <thead class="bg-gray-50">
                            <tr class="border-b border-black text-[8px] uppercase">
                                <th class="p-1 px-2 border-r border-black font-bold text-gray-600">CÓDIGO</th>
                                <th class="p-1 px-2 border-r border-black font-bold text-gray-600">DESCRIÇÃO</th>
                                <th class="p-1 px-2 border-r border-black font-bold text-gray-600">NCM/SH</th>
                                <th class="p-1 px-2 border-r border-black font-bold text-gray-600">CFOP</th>
                                <th class="p-1 px-2 border-r border-black font-bold text-gray-600">UNID</th>
                                <th class="p-1 px-2 border-r border-black font-bold text-gray-600 text-right">QTD</th>
                                <th class="p-1 px-2 border-r border-black font-bold text-gray-600 text-right">V. UNIT</th>
                                <th class="p-1 px-2 border-r border-black font-bold text-gray-600 text-right">V. TOTAL</th>
                                <th class="p-1 px-2 border-r border-black font-bold text-gray-600 text-right">V. ICMS</th>
                                <th class="p-1 px-2 font-bold text-gray-600 text-right">V. IPI</th>
                            </tr>
                        </thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                </div>
            </div>`;
        }
    }

    // FIRE
    setupListeners();
    loadSales();
});
})();
