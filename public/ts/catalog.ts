(() => {
  const api = (window as any).api;

  type Product = {
    public_id: string;
    name: string;
    selling_price: number;
    is_promotional?: boolean;
    promotional_price?: number;
    original_selling_price?: number;
    original_promotional_price?: number | null;
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
    cnpj?: string;
    pix_key?: string;
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
    selectedPaymentMethod: string;
    payments: Record<string, number>;
    paymentMethodsList: { id: string; name: string }[];
    cardBrands: { id: string; name: string }[];
    selectedCardBrand: string;
    savingOrder: boolean;
    customerName: string;
    deliveryAddress: string;
    activeSellerPublicId: string;
    sellerName: string;
    sellerCustomers: { public_id: string; name: string }[];
  };

  const params = new URLSearchParams(window.location.search);
  const companyPublicId = params.get('company');
  const sellerPublicId = params.get('seller');
  const customerPublicId = params.get('customer');
  const stockTypePublicId = params.get('stock_type');

  document.addEventListener('DOMContentLoaded', async () => {
    // --- State ---
    const state: State = {
      loading: true,
      activeSellerPublicId: '',
      sellerName: '',
      sellerCustomers: [],
      company: null,
      products: [],
      categories: [],
      searchQuery: '',
      activeCategory: 'all',
      isCartOpen: false,
      cart: [],
      cardQty: {},
      selectedPaymentMethod: 'pix',
      payments: { cash: 0, pix: 0, credit: 0, debit: 0, boleto: 0 },
      paymentMethodsList: [
        { id: 'pix', name: 'PIX' },
        { id: 'credit', name: 'Cartão de Crédito' },
        { id: 'debit', name: 'Cartão de Débito' },
        { id: 'cash', name: 'Dinheiro' },
        { id: 'boleto', name: 'Boleto' },
      ],
      cardBrands: [
        { id: 'visa', name: 'Visa' },
        { id: 'mastercard', name: 'Mastercard' },
        { id: 'elo', name: 'Elo' },
        { id: 'amex', name: 'American Express' },
        { id: 'hipercard', name: 'Hipercard' }
      ],
      selectedCardBrand: 'visa',
      savingOrder: false,
      customerName: '',
      deliveryAddress: ''
    };

    // --- Helpers ---
    const formatCurrency = (val: any): string =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    function generatePixCopyPaste(key: string, name: string, city: string, amount: number): string {
      const cleanKey = String(key || '').trim();
      const cleanName = String(name || 'KEYSTONE ERP').trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      const cleanCity = String(city || 'SAO PAULO').trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      
      const pad = (id: string, value: string) => id + String(value.length).padStart(2, '0') + value;
      
      const merchantAccountInfo = 
        pad('00', 'br.gov.bcb.pix') +
        pad('01', cleanKey);
        
      const payload = 
        pad('00', '01') +
        pad('26', merchantAccountInfo) +
        pad('52', '0000') +
        pad('53', '986') +
        pad('54', amount.toFixed(2)) +
        pad('58', 'BR') +
        pad('59', cleanName.substring(0, 25)) +
        pad('60', cleanCity.substring(0, 15)) +
        pad('62', pad('05', '***'));
        
      let crc = 0xFFFF;
      const dataToCrc = payload + '6304';
      for (let i = 0; i < dataToCrc.length; i++) {
        let x = ((crc >> 8) ^ dataToCrc.charCodeAt(i)) & 0xFF;
        x ^= x >> 4;
        crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xFFFF;
      }
      const crcString = crc.toString(16).toUpperCase().padStart(4, '0');
      return dataToCrc + crcString;
    }

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

    const escapeHtml = (str: any): string => {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
                        <div class="flex items-center justify-between gap-4 mb-4">
                            <div class="flex items-center gap-4">
                                ${logoSrc ? `<img src="${logoSrc}" class="w-12 h-12 object-contain rounded-xl border border-gray-200 dark:border-slate-700 bg-white p-1">` : ''}
                                <div>
                                    <h1 class="text-xl font-bold dark:text-white leading-tight">${escapeHtml(comp.trade_name || comp.company_name)}</h1>
                                    ${state.customerName ? `
                                      <p class="text-xs text-brand-600 dark:text-brand-400 font-bold flex items-center gap-1 mt-0.5">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                        Cliente: ${escapeHtml(state.customerName)}
                                      </p>
                                    ` : '<p class="text-xs text-gray-500 dark:text-gray-400">Catálogo de Produtos Digital</p>'}
                                </div>
                            </div>
                            ${state.activeSellerPublicId ? `
                              <div class="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-gray-200/50 dark:border-slate-700/50 min-w-60">
                                  <div class="flex items-center gap-1.5 text-xs text-brand-800 dark:text-brand-300 font-semibold mb-0.5">
                                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                      <span>Vendedor: <strong>${escapeHtml(state.sellerName || 'Identificado')}</strong></span>
                                  </div>
                                  <div>
                                      <label class="block text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500 mb-1">Selecione o Cliente</label>
                                      <select id="headerCustomerSelect" class="w-full text-xs border dark:border-slate-700 p-2 rounded bg-gray-50 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 font-semibold shadow-sm">
                                          <option value="">Sem desconto (Preço Padrão)</option>
                                          ${state.sellerCustomers.map(c => `
                                            <option value="${escapeHtml(c.public_id)}" ${customerPublicId === c.public_id ? 'selected' : ''}>${escapeHtml(c.name)}</option>
                                          `).join('')}
                                      </select>
                                  </div>
                              </div>
                            ` : `
                              <button type="button" id="btnOpenSellerLogin" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 border border-slate-200/50 dark:border-slate-600/30">
                                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                  Vendedor
                              </button>
                            `}
                        </div>
                        <div class="flex flex-row items-center justify-between gap-4 w-full">
                            <div class="flex-1 w-full max-w-md">
                                <div class="relative flex items-center w-full h-12 rounded-xl bg-gray-50 dark:bg-slate-900/50 overflow-hidden border border-gray-200 dark:border-slate-600 focus-within:ring-2 focus-within:ring-brand-500 shadow-sm">
                                    <div class="grid place-items-center h-full w-12 text-gray-400">
                                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                                    </div>
                                    <input id="searchInput" type="text" value="${escapeHtml(state.searchQuery)}" placeholder="Buscar produto..." class="peer h-full w-full outline-none text-[16px] md:text-sm font-medium text-gray-700 dark:text-gray-300 pr-2 bg-transparent placeholder-gray-400">
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
                                        <button type="button" data-cat="${escapeHtml(cat)}" class="cat-btn inline-block pb-3 px-1.5 border-b-2 transition-colors ${
                                          state.activeCategory === cat
                                            ? 'border-brand-600 text-brand-600'
                                            : 'border-transparent text-gray-500'
                                        }">${escapeHtml(cat)}</button>
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
                    ? `<button type="button" id="cartBackdrop" class="absolute inset-0 z-30 bg-slate-900/45 backdrop-blur-[2px] transition-opacity duration-300 ease-out" aria-label="Fechar sacola"></button>`
                    : ''
                }

                <!-- Cart Section (Shopping list drawer) -->
                <section id="cartSidebar" class="${
                  (state.isCartOpen ? 'translate-x-0 opacity-100 pointer-events-auto' : 'translate-x-full opacity-0 pointer-events-none') + ' absolute inset-y-0 right-0 h-full w-[90%] sm:w-112.5 z-40 bg-white dark:bg-slate-800 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.15)] transition-all duration-300 ease-out will-change-transform md:w-96 lg:w-104'
                }">
                    <div class="px-6 py-4 border-b border-gray-100 dark:border-slate-700">
                        <div class="flex justify-between items-center">
                            <h1 class="text-[20px] font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2">
                                <svg class="w-6 h-6 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                                Sacola de Pedido
                            </h1>
                            <button type="button" id="btnCloseCartMobile" class="text-gray-400 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700" title="Fechar sacola" aria-label="Fechar sacola"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
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
                            <button type="button" id="btnSubmitOrderSystem" ${state.savingOrder ? 'disabled' : ''} class="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.98] text-[16px] flex justify-center items-center gap-2">
                                <svg class="w-5 h-5 fill-none stroke-current" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                ${state.savingOrder ? 'ENVIANDO PEDIDO...' : 'FINALIZAR PEDIDO'}
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            <!-- Modal de Login do Vendedor -->
            <div id="sellerLoginModal" class="hidden fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm items-center justify-center p-4">
                <div class="relative bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-gray-100 dark:border-slate-700 w-full max-w-sm p-6 transform transition-all flex flex-col gap-4">
                    <button type="button" id="btnCloseSellerModal" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    
                    <div class="text-center">
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white">Área do Vendedor</h2>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Identifique-se para carregar os seus clientes</p>
                    </div>

                    <!-- Step 1: Login Form -->
                    <form id="sellerLoginForm" class="flex flex-col gap-3">
                        <div>
                            <label class="block text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500 mb-1">E-mail</label>
                            <input type="email" id="sellerEmail" required placeholder="vendedor@empresa.com" class="w-full text-xs border dark:border-slate-700 p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500 mb-1">Senha</label>
                            <input type="password" id="sellerPassword" autocomplete="current-password" required placeholder="••••••••" class="w-full text-xs border dark:border-slate-700 p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500">
                        </div>
                        <div id="sellerLoginError" class="text-red-500 text-xs font-semibold hidden text-center mt-1"></div>
                        <button type="submit" id="btnSubmitSellerLogin" class="w-full h-10 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98] mt-2">
                            ACESSAR
                        </button>
                    </form>

                    <!-- Step 2: Customer Selection -->
                    <div id="sellerCustomerSection" class="hidden flex-col gap-4">
                        <div class="p-3 bg-brand-50 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-900/30 rounded-2xl flex items-center gap-2">
                            <span class="text-xs text-brand-800 dark:text-brand-300">Olá, <strong id="lblSellerName"></strong>! Selecione o cliente para aplicar o desconto no catálogo:</span>
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500 mb-1">Selecione o Cliente</label>
                            <select id="sellerCustomerSelect" class="w-full text-xs border dark:border-slate-700 p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500">
                                <option value="">Sem desconto (Preço Padrão)</option>
                            </select>
                        </div>
                        <button type="button" id="btnApplySellerCustomer" class="w-full h-10 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98]">
                            CARREGAR PREÇOS
                        </button>
                    </div>
                </div>
            </div>
      `;

      attachEventListeners();
    }

    function renderProductGrid(): string {
      let filtered = state.products;
      if (state.activeCategory !== 'all') {
        filtered = filtered.filter((p) => p.category_name === state.activeCategory);
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

                      // Check original prices vs current discounted prices
                      const originalPrice = p.original_selling_price ? (
                        (p.is_promotional && Number(p.original_promotional_price) > 0)
                          ? Number(p.original_promotional_price)
                          : Number(p.original_selling_price)
                      ) : price;

                      const hasCustomerDiscount = originalPrice > price;
                      const discountPercent = originalPrice > 0 ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

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
                          ${
                            p.category_name
                              ? `<span class="inline-block text-[9px] font-bold tracking-wider text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 px-1.5 py-0.5 rounded-md mb-1 w-fit uppercase">${escapeHtml(p.category_name)}</span>`
                              : ''
                          }
                          <h4 class="font-bold text-[14px] sm:text-[15px] text-gray-800 dark:text-gray-200 leading-tight mb-1 line-clamp-2 mt-auto">${escapeHtml(p.name)}</h4>
                          <p class="text-[11px] text-gray-400 dark:text-gray-500 line-clamp-2 mb-2 min-h-6 leading-tight">${escapeHtml(p.description || '')}</p>
                          <div class="flex flex-col justify-end mt-1">
                              <div class="flex items-baseline gap-1 flex-wrap">
                                  ${hasCustomerDiscount ? `
                                    <span class="text-xs text-gray-400 line-through">${formatCurrency(originalPrice)}</span>
                                    <span class="text-[16px] sm:text-[18px] font-black text-brand-600 dark:text-brand-400">${formatCurrency(price)}</span>
                                    <span class="text-[9px] bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-bold px-1.5 py-0.5 rounded border border-red-200/50 dark:border-red-900/30 ml-1">-${discountPercent}%</span>
                                  ` : `
                                    ${isPromo ? `<span class="text-xs text-gray-400 line-through">${formatCurrency(p.selling_price)}</span>` : ''}
                                    <span class="text-[16px] sm:text-[18px] font-bold text-gray-900 dark:text-white ${isPromo ? 'text-emerald-500 dark:text-emerald-400' : ''}">${formatCurrency(price)}</span>
                                  `}
                              </div>
                          </div>
                          <div class="mt-3 pt-2 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between gap-2">
                              <div class="flex items-center select-none rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700">
                                  <button type="button" class="card-qty-minus w-8 h-8 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 text-lg font-bold leading-none" data-id="${escapeHtml(p.public_id)}">−</button>
                                  <span class="card-qty-display w-7 text-center text-sm font-bold text-gray-800 dark:text-white pointer-events-none" data-id="${escapeHtml(p.public_id)}">${state.cardQty[p.public_id] || 0}</span>
                                  <button type="button" class="card-qty-plus w-8 h-8 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 text-lg font-bold leading-none" data-id="${escapeHtml(p.public_id)}">+</button>
                              </div>
                              <button type="button" class="card-add-btn flex-1 h-8 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white text-xs font-bold rounded-lg transition-all relative flex items-center justify-center" data-id="${escapeHtml(p.public_id)}">
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
                    <h4 class="text-[13px] font-bold text-gray-800 dark:text-gray-200 line-clamp-2 leading-tight pr-5">${escapeHtml(item.product.name)}</h4>
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




      const headerCustomerSelect = document.getElementById('headerCustomerSelect') as HTMLSelectElement | null;
      if (headerCustomerSelect) {
        headerCustomerSelect.addEventListener('change', () => {
          const selectedCustomerPublicId = headerCustomerSelect.value;
          const newUrl = new URL(window.location.href);
          if (state.activeSellerPublicId) {
            newUrl.searchParams.set('seller', state.activeSellerPublicId);
          } else {
            newUrl.searchParams.delete('seller');
          }
          if (selectedCustomerPublicId) {
            newUrl.searchParams.set('customer', selectedCustomerPublicId);
          } else {
            newUrl.searchParams.delete('customer');
          }
          window.location.href = newUrl.toString();
        });
      }

      document.getElementById('btnSubmitOrderSystem')?.addEventListener('click', submitOrderSystem);

      attachGridListeners();
      attachCartListeners();
      attachSellerLoginEvents();
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

    function attachSellerLoginEvents(): void {
      const modal = document.getElementById('sellerLoginModal');
      const btnOpen = document.getElementById('btnOpenSellerLogin');
      const btnClose = document.getElementById('btnCloseSellerModal');
      const form = document.getElementById('sellerLoginForm') as HTMLFormElement | null;
      const emailInput = document.getElementById('sellerEmail') as HTMLInputElement | null;
      const passInput = document.getElementById('sellerPassword') as HTMLInputElement | null;
      const errorDiv = document.getElementById('sellerLoginError');
      const submitBtn = document.getElementById('btnSubmitSellerLogin');

      const loginSection = document.getElementById('sellerLoginForm');
      const customerSection = document.getElementById('sellerCustomerSection');
      const lblName = document.getElementById('lblSellerName');
      const customerSelect = document.getElementById('sellerCustomerSelect') as HTMLSelectElement | null;
      const btnApply = document.getElementById('btnApplySellerCustomer');

      if (btnOpen && modal) {
        btnOpen.addEventListener('click', () => {
          modal.classList.remove('hidden');
          modal.classList.add('flex');
          if (emailInput) emailInput.focus();
        });
      }

      if (btnClose && modal) {
        btnClose.addEventListener('click', () => {
          modal.classList.remove('flex');
          modal.classList.add('hidden');
          if (form) form.reset();
          if (errorDiv) {
            errorDiv.classList.add('hidden');
            errorDiv.textContent = '';
          }
          if (customerSection && loginSection) {
            customerSection.classList.remove('flex');
            customerSection.classList.add('hidden');
            loginSection.classList.remove('hidden');
            loginSection.classList.add('flex');
          }
        });
      }

      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!emailInput || !passInput || !errorDiv || !submitBtn) return;

          errorDiv.classList.add('hidden');
          errorDiv.textContent = '';
          submitBtn.setAttribute('disabled', 'true');
          const originalText = submitBtn.textContent;
          submitBtn.textContent = 'AUTENTICANDO...';

          try {
            const res = await api(`/public/catalog/${companyPublicId}/auth-seller`, {
              method: 'POST',
              body: JSON.stringify({
                email: emailInput.value.trim(),
                password: passInput.value
              })
            });

            if (res && res.status === 'success') {
              state.activeSellerPublicId = res.seller_public_id;
              if (lblName) lblName.textContent = res.seller_name;

              if (customerSelect) {
                customerSelect.innerHTML = '<option value="">Sem desconto (Preço Padrão)</option>';
                res.customers.forEach((c: any) => {
                  customerSelect.innerHTML += `<option value="${escapeHtml(c.public_id)}">${escapeHtml(c.name)}</option>`;
                });
                
                // If there's currently a customerPublicId loaded, preselect it in the dropdown
                if (customerPublicId) {
                  customerSelect.value = customerPublicId;
                }
              }

              if (loginSection) {
                loginSection.classList.remove('flex');
                loginSection.classList.add('hidden');
              }
              if (customerSection) {
                customerSection.classList.remove('hidden');
                customerSection.classList.add('flex');
              }
            } else {
              errorDiv.textContent = res?.message || 'Falha ao autenticar. Verifique seus dados.';
              errorDiv.classList.remove('hidden');
            }
          } catch (err: any) {
            console.error('Auth error:', err);
            errorDiv.textContent = err.message || 'Erro de conexão ou credenciais inválidas.';
            errorDiv.classList.remove('hidden');
          } finally {
            submitBtn.removeAttribute('disabled');
            submitBtn.textContent = originalText;
          }
        });
      }

      if (btnApply && customerSelect && modal) {
        btnApply.addEventListener('click', () => {
          const selectedCustomerPublicId = customerSelect.value;
          
          const newUrl = new URL(window.location.href);
          if (state.activeSellerPublicId) {
            newUrl.searchParams.set('seller', state.activeSellerPublicId);
          } else {
            newUrl.searchParams.delete('seller');
          }
          if (selectedCustomerPublicId) {
            newUrl.searchParams.set('customer', selectedCustomerPublicId);
          } else {
            newUrl.searchParams.delete('customer');
          }
          
          window.location.href = newUrl.toString();
        });
      }
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

    async function submitOrderSystem(): Promise<void> {
      if (state.cart.length === 0) {
        alert('A sacola está vazia!');
        return;
      }
      if (state.savingOrder) return;

      state.savingOrder = true;
      render();

      try {
        const orderItems = state.cart.map(item => ({
          product_public_id: item.product.public_id,
          quantity: item.quantity
        }));

        const customerNameFinal = state.customerName.trim() || 'Cliente Consumidor';

        const response = await api(`/public/catalog/${companyPublicId}/order`, {
          method: 'POST',
          body: JSON.stringify({
            customer_name: customerNameFinal,
            seller_public_id: sellerPublicId || null,
            customer_public_id: customerPublicId || null,
            items: orderItems
          })
        });

        if (response && response.status === 'success') {
          alert('Pedido realizado com sucesso! Agradecemos a preferência.');
          state.cart = [];
          state.customerName = '';
          state.deliveryAddress = '';
          state.isCartOpen = false;
        } else {
          alert(response?.message || 'Erro ao realizar o pedido. Tente novamente.');
        }
      } catch (err: any) {
        console.error('Erro ao submeter pedido:', err);
        alert(err.message || 'Ocorreu um erro ao enviar o pedido.');
      } finally {
        state.savingOrder = false;
        render();
      }
    }

    // --- Init ---
    if (!companyPublicId) {
      state.loading = false;
      render();
      return;
    }

    try {
      // Fetch public catalog data relative to companyPublicId
      let catalogUrl = `/public/catalog/${companyPublicId}`;
      const queryParams: string[] = [];
      if (customerPublicId) {
        queryParams.push(`customer=${customerPublicId}`);
      }
      if (sellerPublicId) {
        queryParams.push(`seller=${sellerPublicId}`);
      }
      if (stockTypePublicId) {
        queryParams.push(`stock_type=${stockTypePublicId}`);
      }
      if (queryParams.length > 0) {
        catalogUrl += `?${queryParams.join('&')}`;
      }
      const response = await api(catalogUrl, {
        method: 'GET',
        cache: 'no-store'
      });

      if (response && response.status === 'success') {
        state.company = response.data.company;
        state.products = response.data.products || [];

        if (response.data.customer) {
          const cust = response.data.customer;
          state.customerName = cust.name || '';
          
          const addrParts = [
            cust.street,
            cust.number,
            cust.neighborhood,
            cust.city,
            cust.state
          ].filter(Boolean);
          if (cust.complement) {
            addrParts.splice(2, 0, cust.complement);
          }
          state.deliveryAddress = addrParts.join(', ');
        }

        if (response.data.seller) {
          state.sellerName = response.data.seller.full_name || '';
        }
        if (response.data.seller_customers) {
          state.sellerCustomers = response.data.seller_customers || [];
        }

        // Extract unique categories
        const cats = new Set<string>();
        state.products.forEach(p => {
          const name = p.category_name;
          if (name) cats.add(name);
        });
        state.categories = Array.from(cats);

        // Pre-fill cart if parameter exists in the URL
        const cartParam = params.get('cart');
        if (cartParam) {
          try {
            const parsedCart = JSON.parse(decodeURIComponent(cartParam));
            if (Array.isArray(parsedCart)) {
              state.cart = [];
              parsedCart.forEach((item: any) => {
                const product = state.products.find(p => p.public_id === item.id);
                if (product) {
                  state.cart.push({
                    product,
                    quantity: Number(item.qty) || 1
                  });
                }
              });
              if (state.cart.length > 0) {
                state.isCartOpen = true;
              }
            }
          } catch (err) {
            console.error('Erro ao processar carrinho pré-preenchido:', err);
          }
        }
      }
    } catch (e) {
      console.error('Falha ao carregar catálogo público:', e);
    } finally {
      state.loading = false;
      render();
    }
  });
})();
