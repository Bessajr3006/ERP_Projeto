import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { z } from 'zod';
import { randomUUID } from 'crypto';

export const accountingEntrySchema = z.object({
    entry_date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Data inválida" }),
    debit_account_id: z.string().uuid("ID Público da conta débito inválido"),
    credit_account_id: z.string().uuid("ID Público da conta crédito inválido"),
    amount: z.number().positive("O valor deve ser positivo"),
    document_ref: z.string().max(100).optional(),
    history: z.string().min(1, 'Histórico é obrigatório'),
    status: z.enum(['active', 'inactive']).optional()
});

export class AccountingEntryService {
    
    // Auxiliary: Get Internal ID for a given public ID
    private static async getInternalAccountId(publicId: string, companyId: number): Promise<number | null> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM chart_of_accounts WHERE company_id = ? AND public_id = ?',
            [companyId, publicId]
        );
        if (!rows || rows.length === 0 || !rows[0]) return null;
        return rows[0].id;
    }

    static async getAllEntries(companyId: number, filters?: any): Promise<any[]> {
        let query = `
            SELECT e.public_id, e.entry_date, e.amount, e.document_ref, e.history, e.status, e.created_at,
                   d.public_id as debit_account_public_id, d.code as debit_account_code, d.name as debit_account_name,
                   c.public_id as credit_account_public_id, c.code as credit_account_code, c.name as credit_account_name
            FROM accounting_entries e
            JOIN chart_of_accounts d ON e.debit_account_id = d.id
            JOIN chart_of_accounts c ON e.credit_account_id = c.id
            WHERE e.company_id = ?
        `;
        const params: any[] = [companyId];

        if (filters) {
            if (filters.search) {
                query += ` AND (e.history LIKE ? OR e.document_ref LIKE ?)`;
                params.push(`%${filters.search}%`, `%${filters.search}%`);
            }
            if (filters.status) {
                query += ` AND e.status = ?`;
                params.push(filters.status);
            }
            if (filters.startDate) {
                query += ` AND e.entry_date >= ?`;
                params.push(filters.startDate);
            }
            if (filters.endDate) {
                query += ` AND e.entry_date <= ?`;
                params.push(filters.endDate);
            }
        }

        query += ` ORDER BY e.entry_date DESC, e.id DESC`;

        const [rows] = await pool.query<RowDataPacket[]>(query, params);
        return rows;
    }

    static async getEntryByPublicId(publicId: string, companyId: number): Promise<any | null> {
        const [rows] = await pool.query<RowDataPacket[]>(`
            SELECT e.public_id, DATE_FORMAT(e.entry_date, '%Y-%m-%d') as entry_date, e.amount, e.document_ref, e.history, e.status,
                   d.public_id as debit_account_public_id, d.code as debit_account_code, d.name as debit_account_name,
                   c.public_id as credit_account_public_id, c.code as credit_account_code, c.name as credit_account_name
            FROM accounting_entries e
            JOIN chart_of_accounts d ON e.debit_account_id = d.id
            JOIN chart_of_accounts c ON e.credit_account_id = c.id
            WHERE e.company_id = ? AND e.public_id = ?
            LIMIT 1
        `, [companyId, publicId]);

        return rows.length > 0 ? rows[0] : null;
    }

    static async createEntry(companyId: number, data: any): Promise<any> {
        // Validate internal IDs
        const debitAccountId = await this.getInternalAccountId(data.debit_account_id, companyId);
        const creditAccountId = await this.getInternalAccountId(data.credit_account_id, companyId);

        if (!debitAccountId) throw new Error("Conta débito não encontrada");
        if (!creditAccountId) throw new Error("Conta crédito não encontrada");
        if (debitAccountId === creditAccountId) throw new Error("Débito e Crédito não podem ser a mesma conta");

        const publicId = randomUUID();
        
        await pool.query<ResultSetHeader>(
            `INSERT INTO accounting_entries 
             (public_id, company_id, entry_date, debit_account_id, credit_account_id, amount, document_ref, history, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                publicId,
                companyId,
                data.entry_date,
                debitAccountId,
                creditAccountId,
                data.amount,
                data.document_ref || null,
                data.history,
                data.status || 'active'
            ]
        );

        return this.getEntryByPublicId(publicId, companyId);
    }

    static async updateEntry(publicId: string, companyId: number, data: any): Promise<any> {
        const existing = await this.getEntryByPublicId(publicId, companyId);
        if (!existing) throw new Error("Lançamento não encontrado");

        const debitAccountId = await this.getInternalAccountId(data.debit_account_id, companyId);
        const creditAccountId = await this.getInternalAccountId(data.credit_account_id, companyId);

        if (!debitAccountId) throw new Error("Conta débito não encontrada");
        if (!creditAccountId) throw new Error("Conta crédito não encontrada");
        if (debitAccountId === creditAccountId) throw new Error("Débito e Crédito não podem ser a mesma conta");

        await pool.query<ResultSetHeader>(
            `UPDATE accounting_entries 
             SET entry_date = ?, debit_account_id = ?, credit_account_id = ?, amount = ?, document_ref = ?, history = ?, status = ?
             WHERE company_id = ? AND public_id = ?`,
            [
                data.entry_date,
                debitAccountId,
                creditAccountId,
                data.amount,
                data.document_ref || null,
                data.history,
                data.status || 'active',
                companyId,
                publicId
            ]
        );

        return this.getEntryByPublicId(publicId, companyId);
    }

    static async deleteEntry(publicId: string, companyId: number): Promise<boolean> {
        const [result] = await pool.query<ResultSetHeader>(
            'DELETE FROM accounting_entries WHERE company_id = ? AND public_id = ?',
            [companyId, publicId]
        );
        return result.affectedRows > 0;
    }

    static async batchImportEntries(companyId: number, entries: any[], matchBy: 'code' | 'easy_code' = 'code') {
        const result = { success: 0, errors: [] as string[] };
        const accountCache = new Map<string, number>();
        const columnToMatch = matchBy === 'easy_code' ? 'easy_code' : 'code';

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const lineNumber = i + 1;
            
            try {
                // Find Debit ID
                let debitId = accountCache.get(entry.debit_account_code);
                if (!debitId) {
                    const [rows] = await pool.query<RowDataPacket[]>(
                        `SELECT id FROM chart_of_accounts WHERE company_id = ? AND ${columnToMatch} = ? AND status = "active" AND type = "analytic"`,
                        [companyId, entry.debit_account_code]
                    );
                    if (rows.length === 0 || !rows[0]) throw new Error(`Conta débito '${entry.debit_account_code}' não encontrada ou não é analítica/ativa.`);
                    debitId = rows[0].id as number;
                    accountCache.set(entry.debit_account_code, debitId);
                }

                // Find Credit ID
                let creditId = accountCache.get(entry.credit_account_code);
                if (!creditId) {
                    const [rows] = await pool.query<RowDataPacket[]>(
                        `SELECT id FROM chart_of_accounts WHERE company_id = ? AND ${columnToMatch} = ? AND status = "active" AND type = "analytic"`,
                        [companyId, entry.credit_account_code]
                    );
                    if (rows.length === 0 || !rows[0]) throw new Error(`Conta crédito '${entry.credit_account_code}' não encontrada ou não é analítica/ativa.`);
                    creditId = rows[0].id as number;
                    accountCache.set(entry.credit_account_code, creditId);
                }

                if (debitId === creditId) throw new Error("Débito e Crédito não podem ser a mesma conta.");

                const publicId = randomUUID();
                await pool.query(
                    `INSERT INTO accounting_entries (company_id, public_id, entry_date, debit_account_id, credit_account_id, amount, document_ref, history, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
                    [companyId, publicId, entry.entry_date, debitId, creditId, entry.amount, entry.document_ref || null, entry.history]
                );

                result.success++;
            } catch (err: any) {
                result.errors.push(`Linha ${lineNumber}: ${err.message}`);
            }
        }
        
        return result;
    }
}
