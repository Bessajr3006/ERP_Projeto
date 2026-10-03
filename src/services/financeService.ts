import { randomUUID } from 'crypto';
import sql from 'mssql';
import pool from '../config/db';
import logger from '../config/logger';
import { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { AppError } from '../errors/AppError';
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
import { FinanceCardStatementRepository } from '../repositories/financeCardStatementRepository';
import { FinanceTransactionRepository } from '../repositories/financeTransactionRepository';
import { FinanceDocumentRepository } from '../repositories/financeDocumentRepository';
import QRCode from 'qrcode';
import puppeteer from 'puppeteer';
import { CompanyService } from './companyService';
import { ExternalDbService } from './externalDbService';
import { WhatsAppBusinessService } from './whatsappBusinessService';
import { WhatsAppBusinessMessageService } from './whatsappBusinessMessageService';
import { decrypt } from '../utils/crypto';

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
            } else if (['seller', 'buyer', 'service_provider', 'accountant', 'socio'].includes(entityType)) {
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
        data: { description: string; amount: number; date: string; category_public_id: string; bank_account_public_id: string; payment_method?: string | null | undefined; status?: string | undefined; received_at?: string | null | undefined; entity_type?: string | null | undefined; entity_public_id?: string | null | undefined; cost_center_public_id?: string | null | undefined; barcode?: string | null | undefined; pix_code?: string | null | undefined; pix_key?: string | null | undefined }
    ): Promise<{ public_id: string }> {
        let createdTransactionPublicId: string | null = null;
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

            let costCenterId: number | null = null;
            if (data.cost_center_public_id) {
                const ccRows = await FinanceTransactionRepository.getCostCenterByPublicId(conn, companyId, data.cost_center_public_id);
                if (ccRows && ccRows.length > 0 && ccRows[0]) {
                    costCenterId = ccRows[0].id;
                }
            }

            const transactionPublicId = randomUUID();
            createdTransactionPublicId = transactionPublicId;
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
                cost_center_id: costCenterId,
                description: data.description,
                amount: data.amount,
                type: 'expense',
                payment_method: data.payment_method,
                date: data.date,
                status: txStatus,
                received_at: txStatus === 'paid'
                    ? (data.received_at ? toBrazilDbDateTime(data.received_at) : (data.date ? toBrazilDbDateTime(data.date) : toBrazilDbDateTime(new Date())))
                    : null,
                date_launch: toBrazilDbDateTime(data.date || new Date()),
                scheduled_at: txStatus === 'scheduled' ? new Date() : null,
                barcode: data.barcode,
                pix_code: data.pix_code,
                pix_key: data.pix_key
            });

            if (txStatus === 'paid') {
                await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, bankAccountId, data.amount, true);
            }
        });
        return { public_id: createdTransactionPublicId! };
    }

    static async listExpenses(companyId: number): Promise<any[]> {
        const rows = await FinanceTransactionRepository.listTransactions(companyId, 'expense');
        try {
            return TransactionListSchema.parse(rows);
        } catch (err: any) {
            logger.warn({ err: err?.errors || err }, '[FinanceService] Validation notice in listExpenses, returning rows');
            return rows;
        }
    }

    /**
     * Creates a revenue transaction and updates bank account balance
     */
    static async createRevenue(
        companyId: number,
        userId: string,
        data: { description: string; amount: number; original_amount?: number | null | undefined; fine?: number | null | undefined; interest?: number | null | undefined; date: string; date_launch?: string | null | undefined; received_at?: string | undefined; received_channel?: string | null | undefined; category_public_id: string; bank_account_public_id: string; customer_public_id?: string | undefined; payment_method?: string | null | undefined; card_brand_public_id?: string | null | undefined; card_configuration_public_id?: string | null | undefined; status?: string | undefined; entity_type?: string | null | undefined; entity_public_id?: string | null | undefined; cost_center_public_id?: string | null | undefined; pdv?: string | null | undefined; cdfilial?: string | null | undefined; solidcon_quitado?: number | boolean | null | undefined; solidcon_key?: string | null | undefined }
    ): Promise<{ public_id: string }> {
        let createdTransactionPublicId: string | null = null;
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

            let cardBrandId: number | null = null;
            if (data.card_brand_public_id) {
                const [brandRows] = await conn.query<any[]>(
                    'SELECT id FROM card_brands WHERE public_id = ? AND company_id = ? LIMIT 1',
                    [data.card_brand_public_id, companyId]
                );
                if (brandRows && brandRows.length > 0) {
                    cardBrandId = brandRows[0].id;
                }
            }

            let cardConfigurationId: number | null = null;
            if (data.card_configuration_public_id) {
                const [configIdRows] = await conn.query<any[]>(
                    'SELECT id FROM card_configurations WHERE public_id = ? AND company_id = ? LIMIT 1',
                    [data.card_configuration_public_id, companyId]
                );
                if (configIdRows && configIdRows.length > 0) {
                    cardConfigurationId = configIdRows[0].id;
                }
            }

            let costCenterId: number | null = null;
            if (data.cost_center_public_id) {
                const ccRows = await FinanceTransactionRepository.getCostCenterByPublicId(conn, companyId, data.cost_center_public_id);
                if (ccRows && ccRows.length > 0 && ccRows[0]) {
                    costCenterId = ccRows[0].id;
                }
            }

            // Calculate net_amount based on card configurations
            let netAmount = data.amount;
            if ((data.payment_method === 'credit' || data.payment_method === 'debit') && cardBrandId) {
                let configRows = [];
                if (cardConfigurationId) {
                    [configRows] = await conn.query<any[]>(
                        'SELECT tax_rate, service_fee FROM card_configurations WHERE id = ? AND company_id = ? LIMIT 1',
                        [cardConfigurationId, companyId]
                    );
                } else {
                    const dbPaymentType = data.payment_method === 'credit' ? 'credito' : (data.payment_method === 'debit' ? 'debito' : data.payment_method);
                    [configRows] = await conn.query<any[]>(
                        'SELECT tax_rate, service_fee FROM card_configurations WHERE card_brand_id = ? AND company_id = ? AND payment_type = ? LIMIT 1',
                        [cardBrandId, companyId, dbPaymentType]
                    );
                }
                if (configRows && configRows.length > 0) {
                    const taxRate = parseFloat(configRows[0].tax_rate) || 0;
                    const serviceFee = parseFloat(configRows[0].service_fee) || 0;
                    netAmount = data.amount - (data.amount * (taxRate / 100)) - serviceFee;
                    if (netAmount < 0) netAmount = 0;
                }
            }

            const transactionPublicId = randomUUID();
            createdTransactionPublicId = transactionPublicId;
            const txStatus = data.status || 'paid';

            if (txStatus === 'paid' && customerId) {
                const [custRows] = await conn.query<any[]>(
                    'SELECT only_solidcon_baixa, name FROM customers WHERE id = ? LIMIT 1',
                    [customerId]
                );
                if (custRows?.[0] && (custRows[0].only_solidcon_baixa === 1 || custRows[0].only_solidcon_baixa === true)) {
                    throw new Error('Este cliente está configurado para baixa exclusiva via Solidcon. Não é permitido criar receitas já baixadas no Keystone.');
                }
            }

            const receivedAt = txStatus === 'paid'
                ? (data.received_at ? toBrazilDbDateTime(data.received_at) : toBrazilDbDateTime(new Date()))
                : null;
            const fineVal = Number(data.fine !== undefined && data.fine !== null ? data.fine : 0);
            const interestVal = Number(data.interest !== undefined && data.interest !== null ? data.interest : 0);
            const originalAmountVal = data.original_amount !== undefined && data.original_amount !== null ? Number(data.original_amount) : Number(data.amount);

            const insertedId = await FinanceTransactionRepository.insertTransaction(conn, {
                public_id: transactionPublicId,
                company_id: companyId,
                bank_account_id: bankAccountId,
                category_id: categoryId,
                customer_id: customerId,
                supplier_id: supplierId,
                contact_id: contactId,
                related_user_id: relatedUserId,
                user_id: internalUserId,
                cost_center_id: costCenterId,
                description: data.description,
                amount: data.amount,
                original_amount: originalAmountVal,
                fine: fineVal,
                interest: interestVal,
                net_amount: netAmount,
                type: 'income',
                payment_method: data.payment_method,
                card_brand_id: cardBrandId,
                card_configuration_id: cardConfigurationId,
                date: data.date,
                date_launch: data.date_launch ? toBrazilDbDateTime(data.date_launch) : toBrazilDbDateTime(new Date()),
                status: txStatus,
                received_at: receivedAt,
                received_channel: data.received_channel || null,
                pdv: data.pdv,
                cdfilial: data.cdfilial,
                solidcon_quitado: data.solidcon_quitado !== undefined && data.solidcon_quitado !== null ? (data.solidcon_quitado ? 1 : 0) : 0,
                solidcon_key: data.solidcon_key || null
            });

            if (txStatus === 'paid') {
                await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, bankAccountId, data.amount, false);

                await FinanceService.triggerSolidconBaixaIfNeeded(
                    conn,
                    companyId,
                    insertedId,
                    data.solidcon_key,
                    data.solidcon_quitado !== undefined && data.solidcon_quitado !== null ? (data.solidcon_quitado ? 1 : 0) : 0,
                    data.amount
                );
            }
        });

        if (createdTransactionPublicId && data.status !== 'paid' && (data.payment_method === 'boleto' || data.payment_method === 'pix')) {
            void FinanceService.scheduleAutoSendWhatsApp(companyId, createdTransactionPublicId, userId, 30_000);
        }

        return { public_id: createdTransactionPublicId! };
    }

    static async listRevenues(companyId: number): Promise<any[]> {
        const rows = await FinanceTransactionRepository.listTransactions(companyId, 'income');
        try {
            return TransactionListSchema.parse(rows);
        } catch (err: any) {
            logger.warn({ err: err?.errors || err }, '[FinanceService] Validation notice in listRevenues, returning rows');
            return rows;
        }
    }

    static async updateExpense(
        companyId: number,
        publicId: string,
        data: { description: string; amount: number; date: string; category_public_id: string; bank_account_public_id: string; payment_method?: string | null | undefined; status?: string | undefined; entity_type?: string | null | undefined; entity_public_id?: string | null | undefined; cost_center_public_id?: string | null | undefined; barcode?: string | null | undefined; pix_code?: string | null | undefined; pix_key?: string | null | undefined }
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

            let costCenterId: number | null = null;
            if (data.cost_center_public_id) {
                const ccRows = await FinanceTransactionRepository.getCostCenterByPublicId(conn, companyId, data.cost_center_public_id);
                if (ccRows && ccRows.length > 0 && ccRows[0]) {
                    costCenterId = ccRows[0].id;
                }
            }

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
                cost_center_id: costCenterId,
                description: data.description,
                amount: data.amount,
                payment_method: data.payment_method,
                date: data.date,
                status: newStatus,
                received_at: newStatus === 'paid' ? new Date() : (oldTx.status === 'paid' ? null : oldTx.received_at),
                scheduled_at: newStatus === 'scheduled' ? new Date() : (oldTx.status === 'scheduled' ? null : oldTx.scheduled_at),
                barcode: data.barcode,
                pix_code: data.pix_code,
                pix_key: data.pix_key
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
        data: { description: string; amount: number; original_amount?: number | null | undefined; fine?: number | null | undefined; interest?: number | null | undefined; date: string; date_launch?: string | null | undefined; received_at?: string | undefined; received_channel?: string | null | undefined; category_public_id: string; bank_account_public_id: string; customer_public_id?: string | undefined; payment_method?: string | null | undefined; card_brand_public_id?: string | null | undefined; card_configuration_public_id?: string | null | undefined; status?: string | undefined; entity_type?: string | null | undefined; entity_public_id?: string | null | undefined; cost_center_public_id?: string | null | undefined; pdv?: string | null | undefined; cdfilial?: string | null | undefined; solidcon_quitado?: number | boolean | null | undefined; solidcon_key?: string | null | undefined; cancel_billet?: boolean | null | undefined }
    ): Promise<void> {
        await FinanceTransactionRepository.withTransaction(async (conn: PoolConnection) => {
            // 1. Fetch old transaction
            const oldRows = await FinanceTransactionRepository.getTransactionByPublicId(conn, companyId, publicId, 'income');
            if (!oldRows || oldRows.length === 0 || !oldRows[0]) throw new Error('Transaction not found');
            const oldTx = oldRows[0];

            // 1.1 Se cancel_billet for solicitado e houver boleto emitido, tenta cancelar no banco
            const shouldClearBillet = data.cancel_billet === true;
            if (shouldClearBillet && oldTx.billet_url) {
                try {
                    const [bankRows]: any = await conn.query(
                        'SELECT public_id, institution, api_client_id, api_client_secret, api_certificate, api_key, asaas_api_key, asaas_environment FROM bank_accounts WHERE id = ? LIMIT 1',
                        [oldTx.bank_account_id]
                    );
                    if (bankRows && bankRows.length > 0) {
                        const bankAcc = bankRows[0];
                        const inst = String(bankAcc.institution || '').toLowerCase();
                        if (inst.includes('inter')) {
                            const { InterService } = await import('./bankAccountApi/interService');
                            await InterService.cancelBoleto(bankAcc, oldTx.billet_url);
                        } else if (inst.includes('asaas')) {
                            const { AsaasService } = await import('./bankAccountApi/asaasService');
                            await AsaasService.cancelPayment(bankAcc, oldTx.billet_url);
                        }
                    }
                } catch (bankErr: any) {
                    logger.warn({ err: bankErr.message, txId: oldTx.id, billetUrl: oldTx.billet_url }, '[updateRevenue] Aviso ao cancelar boleto no banco');
                }
            }

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

            let cardBrandId: number | null = null;
            if (data.card_brand_public_id) {
                const [brandRows] = await conn.query<any[]>(
                    'SELECT id FROM card_brands WHERE public_id = ? AND company_id = ? LIMIT 1',
                    [data.card_brand_public_id, companyId]
                );
                if (brandRows && brandRows.length > 0) {
                    cardBrandId = brandRows[0].id;
                }
            }

            let cardConfigurationId: number | null = null;
            if (data.card_configuration_public_id) {
                const [configIdRows] = await conn.query<any[]>(
                    'SELECT id FROM card_configurations WHERE public_id = ? AND company_id = ? LIMIT 1',
                    [data.card_configuration_public_id, companyId]
                );
                if (configIdRows && configIdRows.length > 0) {
                    cardConfigurationId = configIdRows[0].id;
                }
            }

            let costCenterId: number | null = null;
            if (data.cost_center_public_id) {
                const ccRows = await FinanceTransactionRepository.getCostCenterByPublicId(conn, companyId, data.cost_center_public_id);
                if (ccRows && ccRows.length > 0 && ccRows[0]) {
                    costCenterId = ccRows[0].id;
                }
            }

            // Calculate net_amount based on card configurations
            let netAmount = data.amount;
            if ((data.payment_method === 'credit' || data.payment_method === 'debit') && cardBrandId) {
                let configRows = [];
                if (cardConfigurationId) {
                    [configRows] = await conn.query<any[]>(
                        'SELECT tax_rate, service_fee FROM card_configurations WHERE id = ? AND company_id = ? LIMIT 1',
                        [cardConfigurationId, companyId]
                    );
                } else {
                    const dbPaymentType = data.payment_method === 'credit' ? 'credito' : (data.payment_method === 'debit' ? 'debito' : data.payment_method);
                    [configRows] = await conn.query<any[]>(
                        'SELECT tax_rate, service_fee FROM card_configurations WHERE card_brand_id = ? AND company_id = ? AND payment_type = ? LIMIT 1',
                        [cardBrandId, companyId, dbPaymentType]
                    );
                }
                if (configRows && configRows.length > 0) {
                    const taxRate = parseFloat(configRows[0].tax_rate) || 0;
                    const serviceFee = parseFloat(configRows[0].service_fee) || 0;
                    netAmount = data.amount - (data.amount * (taxRate / 100)) - serviceFee;
                    if (netAmount < 0) netAmount = 0;
                }
            }

            const newStatus = data.status || 'paid';
            const effectiveCustomerId = customerId || oldTx.customer_id;

            if (newStatus === 'paid' && oldTx.status !== 'paid' && effectiveCustomerId) {
                const [custRows] = await conn.query<any[]>(
                    'SELECT only_solidcon_baixa, name FROM customers WHERE id = ? LIMIT 1',
                    [effectiveCustomerId]
                );
                if (custRows?.[0] && (custRows[0].only_solidcon_baixa === 1 || custRows[0].only_solidcon_baixa === true)) {
                    throw new Error('Este cliente está configurado para baixa exclusiva via Solidcon. A baixa manual no Keystone não é permitida.');
                }
            }

            const receivedAt = newStatus === 'paid'
                ? (data.received_at ? toBrazilDbDateTime(data.received_at) : (oldTx.received_at ? toBrazilDbDateTime(oldTx.received_at) : toBrazilDbDateTime(new Date())))
                : null;

            const fineVal = Number(data.fine !== undefined && data.fine !== null ? data.fine : (oldTx.fine ?? 0));
            const interestVal = Number(data.interest !== undefined && data.interest !== null ? data.interest : (oldTx.interest ?? 0));
            const originalAmountVal = (data.original_amount !== undefined && data.original_amount !== null) ? Number(data.original_amount) : Number(oldTx.original_amount ?? data.amount);

            // 4. Update transaction
            await FinanceTransactionRepository.updateTransaction(conn, companyId, oldTx.id, {
                bank_account_id: newBankAccountId,
                category_id: newCategoryId,
                customer_id: customerId,
                supplier_id: supplierId,
                contact_id: contactId,
                related_user_id: relatedUserId,
                cost_center_id: costCenterId,
                description: data.description,
                amount: data.amount,
                original_amount: originalAmountVal,
                fine: fineVal,
                interest: interestVal,
                net_amount: netAmount,
                payment_method: data.payment_method !== undefined && data.payment_method !== null && data.payment_method !== ''
                    ? data.payment_method
                    : (oldTx.payment_method || (oldTx.billet_url || oldTx.barcode ? 'boleto' : (oldTx.pix_code ? 'pix' : (newStatus === 'paid' ? 'transfer' : null)))),
                card_brand_id: cardBrandId,
                card_configuration_id: cardConfigurationId,
                date: data.date,
                date_launch: data.date_launch ? toBrazilDbDateTime(data.date_launch) : (oldTx.date_launch ? toBrazilDbDateTime(oldTx.date_launch) : toBrazilDbDateTime(new Date())),
                received_at: receivedAt,
                received_channel: data.received_channel !== undefined ? data.received_channel : (oldTx.received_channel ?? null),
                status: newStatus,
                barcode: shouldClearBillet ? null : (oldTx.barcode ?? null),
                pix_code: shouldClearBillet ? null : (oldTx.pix_code ?? null),
                pix_key: shouldClearBillet ? null : (oldTx.pix_key ?? null),
                pdv: data.pdv,
                cdfilial: data.cdfilial,
                solidcon_quitado: data.solidcon_quitado !== undefined && data.solidcon_quitado !== null ? (data.solidcon_quitado ? 1 : 0) : 0,
                solidcon_key: data.solidcon_key || null
            });

            if (shouldClearBillet) {
                await conn.query(
                    'UPDATE transactions SET billet_url = NULL, billet_batch_generated = 0 WHERE id = ?',
                    [oldTx.id]
                );
            }

            // 5. Apply new effect
            if (newStatus === 'paid') {
                // Apply new income: add balance for total received amount
                await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, newBankAccountId, data.amount, false);

                const solidconKey = data.solidcon_key !== undefined ? data.solidcon_key : oldTx.solidcon_key;
                const solidconQuitado = data.solidcon_quitado !== undefined && data.solidcon_quitado !== null
                    ? (data.solidcon_quitado ? 1 : 0)
                    : (oldTx.solidcon_quitado ? 1 : 0);
                
                await FinanceService.triggerSolidconBaixaIfNeeded(
                    conn,
                    companyId,
                    oldTx.id,
                    solidconKey,
                    solidconQuitado,
                    data.amount
                );
            }
        });
    }

    static async deleteTransaction(publicId: string, companyId: number): Promise<void> {
        await FinanceTransactionRepository.withTransaction(async (conn: PoolConnection) => {
            const rows = await FinanceTransactionRepository.getTransactionByPublicId(conn, companyId, publicId);
            if (!rows || rows.length === 0 || !rows[0]) throw new Error('Transaction not found');
            const transaction = rows[0];

            if (transaction.type === 'expense' && transaction.status === 'paid') {
                throw new Error('Não é permitido excluir uma despesa que já foi baixada/paga. Altere o status para pendente antes de excluir.');
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

            // Limpar reconciliação de extratos bancários e de cartão se houver
            await conn.query(
                `UPDATE bank_statements SET status = 'pending', reconciled_transaction_id = NULL WHERE reconciled_transaction_id = ? AND company_id = ?`,
                [transaction.id, companyId]
            );
            await conn.query(
                `UPDATE card_statements SET status = 'pending', reconciled_transaction_id = NULL WHERE reconciled_transaction_id = ? AND company_id = ?`,
                [transaction.id, companyId]
            );

            await FinanceTransactionRepository.deleteTransaction(conn, companyId, transaction.id);
            if (transaction.status === 'paid' && transaction.bank_account_id) {
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
        data: { bank_account_public_id?: string | undefined; payment_method?: string | undefined; date?: string | undefined; clear_fine_interest?: boolean | undefined }
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

                    let amount = oldTx.amount;
                    let originalAmount = oldTx.original_amount;
                    let fine = oldTx.fine;
                    let interest = oldTx.interest;
                    let netAmount = oldTx.net_amount;

                    if (data.clear_fine_interest) {
                        if (oldTx.original_amount !== null && oldTx.original_amount !== undefined && Number(oldTx.original_amount) > 0) {
                            amount = Number(oldTx.original_amount);
                            netAmount = Number(oldTx.original_amount);
                        }
                        fine = 0;
                        interest = 0;
                    }

                    await FinanceTransactionRepository.updateTransaction(conn, companyId, oldTx.id, {
                        bank_account_id: newBankAccountId,
                        category_id: oldTx.category_id,
                        customer_id: oldTx.customer_id,
                        description: oldTx.description,
                        amount: amount,
                        original_amount: originalAmount,
                        fine: fine,
                        interest: interest,
                        net_amount: netAmount,
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

    static async listBankStatements(companyId: number, bankAccountPublicId?: string, startDate?: string, endDate?: string): Promise<any[]> {
        return FinanceBankStatementRepository.listBankStatements(companyId, bankAccountPublicId, startDate, endDate);
    }

    static async reconcile(companyId: number, systemIds: string[], bankStatementIds: string[]): Promise<void> {
        await FinanceBankStatementRepository.withTransaction(async (conn) => {
            const txs = await FinanceBankStatementRepository.getTransactionsForReconciliation(conn, companyId, systemIds);
            const sysSum = txs.reduce((acc, t) => acc + (t.type === 'expense' ? -Number(t.amount) : Number(t.amount)), 0);
            const stmts = await FinanceBankStatementRepository.getStatementsForReconciliation(conn, companyId, bankStatementIds);
            const bankSum = stmts.reduce((acc, s) => acc + (s.type === 'expense' ? -Number(s.amount) : Number(s.amount)), 0);
            if (Math.abs(sysSum - bankSum) > 0.01) throw new Error(`Divergência de valores (${sysSum} vs ${bankSum})`);
            const txIds = txs.map(t => t.id); const stmtIds = stmts.map(s => s.id);
            await FinanceBankStatementRepository.updateReconcile(conn, txIds, stmtIds, txIds[0]!);
        });
    }

    static async undoReconcile(companyId: number, bankStatementId: string | number, deleteTransaction: boolean = true): Promise<void> {
        const statements = await FinanceBankStatementRepository.getStatementsForReconciliation(pool, companyId, [String(bankStatementId)]);
        if (statements.length === 0) throw new Error('Extrato não encontrado');
        const statement = statements[0]!;
        await FinanceBankStatementRepository.withTransaction(async (conn) => {
            await FinanceBankStatementRepository.undoReconcile(conn, statement.id, statement.reconciled_transaction_id, deleteTransaction, companyId);
        });
    }

    // PDF e Boleto Stubs para corrigir lints (devem ser implementados se necessários ou mantidos como stubs caso movidos)
    static async generateReceiptHTML(companyId: number, transactionPublicId: string): Promise<string> {
        const tx = await FinanceDocumentRepository.getTransactionForDocument(pool, companyId, transactionPublicId);
        if (!tx) throw new Error('Transaction not found');

        const escapeHtml = (value: unknown): string =>
            String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');

        const formatReceiptDateTime = (dateVal: unknown, createdAtVal: unknown): string => {
            if (!dateVal) return '';
            if (createdAtVal) {
                const dateObj = new Date(createdAtVal as any);
                if (!isNaN(dateObj.getTime())) {
                    return new Intl.DateTimeFormat('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    }).format(dateObj).replace(', ', ' ');
                }
            }
            const isoDate = toBrazilDate(dateVal instanceof Date ? dateVal : new Date(dateVal as any));
            const [year, month, day] = isoDate.split('-');
            return year && month && day ? `${day}/${month}/${year}` : isoDate;
        };

        const formatBrazilDocument = (value: unknown): string => {
            const clean = String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            if (clean.length === 14) return clean.replace(/([a-zA-Z0-9]{2})([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{4})([a-zA-Z0-9]{2})/, '$1.$2.$3/$4-$5');
            if (clean.length === 11) return clean.replace(/([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{2})/, '$1.$2.$3-$4');
            return String(value || '-');
        };

        const transactionStatus = String(tx.status || '').toLowerCase();
        const effectiveStatus = transactionStatus !== 'paid' && String(tx.sale_status || '').toLowerCase() === 'progress'
            ? 'progress'
            : transactionStatus;
        const isPending = effectiveStatus === 'pending';
        const isProgress = effectiveStatus === 'progress';
        const isExpense = tx.type === 'expense';
        const isPixPayment = String(tx.payment_method || '').toLowerCase() === 'pix';
        const shouldShowPixSection = !isExpense && isPixPayment && (isPending || isProgress);
        const pixKey = String(tx.pix_key || '').trim();

        if (shouldShowPixSection && !pixKey) {
            throw new Error('PIX nao cadastrado para a conta bancaria desta receita');
        }

        const amount = Number(tx.amount) || 0;
        const amountFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
        const dateValue = formatReceiptDateTime(tx.date, tx.created_at);
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
        // isExpense is defined above
        const docTitle = isExpense ? 'Recibo de Pagamento' : 'Recibo de Cobrança';
        const recipientLabel = isExpense ? 'Favorecido' : 'Cliente';
        const statusLabel = effectiveStatus === 'progress' ? 'Andamento' : (isPending ? 'Pendente' : (isExpense ? 'Pago' : 'Recebido'));

        const paymentMethodMap: Record<string, string> = {
            pix: 'Pix',
            boleto: 'Boleto',
            dinheiro: 'Dinheiro',
            cartao_credito: 'Cartão de Crédito',
            cartao_debito: 'Cartão de Débito',
            transferencia: 'Transferência Bancária',
            outros: 'Outros'
        };
        const paymentMethodRaw = String(tx.payment_method || '').toLowerCase().trim();
        const paymentMethodFormatted = paymentMethodMap[paymentMethodRaw] || tx.payment_method || 'Não informado';

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
    <title>${docTitle}</title>
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
        .amount { font-size: 20px; font-weight: 700; color: ${isExpense ? '#be123c' : '#047857'}; }
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
                    <p class="title">${docTitle}</p>
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
                <div class="label">${recipientLabel}</div>
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
                <div class="label" style="margin-top:10px;">Forma de Pagamento</div>
                <div class="value">${escapeHtml(paymentMethodFormatted)}${tx.bank_name ? ` - ${bankName}` : ''}</div>
                <div style="border-top:1px solid #d1d5db; margin:12px 0;"></div>
                <div class="label">Descrição</div>
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

    static async recordWhatsAppAudit(data: {
        companyId: number;
        transactionId: number;
        transactionPublicId: string;
        userId?: number | null;
        userName?: string | null;
        recipientPhone: string;
        recipientName?: string | null;
        billingType?: string;
        status: 'success' | 'failed' | 'pending';
        errorMessage?: string | null;
        messageText?: string | null;
        mediaFileName?: string | null;
        mediaUrl?: string | null;
        isAutomatic?: boolean | number;
        whatsappMessageId?: string | null;
        rawResponse?: any;
    }): Promise<void> {
        try {
            const publicId = randomUUID();
            const rawResponseStr = data.rawResponse ? (typeof data.rawResponse === 'string' ? data.rawResponse : JSON.stringify(data.rawResponse)) : null;
            await pool.query(
                `INSERT INTO revenue_whatsapp_audits (
                    public_id, company_id, transaction_id, transaction_public_id,
                    user_id, user_name, recipient_phone, recipient_name,
                    billing_type, status, error_message, message_text,
                    media_file_name, media_url, is_automatic, whatsapp_message_id,
                    raw_response
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    publicId,
                    data.companyId,
                    data.transactionId,
                    data.transactionPublicId,
                    data.userId || null,
                    data.userName || null,
                    data.recipientPhone,
                    data.recipientName || null,
                    data.billingType || 'boleto',
                    data.status,
                    data.errorMessage || null,
                    data.messageText || null,
                    data.mediaFileName || null,
                    data.mediaUrl || null,
                    data.isAutomatic ? 1 : 0,
                    data.whatsappMessageId || null,
                    rawResponseStr
                ]
            );
        } catch (auditErr) {
            logger.error({ auditErr }, '[WhatsAppAudit] Falha ao gravar log de auditoria');
        }
    }

    static async getWhatsAppAudits(companyId: number, query: any): Promise<any> {
        const page = Math.max(1, parseInt(query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
        const offset = (page - 1) * limit;

        const whereClauses: string[] = ['a.company_id = ?'];
        const params: any[] = [companyId];

        if (query.search) {
            const s = `%${String(query.search).trim()}%`;
            whereClauses.push('(a.recipient_name LIKE ? OR a.recipient_phone LIKE ? OR a.transaction_public_id LIKE ? OR a.user_name LIKE ? OR a.message_text LIKE ?)');
            params.push(s, s, s, s, s);
        }

        if (query.status && (query.status === 'success' || query.status === 'failed' || query.status === 'pending')) {
            whereClauses.push('a.status = ?');
            params.push(query.status);
        }

        if (query.billingType) {
            whereClauses.push('a.billing_type = ?');
            params.push(query.billingType);
        }

        if (query.isAutomatic !== undefined && query.isAutomatic !== '') {
            whereClauses.push('a.is_automatic = ?');
            params.push(String(query.isAutomatic) === '1' || String(query.isAutomatic) === 'true' ? 1 : 0);
        }

        if (query.transactionPublicId) {
            whereClauses.push('a.transaction_public_id = ?');
            params.push(query.transactionPublicId);
        }

        if (query.startDate) {
            whereClauses.push('DATE(a.created_at) >= ?');
            params.push(query.startDate);
        }

        if (query.endDate) {
            whereClauses.push('DATE(a.created_at) <= ?');
            params.push(query.endDate);
        }

        const whereSql = whereClauses.join(' AND ');

        const [summaryRows]: any = await pool.query(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as total_success,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
                SUM(CASE WHEN is_automatic = 1 THEN 1 ELSE 0 END) as total_automatic,
                SUM(CASE WHEN is_automatic = 0 THEN 1 ELSE 0 END) as total_manual
            FROM revenue_whatsapp_audits a
            WHERE ${whereSql}`,
            params
        );

        const summary = summaryRows[0] || {
            total: 0,
            total_success: 0,
            total_failed: 0,
            total_automatic: 0,
            total_manual: 0
        };

        const totalRecords = Number(summary.total) || 0;
        const totalPages = Math.ceil(totalRecords / limit) || 1;

        const [rows]: any = await pool.query(
            `SELECT 
                a.id,
                a.public_id,
                a.company_id,
                a.transaction_id,
                a.transaction_public_id,
                a.user_id,
                a.user_name,
                a.recipient_phone,
                a.recipient_name,
                a.billing_type,
                a.status,
                a.error_message,
                a.message_text,
                a.media_file_name,
                a.media_url,
                a.is_automatic,
                a.whatsapp_message_id,
                a.raw_response,
                a.created_at,
                t.description as transaction_description,
                t.amount as transaction_amount,
                t.status as transaction_status
            FROM revenue_whatsapp_audits a
            LEFT JOIN transactions t ON t.id = a.transaction_id AND t.company_id = a.company_id
            WHERE ${whereSql}
            ORDER BY a.created_at DESC, a.id DESC
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return {
            data: rows,
            summary: {
                total: Number(summary.total) || 0,
                success: Number(summary.total_success) || 0,
                failed: Number(summary.total_failed) || 0,
                automatic: Number(summary.total_automatic) || 0,
                manual: Number(summary.total_manual) || 0
            },
            pagination: {
                page,
                limit,
                total: totalRecords,
                totalPages
            }
        };
    }

    static async getTransactionWhatsAppAudits(companyId: number, transactionPublicId: string): Promise<any[]> {
        const [rows]: any = await pool.query(
            `SELECT 
                a.id,
                a.public_id,
                a.company_id,
                a.transaction_id,
                a.transaction_public_id,
                a.user_id,
                a.user_name,
                a.recipient_phone,
                a.recipient_name,
                a.billing_type,
                a.status,
                a.error_message,
                a.message_text,
                a.media_file_name,
                a.media_url,
                a.is_automatic,
                a.whatsapp_message_id,
                a.raw_response,
                a.created_at
            FROM revenue_whatsapp_audits a
            WHERE a.company_id = ? AND a.transaction_public_id = ?
            ORDER BY a.created_at DESC, a.id DESC`,
            [companyId, transactionPublicId]
        );
        return rows || [];
    }

    static async sendWhatsApp(
        companyId: number,
        userIdOrPublicId: string | number,
        id: string,
        phoneOverride?: string,
        bypassPermissionCheck: boolean = false,
        isAutomatic: boolean = false
    ): Promise<any> {
        let userQuery = 'SELECT id, role, full_name, whatsapp_enable_manual_billing FROM users WHERE company_id = ? AND ';
        let queryParams: any[] = [companyId];

        const parsedId = Number(userIdOrPublicId);
        if (Number.isInteger(parsedId) && !Number.isNaN(parsedId)) {
            userQuery += 'id = ? LIMIT 1';
            queryParams.push(parsedId);
        } else {
            userQuery += 'public_id = ? LIMIT 1';
            queryParams.push(String(userIdOrPublicId));
        }

        const [userRows] = await pool.query<any[]>(userQuery, queryParams);
        let targetUser = userRows[0];
        if (!targetUser) {
            // Fallback: busca diretamente por public_id ou id sem filtro de company_id
            const [fallbackRows] = await pool.query<any[]>(
                Number.isInteger(parsedId) && !Number.isNaN(parsedId)
                    ? 'SELECT id, role, full_name, whatsapp_enable_manual_billing FROM users WHERE id = ? LIMIT 1'
                    : 'SELECT id, role, full_name, whatsapp_enable_manual_billing FROM users WHERE public_id = ? LIMIT 1',
                [Number.isInteger(parsedId) && !Number.isNaN(parsedId) ? parsedId : String(userIdOrPublicId)]
            );
            targetUser = fallbackRows[0];
        }

        if (!targetUser && isAutomatic) {
            // Fallback para qualquer usuário ativo da empresa no modo automático
            const [companyUserRows] = await pool.query<any[]>(
                'SELECT id, role, full_name, whatsapp_enable_manual_billing FROM users WHERE company_id = ? AND is_active = 1 ORDER BY role = "admin" DESC, id ASC LIMIT 1',
                [companyId]
            );
            targetUser = companyUserRows[0];
        }

        if (!targetUser) {
            throw new Error('Usuário não encontrado.');
        }

        const isAdminOrSuper = targetUser.role === 'admin' || targetUser.role === 'super_admin';
        if (!bypassPermissionCheck && !isAdminOrSuper && Number(targetUser.whatsapp_enable_manual_billing) === 0) {
            throw new Error('Você não tem permissão para realizar disparos rápidos de cobrança (ações manuais).');
        }

        const userId = targetUser.id;
        const userName = targetUser.full_name || (isAutomatic ? 'Robô / Sistema' : 'Usuário');

        let tx: any = null;
        let normalizedPhone = '';
        let messageBody = '';
        let filename = '';
        let billingType = 'boleto';

        try {
            tx = await FinanceDocumentRepository.getTransactionForDocument(pool, companyId, id);
            if (!tx) throw new Error('Receita não encontrada');
            if (tx.type !== 'income') throw new Error('WhatsApp de cobrança disponível apenas para receitas');

            billingType = tx.payment_method || 'boleto';

            const rawPhone = (phoneOverride || tx.cust_phone || '').trim();
            normalizedPhone = WhatsAppBusinessMessageService.normalizeContactPhone(rawPhone);
            if (!normalizedPhone) {
                throw new Error('Telefone do cliente não cadastrado ou inválido. Por favor, atualize o cadastro ou informe um número.');
            }

            const amount = Number(tx.amount) || 0;
            const amountFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

            let pdfBase64 = '';
            let pixCode = '';

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
            const allowAllUsersActiveSender = company.whatsapp_allow_all_users_active_sender !== undefined 
                ? Number(company.whatsapp_allow_all_users_active_sender) !== 0 
                : true;

            const messageInput = {
                to: normalizedPhone,
                messageBody: messageBody.trim(),
                attachment: {
                    base64: pdfBase64,
                    mimeType: 'application/pdf',
                    fileName: filename,
                },
            };

            let result;
            if (allowAllUsersActiveSender) {
                result = await WhatsAppBusinessService.sendBestAvailableSessionMessage(companyId, userId, messageInput, company);
            } else {
                const useCompanyScope = (company.whatsapp_business_scope || 'company') === 'company';
                if (useCompanyScope) {
                    result = await WhatsAppBusinessService.sendMessage(companyId, messageInput);
                } else {
                    result = await WhatsAppBusinessService.sendUserMessage(companyId, userId, messageInput);
                }
            }

            try {
                await pool.query('UPDATE transactions SET whatsapp_sent = COALESCE(whatsapp_sent, 0) + 1 WHERE id = ?', [tx.id]);
            } catch (dbErr) {
                logger.error({ dbErr }, '[WhatsApp] Falha ao marcar whatsapp_sent na transacao');
            }

            // Grava Auditoria de Sucesso
            await FinanceService.recordWhatsAppAudit({
                companyId,
                transactionId: tx.id,
                transactionPublicId: tx.public_id || id,
                userId: isAutomatic ? null : userId,
                userName: isAutomatic ? 'Robô / Sistema (Automático)' : (userName || 'Usuário'),
                recipientPhone: normalizedPhone,
                recipientName: tx.cust_name || null,
                billingType,
                status: 'success',
                messageText: messageBody.trim(),
                mediaFileName: filename,
                mediaUrl: tx.billet_url || null,
                isAutomatic,
                whatsappMessageId: result?.message_id || null,
                rawResponse: result
            });

            return result;
        } catch (sendError: any) {
            // Grava Auditoria de Falha se tivermos dados da transação
            if (tx) {
                await FinanceService.recordWhatsAppAudit({
                    companyId,
                    transactionId: tx.id,
                    transactionPublicId: tx.public_id || id,
                    userId: isAutomatic ? null : userId,
                    userName: isAutomatic ? 'Robô / Sistema (Automático)' : (userName || 'Usuário'),
                    recipientPhone: normalizedPhone || phoneOverride || tx.cust_phone || 'N/A',
                    recipientName: tx.cust_name || null,
                    billingType,
                    status: 'failed',
                    errorMessage: sendError?.message || String(sendError),
                    messageText: messageBody ? messageBody.trim() : null,
                    mediaFileName: filename || null,
                    mediaUrl: tx.billet_url || null,
                    isAutomatic,
                    rawResponse: { error: sendError?.message || String(sendError) }
                });
            }
            throw sendError;
        }
    }

    static async batchSendWhatsApp(
        companyId: number, 
        userId: string | number, 
        transactionPublicIds: string[]
    ): Promise<{ success: number; failed: number; errors: string[] }> {
        let success = 0;
        let failed = 0;
        const errors: string[] = [];

        const isConnected = await WhatsAppBusinessService.isAnySessionConnected(companyId);
        if (!isConnected) {
            throw new Error('Nenhum número de WhatsApp está conectado no sistema. Conecte o WhatsApp por QR Code antes de realizar os envios.');
        }

        for (let i = 0; i < transactionPublicIds.length; i++) {
            const pubId = transactionPublicIds[i];
            if (!pubId) continue;
            try {
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                await FinanceService.sendWhatsApp(companyId, userId, pubId, undefined, false);
                success++;
            } catch (err: any) {
                failed++;
                errors.push(`Erro no lançamento ${pubId}: ${err.message || String(err)}`);
            }
        }

        return { success, failed, errors };
    }

    static async scheduleAutoSendWhatsApp(
        companyId: number,
        transactionPublicId: string,
        requestingUserIdOrPublicId?: string | number,
        delayMs: number = 30000
    ): Promise<void> {
        try {
            // 1. Consulta configurações da empresa
            const [companyRows]: any = await pool.query(
                'SELECT id, name, auto_send_boleto_whatsapp, whatsapp_business_scope, boleto_send_whatsapp_name, boleto_send_whatsapp_number, whatsapp_allow_all_users_active_sender FROM companies WHERE id = ?',
                [companyId]
            );
            const companyData = companyRows?.[0];

            // 2. Resolve remetente e elegibilidade de auto-envio
            let targetUser: any = null;
            let shouldAutoSend = false;

            if (requestingUserIdOrPublicId) {
                const parsedReqId = Number(requestingUserIdOrPublicId);
                let reqUserQuery = 'SELECT id, public_id, full_name, whatsapp_auto_send_boleto, whatsapp_enable_manual_billing, role FROM users WHERE company_id = ? AND is_active = 1 AND ';
                let reqUserParams: any[] = [companyId];
                if (Number.isInteger(parsedReqId) && !Number.isNaN(parsedReqId)) {
                    reqUserQuery += '(id = ? OR public_id = ?) LIMIT 1';
                    reqUserParams.push(parsedReqId, String(requestingUserIdOrPublicId));
                } else {
                    reqUserQuery += 'public_id = ? LIMIT 1';
                    reqUserParams.push(String(requestingUserIdOrPublicId));
                }

                const [reqUserRows]: any = await pool.query(reqUserQuery, reqUserParams);
                if (reqUserRows && reqUserRows[0]) {
                    targetUser = reqUserRows[0];
                    if (targetUser.whatsapp_auto_send_boleto) {
                        shouldAutoSend = true;
                    }
                }
            }

            // Se a empresa possui envio automático de boleto/cobrança habilitado
            if (companyData && (companyData.auto_send_boleto_whatsapp === 1 || companyData.auto_send_boleto_whatsapp === true)) {
                shouldAutoSend = true;
            }

            // Se ainda não marcado para envio, checa se qualquer usuário ativo tem flag de auto-envio
            if (!shouldAutoSend) {
                const [anyAutoUserRows]: any = await pool.query(
                    'SELECT id, public_id, full_name, whatsapp_auto_send_boleto FROM users WHERE company_id = ? AND is_active = 1 AND whatsapp_auto_send_boleto = 1 LIMIT 1',
                    [companyId]
                );
                if (anyAutoUserRows && anyAutoUserRows[0]) {
                    shouldAutoSend = true;
                    if (!targetUser) targetUser = anyAutoUserRows[0];
                }
            }

            // Fallback de remetente
            if (shouldAutoSend && !targetUser) {
                const [fallbackUserRows]: any = await pool.query(
                    'SELECT id, public_id, full_name, whatsapp_auto_send_boleto FROM users WHERE company_id = ? AND is_active = 1 ORDER BY role = "admin" DESC, id ASC LIMIT 1',
                    [companyId]
                );
                if (fallbackUserRows && fallbackUserRows[0]) {
                    targetUser = fallbackUserRows[0];
                }
            }

            if (shouldAutoSend && targetUser) {
                const senderPubId = targetUser.public_id || targetUser.id;
                const delaySeconds = Math.round(delayMs / 1000);
                logger.info(`[AutoSendWhatsApp] Agendando envio de cobrança para transação ${transactionPublicId} em ${delaySeconds}s usando sessão do usuário ${senderPubId} (${targetUser.full_name || 'Sistema'})`);

                setTimeout(async () => {
                    try {
                        const [txCheck]: any = await pool.query(
                            'SELECT id, status, payment_method, billet_url, whatsapp_sent FROM transactions WHERE public_id = ? AND company_id = ? LIMIT 1',
                            [transactionPublicId, companyId]
                        );
                        if (txCheck && txCheck[0]) {
                            const currentTx = txCheck[0];
                            const isUnpaid = currentTx.status !== 'paid' && currentTx.status !== 'cancelled';
                            const alreadySent = Number(currentTx.whatsapp_sent || 0) > 0;
                            const isBoleto = currentTx.payment_method === 'boleto';
                            
                            // Se for boleto, precisa ter billet_url gerado
                            if (isBoleto && !currentTx.billet_url) {
                                logger.info(`[AutoSendWhatsApp] Envio cancelado para transação ${transactionPublicId}: boleto ainda sem URL/código gerado.`);
                                return;
                            }

                            if (isUnpaid && !alreadySent) {
                                const isConnected = await WhatsAppBusinessService.isAnySessionConnected(companyId);
                                if (!isConnected) {
                                    logger.warn(`[AutoSendWhatsApp] WhatsApp desconectado na empresa ${companyId}. Envio automático da transação ${transactionPublicId} não efetuado (permaneceu pendente).`);
                                    return;
                                }

                                logger.info(`[AutoSendWhatsApp] Executando envio automático após ${delaySeconds}s para transação ${transactionPublicId}`);
                                await FinanceService.sendWhatsApp(companyId, senderPubId, transactionPublicId, undefined, true, true);
                                logger.info(`[AutoSendWhatsApp] Cobrança enviada com sucesso via WhatsApp para transação ${transactionPublicId}`);
                            } else {
                                logger.info(`[AutoSendWhatsApp] Envio cancelado para transação ${transactionPublicId}: status=${currentTx.status}, alreadySent=${alreadySent}`);
                            }
                        }
                    } catch (err: any) {
                        logger.error({ err }, `[AutoSendWhatsApp] Erro no envio automático da transação ${transactionPublicId}`);
                    }
                }, delayMs);
            }
        } catch (err) {
            logger.error({ err }, '[AutoSendWhatsApp] Erro ao agendar auto-envio');
        }
    }

    static async generateBillet(companyId: number, transactionPublicId: string, requestingUserIdOrPublicId?: string | number): Promise<any> {
        const tx = await FinanceDocumentRepository.getTransactionForBillet(pool, companyId, transactionPublicId);
        if (!tx) throw new Error('Transação não encontrada');

        if (!tx.cust_doc) {
            throw new Error('Cliente sem CPF/CNPJ. Preencha o cadastro antes de emitir boleto.');
        }

        if (tx.cust_only_pix === 1 || tx.cust_only_pix === true) {
            throw new Error(`O cliente "${tx.cust_name || 'destinatário'}" está travado para emissão de boleto (autorizado somente PIX).`);
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
            
            await FinanceDocumentRepository.updateBilletCode(pool, tx.id, result.codigoBarras, result.pixCopiaECola || null, result.nossoNumero);
            
            // Agenda o auto-envio via WhatsApp para 30 segundos depois
            void FinanceService.scheduleAutoSendWhatsApp(companyId, transactionPublicId, requestingUserIdOrPublicId, 30_000);

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

        if (!tx.bank_acc_public_id) {
            throw new Error('Esta receita não possui uma conta bancária vinculada para obter o boleto.');
        }

        const bankAccount = await BankAccountService.getByPublicId(tx.bank_acc_public_id, companyId);
        if (!bankAccount) {
            throw new Error('Conta bancária associada ao boleto não foi encontrada.');
        }
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
    static async batchGenerateBillets(companyId: number, publicIds: string[], requestingUserIdOrPublicId?: string | number): Promise<any> {
        let successCount = 0;
        let errors: string[] = [];
        for (let i = 0; i < publicIds.length; i++) {
            const pubId = publicIds[i];
            if (!pubId) continue;
            try {
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
                await FinanceService.generateBillet(companyId, pubId, requestingUserIdOrPublicId);
                const tx = await FinanceDocumentRepository.getTransactionForBillet(pool, companyId, pubId);
                if (tx) {
                    await FinanceDocumentRepository.updateBilletBatchGenerated(pool, tx.id, true);
                }
                successCount++;
            } catch (err: any) {
                errors.push(`Erro na receita ${pubId}: ${err.message}`);
            }
        }
        if (errors.length > 0) {
            throw new Error(`Gerados: ${successCount}. Erros: ${errors.join(', ')}`);
        }
        return { success: successCount };
    }
    static async batchCancelBillets(companyId: number, publicIds: string[]): Promise<any> {
        let successCount = 0;
        let errors = [];
        for (const pubId of publicIds) {
            try {
                if (successCount > 0 || errors.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, 600));
                }
                const tx = await FinanceDocumentRepository.getTransactionForBillet(pool, companyId, pubId);
                if (!tx) {
                    throw new Error('Transação não encontrada.');
                }
                if (!tx.billet_url) {
                    await FinanceDocumentRepository.updateBilletCode(pool, tx.id, null, null, null);
                    successCount++;
                    continue;
                }
                const inst = String(tx.institution || '').toLowerCase();
                if (inst.includes('inter')) {
                    const { InterService } = await import('./bankAccountApi/interService');
                    const bankAccount = await BankAccountService.getByPublicId(tx.bank_acc_public_id, tx.company_id || companyId);
                    await InterService.cancelBoleto(bankAccount, tx.billet_url);
                    await FinanceDocumentRepository.updateBilletCode(pool, tx.id, null, null, null);
                    successCount++;
                } else if (inst.includes('asaas')) {
                    const { AsaasService } = await import('./bankAccountApi/asaasService');
                    const bankAccount = await BankAccountService.getByPublicId(tx.bank_acc_public_id, tx.company_id || companyId);
                    await AsaasService.cancelPayment(bankAccount, tx.billet_url);
                    await FinanceDocumentRepository.updateBilletCode(pool, tx.id, null, null, null);
                    successCount++;
                } else {
                    await FinanceDocumentRepository.updateBilletCode(pool, tx.id, null, null, null);
                    successCount++;
                }
            } catch (err: any) {
                errors.push(`Erro na receita ${pubId}: ${err.message}`);
            }
        }
        if (errors.length > 0 && successCount === 0) {
            throw new Error(`Cancelados: ${successCount}. Erros: ${errors.join(', ')}`);
        }
        return { success: true, count: successCount, errors: errors.length > 0 ? errors : undefined };
    }

    static async cancelOpenBoletosAndSwitchToPixForCustomer(companyId: number, customerId: number): Promise<{
        processed: number;
        cancelledAtBank: number;
        errors: string[];
    }> {
        const errors: string[] = [];
        let processed = 0;
        let cancelledAtBank = 0;

        try {
            // 1. Busca todas as receitas em aberto do cliente que possuem boleto ou estão marcadas como boleto
            const [openTxs]: any = await pool.query(
                `SELECT t.id, t.public_id, t.company_id, t.bank_account_id, t.billet_url, t.barcode, t.pix_code, t.payment_method, t.status,
                        b.public_id as bank_acc_public_id, b.institution, b.pix_key as bank_pix_key
                 FROM transactions t
                 LEFT JOIN bank_accounts b ON b.id = t.bank_account_id
                 WHERE t.company_id = ?
                   AND t.customer_id = ?
                   AND (t.type = 'income' OR t.type = 'revenue')
                   AND (t.status = 'pending' OR t.status IS NULL)
                   AND (t.payment_method = 'boleto' OR t.billet_url IS NOT NULL OR t.barcode IS NOT NULL)`,
                [companyId, customerId]
            );

            if (!openTxs || openTxs.length === 0) {
                return { processed: 0, cancelledAtBank: 0, errors: [] };
            }

            for (const tx of openTxs) {
                // 2. Se houver boleto emitido no banco, tenta cancelar na instituição
                if (tx.billet_url && tx.bank_acc_public_id) {
                    const inst = String(tx.institution || '').toLowerCase();
                    if (inst.includes('inter')) {
                        try {
                            const { InterService } = await import('./bankAccountApi/interService');
                            const bankAccount = await BankAccountService.getByPublicId(tx.bank_acc_public_id, companyId);
                            await InterService.cancelBoleto(bankAccount, tx.billet_url);
                            cancelledAtBank++;
                        } catch (bankErr: any) {
                            logger.warn({ err: bankErr.message, txId: tx.id, billetUrl: tx.billet_url }, '[cancelOpenBoletosAndSwitchToPixForCustomer] Aviso ao cancelar boleto no Inter');
                            errors.push(`Boleto ${tx.billet_url}: ${bankErr.message}`);
                        }
                    } else if (inst.includes('asaas')) {
                        try {
                            const { AsaasService } = await import('./bankAccountApi/asaasService');
                            const bankAccount = await BankAccountService.getByPublicId(tx.bank_acc_public_id, companyId);
                            await AsaasService.cancelPayment(bankAccount, tx.billet_url);
                            cancelledAtBank++;
                        } catch (bankErr: any) {
                            logger.warn({ err: bankErr.message, txId: tx.id }, '[cancelOpenBoletosAndSwitchToPixForCustomer] Aviso ao cancelar cobrança no Asaas');
                            errors.push(`Cobrança ${tx.billet_url}: ${bankErr.message}`);
                        }
                    }
                }

                // 3. Atualiza a transação para PIX, limpando os dados de boleto
                await pool.query(
                    `UPDATE transactions 
                     SET payment_method = 'pix',
                         barcode = NULL,
                         billet_url = NULL,
                         billet_batch_generated = 0,
                         pix_key = COALESCE(pix_key, ?),
                         updated_at = NOW()
                     WHERE id = ? AND company_id = ?`,
                    [tx.bank_pix_key || null, tx.id, companyId]
                );

                processed++;
            }

            logger.info({ companyId, customerId, processed, cancelledAtBank }, '[cancelOpenBoletosAndSwitchToPixForCustomer] Boletos em aberto cancelados e receitas alteradas para PIX com sucesso');
        } catch (err: any) {
            logger.error({ err, companyId, customerId }, '[cancelOpenBoletosAndSwitchToPixForCustomer] Erro geral ao processar transições para PIX');
            errors.push(err.message || String(err));
        }

        return { processed, cancelledAtBank, errors };
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

    static async syncBankStatementsOfx(companyId: number, bankAccountPublicId: string, ofxContent: string): Promise<number> {
        const parseOfx = (content: string) => {
            const transactions: Array<{
                transactionId: string;
                date: string;
                description: string;
                amount: number;
                type: 'income' | 'expense';
            }> = [];

            const parts = content.split(/<STMTTRN>/i);
            for (let i = 1; i < parts.length; i++) {
                const partContent = parts[i];
                if (!partContent) continue;
                const part = partContent.split(/<\/STMTTRN>/i)[0];
                if (!part) continue;

                const getTagValue = (tag: string): string => {
                    const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
                    const match = part.match(regex);
                    return match && match[1] ? match[1].trim() : '';
                };

                const dtPosted = getTagValue('DTPOSTED');
                const trnAmt = getTagValue('TRNAMT');
                const fitId = getTagValue('FITID');
                const memo = getTagValue('MEMO');
                const name = getTagValue('NAME');

                const description = memo || name || 'Lançamento OFX';
                const amount = parseFloat(trnAmt.replace(',', '.'));
                
                if (isNaN(amount)) continue;

                let dateStr = new Date().toISOString().substring(0, 10);
                if (dtPosted && dtPosted.length >= 8) {
                    const y = dtPosted.substring(0, 4);
                    const m = dtPosted.substring(4, 6);
                    const d = dtPosted.substring(6, 8);
                    dateStr = `${y}-${m}-${d}`;
                }

                const type: 'income' | 'expense' = amount >= 0 ? 'income' : 'expense';

                transactions.push({
                    transactionId: fitId || `ofx-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                    date: dateStr,
                    description,
                    amount: Math.abs(amount),
                    type,
                });
            }
            return transactions;
        };

        const bankAccountRows = await FinanceBankStatementRepository.getBankAccountByPublicId(pool, companyId, bankAccountPublicId);
        const firstRow = bankAccountRows[0];
        if (!firstRow) throw new Error('Conta bancária não encontrada.');
        const bankAccountId = firstRow.id;

        const txs = parseOfx(ofxContent);
        let imported = 0;

        await FinanceBankStatementRepository.withTransaction(async (conn) => {
            for (const tx of txs) {
                const exists = await FinanceBankStatementRepository.checkStatementExists(conn, companyId, bankAccountId, tx);
                if (!exists) {
                    const publicId = randomUUID();
                    await FinanceBankStatementRepository.upsertBankStatement(
                        conn,
                        companyId,
                        bankAccountId,
                        publicId,
                        tx.transactionId,
                        tx.date,
                        tx.description,
                        tx.amount,
                        tx.type,
                        JSON.stringify(tx)
                    );
                    imported++;
                }
            }
        });

        return imported;
    }

    static async batchDeleteBankStatements(companyId: number, ids: number[], _email?: string, _password?: string): Promise<void> {
        if (ids.length === 0) return;
        const placeholders = ids.map(() => '?').join(',');
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT public_id FROM bank_statements WHERE company_id = ? AND id IN (${placeholders})`,
            [companyId, ...ids]
        );
        const publicIds = rows.map(r => r.public_id);
        await FinanceBankStatementRepository.deleteBankStatementsByPublicIds(pool, companyId, publicIds);
    }

    // Card Statements Methods
    static async syncCardStatementsOfx(companyId: number, ofxContent: string): Promise<number> {
        const parseOfx = (content: string) => {
            const transactions: Array<{
                transactionId: string;
                date: string;
                description: string;
                amount: number;
                type: 'income' | 'expense';
            }> = [];

            const parts = content.split(/<STMTTRN>/i);
            for (let i = 1; i < parts.length; i++) {
                const partContent = parts[i];
                if (!partContent) continue;
                const part = partContent.split(/<\/STMTTRN>/i)[0];
                if (!part) continue;

                const getTagValue = (tag: string): string => {
                    const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
                    const match = part.match(regex);
                    return match && match[1] ? match[1].trim() : '';
                };

                const dtPosted = getTagValue('DTPOSTED');
                const trnAmt = getTagValue('TRNAMT');
                const fitId = getTagValue('FITID');
                const memo = getTagValue('MEMO');
                const name = getTagValue('NAME');

                const description = memo || name || 'Lançamento OFX Cartão';
                const amount = parseFloat(trnAmt.replace(',', '.'));
                
                if (isNaN(amount)) continue;

                let dateStr = new Date().toISOString().substring(0, 10);
                if (dtPosted && dtPosted.length >= 8) {
                    const y = dtPosted.substring(0, 4);
                    const m = dtPosted.substring(4, 6);
                    const d = dtPosted.substring(6, 8);
                    dateStr = `${y}-${m}-${d}`;
                }

                const type: 'income' | 'expense' = amount >= 0 ? 'income' : 'expense';

                transactions.push({
                    transactionId: fitId || `ofx-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                    date: dateStr,
                    description,
                    amount: Math.abs(amount),
                    type,
                });
            }
            return transactions;
        };

        const txs = parseOfx(ofxContent);
        let imported = 0;

        await FinanceCardStatementRepository.withTransaction(async (conn) => {
            for (const tx of txs) {
                const exists = await FinanceCardStatementRepository.checkStatementExists(conn, companyId, tx);
                if (!exists) {
                    const publicId = randomUUID();
                    await FinanceCardStatementRepository.upsertCardStatement(
                        conn,
                        companyId,
                        publicId,
                        tx.transactionId,
                        tx.date,
                        tx.description,
                        tx.amount,
                        tx.type,
                        JSON.stringify(tx)
                    );
                    imported++;
                }
            }
        });

        return imported;
    }

    static async listCardStatements(companyId: number): Promise<any[]> {
        return FinanceCardStatementRepository.listCardStatements(companyId);
    }

    static async listCardTransactions(companyId: number): Promise<any[]> {
        return FinanceCardStatementRepository.listCardTransactions(companyId);
    }

    static async reconcileCard(companyId: number, systemIds: string[], cardStatementIds: string[]): Promise<void> {
        await FinanceCardStatementRepository.withTransaction(async (conn) => {
            const txs = await FinanceCardStatementRepository.getTransactionsForReconciliation(conn, companyId, systemIds);
            const sysSum = txs.reduce((acc, t) => acc + (t.type === 'expense' ? -Number(t.amount) : Number(t.amount)), 0);
            const stmts = await FinanceCardStatementRepository.getStatementsForReconciliation(conn, companyId, cardStatementIds);
            const cardSum = stmts.reduce((acc, s) => acc + (s.type === 'expense' ? -Number(s.amount) : Number(s.amount)), 0);
            if (Math.abs(sysSum - cardSum) > 0.01) throw new Error(`Divergência de valores (${sysSum} vs ${cardSum})`);
            const txIds = txs.map(t => t.id); const stmtIds = stmts.map(s => s.id);
            await FinanceCardStatementRepository.updateReconcile(conn, txIds, stmtIds, txIds[0]!);
        });
    }

    static async undoReconcileCard(companyId: number, cardStatementPublicId: string): Promise<void> {
        const statements = await FinanceCardStatementRepository.getStatementsForReconciliation(pool, companyId, [cardStatementPublicId]);
        if (statements.length === 0) throw new Error('Lançamento não encontrado');
        const statement = statements[0]!;
        await FinanceCardStatementRepository.withTransaction(async (conn) => {
            await FinanceCardStatementRepository.undoReconcile(conn, statement.id, statement.reconciled_transaction_id);
        });
    }

    static async batchDeleteCardStatements(companyId: number, ids: string[]): Promise<void> {
        await FinanceCardStatementRepository.deleteCardStatementsByPublicIds(pool, companyId, ids);
    }

    static async importSolidconRevenues(
        companyId: number,
        userId: string,
        categoryPublicId: string | undefined,
        bankAccountPublicId: string | undefined,
        items: any[],
        updateOnlyPdv: boolean = false,
        triggerBoletoAndWhatsApp: boolean = true
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

        // Load company's default receivable type and cdfilial
        let defaultPaymentMethod: string | null = null;
        let companyCdFilial: string | null = null;
        try {
            const [companyRows] = await pool.query<RowDataPacket[]>(
                `SELECT rt.name, c.cdfilial 
                 FROM companies c
                 LEFT JOIN receivable_types rt ON rt.id = c.default_receivable_type_id
                 WHERE c.id = ? LIMIT 1`,
                [companyId]
            );
            if (companyRows && companyRows[0]) {
                if (companyRows[0].name) {
                    const name = companyRows[0].name.toLowerCase().trim();
                    if (name.includes('pix')) defaultPaymentMethod = 'pix';
                    else if (name.includes('credito') || name.includes('credit')) defaultPaymentMethod = 'credit';
                    else if (name.includes('debito') || name.includes('debit')) defaultPaymentMethod = 'debit';
                    else if (name.includes('dinheiro') || name.includes('cash') || name.includes('especie')) defaultPaymentMethod = 'cash';
                    else if (name.includes('transfer') || name.includes('ted') || name.includes('doc')) defaultPaymentMethod = 'transfer';
                    else if (name.includes('boleto')) defaultPaymentMethod = 'boleto';
                    else defaultPaymentMethod = companyRows[0].name;
                }
                if (companyRows[0].cdfilial) {
                    companyCdFilial = String(companyRows[0].cdfilial).trim() || null;
                }
            }
        } catch (e) {
            console.error('Failed to load company default receivable type:', e);
        }

        const mapSolidconItem = (payload: any) => {
            const nrCupom = pickValue(payload, ['nrCupom', 'nrcupom', 'nrcupomcupom']);
            let description = normalizeText(pickValue(payload, ['descricao', 'description', 'obs', 'observacao', 'nome', 'name', 'titulo', 'title', 'historico', 'doc_origem', 'nr_documento'])) || 'Importação Solidcon';
            if (nrCupom) {
                description = `Cupom #${nrCupom} - ${description}`;
            }
            const amount = parseNumber(pickValue(payload, ['valor', 'amount', 'vl_documento', 'valor_liquido', 'vl_liquido', 'vl_original', 'valor_original', 'value', 'vlCrediario', 'vl_crediario']));
            if (amount === undefined || amount <= 0) return null;

            // 1. Data de Lançamento / Emissão do Cupom (ou data da importação)
            const dateLaunchRaw = pickValue(payload, [
                'dtEmissao', 'dtemissao', 'dt_emissao', 'data_emissao', 'emissao',
                'dtMovimento', 'dtmovimento', 'dt_movimento', 'data_movimento',
                'dtCrediario', 'dtcrediario', 'dt_crediario',
                'dtCupom', 'dtcupom', 'dt_cupom',
                'dtLancamento', 'dtlancamento', 'dt_lancamento', 'data_lancamento'
            ]);
            let date_launch = '';
            if (dateLaunchRaw) {
                try {
                    date_launch = toBrazilDbDateTime(dateLaunchRaw);
                } catch {
                    // ignore
                }
            }
            if (!date_launch) {
                date_launch = toBrazilDbDateTime(new Date());
            }

            // 2. Data de Vencimento do Título
            const dateRaw = pickValue(payload, [
                'dtVencimento', 'dtvencimento', 'dt_vencimento', 'data_vencimento', 'vencimento',
                'data', 'date'
            ]);
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
                date = date_launch || new Date().toISOString().split('T')[0] || '';
            }

            let payment_method: string | undefined = defaultPaymentMethod || undefined;
            if (!payment_method) {
                const rawMethod = normalizeText(pickValue(payload, ['forma_pagamento', 'forma_pgto', 'meio_pagamento', 'payment_method', 'tipo_pagamento'])).toLowerCase();
                if (rawMethod.includes('pix')) payment_method = 'pix';
                else if (rawMethod.includes('credito') || rawMethod.includes('credit')) payment_method = 'credit';
                else if (rawMethod.includes('debito') || rawMethod.includes('debit')) payment_method = 'debit';
                else if (rawMethod.includes('dinheiro') || rawMethod.includes('cash')) payment_method = 'cash';
                else if (rawMethod.includes('transfer') || rawMethod.includes('ted') || rawMethod.includes('doc')) payment_method = 'transfer';
                else if (rawMethod.includes('boleto')) payment_method = 'boleto';
            }

            const statusRaw = normalizeText(pickValue(payload, ['status', 'situacao', 'state', 'st_documento', 'stdocumento', 'st_crediario', 'stcrediario', 'situacao_documento'])).toLowerCase();
            const paidDateRaw = pickValue(payload, ['data_pagamento', 'dt_pagamento', 'data_baixa', 'dt_baixa', 'pago_em', 'dt_quitacao', 'dtquitacao', 'data_quitacao', 'dt_recebimento', 'data_recebimento']);
            const vlQuitadoVal = parseNumber(pickValue(payload, ['vlQuitado', 'vl_quitado', 'quitado', 'valor_quitado', 'vlPago', 'vlpago', 'valor_pago', 'vl_pago', 'vlRecebido', 'vl_recebido']));
            const flQuitado = pickValue(payload, ['flQuitado', 'fl_quitado', 'quitado', 'baixado', 'fl_baixado', 'flBaixado', 'is_quitado', 'fl_pago', 'flPago']);
            
            const isBaixadoInSolidcon = Boolean(
                statusRaw.includes('pago') || 
                statusRaw.includes('paid') || 
                statusRaw.includes('recebido') || 
                statusRaw.includes('baixado') || 
                statusRaw.includes('quitado') || 
                statusRaw === 'b' || 
                statusRaw === 'q' || 
                statusRaw === 'p' ||
                paidDateRaw || 
                (vlQuitadoVal !== undefined && vlQuitadoVal > 0) || 
                flQuitado === true || 
                flQuitado === 1 || 
                flQuitado === 'S' || 
                flQuitado === 's' || 
                flQuitado === 'T' || 
                flQuitado === 't'
            );

            let status: 'pending' | 'progress' | 'paid' = isBaixadoInSolidcon ? 'paid' : 'pending';
            let paid_date: string | null = null;
            if (paidDateRaw) {
                try {
                    const parsedPaidDate = new Date(paidDateRaw);
                    if (!isNaN(parsedPaidDate.getTime())) {
                        paid_date = parsedPaidDate.toISOString().slice(0, 10);
                    }
                } catch {
                    // ignore
                }
            }

            const customerName = normalizeText(pickValue(payload, ['cliente', 'customer', 'nome_cliente', 'sacado', 'nome']));
            let customerDoc = String(pickValue(payload, ['cnpj', 'cpf', 'cnpj_cpf', 'documento', 'doc', 'cpf_cnpj', 'cdCrediario', 'cd_crediario']) || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            if (customerDoc.length > 0) {
                if (customerDoc.length <= 11) {
                    customerDoc = customerDoc.padStart(11, '0');
                } else if (customerDoc.length <= 14) {
                    customerDoc = customerDoc.padStart(14, '0');
                }
            }

            const nrPdv = pickValue(payload, [
                'nrPdv', 'nrpdv', 'pdv', 'cdPdv', 'cdpdv', 'cd_pdv', 'cdPDV',
                'caixa', 'checkout', 'terminal', 'nr_caixa', 'nrcaixa', 
                'caixa_pdv', 'cd_caixa', 'propertynumber', 'cxsapore',
                'nrcaixacred', 'nr_caixa_cred', 'num_pdv', 'numpdv',
                'id_pdv', 'idpdv'
            ]);
            const pdv = nrPdv !== undefined && nrPdv !== null ? String(nrPdv).trim() : null;

            const rawCdFilial = pickValue(payload, [
                'cdFilial', 'cdfilial', 'filial', 'codigo_filial', 'cd_filial',
                'id_filial', 'idfilial', 'empresa', 'cd_empresa', 'cdempresa'
            ]);
            const cdfilial = rawCdFilial !== undefined && rawCdFilial !== null ? String(rawCdFilial).trim() : (companyCdFilial || null);

            const cdCrediarioCupom = pickValue(payload, ['cdCrediarioCupom', 'cdcredcupom', 'id_crediario_cupom', 'idcrediariocupom', 'cd_crediario_cupom']);
            const solidcon_key = cdCrediarioCupom !== undefined && cdCrediarioCupom !== null ? String(cdCrediarioCupom).trim() : null;
            const customerStreet = normalizeText(pickValue(payload, ['Endereco', 'endereco', 'street', 'logradouro']));
            const customerNeighborhood = normalizeText(pickValue(payload, ['Bairro', 'bairro', 'neighborhood']));
            const customerCity = normalizeText(pickValue(payload, ['Cidade', 'cidade', 'city']));
            const customerZipcode = normalizeText(pickValue(payload, ['CEP', 'cep', 'zipcode']));
            const customerPhone = normalizeText(pickValue(payload, ['Celular', 'celular', 'phone', 'telefone', 'tel']));

            return {
                description,
                amount,
                date,
                date_launch,
                payment_method,
                status,
                paid_date,
                customerName,
                customerDoc,
                customerStreet,
                customerNeighborhood,
                customerCity,
                customerZipcode,
                customerPhone,
                pdv,
                cdfilial,
                solidcon_quitado: (isBaixadoInSolidcon || (vlQuitadoVal && vlQuitadoVal > 0)) ? 1 : 0,
                solidcon_key
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

        const processBoletoAndWhatsApp = async (
            txPublicId: string,
            paymentMethod: string | undefined,
            status: string,
            hasBilletUrl: boolean,
            whatsappSent: boolean,
            isSolidconQuitado: boolean = false
        ) => {
            if (status === 'paid' || isSolidconQuitado) return;

            let currentHasBillet = hasBilletUrl;
            const normalizedMethod = String(paymentMethod || '').toLowerCase();

            // 1. Gerar boleto caso seja boleto e ainda não tenha sido emitido
            if (normalizedMethod === 'boleto' && !currentHasBillet) {
                try {
                    await FinanceService.generateBillet(companyId, txPublicId, internalUserId);
                    currentHasBillet = true;
                } catch (billetErr: any) {
                    logger.warn({ err: billetErr, txPublicId }, '[Solidcon Import] Falha ao gerar boleto automático');
                }
            }

            // 2. Enviar WhatsApp se ainda não tiver sido enviado e não for quitado
            if (!whatsappSent && !isSolidconQuitado && status !== 'paid') {
                const [checkDb]: any = await pool.query(
                    'SELECT status, whatsapp_sent FROM transactions WHERE public_id = ? AND company_id = ? LIMIT 1',
                    [txPublicId, companyId]
                );
                const dbStatus = checkDb?.[0]?.status || status;
                const dbWhatsappSent = Number(checkDb?.[0]?.whatsapp_sent || 0) > 0;

                if (dbStatus !== 'paid' && !dbWhatsappSent) {
                    const isBoletoReady = normalizedMethod === 'boleto' && currentHasBillet;
                    const isPix = normalizedMethod === 'pix';

                    if (isBoletoReady || isPix) {
                        try {
                            await new Promise(r => setTimeout(r, 600));
                            await FinanceService.sendWhatsApp(companyId, userId, txPublicId, undefined, true, true);
                        } catch (waErr: any) {
                            logger.warn({ err: waErr, txPublicId }, '[Solidcon Import] Falha ao enviar WhatsApp automático');
                        }
                    }
                }
            }
        };

        for (let index = 0; index < items.length; index += 1) {
            const item = items[index];
            try {
                const mapped = mapSolidconItem(item);
                if (!mapped) {
                    result.skipped += 1;
                    result.errors.push({ index, reason: 'Item sem descricao ou valor valido.' });
                    continue;
                }

                let query = `SELECT t.id, t.public_id, t.status, t.solidcon_quitado, t.pdv, t.payment_method, t.billet_url, t.whatsapp_sent, t.customer_id,
                                    c.only_pix as cust_only_pix, c.cnpj_cpf as cust_cnpj_cpf
                             FROM transactions t
                             LEFT JOIN customers c ON t.customer_id = c.id
                             WHERE t.company_id = ? 
                               AND t.type = 'income'`;
                let params: any[] = [companyId];

                if (mapped.solidcon_key) {
                    query += ` AND (t.solidcon_key = ? OR (t.amount = ? AND t.description = ?))`;
                    params.push(mapped.solidcon_key, mapped.amount, mapped.description);
                } else if (mapped.description.startsWith('Cupom #')) {
                    query += ` AND t.amount = ? AND t.description = ?`;
                    params.push(mapped.amount, mapped.description);
                } else {
                    query += ` AND t.amount = ? AND t.description = ? AND t.date = ?`;
                    params.push(mapped.amount, mapped.description, mapped.date);
                }
                query += ` LIMIT 1`;

                const [existingRows] = await pool.query<RowDataPacket[]>(query, params);
                if (existingRows?.[0]) {
                    const existingTx = existingRows[0];
                    const isSolidconQuitado = mapped.solidcon_quitado || (mapped.status === 'paid' ? 1 : 0);

                    // 1. SE NO SOLIDCON ESTÁ BAIXADO/PAGO E NO SISTEMA LOCAL ESTÁ PENDENTE/PROGRESSO:
                    if (mapped.status === 'paid' && existingTx.status !== 'paid') {
                        const conn = await pool.getConnection();
                        try {
                            await conn.beginTransaction();
                            
                            // Atualiza a transação local para 'paid' com a data da baixa
                            await conn.query(
                                `UPDATE transactions 
                                 SET status = 'paid', 
                                     received_at = COALESCE(?, NOW()), 
                                     solidcon_quitado = 1, 
                                     pdv = COALESCE(?, pdv), 
                                     cdfilial = COALESCE(?, cdfilial), 
                                     solidcon_key = COALESCE(?, solidcon_key), 
                                     updated_at = NOW() 
                                 WHERE id = ?`,
                                [mapped.paid_date || null, mapped.pdv || null, mapped.cdfilial || null, mapped.solidcon_key || null, existingTx.id]
                            );

                            // Atualiza o saldo da conta bancária vinculada
                            const [txInfo]: any = await conn.query('SELECT bank_account_id, amount FROM transactions WHERE id = ?', [existingTx.id]);
                            if (txInfo?.[0]?.bank_account_id) {
                                await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, txInfo[0].bank_account_id, txInfo[0].amount, false);
                            }

                            await conn.commit();
                            logger.info({ txId: existingTx.id, description: mapped.description }, '[Solidcon Import] Baixa automática realizada com sucesso na receita local');
                        } catch (baixaErr) {
                            await conn.rollback();
                            logger.error({ err: baixaErr, txId: existingTx.id }, '[Solidcon Import] Erro ao realizar baixa automática na receita local');
                        } finally {
                            conn.release();
                        }

                        result.updated += 1;
                        continue;
                    }

                    // 2. Se já estiver pago no sistema local, mas ainda não estiver quitado no Solidcon:
                    await pool.query(
                        `UPDATE transactions SET pdv = COALESCE(?, pdv), cdfilial = COALESCE(?, cdfilial), solidcon_key = COALESCE(?, solidcon_key), solidcon_quitado = ?, updated_at = NOW() WHERE id = ?`,
                        [mapped.pdv || null, mapped.cdfilial || null, mapped.solidcon_key || null, isSolidconQuitado, existingTx.id]
                    );

                    if (existingTx.status === 'paid' && !isSolidconQuitado && mapped.solidcon_key) {
                        const conn = await pool.getConnection();
                        try {
                            await FinanceService.triggerSolidconBaixaIfNeeded(
                                conn,
                                companyId,
                                existingTx.id,
                                mapped.solidcon_key,
                                0,
                                mapped.amount
                            );
                        } finally {
                            conn.release();
                        }
                    }

                    // Verificar se o cliente pode gerar boleto ou se deve ajustar para PIX
                    let effectivePaymentMethod = existingTx.payment_method || mapped.payment_method;
                    const canGenerateBoletoExisting = !existingTx.cust_only_pix && Boolean(existingTx.cust_cnpj_cpf || mapped.customerDoc);
                    if (effectivePaymentMethod === 'boleto' && !canGenerateBoletoExisting) {
                        effectivePaymentMethod = 'pix';
                        if (existingTx.payment_method === 'boleto') {
                            await pool.query(`UPDATE transactions SET payment_method = 'pix' WHERE id = ?`, [existingTx.id]);
                            existingTx.payment_method = 'pix';
                        }
                    }

                    // Se não estiver pago em ambos os lados nem quitado no Solidcon, garante a geração do boleto e o envio do WhatsApp (Boleto ou PIX)
                    const isAlreadySent = Number(existingTx.whatsapp_sent || 0) > 0;
                    if (triggerBoletoAndWhatsApp && !isSolidconQuitado && existingTx.status !== 'paid' && mapped.status !== 'paid') {
                        await processBoletoAndWhatsApp(
                            existingTx.public_id,
                            effectivePaymentMethod,
                            existingTx.status,
                            Boolean(existingTx.billet_url && String(existingTx.billet_url).trim() !== ''),
                            isAlreadySent,
                            Boolean(isSolidconQuitado)
                        );
                    }

                    if (updateOnlyPdv) {
                        result.updated += 1;
                    } else {
                        result.skipped += 1;
                        result.errors.push({ index, reason: `Já existe no sistema (${mapped.description}). Dados de PDV/Chave atualizados.` });
                    }
                    continue;
                }

                // If not found in the system, ALWAYS REGISTER/CREATE IT (even when updateOnlyPdv is checked)
                // Look up customer or automatically create customer if missing
                let customerId: number | null = null;
                let customerOnlyPix = false;
                let customerHasDoc = Boolean(mapped.customerDoc);

                if (mapped.customerDoc) {
                    const [custRows] = await pool.query<RowDataPacket[]>(
                        'SELECT id, only_pix, cnpj_cpf FROM customers WHERE company_id = ? AND cnpj_cpf = ? LIMIT 1',
                        [companyId, mapped.customerDoc]
                    );
                    if (custRows?.[0]) {
                        customerId = custRows[0].id;
                        customerOnlyPix = Boolean(custRows[0].only_pix);
                        if (custRows[0].cnpj_cpf) customerHasDoc = true;
                    }
                }
                if (!customerId && mapped.customerName) {
                    const [custRows] = await pool.query<RowDataPacket[]>(
                        'SELECT id, only_pix, cnpj_cpf FROM customers WHERE company_id = ? AND name = ? LIMIT 1',
                        [companyId, mapped.customerName]
                    );
                    if (custRows?.[0]) {
                        customerId = custRows[0].id;
                        customerOnlyPix = Boolean(custRows[0].only_pix);
                        if (custRows[0].cnpj_cpf) customerHasDoc = true;
                    }
                }

                // Auto-create customer if missing
                if (!customerId && (mapped.customerName || mapped.customerDoc)) {
                    try {
                        const newCustPublicId = randomUUID();
                        const custName = mapped.customerName || `Cliente ${mapped.customerDoc}`;
                        const [insertCust] = await pool.query<ResultSetHeader>(
                            `INSERT INTO customers (public_id, company_id, name, cnpj_cpf, phone, street, neighborhood, city, zipcode, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                            [
                                newCustPublicId,
                                companyId,
                                custName,
                                mapped.customerDoc || null,
                                mapped.customerPhone || null,
                                mapped.customerStreet || null,
                                mapped.customerNeighborhood || null,
                                mapped.customerCity || null,
                                mapped.customerZipcode || null
                            ]
                        );
                        customerId = insertCust.insertId;
                    } catch (custErr: any) {
                        console.warn(`[Solidcon Import] Erro ao cadastrar cliente automatico: ${custErr.message}`);
                    }
                }

                // Ajusta forma de pagamento caso o cliente não possa gerar boleto (trava only_pix ou falta de documento)
                let effectivePaymentMethod = mapped.payment_method;
                const canGenerateBoletoNew = !customerOnlyPix && customerHasDoc;
                if (effectivePaymentMethod === 'boleto' && !canGenerateBoletoNew) {
                    effectivePaymentMethod = 'pix';
                }

                const transactionPublicId = randomUUID();
                const isPaid = mapped.status === 'paid' || Boolean(mapped.solidcon_quitado);
                await FinanceTransactionRepository.withTransaction(async (conn: PoolConnection) => {
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
                        payment_method: effectivePaymentMethod,
                        date: mapped.date,
                        date_launch: mapped.date_launch || mapped.date,
                        status: mapped.status,
                        received_at: isPaid ? (mapped.paid_date || new Date().toISOString().slice(0, 19).replace('T', ' ')) : null,
                        pdv: mapped.pdv,
                        cdfilial: mapped.cdfilial,
                        solidcon_quitado: mapped.solidcon_quitado || (isPaid ? 1 : 0),
                        solidcon_key: mapped.solidcon_key
                    });

                    if (isPaid) {
                        await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, bankAccountId, mapped.amount, false);
                    }
                });

                // Executa a geração do boleto e o envio do WhatsApp (Boleto ou PIX) apenas se não estiver pago nem quitado no Solidcon e triggerBoletoAndWhatsApp estiver ativo
                if (triggerBoletoAndWhatsApp && !isPaid && !mapped.solidcon_quitado) {
                    await processBoletoAndWhatsApp(
                        transactionPublicId,
                        effectivePaymentMethod,
                        mapped.status,
                        false,
                        false,
                        false
                    );
                }

                result.created += 1;
            } catch (error: any) {
                result.skipped += 1;
                result.errors.push({ index, reason: error?.message || 'Falha ao importar item.' });
            }
        }

        return result;
    }

    static async importSolidconExpenses(
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

        // Load company's default cdfilial
        let companyCdFilial: string | null = null;
        try {
            const [companyRows] = await pool.query<RowDataPacket[]>(
                `SELECT c.cdfilial 
                 FROM companies c
                 WHERE c.id = ? LIMIT 1`,
                [companyId]
            );
            if (companyRows && companyRows[0] && companyRows[0].cdfilial) {
                companyCdFilial = String(companyRows[0].cdfilial).trim() || null;
            }
        } catch (e) {
            console.error('Failed to load company info for expense import:', e);
        }

        const mapSolidconExpenseItem = (payload: any) => {
            const cdConta = pickValue(payload, ['cdConta', 'cdconta', 'cd_conta']);
            const cdContaParcela = pickValue(payload, ['cdContaParcela', 'cdcontaparcela', 'cd_conta_parcela', 'parcela', 'nrParcela', 'nr_parcela']);
            const doc = pickValue(payload, ['Documento', 'documento', 'doc', 'nr_documento']);
            const hist = pickValue(payload, ['historicoParcela', 'historicoBaixa', 'Historico', 'historico', 'descricao', 'description', 'obs', 'observacao', 'nome', 'titulo']);

            let solidcon_key: string | null = null;
            if (cdConta && cdContaParcela && String(cdContaParcela).trim()) {
                solidcon_key = `conta_${String(cdConta).trim()}_parc_${String(cdContaParcela).trim()}`;
            } else if (doc && cdContaParcela && String(cdContaParcela).trim()) {
                solidcon_key = `doc_${String(doc).trim()}_parc_${String(cdContaParcela).trim()}`;
            } else if (cdConta) {
                solidcon_key = `conta_${String(cdConta).trim()}`;
            } else if (doc && String(doc).trim() && String(doc).trim() !== '0') {
                solidcon_key = `doc_${String(doc).trim()}`;
            }

            const docNum = doc && String(doc).trim() && String(doc).trim() !== '0' ? String(doc).trim() : (cdConta ? String(cdConta).trim() : '');
            const parcelaLabel = cdContaParcela && String(cdContaParcela).trim() ? ` (Parc. ${String(cdContaParcela).trim()})` : '';

            let description = hist ? normalizeText(hist) : 'Despesa Solidcon';
            if (docNum) {
                description = `Doc. #${docNum}${parcelaLabel} - ${description}`;
            } else if (parcelaLabel) {
                description = `Despesa Solidcon${parcelaLabel} - ${description}`;
            }

            const amount = parseNumber(pickValue(payload, [
                'vlParcela', 'vlContaBaixa', 'vlConta', 'vlTotal', 'vl_total', 'vlSaldo', 
                'vlDocumento', 'vl_documento', 'vlTitulo', 'vl_titulo', 'vlTotalCalculado', 
                'valor', 'amount', 'vl_liquido', 'value'
            ]));
            if (amount === undefined || amount <= 0) return null;

            const dateLaunchRaw = pickValue(payload, [
                'dtInclusao', 'dt_inclusao', 'dtinclusao', 'dataInclusao', 'data_inclusao',
                'dtEmissao', 'dt_emissao', 'dtemissao', 'data_emissao', 'emissao',
                'dtLancamento', 'dt_lancamento', 'dtlancamento', 'data_lancamento'
            ]);
            let date_launch = '';
            if (dateLaunchRaw) {
                try {
                    date_launch = toBrazilDbDateTime(dateLaunchRaw);
                } catch {
                    // ignore
                }
            }
            if (!date_launch) {
                date_launch = toBrazilDbDateTime(new Date());
            }

            const dateRaw = pickValue(payload, ['dtParcela', 'data_vencimento', 'dt_vencimento', 'data', 'date', 'vencimento']);
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
                date = date_launch || new Date().toISOString().split('T')[0] || '';
            }

            let payment_method: string = 'transfer';
            const rawMethod = normalizeText(pickValue(payload, ['forma_pagamento', 'forma_pgto', 'meio_pagamento', 'payment_method', 'tipo_pagamento'])).toLowerCase();
            if (rawMethod.includes('pix')) payment_method = 'pix';
            else if (rawMethod.includes('credito') || rawMethod.includes('credit')) payment_method = 'credit';
            else if (rawMethod.includes('debito') || rawMethod.includes('debit')) payment_method = 'debit';
            else if (rawMethod.includes('dinheiro') || rawMethod.includes('cash') || rawMethod.includes('especie')) payment_method = 'cash';
            else if (rawMethod.includes('boleto')) payment_method = 'boleto';

            const statusRaw = normalizeText(pickValue(payload, ['status', 'situacao', 'state', 'st_documento'])).toLowerCase();
            const paidDateRaw = pickValue(payload, ['dtContaBaixa', 'data_pagamento', 'dt_pagamento', 'data_baixa', 'dt_baixa', 'pago_em']);
            const cdContaBaixa = pickValue(payload, ['cdContaBaixa', 'cd_conta_baixa']);
            const isBaixadoInSolidcon = Boolean(
                statusRaw.includes('pago') || 
                statusRaw.includes('paid') || 
                statusRaw.includes('baixado') || 
                statusRaw.includes('quitado') || 
                cdContaBaixa || 
                paidDateRaw
            );

            const status: 'pending' | 'paid' = isBaixadoInSolidcon ? 'paid' : 'pending';
            let paid_date: string | null = null;
            if (paidDateRaw) {
                try {
                    const parsedPaidDate = new Date(paidDateRaw);
                    if (!isNaN(parsedPaidDate.getTime())) {
                        paid_date = parsedPaidDate.toISOString().slice(0, 10);
                    }
                } catch {
                    // ignore
                }
            }

            const rawCdFilial = pickValue(payload, ['cdPessoaFilialConta', 'cdFilial', 'cdfilial', 'filial', 'codigo_filial']);
            const cdfilial = rawCdFilial !== undefined && rawCdFilial !== null ? String(rawCdFilial).trim() : (companyCdFilial || null);

            return {
                description,
                amount,
                date,
                date_launch,
                payment_method,
                status,
                paid_date,
                cdfilial,
                solidcon_key
            };
        };

        // Resolve category, bank account, and user
        let categoryId: number;
        let bankAccountId: number;
        let internalUserId: number;

        try {
            let catPubId = categoryPublicId;
            if (!catPubId) {
                const [firstCat] = await pool.query<RowDataPacket[]>(
                    "SELECT public_id FROM categories WHERE company_id = ? AND type = 'expense' ORDER BY id ASC LIMIT 1",
                    [companyId]
                );
                if (firstCat?.[0]) {
                    catPubId = firstCat[0].public_id;
                } else {
                    const defaultCatPubId = randomUUID();
                    await FinanceCategoryRepository.create(defaultCatPubId, companyId, 'Importações Solidcon', 'expense');
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
                    throw new Error('Nenhuma conta bancária cadastrada no sistema.');
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
            throw new Error(`Erro ao inicializar parâmetros de importação: ${error.message}`);
        }

        for (let index = 0; index < items.length; index += 1) {
            const item = items[index];
            try {
                const mapped = mapSolidconExpenseItem(item);
                if (!mapped) {
                    const cdConta = pickValue(item, ['cdConta', 'cdconta']);
                    const doc = pickValue(item, ['Documento', 'documento', 'doc']);
                    result.skipped += 1;
                    result.errors.push({ index, reason: `Sem valor ou data válida (Documento #${doc || cdConta || 'N/A'})` });
                    continue;
                }

                let query = `SELECT t.id, t.public_id, t.status, t.payment_method
                             FROM transactions t
                             WHERE t.company_id = ? 
                               AND t.type = 'expense'`;
                let params: any[] = [companyId];

                if (mapped.solidcon_key) {
                    query += ` AND t.solidcon_key = ?`;
                    params.push(mapped.solidcon_key);
                } else {
                    query += ` AND t.amount = ? AND t.description = ? AND t.date = ?`;
                    params.push(mapped.amount, mapped.description, mapped.date);
                }
                query += ` LIMIT 1`;

                const [existingRows] = await pool.query<RowDataPacket[]>(query, params);
                if (existingRows?.[0]) {
                    const existingTx = existingRows[0];

                    if (mapped.status === 'paid' && existingTx.status !== 'paid') {
                        const conn = await pool.getConnection();
                        try {
                            await conn.beginTransaction();
                            await conn.query(
                                `UPDATE transactions 
                                 SET status = 'paid', 
                                     received_at = COALESCE(?, NOW()), 
                                     cdfilial = COALESCE(?, cdfilial), 
                                     solidcon_key = COALESCE(?, solidcon_key), 
                                     updated_at = NOW() 
                                 WHERE id = ?`,
                                [mapped.paid_date || null, mapped.cdfilial || null, mapped.solidcon_key || null, existingTx.id]
                            );

                            const [txInfo]: any = await conn.query('SELECT bank_account_id, amount FROM transactions WHERE id = ?', [existingTx.id]);
                            if (txInfo?.[0]?.bank_account_id) {
                                await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, txInfo[0].bank_account_id, txInfo[0].amount, true);
                            }

                            await conn.commit();
                        } catch (baixaErr) {
                            await conn.rollback();
                            logger.error({ err: baixaErr, txId: existingTx.id }, '[Solidcon Import] Erro ao realizar baixa de despesa');
                        } finally {
                            conn.release();
                        }
                        result.updated += 1;
                        continue;
                    }

                    await pool.query(
                        `UPDATE transactions SET cdfilial = COALESCE(?, cdfilial), solidcon_key = COALESCE(?, solidcon_key), updated_at = NOW() WHERE id = ?`,
                        [mapped.cdfilial || null, mapped.solidcon_key || null, existingTx.id]
                    );
                    result.skipped += 1;
                    result.errors.push({ index, reason: `Já cadastrado no ERP (ID #${existingTx.id} - ${mapped.description})` });
                    continue;
                }

                // Create new expense transaction
                const conn = await pool.getConnection();
                try {
                    await conn.beginTransaction();
                    const txPublicId = randomUUID();
                    await conn.query(
                        `INSERT INTO transactions (
                            public_id, company_id, category_id, bank_account_id, user_id,
                            description, amount, date, date_launch, payment_method, status,
                            received_at, type, cdfilial, solidcon_key, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'expense', ?, ?, NOW(), NOW())`,
                        [
                            txPublicId, companyId, categoryId, bankAccountId, internalUserId,
                            mapped.description, mapped.amount, mapped.date, mapped.date_launch || mapped.date, mapped.payment_method, mapped.status,
                            mapped.status === 'paid' ? (mapped.paid_date || mapped.date) : null,
                            mapped.cdfilial || null, mapped.solidcon_key || null
                        ]
                    );

                    if (mapped.status === 'paid') {
                        await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, bankAccountId, mapped.amount, true);
                    }

                    await conn.commit();
                    result.created += 1;
                } catch (insErr: any) {
                    await conn.rollback();
                    result.skipped += 1;
                    result.errors.push({ index, reason: insErr.message || 'Erro ao inserir despesa.' });
                } finally {
                    conn.release();
                }
            } catch (itemErr: any) {
                result.skipped += 1;
                result.errors.push({ index, reason: itemErr.message || 'Erro inesperado no item.' });
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
        
        const boletoData = await InterService.getBoletoDetails(bankAccount, tx.billet_url);
        const cobranca = boletoData.cobranca || boletoData;
        const situacao = cobranca.situacao;

        const valorNominal = cobranca.valorNominal !== undefined && cobranca.valorNominal !== null ? Number(cobranca.valorNominal) : null;
        const valorTotalRecebido = cobranca.valorTotalRecebido !== undefined && cobranca.valorTotalRecebido !== null 
            ? Number(cobranca.valorTotalRecebido) 
            : (cobranca.totalRecebido !== undefined && cobranca.totalRecebido !== null ? Number(cobranca.totalRecebido) : null);
        
        let fine = 0;
        if (cobranca.multa?.valor !== undefined && cobranca.multa?.valor !== null) {
            fine = Number(cobranca.multa.valor);
        } else if (cobranca.valorMulta !== undefined && cobranca.valorMulta !== null) {
            fine = Number(cobranca.valorMulta);
        } else if (cobranca.multaRecebida !== undefined && cobranca.multaRecebida !== null) {
            fine = Number(cobranca.multaRecebida);
        } else if (tx.fine !== undefined && tx.fine !== null) {
            fine = Number(tx.fine);
        }

        let interest = 0;
        if (cobranca.mora?.valor !== undefined && cobranca.mora?.valor !== null) {
            interest = Number(cobranca.mora.valor);
        } else if (cobranca.valorMora !== undefined && cobranca.valorMora !== null) {
            interest = Number(cobranca.valorMora);
        } else if (cobranca.moraRecebida !== undefined && cobranca.moraRecebida !== null) {
            interest = Number(cobranca.moraRecebida);
        } else if (cobranca.valorJuros !== undefined && cobranca.valorJuros !== null) {
            interest = Number(cobranca.valorJuros);
        } else if (tx.interest !== undefined && tx.interest !== null) {
            interest = Number(tx.interest);
        }

        const originalAmount = valorNominal !== null ? valorNominal : Number(tx.original_amount !== null && tx.original_amount !== undefined ? tx.original_amount : tx.amount);
        
        if (situacao === 'PAGO' || situacao === 'RECEBIDO') {
            let finalAmount = valorTotalRecebido !== null ? valorTotalRecebido : (originalAmount + fine + interest);
            
            if (valorTotalRecebido !== null && valorTotalRecebido > originalAmount) {
                const diff = Math.round((valorTotalRecebido - originalAmount) * 100) / 100;
                if (fine === 0 && interest === 0) {
                    if (cobranca.multa?.taxa) {
                        fine = Math.round((originalAmount * (Number(cobranca.multa.taxa) / 100)) * 100) / 100;
                        interest = Math.max(0, Math.round((diff - fine) * 100) / 100);
                    } else if (bankAccount.billet_fine) {
                        fine = Math.round((originalAmount * (Number(bankAccount.billet_fine) / 100)) * 100) / 100;
                        interest = Math.max(0, Math.round((diff - fine) * 100) / 100);
                    } else {
                        interest = diff;
                    }
                } else if (Math.round((fine + interest) * 100) / 100 !== diff) {
                    interest = Math.max(0, Math.round((diff - fine) * 100) / 100);
                }
            }

            const paymentDate = cobranca.dataHoraSituacao || cobranca.dataPagamento || cobranca.dataHoraPagamento || null;
            const canal = String(cobranca.origemRecebimento || cobranca.canalPagamento || cobranca.formaPagamento || cobranca.tipoPagamento || '').toUpperCase();
            const receivedChannel = canal.includes('PIX') ? 'pix_qr' : (canal.includes('BOLETO') || canal.includes('CODIGO') || canal.includes('BARRA') ? 'barcode' : (tx.received_channel || 'barcode'));
            const paymentMethod = receivedChannel === 'pix_qr' ? 'pix' : (tx.payment_method || 'boleto');

            if (tx.status !== 'paid') {
                await FinanceTransactionRepository.withTransaction(async (conn) => {
                    await conn.query(
                        `UPDATE transactions 
                         SET status = 'paid', 
                             payment_method = ?,
                             original_amount = ?, 
                             fine = ?, 
                             interest = ?, 
                             amount = ?, 
                             received_at = COALESCE(?, NOW()), 
                             received_channel = COALESCE(?, received_channel, 'barcode'),
                             updated_at = NOW() 
                         WHERE id = ?`,
                        [paymentMethod, originalAmount, fine, interest, finalAmount, paymentDate, receivedChannel, tx.id]
                    );
                    await conn.query(
                        `UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?`,
                        [finalAmount, tx.bank_account_id]
                    );

                    await FinanceService.triggerSolidconBaixaIfNeeded(
                        conn,
                        companyId,
                        tx.id,
                        tx.solidcon_key,
                        tx.solidcon_quitado,
                        finalAmount
                    );
                });
            } else {
                await pool.query(
                    `UPDATE transactions 
                     SET payment_method = COALESCE(payment_method, ?),
                         original_amount = ?, 
                         fine = ?, 
                         interest = ?, 
                         amount = ?, 
                         received_channel = COALESCE(?, received_channel),
                         updated_at = NOW() 
                     WHERE id = ?`,
                    [paymentMethod, originalAmount, fine, interest, finalAmount, receivedChannel, tx.id]
                );
            }
            return 'PAGO';
        } else {
            if (originalAmount) {
                await pool.query(
                    `UPDATE transactions SET original_amount = ?, updated_at = NOW() WHERE id = ?`,
                    [originalAmount, tx.id]
                );
            }
        }
        
        return situacao;
    }

    static extractTxidFromPixCode(pixCode: string): string | null {
        if (!pixCode) return null;
        const index62 = pixCode.indexOf('62');
        if (index62 === -1) return null;
        
        const length62Str = pixCode.substring(index62 + 2, index62 + 4);
        const length62 = parseInt(length62Str, 10);
        if (isNaN(length62)) return null;
        
        const value62 = pixCode.substring(index62 + 4, index62 + 4 + length62);
        const index05 = value62.indexOf('05');
        if (index05 === -1) return null;
        
        const length05Str = value62.substring(index05 + 2, index05 + 4);
        const length05 = parseInt(length05Str, 10);
        if (isNaN(length05)) return null;
        
        return value62.substring(index05 + 4, index05 + 4 + length05);
    }

    static async syncTransactionPaymentStatus(companyId: number, transactionPublicId: string): Promise<string> {
        const [txRows] = await pool.query<RowDataPacket[]>(
            `SELECT t.*, b.public_id as bank_acc_public_id, b.id as bank_account_id
             FROM transactions t
             JOIN bank_accounts b ON t.bank_account_id = b.id
             WHERE b.company_id = ? AND t.public_id = ? LIMIT 1`,
            [companyId, transactionPublicId]
        );

        if (txRows.length === 0) throw new Error('Transação não encontrada');
        const tx = txRows[0] as any;

        if (tx.status === 'paid') {
            return 'PAGO';
        }

        // 1. If it is a Billet (or hybrid Pix/Boleto)
        if (tx.billet_url) {
            return await this.syncBoletoStatus(companyId, transactionPublicId);
        }

        // 2. If it has a Pix txid (dynamic Pix or dynamic hybrid Pix)
        const pixTxid = this.extractTxidFromPixCode(tx.pix_code);
        if (pixTxid) {
            const bankAccount = await BankAccountService.getByPublicId(tx.bank_acc_public_id, companyId);
            const { InterService } = await import('./bankAccountApi/interService');
            
            const pixData = await InterService.getPixDetails(bankAccount, pixTxid);
            const status = pixData.status || '';
            if (status === 'CONCLUIDA') {
                const originalAmount = pixData.valor?.original !== undefined && pixData.valor?.original !== null 
                    ? Number(pixData.valor.original) 
                    : Number(tx.original_amount !== null && tx.original_amount !== undefined ? tx.original_amount : tx.amount);
                let fine = Number(pixData.valor?.multa || tx.fine || 0);
                let interest = Number(pixData.valor?.juros || tx.interest || 0);
                const pixPaidAmount = pixData.pix?.[0]?.valor ? Number(pixData.pix[0].valor) : (pixData.valor?.final ? Number(pixData.valor.final) : null);
                let finalAmount = pixPaidAmount !== null ? pixPaidAmount : (originalAmount + fine + interest);
                
                if (pixPaidAmount !== null && pixPaidAmount > originalAmount) {
                    const diff = Math.round((pixPaidAmount - originalAmount) * 100) / 100;
                    if (fine === 0 && interest === 0) {
                        interest = diff;
                    } else if (Math.round((fine + interest) * 100) / 100 !== diff) {
                        interest = Math.max(0, Math.round((diff - fine) * 100) / 100);
                    }
                }

                const paymentDate = pixData.pix?.[0]?.horario || null;

                await FinanceTransactionRepository.withTransaction(async (conn) => {
                    await conn.query(
                        `UPDATE transactions 
                         SET status = 'paid', 
                             payment_method = 'pix',
                             received_channel = 'pix_qr',
                             original_amount = ?, 
                             fine = ?, 
                             interest = ?, 
                             amount = ?, 
                             received_at = COALESCE(?, NOW()), 
                             updated_at = NOW() 
                         WHERE id = ?`,
                        [originalAmount, fine, interest, finalAmount, paymentDate, tx.id]
                    );
                    await conn.query(
                        `UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?`,
                        [finalAmount, tx.bank_account_id]
                    );

                    await FinanceService.triggerSolidconBaixaIfNeeded(
                        conn,
                        companyId,
                        tx.id,
                        tx.solidcon_key,
                        tx.solidcon_quitado,
                        finalAmount
                    );
                });
                return 'PAGO';
            }
            return status === 'ATIVA' ? 'ABERTO' : status;
        }

        // 3. Fallback: manual PIX with key but no dynamic txid
        return 'ABERTO';
    }

    static async batchSyncPayments(companyId: number, transactionPublicIds: string[]): Promise<{ success: number; errors: string[] }> {
        let successCount = 0;
        const errors: string[] = [];

        if (!transactionPublicIds || transactionPublicIds.length === 0) {
            return { success: 0, errors: [] };
        }

        // Sync statements for last 3 days for all involved accounts first
        try {
            const [accRows] = await pool.query<RowDataPacket[]>(
                `SELECT DISTINCT b.public_id
                 FROM transactions t
                 JOIN bank_accounts b ON t.bank_account_id = b.id
                 WHERE b.company_id = ? AND t.public_id IN (?)`,
                [companyId, transactionPublicIds]
            );

            const today = new Date();
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(today.getDate() - 3);

            const startDate = threeDaysAgo.toISOString().slice(0, 10);
            const endDate = today.toISOString().slice(0, 10);

            for (const acc of accRows) {
                try {
                    const bankAccount = await BankAccountService.getByPublicId(acc.public_id, companyId);
                    const { InterService } = await import('./bankAccountApi/interService');
                    await InterService.syncStatements(companyId, bankAccount, startDate, endDate);
                } catch (e) {
                }
            }
        } catch (e) {
            console.warn('[BatchSyncPayments] Failed to sync statements in batch prefix:', e);
        }

        // Now sync each transaction payment status
        for (const pubId of transactionPublicIds) {
            let firstRow: any = null;
            try {
                // First see if it matched via statement sync (which updates tx.status to 'paid' in background)
                const [statusRow] = await pool.query<RowDataPacket[]>(
                    `SELECT t.id, t.status, t.amount, t.bank_account_id, t.payment_method, t.date, c.name as customer_name
                     FROM transactions t
                     LEFT JOIN customers c ON t.customer_id = c.id
                     WHERE t.public_id = ? LIMIT 1`,
                    [pubId]
                );
                firstRow = statusRow[0];
                if (!firstRow) {
                    errors.push(`Receita ${pubId}: Transação não encontrada.`);
                    continue;
                }
                const tx = firstRow as any;
                const displayName = tx.customer_name || `Receita ${pubId}`;

                if (tx.status === 'paid') {
                    successCount++;
                    continue;
                }

                // If still pending, try dynamic API check
                const status = await this.syncTransactionPaymentStatus(companyId, pubId);
                if (status === 'PAGO' || status === 'RECEBIDO') {
                    successCount++;
                } else {
                    // Try to match locally against statements table since we just synchronized the statement
                    const [stmtRows] = await pool.query<RowDataPacket[]>(
                        `SELECT id FROM bank_statements 
                         WHERE bank_account_id = ? AND amount = ? AND type = 'income'
                         AND date >= DATE_SUB(?, INTERVAL 2 DAY) AND date <= DATE_ADD(?, INTERVAL 2 DAY)
                         LIMIT 1`,
                        [tx.bank_account_id, tx.amount, tx.date, tx.date]
                    );

                    if (stmtRows.length > 0) {
                        // Mark as paid
                        await FinanceTransactionRepository.withTransaction(async (conn) => {
                            await conn.query(
                                `UPDATE transactions SET status = 'paid', received_at = NOW(), updated_at = NOW() WHERE public_id = ?`,
                                [pubId]
                            );
                            await conn.query(
                                `UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?`,
                                [tx.amount, tx.bank_account_id]
                            );
                        });
                        successCount++;
                    } else {
                        errors.push(`${displayName}: Ainda em aberto no banco.`);
                    }
                }
            } catch (error: any) {
                const displayName = firstRow?.customer_name || `Receita ${pubId}`;
                errors.push(`${displayName}: ${error.message || String(error)}`);
            }
        }

        return { success: successCount, errors };
    }

    /**
     * Pays a pending expense using the linked bank account's API credentials
     */
    static async payExpense(companyId: number, expensePublicId: string): Promise<{ status: string; message: string; codigoSolicitacao?: string }> {
        // 1. Get transaction details
        const [txRows] = await FinanceTransactionRepository.getTransactionByPublicId(pool, companyId, expensePublicId, 'expense');
        if (!txRows) {
            throw new Error('Despesa não encontrada.');
        }
        const transaction = txRows;

        if (transaction.status === 'paid') {
            throw new Error('Esta despesa já está paga.');
        }

        // 2. Find the linked bank account
        const [bankRows] = await pool.query<RowDataPacket[]>(
            'SELECT public_id FROM bank_accounts WHERE id = ? AND company_id = ? LIMIT 1',
            [transaction.bank_account_id, companyId]
        );
        if (!bankRows || bankRows.length === 0) {
            throw new Error('Conta bancária associada à despesa não encontrada.');
        }

        const bankAccountPublicId = bankRows[0]!.public_id;
        const bankAccount = await BankAccountService.getByPublicId(bankAccountPublicId, companyId);

        if (!bankAccount.api_client_id || !bankAccount.api_client_secret || !bankAccount.api_certificate || !bankAccount.api_key) {
            throw new Error('A conta bancária associada não possui credenciais da API do Banco configuradas.');
        }

        // 3. Import InterService and request payment
        const { InterService } = await import('./bankAccountApi/interService');
        const result = await InterService.payTransaction(bankAccount, transaction);

        if (result.status === 'success') {
            const isScheduled = String(result.message).toLowerCase().includes('agendado') || String(result.message).toLowerCase().includes('agendamento');
            
            if (isScheduled) {
                // Update the transaction in database to scheduled
                await pool.query(
                    `UPDATE transactions 
                     SET status = 'scheduled', scheduled_at = NOW(), updated_at = NOW() 
                     WHERE id = ? AND company_id = ?`,
                    [transaction.id, companyId]
                );
            } else {
                // Update the transaction in database to paid
                await pool.query(
                    `UPDATE transactions 
                     SET status = 'paid', received_at = NOW(), updated_at = NOW() 
                     WHERE id = ? AND company_id = ?`,
                    [transaction.id, companyId]
                );

                // Update the bank account balance
                await pool.query(
                    `UPDATE bank_accounts 
                     SET current_balance = current_balance - ?, updated_at = NOW() 
                     WHERE id = ? AND company_id = ?`,
                    [transaction.amount, bankAccount.id, companyId]
                );
            }
        }

        return result;
    }

    static async listPixCharges(companyId: number): Promise<any[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT t.public_id, t.description, t.amount, t.status, t.date, t.received_at, t.pix_code, u.full_name as user_name
             FROM transactions t
             LEFT JOIN users u ON t.user_id = u.id
             WHERE t.company_id = ? AND t.payment_method = 'pix' AND t.type = 'income'
             ORDER BY t.date DESC, t.created_at DESC`,
            [companyId]
        );
        return rows;
    }

    /**
     * Gera uma cobrança Pix imediata direcionando para a conta padrão do usuário
     */
    static async generateDirectPix(companyId: number, userPublicId: string, amount: number, description: string): Promise<{ txid: string; pixCopiaECola: string; qrCodeBase64?: string }> {
        // 1. Obter o default_bank_account_id do usuário logado
        const [userRows]: any = await pool.query(
            `SELECT id, default_bank_account_id FROM users WHERE company_id = ? AND public_id = ? LIMIT 1`,
            [companyId, userPublicId]
        );
        const userObj = userRows[0];
        if (!userObj) {
            throw new AppError('Usuário não encontrado', 404);
        }
        if (!userObj.default_bank_account_id) {
            throw new AppError('O seu usuário não possui uma conta bancária padrão configurada. Por favor, acesse o menu Usuários e defina uma conta padrão na aba Configuração.', 400);
        }

        // 2. Buscar dados da conta bancária
        let bankAccount;
        try {
            bankAccount = await BankAccountService.getById(userObj.default_bank_account_id, companyId);
        } catch (e) {
            throw new AppError('Conta bancária padrão configurada não foi encontrada.', 404);
        }

        // 3. Importar InterService e gerar a cobrança Pix imediata no Banco Inter
        const { InterService } = await import('./bankAccountApi/interService');
        
        const txid = randomUUID().replace(/-/g, '');
        const interResult = await InterService.createImmediatePix(bankAccount, amount, description, txid);

        // 4. Salvar como uma transação pendente (status = 'progress', payment_method = 'pix') no banco de dados
        await FinanceTransactionRepository.withTransaction(async (conn: PoolConnection) => {
            // Obter uma categoria padrão de "Receita" ou criar/usar uma genérica
            const [catRows]: any = await conn.query(
                `SELECT id FROM categories WHERE company_id = ? AND type = 'income' LIMIT 1`,
                [companyId]
            );
            const categoryId = catRows[0]?.id || null;

            await FinanceTransactionRepository.insertTransaction(conn, {
                public_id: txid,
                company_id: companyId,
                bank_account_id: bankAccount.id,
                category_id: categoryId,
                user_id: userObj.id,
                description: description,
                amount: amount,
                net_amount: amount,
                type: 'income',
                payment_method: 'pix',
                date: new Date().toISOString().slice(0, 10),
                date_launch: toBrazilDbDateTime(new Date()),
                status: 'progress',
                pix_code: interResult.pixCopiaECola,
                pix_key: bankAccount.pix_key || null
            });
        });

        return interResult;
    }

    static calculateTransactionFineAndInterest(tx: any, _bankAccount?: any): {
        fine: number;
        interest: number;
        totalFineInterest: number;
        daysOverdue: number;
        nrCupom: string | null;
        customerName: string;
        description: string;
    } {
        const isCustomerExempt = Boolean(
            tx.customer_exempt_interest_fine === 1 ||
            tx.customer_exempt_interest_fine === true ||
            tx.cust_exempt_interest_fine === 1 ||
            tx.cust_exempt_interest_fine === true ||
            tx.exempt_interest_fine === 1 ||
            tx.exempt_interest_fine === true
        );

        let fine = isCustomerExempt ? 0 : Number(tx.fine || 0);
        let interest = isCustomerExempt ? 0 : Number(tx.interest || 0);
        let totalFineInterest = fine + interest;

        if (!isCustomerExempt && totalFineInterest <= 0 && tx.original_amount && Number(tx.amount) > Number(tx.original_amount)) {
            totalFineInterest = Number(tx.amount) - Number(tx.original_amount);
            fine = totalFineInterest;
        }

        let daysOverdue = 0;
        if (tx.date) {
            const dueDateStr = typeof tx.date === 'string' ? tx.date.slice(0, 10) : new Date(tx.date).toISOString().slice(0, 10);
            const [year, month, day] = dueDateStr.split('-').map(Number);
            if (year && month && day) {
                const dueDate = new Date(year, month - 1, day);
                const dayOfWeek = dueDate.getDay(); // 0 = Domingo, 6 = Sábado
                if (dayOfWeek === 6) dueDate.setDate(dueDate.getDate() + 2);
                else if (dayOfWeek === 0) dueDate.setDate(dueDate.getDate() + 1);

                let paymentDate = new Date();
                paymentDate.setHours(0, 0, 0, 0);
                if (tx.received_at || tx.date_launch) {
                    const payStr = typeof (tx.received_at || tx.date_launch) === 'string'
                        ? (tx.received_at || tx.date_launch).slice(0, 10)
                        : new Date(tx.received_at || tx.date_launch).toISOString().slice(0, 10);
                    const [pY, pM, pD] = payStr.split('-').map(Number);
                    if (pY && pM && pD) paymentDate = new Date(pY, pM - 1, pD);
                }

                const diff = Math.floor((paymentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                if (diff > 0) daysOverdue = diff;
            }
        }

        totalFineInterest = Math.round(totalFineInterest * 100) / 100;

        const descStr = String(tx.description || '');
        const cupomMatch = descStr.match(/Cupom\s*#?\s*(\d+)/i);
        const nrCupom = cupomMatch?.[1] || (tx.solidcon_key ? String(tx.solidcon_key) : null);
        const customerName = String(tx.customer_name || tx.entity_name || '').trim();

        const daysText = `${daysOverdue || 1} ${daysOverdue === 1 ? 'dia' : 'dias'}`;
        const custSuffix = customerName ? ` - ${customerName}` : '';
        const cupomSuffix = nrCupom ? `Ref: Cupom #${nrCupom}${custSuffix}` : (descStr || 'Convênio');
        const description = `Juros de convênio pago em atraso (${daysText}) - ${cupomSuffix}`;

        return {
            fine,
            interest,
            totalFineInterest,
            daysOverdue,
            nrCupom,
            customerName,
            description
        };
    }

    /**
     * Se o lançamento de convênio/Solidcon/boleto possuir multa + juros na hora da baixa,
     * registra o lançamento de juros diretamente no Solidcon (tbBancoContaMovimento)
     * e garante a limpeza de duplicidades no Keystone.
     */
    static async createInterestRevenueIfApplicable(
        conn: PoolConnection,
        companyId: number,
        tx: any
    ): Promise<boolean> {
        if (!tx || !tx.id) return false;

        try {
            const company = await CompanyService.getById(companyId);
            if (!company || !company.serv_solidcon || !company.bd_solidcon || !company.login_solidcon || !company.senha_solidcon) {
                return false;
            }

            let bankAccount: any = null;
            if (tx.bank_account_id) {
                const [bankRows]: any = await conn.query(
                    `SELECT solidcon_bank_id, name, account_number, billet_fine, billet_interest, pix_fine, pix_interest 
                     FROM bank_accounts WHERE id = ? AND company_id = ?`,
                    [tx.bank_account_id, companyId]
                );
                bankAccount = bankRows?.[0] || null;
            }

            const solidconPassword = decrypt(company.senha_solidcon) || company.senha_solidcon;
            const jurosInfo = FinanceService.calculateTransactionFineAndInterest(tx, bankAccount);
            if (jurosInfo.totalFineInterest <= 0) {
                if (tx.solidcon_interest_key) {
                    try {
                        await ExternalDbService.removerReceitaSolidcon({
                            host: company.serv_solidcon,
                            database: company.bd_solidcon,
                            user: company.login_solidcon,
                            password: solidconPassword
                        }, {
                            cdConta: tx.solidcon_interest_key,
                            documento: jurosInfo.nrCupom
                        });
                    } catch (remErr) {
                        logger.warn({ remErr, txId: tx.id }, 'Warning removing zero-interest revenue from Solidcon');
                    }
                    await conn.query('UPDATE transactions SET solidcon_interest_key = NULL WHERE id = ?', [tx.id]);
                }
                return false;
            }

            const intKey = await ExternalDbService.registrarJurosSolidcon({
                host: company.serv_solidcon,
                database: company.bd_solidcon,
                user: company.login_solidcon,
                password: solidconPassword
            }, {
                totalFineInterest: jurosInfo.totalFineInterest,
                daysOverdue: jurosInfo.daysOverdue,
                description: jurosInfo.description,
                customerName: jurosInfo.customerName,
                nrCupom: jurosInfo.nrCupom,
                cdCrediarioCupom: tx.solidcon_key ? parseInt(tx.solidcon_key, 10) : null,
                cdFilial: tx.cdfilial || company.cdfilial || '1',
                cdPDV: tx.pdv || company.cdpdv || null
            }, bankAccount ? {
                solidcon_bank_id: bankAccount.solidcon_bank_id,
                name: bankAccount.name,
                account_number: bankAccount.account_number
            } : undefined);

            if (intKey && tx.id) {
                const fineVal = jurosInfo.fine || jurosInfo.totalFineInterest || 0;
                const interestVal = jurosInfo.interest || 0;
                await conn.query(
                    `UPDATE transactions 
                     SET solidcon_interest_key = ?, 
                         fine = COALESCE(NULLIF(fine, 0), ?), 
                         interest = COALESCE(NULLIF(interest, 0), ?),
                         original_amount = COALESCE(original_amount, amount),
                         amount = CASE 
                             WHEN status = 'paid' THEN COALESCE(original_amount, amount) + ? + ?
                             ELSE amount 
                         END,
                         updated_at = NOW() 
                     WHERE id = ?`,
                    [intKey, fineVal, interestVal, fineVal, interestVal, tx.id]
                );
            }

            // Remover do Keystone qualquer lançamento separado de juros criado anteriormente para evitar duplicidade na listagem
            await conn.query(
                `DELETE FROM transactions 
                 WHERE company_id = ? AND (
                     description LIKE ? OR description LIKE ? OR (
                         description LIKE ? AND (description LIKE ? OR description LIKE ?)
                     )
                 )`,
                [
                    companyId,
                    `%[ORIGIN_TX:${tx.id}]%`,
                    `%[ORIGIN_TX:${tx.public_id}]%`,
                    '%Juros de conv%',
                    `%Cupom #${jurosInfo.nrCupom || '---'}%`,
                    `%Ref: ${jurosInfo.nrCupom || '---'}%`
                ]
            );

            logger.info(`Solidcon interest movement registered for cupom #${jurosInfo.nrCupom || tx.id} (R$ ${jurosInfo.totalFineInterest}).`);
            return true;
        } catch (err: any) {
            logger.error({ err }, `Error registering interest in Solidcon for transaction ${tx.id}`);
            return false;
        }
    }

    static async triggerSolidconBaixaIfNeeded(
        conn: PoolConnection,
        companyId: number,
        transactionId: number,
        solidconKey: string | null | undefined,
        solidconQuitado: number | null | undefined,
        amount: number
    ): Promise<void> {
        if (solidconQuitado === 1) {
            return;
        }

        try {
            const company = await CompanyService.getById(companyId);
            if (!company) return;

            const isSolidcon = !!company.serv_solidcon;
            if (!isSolidcon) return;

            const server = company.serv_solidcon;
            const database = company.bd_solidcon;
            const user = company.login_solidcon;
            const password = decrypt(company.senha_solidcon) || company.senha_solidcon;

            if (!server || !database || !user || !password) {
                logger.warn(`Solidcon integration config is incomplete for company ${companyId}. Skipping automatic Solidcon payment/baixa.`);
                return;
            }

            // Fetch transaction details
            const [txRows]: any[] = await conn.query(
                `SELECT t.bank_account_id, t.description, t.pdv, t.cdfilial, t.solidcon_key, t.fine, t.interest, t.original_amount, t.amount, t.date, t.date_launch, t.received_at, t.payment_method, c.name as customer_name, c.only_solidcon_baixa 
                 FROM transactions t
                 LEFT JOIN customers c ON c.id = t.customer_id
                 WHERE t.id = ?`,
                [transactionId]
            );
            if (!txRows || txRows.length === 0) return;
            const tx = txRows[0];

            if (tx.only_solidcon_baixa === 1 || tx.only_solidcon_baixa === true) {
                logger.info(`Customer ${tx.customer_name || ''} has only_solidcon_baixa enabled. Skipping automatic Solidcon payment/baixa for transaction ${transactionId}.`);
                return;
            }

            let cdCrediarioCupom: number | null = null;
            let resolvedCupomKey = solidconKey || tx.solidcon_key;

            if (resolvedCupomKey) {
                cdCrediarioCupom = parseInt(resolvedCupomKey, 10);
                if (isNaN(cdCrediarioCupom)) cdCrediarioCupom = null;
            }

            // Fallback using description
            const description = String(tx.description || '');
            const cupomMatch = description.match(/Cupom\s*#?\s*(\d+)/i);
            const nrCupom = cupomMatch?.[1];

            const filialVal = tx.cdfilial || company.cdfilial || '1';
            const pdvVal = tx.pdv || company.cdpdv || null;

            const fallbackInfo = {
                nrCupom: nrCupom ? parseInt(nrCupom, 10) : (cdCrediarioCupom || null),
                cdFilial: filialVal ? String(filialVal).trim() : null,
                cdPDV: pdvVal ? String(pdvVal).trim() : null
            };

            const bankAccountId = tx.bank_account_id;
            let bankAccountInfo: any = undefined;
            let bankAccountFull: any = undefined;
            if (bankAccountId) {
                const [bankRows]: any[] = await conn.query(
                    `SELECT solidcon_bank_id, name, institution, agency_number, account_number, billet_fine, billet_interest, pix_fine, pix_interest FROM bank_accounts WHERE id = ?`,
                    [bankAccountId]
                );
                if (bankRows?.[0]) {
                    bankAccountFull = bankRows[0];
                    bankAccountInfo = {
                        solidcon_bank_id: bankRows[0].solidcon_bank_id,
                        name: bankRows[0].name,
                        institution: bankRows[0].institution,
                        agency_number: bankRows[0].agency_number,
                        account_number: bankRows[0].account_number
                    };
                }
            }

            const jurosInfo = FinanceService.calculateTransactionFineAndInterest(tx, bankAccountFull);

            const poolMsSql = new sql.ConnectionPool({
                user,
                password,
                server,
                database,
                options: {
                    encrypt: false,
                    trustServerCertificate: true
                },
                connectionTimeout: 10000,
                requestTimeout: 15000
            });

            await poolMsSql.connect();
            try {
                let resolvedRow: any = null;
                const filialStr = fallbackInfo?.cdFilial ? String(fallbackInfo.cdFilial).trim() : (company.cdfilial ? String(company.cdfilial).trim() : null);
                const pdvStr = fallbackInfo?.cdPDV ? String(fallbackInfo.cdPDV).trim() : (company.cdpdv ? String(company.cdpdv).trim() : null);

                let filialClause = '';
                if (filialStr) {
                    const filials = filialStr.split(',').map(f => parseInt(f.trim(), 10)).filter(f => !isNaN(f));
                    if (filials.length > 0) {
                        filialClause = ` AND (TRY_CAST(cdFilial AS INT) IN (${filials.join(',')}) OR CAST(cdFilial AS VARCHAR) IN (${filials.map(f => `'${f}'`).join(',')}))`;
                    }
                }
                let pdvClause = '';
                if (pdvStr) {
                    const pdvs = pdvStr.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
                    if (pdvs.length > 0) {
                        pdvClause = ` AND (TRY_CAST(cdPDV AS INT) IN (${pdvs.join(',')}) OR CAST(cdPDV AS VARCHAR) IN (${pdvs.map(p => `'${p}'`).join(',')}))`;
                    }
                }

                if (cdCrediarioCupom) {
                    const reqCupom = poolMsSql.request();
                    reqCupom.input('cdCrediarioCupom', sql.Int, cdCrediarioCupom);
                    if (filialClause && pdvClause) {
                        const resCupom = await reqCupom.query(`
                            SELECT TOP 1 cdCrediarioCupom, cdFilial, cdPDV FROM tbCrediarioCupom 
                            WHERE cdCrediarioCupom = @cdCrediarioCupom ${filialClause} ${pdvClause}
                        `);
                        resolvedRow = resCupom.recordset?.[0];
                    }
                    if (!resolvedRow && filialClause) {
                        const resCupom = await reqCupom.query(`
                            SELECT TOP 1 cdCrediarioCupom, cdFilial, cdPDV FROM tbCrediarioCupom 
                            WHERE cdCrediarioCupom = @cdCrediarioCupom ${filialClause}
                        `);
                        resolvedRow = resCupom.recordset?.[0];
                    }
                    if (!resolvedRow && !filialClause) {
                        const resCupom = await reqCupom.query(`
                            SELECT TOP 1 cdCrediarioCupom, cdFilial, cdPDV FROM tbCrediarioCupom 
                            WHERE cdCrediarioCupom = @cdCrediarioCupom
                        `);
                        resolvedRow = resCupom.recordset?.[0];
                    }
                }

                const searchCupomNum = fallbackInfo?.nrCupom || (!resolvedRow && cdCrediarioCupom ? cdCrediarioCupom : null);
                if (!resolvedRow && searchCupomNum) {
                    const nrCupomNum = Number(searchCupomNum);
                    const nrCupomStr = String(searchCupomNum).trim();
                    const nrCupomPadded6 = nrCupomStr.padStart(6, '0');
                    const nrCupomPadded8 = nrCupomStr.padStart(8, '0');
                    const nrCupomPadded10 = nrCupomStr.padStart(10, '0');

                    const reqCupom = poolMsSql.request();
                    reqCupom.input('nrCupomStr', sql.VarChar, nrCupomStr);
                    reqCupom.input('nrCupomPadded6', sql.VarChar, nrCupomPadded6);
                    reqCupom.input('nrCupomPadded8', sql.VarChar, nrCupomPadded8);
                    reqCupom.input('nrCupomPadded10', sql.VarChar, nrCupomPadded10);
                    reqCupom.input('nrCupomNum', sql.BigInt, nrCupomNum);

                    let baseWhereClause = `(
                        nrCupom = @nrCupomStr 
                        OR nrCupom = @nrCupomPadded6 
                        OR nrCupom = @nrCupomPadded8 
                        OR nrCupom = @nrCupomPadded10
                        OR TRY_CAST(nrCupom AS BIGINT) = @nrCupomNum 
                        OR CAST(nrCupom AS VARCHAR) = @nrCupomStr
                        OR nrCupom LIKE '%' + @nrCupomStr
                    )`;

                    if (filialClause && pdvClause) {
                        const resCupom = await reqCupom.query(`
                            SELECT TOP 1 cdCrediarioCupom, cdFilial, cdPDV FROM tbCrediarioCupom 
                            WHERE ${baseWhereClause} ${filialClause} ${pdvClause}
                            ORDER BY cdCrediarioCupom DESC
                        `);
                        resolvedRow = resCupom.recordset?.[0];
                    }

                    if (!resolvedRow && filialClause) {
                        const resCupom = await reqCupom.query(`
                            SELECT TOP 1 cdCrediarioCupom, cdFilial, cdPDV FROM tbCrediarioCupom 
                            WHERE ${baseWhereClause} ${filialClause}
                            ORDER BY cdCrediarioCupom DESC
                        `);
                        resolvedRow = resCupom.recordset?.[0];
                    }

                    if (!resolvedRow && !filialClause) {
                        const resCupom = await reqCupom.query(`
                            SELECT TOP 1 cdCrediarioCupom, cdFilial, cdPDV FROM tbCrediarioCupom 
                            WHERE ${baseWhereClause}
                            ORDER BY cdCrediarioCupom DESC
                        `);
                        resolvedRow = resCupom.recordset?.[0];
                    }
                }

                if (resolvedRow) {
                    cdCrediarioCupom = resolvedRow.cdCrediarioCupom;
                    const foundFilial = resolvedRow.cdFilial;
                    const foundPDV = resolvedRow.cdPDV;
                    if (cdCrediarioCupom) {
                        await conn.query(
                            `UPDATE transactions SET solidcon_key = ?, cdfilial = COALESCE(cdfilial, ?), pdv = COALESCE(pdv, ?) WHERE id = ?`,
                            [String(cdCrediarioCupom), foundFilial ? String(foundFilial) : null, foundPDV ? String(foundPDV) : null, transactionId]
                        );
                    }
                } else {
                    logger.warn(`Cupom #${fallbackInfo?.nrCupom || searchCupomNum} não foi encontrado na tabela tbCrediarioCupom da Solidcon. Pulando baixa automática.`);
                    return;
                }

                if (!cdCrediarioCupom) {
                    logger.warn(`Could not resolve cupom ID for transaction ${transactionId}. Skipping automatic Solidcon payment/baixa.`);
                    return;
                }

                // Check if already paid/baixado in Solidcon
                let isBaixado = false;
                const reqCheck = poolMsSql.request();
                reqCheck.input('cdCrediarioCupom', sql.Int, cdCrediarioCupom);
                const resCheck = await reqCheck.query(`
                    SELECT cdCrediarioCupom FROM tbCrediarioCupomPagamento 
                    WHERE cdCrediarioCupom = @cdCrediarioCupom
                `);
                if (resCheck.recordset?.[0]) {
                    isBaixado = true;
                }

                if (!isBaixado) {
                    logger.info(`Performing automatic Solidcon payment/baixa for transaction ID ${transactionId} (cupom: ${cdCrediarioCupom})...`);
                    const baixaRes = await ExternalDbService.baixaCupomSolidcon({
                        host: server,
                        database,
                        user,
                        password
                    }, cdCrediarioCupom, Number(amount || tx.amount || 0), bankAccountInfo, fallbackInfo, jurosInfo);
                    if (baixaRes && tx.id) {
                        if (baixaRes.solidcon_interest_key) {
                            await conn.query('UPDATE transactions SET solidcon_interest_key = ? WHERE id = ?', [baixaRes.solidcon_interest_key, tx.id]);
                        }
                        if (baixaRes.cdCrediarioCupom) {
                            await conn.query('UPDATE transactions SET solidcon_key = COALESCE(solidcon_key, ?) WHERE id = ?', [String(baixaRes.cdCrediarioCupom), tx.id]);
                        }
                    }
                } else {
                    if (tx.bank_account_id && bankAccountInfo) {
                        logger.info(`Updating bank account for existing Solidcon payment of cupom ${cdCrediarioCupom}...`);
                        await ExternalDbService.updateBancoContaSolidcon({
                            host: server,
                            database,
                            user,
                            password
                        }, cdCrediarioCupom, bankAccountInfo);
                    }
                    if (jurosInfo.totalFineInterest > 0) {
                        const intKey = await ExternalDbService.registrarJurosSolidcon({
                            host: server,
                            database,
                            user,
                            password
                        }, {
                            totalFineInterest: jurosInfo.totalFineInterest,
                            daysOverdue: jurosInfo.daysOverdue,
                            description: jurosInfo.description,
                            customerName: jurosInfo.customerName,
                            nrCupom: jurosInfo.nrCupom || fallbackInfo?.nrCupom,
                            cdCrediarioCupom,
                            cdFilial: tx.cdfilial || company.cdfilial || '1',
                            cdPDV: tx.pdv || company.cdpdv || null
                        }, bankAccountInfo);
                        if (intKey && tx.id) {
                            await conn.query('UPDATE transactions SET solidcon_interest_key = ? WHERE id = ?', [intKey, tx.id]);
                        }
                    }
                }

                // Mark local transaction as solidcon_quitado = 1
                await conn.query(
                    `UPDATE transactions SET solidcon_quitado = 1, updated_at = NOW() WHERE id = ?`,
                    [transactionId]
                );
                logger.info(`Automatic payment/baixa completed successfully for cupom ${cdCrediarioCupom}.`);

            } finally {
                await poolMsSql.close();
            }
        } catch (err: any) {
            logger.error(`Error performing automatic Solidcon payment for transaction ${transactionId}: ${err.message}`, err);
        }
    }

    static async syncSolidconBaixas(companyId: number, transactionPublicIds?: string[]): Promise<{ success: boolean; checkedCount: number; syncedCount: number; cleanedCount?: number; errors: any[] }> {
        // Popula solidcon_key a partir da descrição para todas as transações da empresa que tenham 'Cupom' mas estejam com solidcon_key nulo
        try {
            const [cupomRows]: any = await pool.query(
                `SELECT id, description FROM transactions WHERE company_id = ? AND (solidcon_key IS NULL OR solidcon_key = '') AND (description LIKE '%Cupom%' OR description LIKE '%cupom%')`,
                [companyId]
            );
            for (const cr of cupomRows) {
                const match = String(cr.description || '').match(/Cupom\s*#?\s*(\d+)/i);
                if (match && match[1]) {
                    await pool.query('UPDATE transactions SET solidcon_key = ? WHERE id = ?', [match[1].trim(), cr.id]);
                }
            }
        } catch (populateErr) {
            logger.warn({ err: populateErr }, '[syncSolidconBaixas] Erro ao extrair solidcon_key de descrições');
        }

        let query = `SELECT t.id, t.public_id, t.solidcon_key, t.amount, t.original_amount, t.fine, t.interest, t.date, t.date_launch, t.received_at, t.payment_method, t.bank_account_id, t.description, t.pdv, t.cdfilial, t.status, b.solidcon_bank_id, b.name as bank_name, b.account_number as bank_account_number, b.billet_fine, b.billet_interest, b.pix_fine, b.pix_interest, c.name as customer_name, c.only_solidcon_baixa, c.exempt_interest_fine
             FROM transactions t
             LEFT JOIN bank_accounts b ON t.bank_account_id = b.id
             LEFT JOIN customers c ON c.id = t.customer_id
             WHERE t.company_id = ?`;
        const params: any[] = [companyId];

        if (transactionPublicIds && transactionPublicIds.length > 0) {
            query += ` AND t.public_id IN (?)`;
            params.push(transactionPublicIds);
        } else {
            // Se não especificou transações, processa apenas as pagas que ainda não foram marcadas como quitadas no Solidcon
            query += ` AND t.status = 'paid' AND (t.solidcon_quitado = 0 OR t.solidcon_quitado IS NULL) AND (t.solidcon_key IS NOT NULL OR t.description LIKE '%Cupom%')`;
        }

        const [transactions]: any = await pool.query(query, params);

        if (transactions.length === 0) {
            return { success: true, checkedCount: 0, syncedCount: 0, cleanedCount: 0, errors: [] };
        }

        const company = await CompanyService.getById(companyId);
        if (!company) {
            throw new Error('Empresa nao encontrada.');
        }

        const isSolidcon = !!company.serv_solidcon;
        let server = isSolidcon ? company.serv_solidcon : company.serv_dorsal;
        const database = isSolidcon ? company.bd_solidcon : company.bd_dorsal;
        const user = isSolidcon ? company.login_solidcon : company.login_dorsal;
        const rawPassword = isSolidcon ? company.senha_solidcon : company.senha_dorsal;
        const password = rawPassword ? (decrypt(rawPassword) || rawPassword) : '';

        if (!server || !database || !user || !password) {
            throw new Error('Configuracao de banco de dados externo incompleta.');
        }

        let port = 1433;
        if (server.includes(',')) {
            const parts = server.split(',');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || 1433;
        } else if (server.includes(':')) {
            const parts = server.split(':');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || 1433;
        }

        let checkedCount = 0;
        let syncedCount = 0;
        let cleanedCount = 0;
        const errors: any[] = [];

        const poolMsSql = new sql.ConnectionPool({
            user,
            password,
            server,
            database,
            port,
            options: {
                encrypt: false,
                trustServerCertificate: true
            },
            connectionTimeout: 10000,
            requestTimeout: 15000
        });

        await poolMsSql.connect();
        try {
            for (const tx of transactions) {
                checkedCount++;
                try {
                    let cdCrediarioCupom: number | null = null;
                    let resolvedCupomKey = tx.solidcon_key;

                    if (resolvedCupomKey) {
                        cdCrediarioCupom = parseInt(resolvedCupomKey, 10);
                        if (isNaN(cdCrediarioCupom)) cdCrediarioCupom = null;
                    }

                    // Fallback using description
                    const description = String(tx.description || '');
                    const cupomMatch = description.match(/Cupom\s*#?\s*(\d+)/i);
                    const nrCupom = cupomMatch?.[1];

                    const filialVal = tx.cdfilial || company.cdfilial || '1';
                    const pdvVal = tx.pdv || company.cdpdv || null;

                    const fallbackInfo = {
                        nrCupom: nrCupom ? parseInt(nrCupom, 10) : (cdCrediarioCupom || null),
                        cdFilial: filialVal ? String(filialVal).trim() : null,
                        cdPDV: pdvVal ? String(pdvVal).trim() : null
                    };

                    // Se não temos cdCrediarioCupom direto nem nrCupom no histórico, não há como prosseguir
                    if (!cdCrediarioCupom && !fallbackInfo.nrCupom) {
                        continue;
                    }

                    const filialStr = fallbackInfo?.cdFilial ? String(fallbackInfo.cdFilial).trim() : (company.cdfilial ? String(company.cdfilial).trim() : null);
                    const pdvStr = fallbackInfo?.cdPDV ? String(fallbackInfo.cdPDV).trim() : (company.cdpdv ? String(company.cdpdv).trim() : null);

                    let filialClause = '';
                    if (filialStr) {
                        const filials = filialStr.split(',').map(f => parseInt(f.trim(), 10)).filter(f => !isNaN(f));
                        if (filials.length > 0) {
                            filialClause = ` AND (TRY_CAST(cdFilial AS INT) IN (${filials.join(',')}) OR CAST(cdFilial AS VARCHAR) IN (${filials.map(f => `'${f}'`).join(',')}))`;
                        }
                    }
                    let pdvClause = '';
                    if (pdvStr) {
                        const pdvs = pdvStr.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
                        if (pdvs.length > 0) {
                            pdvClause = ` AND (TRY_CAST(cdPDV AS INT) IN (${pdvs.join(',')}) OR CAST(cdPDV AS VARCHAR) IN (${pdvs.map(p => `'${p}'`).join(',')}))`;
                        }
                    }

                    // Buscar o cupom na tabela tbCrediarioCupom
                    let resolvedRow: any = null;

                    if (cdCrediarioCupom) {
                        const reqCupom = poolMsSql.request();
                        reqCupom.input('cdCrediarioCupom', sql.Int, cdCrediarioCupom);
                        if (filialClause && pdvClause) {
                            const resCupom = await reqCupom.query(`
                                SELECT TOP 1 cdCrediarioCupom, cdFilial, cdPDV FROM tbCrediarioCupom 
                                WHERE cdCrediarioCupom = @cdCrediarioCupom ${filialClause} ${pdvClause}
                            `);
                            resolvedRow = resCupom.recordset?.[0];
                        }
                        if (!resolvedRow && filialClause) {
                            const resCupom = await reqCupom.query(`
                                SELECT TOP 1 cdCrediarioCupom, cdFilial, cdPDV FROM tbCrediarioCupom 
                                WHERE cdCrediarioCupom = @cdCrediarioCupom ${filialClause}
                            `);
                            resolvedRow = resCupom.recordset?.[0];
                        }
                        if (!resolvedRow && !filialClause) {
                            const resCupom = await reqCupom.query(`
                                SELECT TOP 1 cdCrediarioCupom, cdFilial, cdPDV FROM tbCrediarioCupom 
                                WHERE cdCrediarioCupom = @cdCrediarioCupom
                            `);
                            resolvedRow = resCupom.recordset?.[0];
                        }
                    }

                    const searchCupomNum = fallbackInfo?.nrCupom || (!resolvedRow && cdCrediarioCupom ? cdCrediarioCupom : null);
                    if (!resolvedRow && searchCupomNum) {
                        const nrCupomNum = Number(searchCupomNum);
                        const nrCupomStr = String(searchCupomNum).trim();
                        const nrCupomPadded6 = nrCupomStr.padStart(6, '0');
                        const nrCupomPadded8 = nrCupomStr.padStart(8, '0');
                        const nrCupomPadded10 = nrCupomStr.padStart(10, '0');

                        const reqCupom = poolMsSql.request();
                        reqCupom.input('nrCupomStr', sql.VarChar, nrCupomStr);
                        reqCupom.input('nrCupomPadded6', sql.VarChar, nrCupomPadded6);
                        reqCupom.input('nrCupomPadded8', sql.VarChar, nrCupomPadded8);
                        reqCupom.input('nrCupomPadded10', sql.VarChar, nrCupomPadded10);
                        reqCupom.input('nrCupomNum', sql.BigInt, nrCupomNum);

                        let baseWhereClause = `(
                            nrCupom = @nrCupomStr 
                            OR nrCupom = @nrCupomPadded6 
                            OR nrCupom = @nrCupomPadded8 
                            OR nrCupom = @nrCupomPadded10
                            OR TRY_CAST(nrCupom AS BIGINT) = @nrCupomNum 
                            OR CAST(nrCupom AS VARCHAR) = @nrCupomStr
                            OR nrCupom LIKE '%' + @nrCupomStr
                        )`;

                        if (filialClause && pdvClause) {
                            const resCupom = await reqCupom.query(`
                                SELECT TOP 1 cdCrediarioCupom, cdFilial, cdPDV FROM tbCrediarioCupom 
                                WHERE ${baseWhereClause} ${filialClause} ${pdvClause}
                                ORDER BY cdCrediarioCupom DESC
                            `);
                            resolvedRow = resCupom.recordset?.[0];
                        }

                        if (!resolvedRow && filialClause) {
                            const resCupom = await reqCupom.query(`
                                SELECT TOP 1 cdCrediarioCupom, cdFilial, cdPDV FROM tbCrediarioCupom 
                                WHERE ${baseWhereClause} ${filialClause}
                                ORDER BY cdCrediarioCupom DESC
                            `);
                            resolvedRow = resCupom.recordset?.[0];
                        }

                        if (!resolvedRow && !filialClause) {
                            const resCupom = await reqCupom.query(`
                                SELECT TOP 1 cdCrediarioCupom, cdFilial, cdPDV FROM tbCrediarioCupom 
                                WHERE ${baseWhereClause}
                                ORDER BY cdCrediarioCupom DESC
                            `);
                            resolvedRow = resCupom.recordset?.[0];
                        }
                    }

                    if (resolvedRow) {
                        cdCrediarioCupom = resolvedRow.cdCrediarioCupom;
                        resolvedCupomKey = String(cdCrediarioCupom);
                        await pool.query(
                            `UPDATE transactions 
                             SET solidcon_key = ?, cdfilial = COALESCE(cdfilial, ?), pdv = COALESCE(pdv, ?) 
                             WHERE id = ?`,
                            [resolvedCupomKey, resolvedRow.cdFilial ? String(resolvedRow.cdFilial) : null, resolvedRow.cdPDV ? String(resolvedRow.cdPDV) : null, tx.id]
                        );
                    }

                    const isExemptOnlySolidconBaixa = tx.only_solidcon_baixa === 1 || tx.only_solidcon_baixa === true;

                    // Se o cliente tem a regra de Baixa Exclusiva Solidcon:
                    if (isExemptOnlySolidconBaixa && cdCrediarioCupom) {
                        // 1. Limpar quaisquer pagamentos indevidos gerados pelo Keystone no Solidcon
                        const cleanRes = await ExternalDbService.removerBaixaCupomSolidcon({
                            host: server,
                            database,
                            user,
                            password
                        }, cdCrediarioCupom, {
                            onlyKeystoneBaixas: true,
                            nrCupom: fallbackInfo?.nrCupom,
                            cdFilial: fallbackInfo?.cdFilial,
                            cdPDV: fallbackInfo?.cdPDV,
                            interestKey: tx.solidcon_interest_key
                        });

                        if (cleanRes.deletedPayments > 0) {
                            cleanedCount++;
                            logger.info(`Cleaned ${cleanRes.deletedPayments} Keystone payment(s) from Solidcon for cupom ${cdCrediarioCupom} (Customer only_solidcon_baixa).`);
                        }

                        // 2. Verificar se o Solidcon possui baixa legítima de loja/caixa
                        const hasStorePayment = cleanRes.remainingPayments > 0 && cleanRes.vlQuitado > 0;

                        const conn = await pool.getConnection();
                        try {
                            await conn.beginTransaction();

                            const [localTx]: any = await conn.query(
                                `SELECT status, bank_account_id, amount FROM transactions WHERE id = ? FOR UPDATE`,
                                [tx.id]
                            );

                            if (localTx?.[0]) {
                                const isPaidLocally = localTx[0].status === 'paid';

                                if (hasStorePayment) {
                                    if (!isPaidLocally) {
                                        await conn.query(
                                            `UPDATE transactions SET status = 'paid', received_at = COALESCE(received_at, NOW()), solidcon_quitado = 1, updated_at = NOW() WHERE id = ?`,
                                            [tx.id]
                                        );
                                        if (localTx[0].bank_account_id) {
                                            await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, localTx[0].bank_account_id, localTx[0].amount, false);
                                        }
                                    } else {
                                        await conn.query(
                                            `UPDATE transactions SET solidcon_quitado = 1, updated_at = NOW() WHERE id = ?`,
                                            [tx.id]
                                        );
                                    }
                                } else {
                                    // Não há pagamento de loja no Solidcon -> a receita no Keystone deve estar como pendente
                                    if (isPaidLocally) {
                                        await conn.query(
                                            `UPDATE transactions SET status = 'pending', received_at = NULL, solidcon_quitado = 0, solidcon_interest_key = NULL, updated_at = NOW() WHERE id = ?`,
                                            [tx.id]
                                        );
                                        if (localTx[0].bank_account_id) {
                                            await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, localTx[0].bank_account_id, localTx[0].amount, true);
                                        }
                                    } else {
                                        await conn.query(
                                            `UPDATE transactions SET solidcon_quitado = 0, solidcon_interest_key = NULL, updated_at = NOW() WHERE id = ?`,
                                            [tx.id]
                                        );
                                    }
                                }
                            }

                            await conn.commit();
                        } catch (dbErr) {
                            await conn.rollback();
                            throw dbErr;
                        } finally {
                            conn.release();
                        }

                        syncedCount++;
                        continue;
                    }

                    // Cliente Padrão (Permite baixa no Keystone/Solidcon)
                    // Calcular informações de juros
                    const jurosInfo = FinanceService.calculateTransactionFineAndInterest(tx, {
                        billet_fine: tx.billet_fine,
                        billet_interest: tx.billet_interest,
                        pix_fine: tx.pix_fine,
                        pix_interest: tx.pix_interest
                    });

                    // Verificar se o cupom já está baixado no tbCrediarioCupomPagamento da Solidcon
                    let isBaixado = false;
                    if (cdCrediarioCupom) {
                        const reqCheck = poolMsSql.request();
                        reqCheck.input('cdCrediarioCupom', sql.Int, cdCrediarioCupom);
                        const resCheck = await reqCheck.query(`
                            SELECT cdCrediarioCupom FROM tbCrediarioCupomPagamento 
                            WHERE cdCrediarioCupom = @cdCrediarioCupom
                        `);
                        if (resCheck.recordset?.[0]) {
                            isBaixado = true;
                        }
                    }

                    const bankAccountInfo = tx.bank_account_id ? {
                        solidcon_bank_id: tx.solidcon_bank_id,
                        name: tx.bank_name,
                        account_number: tx.bank_account_number
                    } : undefined;

                    // Se não estiver baixado, executar a baixa na Solidcon
                    if (!isBaixado) {
                        logger.info(`Performing Solidcon payment/baixa for transaction ID ${tx.id} (cupom key: ${resolvedCupomKey || 'fallback'})...`);

                        const baixaRes = await ExternalDbService.baixaCupomSolidcon({
                            host: server,
                            database,
                            user,
                            password
                        }, cdCrediarioCupom, tx.amount, bankAccountInfo, fallbackInfo, jurosInfo);

                        if (baixaRes && tx.id) {
                            if (baixaRes.solidcon_interest_key) {
                                const fineVal = jurosInfo.fine || jurosInfo.totalFineInterest || 0;
                                const interestVal = jurosInfo.interest || 0;
                                await pool.query(
                                    `UPDATE transactions 
                                     SET solidcon_interest_key = ?, 
                                         fine = COALESCE(NULLIF(fine, 0), ?), 
                                         interest = COALESCE(NULLIF(interest, 0), ?),
                                         original_amount = COALESCE(original_amount, amount),
                                         amount = CASE 
                                             WHEN status = 'paid' THEN COALESCE(original_amount, amount) + ? + ?
                                             ELSE amount 
                                         END,
                                         updated_at = NOW() 
                                     WHERE id = ?`,
                                    [baixaRes.solidcon_interest_key, fineVal, interestVal, fineVal, interestVal, tx.id]
                                );
                            }
                            if (baixaRes.cdCrediarioCupom) {
                                await pool.query('UPDATE transactions SET solidcon_key = COALESCE(solidcon_key, ?) WHERE id = ?', [String(baixaRes.cdCrediarioCupom), tx.id]);
                            }
                        }

                        syncedCount++;
                    } else {
                        if (cdCrediarioCupom && tx.bank_account_id) {
                            logger.info(`Updating bank account for existing Solidcon payment of cupom ${cdCrediarioCupom}...`);
                            await ExternalDbService.updateBancoContaSolidcon({
                                host: server,
                                database,
                                user,
                                password
                            }, cdCrediarioCupom, bankAccountInfo!);
                        }
                        if (jurosInfo.totalFineInterest > 0) {
                            const intKey = await ExternalDbService.registrarJurosSolidcon({
                                host: server,
                                database,
                                user,
                                password
                            }, {
                                totalFineInterest: jurosInfo.totalFineInterest,
                                daysOverdue: jurosInfo.daysOverdue,
                                description: jurosInfo.description,
                                customerName: jurosInfo.customerName,
                                nrCupom: jurosInfo.nrCupom || fallbackInfo?.nrCupom,
                                cdCrediarioCupom,
                                cdFilial: tx.cdfilial || company.cdfilial || '1',
                                cdPDV: tx.pdv || company.cdpdv || null
                            }, bankAccountInfo);
                            if (intKey && tx.id) {
                                const fineVal = jurosInfo.fine || jurosInfo.totalFineInterest || 0;
                                const interestVal = jurosInfo.interest || 0;
                                await pool.query(
                                    `UPDATE transactions 
                                     SET solidcon_interest_key = ?, 
                                         fine = COALESCE(NULLIF(fine, 0), ?), 
                                         interest = COALESCE(NULLIF(interest, 0), ?),
                                         original_amount = COALESCE(original_amount, amount),
                                         amount = CASE 
                                             WHEN status = 'paid' THEN COALESCE(original_amount, amount) + ? + ?
                                             ELSE amount 
                                         END,
                                         updated_at = NOW() 
                                     WHERE id = ?`,
                                    [intKey, fineVal, interestVal, fineVal, interestVal, tx.id]
                                );
                            }
                        }
                    }

                    // Garantir que a transação local está marcada como 'paid' e 'solidcon_quitado = 1'
                    const conn = await pool.getConnection();
                    try {
                        await conn.beginTransaction();

                        const [localTx]: any = await conn.query(
                            `SELECT status, bank_account_id, amount FROM transactions WHERE id = ? FOR UPDATE`,
                            [tx.id]
                        );

                        if (localTx?.[0]) {
                            const isPaidLocally = localTx[0].status === 'paid';
                            
                            // Se estiver pendente, marcar como paga e atualizar o saldo local
                            if (!isPaidLocally) {
                                await conn.query(
                                    `UPDATE transactions SET status = 'paid', received_at = NOW(), solidcon_quitado = 1, updated_at = NOW() WHERE id = ?`,
                                    [tx.id]
                                );
                                if (localTx[0].bank_account_id) {
                                    await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, localTx[0].bank_account_id, localTx[0].amount, false);
                                }
                            } else {
                                await conn.query(
                                    `UPDATE transactions SET solidcon_quitado = 1, updated_at = NOW() WHERE id = ?`,
                                    [tx.id]
                                );
                            }
                        }

                        await conn.commit();
                    } catch (dbErr) {
                        await conn.rollback();
                        throw dbErr;
                    } finally {
                        conn.release();
                    }

                } catch (err: any) {
                    logger.error({ err }, `Error syncing transaction ${tx.id} in syncSolidconBaixas.`);
                    let errMsg = err.message || 'Erro desconhecido';
                    if (errMsg.includes('Invalid object name')) {
                        const matchObj = errMsg.match(/Invalid object name '([^']+)'/i);
                        const objName = matchObj ? matchObj[1] : 'tabela';
                        errMsg = `A tabela '${objName}' não existe no banco de dados '${database}' (${server}). Verifique se o campo 'Banco de Dados Solidcon' (bd_solidcon) no cadastro da empresa está configurado com o nome correto do banco da Solidcon.`;
                    }
                    errors.push({ id: tx.id, solidcon_key: tx.solidcon_key || tx.description || 'N/A', error: errMsg });
                }
            }
        } finally {
            await poolMsSql.close();
        }

        // Registrar juros retroativos no Solidcon apenas para clientes NÃO isentos
        try {
            const [allPaidSolidconTxs]: any = await pool.query(
                `SELECT t.id, t.public_id, t.solidcon_key, t.amount, t.original_amount, t.fine, t.interest, t.date, t.date_launch, t.received_at, t.payment_method, t.bank_account_id, t.description, t.pdv, t.cdfilial, b.solidcon_bank_id, b.name as bank_name, b.account_number as bank_account_number, b.billet_fine, b.billet_interest, b.pix_fine, b.pix_interest, c.name as customer_name
                 FROM transactions t
                 LEFT JOIN bank_accounts b ON t.bank_account_id = b.id
                 LEFT JOIN customers c ON c.id = t.customer_id
                 WHERE t.company_id = ? 
                   AND t.status = 'paid' 
                   AND (t.solidcon_key IS NOT NULL OR t.description LIKE '%Cupom%')
                   AND (c.exempt_interest_fine = 0 OR c.exempt_interest_fine IS NULL)
                   AND (c.only_solidcon_baixa = 0 OR c.only_solidcon_baixa IS NULL)
                   AND (t.fine > 0 OR t.interest > 0 OR (t.original_amount IS NOT NULL AND t.amount > t.original_amount) OR t.date < CURDATE())`,
                [companyId]
            );

            for (const paidTx of allPaidSolidconTxs || []) {
                const jurosInfo = FinanceService.calculateTransactionFineAndInterest(paidTx, {
                    billet_fine: paidTx.billet_fine,
                    billet_interest: paidTx.billet_interest,
                    pix_fine: paidTx.pix_fine,
                    pix_interest: paidTx.pix_interest
                });

                if (jurosInfo.totalFineInterest > 0) {
                    try {
                        const retroIntRes = await ExternalDbService.registrarJurosSolidcon({
                            host: server,
                            database,
                            user,
                            password
                        }, {
                            totalFineInterest: jurosInfo.totalFineInterest,
                            daysOverdue: jurosInfo.daysOverdue,
                            description: jurosInfo.description,
                            customerName: jurosInfo.customerName,
                            nrCupom: jurosInfo.nrCupom,
                            cdCrediarioCupom: paidTx.solidcon_key ? parseInt(paidTx.solidcon_key, 10) : null,
                            cdFilial: paidTx.cdfilial || company.cdfilial || '1',
                            cdPDV: paidTx.pdv || company.cdpdv || null
                        }, paidTx.bank_account_id ? {
                            solidcon_bank_id: paidTx.solidcon_bank_id,
                            name: paidTx.bank_name,
                            account_number: paidTx.bank_account_number
                        } : undefined);
                        if (retroIntRes && paidTx.id) {
                            const fineVal = jurosInfo.fine || jurosInfo.totalFineInterest || 0;
                            const interestVal = jurosInfo.interest || 0;
                            await pool.query(
                                `UPDATE transactions 
                                 SET solidcon_interest_key = ?, 
                                     fine = COALESCE(NULLIF(fine, 0), ?), 
                                     interest = COALESCE(NULLIF(interest, 0), ?),
                                     original_amount = COALESCE(original_amount, amount),
                                     amount = CASE 
                                         WHEN status = 'paid' THEN COALESCE(original_amount, amount) + ? + ?
                                         ELSE amount 
                                     END,
                                     updated_at = NOW() 
                                 WHERE id = ?`,
                                [retroIntRes, fineVal, interestVal, fineVal, interestVal, paidTx.id]
                            );
                        }
                    } catch (intErr) {
                        logger.warn({ intErr, txId: paidTx.id }, 'Warning registering retroactive Solidcon interest');
                    }
                }
            }

            // Limpeza final no Keystone de quaisquer transações residuais criadas como receita à vista de juros
            await pool.query(
                `DELETE FROM transactions 
                 WHERE company_id = ? AND (
                     description LIKE '%Juros de conv%' OR description LIKE '%[ORIGIN_TX:%'
                 )`,
                [companyId]
            );
        } catch (scanErr) {
            logger.error({ scanErr }, `Error scanning retroactive interest movements for company ${companyId}`);
        }

        return { success: true, checkedCount, syncedCount, cleanedCount, errors };
    }

    static async cleanDuplicateSolidconBaixas(
        companyId: number,
        transactionPublicIds?: string[]
    ): Promise<{
        success: boolean;
        checkedCount: number;
        cleanedCount: number;
        details: Array<{
            id: number;
            public_id: string;
            cupom: string;
            customer: string;
            deletedPayments: number;
            remainingPayments: number;
            status: string;
        }>;
        errors: any[];
    }> {
        const company = await CompanyService.getById(companyId);
        if (!company) {
            throw new Error('Empresa não encontrada.');
        }

        const isSolidcon = !!company.serv_solidcon;
        let server = isSolidcon ? company.serv_solidcon : company.serv_dorsal;
        const database = isSolidcon ? company.bd_solidcon : company.bd_dorsal;
        const user = isSolidcon ? company.login_solidcon : company.login_dorsal;
        const rawPassword = isSolidcon ? company.senha_solidcon : company.senha_dorsal;
        const password = rawPassword ? (decrypt(rawPassword) || rawPassword) : '';

        if (!server || !database || !user || !password) {
            throw new Error('Configuração do banco de dados Solidcon incompleta no cadastro da empresa.');
        }

        let port = 1433;
        if (server.includes(',')) {
            const parts = server.split(',');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || 1433;
        } else if (server.includes(':')) {
            const parts = server.split(':');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || 1433;
        }

        let query = `
            SELECT t.id, t.public_id, t.solidcon_key, t.solidcon_interest_key, t.amount, t.original_amount, t.date, t.received_at, t.payment_method, t.bank_account_id, t.description, t.pdv, t.cdfilial, t.status, c.name as customer_name, c.only_solidcon_baixa
            FROM transactions t
            LEFT JOIN customers c ON c.id = t.customer_id
            WHERE t.company_id = ?
        `;
        const params: any[] = [companyId];

        if (transactionPublicIds && transactionPublicIds.length > 0) {
            query += ` AND t.public_id IN (?)`;
            params.push(transactionPublicIds);
        } else {
            // Processa todas as transações de clientes com Baixa Exclusiva Solidcon OU transações com solidcon_key / Cupom
            query += ` AND (c.only_solidcon_baixa = 1 OR t.solidcon_key IS NOT NULL OR t.description LIKE '%Cupom%')`;
        }

        const [transactions]: any = await pool.query(query, params);

        if (transactions.length === 0) {
            return { success: true, checkedCount: 0, cleanedCount: 0, details: [], errors: [] };
        }

        let checkedCount = 0;
        let cleanedCount = 0;
        const details: any[] = [];
        const errors: any[] = [];

        const poolMsSql = new sql.ConnectionPool({
            user,
            password,
            server,
            database,
            port,
            options: {
                encrypt: false,
                trustServerCertificate: true
            },
            connectionTimeout: 10000,
            requestTimeout: 15000
        });

        await poolMsSql.connect();
        try {
            for (const tx of transactions) {
                checkedCount++;
                try {
                    let cdCrediarioCupom: number | null = tx.solidcon_key ? parseInt(tx.solidcon_key, 10) : null;
                    const desc = String(tx.description || '');
                    const cupomMatch = desc.match(/Cupom\s*#?\s*(\d+)/i);
                    const nrCupom = cupomMatch?.[1];

                    if (!cdCrediarioCupom && !nrCupom) continue;

                    const cleanRes = await ExternalDbService.removerBaixaCupomSolidcon({
                        host: server,
                        database,
                        user,
                        password,
                        pool: poolMsSql
                    }, cdCrediarioCupom || 0, {
                        onlyKeystoneBaixas: true,
                        nrCupom: nrCupom,
                        cdFilial: tx.cdfilial || company.cdfilial || '1',
                        cdPDV: tx.pdv || company.cdpdv || null,
                        interestKey: tx.solidcon_interest_key
                    });

                    if (cleanRes.deletedPayments > 0) {
                        cleanedCount++;

                        // Ajustar status local no Keystone
                        const conn = await pool.getConnection();
                        try {
                            await conn.beginTransaction();

                            const [localTx]: any = await conn.query(
                                `SELECT status, bank_account_id, amount FROM transactions WHERE id = ? FOR UPDATE`,
                                [tx.id]
                            );

                            if (localTx?.[0]) {
                                const isPaidLocally = localTx[0].status === 'paid';
                                const isExemptOnlySolidconBaixa = tx.only_solidcon_baixa === 1 || tx.only_solidcon_baixa === true;

                                if (cleanRes.remainingPayments > 0) {
                                    await conn.query(
                                        `UPDATE transactions SET status = 'paid', solidcon_quitado = 1, solidcon_interest_key = NULL, updated_at = NOW() WHERE id = ?`,
                                        [tx.id]
                                    );
                                } else if (isExemptOnlySolidconBaixa) {
                                    // Sem pagamentos de loja no Solidcon -> reverter para pendente
                                    if (isPaidLocally) {
                                        await conn.query(
                                            `UPDATE transactions SET status = 'pending', received_at = NULL, solidcon_quitado = 0, solidcon_interest_key = NULL, updated_at = NOW() WHERE id = ?`,
                                            [tx.id]
                                        );
                                        if (localTx[0].bank_account_id) {
                                            await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, localTx[0].bank_account_id, localTx[0].amount, true);
                                        }
                                    } else {
                                        await conn.query(
                                            `UPDATE transactions SET solidcon_quitado = 0, solidcon_interest_key = NULL, updated_at = NOW() WHERE id = ?`,
                                            [tx.id]
                                        );
                                    }
                                }
                            }

                            await conn.commit();
                        } catch (dbErr) {
                            await conn.rollback();
                            throw dbErr;
                        } finally {
                            conn.release();
                        }

                        details.push({
                            id: tx.id,
                            public_id: tx.public_id,
                            cupom: nrCupom || String(cdCrediarioCupom),
                            customer: tx.customer_name || 'N/A',
                            deletedPayments: cleanRes.deletedPayments,
                            remainingPayments: cleanRes.remainingPayments,
                            status: cleanRes.remainingPayments > 0 ? 'Mantido Pago (Baixa Solidcon Loja)' : 'Revertido para Pendente'
                        });
                    }
                } catch (err: any) {
                    logger.error({ err, txId: tx.id }, 'Error cleaning duplicate Solidcon baixa');
                    errors.push({ id: tx.id, cupom: tx.solidcon_key || tx.description, error: err.message });
                }
            }
        } finally {
            await poolMsSql.close();
        }

        return {
            success: true,
            checkedCount,
            cleanedCount,
            details,
            errors
        };
    }

    static async buscarReceitaSolidcon(companyId: number, filter: {
        documento?: string | number | null | undefined;
        cdConta?: number | null | undefined;
        cdContaBaixa?: number | null | undefined;
        cdBancoContaMovimento?: number | null | undefined;
        startDate?: string | null | undefined;
        endDate?: string | null | undefined;
        cdFilial?: string | number | null | undefined;
    }): Promise<any[]> {
        const company = await CompanyService.getById(companyId);
        if (!company) {
            throw new Error('Empresa não encontrada.');
        }

        const server = company.serv_solidcon;
        const database = company.bd_solidcon;
        const user = company.login_solidcon;
        const password = company.senha_solidcon ? (decrypt(company.senha_solidcon) || company.senha_solidcon) : '';

        if (!server || !database || !user || !password) {
            throw new Error('Configuração de conexão com o banco Solidcon incompleta no cadastro da empresa.');
        }

        return await ExternalDbService.buscarReceitaSolidcon({
            host: server,
            database,
            user,
            password
        }, {
            ...filter,
            cdFilial: filter.cdFilial || company.cdfilial || '1'
        });
    }

    static async sincronizarTodosLancamentosJurosSolidcon(targetCompanyId?: number): Promise<{ processed: number; updated: number; errors: any[] }> {
        let processed = 0;
        let updated = 0;
        const errors: any[] = [];

        let companyIds: number[] = [];
        if (targetCompanyId) {
            companyIds = [targetCompanyId];
        } else {
            const [companies]: any = await pool.query(
                `SELECT id FROM companies WHERE serv_solidcon IS NOT NULL AND bd_solidcon IS NOT NULL AND login_solidcon IS NOT NULL`
            );
            companyIds = (companies || []).map((c: any) => c.id);
        }

        for (const companyId of companyIds) {
            try {
                const company = await CompanyService.getById(companyId);
                if (!company || !company.serv_solidcon || !company.bd_solidcon || !company.login_solidcon || !company.senha_solidcon) {
                    continue;
                }

                const server = company.serv_solidcon;
                const database = company.bd_solidcon;
                const user = company.login_solidcon;
                const password = company.senha_solidcon;

                const [txs]: any = await pool.query(
                    `SELECT t.id, t.public_id, t.solidcon_key, t.solidcon_interest_key, t.amount, t.original_amount, t.fine, t.interest, t.date, t.date_launch, t.received_at, t.payment_method, t.bank_account_id, t.description, t.pdv, t.cdfilial, b.solidcon_bank_id, b.name as bank_name, b.account_number as bank_account_number, b.billet_fine, b.billet_interest, b.pix_fine, b.pix_interest, c.name as customer_name
                     FROM transactions t
                     LEFT JOIN bank_accounts b ON t.bank_account_id = b.id
                     LEFT JOIN customers c ON c.id = t.customer_id
                     WHERE t.company_id = ? 
                       AND (t.type = 'income' OR t.type = 'revenue')
                       AND t.status = 'paid'
                       AND (t.fine > 0 OR t.interest > 0 OR (t.original_amount IS NOT NULL AND t.amount > t.original_amount) OR t.solidcon_interest_key IS NOT NULL)`,
                    [companyId]
                );

                for (const tx of txs || []) {
                    processed++;
                    const jurosInfo = FinanceService.calculateTransactionFineAndInterest(tx, {
                        billet_fine: tx.billet_fine,
                        billet_interest: tx.billet_interest,
                        pix_fine: tx.pix_fine,
                        pix_interest: tx.pix_interest
                    });

                    if (jurosInfo.totalFineInterest > 0) {
                        if (tx.solidcon_interest_key) {
                            // Já registrado no Solidcon
                            continue;
                        }
                        try {
                            const cdConta = await ExternalDbService.registrarJurosSolidcon({
                                host: server,
                                database,
                                user,
                                password
                            }, {
                                totalFineInterest: jurosInfo.totalFineInterest,
                                daysOverdue: jurosInfo.daysOverdue,
                                description: jurosInfo.description,
                                customerName: jurosInfo.customerName,
                                nrCupom: jurosInfo.nrCupom,
                                cdCrediarioCupom: tx.solidcon_key ? parseInt(tx.solidcon_key, 10) : null,
                                cdFilial: tx.cdfilial || company.cdfilial || '1',
                                cdPDV: tx.pdv || company.cdpdv || null
                            }, tx.bank_account_id ? {
                                solidcon_bank_id: tx.solidcon_bank_id,
                                name: tx.bank_name,
                                account_number: tx.bank_account_number
                            } : undefined);

                            if (cdConta && String(tx.solidcon_interest_key) !== String(cdConta)) {
                                const fineVal = jurosInfo.fine || jurosInfo.totalFineInterest || 0;
                                const interestVal = jurosInfo.interest || 0;
                                await pool.query(
                                    `UPDATE transactions 
                                     SET solidcon_interest_key = ?, 
                                         fine = COALESCE(NULLIF(fine, 0), ?), 
                                         interest = COALESCE(NULLIF(interest, 0), ?),
                                         original_amount = COALESCE(original_amount, amount),
                                         amount = CASE 
                                             WHEN status = 'paid' THEN COALESCE(original_amount, amount) + ? + ?
                                             ELSE amount 
                                         END,
                                         updated_at = NOW() 
                                     WHERE id = ?`,
                                    [cdConta, fineVal, interestVal, fineVal, interestVal, tx.id]
                                );
                                updated++;
                            }
                        } catch (err: any) {
                            logger.error({ err, txId: tx.id }, `Error syncing Solidcon interest revenue for transaction ${tx.id}`);
                            errors.push({ id: tx.id, description: tx.description, error: err.message });
                        }
                    } else {
                        // totalFineInterest <= 0: Se foi criado lançamento no Solidcon ou gravado solidcon_interest_key, apagar e limpar
                        if (tx.solidcon_interest_key) {
                            try {
                                await ExternalDbService.removerReceitaSolidcon({
                                    host: server,
                                    database,
                                    user,
                                    password
                                }, {
                                    cdConta: tx.solidcon_interest_key,
                                    documento: jurosInfo.nrCupom
                                });
                                await pool.query('UPDATE transactions SET solidcon_interest_key = NULL WHERE id = ?', [tx.id]);
                                updated++;
                            } catch (err: any) {
                                logger.error({ err, txId: tx.id }, `Error removing zero-interest revenue from Solidcon for transaction ${tx.id}`);
                                errors.push({ id: tx.id, description: tx.description, error: err.message });
                            }
                        }
                    }
                }

                // Sincronizar contas de juros já existentes no Solidcon para as transações locais
                try {
                    let port = 1433;
                    let host = server;
                    if (host.includes(',')) {
                        port = parseInt(host.split(',')[1] || '1433', 10);
                        host = host.split(',')[0] || '';
                    } else if (host.includes(':')) {
                        port = parseInt(host.split(':')[1] || '1433', 10);
                        host = host.split(':')[0] || '';
                    }
                    const mssqlPool = new sql.ConnectionPool({
                        user,
                        password,
                        database,
                        server: host,
                        port,
                        options: { encrypt: false, trustServerCertificate: true },
                        connectionTimeout: 10000,
                        requestTimeout: 15000
                    });
                    await mssqlPool.connect();
                    try {
                        const resSolidconJuros = await mssqlPool.request().query(`
                            SELECT c.cdConta, c.Documento, cp.vlParcela, cp.Historico
                            FROM tbConta c
                            JOIN tbContaParcela cp ON cp.cdConta = c.cdConta
                            WHERE cp.Historico LIKE '%Juros%' OR cp.Historico LIKE '%Mora%'
                        `);
                        for (const row of resSolidconJuros.recordset || []) {
                            const hist = String(row.Historico || '');
                            const cupomMatch = hist.match(/Cupom\s*#?\s*(\d+)/i) || hist.match(/Ref:\s*(\d+)/i);
                            const cupomNum = cupomMatch ? cupomMatch[1] : (row.Documento ? String(row.Documento).trim() : null);
                            const valorJuros = Number(row.vlParcela || 0);

                            if (cupomNum && valorJuros > 0 && row.cdConta) {
                                const [updateRes]: any = await pool.query(`
                                    UPDATE transactions 
                                    SET solidcon_interest_key = ?, fine = ?, updated_at = NOW()
                                    WHERE company_id = ? 
                                      AND (description LIKE ? OR description LIKE ? OR solidcon_key = ?)
                                      AND (fine = 0 OR solidcon_interest_key IS NULL OR solidcon_interest_key = '')
                                `, [
                                    String(row.cdConta),
                                    valorJuros,
                                    companyId,
                                    `%Cupom #${cupomNum}%`,
                                    `%Doc. #${cupomNum}%`,
                                    cupomNum
                                ]);
                                if (updateRes && updateRes.affectedRows > 0) {
                                    updated += updateRes.affectedRows;
                                }
                            }
                        }
                    } finally {
                        await mssqlPool.close();
                    }
                } catch (scanErr) {
                    logger.warn({ scanErr, companyId }, 'Warning scanning existing Solidcon interest accounts');
                }
            } catch (compErr: any) {
                logger.error({ compErr, companyId }, `Error processing Solidcon interest revenues for company ${companyId}`);
                errors.push({ companyId, error: compErr.message });
            }
        }

        return { processed, updated, errors };
    }

    static async syncAllRevenuesAndSolidcon(
        companyId: number,
        userId: string,
        filter?: { startDate?: string | undefined; endDate?: string | undefined }
    ): Promise<{
        success: boolean;
        bankChecked: number;
        bankSynced: number;
        baixasChecked: number;
        baixasSynced: number;
        interestProcessed: number;
        interestUpdated: number;
        solidconImported: number;
        solidconUpdated: number;
        message: string;
        errors: any[];
    }> {
        const allErrors: any[] = [];
        let bankChecked = 0;
        let bankSynced = 0;
        let baixasChecked = 0;
        let baixasSynced = 0;
        let interestProcessed = 0;
        let interestUpdated = 0;
        let solidconImported = 0;
        let solidconUpdated = 0;

        // 1. Sincronizar Status com o Banco (Banco Inter / Boletos / PIX / Extratos)
        try {
            // 1.1 Sincronizar extrato bancário dos últimos 7 dias (ou período filtrado) para conciliação
            try {
                const [accRows] = await pool.query<RowDataPacket[]>(
                    `SELECT public_id 
                     FROM bank_accounts 
                     WHERE company_id = ? AND api_client_id IS NOT NULL AND api_client_secret IS NOT NULL`,
                    [companyId]
                );

                if (accRows.length > 0) {
                    const today = new Date();
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(today.getDate() - 7);

                    const startDate = filter?.startDate || sevenDaysAgo.toISOString().slice(0, 10);
                    const endDate = filter?.endDate || today.toISOString().slice(0, 10);

                    for (const acc of accRows) {
                        try {
                            const bankAccount = await BankAccountService.getByPublicId(acc.public_id, companyId);
                            const { InterService } = await import('./bankAccountApi/interService');
                            await InterService.syncStatements(companyId, bankAccount, startDate, endDate);
                        } catch (e: any) {
                            logger.warn({ err: e.message, accPublicId: acc.public_id }, '[syncAllRevenuesAndSolidcon] Falha ao sincronizar extrato bancário');
                        }
                    }
                }
            } catch (extErr: any) {
                logger.warn({ extErr }, '[syncAllRevenuesAndSolidcon] Erro ao sincronizar extratos das contas');
            }

            // 1.2 Buscar receitas pendentes/em progresso que possuem boleto ou pix gerado
            let query = `
                SELECT t.public_id, t.status, t.billet_url, t.pix_code, t.id
                FROM transactions t
                JOIN bank_accounts b ON t.bank_account_id = b.id
                WHERE b.company_id = ?
                  AND t.type = 'income'
                  AND t.status IN ('pending', 'progress')
                  AND (t.billet_url IS NOT NULL OR t.pix_code IS NOT NULL)
            `;
            const params: any[] = [companyId];

            if (filter?.startDate && filter?.endDate) {
                query += ` AND t.date >= ? AND t.date <= ?`;
                params.push(filter.startDate, filter.endDate);
            }

            query += ` ORDER BY t.date DESC LIMIT 100`;

            const [pendingTxs] = await pool.query<RowDataPacket[]>(query, params);
            bankChecked = pendingTxs.length;

            for (const tx of pendingTxs) {
                try {
                    const st = await FinanceService.syncTransactionPaymentStatus(companyId, tx.public_id);
                    if (st === 'PAGO' || st === 'RECEBIDO' || st === 'CONCLUIDA') {
                        bankSynced++;
                    }
                } catch (txErr: any) {
                    logger.warn({ txErr: txErr.message, txPublicId: tx.public_id }, '[syncAllRevenuesAndSolidcon] Erro ao verificar status do pagamento no banco');
                    allErrors.push({ step: 'bank_sync', txPublicId: tx.public_id, error: txErr.message || String(txErr) });
                }
            }
        } catch (err: any) {
            logger.error({ err, companyId }, '[syncAllRevenuesAndSolidcon] Erro na sincronização com o banco');
            allErrors.push({ step: 'bank_sync', error: err.message || String(err) });
        }

        // 2. Sincronizar Baixas (Keystone <-> Solidcon)
        try {
            const baixasRes = await FinanceService.syncSolidconBaixas(companyId);
            baixasChecked = baixasRes.checkedCount || 0;
            baixasSynced = baixasRes.syncedCount || 0;
            if (baixasRes.errors && baixasRes.errors.length) {
                allErrors.push(...baixasRes.errors.map((e: any) => ({ step: 'baixas', ...e })));
            }
        } catch (err: any) {
            logger.error({ err, companyId }, '[syncAllRevenuesAndSolidcon] Erro no syncSolidconBaixas');
            allErrors.push({ step: 'baixas', error: err.message || String(err) });
        }

        // 3. Sincronizar Lançamentos de Multas e Juros
        try {
            const interestRes = await FinanceService.sincronizarTodosLancamentosJurosSolidcon(companyId);
            interestProcessed = interestRes.processed || 0;
            interestUpdated = interestRes.updated || 0;
            if (interestRes.errors && interestRes.errors.length) {
                allErrors.push(...interestRes.errors.map((e: any) => ({ step: 'interest', ...e })));
            }
        } catch (err: any) {
            logger.error({ err, companyId }, '[syncAllRevenuesAndSolidcon] Erro no sincronizarTodosLancamentosJurosSolidcon');
            allErrors.push({ step: 'interest', error: err.message || String(err) });
        }

        // 4. Sincronizar / Importar Receitas do Banco de Dados Solidcon
        try {
            const company = await CompanyService.getById(companyId);
            if (company && company.serv_solidcon && company.bd_solidcon && company.login_solidcon && company.senha_solidcon) {
                let start: string = filter?.startDate || '';
                let end: string = filter?.endDate || '';
                if (!start || !end) {
                    const now = new Date();
                    const y = now.getFullYear();
                    const m = String(now.getMonth() + 1).padStart(2, '0');
                    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
                    start = `${y}-${m}-01`;
                    end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
                }
                const cdFilial = company.cdfilial ? String(company.cdfilial).trim() : '1';
                const rows = await ExternalDbService.queryExternalSqlServer({
                    host: company.serv_solidcon,
                    database: company.bd_solidcon,
                    user: company.login_solidcon,
                    password: company.senha_solidcon
                }, start, end, cdFilial);

                if (rows && rows.length > 0) {
                    const importRes = await FinanceService.importSolidconRevenues(
                        companyId,
                        userId,
                        undefined,
                        undefined,
                        rows,
                        false,
                        false
                    );
                    solidconImported = importRes.created || 0;
                    solidconUpdated = importRes.updated || 0;
                    if (importRes.errors && importRes.errors.length) {
                        allErrors.push(...importRes.errors.map((e: any) => ({ step: 'solidcon_import', ...e })));
                    }
                }
            }
        } catch (err: any) {
            logger.error({ err, companyId }, '[syncAllRevenuesAndSolidcon] Erro ao consultar/importar do banco Solidcon');
            allErrors.push({ step: 'solidcon_db', error: err.message || String(err) });
        }

        // 5. Montar mensagem descritiva do resultado
        const details: string[] = [];
        if (bankSynced > 0) details.push(`${bankSynced} pagamento(s) confirmado(s) no banco`);
        if (baixasSynced > 0) details.push(`${baixasSynced} baixa(s) integrada(s) na Solidcon`);
        if (interestUpdated > 0) details.push(`${interestUpdated} lançamento(s) de multa/juros atualizado(s)`);
        if (solidconImported > 0) details.push(`${solidconImported} nova(s) receita(s) importada(s)`);
        if (solidconUpdated > 0) details.push(`${solidconUpdated} receita(s) sincronizada(s)`);

        let message = 'Sincronização concluída com sucesso!';
        if (details.length > 0) {
            message = `Sincronização concluída: ${details.join(', ')}.`;
        } else {
            message = 'Sincronização concluída! Todos os lançamentos e status já estavam perfeitamente atualizados entre o banco, Solidcon e Keystone.';
        }

        return {
            success: allErrors.length === 0,
            bankChecked,
            bankSynced,
            baixasChecked,
            baixasSynced,
            interestProcessed,
            interestUpdated,
            solidconImported,
            solidconUpdated,
            message,
            errors: allErrors
        };
    }

    static async getRevenueSolidconDetails(companyId: number, transactionPublicId: string) {
        const company = await CompanyService.getById(companyId);
        if (!company) throw new Error('Empresa não encontrada.');

        const isSolidcon = !!company.serv_solidcon;
        let server = isSolidcon ? company.serv_solidcon : company.serv_dorsal;
        const database = isSolidcon ? company.bd_solidcon : company.bd_dorsal;
        const user = isSolidcon ? company.login_solidcon : company.login_dorsal;
        const rawPassword = isSolidcon ? company.senha_solidcon : company.senha_dorsal;
        const password = rawPassword ? (decrypt(rawPassword) || rawPassword) : '';

        if (!server || !database || !user || !password) {
            throw new Error('Configuração do banco de dados Solidcon incompleta no cadastro da empresa.');
        }

        const [txRows]: any = await pool.query(
            `SELECT t.*, 
                    COALESCE(cu.name, sale_customer.name, s.name, con.name, ru.full_name) as entity_name,
                    COALESCE(cu.name, sale_customer.name) as customer_name,
                    COALESCE(cu.cnpj_cpf, sale_customer.cnpj_cpf) as customer_cnpj_cpf,
                    (CASE 
                        WHEN COALESCE(cu.cnpj_cpf, sale_customer.cnpj_cpf, s.cnpj_cpf, con.cnpj_cpf, ru.cpf_cnpj) IS NULL THEN NULL 
                        WHEN LENGTH(REPLACE(REPLACE(REPLACE(COALESCE(cu.cnpj_cpf, sale_customer.cnpj_cpf, s.cnpj_cpf, con.cnpj_cpf, ru.cpf_cnpj), '.', ''), '-', ''), '/', '')) <= 11 
                            THEN LPAD(REPLACE(REPLACE(REPLACE(COALESCE(cu.cnpj_cpf, sale_customer.cnpj_cpf, s.cnpj_cpf, con.cnpj_cpf, ru.cpf_cnpj), '.', ''), '-', ''), '/', ''), 11, '0') 
                        ELSE LPAD(REPLACE(REPLACE(REPLACE(COALESCE(cu.cnpj_cpf, sale_customer.cnpj_cpf, s.cnpj_cpf, con.cnpj_cpf, ru.cpf_cnpj), '.', ''), '-', ''), '/', ''), 14, '0') 
                    END) as entity_cnpj_cpf,
                    COALESCE(cu.phone, sale_customer.phone, s.phone, con.phone, ru.phone) as entity_phone,
                    b.name as bank_account_name, b.account_number as bank_account_number
             FROM transactions t
             LEFT JOIN customers cu ON cu.id = t.customer_id
             LEFT JOIN sales_orders so ON t.sale_id = so.id
             LEFT JOIN customers sale_customer ON so.customer_id = sale_customer.id
             LEFT JOIN suppliers s ON t.supplier_id = s.id
             LEFT JOIN contacts con ON t.contact_id = con.id
             LEFT JOIN users ru ON t.related_user_id = ru.id
             LEFT JOIN bank_accounts b ON b.id = t.bank_account_id
             WHERE t.public_id = ? AND t.company_id = ? LIMIT 1`,
            [transactionPublicId, companyId]
        );

        if (!txRows || txRows.length === 0 || !txRows[0]) {
            throw new Error('Receita não encontrada.');
        }

        const tx = txRows[0];
        let cdCrediarioCupom: number | null = tx.solidcon_key ? parseInt(tx.solidcon_key, 10) : null;
        if (isNaN(cdCrediarioCupom as number)) cdCrediarioCupom = null;

        const desc = String(tx.description || '');
        let nrCupom: string | null = null;
        const matchCupom = desc.match(/(?:cupom|venda|compra)?\s*#?\s*(\d+)/i);
        if (matchCupom && matchCupom[1]) {
            nrCupom = matchCupom[1];
        }
        if (!nrCupom && tx.solidcon_key && /^\d+$/.test(String(tx.solidcon_key).trim())) {
            nrCupom = String(tx.solidcon_key).trim();
        }

        const customerCpfDigits = (tx.entity_cnpj_cpf || tx.customer_cnpj_cpf)
            ? String(tx.entity_cnpj_cpf || tx.customer_cnpj_cpf).replace(/\D/g, '')
            : null;

        const inspection = await ExternalDbService.getSolidconDetailedInspection({
            host: server,
            database,
            user,
            password
        }, {
            cdCrediarioCupom,
            nrCupom,
            customerCpf: customerCpfDigits,
            interestKey: tx.solidcon_interest_key,
            cdFilial: tx.cdfilial || company.cdfilial || '1',
            cdPDV: tx.pdv || company.cdpdv || null,
            transaction: tx
        });

        // Sincronizar e auto-corrigir solidcon_interest_key e valor de multa se encontrado no Solidcon
        if (inspection.interestConta && inspection.interestConta.length > 0) {
            const interestItem = inspection.interestConta.find((c: any) => {
                const hist = String(c.historicoParcela || c.historicoBaixa || '');
                const isJuros = /juros/i.test(hist) || /mora/i.test(hist) || (/multa/i.test(hist) && !/sem\s+multa/i.test(hist));
                const val = Number(c.vlParcela || c.vlContaBaixa || 0);
                return isJuros && val > 0;
            });
            if (interestItem) {
                const interestKeyStr = String(interestItem.cdConta);
                const valorJuros = Number(interestItem.vlParcela || interestItem.vlContaBaixa || 0);
                if (valorJuros > 0) {
                    if (!tx.solidcon_interest_key || Number(tx.fine || 0) === 0) {
                        try {
                            await pool.query(
                                `UPDATE transactions 
                                 SET solidcon_interest_key = ?, 
                                     fine = ?, 
                                     original_amount = COALESCE(original_amount, amount),
                                     amount = CASE 
                                         WHEN status = 'paid' THEN COALESCE(original_amount, amount) + ?
                                         ELSE amount 
                                     END,
                                     updated_at = NOW() 
                                 WHERE id = ?`,
                                [interestKeyStr, valorJuros, valorJuros, tx.id]
                            );
                            tx.solidcon_interest_key = interestKeyStr;
                            tx.fine = valorJuros;
                            if (tx.status === 'paid') {
                                const orig = tx.original_amount !== null && tx.original_amount !== undefined ? Number(tx.original_amount) : Number(tx.amount || 0);
                                tx.original_amount = orig;
                                tx.amount = orig + valorJuros;
                            }
                        } catch (e) {
                            // ignore
                        }
                    }
                    tx.solidcon_interest_key = interestKeyStr;
                    tx.fine = valorJuros;
                }
            } else if (tx.solidcon_interest_key) {
                // Se a conta vinculada em solidcon_interest_key NÃO é de juros (ex: foi equivocadamente amarrada à conta principal), limpar
                const invalidKeyItem = inspection.interestConta.find((c: any) => String(c.cdConta) === String(tx.solidcon_interest_key));
                if (invalidKeyItem) {
                    const hist = String(invalidKeyItem.historicoParcela || invalidKeyItem.historicoBaixa || '');
                    const isJuros = /juros/i.test(hist) || /mora/i.test(hist) || (/multa/i.test(hist) && !/sem\s+multa/i.test(hist));
                    if (!isJuros) {
                        try {
                            await pool.query(
                                `UPDATE transactions 
                                 SET solidcon_interest_key = NULL, 
                                     fine = 0, 
                                     interest = 0,
                                     amount = COALESCE(original_amount, amount),
                                     updated_at = NOW() 
                                 WHERE id = ?`,
                                [tx.id]
                            );
                            tx.solidcon_interest_key = null;
                            tx.fine = 0;
                            tx.interest = 0;
                            if (tx.original_amount !== null && tx.original_amount !== undefined) {
                                tx.amount = Number(tx.original_amount);
                            }
                        } catch (e) {
                            // ignore
                        }
                    }
                }
            }
        }

        const origAmt = tx.original_amount !== null && tx.original_amount !== undefined ? Number(tx.original_amount) : Number(tx.amount || 0);
        const totalFineInt = Number(tx.fine || 0) + Number(tx.interest || 0);

        const revObj = {
            id: tx.id,
            public_id: tx.public_id,
            description: tx.description,
            amount: (tx.status === 'paid' && origAmt > 0 && totalFineInt > 0) ? Math.max(Number(tx.amount || 0), origAmt + totalFineInt) : Number(tx.amount || 0),
            original_amount: origAmt,
            fine: Number(tx.fine || 0),
            interest: Number(tx.interest || 0),
            date: tx.date,
            received_at: tx.received_at,
            status: tx.status,
            payment_method: tx.payment_method,
            solidcon_key: tx.solidcon_key,
            solidcon_quitado: Boolean(tx.solidcon_quitado),
            solidcon_interest_key: tx.solidcon_interest_key,
            cdfilial: tx.cdfilial || company.cdfilial || '1',
            pdv: tx.pdv || company.cdpdv || '-',
            cupom: nrCupom || inspection.cupom?.nrCupom || tx.solidcon_key || '-',
            customer_name: tx.customer_name,
            customer_cnpj_cpf: tx.customer_cnpj_cpf,
            entity_name: tx.entity_name || tx.customer_name || 'Sem cliente associado',
            entity_cnpj_cpf: tx.entity_cnpj_cpf || tx.customer_cnpj_cpf || null,
            entity_phone: tx.entity_phone,
            bank_account_name: tx.bank_account_name
        };

        // Consultar conciliação de extrato bancário local no ERP Keystone
        let localBankStatements: any[] = [];
        try {
            const [reconciledRows]: any = await pool.query(
                `SELECT bs.id, bs.public_id, bs.date, bs.description, bs.amount, bs.type, bs.status,
                        ba.name as bank_account_name, ba.account_number as bank_account_number
                 FROM bank_statements bs
                 LEFT JOIN bank_accounts ba ON ba.id = bs.bank_account_id
                 WHERE bs.reconciled_transaction_id = ? AND bs.company_id = ?`,
                [tx.id, companyId]
            );
            localBankStatements = reconciledRows || [];
        } catch (e) {
            // ignore
        }

        const extratoIds = (inspection.tableIds as any)?.tbBancoContaExtrato || [];
        const isReconciledSolidcon = Boolean(inspection.isReconciledSolidcon || (inspection.extratos && inspection.extratos.length > 0) || extratoIds.length > 0);
        const isReconciledLocal = localBankStatements.length > 0;
        const isReconciled = isReconciledSolidcon || isReconciledLocal;

        let statusText = 'Pendente de Conciliação no Extrato';
        if (isReconciledSolidcon && isReconciledLocal) {
            statusText = 'Conciliado no Solidcon e no ERP';
        } else if (isReconciledSolidcon) {
            statusText = 'Conciliado no Extrato (Solidcon)';
        } else if (isReconciledLocal) {
            statusText = 'Conciliado no Extrato (ERP)';
        } else if (inspection.missingBaixaTie) {
            statusText = 'Pendente de Amarração Contábil';
        }

        const reconciliation = {
            isReconciled,
            isReconciledSolidcon,
            isReconciledLocal,
            status: isReconciled ? 'reconciled' : (inspection.missingBaixaTie ? 'pending_tie' : 'pending'),
            statusText,
            solidconExtratos: inspection.extratos || [],
            localStatements: localBankStatements,
            extratoIds: extratoIds,
            summary: isReconciledSolidcon
                ? `Conciliado no Extrato da Conta Solidcon (Extrato #${extratoIds.join(', #') || 'OK'})`
                : (isReconciledLocal
                    ? `Conciliado no Extrato Bancário ERP (${localBankStatements[0]?.bank_account_name || 'Conta'})`
                    : 'Lançamento ainda não conciliado com o extrato da conta')
        };

        return {
            revenue: revObj,
            transaction: revObj,
            solidcon: inspection,
            tableIds: inspection.tableIds,
            crediarioCupom: inspection.cupom,
            cupom: inspection.cupom,
            payments: inspection.payments,
            deposits: inspection.deposits,
            bankMovements: inspection.movements,
            movements: inspection.movements,
            extratos: inspection.extratos || [],
            conta: inspection.conta,
            contaBaixas: inspection.contaBaixas,
            contaParcelas: inspection.contaParcelas,
            missingBaixaTie: inspection.missingBaixaTie,
            untiedMovements: inspection.untiedMovements,
            duplicateAnalysis: inspection.duplicateAnalysis,
            hasDuplicates: inspection.hasDuplicates,
            duplicateReasons: inspection.duplicateReasons,
            reconciliation,
            logLines: inspection.logLines
        };
    }

    static async fixRevenueSolidconDuplicates(companyId: number, transactionPublicId: string) {
        const company = await CompanyService.getById(companyId);
        if (!company) throw new Error('Empresa não encontrada.');

        const isSolidcon = !!company.serv_solidcon;
        let server = isSolidcon ? company.serv_solidcon : company.serv_dorsal;
        const database = isSolidcon ? company.bd_solidcon : company.bd_dorsal;
        const user = isSolidcon ? company.login_solidcon : company.login_dorsal;
        const rawPassword = isSolidcon ? company.senha_solidcon : company.senha_dorsal;
        const password = rawPassword ? (decrypt(rawPassword) || rawPassword) : '';

        if (!server || !database || !user || !password) {
            throw new Error('Configuração do banco de dados Solidcon incompleta no cadastro da empresa.');
        }

        const [txRows]: any = await pool.query(
            `SELECT t.*, 
                    COALESCE(cu.name, sale_customer.name, s.name, con.name, ru.full_name) as entity_name,
                    COALESCE(cu.name, sale_customer.name) as customer_name
             FROM transactions t
             LEFT JOIN customers cu ON cu.id = t.customer_id
             LEFT JOIN sales_orders so ON t.sale_id = so.id
             LEFT JOIN customers sale_customer ON so.customer_id = sale_customer.id
             LEFT JOIN suppliers s ON t.supplier_id = s.id
             LEFT JOIN contacts con ON t.contact_id = con.id
             LEFT JOIN users ru ON t.related_user_id = ru.id
             WHERE t.public_id = ? AND t.company_id = ? LIMIT 1`,
            [transactionPublicId, companyId]
        );

        if (!txRows || txRows.length === 0 || !txRows[0]) {
            throw new Error('Receita não encontrada.');
        }

        const tx = txRows[0];
        let cdCrediarioCupom: number | null = tx.solidcon_key ? parseInt(tx.solidcon_key, 10) : null;
        if (isNaN(cdCrediarioCupom as number)) cdCrediarioCupom = null;

        const desc = String(tx.description || '');
        let nrCupom: string | null = null;
        const matchCupom = desc.match(/(?:cupom|venda|compra)?\s*#?\s*(\d+)/i);
        if (matchCupom && matchCupom[1]) {
            nrCupom = matchCupom[1];
        }
        if (!nrCupom && tx.solidcon_key && /^\d+$/.test(String(tx.solidcon_key).trim())) {
            nrCupom = String(tx.solidcon_key).trim();
        }

        const fixResult = await ExternalDbService.fixSolidconDuplicates({
            host: server,
            database,
            user,
            password
        }, {
            cdCrediarioCupom,
            nrCupom,
            interestKey: tx.solidcon_interest_key,
            cdFilial: tx.cdfilial || company.cdfilial || '1'
        });

        const isQuitado = fixResult.finalVlQuitado > 0;
        await pool.query(
            `UPDATE transactions SET 
                solidcon_quitado = ?, 
                status = CASE WHEN ? = 1 THEN 'paid' ELSE status END,
                updated_at = NOW() 
             WHERE id = ?`,
            [isQuitado ? 1 : 0, isQuitado ? 1 : 0, tx.id]
        );

        const inspection = await ExternalDbService.getSolidconDetailedInspection({
            host: server,
            database,
            user,
            password
        }, {
            cdCrediarioCupom,
            nrCupom,
            interestKey: tx.solidcon_interest_key,
            cdFilial: tx.cdfilial || company.cdfilial || '1',
            cdPDV: tx.pdv || company.cdpdv || null,
            transaction: tx
        });

        return {
            fixResult,
            updatedInspection: inspection,
            message: `Ajuste concluído: ${fixResult.deletedPaymentsCount} pagamento(s) duplicado(s), ${fixResult.deletedDepositsCount} depósito(s) e ${fixResult.deletedMovementsCount} movimento(s) bancário(s) duplicado(s) removidos.`
        };
    }

    static async cancelRevenueSolidconBaixa(
        companyId: number,
        transactionPublicId: string,
        options?: {
            cdContaBaixa?: number | string | null;
            reopenRevenue?: boolean;
            cancelCupomPayment?: boolean;
        }
    ): Promise<{
        success: boolean;
        message: string;
        data: any;
        updatedInspection?: any;
    }> {
        const company = await CompanyService.getById(companyId);
        if (!company) throw new Error('Empresa não encontrada.');

        const isSolidcon = !!company.serv_solidcon;
        let server = isSolidcon ? company.serv_solidcon : company.serv_dorsal;
        const database = isSolidcon ? company.bd_solidcon : company.bd_dorsal;
        const user = isSolidcon ? company.login_solidcon : company.login_dorsal;
        const rawPassword = isSolidcon ? company.senha_solidcon : company.senha_dorsal;
        const password = rawPassword ? (decrypt(rawPassword) || rawPassword) : '';

        if (!server || !database || !user || !password) {
            throw new Error('Configuração do banco de dados Solidcon incompleta no cadastro da empresa.');
        }

        const [txRows]: any = await pool.query(
            `SELECT t.*, 
                    COALESCE(cu.name, sale_customer.name, s.name, con.name, ru.full_name) as entity_name,
                    COALESCE(cu.name, sale_customer.name) as customer_name
             FROM transactions t
             LEFT JOIN customers cu ON cu.id = t.customer_id
             LEFT JOIN sales_orders so ON t.sale_id = so.id
             LEFT JOIN customers sale_customer ON so.customer_id = sale_customer.id
             LEFT JOIN suppliers s ON t.supplier_id = s.id
             LEFT JOIN contacts con ON t.contact_id = con.id
             LEFT JOIN users ru ON t.related_user_id = ru.id
             WHERE t.public_id = ? AND t.company_id = ? LIMIT 1`,
            [transactionPublicId, companyId]
        );

        if (!txRows || txRows.length === 0 || !txRows[0]) {
            throw new Error('Receita não encontrada.');
        }

        const tx = txRows[0];
        let cdCrediarioCupom: number | null = tx.solidcon_key ? parseInt(tx.solidcon_key, 10) : null;
        if (isNaN(cdCrediarioCupom as number)) cdCrediarioCupom = null;

        const desc = String(tx.description || '');
        let nrCupom: string | null = null;
        const matchCupom = desc.match(/(?:cupom|venda|compra)?\s*#?\s*(\d+)/i);
        if (matchCupom && matchCupom[1]) {
            nrCupom = matchCupom[1];
        }
        if (!nrCupom && tx.solidcon_key && /^\d+$/.test(String(tx.solidcon_key).trim())) {
            nrCupom = String(tx.solidcon_key).trim();
        }

        const cancelResult = await ExternalDbService.cancelarContaBaixaSolidcon({
            host: server,
            database,
            user,
            password
        }, {
            cdContaBaixa: options?.cdContaBaixa,
            cdCrediarioCupom,
            nrCupom,
            interestKey: tx.solidcon_interest_key,
            cancelCupomPayment: options?.cancelCupomPayment !== false,
            cdFilial: tx.cdfilial || company.cdfilial || '1',
            transaction: tx
        });

        const reopen = options?.reopenRevenue !== false;
        if (reopen) {
            // Reabre como pendente no Keystone e desmarca quitação Solidcon
            await pool.query(
                `UPDATE transactions SET 
                    status = 'pending',
                    solidcon_quitado = 0,
                    received_at = NULL,
                    received_channel = NULL,
                    updated_at = NOW() 
                 WHERE id = ? AND company_id = ?`,
                [tx.id, companyId]
            );

            // Desconcilia eventuais lançamentos bancários amarrados a esta receita no ERP Keystone
            try {
                await pool.query(
                    `UPDATE bank_statements 
                     SET status = 'pending', reconciled_transaction_id = NULL 
                     WHERE reconciled_transaction_id = ? AND company_id = ?`,
                    [tx.id, companyId]
                );
            } catch (e) {
                // ignore
            }
        }

        const inspection = await ExternalDbService.getSolidconDetailedInspection({
            host: server,
            database,
            user,
            password
        }, {
            cdCrediarioCupom,
            nrCupom,
            interestKey: tx.solidcon_interest_key,
            cdFilial: tx.cdfilial || company.cdfilial || '1',
            cdPDV: tx.pdv || company.cdpdv || null,
            transaction: tx
        });

        const baixaCount = cancelResult.deletedContaBaixas?.length || 0;
        const movCount = cancelResult.deletedMovimentos?.length || 0;
        const msg = `Baixa cancelada no Solidcon com sucesso! ${baixaCount > 0 ? `Baixa(s) #${cancelResult.deletedContaBaixas.join(', #')} removida(s).` : ''} ${movCount > 0 ? `${movCount} movimento(s) bancário(s) estornado(s).` : ''} ${reopen ? 'Receita reaberta como Pendente no Keystone.' : ''}`.trim();

        return {
            success: true,
            message: msg,
            data: cancelResult,
            updatedInspection: inspection
        };
    }

    static async tieRevenueSolidconMovement(companyId: number, transactionPublicId: string) {
        const company = await CompanyService.getById(companyId);
        if (!company) throw new Error('Empresa não encontrada.');

        const isSolidcon = !!company.serv_solidcon;
        let server = isSolidcon ? company.serv_solidcon : company.serv_dorsal;
        const database = isSolidcon ? company.bd_solidcon : company.bd_dorsal;
        const user = isSolidcon ? company.login_solidcon : company.login_dorsal;
        const rawPassword = isSolidcon ? company.senha_solidcon : company.senha_dorsal;
        const password = rawPassword ? (decrypt(rawPassword) || rawPassword) : '';

        if (!server || !database || !user || !password) {
            throw new Error('Configuração do banco de dados Solidcon incompleta no cadastro da empresa.');
        }

        const [txRows]: any = await pool.query(
            `SELECT t.*, 
                    COALESCE(cu.name, sale_customer.name, s.name, con.name, ru.full_name) as entity_name,
                    COALESCE(cu.name, sale_customer.name) as customer_name
             FROM transactions t
             LEFT JOIN customers cu ON cu.id = t.customer_id
             LEFT JOIN sales_orders so ON t.sale_id = so.id
             LEFT JOIN customers sale_customer ON so.customer_id = sale_customer.id
             LEFT JOIN suppliers s ON t.supplier_id = s.id
             LEFT JOIN contacts con ON t.contact_id = con.id
             LEFT JOIN users ru ON t.related_user_id = ru.id
             WHERE t.public_id = ? AND t.company_id = ? LIMIT 1`,
            [transactionPublicId, companyId]
        );

        if (!txRows || txRows.length === 0 || !txRows[0]) {
            throw new Error('Receita não encontrada.');
        }

        const tx = txRows[0];
        let cdCrediarioCupom: number | null = tx.solidcon_key ? parseInt(tx.solidcon_key, 10) : null;
        if (isNaN(cdCrediarioCupom as number)) cdCrediarioCupom = null;

        const desc = String(tx.description || '');
        let nrCupom: string | null = null;
        const matchCupom = desc.match(/(?:cupom|venda|compra)?\s*#?\s*(\d+)/i);
        if (matchCupom && matchCupom[1]) {
            nrCupom = matchCupom[1];
        }
        if (!nrCupom && tx.solidcon_key && /^\d+$/.test(String(tx.solidcon_key).trim())) {
            nrCupom = String(tx.solidcon_key).trim();
        }

        const initialInspection = await ExternalDbService.getSolidconDetailedInspection({
            host: server,
            database,
            user,
            password
        }, {
            cdCrediarioCupom,
            nrCupom,
            interestKey: tx.solidcon_interest_key,
            cdFilial: tx.cdfilial || company.cdfilial || '1',
            cdPDV: tx.pdv || company.cdpdv || null,
            transaction: tx
        });

        const movementsToTie = initialInspection.movements || [];
        if (movementsToTie.length === 0) {
            throw new Error('Nenhum movimento bancário encontrado no Solidcon para realizar a amarração.');
        }

        const tiedResults: any[] = [];
        const cdFilial = tx.cdfilial || company.cdfilial || '1';
        const cdEmpresa = company.id || 10;
        const docResolved = nrCupom || tx.solidcon_key || tx.description || '';

        for (const mov of movementsToTie) {
            const resTie = await ExternalDbService.createSolidconContaBaixaForMovement({
                host: server,
                database,
                user,
                password
            }, {
                cdBancoContaMovimento: mov.cdBancoContaMovimento,
                cdFilial,
                cdEmpresa,
                cdPessoaComercial: 1,
                valor: Number(mov.vlDebito || mov.vlCredito || tx.amount || 0),
                documento: docResolved,
                historico: mov.Historico || `Recebimento Cupom #${docResolved}`,
                dtLancamento: mov.dtLancamento || tx.received_at || tx.date,
                cdBancoConta: mov.cdBancoConta
            });
            tiedResults.push(resTie);
        }

        const updatedInspection = await ExternalDbService.getSolidconDetailedInspection({
            host: server,
            database,
            user,
            password
        }, {
            cdCrediarioCupom,
            nrCupom,
            interestKey: tx.solidcon_interest_key,
            cdFilial: tx.cdfilial || company.cdfilial || '1',
            cdPDV: tx.pdv || company.cdpdv || null,
            transaction: tx
        });

        return {
            tiedResults,
            updatedInspection,
            message: `Amarração realizada com sucesso para ${tiedResults.length} movimento(s) bancário(s). As tabelas tbConta, tbContaBaixa e tbContaParcela agora estão integradas para conciliação no extrato bancário.`
        };
    }

    static async scanWebRevenuesUntied(companyId: number, options?: { limit?: number | undefined; cdFilial?: number | string | undefined }) {
        const company = await CompanyService.getById(companyId);
        if (!company) throw new Error('Empresa não encontrada.');

        const isSolidcon = !!company.serv_solidcon;
        let server = isSolidcon ? company.serv_solidcon : company.serv_dorsal;
        const database = isSolidcon ? company.bd_solidcon : company.bd_dorsal;
        const user = isSolidcon ? company.login_solidcon : company.login_dorsal;
        const rawPassword = isSolidcon ? company.senha_solidcon : company.senha_dorsal;
        const password = rawPassword ? (decrypt(rawPassword) || rawPassword) : '';

        if (!server || !database || !user || !password) {
            throw new Error('Configuração do banco de dados Solidcon incompleta no cadastro da empresa.');
        }

        let port = 1433;
        if (server.includes(',')) {
            const parts = server.split(',');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || 1433;
        } else if (server.includes(':')) {
            const parts = server.split(':');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || 1433;
        }

        const sqlPool = new sql.ConnectionPool({
            user,
            password,
            database,
            server,
            port,
            options: { encrypt: false, trustServerCertificate: true },
            connectionTimeout: 10000,
            requestTimeout: 20000
        });
        await sqlPool.connect();

        try {
            const limit = options?.limit || 1000;
            const [txs]: any = await pool.query(`
                SELECT t.id, t.public_id, t.description, t.amount, t.status, t.date, t.date_launch, t.received_at, t.solidcon_key, t.solidcon_quitado, t.cdfilial,
                       c.name as customer_name
                FROM transactions t
                LEFT JOIN customers c ON c.id = t.customer_id
                WHERE t.company_id = ? AND t.type = 'income'
                ORDER BY t.id DESC
                LIMIT ?
            `, [companyId, limit]);

            const cdCrediarioSet = new Set<number>();
            const nrCupomSet = new Set<number>();

            for (const tx of txs) {
                let cd = tx.solidcon_key ? parseInt(tx.solidcon_key, 10) : NaN;
                if (!isNaN(cd) && cd > 0) {
                    cdCrediarioSet.add(cd);
                } else {
                    const match = String(tx.description || '').match(/(?:cupom|venda|compra)?\s*#?\s*(\d+)/i);
                    if (match && match[1]) {
                        const nr = parseInt(match[1], 10);
                        if (!isNaN(nr) && nr > 0) nrCupomSet.add(nr);
                    }
                }
            }

            const solidconByCd = new Map<number, any>();
            const solidconByNr = new Map<number, any>();

            // Query in chunks of 500
            const cdList = Array.from(cdCrediarioSet);
            for (let i = 0; i < cdList.length; i += 500) {
                const chunk = cdList.slice(i, i + 500);
                const res = await sqlPool.request().query(`
                    WITH Ranked AS (
                        SELECT 
                            c.cdCrediarioCupom, c.nrCupom, c.vlCrediario, c.vlQuitado, c.dtCancelado, c.cdFilial,
                            p.cdCrediarioDeposito,
                            d.cdBancoContaMovimento, d.cdBancoConta,
                            cb.cdContaBaixa,
                            cp.cdConta,
                            m.Historico, m.dtLancamento,
                            ROW_NUMBER() OVER (PARTITION BY c.cdCrediarioCupom ORDER BY p.nrPagamento DESC) as rn
                        FROM tbCrediarioCupom c
                        LEFT JOIN tbCrediarioCupomPagamento p ON p.cdCrediarioCupom = c.cdCrediarioCupom
                        LEFT JOIN tbCrediarioDeposito d ON d.cdCrediarioDeposito = p.cdCrediarioDeposito
                        LEFT JOIN tbBancoContaMovimento m ON m.cdBancoContaMovimento = d.cdBancoContaMovimento
                        LEFT JOIN tbContaBaixa cb ON cb.cdBancoContaMovimento = d.cdBancoContaMovimento
                        LEFT JOIN tbContaParcela cp ON cp.cdBancoContaMovimento = d.cdBancoContaMovimento
                        WHERE c.cdCrediarioCupom IN (${chunk.join(',')})
                    )
                    SELECT * FROM Ranked WHERE rn = 1
                `);
                for (const row of res.recordset || []) {
                    solidconByCd.set(row.cdCrediarioCupom, row);
                    if (row.nrCupom) solidconByNr.set(row.nrCupom, row);
                }
            }

            const nrList = Array.from(nrCupomSet).filter(nr => !solidconByNr.has(nr));
            for (let i = 0; i < nrList.length; i += 500) {
                const chunk = nrList.slice(i, i + 500);
                const res = await sqlPool.request().query(`
                    WITH Ranked AS (
                        SELECT 
                            c.cdCrediarioCupom, c.nrCupom, c.vlCrediario, c.vlQuitado, c.dtCancelado, c.cdFilial,
                            p.cdCrediarioDeposito,
                            d.cdBancoContaMovimento, d.cdBancoConta,
                            cb.cdContaBaixa,
                            cp.cdConta,
                            m.Historico, m.dtLancamento,
                            ROW_NUMBER() OVER (PARTITION BY c.nrCupom ORDER BY c.cdCrediarioCupom DESC, p.nrPagamento DESC) as rn
                        FROM tbCrediarioCupom c
                        LEFT JOIN tbCrediarioCupomPagamento p ON p.cdCrediarioCupom = c.cdCrediarioCupom
                        LEFT JOIN tbCrediarioDeposito d ON d.cdCrediarioDeposito = p.cdCrediarioDeposito
                        LEFT JOIN tbBancoContaMovimento m ON m.cdBancoContaMovimento = d.cdBancoContaMovimento
                        LEFT JOIN tbContaBaixa cb ON cb.cdBancoContaMovimento = d.cdBancoContaMovimento
                        LEFT JOIN tbContaParcela cp ON cp.cdBancoContaMovimento = d.cdBancoContaMovimento
                        WHERE c.nrCupom IN (${chunk.join(',')})
                    )
                    SELECT * FROM Ranked WHERE rn = 1
                `);
                for (const row of res.recordset || []) {
                    if (!solidconByCd.has(row.cdCrediarioCupom)) {
                        solidconByCd.set(row.cdCrediarioCupom, row);
                    }
                    solidconByNr.set(row.nrCupom, row);
                }
            }

            const items: any[] = [];
            let totalTied = 0;
            let totalUntied = 0;
            let totalPendingInSolidcon = 0;
            let totalNotFound = 0;

            for (const tx of txs) {
                let cdCrediarioCupom = tx.solidcon_key ? parseInt(tx.solidcon_key, 10) : NaN;
                if (isNaN(cdCrediarioCupom) || cdCrediarioCupom <= 0) cdCrediarioCupom = NaN;

                let nrCupom: string | null = null;
                const matchCupom = String(tx.description || '').match(/(?:cupom|venda|compra)?\s*#?\s*(\d+)/i);
                if (matchCupom && matchCupom[1]) nrCupom = matchCupom[1];
                if (!nrCupom && tx.solidcon_key && /^\d+$/.test(String(tx.solidcon_key).trim())) {
                    nrCupom = String(tx.solidcon_key).trim();
                }

                let solidconRow: any = null;
                if (!isNaN(cdCrediarioCupom) && solidconByCd.has(cdCrediarioCupom)) {
                    solidconRow = solidconByCd.get(cdCrediarioCupom);
                } else if (nrCupom && solidconByNr.has(parseInt(nrCupom, 10))) {
                    solidconRow = solidconByNr.get(parseInt(nrCupom, 10));
                }

                let tieStatus: 'tied' | 'untied' | 'pending_solidcon' | 'not_found' = 'not_found';
                if (solidconRow) {
                    if (solidconRow.cdContaBaixa && solidconRow.cdConta) {
                        tieStatus = 'tied';
                        totalTied++;
                    } else if (solidconRow.cdBancoContaMovimento) {
                        tieStatus = 'untied';
                        totalUntied++;
                    } else if (solidconRow.cdCrediarioCupom) {
                        tieStatus = 'pending_solidcon';
                        totalPendingInSolidcon++;
                    }
                } else {
                    totalNotFound++;
                }

                items.push({
                    id: tx.id,
                    public_id: tx.public_id,
                    description: tx.description,
                    amount: Number(tx.amount || 0),
                    customer_name: tx.customer_name || 'Sem cliente associado',
                    date: tx.date,
                    status: tx.status,
                    solidcon_key: tx.solidcon_key,
                    solidcon_quitado: Boolean(tx.solidcon_quitado),
                    cdCrediarioCupom: solidconRow?.cdCrediarioCupom,
                    nrCupom: solidconRow?.nrCupom || nrCupom,
                    cdCrediarioDeposito: solidconRow?.cdCrediarioDeposito,
                    cdBancoContaMovimento: solidconRow?.cdBancoContaMovimento,
                    cdBancoConta: solidconRow?.cdBancoConta,
                    cdConta: solidconRow?.cdConta,
                    cdContaBaixa: solidconRow?.cdContaBaixa,
                    historico: solidconRow?.Historico,
                    dtLancamento: solidconRow?.dtLancamento,
                    tieStatus,
                    source: 'web'
                });
            }

            return {
                source: 'web',
                totalWebRevenues: txs.length,
                totalUntied,
                totalTied,
                totalPendingInSolidcon,
                totalNotFound,
                items
            };
        } finally {
            try {
                await sqlPool.close();
            } catch {}
        }
    }

    static async tieAllWebRevenuesUntied(companyId: number, options?: { limit?: number | undefined; specificTransactionPublicIds?: string[] | undefined }) {
        const scan = await this.scanWebRevenuesUntied(companyId, { limit: options?.limit || 1000 });
        let toProcess = scan.items;

        if (options?.specificTransactionPublicIds && options.specificTransactionPublicIds.length > 0) {
            const allowed = new Set(options.specificTransactionPublicIds);
            toProcess = toProcess.filter(i => allowed.has(i.public_id));
        }

        // Process items that are untied or have bank movements without account tie
        toProcess = toProcess.filter(i => i.tieStatus === 'untied' || (i.cdBancoContaMovimento && (!i.cdContaBaixa || !i.cdConta)));

        const logLines: string[] = [];
        const nowStr = new Date().toLocaleString('pt-BR');
        logLines.push(`[${nowStr}] 🔗 Iniciando amarração contábil de ${toProcess.length} receita(s) da base Web no Solidcon...`);

        if (toProcess.length === 0) {
            logLines.push(`[${nowStr}] ℹ️ Todas as receitas da base Web já estão amarradas ou não possuem pendências no Solidcon.`);
            return {
                totalFound: 0,
                totalTied: 0,
                alreadyTied: scan.totalTied,
                errorsCount: 0,
                items: [],
                logLines
            };
        }

        const company = await CompanyService.getById(companyId);
        if (!company) throw new Error('Empresa não encontrada.');

        const isSolidcon = !!company.serv_solidcon;
        let server = (isSolidcon ? company.serv_solidcon : company.serv_dorsal) || '';
        const database = (isSolidcon ? company.bd_solidcon : company.bd_dorsal) || '';
        const user = (isSolidcon ? company.login_solidcon : company.login_dorsal) || '';
        const rawPassword = (isSolidcon ? company.senha_solidcon : company.senha_dorsal) || '';
        const password = rawPassword ? (decrypt(rawPassword) || rawPassword) : '';

        if (!server || !database || !user || !password) {
            throw new Error('Configuração do banco de dados Solidcon incompleta no cadastro da empresa.');
        }

        let port = 1433;
        if (server.includes(',')) {
            const parts = server.split(',');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || 1433;
        } else if (server.includes(':')) {
            const parts = server.split(':');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || 1433;
        }

        const sqlPool = new sql.ConnectionPool({
            user, password, database, server, port,
            options: { encrypt: false, trustServerCertificate: true },
            connectionTimeout: 10000, requestTimeout: 20000
        });
        await sqlPool.connect();

        let totalTied = 0;
        let alreadyTied = 0;
        let errorsCount = 0;
        const itemsResult: any[] = [];

        try {
            // Resolve Pessoa Comercial / Empresa
            let cdEmpresaResolved = 10;
            let cdPessoaComercialResolved = 1;
            const resPessCheck = await sqlPool.request()
                .input('empHint', sql.Int, companyId || 10)
                .input('pessHint', sql.Int, 1)
                .query(`
                    SELECT TOP 1 cdEmpresa, cdPessoaComercial 
                    FROM tbPessoaComercial 
                    ORDER BY CASE WHEN cdEmpresa = @empHint AND cdPessoaComercial = @pessHint THEN 0
                                  WHEN cdPessoaComercial = 1 THEN 1 
                                  ELSE 2 END, cdEmpresa ASC
                `);
            if (resPessCheck.recordset?.[0]) {
                cdEmpresaResolved = resPessCheck.recordset[0].cdEmpresa;
                cdPessoaComercialResolved = resPessCheck.recordset[0].cdPessoaComercial;
            }

            for (const item of toProcess) {
                try {
                    if (item.cdBancoContaMovimento) {
                        const movIdNum = item.cdBancoContaMovimento;
                        const docStr = String(item.nrCupom || item.solidcon_key || item.description || '').substring(0, 10);
                        const histStr = String(item.historico || `Recebimento Crediario Cupom #${item.nrCupom || ''}`).substring(0, 80);
                        const valNum = Number(item.amount || 0);
                        const filialNum = Number(item.cdFilial || company.cdfilial || 1);
                        const contaBancoNum = Number(item.cdBancoConta || 1);
                        const dtLanc = item.dtLancamento ? new Date(item.dtLancamento) : (item.date ? new Date(item.date) : new Date());

                        const reqExec = sqlPool.request();
                        reqExec.input('cdFilial', sql.Int, filialNum);
                        reqExec.input('cdEmpresa', sql.TinyInt, cdEmpresaResolved);
                        reqExec.input('cdPessoaComercial', sql.Int, cdPessoaComercialResolved);
                        reqExec.input('Documento', sql.VarChar, docStr);
                        reqExec.input('dtInclusao', sql.DateTime, dtLanc);
                        reqExec.input('cdBancoConta', sql.Int, contaBancoNum);
                        reqExec.input('cdBancoContaMovimento', sql.Int, movIdNum);
                        reqExec.input('vlValor', sql.Money, valNum);
                        reqExec.input('Historico', sql.VarChar, histStr);

                        const resExec = await reqExec.query(`
                            BEGIN TRANSACTION;
                            
                            -- 1. tbConta (Receita)
                            INSERT INTO tbConta (
                                cdPessoaFilialConta, cdEmpresa, cdPessoaComercial, cdContaTipo, Documento, cdPagamentoTipo, dtInclusao, inNaoInformaNoReinf, XmlNFSe
                            ) VALUES (
                                @cdFilial, @cdEmpresa, @cdPessoaComercial, 4, @Documento, 0, @dtInclusao, NULL, NULL
                            );
                            DECLARE @newCdConta INT = SCOPE_IDENTITY();
                            IF @newCdConta IS NULL
                                SELECT TOP 1 @newCdConta = cdConta FROM tbConta ORDER BY cdConta DESC;

                            -- 2. tbContaBaixa
                            INSERT INTO tbContaBaixa (
                                cdPessoaFilialContaBaixa, cdPessoaFilialBancoConta, cdBancoConta, cdBancoContaMovimento,
                                dtContaBaixa, vlContaBaixa, Documento, inRecebimento, Historico, cdPagamentoTipo, inAvista
                            ) VALUES (
                                @cdFilial, @cdFilial, @cdBancoConta, @cdBancoContaMovimento,
                                @dtInclusao, @vlValor, @Documento, 1, @Historico, 0, 1
                            );
                            DECLARE @newCdContaBaixa INT = SCOPE_IDENTITY();
                            IF @newCdContaBaixa IS NULL
                                SELECT TOP 1 @newCdContaBaixa = cdContaBaixa FROM tbContaBaixa ORDER BY cdContaBaixa DESC;

                            -- 3. tbContaParcela
                            INSERT INTO tbContaParcela (
                                cdPessoaFilialConta, cdConta, cdContaParcela, cdPessoaFilialContaBaixa, cdContaBaixa,
                                cdIndice, dtParcela, vlParcela, vlMulta, vlMora, vlDesconto, inBoleto, Historico,
                                dtCompetencia, cdBancoContaMovimento, CNPJFactoring, vlTarifaBoletoBanco,
                                dtParcelaOriginal, vlParcelaOriginal, inEnviadoIntegrador
                            ) VALUES (
                                @cdFilial, @newCdConta, '1 ', @cdFilial, @newCdContaBaixa,
                                1, @dtInclusao, @vlValor, 0, 0, 0, 0, @Historico,
                                @dtInclusao, @cdBancoContaMovimento, NULL, NULL,
                                @dtInclusao, @vlValor, 0
                            );

                            COMMIT;
                            SELECT @newCdConta AS cdConta, @newCdContaBaixa AS cdContaBaixa;
                        `);

                        const cdConta = resExec.recordset?.[0]?.cdConta;
                        const cdContaBaixa = resExec.recordset?.[0]?.cdContaBaixa;

                        // Update MySQL transactions table
                        await pool.query('UPDATE transactions SET solidcon_quitado = 1, updated_at = NOW() WHERE id = ?', [item.id]);

                        totalTied++;
                        logLines.push(`✅ [Web #${item.id}] Receita "${item.description || item.public_id}" amarrada com sucesso (tbConta #${cdConta}, tbContaBaixa #${cdContaBaixa}, Movimento #${movIdNum})`);
                        itemsResult.push({
                            ...item,
                            cdConta,
                            cdContaBaixa,
                            status: 'tied'
                        });
                    }
                } catch (itemErr: any) {
                    errorsCount++;
                    logLines.push(`❌ [Web #${item.id}] Erro ao amarrar: ${itemErr.message}`);
                    itemsResult.push({
                        ...item,
                        status: 'error',
                        error: itemErr.message
                    });
                }
            }

            return {
                totalFound: toProcess.length,
                totalTied,
                alreadyTied,
                errorsCount,
                items: itemsResult,
                logLines
            };
        } finally {
            try {
                await sqlPool.close();
            } catch {}
        }
    }

    static async scanUntiedMovements(companyId: number, options?: { source?: string | undefined; limit?: number | undefined; cdFilial?: number | string | undefined }) {
        const source = options?.source || 'web';
        if (source === 'web') {
            return await this.scanWebRevenuesUntied(companyId, options);
        } else {
            return await this.scanUntiedSolidconMovements(companyId, options);
        }
    }

    static async tieAllUntiedMovements(companyId: number, options?: { source?: string | undefined; limit?: number | undefined; cdFilial?: number | string | undefined; specificIds?: (string | number)[] | undefined }) {
        const source = options?.source || 'web';
        if (source === 'web') {
            return await this.tieAllWebRevenuesUntied(companyId, {
                limit: options?.limit,
                specificTransactionPublicIds: options?.specificIds as string[]
            });
        } else {
            return await this.tieAllUntiedSolidconMovements(companyId, {
                limit: options?.limit,
                cdFilial: options?.cdFilial,
                specificMovementIds: options?.specificIds as number[]
            });
        }
    }

    static async scanUntiedSolidconMovements(companyId: number, options?: { limit?: number | undefined; cdFilial?: number | string | undefined }) {
        const company = await CompanyService.getById(companyId);
        if (!company) throw new Error('Empresa não encontrada.');

        const isSolidcon = !!company.serv_solidcon;
        let server = isSolidcon ? company.serv_solidcon : company.serv_dorsal;
        const database = isSolidcon ? company.bd_solidcon : company.bd_dorsal;
        const user = isSolidcon ? company.login_solidcon : company.login_dorsal;
        const rawPassword = isSolidcon ? company.senha_solidcon : company.senha_dorsal;
        const password = rawPassword ? (decrypt(rawPassword) || rawPassword) : '';

        if (!server || !database || !user || !password) {
            throw new Error('Configuração do banco de dados Solidcon incompleta no cadastro da empresa.');
        }

        const cdFilial = options?.cdFilial || company.cdfilial || '1';
        return await ExternalDbService.scanUntiedSolidconMovements({
            host: server,
            database,
            user,
            password
        }, {
            cdFilial,
            limit: options?.limit || 1000
        });
    }

    static async tieAllUntiedSolidconMovements(companyId: number, options?: { limit?: number | undefined; cdFilial?: number | string | undefined; specificMovementIds?: number[] | undefined }) {
        const company = await CompanyService.getById(companyId);
        if (!company) throw new Error('Empresa não encontrada.');

        const isSolidcon = !!company.serv_solidcon;
        let server = isSolidcon ? company.serv_solidcon : company.serv_dorsal;
        const database = isSolidcon ? company.bd_solidcon : company.bd_dorsal;
        const user = isSolidcon ? company.login_solidcon : company.login_dorsal;
        const rawPassword = isSolidcon ? company.senha_solidcon : company.senha_dorsal;
        const password = rawPassword ? (decrypt(rawPassword) || rawPassword) : '';

        if (!server || !database || !user || !password) {
            throw new Error('Configuração do banco de dados Solidcon incompleta no cadastro da empresa.');
        }

        const cdFilial = options?.cdFilial || company.cdfilial || '1';
        const cdEmpresa = company.id || 10;

        return await ExternalDbService.tieAllUntiedSolidconMovements({
            host: server,
            database,
            user,
            password
        }, {
            cdFilial,
            cdEmpresa,
            limit: options?.limit || 1000,
            specificMovementIds: options?.specificMovementIds
        });
    }

    static async getExpenseSolidconDetails(companyId: number, transactionPublicId: string) {
        const company = await CompanyService.getById(companyId);
        if (!company) throw new Error('Empresa não encontrada.');

        const isSolidcon = !!company.serv_solidcon;
        let server = isSolidcon ? company.serv_solidcon : company.serv_dorsal;
        const database = isSolidcon ? company.bd_solidcon : company.bd_dorsal;
        const user = isSolidcon ? company.login_solidcon : company.login_dorsal;
        const rawPassword = isSolidcon ? company.senha_solidcon : company.senha_dorsal;
        const password = rawPassword ? (decrypt(rawPassword) || rawPassword) : '';

        if (!server || !database || !user || !password) {
            throw new Error('Configuração do banco de dados Solidcon incompleta no cadastro da empresa.');
        }

        const [txRows]: any = await pool.query(
            `SELECT t.*, 
                    COALESCE(s.name, cu.name, con.name, ru.full_name) as entity_name,
                    COALESCE(s.name, cu.name) as supplier_name,
                    COALESCE(s.cnpj_cpf, cu.cnpj_cpf) as supplier_cnpj_cpf,
                    (CASE 
                        WHEN COALESCE(s.cnpj_cpf, cu.cnpj_cpf, con.cnpj_cpf, ru.cpf_cnpj) IS NULL THEN NULL 
                        WHEN LENGTH(REPLACE(REPLACE(REPLACE(COALESCE(s.cnpj_cpf, cu.cnpj_cpf, con.cnpj_cpf, ru.cpf_cnpj), '.', ''), '-', ''), '/', '')) <= 11 
                            THEN LPAD(REPLACE(REPLACE(REPLACE(COALESCE(s.cnpj_cpf, cu.cnpj_cpf, con.cnpj_cpf, ru.cpf_cnpj), '.', ''), '-', ''), '/', ''), 11, '0') 
                        ELSE LPAD(REPLACE(REPLACE(REPLACE(COALESCE(s.cnpj_cpf, cu.cnpj_cpf, con.cnpj_cpf, ru.cpf_cnpj), '.', ''), '-', ''), '/', ''), 14, '0') 
                    END) as entity_cnpj_cpf,
                    COALESCE(s.phone, cu.phone, con.phone, ru.phone) as entity_phone,
                    b.name as bank_account_name, b.account_number as bank_account_number,
                    fc.name as category_name
             FROM transactions t
             LEFT JOIN suppliers s ON t.supplier_id = s.id
             LEFT JOIN customers cu ON cu.id = t.customer_id
             LEFT JOIN contacts con ON t.contact_id = con.id
             LEFT JOIN users ru ON t.related_user_id = ru.id
             LEFT JOIN bank_accounts b ON b.id = t.bank_account_id
             LEFT JOIN categories fc ON fc.id = t.category_id
             WHERE t.public_id = ? AND t.company_id = ? LIMIT 1`,
            [transactionPublicId, companyId]
        );

        if (!txRows || txRows.length === 0 || !txRows[0]) {
            throw new Error('Despesa não encontrada.');
        }

        const tx = txRows[0];
        let cdConta: number | null = tx.solidcon_key ? parseInt(tx.solidcon_key, 10) : null;
        if (isNaN(cdConta as number)) cdConta = null;

        const desc = String(tx.description || '');
        let documento: string | null = null;
        const matchDoc = desc.match(/(?:doc|nf|fatura|titulo|cupom|duplicata|pedido)?\s*#?\s*(\d+)/i);
        if (matchDoc && matchDoc[1]) {
            documento = matchDoc[1];
        }
        if (!documento && tx.solidcon_key && /^\d+$/.test(String(tx.solidcon_key).trim())) {
            documento = String(tx.solidcon_key).trim();
        }

        const supplierCpfDigits = (tx.entity_cnpj_cpf || tx.supplier_cnpj_cpf)
            ? String(tx.entity_cnpj_cpf || tx.supplier_cnpj_cpf).replace(/\D/g, '')
            : null;

        const inspection = await ExternalDbService.getSolidconDetailedExpenseInspection({
            host: server,
            database,
            user,
            password
        }, {
            cdConta,
            documento,
            supplierCpfCnpj: supplierCpfDigits,
            cdFilial: tx.cdfilial || company.cdfilial || '1',
            transaction: tx
        });

        const expObj = {
            id: tx.id,
            public_id: tx.public_id,
            description: tx.description,
            amount: Number(tx.amount || 0),
            original_amount: tx.original_amount !== null && tx.original_amount !== undefined ? Number(tx.original_amount) : Number(tx.amount || 0),
            date: tx.date,
            received_at: tx.received_at,
            status: tx.status,
            payment_method: tx.payment_method,
            solidcon_key: tx.solidcon_key,
            solidcon_quitado: Boolean(tx.solidcon_quitado),
            cdfilial: tx.cdfilial || company.cdfilial || '1',
            documento: documento || inspection.conta?.Documento || tx.solidcon_key || '-',
            supplier_name: tx.supplier_name,
            supplier_cnpj_cpf: tx.supplier_cnpj_cpf,
            entity_name: tx.entity_name || tx.supplier_name || 'Sem fornecedor associado',
            entity_cnpj_cpf: tx.entity_cnpj_cpf || tx.supplier_cnpj_cpf || null,
            entity_phone: tx.entity_phone,
            bank_account_name: tx.bank_account_name,
            category_name: tx.category_name
        };

        return {
            expense: expObj,
            transaction: expObj,
            solidcon: inspection,
            tableIds: inspection.tableIds,
            conta: inspection.conta,
            contas: inspection.contas,
            contaParcelas: inspection.contaParcelas,
            contaBaixas: inspection.contaBaixas,
            bankMovements: inspection.bankMovements,
            movements: inspection.bankMovements,
            duplicateAnalysis: inspection.duplicateAnalysis,
            hasDuplicates: inspection.hasDuplicates,
            duplicateReasons: inspection.duplicateReasons,
            logLines: inspection.logLines
        };
    }

    static async fixExpenseSolidconDuplicates(companyId: number, transactionPublicId: string) {
        const company = await CompanyService.getById(companyId);
        if (!company) throw new Error('Empresa não encontrada.');

        const isSolidcon = !!company.serv_solidcon;
        let server = isSolidcon ? company.serv_solidcon : company.serv_dorsal;
        const database = isSolidcon ? company.bd_solidcon : company.bd_dorsal;
        const user = isSolidcon ? company.login_solidcon : company.login_dorsal;
        const rawPassword = isSolidcon ? company.senha_solidcon : company.senha_dorsal;
        const password = rawPassword ? (decrypt(rawPassword) || rawPassword) : '';

        if (!server || !database || !user || !password) {
            throw new Error('Configuração do banco de dados Solidcon incompleta no cadastro da empresa.');
        }

        const [txRows]: any = await pool.query(
            `SELECT t.*, 
                    COALESCE(s.name, cu.name, con.name, ru.full_name) as entity_name
             FROM transactions t
             LEFT JOIN suppliers s ON t.supplier_id = s.id
             LEFT JOIN customers cu ON cu.id = t.customer_id
             LEFT JOIN contacts con ON t.contact_id = con.id
             LEFT JOIN users ru ON t.related_user_id = ru.id
             WHERE t.public_id = ? AND t.company_id = ? LIMIT 1`,
            [transactionPublicId, companyId]
        );

        if (!txRows || txRows.length === 0 || !txRows[0]) {
            throw new Error('Despesa não encontrada.');
        }

        const tx = txRows[0];
        let cdConta: number | null = tx.solidcon_key ? parseInt(tx.solidcon_key, 10) : null;
        if (isNaN(cdConta as number)) cdConta = null;

        const desc = String(tx.description || '');
        let documento: string | null = null;
        const matchDoc = desc.match(/(?:doc|nf|fatura|titulo|cupom|duplicata|pedido)?\s*#?\s*(\d+)/i);
        if (matchDoc && matchDoc[1]) {
            documento = matchDoc[1];
        }
        if (!documento && tx.solidcon_key && /^\d+$/.test(String(tx.solidcon_key).trim())) {
            documento = String(tx.solidcon_key).trim();
        }

        const fixResult = await ExternalDbService.fixSolidconExpenseDuplicates({
            host: server,
            database,
            user,
            password
        }, {
            cdConta,
            documento,
            cdFilial: tx.cdfilial || company.cdfilial || '1'
        });

        const inspection = await ExternalDbService.getSolidconDetailedExpenseInspection({
            host: server,
            database,
            user,
            password
        }, {
            cdConta,
            documento,
            cdFilial: tx.cdfilial || company.cdfilial || '1',
            transaction: tx
        });

        return {
            fixResult,
            updatedInspection: inspection,
            message: `Ajuste concluído: ${fixResult.deletedBaixasCount} baixa(s) duplicada(s) e ${fixResult.deletedMovementsCount} movimento(s) bancário(s) duplicado(s) removidos.`
        };
    }

    /**
     * Processa a baixa de um boleto / recebimento a partir de notificação de Webhook (Inter, Asaas, etc.)
     * Verifica número do boleto, confere valor original vs valor recebido, calcula/ajusta multa e juros,
     * realiza a baixa, atualiza saldo bancário e sincroniza com Solidcon se aplicável.
     */
    static async processWebhookBoletoPayment(params: {
        companyId?: number | null;
        identifiers: {
            nossoNumero?: string | null;
            seuNumero?: string | null;
            barcode?: string | null;
            txid?: string | null;
            asaasPaymentId?: string | null;
        };
        paymentData: {
            originalAmount?: number | null;
            totalReceived?: number | null;
            fineAmount?: number | null;
            interestAmount?: number | null;
            fineRate?: number | null;
            interestRate?: number | null;
            paymentDate?: string | Date | null;
            receivedChannel?: string | null;
            status?: string | null;
            rawPayload?: any;
        };
    }): Promise<{
        success: boolean;
        transactionId?: number;
        publicId?: string;
        description?: string;
        originalAmount?: number;
        fine?: number;
        interest?: number;
        finalAmount?: number;
        isAlreadyPaid?: boolean;
        message: string;
    }> {
        const { identifiers, paymentData } = params;
        const nossoNumero = identifiers.nossoNumero ? String(identifiers.nossoNumero).trim() : null;
        const seuNumero = identifiers.seuNumero ? String(identifiers.seuNumero).trim() : null;
        const barcode = identifiers.barcode ? String(identifiers.barcode).trim() : null;
        const txid = identifiers.txid ? String(identifiers.txid).trim() : null;
        const asaasPaymentId = identifiers.asaasPaymentId ? String(identifiers.asaasPaymentId).trim() : null;

        if (!nossoNumero && !seuNumero && !barcode && !txid && !asaasPaymentId) {
            return {
                success: false,
                message: 'Nenhum identificador de cobrança (nossoNumero, seuNumero, barcode, txid ou asaasPaymentId) foi fornecido.'
            };
        }

        // Monta lista de condições de busca
        const whereClauses: string[] = [];
        const queryParams: any[] = [];

        if (nossoNumero) {
            whereClauses.push('t.billet_url = ?');
            queryParams.push(nossoNumero);

            const unpaddedNossoNumero = nossoNumero.replace(/^0+/, '');
            if (unpaddedNossoNumero && unpaddedNossoNumero !== nossoNumero) {
                whereClauses.push('t.billet_url = ?');
                queryParams.push(unpaddedNossoNumero);
            }
            whereClauses.push('t.billet_url = ?');
            queryParams.push(`bancointer_pdf_${nossoNumero}`);
        }

        if (asaasPaymentId) {
            whereClauses.push('t.billet_url = ?');
            queryParams.push(asaasPaymentId);
        }

        if (barcode) {
            whereClauses.push('t.barcode = ?');
            queryParams.push(barcode);
            const digitsOnlyBarcode = barcode.replace(/\D/g, '');
            if (digitsOnlyBarcode && digitsOnlyBarcode !== barcode) {
                whereClauses.push('t.barcode = ?');
                queryParams.push(digitsOnlyBarcode);
            }
        }

        if (txid) {
            whereClauses.push('t.public_id = ?');
            queryParams.push(txid);
            whereClauses.push('t.pix_code = ?');
            queryParams.push(txid);
            whereClauses.push('t.pix_key = ?');
            queryParams.push(txid);
        }

        if (seuNumero) {
            whereClauses.push('t.public_id = ?');
            queryParams.push(seuNumero);
            if (seuNumero.length >= 14) {
                whereClauses.push('t.public_id LIKE CONCAT(?, "%")');
                queryParams.push(seuNumero);
            }
        }

        let sql = `
            SELECT t.*, b.company_id as bank_company_id, b.id as resolved_bank_account_id, b.name as bank_name
            FROM transactions t
            JOIN bank_accounts b ON t.bank_account_id = b.id
            WHERE t.type = 'income' AND (${whereClauses.join(' OR ')})
        `;

        if (params.companyId) {
            sql += ' AND t.company_id = ?';
            queryParams.push(params.companyId);
        }

        sql += ' ORDER BY t.id DESC LIMIT 1';

        const [txRows]: any = await pool.query(sql, queryParams);

        if (!txRows || txRows.length === 0 || !txRows[0]) {
            logger.warn({ identifiers, params }, '[Webhook Baixa] Lançamento não encontrado para os identificadores fornecidos.');
            return {
                success: false,
                message: `Lançamento não encontrado para os identificadores fornecidos: ${JSON.stringify(identifiers)}`
            };
        }

        const tx = txRows[0];
        const companyId = tx.company_id || tx.bank_company_id;

        // 1. Determina valor original
        const currentOriginal = (tx.original_amount !== null && tx.original_amount !== undefined && Number(tx.original_amount) > 0)
            ? Number(tx.original_amount)
            : Number(tx.amount || 0);

        const baseOriginal = (paymentData.originalAmount !== undefined && paymentData.originalAmount !== null && Number(paymentData.originalAmount) > 0)
            ? Number(paymentData.originalAmount)
            : currentOriginal;

        // 2. Determina valor total recebido
        const paidTotal = (paymentData.totalReceived !== undefined && paymentData.totalReceived !== null && Number(paymentData.totalReceived) > 0)
            ? Number(paymentData.totalReceived)
            : baseOriginal;

        let fine = paymentData.fineAmount !== undefined && paymentData.fineAmount !== null ? Number(paymentData.fineAmount) : Number(tx.fine || 0);
        let interest = paymentData.interestAmount !== undefined && paymentData.interestAmount !== null ? Number(paymentData.interestAmount) : Number(tx.interest || 0);

        // Se o valor pago for maior que o valor original, calcula/corrige juros e multa
        if (paidTotal > baseOriginal) {
            const diff = Math.round((paidTotal - baseOriginal) * 100) / 100;

            if (paymentData.fineAmount !== undefined && paymentData.fineAmount !== null && paymentData.interestAmount !== undefined && paymentData.interestAmount !== null) {
                fine = Math.round(Number(paymentData.fineAmount) * 100) / 100;
                interest = Math.round(Number(paymentData.interestAmount) * 100) / 100;
            } else if (paymentData.fineAmount !== undefined && paymentData.fineAmount !== null) {
                fine = Math.round(Number(paymentData.fineAmount) * 100) / 100;
                interest = Math.max(0, Math.round((diff - fine) * 100) / 100);
            } else if (paymentData.interestAmount !== undefined && paymentData.interestAmount !== null) {
                interest = Math.round(Number(paymentData.interestAmount) * 100) / 100;
                fine = Math.max(0, Math.round((diff - interest) * 100) / 100);
            } else {
                // Caso não venha discriminação exata de multa/juros
                if (paymentData.fineRate && Number(paymentData.fineRate) > 0) {
                    fine = Math.round((baseOriginal * (Number(paymentData.fineRate) / 100)) * 100) / 100;
                    interest = Math.max(0, Math.round((diff - fine) * 100) / 100);
                } else if (fine > 0) {
                    // Mantém a multa existente e o restante é juros
                    interest = Math.max(0, Math.round((diff - fine) * 100) / 100);
                } else {
                    // Aplica 2% padrão de multa se couber na diferença, restante vira juros
                    const defaultFine = Math.round(baseOriginal * 0.02 * 100) / 100;
                    if (diff >= defaultFine) {
                        fine = defaultFine;
                        interest = Math.max(0, Math.round((diff - fine) * 100) / 100);
                    } else {
                        interest = diff;
                    }
                }
            }
        } else if (paidTotal <= baseOriginal) {
            // Pagamento no prazo ou sem encargos adicionais
            if (paymentData.fineAmount === undefined || paymentData.fineAmount === null) fine = 0;
            if (paymentData.interestAmount === undefined || paymentData.interestAmount === null) interest = 0;
        }

        const finalAmount = Math.round((baseOriginal + fine + interest) * 100) / 100;

        let rawPaymentDate = paymentData.paymentDate;
        let formattedPaymentDate: any = null;
        if (rawPaymentDate) {
            formattedPaymentDate = toBrazilDbDateTime(rawPaymentDate);
        }

        const receivedChannel = paymentData.receivedChannel || (tx.payment_method === 'pix' ? 'pix_qr' : 'barcode');
        const determinedPaymentMethod = (receivedChannel === 'pix_qr' || paymentData.receivedChannel === 'pix_qr') 
            ? 'pix' 
            : (tx.payment_method && ['pix', 'boleto', 'transfer', 'credit', 'debit', 'cash'].includes(tx.payment_method) ? tx.payment_method : 'boleto');
        const isAlreadyPaid = tx.status === 'paid';

        await FinanceTransactionRepository.withTransaction(async (conn: PoolConnection) => {
            if (!isAlreadyPaid) {
                // Baixa da receita
                await conn.query(
                    `UPDATE transactions 
                     SET status = 'paid', 
                         payment_method = ?,
                         original_amount = ?, 
                         fine = ?, 
                         interest = ?, 
                         amount = ?, 
                         received_at = COALESCE(?, NOW()), 
                         received_channel = COALESCE(?, received_channel, 'barcode'),
                         updated_at = NOW() 
                     WHERE id = ?`,
                    [determinedPaymentMethod, baseOriginal, fine, interest, finalAmount, formattedPaymentDate, receivedChannel, tx.id]
                );

                // Incrementa saldo da conta bancária
                await conn.query(
                    `UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?`,
                    [finalAmount, tx.bank_account_id]
                );

                // Sincroniza baixa com Solidcon se aplicável
                await FinanceService.triggerSolidconBaixaIfNeeded(
                    conn,
                    companyId,
                    tx.id,
                    tx.solidcon_key,
                    tx.solidcon_quitado,
                    finalAmount
                );
            } else {
                // Já estava pago: atualiza valores de multa/juros e ajusta diferença de saldo se houver
                const oldAmount = Number(tx.amount || 0);
                const diffAmount = Math.round((finalAmount - oldAmount) * 100) / 100;

                await conn.query(
                    `UPDATE transactions 
                     SET payment_method = COALESCE(payment_method, ?),
                         original_amount = ?, 
                         fine = ?, 
                         interest = ?, 
                         amount = ?, 
                         received_channel = COALESCE(?, received_channel),
                         updated_at = NOW() 
                     WHERE id = ?`,
                    [determinedPaymentMethod, baseOriginal, fine, interest, finalAmount, receivedChannel, tx.id]
                );

                if (diffAmount !== 0) {
                    await conn.query(
                        `UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?`,
                        [diffAmount, tx.bank_account_id]
                    );
                }
            }
        });

        logger.info(
            `[Webhook Baixa] Receita ${tx.public_id} (#${tx.id}) baixada/atualizada via webhook. Original: R$ ${baseOriginal.toFixed(2)}, Multa: R$ ${fine.toFixed(2)}, Juros: R$ ${interest.toFixed(2)}, Total: R$ ${finalAmount.toFixed(2)} (Já pago: ${isAlreadyPaid})`
        );

        return {
            success: true,
            transactionId: tx.id,
            publicId: tx.public_id,
            description: tx.description,
            originalAmount: baseOriginal,
            fine,
            interest,
            finalAmount,
            isAlreadyPaid,
            message: `Receita ${tx.public_id} baixada com sucesso!`
        };
    }
}



