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
    static async getDeclarations(
        companyId: number, 
        month: number, 
        year: number, 
        type?: string | null,
        taxRegime?: string | null,
        customerFilter?: string | null
    ) {
        // 1. Obter os tipos de declarações ativos da empresa
        let dtQuery = `SELECT id, public_id, name, description, frequency, due_day, tax_regime FROM declaration_types WHERE company_id = ? AND active = 1`;
        const dtParams: any[] = [companyId];
        const isSpecificType = Boolean(type && type !== 'todos' && type.trim() !== '');
        if (isSpecificType) {
            dtQuery += ` AND name = ?`;
            dtParams.push(type!.trim());
        }
        dtQuery += ` ORDER BY name ASC`;
        const [declarationTypes] = await pool.query<RowDataPacket[]>(dtQuery, dtParams);

        // 2. Obter os clientes da empresa aplicando filtros de regime tributário e busca de cliente se informados
        let custQuery = `
            SELECT id, public_id, name, cnpj_cpf, tax_regime 
            FROM customers 
            WHERE company_id = ?
              AND tax_regime IS NOT NULL 
              AND TRIM(tax_regime) != ''
        `;
        const custParams: any[] = [companyId];

        if (taxRegime && taxRegime !== 'todos' && taxRegime.trim() !== '') {
            const rawReg = taxRegime.trim().toUpperCase();
            const allowed = [taxRegime.trim()];
            if (rawReg === 'SIMPLES_NACIONAL' || rawReg === 'SIMPLES NACIONAL') {
                allowed.push('SIMPLES_NACIONAL', 'Simples Nacional');
            } else if (rawReg === 'LUCRO_PRESUMIDO' || rawReg === 'LUCRO PRESUMIDO') {
                allowed.push('LUCRO_PRESUMIDO', 'Lucro Presumido');
            } else if (rawReg === 'LUCRO_REAL' || rawReg === 'LUCRO REAL') {
                allowed.push('LUCRO_REAL', 'Lucro Real');
            } else if (rawReg === 'MEI') {
                allowed.push('MEI');
            } else if (rawReg === 'PF' || rawReg === 'PESSOA_FISICA' || rawReg === 'PESSOA FÍSICA') {
                allowed.push('PF', 'Pessoa Física', 'PESSOA_FISICA');
            } else if (rawReg.includes('OUTROS') || rawReg.includes('ISENTO')) {
                allowed.push('OUTROS', 'Outros / Isento', 'Outros');
            }
            const uniqueAllowed = Array.from(new Set(allowed));
            custQuery += ` AND tax_regime IN (${uniqueAllowed.map(() => '?').join(', ')})`;
            custParams.push(...uniqueAllowed);
        }

        if (customerFilter && customerFilter.trim() !== '') {
            const search = `%${customerFilter.trim()}%`;
            custQuery += ` AND (name LIKE ? OR cnpj_cpf LIKE ?)`;
            custParams.push(search, search);
        }

        custQuery += ` ORDER BY name ASC`;
        const [customers] = await pool.query<RowDataPacket[]>(custQuery, custParams);

        // 3. Obter as declarações já salvas no banco
        let declQuery = `
            SELECT 
                id, public_id, customer_id, competence_month, competence_year, declaration_type,
                status, delivery_date, receipt_url, amount_due, due_date,
                gross_revenue, accumulated_revenue, document_period, receipt_number
            FROM customer_declarations
            WHERE company_id = ? AND competence_year = ?
        `;
        const declParams: any[] = [companyId, year];
        if (month > 0) {
            declQuery += ` AND competence_month = ?`;
            declParams.push(month);
        }
        if (isSpecificType) {
            declQuery += ` AND declaration_type = ?`;
            declParams.push(type!.trim());
        }
        const [existingDeclarations] = await pool.query<RowDataPacket[]>(declQuery, declParams);

        const declMap = new Map<string, any>();
        for (const d of existingDeclarations) {
            const key = `${d.customer_id}_${d.competence_month}_${String(d.declaration_type || '').toUpperCase()}`;
            declMap.set(key, d);
        }

        const matchesTaxRegime = (custRegimeRaw: string | null | undefined, declRegimeRaw: string | null | undefined): boolean => {
            if (!declRegimeRaw || declRegimeRaw.trim() === '') return true;
            const decRegimes = declRegimeRaw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
            if (decRegimes.length === 0 || decRegimes.includes('GERAL')) return true;
            
            if (!custRegimeRaw || custRegimeRaw.trim() === '') return false;
            const cReg = custRegimeRaw.trim().toUpperCase();

            for (const dReg of decRegimes) {
                if (dReg === cReg) return true;
                if (dReg === 'SIMPLES_NACIONAL' && (cReg === 'SIMPLES NACIONAL' || cReg === 'SIMPLES_NACIONAL')) return true;
                if (dReg === 'LUCRO_PRESUMIDO' && (cReg === 'LUCRO PRESUMIDO' || cReg === 'LUCRO_PRESUMIDO')) return true;
                if (dReg === 'LUCRO_REAL' && (cReg === 'LUCRO REAL' || cReg === 'LUCRO_REAL')) return true;
                if (dReg === 'MEI' && cReg === 'MEI') return true;
                if ((dReg === 'PF' || dReg === 'PESSOA_FISICA') && (cReg === 'PF' || cReg === 'PESSOA FÍSICA' || cReg === 'PESSOA FISICA' || cReg === 'PESSOA_FISICA')) return true;
                if ((dReg === 'OUTROS' || dReg === 'OUTROS_ISENTO') && (cReg.includes('OUTROS') || cReg.includes('ISENTO'))) return true;
            }
            return false;
        };

        const results: any[] = [];
        const monthsToList = month === 0 ? (
            existingDeclarations.length > 0 
                ? Array.from(new Set(existingDeclarations.map(d => d.competence_month))).sort((a, b) => b - a) 
                : [new Date().getMonth() + 1]
        ) : [month];

        for (const m of monthsToList) {
            for (const cust of customers) {
                // Obter os tipos de declaração aplicáveis para este cliente
                let applicableTypes = declarationTypes.filter(dt => matchesTaxRegime(cust.tax_regime, dt.tax_regime));

                if (isSpecificType && applicableTypes.length === 0 && declarationTypes.length > 0) {
                    applicableTypes = declarationTypes.filter(dt => dt.name.toUpperCase() === type!.trim().toUpperCase());
                }

                if (applicableTypes.length > 0) {
                    for (const dt of applicableTypes) {
                        const key = `${cust.id}_${m}_${String(dt.name).toUpperCase()}`;
                        const d = declMap.get(key);

                        results.push({
                            customer_id: cust.id,
                            customer_public_id: cust.public_id,
                            customer_name: cust.name,
                            cnpj_cpf: cust.cnpj_cpf,
                            tax_regime: cust.tax_regime,
                            declaration_type: dt.name,
                            declaration_type_public_id: dt.public_id,
                            declaration_id: d?.public_id || null,
                            status: d?.status || 'PENDENTE',
                            competence_month: d?.competence_month || m,
                            delivery_date: d?.delivery_date || null,
                            receipt_url: d?.receipt_url || null,
                            amount_due: d?.amount_due || null,
                            d_due_date: d?.due_date || null,
                            gross_revenue: d?.gross_revenue || null,
                            accumulated_revenue: d?.accumulated_revenue || null,
                            document_period: d?.document_period || null,
                            receipt_number: d?.receipt_number || null
                        });
                    }
                } else if (isSpecificType) {
                    const key = `${cust.id}_${m}_${type!.trim().toUpperCase()}`;
                    const d = declMap.get(key);
                    results.push({
                        customer_id: cust.id,
                        customer_public_id: cust.public_id,
                        customer_name: cust.name,
                        cnpj_cpf: cust.cnpj_cpf,
                        tax_regime: cust.tax_regime,
                        declaration_type: type!.trim(),
                        declaration_type_public_id: null,
                        declaration_id: d?.public_id || null,
                        status: d?.status || 'PENDENTE',
                        competence_month: d?.competence_month || m,
                        delivery_date: d?.delivery_date || null,
                        receipt_url: d?.receipt_url || null,
                        amount_due: d?.amount_due || null,
                        d_due_date: d?.due_date || null,
                        gross_revenue: d?.gross_revenue || null,
                        accumulated_revenue: d?.accumulated_revenue || null,
                        document_period: d?.document_period || null,
                        receipt_number: d?.receipt_number || null
                    });
                }
            }
        }

        if (month === 0) {
            results.sort((a, b) => {
                if (b.competence_month !== a.competence_month) return b.competence_month - a.competence_month;
                if (a.customer_name !== b.customer_name) return a.customer_name.localeCompare(b.customer_name);
                return (a.declaration_type || '').localeCompare(b.declaration_type || '');
            });
        }

        return results;
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
