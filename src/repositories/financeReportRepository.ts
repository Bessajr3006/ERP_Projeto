import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';

export class FinanceReportRepository {
    static async getDashboardAnalytics(companyId: number, today: string, bankAccountPublicId?: string): Promise<{
        totalBalance: number;
        totalProducts: number;
        totalCustomers: number;
        salesCount: number;
        salesAmount: number;
        totalPayables: number;
        totalReceivables: number;
        lowStockItems: RowDataPacket[];
        chartData: RowDataPacket[];
    }> {
        let bankAccountId: number | null = null;
        let totalBalance = 0;

        if (bankAccountPublicId) {
            const [selectedBankRows] = await pool.query<RowDataPacket[]>(
                'SELECT id, current_balance FROM bank_accounts WHERE company_id = ? AND public_id = ? LIMIT 1',
                [companyId, bankAccountPublicId]
            );
            const selectedBank = selectedBankRows[0];
            if (!selectedBank) {
                throw new Error('Bank account not found');
            }
            bankAccountId = Number(selectedBank.id);
            totalBalance = Number(selectedBank.current_balance) || 0;
        } else {
            const [bankRows] = await pool.query<RowDataPacket[]>(
                'SELECT SUM(current_balance) as total_balance FROM bank_accounts WHERE company_id = ?',
                [companyId]
            );
            totalBalance = Number(bankRows[0]?.total_balance) || 0;
        }

        // Products
        const [productRows] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(id) as total_products FROM products WHERE company_id = ?',
            [companyId]
        );
        const totalProducts = productRows[0]?.total_products || 0;

        // Customers
        const [customerRows] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(id) as total_customers FROM customers WHERE company_id = ?',
            [companyId]
        );
        const totalCustomers = customerRows[0]?.total_customers || 0;

        // Sales today
        const [salesRows] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(id) as sales_count, SUM(total_amount) as sales_amount FROM sales_orders WHERE company_id = ? AND date = ?',
            [companyId, today]
        );
        const salesCount = salesRows[0]?.sales_count || 0;
        const salesAmount = salesRows[0]?.sales_amount || 0;

        // Payables
        const payablesQuery = bankAccountId
            ? `SELECT SUM(amount) as payables FROM transactions
               WHERE company_id = ? AND bank_account_id = ? AND type = 'expense' AND status = 'pending' AND date <= CURDATE()`
            : `SELECT SUM(amount) as payables FROM transactions
               WHERE company_id = ? AND type = 'expense' AND status = 'pending' AND date <= CURDATE()`;
        const payablesParams = bankAccountId ? [companyId, bankAccountId] : [companyId];
        const [payablesRows] = await pool.query<RowDataPacket[]>(payablesQuery, payablesParams);
        const totalPayables = payablesRows[0]?.payables || 0;

        // Receivables
        const receivablesQuery = bankAccountId
            ? `SELECT SUM(amount) as receivables FROM transactions
               WHERE company_id = ? AND bank_account_id = ? AND type = 'income' AND status = 'pending' AND date <= CURDATE()`
            : `SELECT SUM(amount) as receivables FROM transactions
               WHERE company_id = ? AND type = 'income' AND status = 'pending' AND date <= CURDATE()`;
        const receivablesParams = bankAccountId ? [companyId, bankAccountId] : [companyId];
        const [receivablesRows] = await pool.query<RowDataPacket[]>(receivablesQuery, receivablesParams);
        const totalReceivables = receivablesRows[0]?.receivables || 0;

        // Low stock
        const [lowStockItems] = await pool.query<RowDataPacket[]>(
            'SELECT name, current_stock, (SELECT abbreviation FROM measures WHERE id = measure_id) as measure FROM products WHERE company_id = ? AND current_stock <= 5 ORDER BY current_stock ASC LIMIT 5',
            [companyId]
        );

        // Chart data
                const chartQuery = bankAccountId
                        ? `SELECT DATE_FORMAT(date, '%Y-%m') as month,
                                        type,
                                        SUM(amount) as total
                             FROM transactions
                             WHERE company_id = ?
                                 AND bank_account_id = ?
                                 AND date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                                 AND status = 'paid'
                             GROUP BY month, type
                             ORDER BY month ASC`
                        : `SELECT DATE_FORMAT(date, '%Y-%m') as month,
                                        type,
                                        SUM(amount) as total
                             FROM transactions
                             WHERE company_id = ?
                                 AND date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                                 AND status = 'paid'
                             GROUP BY month, type
                             ORDER BY month ASC`;
                const chartParams = bankAccountId ? [companyId, bankAccountId] : [companyId];
                const [chartData] = await pool.query<RowDataPacket[]>(chartQuery, chartParams);

        return {
            totalBalance,
            totalProducts,
            totalCustomers,
            salesCount,
            salesAmount,
            totalPayables,
            totalReceivables,
            lowStockItems,
            chartData
        };
    }
}