(() => {
    const api = window.api;
    // Lógica do POS / Restaurante
    let products = [];
    let categories = [];
    let currentCategory = null;
    let cart = [];
    let orderNumber = '';
    let observation = '';
    let openComandas = []; // Array of open order numbers
    document.addEventListener('DOMContentLoaded', () => {
        // 1. Setup events
        setupMobileCart();
        setupTabs();
        setupCartActions();
        setupOrderObs();
        setupComandaSearch();
        setupCategoriesNav();
        // 2. Load data
        void loadProducts();
    });
    async function loadProducts() {
        try {
            // Assume API tem endpoint /products
            const response = await api('/products');
            if (response && response.data) {
                products = response.data;
            }
        }
        catch (e) {
            console.warn('Erro ao carregar produtos. Usando mock data.', e);
            // Fallback Mock Data if API fails
            products = [
                {
                    id: 1,
                    name: 'X-Burger Especial',
                    description: 'Hambúrguer 180g, queijo, salada',
                    price: 25.9,
                    category_name: 'Lanches',
                    image_url: null,
                },
                { id: 2, name: 'Coca-Cola Lata', description: '350ml', price: 5.0, category_name: 'Bebidas', image_url: null },
                { id: 3, name: 'Batata Frita', description: 'Porção 400g', price: 15.0, category_name: 'Porções', image_url: null },
                { id: 4, name: 'Pudim', description: 'Fatia', price: 12.0, category_name: 'Sobremesas', image_url: null },
                {
                    id: 5,
                    name: 'Pizza Calabresa',
                    description: 'Média - 8 fatias',
                    price: 45.0,
                    category_name: 'Pizzas',
                    image_url: null,
                },
            ];
        }
        extractCategories();
        renderCategories();
        renderProducts();
    }
    function extractCategories() {
        const cats = new Set();
        products.forEach((p) => {
            if (p.category_name)
                cats.add(p.category_name);
            else
                cats.add('Diversos');
        });
        categories = Array.from(cats);
    }
    function renderCategories() {
        const container = document.getElementById('categoriesContainer');
        if (!container)
            return;
        container.innerHTML = '';
        categories.forEach((cat) => {
            const isActive = cat === currentCategory;
            const btn = document.createElement('button');
            btn.className = `cat-btn w-full bg-white dark:bg-slate-800 border ${isActive
                ? 'border-brand-500 ring-2 ring-brand-500/20'
                : 'border-gray-200 dark:border-slate-700'} shadow-sm rounded-xl p-4 flex flex-col items-center justify-center gap-3 hover:border-brand-400 hover:shadow-md transition-all group`;
            btn.dataset.cat = cat;
            let icon = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>';
            if (cat.toLowerCase().includes('bebida')) {
                icon =
                    '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"></path></svg>';
            }
            btn.innerHTML = `
            <div class="h-12 w-12 rounded-full bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center text-gray-400 dark:text-gray-500 group-hover:text-brand-500 group-hover:bg-brand-50 dark:group-hover:bg-brand-900/40 transition-colors">
                ${icon}
            </div>
            <span class="font-bold text-gray-800 dark:text-gray-200 text-center text-sm leading-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">${cat}</span>
        `;
            btn.addEventListener('click', () => {
                // Update UI state
                document.querySelectorAll('.cat-btn').forEach((b) => {
                    b.classList.remove('border-brand-500', 'ring-2', 'ring-brand-500/20');
                    b.classList.add('border-gray-200', 'dark:border-slate-700');
                });
                btn.classList.add('border-brand-500', 'ring-2', 'ring-brand-500/20');
                btn.classList.remove('border-gray-200', 'dark:border-slate-700');
                currentCategory = cat;
                const currentCategoryTitle = document.getElementById('currentCategoryTitle');
                if (currentCategoryTitle)
                    currentCategoryTitle.textContent = cat;
                renderProducts();
                // Switch view
                const catSection = document.getElementById('categoriesGridSection');
                const prodSection = document.getElementById('productsGridSection');
                if (catSection && prodSection) {
                    catSection.classList.add('hidden');
                    prodSection.classList.remove('hidden');
                    prodSection.classList.add('flex');
                }
            });
            container.appendChild(btn);
        });
    }
    function renderProducts(searchQuery = '') {
        const container = document.getElementById('productsContainer');
        if (!container)
            return;
        container.innerHTML = '';
        let filtered = [];
        const currentCategoryTitle = document.getElementById('currentCategoryTitle');
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = products.filter((p) => (p.name && p.name.toLowerCase().includes(q)) ||
                (p.description && String(p.description).toLowerCase().includes(q)) ||
                (p.barcode && String(p.barcode).includes(q)));
            if (currentCategoryTitle)
                currentCategoryTitle.textContent = `Busca: "${searchQuery}"`;
        }
        else {
            if (currentCategory) {
                filtered = products.filter((p) => (p.category_name || 'Diversos') === currentCategory);
                if (currentCategoryTitle) {
                    currentCategoryTitle.textContent = currentCategory;
                    currentCategoryTitle.classList.remove('hidden');
                }
            }
            else {
                if (currentCategoryTitle)
                    currentCategoryTitle.classList.add('hidden');
            }
        }
        // Always render command cards
        renderComandas();
        if (filtered.length === 0) {
            if (currentCategory || searchQuery) {
                container.innerHTML = '<div class="col-span-full py-10 text-center text-gray-400">Nenhum produto encontrado.</div>';
            }
            return;
        }
        filtered.forEach((p) => {
            const price = Number(p.price || p.sale_price || 0)
                .toFixed(2)
                .replace('.', ',');
            const card = document.createElement('div');
            card.className =
                'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-row items-center transform hover:-translate-y-1 h-24 sm:h-28';
            card.onclick = () => addToCart(p);
            let imgHtml = `
            <div class="h-full w-24 sm:w-28 bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-300 dark:text-gray-600 border-r border-gray-100 dark:border-slate-700 shrink-0">
               <svg class="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            </div>`;
            if (p.image_url) {
                imgHtml = `
            <div class="h-full w-24 sm:w-28 relative shrink-0 border-r border-gray-100 dark:border-slate-700">
                <img src="${p.image_url}" alt="${p.name}" class="w-full h-full object-cover">
            </div>`;
            }
            card.innerHTML = `
            ${imgHtml}
            <div class="p-3 sm:p-4 flex flex-col flex-1 h-full min-w-0 justify-between">
                <div>
                    <h4 class="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 truncate mb-0.5">${p.name}</h4>
                    <p class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 line-clamp-1 sm:line-clamp-2">${p.description || ''}</p>
                </div>
                <div class="flex justify-between items-center mt-1">
                    <span class="text-sm sm:text-base font-bold text-brand-600 dark:text-brand-400">R$ ${price}</span>
                    <button class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 flex items-center justify-center hover:bg-brand-200 dark:hover:bg-brand-800 transition-colors pointer-events-none shrink-0">
                        <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                    </button>
                </div>
            </div>
        `;
            container.appendChild(card);
        });
    }
    // CART LOGIC
    function addToCart(product) {
        const existing = cart.find((i) => i.id === product.id);
        if (existing) {
            existing.qtd += 1;
        }
        else {
            cart.push({
                id: product.id,
                name: product.name,
                price: Number(product.price || product.sale_price || 0),
                qtd: 1,
                obs: '',
            });
        }
        updateCartUI();
        // Feedback visual subtle
        const badge = document.getElementById('mobileCartCount');
        if (badge) {
            badge.classList.add('scale-125');
            setTimeout(() => badge.classList.remove('scale-125'), 200);
        }
    }
    function updateCartItemQtd(id, delta) {
        const item = cart.find((i) => i.id === id);
        if (!item)
            return;
        item.qtd += delta;
        if (item.qtd <= 0) {
            cart = cart.filter((i) => i.id !== id);
        }
        updateCartUI();
    }
    function removeFromCart(id) {
        cart = cart.filter((i) => i.id !== id);
        updateCartUI();
    }
    // Expose functions used in inline onclick handlers
    window.updateCartItemQtd = updateCartItemQtd;
    window.removeFromCart = removeFromCart;
    function clearCart() {
        if (cart.length > 0 && confirm('Limpar comanda atual?')) {
            cart = [];
            updateCartUI();
        }
    }
    function updateCartUI() {
        const container = document.getElementById('cartItemsContainer');
        const emptyState = document.getElementById('emptyCartState');
        const subtotalEl = document.getElementById('cartSubtotal');
        const totalEl = document.getElementById('cartTotal');
        const btnCheckout = document.getElementById('checkoutBtn');
        // Badges
        const totalItems = cart.reduce((acc, i) => acc + i.qtd, 0);
        const mobileCartCount = document.getElementById('mobileCartCount');
        if (mobileCartCount)
            mobileCartCount.textContent = String(totalItems);
        const cartBadge = document.getElementById('cartBadge');
        if (cartBadge)
            cartBadge.textContent = `${totalItems} itens`;
        const cartSideBadge = document.getElementById('cartSideBadge');
        if (cartSideBadge)
            cartSideBadge.textContent = `${totalItems} itens`;
        // Clear Container except empty state
        if (container) {
            Array.from(container.children).forEach((child) => {
                if (child.id !== 'emptyCartState') {
                    child.remove();
                }
            });
        }
        if (cart.length === 0) {
            if (emptyState) {
                emptyState.classList.remove('hidden');
                emptyState.classList.add('flex');
            }
            if (subtotalEl)
                subtotalEl.textContent = 'R$ 0,00';
            if (totalEl)
                totalEl.textContent = 'R$ 0,00';
            if (btnCheckout)
                btnCheckout.disabled = true;
            const clearBtn = document.getElementById('clearCartBtn');
            if (clearBtn)
                clearBtn.classList.add('hidden');
            return;
        }
        if (emptyState) {
            emptyState.classList.add('hidden');
            emptyState.classList.remove('flex');
        }
        const clearBtn = document.getElementById('clearCartBtn');
        if (clearBtn)
            clearBtn.classList.remove('hidden');
        if (btnCheckout)
            btnCheckout.disabled = false;
        let subtotal = 0;
        cart.forEach((item) => {
            const itemTotal = item.qtd * item.price;
            subtotal += itemTotal;
            const el = document.createElement('div');
            el.className =
                'px-4 py-3 border-b border-gray-100 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors group';
            el.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200">${item.name}</h4>
                <span class="text-sm font-bold text-gray-900 dark:text-gray-100">R$ ${itemTotal
                .toFixed(2)
                .replace('.', ',')}</span>
            </div>
            ${item.obs ? `<div class="text-xs text-orange-500 dark:text-orange-400 mb-2 italic">Ref: ${item.obs}</div>` : ''}
            <div class="flex justify-between items-center">
                <div class="flex items-center border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                    <button class="px-2.5 py-1 text-gray-500 hover:text-red-500 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors" onclick="updateCartItemQtd(${item.id}, -1)">-</button>
                    <span class="px-3 py-1 font-medium text-sm text-gray-700 dark:text-gray-300 border-x border-gray-200 dark:border-slate-600">${item.qtd}</span>
                    <button class="px-2.5 py-1 text-gray-500 hover:text-green-500 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors" onclick="updateCartItemQtd(${item.id}, 1)">+</button>
                </div>
                <button class="text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" onclick="removeFromCart(${item.id})">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        `;
            if (container)
                container.appendChild(el);
        });
        if (subtotalEl)
            subtotalEl.textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
        if (totalEl)
            totalEl.textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    }
    function setupMobileCart() {
        const btn = document.getElementById('mobileCartBtn');
        const sidebar = document.getElementById('cartSidebar');
        const closeBtn = document.getElementById('closeCartBtn');
        if (btn && sidebar) {
            btn.addEventListener('click', () => {
                sidebar.classList.add('open-mobile');
            });
        }
        if (closeBtn && sidebar) {
            closeBtn.addEventListener('click', () => {
                sidebar.classList.remove('open-mobile');
            });
        }
    }
    function setupTabs() {
        const btnProdutos = document.getElementById('tabProdutosBtn');
        const btnComandas = document.getElementById('tabComandasBtn');
        const contentProdutos = document.getElementById('produtosTabContent');
        const contentComandas = document.getElementById('comandasTabContent');
        const activeTabClass = 'pos-tab-btn min-w-0 flex-1 md:flex-none truncate whitespace-nowrap px-3 sm:px-4 py-1.5 text-sm font-medium rounded-md bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-500';
        const inactiveTabClass = 'pos-tab-btn min-w-0 flex-1 md:flex-none truncate whitespace-nowrap px-3 sm:px-4 py-1.5 text-sm font-medium rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-all focus:outline-none focus:ring-2 focus:ring-brand-500';
        if (btnProdutos && btnComandas && contentProdutos && contentComandas) {
            btnProdutos.addEventListener('click', () => {
                // Ativa aba de Produtos
                btnProdutos.className = activeTabClass;
                btnComandas.className = inactiveTabClass;
                contentProdutos.classList.remove('hidden');
                contentProdutos.classList.add('flex');
                contentComandas.classList.add('hidden');
                contentComandas.classList.remove('flex');
                // Sempre que clica em Produtos, mostra Categorias primeiro se desejar
                const catSection = document.getElementById('categoriesGridSection');
                const prodSection = document.getElementById('productsGridSection');
                if (catSection && prodSection) {
                    prodSection.classList.add('hidden');
                    prodSection.classList.remove('flex');
                    catSection.classList.remove('hidden');
                    catSection.classList.add('flex');
                }
            });
            btnComandas.addEventListener('click', () => {
                // Ativa aba de Comandas
                btnComandas.className = activeTabClass;
                btnProdutos.className = inactiveTabClass;
                contentComandas.classList.remove('hidden');
                contentComandas.classList.add('flex');
                contentProdutos.classList.add('hidden');
                contentProdutos.classList.remove('flex');
                // Renderiza as comandas abertas ao trocar para a aba
                renderComandas();
            });
        }
    }
    function setupCategoriesNav() {
        const backBtn = document.getElementById('backToCategoriesBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                const catSection = document.getElementById('categoriesGridSection');
                const prodSection = document.getElementById('productsGridSection');
                if (catSection && prodSection) {
                    prodSection.classList.add('hidden');
                    prodSection.classList.remove('flex');
                    catSection.classList.remove('hidden');
                    catSection.classList.add('flex');
                }
            });
        }
    }
    function renderComandas() {
        const container = document.getElementById('openComandasContainer');
        const emptyState = document.getElementById('emptyComandasState');
        if (!container || !emptyState)
            return;
        if (openComandas.length === 0) {
            emptyState.classList.remove('hidden');
            emptyState.classList.add('flex');
            container.innerHTML = '';
            return;
        }
        emptyState.classList.add('hidden');
        emptyState.classList.remove('flex');
        container.innerHTML = '';
        openComandas.forEach((comanda) => {
            const card = document.createElement('div');
            card.className =
                'bg-white dark:bg-slate-800 border-2 border-brand-500 rounded-xl p-4 shadow-sm w-36 cursor-pointer flex flex-col items-center justify-center hover:bg-brand-50 dark:hover:bg-slate-700 transition-colors transform hover:-translate-y-1 relative group';
            card.innerHTML = `
            <button class="absolute top-2 right-2 text-gray-400 hover:text-red-500 hidden group-hover:block transition-colors p-1" title="Encerrar/Remover Comanda">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <svg class="w-8 h-8 text-brand-600 dark:text-brand-400 mb-2 mt-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
            <span class="font-bold text-gray-800 dark:text-gray-100">#${comanda}</span>
        `;
            // Remove button logic
            const removeBtn = card.querySelector('button');
            if (removeBtn) {
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Previne abrir o painel lateral
                    if (confirm(`Tem certeza que deseja fechar a Mesa/Comanda #${comanda}?`)) {
                        openComandas = openComandas.filter((c) => c !== comanda);
                        // Fechar o sidebar se essa era a comanda ativa no carrinho
                        const numEl = document.getElementById('orderNumberInput');
                        if (numEl && numEl.value === comanda) {
                            numEl.value = '';
                            setTimeout(() => clearCart(), 0);
                        }
                        renderComandas();
                    }
                });
            }
            card.addEventListener('click', () => {
                const numEl = document.getElementById('orderNumberInput');
                if (numEl)
                    numEl.value = comanda;
                // Toggle desktop cart sidebar se estiver no mobile ou para abrir carrinho
                const posGrid = document.querySelector('.pos-grid');
                if (posGrid) {
                    posGrid.classList.toggle('cart-hidden');
                }
            });
            container.appendChild(card);
        });
    }
    function setupComandaSearch() {
        const btn = document.getElementById('searchComandaBtn');
        const input = document.getElementById('orderNumberInput');
        if (btn && input) {
            btn.addEventListener('click', () => {
                const val = input.value.trim().toUpperCase();
                if (!val) {
                    alert('Por favor, digite uma Mesa ou Comanda válida.');
                    input.focus();
                    return;
                }
                if (openComandas.includes(val)) {
                    alert(`A Mesa/Comanda #${val} já foi criada e está aberta!`);
                    return;
                }
                openComandas.push(val);
                input.value = '';
                // Re-render
                renderComandas();
            });
            // Allow pressing Enter on the input
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    btn.click();
                }
            });
        }
    }
    function setupCartActions() {
        const btnClear = document.getElementById('clearCartBtn');
        if (btnClear)
            btnClear.addEventListener('click', clearCart);
        const checkoutBtn = document.getElementById('checkoutBtn');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', async () => {
                if (cart.length === 0)
                    return;
                const numEl = document.getElementById('orderNumberInput');
                orderNumber = (numEl?.value || '').trim();
                if (!orderNumber) {
                    alert('Por favor, informe a Mesa ou o número da Comanda.');
                    numEl?.focus();
                    return;
                }
                // Generate Sale payload
                const payload = {
                    customer_id: null,
                    total_amount: cart.reduce((acc, i) => acc + i.price * i.qtd, 0),
                    installments: 1,
                    payment_method: 'DINHEIRO',
                    items: cart.map((i) => ({
                        product_id: i.id,
                        quantity: i.qtd,
                        unit_price: i.price,
                        discount: 0,
                    })),
                    observation: observation + ` | Mesa/Comanda: ${orderNumber}`,
                };
                try {
                    checkoutBtn.disabled = true;
                    checkoutBtn.textContent = 'Enviando...';
                    // POST /api/v1/sales
                    await api('/sales', {
                        method: 'POST',
                        body: JSON.stringify(payload),
                    });
                    alert('Pedido/Comanda enviado com sucesso!');
                    // Finalizar / Fechar a Comanda
                    const upperOrder = orderNumber.toUpperCase();
                    const index = openComandas.indexOf(upperOrder);
                    if (index > -1) {
                        openComandas.splice(index, 1);
                        if (!currentCategory) {
                            renderComandas();
                        }
                    }
                    cart = [];
                    observation = '';
                    if (numEl)
                        numEl.value = '';
                    updateCartUI();
                    const sidebar = document.getElementById('cartSidebar');
                    if (sidebar)
                        sidebar.classList.remove('open-mobile');
                }
                catch (error) {
                    alert('Erro ao enviar pedido: ' + (error?.message || String(error)));
                }
                finally {
                    checkoutBtn.disabled = false;
                    checkoutBtn.innerHTML = `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Enviar Pedido
                `;
                }
            });
        }
    }
    function setupOrderObs() {
        const modal = document.getElementById('obsModal');
        const openBtn = document.getElementById('addObservationBtn');
        const cancelBtn = document.getElementById('cancelObsBtn');
        const saveBtn = document.getElementById('saveObsBtn');
        const backdrop = document.getElementById('obsModalBackdrop');
        const input = document.getElementById('orderObs');
        if (!modal || !input)
            return;
        const closeModal = () => modal.classList.add('hidden');
        const openModal = () => {
            input.value = observation;
            modal.classList.remove('hidden');
            input.focus();
        };
        if (openBtn)
            openBtn.addEventListener('click', openModal);
        if (cancelBtn)
            cancelBtn.addEventListener('click', closeModal);
        if (backdrop)
            backdrop.addEventListener('click', closeModal);
        if (saveBtn && openBtn) {
            saveBtn.addEventListener('click', () => {
                observation = input.value.trim();
                closeModal();
                if (observation) {
                    openBtn.classList.add('ring-2', 'ring-orange-500', 'border-transparent');
                    openBtn.innerHTML =
                        '<svg class="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg> Com Observação';
                }
                else {
                    openBtn.classList.remove('ring-2', 'ring-orange-500', 'border-transparent');
                    openBtn.innerHTML =
                        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg> Adicionar Observação';
                }
            });
        }
    }
})();
