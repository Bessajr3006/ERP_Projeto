import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { Fechamento, CreateFechamentoData, UpdateFechamentoData } from '../types/Fechamento';
import { AppError } from '../errors/AppError';
import { DOMParser } from '@xmldom/xmldom';
import { EntityRepository } from '../repositories/entityRepository';

export class FechamentoService {
    private static async validateCustomer(customerId: number, companyId: number): Promise<void> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM customers WHERE id = ? AND company_id = ? LIMIT 1`,
            [customerId, companyId]
        );
        if (!rows || rows.length === 0) {
            throw new AppError('Cliente não encontrado ou não pertence a esta empresa', 404);
        }
    }

    static async create(companyId: number, data: CreateFechamentoData): Promise<Fechamento> {
        const customerId = Number(data.customerId);
        await this.validateCustomer(customerId, companyId);

        // Check if there is already a closing for this customer and competence
        const [existing] = await pool.query<RowDataPacket[]>(
            `SELECT id, public_id FROM fechamentos 
             WHERE company_id = ? AND customer_id = ? AND competencia = ? LIMIT 1`,
            [companyId, customerId, data.competencia]
        );

        if (existing && existing.length > 0 && existing[0]?.public_id) {
            return this.update(existing[0].public_id, companyId, data as any);
        }

        const publicId = randomUUID();

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO fechamentos (
                public_id, company_id, customer_id, competencia,
                compra_valor, compra_bs_icms, compra_isento, compra_outros, compra_pis, compra_cofins,
                venda_valor, venda_bs_icms, venda_isento, venda_outros, venda_pis, venda_cofins,
                apuracao_icms, apuracao_fecp, apuracao_pis, apuracao_cofins, apuracao_aj_icms, apuracao_aj_fecp, apuracao_aj_pis, apuracao_aj_cofins,
                despesa_adm, despesa_operacional, despesa_folha, despesa_cmv, despesa_ir_aluguel,
                imposto_irpj, imposto_csll,
                simples_faturamento, simples_aliquota, simples_das,
                simples_cpp, simples_icms, simples_ipi, simples_iss, simples_pis, simples_cofins, simples_irpj, simples_csll,
                simples_faturamento_acumulado_12m, simples_faturamento_acumulado_ano_anterior,
                simples_valor_tributado, simples_valor_nao_tributado,
                observacao
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )`,
            [
                publicId,
                companyId,
                customerId,
                data.competencia,
                data.compra?.valor ?? 0,
                data.compra?.bs_icms ?? 0,
                data.compra?.isento ?? 0,
                data.compra?.outros ?? 0,
                data.compra?.pis ?? 0,
                data.compra?.cofins ?? 0,
                data.venda?.valor ?? 0,
                data.venda?.bs_icms ?? 0,
                data.venda?.isento ?? 0,
                data.venda?.outros ?? 0,
                data.venda?.pis ?? 0,
                data.venda?.cofins ?? 0,
                data.apuracao?.icms ?? 0,
                data.apuracao?.fecp ?? 0,
                data.apuracao?.pis ?? 0,
                data.apuracao?.cofins ?? 0,
                data.apuracao?.aj_icms ?? 0,
                data.apuracao?.aj_fecp ?? 0,
                data.apuracao?.aj_pis ?? 0,
                data.apuracao?.aj_cofins ?? 0,
                data.despesa?.adm ?? 0,
                data.despesa?.operacional ?? 0,
                data.despesa?.folha ?? 0,
                data.despesa?.cmv ?? 0,
                data.despesa?.ir_aluguel ?? 0,
                data.imposto_federal?.irpj ?? 0,
                data.imposto_federal?.csll ?? 0,
                data.simples?.faturamento ?? 0,
                data.simples?.aliquota ?? 0,
                data.simples?.das ?? 0,
                data.simples?.cpp ?? 0,
                data.simples?.icms ?? 0,
                data.simples?.ipi ?? 0,
                data.simples?.iss ?? 0,
                data.simples?.pis ?? 0,
                data.simples?.cofins ?? 0,
                data.simples?.irpj ?? 0,
                data.simples?.csll ?? 0,
                data.simples?.faturamento_acumulado_12m ?? 0,
                data.simples?.faturamento_acumulado_ano_anterior ?? 0,
                data.simples?.valor_tributado ?? 0,
                data.simples?.valor_nao_tributado ?? 0,
                data.observacao ?? null,
            ]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Falha ao registrar o fechamento.');
        }

        return this.getById(result.insertId, companyId);
    }

    static async getById(id: number, companyId: number): Promise<Fechamento> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT f.*, 
                    COALESCE(c.name, (SELECT comp.company_name FROM companies comp WHERE comp.id = f.company_id), 'Empresa') AS customer_name, 
                    COALESCE(c.trade_name, (SELECT comp.trade_name FROM companies comp WHERE comp.id = f.company_id), '-') AS customer_trade_name, 
                    COALESCE(c.cnpj_cpf, (SELECT comp.cnpj FROM companies comp WHERE comp.id = f.company_id), '-') AS customer_cnpj_cpf,
                    c.tax_regime AS customer_tax_regime,
                    COALESCE(cg.name, cgp.name, cg_comp.name, '-') AS customer_group_name,
                    COALESCE(c.customer_group_id, (SELECT comp_cg.default_customer_group_id FROM companies comp_cg WHERE comp_cg.id = f.company_id)) AS customer_group_id,
                    c.inscricao_estadual AS customer_ie,
                    c.inscricao_municipal AS customer_im,
                    c.city AS customer_city,
                    c.state AS customer_state,
                    c.street AS customer_street,
                    c.number AS customer_number,
                    c.neighborhood AS customer_neighborhood,
                    c.zipcode AS customer_zipcode,
                    (CASE WHEN c.cnpj_cpf IS NOT NULL AND c.cnpj_cpf != '' THEN (SELECT COUNT(*) FROM companies comp WHERE REPLACE(REPLACE(REPLACE(REPLACE(comp.cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = REPLACE(REPLACE(REPLACE(REPLACE(c.cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '')) > 0 ELSE 0 END) AS is_registered_as_company,
                    (SELECT comp.id FROM companies comp WHERE REPLACE(REPLACE(REPLACE(REPLACE(comp.cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = REPLACE(REPLACE(REPLACE(REPLACE(c.cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '') LIMIT 1) AS registered_company_id,
                    (SELECT COALESCE(comp.trade_name, comp.company_name) FROM companies comp WHERE REPLACE(REPLACE(REPLACE(REPLACE(comp.cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = REPLACE(REPLACE(REPLACE(REPLACE(c.cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '') LIMIT 1) AS registered_company_name,
                    CASE 
                        WHEN f.observacao LIKE '%Importado%' OR f.observacao LIKE '%SPED%' OR f.observacao LIKE '%XML%' THEN 'Arquivo'
                        ELSE 'Manual'
                    END AS origem
             FROM fechamentos f
             LEFT JOIN customers c ON f.customer_id = c.id
             LEFT JOIN customer_groups cg ON c.customer_group_id = cg.id
             LEFT JOIN companies comp_ref ON f.company_id = comp_ref.id
             LEFT JOIN company_groups cgp ON comp_ref.company_group_id = cgp.id
             LEFT JOIN customer_groups cg_comp ON comp_ref.default_customer_group_id = cg_comp.id
             WHERE f.id = ? AND f.company_id = ? LIMIT 1`,
            [id, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new AppError('Fechamento não encontrado.', 404);
        }

        return rows[0] as Fechamento;
    }

    static async getByPublicId(publicId: string, companyId: number): Promise<Fechamento> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT f.*, 
                    COALESCE(c.name, (SELECT comp.company_name FROM companies comp WHERE comp.id = f.company_id), 'Empresa') AS customer_name, 
                    COALESCE(c.trade_name, (SELECT comp.trade_name FROM companies comp WHERE comp.id = f.company_id), '-') AS customer_trade_name, 
                    COALESCE(c.cnpj_cpf, (SELECT comp.cnpj FROM companies comp WHERE comp.id = f.company_id), '-') AS customer_cnpj_cpf,
                    c.tax_regime AS customer_tax_regime,
                    COALESCE(cg.name, cgp.name, cg_comp.name, '-') AS customer_group_name,
                    COALESCE(c.customer_group_id, (SELECT comp_cg.default_customer_group_id FROM companies comp_cg WHERE comp_cg.id = f.company_id)) AS customer_group_id,
                    c.inscricao_estadual AS customer_ie,
                    c.inscricao_municipal AS customer_im,
                    c.city AS customer_city,
                    c.state AS customer_state,
                    c.street AS customer_street,
                    c.number AS customer_number,
                    c.neighborhood AS customer_neighborhood,
                    c.zipcode AS customer_zipcode,
                    (CASE WHEN c.cnpj_cpf IS NOT NULL AND c.cnpj_cpf != '' THEN (SELECT COUNT(*) FROM companies comp WHERE REPLACE(REPLACE(REPLACE(REPLACE(comp.cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = REPLACE(REPLACE(REPLACE(REPLACE(c.cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '')) > 0 ELSE 0 END) AS is_registered_as_company,
                    (SELECT comp.id FROM companies comp WHERE REPLACE(REPLACE(REPLACE(REPLACE(comp.cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = REPLACE(REPLACE(REPLACE(REPLACE(c.cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '') LIMIT 1) AS registered_company_id,
                    (SELECT COALESCE(comp.trade_name, comp.company_name) FROM companies comp WHERE REPLACE(REPLACE(REPLACE(REPLACE(comp.cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = REPLACE(REPLACE(REPLACE(REPLACE(c.cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '') LIMIT 1) AS registered_company_name,
                    CASE 
                        WHEN f.observacao LIKE '%Importado%' OR f.observacao LIKE '%SPED%' OR f.observacao LIKE '%XML%' THEN 'Arquivo'
                        ELSE 'Manual'
                    END AS origem
             FROM fechamentos f
             LEFT JOIN customers c ON f.customer_id = c.id
             LEFT JOIN customer_groups cg ON c.customer_group_id = cg.id
             LEFT JOIN companies comp_ref ON f.company_id = comp_ref.id
             LEFT JOIN company_groups cgp ON comp_ref.company_group_id = cgp.id
             LEFT JOIN customer_groups cg_comp ON comp_ref.default_customer_group_id = cg_comp.id
             WHERE f.public_id = ? AND f.company_id = ? LIMIT 1`,
            [publicId, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new AppError('Fechamento não encontrado.', 404);
        }

        return rows[0] as Fechamento;
    }

    static async list(companyId: number | number[], filters?: { customerId?: number; competencia?: string; customerGroupId?: number; taxRegime?: string }): Promise<Fechamento[]> {
        const conditions: string[] = [];
        const values: any[] = [];

        if (Array.isArray(companyId)) {
            if (companyId.length === 0) {
                return [];
            }
            conditions.push(`f.company_id IN (${companyId.map(() => '?').join(',')})`);
            values.push(...companyId);
        } else {
            conditions.push('f.company_id = ?');
            values.push(companyId);
        }

        if (filters?.customerId) {
            conditions.push(`(
                f.customer_id = ?
                OR comp.id IN (
                    SELECT comp_match.id FROM companies comp_match 
                    JOIN customers cust_match ON LPAD(REPLACE(REPLACE(REPLACE(REPLACE(cust_match.cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', ''), 14, '0') = LPAD(REPLACE(REPLACE(REPLACE(REPLACE(comp_match.cnpj, '.', ''), '-', ''), '/', ''), ' ', ''), 14, '0')
                    WHERE cust_match.id = ? AND cust_match.cnpj_cpf IS NOT NULL AND cust_match.cnpj_cpf != ''
                )
                OR comp.id IN (
                    SELECT comp_match2.id FROM companies comp_match2 
                    JOIN customers cust_match2 ON (
                        LOWER(TRIM(comp_match2.trade_name)) = LOWER(TRIM(cust_match2.trade_name))
                        OR LOWER(TRIM(comp_match2.trade_name)) = LOWER(TRIM(cust_match2.name))
                        OR LOWER(TRIM(comp_match2.company_name)) = LOWER(TRIM(cust_match2.name))
                    )
                    WHERE cust_match2.id = ?
                )
            )`);
            values.push(filters.customerId, filters.customerId, filters.customerId);
        }

        if (filters?.competencia) {
            const rawComp = String(filters.competencia).trim();
            let altComp = rawComp;
            if (rawComp.includes('-')) {
                const parts = rawComp.split('-');
                if (parts.length === 2) {
                    const y = parts[0]!.padStart(4, '0');
                    const m = parts[1]!.padStart(2, '0');
                    altComp = `${m}/${y}`;
                }
            } else if (rawComp.includes('/')) {
                const parts = rawComp.split('/');
                if (parts.length === 2) {
                    const m = parts[0]!.padStart(2, '0');
                    const y = parts[1]!.padStart(4, '0');
                    altComp = `${y}-${m}`;
                }
            }
            conditions.push('(f.competencia = ? OR f.competencia = ?)');
            values.push(rawComp, altComp);
        }

        if (filters?.customerGroupId) {
            conditions.push(`(
                c.customer_group_id = ?
                OR c.customer_group_id IN (
                    SELECT cg_same.id FROM customer_groups cg_same 
                    JOIN customer_groups cg_ref ON LOWER(TRIM(cg_same.name)) = LOWER(TRIM(cg_ref.name)) 
                    WHERE cg_ref.id = ?
                )
                OR comp.default_customer_group_id = ?
                OR comp.default_customer_group_id IN (
                    SELECT cg_same2.id FROM customer_groups cg_same2 
                    JOIN customer_groups cg_ref2 ON LOWER(TRIM(cg_same2.name)) = LOWER(TRIM(cg_ref2.name)) 
                    WHERE cg_ref2.id = ?
                )
                OR comp.company_group_id = ?
                OR comp.company_group_id IN (
                    SELECT cgp.id FROM company_groups cgp 
                    JOIN customer_groups cg_sel ON LOWER(TRIM(cgp.name)) = LOWER(TRIM(cg_sel.name)) 
                    WHERE cg_sel.id = ?
                )
                OR comp.id IN (
                    SELECT comp2.id FROM companies comp2 
                    JOIN customers cust2 ON LPAD(REPLACE(REPLACE(REPLACE(REPLACE(cust2.cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', ''), 14, '0') = LPAD(REPLACE(REPLACE(REPLACE(REPLACE(comp2.cnpj, '.', ''), '-', ''), '/', ''), ' ', ''), 14, '0')
                    WHERE (
                        cust2.customer_group_id = ?
                        OR cust2.customer_group_id IN (
                            SELECT cg_sub.id FROM customer_groups cg_sub 
                            JOIN customer_groups cg_ref3 ON LOWER(TRIM(cg_sub.name)) = LOWER(TRIM(cg_ref3.name)) 
                            WHERE cg_ref3.id = ?
                        )
                    )
                    AND cust2.cnpj_cpf IS NOT NULL AND cust2.cnpj_cpf != ''
                )
                OR comp.id IN (
                    SELECT comp3.id FROM companies comp3 
                    JOIN customers cust3 ON (
                        LOWER(TRIM(comp3.trade_name)) = LOWER(TRIM(cust3.trade_name)) 
                        OR LOWER(TRIM(comp3.trade_name)) = LOWER(TRIM(cust3.name)) 
                        OR LOWER(TRIM(comp3.company_name)) = LOWER(TRIM(cust3.name))
                    )
                    WHERE (
                        cust3.customer_group_id = ?
                        OR cust3.customer_group_id IN (
                            SELECT cg_sub2.id FROM customer_groups cg_sub2 
                            JOIN customer_groups cg_ref4 ON LOWER(TRIM(cg_sub2.name)) = LOWER(TRIM(cg_ref4.name)) 
                            WHERE cg_ref4.id = ?
                        )
                    )
                )
                OR LOWER(comp.trade_name) LIKE CONCAT('%', (SELECT LOWER(TRIM(cg_name.name)) FROM customer_groups cg_name WHERE cg_name.id = ? LIMIT 1), '%')
                OR LOWER(comp.company_name) LIKE CONCAT('%', (SELECT LOWER(TRIM(cg_name2.name)) FROM customer_groups cg_name2 WHERE cg_name2.id = ? LIMIT 1), '%')
            )`);
            values.push(
                filters.customerGroupId,
                filters.customerGroupId,
                filters.customerGroupId,
                filters.customerGroupId,
                filters.customerGroupId,
                filters.customerGroupId,
                filters.customerGroupId,
                filters.customerGroupId,
                filters.customerGroupId,
                filters.customerGroupId,
                filters.customerGroupId,
                filters.customerGroupId
            );
        }

        if (filters?.taxRegime && filters.taxRegime !== 'all') {
            const tr = filters.taxRegime.toLowerCase();
            if (tr === 'simples' || tr.includes('simples')) {
                conditions.push(`(
                    LOWER(COALESCE(c.tax_regime, comp.tax_regime, '')) LIKE '%simples%'
                    OR (f.simples_faturamento > 0 OR f.simples_das > 0 OR f.simples_valor_tributado > 0)
                )`);
            } else if (tr === 'lucro_presumido' || tr.includes('presumido')) {
                conditions.push(`(
                    LOWER(COALESCE(c.tax_regime, comp.tax_regime, '')) LIKE '%presumido%'
                    OR (f.compra_valor > 0 OR f.venda_valor > 0 OR f.apuracao_icms > 0)
                )`);
            } else if (tr === 'lucro_real' || tr.includes('real')) {
                conditions.push(`(
                    LOWER(COALESCE(c.tax_regime, comp.tax_regime, '')) LIKE '%real%'
                    OR (f.compra_valor > 0 OR f.venda_valor > 0 OR f.apuracao_icms > 0)
                )`);
            } else if (tr === 'lucro' || tr.includes('lucro')) {
                conditions.push(`(
                    LOWER(COALESCE(c.tax_regime, comp.tax_regime, '')) LIKE '%presumido%'
                    OR LOWER(COALESCE(c.tax_regime, comp.tax_regime, '')) LIKE '%real%'
                    OR (f.compra_valor > 0 OR f.venda_valor > 0 OR f.apuracao_icms > 0)
                )`);
            }
        }

        const query = `
            SELECT f.*, 
                   COALESCE(c.name, comp.company_name, comp.trade_name, 'Empresa') AS customer_name, 
                   COALESCE(c.trade_name, comp.trade_name, comp.company_name, '-') AS customer_trade_name, 
                   COALESCE(c.cnpj_cpf, comp.cnpj, '-') AS customer_cnpj_cpf,
                   COALESCE(c.tax_regime, comp.tax_regime, '-') AS customer_tax_regime,
                   COALESCE(cg.name, cgp.name, cg_comp.name, '-') AS customer_group_name,
                   COALESCE(c.customer_group_id, comp.default_customer_group_id) AS customer_group_id,
                   COALESCE(c.inscricao_estadual, comp.ie, '-') AS customer_ie,
                   COALESCE(c.inscricao_municipal, comp.im, '-') AS customer_im,
                   COALESCE(c.city, comp.city, '-') AS customer_city,
                   COALESCE(c.state, comp.state, '-') AS customer_state,
                   COALESCE(c.street, comp.street, '-') AS customer_street,
                   COALESCE(c.number, comp.number, '-') AS customer_number,
                   COALESCE(c.neighborhood, comp.neighborhood, '-') AS customer_neighborhood,
                   COALESCE(c.zipcode, comp.zipcode, '-') AS customer_zipcode,
                   (CASE WHEN (c.cnpj_cpf IS NOT NULL AND c.cnpj_cpf != '') OR (comp.cnpj IS NOT NULL AND comp.cnpj != '') THEN 1 ELSE 0 END) AS is_registered_as_company,
                   COALESCE(comp.id, (SELECT comp_sub.id FROM companies comp_sub WHERE REPLACE(REPLACE(REPLACE(REPLACE(comp_sub.cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = REPLACE(REPLACE(REPLACE(REPLACE(c.cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '') LIMIT 1)) AS registered_company_id,
                   COALESCE(comp.trade_name, comp.company_name, (SELECT COALESCE(comp_sub2.trade_name, comp_sub2.company_name) FROM companies comp_sub2 WHERE REPLACE(REPLACE(REPLACE(REPLACE(comp_sub2.cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = REPLACE(REPLACE(REPLACE(REPLACE(c.cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '') LIMIT 1)) AS registered_company_name,
                   CASE 
                       WHEN f.observacao LIKE '%Importado%' OR f.observacao LIKE '%SPED%' OR f.observacao LIKE '%XML%' THEN 'Arquivo'
                       ELSE 'Manual'
                   END AS origem
            FROM fechamentos f
            LEFT JOIN customers c ON f.customer_id = c.id
            LEFT JOIN companies comp ON f.company_id = comp.id
            LEFT JOIN customer_groups cg ON c.customer_group_id = cg.id
            LEFT JOIN company_groups cgp ON comp.company_group_id = cgp.id
            LEFT JOIN customer_groups cg_comp ON comp.default_customer_group_id = cg_comp.id
            WHERE ${conditions.join(' AND ')}
            ORDER BY f.competencia DESC, c.name ASC
        `;

        const [rows] = await pool.query<RowDataPacket[]>(query, values);
        return rows as Fechamento[];
    }

    static async update(publicId: string, companyId: number, data: UpdateFechamentoData): Promise<Fechamento> {
        const current = await this.getByPublicId(publicId, companyId);
        
        const updates: string[] = [];
        const values: any[] = [];

        if (data.customerId !== undefined) {
            const customerId = data.customerId ? Number(data.customerId) : null;
            if (customerId) {
                await this.validateCustomer(customerId, companyId);
            }
            updates.push('customer_id = ?');
            values.push(customerId);
        }

        if (data.competencia !== undefined) {
            updates.push('competencia = ?');
            values.push(data.competencia);
        }

        // Helper to queue updates
        const addUpdate = (columnName: string, val: number | undefined) => {
            if (val !== undefined) {
                updates.push(`${columnName} = ?`);
                values.push(val);
            }
        };

        addUpdate('compra_valor', data.compra?.valor);
        addUpdate('compra_bs_icms', data.compra?.bs_icms);
        addUpdate('compra_isento', data.compra?.isento);
        addUpdate('compra_outros', data.compra?.outros);
        addUpdate('compra_pis', data.compra?.pis);
        addUpdate('compra_cofins', data.compra?.cofins);

        addUpdate('venda_valor', data.venda?.valor);
        addUpdate('venda_bs_icms', data.venda?.bs_icms);
        addUpdate('venda_isento', data.venda?.isento);
        addUpdate('venda_outros', data.venda?.outros);
        addUpdate('venda_pis', data.venda?.pis);
        addUpdate('venda_cofins', data.venda?.cofins);

        addUpdate('apuracao_icms', data.apuracao?.icms);
        addUpdate('apuracao_fecp', data.apuracao?.fecp);
        addUpdate('apuracao_pis', data.apuracao?.pis);
        addUpdate('apuracao_cofins', data.apuracao?.cofins);
        addUpdate('apuracao_aj_icms', data.apuracao?.aj_icms);
        addUpdate('apuracao_aj_fecp', data.apuracao?.aj_fecp);
        addUpdate('apuracao_aj_pis', data.apuracao?.aj_pis);
        addUpdate('apuracao_aj_cofins', data.apuracao?.aj_cofins);

        addUpdate('despesa_adm', data.despesa?.adm);
        addUpdate('despesa_operacional', data.despesa?.operacional);
        addUpdate('despesa_folha', data.despesa?.folha);
        addUpdate('despesa_cmv', data.despesa?.cmv);
        addUpdate('despesa_ir_aluguel', data.despesa?.ir_aluguel);

        addUpdate('imposto_irpj', data.imposto_federal?.irpj);
        addUpdate('imposto_csll', data.imposto_federal?.csll);

        addUpdate('simples_faturamento', data.simples?.faturamento);
        addUpdate('simples_aliquota', data.simples?.aliquota);
        addUpdate('simples_das', data.simples?.das);
        addUpdate('simples_cpp', data.simples?.cpp);
        addUpdate('simples_icms', data.simples?.icms);
        addUpdate('simples_ipi', data.simples?.ipi);
        addUpdate('simples_iss', data.simples?.iss);
        addUpdate('simples_pis', data.simples?.pis);
        addUpdate('simples_cofins', data.simples?.cofins);
        addUpdate('simples_irpj', data.simples?.irpj);
        addUpdate('simples_csll', data.simples?.csll);
        addUpdate('simples_faturamento_acumulado_12m', data.simples?.faturamento_acumulado_12m);
        addUpdate('simples_faturamento_acumulado_ano_anterior', data.simples?.faturamento_acumulado_ano_anterior);
        addUpdate('simples_valor_tributado', data.simples?.valor_tributado);
        addUpdate('simples_valor_nao_tributado', data.simples?.valor_nao_tributado);

        if (data.observacao !== undefined) {
            updates.push('observacao = ?');
            values.push(data.observacao);
        }

        if (updates.length === 0) {
            return current;
        }

        // Check unique constraint if customerId or competencia is changed
        const newCustomerId = data.customerId !== undefined ? Number(data.customerId) : current.customer_id;
        const newCompetencia = data.competencia !== undefined ? data.competencia : current.competencia;

        if (newCustomerId !== current.customer_id || newCompetencia !== current.competencia) {
            const [existing] = await pool.query<RowDataPacket[]>(
                `SELECT id FROM fechamentos 
                 WHERE company_id = ? AND customer_id = ? AND competencia = ? AND id != ? LIMIT 1`,
                [companyId, newCustomerId, newCompetencia, current.id]
            );
            if (existing && existing.length > 0) {
                throw new AppError('Já existe um fechamento cadastrado para este cliente nesta competência.', 400);
            }
        }

        values.push(publicId, companyId);

        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE fechamentos 
             SET ${updates.join(', ')} 
             WHERE public_id = ? AND company_id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            throw new Error('Falha ao atualizar o fechamento.');
        }

        return this.getByPublicId(publicId, companyId);
    }

    static async delete(publicId: string, companyId: number): Promise<void> {
        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM fechamentos WHERE public_id = ? AND company_id = ?`,
            [publicId, companyId]
        );

        if (result.affectedRows === 0) {
            throw new AppError('Fechamento não encontrado.', 404);
        }
    }

    static async importSalesXml(
        companyId: number,
        userPublicId: string,
        customerId: number,
        xmlContents: string[]
    ): Promise<{
        totals: {
            venda_valor: number;
            venda_bs_icms: number;
            venda_isento: number;
            venda_outros: number;
            venda_pis: number;
            venda_cofins: number;
            simples_valor_tributado: number;
            simples_valor_nao_tributado: number;
        };
        cfopTotals: Record<string, number>;
        importedCount: number;
        errors: string[];
    }> {
        const [customerRows] = await pool.query<RowDataPacket[]>(
            `SELECT cnpj_cpf FROM customers WHERE id = ? AND company_id = ? LIMIT 1`,
            [customerId, companyId]
        );
        if (!customerRows || customerRows.length === 0) {
            throw new AppError('Cliente não encontrado', 404);
        }

        const firstCustomer = customerRows[0];
        if (!firstCustomer) {
            throw new AppError('Cliente não encontrado', 404);
        }
        const customerDoc = (firstCustomer.cnpj_cpf || '').replace(/\D/g, '');

        let targetCompanyId: number | null = null;
        if (customerDoc.length === 14) {
            const [companyRows] = await pool.query<RowDataPacket[]>(
                `SELECT id FROM companies WHERE REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', '') = ? LIMIT 1`,
                [customerDoc]
            );
            const firstCompany = companyRows[0];
            if (firstCompany) {
                targetCompanyId = firstCompany.id;
            }
        }

        if (!targetCompanyId) {
            throw new AppError('Este cliente não está cadastrado como Empresa no sistema. A importação de XMLs só é permitida para clientes cadastrados como Empresa.', 400);
        }

        const totals = {
            venda_valor: 0,
            venda_bs_icms: 0,
            venda_isento: 0,
            venda_outros: 0,
            venda_pis: 0,
            venda_cofins: 0,
            simples_valor_tributado: 0,
            simples_valor_nao_tributado: 0,
        };

        const cfopTotals: Record<string, number> = {};
        const errors: string[] = [];
        let importedCount = 0;

        for (const xmlContent of xmlContents) {
            try {
                const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
                if (doc.getElementsByTagName('parsererror').length > 0) {
                    throw new Error('XML com erro de parser.');
                }

                const icmsTotNode = doc.getElementsByTagName('ICMSTot')[0];
                const ideNode = doc.getElementsByTagName('ide')[0];
                const nNF = ideNode ? this.getTagText(ideNode, 'nNF') || 'Sem Número' : 'Sem Número';
                const vNF = icmsTotNode ? parseFloat(this.getTagText(icmsTotNode, 'vNF')) || 0 : 0;
                const vBC = icmsTotNode ? parseFloat(this.getTagText(icmsTotNode, 'vBC')) || 0 : 0;
                const vPIS = icmsTotNode ? parseFloat(this.getTagText(icmsTotNode, 'vPIS')) || 0 : 0;
                const vCOFINS = icmsTotNode ? parseFloat(this.getTagText(icmsTotNode, 'vCOFINS')) || 0 : 0;

                let detNodes = Array.from(doc.getElementsByTagName('det'));
                if (detNodes.length === 0) {
                    detNodes = Array.from(doc.getElementsByTagName('DET'));
                }
                if (detNodes.length === 0) {
                    detNodes = Array.from(doc.getElementsByTagName('produtoitem'));
                }
                if (detNodes.length === 0) {
                    detNodes = Array.from(doc.getElementsByTagName('produtoItem'));
                }
                if (detNodes.length === 0) {
                    detNodes = Array.from(doc.getElementsByTagName('item'));
                }
                if (detNodes.length === 0) {
                    detNodes = Array.from(doc.getElementsByTagName('ITEM'));
                }

                let sumExempt = 0;
                let sumTaxed = 0;

                for (const detNode of detNodes) {
                    let prodNode = detNode.getElementsByTagName('prod')[0] || 
                                   detNode.getElementsByTagName('PROD')[0] ||
                                   detNode.getElementsByTagName('produto')[0] ||
                                   detNode.getElementsByTagName('PRODUTO')[0] ||
                                   detNode.getElementsByTagName('produtoitem')[0] ||
                                   detNode.getElementsByTagName('produtoItem')[0] ||
                                   detNode.getElementsByTagName('item')[0] ||
                                   detNode.getElementsByTagName('ITEM')[0];

                    if (!prodNode) {
                        prodNode = detNode;
                    }

                    let vProd = parseFloat(this.getTagText(prodNode, 'vProd')) || 0;
                    if (vProd === 0) {
                        vProd = parseFloat(this.getTagText(prodNode, 'vItem')) || 
                                parseFloat(this.getTagText(prodNode, 'vServ')) || 
                                parseFloat(this.getTagText(prodNode, 'valor')) || 
                                0;
                    }

                    let cfop = this.getTagText(prodNode, 'CFOP');
                    if (!cfop || cfop === 'Desconhecido') {
                        cfop = this.getTagText(detNode, 'CFOP');
                    }
                    if (!cfop) {
                        cfop = 'Desconhecido';
                    }

                    if (cfop) {
                        cfopTotals[cfop] = (cfopTotals[cfop] || 0) + vProd;
                    }

                    const impostoNode = detNode.getElementsByTagName('imposto')[0];
                    const cstNode = impostoNode ? (impostoNode.getElementsByTagName('CST')[0] || impostoNode.getElementsByTagName('ICMS40')[0]?.getElementsByTagName('CST')[0] || impostoNode.getElementsByTagName('ICMS60')[0]?.getElementsByTagName('CST')[0]) : null;
                    const cst = cstNode ? cstNode.textContent || '' : '';
                    const csosnNode = impostoNode ? impostoNode.getElementsByTagName('CSOSN')[0] : null;
                    const csosn = csosnNode ? csosnNode.textContent || '' : '';

                    const isExempt = ['40', '41', '50', '60'].includes(cst) || ['102', '103', '300', '400', '500'].includes(csosn);

                    if (isExempt) {
                        sumExempt += vProd;
                    } else {
                        sumTaxed += vProd;
                    }
                }

                totals.venda_valor += vNF;
                totals.venda_bs_icms += vBC;
                totals.venda_pis += vPIS;
                totals.venda_cofins += vCOFINS;
                totals.venda_isento += sumExempt;
                totals.venda_outros += Math.max(0, vNF - vBC - sumExempt);
                totals.simples_valor_tributado += sumTaxed;
                totals.simples_valor_nao_tributado += sumExempt;

                if (targetCompanyId) {
                    try {
                        const { OrderService } = require('./orderService');
                        await OrderService.importSaleFromXml(targetCompanyId, userPublicId, {
                            xml_content: xmlContent
                        });
                        importedCount++;
                    } catch (dbErr: any) {
                        const errMsg = dbErr.message || String(dbErr);
                        if (errMsg.includes('ja importada') || errMsg.includes('Duplicate entry')) {
                            errors.push(`NF-e nº ${nNF}: Já cadastrada anteriormente no banco de dados da empresa.`);
                        } else {
                            errors.push(`NF-e nº ${nNF}: Não gravada no banco: ${errMsg}`);
                        }
                    }
                }
            } catch (err: any) {
                errors.push(`Erro ao processar um dos arquivos XML: ${err.message || err}`);
            }
        }

        return {
            totals,
            cfopTotals,
            importedCount,
            errors,
        };
    }

    static async getFaturamentoAcumulado(
        companyId: number,
        customerId: number,
        competencia: string
    ): Promise<{
        faturamento_acumulado_12m: number;
        faturamento_acumulado_ano_anterior: number;
    }> {
        const parts = competencia.split('-');
        const year = parseInt(parts[0]!, 10);
        const month = parseInt(parts[1]!, 10);

        const dateLimitStart = new Date(year, month - 1 - 12, 1);
        const dateLimitEnd = new Date(year, month - 1 - 1, 1);

        const formatPeriod = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            return `${y}-${m}`;
        };

        const range12mStart = formatPeriod(dateLimitStart);
        const range12mEnd = formatPeriod(dateLimitEnd);

        const [rows12m] = await pool.query<RowDataPacket[]>(
            `SELECT SUM(COALESCE(simples_faturamento, 0)) AS total
             FROM fechamentos
             WHERE company_id = ?
               AND customer_id = ?
               AND competencia >= ?
               AND competencia <= ?`,
            [companyId, customerId, range12mStart, range12mEnd]
        );

        const prevYear = year - 1;
        const rangePrevYearStart = `${prevYear}-01`;
        const rangePrevYearEnd = `${prevYear}-12`;

        const [rowsPrevYear] = await pool.query<RowDataPacket[]>(
            `SELECT SUM(COALESCE(simples_faturamento, 0)) AS total
             FROM fechamentos
             WHERE company_id = ?
               AND customer_id = ?
               AND competencia >= ?
               AND competencia <= ?`,
            [companyId, customerId, rangePrevYearStart, rangePrevYearEnd]
        );

        return {
            faturamento_acumulado_12m: Number(rows12m[0]?.total || 0),
            faturamento_acumulado_ano_anterior: Number(rowsPrevYear[0]?.total || 0)
        };
    }

    static async importSpedFiscal(
        companyId: number,
        _userPublicId: string,
        customerId: number | null | undefined,
        fileContent: string
    ): Promise<{
        header?: {
            dt_ini: string;
            dt_fin: string;
            nome: string;
            cnpj: string;
            cpf: string;
            cnpj_cpf: string;
            uf: string;
            ie: string;
            cod_mun: string;
            im: string;
            finalidade: string;
            perfil: string;
            atividade: string;
            company_public_id?: string | null;
        };
        stats?: {
            totalLines: number;
            totalParticipants: number;
            totalProducts?: number;
            totalDocuments: number;
            totalEntries: number;
            totalExits: number;
        };
        totals: {
            venda_valor: number;
            venda_bs_icms: number;
            venda_isento: number;
            venda_outros: number;
            venda_pis: number;
            venda_cofins: number;
            compra_valor: number;
            compra_bs_icms: number;
            compra_isento: number;
            compra_outros: number;
            compra_pis: number;
            compra_cofins: number;
            simples_valor_tributado: number;
            simples_valor_nao_tributado: number;
            apuracao_icms?: number;
            apuracao_fecp?: number;
        };
        apuracao?: {
            icms: {
                vl_tot_debitos: number;
                vl_aj_debitos: number;
                vl_tot_creditos: number;
                vl_aj_creditos: number;
                vl_estornos_deb: number;
                vl_estornos_cred: number;
                vl_sld_credor_ant: number;
                vl_sld_apurado: number;
                vl_tot_ded: number;
                vl_icms_recolher: number;
                vl_sld_credor_transportar: number;
                obrigacoes: Array<{
                    cod_or: string;
                    vl_or: number;
                    dt_vcto: string;
                    cod_rec: string;
                    txt_compl: string;
                }>;
                tem_registro_e110: boolean;
            };
            fecp: {
                base_calculo: number;
                aliquota: number;
                vl_tot_debitos: number;
                vl_tot_creditos: number;
                vl_fecp_recolher: number;
                vl_sld_credor_transportar: number;
                obrigacoes: Array<{
                    cod_or: string;
                    vl_or: number;
                    dt_vcto: string;
                    cod_rec: string;
                    txt_compl: string;
                    origem: string;
                }>;
                tem_registro_fecp: boolean;
            };
            icms_st: {
                vl_icms_st_recolher: number;
                vl_sld_credor_transportar: number;
                obrigacoes: Array<{
                    cod_or: string;
                    vl_or: number;
                    dt_vcto: string;
                    cod_rec: string;
                    txt_compl: string;
                }>;
                tem_registro_e210: boolean;
            };
            totais_recolher: {
                icms_proprio: number;
                fecp: number;
                icms_st: number;
                total_a_pagar: number;
            };
        };
        targetCompany?: {
            id: number;
            public_id?: string | null;
            trade_name: string;
            cnpj: string;
        } | null;
        importedStats?: {
            isCompany: boolean;
            companyId: number | null;
            companyPublicId?: string | null;
            companyName: string | null;
            customerId?: number | null;
            fechamentoPublicId?: string | null;
            importedCustomersCount: number;
            importedSuppliersCount: number;
            importedProductsCount: number;
            totalParticipants: number;
            totalProducts: number;
            totalDocuments?: number;
            fechamentoSaved: boolean;
            fechamentoAction?: 'created' | 'updated';
            isUpdate?: boolean;
            competencia?: string;
        };
        fechamentoPublicId?: string | null;
        products?: Array<{
            codItem: string;
            descrItem: string;
            codBarra: string;
            unidInv: string;
            tipoItem: string;
            codNcm: string;
            aliqIcms: number;
            cest: string;
        }>;
        cfopTotals: Record<string, number>;
        cfopDetails?: Array<{
            cfop: string;
            type: 'Entrada' | 'Saída';
            total: number;
            percent: number;
            cstIcms?: string;
            aliquota?: number;
            aliquotaLabel?: string;
            baseCalculo?: number;
            valorIcms?: number;
        }>;
        saidasPorAliquota?: Array<{
            aliquota: number;
            aliquotaLabel: string;
            valorTotal: number;
            baseCalculo: number;
            valorIcms: number;
            cfops: string[];
            csts: string[];
            countRegistros: number;
            percent: number;
        }>;
        entradasPorAliquota?: Array<{
            aliquota: number;
            aliquotaLabel: string;
            valorTotal: number;
            baseCalculo: number;
            valorIcms: number;
            cfops: string[];
            csts: string[];
            countRegistros: number;
            percent: number;
        }>;
        analiticoC190?: Array<{
            reg: string;
            cfop: string;
            type: 'Saída' | 'Entrada';
            cstIcms: string;
            aliquota: number;
            aliquotaLabel: string;
            vlOpr: number;
            vlBcIcms: number;
            vlIcms: number;
            vlBcIcmsSt: number;
            vlIcmsSt: number;
            vlRedBc: number;
            vlIpi: number;
            isExempt: boolean;
        }>;
        participants?: Array<{
            codPart: string;
            name: string;
            cnpj_cpf: string;
            city: string | null;
            state: string | null;
            role: string;
        }>;
        documents?: Array<{
            reg: string;
            indOper: string;
            type: 'Entrada' | 'Saída';
            numDoc: string;
            serie: string;
            chvDoc: string;
            dtDoc: string;
            codPart: string;
            partName: string;
            vlDoc: number;
            vlIcms: number;
            vlPis: number;
            vlCofins: number;
            codSit: string;
        }>;
        errors: string[];
    }> {
        const sanitizeNumber = (val: string): number => {
            if (!val) return 0;
            const clean = val.replace(/\./g, '').replace(',', '.').trim();
            return parseFloat(clean) || 0;
        };

        const formatDate = (val: string): string => {
            if (!val || val.length !== 8) return val || '';
            const d = val.substring(0, 2);
            const m = val.substring(2, 4);
            const y = val.substring(4, 8);
            return `${d}/${m}/${y}`;
        };

        const lines = fileContent.split(/\r?\n/);
        
        let headerInfo: any = {
            version: '',
            finalidade: 'Original (0)',
            dt_ini: '',
            dt_fin: '',
            nome: '',
            cnpj: '',
            cpf: '',
            cnpj_cpf: '',
            uf: '',
            ie: '',
            cod_mun: '',
            im: '',
            perfil: '',
            atividade: ''
        };

        // Identifica e lê o cabeçalho 0000 antecipadamente
        for (let i = 0; i < Math.min(lines.length, 50); i++) {
            const line = lines[i]!.trim();
            if (!line) continue;
            const fields = line.split('|');
            if (fields[1]?.toUpperCase() === '0000') {
                const codVer = fields[2] || '';
                const codFin = fields[3] || '0';
                const dtIni = formatDate(fields[4] || '');
                const dtFin = formatDate(fields[5] || '');
                const nome = fields[6] || '';
                const cnpj = (fields[7] || '').replace(/\D/g, '');
                const cpf = (fields[8] || '').replace(/\D/g, '');
                const uf = fields[9] || '';
                const ie = fields[10] || '';
                const codMun = fields[11] || '';
                const im = fields[12] || '';
                const indPerfil = fields[14] || '';
                const indAtiv = fields[15] || '';

                headerInfo = {
                    version: codVer,
                    finalidade: codFin === '0' ? 'Original (0)' : 'Substituto (1)',
                    dt_ini: dtIni,
                    dt_fin: dtFin,
                    nome,
                    cnpj,
                    cpf,
                    cnpj_cpf: cnpj || cpf,
                    uf,
                    ie,
                    cod_mun: codMun,
                    im,
                    perfil: indPerfil,
                    atividade: indAtiv === '0' ? 'Industrial' : (indAtiv === '1' ? 'Outros' : indAtiv)
                };
                break;
            }
        }

        const spedDocClean = (headerInfo.cnpj_cpf || headerInfo.cnpj || '').replace(/\D/g, '');

        // 1. Identifica os dados da empresa logada na sessão
        const [currCompRows] = await pool.query<RowDataPacket[]>(
            `SELECT id, public_id, trade_name, company_name, cnpj 
             FROM companies 
             WHERE id = ? LIMIT 1`,
            [companyId]
        );
        const currentCompanyCnpj = currCompRows?.[0]?.cnpj ? String(currCompRows[0].cnpj).replace(/\D/g, '') : '';

        // 2. Identifica se o declarante do arquivo SPED é uma Empresa cadastrada no ERP
        let targetCompany: { id: number; public_id?: string; trade_name: string; cnpj: string } | null = null;
        let targetCompanyId: number | null = null;

        if (spedDocClean.length >= 11) {
            const [companyRows] = await pool.query<RowDataPacket[]>(
                `SELECT id, public_id, trade_name, company_name, cnpj 
                 FROM companies 
                 WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = ? LIMIT 1`,
                [spedDocClean]
            );
            if (companyRows && companyRows.length > 0) {
                targetCompany = {
                    id: companyRows[0]!.id,
                    public_id: companyRows[0]!.public_id || null,
                    trade_name: companyRows[0]!.trade_name || companyRows[0]!.company_name,
                    cnpj: companyRows[0]!.cnpj
                };
                targetCompanyId = targetCompany.id;
            }
        }

        if (!targetCompany && headerInfo.nome) {
            const [companyRows] = await pool.query<RowDataPacket[]>(
                `SELECT id, public_id, trade_name, company_name, cnpj 
                 FROM companies 
                 WHERE trade_name LIKE ? OR company_name LIKE ? LIMIT 1`,
                [`%${headerInfo.nome}%`, `%${headerInfo.nome}%`]
            );
            if (companyRows && companyRows.length > 0) {
                targetCompany = {
                    id: companyRows[0]!.id,
                    public_id: companyRows[0]!.public_id || null,
                    trade_name: companyRows[0]!.trade_name || companyRows[0]!.company_name,
                    cnpj: companyRows[0]!.cnpj
                };
                targetCompanyId = targetCompany.id;
            }
        }

        if (targetCompany) {
            headerInfo.company_public_id = targetCompany.public_id || null;
        }

        const isOwnCompanySped = targetCompanyId === companyId || (Boolean(currentCompanyCnpj) && currentCompanyCnpj === spedDocClean);

        // 3. Resolve o customer_id vinculado a esta empresa no sistema (para a contabilidade/holding)
        let resolvedCustomerId = customerId ? Number(customerId) : 0;
        if (!resolvedCustomerId && !isOwnCompanySped && spedDocClean.length >= 11) {
            const [matchingCust] = await pool.query<RowDataPacket[]>(
                `SELECT id, name, cnpj_cpf FROM customers 
                 WHERE company_id = ? 
                   AND (REPLACE(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '') = ? 
                        OR cnpj_cpf = ?) 
                 LIMIT 1`,
                [companyId, spedDocClean, spedDocClean]
            );
            if (matchingCust && matchingCust.length > 0) {
                resolvedCustomerId = matchingCust[0]!.id;
            }
        }

        if (!resolvedCustomerId && targetCompany && !isOwnCompanySped) {
            const targetCnpjClean = (targetCompany.cnpj || '').replace(/\D/g, '');
            if (targetCnpjClean.length >= 11) {
                const [matchingCust] = await pool.query<RowDataPacket[]>(
                    `SELECT id, name, cnpj_cpf FROM customers 
                     WHERE company_id = ? 
                       AND (REPLACE(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '') = ? 
                            OR cnpj_cpf = ?) 
                     LIMIT 1`,
                    [companyId, targetCnpjClean, targetCnpjClean]
                );
                if (matchingCust && matchingCust.length > 0) {
                    resolvedCustomerId = matchingCust[0]!.id;
                }
            }
        }

        if (!resolvedCustomerId && !isOwnCompanySped && (headerInfo.nome || targetCompany?.trade_name)) {
            const name1 = headerInfo.nome || '';
            const name2 = targetCompany?.trade_name || '';
            const [matchingCust] = await pool.query<RowDataPacket[]>(
                `SELECT id, name, cnpj_cpf FROM customers 
                 WHERE company_id = ? 
                   AND (name LIKE ? OR trade_name LIKE ? OR name LIKE ? OR trade_name LIKE ?) 
                 LIMIT 1`,
                [companyId, `%${name1}%`, `%${name1}%`, `%${name2}%`, `%${name2}%`]
            );
            if (matchingCust && matchingCust.length > 0) {
                resolvedCustomerId = matchingCust[0]!.id;
            }
        }

        if (!resolvedCustomerId && customerId) {
            resolvedCustomerId = Number(customerId);
        }

        // Se a empresa declarante for de um cliente e ainda não existir registro em customers para ela na holding/contabilidade, auto-cadastra
        if (!resolvedCustomerId && (headerInfo.nome || spedDocClean) && !isOwnCompanySped && targetCompanyId !== companyId) {
            try {
                const newPubId = randomUUID();
                const [insertCust] = await pool.query<ResultSetHeader>(
                    `INSERT INTO customers (
                        public_id, company_id, name, trade_name, cnpj_cpf, inscricao_estadual, state, active
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
                    [
                        newPubId,
                        companyId,
                        headerInfo.nome || targetCompany?.trade_name || 'Empresa Declarada no SPED',
                        targetCompany?.trade_name || headerInfo.nome || 'Empresa Declarada no SPED',
                        headerInfo.cnpj_cpf || headerInfo.cnpj || targetCompany?.cnpj || null,
                        headerInfo.ie || null,
                        headerInfo.uf || null
                    ]
                );
                resolvedCustomerId = insertCust.insertId;
            } catch (err) {
                console.error('Erro ao auto-cadastrar cliente para empresa declarante do SPED:', err);
            }
        }

        const totals: {
            venda_valor: number;
            venda_bs_icms: number;
            venda_isento: number;
            venda_outros: number;
            venda_pis: number;
            venda_cofins: number;
            compra_valor: number;
            compra_bs_icms: number;
            compra_isento: number;
            compra_outros: number;
            compra_pis: number;
            compra_cofins: number;
            simples_valor_tributado: number;
            simples_valor_nao_tributado: number;
            apuracao_icms?: number;
            apuracao_fecp?: number;
        } = {
            venda_valor: 0,
            venda_bs_icms: 0,
            venda_isento: 0,
            venda_outros: 0,
            venda_pis: 0,
            venda_cofins: 0,
            compra_valor: 0,
            compra_bs_icms: 0,
            compra_isento: 0,
            compra_outros: 0,
            compra_pis: 0,
            compra_cofins: 0,
            simples_valor_tributado: 0,
            simples_valor_nao_tributado: 0,
            apuracao_icms: 0,
            apuracao_fecp: 0,
        };

        const cfopTotals: Record<string, number> = {};
        const cfopAliquotaMap = new Map<string, {
            reg: string;
            cfop: string;
            type: 'Saída' | 'Entrada';
            cstIcms: string;
            aliquota: number;
            vlOpr: number;
            vlBcIcms: number;
            vlIcms: number;
            vlBcIcmsSt: number;
            vlIcmsSt: number;
            vlRedBc: number;
            vlIpi: number;
            isExempt: boolean;
        }>();
        const errors: string[] = [];

        const supplierCodes = new Set<string>();
        const customerCodes = new Set<string>();
        const participantsMap = new Map<string, string>();
        const participants: Array<{
            codPart: string;
            name: string;
            cnpj: string;
            cpf: string;
            ie: string;
            codMun: string;
            end: string;
            num: string;
            compl: string;
            bairro: string;
        }> = [];

        const products0200: Array<{
            codItem: string;
            descrItem: string;
            codBarra: string;
            unidInv: string;
            tipoItem: string;
            codNcm: string;
            aliqIcms: number;
            cest: string;
        }> = [];

        const documents: Array<{
            reg: string;
            indOper: string;
            type: 'Entrada' | 'Saída';
            numDoc: string;
            serie: string;
            chvDoc: string;
            dtDoc: string;
            codPart: string;
            partName: string;
            vlDoc: number;
            vlIcms: number;
            vlPis: number;
            vlCofins: number;
            codSit: string;
        }> = [];

        let totalDocs = 0;
        let totalEntries = 0;
        let totalExits = 0;

        // Apuração ICMS Próprio (Bloco E)
        let apurIcmsDebitos = 0;
        let apurIcmsCreditos = 0;
        let apurIcmsAjDebitos = 0;
        let apurIcmsAjCreditos = 0;
        let apurIcmsEstornoDeb = 0;
        let apurIcmsEstornoCred = 0;
        let apurIcmsSaldoCredorAnt = 0;
        let apurIcmsSaldoApurado = 0;
        let apurIcmsTotDeducao = 0;
        let apurIcmsRecolher = 0;
        let apurIcmsSaldoCredorTransportar = 0;
        let hasE110 = false;
        const e116List: Array<{
            cod_or: string;
            vl_or: number;
            dt_vcto: string;
            cod_rec: string;
            txt_compl: string;
        }> = [];

        // Apuração ICMS ST (Bloco E200/E210/E250)
        let apurStRecolher = 0;
        let apurStSaldoCredorTransportar = 0;
        let hasE210 = false;
        const e250List: Array<{
            cod_or: string;
            vl_or: number;
            dt_vcto: string;
            cod_rec: string;
            txt_compl: string;
        }> = [];

        // Apuração FECP (Bloco E300/E310/E316 ou Bloco 1900/1920/1926 ou E116 específico)
        let apurFecpBaseCalculo = 0;
        let apurFecpAliquota = 2.0;
        let apurFecpDebitos = 0;
        let apurFecpCreditos = 0;
        let apurFecpRecolher = 0;
        let apurFecpSaldoCredorTransportar = 0;
        let hasFecpRecord = false;
        const fecpObrigacoesList: Array<{
            cod_or: string;
            vl_or: number;
            dt_vcto: string;
            cod_rec: string;
            txt_compl: string;
            origem: string;
        }> = [];

        // Acumuladores de ICMS dos Documentos para cálculo/fallback
        let docIcmsDebitosSaida = 0;
        let docIcmsCreditosEntrada = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]!.trim();
            if (!line) continue;
            
            const fields = line.split('|');
            if (fields.length < 2) continue;
            
            const reg = fields[1]?.toUpperCase() || '';
            
            if (reg === '0000') {
                const codVer = fields[2] || '';
                const codFin = fields[3] || '0';
                const dtIni = formatDate(fields[4] || '');
                const dtFin = formatDate(fields[5] || '');
                const nome = fields[6] || '';
                const cnpj = (fields[7] || '').replace(/\D/g, '');
                const cpf = (fields[8] || '').replace(/\D/g, '');
                const uf = fields[9] || '';
                const ie = fields[10] || '';
                const codMun = fields[11] || '';
                const im = fields[12] || '';
                const indPerfil = fields[14] || '';
                const indAtiv = fields[15] || '';

                headerInfo = {
                    version: codVer,
                    finalidade: codFin === '0' ? 'Original (0)' : 'Substituto (1)',
                    dt_ini: dtIni,
                    dt_fin: dtFin,
                    nome,
                    cnpj,
                    cpf,
                    cnpj_cpf: cnpj || cpf,
                    uf,
                    ie,
                    cod_mun: codMun,
                    im,
                    perfil: indPerfil,
                    atividade: indAtiv === '0' ? 'Industrial' : (indAtiv === '1' ? 'Outros' : indAtiv)
                };
            }
            else if (reg === '0150') {
                const codPart = fields[2] || '';
                const name = fields[3] || '';
                const cnpj = (fields[5] || '').replace(/\D/g, '');
                const cpf = (fields[6] || '').replace(/\D/g, '');
                const ie = fields[7] || '';
                const codMun = fields[8] || '';
                const end = fields[10] || '';
                const num = fields[11] || '';
                const compl = fields[12] || '';
                const bairro = fields[13] || '';
                
                if (codPart && name) {
                    participantsMap.set(codPart, name);
                    if (cnpj || cpf) {
                        participants.push({
                            codPart,
                            name,
                            cnpj,
                            cpf,
                            ie,
                            codMun,
                            end,
                            num,
                            compl,
                            bairro
                        });
                    }
                }
            }
            else if (reg === '0200') {
                const codItem = (fields[2] || '').trim();
                const descrItem = (fields[3] || '').trim();
                const codBarra = (fields[4] || '').trim();
                const unidInv = (fields[6] || '').trim();
                const tipoItem = (fields[7] || '').trim();
                const codNcm = (fields[8] || '').trim();
                const aliqIcms = sanitizeNumber(fields[12] || '');
                const cest = (fields[13] || '').trim();

                if (codItem && descrItem) {
                    products0200.push({
                        codItem,
                        descrItem,
                        codBarra,
                        unidInv,
                        tipoItem,
                        codNcm,
                        aliqIcms,
                        cest
                    });
                }
            }
            else if (reg === 'C100') {
                totalDocs++;
                const indOper = fields[2] || ''; // 0: Entrada, 1: Saída
                const codPart = fields[4] || '';
                const codSit = fields[6] || '';
                const numDoc = fields[8] || '';
                const serie = fields[7] || '';
                const chvNfe = fields[9] || '';
                const dtDoc = formatDate(fields[10] || '');
                const vlDoc = sanitizeNumber(fields[12] || '');
                const vlIcms = sanitizeNumber(fields[22] || '');
                const vlPis = sanitizeNumber(fields[26] || '');
                const vlCofins = sanitizeNumber(fields[27] || '');

                if (indOper === '0') {
                    totalEntries++;
                    if (codPart) supplierCodes.add(codPart);
                    docIcmsCreditosEntrada += vlIcms;
                } else if (indOper === '1') {
                    totalExits++;
                    if (codPart) customerCodes.add(codPart);
                    docIcmsDebitosSaida += vlIcms;
                }

                if (codSit === '00' || codSit === '01') {
                    if (indOper === '1') {
                        totals.venda_pis += vlPis;
                        totals.venda_cofins += vlCofins;
                    } else if (indOper === '0') {
                        totals.compra_pis += vlPis;
                        totals.compra_cofins += vlCofins;
                    }
                }

                if (documents.length < 5000) {
                    documents.push({
                        reg: 'C100 (NF-e/NFC-e)',
                        indOper,
                        type: indOper === '1' ? 'Saída' : 'Entrada',
                        numDoc,
                        serie,
                        chvDoc: chvNfe,
                        dtDoc,
                        codPart,
                        partName: participantsMap.get(codPart) || codPart,
                        vlDoc,
                        vlIcms,
                        vlPis,
                        vlCofins,
                        codSit
                    });
                }
            }
            else if (reg === 'D100') {
                totalDocs++;
                const indOper = fields[2] || '';
                const codPart = fields[4] || '';
                const codSit = fields[6] || '';
                const numDoc = fields[9] || '';
                const serie = fields[8] || '';
                const chvCte = fields[10] || '';
                const dtDoc = formatDate(fields[11] || '');
                const vlDoc = sanitizeNumber(fields[13] || '');
                const vlIcms = sanitizeNumber(fields[17] || '');
                const vlPis = sanitizeNumber(fields[23] || '');
                const vlCofins = sanitizeNumber(fields[24] || '');

                if (indOper === '0') {
                    totalEntries++;
                    if (codPart) supplierCodes.add(codPart);
                    docIcmsCreditosEntrada += vlIcms;
                } else if (indOper === '1') {
                    totalExits++;
                    if (codPart) customerCodes.add(codPart);
                    docIcmsDebitosSaida += vlIcms;
                }

                if (codSit === '00' || codSit === '01') {
                    if (indOper === '1') {
                        totals.venda_pis += vlPis;
                        totals.venda_cofins += vlCofins;
                    } else if (indOper === '0') {
                        totals.compra_pis += vlPis;
                        totals.compra_cofins += vlCofins;
                    }
                }

                if (documents.length < 5000) {
                    documents.push({
                        reg: 'D100 (CT-e)',
                        indOper,
                        type: indOper === '1' ? 'Saída' : 'Entrada',
                        numDoc,
                        serie,
                        chvDoc: chvCte,
                        dtDoc,
                        codPart,
                        partName: participantsMap.get(codPart) || codPart,
                        vlDoc,
                        vlIcms,
                        vlPis,
                        vlCofins,
                        codSit
                    });
                }
            }
            else if (
                ['C190', 'C320', 'C390', 'C490', 'C590', 'C690', 'C790', 'C890', 'D190', 'D390', 'D590', 'D690'].includes(reg)
            ) {
                const cstIcms = fields[2] || '';
                const cfop = fields[3] || '';
                const aliqIcms = sanitizeNumber(fields[4] || '');
                const vlOpr = sanitizeNumber(fields[5] || '');
                const vlBcIcms = sanitizeNumber(fields[6] || '');
                const vlIcms = sanitizeNumber(fields[7] || '');
                const vlBcIcmsSt = sanitizeNumber(fields[8] || '');
                const vlIcmsSt = sanitizeNumber(fields[9] || '');
                const vlRedBc = sanitizeNumber(fields[10] || '');
                const vlIpi = sanitizeNumber(fields[11] || '');
                
                const isExempt = ['40', '41', '50', '60'].includes(cstIcms) || 
                                 ['102', '103', '300', '400', '500'].includes(cstIcms) || 
                                 cfop.endsWith('405') || 
                                 cfop.endsWith('403') || 
                                 cfop.endsWith('401') || 
                                 cfop.endsWith('656');
                
                const isSaida = cfop.startsWith('5') || cfop.startsWith('6') || cfop.startsWith('7');
                const operType: 'Saída' | 'Entrada' = isSaida ? 'Saída' : 'Entrada';

                // Agrupamento analítico detalhado por CFOP + Alíquota + CST
                const groupKey = `${operType}|${cfop}|${aliqIcms.toFixed(2)}|${cstIcms}`;
                const existingGroup = cfopAliquotaMap.get(groupKey);
                if (existingGroup) {
                    existingGroup.vlOpr += vlOpr;
                    existingGroup.vlBcIcms += vlBcIcms;
                    existingGroup.vlIcms += vlIcms;
                    existingGroup.vlBcIcmsSt += vlBcIcmsSt;
                    existingGroup.vlIcmsSt += vlIcmsSt;
                    existingGroup.vlRedBc += vlRedBc;
                    existingGroup.vlIpi += vlIpi;
                } else {
                    cfopAliquotaMap.set(groupKey, {
                        reg,
                        cfop,
                        type: operType,
                        cstIcms,
                        aliquota: aliqIcms,
                        vlOpr,
                        vlBcIcms,
                        vlIcms,
                        vlBcIcmsSt,
                        vlIcmsSt,
                        vlRedBc,
                        vlIpi,
                        isExempt
                    });
                }

                if (isSaida) {
                    cfopTotals[cfop] = (cfopTotals[cfop] || 0) + vlOpr;
                    totals.venda_valor += vlOpr;
                    if (vlIcms > 0) docIcmsDebitosSaida += vlIcms;
                    
                    if (isExempt) {
                        totals.venda_isento += vlOpr;
                        totals.simples_valor_nao_tributado += vlOpr;
                    } else {
                        totals.venda_bs_icms += vlBcIcms;
                        totals.venda_outros += Math.max(0, vlOpr - vlBcIcms);
                        totals.simples_valor_tributado += vlOpr;
                    }
                } else if (cfop.startsWith('1') || cfop.startsWith('2') || cfop.startsWith('3')) {
                    cfopTotals[cfop] = (cfopTotals[cfop] || 0) + vlOpr;
                    totals.compra_valor += vlOpr;
                    if (vlIcms > 0) docIcmsCreditosEntrada += vlIcms;
                    
                    if (isExempt) {
                        totals.compra_isento += vlOpr;
                    } else {
                        totals.compra_bs_icms += vlBcIcms;
                        totals.compra_outros += Math.max(0, vlOpr - vlBcIcms);
                    }
                }
            }
            // ── Bloco E: Apuração do ICMS Próprio (E110 / E116) ─────────────
            else if (reg === 'E110') {
                hasE110 = true;
                apurIcmsDebitos = sanitizeNumber(fields[2] || '');
                apurIcmsAjDebitos = sanitizeNumber(fields[3] || '');
                apurIcmsEstornoCred = sanitizeNumber(fields[5] || '');
                apurIcmsCreditos = sanitizeNumber(fields[6] || '');
                apurIcmsAjCreditos = sanitizeNumber(fields[7] || '');
                apurIcmsEstornoDeb = sanitizeNumber(fields[9] || '');
                apurIcmsSaldoCredorAnt = sanitizeNumber(fields[10] || '');
                apurIcmsSaldoApurado = sanitizeNumber(fields[11] || '');
                apurIcmsTotDeducao = sanitizeNumber(fields[12] || '');
                apurIcmsRecolher = sanitizeNumber(fields[13] || '');
                apurIcmsSaldoCredorTransportar = sanitizeNumber(fields[14] || '');
            }
            else if (reg === 'E116') {
                const codOr = fields[2] || '';
                const vlOr = sanitizeNumber(fields[3] || '');
                const dtVcto = formatDate(fields[4] || '');
                const codRec = fields[5] || '';
                const txtCompl = fields[9] || '';

                // Identifica se é obrigação de FECP
                const isFecp = /fecp|fcp|fundo.*pobreza/i.test(txtCompl) || ['002-5', '003-3', '053-1', '750-2', '200-0', '210-9'].includes(codRec);
                if (isFecp) {
                    hasFecpRecord = true;
                    apurFecpRecolher += vlOr;
                    fecpObrigacoesList.push({
                        cod_or: codOr,
                        vl_or: vlOr,
                        dt_vcto: dtVcto,
                        cod_rec: codRec,
                        txt_compl: txtCompl,
                        origem: 'E116'
                    });
                } else {
                    e116List.push({
                        cod_or: codOr,
                        vl_or: vlOr,
                        dt_vcto: dtVcto,
                        cod_rec: codRec,
                        txt_compl: txtCompl
                    });
                }
            }
            // ── Bloco E: Apuração ICMS ST (E210 / E250) ───────────────────────
            else if (reg === 'E210') {
                hasE210 = true;
                apurStRecolher = sanitizeNumber(fields[13] || '');
                apurStSaldoCredorTransportar = sanitizeNumber(fields[14] || '');
            }
            else if (reg === 'E250') {
                e250List.push({
                    cod_or: fields[2] || '',
                    vl_or: sanitizeNumber(fields[3] || ''),
                    dt_vcto: formatDate(fields[4] || ''),
                    cod_rec: fields[5] || '',
                    txt_compl: fields[9] || ''
                });
            }
            // ── Bloco E: Apuração FCP/FECP e DIFAL (E310 / E316) ─────────────
            else if (reg === 'E310') {
                const vlRecFcp = sanitizeNumber(fields[12] || '');
                const vlSldTransportarFcp = sanitizeNumber(fields[13] || '');
                if (vlRecFcp > 0 || vlSldTransportarFcp > 0) {
                    hasFecpRecord = true;
                    apurFecpRecolher = vlRecFcp;
                    apurFecpSaldoCredorTransportar = vlSldTransportarFcp;
                }
            }
            else if (reg === 'E316') {
                hasFecpRecord = true;
                fecpObrigacoesList.push({
                    cod_or: fields[2] || '',
                    vl_or: sanitizeNumber(fields[3] || ''),
                    dt_vcto: formatDate(fields[4] || ''),
                    cod_rec: fields[5] || '',
                    txt_compl: fields[9] || '',
                    origem: 'E316'
                });
            }
            // ── Bloco 1: Sub-apurações (1920 / 1926 - Muito comum para FECP RJ) ─
            else if (reg === '1920') {
                const vlRec1920 = sanitizeNumber(fields[11] || '');
                const vlSld1920 = sanitizeNumber(fields[12] || '');
                if (vlRec1920 > 0 || vlSld1920 > 0) {
                    hasFecpRecord = true;
                    apurFecpRecolher += vlRec1920;
                    apurFecpSaldoCredorTransportar += vlSld1920;
                }
            }
            else if (reg === '1926') {
                hasFecpRecord = true;
                fecpObrigacoesList.push({
                    cod_or: fields[2] || '',
                    vl_or: sanitizeNumber(fields[3] || ''),
                    dt_vcto: formatDate(fields[4] || ''),
                    cod_rec: fields[5] || '',
                    txt_compl: fields[9] || '',
                    origem: '1926'
                });
            }
        }

        const participantsList: Array<{
            codPart: string;
            name: string;
            cnpj_cpf: string;
            city: string | null;
            state: string | null;
            role: string;
        }> = [];

        // Definir destino da sincronização de participantes (0150) e produtos (0200):
        // - Se targetCompanyId existir (empresa cadastrada no ERP): sincroniza EXCLUSIVAMENTE nessa empresa.
        // - Se o SPED for da própria empresa logada (isOwnCompanySped): sincroniza na própria empresa (companyId).
        // - Se for de um cliente externo (targetCompanyId nulo e não é empresa própria): NÃO cadastra os 0150 na tabela customers da holding/contabilidade (preserva tudo no sped_data_json).
        let targetCompanyToSyncParticipants: number | null = null;
        if (targetCompanyId) {
            targetCompanyToSyncParticipants = targetCompanyId;
        } else if (isOwnCompanySped) {
            targetCompanyToSyncParticipants = companyId;
        }

        let importedCustomersCount = 0;
        let importedSuppliersCount = 0;

        // Processa participantes
        for (const part of participants) {
            const doc = part.cnpj || part.cpf;
            if (!doc) continue;

            const isCustomer = customerCodes.has(part.codPart);
            const isSupplier = supplierCodes.has(part.codPart) || !isCustomer;

            let roleLabel = 'Participante';
            if (isCustomer && isSupplier) roleLabel = 'Cliente / Fornecedor';
            else if (isCustomer) roleLabel = 'Cliente';
            else if (isSupplier) roleLabel = 'Fornecedor';

            let city: string | null = null;
            let state: string | null = null;
            if (part.codMun) {
                try {
                    const [cityRows] = await pool.query<RowDataPacket[]>(
                        `SELECT c.name AS city_name, s.uf AS state_uf 
                         FROM ibge_cities c
                         JOIN ibge_states s ON c.state_id = s.id
                         WHERE c.id = ? LIMIT 1`,
                        [Number(part.codMun)]
                    );
                    const firstRow = cityRows?.[0];
                    if (firstRow) {
                        city = firstRow.city_name || null;
                        state = firstRow.state_uf || null;
                    }
                } catch (err) {
                    console.error(`Erro ao buscar municipio IBGE (${part.codMun}):`, err);
                }
            }

            participantsList.push({
                codPart: part.codPart,
                name: part.name,
                cnpj_cpf: doc,
                city,
                state,
                role: roleLabel
            });

            // Sincroniza participantes apenas na empresa declarante isolada
            if (targetCompanyToSyncParticipants) {
                const mappedData: any = {
                    name: part.name,
                    cnpj_cpf: doc,
                    inscricao_estadual: part.ie || null,
                    street: part.end || null,
                    number: part.num || null,
                    complement: part.compl || null,
                    neighborhood: part.bairro || null,
                    city,
                    state,
                    cd_municipio: part.codMun ? Number(part.codMun) : null
                };

                if (isCustomer) {
                    try {
                        const [existingCustomer] = await pool.query<RowDataPacket[]>(
                            `SELECT id FROM customers WHERE cnpj_cpf = ? AND company_id = ? LIMIT 1`,
                            [doc, targetCompanyToSyncParticipants]
                        );
                        if (!existingCustomer || existingCustomer.length === 0) {
                            await EntityRepository.create('customers', targetCompanyToSyncParticipants, mappedData);
                            importedCustomersCount++;
                        }
                    } catch (err) {
                        console.error(`Erro ao cadastrar cliente do SPED (${doc}) na empresa ${targetCompanyToSyncParticipants}:`, err);
                    }
                }

                if (isSupplier) {
                    try {
                        const [existingSupplier] = await pool.query<RowDataPacket[]>(
                            `SELECT id FROM suppliers WHERE cnpj_cpf = ? AND company_id = ? LIMIT 1`,
                            [doc, targetCompanyToSyncParticipants]
                        );
                        if (!existingSupplier || existingSupplier.length === 0) {
                            await EntityRepository.create('suppliers', targetCompanyToSyncParticipants, mappedData);
                            importedSuppliersCount++;
                        }
                    } catch (err) {
                        console.error(`Erro ao cadastrar fornecedor do SPED (${doc}) na empresa ${targetCompanyToSyncParticipants}:`, err);
                    }
                }
            }
        }

        // Sincroniza produtos (0200) na empresa vinculada isolada
        let importedProductsCount = 0;
        if (products0200.length > 0 && targetCompanyToSyncParticipants) {
            for (const prod of products0200) {
                try {
                    let existingQuery = `SELECT id FROM products WHERE company_id = ? AND (sku = ?`;
                    const params: any[] = [targetCompanyToSyncParticipants, prod.codItem];
                    if (prod.codBarra && prod.codBarra.length >= 7) {
                        existingQuery += ` OR ean = ?`;
                        params.push(prod.codBarra);
                    }
                    existingQuery += `) LIMIT 1`;

                    const [existingProd] = await pool.query<RowDataPacket[]>(existingQuery, params);
                    if (!existingProd || existingProd.length === 0) {
                        const publicId = randomUUID();
                        const descDetails = [
                            prod.codNcm ? `NCM: ${prod.codNcm}` : '',
                            prod.unidInv ? `UN: ${prod.unidInv}` : '',
                            prod.cest ? `CEST: ${prod.cest}` : ''
                        ].filter(Boolean).join(' | ');

                        await pool.query(
                            `INSERT INTO products (
                                public_id, company_id, name, description, sku, ean,
                                is_imported, cost_price, selling_price, current_stock,
                                min_stock, max_stock, active, status_pos_id
                            ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, 0, 0, 0, 1, 'ABCDEABC-ABCD-ABCD-ABCD-ABCED1758966')`,
                            [
                                publicId,
                                targetCompanyToSyncParticipants,
                                prod.descrItem,
                                descDetails || null,
                                prod.codItem || null,
                                (prod.codBarra && prod.codBarra.length >= 7) ? prod.codBarra : null
                            ]
                        );
                        importedProductsCount++;
                    }
                } catch (prodErr) {
                    console.error(`Erro ao cadastrar produto do SPED (${prod.codItem}) na empresa ${targetCompanyToSyncParticipants}:`, prodErr);
                }
            }
        }

        // Build CFOP Details & Analítico por Alíquota
        const totalMovement = totals.compra_valor + totals.venda_valor;

        // Lista Analítica C190 completa
        const analiticoC190 = Array.from(cfopAliquotaMap.values()).map(item => ({
            ...item,
            aliquotaLabel: item.aliquota > 0 ? `${item.aliquota.toFixed(2).replace('.', ',')}%` : (item.isExempt ? 'Isento / ST (0%)' : '0,00%'),
            percent: totalMovement > 0 ? (item.vlOpr / totalMovement) * 100 : 0
        })).sort((a, b) => b.vlOpr - a.vlOpr);

        // CFOP Details enriquecido com separação por alíquota e valor
        const cfopDetails = analiticoC190.length > 0 ? analiticoC190.map(item => ({
            cfop: item.cfop,
            type: item.type,
            cstIcms: item.cstIcms,
            aliquota: item.aliquota,
            aliquotaLabel: item.aliquota > 0 ? `${item.aliquota.toFixed(2).replace('.', ',')}%` : (item.isExempt ? 'Isento / ST (0%)' : '0,00%'),
            total: item.vlOpr,
            baseCalculo: item.vlBcIcms,
            valorIcms: item.vlIcms,
            percent: totalMovement > 0 ? (item.vlOpr / totalMovement) * 100 : 0
        })) : Object.entries(cfopTotals).map(([cfop, total]) => {
            const isSaida = cfop.startsWith('5') || cfop.startsWith('6') || cfop.startsWith('7');
            return {
                cfop,
                type: (isSaida ? 'Saída' : 'Entrada') as 'Entrada' | 'Saída',
                cstIcms: '',
                aliquota: 0,
                aliquotaLabel: '-',
                total,
                baseCalculo: 0,
                valorIcms: 0,
                percent: totalMovement > 0 ? (total / totalMovement) * 100 : 0
            };
        }).sort((a, b) => b.total - a.total);

        // Agrupamento exclusivo de Saídas por Alíquota e Valor
        const saidasAliquotaMap = new Map<string, {
            aliquota: number;
            aliquotaLabel: string;
            valorTotal: number;
            baseCalculo: number;
            valorIcms: number;
            cfops: Set<string>;
            csts: Set<string>;
            countRegistros: number;
        }>();

        const saidasItems = analiticoC190.filter(i => i.type === 'Saída');
        const totalSaidasVal = totals.venda_valor || saidasItems.reduce((acc, i) => acc + i.vlOpr, 0);

        for (const item of saidasItems) {
            let aliqKey = '';
            let label = '';
            if (item.aliquota > 0) {
                aliqKey = `aliq_${item.aliquota.toFixed(2)}`;
                label = `${item.aliquota.toFixed(2).replace('.', ',')}%`;
            } else if (item.isExempt || item.cfop.endsWith('405') || ['60', '500'].includes(item.cstIcms)) {
                aliqKey = 'isento_st';
                label = 'Substituição Tributária / Isento (0%)';
            } else {
                aliqKey = 'outros_0';
                label = 'Outras / Não Tributadas (0%)';
            }

            const existing = saidasAliquotaMap.get(aliqKey);
            if (existing) {
                existing.valorTotal += item.vlOpr;
                existing.baseCalculo += item.vlBcIcms;
                existing.valorIcms += item.vlIcms;
                existing.cfops.add(item.cfop);
                if (item.cstIcms) existing.csts.add(item.cstIcms);
                existing.countRegistros += 1;
            } else {
                saidasAliquotaMap.set(aliqKey, {
                    aliquota: item.aliquota,
                    aliquotaLabel: label,
                    valorTotal: item.vlOpr,
                    baseCalculo: item.vlBcIcms,
                    valorIcms: item.vlIcms,
                    cfops: new Set([item.cfop]),
                    csts: new Set(item.cstIcms ? [item.cstIcms] : []),
                    countRegistros: 1
                });
            }
        }

        const saidasPorAliquota = Array.from(saidasAliquotaMap.values()).map(s => ({
            aliquota: s.aliquota,
            aliquotaLabel: s.aliquotaLabel,
            valorTotal: s.valorTotal,
            baseCalculo: s.baseCalculo,
            valorIcms: s.valorIcms,
            cfops: Array.from(s.cfops).sort(),
            csts: Array.from(s.csts).sort(),
            countRegistros: s.countRegistros,
            percent: totalSaidasVal > 0 ? (s.valorTotal / totalSaidasVal) * 100 : 0
        })).sort((a, b) => b.aliquota - a.aliquota || b.valorTotal - a.valorTotal);

        // Agrupamento exclusivo de Entradas por Alíquota e Valor
        const entradasAliquotaMap = new Map<string, {
            aliquota: number;
            aliquotaLabel: string;
            valorTotal: number;
            baseCalculo: number;
            valorIcms: number;
            cfops: Set<string>;
            csts: Set<string>;
            countRegistros: number;
        }>();

        const entradasItems = analiticoC190.filter(i => i.type === 'Entrada');
        const totalEntradasVal = totals.compra_valor || entradasItems.reduce((acc, i) => acc + i.vlOpr, 0);

        for (const item of entradasItems) {
            let aliqKey = '';
            let label = '';
            if (item.aliquota > 0) {
                aliqKey = `aliq_${item.aliquota.toFixed(2)}`;
                label = `${item.aliquota.toFixed(2).replace('.', ',')}%`;
            } else if (item.isExempt || item.cfop.endsWith('403') || ['60', '500'].includes(item.cstIcms)) {
                aliqKey = 'isento_st';
                label = 'Substituição Tributária / Isento (0%)';
            } else {
                aliqKey = 'outros_0';
                label = 'Outras / Não Tributadas (0%)';
            }

            const existing = entradasAliquotaMap.get(aliqKey);
            if (existing) {
                existing.valorTotal += item.vlOpr;
                existing.baseCalculo += item.vlBcIcms;
                existing.valorIcms += item.vlIcms;
                existing.cfops.add(item.cfop);
                if (item.cstIcms) existing.csts.add(item.cstIcms);
                existing.countRegistros += 1;
            } else {
                entradasAliquotaMap.set(aliqKey, {
                    aliquota: item.aliquota,
                    aliquotaLabel: label,
                    valorTotal: item.vlOpr,
                    baseCalculo: item.vlBcIcms,
                    valorIcms: item.vlIcms,
                    cfops: new Set([item.cfop]),
                    csts: new Set(item.cstIcms ? [item.cstIcms] : []),
                    countRegistros: 1
                });
            }
        }

        const entradasPorAliquota = Array.from(entradasAliquotaMap.values()).map(e => ({
            aliquota: e.aliquota,
            aliquotaLabel: e.aliquotaLabel,
            valorTotal: e.valorTotal,
            baseCalculo: e.baseCalculo,
            valorIcms: e.valorIcms,
            cfops: Array.from(e.cfops).sort(),
            csts: Array.from(e.csts).sort(),
            countRegistros: e.countRegistros,
            percent: totalEntradasVal > 0 ? (e.valorTotal / totalEntradasVal) * 100 : 0
        })).sort((a, b) => b.aliquota - a.aliquota || b.valorTotal - a.valorTotal);

        // Se não houver Bloco E110 ou apurIcmsDebitos e apurIcmsRecolher forem 0, calcula a partir dos documentos fiscais
        if (!hasE110 || (apurIcmsDebitos === 0 && apurIcmsCreditos === 0 && apurIcmsRecolher === 0)) {
            apurIcmsDebitos = docIcmsDebitosSaida;
            apurIcmsCreditos = docIcmsCreditosEntrada;
            if (apurIcmsDebitos > apurIcmsCreditos) {
                apurIcmsRecolher = apurIcmsDebitos - apurIcmsCreditos;
                apurIcmsSaldoCredorTransportar = 0;
            } else {
                apurIcmsRecolher = 0;
                apurIcmsSaldoCredorTransportar = apurIcmsCreditos - apurIcmsDebitos;
            }
        }

        // Base de cálculo do FECP
        apurFecpBaseCalculo = totals.venda_bs_icms;
        const ufEmpresa = (headerInfo?.uf || 'RJ').toUpperCase();
        apurFecpAliquota = ufEmpresa === 'RJ' ? 2.0 : 2.0;

        // Se não houver apuração explícita de FECP no Bloco E/1, calcular estimado sobre a base tributada
        if (!hasFecpRecord && apurFecpBaseCalculo > 0) {
            apurFecpDebitos = apurFecpBaseCalculo * (apurFecpAliquota / 100);
            apurFecpRecolher = apurFecpDebitos;
        }

        // Atualiza totals para fechamento
        totals.apuracao_icms = apurIcmsRecolher;
        totals.apuracao_fecp = apurFecpRecolher;

        const apuracao = {
            icms: {
                vl_tot_debitos: apurIcmsDebitos,
                vl_aj_debitos: apurIcmsAjDebitos,
                vl_tot_creditos: apurIcmsCreditos,
                vl_aj_creditos: apurIcmsAjCreditos,
                vl_estornos_deb: apurIcmsEstornoDeb,
                vl_estornos_cred: apurIcmsEstornoCred,
                vl_sld_credor_ant: apurIcmsSaldoCredorAnt,
                vl_sld_apurado: apurIcmsSaldoApurado || Math.max(0, apurIcmsDebitos - apurIcmsCreditos),
                vl_tot_ded: apurIcmsTotDeducao,
                vl_icms_recolher: apurIcmsRecolher,
                vl_sld_credor_transportar: apurIcmsSaldoCredorTransportar,
                obrigacoes: e116List,
                tem_registro_e110: hasE110
            },
            fecp: {
                base_calculo: apurFecpBaseCalculo,
                aliquota: apurFecpAliquota,
                vl_tot_debitos: apurFecpDebitos || apurFecpRecolher,
                vl_tot_creditos: apurFecpCreditos,
                vl_fecp_recolher: apurFecpRecolher,
                vl_sld_credor_transportar: apurFecpSaldoCredorTransportar,
                obrigacoes: fecpObrigacoesList,
                tem_registro_fecp: hasFecpRecord
            },
            icms_st: {
                vl_icms_st_recolher: apurStRecolher,
                vl_sld_credor_transportar: apurStSaldoCredorTransportar,
                obrigacoes: e250List,
                tem_registro_e210: hasE210
            },
            totais_recolher: {
                icms_proprio: apurIcmsRecolher,
                fecp: apurFecpRecolher,
                icms_st: apurStRecolher,
                total_a_pagar: apurIcmsRecolher + apurFecpRecolher + apurStRecolher
            }
        };

        // Grava ou atualiza automaticamente o fechamento fiscal
        let mainSessionFechamentoPublicId: string | null = null;
        let mainSessionFechamentoSaved = false;
        let mainSessionFechamentoAction: 'created' | 'updated' = 'created';
        let mainSessionIsUpdate = false;
        let compKey = '';

        if (headerInfo.dt_ini && headerInfo.dt_ini.includes('/')) {
            const parts = headerInfo.dt_ini.split('/');
            if (parts.length === 3) compKey = `${parts[2]}-${parts[1]}`;
        } else if (headerInfo.dt_ini && headerInfo.dt_ini.includes('-')) {
            const parts = headerInfo.dt_ini.split('-');
            if (parts.length === 3) {
                if (parts[0] && parts[0].length === 4) {
                    compKey = `${parts[0]}-${parts[1]}`;
                } else {
                    compKey = `${parts[2]}-${parts[1]}`;
                }
            }
        } else if (headerInfo.dt_ini && headerInfo.dt_ini.length === 8) {
            const m = headerInfo.dt_ini.substring(2, 4);
            const y = headerInfo.dt_ini.substring(4, 8);
            compKey = `${y}-${m}`;
        }

        if (compKey) {
            const spedDataToStore = JSON.stringify({
                header: headerInfo,
                stats: {
                    totalLines: lines.length,
                    totalParticipants: participants.length,
                    totalProducts: products0200.length,
                    totalDocuments: totalDocs,
                    totalEntries,
                    totalExits
                },
                totals,
                apuracao,
                cfopTotals,
                cfopDetails,
                saidasPorAliquota,
                entradasPorAliquota,
                analiticoC190,
                products: products0200,
                participants: participantsList,
                documents
            });

            const companyLabel = targetCompany?.trade_name || headerInfo.nome || 'Empresa SPED';

            const fechamentoTargets: Array<{ syncCompId: number; custId: number | null }> = [];

            // 1. Garante o fechamento na empresa logada na sessão (holding / contabilidade), vinculado ao cliente resolvido
            if (resolvedCustomerId) {
                fechamentoTargets.push({ syncCompId: companyId, custId: resolvedCustomerId });
            } else if (isOwnCompanySped || !targetCompanyId) {
                fechamentoTargets.push({ syncCompId: companyId, custId: null });
            } else {
                fechamentoTargets.push({ syncCompId: companyId, custId: null });
            }

            // 2. Se o SPED pertencer a uma empresa cadastrada diferente da sessão, grava também nela (auto-fechamento com custId = null)
            if (targetCompanyId && targetCompanyId !== companyId) {
                fechamentoTargets.push({ syncCompId: targetCompanyId, custId: null });
            }

            for (const target of fechamentoTargets) {
                const { syncCompId, custId } = target;

                try {
                    let existingFech: RowDataPacket[] = [];
                    if (custId) {
                        const [rows] = await pool.query<RowDataPacket[]>(
                            `SELECT id, public_id FROM fechamentos 
                             WHERE company_id = ? 
                               AND (customer_id = ? OR (customer_id IN (SELECT id FROM customers WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '') = ?)))
                               AND competencia = ? 
                             LIMIT 1`,
                            [syncCompId, custId, spedDocClean, compKey]
                        );
                        existingFech = rows;
                    } else {
                        const [rows] = await pool.query<RowDataPacket[]>(
                            `SELECT id, public_id FROM fechamentos 
                             WHERE company_id = ? 
                               AND (customer_id IS NULL OR customer_id = 0)
                               AND competencia = ? 
                             LIMIT 1`,
                            [syncCompId, compKey]
                        );
                        existingFech = rows;
                    }

                    if (existingFech && existingFech.length > 0) {
                        const existingPubId = existingFech[0]!.public_id;
                        await pool.query(
                            `UPDATE fechamentos SET
                                customer_id = ?,
                                venda_valor = ?, venda_bs_icms = ?, venda_isento = ?, venda_outros = ?, venda_pis = ?, venda_cofins = ?,
                                compra_valor = ?, compra_bs_icms = ?, compra_isento = ?, compra_outros = ?, compra_pis = ?, compra_cofins = ?,
                                simples_valor_tributado = ?, simples_valor_nao_tributado = ?,
                                simples_faturamento = CASE WHEN simples_faturamento IS NULL OR simples_faturamento = 0 THEN ? ELSE simples_faturamento END,
                                apuracao_icms = ?,
                                apuracao_fecp = ?,
                                observacao = ?,
                                sped_data_json = ?
                             WHERE id = ?`,
                            [
                                custId || null,
                                totals.venda_valor, totals.venda_bs_icms, totals.venda_isento, totals.venda_outros, totals.venda_pis, totals.venda_cofins,
                                totals.compra_valor, totals.compra_bs_icms, totals.compra_isento, totals.compra_outros, totals.compra_pis, totals.compra_cofins,
                                totals.simples_valor_tributado, totals.simples_valor_nao_tributado,
                                totals.venda_valor,
                                totals.apuracao_icms,
                                totals.apuracao_fecp || 0,
                                `Importado via SPED Fiscal EFD - Empresa: ${companyLabel}`,
                                spedDataToStore,
                                existingFech[0]!.id
                            ]
                        );
                        if (syncCompId === companyId || !mainSessionFechamentoPublicId) {
                            mainSessionFechamentoPublicId = existingPubId;
                            mainSessionFechamentoSaved = true;
                            mainSessionFechamentoAction = 'updated';
                            mainSessionIsUpdate = true;
                        }
                    } else {
                        const publicId = randomUUID();
                        await pool.query(
                            `INSERT INTO fechamentos (
                                public_id, company_id, customer_id, competencia,
                                venda_valor, venda_bs_icms, venda_isento, venda_outros, venda_pis, venda_cofins,
                                compra_valor, compra_bs_icms, compra_isento, compra_outros, compra_pis, compra_cofins,
                                simples_valor_tributado, simples_valor_nao_tributado, simples_faturamento,
                                apuracao_icms,
                                apuracao_fecp,
                                observacao,
                                sped_data_json
                             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                publicId, syncCompId, custId || null, compKey,
                                totals.venda_valor, totals.venda_bs_icms, totals.venda_isento, totals.venda_outros, totals.venda_pis, totals.venda_cofins,
                                totals.compra_valor, totals.compra_bs_icms, totals.compra_isento, totals.compra_outros, totals.compra_pis, totals.compra_cofins,
                                totals.simples_valor_tributado, totals.simples_valor_nao_tributado, totals.venda_valor,
                                totals.apuracao_icms,
                                totals.apuracao_fecp || 0,
                                `Importado via SPED Fiscal EFD - Empresa: ${companyLabel}`,
                                spedDataToStore
                            ]
                        );

                        if (syncCompId === companyId || !mainSessionFechamentoPublicId) {
                            mainSessionFechamentoPublicId = publicId;
                            mainSessionFechamentoSaved = true;
                            mainSessionFechamentoAction = 'created';
                            mainSessionIsUpdate = false;
                        }
                    }
                } catch (targetErr) {
                    console.error(`Erro ao salvar fechamento para target (comp: ${syncCompId}, cust: ${custId}) na comp ${compKey}:`, targetErr);
                }
            }
        }

        return {
            header: headerInfo,
            targetCompany,
            fechamentoPublicId: mainSessionFechamentoPublicId,
            importedStats: {
                isCompany: !!targetCompany,
                companyId: targetCompanyId,
                companyPublicId: targetCompany ? (targetCompany.public_id || null) : null,
                companyName: targetCompany ? targetCompany.trade_name : (headerInfo.nome || null),
                customerId: resolvedCustomerId || null,
                fechamentoPublicId: mainSessionFechamentoPublicId,
                importedCustomersCount,
                importedSuppliersCount,
                importedProductsCount,
                totalParticipants: participants.length,
                totalProducts: products0200.length,
                totalDocuments: totalDocs,
                fechamentoSaved: mainSessionFechamentoSaved,
                fechamentoAction: mainSessionFechamentoAction,
                isUpdate: mainSessionIsUpdate,
                competencia: compKey
            },
            stats: {
                totalLines: lines.length,
                totalParticipants: participants.length,
                totalProducts: products0200.length,
                totalDocuments: totalDocs,
                totalEntries,
                totalExits
            },
            totals,
            apuracao,
            cfopTotals,
            cfopDetails,
            saidasPorAliquota,
            entradasPorAliquota,
            analiticoC190,
            products: products0200,
            participants: participantsList,
            documents,
            errors
        };
    }

    static async getSpedVision(
        companyId: number,
        customerId: number,
        competencia: string
    ): Promise<any> {
        let customer: any = null;
        if (customerId && !isNaN(customerId) && customerId > 0) {
            const [customerRows] = await pool.query<RowDataPacket[]>(
                `SELECT c.*,
                        (CASE WHEN c.cnpj_cpf IS NOT NULL AND c.cnpj_cpf != '' THEN (SELECT COUNT(*) FROM companies comp WHERE REPLACE(REPLACE(REPLACE(REPLACE(comp.cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = REPLACE(REPLACE(REPLACE(REPLACE(c.cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '')) > 0 ELSE 0 END) AS is_registered_as_company,
                        (SELECT comp.id FROM companies comp WHERE REPLACE(REPLACE(REPLACE(REPLACE(comp.cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = REPLACE(REPLACE(REPLACE(REPLACE(c.cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '') LIMIT 1) AS registered_company_id,
                        (SELECT COALESCE(comp.trade_name, comp.company_name) FROM companies comp WHERE REPLACE(REPLACE(REPLACE(REPLACE(comp.cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = REPLACE(REPLACE(REPLACE(REPLACE(c.cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '') LIMIT 1) AS registered_company_name
                 FROM customers c
                 WHERE c.id = ? AND c.company_id = ? LIMIT 1`,
                [customerId, companyId]
            );
            if (customerRows && customerRows.length > 0) {
                customer = customerRows[0];
            }
        }

        let targetCompany: { id: number; company_name?: string; name?: string; trade_name: string; cnpj: string; ie?: string; im?: string; city?: string; state?: string; cd_municipio?: number; street?: string; number?: string; neighborhood?: string; tax_regime?: string } | null = null;

        if (!customer) {
            const targetCompId = (customerId && customerId > 0) ? customerId : companyId;
            const [compRows] = await pool.query<RowDataPacket[]>(
                `SELECT * FROM companies WHERE id = ? LIMIT 1`,
                [targetCompId]
            );
            if (compRows && compRows.length > 0) {
                const comp = compRows[0] as any;
                targetCompany = comp;
                customer = {
                    id: 0,
                    company_id: companyId,
                    name: comp.trade_name || comp.company_name,
                    trade_name: comp.trade_name,
                    cnpj_cpf: comp.cnpj,
                    tax_regime: comp.tax_regime,
                    regime_tributario: comp.tax_regime,
                    is_registered_as_company: 1,
                    registered_company_id: comp.id,
                    registered_company_name: comp.trade_name || comp.company_name
                };
            }
        }

        if (!customer) {
            throw new AppError('Cliente/Empresa não encontrado.', 404);
        }

        const docClean = (customer.cnpj_cpf || '').replace(/\D/g, '');

        if (!targetCompany && customer.registered_company_id) {
            const [compRows] = await pool.query<RowDataPacket[]>(
                `SELECT * FROM companies WHERE id = ? LIMIT 1`,
                [customer.registered_company_id]
            );
            if (compRows && compRows.length > 0) {
                targetCompany = compRows[0] as any;
            }
        }
        if (!targetCompany && docClean.length >= 11) {
            const [compRows] = await pool.query<RowDataPacket[]>(
                `SELECT * FROM companies 
                 WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = ? LIMIT 1`,
                [docClean]
            );
            if (compRows && compRows.length > 0) {
                targetCompany = compRows[0] as any;
            }
        }

        if (!targetCompany) {
            targetCompany = {
                id: customer.id,
                company_name: customer.name,
                name: customer.name,
                trade_name: customer.trade_name || customer.name,
                cnpj: customer.cnpj_cpf,
                ie: customer.inscricao_estadual,
                im: customer.inscricao_municipal,
                city: customer.city,
                state: customer.state,
                cd_municipio: customer.cd_municipio,
                street: customer.street,
                number: customer.number,
                neighborhood: customer.neighborhood,
                tax_regime: customer.tax_regime
            };
        }

        const [fechRows] = await pool.query<RowDataPacket[]>(
            `SELECT * FROM fechamentos 
             WHERE (
                 company_id = ? 
                 OR company_id = ? 
                 OR (company_id IN (SELECT id FROM companies WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = ?))
             )
             AND (
                 customer_id = ? 
                 OR customer_id IN (SELECT id FROM customers WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '') = ?)
                 OR company_id = ?
                 OR company_id = ?
             )
             AND competencia = ?
             ORDER BY (CASE WHEN sped_data_json IS NOT NULL AND sped_data_json != '' THEN 1 ELSE 0 END) DESC, id DESC LIMIT 1`,
            [companyId, targetCompany?.id || companyId, docClean, customerId || 0, docClean, targetCompany?.id || companyId, companyId, competencia]
        );

        let fech = fechRows?.[0] || {
            venda_valor: 0,
            venda_bs_icms: 0,
            venda_isento: 0,
            venda_outros: 0,
            venda_pis: 0,
            venda_cofins: 0,
            compra_valor: 0,
            compra_bs_icms: 0,
            compra_isento: 0,
            compra_outros: 0,
            compra_pis: 0,
            compra_cofins: 0,
            simples_valor_tributado: 0,
            simples_valor_nao_tributado: 0,
            apuracao_icms: 0,
            apuracao_fecp: 0,
            apuracao_aj_icms: 0,
            sped_data_json: null
        };

        const [yearStr, monthStr] = competencia.split('-');
        const y = parseInt(yearStr || '2026', 10);
        const m = parseInt(monthStr || '01', 10);
        const lastDay = new Date(y, m, 0).getDate();
        const dt_ini = `01/${monthStr}/${yearStr}`;
        const dt_fin = `${String(lastDay).padStart(2, '0')}/${monthStr}/${yearStr}`;

        const targetCompId = targetCompany ? targetCompany.id : companyId;

        // Produtos (0200) da empresa exibida
        const [prodRows] = await pool.query<RowDataPacket[]>(
            `SELECT id, sku, name, description, ean, current_stock, selling_price
             FROM products
             WHERE (company_id = ? OR company_id = ?) AND active = 1
             ORDER BY id ASC LIMIT 1000`,
            [targetCompId, companyId]
        );

        const productsList = (prodRows || []).map((p: any) => {
            let ncm = '';
            let un = 'UN';
            let cest = '';
            if (p.description) {
                const ncmMatch = p.description.match(/NCM:\s*([^\s|]+)/i);
                if (ncmMatch) ncm = ncmMatch[1];
                const unMatch = p.description.match(/UN:\s*([^\s|]+)/i);
                if (unMatch) un = unMatch[1];
                const cestMatch = p.description.match(/CEST:\s*([^\s|]+)/i);
                if (cestMatch) cest = cestMatch[1];
            }
            return {
                codItem: p.sku || String(p.id).padStart(4, '0'),
                descrItem: p.name || 'Produto sem descrição',
                codBarra: p.ean || '',
                unidInv: un,
                tipoItem: '00',
                codNcm: ncm,
                aliqIcms: 0,
                cest
            };
        });

        // Participantes (0150) da empresa exibida
        const [custRows] = await pool.query<RowDataPacket[]>(
            `SELECT id, name, cnpj_cpf, city, state
             FROM customers
             WHERE (company_id = ? OR company_id = ?) AND (name IS NOT NULL OR cnpj_cpf IS NOT NULL)
             LIMIT 1000`,
            [targetCompId, companyId]
        );
        const [suppRows] = await pool.query<RowDataPacket[]>(
            `SELECT id, name, cnpj_cpf, city, state
             FROM suppliers
             WHERE (company_id = ? OR company_id = ?) AND (name IS NOT NULL OR cnpj_cpf IS NOT NULL)
             LIMIT 1000`,
            [targetCompId, companyId]
        );

        const participantsList: any[] = [];
        const docToPartMap = new Map<string, { cod: string; name: string }>();
        let partIdx = 1;

        for (const c of (custRows || [])) {
            const cod = String(partIdx++).padStart(4, '0');
            const name = c.name || 'Cliente';
            const partDocClean = (c.cnpj_cpf || '').replace(/\D/g, '');
            if (partDocClean) docToPartMap.set(partDocClean, { cod, name });
            docToPartMap.set(`cust_${c.id}`, { cod, name });
            participantsList.push({
                codPart: cod,
                name,
                cnpj_cpf: c.cnpj_cpf || '',
                city: c.city || null,
                state: c.state || null,
                role: 'Cliente'
            });
        }

        for (const s of (suppRows || [])) {
            const cod = String(partIdx++).padStart(4, '0');
            const name = s.name || 'Fornecedor';
            const partDocClean = (s.cnpj_cpf || '').replace(/\D/g, '');
            if (partDocClean) docToPartMap.set(partDocClean, { cod, name });
            docToPartMap.set(`supp_${s.id}`, { cod, name });
            participantsList.push({
                codPart: cod,
                name,
                cnpj_cpf: s.cnpj_cpf || '',
                city: s.city || null,
                state: s.state || null,
                role: 'Fornecedor'
            });
        }

        // Documentos Fiscais
        const startDateStr = `${yearStr}-${monthStr}-01`;
        const endDateStr = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

        // 1. Sales Orders
        const [salesRows] = await pool.query<RowDataPacket[]>(
            `SELECT so.id, so.public_id, so.total_amount, so.date, so.nfe_key, so.nfe_issue_date, so.nfe_emitted_at, so.nfe_header_json,
                    so.status, so.manual_customer_name,
                    c.id AS customer_id, c.name AS customer_name, c.cnpj_cpf AS customer_cnpj
             FROM sales_orders so
             LEFT JOIN customers c ON so.customer_id = c.id
             WHERE (so.company_id = ? OR (so.company_id = ? AND so.customer_id = ?))
               AND (so.is_deleted = 0 OR so.is_deleted IS NULL)
               AND (
                   (so.date IS NOT NULL AND (DATE(so.date) BETWEEN ? AND ? OR DATE_FORMAT(so.date, '%Y-%m') = ?))
                   OR (so.nfe_issue_date IS NOT NULL AND (DATE(so.nfe_issue_date) BETWEEN ? AND ? OR DATE_FORMAT(so.nfe_issue_date, '%Y-%m') = ?))
                   OR (so.nfe_emitted_at IS NOT NULL AND (DATE(so.nfe_emitted_at) BETWEEN ? AND ? OR DATE_FORMAT(so.nfe_emitted_at, '%Y-%m') = ?))
                   OR (so.created_at IS NOT NULL AND (DATE(so.created_at) BETWEEN ? AND ? OR DATE_FORMAT(so.created_at, '%Y-%m') = ?))
               )
             ORDER BY COALESCE(so.nfe_issue_date, so.nfe_emitted_at, so.date, so.created_at) ASC, so.id ASC LIMIT 2000`,
            [targetCompId, companyId, customerId, startDateStr, endDateStr, competencia, startDateStr, endDateStr, competencia, startDateStr, endDateStr, competencia, startDateStr, endDateStr, competencia]
        );

        // 2. Purchase Orders
        const [purchRows] = await pool.query<RowDataPacket[]>(
            `SELECT po.id, po.public_id, po.total_amount, po.date, po.nfe_key, po.nfe_issue_date, po.nfe_header_json,
                    po.status,
                    s.id AS supplier_id, s.name AS supplier_name, s.cnpj_cpf AS supplier_cnpj
             FROM purchase_orders po
             LEFT JOIN suppliers s ON po.supplier_id = s.id
             WHERE (po.company_id = ? OR (po.company_id = ? AND ? = ?))
               AND (
                   (po.date IS NOT NULL AND (DATE(po.date) BETWEEN ? AND ? OR DATE_FORMAT(po.date, '%Y-%m') = ?))
                   OR (po.nfe_issue_date IS NOT NULL AND (DATE(po.nfe_issue_date) BETWEEN ? AND ? OR DATE_FORMAT(po.nfe_issue_date, '%Y-%m') = ?))
                   OR (po.created_at IS NOT NULL AND (DATE(po.created_at) BETWEEN ? AND ? OR DATE_FORMAT(po.created_at, '%Y-%m') = ?))
               )
             ORDER BY COALESCE(po.nfe_issue_date, po.date, po.created_at) ASC, po.id ASC LIMIT 2000`,
            [targetCompId, targetCompId, 1, 1, startDateStr, endDateStr, competencia, startDateStr, endDateStr, competencia, startDateStr, endDateStr, competencia]
        );

        // 3. Transactions (Revenues, Expenses, PDV, Solidcon)
        const [txRows] = await pool.query<RowDataPacket[]>(
            `SELECT t.id, t.public_id, t.amount, t.net_amount, t.type, t.description, t.date, t.date_launch, t.received_at, t.created_at, t.status,
                    t.payment_method, t.sale_id, t.purchase_id, t.pdv, t.cdfilial, t.solidcon_key,
                    c.id AS customer_id, c.name AS customer_name, c.cnpj_cpf AS customer_cnpj,
                    s.id AS supplier_id, s.name AS supplier_name, s.cnpj_cpf AS supplier_cnpj
             FROM transactions t
             LEFT JOIN customers c ON t.customer_id = c.id
             LEFT JOIN suppliers s ON t.supplier_id = s.id
             WHERE (t.company_id = ? OR (t.company_id = ? AND (t.customer_id = ? OR t.supplier_id IN (SELECT id FROM suppliers WHERE cnpj_cpf = ?))))
               AND (
                   (t.date IS NOT NULL AND (DATE(t.date) BETWEEN ? AND ? OR DATE_FORMAT(t.date, '%Y-%m') = ?))
                   OR (t.date_launch IS NOT NULL AND (DATE(t.date_launch) BETWEEN ? AND ? OR DATE_FORMAT(t.date_launch, '%Y-%m') = ?))
                   OR (t.received_at IS NOT NULL AND (DATE(t.received_at) BETWEEN ? AND ? OR DATE_FORMAT(t.received_at, '%Y-%m') = ?))
                   OR (t.created_at IS NOT NULL AND (DATE(t.created_at) BETWEEN ? AND ? OR DATE_FORMAT(t.created_at, '%Y-%m') = ?))
               )
               AND (t.status != 'cancelled' OR t.status IS NULL)
             ORDER BY COALESCE(t.date_launch, t.date, t.created_at) ASC, t.id ASC LIMIT 2000`,
            [targetCompId, companyId, customerId, customer.cnpj_cpf || '', startDateStr, endDateStr, competencia, startDateStr, endDateStr, competencia, startDateStr, endDateStr, competencia, startDateStr, endDateStr, competencia]
        );

        const documentsList: any[] = [];
        const seenSaleIds = new Set<number>();
        const seenPurchaseIds = new Set<number>();

        for (const s of (salesRows || [])) {
            seenSaleIds.add(s.id);
            let numDoc = String(s.id);
            let serie = '1';
            const effectiveDate = s.nfe_issue_date || s.nfe_emitted_at || s.date;
            const dtDoc = effectiveDate ? new Date(effectiveDate).toLocaleDateString('pt-BR') : dt_ini;
            let vlIcms = 0;
            let vlPis = 0;
            let vlCofins = 0;

            if (s.nfe_header_json) {
                try {
                    const h = typeof s.nfe_header_json === 'string' ? JSON.parse(s.nfe_header_json) : s.nfe_header_json;
                    if (h.numero || h.nNF) numDoc = String(h.numero || h.nNF);
                    if (h.serie) serie = String(h.serie);
                    if (h.vICMS !== undefined) vlIcms = Number(h.vICMS || 0);
                    if (h.vPIS !== undefined) vlPis = Number(h.vPIS || 0);
                    if (h.vCOFINS !== undefined) vlCofins = Number(h.vCOFINS || 0);
                } catch (_) {}
            } else if (s.nfe_key && s.nfe_key.length === 44) {
                const nNFExtracted = parseInt(s.nfe_key.substring(25, 34), 10);
                if (!isNaN(nNFExtracted) && nNFExtracted > 0) numDoc = String(nNFExtracted);
                const serieExtracted = parseInt(s.nfe_key.substring(22, 25), 10);
                if (!isNaN(serieExtracted) && serieExtracted > 0) serie = String(serieExtracted);
            }

            const vlDoc = Number(s.total_amount || 0);
            if (vlIcms === 0 && vlDoc > 0) vlIcms = Number((vlDoc * 0.18).toFixed(2));
            if (vlPis === 0 && vlDoc > 0) vlPis = Number((vlDoc * 0.0065).toFixed(2));
            if (vlCofins === 0 && vlDoc > 0) vlCofins = Number((vlDoc * 0.03).toFixed(2));

            const partDocClean = (s.customer_cnpj || '').replace(/\D/g, '');
            const mappedPart = (partDocClean && docToPartMap.get(partDocClean)) || (s.customer_id && docToPartMap.get(`cust_${s.customer_id}`));

            documentsList.push({
                reg: s.nfe_key ? 'C100 (NF-e)' : 'C100 (Pedido)',
                indOper: '1',
                type: 'Saída' as const,
                numDoc,
                serie,
                chvDoc: s.nfe_key || '',
                dtDoc,
                codPart: mappedPart?.cod || (s.customer_id ? String(s.customer_id).padStart(4, '0') : '0001'),
                partName: s.customer_name || s.manual_customer_name || mappedPart?.name || 'Consumidor Final',
                vlDoc,
                vlIcms,
                vlPis,
                vlCofins,
                codSit: s.status === 'cancelled' ? '02' : '00'
            });
        }

        for (const p of (purchRows || [])) {
            seenPurchaseIds.add(p.id);
            let numDoc = String(p.id);
            let serie = '1';
            const effectiveDate = p.nfe_issue_date || p.date;
            const dtDoc = effectiveDate ? new Date(effectiveDate).toLocaleDateString('pt-BR') : dt_ini;
            let vlIcms = 0;
            let vlPis = 0;
            let vlCofins = 0;

            if (p.nfe_header_json) {
                try {
                    const h = typeof p.nfe_header_json === 'string' ? JSON.parse(p.nfe_header_json) : p.nfe_header_json;
                    if (h.numero || h.nNF) numDoc = String(h.numero || h.nNF);
                    if (h.serie) serie = String(h.serie);
                    if (h.vICMS !== undefined) vlIcms = Number(h.vICMS || 0);
                    if (h.vPIS !== undefined) vlPis = Number(h.vPIS || 0);
                    if (h.vCOFINS !== undefined) vlCofins = Number(h.vCOFINS || 0);
                } catch (_) {}
            } else if (p.nfe_key && p.nfe_key.length === 44) {
                const nNFExtracted = parseInt(p.nfe_key.substring(25, 34), 10);
                if (!isNaN(nNFExtracted) && nNFExtracted > 0) numDoc = String(nNFExtracted);
                const serieExtracted = parseInt(p.nfe_key.substring(22, 25), 10);
                if (!isNaN(serieExtracted) && serieExtracted > 0) serie = String(serieExtracted);
            }

            const vlDoc = Number(p.total_amount || 0);
            if (vlIcms === 0 && vlDoc > 0) vlIcms = Number((vlDoc * 0.18).toFixed(2));
            if (vlPis === 0 && vlDoc > 0) vlPis = Number((vlDoc * 0.0065).toFixed(2));
            if (vlCofins === 0 && vlDoc > 0) vlCofins = Number((vlDoc * 0.03).toFixed(2));

            const partDocClean = (p.supplier_cnpj || '').replace(/\D/g, '');
            const mappedPart = (partDocClean && docToPartMap.get(partDocClean)) || (p.supplier_id && docToPartMap.get(`supp_${p.supplier_id}`));

            documentsList.push({
                reg: p.nfe_key ? 'C100 (NF-e)' : 'C100 (Compra)',
                indOper: '0',
                type: 'Entrada' as const,
                numDoc,
                serie,
                chvDoc: p.nfe_key || '',
                dtDoc,
                codPart: mappedPart?.cod || (p.supplier_id ? String(p.supplier_id).padStart(4, '0') : '0001'),
                partName: p.supplier_name || mappedPart?.name || 'Fornecedor',
                vlDoc,
                vlIcms,
                vlPis,
                vlCofins,
                codSit: p.status === 'cancelled' ? '02' : '00'
            });
        }

        for (const t of (txRows || [])) {
            if (t.sale_id && seenSaleIds.has(t.sale_id)) continue;
            if (t.purchase_id && seenPurchaseIds.has(t.purchase_id)) continue;

            const isIncome = t.type === 'revenue' || t.type === 'receita' || t.type === 'entrada';
            const effectiveDate = t.date_launch || t.date || t.received_at || t.created_at;
            const dtDoc = effectiveDate ? new Date(effectiveDate).toLocaleDateString('pt-BR') : dt_ini;
            const vlDoc = Number(t.amount || t.net_amount || 0);
            const vlIcms = 0;
            const vlPis = Number((vlDoc * 0.0065).toFixed(2));
            const vlCofins = Number((vlDoc * 0.03).toFixed(2));

            let docLabel = isIncome ? 'PDV / Caixa' : 'Despesa / Outros';
            if (t.pdv) docLabel = `PDV ${t.pdv}`;
            else if (t.solidcon_key) docLabel = `Solidcon #${t.id}`;
            else if (t.payment_method) docLabel = `Lanç. ${t.payment_method}`;

            let partyName = isIncome ? (t.customer_name || 'Venda Consumidor / PDV') : (t.supplier_name || t.description || 'Despesa Operacional');

            documentsList.push({
                reg: `C100 (${docLabel})`,
                indOper: isIncome ? '1' : '0',
                type: isIncome ? ('Saída' as const) : ('Entrada' as const),
                numDoc: `Fin. #${t.id}`,
                serie: '1',
                chvDoc: t.solidcon_key || '',
                dtDoc,
                codPart: isIncome ? (t.customer_id ? String(t.customer_id).padStart(4, '0') : '0001') : (t.supplier_id ? String(t.supplier_id).padStart(4, '0') : '0001'),
                partName: partyName,
                vlDoc,
                vlIcms,
                vlPis,
                vlCofins,
                codSit: t.status === 'cancelled' ? '02' : '00'
            });
        }

        // Check if fechamento has sped_data_json saved from SPED import
        let parsedSpedData: any = null;
        if (fech.sped_data_json) {
            try {
                parsedSpedData = typeof fech.sped_data_json === 'string' ? JSON.parse(fech.sped_data_json) : fech.sped_data_json;
            } catch (e) {
                console.error('Erro ao fazer parse de sped_data_json:', e);
            }
        }

        // Resolves Documents list: if SPED was imported, use exact SPED documents without corrupting with fallback ERP documents
        let finalDocuments: any[] = [];
        if (parsedSpedData?.documents && Array.isArray(parsedSpedData.documents) && parsedSpedData.documents.length > 0) {
            finalDocuments = parsedSpedData.documents;
        } else {
            finalDocuments = documentsList;
        }

        // Resolves Products list (0200): prioritizes SPED products
        let finalProducts = (parsedSpedData?.products && Array.isArray(parsedSpedData.products) && parsedSpedData.products.length > 0)
            ? parsedSpedData.products
            : productsList;

        // Resolves Participants list (0150): prioritizes SPED participants
        let finalParticipants = (parsedSpedData?.participants && Array.isArray(parsedSpedData.participants) && parsedSpedData.participants.length > 0)
            ? parsedSpedData.participants
            : participantsList;

        if (Number(fech.venda_valor || 0) === 0 && Number(fech.compra_valor || 0) === 0 && finalDocuments.length > 0 && !parsedSpedData?.totals) {
            const sumVendas = finalDocuments.filter(d => d.type === 'Saída').reduce((acc, d) => acc + (d.vlDoc || 0), 0);
            const sumCompras = finalDocuments.filter(d => d.type === 'Entrada').reduce((acc, d) => acc + (d.vlDoc || 0), 0);
            const sumIcmsSaidas = finalDocuments.filter(d => d.type === 'Saída').reduce((acc, d) => acc + (d.vlIcms || 0), 0);
            const sumIcmsEntradas = finalDocuments.filter(d => d.type === 'Entrada').reduce((acc, d) => acc + (d.vlIcms || 0), 0);

            fech.venda_valor = sumVendas;
            fech.venda_bs_icms = sumVendas;
            fech.compra_valor = sumCompras;
            fech.compra_bs_icms = sumCompras;
            fech.venda_pis = finalDocuments.filter(d => d.type === 'Saída').reduce((acc, d) => acc + (d.vlPis || 0), 0);
            fech.venda_cofins = finalDocuments.filter(d => d.type === 'Saída').reduce((acc, d) => acc + (d.vlCofins || 0), 0);
            fech.compra_pis = finalDocuments.filter(d => d.type === 'Entrada').reduce((acc, d) => acc + (d.vlPis || 0), 0);
            fech.compra_cofins = finalDocuments.filter(d => d.type === 'Entrada').reduce((acc, d) => acc + (d.vlCofins || 0), 0);
            fech.apuracao_icms = Math.max(0, Number((sumIcmsSaidas - sumIcmsEntradas).toFixed(2)));
            fech.apuracao_fecp = Number((sumVendas * 0.02).toFixed(2));
        }

        // Resolves saidasPorAliquota, entradasPorAliquota, analiticoC190, cfopDetails
        let finalSaidasPorAliquota: any[] = [];
        let finalEntradasPorAliquota: any[] = [];
        let finalAnaliticoC190: any[] = [];
        let finalCfopDetails: any[] = [];

        if (parsedSpedData?.saidasPorAliquota && Array.isArray(parsedSpedData.saidasPorAliquota) && parsedSpedData.saidasPorAliquota.length > 0) {
            finalSaidasPorAliquota = parsedSpedData.saidasPorAliquota;
        }
        if (parsedSpedData?.entradasPorAliquota && Array.isArray(parsedSpedData.entradasPorAliquota) && parsedSpedData.entradasPorAliquota.length > 0) {
            finalEntradasPorAliquota = parsedSpedData.entradasPorAliquota;
        }
        if (parsedSpedData?.analiticoC190 && Array.isArray(parsedSpedData.analiticoC190) && parsedSpedData.analiticoC190.length > 0) {
            finalAnaliticoC190 = parsedSpedData.analiticoC190;
        }
        if (parsedSpedData?.cfopDetails && Array.isArray(parsedSpedData.cfopDetails) && parsedSpedData.cfopDetails.length > 0) {
            finalCfopDetails = parsedSpedData.cfopDetails;
        }

        const totalVenda = Number(fech.venda_valor || 0);
        const totalCompra = Number(fech.compra_valor || 0);
        const totalMov = totalVenda + totalCompra;

        // Se saidasPorAliquota não existir no JSON salvo (SPED legado ou gerado por fechamento financeiro), constrói dinamicamente
        if (finalSaidasPorAliquota.length === 0 && totalVenda > 0) {
            const vTaxed = Number(fech.venda_bs_icms || fech.simples_valor_tributado || (totalVenda - Number(fech.venda_isento || 0) - Number(fech.venda_outros || 0)));
            const vExempt = Number(fech.venda_isento || fech.simples_valor_nao_tributado || 0);
            const vOutros = Number(fech.venda_outros || 0);
            const defaultAliq = 20.0; // Padrão estadual (ex: RJ 20% / 18%)

            if (vTaxed > 0) {
                const icmsTaxed = Number(fech.apuracao_icms || Number((vTaxed * 0.20).toFixed(2)));
                finalSaidasPorAliquota.push({
                    aliquota: defaultAliq,
                    aliquotaLabel: `${defaultAliq.toFixed(2).replace('.', ',')}%`,
                    valorTotal: vTaxed,
                    baseCalculo: vTaxed,
                    valorIcms: icmsTaxed,
                    cfops: ['5102'],
                    csts: ['000'],
                    countRegistros: 1,
                    percent: (vTaxed / totalVenda) * 100
                });
            }
            if (vExempt > 0) {
                finalSaidasPorAliquota.push({
                    aliquota: 0,
                    aliquotaLabel: 'Isentas / Não Tributadas (0%)',
                    valorTotal: vExempt,
                    baseCalculo: 0,
                    valorIcms: 0,
                    cfops: ['5405'],
                    csts: ['040'],
                    countRegistros: 1,
                    percent: (vExempt / totalVenda) * 100
                });
            }
            if (vOutros > 0) {
                finalSaidasPorAliquota.push({
                    aliquota: 0,
                    aliquotaLabel: 'Substituição Tributária / Outras (0%)',
                    valorTotal: vOutros,
                    baseCalculo: 0,
                    valorIcms: 0,
                    cfops: ['5405'],
                    csts: ['060'],
                    countRegistros: 1,
                    percent: (vOutros / totalVenda) * 100
                });
            }
        }

        if (finalEntradasPorAliquota.length === 0 && totalCompra > 0) {
            const cTaxed = Number(fech.compra_bs_icms || (totalCompra - Number(fech.compra_isento || 0) - Number(fech.compra_outros || 0)));
            const cExempt = Number(fech.compra_isento || 0);
            const cOutros = Number(fech.compra_outros || 0);
            const defaultAliq = 20.0;

            if (cTaxed > 0) {
                finalEntradasPorAliquota.push({
                    aliquota: defaultAliq,
                    aliquotaLabel: `${defaultAliq.toFixed(2).replace('.', ',')}%`,
                    valorTotal: cTaxed,
                    baseCalculo: cTaxed,
                    valorIcms: Number((cTaxed * 0.20).toFixed(2)),
                    cfops: ['1102'],
                    csts: ['000'],
                    countRegistros: 1,
                    percent: (cTaxed / totalCompra) * 100
                });
            }
            if (cExempt > 0 || cOutros > 0) {
                finalEntradasPorAliquota.push({
                    aliquota: 0,
                    aliquotaLabel: 'Isentas / ST (0%)',
                    valorTotal: cExempt + cOutros,
                    baseCalculo: 0,
                    valorIcms: 0,
                    cfops: ['1403'],
                    csts: ['060'],
                    countRegistros: 1,
                    percent: ((cExempt + cOutros) / totalCompra) * 100
                });
            }
        }

        // Garante que cada item de cfopDetails tenha aliquota, baseCalculo e valorIcms
        if (finalCfopDetails.length === 0) {
            for (const s of finalSaidasPorAliquota) {
                finalCfopDetails.push({
                    cfop: s.cfops?.[0] || (s.aliquota > 0 ? '5102' : '5405'),
                    type: 'Saída',
                    cstIcms: s.csts?.[0] || (s.aliquota > 0 ? '000' : '060'),
                    aliquota: s.aliquota,
                    aliquotaLabel: s.aliquotaLabel,
                    total: s.valorTotal,
                    baseCalculo: s.baseCalculo,
                    valorIcms: s.valorIcms,
                    percent: totalMov > 0 ? (s.valorTotal / totalMov) * 100 : 0
                });
            }
            for (const e of finalEntradasPorAliquota) {
                finalCfopDetails.push({
                    cfop: e.cfops?.[0] || (e.aliquota > 0 ? '1102' : '1403'),
                    type: 'Entrada',
                    cstIcms: e.csts?.[0] || (e.aliquota > 0 ? '000' : '060'),
                    aliquota: e.aliquota,
                    aliquotaLabel: e.aliquotaLabel,
                    total: e.valorTotal,
                    baseCalculo: e.baseCalculo,
                    valorIcms: e.valorIcms,
                    percent: totalMov > 0 ? (e.valorTotal / totalMov) * 100 : 0
                });
            }
        } else {
            // Enriquece itens legados caso não tenham campos de alíquota
            finalCfopDetails = finalCfopDetails.map((item: any) => {
                const isSaida = item.type === 'Saída' || item.cfop?.startsWith('5') || item.cfop?.startsWith('6') || item.cfop?.startsWith('7');
                const isExempt = item.cfop?.endsWith('405') || item.cfop?.endsWith('403') || item.cfop?.endsWith('401') || ['60', '40', '41', '500'].includes(item.cstIcms);
                const aliq = item.aliquota !== undefined ? Number(item.aliquota) : (isExempt ? 0 : 20);
                const bc = item.baseCalculo !== undefined ? Number(item.baseCalculo) : (aliq > 0 ? Number(item.total || 0) : 0);
                const icmsVal = item.valorIcms !== undefined ? Number(item.valorIcms) : (aliq > 0 ? Number((bc * (aliq / 100)).toFixed(2)) : 0);
                return {
                    ...item,
                    type: isSaida ? 'Saída' : 'Entrada',
                    aliquota: aliq,
                    aliquotaLabel: item.aliquotaLabel || (aliq > 0 ? `${aliq.toFixed(2).replace('.', ',')}%` : (isExempt ? 'Isento / ST (0%)' : '0,00%')),
                    baseCalculo: bc,
                    valorIcms: icmsVal,
                    percent: item.percent !== undefined ? Number(item.percent) : (totalMov > 0 ? (Number(item.total || 0) / totalMov) * 100 : 0)
                };
            });
        }

        const nextMonth = m === 12 ? 1 : m + 1;
        const nextYear = m === 12 ? y + 1 : y;
        const dueDay = '10';
        const dueDate = `${dueDay}/${String(nextMonth).padStart(2, '0')}/${nextYear}`;

        const icmsRecolher = Number(fech.apuracao_icms || 0);
        const fecpRecolher = fech.venda_bs_icms ? Number((fech.venda_bs_icms * 0.02).toFixed(2)) : (fech.apuracao_fecp || 0);

        const icmsObrigacoes = icmsRecolher > 0 ? [{
            cod_or: '000',
            vl_or: icmsRecolher,
            dt_vcto: dueDate,
            cod_rec: '037-1',
            txt_compl: 'ICMS Normal a Recolher'
        }] : [];

        const fecpObrigacoes = fecpRecolher > 0 ? [{
            cod_or: '000',
            vl_or: fecpRecolher,
            dt_vcto: dueDate,
            cod_rec: '750-2',
            txt_compl: 'FECP Lei 4.056/02 a Recolher',
            origem: 'E316'
        }] : [];

        // Apuração
        let finalApuracao = {
            icms: {
                vl_tot_debitos: fech.venda_bs_icms ? Number((fech.venda_bs_icms * 0.18).toFixed(2)) : icmsRecolher,
                vl_aj_debitos: Number(fech.apuracao_aj_icms || 0),
                vl_tot_creditos: fech.compra_bs_icms ? Number((fech.compra_bs_icms * 0.18).toFixed(2)) : 0,
                vl_aj_creditos: 0,
                vl_estornos_deb: 0,
                vl_estornos_cred: 0,
                vl_sld_credor_ant: 0,
                vl_sld_apurado: icmsRecolher,
                vl_tot_ded: 0,
                vl_icms_recolher: icmsRecolher,
                vl_sld_credor_transportar: 0,
                obrigacoes: icmsObrigacoes,
                tem_registro_e110: true
            },
            fecp: {
                base_calculo: Number(fech.venda_bs_icms || 0),
                aliquota: 2.0,
                vl_tot_debitos: fecpRecolher,
                vl_tot_creditos: 0,
                vl_fecp_recolher: fecpRecolher,
                vl_sld_credor_transportar: 0,
                obrigacoes: fecpObrigacoes,
                tem_registro_fecp: true
            },
            icms_st: {
                vl_icms_st_recolher: 0,
                vl_sld_credor_transportar: 0,
                obrigacoes: [],
                tem_registro_e210: false
            },
            totais_recolher: {
                icms_proprio: icmsRecolher,
                fecp: fecpRecolher,
                icms_st: 0,
                total_a_pagar: icmsRecolher + fecpRecolher
            }
        };

        if (parsedSpedData?.apuracao) {
            finalApuracao = parsedSpedData.apuracao;
        }

        // Header
        let finalHeader = {
            dt_ini,
            dt_fin,
            nome: targetCompany?.trade_name || (targetCompany as any)?.company_name || targetCompany?.name || customer.name || '',
            cnpj: targetCompany?.cnpj || customer.cnpj_cpf || '',
            cpf: '',
            cnpj_cpf: targetCompany?.cnpj || customer.cnpj_cpf || '',
            uf: targetCompany?.state || customer.state || 'RJ',
            ie: targetCompany?.ie || customer.inscricao_estadual || customer.ie || '',
            cod_mun: String(targetCompany?.cd_municipio || customer.cd_municipio || '3304557'),
            im: targetCompany?.im || customer.im || '',
            finalidade: 'Original',
            perfil: 'A',
            atividade: 'Outros',
            company_public_id: (targetCompany as any)?.public_id || null
        };

        if (parsedSpedData?.header) {
            finalHeader = {
                ...finalHeader,
                ...parsedSpedData.header
            };
            if ((targetCompany as any)?.public_id && !finalHeader.company_public_id) {
                finalHeader.company_public_id = (targetCompany as any).public_id;
            }
        }

        const totalEntries = finalDocuments.filter(d => d.indOper === '0' || d.type === 'Entrada').length;
        const totalExits = finalDocuments.filter(d => d.indOper === '1' || d.type === 'Saída').length;

        // Stats
        let finalStats = {
            totalLines: finalDocuments.length + finalParticipants.length + finalProducts.length + 100,
            totalParticipants: finalParticipants.length,
            totalProducts: finalProducts.length,
            totalDocuments: finalDocuments.length,
            totalEntries,
            totalExits
        };
        if (parsedSpedData?.stats) {
            finalStats = {
                ...finalStats,
                ...parsedSpedData.stats
            };
        }

        // Totals
        let finalTotals = {
            venda_valor: Number(fech.venda_valor || 0),
            venda_bs_icms: Number(fech.venda_bs_icms || 0),
            venda_isento: Number(fech.venda_isento || 0),
            venda_outros: Number(fech.venda_outros || 0),
            venda_pis: Number(fech.venda_pis || 0),
            venda_cofins: Number(fech.venda_cofins || 0),
            compra_valor: Number(fech.compra_valor || 0),
            compra_bs_icms: Number(fech.compra_bs_icms || 0),
            compra_isento: Number(fech.compra_isento || 0),
            compra_outros: Number(fech.compra_outros || 0),
            compra_pis: Number(fech.compra_pis || 0),
            compra_cofins: Number(fech.compra_cofins || 0),
            simples_valor_tributado: Number(fech.simples_valor_tributado || 0),
            simples_valor_nao_tributado: Number(fech.simples_valor_nao_tributado || 0),
            apuracao_icms: icmsRecolher,
            apuracao_fecp: fecpRecolher
        };
        if (parsedSpedData?.totals) {
            finalTotals = {
                ...finalTotals,
                ...parsedSpedData.totals
            };
        }

        return {
            header: finalHeader,
            stats: finalStats,
            totals: finalTotals,
            apuracao: finalApuracao,
            targetCompany: targetCompany ? {
                id: targetCompany.id,
                public_id: (targetCompany as any).public_id || null,
                trade_name: targetCompany.trade_name || (targetCompany as any).company_name || targetCompany.name,
                cnpj: targetCompany.cnpj
            } : null,
            importedStats: {
                isCompany: true,
                companyId: targetCompId,
                companyPublicId: (targetCompany as any)?.public_id || (parsedSpedData as any)?.importedStats?.companyPublicId || null,
                companyName: targetCompany?.trade_name || (targetCompany as any)?.company_name || targetCompany?.name || customer.name,
                importedCustomersCount: finalParticipants.filter((p: any) => p.role === 'Cliente' || p.role === 'Cliente / Fornecedor').length || custRows.length,
                importedSuppliersCount: finalParticipants.filter((p: any) => p.role === 'Fornecedor' || p.role === 'Cliente / Fornecedor').length || suppRows.length,
                importedProductsCount: finalProducts.length,
                totalParticipants: finalParticipants.length,
                totalProducts: finalProducts.length,
                fechamentoSaved: true,
                fechamentoAction: 'updated',
                isUpdate: true,
                competencia
            },
            products: finalProducts,
            cfopTotals: parsedSpedData?.cfopTotals || {},
            cfopDetails: finalCfopDetails,
            saidasPorAliquota: finalSaidasPorAliquota,
            entradasPorAliquota: finalEntradasPorAliquota,
            analiticoC190: finalAnaliticoC190,
            participants: finalParticipants,
            documents: finalDocuments,
            errors: []
        };
    }

    static async deleteImportedSpedMovement(
        companyId: number,
        customerId: number,
        competencia: string
    ): Promise<{ deleted: boolean; message: string }> {
        let customer: any = null;
        if (customerId && !isNaN(customerId) && customerId > 0) {
            const [customerRows] = await pool.query<RowDataPacket[]>(
                `SELECT c.*,
                        (SELECT comp.id FROM companies comp WHERE REPLACE(REPLACE(REPLACE(REPLACE(comp.cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = REPLACE(REPLACE(REPLACE(REPLACE(c.cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '') LIMIT 1) AS registered_company_id
                 FROM customers c
                 WHERE c.id = ? AND c.company_id = ? LIMIT 1`,
                [customerId, companyId]
            );
            if (customerRows && customerRows.length > 0) {
                customer = customerRows[0];
            }
        }

        if (!customer) {
            const targetCompId = (customerId && customerId > 0) ? customerId : companyId;
            const [compRows] = await pool.query<RowDataPacket[]>(
                `SELECT * FROM companies WHERE id = ? LIMIT 1`,
                [targetCompId]
            );
            if (compRows && compRows.length > 0) {
                const comp = compRows[0] as any;
                customer = {
                    id: 0,
                    company_id: companyId,
                    name: comp.trade_name || comp.company_name,
                    cnpj_cpf: comp.cnpj,
                    registered_company_id: comp.id
                };
            }
        }

        const docClean = (customer?.cnpj_cpf || '').replace(/\D/g, '');
        const targetCompId = customer?.registered_company_id || companyId;

        // Localiza os fechamentos fiscais dessa empresa e competência
        const [fechRows] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM fechamentos 
             WHERE (company_id = ? OR company_id = ?)
               AND (customer_id = ? OR customer_id IN (SELECT id FROM customers WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '') = ?) OR company_id = ? OR company_id = ?)
               AND competencia = ?`,
            [companyId, targetCompId, customerId || 0, docClean, companyId, targetCompId, competencia]
        );

        if (!fechRows || fechRows.length === 0) {
            return { deleted: false, message: 'Nenhum fechamento ou movimento SPED encontrado para esta competência.' };
        }

        const fechIds = fechRows.map((f: any) => f.id);
        await pool.query(
            `DELETE FROM fechamentos WHERE id IN (${fechIds.map(() => '?').join(',')})`,
            fechIds
        );

        return {
            deleted: true,
            message: `Movimento importado do SPED (${fechRows.length} registro(s)) apagado com sucesso para a competência ${competencia}.`
        };
    }

    static async batchImportPgdasRevenues(
        companyId: number,
        customerId: number,
        items: Array<{ competencia: string; valor: number }>
    ): Promise<{
        createdCount: number;
        updatedCount: number;
        totalProcessed: number;
        results: Array<{ competencia: string; action: 'created' | 'updated'; valor: number }>;
    }> {
        await this.validateCustomer(customerId, companyId);

        let createdCount = 0;
        let updatedCount = 0;
        const results: Array<{ competencia: string; action: 'created' | 'updated'; valor: number }> = [];

        for (const item of items) {
            const competencia = String(item.competencia || '').trim();
            const valor = Number(item.valor) || 0;
            if (!/^\d{4}-\d{2}$/.test(competencia)) continue;

            const [existing] = await pool.query<RowDataPacket[]>(
                `SELECT id, venda_valor, simples_faturamento FROM fechamentos 
                 WHERE company_id = ? AND customer_id = ? AND competencia = ? LIMIT 1`,
                [companyId, customerId, competencia]
            );

            if (existing && existing.length > 0 && existing[0]) {
                const current = existing[0];
                const currentVenda = Number(current.venda_valor) || 0;
                const newVenda = currentVenda > 0 ? currentVenda : valor;

                await pool.query(
                    `UPDATE fechamentos 
                     SET simples_faturamento = ?,
                         simples_valor_tributado = CASE WHEN simples_valor_tributado = 0 THEN ? ELSE simples_valor_tributado END,
                         venda_valor = ?
                     WHERE id = ?`,
                    [valor, valor, newVenda, current.id]
                );
                updatedCount++;
                results.push({ competencia, action: 'updated', valor });
            } else {
                const publicId = randomUUID();
                await pool.query(
                    `INSERT INTO fechamentos (
                        public_id, company_id, customer_id, competencia,
                        venda_valor, simples_faturamento, simples_valor_tributado,
                        observacao
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        publicId,
                        companyId,
                        customerId,
                        competencia,
                        valor,
                        valor,
                        valor,
                        'Importado via PGDAS (PDF) - Histórico'
                    ]
                );
                createdCount++;
                results.push({ competencia, action: 'created', valor });
            }
        }

        return {
            createdCount,
            updatedCount,
            totalProcessed: items.length,
            results
        };
    }

    private static getTagText(parent: any, tagName: string): string {
        if (!parent) return '';
        let node = parent.getElementsByTagName(tagName)[0];
        if (!node) {
            node = parent.getElementsByTagName(tagName.toLowerCase())[0];
        }
        if (!node) {
            node = parent.getElementsByTagName(tagName.toUpperCase())[0];
        }
        if (!node) {
            const children = parent.childNodes;
            if (children) {
                for (let i = 0; i < children.length; i++) {
                    const child = children[i];
                    if (child.nodeType === 1 && child.nodeName.toLowerCase() === tagName.toLowerCase()) {
                        node = child;
                        break;
                    }
                }
            }
        }
        return String(node?.textContent || '').trim();
    }
}
