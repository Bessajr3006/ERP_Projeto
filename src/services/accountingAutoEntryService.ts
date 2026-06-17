import { z } from 'zod';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { randomUUID } from 'crypto';

export const accountingAutoTemplateSchema = z.object({
    code: z.string().min(1, 'Código é obrigatório').max(50, 'Código muito longo'),
    description: z.string().min(1, 'Descrição é obrigatória').max(255, 'Descrição muito longa'),
    active: z.boolean().default(true),
    items: z.array(z.object({
        debit_account_id: z.string().optional().nullable(),
        credit_account_id: z.string().optional().nullable(),
        history_template: z.string().min(1, 'Histórico é obrigatório').max(500, 'Histórico muito longo')
    })).min(1, 'O template deve ter pelo menos um item')
});

export type AccountingAutoTemplateData = z.infer<typeof accountingAutoTemplateSchema>;

export class AccountingAutoEntryService {
    // Aux: resolve public ID to Internal ID
    private static async getInternalAccountId(publicId: string | null | undefined, companyId: number, conn: any): Promise<number | null> {
        if (!publicId) return null;
        const [rows] = await conn.query(
            `SELECT id FROM chart_of_accounts WHERE public_id = ? AND company_id = ?`,
            [publicId, companyId]
        );
        return rows.length > 0 ? rows[0].id : null;
    }

    static async createTemplate(companyId: number, data: AccountingAutoTemplateData) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            
            const [existing] = await conn.query<RowDataPacket[]>(
                `SELECT id FROM accounting_auto_templates WHERE company_id = ? AND code = ?`,
                [companyId, data.code]
            );
            if (existing.length > 0) throw new Error('Já existe um template com este código para esta empresa.');

            const publicId = randomUUID();
            const [result] = await conn.query<ResultSetHeader>(
                `INSERT INTO accounting_auto_templates (public_id, company_id, code, description, active) VALUES (?, ?, ?, ?, ?)`,
                [publicId, companyId, data.code, data.description, data.active ? 1 : 0]
            );
            const templateId = result.insertId;

            for (const item of data.items) {
                if (!item.debit_account_id && !item.credit_account_id) {
                    throw new Error('É necessário informar pelo menos uma conta de débito ou crédito.');
                }
                const debitInternal = await this.getInternalAccountId(item.debit_account_id, companyId, conn);
                const creditInternal = await this.getInternalAccountId(item.credit_account_id, companyId, conn);
                
                await conn.query(
                    `INSERT INTO accounting_auto_template_items (public_id, template_id, debit_account_id, credit_account_id, history_template) VALUES (?, ?, ?, ?, ?)`,
                    [randomUUID(), templateId, debitInternal, creditInternal, item.history_template]
                );
            }

            await conn.commit();
            return { public_id: publicId, code: data.code, description: data.description };
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }

    static async updateTemplate(publicId: string, companyId: number, data: AccountingAutoTemplateData) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [tpl] = await conn.query<RowDataPacket[]>(
                `SELECT id FROM accounting_auto_templates WHERE public_id = ? AND company_id = ?`,
                [publicId, companyId]
            );
            const firstTpl = tpl[0];
            if (!firstTpl) throw new Error('Template não encontrado');
            const templateId = firstTpl.id;

            const [existingCode] = await conn.query<RowDataPacket[]>(
                `SELECT id FROM accounting_auto_templates WHERE company_id = ? AND code = ? AND id != ?`,
                [companyId, data.code, templateId]
            );
            if (existingCode.length > 0) throw new Error('Já existe um outro template com este código.');

            await conn.query(
                `UPDATE accounting_auto_templates SET code = ?, description = ?, active = ? WHERE id = ?`,
                [data.code, data.description, data.active ? 1 : 0, templateId]
            );

            await conn.query(`DELETE FROM accounting_auto_template_items WHERE template_id = ?`, [templateId]);

            for (const item of data.items) {
                if (!item.debit_account_id && !item.credit_account_id) {
                    throw new Error('É necessário informar pelo menos uma conta de débito ou crédito.');
                }
                const debitInternal = await this.getInternalAccountId(item.debit_account_id, companyId, conn);
                const creditInternal = await this.getInternalAccountId(item.credit_account_id, companyId, conn);

                await conn.query(
                    `INSERT INTO accounting_auto_template_items (public_id, template_id, debit_account_id, credit_account_id, history_template) VALUES (?, ?, ?, ?, ?)`,
                    [randomUUID(), templateId, debitInternal, creditInternal, item.history_template]
                );
            }

            await conn.commit();
            return { public_id: publicId, code: data.code };
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }

    static async getTemplates(companyId: number, search?: string) {
        let sql = `SELECT public_id as id, code, description, active, created_at FROM accounting_auto_templates WHERE company_id = ?`;
        const params: any[] = [companyId];

        if (search) {
            sql += ` AND (code LIKE ? OR description LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }
        sql += ` ORDER BY code ASC`;

        const [rows] = await pool.query<RowDataPacket[]>(sql, params);
        
        // Load items count or items if needed, for the list we might just need the basic structure, but frontend expects `items` array to show count
        for (const row of rows) {
            const [items] = await pool.query<RowDataPacket[]>(
                `SELECT id FROM accounting_auto_template_items 
                 WHERE template_id = (SELECT id FROM accounting_auto_templates WHERE public_id = ?)`,
                [row.id]
            );
            row.public_id = row.id;
            row.items = items;
        }

        return rows;
    }

    static async getTemplateWithItems(publicId: string, companyId: number) {
        const [tplRows] = await pool.query<RowDataPacket[]>(
            `SELECT id, public_id, code, description, active FROM accounting_auto_templates WHERE public_id = ? AND company_id = ?`,
            [publicId, companyId]
        );
        const template = tplRows[0];
        if (!template) throw new Error('Template não encontrado');

        const [items] = await pool.query<RowDataPacket[]>(
            `SELECT i.history_template, 
                    cd.public_id as debit_account_id, cc.public_id as credit_account_id,
                    cd.code as debit_code, cd.name as debit_name,
                    cc.code as credit_code, cc.name as credit_name
             FROM accounting_auto_template_items i
             LEFT JOIN chart_of_accounts cd ON cd.id = i.debit_account_id
             LEFT JOIN chart_of_accounts cc ON cc.id = i.credit_account_id
             WHERE i.template_id = ?`,
            [template.id]
        );

        return { ...template, items };
    }

    static async deleteTemplate(publicId: string, companyId: number) {
        const [tpl] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM accounting_auto_templates WHERE public_id = ? AND company_id = ?`,
            [publicId, companyId]
        );
        const firstTpl = tpl[0];
        if (!firstTpl) return false;

        await pool.query(`DELETE FROM accounting_auto_templates WHERE id = ?`, [firstTpl.id]);
        return true;
    }
}
