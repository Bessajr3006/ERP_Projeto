import { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/AppError';
import { DentalService } from '../services/dentalService';
import {
    DENTITIONS,
    PROCEDURE_REGIONS,
    TOOTH_CONDITIONS,
    TOOTH_FACES,
    isValidFdiToothCode,
} from '../types/Dental';

const FDI_MESSAGE = 'Código de dente inválido (FDI: 11-18, 21-28, 31-38, 41-48, 51-55, 61-65, 71-75, 81-85).';

const toothCodeSchema = z.coerce.number().int().refine(isValidFdiToothCode, { message: FDI_MESSAGE });

const dateString = z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Data inválida' });

const createChartSchema = z.object({
    customer_public_id: z.string().uuid('Paciente inválido'),
    dentition: z.enum(DENTITIONS).optional(),
    notes: z.string().max(5000).nullable().optional(),
});

const updateChartSchema = z.object({
    dentition: z.enum(DENTITIONS).optional(),
    notes: z.string().max(5000).nullable().optional(),
});

const upsertTeethSchema = z.object({
    teeth: z.array(z.object({
        tooth_code: toothCodeSchema,
        condition: z.enum(TOOTH_CONDITIONS),
        notes: z.string().max(2000).nullable().optional(),
    })).min(1, 'Informe ao menos um dente').max(52),
});

const procedureBaseSchema = z.object({
    tooth_code: toothCodeSchema.nullable().optional(),
    region: z.enum(PROCEDURE_REGIONS).optional(),
    faces: z.array(z.enum(TOOTH_FACES)).max(7).optional(),
    service_public_id: z.string().uuid('Serviço inválido').nullable().optional(),
    unit_price: z.coerce.number().min(0).nullable().optional(),
    status: z.enum(['existing', 'planned', 'cancelled']).optional(),
    professional_user_id: z.string().uuid('Profissional inválido').nullable().optional(),
    planned_at: dateString.nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
});

const createProcedureSchema = procedureBaseSchema.superRefine((data, ctx) => {
    const region = data.region || 'tooth';
    if ((region === 'tooth' || region === 'quadrant') && !data.tooth_code) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tooth_code'], message: 'Informe o dente (FDI) para procedimentos por dente/quadrante.' });
    }
    if (region !== 'tooth' && data.faces && data.faces.length > 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['faces'], message: 'Faces só se aplicam a procedimentos por dente.' });
    }
});

const updateProcedureSchema = procedureBaseSchema;

const quoteSchema = z.object({
    procedure_public_ids: z.array(z.string().uuid('Procedimento inválido')).min(1, 'Selecione ao menos um procedimento planejado').max(200),
    seller_public_id: z.string().uuid().nullable().optional(),
    date: dateString.nullable().optional(),
    validity_date: dateString.nullable().optional(),
    observation: z.string().max(5000).nullable().optional(),
    payment_terms: z.string().max(100).nullable().optional(),
});

const performSchema = z.object({
    professional_user_id: z.string().uuid('Profissional inválido').nullable().optional(),
    performed_at: dateString.nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
});

function requireParam(req: Request, name: string, label: string): string {
    const value = String(req.params[name] || '').trim();
    if (!value) throw new AppError(`Informe ${label}.`, 400);
    return value;
}

export class DentalController {
    static async getChartByCustomer(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;
        const customerId = requireParam(req, 'customerId', 'o paciente');
        const chart = await DentalService.getChartByCustomer(companyId, customerId);
        res.status(200).json({ status: 'success', data: chart });
    }

    static async getChart(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;
        const chart = await DentalService.getChart(companyId, requireParam(req, 'id', 'o odontograma'));
        res.status(200).json({ status: 'success', data: chart });
    }

    static async createChart(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;
        const data = createChartSchema.parse(req.body || {});
        const { chart, created } = await DentalService.createChart(companyId, data);
        res.status(created ? 201 : 200).json({ status: 'success', data: chart });
    }

    static async updateChart(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;
        const data = updateChartSchema.parse(req.body || {});
        const chart = await DentalService.updateChart(companyId, requireParam(req, 'id', 'o odontograma'), data);
        res.status(200).json({ status: 'success', data: chart });
    }

    static async upsertTeeth(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;
        const data = upsertTeethSchema.parse(req.body || {});
        const teeth = await DentalService.upsertTeeth(companyId, requireParam(req, 'id', 'o odontograma'), data.teeth);
        res.status(200).json({ status: 'success', data: teeth });
    }

    static async listProcedures(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;
        const procedures = await DentalService.listProcedures(companyId, requireParam(req, 'id', 'o odontograma'));
        res.status(200).json({ status: 'success', data: procedures });
    }

    static async createProcedure(req: Request, res: Response): Promise<void> {
        const user = req.user!;
        const data = createProcedureSchema.parse(req.body || {});
        const procedure = await DentalService.createProcedure(user.company_id, String(user.id), requireParam(req, 'id', 'o odontograma'), data);
        res.status(201).json({ status: 'success', data: procedure });
    }

    static async updateProcedure(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;
        const data = updateProcedureSchema.parse(req.body || {});
        const procedure = await DentalService.updateProcedure(companyId, requireParam(req, 'id', 'o procedimento'), data);
        res.status(200).json({ status: 'success', data: procedure });
    }

    static async deleteProcedure(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;
        await DentalService.deleteProcedure(companyId, requireParam(req, 'id', 'o procedimento'));
        res.status(204).send();
    }

    static async generateQuote(req: Request, res: Response): Promise<void> {
        const companyId = req.user!.company_id;
        const data = quoteSchema.parse(req.body || {});
        const result = await DentalService.generateQuote(companyId, requireParam(req, 'id', 'o odontograma'), data);
        res.status(201).json({ status: 'success', data: result });
    }

    static async performProcedure(req: Request, res: Response): Promise<void> {
        const user = req.user!;
        const data = performSchema.parse(req.body || {});
        const result = await DentalService.performProcedure(user.company_id, String(user.id), requireParam(req, 'id', 'o procedimento'), data);
        res.status(200).json({ status: 'success', data: result });
    }
}
