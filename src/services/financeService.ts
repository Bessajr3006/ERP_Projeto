import { randomUUID } from 'crypto';
import pool from '../config/db';
import { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { Category, CreateCategoryData } from '../types/Finance';
import { DashboardStatsSchema } from '../schemas/reportSchemas';
import { CacheService } from './cacheService';
import { toBrazilDate, toBrazilYearMonth } from '../utils/dateTime';
import { BankAccountService } from './bankAccountService';
import { CategorySchema, CategoryListSchema, TransactionListSchema } from '../schemas/financeSchemas';
import { FinanceCategoryRepository } from '../repositories/financeCategoryRepository';
import { FinanceReportRepository } from '../repositories/financeReportRepository';
import { FinanceBankStatementRepository } from '../repositories/financeBankStatementRepository';
import { FinanceTransactionRepository } from '../repositories/financeTransactionRepository';
import { FinanceDocumentRepository } from '../repositories/financeDocumentRepository';
import QRCode from 'qrcode';

export class FinanceService {
    /**
     * Creates a new financial category
     */
    static async createCategory(companyId: number, data: CreateCategoryData): Promise<Category> {
        const { name, type } = data;
        const publicId = randomUUID();

        const insertId = await FinanceCategoryRepository.create(publicId, companyId, name, type);
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

        await FinanceCategoryRepository.update(companyId, categoryId, data.name, data.type);

        return this.getCategoryById(categoryId, companyId);
    }

    static async deleteCategory(publicId: string, companyId: number): Promise<void> {
        const catRows = await FinanceCategoryRepository.getByPublicId(companyId, publicId);
        if (!catRows || catRows.length === 0 || !catRows[0]) throw new Error('Category not found');
        const categoryId = catRows[0].id;

        await FinanceCategoryRepository.delete(companyId, categoryId);
    }

    /**
     * Creates an expense transaction and updates bank account balance
     */
    static async createExpense(
        companyId: number,
        userId: string,
        data: { description: string; amount: number; date: string; category_public_id: string; bank_account_public_id: string; payment_method?: string | undefined; status?: string | undefined }
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

            const transactionPublicId = randomUUID();
            const txStatus = data.status || 'paid';

            await FinanceTransactionRepository.insertTransaction(conn, {
                public_id: transactionPublicId,
                company_id: companyId,
                bank_account_id: bankAccountId,
                category_id: categoryId,
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
        data: { description: string; amount: number; date: string; category_public_id: string; bank_account_public_id: string; customer_public_id?: string | undefined; payment_method?: string | undefined; status?: string | undefined }
    ): Promise<void> {
        await FinanceTransactionRepository.withTransaction(async (conn: PoolConnection) => {
            const catRows = await FinanceTransactionRepository.getCategoryByPublicId(conn, companyId, data.category_public_id, 'income');
            if (!catRows || catRows.length === 0 || !catRows[0]) throw new Error('Category not found or invalid type');
            const categoryId = catRows[0].id;

            const bankRows = await FinanceTransactionRepository.getBankAccountByPublicId(conn, companyId, data.bank_account_public_id);
            if (!bankRows || bankRows.length === 0 || !bankRows[0]) throw new Error('Bank account not found');
            const bankAccountId = bankRows[0].id;

            let customerId: number | null = null;
            if (data.customer_public_id) {
                const custRows = await FinanceTransactionRepository.getCustomerByPublicId(conn, companyId, data.customer_public_id);
                if (!custRows || custRows.length === 0 || !custRows[0]) throw new Error('Customer not found');
                customerId = custRows[0].id;
            }

            const userRows = await FinanceTransactionRepository.getUserByPublicId(conn, userId);
            if (!userRows || userRows.length === 0 || !userRows[0]) throw new Error('User not found');
            const internalUserId = userRows[0].id;

            const transactionPublicId = randomUUID();
            const txStatus = data.status || 'paid';

            await FinanceTransactionRepository.insertTransaction(conn, {
                public_id: transactionPublicId,
                company_id: companyId,
                bank_account_id: bankAccountId,
                category_id: categoryId,
                customer_id: customerId,
                user_id: internalUserId,
                description: data.description,
                amount: data.amount,
                type: 'income',
                payment_method: data.payment_method,
                date: data.date,
                status: txStatus
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
        data: { description: string; amount: number; date: string; category_public_id: string; bank_account_public_id: string; payment_method?: string | undefined; status?: string | undefined }
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
        data: { description: string; amount: number; date: string; received_at?: string | undefined; category_public_id: string; bank_account_public_id: string; customer_public_id?: string | undefined; payment_method?: string | undefined; status?: string | undefined }
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

            // 3. Reverse old effect
            if (oldTx.status === 'paid') {
                // Reverse income: subtract balance back
                await FinanceTransactionRepository.updateBankAccountBalance(conn, companyId, oldTx.bank_account_id, oldTx.amount, true);
            }

            const newStatus = data.status || 'paid';

            // 4. Update transaction
            await FinanceTransactionRepository.updateTransaction(conn, companyId, oldTx.id, {
                bank_account_id: newBankAccountId,
                category_id: newCategoryId,
                customer_id: data.customer_public_id ? await FinanceTransactionRepository.getCustomerByPublicId(conn, companyId, data.customer_public_id).then(r => r[0]?.id) : null,
                description: data.description,
                amount: data.amount,
                payment_method: data.payment_method,
                date: data.date,
                received_at: data.received_at,
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
        const description = escapeHtml(tx.description || '-');
        const bankName = escapeHtml(tx.bank_name || 'Nao informado');
        const statusLabel = effectiveStatus === 'progress' ? 'Andamento' : (isPending ? 'Pendente' : 'Recebido');

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

        const buildPixPayload = (key: string, amountValue: number, name: string, city: string) => {
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
        };

        let qrDataUrl = '';
        let pixPayload = '';
        if (shouldShowPixSection) {
            pixPayload = buildPixPayload(pixKey, amount, tx.comp_name || 'Empresa', tx.comp_city || 'Cidade');
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
                <div class="label" style="margin-top:10px;">CNPJ</div>
                <div class="value">${customerDoc}</div>
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
    static async generateBillet(_companyId: number, _transactionPublicId: string): Promise<any> { return {}; }
    static async getBoletoPdfBase64(_companyId: number, _id: string, _nosso: string): Promise<string> { return ""; }
    static async batchGenerateBillets(_c: number, _i: string[]): Promise<any> { return {}; }
    static async batchCancelBillets(_c: number, _i: string[]): Promise<any> { return {}; }
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
}
