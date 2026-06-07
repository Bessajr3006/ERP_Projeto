import { Request, Response } from 'express';
import { z } from 'zod';
import { FinanceService } from '../services/financeService';
import logger from '../config/logger';

const createCategorySchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    type: z.enum(['income', 'expense'])
});

const createExpenseSchema = z.object({
    description: z.string().min(2, 'Description must be at least 2 characters'),
    amount: z.number().positive('Amount must be positive'),
    date: z.string(), // YYYY-MM-DD
    category_public_id: z.string().uuid('Invalid category ID'),
    bank_account_public_id: z.string().uuid('Invalid bank account ID'),
    payment_method: z.enum(['pix', 'credit', 'debit', 'cash', 'transfer', 'boleto']).optional(),
    status: z.enum(['pending', 'progress', 'paid']).optional(),
});

const createRevenueSchema = z.object({
    description: z.string().min(2, 'Description must be at least 2 characters'),
    amount: z.number().positive('Amount must be positive'),
    date: z.string(), // YYYY-MM-DD
    received_at: z.string().optional(),
    category_public_id: z.string().uuid('Invalid category ID'),
    bank_account_public_id: z.string().uuid('Invalid bank account ID'),
    customer_public_id: z.string().uuid('Invalid customer ID').optional(),
    payment_method: z.enum(['pix', 'credit', 'debit', 'cash', 'transfer', 'boleto']).optional(),
    status: z.enum(['pending', 'progress', 'paid']).optional(),
});

export class FinanceController {

