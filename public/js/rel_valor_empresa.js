// @ts-nocheck
/**
 * rel_valor_empresa.ts
 * Relatório Analítico de Valores por Empresa
 */
(() => {
    // ─── DOM Helpers ──────────────────────────────────────────────────────────
    const getEl = (id) => document.getElementById(id);
    let isLoading = false;
    let accessibleCompanies = [];
    let currentCompanyPublicId = '';
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
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
        if (savedYear && !select.querySelector(`option[value="${savedYear}"]`)) {
            const opt = document.createElement('option');
            opt.value = savedYear;
            opt.textContent = savedYear;
            opt.selected = true;
            select.appendChild(opt);
        }
    };
    // ─── Load Companies ───────────────────────────────────────────────────────
    async function loadCompanies() {
        const compSelect = getEl('filterCompany');
        if (!compSelect)
            return;
        try {
            const meRes = await api('/auth/me');
            const activeCompany = meRes?.data?.company;
            currentCompanyPublicId = activeCompany?.public_id || '';
            let list = meRes?.data?.companies || [];
            if (!Array.isArray(list) || list.length === 0) {
                try {
                    const compRes = await api('/companies');
                    if (Array.isArray(compRes?.data)) {
                        list = compRes.data;
                    }
                }
                catch (e) { }
            }
            if (list.length === 0 && activeCompany) {
                list = [activeCompany];
            }
            accessibleCompanies = list;
            const savedCompanyId = localStorage.getItem('rel_valor_empresa_company');
            compSelect.innerHTML = accessibleCompanies.map((c) => {
                const idVal = c.public_id || c.id;
                const displayName = c.trade_name || c.company_name || c.name || `Empresa #${c.id}`;
                const isSelected = savedCompanyId
                    ? (idVal === savedCompanyId || String(c.id) === String(savedCompanyId))
                    : (idVal === currentCompanyPublicId);
                return `<option value="${idVal}" ${isSelected ? 'selected' : ''}>${escapeHtml(displayName)}</option>`;
            }).join('');
            if (compSelect.options.length > 0 && compSelect.selectedIndex === -1) {
                compSelect.selectedIndex = 0;
            }
        }
        catch (err) {
            console.warn('[Rel.Valor_Empresa] Falha ao carregar lista de empresas:', err);
            compSelect.innerHTML = '<option value="">Minha Empresa</option>';
        }
    }
    // ─── Load Solidcon Connections for Company ────────────────────────────────
    const loadSolidconConnections = async (targetCompany) => {
        const select = getEl('filterConnection');
        if (!select)
            return;
        const companyParam = targetCompany || getEl('filterCompany')?.value || '';
        try {
            select.innerHTML = '<option value="">Carregando conexões...</option>';
            const url = `/finance/reports/solidcon-connections${companyParam ? `?targetCompanyId=${encodeURIComponent(companyParam)}` : ''}`;
            const res = await api(url);
            const conns = res?.data || [];
            select.innerHTML = '<option value="">Padrão da Empresa (Solidcon)</option>';
            conns.forEach((c) => {
                const opt = document.createElement('option');
                opt.value = String(c.id);
                opt.textContent = `${c.name || 'Conexão'} (${c.serv_solidcon || ''}/${c.bd_solidcon || 'solidcon'})`;
                if (c.is_default) {
                    opt.textContent += ' [Padrão]';
                }
                select.appendChild(opt);
            });
            const savedConnectionId = localStorage.getItem(`rel_valor_empresa_conn_${companyParam || 'default'}`);
            if (savedConnectionId) {
                select.value = savedConnectionId;
            }
        }
        catch (err) {
            console.warn('[Rel.Valor_Empresa] Falha ao carregar conexões Solidcon:', err);
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
            const queryParams = new URLSearchParams({
                ano,
                mes,
                source,
                ...(companyParam ? { company_id: companyParam } : {}),
                ...(filial ? { filial } : {}),
                ...(connId ? { connection_id: connId } : {})
            });
            const res = await api(`/fin-solidcon-vision?${queryParams.toString()}`);
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
