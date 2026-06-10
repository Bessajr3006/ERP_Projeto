(() => {
    const getById = (id: string): any => document.getElementById(id);
    const qs = (selector: string): any => document.querySelector(selector);
    const qsa = (selector: string): any => document.querySelectorAll(selector);

/**
 * whatsapp.js
 * Chat sincronizado com WhatsApp Business - KEYSTONE ERP
 */

document.addEventListener('DOMContentLoaded', async () => {
    const runtimeWindow = window as any;
    if (runtimeWindow.__whatsappPageInitialized) {
        return;
    }
    runtimeWindow.__whatsappPageInitialized = true;

    let userId: any = null;
    let currentPhone: any = null;
    let currentPhoneAliases: string[] = [];
    let currentPreferredChatId: string | null = null;
    let currentName: any = null;
    let allConversations: any[] = [];
    let allCustomerContacts: any[] = [];
    let registeredContactRolesByPhone: Map<string, Set<string>> = new Map();
    let lastMessageIds: Set<any> = new Set();
    let convPollTimer: any = null;
    let msgPollTimer: any = null;
    let convPollInFlight = false;
    let msgPollInFlight = false;
    let lastSessionPollAt = 0;
    let lastUserActivityAt = Date.now();
    let activeConversationsPollMs = 8000;
    let activeMessagesPollMs = 5000;
    let sending = false;
    let loadingCustomers = false;
    let deletingConversation = false;
    let eventsBound = false;
    let searchTerm = '';
    let currentSessionStatus: any = 'idle';
    let pendingAttachment: { fileName: string; mimeType: string; base64: string; } | null = null;

    // --- Elementos ---
    const convList     = getById('waConvList');
    const chatEmpty    = getById('waChatEmpty');
    const chatActive   = getById('waChatActive');
    const chatName     = getById('waChatName');
    const chatPhone    = getById('waChatPhone');
    const chatAvatar   = getById('waChatAvatar');
    const messagesArea = getById('waMessagesArea');
    const messageInput = getById('waMessageInput');
    const sendBtn      = getById('waSendBtn');
    const attachmentInput = getById('waAttachmentInput');
    const attachmentBtn = getById('waAttachmentBtn');
    const attachmentInfo = getById('waAttachmentInfo');
    const attachmentName = getById('waAttachmentName');
    const attachmentClearBtn = getById('waAttachmentClearBtn');
    const statusBadge  = getById('waStatusBadge');
    const connectBtn   = getById('waConnectBtn');
    const disconnectBtn = getById('waDisconnectBtn');
    const searchInput  = getById('waSearchInput');
    const loadCustomersBtn = getById('waLoadCustomersBtn');
    const btnBack      = getById('waBtnBack');
    const deleteContactBtn = getById('waDeleteContactBtn');
    const sidebar      = getById('waSidebar');
    const chatPanel    = getById('waChatPanel');
    const SESSION_POLL_MS = 24000;
    const FAST_ACTIVITY_WINDOW_MS = 20000;
    const IDLE_ACTIVITY_WINDOW_MS = 60000;
    const CONVERSATIONS_POLL_FAST_MS = 6000;
    const CONVERSATIONS_POLL_NORMAL_MS = 10000;
    const CONVERSATIONS_POLL_IDLE_MS = 15000;
    const MESSAGES_POLL_FAST_MS = 3000;
    const MESSAGES_POLL_NORMAL_MS = 5000;
    const MESSAGES_POLL_IDLE_MS = 12000;
    const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

    function isChatVisible(): boolean {
        if (!chatActive) return false;
        return !chatActive.classList.contains('hidden') && chatActive.offsetParent !== null;
    }

    function getActivityAgeMs(): number {
        return Date.now() - lastUserActivityAt;
    }

    function computeConversationsPollMs(): number {
        const activityAge = getActivityAgeMs();

        if (activityAge <= FAST_ACTIVITY_WINDOW_MS) {
            return CONVERSATIONS_POLL_FAST_MS;
        }

        if (activityAge <= IDLE_ACTIVITY_WINDOW_MS) {
            return CONVERSATIONS_POLL_NORMAL_MS;
        }

        return CONVERSATIONS_POLL_IDLE_MS;
    }

    function computeMessagesPollMs(): number {
        const activityAge = getActivityAgeMs();

        if (!isChatVisible()) {
            return MESSAGES_POLL_IDLE_MS;
        }

        if (activityAge <= FAST_ACTIVITY_WINDOW_MS) {
            return MESSAGES_POLL_FAST_MS;
        }

        if (activityAge <= IDLE_ACTIVITY_WINDOW_MS) {
            return MESSAGES_POLL_NORMAL_MS;
        }

        return MESSAGES_POLL_IDLE_MS;
    }

    function markUserActivity(): void {
        lastUserActivityAt = Date.now();
        refreshAdaptivePolling();
    }

    function refreshAdaptivePolling(): void {
        const nextConversationsPollMs = computeConversationsPollMs();
        if (nextConversationsPollMs !== activeConversationsPollMs) {
            activeConversationsPollMs = nextConversationsPollMs;
            if (!document.hidden) {
                startPolling();
            }
        }

        const nextMessagesPollMs = computeMessagesPollMs();
        if (nextMessagesPollMs !== activeMessagesPollMs) {
            activeMessagesPollMs = nextMessagesPollMs;
            if (!document.hidden && currentPhone) {
                startMsgPolling();
            }
        }
    }

    function setSessionButtonsState(isLoading = false): void {
        const isReady = currentSessionStatus === 'ready';

        if (connectBtn) {
            connectBtn.classList.toggle('hidden', isReady);
            connectBtn.disabled = isLoading;
        }

        if (disconnectBtn) {
            disconnectBtn.classList.toggle('hidden', !isReady);
            disconnectBtn.classList.toggle('inline-flex', isReady);
            disconnectBtn.disabled = isLoading;
        }
    }

    function canAutofocus(): boolean {
        try {
            return window.self === window.top;
        } catch (_error) {
            return false;
        }
    }

    function focusMessageInputSafely(): void {
        if (!messageInput || !canAutofocus()) return;

        window.requestAnimationFrame(() => {
            try {
                messageInput.focus({ preventScroll: true });
            } catch (_error) {
                try {
                    messageInput.focus();
                } catch (_focusError) {
                    // Ignore focus failures in embedded or cross-origin contexts.
                }
            }
        });
    }

    // --- Helpers ---
    function avatarInitials(name: string | null | undefined) {
        const clean = String(name || '').trim();
        if (!clean) return '?';
        const parts = clean.split(' ').filter(Boolean);
        if (parts.length === 1) return parts[0][0].toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    function avatarColor(str: string) {
        const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];
        let hash = 0;
        for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    }

    function formatTime(ts: any, createdAt: any) {
        let date;
        if (ts) {
            date = new Date(Number(ts) * 1000);
        } else if (createdAt) {
            date = new Date(createdAt);
        } else {
            return '';
        }
        if (isNaN(date.getTime())) return '';
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        if (isToday) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
               date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    const registerEntityOptions = [
        { key: 'customer', label: 'Cliente', page: '/pages/customers.html' },
        { key: 'supplier', label: 'Fornecedor', page: '/pages/suppliers.html' },
        { key: 'seller', label: 'Vendedor', page: '/pages/sellers.html' },
        { key: 'buyer', label: 'Comprador', page: '/pages/buyers.html' },
        { key: 'service_provider', label: 'Prestador de Servico', page: '/pages/service_providers.html' },
        { key: 'accountant', label: 'Contador', page: '/pages/accountant.html' },
    ];

    const registerEntityLabelByKey = new Map<string, string>(
        registerEntityOptions.map((option) => [option.key, option.label])
    );

    let registerTypeMenuEl: HTMLElement | null = null;
    let registerTypeMenuCloseHandler: ((event: MouseEvent) => void) | null = null;

    function closeRegisterTypeMenu() {
        if (registerTypeMenuEl) {
            registerTypeMenuEl.remove();
            registerTypeMenuEl = null;
        }

        if (registerTypeMenuCloseHandler) {
            document.removeEventListener('click', registerTypeMenuCloseHandler, true);
            registerTypeMenuCloseHandler = null;
        }
    }

    function redirectToEntityRegistration(entityKey: string, page: string, contactName: string, contactPhone: string) {
        const params = new URLSearchParams();
        params.set('prefill', entityKey);

        const normalizedName = String(contactName || '').trim();
        if (normalizedName) params.set('name', normalizedName);

        const normalizedPhone = normalizePhone(contactPhone);
        if (normalizedPhone) params.set('phone', normalizedPhone);

        window.location.href = `${page}?${params.toString()}`;
    }

    function showRegisterTypeMenu(trigger: HTMLElement, contactName: string, contactPhone: string) {
        closeRegisterTypeMenu();

        const menu = document.createElement('div');
        menu.className = 'wa-register-type-menu';

        const title = document.createElement('div');
        title.className = 'wa-register-type-menu-title';
        title.textContent = 'Cadastrar como';
        menu.appendChild(title);

        registerEntityOptions.forEach((option) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'wa-register-type-menu-item';
            btn.textContent = option.label;
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                closeRegisterTypeMenu();
                redirectToEntityRegistration(option.key, option.page, contactName, contactPhone);
            });
            menu.appendChild(btn);
        });

        document.body.appendChild(menu);
        registerTypeMenuEl = menu;

        const triggerRect = trigger.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();

        const preferredLeft = window.scrollX + triggerRect.left;
        const maxLeft = window.scrollX + window.innerWidth - menuRect.width - 8;
        const left = Math.max(window.scrollX + 8, Math.min(preferredLeft, maxLeft));

        let top = window.scrollY + triggerRect.bottom + 6;
        const maxTop = window.scrollY + window.innerHeight - menuRect.height - 8;
        if (top > maxTop) {
            top = window.scrollY + triggerRect.top - menuRect.height - 6;
        }

        menu.style.left = `${left}px`;
        menu.style.top = `${Math.max(window.scrollY + 8, top)}px`;

        registerTypeMenuCloseHandler = (event: MouseEvent) => {
            const target = event.target as Node;
            if (!menu.contains(target) && !trigger.contains(target)) {
                closeRegisterTypeMenu();
            }
        };

        document.addEventListener('click', registerTypeMenuCloseHandler, true);
    }

    function escapeHtml(str: string | null | undefined) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isSupportedAttachment(file: File): boolean {
        const mimeType = String(file?.type || '').toLowerCase();
        return mimeType.startsWith('image/') || mimeType === 'application/pdf';
    }

    function formatBytes(value: number): string {
        if (!Number.isFinite(value) || value <= 0) return '0 B';
        if (value < 1024) return `${value} B`;
        const kb = value / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB`;
        const mb = kb / 1024;
        return `${mb.toFixed(1)} MB`;
    }

    function readFileAsBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = String(reader.result || '');
                const commaIndex = result.indexOf(',');
                if (commaIndex < 0) {
                    reject(new Error('Falha ao processar arquivo selecionado.'));
                    return;
                }
                resolve(result.slice(commaIndex + 1));
            };
            reader.onerror = () => reject(new Error('Nao foi possivel ler o arquivo selecionado.'));
            reader.readAsDataURL(file);
        });
    }

    function updateAttachmentInfo() {
        if (!attachmentInfo || !attachmentName) return;

        if (!pendingAttachment) {
            attachmentInfo.classList.add('hidden');
            attachmentName.textContent = '';
            return;
        }

        attachmentName.textContent = pendingAttachment.fileName;
        attachmentInfo.classList.remove('hidden');
    }

    function clearAttachment() {
        pendingAttachment = null;
        if (attachmentInput) {
            attachmentInput.value = '';
        }
        updateAttachmentInfo();
    }

    function shouldRenderMessageText(message: any): boolean {
        const text = String(message?.message_text || '').trim();
        if (!text) return false;

        if (String(message?.message_type || '').trim().toLowerCase() === 'location') {
            return false;
        }

        const hasMedia = !!String(message?.media_url || '').trim();
        if (!hasMedia) return true;

        const mediaPlaceholders = new Set(['[Imagem]', '[Documento]', '[Video]', '[Audio]', '[Sticker]', '[mensagem]']);
        return !mediaPlaceholders.has(text);
    }

    function parseLocationCoordinate(value: any, min: number, max: number): number | null {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return null;
        if (parsed < min || parsed > max) return null;
        return parsed;
    }

    function parseLocationFromText(messageText: string): { latitude: number | null; longitude: number | null; mapUrl: string | null; details: string[]; } {
        const lines = String(messageText || '')
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => !!line);

        const details = lines.filter((line) => !/^\[localizacao/i.test(line));
        const coordsLine = details.find((line) => /^lat:\s*/i.test(line)) || '';
        const coordsMatch = coordsLine.match(/lat:\s*(-?\d{1,3}(?:\.\d+)?)\s*\|\s*lng:\s*(-?\d{1,3}(?:\.\d+)?)/i);

        let latitude = coordsMatch ? parseLocationCoordinate(coordsMatch[1], -90, 90) : null;
        let longitude = coordsMatch ? parseLocationCoordinate(coordsMatch[2], -180, 180) : null;

        if (latitude === null || longitude === null) {
            const fallbackPair = String(messageText || '').match(/(-?\d{1,3}\.\d+)\s*[,;]\s*(-?\d{1,3}\.\d+)/);
            if (fallbackPair) {
                latitude = parseLocationCoordinate(fallbackPair[1], -90, 90);
                longitude = parseLocationCoordinate(fallbackPair[2], -180, 180);
            }
        }

        const mapUrlMatch = String(messageText || '').match(/https?:\/\/\S+/i);
        const mapUrl = mapUrlMatch?.[0] || null;

        return {
            latitude,
            longitude,
            mapUrl,
            details,
        };
    }

    function buildLocationHtml(message: any): string {
        const messageType = String(message?.message_type || '').trim().toLowerCase();
        if (messageType !== 'location') return '';

        const parsedText = parseLocationFromText(String(message?.message_text || ''));
        const details = parsedText.details.filter((line) => !/^lat:\s*/i.test(line) && !/^https?:\/\//i.test(line));
        const title = details[0] || 'Localizacao compartilhada';
        const subtitle = details[1] || '';

        const mapUrl = parsedText.mapUrl
            || (parsedText.latitude !== null && parsedText.longitude !== null
                ? `https://maps.google.com/?q=${parsedText.latitude},${parsedText.longitude}`
                : null);

        const coordsLabel = parsedText.latitude !== null && parsedText.longitude !== null
            ? `Lat: ${parsedText.latitude.toFixed(6)} | Lng: ${parsedText.longitude.toFixed(6)}`
            : '';

        return `<div class="wa-location-card">
            <div class="wa-location-title">${escapeHtml(title)}</div>
            ${subtitle ? `<div class="wa-location-subtitle">${escapeHtml(subtitle)}</div>` : ''}
            ${coordsLabel ? `<div class="wa-location-coords">${escapeHtml(coordsLabel)}</div>` : ''}
            ${mapUrl ? `<a href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer" class="wa-media-link">Abrir no mapa</a>` : ''}
        </div>`;
    }

    function buildMessageMediaHtml(message: any): string {
        const mediaUrl = String(message?.media_url || '').trim();
        if (!mediaUrl) return '';

        const mediaMimeType = String(message?.media_mime_type || '').trim().toLowerCase();
        const mediaFileName = String(message?.media_file_name || 'arquivo').trim() || 'arquivo';
        const escapedUrl = escapeHtml(mediaUrl);
        const escapedFileName = escapeHtml(mediaFileName);
        const isVideo = mediaMimeType.startsWith('video/') || /\.(mp4|mov|webm|mkv)(\?|$)/i.test(mediaUrl) || /\.(mp4|mov|webm|mkv)$/i.test(mediaFileName);

        if (mediaMimeType.startsWith('image/')) {
            return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer"><img src="${escapedUrl}" alt="${escapedFileName}" class="wa-media-image"></a>`;
        }

        if (isVideo) {
            return `<div class="wa-media-video-wrapper">
                <video class="wa-media-video" controls preload="metadata" playsinline>
                    <source src="${escapedUrl}" type="${escapeHtml(mediaMimeType || 'video/mp4')}">
                    Seu navegador nao suporta reproducao de video.
                </video>
                <a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="wa-media-link">Abrir video: ${escapedFileName}</a>
            </div>`;
        }

        if (mediaMimeType === 'application/pdf') {
            return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="wa-media-link">PDF: ${escapedFileName}</a>`;
        }

        return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="wa-media-link">Arquivo: ${escapedFileName}</a>`;
    }

    function normalizePhone(value: any): string {
        let digits = String(value || '').replace(/\D/g, '');
        if (!digits) return '';

        if (digits.startsWith('00') && digits.length > 4) {
            digits = digits.slice(2);
        }

        if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) {
            digits = digits.replace(/^0+/, '');
        }

        if (digits.length === 10 || digits.length === 11) {
            digits = `55${digits}`;
        }

        return digits;
    }

    function normalizeContactName(value: any): string {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function tokenizeContactName(value: any): string[] {
        const stopWords = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
        const normalized = normalizeContactName(value);
        if (!normalized) return [];

        return normalized
            .split(' ')
            .map((token) => token.trim())
            .filter((token) => token.length >= 3 && !stopWords.has(token));
    }

    function isLikelyTransientWhatsAppId(phone: any): boolean {
        const digits = String(phone || '').replace(/\D/g, '');
        return /^\d{14,}$/.test(digits) && !digits.startsWith('55');
    }

    function getChatUserFromChatId(chatId: any): string {
        const normalized = String(chatId || '').trim().toLowerCase();
        if (!normalized || !normalized.includes('@')) return '';
        const userPart = normalized.split('@')[0] || '';
        return normalizePhone(userPart);
    }

    function uniquePhones(values: any[]): string[] {
        const normalized = values
            .map((value) => normalizePhone(value))
            .filter((value) => !!value);

        return Array.from(new Set(normalized));
    }

    function pickPreferredPhoneForSend(values: any[]): string {
        const phones = uniquePhones(values);
        if (!phones.length) return '';

        const preferred = phones.find((phone) => !isLikelyTransientWhatsAppId(phone));
        return preferred || phones[0];
    }

    function isPersonalChatId(chatId: any): boolean {
        const value = String(chatId || '').trim().toLowerCase();
        return value.endsWith('@c.us') || value.endsWith('@lid');
    }

    function getMessageCreatedAtMs(message: any): number {
        const value = new Date(message?.created_at || 0).getTime();
        return Number.isFinite(value) ? value : 0;
    }

    function getMessageIdNumber(message: any): number {
        const value = Number(message?.id || 0);
        return Number.isFinite(value) ? value : 0;
    }

    function compareMessagesChronologically(left: any, right: any): number {
        const leftTs = Number(left?.message_timestamp || 0);
        const rightTs = Number(right?.message_timestamp || 0);
        if (leftTs !== rightTs) return leftTs - rightTs;

        const leftCreated = getMessageCreatedAtMs(left);
        const rightCreated = getMessageCreatedAtMs(right);
        if (leftCreated !== rightCreated) return leftCreated - rightCreated;

        const leftId = getMessageIdNumber(left);
        const rightId = getMessageIdNumber(right);
        if (leftId !== rightId) return leftId - rightId;

        return String(left?.message_id || left?.public_id || '').localeCompare(String(right?.message_id || right?.public_id || ''));
    }

    function pickPreferredChatId(messages: any[]): string | null {
        if (!Array.isArray(messages) || !messages.length) return null;

        const sorted = [...messages].sort((left, right) => compareMessagesChronologically(right, left));

        const latestLid = sorted.find((message) => String(message?.chat_id || '').toLowerCase().endsWith('@lid'));
        if (latestLid && isPersonalChatId(latestLid.chat_id)) {
            return String(latestLid.chat_id).trim();
        }

        const latestPersonal = sorted.find((message) => isPersonalChatId(message?.chat_id));
        if (latestPersonal) {
            return String(latestPersonal.chat_id).trim();
        }

        return null;
    }

    function pickBetterContactName(left: any, right: any): string {
        const leftName = String(left || '').trim();
        const rightName = String(right || '').trim();

        if (!leftName) return rightName;
        if (!rightName) return leftName;

        const normalizedLeft = normalizeContactName(leftName);
        const normalizedRight = normalizeContactName(rightName);

        if (normalizedLeft === normalizedRight) {
            return leftName.length >= rightName.length ? leftName : rightName;
        }

        const leftWordCount = leftName.split(/\s+/).filter(Boolean).length;
        const rightWordCount = rightName.split(/\s+/).filter(Boolean).length;
        if (leftWordCount !== rightWordCount) {
            return leftWordCount > rightWordCount ? leftName : rightName;
        }

        return leftName.length >= rightName.length ? leftName : rightName;
    }

    function getConversationDisplayName(conversation: any): string {
        const contactName = String(conversation?.contact_name || '').trim();
        if (contactName) return contactName;

        const notifyName = String(conversation?.last_notify_name || '').trim();
        if (notifyName) return notifyName;

        return normalizePhone(conversation?.contact_phone) || String(conversation?.contact_phone || '').trim();
    }

    function areLikelySamePersonByName(leftName: any, rightName: any): boolean {
        const normalizedLeft = normalizeContactName(leftName);
        const normalizedRight = normalizeContactName(rightName);

        if (!normalizedLeft || !normalizedRight) return false;
        if (normalizedLeft === normalizedRight) return true;

        const smaller = normalizedLeft.length <= normalizedRight.length ? normalizedLeft : normalizedRight;
        const larger = normalizedLeft.length <= normalizedRight.length ? normalizedRight : normalizedLeft;
        if (smaller.length >= 5 && larger.includes(smaller)) {
            return true;
        }

        const leftTokens = new Set(tokenizeContactName(normalizedLeft));
        const rightTokens = new Set(tokenizeContactName(normalizedRight));
        if (!leftTokens.size || !rightTokens.size) return false;

        let intersection = 0;
        for (const token of leftTokens) {
            if (rightTokens.has(token)) intersection += 1;
        }

        const minSize = Math.min(leftTokens.size, rightTokens.size);
        if (intersection >= 2 && (intersection / minSize) >= 0.6) {
            return true;
        }

        return false;
    }

    function getPhoneSuffix(value: any, size = 8): string {
        const digits = normalizePhone(value);
        if (!digits) return '';
        if (digits.length <= size) return digits;
        return digits.slice(-size);
    }

    function canMergeConversationEntries(existing: any, candidate: any): boolean {
        const existingPhone = normalizePhone(existing?.contact_phone);
        const candidatePhone = normalizePhone(candidate?.contact_phone);

        if (!existingPhone || !candidatePhone) return false;
        if (existingPhone === candidatePhone) return true;

        const existingChatUser = getChatUserFromChatId(existing?.last_chat_id);
        const candidateChatUser = getChatUserFromChatId(candidate?.last_chat_id);
        if (existingChatUser && candidateChatUser && existingChatUser === candidateChatUser) {
            return true;
        }

        const sameName = areLikelySamePersonByName(
            getConversationDisplayName(existing),
            getConversationDisplayName(candidate)
        );
        if (!sameName) return false;

        const existingIsTransient = isLikelyTransientWhatsAppId(existingPhone);
        const candidateIsTransient = isLikelyTransientWhatsAppId(candidatePhone);
        if (existingIsTransient || candidateIsTransient) {
            return true;
        }

        const existingSuffix = getPhoneSuffix(existingPhone);
        const candidateSuffix = getPhoneSuffix(candidatePhone);
        if (existingSuffix && candidateSuffix && existingSuffix === candidateSuffix) {
            return true;
        }

        const existingSource = String(existing?.source || '').toLowerCase();
        const candidateSource = String(candidate?.source || '').toLowerCase();
        const hasRegisteredSource = existingSource === 'registered' || candidateSource === 'registered';
        if (hasRegisteredSource) {
            return true;
        }

        return false;
    }

    function formatConnectedPhone(value: any): string {
        const digits = normalizePhone(value);
        if (!digits) return '';

        if (digits.length === 13 && digits.startsWith('55')) {
            return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
        }

        if (digits.length === 12 && digits.startsWith('55')) {
            return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
        }

        return `+${digits}`;
    }

    function addRoleForPhone(rolesMap: Map<string, Set<string>>, phone: string, role: string): void {
        if (!phone || !role) return;
        if (!rolesMap.has(phone)) {
            rolesMap.set(phone, new Set());
        }
        rolesMap.get(phone)?.add(role);
    }

    function getRegisteredRoleLabels(aliasPhones: string[]): string[] {
        const labels = new Set<string>();
        aliasPhones.forEach((phone) => {
            const roles = registeredContactRolesByPhone.get(phone);
            if (!roles) return;
            roles.forEach((role) => {
                const label = registerEntityLabelByKey.get(role);
                if (label) labels.add(label);
            });
        });
        return Array.from(labels);
    }

    function getMergedConversationList(): any[] {
        const aliasToCanonical = new Map<string, string>();
        for (const convo of allConversations) {
            const canonicalPhone = normalizePhone(convo?.contact_phone);
            if (!canonicalPhone) continue;

            const aliases = uniquePhones([
                canonicalPhone,
                ...(Array.isArray(convo?.alias_phones) ? convo.alias_phones : []),
                getChatUserFromChatId(convo?.last_chat_id),
            ]);

            aliases.forEach((aliasPhone) => aliasToCanonical.set(aliasPhone, canonicalPhone));
        }

        const mergedMap = new Map<string, any>();

        for (const convo of allConversations) {
            const rawPhone = normalizePhone(convo?.contact_phone);
            const phone = aliasToCanonical.get(rawPhone) || rawPhone;
            if (!phone) continue;

            const resolvedAliases = uniquePhones([
                ...(Array.isArray(convo?.alias_phones) ? convo.alias_phones : []),
                rawPhone,
                phone,
                getChatUserFromChatId(convo?.last_chat_id),
            ]).map((value) => aliasToCanonical.get(value) || value);

            mergedMap.set(phone, {
                ...convo,
                contact_phone: phone,
                alias_phones: uniquePhones(resolvedAliases),
                source: 'whatsapp',
            });
        }

        for (const contact of allCustomerContacts) {
            const rawPhone = normalizePhone(contact?.contact_phone);
            const phone = aliasToCanonical.get(rawPhone) || rawPhone;
            if (!phone || mergedMap.has(phone)) continue;

            mergedMap.set(phone, {
                contact_phone: phone,
                contact_name: contact.contact_name || phone,
                last_message_text: 'Contato cadastrado no ERP',
                last_direction: null,
                last_message_type: null,
                last_status: null,
                last_message_timestamp: null,
                last_message_created_at: null,
                source: 'registered',
            });
        }

        const mergedList = Array.from(mergedMap.values());
        mergedList.sort((left, right) => {
            const leftTs = Number(left?.last_message_timestamp || 0);
            const rightTs = Number(right?.last_message_timestamp || 0);
            if (rightTs !== leftTs) return rightTs - leftTs;
            return String(left?.contact_name || '').localeCompare(String(right?.contact_name || ''));
        });

        const dedupedByName: any[] = [];
        for (const conversation of mergedList) {
            const candidatePhone = normalizePhone(conversation?.contact_phone);
            let merged = false;

            for (const existing of dedupedByName) {
                if (!canMergeConversationEntries(existing, conversation)) {
                    continue;
                }

                const existingPhone = normalizePhone(existing?.contact_phone);
                const existingIsTransient = isLikelyTransientWhatsAppId(existingPhone);
                const candidateIsTransient = isLikelyTransientWhatsAppId(candidatePhone);

                const aliasSet = new Set<string>(uniquePhones([
                    ...(Array.isArray(existing?.alias_phones) ? existing.alias_phones : []),
                    existingPhone,
                    candidatePhone,
                ]));

                const preferredName = pickBetterContactName(
                    getConversationDisplayName(existing),
                    getConversationDisplayName(conversation)
                );
                const existingTs = Number(existing?.last_message_timestamp || 0);
                const candidateTs = Number(conversation?.last_message_timestamp || 0);
                if (candidateTs > existingTs) {
                    Object.assign(existing, conversation);
                }

                if (existingIsTransient && !candidateIsTransient) {
                    existing.contact_phone = candidatePhone;
                }

                existing.contact_name = preferredName;
                existing.alias_phones = Array.from(aliasSet);
                merged = true;
                break;
            }

            if (!merged) {
                dedupedByName.push({
                    ...conversation,
                    contact_phone: candidatePhone,
                    alias_phones: uniquePhones([candidatePhone]),
                });
            }
        }

        return dedupedByName;
    }

    function setStatus(status: any, sessionData?: any) {
        if (!statusBadge) return;
        const prevStatus = currentSessionStatus;
        currentSessionStatus = status || 'idle';
        if (prevStatus !== currentSessionStatus) {
            renderConversations();
        }
        const map: Record<string, { cls: string; label: string }> = {
            ready:         { cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', label: 'Conectado' },
            authenticated: { cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300', label: 'Autenticado' },
            awaiting_qr:   { cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', label: 'Aguardando QR' },
            initializing:  { cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', label: 'Inicializando' },
            disconnected:  { cls: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300', label: 'Desconectado' },
            error:         { cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', label: 'Erro' },
        };
        const meta = map[status] || { cls: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300', label: 'Inativo' };
        statusBadge.className = `ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${meta.cls}`;
        let label = meta.label;
        if (status === 'ready') {
            const connectedName = String(sessionData?.connected_name || '').trim();
            const connectedPhone = formatConnectedPhone(sessionData?.connected_number);

            if (connectedName) {
                label += ` · ${connectedName}`;
            }

            if (connectedPhone) {
                label += ` · ${connectedPhone}`;
            }
        }
        statusBadge.textContent = label;
        setSessionButtonsState(false);
    }

    async function startSession() {
        if (!userId) return;
        setSessionButtonsState(true);
        try {
            await api(`/users/${userId}/whatsapp-business/session`, {
                method: 'POST',
                body: JSON.stringify({}),
            });
            await loadSession();
            if (typeof UI !== 'undefined' && UI.showAlert) {
                try {
                    UI.showAlert('alertMessage', 'Solicitação de conexão enviada. Se necessário, escaneie o QR no seu celular.', 'success', 6000);
                } catch (_error) {}
            }
        } catch (error: any) {
            if (typeof UI !== 'undefined' && UI.showAlert) {
                try {
                    UI.showAlert('alertMessage', error?.message || 'Falha ao iniciar sessao do WhatsApp.', 'error', 6000);
                } catch (_error) {}
            }
        } finally {
            setSessionButtonsState(false);
        }
    }

    async function disconnectSession() {
        if (!userId) return;
        setSessionButtonsState(true);
        try {
            await api(`/users/${userId}/whatsapp-business/session`, { method: 'DELETE' });
            await loadSession();
            if (typeof UI !== 'undefined' && UI.showAlert) {
                try {
                    UI.showAlert('alertMessage', 'Sessao do WhatsApp desconectada com sucesso.', 'success', 5000);
                } catch (_error) {}
            }
        } catch (error: any) {
            if (typeof UI !== 'undefined' && UI.showAlert) {
                try {
                    UI.showAlert('alertMessage', error?.message || 'Falha ao desconectar sessao do WhatsApp.', 'error', 6000);
                } catch (_error) {}
            }
        } finally {
            setSessionButtonsState(false);
        }
    }

    // --- Init ---
    async function init() {
        try {
            const res = await api('/auth/me');
            userId = res?.data?.user?.public_id;
            if (!userId) throw new Error('Usuário não identificado');
        } catch (e) {
            console.error('[WhatsApp] Falha ao obter userId', e);
            if (convList) convList.innerHTML = '<div class="py-10 text-center text-sm text-red-400">Sessão expirada. Faça login novamente.</div>';
            return;
        }

        await Promise.all([loadSession(), loadConversations()]);
        await loadCustomersAsContacts();
        startPolling();
        setupEvents();
        updateAttachmentInfo();
    }

    // --- Sessão ---
    async function loadSession() {
        try {
            const res = await api(`/users/${userId}/whatsapp-business/session`);
            const session = res?.data;
            setStatus(session?.status || 'idle', session);
        } catch (e) {
            setStatus('error');
        }
    }

    // --- Conversas ---
    async function loadConversations() {
        try {
            const res = await api(`/users/${userId}/whatsapp-business/conversations?limit=100`);
            allConversations = res?.data || [];
            renderConversations();
        } catch (e) {
            console.warn('[WhatsApp] Erro ao carregar conversas', e);
        }
    }

    function renderConversations() {
        if (!convList) return;

        if (currentSessionStatus !== 'ready') {
            convList.innerHTML = '<div class="py-10 px-4 text-center text-sm text-gray-400 dark:text-gray-500">O WhatsApp não está sincronizado. Conecte para visualizar os contatos.</div>';
            return;
        }

        const mergedConversations = getMergedConversationList();
        const registeredPhones = new Set(Array.from(registeredContactRolesByPhone.keys()));
        const filtered = searchTerm
            ? mergedConversations.filter(c =>
                (c.contact_name || '').toLowerCase().includes(searchTerm) ||
                (c.contact_phone || '').includes(searchTerm))
            : mergedConversations;

        if (!filtered.length) {
            convList.innerHTML = '<div class="py-10 text-center text-sm text-gray-400 dark:text-gray-500">Nenhuma conversa encontrada.</div>';
            return;
        }

        convList.innerHTML = filtered.map(c => {
            const name = getConversationDisplayName(c);
            const aliasPhones = uniquePhones([...(c?.alias_phones || []), c.contact_phone]);
            const time = formatTime(c.last_message_timestamp, c.last_message_created_at);
            const initials = avatarInitials(name);
            const color = avatarColor(c.contact_phone);
            const isActive = aliasPhones.includes(currentPhone);
            const isRegisteredContact = aliasPhones.some((phone) => registeredPhones.has(phone));
            const registeredRoleLabels = getRegisteredRoleLabels(aliasPhones);
            const sourceTag = registeredRoleLabels
                .map((label) => `<span class="wa-contact-role-chip">${escapeHtml(label)}</span>`)
                .join('');
            const registeredDot = isRegisteredContact
                ? '<span class="wa-contact-registered-dot" title="Contato cadastrado" aria-label="Contato cadastrado"></span>'
                : '';
            const registerBtn = !isRegisteredContact
                ? `<button type="button" class="wa-register-contact-btn" data-phone="${escapeHtml(c.contact_phone)}" data-name="${escapeHtml(name)}" title="Cadastrar contato">Cadastrar</button>`
                : '';
            const secondaryRow = (sourceTag || registerBtn)
                ? `<div class="mt-1 flex flex-wrap items-center gap-1">${sourceTag}${registerBtn}</div>`
                : '';
            return `<div class="wa-conv-item${isActive ? ' active' : ''}" data-phone="${escapeHtml(c.contact_phone)}" data-phones="${escapeHtml(aliasPhones.join(','))}" data-name="${escapeHtml(name)}" data-chat-id="${escapeHtml(String(c?.last_chat_id || ''))}">
                <div class="wa-avatar" style="background:${color}">${escapeHtml(initials)}</div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-baseline gap-1">
                        <span class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate inline-flex items-center gap-1">${registeredDot}${escapeHtml(name)}</span>
                        <div class="shrink-0 text-[10px] text-gray-400 dark:text-gray-500">${escapeHtml(time)}</div>
                    </div>
                    ${secondaryRow}
                </div>
            </div>`;
        }).join('');

        convList.querySelectorAll('.wa-conv-item').forEach((el: any) => {
            el.addEventListener('click', () => selectConversation(el.dataset.phone, el.dataset.name, el.dataset.phones, el.dataset.chatId));
        });

        convList.querySelectorAll('.wa-register-contact-btn').forEach((btn: any) => {
            btn.addEventListener('click', (event: Event) => {
                event.stopPropagation();
                const target = event.currentTarget as HTMLElement;
                showRegisterTypeMenu(target, target?.dataset?.name || '', target?.dataset?.phone || '');
            });
        });
    }

    async function loadCustomersAsContacts() {
        if (loadingCustomers) return;

        loadingCustomers = true;
        if (loadCustomersBtn) {
            loadCustomersBtn.disabled = true;
            loadCustomersBtn.textContent = 'Puxando clientes...';
        }

        try {
            const contactMap = new Map<string, any>();
            const rolesByPhone = new Map<string, Set<string>>();

            const [customersResult, suppliersResult, usersResult] = await Promise.allSettled([
                api('/entities/customers'),
                api('/entities/suppliers'),
                api('/users'),
            ]);

            if (customersResult.status === 'fulfilled') {
                const customers = Array.isArray(customersResult.value?.data) ? customersResult.value.data : [];
                for (const customer of customers) {
                    const phone = normalizePhone(customer?.phone);
                    if (!phone) continue;

                    contactMap.set(phone, {
                        contact_phone: phone,
                        contact_name: String(customer?.name || customer?.full_name || phone),
                    });
                    addRoleForPhone(rolesByPhone, phone, 'customer');
                }
            }

            if (suppliersResult.status === 'fulfilled') {
                const suppliers = Array.isArray(suppliersResult.value?.data) ? suppliersResult.value.data : [];
                for (const supplier of suppliers) {
                    const phone = normalizePhone(supplier?.phone);
                    if (!phone) continue;

                    const existing = contactMap.get(phone);
                    const fallbackName = String(supplier?.name || phone);
                    const nextName = existing?.contact_name || fallbackName;

                    contactMap.set(phone, {
                        contact_phone: phone,
                        contact_name: nextName,
                    });
                    addRoleForPhone(rolesByPhone, phone, 'supplier');
                }
            }

            if (usersResult.status === 'fulfilled') {
                const users = Array.isArray(usersResult.value?.data) ? usersResult.value.data : [];
                const supportedRoles = new Set(['seller', 'buyer', 'service_provider', 'accountant']);

                for (const user of users) {
                    const role = String(user?.role || '');
                    if (!supportedRoles.has(role)) continue;

                    const phone = normalizePhone(user?.phone);
                    if (!phone) continue;

                    const existing = contactMap.get(phone);
                    const fallbackName = String(user?.full_name || user?.name || phone);
                    const nextName = existing?.contact_name || fallbackName;

                    contactMap.set(phone, {
                        contact_phone: phone,
                        contact_name: nextName,
                    });
                    addRoleForPhone(rolesByPhone, phone, role);
                }
            }

            allCustomerContacts = Array.from(contactMap.values());
            registeredContactRolesByPhone = rolesByPhone;
            renderConversations();

            if (typeof UI !== 'undefined' && UI.showAlert) {
                try {
                    UI.showAlert('alertMessage', `${allCustomerContacts.length} contato(s) cadastrado(s) importado(s).`, 'success', 4000);
                } catch (_error) {}
            }
        } catch (error: any) {
            console.warn('[WhatsApp] Erro ao importar clientes como contatos', error);
            if (typeof UI !== 'undefined' && UI.showAlert) {
                try {
                    UI.showAlert('alertMessage', error?.message || 'Falha ao puxar clientes como contatos.', 'error', 5000);
                } catch (_error) {}
            }
        } finally {
            loadingCustomers = false;
            if (loadCustomersBtn) {
                loadCustomersBtn.disabled = false;
                loadCustomersBtn.textContent = 'Puxar clientes como contatos';
            }
        }
    }

    // --- Selecionar conversa ---
    async function selectConversation(phone: string, name: string, phonesRaw?: string, chatIdRaw?: string) {
        markUserActivity();
        clearAttachment();
        currentPreferredChatId = isPersonalChatId(chatIdRaw) ? String(chatIdRaw).trim() : null;
        const aliasPhones = uniquePhones([...(String(phonesRaw || '').split(',')), phone]);
        currentPhoneAliases = aliasPhones;
        currentPhone = pickPreferredPhoneForSend(aliasPhones) || normalizePhone(phone);
        currentName = name;

        if (chatName) chatName.textContent = name;
        if (chatPhone) chatPhone.textContent = currentPhone;
        if (chatAvatar) {
            chatAvatar.textContent = avatarInitials(name);
            chatAvatar.style.background = avatarColor(currentPhone);
        }

        if (chatEmpty) chatEmpty.classList.add('hidden');
        if (chatActive) {
            chatActive.classList.remove('hidden');
            chatActive.style.display = 'flex';
        }

        // Mobile: esconder sidebar, mostrar chat
        if (window.innerWidth < 640) {
            sidebar?.classList.add('hidden-mobile');
            chatPanel?.classList.remove('hidden-mobile');
        }

        renderConversations(); // atualiza active
        lastMessageIds = new Set();
        await loadMessages(true);
        startMsgPolling();
    }

    // --- Mensagens ---
    async function loadMessages(scrollToBottom = false) {
        if (!currentPhone) return;
        try {
            const phonesToLoad = uniquePhones(currentPhoneAliases.length ? currentPhoneAliases : [currentPhone]);
            const responses = await Promise.all(
                phonesToLoad.map((phone) => api(`/users/${userId}/whatsapp-business/messages?phone=${encodeURIComponent(phone)}&limit=200`))
            );

            const mergedByPublicId = new Map<string, any>();
            const mergedMessages: any[] = [];
            for (const response of responses) {
                const list = Array.isArray(response?.data) ? response.data : [];
                for (const message of list) {
                    const fallbackId = `${message?.direction || ''}_${message?.message_timestamp || ''}_${message?.created_at || ''}_${message?.message_text || ''}`;
                    const publicId = String(message?.public_id || fallbackId);
                    if (mergedByPublicId.has(publicId)) continue;
                    mergedByPublicId.set(publicId, message);
                    mergedMessages.push(message);
                }
            }

            const msgs = mergedMessages.sort(compareMessagesChronologically);

            currentPreferredChatId = pickPreferredChatId(msgs);

            const newIds = new Set(msgs.map(m => m.public_id));
            const hasNew = msgs.some(m => !lastMessageIds.has(m.public_id));
            lastMessageIds = newIds;

            if (!hasNew && !scrollToBottom) return;

            if (!messagesArea) return;
            const prevScrollTop = messagesArea.scrollTop;
            const prevScrollHeight = messagesArea.scrollHeight;
            const isAtBottom = prevScrollHeight - prevScrollTop - messagesArea.clientHeight < 80;

            messagesArea.innerHTML = msgs.map(m => {
                const dir = m.direction === 'outbound' ? 'outbound' : 'inbound';
                const time = formatTime(m.message_timestamp, m.created_at);
                const locationHtml = buildLocationHtml(m);
                const mediaHtml = buildMessageMediaHtml(m);
                const textHtml = shouldRenderMessageText(m)
                    ? `<div>${escapeHtml(m.message_text)}</div>`
                    : '';
                return `<div class="wa-bubble ${dir}">
                    ${locationHtml}
                    ${mediaHtml}
                    ${textHtml}
                    <div class="wa-bubble-time">${escapeHtml(time)}</div>
                </div>`;
            }).join('');

            if (scrollToBottom || isAtBottom) {
                messagesArea.scrollTop = messagesArea.scrollHeight;
            }
        } catch (e) {
            console.warn('[WhatsApp] Erro ao carregar mensagens', e);
        }
    }

    async function deleteCurrentConversation() {
        markUserActivity();
        if (!currentPhone || deletingConversation) return;

        deletingConversation = true;
        if (deleteContactBtn) deleteContactBtn.disabled = true;

        const contactLabel = currentName || currentPhone;
        const phoneToDelete = currentPhone;

        try {
            const confirmed = window.confirm(`Excluir o contato ${contactLabel} e todas as mensagens deste chat?`);
            if (!confirmed) return;

            await api(`/users/${userId}/whatsapp-business/conversations/${encodeURIComponent(phoneToDelete)}`, {
                method: 'DELETE',
            });

            allConversations = allConversations.filter((c) => c.contact_phone !== phoneToDelete);
            allCustomerContacts = allCustomerContacts.filter((c) => c.contact_phone !== phoneToDelete);

            currentPhone = null;
            currentPhoneAliases = [];
            currentName = null;
            lastMessageIds = new Set();

            stopMsgPolling();

            if (messagesArea) messagesArea.innerHTML = '';
            if (chatName) chatName.textContent = '—';
            if (chatPhone) chatPhone.textContent = '—';
            if (chatAvatar) chatAvatar.textContent = '?';
            if (chatActive) {
                chatActive.classList.add('hidden');
                chatActive.style.display = '';
            }
            if (chatEmpty) chatEmpty.classList.remove('hidden');

            renderConversations();
            await loadConversations();

            if (typeof UI !== 'undefined' && UI.showAlert) {
                try {
                    UI.showAlert('alertMessage', 'Contato e mensagens excluidos com sucesso.', 'success', 4000);
                } catch (_error) {}
            }
        } catch (e: any) {
            console.error('[WhatsApp] Erro ao excluir contato', e);
            if (typeof UI !== 'undefined' && UI.showAlert) {
                try {
                    UI.showAlert('alertMessage', e?.message || 'Falha ao excluir contato.', 'error', 7000);
                } catch (_error) {}
            }
        } finally {
            deletingConversation = false;
            if (deleteContactBtn) deleteContactBtn.disabled = false;
        }
    }

    // --- Enviar ---
    async function sendMessage() {
        markUserActivity();
        if (sending || !currentPhone) return;

        const targetPhone = pickPreferredPhoneForSend(currentPhoneAliases.length ? currentPhoneAliases : [currentPhone]);
        if (!targetPhone) return;

            if (currentSessionStatus !== 'ready') {
                if (typeof UI !== 'undefined' && UI.showAlert) {
                    try {
                        UI.showAlert('alertMessage', 'WhatsApp ainda nao esta conectado. Use o botao Conectar e aguarde o status "Conectado".', 'warn', 6000);
                    } catch (_error) {}
                }
                return;
            }

        const text = String(messageInput?.value || '').trim();
        const attachment = pendingAttachment;
        if (!text && !attachment) return;

        sending = true;
        if (sendBtn) sendBtn.disabled = true;
        if (attachmentBtn) attachmentBtn.disabled = true;
        if (attachmentClearBtn) attachmentClearBtn.disabled = true;
        if (messageInput) messageInput.value = '';

        try {
            const payload: any = { to: targetPhone };
            if (currentPreferredChatId) {
                payload.to_chat_id = currentPreferredChatId;
            }
            if (text) payload.message = text;
            if (attachment) {
                payload.attachment_base64 = attachment.base64;
                payload.attachment_name = attachment.fileName;
                payload.attachment_mime_type = attachment.mimeType;
            }

            await api(`/users/${userId}/whatsapp-business/messages`, {
                method: 'POST',
                body: JSON.stringify(payload),
            });

            clearAttachment();
            await loadMessages(true);
            await loadConversations();
        } catch (e) {
            console.error('[WhatsApp] Erro ao enviar mensagem', e);
            if (messageInput) messageInput.value = text;
                if (typeof UI !== 'undefined' && UI.showAlert) {
                    try {
                        const errorMessage = (e as any)?.message || 'Falha ao enviar mensagem no WhatsApp.';
                        UI.showAlert('alertMessage', errorMessage, 'error', 7000);
                    } catch (_error) {}
                }
        } finally {
            sending = false;
            if (sendBtn) sendBtn.disabled = false;
            if (attachmentBtn) attachmentBtn.disabled = false;
            if (attachmentClearBtn) attachmentClearBtn.disabled = false;
            focusMessageInputSafely();
        }
    }

    // --- Polling ---
    function startPolling() {
        stopPolling();
        convPollInFlight = false;
        activeConversationsPollMs = computeConversationsPollMs();

        const tick = async () => {
            if (document.hidden || convPollInFlight) return;
            convPollInFlight = true;
            try {
                await loadConversations();

                const now = Date.now();
                if (now - lastSessionPollAt >= SESSION_POLL_MS) {
                    await loadSession();
                    lastSessionPollAt = now;
                }
            } finally {
                convPollInFlight = false;
            }
        };

        void tick();
        convPollTimer = setInterval(() => {
            void tick();
        }, activeConversationsPollMs);
    }

    function stopPolling() {
        if (convPollTimer) clearInterval(convPollTimer);
        convPollTimer = null;
    }

    function startMsgPolling() {
        stopMsgPolling();
        msgPollInFlight = false;
        activeMessagesPollMs = computeMessagesPollMs();

        const tick = async () => {
            if (document.hidden || msgPollInFlight || !currentPhone || !isChatVisible()) return;
            msgPollInFlight = true;
            try {
                await loadMessages(false);
            } finally {
                msgPollInFlight = false;
            }
        };

        void tick();
        msgPollTimer = setInterval(() => {
            void tick();
        }, activeMessagesPollMs);
    }

    function stopMsgPolling() {
        if (msgPollTimer) clearInterval(msgPollTimer);
        msgPollTimer = null;
    }

    // --- Eventos ---
    function setupEvents() {
        if (eventsBound) return;
        eventsBound = true;

        sendBtn?.addEventListener('click', sendMessage);

        attachmentBtn?.addEventListener('click', () => {
            markUserActivity();
            if (!attachmentInput) return;
            attachmentInput.click();
        });

        attachmentClearBtn?.addEventListener('click', () => {
            markUserActivity();
            clearAttachment();
        });

        attachmentInput?.addEventListener('change', async () => {
            markUserActivity();
            const file = attachmentInput.files?.[0];
            if (!file) {
                clearAttachment();
                return;
            }

            if (!isSupportedAttachment(file)) {
                clearAttachment();
                if (typeof UI !== 'undefined' && UI.showAlert) {
                    try {
                        UI.showAlert('alertMessage', 'Selecione apenas imagem ou PDF.', 'warn', 5000);
                    } catch (_error) {}
                }
                return;
            }

            if (file.size > ATTACHMENT_MAX_BYTES) {
                clearAttachment();
                if (typeof UI !== 'undefined' && UI.showAlert) {
                    try {
                        UI.showAlert('alertMessage', `Arquivo acima do limite de ${formatBytes(ATTACHMENT_MAX_BYTES)}.`, 'warn', 6000);
                    } catch (_error) {}
                }
                return;
            }

            try {
                const base64 = await readFileAsBase64(file);
                pendingAttachment = {
                    fileName: file.name,
                    mimeType: file.type,
                    base64,
                };
                updateAttachmentInfo();
            } catch (error: any) {
                clearAttachment();
                if (typeof UI !== 'undefined' && UI.showAlert) {
                    try {
                        UI.showAlert('alertMessage', error?.message || 'Nao foi possivel processar o arquivo selecionado.', 'error', 6000);
                    } catch (_error) {}
                }
            }
        });

        messageInput?.addEventListener('keydown', (e: KeyboardEvent) => {
            markUserActivity();
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        messageInput?.addEventListener('input', () => {
            markUserActivity();
            if (!messageInput) return;
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 112) + 'px';
        });

        searchInput?.addEventListener('input', () => {
            markUserActivity();
            searchTerm = searchInput.value.toLowerCase().trim();
            renderConversations();
        });

        connectBtn?.addEventListener('click', () => {
            void startSession();
        });

        disconnectBtn?.addEventListener('click', () => {
            void disconnectSession();
        });

        loadCustomersBtn?.addEventListener('click', () => {
            markUserActivity();
            void loadCustomersAsContacts();
        });

        btnBack?.addEventListener('click', () => {
            markUserActivity();
            sidebar?.classList.remove('hidden-mobile');
            chatPanel?.classList.add('hidden-mobile');
        });

        deleteContactBtn?.addEventListener('click', () => {
            void deleteCurrentConversation();
        });

        convList?.addEventListener('click', () => {
            markUserActivity();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopPolling();
                stopMsgPolling();
                return;
            }

            startPolling();
            if (currentPhone) {
                startMsgPolling();
            }

            refreshAdaptivePolling();
        });

        window.addEventListener('beforeunload', () => {
            stopPolling();
            stopMsgPolling();
        });
    }

    // --- Start ---
    await init();
    setSessionButtonsState(false);
});

})();
