(() => {
    const getById = (id: string): any => document.getElementById(id);
    const qsa = (selector: string): any => document.querySelectorAll(selector);

    let productTypesManager: any;

    document.addEventListener('DOMContentLoaded', () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }

        productTypesManager = new CrudManager({
            entityName: 'Tipo de Produto',
            endpoint: '/products/product-types',
            tableId: 'productTypesTable',
            gridSectionId: 'productTypesGridSection',
            tableSectionId: 'productTypesSection',
            modalId: 'productTypeModal',
            
            filterConfig: {
                storageKey: 'product_types_filter_panel',
                fields: [
                    { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Tipo ou descrição' },
                ]
            },

            renderTable: (items) => {
                const tbody = getById('productTypesTable');
                if (items.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum tipo de produto cadastrado.</td></tr>`;
                    return;
                }

                tbody.innerHTML = items.map((t) => `
                    <tr class="hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors group">
                        <td class="px-6 py-4 whitespace-nowrap">
                            <input type="checkbox" value="${t.public_id}" class="item-checkbox rounded border-gray-300 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800 dark:border-slate-600" data-bwignore="true" data-lpignore="true" placeholder="">
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">#${t.id}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">${t.name}</td>
                        <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">${t.description || '-'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-gray-400">${t.idprodutotipopos || '-'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button type="button" title="Editar" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-3 edit-btn" data-item='${JSON.stringify(t).replace(/'/g, "&#39;")}'>
                                <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </button>
                            <button type="button" title="Duplicar" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mr-3 duplicate-btn" data-item='${JSON.stringify(t).replace(/'/g, "&#39;")}'>
                                <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                            </button>
                            <button type="button" title="Excluir" class="text-red-600 hover:text-red-900 dark:hover:text-red-400 delete-btn" data-id="${t.public_id}">
                                <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </td>
                    </tr>
                `).join('');
            },

            renderGrid: (items) => {
                const grid = getById('productTypesGridSection');
                if (items.length === 0) {
                    grid.innerHTML = `<div class="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">Nenhum tipo de produto encontrado.</div>`;
                    return;
                }

                grid.innerHTML = items.map((t) => `
                    <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col border border-gray-100 dark:border-slate-700 relative group hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors">
                        <div class="absolute top-4 left-4 z-10 flex items-center">
                            <input type="checkbox" value="${t.public_id}" class="item-checkbox rounded border-gray-300 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800 dark:border-slate-600" data-bwignore="true" data-lpignore="true" placeholder="">
                        </div>
                        <h4 class="text-lg font-bold text-gray-900 dark:text-gray-100 truncate mb-1 pl-8 pr-14">${t.name}</h4>
                        <p class="pl-8 text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4">${t.description || '-'}</p>
                        <div class="mt-auto pt-4 flex justify-between items-center text-xs text-gray-400">
                            <span class="pl-8">ID: ${t.id} ${t.idprodutotipopos ? `| Pos ID: ${t.idprodutotipopos}` : ''}</span>
                            <div class="flex space-x-2">
                                <button type="button" title="Editar" class="text-brand-600 hover:bg-brand-50 p-1.5 rounded-full dark:hover:bg-brand-900/30 edit-btn" data-item='${JSON.stringify(t).replace(/'/g, "&#39;")}'>
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                </button>
                                <button type="button" title="Duplicar" class="text-gray-500 hover:bg-gray-100 p-1.5 rounded-full dark:hover:bg-slate-700 dark:text-gray-400 duplicate-btn" data-item='${JSON.stringify(t).replace(/'/g, "&#39;")}'>
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                </button>
                                <button type="button" title="Excluir" class="text-red-500 hover:bg-red-50 p-1.5 rounded-full dark:hover:bg-red-900/30 delete-btn" data-id="${t.public_id}">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');
            },

            onEdit: (data) => {
                getById('productTypeForm').reset();
                const title = getById('modalTitle');
                const form = getById('productTypeForm');

                if (data && data.public_id) {
                    title.textContent = 'Editar Tipo de Produto';
                    getById('productTypeName').value = data.name || '';
                    getById('productTypeDescription').value = data.description || '';
                    getById('productTypeIdprodutotipopos').value = data.idprodutotipopos || '';
                    form.dataset.id = data.public_id;
                } else if (data && data.name) {
                    title.textContent = 'Duplicar Tipo de Produto';
                    getById('productTypeName').value = data.name || '';
                    getById('productTypeDescription').value = data.description || '';
                    getById('productTypeIdprodutotipopos').value = data.idprodutotipopos || '';
                    delete form.dataset.id;
                } else {
                    title.textContent = 'Cadastrar Tipo de Produto';
                    getById('productTypeIdprodutotipopos').value = '';
                    delete form.dataset.id;
                }

                getById('productTypeModal').classList.remove('hidden');
            }
        });

        productTypesManager.init();
    });

    // Form logic
    getById('productTypeForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const saveBtn = getById('saveBtn');
        const form = getById('productTypeForm');
        const payload = {
            name: getById('productTypeName').value,
            description: getById('productTypeDescription').value || null,
            idprodutotipopos: getById('productTypeIdprodutotipopos').value || null
        };

        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';

        try {
            if (form.dataset.id) {
                await api(`/products/product-types/${form.dataset.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                UI.showAlert('alertMessage', 'Tipo de produto atualizado com sucesso!', 'success');
            } else {
                await api('/products/product-types', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                UI.showAlert('alertMessage', 'Tipo de produto salvo com sucesso!', 'success');
            }

            productTypesManager.closeModal();
            productTypesManager.loadData();
        } catch (error: any) {
            alert(error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar';
        }
    });

    // Import from Pos-Control
    getById('btnImportPosControl')?.addEventListener('click', async () => {
        const btn = getById('btnImportPosControl');
        const originalText = btn.innerHTML;
        
        try {
            btn.disabled = true;
            btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Buscando...`;

            const userRes = await api('/auth/me');
            const companyPublicId = userRes.data?.company?.public_id;
            if (!companyPublicId) {
                throw new Error('Empresa do usuário não identificada.');
            }

            const configRes = await api(`/companies/${companyPublicId}/poscontrol-configs`);
            const configs = configRes.data || [];
            if (configs.length === 0) {
                throw new Error('Nenhuma credencial do Pos-Controll configurada. Cadastre-a no menu Minha Empresa > API/Pos-Controll.');
            }

            const activeConfig = configs[0];

            const res = await api(`/companies/${companyPublicId}/poscontrol-sync/import-producttypes`, {
                method: 'POST',
                body: JSON.stringify({
                    configId: activeConfig.id
                })
            });

            alert(`Importação concluída!\n\nImportados: ${res.data.imported}\nIgnoradas (já existentes): ${res.data.skipped}`);
            productTypesManager.loadData();
        } catch (err: any) {
            alert(err.message || 'Erro ao importar tipos de produto do Pos-Controll.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });
})();
