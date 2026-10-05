import { Request, Response } from 'express';
import { z } from 'zod';
import { FinanceService } from '../services/financeService';
import { WhatsAppBusinessService } from '../services/whatsappBusinessService';
import { ExternalDbService } from '../services/externalDbService';
import pool from '../config/db';
import logger from '../config/logger';
import { decrypt } from '../utils/crypto';

const createCategorySchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    type: z.enum(['income', 'expense']),
    finance_category_type_public_id: z.string().uuid().optional().nullable()
});

const createCategoryTypeSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    description: z.string().optional().nullable()
});

const createExpenseSchema = z.object({
    description: z.string().min(2, 'Description must be at least 2 characters'),
    amount: z.number().positive('Amount must be positive'),
    original_amount: z.number().optional().nullable(),
    fine: z.number().optional().nullable(),
    interest: z.number().optional().nullable(),
    date: z.string(), // YYYY-MM-DD
    received_at: z.string().optional().nullable(),
    category_public_id: z.string().uuid('Invalid category ID'),
    bank_account_public_id: z.string().uuid('Invalid bank account ID'),
    payment_method: z.string().max(50).optional().nullable(),
    status: z.enum(['pending', 'progress', 'paid', 'scheduled']).optional(),
    scheduled_at: z.string().optional().nullable(),
    entity_type: z.string().optional().nullable(),
    entity_public_id: z.string().uuid('Invalid entity ID').optional().nullable(),
    cost_center_public_id: z.string().uuid('Invalid cost center ID').optional().nullable(),
    barcode: z.string().optional().nullable(),
    pix_code: z.string().optional().nullable(),
    pix_key: z.string().optional().nullable(),
    pdv: z.string().optional().nullable(),
    cdfilial: z.string().optional().nullable(),
    solidcon_quitado: z.union([z.number(), z.boolean()]).optional().nullable().transform(val => typeof val === 'boolean' ? (val ? 1 : 0) : val),
    solidcon_key: z.string().optional().nullable(),
    solidcon_interest_key: z.string().optional().nullable(),
});

const createRevenueSchema = z.object({
    description: z.string().min(2, 'Description must be at least 2 characters'),
    amount: z.number().positive('Amount must be positive'),
    original_amount: z.number().optional().nullable(),
    fine: z.number().optional().nullable(),
    interest: z.number().optional().nullable(),
    date: z.string(), // YYYY-MM-DD
    received_at: z.string().optional(),
    received_channel: z.string().max(30).optional().nullable(),
    category_public_id: z.string().uuid('Invalid category ID'),
    bank_account_public_id: z.string().uuid('Invalid bank account ID'),
    customer_public_id: z.string().uuid('Invalid customer ID').optional(),
    payment_method: z.string().max(50).optional().nullable(),
    card_brand_public_id: z.string().uuid('Invalid card brand ID').optional().nullable(),
    status: z.enum(['pending', 'progress', 'paid', 'scheduled']).optional(),
    scheduled_at: z.string().optional().nullable(),
    entity_type: z.string().optional().nullable(),
    entity_public_id: z.string().uuid('Invalid entity ID').optional().nullable(),
    cost_center_public_id: z.string().uuid('Invalid cost center ID').optional().nullable(),
    date_launch: z.string().optional().nullable(),
    pdv: z.string().optional().nullable(),
    cdfilial: z.string().optional().nullable(),
    solidcon_quitado: z.union([z.number(), z.boolean()]).optional().nullable().transform(val => typeof val === 'boolean' ? (val ? 1 : 0) : val),
    solidcon_key: z.string().optional().nullable(),
    solidcon_interest_key: z.string().optional().nullable(),
    cancel_billet: z.boolean().optional().nullable(),
});

const importSolidconRevenuesSchema = z.object({
    category_public_id: z.string().uuid('Invalid category ID').optional(),
    bank_account_public_id: z.string().uuid('Invalid bank account ID').optional(),
    payload: z.any(),
    update_only_pdv: z.boolean().optional().nullable()
});

const importSolidconExpensesSchema = z.object({
    category_public_id: z.string().uuid('Invalid category ID').optional(),
    bank_account_public_id: z.string().uuid('Invalid bank account ID').optional(),
    payload: z.any()
});

