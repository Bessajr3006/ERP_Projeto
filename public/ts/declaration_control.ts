/// <reference path="./api.ts" />

(() => {
    // UI Elements
    const filterForm = document.getElementById('filterForm') as HTMLFormElement;
    const filterMonth = document.getElementById('filterMonth') as HTMLSelectElement;
    const filterYear = document.getElementById('filterYear') as HTMLSelectElement;
    const filterType = document.getElementById('filterType') as HTMLInputElement;
    const filterCustomer = document.getElementById('filterCustomer') as HTMLInputElement;
    const clearFiltersBtn = document.getElementById('clearFiltersBtn') as HTMLButtonElement;
    const declarationsTable = document.getElementById('declarationsTable') as HTMLTableSectionElement;
    const loadingOverlay = document.getElementById('loadingOverlay') as HTMLDivElement;
    
    // Batch Actions Elements
    const batchActionsBar = document.getElementById('batchActionsBar') as HTMLDivElement;
    const selectedCountSpan = document.getElementById('selectedCount') as HTMLSpanElement;
    const selectAllCheckbox = document.getElementById('selectAllCheckbox') as HTMLInputElement;

    // Modal elements
    const pdfModal = document.getElementById('pdfModal') as HTMLDivElement;
    const closePdfModalBtn = document.getElementById('closePdfModal') as HTMLButtonElement;
    const pdfIframe = document.getElementById('pdfIframe') as HTMLIFrameElement;

    let currentDeclarations: any[] = [];

    // Initialize Years
    function initFilters() {
        const currentYear = new Date().getFullYear();
        for (let i = currentYear + 1; i >= 2020; i--) {
            const option = document.createElement('option');
            option.value = i.toString();
            option.textContent = i.toString();
            filterYear.appendChild(option);
        }
        filterYear.value = currentYear.toString();
        
        // Mês atual como padrão
        filterMonth.value = (new Date().getMonth() + 1).toString();
    }

    function showLoading() {
        if (loadingOverlay) {
            loadingOverlay.classList.remove('hidden');
            loadingOverlay.classList.add('flex');
        }
    }

    function hideLoading() {
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
            loadingOverlay.classList.remove('flex');
        }
    }

    async function loadDeclarationTypes() {
        try {
            const data = await api('/accounting/declaration-types');
            const types = data?.data || [];
            const datalist = document.getElementById('declarationTypes');
            if (datalist) {
                datalist.innerHTML = '';
                types.forEach((t: any) => {
                    const option = document.createElement('option');
                    option.value = t.name;
                    datalist.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading declaration types:', error);
        }
    }

    async function loadCustomersForDatalist() {
        try {
            const data = await api('/entities/customers');
            const customers = data?.data || [];
            const datalist = document.getElementById('customersList');
            if (datalist) {
                datalist.innerHTML = '';
                customers.forEach((c: any) => {
                    if (c.active !== 0) { // Opcional: mostrar apenas ativos
                        const option = document.createElement('option');
                        option.value = c.name;
                        if (c.cnpj_cpf) {
                            option.textContent = c.cnpj_cpf;
                        }
                        datalist.appendChild(option);
                    }
                });
            }
        } catch (error) {
            console.error('Error loading customers for datalist:', error);
        }
    }

    function updateBatchActionsVisibility() {
        if (!batchActionsBar) return;
        const checkboxes = document.querySelectorAll('.row-checkbox:checked');
        if (checkboxes.length > 0) {
            batchActionsBar.classList.remove('hidden');
            batchActionsBar.classList.add('flex');
            if (selectedCountSpan) selectedCountSpan.textContent = checkboxes.length.toString();
        } else {
            batchActionsBar.classList.add('hidden');
            batchActionsBar.classList.remove('flex');
            if (selectedCountSpan) selectedCountSpan.textContent = '0';
        }

        if (selectAllCheckbox) {
            const allCheckboxes = document.querySelectorAll('.row-checkbox');
            selectAllCheckbox.checked = allCheckboxes.length > 0 && checkboxes.length === allCheckboxes.length;
        }
    }

    async function loadDeclarations() {
        const month = filterMonth.value;
        const year = filterYear.value;
        const type = filterType.value.trim().toUpperCase();

        if (!type) {
            // @ts-ignore
            if (typeof Swal !== 'undefined') Swal.fire('Aviso', 'Informe o tipo de declaração antes de buscar.', 'warning');
            return;
        }

        showLoading();
        try {
            const data = await api(`/accounting/declarations?month=${month}&year=${year}&type=${encodeURIComponent(type)}`);
            currentDeclarations = data?.data || [];
            renderTable();
        } catch (e: any) {
            console.error('Failed to load declarations', e);
            declarationsTable.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-red-500">Erro ao carregar clientes: ${e.message}</td></tr>`;
        } finally {
            hideLoading();
        }
    }

    function renderTable() {
        if (!declarationsTable) return;

        let filtered = currentDeclarations;
        if (filterCustomer && filterCustomer.value) {
            const search = filterCustomer.value.toLowerCase().trim();
            filtered = currentDeclarations.filter(c => 
                (c.customer_name || '').toLowerCase().includes(search) || 
                (c.cnpj_cpf || '').toLowerCase().includes(search)
            );
        }

        if (filtered.length === 0) {
            declarationsTable.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-gray-500 dark:text-gray-400">Nenhum cliente encontrado para os filtros selecionados.</td></tr>`;
            return;
        }

        const getBase64 = (file: File) => new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(String(reader.result || '').split(',')[1]);
            reader.onerror = error => reject(error);
        });

        const getStatusBadge = (status: string) => {
            switch (status) {
                case 'ENTREGUE': return '<span class="px-2 py-1 rounded-full text-[10px] font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Entregue</span>';
                case 'SEM_MOVIMENTO': return '<span class="px-2 py-1 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Sem Movimento</span>';
                case 'NAO_SE_APLICA': return '<span class="px-2 py-1 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-gray-300">Não se Aplica</span>';
                case 'PENDENTE':
                default: return '<span class="px-2 py-1 rounded-full text-[10px] font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Pendente</span>';
            }
        };

        const isTodos = filterMonth.value === 'todos';

        declarationsTable.innerHTML = filtered.map(c => `
            <tr class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td class="px-4 py-3 text-center">
                    <input type="checkbox" class="row-checkbox rounded border-gray-300 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-700 dark:border-slate-600" data-id="${c.customer_public_id}" data-month="${c.competence_month || ''}">
                </td>
                <td class="px-4 py-3">
                    <div class="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        ${c.customer_name} 
                        ${isTodos && c.competence_month ? `<span class="text-[10px] font-bold text-brand-700 bg-brand-100 dark:text-brand-300 dark:bg-brand-900/50 px-1.5 py-0.5 rounded-full">Mês ${c.competence_month}</span>` : ''}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">${c.cnpj_cpf || 'Sem doc'}</div>
                </td>
                <td class="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300 hidden xl:table-cell">
                    ${c.tax_regime || '-'}
                </td>
                <td class="px-4 py-3 text-center">
                    ${getStatusBadge(c.status)}
                    ${c.delivery_date ? `<div class="text-[10px] text-gray-500 mt-1">${new Date(c.delivery_date).toLocaleDateString('pt-BR')}</div>` : ''}
                </td>
                <td class="px-4 py-3 text-right hidden lg:table-cell">
                    ${c.document_period ? `<div class="text-xs font-medium text-gray-700 dark:text-gray-300">${c.document_period}</div>` : `<div class="text-xs text-gray-400">-</div>`}
                </td>
                <td class="px-4 py-3 text-right hidden lg:table-cell">
                    ${c.gross_revenue ? `<div class="text-xs text-gray-700 dark:text-gray-300">R$ ${parseFloat(c.gross_revenue).toFixed(2).replace('.', ',')}</div>` : `<div class="text-xs text-gray-400">-</div>`}
                </td>
                <td class="px-4 py-3 text-right hidden lg:table-cell">
                    ${c.accumulated_revenue ? `<div class="text-xs text-gray-700 dark:text-gray-300">R$ ${parseFloat(c.accumulated_revenue).toFixed(2).replace('.', ',')}</div>` : `<div class="text-xs text-gray-400">-</div>`}
                </td>
                <td class="px-4 py-3 text-right hidden sm:table-cell">
                    ${c.amount_due ? `<div class="text-xs text-gray-900 dark:text-gray-100 font-medium">R$ ${parseFloat(c.amount_due).toFixed(2).replace('.', ',')}</div>` : `<div class="text-xs text-gray-400">-</div>`}
                    ${c.d_due_date ? `<div class="text-[10px] text-red-600 dark:text-red-400 mt-0.5">Venc: ${new Date(c.d_due_date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</div>` : ''}
                </td>
                <td class="px-4 py-3 text-center">
                    <div class="flex flex-wrap items-center justify-center gap-2">
                        ${c.receipt_url ? `
                            <button type="button" data-url="${c.receipt_url}" class="view-pdf-btn text-brand-600 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300 text-xs font-medium px-2 py-1 border border-brand-200 dark:border-brand-800 rounded transition-colors" title="Visualizar Comprovante">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                            </button>
                            <label class="cursor-pointer text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 text-xs font-medium px-2 py-1 border border-gray-200 dark:border-gray-600 rounded transition-colors" title="Substituir Comprovante">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                <input type="file" class="hidden file-upload-btn" data-id="${c.customer_public_id}" data-month="${c.competence_month || ''}" accept=".pdf,image/*">
                            </label>
                        ` : `
                            <label class="cursor-pointer text-brand-600 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300 text-xs font-medium px-2 py-1 border border-brand-200 dark:border-brand-800 rounded transition-colors flex items-center gap-1">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                                Anexar
                                <input type="file" class="hidden file-upload-btn" data-id="${c.customer_public_id}" data-month="${c.competence_month || ''}" accept=".pdf,image/*">
                            </label>
                        `}
                    </div>
                </td>
                <td class="px-4 py-3 text-center">
                    <div class="flex flex-wrap items-center justify-center gap-2">
                        ${c.status !== 'ENTREGUE' ? `<button type="button" class="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 text-xs font-medium px-2 py-1 border border-green-200 dark:border-green-800 rounded transition-colors btn-status" data-id="${c.customer_public_id}" data-month="${c.competence_month || ''}" data-status="ENTREGUE">Entregue</button>` : ''}
                        ${c.status !== 'SEM_MOVIMENTO' ? `<button type="button" class="text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300 text-xs font-medium px-2 py-1 border border-yellow-200 dark:border-yellow-800 rounded transition-colors btn-status" data-id="${c.customer_public_id}" data-month="${c.competence_month || ''}" data-status="SEM_MOVIMENTO">Sem Mov.</button>` : ''}
                        ${c.status !== 'NAO_SE_APLICA' ? `<button type="button" class="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 text-xs font-medium px-2 py-1 border border-gray-200 dark:border-gray-600 rounded transition-colors btn-status" data-id="${c.customer_public_id}" data-month="${c.competence_month || ''}" data-status="NAO_SE_APLICA">N/A</button>` : ''}
                        <button type="button" class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xs font-medium px-2 py-1 border border-red-200 dark:border-red-800 rounded transition-colors btn-delete" data-id="${c.customer_public_id}" data-month="${c.competence_month || ''}" title="Excluir">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                        ${c.status !== 'PENDENTE' ? `<button type="button" class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xs font-medium px-2 py-1 border border-red-200 dark:border-red-800 rounded transition-colors btn-status" data-id="${c.customer_public_id}" data-month="${c.competence_month || ''}" data-status="PENDENTE">Pendente</button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('');

        declarationsTable.querySelectorAll('.btn-status').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const target = e.currentTarget as HTMLButtonElement;
                const customerId = target.getAttribute('data-id');
                const newStatus = target.getAttribute('data-status');
                const monthOverride = target.getAttribute('data-month');
                if (customerId && newStatus) {
                    await updateStatus(customerId, newStatus, false, monthOverride || undefined);
                }
            });
        });

        declarationsTable.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (!confirm('Deseja realmente excluir esta declaração?')) return;
                const target = e.currentTarget as HTMLButtonElement;
                const customerId = target.getAttribute('data-id');
                const monthOverride = target.getAttribute('data-month');
                if (customerId) {
                    await deleteDeclaration(customerId, monthOverride || undefined);
                }
            });
        });

        declarationsTable.querySelectorAll('.file-upload-btn').forEach(input => {
            input.addEventListener('change', async (e) => {
                const target = e.currentTarget as HTMLInputElement;
                const customerId = target.getAttribute('data-id');
                const monthOverride = target.getAttribute('data-month');
                const file = target.files?.[0];
                if (customerId && file) {
                    try {
                        showLoading();
                        const base64 = await getBase64(file);
                        await uploadReceipt(customerId, base64, monthOverride || undefined);
                    } catch (error: any) {
                        console.error('File upload failed', error);
                        // @ts-ignore
                        if (typeof Swal !== 'undefined') Swal.fire('Erro', error.message || 'Falha ao fazer upload do arquivo.', 'error');
                        hideLoading();
                    }
                }
            });
        });

        declarationsTable.querySelectorAll('.view-pdf-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLButtonElement;
                const url = target.getAttribute('data-url');
                if (url && pdfModal && pdfIframe) {
                    pdfIframe.src = url;
                    pdfModal.classList.remove('hidden');
                    pdfModal.classList.add('flex');
                }
            });
        });

        declarationsTable.querySelectorAll('.row-checkbox').forEach(cb => {
            cb.addEventListener('change', updateBatchActionsVisibility);
        });
        
        const selectAllCheckbox = document.getElementById('selectAllCheckbox') as HTMLInputElement;
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        updateBatchActionsVisibility();
    }

    async function uploadReceipt(customerId: string, base64: string, monthOverride?: string) {
        const month = monthOverride || filterMonth.value;
        const year = filterYear.value;
        const type = filterType.value.trim().toUpperCase();

        const payload: any = { receipt_base64: base64 };
        // Vamos usar a mesma rota PUT /accounting/declarations/:id
        // preservando o status existente.
        const currentDeclaration = currentDeclarations.find(c => c.customer_public_id === customerId);
        payload.status = currentDeclaration?.status || 'PENDENTE';
        if (payload.status === 'ENTREGUE' && currentDeclaration?.delivery_date) {
            payload.delivery_date = currentDeclaration.delivery_date.split('T')[0];
        }

        try {
            await api(`/accounting/declarations/${customerId}?month=${month}&year=${year}&type=${encodeURIComponent(type)}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            await loadDeclarations();
        } catch (error: any) {
            console.error('Upload receipt failed', error);
            // @ts-ignore
            if (typeof Swal !== 'undefined') Swal.fire('Erro', error.message || 'Falha ao anexar comprovante.', 'error');
            hideLoading();
        }
    }

    async function updateStatus(customerId: string, status: string, promptForDate: boolean = false, monthOverride?: string, skipReload: boolean = false) {
        const month = monthOverride || filterMonth.value;
        const year = filterYear.value;
        const type = filterType.value.trim().toUpperCase();

        const payload: any = { status };
        if (status === 'ENTREGUE') {
            payload.delivery_date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        }

        showLoading();
        try {
            await api(`/accounting/declarations/${customerId}?month=${month}&year=${year}&type=${encodeURIComponent(type)}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (!skipReload) {
                await loadDeclarations();
            }
        } catch (error: any) {
            console.error('Update status failed', error);
            // @ts-ignore
            if (typeof Swal !== 'undefined') Swal.fire('Erro', error.message || 'Falha ao atualizar status.', 'error');
            hideLoading();
            throw error;
        }
    }

    async function deleteDeclaration(customerId: string, monthOverride?: string, skipReload: boolean = false) {
        const month = monthOverride || filterMonth.value;
        const year = filterYear.value;
        const type = filterType.value.trim().toUpperCase();

        showLoading();
        try {
            await api(`/accounting/declarations/${customerId}?month=${month}&year=${year}&type=${encodeURIComponent(type)}`, {
                method: 'DELETE'
            });
            if (!skipReload) {
                await loadDeclarations();
            }
        } catch (error: any) {
            console.error('Delete failed', error);
            // @ts-ignore
            if (typeof Swal !== 'undefined') Swal.fire('Erro', error.message || 'Falha ao excluir.', 'error');
            throw error;
        } finally {
            hideLoading();
        }
    }

    // Modal listeners
    if (closePdfModalBtn && pdfModal && pdfIframe) {
        closePdfModalBtn.addEventListener('click', () => {
            pdfModal.classList.remove('flex');
            pdfModal.classList.add('hidden');
            pdfIframe.src = '';
        });
        
        // Clicar fora para fechar
        pdfModal.addEventListener('click', (e) => {
            if (e.target === pdfModal) {
                pdfModal.classList.remove('flex');
                pdfModal.classList.add('hidden');
                pdfIframe.src = '';
            }
        });
    }

    // Listeners

    if (filterForm) {
        filterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            loadDeclarations();
        });
    }

    if (filterCustomer) {
        filterCustomer.addEventListener('input', () => {
            renderTable();
        });
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            filterForm.reset();
            // Restaura os defaults de mes/ano para o atual
            const now = new Date();
            filterMonth.value = (now.getMonth() + 1).toString();
            filterYear.value = now.getFullYear().toString();
            filterType.value = 'PGDAS';
            
            declarationsTable.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-gray-500 dark:text-gray-400">Selecione os filtros e clique em Buscar Clientes.</td></tr>`;
            currentDeclarations = [];
            
            // Clear batch actions selection
            const selectAllCheckbox = document.getElementById('selectAllCheckbox') as HTMLInputElement;
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
            document.querySelectorAll('.row-checkbox').forEach(cb => (cb as HTMLInputElement).checked = false);
            updateBatchActionsVisibility();
        });
    }

    // Init
    document.addEventListener('DOMContentLoaded', () => {
        initFilters();
        loadDeclarationTypes();
        loadCustomersForDatalist();
        
        // Initialize PDF Modal
        if (closePdfModalBtn && pdfModal) {
            closePdfModalBtn.addEventListener('click', () => {
                pdfModal.classList.add('hidden');
                pdfModal.classList.remove('flex');
                if (pdfIframe) pdfIframe.src = '';
            });
        }
        
        // Select All Handler
        const selectAllCheckbox = document.getElementById('selectAllCheckbox') as HTMLInputElement;
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const isChecked = (e.target as HTMLInputElement).checked;
                document.querySelectorAll('.row-checkbox').forEach(cb => {
                    (cb as HTMLInputElement).checked = isChecked;
                });
                updateBatchActionsVisibility();
            });
        }
        
        // Batch Action Buttons Handler
        document.querySelectorAll('.batch-action-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const target = e.currentTarget as HTMLButtonElement;
                const newStatus = target.getAttribute('data-status');
                const action = target.getAttribute('data-action');
                if (!newStatus && !action) return;

                const selectedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
                if (selectedCheckboxes.length === 0) return;

                if (action === 'DELETE') {
                    if (!confirm('Tem certeza que deseja excluir as declarações selecionadas?')) return;
                }

                showLoading();
                let hasErrors = false;
                for (const cb of Array.from(selectedCheckboxes)) {
                    const customerId = cb.getAttribute('data-id');
                    const monthOverride = cb.getAttribute('data-month');
                    if (customerId) {
                        try {
                            if (action === 'DELETE') {
                                await deleteDeclaration(customerId, monthOverride || undefined, true);
                            } else if (newStatus) {
                                await updateStatus(customerId, newStatus, false, monthOverride || undefined, true);
                            }
                        } catch (err) {
                            hasErrors = true;
                        }
                    }
                }

                if (!hasErrors) {
                    // @ts-ignore
                    if (typeof UI !== 'undefined' && UI.showAlert) UI.showAlert('alertMessage', 'Lote processado com sucesso!', 'success');
                } else {
                    // @ts-ignore
                    if (typeof Swal !== 'undefined') Swal.fire('Aviso', 'Alguns itens não puderam ser processados.', 'warning');
                }
                
                await loadDeclarations();
                updateBatchActionsVisibility(); // Reset ui
            });
        });

        // Carrega automático apenas se o tipo já tiver valor (ex: PGDAS)
        if (filterType.value) {
            renderTable();
        }
    });

})();
