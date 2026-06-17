import { Request, Response } from 'express';
import { z } from 'zod';
import { AccountingEntryService, accountingEntrySchema } from '../services/accountingEntryService';

export class AccountingEntryController {
    static async createEntry(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const validatedData = accountingEntrySchema.parse(req.body);

            const entry = await AccountingEntryService.createEntry(companyId, validatedData);
            res.status(201).json({ status: 'success', data: entry, message: 'Lançamento efetuado com sucesso.' });
        } catch (error: any) {
            if (error instanceof z.ZodError) { res.status(400).json({ status: 'error', message: error.errors[0]?.message, errors: error.errors }); return; }
            if (error instanceof Error) { res.status(400).json({ status: 'error', message: error.message }); return; }
            throw error;
        }
    }

    static async listEntries(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const filters = {
                search: req.query.search as string,
                status: req.query.status as string,
                startDate: req.query.startDate as string,
                endDate: req.query.endDate as string
            };
            const entries = await AccountingEntryService.getAllEntries(companyId, filters);
            res.status(200).json({ status: 'success', data: entries });
        } catch (error) { throw error; }
    }

    static async updateEntry(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const publicId = req.params.id as string;
            if (!publicId) {
                res.status(400).json({ status: 'error', message: 'ID principal é obrigatório' });
                return;
            }

            const validatedData = accountingEntrySchema.parse(req.body);
            const updatedEntry = await AccountingEntryService.updateEntry(publicId, companyId, validatedData);

            res.status(200).json({ status: 'success', data: updatedEntry, message: 'Lançamento atualizado.' });
        } catch (error: any) {
            if (error instanceof z.ZodError) { res.status(400).json({ status: 'error', message: error.errors[0]?.message, errors: error.errors }); return; }
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async deleteEntry(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const publicId = req.params.id as string;
            if (!publicId) {
                res.status(400).json({ status: 'error', message: 'ID é obrigatório' });
                return;
            }

            const deleted = await AccountingEntryService.deleteEntry(publicId, companyId);
            if (!deleted) {
                res.status(404).json({ status: 'error', message: 'Lançamento não encontrado' });
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

    static async batchImportEntries(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const entries = req.body.entries;
            const matchBy = req.body.matchBy === 'easy_code' ? 'easy_code' : 'code';

            if (!Array.isArray(entries) || entries.length === 0) {
                res.status(400).json({ status: 'error', message: 'Nenhum lançamento fornecido para importação' });
                return;
            }

            const result = await AccountingEntryService.batchImportEntries(companyId, entries, matchBy);
            
            res.status(200).json({ 
                status: 'success', 
                data: result,
                message: `Importação concluída. ${result.success} sucessos, ${result.errors.length} falhas.` 
            });
        } catch (error) {
            throw error;
        }
    }

    static async applyAutoTemplate(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const schema = z.object({
                code: z.string().min(1, 'Código é obrigatório'),
                amount: z.number().positive('O valor deve ser positivo'),
                entry_date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Data inválida" }),
                document_ref: z.string().max(100).optional(),
                history_complement: z.string().max(500).optional()
            });

            const data = schema.parse(req.body);
            
            const serviceData = {
                amount: data.amount,
                entry_date: data.entry_date,
            } as any;
            if (data.document_ref) serviceData.document_ref = data.document_ref;
            if (data.history_complement) serviceData.history_complement = data.history_complement;

            const result = await AccountingEntryService.applyAutoTemplate(companyId, data.code, serviceData);
            
            res.status(200).json({ 
                status: 'success', 
                data: result,
                message: `Lançamentos automáticos gerados com sucesso (${result.count} linhas).` 
            });
        } catch (error: any) {
            if (error instanceof z.ZodError) { res.status(400).json({ status: 'error', message: error.errors[0]?.message, errors: error.errors }); return; }
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }
}
