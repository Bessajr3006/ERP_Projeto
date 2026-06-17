import { Request, Response } from 'express';
import { z } from 'zod';
import { DeclarationControlService, declarationStatusSchema } from '../services/declarationControlService';
import { StorageService } from '../utils/storageService';
import { PdfExtractionService } from '../services/pdfExtractionService';

export class DeclarationControlController {
    static async list(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const monthStr = req.query.month as string;
            const month = monthStr === 'todos' ? 0 : parseInt(monthStr);
            const year = parseInt(req.query.year as string);
            const type = req.query.type as string;

            if (isNaN(month) || isNaN(year) || !type) {
                res.status(400).json({ status: 'error', message: 'Mês, Ano e Tipo são obrigatórios.' });
                return;
            }

            const declarations = await DeclarationControlService.getDeclarations(companyId, month, year, type);
            res.status(200).json({ status: 'success', data: declarations });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Erro ao processar arquivo.' });
        }
    }

    static async deleteDeclaration(req: Request, res: Response) {
        try {
            const companyId = req.user!.company_id;
            const customerId = req.params.customerId;
            const monthStr = req.query.month as string;
            const month = monthStr === 'todos' ? 0 : parseInt(monthStr);
            const year = parseInt(req.query.year as string);
            const type = req.query.type as string;

            if (!customerId || isNaN(month) || isNaN(year) || !type) {
                res.status(400).json({ status: 'error', message: 'Parâmetros inválidos.' });
                return;
            }

            await DeclarationControlService.deleteDeclaration(companyId, customerId, month, year, type);

            res.json({ status: 'success', message: 'Declaração removida com sucesso.' });
        } catch (error: any) {
            console.error('Error deleting declaration:', error);
            res.status(500).json({ status: 'error', message: error.message || 'Erro ao remover declaração.' });
        }
    }

    static async updateStatus(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const customerId = req.params.customerId;
            const monthStr = req.query.month as string;
            const month = monthStr === 'todos' ? 0 : parseInt(monthStr);
            const year = parseInt(req.query.year as string);
            const type = req.query.type as string;

            if (!customerId || isNaN(month) || isNaN(year) || !type) {
                res.status(400).json({ status: 'error', message: 'Parâmetros inválidos.' });
                return;
            }

            const validatedData = declarationStatusSchema.parse(req.body);

            if (validatedData.receipt_base64) {
                // Parse PDF
                const extracted = await PdfExtractionService.extractFromBase64(validatedData.receipt_base64);
                
                // Merge extracted values, giving priority to existing payload if provided (though it likely won't be from the frontend initially)
                validatedData.amount_due = validatedData.amount_due ?? extracted.amount_due;
                validatedData.due_date = validatedData.due_date ?? extracted.due_date;
                validatedData.gross_revenue = validatedData.gross_revenue ?? extracted.gross_revenue;
                validatedData.accumulated_revenue = validatedData.accumulated_revenue ?? extracted.accumulated_revenue;
                validatedData.document_period = validatedData.document_period ?? extracted.document_period;
                validatedData.receipt_number = validatedData.receipt_number ?? extracted.receipt_number;

                const saved = StorageService.saveBase64('documents', validatedData.receipt_base64);
                if (saved && saved.url) {
                    validatedData.receipt_url = saved.url;
                }
            }

            await DeclarationControlService.updateDeclaration(companyId, customerId, month, year, type, validatedData);
            res.status(200).json({ status: 'success', message: 'Status atualizado com sucesso.' });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ status: 'error', message: error.errors[0]?.message, errors: error.errors });
                return;
            }
            res.status(400).json({ status: 'error', message: error.message });
        }
    }
}
