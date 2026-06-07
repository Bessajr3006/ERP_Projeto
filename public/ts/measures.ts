(() => {
    const getById = (id: string): any => document.getElementById(id);
    const qs = (selector: string): any => document.querySelector(selector);
    const qsa = (selector: string): any => document.querySelectorAll(selector);

    let measuresManager: any;

    document.addEventListener('DOMContentLoaded', () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '/';
        return;
    }

    measuresManager = new CrudManager({
        entityName: 'Medida',
        endpoint: '/estoque/measures',
        tableId: 'measuresTable',
        gridSectionId: 'measuresGridSection',
        tableSectionId: 'measuresSection',
        modalId: 'measureModal',
        
        filterConfig: {
            storageKey: 'measures_filter_panel',
            fields: [
                { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome ou sigla' },
            ]
        },

        renderTable: (items) => {
            const tbody = getById('measuresTable');
            if (items.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhuma medida cadastrada.</td></tr>`;
                return;
            }

            tbody.innerHTML = items.map((m) => `
                <tr class="hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors group">
                    <td class="px-6 py-4 whitespace-nowrap">
                        <input type="checkbox" value="${m.public_id}" class="item-checkbox rounded border-gray-300 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800 dark:border-slate-600" data-bwignore="true" data-lpignore="true" placeholder="">
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">#${m.id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">${m.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-gray-400">
                        <span class="bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded text-xs">${m.abbreviation}</span>
                    </td>
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
        },

        renderGrid: (items) => {
            const grid = getById('measuresGridSection');
            if (items.length === 0) {
                grid.innerHTML = `<div class="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">Nenhuma medida encontrada.</div>`;
                return;
            }

            grid.innerHTML = items.map((m) => `
                <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col border border-gray-100 dark:border-slate-700 relative group hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors">
                    <div class="absolute top-4 left-4 z-10 flex items-center">
                        <input type="checkbox" value="${m.public_id}" class="item-checkbox rounded border-gray-300 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800 dark:border-slate-600" data-bwignore="true" data-lpignore="true" placeholder="">
                    </div>
                    <h4 class="text-lg font-bold text-gray-900 dark:text-gray-100 truncate mb-1 pl-8 pr-14">${m.name} <span class="text-xs font-mono ml-2 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-md text-gray-500 dark:text-gray-400">${m.abbreviation}</span></h4>
                    <div class="mt-auto pt-4 flex justify-between items-center text-xs text-gray-400">
                        <span class="pl-8">ID: ${m.id}</span>
                        <div class="flex space-x-2">
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
                </div>
            `).join('');
        },

        onEdit: (data) => {
            getById('measureForm').reset();
            const title = getById('modalTitle');
            const form = getById('measureForm');

            if (data && data.public_id) {
                title.textContent = 'Editar Medida';
                getById('measureName').value = data.name || '';
                getById('measureAbbr').value = data.abbreviation || '';
                form.dataset.id = data.public_id;
            } else if (data && data.name) {
                title.textContent = 'Duplicar Medida';
                getById('measureName').value = data.name || '';
                getById('measureAbbr').value = data.abbreviation || '';
                delete form.dataset.id;
            } else {
                title.textContent = 'Cadastrar Medida';
                delete form.dataset.id;
            }

            getById('measureModal').classList.remove('hidden');
        }
    });

    measuresManager.init();
});

// Form Logic
getById('measureForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const saveBtn = getById('saveBtn');
    const form = getById('measureForm');
    const payload = {
        name: getById('measureName').value,
        abbreviation: getById('measureAbbr').value
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando...';

    try {
        if (form.dataset.id) {
            await api(`/estoque/measures/${form.dataset.id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            UI.showAlert('alertMessage', 'Medida atualizada com sucesso!', 'success');
        } else {
            await api('/estoque/measures', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            UI.showAlert('alertMessage', 'Medida salva com sucesso!', 'success');
        }

        measuresManager.closeModal();
        measuresManager.loadData();
    } catch (error) {
        alert(error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar';
    }
});

})();
