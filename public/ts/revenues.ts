// @ts-nocheck
(() => {
let revenuesData = [];
let categoriesData = [];
let banksData = [];
let customersData = [];
let g_deleteId = null;
let g_editId = null;
let g_baixaId = null;
let currentView = localStorage.getItem('revenuesView') || 'list';

function setCurrencyValue(inputId, numValue) {
    const el = document.getElementById(inputId);
    if (!el) return;
    let valStr = parseFloat(numValue || 0).toFixed(2);
    let digitsOnly = valStr.replace(/\D/g, '');
    let formatted = (parseInt(digitsOnly, 10) / 100).toFixed(2) + '';
    formatted = formatted.replace(".", ",");
    formatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    el.value = 'R$ ' + formatted;
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

function updateViewToggle() {
    const btnList = document.getElementById('btnListView');
    const btnGrid = document.getElementById('btnGridView');
    const tableSection = document.getElementById('revenuesSection');
    const gridSection = document.getElementById('revenuesGridSection');
    const tablePagContainer = document.getElementById('revenuesPaginationContainer');
    const gridPagContainer  = document.getElementById('revenuesGridPaginationContainer');

    if (!btnList || !btnGrid || !tableSection || !gridSection) return;

    btnList.className = "flex items-center justify-center px-4 py-1.5 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none";
    btnGrid.className = "flex items-center justify-center px-4 py-1.5 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none";

    btnList.querySelector('.check-icon').classList.add('hidden');
    btnGrid.querySelector('.check-icon').classList.add('hidden');

    if (currentView === 'list') {
        btnList.className = "flex items-center justify-center px-4 py-1.5 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none";
        btnList.querySelector('.check-icon').classList.remove('hidden');
        tableSection.style.display = '';
        tableSection.classList.remove('hidden');
        gridSection.style.display = 'none';
        gridSection.classList.add('hidden');
        if (tablePagContainer) tablePagContainer.classList.remove('hidden');
        if (gridPagContainer)  gridPagContainer.classList.add('hidden');
    } else {
        btnGrid.className = "flex items-center justify-center px-4 py-1.5 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none";
        btnGrid.querySelector('.check-icon').classList.remove('hidden');
        tableSection.style.display = 'none';
        tableSection.classList.add('hidden');
        gridSection.style.display = 'flex';
        gridSection.classList.remove('hidden');
        if (tablePagContainer) tablePagContainer.classList.add('hidden');
        if (gridPagContainer)  gridPagContainer.classList.remove('hidden');
    }
}

// ── Paginadores ─────────────────────────────────────────────
let _tablePager = null;
let _gridPager  = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '/';
        return;
    }

    document.title = 'KEYSTONE - Receitas';

    const valueEl = document.getElementById('value');
    if (valueEl) {
        valueEl.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value === "") value = "0";
            let formatted = (parseInt(value, 10) / 100).toFixed(2) + '';
            formatted = formatted.replace(".", ",");
            formatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
            e.target.value = 'R$ ' + formatted;
        });
    }

    // UI Bindings
    const btnOpenModal = document.getElementById('btnOpenModal');
    if (btnOpenModal) btnOpenModal.addEventListener('click', openModal);

    const btnCancelModal = document.getElementById('btnCancelModal');
    if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

    const revenueForm = document.getElementById('revenueForm');
    if (revenueForm) revenueForm.addEventListener('submit', handleSaveRevenue);

    document.getElementById('baixaModalBackdrop')?.addEventListener('click', window.closeBaixaModal);
    document.getElementById('btnCancelBaixaModal')?.addEventListener('click', window.closeBaixaModal);
    document.getElementById('deleteModalBackdrop')?.addEventListener('click', window.closeDeleteModal);
    document.getElementById('btnCancelDeleteModal')?.addEventListener('click', window.closeDeleteModal);
    document.getElementById('baixaFine')?.addEventListener('input', updateBaixaTotal);
    document.getElementById('baixaInterest')?.addEventListener('input', updateBaixaTotal);

    const customerSearch = document.getElementById('customerSearch');
    if (customerSearch) customerSearch.addEventListener('input', syncCustomerSearch);

    const btnListView = document.getElementById('btnListView');
    if (btnListView) {
        btnListView.addEventListener('click', () => {
            currentView = 'list';
            localStorage.setItem('revenuesView', 'list');
            updateViewToggle();
        });
    }

    const btnGridView = document.getElementById('btnGridView');
    if (btnGridView) {
        btnGridView.addEventListener('click', () => {
            currentView = 'grid';
            localStorage.setItem('revenuesView', 'grid');
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

    // Filter toggle (collapse/expand)
    const toggleFilterBtn = document.getElementById('toggleFilterBtn');
    const filterBody = document.getElementById('filterBody');
    const filterChevron = document.getElementById('filterChevron');
    const FILTER_STORAGE_KEY = 'revenues_filter_open';
    let filterIsOpen = false;

    if (filterBody && filterChevron) {
        // Apply saved state immediately (before any transition)
        if (!filterIsOpen) {
            filterBody.style.transition = 'none';
            filterBody.style.maxHeight = '0px';
            filterChevron.style.transform = 'rotate(-90deg)';
            // Re-enable transition after forced layout
            requestAnimationFrame(() => {
                filterBody.style.transition = '';
            });
        }

        if (toggleFilterBtn) {
            toggleFilterBtn.addEventListener('click', () => {
                filterIsOpen = !filterIsOpen;
                localStorage.setItem(FILTER_STORAGE_KEY, filterIsOpen);
                filterBody.style.maxHeight = filterIsOpen ? filterBody.scrollHeight + 'px' : '0px';
                filterChevron.style.transform = filterIsOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
            });
        }
    }

    // Filter bindings
    const filterSelectors = ['filterStartDate', 'filterEndDate', 'filterPaymentMethod', 'filterStatus', 'filterBank', 'filterUser'];
    filterSelectors.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', applyFilters);
    });

    updateViewToggle();

    await loadDependencies();
    fetchRevenues();
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

function renderPaymentMethodLabel(method) {
    return `<span class="inline-flex items-center rounded bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">${getPaymentLabel(method)}</span>`;
}

function getRevenueStatus(row) {
    if (row.status !== 'paid' && row.sale_id && row.sale_status === 'progress') return 'progress';
    return row.status;
}

function isRevenuePaid(row) {
    return getRevenueStatus(row) === 'paid';
}

function isRevenueOverdue(row) {
    const status = getRevenueStatus(row);
    return status !== 'paid' && status !== 'progress' && DateUtils.isBeforeToday(row.date);
}

function formatReceivedAt(row) {
    return row.received_at ? DateUtils.formatDateTime(row.received_at) : DateUtils.formatDate(row.date);
}

function getRevenueUserFilterValue(row) {
    return row.user_public_id || row.user_name || '';
}

function populateUserFilter() {
    const filterUser = document.getElementById('filterUser');
    if (!filterUser) return;

    const selectedValue = filterUser.value;
    const users = new Map();
    revenuesData.forEach(row => {
        const value = getRevenueUserFilterValue(row);
        if (value) users.set(value, row.user_name || 'Usuario sem nome');
    });

    filterUser.innerHTML = '<option value="">Todos os Usuários</option>';
    Array.from(users.entries())
        .sort(([, leftName], [, rightName]) => String(leftName).localeCompare(String(rightName), 'pt-BR'))
        .forEach(([value, name]) => {
            filterUser.innerHTML += `<option value="${value}">${name}</option>`;
        });
    filterUser.value = users.has(selectedValue) ? selectedValue : '';
}

function setCustomerSelection(publicId) {
    const customerSelect = document.getElementById('customerSelect');
    const customerSearch = document.getElementById('customerSearch');
    const customer = customersData.find(c => c.public_id === publicId);
    if (customerSelect) customerSelect.value = publicId || '';
    if (customerSearch) customerSearch.value = customer?.name || '';
}

function syncCustomerSearch() {
    const customerSelect = document.getElementById('customerSelect');
    const customerSearch = document.getElementById('customerSearch');
    if (!customerSelect || !customerSearch) return;

    const searchValue = customerSearch.value.trim().toLowerCase();
    const selectedCustomer = customersData.find(c => String(c.name || '').trim().toLowerCase() === searchValue);
    customerSelect.value = selectedCustomer?.public_id || '';
}

async function loadDependencies() {
    try {
        const [catsRes, banksRes, custsRes] = await Promise.all([
            api('/finance/categories'),
            api('/bank-accounts'),
            api('/entities/customers')
        ]);

        categoriesData = catsRes.data.filter(c => c.type === 'income') || [];
        banksData = banksRes.data || [];
        customersData = custsRes.data || [];

        const catSelect = document.getElementById('category');
        if (catSelect) {
            catSelect.innerHTML = '<option value="">Selecione...</option>';
            categoriesData.forEach(c => {
                catSelect.innerHTML += `<option value="${c.public_id}">${c.name}</option>`;
            });
        }

        const bankSelect = document.getElementById('bankSelect');
        const filterBank = document.getElementById('filterBank');
        if (bankSelect) {
            bankSelect.innerHTML = '<option value="">Selecione a conta depositaria...</option>';
        }
        if (filterBank) {
            filterBank.innerHTML = '<option value="">Todas as Contas</option>';
        }
        banksData.forEach(b => {
            if (bankSelect) bankSelect.innerHTML += `<option value="${b.public_id}">${b.name}</option>`;
            if (filterBank) filterBank.innerHTML += `<option value="${b.public_id}">${b.name}</option>`;
        });

        const customersList = document.getElementById('customersList');
        if (customersList) {
            customersList.innerHTML = '';
            customersData.forEach(c => {
                customersList.innerHTML += `<option value="${c.name}"></option>`;
            });
        }

    } catch (e) {
        console.error('Falha ao carregar categorias, bancos ou clientes', e);
    }
}

async function fetchRevenues() {
    try {
        const res = await api('/finance/revenues');
        revenuesData = res.data || [];
        populateUserFilter();
        applyFilters();
    } catch (e) {
        console.error('Falha ao carregar receitas', e);
        UI.showAlert('alertMessage', 'Erro ao listar receitas', 'error');
    }
}

function applyFilters() {
    const startDate = document.getElementById('filterStartDate')?.value;
    const endDate = document.getElementById('filterEndDate')?.value;
    const paymentMethod = document.getElementById('filterPaymentMethod')?.value;
    const status = document.getElementById('filterStatus')?.value;
    const bank = document.getElementById('filterBank')?.value;
    const user = document.getElementById('filterUser')?.value;

    let filtered = revenuesData.filter(r => {
        let match = true;

        if (startDate) {
            if (DateUtils.compareDateOnly(r.date, startDate) < 0) match = false;
        }
        if (endDate) {
            if (DateUtils.compareDateOnly(r.date, endDate) > 0) match = false;
        }
        if (paymentMethod) {
            if (r.payment_method !== paymentMethod) match = false;
        }
        if (status) {
            const revenueStatus = getRevenueStatus(r);
            if (status === 'progress' && revenueStatus !== 'progress') match = false;
            if (status === 'paid' && !isRevenuePaid(r)) match = false;
            if (status === 'pending' && (isRevenuePaid(r) || revenueStatus === 'progress')) match = false;
        }
        if (bank) {
            if (r.bank_account_public_id !== bank) match = false;
        }
        if (user) {
            if (getRevenueUserFilterValue(r) !== user) match = false;
        }

        return match;
    });

    // Alimenta os paginadores com os dados filtrados
    if (!_tablePager) {
        _tablePager = new Paginator({
            containerId : 'revenuesPaginationContainer',
            pageSize    : 20,
            onChange    : (pageItems) => { renderTable(pageItems); },
        });
    }
    if (!_gridPager) {
        _gridPager = new Paginator({
            containerId : 'revenuesGridPaginationContainer',
            pageSize    : 20,
            onChange    : (pageItems) => { renderGrid('revenuesGridContainer', pageItems); },
        });
    }

    _tablePager.setData(filtered);
    _gridPager.setData(filtered);
    updateFooter(filtered);
}

function updateFooter(data = []) {
    const countEl = document.getElementById('footerCount');
    const totalEl = document.getElementById('footerTotal');
    const pendingEl = document.getElementById('footerTotalPending');
    const paidEl = document.getElementById('footerTotalPaid');
    if (!countEl || !totalEl || !pendingEl || !paidEl) return;

    const count = data.length;
    const total = data.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    const pendingTotal = data.filter(r => !isRevenuePaid(r)).reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    const paidTotal = data.filter(r => isRevenuePaid(r)).reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    countEl.textContent = count;
    totalEl.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    pendingEl.textContent = pendingTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    paidEl.textContent = paidTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}


function renderTable(data = revenuesData) {
    const tbody = document.getElementById('revenuesTable');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhuma receita no momento.</td></tr>';
        return;
    }

    const paymentTermsPtBr = {
        '(cash)': '(Dinheiro)',
        '(pix)': '(Pix)',
        '(credit)': '(Crédito)',
        '(debit)': '(Débito)',
        '(transfer)': '(Transferência)',
        '(boleto)': '(Boleto)',
    };
    const translateDescription = (desc) => {
        if (!desc) return desc;
        return desc.replace(/\((cash|pix|credit|debit|transfer|boleto)\)/gi,
            (match) => paymentTermsPtBr[match.toLowerCase()] || match);
    };

    tbody.innerHTML = data.map((r, index) => {
        const revenueStatus = getRevenueStatus(r);
        const isOverdue = isRevenueOverdue(r);
        let statusBadge = '';
        if (revenueStatus === 'progress') {
            statusBadge = '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold text-orange-800 bg-orange-100 ring-1 ring-orange-200 dark:bg-orange-900/35 dark:text-orange-200 dark:ring-orange-700/60 whitespace-nowrap">Andamento</span>';
        } else if (revenueStatus === 'paid') {
            statusBadge = '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-green-800 bg-green-100 dark:bg-green-900/40 dark:text-green-300 whitespace-nowrap">Recebido</span>';
        } else if (isOverdue) {
            statusBadge = '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-red-800 bg-red-100 dark:bg-red-900/40 dark:text-red-300 whitespace-nowrap">Vencido</span>';
        } else {
            statusBadge = '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-yellow-800 bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-300 whitespace-nowrap">Pendente</span>';
        }

        return `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors group">
            <td class="px-2 py-4 whitespace-nowrap text-left w-8">
                <input type="checkbox" value="${r.public_id}" class="revenue-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800">
            </td>
            <td class="px-2 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono hidden sm:table-cell">
                #${String(index + 1).padStart(4, '0')}
            </td>
            <td class="px-2 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 hidden lg:table-cell">
                ${r.user_name || '-'}
            </td>
            <td class="px-2 py-4 whitespace-normal wrap-break-word min-w-37.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                ${translateDescription(r.description)}
                <div class="text-xs text-gray-400 mt-1 dark:text-gray-500">${r.customer_name ? r.customer_name : 'Sem cliente vinculado'}</div>
            </td>
            <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    ${r.category_name || 'Geral'}
                </span>
            </td>
             <td class="px-2 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">${formatReceivedAt(r)}</td>
            <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                <div class="font-medium text-gray-700 dark:text-gray-200">${r.bank_account_name || '-'}</div>
                <div class="mt-1">${renderPaymentMethodLabel(r.payment_method)}</div>
            </td>
            <td class="px-2 py-4 whitespace-nowrap text-center text-sm font-medium">
                ${statusBadge}
            </td>
            <td class="px-3 py-4 whitespace-nowrap text-center text-sm font-medium hidden lg:table-cell">
                ${r.payment_method === 'boleto'
                ? (r.barcode
                    ? `<div class="flex flex-col items-center gap-1 text-xs">
                             <div class="flex space-x-2 mt-1">
                               <button type="button" class="copy-pix-btn bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded px-2 py-0.5 flex items-center dark:bg-white dark:text-gray-900 dark:border-gray-200 dark:hover:bg-gray-100" data-pix="${r.pix_code}" title="Copiar PIX">
                                 <svg class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> PIX
                               </button>
                               <button type="button" class="open-pdf-btn bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded px-2 py-0.5 flex items-center dark:bg-white dark:text-gray-900 dark:border-gray-200 dark:hover:bg-gray-100" data-url="${r.billet_url}" data-id="${r.public_id}" title="Ver PDF">
                                 <svg class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> PDF
                               </button>
                             </div>
                             <span class="text-gray-500 dark:text-gray-400" style="font-size: 10px;" title="${r.barcode}">${r.barcode.substring(0, 15)}...</span>
                           </div>`
                    : `<button type="button" class="generate-billet-btn bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 dark:bg-white dark:text-gray-900 dark:border-gray-200 dark:hover:bg-gray-100 px-2 py-1 rounded text-xs font-medium transition-colors" data-id="${r.public_id}">Gerar Boleto</button>`)
                : (revenueStatus !== 'paid'
                    ? (r.payment_method === 'pix'
                        ? `<button type="button" class="open-receipt-btn bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 dark:bg-white dark:text-gray-900 dark:border-gray-200 dark:hover:bg-gray-100 px-2 py-1 rounded text-xs font-medium transition-colors" data-id="${r.public_id}" data-copy-qr-code="true" title="Copiar chave QR Code">Copiar QR Code</button>`
                        : `<span class="text-gray-400 dark:text-gray-500">-</span>`)
                    : `<span class="text-gray-400 dark:text-gray-500">-</span>`)
            }
            </td>
            <td class="px-2 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600 dark:text-green-400">+ ${formatCurrency(r.amount)}</td>
            <td class="px-2 py-3 whitespace-nowrap text-center text-sm font-medium">
                ${revenueStatus !== 'paid' ? `
                <button type="button" class="text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300 mr-2 baixa-btn" data-id="${r.public_id}" title="Baixa">
                    <span class="inline-flex items-center rounded bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-semibold">Baixa</span>
                </button>` : ''}
                ${isOverdue ? `
                <button type="button" class="text-rose-600 hover:text-rose-900 dark:text-rose-400 dark:hover:text-rose-300 mr-2 inline-flex items-center gap-1 open-receipt-btn" data-id="${r.public_id}" title="Cobrar">
                    <span class="inline-flex h-5 w-5 items-center justify-center text-base font-bold leading-none text-rose-600 dark:text-rose-400">$</span>
                </button>` : ''}
                ${!isOverdue ? `
                <button type="button" class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-2 open-receipt-btn" data-id="${r.public_id}" title="Recibo">
                    <svg class="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </button>` : ''}
                <button type="button" class="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 mr-2 duplicate-btn" data-id="${r.public_id}" title="Duplicar">
                    <svg class="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                </button>
                <button type="button" class="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 mr-2 edit-btn" data-id="${r.public_id}" title="Editar">
                    <svg class="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
                <button type="button" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 delete-btn" data-id="${r.public_id}" title="Excluir">
                    <svg class="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

function renderGrid(elementId, items) {
    const grid = document.getElementById(elementId);
    if (!grid) return;

    if (items.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">Nenhuma receita no momento.</div>`;
        return;
    }

    grid.innerHTML = items.map((r, index) => {
        const revenueStatus = getRevenueStatus(r);
        const isOverdue = isRevenueOverdue(r);
        let statusClasses = '';
        let statusText = '';
        if (revenueStatus === 'progress') {
            statusClasses = 'text-orange-800 bg-orange-100 ring-1 ring-orange-200 dark:bg-orange-900/35 dark:text-orange-200 dark:ring-orange-700/60';
            statusText = 'Andamento';
        } else if (revenueStatus === 'paid') {
            statusClasses = 'text-green-800 bg-green-100 dark:bg-green-900/40 dark:text-green-300';
            statusText = 'Recebido';
        } else if (isOverdue) {
            statusClasses = 'text-red-800 bg-red-100 dark:bg-red-900/40 dark:text-red-300';
            statusText = 'Vencido';
        } else {
            statusClasses = 'text-yellow-800 bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-300';
            statusText = 'Pendente';
        }

        return `
        <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col relative border border-gray-100 dark:border-slate-700 group">
            
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center z-10 pt-1">
                    <input type="checkbox" value="${r.public_id}" class="revenue-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800">
                    <span class="ml-2 text-xs font-mono font-medium text-gray-500 dark:text-gray-400">#${String(index + 1).padStart(4, '0')}</span>
                </div>

                <div class="flex space-x-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10 -mr-1 -mt-1">
                    ${revenueStatus !== 'paid' ? `
                    <button type="button" class="p-1.5 text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 bg-gray-50 hover:bg-emerald-50 dark:bg-slate-700 dark:hover:bg-emerald-900/30 rounded baixa-btn" data-id="${r.public_id}" title="Baixa">
                        <span class="inline-flex h-4 items-center justify-center text-xs font-bold leading-none">Baixa</span>
                    </button>` : ''}
                    ${isOverdue ? `
                    <button type="button" class="p-1.5 text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 bg-gray-50 hover:bg-rose-50 dark:bg-slate-700 dark:hover:bg-rose-900/30 rounded open-receipt-btn" data-id="${r.public_id}" title="Cobrar">
                        <span class="inline-flex h-4 w-4 items-center justify-center text-sm font-bold leading-none text-rose-500 dark:text-rose-400">$</span>
                    </button>` : ''}
                    ${!isOverdue ? `
                    <button type="button" class="p-1.5 text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 bg-gray-50 hover:bg-indigo-50 dark:bg-slate-700 dark:hover:bg-indigo-900/30 rounded open-receipt-btn" data-id="${r.public_id}" title="Recibo">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </button>` : ''}
                    <button type="button" class="p-1.5 text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400 bg-gray-50 hover:bg-brand-50 dark:bg-slate-700 dark:hover:bg-brand-900/30 rounded edit-btn" data-id="${r.public_id}" title="Editar">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button type="button" class="p-1.5 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 bg-gray-50 hover:bg-indigo-50 dark:bg-slate-700 dark:hover:bg-indigo-900/30 rounded duplicate-btn" data-id="${r.public_id}" title="Duplicar">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </button>
                    <button type="button" class="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 bg-gray-50 hover:bg-red-50 dark:bg-slate-700 dark:hover:bg-red-900/30 rounded delete-btn" data-id="${r.public_id}" title="Excluir">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>

            <div class="flex-1 mt-1">
                <div class="flex justify-between items-start">
                    <h4 class="text-lg font-bold text-gray-900 dark:text-gray-100 truncate pr-2">${r.description}</h4>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        ${r.category_name || 'Geral'}
                    </span>
                </div>
                <div class="mt-4">
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Cliente / Vínculo:</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100">${r.customer_name ? r.customer_name : 'Sem vínculo'}</span>
                    </div>
                </div>
                <div class="mt-4 grid grid-cols-2 gap-4">
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Data:</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100">${formatReceivedAt(r)}</span>
                    </div>
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Valor:</span>
                        <span class="font-medium text-green-600 dark:text-green-400">+ ${formatCurrency(r.amount)}</span>
                    </div>
                     <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300 col-span-2">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Conta Depotária:</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100">${r.bank_account_name || '-'}</span>
                    </div>
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Status:</span>
                        <span class="inline-flex max-w-min px-2 py-0.5 mt-0.5 rounded-md text-xs font-medium ${statusClasses}">
                            ${statusText}
                        </span>
                    </div>
                    ${r.payment_method === 'boleto' ? `
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300 col-span-2">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Boleto / PIX:</span>
                        <div class="mt-1">
                        ${r.barcode
                    ? `<div class="flex flex-col gap-1 text-xs">
                                 <div class="flex space-x-2">
                                   <button type="button" class="copy-pix-btn bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded px-2 py-0.5 flex items-center dark:bg-white dark:text-gray-900 dark:border-gray-200 dark:hover:bg-gray-100" data-pix="${r.pix_code}" title="Copiar PIX">
                                     <svg class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> Copiar PIX
                                   </button>
                                   <button type="button" class="open-pdf-btn bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded px-2 py-0.5 flex items-center dark:bg-white dark:text-gray-900 dark:border-gray-200 dark:hover:bg-gray-100" data-url="${r.billet_url}" data-id="${r.public_id}" title="Ver PDF">
                                     <svg class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> PDF
                                   </button>
                                 </div>
                                 <span class="text-gray-500 dark:text-gray-400" title="${r.barcode}">${r.barcode.substring(0, 20)}...</span>
                               </div>`
                    : `<button type="button" class="generate-billet-btn bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 dark:bg-white dark:text-gray-900 dark:border-gray-200 dark:hover:bg-gray-100 px-2 py-1 rounded text-xs font-medium transition-colors" data-id="${r.public_id}">Gerar Boleto</button>`
                }
                        </div>
                    </div>` : (revenueStatus !== 'paid' && r.payment_method === 'pix' ? `
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300 col-span-2">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Cobranca:</span>
                        <div class="mt-1">
                            <button type="button" class="open-receipt-btn bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 dark:bg-white dark:text-gray-900 dark:border-gray-200 dark:hover:bg-gray-100 px-2 py-1 rounded text-xs font-medium transition-colors" data-id="${r.public_id}" data-copy-qr-code="true" title="Copiar chave QR Code">Copiar QR Code</button>
                        </div>
                    </div>` : '')}
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function openModal() {
    g_editId = null;
    const form = document.getElementById('revenueForm');
    if (form) form.reset();

    setCurrencyValue('value', 0);

    const dateInput = document.getElementById('dueDate');
    if (dateInput) dateInput.value = DateUtils.getTodayDateInputValue();

    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.value = 'pending';

    setCustomerSelection('');

    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = 'Nova Receita';

    document.getElementById('revenueModal').classList.remove('hidden');
}

window.closeModal = () => {
    g_editId = null;
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

function updateBaixaTotal() {
    const rev = revenuesData.find(r => r.public_id === g_baixaId);
    const totalEl = document.getElementById('baixaTotal');
    if (!rev || !totalEl) return;

    const originalAmount = Number(rev.amount) || 0;
    const fine = getNumberInputValue('baixaFine');
    const interest = getNumberInputValue('baixaInterest');
    totalEl.textContent = formatCurrency(originalAmount + fine + interest);
}

function openBaixaModal(rev) {
    g_baixaId = rev.public_id;
    const descEl = document.getElementById('baixaDescription');
    const amountEl = document.getElementById('baixaAmount');
    const customerEl = document.getElementById('baixaCustomer');
    const dateEl = document.getElementById('baixaDate');
    const fineEl = document.getElementById('baixaFine');
    const interestEl = document.getElementById('baixaInterest');
    if (descEl) descEl.textContent = rev.description || '-';
    if (amountEl) amountEl.textContent = formatCurrency(rev.amount || 0);
    if (customerEl) customerEl.textContent = rev.customer_name || 'Sem cliente vinculado';
    if (dateEl) dateEl.value = getCurrentDateTimeInputValue();
    if (fineEl) fineEl.value = '0';
    if (interestEl) interestEl.value = '0';
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
    const jwtToken = localStorage.getItem('erp_token');
    if (jwtToken) {
        url += '?token=' + jwtToken;
    }

    const originalHtml = button.innerHTML;
    button.textContent = 'Copiando...';
    button.setAttribute('disabled', 'true');

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Nao foi possivel carregar o recibo');

        const receiptHtml = await response.text();
        const receiptDocument = new DOMParser().parseFromString(receiptHtml, 'text/html');
        const qrCodeKey = receiptDocument.querySelector('[data-copy-value]')?.getAttribute('data-copy-value') || '';
        if (!qrCodeKey) throw new Error('Chave QR Code nao encontrada');

        await copyToClipboard(qrCodeKey);
        button.textContent = 'Copiado';
        setTimeout(() => { button.innerHTML = originalHtml; }, 2000);
    } catch (err) {
        button.innerHTML = originalHtml;
        UI.showAlert('alertMessage', err.message || 'Erro ao copiar chave QR Code', 'error');
    } finally {
        button.removeAttribute('disabled');
    }
}

document.addEventListener('click', (e) => {
    const dupBtn = e.target.closest('.duplicate-btn');
    const editBtn = e.target.closest('.edit-btn');
    const delBtn = e.target.closest('.delete-btn');
    const baixaBtn = e.target.closest('.baixa-btn');

    if (baixaBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = baixaBtn.getAttribute('data-id');
        const rev = revenuesData.find(r => r.public_id === id);
        if (rev) openBaixaModal(rev);
    }

    if (dupBtn) {
        const id = dupBtn.getAttribute('data-id');
        const rev = revenuesData.find(r => r.public_id === id);
        if (!rev) return;

        document.getElementById('revenueForm').reset();
        document.getElementById('description').value = rev.description + ' (Cópia)';

        setCurrencyValue('value', rev.amount);

        document.getElementById('dueDate').value = DateUtils.toDateInputValue(rev.date);
        document.getElementById('category').value = rev.category_public_id || '';
        document.getElementById('bankSelect').value = rev.bank_account_public_id || '';
        setCustomerSelection(rev.customer_public_id || '');

        const paymentEl = document.getElementById('paymentMethod');
        if (paymentEl) paymentEl.value = rev.payment_method || '';

        const statusEl = document.getElementById('status');
        if (statusEl) statusEl.value = rev.status || 'paid';

        const modalTitle = document.getElementById('modalTitle');
        if (modalTitle) modalTitle.textContent = 'Duplicar Receita';

        document.getElementById('revenueModal').classList.remove('hidden');
    }

    if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        const rev = revenuesData.find(r => r.public_id === id);
        if (!rev) return;

        g_editId = id;

        document.getElementById('revenueForm').reset();
        document.getElementById('description').value = rev.description;

        setCurrencyValue('value', rev.amount);

        document.getElementById('dueDate').value = DateUtils.toDateInputValue(rev.date);
        document.getElementById('category').value = rev.category_public_id || '';
        document.getElementById('bankSelect').value = rev.bank_account_public_id || '';
        setCustomerSelection(rev.customer_public_id || '');

        const paymentEl = document.getElementById('paymentMethod');
        if (paymentEl) paymentEl.value = rev.payment_method || '';

        const statusEl = document.getElementById('status');
        if (statusEl) statusEl.value = rev.status || 'paid';

        const modalTitle = document.getElementById('modalTitle');
        if (modalTitle) modalTitle.textContent = 'Editar Receita';

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
            url = '/api/v1/finance/revenues/' + pubId + '/boleto-pdf?nossoNumero=' + nossoNumero;
        }

        if (url) {
            const jwtToken = localStorage.getItem('erp_token');
            if (jwtToken) {
                url += (url.includes('?') ? '&' : '?') + 'token=' + jwtToken;
            }

            const pdfIframe = document.getElementById('pdfIframe');
            const printPdfBtn = document.getElementById('printPdfBtn');
            const pdfModalTitleText = document.getElementById('pdfModalTitleText');
            if (pdfIframe) pdfIframe.src = url;
            if (printPdfBtn) printPdfBtn.classList.add('hidden');
            if (pdfModalTitleText) pdfModalTitleText.textContent = 'Visualizar Boleto PDF';
            document.getElementById('pdfModal').classList.remove('hidden');
        }
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

            let url = '/api/v1/finance/revenues/' + pubId + '/receipt';
            const jwtToken = localStorage.getItem('erp_token');
            if (jwtToken) {
                url += '?token=' + jwtToken;
            }
            
            // Open it cleanly in the elegant PDF modal!
            const pdfIframe = document.getElementById('pdfIframe');
            const printPdfBtn = document.getElementById('printPdfBtn');
            const pdfModalTitleText = document.getElementById('pdfModalTitleText');
            if (pdfIframe) pdfIframe.src = url;
            if (printPdfBtn) printPdfBtn.classList.remove('hidden');
            if (pdfModalTitleText) pdfModalTitleText.textContent = 'Recibo';
            document.getElementById('pdfModal').classList.remove('hidden');
        }
    }
});

document.getElementById('printPdfBtn')?.addEventListener('click', () => {
    const pdfIframe = document.getElementById('pdfIframe') as HTMLIFrameElement | null;
    pdfIframe?.contentWindow?.focus();
    pdfIframe?.contentWindow?.print();
});

function closePdfModal() {
    document.getElementById('pdfModal').classList.add('hidden');
    const pdfIframe = document.getElementById('pdfIframe');
    if (pdfIframe) pdfIframe.src = '';
}

document.getElementById('closePdfModalBtn')?.addEventListener('click', closePdfModal);
document.getElementById('closePdfModalCross')?.addEventListener('click', closePdfModal);
document.getElementById('closePdfModalBackdrop')?.addEventListener('click', closePdfModal);

async function generateBillet(publicId, btnEl) {
    if (!publicId) return;
    const oldText = btnEl.textContent;
    btnEl.textContent = 'Gerando...';
    btnEl.disabled = true;

    try {
        await api(`/finance/revenues/${publicId}/generate-billet`, { method: 'POST' });
        UI.showAlert('alertMessage', 'Boleto gerado com sucesso!', 'success');
        fetchRevenues();
    } catch (err) {
        UI.showAlert('alertMessage', 'Erro ao gerar boleto: ' + err.message, 'error');
        btnEl.textContent = oldText;
        btnEl.disabled = false;
    }
}

// Select All Checkbox Logic
document.addEventListener('change', (e) => {
    if (e.target.id === 'selectAllCheckbox') {
        const checkboxes = document.querySelectorAll('.revenue-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        updateSelectedCount();
    }

    if (e.target.classList.contains('revenue-checkbox')) {
        const checkboxes = document.querySelectorAll('.revenue-checkbox');
        const allChecked = Array.from(checkboxes).length > 0 && Array.from(checkboxes).every(cb => cb.checked);
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) selectAllCheckbox.checked = allChecked;
        updateSelectedCount();
    }
});

function updateSelectedCount() {
    const selected = document.querySelectorAll('.revenue-checkbox:checked');
    const selectedIds = Array.from(selected).map(cb => cb.value);

    const batchActions = document.getElementById('batchActions');
    if (batchActions) {
        if (selectedIds.length > 0) {
            batchActions.classList.remove('hidden');
            setTimeout(() => batchActions.classList.remove('opacity-0'), 10);
        } else {
            batchActions.classList.add('opacity-0');
            setTimeout(() => batchActions.classList.add('hidden'), 300);
        }
    }
}

async function handleBatchGenerateBillet() {
    const selected = document.querySelectorAll('.revenue-checkbox:checked');
    const selectedIds = Array.from(selected).map(cb => cb.value);
    if (selectedIds.length === 0) return;

    if (!confirm(`Deseja gerar boletos para as ${selectedIds.length} receitas selecionadas?`)) return;

    const btn = document.getElementById('btnBatchGenerateBillet');
    const oldText = btn.textContent;
    btn.textContent = 'Gerando...';
    btn.disabled = true;

    try {
        await api('/finance/revenues/batch-generate-billets', {
            method: 'POST',
            body: JSON.stringify({ ids: selectedIds })
        });
        UI.showAlert('alertMessage', 'Boletos gerados com sucesso!', 'success');

        // Remove checkboxes selection
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        document.querySelectorAll('.revenue-checkbox').forEach(cb => cb.checked = false);
        updateSelectedCount();

        fetchRevenues();
    } catch (err) {
        UI.showAlert('alertMessage', 'Erro ao gerar boletos em lote: ' + err.message, 'error');
    } finally {
        btn.textContent = oldText;
        btn.disabled = false;
    }
}

async function handleBatchCancelBillet() {
    const selected = document.querySelectorAll('.revenue-checkbox:checked');
    const selectedIds = Array.from(selected).map(cb => cb.value);
    if (selectedIds.length === 0) return;

    if (!confirm(`Deseja cancelar boletos das ${selectedIds.length} receitas selecionadas?`)) return;

    const btn = document.getElementById('btnBatchCancelBillet');
    const oldText = btn.textContent;
    btn.textContent = 'Cancelando...';
    btn.disabled = true;

    try {
        await api('/finance/revenues/batch-cancel-billets', {
            method: 'POST',
            body: JSON.stringify({ ids: selectedIds })
        });
        UI.showAlert('alertMessage', 'Boletos cancelados com sucesso!', 'success');

        // Remove checkboxes selection
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        document.querySelectorAll('.revenue-checkbox').forEach(cb => cb.checked = false);
        updateSelectedCount();

        fetchRevenues();
    } catch (err) {
        UI.showAlert('alertMessage', 'Erro ao cancelar boletos em lote: ' + err.message, 'error');
    } finally {
        btn.textContent = oldText;
        btn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async (e) => {
            const button = e.currentTarget;
            if (button.disabled || !g_deleteId) return;

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
                loadDependencies();
            } catch (error) {
                UI.showAlert('alertMessage', 'Erro ao excluir: ' + error.message, 'error');
                g_deleteId = idToDelete;
            } finally {
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
            if (button.disabled || !g_baixaId) return;

            const idToBaixa = g_baixaId;
            const rev = revenuesData.find(r => r.public_id === idToBaixa);
            if (!rev) return;
            const fine = getNumberInputValue('baixaFine');
            const interest = getNumberInputValue('baixaInterest');
            const baixaDateTime = document.getElementById('baixaDate')?.value || getCurrentDateTimeInputValue();
            const baixaDate = baixaDateTime.split('T')[0] || DateUtils.getTodayDateInputValue();
            const totalAmount = (Number(rev.amount) || 0) + fine + interest;

            button.disabled = true;
            button.classList.add('opacity-50', 'cursor-not-allowed');
            button.textContent = 'Baixando...';

            try {
                await api(`/finance/revenues/${idToBaixa}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        description: rev.description,
                        amount: totalAmount,
                        date: baixaDate,
                        received_at: toMysqlDateTimeValue(baixaDateTime),
                        category_public_id: rev.category_public_id,
                        bank_account_public_id: rev.bank_account_public_id,
                        customer_public_id: rev.customer_public_id || undefined,
                        payment_method: rev.payment_method || undefined,
                        status: 'paid'
                    })
                });

                window.closeBaixaModal();
                UI.showAlert('alertMessage', 'Baixa realizada com sucesso!', 'success');
                await fetchRevenues();
                await loadDependencies();
            } catch (error) {
                UI.showAlert('alertMessage', 'Erro ao realizar baixa: ' + error.message, 'error');
            } finally {
                button.disabled = false;
                button.classList.remove('opacity-50', 'cursor-not-allowed');
                button.textContent = 'Confirmar Baixa';
            }
        });
    }
});


async function handleSaveRevenue(e) {
    e.preventDefault();

    const amountVal = parseFloat(document.getElementById('value').value.replace(/[^\d]/g, '')) / 100;

    if (!amountVal || amountVal <= 0) {
        UI.showAlert('alertMessage', 'Informe um valor maior que zero.', 'error');
        return;
    }

    const data = {
        description: document.getElementById('description').value,
        amount: amountVal,
        date: document.getElementById('dueDate').value,
        category_public_id: document.getElementById('category').value,
        bank_account_public_id: document.getElementById('bankSelect').value,
        customer_public_id: document.getElementById('customerSelect').value || undefined
    };

    const paymentEl = document.getElementById('paymentMethod');
    if (paymentEl && paymentEl.value) {
        data.payment_method = paymentEl.value;
    }

    const statusEl = document.getElementById('status');
    if (statusEl && statusEl.value) {
        data.status = statusEl.value;
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
        } else {
            await api('/finance/revenues', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            UI.showAlert('alertMessage', 'Receita registrada com sucesso!', 'success');
        }

        closeModal();
        await fetchRevenues();
        await loadDependencies(); // atualiza saldos
    } catch (err) {
        alert(err.message || 'Erro ao salvar receita');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Salvar';
        }
    }
}
})();
