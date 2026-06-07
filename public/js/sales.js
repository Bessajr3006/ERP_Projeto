(() => {
    /**
     * sales.ts
     * Frente de Caixa (PDV) - KEYSTONE ERP
     * Implementação em Vanilla JS (render string) portada para TS.
     */
    document.addEventListener('DOMContentLoaded', async () => {
        // --- State ---
        const state = {
            loading: true,
            saving: false,
            products: [],
            categories: [],
            customers: [],
            searchQuery: '',
            activeCategory: 'all',
            isCartOpen: false,
            isPaymentModalOpen: false,
            registerId: localStorage.getItem('erp_caixa_id') || '01',
            currentDate: new Date().toLocaleDateString('pt-BR'),
            defaultBankPublicId: null,
            defaultCategoryPublicId: null,
            allowPrintWithoutConfirmation: false,
            cart: [],
            cardQty: {},
            discount: 0,
            saleData: { customerId: '', deliveryAddress: '' },
            payments: { cash: 0, pix: 0, credit: 0, debit: 0, boleto: 0 },
            paymentMethodsList: [
                { id: 'cash', name: 'Dinheiro' },
                { id: 'pix', name: 'PIX' },
                { id: 'credit', name: 'Crédito' },
                { id: 'debit', name: 'Débito' },
                { id: 'boleto', name: 'Boleto' },
            ],
        };
        // --- Helpers ---
        const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
        const getProductPrice = (product) => {
            if (product?.is_promotional && Number(product.promotional_price) > 0) {
                return Number(product.promotional_price);
            }
            return Number(product?.selling_price || 0);
        };
        const hasValidCategory = (product) => {
            if (!product)
                return false;
            const categoryId = product.category_id;
            return categoryId !== null && categoryId !== undefined && String(categoryId).trim() !== '';
        };
        const getCartSubtotal = () => state.cart.reduce((acc, item) => acc + getProductPrice(item.product) * item.quantity, 0);
        const getCartTotal = () => Math.max(0, getCartSubtotal() - state.discount);
        const getTotalPaid = () => Object.values(state.payments).reduce((sum, val) => sum + (Number(val) || 0), 0);
        const getMissingAmount = () => getCartTotal() - getTotalPaid();
        // --- Template Renders ---
        function render() {
            const app = document.getElementById('vue-app');
            if (!app)
                return;
            app.innerHTML = `
            <div class="flex flex-col md:flex-row flex-1 min-h-0 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden relative">
                <!-- Catalog Section -->
                <section class="flex flex-col flex-1 min-h-0 overflow-hidden md:order-first bg-white dark:bg-slate-900 md:border-r border-gray-200 dark:border-slate-700">
                    <div class="shrink-0 px-4 md:px-8 pt-6 pb-0 bg-white dark:bg-slate-800">
                        <div class="flex flex-row items-center justify-between gap-4 mb-4 w-full">
                            <div class="flex-1 w-full max-w-md">
                                <div class="relative flex items-center w-full h-12 rounded-xl bg-gray-50 dark:bg-slate-900/50 overflow-hidden border border-gray-200 dark:border-slate-600 focus-within:ring-2 focus-within:ring-brand-500 shadow-sm">
                                    <div class="grid place-items-center h-full w-12 text-gray-400">
                                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                                    </div>
                                    <input id="searchInput" type="text" value="${state.searchQuery}" placeholder="Buscar código, nome..." class="peer h-full w-full outline-none text-[16px] md:text-sm font-medium text-gray-700 dark:text-gray-300 pr-2 bg-transparent placeholder-gray-400">
                                </div>
                            </div>
                            <div class="shrink-0">
                                <button type="button" id="btnToggleCartMobile" class="flex items-center justify-center px-3.5 h-12 min-w-12 sm:min-w-12 bg-linear-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white rounded-xl border border-brand-500/40 relative transition-all duration-300 active:scale-[0.98] ${state.cart.length > 0
                ? 'shadow-lg ring-2 ring-brand-300/70 animate-pulse'
                : 'shadow-md hover:shadow-lg'}" title="Abrir bolsa de compras" aria-label="Abrir bolsa de compras">
                                    <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14l-1 11H6L5 8zm3 0V6a4 4 0 118 0v2"></path></svg>
                                    ${state.cart.length > 0
                ? `<span class="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1.5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white shadow-sm">${state.cart.reduce((a, b) => a + b.quantity, 0)}</span>`
                : ''}
                                </button>
                            </div>
                        </div>
                        <div class="mt-3 flex items-center gap-2 border-b border-gray-200 dark:border-slate-700">
                          <button type="button" id="btnCategoryPrev" class="mb-2 h-7 w-7 shrink-0 rounded-full border border-gray-200 bg-white/95 text-gray-500 shadow-sm hover:text-brand-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800/95 dark:text-gray-300 dark:hover:text-brand-300 dark:hover:bg-slate-700 transition-colors" title="Categorias anteriores" aria-label="Categorias anteriores">
                            <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                          </button>
                          <div id="categoryScroller" class="min-w-0 flex-1 overflow-x-auto overflow-y-hidden scroll-smooth overscroll-x-contain [&::-webkit-scrollbar]:hidden">
                          <ul class="flex whitespace-nowrap -mb-px px-1 text-[12px] md:text-[13px] font-bold text-center gap-5">
                                <li>
                                    <button type="button" data-cat="all" class="cat-btn inline-block pb-3 px-1.5 border-b-2 transition-colors ${state.activeCategory === 'all'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500'}">Todos</button>
                                </li>
                                ${state.categories
                .map((c) => `
                                    <li class="shrink-0">
                                        <button type="button" data-cat="${c.id}" class="cat-btn inline-block pb-3 px-1.5 border-b-2 transition-colors ${String(state.activeCategory) == String(c.id)
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500'}">${c.name}</button>
                                    </li>
                                `)
                .map((html) => html.trim())
                .join('')}
                            </ul>
                                </div>
                                <button type="button" id="btnCategoryNext" class="mb-2 h-7 w-7 shrink-0 rounded-full border border-gray-200 bg-white/95 text-gray-500 shadow-sm hover:text-brand-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800/95 dark:text-gray-300 dark:hover:text-brand-300 dark:hover:bg-slate-700 transition-colors" title="Próximas categorias" aria-label="Próximas categorias">
                                  <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                                </button>
                        </div>
                    </div>
                    <div id="productGrid" class="flex-1 overflow-y-auto p-4 sm:p-8 bg-gray-50/50 dark:bg-slate-900">
                        ${renderProductGrid()}
                    </div>
                </section>

                ${state.isCartOpen
                ? '<button type="button" id="cartBackdrop" class="absolute inset-0 z-30 bg-slate-900/45 backdrop-blur-[2px] transition-opacity duration-300 ease-out" aria-label="Fechar carrinho"></button>'
                : ''}

                <!-- Cart Section -->
                <section id="cartSidebar" class="${state.isCartOpen
                ? 'translate-x-0 opacity-100'
                : 'translate-x-full opacity-0 pointer-events-none'} absolute inset-y-0 right-0 h-full w-[90%] sm:w-112.5 z-40 bg-white dark:bg-slate-800 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.15)] border-l border-gray-200 dark:border-slate-700 transition-all duration-300 ease-out will-change-transform">
                    <div class="px-6 py-4 border-b border-gray-100 dark:border-slate-700">
                        <div class="flex justify-between items-center mb-3">
                            <h1 class="text-[22px] font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2">
                                <svg class="w-6 h-6 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14l-1 11H6L5 8zm3 0V6a4 4 0 118 0v2"></path></svg>
                                Venda <span class="text-[10px] bg-brand-600 text-white px-2 py-0.5 rounded shadow-sm">Cx. ${state.registerId}</span>
                            </h1>
                            <div class="flex items-center gap-2 lg:gap-3">
                                <span class="text-[14px] font-normal text-gray-400 hidden md:block">${state.currentDate}</span>
                                <button type="button" id="btnCloseCartMobile" class="text-gray-400 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700" title="Fechar bolsa de compras" aria-label="Fechar bolsa de compras"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                            </div>
                        </div>
                    </div>
                    <div id="cartItems" class="flex-1 overflow-y-auto px-4 py-4 bg-gray-50/50 dark:bg-slate-900/50 space-y-3">
                        ${renderCartItems()}
                    </div>
                    <div class="px-6 pt-5 pb-6 bg-white dark:bg-slate-800 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] border-t border-gray-100 dark:border-slate-700">
                        <div class="flex justify-between items-center text-gray-600 mb-2">
                            <span class="text-[15px] font-medium">Subtotal</span><span class="font-semibold">${formatCurrency(getCartSubtotal())}</span>
                        </div>
                        <div class="flex justify-between items-center text-gray-600 mb-4 pb-4 border-b border-gray-100">
                            <div class="flex items-center">
                                <span class="text-[15px] font-medium">Desconto</span>
                                <button type="button" id="btnAddDiscount" class="ml-2 text-[12px] font-semibold text-brand-500 hover:text-brand-700 bg-brand-50 px-2 py-0.5 rounded">+ Add</button>
                            </div>
                            <span id="labelDiscount" class="font-semibold text-red-500 cursor-pointer">${formatCurrency(state.discount)}</span>
                        </div>
                        <div class="flex justify-between items-end mb-6">
                            <span class="text-[22px] font-black text-gray-900 dark:text-white tracking-tight">TOTAL</span>
                            <span class="text-[32px] font-black text-gray-900 dark:text-white tracking-tight">${formatCurrency(getCartTotal())}</span>
                        </div>
                        <div class="flex gap-3 h-16 mt-2">
                            <button type="button" id="btnOpenPayment" class="flex-3 w-full bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.98] text-[20px] flex justify-center items-center">PAGAR AGORA</button>
                            <button type="button" id="btnClearCart" title="Limpar Carrinho" class="flex-none w-16 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl active:scale-[0.95] flex items-center justify-center transition-colors">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            <!-- Modal Pagamento -->
            <div id="paymentModal" class="${state.isPaymentModalOpen ? 'flex' : 'hidden'} fixed inset-0 z-10000 items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
                <div class="bg-white dark:bg-slate-800 rounded-2xl w-[95%] max-w-lg max-h-[90vh] shadow-2xl flex flex-col">
                    <div class="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/50">
                        <h3 class="text-lg font-bold dark:text-white">Pagamento</h3>
                        <button type="button" id="btnClosePayment" class="text-gray-400 p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                    </div>
                    <div class="p-6 space-y-6 flex-1 overflow-y-auto">
                        <div class="space-y-4">
                            <label for="selectCustomer" class="block text-sm font-semibold dark:text-gray-300">Cliente</label>
                            <select id="selectCustomer" class="w-full border p-2 rounded-lg bg-gray-50 dark:bg-slate-900 dark:border-slate-700 dark:text-white">
                                <option value="">Consumidor Final</option>
                                ${state.customers
                .map((c) => `<option value="${c.public_id}" ${state.saleData.customerId === c.public_id ? 'selected' : ''}>${c.trade_name || c.name || ''}</option>`)
                .join('')}
                            </select>
                            <textarea id="deliveryAddress" rows="2" placeholder="Endereço de Entrega (Opcional)" class="w-full border p-2 rounded-lg bg-gray-50 dark:bg-slate-900 dark:border-slate-700 dark:text-white">${state.saleData.deliveryAddress}</textarea>
                        </div>
                        <div class="text-center p-4 bg-brand-50 dark:bg-brand-900/20 rounded-xl border border-brand-100 dark:border-brand-900/30">
                            <p class="text-sm font-medium text-brand-600 dark:text-brand-400 uppercase">Total a Pagar</p>
                            <p class="text-4xl font-black text-brand-800 dark:text-white">${formatCurrency(getCartTotal())}</p>
                        </div>
                        <div class="space-y-3">
                            ${state.paymentMethodsList
                .map((method) => `
                                <div class="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                                    <span class="font-bold dark:text-gray-200">${method.name}</span>
                                    <div class="relative w-48">
                                        <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500 font-bold">R$</div>
                                        <input id="payment-${method.id}" name="payment_${method.id}" type="number" step="0.01" value="${state.payments[method.id] || ''}" data-method="${method.id}" class="payment-input w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-lg text-right font-bold focus:ring-brand-500 dark:text-white">
                                    </div>
                                </div>
                            `)
                .join('')}
                            <div class="flex justify-end gap-2 pt-2">
                                <button type="button" class="btn-fast-cash text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded" data-val="10">+ R$ 10</button>
                                <button type="button" class="btn-fast-cash text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded" data-val="20">+ R$ 20</button>
                                <button type="button" class="btn-fast-cash text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded" data-val="50">+ R$ 50</button>
                                <button type="button" class="btn-fast-cash text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded" data-val="100">+ R$ 100</button>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30 flex flex-col justify-center ${getMissingAmount() <= 0 ? 'opacity-50' : ''}">
                                <p class="text-sm font-semibold text-red-600 uppercase">Falta Pagar</p>
                                <p class="text-2xl font-black text-red-700 dark:text-red-400">${formatCurrency(Math.max(0, getMissingAmount()))}</p>
                            </div>
                            <div class="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-xl border dark:border-slate-700 flex flex-col justify-center ${getMissingAmount() > 0 ? 'opacity-50' : ''}">
                                <p class="text-sm font-semibold text-gray-500 uppercase">Troco</p>
                                <p class="text-2xl font-black dark:text-white">${formatCurrency(Math.max(0, -getMissingAmount()))}</p>
                            </div>
                        </div>
                    </div>
                    <div class="p-6 border-t dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                        <button type="button" id="btnConfirmSale" class="w-full bg-brand-600 hover:bg-brand-700 text-white font-black py-4 px-6 rounded-xl uppercase transition-all disabled:opacity-50">
                            ${state.saving ? 'Processando...' : 'Confirmar Venda'}
                        </button>
                    </div>
                </div>
            </div>
        `;
            attachEventListeners();
        }
        function renderProductGrid() {
            if (state.loading)
                return '<div class="text-center py-8">Carregando catálogo...</div>';
            let filtered = state.products.filter(hasValidCategory);
            if (state.activeCategory !== 'all') {
                filtered = filtered.filter((p) => String(p.category_id) === String(state.activeCategory));
            }
            if (state.searchQuery) {
                const term = state.searchQuery.toLowerCase();
                filtered = filtered.filter((p) => p.name.toLowerCase().includes(term) ||
                    (!!p.sku && p.sku.toLowerCase().includes(term)) ||
                    (!!p.ean && p.ean.toLowerCase() === term));
            }
            if (filtered.length === 0)
                return '<div class="text-center py-8 text-gray-500">Nenhum produto encontrado.</div>';
            return `
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                ${filtered
                .map((p) => `
                    <div data-id="${p.public_id}" class="product-card bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-slate-700 overflow-hidden cursor-pointer hover:shadow-md hover:border-brand-300 transition-all group p-3 sm:p-4 flex flex-col h-full">
                        <div class="w-full aspect-4/3 bg-gray-100 dark:bg-slate-700 rounded-lg flex items-center justify-center mb-3 sm:mb-4 relative overflow-hidden group-hover:bg-brand-50 dark:group-hover:bg-brand-900/20 transition-colors p-2">
                            ${(() => {
                const imgSrc = p.image_base64
                    ? (String(p.image_base64).startsWith('data:') ? p.image_base64 : `data:image/jpeg;base64,${p.image_base64}`)
                    : (p.image_url || '');
                return imgSrc
                    ? `<img src="${imgSrc}" class="w-full h-full object-contain" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
                                   <svg style="display:none" class="w-10 h-10 text-gray-300 group-hover:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`
                    : `<svg class="w-10 h-10 text-gray-300 group-hover:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`;
            })()}
                        </div>
                        <h4 class="font-medium text-[14px] sm:text-[16px] text-gray-800 dark:text-gray-200 leading-tight mb-2 line-clamp-2 mt-auto">${p.name}</h4>
                        <div class="flex flex-col justify-end mt-1">
                            <span class="text-[16px] sm:text-[18px] font-bold text-gray-900 dark:text-white">${formatCurrency(getProductPrice(p))}</span>
                            ${p.ean
                ? `<div class="mt-1 flex items-center gap-1 text-[11px] text-gray-400 font-mono"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a2 2 0 002 2z"></path></svg>${p.ean}</div>`
                : ''}
                        </div>
                        <div class="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between gap-2">
                            <div class="flex items-center select-none rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700">
                                <button type="button" class="card-qty-minus w-8 h-8 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 text-lg font-bold leading-none" data-id="${p.public_id}">−</button>
                                <span class="card-qty-display w-7 text-center text-sm font-bold text-gray-800 dark:text-white pointer-events-none" data-id="${p.public_id}">${state.cardQty[p.public_id] || 0}</span>
                                <button type="button" class="card-qty-plus w-8 h-8 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 text-lg font-bold leading-none" data-id="${p.public_id}">+</button>
                            </div>
                            <button type="button" class="card-add-btn flex-1 h-8 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white text-xs font-bold rounded-lg transition-all relative" data-id="${p.public_id}">
                                Adicionar
                                ${state.cardQty[p.public_id] > 0 ? `<span class="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center border-2 border-white">${state.cardQty[p.public_id]}</span>` : ''}
                            </button>
                        </div>
                    </div>
                `)
                .join('')}
            </div>
        `;
        }
        function renderCartItems() {
            if (state.cart.length === 0) {
                return `
                <div class="h-full flex flex-col items-center justify-center text-gray-400 space-y-3">
                    <svg class="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                    <p class="text-sm">O carrinho está vazio</p>
                </div>
            `;
            }
            return state.cart
                .map((item, idx) => `
            <div class="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-gray-100 dark:border-slate-700 relative group flex gap-3">
                <div class="w-12 h-12 rounded bg-gray-50 dark:bg-slate-700 overflow-hidden flex shrink-0">
                    ${(() => {
                const imgSrc = item.product.image_base64
                    ? (String(item.product.image_base64).startsWith('data:') ? item.product.image_base64 : `data:image/jpeg;base64,${item.product.image_base64}`)
                    : (item.product.image_url || '');
                return imgSrc ? `<img src="${imgSrc}" class="object-cover w-full h-full" onerror="this.style.display='none'">` : '';
            })()}
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="text-[13px] font-bold text-gray-800 dark:text-gray-200 line-clamp-2 leading-tight pr-5">${item.product.name}</h4>
                    <div class="flex justify-between items-center mt-2">
                        <span class="font-bold text-gray-900 dark:text-white text-[14px]">${formatCurrency(getProductPrice(item.product) * item.quantity)}</span>
                        <div class="flex items-center bg-gray-50 dark:bg-slate-900 rounded-lg p-0.5 border border-gray-100 dark:border-slate-700">
                            <button type="button" class="btn-qty-minus w-7 h-7 flex items-center justify-center rounded bg-white dark:bg-slate-800 text-gray-500 hover:text-red-500 shadow-sm" data-idx="${idx}">-</button>
                            <span class="w-8 text-center text-xs font-bold dark:text-white">${item.quantity}</span>
                            <button type="button" class="btn-qty-plus w-7 h-7 flex items-center justify-center rounded bg-white dark:bg-slate-800 text-gray-500 hover:text-green-500 shadow-sm" data-idx="${idx}">+</button>
                        </div>
                    </div>
                </div>
            </div>
        `)
                .join('');
        }
        function attachEventListeners() {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.focus();
                searchInput.addEventListener('input', (e) => {
                    state.searchQuery = e.target.value;
                    const grid = document.getElementById('productGrid');
                    if (grid)
                        grid.innerHTML = renderProductGrid();
                    attachGridListeners();
                });
                searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter')
                        handleBarcodeScan();
                });
            }
            document.getElementById('btnToggleCartMobile')?.addEventListener('click', () => {
                state.isCartOpen = !state.isCartOpen;
                render();
            });
            document.getElementById('btnCloseCartMobile')?.addEventListener('click', () => {
                state.isCartOpen = false;
                render();
            });
            document.getElementById('cartBackdrop')?.addEventListener('click', () => {
                state.isCartOpen = false;
                render();
            });
            document.querySelectorAll('.cat-btn').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    const cat = e.currentTarget?.dataset?.cat;
                    state.activeCategory = cat || 'all';
                    render();
                    scrollActiveCategoryIntoView();
                });
            });
            const categoryScroller = document.getElementById('categoryScroller');
            document.getElementById('btnCategoryPrev')?.addEventListener('click', () => scrollCategories(-1));
            document.getElementById('btnCategoryNext')?.addEventListener('click', () => scrollCategories(1));
            categoryScroller?.addEventListener('wheel', (e) => {
                if (Math.abs(e.deltaY) <= Math.abs(e.deltaX))
                    return;
                e.preventDefault();
                categoryScroller.scrollBy({ left: e.deltaY, behavior: 'smooth' });
            }, { passive: false });
            scrollActiveCategoryIntoView();
            document.getElementById('btnAddDiscount')?.addEventListener('click', askDiscount);
            document.getElementById('labelDiscount')?.addEventListener('click', askDiscount);
            document.getElementById('btnClearCart')?.addEventListener('click', clearCart);
            document.getElementById('btnOpenPayment')?.addEventListener('click', openPaymentModal);
            // Payment Modal Events
            document.getElementById('btnClosePayment')?.addEventListener('click', () => {
                state.isPaymentModalOpen = false;
                render();
            });
            document.getElementById('selectCustomer')?.addEventListener('change', (e) => {
                state.saleData.customerId = e.target.value;
            });
            document.getElementById('deliveryAddress')?.addEventListener('input', (e) => {
                state.saleData.deliveryAddress = e.target.value;
            });
            document.querySelectorAll('.payment-input').forEach((input) => {
                input.addEventListener('input', (e) => {
                    const el = e.target;
                    const method = el.dataset.method;
                    if (!method)
                        return;
                    state.payments[method] = parseFloat(el.value) || 0;
                    render();
                });
            });
            document.querySelectorAll('.btn-fast-cash').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    const valStr = e.currentTarget?.dataset?.val || '0';
                    const val = parseFloat(valStr);
                    state.payments.cash = (Number(state.payments.cash) || 0) + (Number(val) || 0);
                    render();
                });
            });
            document.getElementById('btnConfirmSale')?.addEventListener('click', confirmSale);
            attachGridListeners();
            attachCartListeners();
        }
        function scrollCategories(direction) {
            const scroller = document.getElementById('categoryScroller');
            if (!scroller)
                return;
            scroller.scrollBy({ left: direction * Math.max(180, scroller.clientWidth * 0.7), behavior: 'smooth' });
        }
        function scrollActiveCategoryIntoView() {
            window.requestAnimationFrame(() => {
                const scroller = document.getElementById('categoryScroller');
                const activeButton = document.querySelector('.cat-btn.border-brand-600');
                if (!scroller || !activeButton)
                    return;
                const scrollerRect = scroller.getBoundingClientRect();
                const buttonRect = activeButton.getBoundingClientRect();
                const offset = buttonRect.left - scrollerRect.left - (scrollerRect.width - buttonRect.width) / 2;
                scroller.scrollBy({ left: offset, behavior: 'smooth' });
            });
        }
        function attachGridListeners() {
            document.querySelectorAll('.product-card').forEach((card) => {
                card.addEventListener('click', (e) => {
                    // Não adicionar ao clicar nos controles de quantidade
                    if (e.target.closest('.card-qty-minus, .card-qty-plus, .card-add-btn'))
                        return;
                    const id = card.dataset.id;
                    const p = state.products.find((x) => x.public_id === id);
                    if (p)
                        addToCart(p, state.cardQty[p.public_id] || 1);
                });
            });
            document.querySelectorAll('.card-qty-minus').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    state.cardQty[id] = Math.max(0, (state.cardQty[id] || 0) - 1);
                    const grid = document.getElementById('productGrid');
                    if (grid) grid.innerHTML = renderProductGrid();
                    attachGridListeners();
                });
            });
            document.querySelectorAll('.card-qty-plus').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    state.cardQty[id] = (state.cardQty[id] || 0) + 1;
                    const grid = document.getElementById('productGrid');
                    if (grid) grid.innerHTML = renderProductGrid();
                    attachGridListeners();
                });
            });
            document.querySelectorAll('.card-add-btn').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    const p = state.products.find((x) => x.public_id === id);
                    if (p) {
                        const qty = state.cardQty[id] || 1;
                        addToCart(p, qty);
                    }
                });
            });
        }
        function attachCartListeners() {
            document.querySelectorAll('.btn-qty-minus').forEach((btn) => {
                btn.addEventListener('click', () => updateQty(parseInt(btn.dataset.idx || '0', 10), -1));
            });
            document.querySelectorAll('.btn-qty-plus').forEach((btn) => {
                btn.addEventListener('click', () => updateQty(parseInt(btn.dataset.idx || '0', 10), 1));
            });
        }
        // --- Actions ---
        function addToCart(product, qty = 1) {
            const existing = state.cart.find((c) => c.product.public_id === product.public_id);
            if (existing) {
                existing.quantity += qty;
            }
            else {
                state.cart.push({ product, quantity: qty });
            }
            state.cardQty[product.public_id] = 0;
            render();
        }
        function updateQty(idx, delta) {
            const item = state.cart[idx];
            if (!item)
                return;
            item.quantity += delta;
            if (item.quantity <= 0)
                state.cart.splice(idx, 1);
            if (state.discount > getCartSubtotal())
                state.discount = 0;
            render();
        }
        function clearCart() {
            if (state.cart.length === 0)
                return;
            if (confirm('Tem certeza que deseja cancelar esta venda?')) {
                state.cart = [];
                state.discount = 0;
                render();
            }
        }
        function askDiscount() {
            if (state.cart.length === 0)
                return void alert('Adicione produtos antes de aplicar desconto.');
            const val = prompt('Digite o valor do desconto (Ex: 10.50):');
            if (val !== null) {
                const num = parseFloat(val.replace(',', '.'));
                if (!isNaN(num) && num >= 0) {
                    if (num > getCartSubtotal())
                        alert('Desconto inválido!');
                    else {
                        state.discount = num;
                        render();
                    }
                }
            }
        }
        function openPaymentModal() {
            if (state.cart.length === 0)
                return void alert('Carrinho vazio.');
            state.payments = { cash: 0, pix: 0, credit: 0, debit: 0, boleto: 0 };
            state.isPaymentModalOpen = true;
            render();
        }
        function handleBarcodeScan() {
            const term = state.searchQuery.toLowerCase().trim();
            if (!term)
                return;
            const exact = state.products.find((p) => hasValidCategory(p) && ((!!p.ean && p.ean.toLowerCase() === term) || (!!p.sku && p.sku.toLowerCase() === term)));
            if (exact) {
                addToCart(exact);
                state.searchQuery = '';
                render();
            }
        }
        async function confirmSale() {
            if (getMissingAmount() > 0)
                return void alert(`Falta pagar ${formatCurrency(getMissingAmount())}`);
            if (!state.defaultBankPublicId || !state.defaultCategoryPublicId)
                return void alert('Configure o banco/categoria padrão.');
            const payments = state.paymentMethodsList
                .map((m) => ({ method: m.id, amount: Number(state.payments[m.id]) || 0 }))
                .filter((p) => p.amount > 0);
            const payload = {
                customer_public_id: state.saleData.customerId || null,
                delivery_address: state.saleData.deliveryAddress || null,
                bank_account_public_id: state.defaultBankPublicId,
                category_public_id: state.defaultCategoryPublicId,
                date: new Date().toISOString().split('T')[0],
                pos_register: state.registerId,
                discount: state.discount,
                items: state.cart.map((item) => ({
                    product_public_id: item.product.public_id,
                    quantity: item.quantity,
                    unit_price: getProductPrice(item.product),
                })),
                payments: payments,
            };
            state.saving = true;
            render();
            try {
                await api('/sales/sales', { method: 'POST', body: JSON.stringify(payload) });
                alert('Venda realizada com sucesso!');
                state.cart = [];
                state.discount = 0;
                state.isPaymentModalOpen = false;
                state.isCartOpen = false;
            }
            catch (e) {
                alert(e?.message || 'Erro ao processar venda.');
            }
            finally {
                state.saving = false;
                render();
            }
        }
        // --- Init ---
        try {
            const [pRes, cRes, cuRes, bRes, fRes, _aRes] = await Promise.all([
                api('/products'),
                api('/estoque/categories'),
                api('/entities/customers'),
                api('/bank-accounts'),
                api('/finance/categories?type=income'),
                api('/auth/me'),
            ]);
            state.products = pRes.data || [];
            state.categories = cRes.data || [];
            state.customers = cuRes.data || [];
            if (bRes.data?.length > 0)
                state.defaultBankPublicId = bRes.data[0].public_id;
            const salesCat = fRes.data?.find((c) => String(c.name || '').toLowerCase().includes('venda')) || fRes.data?.[0];
            if (salesCat)
                state.defaultCategoryPublicId = salesCat.public_id;
        }
        catch (e) {
            console.error(e);
        }
        state.loading = false;
        render();
    });
})();
