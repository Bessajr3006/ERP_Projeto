(() => {
  /**
   * company-groups.ts
   * Gerencia a tela de Grupos de Empresa no módulo Configuração
   */

  type CompanyGroup = {
    id?: number;
    public_id?: string;
    name?: string;
  };

  type Company = {
    id?: number;
    public_id?: string;
    trade_name?: string;
    company_name?: string;
    company_group_public_id?: string | null;
    company_group_name?: string | null;
    is_group_master?: boolean | number;
  };

  let g_groups: CompanyGroup[] = [];
  let g_companies: Company[] = [];
  let g_editingId: string | null = null;

  const api = (window as any).api;

  const getEl = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
    document.getElementById(id) as T | null;

  document.addEventListener('DOMContentLoaded', () => {
    void init();

    let currentView = (window as any).CompanyStorage?.getItem('companyGroupsView') || localStorage.getItem('companyGroupsView') || 'list';

    function updateViewToggle(): void {
      const btnList = getEl('btnListView');
      const btnGrid = getEl('btnGridView');
      const tableSection = getEl('companyGroupsSection');
      const gridSection = getEl('companyGroupsGridSection');

      if (tableSection && gridSection) {
        if (currentView === 'list') {
          tableSection.classList.remove('hidden');
          gridSection.classList.add('hidden');
        } else {
          tableSection.classList.add('hidden');
          gridSection.classList.remove('hidden');
        }
      }

      if (btnList && btnGrid) {
        btnList.className =
          'flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1';
        btnGrid.className =
          'flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1';

        if (currentView === 'list') {
          btnList.className =
            'flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1';
        } else {
          btnGrid.className =
            'flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1';
        }
      }
    }

    const btnListView = getEl('btnListView');
    btnListView?.addEventListener('click', () => {
      currentView = 'list';
      if ((window as any).CompanyStorage) {
        (window as any).CompanyStorage.setItem('companyGroupsView', 'list');
      } else {
        localStorage.setItem('companyGroupsView', 'list');
      }
      updateViewToggle();
    });

    const btnGridView = getEl('btnGridView');
    btnGridView?.addEventListener('click', () => {
      currentView = 'grid';
      if ((window as any).CompanyStorage) {
        (window as any).CompanyStorage.setItem('companyGroupsView', 'grid');
      } else {
        localStorage.setItem('companyGroupsView', 'grid');
      }
      updateViewToggle();
    });

    updateViewToggle();

    // Event Delegation: Ações na Tabela e Grid
    function handleGroupAction(e: Event): void {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest('button[data-action]') as HTMLButtonElement | null;
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');

      if (action === 'edit') (window as any).editGroup?.(id);
      if (action === 'delete') (window as any).deleteGroup?.(id);
      if (action === 'view-id') {
        const pid = btn.getAttribute('data-pid') || '';
        navigator.clipboard.writeText(pid).then(() => {
          if (btn.classList.contains('animating')) return;
          btn.classList.add('animating');

          const orig = btn.innerHTML;
          btn.classList.add('scale-75', 'opacity-0');

          setTimeout(() => {
            btn.innerHTML = `<svg class="animate-spin h-3.5 w-3.5 text-brand-600 dark:text-brand-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
            btn.classList.remove('scale-75', 'opacity-0');
          }, 150);

          setTimeout(() => {
            btn.classList.add('scale-75', 'opacity-0');
          }, 850);

          setTimeout(() => {
            btn.innerHTML = `<svg class="h-3.5 w-3.5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>`;
            btn.classList.remove('scale-75', 'opacity-0');
          }, 1000);

          setTimeout(() => {
            btn.classList.add('scale-75', 'opacity-0');
          }, 2350);

          setTimeout(() => {
            btn.innerHTML = orig;
            btn.classList.remove('scale-75', 'opacity-0', 'animating');
          }, 2500);
        });
      }
    }

    const tableBody = getEl('companyGroupsTable');
    tableBody?.addEventListener('click', handleGroupAction);

    const gridContainer = getEl('companyGroupsGridSection');
    gridContainer?.addEventListener('click', handleGroupAction);

    // Modal Control
    const btnOpenModal = getEl('btnOpenModal');
    btnOpenModal?.addEventListener('click', () => {
      openModal();
    });

    const btnCancelModal = getEl('btnCancelModal');
    btnCancelModal?.addEventListener('click', () => {
      closeModal();
    });

    const modalBackdrop = getEl('modalBackdrop');
    modalBackdrop?.addEventListener('click', () => {
      closeModal();
    });

    // Form Submit
    const form = getEl<HTMLFormElement>('companyGroupForm');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      void saveGroup();
    });
  });

  async function init(): Promise<void> {
    try {
      await fetchCompanies();
      await fetchGroups();
    } catch (e) {
      console.error('Falha na inicialização:', e);
    }
  }

  async function fetchCompanies(): Promise<void> {
    try {
      const res = await api('/companies');
      g_companies = res.data || [];
    } catch (error) {
      console.error('Erro ao buscar empresas:', error);
    }
  }

  async function fetchGroups(): Promise<void> {
    try {
      const res = await api('/company-groups');
      g_groups = res.data || [];
      render();
    } catch (error) {
      console.error('Erro ao buscar grupos de empresa:', error);
      showAlert('Erro ao listar grupos de empresa.', 'error');
    }
  }

  function openModal(groupPublicId: string | null = null): void {
    const modal = getEl('companyGroupModal');
    const modalTitle = getEl('modalTitle');
    const inputId = getEl<HTMLInputElement>('companyGroupId');
    const inputName = getEl<HTMLInputElement>('companyGroupName');
    const associationSection = getEl('companyAssociationSection');

    if (!modal || !modalTitle || !inputId || !inputName) return;

    g_editingId = groupPublicId;

    if (groupPublicId) {
      modalTitle.textContent = 'Editar Grupo de Empresa';
      const group = g_groups.find((g) => g.public_id === groupPublicId);
      if (group) {
        inputId.value = group.public_id || '';
        inputName.value = group.name || '';
      }
      if (associationSection) {
        associationSection.classList.remove('hidden');
        renderCompanyChecklist(groupPublicId);
      }
    } else {
      modalTitle.textContent = 'Cadastrar Grupo de Empresa';
      inputId.value = '';
      inputName.value = '';
      if (associationSection) associationSection.classList.add('hidden');
    }

    modal.classList.remove('hidden');
  }

  function closeModal(): void {
    const modal = getEl('companyGroupModal');
    modal?.classList.add('hidden');
    g_editingId = null;
  }

  function renderCompanyChecklist(groupPublicId: string): void {
    const container = getEl('companiesListContainer');
    if (!container) return;

    if (g_companies.length === 0) {
      container.innerHTML = `<span class="text-xs text-gray-500">Nenhuma empresa disponível.</span>`;
      return;
    }

    container.innerHTML = g_companies
      .map((c) => {
        const isChecked = c.company_group_public_id === groupPublicId;
        const isMaster = (c.is_group_master === true || (c.is_group_master as any) === 1) && isChecked;
        const otherGroupText = c.company_group_public_id && c.company_group_public_id !== groupPublicId
          ? `<span class="text-[10px] text-gray-400 dark:text-gray-500 ml-1.5 font-normal">(${c.company_group_name})</span>`
          : '';

        return `
        <div class="flex items-center justify-between p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700/30 gap-2 border-b border-gray-100 dark:border-slate-800 last:border-0">
            <label class="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                <input type="checkbox" class="chk-company-link rounded border-gray-300 text-brand-600 focus:ring-brand-500/30 dark:bg-slate-700 dark:border-slate-600"
                    value="${c.public_id}" ${isChecked ? 'checked' : ''} data-company-id="${c.public_id}">
                <span class="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">
                    ${c.trade_name || c.company_name}
                    ${otherGroupText}
                </span>
            </label>
            ${isChecked ? `
            <label class="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium ${isMaster ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-semibold' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'} cursor-pointer shrink-0 transition-colors" title="Marcar como Empresa Master do Grupo">
                <input type="checkbox" class="chk-company-master rounded border-amber-400 text-amber-600 focus:ring-amber-500/30 dark:bg-slate-700 dark:border-amber-600 h-3.5 w-3.5 cursor-pointer"
                    value="${c.public_id}" ${isMaster ? 'checked' : ''} data-company-id="${c.public_id}">
                <span>Master</span>
            </label>
            ` : ''}
        </div>
        `;
      })
      .join('');

    // Bind link checkboxes click events
    container.querySelectorAll('.chk-company-link').forEach((chk: any) => {
      chk.addEventListener('change', async () => {
        const companyId = chk.value;
        const checked = chk.checked;

        chk.disabled = true;
        try {
          await api('/company-groups/link-company', {
            method: 'POST',
            body: JSON.stringify({
              company_public_id: companyId,
              group_public_id: checked ? groupPublicId : null,
              is_group_master: false,
            }),
          });
          showAlert('Vínculo da empresa alterado com sucesso!', 'success');
          // Reload local lists
          await fetchCompanies();
          await fetchGroups();
          renderCompanyChecklist(groupPublicId);
        } catch (error: any) {
          console.error('Erro ao alterar vínculo da empresa:', error);
          showAlert(error?.message || 'Falha ao alterar vínculo.', 'error');
          chk.checked = !checked; // revert
        } finally {
          chk.disabled = false;
        }
      });
    });

    // Bind master checkboxes click events
    container.querySelectorAll('.chk-company-master').forEach((chkMaster: any) => {
      chkMaster.addEventListener('change', async () => {
        const companyId = chkMaster.value;
        const checked = chkMaster.checked;

        chkMaster.disabled = true;
        try {
          await api('/company-groups/link-company', {
            method: 'POST',
            body: JSON.stringify({
              company_public_id: companyId,
              group_public_id: groupPublicId,
              is_group_master: checked,
            }),
          });
          showAlert(checked ? 'Empresa definida como Master do grupo com sucesso!' : 'Status Master removido da empresa.', 'success');
          await fetchCompanies();
          await fetchGroups();
          renderCompanyChecklist(groupPublicId);
        } catch (error: any) {
          console.error('Erro ao alterar status Master:', error);
          showAlert(error?.message || 'Falha ao alterar status Master.', 'error');
          chkMaster.checked = !checked;
        } finally {
          chkMaster.disabled = false;
        }
      });
    });
  }

  async function saveGroup(): Promise<void> {
    const inputName = getEl<HTMLInputElement>('companyGroupName');
    if (!inputName) return;

    const name = inputName.value.trim();
    if (!name) return;

    const data = {
      name: name
    };

    const btn = getEl<HTMLButtonElement>('saveBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Salvando...';
    }

    try {
      if (g_editingId) {
        await api(`/company-groups/${g_editingId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        showAlert('Grupo de empresa atualizado com sucesso!', 'success');
      } else {
        await api('/company-groups', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        showAlert('Grupo de empresa cadastrado com sucesso!', 'success');
      }

      closeModal();
      await fetchGroups();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      showAlert(error?.message || 'Erro ao salvar grupo de empresa.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Gravar';
      }
    }
  }

  (window as any).editGroup = (id: string) => {
    openModal(id);
  };

  (window as any).deleteGroup = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este grupo de empresa? Todos os vínculos com empresas serão desfeitos.'))
      return;

    try {
      await api(`/company-groups/${id}`, {
        method: 'DELETE',
      });
      showAlert('Grupo de empresa excluído com sucesso!', 'success');
      await fetchCompanies();
      await fetchGroups();
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      showAlert(error?.message || 'Erro ao excluir grupo de empresa.', 'error');
    }
  };

  function render(): void {
    renderTable();
    renderGrid();

    // Footer stats
    const footerCount = document.querySelector('[data-grid-footer-count]');
    if (footerCount) {
      footerCount.textContent = String(g_groups.length);
    }
  }

  function getLinkedCompaniesText(groupPublicId: string): string {
    const list = g_companies.filter((c) => c.company_group_public_id === groupPublicId);
    if (list.length === 0) return '-';
    return list.map((c) => c.trade_name || c.company_name).join(', ');
  }

  function renderTable(): void {
    const tbody = getEl('companyGroupsTable');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (g_groups.length === 0) {
      tbody.innerHTML = `
            <tr>
                <td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhum grupo de empresa encontrado.
                </td>
            </tr>
        `;
      return;
    }

    tbody.innerHTML = g_groups
      .map((groupObj) => {
        const companiesText = getLinkedCompaniesText(groupObj.public_id!);
        return `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400 font-mono">#${String(
              groupObj.id || ''
            ).padStart(4, '0')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">
                <div>${groupObj.name || ''}</div>
                <div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    <span class="font-mono text-[10px] select-all">${groupObj.public_id || ''}</span>
                    <button type="button" data-action="view-id" data-id="${groupObj.public_id || ''}" data-pid="${groupObj.public_id || ''}" class="view-id-btn text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transform transition-all duration-200 ease-out" title="Copiar ID: ${groupObj.public_id || ''}">
                        <svg class="h-3.5 w-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                        </svg>
                    </button>
                </div>
            </td>
            <td class="px-6 py-4 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate" title="${companiesText}">
                ${companiesText}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                <div class="flex items-center justify-center space-x-3">
                    <button data-action="edit" data-id="${groupObj.public_id || ''}" class="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 transition-colors" title="Editar">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button data-action="delete" data-id="${groupObj.public_id || ''}" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors" title="Excluir">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </td>
        </tr>`;
      })
      .join('');
  }

  function renderGrid(): void {
    const grid = getEl('companyGroupsGridSection');
    if (!grid) return;

    grid.innerHTML = '';

    if (g_groups.length === 0) {
      grid.innerHTML = `
            <div class="col-span-full py-10 text-center text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700/60">
                Nenhum grupo de empresa cadastrado.
            </div>
        `;
      return;
    }

    grid.innerHTML = g_groups
      .map((groupObj) => {
        const companiesText = getLinkedCompaniesText(groupObj.public_id!);
        return `
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700/60 p-4 shadow-sm hover:shadow-md transition-shadow relative flex flex-col justify-between">
            <div>
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-mono text-gray-400 dark:text-gray-500 bg-gray-150 dark:bg-slate-900/60 py-0.5 px-1.5 rounded">#${String(
                      groupObj.id || ''
                    ).padStart(4, '0')}</span>
                    <div class="flex items-center space-x-2">
                        <button data-action="edit" data-id="${groupObj.public_id || ''}" class="text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors p-1" title="Editar">
                            <svg class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button data-action="delete" data-id="${groupObj.public_id || ''}" class="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1" title="Excluir">
                            <svg class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
                <h4 class="text-sm font-bold text-gray-900 dark:text-gray-100">${groupObj.name || ''}</h4>
                <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-2 font-medium">Empresas: <span class="font-normal">${companiesText}</span></p>
            </div>
            <div class="border-t border-gray-100 dark:border-slate-700/60 mt-3 pt-2.5 flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
                <span class="font-mono">${groupObj.public_id || ''}</span>
                <button type="button" data-action="view-id" data-id="${groupObj.public_id || ''}" data-pid="${groupObj.public_id || ''}" class="view-id-btn text-gray-400 hover:text-brand-600 dark:hover:text-brand-400" title="Copiar ID">
                    <svg class="h-3.5 w-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                    </svg>
                </button>
            </div>
        </div>
        `;
      })
      .join('');
  }

  function showAlert(msg: string, type: 'success' | 'error'): void {
    const alert = getEl('alertMessage');
    if (!alert) return;

    alert.textContent = msg;
    alert.className =
      type === 'success'
        ? 'mx-4 sm:mx-0 mb-4 p-4 rounded-xl text-sm bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50'
        : 'mx-4 sm:mx-0 mb-4 p-4 rounded-xl text-sm bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50';

    alert.classList.remove('hidden');

    setTimeout(() => {
      alert.classList.add('hidden');
    }, 5000);
  }
})();
