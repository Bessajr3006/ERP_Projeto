import { Request, Response } from 'express';
import { z } from 'zod';
import { FechamentoService } from '../services/fechamentoService';
import { AppError } from '../errors/AppError';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { randomUUID } from 'crypto';

const currencyField = z.preprocess(
    (val) => {
        if (val === '' || val === null || val === undefined) return 0;
        const parsed = Number(val);
        return isNaN(parsed) ? 0 : parsed;
    },
    z.number().nonnegative()
);

const fechamentoCreateSchema = z.object({
    customerId: z.preprocess(
        (val) => {
            if (val === '' || val === null || val === undefined) return undefined;
            const parsed = Number(val);
            return isNaN(parsed) ? undefined : parsed;
        },
        z.number({ required_error: 'Cliente é obrigatório' }).int()
    ),
    competencia: z.string().trim().regex(/^\d{4}-\d{2}$/, 'Competência inválida (formato YYYY-MM)'),
    compra: z.object({
        valor: currencyField.optional().default(0),
        bs_icms: currencyField.optional().default(0),
        isento: currencyField.optional().default(0),
        outros: currencyField.optional().default(0),
        pis: currencyField.optional().default(0),
        cofins: currencyField.optional().default(0),
    }).optional().default({}),
    venda: z.object({
        valor: currencyField.optional().default(0),
        bs_icms: currencyField.optional().default(0),
        isento: currencyField.optional().default(0),
        outros: currencyField.optional().default(0),
        pis: currencyField.optional().default(0),
        cofins: currencyField.optional().default(0),
    }).optional().default({}),
    apuracao: z.object({
        icms: currencyField.optional().default(0),
        fecp: currencyField.optional().default(0),
        pis: currencyField.optional().default(0),
        cofins: currencyField.optional().default(0),
        aj_icms: currencyField.optional().default(0),
        aj_fecp: currencyField.optional().default(0),
        aj_pis: currencyField.optional().default(0),
        aj_cofins: currencyField.optional().default(0),
    }).optional().default({}),
    despesa: z.object({
        adm: currencyField.optional().default(0),
        operacional: currencyField.optional().default(0),
        folha: currencyField.optional().default(0),
        cmv: currencyField.optional().default(0),
        ir_aluguel: currencyField.optional().default(0),
    }).optional().default({}),
    imposto_federal: z.object({
        irpj: currencyField.optional().default(0),
        csll: currencyField.optional().default(0),
    }).optional().default({}),
    simples: z.object({
        faturamento: currencyField.optional().default(0),
        aliquota: currencyField.optional().default(0),
        das: currencyField.optional().default(0),
        cpp: currencyField.optional().default(0),
        icms: currencyField.optional().default(0),
        ipi: currencyField.optional().default(0),
        iss: currencyField.optional().default(0),
        pis: currencyField.optional().default(0),
        cofins: currencyField.optional().default(0),
        irpj: currencyField.optional().default(0),
        csll: currencyField.optional().default(0),
        faturamento_acumulado_12m: currencyField.optional().default(0),
        faturamento_acumulado_ano_anterior: currencyField.optional().default(0),
        valor_tributado: currencyField.optional().default(0),
        valor_nao_tributado: currencyField.optional().default(0),
    }).optional().default({}),
    observacao: z.string().nullable().optional(),
});

const fechamentoUpdateSchema = fechamentoCreateSchema.partial();

export class FechamentoController {
    static async create(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const validatedData = fechamentoCreateSchema.parse(req.body);

        const result = await FechamentoService.create(companyId, validatedData);

        return res.status(201).json({
            status: 'success',
            data: result
        });
    }

