// @ts-nocheck
(() => {
    let pedidosData = [];
    let currentSortCol = 'dtPedido';
    let currentSortDir = 'desc';
    const getById = (id) => document.getElementById(id);
    const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
    const formatDate = (dateStr) => {
        if (!dateStr)
            return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) {
                const parts = String(dateStr).split('T')[0].split('-');
                if (parts.length === 3)
                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
                return String(dateStr);
            }
            return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        }
        catch {
            return String(dateStr);
        }
    };
    const formatTime = (timeStr) => {
        if (!timeStr)
            return '-';
        try {
            if (typeof timeStr === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(timeStr.trim())) {
                return timeStr.trim();
            }
            const d = new Date(timeStr);
            if (isNaN(d.getTime()))
                return String(timeStr);
            return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
        catch {
            return String(timeStr);
        }
    };
    const formatDateTime = (dateStr) => {
        if (!dateStr)
            return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime()))
                return String(dateStr);
            return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
        catch {
            return String(dateStr);
        }
    };
    const formatDuration = (minutes) => {
        if (isNaN(minutes) || minutes < 0)
            return '-';
        if (minutes < 60)
            return `${Math.round(minutes)} min`;
        const h = Math.floor(minutes / 60);
        const m = Math.round(minutes % 60);
        return m > 0 ? `${h}h ${m}min` : `${h}h`;
    };
    const calculateMinutesDiff = (startStr, endStr) => {
        if (!startStr || !endStr)
            return null;
        try {
            const d1 = new Date(startStr);
            const d2 = new Date(endStr);
            if (isNaN(d1.getTime()) || isNaN(d2.getTime()))
                return null;
            const diffMs = d2.getTime() - d1.getTime();
            const diffMin = diffMs / (1000 * 60);
            return diffMin >= 0 ? diffMin : null;
        }
        catch {
            return null;
        }
    };
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    // ─── Company & Dorsal Connections ───────────────────────────────────────────
    let accessibleCompanies = [];
    let currentCompanyPublicId = '';
    let dorsalConnections = [];
    async function loadCompanies() {
        const compSelect = getById('filterCompany');
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
            const savedCompanyId = window.CompanyStorage?.getItem('rel_pedido_dorsal_selected_company') ?? localStorage.getItem('rel_pedido_dorsal_selected_company');
            compSelect.innerHTML = accessibleCompanies.map((c) => {
                const idVal = c.public_id || c.id;
                const displayName = c.trade_name || c.name || `Empresa #${c.id}`;
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
            console.warn('Falha ao carregar lista de empresas:', err);
            compSelect.innerHTML = '<option value="">Minha Empresa</option>';
        }
    }
    async function loadDorsalConnections(targetCompany) {
        const select = getById('filterConnection');
        if (!select)
            return;
        const companyParam = targetCompany || getById('filterCompany')?.value || '';
        try {
            select.innerHTML = '<option value="">Carregando...</option>';
            const url = `/finance/reports/dorsal-connections${companyParam ? `?targetCompanyId=${encodeURIComponent(companyParam)}` : ''}`;
            const res = await api(url);
            dorsalConnections = res.data || [];
            if (dorsalConnections.length === 0) {
                select.innerHTML = '<option value="">Padrão da Empresa</option>';
                if (res.company?.cdfilial) {
                    const filialEl = getById('filterFilial');
                    if (filialEl && (!filialEl.value || targetCompany)) {
                        filialEl.value = String(res.company.cdfilial).trim();
                    }
                }
                return;
            }
            const savedConnectionId = window.CompanyStorage?.getItem(`rel_pedido_dorsal_connection_${companyParam || 'default'}`)
                || localStorage.getItem(`rel_pedido_dorsal_connection_${companyParam || 'default'}`)
                || localStorage.getItem('rel_pedido_dorsal_connection');
            let selectedFound = false;
            select.innerHTML = dorsalConnections.map((conn) => {
                const isDefault = !!conn.is_default;
                const isSaved = savedConnectionId && String(conn.id) === String(savedConnectionId);
                const shouldSelect = isSaved || (!savedConnectionId && isDefault);
                if (shouldSelect && !selectedFound) {
                    selectedFound = true;
                    return `<option value="${conn.id}" data-cdfilial="${conn.cdfilial || ''}" selected>${escapeHtml(conn.name)}${isDefault ? ' (Padrão)' : ''}</option>`;
                }
                return `<option value="${conn.id}" data-cdfilial="${conn.cdfilial || ''}">${escapeHtml(conn.name)}${isDefault ? ' (Padrão)' : ''}</option>`;
            }).join('');
            if (!selectedFound && select.options.length > 0) {
                select.selectedIndex = 0;
            }
            const selectedOption = select.options[select.selectedIndex];
            const filialValue = selectedOption?.getAttribute('data-cdfilial') || res.company?.cdfilial || '';
            const filialEl = getById('filterFilial');
            if (filialEl && (!filialEl.value || targetCompany)) {
                if (filialValue) {
                    filialEl.value = String(filialValue).trim();
                }
            }
        }
        catch (err) {
            console.warn('Falha ao carregar conexões Dorsal para o relatório:', err);
            select.innerHTML = '<option value="">Padrão da Empresa</option>';
        }
    }
    // ─── Filter Persistence Management ──────────────────────────────────────────
    const STORAGE_KEY_FILTERS = 'erp_rel_pedido_dorsal_last_filters';
    function saveLastFilters() {
        try {
            const filters = {
                company: getById('filterCompany')?.value || '',
                connectionId: getById('filterConnection')?.value || '',
                startDate: getById('filterStartDate')?.value || '',
                endDate: getById('filterEndDate')?.value || '',
                filial: getById('filterFilial')?.value || '',
                status: getById('filterStatus')?.value ?? '0',
                search: getById('filterSearch')?.value || ''
            };
            if (window.CompanyStorage) {
                window.CompanyStorage.setItem(STORAGE_KEY_FILTERS, JSON.stringify(filters));
            }
            else {
                localStorage.setItem(STORAGE_KEY_FILTERS, JSON.stringify(filters));
            }
        }
        catch (e) {
            console.error('Erro ao salvar últimos filtros:', e);
        }
    }
    function loadLastFilters() {
        try {
            const saved = window.CompanyStorage?.getItem(STORAGE_KEY_FILTERS) ?? localStorage.getItem(STORAGE_KEY_FILTERS);
            if (saved) {
                const f = JSON.parse(saved);
                const startEl = getById('filterStartDate');
                const endEl = getById('filterEndDate');
                const filialEl = getById('filterFilial');
                const statusEl = getById('filterStatus');
                const searchEl = getById('filterSearch');
                if (startEl && f.startDate)
                    startEl.value = f.startDate;
                if (endEl && f.endDate)
                    endEl.value = f.endDate;
                if (filialEl && f.filial !== undefined)
                    filialEl.value = f.filial;
                if (statusEl && f.status !== undefined)
                    statusEl.value = f.status;
                if (searchEl && f.search !== undefined)
                    searchEl.value = f.search;
            }
        }
        catch (e) {
            console.error('Erro ao carregar últimos filtros:', e);
        }
    }
    // ─── Setup Period Defaults ──────────────────────────────────────────────────
    function setDefaultPeriod() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const start = `${y}-${m}-01`;
        const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
        const end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
        const startEl = getById('filterStartDate');
        const endEl = getById('filterEndDate');
        if (startEl && !startEl.value)
            startEl.value = start;
        if (endEl && !endEl.value)
            endEl.value = end;
    }
    // ─── Filter Toggle ──────────────────────────────────────────────────────────
    function initCollapsiblePanels() {
        const toggleFilterBtn = getById('toggleFilterBtn');
        const filterBody = getById('filterBody');
        const filterChevron = getById('filterChevron');
        if (toggleFilterBtn && filterBody && filterChevron) {
            let isFilterOpen = true;
            filterBody.style.maxHeight = `${filterBody.scrollHeight}px`;
            toggleFilterBtn.addEventListener('click', () => {
                isFilterOpen = !isFilterOpen;
                filterBody.style.maxHeight = isFilterOpen ? `${filterBody.scrollHeight}px` : '0px';
                filterChevron.style.transform = isFilterOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
            });
        }
        const toggleSummaryBtn = getById('toggleSummaryBtn');
        const summaryBody = getById('summaryBody');
        const summaryChevron = getById('summaryChevron');
        if (toggleSummaryBtn && summaryBody && summaryChevron) {
            let isSummaryOpen = true;
            summaryBody.style.maxHeight = `${summaryBody.scrollHeight}px`;
            toggleSummaryBtn.addEventListener('click', () => {
                isSummaryOpen = !isSummaryOpen;
                summaryBody.style.maxHeight = isSummaryOpen ? `${summaryBody.scrollHeight}px` : '0px';
                summaryChevron.style.transform = isSummaryOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
            });
        }
    }
    // ─── Load Report from Dorsal ────────────────────────────────────────────────
    async function loadReport() {
        saveLastFilters();
        const start = getById('filterStartDate')?.value || '';
        const end = getById('filterEndDate')?.value || '';
        const filial = getById('filterFilial')?.value || '';
        const status = getById('filterStatus')?.value || '';
        const company = getById('filterCompany')?.value || '';
        const connectionId = getById('filterConnection')?.value || '';
        if (!start || !end) {
            UI.showAlert('alertMessage', 'As datas de início e fim são obrigatórias.', 'warning');
            return;
        }
        const loader = getById('loadingOverlay');
        const reportSection = getById('reportSection');
        const summaryWrapper = getById('summaryCardWrapper');
        if (loader) {
            loader.classList.remove('hidden');
            loader.classList.add('flex');
        }
        if (reportSection) {
            reportSection.classList.remove('hidden');
            reportSection.classList.add('flex');
        }
        try {
            let url = `/finance/reports/pedidos-dorsal?startDate=${start}&endDate=${end}`;
            if (company)
                url += `&targetCompanyId=${encodeURIComponent(company)}`;
            if (connectionId)
                url += `&connectionId=${encodeURIComponent(connectionId)}`;
            if (filial)
                url += `&cdFilial=${encodeURIComponent(filial)}`;
            if (status !== '')
                url += `&inCancelado=${encodeURIComponent(status)}`;
            const res = await api(url);
            pedidosData = res.data || [];
            if (summaryWrapper)
                summaryWrapper.classList.remove('hidden');
            renderReport();
        }
        catch (err) {
            console.error('Erro ao consultar pedidos Dorsal:', err);
            UI.showAlert('alertMessage', err?.message || 'Falha ao consultar o banco Dorsal.', 'error');
            const tbody = getById('pedidosTableBody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="11" class="px-6 py-10 text-center text-sm text-rose-500 font-semibold">Falha ao carregar pedidos: ${err?.message || 'Conexão indisponível'}.</td></tr>`;
            }
        }
        finally {
            if (loader) {
                loader.classList.add('hidden');
                loader.classList.remove('flex');
            }
        }
    }
    // ─── Filtered Data Helper ───────────────────────────────────────────────────
    function getFilteredData() {
        const search = (getById('filterSearch')?.value || '').toLowerCase().trim();
        if (!search)
            return pedidosData;
        return pedidosData.filter((p) => {
            const cdPedido = String(p.cdPedido || '').toLowerCase();
            const nmCliente = String(p.nmCliente || '').toLowerCase();
            const cdCliente = String(p.cdCliente || '').toLowerCase();
            const tel = String(p.Telefone || '').toLowerCase();
            const end = String(p.Endereco || '').toLowerCase();
            const bairro = String(p.Bairro || '').toLowerCase();
            const cupom = String(p.nrCupom || '').toLowerCase();
            const pdv = String(p.cdPDV || '').toLowerCase();
            const ifood = String(p.idPedidoIFood || '').toLowerCase();
            const pgto = String(p.txPagamento || '').toLowerCase();
            const operador = String(p.nmOperador || '').toLowerCase();
            const produtos = String(p.produtosResumo || '').toLowerCase();
            const statusRaw = String(p.statusPedido || '').toLowerCase();
            const isCanc = p.statusPedido === 'CANCELADO' || p.inCancelado === true || p.inCancelado === 1 || !!p.dtCancelado;
            const isAberto = !isCanc && (p.statusPedido === 'NAO_FINALIZADO' || (!p.hrRegistro && !p.hrEmissao && !p.nrCupom && !p.COO && !p.ValorRegistrado));
            const statusKeywords = isCanc ? 'cancelado cancelada cancelados' : (isAberto ? 'aberto aberta abertos em aberto pendente pendentes nao finalizado nao finalizada' : 'concluido concluida finalizado finalizada concluidos finalizados');
            return cdPedido.includes(search) ||
                nmCliente.includes(search) ||
                cdCliente.includes(search) ||
                tel.includes(search) ||
                end.includes(search) ||
                bairro.includes(search) ||
                cupom.includes(search) ||
                pdv.includes(search) ||
                ifood.includes(search) ||
                pgto.includes(search) ||
                operador.includes(search) ||
                produtos.includes(search) ||
                statusRaw.includes(search) ||
                statusKeywords.includes(search);
        });
    }
    // ─── Render Report & Summaries ──────────────────────────────────────────────
    function renderReport() {
        const data = getFilteredData();
        const tbody = getById('pedidosTableBody');
        const badge = getById('ordersCountBadge');
        if (badge)
            badge.textContent = String(data.length);
        // Calculate Summary Metrics
        let totalOrders = data.length;
        let totalAmount = 0;
        let totalFinalized = 0;
        let totalFinalizedAmount = 0;
        let totalUnfinalized = 0;
        let totalUnfinalizedAmount = 0;
        let totalCanceled = 0;
        let totalCanceledAmount = 0;
        let totalFrete = 0;
        let totalDesconto = 0;
        // Tempo de Atendimento Statistics
        const validAtendimentos = [];
        let countAte15 = 0;
        let count15a30 = 0;
        let count30a60 = 0;
        let countAcima60 = 0;
        data.forEach((p) => {
            const val = Number(p.vlTotal) || 0;
            const frete = Number(p.vlFrete) || 0;
            const desc = Number(p.vlDesconto) || 0;
            const isCanc = p.statusPedido === 'CANCELADO' || p.inCancelado === true || p.inCancelado === 1 || !!p.dtCancelado;
            const isUnfin = !isCanc && (p.statusPedido === 'NAO_FINALIZADO' || (!p.hrRegistro && !p.hrEmissao && !p.nrCupom && !p.COO && !p.ValorRegistrado));
            totalAmount += val;
            totalFrete += frete;
            totalDesconto += desc;
            if (isCanc) {
                totalCanceled++;
                totalCanceledAmount += val;
            }
            else if (isUnfin) {
                totalUnfinalized++;
                totalUnfinalizedAmount += val;
            }
            else {
                totalFinalized++;
                totalFinalizedAmount += val;
            }
            // Tempo de atendimento (Inclusão -> Registro)
            const start = p.hrInclusao || p.dtPedido;
            const endAtend = p.hrRegistro;
            if (start && endAtend) {
                const diff = calculateMinutesDiff(start, endAtend);
                if (diff !== null && diff < 1440) {
                    validAtendimentos.push(diff);
                    if (diff <= 15)
                        countAte15++;
                    else if (diff <= 30)
                        count15a30++;
                    else if (diff <= 60)
                        count30a60++;
                    else
                        countAcima60++;
                }
            }
        });
        const activeCount = totalFinalized + totalUnfinalized;
        const activeAmount = totalFinalizedAmount + totalUnfinalizedAmount;
        const averageTicket = activeCount > 0 ? (activeAmount / activeCount) : (totalOrders > 0 ? totalAmount / totalOrders : 0);
        if (getById('totalOrders'))
            getById('totalOrders').textContent = String(totalOrders);
        if (getById('totalFinalized'))
            getById('totalFinalized').textContent = String(totalFinalized);
        if (getById('totalFinalizedAmount'))
            getById('totalFinalizedAmount').textContent = formatCurrency(totalFinalizedAmount);
        if (getById('totalUnfinalized'))
            getById('totalUnfinalized').textContent = String(totalUnfinalized);
        if (getById('totalUnfinalizedAmount'))
            getById('totalUnfinalizedAmount').textContent = formatCurrency(totalUnfinalizedAmount);
        if (getById('totalCanceled'))
            getById('totalCanceled').textContent = String(totalCanceled);
        if (getById('totalCanceledAmount'))
            getById('totalCanceledAmount').textContent = formatCurrency(totalCanceledAmount);
        if (getById('totalAmount'))
            getById('totalAmount').textContent = formatCurrency(totalAmount);
        if (getById('averageTicket'))
            getById('averageTicket').textContent = formatCurrency(averageTicket);
        if (getById('totalFrete'))
            getById('totalFrete').textContent = formatCurrency(totalFrete);
        if (getById('totalDesconto'))
            getById('totalDesconto').textContent = formatCurrency(totalDesconto);
        // Populate Tempo de Atendimento UI
        const totalSample = validAtendimentos.length;
        const avgAtendMin = totalSample > 0 ? (validAtendimentos.reduce((a, b) => a + b, 0) / totalSample) : 0;
        const minAtendMin = totalSample > 0 ? Math.min(...validAtendimentos) : 0;
        const maxAtendMin = totalSample > 0 ? Math.max(...validAtendimentos) : 0;
        const pctAte15 = totalSample > 0 ? Math.round((countAte15 / totalSample) * 100) : 0;
        const pct15a30 = totalSample > 0 ? Math.round((count15a30 / totalSample) * 100) : 0;
        const pct30a60 = totalSample > 0 ? Math.round((count30a60 / totalSample) * 100) : 0;
        const pctAcima60 = totalSample > 0 ? Math.round((countAcima60 / totalSample) * 100) : 0;
        if (getById('atendimentoSampleInfo')) {
            getById('atendimentoSampleInfo').textContent = `${totalSample} de ${data.length} pedidos com tempo calculado`;
        }
        if (getById('avgAtendimentoTime')) {
            getById('avgAtendimentoTime').textContent = totalSample > 0 ? formatDuration(avgAtendMin) : '-';
        }
        if (getById('minMaxAtendimentoTime')) {
            getById('minMaxAtendimentoTime').textContent = totalSample > 0 ? `Min: ${formatDuration(minAtendMin)} | Max: ${formatDuration(maxAtendMin)}` : 'Min: - | Max: -';
        }
        if (getById('pctAte15'))
            getById('pctAte15').textContent = `${pctAte15}%`;
        if (getById('countAte15'))
            getById('countAte15').textContent = `${countAte15} ped.`;
        if (getById('barAte15'))
            getById('barAte15').style.width = `${pctAte15}%`;
        if (getById('pct15a30'))
            getById('pct15a30').textContent = `${pct15a30}%`;
        if (getById('count15a30'))
            getById('count15a30').textContent = `${count15a30} ped.`;
        if (getById('bar15a30'))
            getById('bar15a30').style.width = `${pct15a30}%`;
        if (getById('pct30a60'))
            getById('pct30a60').textContent = `${pct30a60}%`;
        if (getById('count30a60'))
            getById('count30a60').textContent = `${count30a60} ped.`;
        if (getById('bar30a60'))
            getById('bar30a60').style.width = `${pct30a60}%`;
        if (getById('pctAcima60'))
            getById('pctAcima60').textContent = `${pctAcima60}%`;
        if (getById('countAcima60'))
            getById('countAcima60').textContent = `${countAcima60} ped.`;
        if (getById('barAcima60'))
            getById('barAcima60').style.width = `${pctAcima60}%`;
        // ─── Operadores Statistics ──────────────────────────────────────────────
        const operadorMap = {};
        data.forEach((p) => {
            const op = p.nmOperador || p.nmVendedor || (p.cdVendedor ? `Vendedor #${p.cdVendedor}` : (p.cdUsuario ? `Usuário #${p.cdUsuario}` : 'LOJA'));
            if (!operadorMap[op]) {
                operadorMap[op] = { count: 0, totalAmount: 0, canceledCount: 0, unfinalizedCount: 0 };
            }
            operadorMap[op].count++;
            operadorMap[op].totalAmount += (Number(p.vlTotal) || 0);
            if (p.statusPedido === 'CANCELADO' || p.inCancelado === true || p.inCancelado === 1 || !!p.dtCancelado) {
                operadorMap[op].canceledCount++;
            }
            else if (p.statusPedido === 'NAO_FINALIZADO' || (!p.hrRegistro && !p.hrEmissao && !p.nrCupom && !p.COO && !p.ValorRegistrado)) {
                operadorMap[op].unfinalizedCount++;
            }
        });
        const sortedOps = Object.entries(operadorMap).sort((a, b) => b[1].count - a[1].count);
        const opCountInfo = getById('operadoresCountInfo');
        if (opCountInfo) {
            opCountInfo.textContent = `${sortedOps.length} operador(es) no período`;
        }
        const opListEl = getById('operadoresSummaryList');
        if (opListEl) {
            if (sortedOps.length === 0) {
                opListEl.innerHTML = `<div class="col-span-full text-center text-xs text-gray-400 py-3">Nenhum operador com pedidos no filtro atual.</div>`;
            }
            else {
                const currentSearchVal = (getById('filterSearch')?.value || '').trim().toLowerCase();
                opListEl.innerHTML = sortedOps.map(([opName, stat]) => {
                    const pct = totalOrders > 0 ? Math.round((stat.count / totalOrders) * 100) : 0;
                    const isSelected = currentSearchVal === opName.toLowerCase();
                    return `
            <div class="bg-white dark:bg-slate-800/90 rounded-lg p-2.5 border ${isSelected ? 'border-purple-500 ring-2 ring-purple-500/20 shadow-sm' : 'border-purple-200/60 dark:border-purple-900/40 shadow-2xs'} flex flex-col justify-between hover:border-purple-400 transition-all cursor-pointer group btn-filter-operador" data-op-name="${opName}" title="Clique para filtrar por ${opName}">
              <div>
                <div class="flex items-center justify-between gap-1">
                  <span class="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block shrink-0"></span>
                    ${opName}
                  </span>
                  <span class="text-[10px] font-bold text-purple-600 dark:text-purple-400 font-mono">${pct}%</span>
                </div>
                <div class="flex items-baseline justify-between mt-1">
                  <span class="text-sm font-extrabold text-purple-700 dark:text-purple-300 font-mono">${stat.count} <span class="text-[10px] font-sans font-normal text-gray-400">ped.</span></span>
                  <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">${formatCurrency(stat.totalAmount)}</span>
                </div>
              </div>
              <div class="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 mt-2 overflow-hidden">
                <div class="bg-purple-500 h-1.5 rounded-full transition-all duration-300" style="width: ${pct}%"></div>
              </div>
            </div>
          `;
                }).join('');
                // Attach click listener to filter by operator when clicked on chip
                opListEl.querySelectorAll('.btn-filter-operador').forEach((card) => {
                    card.addEventListener('click', () => {
                        const opName = card.getAttribute('data-op-name');
                        const searchInput = getById('filterSearch');
                        if (searchInput && opName) {
                            if (searchInput.value.trim().toLowerCase() === opName.toLowerCase()) {
                                searchInput.value = '';
                            }
                            else {
                                searchInput.value = opName;
                            }
                            saveLastFilters();
                            renderReport();
                        }
                    });
                });
            }
        }
        // Refresh collapsible summary height
        const summaryBody = getById('summaryBody');
        if (summaryBody && summaryBody.style.maxHeight && summaryBody.style.maxHeight !== '0px') {
            summaryBody.style.maxHeight = `${summaryBody.scrollHeight}px`;
        }
        if (!tbody)
            return;
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="13" class="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum pedido encontrado para os filtros selecionados.</td></tr>`;
            return;
        }
        tbody.innerHTML = data.map((p, idx) => {
            const isCanc = p.statusPedido === 'CANCELADO' || p.inCancelado === true || p.inCancelado === 1 || !!p.dtCancelado;
            const isUnfin = !isCanc && (p.statusPedido === 'NAO_FINALIZADO' || (!p.hrRegistro && !p.hrEmissao && !p.nrCupom && !p.COO && !p.ValorRegistrado));
            let statusBadge = '';
            if (isCanc) {
                statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">Cancelado</span>`;
            }
            else if (isUnfin) {
                statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-900/50" title="Pedido emitido/criado mas ainda não registrado/concluído no caixa">⏳ Em Aberto</span>`;
            }
            else {
                statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">Concluído</span>`;
            }
            const clienteInfo = p.nmCliente || (p.cdCliente ? `Cliente #${p.cdCliente}` : 'Não identificado');
            const enderecoFormatado = [p.Endereco, p.Bairro, p.Cidade].filter(Boolean).join(', ');
            const start = p.hrInclusao || p.dtPedido;
            const endAtend = p.hrRegistro || p.hrEmissao;
            const diffAtend = (start && endAtend) ? calculateMinutesDiff(start, endAtend) : null;
            const diffSep = (p.hrSeparacaoInicio && p.hrSeparacaoFim) ? calculateMinutesDiff(p.hrSeparacaoInicio, p.hrSeparacaoFim) : null;
            const diffConf = (p.hrConferenciaInicio && p.hrConferenciaFim) ? calculateMinutesDiff(p.hrConferenciaInicio, p.hrConferenciaFim) : null;
            const operadorNome = p.nmOperador || p.nmVendedor || (p.cdVendedor ? `Vendedor #${p.cdVendedor}` : (p.cdUsuario ? `Usuário #${p.cdUsuario}` : 'LOJA'));
            return `
        <tr class="hover:bg-gray-50/80 dark:hover:bg-slate-700/40 transition-colors group ${isCanc ? 'opacity-75' : ''}">
          <td class="col-idx px-3 py-3 whitespace-nowrap text-gray-400 font-mono text-[11px]">${idx + 1}</td>
          <td class="col-pedido px-3 py-3 whitespace-nowrap font-mono font-bold text-gray-900 dark:text-gray-100">
            <div class="flex items-center gap-1.5">
              <span>#${p.cdPedido}</span>
              ${p.idPedidoIFood ? `<span class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900/40">iFood</span>` : ''}
            </div>
          </td>
          <td class="col-dtpedido px-3 py-3 whitespace-nowrap font-medium text-gray-800 dark:text-gray-200">
            ${formatDate(p.dtPedido)}
          </td>
          <td class="col-horarios px-3 py-3 whitespace-nowrap">
            <div class="flex flex-col gap-0.5 text-[11px] leading-tight font-mono min-w-44">
              <div class="flex items-center justify-between text-gray-700 dark:text-gray-300">
                <span class="text-gray-400 font-sans font-medium text-[10px] flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span>Inclusão:
                </span>
                <span class="font-semibold text-blue-700 dark:text-blue-300">${formatTime(p.hrInclusao)}</span>
              </div>
              ${(p.hrSeparacaoInicio || p.hrSeparacaoFim) ? `
                <div class="flex items-center justify-between text-gray-700 dark:text-gray-300" title="Separação: ${p.hrSeparacaoInicio ? formatTime(p.hrSeparacaoInicio) : '--'} até ${p.hrSeparacaoFim ? formatTime(p.hrSeparacaoFim) : '--'} ${diffSep !== null ? '(' + formatDuration(diffSep) + ')' : ''}">
                  <span class="text-gray-400 font-sans font-medium text-[10px] flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>Separação:
                  </span>
                  <span class="text-amber-700 dark:text-amber-300 font-medium text-[10px]">
                    ${p.hrSeparacaoInicio ? formatTime(p.hrSeparacaoInicio) : '--:--'} ➔ ${p.hrSeparacaoFim ? formatTime(p.hrSeparacaoFim) : '--:--'}
                  </span>
                </div>
              ` : ''}
              ${(p.hrConferenciaInicio || p.hrConferenciaFim) ? `
                <div class="flex items-center justify-between text-gray-700 dark:text-gray-300" title="Conferência: ${p.hrConferenciaInicio ? formatTime(p.hrConferenciaInicio) : '--'} até ${p.hrConferenciaFim ? formatTime(p.hrConferenciaFim) : '--'} ${diffConf !== null ? '(' + formatDuration(diffConf) + ')' : ''}">
                  <span class="text-gray-400 font-sans font-medium text-[10px] flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block"></span>Conferência:
                  </span>
                  <span class="text-purple-700 dark:text-purple-300 font-medium text-[10px]">
                    ${p.hrConferenciaInicio ? formatTime(p.hrConferenciaInicio) : '--:--'} ➔ ${p.hrConferenciaFim ? formatTime(p.hrConferenciaFim) : '--:--'}
                  </span>
                </div>
              ` : ''}
              <div class="flex items-center justify-between text-gray-700 dark:text-gray-300">
                <span class="text-gray-400 font-sans font-medium text-[10px] flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>Registro:
                </span>
                <span class="${p.hrRegistro ? 'text-emerald-700 dark:text-emerald-300 font-medium' : 'text-gray-400'}">${formatTime(p.hrRegistro)}</span>
              </div>
              ${diffAtend !== null ? `
                <div class="mt-1 pt-1 border-t border-gray-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px]">
                  <span class="text-orange-600 dark:text-orange-400 font-sans font-bold">⏱️ Atend:</span>
                  <span class="font-bold font-mono text-orange-700 dark:text-orange-300">${formatDuration(diffAtend)}</span>
                </div>
              ` : ''}
            </div>
          </td>
          <td class="col-filialpdv px-3 py-3 whitespace-nowrap">
            <div class="flex items-center gap-1 flex-wrap">
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40">Filial: ${p.cdFilial || '1'}</span>
              ${p.cdPDV ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40">PDV: ${p.cdPDV}</span>` : ''}
              ${p.nrCupom ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">Cupom: ${p.nrCupom}</span>` : ''}
            </div>
          </td>
          <td class="col-operador px-3 py-3 whitespace-nowrap">
            <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50">
              <svg class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
              ${operadorNome}
            </span>
          </td>
          <td class="col-cliente px-3 py-3 whitespace-normal max-w-xs">
            <div class="font-medium text-gray-900 dark:text-gray-100 leading-tight">${clienteInfo}</div>
            ${p.Telefone ? `<div class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1"><svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>${p.Telefone}</div>` : ''}
            ${enderecoFormatado ? `<div class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate" title="${enderecoFormatado}">${enderecoFormatado}</div>` : ''}
          </td>
          <td class="col-pagamento px-3 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 dark:bg-slate-700/60 text-gray-700 dark:text-gray-300">
              ${p.txPagamento || 'Padrão'}
            </span>
          </td>
          <td class="col-frete px-3 py-3 whitespace-nowrap text-right text-gray-500 dark:text-gray-400">
            ${Number(p.vlFrete) > 0 ? formatCurrency(p.vlFrete) : '-'}
          </td>
          <td class="col-desconto px-3 py-3 whitespace-nowrap text-right text-amber-600 dark:text-amber-400">
            ${Number(p.vlDesconto) > 0 ? `-${formatCurrency(p.vlDesconto)}` : '-'}
          </td>
          <td class="col-valortotal px-3 py-3 whitespace-nowrap text-right font-bold font-mono text-sm ${isCanc ? 'text-gray-400 line-through' : 'text-emerald-600 dark:text-emerald-400'}">
            ${formatCurrency(p.vlTotal)}
          </td>
          <td class="col-produtos px-3 py-3 whitespace-normal max-w-xs text-xs text-gray-700 dark:text-gray-300">
            <div class="line-clamp-2" title="${p.produtosResumo || ''}">${p.produtosResumo || '-'}</div>
          </td>
          <td class="col-status px-3 py-3 whitespace-nowrap text-center">
            ${statusBadge}
          </td>
          <td class="col-acoes px-3 py-3 whitespace-nowrap text-center">
            <button type="button" class="btn-view-items p-1.5 rounded-lg text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-colors cursor-pointer" data-cd-pedido="${p.cdPedido}" data-cd-filial="${p.cdFilial || ''}" title="Visualizar Itens do Pedido">
              <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
            </button>
          </td>
        </tr>
      `;
        }).join('');
        // Apply active column visibility to freshly rendered rows
        applyColumnVisibility();
        // Attach click listeners to item buttons
        tbody.querySelectorAll('.btn-view-items').forEach((btn) => {
            btn.addEventListener('click', () => {
                const cdPedido = btn.getAttribute('data-cd-pedido');
                const cdFilial = btn.getAttribute('data-cd-filial');
                if (cdPedido)
                    openModalItems(cdPedido, cdFilial);
            });
        });
    }
    // ─── Modal Items Detail ─────────────────────────────────────────────────────
    async function openModalItems(cdPedido, cdFilial) {
        const modal = getById('modalPedidoItems');
        const title = getById('modalPedidoTitle');
        const subtitle = getById('modalPedidoSubtitle');
        const infoSection = getById('modalPedidoInfo');
        const tbody = getById('modalItemsTableBody');
        const itemsCount = getById('modalItemsCount');
        const itemsTotal = getById('modalItemsTotal');
        if (!modal)
            return;
        // Find parent pedido object
        const pedido = pedidosData.find((p) => String(p.cdPedido) === String(cdPedido));
        const operadorNome = pedido ? (pedido.nmOperador || pedido.nmVendedor || (pedido.cdVendedor ? `Vendedor #${pedido.cdVendedor}` : (pedido.cdUsuario ? `Usuário #${pedido.cdUsuario}` : 'LOJA'))) : 'LOJA';
        if (title)
            title.textContent = `Pedido #${cdPedido}`;
        if (subtitle)
            subtitle.textContent = pedido ? `Cliente: ${pedido.nmCliente || 'Consumidor'} | Operador: ${operadorNome} | Filial: ${pedido.cdFilial || '1'}` : 'Consulta de itens (tbPedidoItem)';
        if (infoSection && pedido) {
            const modalStart = pedido.hrInclusao || pedido.dtPedido;
            const modalEnd = pedido.hrRegistro || pedido.hrEmissao;
            const modalDiff = (modalStart && modalEnd) ? calculateMinutesDiff(modalStart, modalEnd) : null;
            const modalDiffSep = (pedido.hrSeparacaoInicio && pedido.hrSeparacaoFim) ? calculateMinutesDiff(pedido.hrSeparacaoInicio, pedido.hrSeparacaoFim) : null;
            const modalDiffConf = (pedido.hrConferenciaInicio && pedido.hrConferenciaFim) ? calculateMinutesDiff(pedido.hrConferenciaInicio, pedido.hrConferenciaFim) : null;
            const isCanc = pedido.statusPedido === 'CANCELADO' || pedido.inCancelado === true || pedido.inCancelado === 1 || !!pedido.dtCancelado;
            const isUnfin = !isCanc && (pedido.statusPedido === 'NAO_FINALIZADO' || (!pedido.hrRegistro && !pedido.hrEmissao && !pedido.nrCupom && !pedido.COO && !pedido.ValorRegistrado));
            const modalStatusBadge = isCanc
                ? '<span class="text-rose-600 dark:text-rose-400 font-bold">🔴 Cancelado</span>'
                : (isUnfin ? '<span class="text-amber-600 dark:text-amber-400 font-bold">⏳ Em Aberto (Não Finalizado)</span>' : '<span class="text-emerald-600 dark:text-emerald-400 font-bold">✅ Concluído</span>');
            infoSection.innerHTML = `
        <div class="col-span-2 sm:col-span-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-gray-200 dark:border-slate-700">
          <div class="flex flex-col">
            <span class="text-gray-400 text-[10px] uppercase font-bold">Data Pedido</span>
            <span class="font-bold text-gray-900 dark:text-white mt-0.5">${formatDate(pedido.dtPedido)}</span>
          </div>
          <div class="flex flex-col">
            <span class="text-gray-400 text-[10px] uppercase font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>Inclusão</span>
            <span class="font-medium text-blue-600 dark:text-blue-400 mt-0.5 font-mono">${formatTime(pedido.hrInclusao)}</span>
          </div>
          <div class="flex flex-col">
            <span class="text-gray-400 text-[10px] uppercase font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Separação Início</span>
            <span class="font-medium text-amber-600 dark:text-amber-400 mt-0.5 font-mono">${formatTime(pedido.hrSeparacaoInicio)}</span>
          </div>
          <div class="flex flex-col">
            <span class="text-gray-400 text-[10px] uppercase font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-amber-600"></span>Separação Fim</span>
            <span class="font-medium text-amber-700 dark:text-amber-300 mt-0.5 font-mono">${formatTime(pedido.hrSeparacaoFim)}</span>
          </div>
          <div class="flex flex-col">
            <span class="text-gray-400 text-[10px] uppercase font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>Conferência Início</span>
            <span class="font-medium text-purple-600 dark:text-purple-400 mt-0.5 font-mono">${formatTime(pedido.hrConferenciaInicio)}</span>
          </div>
          <div class="flex flex-col">
            <span class="text-gray-400 text-[10px] uppercase font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-purple-600"></span>Conferência Fim</span>
            <span class="font-medium text-purple-700 dark:text-purple-300 mt-0.5 font-mono">${formatTime(pedido.hrConferenciaFim)}</span>
          </div>
          <div class="flex flex-col">
            <span class="text-gray-400 text-[10px] uppercase font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Registro</span>
            <span class="font-medium text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">${formatTime(pedido.hrRegistro)}</span>
          </div>
          <div class="flex flex-col">
            <span class="text-orange-600 dark:text-orange-400 text-[10px] uppercase font-bold flex items-center gap-1">⏱️ Tempo Atend.</span>
            <span class="font-bold text-orange-600 dark:text-orange-400 mt-0.5 font-mono">${modalDiff !== null ? formatDuration(modalDiff) : '-'}</span>
          </div>
          ${modalDiffSep !== null ? `
            <div class="flex flex-col">
              <span class="text-amber-600 dark:text-amber-400 text-[10px] uppercase font-bold flex items-center gap-1">⏱️ Separação</span>
              <span class="font-bold text-amber-600 dark:text-amber-400 mt-0.5 font-mono">${formatDuration(modalDiffSep)}</span>
            </div>
          ` : ''}
          ${modalDiffConf !== null ? `
            <div class="flex flex-col">
              <span class="text-purple-600 dark:text-purple-400 text-[10px] uppercase font-bold flex items-center gap-1">⏱️ Conferência</span>
              <span class="font-bold text-purple-600 dark:text-purple-400 mt-0.5 font-mono">${formatDuration(modalDiffConf)}</span>
            </div>
          ` : ''}
        </div>
        <div class="flex flex-col">
          <span class="text-gray-400 text-[10px] uppercase font-bold">Cliente / Contato</span>
          <span class="font-medium text-gray-800 dark:text-gray-200 mt-0.5">${pedido.nmCliente || 'Consumidor'} ${pedido.Telefone ? `(${pedido.Telefone})` : ''}</span>
        </div>
        <div class="flex flex-col">
          <span class="text-gray-400 text-[10px] uppercase font-bold">Operador / Vendedor</span>
          <span class="font-bold text-purple-700 dark:text-purple-300 mt-0.5 flex items-center gap-1">
            <svg class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            ${operadorNome}
          </span>
        </div>
        <div class="flex flex-col">
          <span class="text-gray-400 text-[10px] uppercase font-bold">Situação / Status</span>
          <span class="mt-0.5">${modalStatusBadge}</span>
        </div>
        <div class="flex flex-col">
          <span class="text-gray-400 text-[10px] uppercase font-bold">Valor do Pedido</span>
          <span class="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono text-sm">${formatCurrency(pedido.vlTotal)}</span>
        </div>
        <div class="flex flex-col col-span-2 sm:col-span-4">
          <span class="text-gray-400 text-[10px] uppercase font-bold">Endereço de Entrega</span>
          <span class="font-medium text-gray-800 dark:text-gray-200 mt-0.5 truncate" title="${[pedido.Endereco, pedido.Bairro, pedido.Cidade].filter(Boolean).join(', ')}">${[pedido.Endereco, pedido.Bairro, pedido.Cidade].filter(Boolean).join(', ') || 'Balcão / Retirada'}</span>
        </div>
      `;
        }
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-xs text-gray-500"><div class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-brand-600 mr-2 align-middle"></div>Carregando produtos do pedido...</td></tr>`;
        }
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
        try {
            const company = getById('filterCompany')?.value || '';
            const connectionId = getById('filterConnection')?.value || '';
            let url = `/finance/reports/pedidos-dorsal/items?cdPedido=${encodeURIComponent(cdPedido)}`;
            if (company)
                url += `&targetCompanyId=${encodeURIComponent(company)}`;
            if (connectionId)
                url += `&connectionId=${encodeURIComponent(connectionId)}`;
            if (cdFilial)
                url += `&cdFilial=${encodeURIComponent(cdFilial)}`;
            const res = await api(url);
            const items = res.data || [];
            let totalVal = 0;
            items.forEach((it) => {
                const q = Number(it.qtPedido) || 0;
                const v = Number(it.vlProduto) || 0;
                totalVal += (q * v);
            });
            if (itemsCount)
                itemsCount.textContent = `${items.length} produto(s)`;
            if (itemsTotal)
                itemsTotal.textContent = formatCurrency(totalVal > 0 ? totalVal : (pedido?.vlTotal || 0));
            if (!tbody)
                return;
            if (items.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-xs text-gray-500">Nenhum item registrado para este pedido na tabela tbPedidoItem.</td></tr>`;
                return;
            }
            tbody.innerHTML = items.map((it, i) => {
                const q = Number(it.qtPedido) || 0;
                const qAtend = Number(it.qtAtendido) || 0;
                const v = Number(it.vlProduto) || 0;
                const itemTotal = q * v;
                const isItemCanc = it.inCancelado === true || it.inCancelado === 1;
                return `
          <tr class="hover:bg-gray-50/60 dark:hover:bg-slate-700/30 text-xs ${isItemCanc ? 'opacity-60 line-through' : ''}">
            <td class="px-3 py-2 text-gray-400 font-mono">${it.cdItem || (i + 1)}</td>
            <td class="px-3 py-2 font-mono font-medium text-gray-700 dark:text-gray-300">${it.cdProdutoPedido || '-'}</td>
            <td class="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
              <div>${it.nmProduto || 'Produto não cadastrado'}</div>
              ${it.Obs ? `<div class="text-[10px] text-gray-400 italic mt-0.5">Obs: ${it.Obs}</div>` : ''}
            </td>
            <td class="px-3 py-2 text-right font-mono font-medium text-gray-800 dark:text-gray-200">${q.toFixed(2)}</td>
            <td class="px-3 py-2 text-right font-mono text-gray-500 dark:text-gray-400">${qAtend.toFixed(2)}</td>
            <td class="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">${formatCurrency(v)}</td>
            <td class="px-3 py-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">${formatCurrency(itemTotal)}</td>
            <td class="px-3 py-2 text-center">
              ${isItemCanc ? `<span class="px-1.5 py-0.2 rounded text-[10px] bg-red-100 text-red-800 font-bold">Cancelado</span>` : `<span class="px-1.5 py-0.2 rounded text-[10px] bg-green-100 text-green-800 font-bold">Ativo</span>`}
            </td>
          </tr>
        `;
            }).join('');
        }
        catch (err) {
            console.error('Erro ao buscar itens do pedido:', err);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-xs text-rose-500">Erro ao consultar itens: ${err?.message || 'Falha de conexão'}.</td></tr>`;
            }
        }
    }
    function closeModalItems() {
        const modal = getById('modalPedidoItems');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }
    // ─── Column Visibility Management ───────────────────────────────────────────
    const STORAGE_KEY_COLUMNS = 'erp_rel_pedido_dorsal_columns_visibility';
    const defaultColumnsState = {
        idx: true,
        pedido: true,
        dtpedido: true,
        horarios: true,
        filialpdv: true,
        operador: true,
        cliente: true,
        pagamento: true,
        frete: true,
        desconto: true,
        valortotal: true,
        produtos: false,
        status: true,
        acoes: true,
    };
    function saveColumnVisibility() {
        const preferences = {};
        const checkboxes = document.querySelectorAll('input[data-column-target]');
        checkboxes.forEach((cb) => {
            const target = cb.getAttribute('data-column-target');
            if (target) {
                preferences[target] = cb.checked;
            }
        });
        if (window.CompanyStorage) {
            window.CompanyStorage.setItem(STORAGE_KEY_COLUMNS, JSON.stringify(preferences));
        }
        else {
            localStorage.setItem(STORAGE_KEY_COLUMNS, JSON.stringify(preferences));
        }
    }
    function loadColumnVisibility() {
        try {
            const saved = window.CompanyStorage?.getItem(STORAGE_KEY_COLUMNS) ?? localStorage.getItem(STORAGE_KEY_COLUMNS);
            const preferences = saved ? JSON.parse(saved) : defaultColumnsState;
            const checkboxes = document.querySelectorAll('input[data-column-target]');
            checkboxes.forEach((cb) => {
                const target = cb.getAttribute('data-column-target');
                if (target && target in preferences) {
                    cb.checked = preferences[target];
                }
            });
        }
        catch (e) {
            console.error('Erro ao carregar preferências de colunas:', e);
        }
    }
    function applyColumnVisibility() {
        const checkboxes = document.querySelectorAll('input[data-column-target]');
        checkboxes.forEach((cb) => {
            const target = cb.getAttribute('data-column-target');
            if (!target)
                return;
            const elements = document.querySelectorAll(`.col-${target}`);
            elements.forEach((el) => {
                if (cb.checked) {
                    el.classList.remove('hidden');
                }
                else {
                    el.classList.add('hidden');
                }
            });
        });
    }
    function initColumnVisibility() {
        const btnToggle = getById('btnToggleColumns');
        const menu = getById('columnsDropdownMenu');
        const btnReset = getById('btnResetColumns');
        const checkboxes = document.querySelectorAll('input[data-column-target]');
        loadColumnVisibility();
        applyColumnVisibility();
        checkboxes.forEach((cb) => {
            cb.addEventListener('change', () => {
                saveColumnVisibility();
                applyColumnVisibility();
            });
        });
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                checkboxes.forEach((cb) => {
                    const target = cb.getAttribute('data-column-target');
                    if (target && target in defaultColumnsState) {
                        cb.checked = defaultColumnsState[target];
                    }
                });
                saveColumnVisibility();
                applyColumnVisibility();
            });
        }
        if (btnToggle && menu) {
            btnToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.classList.toggle('hidden');
            });
            document.addEventListener('click', (e) => {
                if (!menu.contains(e.target) && e.target !== btnToggle && !btnToggle.contains(e.target)) {
                    menu.classList.add('hidden');
                }
            });
        }
    }
    // ─── Initialize ─────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', async () => {
        setDefaultPeriod();
        loadLastFilters();
        initCollapsiblePanels();
        initColumnVisibility();
        // Company selector change
        getById('filterCompany')?.addEventListener('change', async () => {
            const selectedCompany = getById('filterCompany')?.value || '';
            if (selectedCompany) {
                if (window.CompanyStorage) {
                    window.CompanyStorage.setItem('rel_pedido_dorsal_selected_company', selectedCompany);
                }
                else {
                    localStorage.setItem('rel_pedido_dorsal_selected_company', selectedCompany);
                }
            }
            await loadDorsalConnections(selectedCompany);
            await loadReport();
        });
        // Connection selector change
        getById('filterConnection')?.addEventListener('change', () => {
            const connectionId = getById('filterConnection')?.value || '';
            const companyParam = getById('filterCompany')?.value || '';
            if (connectionId) {
                if (window.CompanyStorage) {
                    window.CompanyStorage.setItem(`rel_pedido_dorsal_connection_${companyParam || 'default'}`, connectionId);
                }
                else {
                    localStorage.setItem(`rel_pedido_dorsal_connection_${companyParam || 'default'}`, connectionId);
                    localStorage.setItem('rel_pedido_dorsal_connection', connectionId);
                }
            }
            const select = getById('filterConnection');
            const selectedOption = select?.options[select.selectedIndex];
            const connFilial = selectedOption?.getAttribute('data-cdfilial');
            const filialEl = getById('filterFilial');
            if (filialEl && connFilial) {
                filialEl.value = String(connFilial).trim();
            }
            saveLastFilters();
            loadReport();
        });
        const btnApply = getById('btnApplyFilters');
        if (btnApply)
            btnApply.addEventListener('click', loadReport);
        const btnClear = getById('btnClearFilters');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                setDefaultPeriod();
                const filial = getById('filterFilial');
                const status = getById('filterStatus');
                const search = getById('filterSearch');
                if (filial)
                    filial.value = '';
                if (status)
                    status.value = '0';
                if (search)
                    search.value = '';
                saveLastFilters();
                loadReport();
            });
        }
        const filterSearch = getById('filterSearch');
        if (filterSearch) {
            filterSearch.addEventListener('input', () => {
                saveLastFilters();
                renderReport();
            });
        }
        const filterStatus = getById('filterStatus');
        if (filterStatus) {
            filterStatus.addEventListener('change', () => {
                saveLastFilters();
                loadReport();
            });
        }
        ['filterStartDate', 'filterEndDate', 'filterFilial'].forEach(id => {
            const el = getById(id);
            if (el) {
                el.addEventListener('change', () => {
                    saveLastFilters();
                });
            }
        });
        const btnCloseModal = getById('btnCloseModalItems');
        if (btnCloseModal)
            btnCloseModal.addEventListener('click', closeModalItems);
        const btnModalCloseAction = getById('btnModalCloseAction');
        if (btnModalCloseAction)
            btnModalCloseAction.addEventListener('click', closeModalItems);
        const modal = getById('modalPedidoItems');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal)
                    closeModalItems();
            });
        }
        const btnPrint = getById('btnPrint');
        if (btnPrint) {
            btnPrint.addEventListener('click', () => {
                window.print();
            });
        }
        // Trigger initial load with companies and connections
        await loadCompanies();
        const initialCompany = getById('filterCompany')?.value || '';
        await loadDorsalConnections(initialCompany);
        await loadReport();
    });
})();