    static async createCategory(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const validatedData = createCategorySchema.parse(req.body);

            const category = await FinanceService.createCategory(companyId, validatedData);

            res.status(201).json({ status: 'success', data: category });
        } catch (error: any) {
            if (error instanceof z.ZodError) { res.status(400).json({ status: 'error', errors: error.errors }); return; }
            throw error;
        }
    }

    static async listCategories(req: Request, res: Response): Promise<void> {
        try {
            const categories = await FinanceService.listCategories(req.user!.company_id);
            res.status(200).json({ status: 'success', data: categories });
        } catch (error) { throw error; }
    }

    static async updateCategory(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;

            if (!id) {
                res.status(400).json({ status: 'error', message: 'Category ID is required' });
                return;
            }

            const validatedData = createCategorySchema.parse(req.body);
            const updatedCategory = await FinanceService.updateCategory(id, companyId, validatedData);

            res.status(200).json({ status: 'success', data: updatedCategory });
        } catch (error: any) {
            if (error instanceof z.ZodError) { res.status(400).json({ status: 'error', errors: error.errors }); return; }
            if (error instanceof Error && error.message === 'Category not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async deleteCategory(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;

            if (!id) {
                res.status(400).json({ status: 'error', message: 'Category ID is required' });
                return;
            }

            await FinanceService.deleteCategory(id, companyId);
            res.status(204).send();
        } catch (error: any) {
            if (error instanceof Error && error.message === 'Category not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            if (error instanceof Error && error.message.includes('foreign key constraint')) {
                res.status(400).json({ status: 'error', message: 'Cannot delete category because it is being used by transactions' });
                return;
            }
            throw error;
        }
    }

    static async createExpense(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const userId = req.user!.id;
            const validatedData = createExpenseSchema.parse(req.body);

            await FinanceService.createExpense(companyId, userId, validatedData);

            res.status(201).json({ status: 'success', message: 'Expense recorded successfully' });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                logger.warn({ zodErrors: error.errors }, '[financeController] ZodError');
                res.status(400).json({ status: 'error', message: error.errors[0]?.message || 'Erro de validação', errors: error.errors });
                return;
            }
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async listExpenses(req: Request, res: Response): Promise<void> {
        try {
            const expenses = await FinanceService.listExpenses(req.user!.company_id);
            res.status(200).json({ status: 'success', data: expenses });
        } catch (error) {
            throw error;
        }
    }

    static async updateExpense(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const transactionPublicId = req.params.id as string;
            const validatedData = createExpenseSchema.parse(req.body);

            await FinanceService.updateExpense(companyId, transactionPublicId, validatedData);

            res.status(200).json({ status: 'success', message: 'Expense updated successfully' });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                logger.warn({ zodErrors: error.errors }, '[financeController] ZodError (Expense Update)');
                res.status(400).json({ status: 'error', message: error.errors[0]?.message || 'Erro de validação', errors: error.errors });
                return;
            }
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async createRevenue(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const userId = req.user!.id;
            const validatedData = createRevenueSchema.parse(req.body);

            await FinanceService.createRevenue(companyId, userId, validatedData);

            res.status(201).json({ status: 'success', message: 'Revenue recorded successfully' });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                logger.warn({ zodErrors: error.errors }, '[financeController] ZodError (Revenue)');
                res.status(400).json({ status: 'error', message: error.errors[0]?.message || 'Erro de validação', errors: error.errors });
                return;
            }
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async listRevenues(req: Request, res: Response): Promise<void> {
        try {
            const revenues = await FinanceService.listRevenues(req.user!.company_id);
            res.status(200).json({ status: 'success', data: revenues });
        } catch (error) {
            throw error;
        }
    }

    static async updateRevenue(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const transactionPublicId = req.params.id as string;
            const validatedData = createRevenueSchema.parse(req.body);

            await FinanceService.updateRevenue(companyId, transactionPublicId, validatedData);

            res.status(200).json({ status: 'success', message: 'Revenue updated successfully' });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                logger.warn({ zodErrors: error.errors }, '[financeController] ZodError (Revenue Update)');
                res.status(400).json({ status: 'error', message: error.errors[0]?.message || 'Erro de validação', errors: error.errors });
                return;
            }
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async deleteTransaction(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;

            if (!id) {
                res.status(400).json({ status: 'error', message: 'Transaction ID is required' });
                return;
            }

            await FinanceService.deleteTransaction(id, companyId);
            // 204 No Content is standard for DELETE
            res.status(204).send();
        } catch (error: any) {
            if (error instanceof Error && error.message === 'Transaction not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            if (error instanceof Error && error.message === 'Não é permitido excluir a receita, existe lançamento de serviço amarrado.') {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async getReceipt(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const transactionPublicId = req.params.id as string;

            if (!transactionPublicId) {
                res.status(400).json({ status: 'error', message: 'Transaction ID is required' });
                return;
            }

            const receiptHtml = await FinanceService.generateReceiptHTML(companyId, transactionPublicId);
            res.setHeader('Content-Type', 'text/html');
            res.status(200).send(receiptHtml);
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).send(`Erro ao gerar recibo: ${error.message}`);
                return;
            }
            res.status(500).send('Erro interno ao gerar recibo.');
        }
    }

    static async generateBillet(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const transactionPublicId = req.params.id as string;

            if (!transactionPublicId) {
                res.status(400).json({ status: 'error', message: 'Transaction ID is required' });
                return;
            }

            const billetData = await FinanceService.generateBillet(companyId, transactionPublicId);
            res.status(200).json({ status: 'success', message: 'Boleto gerado com sucesso', data: billetData });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async getBoletoPdf(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const transactionPublicId = req.params.id as string;
            const nossoNumero = req.query.nossoNumero as string;

            if (!transactionPublicId || !nossoNumero) {
                res.status(400).json({ status: 'error', message: 'Transaction ID and nossoNumero are required' });
                return;
            }

            const pdfBase64 = await FinanceService.getBoletoPdfBase64(companyId, transactionPublicId, nossoNumero);
            const pdfBuffer = Buffer.from(pdfBase64, 'base64');

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="Boleto_${nossoNumero}.pdf"`);
            res.send(pdfBuffer);
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async batchGenerateBillets(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const { ids } = req.body;

            if (!ids || !Array.isArray(ids)) {
                res.status(400).json({ status: 'error', message: 'Invalid IDs array' });
                return;
            }

            await FinanceService.batchGenerateBillets(companyId, ids);
            res.status(200).json({ status: 'success', message: 'Boletos gerados com sucesso' });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async batchCancelBillets(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const { ids } = req.body;

            if (!ids || !Array.isArray(ids)) {
                res.status(400).json({ status: 'error', message: 'Invalid IDs array' });
                return;
            }

            await FinanceService.batchCancelBillets(companyId, ids);
            res.status(200).json({ status: 'success', message: 'Boletos cancelados com sucesso' });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async getDashboardAnalytics(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const bankAccountPublicIdRaw = req.query.bankAccountPublicId;
            const bankAccountPublicId = typeof bankAccountPublicIdRaw === 'string' && bankAccountPublicIdRaw.trim()
                ? bankAccountPublicIdRaw.trim()
                : undefined;
            const analytics = await FinanceService.getDashboardAnalytics(companyId, bankAccountPublicId);
            res.status(200).json({ status: 'success', data: analytics });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async batchDeleteBankStatements(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const { ids, email, password } = req.body;
            if (!ids || !Array.isArray(ids) || !email || !password) {
                res.status(400).json({ status: 'error', message: 'Dados inválidos. Requer ids, email e login de admin.' });
                return;
            }
            await FinanceService.batchDeleteBankStatements(companyId, ids, email, password);
            res.status(200).json({ status: 'success', message: 'Lançamentos do extrato removidos com sucesso. ' });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async syncBankStatements(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const { bankAccountPublicId, startDate, endDate } = req.body;

            if (!bankAccountPublicId) {
                res.status(400).json({ status: 'error', message: 'bankAccountPublicId é obrigatório' });
                return;
            }

            const totalSynced = await FinanceService.syncBankStatements(companyId, bankAccountPublicId, startDate, endDate);
            res.status(200).json({ status: 'success', message: `${totalSynced} lançamentos sincronizados com sucesso.` });
        } catch (error: any) {
            console.error('[FinanceController] Erro no syncBankStatements:', error);
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Erro interno ao sincronizar extrato bancário.' });
        }
    }

    static async syncBankStatementsOfx(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const { bankAccountPublicId, ofxContent } = req.body;

            if (!bankAccountPublicId || !ofxContent) {
                res.status(400).json({ status: 'error', message: 'bankAccountPublicId e ofxContent são obrigatórios' });
                return;
            }

            const totalImported = await FinanceService.syncBankStatementsOfx(companyId, bankAccountPublicId, ofxContent);
            res.status(200).json({ status: 'success', message: `${totalImported} lançamentos importados do OFX com sucesso.` });
        } catch (error: any) {
            console.error('[FinanceController] Erro no syncBankStatementsOfx:', error);
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Erro interno ao importar OFX.' });
        }
    }

    static async listBankStatements(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const bankAccountPublicId = req.query.bankAccountPublicId as string;
            
            const result = await FinanceService.listBankStatements(companyId, bankAccountPublicId);
            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async reconcile(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const { system_ids, bank_statement_ids } = req.body;

            if (!Array.isArray(system_ids) || !Array.isArray(bank_statement_ids)) {
                res.status(400).json({ status: 'error', message: 'Os arrays system_ids e bank_statement_ids são obrigatórios.' });
                return;
            }

            await FinanceService.reconcile(companyId, system_ids, bank_statement_ids);
            
            res.status(200).json({ status: 'success', message: 'Conciliação realizada com sucesso.' });
        } catch (error: any) {
            console.error('[FinanceController] Erro na conciliação:', error);
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Erro interno ao conciliar lançamentos.' });
        }
    }

    static async undoReconcile(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const { bank_statement_id } = req.body;

            if (!bank_statement_id) {
                res.status(400).json({ status: 'error', message: 'bank_statement_id é obrigatório.' });
                return;
            }

            await FinanceService.undoReconcile(companyId, bank_statement_id);
            res.status(200).json({ status: 'success', message: 'Conciliação desfeita com sucesso.' });
        } catch (error: any) {
            console.error('[FinanceController] Erro ao desconciliar:', error);
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Erro interno ao desconciliar lançamentos.' });
        }
    }

    static async getRecentPaid(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const rows = await FinanceService.listRecentPaidRevenues(companyId);
            res.status(200).json({ status: 'success', data: rows });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    }
}
