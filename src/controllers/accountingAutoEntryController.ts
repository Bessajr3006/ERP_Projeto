import { Request, Response } from 'express';
import { z } from 'zod';
import { AccountingAutoEntryService, accountingAutoTemplateSchema } from '../services/accountingAutoEntryService';

export class AccountingAutoEntryController {
    static async createTemplate(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const validatedData = accountingAutoTemplateSchema.parse(req.body);

            const result = await AccountingAutoEntryService.createTemplate(companyId, validatedData);
            res.status(201).json({ status: 'success', data: result, message: 'Template criado com sucesso.' });
        } catch (error: any) {
            if (error instanceof z.ZodError) { res.status(400).json({ status: 'error', message: error.errors[0]?.message, errors: error.errors }); return; }
            if (error instanceof Error) { res.status(400).json({ status: 'error', message: error.message }); return; }
            throw error;
        }
    }

    static async listTemplates(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const search = req.query.search as string;
            const templates = await AccountingAutoEntryService.getTemplates(companyId, search);
            res.status(200).json({ status: 'success', data: templates });
        } catch (error) { throw error; }
    }

    static async getTemplate(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const publicId = req.params.id as string;
            if (!publicId) {
                res.status(400).json({ status: 'error', message: 'ID é obrigatório' });
                return;
            }

            const template = await AccountingAutoEntryService.getTemplateWithItems(publicId, companyId);
            res.status(200).json({ status: 'success', data: template });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async updateTemplate(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const publicId = req.params.id as string;
            if (!publicId) {
                res.status(400).json({ status: 'error', message: 'ID é obrigatório' });
                return;
            }

            const validatedData = accountingAutoTemplateSchema.parse(req.body);
            const updated = await AccountingAutoEntryService.updateTemplate(publicId, companyId, validatedData);

            res.status(200).json({ status: 'success', data: updated, message: 'Template atualizado.' });
        } catch (error: any) {
            if (error instanceof z.ZodError) { res.status(400).json({ status: 'error', message: error.errors[0]?.message, errors: error.errors }); return; }
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async deleteTemplate(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const publicId = req.params.id as string;
            if (!publicId) {
                res.status(400).json({ status: 'error', message: 'ID é obrigatório' });
                return;
            }

            const deleted = await AccountingAutoEntryService.deleteTemplate(publicId, companyId);
            if (!deleted) {
                res.status(404).json({ status: 'error', message: 'Template não encontrado' });
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
