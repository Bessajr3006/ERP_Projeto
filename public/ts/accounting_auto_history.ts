/// <reference path="./api.ts" />
/// <reference path="./components/crud-manager.ts" />

(() => {
    let histories: any[] = [];
    
    let isEditing = false;
    let editingId: string | null = null;
    
    // UI Elements
    const historiesTable = document.getElementById('historiesTable') as HTMLTableSectionElement;
    const btnOpenModal = document.getElementById('btnOpenModal');
    const historyModal = document.getElementById('historyModal');
    const historyModalBackdrop = document.getElementById('historyModalBackdrop');
    const btnCancelHistory = document.getElementById('btnCancelHistory');
    const historyForm = document.getElementById('historyForm') as HTMLFormElement;
    const historyModalTitle = document.getElementById('historyModalTitle');
    
    async function loadHistories() {
        try {
            if (historiesTable) historiesTable.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500 dark:text-gray-400">Carregando...</td></tr>';
            const data = await api('/accounting/histories');
            histories = data?.data || [];
            renderHistories();
        } catch (e) {
            if (historiesTable) historiesTable.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500">Erro ao carregar dados.</td></tr>';
            console.error(e);
        }
    }
    
    function renderHistories() {
        if (!historiesTable) return;
        
        if (histories.length === 0) {
            historiesTable.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500 dark:text-gray-400">Nenhum histórico padrão encontrado.</td></tr>';
            return;
        }
        
        historiesTable.innerHTML = histories.map(h => `
            <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium">${h.code || ''}</td>
                <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">${h.description || ''}</td>
                <td class="px-4 py-3 text-sm text-center">
                    <span class="px-2 py-1 rounded-full text-[10px] font-semibold uppercase ${h.active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-gray-300'}">
                        ${h.active ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td class="px-4 py-3 text-sm text-center">
                    <button type="button" class="text-brand-600 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300 mr-3 font-medium transition-colors btn-edit" data-id="${h.id}">Editar</button>
                    <button type="button" class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium transition-colors btn-delete" data-id="${h.id}">Excluir</button>
                </td>
            </tr>
        `).join('');
        
        historiesTable.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = (e.currentTarget as HTMLButtonElement).getAttribute('data-id');
                if (id) openEditModal(id);
            });
        });
        
        historiesTable.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = (e.currentTarget as HTMLButtonElement).getAttribute('data-id');
                if (id) deleteHistory(id);
            });
        });
    }
    
    function closeModal() {
        if (historyModal) historyModal.classList.add('hidden');
    }
    
    function openNewModal() {
        isEditing = false;
        editingId = null;
        if (historyModalTitle) historyModalTitle.textContent = 'Novo Histórico Automático';
        
        if (historyForm) historyForm.reset();
        
        if (historyModal) historyModal.classList.remove('hidden');
    }
    
    async function openEditModal(id: string) {
        isEditing = true;
        editingId = id;
        if (historyModalTitle) historyModalTitle.textContent = 'Editar Histórico Automático';
        
        try {
            const data = await api(`/accounting/histories/${id}`);
            const h = data.data;
            
            (document.getElementById('historyId') as HTMLInputElement).value = h.public_id;
            (document.getElementById('historyCode') as HTMLInputElement).value = h.code;
            (document.getElementById('historyDescription') as HTMLInputElement).value = h.description;
            (document.getElementById('historyText') as HTMLInputElement).value = h.history_text;
            (document.getElementById('historyActive') as HTMLInputElement).checked = !!h.active;
            
            if (historyModal) historyModal.classList.remove('hidden');
            
        } catch (e) {
            console.error('Failed to fetch history', e);
            // @ts-ignore
            if(typeof Swal !== 'undefined') Swal.fire('Erro', 'Não foi possível carregar os dados.', 'error');
        }
    }
    
    async function deleteHistory(id: string) {
        // @ts-ignore
        if (typeof Swal !== 'undefined') {
            // @ts-ignore
            const res = await Swal.fire({
                title: 'Tem certeza?',
                text: "Não será possível reverter a exclusão deste histórico!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Sim, excluir!',
                cancelButtonText: 'Cancelar'
            });
            if (!res.isConfirmed) return;
        } else {
            if (!confirm('Deseja realmente excluir este histórico?')) return;
        }
        
        try {
            await api(`/accounting/histories/${id}`, { method: 'DELETE' });
            // @ts-ignore
            if (typeof Swal !== 'undefined') Swal.fire('Excluído!', 'O histórico foi removido.', 'success');
            loadHistories();
        } catch (e: any) {
            console.error('Delete failed', e);
            // @ts-ignore
            if (typeof Swal !== 'undefined') Swal.fire('Erro', e.message || 'Falha ao excluir. Pode estar em uso.', 'error');
        }
    }
    
    // Listeners
    if (btnOpenModal) btnOpenModal.addEventListener('click', openNewModal);
    if (btnCancelHistory) btnCancelHistory.addEventListener('click', closeModal);
    if (historyModalBackdrop) historyModalBackdrop.addEventListener('click', closeModal);
    
    if (historyForm) {
        historyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btnSaveHistory = document.getElementById('btnSaveHistory') as HTMLButtonElement;
            if (btnSaveHistory) {
                btnSaveHistory.disabled = true;
                btnSaveHistory.innerHTML = '<span class="inline-block animate-spin mr-2">⟳</span>Salvando...';
            }
            
            try {
                const code = (document.getElementById('historyCode') as HTMLInputElement).value.trim();
                const description = (document.getElementById('historyDescription') as HTMLInputElement).value.trim();
                const history_text = (document.getElementById('historyText') as HTMLInputElement).value.trim();
                const active = (document.getElementById('historyActive') as HTMLInputElement).checked;
                
                const payload = {
                    code,
                    description,
                    history_text,
                    active
                };
                
                if (isEditing && editingId) {
                    await api(`/accounting/histories/${editingId}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                    // @ts-ignore
                    if (typeof Swal !== 'undefined') Swal.fire('Sucesso', 'Histórico atualizado com sucesso!', 'success');
                } else {
                    await api('/accounting/histories', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    // @ts-ignore
                    if (typeof Swal !== 'undefined') Swal.fire('Sucesso', 'Novo histórico criado com sucesso!', 'success');
                }
                
                closeModal();
                loadHistories();
                
            } catch (error: any) {
                console.error('Save error', error);
                // @ts-ignore
                if (typeof Swal !== 'undefined') Swal.fire('Erro', error.message || 'Falha ao salvar as informações.', 'error');
                else alert(error.message || 'Falha ao salvar as informações.');
            } finally {
                if (btnSaveHistory) {
                    btnSaveHistory.disabled = false;
                    btnSaveHistory.innerHTML = 'Salvar';
                }
            }
        });
    }
    
    // Init
    document.addEventListener('DOMContentLoaded', () => {
        loadHistories();
    });
})();
