// @ts-nocheck
(() => {
    let reportData = [];
    let currentSortCol = 'Produto';
    let currentSortDir = 'asc';
    const getById = (id) => document.getElementById(id);
    const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
    const formatPercent = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0) + ' %';
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    // ─── Company & Dorsal Connections ──────────────────────────────────────────
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
            const isGeneralAdmin = meRes?.data?.user?.role === 'super_admin' ||
                activeCompany?.is_general_admin === 1 ||
                activeCompany?.is_general_admin === true;
            if (isGeneralAdmin) {
                compSelect.disabled = false;
                const savedCompanyId = localStorage.getItem('rel_rafael_selected_company');
                compSelect.innerHTML = accessibleCompanies.map((c) => {
                    const idVal = c.public_id || c.id;
                    const displayName = c.trade_name || c.name || `Empresa #${c.id}`;
                    const isSelected = savedCompanyId
                        ? (idVal === savedCompanyId || String(c.id) === String(savedCompanyId))
                        : (idVal === currentCompanyPublicId);
                    return `<option value="${idVal}" ${isSelected ? 'selected' : ''}>${escapeHtml(displayName)}</option>`;
                }).join('');
            }
            else {
                const displayName = activeCompany?.trade_name || activeCompany?.name || 'Minha Empresa';
                const idVal = activeCompany?.public_id || activeCompany?.id || '';
                compSelect.innerHTML = `<option value="${idVal}" selected>${escapeHtml(displayName)}</option>`;
                compSelect.value = idVal;
                compSelect.disabled = true;
            }
            if (compSelect.options.length > 0 && compSelect.selectedIndex === -1) {
                compSelect.selectedIndex = 0;
            }
        }
        catch (err) {
            console.warn('Falha ao carregar lista de empresas:', err);
            compSelect.innerHTML = '<option value="">Minha Empresa</option>';
        }
    }
    async function loadExternalConnections(targetCompany) {
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
                select.innerHTML = '<option value="">Padrão da Empresa (Dorsal)</option>';
                if (res.company?.cdfilial) {
                    const filialEl = getById('filterFilial');
                    if (filialEl && (!filialEl.value || targetCompany)) {
                        filialEl.value = String(res.company.cdfilial).trim();
                    }
                }
                return;
            }
            const savedConnectionId = localStorage.getItem(`rel_rafael_dorsal_connection_${companyParam || 'default'}`)
                || localStorage.getItem('rel_rafael_dorsal_connection')
                || localStorage.getItem(`rel_rafael_connection_${companyParam || 'default'}`)
                || localStorage.getItem('rel_rafael_connection');
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
            select.innerHTML = '<option value="">Padrão da Empresa (Dorsal)</option>';
        }
    }
    // ─── Setup Period defaults ──────────────────────────────────────────────────
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
    function initFilterToggle() {
        const toggleBtn = getById('toggleFilterBtn');
        const body = getById('filterBody');
        const chevron = getById('filterChevron');
        if (!toggleBtn || !body || !chevron)
            return;
        let isOpen = true;
        body.style.maxHeight = `${body.scrollHeight}px`;
        toggleBtn.addEventListener('click', () => {
            isOpen = !isOpen;
            body.style.maxHeight = isOpen ? `${body.scrollHeight}px` : '0px';
            chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
        });
    }
    // ─── Load Report ────────────────────────────────────────────────────────────
    async function loadReport() {
        const start = getById('filterStartDate')?.value || '';
        const end = getById('filterEndDate')?.value || '';
        const filial = getById('filterFilial')?.value || '';
        const companyParam = getById('filterCompany')?.value || '';
        const connectionId = getById('filterConnection')?.value || '';
        if (companyParam) {
            localStorage.setItem('rel_rafael_selected_company', companyParam);
        }
        if (connectionId) {
            localStorage.setItem('rel_rafael_connection', connectionId);
            localStorage.setItem(`rel_rafael_connection_${companyParam || 'default'}`, connectionId);
        }
        if (!start || !end) {
            UI.showAlert('alertMessage', 'As datas de início e fim são obrigatórias.', 'warn');
            return;
        }
        const loader = getById('loadingOverlay');
        const reportSection = getById('reportSection');
        if (loader)
            loader.classList.remove('hidden');
        if (reportSection) {
            reportSection.classList.remove('hidden');
            reportSection.classList.add('flex');
        }
        const summaryCardWrapper = getById('summaryCardWrapper');
        if (summaryCardWrapper) {
            summaryCardWrapper.classList.add('hidden');
        }
        try {
            const compParam = companyParam ? `&targetCompanyId=${encodeURIComponent(companyParam)}` : '';
            const connParam = connectionId ? `&connectionId=${encodeURIComponent(connectionId)}&connectionType=dorsal` : '&connectionType=dorsal';
            const url = `/finance/reports/rafael?startDate=${start}&endDate=${end}&cdFilial=${filial}${compParam}${connParam}`;
            const res = await api(url);
            reportData = res.data || [];
            // Calculate markup for each row dynamically
            reportData.forEach((row) => {
                const sales = parseFloat(row.vlVenda) || 0;
                const cost = parseFloat(row.vlCustovenda) || 0;
                row.markup = cost > 0.001 ? ((sales - cost) / cost) * 100 : 0;
            });
            populateClassificacaoDropdown();
            renderReport();
        }
        catch (err) {
            console.error(err);
            UI.showAlert('alertMessage', err?.message || 'Falha ao conectar com o banco de dados para gerar o relatório.', 'error');
            const tbody = getById('reportTableBody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="12" class="px-6 py-10 text-center text-sm text-red-500 dark:text-red-400 font-semibold">Falha ao carregar relatório: ${err?.message || 'Conexão indisponível'}.</td></tr>`;
            }
        }
        finally {
            if (loader)
                loader.classList.add('hidden');
        }
    }
    // ─── Sort Helper ────────────────────────────────────────────────────────────
    function sortData(col) {
        if (currentSortCol === col) {
            currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
        }
        else {
            currentSortCol = col;
            currentSortDir = 'asc';
        }
        // Update Header Sort Icons visual
        document.querySelectorAll('.sortable').forEach((th) => {
            const sortCol = th.dataset.sort;
            if (sortCol === currentSortCol) {
                th.classList.add('underline', 'font-black');
            }
            else {
                th.classList.remove('underline', 'font-black');
            }
        });
        renderReport();
    }
    // ─── Render Tables and summaries ───────────────────────────────────────────
    function renderReport() {
        const tbody = getById('reportTableBody');
        if (!tbody)
            return;
        const searchQuery = (getById('filterSearch')?.value || '').toLowerCase().trim();
        const classFilter = getById('filterClassificacao')?.value || '';
        // Client-side quick filter
        let filtered = reportData;
        if (classFilter) {
            filtered = filtered.filter((r) => String(r.classificacao || '') === classFilter);
        }
        if (searchQuery) {
            filtered = filtered.filter((r) => {
                const prod = String(r.Produto || '').toLowerCase();
                const code = String(r.cdProduto || '').toLowerCase();
                const superCode = String(r.superProduto || '').toLowerCase();
                const classif = String(r.classificacao || '').toLowerCase();
                const subclassif = String(r.subclassificacao || '').toLowerCase();
                return prod.includes(searchQuery) || code.includes(searchQuery) || superCode.includes(searchQuery) || classif.includes(searchQuery) || subclassif.includes(searchQuery);
            });
        }
        // Sort logic
        filtered.sort((a, b) => {
            let valA = a[currentSortCol];
            let valB = b[currentSortCol];
            // Convert to number for proper sorting if numeric
            if (['qtItem', 'vlVenda', 'vlCustovenda', 'vlCustodia', 'Descontos', 'vlunCusto', 'vlunvenda', 'markup'].includes(currentSortCol)) {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            }
            else {
                valA = String(valA || '').toLowerCase();
                valB = String(valB || '').toLowerCase();
            }
            if (valA < valB)
                return currentSortDir === 'asc' ? -1 : 1;
            if (valA > valB)
                return currentSortDir === 'asc' ? 1 : -1;
            return 0;
        });
        // Render Table Rows
        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="12" class="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum produto vendido encontrado.</td></tr>`;
            const wrapper = getById('summaryCardWrapper');
            if (wrapper) {
                wrapper.classList.add('hidden');
            }
            return;
        }
        tbody.innerHTML = filtered
            .map((r) => {
            return `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
            <td class="px-3 py-3 text-center whitespace-nowrap text-xs font-semibold">
                ${r.cdProduto ? `
                <button type="button" onclick="openDetailModal('${r.cdProduto}', '${r.Produto.replace(/'/g, "\\'")}')" class="text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 hover:underline focus:outline-none cursor-pointer">${r.cdProduto}</button>
                ` : '-'}
            </td>
            <td class="px-3 py-3 text-center whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">${r.superProduto || '-'}</td>
            <td class="px-3 py-3 text-xs text-gray-900 dark:text-gray-100 font-medium">${r.Produto || '-'}</td>
            <td class="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 font-medium">${r.classificacao || '-'}</td>
            <td class="px-3 py-3 text-center whitespace-nowrap text-xs font-semibold text-gray-900 dark:text-white">${r.qtItem || 0}</td>
            <td class="px-3 py-3 text-right whitespace-nowrap text-xs font-bold text-gray-900 dark:text-white">${formatCurrency(r.vlVenda)}</td>
            <td class="px-3 py-3 text-right whitespace-nowrap text-xs text-red-500 dark:text-red-400">${formatCurrency(r.vlCustovenda)}</td>
            <td class="px-3 py-3 text-right whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">${formatCurrency(r.vlCustodia)}</td>
            <td class="px-3 py-3 text-right whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">${formatCurrency(r.Descontos)}</td>
            <td class="px-3 py-3 text-right whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">${formatCurrency(r.vlunCusto)}</td>
            <td class="px-3 py-3 text-right whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">${formatCurrency(r.vlunvenda)}</td>
            <td class="px-3 py-3 text-right whitespace-nowrap text-xs font-semibold ${r.markup >= 30 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}">${formatPercent(r.markup)}</td>
        </tr>`;
        })
            .join('');
        // Summary Card Aggregates
        let totalQty = 0;
        let totalSales = 0;
        let totalCostSales = 0;
        let totalCostCustody = 0;
        let totalDiscounts = 0;
        filtered.forEach((r) => {
            totalQty += parseFloat(r.qtItem) || 0;
            totalSales += parseFloat(r.vlVenda) || 0;
            totalCostSales += parseFloat(r.vlCustovenda) || 0;
            totalCostCustody += parseFloat(r.vlCustodia) || 0;
            totalDiscounts += parseFloat(r.Descontos) || 0;
        });
        const avgMarkupSales = totalCostSales > 0.001 ? ((totalSales - totalCostSales) / totalCostSales) * 100 : 0;
        const profitSales = totalSales - totalCostSales;
        const avgMarkupDay = totalCostCustody > 0.001 ? ((totalSales - totalCostCustody) / totalCostCustody) * 100 : 0;
        const profitDay = totalSales - totalCostCustody;
        getById('totalQty').textContent = totalQty;
        getById('totalSales').textContent = formatCurrency(totalSales);
        getById('totalCostSales').textContent = formatCurrency(totalCostSales);
        getById('totalCostCustody').textContent = formatCurrency(totalCostCustody);
        // Lucro Venda
        const profitSalesEl = getById('totalProfitSales');
        if (profitSalesEl) {
            profitSalesEl.textContent = formatCurrency(profitSales);
            if (profitSales >= 0) {
                profitSalesEl.className = 'text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1';
            }
            else {
                profitSalesEl.className = 'text-xl font-bold text-red-500 dark:text-red-400 mt-1';
            }
        }
        // Lucro Dia
        const profitDayEl = getById('totalProfitDay');
        if (profitDayEl) {
            profitDayEl.textContent = formatCurrency(profitDay);
            if (profitDay >= 0) {
                profitDayEl.className = 'text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1';
            }
            else {
                profitDayEl.className = 'text-xl font-bold text-red-500 dark:text-red-400 mt-1';
            }
        }
        // Markup Venda
        const markupSalesEl = getById('averageMarkupSales');
        if (markupSalesEl) {
            markupSalesEl.textContent = formatPercent(avgMarkupSales);
            if (avgMarkupSales >= 30) {
                markupSalesEl.className = 'text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1';
            }
            else {
                markupSalesEl.className = 'text-xl font-bold text-amber-500 mt-1';
            }
        }
        // Markup Dia
        const markupDayEl = getById('averageMarkupDay');
        if (markupDayEl) {
            markupDayEl.textContent = formatPercent(avgMarkupDay);
            if (avgMarkupDay >= 30) {
                markupDayEl.className = 'text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1';
            }
            else {
                markupDayEl.className = 'text-xl font-bold text-amber-500 mt-1';
            }
        }
        const wrapper = getById('summaryCardWrapper');
        if (wrapper) {
            wrapper.classList.remove('hidden');
            const body = getById('summaryBody');
            if (body && body.style.maxHeight !== '0px') {
                body.style.maxHeight = `${body.scrollHeight}px`;
            }
        }
    }
    function populateClassificacaoDropdown() {
        const select = getById('filterClassificacao');
        if (!select)
            return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">Todas</option>';
        const uniqueClasses = Array.from(new Set(reportData.map((r) => String(r.classificacao || '').trim())))
            .filter(c => c !== '')
            .sort((a, b) => a.localeCompare(b, 'pt-BR'));
        uniqueClasses.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            if (c === currentVal) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
    }
    // ─── Summary Toggle ──────────────────────────────────────────────────────────
    function initSummaryToggle() {
        const toggleBtn = getById('toggleSummaryBtn');
        const body = getById('summaryBody');
        const chevron = getById('summaryChevron');
        if (!toggleBtn || !body || !chevron)
            return;
        let isOpen = true;
        body.style.maxHeight = `${body.scrollHeight}px`;
        toggleBtn.addEventListener('click', () => {
            isOpen = !isOpen;
            body.style.maxHeight = isOpen ? `${body.scrollHeight}px` : '0px';
            chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
        });
    }
    // ─── DOM Initializer ────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', async () => {
        setDefaultPeriod();
        initFilterToggle();
        initSummaryToggle();
        // Fetch default company configuration to fill in default cdFilial if empty
        try {
            const meRes = await api('/auth/me');
            const company = meRes?.data?.company;
            if (company && company.cdfilial) {
                const filialEl = getById('filterFilial');
                if (filialEl && !filialEl.value) {
                    filialEl.value = String(company.cdfilial).trim();
                }
            }
        }
        catch (err) {
            console.warn('Failed to load user me details:', err);
        }
        // Print Listener
        getById('btnPrint')?.addEventListener('click', () => window.print());
        // Filter company change
        getById('filterCompany')?.addEventListener('change', async () => {
            const selectedCompany = getById('filterCompany')?.value || '';
            if (selectedCompany) {
                localStorage.setItem('rel_rafael_selected_company', selectedCompany);
            }
            await loadExternalConnections(selectedCompany);
            await loadReport();
        });
        // Filter connection change
        getById('filterConnection')?.addEventListener('change', () => {
            const select = getById('filterConnection');
            const connectionId = select?.value || '';
            const companyParam = getById('filterCompany')?.value || '';
            if (connectionId) {
                localStorage.setItem('rel_rafael_connection', connectionId);
                localStorage.setItem(`rel_rafael_connection_${companyParam || 'default'}`, connectionId);
            }
            const selectedOption = select?.options[select.selectedIndex];
            const filialValue = selectedOption?.getAttribute('data-cdfilial');
            if (filialValue) {
                const filialEl = getById('filterFilial');
                if (filialEl) {
                    filialEl.value = filialValue.trim();
                }
            }
            loadReport();
        });
        // Filter Buttons Action
        getById('btnApplyFilters')?.addEventListener('click', loadReport);
        getById('btnClearFilters')?.addEventListener('click', async () => {
            getById('filterSearch').value = '';
            const classSelect = getById('filterClassificacao');
            if (classSelect)
                classSelect.value = '';
            setDefaultPeriod();
            await loadReport();
        });
        // Client-side quick product search (debounced input)
        let searchDebounce = null;
        getById('filterSearch')?.addEventListener('input', () => {
            if (searchDebounce)
                clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => {
                renderReport();
            }, 300);
        });
        getById('filterClassificacao')?.addEventListener('change', () => {
            renderReport();
        });
        // Column Sorting click listeners
        document.querySelectorAll('.sortable').forEach((th) => {
            th.addEventListener('click', () => {
                sortData(th.dataset.sort);
            });
        });
        // Trigger initial load
        await loadCompanies();
        const initialCompany = getById('filterCompany')?.value || '';
        await loadExternalConnections(initialCompany);
        await loadReport();
    });
    let currentDetailCdProduto = '';
    let currentDetailNmProduto = '';
    let currentDetailRows = [];
    function showDetailAlert(msg, type = 'success') {
        const alertEl = getById('detailAlertMessage');
        if (!alertEl)
            return;
        alertEl.className = 'mx-6 mt-3 p-3 rounded-lg text-xs border font-medium flex items-center justify-between';
        if (type === 'success') {
            alertEl.classList.add('bg-emerald-50', 'dark:bg-emerald-950/40', 'border-emerald-200', 'dark:border-emerald-800', 'text-emerald-800', 'dark:text-emerald-300');
        }
        else if (type === 'error') {
            alertEl.classList.add('bg-red-50', 'dark:bg-red-950/40', 'border-red-200', 'dark:border-red-800', 'text-red-800', 'dark:text-red-300');
        }
        else {
            alertEl.classList.add('bg-amber-50', 'dark:bg-amber-950/40', 'border-amber-200', 'dark:border-amber-800', 'text-amber-800', 'dark:text-amber-300');
        }
        alertEl.innerHTML = `<span>${escapeHtml(msg)}</span><button type="button" onclick="this.parentElement.classList.add('hidden')" class="ml-2 text-current opacity-70 hover:opacity-100">&times;</button>`;
        alertEl.classList.remove('hidden');
    }
    function hideDetailAlert() {
        const alertEl = getById('detailAlertMessage');
        if (alertEl)
            alertEl.classList.add('hidden');
    }
    async function openDetailModal(cdProduto, nmProduto, isRefresh = false) {
        currentDetailCdProduto = cdProduto;
        currentDetailNmProduto = nmProduto;
        const modal = getById('detailModal');
        const title = getById('detailProductName');
        const tbody = getById('detailTableBody');
        const totalQtyEl = getById('detailTotalQty');
        const totalValEl = getById('detailTotalValue');
        const totalCostSalesEl = getById('detailTotalCostSales');
        const totalCostDayEl = getById('detailTotalCostDay');
        if (!modal || !tbody)
            return;
        if (!isRefresh) {
            hideDetailAlert();
            const inputVenda = getById('inputEditCustoVenda');
            const inputDia = getById('inputEditCustoDia');
            if (inputVenda)
                inputVenda.value = '';
            if (inputDia)
                inputDia.value = '';
        }
        // Show modal and clean previous data
        if (title)
            title.textContent = `${nmProduto} (Cód: ${cdProduto})`;
        tbody.innerHTML = `<tr><td colspan="11" class="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Carregando detalhes...</td></tr>`;
        if (totalQtyEl)
            totalQtyEl.textContent = '0';
        if (totalValEl)
            totalValEl.textContent = 'R$ 0,00';
        if (totalCostSalesEl)
            totalCostSalesEl.textContent = 'R$ 0,00';
        if (totalCostDayEl)
            totalCostDayEl.textContent = 'R$ 0,00';
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        try {
            const filiaisSelect = getById('filterFilial');
            const filial = filiaisSelect ? filiaisSelect.value : '';
            const startDate = getById('filterStartDate')?.value || '';
            const endDate = getById('filterEndDate')?.value || '';
            const companyParam = getById('filterCompany')?.value || '';
            const connectionId = getById('filterConnection')?.value || '';
            const compParam = companyParam ? `&targetCompanyId=${encodeURIComponent(companyParam)}` : '';
            const connParam = connectionId ? `&connectionId=${encodeURIComponent(connectionId)}&connectionType=dorsal` : '&connectionType=dorsal';
            const res = await api(`/finance/reports/rafael/detail?startDate=${startDate}&endDate=${endDate}&cdFilial=${filial}&cdProduto=${cdProduto}${compParam}${connParam}`);
            const rows = res.data || [];
            currentDetailRows = rows;
            if (rows.length === 0) {
                tbody.innerHTML = `<tr><td colspan="11" class="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum detalhe de venda encontrado para este produto no período.</td></tr>`;
                return;
            }
            // Pre-fill inputs with current unit costs from the database
            const inputVenda = getById('inputEditCustoVenda');
            const inputDia = getById('inputEditCustoDia');
            if (rows.length > 0) {
                const firstUnitCostSales = rows[0].custoUnitarioVenda !== undefined && rows[0].custoUnitarioVenda !== null ? parseFloat(rows[0].custoUnitarioVenda) : 0;
                const firstUnitCostDay = rows[0].custoUnitarioDia !== undefined && rows[0].custoUnitarioDia !== null ? parseFloat(rows[0].custoUnitarioDia) : 0;
                if (inputVenda && (!inputVenda.value || isRefresh)) {
                    inputVenda.value = (firstUnitCostSales || 0).toFixed(4);
                }
                if (inputDia && (!inputDia.value || isRefresh)) {
                    inputDia.value = (firstUnitCostDay || 0).toFixed(4);
                }
            }
            let totalQty = 0;
            let totalValue = 0;
            let totalCostSales = 0;
            let totalCostDay = 0;
            tbody.innerHTML = rows.map((r) => {
                const qty = parseFloat(r.qtItem) || 0;
                const total = parseFloat(r.valorTotal) || 0;
                const unitPrice = parseFloat(r.valorUnitario) || 0;
                const costSales = parseFloat(r.valorCustoVenda) || 0;
                const costDay = parseFloat(r.valorCustoDia) || 0;
                const unitCostSales = r.custoUnitarioVenda !== undefined && r.custoUnitarioVenda !== null
                    ? parseFloat(r.custoUnitarioVenda)
                    : (qty > 0 ? costSales / qty : 0);
                const unitCostDay = r.custoUnitarioDia !== undefined && r.custoUnitarioDia !== null
                    ? parseFloat(r.custoUnitarioDia)
                    : (qty > 0 ? costDay / qty : 0);
                totalQty += qty;
                totalValue += total;
                totalCostSales += costSales;
                totalCostDay += costDay;
                const dateFormatted = r.dtCupom ? new Date(r.dtCupom).toLocaleString('pt-BR', { timeZone: 'UTC' }) : '-';
                const gdCupomEscaped = String(r.gdCupom || '');
                const nrItemVal = Number(r.nrItem) || 0;
                return `
          <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
            <td class="px-3 py-3 text-center whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">${dateFormatted}</td>
            <td class="px-2 py-3 text-center whitespace-nowrap text-xs font-semibold text-gray-900 dark:text-white">${qty}</td>
            <td class="px-3 py-3 text-xs text-gray-900 dark:text-gray-100 font-medium">${escapeHtml(r.Cliente || '-')}</td>
            <td class="px-3 py-3 text-right whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">${formatCurrency(unitPrice)}</td>
            <td class="px-3 py-3 text-right whitespace-nowrap text-xs font-bold text-gray-900 dark:text-white">${formatCurrency(total)}</td>
            <td class="px-3 py-3 text-right whitespace-nowrap text-xs text-orange-500 dark:text-orange-400 font-semibold">${formatCurrency(unitCostSales)}</td>
            <td class="px-3 py-3 text-right whitespace-nowrap text-xs text-red-500 dark:text-red-400">${formatCurrency(costSales)}</td>
            <td class="px-3 py-3 text-right whitespace-nowrap text-xs text-blue-500 dark:text-blue-400 font-semibold">${formatCurrency(unitCostDay)}</td>
            <td class="px-3 py-3 text-right whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">${formatCurrency(costDay)}</td>
            <td class="px-3 py-3 text-center whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">${escapeHtml(r.Operador || '-')}</td>
            <td class="px-2 py-3 text-center whitespace-nowrap text-xs">
              ${gdCupomEscaped ? `
                <button type="button" onclick="editSingleItemCost('${gdCupomEscaped}', ${nrItemVal}, ${unitCostSales})" title="Alterar custo unitário desta venda" class="p-1 text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition cursor-pointer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
              ` : '-'}
            </td>
          </tr>
        `;
            }).join('');
            if (totalQtyEl)
                totalQtyEl.textContent = String(totalQty);
            if (totalValEl)
                totalValEl.textContent = formatCurrency(totalValue);
            if (totalCostSalesEl)
                totalCostSalesEl.textContent = formatCurrency(totalCostSales);
            if (totalCostDayEl)
                totalCostDayEl.textContent = formatCurrency(totalCostDay);
        }
        catch (err) {
            console.error(err);
            tbody.innerHTML = `<tr><td colspan="11" class="px-6 py-10 text-center text-sm text-red-500 dark:text-red-400 font-semibold">Falha ao carregar detalhes: ${err.message || err}</td></tr>`;
        }
    }
    async function saveProductCosts() {
        if (!currentDetailCdProduto) {
            showDetailAlert('Nenhum produto selecionado.', 'warn');
            return;
        }
        const inputVenda = getById('inputEditCustoVenda');
        const inputDia = getById('inputEditCustoDia');
        const btnSave = getById('btnSaveCosts');
        const valVendaStr = inputVenda ? inputVenda.value.trim().replace(',', '.') : '';
        const valDiaStr = inputDia ? inputDia.value.trim().replace(',', '.') : '';
        const valVenda = valVendaStr !== '' ? parseFloat(valVendaStr) : undefined;
        const valDia = valDiaStr !== '' ? parseFloat(valDiaStr) : undefined;
        if (valVenda === undefined && valDia === undefined) {
            showDetailAlert('Informe pelo menos o Custo Unit. Venda ou o Custo Unit. Dia.', 'warn');
            return;
        }
        if (valVenda !== undefined && (isNaN(valVenda) || valVenda < 0)) {
            showDetailAlert('Valor de Custo Unit. Venda inválido.', 'warn');
            return;
        }
        if (valDia !== undefined && (isNaN(valDia) || valDia < 0)) {
            showDetailAlert('Valor de Custo Unit. Dia inválido.', 'warn');
            return;
        }
        const filiaisSelect = getById('filterFilial');
        const filial = filiaisSelect ? filiaisSelect.value : '';
        const startDate = getById('filterStartDate')?.value || '';
        const endDate = getById('filterEndDate')?.value || '';
        const companyParam = getById('filterCompany')?.value || '';
        const connectionId = getById('filterConnection')?.value || '';
        try {
            if (btnSave) {
                btnSave.disabled = true;
                btnSave.innerHTML = `
          <svg class="animate-spin -ml-1 mr-1.5 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Salvando...
        `;
            }
            const payload = {
                cdProduto: currentDetailCdProduto,
                cdFilial: filial,
                startDate: startDate,
                endDate: endDate,
                custoUnitarioVenda: valVenda,
                custoUnitarioDia: valDia,
                targetCompanyId: companyParam,
                connectionId: connectionId,
                connectionType: 'dorsal'
            };
            const res = await api('/finance/reports/rafael/costs', {
                method: 'POST',
                body: payload
            });
            showDetailAlert('Custos atualizados com sucesso no Solidcon e relatório ajustado!', 'success');
            // Re-fetch detail table
            await openDetailModal(currentDetailCdProduto, currentDetailNmProduto, true);
            // Re-fetch and update main report table and summary cards in background
            await loadReport();
        }
        catch (err) {
            console.error(err);
            showDetailAlert(`Falha ao salvar no Solidcon: ${err.message || err}`, 'error');
        }
        finally {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.innerHTML = `
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          Salvar no Solidcon
        `;
            }
        }
    }
    async function editSingleItemCost(gdCupom, nrItem, currentCost) {
        const costPrompt = window.prompt('Informe o novo Custo Unitário de Venda para este item específico (R$):', (currentCost || 0).toFixed(4));
        if (costPrompt === null)
            return;
        const parsed = parseFloat(costPrompt.trim().replace(',', '.'));
        if (isNaN(parsed) || parsed < 0) {
            alert('Valor de custo inválido.');
            return;
        }
        const filiaisSelect = getById('filterFilial');
        const filial = filiaisSelect ? filiaisSelect.value : '';
        const companyParam = getById('filterCompany')?.value || '';
        const connectionId = getById('filterConnection')?.value || '';
        try {
            const payload = {
                cdProduto: currentDetailCdProduto,
                cdFilial: filial,
                items: [{
                        gdCupom: gdCupom,
                        nrItem: nrItem,
                        custoUnitarioVenda: parsed
                    }],
                targetCompanyId: companyParam,
                connectionId: connectionId,
                connectionType: 'dorsal'
            };
            await api('/finance/reports/rafael/costs', {
                method: 'POST',
                body: payload
            });
            showDetailAlert('Custo do item atualizado com sucesso no Solidcon!', 'success');
            await openDetailModal(currentDetailCdProduto, currentDetailNmProduto, true);
            await loadReport();
        }
        catch (err) {
            console.error(err);
            showDetailAlert(`Falha ao atualizar item no Solidcon: ${err.message || err}`, 'error');
        }
    }
    function closeDetailModal() {
        const modal = getById('detailModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }
    // Bind functions to window object
    window.openDetailModal = openDetailModal;
    window.closeDetailModal = closeDetailModal;
    window.saveProductCosts = saveProductCosts;
    window.editSingleItemCost = editSingleItemCost;
})();
