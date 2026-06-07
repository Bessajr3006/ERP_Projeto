(() => {
    let g_products = [];
    let g_suppliers = [];
    let g_banks = [];
    let g_categories = [];
    let g_cart = [];
    let g_purchases = [];
    let currentViewId = null;
    const FilterPanel = window.FilterPanel;
    const DateUtilsRef = window.DateUtils || (typeof DateUtils !== 'undefined' ? DateUtils : null);
    const getEl = (id) => document.getElementById(id);
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
    document.addEventListener('DOMContentLoaded', async () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }
        await loadDependencies();
        initProductSearch();
        // Load User info for the navbar
        api('/auth/me')
            .then((res) => {
            const userGreeting = getEl('userGreeting');
            if (userGreeting && res.data && res.data.user) {
                userGreeting.textContent = `Olá, ${res.data.user.full_name || 'Usuário'}`;
            }
            else if (userGreeting && res.data) {
                userGreeting.textContent = `Olá, ${res.data.full_name || 'Usuário'}`;
            }
        })
            .catch((err) => {
            console.error('Falha ao carregar usuário', err);
        });
        document.title = 'KEYSTONE - Compras';
        // Bind Modal Events (CSP Fix)
        getEl('btnOpenModal')?.addEventListener('click', () => {
            window.openSaleModal();
        });
        getEl('btnCancelModal')?.addEventListener('click', () => {
            window.closeModal();
        });
        const backdrop = getEl('modalBackdrop');
        if (backdrop) {
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop)
                    window.closeModal();
            });
        }
        let searchDebounceTimer = null;
        getEl('filterSearch')?.addEventListener('input', () => {
            if (searchDebounceTimer) {
                clearTimeout(searchDebounceTimer);
            }
            searchDebounceTimer = setTimeout(() => {
                applyFilters();
                searchDebounceTimer = null;
            }, 180);
        });
        getEl('filterStartDate')?.addEventListener('change', applyFilters);
        getEl('filterEndDate')?.addEventListener('change', applyFilters);
        // Event Delegation: Tabela de Compras
        getEl('purchasesTable')?.addEventListener('click', (e) => {
            const target = e.target;
            const btn = target?.closest('button[data-action]');
            if (btn) {
                const action = btn.getAttribute('data-action');
                const id = btn.getAttribute('data-id');
                if (!id)
                    return;
                if (action === 'view') {
                    window.openViewModal(id);
                }
                else if (action === 'duplicate') {
                    window.duplicatePurchase(id);
                }
                else if (action === 'cancel_inline') {
                    currentViewId = id;
                    window.cancelPurchase();
                }
                return;
            }
            const tr = target?.closest('.row-purchase');
            if (tr) {
                const id = tr.getAttribute('data-id');
                if (id)
                    window.openViewModal(id);
            }
        });
        // Event Delegation: Remover Item do Carrinho
        getEl('cartItems')?.addEventListener('click', (e) => {
            const target = e.target;
            const btn = target?.closest('.btn-remove-item');
            if (btn) {
                const index = parseInt(btn.getAttribute('data-index') || '', 10);
                if (!isNaN(index))
                    window.removeCartItem(index);
            }
        });
        // View Modal Events
        getEl('backdropViewModal')?.addEventListener('click', window.closeViewModal);
        getEl('btnCloseViewModal')?.addEventListener('click', window.closeViewModal);
        getEl('btnCancelPurchase')?.addEventListener('click', window.cancelPurchase);
        void fetchPurchases();
    });
    async function fetchPurchases() {
        try {
            const res = await api('/purchases');
            g_purchases = res.data || [];
            applyFilters();
        }
        catch (e) {
            console.error(e);
        }
    }
    function applyFilters() {
        const search = FilterPanel.normalizeText(getEl('filterSearch')?.value);
        const startDate = getEl('filterStartDate')?.value || '';
        const endDate = getEl('filterEndDate')?.value || '';
        const filtered = g_purchases.filter((item) => {
            if (!FilterPanel.matchesSearch(item, ['supplier_name'], search)) {
                return false;
            }
            if (startDate && DateUtilsRef.compareDateOnly(item.date, startDate) < 0) {
                return false;
            }
            if (endDate && DateUtilsRef.compareDateOnly(item.date, endDate) > 0) {
                return false;
            }
            return true;
        });
        renderPurchasesTable(filtered);
    }
    function renderPurchasesTable(purchases) {
        const tbody = getEl('purchasesTable');
        if (!tbody)
            return;
        if (!purchases || purchases.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">Nenhuma compra registrada.</td></tr>';
            return;
        }
        tbody.innerHTML = purchases
            .map((p) => {
            const isCompleted = p.status === 'completed';
            const badgeColor = isCompleted
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
            const badgeText = isCompleted ? 'Concluída' : 'Cancelada';
            return `
        <tr class="cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors row-purchase" data-id="${p.public_id}">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b dark:border-slate-700 dark:text-gray-300">${DateUtilsRef.formatDate(p.date)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b dark:border-slate-700 dark:text-gray-300">${p.supplier_name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-b dark:border-slate-700 dark:text-gray-400 text-center">${p.items_count ?? 0}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b dark:border-slate-700 dark:text-gray-300 font-medium">${formatCurrency(p.total_amount)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-center border-b dark:border-slate-700">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeColor}">${badgeText}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium border-b dark:border-slate-700">
                <div class="flex items-center justify-end space-x-3">
                    <button data-action="view" data-id="${p.public_id}" class="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 transition-colors" title="Ver Detalhes">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </button>
                    <button data-action="duplicate" data-id="${p.public_id}" class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors" title="Duplicar">
                        <svg class="h-5 w-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </button>
                    ${isCompleted
                ? `
                    <button data-action="cancel_inline" data-id="${p.public_id}" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors" title="Cancelar Compra">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                    `
                : ''}
                </div>
            </td>
        </tr>
    `;
        })
            .join('');
    }
    // Load Dependencies (Products, Entities, Banks, Categories)
    async function loadDependencies() {
        try {
            const [prodRes, custRes, bankRes, catRes] = await Promise.all([
                api('/products'),
                api('/entities/suppliers'),
                api('/bank-accounts'),
                api('/finance/categories'),
            ]);
            g_products = prodRes.data || [];
            g_suppliers = custRes.data || [];
            g_banks = bankRes.data || [];
            g_categories = catRes.data || [];
            populateSelect('bankSelect', g_banks, 'name', 'public_id');
        }
        catch (error) {
            console.error('Falha ao carregar dependências', error);
            UI.showAlert('alertMessage', 'Falha na comunicação base do sistema.');
        }
    }
    function populateSelect(elementId, items, labelKey, valueKey) {
        const el = getEl(elementId);
        if (!el)
            return;
        el.innerHTML = '<option value="">Selecione...</option>';
        items.forEach((i) => {
            el.innerHTML += `<option value="${i[valueKey]}">${i[labelKey]}</option>`;
        });
    }
    // Modal Logic
    window.openSaleModal = () => initModal('purchase', 'Registrar Compra', 'Fornecedor', g_suppliers, 'bg-brand-600', 'hover:bg-brand-700', 'focus:ring-brand-500');
    function initModal(type, title, entityLabel, entityData, btnBg, btnHover, btnFocus) {
        const orderType = getEl('orderType');
        if (orderType)
            orderType.value = type;
        const modalTitle = getEl('modalTitle');
        if (modalTitle)
            modalTitle.textContent = title;
        const label = getEl('entityLabel');
        if (label)
            label.textContent = entityLabel;
        const saveBtn = getEl('saveBtn');
        if (saveBtn) {
            saveBtn.className = `w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${btnBg} ${btnHover} ${btnFocus}`;
        }
        populateSelect('entitySelect', entityData, 'name', 'public_id');
        const relevantCategories = g_categories.filter((c) => c.type === (type === 'purchase' ? 'income' : 'expense'));
        populateSelect('categorySelect', relevantCategories, 'name', 'public_id');
        // Resetar combobox de busca de produto
        const _pSearchInput = getEl('productSearchInput');
        if (_pSearchInput)
            _pSearchInput.value = '';
        const _pClearBtn = getEl('productSearchClear');
        if (_pClearBtn)
            _pClearBtn.classList.add('hidden');
        const _pHidden = getEl('productSelect');
        if (_pHidden)
            _pHidden.value = '';
        const _pDropdown = getEl('productDropdown');
        if (_pDropdown)
            _pDropdown.classList.add('hidden');
        g_cart = [];
        renderCart();
        getEl('orderForm')?.reset();
        getEl('orderModal')?.classList.remove('hidden');
    }
    window.closeModal = () => {
        getEl('orderModal')?.classList.add('hidden');
    };
    // Cart Logic
    getEl('addItemBtn')?.addEventListener('click', () => {
        const pSelect = getEl('productSelect');
        const pQty = getEl('productQty');
        const pPrice = getEl('productPrice');
        if (!pSelect?.value)
            return void alert('Selecione um produto.');
        if (!pPrice?.value)
            return void alert('Informe o preço unitário de compra.');
        const product = g_products.find((p) => p.public_id === pSelect.value);
        const qty = parseInt(pQty?.value || '0', 10);
        const unitPrice = parseFloat(pPrice.value);
        if (!product)
            return;
        const existingIndex = g_cart.findIndex((i) => i.product_public_id === product.public_id);
        if (existingIndex > -1) {
            g_cart[existingIndex].quantity += qty;
            g_cart[existingIndex].unit_price = unitPrice;
        }
        else {
            g_cart.push({
                product_public_id: product.public_id,
                name: product.name,
                quantity: qty,
                unit_price: unitPrice,
            });
        }
        renderCart();
        pSelect.value = '';
        if (pQty)
            pQty.value = '1';
        if (pPrice)
            pPrice.value = '';
        const _si = getEl('productSearchInput');
        if (_si)
            _si.value = '';
        const _cb = getEl('productSearchClear');
        if (_cb)
            _cb.classList.add('hidden');
    });
    // Product Search Combobox
    function initProductSearch() {
        const searchInput = getEl('productSearchInput');
        const hiddenInput = getEl('productSelect');
        const dropdown = getEl('productDropdown');
        const clearBtn = getEl('productSearchClear');
        if (!searchInput || !dropdown)
            return;
        function normalizeStr(s) {
            return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }
        function buildDropdown(items) {
            if (items.length === 0) {
                dropdown.innerHTML = '<li class="px-3 py-2.5 text-xs text-gray-400 dark:text-gray-500 text-center">Nenhum produto encontrado.</li>';
            }
            else {
                dropdown.innerHTML = items.slice(0, 60).map((p) => `
          <li class="px-3 py-2 cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-900/20 border-b border-gray-100 dark:border-slate-700/50 last:border-0"
              data-value="${p.public_id}" data-label="${p.name.replace(/"/g, '&quot;')}">
            <div class="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">${p.name}</div>
            <div class="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-0.5 flex flex-wrap gap-x-2">
              ${p.sku ? `<span>SKU: ${p.sku}</span>` : ''}
              ${p.ean ? `<span>EAN: ${p.ean}</span>` : ''}
              ${p.external_code ? `<span>Cód: ${p.external_code}</span>` : ''}
            </div>
          </li>
        `).join('');
            }
            dropdown.classList.remove('hidden');
        }
        function hideDropdown() {
            dropdown.classList.add('hidden');
        }
        function selectProduct(publicId, label) {
            if (hiddenInput)
                hiddenInput.value = publicId;
            if (searchInput)
                searchInput.value = label;
            if (clearBtn)
                clearBtn.classList.remove('hidden');
            hideDropdown();
        }
        searchInput.addEventListener('input', () => {
            const term = normalizeStr(searchInput.value);
            if (!term) {
                if (clearBtn)
                    clearBtn.classList.add('hidden');
                if (hiddenInput)
                    hiddenInput.value = '';
                hideDropdown();
                return;
            }
            if (clearBtn)
                clearBtn.classList.remove('hidden');
            if (hiddenInput)
                hiddenInput.value = '';
            const filtered = g_products.filter((p) => normalizeStr(p.name).includes(term)
                || (p.ean && normalizeStr(p.ean).includes(term))
                || (p.sku && normalizeStr(p.sku).includes(term))
                || (p.external_code && normalizeStr(p.external_code).includes(term)));
            buildDropdown(filtered);
        });
        searchInput.addEventListener('focus', () => {
            if (!searchInput.value)
                buildDropdown(g_products);
            else
                dropdown.classList.remove('hidden');
        });
        dropdown.addEventListener('mousedown', (e) => {
            const li = e.target.closest('li[data-value]');
            if (li)
                selectProduct(li.dataset['value'] || '', li.dataset['label'] || '');
        });
        clearBtn?.addEventListener('click', () => {
            if (hiddenInput)
                hiddenInput.value = '';
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
            }
            if (clearBtn)
                clearBtn.classList.add('hidden');
            hideDropdown();
        });
        document.addEventListener('click', (e) => {
            const wrapper = getEl('productSelectWrapper');
            if (wrapper && !wrapper.contains(e.target))
                hideDropdown();
        });
    }
    window.removeCartItem = (index) => {
        g_cart.splice(index, 1);
        renderCart();
    };
    function renderCart() {
        const list = getEl('cartItems');
        const totalEl = getEl('cartTotal');
        if (!list || !totalEl)
            return;
        if (g_cart.length === 0) {
            list.innerHTML =
                '<li class="py-2 text-center text-xs text-gray-500 dark:text-gray-400">O carrinho está vazio.</li>';
            totalEl.textContent = 'R$ 0,00';
            return;
        }
        let total = 0;
        list.innerHTML = g_cart
            .map((item, index) => {
            const itemTotal = item.quantity * item.unit_price;
            total += itemTotal;
            return `
            <li class="py-2 flex justify-between items-center text-sm">
                <div class="text-gray-900 dark:text-gray-100">
                    <span class="font-bold text-gray-800 dark:text-gray-300 mr-1">${item.quantity}x</span>${item.name}
                </div>
                <div class="flex items-center space-x-3">
                    <span class="text-gray-600 dark:text-gray-400 font-medium">${formatCurrency(itemTotal)}</span>
                    <button type="button" class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-bold btn-remove-item" data-index="${index}">&times;</button>
                </div>
            </li>
        `;
        })
            .join('');
        totalEl.textContent = formatCurrency(total);
    }
    // Form Submit
    getEl('orderForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (g_cart.length === 0)
            return void alert('O carrinho não pode estar vazio.');
        const saveBtn = getEl('saveBtn');
        const payload = {
            supplier_public_id: getEl('entitySelect')?.value,
            bank_account_public_id: getEl('bankSelect')?.value,
            category_public_id: getEl('categorySelect')?.value,
            date: DateUtilsRef.getTodayDateInputValue(),
            items: g_cart.map((i) => ({
                product_public_id: i.product_public_id,
                quantity: i.quantity,
                unit_price: parseFloat(i.unit_price),
            })),
        };
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Processando...';
        }
        try {
            await api('/purchases', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            UI.showAlert('alertMessage', 'Compra finalizada com sucesso! Estoque e Conta Bancária atualizados.', 'success');
            window.closeModal();
            void fetchPurchases();
        }
        catch (error) {
            alert(error?.message || 'Erro ao processar compra.');
        }
        finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Finalizar Compra';
            }
        }
    });
    // View Details
    window.openViewModal = async (id) => {
        try {
            const res = await api('/purchases/' + id);
            const p = res.data;
            currentViewId = id;
            const supplierEl = getEl('viewSupplier');
            const dateEl = getEl('viewDate');
            const totalEl = getEl('viewTotal');
            if (supplierEl)
                supplierEl.textContent = p.supplier_name;
            if (dateEl)
                dateEl.textContent = DateUtilsRef.formatDate(p.date);
            if (totalEl)
                totalEl.textContent = formatCurrency(p.total_amount);
            const statusEl = getEl('viewModalStatus');
            const btnCancel = getEl('btnCancelPurchase');
            if (p.status === 'completed') {
                if (statusEl) {
                    statusEl.className =
                        'px-3 py-1 text-sm rounded-full font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300';
                    statusEl.textContent = 'Concluída';
                }
                if (btnCancel)
                    btnCancel.style.display = 'inline-flex';
            }
            else {
                if (statusEl) {
                    statusEl.className =
                        'px-3 py-1 text-sm rounded-full font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
                    statusEl.textContent = 'Cancelada';
                }
                if (btnCancel)
                    btnCancel.style.display = 'none';
            }
            const itemsList = getEl('viewItemsList');
            if (itemsList) {
                itemsList.innerHTML = (p.items || [])
                    .map((i) => `
            <li class="py-2 flex justify-between text-sm">
                <div class="text-gray-900 dark:text-gray-100">
                    <span class="font-bold text-gray-800 dark:text-gray-300 mr-1">${i.quantity}x</span>${i.product_name}
                    <span class="text-xs text-gray-500 dark:text-gray-400 ml-1">(${formatCurrency(i.unit_price)} un)</span>
                </div>
                <div class="text-gray-600 dark:text-gray-400 font-medium">${formatCurrency(parseFloat(i.total_price))}</div>
            </li>
        `)
                    .join('');
            }
            getEl('viewOrderModal')?.classList.remove('hidden');
        }
        catch (e) {
            alert(e?.message || 'Erro ao abrir detalhes.');
        }
    };
    window.closeViewModal = () => {
        getEl('viewOrderModal')?.classList.add('hidden');
    };
    window.cancelPurchase = async () => {
        if (!confirm('ATENÇÃO! Esta ação é irreversível.\nDeseja cancelar esta compra? O valor será estornado na sua conta bancária e as quantidades removidas do estoque atual.'))
            return;
        try {
            await api('/purchases/' + currentViewId, { method: 'DELETE' });
            UI.showAlert('alertMessage', 'Compra cancelada com sucesso. Financeiro e Estoque revertidos.', 'success');
            window.closeViewModal();
            void fetchPurchases();
        }
        catch (e) {
            alert(e?.message || 'Erro ao cancelar compra.');
        }
    };
    window.duplicatePurchase = async (id) => {
        try {
            const res = await api('/purchases/' + id);
            const p = res.data;
            window.openSaleModal();
            const modalTitle = getEl('modalTitle');
            if (modalTitle)
                modalTitle.textContent = 'Duplicar Compra';
            const supplier = g_suppliers.find((s) => s.name === p.supplier_name);
            if (supplier) {
                const entitySelect = getEl('entitySelect');
                if (entitySelect)
                    entitySelect.value = supplier.public_id;
            }
            g_cart = (p.items || []).map((i) => {
                const prod = g_products.find((pr) => pr.name === i.product_name || pr.id === i.product_id);
                return {
                    product_public_id: prod ? prod.public_id : '',
                    name: i.product_name,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                };
            });
            renderCart();
        }
        catch (e) {
            alert(e?.message || 'Erro ao duplicar compra.');
        }
    };
})();
