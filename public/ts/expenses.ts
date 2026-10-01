(() => {
  type AnyRecord = Record<string, any>;

  type Expense = {
    public_id: string;
    id: number | string;
    description: string;
    amount: number | string;
    date: string;
    status?: 'paid' | 'pending' | string;
    payment_method?: string;
    category_name?: string | null;
    category_public_id?: string | null;
    bank_account_name?: string | null;
    bank_account_public_id?: string | null;
    entity_name?: string | null;
    entity_public_id?: string | null;
    entity_type?: string | null;
    barcode?: string | null;
    pix_code?: string | null;
    pix_key?: string | null;
    created_at?: string | Date | null;
    scheduled_at?: string | Date | null;
    cost_center_public_id?: string | null;
    cost_center_name?: string | null;
  };

  type Category = { public_id: string; name: string; type: string };
  type BankAccount = { public_id: string; name: string };

  const api: any = (window as any).api;
  const Auth: any = (window as any).Auth;
  const UI: any = (window as any).UI;
  const DateUtils: any = (window as any).DateUtils;
  const Paginator: any = (window as any).Paginator;

  let expensesData: Expense[] = [];
  let categoriesData: Category[] = [];
  let banksData: BankAccount[] = [];
  let paymentTypesData: any[] = [];
  let customerGroupsData: any[] = [];
  let categoryTypesData: any[] = [];
  let costCentersData: any[] = [];
  let g_editId: string | null = null;
  let currentView: 'list' | 'grid' = ((((window as any).CompanyStorage?.getItem('expensesView') ?? localStorage.getItem('expensesView')) as any) || 'list') === 'grid' ? 'grid' : 'list';

  const peopleCache: Record<string, { public_id: string; name: string }[]> = {};

  async function loadPeopleOfType(type: string): Promise<{ public_id: string; name: string }[]> {
    if (peopleCache[type]) return peopleCache[type];

    let items: any[] = [];
    try {
      if (type === 'customer') {
        const res = await api('/entities/customers');
        items = (res.data || []).map((x: any) => ({ public_id: x.public_id, name: x.name, customer_group_public_id: x.customer_group_public_id }));
      } else if (type === 'supplier') {
        const res = await api('/entities/suppliers');
        items = (res.data || []).map((x: any) => ({ public_id: x.public_id, name: x.name }));
      } else if (type === 'contact') {
        const res = await api('/entities/contacts');
        items = (res.data || []).map((x: any) => ({ public_id: x.public_id, name: x.name }));
      } else if (type === 'seller') {
        const res = await api('/sellers');
        items = (res.data || []).map((x: any) => ({ public_id: x.public_id, name: x.full_name }));
      } else if (['buyer', 'service_provider', 'accountant'].includes(type)) {
        const res = await api('/users');
        items = (res.data || [])
          .filter((x: any) => x.role === type)
          .map((x: any) => ({ public_id: x.public_id, name: x.full_name }));
      }
    } catch (e) {
      console.error(`Failed to load people of type ${type}`, e);
    }
    
    items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    peopleCache[type] = items;
    return items;
  }

  function handleEntityTypeChange(selectedEntityPublicId?: string): void {
    const type = getInputValue('entityType');
    const entitySelect = document.getElementById('entitySelect') as HTMLSelectElement | null;
    const customerGroupContainer = document.getElementById('customerGroupContainer');
    const customerGroupSelect = document.getElementById('customerGroupSelect') as HTMLSelectElement | null;
    const entityGrid = document.getElementById('entityGrid');
    if (!entitySelect) return;

    entitySelect.innerHTML = '';

    if (!type) {
      entitySelect.disabled = true;
      entitySelect.innerHTML = '<option value="">Selecione o tipo primeiro...</option>';
      if (customerGroupContainer) customerGroupContainer.classList.add('hidden');
      if (customerGroupSelect) customerGroupSelect.value = '';
      if (entityGrid) {
        entityGrid.classList.remove('grid-cols-3');
        entityGrid.classList.add('grid-cols-2');
      }
      return;
    }

    if (type === 'customer') {
      if (customerGroupContainer) customerGroupContainer.classList.remove('hidden');
      if (entityGrid) {
        entityGrid.classList.remove('grid-cols-2');
        entityGrid.classList.add('grid-cols-3');
      }
      if (customerGroupSelect) {
        customerGroupSelect.innerHTML = '<option value="">Selecione o grupo...</option>' + customerGroupsData
          .map((g) => `<option value="${g.public_id}">${g.name}</option>`)
          .join('');
        customerGroupSelect.value = '';
      }
    } else {
      if (customerGroupContainer) customerGroupContainer.classList.add('hidden');
      if (customerGroupSelect) customerGroupSelect.value = '';
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
        if (cust && (cust as any).customer_group_public_id) {
          if (customerGroupSelect) {
            customerGroupSelect.value = (cust as any).customer_group_public_id;
          }
        }
      }

      const selectedGroup = customerGroupSelect?.value || '';
      let filteredItems = items;
      if (type === 'customer' && selectedGroup) {
        filteredItems = items.filter((x) => (x as any).customer_group_public_id === selectedGroup);
      }

      entitySelect.innerHTML = '<option value="">Selecione...</option>' + filteredItems
        .map((x) => `<option value="${x.public_id}">${x.name}</option>`)
        .join('');

      if (selectedEntityPublicId) {
        entitySelect.value = selectedEntityPublicId;
      }
    });
  }

  function mapPaymentTypeNameToEnum(name: string): string {
    const raw = name.toLowerCase();
    if (raw.includes('pix')) return 'pix';
    if (raw.includes('boleto')) return 'boleto';
    if (raw.includes('credito') || raw.includes('credit') || raw.includes('crédito')) return 'credit';
    if (raw.includes('debito') || raw.includes('debit') || raw.includes('débito')) return 'debit';
    if (raw.includes('dinheiro') || raw.includes('cash')) return 'cash';
    if (raw.includes('transferencia') || raw.includes('transferência') || raw.includes('transfer') || raw.includes('ted') || raw.includes('doc')) return 'transfer';
    return 'cash';
  }

  function updatePaymentMethodOptions(): void {
    const bankSelect = document.getElementById('bankSelect') as HTMLSelectElement | null;
    const paymentEl = document.getElementById('paymentMethod') as HTMLSelectElement | null;
    if (!paymentEl) return;

    const currentValue = paymentEl.value;
    const selectedBankPublicId = bankSelect ? bankSelect.value : '';
    const bankObj = banksData.find((b) => b.public_id === selectedBankPublicId);
    const bankId = bankObj ? (bankObj as any).id : null;

    const filteredTypes = bankId
      ? paymentTypesData.filter((pt) => pt.bank_account_id === bankId)
      : [];

    if (!bankId) {
      paymentEl.innerHTML = '<option value="">Selecione a conta de saída primeiro...</option>';
      paymentEl.disabled = true;
    } else if (filteredTypes.length > 0) {
      paymentEl.disabled = false;
      paymentEl.innerHTML =
        '<option value="">Sem forma de pagamento</option>' +
        filteredTypes
          .map((pt) => {
            const enumValue = mapPaymentTypeNameToEnum(pt.name);
            return `<option value="${enumValue}" data-payment-type-id="${pt.id}">${pt.name}</option>`;
          })
          .join('');
    } else {
      paymentEl.disabled = false;
      paymentEl.innerHTML = `
        <option value="">Sem forma de pagamento</option>
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
  }

  function getInputValue(id: string): string {
    return (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)?.value || '';
  }

  function setInputValue(id: string, value: string): void {
    const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
    if (el) el.value = value;
  }

  function setCurrencyValue(inputId: string, numValue: any): void {
    const el = document.getElementById(inputId) as HTMLInputElement | null;
    if (!el) return;
    let valStr = parseFloat(numValue || 0).toFixed(2);
    let digitsOnly = valStr.replace(/\D/g, '');
    let formatted = (parseInt(digitsOnly, 10) / 100).toFixed(2) + '';
    formatted = formatted.replace('.', ',');
    formatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    el.value = 'R$ ' + formatted;
  }

  function updateViewToggle(): void {
    const btnList = document.getElementById('btnListView');
    const btnGrid = document.getElementById('btnGridView');
    const tableSection = document.getElementById('expensesSection');
    const gridSection = document.getElementById('expensesGridSection');
    const tablePagContainer = document.getElementById('expensesPaginationContainer');
    const gridPagContainer = document.getElementById('expensesGridPaginationContainer');

    if (btnList && btnGrid) {
      btnList.className =
        'flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1';
      btnGrid.className =
        'flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1';

      (btnList.querySelector('.check-icon') as HTMLElement | null)?.classList.add('hidden');
      (btnGrid.querySelector('.check-icon') as HTMLElement | null)?.classList.add('hidden');

      if (currentView === 'list') {
        btnList.className =
          'flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1';
        (btnList.querySelector('.check-icon') as HTMLElement | null)?.classList.remove('hidden');
      } else {
        btnGrid.className =
          'flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1';
        (btnGrid.querySelector('.check-icon') as HTMLElement | null)?.classList.remove('hidden');
      }
    }

    if (!tableSection || !gridSection) return;

    if (currentView === 'list' || (!btnList && !btnGrid)) {
      tableSection.style.display = '';
      tableSection.classList.remove('hidden');
      gridSection.style.display = 'none';
      gridSection.classList.add('hidden');
      if (tablePagContainer) tablePagContainer.classList.remove('hidden');
      if (gridPagContainer) gridPagContainer.classList.add('hidden');
    } else {
      tableSection.style.display = 'none';
      tableSection.classList.add('hidden');
      gridSection.style.display = 'flex';
      gridSection.classList.remove('hidden');
      if (tablePagContainer) tablePagContainer.classList.add('hidden');
      if (gridPagContainer) gridPagContainer.classList.remove('hidden');
    }
  }

  // ── Paginadores ─────────────────────────────────────────────
  let _tablePager: any = null;
  let _gridPager: any = null;

  document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
      window.location.href = '/';
      return;
    }

    document.title = 'KEYSTONE - Despesas';
    setupTabs();

    const btnOpenModal = document.getElementById('btnOpenModal');
    if (btnOpenModal) btnOpenModal.addEventListener('click', openModal);

    const btnCancelModal = document.getElementById('btnCancelModal');
    if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

    const expenseForm = document.getElementById('expenseForm') as HTMLFormElement | null;
    if (expenseForm) expenseForm.addEventListener('submit', handleSaveExpense);

    const valueEl = document.getElementById('value') as HTMLInputElement | null;
    if (valueEl) {
      valueEl.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement | null;
        if (!target) return;

        let value = target.value.replace(/\D/g, '');
        if (value === '') value = '0';
        let formatted = (parseInt(value, 10) / 100).toFixed(2) + '';
        formatted = formatted.replace('.', ',');
        formatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        target.value = 'R$ ' + formatted;
      });
    }

    const btnListView = document.getElementById('btnListView');
    if (btnListView) {
      btnListView.addEventListener('click', () => {
        currentView = 'list';
        if ((window as any).CompanyStorage) {
          (window as any).CompanyStorage.setItem('expensesView', 'list');
        } else {
          localStorage.setItem('expensesView', 'list');
        }
        updateViewToggle();
      });
    }

    const btnGridView = document.getElementById('btnGridView');
    if (btnGridView) {
      btnGridView.addEventListener('click', () => {
        currentView = 'grid';
        if ((window as any).CompanyStorage) {
          (window as any).CompanyStorage.setItem('expensesView', 'grid');
        } else {
          localStorage.setItem('expensesView', 'grid');
        }
        updateViewToggle();
      });
    }

    const FILTER_STORAGE_KEY = 'expenses_filter_open';
    const toggleFilterBtn = document.getElementById('toggleFilterBtn');
    const filterBody = document.getElementById('filterBody') as HTMLElement | null;
    const filterChevron = document.getElementById('filterChevron') as HTMLElement | null;
    let filterIsOpen = ((window as any).CompanyStorage?.getItem(FILTER_STORAGE_KEY) ?? localStorage.getItem(FILTER_STORAGE_KEY)) === 'true';

    if (filterBody && filterChevron) {
      filterBody.style.transition = 'none';
      filterBody.style.maxHeight = filterIsOpen ? `${filterBody.scrollHeight}px` : '0px';
      filterChevron.style.transform = filterIsOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
      requestAnimationFrame(() => {
        filterBody.style.transition = '';
      });

      if (toggleFilterBtn) {
        toggleFilterBtn.addEventListener('click', () => {
          filterIsOpen = !filterIsOpen;
          if ((window as any).CompanyStorage) {
            (window as any).CompanyStorage.setItem(FILTER_STORAGE_KEY, filterIsOpen ? 'true' : 'false');
          } else {
            localStorage.setItem(FILTER_STORAGE_KEY, filterIsOpen ? 'true' : 'false');
          }
          filterBody.style.maxHeight = filterIsOpen ? `${filterBody.scrollHeight}px` : '0px';
          filterChevron.style.transform = filterIsOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
        });
      }
    }

    const filterSelectors = ['filterPeriod', 'filterStartDate', 'filterEndDate', 'filterPaymentMethod', 'filterStatus', 'filterBank', 'filterCategory', 'filterCategoryType'];

    // Restore saved filter values from localStorage
    filterSelectors.forEach((id) => {
      const savedValue = (window as any).CompanyStorage?.getItem(`expenses_filter_${id}`) ?? localStorage.getItem(`expenses_filter_${id}`);
      if (savedValue !== null && savedValue !== undefined) {
        const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
        if (el) el.value = savedValue;
      }
    });

    const formatLocalDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const updateDatesFromPeriod = (): boolean => {
      const periodEl = document.getElementById('filterPeriod') as HTMLSelectElement | null;
      const startEl = document.getElementById('filterStartDate') as HTMLInputElement | null;
      const endEl = document.getElementById('filterEndDate') as HTMLInputElement | null;
      if (!periodEl || !startEl || !endEl) return false;

      const period = periodEl.value;
      if (period === 'custom') return false;

      let startVal = '';
      let endVal = '';
      const now = new Date();

      if (period === 'today') {
        const todayStr = formatLocalDate(now);
        startVal = todayStr;
        endVal = todayStr;
      } else if (period === 'yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayStr = formatLocalDate(yesterday);
        startVal = yesterdayStr;
        endVal = yesterdayStr;
      } else if (period === 'this_month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        startVal = formatLocalDate(start);
        endVal = formatLocalDate(end);
      } else if (period === 'last_month') {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        startVal = formatLocalDate(start);
        endVal = formatLocalDate(end);
      } else if (period === 'this_year') {
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

    const periodEl = document.getElementById('filterPeriod') as HTMLSelectElement | null;
    const startEl = document.getElementById('filterStartDate') as HTMLInputElement | null;
    const endEl = document.getElementById('filterEndDate') as HTMLInputElement | null;

    const savedPeriod = (window as any).CompanyStorage?.getItem('expenses_filter_filterPeriod') ?? localStorage.getItem('expenses_filter_filterPeriod');
    if (savedPeriod === null || savedPeriod === undefined) {
      if (periodEl) periodEl.value = 'this_month';
      updateDatesFromPeriod();
    } else if (savedPeriod !== 'custom' && savedPeriod !== '') {
      if (periodEl) periodEl.value = savedPeriod;
      updateDatesFromPeriod();
    }

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
        }
      });
    }

    if (endEl) {
      endEl.addEventListener('change', () => {
        if (periodEl && periodEl.value !== 'custom') {
          periodEl.value = 'custom';
        }
      });
    }

    filterSelectors.forEach((id) => {
      if (id === 'filterPeriod') return; // Handled separately
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', applyFilters);
    });

    const btnClearFilters = document.getElementById('btnClearFilters');
    if (btnClearFilters) {
      btnClearFilters.addEventListener('click', () => {
        filterSelectors.forEach((id) => {
          const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
          if (el) el.value = '';
          if ((window as any).CompanyStorage) {
            (window as any).CompanyStorage.removeItem(`expenses_filter_${id}`);
          } else {
            localStorage.removeItem(`expenses_filter_${id}`);
          }
        });
        applyFilters();
      });
    }

    const entityTypeSelect = document.getElementById('entityType');
    if (entityTypeSelect) {
      entityTypeSelect.addEventListener('change', () => handleEntityTypeChange());
    }

    const customerGroupSelect = document.getElementById('customerGroupSelect');
    if (customerGroupSelect) {
      customerGroupSelect.addEventListener('change', () => {
        const type = getInputValue('entityType');
        const entitySelect = document.getElementById('entitySelect') as HTMLSelectElement | null;
        if (!entitySelect || type !== 'customer') return;

        const selectedGroup = (customerGroupSelect as HTMLSelectElement).value || '';
        loadPeopleOfType(type).then((items) => {
          let filteredItems = items;
          if (selectedGroup) {
            filteredItems = items.filter((x) => (x as any).customer_group_public_id === selectedGroup);
          }
          entitySelect.innerHTML = '<option value="">Selecione...</option>' + filteredItems
            .map((x) => `<option value="${x.public_id}">${x.name}</option>`)
            .join('');
        });
      });
    }

    const bankSelect = document.getElementById('bankSelect');
    if (bankSelect) {
      bankSelect.addEventListener('change', () => {
        updatePaymentMethodOptions();
      });
    }

    // Removed legacy entitySearch event listener.

    updateViewToggle();

    await loadDependencies();
    void fetchExpenses();
  });

  const formatCurrency = (value: any): string =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  async function loadDependencies(): Promise<void> {
    try {
      const [catsRes, banksRes, payTypesRes, custGroupsRes, catTypesRes, costCentersRes, meRes] = await Promise.all([
        api('/finance/categories'),
        api('/bank-accounts'),
        api('/payment-types'),
        api('/customer-groups').catch(() => ({ data: [] })),
        api('/finance/category-types').catch(() => ({ data: [] })),
        api('/cost-centers').catch(() => ({ data: [] })),
        api('/auth/me').catch(() => null)
      ]);

      categoriesData = (catsRes.data || []).filter((c: Category) => c.type === 'expense') || [];
      banksData = banksRes.data || [];
      paymentTypesData = payTypesRes.data || [];
      customerGroupsData = custGroupsRes.data || [];
      categoryTypesData = catTypesRes.data || [];
      costCentersData = costCentersRes.data || [];

      const company = meRes?.data?.company || meRes?.data?.user?.company || meRes?.data?.user?.company_info || meRes?.data;
      if (company) {
        (window as any).currentSolidconUrls = [
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
          } else {
            btn.classList.remove('hidden');
            btn.classList.add('inline-flex');
            btn.style.display = '';
          }
        }
      }

      const catSelect = document.getElementById('category') as HTMLSelectElement | null;
      if (catSelect) {
        catSelect.innerHTML = '<option value="">Selecione...</option>';
        categoriesData.forEach((c) => {
          catSelect.innerHTML += `<option value="${c.public_id}">${c.name}</option>`;
        });
      }

      const costCenterSelect = document.getElementById('costCenter') as HTMLSelectElement | null;
      if (costCenterSelect) {
        costCenterSelect.innerHTML = '<option value="">Nenhum/Não Informado</option>';
        costCentersData.forEach((cc) => {
          if (cc.is_active) {
            costCenterSelect.innerHTML += `<option value="${cc.public_id}">${cc.name}</option>`;
          }
        });
      }

      const filterCategory = document.getElementById('filterCategory') as HTMLSelectElement | null;
      if (filterCategory) {
        filterCategory.innerHTML = '<option value="">Todas</option>';
        categoriesData.forEach((c) => {
          filterCategory.innerHTML += `<option value="${c.public_id}">${c.name}</option>`;
        });
      }

      const filterCategoryType = document.getElementById('filterCategoryType') as HTMLSelectElement | null;
      if (filterCategoryType) {
        filterCategoryType.innerHTML = '<option value="">Todos</option>';
        categoryTypesData.forEach((ct) => {
          filterCategoryType.innerHTML += `<option value="${ct.public_id}">${ct.name}</option>`;
        });
      }

      const bankSelect = document.getElementById('bankSelect') as HTMLSelectElement | null;
      const filterBank = document.getElementById('filterBank') as HTMLSelectElement | null;
      if (bankSelect) bankSelect.innerHTML = '<option value="">Selecione a conta de saída primeiro...</option>';
      if (filterBank) filterBank.innerHTML = '<option value="">Todas as Contas</option>';
      banksData.forEach((b) => {
        if (bankSelect) bankSelect.innerHTML += `<option value="${b.public_id}">${b.name}</option>`;
        if (filterBank) filterBank.innerHTML += `<option value="${b.public_id}">${b.name}</option>`;
      });

      const savedCategory = (window as any).CompanyStorage?.getItem('expenses_filter_filterCategory') ?? localStorage.getItem('expenses_filter_filterCategory');
      if (filterCategory && savedCategory) filterCategory.value = savedCategory;

      const savedCategoryType = (window as any).CompanyStorage?.getItem('expenses_filter_filterCategoryType') ?? localStorage.getItem('expenses_filter_filterCategoryType');
      if (filterCategoryType && savedCategoryType) filterCategoryType.value = savedCategoryType;

      const savedBank = (window as any).CompanyStorage?.getItem('expenses_filter_filterBank') ?? localStorage.getItem('expenses_filter_filterBank');
      if (filterBank && savedBank) filterBank.value = savedBank;

      updatePaymentMethodOptions();
    } catch (e) {
      console.error('Falha ao carregar categorias ou bancos', e);
    }
  }

  async function fetchExpenses(): Promise<void> {
    try {
      const res = await api('/finance/expenses');
      expensesData = res.data || [];
      applyFilters();
    } catch (e) {
      console.error('Falha ao carregar despesas', e);
      UI.showAlert('alertMessage', 'Erro ao listar despesas', 'error');
    }
  }

  function applyFilters(): void {
    const period = getInputValue('filterPeriod');
    const startDate = getInputValue('filterStartDate');
    const endDate = getInputValue('filterEndDate');
    const paymentMethod = getInputValue('filterPaymentMethod');
    const status = getInputValue('filterStatus');
    const bank = getInputValue('filterBank');
    const category = getInputValue('filterCategory');
    const categoryType = getInputValue('filterCategoryType');

    // Persist filter values
    const setScoped = (k: string, v: string) => {
      if ((window as any).CompanyStorage) {
        (window as any).CompanyStorage.setItem(k, v);
      } else {
        localStorage.setItem(k, v);
      }
    };
    setScoped('expenses_filter_filterPeriod', period);
    setScoped('expenses_filter_filterStartDate', startDate);
    setScoped('expenses_filter_filterEndDate', endDate);
    setScoped('expenses_filter_filterPaymentMethod', paymentMethod);
    setScoped('expenses_filter_filterStatus', status);
    setScoped('expenses_filter_filterBank', bank);
    setScoped('expenses_filter_filterCategory', category);
    setScoped('expenses_filter_filterCategoryType', categoryType);

    const filtered = expensesData.filter((expense) => {
      let match = true;

      if (startDate && DateUtils.compareDateOnly(expense.date, startDate) < 0) match = false;
      if (endDate && DateUtils.compareDateOnly(expense.date, endDate) > 0) match = false;
      if (paymentMethod && expense.payment_method !== paymentMethod) match = false;
      if (bank && expense.bank_account_public_id !== bank) match = false;
      if (category && expense.category_public_id !== category) match = false;

      if (categoryType) {
        const catObj = categoriesData.find(c => c.public_id === expense.category_public_id);
        const expenseCategoryTypePublicId = catObj ? (catObj as any).finance_category_type_public_id : null;
        if (expenseCategoryTypePublicId !== categoryType) match = false;
      }

      if (status) {
        const isOverdue = expense.status !== 'paid' && DateUtils.isBeforeToday(expense.date);
        if (status === 'paid' && expense.status !== 'paid') match = false;
        if (status === 'pending' && expense.status === 'paid') match = false;
        if (status === 'pending' && !isOverdue && expense.status !== 'pending') match = false;
      }

      return match;
    });

    if (!_tablePager) {
      _tablePager = new Paginator({
        containerId: 'expensesPaginationContainer',
        pageSize: 20,
        onChange: (pageItems: Expense[]) => {
          renderTable(pageItems);
        },
      });
    }

    if (!_gridPager) {
      _gridPager = new Paginator({
        containerId: 'expensesGridPaginationContainer',
        pageSize: 20,
        onChange: (pageItems: Expense[]) => {
          renderGrid('expensesGridContainer', pageItems);
        },
      });
    }

    _tablePager.setData(filtered);
    _gridPager.setData(filtered);
    updateFooter(filtered);
  }

  function updateFooter(data: Expense[] = []): void {
    const countEl = document.getElementById('footerCount');
    const totalEl = document.getElementById('footerTotal');
    if (!countEl || !totalEl) return;

    const count = data.length;
    const total = data.reduce((sum, expense) => sum + (parseFloat(String(expense.amount)) || 0), 0);

    countEl.textContent = String(count);
    totalEl.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function renderTable(items: Expense[] = expensesData): void {
    const tbody = document.getElementById('expensesTable');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `<tr>
            <td colspan="11" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhuma despesa no momento.</td>
         </tr>`;
      return;
    }

    tbody.innerHTML =
      items
        .map((e) => {
          const isOverdue = e.status !== 'paid' && DateUtils.isBeforeToday(e.date);
          const solidconBtnHtml = (e.status === 'paid' || (e as any).solidcon_key || (e as any).solidcon_quitado) ? `
            <button type="button" class="btn-solidcon-details p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors cursor-pointer" data-id="${e.public_id}" title="Auditoria Solidcon">
                <svg class="w-4 h-4 inline pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
            </button>
          ` : '';

          let statusBadge = '';
          if (e.status === 'paid') {
            statusBadge =
              `<div class="inline-flex items-center gap-1.5"><span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-green-800 bg-green-100 dark:bg-green-900/40 dark:text-green-300 whitespace-nowrap">Pago</span>${solidconBtnHtml}</div>`;
          } else if (e.status === 'scheduled') {
            statusBadge =
              '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-indigo-800 bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 whitespace-nowrap">Agendado</span>';
          } else if (isOverdue) {
            statusBadge =
              '<span class="badge-overdue inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-red-800 bg-red-100 dark:bg-red-900/40 dark:text-red-300 whitespace-nowrap">Venc.</span>';
          } else {
            statusBadge =
              '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-yellow-800 bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-300 whitespace-nowrap">Pend.</span>';
          }

          const entityLabel = e.entity_name
            ? `<div class="text-xs text-gray-500 dark:text-gray-400 font-normal mt-0.5 flex items-center gap-1">
                <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                ${e.entity_name}
               </div>`
            : '';

          let paymentMethodHtml = '';
          if (e.payment_method) {
            if (e.payment_method === 'pix') {
              paymentMethodHtml = '<span class="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-600 dark:text-brand-400"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M11.517 0a.725.725 0 0 0-.517.213L.213 11A.725.725 0 0 0 0 11.517a.725.725 0 0 0 .213.517L11 22.82c.137.138.32.214.517.214s.38-.076.517-.214l10.787-10.787a.725.725 0 0 0 .214-.517.725.725 0 0 0-.214-.517L12.034.213A.725.725 0 0 0 11.517 0zm.012 3.66a2.6 2.6 0 0 1 1.838.761 2.6 2.6 0 0 1 0 3.676 2.6 2.6 0 0 1-3.676 0 2.6 2.6 0 0 1 0-3.676 2.593 2.593 0 0 1 1.838-.761zm7.98 7.844-7.98 7.98-7.98-7.98 7.98-7.98 7.98 7.98z"/></svg> PIX</span>';
            } else if (e.payment_method === 'credit') {
              paymentMethodHtml = '<span class="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg> Crédito</span>';
            } else if (e.payment_method === 'debit') {
              paymentMethodHtml = '<span class="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg> Débito</span>';
            } else if (e.payment_method === 'cash') {
              paymentMethodHtml = '<span class="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Dinheiro</span>';
            } else if (e.payment_method === 'transfer') {
              paymentMethodHtml = '<span class="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg> Transferência</span>';
            } else if (e.payment_method === 'boleto') {
              paymentMethodHtml = '<span class="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v1a3 3 0 106 0v-1M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Boleto</span>';
            } else {
              paymentMethodHtml = `<span class="text-[10px] text-gray-500 dark:text-gray-400">${e.payment_method}</span>`;
            }
          } else {
            paymentMethodHtml = '<span class="text-[10px] text-gray-400 dark:text-gray-600">-</span>';
          }

          const hasAPIAutoPay = e.status !== 'paid' && (e.barcode || e.pix_code || e.pix_key);

          const catObj = categoriesData.find(c => c.public_id === e.category_public_id);
          const catTypeName = (e as any).finance_category_type_name || (catObj ? (catObj as any).finance_category_type_name : null) || 'Sem Tipo';

          return `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
            <td class="px-3 py-3 whitespace-nowrap">
                <input type="checkbox" class="item-checkbox h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 dark:border-slate-600 rounded cursor-pointer" value="${
                  e.public_id
                }" title="Selecionar despesa" aria-label="Selecionar despesa">
            </td>
            <td class="px-2 py-3 whitespace-nowrap text-xs font-medium text-gray-500 dark:text-gray-400 font-mono hidden sm:table-cell">#${String(
              e.id
            ).padStart(4, '0')}</td>
            <td class="px-2 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                <div>${e.description}</div>
                ${entityLabel}
            </td>
            <td class="px-3 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">${
              e.category_name || 'Geral'
            }</td>
            <td class="px-2 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">${catTypeName}</td>
            <td class="px-2 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">${DateUtils.formatDateTime(
              e.created_at
            )}</td>
            <td class="px-2 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">${DateUtils.formatDate(
              e.date
            )}</td>
            <td class="px-3 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                <div class="flex flex-col">
                    <span class="font-medium text-gray-900 dark:text-gray-100">${e.bank_account_name || '-'}</span>
                    <div class="mt-0.5">${paymentMethodHtml}</div>
                </div>
            </td>
            <td class="px-2 py-3 whitespace-nowrap text-left text-sm font-medium">
                <div class="flex items-center gap-1">
                    ${statusBadge}
                </div>
            </td>
            <td class="px-2 py-3 whitespace-nowrap text-right text-sm font-medium text-red-600 dark:text-red-400">- ${formatCurrency(
              e.amount
            )}</td>
            <td class="px-2 py-3 whitespace-nowrap text-center text-sm font-medium">
                <div class="flex items-center justify-center space-x-3">
                    ${
                      hasAPIAutoPay
                        ? `<button type="button" class="pay-btn text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors" data-id="${
                            e.public_id
                          }" title="Pagar usando API do Banco">
                            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                            </svg>
                           </button>`
                        : ''
                    }
                    <button type="button" class="edit-btn text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 transition-colors" data-id="${
                      e.public_id
                    }" title="Editar">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button type="button" class="duplicate-btn text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors" data-id="${
                      e.public_id
                    }" title="Duplicar">
                        <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </button>
                    ${
                      e.status !== 'paid'
                        ? `<button type="button" class="delete-btn text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors" data-id="${
                            e.public_id
                          }" title="Excluir">
                            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>`
                        : ''
                    }
                </div>
            </td>
        </tr>
    `;
        })
        .join('');

    const selectAllBtn = document.getElementById('selectAllCheckbox') as HTMLInputElement | null;
    if (selectAllBtn) {
      selectAllBtn.onchange = (e: Event) => {
        const target = e.target as HTMLInputElement | null;
        const checked = !!target?.checked;
        document.querySelectorAll<HTMLInputElement>('#expensesTable .item-checkbox').forEach((cb) => {
          cb.checked = checked;
        });
      };
    }

    document.querySelectorAll<HTMLInputElement>('#expensesTable .item-checkbox').forEach((cb) => {
      cb.addEventListener('change', () => {
        if (!cb.checked && selectAllBtn) {
          selectAllBtn.checked = false;
        }
      });
    });
  }

  function renderGrid(elementId: string, items: Expense[]): void {
    const grid = document.getElementById(elementId);
    if (!grid) return;

    if (items.length === 0) {
      grid.innerHTML =
        '<div class="col-span-full py-8 text-center text-gray-500 font-medium bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">Nenhuma despesa no momento.</div>';
      return;
    }

    grid.innerHTML =
      items
        .map((e) => {
          const isOverdue = e.status !== 'paid' && DateUtils.isBeforeToday(e.date);
          const solidconBtnHtml = (e.status === 'paid' || (e as any).solidcon_key || (e as any).solidcon_quitado) ? `
            <button type="button" class="btn-solidcon-details p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors cursor-pointer" data-id="${e.public_id}" title="Auditoria Solidcon">
                <svg class="w-4 h-4 inline pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
            </button>
          ` : '';

          let statusBadge = '';
          if (e.status === 'paid') {
            statusBadge =
              `<div class="inline-flex items-center gap-1.5"><span class="px-2 inline-flex items-center text-xs leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">Pago</span>${solidconBtnHtml}</div>`;
          } else if (isOverdue) {
            statusBadge =
              '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">Vencido</span>';
          } else {
            statusBadge =
              '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">Pendente</span>';
          }

          const entityLabel = e.entity_name
            ? `<div class="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                ${e.entity_name}
               </div>`
            : '';

          return `
        <div class="bg-white dark:bg-slate-800 shadow-sm rounded-xl p-5 flex flex-col relative border border-gray-100 dark:border-slate-700 group">
            
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center z-10 pt-1">
                    <input type="checkbox" value="${e.public_id}" class="item-checkbox rounded border-gray-300 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800 dark:border-slate-600">
                    <span class="ml-2 text-xs font-mono font-medium text-gray-500 dark:text-gray-400">#${String(e.id).padStart(4, '0')}</span>
                </div>

                <div class="flex space-x-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10 -mr-1 -mt-1">
                    <button type="button" class="edit-btn p-1.5 text-gray-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-900/30 rounded-lg transition-colors" data-id="${e.public_id}" title="Editar">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button type="button" class="duplicate-btn p-1.5 text-gray-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-900/30 rounded-lg transition-colors" data-id="${e.public_id}" title="Duplicar">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </button>
                    ${
                      e.status !== 'paid'
                        ? `<button type="button" class="delete-btn p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors" data-id="${e.public_id}" title="Excluir">
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>`
                        : ''
                    }
                </div>
            </div>
            
            <div class="flex-1 mt-0">
                <div class="flex justify-between items-start gap-2">
                    <h4 class="text-base font-bold text-gray-900 dark:text-gray-100 wrap-break-word flex-1 leading-tight pr-2">${e.description}</h4>
                </div>
                
                <div class="mt-2 flex flex-col gap-1 items-start">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        ${e.category_name || 'Geral'}
                    </span>
                    <div class="mt-1">${statusBadge}</div>
                    ${entityLabel}
                </div>

                <div class="mt-4 grid grid-cols-2 gap-4">
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Data:</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100">${DateUtils.formatDate(e.date)}</span>
                    </div>
                    <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Valor:</span>
                        <span class="font-medium text-red-600 dark:text-red-400">- ${formatCurrency(e.amount)}</span>
                    </div>
                     <div class="flex flex-col text-sm text-gray-600 dark:text-gray-300 col-span-2">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Conta:</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100">${e.bank_account_name || '-'}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
        })
        .join('');
  }

  function setupTabs(): void {
    const tabs = document.querySelectorAll('.expense-modal-tab');
    const panels = document.querySelectorAll('.expense-modal-tab-panel');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.getAttribute('data-expense-tab-target');
        if (!targetId) return;

        tabs.forEach(t => {
          t.setAttribute('aria-selected', 'false');
          t.classList.remove('border-brand-500', 'text-brand-600', 'dark:text-brand-300');
          t.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400', 'hover:text-gray-700', 'dark:hover:text-gray-300');
        });

        tab.setAttribute('aria-selected', 'true');
        tab.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400', 'hover:text-gray-700', 'dark:hover:text-gray-300');
        tab.classList.add('border-brand-500', 'text-brand-600', 'dark:text-brand-300');

        panels.forEach(p => {
          if (p.id === targetId) {
            p.classList.remove('hidden');
          } else {
            p.classList.add('hidden');
          }
        });
      });
    });
  }

  function resetTabs(): void {
    const tabs = document.querySelectorAll('.expense-modal-tab');
    const panels = document.querySelectorAll('.expense-modal-tab-panel');

    tabs.forEach((tab, index) => {
      if (index === 0) {
        tab.setAttribute('aria-selected', 'true');
        tab.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400', 'hover:text-gray-700', 'dark:hover:text-gray-300');
        tab.classList.add('border-brand-500', 'text-brand-600', 'dark:text-brand-300');
      } else {
        tab.setAttribute('aria-selected', 'false');
        tab.classList.remove('border-brand-500', 'text-brand-600', 'dark:text-brand-300');
        tab.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400', 'hover:text-gray-700', 'dark:hover:text-gray-300');
      }
    });

    panels.forEach((panel, index) => {
      if (index === 0) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });
  }

  function addMonthsToDateString(dateStr: string, monthsToAdd: number): string {
    if (!dateStr || monthsToAdd === 0) return dateStr;
    const isIsoWithTime = dateStr.includes('T');
    const datePart = isIsoWithTime ? dateStr.split('T')[0] : dateStr;
    const timePart = isIsoWithTime ? dateStr.split('T')[1] : '';

    const parts = datePart.split('-');
    if (parts.length < 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const targetDate = new Date(year, month + monthsToAdd, 1);
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();

    const maxDaysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const targetDay = Math.min(day, maxDaysInTargetMonth);

    const finalYear = targetYear;
    const finalMonth = String(targetMonth + 1).padStart(2, '0');
    const finalDay = String(targetDay).padStart(2, '0');

    const resultDate = `${finalYear}-${finalMonth}-${finalDay}`;
    return isIsoWithTime ? `${resultDate}T${timePart}` : resultDate;
  }

  function openModal(): void {
    g_editId = null;

    resetTabs();
    (document.getElementById('expenseForm') as HTMLFormElement | null)?.reset();
    setCurrencyValue('value', 0);
    setInputValue('dueDate', DateUtils.getTodayDateInputValue());
    setInputValue('installments', '1');

    const installmentsContainer = document.getElementById('installmentsContainer');
    if (installmentsContainer) installmentsContainer.classList.remove('hidden');

    const statusEl = document.getElementById('status') as HTMLSelectElement | null;
    if (statusEl) statusEl.value = 'pending';

    setInputValue('entityType', '');
    handleEntityTypeChange();
    updatePaymentMethodOptions();

    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = 'Nova Despesa';

    document.getElementById('expenseModal')?.classList.remove('hidden');
  }

  function duplicateExpense(id: string): void {
    const exp = expensesData.find((e) => e.public_id === id);
    if (!exp) return;

    resetTabs();
    (document.getElementById('expenseForm') as HTMLFormElement | null)?.reset();

    setInputValue('description', exp.description + ' (Cópia)');
    setCurrencyValue('value', exp.amount);
    setInputValue('installments', '1');

    const installmentsContainer = document.getElementById('installmentsContainer');
    if (installmentsContainer) installmentsContainer.classList.remove('hidden');

    setInputValue('dueDate', DateUtils.toDateInputValue(exp.date));

    setInputValue('category', String(exp.category_public_id || ''));
    setInputValue('bankSelect', String(exp.bank_account_public_id || ''));
    setInputValue('costCenter', String(exp.cost_center_public_id || ''));
    updatePaymentMethodOptions();

    const paymentEl = document.getElementById('paymentMethod') as HTMLSelectElement | null;
    if (paymentEl) paymentEl.value = exp.payment_method || '';

    const statusEl = document.getElementById('status') as HTMLSelectElement | null;
    if (statusEl) statusEl.value = exp.status || 'paid';

    if (exp.entity_type && exp.entity_public_id) {
      setInputValue('entityType', exp.entity_type);
      handleEntityTypeChange(exp.entity_public_id);
    } else {
      setInputValue('entityType', '');
      handleEntityTypeChange();
    }

    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = 'Duplicar Despesa';

    document.getElementById('expenseModal')?.classList.remove('hidden');
  }

  function editExpense(id: string): void {
    const exp = expensesData.find((e) => e.public_id === id);
    if (!exp) return;

    g_editId = id;

    resetTabs();
    (document.getElementById('expenseForm') as HTMLFormElement | null)?.reset();
    setInputValue('description', exp.description);
    setCurrencyValue('value', exp.amount);
    setInputValue('installments', '1');

    const installmentsContainer = document.getElementById('installmentsContainer');
    if (installmentsContainer) installmentsContainer.classList.add('hidden');

    setInputValue('dueDate', DateUtils.toDateInputValue(exp.date));

    setInputValue('category', String(exp.category_public_id || ''));
    setInputValue('bankSelect', String(exp.bank_account_public_id || ''));
    setInputValue('costCenter', String(exp.cost_center_public_id || ''));
    updatePaymentMethodOptions();

    const paymentEl = document.getElementById('paymentMethod') as HTMLSelectElement | null;
    if (paymentEl) paymentEl.value = exp.payment_method || '';

    const statusEl = document.getElementById('status') as HTMLSelectElement | null;
    if (statusEl) statusEl.value = exp.status || 'paid';

    if (exp.entity_type && exp.entity_public_id) {
      setInputValue('entityType', exp.entity_type);
      handleEntityTypeChange(exp.entity_public_id);
    } else {
      setInputValue('entityType', '');
      handleEntityTypeChange();
    }

    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = 'Editar Despesa';

    document.getElementById('expenseModal')?.classList.remove('hidden');
  }

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const solidconBtn = target.closest('.btn-solidcon-details');
    if (solidconBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = solidconBtn.getAttribute('data-id');
      if (id) openSolidconExpenseDetailsModal(id);
      return;
    }

    const duplicateBtn = target.closest('.duplicate-btn');
    if (duplicateBtn) {
      const id = duplicateBtn.getAttribute('data-id');
      if (id) (window as any).duplicateExpense(id);
    }

    const editBtn = target.closest('.edit-btn');
    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      if (id) (window as any).editExpense(id);
    }

    const deleteBtn = target.closest('.delete-btn');
    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      if (id) (window as any).confirmDeleteExpense(id);
    }
  });

  function closeModal(): void {
    g_editId = null;
    resetTabs();
    document.getElementById('expenseModal')?.classList.add('hidden');
  }

  async function handleSaveExpense(e: Event): Promise<void> {
    e.preventDefault();

    const rawValue = getInputValue('value');
    const amountVal = parseFloat(rawValue.replace(/[^\d]/g, '')) / 100;

    if (!amountVal || amountVal <= 0) {
      UI.showAlert('alertMessage', 'Informe um valor maior que zero.', 'error');
      return;
    }

    const data: AnyRecord = {
      description: getInputValue('description'),
      amount: amountVal,
      date: getInputValue('dueDate'),
      category_public_id: getInputValue('category'),
      bank_account_public_id: getInputValue('bankSelect'),
      cost_center_public_id: getInputValue('costCenter') || null,
    };

    data.payment_method = getInputValue('paymentMethod') || null;

    const status = getInputValue('status');
    if (status) data.status = status;

    const entityType = getInputValue('entityType');
    const entityPublicId = getInputValue('entitySelect');
    if (entityType && entityPublicId) {
      data.entity_type = entityType;
      data.entity_public_id = entityPublicId;
    } else {
      data.entity_type = null;
      data.entity_public_id = null;
    }

    const installmentsInput = document.getElementById('installments') as HTMLInputElement | null;
    const installmentsCount = (!g_editId && installmentsInput) ? Math.max(1, parseInt(installmentsInput.value, 10) || 1) : 1;

    const btn = document.getElementById('saveBtn') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Processando...';
    }

    try {
      if (g_editId) {
        await api(`/finance/expenses/${g_editId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        UI.showAlert('alertMessage', 'Despesa atualizada com sucesso!', 'success');
      } else if (installmentsCount >= 2) {
        const baseDescription = (data.description || '')
          .replace(/\s*\(\s*(?:parcela\s*)?\d+\s*\/\s*\d+\s*\)\s*$/i, '')
          .trim();
        const baseDueDate = data.date;

        for (let i = 1; i <= installmentsCount; i++) {
          const installmentData = {
            ...data,
            description: `${baseDescription} (${i}/${installmentsCount})`,
            date: addMonthsToDateString(baseDueDate, i - 1),
          };

          await api('/finance/expenses', {
            method: 'POST',
            body: JSON.stringify(installmentData),
          });
        }
        UI.showAlert('alertMessage', `${installmentsCount} parcelas registradas com sucesso!`, 'success');
      } else {
        await api('/finance/expenses', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        UI.showAlert('alertMessage', 'Despesa registrada com sucesso!', 'success');
      }

      closeModal();
      await fetchExpenses();
      await loadDependencies(); // atualiza saldos
    } catch (err: any) {
      alert(err?.message || 'Erro ao salvar despesa');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Salvar';
      }
    }
  }

  // Global scope required for html onclick handlers
  let g_deleteId: string | null = null;

  function confirmDeleteExpense(id: string): void {
    const expense = expensesData.find((e) => e.public_id === id);
    if (expense && expense.status === 'paid') {
      UI.showAlert('alertMessage', 'Não é permitido excluir uma despesa que já foi baixada/paga.', 'error');
      return;
    }
    g_deleteId = id;
    document.getElementById('deleteModal')?.classList.remove('hidden');
  }

  function closeDeleteModal(): void {
    g_deleteId = null;
    document.getElementById('deleteModal')?.classList.add('hidden');
  }

  (window as any).duplicateExpense = duplicateExpense;
  (window as any).editExpense = editExpense;
  (window as any).confirmDeleteExpense = confirmDeleteExpense;
  (window as any).closeDeleteModal = closeDeleteModal;

  document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
    if (!g_deleteId) return;

    const btn = document.getElementById('confirmDeleteBtn') as HTMLButtonElement | null;
    const originalHtml = btn?.innerHTML || 'Sim, Excluir';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Excluindo...';
    }

    try {
      await api(`/finance/transactions/${g_deleteId}`, {
        method: 'DELETE',
      });
      closeDeleteModal();
      UI.showAlert('alertMessage', 'Despesa excluída com sucesso!', 'success');
      await fetchExpenses();
      await loadDependencies(); // Atualiza contador de bancos no topo
    } catch (err: any) {
      alert(err?.message || 'Erro ao excluir despesa');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    }
  });

  document.getElementById('btnCancelDeleteModal')?.addEventListener('click', closeDeleteModal);
  document.getElementById('closeDeleteModalBackdrop')?.addEventListener('click', closeDeleteModal);

  // ── SOLIDCON EXPENSE AUDIT MODAL LOGIC ─────────────────────────────────
  let g_currentSolidconExpenseId: string | null = null;

  async function openSolidconExpenseDetailsModal(expenseId: string) {
    g_currentSolidconExpenseId = expenseId;
    const modal = document.getElementById('solidconExpenseDetailsModal');
    if (!modal) return;

    // Reset para estado de carregamento
    const badge = document.getElementById('solidconExpenseModalBadge');
    if (badge) {
      badge.textContent = 'Carregando...';
      badge.className = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    }

    const alertBox = document.getElementById('solidconExpenseAlertBox');
    if (alertBox) alertBox.className = 'hidden p-4 rounded-xl border';

    const btnFix = document.getElementById('btnFixSolidconExpenseDuplicates');
    if (btnFix) {
      btnFix.classList.add('hidden');
      btnFix.style.display = 'none';
    }

    ['scExpIdConta', 'scExpParcelaIds', 'scExpBaixaIds', 'scExpMovimentoIds', 'scExpDocInfo', 'scExpFornecedorInfo'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '...';
    });
    ['scExpContaStatus', 'scExpParcelaValores', 'scExpBaixaValores', 'scExpMovimentoConta', 'scExpFilialInfo', 'scExpFornecedorDoc'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '...';
    });

    const tbody = document.getElementById('scExpensePaymentsTableBody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-3 py-4 text-center text-gray-400 font-sans">Carregando dados das tabelas Solidcon...</td></tr>';
    }

    const logBox = document.getElementById('solidconExpenseLogDetails') as HTMLTextAreaElement | null;
    if (logBox) logBox.value = `[${new Date().toLocaleTimeString('pt-BR')}] Consultando banco de dados Solidcon para a despesa ID ${expenseId}...`;

    modal.classList.remove('hidden');

    try {
      const response = await api(`/finance/expenses/${expenseId}/solidcon-details`);
      const data = response?.data;
      if (!data) throw new Error('Não foi possível carregar os detalhes do Solidcon.');

      renderSolidconExpenseInspectionDetails(data);
    } catch (err: any) {
      if (logBox) logBox.value += `\n[ERRO] ${err.message || 'Falha ao consultar detalhes.'}`;
      if (badge) {
        badge.textContent = 'Erro';
        badge.className = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
      }
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" class="px-3 py-4 text-center text-red-500 font-sans">${err.message || 'Erro ao carregar detalhes.'}</td></tr>`;
      }
    }
  }

  function renderSolidconExpenseInspectionDetails(data: any) {
    const exp = data.expense || data.transaction || data.solidcon?.expense || {};
    const tableIds = data.tableIds || data.solidcon?.tableIds || {};
    const conta = data.conta || data.solidcon?.conta || null;
    const contaParcelas = data.contaParcelas || data.solidcon?.contaParcelas || [];
    const contaBaixas = data.contaBaixas || data.solidcon?.contaBaixas || [];
    const bankMovements = data.bankMovements || data.movements || data.solidcon?.movements || [];
    const dup = data.duplicateAnalysis || data.solidcon?.duplicateAnalysis || { 
      hasDuplicates: Boolean(data.hasDuplicates || data.solidcon?.hasDuplicates), 
      duplicateBaixaCount: Math.max(0, contaBaixas.length - 1), 
      duplicateMovementCount: Math.max(0, bankMovements.length - 1), 
      reasons: data.duplicateReasons || data.solidcon?.duplicateReasons || [] 
    };

    const fmtMoeda = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const fmtDate = (d: any) => {
      if (!d) return 'N/A';
      try {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return String(d);
        return dt.toLocaleDateString('pt-BR');
      } catch {
        return String(d);
      }
    };

    // Badge
    const badge = document.getElementById('solidconExpenseModalBadge');
    if (badge) {
      const docNr = exp.documento || tableIds.tbConta || exp.solidcon_key || 'N/A';
      badge.textContent = `Doc #${docNr} | Filial: ${exp.cdfilial || '1'}`;
      badge.className = dup.hasDuplicates 
        ? 'inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
        : 'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    }

    // Alert Box
    const alertBox = document.getElementById('solidconExpenseAlertBox');
    const alertIcon = document.getElementById('solidconExpenseAlertIcon');
    const alertTitle = document.getElementById('solidconExpenseAlertTitle');
    const alertDesc = document.getElementById('solidconExpenseAlertDesc');
    const btnFix = document.getElementById('btnFixSolidconExpenseDuplicates');

    if (alertBox && alertTitle && alertDesc) {
      alertBox.classList.remove('hidden');
      if (contaBaixas.length === 0 && !conta) {
        alertBox.className = 'p-4 rounded-xl border bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200';
        if (alertIcon) {
          alertIcon.innerHTML = `<svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
        }
        alertTitle.textContent = 'Despesa não encontrada no Solidcon';
        alertDesc.textContent = 'Não foram localizados registros em tbConta ou tbContaBaixa com o número do documento ou código informado.';
        if (btnFix) {
          btnFix.classList.add('hidden');
          btnFix.style.display = 'none';
        }
      } else if (dup.hasDuplicates) {
        alertBox.className = 'p-4 rounded-xl border bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200';
        if (alertIcon) {
          alertIcon.innerHTML = `<svg class="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
        }
        alertTitle.textContent = 'Atenção: Duplicidade Detectada no Solidcon';
        alertDesc.textContent = (dup.reasons && dup.reasons.length) ? dup.reasons.join(' | ') : `${dup.duplicateBaixaCount || 1} baixa(s) duplicada(s) encontrada(s).`;
        if (btnFix) {
          btnFix.classList.remove('hidden');
          btnFix.style.display = 'inline-flex';
        }
      } else if (contaBaixas.length > 1) {
        alertBox.className = 'p-4 rounded-xl border bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200';
        if (alertIcon) {
          alertIcon.innerHTML = `<svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`;
        }
        alertTitle.textContent = `Despesa Paga em Parcelas (${contaBaixas.length} baixas)`;
        alertDesc.textContent = `Esta despesa foi liquidada através de ${contaBaixas.length} baixas parciais legítimas. Todas as tabelas estão perfeitamente sincronizadas e consistentes.`;
        if (btnFix) {
          btnFix.classList.add('hidden');
          btnFix.style.display = 'none';
        }
      } else {
        alertBox.className = 'p-4 rounded-xl border bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200';
        if (alertIcon) {
          alertIcon.innerHTML = `<svg class="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
        }
        alertTitle.textContent = 'Lançamento Consistente e Amarrado no Solidcon';
        alertDesc.textContent = 'Não foram encontradas duplicidades. As tabelas de tbConta, tbContaParcela, tbContaBaixa e tbBancoContaMovimento estão perfeitamente amarradas e integradas.';
        if (btnFix) {
          btnFix.classList.add('hidden');
          btnFix.style.display = 'none';
        }
      }
    }

    // IDs summary cards
    const setEl = (id: string, text: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setEl('scExpIdConta', tableIds.tbConta ? `#${tableIds.tbConta}` : 'N/A');
    setEl('scExpContaStatus', conta ? `Total: ${fmtMoeda(conta.vlTotal || conta.vlConta || conta.vlTotalCalculado || 0)}` : 'Sem tbConta');

    setEl('scExpParcelaIds', tableIds.tbContaParcela?.length ? tableIds.tbContaParcela.map((id: any) => `#${id}`).join(', ') : 'Nenhuma');
    setEl('scExpParcelaValores', contaParcelas.length ? `${contaParcelas.length} parcela(s)` : 'Sem parcelas');

    const totalBaixas = contaBaixas.reduce((s: number, b: any) => s + (Number(b.vlContaBaixa) || 0), 0);
    setEl('scExpBaixaIds', tableIds.tbContaBaixa?.length ? tableIds.tbContaBaixa.map((id: any) => `#${id}`).join(', ') : 'Nenhuma');
    setEl('scExpBaixaValores', contaBaixas.length ? `Total Pago: ${fmtMoeda(totalBaixas)}` : 'Sem baixas');

    setEl('scExpMovimentoIds', tableIds.tbBancoContaMovimento?.length ? tableIds.tbBancoContaMovimento.map((id: any) => `#${id}`).join(', ') : 'Nenhum');
    setEl('scExpMovimentoConta', bankMovements.length ? `${bankMovements.length} movimento(s) bancário(s)` : 'Sem movimentos');

    setEl('scExpDocInfo', `Documento: ${exp.documento || '-'}`);
    setEl('scExpFilialInfo', `Filial Solidcon: ${exp.cdfilial || '1'}`);

    setEl('scExpFornecedorInfo', exp.entity_name || exp.supplier_name || 'Sem fornecedor');
    setEl('scExpFornecedorDoc', exp.entity_cnpj_cpf || exp.supplier_cnpj_cpf ? `CNPJ/CPF: ${exp.entity_cnpj_cpf || exp.supplier_cnpj_cpf}` : 'CNPJ/CPF: N/A');

    // Baixas / Parcelas table
    const tbody = document.getElementById('scExpensePaymentsTableBody');
    if (tbody) {
      if (contaBaixas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-3 py-4 text-center text-gray-400 font-sans">Nenhum registro de baixa encontrado em tbContaBaixa.</td></tr>';
      } else {
        tbody.innerHTML = contaBaixas.map((b: any, idx: number) => {
          const isDuplicate = idx > 0 && dup.hasDuplicates;
          const dtFormatted = b.dtContaBaixa ? new Date(b.dtContaBaixa).toLocaleString('pt-BR') : '-';
          const statusBadge = isDuplicate
            ? '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">DUPLICADO</span>'
            : (contaBaixas.length > 1
                ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">PARCELA #${idx + 1}</span>`
                : '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">PRINCIPAL</span>');

          const parc = contaParcelas.find((p: any) => p.cdContaBaixa === b.cdContaBaixa);

          return `
          <tr class="${isDuplicate ? 'bg-red-50/50 dark:bg-red-950/20' : 'hover:bg-gray-50/50 dark:hover:bg-slate-700/30'}">
              <td class="px-3 py-2 text-left font-bold text-gray-900 dark:text-gray-100">#${b.cdContaBaixa || (idx + 1)}</td>
              <td class="px-3 py-2 text-right font-bold ${isDuplicate ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}">${fmtMoeda(b.vlContaBaixa)}</td>
              <td class="px-3 py-2 text-left text-gray-600 dark:text-gray-300">${dtFormatted}</td>
              <td class="px-3 py-2 text-left text-gray-600 dark:text-gray-300">${b.cdBancoConta || '-'} (${b.nmBancoConta || 'Conta'})</td>
              <td class="px-3 py-2 text-left text-gray-600 dark:text-gray-300">${b.cdBancoContaMovimento ? `#${b.cdBancoContaMovimento}` : '-'}</td>
              <td class="px-3 py-2 text-left text-gray-600 dark:text-gray-300 truncate max-w-xs" title="${b.Historico || ''}">${parc ? `Parc #${parc.cdContaParcela}` : '-'} ${b.Historico ? `| ${b.Historico}` : ''}</td>
              <td class="px-3 py-2 text-center">${statusBadge}</td>
          </tr>
          `;
        }).join('');
      }
    }

    // Monospace Audit Log Box
    const logBox = document.getElementById('solidconExpenseLogDetails') as HTMLTextAreaElement | null;
    if (logBox) {
      const lines = [
        `======================================================================`,
        `RELATÓRIO DE AUDITORIA SOLIDCON (DESPESAS) - ${new Date().toLocaleString('pt-BR')}`,
        `======================================================================`,
        `DESPESA KEYSTONE:`,
        `  • ID: ${exp.public_id || exp.id || 'N/A'}`,
        `  • Descrição: ${exp.description || 'N/A'}`,
        `  • Fornecedor: ${exp.entity_name || exp.supplier_name || 'Sem fornecedor'} (CPF/CNPJ: ${exp.entity_cnpj_cpf || exp.supplier_cnpj_cpf || 'N/A'})`,
        `  • Valor Keystone: ${fmtMoeda(exp.amount)} (Original: ${fmtMoeda(exp.original_amount || exp.amount)})`,
        `  • Status Keystone: ${exp.status || 'N/A'}`,
        `  • Data Vencimento: ${fmtDate(exp.date)} | Data Pagamento: ${fmtDate(exp.received_at)}`,
        `  • Filial Solidcon: ${exp.cdfilial || '1'} | Documento: ${exp.documento || 'N/A'}`,
        ``,
        `IDENTIFICADORES DE CADA TABELA SOLIDCON:`,
        `  [1] tbConta:                   ${tableIds.tbConta ? `#${tableIds.tbConta}` : 'NÃO ENCONTRADO'}`,
        `  [2] tbContaParcela:            ${tableIds.tbContaParcela?.length ? tableIds.tbContaParcela.map((id: any) => `#${id}`).join(', ') : 'NENHUM'}`,
        `  [3] tbContaBaixa:              ${tableIds.tbContaBaixa?.length ? tableIds.tbContaBaixa.map((id: any) => `#${id}`).join(', ') : 'NENHUM'}`,
        `  [4] tbBancoContaMovimento:      ${tableIds.tbBancoContaMovimento?.length ? tableIds.tbBancoContaMovimento.map((id: any) => `#${id}`).join(', ') : 'NENHUM'}`,
        ``,
        `DIAGNÓSTICO E CONSISTÊNCIA:`,
        `  • Status Duplicidade: ${dup.hasDuplicates ? '⚠️ DUPLICIDADE DETECTADA' : '✅ ÍNTEGRO E CONSISTENTE'}`,
        `  • Baixas Registradas: ${contaBaixas.length} linha(s) | Total Baixado Solidcon: ${fmtMoeda(totalBaixas)}`,
        `  • Valor do Título tbConta: ${fmtMoeda(conta?.vlTotalCalculado || conta?.vlTotal || 0)}`,
      ];

      if (dup.reasons?.length) {
        lines.push(`  • Motivos/Alertas:`);
        dup.reasons.forEach((r: string) => lines.push(`     - ${r}`));
      } else {
        lines.push(`  • Motivos/Alertas: Nenhum problema ou inconsistência detectada.`);
      }

      if (contaBaixas.length > 0) {
        lines.push(``);
        lines.push(`HISTÓRICO DE BAIXAS (tbContaBaixa):`);
        contaBaixas.forEach((b: any, idx: number) => {
          lines.push(`  [#${b.cdContaBaixa || (idx+1)}] Valor: ${fmtMoeda(b.vlContaBaixa)} | Data: ${b.dtContaBaixa ? new Date(b.dtContaBaixa).toLocaleDateString('pt-BR') : 'N/A'} | Conta: ${b.cdBancoConta || '-'} | Movimento Banco: #${b.cdBancoContaMovimento || '-'} | Histórico: ${b.Historico || 'Nenhum'}`);
        });
      }

      const serverLogs = data.logLines || data.solidcon?.logLines || [];
      if (serverLogs.length > 0) {
        lines.push(``);
        lines.push(`LOG DE EXECUÇÃO DA CONSULTA SOLIDCON:`);
        serverLogs.forEach((l: string) => lines.push(`  ${l}`));
      }

      lines.push(`======================================================================`);
      logBox.value = lines.join('\n');
    }
  }

  async function handleFixSolidconExpenseDuplicates() {
    if (!g_currentSolidconExpenseId) return;

    const confirmed = confirm('Deseja realmente consolidar os lançamentos e remover as baixas duplicadas no Solidcon?\n\nEsta operação manterá a primeira baixa canônica, excluirá as baixas excedentes em tbContaBaixa e tbBancoContaMovimento, e reajustará o vínculo em tbContaParcela.');
    if (!confirmed) return;

    const btn = document.getElementById('btnFixSolidconExpenseDuplicates') as HTMLButtonElement | null;
    const logBox = document.getElementById('solidconExpenseLogDetails') as HTMLTextAreaElement | null;
    const oldHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="inline-block animate-spin mr-1">↻</span> Corrigindo...';
    }

    if (logBox) {
      logBox.value += `\n\n[${new Date().toLocaleTimeString('pt-BR')}] Iniciando consolidação e remoção de duplicidades no Solidcon...`;
    }

    try {
      const response = await api(`/finance/expenses/${g_currentSolidconExpenseId}/solidcon-fix-duplicates`, {
        method: 'POST'
      });

      const resData = response?.data || {};
      const fixLog = [
        `\n======================================================================`,
        `RESULTADO DA CONSOLIDAÇÃO / CORREÇÃO:`,
        `Data/Hora: ${new Date().toLocaleString('pt-BR')}`,
        `Status: SUCESSO`,
        `Mensagem: ${response?.message || 'Duplicidades corrigidas no Solidcon.'}`,
        `Baixas Excluídas: ${resData.deletedBaixasCount || 0}`,
        `Movimentos Bancários Excluídos: ${resData.deletedMovementsCount || 0}`,
        `======================================================================`
      ].join('\n');

      if (logBox) logBox.value += fixLog;

      UI.showAlert('alertMessage', response?.message || 'Duplicidades corrigidas com sucesso no Solidcon!', 'success');

      // Re-consulta os detalhes para atualizar a tela
      await openSolidconExpenseDetailsModal(g_currentSolidconExpenseId);
      // Atualiza a listagem de despesas em segundo plano
      fetchExpenses();
    } catch (err: any) {
      if (logBox) logBox.value += `\n[ERRO AO CORRIGIR] ${err.message || 'Falha na execução.'}`;
      UI.showAlert('alertMessage', err.message || 'Erro ao corrigir duplicidades no Solidcon.', 'error');
    } finally {
      if (btn) {
        btn.innerHTML = oldHtml;
        btn.disabled = false;
      }
    }
  }

  function closeSolidconExpenseDetailsModal() {
    document.getElementById('solidconExpenseDetailsModal')?.classList.add('hidden');
    g_currentSolidconExpenseId = null;
  }

  // Bind events for solidcon expense details modal
  document.getElementById('btnCloseSolidconExpenseDetailsModal')?.addEventListener('click', closeSolidconExpenseDetailsModal);
  document.getElementById('btnFecharSolidconExpenseDetailsModal')?.addEventListener('click', closeSolidconExpenseDetailsModal);
  document.getElementById('solidconExpenseDetailsModalBackdrop')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('solidconExpenseDetailsModalBackdrop')) {
      closeSolidconExpenseDetailsModal();
    }
  });
  document.getElementById('btnFixSolidconExpenseDuplicates')?.addEventListener('click', handleFixSolidconExpenseDuplicates);

  document.getElementById('btnCopySolidconExpenseLog')?.addEventListener('click', () => {
    const logBox = document.getElementById('solidconExpenseLogDetails') as HTMLTextAreaElement | null;
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

  (window as any).openSolidconExpenseDetailsModal = openSolidconExpenseDetailsModal;
  (window as any).closeSolidconExpenseDetailsModal = closeSolidconExpenseDetailsModal;

  // ── MODAL: Importação e Consulta Solidcon (Despesas) ────────────
  let solidconFetchedPayload: any = null;

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

  const closeSolidconModal = () => {
    document.getElementById('solidconModal')?.classList.add('hidden');
    clearSolidconStatus();
    solidconFetchedPayload = null;
  };

  const clearSolidconStatus = () => {
    const statusEl = document.getElementById('solidconImportStatus');
    const detailsEl = document.getElementById('solidconImportDetails');
    if (statusEl) {
      statusEl.className = 'hidden mt-3 text-sm rounded-md px-3 py-2';
      statusEl.innerHTML = '';
    }
    if (detailsEl) {
      detailsEl.className = 'hidden mt-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-100';
      detailsEl.innerHTML = '';
    }
  };

  const setSolidconStatus = (message: string, type: 'success' | 'error' | 'warning') => {
    const statusEl = document.getElementById('solidconImportStatus');
    if (!statusEl) return;
    clearSolidconStatus();
    let bgClass = '';
    if (type === 'success') bgClass = 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/30';
    else if (type === 'error') bgClass = 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/30';
    else bgClass = 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/30';

    statusEl.className = `mt-3 text-sm rounded-md px-3 py-2 ${bgClass}`;
    statusEl.textContent = message;
  };

  const showSolidconIgnoredDetails = (errors: any[]) => {
    const detailsEl = document.getElementById('solidconImportDetails');
    if (!detailsEl || !errors || !errors.length) return;
    const reasonCounts = errors.reduce((acc: any, item: any) => {
      const reason = item?.reason || 'Motivo não informado.';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});
    const reasonSummary = Object.entries(reasonCounts)
      .map(([reason, count]) => `${count}x ${reason}`)
      .join('<br>');
    const examples = errors.slice(0, 20)
      .map((item: any) => `Item #${Number(item?.index || 0) + 1}: ${item?.reason || 'Motivo não informado.'}`)
      .join('<br>');

    detailsEl.innerHTML = `<div class="font-semibold">Por que foi ignorado</div><div class="mt-1">${reasonSummary}</div><div class="mt-2 font-semibold">Exemplos</div><div class="mt-1">${examples}${errors.length > 20 ? `<br>... mais ${errors.length - 20} item(ns)` : ''}</div>`;
    detailsEl.classList.remove('hidden');
  };

  const getSelectedSolidconUrl = () => {
    const urls = (window as any).currentSolidconUrls || [];
    return urls.find((url: string) => String(url || '').trim()) || '';
  };

  // Event bindings for Solidcon Import Modal
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

      const reqBody: any = { connectionType, startDate: startVal, endDate: endVal, target: 'expenses' };

      if (connectionType === 'api') {
        const url = getSelectedSolidconUrl();
        if (!url) {
          setSolidconStatus('URL Solidcon não configurada. Salve na tela Minha Empresa > API/Solidcon.', 'warning');
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

        const items = Array.isArray(payload) ? payload : (payload?.data || payload?.items || payload?.rows || payload?.expenses || payload?.despesas || []);
        const count = Array.isArray(items) ? items.length : 0;
        setSolidconStatus(`Dados carregados com sucesso (${count} registros). Clique em "Importar" para salvar.`, 'success');
      } catch (err: any) {
        const msg = String(err?.message || '').trim();
        if (
          msg.toLowerCase().includes('fora') ||
          msg.toLowerCase().includes('timeout') ||
          msg.toLowerCase().includes('failed to connect') ||
          msg.toLowerCase().includes('inacessivel') ||
          msg.toLowerCase().includes('inacessível') ||
          msg.toLowerCase().includes('conexão') ||
          msg.toLowerCase().includes('conexao') ||
          msg.toLowerCase().includes('refused') ||
          msg.toLowerCase().includes('network') ||
          msg.toLowerCase().includes('fetch failed')
        ) {
          setSolidconStatus(msg || 'Não foi possível conectar ao banco de dados Solidcon. O servidor está fora do ar ou inacessível no momento.', 'error');
        } else {
          setSolidconStatus(msg || 'Não foi possível conectar ao banco de dados Solidcon. O servidor está fora do ar.', 'error');
        }
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
        const result = await api('/finance/expenses/solidcon-import', {
          method: 'POST',
          body: JSON.stringify({
            payload: solidconFetchedPayload
          })
        });

        const data = result?.data || {};
        const created = data.created ?? 0;
        const updated = data.updated ?? 0;
        const skipped = data.skipped ?? 0;
        const errors = Array.isArray(data.errors) ? data.errors : [];
        const message = `Importação concluída: ${created} novas, ${updated} atualizadas, ${skipped} ignoradas.`;
        setSolidconStatus(message, created || updated ? 'success' : 'warning');
        showSolidconIgnoredDetails(errors);

        // Refresh expenses listing and bank balances
        await fetchExpenses();
        await loadDependencies();
      } catch (err: any) {
        setSolidconStatus(err.message || 'Erro ao importar despesas da Solidcon.', 'error');
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

  (window as any).openSolidconModal = openSolidconModal;
  (window as any).closeSolidconModal = closeSolidconModal;
})();
