import { Request, Response } from 'express';
import { z } from 'zod';
import { ReceivableTypeService } from '../services/receivableTypeService';
import { AppError } from '../errors/AppError';

const createReceivableTypeSchema = z.object({
    name: z.string().trim().min(1, 'Nome é obrigatório').max(150, 'Nome muito longo'),
    bank_account_id: z.number().int().positive('ID da conta bancária inválido')
});

const updateReceivableTypeSchema = z.object({
    name: z.string().trim().min(1, 'Nome não pode ser vazio').max(150, 'Nome muito longo').optional(),
    bank_account_id: z.number().int().positive('ID da conta bancária inválido').optional()
});

export class ReceivableTypeController {
    static async create(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const validatedData = createReceivableTypeSchema.parse(req.body);

        const result = await ReceivableTypeService.create(companyId, validatedData);

        return res.status(201).json({
            status: 'success',
            data: result
        });
    }

    static async list(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;

        const result = await ReceivableTypeService.listByCompany(companyId);

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

        const result = await ReceivableTypeService.getByPublicId(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async update(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;
        const validatedData = updateReceivableTypeSchema.parse(req.body);

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        const result = await ReceivableTypeService.update(publicId, companyId, validatedData);

        return res.status(200).json({
            status: 'success',
            message: 'Tipo de recebível atualizado com sucesso',
            data: result
        });
    }

    static async delete(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        await ReceivableTypeService.delete(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            message: 'Tipo de recebível excluído com sucesso'
        });
    }
}
