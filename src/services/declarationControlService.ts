import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import crypto from 'crypto';
import { z } from 'zod';

export const declarationStatusSchema = z.object({
    status: z.enum(['PENDENTE', 'ENTREGUE', 'SEM_MOVIMENTO', 'NAO_SE_APLICA']),
    delivery_date: z.string().optional().nullable(),
    receipt_url: z.string().optional().nullable(),
    receipt_base64: z.string().optional().nullable(),
    amount_due: z.number().optional().nullable(),
    due_date: z.string().optional().nullable(),
    gross_revenue: z.number().optional().nullable(),
    accumulated_revenue: z.number().optional().nullable(),
    document_period: z.string().optional().nullable(),
    receipt_number: z.string().optional().nullable()
});

export type DeclarationStatusData = z.infer<typeof declarationStatusSchema>;

export class DeclarationControlService {
    static async getDeclarations(companyId: number, month: number, year: number, type: string) {
        if (month === 0) {
            const sql = `
                SELECT 
                    c.id as customer_id, 
                    c.public_id as customer_public_id,
                    c.name as customer_name,
                    c.cnpj_cpf,
                    c.tax_regime,
                    d.public_id as declaration_id,
                    IFNULL(d.status, 'PENDENTE') as status,
                    d.competence_month,
                    d.delivery_date,
                    d.receipt_url,
                    d.amount_due,
                    d.due_date as d_due_date,
                    d.gross_revenue,
                    d.accumulated_revenue,
                    d.document_period,
                    d.receipt_number
                FROM customer_declarations d
                JOIN customers c ON d.customer_id = c.id
                WHERE d.company_id = ? 
                  AND d.competence_year = ? 
                  AND d.declaration_type = ?
                ORDER BY d.competence_month DESC, c.name ASC
            `;
            const params = [companyId, year, type];
            const [rows] = await pool.query<RowDataPacket[]>(sql, params);
            return rows;
        }

        // Obter o tax_regime configurado para o tipo de declaração
        const [declarationTypes] = await pool.query<RowDataPacket[]>(
            `SELECT tax_regime FROM declaration_types WHERE company_id = ? AND name = ? LIMIT 1`,
            [companyId, type]
        );
        const dtRegime = declarationTypes.length > 0 ? declarationTypes[0]?.tax_regime : null;

        let sql = `
            SELECT 
                c.id as customer_id, 
                c.public_id as customer_public_id,
                c.name as customer_name,
                c.cnpj_cpf,
                c.tax_regime,
                d.public_id as declaration_id,
                IFNULL(d.status, 'PENDENTE') as status,
                ? as competence_month,
                d.delivery_date,
                d.receipt_url,
                d.amount_due,
                d.due_date as d_due_date,
                d.gross_revenue,
                d.accumulated_revenue,
                d.document_period,
                d.receipt_number
            FROM customers c
            LEFT JOIN customer_declarations d 
                ON d.customer_id = c.id 
                AND d.company_id = ? 
                AND d.competence_month = ? 
                AND d.competence_year = ? 
                AND d.declaration_type = ?
            WHERE c.company_id = ?
              AND c.tax_regime IS NOT NULL 
              AND c.tax_regime != ''
        `;
        
        const params: any[] = [month, companyId, month, year, type, companyId];

        if (dtRegime) {
            // Map the internal enum-like value to the human-readable value stored in `customers` table
            let humanRegime = dtRegime;
            switch (dtRegime) {
                case 'SIMPLES_NACIONAL': humanRegime = 'Simples Nacional'; break;
                case 'LUCRO_PRESUMIDO': humanRegime = 'Lucro Presumido'; break;
                case 'LUCRO_REAL': humanRegime = 'Lucro Real'; break;
                case 'GERAL': humanRegime = 'Geral'; break;
                case 'MEI': humanRegime = 'MEI'; break;
                case 'PF': humanRegime = 'Pessoa Física'; break;
            }
            
            // Allow matching both formats just in case some are stored with the enum string
            sql += ` AND c.tax_regime IN (?, ?)`;
            params.push(dtRegime, humanRegime);
        }

        sql += ` ORDER BY c.name ASC`;

        const [rows] = await pool.query<RowDataPacket[]>(sql, params);
        
        return rows;
    }

