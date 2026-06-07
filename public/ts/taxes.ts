(() => {
    const getById = (id: string): any => document.getElementById(id);
    const qs = (selector: string): any => document.querySelector(selector);
    const qsa = (selector: string): any => document.querySelectorAll(selector);

    let taxesManager: any;

    const formatPerc = (val: any) => Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + '%';

    document.addEventListener('DOMContentLoaded', () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '/';
        return;
    }

    api('/auth/me').then(res => {
        const userGreeting = getById('userGreeting');
        if (userGreeting && res.data && res.data.user) {
            userGreeting.textContent = `Olá, ${res.data.user.full_name || 'Usuário'}`;
        } else if (userGreeting && res.data) {
            userGreeting.textContent = `Olá, ${res.data.full_name || 'Usuário'}`;
        }
    }).catch(err => console.error(err));

    // Tabs logic
    const tabBtns = qsa('.tab-btn');
    const tabPanes = qsa('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            if (!target) return;

            tabBtns.forEach(b => {
                b.classList.remove('active', 'border-brand-500', 'text-brand-600', 'dark:text-brand-400');
                b.classList.add('border-transparent', 'text-gray-500');
            });

            tabPanes.forEach(p => p.classList.add('hidden'));

            btn.classList.add('active', 'border-brand-500', 'text-brand-600', 'dark:text-brand-400');
            btn.classList.remove('border-transparent', 'text-gray-500');

            const targetPane = getById(target);
            if (targetPane) targetPane.classList.remove('hidden');
        });
    });

    taxesManager = new CrudManager({
        entityName: 'Regra Tributária',
        endpoint: '/estoque/taxes',
        tableId: 'taxesTable',
        gridSectionId: 'taxesGridSection',
        tableSectionId: 'taxesSection',
        modalId: 'taxModal',
        disableSummaryFooter: true,
        
        filterConfig: {
            storageKey: 'taxes_filter_panel',
            fields: [
                { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome, CSOSN, CST ou serviço' },
            ]
        },

        renderTable: (items) => {
            const tbody = getById('taxesTable');
            if (items.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum tributo cadastrado.</td></tr>`;
                return;
            }

            tbody.innerHTML = items.map(t => `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap">
                        <input type="checkbox" class="item-checkbox h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 dark:border-slate-600 rounded cursor-pointer" value="${t.public_id}" data-bwignore="true" data-lpignore="true" placeholder="">
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">#${String(t.id).padStart(4, '0')}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">${t.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">${t.csosn || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-500 dark:text-gray-400">${t.product_count || 0}</td>
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

            const selectAllBtn = getById('selectAll');
            if (selectAllBtn) {
                selectAllBtn.onchange = (e) => {
                    qsa('.item-checkbox').forEach(cb => {
                        cb.checked = e.target.checked;
                    });
                };
            }

            qsa('.item-checkbox').forEach(cb => {
                cb.onchange = () => {
                    if (!cb.checked && selectAllBtn) {
                        selectAllBtn.checked = false;
                    }
                };
            });
        },

        renderGrid: (items) => {
            const grid = getById('taxesGridSection');
            if (items.length === 0) {
                grid.innerHTML = `<div class="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">Nenhum tributo encontrado.</div>`;
                return;
            }

            grid.innerHTML = items.map(t => `
                <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col border border-gray-100 dark:border-slate-700 relative">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h4 class="text-lg font-bold text-gray-900 dark:text-gray-100 pr-2">${t.name}</h4>
                        </div>
                        <div class="flex space-x-1 shrink-0">
                            <button type="button" title="Editar" class="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-md transition-colors edit-btn" data-item='${JSON.stringify(t).replace(/'/g, "&#39;")}'>
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </button>
                            <button type="button" title="Duplicar" class="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-md transition-colors duplicate-btn" data-item='${JSON.stringify(t).replace(/'/g, "&#39;")}'>
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                            </button>
                            <button type="button" title="Excluir" class="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-md transition-colors delete-btn" data-id="${t.public_id}">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </div>
                    
                    <div class="mb-4 text-xs text-gray-500 dark:text-gray-400 flex flex-col gap-1">
                        <span>CSOSN: <span class="font-medium text-gray-900 dark:text-gray-100">${t.csosn || '-'}</span></span>
                        <div>
                            <span class="font-medium bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-full">${t.product_count || 0} produtos</span>
                        </div>
                    </div>
                </div>
            `).join('');
        },
        
        applyFilters: (data) => {
            const search = window.FilterPanel.normalizeText(getById('filterSearch')?.value);
            const filtered = data.filter((item) => window.FilterPanel.matchesSearch(
                item,
                ['name', 'csosn', 'cst_icms', 'cst_pis', 'cst_cofins', 'service_code'],
                search,
            ));

            window.GridSummaryFooter?.update({
                footerId: 'taxesResultsFooter',
                anchorId: 'taxesGridSection',
                count: filtered.length,
                label: 'tributo(s) exibido(s)',
            });
            return filtered;
        },

        onEdit: (data) => {
            const form = getById('taxForm');
            form.reset();
            const title = getById('modalTitle');

            if (data && data.public_id) {
                title.textContent = 'Editar Regra Tributária';
                getById('taxName').value = data.name || '';
                getById('taxCsosn').value = data.csosn || '';
                getById('taxCstIcms').value = data.cst_icms || '';
                getById('icmsType').value = data.icms_type || 'Normal';
                getById('mvaInternal').value = data.mva_internal_percentage || '0.00';
                getById('mvaInterstate').value = data.mva_interstate_percentage || '0.00';
                getById('aliquotaIcms').value = data.icms_percentage || '0.00';
                getById('fecpPercentage').value = data.fecp_percentage || '0.00';
                getById('taxCstPis').value = data.cst_pis || '';
                getById('aliquotaPis').value = data.pis_percentage || '0.00';
                getById('aliquotaIpi').value = data.ipi_percentage || '0.00';
                getById('taxCstCofins').value = data.cst_cofins || '';
                getById('aliquotaCofins').value = data.cofins_percentage || '0.00';
                getById('serviceCode').value = data.service_code || '';
                getById('issPercentage').value = data.iss_percentage || '0.00';
                getById('taxCstIbs').value = data.cst_ibs || '';
                getById('ibsPercentage').value = data.ibs_percentage || '0.00';
                getById('taxCstCbs').value = data.cst_cbs || '';
                getById('cbsPercentage').value = data.cbs_percentage || '0.00';
                getById('taxCstIs').value = data.cst_is || '';
                getById('isPercentage').value = data.is_percentage || '0.00';
                form.dataset.id = data.public_id;
            } else if (data && data.name) {
                title.textContent = 'Duplicar Regra Tributária';
                getById('taxName').value = data.name || '';
                getById('taxCsosn').value = data.csosn || '';
                getById('taxCstIcms').value = data.cst_icms || '';
                getById('icmsType').value = data.icms_type || 'Normal';
                getById('mvaInternal').value = data.mva_internal_percentage || '0.00';
                getById('mvaInterstate').value = data.mva_interstate_percentage || '0.00';
                getById('aliquotaIcms').value = data.icms_percentage || '0.00';
                getById('fecpPercentage').value = data.fecp_percentage || '0.00';
                getById('taxCstPis').value = data.cst_pis || '';
                getById('aliquotaPis').value = data.pis_percentage || '0.00';
                getById('aliquotaIpi').value = data.ipi_percentage || '0.00';
                getById('taxCstCofins').value = data.cst_cofins || '';
                getById('aliquotaCofins').value = data.cofins_percentage || '0.00';
                getById('serviceCode').value = data.service_code || '';
                getById('issPercentage').value = data.iss_percentage || '0.00';
                getById('taxCstIbs').value = data.cst_ibs || '';
                getById('ibsPercentage').value = data.ibs_percentage || '0.00';
                getById('taxCstCbs').value = data.cst_cbs || '';
                getById('cbsPercentage').value = data.cbs_percentage || '0.00';
                getById('taxCstIs').value = data.cst_is || '';
                getById('isPercentage').value = data.is_percentage || '0.00';
                delete form.dataset.id;
            } else {
                title.textContent = 'Nova Regra Tributária';
                delete form.dataset.id;
            }

            getById('taxModal').classList.remove('hidden');

            // Reset tab explicitly to Estado
            const firstTabBtn = qs('.tab-btn[data-target="tab-estado"]');
            if (firstTabBtn) firstTabBtn.click();
        }
    });

    taxesManager.init();

    let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    getById('filterSearch')?.addEventListener('input', () => {
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
        }
        searchDebounceTimer = setTimeout(() => {
            taxesManager.applyFilters();
            searchDebounceTimer = null;
        }, 180);
    });
});

