import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import {
    WhatsAppBusinessAnalyticsDirection,
    WhatsAppBusinessAnalyticsMessageType,
    WhatsAppBusinessAnalyticsRecentMessage,
    WhatsAppBusinessAnalyticsSession,
    WhatsAppBusinessAnalyticsSummary,
} from '../types/WhatsAppBusiness';

const MESSAGE_AT_SQL = 'COALESCE(FROM_UNIXTIME(NULLIF(message_timestamp, 0)), created_at)';

function toNumber(value: unknown): number {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? numeric : 0;
}

function toBoolean(value: unknown): boolean {
    return toNumber(value) === 1;
}

export class WhatsappMessageRepository {
    static async saveMessage(
        publicId: string, companyId: number, ownerType: string, ownerId: number, userId: number | null,
        direction: string, contactPhone: string, contactName: string | null, chatId: string | null,
        messageId: string | null, messageType: string, messageText: string, mediaMimeType: string | null,
        mediaFileName: string | null, mediaUrl: string | null, status: string | null, messageTimestamp: number | null,
        rawPayload: any
    ): Promise<void> {
        await pool.query<ResultSetHeader>(
            `INSERT INTO whatsapp_business_messages (
                public_id, company_id, owner_type, owner_id, user_id, direction,
                contact_phone, contact_name, chat_id, message_id, message_type,
                message_text, media_mime_type, media_file_name, media_url,
                status, message_timestamp, raw_payload
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                user_id = VALUES(user_id),
                contact_phone = VALUES(contact_phone),
                contact_name = VALUES(contact_name),
                chat_id = VALUES(chat_id),
                message_type = VALUES(message_type),
                message_text = VALUES(message_text),
                media_mime_type = VALUES(media_mime_type),
                media_file_name = VALUES(media_file_name),
                media_url = VALUES(media_url),
                status = VALUES(status),
                message_timestamp = VALUES(message_timestamp),
                raw_payload = VALUES(raw_payload),
                updated_at = CURRENT_TIMESTAMP`,
            [
                publicId, companyId, ownerType, ownerId, userId, direction,
                contactPhone, contactName, chatId, messageId, messageType,
                messageText, mediaMimeType, mediaFileName, mediaUrl,
                status, messageTimestamp, rawPayload
            ]
        );
    }

