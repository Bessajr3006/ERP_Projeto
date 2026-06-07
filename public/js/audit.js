(() => {
    const getEl = (id) => document.getElementById(id);
    const DateUtilsRef = window.DateUtils || null;
    let g_activities = [];
    let g_users = [];
    let g_currentView = localStorage.getItem('audit_view') || 'list';

    const ACTION_LABELS = {
        CREATE: 'Criou',
        UPDATE: 'Alterou',
        DELETE: 'Removeu',
        LOGIN: 'Entrou',
        ACTIVATE: 'Ativou',
        INACTIVATE: 'Inativou',
    };

    const ACTION_CLASSES = {
        CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/40',
        UPDATE: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/40',
        DELETE: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/40',
        LOGIN: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/40',
        ACTIVATE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/40',
        INACTIVATE: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/40',
    };

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDateTime(value) {
        return DateUtilsRef?.formatDateTime?.(value) || '-';
    }

    function formatAction(action) {
        return ACTION_LABELS[action] || action || '-';
    }

    function actionClass(action) {
        return ACTION_CLASSES[action] || 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-slate-900/40 dark:text-gray-300 dark:border-slate-700';
    }

    function formatUser(activity) {
        return activity.user_name || activity.user_email || 'Sistema';
    }

    function summarizeUserAgent(userAgent) {
        const value = String(userAgent || '');
        if (!value) return '-';
        if (value.includes('Edg/')) return 'Microsoft Edge';
        if (value.includes('Chrome/')) return 'Chrome';
        if (value.includes('Firefox/')) return 'Firefox';
        if (value.includes('Safari/')) return 'Safari';
        return value.slice(0, 42);
    }

    function getFilterValues() {
        return {
            search: getEl('filterSearch')?.value || '',
            user_id: getEl('filterUser')?.value || '',
            action: getEl('filterAction')?.value || '',
            module: getEl('filterModule')?.value || '',
            date_from: getEl('filterDateFrom')?.value || '',
            date_to: getEl('filterDateTo')?.value || '',
        };
    }

    function buildQuery(params) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            const normalized = String(value || '').trim();
            if (normalized) searchParams.set(key, normalized);
        });
        searchParams.set('limit', '300');
        return searchParams.toString();
    }

    function uniqueModules(activities) {
        return Array.from(new Set(activities.map((item) => item.module).filter(Boolean))).sort();
    }

    function updateDynamicFilters() {
        const userSelect = getEl('filterUser');
        if (userSelect && userSelect.options.length <= 1) {
            const currentValue = userSelect.value;
            userSelect.innerHTML = '<option value="">Todos</option>' + g_users.map((user) => `
                <option value="${escapeHtml(user.public_id)}">${escapeHtml(user.full_name || user.email || 'Usuário')}</option>
            `).join('');
            userSelect.value = currentValue;
        }

        const moduleSelect = getEl('filterModule');
        if (moduleSelect) {
            const currentValue = moduleSelect.value;
            moduleSelect.innerHTML = '<option value="">Todos</option>' + uniqueModules(g_activities).map((module) => `
                <option value="${escapeHtml(module)}">${escapeHtml(module)}</option>
            `).join('');
            moduleSelect.value = currentValue;
        }
    }

    async function loadAudit() {
        const table = getEl('auditTable');
        if (table) {
            table.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Carregando...</td></tr>';
        }

        const query = buildQuery(getFilterValues());
        const [activitiesResponse, usersResponse] = await Promise.all([
            api(`/audit/activities?${query}`),
            api('/audit/users'),
        ]);

        g_activities = activitiesResponse.data || [];
        g_users = usersResponse.data || [];
        updateDynamicFilters();
        render();
    }

    function renderTable(items) {
        const tbody = getEl('auditTable');
        if (!tbody) return;

        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhuma atividade encontrada.</td></tr>';
            return;
        }

        tbody.innerHTML = items.map((item) => `
            <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/40">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    <div>${escapeHtml(formatUser(item))}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 font-normal">${escapeHtml(item.user_email || item.user_role || '')}</div>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 min-w-65">
                    <div class="font-medium text-gray-900 dark:text-gray-100">${escapeHtml(item.description || '-')}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">${escapeHtml(item.method || '')} ${escapeHtml(item.path || '')}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${escapeHtml(item.module || '-')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${actionClass(item.action)}">${escapeHtml(formatAction(item.action))}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${escapeHtml(formatDateTime(item.created_at))}</td>
                <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    <div class="font-mono text-xs">${escapeHtml(item.ip_address || '-')}</div>
                    <div class="text-xs truncate max-w-45" title="${escapeHtml(item.user_agent || '')}">${escapeHtml(summarizeUserAgent(item.user_agent))}</div>
                </td>
            </tr>
        `).join('');
    }

    function renderGrid(items) {
        const grid = getEl('auditGridSection');
        if (!grid) return;

        if (items.length === 0) {
            grid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-12 gap-2">
                <svg class="w-10 h-10 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <p class="text-sm text-gray-400 dark:text-gray-500">Nenhuma atividade encontrada.</p>
            </div>`;
            return;
        }

        grid.innerHTML = items.map((item) => `
            <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col relative border border-gray-100 dark:border-slate-700">
                <div class="flex items-start justify-between gap-3 mb-3">
                    <div>
                        <h4 class="text-[16px] font-bold text-gray-900 dark:text-gray-100 leading-tight">${escapeHtml(formatUser(item))}</h4>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(formatDateTime(item.created_at))}</p>
                    </div>
                    <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${actionClass(item.action)}">${escapeHtml(formatAction(item.action))}</span>
                </div>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">${escapeHtml(item.description || '-')}</p>
                <div class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <div class="flex justify-between gap-4"><span>Módulo</span><strong class="text-gray-900 dark:text-gray-100">${escapeHtml(item.module || '-')}</strong></div>
                    <div class="flex justify-between gap-4"><span>Origem</span><span class="font-mono text-xs">${escapeHtml(item.ip_address || '-')}</span></div>
                    <div class="text-xs font-mono text-gray-500 dark:text-gray-400 break-all">${escapeHtml(item.method || '')} ${escapeHtml(item.path || '')}</div>
                </div>
            </div>
        `).join('');
    }

    function updateFooter(count) {
        window.GridSummaryFooter?.update({
            footerId: 'auditResultsFooter',
            anchorId: g_currentView === 'grid' ? 'auditGridSection' : 'auditTableSection',
            count,
            label: 'atividade(s) exibida(s)',
        });
    }

    function render() {
        renderTable(g_activities);
        renderGrid(g_activities);
        updateFooter(g_activities.length);
    }

    function setView(type) {
        g_currentView = type;
        localStorage.setItem('audit_view', type);

        const btnListView = getEl('btnListView');
        const btnGridView = getEl('btnGridView');
        const tableSection = getEl('auditTableSection');
        const gridSection = getEl('auditGridSection');
        const listIconCheck = btnListView?.querySelector('.check-icon');
        const gridIconCheck = btnGridView?.querySelector('.check-icon');

        if (!btnListView || !btnGridView) return;

        if (type === 'list') {
            tableSection?.classList.remove('hidden');
            gridSection?.classList.add('hidden');
            btnListView.className = 'flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1';
            btnGridView.className = 'flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1';
            listIconCheck?.classList.remove('hidden');
            gridIconCheck?.classList.add('hidden');
        } else {
            tableSection?.classList.add('hidden');
            gridSection?.classList.remove('hidden');
            btnGridView.className = 'flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1';
            btnListView.className = 'flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1';
            gridIconCheck?.classList.remove('hidden');
            listIconCheck?.classList.add('hidden');
        }

        updateFooter(g_activities.length);
    }

    function setupFilters() {
        window.FilterPanel?.mount({
            storageKey: 'audit_filter_panel',
            title: 'Filtros de Auditoria',
            defaultOpen: true,
            fields: [
                { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Usuário, atividade, rota...' },
                { id: 'filterUser', type: 'select', label: 'Usuário', options: [{ value: '', label: 'Todos' }] },
                { id: 'filterAction', type: 'select', label: 'Ação', options: [
                    { value: '', label: 'Todas' },
                    { value: 'CREATE', label: 'Criou' },
                    { value: 'UPDATE', label: 'Alterou' },
                    { value: 'DELETE', label: 'Removeu' },
                    { value: 'LOGIN', label: 'Entrou' },
                    { value: 'ACTIVATE', label: 'Ativou' },
                    { value: 'INACTIVATE', label: 'Inativou' },
                ] },
                { id: 'filterModule', type: 'select', label: 'Módulo', options: [{ value: '', label: 'Todos' }] },
                { id: 'filterDateFrom', type: 'date', label: 'De' },
                { id: 'filterDateTo', type: 'date', label: 'Até' },
            ],
            gridClass: 'grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3 items-end',
        });

        let timer = null;
        ['filterSearch', 'filterUser', 'filterAction', 'filterModule', 'filterDateFrom', 'filterDateTo'].forEach((id) => {
            getEl(id)?.addEventListener(id === 'filterSearch' ? 'input' : 'change', () => {
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                    loadAudit().catch(showError);
                    timer = null;
                }, id === 'filterSearch' ? 220 : 0);
            });
        });
    }

    function showError(error) {
        console.error('Falha ao carregar auditoria', error);
        const alert = getEl('alertMessage');
        if (alert) {
            alert.textContent = error?.message || 'Erro ao carregar auditoria.';
            alert.className = 'mx-4 sm:mx-0 mb-4 p-4 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/30';
            alert.classList.remove('hidden');
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }

        setupFilters();
        getEl('btnListView')?.addEventListener('click', () => setView('list'));
        getEl('btnGridView')?.addEventListener('click', () => setView('grid'));
        getEl('btnRefreshAudit')?.addEventListener('click', () => loadAudit().catch(showError));
        setView(g_currentView === 'grid' ? 'grid' : 'list');
        await loadAudit();
    });
})();
