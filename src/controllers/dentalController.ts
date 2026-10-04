import { Request, Response } from 'express';
import { z } from 'zod';
import { DentalService } from '../services/dentalService';
import { UserPayload } from '../types/express';
import { AppError } from '../errors/AppError';
import logger from '../config/logger';

const VALID_FDI_CODES = new Set([
    11, 12, 13, 14, 15, 16, 17, 18,
    21, 22, 23, 24, 25, 26, 27, 28,
    31, 32, 33, 34, 35, 36, 37, 38,
    41, 42, 43, 44, 45, 46, 47, 48,
    51, 52, 53, 54, 55,
    61, 62, 63, 64, 65,
    71, 72, 73, 74, 75,
    81, 82, 83, 84, 85
]);

const getOrCreateChartQuerySchema = z.object({
    customer_public_id: z.string().uuid('ID de cliente inválido')
});

const updateChartSchema = z.object({
    dentition: z.enum(['permanent', 'deciduous', 'mixed']).optional(),
    notes: z.string().nullable().optional()
});

const updateToothConditionSchema = z.object({
    tooth_code: z.coerce.number().refine(code => VALID_FDI_CODES.has(code), {
        message: 'Código de dente FDI inválido'
    }),
    condition: z.enum(['present', 'absent', 'extracted', 'implant', 'unerupted', 'retained']),
    notes: z.string().nullable().optional()
});

const createProcedureSchema = z.object({
    tooth_code: z.coerce.number().refine(code => VALID_FDI_CODES.has(code), {
        message: 'Código de dente FDI inválido'
    }).nullable().optional(),
    region: z.enum(['tooth', 'upper_arch', 'lower_arch', 'quadrant', 'mouth']).default('tooth'),
    faces: z.array(z.enum(['M', 'D', 'O', 'I', 'V', 'L', 'P'])).optional(),
    service_public_id: z.string().uuid('ID de serviço inválido').nullable().optional(),
    unit_price: z.coerce.number().min(0).optional(),
    status: z.enum(['existing', 'planned', 'quoted', 'approved', 'done', 'cancelled']).default('planned'),
    professional_user_public_id: z.string().uuid('ID de profissional inválido').nullable().optional(),
    planned_at: z.string().optional().nullable(),
    performed_at: z.string().optional().nullable(),
    notes: z.string().nullable().optional()
}).refine(data => data.status !== 'planned' || !!data.service_public_id, {
    message: 'service_public_id é obrigatório quando o status é planned',
    path: ['service_public_id']
});

const updateProcedureSchema = z.object({
    tooth_code: z.coerce.number().refine(code => VALID_FDI_CODES.has(code), {
        message: 'Código de dente FDI inválido'
    }).nullable().optional(),
    region: z.enum(['tooth', 'upper_arch', 'lower_arch', 'quadrant', 'mouth']).optional(),
    faces: z.array(z.enum(['M', 'D', 'O', 'I', 'V', 'L', 'P'])).optional(),
    service_public_id: z.string().uuid('ID de serviço inválido').nullable().optional(),
    unit_price: z.coerce.number().min(0).optional(),
    status: z.enum(['existing', 'planned', 'quoted', 'approved', 'done', 'cancelled']).optional(),
    professional_user_public_id: z.string().uuid('ID de profissional inválido').nullable().optional(),
    planned_at: z.string().optional().nullable(),
    performed_at: z.string().optional().nullable(),
    notes: z.string().nullable().optional()
});

const createChartQuoteSchema = z.object({
    procedure_public_ids: z.array(z.string().uuid('ID de procedimento inválido')).min(1, 'Selecione ao menos um procedimento'),
    observation: z.string().optional().nullable()
});

const performProcedureSchema = z.object({
    professional_user_public_id: z.string().uuid('ID de profissional inválido').optional().nullable(),
    performed_at: z.string().optional().nullable()
});

