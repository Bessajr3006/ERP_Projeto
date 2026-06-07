import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import QRCode from 'qrcode';
import { RowDataPacket } from 'mysql2/promise';
import logger from '../config/logger';
import pool from '../config/db';
import { WhatsAppBusinessMessageService } from './whatsappBusinessMessageService';
import { WhatsAppBusinessOwnerType } from '../types/WhatsAppBusiness';
import { AppError } from '../errors/AppError';
import { OrderService } from './orderService';

const ffmpegPath: string | null = require('ffmpeg-static');
const execFileAsync = promisify(execFile);

export type WhatsAppBusinessSessionStatus =
    | 'idle'
    | 'initializing'
    | 'awaiting_qr'
    | 'authenticated'
    | 'ready'
    | 'auth_failure'
    | 'disconnected'
    | 'error';

export interface WhatsAppBusinessSessionSnapshot {
    status: WhatsAppBusinessSessionStatus;
    company_key: string;
    owner_type: WhatsAppBusinessOwnerType;
    owner_key: string;
    session_key: string;
    qr_code_data_url: string | null;
    pairing_code: string | null;
    has_qr_code: boolean;
    connected_number: string | null;
    connected_name: string | null;
    platform: string | null;
    wid: string | null;
    last_event_at: string | null;
    last_error: string | null;
    persisted_session: boolean;
}

export interface WhatsAppBusinessSendResult {
    status: 'sent';
    to: string;
    chat_id: string;
    message_id: string | null;
    ack: number | null;
    timestamp: number | null;
    message_type: string | null;
    attachment_name: string | null;
}

type WhatsAppBusinessAttachmentInput = {
    base64: string;
    mimeType: string;
    fileName: string;
};

type WhatsAppBusinessStoredMedia = {
    mediaMimeType: string | null;
    mediaFileName: string | null;
    mediaUrl: string | null;
};

type WhatsAppBusinessSendMessageInput = {
    to: string;
    toChatId?: string;
    messageBody?: string;
    attachment?: WhatsAppBusinessAttachmentInput | null;
};

type SessionScopeContext = {
    companyId: number;
    ownerType: WhatsAppBusinessOwnerType;
    ownerId: number;
    companyKey: string;
    ownerKey: string;
    sessionKey: string;
};

type SessionRecord = {
    scope: SessionScopeContext;
    client: WhatsAppClient | null;
    initializePromise: Promise<void> | null;
    snapshot: WhatsAppBusinessSessionSnapshot;
    inboundSyncTimer: NodeJS.Timeout | null;
    initializingSince: number | null;
};

type AutoReplyProductMatch = {
    name: string;
    description: string | null;
    selling_price: number | null;
    current_stock: number | null;
    measure_abbreviation: string | null;
};

type InboundOrderItemInput = {
    productName: string;
    quantity: number;
    usedDefaultQuantity?: boolean;
};

type InboundOrderCreationResult = {
    created: boolean;
    message: string;
};

type InboundOrderFinalizeResult = {
    message: string;
    attachment: WhatsAppBusinessAttachmentInput | null;
};

type PendingOrderDraft = {
    userPublicId: string;
    customerPublicId: string | null;
    bankAccountPublicId: string;
    categoryPublicId: string;
    items: Array<{ product_public_id: string; quantity: number; unit_price: number; product_name: string }>;
    totalAmount: number;
    awaitingConfirmation: boolean;
    createdAt: number;
};

type WhatsAppModule = typeof import('whatsapp-web.js');
type WhatsAppClient = import('whatsapp-web.js').Client;
type WhatsAppMessage = import('whatsapp-web.js').Message;
type WhatsAppRuntimeExports = WhatsAppModule & {
    default?: Partial<WhatsAppModule>;
};

const SESSION_ROOT = path.join(process.cwd(), '.runtime', 'whatsapp-business');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'whatsapp');
let whatsappModulePromise: Promise<WhatsAppModule> | null = null;

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
export class WhatsAppBusinessService {
    private static readonly sessions = new Map<string, SessionRecord>();
    private static readonly initializationStallMs = 15_000;
    private static readonly recoveryCooldownMs = 30_000;
    private static readonly recoveryCooldownByKey = new Map<string, number>();
    private static readonly historyBootstrapChatsLimit = 25;
    private static readonly historyBootstrapMessagesLimit = 30;
    private static readonly sendReadyWaitMs = 6_000;
    private static readonly sendReadyPollMs = 250;
    private static readonly inboundDedupWindowMs = 24 * 60 * 60 * 1000;
    private static readonly inboundSyncCooldownMs = 3_000;
    private static readonly inboundSyncChatsLimit = 15;
    private static readonly inboundSyncMessagesLimit = 25;
    private static readonly inboundSyncIntervalMs = 5_000;
    private static readonly inboundSyncAutoReplyRecentWindowMs = 2 * 60 * 1000;
    private static readonly processedInboundMessageIds = new Map<string, Map<string, number>>();
    private static readonly inboundSyncLastRunByScope = new Map<string, number>();
    private static readonly inboundSyncInProgress = new Set<string>();
    private static readonly lastStatusLogByScope = new Map<string, { signature: string; at: number }>();
    private static readonly autoReplyLastSentByScopeContact = new Map<string, number>();
    private static readonly pendingOrderDraftTtlMs = 15 * 60 * 1000;
    private static readonly pendingOrderDraftByScopeContact = new Map<string, PendingOrderDraft>();
    private static productsStatusColumnAvailable: boolean | null = null;