const batchUpdateRevenuesSchema = z.object({
    ids: z.array(z.string()),
    bank_account_public_id: z.string().uuid('Invalid bank account ID').optional(),
    payment_method: z.string().max(50).optional(),
    date: z.string().optional(),
    clear_fine_interest: z.boolean().optional()
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

    static async createCategoryType(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const validatedData = createCategoryTypeSchema.parse(req.body);

            const categoryType = await FinanceService.createCategoryType(companyId, validatedData);

            res.status(201).json({ status: 'success', data: categoryType });
        } catch (error: any) {
            if (error instanceof z.ZodError) { res.status(400).json({ status: 'error', errors: error.errors }); return; }
            throw error;
        }
    }

    static async listCategoryTypes(req: Request, res: Response): Promise<void> {
        try {
            const categoryTypes = await FinanceService.listCategoryTypes(req.user!.company_id);
            res.status(200).json({ status: 'success', data: categoryTypes });
        } catch (error) { throw error; }
    }

    static async updateCategoryType(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;

            if (!id) {
                res.status(400).json({ status: 'error', message: 'Category type ID is required' });
                return;
            }

            const validatedData = createCategoryTypeSchema.parse(req.body);
            const updatedCategoryType = await FinanceService.updateCategoryType(id, companyId, validatedData);

            res.status(200).json({ status: 'success', data: updatedCategoryType });
        } catch (error: any) {
            if (error instanceof z.ZodError) { res.status(400).json({ status: 'error', errors: error.errors }); return; }
            if (error instanceof Error && error.message === 'Category type not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async deleteCategoryType(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;

            if (!id) {
                res.status(400).json({ status: 'error', message: 'Category type ID is required' });
                return;
            }

            await FinanceService.deleteCategoryType(id, companyId);
            res.status(204).send();
        } catch (error: any) {
            if (error instanceof Error && error.message === 'Category type not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            if (error instanceof Error && error.message.includes('foreign key constraint')) {
                res.status(400).json({ status: 'error', message: 'Cannot delete category type because it is in use' });
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

            const result = await FinanceService.createExpense(companyId, userId, validatedData);

            res.status(201).json({ status: 'success', message: 'Expense recorded successfully', data: result });
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

            const result = await FinanceService.createRevenue(companyId, userId, validatedData);

            res.status(201).json({ status: 'success', message: 'Revenue recorded successfully', data: result });
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
            res.status(400).json({ status: 'error', message: error.message || 'Erro ao excluir lançamento' });
        }
    }

    static async payExpense(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;

            if (!id) {
                res.status(400).json({ status: 'error', message: 'ID da despesa é obrigatório.' });
                return;
            }

            const result = await FinanceService.payExpense(companyId, id);

            res.status(200).json({
                status: 'success',
                message: result.message,
                data: result
            });
        } catch (error: any) {
            res.status(400).json({ status: 'error', message: error?.message || 'Erro ao efetuar o pagamento.' });
        }
    }

    static async batchDeleteTransactions(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const { ids } = req.body;

            if (!Array.isArray(ids) || ids.length === 0) {
                res.status(400).json({ status: 'error', message: 'Transaction IDs array is required' });
                return;
            }

            const uniqueIds = Array.from(new Set(ids)) as string[];
            const result = await FinanceService.batchDeleteTransactions(uniqueIds, companyId);
            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    }

    static async batchUpdateRevenues(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const validatedData = batchUpdateRevenuesSchema.parse(req.body);
            
            const result = await FinanceService.batchUpdateRevenues(
                companyId,
                validatedData.ids,
                {
                    bank_account_public_id: validatedData.bank_account_public_id,
                    payment_method: validatedData.payment_method,
                    date: validatedData.date
                }
            );

            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                logger.warn({ zodErrors: error.errors }, '[financeController] ZodError (Batch Update Revenues)');
                res.status(400).json({ status: 'error', message: error.errors[0]?.message || 'Erro de validação', errors: error.errors });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message });
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

    static async sendWhatsApp(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const userId = req.user!.id;
            const transactionPublicId = req.params.id as string;
            const { phone } = req.body || {};

            if (!transactionPublicId) {
                res.status(400).json({ status: 'error', message: 'Transaction ID is required' });
                return;
            }

            const result = await FinanceService.sendWhatsApp(Number(companyId), userId, transactionPublicId, phone);
            res.status(200).json({ status: 'success', message: 'WhatsApp enviado com sucesso', data: result });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Erro interno ao enviar WhatsApp' });
        }
    }

    static async getWhatsAppAudits(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const result = await FinanceService.getWhatsAppAudits(Number(companyId), req.query);
            res.status(200).json({ status: 'success', ...result });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Erro interno ao consultar auditoria do WhatsApp' });
        }
    }

    static async getTransactionWhatsAppAudits(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const transactionPublicId = req.params.id as string;
            if (!transactionPublicId) {
                res.status(400).json({ status: 'error', message: 'Transaction ID is required' });
                return;
            }
            const result = await FinanceService.getTransactionWhatsAppAudits(Number(companyId), transactionPublicId);
            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Erro interno ao consultar auditoria da receita' });
        }
    }

    static async getWhatsAppScreenshot(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const screenshot = await WhatsAppBusinessService.getSessionScreenshot(Number(companyId));
            if (!screenshot) {
                res.status(404).send('Screenshot da sessao nao disponivel (a sessao pode nao estar ativa).');
                return;
            }
            res.setHeader('Content-Type', 'image/png');
            res.send(screenshot);
        } catch (error: any) {
            res.status(500).send(`Erro ao tirar screenshot: ${error.message}`);
        }
    }

    static async getWhatsAppStatus(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const isConnected = await WhatsAppBusinessService.isAnySessionConnected(Number(companyId));
            const sessionInfo = await WhatsAppBusinessService.getCompanyActiveSessionInfo(Number(companyId));
            res.status(200).json({
                status: 'success',
                data: {
                    isConnected,
                    sessionInfo
                }
            });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Erro ao verificar status do WhatsApp' });
        }
    }

    static async batchSendWhatsApp(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const userId = req.user!.id;
            const { ids } = req.body || {};

            if (!Array.isArray(ids) || ids.length === 0) {
                res.status(400).json({ status: 'error', message: 'Nenhuma receita selecionada para envio.' });
                return;
            }

            const result = await FinanceService.batchSendWhatsApp(Number(companyId), userId, ids);
            res.status(200).json({
                status: 'success',
                data: result,
                message: `${result.success} cobrança(s) enviada(s) com sucesso via WhatsApp.${result.failed > 0 ? ` (${result.failed} falha(s))` : ''}`
            });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Erro interno ao realizar disparo em lote via WhatsApp.' });
        }
    }

    static async generateBillet(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const transactionPublicId = req.params.id as string;
            const requestingUserId = req.user?.id;

            if (!transactionPublicId) {
                res.status(400).json({ status: 'error', message: 'Transaction ID is required' });
                return;
            }

            const billetData = await FinanceService.generateBillet(companyId, transactionPublicId, requestingUserId);
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

            const result = await FinanceService.getBoletoPdfBase64(companyId, transactionPublicId, nossoNumero);
            if (!result || !result.pdfBase64) {
                res.status(404).json({ status: 'error', message: 'PDF do Boleto não encontrado.' });
                return;
            }
            const pdfBuffer = Buffer.from(result.pdfBase64, 'base64');

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`);
            res.setHeader('Content-Length', String(pdfBuffer.length));
            res.end(pdfBuffer);
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
            const requestingUserId = req.user?.id;
            const { ids } = req.body;

            if (!ids || !Array.isArray(ids)) {
                res.status(400).json({ status: 'error', message: 'Invalid IDs array' });
                return;
            }

            const uniqueIds = Array.from(new Set(ids)) as string[];
            await FinanceService.batchGenerateBillets(companyId, uniqueIds, requestingUserId);
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

            const uniqueIds = Array.from(new Set(ids)) as string[];
            await FinanceService.batchCancelBillets(companyId, uniqueIds);
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
            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                res.status(400).json({ status: 'error', message: 'Selecione pelo menos um lançamento para excluir.' });
                return;
            }
            const uniqueIds = Array.from(new Set(ids)) as string[];
            await FinanceService.batchDeleteBankStatements(companyId, uniqueIds, email, password);
            res.status(200).json({ status: 'success', message: 'Lançamentos do extrato removidos com sucesso.' });
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
            const startDate = req.query.startDate as string;
            const endDate = req.query.endDate as string;
            
            const result = await FinanceService.listBankStatements(companyId, bankAccountPublicId, startDate, endDate);
            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Erro ao listar extratos bancários.' });
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
            const { bank_statement_id, transaction_id, delete_transaction } = req.body;

            if (!bank_statement_id && !transaction_id) {
                res.status(400).json({ status: 'error', message: 'bank_statement_id ou transaction_id é obrigatório.' });
                return;
            }

            const shouldDelete = delete_transaction !== undefined ? Boolean(delete_transaction) : true;
            if (bank_statement_id) {
                await FinanceService.undoReconcile(companyId, bank_statement_id, shouldDelete);
            } else if (transaction_id) {
                await FinanceService.undoReconcileByTransaction(companyId, transaction_id, shouldDelete);
            }
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

    static async listPixCharges(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const rows = await FinanceService.listPixCharges(companyId);
            res.status(200).json({ status: 'success', data: rows });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    }

    static async createPixCharge(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const userPublicId = req.user!.id;
            
            const schema = z.object({
                amount: z.number().positive('O valor deve ser maior que zero'),
                description: z.string().trim().min(1, 'A descrição é obrigatória').max(140, 'Descrição muito longa (máx 140 caracteres)')
            });
            
            const { amount, description } = schema.parse(req.body);
            
            const result = await FinanceService.generateDirectPix(companyId, userPublicId, amount, description);
            
            res.status(201).json({ status: 'success', data: result });
        } catch (error: any) {
            console.error('[FinanceController] Erro ao gerar PIX:', error);
            if (error instanceof z.ZodError) {
                res.status(400).json({ status: 'error', message: error.errors[0]?.message || 'Dados inválidos' });
                return;
            }
            res.status(400).json({ status: 'error', message: error.message || 'Erro ao gerar PIX' });
        }
    }

    static async importRevenuesSolidcon(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const userId = req.user!.id;
            const { category_public_id, bank_account_public_id, payload, update_only_pdv } = importSolidconRevenuesSchema.parse(req.body);

            const normalizeItems = (value: any, depth = 0): any[] => {
                if (depth > 4) return [];
                if (Array.isArray(value)) return value;
                if (typeof value === 'string') {
                    try {
                        return normalizeItems(JSON.parse(value), depth + 1);
                    } catch {
                        return [];
                    }
                }
                const containers = ['body', 'items', 'data', 'revenues', 'receitas', 'registros', 'resultado', 'results', 'rows'];
                for (const key of containers) {
                    if (value?.[key] !== undefined && value?.[key] !== null) {
                        const nestedItems = normalizeItems(value[key], depth + 1);
                        if (nestedItems.length) return nestedItems;
                    }
                }
                return [];
            };

            const items = normalizeItems(payload);
            if (!items.length) {
                res.status(400).json({ status: 'error', message: 'Nenhum item valido encontrado para importacao.' });
                return;
            }

            const result = await FinanceService.importSolidconRevenues(
                companyId,
                userId,
                category_public_id,
                bank_account_public_id,
                items,
                update_only_pdv === true
            );

            res.status(200).json({
                status: 'success',
                data: result
            });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ status: 'error', errors: error.errors });
                return;
            }
            res.status(500).json({ status: 'error', message: error?.message || 'Internal Server Error' });
        }
    }

    static async importExpensesSolidcon(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const userId = req.user!.id;
            const { category_public_id, bank_account_public_id, payload } = importSolidconExpensesSchema.parse(req.body);

            const normalizeItems = (value: any, depth = 0): any[] => {
                if (depth > 4) return [];
                if (Array.isArray(value)) return value;
                if (typeof value === 'string') {
                    try {
                        return normalizeItems(JSON.parse(value), depth + 1);
                    } catch {
                        return [];
                    }
                }
                const containers = ['body', 'items', 'data', 'expenses', 'despesas', 'registros', 'resultado', 'results', 'rows'];
                for (const key of containers) {
                    if (value?.[key] !== undefined && value?.[key] !== null) {
                        const nestedItems = normalizeItems(value[key], depth + 1);
                        if (nestedItems.length) return nestedItems;
                    }
                }
                return [];
            };

            const items = normalizeItems(payload);
            if (!items.length) {
                res.status(400).json({ status: 'error', message: 'Nenhum item válido encontrado para importação.' });
                return;
            }

            const result = await FinanceService.importSolidconExpenses(
                companyId,
                userId,
                category_public_id,
                bank_account_public_id,
                items
            );

            res.status(200).json({
                status: 'success',
                data: result
            });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ status: 'error', errors: error.errors });
                return;
            }
            res.status(500).json({ status: 'error', message: error?.message || 'Internal Server Error' });
        }
    }

    static async syncBoletoStatus(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const transactionPublicId = req.params.id as string;

            if (!transactionPublicId) {
                res.status(400).json({ status: 'error', message: 'Transaction ID is required' });
                return;
            }

            const situacao = await FinanceService.syncBoletoStatus(companyId, transactionPublicId);
            res.status(200).json({ status: 'success', situacao });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Erro interno ao sincronizar boleto' });
        }
    }

    static async batchSyncPayments(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const { ids } = req.body;

            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                res.status(400).json({ status: 'error', message: 'Lista de IDs inválida ou vazia' });
                return;
            }

            const result = await FinanceService.batchSyncPayments(companyId, ids);
            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error?.message || 'Erro ao processar conciliação em lote' });
        }
    }

    static async syncSolidconBaixas(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const { transactionIds } = req.body;
            const result = await FinanceService.syncSolidconBaixas(companyId, Array.isArray(transactionIds) ? transactionIds.map(String) : undefined);
            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error?.message || 'Erro ao sincronizar baixas com a Solidcon' });
        }
    }

    static async cleanDuplicateSolidconBaixas(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const { transactionIds } = req.body;
            const result = await FinanceService.cleanDuplicateSolidconBaixas(companyId, Array.isArray(transactionIds) ? transactionIds.map(String) : undefined);
            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error?.message || 'Erro ao excluir baixas duplicadas na Solidcon' });
        }
    }

    // Card Statements Controller Methods
    static async listCardStatements(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const result = await FinanceService.listCardStatements(companyId);
            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error?.message || 'Erro ao listar extratos de cartões.' });
        }
    }

    static async listCardTransactions(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const result = await FinanceService.listCardTransactions(companyId);
            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error?.message || 'Erro ao listar lançamentos de cartões do sistema.' });
        }
    }

    static async reconcileCard(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const { system_ids, card_statement_ids } = req.body;

            if (!Array.isArray(system_ids) || !Array.isArray(card_statement_ids)) {
                res.status(400).json({ status: 'error', message: 'Os arrays system_ids e card_statement_ids são obrigatórios.' });
                return;
            }

            await FinanceService.reconcileCard(companyId, system_ids, card_statement_ids);
            res.status(200).json({ status: 'success', message: 'Conciliação de cartão realizada com sucesso.' });
        } catch (error: any) {
            console.error('[FinanceController] Erro na conciliação de cartão:', error);
            res.status(400).json({ status: 'error', message: error.message || 'Erro ao conciliar lançamentos de cartão.' });
        }
    }

    static async undoReconcileCard(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const { card_statement_id } = req.body;

            if (!card_statement_id) {
                res.status(400).json({ status: 'error', message: 'card_statement_id é obrigatório.' });
                return;
            }

            await FinanceService.undoReconcileCard(companyId, card_statement_id);
            res.status(200).json({ status: 'success', message: 'Conciliação de cartão desfeita com sucesso.' });
        } catch (error: any) {
            console.error('[FinanceController] Erro ao desconciliar cartão:', error);
            res.status(400).json({ status: 'error', message: error.message || 'Erro ao desconciliar lançamentos de cartão.' });
        }
    }

    static async syncCardStatementsOfx(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const { ofxContent } = req.body;

            if (!ofxContent) {
                res.status(400).json({ status: 'error', message: 'ofxContent é obrigatório' });
                return;
            }

            const totalImported = await FinanceService.syncCardStatementsOfx(companyId, ofxContent);
            res.status(200).json({ status: 'success', message: `${totalImported} lançamentos de cartões importados com sucesso.` });
        } catch (error: any) {
            console.error('[FinanceController] Erro no syncCardStatementsOfx:', error);
            res.status(400).json({ status: 'error', message: error.message || 'Erro ao importar OFX de cartão.' });
        }
    }

    static async batchDeleteCardStatements(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const { ids } = req.body;

            if (!Array.isArray(ids) || ids.length === 0) {
                res.status(400).json({ status: 'error', message: 'Lista de IDs inválida ou vazia.' });
                return;
            }

            await FinanceService.batchDeleteCardStatements(companyId, ids);
            res.status(200).json({ status: 'success', message: 'Lançamentos de cartões removidos com sucesso.' });
        } catch (error: any) {
            res.status(400).json({ status: 'error', message: error.message || 'Erro ao remover extratos de cartões.' });
        }
    }

    private static async resolveReportCompany(req: Request, targetCompanyParam?: any) {
        const userCompanyId = req.user?.company_id;
        if (!userCompanyId) return null;

        const { CompanyService } = await import('../services/companyService');
        if (targetCompanyParam) {
            let target = null;
            if (typeof targetCompanyParam === 'string' && targetCompanyParam.includes('-')) {
                target = await CompanyService.getByPublicId(targetCompanyParam);
            } else if (!isNaN(Number(targetCompanyParam))) {
                target = await CompanyService.getById(Number(targetCompanyParam));
            }
            if (target) {
                const { CompanyController } = await import('./companyController');
                if (await CompanyController.hasAccess(req, target.id)) {
                    return target;
                }
            }
        }
        return await CompanyService.getById(userCompanyId);
    }

    static async listSolidconConnections(req: Request, res: Response): Promise<void> {
        try {
            const requestedCompany = req.query.targetCompanyId || req.query.companyId || req.query.company_id;
            const company = await FinanceController.resolveReportCompany(req, requestedCompany);
            if (!company) {
                res.status(401).json({ status: 'error', message: 'Empresa não identificada ou sem acesso.' });
                return;
            }

            const { SolidconConfigService } = await import('../services/solidconConfigService');
            const configs = await SolidconConfigService.list(company.id);
            const safeList = configs.map(c => ({
                id: c.id,
                name: c.name,
                is_default: !!c.is_default,
                serv_solidcon: c.serv_solidcon,
                bd_solidcon: c.bd_solidcon,
                cdfilial: c.cdfilial,
                cdpdv: c.cdpdv
            }));
            res.status(200).json({
                status: 'success',
                data: safeList,
                company: {
                    id: company.id,
                    public_id: company.public_id,
                    trade_name: company.trade_name,
                    company_name: company.company_name,
                    cdfilial: company.cdfilial
                }
            });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error?.message || 'Erro ao listar conexões Solidcon.' });
        }
    }

    static async listDorsalConnections(req: Request, res: Response): Promise<void> {
        try {
            const requestedCompany = req.query.targetCompanyId || req.query.companyId || req.query.company_id;
            const company = await FinanceController.resolveReportCompany(req, requestedCompany);
            if (!company) {
                res.status(401).json({ status: 'error', message: 'Empresa não identificada ou sem acesso.' });
                return;
            }

            const { DorsalConfigService } = await import('../services/dorsalConfigService');
            const configs = await DorsalConfigService.list(company.id);
            const safeList = configs.map(c => ({
                id: c.id,
                name: c.name,
                is_default: !!c.is_default,
                serv_dorsal: c.serv_dorsal,
                bd_dorsal: c.bd_dorsal,
                cdfilial: c.cdfilial,
                cdpdv: c.cdpdv
            }));
            res.status(200).json({
                status: 'success',
                data: safeList,
                company: {
                    id: company.id,
                    public_id: company.public_id,
                    trade_name: company.trade_name,
                    company_name: company.company_name,
                    cdfilial: company.cdfilial
                }
            });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error?.message || 'Erro ao listar conexões Dorsal.' });
        }
    }

    static async listExternalConnections(req: Request, res: Response): Promise<void> {
        try {
            const requestedCompany = req.query.targetCompanyId || req.query.companyId || req.query.company_id;
            const company = await FinanceController.resolveReportCompany(req, requestedCompany);
            if (!company) {
                res.status(401).json({ status: 'error', message: 'Empresa não identificada ou sem acesso.' });
                return;
            }

            const { DorsalConfigService } = await import('../services/dorsalConfigService');
            const { SolidconConfigService } = await import('../services/solidconConfigService');
            const [dorsalConfigs, solidconConfigs] = await Promise.all([
                DorsalConfigService.list(company.id),
                SolidconConfigService.list(company.id)
            ]);

            const dorsalList = dorsalConfigs.map(c => ({
                id: `dorsal_${c.id}`,
                rawId: c.id,
                type: 'dorsal',
                name: `[Dorsal] ${c.name}`,
                simpleName: c.name,
                is_default: !!c.is_default,
                serv: c.serv_dorsal,
                bd: c.bd_dorsal,
                cdfilial: c.cdfilial,
                cdpdv: c.cdpdv
            }));

            const solidconList = solidconConfigs.map(c => ({
                id: `solidcon_${c.id}`,
                rawId: c.id,
                type: 'solidcon',
                name: `[Solidcon] ${c.name}`,
                simpleName: c.name,
                is_default: !!c.is_default,
                serv: c.serv_solidcon,
                bd: c.bd_solidcon,
                cdfilial: c.cdfilial,
                cdpdv: c.cdpdv
            }));

            // Dorsal first, then Solidcon
            const safeList = [...dorsalList, ...solidconList];

            res.status(200).json({
                status: 'success',
                data: safeList,
                company: {
                    id: company.id,
                    public_id: company.public_id,
                    trade_name: company.trade_name,
                    company_name: company.company_name,
                    cdfilial: company.cdfilial
                }
            });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error?.message || 'Erro ao listar conexões externas.' });
        }
    }

    static async getReportRafael(req: Request, res: Response): Promise<void> {
        try {
            const { startDate, endDate, cdFilial, connectionId, targetCompanyId, companyId, company_id } = req.query;
            if (!startDate || !endDate) {
                res.status(400).json({ status: 'error', message: 'Parâmetros startDate e endDate são obrigatórios.' });
                return;
            }

            const company = await FinanceController.resolveReportCompany(req, targetCompanyId || companyId || company_id);
            if (!company) {
                res.status(404).json({ status: 'error', message: 'Empresa não encontrada ou acesso negado.' });
                return;
            }

            let rows: any[] = [];
            let errorMsg = '';
            const { ExternalDbService } = await import('../services/externalDbService');
            const finalCdFilial = cdFilial ? String(cdFilial).trim() : (company.cdfilial ? String(company.cdfilial).trim() : '1');

            // 1. If a specific connectionId is requested
            if (connectionId) {
                const connStr = String(connectionId).trim();
                if (connStr.startsWith('dorsal_') || req.query.connectionType === 'dorsal') {
                    const cleanId = parseInt(connStr.replace('dorsal_', ''), 10);
                    const { DorsalConfigService } = await import('../services/dorsalConfigService');
                    const dorsalConfig = await DorsalConfigService.getById(cleanId, company.id);
                    if (dorsalConfig && dorsalConfig.serv_dorsal && dorsalConfig.bd_dorsal) {
                        try {
                            rows = await ExternalDbService.getReportRafael({
                                host: dorsalConfig.serv_dorsal,
                                database: dorsalConfig.bd_dorsal,
                                user: dorsalConfig.login_dorsal || '',
                                password: dorsalConfig.senha_dorsal || ''
                            }, String(startDate), String(endDate), String(finalCdFilial || dorsalConfig.cdfilial || ''), true);

                            res.status(200).json({
                                status: 'success',
                                data: rows
                            });
                            return;
                        } catch (err: any) {
                            res.status(400).json({
                                status: 'error',
                                message: `Dorsal (${dorsalConfig.name}): ${err.message || err}`
                            });
                            return;
                        }
                    }
                } else if (connStr.startsWith('solidcon_') || req.query.connectionType === 'solidcon') {
                    const cleanId = parseInt(connStr.replace('solidcon_', ''), 10);
                    const { SolidconConfigService } = await import('../services/solidconConfigService');
                    const solidconConfig = await SolidconConfigService.getById(cleanId, company.id);
                    if (solidconConfig && solidconConfig.serv_solidcon && solidconConfig.bd_solidcon) {
                        try {
                            rows = await ExternalDbService.getReportRafael({
                                host: solidconConfig.serv_solidcon,
                                database: solidconConfig.bd_solidcon,
                                user: solidconConfig.login_solidcon || '',
                                password: solidconConfig.senha_solidcon || ''
                            }, String(startDate), String(endDate), String(finalCdFilial || solidconConfig.cdfilial || ''), false);

                            res.status(200).json({
                                status: 'success',
                                data: rows
                            });
                            return;
                        } catch (err: any) {
                            res.status(400).json({
                                status: 'error',
                                message: `Solidcon (${solidconConfig.name}): ${err.message || err}`
                            });
                            return;
                        }
                    }
                } else {
                    const cleanId = parseInt(connStr, 10);
                    if (!isNaN(cleanId)) {
                        const { DorsalConfigService } = await import('../services/dorsalConfigService');
                        const dorsalConfig = await DorsalConfigService.getById(cleanId, company.id);
                        if (dorsalConfig && dorsalConfig.serv_dorsal && dorsalConfig.bd_dorsal) {
                            try {
                                rows = await ExternalDbService.getReportRafael({
                                    host: dorsalConfig.serv_dorsal,
                                    database: dorsalConfig.bd_dorsal,
                                    user: dorsalConfig.login_dorsal || '',
                                    password: dorsalConfig.senha_dorsal || ''
                                }, String(startDate), String(endDate), String(finalCdFilial || dorsalConfig.cdfilial || ''), true);

                                res.status(200).json({
                                    status: 'success',
                                    data: rows
                                });
                                return;
                            } catch (err: any) {
                                res.status(400).json({
                                    status: 'error',
                                    message: `Dorsal (${dorsalConfig.name}): ${err.message || err}`
                                });
                                return;
                            }
                        }

                        const { SolidconConfigService } = await import('../services/solidconConfigService');
                        const solidconConfig = await SolidconConfigService.getById(cleanId, company.id);
                        if (solidconConfig && solidconConfig.serv_solidcon && solidconConfig.bd_solidcon) {
                            try {
                                rows = await ExternalDbService.getReportRafael({
                                    host: solidconConfig.serv_solidcon,
                                    database: solidconConfig.bd_solidcon,
                                    user: solidconConfig.login_solidcon || '',
                                    password: solidconConfig.senha_solidcon || ''
                                }, String(startDate), String(endDate), String(finalCdFilial || solidconConfig.cdfilial || ''), false);

                                res.status(200).json({
                                    status: 'success',
                                    data: rows
                                });
                                return;
                            } catch (err: any) {
                                res.status(400).json({
                                    status: 'error',
                                    message: `Solidcon (${solidconConfig.name}): ${err.message || err}`
                                });
                                return;
                            }
                        }
                    }
                }
            }

            // 2. Check registered Dorsal connections first
            const { DorsalConfigService } = await import('../services/dorsalConfigService');
            const dorsalConfigs = await DorsalConfigService.list(company.id);
            const targetDorsalConfig = dorsalConfigs.find(c => c.is_default) || dorsalConfigs[0];

            if (targetDorsalConfig && targetDorsalConfig.serv_dorsal && targetDorsalConfig.bd_dorsal) {
                try {
                    rows = await ExternalDbService.getReportRafael({
                        host: targetDorsalConfig.serv_dorsal,
                        database: targetDorsalConfig.bd_dorsal,
                        user: targetDorsalConfig.login_dorsal || '',
                        password: targetDorsalConfig.senha_dorsal || ''
                    }, String(startDate), String(endDate), String(finalCdFilial || targetDorsalConfig.cdfilial || ''), true);

                    res.status(200).json({
                        status: 'success',
                        data: rows
                    });
                    return;
                } catch (err: any) {
                    errorMsg += `Dorsal (${targetDorsalConfig.name}): ${err.message || err}. `;
                }
            }

            // 3. Check registered Solidcon connections
            const { SolidconConfigService } = await import('../services/solidconConfigService');
            const solidconConfigs = await SolidconConfigService.list(company.id);
            const targetSolidconConfig = solidconConfigs.find(c => c.is_default) || solidconConfigs[0];

            if (targetSolidconConfig && targetSolidconConfig.serv_solidcon && targetSolidconConfig.bd_solidcon) {
                try {
                    rows = await ExternalDbService.getReportRafael({
                        host: targetSolidconConfig.serv_solidcon,
                        database: targetSolidconConfig.bd_solidcon,
                        user: targetSolidconConfig.login_solidcon || '',
                        password: targetSolidconConfig.senha_solidcon || ''
                    }, String(startDate), String(endDate), String(finalCdFilial || targetSolidconConfig.cdfilial || ''), false);

                    res.status(200).json({
                        status: 'success',
                        data: rows
                    });
                    return;
                } catch (err: any) {
                    errorMsg += `Solidcon (${targetSolidconConfig.name}): ${err.message || err}. `;
                }
            }

            // 4. Legacy company fields fallback: Dorsal first, then Solidcon
            if (company.serv_dorsal && company.bd_dorsal) {
                try {
                    rows = await ExternalDbService.getReportRafael({
                        host: company.serv_dorsal,
                        database: company.bd_dorsal,
                        user: company.login_dorsal || '',
                        password: decrypt(company.senha_dorsal) || company.senha_dorsal || ''
                    }, String(startDate), String(endDate), finalCdFilial, true);

                    res.status(200).json({
                        status: 'success',
                        data: rows
                    });
                    return;
                } catch (err: any) {
                    errorMsg += `Dorsal: ${err.message || err}. `;
                }
            } else if (company.serv_solidcon && company.bd_solidcon) {
                try {
                    rows = await ExternalDbService.getReportRafael({
                        host: company.serv_solidcon,
                        database: company.bd_solidcon,
                        user: company.login_solidcon || '',
                        password: decrypt(company.senha_solidcon) || company.senha_solidcon || ''
                    }, String(startDate), String(endDate), finalCdFilial, false);

                    res.status(200).json({
                        status: 'success',
                        data: rows
                    });
                    return;
                } catch (err: any) {
                    errorMsg += `Solidcon: ${err.message || err}. `;
                }
            }

            res.status(400).json({
                status: 'error',
                message: errorMsg || 'Configurações de conexão banco de dados externo incompletas.'
            });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error?.message || 'Erro interno ao processar o relatório.' });
        }
    }

    static async getReportRafaelDetail(req: Request, res: Response): Promise<void> {
        try {
            const { startDate, endDate, cdFilial, cdProduto, connectionId, targetCompanyId, companyId, company_id } = req.query;
            if (!startDate || !endDate || !cdProduto) {
                res.status(400).json({ status: 'error', message: 'Parâmetros startDate, endDate e cdProduto são obrigatórios.' });
                return;
            }

            const company = await FinanceController.resolveReportCompany(req, targetCompanyId || companyId || company_id);
            if (!company) {
                res.status(404).json({ status: 'error', message: 'Empresa não encontrada ou acesso negado.' });
                return;
            }

            let rows: any[] = [];
            let errorMsg = '';
            const { ExternalDbService } = await import('../services/externalDbService');
            const finalCdFilial = cdFilial ? String(cdFilial).trim() : (company.cdfilial ? String(company.cdfilial).trim() : '1');

            // 1. If a specific connectionId is requested
            if (connectionId) {
                const connStr = String(connectionId).trim();
                if (connStr.startsWith('dorsal_') || req.query.connectionType === 'dorsal') {
                    const cleanId = parseInt(connStr.replace('dorsal_', ''), 10);
                    const { DorsalConfigService } = await import('../services/dorsalConfigService');
                    const dorsalConfig = await DorsalConfigService.getById(cleanId, company.id);
                    if (dorsalConfig && dorsalConfig.serv_dorsal && dorsalConfig.bd_dorsal) {
                        try {
                            rows = await ExternalDbService.getReportRafaelDetail({
                                host: dorsalConfig.serv_dorsal,
                                database: dorsalConfig.bd_dorsal,
                                user: dorsalConfig.login_dorsal || '',
                                password: dorsalConfig.senha_dorsal || ''
                            }, String(startDate), String(endDate), String(finalCdFilial || dorsalConfig.cdfilial || ''), String(cdProduto), true);

                            res.status(200).json({
                                status: 'success',
                                data: rows
                            });
                            return;
                        } catch (err: any) {
                            res.status(400).json({
                                status: 'error',
                                message: `Dorsal (${dorsalConfig.name}): ${err.message || err}`
                            });
                            return;
                        }
                    }
                } else if (connStr.startsWith('solidcon_') || req.query.connectionType === 'solidcon') {
                    const cleanId = parseInt(connStr.replace('solidcon_', ''), 10);
                    const { SolidconConfigService } = await import('../services/solidconConfigService');
                    const solidconConfig = await SolidconConfigService.getById(cleanId, company.id);
                    if (solidconConfig && solidconConfig.serv_solidcon && solidconConfig.bd_solidcon) {
                        try {
                            rows = await ExternalDbService.getReportRafaelDetail({
                                host: solidconConfig.serv_solidcon,
                                database: solidconConfig.bd_solidcon,
                                user: solidconConfig.login_solidcon || '',
                                password: solidconConfig.senha_solidcon || ''
                            }, String(startDate), String(endDate), String(finalCdFilial || solidconConfig.cdfilial || ''), String(cdProduto), false);

                            res.status(200).json({
                                status: 'success',
                                data: rows
                            });
                            return;
                        } catch (err: any) {
                            res.status(400).json({
                                status: 'error',
                                message: `Solidcon (${solidconConfig.name}): ${err.message || err}`
                            });
                            return;
                        }
                    }
                } else {
                    const cleanId = parseInt(connStr, 10);
                    if (!isNaN(cleanId)) {
                        const { DorsalConfigService } = await import('../services/dorsalConfigService');
                        const dorsalConfig = await DorsalConfigService.getById(cleanId, company.id);
                        if (dorsalConfig && dorsalConfig.serv_dorsal && dorsalConfig.bd_dorsal) {
                            try {
                                rows = await ExternalDbService.getReportRafaelDetail({
                                    host: dorsalConfig.serv_dorsal,
                                    database: dorsalConfig.bd_dorsal,
                                    user: dorsalConfig.login_dorsal || '',
                                    password: dorsalConfig.senha_dorsal || ''
                                }, String(startDate), String(endDate), String(finalCdFilial || dorsalConfig.cdfilial || ''), String(cdProduto), true);

                                res.status(200).json({
                                    status: 'success',
                                    data: rows
                                });
                                return;
                            } catch (err: any) {
                                res.status(400).json({
                                    status: 'error',
                                    message: `Dorsal (${dorsalConfig.name}): ${err.message || err}`
                                });
                                return;
                            }
                        }

                        const { SolidconConfigService } = await import('../services/solidconConfigService');
                        const solidconConfig = await SolidconConfigService.getById(cleanId, company.id);
                        if (solidconConfig && solidconConfig.serv_solidcon && solidconConfig.bd_solidcon) {
                            try {
                                rows = await ExternalDbService.getReportRafaelDetail({
                                    host: solidconConfig.serv_solidcon,
                                    database: solidconConfig.bd_solidcon,
                                    user: solidconConfig.login_solidcon || '',
                                    password: solidconConfig.senha_solidcon || ''
                                }, String(startDate), String(endDate), String(finalCdFilial || solidconConfig.cdfilial || ''), String(cdProduto), false);

                                res.status(200).json({
                                    status: 'success',
                                    data: rows
                                });
                                return;
                            } catch (err: any) {
                                res.status(400).json({
                                    status: 'error',
                                    message: `Solidcon (${solidconConfig.name}): ${err.message || err}`
                                });
                                return;
                            }
                        }
                    }
                }
            }

            // 2. Check registered Dorsal connections first
            const { DorsalConfigService } = await import('../services/dorsalConfigService');
            const dorsalConfigs = await DorsalConfigService.list(company.id);
            const targetDorsalConfig = dorsalConfigs.find(c => c.is_default) || dorsalConfigs[0];

            if (targetDorsalConfig && targetDorsalConfig.serv_dorsal && targetDorsalConfig.bd_dorsal) {
                try {
                    rows = await ExternalDbService.getReportRafaelDetail({
                        host: targetDorsalConfig.serv_dorsal,
                        database: targetDorsalConfig.bd_dorsal,
                        user: targetDorsalConfig.login_dorsal || '',
                        password: targetDorsalConfig.senha_dorsal || ''
                    }, String(startDate), String(endDate), String(finalCdFilial || targetDorsalConfig.cdfilial || ''), String(cdProduto), true);

                    res.status(200).json({
                        status: 'success',
                        data: rows
                    });
                    return;
                } catch (err: any) {
                    errorMsg += `Dorsal (${targetDorsalConfig.name}): ${err.message || err}. `;
                }
            }

            // 3. Check registered Solidcon connections
            const { SolidconConfigService } = await import('../services/solidconConfigService');
            const solidconConfigs = await SolidconConfigService.list(company.id);
            const targetConfig = solidconConfigs.find(c => c.is_default) || solidconConfigs[0];

            if (targetConfig && targetConfig.serv_solidcon && targetConfig.bd_solidcon) {
                try {
                    rows = await ExternalDbService.getReportRafaelDetail({
                        host: targetConfig.serv_solidcon,
                        database: targetConfig.bd_solidcon,
                        user: targetConfig.login_solidcon || '',
                        password: targetConfig.senha_solidcon || ''
                    }, String(startDate), String(endDate), String(finalCdFilial || targetConfig.cdfilial || ''), String(cdProduto), false);

                    res.status(200).json({
                        status: 'success',
                        data: rows
                    });
                    return;
                } catch (err: any) {
                    errorMsg += `Solidcon (${targetConfig.name}): ${err.message || err}. `;
                }
            } else if (company.serv_solidcon && company.bd_solidcon) {
                // Fallback to legacy company fields
                try {
                    rows = await ExternalDbService.getReportRafaelDetail({
                        host: company.serv_solidcon,
                        database: company.bd_solidcon,
                        user: company.login_solidcon || '',
                        password: decrypt(company.senha_solidcon) || company.senha_solidcon || ''
                    }, String(startDate), String(endDate), finalCdFilial, String(cdProduto), false);

                    res.status(200).json({
                        status: 'success',
                        data: rows
                    });
                    return;
                } catch (err: any) {
                    errorMsg += `Solidcon: ${err.message || err}. `;
                }
            }

            // 4. Legacy company fields fallback: Dorsal first, then Solidcon
            if (company.serv_dorsal && company.bd_dorsal) {
                try {
                    rows = await ExternalDbService.getReportRafaelDetail({
                        host: company.serv_dorsal,
                        database: company.bd_dorsal,
                        user: company.login_dorsal || '',
                        password: decrypt(company.senha_dorsal) || company.senha_dorsal || ''
                    }, String(startDate), String(endDate), finalCdFilial, String(cdProduto), true);

                    res.status(200).json({
                        status: 'success',
                        data: rows
                    });
                    return;
                } catch (err: any) {
                    errorMsg += `Dorsal: ${err.message || err}. `;
                }
            }

            res.status(400).json({
                status: 'error',
                message: errorMsg || 'Configurações de conexão banco de dados externo incompletas.'
            });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error?.message || 'Erro interno ao processar o detalhe do relatório.' });
        }
    }

    static async updateReportRafaelCosts(req: Request, res: Response): Promise<void> {
        try {
            const { 
                cdProduto, 
                cdFilial, 
                startDate, 
                endDate, 
                custoUnitarioVenda, 
                custoUnitarioDia, 
                items,
                connectionId, 
                connectionType, 
                targetCompanyId, 
                companyId, 
                company_id 
            } = { ...req.query, ...req.body };

            if (!cdProduto) {
                res.status(400).json({ status: 'error', message: 'O parâmetro cdProduto é obrigatório.' });
                return;
            }

            if (custoUnitarioVenda === undefined && custoUnitarioDia === undefined && (!Array.isArray(items) || items.length === 0)) {
                res.status(400).json({ status: 'error', message: 'Informe pelo menos um custo (Custo Unit. Venda ou Custo Unit. Dia) para atualizar.' });
                return;
            }

            const company = await FinanceController.resolveReportCompany(req, targetCompanyId || companyId || company_id);
            if (!company) {
                res.status(404).json({ status: 'error', message: 'Empresa não encontrada ou acesso negado.' });
                return;
            }

            const { ExternalDbService } = await import('../services/externalDbService');
            const finalCdFilial = cdFilial ? String(cdFilial).trim() : (company.cdfilial ? String(company.cdfilial).trim() : '1');
            const isDorsalRequested = connectionType === 'dorsal' || (typeof connectionId === 'string' && connectionId.startsWith('dorsal_'));

            let result: { updatedSalesItems: number; updatedProducts: number } | null = null;
            let errorMsg = '';

            // 1. If specific connectionId is requested
            if (connectionId) {
                const connStr = String(connectionId).trim();
                if (connStr.startsWith('dorsal_') || isDorsalRequested) {
                    const cleanId = parseInt(connStr.replace('dorsal_', ''), 10);
                    const { DorsalConfigService } = await import('../services/dorsalConfigService');
                    const dorsalConfig = await DorsalConfigService.getById(cleanId, company.id);
                    if (dorsalConfig && dorsalConfig.serv_dorsal && dorsalConfig.bd_dorsal) {
                        try {
                            result = await ExternalDbService.updateReportRafaelCosts({
                                host: dorsalConfig.serv_dorsal,
                                database: dorsalConfig.bd_dorsal,
                                user: dorsalConfig.login_dorsal || '',
                                password: dorsalConfig.senha_dorsal || ''
                            }, {
                                cdProduto: String(cdProduto),
                                cdFilial: String(finalCdFilial || dorsalConfig.cdfilial || ''),
                                startDate: startDate ? String(startDate) : undefined,
                                endDate: endDate ? String(endDate) : undefined,
                                custoUnitarioVenda: custoUnitarioVenda !== undefined ? Number(custoUnitarioVenda) : undefined,
                                custoUnitarioDia: custoUnitarioDia !== undefined ? Number(custoUnitarioDia) : undefined,
                                items: Array.isArray(items) ? items : undefined
                            }, true);

                            res.status(200).json({
                                status: 'success',
                                message: 'Custos atualizados com sucesso no banco Dorsal.',
                                data: result
                            });
                            return;
                        } catch (err: any) {
                            res.status(400).json({
                                status: 'error',
                                message: `Dorsal (${dorsalConfig.name}): ${err.message || err}`
                            });
                            return;
                        }
                    }
                } else if (connStr.startsWith('solidcon_') || connectionType === 'solidcon') {
                    const cleanId = parseInt(connStr.replace('solidcon_', ''), 10);
                    const { SolidconConfigService } = await import('../services/solidconConfigService');
                    const solidconConfig = await SolidconConfigService.getById(cleanId, company.id);
                    if (solidconConfig && solidconConfig.serv_solidcon && solidconConfig.bd_solidcon) {
                        try {
                            result = await ExternalDbService.updateReportRafaelCosts({
                                host: solidconConfig.serv_solidcon,
                                database: solidconConfig.bd_solidcon,
                                user: solidconConfig.login_solidcon || '',
                                password: solidconConfig.senha_solidcon || ''
                            }, {
                                cdProduto: String(cdProduto),
                                cdFilial: String(finalCdFilial || solidconConfig.cdfilial || ''),
                                startDate: startDate ? String(startDate) : undefined,
                                endDate: endDate ? String(endDate) : undefined,
                                custoUnitarioVenda: custoUnitarioVenda !== undefined ? Number(custoUnitarioVenda) : undefined,
                                custoUnitarioDia: custoUnitarioDia !== undefined ? Number(custoUnitarioDia) : undefined,
                                items: Array.isArray(items) ? items : undefined
                            }, false);

                            res.status(200).json({
                                status: 'success',
                                message: 'Custos atualizados com sucesso no banco Solidcon.',
                                data: result
                            });
                            return;
                        } catch (err: any) {
                            res.status(400).json({
                                status: 'error',
                                message: `Solidcon (${solidconConfig.name}): ${err.message || err}`
                            });
                            return;
                        }
                    }
                } else {
                    const cleanId = parseInt(connStr, 10);
                    if (!isNaN(cleanId)) {
                        const { DorsalConfigService } = await import('../services/dorsalConfigService');
                        const dorsalConfig = await DorsalConfigService.getById(cleanId, company.id);
                        if (dorsalConfig && dorsalConfig.serv_dorsal && dorsalConfig.bd_dorsal) {
                            try {
                                result = await ExternalDbService.updateReportRafaelCosts({
                                    host: dorsalConfig.serv_dorsal,
                                    database: dorsalConfig.bd_dorsal,
                                    user: dorsalConfig.login_dorsal || '',
                                    password: dorsalConfig.senha_dorsal || ''
                                }, {
                                    cdProduto: String(cdProduto),
                                    cdFilial: String(finalCdFilial || dorsalConfig.cdfilial || ''),
                                    startDate: startDate ? String(startDate) : undefined,
                                    endDate: endDate ? String(endDate) : undefined,
                                    custoUnitarioVenda: custoUnitarioVenda !== undefined ? Number(custoUnitarioVenda) : undefined,
                                    custoUnitarioDia: custoUnitarioDia !== undefined ? Number(custoUnitarioDia) : undefined,
                                    items: Array.isArray(items) ? items : undefined
                                }, true);

                                res.status(200).json({
                                    status: 'success',
                                    message: 'Custos atualizados com sucesso no banco Dorsal.',
                                    data: result
                                });
                                return;
                            } catch (err: any) {
                                res.status(400).json({
                                    status: 'error',
                                    message: `Dorsal (${dorsalConfig.name}): ${err.message || err}`
                                });
                                return;
                            }
                        }
                    }
                }
            }

            // 2. Check registered Dorsal connections
            const { DorsalConfigService } = await import('../services/dorsalConfigService');
            const dorsalConfigs = await DorsalConfigService.list(company.id);
            const targetDorsalConfig = dorsalConfigs.find(c => c.is_default) || dorsalConfigs[0];

            if (targetDorsalConfig && targetDorsalConfig.serv_dorsal && targetDorsalConfig.bd_dorsal) {
                try {
                    result = await ExternalDbService.updateReportRafaelCosts({
                        host: targetDorsalConfig.serv_dorsal,
                        database: targetDorsalConfig.bd_dorsal,
                        user: targetDorsalConfig.login_dorsal || '',
                        password: targetDorsalConfig.senha_dorsal || ''
                    }, {
                        cdProduto: String(cdProduto),
                        cdFilial: String(finalCdFilial || targetDorsalConfig.cdfilial || ''),
                        startDate: startDate ? String(startDate) : undefined,
                        endDate: endDate ? String(endDate) : undefined,
                        custoUnitarioVenda: custoUnitarioVenda !== undefined ? Number(custoUnitarioVenda) : undefined,
                        custoUnitarioDia: custoUnitarioDia !== undefined ? Number(custoUnitarioDia) : undefined,
                        items: Array.isArray(items) ? items : undefined
                    }, true);

                    res.status(200).json({
                        status: 'success',
                        message: 'Custos atualizados com sucesso no banco Dorsal.',
                        data: result
                    });
                    return;
                } catch (err: any) {
                    errorMsg += `Dorsal (${targetDorsalConfig.name}): ${err.message || err}. `;
                }
            }

            // 3. Check registered Solidcon connections
            const { SolidconConfigService } = await import('../services/solidconConfigService');
            const solidconConfigs = await SolidconConfigService.list(company.id);
            const targetSolidconConfig = solidconConfigs.find(c => c.is_default) || solidconConfigs[0];

            if (targetSolidconConfig && targetSolidconConfig.serv_solidcon && targetSolidconConfig.bd_solidcon) {
                try {
                    result = await ExternalDbService.updateReportRafaelCosts({
                        host: targetSolidconConfig.serv_solidcon,
                        database: targetSolidconConfig.bd_solidcon,
                        user: targetSolidconConfig.login_solidcon || '',
                        password: targetSolidconConfig.senha_solidcon || ''
                    }, {
                        cdProduto: String(cdProduto),
                        cdFilial: String(finalCdFilial || targetSolidconConfig.cdfilial || ''),
                        startDate: startDate ? String(startDate) : undefined,
                        endDate: endDate ? String(endDate) : undefined,
                        custoUnitarioVenda: custoUnitarioVenda !== undefined ? Number(custoUnitarioVenda) : undefined,
                        custoUnitarioDia: custoUnitarioDia !== undefined ? Number(custoUnitarioDia) : undefined,
                        items: Array.isArray(items) ? items : undefined
                    }, false);

                    res.status(200).json({
                        status: 'success',
                        message: 'Custos atualizados com sucesso no banco Solidcon.',
                        data: result
                    });
                    return;
                } catch (err: any) {
                    errorMsg += `Solidcon (${targetSolidconConfig.name}): ${err.message || err}. `;
                }
            }

            // 4. Legacy company fields fallback
            if (company.serv_dorsal && company.bd_dorsal) {
                try {
                    result = await ExternalDbService.updateReportRafaelCosts({
                        host: company.serv_dorsal,
                        database: company.bd_dorsal,
                        user: company.login_dorsal || '',
                        password: decrypt(company.senha_dorsal) || company.senha_dorsal || ''
                    }, {
                        cdProduto: String(cdProduto),
                        cdFilial: finalCdFilial,
                        startDate: startDate ? String(startDate) : undefined,
                        endDate: endDate ? String(endDate) : undefined,
                        custoUnitarioVenda: custoUnitarioVenda !== undefined ? Number(custoUnitarioVenda) : undefined,
                        custoUnitarioDia: custoUnitarioDia !== undefined ? Number(custoUnitarioDia) : undefined,
                        items: Array.isArray(items) ? items : undefined
                    }, true);

                    res.status(200).json({
                        status: 'success',
                        message: 'Custos atualizados com sucesso no banco Dorsal.',
                        data: result
                    });
                    return;
                } catch (err: any) {
                    errorMsg += `Dorsal: ${err.message || err}. `;
                }
            } else if (company.serv_solidcon && company.bd_solidcon) {
                try {
                    result = await ExternalDbService.updateReportRafaelCosts({
                        host: company.serv_solidcon,
                        database: company.bd_solidcon,
                        user: company.login_solidcon || '',
                        password: decrypt(company.senha_solidcon) || company.senha_solidcon || ''
                    }, {
                        cdProduto: String(cdProduto),
                        cdFilial: finalCdFilial,
                        startDate: startDate ? String(startDate) : undefined,
                        endDate: endDate ? String(endDate) : undefined,
                        custoUnitarioVenda: custoUnitarioVenda !== undefined ? Number(custoUnitarioVenda) : undefined,
                        custoUnitarioDia: custoUnitarioDia !== undefined ? Number(custoUnitarioDia) : undefined,
                        items: Array.isArray(items) ? items : undefined
                    }, false);

                    res.status(200).json({
                        status: 'success',
                        message: 'Custos atualizados com sucesso no banco Solidcon.',
                        data: result
                    });
                    return;
                } catch (err: any) {
                    errorMsg += `Solidcon: ${err.message || err}. `;
                }
            }

            res.status(400).json({
                status: 'error',
                message: errorMsg || 'Configurações de conexão externa não encontradas para atualizar os custos.'
            });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error?.message || 'Erro interno ao atualizar os custos no banco de dados externo.' });
        }
    }

    static async getReportPedidosDorsal(req: Request, res: Response): Promise<void> {
        try {
            const { startDate, endDate, cdFilial, inCancelado, connectionId, dorsalConnectionId, targetCompanyId, companyId, company_id } = req.query;
            if (!startDate || !endDate) {
                res.status(400).json({ status: 'error', message: 'Parâmetros startDate e endDate são obrigatórios.' });
                return;
            }

            const company = await FinanceController.resolveReportCompany(req, targetCompanyId || companyId || company_id);
            if (!company) {
                res.status(404).json({ status: 'error', message: 'Empresa não encontrada ou acesso negado.' });
                return;
            }

            const { DorsalConfigService } = await import('../services/dorsalConfigService');
            const targetId = dorsalConnectionId || connectionId;
            let targetDorsalConfig = null;
            if (targetId) {
                targetDorsalConfig = await DorsalConfigService.getById(Number(targetId), company.id);
            }
            if (!targetDorsalConfig) {
                const dorsalConfigs = await DorsalConfigService.list(company.id);
                targetDorsalConfig = dorsalConfigs.find(c => c.is_default) || dorsalConfigs[0] || null;
            }

            const server = targetDorsalConfig?.serv_dorsal || company.serv_dorsal;
            const database = targetDorsalConfig?.bd_dorsal || company.bd_dorsal;
            const user = targetDorsalConfig?.login_dorsal || company.login_dorsal;
            const password = targetDorsalConfig?.senha_dorsal || company.senha_dorsal;

            if (!server || !database) {
                res.status(400).json({ status: 'error', message: 'Configurações de conexão do banco Dorsal não encontradas no cadastro da empresa.' });
                return;
            }

            const configCdFilial = targetDorsalConfig?.cdfilial || company.cdfilial;
            const finalCdFilial = cdFilial ? String(cdFilial).trim() : (configCdFilial ? String(configCdFilial).trim() : undefined);
            const { ExternalDbService } = await import('../services/externalDbService');

            const rows = await ExternalDbService.getReportPedidosDorsal({
                host: server,
                database: database,
                user: user || '',
                password: password || ''
            }, String(startDate), String(endDate), finalCdFilial, inCancelado ? String(inCancelado) : undefined);

            res.status(200).json({
                status: 'success',
                data: rows
            });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error?.message || 'Erro interno ao processar o relatório de pedidos Dorsal.' });
        }
    }

    static async getReportPedidoDorsalItems(req: Request, res: Response): Promise<void> {
        try {
            const { cdPedido, cdFilial, connectionId, dorsalConnectionId, targetCompanyId, companyId, company_id } = req.query;
            if (!cdPedido) {
                res.status(400).json({ status: 'error', message: 'Parâmetro cdPedido é obrigatório.' });
                return;
            }

            const company = await FinanceController.resolveReportCompany(req, targetCompanyId || companyId || company_id);
            if (!company) {
                res.status(404).json({ status: 'error', message: 'Empresa não encontrada ou acesso negado.' });
                return;
            }

            const { DorsalConfigService } = await import('../services/dorsalConfigService');
            const targetId = dorsalConnectionId || connectionId;
            let targetDorsalConfig = null;
            if (targetId) {
                targetDorsalConfig = await DorsalConfigService.getById(Number(targetId), company.id);
            }
            if (!targetDorsalConfig) {
                const dorsalConfigs = await DorsalConfigService.list(company.id);
                targetDorsalConfig = dorsalConfigs.find(c => c.is_default) || dorsalConfigs[0] || null;
            }

            const server = targetDorsalConfig?.serv_dorsal || company.serv_dorsal;
            const database = targetDorsalConfig?.bd_dorsal || company.bd_dorsal;
            const user = targetDorsalConfig?.login_dorsal || company.login_dorsal;
            const password = targetDorsalConfig?.senha_dorsal || company.senha_dorsal;

            if (!server || !database) {
                res.status(400).json({ status: 'error', message: 'Configurações de conexão do banco Dorsal não encontradas no cadastro da empresa.' });
                return;
            }

            const configCdFilial = targetDorsalConfig?.cdfilial || company.cdfilial;
            const finalCdFilial = cdFilial ? String(cdFilial).trim() : (configCdFilial ? String(configCdFilial).trim() : undefined);
            const { ExternalDbService } = await import('../services/externalDbService');

            const rows = await ExternalDbService.getReportPedidoDorsalItems({
                host: server,
                database: database,
                user: user || '',
                password: password || ''
            }, String(cdPedido), finalCdFilial);

            res.status(200).json({
                status: 'success',
                data: rows
            });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error?.message || 'Erro interno ao consultar itens do pedido.' });
        }
    }

    static async buscarReceitaSolidcon(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const queryParams: any = req.method === 'GET' ? req.query : req.body;
            const documento = queryParams.documento || queryParams.cupom || queryParams.nrCupom || undefined;
            const cdConta = queryParams.cdConta ? parseInt(String(queryParams.cdConta), 10) : undefined;
            const cdContaBaixa = queryParams.cdContaBaixa ? parseInt(String(queryParams.cdContaBaixa), 10) : undefined;
            const cdBancoContaMovimento = queryParams.cdBancoContaMovimento || queryParams.solidcon_interest_key ? parseInt(String(queryParams.cdBancoContaMovimento || queryParams.solidcon_interest_key), 10) : undefined;
            const startDate = typeof queryParams.startDate === 'string' ? queryParams.startDate : undefined;
            const endDate = typeof queryParams.endDate === 'string' ? queryParams.endDate : undefined;
            const cdFilial = typeof queryParams.cdFilial === 'string' ? queryParams.cdFilial : undefined;

            const results = await FinanceService.buscarReceitaSolidcon(companyId, {
                documento: documento ? String(documento) : undefined,
                cdConta,
                cdContaBaixa,
                cdBancoContaMovimento,
                startDate,
                endDate,
                cdFilial
            });

            res.status(200).json({
                status: 'success',
                data: results
            });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Erro ao buscar receita no Solidcon' });
        }
    }

    static async syncAllSolidconInterestRevenues(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const result = await FinanceService.sincronizarTodosLancamentosJurosSolidcon(companyId);
            res.status(200).json({
                status: 'success',
                message: `${result.updated} receita(s) de juros sincronizadas no Solidcon.`,
                data: result
            });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Erro ao sincronizar receitas de juros no Solidcon' });
        }
    }

    static async syncAllRevenues(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const userId = req.user!.id;
            const { startDate, endDate } = req.body || {};

            const result = await FinanceService.syncAllRevenuesAndSolidcon(companyId, userId, {
                startDate: startDate ? String(startDate) : undefined,
                endDate: endDate ? String(endDate) : undefined
            });

            res.status(200).json({
                status: 'success',
                message: result.message,
                data: result
            });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error?.message || 'Erro ao executar sincronização geral.' });
        }
    }

    static async getRevenueSolidconDetails(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const revenueId = req.params.id;
            if (!revenueId) {
                res.status(400).json({ status: 'error', message: 'ID da receita é obrigatório.' });
                return;
            }
            const details = await FinanceService.getRevenueSolidconDetails(companyId, revenueId);
            res.status(200).json({
                status: 'success',
                data: details
            });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Erro ao consultar detalhes do Solidcon.' });
        }
    }

    static async fixRevenueSolidconDuplicates(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const revenueId = req.params.id;
            if (!revenueId) {
                res.status(400).json({ status: 'error', message: 'ID da receita é obrigatório.' });
                return;
            }
            const result = await FinanceService.fixRevenueSolidconDuplicates(companyId, revenueId);
            res.status(200).json({
                status: 'success',
                message: result.message,
                data: result
            });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Erro ao corrigir duplicidades no Solidcon.' });
        }
    }

    static async cancelRevenueSolidconBaixa(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const revenueId = req.params.id;
            if (!revenueId) {
                res.status(400).json({ status: 'error', message: 'ID da receita é obrigatório.' });
                return;
            }
            const { cd_conta_baixa, cdContaBaixa, reopen_revenue, reopenRevenue, cancel_cupom_payment, cancelCupomPayment } = req.body || {};
            const result = await FinanceService.cancelRevenueSolidconBaixa(companyId, revenueId, {
                cdContaBaixa: cd_conta_baixa || cdContaBaixa,
                reopenRevenue: reopen_revenue !== undefined ? reopen_revenue : (reopenRevenue !== undefined ? reopenRevenue : true),
                cancelCupomPayment: cancel_cupom_payment !== undefined ? cancel_cupom_payment : (cancelCupomPayment !== undefined ? cancelCupomPayment : true)
            });
            res.status(200).json({
                status: 'success',
                message: result.message,
                data: result.data,
                updatedInspection: result.updatedInspection
            });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Erro ao cancelar baixa no Solidcon.' });
        }
    }

    static async tieRevenueSolidconMovement(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const revenueId = req.params.id;
            if (!revenueId) {
                res.status(400).json({ status: 'error', message: 'ID da receita é obrigatório.' });
                return;
            }
            const result = await FinanceService.tieRevenueSolidconMovement(companyId, revenueId);
            res.status(200).json({
                status: 'success',
                message: result.message,
                data: result
            });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Erro ao amarrar movimento bancário no Solidcon.' });
        }
    }

    static async scanUntiedSolidconMovements(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const options: { source?: string | undefined; limit?: number | undefined; cdFilial?: string | number | undefined } = {};
            if (req.query.source) options.source = String(req.query.source);
            if (req.query.limit) options.limit = parseInt(String(req.query.limit), 10);
            if (req.query.cdFilial) options.cdFilial = String(req.query.cdFilial);
            const result = await FinanceService.scanUntiedMovements(companyId, options);
            res.status(200).json({
                status: 'success',
                data: result
            });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Erro ao escanear movimentos sem amarração no Solidcon.' });
        }
    }

    static async tieAllUntiedSolidconMovements(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const options: { source?: string | undefined; limit?: number | undefined; cdFilial?: string | number | undefined; specificIds?: (string | number)[] | undefined } = {};
            if (req.body.source) options.source = String(req.body.source);
            if (req.body.limit) options.limit = parseInt(String(req.body.limit), 10);
            if (req.body.cdFilial) options.cdFilial = String(req.body.cdFilial);
            if (Array.isArray(req.body.specificIds)) {
                options.specificIds = req.body.specificIds;
            } else if (Array.isArray(req.body.movementIds)) {
                options.specificIds = req.body.movementIds.map(Number);
            }
            const result = await FinanceService.tieAllUntiedMovements(companyId, options);
            res.status(200).json({
                status: 'success',
                message: `Processamento concluído: ${result.totalTied} amarrados com sucesso, ${result.alreadyTied} já amarrados, ${result.errorsCount} erros.`,
                data: result
            });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Erro ao amarrar movimentos em lote no Solidcon.' });
        }
    }

    static async getExpenseSolidconDetails(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const expenseId = req.params.id;
            if (!expenseId) {
                res.status(400).json({ status: 'error', message: 'ID da despesa é obrigatório.' });
                return;
            }
            const details = await FinanceService.getExpenseSolidconDetails(companyId, expenseId);
            res.status(200).json({
                status: 'success',
                data: details
            });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Erro ao consultar detalhes da despesa no Solidcon.' });
        }
    }

    static async fixExpenseSolidconDuplicates(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const expenseId = req.params.id;
            if (!expenseId) {
                res.status(400).json({ status: 'error', message: 'ID da despesa é obrigatório.' });
                return;
            }
            const result = await FinanceService.fixExpenseSolidconDuplicates(companyId, expenseId);
            res.status(200).json({
                status: 'success',
                message: result.message,
                data: result
            });
        } catch (error: any) {
            if (error instanceof Error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: 'Erro ao corrigir duplicidades de despesas no Solidcon.' });
        }
    }

    static async getSolidconFinanceVision(req: Request, res: Response): Promise<void> {
        try {
            const requestedCompany = req.query.targetCompanyId || req.query.companyId || req.query.company_id || req.query.company;
            const company = await FinanceController.resolveReportCompany(req, requestedCompany);
            if (!company) {
                res.status(401).json({ status: 'error', message: 'Empresa não identificada ou sem acesso.' });
                return;
            }

            const { ano, mes, cdFilial, source, connectionId, convDateFilter } = req.query;

            const { SolidconConfigService } = await import('../services/solidconConfigService');
            let solidconConfig: any = null;
            if (connectionId) {
                const cleanId = parseInt(String(connectionId).replace('solidcon_', ''), 10);
                if (!isNaN(cleanId)) {
                    solidconConfig = await SolidconConfigService.getById(cleanId, company.id);
                }
            }

            if (!solidconConfig) {
                const configs = await SolidconConfigService.list(company.id);
                solidconConfig = configs.find((c: any) => c.is_default) || configs[0] || null;
            }

            if (!solidconConfig) {
                const [compRows]: any = await pool.query('SELECT serv_solidcon, bd_solidcon, login_solidcon, senha_solidcon, trade_name, company_name FROM companies WHERE id = ?', [company.id]);
                const comp = compRows?.[0];
                if (comp && comp.serv_solidcon) {
                    solidconConfig = {
                        name: comp.trade_name || comp.company_name || 'Padrão da Empresa',
                        serv_solidcon: comp.serv_solidcon,
                        bd_solidcon: comp.bd_solidcon || 'solidcon',
                        login_solidcon: comp.login_solidcon,
                        senha_solidcon: decrypt(comp.senha_solidcon) || comp.senha_solidcon
                    };
                }
            }

            if (!solidconConfig || !solidconConfig.serv_solidcon || !solidconConfig.serv_solidcon.trim()) {
                const compName = company.trade_name || company.company_name || `Empresa #${company.id}`;
                res.status(400).json({
                    status: 'error',
                    message: `A empresa "${compName}" não possui servidor Solidcon configurado. Configure em Empresas > Conexão Solidcon.`
                });
                return;
            }

            const host = (solidconConfig.serv_solidcon || '').trim();
            const database = (solidconConfig.bd_solidcon || 'solidcon').trim();
            const user = (solidconConfig.login_solidcon || 'aporttec').trim();
            const password = (solidconConfig.senha_solidcon ? (decrypt(solidconConfig.senha_solidcon) || solidconConfig.senha_solidcon) : '') || '';

            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth() + 1;

            const selectedAno = ano ? parseInt(String(ano), 10) : currentYear;
            const selectedMes = mes ? parseInt(String(mes), 10) : currentMonth;

            const data = await ExternalDbService.getSolidconFinanceVisionData(
                {
                    host: host,
                    database: database === 'dorsal' ? 'solidcon' : database,
                    user: user,
                    password: password
                },
                {
                    ano: isNaN(selectedAno) ? currentYear : selectedAno,
                    mes: isNaN(selectedMes) ? currentMonth : selectedMes,
                    cdFilial: cdFilial ? String(cdFilial) : null,
                    source: source ? String(source) : 'conta_baixa',
                    convDateFilter: convDateFilter ? String(convDateFilter) : 'baixa'
                }
            );

            res.status(200).json({
                status: 'success',
                data,
                company: {
                    id: company.id,
                    public_id: company.public_id,
                    trade_name: company.trade_name,
                    company_name: company.company_name
                },
                connection: {
                    id: solidconConfig?.id || null,
                    name: solidconConfig?.name || 'Solidcon Principal',
                    host: host,
                    database: database === 'dorsal' ? 'solidcon' : database
                }
            });
        } catch (error: any) {
            res.status(400).json({
                status: 'error',
                message: error?.message || 'Erro ao carregar Visão Financeira Solidcon.'
            });
        }
    }
}




