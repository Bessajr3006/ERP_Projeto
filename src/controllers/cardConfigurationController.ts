import { Request, Response } from 'express';
import { z } from 'zod';
import { CardConfigurationService } from '../services/cardConfigurationService';
import { AppError } from '../errors/AppError';

const createCardConfigurationSchema = z.object({
    receivable_type_id: z.number().int().positive('Tipo de recebível inválido'),
    card_brand_id: z.number().int().positive('Bandeira de cartão inválida').nullable().optional(),
    payment_type: z.string().trim().min(1, 'Campo receber é obrigatório'),
    tax_rate: z.number().nonnegative('Taxa inválida'),
    due_days: z.number().int().nonnegative('Dias de recebimento inválidos'),
    service_fee: z.number().nonnegative('Valor para serviço inválido')
});

const updateCardConfigurationSchema = z.object({
    receivable_type_id: z.number().int().positive('Tipo de recebível inválido').optional(),
    card_brand_id: z.number().int().positive('Bandeira de cartão inválida').nullable().optional(),
    payment_type: z.string().trim().min(1, 'Campo receber é obrigatório').optional(),
    tax_rate: z.number().nonnegative('Taxa inválida').optional(),
    due_days: z.number().int().nonnegative('Dias de recebimento inválidos').optional(),
    service_fee: z.number().nonnegative('Valor para serviço inválido').optional()
});

export class CardConfigurationController {
    static async create(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const validatedData = createCardConfigurationSchema.parse(req.body);

        const result = await CardConfigurationService.create(companyId, {
            ...validatedData,
            card_brand_id: validatedData.card_brand_id ?? null
        });

        return res.status(201).json({
            status: 'success',
            data: result
        });
    }

    static async list(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;

        const result = await CardConfigurationService.listByCompany(companyId);

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

        const result = await CardConfigurationService.getByPublicId(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async update(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;
        const validatedData = updateCardConfigurationSchema.parse(req.body);

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        const result = await CardConfigurationService.update(publicId, companyId, validatedData);

        return res.status(200).json({
            status: 'success',
            message: 'Configuração de cartão atualizada com sucesso',
            data: result
        });
    }

    static async delete(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        await CardConfigurationService.delete(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            message: 'Configuração de cartão excluída com sucesso'
        });
    }
}
