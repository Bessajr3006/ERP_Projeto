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
        let selectedPhotoFile = null;
        let selectedPhotoBase64 = null;
        let photoMarkedForRemoval = false;
        let cameraStream = null;
        let originalPhotoSrc = null;
        let zoomPercent = 100;
        let panX = 0;
        let panY = 0;
        let isDraggingPhoto = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let imgWidth = 0;
        let imgHeight = 0;
        const USER_PHOTO_ALLOWED_TYPES = new Set(['image/png', 'image/jpg', 'image/jpeg', 'image/webp']);
        const USER_PHOTO_MAX_BYTES = 2 * 1024 * 1024; // 2MB
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
                UI.showAlert('alertMessage', 'Usuário excluído com sucesso!', 'success');
                await loadData();
                refreshView();
            }
            catch (e) {
                UI.showAlert('alertMessage', e.message || 'Erro ao excluir usuário', 'error');
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
                    <div class="flex items-center gap-3">
                        ${u.photo_base64
                ? `<img src="${u.photo_base64}" alt="${u.full_name}" class="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-gray-200 dark:ring-slate-700">`
                : `<div class="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-xs shrink-0 ring-1 ring-gray-200 dark:ring-slate-700">${String(u.full_name || 'U').charAt(0).toUpperCase()}</div>`}
                        <div>
                            <div class="font-semibold text-gray-900 dark:text-gray-100">${u.full_name}</div>
                            <div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                <span class="font-mono text-[10px] select-all">${u.public_id}</span>
                                <button type="button" class="view-id-btn text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transform transition-all duration-200 ease-out" data-id="${u.public_id}" title="Copiar ID: ${u.public_id}">
                                    <svg class="h-3.5 w-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
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
                grid.innerHTML = `<div class="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">Nenhum usuário encontrado.</div>`;
                return;
            }
            grid.innerHTML = filtered.map((u) => {
                const statusBadge = u.is_active
                    ? `<span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Ativo</span>`
                    : `<span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Inativo</span>`;
                const avatarMarkup = u.photo_base64
                    ? `<img src="${u.photo_base64}" alt="${u.full_name}" class="w-16 h-16 rounded-full object-cover shrink-0 ring-2 ring-gray-100 dark:ring-slate-700 shadow-sm">`
                    : `<div class="w-16 h-16 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-xl shrink-0 ring-2 ring-gray-100 dark:ring-slate-700 shadow-sm">${String(u.full_name || 'U').charAt(0).toUpperCase()}</div>`;
                const roleLabels = {
                    admin: 'Administrador',
                    user: 'Usuário',
                    operator: 'Operador',
                    financial: 'Financeiro',
                    manager: 'Gerente',
                    seller: 'Vendedor',
                    accountant: 'Contador',
                    buyer: 'Comprador',
                    service_provider: 'Prestador de Serviço',
                    super_admin: 'Super Admin',
                    admin_basic: 'Admin Básico'
                };
                const roleLabel = roleLabels[u.role] || u.role;
                return `
                <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col border border-gray-100 dark:border-slate-700 relative group transition-all duration-200 hover:shadow-md ${!u.is_active ? 'opacity-65' : ''}">
                    <div class="mb-4 flex items-center gap-4">
                        ${avatarMarkup}
                        <div class="min-w-0 flex-1">
                            <h4 class="text-base font-bold text-gray-900 dark:text-gray-100 truncate">${u.full_name}</h4>
                            <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">${roleLabel}</span>
                        </div>
                    </div>
                    
                    <div class="space-y-1.5 mb-4 text-sm text-gray-600 dark:text-gray-300">
                        <div class="flex items-center gap-2">
                            <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                            <span class="truncate text-xs" title="${u.email}">${u.email}</span>
                        </div>
                        ${u.phone ? `
                        <div class="flex items-center gap-2">
                            <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                            <span class="text-xs">${u.phone}</span>
                        </div>
                        ` : ''}
                    </div>

                    <div class="mt-auto pt-3 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center text-xs text-gray-400">
                        <div>${statusBadge}</div>
                        <div class="flex items-center gap-1">
                            <button type="button" title="Editar" class="text-brand-600 hover:bg-brand-50 p-1.5 rounded-full dark:hover:bg-brand-900/30 edit-btn" data-id="${u.public_id}">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </button>
                            <button type="button" title="${u.is_active ? 'Inativar' : 'Ativar'}" class="text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 p-1.5 rounded-full status-btn" data-id="${u.public_id}" data-active="${u.is_active}">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </button>
                            ${u.is_deletable ? `
                            <button type="button" title="Excluir" class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded-full delete-btn" data-id="${u.public_id}">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
            }).join('');
            grid.querySelectorAll('.edit-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const user = filtered.find(u => u.public_id === btn.dataset.id);
                    if (user)
                        openModalDeferred(user);
                });
            });
            grid.querySelectorAll('.status-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;
                    const active = btn.dataset.active === 'true';
                    toggleStatus(id, !active);
                });
            });
            grid.querySelectorAll('.delete-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    deleteUser(btn.dataset.id);
                });
            });
        }
        function refreshView() {
            if (currentView === 'list') {
                renderTable();
            }
            else {
                renderGrid();
            }
        }
        // --- View toggle ---
        function setView(view) {
            currentView = view;
            localStorage.setItem('usersView', view);
            const tableSection = getById('usersSection');
            const gridSection = getById('usersGridSection');
            const btnList = getById('btnListView');
            const btnGrid = getById('btnGridView');
            if (tableSection && gridSection) {
                if (view === 'list') {
                    tableSection.classList.remove('hidden');
                    gridSection.classList.add('hidden');
                    gridSection.classList.remove('grid');
                }
                else {
                    tableSection.classList.add('hidden');
                    gridSection.classList.remove('hidden');
                    gridSection.classList.add('grid');
                }
            }
            const activeClasses = ["bg-brand-100", "dark:bg-brand-900/40", "text-brand-700", "dark:text-brand-300", "shadow-sm"];
            const inactiveClasses = ["text-gray-500", "hover:text-gray-700", "dark:text-gray-400", "dark:hover:text-gray-200"];
            if (btnList && btnGrid) {
                if (view === 'list') {
                    btnList.classList.add(...activeClasses);
                    btnList.classList.remove(...inactiveClasses);
                    btnGrid.classList.add(...inactiveClasses);
                    btnGrid.classList.remove(...activeClasses);
                }
                else {
                    btnGrid.classList.add(...activeClasses);
                    btnGrid.classList.remove(...inactiveClasses);
                    btnList.classList.add(...inactiveClasses);
                    btnList.classList.remove(...activeClasses);
                }
            }
            refreshView();
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
            // WhatsApp/Email/Photo tabs
            const tabsList = getById('userModalTabs');
            const existingWaTab = tabsList.querySelector('[data-tab="whatsapp"]')?.closest('li');
            if (existingWaTab)
                existingWaTab.remove();
            const existingEmailTab = tabsList.querySelector('[data-tab="email"]')?.closest('li');
            if (existingEmailTab)
                existingEmailTab.remove();
            const existingPhotoTab = tabsList.querySelector('[data-tab="photo"]')?.closest('li');
            if (existingPhotoTab)
                existingPhotoTab.remove();
            const liWhatsapp = document.createElement('li');
            liWhatsapp.innerHTML = `<button type="button" data-tab="whatsapp" class="tab-btn pb-3 border-b-2 border-transparent text-gray-500 font-medium px-1 text-sm flex gap-2 items-center">WhatsApp</button>`;
            tabsList.appendChild(liWhatsapp);
            const liEmail = document.createElement('li');
            liEmail.innerHTML = `<button type="button" data-tab="email" class="tab-btn pb-3 border-b-2 border-transparent text-gray-500 font-medium px-1 text-sm flex gap-2 items-center">E-mail</button>`;
            tabsList.appendChild(liEmail);
            const liPhoto = document.createElement('li');
            liPhoto.innerHTML = `<button type="button" data-tab="photo" class="tab-btn pb-3 border-b-2 border-transparent text-gray-500 font-medium px-1 text-sm flex gap-2 items-center">Foto</button>`;
            tabsList.appendChild(liPhoto);
            // Reset photo upload fields
            selectedPhotoFile = null;
            selectedPhotoBase64 = null;
            photoMarkedForRemoval = false;
            const photoFileInput = getById('userPhotoFile');
            if (photoFileInput)
                photoFileInput.value = '';
            if (user && user.photo_base64) {
                setUserPhotoPreviewState({
                    src: user.photo_base64,
                    fileName: user.photo_filename || 'foto_usuario.png',
                    showPreview: true
                });
            }
            else {
                setUserPhotoPreviewState();
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
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
                cameraStream = null;
            }
            const cameraContainer = getById('userCameraContainer');
            const uploadContainer = getById('userPhotoUploadContainer');
            const adjustContainer = getById('userPhotoAdjustmentContainer');
            if (cameraContainer) {
                cameraContainer.classList.add('hidden');
                cameraContainer.classList.remove('flex');
            }
            if (adjustContainer) {
                adjustContainer.classList.add('hidden');
                adjustContainer.classList.remove('flex');
            }
            if (uploadContainer)
                uploadContainer.classList.remove('hidden');
            getById('userModal').classList.add('hidden');
        }
        function setUserPhotoPreviewState(state = {}) {
            const preview = getById('userPhotoPreview');
            const container = getById('userPhotoPreviewContainer');
            const actions = getById('userPhotoActions');
            const fileNameLabel = getById('userPhotoFileName');
            const photoInfo = getById('userPhotoInfo');
            if (!preview)
                return;
            if (state.showPreview && state.src) {
                preview.src = state.src;
                preview.classList.remove('hidden');
                if (container)
                    container.classList.add('opacity-0');
                if (actions) {
                    actions.classList.remove('hidden');
                    actions.classList.add('flex');
                }
                if (fileNameLabel)
                    fileNameLabel.textContent = state.fileName || 'foto.png';
                if (photoInfo)
                    photoInfo.textContent = 'Foto carregada.';
            }
            else {
                preview.src = '';
                preview.classList.add('hidden');
                if (container)
                    container.classList.remove('opacity-0');
                if (actions) {
                    actions.classList.add('hidden');
                    actions.classList.remove('flex');
                }
                if (fileNameLabel)
                    fileNameLabel.textContent = '';
                if (photoInfo) {
                    photoInfo.textContent = photoMarkedForRemoval
                        ? 'Ao salvar, a foto atual será removida.'
                        : 'Nenhuma foto salva.';
                }
            }
        }
        function startPhotoAdjustment(base64) {
            originalPhotoSrc = base64;
            const img = getById('userPhotoToAdjust');
            if (img) {
                img.onload = () => {
                    imgWidth = img.naturalWidth;
                    imgHeight = img.naturalHeight;
                    zoomPercent = 100;
                    panX = 0;
                    panY = 0;
                    const slider = getById('userPhotoZoomSlider');
                    if (slider)
                        slider.value = '100';
                    updateAdjustedImageStyle();
                };
                img.src = base64;
            }
            const adjustContainer = getById('userPhotoAdjustmentContainer');
            const uploadContainer = getById('userPhotoUploadContainer');
            if (adjustContainer) {
                adjustContainer.classList.remove('hidden');
                adjustContainer.classList.add('flex');
            }
            if (uploadContainer)
                uploadContainer.classList.add('hidden');
        }
        function updateAdjustedImageStyle() {
            const img = getById('userPhotoToAdjust');
            if (!img)
                return;
            const scale = zoomPercent / 100;
            let displayWidth = 192;
            let displayHeight = 192;
            if (imgWidth && imgHeight) {
                const aspect = imgWidth / imgHeight;
                if (aspect > 1) {
                    displayHeight = 192;
                    displayWidth = 192 * aspect;
                }
                else {
                    displayWidth = 192;
                    displayHeight = 192 / aspect;
                }
            }
            const finalWidth = displayWidth * scale;
            const finalHeight = displayHeight * scale;
            const minPanX = 192 - finalWidth;
            const minPanY = 192 - finalHeight;
            if (panX > 0)
                panX = 0;
            if (panY > 0)
                panY = 0;
            if (panX < minPanX)
                panX = minPanX;
            if (panY < minPanY)
                panY = minPanY;
            img.style.width = `${finalWidth}px`;
            img.style.height = `${finalHeight}px`;
            img.style.left = `${panX}px`;
            img.style.top = `${panY}px`;
        }
        function applyUserPhotoFile(file) {
            if (!file)
                return;
            if (!USER_PHOTO_ALLOWED_TYPES.has(file.type)) {
                UI.showAlert('alertMessage', 'Formato de foto inválido. Use PNG, JPG, JPEG ou WEBP.', 'error');
                const fileInput = getById('userPhotoFile');
                if (fileInput)
                    fileInput.value = '';
                return;
            }
            if (file.size > USER_PHOTO_MAX_BYTES) {
                UI.showAlert('alertMessage', 'A foto deve ter no máximo 2MB.', 'error');
                const fileInput = getById('userPhotoFile');
                if (fileInput)
                    fileInput.value = '';
                return;
            }
            selectedPhotoFile = file;
            photoMarkedForRemoval = false;
            const reader = new FileReader();
            reader.onload = (evt) => {
                startPhotoAdjustment(String(evt.target?.result || ''));
            };
            reader.readAsDataURL(file);
            UI.hideAlert('alertMessage');
        }
        function switchTab(tab) {
            activeTab = tab;
            const tabData = getById('tabData');
            const tabWhatsapp = getById('tabWhatsapp');
            const tabEmail = getById('tabEmail');
            const tabPhoto = getById('tabPhoto');
            const footer = getById('userModalFooter');
            if (tabData)
                tabData.classList.toggle('hidden', tab !== 'data');
            if (tabWhatsapp)
                tabWhatsapp.classList.toggle('hidden', tab !== 'whatsapp');
            if (tabEmail)
                tabEmail.classList.toggle('hidden', tab !== 'email');
            if (tabPhoto)
                tabPhoto.classList.toggle('hidden', tab !== 'photo');
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
                if (editingUserId) {
                    if (!waSessionLoadedOnce) {
                        waSessionLoadedOnce = true;
                        void loadWaSession({ autoStart: true });
                    }
                    else {
                        scheduleWaPolling();
                    }
                }
            }
            else if (tab === 'email') {
                const hasUser = !!editingUserId;
                const saveEmailBtn = getById('saveUserEmailConfigBtn');
                if (saveEmailBtn) {
                    saveEmailBtn.classList.toggle('hidden', !hasUser);
                }
                let newNotice = getById('emailCreationNotice');
                if (!newNotice) {
                    newNotice = document.createElement('p');
                    newNotice.id = 'emailCreationNotice';
                    newNotice.className = 'text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium italic';
                    newNotice.textContent = '* As configurações de e-mail serão salvas automaticamente junto com os dados básicos do usuário.';
                    saveEmailBtn?.parentNode?.appendChild(newNotice);
                }
                newNotice.classList.toggle('hidden', hasUser);
                if (hasUser) {
                    void loadUserEmailConfig(editingUserId);
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
            const isNewUser = !editingUserId;
            const statusMeta = getWaStatusMeta();
            const hasQr = !isNewUser && !!waSession.qr_code_data_url;
            const hasPairingCode = !isNewUser && !!waSession.pairing_code;
            const isBusy = !isNewUser && waSession.status === 'initializing';
            const connectedNumberDisplay = isNewUser ? 'Não disponível' : formatConnectedNumber();
            const connectedNumberDigits = isNewUser ? '' : resolveConnectedNumber();
            const lastEventAt = !isNewUser && waSession.last_event_at
                ? new Date(waSession.last_event_at).toLocaleString('pt-BR')
                : null;
            container.innerHTML = `
            <div class="max-w-2xl mx-auto w-full">
                <div class="flex justify-between items-center mb-4">
                    <h4 class="text-base font-semibold dark:text-white">WhatsApp Business</h4>
                    ${isNewUser ? '' : `<span class="px-3 py-1 rounded-full text-xs font-semibold ${statusMeta.badgeClass}">${statusMeta.label}</span>`}
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
                        
                        ${isNewUser ? `
                            <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm text-yellow-700 dark:text-yellow-400 flex items-start gap-3">
                                <svg class="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <div>
                                    <p class="font-medium">Pareamento temporariamente indisponível</p>
                                    <p class="mt-1 text-xs opacity-90">A conexão (leitura do QR Code ou código de pareamento) estará disponível assim que você salvar este novo usuário.</p>
                                </div>
                            </div>
                        ` : `
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
                        `}
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
            if (selectedPhotoBase64) {
                payload.photo_base64 = selectedPhotoBase64;
                payload.photo_filename = selectedPhotoFile ? selectedPhotoFile.name : 'foto.png';
            }
            else if (photoMarkedForRemoval) {
                payload.photo_base64 = null;
                payload.photo_filename = null;
            }
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
                if (savedUser && !isEdit) {
                    const smtpHost = getById('userSmtpHost').value.trim();
                    const smtpUser = getById('userSmtpUser').value.trim();
                    if (smtpHost && smtpUser) {
                        const emailPayload = {
                            smtp_host: smtpHost,
                            smtp_port: parseInt(getById('userSmtpPort').value) || 587,
                            smtp_secure: getById('userSmtpSecure').checked,
                            imap_host: getById('userImapHost').value.trim(),
                            imap_port: parseInt(getById('userImapPort').value) || 993,
                            imap_secure: getById('userImapSecure').checked,
                            smtp_user: smtpUser,
                            smtp_password: getById('userSmtpPassword').value,
                            sender_name: getById('userSenderName').value.trim(),
                            sender_email: getById('userSenderEmail').value.trim(),
                            is_active: getById('userEmailIsActive').checked
                        };
                        try {
                            await api(`/users/${savedUser.public_id}/email-config`, {
                                method: 'POST',
                                body: JSON.stringify(emailPayload)
                            });
                        }
                        catch (emailErr) {
                            console.error('Erro ao salvar configuração de e-mail inicial:', emailErr);
                        }
                    }
                }
                closeModal();
                UI.showAlert('alertMessage', `Usuário ${isEdit ? 'atualizado' : 'cadastrado'} com sucesso!`, 'success');
                await loadData();
                refreshView();
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
                refreshView();
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
                refreshView();
                searchDebounceTimer = null;
            }, 180);
        });
        getById('filterRole')?.addEventListener('change', (e) => {
            filters.role = e.target.value;
            refreshView();
        });
        const photoFileInput = getById('userPhotoFile');
        photoFileInput?.addEventListener('change', (event) => {
            applyUserPhotoFile(event.target?.files?.[0]);
        });
        const photoDropzone = getById('userPhotoDropzone');
        if (photoDropzone) {
            ['dragenter', 'dragover'].forEach((eventName) => {
                photoDropzone.addEventListener(eventName, (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    photoDropzone.classList.add('border-brand-500', 'bg-brand-50/20');
                });
            });
            ['dragleave', 'drop'].forEach((eventName) => {
                photoDropzone.addEventListener(eventName, (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    photoDropzone.classList.remove('border-brand-500', 'bg-brand-50/20');
                });
            });
            photoDropzone.addEventListener('drop', (event) => {
                applyUserPhotoFile(event.dataTransfer?.files?.[0]);
            });
        }
        getById('btnRemoveUserPhoto')?.addEventListener('click', () => {
            selectedPhotoFile = null;
            selectedPhotoBase64 = null;
            photoMarkedForRemoval = true;
            const fileInput = getById('userPhotoFile');
            if (fileInput)
                fileInput.value = '';
            setUserPhotoPreviewState();
        });
        getById('btnOpenCamera')?.addEventListener('click', async () => {
            const cameraContainer = getById('userCameraContainer');
            const uploadContainer = getById('userPhotoUploadContainer');
            const video = getById('userCameraVideo');
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: 'user'
                    },
                    audio: false
                });
                if (video) {
                    video.srcObject = stream;
                    cameraStream = stream;
                }
                if (cameraContainer) {
                    cameraContainer.classList.remove('hidden');
                    cameraContainer.classList.add('flex');
                }
                if (uploadContainer)
                    uploadContainer.classList.add('hidden');
                UI.hideAlert('alertMessage');
            }
            catch (err) {
                console.error('Erro ao acessar a camera:', err);
                UI.showAlert('alertMessage', 'Não foi possível acessar a câmera. Verifique as permissões do navegador.', 'error');
            }
        });
        getById('btnCancelCamera')?.addEventListener('click', () => {
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
                cameraStream = null;
            }
            const cameraContainer = getById('userCameraContainer');
            const uploadContainer = getById('userPhotoUploadContainer');
            if (cameraContainer) {
                cameraContainer.classList.add('hidden');
                cameraContainer.classList.remove('flex');
            }
            if (uploadContainer)
                uploadContainer.classList.remove('hidden');
        });
        getById('btnCaptureCamera')?.addEventListener('click', () => {
            const video = getById('userCameraVideo');
            if (video) {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 480;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const capturedBase64 = canvas.toDataURL('image/jpeg', 0.9);
                    startPhotoAdjustment(capturedBase64);
                }
            }
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
                cameraStream = null;
            }
            const cameraContainer = getById('userCameraContainer');
            if (cameraContainer) {
                cameraContainer.classList.add('hidden');
                cameraContainer.classList.remove('flex');
            }
        });
        const cropFrame = getById('userPhotoCropFrame');
        if (cropFrame) {
            const startDrag = (clientX, clientY) => {
                isDraggingPhoto = true;
                dragStartX = clientX - panX;
                dragStartY = clientY - panY;
            };
            const moveDrag = (clientX, clientY) => {
                if (!isDraggingPhoto)
                    return;
                panX = clientX - dragStartX;
                panY = clientY - dragStartY;
                updateAdjustedImageStyle();
            };
            const endDrag = () => {
                isDraggingPhoto = false;
            };
            cropFrame.addEventListener('mousedown', (e) => {
                startDrag(e.clientX, e.clientY);
            });
            window.addEventListener('mousemove', (e) => {
                moveDrag(e.clientX, e.clientY);
            });
            window.addEventListener('mouseup', endDrag);
            cropFrame.addEventListener('touchstart', (e) => {
                const touch = e.touches[0];
                if (touch)
                    startDrag(touch.clientX, touch.clientY);
            });
            window.addEventListener('touchmove', (e) => {
                const touch = e.touches[0];
                if (touch)
                    moveDrag(touch.clientX, touch.clientY);
            });
            window.addEventListener('touchend', endDrag);
        }
        getById('userPhotoZoomSlider')?.addEventListener('input', (e) => {
            zoomPercent = parseInt(e.target.value) || 100;
            updateAdjustedImageStyle();
        });
        getById('btnCancelAdjustment')?.addEventListener('click', () => {
            getById('userPhotoAdjustmentContainer')?.classList.add('hidden');
            getById('userPhotoAdjustmentContainer')?.classList.remove('flex');
            getById('userPhotoUploadContainer')?.classList.remove('hidden');
            selectedPhotoFile = null;
            selectedPhotoBase64 = null;
            photoMarkedForRemoval = true;
            const fileInput = getById('userPhotoFile');
            if (fileInput)
                fileInput.value = '';
            setUserPhotoPreviewState();
        });
        getById('btnConfirmAdjustment')?.addEventListener('click', () => {
            const img = getById('userPhotoToAdjust');
            if (!img || !originalPhotoSrc)
                return;
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const scale = zoomPercent / 100;
                let displayWidth = 192;
                let displayHeight = 192;
                if (imgWidth && imgHeight) {
                    const aspect = imgWidth / imgHeight;
                    if (aspect > 1) {
                        displayHeight = 192;
                        displayWidth = 192 * aspect;
                    }
                    else {
                        displayWidth = 192;
                        displayHeight = 192 / aspect;
                    }
                }
                const finalWidth = displayWidth * scale;
                const finalHeight = displayHeight * scale;
                const ratio = 256 / 192;
                const imageObj = new Image();
                imageObj.onload = () => {
                    ctx.clearRect(0, 0, 256, 256);
                    // Draw circular clipping path on canvas
                    ctx.beginPath();
                    ctx.arc(128, 128, 128, 0, Math.PI * 2, true);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(imageObj, panX * ratio, panY * ratio, finalWidth * ratio, finalHeight * ratio);
                    selectedPhotoBase64 = canvas.toDataURL('image/jpeg', 0.9);
                    selectedPhotoFile = null;
                    photoMarkedForRemoval = false;
                    setUserPhotoPreviewState({
                        src: selectedPhotoBase64,
                        fileName: 'foto_ajustada.jpg',
                        showPreview: true
                    });
                    getById('userPhotoAdjustmentContainer')?.classList.add('hidden');
                    getById('userPhotoAdjustmentContainer')?.classList.remove('flex');
                    getById('userPhotoUploadContainer')?.classList.remove('hidden');
                };
                imageObj.src = originalPhotoSrc;
            }
        });
    });
})();
