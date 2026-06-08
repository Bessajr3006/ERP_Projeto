(() => {
  /**
   * finance_categories.ts
   * Gerencia a tela de Categorias do módulo Financeiro
   */

  type FinanceCategory = {
    id?: number;
    public_id?: string;
    name?: string;
    type?: 'income' | 'expense' | string;
  };

  let g_categories: FinanceCategory[] = [];
  let g_filteredCategories: FinanceCategory[] = [];
  let g_editingId: string | null = null;

  const FilterPanel: any = (window as any).FilterPanel;
  const api = (window as any).api;

  const getEl = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
    document.getElementById(id) as T | null;

  document.addEventListener('DOMContentLoaded', () => {
    void fetchCategories();

    let currentView = localStorage.getItem('financeCategoriesView') || 'list';

    function updateViewToggle(): void {
      const btnList = getEl('btnListView');
      const btnGrid = getEl('btnGridView');
      const tableSection = getEl('categoriesSection');
      const gridSection = getEl('categoriesGridSection');

      if (!btnList || !btnGrid || !tableSection || !gridSection) return;

      btnList.className =
        'flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1';
      btnGrid.className =
        'flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1';

      btnList.querySelector('.check-icon')?.classList.add('hidden');
      btnGrid.querySelector('.check-icon')?.classList.add('hidden');

      if (currentView === 'list') {
        btnList.className =
          'flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1';
        btnList.querySelector('.check-icon')?.classList.remove('hidden');
        tableSection.classList.remove('hidden');
        gridSection.classList.add('hidden');
      } else {
        btnGrid.className =
          'flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1';
        btnGrid.querySelector('.check-icon')?.classList.remove('hidden');
        tableSection.classList.add('hidden');
        gridSection.classList.remove('hidden');
      }
    }

    const btnListView = getEl('btnListView');
    btnListView?.addEventListener('click', () => {
      currentView = 'list';
      localStorage.setItem('financeCategoriesView', 'list');
      updateViewToggle();
    });

    const btnGridView = getEl('btnGridView');
    btnGridView?.addEventListener('click', () => {
      currentView = 'grid';
      localStorage.setItem('financeCategoriesView', 'grid');
      updateViewToggle();
    });

    updateViewToggle();

    // Event Delegation: Ações na Tabela e Grid
    function handleCategoryAction(e: Event): void {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest('button[data-action]') as HTMLButtonElement | null;
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');

      if (action === 'edit') (window as any).editCategory?.(id);
      if (action === 'duplicate') (window as any).duplicateCategory?.(id);
      if (action === 'delete') (window as any).deleteCategory?.(id);
      if (action === 'view-id') {
        const pid = btn.getAttribute('data-pid') || '';
        navigator.clipboard.writeText(pid).then(() => {
          if (btn.classList.contains('animating')) return;
          btn.classList.add('animating');

          const orig = btn.innerHTML;
          const svgSize = 'h-3.5 w-3.5 inline';

          // Step 1: Fade out and shrink original icon
          btn.classList.add('scale-75', 'opacity-0');

          // Step 2: Show spinning loader
          setTimeout(() => {
            btn.innerHTML = `<svg class="animate-spin h-3.5 w-3.5 text-brand-600 dark:text-brand-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
            btn.classList.remove('scale-75', 'opacity-0');

            // Step 3: Fade out loader after 400ms
            setTimeout(() => {
              btn.classList.add('scale-75', 'opacity-0');

              // Step 4: Show checkmark and pop
              setTimeout(() => {
                btn.innerHTML = `<svg class="${svgSize} text-green-500 transition-all duration-300 transform scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
                btn.classList.remove('scale-75', 'opacity-0');
                btn.classList.add('scale-110', 'opacity-100');

                // Revert checkmark back to normal scale
                setTimeout(() => {
                  btn.classList.remove('scale-110');
                }, 100);

                // Step 5: Fade out checkmark after 1000ms
                setTimeout(() => {
                  btn.classList.add('scale-75', 'opacity-0');

                  // Step 6: Restore original icon
                  setTimeout(() => {
                    btn.innerHTML = orig;
                    btn.classList.remove('scale-75', 'opacity-0', 'animating');
                  }, 150);
                }, 1000);

              }, 150);
            }, 400);

          }, 150);
        });
      }
    }

    getEl('categoriesSection')?.addEventListener('click', handleCategoryAction);
    getEl('categoriesGridSection')?.addEventListener('click', handleCategoryAction);

    // Event Listeners
    getEl('btnOpenModal')?.addEventListener('click', () => openModal());
    getEl('btnCancelModal')?.addEventListener('click', closeModal);

    // Fechar modal ao clicar fora
    getEl('modalBackdrop')?.addEventListener('click', closeModal);

    // Form Submit
    getEl<HTMLFormElement>('categoryForm')?.addEventListener('submit', handleSaveCategory);

    FilterPanel.mount({
      storageKey: 'finance_categories_filter_panel',
      fields: [
        { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome da categoria' },
        {
          id: 'filterType',
          type: 'select',
          label: 'Tipo',
          options: [
            { value: '', label: 'Todos' },
            { value: 'income', label: 'Receita' },
            { value: 'expense', label: 'Despesa' },
          ],
        },
      ],
      gridClass: 'grid grid-cols-1 md:grid-cols-2 gap-3 items-end',
    });

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
    getEl('filterType')?.addEventListener('change', applyFilters);
  });

  // --- API Calls ---

  async function fetchCategories(): Promise<void> {
    try {
      const res = await (api as any)('/finance/categories');
      g_categories = res.data || [];
      applyFilters();
    } catch (error) {
      console.error('Erro ao buscar categorias financeiras:', error);
      showAlert('Erro ao carregar categorias.', 'error');
    }
  }

  async function handleSaveCategory(e: Event): Promise<void> {
    e.preventDefault();

    const name = getEl<HTMLInputElement>('categoryName')?.value;
    const type = getEl<HTMLSelectElement>('categoryType')?.value;

    const data = {
      name: name,
      type: type,
    };

    const btn = getEl<HTMLButtonElement>('saveBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Salvando...';
    }

    try {
      if (g_editingId) {
        await (api as any)(`/finance/categories/${g_editingId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        showAlert('Categoria atualizada com sucesso!', 'success');
      } else {
        await (api as any)('/finance/categories', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        showAlert('Categoria cadastrada com sucesso!', 'success');
      }

      closeModal();
      await fetchCategories();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      showAlert(error?.message || 'Erro ao salvar categoria.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Gravar';
      }
    }
  }

  (window as any).deleteCategory = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria? Ela pode estar vinculada a lançamentos financeiros.'))
      return;

    try {
      await (api as any)(`/finance/categories/${id}`, {
        method: 'DELETE',
      });
      showAlert('Categoria excluída com sucesso!', 'success');
      await fetchCategories();
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      showAlert(error?.message || 'Erro ao excluir categoria. Pode estar em uso.', 'error');
    }
  };

  // --- UI / Rendering ---

  function renderTable(): void {
    const tbody = getEl('categoriesTable');
    if (!tbody) return;

    const items = g_filteredCategories;
    tbody.innerHTML = '';

    if (items.length === 0) {
      tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhuma categoria encontrada.
                </td>
            </tr>
        `;
      return;
    }

    tbody.innerHTML = items
      .map((cat) => {
        const typeBadge =
          cat.type === 'income'
            ? '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Receita</span>'
            : '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Despesa</span>';

        return `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
            <td class="px-6 py-4 whitespace-nowrap">
                <input type="checkbox" class="item-checkbox h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 dark:border-slate-600 rounded cursor-pointer" value="${
                  cat.public_id || ''
                }" data-bwignore="true" data-lpignore="true" placeholder="">
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400 font-mono">#${String(
              cat.id || ''
            ).padStart(4, '0')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">
                <div>${cat.name || ''}</div>
                <div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    <span class="font-mono text-[10px] select-all">${cat.public_id || ''}</span>
                    <button type="button" data-action="view-id" data-id="${cat.public_id || ''}" data-pid="${cat.public_id || ''}" class="view-id-btn text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transform transition-all duration-200 ease-out" title="Copiar ID: ${cat.public_id || ''}">
                        <svg class="h-3.5 w-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                        </svg>
                    </button>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${typeBadge}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                Acesso Global
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                <div class="flex items-center justify-center space-x-3">
                    <button data-action="edit" data-id="${cat.public_id || ''}" class="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 transition-colors" title="Editar">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button data-action="duplicate" data-id="${cat.public_id || ''}" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors" title="Duplicar">
                        <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </button>
                    <button data-action="delete" data-id="${cat.public_id || ''}" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors" title="Excluir">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </td>
        </tr>`;
      })
      .join('');

    const selectAllBtn = getEl<HTMLInputElement>('selectAll');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('change', (e: Event) => {
        const checked = !!(e.target as HTMLInputElement | null)?.checked;
        document.querySelectorAll<HTMLInputElement>('.item-checkbox').forEach((cb) => {
          cb.checked = checked;
        });
      });
    }

    document.querySelectorAll<HTMLInputElement>('.item-checkbox').forEach((cb) => {
      cb.addEventListener('change', () => {
        if (!cb.checked && selectAllBtn) {
          selectAllBtn.checked = false;
        }
      });
    });
  }

  function renderGrid(): void {
    const grid = getEl('categoriesGridSection');
    if (!grid) return;

    const items = g_filteredCategories;

    if (items.length === 0) {
      grid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-12 gap-2">
            <svg class="w-10 h-10 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <p class="text-sm text-gray-400 dark:text-gray-500">Nenhuma categoria encontrada.</p>
        </div>`;
      return;
    }

    grid.innerHTML = items
      .map((cat) => {
        const typeBadge =
          cat.type === 'income'
            ? '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Receita</span>'
            : '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Despesa</span>';

        return `
        <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col border border-gray-100 dark:border-slate-700 relative group">

            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center z-10 pt-1">
                    <input type="checkbox" value="${cat.public_id || ''}" class="item-checkbox rounded border-gray-300 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800 dark:border-slate-600" data-bwignore="true" data-lpignore="true" placeholder="">
                    <span class="ml-2 text-xs font-mono font-medium text-gray-500 dark:text-gray-400">#${String(
                      cat.id || ''
                    ).padStart(4, '0')}</span>
                </div>

                <div class="flex space-x-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10 -mr-1 -mt-1">
                    <button data-action="edit" data-id="${cat.public_id || ''}" class="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-md transition-colors" title="Editar">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button data-action="duplicate" data-id="${cat.public_id || ''}" class="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-md transition-colors" title="Duplicar">
                        <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </button>
                    <button data-action="delete" data-id="${cat.public_id || ''}" class="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-md transition-colors" title="Excluir">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>

            <div class="flex-1 mt-0">
                <div class="flex justify-between items-start gap-2">
                    <h4 class="text-base font-bold text-gray-900 dark:text-gray-100 wrap-break-word flex-1 leading-tight">${
                      cat.name || ''
                    }</h4>
                </div>

                <div class="mt-2 flex flex-col gap-1 items-start">
                    ${typeBadge}
                </div>

                <div class="mt-3 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <span class="font-mono text-[10px] select-all">${cat.public_id || ''}</span>
                    <button type="button" data-action="view-id" data-id="${cat.public_id || ''}" data-pid="${cat.public_id || ''}" class="text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transform transition-all duration-200 ease-out" title="Copiar ID: ${cat.public_id || ''}">
                        <svg class="h-3.5 w-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                        </svg>
                    </button>
                </div>

                <div class="mt-4 pt-3 flex justify-end space-x-2 text-xs text-gray-500">
                    Acesso Global
                </div>
            </div>
        </div>`;
      })
      .join('');
  }

  function applyFilters(): void {
    const search = FilterPanel.normalizeText(getEl<HTMLInputElement>('filterSearch')?.value);
    const type = getEl<HTMLSelectElement>('filterType')?.value || '';

    g_filteredCategories = g_categories.filter((item: any) => {
      if (!FilterPanel.matchesSearch(item, ['name'], search)) {
        return false;
      }

      if (type && item.type !== type) {
        return false;
      }

      return true;
    });

    renderTable();
    renderGrid();
    (window as any).GridSummaryFooter?.update({
      footerId: 'financeCategoriesResultsFooter',
      anchorId: 'categoriesGridSection',
      count: g_filteredCategories.length,
      label: 'categoria(s) exibida(s)',
    });
  }

  // --- Modal Actions ---

  function openModal(category: FinanceCategory | null = null): void {
    g_editingId = category ? category.public_id || null : null;

    const title = getEl('modalTitle');
    if (title) title.textContent = category ? 'Editar Categoria' : 'Cadastrar Categoria';

    const nameInput = getEl<HTMLInputElement>('categoryName');
    const typeSelect = getEl<HTMLSelectElement>('categoryType');
    const idInput = getEl<HTMLInputElement>('categoryId');
    const form = getEl<HTMLFormElement>('categoryForm');

    if (category) {
      if (nameInput) nameInput.value = category.name || '';
      if (typeSelect) typeSelect.value = category.type || '';
      if (idInput) idInput.value = category.public_id || '';
    } else {
      form?.reset();
      if (idInput) idInput.value = '';
    }

    getEl('categoryModal')?.classList.remove('hidden');

    setTimeout(() => {
      nameInput?.focus();
    }, 100);
  }

  function closeModal(): void {
    getEl('categoryModal')?.classList.add('hidden');
    getEl<HTMLFormElement>('categoryForm')?.reset();
    g_editingId = null;
  }

  (window as any).editCategory = (publicId: string) => {
    const cat = g_categories.find((c) => c.public_id === publicId);
    if (cat) openModal(cat);
  };

  (window as any).duplicateCategory = (publicId: string) => {
    const cat = g_categories.find((c) => c.public_id === publicId);
    if (cat) {
      const dup: FinanceCategory = { ...cat, public_id: '' };
      openModal(dup);
    }
  };

  // --- Utils ---

  function showAlert(message: string, type: 'success' | 'error' = 'success'): void {
    const alertEl = getEl('alertMessage');
    if (!alertEl) return;

    alertEl.textContent = message;
    alertEl.className = `mx-4 sm:mx-0 mb-4 p-4 rounded-md text-sm ${
      type === 'success'
        ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800'
        : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'
    }`;
    alertEl.classList.remove('hidden');

    setTimeout(() => {
      alertEl.classList.add('hidden');
    }, 5000);
  }
})();
