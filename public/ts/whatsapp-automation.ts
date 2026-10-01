(() => {
    let loggedInUserId: string = '';
    let selectedUserId: string = '';
    let usersList: any[] = [];

    const getById = (id: string) => document.getElementById(id);

    // DOM Elements
    const usersListTableBody = getById('usersListTableBody');
    const configModal = getById('configModal');
    const modalBackdrop = getById('modalBackdrop');
    const closeModalBtn = getById('closeModalBtn');
    const cancelModalBtn = getById('cancelModalBtn');
    const modalUsername = getById('modalUsername');
    const form = getById('whatsappAutomationForm') as HTMLFormElement | null;
    const waAutoReplyModeSelect = getById('waAutoReplyMode') as HTMLSelectElement | null;
    const waEnableManualBillingSelect = getById('waEnableManualBilling') as HTMLSelectElement | null;
    const waAutoSendBoletoSelect = getById('waAutoSendBoleto') as HTMLSelectElement | null;
    const alertMessage = getById('alertMessage');
    const saveBtn = getById('saveBtn') as HTMLButtonElement | null;

    function showAlert(message: string, type: 'success' | 'error') {
        if (!alertMessage) return;
        alertMessage.className = `mb-6 rounded-lg px-4 py-3 text-sm ${
            type === 'success'
                ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800'
                : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800'
        }`;
        alertMessage.textContent = message;
        alertMessage.classList.remove('hidden');

        // Scroll to top
        alertMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideAlert() {
        if (alertMessage) {
            alertMessage.classList.add('hidden');
        }
    }

    function getInitials(name: string): string {
        return name
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase() || 'U';
    }

    let currentCompany: any = null;

    function renderUserGrid() {
        if (!usersListTableBody) return;

        if (usersList.length === 0) {
            usersListTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
                        Nenhum usuário ativo encontrado.
                    </td>
                </tr>
            `;
            return;
        }

        const companySenderName = String(currentCompany?.boleto_send_whatsapp_name || '').trim().toLowerCase();
        const companySenderNumber = String(currentCompany?.boleto_send_whatsapp_number || '').replace(/\D/g, '');

        usersListTableBody.innerHTML = usersList.map(u => {
            const initials = getInitials(u.full_name);
            const autoReplyMode = u.whatsapp_auto_reply_mode || 'automatic';
            const enableManualBilling = u.whatsapp_enable_manual_billing !== undefined && u.whatsapp_enable_manual_billing !== null
                ? !!u.whatsapp_enable_manual_billing
                : true;
            const autoSendBoleto = u.whatsapp_auto_send_boleto !== undefined && u.whatsapp_auto_send_boleto !== null
                ? !!u.whatsapp_auto_send_boleto
                : false;

            const isConnected = u.whatsapp_status === 'authenticated' || u.whatsapp_status === 'ready';
            const userNumClean = String(u.whatsapp_number || u.phone || '').replace(/\D/g, '');
            const isCompanyConfiguredSender = (companySenderName && (u.full_name?.toLowerCase() === companySenderName || u.name?.toLowerCase() === companySenderName)) || (companySenderNumber && userNumClean && companySenderNumber === userNumClean);

            const wsDisplay = isConnected
                ? `<div class="flex flex-col gap-1">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-250/30">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Conectado
                        </span>
                        ${isCompanyConfiguredSender ? `
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800" title="Usuário cadastrado como remetente ativo para envio de mensagens na empresa">
                            <svg class="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
                            Remetente Ativo
                        </span>` : ''}
                    </div>
                    <span class="text-xs font-semibold text-slate-900 dark:text-slate-100">${u.whatsapp_name || u.full_name}</span>
                    <span class="text-[11px] text-gray-500 dark:text-gray-400 font-mono">${u.whatsapp_number || u.phone || 'Sem número'}</span>
                   </div>`
                : `<div class="flex flex-col gap-1">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60">
                            Desconectado
                        </span>
                        ${isCompanyConfiguredSender ? `
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50/80 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40" title="Cadastrado na empresa como remetente de envio, mas WhatsApp está desconectado">
                            Remetente Cadastrado
                        </span>` : ''}
                    </div>
                    ${u.phone ? `<span class="text-[11px] text-gray-400 dark:text-gray-500 font-mono">${u.phone}</span>` : ''}
                   </div>`;

            return `
                <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <!-- Usuário -->
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-xs">
                                ${initials}
                            </div>
                            <div>
                                <div class="font-semibold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
                                    <span>${u.full_name}</span>
                                    <span class="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 capitalize">
                                        ${u.role === 'admin' ? 'Admin' : u.role === 'super_admin' ? 'Super Admin' : u.role}
                                    </span>
                                </div>
                                <div class="text-xs text-gray-500 dark:text-gray-400">${u.email}</div>
                            </div>
                        </div>
                    </td>

                    <!-- WhatsApp Conectado -->
                    <td class="px-6 py-4 whitespace-nowrap">
                        ${wsDisplay}
                    </td>

                    <!-- 1. Auto-Resposta -->
                    <td class="px-6 py-4 whitespace-nowrap text-center">
                        ${
                            autoReplyMode === 'automatic'
                                ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400 border border-green-200/40 dark:border-green-900/30">
                                    <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span> Bot Ativo
                                   </span>`
                                : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                                    <span class="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600"></span> Apenas Manual
                                   </span>`
                        }
                    </td>

                    <!-- 2. Disparo Manual -->
                    <td class="px-6 py-4 whitespace-nowrap text-center">
                        ${
                            enableManualBilling
                                ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400 border border-green-200/40 dark:border-green-900/30">
                                    <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span> Permitido
                                   </span>`
                                : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200/40 dark:border-red-900/30">
                                    <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> Bloqueado
                                   </span>`
                        }
                    </td>

                    <!-- 3. Auto-Envio Boleto -->
                    <td class="px-6 py-4 whitespace-nowrap text-center">
                        ${
                            autoSendBoleto
                                ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400 border border-green-200/40 dark:border-green-900/30">
                                    <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span> Ativo (30s)
                                   </span>`
                                : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                                    <span class="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600"></span> Inativo
                                   </span>`
                        }
                    </td>

                    <!-- Ações -->
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button type="button" data-user-id="${u.public_id}"
                            class="config-user-btn inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition-all cursor-pointer">
                            Configurar
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    const companyWhatsappDispatchForm = getById('companyWhatsappDispatchForm') as HTMLFormElement | null;
    const companyAllowAllUsersActiveSender = getById('companyAllowAllUsersActiveSender') as HTMLSelectElement | null;
    const companyBoletoSenderUserSelect = getById('companyBoletoSenderUserSelect') as HTMLSelectElement | null;
    const btnSaveCompanyWhatsappConfig = getById('btnSaveCompanyWhatsappConfig') as HTMLButtonElement | null;
    const saveCompanySpinner = getById('saveCompanySpinner');

    function updateActiveSenderCard() {
        const senderUserNameEl = getById('senderUserName');
        const senderUserStatusEl = getById('senderUserStatus');
        if (!senderUserNameEl || !senderUserStatusEl) return;

        const allowAll = currentCompany?.whatsapp_allow_all_users_active_sender !== undefined 
            ? Number(currentCompany.whatsapp_allow_all_users_active_sender) !== 0 
            : true;

        if (companyAllowAllUsersActiveSender) {
            companyAllowAllUsersActiveSender.value = allowAll ? '1' : '0';
        }

        const senderName = String(currentCompany?.boleto_send_whatsapp_name || '').trim();
        const senderNumber = String(currentCompany?.boleto_send_whatsapp_number || '').trim();

        // Popular o select de remetente principal
        if (companyBoletoSenderUserSelect) {
            let optionsHtml = '<option value="">Qualquer sessão ativa / Automático (Recomendado)</option>';
            usersList.forEach(u => {
                const isConn = u.whatsapp_status === 'authenticated' || u.whatsapp_status === 'ready';
                const statusBadge = isConn ? '🟢 Conectado' : '🔴 Desconectado';
                const isSelected = senderName && (u.full_name?.toLowerCase() === senderName.toLowerCase() || u.name?.toLowerCase() === senderName.toLowerCase());
                optionsHtml += `<option value="${u.public_id}" ${isSelected ? 'selected' : ''}>${u.full_name} (${statusBadge})</option>`;
            });
            companyBoletoSenderUserSelect.innerHTML = optionsHtml;
        }

        // Determinar status de conexão do remetente
        const anyConnectedUser = usersList.find(u => u.whatsapp_status === 'authenticated' || u.whatsapp_status === 'ready');
        
        const senderUser = usersList.find(u => 
            (senderName && (u.full_name?.toLowerCase() === senderName.toLowerCase() || u.name?.toLowerCase() === senderName.toLowerCase())) ||
            (senderNumber && u.whatsapp_number && u.whatsapp_number.replace(/\D/g, '') === senderNumber.replace(/\D/g, ''))
        );

        if (senderName) {
            senderUserNameEl.innerHTML = `<span>${senderName}</span> ${senderNumber ? `<span class="text-xs font-mono font-normal text-gray-500 dark:text-gray-400">(${senderNumber})</span>` : ''}`;
        } else if (anyConnectedUser) {
            senderUserNameEl.innerHTML = `<span>Automático (${anyConnectedUser.full_name})</span>`;
        } else {
            senderUserNameEl.textContent = 'Automático (Nenhum WhatsApp conectado no momento)';
        }

        const isConfiguredSenderConnected = senderUser
            ? (senderUser.whatsapp_status === 'authenticated' || senderUser.whatsapp_status === 'ready')
            : false;

        if (isConfiguredSenderConnected) {
            senderUserStatusEl.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/40';
            senderUserStatusEl.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> WhatsApp Conectado & Ativo';
        } else if (anyConnectedUser && allowAll) {
            senderUserStatusEl.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/40';
            senderUserStatusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Compartilhado (${anyConnectedUser.full_name})`;
        } else {
            senderUserStatusEl.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/40';
            senderUserStatusEl.innerHTML = '⚠️ Desconectado (Conecte via QR Code)';
        }
    }

    async function saveCompanyWhatsappConfig(e: Event) {
        e.preventDefault();
        if (!currentCompany || !currentCompany.public_id) return;

        if (btnSaveCompanyWhatsappConfig) {
            btnSaveCompanyWhatsappConfig.disabled = true;
        }
        if (saveCompanySpinner) {
            saveCompanySpinner.classList.remove('hidden');
        }

        try {
            const allowAllUsers = companyAllowAllUsersActiveSender?.value === '1';
            const selectedSenderPubId = companyBoletoSenderUserSelect?.value || '';

            let boleto_send_whatsapp_name: string | null = null;
            let boleto_send_whatsapp_number: string | null = null;

            if (selectedSenderPubId) {
                const targetSender = usersList.find(u => u.public_id === selectedSenderPubId);
                if (targetSender) {
                    boleto_send_whatsapp_name = targetSender.full_name || null;
                    boleto_send_whatsapp_number = targetSender.whatsapp_number || targetSender.phone || null;
                }
            }

            const res = await api(`/companies/${currentCompany.public_id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    whatsapp_allow_all_users_active_sender: allowAllUsers ? 1 : 0,
                    boleto_send_whatsapp_name,
                    boleto_send_whatsapp_number
                })
            });

            if (res && res.data) {
                currentCompany = {
                    ...currentCompany,
                    ...res.data,
                    whatsapp_allow_all_users_active_sender: allowAllUsers ? 1 : 0,
                    boleto_send_whatsapp_name,
                    boleto_send_whatsapp_number
                };
            }

            updateActiveSenderCard();
            renderUserGrid();
            showAlert('Configurações gerais de disparo da empresa salvas com sucesso!', 'success');
            setTimeout(hideAlert, 5000);
        } catch (err: any) {
            console.error('[WhatsAppAutomation] Falha ao salvar configurações gerais:', err);
            showAlert(err?.message || 'Erro ao salvar configurações da empresa.', 'error');
        } finally {
            if (btnSaveCompanyWhatsappConfig) {
                btnSaveCompanyWhatsappConfig.disabled = false;
            }
            if (saveCompanySpinner) {
                saveCompanySpinner.classList.add('hidden');
            }
        }
    }

    function openModal(userId: string) {
        const user = usersList.find(u => u.public_id === userId);
        if (!user) return;

        selectedUserId = userId;
        if (modalUsername) {
            modalUsername.textContent = `${user.full_name} (${user.email})`;
        }

        const autoReplyMode = user.whatsapp_auto_reply_mode || 'automatic';
        const enableManualBilling = user.whatsapp_enable_manual_billing !== undefined && user.whatsapp_enable_manual_billing !== null
            ? (user.whatsapp_enable_manual_billing ? '1' : '0')
            : '1';
        const autoSendBoleto = user.whatsapp_auto_send_boleto !== undefined && user.whatsapp_auto_send_boleto !== null
            ? (user.whatsapp_auto_send_boleto ? '1' : '0')
            : '0';

        if (waAutoReplyModeSelect) waAutoReplyModeSelect.value = autoReplyMode;
        if (waEnableManualBillingSelect) waEnableManualBillingSelect.value = enableManualBilling;
        if (waAutoSendBoletoSelect) waAutoSendBoletoSelect.value = autoSendBoleto;

        if (configModal) {
            configModal.classList.remove('hidden');
            configModal.classList.add('flex');
        }
    }

    function closeModal() {
        if (configModal) {
            configModal.classList.remove('flex');
            configModal.classList.add('hidden');
        }
        selectedUserId = '';
    }

    async function loadSettings() {
        try {
            const res = await api('/auth/me');
            if (res && res.data && res.data.user) {
                loggedInUserId = res.data.user.public_id;
                currentCompany = res.data.company || null;
                const role = res.data.user.role;
                const isAdmin = role === 'admin' || role === 'super_admin' || role === 'supervisor';

                usersList = [res.data.user];

                if (isAdmin) {
                    try {
                        const usersRes = await api('/users');
                        if (usersRes && usersRes.data) {
                            usersList = usersRes.data.filter((u: any) => u.is_active);
                        }
                    } catch (err) {
                        console.warn('[WhatsAppAutomation] Falha ao carregar lista de usuários:', err);
                    }
                }

                updateActiveSenderCard();
                renderUserGrid();
            } else {
                throw new Error('Usuário não autenticado.');
            }
        } catch (e: any) {
            console.error('[WhatsAppAutomation] Falha ao carregar configurações:', e);
            showAlert(e?.message || 'Falha ao carregar configurações.', 'error');
        }
    }

    async function saveSettings(e: Event) {
        e.preventDefault();
        if (!selectedUserId) return;

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Salvando...';
        }

        try {
            const whatsapp_auto_reply_mode = waAutoReplyModeSelect?.value || 'automatic';
            const whatsapp_enable_manual_billing = waEnableManualBillingSelect?.value === '1';
            const whatsapp_auto_send_boleto = waAutoSendBoletoSelect?.value === '1';

            const res = await api(`/users/${selectedUserId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    whatsapp_auto_reply_mode,
                    whatsapp_enable_manual_billing,
                    whatsapp_auto_send_boleto
                })
            });

            // Update local usersList memory
            const userIndex = usersList.findIndex(u => u.public_id === selectedUserId);
            if (userIndex !== -1 && res && res.data) {
                usersList[userIndex] = {
                    ...usersList[userIndex],
                    whatsapp_auto_reply_mode: res.data.whatsapp_auto_reply_mode,
                    whatsapp_enable_manual_billing: res.data.whatsapp_enable_manual_billing,
                    whatsapp_auto_send_boleto: res.data.whatsapp_auto_send_boleto
                };
            }

            // Re-render and close modal
            renderUserGrid();
            closeModal();
            showAlert('Configurações de automação atualizadas com sucesso!', 'success');

            // Autohide alert after 5s
            setTimeout(hideAlert, 5000);
        } catch (e: any) {
            console.error('[WhatsAppAutomation] Falha ao salvar:', e);
            showAlert(e?.message || 'Erro ao salvar configurações.', 'error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Salvar Configurações';
            }
        }
    }

    function init() {
        if (form) {
            form.addEventListener('submit', saveSettings);
        }
        if (companyWhatsappDispatchForm) {
            companyWhatsappDispatchForm.addEventListener('submit', saveCompanyWhatsappConfig);
        }

        // Close modal handlers
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
        if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);
        if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);

        // Escape key to close modal
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });

        // Delegate edit button click
        if (usersListTableBody) {
            usersListTableBody.addEventListener('click', (e) => {
                const btn = (e.target as HTMLElement).closest('.config-user-btn');
                if (btn) {
                    const userId = btn.getAttribute('data-user-id');
                    if (userId) openModal(userId);
                }
            });
        }

        loadSettings();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
