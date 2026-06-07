(() => {
    const getById = (id: string): any => document.getElementById(id);
    const qs = (selector: string): any => document.querySelector(selector);
    const qsa = (selector: string): any => document.querySelectorAll(selector);

/**
 * users.js
 * Gerenciamento de Usuários e WhatsApp QR Code - KEYSTONE ERP
 */

document.addEventListener('DOMContentLoaded', async () => {
    let waSessionPollTimer: any = null;
    let currentView: string = localStorage.getItem('usersView') || 'list';
    let activeTab: string = 'data';
    let editingUserId: any = null; // public_id do usuário sendo editado
    let usersData: any[] = [];
    let rolesData: any[] = [];
    let filters: { search: string; role: string } = { search: '', role: '' };
    let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    let saving: boolean = false;
    let waSessionLoadedOnce: boolean = false;
    let editingUserData: any = null;
    let editingUserWhatsAppAutoReplyMode: 'automatic' | 'manual' = 'automatic';
    let waSession: any = {
        status: 'idle',
        persisted_session: false,
        qr_code_data_url: null,
        pairing_code: null,
        connected_number: null,
        connected_name: null,
        last_event_at: null,
        last_error: null,
    };

    // --- Helpers ---
    const formatPhone = (phone) => {
        if (!phone) return '-';
        const clean = String(phone).replace(/\D/g, '');
        if (clean.length === 10) return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        if (clean.length === 11) return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        return phone;
    };

    const resolveConnectedNumber = () => {
        const fromConnected = String(waSession?.connected_number || '').replace(/\D/g, '');
        if (fromConnected) return fromConnected;

        const widRaw = String(waSession?.wid || '').trim();
        if (!widRaw) return '';

        const fromWid = widRaw.split('@')[0]?.replace(/\D/g, '') || '';
        return fromWid;
    };

    const formatConnectedNumber = () => {
        const digits = resolveConnectedNumber();
        if (!digits) return 'Não conectado';

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
            case 'ready':        return { badgeClass: 'bg-emerald-100 text-emerald-800', label: 'Conectado',     helper: 'Sessão ativa e pronta para envio de mensagens.' };
            case 'authenticated':return { badgeClass: 'bg-sky-100 text-sky-800',         label: 'Autenticado',   helper: 'WhatsApp autenticado. Finalizando preparação da sessão.' };
            case 'awaiting_qr':  return { badgeClass: 'bg-amber-100 text-amber-800',      label: 'Aguardando Pareamento', helper: waSession.pairing_code ? 'Use o codigo abaixo no WhatsApp do celular para conectar.' : 'Escaneie o QR code no WhatsApp do celular em Dispositivos conectados.' };
            case 'initializing': return { badgeClass: 'bg-blue-100 text-blue-800',        label: 'Inicializando', helper: 'Preparando o navegador e gerando um novo QR code.' };
            case 'auth_failure':
            case 'error':        return { badgeClass: 'bg-red-100 text-red-800',          label: 'Erro',          helper: waSession.last_error || 'Falha ao iniciar a sessão do WhatsApp Business.' };
            case 'disconnected': return { badgeClass: 'bg-slate-200 text-slate-700',      label: 'Desconectado',  helper: waSession.last_error || 'A sessão foi desconectada e precisa de um novo pareamento.' };
            default:             return { badgeClass: 'bg-slate-200 text-slate-700',      label: 'Inativo',       helper: 'Inicie a sessão para gerar um QR code novo.' };
        }
    };

    const clearWaPolling = () => {
        if (waSessionPollTimer) { clearTimeout(waSessionPollTimer); waSessionPollTimer = null; }
    };

    const shouldPollWa = () =>
        activeTab === 'whatsapp' &&
        !!editingUserId &&
        (waSession.status === 'initializing' || waSession.status === 'awaiting_qr');

    const scheduleWaPolling = () => {
        clearWaPolling();
        if (!shouldPollWa()) return;
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
        const formSel   = getById('formRole');

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

    // --- Render Table ---
    function renderTable() {
        const tbody = getById('usersTable');
        if (!tbody) return;
        const filtered = getFiltered();

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum usuário encontrado.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(u => `
            <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 ${!u.is_active ? 'opacity-60' : ''}">
                <td class="px-6 py-4 font-semibold text-gray-900 dark:text-gray-100 text-sm whitespace-nowrap">${u.full_name}</td>
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
                    </div>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const user = usersData.find(u => u.public_id === btn.dataset.id);
                if (user) openModalDeferred(user);
            });
        });

        tbody.querySelectorAll('.btn-status').forEach(btn => {
            btn.addEventListener('click', () => toggleStatus(btn.dataset.id, btn.dataset.active === 'false'));
        });

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
        if (!grid) return;
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
                </div>
                <div class="mt-auto flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
                    <button type="button" class="btn-edit-card p-2 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 rounded-lg hover:bg-brand-100 transition-colors" data-id="${u.public_id}" title="Editar">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                </div>
            </div>
        `).join('');

        grid.querySelectorAll('.btn-edit-card').forEach(btn => {
            btn.addEventListener('click', () => {
                const user = usersData.find(u => u.public_id === btn.dataset.id);
                if (user) openModalDeferred(user);
            });
        });

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
        const btnList     = getById('btnListView');
        const btnGrid     = getById('btnGridView');

        const activeClasses   = ['bg-brand-100', 'dark:bg-brand-900/40', 'text-brand-700', 'dark:text-brand-300', 'shadow-sm'];
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
        } else {
            listSection.style.display = 'none';
            gridSection.style.display = 'grid';
            btnGrid.querySelector('.check-icon')?.classList.remove('hidden');
            btnList.querySelector('.check-icon')?.classList.add('hidden');
            activeClasses.forEach(c => btnGrid.classList.add(c));
            inactiveClasses.forEach(c => btnGrid.classList.remove(c));
            inactiveClasses.forEach(c => btnList.classList.add(c));
            activeClasses.forEach(c => btnList.classList.remove(c));
        }

        renderTable();
        renderGrid();
    }

    // --- Modal ---
    function openModal(user: any = null) {
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
        getById('formEmail').value    = user?.email    || '';
        getById('formPhone').value    = user?.phone    || '';
        getById('formPassword').value = '';
        getById('formPassword').placeholder = user ? 'Deixe em branco para manter' : 'Mínimo 6 caracteres';
        getById('formDefaultPage').value = user?.default_page || '';

        // Populate role select and set value
        populateRoleSelects();
        getById('formRole').value = user?.role || '';

        // WhatsApp tab (only when editing)
        const tabsList = getById('userModalTabs');
        const existingWaTab = tabsList.querySelector('[data-tab="whatsapp"]')?.closest('li');
        if (existingWaTab) existingWaTab.remove();

        if (user) {
            const li = document.createElement('li');
            li.innerHTML = `<button type="button" data-tab="whatsapp" class="tab-btn pb-3 border-b-2 border-transparent text-gray-500 font-medium px-1 text-sm flex gap-2 items-center">WhatsApp Web / QR</button>`;
            tabsList.appendChild(li);
        }

        switchTab('data');
        getById('userModal').classList.remove('hidden');
        getById('formFullName').focus();

        // Attach tab listeners
        qsa('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });
    }

    function openModalDeferred(user: any = null) {
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

        const tabData      = getById('tabData');
        const tabWhatsapp  = getById('tabWhatsapp');
        const footer       = getById('userModalFooter');

        tabData.classList.toggle('hidden', tab !== 'data');
        tabWhatsapp.classList.toggle('hidden', tab !== 'whatsapp');
        footer.classList.remove('hidden');

        qsa('.tab-btn').forEach(btn => {
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
            } else {
                scheduleWaPolling();
            }
        }
    }

    function runDeferredAsync(action: () => Promise<void> | void) {
        window.setTimeout(() => {
            Promise.resolve(action()).catch((error) => {
                console.warn('[users] Ação assíncrona adiada falhou:', error);
            });
        }, 0);
    }

    // --- WhatsApp ---
    function renderWhatsappContent() {
        const container = getById('whatsappContent');
        if (!container) return;

        const statusMeta  = getWaStatusMeta();
        const hasQr       = !!waSession.qr_code_data_url;
        const hasPairingCode = !!waSession.pairing_code;
        const isBusy      = waSession.status === 'initializing';
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
        if (!editingUserId) return;

        try {
            const res = await api(`/users/${editingUserId}/whatsapp-business/session`);
            waSession = res.data || res;

            if (autoStart && shouldAutoStartWaSession()) {
                await startWaSession();
                return;
            }
        } catch (e) {
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

    async function startWaSession({ pairPhone = null }: { pairPhone?: string | null } = {}) {
        try {
            const body = pairPhone ? JSON.stringify({ phone: pairPhone }) : undefined;
            const res = await api(`/users/${editingUserId}/whatsapp-business/session`, { method: 'POST', ...(body ? { body } : {}) });
            waSession = res.data || res;

            if (activeTab === 'whatsapp') {
                renderWhatsappContent();
                scheduleWaPolling();
            }
        } catch (e) {
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
        if (!confirm('Desconectar WhatsApp?')) return;
        try {
            clearWaPolling();
            const res = await api(`/users/${editingUserId}/whatsapp-business/session`, { method: 'DELETE' });
            waSession = res.data || res;
            renderWhatsappContent();
        } catch (e) { alert(e.message); }
    }

    // --- Save ---
    async function saveUser(event) {
        event.preventDefault();
        if (saving) return;

        const userId   = getById('userId').value;
        const isEdit   = Boolean(userId);
        const payload  = {
            full_name:    getById('formFullName').value.trim(),
            email:        getById('formEmail').value.trim(),
            phone:        getById('formPhone').value.trim(),
            role:         getById('formRole').value,
            passwordRaw:  getById('formPassword').value,
            default_page: getById('formDefaultPage').value,
            whatsapp_auto_reply_mode: (getById('formWhatsAppAutoReplyMode')?.value || editingUserWhatsAppAutoReplyMode || editingUserData?.whatsapp_auto_reply_mode || 'automatic'),
        };

        // Remove campos opcionais vazios para não falhar na validação do backend
        if (!payload.passwordRaw) delete payload.passwordRaw;

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
        if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

        try {
            const method   = isEdit ? 'PATCH' : 'POST';
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
        } catch (e) {
            UI.showAlert('alertMessage', e.message || 'Falha ao salvar usuário.', 'error');
        } finally {
            saving = false;
            if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; }
        }
    }

    // --- Toggle Status ---
    async function toggleStatus(id, isActive) {
        if (!confirm('Deseja realmente alterar o status deste usuário?')) return;
        try {
            await api(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ is_active: isActive }) });
            await loadData();
            renderTable();
            renderGrid();
        } catch (e) {
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

    getById('filterSearch')?.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
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
