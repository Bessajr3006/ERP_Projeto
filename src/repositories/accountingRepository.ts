import { z } from 'zod';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { randomUUID } from 'crypto';
import pool from '../config/db';

export const ChartOfAccountSchema = z.object({
    id: z.number().int().positive(),
    public_id: z.string().uuid(),
    company_id: z.number().int().positive(),
    code: z.string(),
    easy_code: z.string().nullable().optional(),
    name: z.string(),
    type: z.enum(['synthetic', 'analytic']),
    nature: z.enum(['debit', 'credit']),
    status: z.enum(['active', 'inactive']),
    created_at: z.union([z.string(), z.date()]).optional(),
    updated_at: z.union([z.string(), z.date()]).optional()
}).passthrough();

export type ChartOfAccount = z.infer<typeof ChartOfAccountSchema>;

export class AccountingRepository {
    static async createAccount(
        companyId: number,
        data: { code: string; easy_code?: string | null | undefined; name: string; type: 'synthetic' | 'analytic'; nature: 'debit' | 'credit'; status?: 'active' | 'inactive' | undefined }
    ): Promise<ChartOfAccount> {
        const publicId = randomUUID();
        const status = data.status || 'active';
        const easyCode = data.easy_code || null;

        const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM chart_of_accounts WHERE company_id = ? AND code = ? LIMIT 1', [companyId, data.code]);
        if (existing && existing.length > 0) {
            throw new Error(`A conta contábil com o código ${data.code} já existe.`);
        }

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO chart_of_accounts (public_id, company_id, code, easy_code, name, type, nature, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [publicId, companyId, data.code, easyCode, data.name, data.type, data.nature, status]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Failed to create chart of account');
        }

        return this.getAccountById(result.insertId, companyId);
    }

    static async getAccountById(id: number, companyId: number): Promise<ChartOfAccount> {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM chart_of_accounts WHERE id = ? AND company_id = ? LIMIT 1', [id, companyId]);
        if (!rows || rows.length === 0) throw new Error('Account not found');
        return ChartOfAccountSchema.parse(rows[0]) as ChartOfAccount;
    }

    static async listAccounts(companyId: number): Promise<ChartOfAccount[]> {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM chart_of_accounts WHERE company_id = ? ORDER BY code ASC', [companyId]);
        
        return rows.map(row => ChartOfAccountSchema.parse(row)) as ChartOfAccount[];
    }

    static async updateAccount(
        publicId: string,
        companyId: number,
        data: { code: string; easy_code?: string | null | undefined; name: string; type: 'synthetic' | 'analytic'; nature: 'debit' | 'credit'; status?: 'active' | 'inactive' | undefined }
    ): Promise<ChartOfAccount> {
        const [rows]: any = await pool.query(
            'SELECT id FROM chart_of_accounts WHERE public_id = ? AND company_id = ?',
            [publicId, companyId]
        );

        if (!rows || rows.length === 0) throw new Error('Account not found');
        const accountId = rows[0].id;
        const status = data.status || 'active';
        const easyCode = data.easy_code || null;

        const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM chart_of_accounts WHERE company_id = ? AND code = ? AND id != ? LIMIT 1', [companyId, data.code, accountId]);
        if (existing && existing.length > 0) {
            throw new Error(`A conta contábil com o código ${data.code} já existe.`);
        }

        await pool.query(
            'UPDATE chart_of_accounts SET code = ?, easy_code = ?, name = ?, type = ?, nature = ?, status = ? WHERE id = ? AND company_id = ?',
            [data.code, easyCode, data.name, data.type, data.nature, status, accountId, companyId]
        );

        return this.getAccountById(accountId, companyId);
    }

    static async deleteAccount(publicId: string, companyId: number): Promise<void> {
        const [rows]: any = await pool.query(
            'SELECT id FROM chart_of_accounts WHERE public_id = ? AND company_id = ?',
            [publicId, companyId]
        );

        if (!rows || rows.length === 0) throw new Error('Account not found');
        const accountId = rows[0].id;

        await pool.query('DELETE FROM chart_of_accounts WHERE id = ? AND company_id = ?', [accountId, companyId]);
    }

    static async batchDeleteAccounts(publicIds: string[], companyId: number): Promise<void> {
        if (!publicIds || publicIds.length === 0) return;
        const placeholders = publicIds.map(() => '?').join(',');
        await pool.query(`DELETE FROM chart_of_accounts WHERE company_id = ? AND public_id IN (${placeholders})`, [companyId, ...publicIds]);
    }

    static async batchUpsertAccounts(
        companyId: number, 
        accounts: Array<{ code: string; easy_code?: string; name: string; type: 'synthetic' | 'analytic'; nature: 'debit' | 'credit'; status?: 'active' | 'inactive' }>
    ): Promise<{ success: number; errors: string[] }> {
        let success = 0;
        const errors: string[] = [];

        for (const data of accounts) {
            try {
                const [existing] = await pool.query<RowDataPacket[]>(
                    'SELECT id, public_id FROM chart_of_accounts WHERE company_id = ? AND code = ? LIMIT 1', 
                    [companyId, data.code]
                );

                if (existing && existing.length > 0 && existing[0]) {
                    await this.updateAccount(existing[0].public_id, companyId, data);
                    success++;
                } else {
                    await this.createAccount(companyId, data);
                    success++;
                }
            } catch (err: any) {
                errors.push(`Conta ${data.code}: ${err.message}`);
            }
        }
        
        return { success, errors };
    }
}