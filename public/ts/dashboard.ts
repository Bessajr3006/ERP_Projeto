/**
 * dashboard.js
 * Dashboard principal do ERP Keystone.
 * Implementação em Vanilla JS/TS para consistência com o restante do sistema.
 */

document.addEventListener('DOMContentLoaded', async () => {
    type DashboardChart = {
        labels?: string[];
        income?: Array<number | string>;
        expense?: Array<number | string>;
    };

    type DashboardLowStockItem = {
        name?: string;
        current_stock?: number | string;
        measure?: string;
    };

    type DashboardAnalytics = {
        total_balance?: number;
        total_products?: number;
        total_customers?: number;
        sales_today_count?: number;
        sales_today_amount?: number;
        total_payables?: number;
        total_receivables?: number;
        low_stock?: DashboardLowStockItem[];
        chart?: DashboardChart | null;
    };

    type DashboardState = {
        loading: boolean;
        analytics: DashboardAnalytics;
        hideValues: boolean;
        showIncome: boolean;
        showExpense: boolean;
        user: any;
    };

    // --- State ---
    const state: DashboardState = {
        loading: true,
        analytics: {
            total_balance: 0,
            total_products: 0,
            total_customers: 0,
            sales_today_count: 0,
            sales_today_amount: 0,
            total_payables: 0,
            total_receivables: 0,
            low_stock: [],
            chart: null,
        },
        hideValues: localStorage.getItem('hideDashboardValues') === 'true',
        showIncome: true,
        showExpense: true,
        user: null,
    };

    // --- Helpers ---
    const formatCurrency = (value: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

    // --- Render Logic ---
    function render() {
        const app = document.getElementById('vue-app'); // Mantemos o ID para compatibilidade com o HTML
        if (!app) return;

        if (state.loading) {
            app.innerHTML = `
                <div class="flex items-center justify-center h-64 text-gray-500">
                    <div class="flex flex-col items-center gap-4">
                        <svg class="animate-spin h-8 w-8 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Carregando Dashboard...</span>
                    </div>
                </div>
            `;
            return;
        }

        // Renderização completa do Dashboard
        app.innerHTML = `
            <!-- Dashboard Stats -->
            <div class="grid grid-cols-1 gap-5 px-4 sm:grid-cols-2 sm:px-0 lg:grid-cols-3 xl:grid-cols-3">
                ${renderStatCard('Saldo Contas', state.analytics.total_balance, 'blue', '/pages/banks.html', 'Ver bancos', 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z')}
                ${renderStatCard('A Receber (Pendentes)', state.analytics.total_receivables, 'emerald', '/pages/revenues.html', 'Ver receitas', 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', true)}
                ${renderStatCard('A Pagar (Pendentes)', state.analytics.total_payables, 'red', '/pages/expenses.html', 'Ver despesas', 'M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6', true)}

                <!-- Vendas Hoje -->
                <div class="bg-white dark:bg-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow rounded-2xl border border-gray-100 dark:border-slate-700">
                    <div class="p-5 flex items-center">
                        <div class="shrink-0 bg-indigo-100 dark:bg-indigo-500/10 rounded-xl p-3 border border-indigo-200 dark:border-indigo-500/20 shadow-sm">
                            <svg class="h-6 w-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        </div>
                        <div class="ml-5 w-0 flex-1">
                            <div class="text-[13px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">Vendas Hoje</div>
                            <div class="flex items-baseline gap-2 mt-1">
                                <span class="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">${state.hideValues ? 'R$ •••••' : formatCurrency(state.analytics.sales_today_amount)}</span>
                                <div class="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">${Number(state.analytics.sales_today_count || 0)} un</div>
                            </div>
                        </div>
                    </div>
                    <div class="bg-gray-50 dark:bg-slate-900/50 px-5 py-3 border-t dark:border-slate-700 text-sm">
                        <a href="/pages/sales.html" class="font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1">PDV Caixa <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></a>
                    </div>
                </div>

                ${renderCountCard('Estoque Registrado', state.analytics.total_products, 'amber', '/pages/products.html', 'Ver catálogo', 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4')}
                ${renderCountCard('Clientes Ativos', state.analytics.total_customers, 'purple', '/pages/customers.html', 'Ver base', 'M17 20h5V18a5 5 0 00-10 0v2h5M9 8a3 3 0 11-6 0 3 3 0 016 0zm6 2a3 3 0 11-6 0 3 3 0 016 0z')}
            </div>

            <div class="mt-8 px-4 sm:px-0 grid grid-cols-1 gap-6 lg:grid-cols-3">
                <!-- Gráfico de Receitas e Despesas -->
                <div class="lg:col-span-2 min-w-0 bg-white dark:bg-slate-800 shadow-sm rounded-2xl border border-gray-100 dark:border-slate-700 flex flex-col">
                    <div class="px-5 py-4 border-b flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/50 dark:border-slate-700 shrink-0">
                        <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center tracking-tight">
                            <svg class="w-5 h-5 mr-2 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                            Evolução de Caixa
                        </h3>
                        <button type="button" id="btnToggleValues" class="text-xs font-semibold px-2 py-1 rounded bg-gray-100 dark:bg-slate-700 border hover:bg-gray-200 dark:border-slate-600 text-gray-500">${state.hideValues ? 'Mostrar' : 'Ocultar'} Valores</button>
                    </div>
                    <div class="p-4 sm:p-5 flex-1 relative min-h-75">
                        ${getChartHtml()}
                    </div>
                </div>

                <!-- Alertas de Estoque Baixo -->
                <div class="bg-white dark:bg-slate-800 shadow-sm rounded-2xl border border-gray-100 dark:border-slate-700 flex flex-col overflow-hidden">
                    <div class="px-5 py-4 border-b bg-red-50/50 dark:bg-red-900/10 dark:border-slate-700 shrink-0">
                        <h3 class="text-lg font-bold text-red-600 dark:text-red-400 flex items-center tracking-tight">
                            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            Atenção: Estoque Baixo
                        </h3>
                    </div>
                    <div class="flex-1 p-0 overflow-y-auto max-h-87.5">
                        <ul class="divide-y divide-gray-100 dark:divide-slate-700/60">
                            ${renderLowStock()}
                        </ul>
                    </div>
                    <div class="border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 p-4 shrink-0">
                        <a href="/pages/products.html" class="text-sm font-bold text-brand-600 dark:text-brand-400 hover:text-brand-900 block text-center uppercase tracking-wide">Ir para Estoque</a>
                    </div>
                </div>
            </div>
        `;

        setupListeners();
    }

    function renderStatCard(title: string, value: any, color: 'blue' | 'emerald' | 'red' | 'indigo', link: string, linkText: string, svgPath: string, isAmountColor = false) {
        const colorClasses: Record<string, string> = {
            blue: 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
            emerald: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
            red: 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20',
            indigo: 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20',
        };

        const textClass = isAmountColor
            ? (color === 'emerald'
                ? 'text-emerald-600 dark:text-emerald-400'
                : (color === 'red'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-900 dark:text-gray-100'))
            : 'text-gray-900 dark:text-gray-100';

        return `
            <div class="bg-white dark:bg-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow rounded-2xl border border-gray-100 dark:border-slate-700">
                <div class="p-5 flex items-center">
                    <div class="shrink-0 rounded-xl p-3 border shadow-sm ${colorClasses[color]}">
                        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${svgPath}" /></svg>
                    </div>
                    <div class="ml-5 w-0 flex-1 relative">
                        <div class="text-[13px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">${title}</div>
                        <div class="text-2xl font-black ${textClass} tracking-tight truncate">
                            ${state.hideValues ? 'R$ •••••' : formatCurrency(value)}
                        </div>
                    </div>
                </div>
                <div class="bg-gray-50 dark:bg-slate-900/50 px-5 py-3 border-t dark:border-slate-700 text-sm">
                    <a href="${link}" class="font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1">${linkText} <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></a>
                </div>
            </div>
        `;
    }

    function renderCountCard(title: string, value: any, color: 'amber' | 'purple', link: string, linkText: string, svgPath: string) {
        const colorClasses: Record<string, string> = {
            amber: 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
            purple: 'bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
        };

        return `
            <div class="bg-white dark:bg-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow rounded-2xl border border-gray-100 dark:border-slate-700">
                <div class="p-5 flex items-center">
                    <div class="shrink-0 rounded-xl p-3 border shadow-sm ${colorClasses[color]}">
                        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${svgPath}" /></svg>
                    </div>
                    <div class="ml-5 w-0 flex-1">
                        <div class="text-[13px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">${title}</div>
                        <div class="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">${Number(value || 0)}</div>
                    </div>
                </div>
                <div class="bg-gray-50 dark:bg-slate-900/50 px-5 py-3 border-t dark:border-slate-700 text-sm">
                    <a href="${link}" class="font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1">${linkText} <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></a>
                </div>
            </div>
        `;
    }

    function renderLowStock() {
        const items = state.analytics.low_stock || [];
        if (!items || items.length === 0) {
            return `
                <li class="py-8 text-center text-sm text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center">
                    <svg class="w-8 h-8 text-green-500 mb-2 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span>Nenhum alerta. Estoque saudável.</span>
                </li>
            `;
        }

        return items.map((p) => `
            <li class="py-3 flex justify-between items-center px-5 hover:bg-red-50 dark:hover:bg-red-900/10 cursor-pointer transition-colors" onclick="window.location.href='/pages/products.html'">
                <div class="flex items-center min-w-0 pr-2 flex-1">
                    <span class="w-2 h-2 bg-red-500 rounded-full mr-3 shrink-0"></span>
                    <span class="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">${String(p?.name || '')}</span>
                </div>
                <div class="text-sm font-mono font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded shrink-0">
                    ${Number(p?.current_stock || 0)} <span class="text-xs font-normal">${String(p?.measure || 'UN')}</span>
                </div>
            </li>
        `).join('');
    }

    function getChartHtml() {
        const chartData = state.analytics.chart;
        if (!chartData || !chartData.labels || chartData.labels.length === 0) {
            return `<div class="w-full h-full flex items-center justify-center text-gray-400">Sem dados financeiros no momento.</div>`;
        }

        const labels = chartData.labels || [];
        const incomes = chartData.income || [];
        const expenses = chartData.expense || [];

        const points = labels.map((label, index) => {
            const rawIncome = Number(incomes[index] || 0);
            const rawExpense = Number(expenses[index] || 0);
            return {
                label,
                income: state.showIncome ? rawIncome : 0,
                expense: state.showExpense ? rawExpense : 0,
                rawIncome,
                rawExpense,
            };
        });

        let activeVals: number[] = [1];
        if (state.showIncome) activeVals = activeVals.concat(points.map((p) => p.income));
        if (state.showExpense) activeVals = activeVals.concat(points.map((p) => p.expense));
        const maxValue = Math.max(1, ...activeVals);

        const columnsHtml = points.map((point) => {
            const incomeHeight = Math.max(0, Math.round((point.income / maxValue) * 208));
            const expenseHeight = Math.max(0, Math.round((point.expense / maxValue) * 208));

            const incHtml = state.showIncome ? `
                <div class="group relative flex-1 flex items-end justify-center h-full">
                    <div class="w-full max-w-8 rounded-t-lg hover:opacity-80 transition-all duration-500 ease-out" style="height:${incomeHeight}px; min-height: 4px; background-color: rgba(34, 197, 94, 0.8);"></div>
                    <div class="absolute bottom-full mb-2 hidden group-hover:block whitespace-nowrap rounded-md bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-xl z-20">
                        R: ${state.hideValues ? 'R$ •••••' : formatCurrency(point.rawIncome)}
                    </div>
                </div>` : '';

            const expHtml = state.showExpense ? `
                <div class="group relative flex-1 flex items-end justify-center h-full">
                    <div class="w-full max-w-8 rounded-t-lg hover:opacity-80 transition-all duration-500 ease-out" style="height:${expenseHeight}px; min-height: 4px; background-color: rgba(239, 68, 68, 0.8);"></div>
                    <div class="absolute bottom-full mb-2 hidden group-hover:block whitespace-nowrap rounded-md bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-xl z-20">
                        D: ${state.hideValues ? 'R$ •••••' : formatCurrency(point.rawExpense)}
                    </div>
                </div>` : '';

            return `
                <div class="w-18.5 min-w-18.5 shrink-0 sm:min-w-26 sm:flex-1 sm:w-auto flex flex-col justify-end transition-all duration-300">
                    <div class="relative h-52 sm:h-60 rounded-xl bg-gray-50 dark:bg-slate-900/70 border border-gray-100 dark:border-slate-700 px-2 py-3 flex items-end gap-2">
                        ${incHtml}
                        ${expHtml}
                    </div>
                    <div class="mt-3 text-center leading-tight">
                        <div class="text-xs font-bold text-gray-700 dark:text-gray-200">${point.label}</div>
                        <div class="mt-1 text-[10px] sm:text-[11px] font-medium text-gray-400 dark:text-gray-500 truncate px-1">
                            <span class="text-green-500">R: ${point.rawIncome > 999 ? (point.rawIncome / 1000).toFixed(1) + 'k' : point.rawIncome.toFixed(2)}</span>
                            <span class="text-gray-300 dark:text-gray-600">|</span>
                            <span class="text-red-500">D: ${point.rawExpense > 999 ? (point.rawExpense / 1000).toFixed(1) + 'k' : point.rawExpense.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="h-full w-full min-w-0 flex flex-col overflow-hidden absolute inset-0 p-4 sm:p-5">
                <div class="mb-4 flex flex-wrap items-center justify-start gap-3 text-xs sm:justify-end sm:gap-4 sm:text-sm">
                    <button id="toggleIncome" class="flex items-center gap-2 px-2 py-1 rounded-md transition-all duration-200 outline-none ${state.showIncome ? 'text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-slate-700/80' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'}">
                        <span class="w-3 h-3 rounded-full transition-colors ${state.showIncome ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-gray-300 dark:bg-slate-600'}"></span>
                        <span class="font-bold">Receitas</span>
                    </button>
                    <button id="toggleExpense" class="flex items-center gap-2 px-2 py-1 rounded-md transition-all duration-200 outline-none ${state.showExpense ? 'text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-slate-700/80' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'}">
                        <span class="w-3 h-3 rounded-full transition-colors ${state.showExpense ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 'bg-gray-300 dark:bg-slate-600'}"></span>
                        <span class="font-bold">Despesas</span>
                    </button>
                </div>
                <div class="flex-1 min-w-0 w-full flex items-end gap-2 overflow-x-auto overflow-y-hidden pb-2 sm:gap-4">
                    ${columnsHtml}
                </div>
            </div>
        `;
    }

    function setupListeners() {
        const btnToggleValues = document.getElementById('btnToggleValues');
        if (btnToggleValues) {
            btnToggleValues.addEventListener('click', () => {
                state.hideValues = !state.hideValues;
                localStorage.setItem('hideDashboardValues', String(state.hideValues));
                render();
            });
        }

        const toggleIncome = document.getElementById('toggleIncome');
        if (toggleIncome) {
            toggleIncome.addEventListener('click', () => {
                state.showIncome = !state.showIncome;
                render();
            });
        }

        const toggleExpense = document.getElementById('toggleExpense');
        if (toggleExpense) {
            toggleExpense.addEventListener('click', () => {
                state.showExpense = !state.showExpense;
                render();
            });
        }
    }

    async function loadData() {
        state.loading = true;
        render();

        try {
            const [userRes, analyticsRes] = await Promise.all([
                api('/auth/me'),
                api('/finance/analytics/dashboard'),
            ]);

            state.user = (userRes as any)?.data?.user || (userRes as any)?.data;
            state.analytics = ((analyticsRes as any)?.data || {}) as DashboardAnalytics;
        } catch (err) {
            console.error('Erro ao montar dashboard:', err);
            if (window.SharedFooter) window.SharedFooter.clearCompanyContext();
        } finally {
            state.loading = false;
            render();
        }
    }

    // --- Init ---
    if (typeof Auth !== 'undefined' && !Auth.isAuthenticated()) {
        window.location.href = '/';
        return;
    }

    loadData();
});