    static async importSalesXml(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const userPublicId = req.user!.id;
        
        const customerId = Number(req.body.customerId);
        const xmls = req.body.xmls;
        
        if (!customerId) {
            return res.status(400).json({ status: 'error', message: 'Cliente não informado.' });
        }
        if (!Array.isArray(xmls) || xmls.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Nenhum XML enviado.' });
        }
        
        const result = await FechamentoService.importSalesXml(companyId, userPublicId, customerId, xmls);
        
        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async importSpedFiscal(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const userPublicId = req.user!.id;
        
        const customerId = req.body.customerId ? Number(req.body.customerId) : null;
        const fileContent = req.body.fileContent;
        
        if (!fileContent) {
            return res.status(400).json({ status: 'error', message: 'Conteúdo do arquivo SPED não enviado.' });
        }
        
        const result = await FechamentoService.importSpedFiscal(companyId, userPublicId, customerId, fileContent);
        
        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async getFaturamentoAcumulado(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const customerId = Number(req.query.customerId);
        const competencia = String(req.query.competencia || '').trim();

        if (!customerId) {
            return res.status(400).json({ status: 'error', message: 'Cliente não informado.' });
        }
        if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
            return res.status(400).json({ status: 'error', message: 'Competência inválida (formato YYYY-MM).' });
        }

        const data = await FechamentoService.getFaturamentoAcumulado(companyId, customerId, competencia);
        return res.status(200).json({
            status: 'success',
            data
        });
    }

    private static async resolveTargetCompany(req: Request, targetCompanyParam?: any) {
        if (!targetCompanyParam) return null;
        const { CompanyService } = await import('../services/companyService');
        let target = null;
        if (typeof targetCompanyParam === 'string' && targetCompanyParam.includes('-')) {
            target = await CompanyService.getByPublicId(targetCompanyParam);
        } else if (!isNaN(Number(targetCompanyParam))) {
            target = await CompanyService.getById(Number(targetCompanyParam));
        }
        if (target) {
            const { CompanyController } = await import('./companyController');
            if (await CompanyController.hasAccess(req, target.id)) {
                return target;
            }
        }
        return null;
    }

    static async list(req: Request, res: Response): Promise<any> {
        const userCompanyId = req.user!.company_id;
        const requestedCompany = req.query.targetCompanyId || req.query.companyId || req.query.company_id;
        
        const [generalAdminRows] = await pool.query<RowDataPacket[]>(
            'SELECT is_general_admin FROM companies WHERE id = ? LIMIT 1',
            [userCompanyId]
        );
        const isGeneralAdmin = req.user?.role === 'super_admin' || 
                               Boolean(generalAdminRows?.[0]?.is_general_admin === 1 || generalAdminRows?.[0]?.is_general_admin === true);

        let targetCompanyIds: number | number[] = userCompanyId;

        if (isGeneralAdmin) {
            if (requestedCompany && requestedCompany !== 'all') {
                const target = await FechamentoController.resolveTargetCompany(req, requestedCompany);
                if (target) {
                    targetCompanyIds = target.id;
                } else {
                    return res.status(403).json({ status: 'error', message: 'Sem permissão para acessar os dados desta empresa.' });
                }
            } else {
                // "all" or not specified for ADM Geral: all companies
                const [allComps] = await pool.query<RowDataPacket[]>('SELECT id FROM companies');
                targetCompanyIds = allComps.map(c => c.id);
            }
        } else {
            // When NOT ADM Geral: strictly only the selected company from session / context
            targetCompanyIds = userCompanyId;
        }

        const filters: { customerId?: number; competencia?: string; customerGroupId?: number; taxRegime?: string } = {};
        if (req.query.customerId) {
            filters.customerId = Number(req.query.customerId);
        }
        if (req.query.competencia) {
            filters.competencia = String(req.query.competencia);
        }
        if (req.query.customerGroupId) {
            filters.customerGroupId = Number(req.query.customerGroupId);
        }
        if (req.query.taxRegime || req.query.regime) {
            filters.taxRegime = String(req.query.taxRegime || req.query.regime);
        }

        const result = await FechamentoService.list(targetCompanyIds, filters);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async getByPublicId(req: Request, res: Response): Promise<any> {
        const publicId = req.params.id;

        if (!publicId) {
            throw new AppError('O ID público é obrigatório', 400);
        }

        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT company_id FROM fechamentos WHERE public_id = ? LIMIT 1',
            [publicId]
        );
        if (!rows || rows.length === 0) {
            throw new AppError('Fechamento não encontrado.', 404);
        }

        const fechCompanyId = rows[0]!.company_id;
        const { CompanyController } = await import('./companyController');
        if (!(await CompanyController.hasAccess(req, fechCompanyId))) {
            throw new AppError('Acesso negado a este fechamento.', 403);
        }

        const result = await FechamentoService.getByPublicId(publicId, fechCompanyId);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async update(req: Request, res: Response): Promise<any> {
        const publicId = req.params.id;
        const validatedData = fechamentoUpdateSchema.parse(req.body);

        if (!publicId) {
            throw new AppError('O ID público é obrigatório', 400);
        }

        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT company_id FROM fechamentos WHERE public_id = ? LIMIT 1',
            [publicId]
        );
        if (!rows || rows.length === 0) {
            throw new AppError('Fechamento não encontrado.', 404);
        }

        const fechCompanyId = rows[0]!.company_id;
        const { CompanyController } = await import('./companyController');
        if (!(await CompanyController.hasAccess(req, fechCompanyId))) {
            throw new AppError('Acesso negado a este fechamento.', 403);
        }

        const result = await FechamentoService.update(publicId, fechCompanyId, validatedData);

        return res.status(200).json({
            status: 'success',
            message: 'Fechamento atualizado com sucesso',
            data: result
        });
    }

    static async delete(req: Request, res: Response): Promise<any> {
        const publicId = req.params.id;

        if (!publicId) {
            throw new AppError('O ID público é obrigatório', 400);
        }

        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT company_id FROM fechamentos WHERE public_id = ? LIMIT 1',
            [publicId]
        );
        if (!rows || rows.length === 0) {
            throw new AppError('Fechamento não encontrado.', 404);
        }

        const fechCompanyId = rows[0]!.company_id;
        const { CompanyController } = await import('./companyController');
        if (!(await CompanyController.hasAccess(req, fechCompanyId))) {
            throw new AppError('Acesso negado a este fechamento.', 403);
        }

        await FechamentoService.delete(publicId, fechCompanyId);

        return res.status(200).json({
            status: 'success',
            message: 'Fechamento excluído com sucesso'
        });
    }

