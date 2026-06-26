(() => {
document.addEventListener('DOMContentLoaded', async () => {
    // --- State ---
    const state: any = {
        purchases: [],
        filteredPurchases: [],
        selectedBatchPurchaseIds: new Set(),
        
        loading: true,
        generatingId: null,
        transmittingId: null,
        cancelingId: null,
        emitting: false,
        
        danfeData: { purchaseId: null, xml: '', html: '' },
        xmlViewMode: 'danfe',
        
        emitData: { purchaseIds: [], type: '55', emittedAt: '' }
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
        filterNfeKey: document.getElementById('filterNfeKey'),
        filterStatus: document.getElementById('filterStatus'),
        filterNfeStartDate: document.getElementById('filterNfeStartDate'),
        filterStartDate: document.getElementById('filterStartDate'),
        filterEndDate: document.getElementById('filterEndDate'),
        filterNfeEndDate: document.getElementById('filterNfeEndDate'),
        btnClearFilters: document.getElementById('btnClearFilters'),
        
        btnRefresh: document.getElementById('btnRefresh'),
        
        batchToolbar: document.getElementById('batchToolbar'),
        batchSelectAll: document.getElementById('batchSelectAll'),
        batchSelectedCount: document.getElementById('batchSelectedCount'),
        btnEmitBatch: document.getElementById('btnEmitBatch'),
        
        alertMessage: document.getElementById('alertMessage'),
        
        footerCount: document.getElementById('footerCount'),
        footerTotal: document.getElementById('footerTotal'),
        
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
    const formatDateOnly = dateStr => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR');
    };
    
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
    async function loadPurchases() {
        state.loading = true;
        renderState();
        try {
            const res = await api('/purchases');
            if (res && res.status === 'success') {
                state.purchases = (res.data || []).filter(p => p.status === 'completed' || p.status === 'cancelled');
                
                // Cleanup selected
                const eligibleIds = new Set(getBatchEligiblePurchases().map(p => p.public_id));
                const newSelected = new Set();
                state.selectedBatchPurchaseIds.forEach(id => {
                    if (eligibleIds.has(id)) newSelected.add(id);
                });
                state.selectedBatchPurchaseIds = newSelected;
            } else {
                showAlert('Falha ao carregar compras.', 'error');
            }
        } catch (e: any) {
            showAlert('Erro de conexão: ' + e.message, 'error');
        } finally {
            state.loading = false;
            applyFilters();
        }
    }
    
    function getBatchEligiblePurchases() {
        return state.purchases.filter(p => p.status === 'completed' && !localStorage.getItem(`mock_purchase_nf_type_${p.public_id}`));
    }
    
    // --- Filtering ---
    function applyFilters() {
        const query = (els.filterSearch?.value || '').toLowerCase().trim();
        const nfeKeyTerm = (els.filterNfeKey?.value || '').toLowerCase().trim();
        const statusVal = els.filterStatus?.value; // '', 'pending', 'invoiced', 'cancelled'
        const nfeStartDate = els.filterNfeStartDate?.value || '';
        const startDate = els.filterStartDate?.value || '';
        const endDate = els.filterEndDate?.value || '';
        const nfeEndDate = els.filterNfeEndDate?.value || '';
        
        state.filteredPurchases = state.purchases.filter(p => {
            const matchesQuery = !query || 
                String(p.public_id).toLowerCase().includes(query) || 
                String(p.supplier_name || '').toLowerCase().includes(query);
                
            const isInvoiced = !!localStorage.getItem(`mock_purchase_nf_type_${p.public_id}`);
            const isCancelled = p.status === 'cancelled';
            const mockNfeKey = isInvoiced 
                ? `352606${p.supplier_cnpj || '12345678000199'}55001000000${p.public_id.slice(0, 5)}1000000001`
                : '';
                
            const matchesNfeKey = !nfeKeyTerm || mockNfeKey.toLowerCase().includes(nfeKeyTerm);
            
            let matchesStatus = true;
            if (statusVal === 'pending') {
                matchesStatus = !isInvoiced && !isCancelled;
            } else if (statusVal === 'invoiced') {
                matchesStatus = isInvoiced && !isCancelled;
            } else if (statusVal === 'cancelled') {
                matchesStatus = isCancelled;
            }
            
            // Date checking
            const purchaseDateStr = p.date ? p.date.split('T')[0] : '';
            const nfeDateStr = isInvoiced 
                ? (localStorage.getItem(`mock_purchase_nf_date_${p.public_id}`) || p.date).split('T')[0] 
                : '';
                
            const matchesNfeStartDate = !nfeStartDate || (nfeDateStr && nfeDateStr >= nfeStartDate);
            const matchesStartDate = !startDate || (purchaseDateStr && purchaseDateStr >= startDate);
            const matchesEndDate = !endDate || (purchaseDateStr && purchaseDateStr <= endDate);
            const matchesNfeEndDate = !nfeEndDate || (nfeDateStr && nfeDateStr <= nfeEndDate);
            
            return matchesQuery && matchesNfeKey && matchesStatus && matchesNfeStartDate && matchesStartDate && matchesEndDate && matchesNfeEndDate;
        });
        
        renderRows();
        renderBatchToolbar();
    }

    // --- Renderers ---
    function renderState() {
        if (state.loading) {
            els.loadingOverlay?.classList.remove('hidden');
            els.notesContainer.parentElement.parentElement.classList.add('hidden');
            els.emptyState?.classList.add('hidden');
        } else {
            els.loadingOverlay?.classList.add('hidden');
            els.notesContainer.parentElement.parentElement.classList.remove('hidden');
        }
    }

    function renderBatchToolbar() {
        const eligibles = getBatchEligiblePurchases();
        if (eligibles.length > 0) {
            els.batchToolbar.classList.remove('hidden');
            els.batchSelectedCount.textContent = `${state.selectedBatchPurchaseIds.size} selecionada(s)`;
            els.batchSelectAll.checked = eligibles.length === state.selectedBatchPurchaseIds.size && eligibles.length > 0;
        } else {
            els.batchToolbar.classList.add('hidden');
        }
    }

    function renderRows() {
        if (!state.loading && state.filteredPurchases.length === 0) {
            els.emptyState?.classList.remove('hidden');
            els.notesContainer.parentElement.parentElement.classList.add('hidden');
        } else {
            els.emptyState?.classList.add('hidden');
            if (!state.loading) {
                els.notesContainer.parentElement.parentElement.classList.remove('hidden');
            }
        }

        let totalAmount = 0;
        
        els.notesContainer.innerHTML = state.filteredPurchases.map(p => {
            const isInvoiced = !!localStorage.getItem(`mock_purchase_nf_type_${p.public_id}`);
            const isCancelled = p.status === 'cancelled';
            totalAmount += Number(p.total_amount || 0);
            
            const isEligible = p.status === 'completed' && !isInvoiced;
            const checkboxHtml = isEligible 
                ? `<input type="checkbox" value="${p.public_id}" class="batch-purchase-chk rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" ${state.selectedBatchPurchaseIds.has(p.public_id) ? 'checked' : ''} title="Selecionar compra #${p.public_id.slice(0, 8)}" aria-label="Selecionar compra #${p.public_id.slice(0, 8)}">` 
                : '';
                
            const purchaseNum = `#${p.public_id.slice(0, 8)}`;
            const nfeDateText = isInvoiced 
                ? formatDateOnly(localStorage.getItem(`mock_purchase_nf_date_${p.public_id}`) || p.date) 
                : '-';
                
            const nfeKeyText = isInvoiced 
                ? `352606${p.supplier_cnpj || '12345678000199'}55001000000${p.public_id.slice(0, 5)}1000000001`
                : '-';
                
            const nfeHeaderSummary = isInvoiced 
                ? `NF-e mod. 55 | Serie 1 | Entrada` 
                : '-';
                
            const supplierName = p.supplier_name || 'Fornecedor Desconhecido';
            const purchaseDateText = formatDateOnly(p.date);
            const totalVal = formatCurrency(p.total_amount);
            
            let statusBadge = '';
            if (isCancelled) {
                statusBadge = '<span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Cancelada</span>';
            } else if (isInvoiced) {
                statusBadge = '<span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Emitida</span>';
            } else {
                statusBadge = '<span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Pendente</span>';
            }
            
            const btnGenDisabled = state.generatingId === p.public_id ? 'opacity-50 cursor-wait' : '';
            const btnGenIcon = state.generatingId === p.public_id 
                ? `<svg class="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>` 
                : `Ver DANFE`;
                
            const btnCancelIcon = state.cancelingId === p.public_id
                ? `<svg class="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>`
                : `Estornar`;

            let actsHtml = '';
            if (isCancelled) {
                actsHtml = '';
            } else if (isInvoiced) {
                actsHtml = `
                    <button type="button" class="btn-generate bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${btnGenDisabled}" data-id="${p.public_id}" title="Visualizar DANFE">
                        ${btnGenIcon}
                    </button>
                    <button type="button" class="btn-cancel bg-red-600 hover:bg-red-700 text-white rounded-lg px-2 py-1 text-xs font-semibold transition-colors" data-id="${p.public_id}" title="Desfazer Emissão">
                        ${btnCancelIcon}
                    </button>
                `;
            } else {
                actsHtml = `
                    <button type="button" class="btn-emit-single bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-2 py-1 text-xs font-semibold transition-colors" data-id="${p.public_id}" title="Emitir NFe Entrada">
                        Emitir NFe
                    </button>
                `;
            }
            
            const actionsCell = `
                <div class="flex items-center justify-center gap-1.5">
                    <button type="button" class="btn-items bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg px-2 py-1 text-xs font-semibold transition-colors" data-id="${p.public_id}">Ver Itens</button>
                    ${actsHtml}
                </div>
            `;

            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/40">
                    <td class="px-3 py-2.5 text-left">${checkboxHtml}</td>
                    <td class="px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-gray-100">${purchaseNum}</td>
                    <td class="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200">${nfeDateText}</td>
                    <td class="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-200 font-mono">${nfeKeyText}</td>
                    <td class="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-200">${nfeHeaderSummary}</td>
                    <td class="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 font-semibold">${supplierName}</td>
                    <td class="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200">${purchaseDateText}</td>
                    <td class="px-3 py-2.5 text-sm text-right text-gray-900 dark:text-gray-100 font-bold">${totalVal}</td>
                    <td class="px-3 py-2.5 text-center">${statusBadge}</td>
                    <td class="px-3 py-2.5 text-center">${actionsCell}</td>
                </tr>
            `;
        }).join('');

        if (els.footerCount) els.footerCount.textContent = String(state.filteredPurchases.length);
        if (els.footerTotal) els.footerTotal.textContent = formatCurrency(totalAmount);
    }

    // --- Actions ---
    async function openItemsModal(purchaseId) {
        state.loading = true;
        renderState();
        try {
            const res = await api('/purchases/' + purchaseId);
            if (res && res.status === 'success') {
                const purchase = res.data;
                els.itemsModalTitle.textContent = `Compra #${purchase.public_id.slice(0, 8)} - ${purchase.supplier_name || 'Fornecedor'}`;
                
                if (!purchase.items || purchase.items.length === 0) {
                    els.itemsModalBody.innerHTML = `<div class="text-center py-6 text-gray-500 font-medium">Esta compra não possui itens.</div>`;
                } else {
                    els.itemsModalBody.innerHTML = `
                        <div class="bg-white dark:bg-slate-800 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700">
                            ${purchase.items.map(item => `
                            <div class="flex flex-col gap-3 p-4 border-b border-gray-100 dark:border-slate-700 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                <div class="flex justify-between items-start w-full">
                                    <div>
                                        <p class="font-bold text-[15px] mb-1 leading-tight text-gray-900 dark:text-gray-100">${item.product_name}</p>
                                        <p class="text-xs text-gray-500 font-mono">${item.sku ? 'SKU: '+item.sku : ''}</p>
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
            } else {
                showAlert('Erro ao obter detalhes da compra', 'error');
            }
        } catch (e: any) {
            showAlert('Erro de conexão: ' + e.message, 'error');
        } finally {
            state.loading = false;
            renderState();
        }
    }

    function openEmitModal(ids) {
        state.emitData.purchaseIds = ids;
        state.emitData.type = '55';
        
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        state.emitData.emittedAt = now.toISOString().slice(0, 16);
        
        els.emitType.value = '55';
        els.emitEmittedAt.value = state.emitData.emittedAt;
        
        els.emitModalTitle.textContent = ids.length > 1 ? 'Emitir Notas em Lote' : 'Emitir Nota Fiscal de Entrada';
        els.emitModalDesc.textContent = ids.length > 1 
            ? `Escolha o modelo de nota a ser emitido para as ${ids.length} compras selecionadas.` 
            : 'Escolha o modelo de nota a ser emitido para esta compra.';

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

        for (const id of state.emitData.purchaseIds) {
            try {
                localStorage.setItem(`mock_purchase_nf_type_${id}`, mode);
                if (dt) {
                    localStorage.setItem(`mock_purchase_nf_date_${id}`, dt);
                }
                successes.push(id);
            } catch(err) {
                failures.push(id);
            }
        }
        
        if (failures.length === 0) {
            showAlert(`${successes.length} nota(s) de entrada registrada(s) com sucesso!`, 'success');
            state.selectedBatchPurchaseIds.clear();
        } else if (successes.length === 0) {
            showAlert(`Falha ao emitir. Erros: ${failures.join(', ')}`, 'error');
        } else {
            showAlert(`${successes.length} sucesso e ${failures.length} falhas.`, 'warn');
            state.selectedBatchPurchaseIds.clear();
            failures.forEach(f => state.selectedBatchPurchaseIds.add(f));
        }
        
        els.emitModal.classList.add('hidden');
        els.emitModal.classList.remove('flex');
        
        state.emitting = false;
        els.confirmEmitBtn.disabled = false;
        els.confirmEmitBtn.textContent = 'Confirmar Emissão';
        
        await loadPurchases();
    }

    async function cancelNota(id) {
        if (!confirm('Deseja cancelar esta Nota Fiscal de Entrada?')) return;
        state.cancelingId = id;
        renderRows();
        try {
            localStorage.removeItem(`mock_purchase_nf_type_${id}`);
            localStorage.removeItem(`mock_purchase_nf_date_${id}`);
            showAlert(`Nota cancelada com sucesso.`, 'error');
            await loadPurchases();
        } catch(e: any) {
            showAlert(`Erro: ${e.message}`, 'error');
        } finally {
            state.cancelingId = null;
            renderRows();
        }
    }

    async function generateAndShowXml(id) {
        state.generatingId = id;
        renderRows();
        
        try {
            const nfeResult = await api('/nfe/generate', {
                method: 'POST',
                body: JSON.stringify({ purchaseId: id })
            });
            
            if (!nfeResult || !nfeResult.xml) throw new Error("XML não retornado.");
            
            const storedMode = localStorage.getItem(`mock_purchase_nf_type_${id}`) || '55';
            
            state.danfeData.purchaseId = id;
            state.danfeData.xml = nfeResult.xml;
            state.danfeData.html = parseXmlToDanfe(nfeResult.xml, storedMode);
            
            state.xmlViewMode = 'danfe';
            renderXmlModalBody();
            
            els.xmlModalTitle.innerHTML = `Visualização NFe/DANFE (Compra #${id.slice(0, 8)})`;
            els.xmlModal.classList.remove('hidden');
            els.xmlModal.classList.add('flex');
        } catch(e: any) {
            showAlert("Erro ao gerar XML: " + e.message, "error");
        } finally {
            state.generatingId = null;
            renderRows();
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

    // --- Listeners ---
    function setupListeners() {
        // Filters toggle
        els.toggleFilterBtn.addEventListener('click', () => {
            const isHidden = els.filterBody.classList.contains('hidden');
            if (isHidden) {
                els.filterBody.classList.remove('hidden');
                els.filterChevron.classList.remove('-rotate-90');
            } else {
                els.filterBody.classList.add('hidden');
                els.filterChevron.classList.add('-rotate-90');
            }
        });
        
        // Filter inputs binding
        [els.filterSearch, els.filterNfeKey, els.filterStatus, els.filterNfeStartDate, els.filterStartDate, els.filterEndDate, els.filterNfeEndDate].forEach(el => {
            if (el) {
                el.addEventListener('input', applyFilters);
                el.addEventListener('change', applyFilters);
            }
        });

        els.btnClearFilters.addEventListener('click', () => {
            [els.filterSearch, els.filterNfeKey, els.filterNfeStartDate, els.filterStartDate, els.filterEndDate, els.filterNfeEndDate].forEach(el => {
                if (el) el.value = '';
            });
            if (els.filterStatus) els.filterStatus.value = '';
            applyFilters();
        });

        els.btnRefresh.addEventListener('click', loadPurchases);

        // Batch Select All Checkbox
        els.batchSelectAll.addEventListener('change', (e: any) => {
            const eligibles = getBatchEligiblePurchases();
            const checked = e.target.checked;
            
            eligibles.forEach(p => {
                if (checked) {
                    state.selectedBatchPurchaseIds.add(p.public_id);
                } else {
                    state.selectedBatchPurchaseIds.delete(p.public_id);
                }
            });
            
            // Sync checkbox elements in tbody
            els.notesContainer.querySelectorAll('.batch-purchase-chk').forEach((chk: any) => {
                chk.checked = checked;
            });
            
            renderBatchToolbar();
        });

        els.btnEmitBatch.addEventListener('click', () => {
            openEmitModal(Array.from(state.selectedBatchPurchaseIds));
        });

        // Event Delegation for Table Rows Actions
        els.notesContainer.addEventListener('click', (e: any) => {
            const btnItems = e.target.closest('.btn-items');
            if (btnItems) openItemsModal(btnItems.dataset.id);

            const btnEmitSingle = e.target.closest('.btn-emit-single');
            if (btnEmitSingle) openEmitModal([btnEmitSingle.dataset.id]);

            const btnCancel = e.target.closest('.btn-cancel');
            if (btnCancel) cancelNota(btnCancel.dataset.id);

            const btnGen = e.target.closest('.btn-generate');
            if (btnGen) generateAndShowXml(btnGen.dataset.id);
        });
        
        els.notesContainer.addEventListener('change', (e: any) => {
            if (e.target.classList.contains('batch-purchase-chk')) {
                const id = e.target.value;
                if (e.target.checked) {
                    state.selectedBatchPurchaseIds.add(id);
                } else {
                    state.selectedBatchPurchaseIds.delete(id);
                }
                
                const eligibles = getBatchEligiblePurchases();
                els.batchSelectAll.checked = eligibles.length === state.selectedBatchPurchaseIds.size && eligibles.length > 0;
                
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

        // Emit Form Submit
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
            a.download = `nfe_compra_${state.danfeData.purchaseId.slice(0, 8)}.xml`;
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
        
        const destName = dom.querySelector('dest > xNome')?.textContent || 'MINHA EMPRESA LIMITADA';
        const rawDestCNPJ = dom.querySelector('dest > CNPJ')?.textContent || dom.querySelector('dest > CPF')?.textContent || '';
        const destLgr = dom.querySelector('dest > enderDest > xLgr')?.textContent || 'S/N';
        const destNro = dom.querySelector('dest > enderDest > nro')?.textContent || 'S/N';
        const destBairro = dom.querySelector('dest > enderDest > xBairro')?.textContent || '';
        const destMun = dom.querySelector('dest > enderDest > xMun')?.textContent || '';
        const destUF = dom.querySelector('dest > enderDest > UF')?.textContent || '';
        
        const vNF = dom.querySelector('ICMSTot > vNF')?.textContent || '0.00';
        
        let itemsHtml = '';
        
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
        });

        const formattedCNPJEmit = emitCNPJ.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
        let formattedCNPJDest = 'ISENTO / NÃO INFORMADO';
        if (rawDestCNPJ) {
            formattedCNPJDest = rawDestCNPJ.length === 11 ? rawDestCNPJ.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : rawDestCNPJ.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
        }
        
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
                    <span class="border border-black rounded px-2 mt-2 font-bold text-xs">0 - ENTRADA</span>
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
                     <span class="font-bold uppercase">${natOp || 'COMPRA PARA INDUSTRIALIZACAO/REVENDA'}</span>
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
                    <span class="block text-[8px] font-bold uppercase text-gray-600">DATA DA ENTRADA</span>
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

    // FIRE
    setupListeners();
    loadPurchases();
});
})();
