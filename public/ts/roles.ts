(() => {
    const getById = (id: string): any => document.getElementById(id);
    const qs = (selector: string): any => document.querySelector(selector);
    const qsa = (selector: string): any => document.querySelectorAll(selector);

    const state: { currentPermissions: any[] } = {
        currentPermissions: [] as any[],
    };

    let rolesManager: any;
    let currentUserRole: string = '';

    function decodeJwtPayload(token: string): any {
        try {
            const parts = String(token || '').split('.');
            if (parts.length < 2) return null;
            const base64Url = parts[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            );
            return JSON.parse(jsonPayload);
        } catch (_e) {
            return null;
        }
    }

    function getRoleFromToken(): string {
        try {
            const token = Auth.getToken?.();
            const payload = token ? decodeJwtPayload(token) : null;
            return String(payload?.role || '').trim();
        } catch (_e) {
            return '';
        }
    }

    function getRoleFromMeResponse(me: any): string {
        const role = me?.data?.user?.role ?? me?.data?.data?.user?.role ?? me?.user?.role;
        return String(role || '').trim();
    }

    function getCompanyFromMeResponse(me: any): any {
        return me?.data?.company ?? me?.data?.data?.company ?? me?.company ?? null;
    }

    function canEditTargetRole(targetRoleId: string): boolean {
        const target = String(targetRoleId || '').trim();
        if (!target) return false;
        if (target === 'super_admin') return false;
        if (target === 'admin') return currentUserRole === 'super_admin';
        return currentUserRole === 'admin' || currentUserRole === 'super_admin';
    }

    function showAlert(id: string, msg: string, type: string = 'success', timeoutMs: number = 4000) {
        const el = getById(id);
        if (!el) return;
        el.textContent = msg;
        el.className = `mx-4 sm:mx-0 mb-4 p-4 rounded-xl text-sm ${type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), timeoutMs);
    }

    function renderModuleCheckboxes(roleId: string) {
        const container = getById('modulesCheckboxesContainer');
        if (!container) return;

        const systemModules = [
            {
                groupName: 'Principal',
                links: [
                    { id: 'sales', label: 'PDV / Vendas' },
                    { id: 'service_launches', label: 'Lançamento de Serviço' },
                    { id: 'restaurant', label: 'Restaurante' }
                ]
            },
            {
                groupName: 'Visão',
                links: [
                    { id: 'dashboard', label: 'Visão Geral' },
                    { id: 'finance_vision', label: 'Visão Financeiro' },
                    { id: 'stock_vision', label: 'Visão Estoque' },
                    { id: 'whatsapp-info', label: 'Visão Whatsapp' }
                ]
            },
            {
                groupName: 'Pedido',
                links: [
                    { id: 'picking', label: 'Separação' },
                    { id: 'nota', label: 'Nota' },
                    { id: 'notas_vendidas', label: 'Notas Vendidas' }
                ]
            },
            {
                groupName: 'Estoque',
                links: [
                    { id: 'products', label: 'Produtos' },
                    { id: 'categories', label: 'Categoria' },
                    { id: 'stock_types', label: 'Tipo de Estoque' },
                    { id: 'manufacturers', label: 'Fabricante' },
                    { id: 'taxes', label: 'Tributo' },
                    { id: 'prices', label: 'Tabela de Preço' },
                    { id: 'measures', label: 'Medida' }
                ]
            },
            {
                groupName: 'Serviço',
                links: [
                    { id: 'service_types', label: 'Tipo de Serviço' },
                    { id: 'services', label: 'Serviço' },
                    { id: 'service_tax_municipal', label: 'Tributação Municipal' },
                    { id: 'service_tax_federal', label: 'Tributação Federal' }
                ]
            },
            {
                groupName: 'Pedido_Compra',
                links: [
                    { id: 'purchases', label: 'Compra' },
                    { id: 'manifestation', label: 'Manifesto' }
                ]
            },
            {
                groupName: 'Financeiro',
                links: [
                    { id: 'expenses', label: 'Despesa' },
                    { id: 'revenues', label: 'Receita' },
                    { id: 'finance_categories', label: 'Categoria (Finanças)' },
                    { id: 'banks', label: 'Bancos' },
                    { id: 'statements', label: 'Extrato' }
                ]
            },
            {
                groupName: 'Pessoas',
                links: [
                    { id: 'customers', label: 'Clientes' },
                    { id: 'contacts', label: 'Contato' },
                    { id: 'sellers', label: 'Vendedor' },
                    { id: 'buyers', label: 'Comprador' },
                    { id: 'service_providers', label: 'Prestador de Serviço' },
                    { id: 'suppliers', label: 'Fornecedor' },
                    { id: 'company', label: 'Empresa' },
                    { id: 'accountant', label: 'Contador' },
                    { id: 'users', label: 'Usuário' }
                ]
            },
            {
                groupName: 'Contabilidade',
                links: [
                    { id: 'accounting', label: 'Plano de Contas' },
                    { id: 'accounting_entries', label: 'Lançamentos' }
                ]
            },
            {
                groupName: 'Relatórios',
                links: [
                    { id: 'dre', label: 'DRE' },
                    { id: 'balanco', label: 'Balanço Patrimonial' },
                    { id: 'balancete', label: 'Balancete' }
                ]
            },
            {
                groupName: 'Configuração',
                links: [
                    { id: 'roles', label: 'Config. de Perfis' },
                    { id: 'tasks', label: 'Tarefas' },
                    { id: 'organizer', label: 'Organizador' },
                    { id: 'ajuste', label: 'Ajuste' },
                    { id: 'whatsapp', label: 'WhatsApp' },
                    { id: 'email', label: 'E-mail' },
                    { id: 'swagger', label: 'Swagger' }
                ]
            }
        ];

        let html = '';
        systemModules.forEach(group => {
            html += `
            <div class="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-md border border-gray-200 dark:border-slate-700 mb-4">
                <h5 class="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 opacity-70">${group.groupName}</h5>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6">
                    ${group.links.map(link => {
                        const isAdminServiceTypesDefault = roleId === 'admin' && (
                            link.id === 'service_types'
                            || link.id === 'services'
                            || link.id === 'service_launches'
                            || link.id === 'service_tax_municipal'
                            || link.id === 'service_tax_federal'
                        );
                        const hasPermission = state.currentPermissions.some((p) => {
                            if (!p.can_view) {
                                return false;
                            }

                            // Compatibilidade com base antiga em nuvem: Tipo de Estoque era acoplado a "categories".
                            if (link.id === 'stock_types') {
                                return p.module === 'stock_types' || p.module === 'categories';
                            }

                            return p.module === link.id;
                        }) || isAdminServiceTypesDefault;

                        const canEdit = canEditTargetRole(roleId);
                        const disabledAtt = !canEdit
                            ? 'disabled title="Permissões protegidas"'
                            : '';
                        return `
                        <label class="flex items-center cursor-pointer p-2 hover:bg-white dark:hover:bg-slate-800 rounded transition-colors ${disabledAtt ? 'opacity-70' : ''}" title="Marque para Mostrar, Desmarque para Ocultar">
                            <input type="checkbox" data-module="${link.id}" value="${link.id}" 
                                   class="module-checkbox peer sr-only"
                                   ${hasPermission ? 'checked' : ''} ${disabledAtt} data-bwignore="true" data-lpignore="true" placeholder="">
                            
                            <div class="flex items-center justify-center w-8 h-8 rounded-md bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 peer-checked:hidden transition-all shrink-0 shadow-sm border border-red-200 dark:border-red-800/50">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
                                </svg>
                            </div>
                            
                            <div class="items-center justify-center w-8 h-8 rounded-md bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 hidden peer-checked:flex transition-all shrink-0 shadow-sm border border-emerald-200 dark:border-emerald-800/50">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                </svg>
                            </div>

                            <div class="flex flex-col ml-3 group">
                                <span class="text-sm font-medium text-gray-900 dark:text-gray-100 transition-colors peer-checked:text-emerald-600">${link.label}</span>
                                <span class="text-[10px] text-gray-400 font-mono tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">${link.id}.html</span>
                            </div>
                        </label>
                    `;
                    }).join('')}
                </div>
            </div>
            `;
        });
        
        container.innerHTML = html;
        container.classList.remove('grid', 'grid-cols-1', 'sm:grid-cols-2', 'md:grid-cols-3', 'gap-4');
    }

    function setBulkPermissionButtonsState(roleId: string) {
        const canEdit = canEditTargetRole(roleId);
        const enableAllBtn = getById('btnEnableAllModules');
        const disableAllBtn = getById('btnDisableAllModules');

        [enableAllBtn, disableAllBtn].forEach((btn) => {
            if (!btn) return;
            btn.disabled = !canEdit;
            btn.classList.toggle('opacity-60', !canEdit);
            btn.classList.toggle('cursor-not-allowed', !canEdit);
        });
    }

    function setAllModulesChecked(checked: boolean) {
        const roleId = getById('entityRole')?.value || '';
        if (!canEditTargetRole(roleId)) {
            showAlert('alertMessage', 'Acesso negado para alterar as permissões deste perfil.', 'error');
            return;
        }

        qsa('.module-checkbox').forEach((checkbox: any) => {
            if (!checkbox.disabled) {
                checkbox.checked = checked;
            }
        });
    }

    function closeNewRoleModal() {
        getById('newRoleForm').reset();
        getById('newRoleModal').classList.add('hidden');
    }

    document.addEventListener('DOMContentLoaded', async () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }

        // Fallback rápido: pega o role direto do token (evita bloquear UI caso /auth/me falhe)
        currentUserRole = getRoleFromToken();

        try {
            const me = await api('/auth/me');
            const userRole = getRoleFromMeResponse(me) || currentUserRole;
            currentUserRole = String(userRole || '').trim();

            if (currentUserRole === 'super_admin') {
                const company = getCompanyFromMeResponse(me);
                const companyId = company?.id;
                const companyName = company?.trade_name || company?.company_name || '';
                const label = companyName ? `"${companyName}"` : (companyId ? `ID ${companyId}` : 'atual');
                showAlert(
                    'alertMessage',
                    `Contexto do Super Admin: empresa ${label}. As permissões são por empresa. Para alterar as permissões do admin de outra empresa, vá em Empresas e clique em "Acessar Empresa" antes de editar.`,
                    'success',
                    12000
                );
            }

            if (currentUserRole !== 'admin' && currentUserRole !== 'super_admin') {
                showAlert('alertMessage', 'Acesso negado. Apenas administradores podem editar perfis.', 'error');
                getById('rolesSection').classList.add('opacity-50', 'pointer-events-none');
                getById('rolesGridSection').classList.add('opacity-50', 'pointer-events-none');
                getById('btnNewRole')?.remove();
            }
        } catch (e) {
            if (!currentUserRole) {
                showAlert('alertMessage', 'Não foi possível validar seu perfil (erro ao carregar /auth/me). Recarregue a página.', 'error');
            }
        }

        getById('btnCancelNewRoleModal')?.addEventListener('click', closeNewRoleModal);
        getById('newRoleModalBackdrop')?.addEventListener('click', closeNewRoleModal);

        getById('btnNewRole')?.addEventListener('click', () => {
            getById('newRoleModal').classList.remove('hidden');
            getById('newRoleName').focus();
        });

        getById('newRoleForm')?.addEventListener('submit', async (e: any) => {
            e.preventDefault();
            const btn = getById('saveNewRoleBtn');
             
            const name = getById('newRoleName').value.trim();
            const description = getById('newRoleDesc').value.trim();
            
            // Generate slug
            let slug = name.toLowerCase()
                .replace(/[áàãâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
                .replace(/[óòõôö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/[ç]/g, 'c')
                .replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

             if (!slug) slug = 'perfil_' + Math.floor(Math.random() * 1000);

            btn.disabled = true;
            btn.textContent = 'Criando...';

            try {
                await api('/roles', {
                    method: 'POST',
                    body: JSON.stringify({ name, slug, description })
                });
                showAlert('alertMessage', 'Perfil criado com sucesso!', 'success');
                closeNewRoleModal();
                rolesManager.loadData();
            } catch (error: any) {
                alert(error.message || 'Erro ao criar perfil');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Criar';
            }
        });

        getById('btnEnableAllModules')?.addEventListener('click', () => {
            setAllModulesChecked(true);
        });

        getById('btnDisableAllModules')?.addEventListener('click', () => {
            setAllModulesChecked(false);
        });

        getById('entityForm')?.addEventListener('submit', async (e: any) => {
            e.preventDefault();
            const saveBtn = getById('saveBtn');
            const roleId = getById('entityRole').value;

            // Proteções: super_admin sempre é fixo; admin só pode ser alterado pelo super_admin
            if (!canEditTargetRole(roleId)) {
                showAlert('alertMessage', 'Acesso negado para alterar as permissões deste perfil.', 'error');
                return;
            }

            const checkboxes = qsa('.module-checkbox');
            const permissions = Array.from(checkboxes as any).map((checkbox: any) => ({
                module: checkbox.value,
                can_view: checkbox.checked,
            }));

            saveBtn.disabled = true;
            saveBtn.textContent = 'Salvando...';

            try {
                await api('/permissions/' + roleId, {
                    method: 'POST',
                    body: JSON.stringify({ permissions })
                });
                
                showAlert('alertMessage', 'Permissões atualizadas com sucesso!', 'success');
                rolesManager.closeModal();
            } catch (error: any) {
                showAlert('alertMessage', error.message || 'Erro ao atualizar permissões.', 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Salvar Permissões';
            }
        });

        rolesManager = new CrudManager({
            entityName: 'Perfil',
            endpoint: '/roles',
            tableId: 'rolesTable',
            gridSectionId: 'rolesGridSection',
            tableSectionId: 'rolesSection',
            modalId: 'entityModal',

            renderTable: (items: any[]) => {
                const tbody = getById('rolesTable');
                if (!tbody) return;
                
                if (items.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center text-sm text-gray-500">Nenhum perfil encontrado.</td></tr>';
                    return;
                }

                tbody.innerHTML = items.map((role: any) => `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                            ${role.name}
                            <div class="text-xs text-gray-500 font-normal">${role.description || ''}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                            ${role.slug || role.id}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button type="button" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 edit-btn flex items-center justify-end w-full" data-item='${JSON.stringify({id: role.slug || role.id, name: role.name}).replace(/'/g, "&#39;")}'>
                                <svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                Permissões
                            </button>
                        </td>
                    </tr>
                `).join('');
            },

            renderGrid: (items: any[]) => {
                const grid = getById('rolesGridSection');
                if (!grid) return;

                if (items.length === 0) {
                    grid.innerHTML = '<div class="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">Nenhum perfil encontrado.</div>';
                    return;
                }

                grid.innerHTML = items.map((role: any) => `
                    <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col relative border border-gray-100 dark:border-slate-700">
                        <div class="flex-1">
                            <h4 class="text-lg font-bold text-gray-900 dark:text-gray-100">${role.name}</h4>
                            <p class="text-xs font-mono text-gray-400 mt-1">${role.slug || role.id}</p>
                            <p class="mt-4 text-sm text-gray-600 dark:text-gray-300 w-full whitespace-normal wrap-break-word">${role.description || ''}</p>
                        </div>
                        <div class="mt-5 pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-end">
                            <button type="button" class="text-brand-600 hover:bg-brand-50 px-3 py-1.5 rounded-lg dark:hover:bg-brand-900/30 edit-btn flex items-center text-sm font-medium" data-item='${JSON.stringify({id: role.slug || role.id, name: role.name}).replace(/'/g, "&#39;")}'>
                                <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                Editar Permissões
                            </button>
                        </div>
                    </div>
                `).join('');
            },

            onEdit: async (role: any) => {
                const roleId = role.id;
                getById('modalTitle').textContent = `Permissões: ${role.name}`;
                getById('entityRole').value = roleId;

                // Reforço: se não conseguimos pegar o role ainda, tenta novamente agora.
                if (!currentUserRole) {
                    currentUserRole = getRoleFromToken();
                    try {
                        const me = await api('/auth/me');
                        currentUserRole = getRoleFromMeResponse(me) || currentUserRole;
                    } catch (_e) {}
                }

                try {
                    const response = await api('/permissions/' + roleId);
                    state.currentPermissions = response.data || [];
                } catch (error) {
                    console.error('Falha ao carregar permissões', error);
                    state.currentPermissions = [];
                }

                renderModuleCheckboxes(roleId);
                setBulkPermissionButtonsState(roleId);

                const saveBtn = getById('saveBtn');
                const canEdit = canEditTargetRole(roleId);

                if (!canEdit) {
                    saveBtn.disabled = true;
                    saveBtn.innerHTML = roleId === 'super_admin'
                        ? 'Acesso Super Admin Fixo'
                        : (roleId === 'admin' ? 'Acesso Admin Protegido' : 'Sem permissão');
                    saveBtn.classList.remove('bg-brand-600', 'hover:bg-brand-700');
                    saveBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
                } else {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = 'Salvar Permissões';
                    saveBtn.classList.add('bg-brand-600', 'hover:bg-brand-700');
                    saveBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
                }

                getById('entityModal').classList.remove('hidden');
            }
        });

        // Initialize! Handle list/grid view toggle automatically via CrudManager init()
        rolesManager.init();
    });
})();