    static async getSpedVision(req: Request, res: Response): Promise<any> {
        const userCompanyId = req.user!.company_id;
        const rawCust = req.query.customerId;
        const customerId = rawCust !== undefined && rawCust !== '' ? Number(rawCust) : 0;
        const competencia = String(req.query.competencia || '').trim();
        const requestedCompany = req.query.targetCompanyId || req.query.companyId || req.query.company_id;

        let targetCompanyId = userCompanyId;
        if (requestedCompany) {
            const target = await FechamentoController.resolveTargetCompany(req, requestedCompany);
            if (target) {
                targetCompanyId = target.id;
            }
        }

        if (isNaN(customerId)) {
            throw new AppError('O ID do cliente/empresa é inválido.', 400);
        }
        if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
            throw new AppError('A competência é obrigatória no formato YYYY-MM (ex: 2026-03).', 400);
        }

        const result = await FechamentoService.getSpedVision(targetCompanyId, customerId, competencia);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async deleteImportedSpedMovement(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const rawCust = req.body?.customerId ?? req.query?.customerId;
        const customerId = rawCust !== undefined && rawCust !== '' ? Number(rawCust) : 0;
        const competencia = String(req.body?.competencia || req.query?.competencia || '').trim();

        if (isNaN(customerId)) {
            throw new AppError('O ID do cliente/empresa é inválido.', 400);
        }
        if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
            throw new AppError('A competência é obrigatória no formato YYYY-MM (ex: 2026-03).', 400);
        }

        const result = await FechamentoService.deleteImportedSpedMovement(companyId, customerId, competencia);

