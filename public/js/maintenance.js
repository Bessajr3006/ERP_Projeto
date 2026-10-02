/// <reference path="./api.ts" />
(() => {
    const getById = (id) => document.getElementById(id);
    // Guard rows locally to enable Inspection modal access
    let g_queryRows = [];
    // Helper to format values elegantly
    function formatCellVal(val) {
        if (val === null || val === undefined) {
            return '<span class="text-gray-400 dark:text-gray-600 italic">null</span>';
        }
        if (typeof val === 'object') {
            try {
                return JSON.stringify(val);
            }
            catch (_e) {
                return '[Object]';
            }
        }
        if (typeof val === 'boolean') {
            return val ? '<span class="text-emerald-600 dark:text-emerald-400 font-semibold">TRUE</span>' : '<span class="text-rose-600 dark:text-rose-400 font-semibold">FALSE</span>';
        }
        const str = String(val).trim();
        // If looks like an ISO date or timestamp, format cleanly
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str)) {
            try {
                const date = new Date(str);
                if (!isNaN(date.getTime())) {
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    return `${day}/${month}/${year} ${hours}:${minutes}`;
                }
            }
            catch (_e) { }
        }
        return escapeHtml(str);
    }
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    let g_lastFailedOperation = null;
    function isConnectionError(msg) {
        const m = String(msg || '').toLowerCase();
        return m.includes('connect') || m.includes('esocket') || m.includes('timeout') ||
            m.includes('timed out') || m.includes('unreachable') || m.includes('refused') ||
            m.includes('offline') || m.includes('failed to fetch') || m.includes('sem conexao') ||
            m.includes('unreachable') || m.includes('timedout');
    }
    function showNoConnectionModal(customMsg) {
        const modal = getById('noConnectionModal');
        const msgEl = getById('noConnectionModalMessage');
        if (modal) {
            if (msgEl && customMsg) {
                msgEl.textContent = customMsg;
            }
            modal.classList.remove('hidden');
        }
    }
    function closeNoConnectionModal() {
        const modal = getById('noConnectionModal');
        if (modal)
            modal.classList.add('hidden');
    }
    function showAlert(msg, type = 'success') {
        const el = getById('alertMessage');
        if (!el)
            return;
        el.textContent = msg;
        el.className = `mx-4 sm:mx-0 mb-4 p-4 rounded-xl text-sm font-medium ${type === 'success' ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-800/30' : 'bg-red-50 text-red-800 border border-red-200 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-800/30'}`;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 5000);
    }
    async function handleExecute() {
        const sqlInput = getById('sqlQueryText');
        if (!sqlInput)
            return;
        const query = sqlInput.value.trim();
        if (!query) {
            showAlert('Por favor, escreva uma consulta SQL.', 'error');
            return;
        }
        // Show table loading state
        const thead = getById('resultsThead');
        const tbody = getById('resultsTbody');
        const countBadge = getById('resultsCountBadge');
        if (thead)
            thead.innerHTML = `<tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aguardando...</th></tr>`;
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td class="px-6 py-12 text-center text-sm text-gray-500">
                        <div class="flex items-center justify-center gap-2">
                            <svg class="animate-spin h-5 w-5 text-rose-500" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Executando consulta no banco de dados...
                        </div>
                    </td>
                </tr>
            `;
        }
        if (countBadge)
            countBadge.classList.add('hidden');
        const dbType = getById('dbTargetSelect')?.value || 'sistema';
        const selectEl = getById('dbTablesSelect');
        const selectedTable = selectEl?.value || '';
        let action = 'table_counts';
        if (selectedTable) {
            action = 'table_schema';
        }
        else if (query.toLowerCase().includes('status') || query.toLowerCase().includes('version')) {
            action = 'status';
        }
        else if (query.toLowerCase().includes('storage') || query.toLowerCase().includes('size')) {
            action = 'storage';
        }
        else if (query.toLowerCase().includes('process')) {
            action = 'processes';
        }
        else if (dbType !== 'sistema') {
            action = 'external_ping';
        }
        try {
            const res = await api('/maintenance/diagnostics', {
                method: 'POST',
                body: JSON.stringify({ action, tableName: selectedTable, databaseType: dbType })
            });
            if (res && res.status === 'success') {
                const { rows, columns } = res.data || { rows: [], columns: [] };
                g_queryRows = rows || [];
                if (columns.length === 0) {
                    if (thead)
                        thead.innerHTML = `<tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th></tr>`;
                    if (tbody) {
                        tbody.innerHTML = `
                            <tr>
                                <td class="px-6 py-8 text-center text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                                    Comando executado com sucesso! Nenhuma linha retornada.
                                </td>
                            </tr>
                        `;
                    }
                    if (countBadge)
                        countBadge.classList.add('hidden');
                    return;
                }
                // Render table headers
                if (thead) {
                    const headerHtml = columns.map((col) => `
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">${escapeHtml(col)}</th>
                    `).join('');
                    thead.innerHTML = `
                        <tr>
                            ${headerHtml}
                            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
                        </tr>
                    `;
                }
                // Render table body rows
                if (tbody) {
                    if (g_queryRows.length === 0) {
                        tbody.innerHTML = `
                            <tr>
                                <td colspan="${columns.length + 1}" class="px-6 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                                    Nenhum registro encontrado para esta consulta.
                                </td>
                            </tr>
                        `;
                    }
                    else {
                        tbody.innerHTML = g_queryRows.map((row, rIdx) => {
                            const cellsHtml = columns.map((col) => `
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-mono max-w-xs truncate">${formatCellVal(row[col])}</td>
                            `).join('');
                            return `
                                <tr>
                                    ${cellsHtml}
                                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button type="button" class="inspect-btn text-brand-600 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300 font-semibold cursor-pointer select-none px-2 py-1 text-xs rounded border border-brand-100 hover:bg-brand-50 dark:border-slate-700 dark:hover:bg-slate-700/50 inline-flex items-center gap-1" data-idx="${rIdx}">
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                            </svg>
                                            Inspecionar
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('');
                        // Bind inspect button listeners
                        const btns = tbody.querySelectorAll('.inspect-btn');
                        btns.forEach(btn => {
                            btn.addEventListener('click', (e) => {
                                const target = e.currentTarget;
                                if (!target)
                                    return;
                                const idxAttr = target.getAttribute('data-idx');
                                if (idxAttr !== null) {
                                    const idx = Number(idxAttr);
                                    openInspectModal(idx);
                                }
                            });
                        });
                    }
                }
                // Update count badge
                if (countBadge) {
                    countBadge.textContent = `${g_queryRows.length} registro(s) retornado(s)`;
                    countBadge.classList.remove('hidden');
                }
            }
            else {
                const errMsg = res?.message || 'Erro desconhecido ao executar consulta.';
                showErrorState(errMsg);
                if (isConnectionError(errMsg)) {
                    g_lastFailedOperation = handleExecute;
                    showNoConnectionModal(`Erro de conexão com o banco: ${errMsg}`);
                }
            }
        }
        catch (err) {
            const errMsg = err.message || 'Erro de rede ou conexão com o servidor.';
            showErrorState(errMsg);
            if (isConnectionError(errMsg)) {
                g_lastFailedOperation = handleExecute;
                showNoConnectionModal(`Falha ao se conectar com o banco de dados: ${errMsg}`);
            }
        }
    }
    function showErrorState(msg) {
        const thead = getById('resultsThead');
        const tbody = getById('resultsTbody');
        const countBadge = getById('resultsCountBadge');
        if (thead)
            thead.innerHTML = `<tr><th class="px-6 py-3 text-left text-xs font-medium text-rose-500 uppercase tracking-wider">Falha na Execução</th></tr>`;
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td class="px-6 py-8 text-left text-sm text-red-600 dark:text-red-400 font-semibold bg-red-50 dark:bg-rose-950/20 border-l-4 border-rose-500 font-mono whitespace-pre-wrap">
                        ${escapeHtml(msg)}
                    </td>
                </tr>
            `;
        }
        if (countBadge)
            countBadge.classList.add('hidden');
    }
    function handleClear() {
        const sqlInput = getById('sqlQueryText');
        if (sqlInput)
            sqlInput.value = '';
        const thead = getById('resultsThead');
        const tbody = getById('resultsTbody');
        const countBadge = getById('resultsCountBadge');
        if (thead)
            thead.innerHTML = `<tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aguardando execução...</th></tr>`;
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td class="px-6 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                        Insira uma consulta SQL e clique em Executar para visualizar os dados aqui.
                    </td>
                </tr>
            `;
        }
        if (countBadge)
            countBadge.classList.add('hidden');
        g_queryRows = [];
    }
    function openInspectModal(idx) {
        const modal = getById('rowDetailsModal');
        const pre = getById('rowDetailsPre');
        if (!modal || !pre)
            return;
        const row = g_queryRows[idx];
        pre.textContent = JSON.stringify(row, null, 4);
        modal.classList.remove('hidden');
    }
    function closeInspectModal() {
        const modal = getById('rowDetailsModal');
        if (modal)
            modal.classList.add('hidden');
    }
    // Initialize layout setup and authority checks
    document.addEventListener('DOMContentLoaded', async () => {
        // Authenticate superadmin or general admin
        try {
            const me = await api('/auth/me');
            const role = me?.data?.user?.role || me?.user?.role || '';
            const company = me?.data?.company || me?.company || null;
            const isGeneralAdmin = company?.is_general_admin === 1 || company?.is_general_admin === true;
            if (role !== 'super_admin' && role !== 'admin' && !isGeneralAdmin) {
                // Deny view
                const container = document.querySelector('main');
                if (container) {
                    container.innerHTML = `
                        <div class="mx-4 my-10 p-8 bg-red-50 dark:bg-rose-950/20 border border-red-200 dark:border-rose-900/30 rounded-xl text-center">
                            <h3 class="text-lg font-bold text-red-800 dark:text-rose-400 mb-2">Acesso Negado</h3>
                            <p class="text-sm text-red-600 dark:text-rose-300">Esta tela é de uso exclusivo de Administradores do sistema para manutenção do banco de dados.</p>
                        </div>
                    `;
                }
                return;
            }
        }
        catch (_e) {
            window.location.href = '/';
            return;
        }
        // Load table names
        async function loadTables() {
            const selectEl = getById('dbTablesSelect');
            const targetSelect = getById('dbTargetSelect');
            const typeSelect = getById('tableTypeSelect');
            if (!selectEl)
                return;
            selectEl.innerHTML = `<option value="">Carregando...</option>`;
            const dbType = targetSelect?.value || 'sistema';
            const tableType = typeSelect?.value || 'all';
            try {
                const res = await api(`/maintenance/tables?databaseType=${dbType}&type=${tableType}`);
                if (res && res.status === 'success') {
                    const tables = res.data || [];
                    selectEl.innerHTML = `
                        <option value="">Selecione...</option>
                        ${tables.map((t) => `<option value="${t}">${t}</option>`).join('')}
                    `;
                }
                else {
                    const errMsg = res?.message || 'Erro desconhecido ao carregar tabelas.';
                    selectEl.innerHTML = `<option value="">Erro ao carregar</option>`;
                    if (isConnectionError(errMsg)) {
                        g_lastFailedOperation = loadTables;
                        showNoConnectionModal(`Não foi possível carregar a lista de tabelas: ${errMsg}`);
                    }
                }
            }
            catch (e) {
                console.error('Erro ao listar tabelas:', e);
                const errMsg = e.message || 'Erro de conexão.';
                selectEl.innerHTML = `<option value="">Erro ao carregar</option>`;
                if (isConnectionError(errMsg)) {
                    g_lastFailedOperation = loadTables;
                    showNoConnectionModal(`Falha ao se conectar com o banco de dados para listar tabelas: ${errMsg}`);
                }
            }
        }
        // Initialize table select behavior
        const selectEl = getById('dbTablesSelect');
        if (selectEl) {
            selectEl.addEventListener('change', () => {
                const tableName = selectEl.value;
                const sqlInput = getById('sqlQueryText');
                const targetSelect = getById('dbTargetSelect');
                if (tableName && sqlInput) {
                    if (targetSelect?.value === 'solidcon' || targetSelect?.value === 'dorsal' || targetSelect?.value === 'alterdata') {
                        sqlInput.value = `SELECT TOP 100 * FROM ${tableName};`;
                    }
                    else {
                        sqlInput.value = `SELECT * FROM \`${tableName}\` LIMIT 100;`;
                    }
                }
            });
        }
        // Bind target DB change listener
        const targetSelect = getById('dbTargetSelect');
        if (targetSelect) {
            targetSelect.addEventListener('change', () => {
                const sqlInput = getById('sqlQueryText');
                if (sqlInput) {
                    const isMssql = targetSelect.value === 'solidcon' || targetSelect.value === 'dorsal' || targetSelect.value === 'alterdata';
                    if (isMssql) {
                        sqlInput.placeholder = "Escreva seu comando SELECT aqui... Ex: SELECT TOP 10 * FROM wdp.tb00041;";
                        sqlInput.value = 'SELECT TOP 100 * FROM INFORMATION_SCHEMA.TABLES;';
                    }
                    else {
                        sqlInput.placeholder = "Escreva seu comando SELECT aqui... Ex: SELECT * FROM companies LIMIT 10;";
                        sqlInput.value = 'SELECT * FROM companies LIMIT 100;';
                    }
                }
                loadTables();
            });
        }
        // Bind table type change listener
        const typeSelect = getById('tableTypeSelect');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                loadTables();
            });
        }
        await loadTables();
        // Bind normal controls
        const execBtn = getById('btnExecuteSqlBtn');
        if (execBtn)
            execBtn.addEventListener('click', handleExecute);
        const clearBtn = getById('btnClearSqlBtn');
        if (clearBtn)
            clearBtn.addEventListener('click', handleClear);
        const closeBtn = getById('btnCloseDetailsBtn');
        if (closeBtn)
            closeBtn.addEventListener('click', closeInspectModal);
        const backdrop = getById('modalBackdrop');
        if (backdrop)
            backdrop.addEventListener('click', closeInspectModal);
        // Bind No Connection Modal controls
        const btnCloseNoConnection = getById('btnCloseNoConnectionModal');
        if (btnCloseNoConnection)
            btnCloseNoConnection.addEventListener('click', closeNoConnectionModal);
        const btnRetryNoConnection = getById('btnRetryNoConnection');
        if (btnRetryNoConnection) {
            btnRetryNoConnection.addEventListener('click', async () => {
                closeNoConnectionModal();
                if (g_lastFailedOperation) {
                    await g_lastFailedOperation();
                }
            });
        }
        const backdropNoConnection = getById('noConnectionModalBackdrop');
        if (backdropNoConnection)
            backdropNoConnection.addEventListener('click', closeNoConnectionModal);
    });
})();