export class DentalController {
    static async getOrCreateChart(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const customerPublicId = (req.query.customer_public_id || req.body.customer_public_id || req.params.customer_id) as string;
            const validated = getOrCreateChartQuerySchema.parse({ customer_public_id: customerPublicId });

            const chart = await DentalService.getOrCreateChart(Number(user.company_id), validated.customer_public_id);
            res.status(200).json({ status: 'success', data: chart });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                const msgs = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(' | ');
                res.status(400).json({ status: 'error', message: `Dados inválidos: ${msgs}`, errors: error.errors });
                return;
            }
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ status: 'error', message: error.message });
                return;
            }
            logger.error({ err: error }, '[DentalController.getOrCreateChart] Erro');
            res.status(500).json({ status: 'error', message: 'Erro interno ao obter odontograma' });
        }
    }

    static async getChart(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const chartPublicId = req.params.id as string;
            const chart = await DentalService.getChart(Number(user.company_id), chartPublicId);
            res.status(200).json({ status: 'success', data: chart });
        } catch (error: any) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ status: 'error', message: error.message });
                return;
            }
            logger.error({ err: error, id: req.params.id }, '[DentalController.getChart] Erro');
            res.status(500).json({ status: 'error', message: 'Erro ao buscar odontograma' });
        }
    }

    static async updateChart(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const chartPublicId = req.params.id as string;
            const validated = updateChartSchema.parse(req.body);

            const chart = await DentalService.updateChart(Number(user.company_id), chartPublicId, validated);
            res.status(200).json({ status: 'success', data: chart });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                const msgs = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(' | ');
                res.status(400).json({ status: 'error', message: `Dados inválidos: ${msgs}`, errors: error.errors });
                return;
            }
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ status: 'error', message: error.message });
                return;
            }
            logger.error({ err: error, id: req.params.id }, '[DentalController.updateChart] Erro');
            res.status(500).json({ status: 'error', message: 'Erro ao atualizar odontograma' });
        }
    }

    static async updateToothCondition(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const chartPublicId = req.params.id as string;
            const toothCode = req.params.tooth_code ? Number(req.params.tooth_code) : req.body.tooth_code;
            const validated = updateToothConditionSchema.parse({
                ...req.body,
                tooth_code: toothCode
            });

            const teeth = await DentalService.updateToothCondition(
                Number(user.company_id),
                chartPublicId,
                validated.tooth_code,
                validated.condition,
                validated.notes
            );
            res.status(200).json({ status: 'success', data: teeth });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                const msgs = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(' | ');
                res.status(400).json({ status: 'error', message: `Dados inválidos: ${msgs}`, errors: error.errors });
                return;
            }
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ status: 'error', message: error.message });
                return;
            }
            logger.error({ err: error, id: req.params.id }, '[DentalController.updateToothCondition] Erro');
            res.status(500).json({ status: 'error', message: 'Erro ao atualizar condição do dente' });
        }
    }

    static async listProcedures(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const chartPublicId = req.params.id as string;
            const procedures = await DentalService.listProcedures(Number(user.company_id), chartPublicId);
            res.status(200).json({ status: 'success', data: procedures });
        } catch (error: any) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ status: 'error', message: error.message });
                return;
            }
            logger.error({ err: error, id: req.params.id }, '[DentalController.listProcedures] Erro');
            res.status(500).json({ status: 'error', message: 'Erro ao listar procedimentos' });
        }
    }

    static async createProcedure(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const chartPublicId = req.params.id as string;
            const validated = createProcedureSchema.parse(req.body);

            const procedure = await DentalService.createProcedure(
                Number(user.company_id),
                chartPublicId,
                Number(user.id),
                validated
            );
            res.status(201).json({ status: 'success', data: procedure });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                const msgs = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(' | ');
                res.status(400).json({ status: 'error', message: `Dados inválidos: ${msgs}`, errors: error.errors });
                return;
            }
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ status: 'error', message: error.message });
                return;
            }
            logger.error({ err: error, id: req.params.id }, '[DentalController.createProcedure] Erro');
            res.status(500).json({ status: 'error', message: 'Erro ao criar procedimento' });
        }
    }

    static async updateProcedure(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const procedurePublicId = req.params.id as string;
            const validated = updateProcedureSchema.parse(req.body);

            const procedure = await DentalService.updateProcedure(
                Number(user.company_id),
                procedurePublicId,
                validated
            );
            res.status(200).json({ status: 'success', data: procedure });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                const msgs = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(' | ');
                res.status(400).json({ status: 'error', message: `Dados inválidos: ${msgs}`, errors: error.errors });
                return;
            }
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ status: 'error', message: error.message });
                return;
            }
            logger.error({ err: error, id: req.params.id }, '[DentalController.updateProcedure] Erro');
            res.status(500).json({ status: 'error', message: 'Erro ao atualizar procedimento' });
        }
    }

    static async deleteProcedure(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const procedurePublicId = req.params.id as string;

            await DentalService.deleteProcedure(Number(user.company_id), procedurePublicId);
            res.status(200).json({ status: 'success', message: 'Procedimento removido com sucesso' });
        } catch (error: any) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ status: 'error', message: error.message });
                return;
            }
            logger.error({ err: error, id: req.params.id }, '[DentalController.deleteProcedure] Erro');
            res.status(500).json({ status: 'error', message: 'Erro ao remover procedimento' });
        }
    }

    static async createQuote(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const chartPublicId = req.params.id as string;
            const validated = createChartQuoteSchema.parse(req.body);

            const quote = await DentalService.createQuoteForProcedures(
                Number(user.company_id),
                String(user.id),
                chartPublicId,
                validated
            );
            res.status(201).json({ status: 'success', data: quote });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                const msgs = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(' | ');
                res.status(400).json({ status: 'error', message: `Dados inválidos: ${msgs}`, errors: error.errors });
                return;
            }
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ status: 'error', message: error.message });
                return;
            }
            logger.error({ err: error, id: req.params.id }, '[DentalController.createQuote] Erro');
            res.status(500).json({ status: 'error', message: error.message || 'Erro ao gerar orçamento dos procedimentos' });
        }
    }

    static async performProcedure(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const procedurePublicId = req.params.id as string;
            const validated = performProcedureSchema.parse(req.body);

            const procedure = await DentalService.performProcedure(
                Number(user.company_id),
                procedurePublicId,
                validated
            );
            res.status(200).json({ status: 'success', data: procedure });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                const msgs = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(' | ');
                res.status(400).json({ status: 'error', message: `Dados inválidos: ${msgs}`, errors: error.errors });
                return;
            }
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ status: 'error', message: error.message });
                return;
            }
            logger.error({ err: error, id: req.params.id }, '[DentalController.performProcedure] Erro');
            res.status(500).json({ status: 'error', message: error.message || 'Erro ao registrar realização do procedimento' });
        }
    }
}
