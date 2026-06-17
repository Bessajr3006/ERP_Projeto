(() => {
    type AnyRecord = Record<string, any>;
    const AuthRef: any = (window as any).Auth;
    const api: any = (window as any).api;

    const getEl = <T extends HTMLElement = HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

    document.addEventListener('DOMContentLoaded', () => {
        void main();
    });

    async function main(): Promise<void> {
        let templates: AnyRecord[] = [];
        let accountsList: AnyRecord[] = [];
        let itemsCount = 0;

        const els = {
            tableBody: getEl<HTMLTableSectionElement>('templatesTable'),
            btnOpenModal: getEl<HTMLButtonElement>('btnOpenModal'),
            templateModal: getEl('templateModal'),
            templateModalBackdrop: getEl('templateModalBackdrop'),
            btnCancelTemplate: getEl<HTMLButtonElement>('btnCancelTemplate'),
            templateForm: getEl<HTMLFormElement>('templateForm'),
            btnAddItem: getEl<HTMLButtonElement>('btnAddItem'),
            itemsContainer: getEl('itemsContainer')
        };

        if (!els.tableBody || !els.templateForm) return;

        if (AuthRef && !AuthRef.isAuthenticated()) {
            window.location.href = '/';
            return;
        }

        await Promise.all([loadRelations(), loadData()]);
        setupListeners();

        async function loadRelations(): Promise<void> {
            try {
                const res = await api('/accounting/chart-of-accounts');
                if (res.data) {
                    accountsList = res.data.filter((a: AnyRecord) => a.type === 'analytic' && a.status === 'active');
                }
            } catch (e) {
                console.error('Erro ao carregar contas', e);
            }
        }

        async function loadData(): Promise<void> {
            try {
                els.tableBody!.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Carregando...</td></tr>';
                const res = await api('/accounting/auto-templates');
                templates = res.data || [];
                renderView();
            } catch (e) {
                console.error('Erro loadData', e);
            }
        }

        function renderView(): void {
            if (templates.length === 0) {
                els.tableBody!.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-500 dark:text-gray-400">Nenhum lançamento automático encontrado.</td></tr>';
                return;
            }

            els.tableBody!.innerHTML = templates.map((tpl: AnyRecord) => `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td class="px-4 py-3 text-sm font-mono text-gray-900 dark:text-gray-200">${tpl.code}</td>
                    <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-200">${tpl.description}</td>
                    <td class="px-4 py-3 text-center text-sm">
                        <span class="px-2 py-1 rounded-full text-xs font-medium ${tpl.active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}">
                            ${tpl.active ? 'Ativo' : 'Inativo'}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                        ${tpl.items ? tpl.items.length : 0} itens
                    </td>
                    <td class="px-4 py-3 text-center text-sm font-medium">
                        <div class="flex items-center justify-center space-x-3">
                            <button type="button" class="btn-edit text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 transition-colors" data-id="${tpl.public_id}" title="Editar">
                                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </button>
                            <button type="button" class="btn-delete text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors" data-id="${tpl.public_id}" title="Excluir">
                                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');

            els.tableBody!.querySelectorAll<HTMLElement>('.btn-edit').forEach(btn => {
                btn.addEventListener('click', () => openModal(btn.dataset.id || null));
            });
            els.tableBody!.querySelectorAll<HTMLElement>('.btn-delete').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;
                    if (id) void deleteTemplate(id);
                });
            });
        }

        function setupListeners(): void {
            els.btnOpenModal?.addEventListener('click', () => openModal());
            els.btnCancelTemplate?.addEventListener('click', closeModal);
            els.templateModalBackdrop?.addEventListener('click', closeModal);
            els.btnAddItem?.addEventListener('click', () => renderItemRow());

            els.templateForm?.addEventListener('submit', async (e: Event) => {
                e.preventDefault();
                
                const id = getEl<HTMLInputElement>('templateId')?.value;
                
                // Collect Items
                const itemDivs = els.itemsContainer?.querySelectorAll('.item-row');
                const items: any[] = [];
                let hasError = false;
                
                itemDivs?.forEach(div => {
                    const debitId = div.querySelector<HTMLSelectElement>('.debit-select')?.value;
                    const creditId = div.querySelector<HTMLSelectElement>('.credit-select')?.value;
                    const historyTpl = div.querySelector<HTMLInputElement>('.history-input')?.value;

                    if (!debitId || !creditId || !historyTpl) {
                        hasError = true;
                    }

                    items.push({
                        debit_account_id: debitId,
                        credit_account_id: creditId,
                        history_template: historyTpl
                    });
                });

                if (items.length === 0) {
                    alert('Adicione pelo menos um item (partida dobrada).');
                    return;
                }

                if (hasError) {
                    alert('Por favor, preencha todos os campos obrigatórios dos itens.');
                    return;
                }

                const payload = {
                    code: getEl<HTMLInputElement>('templateCode')?.value || '',
                    description: getEl<HTMLInputElement>('templateDescription')?.value || '',
                    active: getEl<HTMLInputElement>('templateActive')?.checked ? 1 : 0,
                    items
                };

                try {
                    if (id) {
                        await api(`/accounting/auto-templates/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
                    } else {
                        await api('/accounting/auto-templates', { method: 'POST', body: JSON.stringify(payload) });
                    }
                    closeModal();
                    await loadData();
                } catch (e: any) {
                    alert(e?.message || String(e));
                }
            });
        }

        function getAccountOptions(selectedValue: string = ''): string {
            const options = accountsList.map((a: AnyRecord) => `<option value="${a.public_id}" ${a.public_id === selectedValue ? 'selected' : ''}>${a.code} - ${a.name}</option>`).join('');
            return `<option value="">Selecione...</option>${options}`;
        }

        function renderItemRow(data?: any): void {
            const id = `item-${itemsCount++}`;
            const div = document.createElement('div');
            div.className = 'item-row bg-white dark:bg-slate-800 p-3 rounded border border-gray-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-12 gap-3 relative';
            div.id = id;

            div.innerHTML = `
                <div class="md:col-span-4">
                    <label class="block text-xs text-gray-500 mb-1">Conta Débito *</label>
                    <select class="debit-select w-full border p-1.5 text-sm rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" required>
                        ${getAccountOptions(data?.debit_account_id)}
                    </select>
                </div>
                <div class="md:col-span-4">
                    <label class="block text-xs text-gray-500 mb-1">Conta Crédito *</label>
                    <select class="credit-select w-full border p-1.5 text-sm rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" required>
                        ${getAccountOptions(data?.credit_account_id)}
                    </select>
                </div>
                <div class="md:col-span-3">
                    <label class="block text-xs text-gray-500 mb-1">Histórico Padrão *</label>
                    <input type="text" class="history-input w-full border p-1.5 text-sm rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" required placeholder="Ex: Pagamento Fornecedor" value="${data?.history_template || ''}">
                </div>
                <div class="md:col-span-1 flex items-end justify-center pb-1">
                    <button type="button" class="btn-remove-item text-red-500 hover:text-red-700 transition-colors p-1" title="Remover Partida">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            `;

            div.querySelector('.btn-remove-item')?.addEventListener('click', () => {
                div.remove();
            });

            els.itemsContainer?.appendChild(div);
        }

        function openModal(id: string | null = null): void {
            els.templateForm?.reset();
            const title = getEl('templateModalTitle');
            const idInput = getEl<HTMLInputElement>('templateId');
            if (idInput) idInput.value = '';
            if (title) title.textContent = 'Novo Lançamento Automático';
            if (els.itemsContainer) els.itemsContainer.innerHTML = '';
            getEl<HTMLInputElement>('templateActive')!.checked = true;

            if (id) {
                const tpl = templates.find((t: AnyRecord) => t.public_id === id);
                if (tpl) {
                    if (idInput) idInput.value = tpl.public_id;
                    if (title) title.textContent = 'Editar Lançamento Automático';
                    getEl<HTMLInputElement>('templateCode')!.value = tpl.code;
                    getEl<HTMLInputElement>('templateDescription')!.value = tpl.description;
                    getEl<HTMLInputElement>('templateActive')!.checked = !!tpl.active;
                    
                    if (tpl.items && Array.isArray(tpl.items)) {
                        tpl.items.forEach((item: any) => renderItemRow(item));
                    }
                }
            } else {
                renderItemRow(); // At least one empty row
            }

            els.templateModal?.classList.remove('hidden');
        }

        function closeModal(): void {
            els.templateModal?.classList.add('hidden');
        }

        async function deleteTemplate(id: string): Promise<void> {
            if (!confirm('Deseja excluir este Lançamento Automático?')) return;
            try {
                await api(`/accounting/auto-templates/${id}`, { method: 'DELETE' });
                await loadData();
            } catch (e: any) {
                alert(e?.message || String(e));
            }
        }
    }
})();
