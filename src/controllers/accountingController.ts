import { Request, Response } from 'express';
import { z } from 'zod';
import { AccountingService } from '../services/accountingService';

const accountSchema = z.object({
    code: z.string().min(1, 'Código é obrigatório'),
    easy_code: z.string().max(50, 'Código fácil muito longo').optional().nullable(),
    name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
    type: z.enum(['synthetic', 'analytic']),
    nature: z.enum(['debit', 'credit']),
    status: z.enum(['active', 'inactive']).optional()
});

export class AccountingController {
    static async createAccount(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const validatedData = accountSchema.parse(req.body);

            const account = await AccountingService.createAccount(companyId, validatedData);
            res.status(201).json({ status: 'success', data: account, message: 'Conta criada com sucesso.' });
        } catch (error: any) {
            if (error instanceof z.ZodError) { res.status(400).json({ status: 'error', message: error.errors[0]?.message, errors: error.errors }); return; }
            if (error instanceof Error && error.message.includes('já existe')) { res.status(400).json({ status: 'error', message: error.message }); return; }
            throw error;
        }
    }

    static async listAccounts(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const accounts = await AccountingService.listAccounts(companyId);
            res.status(200).json({ status: 'success', data: accounts });
        } catch (error) { throw error; }
    }

    static async updateAccount(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const publicId = req.params.id as string;
            if (!publicId) {
                res.status(400).json({ status: 'error', message: 'ID da conta é obrigatório' });
                return;
            }

            const validatedData = accountSchema.parse(req.body);
            const updatedAccount = await AccountingService.updateAccount(publicId, companyId, validatedData);

            res.status(200).json({ status: 'success', data: updatedAccount, message: 'Conta atualizada com sucesso.' });
        } catch (error: any) {
            if (error instanceof z.ZodError) { res.status(400).json({ status: 'error', message: error.errors[0]?.message, errors: error.errors }); return; }
            if (error instanceof Error && (error.message.includes('já existe') || error.message === 'Account not found')) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async deleteAccount(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const publicId = req.params.id as string;
            if (!publicId) {
                res.status(400).json({ status: 'error', message: 'ID da conta é obrigatório' });
                return;
            }

            await AccountingService.deleteAccount(publicId, companyId);
            res.status(204).send();
        } catch (error: any) {
            if (error instanceof Error && error.message === 'Account not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async batchDeleteAccounts(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const publicIds = req.body.ids;
            
            if (!Array.isArray(publicIds) || publicIds.length === 0) {
                res.status(400).json({ status: 'error', message: 'Lista de IDs inválida' });
                return;
            }

            await AccountingService.batchDeleteAccounts(publicIds, companyId);
            res.status(200).json({ status: 'success', message: `${publicIds.length} contas excluídas com sucesso.` });
        } catch (error) {
            throw error;
        }
    }

    static async batchImportAccounts(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const accounts = req.body.accounts;

            if (!Array.isArray(accounts) || accounts.length === 0) {
                res.status(400).json({ status: 'error', message: 'Nenhuma conta fornecida para importação' });
                return;
            }

            // Perform batch upsert
            const result = await AccountingService.batchUpsertAccounts(companyId, accounts);
            
            res.status(200).json({ 
                status: 'success', 
                data: result,
                message: `Importação concluída. ${result.success} sucessos, ${result.errors.length} falhas.` 
            });
        } catch (error) {
            throw error;
        }
    }
}