getById('taxForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const saveBtn = getById('saveBtn');
    const form = getById('taxForm');
    const parseNumber = (val) => parseFloat(String(val).replace(',', '.')) || 0;

    const payload = {
        name: getById('taxName').value,
        csosn: getById('taxCsosn').value || undefined,
        cst_icms: getById('taxCstIcms').value || undefined,
        icms_type: getById('icmsType').value || 'Normal',
        icms_percentage: parseNumber(getById('aliquotaIcms').value),
        mva_internal_percentage: parseNumber(getById('mvaInternal').value),
        mva_interstate_percentage: parseNumber(getById('mvaInterstate').value),
        fecp_percentage: parseNumber(getById('fecpPercentage').value),
        ipi_percentage: parseNumber(getById('aliquotaIpi').value),
        cst_pis: getById('taxCstPis').value || undefined,
        pis_percentage: parseNumber(getById('aliquotaPis').value),
        cst_cofins: getById('taxCstCofins').value || undefined,
        cofins_percentage: parseNumber(getById('aliquotaCofins').value),
        service_code: getById('serviceCode').value || undefined,
        iss_percentage: parseNumber(getById('issPercentage').value),
        cst_ibs: getById('taxCstIbs').value || undefined,
        ibs_percentage: parseNumber(getById('ibsPercentage').value),
        cst_cbs: getById('taxCstCbs').value || undefined,
        cbs_percentage: parseNumber(getById('cbsPercentage').value),
        cst_is: getById('taxCstIs').value || undefined,
        is_percentage: parseNumber(getById('isPercentage').value)
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando...';

    try {
        if (form.dataset.id) {
            await api(`/estoque/taxes/${form.dataset.id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            UI.showAlert('alertMessage', 'Regra tributária atualizada com sucesso!', 'success');
        } else {
            await api('/estoque/taxes', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            UI.showAlert('alertMessage', 'Regra tributária salva com sucesso!', 'success');
        }

        taxesManager.closeModal();
        taxesManager.loadData();
    } catch (error) {
        alert(error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar';
    }
});

})();
