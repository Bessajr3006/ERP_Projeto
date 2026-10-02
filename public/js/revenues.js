// @ts-nocheck
(() => {
    let revenuesData = [];
    let categoriesData = [];
    let banksData = [];
    let receivableTypesData = [];
    let cardBrandsData = [];
    let cardConfigurationsData = [];
    let customerGroupsData = [];
    let costCentersData = [];
    let g_deleteId = null;
    let g_editId = null;
    let g_baixaId = null;
    let g_whatsappId = null;
    let currentView = window.CompanyStorage?.getItem('revenuesView') || localStorage.getItem('revenuesView') || 'list';
    function getAuthToken() {
        return window.Auth?.getToken?.() || localStorage.getItem('erp_token') || sessionStorage.getItem('erp_token') || '';
    }
    // Expose KPI update function for revenues
    window.updateRevenueKPIs = function (items) {
        if (!items || !items.length) {
            ['kpiTotal', 'kpiPaid', 'kpiPending'].forEach(id => {
                const el = document.getElementById(id);
                if (el)
                    el.textContent = 'R$ 0,00';
            });
            ['kpiTotalCount', 'kpiPaidCount', 'kpiPendingCount'].forEach(id => {
                const el = document.getElementById(id);
                if (el)
                    el.textContent = '0 lançamentos';
            });
            const pb = document.getElementById('kpiPaidBar');
            const pendB = document.getElementById('kpiPendingBar');
            if (pb)
                pb.style.width = '0%';
            if (pendB)
                pendB.style.width = '0%';
            return;
        }
        const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const total = items.reduce((s, r) => s + (parseFloat(r.value) || 0), 0);
        const paid = items.filter(r => r.status === 'paid');
        const pend = items.filter(r => r.status !== 'paid');
        const paidAmt = paid.reduce((s, r) => s + (parseFloat(r.value) || 0), 0);
        const pendAmt = pend.reduce((s, r) => s + (parseFloat(r.value) || 0), 0);
        const setEl = (id, val) => { const e = document.getElementById(id); if (e)
            e.textContent = val; };
        setEl('kpiTotal', fmt(total));
        setEl('kpiTotalCount', `${items.length} lançamento${items.length !== 1 ? 's' : ''}`);
        setEl('kpiPaid', fmt(paidAmt));
        setEl('kpiPaidCount', `${paid.length} lançamento${paid.length !== 1 ? 's' : ''}`);
        setEl('kpiPending', fmt(pendAmt));
        setEl('kpiPendingCount', `${pend.length} lançamento${pend.length !== 1 ? 's' : ''}`);
        const paidPct = total > 0 ? (paidAmt / total) * 100 : 0;
        const pendPct = total > 0 ? (pendAmt / total) * 100 : 0;
        const pb = document.getElementById('kpiPaidBar');
        const pendB = document.getElementById('kpiPendingBar');
        if (pb)
            pb.style.width = paidPct.toFixed(1) + '%';
        if (pendB)
            pendB.style.width = pendPct.toFixed(1) + '%';
    };
    document.addEventListener('DOMContentLoaded', () => {
        const btn2 = document.getElementById('btnCancelModal2');
        const btn1 = document.getElementById('btnCancelModal');
        if (btn2 && btn1)
            btn2.addEventListener('click', () => btn1.click());
    });
    function escapeHtml(str) {
        if (str === null || str === undefined)
            return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    const peopleCache = {};
    let g_previousDueDate = '';
    function checkAndPromptDueDateInterestChange() {
        const dueDateEl = document.getElementById('dueDate');
        if (!dueDateEl)
            return false;
        const newDate = dueDateEl.value;
        if (newDate && g_previousDueDate && newDate !== g_previousDueDate) {
            const fineInt = getCurrencyValue('fineInterestValue');
            if (fineInt > 0) {
                const formattedVal = fineInt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const shouldClear = window.confirm(`A data de vencimento foi alterada e este lançamento possui ${formattedVal} em juros/multa.\n\nDeseja APAGAR (zerar) os juros/multa ou MANTER o valor atual?\n\n[OK] = Apagar juros e multa\n[Cancelar] = Manter juros e multa`);
                if (shouldClear) {
                    setCurrencyValue('fineInterestValue', 0);
                    const rec = getCurrencyValue('receivableValue');
                    setCurrencyValue('value', rec);
                    recalculateNetValue();
                }
            }
            g_previousDueDate = newDate;
            return true;
        }
        g_previousDueDate = newDate;
        return false;
    }
    function updateDueDateBasedOnCardConfig() {
        const paymentEl = document.getElementById('paymentMethod');
        const cardConfigEl = document.getElementById('cardConfig');
        const dateLaunchEl = document.getElementById('dateLaunch');
        const dueDateEl = document.getElementById('dueDate');
        if (!paymentEl || !cardConfigEl || !dateLaunchEl || !dueDateEl)
            return;
        const method = paymentEl.value;
        if (method !== 'credit' && method !== 'debit')
            return;
        const dbMethod = method === 'credit' ? 'credito' : 'debito';
        let dueDays = 0;
        const selectedOption = cardConfigEl.options[cardConfigEl.selectedIndex];
        if (selectedOption && cardConfigEl.value) {
            dueDays = parseInt(selectedOption.getAttribute('data-due-days') || '0', 10);
        }
        else {
            const brandPublicId = document.getElementById('cardBrand')?.value || '';
            const list = window.cardConfigurationsData || cardConfigurationsData || [];
            const config = list.find((c) => c.card_brand_public_id === brandPublicId &&
                c.payment_type === dbMethod);
            if (config) {
                dueDays = parseInt(config.due_days || '0', 10);
            }
        }
        const dateLaunchVal = dateLaunchEl.value;
        if (!dateLaunchVal)
            return;
        const dateOnly = dateLaunchVal.split('T')[0];
        const parts = dateOnly.split('-');
        if (parts.length !== 3)
            return;
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        date.setDate(date.getDate() + dueDays);
        const newDueDate = DateUtils.toDateInputValue(date);
        if (dueDateEl.value !== newDueDate) {
            dueDateEl.value = newDueDate;
            g_previousDueDate = newDueDate;
        }
    }
    function recalculateNetValue() {
        const valueEl = document.getElementById('value');
        const netValueEl = document.getElementById('netValue');
        const paymentMethodEl = document.getElementById('paymentMethod');
        const cardBrandEl = document.getElementById('cardBrand');
        const cardConfigEl = document.getElementById('cardConfig');
        if (!valueEl || !netValueEl)
            return;
        const grossStr = valueEl.value.replace(/[^\d]/g, '');
        const grossVal = grossStr ? parseFloat(grossStr) / 100 : 0;
        let netVal = grossVal;
        const method = paymentMethodEl?.value || '';
        const brandPublicId = cardBrandEl?.value || '';
        const dbMethod = method === 'credit' ? 'credito' : (method === 'debit' ? 'debito' : method);
        if ((method === 'credit' || method === 'debit') && brandPublicId) {
            const selectedOption = cardConfigEl?.options[cardConfigEl.selectedIndex];
            if (selectedOption && cardConfigEl?.value) {
                const taxRate = parseFloat(selectedOption.getAttribute('data-tax-rate') || '0');
                const serviceFee = parseFloat(selectedOption.getAttribute('data-service-fee') || '0');
                netVal = grossVal - (grossVal * (taxRate / 100)) - serviceFee;
                if (netVal < 0)
                    netVal = 0;
            }
            else {
                const list = window.cardConfigurationsData || cardConfigurationsData || [];
                const config = list.find((c) => c.card_brand_public_id === brandPublicId &&
                    c.payment_type === dbMethod);
                if (config) {
                    const taxRate = parseFloat(config.tax_rate) || 0;
                    const serviceFee = parseFloat(config.service_fee) || 0;
                    netVal = grossVal - (grossVal * (taxRate / 100)) - serviceFee;
                    if (netVal < 0)
                        netVal = 0;
                }
            }
        }
        let formatted = netVal.toFixed(2);
        formatted = formatted.replace(".", ",");
        formatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        netValueEl.value = 'R$ ' + formatted;
        updateDueDateBasedOnCardConfig();
    }
    function updateCardConfigOptions() {
        const paymentEl = document.getElementById('paymentMethod');
        const cardBrandEl = document.getElementById('cardBrand');
        const cardConfigEl = document.getElementById('cardConfig');
        const cardConfigContainer = document.getElementById('cardConfigContainer');
        if (!paymentEl || !cardBrandEl || !cardConfigEl || !cardConfigContainer)
            return;
        const method = paymentEl.value;
        const dbMethod = method === 'credit' ? 'credito' : (method === 'debit' ? 'debito' : method);
        const brandPublicId = cardBrandEl.value;
        if ((method === 'credit' || method === 'debit') && brandPublicId) {
            const list = window.cardConfigurationsData || cardConfigurationsData || [];
            const matchingConfigs = list.filter((c) => c.card_brand_public_id === brandPublicId &&
                c.payment_type === dbMethod);
            if (matchingConfigs.length > 0) {
                cardConfigContainer.classList.remove('hidden');
                cardConfigEl.innerHTML = matchingConfigs.map((c) => {
                    const taxRateStr = parseFloat(c.tax_rate).toFixed(2).replace('.', ',');
                    const feeStr = parseFloat(c.service_fee).toFixed(2).replace('.', ',');
                    return `<option value="${c.public_id}" data-tax-rate="${c.tax_rate}" data-service-fee="${c.service_fee}" data-due-days="${c.due_days}">
                    Taxa: ${taxRateStr}% | Tarifa: R$ ${feeStr} | Prazo: ${c.due_days}d
                </option>`;
                }).join('');
            }
            else {
                cardConfigContainer.classList.add('hidden');
                cardConfigEl.innerHTML = '<option value="">Nenhuma configuração encontrada</option>';
            }
        }
        else {
            cardConfigContainer.classList.add('hidden');
            cardConfigEl.innerHTML = '<option value="">Selecione a bandeira primeiro...</option>';
        }
    }
    async function loadPeopleOfType(type) {
        if (peopleCache[type])
            return peopleCache[type];
        let items = [];
        try {
            if (type === 'customer') {
                const res = await api('/entities/customers');
                items = (res.data || []).map((x) => ({
                    public_id: x.public_id,
                    name: x.name,
                    customer_group_public_id: x.customer_group_public_id
                }));
            }
            else if (type === 'supplier') {
                const res = await api('/entities/suppliers');
                items = (res.data || []).map((x) => ({ public_id: x.public_id, name: x.name }));
            }
            else if (type === 'contact') {
                const res = await api('/entities/contacts');
                items = (res.data || []).map((x) => ({ public_id: x.public_id, name: x.name }));
            }
            else if (type === 'seller') {
                const res = await api('/sellers');
                items = (res.data || []).map((x) => ({ public_id: x.public_id, name: x.full_name }));
            }
            else if (['buyer', 'service_provider', 'accountant'].includes(type)) {
                const res = await api('/users');
                items = (res.data || [])
                    .filter((x) => x.role === type)
                    .map((x) => ({ public_id: x.public_id, name: x.full_name }));
            }
        }
        catch (e) {
            console.error(`Failed to load people of type ${type}`, e);
        }
        items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        peopleCache[type] = items;
        return items;
    }
    function handleEntityTypeChange(selectedEntityPublicId) {
        const type = document.getElementById('entityType')?.value || '';
        const entitySelect = document.getElementById('entitySelect');
        const customerGroupContainer = document.getElementById('customerGroupContainer');
        const customerGroupSelect = document.getElementById('customerGroupSelect');
        const entityGrid = document.getElementById('entityGrid');
        if (!entitySelect)
            return;
        entitySelect.innerHTML = '';
        if (!type) {
            entitySelect.disabled = true;
            entitySelect.innerHTML = '<option value="">Selecione o tipo primeiro...</option>';
            if (customerGroupContainer)
                customerGroupContainer.classList.add('hidden');
            if (customerGroupSelect)
                customerGroupSelect.value = '';
            if (entityGrid) {
                entityGrid.classList.remove('grid-cols-3');
                entityGrid.classList.add('grid-cols-2');
            }
            return;
        }
        if (type === 'customer') {
            if (customerGroupContainer)
                customerGroupContainer.classList.remove('hidden');
            if (entityGrid) {
                entityGrid.classList.remove('grid-cols-2');
                entityGrid.classList.add('grid-cols-3');
            }
            if (customerGroupSelect) {
                customerGroupSelect.innerHTML = '<option value="">Selecione o grupo...</option>' + customerGroupsData
                    .map((g) => `<option value="${escapeHtml(g.public_id)}">${escapeHtml(g.name)}</option>`)
                    .join('');
                customerGroupSelect.value = '';
            }
        }
        else {
            if (customerGroupContainer)
                customerGroupContainer.classList.add('hidden');
            if (customerGroupSelect)
                customerGroupSelect.value = '';
            if (entityGrid) {
                entityGrid.classList.remove('grid-cols-3');
                entityGrid.classList.add('grid-cols-2');
            }
        }
        entitySelect.disabled = false;
        entitySelect.innerHTML = '<option value="">Carregando...</option>';
        loadPeopleOfType(type).then((items) => {
            if (type === 'customer' && selectedEntityPublicId) {
                const cust = items.find((x) => x.public_id === selectedEntityPublicId);
                if (cust && cust.customer_group_public_id) {
                    if (customerGroupSelect) {
                        customerGroupSelect.value = cust.customer_group_public_id;
                    }
                }
            }
            const selectedGroup = customerGroupSelect?.value || '';
            let filteredItems = items;
            if (type === 'customer' && selectedGroup) {
                filteredItems = items.filter((x) => x.customer_group_public_id === selectedGroup);
            }
            entitySelect.innerHTML = '<option value="">Selecione...</option>' + filteredItems
                .map((x) => `<option value="${escapeHtml(x.public_id)}">${escapeHtml(x.name)}</option>`)
                .join('');
            if (selectedEntityPublicId) {
                entitySelect.value = selectedEntityPublicId;
            }
        });
    }
    function setCurrencyValue(inputId, numValue) {
        const el = document.getElementById(inputId);
        if (!el)
            return;
        let valStr = parseFloat(numValue || 0).toFixed(2);
        let digitsOnly = valStr.replace(/\D/g, '');
        let formatted = (parseInt(digitsOnly, 10) / 100).toFixed(2) + '';
        formatted = formatted.replace(".", ",");
        formatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        el.value = 'R$ ' + formatted;
    }
    function getCurrencyValue(inputId) {
        const el = document.getElementById(inputId);
        if (!el || !el.value)
            return 0;
        const digits = el.value.replace(/[^\d]/g, '');
        return digits ? parseFloat(digits) / 100 : 0;
    }
    function getNumberInputValue(inputId) {
        const value = Number(document.getElementById(inputId)?.value || 0);
        return Number.isFinite(value) && value > 0 ? value : 0;
    }
    function getCurrentDateTimeInputValue() {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    }
    function toMysqlDateTimeValue(value) {
        return value ? `${value.replace('T', ' ')}:00` : null;
    }
    function toDateTimeInputValue(value) {
        if (!value)
            return '';
        const date = new Date(value);
        if (isNaN(date.getTime()))
            return '';
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        return date.toISOString().slice(0, 16);
    }
    function updateViewToggle() {
        const btnList = document.getElementById('btnListView');
        const btnGrid = document.getElementById('btnGridView');
        const tableSection = document.getElementById('revenuesSection');
        const gridSection = document.getElementById('revenuesGridSection');
        const tablePagContainer = document.getElementById('revenuesPaginationContainer');
        const gridPagContainer = document.getElementById('revenuesGridPaginationContainer');
        if (btnList && btnGrid) {
            btnList.className = "flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1";
            btnGrid.className = "flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1";
            btnList.querySelector('.check-icon')?.classList.add('hidden');
            btnGrid.querySelector('.check-icon')?.classList.add('hidden');
            if (currentView === 'list') {
                btnList.className = "flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1";
                btnList.querySelector('.check-icon')?.classList.remove('hidden');
            }
            else {
                btnGrid.className = "flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1";
                btnGrid.querySelector('.check-icon')?.classList.remove('hidden');
            }
        }
        if (!tableSection || !gridSection)
            return;
        if (currentView === 'list') {
            tableSection.style.display = 'flex';
            tableSection.classList.remove('hidden');
            gridSection.style.display = 'none';
            gridSection.classList.add('hidden');
            if (tablePagContainer)
                tablePagContainer.classList.remove('hidden');
            if (gridPagContainer)
                gridPagContainer.classList.add('hidden');
        }
        else {
            tableSection.style.display = 'none';
            tableSection.classList.add('hidden');
            gridSection.style.display = 'flex';
            gridSection.classList.remove('hidden');
            if (tablePagContainer)
                tablePagContainer.classList.add('hidden');
            if (gridPagContainer)
                gridPagContainer.classList.remove('hidden');
        }
    }
    // ── Paginadores ─────────────────────────────────────────────
    let _tablePager = null;
    let _gridPager = null;
    document.addEventListener('DOMContentLoaded', async () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }
        document.title = 'KEYSTONE - Receitas';
        const receivableEl = document.getElementById('receivableValue');
        const fineInterestEl = document.getElementById('fineInterestValue');
        const valueEl = document.getElementById('value');
        const updateReceivedFromReceivableAndFine = () => {
            const rec = getCurrencyValue('receivableValue');
            const fineInt = getCurrencyValue('fineInterestValue');
            setCurrencyValue('value', rec + fineInt);
            recalculateNetValue();
        };
        if (receivableEl) {
            receivableEl.addEventListener('input', (e) => {
                let val = e.target.value.replace(/\D/g, '');
                if (val === "")
                    val = "0";
                let formatted = (parseInt(val, 10) / 100).toFixed(2) + '';
                formatted = formatted.replace(".", ",");
                formatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
                e.target.value = 'R$ ' + formatted;
                updateReceivedFromReceivableAndFine();
            });
        }
        if (fineInterestEl) {
            fineInterestEl.addEventListener('input', (e) => {
                let val = e.target.value.replace(/\D/g, '');
                if (val === "")
                    val = "0";
                let formatted = (parseInt(val, 10) / 100).toFixed(2) + '';
                formatted = formatted.replace(".", ",");
                formatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
                e.target.value = 'R$ ' + formatted;
                updateReceivedFromReceivableAndFine();
            });
        }
        const btnZeroRevenueFineInterest = document.getElementById('btnZeroRevenueFineInterest');
        if (btnZeroRevenueFineInterest) {
            btnZeroRevenueFineInterest.addEventListener('click', (e) => {
                e.preventDefault();
                setCurrencyValue('fineInterestValue', 0);
                updateReceivedFromReceivableAndFine();
            });
        }
        if (valueEl) {
            valueEl.addEventListener('input', (e) => {
                let val = e.target.value.replace(/\D/g, '');
                if (val === "")
                    val = "0";
                let formatted = (parseInt(val, 10) / 100).toFixed(2) + '';
                formatted = formatted.replace(".", ",");
                formatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
                e.target.value = 'R$ ' + formatted;
                recalculateNetValue();
            });
        }
        const cardBrandEl = document.getElementById('cardBrand');
        if (cardBrandEl) {
            cardBrandEl.addEventListener('change', () => {
                updateCardConfigOptions();
                recalculateNetValue();
            });
        }
        const cardConfigEl = document.getElementById('cardConfig');
        if (cardConfigEl) {
            cardConfigEl.addEventListener('change', () => {
                recalculateNetValue();
            });
        }
        const dateLaunchEl = document.getElementById('dateLaunch');
        if (dateLaunchEl) {
            dateLaunchEl.addEventListener('change', () => {
                recalculateNetValue();
            });
        }
        const dueDateEl = document.getElementById('dueDate');
        if (dueDateEl) {
            dueDateEl.addEventListener('change', () => {
                checkAndPromptDueDateInterestChange();
            });
        }
        // UI Bindings
        const btnOpenModal = document.getElementById('btnOpenModal');
        if (btnOpenModal)
            btnOpenModal.addEventListener('click', openModal);
        const btnCancelModal = document.getElementById('btnCancelModal');
        if (btnCancelModal)
            btnCancelModal.addEventListener('click', closeModal);
        const bankSelect = document.getElementById('bankSelect');
        if (bankSelect) {
            bankSelect.addEventListener('change', () => {
                updatePaymentMethodOptions();
            });
        }
        const paymentMethodEl = document.getElementById('paymentMethod');
        const statusSelect = document.getElementById('status');
        const receivedAtContainer = document.getElementById('receivedAtContainer');
        const receivedChannelContainer = document.getElementById('receivedChannelContainer');
        function updateReceivedFieldsVisibility() {
            const isPaid = statusSelect?.value === 'paid';
            const isBoleto = paymentMethodEl?.value === 'boleto';
            if (isPaid) {
                receivedAtContainer?.classList.remove('hidden');
                const receivedAtEl = document.getElementById('receivedAt');
                if (receivedAtEl && !receivedAtEl.value) {
                    receivedAtEl.value = getCurrentDateTimeInputValue();
                }
            }
            else {
                receivedAtContainer?.classList.add('hidden');
            }
            if (isPaid && isBoleto) {
                receivedChannelContainer?.classList.remove('hidden');
            }
            else {
                receivedChannelContainer?.classList.add('hidden');
            }
        }
        if (paymentMethodEl) {
            paymentMethodEl.addEventListener('change', () => {
                const container = document.getElementById('cardBrandContainer');
                if (container) {
                    if (paymentMethodEl.value === 'credit' || paymentMethodEl.value === 'debit') {
                        container.classList.remove('hidden');
                        updateCardBrandOptions();
                        updateCardConfigOptions();
                    }
                    else {
                        container.classList.add('hidden');
                        const cbSelect = document.getElementById('cardBrand');
                        if (cbSelect)
                            cbSelect.value = '';
                        updateCardConfigOptions();
                    }
                }
                const currentRev = g_editId ? revenuesData.find(r => r.public_id === g_editId) : null;
                const hasBoleto = currentRev && (!!currentRev.billet_url || !!currentRev.barcode);
                const cancelBilletContainer = document.getElementById('revenueCancelBilletContainer');
                const cancelBilletCheckbox = document.getElementById('revenueCancelBilletCheckbox');
                if (cancelBilletContainer) {
                    if (hasBoleto && paymentMethodEl.value !== 'boleto') {
                        cancelBilletContainer.classList.remove('hidden');
                        if (cancelBilletCheckbox)
                            cancelBilletCheckbox.checked = true;
                    }
                    else {
                        cancelBilletContainer.classList.add('hidden');
                        if (cancelBilletCheckbox)
                            cancelBilletCheckbox.checked = false;
                    }
                }
                updateReceivedFieldsVisibility();
                recalculateNetValue();
            });
        }
        // Whatsapp Modal Bindings
        const btnCancelWhatsappModal = document.getElementById('btnCancelWhatsappModal');
        if (btnCancelWhatsappModal)
            btnCancelWhatsappModal.addEventListener('click', closeWhatsappModal);
        const whatsappModalBackdrop = document.getElementById('whatsappModalBackdrop');
        if (whatsappModalBackdrop)
            whatsappModalBackdrop.addEventListener('click', closeWhatsappModal);
        const btnConfirmWhatsappSend = document.getElementById('btnConfirmWhatsappSend');
        if (btnConfirmWhatsappSend)
            btnConfirmWhatsappSend.addEventListener('click', handleSendWhatsapp);
        const revenueForm = document.getElementById('revenueForm');
        if (revenueForm)
            revenueForm.addEventListener('submit', handleSaveRevenue);
        if (statusSelect) {
            statusSelect.addEventListener('change', () => {
                updateReceivedFieldsVisibility();
            });
        }
        // Solidcon Modal Bindings
        const openSolidconModal = () => {
            document.getElementById('solidconModal')?.classList.remove('hidden');
            const startEl = document.getElementById('solidconStartDate');
            const endEl = document.getElementById('solidconEndDate');
            if (startEl && !startEl.value) {
                const now = new Date();
                const tzOffset = now.getTimezoneOffset() * 60000;
                const firstDay = new Date(new Date(now.getFullYear(), now.getMonth(), 1).getTime() - tzOffset).toISOString().split('T')[0];
                startEl.value = firstDay || '';
            }
            if (endEl && !endEl.value) {
                const now = new Date();
                const tzOffset = now.getTimezoneOffset() * 60000;
                const lastDay = new Date(new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime() - tzOffset).toISOString().split('T')[0];
                endEl.value = lastDay || '';
            }
        };
        let solidconFetchedPayload = null;
        const closeSolidconModal = () => {
            document.getElementById('solidconModal')?.classList.add('hidden');
            clearSolidconStatus();
            solidconFetchedPayload = null;
        };
        const btnSyncAll = document.getElementById('btnSyncAll');
        if (btnSyncAll) {
            btnSyncAll.addEventListener('click', async () => {
                const syncIcon = document.getElementById('syncAllIcon');
                const syncText = document.getElementById('syncAllText');
                btnSyncAll.disabled = true;
                if (syncIcon)
                    syncIcon.classList.add('animate-spin');
                if (syncText)
                    syncText.textContent = 'Sincronizando...';
                UI.showAlert('alertMessage', 'Sincronizando todo o sistema com banco de dados, Solidcon e Keystone...', 'info');
                try {
                    const startDate = document.getElementById('filterStartDate')?.value || undefined;
                    const endDate = document.getElementById('filterEndDate')?.value || undefined;
                    const response = await api('/finance/revenues/sync-all', {
                        method: 'POST',
                        body: JSON.stringify({ startDate, endDate })
                    });
                    const msg = response?.message || response?.data?.message || 'Sistema sincronizado com sucesso!';
                    UI.showAlert('alertMessage', msg, 'success');
                    // Recarrega as receitas e atualiza os saldos
                    await fetchRevenues();
                    await loadDependencies(true);
                }
                catch (err) {
                    console.error('Erro na sincronização geral:', err);
                    UI.showAlert('alertMessage', err?.message || 'Erro ao sincronizar o sistema com Solidcon e Keystone.', 'error');
                }
                finally {
                    btnSyncAll.disabled = false;
                    if (syncIcon)
                        syncIcon.classList.remove('animate-spin');
                    if (syncText)
                        syncText.textContent = 'Sincronizar Todos';
                }
            });
        }
        const btnOpenSolidconModal = document.getElementById('btnOpenSolidconModal');
        if (btnOpenSolidconModal)
            btnOpenSolidconModal.addEventListener('click', openSolidconModal);
        const btnCloseSolidconModal = document.getElementById('btnCloseSolidconModal');
        if (btnCloseSolidconModal)
            btnCloseSolidconModal.addEventListener('click', closeSolidconModal);
        const btnCancelSolidconModal = document.getElementById('btnCancelSolidconModal');
        if (btnCancelSolidconModal)
            btnCancelSolidconModal.addEventListener('click', closeSolidconModal);
        const solidconModalBackdrop = document.getElementById('solidconModalBackdrop');
        if (solidconModalBackdrop) {
            solidconModalBackdrop.addEventListener('click', (e) => {
                if (e.target === solidconModalBackdrop)
                    closeSolidconModal();
            });
        }
        const solidconImportStatus = document.getElementById('solidconImportStatus');
        const solidconImportDetails = document.getElementById('solidconImportDetails');
        const clearSolidconStatus = () => {
            if (solidconImportStatus) {
                solidconImportStatus.className = 'hidden mt-3 text-sm rounded-md px-3 py-2';
                solidconImportStatus.innerHTML = '';
            }
            if (solidconImportDetails) {
                solidconImportDetails.className = 'hidden mt-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-100';
                solidconImportDetails.innerHTML = '';
            }
        };
        const setSolidconStatus = (message, type) => {
            if (!solidconImportStatus)
                return;
            clearSolidconStatus();
            let bgClass = '';
            if (type === 'success')
                bgClass = 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/30';
            else if (type === 'error')
                bgClass = 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/30';
            else
                bgClass = 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/30';
            solidconImportStatus.className = `mt-3 text-sm rounded-md px-3 py-2 ${bgClass}`;
            solidconImportStatus.textContent = message;
        };
        const showSolidconIgnoredDetails = (errors) => {
            if (!solidconImportDetails || !errors || !errors.length)
                return;
            const reasonCounts = errors.reduce((acc, item) => {
                const reason = item?.reason || 'Motivo nao informado.';
                acc[reason] = (acc[reason] || 0) + 1;
                return acc;
            }, {});
            const reasonSummary = Object.entries(reasonCounts)
                .map(([reason, count]) => `${count}x ${reason}`)
                .join('<br>');
            const examples = errors.slice(0, 20)
                .map((item) => `Item #${Number(item?.index || 0) + 1}: ${item?.reason || 'Motivo nao informado.'}`)
                .join('<br>');
            solidconImportDetails.innerHTML = `<div class="font-semibold">Por que foi ignorado</div><div class="mt-1">${reasonSummary}</div><div class="mt-2 font-semibold">Exemplos</div><div class="mt-1">${examples}${errors.length > 20 ? `<br>... mais ${errors.length - 20} item(ns)` : ''}</div>`;
            solidconImportDetails.classList.remove('hidden');
        };
        const getSelectedSolidconUrl = () => {
            const urls = window.currentSolidconUrls || [];
            return urls.find((url) => String(url || '').trim()) || '';
        };
        const btnFetchSolidconJson = document.getElementById('btnFetchSolidconJson');
        if (btnFetchSolidconJson) {
            btnFetchSolidconJson.addEventListener('click', async () => {
                clearSolidconStatus();
                const connectionType = document.getElementById('solidconConnectionType')?.value || 'api';
                const startVal = document.getElementById('solidconStartDate')?.value;
                const endVal = document.getElementById('solidconEndDate')?.value;
                if (!startVal || !endVal) {
                    setSolidconStatus('Preencha as datas Inicial e Final.', 'warning');
                    return;
                }
                btnFetchSolidconJson.disabled = true;
                const originalHtml = btnFetchSolidconJson.innerHTML;
                btnFetchSolidconJson.textContent = 'Consultando...';
                const reqBody = { connectionType, startDate: startVal, endDate: endVal };
                if (connectionType === 'api') {
                    const url = getSelectedSolidconUrl();
                    if (!url) {
                        setSolidconStatus('URL Solidcon nao configurada. Salve na tela Minha Empresa > API/Solidcon.', 'warning');
                        btnFetchSolidconJson.innerHTML = originalHtml;
                        btnFetchSolidconJson.disabled = false;
                        return;
                    }
                    let fullUrl = url;
                    try {
                        const urlObj = new URL(url);
                        urlObj.searchParams.set('dataInicial', startVal);
                        urlObj.searchParams.set('dataFinal', endVal);
                        fullUrl = urlObj.toString();
                    }
                    catch {
                        const separator = url.includes('?') ? '&' : '?';
                        fullUrl = `${url}${separator}dataInicial=${startVal}&dataFinal=${endVal}`;
                    }
                    reqBody.url = fullUrl;
                }
                try {
                    const response = await api('/companies/proxy-consulta', {
                        method: 'POST',
                        body: JSON.stringify(reqBody)
                    });
                    const payload = response?.data ?? response;
                    solidconFetchedPayload = payload;
                    const items = Array.isArray(payload) ? payload : (payload?.data || payload?.items || payload?.rows || []);
                    const count = Array.isArray(items) ? items.length : 0;
                    setSolidconStatus(`Dados carregados com sucesso (${count} registros). Clique em "Importar" para salvar.`, 'success');
                }
                catch (err) {
                    const msg = String(err?.message || '').trim();
                    if (msg.toLowerCase().includes('fora') ||
                        msg.toLowerCase().includes('timeout') ||
                        msg.toLowerCase().includes('failed to connect') ||
                        msg.toLowerCase().includes('inacessivel') ||
                        msg.toLowerCase().includes('inacessível') ||
                        msg.toLowerCase().includes('conexão') ||
                        msg.toLowerCase().includes('conexao') ||
                        msg.toLowerCase().includes('refused') ||
                        msg.toLowerCase().includes('network') ||
                        msg.toLowerCase().includes('fetch failed')) {
                        setSolidconStatus(msg || 'Não foi possível conectar ao banco de dados Solidcon. O servidor está fora do ar ou inacessível no momento.', 'error');
                    }
                    else {
                        setSolidconStatus(msg || 'Não foi possível conectar ao banco de dados Solidcon. O servidor está fora do ar.', 'error');
                    }
                }
                finally {
                    btnFetchSolidconJson.innerHTML = originalHtml;
                    btnFetchSolidconJson.disabled = false;
                }
            });
        }
        const solidconImportForm = document.getElementById('solidconImportForm');
        if (solidconImportForm) {
            solidconImportForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                clearSolidconStatus();
                if (!solidconFetchedPayload) {
                    setSolidconStatus('Nenhum dado carregado. Por favor, clique em "Consulta" antes de importar.', 'warning');
                    return;
                }
                const submitBtn = document.getElementById('btnExecuteSolidconImport');
                const cancelBtn = document.getElementById('btnCancelSolidconModal');
                const closeBtn = document.getElementById('btnCloseSolidconModal');
                if (submitBtn)
                    submitBtn.disabled = true;
                if (cancelBtn)
                    cancelBtn.disabled = true;
                if (closeBtn)
                    closeBtn.disabled = true;
                const originalBtnText = submitBtn ? submitBtn.textContent : 'Importar';
                if (submitBtn)
                    submitBtn.textContent = 'Importando...';
                try {
                    const updateOnlyPdvEl = document.getElementById('solidconUpdateOnlyPdv');
                    const updateOnlyPdv = updateOnlyPdvEl ? updateOnlyPdvEl.checked : false;
                    const result = await api('/finance/revenues/solidcon-import', {
                        method: 'POST',
                        body: JSON.stringify({
                            payload: solidconFetchedPayload,
                            update_only_pdv: updateOnlyPdv
                        })
                    });
                    const data = result?.data || {};
                    const created = data.created ?? 0;
                    const updated = data.updated ?? 0;
                    const skipped = data.skipped ?? 0;
                    const errors = Array.isArray(data.errors) ? data.errors : [];
                    const message = `Importacao concluida: ${created} novas, ${updated} atualizadas, ${skipped} ignoradas.`;
                    setSolidconStatus(message, created || updated ? 'success' : 'warning');
                    showSolidconIgnoredDetails(errors);
                    // Refresh the listing
                    await fetchRevenues();
                }
                catch (err) {
                    setSolidconStatus(err.message || 'Erro ao importar receitas da Solidcon.', 'error');
                }
                finally {
                    if (submitBtn) {
                        submitBtn.textContent = originalBtnText;
                        submitBtn.disabled = false;
                    }
                    if (cancelBtn)
                        cancelBtn.disabled = false;
                    if (closeBtn)
                        closeBtn.disabled = false;
                }
            });
        }
        document.getElementById('baixaModalBackdrop')?.addEventListener('click', window.closeBaixaModal);
        document.getElementById('btnCancelBaixaModal')?.addEventListener('click', window.closeBaixaModal);
        document.getElementById('deleteModalBackdrop')?.addEventListener('click', window.closeDeleteModal);
        document.getElementById('btnCancelDeleteModal')?.addEventListener('click', window.closeDeleteModal);
        document.getElementById('bulkUpdateModalBackdrop')?.addEventListener('click', window.closeBulkUpdateModal);
        document.getElementById('btnCancelBulkUpdateModal')?.addEventListener('click', window.closeBulkUpdateModal);
        document.getElementById('baixaFine')?.addEventListener('input', updateBaixaTotal);
        document.getElementById('baixaInterest')?.addEventListener('input', updateBaixaTotal);
        document.getElementById('baixaDate')?.addEventListener('input', () => {
            if (!g_baixaId)
                return;
            const rev = revenuesData.find(r => r.public_id === g_baixaId);
            if (!rev || isRevenuePaid(rev))
                return;
            const baixaDateTime = document.getElementById('baixaDate')?.value;
            const calc = calculateRevenueFineAndInterest(rev, baixaDateTime);
            const fineEl = document.getElementById('baixaFine');
            const interestEl = document.getElementById('baixaInterest');
            if (fineEl)
                fineEl.value = String(calc.fine > 0 ? Number(calc.fine.toFixed(2)) : 0);
            if (interestEl)
                interestEl.value = String(calc.interest > 0 ? Number(calc.interest.toFixed(2)) : 0);
            updateBaixaTotal();
        });
        document.getElementById('btnZeroFineInterest')?.addEventListener('click', () => {
            const fineEl = document.getElementById('baixaFine');
            const interestEl = document.getElementById('baixaInterest');
            if (fineEl)
                fineEl.value = '0';
            if (interestEl)
                interestEl.value = '0';
            updateBaixaTotal();
        });
        document.getElementById('baixaPaymentMethod')?.addEventListener('change', (e) => {
            const target = e.target;
            const baixaChannelContainer = document.getElementById('baixaChannelContainer');
            const baixaCancelBilletContainer = document.getElementById('baixaCancelBilletContainer');
            const baixaCancelBilletCheckbox = document.getElementById('baixaCancelBilletCheckbox');
            const rev = g_baixaId ? revenuesData.find(r => r.public_id === g_baixaId) : null;
            const hasBoleto = rev && (!!rev.billet_url || !!rev.barcode);
            if (target.value === 'boleto') {
                if (baixaChannelContainer)
                    baixaChannelContainer.classList.remove('hidden');
                if (baixaCancelBilletContainer)
                    baixaCancelBilletContainer.classList.add('hidden');
                if (baixaCancelBilletCheckbox)
                    baixaCancelBilletCheckbox.checked = false;
            }
            else {
                if (baixaChannelContainer)
                    baixaChannelContainer.classList.add('hidden');
                if (hasBoleto) {
                    if (baixaCancelBilletContainer)
                        baixaCancelBilletContainer.classList.remove('hidden');
                    if (baixaCancelBilletCheckbox)
                        baixaCancelBilletCheckbox.checked = true;
                }
                else {
                    if (baixaCancelBilletContainer)
                        baixaCancelBilletContainer.classList.add('hidden');
                    if (baixaCancelBilletCheckbox)
                        baixaCancelBilletCheckbox.checked = false;
                }
            }
        });
        const entityTypeSelect = document.getElementById('entityType');
        if (entityTypeSelect) {
            entityTypeSelect.addEventListener('change', () => handleEntityTypeChange());
        }
        document.getElementById('customerGroupSelect')?.addEventListener('change', () => {
            const type = document.getElementById('entityType')?.value || '';
            const entitySelect = document.getElementById('entitySelect');
            const selectedGroup = document.getElementById('customerGroupSelect')?.value || '';
            if (!entitySelect)
                return;
            const cached = peopleCache[type] || [];
            let filtered = cached;
            if (type === 'customer' && selectedGroup) {
                filtered = cached.filter((x) => x.customer_group_public_id === selectedGroup);
            }
            entitySelect.innerHTML = '<option value="">Selecione...</option>' + filtered
                .map((x) => `<option value="${x.public_id}">${x.name}</option>`)
                .join('');
        });
        // Removed legacy entitySearch event listener.
        const btnListView = document.getElementById('btnListView');
        if (btnListView) {
            btnListView.addEventListener('click', () => {
                currentView = 'list';
                if (window.CompanyStorage) {
                    window.CompanyStorage.setItem('revenuesView', 'list');
                }
                else {
                    localStorage.setItem('revenuesView', 'list');
                }
                clearCheckboxSelection();
                updateViewToggle();
            });
        }
        const btnGridView = document.getElementById('btnGridView');
        if (btnGridView) {
            btnGridView.addEventListener('click', () => {
                currentView = 'grid';
                if (window.CompanyStorage) {
                    window.CompanyStorage.setItem('revenuesView', 'grid');
                }
                else {
                    localStorage.setItem('revenuesView', 'grid');
                }
                clearCheckboxSelection();
                updateViewToggle();
            });
        }
        const btnBatchGenerateBillet = document.getElementById('btnBatchGenerateBillet');
        if (btnBatchGenerateBillet) {
            btnBatchGenerateBillet.addEventListener('click', handleBatchGenerateBillet);
        }
        const btnBatchCancelBillet = document.getElementById('btnBatchCancelBillet');
        if (btnBatchCancelBillet) {
            btnBatchCancelBillet.addEventListener('click', handleBatchCancelBillet);
        }
        const btnBatchDeleteRevenue = document.getElementById('btnBatchDeleteRevenue');
        if (btnBatchDeleteRevenue) {
            btnBatchDeleteRevenue.addEventListener('click', handleBatchDeleteRevenue);
        }
        const btnBatchBaixaRevenue = document.getElementById('btnBatchBaixaRevenue');
        if (btnBatchBaixaRevenue) {
            btnBatchBaixaRevenue.addEventListener('click', handleBatchBaixaRevenue);
        }
        const btnBatchUpdateRevenue = document.getElementById('btnBatchUpdateRevenue');
        if (btnBatchUpdateRevenue) {
            btnBatchUpdateRevenue.addEventListener('click', handleBatchUpdateRevenue);
        }
        const btnBatchSendWhatsapp = document.getElementById('btnBatchSendWhatsapp');
        if (btnBatchSendWhatsapp) {
            btnBatchSendWhatsapp.addEventListener('click', handleBatchSendWhatsapp);
        }
        const btnBatchSendWhatsappModal = document.getElementById('btnBatchSendWhatsappModal');
        if (btnBatchSendWhatsappModal) {
            btnBatchSendWhatsappModal.addEventListener('click', handleBatchSendWhatsapp);
        }
        const btnBatchDuplicateRevenue = document.getElementById('btnBatchDuplicateRevenue');
        if (btnBatchDuplicateRevenue) {
            btnBatchDuplicateRevenue.addEventListener('click', handleBatchDuplicateRevenue);
        }
        const btnBatchDownloadBilletsZip = document.getElementById('btnBatchDownloadBilletsZip');
        if (btnBatchDownloadBilletsZip) {
            btnBatchDownloadBilletsZip.addEventListener('click', handleBatchDownloadBilletsZip);
        }
        const btnBatchDownloadSolidconConvenio = document.getElementById('btnBatchDownloadSolidconConvenio');
        if (btnBatchDownloadSolidconConvenio) {
            btnBatchDownloadSolidconConvenio.addEventListener('click', handleSyncSolidconBaixas);
        }
        const btnBatchCleanDuplicateSolidconBaixas = document.getElementById('btnBatchCleanDuplicateSolidconBaixas');
        if (btnBatchCleanDuplicateSolidconBaixas) {
            btnBatchCleanDuplicateSolidconBaixas.addEventListener('click', handleCleanDuplicateSolidconBaixas);
        }
        const btnBatchSyncPayments = document.getElementById('btnBatchSyncPayments');
        if (btnBatchSyncPayments) {
            btnBatchSyncPayments.addEventListener('click', handleBatchSyncPayments);
        }
        // Filter toggle (collapse/expand)
        const toggleFilterBtn = document.getElementById('toggleFilterBtn');
        const filterBody = document.getElementById('filterBody');
        const filterChevron = document.getElementById('filterChevron');
        const FILTER_STORAGE_KEY = 'revenues_filter_open';
        let filterIsOpen = (window.CompanyStorage?.getItem(FILTER_STORAGE_KEY) ?? localStorage.getItem(FILTER_STORAGE_KEY)) === 'true';
        if (filterBody && filterChevron) {
            // Apply saved state immediately (before any transition)
            if (!filterIsOpen) {
                filterBody.style.transition = 'none';
                filterBody.style.maxHeight = '0px';
                filterBody.style.overflow = 'hidden';
                filterChevron.style.transform = 'rotate(-90deg)';
                // Re-enable transition after forced layout
                requestAnimationFrame(() => {
                    filterBody.style.transition = '';
                });
            }
            else {
                filterBody.style.transition = 'none';
                filterBody.style.maxHeight = 'none';
                filterBody.style.overflow = 'visible';
                filterChevron.style.transform = 'rotate(0deg)';
                requestAnimationFrame(() => {
                    filterBody.style.transition = '';
                });
            }
            if (toggleFilterBtn) {
                toggleFilterBtn.addEventListener('click', () => {
                    filterIsOpen = !filterIsOpen;
                    if (window.CompanyStorage) {
                        window.CompanyStorage.setItem(FILTER_STORAGE_KEY, String(filterIsOpen));
                    }
                    else {
                        localStorage.setItem(FILTER_STORAGE_KEY, String(filterIsOpen));
                    }
                    if (filterIsOpen) {
                        filterBody.style.overflow = 'hidden';
                        filterBody.style.maxHeight = filterBody.scrollHeight + 'px';
                        filterChevron.style.transform = 'rotate(0deg)';
                        setTimeout(() => {
                            if (filterIsOpen) {
                                filterBody.style.maxHeight = 'none';
                                filterBody.style.overflow = 'visible';
                            }
                        }, 300);
                    }
                    else {
                        filterBody.style.maxHeight = filterBody.scrollHeight + 'px';
                        filterBody.style.overflow = 'hidden';
                        void filterBody.offsetHeight;
                        filterBody.style.maxHeight = '0px';
                        filterChevron.style.transform = 'rotate(-90deg)';
                    }
                });
            }
        }
        // Filter bindings
        const filterSelectors = ['filterPeriod', 'filterStartDate', 'filterEndDate', 'filterPaymentMethod', 'filterStatus', 'filterFineInterest', 'filterBank', 'filterCustomerGroup', 'filterWhatsappStatus', 'filterSortBy', 'filterPaginationMode', 'filterDescription'];
        // Load and populate saved filter values
        filterSelectors.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const savedValue = window.CompanyStorage?.getItem(`revenues_filter_${id}`) ?? localStorage.getItem(`revenues_filter_${id}`);
                if (savedValue !== null && savedValue !== undefined) {
                    el.value = savedValue;
                }
            }
        });
        const formatLocalDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        const updateDatesFromPeriod = () => {
            const periodEl = document.getElementById('filterPeriod');
            const startEl = document.getElementById('filterStartDate');
            const endEl = document.getElementById('filterEndDate');
            if (!periodEl || !startEl || !endEl)
                return false;
            const period = periodEl.value;
            if (period === 'custom')
                return false;
            let startVal = '';
            let endVal = '';
            const now = new Date();
            if (period === 'today') {
                const todayStr = formatLocalDate(now);
                startVal = todayStr;
                endVal = todayStr;
            }
            else if (period === 'yesterday') {
                const yesterday = new Date(now);
                yesterday.setDate(now.getDate() - 1);
                const yesterdayStr = formatLocalDate(yesterday);
                startVal = yesterdayStr;
                endVal = yesterdayStr;
            }
            else if (period === 'this_month') {
                const start = new Date(now.getFullYear(), now.getMonth(), 1);
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                startVal = formatLocalDate(start);
                endVal = formatLocalDate(end);
            }
            else if (period === 'last_month') {
                const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const end = new Date(now.getFullYear(), now.getMonth(), 0);
                startVal = formatLocalDate(start);
                endVal = formatLocalDate(end);
            }
            else if (period === 'this_year') {
                const start = new Date(now.getFullYear(), 0, 1);
                const end = new Date(now.getFullYear(), 11, 31);
                startVal = formatLocalDate(start);
                endVal = formatLocalDate(end);
            }
            let changed = false;
            if (startEl.value !== startVal) {
                startEl.value = startVal;
                changed = true;
            }
            if (endEl.value !== endVal) {
                endEl.value = endVal;
                changed = true;
            }
            return changed;
        };
        // Apply period relative calculations on load
        updateDatesFromPeriod();
        const periodEl = document.getElementById('filterPeriod');
        const startEl = document.getElementById('filterStartDate');
        const endEl = document.getElementById('filterEndDate');
        if (periodEl) {
            periodEl.addEventListener('change', () => {
                updateDatesFromPeriod();
                applyFilters();
            });
        }
        if (startEl) {
            startEl.addEventListener('change', () => {
                if (periodEl && periodEl.value !== 'custom') {
                    periodEl.value = 'custom';
                    if (window.CompanyStorage) {
                        window.CompanyStorage.setItem('revenues_filter_filterPeriod', 'custom');
                    }
                    else {
                        localStorage.setItem('revenues_filter_filterPeriod', 'custom');
                    }
                }
            });
        }
        if (endEl) {
            endEl.addEventListener('change', () => {
                if (periodEl && periodEl.value !== 'custom') {
                    periodEl.value = 'custom';
                    if (window.CompanyStorage) {
                        window.CompanyStorage.setItem('revenues_filter_filterPeriod', 'custom');
                    }
                    else {
                        localStorage.setItem('revenues_filter_filterPeriod', 'custom');
                    }
                }
            });
        }
        filterSelectors.forEach(id => {
            if (id === 'filterPeriod')
                return; // Handled separately
            const el = document.getElementById(id);
            if (el)
                el.addEventListener('change', applyFilters);
        });
        const descEl = document.getElementById('filterDescription');
        if (descEl) {
            descEl.addEventListener('input', applyFilters);
        }
        const btnClearFilters = document.getElementById('btnClearFilters');
        if (btnClearFilters) {
            btnClearFilters.addEventListener('click', () => {
                filterSelectors.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        if (id === 'filterSortBy') {
                            el.value = 'date_desc';
                        }
                        else if (id === 'filterPaginationMode') {
                            el.value = 'paginated_20';
                        }
                        else {
                            el.value = '';
                        }
                    }
                });
                applyFilters();
            });
        }
        initColumnVisibility();
        updateViewToggle();
        await Promise.all([
            loadDependencies(),
            fetchRevenues()
        ]);
    });
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    const paymentLabels = {
        cash: 'Dinheiro',
        pix: 'PIX',
        credit: 'Cartao de Credito',
        debit: 'Cartao de Debito',
        transfer: 'Transferencia Bancaria',
        boleto: 'Boleto'
    };
    const getPaymentLabel = (method) => paymentLabels[method] || 'Nao informado';
    function renderPaymentMethodLabel(method, brandName, batchGenerated, billetUrl, pixCode, isPaid, receivedChannel) {
        let label = getPaymentLabel(method);
        if (brandName && (method === 'credit' || method === 'debit')) {
            label += ` - ${brandName}`;
        }
        if (method === 'boleto' && batchGenerated) {
            label += ` (Lote)`;
        }
        const safeLabel = escapeHtml(label);
        const isBoletoNotGenerated = (method === 'boleto' && !billetUrl && !isPaid);
        const isPixNotGenerated = (method === 'pix' && !pixCode && !isPaid);
        if (isBoletoNotGenerated || isPixNotGenerated) {
            return `<span class="inline-flex items-center rounded bg-red-100 dark:bg-red-950/40 px-1.5 py-0.5 text-[11px] font-medium text-red-800 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-800/60">${safeLabel}</span>`;
        }
        if (method === 'boleto' && isPaid) {
            if (receivedChannel === 'pix_qr') {
                return `<span class="inline-flex items-center gap-1 rounded bg-teal-100 dark:bg-teal-950/40 px-1.5 py-0.5 text-[11px] font-medium text-teal-800 dark:text-teal-300 ring-1 ring-teal-300 dark:ring-teal-700/60" title="Boleto recebido via QR-Code Pix"><svg class="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg>Boleto (Pix)</span>`;
            }
            if (receivedChannel === 'barcode') {
                return `<span class="inline-flex items-center gap-1 rounded bg-blue-100 dark:bg-blue-950/40 px-1.5 py-0.5 text-[11px] font-medium text-blue-800 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-700/60" title="Boleto recebido via Código de Barras"><svg class="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>Boleto (Cód. Barras)</span>`;
            }
        }
        return `<span class="inline-flex items-center rounded bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">${safeLabel}</span>`;
    }
    function getRevenueStatus(row) {
        if (row.status !== 'paid' && row.sale_id && row.sale_status === 'progress')
            return 'progress';
        return row.status;
    }
    function isRevenuePaid(row) {
        return getRevenueStatus(row) === 'paid';
    }
    function getEasterSunday(year) {
        if (!year || isNaN(year) || year < 1900 || year > 2100)
            return new Date(2000, 0, 1);
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31);
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(year, month - 1, day);
    }
    const g_brazilianHolidaysCache = new Map();
    function getBrazilianHolidays(year) {
        if (!year || isNaN(year) || year < 1900 || year > 2100)
            return new Set();
        if (g_brazilianHolidaysCache.has(year)) {
            return g_brazilianHolidaysCache.get(year);
        }
        const holidays = new Set();
        const fixedHolidays = [
            '01-01', // Ano Novo
            '04-21', // Tiradentes
            '05-01', // Dia do Trabalho
            '09-07', // Independência do Brasil
            '10-12', // Nossa Senhora Aparecida
            '11-02', // Finados
            '11-15', // Proclamação da República
            '11-20', // Dia da Consciência Negra (Lei 14.759/2023)
            '12-25', // Natal
            '12-31' // Feriado Bancário (Febraban)
        ];
        for (const f of fixedHolidays) {
            holidays.add(`${year}-${f}`);
        }
        const easter = getEasterSunday(year);
        if (easter && !isNaN(easter.getTime())) {
            const addDays = (base, days) => {
                const res = new Date(base.getTime());
                res.setDate(res.getDate() + days);
                return res;
            };
            const formatKey = (d) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            };
            holidays.add(formatKey(addDays(easter, -48))); // Carnaval Segunda
            holidays.add(formatKey(addDays(easter, -47))); // Carnaval Terça
            holidays.add(formatKey(addDays(easter, -2))); // Sexta-feira Santa
            holidays.add(formatKey(easter)); // Páscoa
            holidays.add(formatKey(addDays(easter, 60))); // Corpus Christi
        }
        g_brazilianHolidaysCache.set(year, holidays);
        return holidays;
    }
    function isNationalHoliday(date) {
        if (!date || !(date instanceof Date) || isNaN(date.getTime()))
            return false;
        const year = date.getFullYear();
        if (!year || isNaN(year) || year < 1900 || year > 2100)
            return false;
        const holidays = getBrazilianHolidays(year);
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return holidays.has(`${year}-${m}-${d}`);
    }
    function isNonWorkingDay(date) {
        if (!date || !(date instanceof Date) || isNaN(date.getTime()))
            return false;
        const dayOfWeek = date.getDay(); // 0 = Domingo, 6 = Sábado
        if (dayOfWeek === 0 || dayOfWeek === 6)
            return true;
        return isNationalHoliday(date);
    }
    function parseDateStringToYMD(dateVal) {
        if (!dateVal)
            return null;
        let str = '';
        if (typeof dateVal === 'string') {
            str = dateVal.trim().slice(0, 10);
        }
        else if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
            const y = dateVal.getFullYear();
            const m = String(dateVal.getMonth() + 1).padStart(2, '0');
            const d = String(dateVal.getDate()).padStart(2, '0');
            str = `${y}-${m}-${d}`;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(str))
            return null;
        const [year, month, day] = str.split('-').map(Number);
        if (!year || !month || !day || year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31)
            return null;
        return { year, month, day };
    }
    function getEffectiveDueDate(dateVal) {
        const ymd = parseDateStringToYMD(dateVal);
        if (!ymd)
            return null;
        const dueDate = new Date(ymd.year, ymd.month - 1, ymd.day);
        if (isNaN(dueDate.getTime()))
            return null;
        dueDate.setHours(0, 0, 0, 0);
        // Prorroga dia a dia enquanto for sábado, domingo ou feriado nacional/bancário (máx 30 iterações para proteção)
        let loopGuard = 0;
        while (isNonWorkingDay(dueDate) && loopGuard < 30) {
            dueDate.setDate(dueDate.getDate() + 1);
            loopGuard++;
        }
        return dueDate;
    }
    function isRevenueOverdue(row, referenceDate) {
        const status = getRevenueStatus(row);
        if (status === 'paid' || status === 'progress' || !row.date)
            return false;
        return getOverdueDays(row, referenceDate) > 0;
    }
    function getOverdueDays(row, referenceDate) {
        const status = getRevenueStatus(row);
        if (status === 'progress' || !row.date)
            return 0;
        const effectiveDueDate = getEffectiveDueDate(row.date);
        if (!effectiveDueDate)
            return 0;
        let compareDate = new Date();
        compareDate.setHours(0, 0, 0, 0);
        if (referenceDate) {
            const ymd = parseDateStringToYMD(referenceDate);
            if (ymd) {
                compareDate = new Date(ymd.year, ymd.month - 1, ymd.day);
                compareDate.setHours(0, 0, 0, 0);
            }
        }
        else if (status === 'paid') {
            const refStr = row.received_at || row.date_launch || row.created_at;
            if (refStr) {
                const ymd = parseDateStringToYMD(refStr);
                if (ymd) {
                    compareDate = new Date(ymd.year, ymd.month - 1, ymd.day);
                    compareDate.setHours(0, 0, 0, 0);
                }
            }
        }
        const diffTime = compareDate.getTime() - effectiveDueDate.getTime();
        if (diffTime <= 0)
            return 0;
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
    function formatOverdueDaysBadge(row) {
        const revenueStatus = getRevenueStatus(row);
        const days = getOverdueDays(row);
        if (days > 0) {
            if (revenueStatus === 'paid') {
                return `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 ring-1 ring-orange-200 dark:ring-orange-700/50 whitespace-nowrap" title="Pago com ${days} ${days === 1 ? 'dia' : 'dias'} de atraso">${days} ${days === 1 ? 'dia' : 'dias'}</span>`;
            }
            return `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-700/50 whitespace-nowrap">${days} ${days === 1 ? 'dia' : 'dias'}</span>`;
        }
        return '<span class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Em dia</span>';
    }
    function formatReceivedAt(row) {
        if (row.received_at) {
            return DateUtils.formatDateTime(row.received_at);
        }
        const status = getRevenueStatus(row);
        if (status === 'paid') {
            return DateUtils.formatDate(row.date);
        }
        return '<span class="text-gray-400 dark:text-gray-500 font-normal">-</span>';
    }
    function calculateRevenueFineAndInterest(row, referenceDate) {
        const isCustomerExempt = row.customer_exempt_interest_fine === 1 || row.customer_exempt_interest_fine === true || row.exempt_interest_fine === 1 || row.exempt_interest_fine === true;
        const revenueStatus = getRevenueStatus(row);
        const isPaid = revenueStatus === 'paid';
        const daysOverdue = getOverdueDays(row, referenceDate);
        const originalAmount = (row.original_amount !== null && row.original_amount !== undefined) ? Number(row.original_amount) : (Number(row.amount) || 0);
        // Se o cliente for isento de juros e multa e a receita não estiver paga com juros prévios
        if (isCustomerExempt && !isPaid) {
            return {
                fine: 0,
                interest: 0,
                totalFineInterest: 0,
                isSimulated: false,
                fineRate: 0,
                monthlyInterestRate: 0,
                dailyInterestRate: 0,
                daysOverdue,
                isExempt: true
            };
        }
        // Se já estiver pago, os valores de multa e juros registrados no banco são definitivos
        if (isPaid) {
            let fine = Number(row.fine || 0);
            let interest = Number(row.interest || 0);
            let totalFineInterest = fine + interest;
            if (!isCustomerExempt && totalFineInterest <= 0 && row.original_amount && Number(row.amount) > Number(row.original_amount)) {
                totalFineInterest = Number(row.amount) - Number(row.original_amount);
                fine = totalFineInterest;
            }
            return {
                fine,
                interest,
                totalFineInterest,
                isSimulated: false,
                fineRate: 0,
                monthlyInterestRate: 0,
                dailyInterestRate: 0,
                daysOverdue,
                isExempt: isCustomerExempt
            };
        }
        // Se o lançamento possui valor de multa ou juros expressamente gravado/definido no banco (> 0)
        const savedFine = (row.fine !== null && row.fine !== undefined) ? Number(row.fine) : 0;
        const savedInterest = (row.interest !== null && row.interest !== undefined) ? Number(row.interest) : 0;
        if (savedFine > 0 || savedInterest > 0) {
            return {
                fine: savedFine,
                interest: savedInterest,
                totalFineInterest: savedFine + savedInterest,
                isSimulated: false,
                fineRate: 0,
                monthlyInterestRate: 0,
                dailyInterestRate: 0,
                daysOverdue,
                isExempt: isCustomerExempt
            };
        }
        // Se não estiver pago e estiver vencido com Boleto ou PIX
        const isBoleto = row.payment_method === 'boleto' || !!row.billet_url || !!row.billet_batch_generated;
        const isPix = row.payment_method === 'pix';
        if (daysOverdue > 0 && (isBoleto || isPix)) {
            // Busca taxa de multa e juros configurada na conta bancária vinculada
            let bankObj = null;
            if (row.bank_account_public_id && Array.isArray(banksData)) {
                bankObj = banksData.find((b) => b.public_id === row.bank_account_public_id);
            }
            // Multa (% fixa ao atrasar, ex: 2%) e Juros (% mensal, ex: 1% ao mês)
            let fineRate = 2.0;
            let monthlyInterestRate = 1.0;
            if (isPix) {
                if (row.bank_pix_fine !== undefined && row.bank_pix_fine !== null && row.bank_pix_fine !== '') {
                    fineRate = Number(row.bank_pix_fine);
                }
                else if (bankObj && bankObj.pix_fine !== undefined && bankObj.pix_fine !== null && bankObj.pix_fine !== '') {
                    fineRate = Number(bankObj.pix_fine);
                }
                if (row.bank_pix_interest !== undefined && row.bank_pix_interest !== null && row.bank_pix_interest !== '') {
                    monthlyInterestRate = Number(row.bank_pix_interest);
                }
                else if (bankObj && bankObj.pix_interest !== undefined && bankObj.pix_interest !== null && bankObj.pix_interest !== '') {
                    monthlyInterestRate = Number(bankObj.pix_interest);
                }
            }
            else {
                if (row.bank_billet_fine !== undefined && row.bank_billet_fine !== null && row.bank_billet_fine !== '') {
                    fineRate = Number(row.bank_billet_fine);
                }
                else if (bankObj && bankObj.billet_fine !== undefined && bankObj.billet_fine !== null && bankObj.billet_fine !== '') {
                    fineRate = Number(bankObj.billet_fine);
                }
                if (row.bank_billet_interest !== undefined && row.bank_billet_interest !== null && row.bank_billet_interest !== '') {
                    monthlyInterestRate = Number(row.bank_billet_interest);
                }
                else if (bankObj && bankObj.billet_interest !== undefined && bankObj.billet_interest !== null && bankObj.billet_interest !== '') {
                    monthlyInterestRate = Number(bankObj.billet_interest);
                }
            }
            // Cálculo da Multa: originalAmount * (fineRate / 100)
            const fine = originalAmount * (fineRate / 100);
            // Cálculo dos Juros/Mora diária acumulada: originalAmount * ((monthlyInterestRate / 30) / 100) * daysOverdue
            const dailyInterestRate = monthlyInterestRate / 30;
            const interest = originalAmount * (dailyInterestRate / 100) * daysOverdue;
            const totalFineInterest = fine + interest;
            return {
                fine,
                interest,
                totalFineInterest,
                isSimulated: true,
                fineRate,
                monthlyInterestRate,
                dailyInterestRate,
                daysOverdue
            };
        }
        // Se não estiver pago e a data de vencimento for hoje ou futura (não vencido), não há incidência de juros/multa
        if (daysOverdue === 0 && !isPaid) {
            return {
                fine: 0,
                interest: 0,
                totalFineInterest: 0,
                isSimulated: false,
                fineRate: 0,
                monthlyInterestRate: 0,
                dailyInterestRate: 0,
                daysOverdue: 0
            };
        }
        // Caso não seja boleto vencido simulado, usa os campos gravados (se houver)
        const fine = Number(row.fine || 0);
        const interest = Number(row.interest || 0);
        return {
            fine,
            interest,
            totalFineInterest: fine + interest,
            isSimulated: false,
            fineRate: 0,
            monthlyInterestRate: 0,
            dailyInterestRate: 0,
            daysOverdue
        };
    }
    function mapReceivableTypeNameToEnum(name) {
        const raw = name.toLowerCase();
        if (raw.includes('pix'))
            return 'pix';
        if (raw.includes('boleto'))
            return 'boleto';
        if (raw.includes('credito') || raw.includes('credit') || raw.includes('crédito'))
            return 'credit';
        if (raw.includes('debito') || raw.includes('debit') || raw.includes('débito'))
            return 'debit';
        if (raw.includes('dinheiro') || raw.includes('cash'))
            return 'cash';
        if (raw.includes('transferencia') || raw.includes('transferência') || raw.includes('transfer') || raw.includes('ted') || raw.includes('doc'))
            return 'transfer';
        return 'cash';
    }
    function updateCardBrandOptions() {
        const paymentEl = document.getElementById('paymentMethod');
        const cardBrandSelect = document.getElementById('cardBrand');
        if (!paymentEl || !cardBrandSelect)
            return;
        const selectedOption = paymentEl.options[paymentEl.selectedIndex];
        const rtIdAttr = selectedOption ? selectedOption.getAttribute('data-receivable-type-id') : null;
        const rtId = rtIdAttr ? parseInt(rtIdAttr, 10) : null;
        let allowedBrands = [];
        if (rtId) {
            const configs = cardConfigurationsData.filter(cc => cc.receivable_type_id === rtId);
            const configuredBrandPublicIds = configs
                .map(cc => cc.card_brand_public_id)
                .filter(Boolean);
            if (configuredBrandPublicIds.length > 0) {
                allowedBrands = cardBrandsData.filter(cb => configuredBrandPublicIds.includes(cb.public_id));
            }
            else {
                allowedBrands = cardBrandsData;
            }
        }
        else {
            allowedBrands = cardBrandsData;
        }
        const currentBrandValue = cardBrandSelect.value;
        cardBrandSelect.innerHTML = '<option value="">Nenhuma/Não Informado</option>';
        allowedBrands.forEach(cb => {
            cardBrandSelect.innerHTML += `<option value="${cb.public_id}">${cb.name}</option>`;
        });
        if (currentBrandValue && allowedBrands.some(cb => cb.public_id === currentBrandValue)) {
            cardBrandSelect.value = currentBrandValue;
        }
        else {
            cardBrandSelect.value = '';
        }
        updateCardConfigOptions();
    }
    function updatePaymentMethodOptions() {
        const bankSelect = document.getElementById('bankSelect');
        const paymentEl = document.getElementById('paymentMethod');
        if (!paymentEl)
            return;
        const currentValue = paymentEl.value;
        const selectedBankPublicId = bankSelect ? bankSelect.value : '';
        const bankObj = banksData.find(b => b.public_id === selectedBankPublicId);
        const bankId = bankObj ? bankObj.id : null;
        const filteredTypes = bankId
            ? receivableTypesData.filter(rt => rt.bank_account_id === bankId)
            : [];
        if (!bankId) {
            paymentEl.innerHTML = '<option value="">Selecione uma conta para depósito primeiro...</option>';
            paymentEl.disabled = true;
        }
        else if (filteredTypes.length > 0) {
            paymentEl.disabled = false;
            paymentEl.innerHTML = '<option value="">Nenhum/Não Informado</option>' +
                filteredTypes.map(rt => {
                    const enumValue = mapReceivableTypeNameToEnum(rt.name);
                    return `<option value="${enumValue}" data-receivable-type-id="${rt.id}">${rt.name}</option>`;
                }).join('');
        }
        else {
            paymentEl.disabled = false;
            paymentEl.innerHTML = `
            <option value="">Nenhum/Não Informado</option>
            <option value="pix">PIX</option>
            <option value="cash">Dinheiro</option>
            <option value="debit">Cartão de Débito</option>
            <option value="credit">Cartão de Crédito</option>
            <option value="transfer">Transferência Bancária</option>
            <option value="boleto">Boleto Bancário</option>
        `;
        }
        if (currentValue && !paymentEl.disabled) {
            paymentEl.value = currentValue;
        }
        const container = document.getElementById('cardBrandContainer');
        if (container) {
            if (paymentEl.value === 'credit' || paymentEl.value === 'debit') {
                container.classList.remove('hidden');
                updateCardBrandOptions();
            }
            else {
                container.classList.add('hidden');
                const cbSelect = document.getElementById('cardBrand');
                if (cbSelect)
                    cbSelect.value = '';
                updateCardConfigOptions();
            }
        }
    }
    async function loadDependencies(balancesOnly = false) {
        try {
            if (balancesOnly) {
                const banksRes = await api('/bank-accounts');
                banksData = banksRes.data || [];
            }
            else {
                const [catsRes, banksRes, meRes, recTypesRes, cardBrandsRes, cardConfigsRes, custGroupsRes, costCentersRes] = await Promise.all([
                    api('/finance/categories'),
                    api('/bank-accounts'),
                    api('/auth/me'),
                    api('/receivable-types').catch(err => {
                        console.warn('Falha ao carregar tipos de recebíveis:', err);
                        return { data: [] };
                    }),
                    api('/card-brands').catch(err => {
                        console.warn('Falha ao carregar bandeiras:', err);
                        return { data: [] };
                    }),
                    api('/card-configurations').catch(err => {
                        console.warn('Falha ao carregar configurações de cartões:', err);
                        return { data: [] };
                    }),
                    api('/customer-groups').catch(err => {
                        console.warn('Falha ao carregar grupos de clientes:', err);
                        return { data: [] };
                    }),
                    api('/cost-centers').catch(err => {
                        console.warn('Falha ao carregar centros de custo:', err);
                        return { data: [] };
                    })
                ]);
                categoriesData = catsRes.data.filter(c => c.type === 'income') || [];
                banksData = banksRes.data || [];
                receivableTypesData = recTypesRes.data || [];
                cardBrandsData = cardBrandsRes.data || [];
                cardConfigurationsData = cardConfigsRes.data || [];
                customerGroupsData = custGroupsRes.data || [];
                costCentersData = costCentersRes.data || [];
                const filterCustomerGroupSelect = document.getElementById('filterCustomerGroup');
                if (filterCustomerGroupSelect) {
                    const saved = (window.CompanyStorage?.getItem('revenues_filter_filterCustomerGroup') ?? localStorage.getItem('revenues_filter_filterCustomerGroup')) || '';
                    filterCustomerGroupSelect.innerHTML = '<option value="">Todos</option>' + customerGroupsData.map(g => `<option value="${escapeHtml(g.public_id)}">${escapeHtml(g.name)}</option>`).join('');
                    filterCustomerGroupSelect.value = saved;
                }
                const costCenterSelect = document.getElementById('costCenter');
                if (costCenterSelect) {
                    costCenterSelect.innerHTML = '<option value="">Nenhum/Não Informado</option>';
                    costCentersData.forEach(cc => {
                        if (cc.is_active) {
                            costCenterSelect.innerHTML += `<option value="${escapeHtml(cc.public_id)}">${escapeHtml(cc.name)}</option>`;
                        }
                    });
                }
                const company = meRes?.data?.company || meRes?.data?.user?.company || meRes?.data?.user?.company_info;
                if (company) {
                    window.currentSolidconUrls = [
                        company.solidcon_url_1 || '',
                        company.solidcon_url_2 || '',
                        company.solidcon_url_3 || '',
                        company.solidcon_url_4 || '',
                        company.solidcon_url_5 || '',
                    ];
                    const showSolidcon = company.show_solidcon !== false && company.show_solidcon !== 0;
                    const btn = document.getElementById('btnOpenSolidconModal');
                    if (btn) {
                        if (!showSolidcon) {
                            btn.classList.add('hidden');
                            btn.classList.remove('inline-flex');
                            btn.style.setProperty('display', 'none', 'important');
                        }
                        else {
                            btn.classList.remove('hidden');
                            btn.classList.add('inline-flex');
                            btn.style.display = '';
                        }
                    }
                }
                const catSelect = document.getElementById('category');
                if (catSelect) {
                    catSelect.innerHTML = '<option value="">Selecione...</option>';
                    categoriesData.forEach(c => {
                        catSelect.innerHTML += `<option value="${escapeHtml(c.public_id)}">${escapeHtml(c.name)}</option>`;
                    });
                }
            }
            const bankSelect = document.getElementById('bankSelect');
            const filterBank = document.getElementById('filterBank');
            const bulkUpdateBank = document.getElementById('bulkUpdateBank');
            const baixaBankSelect = document.getElementById('baixaBankSelect');
            const currentBankSelectVal = bankSelect ? bankSelect.value : '';
            const currentFilterBankVal = filterBank ? (filterBank.value || (window.CompanyStorage?.getItem('revenues_filter_filterBank') ?? localStorage.getItem('revenues_filter_filterBank')) || '') : '';
            const currentBulkUpdateBankVal = bulkUpdateBank ? bulkUpdateBank.value : '';
            const currentBaixaBankSelectVal = baixaBankSelect ? baixaBankSelect.value : '';
            if (bankSelect) {
                bankSelect.innerHTML = '<option value="">Selecione a conta depositaria...</option>';
            }
            if (filterBank) {
                filterBank.innerHTML = '<option value="">Todas as Contas</option>';
            }
            if (bulkUpdateBank) {
                bulkUpdateBank.innerHTML = '<option value="">-- Manter Conta Original de Cada Lançamento --</option>';
            }
            if (baixaBankSelect) {
                baixaBankSelect.innerHTML = '';
            }
            banksData.forEach(b => {
                if (bankSelect)
                    bankSelect.innerHTML += `<option value="${escapeHtml(b.public_id)}">${escapeHtml(b.name)}</option>`;
                if (filterBank)
                    filterBank.innerHTML += `<option value="${escapeHtml(b.public_id)}">${escapeHtml(b.name)}</option>`;
                if (bulkUpdateBank)
                    bulkUpdateBank.innerHTML += `<option value="${escapeHtml(b.public_id)}">${escapeHtml(b.name)}</option>`;
                if (baixaBankSelect)
                    baixaBankSelect.innerHTML += `<option value="${escapeHtml(b.public_id)}">${escapeHtml(b.name)}</option>`;
            });
            if (bankSelect && currentBankSelectVal)
                bankSelect.value = currentBankSelectVal;
            if (filterBank && currentFilterBankVal)
                filterBank.value = currentFilterBankVal;
            if (bulkUpdateBank && currentBulkUpdateBankVal)
                bulkUpdateBank.value = currentBulkUpdateBankVal;
            if (baixaBankSelect && currentBaixaBankSelectVal)
                baixaBankSelect.value = currentBaixaBankSelectVal;
            if (!balancesOnly) {
                const cardBrandSelect = document.getElementById('cardBrand');
                if (cardBrandSelect) {
                    cardBrandSelect.innerHTML = '<option value="">Nenhuma/Não Informado</option>';
                    cardBrandsData.forEach(cb => {
                        cardBrandSelect.innerHTML += `<option value="${escapeHtml(cb.public_id)}">${escapeHtml(cb.name)}</option>`;
                    });
                }
            }
            updatePaymentMethodOptions();
        }
        catch (e) {
            console.error('Falha ao carregar categorias ou bancos', e);
        }
    }
    async function fetchRevenues() {
        try {
            const res = await api('/finance/revenues');
            revenuesData = (res.data || []).filter((r) => {
                const desc = String(r.description || '');
                if (desc.includes('Juros de conv') || desc.includes('[ORIGIN_TX:'))
                    return false;
                if (r.customer_hide_in_revenues_grid === 1 || r.customer_hide_in_revenues_grid === true || r.hide_in_revenues_grid === 1 || r.hide_in_revenues_grid === true)
                    return false;
                return true;
            });
            try {
                applyFilters();
            }
            catch (filterErr) {
                console.error('Falha ao aplicar filtros nas receitas:', filterErr);
            }
        }
        catch (e) {
            console.error('Falha ao carregar receitas:', e);
            const msg = e?.message ? `Erro ao listar receitas: ${e.message}` : 'Erro ao listar receitas';
            UI.showAlert('alertMessage', msg, 'error');
        }
    }
    function hasRevenueFineOrInterest(r) {
        const calc = calculateRevenueFineAndInterest(r);
        const intInfo = getRowInterestInfo(r, revenuesData);
        const fineInterestAmount = intInfo.fineInterestAmount > 0 ? intInfo.fineInterestAmount : calc.totalFineInterest;
        if (fineInterestAmount > 0)
            return true;
        if (intInfo.hasSolidconCashInterest)
            return true;
        if (Number(r.fine || 0) > 0 || Number(r.interest || 0) > 0)
            return true;
        if (r.original_amount !== null && r.original_amount !== undefined && Number(r.amount) > Number(r.original_amount))
            return true;
        return false;
    }
    function applyFilters() {
        const period = document.getElementById('filterPeriod')?.value || '';
        const startDate = document.getElementById('filterStartDate')?.value || '';
        const endDate = document.getElementById('filterEndDate')?.value || '';
        const paymentMethod = document.getElementById('filterPaymentMethod')?.value || '';
        const status = document.getElementById('filterStatus')?.value || '';
        const fineInterest = document.getElementById('filterFineInterest')?.value || '';
        const bank = document.getElementById('filterBank')?.value || '';
        const customerGroup = document.getElementById('filterCustomerGroup')?.value || '';
        const whatsappStatus = document.getElementById('filterWhatsappStatus')?.value || '';
        const sortBy = document.getElementById('filterSortBy')?.value || 'date_desc';
        const description = document.getElementById('filterDescription')?.value || '';
        // Save to CompanyStorage
        const setScoped = (k, v) => {
            if (window.CompanyStorage) {
                window.CompanyStorage.setItem(k, v);
            }
            else {
                localStorage.setItem(k, v);
            }
        };
        setScoped('revenues_filter_filterPeriod', period);
        setScoped('revenues_filter_filterStartDate', startDate);
        setScoped('revenues_filter_filterEndDate', endDate);
        setScoped('revenues_filter_filterPaymentMethod', paymentMethod);
        setScoped('revenues_filter_filterStatus', status);
        setScoped('revenues_filter_filterFineInterest', fineInterest);
        setScoped('revenues_filter_filterBank', bank);
        setScoped('revenues_filter_filterCustomerGroup', customerGroup);
        setScoped('revenues_filter_filterWhatsappStatus', whatsappStatus);
        setScoped('revenues_filter_filterSortBy', sortBy);
        setScoped('revenues_filter_filterDescription', description);
        let filtered = revenuesData.filter(r => {
            let match = true;
            if (startDate) {
                if (DateUtils.compareDateOnly(r.date, startDate) < 0)
                    match = false;
            }
            if (endDate) {
                if (DateUtils.compareDateOnly(r.date, endDate) > 0)
                    match = false;
            }
            if (paymentMethod) {
                if (r.payment_method !== paymentMethod)
                    match = false;
            }
            if (status) {
                const revenueStatus = getRevenueStatus(r);
                if (status === 'progress' && revenueStatus !== 'progress')
                    match = false;
                if (status === 'paid' && !isRevenuePaid(r))
                    match = false;
                if (status === 'paid_with_fine_interest') {
                    if (!isRevenuePaid(r) || !hasRevenueFineOrInterest(r))
                        match = false;
                }
                if (status === 'pending' && (isRevenuePaid(r) || revenueStatus === 'progress' || isRevenueOverdue(r)))
                    match = false;
                if (status === 'overdue' && !isRevenueOverdue(r))
                    match = false;
            }
            if (fineInterest) {
                const hasFineInt = hasRevenueFineOrInterest(r);
                const isExempt = (r.customer_exempt_interest_fine === 1 || r.customer_exempt_interest_fine === true || r.exempt_interest_fine === 1 || r.exempt_interest_fine === true);
                if (fineInterest === 'paid_with_fine_interest') {
                    if (!isRevenuePaid(r) || !hasFineInt)
                        match = false;
                }
                else if (fineInterest === 'has_fine_interest') {
                    if (!hasFineInt)
                        match = false;
                }
                else if (fineInterest === 'no_fine_interest') {
                    if (hasFineInt)
                        match = false;
                }
                else if (fineInterest === 'exempt_interest_fine') {
                    if (!isExempt)
                        match = false;
                }
            }
            if (bank) {
                if (r.bank_account_public_id !== bank)
                    match = false;
            }
            if (customerGroup) {
                if (r.customer_group_public_id !== customerGroup)
                    match = false;
            }
            if (whatsappStatus) {
                const isSent = Number(r.whatsapp_sent || 0) > 0;
                if (whatsappStatus === 'sent' && !isSent)
                    match = false;
                if (whatsappStatus === 'not_sent' && isSent)
                    match = false;
            }
            if (description) {
                const descLower = description.toLowerCase();
                const rDesc = (r.description || '').toLowerCase();
                const rCust = (r.customer_name || '').toLowerCase();
                if (!rDesc.includes(descLower) && !rCust.includes(descLower))
                    match = false;
            }
            return match;
        });
        if (sortBy === 'group') {
            filtered.sort((a, b) => {
                const nameA = a.customer_group_name || '';
                const nameB = b.customer_group_name || '';
                if (nameA === '' && nameB !== '')
                    return 1;
                if (nameB === '' && nameA !== '')
                    return -1;
                if (nameA === '' && nameB === '')
                    return 0;
                return nameA.localeCompare(nameB, 'pt-BR');
            });
        }
        else if (sortBy === 'date_asc') {
            filtered.sort((a, b) => {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                return dateA - dateB;
            });
        }
        else if (sortBy === 'date_desc') {
            filtered.sort((a, b) => {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                return dateB - dateA;
            });
        }
        else if (sortBy === 'value_asc') {
            filtered.sort((a, b) => (parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0));
        }
        else if (sortBy === 'value_desc') {
            filtered.sort((a, b) => (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0));
        }
        const paginationMode = document.getElementById('filterPaginationMode')?.value || 'paginated_20';
        setScoped('revenues_filter_filterPaginationMode', paginationMode);
        let pageSize = 20;
        let isDirect = false;
        if (paginationMode === 'direct') {
            isDirect = true;
            pageSize = 999999;
        }
        else if (paginationMode === 'paginated_50') {
            pageSize = 50;
        }
        else if (paginationMode === 'paginated_100') {
            pageSize = 100;
        }
        else {
            pageSize = 20;
        }
        // Alimenta os paginadores com os dados filtrados
        if (!_tablePager) {
            _tablePager = new Paginator({
                containerId: 'revenuesPaginationContainer',
                pageSize: pageSize,
                onChange: (pageItems) => { renderTable(pageItems); },
            });
        }
        else {
            _tablePager.pageSize = pageSize;
        }
        if (!_gridPager) {
            _gridPager = new Paginator({
                containerId: 'revenuesGridPaginationContainer',
                pageSize: pageSize,
                onChange: (pageItems) => { renderGrid('revenuesGridContainer', pageItems); },
            });
        }
        else {
            _gridPager.pageSize = pageSize;
        }
        _tablePager.setData(filtered);
        _gridPager.setData(filtered);
        if (isDirect) {
            const tablePagEl = document.getElementById('revenuesPaginationContainer');
            if (tablePagEl)
                tablePagEl.innerHTML = '';
            const gridPagEl = document.getElementById('revenuesGridPaginationContainer');
            if (gridPagEl)
                gridPagEl.innerHTML = '';
        }
        updateFooter(filtered);
    }
    function updateFooter(data = []) {
        const countEl = document.getElementById('footerCount');
        const totalEl = document.getElementById('footerTotal');
        const totalLiquidoEl = document.getElementById('footerTotalLiquido');
        const pendingEl = document.getElementById('footerTotalPending');
        const pendingLiquidoEl = document.getElementById('footerTotalPendingLiquido');
        const paidEl = document.getElementById('footerTotalPaid');
        const paidLiquidoEl = document.getElementById('footerTotalPaidLiquido');
        if (!countEl || !totalEl || !pendingEl || !paidEl)
            return;
        const count = data.length;
        const getRevenueGrossAmount = (r) => {
            const calc = calculateRevenueFineAndInterest(r);
            const intInfo = getRowInterestInfo(r, data);
            const fineInterestToDisplay = intInfo.fineInterestAmount > 0 ? intInfo.fineInterestAmount : calc.totalFineInterest;
            const originalAmount = (r.original_amount !== null && r.original_amount !== undefined) ? Number(r.original_amount) : (Number(r.amount) || 0);
            if (isRevenuePaid(r)) {
                return Math.max(parseFloat(r.amount) || 0, originalAmount + fineInterestToDisplay);
            }
            return originalAmount + fineInterestToDisplay;
        };
        const getRevenueNetAmount = (r) => {
            const gross = getRevenueGrossAmount(r);
            if (r.payment_method === 'credit' || r.payment_method === 'debit') {
                const taxRate = parseFloat(r.card_tax_rate) || 0;
                if (taxRate > 0) {
                    return gross * (1 - taxRate / 100);
                }
            }
            if (isRevenuePaid(r)) {
                if (r.net_amount !== undefined && r.net_amount !== null && parseFloat(r.net_amount) > 0 && parseFloat(r.net_amount) !== parseFloat(r.amount)) {
                    return parseFloat(r.net_amount);
                }
                return gross;
            }
            return gross;
        };
        const total = data.reduce((sum, r) => sum + getRevenueGrossAmount(r), 0);
        const totalLiquido = data.reduce((sum, r) => sum + getRevenueNetAmount(r), 0);
        const pendingTotal = data.filter(r => !isRevenuePaid(r)).reduce((sum, r) => sum + getRevenueGrossAmount(r), 0);
        const pendingTotalLiquido = data.filter(r => !isRevenuePaid(r)).reduce((sum, r) => sum + getRevenueNetAmount(r), 0);
        const paidTotal = data.filter(r => isRevenuePaid(r)).reduce((sum, r) => sum + getRevenueGrossAmount(r), 0);
        const paidTotalLiquido = data.filter(r => isRevenuePaid(r)).reduce((sum, r) => sum + getRevenueNetAmount(r), 0);
        countEl.textContent = count;
        totalEl.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        if (totalLiquidoEl) {
            totalLiquidoEl.textContent = totalLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
        pendingEl.textContent = pendingTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        if (pendingLiquidoEl) {
            pendingLiquidoEl.textContent = pendingTotalLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
        paidEl.textContent = paidTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        if (paidLiquidoEl) {
            paidLiquidoEl.textContent = paidTotalLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
    }
    const paymentTermsPtBr = {
        '(cash)': '(Dinheiro)',
        '(pix)': '(Pix)',
        '(credit)': '(Crédito)',
        '(debit)': '(Débito)',
        '(transfer)': '(Transferência)',
        '(boleto)': '(Boleto)',
    };
    function translateDescription(desc) {
        if (!desc)
            return '';
        let cleaned = String(desc).replace(/\[ORIGIN_TX:[^\]]+\]/g, '').trim();
        let translated = cleaned.replace(/\((cash|pix|credit|debit|transfer|boleto)\)/gi, (match) => paymentTermsPtBr[match.toLowerCase()] || match);
        return escapeHtml(translated);
    }
    function getRowInterestInfo(r, allRows = revenuesData) {
        const isCustomerExempt = r.customer_exempt_interest_fine === 1 || r.customer_exempt_interest_fine === true || r.exempt_interest_fine === 1 || r.exempt_interest_fine === true;
        const calc = calculateRevenueFineAndInterest(r);
        const hasFineOrInterest = (Number(r.fine || 0) + Number(r.interest || 0) > 0) || (!isCustomerExempt && calc.totalFineInterest > 0);
        const hasSolidconCashInterest = Boolean(r.solidcon_interest_key || (r.solidcon_quitado && (Number(r.fine || 0) + Number(r.interest || 0) > 0)));
        let fineInterestAmount = 0;
        if (Number(r.fine || 0) > 0 || Number(r.interest || 0) > 0) {
            fineInterestAmount = Number(r.fine || 0) + Number(r.interest || 0);
        }
        else if (calc.totalFineInterest > 0) {
            fineInterestAmount = calc.totalFineInterest;
        }
        return {
            isInterestRevenue: false,
            linkedInterestTx: null,
            hasSolidconCashInterest,
            fineInterestAmount
        };
    }
    // ─── Column Visibility Management ───────────────────────────────────────────
    const STORAGE_KEY_COLUMNS = 'erp_revenues_columns_visibility';
    const defaultColumnsState = {
        id: true,
        desc: true,
        cat: true,
        dates: true,
        overdue: true,
        launch: true,
        status: true,
        receivable: true,
        fine: true,
        received: true,
        actions: true,
    };
    function saveColumnVisibility() {
        const preferences = {};
        const checkboxes = document.querySelectorAll('#columnsDropdownMenu input[data-column-target]');
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
            const checkboxes = document.querySelectorAll('#columnsDropdownMenu input[data-column-target]');
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
        const checkboxes = document.querySelectorAll('#columnsDropdownMenu input[data-column-target]');
        checkboxes.forEach((cb) => {
            const target = cb.getAttribute('data-column-target');
            if (!target)
                return;
            const elements = document.querySelectorAll(`.col-${target}`);
            elements.forEach((el) => {
                if (cb.checked) {
                    el.style.display = '';
                    el.classList.remove('hidden');
                }
                else {
                    el.style.display = 'none';
                    el.classList.add('hidden');
                }
            });
        });
    }
    function initColumnVisibility() {
        const btnToggle = document.getElementById('btnToggleColumns');
        const menu = document.getElementById('columnsDropdownMenu');
        const btnReset = document.getElementById('btnResetColumns');
        const checkboxes = document.querySelectorAll('#columnsDropdownMenu input[data-column-target]');
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
                const target = e.target;
                if (menu && !menu.contains(target) && target !== btnToggle && !btnToggle.contains(target)) {
                    menu.classList.add('hidden');
                }
            });
        }
    }
    function renderTable(data = revenuesData) {
        const tbody = document.getElementById('revenuesTable');
        if (!tbody)
            return;
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="12" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhuma receita no momento.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map((r, index) => {
            const revenueStatus = getRevenueStatus(r);
            const isOverdue = isRevenueOverdue(r);
            const calc = calculateRevenueFineAndInterest(r);
            const intInfo = getRowInterestInfo(r, data);
            const fineInterestToDisplay = intInfo.fineInterestAmount > 0 ? intInfo.fineInterestAmount : calc.totalFineInterest;
            const originalAmount = (r.original_amount !== null && r.original_amount !== undefined) ? Number(r.original_amount) : (Number(r.amount) || 0);
            const receivedAmount = revenueStatus === 'paid'
                ? Math.max(Number(r.amount) || 0, originalAmount + fineInterestToDisplay)
                : (originalAmount + fineInterestToDisplay);
            const solidconBtnHtml = (revenueStatus === 'paid' || r.solidcon_key || r.solidcon_quitado) ? `
            <button type="button" class="btn-solidcon-details p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors cursor-pointer" data-id="${r.public_id}" title="Auditoria Solidcon">
                <svg class="w-4 h-4 inline pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
            </button>
        ` : '';
            let statusBadge = '';
            if (revenueStatus === 'progress') {
                statusBadge = '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold text-orange-800 bg-orange-100 ring-1 ring-orange-200 dark:bg-orange-900/35 dark:text-orange-200 dark:ring-orange-700/60 whitespace-nowrap">Andamento</span>';
            }
            else if (revenueStatus === 'paid') {
                statusBadge = `<div class="inline-flex items-center gap-1.5"><span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-green-800 bg-green-100 dark:bg-green-900/40 dark:text-green-300 whitespace-nowrap">Recebido</span>${solidconBtnHtml}</div>`;
            }
            else if (isOverdue) {
                statusBadge = '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-red-800 bg-red-100 dark:bg-red-900/40 dark:text-red-300 whitespace-nowrap">Vencido</span>';
            }
            else {
                statusBadge = '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-yellow-800 bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-300 whitespace-nowrap">Pendente</span>';
            }
            return `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors group">
            <td class="px-2 py-4 whitespace-nowrap text-left w-8">
                <input type="checkbox" value="${escapeHtml(r.public_id)}" class="revenue-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800">
            </td>
            <td class="col-id px-2 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                #${String(index + 1).padStart(4, '0')}
            </td>
            <td class="col-desc px-2 py-4 whitespace-normal wrap-break-word min-w-37.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span>${translateDescription(r.description)}</span>
                    ${r.cdfilial ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30 whitespace-nowrap">Filial: ${escapeHtml(r.cdfilial)}</span>` : ''}
                    ${r.pdv ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-100 dark:border-amber-900/30 whitespace-nowrap">PDV: ${escapeHtml(r.pdv)}</span>` : ''}
                    ${r.solidcon_quitado ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30 whitespace-nowrap" title="${r.solidcon_key ? `Código da Baixa Solidcon: #${escapeHtml(r.solidcon_key)}` : 'Baixado no Solidcon'}">Baixado no Solidcon${r.solidcon_key ? ` (#${escapeHtml(r.solidcon_key)})` : ''}</span>` : (r.solidcon_key ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap" title="Código Solidcon: #${escapeHtml(r.solidcon_key)}">Solidcon: #${escapeHtml(r.solidcon_key)}</span>` : '')}
                    ${(r.customer_only_solidcon_baixa === 1 || r.customer_only_solidcon_baixa === true || r.only_solidcon_baixa === 1 || r.only_solidcon_baixa === true) ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-100 dark:border-purple-900/30 whitespace-nowrap" title="Baixa manual no Keystone travada (Exclusiva Solidcon)">Baixa Solidcon</span>` : ''}
                    ${(r.customer_exempt_interest_fine === 1 || r.customer_exempt_interest_fine === true || r.exempt_interest_fine === 1 || r.exempt_interest_fine === true) ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30 whitespace-nowrap" title="Cliente isento de cobrança de juros e multa por atraso">Isento Juros/Multa</span>` : ''}
                    ${(r.whatsapp_sent && Number(r.whatsapp_sent) > 0) ? `
                        <button type="button" data-action="view-whatsapp-audit" data-public-id="${escapeHtml(r.public_id)}" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 whitespace-nowrap shadow-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/60 cursor-pointer transition-colors" title="Enviado ${Number(r.whatsapp_sent)}x por WhatsApp - Clique para ver auditoria">
                            <svg class="w-3 h-3 text-emerald-600 dark:text-emerald-400 inline shrink-0" fill="currentColor" viewBox="0 0 448 512"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L3 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>
                            WhatsApp (${Number(r.whatsapp_sent)})
                        </button>` : ''}
                </div>
                ${r.entity_name ? `
                <div class="text-xs text-gray-500 dark:text-gray-400 font-normal mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span class="flex items-center gap-1">
                        <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                        ${escapeHtml(r.entity_name)}
                    </span>
                    ${r.entity_cnpj_cpf ? `
                    <span class="text-gray-400 dark:text-gray-500 font-normal">|</span>
                    <span class="font-mono text-[11px] text-gray-500 dark:text-gray-400">${escapeHtml(r.entity_cnpj_cpf)}</span>` : ''}
                    ${r.entity_phone ? `
                    <span class="text-gray-400 dark:text-gray-500 font-normal">|</span>
                    <span class="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
                        <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                        ${escapeHtml(r.entity_phone)}
                    </span>` : ''}
                    ${r.customer_group_name ? `
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-100 dark:border-purple-900/30 whitespace-nowrap">
                        ${escapeHtml(r.customer_group_name)}
                    </span>` : ''}
                </div>` : '<div class="text-xs text-gray-400 mt-0.5 dark:text-gray-500">Sem vínculo</div>'}
            </td>
            <td class="col-cat px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center">
                <div class="flex flex-col items-center justify-center gap-1">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        ${escapeHtml(r.category_name || 'Geral')}
                    </span>
                    <div class="mt-0.5 text-center">
                        ${renderPaymentMethodLabel(r.payment_method, r.card_brand_name, r.billet_batch_generated, r.billet_url, r.pix_code, revenueStatus === 'paid', r.received_channel)}
                    </div>
                    ${r.card_brand_name ? `
                    <span class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-100 dark:border-orange-900/30">
                        Bandeira: ${escapeHtml(r.card_brand_name)}
                    </span>` : ''}
                    ${r.receivable_type_name ? `
                    <span class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300 border border-slate-200 dark:border-slate-600/40">
                        Rec: ${escapeHtml(r.receivable_type_name)}
                    </span>` : ''}
                </div>
            </td>
            <td class="col-dates px-2 py-4 whitespace-nowrap text-sm text-center">
                <div class="flex flex-col items-center justify-center">
                    <span class="font-medium text-gray-900 dark:text-gray-100 text-xs" title="Data de Vencimento">${DateUtils.formatDate(r.date)}</span>
                    <div class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5" title="Data de Recebimento">${formatReceivedAt(r)}</div>
                </div>
            </td>
            <td class="col-overdue px-2 py-4 whitespace-nowrap text-sm text-center">${formatOverdueDaysBadge(r)}</td>
            <td class="col-launch px-2 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${DateUtils.formatDateTime(r.date_launch || r.created_at || r.date)}</td>
            <td class="col-status px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center">
                <div class="flex flex-col items-center justify-center">
                    <span class="font-medium text-gray-900 dark:text-gray-100">${escapeHtml(r.bank_account_name || '-')}</span>
                    <div class="mt-0.5 text-center flex items-center justify-center">
                        ${statusBadge}
                    </div>
                </div>
            </td>

            <td class="col-receivable px-2 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                ${formatCurrency(originalAmount)}
            </td>
            <td class="col-fine px-2 py-4 whitespace-nowrap text-right text-sm font-medium">
                ${(fineInterestToDisplay > 0 || intInfo.hasSolidconCashInterest) ? `
                    <div class="flex flex-col items-end" title="${calc.isSimulated && !intInfo.hasSolidconCashInterest ? `Projeção diária (${calc.daysOverdue}d de atraso):\nMulta (${calc.fineRate}%): ${formatCurrency(calc.fine)}\nJuros (${calc.monthlyInterestRate}% a.m.): ${formatCurrency(calc.interest)}` : (intInfo.hasSolidconCashInterest ? 'Receita à vista de juros lançada no Solidcon' : `Multa: ${formatCurrency(calc.fine)} | Juros: ${formatCurrency(calc.interest)}`)}">
                        <span class="${intInfo.hasSolidconCashInterest ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-amber-600 dark:text-amber-400 font-semibold'}">+${formatCurrency(fineInterestToDisplay)}</span>
                        ${calc.isSimulated && !intInfo.hasSolidconCashInterest ? `<span class="text-[10px] text-amber-500/80 dark:text-amber-400/80 font-normal">(${calc.daysOverdue}d diário)</span>` : ''}
                        ${intInfo.hasSolidconCashInterest ? `
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 whitespace-nowrap mt-0.5" title="${r.solidcon_interest_key ? `Receita à vista de juros lançada no Solidcon (Receita #${escapeHtml(r.solidcon_interest_key)})` : 'Receita à vista de juros lançada no Solidcon'}">
                                <svg class="w-3 h-3 text-emerald-600 dark:text-emerald-400 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                                Solidcon (À Vista)${r.solidcon_interest_key ? ` #${escapeHtml(r.solidcon_interest_key)}` : ''}
                            </span>
                        ` : ''}
                    </div>
                ` : ((r.customer_exempt_interest_fine === 1 || r.customer_exempt_interest_fine === true || r.exempt_interest_fine === 1 || r.exempt_interest_fine === true) ? `
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30" title="Cliente isento de juros e multa">Isento</span>
                ` : `<span class="text-gray-400 dark:text-gray-500 text-xs">R$ 0,00</span>`)}
            </td>
            <td class="col-received px-2 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex flex-col items-end">
                    ${revenueStatus === 'paid' ? `
                        <span class="text-emerald-600 dark:text-emerald-400 font-bold block" title="Valor Recebido na Conta">+ ${formatCurrency(receivedAmount)}</span>
                    ` : (calc.isSimulated && calc.totalFineInterest > 0 ? `
                        <span class="text-emerald-600 dark:text-emerald-400 font-bold block" title="Total a receber atualizado com multa e juros diários">${formatCurrency(originalAmount + calc.totalFineInterest)}</span>
                        <span class="text-[10px] text-amber-600 dark:text-amber-400 block font-normal">Aberto (c/ juros)</span>
                    ` : `
                        <span class="text-gray-700 dark:text-gray-300 font-bold block" title="Valor a Receber">${formatCurrency(originalAmount || r.amount)}</span>
                    `)}
                    ${(r.payment_method === 'credit' || r.payment_method === 'debit') ? `
                        <span class="text-[10px] text-gray-400 dark:text-gray-500 block font-normal">Taxa: ${parseFloat(r.card_tax_rate) || 0}%</span>
                        <span class="text-xs text-gray-500 dark:text-gray-400 block font-semibold" title="Valor Líquido pós taxas">Liq: ${formatCurrency(parseFloat(r.card_tax_rate) > 0 ? r.amount * (1 - (parseFloat(r.card_tax_rate) || 0) / 100) : (r.net_amount !== undefined ? r.net_amount : r.amount))}</span>
                    ` : ''}
                </div>
            </td>
            <td class="col-actions px-2 py-3 whitespace-nowrap text-center text-sm font-medium">
                <button type="button" class="relative text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 mr-2 cursor-pointer send-whatsapp-btn" data-id="${escapeHtml(r.public_id)}" data-phone="${escapeHtml(r.customer_phone || '')}" title="Enviar por WhatsApp">
                    <svg class="h-5 w-5 inline pointer-events-none" fill="currentColor" viewBox="0 0 448 512">
                        <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L3 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
                    </svg>
                    ${(r.whatsapp_sent && Number(r.whatsapp_sent) > 0) ? `<span class="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-bold border border-white dark:border-slate-800 shadow-sm leading-none" title="Enviado ${Number(r.whatsapp_sent)}x por WhatsApp">${Number(r.whatsapp_sent)}</span>` : ''}
                </button>
                ${(r.payment_method === 'boleto' && r.billet_url) ? '' : (isOverdue ? `
                <button type="button" class="text-rose-600 hover:text-rose-900 dark:text-rose-400 dark:hover:text-rose-300 mr-2 cursor-pointer inline-flex items-center gap-1 open-receipt-btn" data-id="${escapeHtml(r.public_id)}" title="Cobrar">
                    <span class="inline-flex h-5 w-5 items-center justify-center text-base font-bold leading-none text-rose-600 dark:text-rose-400 pointer-events-none">$</span>
                </button>` : `
                <button type="button" class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-2 cursor-pointer open-receipt-btn" data-id="${escapeHtml(r.public_id)}" title="Recibo">
                    <svg class="h-5 w-5 inline pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </button>`)}
                ${(r.payment_method === 'boleto' && r.billet_url) ? `
                    <button type="button" class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-2 cursor-pointer open-boleto-btn" data-id="${escapeHtml(r.public_id)}" data-nosso-numero="${escapeHtml(r.billet_url)}" title="Visualizar Boleto PDF">
                        <svg class="h-5 w-5 inline pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                    </button>
                ` : ''}
                <button type="button" class="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 cursor-pointer edit-btn" data-id="${escapeHtml(r.public_id)}" title="Editar">
                    <svg class="h-5 w-5 inline pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
            </td>
        </tr>
        `;
        }).join('');
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox)
            selectAllCheckbox.checked = false;
        updateSelectedCount();
        applyColumnVisibility();
    }
    function renderGrid(elementId, items) {
        const grid = document.getElementById(elementId);
        if (!grid)
            return;
        if (items.length === 0) {
            grid.innerHTML = `<div class="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800">Nenhuma receita no momento.</div>`;
            return;
        }
        grid.innerHTML = items.map((r, index) => {
            const revenueStatus = getRevenueStatus(r);
            const isOverdue = isRevenueOverdue(r);
            const calc = calculateRevenueFineAndInterest(r);
            const intInfo = getRowInterestInfo(r, items);
            const fineInterestToDisplay = intInfo.fineInterestAmount > 0 ? intInfo.fineInterestAmount : calc.totalFineInterest;
            const originalAmount = (r.original_amount !== null && r.original_amount !== undefined) ? Number(r.original_amount) : (Number(r.amount) || 0);
            const receivedAmount = revenueStatus === 'paid'
                ? Math.max(Number(r.amount) || 0, originalAmount + fineInterestToDisplay)
                : (originalAmount + fineInterestToDisplay);
            let statusClasses = '';
            let statusText = '';
            if (revenueStatus === 'progress') {
                statusClasses = 'text-orange-800 bg-orange-100 ring-1 ring-orange-200 dark:bg-orange-900/35 dark:text-orange-200 dark:ring-orange-700/60';
                statusText = 'Andamento';
            }
            else if (revenueStatus === 'paid') {
                statusClasses = 'text-green-800 bg-green-100 dark:bg-green-900/40 dark:text-green-300';
                statusText = 'Recebido';
            }
            else if (isOverdue) {
                statusClasses = 'text-red-800 bg-red-100 dark:bg-red-900/40 dark:text-red-300';
                statusText = 'Vencido';
            }
            else {
                statusClasses = 'text-yellow-800 bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-300';
                statusText = 'Pendente';
            }
            const solidconBtnHtml = (revenueStatus === 'paid' || r.solidcon_key || r.solidcon_quitado) ? `
            <button type="button" class="btn-solidcon-details p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors cursor-pointer" data-id="${escapeHtml(r.public_id)}" title="Auditoria Solidcon">
                <svg class="w-4 h-4 inline pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
            </button>
        ` : '';
            const statusBadge = `
            <div class="inline-flex items-center gap-1.5">
                <span class="px-2 inline-flex items-center text-xs leading-5 font-semibold rounded-full ${statusClasses}">${statusText}</span>
                ${solidconBtnHtml}
            </div>
        `;
            const entityLabel = r.entity_name
                ? `<div class="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 flex-wrap">
                <span class="flex items-center gap-1">
                    <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                    ${escapeHtml(r.entity_name)}
                </span>
                ${r.entity_cnpj_cpf ? `
                <span class="text-gray-400 dark:text-gray-600 font-normal">|</span>
                <span class="font-mono text-[11px]">${escapeHtml(r.entity_cnpj_cpf)}</span>` : ''}
                ${r.entity_phone ? `
                <span class="text-gray-400 dark:text-gray-600 font-normal">|</span>
                <span class="text-[11px] flex items-center gap-0.5">
                    <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                    ${escapeHtml(r.entity_phone)}
                </span>` : ''}
               </div>`
                : `<div class="mt-2 text-xs text-gray-400 dark:text-gray-500">Sem vínculo</div>`;
            return `
        <div class="bg-white dark:bg-slate-800 shadow-sm rounded-xl p-5 flex flex-col relative border border-gray-100 dark:border-slate-700 group">
            
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center z-10 pt-1">
                    <input type="checkbox" value="${escapeHtml(r.public_id)}" class="revenue-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800">
                    <span class="ml-2 text-xs font-mono font-medium text-gray-500 dark:text-gray-400">#${String(index + 1).padStart(4, '0')}</span>
                </div>

                <div class="flex space-x-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10 -mr-1 -mt-1">
                    <button type="button" class="relative send-whatsapp-btn p-1.5 text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:text-green-400 dark:hover:bg-green-950/30 rounded-lg transition-colors cursor-pointer" data-id="${escapeHtml(r.public_id)}" data-phone="${escapeHtml(r.customer_phone || '')}" title="Enviar por WhatsApp">
                        <svg class="h-4 w-4 pointer-events-none" fill="currentColor" viewBox="0 0 448 512">
                            <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L3 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
                        </svg>
                        ${(r.whatsapp_sent && Number(r.whatsapp_sent) > 0) ? `<span class="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-bold border border-white dark:border-slate-800 shadow-sm leading-none" title="Enviado ${Number(r.whatsapp_sent)}x por WhatsApp">${Number(r.whatsapp_sent)}</span>` : ''}
                    </button>
                    ${(r.payment_method === 'boleto' && r.billet_url) ? '' : (isOverdue ? `
                    <button type="button" class="open-receipt-btn p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer" data-id="${escapeHtml(r.public_id)}" title="Cobrar">
                        <span class="inline-flex h-4 w-4 items-center justify-center text-sm font-bold leading-none pointer-events-none">$</span>
                    </button>` : `
                    <button type="button" class="open-receipt-btn p-1.5 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/30 rounded-lg transition-colors cursor-pointer" data-id="${escapeHtml(r.public_id)}" title="Recibo">
                        <svg class="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </button>`)}
                    ${(r.payment_method === 'boleto' && r.billet_url) ? `
                        <button type="button" class="open-boleto-btn p-1.5 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/30 rounded-lg transition-colors cursor-pointer" data-id="${escapeHtml(r.public_id)}" data-nosso-numero="${escapeHtml(r.billet_url)}" title="Visualizar Boleto PDF">
                            <svg class="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                        </button>
                    ` : ''}
                    <button type="button" class="edit-btn p-1.5 text-gray-500 hover:text-brand-600 hover:bg-brand-50 dark:text-gray-400 dark:hover:text-brand-400 dark:hover:bg-brand-950/30 rounded-lg transition-colors cursor-pointer" data-id="${escapeHtml(r.public_id)}" title="Editar">
                        <svg class="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                </div>
            </div>

            <div class="flex-1 mt-0">
                <div class="flex justify-between items-start gap-2">
                    <h4 class="text-base font-bold text-gray-900 dark:text-gray-100 wrap-break-word flex-1 leading-tight pr-2">
                        <span>${translateDescription(r.description)}</span>
                        ${r.cdfilial ? `<span class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30 whitespace-nowrap align-middle">Filial: ${escapeHtml(r.cdfilial)}</span>` : ''}
                        ${r.pdv ? `<span class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-100 dark:border-amber-900/30 whitespace-nowrap align-middle">PDV: ${escapeHtml(r.pdv)}</span>` : ''}
                        ${r.solidcon_quitado ? `<span class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30 whitespace-nowrap align-middle" title="${r.solidcon_key ? `Código da Baixa Solidcon: #${escapeHtml(r.solidcon_key)}` : 'Baixado no Solidcon'}">Baixado no Solidcon${r.solidcon_key ? ` (#${escapeHtml(r.solidcon_key)})` : ''}</span>` : (r.solidcon_key ? `<span class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap align-middle" title="Código Solidcon: #${escapeHtml(r.solidcon_key)}">Solidcon: #${escapeHtml(r.solidcon_key)}</span>` : '')}
                        ${(r.customer_only_solidcon_baixa === 1 || r.customer_only_solidcon_baixa === true || r.only_solidcon_baixa === 1 || r.only_solidcon_baixa === true) ? `<span class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-100 dark:border-purple-900/30 whitespace-nowrap align-middle" title="Baixa manual no Keystone travada (Exclusiva Solidcon)">Baixa Solidcon</span>` : ''}
                        ${(r.customer_exempt_interest_fine === 1 || r.customer_exempt_interest_fine === true || r.exempt_interest_fine === 1 || r.exempt_interest_fine === true) ? `<span class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30 whitespace-nowrap align-middle" title="Cliente isento de cobrança de juros e multa por atraso">Isento Juros/Multa</span>` : ''}
                        ${(r.whatsapp_sent && Number(r.whatsapp_sent) > 0) ? `<button type="button" data-action="view-whatsapp-audit" data-public-id="${escapeHtml(r.public_id)}" class="ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 whitespace-nowrap align-middle shadow-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/60 cursor-pointer transition-colors" title="Enviado ${Number(r.whatsapp_sent)}x por WhatsApp - Clique para ver auditoria"><svg class="w-3 h-3 text-emerald-600 dark:text-emerald-400 inline shrink-0" fill="currentColor" viewBox="0 0 448 512"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L3 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>WhatsApp (${Number(r.whatsapp_sent)})</button>` : ''}
                    </h4>
                </div>
                
                <div class="mt-2 flex flex-col gap-1 items-start">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            ${escapeHtml(r.category_name || 'Geral')}
                        </span>
                        ${r.payment_method ? renderPaymentMethodLabel(r.payment_method, r.card_brand_name, r.billet_batch_generated, r.billet_url, r.pix_code, revenueStatus === 'paid', r.received_channel) : ''}
                        ${r.card_brand_name ? `
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-100 dark:border-orange-900/30">
                            Bandeira: ${escapeHtml(r.card_brand_name)}
                        </span>` : ''}
                        ${r.receivable_type_name ? `
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300 border border-slate-200 dark:border-slate-600/40">
                            Rec: ${escapeHtml(r.receivable_type_name)}
                        </span>` : ''}
                    </div>
                    <div class="mt-1">${statusBadge}</div>
                    ${entityLabel}
                </div>

                <div class="mt-4 grid grid-cols-2 gap-3">
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Vencimento:</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100 text-xs">${DateUtils.formatDate(r.date)}</span>
                    </div>
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Recebimento:</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100 text-xs">${formatReceivedAt(r)}</span>
                    </div>
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Dias Vencido:</span>
                        <span class="font-medium text-xs mt-0.5">${formatOverdueDaysBadge(r)}</span>
                    </div>
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Lançamento:</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100 text-xs">${DateUtils.formatDateTime(r.date_launch || r.created_at || r.date)}</span>
                    </div>
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300 col-span-2">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Conta:</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100 text-xs truncate" title="${escapeHtml(r.bank_account_name || '-')}">${escapeHtml(r.bank_account_name || '-')}</span>
                    </div>
                </div>

                <div class="mt-3.5 p-2.5 bg-gray-50 dark:bg-slate-700/40 rounded-xl border border-gray-100 dark:border-slate-700/70">
                    <div class="grid grid-cols-3 gap-1.5 text-center">
                        <div class="flex flex-col justify-center">
                            <span class="text-[10px] uppercase font-semibold text-gray-400 dark:text-gray-500 tracking-wider">Recebível</span>
                            <span class="text-xs font-bold text-gray-800 dark:text-gray-200 mt-0.5">${formatCurrency(originalAmount)}</span>
                        </div>
                        <div class="flex flex-col justify-center border-x border-gray-200 dark:border-slate-600/60 px-1">
                            <span class="text-[10px] uppercase font-semibold text-amber-600 dark:text-amber-400 tracking-wider">Multa + Juros</span>
                            ${(fineInterestToDisplay > 0 || intInfo.hasSolidconCashInterest) ? `
                                <span class="text-xs font-bold ${intInfo.hasSolidconCashInterest ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'} mt-0.5" title="${calc.isSimulated && !intInfo.hasSolidconCashInterest ? `Projeção diária (${calc.daysOverdue}d):\nMulta: ${formatCurrency(calc.fine)} | Juros: ${formatCurrency(calc.interest)}` : (intInfo.hasSolidconCashInterest ? 'Receita à vista de juros lançada no Solidcon' : `Multa: ${formatCurrency(calc.fine)} | Juros: ${formatCurrency(calc.interest)}`)}">
                                    +${formatCurrency(fineInterestToDisplay)}
                                </span>
                            ` : ((r.customer_exempt_interest_fine === 1 || r.customer_exempt_interest_fine === true || r.exempt_interest_fine === 1 || r.exempt_interest_fine === true) ? `
                                <span class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5" title="Cliente isento de juros e multa">Isento</span>
                            ` : `
                                <span class="text-xs font-bold text-gray-400 dark:text-gray-500 mt-0.5">R$ 0,00</span>
                            `)}
                            ${intInfo.hasSolidconCashInterest ? `
                                <span class="inline-flex items-center justify-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 whitespace-nowrap mt-0.5 mx-auto" title="${r.solidcon_interest_key ? `Receita à vista de juros gerada no Solidcon (Receita #${r.solidcon_interest_key})` : 'Receita à vista de juros gerada no Solidcon'}">
                                    <svg class="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                                    Solidcon (À Vista)${r.solidcon_interest_key ? ` #${r.solidcon_interest_key}` : ''}
                                </span>
                            ` : ''}
                        </div>
                        <div class="flex flex-col justify-center">
                            <span class="text-[10px] uppercase font-semibold text-emerald-600 dark:text-emerald-400 tracking-wider">${revenueStatus === 'paid' ? 'Recebido' : 'Total'}</span>
                            <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">${revenueStatus === 'paid' ? `+ ${formatCurrency(receivedAmount)}` : formatCurrency(originalAmount + calc.totalFineInterest)}</span>
                        </div>
                    </div>
                    ${(r.payment_method === 'credit' || r.payment_method === 'debit') ? `
                        <div class="mt-2 pt-1.5 border-t border-gray-200/60 dark:border-slate-600/40 flex justify-between items-center text-[11px] text-gray-500 dark:text-gray-400">
                            <span>Taxa: <b>${parseFloat(r.card_tax_rate) || 0}%</b></span>
                            <span>Líq: <b class="text-gray-800 dark:text-gray-200 font-semibold">${formatCurrency(parseFloat(r.card_tax_rate) > 0 ? r.amount * (1 - (parseFloat(r.card_tax_rate) || 0) / 100) : (r.net_amount !== undefined ? r.net_amount : r.amount))}</b></span>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
        `;
        }).join('');
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox)
            selectAllCheckbox.checked = false;
        updateSelectedCount();
    }
    function openModal() {
        g_editId = null;
        const form = document.getElementById('revenueForm');
        if (form)
            form.reset();
        updatePaymentMethodOptions();
        const container = document.getElementById('cardBrandContainer');
        if (container)
            container.classList.add('hidden');
        const cbSelect = document.getElementById('cardBrand');
        if (cbSelect)
            cbSelect.value = '';
        const cardConfigContainer = document.getElementById('cardConfigContainer');
        if (cardConfigContainer)
            cardConfigContainer.classList.add('hidden');
        const cardConfigEl = document.getElementById('cardConfig');
        if (cardConfigEl)
            cardConfigEl.innerHTML = '<option value="">Selecione a bandeira primeiro...</option>';
        setCurrencyValue('receivableValue', 0);
        setCurrencyValue('fineInterestValue', 0);
        setCurrencyValue('value', 0);
        const dateInput = document.getElementById('dueDate');
        if (dateInput) {
            dateInput.value = DateUtils.getTodayDateInputValue();
            g_previousDueDate = dateInput.value;
        }
        const dateLaunchInput = document.getElementById('dateLaunch');
        if (dateLaunchInput)
            dateLaunchInput.value = DateUtils.getCurrentDateTimeInputValue();
        const statusEl = document.getElementById('status');
        if (statusEl)
            statusEl.value = 'pending';
        const receivedAtEl = document.getElementById('receivedAt');
        if (receivedAtEl)
            receivedAtEl.value = '';
        const receivedAtContainer = document.getElementById('receivedAtContainer');
        if (receivedAtContainer)
            receivedAtContainer.classList.add('hidden');
        const receivedChannelEl = document.getElementById('receivedChannel');
        if (receivedChannelEl)
            receivedChannelEl.value = 'barcode';
        const receivedChannelContainer = document.getElementById('receivedChannelContainer');
        if (receivedChannelContainer)
            receivedChannelContainer.classList.add('hidden');
        const entityTypeSelect = document.getElementById('entityType');
        if (entityTypeSelect)
            entityTypeSelect.value = '';
        handleEntityTypeChange();
        const modalTitle = document.getElementById('modalTitle');
        if (modalTitle)
            modalTitle.textContent = 'Nova Receita';
        const whatsappCard = document.getElementById('revenueModalWhatsappCard');
        if (whatsappCard) {
            whatsappCard.style.display = 'none';
            whatsappCard.classList.add('hidden');
        }
        const cancelBilletContainer = document.getElementById('revenueCancelBilletContainer');
        if (cancelBilletContainer)
            cancelBilletContainer.classList.add('hidden');
        const cancelBilletCheckbox = document.getElementById('revenueCancelBilletCheckbox');
        if (cancelBilletCheckbox)
            cancelBilletCheckbox.checked = false;
        recalculateNetValue();
        document.getElementById('revenueModal').classList.remove('hidden');
    }
    window.closeModal = () => {
        g_editId = null;
        const cancelBilletContainer = document.getElementById('revenueCancelBilletContainer');
        if (cancelBilletContainer)
            cancelBilletContainer.classList.add('hidden');
        document.getElementById('revenueModal').classList.add('hidden');
    };
    window.closeDeleteModal = () => {
        document.getElementById('deleteModal').classList.add('hidden');
        g_deleteId = null;
    };
    window.closeBaixaModal = () => {
        document.getElementById('baixaModal')?.classList.add('hidden');
        g_baixaId = null;
    };
    window.closeBulkUpdateModal = () => {
        document.getElementById('bulkUpdateModal')?.classList.add('hidden');
    };
    function updateBaixaTotal() {
        const rev = revenuesData.find(r => r.public_id === g_baixaId);
        const totalEl = document.getElementById('baixaTotal');
        if (!rev || !totalEl)
            return;
        const originalAmount = rev.original_amount !== null && rev.original_amount !== undefined ? Number(rev.original_amount) : (Number(rev.amount) || 0);
        const fine = getNumberInputValue('baixaFine');
        const interest = getNumberInputValue('baixaInterest');
        totalEl.textContent = formatCurrency(originalAmount + fine + interest);
    }
    function openBaixaModal(rev) {
        if (rev.customer_only_solidcon_baixa === 1 || rev.customer_only_solidcon_baixa === true || rev.only_solidcon_baixa === 1 || rev.only_solidcon_baixa === true) {
            UI.showAlert('alertMessage', 'Este cliente está configurado para baixa exclusiva via Solidcon. A baixa manual no Keystone não é permitida.', 'warning');
            return;
        }
        g_baixaId = rev.public_id;
        const originalAmount = rev.original_amount !== null && rev.original_amount !== undefined ? Number(rev.original_amount) : (Number(rev.amount) || 0);
        const descEl = document.getElementById('baixaDescription');
        const amountEl = document.getElementById('baixaAmount');
        const customerEl = document.getElementById('baixaCustomer');
        const dueDateEl = document.getElementById('baixaDueDate');
        const dateEl = document.getElementById('baixaDate');
        const fineEl = document.getElementById('baixaFine');
        const interestEl = document.getElementById('baixaInterest');
        if (descEl)
            descEl.textContent = translateDescription(rev.description) || '-';
        if (amountEl)
            amountEl.textContent = formatCurrency(originalAmount);
        if (customerEl)
            customerEl.textContent = rev.customer_name || 'Sem cliente vinculado';
        if (dueDateEl)
            dueDateEl.textContent = DateUtils.formatDate(rev.date);
        if (dateEl)
            dateEl.value = getCurrentDateTimeInputValue();
        const currentDateVal = dateEl ? dateEl.value : null;
        const calc = calculateRevenueFineAndInterest(rev, currentDateVal);
        const isCustomerExempt = rev.customer_exempt_interest_fine === 1 || rev.customer_exempt_interest_fine === true || rev.exempt_interest_fine === 1 || rev.exempt_interest_fine === true;
        const exemptBadgeEl = document.getElementById('baixaExemptInterestBadge');
        if (exemptBadgeEl) {
            exemptBadgeEl.style.display = isCustomerExempt ? 'inline-flex' : 'none';
        }
        const solidconBadgeEl = document.getElementById('baixaSolidconBadge');
        if (solidconBadgeEl) {
            if (rev.solidcon_key) {
                solidconBadgeEl.textContent = `Cód. Baixa Solidcon: #${rev.solidcon_key}`;
                solidconBadgeEl.style.display = 'inline-flex';
            }
            else {
                solidconBadgeEl.style.display = 'none';
            }
        }
        const initialFine = isRevenuePaid(rev)
            ? Number(rev.fine || 0)
            : (calc.fine > 0 ? Number(calc.fine.toFixed(2)) : 0);
        const initialInterest = isRevenuePaid(rev)
            ? Number(rev.interest || 0)
            : (calc.interest > 0 ? Number(calc.interest.toFixed(2)) : 0);
        if (fineEl)
            fineEl.value = String(initialFine);
        if (interestEl)
            interestEl.value = String(initialInterest);
        const baixaBankSelect = document.getElementById('baixaBankSelect');
        if (baixaBankSelect) {
            baixaBankSelect.innerHTML = '';
            banksData.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.public_id;
                opt.textContent = b.name;
                baixaBankSelect.appendChild(opt);
            });
            baixaBankSelect.value = rev.bank_account_public_id || (banksData[0]?.public_id || '');
        }
        const hasBoleto = !!rev.billet_url || !!rev.barcode;
        const baixaPaymentMethod = document.getElementById('baixaPaymentMethod');
        if (baixaPaymentMethod) {
            baixaPaymentMethod.value = rev.payment_method || (hasBoleto ? 'boleto' : (rev.pix_code ? 'pix' : 'transfer'));
        }
        const effectiveMethod = baixaPaymentMethod ? baixaPaymentMethod.value : (rev.payment_method || (hasBoleto ? 'boleto' : (rev.pix_code ? 'pix' : 'transfer')));
        const isBoleto = effectiveMethod === 'boleto';
        const baixaChannelContainer = document.getElementById('baixaChannelContainer');
        if (baixaChannelContainer) {
            if (isBoleto && hasBoleto) {
                baixaChannelContainer.classList.remove('hidden');
            }
            else {
                baixaChannelContainer.classList.add('hidden');
            }
        }
        const baixaCancelBilletContainer = document.getElementById('baixaCancelBilletContainer');
        const baixaCancelBilletCheckbox = document.getElementById('baixaCancelBilletCheckbox');
        if (baixaCancelBilletContainer) {
            if (hasBoleto && !isBoleto) {
                baixaCancelBilletContainer.classList.remove('hidden');
                if (baixaCancelBilletCheckbox)
                    baixaCancelBilletCheckbox.checked = true;
            }
            else {
                baixaCancelBilletContainer.classList.add('hidden');
                if (baixaCancelBilletCheckbox)
                    baixaCancelBilletCheckbox.checked = false;
            }
        }
        const barcodeRadio = document.getElementById('baixaChannelBarcode');
        const pixRadio = document.getElementById('baixaChannelPix');
        if (rev.received_channel === 'pix_qr') {
            if (pixRadio)
                pixRadio.checked = true;
        }
        else {
            if (barcodeRadio)
                barcodeRadio.checked = true;
        }
        updateBaixaTotal();
        document.getElementById('baixaModal')?.classList.remove('hidden');
    }
    function copyToClipboard(value) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(value);
        }
        const input = document.createElement('textarea');
        input.value = value;
        input.setAttribute('readonly', '');
        input.style.position = 'absolute';
        input.style.left = '-9999px';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        return Promise.resolve();
    }
    async function copyReceiptQrCode(publicId, button) {
        let url = '/api/v1/finance/revenues/' + publicId + '/receipt';
        const jwtToken = getAuthToken();
        if (jwtToken) {
            url += '?token=' + encodeURIComponent(jwtToken);
        }
        const originalHtml = button.innerHTML;
        button.textContent = 'Copiando...';
        button.setAttribute('disabled', 'true');
        try {
            const response = await fetch(url);
            if (!response.ok)
                throw new Error('Nao foi possivel carregar o recibo');
            const receiptHtml = await response.text();
            const receiptDocument = new DOMParser().parseFromString(receiptHtml, 'text/html');
            const qrCodeKey = receiptDocument.querySelector('[data-copy-value]')?.getAttribute('data-copy-value') || '';
            if (!qrCodeKey)
                throw new Error('Chave QR Code nao encontrada');
            await copyToClipboard(qrCodeKey);
            button.textContent = 'Copiado';
            setTimeout(() => { button.innerHTML = originalHtml; }, 2000);
        }
        catch (err) {
            button.innerHTML = originalHtml;
            UI.showAlert('alertMessage', err.message || 'Erro ao copiar chave QR Code', 'error');
        }
        finally {
            button.removeAttribute('disabled');
        }
    }
    async function openWhatsappModal(id, phone) {
        g_whatsappId = id;
        const input = document.getElementById('whatsappPhoneInput');
        if (input) {
            input.value = phone || '';
        }
        const errDiv = document.getElementById('whatsappModalError');
        if (errDiv) {
            errDiv.textContent = '';
            errDiv.classList.add('hidden');
        }
        const modal = document.getElementById('whatsappModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
        try {
            const statusRes = await api('/finance/whatsapp/status', { method: 'GET' });
            if (statusRes?.data && !statusRes.data.isConnected && errDiv) {
                errDiv.innerHTML = `
                <div class="flex flex-col gap-1.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs">
                    <div class="flex items-center gap-1.5 font-bold">
                        <svg class="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                        <span>WhatsApp Desconectado</span>
                    </div>
                    <span>Conecte o WhatsApp Business por QR code antes de disparar a cobrança.</span>
                    <a href="/pages/whatsapp-config.html" target="_blank" class="inline-flex items-center gap-1 font-bold text-brand-600 dark:text-brand-400 hover:underline mt-1">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                        Clique aqui para Conectar seu WhatsApp
                    </a>
                </div>
            `;
                errDiv.classList.remove('hidden');
            }
        }
        catch (_) { }
    }
    function closeWhatsappModal() {
        g_whatsappId = null;
        const modal = document.getElementById('whatsappModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        const errDiv = document.getElementById('whatsappModalError');
        if (errDiv) {
            errDiv.textContent = '';
            errDiv.classList.add('hidden');
        }
        const spinner = document.getElementById('whatsappSendSpinner');
        if (spinner) {
            spinner.classList.add('hidden');
            spinner.classList.remove('inline-block');
        }
        const btn = document.getElementById('btnConfirmWhatsappSend');
        if (btn) {
            btn.removeAttribute('disabled');
        }
    }
    async function handleSendWhatsapp() {
        if (!g_whatsappId)
            return;
        const input = document.getElementById('whatsappPhoneInput');
        const phone = input ? input.value.trim() : '';
        const btn = document.getElementById('btnConfirmWhatsappSend');
        const spinner = document.getElementById('whatsappSendSpinner');
        const errDiv = document.getElementById('whatsappModalError');
        if (errDiv) {
            errDiv.textContent = '';
            errDiv.classList.add('hidden');
        }
        if (btn)
            btn.setAttribute('disabled', 'true');
        if (spinner) {
            spinner.classList.remove('hidden');
            spinner.classList.add('inline-block');
        }
        try {
            await api(`/finance/revenues/${g_whatsappId}/send-whatsapp`, {
                method: 'POST',
                body: JSON.stringify({ phone })
            });
            if (typeof UI !== 'undefined' && UI.showAlert) {
                UI.showAlert('alertMessage', 'Cobrança enviada com sucesso!', 'success');
            }
            closeWhatsappModal();
            await fetchRevenues();
        }
        catch (error) {
            const errMsg = error.message || 'Falha ao enviar por WhatsApp';
            if (errDiv) {
                if (errMsg.includes('QR code') || errMsg.includes('Conecte o WhatsApp')) {
                    errDiv.innerHTML = `
                    <div class="flex flex-col gap-2">
                        <span>${errMsg}</span>
                        <a href="/pages/whatsapp-config.html" target="_blank" class="inline-flex items-center gap-1.5 font-bold text-brand-600 dark:text-brand-400 hover:underline">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                            Clique aqui para Conectar seu WhatsApp
                        </a>
                    </div>
                `;
                }
                else {
                    errDiv.textContent = errMsg;
                }
                errDiv.classList.remove('hidden');
            }
            else if (typeof UI !== 'undefined' && UI.showAlert) {
                UI.showAlert('alertMessage', errMsg, 'error');
            }
            if (btn)
                btn.removeAttribute('disabled');
            if (spinner)
                spinner.classList.add('hidden');
        }
    }
    document.addEventListener('click', (e) => {
        const dupBtn = e.target.closest('.duplicate-btn');
        const editBtn = e.target.closest('.edit-btn');
        const delBtn = e.target.closest('.delete-btn');
        const baixaBtn = e.target.closest('.baixa-btn');
        const solidconDetailsBtn = e.target?.closest('.btn-solidcon-details');
        if (solidconDetailsBtn) {
            e.preventDefault();
            e.stopPropagation();
            const id = solidconDetailsBtn.getAttribute('data-id');
            if (id)
                openSolidconDetailsModal(id);
            return;
        }
        if (baixaBtn) {
            e.preventDefault();
            e.stopPropagation();
            const id = baixaBtn.getAttribute('data-id');
            const rev = revenuesData.find(r => r.public_id === id);
            if (rev)
                openBaixaModal(rev);
        }
        if (dupBtn) {
            const id = dupBtn.getAttribute('data-id');
            const rev = revenuesData.find(r => r.public_id === id);
            if (!rev)
                return;
            g_editId = null;
            document.getElementById('revenueForm').reset();
            document.getElementById('description').value = translateDescription(rev.description) + ' (Cópia)';
            const fineSaved = (rev.fine !== null && rev.fine !== undefined) ? Number(rev.fine) : 0;
            const interestSaved = (rev.interest !== null && rev.interest !== undefined) ? Number(rev.interest) : 0;
            const calc = calculateRevenueFineAndInterest(rev);
            const fineAmt = (fineSaved > 0 || interestSaved > 0)
                ? (fineSaved + interestSaved)
                : (calc.totalFineInterest > 0 ? Number(calc.totalFineInterest.toFixed(2)) : 0);
            let origAmt = (rev.original_amount !== null && rev.original_amount !== undefined) ? Number(rev.original_amount) : 0;
            if (!origAmt) {
                if (fineAmt > 0 && Number(rev.amount) > fineAmt) {
                    origAmt = Number(rev.amount) - fineAmt;
                }
                else {
                    origAmt = Number(rev.amount) || 0;
                }
            }
            setCurrencyValue('receivableValue', origAmt);
            setCurrencyValue('fineInterestValue', fineAmt);
            setCurrencyValue('value', origAmt + fineAmt);
            const dueDateInput = document.getElementById('dueDate');
            if (dueDateInput) {
                dueDateInput.value = DateUtils.toDateInputValue(rev.date);
                g_previousDueDate = dueDateInput.value;
            }
            const dateLaunchInput = document.getElementById('dateLaunch');
            if (dateLaunchInput)
                dateLaunchInput.value = DateUtils.getCurrentDateTimeInputValue();
            document.getElementById('category').value = rev.category_public_id || '';
            document.getElementById('bankSelect').value = rev.bank_account_public_id || '';
            const costCenterEl = document.getElementById('costCenter');
            if (costCenterEl)
                costCenterEl.value = rev.cost_center_public_id || '';
            updatePaymentMethodOptions();
            const entityTypeSelect = document.getElementById('entityType');
            if (entityTypeSelect) {
                entityTypeSelect.value = rev.entity_type || '';
            }
            handleEntityTypeChange(rev.entity_public_id || undefined);
            const paymentEl = document.getElementById('paymentMethod');
            if (paymentEl)
                paymentEl.value = rev.payment_method || '';
            const container = document.getElementById('cardBrandContainer');
            if (container) {
                if (rev.payment_method === 'credit' || rev.payment_method === 'debit') {
                    container.classList.remove('hidden');
                    updateCardBrandOptions();
                }
                else {
                    container.classList.add('hidden');
                }
            }
            const cbSelect = document.getElementById('cardBrand');
            if (cbSelect)
                cbSelect.value = rev.card_brand_public_id || '';
            updateCardConfigOptions();
            const cardConfigEl = document.getElementById('cardConfig');
            if (cardConfigEl)
                cardConfigEl.value = rev.card_configuration_public_id || '';
            const statusEl = document.getElementById('status');
            if (statusEl)
                statusEl.value = 'pending';
            const receivedAtEl = document.getElementById('receivedAt');
            const receivedAtContainer = document.getElementById('receivedAtContainer');
            if (receivedAtContainer)
                receivedAtContainer.classList.add('hidden');
            if (receivedAtEl)
                receivedAtEl.value = '';
            const receivedChannelEl = document.getElementById('receivedChannel');
            if (receivedChannelEl)
                receivedChannelEl.value = 'barcode';
            const receivedChannelContainer = document.getElementById('receivedChannelContainer');
            if (receivedChannelContainer)
                receivedChannelContainer.classList.add('hidden');
            const modalTitle = document.getElementById('modalTitle');
            if (modalTitle)
                modalTitle.textContent = 'Duplicar Receita';
            const dupCancelBilletContainer = document.getElementById('revenueCancelBilletContainer');
            if (dupCancelBilletContainer)
                dupCancelBilletContainer.classList.add('hidden');
            const dupCancelBilletCheckbox = document.getElementById('revenueCancelBilletCheckbox');
            if (dupCancelBilletCheckbox)
                dupCancelBilletCheckbox.checked = false;
            recalculateNetValue();
            document.getElementById('revenueModal').classList.remove('hidden');
        }
        if (editBtn) {
            const id = editBtn.getAttribute('data-id');
            const rev = revenuesData.find(r => r.public_id === id);
            if (!rev)
                return;
            g_editId = id;
            document.getElementById('revenueForm').reset();
            document.getElementById('description').value = translateDescription(rev.description);
            const fineSaved = (rev.fine !== null && rev.fine !== undefined) ? Number(rev.fine) : 0;
            const interestSaved = (rev.interest !== null && rev.interest !== undefined) ? Number(rev.interest) : 0;
            const calc = calculateRevenueFineAndInterest(rev);
            const fineAmt = isRevenuePaid(rev)
                ? (fineSaved + interestSaved)
                : ((fineSaved > 0 || interestSaved > 0)
                    ? (fineSaved + interestSaved)
                    : (calc.totalFineInterest > 0 ? Number(calc.totalFineInterest.toFixed(2)) : 0));
            let origAmt = (rev.original_amount !== null && rev.original_amount !== undefined) ? Number(rev.original_amount) : 0;
            if (!origAmt) {
                if (fineAmt > 0 && Number(rev.amount) > fineAmt) {
                    origAmt = Number(rev.amount) - fineAmt;
                }
                else {
                    origAmt = Number(rev.amount) || 0;
                }
            }
            setCurrencyValue('receivableValue', origAmt);
            setCurrencyValue('fineInterestValue', fineAmt);
            setCurrencyValue('value', origAmt + fineAmt);
            const dueDateInput = document.getElementById('dueDate');
            if (dueDateInput) {
                dueDateInput.value = DateUtils.toDateInputValue(rev.date);
                g_previousDueDate = dueDateInput.value;
            }
            const dateLaunchInput = document.getElementById('dateLaunch');
            if (dateLaunchInput)
                dateLaunchInput.value = DateUtils.toDateTimeInputValue(rev.date_launch || rev.created_at || rev.date);
            document.getElementById('category').value = rev.category_public_id || '';
            document.getElementById('bankSelect').value = rev.bank_account_public_id || '';
            const costCenterEl = document.getElementById('costCenter');
            if (costCenterEl)
                costCenterEl.value = rev.cost_center_public_id || '';
            updatePaymentMethodOptions();
            const entityTypeSelect = document.getElementById('entityType');
            if (entityTypeSelect) {
                entityTypeSelect.value = rev.entity_type || '';
            }
            handleEntityTypeChange(rev.entity_public_id || undefined);
            const paymentEl = document.getElementById('paymentMethod');
            if (paymentEl)
                paymentEl.value = rev.payment_method || '';
            const hasBoleto = !!rev.billet_url || !!rev.barcode;
            const editCancelBilletContainer = document.getElementById('revenueCancelBilletContainer');
            const editCancelBilletCheckbox = document.getElementById('revenueCancelBilletCheckbox');
            if (editCancelBilletContainer) {
                if (hasBoleto && rev.payment_method !== 'boleto') {
                    editCancelBilletContainer.classList.remove('hidden');
                    if (editCancelBilletCheckbox)
                        editCancelBilletCheckbox.checked = true;
                }
                else {
                    editCancelBilletContainer.classList.add('hidden');
                    if (editCancelBilletCheckbox)
                        editCancelBilletCheckbox.checked = false;
                }
            }
            const container = document.getElementById('cardBrandContainer');
            if (container) {
                if (rev.payment_method === 'credit' || rev.payment_method === 'debit') {
                    container.classList.remove('hidden');
                    updateCardBrandOptions();
                }
                else {
                    container.classList.add('hidden');
                }
            }
            const cbSelect = document.getElementById('cardBrand');
            if (cbSelect)
                cbSelect.value = rev.card_brand_public_id || '';
            updateCardConfigOptions();
            const cardConfigEl = document.getElementById('cardConfig');
            if (cardConfigEl)
                cardConfigEl.value = rev.card_configuration_public_id || '';
            const statusEl = document.getElementById('status');
            if (statusEl)
                statusEl.value = rev.status || 'paid';
            const receivedAtEl = document.getElementById('receivedAt');
            const receivedAtContainer = document.getElementById('receivedAtContainer');
            const receivedChannelEl = document.getElementById('receivedChannel');
            const receivedChannelContainer = document.getElementById('receivedChannelContainer');
            if (statusEl && statusEl.value === 'paid') {
                if (receivedAtContainer)
                    receivedAtContainer.classList.remove('hidden');
                if (receivedAtEl)
                    receivedAtEl.value = toDateTimeInputValue(rev.received_at);
                if (rev.payment_method === 'boleto') {
                    if (receivedChannelContainer)
                        receivedChannelContainer.classList.remove('hidden');
                    if (receivedChannelEl)
                        receivedChannelEl.value = rev.received_channel || 'barcode';
                }
                else {
                    if (receivedChannelContainer)
                        receivedChannelContainer.classList.add('hidden');
                    if (receivedChannelEl)
                        receivedChannelEl.value = 'barcode';
                }
            }
            else {
                if (receivedAtContainer)
                    receivedAtContainer.classList.add('hidden');
                if (receivedAtEl)
                    receivedAtEl.value = '';
                if (receivedChannelContainer)
                    receivedChannelContainer.classList.add('hidden');
                if (receivedChannelEl)
                    receivedChannelEl.value = 'barcode';
            }
            const modalTitle = document.getElementById('modalTitle');
            if (modalTitle)
                modalTitle.textContent = 'Editar Receita';
            const whatsappCard = document.getElementById('revenueModalWhatsappCard');
            if (whatsappCard) {
                whatsappCard.style.display = 'flex';
                whatsappCard.classList.remove('hidden');
                const titleEl = document.getElementById('revenueModalWhatsappTitle');
                const subEl = document.getElementById('revenueModalWhatsappSubtitle');
                const btnView = document.getElementById('revenueModalBtnViewAudit');
                const btnSend = document.getElementById('revenueModalBtnSendWhatsapp');
                const sentCount = Number(rev.whatsapp_sent || 0);
                const phone = rev.customer_phone || rev.entity_phone || '';
                if (sentCount > 0) {
                    if (titleEl)
                        titleEl.textContent = `Disparos WhatsApp: Enviado (${sentCount}x)`;
                    if (subEl)
                        subEl.textContent = phone ? `Último envio registrado com sucesso para: ${phone}` : `Enviado ${sentCount}x para o cliente.`;
                    if (btnView) {
                        btnView.classList.remove('hidden');
                        btnView.onclick = (ev) => {
                            ev.preventDefault();
                            openRevenueWhatsappAuditModal(rev.public_id);
                        };
                    }
                    if (btnSend) {
                        btnSend.textContent = 'Enviar Novamente';
                        btnSend.onclick = (ev) => {
                            ev.preventDefault();
                            openWhatsappModal(rev.public_id, phone);
                        };
                    }
                }
                else {
                    if (titleEl)
                        titleEl.textContent = 'Disparos WhatsApp: Não enviado';
                    if (subEl)
                        subEl.textContent = phone ? `Pronto para disparo para: ${phone}` : 'Nenhum envio registrado até o momento.';
                    if (btnView) {
                        btnView.classList.add('hidden');
                    }
                    if (btnSend) {
                        btnSend.textContent = 'Enviar por WhatsApp';
                        btnSend.onclick = (ev) => {
                            ev.preventDefault();
                            openWhatsappModal(rev.public_id, phone);
                        };
                    }
                }
            }
            recalculateNetValue();
            document.getElementById('revenueModal').classList.remove('hidden');
        }
        if (delBtn) {
            e.preventDefault();
            e.stopPropagation();
            g_deleteId = delBtn.getAttribute('data-id');
            document.getElementById('deleteModal').classList.remove('hidden');
        }
        const genBilletBtn = e.target.closest('.generate-billet-btn');
        if (genBilletBtn) {
            e.preventDefault();
            e.stopPropagation();
            const id = genBilletBtn.getAttribute('data-id');
            generateBillet(id, genBilletBtn);
        }
        const copyPixBtn = e.target.closest('.copy-pix-btn');
        if (copyPixBtn) {
            e.preventDefault();
            e.stopPropagation();
            const pixCode = copyPixBtn.getAttribute('data-pix');
            if (pixCode) {
                copyToClipboard(pixCode).then(() => {
                    const originalHtml = copyPixBtn.innerHTML;
                    copyPixBtn.innerHTML = '<svg class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg> Copiado';
                    setTimeout(() => { copyPixBtn.innerHTML = originalHtml; }, 2000);
                });
            }
        }
        const openPdfBtn = e.target.closest('.open-pdf-btn');
        if (openPdfBtn) {
            e.preventDefault();
            e.stopPropagation();
            let url = openPdfBtn.getAttribute('data-url');
            const pubId = openPdfBtn.getAttribute('data-id');
            if (url && url.startsWith('bancointer_pdf_')) {
                const nossoNumero = url.replace('bancointer_pdf_', '');
                openBoletoModal(pubId, nossoNumero);
                return;
            }
            if (pubId && !url) {
                openReceiptModal(pubId);
                return;
            }
            if (url) {
                const jwtToken = getAuthToken();
                if (jwtToken) {
                    url += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(jwtToken);
                }
                const pdfIframe = document.getElementById('pdfIframe');
                const printPdfBtn = document.getElementById('printPdfBtn');
                const pdfModalTitleText = document.getElementById('pdfModalTitleText');
                if (pdfIframe) {
                    pdfIframe.srcdoc = '';
                    pdfIframe.src = url;
                }
                if (printPdfBtn)
                    printPdfBtn.classList.add('hidden');
                if (pdfModalTitleText)
                    pdfModalTitleText.textContent = 'Visualizar Boleto PDF';
                document.getElementById('pdfModal')?.classList.remove('hidden');
            }
        }
        const auditBtn = e.target.closest('[data-action="view-whatsapp-audit"]');
        if (auditBtn) {
            e.preventDefault();
            e.stopPropagation();
            const pubId = auditBtn.getAttribute('data-public-id');
            if (pubId) {
                openRevenueWhatsappAuditModal(pubId);
            }
            return;
        }
        const sendWhatsappBtn = e.target.closest('.send-whatsapp-btn');
        if (sendWhatsappBtn) {
            e.preventDefault();
            e.stopPropagation();
            const pubId = sendWhatsappBtn.getAttribute('data-id');
            const phone = sendWhatsappBtn.getAttribute('data-phone') || '';
            if (pubId) {
                openWhatsappModal(pubId, phone);
            }
            return;
        }
        const openReceiptBtn = e.target.closest('.open-receipt-btn');
        if (openReceiptBtn) {
            e.preventDefault();
            e.stopPropagation();
            const pubId = openReceiptBtn.getAttribute('data-id');
            if (pubId) {
                if (openReceiptBtn.getAttribute('data-copy-qr-code') === 'true') {
                    copyReceiptQrCode(pubId, openReceiptBtn);
                    return;
                }
                openReceiptModal(pubId);
            }
        }
        else {
            const openBoletoBtn = e.target.closest('.open-boleto-btn');
            const cancelBoletoBtn = e.target.closest('.cancel-boleto-btn');
            const syncBoletoBtn = e.target.closest('.sync-boleto-btn');
            if (openBoletoBtn) {
                e.preventDefault();
                e.stopPropagation();
                const pubId = openBoletoBtn.getAttribute('data-id');
                const nossoNumero = openBoletoBtn.getAttribute('data-nosso-numero');
                if (pubId) {
                    if (nossoNumero && nossoNumero.trim() !== '') {
                        openBoletoModal(pubId, nossoNumero);
                    }
                    else {
                        if (confirm('Esta receita ainda não possui boleto gerado no banco. Deseja emitir agora?')) {
                            // Faz a emissão
                            api('/finance/revenues/' + pubId + '/generate-billet', {
                                method: 'POST'
                            })
                                .then(async (data) => {
                                if (data && data.status === 'success') {
                                    let whatsappNotice = ' O envio via WhatsApp está programado para disparar em 30 segundos.';
                                    try {
                                        const statusRes = await api('/finance/whatsapp/status', { method: 'GET' });
                                        if (!statusRes?.data?.isConnected) {
                                            whatsappNotice = ' (Aviso: WhatsApp desconectado. Conecte em Configurações > WhatsApp para efetuar o disparo automático).';
                                        }
                                    }
                                    catch (_) { }
                                    window.UI.showAlert('alertMessage', `Boleto gerado com sucesso!${whatsappNotice}`, 'success');
                                    fetchRevenues();
                                }
                                else {
                                    window.UI.showAlert('alertMessage', 'Erro: ' + (data?.message || 'Falha ao gerar boleto'), 'error');
                                }
                            })
                                .catch(err => {
                                window.UI.showAlert('alertMessage', 'Erro de conexão: ' + err.message, 'error');
                            });
                        }
                    }
                }
            }
            else if (cancelBoletoBtn) {
                e.preventDefault();
                e.stopPropagation();
                const pubId = cancelBoletoBtn.getAttribute('data-id');
                if (pubId && confirm('Deseja realmente cancelar este boleto no banco? Esta ação não pode ser desfeita.')) {
                    api('/finance/revenues/batch-cancel-billets', {
                        method: 'POST',
                        body: JSON.stringify({ ids: [pubId] })
                    })
                        .then(data => {
                        if (data && data.status === 'success') {
                            window.UI.showAlert('alertMessage', 'Boleto cancelado com sucesso!', 'success');
                            fetchRevenues();
                        }
                        else {
                            window.UI.showAlert('alertMessage', 'Erro ao cancelar: ' + (data?.message || 'Falha ao cancelar'), 'error');
                        }
                    })
                        .catch(err => {
                        window.UI.showAlert('alertMessage', 'Erro de conexão: ' + err.message, 'error');
                    });
                }
            }
            else if (syncBoletoBtn) {
                e.preventDefault();
                e.stopPropagation();
                const pubId = syncBoletoBtn.getAttribute('data-id');
                if (pubId) {
                    const originalHtml = syncBoletoBtn.innerHTML;
                    syncBoletoBtn.innerHTML = '...';
                    syncBoletoBtn.setAttribute('disabled', 'true');
                    api('/finance/revenues/' + pubId + '/sync-boleto-status', {
                        method: 'POST'
                    })
                        .then(data => {
                        if (data && data.status === 'success') {
                            const situacao = data.situacao || 'Desconhecido';
                            window.UI.showAlert('alertMessage', `Status do boleto sincronizado com sucesso! Situação: ${situacao}`, 'success');
                            fetchRevenues();
                        }
                        else {
                            window.UI.showAlert('alertMessage', 'Erro ao sincronizar boleto: ' + (data?.message || 'Erro desconhecido'), 'error');
                            syncBoletoBtn.innerHTML = originalHtml;
                            syncBoletoBtn.removeAttribute('disabled');
                        }
                    })
                        .catch(err => {
                        window.UI.showAlert('alertMessage', 'Erro de conexão: ' + err.message, 'error');
                        syncBoletoBtn.innerHTML = originalHtml;
                        syncBoletoBtn.removeAttribute('disabled');
                    });
                }
            }
        }
    });
    let _currentBlobUrl = null;
    let _currentBoletoPubId = null;
    async function openBoletoModal(pubId, nossoNumero) {
        const pdfModal = document.getElementById('pdfModal');
        const pdfIframe = document.getElementById('pdfIframe');
        const printPdfBtn = document.getElementById('printPdfBtn');
        const openPdfNewTabBtn = document.getElementById('openPdfNewTabBtn');
        const syncPdfBoletoBtn = document.getElementById('syncPdfBoletoBtn');
        const pdfModalTitleText = document.getElementById('pdfModalTitleText');
        _currentBoletoPubId = pubId;
        if (pdfModalTitleText)
            pdfModalTitleText.textContent = 'Boleto';
        if (printPdfBtn) {
            printPdfBtn.classList.remove('hidden');
            printPdfBtn.classList.add('inline-flex');
        }
        if (syncPdfBoletoBtn) {
            syncPdfBoletoBtn.classList.remove('hidden');
            syncPdfBoletoBtn.classList.add('inline-flex');
        }
        if (_currentBlobUrl) {
            URL.revokeObjectURL(_currentBlobUrl);
            _currentBlobUrl = null;
        }
        const token = getAuthToken();
        const directUrl = `/api/v1/finance/revenues/${pubId}/boleto-pdf?nossoNumero=${encodeURIComponent(nossoNumero)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
        if (openPdfNewTabBtn) {
            openPdfNewTabBtn.href = directUrl;
            openPdfNewTabBtn.classList.remove('hidden');
            openPdfNewTabBtn.classList.add('inline-flex');
        }
        if (pdfIframe) {
            pdfIframe.srcdoc = '';
            pdfIframe.src = directUrl;
        }
        if (pdfModal)
            pdfModal.classList.remove('hidden');
    }
    async function openReceiptModal(pubId) {
        const pdfModal = document.getElementById('pdfModal');
        const pdfIframe = document.getElementById('pdfIframe');
        const printPdfBtn = document.getElementById('printPdfBtn');
        const openPdfNewTabBtn = document.getElementById('openPdfNewTabBtn');
        const syncPdfBoletoBtn = document.getElementById('syncPdfBoletoBtn');
        const pdfModalTitleText = document.getElementById('pdfModalTitleText');
        _currentBoletoPubId = null;
        if (pdfModalTitleText)
            pdfModalTitleText.textContent = 'Recibo';
        if (printPdfBtn) {
            printPdfBtn.classList.remove('hidden');
            printPdfBtn.classList.add('inline-flex');
        }
        if (syncPdfBoletoBtn) {
            syncPdfBoletoBtn.classList.remove('inline-flex');
            syncPdfBoletoBtn.classList.add('hidden');
        }
        if (_currentBlobUrl) {
            URL.revokeObjectURL(_currentBlobUrl);
            _currentBlobUrl = null;
        }
        const token = getAuthToken();
        const directUrl = `/api/v1/finance/revenues/${pubId}/receipt${token ? `?token=${encodeURIComponent(token)}` : ''}`;
        if (openPdfNewTabBtn) {
            openPdfNewTabBtn.href = directUrl;
            openPdfNewTabBtn.classList.remove('hidden');
            openPdfNewTabBtn.classList.add('inline-flex');
        }
        if (pdfIframe) {
            pdfIframe.src = 'about:blank';
            pdfIframe.srcdoc = '';
        }
        if (pdfModal)
            pdfModal.classList.remove('hidden');
        try {
            const res = await fetch(directUrl, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || 'Erro ao carregar recibo');
            }
            const html = await res.text();
            if (pdfIframe) {
                pdfIframe.srcdoc = html;
            }
        }
        catch (err) {
            console.error('Erro ao carregar recibo:', err);
            if (pdfModal)
                pdfModal.classList.add('hidden');
            window.UI?.showAlert?.('alertMessage', err.message || 'Erro ao carregar recibo', 'error');
        }
    }
    document.getElementById('printPdfBtn')?.addEventListener('click', () => {
        const pdfIframe = document.getElementById('pdfIframe');
        if (pdfIframe?.contentWindow) {
            try {
                pdfIframe.contentWindow.focus();
                pdfIframe.contentWindow.print();
            }
            catch (e) {
                if (pdfIframe.src && pdfIframe.src !== 'about:blank') {
                    window.open(pdfIframe.src, '_blank');
                }
            }
        }
    });
    document.getElementById('syncPdfBoletoBtn')?.addEventListener('click', async () => {
        if (!_currentBoletoPubId)
            return;
        const syncBtn = document.getElementById('syncPdfBoletoBtn');
        if (!syncBtn)
            return;
        const originalHtml = syncBtn.innerHTML;
        syncBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-1.5 h-4 w-4 text-cyan-700 dark:text-cyan-300" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        Sincronizando...
    `;
        syncBtn.disabled = true;
        try {
            const data = await api(`/finance/revenues/${_currentBoletoPubId}/sync-boleto-status`, {
                method: 'POST'
            });
            if (data && data.status === 'success') {
                const situacao = data.situacao || 'Desconhecido';
                window.UI?.showAlert?.('alertMessage', `Status do boleto sincronizado com sucesso! Situação: ${situacao}`, 'success');
                fetchRevenues();
                if (situacao === 'PAGO' || situacao === 'RECEBIDO') {
                    closePdfModal();
                }
            }
            else {
                window.UI?.showAlert?.('alertMessage', 'Erro ao sincronizar boleto: ' + (data?.message || 'Erro desconhecido'), 'error');
            }
        }
        catch (err) {
            window.UI?.showAlert?.('alertMessage', 'Erro de conexão: ' + err.message, 'error');
        }
        finally {
            syncBtn.innerHTML = originalHtml;
            syncBtn.disabled = false;
        }
    });
    function closePdfModal() {
        const pdfModal = document.getElementById('pdfModal');
        if (pdfModal)
            pdfModal.classList.add('hidden');
        _currentBoletoPubId = null;
        if (_currentBlobUrl) {
            URL.revokeObjectURL(_currentBlobUrl);
            _currentBlobUrl = null;
        }
        const syncPdfBoletoBtn = document.getElementById('syncPdfBoletoBtn');
        if (syncPdfBoletoBtn) {
            syncPdfBoletoBtn.classList.remove('inline-flex');
            syncPdfBoletoBtn.classList.add('hidden');
        }
        const openPdfNewTabBtn = document.getElementById('openPdfNewTabBtn');
        if (openPdfNewTabBtn) {
            openPdfNewTabBtn.href = '#';
            openPdfNewTabBtn.classList.remove('inline-flex');
            openPdfNewTabBtn.classList.add('hidden');
        }
        const printPdfBtn = document.getElementById('printPdfBtn');
        if (printPdfBtn) {
            printPdfBtn.classList.remove('inline-flex');
            printPdfBtn.classList.add('hidden');
        }
        const pdfIframe = document.getElementById('pdfIframe');
        if (pdfIframe) {
            pdfIframe.src = 'about:blank';
            pdfIframe.srcdoc = '';
        }
    }
    document.getElementById('closePdfModalBtn')?.addEventListener('click', closePdfModal);
    document.getElementById('closePdfModalCross')?.addEventListener('click', closePdfModal);
    document.getElementById('closePdfModalBackdrop')?.addEventListener('click', closePdfModal);
    async function generateBillet(publicId, btnEl) {
        if (!publicId)
            return;
        const oldText = btnEl.textContent;
        btnEl.textContent = 'Gerando...';
        btnEl.disabled = true;
        try {
            await api(`/finance/revenues/${publicId}/generate-billet`, { method: 'POST' });
            let whatsappNotice = ' O envio via WhatsApp está programado para disparar em 30 segundos.';
            try {
                const statusRes = await api('/finance/whatsapp/status', { method: 'GET' });
                if (!statusRes?.data?.isConnected) {
                    whatsappNotice = ' (Aviso: WhatsApp desconectado. Conecte em Configurações > WhatsApp para efetuar o disparo automático).';
                }
            }
            catch (_) { }
            UI.showAlert('alertMessage', `Boleto gerado com sucesso!${whatsappNotice}`, 'success');
            fetchRevenues();
        }
        catch (err) {
            UI.showAlert('alertMessage', 'Erro ao gerar boleto: ' + err.message, 'error');
            btnEl.textContent = oldText;
            btnEl.disabled = false;
        }
    }
    // Select All Checkbox Logic
    document.addEventListener('change', (e) => {
        const target = e.target;
        if (target.id === 'selectAllCheckbox') {
            const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
            const container = document.getElementById(containerId);
            const checkboxes = container ? container.querySelectorAll('.revenue-checkbox') : [];
            checkboxes.forEach(cb => cb.checked = target.checked);
            updateSelectedCount();
        }
        if (target.classList.contains('revenue-checkbox')) {
            const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
            const container = document.getElementById(containerId);
            const checkboxes = container ? container.querySelectorAll('.revenue-checkbox') : [];
            const allChecked = Array.from(checkboxes).length > 0 && Array.from(checkboxes).every(cb => cb.checked);
            const selectAllCheckbox = document.getElementById('selectAllCheckbox');
            if (selectAllCheckbox)
                selectAllCheckbox.checked = allChecked;
            updateSelectedCount();
        }
    });
    function updateSelectedCount() {
        const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
        const container = document.getElementById(containerId);
        const allCheckboxes = container ? container.querySelectorAll('.revenue-checkbox') : [];
        const selected = container ? container.querySelectorAll('.revenue-checkbox:checked') : [];
        const selectedIds = Array.from(selected).map(cb => cb.value);
        const totalCount = allCheckboxes.length;
        const selectedCount = selectedIds.length;
        const isAllSelected = totalCount > 0 && selectedCount === totalCount;
        const batchActions = document.getElementById('batchActions');
        const btnBatchBaixa = document.getElementById('btnBatchBaixaRevenue');
        const btnTieAll = document.getElementById('btnOpenTieAllSolidconModal');
        const btnSyncAll = document.getElementById('btnSyncAll');
        if (batchActions) {
            if (selectedCount > 0) {
                batchActions.classList.remove('hidden');
                setTimeout(() => batchActions.classList.remove('opacity-0'), 10);
            }
            else {
                batchActions.classList.add('opacity-0');
                setTimeout(() => batchActions.classList.add('hidden'), 300);
            }
        }
        if (btnBatchBaixa) {
            if (selectedCount === 1) {
                const rev = revenuesData.find(r => r.public_id === selectedIds[0]);
                if (rev && rev.status !== 'paid') {
                    btnBatchBaixa.classList.remove('hidden');
                    btnBatchBaixa.classList.add('inline-flex');
                }
                else {
                    btnBatchBaixa.classList.add('hidden');
                    btnBatchBaixa.classList.remove('inline-flex');
                }
            }
            else {
                btnBatchBaixa.classList.add('hidden');
                btnBatchBaixa.classList.remove('inline-flex');
            }
        }
        if (btnTieAll) {
            if (isAllSelected) {
                btnTieAll.classList.remove('hidden');
                btnTieAll.classList.add('inline-flex');
            }
            else {
                btnTieAll.classList.add('hidden');
                btnTieAll.classList.remove('inline-flex');
            }
        }
        if (btnSyncAll) {
            if (isAllSelected) {
                btnSyncAll.classList.remove('hidden');
                btnSyncAll.classList.add('inline-flex');
            }
            else {
                btnSyncAll.classList.add('hidden');
                btnSyncAll.classList.remove('inline-flex');
            }
        }
    }
    function handleBatchBaixaRevenue() {
        const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
        const container = document.getElementById(containerId);
        const selected = container ? container.querySelectorAll('.revenue-checkbox:checked') : [];
        const selectedIds = Array.from(selected).map(cb => cb.value);
        if (selectedIds.length === 0) {
            UI.showAlert('alertMessage', 'Selecione uma receita para realizar a baixa.', 'warning');
            return;
        }
        if (selectedIds.length > 1) {
            UI.showAlert('alertMessage', 'A baixa individual só pode ser realizada para 1 receita selecionada.', 'warning');
            return;
        }
        const rev = revenuesData.find(r => r.public_id === selectedIds[0]);
        if (!rev) {
            UI.showAlert('alertMessage', 'Receita selecionada não encontrada.', 'error');
            return;
        }
        if (rev.status === 'paid') {
            UI.showAlert('alertMessage', 'Esta receita já está com status Recebido / Pago.', 'warning');
            return;
        }
        if (rev.customer_only_solidcon_baixa === 1 || rev.customer_only_solidcon_baixa === true || rev.only_solidcon_baixa === 1 || rev.only_solidcon_baixa === true) {
            UI.showAlert('alertMessage', 'Este cliente está configurado para baixa exclusiva via Solidcon. A baixa manual no Keystone não é permitida.', 'warning');
            return;
        }
        openBaixaModal(rev);
    }
    function clearCheckboxSelection() {
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox)
            selectAllCheckbox.checked = false;
        document.querySelectorAll('.revenue-checkbox').forEach(cb => cb.checked = false);
        updateSelectedCount();
    }
    async function handleBatchSendWhatsapp() {
        const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
        const container = document.getElementById(containerId);
        const selected = container ? container.querySelectorAll('.revenue-checkbox:checked') : [];
        const selectedIds = Array.from(selected).map(cb => cb.value);
        if (selectedIds.length === 0) {
            UI.showAlert('alertMessage', 'Selecione ao menos uma receita para disparar via WhatsApp.', 'warning');
            return;
        }
        // 1. Checa status da conexão do WhatsApp
        try {
            const statusRes = await api('/finance/whatsapp/status', { method: 'GET' });
            const isConnected = statusRes?.data?.isConnected;
            if (!isConnected) {
                const msgHtml = `
                <div class="flex flex-col gap-1.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs">
                    <div class="flex items-center gap-1.5 font-bold">
                        <svg class="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                        <span>Atenção: Nenhum WhatsApp está conectado no sistema!</span>
                    </div>
                    <span>Conecte o WhatsApp Business por QR code antes de realizar os envios de cobrança.</span>
                    <a href="/pages/whatsapp-config.html" target="_blank" class="inline-flex items-center gap-1.5 font-bold text-brand-600 dark:text-brand-400 hover:underline mt-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                        Clique aqui para Conectar seu WhatsApp
                    </a>
                </div>
            `;
                if (typeof UI !== 'undefined' && UI.showAlert) {
                    UI.showAlert('alertMessage', msgHtml, 'warning');
                }
                return;
            }
        }
        catch (statusErr) {
            console.warn('Erro ao verificar status do WhatsApp:', statusErr);
        }
        if (!confirm(`Deseja disparar cobranças via WhatsApp para as ${selectedIds.length} receitas selecionadas?`)) {
            return;
        }
        const btnBatch = document.getElementById('btnBatchSendWhatsapp');
        const btnModal = document.getElementById('btnBatchSendWhatsappModal');
        const oldBatchHtml = btnBatch ? btnBatch.innerHTML : '';
        const oldModalHtml = btnModal ? btnModal.innerHTML : '';
        const spinHtml = `<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        if (btnBatch) {
            btnBatch.innerHTML = `${spinHtml} Enviando...`;
            btnBatch.disabled = true;
        }
        if (btnModal) {
            btnModal.innerHTML = spinHtml;
            btnModal.disabled = true;
        }
        try {
            const response = await api('/finance/revenues/batch-send-whatsapp', {
                method: 'POST',
                body: JSON.stringify({ ids: selectedIds })
            });
            const successCount = response?.data?.success ?? 0;
            const failedCount = response?.data?.failed ?? 0;
            const errors = response?.data?.errors || [];
            if (failedCount === 0) {
                UI.showAlert('alertMessage', `${successCount} cobrança(s) enviada(s) com sucesso via WhatsApp!`, 'success');
            }
            else {
                const errorDetails = errors.slice(0, 3).join(' | ');
                UI.showAlert('alertMessage', `${successCount} enviada(s), ${failedCount} com falha. ${errorDetails}`, failedCount === selectedIds.length ? 'error' : 'warning');
            }
            window.closeBulkUpdateModal?.();
            clearCheckboxSelection();
            await fetchRevenues();
        }
        catch (err) {
            const errMsg = err.message || 'Erro ao realizar disparo em lote';
            if (errMsg.includes('QR code') || errMsg.includes('Conecte o WhatsApp') || errMsg.includes('conectado')) {
                const msgHtml = `
                <div class="flex flex-col gap-1.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs">
                    <div class="flex items-center gap-1.5 font-bold">
                        <svg class="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                        <span>Atenção: ${errMsg}</span>
                    </div>
                    <a href="/pages/whatsapp-config.html" target="_blank" class="inline-flex items-center gap-1.5 font-bold text-brand-600 dark:text-brand-400 hover:underline mt-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                        Clique aqui para Conectar seu WhatsApp
                    </a>
                </div>
            `;
                UI.showAlert('alertMessage', msgHtml, 'warning');
            }
            else {
                UI.showAlert('alertMessage', 'Erro no disparo em lote: ' + errMsg, 'error');
            }
        }
        finally {
            if (btnBatch) {
                btnBatch.innerHTML = oldBatchHtml;
                btnBatch.disabled = false;
            }
            if (btnModal) {
                btnModal.innerHTML = oldModalHtml;
                btnModal.disabled = false;
            }
        }
    }
    async function handleBatchGenerateBillet() {
        const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
        const container = document.getElementById(containerId);
        const selected = container ? container.querySelectorAll('.revenue-checkbox:checked') : [];
        const selectedIds = Array.from(selected).map(cb => cb.value);
        if (selectedIds.length === 0)
            return;
        if (!confirm(`Deseja gerar boletos para as ${selectedIds.length} receitas selecionadas?`))
            return;
        const btn = document.getElementById('btnBatchGenerateBillet');
        const oldHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = `<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
            btn.disabled = true;
        }
        try {
            await api('/finance/revenues/batch-generate-billets', {
                method: 'POST',
                body: JSON.stringify({ ids: selectedIds })
            });
            let whatsappNotice = ' O envio via WhatsApp está programado para disparar em 30 segundos.';
            try {
                const statusRes = await api('/finance/whatsapp/status', { method: 'GET' });
                if (!statusRes?.data?.isConnected) {
                    whatsappNotice = ' (Aviso: WhatsApp desconectado. Conecte em Configurações > WhatsApp para efetuar os disparos automáticos).';
                }
            }
            catch (_) { }
            UI.showAlert('alertMessage', `Boletos gerados com sucesso!${whatsappNotice}`, 'success');
            window.closeBulkUpdateModal?.();
            clearCheckboxSelection();
            fetchRevenues();
        }
        catch (err) {
            UI.showAlert('alertMessage', 'Erro ao gerar boletos em lote: ' + err.message, 'error');
        }
        finally {
            if (btn) {
                btn.innerHTML = oldHtml;
                btn.disabled = false;
            }
        }
    }
    async function handleBatchCancelBillet() {
        const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
        const container = document.getElementById(containerId);
        const selected = container ? container.querySelectorAll('.revenue-checkbox:checked') : [];
        const selectedIds = Array.from(selected).map(cb => cb.value);
        if (selectedIds.length === 0)
            return;
        if (!confirm(`Deseja cancelar boletos das ${selectedIds.length} receitas selecionadas?`))
            return;
        const btn = document.getElementById('btnBatchCancelBillet');
        const oldHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = `<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
            btn.disabled = true;
        }
        try {
            await api('/finance/revenues/batch-cancel-billets', {
                method: 'POST',
                body: JSON.stringify({ ids: selectedIds })
            });
            UI.showAlert('alertMessage', 'Boletos cancelados com sucesso!', 'success');
            window.closeBulkUpdateModal?.();
            clearCheckboxSelection();
            fetchRevenues();
        }
        catch (err) {
            UI.showAlert('alertMessage', 'Erro ao cancelar boletos em lote: ' + err.message, 'error');
        }
        finally {
            if (btn) {
                btn.innerHTML = oldHtml;
                btn.disabled = false;
            }
        }
    }
    async function handleBatchDeleteRevenue() {
        const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
        const container = document.getElementById(containerId);
        const selected = container ? container.querySelectorAll('.revenue-checkbox:checked') : [];
        const selectedIds = Array.from(selected).map(cb => cb.value);
        if (selectedIds.length === 0)
            return;
        if (!confirm(`Deseja excluir as ${selectedIds.length} receitas selecionadas?`))
            return;
        const btn = document.getElementById('btnBatchDeleteRevenue');
        const oldHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = `<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
            btn.disabled = true;
        }
        try {
            const res = await api('/finance/transactions/batch-delete', {
                method: 'POST',
                body: JSON.stringify({ ids: selectedIds })
            });
            const successCount = res?.data?.success || 0;
            const errorList = res?.data?.errors || [];
            if (errorList.length > 0) {
                UI.showAlert('alertMessage', `Excluídas ${successCount} receitas. Algumas falharam:\n${errorList.join('\n')}`, 'error');
            }
            else {
                UI.showAlert('alertMessage', 'Receitas excluídas com sucesso!', 'success');
            }
            window.closeBulkUpdateModal?.();
            clearCheckboxSelection();
            fetchRevenues();
        }
        catch (err) {
            UI.showAlert('alertMessage', 'Erro ao excluir receitas em lote: ' + err.message, 'error');
        }
        finally {
            if (btn) {
                btn.innerHTML = oldHtml;
                btn.disabled = false;
            }
        }
    }
    async function handleBatchUpdateRevenue() {
        console.log('[DEBUG] handleBatchUpdateRevenue started. currentView:', currentView);
        const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
        const container = document.getElementById(containerId);
        console.log('[DEBUG] containerId:', containerId, 'container found:', !!container);
        const selected = container ? container.querySelectorAll('.revenue-checkbox:checked') : [];
        const selectedIds = Array.from(selected).map(cb => cb.value);
        console.log('[DEBUG] selected count:', selected.length, 'selectedIds:', selectedIds);
        if (selectedIds.length === 0) {
            console.warn('[DEBUG] No items selected, returning.');
            return;
        }
        // Reset form and open modal
        const bulkUpdateForm = document.getElementById('bulkUpdateForm');
        if (bulkUpdateForm)
            bulkUpdateForm.reset();
        const countSpan = document.getElementById('bulkUpdateModalCount');
        if (countSpan)
            countSpan.textContent = selectedIds.length.toString();
        const modal = document.getElementById('bulkUpdateModal');
        console.log('[DEBUG] modal found:', !!modal);
        if (modal) {
            modal.classList.remove('hidden');
            console.log('[DEBUG] Removed hidden from modal. current classes:', modal.className);
        }
    }
    async function handleBatchDuplicateRevenue() {
        const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
        const container = document.getElementById(containerId);
        const selected = container ? container.querySelectorAll('.revenue-checkbox:checked') : [];
        const selectedIds = Array.from(selected).map(cb => cb.value);
        if (selectedIds.length === 0) {
            UI.showAlert('alertMessage', 'Selecione ao menos uma receita para duplicar', 'warning');
            return;
        }
        const countInput = document.getElementById('bulkUpdateDuplicateCount');
        const daysInput = document.getElementById('bulkUpdateDuplicateDays');
        const descInput = document.getElementById('bulkUpdateDuplicateDescription');
        const times = countInput ? parseInt(countInput.value, 10) : 1;
        const days = daysInput ? parseInt(daysInput.value, 10) : 30;
        const customDescription = descInput ? descInput.value.trim() : '';
        if (isNaN(times) || times < 1) {
            UI.showAlert('alertMessage', 'Por favor, informe uma quantidade válida maior ou igual a 1.', 'error');
            return;
        }
        if (isNaN(days) || days < 1) {
            UI.showAlert('alertMessage', 'Por favor, informe um intervalo de dias válido maior ou igual a 1.', 'error');
            return;
        }
        if (!confirm(`Deseja duplicar as ${selectedIds.length} receitas selecionadas ${times} vez(es)?`))
            return;
        const btn = document.getElementById('btnBatchDuplicateRevenue');
        const oldHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = `<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
            btn.disabled = true;
        }
        try {
            let successCount = 0;
            let failCount = 0;
            for (const id of selectedIds) {
                const rev = revenuesData.find(r => r.public_id === id);
                if (!rev)
                    continue;
                const datePart = rev.date ? (rev.date.split('T')[0]?.split(' ')[0] || '') : '';
                const [year, month, day] = datePart.split('-').map(Number);
                if (isNaN(year) || isNaN(month) || isNaN(day)) {
                    console.error(`Data inválida na receita:`, rev.date);
                    failCount++;
                    continue;
                }
                for (let i = 1; i <= times; i++) {
                    const targetDate = new Date(year, month - 1, day);
                    targetDate.setDate(targetDate.getDate() + days * i);
                    const targetDateStr = DateUtils.toDateInputValue(targetDate);
                    const payload = {
                        description: customDescription || (translateDescription(rev.description) + ' (Cópia)'),
                        amount: Number(rev.amount),
                        date: targetDateStr,
                        category_public_id: rev.category_public_id,
                        bank_account_public_id: rev.bank_account_public_id,
                        payment_method: rev.payment_method || null,
                        card_brand_public_id: rev.card_brand_public_id || null,
                        status: 'pending',
                        entity_type: rev.entity_type || null,
                        entity_public_id: rev.entity_public_id || null,
                        date_launch: DateUtils.getCurrentDateTimeInputValue()
                    };
                    try {
                        await api('/finance/revenues', {
                            method: 'POST',
                            body: JSON.stringify(payload)
                        });
                        successCount++;
                    }
                    catch (err) {
                        console.error(`Erro ao duplicar receita ${id} (iteração ${i}):`, err);
                        failCount++;
                    }
                }
            }
            window.closeBulkUpdateModal?.();
            if (failCount > 0) {
                UI.showAlert('alertMessage', `Duplicadas ${successCount} receitas com sucesso. ${failCount} falharam.`, 'warning');
            }
            else {
                UI.showAlert('alertMessage', 'Receitas duplicadas em lote com sucesso!', 'success');
            }
            clearCheckboxSelection();
            fetchRevenues();
            loadDependencies();
        }
        catch (err) {
            UI.showAlert('alertMessage', 'Erro ao duplicar receitas em lote: ' + err.message, 'error');
        }
        finally {
            if (btn) {
                btn.innerHTML = oldHtml;
                btn.disabled = false;
            }
        }
    }
    async function handleBatchDownloadBilletsZip() {
        const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
        const container = document.getElementById(containerId);
        const selected = container ? container.querySelectorAll('.revenue-checkbox:checked') : [];
        const selectedIds = Array.from(selected).map(cb => cb.value);
        if (selectedIds.length === 0) {
            UI.showAlert('alertMessage', 'Nenhuma receita selecionada.', 'warning');
            return;
        }
        // Filter to only select revenues that have generated billet/billet_url
        const validRevenues = selectedIds
            .map(id => revenuesData.find(r => r.public_id === id))
            .filter(r => r && r.billet_url);
        if (validRevenues.length === 0) {
            UI.showAlert('alertMessage', 'Nenhuma das receitas selecionadas possui boleto gerado.', 'warning');
            return;
        }
        if (!confirm(`Deseja baixar os boletos das ${validRevenues.length} receitas selecionadas em um arquivo ZIP?`)) {
            return;
        }
        const btn = document.getElementById('btnBatchDownloadBilletsZip');
        const oldHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = `<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
            btn.disabled = true;
        }
        try {
            const JSZipLib = window.JSZip;
            if (!JSZipLib) {
                throw new Error('Biblioteca JSZip não carregada. Por favor, recarregue a página.');
            }
            const zip = new JSZipLib();
            let successCount = 0;
            let failCount = 0;
            for (const r of validRevenues) {
                try {
                    if (successCount > 0 || failCount > 0) {
                        await new Promise(resolve => setTimeout(resolve, 1200));
                    }
                    const jwtToken = getAuthToken();
                    const response = await fetch(`/api/v1/finance/revenues/${r.public_id}/boleto-pdf?nossoNumero=${encodeURIComponent(r.billet_url)}`, {
                        headers: {
                            'Authorization': `Bearer ${jwtToken}`
                        }
                    });
                    if (!response.ok) {
                        throw new Error(`Falha ao obter boleto: ${response.statusText}`);
                    }
                    const arrayBuffer = await response.arrayBuffer();
                    const safeName = String(r.entity_name || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
                    let safeDate = 'Data';
                    if (r.date) {
                        safeDate = String(r.date).split('T')[0]?.split(' ')[0] || 'Data';
                    }
                    const filename = `Boleto_${safeName}_${safeDate}.pdf`;
                    zip.file(filename, arrayBuffer);
                    successCount++;
                }
                catch (err) {
                    console.error(`Erro ao baixar boleto para receita ${r.public_id}:`, err);
                    failCount++;
                }
            }
            if (successCount === 0) {
                throw new Error('Nenhum boleto pôde ser baixado.');
            }
            const content = await zip.generateAsync({ type: 'blob' });
            const url = window.URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `boletos_${new Date().toISOString().slice(0, 10)}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            window.closeBulkUpdateModal?.();
            if (failCount > 0) {
                UI.showAlert('alertMessage', `Baixados ${successCount} boletos no arquivo ZIP. ${failCount} falharam.`, 'warning');
            }
            else {
                UI.showAlert('alertMessage', 'Arquivo ZIP com os boletos gerado com sucesso!', 'success');
            }
            clearCheckboxSelection();
        }
        catch (err) {
            UI.showAlert('alertMessage', 'Erro ao baixar boletos em lote: ' + err.message, 'error');
        }
        finally {
            if (btn) {
                btn.innerHTML = oldHtml;
                btn.disabled = false;
            }
        }
    }
    document.addEventListener('DOMContentLoaded', () => {
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async (e) => {
                const button = e.currentTarget;
                if (button.disabled || !g_deleteId)
                    return;
                const idToDelete = g_deleteId;
                g_deleteId = null;
                button.disabled = true;
                button.classList.add('opacity-50', 'cursor-not-allowed');
                button.textContent = 'Excluindo...';
                try {
                    await api(`/finance/transactions/${idToDelete}`, { method: 'DELETE' });
                    window.closeDeleteModal();
                    UI.showAlert('alertMessage', 'Receita excluída com sucesso!', 'success');
                    fetchRevenues();
                    loadDependencies(true);
                }
                catch (error) {
                    UI.showAlert('alertMessage', 'Erro ao excluir: ' + error.message, 'error');
                    g_deleteId = idToDelete;
                }
                finally {
                    button.disabled = false;
                    button.classList.remove('opacity-50', 'cursor-not-allowed');
                    button.textContent = 'Sim, Excluir';
                }
            });
        }
        const confirmBaixaBtn = document.getElementById('confirmBaixaBtn');
        if (confirmBaixaBtn) {
            confirmBaixaBtn.addEventListener('click', async (e) => {
                const button = e.currentTarget;
                if (button.disabled || !g_baixaId)
                    return;
                const idToBaixa = g_baixaId;
                const rev = revenuesData.find(r => r.public_id === idToBaixa);
                if (!rev)
                    return;
                const originalAmount = rev.original_amount !== null && rev.original_amount !== undefined ? Number(rev.original_amount) : (Number(rev.amount) || 0);
                const fine = getNumberInputValue('baixaFine');
                const interest = getNumberInputValue('baixaInterest');
                const baixaDateTime = document.getElementById('baixaDate')?.value || getCurrentDateTimeInputValue();
                const baixaDate = baixaDateTime.split('T')[0] || DateUtils.getTodayDateInputValue();
                const totalAmount = originalAmount + fine + interest;
                const selectedBankPublicId = document.getElementById('baixaBankSelect')?.value || rev.bank_account_public_id;
                const selectedPaymentMethod = document.getElementById('baixaPaymentMethod')?.value || rev.payment_method || (rev.billet_url || rev.barcode ? 'boleto' : (rev.pix_code ? 'pix' : 'transfer'));
                const isBoleto = selectedPaymentMethod === 'boleto';
                let receivedChannel = null;
                if (isBoleto) {
                    const pixRadio = document.getElementById('baixaChannelPix');
                    receivedChannel = (pixRadio && pixRadio.checked) ? 'pix_qr' : 'barcode';
                }
                const baixaCancelBilletContainer = document.getElementById('baixaCancelBilletContainer');
                const baixaCancelBilletCheckbox = document.getElementById('baixaCancelBilletCheckbox');
                const shouldCancelBillet = !isBoleto && baixaCancelBilletContainer && !baixaCancelBilletContainer.classList.contains('hidden') && baixaCancelBilletCheckbox?.checked;
                button.disabled = true;
                button.classList.add('opacity-50', 'cursor-not-allowed');
                button.textContent = 'Baixando...';
                try {
                    await api(`/finance/revenues/${idToBaixa}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                            description: rev.description,
                            amount: totalAmount,
                            original_amount: originalAmount,
                            fine: fine,
                            interest: interest,
                            date: rev.date ? DateUtils.toDateInputValue(rev.date) : baixaDate,
                            date_launch: rev.date_launch ? DateUtils.toDateTimeInputValue(rev.date_launch) : (rev.created_at ? DateUtils.toDateTimeInputValue(rev.created_at) : null),
                            received_at: toMysqlDateTimeValue(baixaDateTime),
                            received_channel: receivedChannel,
                            category_public_id: rev.category_public_id,
                            bank_account_public_id: selectedBankPublicId,
                            cost_center_public_id: rev.cost_center_public_id || null,
                            entity_type: rev.entity_type || null,
                            entity_public_id: rev.entity_public_id || null,
                            payment_method: selectedPaymentMethod,
                            card_brand_public_id: rev.card_brand_public_id || null,
                            card_configuration_public_id: rev.card_configuration_public_id || null,
                            status: 'paid',
                            cancel_billet: shouldCancelBillet ? true : undefined
                        })
                    });
                    window.closeBaixaModal();
                    clearCheckboxSelection();
                    UI.showAlert('alertMessage', 'Baixa realizada com sucesso!', 'success');
                    await fetchRevenues();
                    await loadDependencies(true);
                }
                catch (error) {
                    UI.showAlert('alertMessage', 'Erro ao realizar baixa: ' + error.message, 'error');
                }
                finally {
                    button.disabled = false;
                    button.classList.remove('opacity-50', 'cursor-not-allowed');
                    button.textContent = 'Confirmar Baixa';
                }
            });
        }
        const bulkUpdateForm = document.getElementById('bulkUpdateForm');
        if (bulkUpdateForm) {
            bulkUpdateForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
                const container = document.getElementById(containerId);
                const selected = container ? container.querySelectorAll('.revenue-checkbox:checked') : [];
                const selectedIds = Array.from(selected).map(cb => cb.value);
                if (selectedIds.length === 0)
                    return;
                const bank_account_public_id = document.getElementById('bulkUpdateBank')?.value || undefined;
                const payment_method = document.getElementById('bulkUpdateMethod')?.value || undefined;
                const date = document.getElementById('bulkUpdateDate')?.value || undefined;
                let clear_fine_interest = undefined;
                if (date) {
                    const selectedRevenues = revenuesData.filter(r => selectedIds.includes(r.public_id));
                    const revenuesWithInterest = selectedRevenues.filter(r => {
                        const fineAmt = Number(r.fine || 0) + Number(r.interest || 0);
                        const calc = calculateRevenueFineAndInterest(r);
                        return fineAmt > 0 || calc.totalFineInterest > 0;
                    });
                    if (revenuesWithInterest.length > 0) {
                        const shouldClear = window.confirm(`Você está alterando a data de vencimento de ${revenuesWithInterest.length} lançamento(s) que possui(em) juros/multa cadastrados.\n\nDeseja APAGAR (zerar) os juros/multa desses lançamentos ou MANTER os valores atuais?\n\n[OK] = Apagar juros e multa\n[Cancelar] = Manter juros e multa`);
                        clear_fine_interest = shouldClear;
                    }
                }
                const button = document.getElementById('confirmBulkUpdateBtn');
                const oldHtml = button ? button.innerHTML : '';
                if (button) {
                    button.disabled = true;
                    button.innerHTML = `<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
                }
                try {
                    const res = await api('/finance/revenues/batch-update', {
                        method: 'POST',
                        body: JSON.stringify({
                            ids: selectedIds,
                            bank_account_public_id,
                            payment_method,
                            date,
                            clear_fine_interest
                        })
                    });
                    const successCount = res?.data?.success || 0;
                    const errorList = res?.data?.errors || [];
                    window.closeBulkUpdateModal();
                    clearCheckboxSelection();
                    if (errorList.length > 0) {
                        UI.showAlert('alertMessage', `Alteradas ${successCount} receitas. Algumas falharam:\n${errorList.join('\n')}`, 'error');
                    }
                    else {
                        UI.showAlert('alertMessage', 'Alteração em lote realizada com sucesso!', 'success');
                    }
                    await fetchRevenues();
                    await loadDependencies(true);
                }
                catch (error) {
                    UI.showAlert('alertMessage', 'Erro ao realizar alteração em lote: ' + error.message, 'error');
                }
                finally {
                    if (button) {
                        button.disabled = false;
                        button.innerHTML = oldHtml;
                    }
                }
            });
        }
    });
    async function handleSaveRevenue(e) {
        e.preventDefault();
        checkAndPromptDueDateInterestChange();
        const receivableVal = getCurrencyValue('receivableValue');
        const fineInterestVal = getCurrencyValue('fineInterestValue');
        let amountVal = getCurrencyValue('value');
        if (!amountVal && receivableVal > 0) {
            amountVal = receivableVal + fineInterestVal;
        }
        if (!amountVal || amountVal <= 0) {
            UI.showAlert('alertMessage', 'Informe um valor maior que zero.', 'error');
            return;
        }
        const data = {
            description: document.getElementById('description').value,
            amount: amountVal,
            original_amount: receivableVal > 0 ? receivableVal : amountVal,
            fine: fineInterestVal >= 0 ? fineInterestVal : 0,
            interest: 0,
            date: document.getElementById('dueDate').value,
            date_launch: document.getElementById('dateLaunch').value || null,
            category_public_id: document.getElementById('category').value,
            bank_account_public_id: document.getElementById('bankSelect').value,
            cost_center_public_id: document.getElementById('costCenter')?.value || null
        };
        const entityType = document.getElementById('entityType')?.value || '';
        const entityPublicId = document.getElementById('entitySelect')?.value || '';
        if (entityType && entityPublicId) {
            data.entity_type = entityType;
            data.entity_public_id = entityPublicId;
        }
        else {
            data.entity_type = null;
            data.entity_public_id = null;
        }
        const paymentEl = document.getElementById('paymentMethod');
        if (paymentEl && paymentEl.value) {
            data.payment_method = paymentEl.value;
        }
        const cardBrandEl = document.getElementById('cardBrand');
        if (cardBrandEl && cardBrandEl.value && (data.payment_method === 'credit' || data.payment_method === 'debit')) {
            data.card_brand_public_id = cardBrandEl.value;
        }
        else {
            data.card_brand_public_id = null;
        }
        const cardConfigEl = document.getElementById('cardConfig');
        if (cardConfigEl && cardConfigEl.value && (data.payment_method === 'credit' || data.payment_method === 'debit')) {
            data.card_configuration_public_id = cardConfigEl.value;
        }
        else {
            data.card_configuration_public_id = null;
        }
        const statusEl = document.getElementById('status');
        if (statusEl && statusEl.value) {
            data.status = statusEl.value;
            if (data.status === 'paid') {
                const receivedAtEl = document.getElementById('receivedAt');
                if (receivedAtEl && receivedAtEl.value) {
                    data.received_at = toMysqlDateTimeValue(receivedAtEl.value);
                }
                if (data.payment_method === 'boleto') {
                    const receivedChannelEl = document.getElementById('receivedChannel');
                    data.received_channel = receivedChannelEl?.value || 'barcode';
                }
                else {
                    data.received_channel = null;
                }
            }
        }
        const revenueCancelBilletContainer = document.getElementById('revenueCancelBilletContainer');
        const revenueCancelBilletCheckbox = document.getElementById('revenueCancelBilletCheckbox');
        const shouldCancelRevenueBillet = revenueCancelBilletContainer && !revenueCancelBilletContainer.classList.contains('hidden') && revenueCancelBilletCheckbox?.checked;
        if (shouldCancelRevenueBillet) {
            data.cancel_billet = true;
        }
        const btn = document.getElementById('saveBtn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Processando...';
        }
        try {
            if (g_editId) {
                await api(`/finance/revenues/${g_editId}`, {
                    method: 'PUT',
                    body: JSON.stringify(data)
                });
                UI.showAlert('alertMessage', 'Receita atualizada com sucesso!', 'success');
            }
            else {
                await api('/finance/revenues', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
                let successMsg = 'Receita registrada com sucesso!';
                if (data.status !== 'paid' && (data.payment_method === 'boleto' || data.payment_method === 'pix')) {
                    successMsg += ' O envio de cobrança via WhatsApp está programado para 30 segundos após a criação.';
                }
                UI.showAlert('alertMessage', successMsg, 'success');
            }
            closeModal();
            await fetchRevenues();
            await loadDependencies(true); // atualiza saldos
        }
        catch (err) {
            alert(err.message || 'Erro ao salvar receita');
        }
        finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Salvar';
            }
        }
    }
    async function handleBatchSyncPayments() {
        const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
        const container = document.getElementById(containerId);
        const selected = container ? container.querySelectorAll('.revenue-checkbox:checked') : [];
        const selectedIds = Array.from(selected).map(cb => cb.value);
        if (selectedIds.length === 0)
            return;
        const btn = document.getElementById('btnBatchSyncPayments');
        const oldText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = `<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
            btn.setAttribute('disabled', 'true');
        }
        try {
            const res = await api('/finance/revenues/batch-sync-payments', {
                method: 'POST',
                body: JSON.stringify({ ids: selectedIds })
            });
            const successCount = res?.data?.success || 0;
            const errorList = res?.data?.errors || [];
            if (errorList.length > 0) {
                UI.showAlert('alertMessage', `Conferidos ${successCount} recebimentos com sucesso. Algumas falharam:\n${errorList.join('\n')}`, 'warning');
            }
            else {
                UI.showAlert('alertMessage', 'Sincronização de recebimentos em lote concluída com sucesso!', 'success');
            }
            window.closeBulkUpdateModal?.();
            clearCheckboxSelection();
            await fetchRevenues();
            await loadDependencies(true);
        }
        catch (err) {
            UI.showAlert('alertMessage', 'Erro ao sincronizar recebimentos em lote: ' + err.message, 'error');
        }
        finally {
            if (btn) {
                btn.innerHTML = oldText;
                btn.removeAttribute('disabled');
            }
        }
    }
    async function handleSyncSolidconBaixas() {
        const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
        const container = document.getElementById(containerId);
        const selected = container ? container.querySelectorAll('.revenue-checkbox:checked') : [];
        const selectedIds = Array.from(selected).map(cb => cb.value);
        if (selectedIds.length === 0) {
            UI.showAlert('alertMessage', 'Por favor, selecione ao menos uma receita para verificar/sincronizar no Solidcon.', 'warning');
            return;
        }
        if (!confirm(`Deseja verificar e sincronizar as ${selectedIds.length} baixas selecionadas com o banco de dados da Solidcon? O sistema verificará se as receitas selecionadas com status "Recebido" que vieram da Solidcon possuem os registros correspondentes inseridos no extrato de conta corrente (tbBancoContaMovimento) e depósito (tbCrediarioDeposito) na Solidcon.`)) {
            return;
        }
        const btn = document.getElementById('btnBatchDownloadSolidconConvenio');
        const oldHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = `<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
            btn.disabled = true;
        }
        try {
            const response = await api('/finance/revenues/solidcon-sync-baixas', {
                method: 'POST',
                body: JSON.stringify({ transactionIds: selectedIds })
            });
            const data = response?.data || {};
            const checkedCount = data.checkedCount ?? 0;
            const syncedCount = data.syncedCount ?? 0;
            const errors = data.errors || [];
            let msg = `Sincronização concluída! ${checkedCount} lançamentos verificados, ${syncedCount} baixas integradas/corrigidas na Solidcon.`;
            if (errors.length > 0) {
                const errorDetails = errors.map((e) => {
                    if (typeof e === 'string')
                        return e;
                    const label = e.solidcon_key || `ID ${e.id}`;
                    return `• ${label}: ${e.error || 'Erro desconhecido'}`;
                }).join('\n');
                msg += `\n\nHouve ${errors.length} erro(s):\n${errorDetails}`;
            }
            UI.showAlert('alertMessage', msg, errors.length > 0 ? 'warning' : 'success');
            if (errors.length > 0) {
                showSolidconSyncErrorsModal(errors);
            }
            clearCheckboxSelection();
            await fetchRevenues();
        }
        catch (err) {
            UI.showAlert('alertMessage', err.message || 'Erro ao sincronizar baixas com a Solidcon.', 'error');
        }
        finally {
            if (btn) {
                btn.innerHTML = oldHtml;
                btn.disabled = false;
            }
        }
    }
    async function handleCleanDuplicateSolidconBaixas() {
        const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
        const container = document.getElementById(containerId);
        const selected = container ? container.querySelectorAll('.revenue-checkbox:checked') : [];
        const selectedIds = Array.from(selected).map(cb => cb.value);
        const isFiltered = selectedIds.length > 0;
        const confirmPrompt = isFiltered
            ? `Deseja verificar e excluir as baixas duplicadas na Solidcon para as ${selectedIds.length} receitas selecionadas?\n\nO sistema removerá da Solidcon quaisquer registros de pagamento gerados indevidamente pelo Keystone (Baixa Web/Nuvem) para clientes configurados com Baixa Exclusiva Solidcon, preservando as baixas de loja e corrigindo o saldo/status local.`
            : `Deseja verificar e excluir TODAS as baixas duplicadas na Solidcon para clientes configurados com Baixa Exclusiva Solidcon?\n\nO sistema buscará todos os cupons que receberam baixa indevida pelo Keystone no banco da Solidcon, removendo os pagamentos duplicados e ajustando os saldos e o status no ERP.`;
        if (!confirm(confirmPrompt)) {
            return;
        }
        const btn = document.getElementById('btnBatchCleanDuplicateSolidconBaixas');
        const oldHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = `<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
            btn.disabled = true;
        }
        try {
            const response = await api('/finance/revenues/solidcon-clean-duplicates', {
                method: 'POST',
                body: JSON.stringify({ transactionIds: isFiltered ? selectedIds : undefined })
            });
            const data = response?.data || {};
            const checkedCount = data.checkedCount ?? 0;
            const cleanedCount = data.cleanedCount ?? 0;
            const details = data.details || [];
            const errors = data.errors || [];
            let msg = `Limpeza de baixas concluída! ${checkedCount} lançamentos verificados, ${cleanedCount} cupom(ns) com baixas duplicadas/indevidas limpos na Solidcon.`;
            if (details.length > 0) {
                const detailLines = details.map((d) => `• Cupom #${d.cupom} (${d.customer}): ${d.deletedPayments} baixa(s) Keystone removida(s) -> ${d.status}`).join('\n');
                msg += `\n\nDetalhes:\n${detailLines}`;
            }
            if (errors.length > 0) {
                const errorDetails = errors.map((e) => `• Cupom ${e.cupom}: ${e.error || 'Erro'}`).join('\n');
                msg += `\n\nHouve ${errors.length} erro(s):\n${errorDetails}`;
            }
            UI.showAlert('alertMessage', msg, errors.length > 0 ? 'warning' : 'success');
            clearCheckboxSelection();
            await fetchRevenues();
        }
        catch (err) {
            UI.showAlert('alertMessage', err.message || 'Erro ao excluir baixas duplicadas na Solidcon.', 'error');
        }
        finally {
            if (btn) {
                btn.innerHTML = oldHtml;
                btn.disabled = false;
            }
        }
    }
    function showSolidconSyncErrorsModal(errors) {
        const modal = document.getElementById('solidconSyncErrorsModal');
        const tbody = document.getElementById('solidconSyncErrorsTableBody');
        if (!modal || !tbody)
            return;
        tbody.innerHTML = '';
        errors.forEach(err => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-150 dark:border-slate-700 hover:bg-gray-50/50 dark:hover:bg-slate-700/30';
            const tdKey = document.createElement('td');
            tdKey.className = 'px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100';
            tdKey.textContent = err.solidcon_key || 'N/A';
            const tdError = document.createElement('td');
            tdError.className = 'px-4 py-2.5 text-red-600 dark:text-red-400 font-sans';
            tdError.textContent = err.error || 'Erro desconhecido';
            tr.appendChild(tdKey);
            tr.appendChild(tdError);
            tbody.appendChild(tr);
        });
        modal.classList.remove('hidden');
    }
    function closeSolidconSyncErrorsModal() {
        document.getElementById('solidconSyncErrorsModal')?.classList.add('hidden');
    }
    // ── Detalhes e Auditoria Solidcon ──────────────────────────────────────
    let g_currentSolidconRevenueId = null;
    async function openSolidconDetailsModal(revenueId) {
        g_currentSolidconRevenueId = revenueId;
        const modal = document.getElementById('solidconDetailsModal');
        if (!modal)
            return;
        // Reset para estado de carregamento
        const badge = document.getElementById('solidconModalBadge');
        if (badge) {
            badge.textContent = 'Carregando...';
            badge.className = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
        }
        const alertBox = document.getElementById('solidconAlertBox');
        if (alertBox)
            alertBox.className = 'hidden p-4 rounded-xl border';
        const btnFix = document.getElementById('btnFixSolidconDuplicates');
        if (btnFix) {
            btnFix.classList.add('hidden');
            btnFix.style.display = 'none';
        }
        const btnTie = document.getElementById('btnTieSolidconContaBaixa');
        if (btnTie) {
            btnTie.classList.add('hidden');
            btnTie.style.display = 'none';
        }
        const btnLaunch = document.getElementById('btnLaunchSolidconBaixa');
        if (btnLaunch) {
            btnLaunch.classList.add('hidden');
            btnLaunch.style.display = 'none';
        }
        const btnCancelBaixa = document.getElementById('btnCancelSolidconBaixaModal');
        if (btnCancelBaixa) {
            btnCancelBaixa.classList.add('hidden');
            btnCancelBaixa.style.display = 'none';
        }
        const cbBadge = document.getElementById('scContaBaixaCountBadge');
        if (cbBadge)
            cbBadge.textContent = '0 registro(s)';
        const cbTbody = document.getElementById('scContaBaixaTableBody');
        if (cbTbody) {
            cbTbody.innerHTML = '<tr><td colspan="7" class="px-3 py-4 text-center text-gray-400 font-sans">Carregando baixas do Solidcon...</td></tr>';
        }
        ['scIdCupom', 'scPagamentoCount', 'scDepositoIds', 'scMovimentoIds', 'scContaId', 'scContaBaixaIds', 'scParcelaIds', 'scCupomInfo', 'scExtratoSolidconStatus', 'scExtratoLocalStatus'].forEach(id => {
            const el = document.getElementById(id);
            if (el)
                el.textContent = '...';
        });
        ['scValoresCupom', 'scPagamentoTotal', 'scDepositoConta', 'scMovimentoConta', 'scContaStatus', 'scContaBaixaValores', 'scParcelaValores', 'scClienteInfo'].forEach(id => {
            const el = document.getElementById(id);
            if (el)
                el.textContent = '...';
        });
        const reconBadge = document.getElementById('scReconciledBadge');
        if (reconBadge) {
            reconBadge.textContent = '...';
            reconBadge.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300';
        }
        const reconPill = document.getElementById('scReconStatusPill');
        if (reconPill) {
            reconPill.textContent = 'Consultando...';
            reconPill.className = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300';
        }
        const extratoListCont = document.getElementById('scExtratoListContainer');
        if (extratoListCont)
            extratoListCont.classList.add('hidden');
        const extratoTbody = document.getElementById('scExtratoTableBody');
        if (extratoTbody)
            extratoTbody.innerHTML = '';
        const tbody = document.getElementById('scPaymentsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" class="px-3 py-4 text-center text-gray-400 font-sans">Carregando dados das tabelas Solidcon...</td></tr>';
        }
        const logBox = document.getElementById('solidconLogDetails');
        if (logBox)
            logBox.value = `[${new Date().toLocaleTimeString('pt-BR')}] Consultando banco de dados Solidcon para a receita ID ${revenueId}...`;
        modal.classList.remove('hidden');
        try {
            const response = await api(`/finance/revenues/${revenueId}/solidcon-details`);
            const data = response?.data;
            if (!data)
                throw new Error('Não foi possível carregar os detalhes do Solidcon.');
            renderSolidconInspectionDetails(data);
        }
        catch (err) {
            if (logBox)
                logBox.value += `\n[ERRO] ${err.message || 'Falha ao consultar detalhes.'}`;
            if (badge) {
                badge.textContent = 'Erro';
                badge.className = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
            }
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" class="px-3 py-4 text-center text-red-500 font-sans">${err.message || 'Erro ao carregar detalhes.'}</td></tr>`;
            }
        }
    }
    function renderSolidconInspectionDetails(data) {
        const rev = data.revenue || data.transaction || data.solidcon?.revenue || {};
        const tableIds = data.tableIds || data.solidcon?.tableIds || {};
        const cupom = data.crediarioCupom || data.cupom || data.solidcon?.cupom || null;
        const payments = data.payments || data.solidcon?.payments || [];
        const deposits = data.deposits || data.solidcon?.deposits || [];
        const bankMovements = data.bankMovements || data.movements || data.solidcon?.movements || [];
        const conta = data.conta || data.solidcon?.conta || (data.interestConta && data.interestConta[0]) || null;
        const contaBaixas = data.contaBaixas || data.solidcon?.contaBaixas || [];
        const contaParcelas = data.contaParcelas || data.solidcon?.contaParcelas || [];
        const dup = data.duplicateAnalysis || data.solidcon?.duplicateAnalysis || {
            hasDuplicates: Boolean(data.hasDuplicates || data.solidcon?.hasDuplicates),
            duplicatePaymentCount: Math.max(0, payments.length - 1),
            duplicateDepositCount: Math.max(0, deposits.length - 1),
            duplicateMovementCount: Math.max(0, bankMovements.length - 1),
            reasons: data.duplicateReasons || data.solidcon?.duplicateReasons || []
        };
        const missingBaixaTie = Boolean(data.missingBaixaTie || dup.missingBaixaTie || (bankMovements.length > 0 && contaBaixas.length === 0));
        // Dados de Conciliação Bancária
        const recon = data.reconciliation || {};
        const solidconExtratos = data.extratos || recon.solidconExtratos || [];
        const localStatements = recon.localStatements || [];
        const isReconciled = Boolean(recon.isReconciled);
        const isReconciledSolidcon = Boolean(recon.isReconciledSolidcon);
        const isReconciledLocal = Boolean(recon.isReconciledLocal);
        const fmtMoeda = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const fmtDate = (d) => {
            if (!d)
                return 'N/A';
            try {
                const dt = new Date(d);
                if (isNaN(dt.getTime()))
                    return String(d);
                return dt.toLocaleDateString('pt-BR');
            }
            catch {
                return String(d);
            }
        };
        // Badge
        const badge = document.getElementById('solidconModalBadge');
        if (badge) {
            const cupomNr = rev.cupom || tableIds.tbCrediarioCupom || rev.solidcon_key || 'N/A';
            badge.textContent = `Cupom #${cupomNr} | Filial: ${rev.cdfilial || '1'}`;
            badge.className = dup.hasDuplicates
                ? 'inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                : (missingBaixaTie
                    ? 'inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                    : 'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300');
        }
        // Alert Box
        const alertBox = document.getElementById('solidconAlertBox');
        const alertIcon = document.getElementById('solidconAlertIcon');
        const alertTitle = document.getElementById('solidconAlertTitle');
        const alertDesc = document.getElementById('solidconAlertDesc');
        const btnFix = document.getElementById('btnFixSolidconDuplicates');
        const btnTie = document.getElementById('btnTieSolidconContaBaixa');
        const btnLaunch = document.getElementById('btnLaunchSolidconBaixa');
        const btnCancelBaixa = document.getElementById('btnCancelSolidconBaixaModal');
        if (btnFix) {
            btnFix.classList.add('hidden');
            btnFix.style.display = 'none';
        }
        if (btnTie) {
            btnTie.classList.add('hidden');
            btnTie.style.display = 'none';
        }
        if (btnLaunch) {
            btnLaunch.classList.add('hidden');
            btnLaunch.style.display = 'none';
        }
        if (btnCancelBaixa) {
            if (contaBaixas.length > 0 || payments.length > 0 || rev.solidcon_quitado || (tableIds.tbContaBaixa && tableIds.tbContaBaixa.length > 0)) {
                btnCancelBaixa.classList.remove('hidden');
                btnCancelBaixa.style.display = 'inline-flex';
            }
            else {
                btnCancelBaixa.classList.add('hidden');
                btnCancelBaixa.style.display = 'none';
            }
        }
        if (alertBox && alertTitle && alertDesc) {
            alertBox.classList.remove('hidden');
            if (payments.length === 0) {
                alertBox.className = 'p-4 rounded-xl border bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200';
                if (alertIcon) {
                    alertIcon.innerHTML = `<svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
                }
                alertTitle.textContent = 'Sem Pagamento no Solidcon';
                alertDesc.textContent = 'Este cupom não possui registro de quitação em tbCrediarioCupomPagamento. Você pode realizar o lançamento amarrando todas as tabelas (movimento bancário, depósito e baixa) agora.';
                if (btnLaunch) {
                    btnLaunch.classList.remove('hidden');
                    btnLaunch.style.display = 'inline-flex';
                }
            }
            else if (dup.hasDuplicates) {
                alertBox.className = 'p-4 rounded-xl border bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200';
                if (alertIcon) {
                    alertIcon.innerHTML = `<svg class="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
                }
                alertTitle.textContent = 'Atenção: Duplicidade Detectada no Solidcon';
                alertDesc.textContent = (dup.reasons && dup.reasons.length) ? dup.reasons.join(' | ') : `${dup.duplicatePaymentCount || 1} baixa(s) duplicada(s) encontrada(s).`;
                if (btnFix) {
                    btnFix.classList.remove('hidden');
                    btnFix.style.display = 'inline-flex';
                }
            }
            else if (missingBaixaTie) {
                alertBox.className = 'p-4 rounded-xl border bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200';
                if (alertIcon) {
                    alertIcon.innerHTML = `<svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>`;
                }
                const movCod = (bankMovements[0]?.cdBancoContaMovimento || (tableIds.tbBancoContaMovimento && tableIds.tbBancoContaMovimento[0])) ? `#${bankMovements[0]?.cdBancoContaMovimento || tableIds.tbBancoContaMovimento[0]}` : '';
                alertTitle.textContent = 'Amarração Pendente no Extrato Bancário (tbConta / tbContaBaixa)';
                alertDesc.textContent = `O movimento bancário ${movCod} está lançado no Solidcon, mas NÃO possui lançamento amarrado em tbConta, tbContaBaixa e tbContaParcela. Clique no botão ao lado para amarrar e habilitar a conciliação bancária automática no Solidcon.`;
                if (btnTie) {
                    btnTie.classList.remove('hidden');
                    btnTie.style.display = 'inline-flex';
                }
            }
            else if (payments.length > 1) {
                alertBox.className = 'p-4 rounded-xl border bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200';
                if (alertIcon) {
                    alertIcon.innerHTML = `<svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`;
                }
                alertTitle.textContent = `Pagamento em Parcelas / Depósitos Parciais (${payments.length} pagamentos)`;
                alertDesc.textContent = `O cupom foi quitado através de ${payments.length} pagamentos/depósitos parciais legítimos. Todas as tabelas de depósito, movimento bancário e baixa estão perfeitamente sincronizadas e sem duplicidade.`;
            }
            else {
                alertBox.className = 'p-4 rounded-xl border bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200';
                if (alertIcon) {
                    alertIcon.innerHTML = `<svg class="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
                }
                alertTitle.textContent = 'Lançamento Consistente e Amarrado no Solidcon';
                alertDesc.textContent = 'Não foram encontradas inconsistências. As tabelas de cupom, pagamento, depósito, movimento bancário, tbConta e tbContaBaixa estão perfeitamente amarradas para conciliação pelo extrato bancário.';
            }
        }
        // IDs summary cards
        const setEl = (id, text) => {
            const el = document.getElementById(id);
            if (el)
                el.textContent = text;
        };
        setEl('scIdCupom', tableIds.tbCrediarioCupom ? `#${tableIds.tbCrediarioCupom}` : 'N/A');
        setEl('scValoresCupom', cupom ? `Total: ${fmtMoeda(cupom.vlCrediario)} | Quitado: ${fmtMoeda(cupom.vlQuitado)}` : 'Sem dados de cupom');
        const totalPago = payments.reduce((s, p) => s + (Number(p.vlPago) || 0), 0);
        setEl('scPagamentoCount', `${payments.length} registro(s)`);
        setEl('scPagamentoTotal', `Total Pago: ${fmtMoeda(totalPago)}`);
        setEl('scDepositoIds', tableIds.tbCrediarioDeposito?.length ? tableIds.tbCrediarioDeposito.map((id) => `#${id}`).join(', ') : 'Nenhum');
        setEl('scDepositoConta', deposits.length ? `${deposits.length} depósito(s) vinculado(s)` : 'Sem depósitos');
        setEl('scMovimentoIds', tableIds.tbBancoContaMovimento?.length ? tableIds.tbBancoContaMovimento.map((id) => `#${id}`).join(', ') : 'Nenhum');
        setEl('scMovimentoConta', bankMovements.length ? `${bankMovements.length} movimento(s) bancário(s)` : 'Sem movimentos');
        setEl('scContaId', tableIds.tbConta ? `#${tableIds.tbConta}` : 'N/A');
        setEl('scContaStatus', conta ? `Situação: ${conta.Situacao || 'Integrada'}` : 'Sem tbConta');
        setEl('scContaBaixaIds', tableIds.tbContaBaixa?.length ? tableIds.tbContaBaixa.map((id) => `#${id}`).join(', ') : 'Nenhuma');
        setEl('scContaBaixaValores', contaBaixas.length ? `${contaBaixas.length} baixa(s) vinculada(s)` : 'Sem baixas');
        setEl('scParcelaIds', tableIds.tbContaParcela?.length ? tableIds.tbContaParcela.map((id) => `#${id}`).join(', ') : 'Nenhuma');
        setEl('scParcelaValores', contaParcelas.length ? `${contaParcelas.length} parcela(s)` : 'Sem parcelas');
        setEl('scCupomInfo', `Cupom ${rev.cupom || tableIds.tbCrediarioCupom || '-'} (PDV ${rev.pdv || '-'})`);
        setEl('scClienteInfo', rev.entity_name || rev.customer_name || 'Sem cliente associado');
        // Card de Conciliação com Extrato
        const reconBadge = document.getElementById('scReconciledBadge');
        if (reconBadge) {
            if (isReconciled) {
                reconBadge.textContent = isReconciledSolidcon && isReconciledLocal ? 'CONCILIADO (SOLIDCON & ERP)' : (isReconciledSolidcon ? 'CONCILIADO NO SOLIDCON' : 'CONCILIADO NO ERP');
                reconBadge.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700';
            }
            else if (missingBaixaTie) {
                reconBadge.textContent = 'PENDENTE DE AMARRAÇÃO';
                reconBadge.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700';
            }
            else {
                reconBadge.textContent = 'PENDENTE DE CONCILIAÇÃO';
                reconBadge.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-300 dark:border-blue-700';
            }
        }
        setEl('scExtratoSolidconStatus', isReconciledSolidcon
            ? `✅ Conciliado com Extrato Solidcon (Extrato #${(tableIds.tbBancoContaExtrato || []).join(', #') || 'OK'})`
            : (bankMovements.length > 0 ? '⚠️ Movimento lançado, mas pendente de conciliação com extrato' : 'Sem movimento bancário'));
        setEl('scExtratoLocalStatus', isReconciledLocal
            ? `✅ Conciliado (${localStatements[0]?.bank_account_name || 'Conta Corrente'})`
            : '⚠️ Não conciliado com extrato ERP');
        // Seção Detalhada de Extrato & Conciliação
        const reconSummary = document.getElementById('scReconSummary');
        if (reconSummary) {
            reconSummary.textContent = recon.summary || (isReconciled ? 'Lançamento conciliado com sucesso no extrato da conta bancária.' : 'Lançamento ainda não conciliado com o extrato da conta.');
        }
        const reconPill = document.getElementById('scReconStatusPill');
        if (reconPill) {
            if (isReconciled) {
                reconPill.textContent = '✅ Conciliado com Extrato';
                reconPill.className = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300';
            }
            else if (missingBaixaTie) {
                reconPill.textContent = '⚠️ Amarração Pendente';
                reconPill.className = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300';
            }
            else {
                reconPill.textContent = 'ℹ️ Pendente de Extrato';
                reconPill.className = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
            }
        }
        const extratoListCont = document.getElementById('scExtratoListContainer');
        const extratoTbody = document.getElementById('scExtratoTableBody');
        const allExtratoItems = [];
        solidconExtratos.forEach((ext) => {
            allExtratoItems.push({
                origin: 'Solidcon',
                id: ext.cdBancoContaExtrato ? `#${ext.cdBancoContaExtrato}` : '-',
                date: ext.dtExtrato ? fmtDate(ext.dtExtrato) : '-',
                amount: fmtMoeda(ext.vlDebito || ext.vlCredito || ext.vlMovimento || 0),
                account: ext.nmBancoConta || (ext.cdBancoConta ? `Conta #${ext.cdBancoConta}` : 'Conta Bancária Solidcon'),
                description: ext.Historico || ext.Documento || 'Lançamento Extrato Solidcon'
            });
        });
        localStatements.forEach((stmt) => {
            allExtratoItems.push({
                origin: 'ERP Keystone',
                id: stmt.id ? `#${stmt.id}` : '-',
                date: stmt.date ? fmtDate(stmt.date) : '-',
                amount: fmtMoeda(stmt.amount),
                account: stmt.bank_account_name || 'Conta Bancária ERP',
                description: stmt.description || 'Extrato Bancário Keystone'
            });
        });
        if (extratoListCont && extratoTbody) {
            if (allExtratoItems.length > 0) {
                extratoListCont.classList.remove('hidden');
                extratoTbody.innerHTML = allExtratoItems.map(item => `
                <tr class="hover:bg-gray-50/50 dark:hover:bg-slate-700/30">
                    <td class="px-3 py-2 text-left font-bold text-indigo-600 dark:text-indigo-400">${item.origin}</td>
                    <td class="px-3 py-2 text-left font-semibold text-gray-800 dark:text-gray-200">${item.id}</td>
                    <td class="px-3 py-2 text-left text-gray-600 dark:text-gray-300">${item.date}</td>
                    <td class="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">${item.amount}</td>
                    <td class="px-3 py-2 text-left text-gray-600 dark:text-gray-300">${item.account}</td>
                    <td class="px-3 py-2 text-left text-gray-600 dark:text-gray-300 truncate max-w-xs" title="${item.description}">${item.description}</td>
                </tr>
            `).join('');
            }
            else {
                extratoListCont.classList.add('hidden');
            }
        }
        // Payments table
        const tbody = document.getElementById('scPaymentsTableBody');
        if (tbody) {
            if (payments.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="px-3 py-4 text-center text-gray-400 font-sans">Nenhum registro de pagamento encontrado em tbCrediarioCupomPagamento.</td></tr>';
            }
            else {
                tbody.innerHTML = payments.map((p, idx) => {
                    const isDuplicate = idx > 0 && dup.hasDuplicates;
                    const dtFormatted = p.dtPago ? new Date(p.dtPago).toLocaleString('pt-BR') : '-';
                    const statusBadge = isDuplicate
                        ? '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">DUPLICADO</span>'
                        : (payments.length > 1
                            ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">PARCELA #${p.nrPagamento || (idx + 1)}</span>`
                            : '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">PRINCIPAL</span>');
                    const movCodeDisplay = p.cdBancoContaMovimento
                        ? `<span class="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">#${p.cdBancoContaMovimento}</span>`
                        : (tableIds.tbBancoContaMovimento?.length
                            ? `<span class="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">#${tableIds.tbBancoContaMovimento[0]}</span>`
                            : '<span class="text-gray-400">-</span>');
                    return `
                <tr class="${isDuplicate ? 'bg-red-50/50 dark:bg-red-950/20' : 'hover:bg-gray-50/50 dark:hover:bg-slate-700/30'}">
                    <td class="px-3 py-2 text-left font-bold text-gray-900 dark:text-gray-100">#${p.nrPagamento || (idx + 1)}</td>
                    <td class="px-3 py-2 text-right font-bold ${isDuplicate ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}">${fmtMoeda(p.vlPago)}</td>
                    <td class="px-3 py-2 text-left text-gray-600 dark:text-gray-300">${dtFormatted}</td>
                    <td class="px-3 py-2 text-left text-gray-600 dark:text-gray-300 truncate max-w-xs" title="${p.Obs || ''}">U:${p.cdUsuarioQuitou || '-'} ${p.Obs ? `| ${p.Obs}` : ''}</td>
                    <td class="px-3 py-2 text-left text-gray-600 dark:text-gray-300">${p.cdCrediarioDeposito ? `#${p.cdCrediarioDeposito}` : '-'}</td>
                    <td class="px-3 py-2 text-left text-gray-600 dark:text-gray-300">${movCodeDisplay}</td>
                    <td class="px-3 py-2 text-center">${statusBadge}</td>
                </tr>
                `;
                }).join('');
            }
        }
        // Tabela de Baixas Registradas (tbContaBaixa)
        const cbBadge = document.getElementById('scContaBaixaCountBadge');
        if (cbBadge) {
            cbBadge.textContent = `${contaBaixas.length} registro(s)`;
        }
        const cbTbody = document.getElementById('scContaBaixaTableBody');
        if (cbTbody) {
            if (contaBaixas.length === 0) {
                cbTbody.innerHTML = '<tr><td colspan="7" class="px-3 py-4 text-center text-gray-400 font-sans">Nenhuma baixa registrada encontrada em tbContaBaixa.</td></tr>';
            }
            else {
                cbTbody.innerHTML = contaBaixas.map((cb) => {
                    const dtFormatted = cb.dtContaBaixa ? new Date(cb.dtContaBaixa).toLocaleDateString('pt-BR') : '-';
                    const contaNome = cb.nmBancoConta ? `${cb.nmBancoConta} (#${cb.cdBancoConta})` : (cb.cdBancoConta ? `Conta #${cb.cdBancoConta}` : '-');
                    const movCode = cb.cdBancoContaMovimento ? `<span class="text-blue-600 dark:text-blue-400 font-semibold">#${cb.cdBancoContaMovimento}</span>` : '<span class="text-gray-400">-</span>';
                    const contaParcelaInfo = cb.cdConta ? `Conta #${cb.cdConta}${cb.cdContaParcela ? ` / Prc #${cb.cdContaParcela}` : ''}` : (cb.cdContaParcela ? `Prc #${cb.cdContaParcela}` : '-');
                    const historicoDoc = [cb.Historico, cb.Documento ? `Doc: ${cb.Documento}` : ''].filter(Boolean).join(' | ') || '-';
                    return `
                <tr class="hover:bg-gray-50/50 dark:hover:bg-slate-700/30">
                    <td class="px-3 py-2 text-left font-bold text-gray-900 dark:text-gray-100">#${cb.cdContaBaixa || '-'}</td>
                    <td class="px-3 py-2 text-left text-gray-600 dark:text-gray-300">${dtFormatted}</td>
                    <td class="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">${fmtMoeda(cb.vlContaBaixa || cb.vlParcela || 0)}</td>
                    <td class="px-3 py-2 text-left text-gray-600 dark:text-gray-300">
                        <div class="truncate max-w-45" title="${contaNome}">${contaNome}</div>
                        <div class="text-[10px] text-gray-400">Mov: ${movCode}</div>
                    </td>
                    <td class="px-3 py-2 text-left text-gray-600 dark:text-gray-300">${contaParcelaInfo}</td>
                    <td class="px-3 py-2 text-left text-gray-600 dark:text-gray-300 truncate max-w-xs" title="${historicoDoc}">${historicoDoc}</td>
                    <td class="px-3 py-2 text-center">
                        <button type="button" class="btn-cancel-conta-baixa inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 text-[11px] font-semibold transition-colors border border-red-200 dark:border-red-800" data-id="${cb.cdContaBaixa}" title="Cancelar esta baixa no Solidcon e estornar no Keystone">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Cancelar
                        </button>
                    </td>
                </tr>
                `;
                }).join('');
            }
        }
        // Monospace Audit Log Box
        const logBox = document.getElementById('solidconLogDetails');
        if (logBox) {
            const lines = [
                `======================================================================`,
                `RELATÓRIO DE AUDITORIA SOLIDCON - ${new Date().toLocaleString('pt-BR')}`,
                `======================================================================`,
                `RECEITA KEYSTONE:`,
                `  • ID: ${rev.public_id || rev.id || 'N/A'}`,
                `  • Descrição: ${rev.description || 'N/A'}`,
                `  • Cliente: ${rev.entity_name || rev.customer_name || 'Sem cliente'} (CPF/CNPJ: ${rev.entity_cnpj_cpf || rev.customer_cnpj_cpf || 'N/A'})`,
                `  • Valor Keystone: ${fmtMoeda(rev.amount)} (Original: ${fmtMoeda(rev.original_amount || rev.amount)})`,
                `  • Status Keystone: ${rev.status || 'N/A'}`,
                `  • Data Vencimento: ${fmtDate(rev.date)} | Data Recebimento: ${fmtDate(rev.received_at)}`,
                `  • Filial Cadastrada: ${rev.cdfilial || '1'} | PDV Cadastrado: ${rev.pdv || 'N/A'}`,
                ``,
                `CUPOM NO BANCO SOLIDCON:`,
                `  • Número do Cupom (nrCupom): ${cupom?.nrCupom || rev.cupom || 'N/A'}`,
                `  • Filial Solidcon (cdFilial): ${cupom?.cdFilial || rev.cdfilial || '1'}`,
                `  • PDV Solidcon (cdPDV): ${cupom?.cdPDV || rev.pdv || 'N/A'}`,
                `  • ID Primário (cdCrediarioCupom): ${cupom?.cdCrediarioCupom ? `#${cupom.cdCrediarioCupom}` : (tableIds.tbCrediarioCupom ? `#${tableIds.tbCrediarioCupom}` : 'NÃO ENCONTRADO')}`,
                `  • Valor Crediário: ${fmtMoeda(cupom?.vlCrediario || 0)} | Valor Quitado: ${fmtMoeda(cupom?.vlQuitado || 0)}`,
                ``,
                `CONCILIAÇÃO COM O EXTRATO DA CONTA:`,
                `  • Status Geral: ${isReconciled ? '✅ CONCILIADO COM O EXTRATO' : (missingBaixaTie ? '⚠️ PENDENTE DE AMARRAÇÃO (tbConta/tbContaBaixa)' : '⚠️ PENDENTE DE CONCILIAÇÃO')}`,
                `  • Conciliação no Solidcon: ${isReconciledSolidcon ? `✅ SIM (Extrato #${(tableIds.tbBancoContaExtrato || []).join(', #') || 'OK'})` : '⚠️ NÃO (Pendente no extrato Solidcon)'}`,
                `  • Conciliação no ERP Keystone: ${isReconciledLocal ? `✅ SIM (${localStatements[0]?.bank_account_name || 'Conta'})` : '⚠️ NÃO (Pendente no ERP)'}`,
                `  • Resumo: ${recon.summary || (isReconciled ? 'Lançamento conciliado no extrato da conta bancária.' : 'Aguardando conferência e conciliação com o extrato bancário.')}`,
                ``,
                `IDENTIFICADORES DE CADA TABELA SOLIDCON:`,
                `  [1] tbCrediarioCupom:          ${tableIds.tbCrediarioCupom ? `#${tableIds.tbCrediarioCupom}` : 'NÃO ENCONTRADO'}`,
                `  [2] tbCrediarioCupomPagamento:  ${tableIds.tbCrediarioCupomPagamento?.length ? tableIds.tbCrediarioCupomPagamento.map((id) => `#${id}`).join(', ') : 'NENHUM'}`,
                `  [3] tbCrediarioDeposito:        ${tableIds.tbCrediarioDeposito?.length ? tableIds.tbCrediarioDeposito.map((id) => `#${id}`).join(', ') : 'NENHUM'}`,
                `  [4] tbBancoContaMovimento:      ${tableIds.tbBancoContaMovimento?.length ? tableIds.tbBancoContaMovimento.map((id) => `#${id}`).join(', ') : 'NENHUM'}`,
                `  [5] tbBancoContaExtrato:        ${tableIds.tbBancoContaExtrato?.length ? tableIds.tbBancoContaExtrato.map((id) => `#${id}`).join(', ') : 'NENHUM'}`,
                `  [6] tbConta:                   ${tableIds.tbConta ? `#${tableIds.tbConta}` : 'NÃO ENCONTRADO'}`,
                `  [7] tbContaBaixa:              ${tableIds.tbContaBaixa?.length ? tableIds.tbContaBaixa.map((id) => `#${id}`).join(', ') : 'NENHUM'}`,
                `  [8] tbContaParcela:            ${tableIds.tbContaParcela?.length ? tableIds.tbContaParcela.map((id) => `#${id}`).join(', ') : 'NENHUM'}`,
                ``,
                `DIAGNÓSTICO E CONSISTÊNCIA:`,
                `  • Status Duplicidade: ${dup.hasDuplicates ? '⚠️ DUPLICIDADE DETECTADA' : '✅ ÍNTEGRO E SEM DUPLICIDADES'}`,
                `  • Amarração para Conciliação: ${missingBaixaTie ? '⚠️ PENDENTE AMARRAÇÃO (tbConta/tbContaBaixa)' : '✅ PRONTO PARA CONCILIAÇÃO'}`,
                `  • Pagamentos Registrados: ${payments.length} linha(s) | Total Pago Solidcon: ${fmtMoeda(totalPago)}`,
                `  • Baixas Registradas: ${contaBaixas.length} linha(s)`,
                `  • Valor Quitado no Cupom: ${fmtMoeda(cupom?.vlQuitado || 0)} (vlCrediario: ${fmtMoeda(cupom?.vlCrediario || 0)})`,
            ];
            if (dup.reasons?.length) {
                lines.push(`  • Motivos/Alertas:`);
                dup.reasons.forEach((r) => lines.push(`     - ${r}`));
            }
            else if (missingBaixaTie) {
                lines.push(`  • Alerta de Conciliação: Movimento bancário precisa ser amarrado a tbConta e tbContaBaixa para o extrato bancário conciliar.`);
            }
            else {
                lines.push(`  • Motivos/Alertas: Nenhum problema ou inconsistência detectada.`);
            }
            if (contaBaixas.length > 0) {
                lines.push(``);
                lines.push(`HISTÓRICO DE BAIXAS REGISTRADAS (tbContaBaixa):`);
                contaBaixas.forEach((cb) => {
                    lines.push(`  [#${cb.cdContaBaixa}] Valor: ${fmtMoeda(cb.vlContaBaixa || cb.vlParcela || 0)} | Data: ${cb.dtContaBaixa ? new Date(cb.dtContaBaixa).toLocaleDateString('pt-BR') : 'N/A'} | Conta: #${cb.cdBancoConta || '-'} (${cb.nmBancoConta || 'N/A'}) | Mov: #${cb.cdBancoContaMovimento || '-'} | Parcela: #${cb.cdContaParcela || '-'} | Histórico: ${cb.Historico || cb.Documento || 'N/A'}`);
                });
            }
            if (payments.length > 0) {
                lines.push(``);
                lines.push(`HISTÓRICO DE PAGAMENTOS (tbCrediarioCupomPagamento):`);
                payments.forEach((p, idx) => {
                    lines.push(`  [#${p.nrPagamento || (idx + 1)}] Valor: ${fmtMoeda(p.vlPago)} | Data: ${p.dtPago ? new Date(p.dtPago).toLocaleDateString('pt-BR') : 'N/A'} | Usuário: ${p.cdUsuarioQuitou || 'N/A'} | Depósito: #${p.cdCrediarioDeposito || '-'} | Movimento Banco: #${p.cdBancoContaMovimento || tableIds.tbBancoContaMovimento?.[0] || '-'} | Obs: ${p.Obs || 'Nenhuma'}`);
                });
            }
            const serverLogs = data.logLines || data.solidcon?.logLines || [];
            if (serverLogs.length > 0) {
                lines.push(``);
                lines.push(`LOG DE EXECUÇÃO DA CONSULTA SOLIDCON:`);
                serverLogs.forEach((l) => lines.push(`  ${l}`));
            }
            lines.push(`======================================================================`);
            logBox.value = lines.join('\n');
        }
    }
    async function handleCancelSolidconBaixa(cdContaBaixa) {
        if (!g_currentSolidconRevenueId)
            return;
        const specificMsg = cdContaBaixa ? `a baixa #${cdContaBaixa}` : `todas as baixas vinculadas`;
        const confirmed = confirm(`Deseja realmente cancelar ${specificMsg} no banco de dados Solidcon?\n\nIsso removerá a baixa em tbContaBaixa, tbContaParcela, tbBancoContaMovimento, tbCrediarioCupomPagamento e estornará a quitação no cupom Solidcon, reabrindo a receita como Pendente no Keystone.`);
        if (!confirmed)
            return;
        const btnTop = document.getElementById('btnCancelSolidconBaixaModal');
        const logBox = document.getElementById('solidconLogDetails');
        const oldHtml = btnTop ? btnTop.innerHTML : '';
        if (btnTop) {
            btnTop.disabled = true;
            btnTop.innerHTML = '<span class="inline-block animate-spin mr-1">↻</span> Cancelando...';
        }
        if (logBox) {
            logBox.value += `\n\n[${new Date().toLocaleTimeString('pt-BR')}] Solicitando cancelamento da baixa no Solidcon (${specificMsg})...`;
        }
        try {
            const response = await api(`/finance/revenues/${g_currentSolidconRevenueId}/solidcon-cancel-baixa`, {
                method: 'POST',
                body: JSON.stringify({
                    cd_conta_baixa: cdContaBaixa || undefined,
                    reopen_revenue: true,
                    cancel_cupom_payment: true
                })
            });
            const resData = response?.data || {};
            const cancelLog = [
                `\n======================================================================`,
                `RESULTADO DO CANCELAMENTO DA BAIXA SOLIDCON:`,
                `Data/Hora: ${new Date().toLocaleString('pt-BR')}`,
                `Status: SUCESSO`,
                `Mensagem: ${response?.message || 'Baixa cancelada no Solidcon.'}`,
                `Baixas Excluídas (tbContaBaixa): ${resData.deletedContaBaixas?.length ? resData.deletedContaBaixas.join(', ') : (resData.deletedContaBaixas || 0)}`,
                `Parcelas Excluídas (tbContaParcela): ${resData.deletedContaParcelas?.length ? resData.deletedContaParcelas.join(', ') : (resData.deletedContaParcelas || 0)}`,
                `Movimentos Bancários Excluídos: ${resData.deletedBankMovements?.length ? resData.deletedBankMovements.join(', ') : 'Nenhum'}`,
                `Pagamentos Excluídos (tbCrediarioCupomPagamento): ${resData.deletedCupomPagamentos || 0}`,
                `Depósitos Excluídos (tbCrediarioDeposito): ${resData.deletedDeposits?.length ? resData.deletedDeposits.join(', ') : 'Nenhum'}`,
                `Cupom Atualizado: vlQuitado = ${resData.updatedCupom?.vlQuitado ?? 'N/A'}, nrPagamentos = ${resData.updatedCupom?.nrPagamentos ?? 'N/A'}`,
                `======================================================================`
            ].join('\n');
            if (logBox)
                logBox.value += cancelLog;
            UI.showAlert('alertMessage', response?.message || 'Baixa cancelada com sucesso no Solidcon e receita reaberta!', 'success');
            // Re-consulta os detalhes para atualizar a tela
            await openSolidconDetailsModal(g_currentSolidconRevenueId);
            // Atualiza a listagem de receitas em segundo plano
            fetchRevenues();
        }
        catch (err) {
            if (logBox)
                logBox.value += `\n[ERRO AO CANCELAR BAIXA] ${err.message || 'Falha na execução.'}`;
            UI.showAlert('alertMessage', err.message || 'Erro ao cancelar baixa no Solidcon.', 'error');
        }
        finally {
            if (btnTop) {
                btnTop.innerHTML = oldHtml;
                btnTop.disabled = false;
            }
        }
    }
    async function handleFixSolidconDuplicates() {
        if (!g_currentSolidconRevenueId)
            return;
        const confirmed = confirm('Deseja realmente consolidar os lançamentos e remover os registros duplicados no Solidcon?\n\nEsta operação manterá o primeiro pagamento canônico, excluirá as linhas duplicadas em tbCrediarioCupomPagamento, tbCrediarioDeposito e tbBancoContaMovimento, e recalculará o valor quitado do cupom.');
        if (!confirmed)
            return;
        const btn = document.getElementById('btnFixSolidconDuplicates');
        const logBox = document.getElementById('solidconLogDetails');
        const oldHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="inline-block animate-spin mr-1">↻</span> Corrigindo...';
        }
        if (logBox) {
            logBox.value += `\n\n[${new Date().toLocaleTimeString('pt-BR')}] Iniciando consolidação e remoção de duplicidades no Solidcon...`;
        }
        try {
            const response = await api(`/finance/revenues/${g_currentSolidconRevenueId}/solidcon-fix-duplicates`, {
                method: 'POST'
            });
            const resData = response?.data || {};
            const fixLog = [
                `\n======================================================================`,
                `RESULTADO DA CONSOLIDAÇÃO / CORREÇÃO:`,
                `Data/Hora: ${new Date().toLocaleString('pt-BR')}`,
                `Status: SUCESSO`,
                `Mensagem: ${response?.message || 'Duplicidades corrigidas no Solidcon.'}`,
                `Pagamentos Excluídos: ${resData.deletedPayments || 0}`,
                `Depósitos Excluídos: ${resData.deletedDeposits?.length ? resData.deletedDeposits.join(', ') : 'Nenhum'}`,
                `Movimentos Bancários Excluídos: ${resData.deletedBankMovements?.length ? resData.deletedBankMovements.join(', ') : 'Nenhum'}`,
                `Cupom Atualizado: vlQuitado = ${resData.updatedCupom?.vlQuitado ?? 'N/A'}, nrPagamentos = ${resData.updatedCupom?.nrPagamentos ?? 'N/A'}`,
                `======================================================================`
            ].join('\n');
            if (logBox)
                logBox.value += fixLog;
            UI.showAlert('alertMessage', response?.message || 'Duplicidades corrigidas com sucesso no Solidcon!', 'success');
            // Re-consulta os detalhes para atualizar a tela
            await openSolidconDetailsModal(g_currentSolidconRevenueId);
            // Atualiza a listagem de receitas em segundo plano
            fetchRevenues();
        }
        catch (err) {
            if (logBox)
                logBox.value += `\n[ERRO AO CORRIGIR] ${err.message || 'Falha na execução.'}`;
            UI.showAlert('alertMessage', err.message || 'Erro ao corrigir duplicidades no Solidcon.', 'error');
        }
        finally {
            if (btn) {
                btn.innerHTML = oldHtml;
                btn.disabled = false;
            }
        }
    }
    async function handleTieSolidconMovement() {
        if (!g_currentSolidconRevenueId)
            return;
        const confirmed = confirm('Deseja criar a amarração em tbConta, tbContaBaixa e tbContaParcela no Solidcon?\n\nIsso permitirá que o movimento bancário deste recebimento seja conciliado com o extrato bancário no Solidcon.');
        if (!confirmed)
            return;
        const btn = document.getElementById('btnTieSolidconContaBaixa');
        const logBox = document.getElementById('solidconLogDetails');
        const oldHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="inline-block animate-spin mr-1">↻</span> Amarrando...';
        }
        if (logBox) {
            logBox.value += `\n\n[${new Date().toLocaleTimeString('pt-BR')}] Iniciando amarração de tbConta, tbContaBaixa e tbContaParcela no Solidcon...`;
        }
        try {
            const response = await api(`/finance/revenues/${g_currentSolidconRevenueId}/solidcon-tie-movement`, {
                method: 'POST'
            });
            UI.showAlert('alertMessage', response?.message || 'Amarração para conciliação bancária realizada com sucesso!', 'success');
            // Re-consulta os detalhes para atualizar a tela
            await openSolidconDetailsModal(g_currentSolidconRevenueId);
            // Atualiza a listagem de receitas em segundo plano
            fetchRevenues();
        }
        catch (err) {
            if (logBox)
                logBox.value += `\n[ERRO AO AMARRAR] ${err.message || 'Falha na execução.'}`;
            UI.showAlert('alertMessage', err.message || 'Erro ao amarrar movimento bancário no Solidcon.', 'error');
        }
        finally {
            if (btn) {
                btn.innerHTML = oldHtml;
                btn.disabled = false;
            }
        }
    }
    async function handleLaunchSolidconBaixa() {
        if (!g_currentSolidconRevenueId)
            return;
        const confirmed = confirm('Deseja realizar o lançamento da baixa no Solidcon agora?\n\nIsso criará a movimentação bancária (tbBancoContaMovimento), o depósito (tbCrediarioDeposito), o pagamento do cupom (tbCrediarioCupomPagamento) e atualizará o cupom (tbCrediarioCupom), amarrando perfeitamente todas as tabelas.');
        if (!confirmed)
            return;
        const btn = document.getElementById('btnLaunchSolidconBaixa');
        const logBox = document.getElementById('solidconLogDetails');
        const oldHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="inline-block animate-spin mr-1">↻</span> Lançando...';
        }
        if (logBox) {
            logBox.value += `\n\n[${new Date().toLocaleTimeString('pt-BR')}] Iniciando lançamento e amarração completa de tabelas no Solidcon...`;
        }
        try {
            const response = await api('/finance/revenues/solidcon-sync-baixas', {
                method: 'POST',
                body: JSON.stringify({ transaction_ids: [g_currentSolidconRevenueId] })
            });
            UI.showAlert('alertMessage', response?.message || 'Lançamento efetuado no Solidcon com sucesso!', 'success');
            // Reabre os detalhes para atualizar os dados em tela
            await openSolidconDetailsModal(g_currentSolidconRevenueId);
            // Atualiza a listagem de receitas em segundo plano
            fetchRevenues();
        }
        catch (err) {
            if (logBox)
                logBox.value += `\n[ERRO AO LANÇAR] ${err.message || 'Falha na operação.'}`;
            UI.showAlert('alertMessage', err.message || 'Erro ao realizar lançamento no Solidcon.', 'error');
        }
        finally {
            if (btn) {
                btn.innerHTML = oldHtml;
                btn.disabled = false;
            }
        }
    }
    function closeSolidconDetailsModal() {
        document.getElementById('solidconDetailsModal')?.classList.add('hidden');
        g_currentSolidconRevenueId = null;
    }
    // ══════════════════════════════════════════════════════════════
    // MODAL: Amarração em Lote Solidcon (tbConta / tbContaBaixa)
    // ══════════════════════════════════════════════════════════════
    let g_scannedUntiedMovements = [];
    function openTieAllSolidconModal() {
        const modal = document.getElementById('modalTieAllSolidcon');
        if (!modal)
            return;
        modal.classList.remove('hidden');
        // Reset fields
        const untiedCountEl = document.getElementById('tieAllUntiedCount');
        const depositsCountEl = document.getElementById('tieAllDepositsCount');
        const movementsCountEl = document.getElementById('tieAllMovementsCount');
        const itemsCountEl = document.getElementById('tieAllItemsCount');
        const statusTextEl = document.getElementById('tieAllStatusText');
        const tbody = document.getElementById('tieAllItemsTbody');
        const logsContainer = document.getElementById('tieAllLogsContainer');
        const logsContent = document.getElementById('tieAllLogsContent');
        if (untiedCountEl)
            untiedCountEl.textContent = '-';
        if (depositsCountEl)
            depositsCountEl.textContent = '-';
        if (movementsCountEl)
            movementsCountEl.textContent = '-';
        if (itemsCountEl)
            itemsCountEl.textContent = '0 itens';
        if (logsContainer)
            logsContainer.classList.add('hidden');
        if (logsContent)
            logsContent.innerHTML = '';
        if (statusTextEl)
            statusTextEl.innerHTML = 'Clique em <strong>Escanear Solidcon</strong> para listar todos os lançamentos sem amarração contábil.';
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-6 text-center text-gray-400 dark:text-gray-500 italic">Clique em "Escanear Solidcon" para carregar a lista de movimentos sem amarração.</td></tr>`;
        }
        // Setup source tab click listeners
        const tabWeb = document.getElementById('tabTieSourceWeb');
        const tabSolidcon = document.getElementById('tabTieSourceSolidcon');
        if (tabWeb && tabSolidcon) {
            tabWeb.onclick = () => setTieModalSource('web');
            tabSolidcon.onclick = () => setTieModalSource('solidcon');
        }
        setTieModalSource('web', false);
        // Auto-scan on open
        handleScanUntiedSolidcon();
    }
    let g_currentTieSource = 'web';
    function setTieModalSource(source, triggerScan = true) {
        g_currentTieSource = source;
        const tabWeb = document.getElementById('tabTieSourceWeb');
        const tabSolidcon = document.getElementById('tabTieSourceSolidcon');
        const tieKpiLabel1 = document.getElementById('tieKpiLabel1');
        const tieKpiDesc1 = document.getElementById('tieKpiDesc1');
        const tieKpiLabel2 = document.getElementById('tieKpiLabel2');
        const tieKpiDesc2 = document.getElementById('tieKpiDesc2');
        const tieKpiLabel3 = document.getElementById('tieKpiLabel3');
        const tieKpiDesc3 = document.getElementById('tieKpiDesc3');
        const btnScanLabel = document.getElementById('btnScanLabel');
        const btnTieLabel = document.getElementById('btnTieLabel');
        const thead = document.getElementById('tieAllItemsThead');
        if (source === 'web') {
            if (tabWeb) {
                tabWeb.className = 'flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer';
            }
            if (tabSolidcon) {
                tabSolidcon.className = 'flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer';
            }
            if (tieKpiLabel1)
                tieKpiLabel1.textContent = 'Total de Receitas Web';
            if (tieKpiDesc1)
                tieKpiDesc1.textContent = 'Receitas cadastradas no ERP';
            if (tieKpiLabel2)
                tieKpiLabel2.textContent = 'Amarradas no Solidcon';
            if (tieKpiDesc2)
                tieKpiDesc2.textContent = 'tbConta & tbContaBaixa OK';
            if (tieKpiLabel3)
                tieKpiLabel3.textContent = 'Pendentes de Amarração';
            if (tieKpiDesc3)
                tieKpiDesc3.textContent = 'Movimento sem tbConta/Baixa';
            if (btnScanLabel)
                btnScanLabel.textContent = 'Escanear Base Web';
            if (btnTieLabel)
                btnTieLabel.textContent = 'Amarrar Receitas Pendentes';
            if (thead) {
                thead.innerHTML = `
                <tr>
                    <th class="px-3 py-2">ID ERP / Cupom</th>
                    <th class="px-3 py-2">Cliente / Descrição</th>
                    <th class="px-3 py-2">Data</th>
                    <th class="px-3 py-2 text-right">Valor</th>
                    <th class="px-3 py-2">Status ERP</th>
                    <th class="px-3 py-2">Movimento Solidcon</th>
                    <th class="px-3 py-2 text-center">Amarração</th>
                </tr>
            `;
            }
        }
        else {
            if (tabWeb) {
                tabWeb.className = 'flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer';
            }
            if (tabSolidcon) {
                tabSolidcon.className = 'flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer';
            }
            if (tieKpiLabel1)
                tieKpiLabel1.textContent = 'Pendentes de Amarração';
            if (tieKpiDesc1)
                tieKpiDesc1.textContent = 'Sem vínculo no extrato';
            if (tieKpiLabel2)
                tieKpiLabel2.textContent = 'Depósitos Crediário';
            if (tieKpiDesc2)
                tieKpiDesc2.textContent = 'tbCrediarioDeposito';
            if (tieKpiLabel3)
                tieKpiLabel3.textContent = 'Movimentações Banco';
            if (tieKpiDesc3)
                tieKpiDesc3.textContent = 'tbBancoContaMovimento';
            if (btnScanLabel)
                btnScanLabel.textContent = 'Escanear Solidcon';
            if (btnTieLabel)
                btnTieLabel.textContent = 'Amarrar Todos no Solidcon';
            if (thead) {
                thead.innerHTML = `
                <tr>
                    <th class="px-3 py-2">Movimento</th>
                    <th class="px-3 py-2">Doc / Cupom</th>
                    <th class="px-3 py-2">Filial / Conta</th>
                    <th class="px-3 py-2">Data</th>
                    <th class="px-3 py-2 text-right">Valor</th>
                    <th class="px-3 py-2">Histórico</th>
                    <th class="px-3 py-2 text-center">Status</th>
                </tr>
            `;
            }
        }
        if (triggerScan) {
            handleScanUntiedSolidcon();
        }
    }
    function closeTieAllSolidconModal() {
        document.getElementById('modalTieAllSolidcon')?.classList.add('hidden');
    }
    async function handleScanUntiedSolidcon() {
        const btn = document.getElementById('btnScanUntiedSolidcon');
        const btnExecute = document.getElementById('btnExecuteTieAllSolidcon');
        const statusTextEl = document.getElementById('tieAllStatusText');
        const tbody = document.getElementById('tieAllItemsTbody');
        const kpi1El = document.getElementById('tieAllUntiedCount');
        const kpi2El = document.getElementById('tieAllDepositsCount');
        const kpi3El = document.getElementById('tieAllMovementsCount');
        const itemsCountEl = document.getElementById('tieAllItemsCount');
        const oldHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="inline-block animate-spin mr-1">↻</span> Escaneando...';
        }
        if (btnExecute)
            btnExecute.disabled = true;
        if (statusTextEl)
            statusTextEl.innerHTML = g_currentTieSource === 'web' ? 'Consultando receitas da base Web e analisando Solidcon...' : 'Consultando banco de dados Solidcon...';
        if (tbody)
            tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-6 text-center text-gray-400 dark:text-gray-500"><span class="inline-block animate-spin mr-2">↻</span> Escaneando dados...</td></tr>`;
        try {
            const response = await api(`/finance/revenues/solidcon-untied-summary?source=${g_currentTieSource}&limit=1000`, { method: 'GET' });
            const data = response?.data || response;
            const items = data?.items || [];
            g_scannedUntiedMovements = items;
            if (g_currentTieSource === 'web') {
                if (kpi1El)
                    kpi1El.textContent = String(data?.totalWebRevenues ?? items.length);
                if (kpi2El)
                    kpi2El.textContent = String(data?.totalTied ?? 0);
                if (kpi3El)
                    kpi3El.textContent = String(data?.totalUntied ?? 0);
                if (itemsCountEl)
                    itemsCountEl.textContent = `${items.length} receitas`;
                const untiedItems = items.filter((i) => i.tieStatus === 'untied' || (i.cdBancoContaMovimento && (!i.cdContaBaixa || !i.cdConta)));
                if (untiedItems.length === 0) {
                    if (statusTextEl)
                        statusTextEl.innerHTML = '<span class="text-emerald-600 dark:text-emerald-400 font-bold">✅ Tudo em dia!</span> Todas as receitas da base Web que possuem movimentações no Solidcon já estão perfeitamente amarradas (tbConta / tbContaBaixa / tbContaParcela).';
                }
                else {
                    if (statusTextEl)
                        statusTextEl.innerHTML = `Encontrada(s) <strong>${untiedItems.length}</strong> receita(s) com movimentos bancários no Solidcon sem amarração contábil.`;
                    if (btnExecute)
                        btnExecute.disabled = false;
                }
            }
            else {
                if (kpi1El)
                    kpi1El.textContent = String(data?.totalUntied || items.length);
                if (kpi2El)
                    kpi2El.textContent = String(data?.depositsCount ?? '-');
                if (kpi3El)
                    kpi3El.textContent = String(data?.movementsCount ?? '-');
                if (itemsCountEl)
                    itemsCountEl.textContent = `${items.length} movimentos`;
                if (items.length === 0) {
                    if (statusTextEl)
                        statusTextEl.innerHTML = '<span class="text-emerald-600 dark:text-emerald-400 font-bold">✅ Excelente!</span> Todos os movimentos bancários no Solidcon já possuem amarração contábil completa.';
                }
                else {
                    if (statusTextEl)
                        statusTextEl.innerHTML = `Encontrado(s) <strong>${items.length}</strong> movimento(s) pendente(s) de amarração contábil no Solidcon.`;
                    if (btnExecute)
                        btnExecute.disabled = false;
                }
            }
            renderUntiedItemsTable(items);
        }
        catch (err) {
            if (statusTextEl)
                statusTextEl.innerHTML = `<span class="text-red-500 font-bold">❌ Erro ao escanear:</span> ${err.message || 'Falha de comunicação.'}`;
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-6 text-center text-red-500 font-medium">❌ Erro ao escanear: ${err.message || 'Erro desconhecido'}</td></tr>`;
            }
        }
        finally {
            if (btn) {
                btn.innerHTML = oldHtml;
                btn.disabled = false;
            }
        }
    }
    function renderUntiedItemsTable(items) {
        const tbody = document.getElementById('tieAllItemsTbody');
        if (!tbody)
            return;
        if (!items || items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-6 text-center text-gray-400 italic">Nenhum lançamento encontrado.</td></tr>`;
            return;
        }
        if (g_currentTieSource === 'web') {
            tbody.innerHTML = items.map(item => {
                const doc = item.nrCupom ? `Cupom #${item.nrCupom}` : (item.solidcon_key ? `Cupom #${item.solidcon_key}` : `#${item.id}`);
                const desc = item.customer_name && item.customer_name !== 'Sem cliente associado' ? item.customer_name : (item.description || '-');
                const dtStr = item.date ? new Date(item.date).toLocaleDateString('pt-BR') : '-';
                const valStr = Number(item.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const movInfo = item.cdBancoContaMovimento ? `Mov #${item.cdBancoContaMovimento}` : (item.cdCrediarioCupom ? `Cupom #${item.cdCrediarioCupom}` : '<span class="text-gray-400 italic">Sem movimento</span>');
                let statusBadge = item.status === 'paid'
                    ? '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">Pago</span>'
                    : '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">Pendente</span>';
                let tieBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">Pendente</span>';
                if (item.tieStatus === 'tied' || (item.cdConta && item.cdContaBaixa)) {
                    tieBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">Amarrado (#${item.cdConta || ''})</span>`;
                }
                else if (item.tieStatus === 'pending_solidcon') {
                    tieBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">Pendente Solidcon</span>`;
                }
                else if (item.tieStatus === 'not_found') {
                    tieBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">Não localizado</span>`;
                }
                return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
                    <td class="px-3 py-2 font-mono font-bold text-gray-900 dark:text-white">${doc}</td>
                    <td class="px-3 py-2 text-gray-700 dark:text-gray-300 font-medium max-w-xs truncate" title="${desc}">${desc}</td>
                    <td class="px-3 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">${dtStr}</td>
                    <td class="px-3 py-2 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">${valStr}</td>
                    <td class="px-3 py-2">${statusBadge}</td>
                    <td class="px-3 py-2 font-mono text-gray-600 dark:text-gray-300">${movInfo}</td>
                    <td class="px-3 py-2 text-center">${tieBadge}</td>
                </tr>
            `;
            }).join('');
        }
        else {
            tbody.innerHTML = items.map(item => {
                const movId = item.cdBancoContaMovimento;
                const doc = item.nrCupom ? `Cupom #${item.nrCupom}` : (item.numero || '-');
                const filial = item.cdFilial ? `F${item.cdFilial}` : 'F1';
                const conta = item.cdBancoConta ? `Conta ${item.cdBancoConta}` : '-';
                const dtStr = item.dtLancamento ? new Date(item.dtLancamento).toLocaleDateString('pt-BR') : '-';
                const valStr = Number(item.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const hist = item.historico || 'Recebimento Crediario';
                let badge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">Pendente</span>';
                if (item.status === 'tied') {
                    badge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">Amarrado (#${item.cdConta || ''})</span>`;
                }
                else if (item.status === 'already_tied') {
                    badge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">Já Amarrado</span>`;
                }
                else if (item.status === 'error') {
                    badge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300" title="${item.error || ''}">Erro</span>`;
                }
                return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
                    <td class="px-3 py-2 font-mono font-bold text-gray-900 dark:text-white">#${movId}</td>
                    <td class="px-3 py-2 text-gray-700 dark:text-gray-300 font-medium">${doc}</td>
                    <td class="px-3 py-2 text-gray-500 dark:text-gray-400">${filial} • ${conta}</td>
                    <td class="px-3 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">${dtStr}</td>
                    <td class="px-3 py-2 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">${valStr}</td>
                    <td class="px-3 py-2 text-gray-500 dark:text-gray-400 max-w-xs truncate" title="${hist}">${hist}</td>
                    <td class="px-3 py-2 text-center">${badge}</td>
                </tr>
            `;
            }).join('');
        }
    }
    async function handleExecuteTieAllSolidcon() {
        const isWeb = g_currentTieSource === 'web';
        let targetItems = g_scannedUntiedMovements;
        if (isWeb) {
            targetItems = targetItems.filter((i) => i.tieStatus === 'untied' || (i.cdBancoContaMovimento && (!i.cdContaBaixa || !i.cdConta)));
        }
        const count = targetItems.length;
        if (count === 0) {
            UI.showAlert('alertMessage', 'Nenhum lançamento pendente de amarração para processar.', 'warning');
            return;
        }
        const promptText = isWeb
            ? `Deseja executar a amarração contábil de ${count} receita(s) da base Web no Solidcon?\n\nIsso criará as amarrações em tbConta (Tipo 4 Receita), tbContaBaixa e tbContaParcela no Solidcon para conciliação no extrato bancário.`
            : `Deseja executar a amarração contábil de ${count} movimento(s) bancário(s) no Solidcon?\n\nPara cada movimento, serão gerados os registros correspondentes em tbConta, tbContaBaixa e tbContaParcela com o vínculo bancário para conciliação.`;
        const confirmed = confirm(promptText);
        if (!confirmed)
            return;
        const btn = document.getElementById('btnExecuteTieAllSolidcon');
        const btnScan = document.getElementById('btnScanUntiedSolidcon');
        const statusTextEl = document.getElementById('tieAllStatusText');
        const logsContainer = document.getElementById('tieAllLogsContainer');
        const logsContent = document.getElementById('tieAllLogsContent');
        const oldHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="inline-block animate-spin mr-1">↻</span> Processando...';
        }
        if (btnScan)
            btnScan.disabled = true;
        if (statusTextEl)
            statusTextEl.innerHTML = '<span class="text-indigo-600 dark:text-indigo-400 font-semibold">Executando amarração contábil...</span>';
        if (logsContainer)
            logsContainer.classList.remove('hidden');
        if (logsContent)
            logsContent.innerHTML = `<div class="text-indigo-400 font-bold">[${new Date().toLocaleTimeString('pt-BR')}] Iniciando amarração contábil (${isWeb ? 'Base Web' : 'Base Solidcon'})...</div>`;
        try {
            const response = await api('/finance/revenues/solidcon-tie-all', {
                method: 'POST',
                body: JSON.stringify({
                    source: g_currentTieSource,
                    limit: 2000
                })
            });
            const data = response?.data || response;
            const totalTied = data?.totalTied ?? 0;
            const alreadyTied = data?.alreadyTied ?? 0;
            const errorsCount = data?.errorsCount ?? 0;
            const items = data?.items || [];
            const logLines = data?.logLines || [];
            if (logsContent && logLines.length > 0) {
                logsContent.innerHTML = logLines.map((l) => `<div class="${l.startsWith('❌') ? 'text-red-400' : (l.startsWith('✅') ? 'text-emerald-400' : 'text-gray-300')}">${l}</div>`).join('');
            }
            if (statusTextEl) {
                statusTextEl.innerHTML = `<span class="text-emerald-600 dark:text-emerald-400 font-bold">✅ Amarração concluída!</span> ${totalTied} amarrados com sucesso, ${alreadyTied} já amarrados, ${errorsCount} erro(s).`;
            }
            UI.showAlert('alertMessage', response?.message || `Amarração finalizada com sucesso! ${totalTied} lançamento(s) integrado(s) para conciliação no extrato bancário.`, 'success');
            if (items.length > 0) {
                renderUntiedItemsTable(items);
            }
            // Recarrega listagem de receitas em segundo plano
            fetchRevenues();
        }
        catch (err) {
            if (statusTextEl)
                statusTextEl.innerHTML = `<span class="text-red-500 font-bold">❌ Erro ao executar:</span> ${err.message || 'Falha na amarração em lote.'}`;
            if (logsContent) {
                logsContent.innerHTML += `<div class="text-red-400 font-bold">[ERRO FATAL] ${err.message || 'Falha de comunicação'}</div>`;
            }
            UI.showAlert('alertMessage', err.message || 'Erro ao executar amarração contábil no Solidcon.', 'error');
        }
        finally {
            if (btn) {
                btn.innerHTML = oldHtml;
                btn.disabled = false;
            }
            if (btnScan)
                btnScan.disabled = false;
        }
    }
    // Bind events for solidcon details modal
    document.getElementById('btnCloseSolidconDetailsModal')?.addEventListener('click', closeSolidconDetailsModal);
    document.getElementById('btnFecharSolidconDetailsModal')?.addEventListener('click', closeSolidconDetailsModal);
    document.getElementById('solidconDetailsModalBackdrop')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('solidconDetailsModalBackdrop')) {
            closeSolidconDetailsModal();
        }
    });
    document.getElementById('btnFixSolidconDuplicates')?.addEventListener('click', handleFixSolidconDuplicates);
    document.getElementById('btnTieSolidconContaBaixa')?.addEventListener('click', handleTieSolidconMovement);
    document.getElementById('btnLaunchSolidconBaixa')?.addEventListener('click', handleLaunchSolidconBaixa);
    document.getElementById('btnCancelSolidconBaixaModal')?.addEventListener('click', () => handleCancelSolidconBaixa());
    document.getElementById('scContaBaixaTableBody')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-cancel-conta-baixa');
        if (!btn)
            return;
        const baixaId = btn.getAttribute('data-id');
        handleCancelSolidconBaixa(baixaId || undefined);
    });
    // Bind events for batch tie modal
    document.getElementById('btnOpenTieAllSolidconModal')?.addEventListener('click', openTieAllSolidconModal);
    document.getElementById('btnFecharTieAllSolidconModal')?.addEventListener('click', closeTieAllSolidconModal);
    document.getElementById('btnFecharTieAllSolidconModalX')?.addEventListener('click', closeTieAllSolidconModal);
    document.getElementById('tieAllSolidconBackdrop')?.addEventListener('click', closeTieAllSolidconModal);
    document.getElementById('btnScanUntiedSolidcon')?.addEventListener('click', handleScanUntiedSolidcon);
    document.getElementById('btnExecuteTieAllSolidcon')?.addEventListener('click', handleExecuteTieAllSolidcon);
    document.getElementById('btnCopySolidconLog')?.addEventListener('click', () => {
        const logBox = document.getElementById('solidconLogDetails');
        if (logBox && logBox.value) {
            navigator.clipboard.writeText(logBox.value).then(() => {
                UI.showAlert('alertMessage', 'Log copiado para a área de transferência!', 'success');
            }).catch(() => {
                logBox.select();
                document.execCommand('copy');
                UI.showAlert('alertMessage', 'Log copiado!', 'success');
            });
        }
    });
    // Bind events for errors modal
    document.getElementById('btnCloseSolidconSyncErrorsModal')?.addEventListener('click', closeSolidconSyncErrorsModal);
    document.getElementById('btnOkSolidconSyncErrorsModal')?.addEventListener('click', closeSolidconSyncErrorsModal);
    document.getElementById('solidconSyncErrorsModalBackdrop')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('solidconSyncErrorsModalBackdrop')) {
            closeSolidconSyncErrorsModal();
        }
    });
    // ─────────────────────────────────────────────────────────────────────────────
    // AUDITORIA DE ENVIOS WHATSAPP
    // ─────────────────────────────────────────────────────────────────────────────
    let g_whatsappAuditCurrentPage = 1;
    let g_whatsappAuditLimit = 20;
    let g_whatsappAuditTransactionFilter = null;
    let g_whatsappAuditCache = [];
    let g_whatsappAuditPagination = { page: 1, totalPages: 1, total: 0 };
    function formatPhoneDisplay(rawPhone) {
        if (!rawPhone)
            return '-';
        const clean = String(rawPhone).replace(/\D/g, '');
        if (clean.length === 11) {
            return `(${clean.substring(0, 2)}) ${clean.substring(2, 7)}-${clean.substring(7)}`;
        }
        if (clean.length === 10) {
            return `(${clean.substring(0, 2)}) ${clean.substring(2, 6)}-${clean.substring(6)}`;
        }
        if (clean.length === 13 && clean.startsWith('55')) {
            const without55 = clean.substring(2);
            return `+55 (${without55.substring(0, 2)}) ${without55.substring(2, 7)}-${without55.substring(7)}`;
        }
        return rawPhone;
    }
    function openRevenueWhatsappAuditModal(transactionPublicId) {
        g_whatsappAuditTransactionFilter = transactionPublicId || null;
        g_whatsappAuditCurrentPage = 1;
        const banner = document.getElementById('whatsappAuditTransactionBanner');
        const bannerId = document.getElementById('whatsappAuditTransactionBannerId');
        if (transactionPublicId) {
            if (banner) {
                banner.classList.remove('hidden');
                banner.classList.add('flex');
            }
            if (bannerId)
                bannerId.textContent = transactionPublicId;
        }
        else {
            if (banner) {
                banner.classList.add('hidden');
                banner.classList.remove('flex');
            }
        }
        const modal = document.getElementById('revenueWhatsappAuditModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
        loadRevenueWhatsappAudits(1);
    }
    function closeRevenueWhatsappAuditModal() {
        const modal = document.getElementById('revenueWhatsappAuditModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        g_whatsappAuditTransactionFilter = null;
    }
    async function loadRevenueWhatsappAudits(page = 1) {
        g_whatsappAuditCurrentPage = page;
        const loading = document.getElementById('whatsappAuditLoading');
        if (loading) {
            loading.classList.remove('hidden');
            loading.classList.add('flex');
        }
        try {
            const searchInput = document.getElementById('whatsappAuditFilterSearch');
            const statusSelect = document.getElementById('whatsappAuditFilterStatus');
            const originSelect = document.getElementById('whatsappAuditFilterOrigin');
            const billingTypeSelect = document.getElementById('whatsappAuditFilterBillingType');
            const params = new URLSearchParams();
            params.append('page', String(page));
            params.append('limit', String(g_whatsappAuditLimit));
            if (searchInput && searchInput.value.trim()) {
                params.append('search', searchInput.value.trim());
            }
            if (statusSelect && statusSelect.value) {
                params.append('status', statusSelect.value);
            }
            if (originSelect && originSelect.value !== '') {
                params.append('isAutomatic', originSelect.value);
            }
            if (billingTypeSelect && billingTypeSelect.value) {
                params.append('billingType', billingTypeSelect.value);
            }
            if (g_whatsappAuditTransactionFilter) {
                params.append('transactionPublicId', g_whatsappAuditTransactionFilter);
            }
            const res = await api(`/finance/revenues/whatsapp-audit?${params.toString()}`);
            g_whatsappAuditCache = res.data || [];
            g_whatsappAuditPagination = res.pagination || { page: 1, totalPages: 1, total: 0 };
            renderRevenueWhatsappAudits(res.data || [], res.summary || {}, res.pagination || {});
        }
        catch (err) {
            console.error('Erro ao carregar auditoria WhatsApp:', err);
            UI.showAlert('alertMessage', `Erro ao carregar auditoria: ${err.message || 'Falha de comunicação'}`, 'error');
        }
        finally {
            if (loading) {
                loading.classList.add('hidden');
                loading.classList.remove('flex');
            }
        }
    }
    function renderRevenueWhatsappAudits(data, summary, pagination) {
        const total = Number(summary.total) || 0;
        const success = Number(summary.success) || 0;
        const failed = Number(summary.failed) || 0;
        const automatic = Number(summary.automatic) || 0;
        const manual = Number(summary.manual) || 0;
        const successPct = total > 0 ? Math.round((success / total) * 100) : 0;
        const failedPct = total > 0 ? Math.round((failed / total) * 100) : 0;
        // KPI cards
        const kpiTotal = document.getElementById('auditKpiTotal');
        const kpiSuccess = document.getElementById('auditKpiSuccess');
        const kpiSuccessPct = document.getElementById('auditKpiSuccessPct');
        const kpiFailed = document.getElementById('auditKpiFailed');
        const kpiFailedPct = document.getElementById('auditKpiFailedPct');
        const kpiAuto = document.getElementById('auditKpiAuto');
        const kpiManual = document.getElementById('auditKpiManual');
        const totalBadge = document.getElementById('whatsappAuditTotalBadge');
        if (kpiTotal)
            kpiTotal.textContent = String(total);
        if (kpiSuccess)
            kpiSuccess.textContent = String(success);
        if (kpiSuccessPct)
            kpiSuccessPct.textContent = `${successPct}%`;
        if (kpiFailed)
            kpiFailed.textContent = String(failed);
        if (kpiFailedPct)
            kpiFailedPct.textContent = `${failedPct}%`;
        if (kpiAuto)
            kpiAuto.textContent = String(automatic);
        if (kpiManual)
            kpiManual.textContent = String(manual);
        if (totalBadge)
            totalBadge.textContent = `${total} registro(s)`;
        // Pagination
        const page = pagination.page || 1;
        const totalPages = pagination.totalPages || 1;
        const startRecord = total > 0 ? (page - 1) * g_whatsappAuditLimit + 1 : 0;
        const endRecord = Math.min(page * g_whatsappAuditLimit, total);
        const paginationInfo = document.getElementById('whatsappAuditPaginationInfo');
        const pageNumber = document.getElementById('whatsappAuditPageNumber');
        const prevBtn = document.getElementById('btnAuditPrevPage');
        const nextBtn = document.getElementById('btnAuditNextPage');
        if (paginationInfo)
            paginationInfo.textContent = `Mostrando ${startRecord} a ${endRecord} de ${total} registros`;
        if (pageNumber)
            pageNumber.textContent = `${page} / ${totalPages}`;
        if (prevBtn)
            prevBtn.disabled = page <= 1;
        if (nextBtn)
            nextBtn.disabled = page >= totalPages;
        // Table rows
        const tbody = document.getElementById('whatsappAuditTableBody');
        const emptyState = document.getElementById('whatsappAuditEmptyState');
        if (!tbody)
            return;
        if (!data || data.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) {
                emptyState.classList.remove('hidden');
                emptyState.classList.add('flex');
            }
            return;
        }
        if (emptyState) {
            emptyState.classList.add('hidden');
            emptyState.classList.remove('flex');
        }
        tbody.innerHTML = data.map((row) => {
            const isSuccess = row.status === 'success';
            const isAuto = Number(row.is_automatic) === 1;
            const dateFormatted = row.created_at ? new Date(row.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
            const formattedAmount = row.transaction_amount ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(row.transaction_amount)) : '';
            const originBadge = isAuto
                ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40 whitespace-nowrap">Automático</span>`
                : `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-900/40 whitespace-nowrap">Manual</span>`;
            let billingTypeBadge = '';
            const bType = String(row.billing_type || 'boleto').toLowerCase();
            if (bType === 'boleto') {
                billingTypeBadge = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/30">Boleto</span>`;
            }
            else if (bType === 'pix') {
                billingTypeBadge = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-50 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-900/30">PIX</span>`;
            }
            else {
                billingTypeBadge = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/30">Recibo</span>`;
            }
            const statusBadge = isSuccess
                ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 shadow-2xs">
                <svg class="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                Enviado
               </span>`
                : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800/40 shadow-2xs" title="${row.error_message || 'Falha no disparo'}">
                <svg class="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                Falhou
               </span>`;
            return `
            <tr class="hover:bg-gray-50/80 dark:hover:bg-slate-800/60 transition-colors">
                <td class="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-gray-500 dark:text-gray-400">
                    ${dateFormatted}
                </td>
                <td class="px-3 py-3 whitespace-nowrap">
                    <div class="flex items-center gap-1 flex-wrap">
                        ${originBadge}
                        ${billingTypeBadge}
                    </div>
                </td>
                <td class="px-3 py-3">
                    <div class="font-semibold text-gray-900 dark:text-gray-100 text-xs">${row.recipient_name || 'Não informado'}</div>
                    <div class="font-mono text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                        <svg class="w-3 h-3 text-emerald-500 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 448 512"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L3 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>
                        ${formatPhoneDisplay(row.recipient_phone)}
                    </div>
                </td>
                <td class="px-3 py-3">
                    <div class="text-xs font-medium text-gray-900 dark:text-gray-100 max-w-xs truncate" title="${row.transaction_description || ''}">${row.transaction_description || 'Receita'}</div>
                    <div class="flex items-center gap-1.5 mt-0.5">
                        ${formattedAmount ? `<span class="font-semibold text-emerald-700 dark:text-emerald-400 text-[11px]">${formattedAmount}</span>` : ''}
                        <span class="text-[10px] text-gray-400 font-mono">#${String(row.transaction_public_id).substring(0, 8)}</span>
                    </div>
                </td>
                <td class="px-3 py-3 whitespace-nowrap text-xs text-gray-600 dark:text-gray-300">
                    <div class="flex items-center gap-1">
                        <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                        <span>${row.user_name || (isAuto ? 'Robô / Sistema' : 'Usuário')}</span>
                    </div>
                </td>
                <td class="px-3 py-3 whitespace-nowrap">
                    ${statusBadge}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-right">
                    <button type="button" data-action="open-audit-details" data-audit-id="${row.public_id}"
                        class="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-gray-700 dark:text-gray-200 hover:text-emerald-700 dark:hover:text-emerald-300 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-medium shadow-2xs transition-colors cursor-pointer">
                        <svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        Detalhes
                    </button>
                </td>
            </tr>
        `;
        }).join('');
    }
    function openRevenueWhatsappAuditDetails(auditPublicId) {
        const item = g_whatsappAuditCache.find((x) => x.public_id === auditPublicId);
        if (!item)
            return;
        const isSuccess = item.status === 'success';
        const isAuto = Number(item.is_automatic) === 1;
        // Status icon
        const iconContainer = document.getElementById('auditDetailStatusIcon');
        if (iconContainer) {
            if (isSuccess) {
                iconContainer.className = 'w-8 h-8 rounded-lg flex items-center justify-center text-white bg-emerald-500';
                iconContainer.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
            }
            else {
                iconContainer.className = 'w-8 h-8 rounded-lg flex items-center justify-center text-white bg-red-500';
                iconContainer.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
            }
        }
        // Timestamp
        const tsEl = document.getElementById('auditDetailTimestamp');
        if (tsEl) {
            tsEl.textContent = item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '-';
        }
        // Recipient & phone
        const recEl = document.getElementById('auditDetailRecipient');
        const phoneEl = document.getElementById('auditDetailPhone');
        if (recEl)
            recEl.textContent = item.recipient_name || 'Cliente';
        if (phoneEl)
            phoneEl.textContent = formatPhoneDisplay(item.recipient_phone);
        // Operator & Origin
        const userEl = document.getElementById('auditDetailUser');
        const originBadge = document.getElementById('auditDetailOriginBadge');
        if (userEl)
            userEl.textContent = item.user_name || (isAuto ? 'Robô / Sistema' : 'Usuário');
        if (originBadge) {
            originBadge.textContent = isAuto ? 'Automático (Sistema)' : 'Manual (Usuário)';
            originBadge.className = isAuto
                ? 'inline-flex mt-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                : 'inline-flex mt-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300';
        }
        // Billing type
        const bTypeEl = document.getElementById('auditDetailBillingType');
        if (bTypeEl)
            bTypeEl.textContent = String(item.billing_type || 'boleto').toUpperCase();
        // Transaction ID
        const txPubIdEl = document.getElementById('auditDetailTxPubId');
        if (txPubIdEl)
            txPubIdEl.textContent = item.transaction_public_id ? `#${item.transaction_public_id}` : '-';
        // Error box
        const errBox = document.getElementById('auditDetailErrorContainer');
        const errMsg = document.getElementById('auditDetailErrorMessage');
        if (!isSuccess && item.error_message) {
            if (errBox)
                errBox.classList.remove('hidden');
            if (errMsg)
                errMsg.textContent = item.error_message;
        }
        else {
            if (errBox)
                errBox.classList.add('hidden');
        }
        // Message text
        const msgTextEl = document.getElementById('auditDetailMessageText');
        if (msgTextEl) {
            msgTextEl.textContent = item.message_text || '(Mensagem em branco)';
        }
        // Attachment
        const attContainer = document.getElementById('auditDetailAttachmentContainer');
        const attName = document.getElementById('auditDetailAttachmentName');
        if (item.media_file_name) {
            if (attContainer)
                attContainer.classList.remove('hidden');
            if (attName)
                attName.textContent = item.media_file_name;
        }
        else {
            if (attContainer)
                attContainer.classList.add('hidden');
        }
        // Raw Response
        const rawBox = document.getElementById('auditDetailRawResponse');
        const rawContainer = document.getElementById('rawResponseContainer');
        const rawChevron = document.getElementById('rawResponseChevron');
        if (rawBox) {
            let rawContent = item.raw_response;
            if (typeof rawContent === 'string') {
                try {
                    rawContent = JSON.parse(rawContent);
                }
                catch { }
            }
            rawBox.textContent = rawContent ? JSON.stringify(rawContent, null, 2) : '(Nenhum payload retornado)';
        }
        if (rawContainer)
            rawContainer.classList.add('hidden');
        if (rawChevron)
            rawChevron.classList.remove('rotate-180');
        const detailsModal = document.getElementById('revenueWhatsappAuditDetailsModal');
        if (detailsModal) {
            detailsModal.classList.remove('hidden');
        }
    }
    function closeRevenueWhatsappAuditDetails() {
        const detailsModal = document.getElementById('revenueWhatsappAuditDetailsModal');
        if (detailsModal) {
            detailsModal.classList.add('hidden');
        }
    }
    function setupRevenueWhatsappAuditEvents() {
        document.getElementById('btnOpenWhatsappAuditModal')?.addEventListener('click', () => openRevenueWhatsappAuditModal());
        document.getElementById('btnCloseWhatsappAuditModal')?.addEventListener('click', closeRevenueWhatsappAuditModal);
        document.getElementById('revenueWhatsappAuditModalBackdrop')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('revenueWhatsappAuditModalBackdrop')) {
                closeRevenueWhatsappAuditModal();
            }
        });
        document.getElementById('btnRefreshWhatsappAudit')?.addEventListener('click', () => {
            loadRevenueWhatsappAudits(g_whatsappAuditCurrentPage);
        });
        document.getElementById('btnFilterWhatsappAudit')?.addEventListener('click', () => {
            loadRevenueWhatsappAudits(1);
        });
        document.getElementById('btnClearWhatsappAuditFilter')?.addEventListener('click', () => {
            const searchInput = document.getElementById('whatsappAuditFilterSearch');
            const statusSelect = document.getElementById('whatsappAuditFilterStatus');
            const originSelect = document.getElementById('whatsappAuditFilterOrigin');
            const billingTypeSelect = document.getElementById('whatsappAuditFilterBillingType');
            if (searchInput)
                searchInput.value = '';
            if (statusSelect)
                statusSelect.value = '';
            if (originSelect)
                originSelect.value = '';
            if (billingTypeSelect)
                billingTypeSelect.value = '';
            loadRevenueWhatsappAudits(1);
        });
        document.getElementById('btnClearTransactionFilterBtn')?.addEventListener('click', () => {
            g_whatsappAuditTransactionFilter = null;
            const banner = document.getElementById('whatsappAuditTransactionBanner');
            if (banner) {
                banner.classList.add('hidden');
                banner.classList.remove('flex');
            }
            loadRevenueWhatsappAudits(1);
        });
        document.getElementById('btnAuditPrevPage')?.addEventListener('click', () => {
            if (g_whatsappAuditCurrentPage > 1) {
                loadRevenueWhatsappAudits(g_whatsappAuditCurrentPage - 1);
            }
        });
        document.getElementById('btnAuditNextPage')?.addEventListener('click', () => {
            if (g_whatsappAuditCurrentPage < (g_whatsappAuditPagination.totalPages || 1)) {
                loadRevenueWhatsappAudits(g_whatsappAuditCurrentPage + 1);
            }
        });
        // Sub-modal details events
        document.getElementById('btnCloseAuditDetailsModal')?.addEventListener('click', closeRevenueWhatsappAuditDetails);
        document.getElementById('btnCloseAuditDetailsBottomBtn')?.addEventListener('click', closeRevenueWhatsappAuditDetails);
        document.getElementById('revenueWhatsappAuditDetailsBackdrop')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('revenueWhatsappAuditDetailsBackdrop')) {
                closeRevenueWhatsappAuditDetails();
            }
        });
        document.getElementById('btnToggleRawResponse')?.addEventListener('click', () => {
            const rawContainer = document.getElementById('rawResponseContainer');
            const rawChevron = document.getElementById('rawResponseChevron');
            if (rawContainer) {
                rawContainer.classList.toggle('hidden');
                if (rawChevron) {
                    rawChevron.classList.toggle('rotate-180');
                }
            }
        });
        // Delegation for details buttons inside audit table
        document.getElementById('whatsappAuditTableBody')?.addEventListener('click', (e) => {
            const target = e.target;
            const detailsBtn = target.closest('[data-action="open-audit-details"]');
            if (detailsBtn) {
                e.preventDefault();
                e.stopPropagation();
                const auditId = detailsBtn.getAttribute('data-audit-id');
                if (auditId) {
                    openRevenueWhatsappAuditDetails(auditId);
                }
            }
        });
    }
    setupRevenueWhatsappAuditEvents();
})();
