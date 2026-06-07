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
    let filterIsOpen = true;
    if (els.filterBody && els.toggleFilterBtn) {
      els.filterBody.style.maxHeight = els.filterBody.scrollHeight + 'px';
      els.filterBody.style.overflow = 'hidden';
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
                    <td class="px-2 py-3 text-sm">
                        <div class="flex flex-col">
                            <span class="text-blue-600 dark:text-blue-400 font-medium text-xs">D: ${entry.debit_account_code}</span>
                            <span class="text-orange-600 dark:text-orange-400 font-medium text-xs">C: ${entry.credit_account_code}</span>
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
  }
})();
