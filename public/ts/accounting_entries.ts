(() => {
  type AnyRecord = Record<string, any>;

  const AuthRef: any = (window as any).Auth;
  const api: any = (window as any).api;

  const getEl = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
    document.getElementById(id) as T | null;

  const formatCurrency = (val: any): string =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

  const formatDate = (dateStr: any): string => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = String(dateStr).split('T')[0].split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return String(dateStr);
    }
  };

  const escapeHtml = (val: any): string => {
    if (val === null || val === undefined) return '';
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  document.addEventListener('DOMContentLoaded', () => {
    void main();
  });

  async function main(): Promise<void> {
    // --- State ---
    let entries: AnyRecord[] = [];
    let fullAccountsList: AnyRecord[] = [];
    let accountsList: AnyRecord[] = [];
    const selectedIds = new Set<string>();
    let filters = { startDate: '', endDate: '', accountGroup: '', accountId: '', search: '' };
    // kept for compatibility with prior code; view toggle UI exists even if not fully used
    const viewMode = localStorage.getItem('entries_viewMode') || 'list';
    void viewMode;

    // --- Elements ---
    const els = {
      tableBody: getEl<HTMLTableSectionElement>('entriesTable'),
      selectAllCheckbox: getEl<HTMLInputElement>('selectAllCheckbox'),
      batchActions: getEl('batchActions'),
      btnBatchDelete: getEl<HTMLButtonElement>('btnBatchDelete'),
      batchDeleteCount: getEl('batchDeleteCount'),

      filterBody: getEl('filterBody'),
      toggleFilterBtn: getEl<HTMLButtonElement>('toggleFilterBtn'),
      filterChevron: getEl('filterChevron'),
      filterForm: getEl<HTMLFormElement>('filterForm'),
      filterStartDate: getEl<HTMLInputElement>('filterStartDate'),
      filterEndDate: getEl<HTMLInputElement>('filterEndDate'),
      filterAccountGroup: getEl<HTMLSelectElement>('filterAccountGroup'),
      filterAccountId: getEl<HTMLSelectElement>('filterAccountId'),
      filterSearch: getEl<HTMLInputElement>('filterSearch'),
      btnClearFilters: getEl<HTMLButtonElement>('btnClearFilters'),
      btnClearFiltersKeepDate: getEl<HTMLButtonElement>('btnClearFiltersKeepDate'),

      btnListView: getEl<HTMLButtonElement>('btnListView'),
      btnGridView: getEl<HTMLButtonElement>('btnGridView'),

      btnOpenModal: getEl<HTMLButtonElement>('btnOpenModal'),
      entryModal: getEl('entryModal'),
      entryModalBackdrop: getEl('entryModalBackdrop'),
      btnCancelEntry: getEl<HTMLButtonElement>('btnCancelEntry'),
      entryForm: getEl<HTMLFormElement>('entryForm'),

      btnOpenAutoModal: getEl<HTMLButtonElement>('btnOpenAutoModal'),
      autoEntryModal: getEl('autoEntryModal'),
      autoEntryModalBackdrop: getEl('autoEntryModalBackdrop'),
      btnCancelAutoEntry: getEl<HTMLButtonElement>('btnCancelAutoEntry'),
      autoEntryForm: getEl<HTMLFormElement>('autoEntryForm'),

      btnOpenImportModal: getEl<HTMLButtonElement>('btnOpenImportModal'),
      importModal: getEl('importModal'),
      importModalBackdrop: getEl('importModalBackdrop'),
      btnCancelImports: document.querySelectorAll<HTMLButtonElement>('.btnCancelImport'),

      footerCount: getEl('footerCount'),
      footerTotalDebit: getEl('footerTotalDebit'),
      footerTotalCredit: getEl('footerTotalCredit'),
    };

    if (!els.tableBody || !els.filterForm) return;

    // --- Init ---
    if (AuthRef && !AuthRef.isAuthenticated()) {
      window.location.href = '/';
      return;
    }

    // --- Filter toggle (setup imediato, antes do carregamento de dados) ---
    let filterIsOpen = false;
    if (els.filterBody && els.toggleFilterBtn) {
      els.filterBody.style.maxHeight = '0px';
      els.filterBody.style.overflow = 'hidden';
      if (els.filterChevron) {
        (els.filterChevron as HTMLElement).style.transform = 'rotate(-90deg)';
      }
      els.toggleFilterBtn.addEventListener('click', () => {
        filterIsOpen = !filterIsOpen;
        els.filterBody!.style.maxHeight = filterIsOpen ? `${els.filterBody!.scrollHeight}px` : '0px';
        if (els.filterChevron) {
          (els.filterChevron as HTMLElement).style.transform = filterIsOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
        }
      });
    }

    await Promise.all([loadRelations(), loadData()]);
    setupListeners();
    renderView();

    // --- Data Loaders ---
    async function loadRelations(): Promise<void> {
      try {
        const res = await api('/accounting/chart-of-accounts');
        if (res.data) {
          fullAccountsList = res.data;
          accountsList = res.data.filter((a: AnyRecord) => a.type === 'analytic' && a.status === 'active');
          populateAccountDropdowns();
        }
      } catch (e) {
        console.error('Erro Chart of accounts', e);
      }
    }

    async function loadData(): Promise<void> {
      try {
        els.tableBody!.innerHTML =
          '<tr><td colspan="7" class="text-center py-4 text-gray-500">Carregando...</td></tr>';
        const res = await api('/accounting/entries');
        entries = res.data || [];
        selectedIds.clear();
        renderView();
      } catch (e) {
        console.error('Erro loadData', e);
      }
    }

    // --- Render Logic ---
    function getFilteredEntries(): AnyRecord[] {
      if (!filters.startDate && !filters.endDate) return [];
      let data = entries;
      if (filters.startDate) data = data.filter((e: AnyRecord) => String(e.entry_date).split('T')[0] >= filters.startDate);
      if (filters.endDate) data = data.filter((e: AnyRecord) => String(e.entry_date).split('T')[0] <= filters.endDate);
      if (filters.accountId) {
        data = data.filter(
          (e: AnyRecord) =>
            String(e.debit_account_code).startsWith(filters.accountId) || String(e.credit_account_code).startsWith(filters.accountId)
        );
      } else if (filters.accountGroup) {
        data = data.filter(
          (e: AnyRecord) =>
            String(e.debit_account_code).startsWith(filters.accountGroup) ||
            String(e.credit_account_code).startsWith(filters.accountGroup)
        );
      }
      const search = String(filters.search).toLowerCase();
      if (search) {
        data = data.filter((e: AnyRecord) => {
          const str = [
            e.history,
            e.document_ref,
            e.debit_account_code,
            e.debit_account_name,
            e.credit_account_code,
            e.credit_account_name,
            String(e.amount),
          ]
            .map((v) => String(v || '').toLowerCase())
            .join(' ');
          return str.includes(search);
        });
      }
      return data;
    }

    function renderView(): void {
      if (!filters.startDate && !filters.endDate) {
        els.tableBody!.innerHTML =
          '<tr class="bg-gray-50 dark:bg-slate-800/50"><td colspan="7" class="text-center py-8 text-gray-500 dark:text-gray-400">Você precisa selecionar a <strong>Data Início</strong> ou <strong>Data Fim</strong> no Filtro para visualizar os Lançamentos Contábeis do período.</td></tr>';
        updateFooter([]);
        updateBatchActions();
        return;
      }

      const filtered = getFilteredEntries();
      if (filtered.length === 0) {
        els.tableBody!.innerHTML =
          '<tr><td colspan="7" class="text-center py-8 text-gray-500 dark:text-gray-400">Nenhum lançamento encontrado.</td></tr>';
      } else {
        els.tableBody!.innerHTML = filtered
          .map(
            (entry: AnyRecord) => `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td class="px-3 py-4"><input type="checkbox" class="row-checkbox rounded border-gray-300 dark:border-slate-600 dark:bg-slate-800 focus:ring-brand-500" value="${
                      entry.public_id
                    }" ${selectedIds.has(entry.public_id) ? 'checked' : ''}></td>
                    <td class="px-2 py-3 text-xs text-gray-500 dark:text-gray-400">${formatDate(entry.entry_date)}</td>
                    <td class="px-2 py-3 text-sm font-mono truncate text-gray-900 dark:text-gray-200">${
                      entry.document_ref || '-'
                    }</td>
                    <td class="px-2 py-2.5 text-xs">
                        <div class="flex flex-col gap-1 max-w-sm">
                            <div class="flex items-center gap-1.5 truncate" title="Débito: ${escapeHtml(entry.debit_account_code)} - ${escapeHtml(entry.debit_account_name || '')}">
                                <span class="inline-flex items-center px-1.5 py-0.2 rounded font-mono font-bold text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 shrink-0">D</span>
                                <span class="font-mono font-semibold text-blue-700 dark:text-blue-400 shrink-0">${escapeHtml(entry.debit_account_code)}</span>
                                <span class="text-gray-600 dark:text-gray-300 text-[11px] truncate font-medium">${escapeHtml(entry.debit_account_name || '')}</span>
                            </div>
                            <div class="flex items-center gap-1.5 truncate" title="Crédito: ${escapeHtml(entry.credit_account_code)} - ${escapeHtml(entry.credit_account_name || '')}">
                                <span class="inline-flex items-center px-1.5 py-0.2 rounded font-mono font-bold text-[10px] bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-300 shrink-0">C</span>
                                <span class="font-mono font-semibold text-orange-700 dark:text-orange-400 shrink-0">${escapeHtml(entry.credit_account_code)}</span>
                                <span class="text-gray-600 dark:text-gray-300 text-[11px] truncate font-medium">${escapeHtml(entry.credit_account_name || '')}</span>
                            </div>
                        </div>
                    </td>
                    <td class="px-2 py-3 text-sm font-bold text-right text-gray-900 dark:text-gray-100">${formatCurrency(
                      entry.amount
                    )}</td>
                    <td class="max-w-50 px-2 py-3 text-xs line-clamp-2 text-gray-700 dark:text-gray-300">${
                      entry.history
                    }</td>
                    <td class="px-2 py-3 whitespace-nowrap text-center text-sm font-medium">
                        <div class="flex items-center justify-center space-x-3">
                            <button type="button" class="btn-edit text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 transition-colors" data-id="${
                              entry.public_id
                            }" title="Editar">
                                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </button>
                            <button type="button" class="btn-delete text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors" data-id="${
                              entry.public_id
                            }" title="Excluir">
                                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `
          )
          .join('');

        // Row listeners
        els.tableBody!.querySelectorAll<HTMLInputElement>('.row-checkbox').forEach((cb) => {
          cb.addEventListener('change', (e: Event) => {
            const t = e.target as HTMLInputElement;
            if (t.checked) selectedIds.add(t.value);
            else selectedIds.delete(t.value);
            updateBatchActions();
          });
        });
        els.tableBody!.querySelectorAll<HTMLElement>('.btn-edit').forEach((btn) => {
          btn.addEventListener('click', () => openModal(btn.dataset.id || null));
        });
        els.tableBody!.querySelectorAll<HTMLElement>('.btn-delete').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            if (id) void deleteEntry(id);
          });
        });

        if (els.selectAllCheckbox) {
          els.selectAllCheckbox.checked = selectedIds.size > 0 && selectedIds.size === filtered.length;
        }
      }

      updateFooter(filtered);
      updateBatchActions();
    }

    function updateFooter(filtered: AnyRecord[]): void {
      if (els.footerCount) els.footerCount.textContent = String(filtered.length);
      const total = filtered.reduce((s: number, e: AnyRecord) => s + (parseFloat(e.amount) || 0), 0);
      if (els.footerTotalDebit) els.footerTotalDebit.textContent = formatCurrency(total);
      if (els.footerTotalCredit) els.footerTotalCredit.textContent = formatCurrency(total);
    }

    function updateBatchActions(): void {
      if (!els.batchActions || !els.batchDeleteCount) return;

      if (selectedIds.size > 0) {
        els.batchActions.classList.remove('hidden');
        els.batchActions.classList.add('flex');
        els.batchDeleteCount.textContent = String(selectedIds.size);
      } else {
        els.batchActions.classList.add('hidden');
        els.batchActions.classList.remove('flex');
      }
    }

    function populateAccountDropdowns(): void {
      const debitSelect = getEl<HTMLSelectElement>('debitAccountId');
      const creditSelect = getEl<HTMLSelectElement>('creditAccountId');

      const options = accountsList
        .map((a: AnyRecord) => `<option value="${a.public_id}">${a.code} - ${a.name}</option>`)
        .join('');

      if (debitSelect) debitSelect.innerHTML = '<option value="">Selecione...</option>' + options;
      if (creditSelect) creditSelect.innerHTML = '<option value="">Selecione...</option>' + options;

      // Filter account ID dropdown (shows codes)
      if (els.filterAccountId) {
        const filterOptions = fullAccountsList
          .map((a: AnyRecord) => `<option value="${a.code}">${a.code} - ${a.name}</option>`)
          .join('');
        els.filterAccountId.innerHTML = '<option value="">Todas Analíticas</option>' + filterOptions;
      }
    }

    // --- Listeners Setup ---
    function setupListeners(): void {
      // Apply / Clear Filters
      els.filterForm!.addEventListener('submit', (e: Event) => {
        e.preventDefault();
        filters = {
          startDate: els.filterStartDate?.value || '',
          endDate: els.filterEndDate?.value || '',
          accountGroup: els.filterAccountGroup?.value || '',
          accountId: els.filterAccountId?.value || '',
          search: els.filterSearch?.value || '',
        };
        selectedIds.clear();
        renderView();
      });

      els.btnClearFilters?.addEventListener('click', () => {
        els.filterForm?.reset();
        filters = { startDate: '', endDate: '', accountGroup: '', accountId: '', search: '' };
        selectedIds.clear();
        renderView();
      });

      els.btnClearFiltersKeepDate?.addEventListener('click', () => {
        if (els.filterAccountGroup) els.filterAccountGroup.value = '';
        if (els.filterAccountId) els.filterAccountId.value = '';
        if (els.filterSearch) els.filterSearch.value = '';

        filters = {
          startDate: els.filterStartDate?.value || '',
          endDate: els.filterEndDate?.value || '',
          accountGroup: '',
          accountId: '',
          search: '',
        };

        selectedIds.clear();
        renderView();
      });

      // Select All
      els.selectAllCheckbox?.addEventListener('change', (e: Event) => {
        const filtered = getFilteredEntries();
        const t = e.target as HTMLInputElement;
        if (t.checked) {
          filtered.forEach((entry: AnyRecord) => selectedIds.add(entry.public_id));
        } else {
          selectedIds.clear();
        }
        renderView();
      });

      // Delete Batch
      els.btnBatchDelete?.addEventListener('click', async () => {
        if (!confirm(`Deseja excluir ${selectedIds.size} lançamentos?`)) return;
        try {
          for (const id of selectedIds) {
            await api(`/accounting/entries/${id}`, { method: 'DELETE' });
          }
          await loadData();
        } catch (e: any) {
          alert(e?.message || String(e));
        }
      });

      // Modals Open/Close
      els.btnOpenModal?.addEventListener('click', () => openModal());
      els.btnCancelEntry?.addEventListener('click', closeModal);
      els.entryModalBackdrop?.addEventListener('click', closeModal);

      els.btnOpenAutoModal?.addEventListener('click', openAutoModal);
      els.btnCancelAutoEntry?.addEventListener('click', closeAutoModal);
      els.autoEntryModalBackdrop?.addEventListener('click', closeAutoModal);

      els.btnOpenImportModal?.addEventListener('click', openImportModal);
      els.importModalBackdrop?.addEventListener('click', closeImportModal);
      els.btnCancelImports.forEach((b) => b.addEventListener('click', closeImportModal));

      // Form Submit
      els.entryForm?.addEventListener('submit', async (e: Event) => {
        e.preventDefault();
        const amountRaw = parseFloat(getEl<HTMLInputElement>('entryAmount')?.value || '0');
        if (!amountRaw || amountRaw <= 0) {
          alert('Informe um valor positivo para o lançamento.');
          return;
        }
        const payload = {
          entry_date: getEl<HTMLInputElement>('entryDate')?.value || '',
          document_ref: getEl<HTMLInputElement>('documentRef')?.value || '',
          debit_account_id: getEl<HTMLSelectElement>('debitAccountId')?.value || '',
          credit_account_id: getEl<HTMLSelectElement>('creditAccountId')?.value || '',
          amount: amountRaw,
          history: getEl<HTMLTextAreaElement>('entryHistory')?.value || '',
        };
        const id = getEl<HTMLInputElement>('entryId')?.value || '';

        try {
          if (id) {
            await api(`/accounting/entries/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
          } else {
            await api('/accounting/entries', { method: 'POST', body: JSON.stringify(payload) });
          }
          closeModal();
          await loadData();
        } catch (e: any) {
          alert(e?.message || String(e));
        }
      });

      els.autoEntryForm?.addEventListener('submit', async (e: Event) => {
        e.preventDefault();
        const amountRaw = parseFloat(getEl<HTMLInputElement>('autoEntryAmount')?.value || '0');
        if (!amountRaw || amountRaw <= 0) {
          alert('Informe um valor positivo para o lançamento base.');
          return;
        }
        const payload = {
          code: getEl<HTMLInputElement>('autoEntryCode')?.value || '',
          entry_date: getEl<HTMLInputElement>('autoEntryDate')?.value || '',
          document_ref: getEl<HTMLInputElement>('autoDocumentRef')?.value || undefined,
          history_complement: getEl<HTMLTextAreaElement>('autoHistoryComplement')?.value || undefined,
          amount: amountRaw,
        };

        try {
          const res = await api('/accounting/entries/apply-auto', { method: 'POST', body: JSON.stringify(payload) });
          alert(res.message || 'Lançamentos gerados com sucesso!');
          closeAutoModal();
          await loadData();
        } catch (e: any) {
          alert(e?.message || String(e));
        }
      });

      setupImportLogic();
    }

    // --- Single Entry Logic ---
    function openModal(id: string | null = null): void {
      els.entryForm?.reset();
      const entryId = getEl<HTMLInputElement>('entryId');
      const entryDate = getEl<HTMLInputElement>('entryDate');
      const entryModalTitle = getEl('entryModalTitle');

      if (entryId) entryId.value = '';
      if (entryDate) entryDate.value = new Date().toISOString().split('T')[0];
      if (entryModalTitle) entryModalTitle.textContent = 'Novo Lançamento';

      if (id) {
        const entry = entries.find((e: AnyRecord) => e.public_id === id);
        if (entry) {
          if (entryId) entryId.value = entry.public_id;
          if (entryDate) entryDate.value = String(entry.entry_date).split('T')[0];

          const doc = getEl<HTMLInputElement>('documentRef');
          const debit = getEl<HTMLSelectElement>('debitAccountId');
          const credit = getEl<HTMLSelectElement>('creditAccountId');
          const amount = getEl<HTMLInputElement>('entryAmount');
          const history = getEl<HTMLTextAreaElement>('entryHistory');

          if (doc) doc.value = entry.document_ref || '';
          if (debit) debit.value = entry.debit_account_public_id;
          if (credit) credit.value = entry.credit_account_public_id;
          if (amount) amount.value = String(entry.amount);
          if (history) history.value = entry.history;
          if (entryModalTitle) entryModalTitle.textContent = 'Editar Lançamento';
        }
      }
      els.entryModal?.classList.remove('hidden');
    }

    function closeModal(): void {
      els.entryModal?.classList.add('hidden');
    }

    function openAutoModal(): void {
      els.autoEntryForm?.reset();
      const dateEl = getEl<HTMLInputElement>('autoEntryDate');
      if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
      els.autoEntryModal?.classList.remove('hidden');
    }

    function closeAutoModal(): void {
      els.autoEntryModal?.classList.add('hidden');
    }

    async function deleteEntry(id: string): Promise<void> {
      if (!confirm('Deseja excluir este lançamento?')) return;
      try {
        await api(`/accounting/entries/${id}`, { method: 'DELETE' });
        await loadData();
      } catch (e: any) {
        alert(e?.message || String(e));
      }
    }

    // --- Import Logic ---
    let importData: { step: string; csvHeaders: string[]; csvData: string[][]; mapping: AnyRecord } = {
      step: 'upload',
      csvHeaders: [],
      csvData: [],
      mapping: {},
    };

    function closeImportModal(): void {
      els.importModal?.classList.add('hidden');
    }

    function openImportModal(): void {
      importData = { step: 'upload', csvHeaders: [], csvData: [], mapping: {} };
      const file = getEl<HTMLInputElement>('importFile');
      if (file) file.value = '';
      getEl('importStepUpload')?.classList.remove('hidden');
      getEl('importStepMapping')?.classList.add('hidden');
      getEl('importStepProgress')?.classList.add('hidden');
      els.importModal?.classList.remove('hidden');
    }

    function setupImportLogic(): void {
      getEl<HTMLInputElement>('importFile')?.addEventListener('change', (e: Event) => {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          const text = String((evt.target as FileReader).result || '');
          importData.csvData = parseCSV(text);
          if (importData.csvData.length > 0) importData.csvHeaders = importData.csvData[0].map((h) => String(h).trim());
        };
        reader.readAsText(file, 'windows-1252');
      });

      getEl<HTMLButtonElement>('btnNextImportStep')?.addEventListener('click', () => {
        if (!importData.csvData.length) {
          alert('Carregue um arquivo CSV válido.');
          return;
        }
        renderMappingStep();
        getEl('importStepUpload')?.classList.add('hidden');
        getEl('importStepMapping')?.classList.remove('hidden');
      });

      getEl<HTMLButtonElement>('btnExecuteImport')?.addEventListener('click', () => {
        void executeImport();
      });
    }

    function parseCSV(text: string): string[][] {
      let delimiter = ',';
      const firstLine = text.split('\n')[0] || '';
      if (firstLine.split(';').length > firstLine.split(',').length) delimiter = ';';

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

      return ret.filter((ro) => ro.some((c) => c.trim() !== ''));
    }

    function renderMappingStep(): void {
      const fields = [
        { id: 'entry_date', label: 'Data' },
        { id: 'document_ref', label: 'Documento / Lote' },
        { id: 'debit_account_code', label: 'Cód. Conta Débito' },
        { id: 'credit_account_code', label: 'Cód. Conta Crédito' },
        { id: 'amount', label: 'Valor' },
        { id: 'history', label: 'Histórico' },
      ];

      let html = '';
      fields.forEach((f) => {
        let guess = -1;
        const fLow = f.id.toLowerCase();
        importData.csvHeaders.forEach((h, idx) => {
          const hl = String(h).toLowerCase();
          if (
            fLow.includes(hl) ||
            (hl.includes('valor') && fLow.includes('amount')) ||
            (hl.includes('data') && fLow.includes('date'))
          ) {
            guess = idx;
          }
        });

        const ops = importData.csvHeaders
          .map((h, idx) => `<option value="${idx}" ${guess === idx ? 'selected' : ''}>Col ${idx + 1}: ${h}</option>`)
          .join('');

        html += `<div class="flex justify-between items-center text-sm dark:text-gray-300">
                <span>${f.label}</span>
                <select id="map_${f.id}" class="w-1/2 border p-1 rounded dark:bg-slate-700 dark:border-slate-600">
                    <option value="-1">-- Ignorar --</option>${ops}
                </select>
            </div>`;
      });

      const container = getEl('mappingContainer');
      if (container) container.innerHTML = html;
    }

    async function executeImport(): Promise<void> {
      getEl('importStepMapping')?.classList.add('hidden');
      getEl('importStepProgress')?.classList.remove('hidden');

      const bar = getEl<HTMLElement>('importProgressBar');
      const txt = getEl('importProgressText');

      if (bar) bar.style.width = '10%';
      if (txt) txt.textContent = 'Processando...';

      const format = (document.querySelector('input[name="importFormat"]:checked') as HTMLInputElement | null)?.value;
      const hasHeader = !!getEl<HTMLInputElement>('importHasHeader')?.checked;
      const startIndex = hasHeader ? 1 : 0;

      const mappings = {
        entry_date: parseInt(getEl<HTMLSelectElement>('map_entry_date')?.value || '-1', 10),
        document_ref: parseInt(getEl<HTMLSelectElement>('map_document_ref')?.value || '-1', 10),
        debit_account_code: parseInt(getEl<HTMLSelectElement>('map_debit_account_code')?.value || '-1', 10),
        credit_account_code: parseInt(getEl<HTMLSelectElement>('map_credit_account_code')?.value || '-1', 10),
        amount: parseInt(getEl<HTMLSelectElement>('map_amount')?.value || '-1', 10),
        history: parseInt(getEl<HTMLSelectElement>('map_history')?.value || '-1', 10),
      };

      const payload: AnyRecord[] = [];

      const formatAmount = (v: any): number => {
        let c = String(v).replace('R$', '').replace(/\s/g, '').trim();
        if (c.includes(',')) c = c.replace(/\./g, '').replace(',', '.');
        return parseFloat(c) || 0;
      };

      const formatDt = (d: any): string => {
        let str = String(d).trim();
        if (str.includes('/')) {
          const parts = str.split('/');
          if (parts.length === 3) str = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return str;
      };

      const today = new Date().toISOString().split('T')[0];

      if (format === 'single') {
        for (let i = startIndex; i < importData.csvData.length; i++) {
          const row = importData.csvData[i];
          payload.push({
            entry_date: formatDt(mappings.entry_date !== -1 ? row[mappings.entry_date] : today),
            document_ref: mappings.document_ref !== -1 ? String(row[mappings.document_ref]).trim() : null,
            debit_account_code: mappings.debit_account_code !== -1 ? String(row[mappings.debit_account_code]).trim() : '',
            credit_account_code:
              mappings.credit_account_code !== -1 ? String(row[mappings.credit_account_code]).trim() : '',
            amount: formatAmount(mappings.amount !== -1 ? row[mappings.amount] : 0),
            history: mappings.history !== -1 ? String(row[mappings.history]).trim() : 'Lançamento Importado',
          });
        }
      } else {
        const groups: Record<string, AnyRecord[]> = {};
        for (let i = startIndex; i < importData.csvData.length; i++) {
          const row = importData.csvData[i];
          const docRaw = mappings.document_ref !== -1 ? row[mappings.document_ref] : null;
          const docID = docRaw ? String(docRaw).trim() : `Lote-${i}`;
          if (!groups[docID]) groups[docID] = [];
          groups[docID].push({
            date: formatDt(mappings.entry_date !== -1 ? row[mappings.entry_date] : today),
            doc: docID,
            deb: mappings.debit_account_code !== -1 ? String(row[mappings.debit_account_code]).trim() : '',
            cred: mappings.credit_account_code !== -1 ? String(row[mappings.credit_account_code]).trim() : '',
            amt: formatAmount(mappings.amount !== -1 ? row[mappings.amount] : 0),
            hist: mappings.history !== -1 ? String(row[mappings.history]).trim() : 'Lançamento Consolidado',
          });
        }

        for (const gKey of Object.keys(groups)) {
          const gLines = groups[gKey];
          const debits = gLines.filter((l) => l.deb !== '');
          const credits = gLines.filter((l) => l.cred !== '');
          const amt = Math.max(...gLines.map((l) => l.amt), 0);
          payload.push({
            entry_date: gLines[0].date,
            document_ref: gLines[0].doc,
            debit_account_code: debits.length > 0 ? debits[0].deb : '',
            credit_account_code: credits.length > 0 ? credits[0].cred : '',
            amount: amt || 0,
            history: gLines[0].hist,
          });
        }
      }

      if (payload.length === 0) {
        if (bar) bar.style.width = '0%';
        if (txt) txt.textContent = 'Erro: Nenhum lançamento válido.';
        return;
      }

      try {
        if (bar) bar.style.width = '50%';
        if (txt) txt.textContent = `Enviando ${payload.length} lançamentos...`;

        const response = await api('/accounting/entries/batch-import', {
          method: 'POST',
          body: JSON.stringify({ entries: payload, matchBy: 'code' }),
        });

        if (bar) bar.style.width = '100%';
        if (txt) txt.textContent = `Concluído! ${response.data?.success || 0} criados.`;

        // Add handler so close button refreshes data
        document.querySelectorAll<HTMLButtonElement>('.btnCancelImport').forEach((b) => {
          const old = b.onclick;
          b.onclick = async () => {
            if (old) (old as any).call(b);
            await loadData();
            b.onclick = old;
            closeImportModal();
          };
        });
      } catch (e: any) {
        if (bar) bar.style.width = '0%';
        if (txt) txt.textContent = `Erro: (API) ${e?.message || String(e)}`;
      }
    }

    // ==========================================
    // SOLIDCON ENTRIES INTEGRATION LOGIC
    // ==========================================
    const solidconEls = {
      btnModal: getEl<HTMLButtonElement>('btnSolidconEntriesModal'),
      modal: getEl('solidconEntriesModal'),
      backdrop: getEl('solidconEntriesModalBackdrop'),
      btnCloseIcon: getEl<HTMLButtonElement>('btnCloseSolidconEntriesModalIcon'),
      btnClose: getEl<HTMLButtonElement>('btnCloseSolidconEntriesModal'),
      connSelect: getEl<HTMLSelectElement>('solidconEntriesConnSelect'),
      sourceSelect: getEl<HTMLSelectElement>('solidconEntriesSourceSelect'),
      startDate: getEl<HTMLInputElement>('solidconEntriesStartDate'),
      endDate: getEl<HTMLInputElement>('solidconEntriesEndDate'),
      filialInput: getEl<HTMLInputElement>('solidconEntriesFilialInput'),
      statusBadge: getEl('solidconEntriesStatusBadge'),
      btnReload: getEl<HTMLButtonElement>('btnReloadSolidconEntries'),
      reloadIcon: getEl('solidconEntriesReloadIcon'),
      btnVerify: getEl<HTMLButtonElement>('btnVerifySolidconEntries'),
      verifyIcon: getEl('solidconEntriesVerifyIcon'),
      defaultDebit: getEl<HTMLSelectElement>('solidconDefaultDebitSelect'),
      defaultCredit: getEl<HTMLSelectElement>('solidconDefaultCreditSelect'),
      btnApplyDefaults: getEl<HTMLButtonElement>('btnApplyDefaultAccounts'),
      alertBox: getEl('solidconEntriesAlertBox'),
      searchInput: getEl<HTMLInputElement>('solidconEntriesSearchInput'),
      opFilter: getEl<HTMLSelectElement>('solidconEntriesOpFilter'),
      validationFilter: getEl<HTMLSelectElement>('solidconEntriesValidationFilter'),
      btnSelectOnlyValid: getEl<HTMLButtonElement>('btnSelectOnlyValidSolidcon'),
      selectionCount: getEl('solidconEntriesSelectionCount'),
      selectAll: getEl<HTMLInputElement>('solidconEntriesSelectAll'),
      table: getEl('solidconEntriesTable'),
      totalCountBadge: getEl('solidconEntriesTotalCountBadge'),
      totalAmountBadge: getEl('solidconEntriesTotalAmountBadge'),
      btnImportSelected: getEl<HTMLButtonElement>('btnImportSelectedSolidconEntries'),
      btnImportSelectedText: getEl('btnImportSelectedSolidconEntriesText'),
      btnImportAll: getEl<HTMLButtonElement>('btnImportAllSolidconEntries'),
    };

    let solidconRawEntries: AnyRecord[] = [];
    let filteredSolidconEntries: AnyRecord[] = [];
    const selectedSolidconEntryIds = new Set<string>();
    const solidconVerificationMap = new Map<string, {
      id: string;
      isValid: boolean;
      isDuplicate: boolean;
      duplicateReason: string;
      errors: string[];
      warnings: string[];
      status: 'valid' | 'error' | 'duplicate';
    }>();
    let isSolidconLoading = false;
    let isSolidconVerifying = false;
    let hasSearchedSolidcon = false;

    const showSolidconAlert = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      if (!solidconEls.alertBox) return;
      solidconEls.alertBox.classList.remove(
        'hidden',
        'bg-green-50', 'text-green-800', 'dark:bg-green-950/40', 'dark:text-green-300', 'border-green-200', 'dark:border-green-800',
        'bg-red-50', 'text-red-800', 'dark:bg-red-950/40', 'dark:text-red-300', 'border-red-200', 'dark:border-red-800',
        'bg-blue-50', 'text-blue-800', 'dark:bg-blue-950/40', 'dark:text-blue-300', 'border-blue-200', 'dark:border-blue-800'
      );
      if (type === 'success') {
        solidconEls.alertBox.classList.add('bg-green-50', 'text-green-800', 'dark:bg-green-950/40', 'dark:text-green-300', 'border', 'border-green-200', 'dark:border-green-800');
      } else if (type === 'error') {
        solidconEls.alertBox.classList.add('bg-red-50', 'text-red-800', 'dark:bg-red-950/40', 'dark:text-red-300', 'border', 'border-red-200', 'dark:border-red-800');
      } else {
        solidconEls.alertBox.classList.add('bg-blue-50', 'text-blue-800', 'dark:bg-blue-950/40', 'dark:text-blue-300', 'border', 'border-blue-200', 'dark:border-blue-800');
      }
      solidconEls.alertBox.innerHTML = message;
    };

    const hideSolidconAlert = () => {
      if (solidconEls.alertBox) solidconEls.alertBox.classList.add('hidden');
    };

    const updateSolidconStatusBadge = (status: 'loading' | 'connected' | 'error' | 'idle', text?: string) => {
      if (!solidconEls.statusBadge) return;
      if (status === 'loading') {
        solidconEls.statusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
        solidconEls.statusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span> ' + (text || 'Consultando...');
      } else if (status === 'connected') {
        solidconEls.statusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
        solidconEls.statusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span> ' + (text || 'Conectado');
      } else if (status === 'error') {
        solidconEls.statusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800';
        solidconEls.statusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-500"></span> ' + (text || 'Falha');
      } else {
        solidconEls.statusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700';
        solidconEls.statusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-gray-400"></span> ' + (text || 'Aguardando');
      }
    };

    const populateSolidconDefaultAccountDropdowns = () => {
      const optionsHtml = '<option value="">-- Selecionar Conta Analítica --</option>' +
        accountsList.map((a) => `<option value="${a.code}">${a.code} - ${a.name}</option>`).join('');

      if (solidconEls.defaultDebit) {
        solidconEls.defaultDebit.innerHTML = '<option value="">Manter / Selecionar Débito...</option>' +
          accountsList.map((a) => `<option value="${a.code}">${a.code} - ${a.name}</option>`).join('');
      }
      if (solidconEls.defaultCredit) {
        solidconEls.defaultCredit.innerHTML = '<option value="">Manter / Selecionar Crédito...</option>' +
          accountsList.map((a) => `<option value="${a.code}">${a.code} - ${a.name}</option>`).join('');
      }
    };

    const loadSolidconConnections = async () => {
      if (!solidconEls.connSelect) return;
      try {
        const response = await api('/accounting/solidcon-connections');
        const connections = response?.data || [];
        solidconEls.connSelect.innerHTML = '';

        if (connections.length === 0) {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = 'Padrão da Empresa (solidcon)';
          solidconEls.connSelect.appendChild(opt);
        } else {
          connections.forEach((conn: AnyRecord) => {
            const opt = document.createElement('option');
            opt.value = String(conn.id);
            opt.textContent = `${conn.name || 'Conexão'} (${conn.serv_solidcon || ''}/${conn.bd_solidcon || 'solidcon'})`;
            solidconEls.connSelect!.appendChild(opt);
          });
        }
      } catch (err: any) {
        console.warn('Erro ao listar conexões Solidcon:', err);
        solidconEls.connSelect.innerHTML = '<option value="">Padrão da Empresa (solidcon)</option>';
      }
    };

    const renderSolidconEntriesTable = () => {
      if (!solidconEls.table) return;

      if (isSolidconLoading) {
        solidconEls.table.innerHTML = `
          <tr>
            <td colspan="9" class="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
              <div class="inline-flex items-center gap-2">
                <svg class="animate-spin h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Consultando banco de dados Solidcon...</span>
              </div>
            </td>
          </tr>
        `;
        return;
      }

      if (filteredSolidconEntries.length === 0) {
        const emptyMsg = !hasSearchedSolidcon
          ? 'Selecione o período e clique em "Consultar" para buscar movimentações no Solidcon.'
          : (solidconRawEntries.length === 0
            ? 'Nenhum movimento encontrado no Solidcon para o período selecionado.'
            : 'Nenhum movimento corresponde ao filtro de busca.');
        solidconEls.table.innerHTML = `
          <tr>
            <td colspan="9" class="px-4 py-12 text-center text-gray-400 dark:text-gray-500">
              ${emptyMsg}
            </td>
          </tr>
        `;
        updateSolidconEntriesSelectionSummary();
        return;
      }

      solidconEls.table.innerHTML = filteredSolidconEntries
        .map((entry: AnyRecord) => {
          const id = String(entry.id);
          const isSelected = selectedSolidconEntryIds.has(id);
          const dateStr = formatDate(entry.entry_date);
          const amtFormatted = formatCurrency(entry.amount);
          const isDebit = entry.bank_operation === 'debit';
          const isCredit = entry.bank_operation === 'credit';
          const verif = solidconVerificationMap.get(id);

          let sourceBadge = '';
          if (entry.source === 'cnt_lancamento') {
            sourceBadge = '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">Contábil</span>';
          } else if (entry.source === 'banco_movimento') {
            sourceBadge = '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">Bancário</span>';
          } else {
            sourceBadge = '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300">Baixa</span>';
          }

          let rowClasses = 'transition-colors';
          let statusCellHtml = '';

          if (verif) {
            if (verif.isValid) {
              // MARCA DE VERDE: Lançamento Correto
              rowClasses = 'bg-emerald-50/70 dark:bg-emerald-950/30 border-l-4 border-l-emerald-500 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40';
              statusCellHtml = `
                <div class="flex flex-col items-center">
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                    <svg class="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                    Correto
                  </span>
                  ${verif.warnings.length > 0 ? `<span class="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5" title="${escapeHtml(verif.warnings.join('; '))}">${escapeHtml(verif.warnings[0])}</span>` : ''}
                </div>
              `;
            } else if (verif.isDuplicate) {
              // MARCA DE VERMELHO: Lançamento Duplicado
              rowClasses = 'bg-red-50/70 dark:bg-red-950/30 border-l-4 border-l-red-500 hover:bg-red-100/70 dark:hover:bg-red-900/40';
              statusCellHtml = `
                <div class="flex flex-col items-center max-w-44 text-center">
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300">
                    <svg class="w-3 h-3 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    Duplicado
                  </span>
                  <span class="text-[10px] text-red-700 dark:text-red-300 mt-0.5 leading-tight font-medium" title="${escapeHtml(verif.duplicateReason)}">${escapeHtml(verif.duplicateReason)}</span>
                </div>
              `;
            } else {
              // MARCA DE VERMELHO: Conta Errada / Inconsistência
              rowClasses = 'bg-red-50/70 dark:bg-red-950/30 border-l-4 border-l-red-500 hover:bg-red-100/70 dark:hover:bg-red-900/40';
              const errDetail = verif.errors.join('; ');
              statusCellHtml = `
                <div class="flex flex-col items-center max-w-44 text-center">
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300">
                    <svg class="w-3 h-3 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    Conta Inválida
                  </span>
                  <span class="text-[10px] text-red-700 dark:text-red-300 mt-0.5 leading-tight font-medium" title="${escapeHtml(errDetail)}">${escapeHtml(verif.errors[0] || 'Inconsistência')}</span>
                </div>
              `;
            }
          } else {
            statusCellHtml = `<span class="text-gray-400 dark:text-gray-500 text-[11px] italic">Não verificado</span>`;
            rowClasses = `hover:bg-emerald-50/40 dark:hover:bg-slate-700/50 ${isSelected ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}`;
          }

          const debitDisplay = entry.debit_account_code
            ? `<span class="font-mono font-medium text-emerald-700 dark:text-emerald-400">${escapeHtml(entry.debit_account_code)}</span> <span class="text-gray-500 dark:text-gray-400 text-[11px]">${escapeHtml(entry.debit_account_name || '')}</span>`
            : '<span class="text-amber-600 dark:text-amber-400 italic text-[11px]">Pendente (selecione)</span>';

          const creditDisplay = entry.credit_account_code
            ? `<span class="font-mono font-medium text-blue-700 dark:text-blue-400">${escapeHtml(entry.credit_account_code)}</span> <span class="text-gray-500 dark:text-gray-400 text-[11px]">${escapeHtml(entry.credit_account_name || '')}</span>`
            : '<span class="text-amber-600 dark:text-amber-400 italic text-[11px]">Pendente (selecione)</span>';

          return `
            <tr class="${rowClasses}">
              <td class="px-3 py-2.5 whitespace-nowrap">
                <input type="checkbox" class="solidcon-entry-checkbox h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-slate-600 rounded cursor-pointer"
                  data-id="${id}" ${isSelected ? 'checked' : ''}>
              </td>
              <td class="px-3 py-2.5 whitespace-nowrap font-mono text-gray-700 dark:text-gray-300">
                ${dateStr}
              </td>
              <td class="px-3 py-2.5 whitespace-nowrap text-center">
                ${sourceBadge}
              </td>
              <td class="px-3 py-2.5 whitespace-nowrap font-mono text-gray-500 dark:text-gray-400">
                ${escapeHtml(entry.document_ref || '-')}
              </td>
              <td class="px-3 py-2.5 text-left text-xs">
                ${debitDisplay}
              </td>
              <td class="px-3 py-2.5 text-left text-xs">
                ${creditDisplay}
              </td>
              <td class="px-3 py-2.5 whitespace-nowrap text-right font-mono font-bold ${isDebit ? 'text-blue-700 dark:text-blue-400' : (isCredit ? 'text-orange-700 dark:text-orange-400' : 'text-gray-900 dark:text-gray-100')}">
                ${amtFormatted}
              </td>
              <td class="px-3 py-2.5 text-left text-gray-700 dark:text-gray-300 max-w-xs truncate" title="${escapeHtml(entry.history || '')}">
                ${escapeHtml(entry.history || '-')}
              </td>
              <td class="px-3 py-2.5 whitespace-nowrap text-center">
                ${statusCellHtml}
              </td>
            </tr>
          `;
        })
        .join('');

      updateSolidconEntriesSelectionSummary();
    };

    const applySolidconEntriesFilters = () => {
      const searchTerm = (solidconEls.searchInput?.value || '').trim().toLowerCase();
      const opFilter = solidconEls.opFilter?.value || 'all';
      const valFilter = solidconEls.validationFilter?.value || 'all';

      filteredSolidconEntries = solidconRawEntries.filter((entry) => {
        const id = String(entry.id);
        const doc = String(entry.document_ref || '').toLowerCase();
        const hist = String(entry.history || '').toLowerCase();
        const bank = String(entry.bank_name || '').toLowerCase();
        const debCode = String(entry.debit_account_code || '').toLowerCase();
        const debName = String(entry.debit_account_name || '').toLowerCase();
        const credCode = String(entry.credit_account_code || '').toLowerCase();
        const credName = String(entry.credit_account_name || '').toLowerCase();

        if (searchTerm) {
          const match = doc.includes(searchTerm) || hist.includes(searchTerm) || bank.includes(searchTerm) ||
            debCode.includes(searchTerm) || debName.includes(searchTerm) || credCode.includes(searchTerm) || credName.includes(searchTerm);
          if (!match) return false;
        }

        if (opFilter === 'debit' && entry.bank_operation !== 'debit') return false;
        if (opFilter === 'credit' && entry.bank_operation !== 'credit') return false;

        if (valFilter === 'valid') {
          const v = solidconVerificationMap.get(id);
          if (!v || !v.isValid) return false;
        } else if (valFilter === 'invalid') {
          const v = solidconVerificationMap.get(id);
          if (!v || v.isValid) return false;
        }

        return true;
      });

      renderSolidconEntriesTable();
    };

    const updateSolidconEntriesSelectionSummary = () => {
      const totalFiltered = filteredSolidconEntries.length;
      const count = selectedSolidconEntryIds.size;

      let sumTotal = 0;
      filteredSolidconEntries.forEach((e) => {
        if (selectedSolidconEntryIds.has(String(e.id))) {
          sumTotal += Number(e.amount) || 0;
        }
      });

      if (solidconEls.selectionCount) {
        solidconEls.selectionCount.textContent = `${count} de ${totalFiltered} selecionado(s)`;
      }
      if (solidconEls.totalCountBadge) {
        solidconEls.totalCountBadge.textContent = String(totalFiltered);
      }
      if (solidconEls.totalAmountBadge) {
        solidconEls.totalAmountBadge.textContent = formatCurrency(sumTotal);
      }

      if (solidconEls.btnImportSelected) {
        solidconEls.btnImportSelected.disabled = count === 0 || isSolidconLoading || isSolidconVerifying;
      }
      if (solidconEls.btnImportSelectedText) {
        solidconEls.btnImportSelectedText.textContent = count > 0 ? `Importar Selecionados (${count})` : 'Importar Selecionados';
      }
      if (solidconEls.btnImportAll) {
        solidconEls.btnImportAll.disabled = totalFiltered === 0 || isSolidconLoading || isSolidconVerifying;
      }
      if (solidconEls.btnVerify) {
        solidconEls.btnVerify.disabled = solidconRawEntries.length === 0 || isSolidconLoading || isSolidconVerifying;
      }

      if (solidconEls.selectAll) {
        const allVisibleSelected = totalFiltered > 0 && filteredSolidconEntries.every((e) => selectedSolidconEntryIds.has(String(e.id)));
        solidconEls.selectAll.checked = allVisibleSelected;
      }
    };

    const loadSolidconEntries = async () => {
      const start = solidconEls.startDate?.value || '';
      const end = solidconEls.endDate?.value || '';

      if (!start || !end) {
        showSolidconAlert('Por favor, informe a Data Início e a Data Fim.', 'error');
        return;
      }

      hasSearchedSolidcon = true;
      isSolidconLoading = true;
      solidconVerificationMap.clear();
      if (solidconEls.btnSelectOnlyValid) solidconEls.btnSelectOnlyValid.classList.add('hidden');
      if (solidconEls.validationFilter) solidconEls.validationFilter.value = 'all';

      hideSolidconAlert();
      updateSolidconStatusBadge('loading', 'Consultando...');
      if (solidconEls.reloadIcon) solidconEls.reloadIcon.classList.add('animate-spin');
      if (solidconEls.btnReload) solidconEls.btnReload.disabled = true;

      renderSolidconEntriesTable();

      try {
        const connId = solidconEls.connSelect?.value || '';
        const source = solidconEls.sourceSelect?.value || 'all';
        const filial = solidconEls.filialInput?.value || '';

        let url = `/accounting/solidcon-entries?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}&source=${encodeURIComponent(source)}`;
        if (connId) url += `&connectionId=${encodeURIComponent(connId)}`;
        if (filial) url += `&cdFilial=${encodeURIComponent(filial)}`;

        const response = await api(url);
        solidconRawEntries = response?.data || [];

        updateSolidconStatusBadge('connected', `Conectado (${solidconRawEntries.length} movimentos)`);
        showSolidconAlert(`Consulta realizada com sucesso! <strong>${solidconRawEntries.length}</strong> movimentos retornados do Solidcon. Clique em <strong>"Verificar Lançamentos"</strong> para auditar contas e duplicidades.`, 'success');

        selectedSolidconEntryIds.clear();
        // Select all by default
        solidconRawEntries.forEach((e) => selectedSolidconEntryIds.add(String(e.id)));

        isSolidconLoading = false;
        applySolidconEntriesFilters();
      } catch (error: any) {
        isSolidconLoading = false;
        const msg = error?.message || String(error);
        updateSolidconStatusBadge('error', 'Falha ao Consultar');
        showSolidconAlert(`Erro ao consultar Solidcon: ${msg}`, 'error');
        solidconRawEntries = [];
        filteredSolidconEntries = [];
        renderSolidconEntriesTable();
      } finally {
        isSolidconLoading = false;
        if (solidconEls.reloadIcon) solidconEls.reloadIcon.classList.remove('animate-spin');
        if (solidconEls.btnReload) solidconEls.btnReload.disabled = false;
        updateSolidconEntriesSelectionSummary();
      }
    };

    const verifySolidconEntries = async () => {
      if (solidconRawEntries.length === 0) {
        showSolidconAlert('Consulte primeiro os movimentos do Solidcon antes de verificar.', 'error');
        return;
      }

      isSolidconVerifying = true;
      if (solidconEls.verifyIcon) solidconEls.verifyIcon.classList.add('animate-spin');
      if (solidconEls.btnVerify) solidconEls.btnVerify.disabled = true;

      showSolidconAlert('Verificando duplicidades e contas contábeis no Keystone... Aguarde.', 'info');

      try {
        const response = await api('/accounting/solidcon-entries/verify', {
          method: 'POST',
          body: JSON.stringify({ entries: solidconRawEntries }),
        });

        const data = response?.data;
        const results = data?.results || [];
        const summary = data?.summary || { total: 0, validCount: 0, errorCount: 0, duplicateCount: 0 };

        solidconVerificationMap.clear();
        results.forEach((r: any) => {
          solidconVerificationMap.set(String(r.id), r);
        });

        // Automatically update selection: check only valid entries, uncheck duplicates and errors
        selectedSolidconEntryIds.clear();
        solidconRawEntries.forEach((entry) => {
          const id = String(entry.id);
          const v = solidconVerificationMap.get(id);
          if (v && v.isValid) {
            selectedSolidconEntryIds.add(id);
          }
        });

        if (solidconEls.btnSelectOnlyValid) {
          solidconEls.btnSelectOnlyValid.classList.remove('hidden');
        }

        const validPart = `<span class="text-emerald-700 dark:text-emerald-300 font-bold">${summary.validCount} correto(s) (Verde)</span>`;
        const dupPart = summary.duplicateCount > 0 ? `<span class="text-red-700 dark:text-red-300 font-bold">${summary.duplicateCount} duplicado(s) (Vermelho)</span>` : '';
        const errPart = summary.errorCount > 0 ? `<span class="text-red-700 dark:text-red-300 font-bold">${summary.errorCount} conta(s) incorreta(s) (Vermelho)</span>` : '';

        const summaryText = [validPart, dupPart, errPart].filter(Boolean).join(' | ');

        if (summary.errorCount === 0 && summary.duplicateCount === 0) {
          showSolidconAlert(`<strong>Auditoria Concluída!</strong> Todos os <strong>${summary.validCount}</strong> lançamentos estão corretos e prontos para importação (marcados em verde).`, 'success');
        } else {
          showSolidconAlert(`<strong>Auditoria Concluída:</strong> ${summaryText}.<br><span class="text-[11px] font-normal">Lançamentos corretos estão em <strong>verde</strong> (selecionados). Lançamentos duplicados ou com contas erradas estão em <strong>vermelho</strong> (desmarcados).</span>`, 'info');
        }

        applySolidconEntriesFilters();
      } catch (error: any) {
        showSolidconAlert(`Erro ao verificar lançamentos: ${error?.message || error}`, 'error');
      } finally {
        isSolidconVerifying = false;
        if (solidconEls.verifyIcon) solidconEls.verifyIcon.classList.remove('animate-spin');
        if (solidconEls.btnVerify) solidconEls.btnVerify.disabled = false;
        updateSolidconEntriesSelectionSummary();
      }
    };

    const applyDefaultAccountsToSelected = () => {
      const selectedDebit = solidconEls.defaultDebit?.value || '';
      const selectedCredit = solidconEls.defaultCredit?.value || '';

      if (!selectedDebit && !selectedCredit) {
        alert('Selecione pelo menos uma conta de débito ou crédito no preenchimento rápido.');
        return;
      }

      const debitAcc = accountsList.find((a) => a.code === selectedDebit);
      const creditAcc = accountsList.find((a) => a.code === selectedCredit);

      let updatedCount = 0;
      solidconRawEntries.forEach((entry) => {
        if (selectedSolidconEntryIds.has(String(entry.id))) {
          if (selectedDebit && debitAcc) {
            entry.debit_account_code = debitAcc.code;
            entry.debit_account_name = debitAcc.name;
          }
          if (selectedCredit && creditAcc) {
            entry.credit_account_code = creditAcc.code;
            entry.credit_account_name = creditAcc.name;
          }
          updatedCount++;
        }
      });

      if (updatedCount === 0) {
        alert('Nenhum movimento selecionado para aplicar as contas padrão.');
        return;
      }

      showSolidconAlert(`Contas padrão aplicadas em <strong>${updatedCount}</strong> movimentos selecionados. Clique em "Verificar Lançamentos" para reavaliar a auditoria.`, 'info');
      // Re-verify automatically if already verified
      if (solidconVerificationMap.size > 0) {
        verifySolidconEntries();
      } else {
        renderSolidconEntriesTable();
      }
    };

    const formatLocalYmd = (d: Date): string => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const setSolidconQuickPeriod = (period: string) => {
      const now = new Date();
      let start = new Date();
      let end = new Date();

      if (period === 'today') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === 'yesterday') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      } else if (period === 'this_month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else if (period === 'last_month') {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
      } else if (period === 'last_30') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === 'last_90') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === 'this_year') {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
      }

      if (solidconEls.startDate) solidconEls.startDate.value = formatLocalYmd(start);
      if (solidconEls.endDate) solidconEls.endDate.value = formatLocalYmd(end);
    };

    const openSolidconEntriesModal = async () => {
      if (!solidconEls.modal) return;
      solidconEls.modal.classList.remove('hidden');

      // Set default dates to current month if empty
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

      if (solidconEls.startDate && !solidconEls.startDate.value) {
        solidconEls.startDate.value = formatLocalYmd(firstDay);
      }
      if (solidconEls.endDate && !solidconEls.endDate.value) {
        solidconEls.endDate.value = formatLocalYmd(today);
      }

      populateSolidconDefaultAccountDropdowns();
      await loadSolidconConnections();
      if (!hasSearchedSolidcon) {
        updateSolidconStatusBadge('idle', 'Aguardando');
        renderSolidconEntriesTable();
      }
    };

    const closeSolidconEntriesModal = () => {
      if (!solidconEls.modal) return;
      solidconEls.modal.classList.add('hidden');
      hideSolidconAlert();
    };

    // Modal triggers & handlers
    solidconEls.btnModal?.addEventListener('click', openSolidconEntriesModal);
    solidconEls.btnClose?.addEventListener('click', closeSolidconEntriesModal);
    solidconEls.btnCloseIcon?.addEventListener('click', closeSolidconEntriesModal);
    solidconEls.backdrop?.addEventListener('click', closeSolidconEntriesModal);

    // Period shortcuts listener
    document.querySelectorAll<HTMLButtonElement>('.solidcon-period-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-period');
        if (p) {
          setSolidconQuickPeriod(p);
          // Trigger search automatically on period click for convenience
          loadSolidconEntries();
        }
      });
    });

    solidconEls.btnReload?.addEventListener('click', loadSolidconEntries);
    solidconEls.btnVerify?.addEventListener('click', verifySolidconEntries);

    solidconEls.searchInput?.addEventListener('input', applySolidconEntriesFilters);
    solidconEls.opFilter?.addEventListener('change', applySolidconEntriesFilters);
    solidconEls.validationFilter?.addEventListener('change', applySolidconEntriesFilters);

    solidconEls.btnSelectOnlyValid?.addEventListener('click', () => {
      selectedSolidconEntryIds.clear();
      filteredSolidconEntries.forEach((entry) => {
        const id = String(entry.id);
        const v = solidconVerificationMap.get(id);
        if (v && v.isValid) {
          selectedSolidconEntryIds.add(id);
        }
      });
      renderSolidconEntriesTable();
    });

    solidconEls.btnApplyDefaults?.addEventListener('click', applyDefaultAccountsToSelected);

    solidconEls.selectAll?.addEventListener('change', () => {
      const isChecked = !!solidconEls.selectAll?.checked;
      filteredSolidconEntries.forEach((entry) => {
        const id = String(entry.id);
        if (isChecked) selectedSolidconEntryIds.add(id);
        else selectedSolidconEntryIds.delete(id);
      });
      renderSolidconEntriesTable();
    });

    solidconEls.table?.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement | null;
      if (!target || !target.classList.contains('solidcon-entry-checkbox')) return;
      const id = target.getAttribute('data-id');
      if (!id) return;

      if (target.checked) selectedSolidconEntryIds.add(id);
      else selectedSolidconEntryIds.delete(id);

      updateSolidconEntriesSelectionSummary();

      const tr = target.closest('tr');
      if (tr) {
        if (target.checked) tr.classList.add('bg-emerald-50/60', 'dark:bg-emerald-950/20');
        else tr.classList.remove('bg-emerald-50/60', 'dark:bg-emerald-950/20');
      }
    });

    const executeSolidconEntriesImport = async (entriesToImport: AnyRecord[]) => {
      if (entriesToImport.length === 0) {
        alert('Nenhum lançamento selecionado para importação.');
        return;
      }

      // Check if any entries are missing accounts
      const unmapped = entriesToImport.filter((e) => !e.debit_account_code || !e.credit_account_code);
      if (unmapped.length > 0) {
        const proceed = confirm(
          `Atenção: ${unmapped.length} de ${entriesToImport.length} lançamentos não possuem Conta Débito ou Conta Crédito preenchidas e serão ignorados.\n\nDica: Use o "Preenchimento Rápido de Contas" acima para definir as contas.\n\nDeseja importar os ${entriesToImport.length - unmapped.length} lançamentos válidos restantes?`
        );
        if (!proceed) return;
      }

      const validEntries = entriesToImport.filter((e) => e.debit_account_code && e.credit_account_code);
      if (validEntries.length === 0) {
        alert('Nenhum lançamento possui ambas as contas (Débito e Crédito) preenchidas para importação.');
        return;
      }

      if (solidconEls.btnImportSelected) solidconEls.btnImportSelected.disabled = true;
      if (solidconEls.btnImportAll) solidconEls.btnImportAll.disabled = true;
      if (solidconEls.btnReload) solidconEls.btnReload.disabled = true;

      showSolidconAlert(`Importando ${validEntries.length} lançamentos contábeis no Keystone... Aguarde.`, 'info');

      try {
        const response = await api('/accounting/solidcon-entries/import', {
          method: 'POST',
          body: JSON.stringify({ entries: validEntries }),
        });

        const successCount = response?.data?.success ?? validEntries.length;
        const errors = response?.data?.errors || [];

        let msg = `Importação concluída com sucesso! <strong>${successCount}</strong> lançamento(s) importado(s) no Keystone.`;
        if (errors.length > 0) {
          msg += `<br><span class="text-xs text-red-600 dark:text-red-400 font-normal">Falhas: ${errors.join(', ')}</span>`;
        }

        showSolidconAlert(msg, errors.length > 0 ? 'info' : 'success');

        // Reload Keystone data in background
        await loadData();
      } catch (error: any) {
        showSolidconAlert(`Erro na importação: ${error?.message || String(error)}`, 'error');
      } finally {
        if (solidconEls.btnReload) solidconEls.btnReload.disabled = false;
        updateSolidconEntriesSelectionSummary();
      }
    };

    solidconEls.btnImportSelected?.addEventListener('click', () => {
      const selected = solidconRawEntries.filter((e) => selectedSolidconEntryIds.has(String(e.id)));
      executeSolidconEntriesImport(selected);
    });

    solidconEls.btnImportAll?.addEventListener('click', () => {
      executeSolidconEntriesImport(filteredSolidconEntries);
    });
  }
})();
