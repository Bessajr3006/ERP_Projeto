import pool from '../config/db';
import { RowDataPacket, ResultSetHeader, Pool, PoolConnection } from 'mysql2/promise';

type DBClient = Pool | PoolConnection;

export class FinanceTransactionRepository {
    /**
     * Executes a callback within a database transaction.
     */
    static async withTransaction<T>(callback: (conn: PoolConnection) => Promise<T>): Promise<T> {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const result = await callback(conn);
            await conn.commit();
            return result;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    static async getCategoryByPublicId(client: DBClient, companyId: number, publicId: string, type?: string): Promise<RowDataPacket[]> {
        if (type) {
            const [rows] = await client.query<RowDataPacket[]>(
                'SELECT id FROM categories WHERE public_id = ? AND company_id = ? AND type = ? LIMIT 1',
                [publicId, companyId, type]
            );
            return rows;
        }
        const [rows] = await client.query<RowDataPacket[]>(
            'SELECT id FROM categories WHERE public_id = ? AND company_id = ? LIMIT 1',
            [publicId, companyId]
        );
        return rows;
    }

    static async getBankAccountByPublicId(client: DBClient, companyId: number, publicId: string): Promise<RowDataPacket[]> {
        const [rows] = await client.query<RowDataPacket[]>(
            'SELECT id FROM bank_accounts WHERE public_id = ? AND company_id = ? LIMIT 1',
            [publicId, companyId]
        );
        return rows;
    }

    static async getUserByPublicId(client: DBClient, publicId: string): Promise<RowDataPacket[]> {
        const [rows] = await client.query<RowDataPacket[]>(
            'SELECT id FROM users WHERE public_id = ? LIMIT 1',
            [publicId]
        );
        return rows;
    }

    static async getCustomerByPublicId(client: DBClient, companyId: number, publicId: string): Promise<RowDataPacket[]> {
        const [rows] = await client.query<RowDataPacket[]>(
            'SELECT id FROM customers WHERE public_id = ? AND company_id = ? LIMIT 1',
            [publicId, companyId]
        );
        return rows;
    }

    static async getSupplierByPublicId(client: DBClient, companyId: number, publicId: string): Promise<RowDataPacket[]> {
        const [rows] = await client.query<RowDataPacket[]>(
            'SELECT id FROM suppliers WHERE public_id = ? AND company_id = ? LIMIT 1',
            [publicId, companyId]
        );
        return rows;
    }

    static async getContactByPublicId(client: DBClient, companyId: number, publicId: string): Promise<RowDataPacket[]> {
        const [rows] = await client.query<RowDataPacket[]>(
            'SELECT id FROM contacts WHERE public_id = ? AND company_id = ? LIMIT 1',
            [publicId, companyId]
        );
        return rows;
    }

    static async getUserByPublicIdAndCompany(client: DBClient, companyId: number, publicId: string): Promise<RowDataPacket[]> {
        const [rows] = await client.query<RowDataPacket[]>(
            'SELECT id, role FROM users WHERE public_id = ? AND company_id = ? LIMIT 1',
            [publicId, companyId]
        );
        return rows;
    }

    static async insertTransaction(client: DBClient, data: any): Promise<number> {
        const { public_id, company_id, bank_account_id, category_id, customer_id, supplier_id, contact_id, related_user_id, user_id, description, amount, type, payment_method, date, status, received_at } = data;
        const [result] = await client.query<ResultSetHeader>(
            `INSERT INTO transactions (public_id, company_id, bank_account_id, category_id, customer_id, supplier_id, contact_id, related_user_id, user_id, description, amount, type, payment_method, date, status, received_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [public_id, company_id, bank_account_id, category_id, customer_id || null, supplier_id || null, contact_id || null, related_user_id || null, user_id, description, amount, type, payment_method || null, date, status, received_at || null]
        );
        return result.insertId;
    }

    static async updateBankAccountBalance(client: DBClient, companyId: number, bankAccountId: number, amount: number, isExpense: boolean): Promise<void> {
        const operation = isExpense ? '-' : '+';
        const [result] = await client.query<ResultSetHeader>(
            `UPDATE bank_accounts SET current_balance = current_balance ${operation} ?, updated_at = NOW() WHERE id = ? AND company_id = ?`,
            [amount, bankAccountId, companyId]
        );
        if (result.affectedRows !== 1) throw new Error('Failed to update bank account balance');
    }

    static async listTransactions(companyId: number, type: 'income' | 'expense'): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT 
                t.*,
                c.name as category_name,
                c.public_id as category_public_id,
                b.name as bank_account_name,
                b.public_id as bank_account_public_id,
                u.full_name as user_name,
                u.public_id as user_public_id,
                COALESCE(cu.name, sale_customer.name) as customer_name,
                COALESCE(cu.public_id, sale_customer.public_id) as customer_public_id,
                COALESCE(cu.phone, sale_customer.phone) as customer_phone,
                so.status as sale_status,
                s.name as supplier_name,
                s.public_id as supplier_public_id,
                con.name as contact_name,
                con.public_id as contact_public_id,
                ru.full_name as related_user_name,
                ru.public_id as related_user_public_id,
                ru.role as related_user_role,
                COALESCE(cu.name, sale_customer.name, s.name, con.name, ru.full_name) as entity_name,
                COALESCE(cu.public_id, sale_customer.public_id, s.public_id, con.public_id, ru.public_id) as entity_public_id,
                CASE 
                    WHEN cu.id IS NOT NULL OR sale_customer.id IS NOT NULL THEN 'customer'
                    WHEN s.id IS NOT NULL THEN 'supplier'
                    WHEN con.id IS NOT NULL THEN 'contact'
                    WHEN ru.id IS NOT NULL THEN ru.role
                    ELSE NULL
                END as entity_type,
                t.barcode, t.pix_code, t.billet_url
             FROM transactions t
             LEFT JOIN categories c ON t.category_id = c.id
             LEFT JOIN bank_accounts b ON t.bank_account_id = b.id
             LEFT JOIN users u ON t.user_id = u.id
             LEFT JOIN customers cu ON t.customer_id = cu.id
             LEFT JOIN sales_orders so ON t.sale_id = so.id
             LEFT JOIN customers sale_customer ON so.customer_id = sale_customer.id
             LEFT JOIN suppliers s ON t.supplier_id = s.id
             LEFT JOIN contacts con ON t.contact_id = con.id
             LEFT JOIN users ru ON t.related_user_id = ru.id
            WHERE t.company_id = ? AND t.type = ?
            ORDER BY t.date DESC, t.created_at DESC`,
            [companyId, type]
        );
        return rows;
    }

    static async getTransactionByPublicId(client: DBClient, companyId: number, publicId: string, type?: string): Promise<RowDataPacket[]> {
        if (type) {
             const [rows] = await client.query<RowDataPacket[]>(
                'SELECT * FROM transactions WHERE public_id = ? AND company_id = ? AND type = ? LIMIT 1',
                [publicId, companyId, type]
            );
            return rows;
        }
        const [rows] = await client.query<RowDataPacket[]>(
            'SELECT * FROM transactions WHERE public_id = ? AND company_id = ? LIMIT 1',
            [publicId, companyId]
        );
        return rows;
    }

    static async updateTransaction(client: DBClient, companyId: number, id: number, data: any): Promise<void> {
        const { bank_account_id, category_id, customer_id, supplier_id, contact_id, related_user_id, description, amount, payment_method, date, status, received_at } = data;
        let query = `UPDATE transactions SET bank_account_id = ?, category_id = ?, customer_id = ?, supplier_id = ?, contact_id = ?, related_user_id = ?, description = ?, amount = ?, payment_method = ?, date = ?, status = ?, updated_at = NOW() WHERE id = ? AND company_id = ?`;
        let params = [bank_account_id, category_id, customer_id || null, supplier_id || null, contact_id || null, related_user_id || null, description, amount, payment_method || null, date, status, id, companyId];

        if (received_at !== undefined) {
            query = query.replace('updated_at = NOW()', 'received_at = ?, updated_at = NOW()');
            params.splice(params.length - 2, 0, received_at || null);
        }

        const [result] = await client.query<ResultSetHeader>(query, params);
        if (result.affectedRows !== 1) throw new Error('Failed to update transaction');
    }

    static async deleteTransaction(client: DBClient, companyId: number, id: number): Promise<void> {
        const [result] = await client.query<ResultSetHeader>(
            `DELETE FROM transactions WHERE id = ? AND company_id = ?`,
            [id, companyId]
        );
        if (result.affectedRows !== 1) throw new Error('Failed to delete transaction');
    }
    static async listRecentPaidRevenues(companyId: number, minutesAgo: number): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT 
                t.public_id, t.description, t.amount, cu.name as customer_name
             FROM transactions t
             LEFT JOIN customers cu ON t.customer_id = cu.id
             WHERE t.company_id = ? 
               AND t.type = 'income' 
               AND t.status = 'paid'
               AND t.updated_at >= NOW() - INTERVAL ? MINUTE
             ORDER BY t.updated_at DESC`,
            [companyId, minutesAgo]
        );
        return rows;
    }
}
