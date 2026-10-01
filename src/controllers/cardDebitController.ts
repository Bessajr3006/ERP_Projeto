import { Request, Response } from 'express';
import { z } from 'zod';
import { CardDebitService } from '../services/cardDebitService';
import { AppError } from '../errors/AppError';

const createCardDebitSchema = z.object({
    date: z.string().min(1, 'Data é obrigatória'),
    description: z.string().trim().min(1, 'Descrição é obrigatória').max(255, 'Descrição muito longa'),
    period: z.string().trim().min(7, 'Período inválido (ex: 2026-07)').max(7, 'Período inválido'),
    value: z.number().positive('O valor deve ser maior que zero'),
    card_name: z.string().trim().max(100).nullable().optional(),
    card_number: z.string().trim().max(50).nullable().optional(),
    due_date: z.string().nullable().optional(),
    card_expense_public_id: z.string().trim().nullable().optional(),
    tempo: z.string().trim().max(20).nullable().optional(),
    category_public_id: z.string().trim().nullable().optional(),
    observation: z.string().trim().nullable().optional()
});

const updateCardDebitSchema = z.object({
    date: z.string().min(1, 'Data é obrigatória').optional(),
    description: z.string().trim().min(1, 'Descrição é obrigatória').max(255, 'Descrição muito longa').optional(),
    period: z.string().trim().min(7, 'Período inválido').max(7, 'Período inválido').optional(),
    value: z.number().positive('O valor deve ser maior que zero').optional(),
    card_name: z.string().trim().max(100).nullable().optional(),
    card_number: z.string().trim().max(50).nullable().optional(),
    due_date: z.string().nullable().optional(),
    card_expense_public_id: z.string().trim().nullable().optional(),
    tempo: z.string().trim().max(20).nullable().optional(),
    category_public_id: z.string().trim().nullable().optional(),
    observation: z.string().trim().nullable().optional()
});

export class CardDebitController {
    static async create(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const validatedData = createCardDebitSchema.parse(req.body);

        const result = await CardDebitService.create(companyId, validatedData);

        return res.status(201).json({
            status: 'success',
            data: result
        });
    }

    static async list(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;

        const result = await CardDebitService.listByCompany(companyId);

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

        const result = await CardDebitService.getByPublicId(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async update(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;
        const validatedData = updateCardDebitSchema.parse(req.body);

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        const result = await CardDebitService.update(publicId, companyId, validatedData);

        return res.status(200).json({
            status: 'success',
            message: 'Débito de cartão atualizado com sucesso',
            data: result
        });
    }

    static async delete(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        await CardDebitService.delete(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            message: 'Débito de cartão excluído com sucesso'
        });
    }
}