    static async listConversations(companyId: number, ownerType: string, ownerId: number, limit: number): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT
                latest.contact_phone,
                latest.contact_name,
                latest.last_notify_name,
                latest.last_chat_id,
                latest.last_message_public_id,
                latest.last_message_text,
                latest.last_direction,
                latest.last_message_type,
                latest.last_status,
                latest.last_message_timestamp,
                latest.last_message_created_at,
                latest.messages_count
             FROM (
                SELECT
                    public_id AS last_message_public_id,
                    contact_phone,
                    contact_name,
                    JSON_UNQUOTE(JSON_EXTRACT(raw_payload, '$.notifyName')) AS last_notify_name,
                    chat_id AS last_chat_id,
                    message_text AS last_message_text,
                    direction AS last_direction,
                    message_type AS last_message_type,
                    status AS last_status,
                    message_timestamp AS last_message_timestamp,
                    created_at AS last_message_created_at,
                    ROW_NUMBER() OVER (
                        PARTITION BY contact_phone
                        ORDER BY COALESCE(message_timestamp, UNIX_TIMESTAMP(created_at)) DESC, id DESC
                    ) AS row_num,
                    COUNT(*) OVER (PARTITION BY contact_phone) AS messages_count
                FROM whatsapp_business_messages
                WHERE company_id = ? AND owner_type = ? AND owner_id = ?
             ) latest
             WHERE latest.row_num = 1
             ORDER BY COALESCE(latest.last_message_timestamp, UNIX_TIMESTAMP(latest.last_message_created_at)) DESC
             LIMIT ?`,
            [companyId, ownerType, ownerId, limit]
        );
        return rows;
    }

    static async listMessages(companyId: number, ownerType: string, ownerId: number, contactPhone: string, limit: number): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT
                recent.id, recent.public_id, recent.company_id, recent.owner_type, recent.owner_id, recent.user_id,
                recent.direction, recent.contact_phone, recent.contact_name, recent.chat_id, recent.message_id,
                recent.message_type, recent.message_text, recent.media_mime_type, recent.media_file_name,
                recent.media_url, recent.status, recent.message_timestamp, recent.raw_payload, recent.created_at, recent.updated_at
             FROM (
                SELECT
                    id, public_id, company_id, owner_type, owner_id, user_id,
                    direction, contact_phone, contact_name, chat_id, message_id,
                    message_type, message_text, media_mime_type, media_file_name,
                    media_url, status, message_timestamp, raw_payload, created_at, updated_at
                FROM whatsapp_business_messages
                WHERE company_id = ? AND owner_type = ? AND owner_id = ? AND contact_phone = ?
                ORDER BY COALESCE(message_timestamp, UNIX_TIMESTAMP(created_at)) DESC, id DESC
                LIMIT ?
             ) recent
             ORDER BY COALESCE(recent.message_timestamp, UNIX_TIMESTAMP(recent.created_at)) ASC, recent.id ASC`,
            [companyId, ownerType, ownerId, contactPhone, limit]
        );
        return rows;
    }

    static async deleteMessages(companyId: number, ownerType: string, ownerId: number, contactPhone: string): Promise<void> {
        await pool.query(
            `DELETE FROM whatsapp_business_messages
             WHERE company_id = ? AND owner_type = ? AND owner_id = ? AND contact_phone = ?`,
            [companyId, ownerType, ownerId, contactPhone]
        );
    }

    static async getAnalytics(companyId: number, ownerType: string, ownerId: number): Promise<{
        session: WhatsAppBusinessAnalyticsSession | null;
        summary: WhatsAppBusinessAnalyticsSummary;
        directions: WhatsAppBusinessAnalyticsDirection[];
        messageTypes: WhatsAppBusinessAnalyticsMessageType[];
        recentMessages: WhatsAppBusinessAnalyticsRecentMessage[];
    }> {
        const [summaryRows] = await pool.query<RowDataPacket[]>(
            `SELECT
                COUNT(*) AS total_messages,
                SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) AS inbound_messages,
                SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) AS outbound_messages,
                COUNT(DISTINCT contact_phone) AS conversations_count,
                SUM(CASE WHEN media_mime_type IS NOT NULL OR media_file_name IS NOT NULL THEN 1 ELSE 0 END) AS media_messages,
                SUM(CASE WHEN DATE(${MESSAGE_AT_SQL}) = CURRENT_DATE() THEN 1 ELSE 0 END) AS messages_today,
                SUM(CASE WHEN ${MESSAGE_AT_SQL} >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS messages_last_7_days,
                MIN(${MESSAGE_AT_SQL}) AS first_message_at,
                MAX(${MESSAGE_AT_SQL}) AS last_message_at
             FROM whatsapp_business_messages
             WHERE company_id = ? AND owner_type = ? AND owner_id = ?`,
            [companyId, ownerType, ownerId]
        );

        const [aliasRows] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) AS phone_aliases_count
             FROM whatsapp_business_phone_aliases
             WHERE company_id = ? AND owner_type = ? AND owner_id = ?`,
            [companyId, ownerType, ownerId]
        );

        const [directionRows] = await pool.query<RowDataPacket[]>(
            `SELECT direction, COUNT(*) AS total
             FROM whatsapp_business_messages
             WHERE company_id = ? AND owner_type = ? AND owner_id = ?
             GROUP BY direction
             ORDER BY direction`,
            [companyId, ownerType, ownerId]
        );

        const [messageTypeRows] = await pool.query<RowDataPacket[]>(
            `SELECT COALESCE(NULLIF(message_type, ''), 'chat') AS message_type, COUNT(*) AS total
             FROM whatsapp_business_messages
             WHERE company_id = ? AND owner_type = ? AND owner_id = ?
             GROUP BY COALESCE(NULLIF(message_type, ''), 'chat')
             ORDER BY total DESC, message_type ASC
             LIMIT 8`,
            [companyId, ownerType, ownerId]
        );

        const [recentMessageRows] = await pool.query<RowDataPacket[]>(
            `SELECT
                public_id,
                direction,
                contact_phone,
                contact_name,
                message_type,
                message_text,
                status,
                ${MESSAGE_AT_SQL} AS message_at
             FROM whatsapp_business_messages
             WHERE company_id = ? AND owner_type = ? AND owner_id = ?
             ORDER BY ${MESSAGE_AT_SQL} DESC, id DESC
             LIMIT 10`,
            [companyId, ownerType, ownerId]
        );

        const [sessionRows] = await pool.query<RowDataPacket[]>(
            `SELECT
                status,
                persisted_session,
                connected_number,
                connected_name,
                platform,
                last_event_at,
                last_error,
                updated_at
             FROM whatsapp_business_sessions
             WHERE company_id = ? AND owner_type = ? AND owner_id = ?
             ORDER BY updated_at DESC, id DESC
             LIMIT 1`,
            [companyId, ownerType, ownerId]
        );

        const summaryRow = (summaryRows[0] || {}) as RowDataPacket;
        const aliasRow = (aliasRows[0] || {}) as RowDataPacket;
        const summary: WhatsAppBusinessAnalyticsSummary = {
            total_messages: toNumber(summaryRow.total_messages),
            inbound_messages: toNumber(summaryRow.inbound_messages),
            outbound_messages: toNumber(summaryRow.outbound_messages),
            conversations_count: toNumber(summaryRow.conversations_count),
            media_messages: toNumber(summaryRow.media_messages),
            messages_today: toNumber(summaryRow.messages_today),
            messages_last_7_days: toNumber(summaryRow.messages_last_7_days),
            phone_aliases_count: toNumber(aliasRow.phone_aliases_count),
            first_message_at: summaryRow.first_message_at || null,
            last_message_at: summaryRow.last_message_at || null,
        };

        const sessionRow = sessionRows[0];
        const session = sessionRow
            ? {
                status: sessionRow.status || null,
                persisted_session: toBoolean(sessionRow.persisted_session),
                connected_number: sessionRow.connected_number || null,
                connected_name: sessionRow.connected_name || null,
                platform: sessionRow.platform || null,
                last_event_at: sessionRow.last_event_at || null,
                last_error: sessionRow.last_error || null,
                updated_at: sessionRow.updated_at || null,
            }
            : null;

        return {
            session,
            summary,
            directions: directionRows.map((row) => ({
                direction: row.direction,
                total: toNumber(row.total),
            })) as WhatsAppBusinessAnalyticsDirection[],
            messageTypes: messageTypeRows.map((row) => ({
                message_type: String(row.message_type || 'chat'),
                total: toNumber(row.total),
            })),
            recentMessages: recentMessageRows.map((row) => ({
                public_id: String(row.public_id || ''),
                direction: row.direction,
                contact_phone: String(row.contact_phone || ''),
                contact_name: row.contact_name || null,
                message_type: row.message_type || null,
                message_text: String(row.message_text || ''),
                status: row.status || null,
                message_at: row.message_at || null,
            })) as WhatsAppBusinessAnalyticsRecentMessage[],
        };
    }
}