        return res.status(200).json({
            status: 'success',
            message: result.message,
            data: result
        });
    }

    static async parsePgdas(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const pdfBase64 = req.body.pdfBase64 || req.body.fileContent;
        
        if (!pdfBase64) {
            return res.status(400).json({ status: 'error', message: 'Arquivo PDF não informado.' });
        }

        const { PgdasPdfParser } = await import('../services/pgdasPdfParser');
        const { EntityRepository } = await import('../repositories/entityRepository');

        const extracted = await PgdasPdfParser.parseBase64(pdfBase64);

        let customer: any = null;
        if (extracted.cnpj_limpo) {
            customer = await EntityRepository.getCustomerByDocument(companyId, extracted.cnpj_limpo);
        }
        if (!customer && extracted.cnpj) {
            customer = await EntityRepository.getCustomerByDocument(companyId, extracted.cnpj);
        }
        if (!customer && extracted.razao_social) {
            customer = await EntityRepository.getCustomerByName(companyId, extracted.razao_social);
        }

        // Auto-match or register as customer if not found
        if (!customer && (extracted.cnpj_limpo || extracted.cnpj || extracted.razao_social)) {
            const cleanDoc = extracted.cnpj_limpo || (extracted.cnpj || '').replace(/\D/g, '');
            
            let [custRows] = await pool.query<RowDataPacket[]>(
                `SELECT * FROM customers 
                 WHERE company_id = ? AND (
                     (cnpj_cpf IS NOT NULL AND REPLACE(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '') = ?)
                     OR (? != '' AND LOWER(TRIM(name)) = LOWER(TRIM(?)))
                 ) LIMIT 1`,
                [companyId, cleanDoc, extracted.razao_social || '', extracted.razao_social || '']
            );
            
            if (custRows && custRows.length > 0) {
                customer = custRows[0];
            } else {
                let compName = extracted.razao_social || '';
                let compTrade = extracted.razao_social || '';
                let compDoc = extracted.cnpj || cleanDoc;

                if (cleanDoc) {
                    const [compRows] = await pool.query<RowDataPacket[]>(
                        `SELECT * FROM companies 
                         WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = ? LIMIT 1`,
                        [cleanDoc]
                    );
                    if (compRows && compRows.length > 0 && compRows[0]) {
                        const comp = compRows[0];
                        compName = comp.company_name || comp.trade_name || compName;
                        compTrade = comp.trade_name || comp.company_name || compTrade;
                        compDoc = comp.cnpj || compDoc;
                    }
                }

                if (compName || compDoc) {
                    const newCustPublicId = randomUUID();
                    const [insRes] = await pool.query<ResultSetHeader>(
                        `INSERT INTO customers (public_id, company_id, name, trade_name, cnpj_cpf, tax_regime)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [newCustPublicId, companyId, compName || `Empresa ${compDoc}`, compTrade || compName || `Empresa ${compDoc}`, compDoc, 'Simples Nacional']
                    );
                    customer = {
                        id: insRes.insertId,
                        public_id: newCustPublicId,
                        name: compName || `Empresa ${compDoc}`,
                        trade_name: compTrade || compName || `Empresa ${compDoc}`,
                        cnpj_cpf: compDoc,
                        tax_regime: 'Simples Nacional'
                    };
                }
            }
        }

        let existingFechamento: any = null;
        let existingMonthsMap: Record<string, { id: number; valor_faturamento: number }> = {};

        if (customer && customer.id) {
            if (extracted.competencia) {
                const [rows] = await pool.query<RowDataPacket[]>(
                    `SELECT id, public_id, competencia, simples_faturamento, simples_das FROM fechamentos
                     WHERE company_id = ? AND customer_id = ? AND competencia = ? LIMIT 1`,
                    [companyId, customer.id, extracted.competencia]
                );
                if (rows && rows.length > 0) {
                    existingFechamento = rows[0];
                }
            }

            // Check which of the past months already exist in ERP
            if (extracted.receitas_anteriores && extracted.receitas_anteriores.length > 0) {
                const comps = extracted.receitas_anteriores.map(r => r.competencia);
                const [monthRows] = await pool.query<RowDataPacket[]>(
                    `SELECT id, competencia, simples_faturamento, venda_valor FROM fechamentos
                     WHERE company_id = ? AND customer_id = ? AND competencia IN (?)`,
                    [companyId, customer.id, comps]
                );
                for (const mRow of monthRows) {
                    existingMonthsMap[mRow.competencia] = {
                        id: mRow.id,
                        valor_faturamento: Number(mRow.simples_faturamento || mRow.venda_valor || 0)
                    };
                }
            }
        }

        const pastMonths = (extracted.receitas_anteriores || []).map(r => {
            const existing = existingMonthsMap[r.competencia];
            return {
                competencia: r.competencia,
                competenciaFormatted: r.mesAno || r.competencia,
                revenue: r.valor,
                exists: !!existing,
                existingId: existing?.id,
                existingValor: existing?.valor_faturamento || 0
            };
        });

        return res.status(200).json({
            status: 'success',
            data: {
                ...extracted,
                customer: customer ? {
                    id: customer.id,
                    public_id: customer.public_id,
                    name: customer.name,
                    trade_name: customer.trade_name,
                    cnpj_cpf: customer.cnpj_cpf,
                    customer_group_id: customer.customer_group_id
                } : null,
                customerFound: !!customer,
                cnpj: extracted.cnpj,
                razaoSocial: extracted.razao_social,
                competencia: extracted.competencia,
                simples_faturamento: extracted.faturamento_mes,
                simples_valor_tributado: extracted.valor_tributado || extracted.faturamento_mes,
                simples_valor_nao_tributado: extracted.valor_nao_tributado || 0,
                venda_valor: extracted.faturamento_mes,
                simples_aliquota: extracted.aliquota_efetiva,
                simples_das: extracted.total_das,
                simples_cpp: extracted.tributos?.cpp || 0,
                simples_icms: extracted.tributos?.icms || 0,
                simples_ipi: extracted.tributos?.ipi || 0,
                simples_iss: extracted.tributos?.iss || 0,
                simples_pis: extracted.tributos?.pis || 0,
                simples_cofins: extracted.tributos?.cofins || 0,
                simples_irpj: extracted.tributos?.irpj || 0,
                simples_csll: extracted.tributos?.csll || 0,
                simples_faturamento_acumulado_12m: extracted.rbt12,
                simples_faturamento_acumulado_ano_anterior: extracted.rbaa,
                pastMonths,
                existingFechamento,
                existingMonthsMap
            }
        });
    }

    static async batchImportPgdas(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const customerId = Number(req.body.customerId);
        const rawItems = req.body.months || req.body.items || [];
        const items = Array.isArray(rawItems) ? rawItems.map((it: any) => ({
            competencia: String(it.competencia || '').trim(),
            valor: Number(it.revenue !== undefined ? it.revenue : it.valor) || 0
        })) : [];

        if (!customerId) {
            return res.status(400).json({ status: 'error', message: 'Cliente não informado.' });
        }
        if (items.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Nenhum mês para importar.' });
        }

        const result = await FechamentoService.batchImportPgdasRevenues(companyId, customerId, items);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }
}
