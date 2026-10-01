import { Request, Response } from 'express';
import { z } from 'zod';
import { CardExpenseService } from '../services/cardExpenseService';
import { CardExpensePdfParser } from '../services/cardExpensePdfParser';
import { AppError } from '../errors/AppError';

const createCardExpenseSchema = z.object({
    date: z.string().min(1, 'Data é obrigatória'),
    description: z.string().trim().min(1, 'Descrição é obrigatória').max(255, 'Descrição muito longa'),
    period: z.string().trim().min(7, 'Período inválido (ex: 2026-07)').max(7, 'Período inválido'),
    value: z.number().positive('O valor deve ser maior que zero'),
    tempo: z.string().trim().max(20).nullable().optional(),
    category_public_id: z.string().trim().nullable().optional(),
    card_debit_public_id: z.string().trim().min(1, 'Pagamento de cartão (Fatura) é obrigatório'),
    observation: z.string().trim().nullable().optional()
});

const updateCardExpenseSchema = z.object({
    date: z.string().min(1, 'Data é obrigatória').optional(),
    description: z.string().trim().min(1, 'Descrição é obrigatória').max(255, 'Descrição muito longa').optional(),
    period: z.string().trim().min(7, 'Período inválido').max(7, 'Período inválido').optional(),
    value: z.number().positive('O valor deve ser maior que zero').optional(),
    tempo: z.string().trim().max(20).nullable().optional(),
    category_public_id: z.string().trim().nullable().optional(),
    card_debit_public_id: z.string().trim().min(1, 'Pagamento de cartão (Fatura) é obrigatório'),
    observation: z.string().trim().nullable().optional()
});

const parsePdfSchema = z.object({
    pdf_base64: z.string().min(1, 'PDF base64 é obrigatório')
});

const bulkCreateCardExpenseSchema = z.object({
    transactions: z.array(createCardExpenseSchema).min(1, 'Lista de transações não pode estar vazia')
});

export class CardExpenseController {
    static async create(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const validatedData = createCardExpenseSchema.parse(req.body);

        const result = await CardExpenseService.create(companyId, validatedData);

        return res.status(201).json({
            status: 'success',
            data: result
        });
    }

    static async list(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;

        const result = await CardExpenseService.listByCompany(companyId);

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

        const result = await CardExpenseService.getByPublicId(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async update(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;
        const validatedData = updateCardExpenseSchema.parse(req.body);

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        const result = await CardExpenseService.update(publicId, companyId, validatedData);

        return res.status(200).json({
            status: 'success',
            message: 'Despesa de cartão atualizada com sucesso',
            data: result
        });
    }

    static async delete(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        await CardExpenseService.delete(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            message: 'Despesa de cartão excluída com sucesso'
        });
    }

    static async parsePdf(req: Request, res: Response): Promise<any> {
        const { pdf_base64 } = parsePdfSchema.parse(req.body);

        const result = await CardExpensePdfParser.parsePdf(pdf_base64);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async createBulk(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const { transactions } = bulkCreateCardExpenseSchema.parse(req.body);

        await CardExpenseService.createBulk(companyId, transactions);

        return res.status(201).json({
            status: 'success',
            message: `${transactions.length} despesas de cartão importadas com sucesso.`
        });
    }

    static async bulkDelete(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const { publicIds } = req.body;

        if (!Array.isArray(publicIds) || publicIds.length === 0) {
            throw new AppError('Public IDs array is required', 400);
        }

        const { deletedCount } = await CardExpenseService.bulkDelete(publicIds, companyId);

        return res.status(200).json({
            status: 'success',
            message: `${deletedCount} despesa(s) de cartão excluída(s) com sucesso`
        });
    }
}
