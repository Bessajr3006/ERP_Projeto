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

    static async applyAutoTemplate(companyId: number, templateCode: string, data: { amount: number, entry_date: string, document_ref?: string, history_complement?: string }) {
        const [templateRows] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM accounting_auto_templates WHERE company_id = ? AND code = ? AND active = 1`,
            [companyId, templateCode]
        );
        const template = templateRows[0];
        if (!template) throw new Error("Template de Lançamento Automático não encontrado ou está inativo para o código informado.");
        
        const templateId = template.id;
        const [items] = await pool.query<RowDataPacket[]>(
            `SELECT debit_account_id, credit_account_id, history_template FROM accounting_auto_template_items WHERE template_id = ?`,
            [templateId]
        );
        
        if (items.length === 0) throw new Error("O template selecionado não possui itens configurados.");
        
        const generatedEntries = [];
        for (const item of items) {
            if (!item.debit_account_id || !item.credit_account_id) {
                throw new Error("Um dos itens do template não possui as contas de débito e crédito definidas corretamente.");
            }

            const publicId = randomUUID();
            const fullHistory = data.history_complement ? `${item.history_template} ${data.history_complement}`.trim() : item.history_template;
            
            await pool.query(
                `INSERT INTO accounting_entries (company_id, public_id, entry_date, debit_account_id, credit_account_id, amount, document_ref, history, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
                [
                    companyId, publicId, data.entry_date, item.debit_account_id, item.credit_account_id, 
                    data.amount, data.document_ref || null, fullHistory
                ]
            );
            generatedEntries.push(publicId);
        }
        
        return { success: true, count: generatedEntries.length };
    }

    static async verifySolidconEntries(companyId: number, entries: any[]) {
        if (!Array.isArray(entries) || entries.length === 0) {
            return {
                summary: { total: 0, validCount: 0, errorCount: 0, duplicateCount: 0 },
                results: []
            };
        }

        // 1. Fetch all accounts for the company to validate codes and types
        const [accountRows] = await pool.query<RowDataPacket[]>(
            `SELECT id, code, name, type, status FROM chart_of_accounts WHERE company_id = ?`,
            [companyId]
        );
        const accountMap = new Map<string, { id: number; name: string; type: string; status: string }>();
        accountRows.forEach((acc) => {
            if (acc.code) {
                accountMap.set(String(acc.code).trim(), {
                    id: Number(acc.id),
                    name: String(acc.name),
                    type: String(acc.type),
                    status: String(acc.status)
                });
            }
        });

        // 2. Determine min and max dates of the batch to query existing entries in Keystone
        const dates = entries
            .map(e => String(e.entry_date || '').split('T')[0])
            .filter(Boolean)
            .sort();
        const minDate = dates[0] || '1970-01-01';
        const maxDate = dates[dates.length - 1] || '2099-12-31';

        // Query active accounting entries in the date range with debit and credit account codes
        const [existingEntries] = await pool.query<RowDataPacket[]>(
            `SELECT ae.id, DATE_FORMAT(ae.entry_date, '%Y-%m-%d') as entry_date, 
                    ae.amount, ae.document_ref, ae.history,
                    da.code as debit_account_code, ca.code as credit_account_code
             FROM accounting_entries ae
             LEFT JOIN chart_of_accounts da ON da.id = ae.debit_account_id
             LEFT JOIN chart_of_accounts ca ON ca.id = ae.credit_account_id
             WHERE ae.company_id = ? 
               AND ae.status = 'active'
               AND ae.entry_date BETWEEN ? AND ?`,
            [companyId, minDate, maxDate]
        );

        // Map existing entries for fast O(1) duplicate lookup
        const existingKeys = new Set<string>();
        const existingDocKeys = new Set<string>();

        existingEntries.forEach(ex => {
            const date = String(ex.entry_date);
            const amt = Math.abs(Number(ex.amount)).toFixed(2);
            const deb = String(ex.debit_account_code || '').trim();
            const cred = String(ex.credit_account_code || '').trim();
            const doc = String(ex.document_ref || '').trim().toLowerCase();

            existingKeys.add(`${date}|${amt}|${deb}|${cred}`);
            if (doc && doc !== '-' && doc !== 'null' && doc !== 'undefined') {
                existingDocKeys.add(`${date}|${amt}|${doc}`);
            }
        });

        // Track batch duplicates within the query itself
        const batchKeysCount = new Map<string, number>();

        let validCount = 0;
        let errorCount = 0;
        let duplicateCount = 0;

        const results = entries.map((entry, index) => {
            const id = String(entry.id || index);
            const date = String(entry.entry_date || '').split('T')[0];
            const amount = Math.abs(Number(entry.amount) || 0);
            const amtFixed = amount.toFixed(2);
            const debitCode = String(entry.debit_account_code || '').trim();
            const creditCode = String(entry.credit_account_code || '').trim();
            const doc = String(entry.document_ref || '').trim().toLowerCase();

            const errors: string[] = [];
            const warnings: string[] = [];
            let isDuplicate = false;
            let duplicateReason = '';

            // Check date
            if (!date || isNaN(Date.parse(date))) {
                errors.push('Data do lançamento inválida ou ausente');
            }

            // Check amount
            if (amount <= 0 || isNaN(amount)) {
                errors.push('Valor do lançamento deve ser maior que zero');
            }

            // Check debit account
            if (!debitCode) {
                errors.push('Conta Débito não informada');
            } else {
                const acc = accountMap.get(debitCode);
                if (!acc) {
                    errors.push(`Conta Débito '${debitCode}' não encontrada no plano de contas`);
                } else if (acc.status !== 'active') {
                    errors.push(`Conta Débito '${debitCode}' está inativa`);
                } else if (acc.type !== 'analytic') {
                    errors.push(`Conta Débito '${debitCode}' é sintética (não aceita lançamentos)`);
                }
            }

            // Check credit account
            if (!creditCode) {
                errors.push('Conta Crédito não informada');
            } else {
                const acc = accountMap.get(creditCode);
                if (!acc) {
                    errors.push(`Conta Crédito '${creditCode}' não encontrada no plano de contas`);
                } else if (acc.status !== 'active') {
                    errors.push(`Conta Crédito '${creditCode}' está inativa`);
                } else if (acc.type !== 'analytic') {
                    errors.push(`Conta Crédito '${creditCode}' é sintética (não aceita lançamentos)`);
                }
            }

            // Check identical debit and credit
            if (debitCode && creditCode && debitCode === creditCode) {
                errors.push('Conta Débito e Conta Crédito não podem ser iguais');
            }

            // Check duplicate in Keystone
            const keyExact = `${date}|${amtFixed}|${debitCode}|${creditCode}`;
            if (debitCode && creditCode && existingKeys.has(keyExact)) {
                isDuplicate = true;
                duplicateReason = 'Lançamento idêntico já cadastrado no Keystone (mesma data, valor, débito e crédito)';
            } else if (doc && doc !== '-' && doc !== 'null' && doc !== 'undefined' && existingDocKeys.has(`${date}|${amtFixed}|${doc}`)) {
                isDuplicate = true;
                duplicateReason = `Documento '${entry.document_ref}' já cadastrado no Keystone com mesmo valor e data`;
            }

            // Check duplicate within the batch
            const batchKey = `${date}|${amtFixed}|${debitCode}|${creditCode}|${doc}`;
            const countInBatch = (batchKeysCount.get(batchKey) || 0) + 1;
            batchKeysCount.set(batchKey, countInBatch);
            if (countInBatch > 1 && !isDuplicate) {
                warnings.push(`Movimento repetido (${countInBatch}º ocorrência no lote)`);
            }

            const isValid = errors.length === 0 && !isDuplicate;
            if (isValid) {
                validCount++;
            } else if (isDuplicate) {
                duplicateCount++;
            } else {
                errorCount++;
            }

            return {
                id,
                isValid,
                isDuplicate,
                duplicateReason,
                errors,
                warnings,
                status: isValid ? 'valid' : (isDuplicate ? 'duplicate' : 'error')
            };
        });

        return {
            summary: {
                total: entries.length,
                validCount,
                errorCount,
                duplicateCount
            },
            results
        };
    }
}
