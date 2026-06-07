import { ImapFlow } from 'imapflow';
import { AppError } from '../errors/AppError';
import logger from '../config/logger';
import { EmailConfigService } from './emailConfigService';

type SyncedMail = {
    external_id: string;
    folder: 'inbox';
    from_name: string;
    from_email: string;
    to: string;
    subject: string;
    body: string;
    date: string;
    unread: boolean;
    starred: boolean;
    attachments: string[];
};

type Address = {
    name?: string;
    address?: string;
};

function asArray<T>(value: T | T[] | null | undefined): T[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function pickAddress(addresses: Address[] | undefined): { name: string; email: string } {
    const first = asArray(addresses)[0];
    return {
        name: (first?.name || '').trim() || 'Sem nome',
        email: (first?.address || '').trim() || 'sem-email@local',
    };
}

function joinEmails(addresses: Address[] | undefined): string {
    return asArray(addresses)
        .map((item) => (item?.address || '').trim())
        .filter(Boolean)
        .join(', ');
}

function inferImapHost(smtpHost: string): string {
    const host = (smtpHost || '').trim();
    if (!host) return '';
    if (host.startsWith('smtp.')) return host.replace(/^smtp\./i, 'imap.');
    if (host.includes('smtp')) return host.replace(/smtp/gi, 'imap');
    return host;
}

export class EmailInboxSyncService {
    static async syncInboxForUser(
        userPublicId: string,
        companyId: number,
        limit: number,
        imapOverrides?: {
            imapHost?: string;
            imapPort?: number;
            imapSecure?: boolean;
        },
    ): Promise<SyncedMail[]> {
        const userConfig = await EmailConfigService.getByUser(userPublicId);
        const companyConfig = await EmailConfigService.getByCompany(companyId);
        const config = userConfig?.is_active ? userConfig : (companyConfig?.is_active ? companyConfig : null);

        if (!config) {
            throw new AppError('Configure o e-mail antes de sincronizar a caixa.', 400);
        }

        const savedImapHost = String(config.imap_host || '').trim();
        const savedImapPort = Number(config.imap_port || 0);
        const savedImapSecure = typeof config.imap_secure === 'boolean' ? config.imap_secure : config.smtp_secure;

        const host = (imapOverrides?.imapHost || '').trim() || savedImapHost || inferImapHost(config.smtp_host);
        const secure = typeof imapOverrides?.imapSecure === 'boolean' ? imapOverrides.imapSecure : savedImapSecure;
        const port = Number(imapOverrides?.imapPort || 0) || savedImapPort || (secure ? 993 : 143);
        const user = (config.smtp_user || '').trim();
        const pass = (config.smtp_password || '').trim();

        if (!host || !user || !pass) {
            throw new AppError('Configuracao de e-mail incompleta para sincronizacao da caixa.', 400);
        }

        const client = new ImapFlow({
            host,
            port,
            secure,
            auth: { user, pass },
            logger: false,
        });

        try {
            await client.connect();
            const lock = await client.getMailboxLock('INBOX');
            try {
                const total = Number((client.mailbox as any)?.exists || 0);
                if (total <= 0) return [];

                const desiredLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.floor(limit))) : 50;
                const start = Math.max(1, total - desiredLimit + 1);
                const synced: SyncedMail[] = [];

                for await (const msg of client.fetch(`${start}:*`, {
                    uid: true,
                    envelope: true,
                    flags: true,
                    internalDate: true,
                })) {
                    const from = pickAddress(msg.envelope?.from as Address[] | undefined);
                    const to = joinEmails(msg.envelope?.to as Address[] | undefined);
                    const subject = (msg.envelope?.subject || '').trim() || '(Sem assunto)';
                    const date = msg.internalDate ? new Date(msg.internalDate).toISOString() : new Date().toISOString();
                    const messageId = (msg.envelope?.messageId || '').trim();
                    const externalId = messageId || `uid-${String(msg.uid)}`;
                    const flags = msg.flags || new Set<string>();

                    synced.push({
                        external_id: externalId,
                        folder: 'inbox',
                        from_name: from.name,
                        from_email: from.email,
                        to,
                        subject,
                        body: 'Conteudo sincronizado da caixa de entrada. Abra no provedor para visualizar o corpo completo.',
                        date,
                        unread: !flags.has('\\Seen'),
                        starred: flags.has('\\Flagged'),
                        attachments: [],
                    });
                }

                return synced.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            } finally {
                lock.release();
            }
        } catch (error: any) {
            logger.warn({ err: error }, 'Falha ao sincronizar caixa de e-mail via IMAP');

            const rawParts = [
                error?.message,
                error?.response,
                error?.responseText,
                error?.serverResponseCode,
                error?.code,
                error,
            ].filter(Boolean);
            const raw = rawParts.map((item) => String(item).toLowerCase()).join(' | ');

            if (error?.authenticationFailed === true
                || raw.includes('authenticationfailed')
                || raw.includes('invalid credentials')
                || raw.includes('auth')
                || raw.includes('login')) {
                throw new AppError('Falha de autenticacao no e-mail. Verifique usuario e senha SMTP/IMAP.', 400);
            }
            if (raw.includes('getaddrinfo') || raw.includes('enotfound') || raw.includes('econnrefused')) {
                throw new AppError('Nao foi possivel conectar ao servidor de e-mail. Verifique host e porta.', 400);
            }
            throw new AppError('Falha ao sincronizar a caixa de e-mail.', 400);
        } finally {
            try {
                await client.logout();
            } catch (_) {
                // ignore close errors
            }
        }
    }
}
