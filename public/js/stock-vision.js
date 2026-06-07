document.addEventListener('DOMContentLoaded', () => {
    const state = {
        loading: true,
        error: '',
        selectedStockTypeId: '',
        stockTypes: [],
        analytics: {
            total_products: 0,
            total_categories: 0,
            total_stock_units: 0,
            total_stock_value: 0,
            total_stock_sale_value: 0,
            low_stock: [],
            top_categories: [],
        },
    };

    const formatCurrency = (value) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

    const escapeHtml = (value) =>
        String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

    const app = document.getElementById('stock-vision-app');

    function renderLoading() {
        if (!app) return;
        app.innerHTML = `
            <div class="flex items-center justify-center h-64 text-gray-500">
                <div class="flex flex-col items-center gap-4">
                    <svg class="animate-spin h-8 w-8 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    <span>Carregando Visão Estoque...</span>
                </div>
            </div>
        `;
    }

    function renderError() {
        if (!app) return;
        app.innerHTML = `
            <div class="p-4 sm:p-0">
                <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                    Não foi possível carregar o dashboard de estoque. ${state.error ? String(state.error) : ''}
                </div>
            </div>
        `;
    }

    function renderLowStockList() {
        if (!state.analytics.low_stock.length) {
            return `
                <li class="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhum item em alerta de estoque.
                </li>
            `;
        }

        return state.analytics.low_stock.map((item) => `
            <li class="px-5 py-3 flex items-center justify-between gap-3 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                <div class="min-w-0">
                    <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">${String(item.name || '')}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Mínimo: ${Number(item.min_stock || 0)} ${item.measure ? String(item.measure) : ''}</p>
                </div>
                <div class="shrink-0 rounded-full bg-red-100 dark:bg-red-900/30 px-3 py-1 text-xs font-bold text-red-700 dark:text-red-300">
                    ${Number(item.current_stock || 0)} ${item.measure ? String(item.measure) : ''}
                </div>
            </li>
        `).join('');
    }

    function renderTopCategories() {
        if (!state.analytics.top_categories.length) {
            return `
                <div class="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhuma categoria com produtos para exibir.
                </div>
            `;
        }

        const maxCount = Math.max(...state.analytics.top_categories.map((c) => Number(c.product_count || 0)), 1);

        return `
            <div class="px-5 py-4 space-y-3">
                ${state.analytics.top_categories.map((category) => {
                    const count = Number(category.product_count || 0);
                    const width = Math.max(8, Math.round((count / maxCount) * 100));
                    return `
                        <div>
                            <div class="mb-1 flex items-center justify-between gap-3 text-xs">
                                <span class="font-semibold text-gray-700 dark:text-gray-200 truncate">${String(category.name || 'Sem categoria')}</span>
                                <span class="font-mono text-gray-500 dark:text-gray-400">${count}</span>
                            </div>
                            <div class="h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
                                <div class="h-full rounded-full bg-brand-500" style="width:${width}%;"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderDashboard() {
        if (!app) return;

        const stockTypeOptions = [
            '<option value="">Todos os tipos</option>',
            ...state.stockTypes.map((item) => {
                const selected = String(state.selectedStockTypeId || '') === String(item.id || '') ? 'selected' : '';
                return `<option value="${String(item.id || '')}" ${selected}>${escapeHtml(item.name || 'Sem nome')}</option>`;
            }),
        ].join('');

        app.innerHTML = `
            <div class="px-4 sm:px-0">
                <div class="mb-2 flex justify-end">
                    <div class="w-full md:w-auto md:min-w-88">
                        <label for="stockTypeFilter" class="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tipo de Estoque</label>
                        <div class="mt-1 flex gap-2">
                            <select id="stockTypeFilter" class="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100">
                                ${stockTypeOptions}
                            </select>
                            <button type="button" id="btnClearStockTypeFilter" class="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-200 dark:hover:bg-slate-700">
                                Limpar
                            </button>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    ${renderCard('Produtos Registrados', Number(state.analytics.total_products || 0), 'itens', 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10')}
                    ${renderCard('Categorias Ativas', Number(state.analytics.total_categories || 0), 'categorias', 'M4 7h16M4 12h16M4 17h16')}
                    ${renderCard('Unidades em Estoque', Number(state.analytics.total_stock_units || 0), 'unidades', 'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4M3 17l9 4 9-4', true)}
                    ${renderCard('Valor Total em Custo', formatCurrency(state.analytics.total_stock_value), '', 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 10v1m9-6a9 9 0 11-18 0 9 9 0 0118 0z')}
                    ${renderCard('Valor Total em Preço', formatCurrency(state.analytics.total_stock_sale_value), '', 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 10v1m9-6a9 9 0 11-18 0 9 9 0 0118 0z')}
                </div>

                <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <section class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
                        <header class="px-5 py-4 border-b border-gray-100 dark:border-slate-700 bg-red-50/60 dark:bg-red-900/10">
                            <h2 class="text-base font-bold text-red-700 dark:text-red-300">Atenção: Estoque Baixo</h2>
                        </header>
                        <ul class="divide-y divide-gray-100 dark:divide-slate-700">
                            ${renderLowStockList()}
                        </ul>
                        <div class="px-5 py-3 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 text-sm">
                            <a href="/pages/products.html" class="font-semibold text-brand-600 dark:text-brand-400">Ir para Produtos</a>
                        </div>
                    </section>

                    <section class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
                        <header class="px-5 py-4 border-b border-gray-100 dark:border-slate-700 bg-brand-50/60 dark:bg-brand-900/10">
                            <h2 class="text-base font-bold text-gray-900 dark:text-gray-100">Top Categorias por Quantidade</h2>
                        </header>
                        ${renderTopCategories()}
                        <div class="px-5 py-3 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 text-sm">
                            <a href="/pages/categories.html" class="font-semibold text-brand-600 dark:text-brand-400">Gerenciar Categorias</a>
                        </div>
                    </section>
                </div>
            </div>
        `;

        const stockTypeFilter = document.getElementById('stockTypeFilter');
        if (stockTypeFilter) {
            stockTypeFilter.addEventListener('change', (event) => {
                state.selectedStockTypeId = String(event.target?.value || '');
                loadData();
            });
        }

        const btnClearStockTypeFilter = document.getElementById('btnClearStockTypeFilter');
        if (btnClearStockTypeFilter) {
            btnClearStockTypeFilter.addEventListener('click', () => {
                state.selectedStockTypeId = '';
                if (stockTypeFilter) {
                    stockTypeFilter.value = '';
                }
                loadData();
            });
        }
    }

    function renderCard(title, value, suffix, iconPath, isCount = false) {
        return `
            <article class="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-4">
                <div class="flex items-start justify-between gap-2.5">
                    <div>
                        <p class="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">${title}</p>
                        <p class="mt-1.5 text-xl font-black tracking-tight text-gray-900 dark:text-gray-100">
                            ${isCount ? Number(value || 0) : value}
                            ${suffix ? `<span class="ml-1 text-xs font-semibold text-gray-500 dark:text-gray-400">${suffix}</span>` : ''}
                        </p>
                    </div>
                    <span class="rounded-lg border border-brand-200 bg-brand-100 p-1.5 text-brand-600 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-300">
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}"></path>
                        </svg>
                    </span>
                </div>
            </article>
        `;
    }

    async function loadStockTypes() {
        try {
            const response = await api('/estoque/stock-types');
            state.stockTypes = Array.isArray(response?.data) ? response.data : [];
        } catch (error) {
            console.error('Erro ao carregar tipos de estoque:', error);
            state.stockTypes = [];
        }
    }

    async function loadData() {
        state.loading = true;
        state.error = '';
        renderLoading();

        try {
            const query = state.selectedStockTypeId ? `?stockTypeId=${encodeURIComponent(state.selectedStockTypeId)}` : '';
            const response = await api(`/estoque/analytics/stock-vision${query}`);
            state.analytics = {
                ...state.analytics,
                ...(response?.data || {}),
                low_stock: Array.isArray(response?.data?.low_stock) ? response.data.low_stock : [],
                top_categories: Array.isArray(response?.data?.top_categories) ? response.data.top_categories : [],
            };
        } catch (error) {
            console.error('Erro ao carregar visão de estoque:', error);
            state.error = error?.message || '';
        } finally {
            state.loading = false;
        }

        if (state.error) {
            renderError();
            return;
        }

        renderDashboard();
    }

    if (typeof Auth !== 'undefined' && !Auth.isAuthenticated()) {
        window.location.href = '/';
        return;
    }

    loadStockTypes().finally(() => {
        loadData();
    });
});
