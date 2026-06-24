/// <reference path="./api.js" />
/// <reference path="./components/crud-manager.js" />

(() => {
    const getById = (id) => document.getElementById(id);
    let quotesManager;
    let selectedItems = []; // Array of items added to the quote
    let allProducts = [];
    let allServices = [];
    let currentQuoteId = null;

    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    function setCurrencyValue(inputId, numValue) {
        const el = getById(inputId);
        if (!el) return;
        let valStr = parseFloat(numValue || 0).toFixed(2);
        let digitsOnly = valStr.replace(/\D/g, '');
        let formatted = (parseInt(digitsOnly, 10) / 100).toFixed(2) + '';
        formatted = formatted.replace('.', ',');
        formatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        el.value = 'R$ ' + formatted;
    }


    async function loadCustomers() {
        try {
            const response = await api('/entities/customers');
            const select = getById('quoteCustomer');
            select.innerHTML = '<option value="">Selecione o Cliente</option>' + 
                response.data.map(c => `<option value="${c.public_id}">${c.name}</option>`).join('');
        } catch (error) {
            console.error('Failed to load customers', error);
        }
    }

    async function loadSellers() {
        try {
            const response = await api('/sellers');
            const select = getById('quoteSeller');
            if (response.data) {
                select.innerHTML = '<option value="">Nenhum Vendedor</option>' + 
                    response.data.map(u => `<option value="${u.public_id}">${u.full_name}</option>`).join('');
            }
        } catch (error) {
            console.error('Failed to load sellers', error);
        }
    }

    async function loadProducts() {
        try {
            const response = await api('/products');
            allProducts = response.data || [];
        } catch (error) {
            console.error('Failed to load products', error);
        }
    }

    async function loadServices() {
        try {
            const response = await api('/estoque/services');
            allServices = response.data || [];
        } catch (error) {
            console.error('Failed to load services', error);
        }
    }

    function updateItemDropdown() {
        const type = getById('quoteItemType').value;
        const select = getById('quoteItemSelect');
        const label = getById('quoteItemLabel');
        
        if (type === 'product') {
            label.textContent = 'Produto';
            select.innerHTML = '<option value="">Selecione...</option>' + 
                allProducts.map(p => `<option value="${p.public_id}" data-price="${p.selling_price}">${p.name}</option>`).join('');
        } else {
            label.textContent = 'Serviço';
            select.innerHTML = '<option value="">Selecione...</option>' + 
                allServices.map(s => `<option value="${s.public_id}" data-price="${s.price}">${s.name}</option>`).join('');
        }
        // Reset unit price
        getById('quoteUnitPrice').value = '';
    }

    function renderQuoteItems() {
        const tbody = getById('quoteItemsTable');
        const totalEl = getById('quoteTotalValue');
        
        if (selectedItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-3 text-center text-xs text-gray-500 dark:text-gray-400">Nenhum produto adicionado.</td></tr>';
            totalEl.textContent = 'R$ 0,00';
            return;
        }

        let total = 0;
        tbody.innerHTML = selectedItems.map((item, index) => {
            const subtotal = item.quantity * item.unit_price;
            total += subtotal;
            return `
                <tr class="group">
                    <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">${item.product_name}</td>
                    <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 text-right">${item.quantity}</td>
                    <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 text-right">${formatCurrency(item.unit_price)}</td>
                    <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 text-right font-medium">${formatCurrency(subtotal)}</td>
                    <td class="px-4 py-2 text-right">
                        <button type="button" class="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity remove-item-btn" data-index="${index}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        totalEl.textContent = formatCurrency(total);
    }

    window.removeQuoteItem = function(index) {
        selectedItems.splice(index, 1);
        renderQuoteItems();
    };

    document.addEventListener('DOMContentLoaded', async () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }

        await Promise.all([loadCustomers(), loadProducts(), loadServices(), loadSellers()]);

        // Initial populate of dropdown
        updateItemDropdown();

        // Manual customer checkbox toggle logic
        const checkbox = getById('quoteCustomerManual');
        const selectContainer = getById('quoteCustomerSelectContainer');
        const manualContainer = getById('quoteCustomerManualContainer');
        const selectEl = getById('quoteCustomer');
        const manualNameEl = getById('quoteCustomerManualName');

        checkbox?.addEventListener('change', () => {
            if (checkbox.checked) {
                selectContainer.classList.add('hidden');
                selectEl.removeAttribute('required');
                selectEl.value = '';
                
                manualContainer.classList.remove('hidden');
                manualNameEl.setAttribute('required', 'required');
            } else {
                manualContainer.classList.add('hidden');
                manualNameEl.removeAttribute('required');
                manualNameEl.value = '';
                
                selectContainer.classList.remove('hidden');
                selectEl.setAttribute('required', 'required');
            }
        });

        // Event delegation for quote item deletion (inside the modal table)
        getById('quoteItemsTable')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.remove-item-btn');
            if (btn) {
                const index = parseInt(btn.getAttribute('data-index'), 10);
                if (!isNaN(index)) {
                    window.removeQuoteItem(index);
                }
            }
        });

        // Event delegation for converting quote to sale and printing (inside the list table)
        getById('quotesTable')?.addEventListener('click', (e) => {
            const convertBtn = e.target.closest('.convert-sale-btn');
            if (convertBtn) {
                const id = convertBtn.getAttribute('data-id');
                if (id) {
                    window.convertToSale(id);
                }
            }

            const printBtn = e.target.closest('.print-quote-btn');
            if (printBtn) {
                e.preventDefault();
                e.stopPropagation();
                const pubId = printBtn.getAttribute('data-id');
                if (pubId) {
                    let url = `/api/v1/orders/quotes/${pubId}/print`;
                    const jwtToken = sessionStorage.getItem('erp_token');
                    if (jwtToken) {
                        url += '?token=' + jwtToken;
                    }
                    
                    const pdfIframe = getById('pdfIframe');
                    const printPdfBtn = getById('printPdfBtn');
                    const pdfModalTitleText = getById('pdfModalTitleText');
                    
                    if (pdfIframe) pdfIframe.src = url;
                    if (printPdfBtn) printPdfBtn.classList.remove('hidden');
                    if (pdfModalTitleText) pdfModalTitleText.textContent = 'Orçamento';
                    getById('pdfModal').classList.remove('hidden');
                }
            }
        });

        // Listen to change in item type
        getById('quoteItemType')?.addEventListener('change', updateItemDropdown);

        // Auto-fill price when item is selected
        getById('quoteItemSelect')?.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            if (selectedOption && selectedOption.value) {
                const price = selectedOption.getAttribute('data-price');
                setCurrencyValue('quoteUnitPrice', price || 0);
            } else {
                getById('quoteUnitPrice').value = '';
            }
        });

        // Typing input event listener for formatting quoteUnitPrice as R$ currency
        const unitPriceEl = getById('quoteUnitPrice');
        if (unitPriceEl) {
            unitPriceEl.addEventListener('input', (e) => {
                const target = e.target;
                if (!target) return;
                let value = target.value.replace(/\D/g, '');
                if (value === '') value = '0';
                let formatted = (parseInt(value, 10) / 100).toFixed(2) + '';
                formatted = formatted.replace('.', ',');
                formatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
                target.value = 'R$ ' + formatted;
            });
        }

        // Add Item to internal list
        getById('btnAddProduct')?.addEventListener('click', () => {
            const itemTypeSelect = getById('quoteItemType');
            const itemSelect = getById('quoteItemSelect');
            const qtyInput = getById('quoteQuantity');
            const priceInput = getById('quoteUnitPrice');

            const itemType = itemTypeSelect.value;
            const public_id = itemSelect.value;
            const product_name = itemSelect.options[itemSelect.selectedIndex]?.text;
            const quantity = parseFloat(qtyInput.value);
            
            let rawPrice = priceInput.value.replace(/[^\d]/g, '');
            if (rawPrice === '') rawPrice = '0';
            const unit_price = parseFloat(rawPrice) / 100;

            if (!public_id || isNaN(quantity) || quantity <= 0 || isNaN(unit_price) || unit_price < 0) {
                alert('Preencha o item, a quantidade e o valor unitário corretamente.');
                return;
            }

            const newItem = {
                product_name,
                quantity,
                unit_price
            };

            if (itemType === 'product') {
                newItem.product_public_id = public_id;
            } else {
                newItem.service_public_id = public_id;
            }

            selectedItems.push(newItem);

            // Reset inputs
            itemSelect.value = '';
            qtyInput.value = '1';
            priceInput.value = '';
            renderQuoteItems();
        });

        quotesManager = new CrudManager({
            entityName: 'Orçamento',
            endpoint: '/orders/quotes',
            tableId: 'quotesTable',
            gridSectionId: 'quotesGridSection',
            tableSectionId: 'quotesSection',
            modalId: 'quotesModal',
            filterConfig: { footerId: 'quotesResultsFooter' },
            renderTable: (items) => {
                const tbody = getById('quotesTable');
                if (!tbody) return;

                if (items.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500">Nenhum orçamento encontrado.</td></tr>';
                    return;
                }

                tbody.innerHTML = items.map(quote => {
                    const total = quote.items ? quote.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0) : 0;
                    return `
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap w-10">
                                <input type="checkbox" class="row-checkbox rounded border-gray-300 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50" value="${quote.public_id}">
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-mono">
                                #${String(quote.id).padStart(4, '0')}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                ${quote.customer_name || 'Consumidor Final'}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                ${quote.seller_name || '-'}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                ${formatCurrency(total)}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                ${formatDate(quote.date || quote.created_at)}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div class="flex justify-end gap-2">
                                    <button class="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 print-quote-btn" data-id="${quote.public_id}" title="Imprimir Orçamento">
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                    </button>
                                    <button class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 edit-btn" data-id="${quote.public_id}" title="Editar">
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </button>
                                    <button class="text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-400 convert-sale-btn" data-id="${quote.public_id}" title="Transformar em Venda">
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </button>
                                    <button class="text-red-600 hover:text-red-900 dark:hover:text-red-400 delete-btn" data-id="${quote.public_id}" title="Excluir">
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            },
            renderGrid: (items) => {
                const grid = getById('quotesGridSection');
                if (!grid) return;
                if (items.length === 0) {
                    grid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-12 gap-2">
                        <svg class="w-10 h-10 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        <p class="text-sm text-gray-400 dark:text-gray-500">Nenhum orçamento encontrado.</p>
                    </div>`;
                    return;
                }

                grid.innerHTML = items.map((quote) => {
                    const total = quote.items ? quote.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0) : 0;
                    return `
                    <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col relative border border-gray-100 dark:border-slate-700 group">
                        <div class="flex justify-between items-start mb-3">
                            <div class="flex items-center pt-1 z-10">
                                <input type="checkbox" value="${quote.public_id}" class="item-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800">
                                <span class="ml-2 text-xs font-mono font-medium text-gray-500 dark:text-gray-400">#${String(quote.id).padStart(4, '0')}</span>
                            </div>

                            <div class="flex space-x-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10 -mr-1 -mt-1">
                                <button class="p-1.5 text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 bg-gray-50 hover:bg-indigo-50 dark:bg-slate-700 dark:hover:bg-indigo-900/30 rounded print-quote-btn" data-id="${quote.public_id}" title="Imprimir Orçamento">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                </button>
                                <button class="p-1.5 text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 bg-gray-50 hover:bg-brand-50 dark:bg-slate-700 dark:hover:bg-brand-900/30 rounded edit-btn" data-id="${quote.public_id}" title="Editar">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button class="p-1.5 text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-400 bg-gray-50 hover:bg-emerald-50 dark:bg-slate-700 dark:hover:bg-emerald-900/30 rounded convert-sale-btn" data-id="${quote.public_id}" title="Transformar em Venda">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </button>
                                <button class="p-1.5 text-red-600 hover:text-red-900 dark:hover:text-red-400 bg-gray-50 hover:bg-red-50 dark:bg-slate-700 dark:hover:bg-red-900/30 rounded delete-btn" data-id="${quote.public_id}" title="Excluir">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>

                        <div class="flex-1 mt-0">
                            <div class="flex justify-between items-start gap-2 mb-2">
                                <h4 class="text-[16px] font-bold text-gray-900 dark:text-gray-100 leading-tight wrap-break-word flex-1" title="${quote.customer_name || 'Consumidor Final'}">${quote.customer_name || 'Consumidor Final'}</h4>
                                <span class="text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap">${formatCurrency(total)}</span>
                            </div>

                            <div class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                <div class="flex items-center gap-2">
                                    <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5V4H2v16h5m10 0v-2a4 4 0 00-8 0v2m8 0H9m8 0H9m4-9a4 4 0 100-8 4 4 0 000 8z"></path></svg>
                                    <span class="truncate">${quote.seller_name || 'S/ Vendedor'}</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z"></path></svg>
                                    <span class="truncate">${formatDate(quote.date || quote.created_at)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    `;
                }).join('');
            },
            onEdit: (item) => {
                const title = getById('modalTitle');
                
                // Reset manual UI toggle state by default
                const checkbox = getById('quoteCustomerManual');
                if (checkbox) {
                    checkbox.checked = false;
                    checkbox.dispatchEvent(new Event('change'));
                }
                if (getById('quoteBrand')) getById('quoteBrand').value = '';
                if (getById('quoteCustomerManualName')) getById('quoteCustomerManualName').value = '';
                if (getById('quotePaymentMethod')) getById('quotePaymentMethod').value = '';
                if (getById('quotePaymentTerms')) getById('quotePaymentTerms').value = '';

                if (item) {
                    title.textContent = 'Editar Orçamento';
                    currentQuoteId = item.public_id;
                    
                    if (getById('quoteBrand')) {
                        getById('quoteBrand').value = item.brand || '';
                    }
                    if (getById('quotePaymentMethod')) {
                        getById('quotePaymentMethod').value = item.payment_method || '';
                    }
                    if (getById('quotePaymentTerms')) {
                        getById('quotePaymentTerms').value = item.payment_terms || '';
                    }

                    if (item.manual_customer_name) {
                        if (checkbox) {
                            checkbox.checked = true;
                            checkbox.dispatchEvent(new Event('change'));
                        }
                        if (getById('quoteCustomerManualName')) {
                            getById('quoteCustomerManualName').value = item.manual_customer_name || '';
                        }
                        getById('quoteCustomer').value = '';
                    } else {
                        getById('quoteCustomer').value = item.customer_public_id || '';
                    }

                    getById('quoteSeller').value = item.seller_public_id || '';
                    
                    if (item.date) {
                        // Trata data local para datetime-local
                        const dateObj = new Date(item.date);
                        dateObj.setMinutes(dateObj.getMinutes() - dateObj.getTimezoneOffset());
                        getById('quoteDate').value = dateObj.toISOString().slice(0, 16);
                    } else {
                        getById('quoteDate').value = '';
                    }

                    if (item.validity_date) {
                        const dateObj = new Date(item.validity_date);
                        dateObj.setMinutes(dateObj.getMinutes() - dateObj.getTimezoneOffset());
                        getById('quoteValidity').value = dateObj.toISOString().slice(0, 10);
                    } else {
                        getById('quoteValidity').value = '';
                    }
                    
                    getById('quoteObservation').value = item.observation || '';
                    
                    // Reset dropdown
                    getById('quoteItemType').value = 'product';
                    updateItemDropdown();
                    
                    // Carrega items
                    selectedItems = item.items ? item.items.map(i => ({
                        product_public_id: i.product_public_id || null,
                        service_public_id: i.service_public_id || null,
                        product_name: i.product_name || i.name || i.service_name,
                        quantity: Number(i.quantity),
                        unit_price: Number(i.unit_price)
                    })) : [];
                    renderQuoteItems();
                } else {
                    title.textContent = 'Novo Orçamento';
                    currentQuoteId = null;
                    getById('quotesForm').reset();

                    // reset manual customer logic again to ensure default dropdown is active
                    if (checkbox) {
                        checkbox.checked = false;
                        checkbox.dispatchEvent(new Event('change'));
                    }
                    
                    // Reset dropdown
                    getById('quoteItemType').value = 'product';
                    updateItemDropdown();
                    
                    // Set current date
                    const now = new Date();
                    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                    getById('quoteDate').value = now.toISOString().slice(0, 16);
                    
                    // Validade padrão: hoje + 7 dias
                    const validade = new Date(now);
                    validade.setDate(validade.getDate() + 7);
                    getById('quoteValidity').value = validade.toISOString().slice(0, 10);
                    
                    selectedItems = [];
                    renderQuoteItems();
                }
                
                getById('quotesModal').classList.remove('hidden');
            }
        });

        // Initialize table
        quotesManager.init();

        getById('btnCancelModal')?.addEventListener('click', () => {
            getById('quotesModal').classList.add('hidden');
        });
        
        getById('modalBackdrop')?.addEventListener('click', () => {
            getById('quotesModal').classList.add('hidden');
        });

        // print modal close and action event handlers
        function closePdfModal() {
            getById('pdfModal').classList.add('hidden');
            const pdfIframe = getById('pdfIframe');
            if (pdfIframe) pdfIframe.src = '';
        }

        getById('closePdfModalBtn')?.addEventListener('click', closePdfModal);
        getById('closePdfModalCross')?.addEventListener('click', closePdfModal);
        getById('closePdfModalBackdrop')?.addEventListener('click', closePdfModal);

        getById('printPdfBtn')?.addEventListener('click', () => {
            const pdfIframe = getById('pdfIframe');
            pdfIframe?.contentWindow?.focus();
            pdfIframe?.contentWindow?.print();
        });

        // Save Quote
        getById('quotesForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (selectedItems.length === 0) {
                alert('Adicione pelo menos um item ao orçamento.');
                return;
            }

            const isManual = getById('quoteCustomerManual')?.checked;
            const payload = {
                customer_public_id: isManual ? null : (getById('quoteCustomer').value || null),
                manual_customer_name: isManual ? (getById('quoteCustomerManualName').value || null) : null,
                brand: getById('quoteBrand')?.value || null,
                payment_method: getById('quotePaymentMethod')?.value || null,
                payment_terms: getById('quotePaymentTerms')?.value || null,
                seller_public_id: getById('quoteSeller').value || null,
                date: new Date(getById('quoteDate').value).toISOString(),
                validity_date: getById('quoteValidity').value ? new Date(getById('quoteValidity').value).toISOString() : null,
                observation: getById('quoteObservation').value || null,
                items: selectedItems.map(item => ({
                    product_public_id: item.product_public_id || null,
                    service_public_id: item.service_public_id || null,
                    quantity: item.quantity,
                    unit_price: item.unit_price
                }))
            };

            const saveBtn = getById('saveBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Salvando...';

            try {
                const method = currentQuoteId ? 'PUT' : 'POST';
                const endpoint = currentQuoteId ? `/orders/quotes/${currentQuoteId}` : '/orders/quotes';

                await api(endpoint, {
                    method: method,
                    body: JSON.stringify(payload)
                });
                
                getById('quotesModal').classList.add('hidden');
                quotesManager.loadData();
                
                // Show success inside #alertMessage
                const alertEl = getById('alertMessage');
                if (alertEl) {
                    alertEl.textContent = currentQuoteId ? 'Orçamento atualizado com sucesso!' : 'Orçamento criado com sucesso!';
                    alertEl.className = 'mx-4 sm:mx-0 mb-4 p-4 rounded-xl text-sm bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400';
                    alertEl.classList.remove('hidden');
                    setTimeout(() => alertEl.classList.add('hidden'), 4000);
                } else {
                    alert(currentQuoteId ? 'Orçamento atualizado com sucesso!' : 'Orçamento criado com sucesso!');
                }
            } catch (error) {
                console.error(error);
                alert(error.message || 'Erro ao salvar orçamento.');
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Salvar Orçamento';
            }
        });

        // Convert to sale stub
        window.convertToSale = function(quoteId) {
            alert('A transformação em venda a partir do orçamento será implementada no próximo passo do PDV.');
        }

    });
})();
