(() => {
    const getById = (id) => document.getElementById(id);
    const qs = (selector) => document.querySelector(selector);
    const qsa = (selector) => document.querySelectorAll(selector);
    /**
     * users.js
     * Gerenciamento de Usuários e WhatsApp QR Code - KEYSTONE ERP
     */
    document.addEventListener('DOMContentLoaded', async () => {
        const api = window.api;
        const UI = window.UI;
        let waSessionPollTimer = null;
        let currentView = localStorage.getItem('usersView') || 'list';
        let activeTab = 'data';
        let editingUserId = null; // public_id do usuário sendo editado
        let usersData = [];
        let rolesData = [];
        let filters = { search: '', role: '' };
        let searchDebounceTimer = null;
        let saving = false;
        let waSessionLoadedOnce = false;
        let editingUserData = null;
        let editingUserWhatsAppAutoReplyMode = 'automatic';
        let waSession = {
            status: 'idle',
            persisted_session: false,
            qr_code_data_url: null,
            pairing_code: null,
            connected_number: null,
            connected_name: null,
            last_event_at: null,
            last_error: null,
        };
        // --- Delete User ---
        async function deleteUser(id) {
            if (!confirm('Deseja realmente excluir este usuário? Somente usuários que nunca tiveram operações no sistema podem ser excluídos.'))
                return;
            try {
                await api(`/users/${id}`, { method: 'DELETE' });
                UI.showToast('Usuário excluído com sucesso!', 'success');
                await loadData();
                renderTable();
                renderGrid();
            }
            catch (e) {
                UI.showToast(e.message || 'Erro ao excluir usuário', 'error');
            }
        }
        // --- Helpers ---
        const formatPhone = (phone) => {
            if (!phone)
                return '-';
            const clean = String(phone).replace(/\D/g, '');
            if (clean.length === 10)
                return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
            if (clean.length === 11)
                return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
            return phone;
        };
        const resolveConnectedNumber = () => {
            const fromConnected = String(waSession?.connected_number || '').replace(/\D/g, '');
            if (fromConnected)
                return fromConnected;
            const widRaw = String(waSession?.wid || '').trim();
            if (!widRaw)
                return '';
            const fromWid = widRaw.split('@')[0]?.replace(/\D/g, '') || '';
            return fromWid;
        };
        const formatConnectedNumber = () => {
            const digits = resolveConnectedNumber();
            if (!digits)
                return 'Não conectado';
            if (digits.length === 12 && digits.startsWith('55')) {
                return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
            }
            if (digits.length === 13 && digits.startsWith('55')) {
                return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
            }
            return `+${digits}`;
        };
        const getRoleName = (slug) => {
            const found = rolesData.find(r => r.slug === slug);
            return found ? found.name : (slug || 'Usuário');
        };
        const getWaStatusMeta = () => {
            const status = waSession.status || 'idle';
            switch (status) {
                case 'ready': return { badgeClass: 'bg-emerald-100 text-emerald-800', label: 'Conectado', helper: 'Sessão ativa e pronta para envio de mensagens.' };
                case 'authenticated': return { badgeClass: 'bg-sky-100 text-sky-800', label: 'Autenticado', helper: 'WhatsApp autenticado. Finalizando preparação da sessão.' };
                case 'awaiting_qr': return { badgeClass: 'bg-amber-100 text-amber-800', label: 'Aguardando Pareamento', helper: waSession.pairing_code ? 'Use o codigo abaixo no WhatsApp do celular para conectar.' : 'Escaneie o QR code no WhatsApp do celular em Dispositivos conectados.' };
                case 'initializing': return { badgeClass: 'bg-blue-100 text-blue-800', label: 'Inicializando', helper: 'Preparando o navegador e gerando um novo QR code.' };
                case 'auth_failure':
                case 'error': return { badgeClass: 'bg-red-100 text-red-800', label: 'Erro', helper: waSession.last_error || 'Falha ao iniciar a sessão do WhatsApp Business.' };
                case 'disconnected': return { badgeClass: 'bg-slate-200 text-slate-700', label: 'Desconectado', helper: waSession.last_error || 'A sessão foi desconectada e precisa de um novo pareamento.' };
                default: return { badgeClass: 'bg-slate-200 text-slate-700', label: 'Inativo', helper: 'Inicie a sessão para gerar um QR code novo.' };
            }
        };
        const clearWaPolling = () => {
            if (waSessionPollTimer) {
                clearTimeout(waSessionPollTimer);
                waSessionPollTimer = null;
            }
        };
        const shouldPollWa = () => activeTab === 'whatsapp' &&
            !!editingUserId &&
            (waSession.status === 'initializing' || waSession.status === 'awaiting_qr');
        const scheduleWaPolling = () => {
            clearWaPolling();
            if (!shouldPollWa())
                return;
            waSessionPollTimer = setTimeout(() => loadWaSession(), 1500);
        };
        // --- Data ---
        async function loadData() {
            const [rRoles, rUsers] = await Promise.all([api('/roles'), api('/users')]);
            rolesData = rRoles.data || [];
            usersData = rUsers.data || [];
            populateRoleSelects();
        }
        function populateRoleSelects() {
            const filterSel = getById('filterRole');
            const formSel = getById('formRole');
            const optionsHtml = rolesData.map(r => `<option value="${r.slug}">${r.name}</option>`).join('');
            if (filterSel) {
                filterSel.innerHTML = '<option value="">Qualquer Perfil</option>' + optionsHtml;
                filterSel.value = filters.role;
            }
            if (formSel) {
                formSel.innerHTML = '<option value="">Selecione...</option>' + optionsHtml;
            }
        }
        function getFiltered() {
            let list = usersData;
            if (filters.search) {
                const t = filters.search.toLowerCase();
                list = list.filter(u => u.full_name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t));
            }
            if (filters.role) {
                list = list.filter(u => u.role === filters.role);
            }
            return list;
        }
        const bindCopyEvents = () => {
            document.querySelectorAll('.view-id-btn').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    const pid = e.currentTarget.getAttribute('data-id') || '';
                    navigator.clipboard.writeText(pid).then(() => {
                        const b = e.currentTarget;
                        if (b.classList.contains('animating'))
                            return;
                        b.classList.add('animating');
                        const orig = b.innerHTML;
                        const svgSize = 'h-3.5 w-3.5 inline';
                        // Step 1: Fade out and shrink original icon
                        b.classList.add('scale-75', 'opacity-0');
                        // Step 2: Show spinning loader
                        setTimeout(() => {
                            b.innerHTML = `<svg class="animate-spin h-3.5 w-3.5 text-brand-600 dark:text-brand-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
                            b.classList.remove('scale-75', 'opacity-0');
                            // Step 3: Fade out loader after 400ms
                            setTimeout(() => {
                                b.classList.add('scale-75', 'opacity-0');
                                // Step 4: Show checkmark and pop
                                setTimeout(() => {
                                    b.innerHTML = `<svg class="${svgSize} text-green-500 transition-all duration-300 transform scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
                                    b.classList.remove('scale-75', 'opacity-0');
                                    b.classList.add('scale-110', 'opacity-100');
                                    // Revert checkmark back to normal scale
                                    setTimeout(() => {
                                        b.classList.remove('scale-110');
                                    }, 100);
                                    // Step 5: Fade out checkmark after 1000ms
                                    setTimeout(() => {
                                        b.classList.add('scale-75', 'opacity-0');
                                        // Step 6: Restore original icon
                                        setTimeout(() => {
                                            b.innerHTML = orig;
                                            b.classList.remove('scale-75', 'opacity-0', 'animating');
                                        }, 150);
                                    }, 1000);
                                }, 150);
                            }, 400);
                        }, 150);
                    });
                });
            });
        };
        // --- Render Table ---
        function renderTable() {
            const tbody = getById('usersTable');
            if (!tbody)
                return;
            const filtered = getFiltered();
            if (!filtered.length) {
                tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum usuário encontrado.</td></tr>';
                return;
            }
            tbody.innerHTML = filtered.map(u => `
            <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 ${!u.is_active ? 'opacity-60' : ''}">
                <td class="px-6 py-4 text-sm whitespace-nowrap">
                    <div class="font-semibold text-gray-900 dark:text-gray-100">${u.full_name}</div>
                    <div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span class="font-mono text-[10px] select-all">${u.public_id}</span>
                        <button type="button" class="view-id-btn text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transform transition-all duration-200 ease-out" data-id="${u.public_id}" title="Copiar ID: ${u.public_id}">
                            <svg class="h-3.5 w-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                            </svg>
                        </button>
                    </div>
                </td>
                <td class="px-6 py-4 text-sm">
                    <div class="text-gray-700 dark:text-gray-300">${u.email}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">${formatPhone(u.phone)}</div>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">${getRoleName(u.role)}</td>
                <td class="px-6 py-4 text-sm whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-400'}">
                        ${u.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td class="px-6 py-4 text-right whitespace-nowrap">
                    <div class="flex items-center justify-end gap-3">
                        <button type="button" class="btn-edit text-brand-600 hover:text-brand-800" data-id="${u.public_id}" title="Editar">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>
                        <button type="button" class="btn-status ${u.is_active ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}" data-id="${u.public_id}" data-active="${u.is_active}" title="${u.is_active ? 'Inativar' : 'Ativar'}">
                            ${u.is_active
                ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>'
                : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'}
                        </button>
                        <button type="button" class="btn-delete text-red-600 hover:text-red-800" data-id="${u.public_id}" title="Excluir">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
            tbody.querySelectorAll('.btn-edit').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const user = usersData.find(u => u.public_id === btn.dataset.id);
                    if (user)
                        openModalDeferred(user);
                });
            });
            tbody.querySelectorAll('.btn-status').forEach((btn) => {
                btn.addEventListener('click', () => toggleStatus(btn.dataset.id, btn.dataset.active === 'false'));
            });
            tbody.querySelectorAll('.btn-delete').forEach((btn) => {
                btn.addEventListener('click', () => deleteUser(btn.dataset.id));
            });
            bindCopyEvents();
            window.GridSummaryFooter?.update({
                footerId: 'usersResultsFooter',
                anchorId: 'usersGridSection',
                count: filtered.length,
                label: 'usuário(s) exibido(s)'
            });
        }
        // --- Render Grid ---
        function renderGrid() {
            const grid = getById('usersGridSection');
            if (!grid)
                return;
            const filtered = getFiltered();
            if (!filtered.length) {
                grid.innerHTML = '<p class="col-span-3 text-center text-sm text-gray-500 dark:text-gray-400 py-10">Nenhum usuário encontrado.</p>';
                return;
            }
            grid.innerHTML = filtered.map(u => `
            <div class="bg-white dark:bg-slate-800 shadow-sm rounded-xl p-5 border border-gray-100 dark:border-slate-700 flex flex-col ${!u.is_active ? 'opacity-60' : ''}">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-xs font-medium text-gray-400 dark:text-gray-500">${getRoleName(u.role)}</span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
                        ${u.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                </div>
                <h4 class="text-base font-bold text-gray-900 dark:text-gray-100 mb-3">${u.full_name}</h4>
                <div class="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-4">
                    <div>${u.email}</div>
                    <div>${formatPhone(u.phone)}</div>
                    <div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span class="font-mono text-[10px] select-all">${u.public_id}</span>
                        <button type="button" class="view-id-btn text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transform transition-all duration-200 ease-out" data-id="${u.public_id}" title="Copiar ID: ${u.public_id}">
                            <svg class="h-3.5 w-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="mt-auto flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
                    <button type="button" class="btn-edit-card p-2 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 rounded-lg hover:bg-brand-100 transition-colors" data-id="${u.public_id}" title="Editar">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                    <button type="button" class="btn-delete-card p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 transition-colors" data-id="${u.public_id}" title="Excluir">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>
        `).join('');
            grid.querySelectorAll('.btn-edit-card').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const user = usersData.find(u => u.public_id === btn.dataset.id);
                    if (user)
                        openModalDeferred(user);
                });
            });
            grid.querySelectorAll('.btn-delete-card').forEach((btn) => {
                btn.addEventListener('click', () => deleteUser(btn.dataset.id));
            });
            bindCopyEvents();
            window.GridSummaryFooter?.update({
                footerId: 'usersResultsFooter',
                anchorId: 'usersGridSection',
                count: filtered.length,
                label: 'usuário(s) exibido(s)'
            });
        }
        // --- View toggle ---
        function setView(view) {
            currentView = view;
            localStorage.setItem('usersView', view);
            const listSection = getById('usersSection');
            const gridSection = getById('usersGridSection');
            const btnList = getById('btnListView');
            const btnGrid = getById('btnGridView');
            const activeClasses = ['bg-brand-100', 'dark:bg-brand-900/40', 'text-brand-700', 'dark:text-brand-300', 'shadow-sm'];
            const inactiveClasses = ['text-gray-500', 'hover:text-gray-700', 'dark:text-gray-400', 'dark:hover:text-gray-200'];
            if (view === 'list') {
                listSection.style.display = '';
                gridSection.style.display = 'none';
                btnList.querySelector('.check-icon')?.classList.remove('hidden');
                btnGrid.querySelector('.check-icon')?.classList.add('hidden');
                activeClasses.forEach(c => btnList.classList.add(c));
                inactiveClasses.forEach(c => btnList.classList.remove(c));
                inactiveClasses.forEach(c => btnGrid.classList.add(c));
                activeClasses.forEach(c => btnGrid.classList.remove(c));
            }
            else {
                listSection.style.display = 'none';
                gridSection.style.display = 'grid';
                btnGrid.querySelector('.check-icon')?.classList.remove('hidden');
                btnList.querySelector('.check-icon')?.classList.add('hidden');
                activeClasses.forEach(c => btnGrid.classList.add(c));
                inactiveClasses.forEach(c => btnGrid.classList.remove(c));
                inactiveClasses.forEach(c => btnList.classList.add(c));
                activeClasses.forEach(c => btnGrid.classList.remove(c));
            }
            renderTable();
            renderGrid();
        }
        // --- Modal ---
        function openModal(user = null) {
            clearWaPolling();
            activeTab = 'data';
            waSessionLoadedOnce = false;
            editingUserId = user ? user.public_id : null;
            editingUserData = user;
            editingUserWhatsAppAutoReplyMode = user?.whatsapp_auto_reply_mode || 'automatic';
            waSession = { status: 'idle', persisted_session: false, qr_code_data_url: null, pairing_code: null, connected_number: null, connected_name: null, last_event_at: null, last_error: null };
            // Title
            getById('userModalTitle').textContent = user ? 'Editar Usuário' : 'Novo Usuário';
            getById('userId').value = user ? user.public_id : '';
            // Form fields
            getById('formFullName').value = user?.full_name || '';
            getById('formEmail').value = user?.email || '';
            getById('formPhone').value = user?.phone || '';
            getById('formPassword').value = '';
            getById('formPassword').placeholder = user ? 'Deixe em branco para manter' : 'Mínimo 6 caracteres';
            getById('formDefaultPage').value = user?.default_page || '';
            // Populate role select and set value
            populateRoleSelects();
            getById('formRole').value = user?.role || '';
            // WhatsApp/Email tabs
            const tabsList = getById('userModalTabs');
            const existingWaTab = tabsList.querySelector('[data-tab="whatsapp"]')?.closest('li');
            if (existingWaTab)
                existingWaTab.remove();
            const existingEmailTab = tabsList.querySelector('[data-tab="email"]')?.closest('li');
            if (existingEmailTab)
                existingEmailTab.remove();
            if (user) {
                const liWhatsapp = document.createElement('li');
                liWhatsapp.innerHTML = `<button type="button" data-tab="whatsapp" class="tab-btn pb-3 border-b-2 border-transparent text-gray-500 font-medium px-1 text-sm flex gap-2 items-center">WhatsApp</button>`;
                tabsList.appendChild(liWhatsapp);
                const liEmail = document.createElement('li');
                liEmail.innerHTML = `<button type="button" data-tab="email" class="tab-btn pb-3 border-b-2 border-transparent text-gray-500 font-medium px-1 text-sm flex gap-2 items-center">E-mail</button>`;
                tabsList.appendChild(liEmail);
            }
            switchTab('data');
            getById('userModal').classList.remove('hidden');
            getById('formFullName').focus();
            // Attach tab listeners
            qsa('.tab-btn').forEach((btn) => {
                btn.addEventListener('click', () => switchTab(btn.dataset.tab));
            });
        }
        function openModalDeferred(user = null) {
            // Evita concentrar a renderização inteira dentro do mesmo ciclo do click.
            window.requestAnimationFrame(() => {
                openModal(user);
            });
        }
        function closeModal() {
            clearWaPolling();
            waSessionLoadedOnce = false;
            editingUserId = null;
            getById('userModal').classList.add('hidden');
        }
        function switchTab(tab) {
            activeTab = tab;
            const tabData = getById('tabData');
            const tabWhatsapp = getById('tabWhatsapp');
            const tabEmail = getById('tabEmail');
            const footer = getById('userModalFooter');
            if (tabData)
                tabData.classList.toggle('hidden', tab !== 'data');
            if (tabWhatsapp)
                tabWhatsapp.classList.toggle('hidden', tab !== 'whatsapp');
            if (tabEmail)
                tabEmail.classList.toggle('hidden', tab !== 'email');
            footer.classList.remove('hidden');
            qsa('.tab-btn').forEach((btn) => {
                const isActive = btn.dataset.tab === tab;
                btn.classList.toggle('border-brand-600', isActive);
                btn.classList.toggle('text-brand-600', isActive);
                btn.classList.toggle('border-transparent', !isActive);
                btn.classList.toggle('text-gray-500', !isActive);
            });
            if (tab === 'whatsapp') {
                renderWhatsappContent();
                if (!waSessionLoadedOnce) {
                    waSessionLoadedOnce = true;
                    void loadWaSession({ autoStart: true });
                }
                else {
                    scheduleWaPolling();
                }
            }
        }
        function runDeferredAsync(action) {
            window.setTimeout(() => {
                Promise.resolve(action()).catch((error) => {
                    console.warn('[users] Ação assíncrona adiada falhou:', error);
                });
            }, 0);
        }
        // --- WhatsApp ---
        function renderWhatsappContent() {
            const container = getById('whatsappContent');
            if (!container)
                return;
            const statusMeta = getWaStatusMeta();
            const hasQr = !!waSession.qr_code_data_url;
            const hasPairingCode = !!waSession.pairing_code;
            const isBusy = waSession.status === 'initializing';
            const connectedNumberDisplay = formatConnectedNumber();
            const connectedNumberDigits = resolveConnectedNumber();
            const lastEventAt = waSession.last_event_at
                ? new Date(waSession.last_event_at).toLocaleString('pt-BR')
                : null;
            container.innerHTML = `
            <div class="max-w-2xl mx-auto w-full">
                <div class="flex justify-between items-center mb-4">
                    <h4 class="text-base font-semibold dark:text-white">WhatsApp Business</h4>
                    <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusMeta.badgeClass}">${statusMeta.label}</span>
                </div>
                <div class="p-4 bg-gray-50 dark:bg-slate-900/30 rounded-xl border dark:border-slate-700">
                    <div class="space-y-4">
                        <div class="bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 p-4">
                            <div class="flex items-start justify-between gap-4 flex-wrap">
                                <div>
                                    <div class="text-xs uppercase tracking-wide text-gray-400 mb-1">Modo de atendimento</div>
                                    <h5 class="text-sm font-semibold dark:text-white">Respostas automáticas ou operação manual</h5>
                                </div>
                                <div class="w-full sm:w-56" style="min-width: 220px;">
                                    <label for="formWhatsAppAutoReplyMode" class="sr-only">Modo de atendimento</label>
                                    <select id="formWhatsAppAutoReplyMode" class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100">
                                        <option value="automatic" ${editingUserWhatsAppAutoReplyMode === 'automatic' ? 'selected' : ''}>Automático</option>
                                        <option value="manual" ${editingUserWhatsAppAutoReplyMode === 'manual' ? 'selected' : ''}>Manual</option>
                                    </select>
                                </div>
                            </div>
                            <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">No modo automático, o sistema responde e monta pedidos sozinho. No modo manual, o WhatsApp continua recebendo e enviando mensagens sem auto-resposta.</p>
                        </div>
                        <div class="grid grid-cols-[1.7fr,0.8fr] gap-5">
                            <div class="space-y-3">
                                <div class="bg-white dark:bg-slate-800 p-3 rounded-lg border dark:border-slate-700 text-sm dark:text-gray-300">${statusMeta.helper}</div>
                                <div class="grid grid-cols-2 gap-3 text-sm">
                                    <div class="bg-white dark:bg-slate-800 p-3 rounded-lg border dark:border-slate-700">
                                        <div class="text-xs uppercase tracking-wide text-gray-400 mb-1">Número conectado</div>
                                        <div class="font-medium dark:text-white">${connectedNumberDisplay}</div>
                                    </div>
                                    <div class="bg-white dark:bg-slate-800 p-3 rounded-lg border dark:border-slate-700">
                                        <div class="text-xs uppercase tracking-wide text-gray-400 mb-1">Última atualização</div>
                                        <div class="font-medium dark:text-white">${lastEventAt || 'Aguardando'}</div>
                                    </div>
                                </div>
                                <div class="flex gap-2">
                                    <button type="button" id="btnStartWa" class="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-700 transition-colors" ${isBusy ? 'disabled' : ''}>${isBusy ? 'Gerando QR...' : 'Iniciar Sessão'}</button>
                                    <button type="button" id="btnDisconnectWa" class="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">Desconectar</button>
                                </div>
                                <div class="grid grid-cols-[1fr,auto] gap-2 items-end">
                                    <div>
                                        <label for="waPairPhone" class="block text-xs uppercase tracking-wide text-gray-400 mb-1">Parear por telefone (DDI + DDD + numero)</label>
                                        <input type="tel" id="waPairPhone" placeholder="Ex: 5511999999999" value="${connectedNumberDigits}" class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100" />
                                    </div>
                                    <button type="button" id="btnPairWa" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors" ${isBusy ? 'disabled' : ''}>Gerar codigo</button>
                                </div>
                                ${waSession.last_error ? `<div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${waSession.last_error}</div>` : ''}
                            </div>
                            <div class="bg-white dark:bg-slate-800 p-3 rounded-xl border border-dashed dark:border-slate-700 flex flex-col items-center justify-center gap-2 min-h-56">
                                ${hasPairingCode ? `
                                    <div class="w-full rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-4 text-center">
                                        <div class="text-xs uppercase tracking-wide text-indigo-600">Codigo de pareamento</div>
                                        <div class="mt-2 text-3xl font-bold tracking-widest text-indigo-700">${waSession.pairing_code}</div>
                                    </div>
                                    <p class="text-xs text-center text-gray-500 dark:text-gray-400">No celular: WhatsApp > Dispositivos conectados > Conectar com numero de telefone.</p>
                                ` : hasQr ? `
                                    <div class="flex items-center justify-center rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-gray-100">
                                        <img src="${waSession.qr_code_data_url}" alt="QR Code WhatsApp" class="block rounded-lg" style="width: 200px; height: 200px; image-rendering: pixelated;">
                                    </div>
                                    <p class="text-xs text-center text-gray-500 dark:text-gray-400">Escaneie com o WhatsApp no celular. Se expirar, clique em Iniciar Sessão.</p>
                                ` : `
                                    <div class="flex items-center justify-center rounded-xl border border-dashed border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-900/40 px-4 text-center" style="width: 200px; height: 200px;">
                                        <span class="text-xs text-gray-400">O QR Code aparecerá aqui após iniciar a sessão.</span>
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
            const whatsappModeSelect = getById('formWhatsAppAutoReplyMode');
            if (whatsappModeSelect) {
                whatsappModeSelect.value = editingUserWhatsAppAutoReplyMode;
                whatsappModeSelect.addEventListener('change', () => {
                    editingUserWhatsAppAutoReplyMode = whatsappModeSelect.value === 'manual' ? 'manual' : 'automatic';
                });
            }
            getById('btnStartWa')?.addEventListener('click', () => {
                runDeferredAsync(() => startWaSession());
            });
            getById('btnPairWa')?.addEventListener('click', () => {
                runDeferredAsync(() => requestWaPairingCode());
            });
            getById('btnDisconnectWa')?.addEventListener('click', () => {
                runDeferredAsync(() => disconnectWaSession());
            });
        }
        function shouldAutoStartWaSession() {
            return waSession.status === 'idle'
                || waSession.status === 'disconnected'
                || waSession.status === 'auth_failure'
                || waSession.status === 'error';
        }
        async function loadWaSession({ autoStart = false } = {}) {
            if (!editingUserId)
                return;
            try {
                const res = await api(`/users/${editingUserId}/whatsapp-business/session`);
                waSession = res.data || res;
                if (autoStart && shouldAutoStartWaSession()) {
                    await startWaSession();
                    return;
                }
            }
            catch (e) {
                console.warn(e);
                waSession = {
                    ...waSession,
                    status: 'error',
                    last_error: e?.message || 'Falha ao carregar sessão do WhatsApp Business.',
                    qr_code_data_url: null,
                    has_qr_code: false,
                };
            }
            if (activeTab === 'whatsapp') {
                renderWhatsappContent();
                scheduleWaPolling();
            }
        }
        async function startWaSession({ pairPhone = null } = {}) {
            try {
                const body = pairPhone ? JSON.stringify({ phone: pairPhone }) : undefined;
                const res = await api(`/users/${editingUserId}/whatsapp-business/session`, { method: 'POST', ...(body ? { body } : {}) });
                waSession = res.data || res;
                if (activeTab === 'whatsapp') {
                    renderWhatsappContent();
                    scheduleWaPolling();
                }
            }
            catch (e) {
                waSession = {
                    ...waSession,
                    status: 'error',
                    last_error: e?.message || 'Falha ao iniciar sessão do WhatsApp Business.',
                    qr_code_data_url: null,
                    has_qr_code: false,
                };
                if (activeTab === 'whatsapp') {
                    renderWhatsappContent();
                }
            }
        }
        async function requestWaPairingCode() {
            const phoneInput = getById('waPairPhone');
            const phone = String(phoneInput?.value || '').replace(/\D/g, '');
            if (!phone) {
                waSession = {
                    ...waSession,
                    status: 'error',
                    last_error: 'Informe um telefone com DDI e DDD para gerar o codigo.',
                };
                renderWhatsappContent();
                return;
            }
            await startWaSession({ pairPhone: phone });
        }
        async function disconnectWaSession() {
            if (!confirm('Desconectar WhatsApp?'))
                return;
            try {
                clearWaPolling();
                const res = await api(`/users/${editingUserId}/whatsapp-business/session`, { method: 'DELETE' });
                waSession = res.data || res;
                renderWhatsappContent();
            }
            catch (e) {
                alert(e.message);
            }
        }
        // --- Email Config ---
        async function loadUserEmailConfig(userId) {
            if (!userId)
                return;
            const btn = getById('saveUserEmailConfigBtn');
            const alertBox = getById('emailConfigAlert');
            if (alertBox)
                alertBox.classList.add('hidden');
            try {
                if (btn)
                    btn.disabled = true;
                const res = await api(`/users/${userId}/email-config`);
                const config = res.data || {};
                getById('userSmtpHost').value = config.smtp_host || '';
                getById('userSmtpPort').value = config.smtp_port || 587;
                getById('userSmtpSecure').checked = !!config.smtp_secure;
                getById('userImapHost').value = config.imap_host || '';
                getById('userImapPort').value = config.imap_port || 993;
                getById('userImapSecure').checked = config.imap_secure !== false; // default true
                getById('userSmtpUser').value = config.smtp_user || '';
                getById('userSmtpPassword').value = ''; // Don't show password
                getById('userSenderName').value = config.sender_name || '';
                getById('userSenderEmail').value = config.sender_email || '';
                getById('userEmailIsActive').checked = config.is_active !== false; // default true
                const hint = getById('userHasPasswordHint');
                if (hint)
                    hint.classList.toggle('hidden', !config.has_password);
            }
            catch (e) {
                if (e.status !== 404) {
                    if (alertBox) {
                        alertBox.className = 'mb-4 rounded-lg px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200';
                        alertBox.textContent = e.message || 'Falha ao carregar configuração de e-mail.';
                        alertBox.classList.remove('hidden');
                    }
                }
            }
            finally {
                if (btn)
                    btn.disabled = false;
            }
        }
        async function saveEmailConfig(event) {
            event.preventDefault();
            if (!editingUserId)
                return;
            const payload = {
                smtp_host: getById('userSmtpHost').value.trim(),
                smtp_port: parseInt(getById('userSmtpPort').value) || 587,
                smtp_secure: getById('userSmtpSecure').checked,
                imap_host: getById('userImapHost').value.trim(),
                imap_port: parseInt(getById('userImapPort').value) || 993,
                imap_secure: getById('userImapSecure').checked,
                smtp_user: getById('userSmtpUser').value.trim(),
                smtp_password: getById('userSmtpPassword').value,
                sender_name: getById('userSenderName').value.trim(),
                sender_email: getById('userSenderEmail').value.trim(),
                is_active: getById('userEmailIsActive').checked
            };
            if (!payload.smtp_password)
                delete payload.smtp_password;
            const btn = getById('saveUserEmailConfigBtn');
            const alertBox = getById('emailConfigAlert');
            if (alertBox)
                alertBox.classList.add('hidden');
            try {
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Salvando...`;
                }
                await api(`/users/${editingUserId}/email-config`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                if (alertBox) {
                    alertBox.className = 'mb-4 rounded-lg px-4 py-3 text-sm bg-green-50 text-green-700 border border-green-200';
                    alertBox.textContent = 'Configuração de e-mail salva com sucesso!';
                    alertBox.classList.remove('hidden');
                }
                getById('userSmtpPassword').value = '';
                const hint = getById('userHasPasswordHint');
                if (hint)
                    hint.classList.remove('hidden');
            }
            catch (e) {
                if (alertBox) {
                    alertBox.className = 'mb-4 rounded-lg px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200';
                    alertBox.textContent = e.message || 'Falha ao salvar configuração.';
                    alertBox.classList.remove('hidden');
                }
            }
            finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Salvar Configuração';
                }
            }
        }
        // --- Save ---
        async function saveUser(event) {
            event.preventDefault();
            if (saving)
                return;
            const userId = getById('userId').value;
            const isEdit = Boolean(userId);
            const payload = {
                full_name: getById('formFullName').value.trim(),
                email: getById('formEmail').value.trim(),
                phone: getById('formPhone').value.trim(),
                role: getById('formRole').value,
                passwordRaw: getById('formPassword').value,
                default_page: getById('formDefaultPage').value,
                whatsapp_auto_reply_mode: (getById('formWhatsAppAutoReplyMode')?.value || editingUserWhatsAppAutoReplyMode || editingUserData?.whatsapp_auto_reply_mode || 'automatic'),
            };
            // Remove campos opcionais vazios para não falhar na validação do backend
            if (!payload.passwordRaw)
                delete payload.passwordRaw;
            if (!payload.full_name) {
                UI.showAlert('alertMessage', 'O nome completo é obrigatório.', 'error');
                getById('formFullName').focus();
                return;
            }
            if (!payload.email) {
                UI.showAlert('alertMessage', 'O e-mail é obrigatório.', 'error');
                getById('formEmail').focus();
                return;
            }
            if (!payload.role) {
                UI.showAlert('alertMessage', 'Selecione um perfil.', 'error');
                getById('formRole').focus();
                return;
            }
            if (!isEdit && !payload.passwordRaw) {
                UI.showAlert('alertMessage', 'A senha é obrigatória para novos usuários (mínimo 6 caracteres).', 'error');
                getById('formPassword').focus();
                return;
            }
            saving = true;
            const btn = getById('saveUserBtn');
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Salvando...';
            }
            try {
                const method = isEdit ? 'PATCH' : 'POST';
                const endpoint = isEdit ? `/users/${userId}` : '/users';
                const response = await api(endpoint, { method, body: JSON.stringify(payload) });
                const savedUser = response?.data || null;
                const selectedDefaultPage = payload.default_page || null;
                if (savedUser && (savedUser.default_page || null) !== selectedDefaultPage) {
                    throw new Error('A página inicial após login não foi gravada. Verifique se a migração do campo default_page foi aplicada no banco.');
                }
                closeModal();
                UI.showAlert('alertMessage', `Usuário ${isEdit ? 'atualizado' : 'cadastrado'} com sucesso!`, 'success');
                await loadData();
                renderTable();
                renderGrid();
            }
            catch (e) {
                UI.showAlert('alertMessage', e.message || 'Falha ao salvar usuário.', 'error');
            }
            finally {
                saving = false;
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Salvar';
                }
            }
        }
        // --- Toggle Status ---
        async function toggleStatus(id, isActive) {
            if (!confirm('Deseja realmente alterar o status deste usuário?'))
                return;
            try {
                await api(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ is_active: isActive }) });
                await loadData();
                renderTable();
                renderGrid();
            }
            catch (e) {
                UI.showAlert('alertMessage', e.message || 'Falha ao alterar status.', 'error');
            }
        }
        // --- Init ---
        await loadData();
        setView(currentView);
        // Static event listeners
        getById('btnListView')?.addEventListener('click', () => setView('list'));
        getById('btnGridView')?.addEventListener('click', () => setView('grid'));
        getById('btnNewUser')?.addEventListener('click', () => openModalDeferred());
        getById('btnCancelModal')?.addEventListener('click', closeModal);
        getById('userModalBackdrop')?.addEventListener('click', closeModal);
        getById('userForm')?.addEventListener('submit', saveUser);
        getById('userEmailConfigForm')?.addEventListener('submit', saveEmailConfig);
        getById('toggleUserSmtpPassword')?.addEventListener('click', (e) => {
            const input = getById('userSmtpPassword');
            if (input) {
                if (input.type === 'password') {
                    input.type = 'text';
                    e.currentTarget.innerHTML = `<svg class="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0a10.05 10.05 0 015.71-1.58c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>`;
                }
                else {
                    input.type = 'password';
                    e.currentTarget.innerHTML = `<svg class="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>`;
                }
            }
        });
        getById('filterSearch')?.addEventListener('input', (e) => {
            const target = e.target;
            const nextSearch = target?.value || '';
            if (searchDebounceTimer) {
                clearTimeout(searchDebounceTimer);
            }
            searchDebounceTimer = setTimeout(() => {
                filters.search = nextSearch;
                renderTable();
                renderGrid();
                searchDebounceTimer = null;
            }, 180);
        });
        getById('filterRole')?.addEventListener('change', (e) => {
            filters.role = e.target.value;
            renderTable();
            renderGrid();
        });
    });
})();
