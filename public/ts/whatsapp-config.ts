/// <reference path="./globals.d.ts" />

(() => {
    let userId: string = '';
    let waSession: any = { status: 'idle', pairing_code: null, qr_code_data_url: null, last_event_at: null, last_error: null };
    let waPollingInterval: any = null;
    let editingUserWhatsAppAutoReplyMode: 'automatic' | 'manual' = 'automatic';

    const getById = (id: string) => document.getElementById(id);

    function formatConnectedNumber(): string {
        const phone = waSession.connected_phone || '';
        if (!phone) return 'Não conectado';
        return `+${phone}`;
    }

    function resolveConnectedNumber(): string {
        return waSession.connected_phone || '';
    }

    function getWaStatusMeta() {
        const status = waSession.status || 'idle';
        const map: any = {
            'idle':          { badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300', label: 'Desconectado', helper: 'Inicie a sessão para conectar seu WhatsApp.' },
            'disconnected':  { badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300', label: 'Desconectado', helper: 'Inicie a sessão para conectar seu WhatsApp.' },
            'initializing':  { badgeClass: 'bg-blue-100 text-blue-800',           label: 'Iniciando...', helper: 'Aguarde, gerando conexão...' },
            'awaiting_qr':   { badgeClass: 'bg-amber-100 text-amber-800',        label: 'Aguardando Pareamento', helper: waSession.pairing_code ? 'Use o código abaixo no WhatsApp do celular para conectar.' : 'Escaneie o QR code no WhatsApp do celular em Dispositivos conectados.' },
            'ready':         { badgeClass: 'bg-green-100 text-green-800',         label: 'Conectado', helper: 'Sua sessão do WhatsApp Business está ativa e pronta para uso.' },
            'auth_failure':  { badgeClass: 'bg-red-100 text-red-800',            label: 'Falha de Autenticação', helper: 'Falha ao autenticar. Inicie a sessão novamente.' },
            'error':         { badgeClass: 'bg-red-100 text-red-800',            label: 'Erro', helper: waSession.last_error || 'Erro na sessão do WhatsApp.' }
        };
        return map[status] || map.idle;
    }

    function render() {
        const container = getById('whatsappContent');
        if (!container) return;

        const isNewUser = !userId;
        const statusMeta  = getWaStatusMeta();
        const hasQr       = !isNewUser && !!waSession.qr_code_data_url;
        const hasPairingCode = !isNewUser && !!waSession.pairing_code;
        const isBusy      = !isNewUser && waSession.status === 'initializing';
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
                                    <p class="font-medium">Pareamento indisponível</p>
                                    <p class="mt-1 text-xs opacity-90">Por favor, faça login para configurar o pareamento.</p>
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
                                        <button type="button" id="btnPairWa" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors" ${isBusy ? 'disabled' : ''}>Gerar código</button>
                                    </div>
                                    ${waSession.last_error ? `<div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${waSession.last_error}</div>` : ''}
                                </div>
                                <div class="bg-white dark:bg-slate-800 p-3 rounded-xl border border-dashed dark:border-slate-700 flex flex-col items-center justify-center gap-2 min-h-56">
                                    ${hasPairingCode ? `
                                        <div class="w-full rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-4 text-center">
                                            <div class="text-xs uppercase tracking-wide text-indigo-600">Código de pareamento</div>
                                            <div class="mt-2 text-3xl font-bold tracking-widest text-indigo-700">${waSession.pairing_code}</div>
                                        </div>
                                        <p class="text-xs text-center text-gray-500 dark:text-gray-400">No celular: WhatsApp > Dispositivos conectados > Conectar com número de telefone.</p>
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

        const whatsappModeSelect = getById('formWhatsAppAutoReplyMode') as HTMLSelectElement | null;
        if (whatsappModeSelect) {
            whatsappModeSelect.value = editingUserWhatsAppAutoReplyMode;
            whatsappModeSelect.addEventListener('change', () => {
                const targetMode = whatsappModeSelect.value === 'manual' ? 'manual' : 'automatic';
                editingUserWhatsAppAutoReplyMode = targetMode;
                void updateAutoReplyMode(targetMode);
            });
        }

        getById('btnStartWa')?.addEventListener('click', () => {
            void startWaSession();
        });
        getById('btnPairWa')?.addEventListener('click', () => {
            void requestWaPairingCode();
        });
        getById('btnDisconnectWa')?.addEventListener('click', () => {
            void disconnectWaSession();
        });
    }

    async function updateAutoReplyMode(mode: 'automatic' | 'manual') {
        try {
            await api(`/users/${userId}`, {
                method: 'PATCH',
                body: JSON.stringify({ whatsapp_auto_reply_mode: mode })
            });
        } catch (e: any) {
            console.error('[WhatsAppConfig] Erro ao atualizar modo:', e);
            if (typeof UI !== 'undefined' && UI.showAlert) {
                UI.showAlert('alertMessage', e?.message || 'Falha ao atualizar modo de atendimento.', 'error');
            } else {
                alert(e?.message || 'Falha ao atualizar modo de atendimento.');
            }
        }
    }

    async function startWaSession() {
        if (!userId) return;
        try {
            waSession.status = 'initializing';
            waSession.qr_code_data_url = null;
            waSession.pairing_code = null;
            render();

            await api(`/users/${userId}/whatsapp-business/session`, { method: 'POST' });
            scheduleWaPolling(1000);
        } catch (e: any) {
            waSession.status = 'error';
            waSession.last_error = e?.message || 'Erro ao iniciar sessão.';
            render();
        }
    }

    async function disconnectWaSession() {
        if (!userId) return;
        try {
            await api(`/users/${userId}/whatsapp-business/session`, { method: 'DELETE' });
            waSession = { status: 'disconnected', pairing_code: null, qr_code_data_url: null, last_event_at: null, last_error: null };
            render();
        } catch (e: any) {
            if (typeof UI !== 'undefined' && UI.showAlert) {
                UI.showAlert('alertMessage', e?.message || 'Erro ao desconectar.', 'error');
            } else {
                alert(e?.message || 'Erro ao desconectar.');
            }
        }
    }

    async function requestWaPairingCode() {
        if (!userId) return;
        const phoneInput = getById('waPairPhone') as HTMLInputElement | null;
        const phone = phoneInput?.value?.replace(/\D/g, '') || '';
        if (!phone) {
            if (typeof UI !== 'undefined' && UI.showAlert) {
                UI.showAlert('alertMessage', 'Informe o número de telefone completo com DDI (Ex: 55...)', 'error');
            } else {
                alert('Informe o número de telefone completo com DDI (Ex: 55...)');
            }
            return;
        }

        try {
            waSession.status = 'initializing';
            render();

            await api(`/users/${userId}/whatsapp-business/session/pairing-code`, {
                method: 'POST',
                body: JSON.stringify({ phone }),
            });
            scheduleWaPolling(1500);
        } catch (e: any) {
            waSession.status = 'error';
            waSession.last_error = e?.message || 'Erro ao solicitar código.';
            render();
        }
    }

    function scheduleWaPolling(delay = 3000) {
        if (waPollingInterval) window.clearTimeout(waPollingInterval);
        waPollingInterval = window.setTimeout(async () => {
            if (!userId) return;
            try {
                const res = await api(`/users/${userId}/whatsapp-business/session`);
                const session = res.data || res;
                waSession = session;
                render();

                if (session.status === 'initializing' || session.status === 'awaiting_qr') {
                    scheduleWaPolling(3000);
                }
            } catch (e) {
                console.warn(e);
            }
        }, delay);
    }

    async function loadWaSession({ autoStart = false } = {}) {
        if (!userId) return;

        try {
            const res = await api(`/users/${userId}/whatsapp-business/session`);
            waSession = res.data || res;
            render();

            if (autoStart && (waSession.status === 'idle' || waSession.status === 'disconnected' || waSession.status === 'auth_failure' || waSession.status === 'error')) {
                await startWaSession();
                return;
            }

            if (waSession.status === 'initializing' || waSession.status === 'awaiting_qr') {
                scheduleWaPolling(3000);
            }
        } catch (e: any) {
            console.warn(e);
            waSession = {
                ...waSession,
                status: 'error',
                last_error: e?.message || 'Falha ao carregar sessão do WhatsApp Business.',
                qr_code_data_url: null,
                has_qr_code: false,
            };
            render();
        }
    }

    async function init() {
        try {
            const res = await api('/auth/me');
            if (res && res.data && res.data.user) {
                userId = res.data.user.public_id;
                editingUserWhatsAppAutoReplyMode = res.data.user.whatsapp_auto_reply_mode || 'automatic';
            }
            if (!userId) {
                throw new Error('Usuário não autenticado');
            }
            await loadWaSession();
        } catch (e: any) {
            console.error('[WhatsAppConfig] Falha na inicialização:', e);
            const container = getById('whatsappContent');
            if (container) {
                container.innerHTML = `<div class="text-sm text-red-500">Falha ao iniciar página: ${e?.message || 'Faça login novamente'}</div>`;
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
