// @ts-nocheck
(() => {
let revenuesData = [];
let categoriesData = [];
let banksData = [];
let g_deleteId = null;
let g_editId = null;
let g_baixaId = null;
let g_whatsappId = null;
let currentView = localStorage.getItem('revenuesView') || 'list';

const peopleCache = {};

async function loadPeopleOfType(type) {
    if (peopleCache[type]) return peopleCache[type];

    let items = [];
    try {
        if (type === 'customer') {
            const res = await api('/entities/customers');
            items = (res.data || []).map((x) => ({ public_id: x.public_id, name: x.name }));
        } else if (type === 'supplier') {
            const res = await api('/entities/suppliers');
            items = (res.data || []).map((x) => ({ public_id: x.public_id, name: x.name }));
        } else if (type === 'contact') {
            const res = await api('/entities/contacts');
            items = (res.data || []).map((x) => ({ public_id: x.public_id, name: x.name }));
        } else if (type === 'seller') {
            const res = await api('/sellers');
            items = (res.data || []).map((x) => ({ public_id: x.public_id, name: x.full_name }));
        } else if (['buyer', 'service_provider', 'accountant'].includes(type)) {
            const res = await api('/users');
            items = (res.data || [])
                .filter((x) => x.role === type)
                .map((x) => ({ public_id: x.public_id, name: x.full_name }));
        }
    } catch (e) {
        console.error(`Failed to load people of type ${type}`, e);
    }
    
    items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    peopleCache[type] = items;
    return items;
}

function handleEntityTypeChange() {
    const type = document.getElementById('entityType')?.value || '';
    const entitySelect = document.getElementById('entitySelect');
    if (!entitySelect) return;

    entitySelect.innerHTML = '';

    if (!type) {
        entitySelect.disabled = true;
        entitySelect.innerHTML = '<option value="">Selecione o tipo primeiro...</option>';
        return;
    }

    entitySelect.disabled = false;
    entitySelect.innerHTML = '<option value="">Carregando...</option>';
    
    loadPeopleOfType(type).then((items) => {
        entitySelect.innerHTML = '<option value="">Selecione...</option>' + items
            .map((x) => `<option value="${x.public_id}">${x.name}</option>`)
            .join('');
    });
}

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

function toDateTimeInputValue(value) {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
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

    const now = new Date();
    // Use local timezone formatting for yyyy-mm-dd
    const tzOffset = now.getTimezoneOffset() * 60000;
    const firstDay = new Date(new Date(now.getFullYear(), now.getMonth(), 1).getTime() - tzOffset).toISOString().split('T')[0];
    const lastDay = new Date(new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime() - tzOffset).toISOString().split('T')[0];
    
    const filterStartDate = document.getElementById('filterStartDate') as HTMLInputElement;
    const filterEndDate = document.getElementById('filterEndDate') as HTMLInputElement;
    if (filterStartDate) filterStartDate.value = firstDay;
    if (filterEndDate) filterEndDate.value = lastDay;

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

    // Whatsapp Modal Bindings
    const btnCancelWhatsappModal = document.getElementById('btnCancelWhatsappModal');
    if (btnCancelWhatsappModal) btnCancelWhatsappModal.addEventListener('click', closeWhatsappModal);

    const whatsappModalBackdrop = document.getElementById('whatsappModalBackdrop');
    if (whatsappModalBackdrop) whatsappModalBackdrop.addEventListener('click', closeWhatsappModal);

    const btnConfirmWhatsappSend = document.getElementById('btnConfirmWhatsappSend');
    if (btnConfirmWhatsappSend) btnConfirmWhatsappSend.addEventListener('click', handleSendWhatsapp);

    const revenueForm = document.getElementById('revenueForm');
    if (revenueForm) revenueForm.addEventListener('submit', handleSaveRevenue);

    const statusSelect = document.getElementById('status');
    const receivedAtContainer = document.getElementById('receivedAtContainer');
    if (statusSelect && receivedAtContainer) {
        statusSelect.addEventListener('change', () => {
            if (statusSelect.value === 'paid') {
                receivedAtContainer.classList.remove('hidden');
                const receivedAtEl = document.getElementById('receivedAt');
                if (receivedAtEl && !receivedAtEl.value) {
                    receivedAtEl.value = getCurrentDateTimeInputValue();
                }
            } else {
                receivedAtContainer.classList.add('hidden');
            }
        });
    }

    // Solidcon Modal Bindings
    const openSolidconModal = () => {
        document.getElementById('solidconModal')?.classList.remove('hidden');
        const startEl = document.getElementById('solidconStartDate') as HTMLInputElement | null;
        const endEl = document.getElementById('solidconEndDate') as HTMLInputElement | null;
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

    let solidconFetchedPayload: any = null;

    const closeSolidconModal = () => {
        document.getElementById('solidconModal')?.classList.add('hidden');
        clearSolidconStatus();
        solidconFetchedPayload = null;
    };

    const btnOpenSolidconModal = document.getElementById('btnOpenSolidconModal');
    if (btnOpenSolidconModal) btnOpenSolidconModal.addEventListener('click', openSolidconModal);

    const btnCloseSolidconModal = document.getElementById('btnCloseSolidconModal');
    if (btnCloseSolidconModal) btnCloseSolidconModal.addEventListener('click', closeSolidconModal);

    const btnCancelSolidconModal = document.getElementById('btnCancelSolidconModal');
    if (btnCancelSolidconModal) btnCancelSolidconModal.addEventListener('click', closeSolidconModal);

    const solidconModalBackdrop = document.getElementById('solidconModalBackdrop');
    if (solidconModalBackdrop) {
        solidconModalBackdrop.addEventListener('click', (e) => {
            if (e.target === solidconModalBackdrop) closeSolidconModal();
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

    const setSolidconStatus = (message: string, type: 'success' | 'error' | 'warning') => {
        if (!solidconImportStatus) return;
        clearSolidconStatus();
        let bgClass = '';
        if (type === 'success') bgClass = 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/30';
        else if (type === 'error') bgClass = 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/30';
        else bgClass = 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/30';

        solidconImportStatus.className = `mt-3 text-sm rounded-md px-3 py-2 ${bgClass}`;
        solidconImportStatus.textContent = message;
    };

    const showSolidconIgnoredDetails = (errors: any[]) => {
        if (!solidconImportDetails || !errors || !errors.length) return;
        const reasonCounts = errors.reduce((acc: any, item: any) => {
            const reason = item?.reason || 'Motivo nao informado.';
            acc[reason] = (acc[reason] || 0) + 1;
            return acc;
        }, {});
        const reasonSummary = Object.entries(reasonCounts)
            .map(([reason, count]) => `${count}x ${reason}`)
            .join('<br>');
        const examples = errors.slice(0, 20)
            .map((item: any) => `Item #${Number(item?.index || 0) + 1}: ${item?.reason || 'Motivo nao informado.'}`)
            .join('<br>');

        solidconImportDetails.innerHTML = `<div class="font-semibold">Por que foi ignorado</div><div class="mt-1">${reasonSummary}</div><div class="mt-2 font-semibold">Exemplos</div><div class="mt-1">${examples}${errors.length > 20 ? `<br>... mais ${errors.length - 20} item(ns)` : ''}</div>`;
        solidconImportDetails.classList.remove('hidden');
    };

    const getSelectedSolidconUrl = () => {
        const urls = (window as any).currentSolidconUrls || [];
        return urls.find((url: string) => String(url || '').trim()) || '';
    };

    const btnFetchSolidconJson = document.getElementById('btnFetchSolidconJson') as HTMLButtonElement | null;
    if (btnFetchSolidconJson) {
        btnFetchSolidconJson.addEventListener('click', async () => {
            clearSolidconStatus();
            
            const connectionType = (document.getElementById('solidconConnectionType') as HTMLSelectElement | null)?.value || 'api';
            const startVal = (document.getElementById('solidconStartDate') as HTMLInputElement | null)?.value;
            const endVal = (document.getElementById('solidconEndDate') as HTMLInputElement | null)?.value;
            
            if (!startVal || !endVal) {
                setSolidconStatus('Preencha as datas Inicial e Final.', 'warning');
                return;
            }

            btnFetchSolidconJson.disabled = true;
            const originalHtml = btnFetchSolidconJson.innerHTML;
            btnFetchSolidconJson.textContent = 'Consultando...';

            const reqBody: any = { connectionType, startDate: startVal, endDate: endVal };

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
                } catch {
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
            } catch (err: any) {
                setSolidconStatus(err.message || 'Erro ao buscar dados da Solidcon.', 'error');
            } finally {
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

            const submitBtn = document.getElementById('btnExecuteSolidconImport') as HTMLButtonElement | null;
            const cancelBtn = document.getElementById('btnCancelSolidconModal') as HTMLButtonElement | null;
            const closeBtn = document.getElementById('btnCloseSolidconModal') as HTMLButtonElement | null;
            
            if (submitBtn) submitBtn.disabled = true;
            if (cancelBtn) cancelBtn.disabled = true;
            if (closeBtn) closeBtn.disabled = true;
            
            const originalBtnText = submitBtn ? submitBtn.textContent : 'Importar';
            if (submitBtn) submitBtn.textContent = 'Importando...';

            try {
                const result = await api('/finance/revenues/solidcon-import', {
                    method: 'POST',
                    body: JSON.stringify({ payload: solidconFetchedPayload })
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
            } catch (err: any) {
                setSolidconStatus(err.message || 'Erro ao importar receitas da Solidcon.', 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.textContent = originalBtnText;
                    submitBtn.disabled = false;
                }
                if (cancelBtn) cancelBtn.disabled = false;
                if (closeBtn) closeBtn.disabled = false;
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

    const entityTypeSelect = document.getElementById('entityType');
    if (entityTypeSelect) {
        entityTypeSelect.addEventListener('change', handleEntityTypeChange);
    }

    // Removed legacy entitySearch event listener.

    const btnListView = document.getElementById('btnListView');
    if (btnListView) {
        btnListView.addEventListener('click', () => {
            currentView = 'list';
            localStorage.setItem('revenuesView', 'list');
            clearCheckboxSelection();
            updateViewToggle();
        });
    }

    const btnGridView = document.getElementById('btnGridView');
    if (btnGridView) {
        btnGridView.addEventListener('click', () => {
            currentView = 'grid';
            localStorage.setItem('revenuesView', 'grid');
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

    const btnBatchUpdateRevenue = document.getElementById('btnBatchUpdateRevenue');
    if (btnBatchUpdateRevenue) {
        btnBatchUpdateRevenue.addEventListener('click', handleBatchUpdateRevenue);
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

// Old customer helper functions removed.

async function loadDependencies() {
    try {
        const [catsRes, banksRes, meRes] = await Promise.all([
            api('/finance/categories'),
            api('/bank-accounts'),
            api('/auth/me')
        ]);

        categoriesData = catsRes.data.filter(c => c.type === 'income') || [];
        banksData = banksRes.data || [];

        const company = meRes?.data?.company || meRes?.data?.user?.company || meRes?.data?.user?.company_info;
        if (company) {
            (window as any).currentSolidconUrls = [
                company.solidcon_url_1 || '',
                company.solidcon_url_2 || '',
                company.solidcon_url_3 || '',
                company.solidcon_url_4 || '',
                company.solidcon_url_5 || '',
            ];
        }

        const catSelect = document.getElementById('category');
        if (catSelect) {
            catSelect.innerHTML = '<option value="">Selecione...</option>';
            categoriesData.forEach(c => {
                catSelect.innerHTML += `<option value="${c.public_id}">${c.name}</option>`;
            });
        }

        const bankSelect = document.getElementById('bankSelect');
        const filterBank = document.getElementById('filterBank');
        const bulkUpdateBank = document.getElementById('bulkUpdateBank');
        if (bankSelect) {
            bankSelect.innerHTML = '<option value="">Selecione a conta depositaria...</option>';
        }
        if (filterBank) {
            filterBank.innerHTML = '<option value="">Todas as Contas</option>';
        }
        if (bulkUpdateBank) {
            bulkUpdateBank.innerHTML = '<option value="">-- Manter Conta Original de Cada Lançamento --</option>';
        }
        banksData.forEach(b => {
            if (bankSelect) bankSelect.innerHTML += `<option value="${b.public_id}">${b.name}</option>`;
            if (filterBank) filterBank.innerHTML += `<option value="${b.public_id}">${b.name}</option>`;
            if (bulkUpdateBank) bulkUpdateBank.innerHTML += `<option value="${b.public_id}">${b.name}</option>`;
        });

    } catch (e) {
        console.error('Falha ao carregar categorias ou bancos', e);
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
                <div>${translateDescription(r.description)}</div>
                ${r.entity_name ? `
                <div class="text-xs text-gray-500 dark:text-gray-400 font-normal mt-0.5 flex items-center gap-1">
                    <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                    ${r.entity_name}
                </div>` : '<div class="text-xs text-gray-400 mt-0.5 dark:text-gray-500">Sem vínculo</div>'}
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
            <td class="px-2 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600 dark:text-green-400">+ ${formatCurrency(r.amount)}</td>
            <td class="px-2 py-3 whitespace-nowrap text-center text-sm font-medium">
                ${revenueStatus !== 'paid' ? `
                <button type="button" class="text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300 mr-2 cursor-pointer baixa-btn" data-id="${r.public_id}" title="Baixa">
                    <span class="inline-flex items-center rounded bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-semibold pointer-events-none">Baixa</span>
                </button>` : ''}
                <button type="button" class="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 mr-2 cursor-pointer send-whatsapp-btn" data-id="${r.public_id}" data-phone="${r.customer_phone || ''}" title="Enviar por WhatsApp">
                    <svg class="h-5 w-5 inline pointer-events-none" fill="currentColor" viewBox="0 0 448 512">
                        <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L3 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
                    </svg>
                </button>
                ${isOverdue ? `
                <button type="button" class="text-rose-600 hover:text-rose-900 dark:text-rose-400 dark:hover:text-rose-300 mr-2 cursor-pointer inline-flex items-center gap-1 open-receipt-btn" data-id="${r.public_id}" title="Cobrar">
                    <span class="inline-flex h-5 w-5 items-center justify-center text-base font-bold leading-none text-rose-600 dark:text-rose-400 pointer-events-none">$</span>
                </button>` : `
                <button type="button" class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-2 cursor-pointer open-receipt-btn" data-id="${r.public_id}" title="Recibo">
                    <svg class="h-5 w-5 inline pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </button>`}
                ${r.payment_method === 'boleto' ? `
                    ${(r.billet_url || revenueStatus !== 'paid') ? `
                    <button type="button" class="${r.billet_url ? 'text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300' : 'text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300'} mr-2 cursor-pointer open-boleto-btn" data-id="${r.public_id}" data-nosso-numero="${r.billet_url || ''}" title="${r.billet_url ? 'Visualizar Boleto PDF' : 'Gerar Boleto'}">
                        ${r.billet_url ? `
                        <svg class="h-5 w-5 inline pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        ` : `
                        <svg class="h-5 w-5 inline pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                        `}
                    </button>` : ''}
                    ${(r.billet_url && revenueStatus !== 'paid') ? `
                    <button type="button" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-2 cursor-pointer sync-boleto-btn" data-id="${r.public_id}" title="Sincronizar Status do Boleto">
                        <svg class="h-5 w-5 inline pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
                        </svg>
                    </button>
                    <button type="button" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 mr-2 cursor-pointer cancel-boleto-btn" data-id="${r.public_id}" title="Cancelar Boleto">
                        <svg class="h-5 w-5 inline pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                    </button>` : ''}
                ` : ''}
                <button type="button" class="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 mr-2 cursor-pointer duplicate-btn" data-id="${r.public_id}" title="Duplicar">
                    <svg class="h-5 w-5 inline pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                </button>
                <button type="button" class="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 mr-2 cursor-pointer edit-btn" data-id="${r.public_id}" title="Editar">
                    <svg class="h-5 w-5 inline pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
                <button type="button" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 cursor-pointer delete-btn" data-id="${r.public_id}" title="Excluir">
                    <svg class="h-5 w-5 inline pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    <button type="button" class="p-1.5 text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 bg-gray-50 hover:bg-emerald-50 dark:bg-slate-700 dark:hover:bg-emerald-900/30 rounded cursor-pointer baixa-btn" data-id="${r.public_id}" title="Baixa">
                        <span class="inline-flex h-4 items-center justify-center text-xs font-bold leading-none pointer-events-none">Baixa</span>
                    </button>` : ''}
                    <button type="button" class="p-1.5 text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300 bg-gray-50 hover:bg-green-50 dark:bg-slate-700 dark:hover:bg-green-900/30 rounded cursor-pointer send-whatsapp-btn" data-id="${r.public_id}" data-phone="${r.customer_phone || ''}" title="Enviar por WhatsApp">
                        <svg class="h-4 w-4 pointer-events-none" fill="currentColor" viewBox="0 0 448 512">
                            <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L3 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
                        </svg>
                    </button>
                    ${isOverdue ? `
                    <button type="button" class="p-1.5 text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 bg-gray-50 hover:bg-rose-50 dark:bg-slate-700 dark:hover:bg-rose-900/30 rounded cursor-pointer open-receipt-btn" data-id="${r.public_id}" title="Cobrar">
                        <span class="inline-flex h-4 w-4 items-center justify-center text-sm font-bold leading-none text-rose-500 dark:text-rose-400 pointer-events-none">$</span>
                    </button>` : `
                    <button type="button" class="p-1.5 text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 bg-gray-50 hover:bg-indigo-50 dark:bg-slate-700 dark:hover:bg-indigo-900/30 rounded cursor-pointer open-receipt-btn" data-id="${r.public_id}" title="Recibo">
                        <svg class="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </button>`}
                    ${r.payment_method === 'boleto' ? `
                        ${(r.billet_url || revenueStatus !== 'paid') ? `
                        <button type="button" class="p-1.5 ${r.billet_url ? 'text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 bg-gray-50 hover:bg-indigo-50 dark:bg-slate-700 dark:hover:bg-indigo-900/30' : 'text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 bg-gray-50 hover:bg-emerald-50 dark:bg-slate-700 dark:hover:bg-emerald-900/30'} rounded cursor-pointer open-boleto-btn" data-id="${r.public_id}" data-nosso-numero="${r.billet_url || ''}" title="${r.billet_url ? 'Visualizar Boleto PDF' : 'Gerar Boleto'}">
                            ${r.billet_url ? `
                            <svg class="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            ` : `
                            <svg class="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            </svg>
                            `}
                        </button>` : ''}
                        ${(r.billet_url && revenueStatus !== 'paid') ? `
                        <button type="button" class="p-1.5 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 bg-gray-50 hover:bg-blue-50 dark:bg-slate-700 dark:hover:bg-blue-900/30 rounded cursor-pointer sync-boleto-btn" data-id="${r.public_id}" title="Sincronizar Status do Boleto">
                            <svg class="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
                            </svg>
                        </button>
                        <button type="button" class="p-1.5 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 bg-gray-50 hover:bg-red-50 dark:bg-slate-700 dark:hover:bg-red-900/30 rounded cursor-pointer cancel-boleto-btn" data-id="${r.public_id}" title="Cancelar Boleto">
                            <svg class="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                        </button>` : ''}
                    ` : ''}
                    <button type="button" class="p-1.5 text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400 bg-gray-50 hover:bg-brand-50 dark:bg-slate-700 dark:hover:bg-brand-900/30 rounded cursor-pointer edit-btn" data-id="${r.public_id}" title="Editar">
                        <svg class="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button type="button" class="p-1.5 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 bg-gray-50 hover:bg-indigo-50 dark:bg-slate-700 dark:hover:bg-indigo-900/30 rounded cursor-pointer duplicate-btn" data-id="${r.public_id}" title="Duplicar">
                        <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </button>
                    <button type="button" class="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 bg-gray-50 hover:bg-red-50 dark:bg-slate-700 dark:hover:bg-red-900/30 rounded cursor-pointer delete-btn" data-id="${r.public_id}" title="Excluir">
                        <svg class="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                <div class="mt-2 flex flex-col gap-1 items-start">
                    ${r.entity_name ? `
                    <div class="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                        ${r.entity_name}
                    </div>` : '<div class="mt-1 text-xs text-gray-400 dark:text-gray-500">Sem vínculo</div>'}
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

    const receivedAtEl = document.getElementById('receivedAt');
    if (receivedAtEl) receivedAtEl.value = '';
    const receivedAtContainer = document.getElementById('receivedAtContainer');
    if (receivedAtContainer) receivedAtContainer.classList.add('hidden');

    const entityTypeSelect = document.getElementById('entityType');
    if (entityTypeSelect) entityTypeSelect.value = '';
    handleEntityTypeChange();

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

window.closeBulkUpdateModal = () => {
    document.getElementById('bulkUpdateModal')?.classList.add('hidden');
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

function openWhatsappModal(id, phone) {
    g_whatsappId = id;
    const input = document.getElementById('whatsappPhoneInput') as HTMLInputElement | null;
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
    if (!g_whatsappId) return;

    const input = document.getElementById('whatsappPhoneInput') as HTMLInputElement | null;
    const phone = input ? input.value.trim() : '';

    const btn = document.getElementById('btnConfirmWhatsappSend');
    const spinner = document.getElementById('whatsappSendSpinner');
    const errDiv = document.getElementById('whatsappModalError');

    if (errDiv) {
        errDiv.textContent = '';
        errDiv.classList.add('hidden');
    }

    if (btn) btn.setAttribute('disabled', 'true');
    if (spinner) {
        spinner.classList.remove('hidden');
        spinner.classList.add('inline-block');
    }

    try {
        const jwtToken = localStorage.getItem('erp_token') || '';
        const response = await fetch(`/api/v1/finance/revenues/${g_whatsappId}/send-whatsapp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            },
            body: JSON.stringify({ phone })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Erro ao enviar cobrança por WhatsApp');
        }

        if (typeof UI !== 'undefined' && UI.showAlert) {
            UI.showAlert('alertMessage', 'Cobrança enviada com sucesso!', 'success');
        }
        closeWhatsappModal();
    } catch (error: any) {
        const errMsg = error.message || 'Falha ao enviar por WhatsApp';
        if (errDiv) {
            errDiv.textContent = errMsg;
            errDiv.classList.remove('hidden');
        } else if (typeof UI !== 'undefined' && UI.showAlert) {
            UI.showAlert('alertMessage', errMsg, 'error');
        }
        if (btn) btn.removeAttribute('disabled');
        if (spinner) spinner.classList.add('hidden');
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

        const entityTypeSelect = document.getElementById('entityType');
        if (rev.entity_type && rev.entity_public_id) {
            if (entityTypeSelect) entityTypeSelect.value = rev.entity_type;
            const entitySelect = document.getElementById('entitySelect');
            if (entitySelect) {
                entitySelect.disabled = false;
                entitySelect.innerHTML = '<option value="">Carregando...</option>';
                loadPeopleOfType(rev.entity_type).then((items) => {
                    entitySelect.innerHTML = '<option value="">Selecione...</option>' + items
                        .map((x) => `<option value="${x.public_id}">${x.name}</option>`)
                        .join('');
                    entitySelect.value = rev.entity_public_id;
                });
            }
        } else {
            if (entityTypeSelect) entityTypeSelect.value = '';
            handleEntityTypeChange();
        }

        const paymentEl = document.getElementById('paymentMethod');
        if (paymentEl) paymentEl.value = rev.payment_method || '';

        const statusEl = document.getElementById('status');
        if (statusEl) statusEl.value = rev.status || 'paid';

        const receivedAtEl = document.getElementById('receivedAt');
        const receivedAtContainer = document.getElementById('receivedAtContainer');
        if (statusEl && statusEl.value === 'paid') {
            if (receivedAtContainer) receivedAtContainer.classList.remove('hidden');
            if (receivedAtEl) receivedAtEl.value = toDateTimeInputValue(rev.received_at);
        } else {
            if (receivedAtContainer) receivedAtContainer.classList.add('hidden');
            if (receivedAtEl) receivedAtEl.value = '';
        }

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

        const entityTypeSelect = document.getElementById('entityType');
        if (rev.entity_type && rev.entity_public_id) {
            if (entityTypeSelect) entityTypeSelect.value = rev.entity_type;
            const entitySelect = document.getElementById('entitySelect');
            if (entitySelect) {
                entitySelect.disabled = false;
                entitySelect.innerHTML = '<option value="">Carregando...</option>';
                loadPeopleOfType(rev.entity_type).then((items) => {
                    entitySelect.innerHTML = '<option value="">Selecione...</option>' + items
                        .map((x) => `<option value="${x.public_id}">${x.name}</option>`)
                        .join('');
                    entitySelect.value = rev.entity_public_id;
                });
            }
        } else {
            if (entityTypeSelect) entityTypeSelect.value = '';
            handleEntityTypeChange();
        }

        const paymentEl = document.getElementById('paymentMethod');
        if (paymentEl) paymentEl.value = rev.payment_method || '';

        const statusEl = document.getElementById('status');
        if (statusEl) statusEl.value = rev.status || 'paid';

        const receivedAtEl = document.getElementById('receivedAt');
        const receivedAtContainer = document.getElementById('receivedAtContainer');
        if (statusEl && statusEl.value === 'paid') {
            if (receivedAtContainer) receivedAtContainer.classList.remove('hidden');
            if (receivedAtEl) receivedAtEl.value = toDateTimeInputValue(rev.received_at);
        } else {
            if (receivedAtContainer) receivedAtContainer.classList.add('hidden');
            if (receivedAtEl) receivedAtEl.value = '';
        }

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

    const sendWhatsappBtn = (e.target as HTMLElement).closest('.send-whatsapp-btn');
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
    } else {
        const openBoletoBtn = (e.target as HTMLElement).closest('.open-boleto-btn');
        const cancelBoletoBtn = (e.target as HTMLElement).closest('.cancel-boleto-btn');
        const syncBoletoBtn = (e.target as HTMLElement).closest('.sync-boleto-btn');
        if (openBoletoBtn) {
            e.preventDefault();
            e.stopPropagation();
            const pubId = openBoletoBtn.getAttribute('data-id');
            const nossoNumero = openBoletoBtn.getAttribute('data-nosso-numero');
            
            if (pubId) {
                if (nossoNumero && nossoNumero.trim() !== '') {
                    openBoletoModal(pubId, nossoNumero);
                } else {
                    if (confirm('Esta receita ainda não possui boleto gerado no banco. Deseja emitir agora?')) {
                        // Faz a emissão
                        const jwtToken = localStorage.getItem('erp_token') || '';
                        fetch('/api/v1/finance/revenues/' + pubId + '/generate-billet', {
                            method: 'POST',
                            headers: { 'Authorization': 'Bearer ' + jwtToken }
                        })
                        .then(res => res.json())
                        .then(data => {
                            if (data.status === 'success') {
                                (window as any).UI.showAlert('alertMessage', 'Boleto gerado com sucesso!', 'success');
                                fetchRevenues();
                            } else {
                                (window as any).UI.showAlert('alertMessage', 'Erro: ' + data.message, 'error');
                            }
                        })
                        .catch(err => {
                            (window as any).UI.showAlert('alertMessage', 'Erro de conexão: ' + err.message, 'error');
                        });
                    }
                }
            }
        } else if (cancelBoletoBtn) {
            e.preventDefault();
            e.stopPropagation();
            const pubId = cancelBoletoBtn.getAttribute('data-id');
            if (pubId && confirm('Deseja realmente cancelar este boleto no banco? Esta ação não pode ser desfeita.')) {
                const jwtToken = localStorage.getItem('erp_token') || '';
                fetch('/api/v1/finance/revenues/batch-cancel-billets', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + jwtToken, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: [pubId] })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        (window as any).UI.showAlert('alertMessage', 'Boleto cancelado com sucesso!', 'success');
                        fetchRevenues();
                    } else {
                        (window as any).UI.showAlert('alertMessage', 'Erro ao cancelar: ' + data.message, 'error');
                    }
                })
                .catch(err => {
                    (window as any).UI.showAlert('alertMessage', 'Erro de conexão: ' + err.message, 'error');
                });
            }
        } else if (syncBoletoBtn) {
            e.preventDefault();
            e.stopPropagation();
            const pubId = syncBoletoBtn.getAttribute('data-id');
            if (pubId) {
                const originalHtml = syncBoletoBtn.innerHTML;
                syncBoletoBtn.innerHTML = '...';
                syncBoletoBtn.setAttribute('disabled', 'true');
                const jwtToken = localStorage.getItem('erp_token') || '';
                fetch('/api/v1/finance/revenues/' + pubId + '/sync-boleto-status', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + jwtToken }
                })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        const situacao = data.situacao || 'Desconhecido';
                        (window as any).UI.showAlert('alertMessage', `Status do boleto sincronizado com sucesso! Situação: ${situacao}`, 'success');
                        fetchRevenues();
                    } else {
                        (window as any).UI.showAlert('alertMessage', 'Erro ao sincronizar boleto: ' + (data.message || 'Erro desconhecido'), 'error');
                        syncBoletoBtn.innerHTML = originalHtml;
                        syncBoletoBtn.removeAttribute('disabled');
                    }
                })
                .catch(err => {
                    (window as any).UI.showAlert('alertMessage', 'Erro de conexão: ' + err.message, 'error');
                    syncBoletoBtn.innerHTML = originalHtml;
                    syncBoletoBtn.removeAttribute('disabled');
                });
            }
        }
    }
});

function openBoletoModal(pubId: string, nossoNumero: string) {
    let url = '/api/v1/finance/revenues/' + pubId + '/boleto-pdf?nossoNumero=' + encodeURIComponent(nossoNumero);
    const jwtToken = localStorage.getItem('erp_token');
    if (jwtToken) {
        url += '&token=' + jwtToken;
    }
    
    const pdfIframe = document.getElementById('pdfIframe') as HTMLIFrameElement;
    const printPdfBtn = document.getElementById('printPdfBtn');
    const pdfModalTitleText = document.getElementById('pdfModalTitleText');
    if (pdfIframe) pdfIframe.src = url;
    if (printPdfBtn) printPdfBtn.classList.remove('hidden');
    if (pdfModalTitleText) pdfModalTitleText.textContent = 'Boleto';
    document.getElementById('pdfModal').classList.remove('hidden');
}

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
    const target = e.target as HTMLInputElement;
    if (target.id === 'selectAllCheckbox') {
        const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
        const container = document.getElementById(containerId);
        const checkboxes = container ? container.querySelectorAll('.revenue-checkbox') : [];
        checkboxes.forEach(cb => (cb as HTMLInputElement).checked = target.checked);
        updateSelectedCount();
    }

    if (target.classList.contains('revenue-checkbox')) {
        const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
        const container = document.getElementById(containerId);
        const checkboxes = container ? container.querySelectorAll('.revenue-checkbox') : [];
        const allChecked = Array.from(checkboxes).length > 0 && Array.from(checkboxes).every(cb => (cb as HTMLInputElement).checked);
        const selectAllCheckbox = document.getElementById('selectAllCheckbox') as HTMLInputElement;
        if (selectAllCheckbox) selectAllCheckbox.checked = allChecked;
        updateSelectedCount();
    }
});

function updateSelectedCount() {
    const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
    const container = document.getElementById(containerId);
    const selected = container ? container.querySelectorAll('.revenue-checkbox:checked') : [];
    const selectedIds = Array.from(selected).map(cb => (cb as HTMLInputElement).value);

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

function clearCheckboxSelection() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox') as HTMLInputElement;
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    document.querySelectorAll('.revenue-checkbox').forEach(cb => (cb as HTMLInputElement).checked = false);
    updateSelectedCount();
}

async function handleBatchGenerateBillet() {
    const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
    const container = document.getElementById(containerId);
    const selected = container ? container.querySelectorAll('.revenue-checkbox:checked') : [];
    const selectedIds = Array.from(selected).map(cb => (cb as HTMLInputElement).value);
    if (selectedIds.length === 0) return;

    if (!confirm(`Deseja gerar boletos para as ${selectedIds.length} receitas selecionadas?`)) return;

    const btn = document.getElementById('btnBatchGenerateBillet');
    const oldText = btn ? btn.textContent : '';
    if (btn) {
        btn.textContent = 'Gerando...';
        btn.disabled = true;
    }

    try {
        await api('/finance/revenues/batch-generate-billets', {
            method: 'POST',
            body: JSON.stringify({ ids: selectedIds })
        });
        UI.showAlert('alertMessage', 'Boletos gerados com sucesso!', 'success');

        clearCheckboxSelection();

        fetchRevenues();
    } catch (err: any) {
        UI.showAlert('alertMessage', 'Erro ao gerar boletos em lote: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.textContent = oldText;
            btn.disabled = false;
        }
    }
}

async function handleBatchCancelBillet() {
    const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
    const container = document.getElementById(containerId);
    const selected = container ? container.querySelectorAll('.revenue-checkbox:checked') : [];
    const selectedIds = Array.from(selected).map(cb => (cb as HTMLInputElement).value);
    if (selectedIds.length === 0) return;

    if (!confirm(`Deseja cancelar boletos das ${selectedIds.length} receitas selecionadas?`)) return;

    const btn = document.getElementById('btnBatchCancelBillet');
    const oldText = btn ? btn.textContent : '';
    if (btn) {
        btn.textContent = 'Cancelando...';
        btn.disabled = true;
    }

    try {
        await api('/finance/revenues/batch-cancel-billets', {
            method: 'POST',
            body: JSON.stringify({ ids: selectedIds })
        });
        UI.showAlert('alertMessage', 'Boletos cancelados com sucesso!', 'success');

        clearCheckboxSelection();

        fetchRevenues();
    } catch (err: any) {
        UI.showAlert('alertMessage', 'Erro ao cancelar boletos em lote: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.textContent = oldText;
            btn.disabled = false;
        }
    }
}

async function handleBatchDeleteRevenue() {
    const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
    const container = document.getElementById(containerId);
    const selected = container ? container.querySelectorAll('.revenue-checkbox:checked') : [];
    const selectedIds = Array.from(selected).map(cb => (cb as HTMLInputElement).value);
    if (selectedIds.length === 0) return;

    if (!confirm(`Deseja excluir as ${selectedIds.length} receitas selecionadas?`)) return;

    const btn = document.getElementById('btnBatchDeleteRevenue');
    const oldText = btn ? btn.textContent : '';
    if (btn) {
        btn.textContent = 'Excluindo...';
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
        } else {
            UI.showAlert('alertMessage', 'Receitas excluídas com sucesso!', 'success');
        }

        clearCheckboxSelection();

        fetchRevenues();
    } catch (err: any) {
        UI.showAlert('alertMessage', 'Erro ao excluir receitas em lote: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.textContent = oldText;
            btn.disabled = false;
        }
    }
}

async function handleBatchUpdateRevenue() {
    const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
    const container = document.getElementById(containerId);
    const selected = container ? container.querySelectorAll('.revenue-checkbox:checked') : [];
    const selectedIds = Array.from(selected).map(cb => (cb as HTMLInputElement).value);
    if (selectedIds.length === 0) return;

    // Reset form and open modal
    const bulkUpdateForm = document.getElementById('bulkUpdateForm');
    if (bulkUpdateForm) (bulkUpdateForm as HTMLFormElement).reset();

    const countSpan = document.getElementById('bulkUpdateModalCount');
    if (countSpan) countSpan.textContent = selectedIds.length.toString();

    const modal = document.getElementById('bulkUpdateModal');
    if (modal) modal.classList.remove('hidden');
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
                        entity_type: rev.entity_type || null,
                        entity_public_id: rev.entity_public_id || null,
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

    const bulkUpdateForm = document.getElementById('bulkUpdateForm');
    if (bulkUpdateForm) {
        bulkUpdateForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const containerId = currentView === 'list' ? 'revenuesTable' : 'revenuesGridContainer';
            const container = document.getElementById(containerId);
            const selected = container ? container.querySelectorAll('.revenue-checkbox:checked') : [];
            const selectedIds = Array.from(selected).map(cb => (cb as HTMLInputElement).value);
            if (selectedIds.length === 0) return;

            const bank_account_public_id = document.getElementById('bulkUpdateBank')?.value || undefined;
            const payment_method = document.getElementById('bulkUpdateMethod')?.value || undefined;
            const date = document.getElementById('bulkUpdateDate')?.value || undefined;

            const button = document.getElementById('confirmBulkUpdateBtn');
            const oldText = button ? button.textContent : '';
            if (button) {
                (button as HTMLButtonElement).disabled = true;
                button.textContent = 'Salvando...';
            }

            try {
                const res = await api('/finance/revenues/batch-update', {
                    method: 'POST',
                    body: JSON.stringify({
                        ids: selectedIds,
                        bank_account_public_id,
                        payment_method,
                        date
                    })
                });

                const successCount = res?.data?.success || 0;
                const errorList = res?.data?.errors || [];

                window.closeBulkUpdateModal();
                clearCheckboxSelection();

                if (errorList.length > 0) {
                    UI.showAlert('alertMessage', `Alteradas ${successCount} receitas. Algumas falharam:\n${errorList.join('\n')}`, 'error');
                } else {
                    UI.showAlert('alertMessage', 'Alteração em lote realizada com sucesso!', 'success');
                }

                await fetchRevenues();
                await loadDependencies();
            } catch (error) {
                UI.showAlert('alertMessage', 'Erro ao realizar alteração em lote: ' + error.message, 'error');
            } finally {
                if (button) {
                    (button as HTMLButtonElement).disabled = false;
                    button.textContent = oldText;
                }
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
        bank_account_public_id: document.getElementById('bankSelect').value
    };

    const entityType = document.getElementById('entityType')?.value || '';
    const entityPublicId = document.getElementById('entitySelect')?.value || '';
    if (entityType && entityPublicId) {
        data.entity_type = entityType;
        data.entity_public_id = entityPublicId;
    } else {
        data.entity_type = null;
        data.entity_public_id = null;
    }

    const paymentEl = document.getElementById('paymentMethod');
    if (paymentEl && paymentEl.value) {
        data.payment_method = paymentEl.value;
    }

    const statusEl = document.getElementById('status');
    if (statusEl && statusEl.value) {
        data.status = statusEl.value;
        if (data.status === 'paid') {
            const receivedAtEl = document.getElementById('receivedAt');
            if (receivedAtEl && receivedAtEl.value) {
                data.received_at = toMysqlDateTimeValue(receivedAtEl.value);
            }
        }
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
