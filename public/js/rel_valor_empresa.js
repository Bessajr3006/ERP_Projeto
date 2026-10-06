// @ts-nocheck
/**
 * rel_valor_empresa.ts
 * Relatório Analítico de Valores por Empresa
 */
(() => {
    // ─── DOM Helpers ──────────────────────────────────────────────────────────
    const getEl = (id) => document.getElementById(id);
    let isLoading = false;
    // ─── Status & Alert Helpers ───────────────────────────────────────────────
    const updateStatusBadge = (type, text) => {
        const badge = getEl('statusBadge');
        if (!badge)
            return;
        const colorMap = {
            ready: {
                dot: 'bg-emerald-500',
                bg: 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700'
            },
            loading: {
                dot: 'bg-amber-500 animate-ping',
                bg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
            },
            success: {
                dot: 'bg-emerald-500',
                bg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
            },
            error: {
                dot: 'bg-rose-500',
                bg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
            }
        };
        const config = colorMap[type] || colorMap.ready;
        badge.className = `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${config.bg}`;
        badge.innerHTML = `<span class="w-2 h-2 rounded-full ${config.dot}"></span><span>${text}</span>`;
    };
    const showAlert = (message, type = 'info') => {
        const box = getEl('alertMessage');
        if (!box)
            return;
        const classes = {
            info: 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800',
            success: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800',
            error: 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
        };
        box.className = `${classes[type]} p-4 rounded-xl text-sm mb-6 flex items-center justify-between shadow-sm`;
        box.innerHTML = `
            <div class="flex items-center gap-2">
                <span>${message}</span>
            </div>
            <button type="button" class="text-xs font-bold uppercase tracking-wider hover:opacity-75 cursor-pointer ml-4" onclick="this.parentElement.classList.add('hidden')">
                Fechar
            </button>
        `;
        box.classList.remove('hidden');
    };
    const hideAlert = () => {
        const box = getEl('alertMessage');
        if (box)
            box.classList.add('hidden');
    };
    // ─── Year Dropdown Population ─────────────────────────────────────────────
    const populateYearDropdown = () => {
        const select = getEl('filterAno');
        if (!select)
            return;
        const currentYear = new Date().getFullYear();
        const savedYear = localStorage.getItem('rel_valor_empresa_ano');
        select.innerHTML = '';
        for (let y = currentYear; y >= currentYear - 4; y--) {
            const opt = document.createElement('option');
            opt.value = String(y);
            opt.textContent = String(y);
            if (savedYear ? String(y) === savedYear : y === currentYear) {
                opt.selected = true;
            }
            select.appendChild(opt);
        }
    };
    // ─── Load Companies ───────────────────────────────────────────────────────
    const loadCompanies = async () => {
        const compSelect = getEl('filterCompany');
        if (!compSelect)
            return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/companies', {
                headers: {
                    'Authorization': `Bearer ${token || ''}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!res.ok)
                throw new Error('Não foi possível carregar as empresas.');
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data.companies || data.data || []);
            compSelect.innerHTML = '';
            if (list.length === 0) {
                compSelect.innerHTML = '<option value="">Nenhuma empresa disponível</option>';
                return;
            }
            // Sort alphabetically by trade name or company name
            list.sort((a, b) => {
                const nameA = (a.trade_name || a.company_name || '').toUpperCase();
                const nameB = (b.trade_name || b.company_name || '').toUpperCase();
                return nameA.localeCompare(nameB, 'pt-BR');
            });
            const savedCompanyId = localStorage.getItem('rel_valor_empresa_company');
            list.forEach((c) => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.trade_name || c.company_name || 'Sem nome';
                if (savedCompanyId && String(c.id) === savedCompanyId) {
                    opt.selected = true;
                }
                compSelect.appendChild(opt);
            });
            // If no saved selection matched, select first option
            if (!compSelect.value && list.length > 0) {
                compSelect.value = list[0].id;
            }
        }
        catch (err) {
            console.error('[Rel.Valor_Empresa] Error loading companies:', err);
            compSelect.innerHTML = '<option value="">Erro ao carregar empresas</option>';
        }
    };
    // ─── Load Solidcon Connections for Company ────────────────────────────────
    const loadSolidconConnections = async (targetCompany) => {
        const select = getEl('filterConnection');
        if (!select)
            return;
        const companyParam = targetCompany || getEl('filterCompany')?.value || '';
        if (!companyParam) {
            select.innerHTML = '<option value="">Padrão da Empresa (Solidcon)</option>';
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/companies/${encodeURIComponent(companyParam)}/solidcon-configs`, {
                headers: {
                    'Authorization': `Bearer ${token || ''}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!res.ok) {
                select.innerHTML = '<option value="">Padrão da Empresa (Solidcon)</option>';
                return;
            }
            const json = await res.json();
            const configs = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
            const savedConnectionId = localStorage.getItem(`rel_valor_empresa_conn_${companyParam || 'default'}`);
            select.innerHTML = '<option value="">Padrão da Empresa (Solidcon)</option>';
            configs.forEach((c) => {
                const opt = document.createElement('option');
                opt.value = String(c.id);
                opt.textContent = `${c.name || 'Conexão Solidcon'} (${c.host}/${c.database_name || 'solidcon'})${c.is_default ? ' [Padrão]' : ''}`;
                if (savedConnectionId && String(c.id) === savedConnectionId) {
                    opt.selected = true;
                }
                select.appendChild(opt);
            });
        }
        catch (err) {
            console.warn('[Rel.Valor_Empresa] Could not load solidcon connections:', err);
            select.innerHTML = '<option value="">Padrão da Empresa (Solidcon)</option>';
        }
    };
    // ─── Load Data Action ─────────────────────────────────────────────────────
    const loadReport = async () => {
        if (isLoading)
            return;
        isLoading = true;
        hideAlert();
        const filterBtn = getEl('btnFilterApply');
        const filterIcon = getEl('btnFilterIcon');
        if (filterBtn)
            filterBtn.disabled = true;
        if (filterIcon)
            filterIcon.classList.add('animate-spin');
        updateStatusBadge('loading', 'Consultando...');
        try {
            const companyParam = getEl('filterCompany')?.value || '';
            const ano = getEl('filterAno')?.value || String(new Date().getFullYear());
            const mes = getEl('filterMes')?.value || String(new Date().getMonth() + 1);
            const filial = getEl('filterFilial')?.value || '';
            const source = getEl('filterSource')?.value || 'conta_baixa';
            const connId = getEl('filterConnection')?.value || '';
            // Persist selections
            if (companyParam)
                localStorage.setItem('rel_valor_empresa_company', companyParam);
            if (ano)
                localStorage.setItem('rel_valor_empresa_ano', ano);
            if (mes)
                localStorage.setItem('rel_valor_empresa_mes', mes);
            if (source)
                localStorage.setItem('rel_valor_empresa_source', source);
            if (connId) {
                localStorage.setItem(`rel_valor_empresa_conn_${companyParam || 'default'}`, connId);
            }
            if (filial) {
                localStorage.setItem(`rel_valor_empresa_filial_${companyParam || 'default'}`, filial);
            }
            const token = localStorage.getItem('token');
            const queryParams = new URLSearchParams({
                ano,
                mes,
                source,
                ...(companyParam ? { company_id: companyParam } : {}),
                ...(filial ? { filial } : {}),
                ...(connId ? { connection_id: connId } : {})
            });
            const response = await fetch(`/api/fin-solidcon-vision?${queryParams.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token || ''}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                throw new Error(errJson?.error || errJson?.message || `Erro HTTP ${response.status}`);
            }
            const res = await response.json();
            const data = res?.data;
            if (!data)
                throw new Error('Estrutura de dados inválida retornada pelo servidor.');
            // Update Filial select if new filiais returned
            if (data.filiais && data.filiais.length > 0) {
                const filialSelect = getEl('filterFilial');
                if (filialSelect) {
                    const currentVal = filialSelect.value;
                    const savedFilial = localStorage.getItem(`rel_valor_empresa_filial_${companyParam || 'default'}`);
                    filialSelect.innerHTML = '<option value="">Todas as Filiais</option>';
                    data.filiais.forEach((f) => {
                        const opt = document.createElement('option');
                        const fId = typeof f === 'object' ? String(f.id) : String(f);
                        const fNome = typeof f === 'object' ? (f.nome || `Filial ${f.id}`) : `Filial ${f}`;
                        opt.value = fId;
                        opt.textContent = fNome;
                        filialSelect.appendChild(opt);
                    });
                    const targetFilial = currentVal || savedFilial || '';
                    if (targetFilial && filialSelect.querySelector(`option[value="${targetFilial}"]`)) {
                        filialSelect.value = targetFilial;
                    }
                }
            }
            if (getEl('connectionBadge')) {
                const compDisplay = res.company?.trade_name || res.company?.company_name || '';
                const connDisplay = res.connection?.name || 'Solidcon Principal';
                getEl('connectionBadge').textContent = `• ${compDisplay ? `${compDisplay} | ` : ''}${connDisplay}`;
            }
            const totalLancamentos = (data.summary?.qtdReceita || 0) + (data.summary?.qtdDespesa || 0);
            updateStatusBadge('success', `Conectado (${totalLancamentos} lançamentos)`);
        }
        catch (err) {
            const msg = err?.message || String(err);
            updateStatusBadge('error', 'Falha na Conexão');
            showAlert(`Erro ao carregar dados: ${msg}`, 'error');
        }
        finally {
            isLoading = false;
            if (filterBtn)
                filterBtn.disabled = false;
            if (filterIcon)
                filterIcon.classList.remove('animate-spin');
        }
    };
    // ─── DOMContentLoaded Init ───────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', async () => {
        populateYearDropdown();
        // Set saved or current month in select
        const mesSelect = getEl('filterMes');
        if (mesSelect) {
            const savedMes = localStorage.getItem('rel_valor_empresa_mes');
            if (savedMes && mesSelect.querySelector(`option[value="${savedMes}"]`)) {
                mesSelect.value = savedMes;
            }
            else {
                mesSelect.value = String(new Date().getMonth() + 1);
            }
        }
        // Set saved data source
        const sourceSelect = getEl('filterSource');
        if (sourceSelect) {
            const savedSource = localStorage.getItem('rel_valor_empresa_source');
            if (savedSource && sourceSelect.querySelector(`option[value="${savedSource}"]`)) {
                sourceSelect.value = savedSource;
            }
        }
        await loadCompanies();
        const initialCompany = getEl('filterCompany')?.value || '';
        await loadSolidconConnections(initialCompany);
        getEl('filterForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            void loadReport();
        });
        getEl('filterCompany')?.addEventListener('change', async () => {
            const selectedCompany = getEl('filterCompany')?.value || '';
            localStorage.setItem('rel_valor_empresa_company', selectedCompany);
            await loadSolidconConnections(selectedCompany);
            await loadReport();
        });
        getEl('filterConnection')?.addEventListener('change', () => {
            const companyParam = getEl('filterCompany')?.value || '';
            const connVal = getEl('filterConnection')?.value || '';
            localStorage.setItem(`rel_valor_empresa_conn_${companyParam || 'default'}`, connVal);
            void loadReport();
        });
        getEl('filterAno')?.addEventListener('change', () => {
            const val = getEl('filterAno')?.value || '';
            if (val)
                localStorage.setItem('rel_valor_empresa_ano', val);
            void loadReport();
        });
        getEl('filterMes')?.addEventListener('change', () => {
            const val = getEl('filterMes')?.value || '';
            if (val)
                localStorage.setItem('rel_valor_empresa_mes', val);
            void loadReport();
        });
        getEl('filterSource')?.addEventListener('change', () => {
            const val = getEl('filterSource')?.value || '';
            if (val)
                localStorage.setItem('rel_valor_empresa_source', val);
            void loadReport();
        });
        getEl('filterFilial')?.addEventListener('change', () => {
            const companyParam = getEl('filterCompany')?.value || '';
            const val = getEl('filterFilial')?.value || '';
            localStorage.setItem(`rel_valor_empresa_filial_${companyParam || 'default'}`, val);
            void loadReport();
        });
        // Initial fetch
        await loadReport();
    });
})();
