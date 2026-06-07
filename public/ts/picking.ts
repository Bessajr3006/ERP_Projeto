(() => {
  type AnyRecord = Record<string, any>;

  let g_sales: AnyRecord[] = [];
  let g_currentSaleItems: AnyRecord[] = [];
  let g_currentSaleId: number | string | null = null;
  const REMOVED_ITEMS_STORAGE_KEY = 'picking_removed_items';
  const g_removedPickingItems = new Set<string>(JSON.parse(sessionStorage.getItem(REMOVED_ITEMS_STORAGE_KEY) || '[]'));

  const FilterPanel: any = (window as any).FilterPanel;
  const DateUtilsRef: any = (window as any).DateUtils || (typeof DateUtils !== 'undefined' ? (DateUtils as any) : null);

  const getEl = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
    document.getElementById(id) as T | null;

  document.addEventListener('DOMContentLoaded', async () => {
    if (!(Auth as any).isAuthenticated()) {
      window.location.href = '/';
      return;
    }

    try {
      await initPickingPage();
    } catch (e) {
      console.error('Error starting picking module:', e);
    }
  });

  async function initPickingPage(): Promise<void> {
    setupModal();
    setupFilters();
    await loadSales();
  }

  function setupModal(): void {
    const btnCloseTop = getEl('btnCloseModalTop');
    const btnCloseBottom = getEl('btnCloseModal');

    const closeModal = () => {
      const modal = getEl('pickingModal');
      modal?.classList.add('hidden');
      modal?.classList.remove('flex');
    };

    btnCloseTop?.addEventListener('click', closeModal);
    btnCloseBottom?.addEventListener('click', closeModal);

    // Handle click outside to close
    const pickingModal = getEl('pickingModal');
    if (pickingModal) {
      pickingModal.addEventListener('click', (e: MouseEvent) => {
        if (e.target === pickingModal) closeModal();
      });
    }

    const btnPrint = getEl('btnPrintOrder');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        const title = getEl('modalOrderTitle')?.textContent || '';
        printPickingSlip(title, g_currentSaleItems);
      });
    }

    getEl('btnRefresh')?.addEventListener('click', async () => {
      const btn = getEl('btnRefresh');
      btn?.classList.add('opacity-50');
      await loadSales();
      btn?.classList.remove('opacity-50');
    });
  }

  function setupFilters(): void {
    setupViewToggle();

    FilterPanel.mount({
      storageKey: 'picking_filter_panel',
      fields: [
        { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Pedido ou cliente' },
        {
          id: 'filterStatus',
          type: 'select',
          label: 'Status',
          options: [
            { value: '', label: 'Todos' },
            { value: 'pending', label: 'Pendentes' },
            { value: 'progress', label: 'Em andamento' },
            { value: 'completed', label: 'Concluídos' },
          ],
        },
      ],
      gridClass: 'grid grid-cols-1 md:grid-cols-2 gap-3 items-end',
    });

    let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    getEl<HTMLInputElement>('filterSearch')?.addEventListener('input', () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
      searchDebounceTimer = setTimeout(() => {
        applyFilters();
        searchDebounceTimer = null;
      }, 180);
    });
    getEl<HTMLSelectElement>('filterStatus')?.addEventListener('change', applyFilters);
  }

  function setupViewToggle(): void {
    const btnListView = getEl('btnListView');
    const btnGridView = getEl('btnGridView');
    const gridContainer = getEl('ordersGrid');

    if (!btnListView || !btnGridView || !gridContainer) return;

    const setView = (type: 'list' | 'grid') => {
      const listIconCheck = btnListView.querySelector('.check-icon');
      const gridIconCheck = btnGridView.querySelector('.check-icon');

      if (type === 'list') {
        btnListView.className =
          'flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1';
        btnGridView.className =
          'flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1';
        listIconCheck?.classList.remove('hidden');
        gridIconCheck?.classList.add('hidden');

        gridContainer.className = 'overflow-y-auto flex-1 min-h-0 p-4 grid grid-cols-1 gap-4 content-start';
        localStorage.setItem('picking_view', 'list');
      } else {
        btnGridView.className =
          'flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1';
        btnListView.className =
          'flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1';
        gridIconCheck?.classList.remove('hidden');
        listIconCheck?.classList.add('hidden');

        gridContainer.className =
          'overflow-y-auto flex-1 min-h-0 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 content-start';
        localStorage.setItem('picking_view', 'grid');
      }
    };

    btnListView.addEventListener('click', () => setView('list'));
    btnGridView.addEventListener('click', () => setView('grid'));

    // Apply from saved memory
    const savedView = (localStorage.getItem('picking_view') as 'list' | 'grid' | null) || 'grid';
    setView(savedView);
  }

  async function loadSales(): Promise<void> {
    try {
      const res = await (api as any)('/sales/sales?include_inactive=1');
      if (res && res.status === 'success') {
        g_sales = (res.data || []).filter((s: any) => (s.status === 'progress' || s.status === 'completed' || s.status === 'pending') && (s.items || []).length > 0);
        applyFilters();
      }
    } catch (e) {
      console.error('Falha ao carregar vendas', e);
      const grid = getEl('ordersGrid');
      if (grid)
        grid.innerHTML =
          '<div class="col-span-full py-8 text-center text-red-500 bg-red-50 dark:bg-red-900/10 rounded-xl">Erro ao carregar lista de pedidos.</div>';
    }
  }

  function applyFilters(): void {
    const search = FilterPanel.normalizeText(getEl<HTMLInputElement>('filterSearch')?.value);
    const status = getEl<HTMLSelectElement>('filterStatus')?.value || '';

    const filtered = g_sales.filter((item: any) => {
      if (!FilterPanel.matchesSearch(item, ['id', 'customer_name'], search)) {
        return false;
      }

      if (status && item.status !== status) {
        return false;
      }

      return true;
    });

    renderGrid(filtered);
    (window as any).GridSummaryFooter?.update({
      footerId: 'pickingResultsFooter',
      anchorId: 'ordersGrid',
      count: filtered.length,
      label: 'pedido(s) exibido(s)',
    });
  }

  function closePickingModal(): void {
    const modal = getEl('pickingModal');
    modal?.classList.add('hidden');
    modal?.classList.remove('flex');
    g_currentSaleId = null;
    g_currentSaleItems = [];
  }

  function isSaleInactive(sale: AnyRecord | undefined): boolean {
    return Number(sale?.is_deleted || 0) === 1;
  }

  function isItemInactive(item: AnyRecord | undefined): boolean {
    return Number(item?.is_deleted || 0) === 1;
  }

  async function removeSaleFromPicking(saleId: string | undefined): Promise<void> {
    const sale = g_sales.find((item: AnyRecord) => String(item.id) === String(saleId));
    const shouldActivate = isSaleInactive(sale);
    const message = shouldActivate ? 'Ativar este pedido na separação?' : 'Inativar este pedido na separação? O pedido não será apagado.';
    if (!saleId || !confirm(message)) return;
    try {
      await (api as any)(`/sales/${saleId}/active`, { method: 'PATCH', body: JSON.stringify({ is_active: shouldActivate }) });
      closePickingModal();
      await loadSales();
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar pedido na separação.');
    }
  }

  function getPickingItemKey(saleId: string | number, itemId: string | number): string {
    return `${saleId}:${itemId}`;
  }

  function isPickingItemRemoved(saleId: string | number, itemId: string | number): boolean {
    return g_removedPickingItems.has(getPickingItemKey(saleId, itemId));
  }

  function markPickingItemRemoved(saleId: string | number, itemId: string | number): void {
    g_removedPickingItems.add(getPickingItemKey(saleId, itemId));
    sessionStorage.setItem(REMOVED_ITEMS_STORAGE_KEY, JSON.stringify(Array.from(g_removedPickingItems)));
  }

  function unmarkPickingItemRemoved(saleId: string | number, itemId: string | number): void {
    g_removedPickingItems.delete(getPickingItemKey(saleId, itemId));
    sessionStorage.setItem(REMOVED_ITEMS_STORAGE_KEY, JSON.stringify(Array.from(g_removedPickingItems)));
  }

  function getItemTotal(item: AnyRecord): number {
    return Number(item.total_price ?? (Number(item.quantity || 0) * Number(item.unit_price || 0))) || 0;
  }

  function getActiveSaleItems(sale: AnyRecord): AnyRecord[] {
    return (sale.items || []).filter((item: AnyRecord) => !isItemInactive(item) && !isPickingItemRemoved(sale.id, item.id));
  }

  function getActiveSaleTotal(sale: AnyRecord): number {
    const removedTotal = (sale.items || []).reduce(
      (sum: number, item: AnyRecord) => (isItemInactive(item) || isPickingItemRemoved(sale.id, item.id) ? sum + getItemTotal(item) : sum),
      0,
    );
    return Math.max(0, Number(sale.total_amount || 0) - removedTotal);
  }

  async function removeSaleItemFromPicking(saleId: string | number | null | undefined, itemId: string | undefined): Promise<void> {
    if (!saleId || !itemId) return;
    const sale = g_sales.find((item: AnyRecord) => String(item.id) === String(saleId));
    const currentItem = sale?.items?.find((item: AnyRecord) => String(item.id) === String(itemId));
    const shouldReactivate = isItemInactive(currentItem) || isPickingItemRemoved(saleId, itemId);
    const removeButton = document.querySelector<HTMLButtonElement>(`.btn-remove-sale-item[data-item-id="${itemId}"]`);
    if (removeButton) removeButton.disabled = true;
    try {
      await (api as any)(`/sales/${saleId}/items/${itemId}/active`, { method: 'PATCH', body: JSON.stringify({ is_active: shouldReactivate }) });
      if (currentItem) currentItem.is_deleted = shouldReactivate ? 0 : 1;
      unmarkPickingItemRemoved(saleId, itemId);
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar produto na separação.');
      if (removeButton) removeButton.disabled = false;
      return;
    }
    const row = removeButton?.closest('.picking-item-row') as HTMLElement | null;
    const checkbox = row?.querySelector<HTMLInputElement>('.picking-checkbox');
    const title = row?.querySelector<HTMLElement>('p.font-bold');
    if (!row || !checkbox || !title) return;

    if (shouldReactivate) {
      checkbox.checked = false;
      checkbox.disabled = false;
      row.classList.remove('bg-red-50/80', 'dark:bg-red-900/20', 'bg-green-50/50', 'dark:bg-green-900/10');
      title.classList.remove('text-red-600', 'dark:text-red-400', 'text-gray-400', 'dark:text-gray-500', 'line-through');
      title.classList.add('text-gray-900', 'dark:text-gray-100');
      if (removeButton) removeButton.title = 'Inativar produto';
    } else {
      checkbox.checked = true;
      checkbox.disabled = true;
      row.classList.remove('bg-green-50/50', 'dark:bg-green-900/10');
      row.classList.add('bg-red-50/80', 'dark:bg-red-900/20');
      title.classList.remove('text-gray-900', 'dark:text-gray-100', 'text-gray-400', 'dark:text-gray-500');
      title.classList.add('text-red-600', 'dark:text-red-400', 'line-through');
      if (removeButton) removeButton.title = 'Ativar produto';
    }
    if (removeButton) removeButton.disabled = false;
    updateCompleteButtonState();
    applyFilters();
  }

  function updateCompleteButtonState(): void {
    const btnComplete = getEl<HTMLButtonElement>('btnCompletePicking');
    const checkboxes = document.querySelectorAll<HTMLInputElement>('.picking-checkbox');
    if (btnComplete) {
      btnComplete.disabled = !Array.from(checkboxes).every((c) => c.checked);
    }
  }

  function renderGrid(sales: AnyRecord[]): void {
    const grid = getEl('ordersGrid');
    if (!grid) return;

    if (sales.length === 0) {
      grid.innerHTML =
        '<div class="col-span-full py-8 text-center text-gray-500 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">Nenhum pedido recente encontrado.</div>';
      return;
    }

    let html = '';
    sales.forEach((s: any) => {
      const isInactive = isSaleInactive(s);
      const orderDate = DateUtilsRef?.formatDateTime?.(s.created_at || s.date) || '';
      const total = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getActiveSaleTotal(s));

      const qtyItems = getActiveSaleItems(s).length;

      html += `
            <div class="${isInactive ? 'bg-red-50/80 dark:bg-red-900/20 border-red-200 dark:border-red-800/40' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'} border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-start mb-4">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isInactive ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'}">
                            #${s.id}
                        </span>
                        <span class="text-xs text-gray-400 dark:text-gray-500 font-mono">${orderDate}</span>
                    </div>
                    <h3 class="font-bold ${isInactive ? 'text-red-600 dark:text-red-400 line-through' : 'text-gray-900 dark:text-gray-100'} text-lg mb-1 leading-tight line-clamp-2">${
                      s.customer_name || 'Consumidor Final'
                    }</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">${qtyItems} itens de pedido registrados</p>
                </div>

                <div class="flex items-center justify-between border-t border-gray-100 dark:border-slate-700 pt-4 mt-2 gap-3">
                    <span class="font-bold text-brand-600 dark:text-brand-400 text-lg">${total}</span>
                  <div class="flex items-center gap-2">
                    <button type="button" class="btn-remove-sale p-2 rounded-lg ${isInactive ? 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300' : 'text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20 dark:hover:text-red-300'} transition-colors" title="${isInactive ? 'Ativar pedido' : 'Inativar pedido'}" data-sale-id="${s.id}">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                    <button type="button" class="btn-open-picking bg-brand-50 text-brand-600 hover:bg-brand-600 hover:text-white dark:bg-brand-900/20 dark:text-brand-400 dark:hover:bg-brand-600 dark:hover:text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm" data-sale-id="${s.id}">
                      Separar
                    </button>
                  </div>
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;

    document.querySelectorAll('.btn-open-picking').forEach((btn) => {
      btn.addEventListener('click', (e: Event) => {
        const saleId = (e.currentTarget as HTMLElement | null)?.dataset?.saleId;
        openPickingModal(saleId);
      });
    });

    document.querySelectorAll('.btn-remove-sale').forEach((btn) => {
      btn.addEventListener('click', (e: Event) => {
        const saleId = (e.currentTarget as HTMLElement | null)?.dataset?.saleId;
        removeSaleFromPicking(saleId);
      });
    });
  }

  function openPickingModal(saleId: string | undefined): void {
    const sale = g_sales.find((s: any) => String(s.id) === String(saleId));
    if (!sale) return;

    g_currentSaleId = sale.id;
    g_currentSaleItems = sale.items || [];

    const title = getEl('modalOrderTitle');
    if (title) title.textContent = `Pedido #${sale.id} - ${sale.customer_name || 'Consumidor Final'}`;

    const content = getEl('pickingContent');
    if (!content) return;

    if (g_currentSaleItems.length === 0) {
      content.innerHTML = '<div class="text-center py-6 text-gray-500">Este pedido não possui itens.</div>';
    } else {
      let itemsHtml =
        '<div class="bg-white dark:bg-slate-800 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700">';

      g_currentSaleItems.forEach((item: any, index: number) => {
        const isRemoved = isItemInactive(item) || isPickingItemRemoved(sale.id, item.id);
        const rowClass = isRemoved
          ? 'picking-item-row flex items-start gap-4 p-4 border-b border-gray-100 dark:border-slate-700/60 last:border-0 bg-red-50/80 dark:bg-red-900/20 transition-colors'
          : 'picking-item-row flex items-start gap-4 p-4 border-b border-gray-100 dark:border-slate-700/60 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-800/80 transition-colors';
        const titleClass = isRemoved
          ? 'font-bold text-red-600 dark:text-red-400 line-through text-[15px] mb-1 leading-tight'
          : 'font-bold text-gray-900 dark:text-gray-100 text-[15px] mb-1 leading-tight';
        const removeButtonClass = isRemoved
          ? 'btn-remove-sale-item ml-3 p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300 transition-colors disabled:opacity-50'
          : 'btn-remove-sale-item ml-3 p-2 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20 dark:hover:text-red-300 transition-colors disabled:opacity-50';
        itemsHtml += `
          <div class="${rowClass}">
                <div class="pt-1">
                    <input type="checkbox" id="item_${index}" class="picking-checkbox w-5 h-5 text-brand-600 border-gray-300 rounded focus:ring-brand-500 dark:bg-slate-700 dark:border-slate-600" data-bwignore="true" data-lpignore="true" placeholder="" ${isRemoved ? 'checked disabled' : ''}>
                </div>
                <label for="item_${index}" class="grow cursor-pointer user-select-none w-full">
                    <div class="flex justify-between items-start w-full">
                        <div>
                            <p class="${titleClass}">${
                              item.product_name
                            }</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400 font-mono flex items-center gap-2">
                                ${
                                  item.ean
                                    ? `<span class="bg-gray-100 dark:bg-slate-700/50 px-1.5 py-0.5 rounded flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>${
                                        item.ean
                                      }</span>`
                                    : ''
                                }
                                ${item.sku ? `SKU: ${item.sku}` : ''}
                            </p>
                        </div>
                        <div class="text-right shrink-0 ml-4">
                            <span class="inline-flex items-center justify-center p-2 rounded-lg bg-gray-100 dark:bg-slate-900 text-gray-800 dark:text-gray-200 font-black text-lg border border-gray-200 dark:border-slate-700 w-12 shadow-sm">
                                ${item.quantity}
                            </span>
                            <div class="text-[10px] text-gray-400 uppercase tracking-widest mt-1 font-bold">QTD</div>
                        </div>
                          <button type="button" class="${removeButtonClass}" title="${isRemoved ? 'Ativar produto' : 'Inativar produto'}" data-sale-id="${sale.id}" data-item-id="${item.id}">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                    </div>
                </label>
            </div>
            `;
      });

      itemsHtml += '</div>';
      content.innerHTML = itemsHtml;

      const btnComplete = getEl<HTMLButtonElement>('btnCompletePicking');
      if (btnComplete) {
        btnComplete.disabled = true;
        btnComplete.onclick = async () => {
          btnComplete.disabled = true;
          btnComplete.innerHTML =
            '<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg> Separando...';

          try {
            await (api as any)(`/sales/${sale.id}/status`, {
              method: 'PATCH',
              body: JSON.stringify({ status: 'separated' }),
            });

            const modal = getEl('pickingModal');
            modal?.classList.add('hidden');
            modal?.classList.remove('flex');

            const alertMsg = getEl('alertMessage');
            if (alertMsg) {
              alertMsg.textContent = `${getEl('modalOrderTitle')?.textContent || ''} separado com sucesso!`;
              alertMsg.className =
                'mx-4 sm:mx-0 mb-4 p-4 rounded-md text-sm font-medium bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30';
              alertMsg.classList.remove('hidden');
              setTimeout(() => alertMsg.classList.add('hidden'), 5000);
            }

            await loadSales();
          } catch {
            alert('Erro ao confirmar separação.');
          } finally {
            btnComplete.innerHTML =
              '<svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Concluído';
          }
        };
      }

      const checkboxes = document.querySelectorAll<HTMLInputElement>('.picking-checkbox');
      checkboxes.forEach((chk) => {
        chk.addEventListener('change', (e: Event) => {
          const target = e.target as HTMLInputElement | null;
          const row = target?.closest('div.flex.items-start') as HTMLElement | null;
          const pTitle = row?.querySelector('p.font-bold') as HTMLElement | null;
          if (!row || !pTitle || !target) return;

          if (target.checked) {
            row.classList.add('bg-green-50/50', 'dark:bg-green-900/10');
            pTitle.classList.add('text-gray-400', 'dark:text-gray-500', 'line-through');
            pTitle.classList.remove('text-gray-900', 'dark:text-gray-100');
          } else {
            row.classList.remove('bg-green-50/50', 'dark:bg-green-900/10');
            pTitle.classList.remove('text-gray-400', 'dark:text-gray-500', 'line-through');
            pTitle.classList.add('text-gray-900', 'dark:text-gray-100');
          }

          if (btnComplete) {
            updateCompleteButtonState();
          }
        });
      });

      document.querySelectorAll('.btn-remove-sale-item').forEach((btn) => {
        btn.addEventListener('click', (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          const target = e.currentTarget as HTMLElement | null;
          const saleId = target?.dataset?.saleId || g_currentSaleId;
          const itemId = target?.dataset?.itemId;
          removeSaleItemFromPicking(saleId, itemId);
        });
      });

      updateCompleteButtonState();
    }

    const modal = getEl('pickingModal');
    modal?.classList.remove('hidden');
    modal?.classList.add('flex');
  }

  function printPickingSlip(title: string, items: AnyRecord[]): void {
    if (!items || items.length === 0) {
      alert('Sem itens para impressão.');
      return;
    }

    let printContents = `
    <html>
    <head>
        <title>${title}</title>
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; margin: 0; padding: 20px; color: #333; }
            h1 { font-size: 20px; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; text-transform: uppercase; font-size: 11px; color: #666; }
            .qty { width: 50px; text-align: center; font-weight: bold; font-size: 16px; }
            .checkbox-cell { width: 30px; }
            .box { width: 15px; height: 15px; border: 1px solid #000; display: inline-block; }
            .ean { font-family: monospace; font-size: 11px; color: #666; margin-top: 4px;}
        </style>
    </head>
    <body onload="window.print(); window.close();">
        <h1>Romaneio de Separação / ${title}</h1>
        <table>
            <thead>
                <tr>
                    <th class="checkbox-cell"></th>
                    <th class="qty">Qtd</th>
                    <th>Produto / Descrição</th>
                </tr>
            </thead>
            <tbody>
    `;

    items.forEach((item: any) => {
      const eanBlock = item.ean ? `<div class="ean">EAN: ${item.ean}</div>` : '';
      const skuBlock = item.sku ? `<div class="ean">SKU: ${item.sku}</div>` : '';
      printContents += `
            <tr>
                <td class="checkbox-cell"><div class="box"></div></td>
                <td class="qty">${item.quantity}</td>
                <td>
                    <strong>${item.product_name}</strong>
                    ${eanBlock}
                    ${skuBlock}
                </td>
            </tr>
        `;
    });

    printContents += `
            </tbody>
        </table>
        <div style="margin-top: 30px; text-align: right; font-size: 12px; color: #666;">
            Impresso em: ${DateUtilsRef?.formatDateTime?.(new Date()) || ''}
        </div>
    </body>
    </html>
    `;

    const printWin = window.open('', '', 'width=800,height=600');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(printContents);
      printWin.document.close();
    }
  }
})();
