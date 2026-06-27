(() => {
  const api = (window as any).api;

  type Product = {
    public_id: string;
    name: string;
    selling_price: number;
    is_promotional?: boolean;
    promotional_price?: number;
    category_id?: string | number;
    category_name?: string;
    stock_type_name?: string;
    sku?: string;
    ean?: string;
    image_url?: string;
    image_base64?: string;
    description?: string;
  };

  type Company = {
    trade_name?: string;
    company_name?: string;
    phone?: string;
    email?: string;
    logo_url?: string;
    logo_base64?: string;
  };

  type CartItem = {
    product: Product;
    quantity: number;
  };

  type State = {
    loading: boolean;
    company: Company | null;
    products: Product[];
    categories: string[];
    searchQuery: string;
    activeCategory: string;
    isCartOpen: boolean;
    cart: CartItem[];
    cardQty: Record<string, number>;
  };

  const params = new URLSearchParams(window.location.search);
  const companyPublicId = params.get('company');

  document.addEventListener('DOMContentLoaded', async () => {
    // --- State ---
    const state: State = {
      loading: true,
      company: null,
      products: [],
      categories: [],
      searchQuery: '',
      activeCategory: 'all',
      isCartOpen: false,
      cart: [],
      cardQty: {},
    };

    // --- Helpers ---
    const formatCurrency = (val: any): string =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    const getProductPrice = (product: Product): number => {
      if (product?.is_promotional && Number(product.promotional_price) > 0) {
        return Number(product.promotional_price);
      }
      return Number(product?.selling_price || 0);
    };

    const getCartSubtotal = (): number =>
      state.cart.reduce((acc, item) => acc + getProductPrice(item.product) * item.quantity, 0);

    const formatPhoneForWa = (phone: string): string => {
      const digits = phone.replace(/\D/g, '');
      if (digits.startsWith('55')) return digits;
      return '55' + digits;
    };

    // --- Template Renders ---
    function render(): void {
      const app = document.getElementById('vue-app');
      if (!app) return;

      if (!companyPublicId) {
        app.innerHTML = `
          <div class="flex flex-col items-center justify-center h-64 text-red-500 font-bold text-center p-4">
             <svg class="w-16 h-16 mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
             <p class="text-lg">Catálogo inválido ou link incorreto.</p>
             <p class="text-sm font-normal text-gray-500 mt-1">Por favor, acesse utilizando o link enviado pela empresa.</p>
          </div>
        `;
        return;
      }

      if (state.loading) {
        app.innerHTML = `
          <div class="flex flex-col items-center justify-center h-64 text-gray-500 font-bold">
             <svg class="animate-spin h-10 w-10 text-brand-600 mb-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
             <p>Carregando catálogo digital...</p>
          </div>
        `;
        return;
      }

      const comp = state.company!;
      const logoSrc = comp.logo_base64
        ? (String(comp.logo_base64).startsWith('data:') ? comp.logo_base64 : `data:image/jpeg;base64,${comp.logo_base64}`)
        : (comp.logo_url || '');

      app.innerHTML = `
            <div class="flex flex-col md:flex-row flex-1 min-h-0 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden relative">
                <!-- Catalog Section -->
                <section class="flex flex-col flex-1 min-h-0 overflow-hidden md:order-first bg-white dark:bg-slate-900 md:border-r border-gray-200 dark:border-slate-700">
                    <div class="shrink-0 px-4 md:px-8 pt-6 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700/60 pb-4">
                        <div class="flex items-center gap-4 mb-4">
                            ${logoSrc ? `<img src="${logoSrc}" class="w-12 h-12 object-contain rounded-xl border border-gray-200 dark:border-slate-700 bg-white p-1">` : ''}
                            <div>
                                <h1 class="text-xl font-bold dark:text-white leading-tight">${comp.trade_name || comp.company_name}</h1>
                                <p class="text-xs text-gray-500 dark:text-gray-400">Catálogo de Produtos Digital</p>
                            </div>
                        </div>
                        <div class="flex flex-row items-center justify-between gap-4 w-full">
                            <div class="flex-1 w-full max-w-md">
                                <div class="relative flex items-center w-full h-12 rounded-xl bg-gray-50 dark:bg-slate-900/50 overflow-hidden border border-gray-200 dark:border-slate-600 focus-within:ring-2 focus-within:ring-brand-500 shadow-sm">
                                    <div class="grid place-items-center h-full w-12 text-gray-400">
                                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                                    </div>
                                    <input id="searchInput" type="text" value="${state.searchQuery}" placeholder="Buscar produto..." class="peer h-full w-full outline-none text-[16px] md:text-sm font-medium text-gray-700 dark:text-gray-300 pr-2 bg-transparent placeholder-gray-400">
                                </div>
                            </div>
                            <div class="shrink-0">
                                <button type="button" id="btnToggleCartMobile" class="flex items-center justify-center px-3.5 h-12 min-w-12 sm:min-w-12 bg-linear-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white rounded-xl border border-brand-500/40 relative transition-all duration-300 active:scale-[0.98] ${
                                  state.cart.length > 0
                                    ? 'shadow-lg ring-2 ring-brand-300/70 animate-pulse'
                                    : 'shadow-md hover:shadow-lg'
                                }" title="Abrir bolsa de compras" aria-label="Abrir bolsa de compras">
                                    <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14l-1 11H6L5 8zm3 0V6a4 4 0 118 0v2"></path></svg>
                                    ${
                                      state.cart.length > 0
                                        ? `<span class="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1.5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white shadow-sm">${state.cart.reduce(
                                            (a, b) => a + b.quantity,
                                            0
                                          )}</span>`
                                        : ''
                                    }
                                </button>
                            </div>
                        </div>
                        <div class="mt-4 flex items-center gap-2 border-t border-gray-100 dark:border-slate-700/60 pt-3">
                          <button type="button" id="btnCategoryPrev" class="h-7 w-7 shrink-0 rounded-full border border-gray-200 bg-white/95 text-gray-500 shadow-sm hover:text-brand-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800/95 dark:text-gray-300 dark:hover:text-brand-300 dark:hover:bg-slate-700 transition-colors" title="Categorias anteriores" aria-label="Categorias anteriores">
                            <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                          </button>
                          <div id="categoryScroller" class="min-w-0 flex-1 overflow-x-auto overflow-y-hidden scroll-smooth overscroll-x-contain [&::-webkit-scrollbar]:hidden">
                          <ul class="flex whitespace-nowrap -mb-px px-1 text-[12px] md:text-[13px] font-bold text-center gap-5">
                                <li>
                                    <button type="button" data-cat="all" class="cat-btn inline-block pb-3 px-1.5 border-b-2 transition-colors ${
                                      state.activeCategory === 'all'
                                        ? 'border-brand-600 text-brand-600'
                                        : 'border-transparent text-gray-500'
                                    }">Todos</button>
                                </li>
                                ${state.categories
                                  .map(
                                    (cat) => `
                                    <li class="shrink-0">
                                        <button type="button" data-cat="${cat}" class="cat-btn inline-block pb-3 px-1.5 border-b-2 transition-colors ${
                                          state.activeCategory === cat
                                            ? 'border-brand-600 text-brand-600'
                                            : 'border-transparent text-gray-500'
                                        }">${cat}</button>
                                    </li>
                                `
                                  )
                                  .map((html) => html.trim())
                                  .join('')}
                            </ul>
                          </div>
                          <button type="button" id="btnCategoryNext" class="h-7 w-7 shrink-0 rounded-full border border-gray-200 bg-white/95 text-gray-500 shadow-sm hover:text-brand-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800/95 dark:text-gray-300 dark:hover:text-brand-300 dark:hover:bg-slate-700 transition-colors" title="Próximas categorias" aria-label="Próximas categorias">
                            <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                          </button>
                        </div>
                    </div>
                    <div id="productGrid" class="flex-1 overflow-y-auto p-4 sm:p-8 bg-gray-50/50 dark:bg-slate-900">
                        ${renderProductGrid()}
                    </div>
                </section>

                ${
                  state.isCartOpen
                    ? `<button type="button" id="cartBackdrop" class="absolute inset-0 z-30 bg-slate-900/45 backdrop-blur-[2px] transition-opacity duration-300 ease-out md:hidden" aria-label="Fechar sacola"></button>`
                    : ''
                }

                <!-- Cart Section (Shopping list drawer) -->
                <section id="cartSidebar" class="${
                  (state.isCartOpen ? 'translate-x-0 opacity-100 pointer-events-auto' : 'translate-x-full opacity-0 pointer-events-none md:translate-x-0 md:opacity-100 md:pointer-events-auto') + ' absolute md:static inset-y-0 right-0 h-full w-[90%] sm:w-112.5 z-40 md:z-10 bg-white dark:bg-slate-800 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.15)] md:shadow-none border-l border-gray-200 dark:border-slate-700 transition-all duration-300 ease-out will-change-transform md:shrink-0 md:w-96 lg:w-104'
                }">
                    <div class="px-6 py-4 border-b border-gray-100 dark:border-slate-700">
                        <div class="flex justify-between items-center">
                            <h1 class="text-[20px] font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2">
                                <svg class="w-6 h-6 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                                Sacola de Pedido
                            </h1>
                            <button type="button" id="btnCloseCartMobile" class="text-gray-400 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 md:hidden" title="Fechar sacola" aria-label="Fechar sacola"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                        </div>
                    </div>
                    <div id="cartItems" class="flex-1 overflow-y-auto px-4 py-4 bg-gray-50/50 dark:bg-slate-900/50 space-y-3">
                        ${renderCartItems()}
                    </div>
                    <div class="px-6 pt-5 pb-6 bg-white dark:bg-slate-800 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] border-t border-gray-100 dark:border-slate-700">
                        <div class="flex justify-between items-end mb-6">
                            <span class="text-[20px] font-black text-gray-900 dark:text-white tracking-tight">TOTAL</span>
                            <span class="text-[28px] font-black text-gray-900 dark:text-white tracking-tight">${formatCurrency(
                              getCartSubtotal()
                            )}</span>
                        </div>
                        <div class="flex gap-3 h-16 mt-2">
                            <button type="button" id="btnSendOrderWhatsApp" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.98] text-[16px] flex justify-center items-center gap-2">
                                <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.739-1.45L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.858.002-2.634-1.02-5.11-2.881-6.974C16.592 1.89 14.117 1.06 11.487 1.06 6.05 1.06 1.625 5.48 1.62 10.921c-.001 1.701.453 3.361 1.314 4.816L1.97 21.65l6.01-1.577zM17.65 14.4c-.3-.15-1.785-.88-2.06-.98-.28-.1-.48-.15-.68.15-.2.3-.77.98-.95 1.18-.18.2-.35.23-.65.08-1.02-.51-1.72-.88-2.4-2.05-.18-.3-.18-.5-.03-.65.13-.13.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.08-.15-.68-1.65-.93-2.25-.24-.58-.49-.5-.68-.51h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.5 0 1.48 1.08 2.9 1.23 3.1.15.2 2.13 3.25 5.16 4.56.72.31 1.28.5 1.72.64.73.23 1.39.2 1.92.12.59-.09 1.79-.73 2.04-1.44.25-.7.25-1.3.18-1.43-.07-.13-.26-.2-.56-.35z"/></svg>
                                ENVIAR PEDIDO VIA WHATSAPP
                            </button>
                        </div>
                    </div>
                </section>
            </div>
      `;

      attachEventListeners();
    }

    function renderProductGrid(): string {
      let filtered = state.products;
      if (state.activeCategory !== 'all') {
        filtered = filtered.filter((p) => p.stock_type_name === state.activeCategory || p.category_name === state.activeCategory);
      }
      if (state.searchQuery) {
        const term = state.searchQuery.toLowerCase();
        filtered = filtered.filter(
          (p) =>
              p.name.toLowerCase().includes(term) ||
              (!!p.sku && p.sku.toLowerCase().includes(term)) ||
              (!!p.ean && p.ean.toLowerCase() === term)
        );
      }

      if (filtered.length === 0)
        return '<div class="text-center py-8 text-gray-500">Nenhum produto encontrado.</div>';

      return `
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4">
                ${filtered
                  .map(
                    (p) => {
                      const isPromo = p.is_promotional && Number(p.promotional_price) > 0;
                      const price = getProductPrice(p);
                      const promoBadgeHtml = isPromo
                        ? `<span class="absolute top-2 left-2 px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-lg shadow-sm">Promo</span>`
                        : '';
                      
                      const imgSrc = p.image_base64
                        ? (String(p.image_base64).startsWith('data:') ? p.image_base64 : `data:image/jpeg;base64,${p.image_base64}`)
                        : (p.image_url || '');

                      return `
                      <div data-id="${p.public_id}" class="product-card bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-slate-700 overflow-hidden cursor-pointer hover:shadow-md hover:border-brand-300 transition-all group p-3 sm:p-4 flex flex-col h-full relative">
                          ${promoBadgeHtml}
                          <div class="w-full aspect-4/3 bg-gray-100 dark:bg-slate-700 rounded-lg flex items-center justify-center mb-3 sm:mb-4 relative overflow-hidden group-hover:bg-brand-50 dark:group-hover:bg-brand-900/20 transition-colors p-2">
                              ${
                                imgSrc
                                  ? `<img src="${imgSrc}" class="w-full h-full object-contain" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
                                     <svg style="display:none" class="w-10 h-10 text-gray-300 group-hover:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`
                                  : `<svg class="w-10 h-10 text-gray-300 group-hover:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`
                              }
                          </div>
                          <h4 class="font-bold text-[14px] sm:text-[15px] text-gray-800 dark:text-gray-200 leading-tight mb-1 line-clamp-2 mt-auto">${p.name}</h4>
                          <p class="text-[11px] text-gray-400 dark:text-gray-500 line-clamp-2 mb-2 min-h-6 leading-tight">${p.description || ''}</p>
                          <div class="flex flex-col justify-end mt-1">
                              <div class="flex items-baseline gap-1">
                                  ${isPromo ? `<span class="text-xs text-gray-400 line-through">${formatCurrency(p.selling_price)}</span>` : ''}
                                  <span class="text-[16px] sm:text-[18px] font-bold text-gray-900 dark:text-white ${isPromo ? 'text-emerald-500 dark:text-emerald-400' : ''}">${formatCurrency(price)}</span>
                              </div>
                          </div>
                          <div class="mt-3 pt-2 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between gap-2">
                              <div class="flex items-center select-none rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700">
                                  <button type="button" class="card-qty-minus w-8 h-8 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 text-lg font-bold leading-none" data-id="${p.public_id}">−</button>
                                  <span class="card-qty-display w-7 text-center text-sm font-bold text-gray-800 dark:text-white pointer-events-none" data-id="${p.public_id}">${state.cardQty[p.public_id] || 0}</span>
                                  <button type="button" class="card-qty-plus w-8 h-8 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 text-lg font-bold leading-none" data-id="${p.public_id}">+</button>
                              </div>
                              <button type="button" class="card-add-btn flex-1 h-8 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white text-xs font-bold rounded-lg transition-all relative flex items-center justify-center" data-id="${p.public_id}">
                                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                  </svg>
                                  ${state.cardQty[p.public_id] > 0 ? `<span class="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center border-2 border-white">${state.cardQty[p.public_id]}</span>` : ''}
                              </button>
                          </div>
                      </div>
                      `;
                    }
                  )
                  .join('')}
            </div>
        `;
    }

    function renderCartItems(): string {
      if (state.cart.length === 0) {
        return `
                <div class="h-full flex flex-col items-center justify-center text-gray-400 space-y-3 py-16">
                    <svg class="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                    <p class="text-sm">Sua sacola está vazia</p>
                </div>
            `;
      }

      return state.cart
        .map(
          (item, idx) => {
            const price = getProductPrice(item.product);
            const imgSrc = item.product.image_base64
              ? (String(item.product.image_base64).startsWith('data:') ? item.product.image_base64 : `data:image/jpeg;base64,${item.product.image_base64}`)
              : (item.product.image_url || '');

            return `
            <div class="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-gray-100 dark:border-slate-700 relative group flex gap-3 animate-fade-in">
                <div class="w-12 h-12 rounded bg-gray-50 dark:bg-slate-700 overflow-hidden flex shrink-0 justify-center items-center">
                    ${
                      imgSrc 
                        ? `<img src="${imgSrc}" class="object-cover w-full h-full" onerror="this.style.display='none'">` 
                        : `<svg class="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>`
                    }
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="text-[13px] font-bold text-gray-800 dark:text-gray-200 line-clamp-2 leading-tight pr-5">${item.product.name}</h4>
                    <div class="flex justify-between items-center mt-2">
                        <span class="font-bold text-gray-900 dark:text-white text-[14px]">${formatCurrency(price * item.quantity)}</span>
                        <div class="flex items-center bg-gray-50 dark:bg-slate-900 rounded-lg p-0.5 border border-gray-100 dark:border-slate-700">
                            <button type="button" class="btn-qty-minus w-7 h-7 flex items-center justify-center rounded bg-white dark:bg-slate-800 text-gray-500 hover:text-red-500 shadow-sm" data-idx="${idx}">-</button>
                            <span class="w-8 text-center text-xs font-bold dark:text-white">${item.quantity}</span>
                            <button type="button" class="btn-qty-plus w-7 h-7 flex items-center justify-center rounded bg-white dark:bg-slate-800 text-gray-500 hover:text-green-500 shadow-sm" data-idx="${idx}">+</button>
                        </div>
                    </div>
                </div>
            </div>
            `;
          }
        )
        .join('');
    }

    function attachEventListeners(): void {
      const searchInput = document.getElementById('searchInput') as HTMLInputElement | null;
      if (searchInput) {
        searchInput.focus();
        searchInput.addEventListener('input', (e: Event) => {
          state.searchQuery = (e.target as HTMLInputElement).value;
          const grid = document.getElementById('productGrid');
          if (grid) grid.innerHTML = renderProductGrid();
          attachGridListeners();
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
        btn.addEventListener('click', (e: Event) => {
          const cat = (e.currentTarget as HTMLElement | null)?.dataset?.cat;
          state.activeCategory = cat || 'all';
          render();
          scrollActiveCategoryIntoView();
        });
      });

      const categoryScroller = document.getElementById('categoryScroller');
      document.getElementById('btnCategoryPrev')?.addEventListener('click', () => scrollCategories(-1));
      document.getElementById('btnCategoryNext')?.addEventListener('click', () => scrollCategories(1));
      categoryScroller?.addEventListener('wheel', (e: WheelEvent) => {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        e.preventDefault();
        categoryScroller.scrollBy({ left: e.deltaY, behavior: 'smooth' });
      }, { passive: false });
      scrollActiveCategoryIntoView();

      document.getElementById('btnSendOrderWhatsApp')?.addEventListener('click', sendOrderWhatsApp);

      attachGridListeners();
      attachCartListeners();
    }

    function scrollCategories(direction: number): void {
      const scroller = document.getElementById('categoryScroller');
      if (!scroller) return;
      scroller.scrollBy({ left: direction * Math.max(180, scroller.clientWidth * 0.7), behavior: 'smooth' });
    }

    function scrollActiveCategoryIntoView(): void {
      window.requestAnimationFrame(() => {
        const scroller = document.getElementById('categoryScroller');
        const activeButton = document.querySelector<HTMLElement>('.cat-btn.border-brand-600');
        if (!scroller || !activeButton) return;

        const scrollerRect = scroller.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();
        const offset = buttonRect.left - scrollerRect.left - (scrollerRect.width - buttonRect.width) / 2;
        scroller.scrollBy({ left: offset, behavior: 'smooth' });
      });
    }

    function attachGridListeners(): void {
      document.querySelectorAll<HTMLElement>('.product-card').forEach((card) => {
        card.addEventListener('click', (e: MouseEvent) => {
          if ((e.target as Element | null)?.closest('.card-qty-minus, .card-qty-plus, .card-add-btn')) return;
          const id = card.dataset.id;
          const p = state.products.find((x) => x.public_id === id);
          if (p) addToCart(p, state.cardQty[p.public_id] || 1);
        });
      });

      document.querySelectorAll<HTMLElement>('.card-qty-minus').forEach((btn) => {
        btn.addEventListener('click', (e: MouseEvent) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          if (!id) return;
          state.cardQty[id] = Math.max(0, (state.cardQty[id] || 0) - 1);
          const grid = document.getElementById('productGrid');
          if (grid) grid.innerHTML = renderProductGrid();
          attachGridListeners();
        });
      });

      document.querySelectorAll<HTMLElement>('.card-qty-plus').forEach((btn) => {
        btn.addEventListener('click', (e: MouseEvent) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          if (!id) return;
          state.cardQty[id] = (state.cardQty[id] || 0) + 1;
          const grid = document.getElementById('productGrid');
          if (grid) grid.innerHTML = renderProductGrid();
          attachGridListeners();
        });
      });

      document.querySelectorAll<HTMLElement>('.card-add-btn').forEach((btn) => {
        btn.addEventListener('click', (e: MouseEvent) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          const p = state.products.find((x) => x.public_id === id);
          if (p) {
            const qty = state.cardQty[id || ''] || 1;
            addToCart(p, qty);
          }
        });
      });
    }

    function attachCartListeners(): void {
      document.querySelectorAll<HTMLElement>('.btn-qty-minus').forEach((btn) => {
        btn.addEventListener('click', () => updateQty(parseInt(btn.dataset.idx || '0', 10), -1));
      });
      document.querySelectorAll<HTMLElement>('.btn-qty-plus').forEach((btn) => {
        btn.addEventListener('click', () => updateQty(parseInt(btn.dataset.idx || '0', 10), 1));
      });
    }

    // --- Actions ---
    function addToCart(product: Product, qty = 1): void {
      const existing = state.cart.find((c) => c.product.public_id === product.public_id);
      if (existing) {
        existing.quantity += qty;
      } else {
        state.cart.push({ product, quantity: qty });
      }
      state.cardQty[product.public_id] = 0;
      render();
    }

    function updateQty(idx: number, delta: number): void {
      const item = state.cart[idx];
      if (!item) return;
      item.quantity += delta;
      if (item.quantity <= 0) state.cart.splice(idx, 1);
      render();
    }

    function sendOrderWhatsApp(): void {
      if (state.cart.length === 0) return void alert('A sacola está vazia!');
      const comp = state.company;
      if (!comp || !comp.phone) {
        return void alert('Telefone da empresa não cadastrado.');
      }

      const itemsText = state.cart
        .map((item) => {
          const price = getProductPrice(item.product);
          return `- *${item.quantity}x* ${item.product.name} (${formatCurrency(price * item.quantity)})`;
        })
        .join('\n');

      const messageText = `Olá! Gostaria de fazer o seguinte pedido do catálogo:\n\n${itemsText}\n\n*Total:* ${formatCurrency(getCartSubtotal())}`;
      const waPhone = formatPhoneForWa(comp.phone);
      const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(messageText)}`;
      window.open(url, '_blank');
    }

    // --- Init ---
    if (!companyPublicId) {
      state.loading = false;
      render();
      return;
    }

    try {
      // Fetch public catalog data relative to companyPublicId
      const response = await api(`/public/catalog/${companyPublicId}`, {
        method: 'GET',
        cache: 'no-store'
      });

      if (response && response.status === 'success') {
        state.company = response.data.company;
        state.products = response.data.products || [];

        // Extract unique categories
        const cats = new Set<string>();
        state.products.forEach(p => {
          const name = p.stock_type_name || p.category_name;
          if (name) cats.add(name);
        });
        state.categories = Array.from(cats);
      }
    } catch (e) {
      console.error('Falha ao carregar catálogo público:', e);
    } finally {
      state.loading = false;
      render();
    }
  });
})();
