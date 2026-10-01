import { Request, Response } from 'express';
import { z } from 'zod';
import { FechamentoService } from '../services/fechamentoService';
import { AppError } from '../errors/AppError';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';

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

    static async list(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        
        const filters: { customerId?: number; competencia?: string; customerGroupId?: number } = {};
        if (req.query.customerId) {
            filters.customerId = Number(req.query.customerId);
        }
        if (req.query.competencia) {
            filters.competencia = String(req.query.competencia);
        }
        if (req.query.customerGroupId) {
            filters.customerGroupId = Number(req.query.customerGroupId);
        }

        const result = await FechamentoService.list(companyId, filters);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async getByPublicId(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;

        if (!publicId) {
            throw new AppError('O ID público é obrigatório', 400);
        }

        const result = await FechamentoService.getByPublicId(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async update(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;
        const validatedData = fechamentoUpdateSchema.parse(req.body);

        if (!publicId) {
            throw new AppError('O ID público é obrigatório', 400);
        }

        const result = await FechamentoService.update(publicId, companyId, validatedData);

        return res.status(200).json({
            status: 'success',
            message: 'Fechamento atualizado com sucesso',
            data: result
        });
    }

    static async delete(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;

        if (!publicId) {
            throw new AppError('O ID público é obrigatório', 400);
        }

        await FechamentoService.delete(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            message: 'Fechamento excluído com sucesso'
        });
    }

    static async getSpedVision(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const rawCust = req.query.customerId;
        const customerId = rawCust !== undefined && rawCust !== '' ? Number(rawCust) : 0;
        const competencia = String(req.query.competencia || '').trim();

        if (isNaN(customerId)) {
            throw new AppError('O ID do cliente/empresa é inválido.', 400);
        }
        if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
            throw new AppError('A competência é obrigatória no formato YYYY-MM (ex: 2026-03).', 400);
        }

        const result = await FechamentoService.getSpedVision(companyId, customerId, competencia);

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