    static async updateDeclaration(
        companyId: number, 
        customerPublicId: string, 
        month: number, 
        year: number, 
        type: string, 
        data: DeclarationStatusData
    ) {
        // Encontrar o ID interno do cliente
        const [customers] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM customers WHERE public_id = ? AND company_id = ?`,
            [customerPublicId, companyId]
        );

        const customerRow = customers[0];
        if (!customerRow) {
            throw new Error('Cliente não encontrado.');
        }

        const customerId = customerRow.id;

        // Verificar se a declaração já existe
        const [declarations] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM customer_declarations WHERE company_id = ? AND customer_id = ? AND competence_month = ? AND competence_year = ? AND declaration_type = ?`,
            [companyId, customerId, month, year, type]
        );

        // REGRA: O acumulado é o faturamento do mês atual + o acumulado do mês anterior
        if (data.gross_revenue != null) {
            let prevMonth = month - 1;
            let prevYear = year;
            if (prevMonth === 0) {
                prevMonth = 12;
                prevYear = year - 1;
            }

            const [prevRows] = await pool.query<RowDataPacket[]>(
                `SELECT accumulated_revenue FROM customer_declarations 
                 WHERE company_id = ? AND customer_id = ? AND competence_month = ? AND competence_year = ? AND declaration_type = ?`,
                [companyId, customerId, prevMonth, prevYear, type]
            );

            const prevRow = prevRows[0];
            const prevAccumulated = prevRow && prevRow.accumulated_revenue != null 
                ? parseFloat(prevRow.accumulated_revenue) 
                : 0;

            data.accumulated_revenue = parseFloat(((data.gross_revenue ?? 0) + prevAccumulated).toFixed(2));
        }

        let declarationPublicId;

        if (declarations.length > 0) {
            const declarationRow = declarations[0];
            if (declarationRow) {
                // Atualizar
                await pool.query(
                    `UPDATE customer_declarations 
                     SET status = ?, delivery_date = ?, receipt_url = ?, 
                         amount_due = ?, due_date = ?, gross_revenue = ?, accumulated_revenue = ?, document_period = ?, receipt_number = ?
                     WHERE id = ?`,
                    [
                        data.status, data.delivery_date || null, data.receipt_url || null, 
                        data.amount_due ?? null, data.due_date ?? null, data.gross_revenue ?? null, data.accumulated_revenue ?? null, data.document_period ?? null, data.receipt_number ?? null,
                        declarationRow.id
                    ]
                );
            }
        } else {
            // Inserir
            declarationPublicId = crypto.randomUUID();
            await pool.query(
                `INSERT INTO customer_declarations 
                 (public_id, company_id, customer_id, competence_month, competence_year, declaration_type, status, delivery_date, receipt_url, amount_due, due_date, gross_revenue, accumulated_revenue, document_period, receipt_number) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    declarationPublicId, companyId, customerId, month, year, type, data.status, data.delivery_date || null, data.receipt_url || null,
                    data.amount_due ?? null, data.due_date ?? null, data.gross_revenue ?? null, data.accumulated_revenue ?? null, data.document_period ?? null, data.receipt_number ?? null
                ]
            );
        }

        return { success: true };
    }

    static async deleteDeclaration(companyId: number, customerPublicId: string, month: number, year: number, type: string) {
        const [customers] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM customers WHERE public_id = ? AND company_id = ?`,
            [customerPublicId, companyId]
        );

        const customer = customers[0];
        if (!customer) throw new Error('Cliente não encontrado.');
        const customerId = customer.id;

        console.log(`[DELETE DECLARATION] Deleting for company=${companyId}, customerId=${customerId}, month=${month}, year=${year}, type=${type}`);

        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM customer_declarations WHERE company_id = ? AND customer_id = ? AND competence_month = ? AND competence_year = ? AND declaration_type = ?`,
            [companyId, customerId, month, year, type]
        );

        console.log(`[DELETE DECLARATION] Affected rows: ${result.affectedRows}`);
    }
}
