(() => {
    type Direction = 'inbound' | 'outbound';

    interface WhatsAppInfoSummary {
        total_messages: number;
        inbound_messages: number;
        outbound_messages: number;
        conversations_count: number;
        media_messages: number;
        messages_today: number;
        messages_last_7_days: number;
        phone_aliases_count: number;
        first_message_at: string | null;
        last_message_at: string | null;
    }

    interface WhatsAppInfoSession {
        status: string | null;
        persisted_session: boolean;
        connected_number: string | null;
        connected_name: string | null;
        platform: string | null;
        last_event_at: string | null;
        last_error: string | null;
        updated_at: string | null;
    }

    interface WhatsAppInfoConversation {
        contact_phone: string;
        contact_name: string | null;
        last_message_text: string;
        last_direction: Direction;
        last_message_type: string | null;
        last_message_timestamp: number | null;
        last_message_created_at: string | null;
        messages_count: number;
    }

    interface WhatsAppInfoRecentMessage {
        public_id: string;
        direction: Direction;
        contact_phone: string;
        contact_name: string | null;
        message_type: string | null;
        message_text: string;
        status: string | null;
        message_at: string | null;
    }

    interface WhatsAppInfoAnalytics {
        scope: {
            companyId: number;
            ownerType: 'company' | 'user';
            ownerId: number;
            userId?: number | null;
        };
        session: WhatsAppInfoSession | null;
        summary: WhatsAppInfoSummary;
        directions: Array<{ direction: Direction; total: number }>;
        message_types: Array<{ message_type: string; total: number }>;
        recent_conversations: WhatsAppInfoConversation[];
        recent_messages: WhatsAppInfoRecentMessage[];
    }

    const getById = (id: string): HTMLElement | null => document.getElementById(id);

    function escapeHtml(value: unknown): string {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatNumber(value: unknown): string {
        const numeric = Number(value || 0);
        return new Intl.NumberFormat('pt-BR').format(Number.isFinite(numeric) ? numeric : 0);
    }

    function formatDateTime(value: unknown): string {
        if (!value) return '-';
        const formatter = window.DateUtils?.formatDateTime;
        if (typeof formatter === 'function') {
            const formatted = formatter(value);
            return formatted || '-';
        }

        const date = new Date(String(value));
        if (Number.isNaN(date.getTime())) return '-';
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    }

    function formatPhone(value: unknown): string {
        const digits = String(value || '').replace(/\D/g, '');
        if (!digits) return '-';
        if (digits.length === 13 && digits.startsWith('55')) {
            return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
        }
        if (digits.length === 12 && digits.startsWith('55')) {
            return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
        }
        return `+${digits}`;
    }

    function truncate(value: unknown, maxLength = 90): string {
        const text = String(value || '').trim();
        if (!text) return '-';
        return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
    }

    function directionLabel(direction: string | null | undefined): string {
        return direction === 'outbound' ? 'Enviada' : 'Recebida';
    }

    function directionClass(direction: string | null | undefined): string {
        return direction === 'outbound'
            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800';
    }

    function statusLabel(status: string | null | undefined): string {
        const labels: Record<string, string> = {
            idle: 'Ociosa',
            initializing: 'Inicializando',
            awaiting_qr: 'Aguardando QR',
            authenticated: 'Autenticada',
            ready: 'Conectada',
            auth_failure: 'Falha de autenticação',
            disconnected: 'Desconectada',
            error: 'Erro',
        };
        return labels[String(status || '')] || String(status || 'Sem sessão');
    }

    function statusClass(status: string | null | undefined): string {
        if (status === 'ready' || status === 'authenticated') {
            return 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800';
        }
        if (status === 'error' || status === 'auth_failure' || status === 'disconnected') {
            return 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800';
        }
        return 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800';
    }

    function showAlert(message: string, type: 'error' | 'success' = 'error'): void {
        const alert = getById('waInfoAlert');
        if (!alert) return;
        alert.className = `mx-4 sm:mx-0 mb-4 rounded-lg px-3 py-2 text-sm ${type === 'error'
            ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'}`;
        alert.textContent = message;
    }

    function renderStatCard(title: string, value: unknown, detail: string, tone: string): string {
        const tones: Record<string, string> = {
            emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
            blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
            amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
            slate: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-700',
        };
        return `
            <section class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <p class="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">${escapeHtml(title)}</p>
                        <p class="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">${formatNumber(value)}</p>
                    </div>
                    <span class="inline-flex h-10 w-10 items-center justify-center rounded-lg border ${tones[tone] || tones.slate}"></span>
                </div>
                <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">${escapeHtml(detail)}</p>
            </section>`;
    }

    function renderStats(summary: WhatsAppInfoSummary): void {
        const grid = getById('waInfoStatsGrid');
        if (!grid) return;
        grid.innerHTML = [
            renderStatCard('Mensagens', summary.total_messages, 'Total salvo em whatsapp_business_messages', 'emerald'),
            renderStatCard('Conversas', summary.conversations_count, 'Contatos distintos no histórico', 'blue'),
            renderStatCard('Hoje', summary.messages_today, 'Mensagens registradas na data atual', 'amber'),
            renderStatCard('Mídias', summary.media_messages, 'Registros com arquivo ou tipo de mídia', 'slate'),
            renderStatCard('Recebidas', summary.inbound_messages, 'Mensagens inbound', 'emerald'),
            renderStatCard('Enviadas', summary.outbound_messages, 'Mensagens outbound', 'blue'),
            renderStatCard('Últimos 7 dias', summary.messages_last_7_days, 'Volume recente de atendimento', 'amber'),
            renderStatCard('Aliases', summary.phone_aliases_count, 'Registros em whatsapp_business_phone_aliases', 'slate'),
        ].join('');
    }

    function renderSession(analytics: WhatsAppInfoAnalytics): void {
        const badge = getById('waInfoSessionBadge');
        const details = getById('waInfoSessionDetails');
        const session = analytics.session;
        if (badge) {
            badge.className = `inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(session?.status)}`;
            badge.textContent = statusLabel(session?.status);
        }
        if (!details) return;
        details.innerHTML = `
            <div class="flex justify-between gap-3"><dt class="text-gray-500 dark:text-gray-400">Escopo</dt><dd class="font-medium text-gray-900 dark:text-gray-100">${analytics.scope.ownerType === 'user' ? 'Usuário' : 'Empresa'}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-gray-500 dark:text-gray-400">Sessão persistida</dt><dd class="font-medium text-gray-900 dark:text-gray-100">${session?.persisted_session ? 'Sim' : 'Não'}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-gray-500 dark:text-gray-400">Número</dt><dd class="font-medium text-gray-900 dark:text-gray-100 text-right">${escapeHtml(formatPhone(session?.connected_number))}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-gray-500 dark:text-gray-400">Nome</dt><dd class="font-medium text-gray-900 dark:text-gray-100 text-right">${escapeHtml(session?.connected_name || '-')}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-gray-500 dark:text-gray-400">Plataforma</dt><dd class="font-medium text-gray-900 dark:text-gray-100 text-right">${escapeHtml(session?.platform || '-')}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-gray-500 dark:text-gray-400">Último evento</dt><dd class="font-medium text-gray-900 dark:text-gray-100 text-right">${escapeHtml(formatDateTime(session?.last_event_at || session?.updated_at))}</dd></div>
            ${session?.last_error ? `<div class="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-xs text-red-700 dark:text-red-300">${escapeHtml(session.last_error)}</div>` : ''}
        `;
    }

    function renderMessageTypes(analytics: WhatsAppInfoAnalytics): void {
        const container = getById('waInfoMessageTypes');
        if (!container) return;
        const total = Math.max(Number(analytics.summary.total_messages || 0), 1);
        if (!analytics.message_types.length) {
            container.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Nenhuma mensagem registrada.</p>';
            return;
        }
        container.innerHTML = analytics.message_types.map((item) => {
            const percent = Math.round((Number(item.total || 0) / total) * 100);
            return `
                <div>
                    <div class="flex items-center justify-between gap-3 text-sm mb-1">
                        <span class="font-medium text-gray-800 dark:text-gray-100">${escapeHtml(item.message_type || 'chat')}</span>
                        <span class="text-gray-500 dark:text-gray-400">${formatNumber(item.total)} (${percent}%)</span>
                    </div>
                    <div class="h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
                        <div class="h-full rounded-full bg-emerald-500" style="width: ${percent}%"></div>
                    </div>
                </div>`;
        }).join('');
    }

    function renderConversations(analytics: WhatsAppInfoAnalytics): void {
        const container = getById('waInfoRecentConversations');
        if (!container) return;
        if (!analytics.recent_conversations.length) {
            container.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Nenhuma conversa registrada.</p>';
            return;
        }
        container.innerHTML = analytics.recent_conversations.map((item) => `
            <div class="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/60 p-3">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <p class="font-semibold text-gray-900 dark:text-gray-100 truncate">${escapeHtml(item.contact_name || formatPhone(item.contact_phone))}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(formatPhone(item.contact_phone))}</p>
                    </div>
                    <span class="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${directionClass(item.last_direction)}">${directionLabel(item.last_direction)}</span>
                </div>
                <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">${escapeHtml(truncate(item.last_message_text))}</p>
                <div class="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>${formatNumber(item.messages_count)} mensagens</span>
                    <span>${escapeHtml(formatDateTime(item.last_message_timestamp || item.last_message_created_at))}</span>
                </div>
            </div>`).join('');
    }

    function renderRecentMessages(analytics: WhatsAppInfoAnalytics): void {
        const container = getById('waInfoRecentMessages');
        if (!container) return;
        if (!analytics.recent_messages.length) {
            container.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Nenhuma mensagem registrada.</p>';
            return;
        }
        container.innerHTML = analytics.recent_messages.map((item) => `
            <div class="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/60 p-3">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <p class="font-semibold text-gray-900 dark:text-gray-100 truncate">${escapeHtml(item.contact_name || formatPhone(item.contact_phone))}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(formatDateTime(item.message_at))}</p>
                    </div>
                    <span class="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${directionClass(item.direction)}">${directionLabel(item.direction)}</span>
                </div>
                <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">${escapeHtml(truncate(item.message_text, 120))}</p>
                <div class="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>${escapeHtml(item.message_type || 'chat')}</span>
                    <span>${escapeHtml(item.status || '-')}</span>
                </div>
            </div>`).join('');
    }

    function renderDashboard(analytics: WhatsAppInfoAnalytics): void {
        renderStats(analytics.summary);
        renderSession(analytics);
        renderMessageTypes(analytics);
        renderConversations(analytics);
        renderRecentMessages(analytics);
    }

    async function init(): Promise<void> {
        const loading = getById('waInfoLoading');
        const dashboard = getById('waInfoDashboard');
        try {
            const authResponse = await api('/auth/me');
            const userId = authResponse?.data?.user?.public_id || authResponse?.data?.user?.id;
            if (!userId) {
                throw new Error('Usuário não identificado. Faça login novamente.');
            }

            const response = await api(`/users/${userId}/whatsapp-business/analytics`);
            renderDashboard(response?.data as WhatsAppInfoAnalytics);
            if (loading) loading.classList.add('hidden');
            if (dashboard) dashboard.classList.remove('hidden');
        } catch (error: any) {
            if (loading) loading.classList.add('hidden');
            showAlert(error?.message || 'Falha ao carregar o dashboard do WhatsApp.');
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        init().catch((error) => {
            console.error('[WhatsAppInfo] Falha ao iniciar dashboard', error);
            showAlert('Falha ao carregar o dashboard do WhatsApp.');
        });
    });
})();
