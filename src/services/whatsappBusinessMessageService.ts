import { randomUUID } from 'crypto';
import {
    WhatsAppBusinessAnalytics,
    SaveWhatsAppBusinessMessageData,
    WhatsAppBusinessConversation,
    WhatsAppBusinessMessage,
    WhatsAppBusinessMessageScope,
} from '../types/WhatsAppBusiness';
import { WhatsappMessageRepository } from '../repositories/whatsappMessageRepository';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';

function normalizeContactPhone(value: string): string {
    let digits = String(value || '').trim().replace(/\D/g, '');
    if (!digits) {
        return '';
    }

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

function extractVCardField(rawText: string, prefix: string): string | null {
    const pattern = new RegExp(`^${prefix}:(.+)$`, 'im');
    const match = rawText.match(pattern);
    return match?.[1]?.trim() || null;
}

function formatPhoneForDisplay(value: string | null | undefined): string | null {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) {
        return null;
    }

    if (digits.length === 13 && digits.startsWith('55')) {
        return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }

    if (digits.length === 12 && digits.startsWith('55')) {
        return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
    }

    return `+${digits}`;
}

function normalizeSharedContactMessage(messageType: string | null | undefined, messageText: string | null | undefined): string {
    const normalizedText = String(messageText || '').trim();
    const normalizedType = String(messageType || '').trim().toLowerCase();
    const isVCard = normalizedType === 'vcard' || normalizedType === 'multi_vcard' || normalizedText.toUpperCase().startsWith('BEGIN:VCARD');

    if (!isVCard || !normalizedText) {
        return normalizedText;
    }

    const fullName = extractVCardField(normalizedText, 'FN');
    const waidMatch = normalizedText.match(/waid=(\d{8,20})/i);
    const telMatch = normalizedText.match(/^item\d+\.TEL[^:]*:(.+)$/im) || normalizedText.match(/^TEL[^:]*:(.+)$/im);
    const phone = formatPhoneForDisplay(waidMatch?.[1] || telMatch?.[1] || '');
    const lines = ['[Contato compartilhado]'];

    if (fullName) {
        lines.push(fullName);
    }
    if (phone) {
        lines.push(phone);
    }

    return lines.join('\n');
}

function normalizeContactName(value: string | null | undefined): string {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function tokenizeContactName(value: string): string[] {
    return value
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length >= 2);
}

function areLikelySamePersonByName(leftName: string | null | undefined, rightName: string | null | undefined): boolean {
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
    return intersection >= 2 && (intersection / minSize) >= 0.6;
}

function getPhoneSuffix(value: string, size = 8): string {
    const digits = normalizeContactPhone(value);
    if (!digits) return '';
    if (digits.length <= size) return digits;
    return digits.slice(-size);
}

function isLikelyTransientWhatsAppId(value: string): boolean {
    const digits = normalizeContactPhone(value);
    if (!digits) return false;
    if (digits.length < 13) return false;
    if (digits.startsWith('55')) return false;
    return true;
}

function getChatUserFromChatId(chatId: any): string {
    const normalized = String(chatId || '').trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) return '';
    const userPart = normalized.split('@')[0] || '';
    return normalizeContactPhone(userPart);
}

function getConversationEffectiveName(row: any): string {
    const contactName = String(row?.contact_name || '').trim();
    if (contactName) return contactName;

    const notifyName = String(row?.last_notify_name || '').trim();
    if (notifyName) return notifyName;

    return '';
}

function getConversationRecencyValue(row: any): number {
    const ts = Number(row?.last_message_timestamp || 0);
    if (ts > 0) return ts;
    const createdAtMs = new Date(row?.last_message_created_at || 0).getTime();
    return Number.isFinite(createdAtMs) ? createdAtMs : 0;
}

