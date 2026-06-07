(function initManufacturersPage() {
    let manufacturersManager;
    const getById = (id) => document.getElementById(id);
    const qs = (selector) => document.querySelector(selector);
    const qsa = (selector) => document.querySelectorAll(selector);
    document.addEventListener('DOMContentLoaded', () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }
        manufacturersManager = new CrudManager({
            entityName: 'Fabricante',
            endpoint: '/estoque/manufacturers',
            tableId: 'manufacturersTable',
            gridSectionId: 'manufacturersGridSection',
            tableSectionId: 'manufacturersSection',
            modalId: 'manufacturerModal',
            filterConfig: {
                storageKey: 'manufacturers_filter_panel',
                fields: [
                    { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome, CNPJ, e-mail ou telefone' },
                ]
            },
            renderTable: (items) => renderTable('manufacturersTable', items),
            renderGrid: (items) => renderGrid('manufacturersGridSection', items),
            onEdit: (data) => {
                const isEdit = data && data.public_id;
                getById('modalTitle').textContent = isEdit ? 'Editar Fabricante' : (data ? 'Duplicar Fabricante' : 'Novo Fabricante');
                const form = getById('manufacturerForm');
                if (data) {
                    getById('manufacturerName').value = data.name || '';
                    getById('manufacturerCNPJ').value = data.cnpj || '';
                    getById('manufacturerPhone').value = data.phone || '';
                    getById('manufacturerEmail').value = data.email || '';
                    form.dataset.id = data.public_id;
                    setImagePreview(data.image_base64 || null);
                }
                else {
                    form.reset();
                    delete form.dataset.id;
                    setImagePreview(null);
                }
                getById('manufacturerModal').classList.remove('hidden');
            }
        });
        manufacturersManager.init();
        initImageUpload();
    });
    getById('manufacturerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = getById('saveBtn');
        const form = getById('manufacturerForm');
        const payload = {
            name: getById('manufacturerName').value,
            cnpj: getById('manufacturerCNPJ').value || undefined,
            phone: getById('manufacturerPhone').value || undefined,
            email: getById('manufacturerEmail').value || undefined,
            image_base64: getById('manufacturerImageBase64').value || undefined
        };
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';
        try {
            if (form.dataset.id) {
                // Edit Mode
                await api(`/estoque/manufacturers/${form.dataset.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                UI.showAlert('alertMessage', 'Fabricante atualizado com sucesso!', 'success');
            }
            else {
                // Create Mode
                await api('/estoque/manufacturers', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                UI.showAlert('alertMessage', 'Fabricante salvo com sucesso!', 'success');
            }
            manufacturersManager.closeModal();
            manufacturersManager.loadData();
        }
        catch (error) {
            alert(error.message);
        }
        finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar';
        }
    });
    function renderTable(elementId, items) {
        const tbody = getById(elementId);
        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum fabricante cadastrado.</td></tr>`;
            return;
        }
        tbody.innerHTML = items.map(m => `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
            <td class="px-6 py-4 whitespace-nowrap">
                <input type="checkbox" class="item-checkbox h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 dark:border-slate-600 rounded cursor-pointer" value="${m.public_id}" data-bwignore="true" data-lpignore="true" placeholder="">
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">#${String(m.id).padStart(4, '0')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">
                <div class="flex items-center gap-3">
                    ${m.image_base64 ? `<img src="${m.image_base64}" alt="${m.name}" class="w-8 h-8 rounded object-contain border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 shrink-0">` : '<div class="w-8 h-8 rounded border border-dashed border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 shrink-0"></div>'}
                    <div>${m.name}${m.cnpj ? `<br/><span class="text-xs font-normal text-gray-500">CNPJ: ${m.cnpj}</span>` : ''}</div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                ${m.email ? m.email : ''}${m.email && m.phone ? '<br/>' : ''}${m.phone ? m.phone : ''}${!m.email && !m.phone ? '-' : ''}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-500 dark:text-gray-400">${m.product_count || 0}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button type="button" title="Editar" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-3 edit-btn" data-item='${JSON.stringify(m).replace(/'/g, "&#39;")}'>
                    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button type="button" title="Duplicar" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mr-3 duplicate-btn" data-item='${JSON.stringify(m).replace(/'/g, "&#39;")}'>
                    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                </button>
                <button type="button" title="Excluir" class="text-red-600 hover:text-red-900 dark:hover:text-red-400 delete-btn" data-id="${m.public_id}">
                    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </td>
        </tr>
    `).join('');
        // Setup select all logic
        if (manufacturersManager)
            manufacturersManager._bindActionEvents();
    }
    function renderGrid(elementId, items) {
        const grid = getById(elementId);
        if (items.length === 0) {
            grid.innerHTML = `<div class="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">Nenhum fabricante encontrado.</div>`;
            return;
        }
        grid.innerHTML = items.map(m => `
        <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col border border-gray-100 dark:border-slate-700 relative group">
            ${m.image_base64 ? `<div class="w-12 h-12 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 mb-3 overflow-hidden flex items-center justify-center"><img src="${m.image_base64}" alt="${m.name}" class="w-full h-full object-contain p-0.5"></div>` : ''}
            <h4 class="text-lg font-bold text-gray-900 dark:text-gray-100 truncate mb-2 pr-14">${m.name}</h4>
            <div class="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                ${m.cnpj ? `<p><span class="text-xs text-gray-400">CNPJ:</span> ${m.cnpj}</p>` : ''}
                ${m.phone ? `<p><span class="text-xs text-gray-400">Fone:</span> ${m.phone}</p>` : ''}
                ${m.email ? `<p><span class="text-xs text-gray-400">Email:</span> ${m.email}</p>` : ''}
            </div>
            
            <div class="mt-4 pt-3 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                <span class="font-medium bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-full">${m.product_count || 0} produtos ativos</span>
            </div>
            
            <div class="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700 flex justify-end space-x-2">
                <button type="button" title="Editar" class="text-brand-600 hover:bg-brand-50 p-1.5 rounded-full dark:hover:bg-brand-900/30 edit-btn" data-item='${JSON.stringify(m).replace(/'/g, "&#39;")}'>
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button type="button" title="Duplicar" class="text-gray-500 hover:bg-gray-100 p-1.5 rounded-full dark:hover:bg-slate-700 dark:text-gray-400 duplicate-btn" data-item='${JSON.stringify(m).replace(/'/g, "&#39;")}'>
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                </button>
                <button type="button" title="Excluir" class="text-red-500 hover:bg-red-50 p-1.5 rounded-full dark:hover:bg-red-900/30 delete-btn" data-id="${m.public_id}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        </div>
    `).join('');
    }
})();
function setImagePreview(src) {
    const preview = document.getElementById('manufacturerImgPreview');
    const placeholder = document.getElementById('manufacturerImgPlaceholder');
    const clearBtn = document.getElementById('manufacturerImgClear');
    const hidden = document.getElementById('manufacturerImageBase64');
    const fileInput = document.getElementById('manufacturerImgInput');
    if (!preview || !placeholder || !clearBtn || !hidden)
        return;
    if (src) {
        hidden.value = src;
        preview.src = src;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
        clearBtn.classList.remove('hidden');
    }
    else {
        hidden.value = '';
        preview.src = '';
        preview.classList.add('hidden');
        placeholder.classList.remove('hidden');
        clearBtn.classList.add('hidden');
        if (fileInput)
            fileInput.value = '';
    }
}
function initImageUpload() {
    const fileInput = document.getElementById('manufacturerImgInput');
    const clearBtn = document.getElementById('manufacturerImgClear');
    if (!fileInput || !clearBtn)
        return;
    fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file)
            return;
        if (file.size > 2 * 1024 * 1024) {
            alert('A imagem deve ter no máximo 2 MB.');
            fileInput.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => setImagePreview(e.target.result);
        reader.readAsDataURL(file);
    });
    clearBtn.addEventListener('click', () => setImagePreview(null));
}
