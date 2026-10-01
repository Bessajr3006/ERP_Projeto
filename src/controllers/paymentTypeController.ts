import { Request, Response } from 'express';
import { z } from 'zod';
import { PaymentTypeService } from '../services/paymentTypeService';
import { AppError } from '../errors/AppError';

const createPaymentTypeSchema = z.object({
    name: z.string().trim().min(1, 'Nome é obrigatório').max(150, 'Nome muito longo'),
    bank_account_id: z.number().int().positive('ID da conta bancária inválido')
});

const updatePaymentTypeSchema = z.object({
    name: z.string().trim().min(1, 'Nome não pode ser vazio').max(150, 'Nome muito longo').optional(),
    bank_account_id: z.number().int().positive('ID da conta bancária inválido').optional()
});

export class PaymentTypeController {
    static async create(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const validatedData = createPaymentTypeSchema.parse(req.body);

        const result = await PaymentTypeService.create(companyId, validatedData);

        return res.status(201).json({
            status: 'success',
            data: result
        });
    }

    static async list(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;

        const result = await PaymentTypeService.listByCompany(companyId);

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

        const result = await PaymentTypeService.getByPublicId(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async update(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;
        const validatedData = updatePaymentTypeSchema.parse(req.body);

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        const result = await PaymentTypeService.update(publicId, companyId, validatedData);

        return res.status(200).json({
            status: 'success',
            message: 'Tipo de pagamento atualizado com sucesso',
            data: result
        });
    }

    static async delete(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        await PaymentTypeService.delete(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            message: 'Tipo de pagamento excluído com sucesso'
        });
    }
}
