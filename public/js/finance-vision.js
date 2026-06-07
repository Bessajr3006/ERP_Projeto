document.addEventListener('DOMContentLoaded', () => {
    const FINANCE_VISION_BANK_STORAGE_KEY = 'finance_vision_selected_bank';

    const state = {
        loading: true,
        error: '',
        banks: [],
        selectedBankPublicId: localStorage.getItem(FINANCE_VISION_BANK_STORAGE_KEY) || '',
        analytics: {
            total_balance: 0,
            total_receivables: 0,
            total_payables: 0,
            sales_today_amount: 0,
            sales_today_count: 0,
            chart: { labels: [], income: [], expense: [] },
        },
    };

    const app = document.getElementById('finance-vision-app');

    const formatCurrency = (value) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

    function renderBankOptions() {
        const options = [
            '<option value="">Todas as contas bancárias</option>',
            ...state.banks.map((bank) => {
                const selected = state.selectedBankPublicId === bank.public_id ? 'selected' : '';
                const balance = formatCurrency(bank.current_balance || 0);
                return `<option value="${bank.public_id}" ${selected}>${bank.name} (${balance})</option>`;
            }),
        ];
        return options.join('');
    }

    function renderLoading() {
        if (!app) return;
        app.innerHTML = `
            <div class="flex items-center justify-center h-64 text-gray-500">
                <div class="flex flex-col items-center gap-4">
                    <svg class="animate-spin h-8 w-8 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    <span>Carregando Visão Financeiro...</span>
                </div>
            </div>
        `;
    }

    function renderError() {
        if (!app) return;
        app.innerHTML = `
            <div class="p-4 sm:p-0">
                <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                    Não foi possível carregar a visão financeira. ${state.error ? String(state.error) : ''}
                </div>
            </div>
        `;
    }

    function renderKpiCard(title, value, subtitle, colorClass, iconPath) {
        return `
            <article class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">${title}</p>
                        <p class="mt-2 text-2xl font-black tracking-tight ${colorClass}">${value}</p>
                        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">${subtitle}</p>
                    </div>
                    <span class="rounded-xl border border-brand-200 bg-brand-100 p-2 text-brand-600 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-300">
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}"></path>
                        </svg>
                    </span>
                </div>
            </article>
        `;
    }

    function renderChartRows() {
        const labels = state.analytics.chart?.labels || [];
        const incomes = state.analytics.chart?.income || [];
        const expenses = state.analytics.chart?.expense || [];

        if (!labels.length) {
            return '<div class="text-sm text-gray-500 dark:text-gray-400">Sem dados para o período.</div>';
        }

        return labels.map((label, index) => {
            const income = Number(incomes[index] || 0);
            const expense = Number(expenses[index] || 0);
            const balance = income - expense;
            const balanceClass = balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';

            return `
                <tr class="border-b border-gray-100 dark:border-slate-700 last:border-0">
                    <td class="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200">${label}</td>
                    <td class="px-4 py-2 text-xs font-mono text-emerald-600 dark:text-emerald-400">${formatCurrency(income)}</td>
                    <td class="px-4 py-2 text-xs font-mono text-red-600 dark:text-red-400">${formatCurrency(expense)}</td>
                    <td class="px-4 py-2 text-xs font-mono ${balanceClass}">${formatCurrency(balance)}</td>
                </tr>
            `;
        }).join('');
    }

    function renderDashboard() {
        if (!app) return;

        app.innerHTML = `
            <div class="px-4 sm:px-0">
                <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 class="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">Visão Financeiro</h1>
                        <p class="text-sm text-gray-500 dark:text-gray-400">Resumo executivo de caixa, recebíveis, pagáveis e evolução mensal.</p>
                    </div>
                    <div class="sm:w-80">
                        <label for="financeVisionBankSelect" class="block text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Banco</label>
                        <select id="financeVisionBankSelect" class="block w-full bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-slate-600 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500">
                            ${renderBankOptions()}
                        </select>
                    </div>
                </div>

                <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    ${renderKpiCard('Saldo em Caixa', formatCurrency(state.analytics.total_balance), 'Soma dos saldos das contas bancárias', 'text-gray-900 dark:text-gray-100', 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 10v1m9-6a9 9 0 11-18 0 9 9 0 0118 0z')}
                    ${renderKpiCard('A Receber', formatCurrency(state.analytics.total_receivables), 'Receitas pendentes vencidas/até hoje', 'text-emerald-600 dark:text-emerald-400', 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6')}
                    ${renderKpiCard('A Pagar', formatCurrency(state.analytics.total_payables), 'Despesas pendentes vencidas/até hoje', 'text-red-600 dark:text-red-400', 'M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6')}
                    ${renderKpiCard('Vendas Hoje', formatCurrency(state.analytics.sales_today_amount), `${Number(state.analytics.sales_today_count || 0)} venda(s) no dia`, 'text-indigo-600 dark:text-indigo-400', 'M3 3h2l.4 2M7 13h10l4-8H5.4')}
                </div>

                <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <section class="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
                        <header class="px-5 py-4 border-b border-gray-100 dark:border-slate-700 bg-brand-50/60 dark:bg-brand-900/10">
                            <h2 class="text-base font-bold text-gray-900 dark:text-gray-100">Evolução Mensal (Receitas x Despesas)</h2>
                        </header>
                        <div class="overflow-x-auto">
                            <table class="min-w-full">
                                <thead class="bg-gray-50 dark:bg-slate-900/40">
                                    <tr>
                                        <th class="px-4 py-2 text-left text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Mês</th>
                                        <th class="px-4 py-2 text-left text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Receitas</th>
                                        <th class="px-4 py-2 text-left text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Despesas</th>
                                        <th class="px-4 py-2 text-left text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Saldo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${renderChartRows()}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
                        <header class="px-5 py-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-900/40">
                            <h2 class="text-base font-bold text-gray-900 dark:text-gray-100">Ações Rápidas</h2>
                        </header>
                        <div class="p-4 space-y-3">
                            <a href="/pages/revenues.html" class="block rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">Ir para Receitas</a>
                            <a href="/pages/expenses.html" class="block rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Ir para Despesas</a>
                            <a href="/pages/banks.html" class="block rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">Ir para Bancos</a>
                            <a href="/pages/statements.html" class="block rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">Ir para Extrato</a>
                        </div>
                    </section>
                </div>
            </div>
        `;

        const select = document.getElementById('financeVisionBankSelect');
        if (select) {
            select.addEventListener('change', (event) => {
                state.selectedBankPublicId = event.target.value || '';
                localStorage.setItem(FINANCE_VISION_BANK_STORAGE_KEY, state.selectedBankPublicId);
                loadData();
            });
        }
    }

    async function loadBanks() {
        try {
            const response = await api('/bank-accounts');
            state.banks = Array.isArray(response?.data) ? response.data : [];

            if (state.selectedBankPublicId && !state.banks.some((bank) => bank.public_id === state.selectedBankPublicId)) {
                state.selectedBankPublicId = '';
                localStorage.setItem(FINANCE_VISION_BANK_STORAGE_KEY, '');
            }
        } catch (error) {
            console.error('Erro ao carregar contas bancárias para filtro:', error);
            state.banks = [];
        }
    }

    async function loadData() {
        state.loading = true;
        state.error = '';
        renderLoading();

        try {
            const query = state.selectedBankPublicId
                ? `?bankAccountPublicId=${encodeURIComponent(state.selectedBankPublicId)}`
                : '';
            const response = await api(`/finance/analytics/dashboard${query}`);
            state.analytics = {
                ...state.analytics,
                ...(response?.data || {}),
            };
        } catch (error) {
            console.error('Erro ao carregar visão financeira:', error);
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

    loadBanks().finally(() => {
        loadData();
    });
});
