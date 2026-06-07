(function initCategoriesPage() {

let categoriesManager: any;

const getById = (id: string): any => document.getElementById(id);
const qs = (selector: string): any => document.querySelector(selector);
const qsa = (selector: string): any => document.querySelectorAll(selector);
const CATEGORY_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const CATEGORY_IMAGE_ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

let currentCategoryImageBase64: string | null = null;
let categoryImageChanged = false;

function getCategoryImageSrc(category: any): string {
    return category?.image_base64 ? `data:image/jpeg;base64,${category.image_base64}` : '';
}

function getCategoryImageMarkup(category: any, sizeClass = 'w-12 h-12'): string {
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
    if (!preview || !container || !actions || !fileNameLabel) return;

    preview.src = src;
    preview.classList.toggle('hidden', !showPreview);
    container.classList.toggle('hidden', showPreview);
    actions.classList.toggle('hidden', !showPreview);
    actions.classList.toggle('flex', showPreview);
    fileNameLabel.textContent = fileName;
}

function setCategoryImageDropzoneActive(isActive: boolean) {
    const dropzone = getById('categoryImageDropzone');
    if (!dropzone) return;

    dropzone.classList.toggle('border-brand-500', isActive);
    dropzone.classList.toggle('bg-brand-50', isActive);
    dropzone.classList.toggle('dark:border-brand-400', isActive);
    dropzone.classList.toggle('ring-2', isActive);
    dropzone.classList.toggle('ring-brand-100', isActive);
}

function resetCategoryImagePreview() {
    const imageInput = getById('categoryImageFile');
    if (imageInput) imageInput.value = '';
    setCategoryImagePreviewState();
    setCategoryImageDropzoneActive(false);
}

function handleCategoryImageFile(file: File | undefined) {
    if (!file) return;

    if (!CATEGORY_IMAGE_ALLOWED_TYPES.has(file.type)) {
        alert('Formato de imagem inválido. Use PNG, JPG, JPEG ou WEBP.');
        const imageInput = getById('categoryImageFile');
        if (imageInput) imageInput.value = '';
        return;
    }

    if (file.size > CATEGORY_IMAGE_MAX_BYTES) {
        alert('A imagem deve ter no máximo 2MB.');
        const imageInput = getById('categoryImageFile');
        if (imageInput) imageInput.value = '';
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
        
        filterConfig: {
            storageKey: 'categories_filter_panel',
            fields: [
                { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome ou descrição' },
            ]
        },
        
        renderTable: (items) => {
            const tbody = getById('categoriesTable');
            if (items.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhuma categoria cadastrada.</td></tr>`;
                return;
            }

            tbody.innerHTML = items.map((c) => `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap">
                        <input type="checkbox" class="item-checkbox h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 dark:border-slate-600 rounded cursor-pointer" value="${c.public_id}" data-bwignore="true" data-lpignore="true" placeholder="">
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">#${String(c.id).padStart(4, '0')}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${getCategoryImageMarkup(c)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">${c.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">${c.description || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-500 dark:text-gray-400">${c.product_count || 0}</td>
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
            `).join('');
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
                            <span class="text-xs text-gray-400">ID: ${c.id}</span>
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
                form.dataset.id = category.public_id;
                currentCategoryImageBase64 = null;
                categoryImageChanged = false;

                if (category.image_base64) {
                    setCategoryImagePreviewState({
                        src: getCategoryImageSrc(category),
                        fileName: 'Imagem atual da categoria',
                        showPreview: true,
                    });
                } else {
                    resetCategoryImagePreview();
                }
            } else {
                title.textContent = 'Cadastrar Categoria';
                delete form.dataset.id;
                currentCategoryImageBase64 = null;
                categoryImageChanged = false;
                resetCategoryImagePreview();
            }

            getById('categoryModal').classList.remove('hidden');
        }
    });

    categoriesManager.init();
});

// Form Logic
getById('categoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const saveBtn = getById('saveBtn');
    const form = getById('categoryForm');
    const payload: any = {
        name: getById('categoryName').value,
        description: getById('categoryDesc').value || undefined
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
        } else {
            await api('/estoque/categories', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            UI.showAlert('alertMessage', 'Categoria salva com sucesso!', 'success');
        }

        categoriesManager.closeModal();
        categoriesManager.loadData();
    } catch (error) {
        alert(error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar';
    }
});

})();
