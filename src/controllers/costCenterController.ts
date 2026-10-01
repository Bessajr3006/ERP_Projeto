import { Request, Response } from 'express';
import { z } from 'zod';
import { CostCenterService } from '../services/costCenterService';
import { AppError } from '../errors/AppError';

const createCostCenterSchema = z.object({
    name: z.string().trim().min(1, 'Nome é obrigatório').max(150, 'Nome muito longo'),
    description: z.string().trim().max(500, 'Descrição muito longa').optional().nullable(),
    is_active: z.union([z.boolean(), z.number()]).optional()
});

const updateCostCenterSchema = z.object({
    name: z.string().trim().min(1, 'Nome não pode ser vazio').max(150, 'Nome muito longo').optional(),
    description: z.string().trim().max(500, 'Descrição muito longa').optional().nullable(),
    is_active: z.union([z.boolean(), z.number()]).optional()
});

export class CostCenterController {
    static async create(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const validatedData = createCostCenterSchema.parse(req.body);

        const result = await CostCenterService.create(companyId, {
            ...validatedData,
            is_active: typeof validatedData.is_active === 'number' ? validatedData.is_active === 1 : validatedData.is_active
        });

        return res.status(201).json({
            status: 'success',
            data: result
        });
    }

    static async list(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const result = await CostCenterService.listByCompany(companyId);

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

        const result = await CostCenterService.getByPublicId(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async update(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;
        const validatedData = updateCostCenterSchema.parse(req.body);

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        const result = await CostCenterService.update(publicId, companyId, {
            ...validatedData,
            is_active: typeof validatedData.is_active === 'number' ? validatedData.is_active === 1 : validatedData.is_active
        });

        return res.status(200).json({
            status: 'success',
            message: 'Centro de custo atualizado com sucesso',
            data: result
        });
    }

    static async delete(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        await CostCenterService.delete(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            message: 'Centro de custo excluído com sucesso'
        });
    }
}
