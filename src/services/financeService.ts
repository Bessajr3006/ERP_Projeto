import { randomUUID } from 'crypto';
import pool from '../config/db';
import { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { Category, CreateCategoryData, FinanceCategoryType, CreateFinanceCategoryTypeData } from '../types/Finance';
import { DashboardStatsSchema } from '../schemas/reportSchemas';
import { CacheService } from './cacheService';
import { toBrazilDate, toBrazilYearMonth, toBrazilDbDateTime } from '../utils/dateTime';
import { BankAccountService } from './bankAccountService';
import { CategorySchema, CategoryListSchema, TransactionListSchema, CategoryTypeSchema, CategoryTypeListSchema } from '../schemas/financeSchemas';
import { FinanceCategoryRepository } from '../repositories/financeCategoryRepository';
import { FinanceCategoryTypeRepository } from '../repositories/financeCategoryTypeRepository';
import { FinanceReportRepository } from '../repositories/financeReportRepository';
import { FinanceBankStatementRepository } from '../repositories/financeBankStatementRepository';
import { FinanceTransactionRepository } from '../repositories/financeTransactionRepository';
import { FinanceDocumentRepository } from '../repositories/financeDocumentRepository';
import QRCode from 'qrcode';
import puppeteer from 'puppeteer';
import { CompanyService } from './companyService';
import { WhatsAppBusinessService } from './whatsappBusinessService';
import { WhatsAppBusinessMessageService } from './whatsappBusinessMessageService';

export class FinanceService {
    /**
     * Creates a new financial category
     */
    static async createCategory(companyId: number, data: CreateCategoryData): Promise<Category> {
        const { name, type, finance_category_type_public_id } = data;
        const publicId = randomUUID();

        let financeCategoryTypeId: number | null = null;
        if (finance_category_type_public_id) {
            const types = await FinanceCategoryTypeRepository.getByPublicId(companyId, finance_category_type_public_id);
            if (types && types[0]) {
                financeCategoryTypeId = types[0].id;
            }
        }

        const insertId = await FinanceCategoryRepository.create(publicId, companyId, name, type, financeCategoryTypeId);
        if (!insertId) throw new Error('Failed to create category');

        return this.getCategoryById(insertId, companyId);
    }

    static async getCategoryById(id: number, companyId: number): Promise<Category> {
        const rows = await FinanceCategoryRepository.getById(companyId, id);
        if (!rows || rows.length === 0) throw new Error('Category not found');
        return CategorySchema.parse(rows[0]) as Category;
    }

    static async listCategories(companyId: number): Promise<Category[]> {
        const rows = await FinanceCategoryRepository.getAllByCompany(companyId);
        return CategoryListSchema.parse(rows) as Category[];
    }

    static async updateCategory(publicId: string, companyId: number, data: CreateCategoryData): Promise<Category> {
        const catRows = await FinanceCategoryRepository.getByPublicId(companyId, publicId);
        if (!catRows || catRows.length === 0 || !catRows[0]) throw new Error('Category not found');
        const categoryId = catRows[0].id;

        let financeCategoryTypeId: number | null = null;
        if (data.finance_category_type_public_id) {
            const types = await FinanceCategoryTypeRepository.getByPublicId(companyId, data.finance_category_type_public_id);
            if (types && types[0]) {
                financeCategoryTypeId = types[0].id;
            }
        }

        await FinanceCategoryRepository.update(companyId, categoryId, data.name, data.type, financeCategoryTypeId);

        return this.getCategoryById(categoryId, companyId);
    }

    static async deleteCategory(publicId: string, companyId: number): Promise<void> {
        const catRows = await FinanceCategoryRepository.getByPublicId(companyId, publicId);
        if (!catRows || catRows.length === 0 || !catRows[0]) throw new Error('Category not found');
        const categoryId = catRows[0].id;

        await FinanceCategoryRepository.delete(companyId, categoryId);
    }

    // --- Finance Category Types CRUD ---

    static async createCategoryType(companyId: number, data: CreateFinanceCategoryTypeData): Promise<FinanceCategoryType> {
        const { name, description } = data;
        const publicId = randomUUID();

        const insertId = await FinanceCategoryTypeRepository.create(publicId, companyId, name, description || null);
        if (!insertId) throw new Error('Failed to create category type');

        return this.getCategoryTypeById(insertId, companyId);
    }

    static async getCategoryTypeById(id: number, companyId: number): Promise<FinanceCategoryType> {
        const rows = await FinanceCategoryTypeRepository.getById(companyId, id);
        if (!rows || rows.length === 0) throw new Error('Category type not found');
        return CategoryTypeSchema.parse(rows[0]) as FinanceCategoryType;
    }

    static async getCategoryTypeByPublicId(publicId: string, companyId: number): Promise<FinanceCategoryType> {
        const rows = await FinanceCategoryTypeRepository.getByPublicId(companyId, publicId);
        if (!rows || rows.length === 0) throw new Error('Category type not found');
        return CategoryTypeSchema.parse(rows[0]) as FinanceCategoryType;
    }

    static async listCategoryTypes(companyId: number): Promise<FinanceCategoryType[]> {
        const rows = await FinanceCategoryTypeRepository.getAllByCompany(companyId);
        return CategoryTypeListSchema.parse(rows) as FinanceCategoryType[];
    }

    static async updateCategoryType(publicId: string, companyId: number, data: CreateFinanceCategoryTypeData): Promise<FinanceCategoryType> {
        const typeRows = await FinanceCategoryTypeRepository.getByPublicId(companyId, publicId);
        if (!typeRows || typeRows.length === 0 || !typeRows[0]) throw new Error('Category type not found');
        const typeId = typeRows[0].id;

        await FinanceCategoryTypeRepository.update(companyId, typeId, data.name, data.description || null);

        return this.getCategoryTypeById(typeId, companyId);
    }

    static async deleteCategoryType(publicId: string, companyId: number): Promise<void> {
        const typeRows = await FinanceCategoryTypeRepository.getByPublicId(companyId, publicId);
        if (!typeRows || typeRows.length === 0 || !typeRows[0]) throw new Error('Category type not found');
        const typeId = typeRows[0].id;

        await FinanceCategoryTypeRepository.delete(companyId, typeId);
    }

    private static async resolveEntityIds(
        conn: PoolConnection,
        companyId: number,
        entityType?: string | null | undefined,
        entityPublicId?: string | null | undefined
    ): Promise<{ customerId: number | null; supplierId: number | null; contactId: number | null; relatedUserId: number | null }> {
        let customerId: number | null = null;
        let supplierId: number | null = null;
        let contactId: number | null = null;
        let relatedUserId: number | null = null;

        if (entityType && entityPublicId) {
            if (entityType === 'customer') {
                const rows = await FinanceTransactionRepository.getCustomerByPublicId(conn, companyId, entityPublicId);
                if (!rows || rows.length === 0) throw new Error('Cliente não encontrado');
                customerId = rows[0]!.id;
            } else if (entityType === 'supplier') {
                const rows = await FinanceTransactionRepository.getSupplierByPublicId(conn, companyId, entityPublicId);
                if (!rows || rows.length === 0) throw new Error('Fornecedor não encontrado');
                supplierId = rows[0]!.id;
            } else if (entityType === 'contact') {
                const rows = await FinanceTransactionRepository.getContactByPublicId(conn, companyId, entityPublicId);
                if (!rows || rows.length === 0) throw new Error('Contato não encontrado');
                contactId = rows[0]!.id;
            } else if (['seller', 'buyer', 'service_provider', 'accountant'].includes(entityType)) {
                const rows = await FinanceTransactionRepository.getUserByPublicIdAndCompany(conn, companyId, entityPublicId);
                if (!rows || rows.length === 0) throw new Error('Pessoa não encontrada');
                relatedUserId = rows[0]!.id;
            }
        }
        return { customerId, supplierId, contactId, relatedUserId };
    }

    /**
     * Creates an expense transaction and updates bank account balance
     */
    static async createExpense(
        companyId: number,
        userId: string,
        data: { description: string; amount: number; date: string; category_public_id: string; bank_account_public_id: string; payment_method?: string | undefined; status?: string | undefined; entity_type?: string | null | undefined; entity_public_id?: string | null | undefined }
    ): Promise<void> {
        await FinanceTransactionRepository.withTransaction(async (conn: PoolConnection) => {
            const catRows = await FinanceTransactionRepository.getCategoryByPublicId(conn, companyId, data.category_public_id);
            if (!catRows || catRows.length === 0 || !catRows[0]) throw new Error('Category not found');
            const categoryId = catRows[0].id;

            const bankRows = await FinanceTransactionRepository.getBankAccountByPublicId(conn, companyId, data.bank_account_public_id);
            if (!bankRows || bankRows.length === 0 || !bankRows[0]) throw new Error('Bank account not found');
            const bankAccountId = bankRows[0].id;

            const userRows = await FinanceTransactionRepository.getUserByPublicId(conn, userId);
            if (!userRows || userRows.length === 0 || !userRows[0]) throw new Error('User not found');
            const internalUserId = userRows[0].id;

            const { customerId, supplierId, contactId, relatedUserId } = await this.resolveEntityIds(conn, companyId, data.entity_type, data.entity_public_id);

            const transactionPublicId = randomUUID();
            const txStatus = data.status || 'paid';

            await FinanceTransactionRepository.insertTransaction(conn, {
                public_id: transactionPublicId,
                company_id: companyId,
                bank_account_id: bankAccountId,
                category_id: categoryId,
                customer_id: customerId,
                supplier_id: supplierId,
                contact_id: contactId,
                related_user_id: relatedUserId,
                user_id: internalUserId,
                description: data.description,
                amount: data.amount,
                type: 'expense',
                payment_method: data.payment_method,
                date: data.date,
                status: txStatus
            });

            if (txStatus === 'paid') {
                await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, bankAccountId, data.amount, true);
            }
        });
    }

    static async listExpenses(companyId: number): Promise<any[]> {
        const rows = await FinanceTransactionRepository.listTransactions(companyId, 'expense');
        return TransactionListSchema.parse(rows);
    }

    /**
     * Creates a revenue transaction and updates bank account balance
     */
    static async createRevenue(
        companyId: number,
        userId: string,
        data: { description: string; amount: number; date: string; received_at?: string | undefined; category_public_id: string; bank_account_public_id: string; customer_public_id?: string | undefined; payment_method?: string | undefined; status?: string | undefined; entity_type?: string | null | undefined; entity_public_id?: string | null | undefined }
    ): Promise<void> {
        await FinanceTransactionRepository.withTransaction(async (conn: PoolConnection) => {
            const catRows = await FinanceTransactionRepository.getCategoryByPublicId(conn, companyId, data.category_public_id, 'income');
            if (!catRows || catRows.length === 0 || !catRows[0]) throw new Error('Category not found or invalid type');
            const categoryId = catRows[0].id;

            const bankRows = await FinanceTransactionRepository.getBankAccountByPublicId(conn, companyId, data.bank_account_public_id);
            if (!bankRows || bankRows.length === 0 || !bankRows[0]) throw new Error('Bank account not found');
            const bankAccountId = bankRows[0].id;

            let customerId: number | null = null;
            let supplierId: number | null = null;
            let contactId: number | null = null;
            let relatedUserId: number | null = null;

            if (data.entity_type && data.entity_public_id) {
                const resolved = await this.resolveEntityIds(conn, companyId, data.entity_type, data.entity_public_id);
                customerId = resolved.customerId;
                supplierId = resolved.supplierId;
                contactId = resolved.contactId;
                relatedUserId = resolved.relatedUserId;
            } else if (data.customer_public_id) {
                const custRows = await FinanceTransactionRepository.getCustomerByPublicId(conn, companyId, data.customer_public_id);
                if (!custRows || custRows.length === 0 || !custRows[0]) throw new Error('Customer not found');
                customerId = custRows[0].id;
            }

            const userRows = await FinanceTransactionRepository.getUserByPublicId(conn, userId);
            if (!userRows || userRows.length === 0 || !userRows[0]) throw new Error('User not found');
            const internalUserId = userRows[0].id;

            const transactionPublicId = randomUUID();
            const txStatus = data.status || 'paid';
            const receivedAt = txStatus === 'paid'
                ? (data.received_at ? toBrazilDbDateTime(data.received_at) : toBrazilDbDateTime(new Date()))
                : null;

            await FinanceTransactionRepository.insertTransaction(conn, {
                public_id: transactionPublicId,
                company_id: companyId,
                bank_account_id: bankAccountId,
                category_id: categoryId,
                customer_id: customerId,
                supplier_id: supplierId,
                contact_id: contactId,
                related_user_id: relatedUserId,
                user_id: internalUserId,
                description: data.description,
                amount: data.amount,
                type: 'income',
                payment_method: data.payment_method,
                date: data.date,
                status: txStatus,
                received_at: receivedAt
            });

            if (txStatus === 'paid') {
                await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, bankAccountId, data.amount, false);
            }
        });
    }

    static async listRevenues(companyId: number): Promise<any[]> {
        const rows = await FinanceTransactionRepository.listTransactions(companyId, 'income');
        return TransactionListSchema.parse(rows);
    }

    static async updateExpense(
        companyId: number,
        publicId: string,
        data: { description: string; amount: number; date: string; category_public_id: string; bank_account_public_id: string; payment_method?: string | undefined; status?: string | undefined; entity_type?: string | null | undefined; entity_public_id?: string | null | undefined }
    ): Promise<void> {
        await FinanceTransactionRepository.withTransaction(async (conn: PoolConnection) => {
            // 1. Fetch old transaction
            const oldRows = await FinanceTransactionRepository.getTransactionByPublicId(conn, companyId, publicId, 'expense');
            if (!oldRows || oldRows.length === 0 || !oldRows[0]) throw new Error('Transaction not found');
            const oldTx = oldRows[0];

            // 2. Resolve new IDs
            const catRows = await FinanceTransactionRepository.getCategoryByPublicId(conn, companyId, data.category_public_id);
            if (!catRows || catRows.length === 0 || !catRows[0]) throw new Error('Category not found');
            const newCategoryId = catRows[0].id;

            const bankRows = await FinanceTransactionRepository.getBankAccountByPublicId(conn, companyId, data.bank_account_public_id);
            if (!bankRows || bankRows.length === 0 || !bankRows[0]) throw new Error('Bank account not found');
            const newBankAccountId = bankRows[0].id;

            const { customerId, supplierId, contactId, relatedUserId } = await this.resolveEntityIds(conn, companyId, data.entity_type, data.entity_public_id);

            // 3. Reverse old effect
            if (oldTx.status === 'paid') {
                // Reverse expense: add balance back
                await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, oldTx.bank_account_id, oldTx.amount, false);
            }

            const newStatus = data.status || 'paid';

            // 4. Update transaction
            await FinanceTransactionRepository.updateTransaction(conn, companyId, oldTx.id, {
                bank_account_id: newBankAccountId,
                category_id: newCategoryId,
                customer_id: customerId,
                supplier_id: supplierId,
                contact_id: contactId,
                related_user_id: relatedUserId,
                description: data.description,
                amount: data.amount,
                payment_method: data.payment_method,
                date: data.date,
                status: newStatus
            });

            // 5. Apply new effect
            if (newStatus === 'paid') {
                // Apply new expense: subtract balance
                await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, newBankAccountId, data.amount, true);
            }
        });
    }

    static async updateRevenue(
        companyId: number,
        publicId: string,
        data: { description: string; amount: number; date: string; received_at?: string | undefined; category_public_id: string; bank_account_public_id: string; customer_public_id?: string | undefined; payment_method?: string | undefined; status?: string | undefined; entity_type?: string | null | undefined; entity_public_id?: string | null | undefined }
    ): Promise<void> {
        await FinanceTransactionRepository.withTransaction(async (conn: PoolConnection) => {
            // 1. Fetch old transaction
            const oldRows = await FinanceTransactionRepository.getTransactionByPublicId(conn, companyId, publicId, 'income');
            if (!oldRows || oldRows.length === 0 || !oldRows[0]) throw new Error('Transaction not found');
            const oldTx = oldRows[0];

            // 2. Resolve new IDs
            const catRows = await FinanceTransactionRepository.getCategoryByPublicId(conn, companyId, data.category_public_id);
            if (!catRows || catRows.length === 0 || !catRows[0]) throw new Error('Category not found');
            const newCategoryId = catRows[0].id;

            const bankRows = await FinanceTransactionRepository.getBankAccountByPublicId(conn, companyId, data.bank_account_public_id);
            if (!bankRows || bankRows.length === 0 || !bankRows[0]) throw new Error('Bank account not found');
            const newBankAccountId = bankRows[0].id;

            let customerId: number | null = null;
            let supplierId: number | null = null;
            let contactId: number | null = null;
            let relatedUserId: number | null = null;

            if (data.entity_type && data.entity_public_id) {
                const resolved = await this.resolveEntityIds(conn, companyId, data.entity_type, data.entity_public_id);
                customerId = resolved.customerId;
                supplierId = resolved.supplierId;
                contactId = resolved.contactId;
                relatedUserId = resolved.relatedUserId;
            } else if (data.customer_public_id) {
                const custRows = await FinanceTransactionRepository.getCustomerByPublicId(conn, companyId, data.customer_public_id);
                if (!custRows || custRows.length === 0 || !custRows[0]) throw new Error('Customer not found');
                customerId = custRows[0].id;
            }

            // 3. Reverse old effect
            if (oldTx.status === 'paid') {
                // Reverse income: subtract balance back
                await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, oldTx.bank_account_id, oldTx.amount, true);
            }

            const newStatus = data.status || 'paid';
            const receivedAt = newStatus === 'paid'
                ? (data.received_at ? toBrazilDbDateTime(data.received_at) : (oldTx.received_at ? toBrazilDbDateTime(oldTx.received_at) : toBrazilDbDateTime(new Date())))
                : null;

            // 4. Update transaction
            await FinanceTransactionRepository.updateTransaction(conn, companyId, oldTx.id, {
                bank_account_id: newBankAccountId,
                category_id: newCategoryId,
                customer_id: customerId,
                supplier_id: supplierId,
                contact_id: contactId,
                related_user_id: relatedUserId,
                description: data.description,
                amount: data.amount,
                payment_method: data.payment_method,
                date: data.date,
                received_at: receivedAt,
                status: newStatus
            });

            // 5. Apply new effect
            if (newStatus === 'paid') {
                // Apply new income: add balance
                await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, newBankAccountId, data.amount, false);
            }
        });
    }

    static async deleteTransaction(publicId: string, companyId: number): Promise<void> {
        await FinanceTransactionRepository.withTransaction(async (conn: PoolConnection) => {
            const rows = await FinanceTransactionRepository.getTransactionByPublicId(conn, companyId, publicId);
            if (!rows || rows.length === 0 || !rows[0]) throw new Error('Transaction not found');
            const transaction = rows[0];

            if (transaction.type === 'expense' && transaction.status === 'paid') {
                throw new Error('Não é permitido excluir uma despesa que já foi paga. Altere o status para pendente antes de excluir.');
            }

            // Se a receita estiver amarrada a um lançamento de serviço ([SL:<public_id>]), não permitir exclusão.
            if (transaction.type === 'income') {
                const description = String(transaction.description || '');
                const match = description.match(/\[SL:([0-9a-fA-F-]{36})\]/);
                const serviceLaunchPublicId = match?.[1];

                if (serviceLaunchPublicId) {
                    const [launchRows] = await conn.query<RowDataPacket[]>(
                        `SELECT id
                         FROM service_launches
                         WHERE public_id = ?
                           AND company_id = ?
                         LIMIT 1`,
                        [serviceLaunchPublicId, companyId]
                    );

                    if (launchRows?.[0]) {
                        throw new Error('Não é permitido excluir a receita, existe lançamento de serviço amarrado.');
                    }
                }
            }

            await FinanceTransactionRepository.deleteTransaction(conn, companyId, transaction.id);
            if (transaction.status === 'paid') {
                if (transaction.type === 'expense') {
                    await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, transaction.bank_account_id, transaction.amount, false);
                } else if (transaction.type === 'income') {
                    await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, transaction.bank_account_id, transaction.amount, true);
                }
            }
        });
    }

    static async batchDeleteTransactions(publicIds: string[], companyId: number): Promise<{ success: number; errors: string[] }> {
        let success = 0;
        const errors: string[] = [];
        for (const publicId of publicIds) {
            try {
                await this.deleteTransaction(publicId, companyId);
                success++;
            } catch (err: any) {
                errors.push(`ID ${publicId.substring(0, 8)}: ${err.message}`);
            }
        }
        return { success, errors };
    }

    static async batchUpdateRevenues(
        companyId: number,
        ids: string[],
        data: { bank_account_public_id?: string | undefined; payment_method?: string | undefined; date?: string | undefined }
    ): Promise<{ success: number; errors: string[] }> {
        let success = 0;
        const errors: string[] = [];
        const uniqueIds = Array.from(new Set(ids));

        for (const publicId of uniqueIds) {
            try {
                await FinanceTransactionRepository.withTransaction(async (conn: PoolConnection) => {
                    // 1. Fetch old transaction
                    const oldRows = await FinanceTransactionRepository.getTransactionByPublicId(conn, companyId, publicId, 'income');
                    if (!oldRows || oldRows.length === 0 || !oldRows[0]) throw new Error('Transaction not found');
                    const oldTx = oldRows[0];

                    // 2. Resolve bank account
                    let newBankAccountId = oldTx.bank_account_id;
                    if (data.bank_account_public_id) {
                        const bankRows = await FinanceTransactionRepository.getBankAccountByPublicId(conn, companyId, data.bank_account_public_id);
                        if (!bankRows || bankRows.length === 0 || !bankRows[0]) throw new Error('Bank account not found');
                        newBankAccountId = bankRows[0].id;
                    }

                    // 3. Reconcile balance if transaction status is 'paid' and bank account changed
                    if (oldTx.status === 'paid' && newBankAccountId !== oldTx.bank_account_id) {
                        await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, oldTx.bank_account_id, oldTx.amount, true);
                        await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, newBankAccountId, oldTx.amount, false);
                    }

                    // 4. Update transaction status and fields
                    const paymentMethod = data.payment_method || oldTx.payment_method;
                    const dateValue = data.date || oldTx.date;

                    await FinanceTransactionRepository.updateTransaction(conn, companyId, oldTx.id, {
                        bank_account_id: newBankAccountId,
                        category_id: oldTx.category_id,
                        customer_id: oldTx.customer_id,
                        description: oldTx.description,
                        amount: oldTx.amount,
                        payment_method: paymentMethod,
                        date: dateValue,
                        received_at: oldTx.received_at,
                        status: oldTx.status
                    });
                });
                success++;
            } catch (err: any) {
                errors.push(`ID ${publicId.substring(0, 8)}: ${err.message}`);
            }
        }

        return { success, errors };
    }

    static async getDashboardAnalytics(companyId: number, bankAccountPublicId?: string): Promise<any> {
        const cacheKey = `dashboard_${companyId}_${bankAccountPublicId || 'all'}`;
        const cached = CacheService.get<any>(cacheKey);
        if (cached) return cached;
        const today = toBrazilDate(new Date());
        const data = await FinanceReportRepository.getDashboardAnalytics(companyId, today, bankAccountPublicId);
        const { totalBalance, totalProducts, totalCustomers, salesCount, salesAmount, totalPayables, totalReceivables, lowStockItems: lowStockRows, chartData: chartRows } = data;
        const monthsMap: Record<string, { income: number, expense: number }> = {};
        for (let i = 5; i >= 0; i--) {
            const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
            const mStr = toBrazilYearMonth(d); monthsMap[mStr] = { income: 0, expense: 0 };
        }
        chartRows.forEach((r: any) => {
            const m = r.month as string; if (!monthsMap[m]) monthsMap[m] = { income: 0, expense: 0 };
            if (r.type === 'income') monthsMap[m].income = Number(r.total); if (r.type === 'expense') monthsMap[m].expense = Number(r.total);
        });
        const chartLabels = Object.keys(monthsMap);
        const incomeSeries = chartLabels.map(m => monthsMap[m]!.income);
        const expenseSeries = chartLabels.map(m => monthsMap[m]!.expense);
        const ptBrLabels = chartLabels.map(m => {
            const parts = (m as string).split('-');
            const date = new Date(parseInt(parts[0]!), parseInt(parts[1]!) - 1, 1);
            return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(date).toUpperCase();
        });
        const result = DashboardStatsSchema.parse({
            total_balance: Number(totalBalance) || 0,
            total_products: Number(totalProducts) || 0,
            total_customers: Number(totalCustomers) || 0,
            sales_today_count: Number(salesCount) || 0,
            sales_today_amount: Number(salesAmount) || 0,
            total_payables: Number(totalPayables) || 0,
            total_receivables: Number(totalReceivables) || 0,
            low_stock: lowStockRows.map((r: any) => ({ name: String(r.name), current_stock: Number(r.current_stock), measure: r.measure || null })),
            chart: { labels: ptBrLabels, income: incomeSeries, expense: expenseSeries }
        });
        CacheService.set(cacheKey, result, 2);
        return result;
    }

    static async listRecentPaidRevenues(companyId: number, minutesAgo: number = 5): Promise<any[]> {
        return FinanceTransactionRepository.listRecentPaidRevenues(companyId, minutesAgo);
    }

    static async listBankStatements(companyId: number, bankAccountPublicId?: string): Promise<any[]> {
        return FinanceBankStatementRepository.listBankStatements(companyId, bankAccountPublicId);
    }

    static async reconcile(companyId: number, systemIds: string[], bankStatementIds: string[]): Promise<void> {
        await FinanceBankStatementRepository.withTransaction(async (conn) => {
            const txs = await FinanceBankStatementRepository.getTransactionsForReconciliation(conn, companyId, systemIds);
            const sysSum = txs.reduce((acc, t) => acc + (t.type === 'expense' ? -Number(t.amount) : Number(t.amount)), 0);
            const stmts = await FinanceBankStatementRepository.getStatementsForReconciliation(conn, companyId, bankStatementIds);
            const bankSum = stmts.reduce((acc, s) => acc + Number(s.amount), 0);
            if (Math.abs(sysSum - bankSum) > 0.01) throw new Error(`Divergência de valores (${sysSum} vs ${bankSum})`);
            const txIds = txs.map(t => t.id); const stmtIds = stmts.map(s => s.id);
            await FinanceBankStatementRepository.updateReconcile(conn, txIds, stmtIds, txIds[0]!);
        });
    }

    static async undoReconcile(companyId: number, bankStatementId: number): Promise<void> {
        const statements = await FinanceBankStatementRepository.getStatementsForReconciliation(pool, companyId, [String(bankStatementId)]);
        if (statements.length === 0) throw new Error('Não encontrado');
        const statement = statements[0]!;
        await FinanceBankStatementRepository.withTransaction(async (conn) => {
            await FinanceBankStatementRepository.undoReconcile(conn, statement.id, statement.reconciled_transaction_id);
        });
    }

    // PDF e Boleto Stubs para corrigir lints (devem ser implementados se necessários ou mantidos como stubs caso movidos)
    static async generateReceiptHTML(companyId: number, transactionPublicId: string): Promise<string> {
        const tx = await FinanceDocumentRepository.getTransactionForDocument(pool, companyId, transactionPublicId);
        if (!tx) throw new Error('Transaction not found');
        if (tx.type !== 'income') throw new Error('Receipt is available only for revenues');

        const escapeHtml = (value: unknown): string =>
            String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');

        const formatReceiptDate = (value: unknown): string => {
            if (!value) return '';
            const isoDate = toBrazilDate(value instanceof Date ? value : new Date(value as any));
            const [year, month, day] = isoDate.split('-');
            return year && month && day ? `${day}/${month}/${year}` : isoDate;
        };

        const formatBrazilDocument = (value: unknown): string => {
            const digits = String(value || '').replace(/\D/g, '');
            if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
            if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            return String(value || '-');
        };

        const transactionStatus = String(tx.status || '').toLowerCase();
        const effectiveStatus = transactionStatus !== 'paid' && String(tx.sale_status || '').toLowerCase() === 'progress'
            ? 'progress'
            : transactionStatus;
        const isPending = effectiveStatus === 'pending';
        const isProgress = effectiveStatus === 'progress';
        const isPixPayment = String(tx.payment_method || '').toLowerCase() === 'pix';
        const shouldShowPixSection = isPixPayment && (isPending || isProgress);
        const pixKey = String(tx.pix_key || '').trim();

        if (shouldShowPixSection && !pixKey) {
            throw new Error('PIX nao cadastrado para a conta bancaria desta receita');
        }

        const amount = Number(tx.amount) || 0;
        const amountFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
        const dateValue = formatReceiptDate(tx.date);
        const companyName = escapeHtml(tx.comp_name || 'Empresa');
        const companyDoc = escapeHtml(formatBrazilDocument(tx.comp_doc));
        const companyLogoBase64 = String(tx.comp_logo_base64 || '').trim();
        const companyLogoUrl = String(tx.comp_logo_url || '').trim();
        const companyLogoSrc = companyLogoBase64
            ? (companyLogoBase64.startsWith('data:') ? companyLogoBase64 : `data:image/jpeg;base64,${companyLogoBase64}`)
            : companyLogoUrl;
        const companyLogoHtml = companyLogoSrc
            ? `<img class="company-logo" src="${escapeHtml(companyLogoSrc)}" alt="Logo da empresa" />`
            : '';
        const customerName = escapeHtml(tx.cust_name || 'Nao informado');
        const customerDoc = escapeHtml(formatBrazilDocument(tx.cust_doc));
        const customerAddressObj = {
            street: tx.cust_street || '',
            number: tx.cust_num || '',
            neighborhood: tx.cust_neigh || '',
            city: tx.cust_city || '',
            state: tx.cust_uf || '',
            zip: tx.cust_zip || ''
        };
        const customerFullAddress = [
            customerAddressObj.street ? `${customerAddressObj.street}, ${customerAddressObj.number || 'S/N'}` : '',
            customerAddressObj.neighborhood,
            customerAddressObj.city ? `${customerAddressObj.city} - ${customerAddressObj.state}` : '',
            customerAddressObj.zip ? `CEP: ${customerAddressObj.zip.replace(/\D/g, '').replace(/^(\d{5})(\d{3})?.*$/, '$1-$2')}` : ''
        ].filter(Boolean).join(' | ');
        const customerAddressHtml = customerFullAddress ? escapeHtml(customerFullAddress) : 'Nao informado';
        const description = escapeHtml(tx.description || '-');
        const bankName = escapeHtml(tx.bank_name || 'Nao informado');
        const statusLabel = effectiveStatus === 'progress' ? 'Andamento' : (isPending ? 'Pendente' : 'Recebido');

        const companyPhone = tx.comp_phone ? escapeHtml(tx.comp_phone) : '';
        const companyPhoneHtml = companyPhone ? `<p class="subtitle">Telefone: ${companyPhone}</p>` : '';
        const customerPhone = tx.cust_phone ? escapeHtml(tx.cust_phone) : '';
        const customerPhoneHtml = customerPhone ? `<div class="label" style="margin-top:10px;">Telefone</div><div class="value">${customerPhone}</div>` : '';

        let qrDataUrl = '';
        let pixPayload = '';
        if (shouldShowPixSection) {
            pixPayload = FinanceService.buildPixPayload(pixKey, amount, tx.comp_name || 'Empresa', tx.comp_city || 'Cidade');
            qrDataUrl = await QRCode.toDataURL(pixPayload, { margin: 1, width: 240 });
        }

        const pixSection = shouldShowPixSection
            ? `
                <div class="section">
                    <div class="section-title">PIX para cobranca</div>
                    <div class="pix-grid">
                        <div>
                            <div class="label">Banco</div>
                            <div class="value">${bankName}</div>
                            <div class="label" style="margin-top:10px;">Codigo QR Code</div>
                            <div class="value mono" data-copy-value="${escapeHtml(pixPayload)}">${escapeHtml(pixPayload)}</div>
                        </div>
                        <div class="qr">
                            <img src="${qrDataUrl}" alt="QR Code PIX" />
                            <div class="label" style="margin-top:6px;">Escaneie para pagar</div>
                        </div>
                    </div>
                </div>
            `
            : '';

        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Recibo de Cobranca</title>
    <style>
        body { font-family: Arial, sans-serif; color: #111827; margin: 0; background: #f9fafb; }
        .page { max-width: 720px; margin: 24px auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 24px; }
        .header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 16px; }
        .company-info { display: flex; align-items: center; gap: 14px; min-width: 0; }
        .company-logo { width: 82px; height: 82px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px; background: #fff; flex: 0 0 auto; }
        .title { font-size: 18px; font-weight: 700; margin: 0 0 6px; }
        .subtitle { font-size: 12px; color: #6b7280; margin: 0; }
        .meta { text-align: right; font-size: 12px; color: #374151; }
        .label { font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.04em; }
        .value { font-size: 13px; font-weight: 600; color: #111827; margin-top: 3px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px; }
        .section { margin-top: 18px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
        .section-title { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 8px; }
        .amount { font-size: 20px; font-weight: 700; color: #047857; }
        .mono { font-family: "Courier New", monospace; word-break: break-all; }
        .pix-grid { display: grid; grid-template-columns: 1fr 240px; gap: 16px; align-items: center; }
        .qr { text-align: center; }
        .qr img { width: 220px; height: 220px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px; background: #fff; }
        @media print { body { background: #fff; } .page { border: none; box-shadow: none; margin: 0; border-radius: 0; } }
    </style>
</head>
<body>
    <div class="page">
        <div class="header">
            <div class="company-info">
                ${companyLogoHtml}
                <div>
                    <p class="title">Recibo de Cobranca</p>
                    <p class="subtitle">${companyName}</p>
                    <p class="subtitle">CNPJ: ${companyDoc}</p>
                    ${companyPhoneHtml}
                </div>
            </div>
            <div class="meta">
                <div>
                    <div class="label">Data</div>
                    <div class="value">${escapeHtml(dateValue)}</div>
                </div>
                <div style="margin-top: 8px;">
                    <div class="label">Status</div>
                    <div class="value">${statusLabel}</div>
                </div>
            </div>
        </div>

        <div class="grid">
            <div>
                <div class="label">Cliente</div>
                <div class="value">${customerName}</div>
                <div class="label" style="margin-top:10px;">CNPJ/CPF</div>
                <div class="value">${customerDoc}</div>
                ${customerPhoneHtml}
                <div class="label" style="margin-top:10px;">Endereço</div>
                <div class="value" style="font-weight: 500;">${customerAddressHtml}</div>
            </div>
            <div>
                <div class="label">Valor</div>
                <div class="amount">${amountFormatted}</div>
                <div style="border-top:1px solid #d1d5db; margin:12px 0;"></div>
                <div class="label">Descricao</div>
                <div class="value">${description}</div>
            </div>
        </div>

        ${pixSection}
    </div>
</body>
</html>`;
    }

    static buildPixPayload(key: string, amountValue: number, name: string, city: string): string {
        const sanitizeEmvField = (value: string, maxLength: number) => {
            const clean = value
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^A-Za-z0-9\s]/g, '')
                .trim();
            return clean.slice(0, maxLength) || 'NA';
        };

        const formatEmv = (id: string, value: string) => {
            const length = value.length.toString().padStart(2, '0');
            return `${id}${length}${value}`;
        };

        const payloadParts: string[] = [];
        payloadParts.push(formatEmv('00', '01'));
        const merchantAccount = [
            formatEmv('00', 'br.gov.bcb.pix'),
            formatEmv('01', key)
        ].join('');
        payloadParts.push(formatEmv('26', merchantAccount));
        payloadParts.push(formatEmv('52', '0000'));
        payloadParts.push(formatEmv('53', '986'));
        payloadParts.push(formatEmv('54', amountValue.toFixed(2)));
        payloadParts.push(formatEmv('58', 'BR'));
        payloadParts.push(formatEmv('59', sanitizeEmvField(name, 25)));
        payloadParts.push(formatEmv('60', sanitizeEmvField(city, 15)));
        const additional = formatEmv('05', '***');
        payloadParts.push(formatEmv('62', additional));
        const payloadNoCrc = payloadParts.join('') + '6304';
        let crc = 0xffff;
        for (let i = 0; i < payloadNoCrc.length; i++) {
            crc ^= payloadNoCrc.charCodeAt(i) << 8;
            for (let j = 0; j < 8; j++) {
                if (crc & 0x8000) {
                    crc = (crc << 1) ^ 0x1021;
                } else {
                    crc <<= 1;
                }
                crc &= 0xffff;
            }
        }
        const crcHex = crc.toString(16).toUpperCase().padStart(4, '0');
        return payloadNoCrc + crcHex;
    }

    static async generatePdfFromHtml(html: string): Promise<Buffer> {
        const launchOptions: any = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-zygote',
                '--single-process',
            ],
        };
        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        }
        const browser = await puppeteer.launch(launchOptions);
        try {
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });
            const pdfUint8 = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20px',
                    bottom: '20px',
                    left: '20px',
                    right: '20px',
                },
            });
            return Buffer.from(pdfUint8);
        } finally {
            await browser.close();
        }
    }

    static async sendWhatsApp(companyId: number, userId: number, id: string, phoneOverride?: string): Promise<any> {
        const tx = await FinanceDocumentRepository.getTransactionForDocument(pool, companyId, id);
        if (!tx) throw new Error('Receita não encontrada');
        if (tx.type !== 'income') throw new Error('WhatsApp de cobrança disponível apenas para receitas');

        const rawPhone = (phoneOverride || tx.cust_phone || '').trim();
        const normalizedPhone = WhatsAppBusinessMessageService.normalizeContactPhone(rawPhone);
        if (!normalizedPhone) {
            throw new Error('Telefone do cliente não cadastrado ou inválido. Por favor, atualize o cadastro ou informe um número.');
        }

        const amount = Number(tx.amount) || 0;
        const amountFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

        let pdfBase64 = '';
        let filename = '';
        let pixCode = '';
        let messageBody = '';

        if (tx.payment_method === 'boleto') {
            if (!tx.billet_url) {
                throw new Error('Boleto ainda não foi gerado no banco. Por favor, gere o boleto antes de enviar por WhatsApp.');
            }
            const billetRes = await FinanceService.getBoletoPdfBase64(companyId, id, tx.billet_url);
            pdfBase64 = billetRes.pdfBase64;
            filename = billetRes.filename;
            pixCode = tx.pix_code || '';

            messageBody = `Olá, *${tx.cust_name || 'Cliente'}*!\n\n` +
                `Segue em anexo o Boleto referente à cobrança *${tx.description || ''}* no valor de *${amountFormatted}*.\n\n` +
                (pixCode ? `*Pix Copia e Cola (boleto):*\n\`${pixCode}\`\n\n` : '') +
                (tx.barcode ? `*Código de Barras (boleto):*\n\`${tx.barcode}\`\n` : '');
        } else {
            const html = await FinanceService.generateReceiptHTML(companyId, id);
            const pdfBuffer = await FinanceService.generatePdfFromHtml(html);
            pdfBase64 = pdfBuffer.toString('base64');

            const safeName = String(tx.cust_name || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
            const safeDate = tx.date ? (tx.date instanceof Date ? tx.date.toISOString().slice(0, 10) : String(tx.date).slice(0, 10)) : 'Data';
            filename = `Recibo_${safeName}_${safeDate}.pdf`;

            const transactionStatus = String(tx.status || '').toLowerCase();
            const effectiveStatus = transactionStatus !== 'paid' && String(tx.sale_status || '').toLowerCase() === 'progress'
                ? 'progress'
                : transactionStatus;
            const isPending = effectiveStatus === 'pending';
            const isProgress = effectiveStatus === 'progress';
            const isPixPayment = String(tx.payment_method || '').toLowerCase() === 'pix';
            const shouldShowPixSection = isPixPayment && (isPending || isProgress);
            const pixKey = String(tx.pix_key || '').trim();

            if (shouldShowPixSection && pixKey) {
                pixCode = FinanceService.buildPixPayload(pixKey, amount, tx.comp_name || 'Empresa', tx.comp_city || 'Cidade');
            }

            messageBody = `Olá, *${tx.cust_name || 'Cliente'}*!\n\n` +
                `Segue em anexo o Recibo de Cobrança referente a *${tx.description || ''}* no valor de *${amountFormatted}*.\n\n` +
                (pixCode ? `*Pix Copia e Cola (pagamento):*\n\`${pixCode}\`\n` : '');
        }

        const company = await CompanyService.getById(companyId);
        const useCompanyScope = (company.whatsapp_business_scope || 'company') === 'company';

        const messageInput = {
            to: normalizedPhone,
            messageBody: messageBody.trim(),
            attachment: {
                base64: pdfBase64,
                mimeType: 'application/pdf',
                fileName: filename,
            },
        };

        if (useCompanyScope) {
            return await WhatsAppBusinessService.sendMessage(companyId, messageInput);
        } else {
            return await WhatsAppBusinessService.sendUserMessage(companyId, userId, messageInput);
        }
    }

    static async generateBillet(companyId: number, transactionPublicId: string): Promise<any> {
        const tx = await FinanceDocumentRepository.getTransactionForBillet(pool, companyId, transactionPublicId);
        if (!tx) throw new Error('Transação não encontrada');

        if (!tx.cust_doc) {
            throw new Error('Cliente sem CPF/CNPJ. Preencha o cadastro antes de emitir boleto.');
        }

        // Recuperar conta do Inter (temos que pegar do bank_accounts). Por enquanto pegamos a conta da transação.
        const bankAccount = await BankAccountService.getByPublicId(tx.bank_acc_public_id, companyId);
        const inst = String(bankAccount.institution || '').toLowerCase();

        if (inst.includes('inter')) {
            const { InterService } = await import('./bankAccountApi/interService');
            
            const customerData = {
                document: tx.cust_doc,
                name: tx.cust_name,
                address: tx.cust_street,
                address_number: tx.cust_num,
                neighborhood: tx.cust_neigh,
                city: tx.cust_city,
                state: tx.cust_uf,
                zip_code: tx.cust_zip
            };

            const result = await InterService.generateBoleto(bankAccount, tx, customerData);
            
            await FinanceDocumentRepository.updateBilletCode(pool, tx.id, result.codigoBarras, null, result.nossoNumero);
            
            return {
                nossoNumero: result.nossoNumero,
                linhaDigitavel: result.linhaDigitavel,
                codigoBarras: result.codigoBarras
            };
        }

        throw new Error('Geração de boleto ainda não suportada para este banco.');
    }

    static async getBoletoPdfBase64(companyId: number, id: string, nosso: string): Promise<{ pdfBase64: string, filename: string }> {
        const tx = await FinanceDocumentRepository.getTransactionForBillet(pool, companyId, id);
        if (!tx) throw new Error('Transação não encontrada');

        const bankAccount = await BankAccountService.getByPublicId(tx.bank_acc_public_id, companyId);
        const inst = String(bankAccount.institution || '').toLowerCase();

        let pdfBase64 = '';
        if (inst.includes('inter')) {
            const { InterService } = await import('./bankAccountApi/interService');
            pdfBase64 = await InterService.getBoletoPdfBase64(bankAccount, nosso);
        } else {
            throw new Error('Visualização de boleto ainda não suportada para este banco.');
        }

        const safeName = String(tx.cust_name || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
        let safeDate = 'Data';
        if (tx.date) {
            if (tx.date instanceof Date) {
                const tzOffset = tx.date.getTimezoneOffset() * 60000;
                safeDate = new Date(tx.date.getTime() - tzOffset).toISOString().slice(0, 10);
            } else {
                safeDate = String(tx.date).slice(0, 10);
            }
        }
        
        return { pdfBase64, filename: `Boleto_${safeName}_${safeDate}.pdf` };
    }
    static async batchGenerateBillets(_c: number, _i: string[]): Promise<any> { return {}; }
    static async batchCancelBillets(companyId: number, publicIds: string[]): Promise<any> {
        let successCount = 0;
        let errors = [];
        for (const pubId of publicIds) {
            try {
                const tx = await FinanceDocumentRepository.getTransactionForBillet(pool, companyId, pubId);
                if (!tx || !tx.billet_url) {
                    throw new Error('Transação não encontrada ou sem boleto gerado.');
                }
                const inst = String(tx.institution || '').toLowerCase();
                if (inst.includes('inter')) {
                    const { InterService } = await import('./bankAccountApi/interService');
                    const bankAccount = await BankAccountService.getByPublicId(tx.bank_acc_public_id, companyId);
                    await InterService.cancelBoleto(bankAccount, tx.billet_url);
                    await FinanceDocumentRepository.updateBilletCode(pool, tx.id, null, null, null);
                    successCount++;
                } else {
                    throw new Error('Banco não suportado para cancelamento.');
                }
            } catch (err: any) {
                errors.push(`Erro na receita ${pubId}: ${err.message}`);
            }
        }
        if (errors.length > 0) {
            throw new Error(`Cancelados: ${successCount}. Erros: ${errors.join(', ')}`);
        }
        return { success: true, count: successCount };
    }
    static async syncBankStatements(companyId: number, bankAccountPublicId: string, startDate: string, endDate: string): Promise<number> {
        // 1. Busca a conta específica
        const bankAccount = await BankAccountService.getByPublicId(bankAccountPublicId, companyId);
        
        if (!bankAccount.api_client_id || !bankAccount.api_client_secret) {
            throw new Error(`A conta ${bankAccount.name} não possui credenciais de API configuradas.`);
        }

        // 2. Identifica o fluxo pelo banco (Inter)
        const inst = String(bankAccount.institution || '').toLowerCase();
        
        if (inst.includes('inter')) {
            const { InterService } = await import('./bankAccountApi/interService');
            return InterService.syncStatements(companyId, bankAccount, startDate, endDate);
        }

        throw new Error(`Integração automática para o banco ${bankAccount.institution || 'Não Informado'} ainda não disponível.`);
    }

    static async syncBankStatementsOfx(_c: number, _b: string, _o: string): Promise<number> { return 0; }
    static async batchDeleteBankStatements(_c: number, _i: number[], _e: string, _p: string): Promise<void> {}

    static async importSolidconRevenues(
        companyId: number,
        userId: string,
        categoryPublicId: string | undefined,
        bankAccountPublicId: string | undefined,
        items: any[]
    ): Promise<{ created: number; updated: number; skipped: number; errors: Array<{ index: number; reason: string }> }> {
        const result = { created: 0, updated: 0, skipped: 0, errors: [] as Array<{ index: number; reason: string }> };

        const normalizeText = (value: any): string => String(value ?? '').trim();
        const parseNumber = (value: any): number | undefined => {
            if (value === null || value === undefined || value === '') return undefined;
            const normalized = String(value)
                .trim()
                .replace(/\s/g, '')
                .replace(/\.(?=\d{3}(\D|$))/g, '')
                .replace(',', '.');
            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? parsed : undefined;
        };
        const normalizeKey = (value: string): string => value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]/g, '')
            .toLowerCase();
        const pickValue = (payload: any, keys: string[]): any => {
            if (!payload || typeof payload !== 'object') return undefined;
            for (const key of keys) {
                if (payload && payload[key] !== undefined && payload[key] !== null && payload[key] !== '') {
                    return payload[key];
                }
            }
            const normalizedKeys = new Map(Object.keys(payload).map((key) => [normalizeKey(key), key]));
            for (const key of keys) {
                const actualKey = normalizedKeys.get(normalizeKey(key));
                if (actualKey && payload[actualKey] !== undefined && payload[actualKey] !== null && payload[actualKey] !== '') {
                    return payload[actualKey];
                }
            }
            return undefined;
        };

        const mapSolidconItem = (payload: any) => {
            const nrCupom = pickValue(payload, ['nrCupom', 'nrcupom', 'nrcupomcupom']);
            let description = normalizeText(pickValue(payload, ['descricao', 'description', 'obs', 'observacao', 'nome', 'name', 'titulo', 'title', 'historico', 'doc_origem', 'nr_documento'])) || 'Importação Solidcon';
            if (nrCupom) {
                description = `Cupom #${nrCupom} - ${description}`;
            }
            const amount = parseNumber(pickValue(payload, ['valor', 'amount', 'vl_documento', 'valor_liquido', 'vl_liquido', 'vl_original', 'valor_original', 'value', 'vlCrediario', 'vl_crediario']));
            if (amount === undefined || amount <= 0) return null;

            const dateRaw = pickValue(payload, ['data_vencimento', 'dt_vencimento', 'data', 'date', 'vencimento', 'dt_emissao', 'data_emissao', 'emissao']);
            let date = '';
            if (dateRaw) {
                try {
                    const parsedDate = new Date(dateRaw);
                    if (!isNaN(parsedDate.getTime())) {
                        date = parsedDate.toISOString().split('T')[0] || '';
                    }
                } catch {
                    // ignore
                }
            }
            if (!date) {
                date = new Date().toISOString().split('T')[0] || '';
            }

            const rawMethod = normalizeText(pickValue(payload, ['forma_pagamento', 'forma_pgto', 'meio_pagamento', 'payment_method', 'tipo_pagamento'])).toLowerCase();
            let payment_method: 'pix' | 'credit' | 'debit' | 'cash' | 'transfer' | 'boleto' | undefined = undefined;
            if (rawMethod.includes('pix')) payment_method = 'pix';
            else if (rawMethod.includes('credito') || rawMethod.includes('credit')) payment_method = 'credit';
            else if (rawMethod.includes('debito') || rawMethod.includes('debit')) payment_method = 'debit';
            else if (rawMethod.includes('dinheiro') || rawMethod.includes('cash')) payment_method = 'cash';
            else if (rawMethod.includes('transfer') || rawMethod.includes('ted') || rawMethod.includes('doc')) payment_method = 'transfer';
            else if (rawMethod.includes('boleto')) payment_method = 'boleto';

            const statusRaw = normalizeText(pickValue(payload, ['status', 'situacao', 'state'])).toLowerCase();
            const paidDateRaw = pickValue(payload, ['data_pagamento', 'dt_pagamento', 'data_baixa', 'dt_baixa', 'pago_em']);
            let status: 'pending' | 'progress' | 'paid' = 'pending';
            if (statusRaw.includes('pago') || statusRaw.includes('paid') || statusRaw.includes('recebido') || paidDateRaw) {
                status = 'paid';
            }

            const customerName = normalizeText(pickValue(payload, ['cliente', 'customer', 'nome_cliente', 'sacado', 'nome']));
            const customerDoc = String(pickValue(payload, ['cnpj', 'cpf', 'cnpj_cpf', 'documento', 'doc', 'cpf_cnpj', 'cdCrediario', 'cd_crediario']) || '').replace(/\D/g, '');

            return {
                description,
                amount,
                date,
                payment_method,
                status,
                customerName,
                customerDoc
            };
        };

        // Resolve global entities
        let categoryId: number;
        let bankAccountId: number;
        let internalUserId: number;

        try {
            let catPubId = categoryPublicId;
            if (!catPubId) {
                const [firstCat] = await pool.query<RowDataPacket[]>(
                    "SELECT public_id FROM categories WHERE company_id = ? AND type = 'income' ORDER BY id ASC LIMIT 1",
                    [companyId]
                );
                if (firstCat?.[0]) {
                    catPubId = firstCat[0].public_id;
                } else {
                    const defaultCatPubId = randomUUID();
                    await FinanceCategoryRepository.create(defaultCatPubId, companyId, 'Importações Solidcon', 'income');
                    catPubId = defaultCatPubId;
                }
            }

            const catRows = await FinanceCategoryRepository.getByPublicId(companyId, catPubId!);
            if (!catRows || catRows.length === 0 || !catRows[0]) throw new Error('Category not found');
            categoryId = catRows[0].id;

            let bankAccPubId = bankAccountPublicId;
            if (!bankAccPubId) {
                const [firstBank] = await pool.query<RowDataPacket[]>(
                    "SELECT public_id FROM bank_accounts WHERE company_id = ? ORDER BY id ASC LIMIT 1",
                    [companyId]
                );
                if (!firstBank?.[0]) {
                    throw new Error('Nenhuma conta bancaria cadastrada no sistema.');
                }
                bankAccPubId = firstBank[0].public_id;
            }

            const [bankRows] = await pool.query<RowDataPacket[]>(
                'SELECT id FROM bank_accounts WHERE public_id = ? AND company_id = ? LIMIT 1',
                [bankAccPubId, companyId]
            );
            if (!bankRows || bankRows.length === 0 || !bankRows[0]) throw new Error('Bank account not found');
            bankAccountId = bankRows[0].id;

            const [userRows] = await pool.query<RowDataPacket[]>(
                'SELECT id FROM users WHERE public_id = ? LIMIT 1',
                [userId]
            );
            if (!userRows || userRows.length === 0 || !userRows[0]) throw new Error('User not found');
            internalUserId = userRows[0].id;
        } catch (error: any) {
            throw new Error(`Erro ao inicializar parametros de importacao: ${error.message}`);
        }

        for (let index = 0; index < items.length; index += 1) {
            const item = items[index];
            try {
                const mapped = mapSolidconItem(item);
                if (!mapped) {
                    result.skipped += 1;
                    result.errors.push({ index, reason: 'Item sem descricao ou valor valido.' });
                    continue;
                }

                // Check duplicate
                const [existingRows] = await pool.query<RowDataPacket[]>(
                    `SELECT id FROM transactions 
                     WHERE company_id = ? 
                       AND type = 'income'
                       AND description = ? 
                       AND amount = ? 
                       AND date = ? 
                     LIMIT 1`,
                    [companyId, mapped.description, mapped.amount, mapped.date]
                );
                if (existingRows?.[0]) {
                    result.skipped += 1;
                    continue;
                }

                // Look up customer
                let customerId: number | null = null;
                if (mapped.customerDoc) {
                    const [custRows] = await pool.query<RowDataPacket[]>(
                        'SELECT id FROM customers WHERE company_id = ? AND cnpj_cpf = ? LIMIT 1',
                        [companyId, mapped.customerDoc]
                    );
                    if (custRows?.[0]) {
                        customerId = custRows[0].id;
                    }
                }
                if (!customerId && mapped.customerName) {
                    const [custRows] = await pool.query<RowDataPacket[]>(
                        'SELECT id FROM customers WHERE company_id = ? AND name = ? LIMIT 1',
                        [companyId, mapped.customerName]
                    );
                    if (custRows?.[0]) {
                        customerId = custRows[0].id;
                    }
                }

                await FinanceTransactionRepository.withTransaction(async (conn: PoolConnection) => {
                    const transactionPublicId = randomUUID();
                    await FinanceTransactionRepository.insertTransaction(conn, {
                        public_id: transactionPublicId,
                        company_id: companyId,
                        bank_account_id: bankAccountId,
                        category_id: categoryId,
                        customer_id: customerId,
                        user_id: internalUserId,
                        description: mapped.description,
                        amount: mapped.amount,
                        type: 'income',
                        payment_method: mapped.payment_method,
                        date: mapped.date,
                        status: mapped.status
                    });

                    if (mapped.status === 'paid') {
                        await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, bankAccountId, mapped.amount, false);
                    }
                });

                result.created += 1;
            } catch (error: any) {
                result.skipped += 1;
                result.errors.push({ index, reason: error?.message || 'Falha ao importar item.' });
            }
        }

        return result;
    }

    /**
     * Sincroniza o status de um boleto consultando diretamente a API do Banco Inter
     */
    static async syncBoletoStatus(companyId: number, transactionPublicId: string): Promise<string> {
        const tx = await FinanceDocumentRepository.getTransactionForBillet(pool, companyId, transactionPublicId);
        if (!tx) throw new Error('Transação não encontrada');
        if (tx.type !== 'income' || !tx.billet_url) {
            throw new Error('Transação não é um boleto válido ou emitido no banco');
        }

        const bankAccount = await BankAccountService.getByPublicId(tx.bank_acc_public_id, companyId);
        const { InterService } = await import('./bankAccountApi/interService');
        
        const situacao = await InterService.getBoletoStatus(bankAccount, tx.billet_url);
        
        if (situacao === 'PAGO' || situacao === 'RECEBIDO') {
            if (tx.status !== 'paid') {
                await FinanceTransactionRepository.withTransaction(async (conn) => {
                    await conn.query(
                        `UPDATE transactions SET status = 'paid', received_at = NOW(), updated_at = NOW() WHERE id = ?`,
                        [tx.id]
                    );
                    await conn.query(
                        `UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?`,
                        [tx.amount, tx.bank_account_id]
                    );
                });
            }
            return 'PAGO';
        }
        
        return situacao;
    }
}

