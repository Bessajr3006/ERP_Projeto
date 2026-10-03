/// <reference path="./api.js" />
/// <reference path="./components/crud-manager.js" />

(() => {
    const getById = (id) => document.getElementById(id);
    let quotesManager;
    let selectedItems = []; // Array of items added to the quote
    let allProducts = [];
    let allServices = [];
    let currentQuoteId = null;
    const quotesById = {};
    let approveState = { quote: null, total: 0, installments: [] };
    let financeOptionsLoaded = false;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    const PAYMENT_METHODS = [
        ['pix', 'PIX'], ['boleto', 'Boleto'], ['credit', 'Cartão de crédito'],
        ['debit', 'Cartão de débito'], ['cash', 'Dinheiro'], ['transfer', 'Transferência']
    ];

    function addMonths(dateStr, months) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const base = new Date(Date.UTC(y, m - 1 + months, 1));
        const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
        base.setUTCDate(Math.min(d, lastDay));
        return base.toISOString().slice(0, 10);
    }

    function todayIso() {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 10);
    }

    async function loadFinanceOptions() {
        if (financeOptionsLoaded) return;
        const [banksRes, catsRes] = await Promise.all([
            api('/bank-accounts').catch(() => ({ data: [] })),
            api('/finance/categories').catch(() => ({ data: [] }))
        ]);
        const banks = banksRes?.data || [];
        const cats = (catsRes?.data || []).filter(c => c.type === 'income');
        getById('approveBankAccount').innerHTML = '<option value="">Selecione...</option>' +
            banks.map(b => `<option value="${escapeHtml(b.public_id)}">${escapeHtml(b.name)}</option>`).join('');
        getById('approveCategory').innerHTML = '<option value="">Selecione...</option>' +
            cats.map(c => `<option value="${escapeHtml(c.public_id)}">${escapeHtml(c.name)}</option>`).join('');
        if (banks.length === 1) getById('approveBankAccount').value = banks[0].public_id;
        if (cats.length === 1) getById('approveCategory').value = cats[0].public_id;
        financeOptionsLoaded = true;
    }

    function splitInstallments() {
        const count = Math.min(120, Math.max(1, parseInt(getById('approveInstallmentsCount').value, 10) || 1));
        getById('approveInstallmentsCount').value = String(count);
        const firstDue = getById('approveFirstDueDate').value || todayIso();
        const method = getById('approveDefaultMethod').value || 'pix';
        const totalCents = Math.round(approveState.total * 100);
        const baseCents = Math.floor(totalCents / count);
        approveState.installments = Array.from({ length: count }, (_, i) => ({
            amount: (i === count - 1 ? totalCents - baseCents * (count - 1) : baseCents) / 100,
            due_date: addMonths(firstDue, i),
            payment_method: method
        }));
        renderInstallments();
    }

    function renderInstallments() {
        const tbody = getById('approveInstallmentsTable');
        const count = approveState.installments.length;
        tbody.innerHTML = approveState.installments.map((inst, i) => `
            <tr>
                <td class="px-3 py-2 text-gray-700 dark:text-gray-200 whitespace-nowrap">${i + 1}/${count}</td>
                <td class="px-3 py-2"><input type="number" min="0.01" step="0.01" data-inst="${i}" data-field="amount" value="${inst.amount.toFixed(2)}" class="w-32 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 py-1 px-2 text-sm"></td>
                <td class="px-3 py-2"><input type="date" data-inst="${i}" data-field="due_date" value="${inst.due_date}" class="rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 py-1 px-2 text-sm"></td>
                <td class="px-3 py-2"><select data-inst="${i}" data-field="payment_method" class="rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 py-1 px-2 text-sm">
                    ${PAYMENT_METHODS.map(([v, l]) => `<option value="${v}" ${inst.payment_method === v ? 'selected' : ''}>${l}</option>`).join('')}
                </select></td>
            </tr>
        `).join('');
        updateInstallmentsSum();
    }

    function updateInstallmentsSum() {
        const sum = approveState.installments.reduce((acc, inst) => acc + (Number(inst.amount) || 0), 0);
        const diff = Math.round((approveState.total - sum) * 100) / 100;
        getById('approveInstallmentsSum').textContent = formatCurrency(sum);
        const diffEl = getById('approveInstallmentsDiff');
        const ok = Math.abs(diff) <= 0.01;
        diffEl.textContent = ok ? 'Confere com o total' : `Diferença: ${formatCurrency(diff)}`;
        diffEl.className = `ml-2 text-xs ${ok ? 'text-emerald-600' : 'text-red-600'}`;
        getById('btnApproveConfirm').disabled = !ok || approveState.installments.length === 0;
    }

    function closeApproveModal() {
        getById('approveModal').classList.add('hidden');
        approveState = { quote: null, total: 0, installments: [] };
    }

    async function openApproveModal(publicId) {
        const quote = quotesById[publicId];
        if (!quote) return;
        approveState.quote = quote;
        approveState.total = Math.round(Number(quote.total_amount || quote.computed_total || 0) * 100) / 100;
        getById('approveQuoteNumber').textContent = `#${String(quote.id).padStart(4, '0')}`;
        getById('approveQuoteTotal').textContent = formatCurrency(approveState.total);
        getById('approveInstallmentsCount').value = '1';
        getById('approveFirstDueDate').value = todayIso();
        if (quote.payment_method && PAYMENT_METHODS.some(([v]) => v === quote.payment_method)) {
            getById('approveDefaultMethod').value = quote.payment_method;
        }
        getById('approveModal').classList.remove('hidden');
        try {
            await loadFinanceOptions();
        } catch (error) {
            console.error('Failed to load finance options', error);
        }
        splitInstallments();
    }

    async function confirmApprove() {
        const quote = approveState.quote;
        if (!quote) return;
        const bank = getById('approveBankAccount').value;
        const category = getById('approveCategory').value;
        if (!bank || !category) {
            alert('Selecione a conta bancária e a categoria.');
            return;
        }
        if (approveState.installments.some(inst => !(Number(inst.amount) > 0) || !inst.due_date)) {
            alert('Preencha valor e vencimento de todas as parcelas.');
            return;
        }
        const btn = getById('btnApproveConfirm');
        btn.disabled = true;
        btn.textContent = 'Aprovando...';
        try {
            await api(`/orders/quotes/${quote.public_id}/approve`, {
                method: 'POST',
                body: JSON.stringify({
                    bank_account_public_id: bank,
                    category_public_id: category,
                    installments: approveState.installments.map(inst => ({
                        amount: Math.round(Number(inst.amount) * 100) / 100,
                        due_date: inst.due_date,
                        payment_method: inst.payment_method
                    }))
                })
            });
            closeApproveModal();
            quotesManager.loadData();
            const alertEl = getById('alertMessage');
            if (alertEl) {
                alertEl.textContent = 'Orçamento aprovado! A venda foi criada e as parcelas foram lançadas em Receitas.';
                alertEl.className = 'mx-4 sm:mx-0 mb-4 p-4 rounded-xl text-sm bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400';
                alertEl.classList.remove('hidden');
                setTimeout(() => alertEl.classList.add('hidden'), 6000);
            }
        } catch (error) {
            console.error(error);
            alert(error.message || 'Erro ao aprovar orçamento.');
        } finally {
            btn.textContent = 'Aprovar e gerar parcelas';
            updateInstallmentsSum();
        }
    }

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
            gridSectionId: 'quotesSection', // No grid for quotes, but need an ID
            tableSectionId: 'quotesSection',
            modalId: 'quotesModal',
            renderTable: (items) => {
                const tbody = getById('quotesTable');
                if (!tbody) return;

                if (items.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500">Nenhum orçamento encontrado.</td></tr>';
                    return;
                }

                tbody.innerHTML = items.map(quote => {
                    const total = quote.items ? quote.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0) : 0;
                    quotesById[quote.public_id] = { ...quote, computed_total: total };
                    return `
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap w-10">
                                <input type="checkbox" class="row-checkbox rounded border-gray-300 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50" value="${quote.public_id}">
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-mono">
                                #${String(quote.id).padStart(4, '0')}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                ${escapeHtml(quote.customer_name || 'Consumidor Final')}
                                ${Number(quote.dental_procedures_count || 0) > 0 ? '<span class="ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" title="Gerado pelo odontograma">Odontograma</span>' : ''}
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
                    selectedItems = item.items ? item.items.map(i => {
                        const baseName = i.product_name || i.name || i.service_name || '';
                        return {
                            product_public_id: i.product_public_id || null,
                            service_public_id: i.service_public_id || null,
                            product_name: i.description ? (baseName ? `${baseName} – ${i.description}` : i.description) : baseName,
                            description: i.description || null,
                            quantity: Number(i.quantity),
                            unit_price: Number(i.unit_price)
                        };
                    }) : [];
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
                    unit_price: item.unit_price,
                    description: item.description || null
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

        // Transformar em Venda = aprovar orçamento (gera venda + parcelas em Receitas)
        window.convertToSale = function(quoteId) {
            openApproveModal(quoteId);
        };

        getById('btnApproveSplit')?.addEventListener('click', splitInstallments);
        getById('approveInstallmentsCount')?.addEventListener('change', splitInstallments);
        getById('approveFirstDueDate')?.addEventListener('change', splitInstallments);
        getById('approveDefaultMethod')?.addEventListener('change', () => {
            const method = getById('approveDefaultMethod').value;
            approveState.installments.forEach(inst => { inst.payment_method = method; });
            renderInstallments();
        });
        getById('approveInstallmentsTable')?.addEventListener('input', (e) => {
            const el = e.target.closest('[data-inst]');
            if (!el) return;
            const idx = parseInt(el.getAttribute('data-inst'), 10);
            const field = el.getAttribute('data-field');
            const inst = approveState.installments[idx];
            if (!inst) return;
            inst[field] = field === 'amount' ? (parseFloat(el.value) || 0) : el.value;
            if (field === 'amount') updateInstallmentsSum();
        });
        getById('approveInstallmentsTable')?.addEventListener('change', (e) => {
            const el = e.target.closest('select[data-inst]');
            if (!el) return;
            const inst = approveState.installments[parseInt(el.getAttribute('data-inst'), 10)];
            if (inst) inst.payment_method = el.value;
        });
        getById('btnApproveConfirm')?.addEventListener('click', confirmApprove);
        getById('btnApproveCancel')?.addEventListener('click', closeApproveModal);
        getById('approveModalBackdrop')?.addEventListener('click', closeApproveModal);

    });
})();
