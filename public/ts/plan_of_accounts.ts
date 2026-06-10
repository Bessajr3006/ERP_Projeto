(() => {
  type AnyRecord = Record<string, any>;

  const AuthRef: any = (window as any).Auth;
  const CrudManagerRef: any = (window as any).CrudManager;
  const FilterPanel: any = (window as any).FilterPanel;
  const api: any = (window as any).api;
  const UI: any = (window as any).UI;

  let accountsManager: any;

  const getEl = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
    document.getElementById(id) as T | null;

  document.addEventListener('DOMContentLoaded', () => {
    if (AuthRef && !AuthRef.isAuthenticated()) {
      window.location.href = '/';
      return;
    }

    accountsManager = new CrudManagerRef({
      entityName: 'Conta Contábil',
      endpoint: '/accounting/chart-of-accounts',
      tableId: 'accountsTable',
      gridSectionId: 'accountsGridSection',
      tableSectionId: 'accountsSection',
      modalId: 'accountModal',

      filterConfig: {
        storageKey: 'accounts_filter_panel',
        footerId: 'accountsResultsFooter',
        fields: [{ id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Código ou Nome' }],
      },

      renderTable: (accounts: AnyRecord[]) => {
        const tableBody = getEl('accountsTable');
        if (!tableBody) return;

        if (!accounts || accounts.length === 0) {
          tableBody.innerHTML =
            '<tr><td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhuma conta contábil cadastrada.</td></tr>';
          return;
        }

        tableBody.innerHTML = accounts
          .map((account: AnyRecord) => {
            const isSynthetic = account.type === 'synthetic';
            const dotsCount = (String(account.code || '').match(/\./g) || []).length;
            const paddingLeft = Math.max(1, 1 + dotsCount * 1.5) + 'rem';

            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap">
                        <input type="checkbox" class="item-checkbox h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 dark:border-slate-600 rounded cursor-pointer" value="${
                          account.public_id
                        }" data-bwignore="true" data-lpignore="true" placeholder="">
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-600 dark:text-gray-400">
                        ${account.easy_code || '-'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium ${
                      isSynthetic ? 'text-brand-600 dark:text-brand-400' : 'text-gray-900 dark:text-gray-200'
                    }">${account.code}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm ${
                      isSynthetic
                        ? 'font-bold text-gray-900 dark:text-gray-100'
                        : 'text-gray-700 dark:text-gray-300'
                    }" style="padding-left: ${paddingLeft}">
                        ${account.name}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <span class="inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${
                          isSynthetic
                            ? 'bg-slate-800 text-white shadow-sm dark:bg-slate-200 dark:text-slate-900 border border-slate-900 dark:border-slate-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        }" title="${
                          isSynthetic ? 'Sintética (Somatória / Agrupadora)' : 'Analítica (Recebe Lançamentos)'
                        }">
                            ${isSynthetic ? 'S' : 'A'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        ${
                          account.nature === 'credit'
                            ? '<span class="text-orange-600 dark:text-orange-400" title="Credora">C</span>'
                            : '<span class="text-blue-600 dark:text-blue-400" title="Devedora">D</span>'
                        }
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        ${
                          account.status === 'active'
                            ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Ativo</span>'
                            : '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Inativo</span>'
                        }
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button type="button" title="Editar" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-3 edit-btn" data-id="${
                          account.public_id
                        }" data-item='${JSON.stringify(account).replace(/'/g, '&#39;')}'>
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button type="button" title="Duplicar" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mr-3 duplicate-btn" data-item='${JSON.stringify(
                          account
                        ).replace(/'/g, '&#39;')}'>
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        </button>
                        <button type="button" title="Excluir" class="text-red-600 hover:text-red-900 dark:hover:text-red-400 delete-btn" data-id="${
                          account.public_id
                        }">
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </td>
                </tr>
            `;
          })
          .join('');
      },

      renderGrid: (items: AnyRecord[]) => {
        const grid = getEl('accountsGridSection');
        if (!grid) return;

        if (items.length === 0) {
          grid.innerHTML =
            '<div class="col-span-full flex flex-col items-center justify-center py-12 gap-2"><svg class="w-10 h-10 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><p class="text-sm text-gray-400 dark:text-gray-500">Nenhuma conta encontrada.</p></div>';
          return;
        }

        grid.innerHTML = items
          .map(
            (account: AnyRecord) => `
                <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col border border-gray-100 dark:border-slate-700 relative group h-full">
                    <!-- Header Row (Checkbox, ID, and Actions) -->
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex items-center pt-1 z-10">
                            <input type="checkbox" class="item-checkbox h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 dark:border-slate-600 rounded cursor-pointer" value="${account.public_id}" data-bwignore="true" data-lpignore="true">
                            <span class="ml-2 text-xs font-mono text-gray-400 dark:text-gray-500">#${String(account.id).padStart(4, '0')}</span>
                        </div>
                        <div class="flex space-x-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10 -mr-1 -mt-1">
                            <button type="button" title="Editar" class="p-1.5 text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 edit-btn" data-item='${JSON.stringify(account).replace(/'/g, '&#39;')}'>
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </button>
                            <button type="button" title="Duplicar" class="p-1.5 text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 duplicate-btn" data-item='${JSON.stringify(account).replace(/'/g, '&#39;')}'>
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                            </button>
                            <button type="button" title="Excluir" class="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 delete-btn" data-id="${account.public_id}">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Content Block -->
                    <div class="flex-1 flex flex-col mt-0">
                        <div class="flex justify-between items-start gap-2 mb-2">
                            <h4 class="text-base font-bold ${account.type === 'synthetic' ? 'text-brand-600 dark:text-brand-400' : 'text-gray-900 dark:text-gray-100'} leading-tight break-words flex-1">
                                ${account.name}
                            </h4>
                            <span class="text-xs font-mono px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded text-gray-600 dark:text-gray-300 shrink-0 border border-gray-200 dark:border-slate-600">${account.code}</span>
                        </div>
                        
                        <div class="flex items-center gap-2 mb-4">
                            ${account.easy_code ? `<span class="text-xs font-mono px-2 py-1 bg-brand-50 dark:bg-brand-900/30 rounded text-brand-600 dark:text-brand-400 border border-brand-100 dark:border-brand-800/50">${account.easy_code}</span>` : ''}
                            <span class="text-xs font-bold ${account.nature === 'credit' ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'}">${account.nature === 'credit' ? 'Credor' : 'Devedor'}</span>
                        </div>
                        
                        <div class="mt-auto pt-3 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
                            <p class="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">
                                ${account.type === 'synthetic' ? 'S - Sintética' : 'A - Analítica'}
                            </p>
                            ${account.status === 'active' ? '<span class="w-2.5 h-2.5 bg-green-500 rounded-full shadow-sm" title="Ativo"></span>' : '<span class="w-2.5 h-2.5 bg-red-500 rounded-full shadow-sm" title="Inativo"></span>'}
                        </div>
                    </div>
                </div>
            `
          )
          .join('');
      },

      onEdit: (account: AnyRecord | null) => {
        const form = getEl<HTMLFormElement>('accountForm');
        form?.reset();

        const title = getEl('modalTitle');
        const codeInput = getEl<HTMLInputElement>('accountCode');
        const easyCodeInput = getEl<HTMLInputElement>('accountEasyCode');

        const setValue = (id: string, value: string) => {
          const el = getEl<HTMLInputElement | HTMLSelectElement>(id);
          if (el) (el as any).value = value;
        };

        if (account) {
          if (title) title.textContent = 'Editar Conta Contábil';
          setValue('accountPublicId', account.public_id || '');
          if (easyCodeInput) easyCodeInput.value = account.easy_code || '';
          if (codeInput) {
            codeInput.value = account.code || '';
            codeInput.disabled = true;
          }
          setValue('accountName', account.name || '');
          setValue('accountType', account.type || 'analytic');
          setValue('accountNature', account.nature || 'debit');
          setValue('accountStatus', account.status || 'active');
        } else {
          if (title) title.textContent = 'Cadastrar Conta';
          setValue('accountPublicId', '');
          if (easyCodeInput) easyCodeInput.value = '';
          if (codeInput) codeInput.disabled = false;
          setValue('accountType', 'analytic');
          setValue('accountNature', 'debit');
          setValue('accountStatus', 'active');
        }

        getEl('accountModal')?.classList.remove('hidden');
      },
    });

    accountsManager.init();

    // Save form
    getEl<HTMLFormElement>('accountForm')?.addEventListener('submit', async (e: Event) => {
      e.preventDefault();

      const saveBtn = getEl<HTMLButtonElement>('saveBtn');
      const publicId = getEl<HTMLInputElement>('accountPublicId')?.value || '';

      const payload = {
        code: (getEl<HTMLInputElement>('accountCode')?.value || '').trim(),
        easy_code: (getEl<HTMLInputElement>('accountEasyCode')?.value || '').trim() || null,
        name: (getEl<HTMLInputElement>('accountName')?.value || '').trim(),
        type: (getEl<HTMLSelectElement>('accountType')?.value || '').trim(),
        nature: (getEl<HTMLSelectElement>('accountNature')?.value || '').trim(),
        status: (getEl<HTMLSelectElement>('accountStatus')?.value || '').trim(),
      };

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';
      }

      try {
        if (publicId) {
          await api(`/accounting/chart-of-accounts/${publicId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          if (UI?.showAlert) UI.showAlert('alertMessage', 'Conta atualizada com sucesso!', 'success');
        } else {
          await api('/accounting/chart-of-accounts', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          if (UI?.showAlert) UI.showAlert('alertMessage', 'Conta registrada com sucesso!', 'success');
        }

        accountsManager.closeModal();
        await accountsManager.loadData();
      } catch (error: any) {
        alert('Erro ao salvar conta: ' + (error?.message || String(error)));
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Salvar';
        }
      }
    });

    // ==========================================
    // IMPORTAÇÃO CSV LOGIC
    // ==========================================
    const btnImportAccounts = getEl<HTMLButtonElement>('btnImportAccounts');
    const importModal = getEl('importModal');
    const importCsvFile = getEl<HTMLInputElement>('importCsvFile');
    const btnCancelImportModal = getEl<HTMLButtonElement>('btnCancelImportModal');
    const btnExecuteImport = getEl<HTMLButtonElement>('btnExecuteImport');
    const importMappingContainer = getEl('importMappingContainer');
    const importProgressContainer = getEl('importProgressContainer');
    const importFileContainer = getEl('importFileContainer');
    const mappingRows = getEl('mappingRows');
    const importProgressBar = getEl('importProgressBar');
    const importProgressText = getEl('importProgressText');
    const importErrors = getEl('importErrors');

    let parsedCsvData: AnyRecord[] = [];
    let csvHeaders: string[] = [];

    const dbFields: { id: string; label: string; required: boolean }[] = [
      { id: 'easy_code', label: 'Código Fácil', required: false },
      { id: 'code', label: 'Código (ex: 1.01)', required: true },
      { id: 'name', label: 'Nome da Conta', required: true },
      { id: 'type', label: 'Tipo (Sintética/Analítica)', required: true },
      { id: 'nature', label: 'Natureza (D/C)', required: false },
      { id: 'status', label: 'Status (Ativo/Inativo)', required: false },
    ];

    if (btnImportAccounts && importModal) {
      btnImportAccounts.addEventListener('click', () => {
        resetImportModal();
        importModal.classList.remove('hidden');
      });
    }

    const closeImportModal = () => {
      importModal?.classList.add('hidden');
      resetImportModal();
    };

    btnCancelImportModal?.addEventListener('click', closeImportModal);
    getEl('importModalBackdrop')?.addEventListener('click', closeImportModal);

    function resetImportModal(): void {
      if (importCsvFile) importCsvFile.value = '';
      parsedCsvData = [];
      csvHeaders = [];
      importMappingContainer?.classList.add('hidden');
      importProgressContainer?.classList.add('hidden');
      importFileContainer?.classList.remove('hidden');
      if (btnExecuteImport) btnExecuteImport.disabled = true;
      if (mappingRows) mappingRows.innerHTML = '';
      if (importErrors) {
        importErrors.innerHTML = '';
        importErrors.classList.add('hidden');
      }
      if (importProgressBar) (importProgressBar as HTMLElement).style.width = '0%';
      if (btnExecuteImport) btnExecuteImport.textContent = 'Iniciar Importação';
    }

    function parseCSV(text: string): string[][] {
      let delimiter = ',';

      let p = '';
      let row: string[] = [''];
      const ret: string[][] = [row];
      let i = 0;
      let r = 0;
      let s = true;
      let l = '';

      for (l of text) {
        if (l === '"') {
          if (s && l === p) row[i] += l;
          s = !s;
        } else if (l === delimiter && s) {
          row[++i] = '';
        } else if (l === '\n' && s) {
          if (p === '\r') row[i] = row[i].slice(0, -1);
          row = (ret[++r] = ['']);
          i = 0;
        } else {
          row[i] += l;
        }
        p = l;
      }

      return ret.filter((rr) => rr.some((c) => c.trim() !== ''));
    }

    if (importCsvFile) {
      importCsvFile.addEventListener('change', (e: Event) => {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
          const text = String((evt.target as FileReader).result || '');
          const rows = parseCSV(text);
          if (rows.length < 2) {
            alert('Arquivo CSV vazio ou sem dados suficientes.');
            return;
          }

          csvHeaders = rows[0].map((h) => String(h || '').trim());
          parsedCsvData = rows.map((rrow) => {
            const obj: AnyRecord = {};
            csvHeaders.forEach((h, idx) => {
              obj[h] = rrow[idx] ? String(rrow[idx]).trim() : '';
            });
            return obj;
          });

          renderMappingUI();
        };
        // Força a leitura no padrão de encoding Windows (ANSI) usado no Brasil para acentos
        reader.readAsText(file, 'windows-1252');
      });
    }

    function renderMappingUI(): void {
      importFileContainer?.classList.add('hidden');
      importMappingContainer?.classList.remove('hidden');
      if (btnExecuteImport) btnExecuteImport.disabled = false;

      if (!mappingRows) return;

      mappingRows.innerHTML = dbFields
        .map((dbF) => {
          const options = csvHeaders
            .map((h, idx) => {
              const hLower = String(h || '').toLowerCase();
              const selected = hLower.includes(dbF.id.substring(0, 3)) ? 'selected' : '';
              return `<option value="${h}" ${selected}>Coluna-${idx + 1}: ${h || 'Vazio'}</option>`;
            })
            .join('');

          return `
            <div class="flex items-center justify-between gap-4 p-2 bg-gray-50 dark:bg-slate-900/50 rounded border border-gray-100 dark:border-slate-700/50">
                <div class="w-1/2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    ${dbF.label} ${dbF.required ? '<span class="text-red-500">*</span>' : ''}
                </div>
                <div class="w-1/2">
                    <select id="map_${dbF.id}" class="block w-full text-xs bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 rounded shadow-sm focus:ring-brand-500 focus:border-brand-500 py-1.5 dark:text-gray-100">
                        <option value="">-- Ignorar ou Fixo Padrão --</option>
                        ${options}
                    </select>
                </div>
            </div>
        `;
        })
        .join('');
    }

    btnExecuteImport?.addEventListener('click', async () => {
      const mappings: AnyRecord = {};
      dbFields.forEach((f) => {
        const mapVal = (getEl<HTMLSelectElement>(`map_${f.id}`)?.value || '').trim();
        mappings[f.id] = mapVal;
      });

      importMappingContainer?.classList.add('hidden');
      importProgressContainer?.classList.remove('hidden');
      if (btnExecuteImport) btnExecuteImport.disabled = true;
      if (btnCancelImportModal) btnCancelImportModal.disabled = true;

      const total = parsedCsvData.length;
      let successC = 0;
      let errorC = 0;
      const errorLog: string[] = [];
      const accountsPayload: AnyRecord[] = [];

      const skipFirst = !!getEl<HTMLInputElement>('hasHeaderCheckbox')?.checked;
      const startIndex = skipFirst ? 1 : 0;

      for (let idx = startIndex; idx < total; idx++) {
        const row = parsedCsvData[idx];

        const easyCodeRaw = mappings.easy_code ? row[mappings.easy_code] : '';
        const codeRaw = mappings.code ? row[mappings.code] : '';
        const nameRaw = mappings.name ? row[mappings.name] : '';
        const typeStr = mappings.type ? row[mappings.type] || '' : 'analitica';
        const natureStr = mappings.nature ? row[mappings.nature] || '' : 'debito';
        const statusStr = mappings.status ? row[mappings.status] || '' : 'ativo';

        if (!codeRaw || !nameRaw) {
          errorLog.push(`Linha ${idx + 2}: Código ou Nome ausente.`);
          errorC++;
          continue;
        }

        const easy_code = easyCodeRaw ? String(easyCodeRaw).trim() : null;
        const code = String(codeRaw).trim();
        const name = String(nameRaw).trim();

        const isSynthetic =
          String(typeStr).toLowerCase().includes('sint') || String(typeStr).toLowerCase().startsWith('s');
        const type = isSynthetic ? 'synthetic' : 'analytic';

        const isCredit =
          String(natureStr).toLowerCase().includes('cred') || String(natureStr).toLowerCase() === 'c';
        const nature = isCredit ? 'credit' : 'debit';

        const isInactive = String(statusStr).toLowerCase().includes('inativ');
        const status = isInactive ? 'inactive' : 'active';

        accountsPayload.push({ code, easy_code, name, type, nature, status });
      }

      try {
        if (importProgressBar) (importProgressBar as HTMLElement).style.width = '50%';
        if (importProgressText) importProgressText.textContent = `Enviando ${accountsPayload.length} contas para o servidor...`;

        const response = await api('/accounting/chart-of-accounts/batch-import', {
          method: 'POST',
          body: JSON.stringify({ accounts: accountsPayload }),
        });

        if (importProgressBar) (importProgressBar as HTMLElement).style.width = '100%';
        successC = response?.data?.success;

        if (response?.data?.errors && response.data.errors.length > 0) {
          errorLog.push(...response.data.errors);
          errorC += response.data.errors.length;
        }

        if (importProgressText) {
          importProgressText.textContent = `Concluído! ${successC} atualizados/inseridos, ${errorC} falhas.`;
          importProgressText.classList.remove('text-gray-500');
          importProgressText.classList.add(errorC > 0 ? 'text-orange-500' : 'text-green-500');
        }

        if (errorLog.length > 0 && importErrors) {
          importErrors.innerHTML = errorLog.join('<br>');
          importErrors.classList.remove('hidden');
        }
      } catch (error: any) {
        if (importProgressBar) (importProgressBar as HTMLElement).style.width = '0%';
        if (importProgressText) importProgressText.textContent = 'Erro crítico na importação.';
        if (importErrors) {
          importErrors.innerHTML = error?.message || String(error);
          importErrors.classList.remove('hidden');
        }
      }

      if (btnCancelImportModal) {
        btnCancelImportModal.textContent = 'Fechar';
        btnCancelImportModal.disabled = false;
      }

      if (accountsManager) accountsManager.loadData();
    });

    // Batch Delete Logic
    const batchActions = getEl('batchActions');
    const btnBatchDelete = getEl<HTMLButtonElement>('btnBatchDelete');

    document.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (target.matches('.item-checkbox') || target.id === 'selectAll') {
        const anyChecked = document.querySelectorAll('.item-checkbox:checked').length > 0;
        if (batchActions) {
          if (anyChecked) batchActions.classList.remove('hidden');
          else batchActions.classList.add('hidden');
        }
      }
    });

    btnBatchDelete?.addEventListener('click', async () => {
      const checkedBoxes = Array.from(document.querySelectorAll<HTMLInputElement>('.item-checkbox:checked'));
      if (checkedBoxes.length === 0) return;

      if (!confirm(`Deseja realmente excluir ${checkedBoxes.length} contas selecionadas?`)) return;

      const publicIds = checkedBoxes.map((cb) => cb.value);

      try {
        btnBatchDelete.disabled = true;
        btnBatchDelete.classList.add('opacity-50');

        const response = await api('/accounting/chart-of-accounts/batch-delete', {
          method: 'POST',
          body: JSON.stringify({ ids: publicIds }),
        });

        if (UI?.showAlert) {
          UI.showAlert(
            'alertMessage',
            response?.message || `${publicIds.length} contas excluídas com sucesso.`,
            'success'
          );
        }

        const selectAll = getEl<HTMLInputElement>('selectAll');
        if (selectAll) selectAll.checked = false;
        batchActions?.classList.add('hidden');

        if (accountsManager) accountsManager.loadData();
      } catch (error: any) {
        alert('Erro ao excluir contas em lote: ' + (error?.message || String(error)));
      } finally {
        btnBatchDelete.disabled = false;
        btnBatchDelete.classList.remove('opacity-50');
      }
    });
  });
})();