    private static normalizeTextForAutoReplyCheck(value: string): string {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private static shouldTriggerAutoReplyFromInboundText(messageText: string): boolean {
        const normalizedText = this.normalizeTextForAutoReplyCheck(messageText);
        if (!normalizedText) {
            return false;
        }

        // Detecta saudacoes curtas e mensagens iniciadas por cumprimento.
        if (/^(oi+|ola+)(\s|$)/i.test(normalizedText)) {
            return true;
        }

        if (/^(opa|e ai|eae)(\s|$)/i.test(normalizedText)) {
            return true;
        }

        if (normalizedText.includes('tudo bem') || normalizedText.includes('tem alguem ai')) {
            return true;
        }

        const commercialInquiryKeywords = [
            'produto',
            'produtos',
            'preco',
            'precos',
            'valor',
            'valores',
            'quanto custa',
            'orcamento',
            'catalogo',
            'pedido',
            'pedir',
            'quero comprar',
            'quero pedir',
            'tenho interesse',
            'gostaria de saber',
        ];

        if (commercialInquiryKeywords.some((keyword) => normalizedText.includes(keyword))) {
            return true;
        }

        // Fallback para mensagens curtas com possivel nome de produto (ex.: "cerveja").
        const nonCommercialShortReplies = new Set([
            'ok',
            'blz',
            'beleza',
            'valeu',
            'obrigado',
            'obrigada',
            'show',
            'top',
            'sim',
            'nao',
            'não',
            'fechado',
        ]);
        const words = normalizedText.split(' ').filter(Boolean);
        const looksLikeShortProductHint = words.length >= 1
            && words.length <= 3
            && normalizedText.length <= 30
            && !nonCommercialShortReplies.has(normalizedText);

        if (looksLikeShortProductHint) {
            return true;
        }

        return /^(bom dia|boa tarde|boa noite)(\s|$)/i.test(normalizedText);
    }

    private static buildGreetingByHour(): string {
        const hourText = new Intl.DateTimeFormat('pt-BR', {
            hour: '2-digit',
            hour12: false,
            timeZone: 'America/Sao_Paulo',
        }).format(new Date());
        const hour = Number(hourText);

        if (!Number.isFinite(hour)) {
            return 'Ola';
        }

        if (hour < 12) {
            return 'Bom dia';
        }

        if (hour < 18) {
            return 'Boa tarde';
        }

        return 'Boa noite';
    }

    private static buildInboundAutoReplyMessage(contactName?: string | null): string {
        const greeting = this.buildGreetingByHour();
        const normalizedContactName = String(contactName || '').trim();

        if (normalizedContactName) {
            return `${greeting}, ${normalizedContactName}! Tudo bem? Como voce esta?\nVoce quer informacao sobre qual produto?\nComo posso ajudar?`;
        }

        return `${greeting}! Tudo bem? Como voce esta?\nVoce quer informacao sobre qual produto?\nComo posso ajudar?`;
    }

    private static formatCurrencyBr(value: number | string | null | undefined): string {
        const numericValue = typeof value === 'number'
            ? value
            : typeof value === 'string'
                ? Number(String(value).replace(',', '.'))
                : Number.NaN;

        if (!Number.isFinite(numericValue)) {
            return 'preco a consultar';
        }

        return numericValue.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        });
    }

    private static normalizePdfText(value: string): string {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\x20-\x7E]/g, '')
            .replace(/\\/g, '\\\\')
            .replace(/\(/g, '\\(')
            .replace(/\)/g, '\\)')
            .trim();
    }

    private static buildSimplePdfBuffer(lines: string[]): Buffer {
        const safeLines = lines
            .map((line) => this.normalizePdfText(line))
            .filter((line) => line.length > 0)
            .slice(0, 36);

        const contentRows: string[] = [
            'BT',
            '/F1 12 Tf',
            '40 800 Td',
        ];

        safeLines.forEach((line, index) => {
            if (index === 0) {
                contentRows.push(`(${line}) Tj`);
                return;
            }
            contentRows.push('0 -18 Td');
            contentRows.push(`(${line}) Tj`);
        });

        contentRows.push('ET');

        const contentStream = `${contentRows.join('\n')}\n`;
        const contentLength = Buffer.byteLength(contentStream, 'utf8');

        const objects = [
            '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
            '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
            '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
            '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
            `5 0 obj\n<< /Length ${contentLength} >>\nstream\n${contentStream}endstream\nendobj\n`,
        ];

        const header = '%PDF-1.4\n';
        let pdf = header;
        const offsets: number[] = [0];

        for (const obj of objects) {
            offsets.push(Buffer.byteLength(pdf, 'utf8'));
            pdf += obj;
        }

        const xrefStart = Buffer.byteLength(pdf, 'utf8');
        let xref = `xref\n0 ${objects.length + 1}\n`;
        xref += '0000000000 65535 f \n';
        for (let i = 1; i <= objects.length; i += 1) {
            xref += `${String(offsets[i] || 0).padStart(10, '0')} 00000 n \n`;
        }

        const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
        return Buffer.from(pdf + xref + trailer, 'utf8');
    }

    private static buildSalesOrderPdfAttachment(
        createdOrderId: number,
        totalAmount: number,
        items: Array<{ product_name: string; quantity: number; unit_price: number; }>
    ): WhatsAppBusinessAttachmentInput {
        const createdAtText = new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short',
            timeZone: 'America/Sao_Paulo',
        }).format(new Date());

        const pdfLines = [
            `Pedido #${createdOrderId}`,
            `Emitido em: ${createdAtText}`,
            '',
            'Itens:',
            ...items.map((item, index) => {
                const subtotal = item.quantity * item.unit_price;
                return `${index + 1}. ${item.product_name} | qtd ${item.quantity} | un ${this.formatCurrencyBr(item.unit_price)} | sub ${this.formatCurrencyBr(subtotal)}`;
            }),
            '',
            `Total: ${this.formatCurrencyBr(totalAmount)}`,
        ];

        const pdfBuffer = this.buildSimplePdfBuffer(pdfLines);
        return {
            base64: pdfBuffer.toString('base64'),
            mimeType: 'application/pdf',
            fileName: `pedido_${createdOrderId}.pdf`,
        };
    }

    private static extractProductLookupTerms(inboundText: string): string[] {
        const normalizedText = this.normalizeTextForAutoReplyCheck(inboundText);
        if (!normalizedText) {
            return [];
        }

        const stopwords = new Set([
            'oi',
            'ola',
            'opa',
            'e',
            'ai',
            'eae',
            'bom',
            'boa',
            'dia',
            'tarde',
            'noite',
            'quanto',
            'custa',
            'valor',
            'valores',
            'preco',
            'precos',
            'produto',
            'produtos',
            'quero',
            'comprar',
            'saber',
            'sobre',
            'tem',
            'de',
            'do',
            'da',
            'um',
            'uma',
            'por',
            'favor',
        ]);

        const terms = normalizedText
            .split(' ')
            .map((term) => term.trim())
            .filter((term) => term.length >= 2 && !stopwords.has(term));

        return Array.from(new Set(terms)).slice(0, 4);
    }

    private static shouldLookupProductsForInboundText(inboundText: string): boolean {
        const normalizedText = this.normalizeTextForAutoReplyCheck(inboundText);
        if (!normalizedText) {
            return false;
        }

        const shortNonCommercialReplies = new Set([
            'ok',
            'blz',
            'beleza',
            'valeu',
            'obrigado',
            'obrigada',
            'show',
            'top',
            'sim',
            'nao',
            'não',
            'fechado',
            'certo',
            'combinado',
            'tranquilo',
            'tranks',
        ]);

        if (shortNonCommercialReplies.has(normalizedText)) {
            return false;
        }

        if (normalizedText.split(' ').filter(Boolean).length === 1 && normalizedText.length <= 3) {
            return false;
        }

        if (/^(oi+|ola+|opa|e ai|eae|bom dia|boa tarde|boa noite|tudo bem)$/.test(normalizedText)) {
            return false;
        }

        return this.extractProductLookupTerms(inboundText).length > 0;
    }

    private static isBeerInquiry(inboundText: string): boolean {
        const normalizedText = this.normalizeTextForAutoReplyCheck(inboundText);
        return normalizedText.includes('cerveja') || normalizedText.includes('cervejas');
    }

    private static isCatalogInquiry(inboundText: string): boolean {
        const normalizedText = this.normalizeTextForAutoReplyCheck(inboundText);
        return /(^|\s)(catalogo|catalog)(\s|$)/.test(normalizedText);
    }

    private static isOrderStartCommand(inboundText: string): boolean {
        const normalizedText = this.normalizeTextForAutoReplyCheck(inboundText);
        return normalizedText === 'pedido' || normalizedText === 'novo pedido' || normalizedText === 'fazer pedido';
    }

    private static isOrderConfirmation(inboundText: string): boolean {
        const normalizedText = this.normalizeTextForAutoReplyCheck(inboundText);
        return [
            'sim',
            'confirmar',
            'confirmo',
            'pode finalizar',
            'pode fechar',
            'fechar pedido',
            'finalizar pedido',
            'confirmar pedido',
            'ok confirmar',
        ].some((keyword) => normalizedText.includes(keyword));
    }

    private static isOrderTotalInquiry(inboundText: string): boolean {
        const normalizedText = this.normalizeTextForAutoReplyCheck(inboundText);
        return normalizedText.includes('total') || normalizedText.includes('quanto deu');
    }

    private static isOrderConfirmOption(inboundText: string): boolean {
        const normalizedText = this.normalizeTextForAutoReplyCheck(inboundText);
        return normalizedText === '1' || normalizedText === '1 confirma' || normalizedText === '1 confirmar';
    }

    private static isOrderCancelOption(inboundText: string): boolean {
        const normalizedText = this.normalizeTextForAutoReplyCheck(inboundText);
        return normalizedText === '2' || normalizedText === '2 cancelar' || normalizedText === '2 cancela';
    }

    private static parseInboundOrderItems(inboundText: string): InboundOrderItemInput[] {
        const rawLines = String(inboundText || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        // Permite itens enviados na mesma linha: "Arroz 2, Feijao 1".
        const lines = rawLines
            .flatMap((line) => line.split(/[;,]+/))
            .map((line) => line.trim())
            .filter(Boolean);

        const parsedItems: InboundOrderItemInput[] = [];

        for (const line of lines) {
            const normalizedLine = this.normalizeTextForAutoReplyCheck(line);
            if (!normalizedLine) {
                continue;
            }

            if (/^(pedido|fazer pedido|novo pedido)$/.test(normalizedLine)) {
                continue;
            }

            if (/^(catalogo|catalog|total|sim|nao|confirmar|cancelar|1|2|oi|ola|opa|bom dia|boa tarde|boa noite|tudo bem)$/.test(normalizedLine)) {
                continue;
            }

            // Ex.: "Arroz - 2" ou "Arroz x 2".
            const nameQtyMatch = line.match(/^(.*?)\s*(?:-|x)\s*(\d+(?:[.,]\d+)?)$/i);
            if (nameQtyMatch) {
                const productName = String(nameQtyMatch[1] || '').trim();
                const quantity = Number(String(nameQtyMatch[2] || '').replace(',', '.'));
                if (productName && Number.isFinite(quantity) && quantity > 0) {
                    parsedItems.push({ productName, quantity, usedDefaultQuantity: false });
                }
                continue;
            }

            // Ex.: "2 Arroz".
            const qtyNameMatch = line.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/i);
            if (qtyNameMatch) {
                const quantity = Number(String(qtyNameMatch[1] || '').replace(',', '.'));
                const productName = String(qtyNameMatch[2] || '').trim();
                if (productName && Number.isFinite(quantity) && quantity > 0) {
                    parsedItems.push({ productName, quantity, usedDefaultQuantity: false });
                }
                continue;
            }

            // Ex.: "Arroz 2".
            const nameEndQtyMatch = line.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)$/i);
            if (nameEndQtyMatch) {
                const productName = String(nameEndQtyMatch[1] || '').trim();
                const quantity = Number(String(nameEndQtyMatch[2] || '').replace(',', '.'));
                if (productName && Number.isFinite(quantity) && quantity > 0) {
                    parsedItems.push({ productName, quantity, usedDefaultQuantity: false });
                }
                continue;
            }

            // Ex.: "Arroz" ou "Arroz Integral" (sem quantidade explicita) => qtd 1.
            const hasLetters = /[a-z]/i.test(normalizedLine);
            if (hasLetters) {
                parsedItems.push({ productName: line, quantity: 1, usedDefaultQuantity: true });
            }
        }

        return parsedItems;
    }

    private static normalizePhoneDigits(value: string): string {
        return String(value || '').replace(/\D/g, '');
    }

    private static isLikelyTransientPhone(value: string): boolean {
        const digits = this.normalizePhoneDigits(value);
        return /^\d{14,}$/.test(digits) && !digits.startsWith('55');
    }

    private static extractChatUserDigits(chatId: string | null | undefined): string {
        const normalizedChatId = String(chatId || '').trim().toLowerCase();
        if (!normalizedChatId || !normalizedChatId.includes('@')) {
            return '';
        }

        const rawUser = normalizedChatId.split('@')[0] || '';
        return this.normalizePhoneDigits(rawUser);
    }

    private static async upsertScopedPhoneAlias(
        scope: SessionScopeContext,
        aliasPhone: string,
        canonicalPhone: string,
        sourceChatId?: string | null,
    ): Promise<void> {
        const normalizedAlias = this.normalizePhoneDigits(aliasPhone);
        const normalizedCanonical = this.normalizePhoneDigits(canonicalPhone);
        const normalizedChatId = String(sourceChatId || '').trim() || null;
        const sourceChatUser = this.extractChatUserDigits(normalizedChatId);

        if (!normalizedAlias || !normalizedCanonical || normalizedAlias === normalizedCanonical) {
            return;
        }

        await pool.query(
            `INSERT INTO whatsapp_business_phone_aliases (
                company_id, owner_type, owner_id,
                alias_phone, canonical_phone,
                source_chat_user, source_chat_id
             ) VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                canonical_phone = VALUES(canonical_phone),
                source_chat_user = VALUES(source_chat_user),
                source_chat_id = VALUES(source_chat_id),
                updated_at = CURRENT_TIMESTAMP`,
            [
                scope.companyId,
                scope.ownerType,
                scope.ownerId,
                normalizedAlias,
                normalizedCanonical,
                sourceChatUser || null,
                normalizedChatId,
            ]
        );

        await this.normalizeScopedMessagesForPhoneAlias(scope, normalizedAlias, normalizedCanonical);
    }

    private static async normalizeScopedMessagesForPhoneAlias(
        scope: SessionScopeContext,
        aliasPhone: string,
        canonicalPhone: string,
    ): Promise<void> {
        const normalizedAlias = this.normalizePhoneDigits(aliasPhone);
        const normalizedCanonical = this.normalizePhoneDigits(canonicalPhone);

        if (!normalizedAlias || !normalizedCanonical || normalizedAlias === normalizedCanonical) {
            return;
        }

        await pool.query(
            `UPDATE whatsapp_business_messages
             SET contact_phone = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE company_id = ?
               AND owner_type = ?
               AND owner_id = ?
               AND contact_phone = ?`,
            [
                normalizedCanonical,
                scope.companyId,
                scope.ownerType,
                scope.ownerId,
                normalizedAlias,
            ]
        );
    }

    private static async resolveScopedPhoneAliasFromMappings(
        scope: SessionScopeContext,
        contactPhone: string,
        chatId: string | null,
    ): Promise<string> {
        const normalizedPhone = this.normalizePhoneDigits(contactPhone);
        if (!normalizedPhone) {
            return '';
        }

        const chatUser = this.extractChatUserDigits(chatId);
        const clauses: string[] = ['alias_phone = ?'];
        const params: Array<number | string> = [scope.companyId, scope.ownerType, scope.ownerId, normalizedPhone];

        if (chatUser) {
            clauses.push('source_chat_user = ?');
            params.push(chatUser);
        }

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT canonical_phone
             FROM whatsapp_business_phone_aliases
             WHERE company_id = ?
               AND owner_type = ?
               AND owner_id = ?
               AND (${clauses.join(' OR ')})
             ORDER BY updated_at DESC, id DESC
             LIMIT 20`,
            params
        );

        for (const row of rows) {
            const canonical = this.normalizePhoneDigits(String(row.canonical_phone || ''));
            if (!canonical || canonical === normalizedPhone) {
                continue;
            }

            if (!this.isLikelyTransientPhone(canonical)) {
                return canonical;
            }
        }

        const fallback = this.normalizePhoneDigits(String(rows[0]?.canonical_phone || ''));
        if (fallback && fallback !== normalizedPhone) {
            return fallback;
        }

        return normalizedPhone;
    }

    private static async resolveScopedPhoneAliasFromHistory(
        scope: SessionScopeContext,
        contactPhone: string,
        contactName: string | null,
        chatId: string | null,
        notifyName: string | null
    ): Promise<string> {
        const normalizedPhone = this.normalizePhoneDigits(contactPhone);
        if (!normalizedPhone) {
            return '';
        }

        // Mantem numeros nao-transitorios como fonte de verdade.
        if (!this.isLikelyTransientPhone(normalizedPhone)) {
            return normalizedPhone;
        }

        const mappedPhone = await this.resolveScopedPhoneAliasFromMappings(scope, normalizedPhone, chatId);
        if (mappedPhone && mappedPhone !== normalizedPhone) {
            return mappedPhone;
        }

        const clauses: string[] = [];
        const params: Array<number | string> = [
            scope.companyId,
            scope.ownerType,
            scope.ownerId,
            normalizedPhone,
        ];

        const normalizedName = String(contactName || '').trim();
        if (normalizedName) {
            clauses.push('LOWER(TRIM(contact_name)) = LOWER(?)');
            params.push(normalizedName);
        }

        const normalizedNotifyName = String(notifyName || '').trim();
        if (normalizedNotifyName) {
            clauses.push("LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(raw_payload, '$.notifyName')))) = LOWER(?)");
            params.push(normalizedNotifyName);
        }

        const normalizedChatId = String(chatId || '').trim();
        if (normalizedChatId) {
            clauses.push('chat_id = ?');
            params.push(normalizedChatId);

            const chatUser = this.extractChatUserDigits(normalizedChatId);
            if (chatUser) {
                clauses.push('TRIM(SUBSTRING_INDEX(chat_id, "@", 1)) = ?');
                params.push(chatUser);
            }
        }

        if (!clauses.length) {
            return normalizedPhone;
        }

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT contact_phone
             FROM whatsapp_business_messages
             WHERE company_id = ?
               AND owner_type = ?
               AND owner_id = ?
               AND contact_phone IS NOT NULL
               AND TRIM(contact_phone) <> ''
               AND contact_phone <> ?
               AND (${clauses.join(' OR ')})
             ORDER BY COALESCE(message_timestamp, UNIX_TIMESTAMP(created_at)) DESC, id DESC
             LIMIT 20`,
            params
        );

        for (const row of rows) {
            const candidatePhone = this.normalizePhoneDigits(String(row.contact_phone || ''));
            if (!candidatePhone || candidatePhone === normalizedPhone) {
                continue;
            }

            if (!this.isLikelyTransientPhone(candidatePhone)) {
                return candidatePhone;
            }
        }

        return normalizedPhone;
    }

    private static async resolveCustomerPublicIdByPhone(companyId: number, contactPhone: string): Promise<string | null> {
        const targetDigits = this.normalizePhoneDigits(contactPhone);
        if (!targetDigits) {
            return null;
        }

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT public_id, phone
             FROM customers
             WHERE company_id = ?
               AND phone IS NOT NULL
               AND TRIM(phone) <> ''`,
            [companyId]
        );

        for (const row of rows) {
            const customerDigits = this.normalizePhoneDigits(String(row.phone || ''));
            if (!customerDigits) {
                continue;
            }

            if (customerDigits === targetDigits
                || targetDigits.endsWith(customerDigits)
                || customerDigits.endsWith(targetDigits)) {
                return String(row.public_id || '').trim() || null;
            }
        }

        return null;
    }

    private static async resolveDefaultBankAccountPublicId(companyId: number): Promise<string | null> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT public_id
             FROM bank_accounts
             WHERE company_id = ?
             ORDER BY id ASC
             LIMIT 1`,
            [companyId]
        );

        return rows.length > 0 ? String(rows[0]!.public_id || '').trim() || null : null;
    }

    private static async resolveDefaultIncomeCategoryPublicId(companyId: number): Promise<string | null> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT public_id
             FROM categories
             WHERE company_id = ?
               AND type = 'income'
             ORDER BY id ASC
             LIMIT 1`,
            [companyId]
        );

        return rows.length > 0 ? String(rows[0]!.public_id || '').trim() || null : null;
    }

    private static async resolveUserPublicIdForOrder(scope: SessionScopeContext): Promise<string | null> {
        if (scope.ownerType === 'user') {
            const [userRows] = await pool.query<RowDataPacket[]>(
                `SELECT public_id
                 FROM users
                 WHERE id = ?
                   AND company_id = ?
                 LIMIT 1`,
                [scope.ownerId, scope.companyId]
            );

            return userRows.length > 0 ? String(userRows[0]!.public_id || '').trim() || null : null;
        }

        const [companyUserRows] = await pool.query<RowDataPacket[]>(
            `SELECT public_id
             FROM users
             WHERE company_id = ?
             ORDER BY id ASC
             LIMIT 1`,
            [scope.companyId]
        );

        return companyUserRows.length > 0 ? String(companyUserRows[0]!.public_id || '').trim() || null : null;
    }

    private static async resolveProductForOrderItem(companyId: number, productName: string): Promise<{ public_id: string; name: string; selling_price: number } | null> {
        const normalizedName = String(productName || '').trim();
        if (!normalizedName) {
            return null;
        }

        const [exactRows] = await pool.query<RowDataPacket[]>(
            `SELECT public_id, name, selling_price
             FROM products
             WHERE company_id = ?
               AND LOWER(name) = LOWER(?)
             ORDER BY id ASC
             LIMIT 1`,
            [companyId, normalizedName]
        );

        if (exactRows.length > 0) {
            return {
                public_id: String(exactRows[0]!.public_id),
                name: String(exactRows[0]!.name),
                selling_price: Number(exactRows[0]!.selling_price),
            };
        }

        const [likeRows] = await pool.query<RowDataPacket[]>(
            `SELECT public_id, name, selling_price
             FROM products
             WHERE company_id = ?
               AND LOWER(name) LIKE ?
             ORDER BY name ASC
             LIMIT 1`,
            [companyId, `%${normalizedName.toLowerCase()}%`]
        );

        if (likeRows.length === 0) {
            return null;
        }

        return {
            public_id: String(likeRows[0]!.public_id),
            name: String(likeRows[0]!.name),
            selling_price: Number(likeRows[0]!.selling_price),
        };
    }

    private static async tryCreateSalesOrderFromInbound(
        scope: SessionScopeContext,
        inboundText: string,
        contactPhone: string,
        existingDraft: PendingOrderDraft | null = null
    ): Promise<InboundOrderCreationResult> {
        const parsedItems = this.parseInboundOrderItems(inboundText);
        if (parsedItems.length === 0) {
            if (!existingDraft) {
                const [resolvedUserPublicId, resolvedBankAccountPublicId, resolvedCategoryPublicId] = await Promise.all([
                    this.resolveUserPublicIdForOrder(scope),
                    this.resolveDefaultBankAccountPublicId(scope.companyId),
                    this.resolveDefaultIncomeCategoryPublicId(scope.companyId),
                ]);

                if (!resolvedUserPublicId) {
                    return {
                        created: false,
                        message: 'Nao consegui identificar o usuario responsavel para registrar esse pedido no sistema.',
                    };
                }

                if (!resolvedBankAccountPublicId) {
                    return {
                        created: false,
                        message: 'Nao encontrei conta bancaria cadastrada para concluir o pedido.',
                    };
                }

                if (!resolvedCategoryPublicId) {
                    return {
                        created: false,
                        message: 'Nao encontrei categoria financeira de receita para concluir o pedido.',
                    };
                }

                const customerPublicId = await this.resolveCustomerPublicIdByPhone(scope.companyId, contactPhone);
                const scopeContactKey = this.buildAutoReplyScopeContactKey(scope, contactPhone);

                this.pendingOrderDraftByScopeContact.set(scopeContactKey, {
                    userPublicId: resolvedUserPublicId,
                    customerPublicId,
                    bankAccountPublicId: resolvedBankAccountPublicId,
                    categoryPublicId: resolvedCategoryPublicId,
                    items: [],
                    totalAmount: 0,
                    awaitingConfirmation: false,
                    createdAt: Date.now(),
                });

                return {
                    created: false,
                    message: [
                        'Pedido iniciado. Envie os itens agora.',
                        'Exemplo:',
                        'Arroz - 2',
                        'Feijao - 1',
                        '',
                        'Quando terminar, responda TOTAL.',
                    ].join('\n'),
                };
            }

            return {
                created: false,
                message: [
                    'Para criar pedido, envie os itens neste formato:',
                    'Arroz - 2',
                    'Feijao - 1',
                    '',
                    'Exemplo completo:',
                    'PEDIDO',
                    'Arroz - 2',
                    'Feijao - 1',
                    '',
                    'Depois eu mostro o total e para finalizar voce responde: TOTAL.',
                ].join('\n'),
            };
        }

        const [resolvedUserPublicId, resolvedBankAccountPublicId, resolvedCategoryPublicId] = existingDraft
            ? [existingDraft.userPublicId, existingDraft.bankAccountPublicId, existingDraft.categoryPublicId]
            : await Promise.all([
                this.resolveUserPublicIdForOrder(scope),
                this.resolveDefaultBankAccountPublicId(scope.companyId),
                this.resolveDefaultIncomeCategoryPublicId(scope.companyId),
            ]);

        const userPublicId = resolvedUserPublicId;
        const bankAccountPublicId = resolvedBankAccountPublicId;
        const categoryPublicId = resolvedCategoryPublicId;

        if (!userPublicId) {
            return {
                created: false,
                message: 'Nao consegui identificar o usuario responsavel para registrar esse pedido no sistema.',
            };
        }

        if (!bankAccountPublicId) {
            return {
                created: false,
                message: 'Nao encontrei conta bancaria cadastrada para concluir o pedido.',
            };
        }

        if (!categoryPublicId) {
            return {
                created: false,
                message: 'Nao encontrei categoria financeira de receita para concluir o pedido.',
            };
        }

        const orderItemsByProduct = new Map<string, { product_public_id: string; quantity: number; unit_price: number; product_name: string }>();
        const missingProducts = new Set<string>();
        let hasDefaultQuantityItems = false;

        if (existingDraft?.items?.length) {
            for (const existingItem of existingDraft.items) {
                orderItemsByProduct.set(existingItem.product_public_id, {
                    product_public_id: existingItem.product_public_id,
                    quantity: existingItem.quantity,
                    unit_price: existingItem.unit_price,
                    product_name: existingItem.product_name,
                });
            }
        }

        const uniqueProductNames = Array.from(new Set(parsedItems.map((item) => String(item.productName || '').trim()).filter(Boolean)));
        const resolvedProducts = await Promise.all(
            uniqueProductNames.map(async (productName) => ({
                key: this.normalizeTextForAutoReplyCheck(productName),
                product: await this.resolveProductForOrderItem(scope.companyId, productName),
            }))
        );
        const productByName = new Map<string, { public_id: string; name: string; selling_price: number } | null>(
            resolvedProducts.map((entry) => [entry.key, entry.product])
        );

        for (const item of parsedItems) {
            const productKey = this.normalizeTextForAutoReplyCheck(item.productName);
            const resolvedProduct = productByName.get(productKey) || null;
            if (!resolvedProduct) {
                missingProducts.add(item.productName);
                continue;
            }

            const unitPrice = Number.isFinite(resolvedProduct.selling_price) ? resolvedProduct.selling_price : 0;
            const existingItem = orderItemsByProduct.get(resolvedProduct.public_id);

            if (existingItem) {
                existingItem.quantity += item.quantity;
            } else {
                orderItemsByProduct.set(resolvedProduct.public_id, {
                    product_public_id: resolvedProduct.public_id,
                    quantity: item.quantity,
                    unit_price: unitPrice,
                    product_name: resolvedProduct.name,
                });
            }

            if (item.usedDefaultQuantity) {
                hasDefaultQuantityItems = true;
            }
        }

        const orderItems = Array.from(orderItemsByProduct.values());

        if (missingProducts.size > 0) {
            return {
                created: false,
                message: `Nao encontrei este(s) produto(s): ${Array.from(missingProducts).join(', ')}.\nEnvie novamente com o nome como esta no cadastro.`,
            };
        }

        if (orderItems.length === 0) {
            return {
                created: false,
                message: 'Nao foi possivel montar os itens do pedido. Confira o formato e tente novamente.',
            };
        }

        const customerPublicId = existingDraft
            ? existingDraft.customerPublicId
            : await this.resolveCustomerPublicIdByPhone(scope.companyId, contactPhone);
        const totalAmount = orderItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

        const scopeContactKey = this.buildAutoReplyScopeContactKey(scope, contactPhone);
        this.pendingOrderDraftByScopeContact.set(scopeContactKey, {
            userPublicId,
            customerPublicId,
            bankAccountPublicId,
            categoryPublicId,
            items: orderItems,
            totalAmount,
            awaitingConfirmation: false,
            createdAt: Date.now(),
        });

        const summaryLines = orderItems.map((item, index) => {
            const subtotal = item.quantity * item.unit_price;
            return `${index + 1}. ${item.product_name} - qtd ${item.quantity} x ${this.formatCurrencyBr(item.unit_price)} = ${this.formatCurrencyBr(subtotal)}`;
        });

        return {
            created: false,
            message: [
                'Item(ns) adicionado(s) ao pedido.',
                ...summaryLines,
                ...(hasDefaultQuantityItems ? ['Obs.: itens sem quantidade informada foram adicionados com qtd 1.'] : []),
                'Envie mais itens ou responda TOTAL para fechar o resumo.',
            ].join('\n'),
        };
    }

    private static getPendingOrderDraft(scope: SessionScopeContext, contactPhone: string): PendingOrderDraft | null {
        const scopeContactKey = this.buildAutoReplyScopeContactKey(scope, contactPhone);
        const draft = this.pendingOrderDraftByScopeContact.get(scopeContactKey) || null;
        if (!draft) {
            return null;
        }

        if (Date.now() - draft.createdAt > this.pendingOrderDraftTtlMs) {
            this.pendingOrderDraftByScopeContact.delete(scopeContactKey);
            return null;
        }

        return draft;
    }

    private static clearPendingOrderDraft(scope: SessionScopeContext, contactPhone: string): void {
        const scopeContactKey = this.buildAutoReplyScopeContactKey(scope, contactPhone);
        this.pendingOrderDraftByScopeContact.delete(scopeContactKey);
    }

    private static async finalizePendingOrderDraft(scope: SessionScopeContext, contactPhone: string, draft: PendingOrderDraft): Promise<InboundOrderFinalizeResult> {
        const createdOrder = await OrderService.createSalesOrder(scope.companyId, draft.userPublicId, {
            customer_public_id: draft.customerPublicId,
            bank_account_public_id: draft.bankAccountPublicId,
            category_public_id: draft.categoryPublicId,
            date: new Date().toISOString(),
            items: draft.items.map((item) => ({
                product_public_id: item.product_public_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
            })),
        });

        this.clearPendingOrderDraft(scope, contactPhone);

        const summaryLines = draft.items.map((item, index) => {
            const subtotal = item.quantity * item.unit_price;
            return `${index + 1}. ${item.product_name} - qtd ${item.quantity} x ${this.formatCurrencyBr(item.unit_price)} = ${this.formatCurrencyBr(subtotal)}`;
        });

        let attachment: WhatsAppBusinessAttachmentInput | null = null;
        try {
            attachment = this.buildSalesOrderPdfAttachment(createdOrder.id, draft.totalAmount, draft.items);
        } catch (error: unknown) {
            logger.warn(
                {
                    err: error,
                    scope: this.buildRecordMapKey(scope),
                    contactPhone,
                    createdOrderId: createdOrder.id,
                },
                '[whatsappBusinessService] Falha ao montar PDF do pedido'
            );
        }

        return {
            message: [
                'Pedido criado com sucesso!',
                `Numero: ${createdOrder.id}`,
                `Total: ${this.formatCurrencyBr(draft.totalAmount)}`,
                ...summaryLines,
            ].join('\n'),
            attachment,
        };
    }

    private static async hasProductsStatusColumn(): Promise<boolean> {
        if (typeof this.productsStatusColumnAvailable === 'boolean') {
            return this.productsStatusColumnAvailable;
        }

        try {
            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT 1
                 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE()
                   AND TABLE_NAME = 'products'
                   AND COLUMN_NAME = 'status'
                 LIMIT 1`
            );

            this.productsStatusColumnAvailable = rows.length > 0;
        } catch {
            this.productsStatusColumnAvailable = false;
        }

        return this.productsStatusColumnAvailable;
    }

    private static async findCatalogProductsByInboundText(companyId: number, inboundText: string): Promise<AutoReplyProductMatch[]> {
        if (this.isCatalogInquiry(inboundText)) {
            const [catalogRows] = await pool.query<RowDataPacket[]>(
                `SELECT p.name, p.description, p.selling_price, p.current_stock, me.abbreviation AS measure_abbreviation
                 FROM products p
                 LEFT JOIN measures me ON me.id = p.measure_id
                 WHERE p.company_id = ?
                 ORDER BY p.name ASC`,
                [companyId]
            );

            return catalogRows as AutoReplyProductMatch[];
        }

        if (this.isBeerInquiry(inboundText)) {
            const hasStatusColumn = await this.hasProductsStatusColumn();
            const beerFilter = hasStatusColumn
                ? `LOWER(COALESCE(p.status, '')) = 'active'`
                : `p.current_stock > 0`;

            const [beerRows] = await pool.query<RowDataPacket[]>(
                `SELECT p.name, p.description, p.selling_price, p.current_stock, me.abbreviation AS measure_abbreviation
                 FROM products p
                 LEFT JOIN measures me ON me.id = p.measure_id
                 WHERE p.company_id = ?
                   AND ${beerFilter}
                   AND (LOWER(p.name) LIKE ? OR LOWER(COALESCE(p.description, "")) LIKE ?)
                 ORDER BY p.name ASC`,
                [companyId, '%cerveja%', '%cerveja%']
            );

            return beerRows as AutoReplyProductMatch[];
        }

        const terms = this.extractProductLookupTerms(inboundText);
        if (terms.length === 0) {
            return [];
        }

        const whereClause = terms
            .map(() => '(LOWER(p.name) LIKE ? OR LOWER(COALESCE(p.description, \"\")) LIKE ?)')
            .join(' AND ');

        const queryParams: Array<string | number> = [companyId];
        terms.forEach((term) => {
            const like = `%${term}%`;
            queryParams.push(like, like);
        });

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT p.name, p.description, p.selling_price, p.current_stock, me.abbreviation AS measure_abbreviation
             FROM products p
             LEFT JOIN measures me ON me.id = p.measure_id
             WHERE p.company_id = ?
               AND ${whereClause}
             ORDER BY p.current_stock DESC, p.name ASC
             LIMIT 8`,
            queryParams
        );

        return rows as AutoReplyProductMatch[];
    }

    private static buildInboundAutoReplyMessageFromCatalog(inboundText: string, products: AutoReplyProductMatch[]): string {
        const greeting = this.buildGreetingByHour();
        if (this.isBeerInquiry(inboundText)) {
            if (!products.length) {
                return `${greeting}! No momento nao encontrei cervejas ativas no cadastro.`;
            }

            const header = `${greeting}! Seguem as cervejas ativas no cadastro:`;
            const lines = products.map((product, index) => {
                const priceText = this.formatCurrencyBr(product.selling_price);
                return `${index + 1}. ${product.name} - ${priceText}`;
            });

            return [
                header,
                ...lines,
            ].join('\n');
        }

        if (!products.length) {
            return `${greeting}! Recebi sua mensagem sobre "${String(inboundText || '').trim()}".\nNo momento nao encontrei item com esse nome/descricao no cadastro.\nSe puder, me envie mais detalhes do produto (nome completo, marca ou tipo).`;
        }

        const header = `${greeting}! Encontrei ${products.length} item(ns) no cadastro para "${String(inboundText || '').trim()}":`;
        const lines = products.map((product, index) => {
            const priceText = this.formatCurrencyBr(product.selling_price);
            return `${index + 1}. ${product.name} - ${priceText}`;
        });

        return [
            header,
            ...lines,
        ].join('\n');
    }

    private static resolveInboundContactPhoneFromMessage(message: WhatsAppMessage): string | null {
        const inboundPhoneCandidates = [
            (message as { from?: string | null }).from || null,
            (message as { author?: string | null }).author || null,
            (message as { id?: { remote?: string | null } })?.id?.remote || null,
        ];

        return inboundPhoneCandidates
            .map((candidate) => WhatsAppBusinessMessageService.normalizeContactPhone(String(candidate || '')))
            .find((candidate) => !!candidate) || null;
    }

    private static resolveInboundReplyChatId(message: WhatsAppMessage): string | null {
        const chatIdCandidates = [
            (message as { from?: string | null }).from || null,
            (message as { id?: { remote?: string | null } })?.id?.remote || null,
            (message as { author?: string | null }).author || null,
        ];

        const personalChatId = chatIdCandidates
            .map((candidate) => String(candidate || '').trim())
            .find((candidate) => this.isPersonalChat(candidate));

        if (!personalChatId) {
            return null;
        }

        // Contatos @lid falham quando forca envio para @c.us.
        return personalChatId.toLowerCase().endsWith('@lid') ? personalChatId : null;
    }

    private static buildAutoReplyScopeContactKey(scope: SessionScopeContext, contactPhone: string): string {
        return `${this.buildRecordMapKey(scope)}:${contactPhone}`;
    }

    private static async resolveUserAutoReplyMode(scope: SessionScopeContext): Promise<'automatic' | 'manual'> {
        if (scope.ownerType !== 'user') {
            return 'automatic';
        }

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT whatsapp_auto_reply_mode
             FROM users
             WHERE id = ?
               AND company_id = ?
             LIMIT 1`,
            [scope.ownerId, scope.companyId]
        );

        const mode = String(rows[0]?.whatsapp_auto_reply_mode || '').trim().toLowerCase();
        return mode === 'manual' ? 'manual' : 'automatic';
    }

    private static markAutoReplySent(scope: SessionScopeContext, contactPhone: string): void {
        const scopeContactKey = this.buildAutoReplyScopeContactKey(scope, contactPhone);
        this.autoReplyLastSentByScopeContact.set(scopeContactKey, Date.now());
    }

    private static async maybeSendAutoReplyForInbound(record: SessionRecord, message: WhatsAppMessage): Promise<void> {
        if (message.fromMe) {
            logger.info(
                {
                    scope: this.buildRecordMapKey(record.scope),
                    messageId: message.id?._serialized || null,
                    decision: 'ignored',
                    reason: 'from_me',
                },
                '[whatsappBusinessService] Auto-resposta ignorada'
            );
            return;
        }

        const messageType = String(message.type || '').trim().toLowerCase();
        if (messageType && messageType !== 'chat') {
            logger.info(
                {
                    scope: this.buildRecordMapKey(record.scope),
                    messageId: message.id?._serialized || null,
                    messageType,
                    decision: 'ignored',
                    reason: 'unsupported_type',
                },
                '[whatsappBusinessService] Auto-resposta ignorada'
            );
            return;
        }

        const inboundText = this.buildMessageText(message);
        const contactPhone = this.resolveInboundContactPhoneFromMessage(message);
        if (!contactPhone) {
            logger.info(
                {
                    scope: this.buildRecordMapKey(record.scope),
                    messageId: message.id?._serialized || null,
                    messageType,
                    inboundText,
                    decision: 'ignored',
                    reason: 'contact_phone_not_resolved',
                },
                '[whatsappBusinessService] Auto-resposta ignorada'
            );
            return;
        }

        let scopedContactPhone = contactPhone;
        try {
            const notifyName = String((message as { notifyName?: string | null })?.notifyName || '').trim() || null;
            const reconciledPhone = await this.resolveScopedPhoneAliasFromHistory(
                record.scope,
                contactPhone,
                null,
                message.from || null,
                notifyName
            );

            if (reconciledPhone) {
                scopedContactPhone = reconciledPhone;
            }
        } catch (error: unknown) {
            logger.warn(
                {
                    err: error,
                    scope: this.buildRecordMapKey(record.scope),
                    originalContactPhone: contactPhone,
                    chatId: message.from || null,
                },
                '[whatsappBusinessService] Falha ao reconciliar contato para auto-resposta'
            );
        }

        const pendingOrderDraft = this.getPendingOrderDraft(record.scope, scopedContactPhone);
        const hasPendingOrderInteraction = !!pendingOrderDraft
            && (
                this.isOrderConfirmation(inboundText)
                || this.isOrderTotalInquiry(inboundText)
                || this.isOrderConfirmOption(inboundText)
                || this.isOrderCancelOption(inboundText)
            );
        if (!hasPendingOrderInteraction && !this.shouldTriggerAutoReplyFromInboundText(inboundText)) {
            logger.info(
                {
                    scope: this.buildRecordMapKey(record.scope),
                    messageId: message.id?._serialized || null,
                    messageType,
                    inboundText,
                    decision: 'ignored',
                    reason: 'trigger_not_matched',
                },
                '[whatsappBusinessService] Auto-resposta ignorada'
            );
            return;
        }

        const autoReplyMode = await this.resolveUserAutoReplyMode(record.scope);
        if (autoReplyMode === 'manual') {
            logger.info(
                {
                    scope: this.buildRecordMapKey(record.scope),
                    messageId: message.id?._serialized || null,
                    messageType,
                    inboundText,
                    decision: 'ignored',
                    reason: 'manual_mode',
                },
                '[whatsappBusinessService] Auto-resposta ignorada'
            );
            return;
        }

        const replyChatId = this.resolveInboundReplyChatId(message);
        const contactData = await this.resolveScopedContactData(message, 'inbound', message.from || null, scopedContactPhone);
        const contactName = contactData.contactName;

        // Nao bloqueia autoatendimento por cooldown para evitar perda de resposta em sequencia.

        let autoReplyMessage = this.buildInboundAutoReplyMessage(contactName);
        let autoReplyType: 'saudacao_inicial' | 'catalogo' | 'pedido' = 'saudacao_inicial';
        let autoReplyAttachment: WhatsAppBusinessAttachmentInput | null = null;

        if (pendingOrderDraft && this.isOrderConfirmOption(inboundText)) {
            if (!pendingOrderDraft.awaitingConfirmation) {
                autoReplyMessage = 'Antes de confirmar, responda TOTAL para eu mostrar o resumo final com as opcoes.';
                autoReplyType = 'pedido';
            } else {
                try {
                    const finalizeResult = await this.finalizePendingOrderDraft(record.scope, scopedContactPhone, pendingOrderDraft);
                    autoReplyMessage = finalizeResult.message;
                    autoReplyAttachment = finalizeResult.attachment;
                    autoReplyType = 'pedido';
                } catch (error: unknown) {
                    logger.warn(
                        {
                            err: error,
                            scope: this.buildRecordMapKey(record.scope),
                            inboundText,
                            contactPhone,
                        },
                        '[whatsappBusinessService] Falha ao finalizar pedido via WhatsApp'
                    );

                    autoReplyMessage = 'Nao consegui finalizar seu pedido agora. Tente novamente em instantes.';
                    autoReplyType = 'pedido';
                }
            }
        } else if (pendingOrderDraft && this.isOrderCancelOption(inboundText)) {
            this.clearPendingOrderDraft(record.scope, scopedContactPhone);
            autoReplyMessage = 'Pedido cancelado com sucesso. Quando quiser, envie um novo pedido.';
            autoReplyType = 'pedido';
        } else if (pendingOrderDraft && this.parseInboundOrderItems(inboundText).length > 0) {
            try {
                const orderResult = await this.tryCreateSalesOrderFromInbound(record.scope, inboundText, scopedContactPhone, pendingOrderDraft);
                autoReplyMessage = orderResult.message;
                autoReplyType = 'pedido';
            } catch (error: unknown) {
                logger.warn(
                    {
                        err: error,
                        scope: this.buildRecordMapKey(record.scope),
                        inboundText,
                        contactPhone,
                    },
                    '[whatsappBusinessService] Falha ao adicionar itens ao pedido via WhatsApp'
                );

                autoReplyMessage = 'Nao consegui adicionar os itens agora. Tente novamente em instantes.';
                autoReplyType = 'pedido';
            }
        } else if (pendingOrderDraft && this.isOrderTotalInquiry(inboundText)) {
            pendingOrderDraft.awaitingConfirmation = true;
            const scopeContactKey = this.buildAutoReplyScopeContactKey(record.scope, contactPhone);
            this.pendingOrderDraftByScopeContact.set(scopeContactKey, pendingOrderDraft);

            const previewLines = pendingOrderDraft.items.map((item, index) => {
                const subtotal = item.quantity * item.unit_price;
                return `${index + 1}. ${item.product_name} - qtd ${item.quantity} x ${this.formatCurrencyBr(item.unit_price)} = ${this.formatCurrencyBr(subtotal)}`;
            });
            autoReplyMessage = [
                'Pedido montado com sucesso!',
                'Resumo completo do pedido:',
                ...previewLines,
                `Total atual do pedido: ${this.formatCurrencyBr(pendingOrderDraft.totalAmount)}`,
                '1 - Confirma',
                '2 - Cancelar',
            ].join('\n');
            autoReplyType = 'pedido';
        } else if (pendingOrderDraft && this.isOrderConfirmation(inboundText)) {
            try {
                const previewLines = pendingOrderDraft.items.map((item, index) => {
                    const subtotal = item.quantity * item.unit_price;
                    return `${index + 1}. ${item.product_name} - qtd ${item.quantity} x ${this.formatCurrencyBr(item.unit_price)} = ${this.formatCurrencyBr(subtotal)}`;
                });
                autoReplyMessage = [
                    ...previewLines,
                    'Para ver o total e finalizar, responda TOTAL.',
                ].join('\n');
                autoReplyType = 'pedido';
            } catch {
                autoReplyMessage = 'Para finalizar, responda TOTAL.';
                autoReplyType = 'pedido';
            }
        } else if (this.isOrderStartCommand(inboundText)) {
            try {
                const orderResult = await this.tryCreateSalesOrderFromInbound(record.scope, inboundText, scopedContactPhone, pendingOrderDraft);
                autoReplyMessage = orderResult.message;
                autoReplyType = 'pedido';
            } catch (error: unknown) {
                logger.warn(
                    {
                        err: error,
                        scope: this.buildRecordMapKey(record.scope),
                        inboundText,
                        contactPhone,
                    },
                    '[whatsappBusinessService] Falha ao criar pedido via WhatsApp'
                );

                autoReplyMessage = 'Nao consegui criar seu pedido agora. Tente novamente em instantes.';
                autoReplyType = 'pedido';
            }
        } else if (this.shouldLookupProductsForInboundText(inboundText)) {
            try {
                const matchedProducts = await this.findCatalogProductsByInboundText(record.scope.companyId, inboundText);
                autoReplyMessage = this.buildInboundAutoReplyMessageFromCatalog(inboundText, matchedProducts);
                autoReplyType = 'catalogo';
            } catch (error: unknown) {
                logger.warn(
                    {
                        err: error,
                        scope: this.buildRecordMapKey(record.scope),
                        inboundText,
                    },
                    '[whatsappBusinessService] Falha ao consultar produtos para auto-resposta'
                );
            }
        } else if (!pendingOrderDraft && this.parseInboundOrderItems(inboundText).length > 0) {
            autoReplyMessage = 'Para iniciar o pedido, digite PEDIDO primeiro. Depois envie os itens.';
            autoReplyType = 'pedido';
        }

        await this.sendScopedMessage(record.scope, {
            to: scopedContactPhone,
            ...(replyChatId ? { toChatId: replyChatId } : {}),
            messageBody: autoReplyMessage,
            attachment: autoReplyAttachment,
        });
        this.markAutoReplySent(record.scope, scopedContactPhone);

        logger.info(
            {
                scope: this.buildRecordMapKey(record.scope),
                messageId: message.id?._serialized || null,
                contactPhone: scopedContactPhone,
                originalContactPhone: contactPhone,
                triggerText: inboundText,
                decision: 'sent',
                reason: 'trigger_matched',
                autoReplyType,
            },
            '[whatsappBusinessService] Auto-resposta enviada'
        );
    }

    private static shouldProcessInboundMessage(scope: SessionScopeContext, message: WhatsAppMessage): boolean {
        const messageId = String(message.id?._serialized || '').trim();
        if (!messageId) {
            return true;
        }

        const scopeKey = this.buildRecordMapKey(scope);
        let sessionMap = this.processedInboundMessageIds.get(scopeKey);
        if (!sessionMap) {
            sessionMap = new Map<string, number>();
            this.processedInboundMessageIds.set(scopeKey, sessionMap);
        }

        const now = Date.now();

        for (const [id, timestamp] of sessionMap.entries()) {
            if (now - timestamp > this.inboundDedupWindowMs) {
                sessionMap.delete(id);
            }
        }

        const existingTimestamp = sessionMap.get(messageId);
        if (existingTimestamp && now - existingTimestamp <= this.inboundDedupWindowMs) {
            return false;
        }

        sessionMap.set(messageId, now);
        return true;
    }

    private static async handleInboundMessage(record: SessionRecord, message: WhatsAppMessage): Promise<void> {
        if (!this.shouldProcessInboundMessage(record.scope, message)) {
            return;
        }

        await this.persistScopedMessage(record.scope, message, 'inbound');

        try {
            await this.maybeSendAutoReplyForInbound(record, message);
        } catch (error: unknown) {
            logger.error(
                {
                    err: error,
                    scope: this.buildRecordMapKey(record.scope),
                    messageId: message.id?._serialized || null,
                },
                '[whatsappBusinessService] Falha ao processar auto-resposta inbound'
            );
        }
    }

    private static isBrowserAlreadyRunningError(error: unknown): boolean {
        const message = error instanceof Error ? error.message : String(error || '');
        return message.includes('The browser is already running for');
    }

    private static isKnownChatHistoryFetchError(error: unknown): boolean {
        const message = String(error instanceof Error ? error.message : error || '').toLowerCase();
        return message.includes('waitforchatloading')
            || message.includes('execution context was destroyed')
            || message.includes('attempted to use detached frame');
    }

    private static async getWhatsAppModule(): Promise<WhatsAppModule> {
        if (!whatsappModulePromise) {
            whatsappModulePromise = import('whatsapp-web.js');
        }

        return whatsappModulePromise;
    }

    private static async getWhatsAppExports(): Promise<WhatsAppModule> {
        const module = await this.getWhatsAppModule() as WhatsAppRuntimeExports;
        return (module.default && typeof module.default === 'object'
            ? { ...module.default, ...module }
            : module) as WhatsAppModule;
    }

    private static async saveMediaToDisk(base64Data: string, fileName: string): Promise<string> {
        if (!fs.existsSync(UPLOADS_DIR)) {
            await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
        }
        const ext = path.extname(fileName) || '';
        const name = path.basename(fileName, ext).replace(/[^a-zA-Z0-9]/g, '_');
        const uniqueFileName = `${name}_${Date.now()}${ext}`;
        const filePath = path.join(UPLOADS_DIR, uniqueFileName);
        await fs.promises.writeFile(filePath, Buffer.from(base64Data, 'base64'));
        return `/uploads/whatsapp/${uniqueFileName}`;
    }

    private static buildCompanyScope(companyId: number | string): SessionScopeContext {
        const companyIdNumber = Number(companyId);
        const companyKey = String(companyId);

        return {
            companyId: companyIdNumber,
            ownerType: 'company',
            ownerId: companyIdNumber,
            companyKey,
            ownerKey: `company_${companyKey}`,
            sessionKey: `company_${companyKey}`,
        };
    }

    private static buildUserScope(companyId: number | string, userId: number | string): SessionScopeContext {
        const companyKey = String(companyId);
        const userKey = String(userId);

        return {
            companyId: Number(companyId),
            ownerType: 'user',
            ownerId: Number(userId),
            companyKey,
            ownerKey: `user_${userKey}`,
            sessionKey: `company_${companyKey}_user_${userKey}`,
        };
    }

    private static buildRecordMapKey(scope: SessionScopeContext): string {
        return `${scope.ownerType}:${scope.companyId}:${scope.ownerId}`;
    }

    private static translateAckStatus(ack: number | null | undefined): string | null {
        switch (ack) {
        case -1:
            return 'error';
        case 0:
            return 'pending';
        case 1:
            return 'sent';
        case 2:
            return 'received';
        case 3:
            return 'read';
        case 4:
            return 'played';
        default:
            return null;
        }
    }

    private static isPersonalChat(chatId: string | null | undefined): boolean {
        if (typeof chatId !== 'string') {
            return false;
        }

        const normalizedChatId = chatId.trim().toLowerCase();
        if (!normalizedChatId) {
            return false;
        }

        if (normalizedChatId.endsWith('@g.us')) {
            return false;
        }

        if (normalizedChatId === 'status@broadcast' || normalizedChatId.endsWith('@broadcast')) {
            return false;
        }

        return normalizedChatId.endsWith('@c.us')
            || normalizedChatId.endsWith('@s.whatsapp.net')
            || normalizedChatId.endsWith('@lid');
    }

    private static extractVCardField(rawText: string, prefix: string): string | null {
        const pattern = new RegExp(`^${prefix}:(.+)$`, 'im');
        const match = rawText.match(pattern);
        return match?.[1]?.trim() || null;
    }

    private static formatPhoneForDisplay(value: string | null | undefined): string | null {
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

    private static formatVCardMessageText(rawText: string): string {
        const normalizedText = String(rawText || '').trim();
        if (!normalizedText) {
            return '[Contato]';
        }

        const fullName = this.extractVCardField(normalizedText, 'FN');
        const waidMatch = normalizedText.match(/waid=(\d{8,20})/i);
        const telMatch = normalizedText.match(/^item\d+\.TEL[^:]*:(.+)$/im) || normalizedText.match(/^TEL[^:]*:(.+)$/im);
        const phone = this.formatPhoneForDisplay(waidMatch?.[1] || telMatch?.[1] || '');

        const lines = ['[Contato compartilhado]'];
        if (fullName) {
            lines.push(fullName);
        }
        if (phone) {
            lines.push(phone);
        }

        return lines.join('\n');
    }

    private static parseLocationCoordinate(value: unknown, min: number, max: number): number | null {
        const normalized = Number(value);
        if (!Number.isFinite(normalized)) {
            return null;
        }

        if (normalized < min || normalized > max) {
            return null;
        }

        return normalized;
    }

    private static extractCoordinatesFromText(rawText: string): { latitude: number | null; longitude: number | null; } {
        const normalized = String(rawText || '');
        if (!normalized) {
            return { latitude: null, longitude: null };
        }

        const directPairMatch = normalized.match(/(-?\d{1,3}\.\d+)\s*[,;]\s*(-?\d{1,3}\.\d+)/);
        if (directPairMatch) {
            return {
                latitude: this.parseLocationCoordinate(directPairMatch[1], -90, 90),
                longitude: this.parseLocationCoordinate(directPairMatch[2], -180, 180),
            };
        }

        const queryMatch = normalized.match(/[?&](?:q|ll)=(-?\d{1,3}\.\d+)\s*[,;]\s*(-?\d{1,3}\.\d+)/i)
            || normalized.match(/@(-?\d{1,3}\.\d+)\s*[,;]\s*(-?\d{1,3}\.\d+)/i);

        if (!queryMatch) {
            return { latitude: null, longitude: null };
        }

        return {
            latitude: this.parseLocationCoordinate(queryMatch[1], -90, 90),
            longitude: this.parseLocationCoordinate(queryMatch[2], -180, 180),
        };
    }

    private static extractLocationFromMessage(message: WhatsAppMessage): {
        latitude: number | null;
        longitude: number | null;
        name: string | null;
        address: string | null;
        url: string | null;
    } {
        const dynamicMessage = message as WhatsAppMessage & {
            lat?: number | string | null;
            lng?: number | string | null;
            loc?: string | null;
            address?: string | null;
            clientUrl?: string | null;
            body?: string | null;
            location?: {
                latitude?: number | string | null;
                longitude?: number | string | null;
                lat?: number | string | null;
                lng?: number | string | null;
                name?: string | null;
                address?: string | null;
                description?: string | null;
                url?: string | null;
            } | null;
        };

        const location = dynamicMessage.location || null;
        const body = String(dynamicMessage.body || '').trim();
        const fallbackCoordinates = this.extractCoordinatesFromText(body);

        const latitude = this.parseLocationCoordinate(
            location?.latitude ?? location?.lat ?? dynamicMessage.lat ?? fallbackCoordinates.latitude,
            -90,
            90
        );
        const longitude = this.parseLocationCoordinate(
            location?.longitude ?? location?.lng ?? dynamicMessage.lng ?? fallbackCoordinates.longitude,
            -180,
            180
        );

        const name = String(location?.name || dynamicMessage.loc || '').trim() || null;
        const address = String(location?.address || location?.description || dynamicMessage.address || '').trim() || null;
        const url = String(location?.url || dynamicMessage.clientUrl || '').trim() || null;

        return {
            latitude,
            longitude,
            name,
            address,
            url,
        };
    }

    private static buildLocationMessageText(message: WhatsAppMessage): string {
        const body = String(message.body || '').trim();
        const details = this.extractLocationFromMessage(message);
        const lines = ['[Localizacao compartilhada]'];

        if (details.name) {
            lines.push(details.name);
        }

        if (details.address && details.address !== details.name) {
            lines.push(details.address);
        }

        if (details.latitude !== null && details.longitude !== null) {
            lines.push(`Lat: ${details.latitude.toFixed(6)} | Lng: ${details.longitude.toFixed(6)}`);
        }

        if (details.url) {
            lines.push(details.url);
        } else if (details.latitude !== null && details.longitude !== null) {
            lines.push(`https://maps.google.com/?q=${details.latitude},${details.longitude}`);
        } else if (body && /^https?:\/\//i.test(body)) {
            lines.push(body);
        }

        if (lines.length === 1 && body) {
            lines.push(body);
        }

        return lines.join('\n');
    }

    private static buildMessageText(message: WhatsAppMessage): string {
        const body = String(message.body || '').trim();
        const isVCardMessage = message.type === 'vcard' || body.toUpperCase().startsWith('BEGIN:VCARD');

        if (message.type === 'location') {
            return this.buildLocationMessageText(message);
        }

        if (isVCardMessage) {
            return this.formatVCardMessageText(body);
        }

        if (body) {
            return body;
        }

        switch (message.type) {
        case 'image':
            return '[Imagem]';
        case 'video':
            return '[Video]';
        case 'audio':
        case 'ptt':
            return '[Audio]';
        case 'document':
            return '[Documento]';
        case 'sticker':
            return '[Sticker]';
        case 'vcard':
            return '[Contato]';
        default:
            return `[${String(message.type || 'mensagem')}]`;
        }
    }

    private static buildRawPayload(message: WhatsAppMessage): string | null {
        try {
            const location = this.extractLocationFromMessage(message);
            return JSON.stringify({
                id: message.id?._serialized || null,
                from: message.from || null,
                to: message.to || null,
                fromMe: !!message.fromMe,
                body: message.body || null,
                type: message.type || null,
                timestamp: typeof message.timestamp === 'number' ? message.timestamp : null,
                ack: typeof message.ack === 'number' ? message.ack : null,
                location: {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    name: location.name,
                    address: location.address,
                    url: location.url,
                },
            });
        } catch (_error) {
            return null;
        }
    }

    private static async buildMessageMedia(attachment: WhatsAppBusinessAttachmentInput) {
        const mimeType = String(attachment.mimeType || '').trim();
        const fileName = String(attachment.fileName || '').trim();
        const base64 = String(attachment.base64 || '').trim();

        if (!mimeType) {
            const error = new Error('Tipo do arquivo nao informado para o envio do WhatsApp Business.');
            (error as Error & { statusCode?: number }).statusCode = 400;
            throw error;
        }

        if (!fileName) {
            const error = new Error('Nome do arquivo nao informado para o envio do WhatsApp Business.');
            (error as Error & { statusCode?: number }).statusCode = 400;
            throw error;
        }

        if (!base64) {
            const error = new Error('Conteudo do arquivo nao informado para o envio do WhatsApp Business.');
            (error as Error & { statusCode?: number }).statusCode = 400;
            throw error;
        }

        const { MessageMedia } = await this.getWhatsAppExports();
        return new MessageMedia(mimeType, base64, fileName);
    }

    private static shouldPersistInlineMedia(messageType: string | null | undefined, mimeType: string | null | undefined): boolean {
        const normalizedMessageType = String(messageType || '').trim().toLowerCase();
        const normalizedMimeType = String(mimeType || '').trim().toLowerCase();

        return normalizedMessageType === 'image'
            || normalizedMessageType === 'audio'
            || normalizedMessageType === 'ptt'
            || normalizedMimeType.startsWith('image/')
            || normalizedMimeType.startsWith('audio/')
            || normalizedMimeType === 'application/pdf';
    }

    private static async extractScopedMediaPayload(
        message: WhatsAppMessage,
        preferredAttachment?: WhatsAppBusinessAttachmentInput | null
    ): Promise<WhatsAppBusinessStoredMedia> {
        if (preferredAttachment) {
            const normalizedMimeType = String(preferredAttachment.mimeType || '').trim() || null;
            const normalizedFileName = String(preferredAttachment.fileName || '').trim() || null;
            const normalizedBase64 = this.shouldPersistInlineMedia(null, preferredAttachment.mimeType)
                ? String(preferredAttachment.base64 || '').trim() || null
                : null;

            if (normalizedMimeType?.toLowerCase().startsWith('audio/') && normalizedBase64) {
                return this.transcodeAudioForPlayback(normalizedMimeType, normalizedFileName, normalizedBase64);
            }

            let mediaUrl = null;
            if (normalizedBase64 && normalizedFileName) {
                 mediaUrl = await this.saveMediaToDisk(normalizedBase64, normalizedFileName);
            }
            return {
                mediaMimeType: normalizedMimeType,
                mediaFileName: normalizedFileName,
                mediaUrl,
            };
        }

        if (!message.hasMedia || typeof message.downloadMedia !== 'function') {
            return {
                mediaMimeType: null,
                mediaFileName: null,
                mediaUrl: null,
            };
        }

        try {
            const media = await message.downloadMedia();
            if (!media) {
                return {
                    mediaMimeType: null,
                    mediaFileName: null,
                    mediaUrl: null,
                };
            }

            const mediaMimeType = String(media.mimetype || '').trim() || null;
            const mediaFileName = String(media.filename || '').trim() || null;
            const mediaBase64 = this.shouldPersistInlineMedia(message.type || null, mediaMimeType)
                ? String(media.data || '').trim() || null
                : null;

            if (mediaMimeType?.toLowerCase().startsWith('audio/') && mediaBase64) {
                return this.transcodeAudioForPlayback(mediaMimeType, mediaFileName, mediaBase64);
            }

            let mediaUrl = null;
            if (mediaBase64 && (mediaFileName || mediaMimeType)) {
                 const name = mediaFileName || `media_${message.id?._serialized || Date.now()}.${mediaMimeType?.split('/')[1] || 'bin'}`;
                 mediaUrl = await this.saveMediaToDisk(mediaBase64, name);
            }
            return {
                mediaMimeType,
                mediaFileName,
                mediaUrl,
            };
        } catch (error: unknown) {
            logger.warn(
                { err: error, messageId: message.id?._serialized || null, messageType: message.type || null },
                '[whatsappBusinessService] Falha ao extrair midia da mensagem'
            );
            return {
                mediaMimeType: null,
                mediaFileName: null,
                mediaUrl: null,
            };
        }
    }

    private static buildAudioOutputFileName(fileName: string | null | undefined): string {
        const normalizedFileName = String(fileName || '').trim();
        if (!normalizedFileName) {
            return 'audio.mp3';
        }

        const extension = path.extname(normalizedFileName);
        if (!extension) {
            return `${normalizedFileName}.mp3`;
        }

        return `${normalizedFileName.slice(0, -extension.length)}.mp3`;
    }

    private static async transcodeAudioForPlayback(
        mediaMimeType: string | null | undefined,
        mediaFileName: string | null | undefined,
        mediaBase64: string | null | undefined
    ): Promise<WhatsAppBusinessStoredMedia> {
        const normalizedMimeType = String(mediaMimeType || '').trim() || null;
        const normalizedBase64 = String(mediaBase64 || '').trim() || null;
        const normalizedFileName = String(mediaFileName || '').trim() || null;

        if (!normalizedMimeType || !normalizedBase64) {
            return {
                mediaMimeType: normalizedMimeType,
                mediaFileName: normalizedFileName,
                mediaUrl: null,
            };
        }

        if (process.env.NODE_ENV === 'test' || !ffmpegPath) {
            const mediaUrl = normalizedBase64 ? await this.saveMediaToDisk(normalizedBase64, normalizedFileName || 'audio.ogg') : null;
            return {
                mediaMimeType: normalizedMimeType,
                mediaFileName: normalizedFileName,
                mediaUrl,
            };
        }

        const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wa-audio-'));
        const inputPath = path.join(tempDir, normalizedFileName || 'audio-input.ogg');
        const outputFileName = this.buildAudioOutputFileName(normalizedFileName);
        const outputPath = path.join(tempDir, outputFileName);

        try {
            await fs.promises.writeFile(inputPath, Buffer.from(normalizedBase64, 'base64'));
            await execFileAsync(ffmpegPath, [
                '-hide_banner',
                '-loglevel',
                'error',
                '-y',
                '-i',
                inputPath,
                '-vn',
                '-codec:a',
                'libmp3lame',
                '-b:a',
                '96k',
                outputPath,
            ]);

            const transcodedBuffer = await fs.promises.readFile(outputPath);
            const mediaUrl = await this.saveMediaToDisk(transcodedBuffer.toString('base64'), outputFileName);
            return {
                mediaMimeType: 'audio/mpeg',
                mediaFileName: outputFileName,
                mediaUrl,
            };
        } catch (error: unknown) {
            logger.warn(
                { err: error, mediaMimeType: normalizedMimeType, mediaFileName: normalizedFileName || null },
                '[whatsappBusinessService] Falha ao converter audio para playback, mantendo original'
            );
            const mediaUrl = normalizedBase64 ? await this.saveMediaToDisk(normalizedBase64, normalizedFileName || 'audio_fallback.ogg') : null;
            return {
                mediaMimeType: normalizedMimeType,
                mediaFileName: normalizedFileName,
                mediaUrl,
            };
        } finally {
            await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
        }
    }

    private static async resolveScopedContactData(
        message: WhatsAppMessage,
        direction: 'inbound' | 'outbound',
        chatId: string | null,
        preferredContactPhone?: string | null
    ): Promise<{ contactPhone: string | null; contactName: string | null; }> {
        const normalizedChatPhone = WhatsAppBusinessMessageService.normalizeContactPhone(chatId || '');
        const normalizedPreferredPhone = WhatsAppBusinessMessageService.normalizeContactPhone(preferredContactPhone || '');

        if (direction === 'outbound') {
            let chatName: string | null = null;

            if (typeof message.getChat === 'function') {
                try {
                    const chat = await message.getChat();
                    chatName = String((chat as { name?: string | null })?.name || '').trim() || null;
                } catch (_error) {
                    chatName = null;
                }
            }

            return {
                contactPhone: normalizedPreferredPhone || normalizedChatPhone || null,
                contactName: chatName,
            };
        }

        const contact = await message.getContact();
        const inboundPhoneCandidates = [
            contact?.number || null,
            (contact as { id?: { user?: string | null; _serialized?: string | null } })?.id?.user || null,
            (contact as { id?: { user?: string | null; _serialized?: string | null } })?.id?._serialized || null,
            (message as { from?: string | null })?.from || null,
            (message as { author?: string | null })?.author || null,
            (message as { id?: { remote?: string | null } })?.id?.remote || null,
            chatId || null,
        ];

        const resolvedInboundPhone = inboundPhoneCandidates
            .map((candidate) => WhatsAppBusinessMessageService.normalizeContactPhone(String(candidate || '')))
            .find((candidate) => !!candidate) || null;

        return {
            contactPhone: resolvedInboundPhone,
            contactName: contact?.pushname || contact?.name || null,
        };
    }

    private static async persistScopedMessage(
        scope: SessionScopeContext,
        message: WhatsAppMessage,
        direction: 'inbound' | 'outbound',
        preferredContactPhone?: string | null,
        preferredAttachment?: WhatsAppBusinessAttachmentInput | null
    ): Promise<void> {
        const chatId = direction === 'inbound' ? message.from || null : message.to || null;
        if (direction === 'inbound' && (message.fromMe || !this.isPersonalChat(chatId))) {
            if (!message.fromMe && !this.isPersonalChat(chatId)) {
                logger.warn(
                    {
                        scope: this.buildRecordMapKey(scope),
                        chatId,
                        messageId: message.id?._serialized || null,
                        messageType: message.type || null,
                    },
                    '[whatsappBusinessService] Mensagem inbound ignorada por nao ser chat pessoal'
                );
            }
            return;
        }

        const { contactPhone, contactName } = await this.resolveScopedContactData(message, direction, chatId, preferredContactPhone);
        const mediaPayload = await this.extractScopedMediaPayload(message, preferredAttachment);
        if (!contactPhone) {
            logger.warn(
                {
                    scope: this.buildRecordMapKey(scope),
                    chatId,
                    messageId: message.id?._serialized || null,
                    messageType: message.type || null,
                    from: message.from || null,
                },
                '[whatsappBusinessService] Mensagem inbound ignorada por falta de telefone do contato'
            );
            return;
        }

        let persistedContactPhone = contactPhone;
        try {
            const notifyName = String((message as { notifyName?: string | null })?.notifyName || '').trim() || null;
            const aliasedPhone = await this.resolveScopedPhoneAliasFromHistory(scope, contactPhone, contactName, chatId, notifyName);
            if (aliasedPhone) {
                if (aliasedPhone !== contactPhone) {
                    logger.info({
                        ownerType: scope.ownerType,
                        ownerId: scope.ownerId,
                        direction,
                        originalContactPhone: contactPhone,
                        persistedContactPhone: aliasedPhone,
                        chatId,
                        contactName,
                        notifyName,
                    }, 'WhatsApp contact_phone reconciliado para alias historico');
                }
                persistedContactPhone = aliasedPhone;
            }

            if (chatId && persistedContactPhone !== contactPhone) {
                await this.upsertScopedPhoneAlias(scope, contactPhone, persistedContactPhone, chatId);
            }
        } catch (error: unknown) {
            logger.warn(
                {
                    err: error,
                    scope: this.buildRecordMapKey(scope),
                    direction,
                    contactPhone,
                    chatId,
                },
                '[whatsappBusinessService] Falha ao reconciliar telefone com historico'
            );
        }

        const payload = {
            direction,
            contact_phone: persistedContactPhone,
            contact_name: contactName,
            chat_id: chatId,
            message_id: message.id?._serialized || null,
            message_type: message.type || 'chat',
            message_text: this.buildMessageText(message),
            media_mime_type: mediaPayload.mediaMimeType,
            media_file_name: mediaPayload.mediaFileName,
            media_url: mediaPayload.mediaUrl,
            status: direction === 'inbound'
                ? 'received'
                : this.translateAckStatus(typeof message.ack === 'number' ? message.ack : null) || 'sent',
            message_timestamp: typeof message.timestamp === 'number' ? message.timestamp : Math.floor(Date.now() / 1000),
            raw_payload: this.buildRawPayload(message),
        };

        logger.info(
            {
                scope: this.buildRecordMapKey(scope),
                direction,
                contactPhone: persistedContactPhone,
                originalContactPhone: contactPhone,
                chatId,
                messageId: message.id?._serialized || null,
                messageType: message.type || null,
            },
            '[whatsappBusinessService] Persistencia de mensagem preparada'
        );

        if (scope.ownerType === 'user') {
            await WhatsAppBusinessMessageService.saveUserMessage(scope.companyId, scope.ownerId, payload);
            try {
                const chatUser = this.extractChatUserDigits(chatId);
                if (chatUser && chatUser !== persistedContactPhone) {
                    await this.upsertScopedPhoneAlias(scope, chatUser, persistedContactPhone, chatId);
                }
            } catch (error: unknown) {
                logger.warn({ err: error, scope: this.buildRecordMapKey(scope), chatId, persistedContactPhone }, '[whatsappBusinessService] Falha ao persistir alias de telefone (user)');
            }

            logger.info(
                {
                    scope: this.buildRecordMapKey(scope),
                    direction,
                    contactPhone: persistedContactPhone,
                    chatId,
                    messageId: message.id?._serialized || null,
                    ownerType: scope.ownerType,
                    ownerId: scope.ownerId,
                },
                '[whatsappBusinessService] Mensagem persistida com sucesso'
            );
            return;
        }

        await WhatsAppBusinessMessageService.saveMessage(scope.companyId, payload);
        try {
            const chatUser = this.extractChatUserDigits(chatId);
            if (chatUser && chatUser !== persistedContactPhone) {
                await this.upsertScopedPhoneAlias(scope, chatUser, persistedContactPhone, chatId);
            }
        } catch (error: unknown) {
            logger.warn({ err: error, scope: this.buildRecordMapKey(scope), chatId, persistedContactPhone }, '[whatsappBusinessService] Falha ao persistir alias de telefone (company)');
        }

        logger.info(
            {
                scope: this.buildRecordMapKey(scope),
                direction,
                contactPhone: persistedContactPhone,
                chatId,
                messageId: message.id?._serialized || null,
                ownerType: scope.ownerType,
                ownerId: scope.ownerId,
            },
            '[whatsappBusinessService] Mensagem persistida com sucesso'
        );
    }

    private static ensureRootDirectory(): void {
        if (!fs.existsSync(SESSION_ROOT)) {
            fs.mkdirSync(SESSION_ROOT, { recursive: true });
        }
    }

    private static buildSessionDirectory(sessionKey: string): string {
        return path.join(SESSION_ROOT, `session-${sessionKey}`);
    }

    private static async releaseSessionRuntimeLock(sessionKey: string): Promise<void> {
        const sessionDirectory = this.buildSessionDirectory(sessionKey);

        try {
            await execFileAsync('pkill', ['-f', sessionDirectory]);
        } catch (error: unknown) {
            const code = typeof error === 'object' && error !== null && 'code' in error
                ? Number((error as { code?: number | string }).code)
                : null;

            if (code !== 1) {
                logger.warn(
                    { err: error, sessionKey },
                    '[whatsappBusinessService] Falha ao encerrar processo Chromium da sessao'
                );
            }
        }

        await Promise.all([
            fs.promises.rm(path.join(sessionDirectory, 'SingletonLock'), { force: true }),
            fs.promises.rm(path.join(sessionDirectory, 'SingletonCookie'), { force: true }),
            fs.promises.rm(path.join(sessionDirectory, 'SingletonSocket'), { force: true }),
            fs.promises.rm(path.join(sessionDirectory, 'DevToolsActivePort'), { force: true }),
        ]).catch(() => undefined);
    }

    private static async clearPersistedSessionData(sessionKey: string): Promise<void> {
        const sessionDirectory = this.buildSessionDirectory(sessionKey);
        await fs.promises.rm(sessionDirectory, { recursive: true, force: true }).catch(() => undefined);
    }

    private static makeSnapshot(scope: SessionScopeContext): WhatsAppBusinessSessionSnapshot {
        return {
            status: 'idle',
            company_key: scope.companyKey,
            owner_type: scope.ownerType,
            owner_key: scope.ownerKey,
            session_key: scope.sessionKey,
            qr_code_data_url: null,
            pairing_code: null,
            has_qr_code: false,
            connected_number: null,
            connected_name: null,
            platform: null,
            wid: null,
            last_event_at: null,
            last_error: null,
            persisted_session: fs.existsSync(this.buildSessionDirectory(scope.sessionKey)),
        };
    }

    private static getOrCreateRecord(scope: SessionScopeContext): SessionRecord {
        const mapKey = this.buildRecordMapKey(scope);
        const existing = this.sessions.get(mapKey);
        if (existing) {
            existing.snapshot.persisted_session = fs.existsSync(this.buildSessionDirectory(existing.scope.sessionKey));
            return existing;
        }

        const record: SessionRecord = {
            scope,
            client: null,
            initializePromise: null,
            snapshot: this.makeSnapshot(scope),
            inboundSyncTimer: null,
            initializingSince: null,
        };
        this.sessions.set(mapKey, record);
        return record;
    }

    private static stopInboundSyncTimer(record: SessionRecord): void {
        if (!record.inboundSyncTimer) {
            return;
        }

        clearInterval(record.inboundSyncTimer);
        record.inboundSyncTimer = null;
    }

    private static startInboundSyncTimer(record: SessionRecord): void {
        if (record.inboundSyncTimer) {
            return;
        }

        record.inboundSyncTimer = setInterval(() => {
            if (!record.client || record.snapshot.status !== 'ready') {
                return;
            }

            this.triggerScopedInboundSync(record);
        }, this.inboundSyncIntervalMs);
    }

    private static updateSnapshot(record: SessionRecord, updates: Partial<WhatsAppBusinessSessionSnapshot>): void {
        const nextStatus = updates.status ?? record.snapshot.status;
        if (nextStatus === 'initializing' && record.snapshot.status !== 'initializing') {
            record.initializingSince = Date.now();
        }
        if (nextStatus !== 'initializing') {
            record.initializingSince = null;
        }

        record.snapshot = {
            ...record.snapshot,
            ...updates,
            persisted_session: fs.existsSync(this.buildSessionDirectory(record.scope.sessionKey)),
        };

        void this.persistSessionSnapshot(record).catch((error: unknown) => {
            logger.warn(
                { err: error, sessionKey: record.scope.sessionKey },
                '[whatsappBusinessService] Falha ao persistir status da sessao no banco'
            );
        });
    }

    private static normalizeSnapshotDateTime(value: string | null | undefined): string | null {
        if (!value) return null;
        return String(value).replace('T', ' ').replace(/([+-]\d{2}:?\d{2}|Z)$/i, '').slice(0, 19);
    }

    private static async persistSessionSnapshot(record: SessionRecord): Promise<void> {
        const { scope, snapshot } = record;
        await pool.query(
            `INSERT INTO whatsapp_business_sessions (
                company_id, owner_type, owner_id, user_id, company_key, owner_key, session_key,
                status, has_qr_code, persisted_session, connected_number, connected_name,
                platform, wid, last_event_at, last_error
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                company_id = VALUES(company_id),
                user_id = VALUES(user_id),
                company_key = VALUES(company_key),
                owner_key = VALUES(owner_key),
                session_key = VALUES(session_key),
                status = VALUES(status),
                has_qr_code = VALUES(has_qr_code),
                persisted_session = VALUES(persisted_session),
                connected_number = VALUES(connected_number),
                connected_name = VALUES(connected_name),
                platform = VALUES(platform),
                wid = VALUES(wid),
                last_event_at = VALUES(last_event_at),
                last_error = VALUES(last_error),
                updated_at = CURRENT_TIMESTAMP`,
            [
                scope.companyId,
                scope.ownerType,
                scope.ownerId,
                scope.ownerType === 'user' ? scope.ownerId : null,
                scope.companyKey,
                scope.ownerKey,
                scope.sessionKey,
                snapshot.status,
                snapshot.has_qr_code ? 1 : 0,
                snapshot.persisted_session ? 1 : 0,
                snapshot.connected_number,
                snapshot.connected_name,
                snapshot.platform,
                snapshot.wid,
                this.normalizeSnapshotDateTime(snapshot.last_event_at),
                snapshot.last_error,
            ]
        );
    }

    private static isSnapshotStalledInitializing(record: SessionRecord): boolean {
        if (record.snapshot.status !== 'initializing') {
            return false;
        }

        if (!record.initializingSince) {
            return true;
        }

        return Date.now() - record.initializingSince >= this.initializationStallMs;
    }

    private static canAttemptRecovery(record: SessionRecord): boolean {
        if (!this.isSnapshotStalledInitializing(record)) {
            return false;
        }

        const mapKey = this.buildRecordMapKey(record.scope);
        const cooldownUntil = this.recoveryCooldownByKey.get(mapKey) || 0;
        return Date.now() >= cooldownUntil;
    }

    private static async recoverStalledInitialization(record: SessionRecord): Promise<void> {
        const mapKey = this.buildRecordMapKey(record.scope);
        this.recoveryCooldownByKey.set(mapKey, Date.now() + this.recoveryCooldownMs);

        logger.warn(
            { sessionKey: record.scope.sessionKey, status: record.snapshot.status, lastEventAt: record.snapshot.last_event_at },
            '[whatsappBusinessService] Inicializacao travada detectada, reiniciando sessao automaticamente'
        );

        this.updateSnapshot(record, {
            status: 'initializing',
            qr_code_data_url: null,
            pairing_code: null,
            has_qr_code: false,
            last_event_at: new Date().toISOString(),
            last_error: 'Sessao travada durante a inicializacao. Tentando recuperar automaticamente...',
        });

        try {
            if (record.client) {
                try {
                    await record.client.destroy();
                } catch (_destroyError) {
                    // best effort
                }
            }

            record.client = null;
            record.initializePromise = null;

            const shouldResetPersistedSession = record.snapshot.persisted_session
                && !record.snapshot.connected_number
                && !record.snapshot.has_qr_code;

            if (shouldResetPersistedSession) {
                logger.warn(
                    { sessionKey: record.scope.sessionKey },
                    '[whatsappBusinessService] Sessao persistida travada sem QR/numero. Limpando dados locais para novo pareamento'
                );
                await this.clearPersistedSessionData(record.scope.sessionKey);
            }

            await this.releaseSessionRuntimeLock(record.scope.sessionKey);
            await this.createClient(record);

            record.initializePromise = this.initializeClient(record)
                .catch((error: unknown) => {
                    logger.error({ err: error, sessionKey: record.scope.sessionKey }, '[whatsappBusinessService] Falha ao recuperar sessao travada');
                    this.updateSnapshot(record, {
                        status: 'error',
                        qr_code_data_url: null,
                        pairing_code: null,
                        has_qr_code: false,
                        last_event_at: new Date().toISOString(),
                        last_error: error instanceof Error ? error.message : 'Falha ao recuperar sessao do WhatsApp Business.',
                    });
                    record.client = null;
                })
                .finally(() => {
                    record.initializePromise = null;
                });
        } catch (error: unknown) {
            this.updateSnapshot(record, {
                status: 'error',
                qr_code_data_url: null,
                pairing_code: null,
                has_qr_code: false,
                last_event_at: new Date().toISOString(),
                last_error: error instanceof Error ? error.message : 'Falha ao recuperar sessao do WhatsApp Business.',
            });
            record.client = null;
            record.initializePromise = null;
        }
    }

    private static async bootstrapScopedHistory(record: SessionRecord): Promise<void> {
        const client = record.client;
        if (!client || record.snapshot.status !== 'ready') {
            return;
        }

        try {
            const chats = await client.getChats();
            const personalChats = chats
                .filter((chat: any) => this.isPersonalChat(chat?.id?._serialized || chat?.id?.toString?.() || ''))
                .sort((left: any, right: any) => {
                    const leftTs = Number(left?.timestamp || 0);
                    const rightTs = Number(right?.timestamp || 0);
                    return rightTs - leftTs;
                })
                .slice(0, this.historyBootstrapChatsLimit);

            let persistedMessages = 0;

            for (const chat of personalChats) {
                let messages: WhatsAppMessage[] = [];
                try {
                    const syncHistory = (chat as { syncHistory?: () => Promise<unknown> }).syncHistory;
                    if (typeof syncHistory === 'function') {
                        await syncHistory.call(chat);
                    }
                    messages = await chat.fetchMessages({ limit: this.historyBootstrapMessagesLimit });
                } catch (error: unknown) {
                    if (this.isKnownChatHistoryFetchError(error)) {
                        continue;
                    }

                    logger.warn(
                        { err: error, sessionKey: record.scope.sessionKey, chatId: chat?.id?._serialized || null },
                        '[whatsappBusinessService] Falha ao ler historico de chat durante bootstrap'
                    );
                    continue;
                }

                const chatId = String(chat?.id?._serialized || '');
                const preferredContactPhone = WhatsAppBusinessMessageService.normalizeContactPhone(chatId) || null;

                for (const message of messages) {
                    const direction: 'inbound' | 'outbound' = message.fromMe ? 'outbound' : 'inbound';
                    await this.persistScopedMessage(
                        record.scope,
                        message,
                        direction,
                        preferredContactPhone || undefined
                    );
                    persistedMessages += 1;
                }
            }

            logger.info(
                {
                    sessionKey: record.scope.sessionKey,
                    chats: personalChats.length,
                    messages: persistedMessages,
                },
                '[whatsappBusinessService] Bootstrap de historico concluido'
            );
        } catch (error: unknown) {
            logger.warn(
                { err: error, sessionKey: record.scope.sessionKey },
                '[whatsappBusinessService] Falha no bootstrap de historico de mensagens'
            );
        }
    }

    private static triggerScopedInboundSync(record: SessionRecord): void {
        const scopeKey = this.buildRecordMapKey(record.scope);
        const now = Date.now();
        const lastRunAt = this.inboundSyncLastRunByScope.get(scopeKey) || 0;

        if (now - lastRunAt < this.inboundSyncCooldownMs) {
            return;
        }

        if (this.inboundSyncInProgress.has(scopeKey)) {
            return;
        }

        this.inboundSyncInProgress.add(scopeKey);
        this.inboundSyncLastRunByScope.set(scopeKey, now);

        void (async () => {
            const client = record.client;
            if (!client || record.snapshot.status !== 'ready') {
                logger.info(
                    {
                        scope: scopeKey,
                        hasClient: !!client,
                        status: record.snapshot.status,
                    },
                    '[whatsappBusinessService] Sincronizacao inbound ignorada por sessao nao pronta'
                );
                return;
            }

            const chats = await client.getChats();
            const personalChats = chats
                .filter((chat: any) => this.isPersonalChat(chat?.id?._serialized || chat?.id?.toString?.() || ''))
                .sort((left: any, right: any) => Number(right?.timestamp || 0) - Number(left?.timestamp || 0))
                .slice(0, this.inboundSyncChatsLimit);

            let scannedMessages = 0;
            let persistedMessages = 0;
            let fallbackInboundHandled = 0;
            const nowMs = Date.now();

            for (const chat of personalChats) {
                let messages: WhatsAppMessage[] = [];
                try {
                    const syncHistory = (chat as { syncHistory?: () => Promise<unknown> }).syncHistory;
                    if (typeof syncHistory === 'function') {
                        await syncHistory.call(chat);
                    }
                    messages = await chat.fetchMessages({ limit: this.inboundSyncMessagesLimit });
                } catch (_error) {
                    continue;
                }

                scannedMessages += messages.length;

                const chatId = String(chat?.id?._serialized || '');
                const preferredContactPhone = WhatsAppBusinessMessageService.normalizeContactPhone(chatId) || null;

                for (const message of messages) {
                    const direction: 'inbound' | 'outbound' = message.fromMe ? 'outbound' : 'inbound';
                    try {
                        if (direction === 'inbound') {
                            const timestampSeconds = typeof message.timestamp === 'number' ? message.timestamp : 0;
                            const timestampMs = timestampSeconds > 0 ? timestampSeconds * 1000 : 0;
                            const isRecentInbound = timestampMs > 0
                                && (nowMs - timestampMs) <= this.inboundSyncAutoReplyRecentWindowMs;

                            if (isRecentInbound) {
                                await this.handleInboundMessage(record, message);
                                fallbackInboundHandled += 1;
                                continue;
                            }
                        }

                        await this.persistScopedMessage(record.scope, message, direction, preferredContactPhone || undefined);
                        persistedMessages += 1;
                    } catch (error: unknown) {
                        logger.warn(
                            {
                                err: error,
                                scope: scopeKey,
                                chatId,
                                messageId: message.id?._serialized || null,
                                direction,
                            },
                            '[whatsappBusinessService] Falha ao persistir mensagem durante sincronizacao inbound'
                        );
                    }
                }
            }

            if (scannedMessages > 0 || persistedMessages > 0 || fallbackInboundHandled > 0) {
                logger.info(
                    {
                        scope: scopeKey,
                        totalChats: chats.length,
                        personalChats: personalChats.length,
                        scannedMessages,
                        persistedMessages,
                        fallbackInboundHandled,
                    },
                    '[whatsappBusinessService] Sincronizacao inbound executada'
                );
            }
        })().catch(async (error: unknown) => {
            logger.warn(
                { err: error, sessionKey: record.scope.sessionKey },
                '[whatsappBusinessService] Falha na sincronizacao periodica de mensagens inbound'
            );

            if (this.isRecoverableSendRuntimeError(error)) {
                await this.recoverScopedSessionAfterRuntimeError(
                    record,
                    'Recuperando sessao apos falha de runtime na sincronizacao inbound.'
                );
            }
        }).finally(() => {
            this.inboundSyncInProgress.delete(scopeKey);
        });
    }

    private static bindClientEvents(record: SessionRecord, client: WhatsAppClient): void {
        client.on('qr', (qr: string) => {
            void (async () => {
                const qrCodeDataUrl = await QRCode.toDataURL(qr, {
                    errorCorrectionLevel: 'H',
                    margin: 2,
                    width: 212,
                    color: {
                        dark: '#111827',
                        light: '#FFFFFFFF',
                    },
                });
                this.updateSnapshot(record, {
                    status: 'awaiting_qr',
                    qr_code_data_url: qrCodeDataUrl,
                    pairing_code: null,
                    has_qr_code: true,
                    last_event_at: new Date().toISOString(),
                    last_error: null,
                });
            })().catch((error: unknown) => {
                logger.error({ err: error, sessionKey: record.scope.sessionKey }, '[whatsappBusinessService] Falha ao gerar QR code');
                this.updateSnapshot(record, {
                    status: 'error',
                    qr_code_data_url: null,
                    pairing_code: null,
                    has_qr_code: false,
                    last_event_at: new Date().toISOString(),
                    last_error: error instanceof Error ? error.message : 'Falha ao gerar QR code.',
                });
            });
        });

        client.on('authenticated', () => {
            this.updateSnapshot(record, {
                status: 'authenticated',
                last_event_at: new Date().toISOString(),
                last_error: null,
            });
        });

        client.on('ready', () => {
            const info = client.info;
            this.updateSnapshot(record, {
                status: 'ready',
                qr_code_data_url: null,
                pairing_code: null,
                has_qr_code: false,
                connected_number: info?.wid?.user || null,
                connected_name: info?.pushname || null,
                platform: info?.platform || null,
                wid: info?.wid?._serialized || null,
                last_event_at: new Date().toISOString(),
                last_error: null,
            });

            this.startInboundSyncTimer(record);
            this.triggerScopedInboundSync(record);
            void this.bootstrapScopedHistory(record);
        });

        client.on('auth_failure', (message: string) => {
            this.updateSnapshot(record, {
                status: 'auth_failure',
                qr_code_data_url: null,
                pairing_code: null,
                has_qr_code: false,
                last_event_at: new Date().toISOString(),
                last_error: message || 'Falha de autenticacao no WhatsApp Business.',
            });
        });

        client.on('disconnected', (reason: string) => {
            this.stopInboundSyncTimer(record);
            this.updateSnapshot(record, {
                status: 'disconnected',
                qr_code_data_url: null,
                pairing_code: null,
                has_qr_code: false,
                last_event_at: new Date().toISOString(),
                last_error: reason || null,
            });
            record.client = null;
        });

        client.on('message', (message: WhatsAppMessage) => {
            logger.info(
                {
                    scope: this.buildRecordMapKey(record.scope),
                    event: 'message',
                    messageId: message.id?._serialized || null,
                    from: message.from || null,
                    author: (message as { author?: string | null }).author || null,
                    fromMe: !!message.fromMe,
                    messageType: message.type || null,
                },
                '[whatsappBusinessService] Evento inbound recebido'
            );

            void this.handleInboundMessage(record, message).catch((error: unknown) => {
                logger.error(
                    { err: error, sessionKey: record.scope.sessionKey, messageId: message.id?._serialized || null },
                    '[whatsappBusinessService] Falha ao persistir mensagem recebida'
                );
            });
        });

        client.on('message_create', (message: WhatsAppMessage) => {
            if (message.fromMe) return;

            logger.info(
                {
                    scope: this.buildRecordMapKey(record.scope),
                    event: 'message_create',
                    messageId: message.id?._serialized || null,
                    from: message.from || null,
                    author: (message as { author?: string | null }).author || null,
                    fromMe: !!message.fromMe,
                    messageType: message.type || null,
                },
                '[whatsappBusinessService] Evento inbound recebido'
            );
        });
    }

    private static async createClient(record: SessionRecord): Promise<WhatsAppClient> {
        const { Client, LocalAuth } = await this.getWhatsAppExports();

        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: record.scope.sessionKey,
                dataPath: SESSION_ROOT,
            }),
            puppeteer: {
                headless: true,
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-zygote',
                    '--single-process',
                ],
            },
            qrMaxRetries: 0,
        });

        record.client = client;
        this.bindClientEvents(record, client);
        return client;
    }

    private static async initializeClient(record: SessionRecord, allowRecovery = true): Promise<void> {
        try {
            await record.client?.initialize();
        } catch (error: unknown) {
            if (allowRecovery && this.isBrowserAlreadyRunningError(error)) {
                logger.warn(
                    { err: error, sessionKey: record.scope.sessionKey },
                    '[whatsappBusinessService] Chromium preso na sessao, tentando recuperar lock local'
                );

                try {
                    await record.client?.destroy();
                } catch (_destroyError) {
                    // best effort
                }

                record.client = null;
                await this.releaseSessionRuntimeLock(record.scope.sessionKey);
                await this.createClient(record);
                await this.initializeClient(record, false);
                return;
            }

            throw error;
        }
    }

    private static normalizePairingPhone(phone: string): string {
        const normalized = String(phone || '').replace(/\D/g, '');

        if (!normalized || normalized.length < 10) {
            const error = new Error('Informe um telefone valido com DDI e DDD para gerar o codigo de pareamento.');
            (error as Error & { statusCode?: number }).statusCode = 400;
            throw error;
        }

        return normalized;
    }

    private static async requestPairingCode(record: SessionRecord, phone: string): Promise<void> {
        const normalizedPhone = this.normalizePairingPhone(phone);
        const client = record.client as WhatsAppClient & {
            requestPairingCode?: (phoneNumber: string, showNotification?: boolean) => Promise<string>;
        };

        if (!client || typeof client.requestPairingCode !== 'function') {
            const error = new Error('Esta versao do WhatsApp nao suporta pareamento por telefone. Use o QR code.');
            (error as Error & { statusCode?: number }).statusCode = 400;
            throw error;
        }

        let lastError: unknown = null;
        for (let attempt = 1; attempt <= 20; attempt += 1) {
            try {
                const pairingCode = await client.requestPairingCode(normalizedPhone, true);
                this.updateSnapshot(record, {
                    status: 'awaiting_qr',
                    qr_code_data_url: null,
                    pairing_code: pairingCode || null,
                    has_qr_code: false,
                    last_event_at: new Date().toISOString(),
                    last_error: null,
                });
                return;
            } catch (error: unknown) {
                lastError = error;
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        }

        throw lastError instanceof Error
            ? lastError
            : new Error('Nao foi possivel gerar o codigo de pareamento por telefone.');
    }

    private static requestPairingCodeAsync(record: SessionRecord, phone: string): void {
        void (async () => {
            if (!record.client || record.snapshot.status === 'ready') {
                return;
            }

            await this.requestPairingCode(record, phone);
        })().catch((error: unknown) => {
            logger.error({ err: error, sessionKey: record.scope.sessionKey }, '[whatsappBusinessService] Falha ao gerar codigo de pareamento');
            this.updateSnapshot(record, {
                status: 'error',
                pairing_code: null,
                last_event_at: new Date().toISOString(),
                last_error: error instanceof Error ? error.message : 'Falha ao gerar codigo de pareamento por telefone.',
            });
        });
    }

    private static async startScopedSession(scope: SessionScopeContext, pairPhone?: string): Promise<WhatsAppBusinessSessionSnapshot> {
        this.ensureRootDirectory();
        const record = this.getOrCreateRecord(scope);

        if (record.client || record.initializePromise) {
            if (pairPhone) {
                this.requestPairingCodeAsync(record, pairPhone);
            }
            return record.snapshot;
        }

        await this.releaseSessionRuntimeLock(record.scope.sessionKey);
        await this.createClient(record);
        this.updateSnapshot(record, {
            status: 'initializing',
            qr_code_data_url: null,
            pairing_code: null,
            has_qr_code: false,
            last_event_at: new Date().toISOString(),
            last_error: null,
        });

        record.initializePromise = this.initializeClient(record)
            .catch((error: unknown) => {
                logger.error({ err: error, sessionKey: record.scope.sessionKey }, '[whatsappBusinessService] Falha ao inicializar sessao QR');
                this.updateSnapshot(record, {
                    status: 'error',
                    qr_code_data_url: null,
                    pairing_code: null,
                    has_qr_code: false,
                    last_event_at: new Date().toISOString(),
                    last_error: error instanceof Error ? error.message : 'Falha ao inicializar o WhatsApp Business.',
                });
                record.client = null;
            })
            .finally(() => {
                record.initializePromise = null;
            });

        if (pairPhone) {
            this.requestPairingCodeAsync(record, pairPhone);
        }

        return record.snapshot;
    }

    private static async getScopedSessionStatus(scope: SessionScopeContext): Promise<WhatsAppBusinessSessionSnapshot> {
        const record = this.getOrCreateRecord(scope);

        if (record.snapshot.persisted_session && !record.client && !record.initializePromise) {
            return this.startScopedSession(scope);
        }

        if (this.canAttemptRecovery(record)) {
            void this.recoverStalledInitialization(record);
        }

        this.reconcileSnapshotFromClient(record);

        if (record.snapshot.status === 'ready') {
            this.triggerScopedInboundSync(record);
        }

        const scopeKey = this.buildRecordMapKey(scope);
        const statusSignature = [
            record.snapshot.status,
            record.snapshot.connected_number || '',
            record.snapshot.has_qr_code ? '1' : '0',
            record.client ? '1' : '0',
        ].join('|');
        const previousStatusLog = this.lastStatusLogByScope.get(scopeKey);
        const now = Date.now();
        const shouldLogStatus = !previousStatusLog
            || previousStatusLog.signature !== statusSignature
            || now - previousStatusLog.at >= 30_000;

        if (shouldLogStatus) {
            this.lastStatusLogByScope.set(scopeKey, { signature: statusSignature, at: now });
            logger.info(
                {
                    scope: scopeKey,
                    status: record.snapshot.status,
                    hasClient: !!record.client,
                    hasQr: !!record.snapshot.qr_code_data_url,
                    connectedNumber: record.snapshot.connected_number,
                    lastEventAt: record.snapshot.last_event_at,
                },
                '[whatsappBusinessService] Status da sessao consultado'
            );
        }

        return record.snapshot;
    }

    private static normalizeConnectedNumber(value: string | null | undefined): string | null {
        const digits = String(value || '').replace(/\D/g, '');
        return digits || null;
    }

    private static resolveConnectedNumberFromWid(wid: string | null | undefined): string | null {
        const rawWid = String(wid || '').trim();
        if (!rawWid) return null;

        const userPart = rawWid.split('@')[0] || '';
        return this.normalizeConnectedNumber(userPart);
    }

    private static reconcileSnapshotFromClient(record: SessionRecord): void {
        const clientInfo = record.client?.info;
        if (!clientInfo) return;

        const connectedNumber = this.normalizeConnectedNumber(clientInfo.wid?.user)
            || this.resolveConnectedNumberFromWid(clientInfo.wid?._serialized)
            || this.normalizeConnectedNumber(record.snapshot.connected_number);
        const connectedName = String(clientInfo.pushname || '').trim() || record.snapshot.connected_name || null;
        const wid = clientInfo.wid?._serialized || record.snapshot.wid || null;
        const platform = clientInfo.platform || record.snapshot.platform || null;

        if (connectedNumber && record.snapshot.status !== 'ready') {
            this.updateSnapshot(record, {
                status: 'ready',
                qr_code_data_url: null,
                pairing_code: null,
                has_qr_code: false,
                connected_number: connectedNumber,
                connected_name: connectedName,
                platform,
                wid,
                last_event_at: new Date().toISOString(),
                last_error: null,
            });
            return;
        }

        if (record.snapshot.status === 'ready') {
            this.updateSnapshot(record, {
                connected_number: connectedNumber,
                connected_name: connectedName,
                platform,
                wid,
            });
        }
    }

    private static async disconnectScopedSession(scope: SessionScopeContext): Promise<WhatsAppBusinessSessionSnapshot> {
        const record = this.getOrCreateRecord(scope);
        const client = record.client;

        try {
            if (client) {
                try {
                    await client.logout();
                } catch (_error) {
                    // If logout fails we still destroy the runtime client below.
                }
                await client.destroy();
            }
        } catch (error: unknown) {
            logger.error({ err: error, sessionKey: record.scope.sessionKey }, '[whatsappBusinessService] Falha ao encerrar sessao QR');
            this.updateSnapshot(record, {
                status: 'error',
                qr_code_data_url: null,
                has_qr_code: false,
                last_event_at: new Date().toISOString(),
                last_error: error instanceof Error ? error.message : 'Falha ao encerrar a sessao do WhatsApp Business.',
            });
            record.client = null;
            return record.snapshot;
        }

        record.client = null;
        record.initializePromise = null;
        this.stopInboundSyncTimer(record);
        this.updateSnapshot(record, {
            status: 'idle',
            qr_code_data_url: null,
            pairing_code: null,
            has_qr_code: false,
            connected_number: null,
            connected_name: null,
            platform: null,
            wid: null,
            last_event_at: new Date().toISOString(),
            last_error: null,
        });
        return record.snapshot;
    }

    private static async sendScopedMessage(scope: SessionScopeContext, input: WhatsAppBusinessSendMessageInput): Promise<WhatsAppBusinessSendResult> {
        await this.ensureScopedSessionReadyForSend(scope);

        const recipientPhone = WhatsAppBusinessMessageService.normalizeContactPhone(String(input.to || ''));
        if (!recipientPhone) {
            throw new AppError('Informe o numero de destino com DDI, DDD e numero.', 400);
        }

        const trimmedMessage = String(input.messageBody || '').trim();
        const attachment = input.attachment || null;
        if (!trimmedMessage && !attachment) {
            throw new AppError('Digite uma mensagem antes de enviar.', 400);
        }

        let result: WhatsAppBusinessSendResult;

        try {
            result = await this.executeSendScopedMessage(scope, input);
        } catch (error: unknown) {
            if (!this.isRecoverableSendRuntimeError(error)) {
                throw error;
            }

            logger.warn(
                {
                    err: error,
                    scope: this.buildRecordMapKey(scope),
                },
                '[whatsappBusinessService] Falha de runtime no envio, tentando recuperar sessao e reenviar'
            );

            await this.recoverScopedSessionForSend(scope);
            await this.ensureScopedSessionReadyForSend(scope);
            result = await this.executeSendScopedMessage(scope, input);
        }
        
        // Pequena folga para não empilhar envios instantâneos no mesmo loop.
        await new Promise((resolve) => setTimeout(resolve, 200));
        
        return result;
    }

    private static isRecoverableSendRuntimeError(error: unknown): boolean {
        const message = String(error instanceof Error ? error.message : error || '').toLowerCase();

        return message.includes('attempted to use detached frame')
            || message.includes('execution context was destroyed')
            || message.includes('target closed')
            || message.includes('session closed')
            || message.includes('protocol error');
    }

    private static async recoverScopedSessionForSend(scope: SessionScopeContext): Promise<void> {
        const record = this.getOrCreateRecord(scope);

        try {
            if (record.client) {
                this.stopInboundSyncTimer(record);
                try {
                    await record.client.destroy();
                } catch (_destroyError) {
                    // best effort
                }
            }

            record.client = null;
            record.initializePromise = null;
            this.stopInboundSyncTimer(record);

            this.updateSnapshot(record, {
                status: 'initializing',
                qr_code_data_url: null,
                pairing_code: null,
                has_qr_code: false,
                last_event_at: new Date().toISOString(),
                last_error: 'Recuperando sessao apos falha de runtime no envio.',
            });

            await this.releaseSessionRuntimeLock(record.scope.sessionKey);
            await this.createClient(record);
            await this.initializeClient(record);
        } catch (error: unknown) {
            this.updateSnapshot(record, {
                status: 'error',
                qr_code_data_url: null,
                pairing_code: null,
                has_qr_code: false,
                last_event_at: new Date().toISOString(),
                last_error: error instanceof Error ? error.message : 'Falha ao recuperar sessao do WhatsApp Business para envio.',
            });

            throw new AppError('Falha ao recuperar a sessao do WhatsApp Business. Tente novamente em alguns segundos.', 409);
        }
    }

    private static async recoverScopedSessionAfterRuntimeError(record: SessionRecord, lastError: string): Promise<void> {
        this.stopInboundSyncTimer(record);

        try {
            if (record.client) {
                try {
                    await record.client.destroy();
                } catch (_destroyError) {
                    // best effort
                }
            }

            record.client = null;
            record.initializePromise = null;

            this.updateSnapshot(record, {
                status: 'initializing',
                qr_code_data_url: null,
                pairing_code: null,
                has_qr_code: false,
                last_event_at: new Date().toISOString(),
                last_error: lastError,
            });

            await this.releaseSessionRuntimeLock(record.scope.sessionKey);
            await this.createClient(record);
            await this.initializeClient(record);
        } catch (recoveryError: unknown) {
            this.updateSnapshot(record, {
                status: 'error',
                qr_code_data_url: null,
                pairing_code: null,
                has_qr_code: false,
                last_event_at: new Date().toISOString(),
                last_error: recoveryError instanceof Error ? recoveryError.message : 'Falha ao recuperar sessao do WhatsApp Business.',
            });
            record.client = null;
            record.initializePromise = null;

            logger.error(
                { err: recoveryError, sessionKey: record.scope.sessionKey },
                '[whatsappBusinessService] Falha ao recuperar sessao apos erro de runtime'
            );
        }
    }

    private static async waitForScopedSessionReady(scope: SessionScopeContext): Promise<void> {
        const timeoutAt = Date.now() + this.sendReadyWaitMs;

        while (Date.now() < timeoutAt) {
            const record = this.getOrCreateRecord(scope);
            if (record.client && record.snapshot.status === 'ready') {
                return;
            }

            await new Promise((resolve) => setTimeout(resolve, this.sendReadyPollMs));
        }
    }

    private static async ensureScopedSessionReadyForSend(scope: SessionScopeContext): Promise<SessionRecord> {
        let record = this.getOrCreateRecord(scope);
        if (record.client && record.snapshot.status === 'ready') {
            return record;
        }

        await this.getScopedSessionStatus(scope);
        record = this.getOrCreateRecord(scope);

        if (record.initializePromise) {
            try {
                await Promise.race([
                    record.initializePromise,
                    new Promise<void>((resolve) => setTimeout(resolve, this.sendReadyWaitMs)),
                ]);
            } catch (_error) {
                // The status check below will return a precise operational message.
            }
        }

        if (this.canAttemptRecovery(record)) {
            await this.recoverStalledInitialization(record);
        }

        await this.waitForScopedSessionReady(scope);
        record = this.getOrCreateRecord(scope);

        if (record.client && record.snapshot.status === 'ready') {
            return record;
        }

        const snapshotStatus = record.snapshot.status;
        if (snapshotStatus === 'awaiting_qr' || snapshotStatus === 'auth_failure' || snapshotStatus === 'idle' || snapshotStatus === 'disconnected') {
            throw new AppError('Conecte o WhatsApp Business por QR code antes de enviar mensagens.', 400);
        }

        if (snapshotStatus === 'initializing' || snapshotStatus === 'authenticated') {
            throw new AppError('WhatsApp Business ainda esta conectando. Aguarde alguns segundos e tente novamente.', 409);
        }

        throw new AppError(record.snapshot.last_error || 'Sessao do WhatsApp Business indisponivel para envio no momento.', 500);
    }

    private static async executeSendScopedMessage(scope: SessionScopeContext, input: WhatsAppBusinessSendMessageInput): Promise<WhatsAppBusinessSendResult> {
        const record = this.getOrCreateRecord(scope);
        if (!record.client || record.snapshot.status !== 'ready') {
            throw new AppError('Conecte o WhatsApp Business por QR code antes de enviar mensagens.', 400);
        }

        const recipientPhone = WhatsAppBusinessMessageService.normalizeContactPhone(String(input.to || ''));
        const trimmedMessage = String(input.messageBody || '').trim();
        const attachment = input.attachment || null;

        const preferredChatId = String(input.toChatId || '').trim();
        const chatId = preferredChatId && this.isPersonalChat(preferredChatId)
            ? preferredChatId
            : `${recipientPhone}@c.us`;
        try {
            const chatUser = this.extractChatUserDigits(chatId);
            if (chatUser && chatUser !== recipientPhone) {
                await this.upsertScopedPhoneAlias(scope, chatUser, recipientPhone, chatId);
            }
        } catch (error: unknown) {
            logger.warn({ err: error, scope: this.buildRecordMapKey(scope), recipientPhone, chatId }, '[whatsappBusinessService] Falha ao registrar alias antes do envio manual');
        }
        logger.info(
            {
                scope: this.buildRecordMapKey(scope),
                to: recipientPhone,
                preferredChatId: preferredChatId || null,
                resolvedChatId: chatId,
                usedPreferredChatId: !!preferredChatId && chatId === preferredChatId,
                hasAttachment: !!attachment,
            },
            '[whatsappBusinessService] Envio manual usando chat_id resolvido'
        );
        const isAudioAttachment = attachment?.mimeType?.trim().toLowerCase().startsWith('audio/');
        const media = attachment ? await this.buildMessageMedia(attachment) : null;
        const message = attachment
            ? (trimmedMessage
                ? await record.client.sendMessage(chatId, media!, {
                    caption: trimmedMessage,
                    sendAudioAsVoice: !!isAudioAttachment,
                }) as WhatsAppMessage
                : await record.client.sendMessage(chatId, media!, {
                    sendAudioAsVoice: !!isAudioAttachment,
                }) as WhatsAppMessage)
            : await record.client.sendMessage(chatId, trimmedMessage) as WhatsAppMessage;

        try {
            await this.persistScopedMessage(record.scope, message, 'outbound', recipientPhone, attachment);
        } catch (error: unknown) {
            logger.error(
                { err: error, sessionKey: record.scope.sessionKey, messageId: message.id?._serialized || null },
                '[whatsappBusinessService] Falha ao persistir mensagem enviada'
            );
        }

        return {
            status: 'sent',
            to: recipientPhone,
            chat_id: chatId,
            message_id: message.id?._serialized || null,
            ack: typeof message.ack === 'number' ? message.ack : null,
            timestamp: typeof message.timestamp === 'number' ? message.timestamp : null,
            message_type: message.type || null,
            attachment_name: attachment?.fileName || null,
        };
    }

    static async startSession(companyId: number | string, pairPhone?: string): Promise<WhatsAppBusinessSessionSnapshot> {
        return this.startScopedSession(this.buildCompanyScope(companyId), pairPhone);
    }

    static async startUserSession(companyId: number | string, userId: number | string, pairPhone?: string): Promise<WhatsAppBusinessSessionSnapshot> {
        return this.startScopedSession(this.buildUserScope(companyId, userId), pairPhone);
    }

    static async getSessionStatus(companyId: number | string): Promise<WhatsAppBusinessSessionSnapshot> {
        return this.getScopedSessionStatus(this.buildCompanyScope(companyId));
    }

    static async getUserSessionStatus(companyId: number | string, userId: number | string): Promise<WhatsAppBusinessSessionSnapshot> {
        return this.getScopedSessionStatus(this.buildUserScope(companyId, userId));
    }

    static async disconnectSession(companyId: number | string): Promise<WhatsAppBusinessSessionSnapshot> {
        return this.disconnectScopedSession(this.buildCompanyScope(companyId));
    }

    static async disconnectUserSession(companyId: number | string, userId: number | string): Promise<WhatsAppBusinessSessionSnapshot> {
        return this.disconnectScopedSession(this.buildUserScope(companyId, userId));
    }

    static async sendTextMessage(companyId: number | string, to: string, messageBody: string): Promise<WhatsAppBusinessSendResult> {
        return this.sendScopedMessage(this.buildCompanyScope(companyId), {
            to,
            messageBody,
        });
    }

    static async sendUserTextMessage(companyId: number | string, userId: number | string, to: string, messageBody: string): Promise<WhatsAppBusinessSendResult> {
        return this.sendScopedMessage(this.buildUserScope(companyId, userId), {
            to,
            messageBody,
        });
    }

    static async sendMessage(companyId: number | string, input: WhatsAppBusinessSendMessageInput): Promise<WhatsAppBusinessSendResult> {
        return this.sendScopedMessage(this.buildCompanyScope(companyId), input);
    }

    static async sendUserMessage(companyId: number | string, userId: number | string, input: WhatsAppBusinessSendMessageInput): Promise<WhatsAppBusinessSendResult> {
        return this.sendScopedMessage(this.buildUserScope(companyId, userId), input);
    }

    static async shutdownAllSessions(): Promise<void> {
        await Promise.all(Array.from(this.sessions.values()).map(async (record) => {
            if (!record.client) {
                return;
            }

            try {
                this.stopInboundSyncTimer(record);
                await record.client.destroy();
            } catch (error: unknown) {
                logger.warn(
                    { err: error, sessionKey: record.scope.sessionKey },
                    '[whatsappBusinessService] Falha ao destruir cliente durante shutdown'
                );
            } finally {
                record.client = null;
                record.initializePromise = null;
                this.stopInboundSyncTimer(record);
            }
        }));
    }
}