function canMergeConversationRows(existing: any, candidate: any): boolean {
    const existingPhone = normalizeContactPhone(existing?.contact_phone || '');
    const candidatePhone = normalizeContactPhone(candidate?.contact_phone || '');

    if (!existingPhone || !candidatePhone) return false;
    if (existingPhone === candidatePhone) return true;

    const existingChatUser = getChatUserFromChatId(existing?.last_chat_id);
    const candidateChatUser = getChatUserFromChatId(candidate?.last_chat_id);
    if (existingChatUser && candidateChatUser && existingChatUser === candidateChatUser) {
        return true;
    }

    const sameName = areLikelySamePersonByName(
        getConversationEffectiveName(existing),
        getConversationEffectiveName(candidate)
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

    return false;
}

function buildCompanyScope(companyId: number): WhatsAppBusinessMessageScope {
    return {
        companyId,
        ownerType: 'company',
        ownerId: companyId,
        userId: null,
    };
}

function buildUserScope(companyId: number, userId: number): WhatsAppBusinessMessageScope {
    return {
        companyId,
        ownerType: 'user',
        ownerId: userId,
        userId,
    };
}

export class WhatsAppBusinessMessageService {
    static normalizeContactPhone(value: string): string {
        return normalizeContactPhone(value);
    }

    private static async saveScopedMessage(scope: WhatsAppBusinessMessageScope, data: SaveWhatsAppBusinessMessageData): Promise<void> {
        const contactPhone = normalizeContactPhone(data.contact_phone);
        if (!contactPhone) {
            throw new Error('Numero da conversa do WhatsApp Business nao informado.');
        }

        const publicId = data.public_id || randomUUID();
        const messageText = String(data.message_text || '').trim();
        if (!messageText) {
            throw new Error('Conteudo da mensagem do WhatsApp Business nao informado.');
        }

        await WhatsappMessageRepository.saveMessage(
            publicId,
            scope.companyId,
            scope.ownerType,
            scope.ownerId,
            scope.userId || null,
            data.direction,
            contactPhone,
            data.contact_name || null,
            data.chat_id || null,
            data.message_id || null,
            data.message_type || 'chat',
            messageText,
            data.media_mime_type || null,
            data.media_file_name || null,
            data.media_url || null,
            data.status || null,
            typeof data.message_timestamp === 'number' ? data.message_timestamp : null,
            data.raw_payload || null
        );
    }

    private static async loadScopedPhoneAliasMap(scope: WhatsAppBusinessMessageScope): Promise<Map<string, string>> {
        const aliasMap = new Map<string, string>();

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT alias_phone, canonical_phone
             FROM whatsapp_business_phone_aliases
             WHERE company_id = ? AND owner_type = ? AND owner_id = ?`,
            [scope.companyId, scope.ownerType, scope.ownerId]
        );

        for (const row of rows) {
            const aliasPhone = normalizeContactPhone(String(row.alias_phone || ''));
            const canonicalPhone = normalizeContactPhone(String(row.canonical_phone || ''));
            if (!aliasPhone || !canonicalPhone) continue;
            aliasMap.set(aliasPhone, canonicalPhone);
        }

        return aliasMap;
    }

    private static async listScopedConversations(scope: WhatsAppBusinessMessageScope, limit = 50): Promise<WhatsAppBusinessConversation[]> {
        const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
        const rows = await WhatsappMessageRepository.listConversations(scope.companyId, scope.ownerType, scope.ownerId, safeLimit);
        const aliasMap = await this.loadScopedPhoneAliasMap(scope);

        const preparedRows = rows.map((row: any) => ({
            ...(row as WhatsAppBusinessConversation),
            contact_phone: aliasMap.get(normalizeContactPhone(String(row.contact_phone || ''))) || normalizeContactPhone(String(row.contact_phone || '')),
            last_message_text: normalizeSharedContactMessage(row.last_message_type, row.last_message_text),
            alias_phones: Array.from(new Set([
                normalizeContactPhone(String(row.contact_phone || '')),
                aliasMap.get(normalizeContactPhone(String(row.contact_phone || ''))),
            ].filter(Boolean))),
        }));

        const mergedRows: any[] = [];
        for (const candidate of preparedRows) {
            if (!candidate?.contact_phone) continue;

            let merged = false;
            for (const existing of mergedRows) {
                if (!canMergeConversationRows(existing, candidate)) {
                    continue;
                }

                const existingRecency = getConversationRecencyValue(existing);
                const candidateRecency = getConversationRecencyValue(candidate);

                if (candidateRecency > existingRecency) {
                    Object.assign(existing, candidate);
                }

                const existingPhone = normalizeContactPhone(existing?.contact_phone || '');
                const candidatePhone = normalizeContactPhone(candidate?.contact_phone || '');
                const existingIsTransient = isLikelyTransientWhatsAppId(existingPhone);
                const candidateIsTransient = isLikelyTransientWhatsAppId(candidatePhone);
                if (existingIsTransient && !candidateIsTransient) {
                    existing.contact_phone = candidatePhone;
                }

                const existingName = getConversationEffectiveName(existing);
                const candidateName = getConversationEffectiveName(candidate);
                if (!existingName && candidateName) {
                    existing.contact_name = candidateName;
                }

                const aliases = new Set<string>([
                    ...((existing.alias_phones || []) as string[]),
                    ...((candidate.alias_phones || []) as string[]),
                    existingPhone,
                    candidatePhone,
                ].filter(Boolean));
                existing.alias_phones = Array.from(aliases);
                existing.messages_count = Number(existing.messages_count || 0) + Number(candidate.messages_count || 0);

                merged = true;
                break;
            }

            if (!merged) {
                mergedRows.push(candidate);
            }
        }

        mergedRows.sort((left, right) => getConversationRecencyValue(right) - getConversationRecencyValue(left));

        return mergedRows as WhatsAppBusinessConversation[];
    }

    private static async listScopedMessages(scope: WhatsAppBusinessMessageScope, contactPhone: string, limit = 500): Promise<WhatsAppBusinessMessage[]> {
        const normalizedContactPhone = normalizeContactPhone(contactPhone);
        if (!normalizedContactPhone) {
            return [];
        }

        const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 500));
        const rows = await WhatsappMessageRepository.listMessages(scope.companyId, scope.ownerType, scope.ownerId, normalizedContactPhone, safeLimit);

        return rows.map((row: any) => ({
            ...(row as WhatsAppBusinessMessage),
            message_text: normalizeSharedContactMessage(row.message_type, row.message_text),
        })) as WhatsAppBusinessMessage[];
    }

    private static async deleteScopedMessages(scope: WhatsAppBusinessMessageScope, contactPhone: string): Promise<void> {
        const normalizedContactPhone = normalizeContactPhone(contactPhone);
        if (!normalizedContactPhone) return;

        await WhatsappMessageRepository.deleteMessages(scope.companyId, scope.ownerType, scope.ownerId, normalizedContactPhone);
    }

    private static async getScopedAnalytics(scope: WhatsAppBusinessMessageScope): Promise<WhatsAppBusinessAnalytics> {
        const [analytics, recentConversations] = await Promise.all([
            WhatsappMessageRepository.getAnalytics(scope.companyId, scope.ownerType, scope.ownerId),
            this.listScopedConversations(scope, 8),
        ]);

        return {
            scope,
            session: analytics.session,
            summary: analytics.summary,
            directions: analytics.directions,
            message_types: analytics.messageTypes,
            recent_conversations: recentConversations,
            recent_messages: analytics.recentMessages,
        };
    }

    static async saveMessage(companyId: number, data: SaveWhatsAppBusinessMessageData): Promise<void> {
        return this.saveScopedMessage(buildCompanyScope(companyId), data);
    }

    static async saveUserMessage(companyId: number, userId: number, data: SaveWhatsAppBusinessMessageData): Promise<void> {
        return this.saveScopedMessage(buildUserScope(companyId, userId), data);
    }

    static async listConversations(companyId: number, limit = 50): Promise<WhatsAppBusinessConversation[]> {
        return this.listScopedConversations(buildCompanyScope(companyId), limit);
    }

    static async listUserConversations(companyId: number, userId: number, limit = 50): Promise<WhatsAppBusinessConversation[]> {
        return this.listScopedConversations(buildUserScope(companyId, userId), limit);
    }

    static async listMessages(companyId: number, contactPhone: string, limit = 500): Promise<WhatsAppBusinessMessage[]> {
        return this.listScopedMessages(buildCompanyScope(companyId), contactPhone, limit);
    }

    static async listUserMessages(companyId: number, userId: number, contactPhone: string, limit = 500): Promise<WhatsAppBusinessMessage[]> {
        return this.listScopedMessages(buildUserScope(companyId, userId), contactPhone, limit);
    }

    static async deleteMessages(companyId: number, contactPhone: string): Promise<void> {
        return this.deleteScopedMessages(buildCompanyScope(companyId), contactPhone);
    }

    static async deleteUserMessages(companyId: number, userId: number, contactPhone: string): Promise<void> {
        return this.deleteScopedMessages(buildUserScope(companyId, userId), contactPhone);
    }

    static async getAnalytics(companyId: number): Promise<WhatsAppBusinessAnalytics> {
        return this.getScopedAnalytics(buildCompanyScope(companyId));
    }

    static async getUserAnalytics(companyId: number, userId: number): Promise<WhatsAppBusinessAnalytics> {
        return this.getScopedAnalytics(buildUserScope(companyId, userId));
    }
}
