import { Request, Response } from 'express';
import { z } from 'zod';
import { ActivityGroupService } from '../services/activityGroupService';
import { AppError } from '../errors/AppError';

const createActivityGroupSchema = z.object({
    name: z.string().trim().min(1, 'Nome é obrigatório').max(150, 'Nome muito longo'),
    monthly_fee: z.number().nonnegative('Mensalidade não pode ser negativa').nullable().optional(),
    due_day: z.number().int().min(1, 'Dia de vencimento deve ser de 1 a 31').max(31, 'Dia de vencimento deve ser de 1 a 31').nullable().optional(),
    operation_cost: z.number().nonnegative('Custo da operação não pode ser negativo').nullable().optional()
});

const updateActivityGroupSchema = z.object({
    name: z.string().trim().min(1, 'Nome não pode ser vazio').max(150, 'Nome muito longo').optional(),
    monthly_fee: z.number().nonnegative('Mensalidade não pode ser negativa').nullable().optional(),
    due_day: z.number().int().min(1, 'Dia de vencimento deve ser de 1 a 31').max(31, 'Dia de vencimento deve ser de 1 a 31').nullable().optional(),
    operation_cost: z.number().nonnegative('Custo da operação não pode ser negativo').nullable().optional()
});

export class ActivityGroupController {
    static async create(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const validatedData = createActivityGroupSchema.parse(req.body);

        const result = await ActivityGroupService.create(companyId, validatedData);

        return res.status(201).json({
            status: 'success',
            data: result
        });
    }

    static async list(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;

        const result = await ActivityGroupService.listByCompany(companyId);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async getByPublicId(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        const result = await ActivityGroupService.getByPublicId(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async update(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;
        const validatedData = updateActivityGroupSchema.parse(req.body);

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        const result = await ActivityGroupService.update(publicId, companyId, validatedData);

        return res.status(200).json({
            status: 'success',
            message: 'Grupo de atividade atualizado com sucesso',
            data: result
        });
    }

    static async delete(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        await ActivityGroupService.delete(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            message: 'Grupo de atividade excluído com sucesso'
        });
    }
}
