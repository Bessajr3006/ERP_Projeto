import { Request, Response } from 'express';
import { z } from 'zod';
import { CardBrandService } from '../services/cardBrandService';
import { AppError } from '../errors/AppError';

const createCardBrandSchema = z.object({
    name: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo')
});

const updateCardBrandSchema = z.object({
    name: z.string().trim().min(1, 'Nome não pode ser vazio').max(100, 'Nome muito longo').optional()
});

export class CardBrandController {
    static async create(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const validatedData = createCardBrandSchema.parse(req.body);

        const result = await CardBrandService.create(companyId, validatedData);

        return res.status(201).json({
            status: 'success',
            data: result
        });
    }

    static async list(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;

        const result = await CardBrandService.listByCompany(companyId);

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

        const result = await CardBrandService.getByPublicId(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async update(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;
        const validatedData = updateCardBrandSchema.parse(req.body);

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        const result = await CardBrandService.update(publicId, companyId, validatedData);

        return res.status(200).json({
            status: 'success',
            message: 'Bandeira de cartão atualizada com sucesso',
            data: result
        });
    }

    static async delete(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        await CardBrandService.delete(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            message: 'Bandeira de cartão excluída com sucesso'
        });
    }
}
