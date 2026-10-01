import { Request, Response } from 'express';
import { z } from 'zod';
import { AccountingClosingService } from '../services/accountingClosingService';

export class AccountingClosingController {

    static async getClosingOverview(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const yearParam = req.query.year ? Number(req.query.year) : new Date().getFullYear();
            const customerIdParam = req.query.customerId ? Number(req.query.customerId) : undefined;

            if (isNaN(yearParam) || yearParam < 1900 || yearParam > 2100) {
                res.status(400).json({ status: 'error', message: 'Ano inválido informado' });
                return;
            }

            const data = await AccountingClosingService.getClosingOverview(companyId, yearParam, customerIdParam);
            res.status(200).json({ status: 'success', data });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Erro ao carregar visão geral de fechamento' });
        }
    }

    static async togglePeriodStatus(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const userId = req.user?.id ? Number(req.user.id) : undefined;

            const schema = z.object({
                periodType: z.enum(['monthly', 'quarterly', 'semiannual', 'annual']),
                year: z.number().int().min(1900).max(2100),
                periodNumber: z.number().int().min(1).max(12),
                accountingStatus: z.enum(['open', 'in_progress', 'closed', 'audited']).optional(),
                taxStatus: z.enum(['open', 'calculated', 'closed', 'paid']).optional(),
                notes: z.string().optional()
            });

            const validated = schema.parse(req.body);
            const result = await AccountingClosingService.togglePeriodStatus(companyId, validated, userId);

            res.status(200).json({ 
                status: 'success', 
                data: result,
                message: 'Status do período atualizado com sucesso.' 
            });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ status: 'error', message: error.errors[0]?.message, errors: error.errors });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Erro ao alterar status do fechamento' });
        }
    }
}
