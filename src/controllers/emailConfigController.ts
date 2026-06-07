import { Request, Response } from 'express';
import { z } from 'zod';
import { EmailConfigService } from '../services/emailConfigService';
import { EmailInboxSyncService } from '../services/emailInboxSyncService';

const emailConfigSchema = z.object({
    smtp_host: z.string().trim().min(1, 'Informe o servidor SMTP.'),
    smtp_port: z.coerce.number().int().min(1).max(65535),
    smtp_secure: z.boolean().optional().default(false),
    smtp_user: z.string().trim().min(1, 'Informe o usuário SMTP.'),
    imap_host: z.string().trim().max(255).optional().default(''),
    imap_port: z.coerce.number().int().min(1).max(65535).optional().default(993),
    imap_secure: z.boolean().optional().default(true),
    smtp_password: z.string().nullable().optional(),
    sender_name: z.string().trim().min(1, 'Informe o nome do remetente.'),
    sender_email: z.string().email('E-mail do remetente inválido.'),
    is_active: z.boolean().optional().default(true),
});

const syncInboxQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    imap_host: z.string().trim().min(1).max(255).optional(),
    imap_port: z.coerce.number().int().min(1).max(65535).optional(),
    imap_secure: z.enum(['true', 'false']).optional(),
});

function safeConfig(config: any) {
    const { smtp_password: _pw, ...rest } = config;
    return { ...rest, has_password: Boolean(_pw && String(_pw).trim() !== '') };
}

export class EmailConfigController {
    /** GET /api/v1/email-config — configuração da empresa */
    static async get(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;
        const config = await EmailConfigService.getByCompany(companyId);
        res.status(200).json({ status: 'success', data: config ? safeConfig(config) : null });
    }

    /** POST /api/v1/email-config — salva configuração da empresa */
    static async save(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;
        const validated = emailConfigSchema.parse(req.body || {});

        if (!validated.smtp_password || validated.smtp_password.trim() === '') {
            const existing = await EmailConfigService.getByCompany(companyId);
            validated.smtp_password = existing?.smtp_password ?? null;
        }

        const saved = await EmailConfigService.saveForCompany(companyId, validated as any);
        res.status(200).json({ status: 'success', data: safeConfig(saved) });
    }

    /** GET /api/v1/users/:id/email-config — configuração do usuário */
    static async getForUser(req: Request, res: Response): Promise<void> {
        const userPublicId = req.params.id as string;
        const config = await EmailConfigService.getByUser(userPublicId);
        res.status(200).json({ status: 'success', data: config ? safeConfig(config) : null });
    }

    /** POST /api/v1/users/:id/email-config — salva configuração do usuário */
    static async saveForUser(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;
        const userPublicId = req.params.id as string;
        const validated = emailConfigSchema.parse(req.body || {});

        if (!validated.smtp_password || validated.smtp_password.trim() === '') {
            const existing = await EmailConfigService.getByUser(userPublicId);
            validated.smtp_password = existing?.smtp_password ?? null;
        }

        const saved = await EmailConfigService.saveForUser(userPublicId, companyId, validated as any);
        res.status(200).json({ status: 'success', data: safeConfig(saved) });
    }

    /** GET /api/v1/email-config/sync-inbox?limit=50 — sincroniza mensagens da caixa via IMAP */
    static async syncInbox(req: Request, res: Response): Promise<void> {
        const userPublicId = req.user!.id;
        const companyId = req.user!.company_id;
        const parsed = syncInboxQuerySchema.parse(req.query || {});

        const imapOverrides: {
            imapHost?: string;
            imapPort?: number;
            imapSecure?: boolean;
        } = {};
        if (parsed.imap_host !== undefined) imapOverrides.imapHost = parsed.imap_host;
        if (parsed.imap_port !== undefined) imapOverrides.imapPort = parsed.imap_port;
        if (parsed.imap_secure !== undefined) imapOverrides.imapSecure = parsed.imap_secure === 'true';

        const messages = await EmailInboxSyncService.syncInboxForUser(
            userPublicId,
            companyId,
            parsed.limit,
            imapOverrides,
        );

        res.status(200).json({
            status: 'success',
            data: messages,
            meta: { count: messages.length },
        });
    }
}
