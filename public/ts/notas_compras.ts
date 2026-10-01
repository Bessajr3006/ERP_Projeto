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
        
        emitData: { purchaseIds: [], type: '55', emittedAt: '' },
        selectedXmlFiles: [],
        importOptionsLoaded: false
    };

    // --- DOM Elements ---
    const els: any = {
        notesContainer: document.getElementById('notesContainer'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        emptyState: document.getElementById('emptyState'),
        
        btnPrevMonth: document.getElementById('btnPrevMonth'),
        filterMonthNav: document.getElementById('filterMonthNav'),
        btnNextMonth: document.getElementById('btnNextMonth'),
        btnCurrentMonth: document.getElementById('btnCurrentMonth'),
        btnAllMonths: document.getElementById('btnAllMonths'),
        
        filterBody: document.getElementById('filterBody'),
        toggleFilterBtn: document.getElementById('toggleFilterBtn'),
        filterChevron: document.getElementById('filterChevron'),
        filterSearch: document.getElementById('filterSearch'),
        filterPeriod: document.getElementById('filterPeriod'),
        filterMonth: document.getElementById('filterMonth'),
        filterNfeKey: document.getElementById('filterNfeKey'),
        filterOrigin: document.getElementById('filterOrigin'),
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

        // XML Import
        btnImportPurchasesXml: document.getElementById('btnImportPurchasesXml'),
        inputImportPurchasesXml: document.getElementById('inputImportPurchasesXml'),
        importPurchasesXmlModal: document.getElementById('importPurchasesXmlModal'),
        btnCloseImportPurchasesXmlModal: document.getElementById('btnCloseImportPurchasesXmlModal'),
        btnCancelImportPurchasesXml: document.getElementById('btnCancelImportPurchasesXml'),
        btnConfirmImportPurchasesXml: document.getElementById('btnConfirmImportPurchasesXml'),
        importPurchasesXmlModalFileName: document.getElementById('importPurchasesXmlModalFileName'),
        importPurchasesXmlBankAccount: document.getElementById('importPurchasesXmlBankAccount'),
        importPurchasesXmlCategory: document.getElementById('importPurchasesXmlCategory'),
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

    function toDateStr(val: any): string {
        if (!val) return '';
        if (typeof val === 'string') {
            if (val.includes('T')) return val.split('T')[0] || '';
            return val.slice(0, 10);
        }
        if (val instanceof Date) {
            const y = val.getFullYear();
            const m = String(val.getMonth() + 1).padStart(2, '0');
            const d = String(val.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return String(val).slice(0, 10);
    }

    function formatLocalDate(d: Date): string {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getCurrentMonthString() {
        const d = new Date();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${d.getFullYear()}-${month}`;
    }

    function shiftMonth(monthStr: string, offset: number): string {
        let year: number, month: number;
        if (!monthStr || !monthStr.includes('-')) {
            const d = new Date();
            year = d.getFullYear();
            month = d.getMonth() + 1;
        } else {
            const parts = monthStr.split('-');
            year = parseInt(parts[0] || '2026', 10);
            month = parseInt(parts[1] || '1', 10);
        }
        month += offset;
        while (month < 1) {
            month += 12;
            year -= 1;
        }
        while (month > 12) {
            month -= 12;
            year += 1;
        }
        return `${year}-${String(month).padStart(2, '0')}`;
    }

    function normalizeCompetencia(compStr: string): string {
        if (!compStr) return '';
        const clean = compStr.trim();
        if (clean.includes('/')) {
            const parts = clean.split('/');
            if (parts.length === 2) {
                const m = parts[0]!.padStart(2, '0');
                const y = parts[1]!;
                return `${y}-${m}`;
            }
        }
        if (clean.includes('-')) {
            return clean.slice(0, 7);
        }
        if (clean.length === 6) {
            const m = clean.slice(0, 2);
            const y = clean.slice(2);
            return `${y}-${m}`;
        }
        return clean;
    }
    
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
        return state.purchases.filter(p => !p.is_sped && p.source !== 'sped' && !String(p.public_id).startsWith('sped-') && p.status === 'completed' && !localStorage.getItem(`mock_purchase_nf_type_${p.public_id}`));
    }
    
    // --- Filtering ---
    function applyFilters() {
        const query = (els.filterSearch?.value || '').toLowerCase().trim();
        const nfeKeyTerm = (els.filterNfeKey?.value || '').toLowerCase().trim();
        const originVal = els.filterOrigin?.value || ''; // '', 'sped', 'erp'
        const statusVal = els.filterStatus?.value || ''; // '', 'pending', 'invoiced', 'cancelled'
        const monthVal = (els.filterMonthNav?.value || els.filterMonth?.value || '').trim();
        const nfeStartDate = els.filterNfeStartDate?.value || '';
        const startDate = els.filterStartDate?.value || '';
        const endDate = els.filterEndDate?.value || '';
        const nfeEndDate = els.filterNfeEndDate?.value || '';
        
        state.filteredPurchases = state.purchases.filter(p => {
            const isSped = !!p.is_sped || p.source === 'sped' || String(p.public_id).startsWith('sped-');
            
            // Origin check
            if (originVal === 'sped' && !isSped) return false;
            if (originVal === 'erp' && isSped) return false;

            const headerJson = typeof p.nfe_header_json === 'string' ? (() => { try { return JSON.parse(p.nfe_header_json); } catch(e) { return null; } })() : p.nfe_header_json;
            const docNum = String(headerJson?.numero || '').toLowerCase();
            const compRaw = String(p.competencia || '');
            const compNorm = normalizeCompetencia(compRaw);

            const matchesQuery = !query || 
                String(p.public_id).toLowerCase().includes(query) || 
                String(p.supplier_name || '').toLowerCase().includes(query) ||
                String(p.supplier_cnpj || '').toLowerCase().includes(query) ||
                docNum.includes(query) ||
                compRaw.toLowerCase().includes(query) ||
                compNorm.toLowerCase().includes(query);
                
            const isInvoiced = isSped ? true : (!!p.nfe_key || !!localStorage.getItem(`mock_purchase_nf_type_${p.public_id}`));
            const isCancelled = p.status === 'cancelled';
            const mockNfeKey = (!isSped && isInvoiced && !p.nfe_key)
                ? `352606${p.supplier_cnpj || '12345678000199'}55001000000${p.public_id.slice(0, 5)}1000000001`
                : (p.nfe_key || '');
                
            const matchesNfeKey = !nfeKeyTerm || mockNfeKey.toLowerCase().includes(nfeKeyTerm) || (p.nfe_key && p.nfe_key.toLowerCase().includes(nfeKeyTerm));
            
            let matchesStatus = true;
            if (statusVal === 'pending') {
                matchesStatus = !isSped && !isInvoiced && !isCancelled;
            } else if (statusVal === 'invoiced') {
                matchesStatus = isInvoiced && !isCancelled;
            } else if (statusVal === 'cancelled') {
                matchesStatus = isCancelled;
            }
            
            // Dates
            const purchaseDateStr = toDateStr(p.date);
            const nfeDateStr = toDateStr(p.nfe_issue_date || (isInvoiced ? (localStorage.getItem(`mock_purchase_nf_date_${p.public_id}`) || p.date) : ''));

            // Monthly filtering (if monthVal is set)
            if (monthVal) {
                const matchesMonth = (compNorm === monthVal) ||
                                     (purchaseDateStr && purchaseDateStr.startsWith(monthVal)) ||
                                     (nfeDateStr && nfeDateStr.startsWith(monthVal));
                if (!matchesMonth) return false;
            }
                
            const effectiveDate = purchaseDateStr || nfeDateStr;
            const matchesStartDate = !startDate || (effectiveDate && effectiveDate >= startDate);
            const matchesEndDate = !endDate || (effectiveDate && effectiveDate <= endDate);

            const matchesNfeStartDate = !nfeStartDate || (nfeDateStr && nfeDateStr >= nfeStartDate);
            const matchesNfeEndDate = !nfeEndDate || (nfeDateStr && nfeDateStr <= nfeEndDate);
            
            return matchesQuery && matchesNfeKey && matchesStatus && matchesStartDate && matchesEndDate && matchesNfeStartDate && matchesNfeEndDate;
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
            const isSped = !!p.is_sped || p.source === 'sped' || String(p.public_id).startsWith('sped-');
            const isInvoiced = isSped ? true : (!!p.nfe_key || !!localStorage.getItem(`mock_purchase_nf_type_${p.public_id}`));
            const isCancelled = p.status === 'cancelled';
            totalAmount += Number(p.total_amount || 0);
            
            let header = p.nfe_header_json;
            if (typeof header === 'string') {
                try { header = JSON.parse(header); } catch(e) {}
            }

            const isEligible = !isSped && p.status === 'completed' && !isInvoiced;
            const checkboxHtml = isEligible 
                ? `<input type="checkbox" value="${p.public_id}" class="batch-purchase-chk rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" ${state.selectedBatchPurchaseIds.has(p.public_id) ? 'checked' : ''} title="Selecionar compra #${p.public_id.slice(0, 8)}" aria-label="Selecionar compra #${p.public_id.slice(0, 8)}">` 
                : '';
                
            let purchaseNumHtml = '';
            if (isSped) {
                purchaseNumHtml = `
                    <div class="font-bold text-gray-900 dark:text-gray-100">NF-e #${header?.numero || p.public_id.slice(0, 8)}</div>
                    <div class="text-[10px] text-gray-500 dark:text-gray-400 font-mono">Série ${header?.serie || '1'}</div>
                `;
            } else {
                purchaseNumHtml = `<span class="font-semibold text-gray-900 dark:text-gray-100">#${p.public_id.slice(0, 8)}</span>`;
            }

            const originBadge = isSped
                ? `<span class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 shadow-2xs whitespace-nowrap"><svg class="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>SPED Fiscal</span>`
                : `<span class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 shadow-2xs whitespace-nowrap"><svg class="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z"></path></svg>ERP / XML</span>`;

            const nfeDateText = p.nfe_issue_date 
                ? formatDateOnly(p.nfe_issue_date) 
                : (isInvoiced 
                    ? formatDateOnly(localStorage.getItem(`mock_purchase_nf_date_${p.public_id}`) || p.date) 
                    : '-');
                
            let nfeKeyDisplay = '-';
            if (p.nfe_key) {
                const k = p.nfe_key;
                const shortKey = k.length > 20 ? `${k.slice(0, 6)}...${k.slice(-6)}` : k;
                nfeKeyDisplay = `<span class="font-mono text-xs text-gray-700 dark:text-gray-300 select-all" title="${k}">${shortKey}</span>`;
            } else if (isInvoiced && !isSped) {
                const mockK = `352606${p.supplier_cnpj || '12345678000199'}55001000000${p.public_id.slice(0, 5)}1000000001`;
                nfeKeyDisplay = `<span class="font-mono text-xs text-gray-400 select-all" title="${mockK}">${mockK.slice(0, 6)}...${mockK.slice(-6)}</span>`;
            }
                
            let nfeHeaderSummary = '-';
            if (isSped) {
                nfeHeaderSummary = `<div class="text-xs text-gray-800 dark:text-gray-200 font-medium">NF-e mod. ${header?.modelo || '55'} | Série ${header?.serie || '1'}</div>`;
                if (p.competencia) {
                    nfeHeaderSummary += `<div class="text-[10px] font-semibold text-purple-600 dark:text-purple-400">Comp. ${p.competencia}</div>`;
                }
            } else if (p.nfe_key) {
                const num = header?.numero || '';
                const serie = header?.serie || '';
                nfeHeaderSummary = `NF-e mod. 55 | Série ${serie} | Nº ${num}`;
            } else if (isInvoiced) {
                nfeHeaderSummary = `NF-e mod. 55 | Série 1 | Entrada`;
            }
                
            const supplierName = p.supplier_name || 'Fornecedor Desconhecido';
            const supplierCnpjText = p.supplier_cnpj ? `<span class="block text-[11px] font-mono text-gray-500 dark:text-gray-400">${p.supplier_cnpj}</span>` : '';
            const purchaseDateText = formatDateOnly(p.date);
            const totalVal = formatCurrency(p.total_amount);
            
            let statusBadge = '';
            if (isCancelled) {
                statusBadge = '<span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Cancelada</span>';
            } else if (isSped) {
                statusBadge = '<span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">Importada (SPED)</span>';
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
            if (isSped) {
                actsHtml = `
                    <button type="button" class="btn-items bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors flex items-center gap-1 shadow-2xs" data-id="${p.public_id}" title="Ver detalhes do documento fiscal SPED">
                        <svg class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                        Detalhes SPED
                    </button>
                `;
            } else if (isCancelled) {
                actsHtml = `
                    <button type="button" class="btn-items bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg px-2 py-1 text-xs font-semibold transition-colors" data-id="${p.public_id}">Ver Itens</button>
                `;
            } else if (isInvoiced) {
                actsHtml = `
                    <button type="button" class="btn-items bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg px-2 py-1 text-xs font-semibold transition-colors" data-id="${p.public_id}">Ver Itens</button>
                    <button type="button" class="btn-generate bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${btnGenDisabled}" data-id="${p.public_id}" title="Visualizar DANFE">
                        ${btnGenIcon}
                    </button>
                    <button type="button" class="btn-cancel bg-red-600 hover:bg-red-700 text-white rounded-lg px-2 py-1 text-xs font-semibold transition-colors" data-id="${p.public_id}" title="Desfazer Emissão">
                        ${btnCancelIcon}
                    </button>
                `;
            } else {
                actsHtml = `
                    <button type="button" class="btn-items bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg px-2 py-1 text-xs font-semibold transition-colors" data-id="${p.public_id}">Ver Itens</button>
                    <button type="button" class="btn-emit-single bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-2 py-1 text-xs font-semibold transition-colors" data-id="${p.public_id}" title="Emitir NFe Entrada">
                        Emitir NFe
                    </button>
                `;
            }
            
            const actionsCell = `
                <div class="flex items-center justify-center gap-1.5">
                    ${actsHtml}
                </div>
            `;

            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/40">
                    <td class="px-3 py-2.5 text-left">${checkboxHtml}</td>
                    <td class="px-3 py-2.5 text-sm">${purchaseNumHtml}</td>
                    <td class="px-3 py-2.5 text-center">${originBadge}</td>
                    <td class="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200">${nfeDateText}</td>
                    <td class="px-3 py-2.5 text-xs">${nfeKeyDisplay}</td>
                    <td class="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-200">${nfeHeaderSummary}</td>
                    <td class="px-3 py-2.5 text-sm">
                        <div class="font-semibold text-gray-900 dark:text-gray-100">${supplierName}</div>
                        ${supplierCnpjText}
                    </td>
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
                const isSped = !!purchase.is_sped || purchase.source === 'sped' || String(purchase.public_id).startsWith('sped-');

                if (isSped) {
                    const header = purchase.nfe_header_json || {};
                    els.itemsModalTitle.innerHTML = `
                        <div class="flex items-center gap-2">
                            <span class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">SPED Fiscal</span>
                            <span>Documento Fiscal de Compra / Entrada</span>
                        </div>
                    `;

                    const addressParts = [
                        purchase.supplier_street,
                        purchase.supplier_number ? `nº ${purchase.supplier_number}` : '',
                        purchase.supplier_neighborhood,
                        purchase.supplier_city,
                        purchase.supplier_state
                    ].filter(Boolean).join(', ');

                    els.itemsModalBody.innerHTML = `
                        <div class="space-y-4">
                            <!-- Supplier Header Card -->
                            <div class="bg-purple-50/50 dark:bg-purple-950/20 rounded-xl p-4 border border-purple-100 dark:border-purple-900/40 shadow-xs">
                                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-100 dark:border-purple-900/30 pb-3 mb-3">
                                    <div>
                                        <p class="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 tracking-wider">Fornecedor / Emitente</p>
                                        <h4 class="text-base font-bold text-gray-900 dark:text-gray-100">${purchase.supplier_name || 'Fornecedor'}</h4>
                                        <p class="text-xs font-mono text-gray-600 dark:text-gray-300 mt-0.5">${purchase.supplier_cnpj ? `CNPJ/CPF: ${purchase.supplier_cnpj}` : 'Documento não informado'}</p>
                                    </div>
                                    <div class="text-left sm:text-right">
                                        <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-bold bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300">
                                            Competência: ${purchase.competencia || '-'}
                                        </span>
                                    </div>
                                </div>
                                ${addressParts ? `<p class="text-xs text-gray-600 dark:text-gray-400"><strong class="text-gray-700 dark:text-gray-300">Endereço:</strong> ${addressParts}</p>` : ''}
                            </div>

                            <!-- Document Information Grid -->
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div class="bg-gray-50 dark:bg-slate-900/60 p-3 rounded-lg border border-gray-200 dark:border-slate-700">
                                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Número da NF</span>
                                    <span class="text-sm font-black text-gray-900 dark:text-gray-100 font-mono">${header.numero || '-'}</span>
                                </div>
                                <div class="bg-gray-50 dark:bg-slate-900/60 p-3 rounded-lg border border-gray-200 dark:border-slate-700">
                                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Série / Modelo</span>
                                    <span class="text-sm font-bold text-gray-900 dark:text-gray-100">${header.serie || '1'} / Mod. ${header.modelo || '55'}</span>
                                </div>
                                <div class="bg-gray-50 dark:bg-slate-900/60 p-3 rounded-lg border border-gray-200 dark:border-slate-700">
                                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Data Entrada / Doc</span>
                                    <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">${formatDateOnly(purchase.date)}</span>
                                </div>
                                <div class="bg-gray-50 dark:bg-slate-900/60 p-3 rounded-lg border border-gray-200 dark:border-slate-700">
                                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Situação</span>
                                    <span class="text-sm font-bold ${purchase.status === 'cancelled' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}">
                                        ${purchase.status === 'cancelled' ? '02 - Cancelada' : '00 - Regular'}
                                    </span>
                                </div>
                            </div>

                            <!-- NFe Key -->
                            ${purchase.nfe_key ? `
                                <div class="bg-gray-50 dark:bg-slate-900/60 p-3 rounded-lg border border-gray-200 dark:border-slate-700">
                                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Chave de Acesso NF-e</span>
                                    <div class="flex items-center justify-between gap-2">
                                        <span class="font-mono text-xs text-gray-900 dark:text-gray-100 font-bold select-all break-all">${purchase.nfe_key}</span>
                                    </div>
                                </div>
                            ` : ''}

                            <!-- Values & Taxes Breakdown -->
                            <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-xs">
                                <div class="px-4 py-2.5 bg-gray-50 dark:bg-slate-900/80 border-b border-gray-200 dark:border-slate-700 font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-gray-300">
                                    Valores e Impostos do Documento (SPED)
                                </div>
                                <div class="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                                    <div class="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                                        <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Valor Total</span>
                                        <span class="text-base font-black text-emerald-700 dark:text-emerald-300 font-mono">${formatCurrency(purchase.total_amount)}</span>
                                    </div>
                                    <div class="p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                                        <span class="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">ICMS Destacado</span>
                                        <span class="text-sm font-bold text-blue-700 dark:text-blue-300 font-mono">${formatCurrency(header.vlIcms || 0)}</span>
                                    </div>
                                    <div class="p-2.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30">
                                        <span class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">PIS</span>
                                        <span class="text-sm font-bold text-indigo-700 dark:text-indigo-300 font-mono">${formatCurrency(header.vlPis || 0)}</span>
                                    </div>
                                    <div class="p-2.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30">
                                        <span class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">COFINS</span>
                                        <span class="text-sm font-bold text-indigo-700 dark:text-indigo-300 font-mono">${formatCurrency(header.vlCofins || 0)}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Footer Observation -->
                            <div class="p-3 rounded-lg bg-gray-50 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-700 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                <span>Registro SPED ${header.reg || 'C100 (NF-e/NFC-e)'} importado através da escrituração fiscal digital.</span>
                            </div>
                        </div>
                    `;
                } else {
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
            const detailRes = await api(`/purchases/${id}`);
            let xmlContent = detailRes?.data?.nfe_xml;

            if (!xmlContent) {
                const nfeResult = await api('/nfe/generate', {
                    method: 'POST',
                    body: JSON.stringify({ purchaseId: id })
                });
                
                if (!nfeResult || !nfeResult.xml) throw new Error("XML não retornado.");
                xmlContent = nfeResult.xml;
            }
            
            const storedMode = localStorage.getItem(`mock_purchase_nf_type_${id}`) || '55';
            
            state.danfeData.purchaseId = id;
            state.danfeData.xml = xmlContent;
            state.danfeData.html = parseXmlToDanfe(xmlContent, storedMode);
            
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
        // Month navigation toolbar listeners
        if (els.btnPrevMonth) {
            els.btnPrevMonth.addEventListener('click', () => {
                const current = els.filterMonthNav?.value || els.filterMonth?.value || getCurrentMonthString();
                const prev = shiftMonth(current, -1);
                if (els.filterMonthNav) els.filterMonthNav.value = prev;
                if (els.filterMonth) els.filterMonth.value = prev;
                if (els.filterPeriod) els.filterPeriod.value = 'custom';
                applyFilters();
            });
        }

        if (els.btnNextMonth) {
            els.btnNextMonth.addEventListener('click', () => {
                const current = els.filterMonthNav?.value || els.filterMonth?.value || getCurrentMonthString();
                const next = shiftMonth(current, 1);
                if (els.filterMonthNav) els.filterMonthNav.value = next;
                if (els.filterMonth) els.filterMonth.value = next;
                if (els.filterPeriod) els.filterPeriod.value = 'custom';
                applyFilters();
            });
        }

        if (els.btnCurrentMonth) {
            els.btnCurrentMonth.addEventListener('click', () => {
                const cur = getCurrentMonthString();
                if (els.filterMonthNav) els.filterMonthNav.value = cur;
                if (els.filterMonth) els.filterMonth.value = cur;
                if (els.filterPeriod) els.filterPeriod.value = 'this_month';
                applyFilters();
            });
        }

        if (els.btnAllMonths) {
            els.btnAllMonths.addEventListener('click', () => {
                if (els.filterMonthNav) els.filterMonthNav.value = '';
                if (els.filterMonth) els.filterMonth.value = '';
                if (els.filterPeriod) els.filterPeriod.value = 'all';
                applyFilters();
            });
        }

        if (els.filterMonthNav) {
            els.filterMonthNav.addEventListener('change', () => {
                const val = els.filterMonthNav.value;
                if (els.filterMonth) els.filterMonth.value = val;
                if (els.filterPeriod) els.filterPeriod.value = val ? 'custom' : 'all';
                applyFilters();
            });
        }

        if (els.filterMonth) {
            els.filterMonth.addEventListener('change', () => {
                const val = els.filterMonth.value;
                if (els.filterMonthNav) els.filterMonthNav.value = val;
                if (els.filterPeriod) els.filterPeriod.value = val ? 'custom' : 'all';
                applyFilters();
            });
        }

        if (els.filterPeriod) {
            els.filterPeriod.addEventListener('change', (e: any) => {
                const period = e.target.value;
                const now = new Date();
                const curYear = now.getFullYear();
                const curMonth = String(now.getMonth() + 1).padStart(2, '0');
                const curMonthStr = `${curYear}-${curMonth}`;

                if (period === 'today') {
                    const todayStr = formatLocalDate(now);
                    if (els.filterMonthNav) els.filterMonthNav.value = '';
                    if (els.filterMonth) els.filterMonth.value = '';
                    if (els.filterStartDate) els.filterStartDate.value = todayStr;
                    if (els.filterEndDate) els.filterEndDate.value = todayStr;
                    if (els.filterNfeStartDate) els.filterNfeStartDate.value = '';
                    if (els.filterNfeEndDate) els.filterNfeEndDate.value = '';
                } else if (period === 'yesterday') {
                    const yesterday = new Date(now);
                    yesterday.setDate(now.getDate() - 1);
                    const yesterdayStr = formatLocalDate(yesterday);
                    if (els.filterMonthNav) els.filterMonthNav.value = '';
                    if (els.filterMonth) els.filterMonth.value = '';
                    if (els.filterStartDate) els.filterStartDate.value = yesterdayStr;
                    if (els.filterEndDate) els.filterEndDate.value = yesterdayStr;
                    if (els.filterNfeStartDate) els.filterNfeStartDate.value = '';
                    if (els.filterNfeEndDate) els.filterNfeEndDate.value = '';
                } else if (period === 'this_month') {
                    if (els.filterMonthNav) els.filterMonthNav.value = curMonthStr;
                    if (els.filterMonth) els.filterMonth.value = curMonthStr;
                    const start = new Date(now.getFullYear(), now.getMonth(), 1);
                    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    if (els.filterStartDate) els.filterStartDate.value = formatLocalDate(start);
                    if (els.filterEndDate) els.filterEndDate.value = formatLocalDate(end);
                    if (els.filterNfeStartDate) els.filterNfeStartDate.value = '';
                    if (els.filterNfeEndDate) els.filterNfeEndDate.value = '';
                } else if (period === 'last_month') {
                    const last = shiftMonth(curMonthStr, -1);
                    if (els.filterMonthNav) els.filterMonthNav.value = last;
                    if (els.filterMonth) els.filterMonth.value = last;
                    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    const end = new Date(now.getFullYear(), now.getMonth(), 0);
                    if (els.filterStartDate) els.filterStartDate.value = formatLocalDate(start);
                    if (els.filterEndDate) els.filterEndDate.value = formatLocalDate(end);
                    if (els.filterNfeStartDate) els.filterNfeStartDate.value = '';
                    if (els.filterNfeEndDate) els.filterNfeEndDate.value = '';
                } else if (period === 'last_3_months') {
                    if (els.filterMonthNav) els.filterMonthNav.value = '';
                    if (els.filterMonth) els.filterMonth.value = '';
                    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    if (els.filterStartDate) els.filterStartDate.value = formatLocalDate(start);
                    if (els.filterEndDate) els.filterEndDate.value = formatLocalDate(end);
                    if (els.filterNfeStartDate) els.filterNfeStartDate.value = '';
                    if (els.filterNfeEndDate) els.filterNfeEndDate.value = '';
                } else if (period === 'this_year') {
                    if (els.filterMonthNav) els.filterMonthNav.value = '';
                    if (els.filterMonth) els.filterMonth.value = '';
                    const start = new Date(now.getFullYear(), 0, 1);
                    const end = new Date(now.getFullYear(), 11, 31);
                    if (els.filterStartDate) els.filterStartDate.value = formatLocalDate(start);
                    if (els.filterEndDate) els.filterEndDate.value = formatLocalDate(end);
                    if (els.filterNfeStartDate) els.filterNfeStartDate.value = '';
                    if (els.filterNfeEndDate) els.filterNfeEndDate.value = '';
                } else if (period === 'all' || !period) {
                    if (els.filterMonthNav) els.filterMonthNav.value = '';
                    if (els.filterMonth) els.filterMonth.value = '';
                    if (els.filterStartDate) els.filterStartDate.value = '';
                    if (els.filterEndDate) els.filterEndDate.value = '';
                    if (els.filterNfeStartDate) els.filterNfeStartDate.value = '';
                    if (els.filterNfeEndDate) els.filterNfeEndDate.value = '';
                }
                applyFilters();
            });
        }

        [els.filterStartDate, els.filterEndDate, els.filterNfeStartDate, els.filterNfeEndDate].forEach(el => {
            if (el) {
                el.addEventListener('change', () => {
                    if (els.filterPeriod && els.filterPeriod.value !== 'custom') {
                        els.filterPeriod.value = 'custom';
                    }
                });
            }
        });

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
        [els.filterSearch, els.filterNfeKey, els.filterOrigin, els.filterStatus, els.filterNfeStartDate, els.filterStartDate, els.filterEndDate, els.filterNfeEndDate].forEach(el => {
            if (el) {
                el.addEventListener('input', applyFilters);
                el.addEventListener('change', applyFilters);
            }
        });

        els.btnClearFilters.addEventListener('click', () => {
            [els.filterSearch, els.filterNfeKey, els.filterNfeStartDate, els.filterStartDate, els.filterEndDate, els.filterNfeEndDate].forEach(el => {
                if (el) el.value = '';
            });
            if (els.filterOrigin) els.filterOrigin.value = '';
            if (els.filterStatus) els.filterStatus.value = '';
            if (els.filterMonthNav) els.filterMonthNav.value = '';
            if (els.filterMonth) els.filterMonth.value = '';
            if (els.filterPeriod) els.filterPeriod.value = 'all';
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

        // XML Import listeners
        els.btnImportPurchasesXml.addEventListener('click', () => {
            els.inputImportPurchasesXml.click();
        });

        els.inputImportPurchasesXml.addEventListener('change', async (e: any) => {
            const files = Array.from(e.target.files || []) as File[];
            if (files.length === 0) return;

            state.selectedXmlFiles = files;
            if (files.length === 1) {
                els.importPurchasesXmlModalFileName.textContent = `Arquivo: ${files[0].name}`;
            } else {
                els.importPurchasesXmlModalFileName.textContent = `${files.length} arquivos selecionados`;
            }

            await loadImportOptions();
            openImportModal();
        });

        els.btnCloseImportPurchasesXmlModal.addEventListener('click', closeImportModal);
        els.btnCancelImportPurchasesXml.addEventListener('click', closeImportModal);
        els.btnConfirmImportPurchasesXml.addEventListener('click', submitXmlImport);
    }

    // --- XML Import Operations ---
    async function loadImportOptions() {
        if (state.importOptionsLoaded) return;

        try {
            const [banksResponse, categoriesResponse] = await Promise.all([
                api('/bank-accounts'),
                api('/finance/categories?type=expense')
            ]);

            const banks = Array.isArray(banksResponse?.data) ? banksResponse.data : [];
            const categories = Array.isArray(categoriesResponse?.data) ? categoriesResponse.data : [];

            els.importPurchasesXmlBankAccount.innerHTML = '<option value="">Automático (primeira conta)</option>' + banks.map((bank: any) => {
                const label = bank.name || bank.bank_name || `Conta ${bank.id || ''}`;
                return `<option value="${bank.public_id}">${label}</option>`;
            }).join('');

            els.importPurchasesXmlCategory.innerHTML = '<option value="">Automático (categoria de compras)</option>' + categories.map((category: any) => {
                return `<option value="${category.public_id}">${category.name}</option>`;
            }).join('');

            state.importOptionsLoaded = true;
        } catch (e: any) {
            console.error("Erro ao carregar opções de importação:", e);
        }
    }

    function openImportModal() {
        els.importPurchasesXmlModal.classList.remove('hidden');
        els.importPurchasesXmlModal.classList.add('flex');
    }

    function closeImportModal() {
        els.importPurchasesXmlModal.classList.add('hidden');
        els.importPurchasesXmlModal.classList.remove('flex');
    }

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    function isTooManyRequestsError(error: any) {
        const status = Number(error?.status || error?.statusCode || error?.response?.status || 0);
        if (status === 429) return true;
        const message = String(error?.message || '').toLowerCase();
        return message.includes('muitas requisi') || message.includes('too many requests');
    }

    async function importXmlWithRetry(payload: any, maxAttempts = 4) {
        let lastError = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await api('/purchases/import-xml', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
            } catch (error) {
                lastError = error;
                const shouldRetry = isTooManyRequestsError(error) && attempt < maxAttempts;
                if (!shouldRetry) throw error;
                await wait(1200 * attempt);
            }
        }
        throw lastError || new Error('Falha ao importar XML.');
    }

    function formatImportFailureDetails(reasons: string[]) {
        const uniqueReasons = Array.from(new Set(reasons));
        if (uniqueReasons.length === 0) return 'Falha ao importar XML.';
        const hasCnpjMismatch = uniqueReasons.some((reason) => /cnpj/i.test(reason));
        const highlighted = hasCnpjMismatch ? 'CNPJ do destinatário diferente do CNPJ da empresa. ' : '';
        const details = uniqueReasons.slice(0, 2).join(' | ');
        const suffix = uniqueReasons.length > 2 ? ` | +${uniqueReasons.length - 2} erro(s)` : '';
        return `${highlighted}${details}${suffix}`;
    }

    async function submitXmlImport() {
        if (!state.selectedXmlFiles || state.selectedXmlFiles.length === 0) {
            closeImportModal();
            return;
        }

        const originalBtnHtml = els.btnConfirmImportPurchasesXml.innerHTML;
        els.btnConfirmImportPurchasesXml.disabled = true;
        els.btnConfirmImportPurchasesXml.classList.add('opacity-70', 'cursor-not-allowed');
        els.btnConfirmImportPurchasesXml.innerHTML = 'Importando...';

        try {
            let successCount = 0;
            let failedCount = 0;
            let importedItemsTotal = 0;
            let unmatchedTotal = 0;
            const failedReasons: string[] = [];

            for (const file of state.selectedXmlFiles) {
                try {
                    const xmlContent = await file.text();
                    const response = await importXmlWithRetry({
                        xml_content: xmlContent,
                        bank_account_public_id: els.importPurchasesXmlBankAccount.value || null,
                        category_public_id: els.importPurchasesXmlCategory.value || null,
                    });

                    successCount += 1;
                    importedItemsTotal += Number(response?.data?.imported_items || 0);
                    unmatchedTotal += Array.isArray(response?.data?.unmatched_items) ? response.data.unmatched_items.length : 0;
                } catch (error: any) {
                    failedCount += 1;
                    console.error('Erro ao importar XML de compra', error);
                    failedReasons.push(`${file.name}: ${error?.message || 'Falha desconhecida'}`);
                }
            }

            if (failedCount === 0) {
                showAlert(`Importação concluída. ${successCount} XML(s) importado(s), ${importedItemsTotal} item(ns) processado(s).`, 'success');
            } else if (successCount === 0) {
                const details = formatImportFailureDetails(failedReasons);
                showAlert(`Importação não realizada. ${details}`, 'error');
            } else {
                const details = formatImportFailureDetails(failedReasons);
                showAlert(`Importação finalizada com ressalvas. Sucesso: ${successCount}, falhas: ${failedCount}. ${details}`, 'warning');
            }

            if (successCount > 0) {
                await loadPurchases();
            }
            closeImportModal();
        } catch (error: any) {
            console.error('Erro na importação de XML', error);
            showAlert(error?.message || 'Falha ao importar XML da nota.', 'error');
        } finally {
            els.btnConfirmImportPurchasesXml.disabled = false;
            els.btnConfirmImportPurchasesXml.classList.remove('opacity-70', 'cursor-not-allowed');
            els.btnConfirmImportPurchasesXml.innerHTML = originalBtnHtml;
            els.inputImportPurchasesXml.value = '';
            state.selectedXmlFiles = [];
        }
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
