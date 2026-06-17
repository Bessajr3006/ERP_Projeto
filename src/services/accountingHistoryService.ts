import { z } from 'zod';
import crypto from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export const accountingHistorySchema = z.object({
    code: z.string().min(1, 'Código é obrigatório').max(50, 'Código muito longo'),
    description: z.string().min(1, 'Descrição é obrigatória').max(255, 'Descrição muito longa'),
    history_text: z.string().min(1, 'O histórico é obrigatório'),
    active: z.boolean().default(true)
});

export type AccountingHistoryData = z.infer<typeof accountingHistorySchema>;

export class AccountingHistoryService {
    static async create(companyId: number, data: AccountingHistoryData) {
        const [existing] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM accounting_histories WHERE company_id = ? AND code = ?`,
            [companyId, data.code]
        );

        if (existing.length > 0) {
            throw new Error(`O código '${data.code}' já está em uso para esta empresa.`);
        }

        const publicId = crypto.randomUUID();
        await pool.query(
            `INSERT INTO accounting_histories (public_id, company_id, code, description, history_text, active) VALUES (?, ?, ?, ?, ?, ?)`,
            [publicId, companyId, data.code, data.description, data.history_text, data.active]
        );

        return { public_id: publicId, code: data.code };
    }

    static async getHistories(companyId: number, search?: string) {
        let sql = `SELECT public_id as id, code, description, active, created_at FROM accounting_histories WHERE company_id = ?`;
        const params: any[] = [companyId];

        if (search) {
            sql += ` AND (code LIKE ? OR description LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += ` ORDER BY code ASC`;

        const [rows] = await pool.query<RowDataPacket[]>(sql, params);
        return rows.map(r => ({ ...r, active: Boolean(r.active) }));
    }

    static async getHistory(publicId: string, companyId: number) {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT public_id, code, description, history_text, active FROM accounting_histories WHERE public_id = ? AND company_id = ?`,
            [publicId, companyId]
        );

        if (rows.length === 0) {
            throw new Error('Histórico não encontrado');
        }

        const row = rows[0];
        if (!row) throw new Error('Histórico não encontrado');

        return { ...row, active: Boolean(row.active) };
    }

    static async update(publicId: string, companyId: number, data: AccountingHistoryData) {
        const [histories] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM accounting_histories WHERE public_id = ? AND company_id = ?`,
            [publicId, companyId]
        );

        if (histories.length === 0) {
            throw new Error('Histórico não encontrado');
        }

        const historyRow = histories[0];
        if (!historyRow) throw new Error('Histórico não encontrado');

        const historyId = historyRow.id;

        const [existing] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM accounting_histories WHERE company_id = ? AND code = ? AND id != ?`,
            [companyId, data.code, historyId]
        );

        if (existing.length > 0) {
            throw new Error(`O código '${data.code}' já está em uso para esta empresa.`);
        }

        await pool.query(
            `UPDATE accounting_histories SET code = ?, description = ?, history_text = ?, active = ? WHERE id = ?`,
            [data.code, data.description, data.history_text, data.active, historyId]
        );

        return { public_id: publicId, code: data.code };
    }

    static async delete(publicId: string, companyId: number) {
        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM accounting_histories WHERE public_id = ? AND company_id = ?`,
            [publicId, companyId]
        );
        return result.affectedRows > 0;
    }
}
