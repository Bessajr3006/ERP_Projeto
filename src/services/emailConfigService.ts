import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { encrypt, decrypt } from '../utils/crypto';

export interface EmailConfig {
    user_public_id: string | null;
    company_id: number | null;
    smtp_host: string;
    smtp_port: number;
    smtp_secure: boolean;
    smtp_user: string;
    imap_host: string;
    imap_port: number;
    imap_secure: boolean;
    smtp_password: string | null;
    sender_name: string;
    sender_email: string;
    is_active: boolean;
    updated_at?: string | null;
}

export interface EmailConfigInput {
    smtp_host: string;
    smtp_port: number;
    smtp_secure: boolean;
    smtp_user: string;
    imap_host: string;
    imap_port: number;
    imap_secure: boolean;
    smtp_password: string | null;
    sender_name: string;
    sender_email: string;
    is_active: boolean;
}

type EmailConfigRow = RowDataPacket & {
    user_public_id: string | null;
    company_id: number | null;
    smtp_host: string;
    smtp_port: number;
    smtp_secure: number;
    smtp_user: string;
    imap_host: string;
    imap_port: number;
    imap_secure: number;
    smtp_password: string | null;
    sender_name: string;
    sender_email: string;
    is_active: number;
    updated_at: string | null;
};

function mapRow(row: EmailConfigRow): EmailConfig {
    return {
        user_public_id: row.user_public_id,
        company_id: row.company_id,
        smtp_host: row.smtp_host,
        smtp_port: row.smtp_port,
        smtp_secure: Boolean(row.smtp_secure),
        smtp_user: row.smtp_user,
        imap_host: row.imap_host || '',
        imap_port: Number(row.imap_port || 993),
        imap_secure: Boolean(row.imap_secure),
        smtp_password: decrypt(row.smtp_password),
        sender_name: row.sender_name,
        sender_email: row.sender_email,
        is_active: Boolean(row.is_active),
        updated_at: row.updated_at,
    };
}

export class EmailConfigService {
    /** Busca config por usuário */
    static async getByUser(userPublicId: string): Promise<EmailConfig | null> {
        const [rows] = await pool.query<EmailConfigRow[]>(
            'SELECT * FROM email_config WHERE user_public_id = ? LIMIT 1',
            [userPublicId],
        );
        if (!rows || rows.length === 0) return null;
        return mapRow(rows[0]!);
    }

    /** Busca config por empresa (legado) */
    static async getByCompany(companyId: number): Promise<EmailConfig | null> {
        const [rows] = await pool.query<EmailConfigRow[]>(
            'SELECT * FROM email_config WHERE company_id = ? AND user_public_id IS NULL LIMIT 1',
            [companyId],
        );
        if (!rows || rows.length === 0) return null;
        return mapRow(rows[0]!);
    }

    static async saveForUser(userPublicId: string, companyId: number, data: EmailConfigInput): Promise<EmailConfig> {
        const encryptedPassword = encrypt(data.smtp_password ?? null);

        await pool.query<ResultSetHeader>(
            `INSERT INTO email_config
                (user_public_id, company_id, smtp_host, smtp_port, smtp_secure, smtp_user, imap_host, imap_port, imap_secure, smtp_password, sender_name, sender_email, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                smtp_host     = VALUES(smtp_host),
                smtp_port     = VALUES(smtp_port),
                smtp_secure   = VALUES(smtp_secure),
                smtp_user     = VALUES(smtp_user),
                imap_host     = VALUES(imap_host),
                imap_port     = VALUES(imap_port),
                imap_secure   = VALUES(imap_secure),
                smtp_password = VALUES(smtp_password),
                sender_name   = VALUES(sender_name),
                sender_email  = VALUES(sender_email),
                is_active     = VALUES(is_active)`,
            [
                userPublicId,
                companyId,
                data.smtp_host,
                data.smtp_port,
                data.smtp_secure ? 1 : 0,
                data.smtp_user,
                data.imap_host,
                data.imap_port,
                data.imap_secure ? 1 : 0,
                encryptedPassword,
                data.sender_name,
                data.sender_email,
                data.is_active ? 1 : 0,
            ],
        );

        return (await this.getByUser(userPublicId))!;
    }

    /** Mantém compatibilidade com a aba empresa */
    static async saveForCompany(companyId: number, data: EmailConfigInput): Promise<EmailConfig> {
        const encryptedPassword = encrypt(data.smtp_password ?? null);

        await pool.query<ResultSetHeader>(
            `INSERT INTO email_config
                (company_id, smtp_host, smtp_port, smtp_secure, smtp_user, imap_host, imap_port, imap_secure, smtp_password, sender_name, sender_email, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                smtp_host     = VALUES(smtp_host),
                smtp_port     = VALUES(smtp_port),
                smtp_secure   = VALUES(smtp_secure),
                smtp_user     = VALUES(smtp_user),
                imap_host     = VALUES(imap_host),
                imap_port     = VALUES(imap_port),
                imap_secure   = VALUES(imap_secure),
                smtp_password = VALUES(smtp_password),
                sender_name   = VALUES(sender_name),
                sender_email  = VALUES(sender_email),
                is_active     = VALUES(is_active)`,
            [
                companyId,
                data.smtp_host,
                data.smtp_port,
                data.smtp_secure ? 1 : 0,
                data.smtp_user,
                data.imap_host,
                data.imap_port,
                data.imap_secure ? 1 : 0,
                encryptedPassword,
                data.sender_name,
                data.sender_email,
                data.is_active ? 1 : 0,
            ],
        );

        return (await this.getByCompany(companyId))!;
    }
}
