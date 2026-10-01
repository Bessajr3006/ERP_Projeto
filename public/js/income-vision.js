(() => {
    const STATES = [
        { uf: 'AC', name: 'Acre' },
        { uf: 'AL', name: 'Alagoas' },
        { uf: 'AP', name: 'Amapá' },
        { uf: 'AM', name: 'Amazonas' },
        { uf: 'BA', name: 'Bahia' },
        { uf: 'CE', name: 'Ceará' },
        { uf: 'DF', name: 'Distrito Federal' },
        { uf: 'ES', name: 'Espírito Santo' },
        { uf: 'GO', name: 'Goiás' },
        { uf: 'MA', name: 'Maranhão' },
        { uf: 'MT', name: 'Mato Grosso' },
        { uf: 'MS', name: 'Mato Grosso do Sul' },
        { uf: 'MG', name: 'Minas Gerais' },
        { uf: 'PA', name: 'Pará' },
        { uf: 'PB', name: 'Paraíba' },
        { uf: 'PR', name: 'Paraná' },
        { uf: 'PE', name: 'Pernambuco' },
        { uf: 'PI', name: 'Piauí' },
        { uf: 'RJ', name: 'Rio de Janeiro' },
        { uf: 'RN', name: 'Rio Grande do Norte' },
        { uf: 'RS', name: 'Rio Grande do Sul' },
        { uf: 'RO', name: 'Rondônia' },
        { uf: 'RR', name: 'Roraima' },
        { uf: 'SC', name: 'Santa Catarina' },
        { uf: 'SP', name: 'São Paulo' },
        { uf: 'SE', name: 'Sergipe' },
        { uf: 'TO', name: 'Tocantins' }
    ];
    const state = {
        loading: true,
        municipalities: [],
        selectedState: 'RJ', // Default to RJ to load Niteroi/Rio easily
        selectedMunicipalityId: '3303302', // Default to Niteroi
        incomeData: [],
        loadingSidra: false
    };
    const getById = (id) => document.getElementById(id);
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    function formatCurrency(val) {
        const num = parseFloat(String(val));
        if (isNaN(num))
            return 'N/A';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
    }
    async function loadMunicipalities() {
        state.loading = true;
        renderLoading();
        try {
            const res = await api(`/census/data?state=${state.selectedState}`);
            if (res && res.status === 'success') {
                state.municipalities = res.data || [];
                // If current selected municipality not in new state, update to first available
                const stillExists = state.municipalities.some(m => m.municipality_id === state.selectedMunicipalityId);
                if (!stillExists && state.municipalities.length > 0) {
                    state.selectedMunicipalityId = state.municipalities[0].municipality_id;
                }
            }
            else {
                state.municipalities = [];
            }
        }
        catch (error) {
            console.error('Error loading municipalities:', error);
            state.municipalities = [];
        }
        finally {
            state.loading = false;
        }
    }
    async function fetchSidraIncome() {
        if (!state.selectedMunicipalityId) {
            state.incomeData = [];
            return;
        }
        state.loadingSidra = true;
        renderLoadingSidra();
        try {
            // Directly fetch from IBGE SIDRA API (supports CORS)
            const url = `https://apisidra.ibge.gov.br/values/t/608/n6/${state.selectedMunicipalityId}/v/93/p/all`;
            const response = await fetch(url);
            if (!response.ok)
                throw new Error('Falha na requisição da API SIDRA');
            const data = await response.json();
            if (Array.isArray(data) && data.length > 1) {
                // Slices out the first header element
                state.incomeData = data.slice(1);
            }
            else {
                state.incomeData = [];
            }
        }
        catch (error) {
            console.error('Error fetching SIDRA data:', error);
            state.incomeData = [];
        }
        finally {
            state.loadingSidra = false;
            renderMainLayout();
        }
    }
    function renderLoading() {
        const app = getById('income-vision-app');
        if (app) {
            app.innerHTML = `
                <div class="flex items-center justify-center h-64 text-gray-500">
                    <div class="flex flex-col items-center gap-4">
                        <svg class="animate-spin h-8 w-8 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Carregando municípios...</span>
                    </div>
                </div>
            `;
        }
    }
    function renderLoadingSidra() {
        const body = getById('sidraContentBody');
        if (body) {
            body.innerHTML = `
                <div class="flex items-center justify-center h-48 text-gray-500 col-span-2">
                    <div class="flex flex-col items-center gap-3">
                        <svg class="animate-spin h-6 w-6 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span class="text-xs">Consultando API SIDRA (IBGE)...</span>
                    </div>
                </div>
            `;
        }
    }
    function renderMainLayout() {
        const app = getById('income-vision-app');
        if (!app)
            return;
        // Render controls row
        const controlsRow = `
            <div class="bg-white dark:bg-slate-800 shadow-sm rounded-xl border border-gray-200/50 dark:border-slate-700 px-6 py-4 flex flex-col lg:flex-row items-center justify-between gap-4 print:hidden">
                <div class="w-full lg:flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="flex items-center gap-2">
                        <label for="stateSelect" class="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">UF:</label>
                        <select id="stateSelect" class="w-full rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500">
                            ${STATES.map(s => `<option value="${s.uf}" ${state.selectedState === s.uf ? 'selected' : ''}>${s.name} (${s.uf})</option>`).join('')}
                        </select>
                    </div>

                    <div class="flex items-center gap-2">
                        <label for="municipalitySelect" class="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">Município:</label>
                        <select id="municipalitySelect" class="w-full rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500">
                            ${state.municipalities.map(m => `<option value="${m.municipality_id}" ${state.selectedMunicipalityId === m.municipality_id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>
        `;
        // Render stats and tables from SIDRA data
        let contentHtml = '';
        if (state.loadingSidra) {
            contentHtml = `
                <div id="sidraContentBody" class="flex items-center justify-center h-64 text-gray-500 bg-white dark:bg-slate-800 shadow-sm rounded-xl border border-gray-200/50 dark:border-slate-700">
                    <div class="flex flex-col items-center gap-4">
                        <svg class="animate-spin h-8 w-8 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Buscando dados na API SIDRA...</span>
                    </div>
                </div>
            `;
        }
        else if (state.incomeData.length > 0) {
            const latest = state.incomeData[0];
            const rendaValor = parseFloat(latest.V);
            const cityName = latest.D3N;
            const variableName = latest.D2N;
            const cardsHtml = `
                <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div class="bg-white dark:bg-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow rounded-2xl border border-gray-200/50 dark:border-slate-700 p-5">
                        <div class="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">Rendimento Médio Mensal</div>
                        <div class="text-3xl font-black text-brand-600 dark:text-brand-400 mt-1">${formatCurrency(rendaValor)}</div>
                        <div class="text-xs text-gray-400 mt-1 truncate">Dado oficial (IBGE Censo)</div>
                    </div>
                    <div class="bg-white dark:bg-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow rounded-2xl border border-gray-200/50 dark:border-slate-700 p-5">
                        <div class="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">Cidade Analisada</div>
                        <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 truncate">${escapeHtml(cityName)}</div>
                        <div class="text-xs text-gray-400 mt-1 truncate">Código IBGE: ${state.selectedMunicipalityId}</div>
                    </div>
                    <div class="bg-white dark:bg-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow rounded-2xl border border-gray-200/50 dark:border-slate-700 p-5">
                        <div class="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">Medida</div>
                        <div class="text-2xl font-black text-teal-600 dark:text-teal-400 mt-1">${escapeHtml(latest.MN)} nominal</div>
                        <div class="text-xs text-gray-400 mt-1 truncate">Unidade: ${escapeHtml(latest.MN)}</div>
                    </div>
                </div>
            `;
            const rowsHtml = state.incomeData.map(item => `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">${escapeHtml(item.D1N)}</td>
                    <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">${escapeHtml(item.D2N)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500 dark:text-gray-400 font-mono">${escapeHtml(item.D3N)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-black text-brand-600 dark:text-brand-400 font-mono">${formatCurrency(item.V)}</td>
                </tr>
            `).join('');
            contentHtml = `
                ${cardsHtml}

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Left: Description and variable detail card -->
                    <div class="bg-white dark:bg-slate-800 shadow-sm rounded-xl border border-gray-200/50 dark:border-slate-700 p-6 flex flex-col justify-between">
                        <div>
                            <h2 class="text-base font-bold text-gray-900 dark:text-gray-100 mb-3">Informações da Variável</h2>
                            <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">${escapeHtml(variableName)}</p>
                            <div class="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700/50 space-y-2">
                                <div class="flex justify-between text-xs"><span class="text-gray-400">Tabela SIDRA:</span><span class="font-semibold text-gray-700 dark:text-gray-300">Tabela 608</span></div>
                                <div class="flex justify-between text-xs"><span class="text-gray-400">Território:</span><span class="font-semibold text-gray-700 dark:text-gray-300">${escapeHtml(latest.NN)}</span></div>
                                <div class="flex justify-between text-xs"><span class="text-gray-400">Moeda:</span><span class="font-semibold text-gray-700 dark:text-gray-300">${escapeHtml(latest.MN)}</span></div>
                            </div>
                        </div>
                        <div class="mt-6 pt-4 border-t border-gray-100 dark:border-slate-700/50 text-xs text-gray-400 leading-relaxed">
                            Nota: Rendimento mensal médio nominal das pessoas de 10 anos ou mais de idade, com rendimento, residentes no município. Fonte: IBGE (Censo Demográfico).
                        </div>
                    </div>

                    <!-- Right: Table Card -->
                    <div class="lg:col-span-2 bg-white dark:bg-slate-800 shadow-sm rounded-xl border border-gray-200/50 dark:border-slate-700 overflow-hidden">
                        <h2 class="text-base font-bold text-gray-900 dark:text-gray-100 px-6 py-4 border-b border-gray-200/50 dark:border-slate-700 shrink-0">
                            Séries Temporais Disponíveis
                        </h2>
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead class="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">Período</th>
                                        <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Variável</th>
                                        <th scope="col" class="px-6 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Município</th>
                                        <th scope="col" class="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">Renda Média</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-200 dark:divide-slate-700 bg-white dark:bg-slate-800">${rowsHtml}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }
        else {
            contentHtml = `
                <div class="bg-white dark:bg-slate-800 shadow-sm rounded-xl border border-gray-200/50 dark:border-slate-700 p-8 text-center text-gray-500">
                    <svg class="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    <p class="text-sm font-semibold">Nenhum dado retornado da API SIDRA do IBGE.</p>
                    <p class="text-xs text-gray-400 mt-1">Verifique se o município selecionado possui dados cadastrados na Tabela 608 do IBGE.</p>
                </div>
            `;
        }
        app.innerHTML = `
            <div class="space-y-6">
                <!-- Header block -->
                <div class="bg-white dark:bg-slate-800 shadow-sm rounded-xl border border-gray-200/50 dark:border-slate-700 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2.5">
                            <svg class="h-6 w-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            Visão Renda (SIDRA - IBGE)
                        </h1>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Rendimento nominal médio mensal das pessoas de 10 anos ou mais de idade (Tabela 608)</p>
                    </div>
                    <div class="flex items-center gap-2 self-start md:self-auto print:hidden">
                        <button type="button" id="btnExportCsv" class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-gray-700 bg-white dark:text-gray-200 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                            <svg class="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                            Exportar CSV
                        </button>
                        <button type="button" id="btnPrintReport" class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-gray-700 bg-white dark:text-gray-200 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                            <svg class="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                            Imprimir
                        </button>
                    </div>
                </div>

                ${controlsRow}

                ${contentHtml}
            </div>
        `;
        bindEvents();
    }
    function bindEvents() {
        const selectState = getById('stateSelect');
        if (selectState) {
            selectState.value = state.selectedState;
            selectState.addEventListener('change', async (e) => {
                state.selectedState = e.target.value;
                await loadMunicipalities();
                fetchSidraIncome();
            });
        }
        const selectMunicipality = getById('municipalitySelect');
        if (selectMunicipality) {
            selectMunicipality.value = state.selectedMunicipalityId;
            selectMunicipality.addEventListener('change', (e) => {
                state.selectedMunicipalityId = e.target.value;
                fetchSidraIncome();
            });
        }
        getById('btnExportCsv')?.addEventListener('click', exportCsv);
        getById('btnPrintReport')?.addEventListener('click', () => window.print());
    }
    function exportCsv() {
        if (state.incomeData.length === 0)
            return;
        const headers = ['Periodo', 'Variavel', 'Municipio', 'Renda'];
        const rows = state.incomeData.map(item => [
            item.D1N,
            item.D2N,
            item.D3N,
            item.V
        ]);
        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `rendimento_ibge_${state.selectedMunicipalityId}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    // Startup execution
    document.addEventListener('DOMContentLoaded', async () => {
        await loadMunicipalities();
        fetchSidraIncome();
    });
})();
