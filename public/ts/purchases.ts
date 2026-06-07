(() => {
  type AnyRecord = Record<string, any>;

  let g_products: AnyRecord[] = [];
  let g_suppliers: AnyRecord[] = [];
  let g_banks: AnyRecord[] = [];
  let g_categories: AnyRecord[] = [];
  let g_cart: AnyRecord[] = [];
  let g_purchases: AnyRecord[] = [];

  let currentViewId: string | null = null;

  const FilterPanel: any = (window as any).FilterPanel;
  const DateUtilsRef: any = (window as any).DateUtils || (typeof DateUtils !== 'undefined' ? (DateUtils as any) : null);

  const getEl = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
    document.getElementById(id) as T | null;

  const formatCurrency = (value: any): string =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

  document.addEventListener('DOMContentLoaded', async () => {
    if (!(Auth as any).isAuthenticated()) {
      window.location.href = '/';
      return;
    }

    await loadDependencies();
    initProductSearch();

    // Load User info for the navbar
    (api as any)('/auth/me')
      .then((res: any) => {
        const userGreeting = getEl('userGreeting');
        if (userGreeting && res.data && res.data.user) {
          userGreeting.textContent = `Olá, ${res.data.user.full_name || 'Usuário'}`;
        } else if (userGreeting && res.data) {
          userGreeting.textContent = `Olá, ${res.data.full_name || 'Usuário'}`;
        }
      })
      .catch((err: any) => {
        console.error('Falha ao carregar usuário', err);
      });

    document.title = 'KEYSTONE - Compras';

    // Bind Modal Events (CSP Fix)
    getEl('btnOpenModal')?.addEventListener('click', () => {
      (window as any).openSaleModal();
    });

    getEl('btnCancelModal')?.addEventListener('click', () => {
      (window as any).closeModal();
    });

    const backdrop = getEl('modalBackdrop');
    if (backdrop) {
      backdrop.addEventListener('click', (e: MouseEvent) => {
        if (e.target === backdrop) (window as any).closeModal();
      });
    }

    let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    getEl('filterSearch')?.addEventListener('input', () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
      searchDebounceTimer = setTimeout(() => {
        applyFilters();
        searchDebounceTimer = null;
      }, 180);
    });
    getEl('filterStartDate')?.addEventListener('change', applyFilters);
    getEl('filterEndDate')?.addEventListener('change', applyFilters);

    // Event Delegation: Tabela de Compras
    getEl('purchasesTable')?.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest('button[data-action]') as HTMLButtonElement | null;

      if (btn) {
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        if (!id) return;

        if (action === 'view') {
          (window as any).openViewModal(id);
        } else if (action === 'duplicate') {
          (window as any).duplicatePurchase(id);
        } else if (action === 'cancel_inline') {
          currentViewId = id;
          (window as any).cancelPurchase();
        }
        return;
      }

      const tr = target?.closest('.row-purchase') as HTMLElement | null;
      if (tr) {
        const id = tr.getAttribute('data-id');
        if (id) (window as any).openViewModal(id);
      }
    });

    // Event Delegation: Remover Item do Carrinho
    getEl('cartItems')?.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest('.btn-remove-item') as HTMLElement | null;
      if (btn) {
        const index = parseInt(btn.getAttribute('data-index') || '', 10);
        if (!isNaN(index)) (window as any).removeCartItem(index);
      }
    });

    // View Modal Events
    getEl('backdropViewModal')?.addEventListener('click', (window as any).closeViewModal);
    getEl('btnCloseViewModal')?.addEventListener('click', (window as any).closeViewModal);
    getEl('btnCancelPurchase')?.addEventListener('click', (window as any).cancelPurchase);

    void fetchPurchases();
  });

  async function fetchPurchases(): Promise<void> {
    try {
      const res = await (api as any)('/purchases');
      g_purchases = res.data || [];
      applyFilters();
    } catch (e) {
      console.error(e);
    }
  }

  function applyFilters(): void {
    const search = FilterPanel.normalizeText(getEl<HTMLInputElement>('filterSearch')?.value);
    const startDate = getEl<HTMLInputElement>('filterStartDate')?.value || '';
    const endDate = getEl<HTMLInputElement>('filterEndDate')?.value || '';

    const filtered = g_purchases.filter((item: any) => {
      if (!FilterPanel.matchesSearch(item, ['supplier_name'], search)) {
        return false;
      }

      if (startDate && DateUtilsRef.compareDateOnly(item.date, startDate) < 0) {
        return false;
      }

      if (endDate && DateUtilsRef.compareDateOnly(item.date, endDate) > 0) {
        return false;
      }

      return true;
    });

    renderPurchasesTable(filtered);
  }

  function renderPurchasesTable(purchases: AnyRecord[]): void {
    const tbody = getEl('purchasesTable');
    if (!tbody) return;

    if (!purchases || purchases.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">Nenhuma compra registrada.</td></tr>';
      return;
    }

    tbody.innerHTML = purchases
      .map((p: any) => {
        const isCompleted = p.status === 'completed';
        const badgeColor = isCompleted
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
          : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
        const badgeText = isCompleted ? 'Concluída' : 'Cancelada';

        return `
        <tr class="cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors row-purchase" data-id="${
          p.public_id
        }">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b dark:border-slate-700 dark:text-gray-300">${DateUtilsRef.formatDate(
              p.date
            )}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b dark:border-slate-700 dark:text-gray-300">${
              p.supplier_name
            }</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-b dark:border-slate-700 dark:text-gray-400 text-center">${p.items_count ?? 0}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b dark:border-slate-700 dark:text-gray-300 font-medium">${formatCurrency(
              p.total_amount
            )}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-center border-b dark:border-slate-700">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeColor}">${badgeText}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium border-b dark:border-slate-700">
                <div class="flex items-center justify-end space-x-3">
                    <button data-action="view" data-id="${p.public_id}" class="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 transition-colors" title="Ver Detalhes">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </button>
                    <button data-action="duplicate" data-id="${p.public_id}" class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors" title="Duplicar">
                        <svg class="h-5 w-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </button>
                    ${
                      isCompleted
                        ? `
                    <button data-action="cancel_inline" data-id="${p.public_id}" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors" title="Cancelar Compra">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                    `
                        : ''
                    }
                </div>
            </td>
        </tr>
    `;
      })
      .join('');
  }

  // Load Dependencies (Products, Entities, Banks, Categories)
  async function loadDependencies(): Promise<void> {
    try {
      const [prodRes, custRes, bankRes, catRes] = await Promise.all([
        (api as any)('/products'),
        (api as any)('/entities/suppliers'),
        (api as any)('/bank-accounts'),
        (api as any)('/finance/categories'),
      ]);

      g_products = prodRes.data || [];
      g_suppliers = custRes.data || [];
      g_banks = bankRes.data || [];
      g_categories = catRes.data || [];

      populateSelect('bankSelect', g_banks, 'name', 'public_id');
    } catch (error) {
      console.error('Falha ao carregar dependências', error);
      (UI as any).showAlert('alertMessage', 'Falha na comunicação base do sistema.');
    }
  }

  function populateSelect(elementId: string, items: AnyRecord[], labelKey: string, valueKey: string): void {
    const el = getEl<HTMLSelectElement>(elementId);
    if (!el) return;

    el.innerHTML = '<option value="">Selecione...</option>';
    items.forEach((i: any) => {
      el.innerHTML += `<option value="${i[valueKey]}">${i[labelKey]}</option>`;
    });
  }

  // Modal Logic
  (window as any).openSaleModal = () =>
    initModal('purchase', 'Registrar Compra', 'Fornecedor', g_suppliers, 'bg-brand-600', 'hover:bg-brand-700', 'focus:ring-brand-500');

  function initModal(
    type: 'purchase',
    title: string,
    entityLabel: string,
    entityData: AnyRecord[],
    btnBg: string,
    btnHover: string,
    btnFocus: string
  ): void {
    const orderType = getEl<HTMLInputElement>('orderType');
    if (orderType) orderType.value = type;

    const modalTitle = getEl('modalTitle');
    if (modalTitle) modalTitle.textContent = title;

    const label = getEl('entityLabel');
    if (label) label.textContent = entityLabel;

    const saveBtn = getEl('saveBtn');
    if (saveBtn) {
      saveBtn.className = `w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${btnBg} ${btnHover} ${btnFocus}`;
    }

    populateSelect('entitySelect', entityData, 'name', 'public_id');

    const relevantCategories = g_categories.filter((c: any) => c.type === (type === 'purchase' ? 'income' : 'expense'));
    populateSelect('categorySelect', relevantCategories, 'name', 'public_id');

    // Resetar combobox de busca de produto
    const _pSearchInput = getEl<HTMLInputElement>('productSearchInput');
    if (_pSearchInput) _pSearchInput.value = '';
    const _pClearBtn = getEl('productSearchClear');
    if (_pClearBtn) _pClearBtn.classList.add('hidden');
    const _pHidden = getEl<HTMLInputElement>('productSelect');
    if (_pHidden) _pHidden.value = '';
    const _pDropdown = getEl('productDropdown');
    if (_pDropdown) _pDropdown.classList.add('hidden');

    g_cart = [];
    renderCart();

    getEl<HTMLFormElement>('orderForm')?.reset();
    getEl('orderModal')?.classList.remove('hidden');
  }

  (window as any).closeModal = () => {
    getEl('orderModal')?.classList.add('hidden');
  };

  // Cart Logic
  getEl('addItemBtn')?.addEventListener('click', () => {
    const pSelect = getEl<HTMLSelectElement>('productSelect');
    const pQty = getEl<HTMLInputElement>('productQty');
    const pPrice = getEl<HTMLInputElement>('productPrice');

    if (!pSelect?.value) return void alert('Selecione um produto.');
    if (!pPrice?.value) return void alert('Informe o preço unitário de compra.');

    const product = g_products.find((p: any) => p.public_id === pSelect.value);
    const qty = parseInt(pQty?.value || '0', 10);
    const unitPrice = parseFloat(pPrice.value);

    if (!product) return;

    const existingIndex = g_cart.findIndex((i: any) => i.product_public_id === product.public_id);
    if (existingIndex > -1) {
      g_cart[existingIndex].quantity += qty;
      g_cart[existingIndex].unit_price = unitPrice;
    } else {
      g_cart.push({
        product_public_id: product.public_id,
        name: product.name,
        quantity: qty,
        unit_price: unitPrice,
      });
    }

    renderCart();

    pSelect.value = '';
    if (pQty) pQty.value = '1';
    if (pPrice) pPrice.value = '';
    const _si = getEl<HTMLInputElement>('productSearchInput');
    if (_si) _si.value = '';
    const _cb = getEl('productSearchClear');
    if (_cb) _cb.classList.add('hidden');
  });

  // Product Search Combobox
  function initProductSearch(): void {
    const searchInput = getEl<HTMLInputElement>('productSearchInput');
    const hiddenInput = getEl<HTMLInputElement>('productSelect');
    const dropdown = getEl('productDropdown');
    const clearBtn = getEl('productSearchClear');
    if (!searchInput || !dropdown) return;

    function normalizeStr(s: string): string {
      return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function buildDropdown(items: AnyRecord[]): void {
      if (items.length === 0) {
        dropdown!.innerHTML = '<li class="px-3 py-2.5 text-xs text-gray-400 dark:text-gray-500 text-center">Nenhum produto encontrado.</li>';
      } else {
        dropdown!.innerHTML = items.slice(0, 60).map((p: any) => `
          <li class="px-3 py-2 cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-900/20 border-b border-gray-100 dark:border-slate-700/50 last:border-0"
              data-value="${p.public_id}" data-label="${p.name.replace(/"/g, '&quot;')}">
            <div class="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">${p.name}</div>
            <div class="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-0.5 flex flex-wrap gap-x-2">
              ${p.sku ? `<span>SKU: ${p.sku}</span>` : ''}
              ${p.ean ? `<span>EAN: ${p.ean}</span>` : ''}
              ${p.external_code ? `<span>Cód: ${p.external_code}</span>` : ''}
            </div>
          </li>
        `).join('');
      }
      dropdown!.classList.remove('hidden');
    }

    function hideDropdown(): void {
      dropdown!.classList.add('hidden');
    }

    function selectProduct(publicId: string, label: string): void {
      if (hiddenInput) hiddenInput.value = publicId;
      if (searchInput) searchInput.value = label;
      if (clearBtn) clearBtn.classList.remove('hidden');
      hideDropdown();
    }

    searchInput.addEventListener('input', () => {
      const term = normalizeStr(searchInput.value);
      if (!term) {
        if (clearBtn) clearBtn.classList.add('hidden');
        if (hiddenInput) hiddenInput.value = '';
        hideDropdown();
        return;
      }
      if (clearBtn) clearBtn.classList.remove('hidden');
      if (hiddenInput) hiddenInput.value = '';
      const filtered = g_products.filter((p: any) =>
        normalizeStr(p.name).includes(term)
        || (p.ean && normalizeStr(p.ean).includes(term))
        || (p.sku && normalizeStr(p.sku).includes(term))
        || (p.external_code && normalizeStr(p.external_code).includes(term))
      );
      buildDropdown(filtered);
    });

    searchInput.addEventListener('focus', () => {
      if (!searchInput.value) buildDropdown(g_products);
      else dropdown!.classList.remove('hidden');
    });

    dropdown.addEventListener('mousedown', (e: Event) => {
      const li = (e.target as HTMLElement).closest('li[data-value]') as HTMLElement | null;
      if (li) selectProduct(li.dataset['value'] || '', li.dataset['label'] || '');
    });

    clearBtn?.addEventListener('click', () => {
      if (hiddenInput) hiddenInput.value = '';
      if (searchInput) { searchInput.value = ''; searchInput.focus(); }
      if (clearBtn) clearBtn.classList.add('hidden');
      hideDropdown();
    });

    document.addEventListener('click', (e: Event) => {
      const wrapper = getEl('productSelectWrapper');
      if (wrapper && !wrapper.contains(e.target as Node)) hideDropdown();
    });
  }

  (window as any).removeCartItem = (index: number) => {
    g_cart.splice(index, 1);
    renderCart();
  };

  function renderCart(): void {
    const list = getEl('cartItems');
    const totalEl = getEl('cartTotal');
    if (!list || !totalEl) return;

    if (g_cart.length === 0) {
      list.innerHTML =
        '<li class="py-2 text-center text-xs text-gray-500 dark:text-gray-400">O carrinho está vazio.</li>';
      totalEl.textContent = 'R$ 0,00';
      return;
    }

    let total = 0;
    list.innerHTML = g_cart
      .map((item: any, index: number) => {
        const itemTotal = item.quantity * item.unit_price;
        total += itemTotal;
        return `
            <li class="py-2 flex justify-between items-center text-sm">
                <div class="text-gray-900 dark:text-gray-100">
                    <span class="font-bold text-gray-800 dark:text-gray-300 mr-1">${item.quantity}x</span>${item.name}
                </div>
                <div class="flex items-center space-x-3">
                    <span class="text-gray-600 dark:text-gray-400 font-medium">${formatCurrency(itemTotal)}</span>
                    <button type="button" class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-bold btn-remove-item" data-index="${index}">&times;</button>
                </div>
            </li>
        `;
      })
      .join('');

    totalEl.textContent = formatCurrency(total);
  }

  // Form Submit
  getEl<HTMLFormElement>('orderForm')?.addEventListener('submit', async (e: Event) => {
    e.preventDefault();

    if (g_cart.length === 0) return void alert('O carrinho não pode estar vazio.');

    const saveBtn = getEl<HTMLButtonElement>('saveBtn');

    const payload: any = {
      supplier_public_id: getEl<HTMLSelectElement>('entitySelect')?.value,
      bank_account_public_id: getEl<HTMLSelectElement>('bankSelect')?.value,
      category_public_id: getEl<HTMLSelectElement>('categorySelect')?.value,
      date: DateUtilsRef.getTodayDateInputValue(),
      items: g_cart.map((i: any) => ({
        product_public_id: i.product_public_id,
        quantity: i.quantity,
        unit_price: parseFloat(i.unit_price),
      })),
    };

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Processando...';
    }

    try {
      await (api as any)('/purchases', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      (UI as any).showAlert(
        'alertMessage',
        'Compra finalizada com sucesso! Estoque e Conta Bancária atualizados.',
        'success'
      );

      (window as any).closeModal();
      void fetchPurchases();
    } catch (error: any) {
      alert(error?.message || 'Erro ao processar compra.');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Finalizar Compra';
      }
    }
  });

  // View Details
  (window as any).openViewModal = async (id: string) => {
    try {
      const res = await (api as any)('/purchases/' + id);
      const p = res.data;
      currentViewId = id;

      const supplierEl = getEl('viewSupplier');
      const dateEl = getEl('viewDate');
      const totalEl = getEl('viewTotal');
      if (supplierEl) supplierEl.textContent = p.supplier_name;
      if (dateEl) dateEl.textContent = DateUtilsRef.formatDate(p.date);
      if (totalEl) totalEl.textContent = formatCurrency(p.total_amount);

      const statusEl = getEl('viewModalStatus');
      const btnCancel = getEl<HTMLElement>('btnCancelPurchase');
      if (p.status === 'completed') {
        if (statusEl) {
          statusEl.className =
            'px-3 py-1 text-sm rounded-full font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300';
          statusEl.textContent = 'Concluída';
        }
        if (btnCancel) btnCancel.style.display = 'inline-flex';
      } else {
        if (statusEl) {
          statusEl.className =
            'px-3 py-1 text-sm rounded-full font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
          statusEl.textContent = 'Cancelada';
        }
        if (btnCancel) btnCancel.style.display = 'none';
      }

      const itemsList = getEl('viewItemsList');
      if (itemsList) {
        itemsList.innerHTML = (p.items || [])
          .map(
            (i: any) => `
            <li class="py-2 flex justify-between text-sm">
                <div class="text-gray-900 dark:text-gray-100">
                    <span class="font-bold text-gray-800 dark:text-gray-300 mr-1">${i.quantity}x</span>${i.product_name}
                    <span class="text-xs text-gray-500 dark:text-gray-400 ml-1">(${formatCurrency(i.unit_price)} un)</span>
                </div>
                <div class="text-gray-600 dark:text-gray-400 font-medium">${formatCurrency(
                  parseFloat(i.total_price)
                )}</div>
            </li>
        `
          )
          .join('');
      }

      getEl('viewOrderModal')?.classList.remove('hidden');
    } catch (e: any) {
      alert(e?.message || 'Erro ao abrir detalhes.');
    }
  };

  (window as any).closeViewModal = () => {
    getEl('viewOrderModal')?.classList.add('hidden');
  };

  (window as any).cancelPurchase = async () => {
    if (
      !confirm(
        'ATENÇÃO! Esta ação é irreversível.\nDeseja cancelar esta compra? O valor será estornado na sua conta bancária e as quantidades removidas do estoque atual.'
      )
    )
      return;

    try {
      await (api as any)('/purchases/' + currentViewId, { method: 'DELETE' });
      (UI as any).showAlert('alertMessage', 'Compra cancelada com sucesso. Financeiro e Estoque revertidos.', 'success');
      (window as any).closeViewModal();
      void fetchPurchases();
    } catch (e: any) {
      alert(e?.message || 'Erro ao cancelar compra.');
    }
  };

  (window as any).duplicatePurchase = async (id: string) => {
    try {
      const res = await (api as any)('/purchases/' + id);
      const p = res.data;

      (window as any).openSaleModal();
      const modalTitle = getEl('modalTitle');
      if (modalTitle) modalTitle.textContent = 'Duplicar Compra';

      const supplier = g_suppliers.find((s: any) => s.name === p.supplier_name);
      if (supplier) {
        const entitySelect = getEl<HTMLSelectElement>('entitySelect');
        if (entitySelect) entitySelect.value = supplier.public_id;
      }

      g_cart = (p.items || []).map((i: any) => {
        const prod = g_products.find((pr: any) => pr.name === i.product_name || pr.id === i.product_id);
        return {
          product_public_id: prod ? prod.public_id : '',
          name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
        };
      });

      renderCart();
    } catch (e: any) {
      alert(e?.message || 'Erro ao duplicar compra.');
    }
  };
})();
