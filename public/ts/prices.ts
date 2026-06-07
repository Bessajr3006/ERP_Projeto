(() => {
  let pricesManager: any;

  const getById = (id: string): any => document.getElementById(id);

  const formatPerc = (val: any): string => {
    const num = Number(val);
    const sign = num > 0 ? '+' : '';
    return sign + num.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + '%';
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (!(Auth as any).isAuthenticated()) {
      window.location.href = '/';
      return;
    }

    (api as any)('/auth/me')
      .then((res: any) => {
        const userGreeting = getById('userGreeting');
        if (userGreeting && res.data && res.data.user) {
          userGreeting.textContent = `Olá, ${res.data.user.full_name || 'Usuário'}`;
        } else if (userGreeting && res.data) {
          userGreeting.textContent = `Olá, ${res.data.full_name || 'Usuário'}`;
        }
      })
      .catch((err: any) => console.error(err));

    const FilterPanel: any = window.FilterPanel;

    pricesManager = new (window.CrudManager as any)({
      entityName: 'Tabela de Preço',
      endpoint: '/estoque/prices',
      tableId: 'pricesTable',
      gridSectionId: 'pricesGridSection',
      tableSectionId: 'pricesSection',
      modalId: 'priceModal',
      disableSummaryFooter: true,

      filterConfig: {
        storageKey: 'prices_filter_panel',
        fields: [
          { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome da tabela' },
          {
            id: 'filterStatus',
            type: 'select',
            label: 'Status',
            options: [
              { value: '', label: 'Todos' },
              { value: 'active', label: 'Ativas' },
              { value: 'inactive', label: 'Inativas' },
            ],
          },
        ],
      },

      renderTable: (items: any[]) => {
        const tbody = getById('pricesTable');
        if (items.length === 0) {
          tbody.innerHTML =
            '<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhuma tabela cadastrada.</td></tr>';
          return;
        }

        tbody.innerHTML = items
          .map(
            (p: any) => `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap">
                        <input type="checkbox" class="item-checkbox h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 dark:border-slate-600 rounded cursor-pointer" value="${p.public_id}" data-bwignore="true" data-lpignore="true" placeholder="">
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">#${String(p.id).padStart(4, '0')}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">${p.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        ${
                          p.status === 'active'
                            ? '<span class="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded-full">Ativa</span>'
                            : '<span class="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 rounded-full">Inativa</span>'
                        }
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-brand-600 dark:text-brand-400">${formatPerc(
                      p.markup_percentage
                    )}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button type="button" title="Editar" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-3 edit-btn" data-item='${JSON.stringify(p).replace(
                          /'/g,
                          '&#39;'
                        )}'>
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button type="button" title="Duplicar" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mr-3 duplicate-btn" data-item='${JSON.stringify(p).replace(
                          /'/g,
                          '&#39;'
                        )}'>
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        </button>
                        <button type="button" title="Excluir" class="text-red-600 hover:text-red-900 dark:hover:text-red-400 delete-btn" data-id="${p.public_id}">
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </td>
                </tr>
            `
          )
          .join('');

        const selectAllBtn = getById('selectAll');
        if (selectAllBtn) {
          selectAllBtn.onchange = (e: any) => {
            document.querySelectorAll('.item-checkbox').forEach((cb: any) => {
              cb.checked = e.target.checked;
            });
          };
        }

        document.querySelectorAll('.item-checkbox').forEach((cb: any) => {
          cb.onchange = () => {
            if (!cb.checked && selectAllBtn) {
              selectAllBtn.checked = false;
            }
          };
        });
      },

      renderGrid: (items: any[]) => {
        const grid = getById('pricesGridSection');
        if (items.length === 0) {
          grid.innerHTML =
            '<div class="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">Nenhuma tabela encontrada.</div>';
          return;
        }

        grid.innerHTML = items
          .map(
            (p: any) => `
                <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col border ${
                  p.status === 'active'
                    ? 'border-brand-500/30'
                    : 'border-gray-200 dark:border-slate-700 opacity-70'
                } relative group">
                    <div class="absolute top-2 right-2 flex space-x-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" title="Editar" class="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-md transition-colors edit-btn" data-item='${JSON.stringify(
                          p
                        ).replace(/'/g, '&#39;')}'>
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button type="button" title="Duplicar" class="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-md transition-colors duplicate-btn" data-item='${JSON.stringify(
                          p
                        ).replace(/'/g, '&#39;')}'>
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z"></path></svg>
                        </button>
                        <button type="button" title="Excluir" class="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-md transition-colors delete-btn" data-id="${p.public_id}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                    
                    <div class="flex justify-between items-start mb-4 pr-20">
                        <h4 class="text-lg font-bold text-gray-900 dark:text-gray-100">${p.name}</h4>
                        ${
                          p.status === 'active'
                            ? '<span class="px-2 py-0.5 text-[10px] font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded">ATIVA</span>'
                            : '<span class="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 rounded">INATIVA</span>'
                        }
                    </div>
                    
                    <div class="mt-auto pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center">
                        <span class="text-xs text-gray-500 uppercase tracking-wide">Ajuste de Preço</span>
                        <span class="text-xl font-black text-brand-600 dark:text-brand-400">${formatPerc(
                          p.markup_percentage
                        )}</span>
                    </div>
                </div>
            `
          )
          .join('');
      },

      applyFilters: (data: any[]) => {
        const search = FilterPanel.normalizeText(getById('filterSearch')?.value);
        const status = getById('filterStatus')?.value || '';

        const filtered = data.filter((item: any) => {
          if (!FilterPanel.matchesSearch(item, ['name'], search)) return false;
          if (status && item.status !== status) return false;
          return true;
        });

        window.GridSummaryFooter?.update({
          footerId: 'pricesResultsFooter',
          anchorId: 'pricesGridSection',
          count: filtered.length,
          label: 'tabela(s) exibida(s)',
        });

        return filtered;
      },

      onEdit: (data: any) => {
        getById('priceForm').reset();
        const title = getById('modalTitle');
        const form = getById('priceForm');

        if (data && data.public_id) {
          title.textContent = 'Editar Tabela de Preço';
          getById('tableName').value = data.name || '';
          getById('tableMarkup').value = data.markup_percentage || '0.00';
          getById('tableStatus').value = data.status || 'active';
          form.dataset.id = data.public_id;
        } else if (data && data.name) {
          title.textContent = 'Duplicar Tabela de Preço';
          getById('tableName').value = data.name || '';
          getById('tableMarkup').value = data.markup_percentage || '0.00';
          getById('tableStatus').value = data.status || 'active';
          delete (form as any).dataset.id;
        } else {
          title.textContent = 'Nova Tabela de Preço';
          delete (form as any).dataset.id;
        }

        getById('priceModal').classList.remove('hidden');
      },
    });

    pricesManager.init();

    let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    getById('filterSearch')?.addEventListener('input', () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
      searchDebounceTimer = setTimeout(() => {
        pricesManager.applyFilters();
        searchDebounceTimer = null;
      }, 180);
    });
    getById('filterStatus')?.addEventListener('change', () => pricesManager.applyFilters());
  });

  // Form Logic (script runs at end of body)
  getById('priceForm')?.addEventListener('submit', async (e: any) => {
    e.preventDefault();

    const saveBtn = getById('saveBtn');
    const form = getById('priceForm');

    const parseMarkup = (val: any) => parseFloat(String(val).replace(',', '.')) || 0;

    const payload = {
      name: getById('tableName').value,
      markup_percentage: parseMarkup(getById('tableMarkup').value),
      status: getById('tableStatus').value,
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando...';

    try {
      if (form.dataset.id) {
        await (api as any)(`/estoque/prices/${form.dataset.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        (UI as any).showAlert('alertMessage', 'Tabela de preço atualizada com sucesso!', 'success');
      } else {
        await (api as any)('/estoque/prices', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        (UI as any).showAlert('alertMessage', 'Tabela de preço salva com sucesso!', 'success');
      }

      pricesManager.closeModal();
      pricesManager.loadData();
    } catch (error: any) {
      alert(error.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Salvar';
    }
  });
})();
