(function initCategoriesPage() {
    let categoriesManager;
    const getById = (id) => document.getElementById(id);
    const qs = (selector) => document.querySelector(selector);
    const qsa = (selector) => document.querySelectorAll(selector);
    const CATEGORY_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
    const CATEGORY_IMAGE_ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
    let currentCategoryImageBase64 = null;
    let categoryImageChanged = false;
    function getCategoryImageSrc(category) {
        return category?.image_base64 ? `data:image/jpeg;base64,${category.image_base64}` : '';
    }
    function getCategoryImageMarkup(category, sizeClass = 'w-12 h-12') {
        const imageSrc = getCategoryImageSrc(category);
        if (imageSrc) {
            return `<div class="${sizeClass} rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 overflow-hidden flex items-center justify-center"><img src="${imageSrc}" alt="${category.name || 'Categoria'}" class="w-full h-full object-contain p-1" /></div>`;
        }
        return `<div class="${sizeClass} rounded-lg border border-dashed border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 flex items-center justify-center text-xs font-semibold text-gray-400 dark:text-gray-500">IMG</div>`;
    }
    function setCategoryImagePreviewState({ src = '', fileName = '', showPreview = false } = {}) {
        const preview = getById('categoryImagePreview');
        const container = getById('categoryImagePreviewContainer');
        const actions = getById('categoryImageActions');
        const fileNameLabel = getById('categoryImageFileName');
        if (!preview || !container || !actions || !fileNameLabel)
            return;
        preview.src = src;
        preview.classList.toggle('hidden', !showPreview);
        container.classList.toggle('hidden', showPreview);
        actions.classList.toggle('hidden', !showPreview);
        actions.classList.toggle('flex', showPreview);
        fileNameLabel.textContent = fileName;
    }
    function setCategoryImageDropzoneActive(isActive) {
        const dropzone = getById('categoryImageDropzone');
        if (!dropzone)
            return;
        dropzone.classList.toggle('border-brand-500', isActive);
        dropzone.classList.toggle('bg-brand-50', isActive);
        dropzone.classList.toggle('dark:border-brand-400', isActive);
        dropzone.classList.toggle('ring-2', isActive);
        dropzone.classList.toggle('ring-brand-100', isActive);
    }
    function resetCategoryImagePreview() {
        const imageInput = getById('categoryImageFile');
        if (imageInput)
            imageInput.value = '';
        setCategoryImagePreviewState();
        setCategoryImageDropzoneActive(false);
    }
    function handleCategoryImageFile(file) {
        if (!file)
            return;
        if (!CATEGORY_IMAGE_ALLOWED_TYPES.has(file.type)) {
            alert('Formato de imagem inválido. Use PNG, JPG, JPEG ou WEBP.');
            const imageInput = getById('categoryImageFile');
            if (imageInput)
                imageInput.value = '';
            return;
        }
        if (file.size > CATEGORY_IMAGE_MAX_BYTES) {
            alert('A imagem deve ter no máximo 2MB.');
            const imageInput = getById('categoryImageFile');
            if (imageInput)
                imageInput.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (evt) => {
            const result = String(evt.target?.result || '');
            if (!result.includes(',')) {
                alert('Não foi possível processar a imagem selecionada.');
                return;
            }
            currentCategoryImageBase64 = result.split(',')[1];
            categoryImageChanged = true;
            setCategoryImagePreviewState({
                src: result,
                fileName: file.name,
                showPreview: true,
            });
        };
        reader.readAsDataURL(file);
    }
    document.addEventListener('DOMContentLoaded', () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }
        const imageInput = getById('categoryImageFile');
        if (imageInput) {
            imageInput.addEventListener('change', (event) => {
                const file = event.target?.files?.[0];
                handleCategoryImageFile(file);
            });
        }
        const imageDropzone = getById('categoryImageDropzone');
        if (imageDropzone) {
            ['dragenter', 'dragover'].forEach((eventName) => {
                imageDropzone.addEventListener(eventName, (event) => {
                    event.preventDefault();
                    setCategoryImageDropzoneActive(true);
                });
            });
            ['dragleave', 'drop'].forEach((eventName) => {
                imageDropzone.addEventListener(eventName, (event) => {
                    event.preventDefault();
                    setCategoryImageDropzoneActive(false);
                });
            });
            imageDropzone.addEventListener('drop', (event) => {
                const file = event.dataTransfer?.files?.[0];
                handleCategoryImageFile(file);
            });
        }
        const btnRemoveImage = getById('btnRemoveCategoryImage');
        if (btnRemoveImage) {
            btnRemoveImage.addEventListener('click', () => {
                currentCategoryImageBase64 = null;
                categoryImageChanged = true;
                resetCategoryImagePreview();
            });
        }
        categoriesManager = new CrudManager({
            entityName: 'Categoria',
            endpoint: '/estoque/categories',
            tableId: 'categoriesTable',
            gridSectionId: 'categoriesGridSection',
            tableSectionId: 'categoriesSection',
            modalId: 'categoryModal',
            defaultView: 'list',
            filterConfig: {
                storageKey: 'categories_filter_panel',
                fields: [
                    { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome ou descrição' },
                ]
            },
            renderTable: (items) => {
                hideBulkDeleteButton();
                const tbody = getById('categoriesTable');
                if (items.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="9" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhuma categoria cadastrada.</td></tr>`;
                    return;
                }
                tbody.innerHTML = items.map((c) => {
                    const poscontrolBadge = (c.poscontrol_synced && c.idgrupopos)
                        ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Sincronizado</span>`
                        : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Pendente</span>`;
                    const statusBadge = c.active === 0 || c.active === false
                        ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Inativo</span>`
                        : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Ativo</span>`;
                    return `
                    <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td class="px-6 py-4 whitespace-nowrap">
                            <input type="checkbox" class="item-checkbox h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 dark:border-slate-600 rounded cursor-pointer" value="${c.public_id}" data-bwignore="true" data-lpignore="true" placeholder="">
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">#${String(c.id).padStart(4, '0')}</td>
                        <td class="px-6 py-4 whitespace-nowrap">${getCategoryImageMarkup(c)}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">${c.name}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">${c.description || '-'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-gray-400 truncate max-w-xs">${c.idgrupopos || '-'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-500 dark:text-gray-400">${c.product_count || 0}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">${poscontrolBadge}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">${statusBadge}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button type="button" title="Editar" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-3 edit-btn" data-item='${JSON.stringify(c).replace(/'/g, "&#39;")}'>
                                <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </button>
                            <button type="button" title="Duplicar" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mr-3 duplicate-btn" data-item='${JSON.stringify(c).replace(/'/g, "&#39;")}'>
                                <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                            </button>
                            <button type="button" title="Excluir" class="text-red-600 hover:text-red-900 dark:hover:text-red-400 delete-btn" data-id="${c.public_id}">
                                <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </td>
                    </tr>
                `;
                }).join('');
            },
            renderGrid: (items) => {
                const grid = getById('categoriesGridSection');
                if (items.length === 0) {
                    grid.innerHTML = `<div class="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">Nenhuma categoria encontrada.</div>`;
                    return;
                }
                grid.innerHTML = items.map((c) => `
                <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col border border-gray-100 dark:border-slate-700 relative group">
                    <div class="mb-4 flex items-start justify-between gap-3">
                        ${getCategoryImageMarkup(c, 'w-16 h-16')}
                        <div class="min-w-0 flex-1">
                            <h4 class="text-lg font-bold text-gray-900 dark:text-gray-100 truncate pr-14">${c.name}</h4>
                            <div class="flex flex-wrap items-center gap-2 mt-1">
                                <span class="text-xs text-gray-400">ID: ${c.id}</span>
                                ${c.idgrupopos ? `<span class="text-xs font-mono text-gray-400 dark:text-gray-500">POS ID: ${c.idgrupopos}</span>` : ''}
                                 ${(c.poscontrol_synced && c.idgrupopos)
                    ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">POS: Sincronizado</span>`
                    : `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">POS: Pendente</span>`}
                            </div>
                        </div>
                    </div>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">${c.description || 'Sem descrição'}</p>
                    <div class="mt-auto pt-3 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center text-xs text-gray-400">
                        <span>${c.image_base64 ? 'Com imagem' : 'Sem imagem'}</span>
                        <span class="ml-2 font-bold text-brand-600 dark:text-brand-400">${c.product_count || 0} produtos</span>
                        <div class="flex space-x-2">
                            <button type="button" title="Editar" class="text-brand-600 hover:bg-brand-50 p-1.5 rounded-full dark:hover:bg-brand-900/30 edit-btn" data-item='${JSON.stringify(c).replace(/'/g, "&#39;")}'>
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </button>
                            <button type="button" title="Duplicar" class="text-gray-500 hover:bg-gray-100 p-1.5 rounded-full dark:hover:bg-slate-700 dark:text-gray-400 duplicate-btn" data-item='${JSON.stringify(c).replace(/'/g, "&#39;")}'>
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                            </button>
                            <button type="button" title="Excluir" class="text-red-500 hover:bg-red-50 p-1.5 rounded-full dark:hover:bg-red-900/30 delete-btn" data-id="${c.public_id}">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
            },
            onEdit: (category) => {
                getById('categoryForm').reset();
                const title = getById('modalTitle');
                const form = getById('categoryForm');
                if (category) {
                    title.textContent = 'Editar Categoria';
                    getById('categoryName').value = category.name || '';
                    getById('categoryDesc').value = category.description || '';
                    getById('categoryIdgrupopos').value = category.idgrupopos || '';
                    getById('categoryActive').checked = category.active !== 0 && category.active !== false;
                    form.dataset.id = category.public_id;
                    currentCategoryImageBase64 = null;
                    categoryImageChanged = false;
                    if (category.image_base64) {
                        setCategoryImagePreviewState({
                            src: getCategoryImageSrc(category),
                            fileName: 'Imagem atual da categoria',
                            showPreview: true,
                        });
                    }
                    else {
                        resetCategoryImagePreview();
                    }
                }
                else {
                    title.textContent = 'Cadastrar Categoria';
                    delete form.dataset.id;
                    getById('categoryIdgrupopos').value = '';
                    getById('categoryActive').checked = true;
                    currentCategoryImageBase64 = null;
                    categoryImageChanged = false;
                    resetCategoryImagePreview();
                }
                getById('categoryModal').classList.remove('hidden');
            }
        });
        function hideBulkDeleteButton() {
            const btnBulkActions = getById('btnBulkActions');
            if (btnBulkActions) {
                btnBulkActions.classList.add('hidden');
                btnBulkActions.classList.remove('inline-flex', 'items-center', 'justify-center');
            }
            const bulkActionsMenu = getById('bulkActionsMenu');
            if (bulkActionsMenu) {
                bulkActionsMenu.classList.add('hidden');
            }
        }
        // Event delegation for checkbox changes
        document.addEventListener('change', (e) => {
            const target = e.target;
            if (target && (target.id === 'selectAll' || target.classList.contains('item-checkbox'))) {
                setTimeout(() => {
                    const checkedCount = qsa('.item-checkbox:checked').length;
                    const btnBulkActions = getById('btnBulkActions');
                    const bulkActionsCount = getById('bulkActionsCount');
                    const bulkActionsMenu = getById('bulkActionsMenu');
                    if (btnBulkActions) {
                        if (checkedCount > 0) {
                            btnBulkActions.classList.remove('hidden');
                            btnBulkActions.classList.add('inline-flex', 'items-center', 'justify-center');
                            if (bulkActionsCount)
                                bulkActionsCount.textContent = checkedCount;
                        }
                        else {
                            btnBulkActions.classList.add('hidden');
                            btnBulkActions.classList.remove('inline-flex', 'items-center', 'justify-center');
                            if (bulkActionsMenu)
                                bulkActionsMenu.classList.add('hidden');
                        }
                    }
                }, 50);
            }
        });
        // Dropdown toggle logic
        const btnBulkActions = getById('btnBulkActions');
        const bulkActionsMenu = getById('bulkActionsMenu');
        btnBulkActions?.addEventListener('click', (e) => {
            e.stopPropagation();
            bulkActionsMenu?.classList.toggle('hidden');
        });
        document.addEventListener('click', () => {
            bulkActionsMenu?.classList.add('hidden');
        });
        const btnBulkDelete = getById('btnBulkDelete');
        if (btnBulkDelete) {
            btnBulkDelete.addEventListener('click', async () => {
                const selectedIds = Array.from(qsa('.item-checkbox:checked')).map((cb) => cb.value);
                if (selectedIds.length === 0)
                    return;
                if (confirm(`Deseja realmente excluir ${selectedIds.length} categoria(s) selecionada(s) em lote?`)) {
                    const originalHtml = btnBulkDelete.innerHTML;
                    btnBulkDelete.disabled = true;
                    btnBulkDelete.textContent = 'Excluindo...';
                    try {
                        const response = await api('/estoque/categories/bulk-delete', {
                            method: 'POST',
                            body: JSON.stringify({ categoryIds: selectedIds })
                        });
                        UI.showAlert('alertMessage', response.message || 'Categorias excluídas com sucesso!', 'success');
                        // Hide bulk button
                        hideBulkDeleteButton();
                        await categoriesManager.loadData();
                    }
                    catch (error) {
                        UI.showAlert('alertMessage', error.message || 'Erro ao excluir categorias em lote.', 'error');
                    }
                    finally {
                        btnBulkDelete.disabled = false;
                        btnBulkDelete.innerHTML = originalHtml;
                    }
                }
            });
        }
        const btnBulkInactivate = getById('btnBulkInactivate');
        if (btnBulkInactivate) {
            btnBulkInactivate.addEventListener('click', async () => {
                const selectedIds = Array.from(qsa('.item-checkbox:checked')).map((cb) => String(cb.value));
                if (selectedIds.length === 0)
                    return;
                if (confirm(`Deseja realmente inativar ${selectedIds.length} categoria(s) selecionada(s) localmente e transmitir para o Pos-Control?`)) {
                    const originalHtml = btnBulkInactivate.innerHTML;
                    btnBulkInactivate.disabled = true;
                    btnBulkInactivate.innerHTML = 'Inativando...';
                    try {
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
                        const response = await api(`/companies/${companyPublicId}/poscontrol-sync/inactivate-categories`, {
                            method: 'POST',
                            body: JSON.stringify({
                                configId: activeConfig.id,
                                categoryIds: selectedIds
                            })
                        });
                        UI.showAlert('alertMessage', `Inativadas localmente: ${response.data.updatedCount}. Transmitidas ao Pos-Control: ${response.data.transmittedCount}.`, 'success');
                        // Hide bulk actions dropdown
                        hideBulkDeleteButton();
                        await categoriesManager.loadData();
                    }
                    catch (error) {
                        UI.showAlert('alertMessage', error.message || 'Erro ao inativar categorias em lote.', 'error');
                    }
                    finally {
                        btnBulkInactivate.disabled = false;
                        btnBulkInactivate.innerHTML = originalHtml;
                    }
                }
            });
        }
        const btnPosControl = getById('btnPosControl');
        if (btnPosControl) {
            btnPosControl.addEventListener('click', () => {
                const selectedIds = Array.from(qsa('.item-checkbox:checked')).map((cb) => String(cb.value));
                const allCategories = categoriesManager.data || [];
                const selectedCategories = allCategories.filter((c) => selectedIds.includes(String(c.public_id)) || selectedIds.includes(String(c.id)));
                if (selectedCategories.length === 0) {
                    alert('Nenhuma categoria selecionada.');
                    return;
                }
                const productGroups = selectedCategories.map((c) => {
                    return {
                        productGroupID: c.idgrupopos ? String(c.idgrupopos) : null,
                        StatusID: (c.active !== 0 && c.active !== false && c.active !== '0')
                            ? 'ABCDEABC-ABCD-ABCD-ABCD-ABCED1758966'
                            : 'ABCDEABC-ABCD-ABCD-ABCD-ABCED1457822',
                        Name: String(c.name || ''),
                        ImageGroupBase64: c.image_base64 ? String(c.image_base64) : null
                    };
                });
                const posControlPayload = {
                    ProductGroups: productGroups
                };
                const textarea = getById('posControlJsonTextarea');
                const modalCount = getById('posControlModalCount');
                if (textarea) {
                    textarea.value = JSON.stringify(posControlPayload, null, 4);
                }
                if (modalCount) {
                    modalCount.textContent = selectedCategories.length;
                }
                const endpointInput = getById('posControlEndpointInput');
                const jwtInput = getById('posControlJwtInput');
                if (endpointInput)
                    endpointInput.value = 'Carregando...';
                if (jwtInput)
                    jwtInput.value = 'Carregando...';
                api('/auth/me')
                    .then(userRes => {
                    const companyPublicId = userRes.data?.company?.public_id;
                    if (companyPublicId) {
                        return api(`/companies/${companyPublicId}/poscontrol-sync/debug-info`);
                    }
                    throw new Error('Empresa não identificada.');
                })
                    .then(debugRes => {
                    if (debugRes.status === 'success' && debugRes.data) {
                        if (endpointInput)
                            endpointInput.value = debugRes.data.endpoint || '';
                        if (jwtInput)
                            jwtInput.value = debugRes.data.jwt || '';
                    }
                    else {
                        if (endpointInput)
                            endpointInput.value = 'Erro ao carregar';
                        if (jwtInput)
                            jwtInput.value = 'Erro ao carregar';
                    }
                })
                    .catch(err => {
                    console.error('Erro debug pos-control:', err);
                    if (endpointInput)
                        endpointInput.value = 'Erro ao carregar';
                    if (jwtInput)
                        jwtInput.value = 'Erro ao carregar';
                });
                const modal = getById('posControlModal');
                if (modal)
                    modal.classList.remove('hidden');
            });
        }
        const closePosControlModal = () => {
            const modal = getById('posControlModal');
            if (modal)
                modal.classList.add('hidden');
        };
        const showPosControlErrorModal = (errorText) => {
            const modal = getById('posControlErrorModal');
            const textarea = getById('posControlErrorTextarea');
            if (textarea) {
                try {
                    const parsed = JSON.parse(errorText);
                    textarea.value = JSON.stringify(parsed, null, 4);
                }
                catch {
                    textarea.value = errorText;
                }
            }
            if (modal)
                modal.classList.remove('hidden');
        };
        const closePosControlErrorModal = () => {
            const modal = getById('posControlErrorModal');
            if (modal)
                modal.classList.add('hidden');
        };
        getById('btnCancelPosControlModal')?.addEventListener('click', closePosControlModal);
        getById('btnClosePosControlModalX')?.addEventListener('click', closePosControlModal);
        getById('posControlModalBackdrop')?.addEventListener('click', closePosControlModal);
        getById('btnClosePosControlErrorModalX')?.addEventListener('click', closePosControlErrorModal);
        getById('btnClosePosControlErrorModal')?.addEventListener('click', closePosControlErrorModal);
        getById('posControlErrorModalBackdrop')?.addEventListener('click', closePosControlErrorModal);
        getById('btnCopyPosControlJson')?.addEventListener('click', () => {
            const textarea = getById('posControlJsonTextarea');
            if (textarea && textarea.value) {
                navigator.clipboard.writeText(textarea.value).then(() => {
                    const btn = getById('btnCopyPosControlJson');
                    if (btn) {
                        const originalText = btn.innerHTML;
                        btn.innerHTML = `
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                        Copiado!
                    `;
                        setTimeout(() => {
                            btn.innerHTML = originalText;
                        }, 2000);
                    }
                }).catch(() => {
                    alert('Erro ao copiar JSON.');
                });
            }
        });
        getById('btnCopyPosControlEndpoint')?.addEventListener('click', () => {
            const input = getById('posControlEndpointInput');
            if (input && input.value && input.value !== 'Carregando...' && input.value !== 'Erro ao carregar') {
                navigator.clipboard.writeText(input.value).then(() => {
                    const btn = getById('btnCopyPosControlEndpoint');
                    if (btn) {
                        const originalText = btn.textContent;
                        btn.textContent = 'Copiado!';
                        setTimeout(() => { btn.textContent = originalText; }, 2000);
                    }
                });
            }
        });
        getById('btnCopyPosControlJwt')?.addEventListener('click', () => {
            const input = getById('posControlJwtInput');
            if (input && input.value && input.value !== 'Carregando...' && input.value !== 'Erro ao carregar') {
                navigator.clipboard.writeText(input.value).then(() => {
                    const btn = getById('btnCopyPosControlJwt');
                    if (btn) {
                        const originalText = btn.textContent;
                        btn.textContent = 'Copiado!';
                        setTimeout(() => { btn.textContent = originalText; }, 2000);
                    }
                });
            }
        });
        getById('btnSyncPosControl')?.addEventListener('click', async () => {
            const btn = getById('btnSyncPosControl');
            const originalText = btn.innerHTML;
            try {
                btn.disabled = true;
                btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Enviando...`;
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
                const textarea = getById('posControlJsonTextarea');
                if (!textarea || !textarea.value) {
                    throw new Error('Nenhum JSON de categoria gerado.');
                }
                const categories = JSON.parse(textarea.value);
                const selectedIds = Array.from(qsa('.item-checkbox:checked')).map((cb) => String(cb.value));
                await api(`/companies/${companyPublicId}/poscontrol-sync/categories`, {
                    method: 'POST',
                    body: JSON.stringify({
                        configId: activeConfig.id,
                        categories,
                        categoryIds: selectedIds
                    })
                });
                alert('Sincronização concluída com sucesso!');
                closePosControlModal();
                window.location.reload();
            }
            catch (err) {
                let errorText = err.message || 'Erro ao sincronizar categorias.';
                if (err.response) {
                    try {
                        const resData = await err.response.json();
                        errorText = JSON.stringify(resData);
                    }
                    catch { }
                }
                showPosControlErrorModal(errorText);
            }
            finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
        let g_importCompanyPublicId = null;
        let g_importConfigId = null;
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
                g_importCompanyPublicId = companyPublicId;
                g_importConfigId = activeConfig.id;
                const res = await api(`/companies/${companyPublicId}/poscontrol-sync/fetch-categories`, {
                    method: 'POST',
                    body: JSON.stringify({
                        configId: activeConfig.id
                    })
                });
                const importTextarea = getById('posControlImportJsonTextarea');
                if (importTextarea) {
                    importTextarea.value = JSON.stringify(res.data, null, 4);
                }
                const importModal = getById('posControlImportModal');
                if (importModal)
                    importModal.classList.remove('hidden');
            }
            catch (err) {
                alert(err.message || 'Erro ao buscar categorias do Pos-Controll.');
            }
            finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
        const closePosControlImportModal = () => {
            const modal = getById('posControlImportModal');
            if (modal)
                modal.classList.add('hidden');
        };
        getById('btnCancelPosControlImportModal')?.addEventListener('click', closePosControlImportModal);
        getById('btnClosePosControlImportModalX')?.addEventListener('click', closePosControlImportModal);
        getById('posControlImportModalBackdrop')?.addEventListener('click', closePosControlImportModal);
        getById('btnConfirmPosControlImport')?.addEventListener('click', async () => {
            const btn = getById('btnConfirmPosControlImport');
            const originalText = btn.innerHTML;
            try {
                btn.disabled = true;
                btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Importando...`;
                if (!g_importCompanyPublicId || !g_importConfigId) {
                    throw new Error('Estado de importação inválido.');
                }
                const textarea = getById('posControlImportJsonTextarea');
                if (!textarea || !textarea.value) {
                    throw new Error('Nenhum JSON de categorias fornecido.');
                }
                const categories = JSON.parse(textarea.value);
                const res = await api(`/companies/${g_importCompanyPublicId}/poscontrol-sync/import-categories`, {
                    method: 'POST',
                    body: JSON.stringify({
                        configId: g_importConfigId,
                        categories
                    })
                });
                alert(`Importação concluída com sucesso!\n\nCategorias Importadas: ${res.data.imported}\nCategorias Atualizadas: ${res.data.updated}\nFalhas: ${res.data.failed || 0}`);
                closePosControlImportModal();
                window.location.reload();
            }
            catch (err) {
                alert(err.message || 'Erro ao importar categorias.');
            }
            finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
        categoriesManager.init();
    });
    // Form Logic
    getById('categoryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = getById('saveBtn');
        const form = getById('categoryForm');
        const payload = {
            name: getById('categoryName').value,
            description: getById('categoryDesc').value || undefined,
            idgrupopos: getById('categoryIdgrupopos').value || null,
            active: getById('categoryActive').checked
        };
        if (categoryImageChanged) {
            payload.image_base64 = currentCategoryImageBase64;
        }
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';
        try {
            if (form.dataset.id) {
                await api(`/estoque/categories/${form.dataset.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                UI.showAlert('alertMessage', 'Categoria atualizada com sucesso!', 'success');
            }
            else {
                await api('/estoque/categories', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                UI.showAlert('alertMessage', 'Categoria salva com sucesso!', 'success');
            }
            categoriesManager.closeModal();
            categoriesManager.loadData();
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
