import { Request, Response } from 'express';
import { z } from 'zod';
import { AccountingHistoryService, accountingHistorySchema } from '../services/accountingHistoryService';

export class AccountingHistoryController {
    static async create(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const validatedData = accountingHistorySchema.parse(req.body);

            const result = await AccountingHistoryService.create(companyId, validatedData);
            res.status(201).json({ status: 'success', data: result, message: 'Histórico criado com sucesso.' });
        } catch (error: any) {
            if (error instanceof z.ZodError) { res.status(400).json({ status: 'error', message: error.errors[0]?.message, errors: error.errors }); return; }
            if (error instanceof Error) { res.status(400).json({ status: 'error', message: error.message }); return; }
            throw error;
        }
    }

    static async list(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const search = req.query.search as string;
            const histories = await AccountingHistoryService.getHistories(companyId, search);
            res.status(200).json({ status: 'success', data: histories });
        } catch (error) { throw error; }
    }

    static async get(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const publicId = req.params.id as string;
            if (!publicId) {
                res.status(400).json({ status: 'error', message: 'ID é obrigatório' });
                return;
            }

            const history = await AccountingHistoryService.getHistory(publicId, companyId);
            res.status(200).json({ status: 'success', data: history });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async update(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const publicId = req.params.id as string;
            if (!publicId) {
                res.status(400).json({ status: 'error', message: 'ID é obrigatório' });
                return;
            }

            const validatedData = accountingHistorySchema.parse(req.body);
            const updated = await AccountingHistoryService.update(publicId, companyId, validatedData);

            res.status(200).json({ status: 'success', data: updated, message: 'Histórico atualizado.' });
        } catch (error: any) {
            if (error instanceof z.ZodError) { res.status(400).json({ status: 'error', message: error.errors[0]?.message, errors: error.errors }); return; }
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async delete(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const publicId = req.params.id as string;
            if (!publicId) {
                res.status(400).json({ status: 'error', message: 'ID é obrigatório' });
                return;
            }

            const deleted = await AccountingHistoryService.delete(publicId, companyId);
            if (!deleted) {
                res.status(404).json({ status: 'error', message: 'Histórico não encontrado' });
                return;
            }
            res.status(204).send();
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }
}
