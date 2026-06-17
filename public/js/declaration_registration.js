(function initDeclarationRegistrationPage() {
    let declarationManager;
    const getById = (id) => document.getElementById(id);
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }
        declarationManager = new window.CrudManager({
            entityName: 'Declaração',
            endpoint: '/accounting/declaration-types',
            tableId: 'declarationTypesTable',
            gridSectionId: 'declarationTypesGridSection',
            tableSectionId: 'declarationTypesSection',
            modalId: 'declarationTypeModal',
            filterConfig: {
                storageKey: 'declarations_filter_panel',
                fields: [
                    { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome ou descrição' },
                ]
            },
            renderTable: (items) => {
                const tbody = getById('declarationTypesTable');
                if (items.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum tipo de declaração cadastrado.</td></tr>`;
                    return;
                }
                tbody.innerHTML = items.map((d) => `
                    <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td class="px-6 py-4 whitespace-nowrap">
                            <input type="checkbox" class="item-checkbox h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 dark:border-slate-600 rounded cursor-pointer" value="${d.public_id}" data-bwignore="true" data-lpignore="true">
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">#${String(d.id).padStart(4, '0')}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">${d.name}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">${d.description || '-'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${d.frequency}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${d.tax_regime === 'SIMPLES_NACIONAL' ? 'Simples Nacional' :
                    d.tax_regime === 'LUCRO_PRESUMIDO' ? 'Lucro Presumido' :
                        d.tax_regime === 'LUCRO_REAL' ? 'Lucro Real' :
                            d.tax_regime === 'GERAL' ? 'Geral' :
                                d.tax_regime === 'MEI' ? 'MEI' :
                                    d.tax_regime === 'PF' ? 'Pessoa Física' :
                                        (d.tax_regime || '-')}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${d.due_day ? `Dia ${d.due_day}` : '-'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm">
                            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${d.active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}">
                                ${d.active ? 'Ativo' : 'Inativo'}
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button type="button" title="Editar" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-3 edit-btn" data-item='${JSON.stringify(d).replace(/'/g, "&#39;")}'>
                                <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </button>
                            <button type="button" title="Excluir" class="text-red-600 hover:text-red-900 dark:hover:text-red-400 delete-btn" data-id="${d.public_id}">
                                <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </td>
                    </tr>
                `).join('');
            },
            renderGrid: (items) => {
                const grid = getById('declarationTypesGridSection');
                if (items.length === 0) {
                    grid.innerHTML = `<div class="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">Nenhuma declaração encontrada.</div>`;
                    return;
                }
                grid.innerHTML = items.map((d) => `
                    <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col border border-gray-100 dark:border-slate-700 relative group">
                        <div class="mb-4 flex items-start justify-between gap-3">
                            <div class="min-w-0 flex-1">
                                <h4 class="text-lg font-bold text-gray-900 dark:text-gray-100 truncate pr-14">${d.name}</h4>
                                <div class="text-sm text-gray-500 dark:text-gray-400 truncate">Venc: Dia ${d.due_day || '-'}</div>
                                <div class="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">Tributação: ${d.tax_regime === 'SIMPLES_NACIONAL' ? 'Simples Nacional' :
                    d.tax_regime === 'LUCRO_PRESUMIDO' ? 'Lucro Presumido' :
                        d.tax_regime === 'LUCRO_REAL' ? 'Lucro Real' :
                            d.tax_regime === 'GERAL' ? 'Geral' :
                                d.tax_regime === 'MEI' ? 'MEI' :
                                    d.tax_regime === 'PF' ? 'Pessoa Física' :
                                        (d.tax_regime || 'Não definida')}</div>
                            </div>
                            <span class="text-xs text-gray-400">ID: #${String(d.id).padStart(4, '0')}</span>
                        </div>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">${d.description || 'Sem descrição'}</p>
                        <div class="mt-auto pt-3 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center text-xs text-gray-400">
                            <span>${d.frequency}</span>
                            <div class="flex space-x-2">
                                <button type="button" title="Editar" class="text-brand-600 hover:bg-brand-50 p-1.5 rounded-full dark:hover:bg-brand-900/30 edit-btn" data-item='${JSON.stringify(d).replace(/'/g, "&#39;")}'>
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                </button>
                                <button type="button" title="Excluir" class="text-red-500 hover:bg-red-50 p-1.5 rounded-full dark:hover:bg-red-900/30 delete-btn" data-id="${d.public_id}">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');
            },
            onEdit: (declaration) => {
                getById('declarationTypeForm').reset();
                const title = getById('modalTitle');
                const form = getById('declarationTypeForm');
                if (declaration) {
                    title.textContent = 'Editar Declaração';
                    getById('name').value = declaration.name || '';
                    getById('description').value = declaration.description || '';
                    getById('frequency').value = declaration.frequency || 'MENSAL';
                    getById('due_day').value = declaration.due_day || '';
                    getById('tax_regime').value = declaration.tax_regime || '';
                    getById('active').checked = !!declaration.active;
                    form.dataset.id = declaration.public_id;
                }
                else {
                    title.textContent = 'Nova Declaração';
                    delete form.dataset.id;
                    getById('active').checked = true;
                }
                getById('declarationTypeModal').classList.remove('hidden');
            }
        });
        declarationManager.init();
    });
    // Form Logic
    getById('declarationTypeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = getById('saveBtn');
        const form = getById('declarationTypeForm');
        const payload = {
            name: getById('name').value,
            description: getById('description').value || null,
            frequency: getById('frequency').value,
            due_day: parseInt(getById('due_day').value, 10) || null,
            tax_regime: getById('tax_regime').value || null,
            active: getById('active').checked
        };
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';
        try {
            if (form.dataset.id) {
                await window.api(`/accounting/declaration-types/${form.dataset.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                window.UI.showAlert('alertMessage', 'Declaração atualizada com sucesso!', 'success');
            }
            else {
                await window.api('/accounting/declaration-types', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                window.UI.showAlert('alertMessage', 'Declaração salva com sucesso!', 'success');
            }
            declarationManager.closeModal();
            declarationManager.loadData();
        }
        catch (error) {
            alert(error.message);
        }
        finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar';
        }
    });
})();
