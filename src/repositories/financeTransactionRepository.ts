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
        const { public_id, company_id, bank_account_id, category_id, customer_id, supplier_id, contact_id, related_user_id, user_id, cost_center_id, description, amount, original_amount, fine, interest, net_amount, type, payment_method, card_brand_id, card_configuration_id, date, date_launch, status, received_at, received_channel, scheduled_at, barcode, pix_code, pix_key, pdv, cdfilial, solidcon_quitado, solidcon_key, solidcon_interest_key } = data;
        const [result] = await client.query<ResultSetHeader>(
            `INSERT INTO transactions (public_id, company_id, bank_account_id, category_id, customer_id, supplier_id, contact_id, related_user_id, user_id, cost_center_id, description, amount, original_amount, fine, interest, net_amount, type, payment_method, card_brand_id, card_configuration_id, date, date_launch, status, received_at, received_channel, scheduled_at, barcode, pix_code, pix_key, pdv, cdfilial, solidcon_quitado, solidcon_key, solidcon_interest_key) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [public_id, company_id, bank_account_id, category_id, customer_id || null, supplier_id || null, contact_id || null, related_user_id || null, user_id, cost_center_id || null, description, amount, original_amount !== undefined && original_amount !== null ? original_amount : amount, fine !== undefined && fine !== null ? fine : 0, interest !== undefined && interest !== null ? interest : 0, net_amount !== undefined && net_amount !== null ? net_amount : amount, type, payment_method || null, card_brand_id || null, card_configuration_id || null, date, date_launch || date, status, received_at || null, received_channel || null, scheduled_at || null, barcode || null, pix_code || null, pix_key || null, pdv || null, cdfilial || null, solidcon_quitado !== undefined && solidcon_quitado !== null ? (solidcon_quitado ? 1 : 0) : 0, solidcon_key || null, solidcon_interest_key || null]
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
                (SELECT COUNT(*) FROM bank_statements WHERE reconciled_transaction_id = t.id) > 0 AS is_reconciled,
                c.name as category_name,
                c.public_id as category_public_id,
                fct.name as finance_category_type_name,
                b.name as bank_account_name,
                b.public_id as bank_account_public_id,
                b.billet_fine as bank_billet_fine,
                b.billet_interest as bank_billet_interest,
                b.billet_validity as bank_billet_validity,
                b.pix_fine as bank_pix_fine,
                b.pix_interest as bank_pix_interest,
                b.pix_validity as bank_pix_validity,
                u.full_name as user_name,
                u.public_id as user_public_id,
                COALESCE(cu.name, sale_customer.name) as customer_name,
                COALESCE(cu.public_id, sale_customer.public_id) as customer_public_id,
                COALESCE(cu.phone, sale_customer.phone) as customer_phone,
                COALESCE(cu.only_solidcon_baixa, sale_customer.only_solidcon_baixa, 0) as customer_only_solidcon_baixa,
                COALESCE(cu.exempt_interest_fine, sale_customer.exempt_interest_fine, 0) as customer_exempt_interest_fine,
                COALESCE(cu.hide_in_revenues_grid, sale_customer.hide_in_revenues_grid, 0) as customer_hide_in_revenues_grid,
                COALESCE(cu.only_pix, sale_customer.only_pix, 0) as customer_only_pix,
                COALESCE(cg.name, sale_cg.name) as customer_group_name,
                COALESCE(cg.public_id, sale_cg.public_id) as customer_group_public_id,
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
                (CASE 
                    WHEN COALESCE(cu.cnpj_cpf, sale_customer.cnpj_cpf, s.cnpj_cpf, con.cnpj_cpf, ru.cpf_cnpj) IS NULL THEN NULL 
                    WHEN LENGTH(REPLACE(REPLACE(REPLACE(COALESCE(cu.cnpj_cpf, sale_customer.cnpj_cpf, s.cnpj_cpf, con.cnpj_cpf, ru.cpf_cnpj), '.', ''), '-', ''), '/', '')) <= 11 
                        THEN LPAD(REPLACE(REPLACE(REPLACE(COALESCE(cu.cnpj_cpf, sale_customer.cnpj_cpf, s.cnpj_cpf, con.cnpj_cpf, ru.cpf_cnpj), '.', ''), '-', ''), '/', ''), 11, '0') 
                    ELSE LPAD(REPLACE(REPLACE(REPLACE(COALESCE(cu.cnpj_cpf, sale_customer.cnpj_cpf, s.cnpj_cpf, con.cnpj_cpf, ru.cpf_cnpj), '.', ''), '-', ''), '/', ''), 14, '0') 
                END) as entity_cnpj_cpf,
                COALESCE(cu.phone, sale_customer.phone, s.phone, con.phone, ru.phone) as entity_phone,
                cb.name as card_brand_name,
                cb.public_id as card_brand_public_id,
                cc.public_id as card_configuration_public_id,
                COALESCE(cc.tax_rate, cc_fallback.tax_rate, 0) as card_tax_rate,
                COALESCE(rt.name, rt_fallback.name) as receivable_type_name,
                CASE 
                    WHEN cu.id IS NOT NULL OR sale_customer.id IS NOT NULL THEN 'customer'
                    WHEN s.id IS NOT NULL THEN 'supplier'
                    WHEN con.id IS NOT NULL THEN 'contact'
                    WHEN ru.id IS NOT NULL THEN ru.role
                    ELSE NULL
                END as entity_type,
                t.barcode, t.pix_code, t.pix_key, t.billet_url, t.billet_batch_generated, t.whatsapp_sent,
                cc_cnt.public_id as cost_center_public_id,
                cc_cnt.name as cost_center_name
             FROM transactions t
              LEFT JOIN categories c ON t.category_id = c.id
              LEFT JOIN finance_category_types fct ON c.finance_category_type_id = fct.id
              LEFT JOIN bank_accounts b ON t.bank_account_id = b.id
             LEFT JOIN users u ON t.user_id = u.id
              LEFT JOIN customers cu ON t.customer_id = cu.id
              LEFT JOIN customer_groups cg ON cu.customer_group_id = cg.id
              LEFT JOIN sales_orders so ON t.sale_id = so.id
              LEFT JOIN customers sale_customer ON so.customer_id = sale_customer.id
              LEFT JOIN customer_groups sale_cg ON sale_customer.customer_group_id = sale_cg.id
             LEFT JOIN suppliers s ON t.supplier_id = s.id
             LEFT JOIN contacts con ON t.contact_id = con.id
             LEFT JOIN users ru ON t.related_user_id = ru.id
              LEFT JOIN card_brands cb ON t.card_brand_id = cb.id
              LEFT JOIN card_configurations cc ON t.card_configuration_id = cc.id
              LEFT JOIN receivable_types rt ON cc.receivable_type_id = rt.id
              LEFT JOIN card_configurations cc_fallback ON t.card_configuration_id IS NULL 
                    AND t.card_brand_id = cc_fallback.card_brand_id 
                    AND t.company_id = cc_fallback.company_id
                    AND cc_fallback.payment_type = CASE WHEN t.payment_method = 'credit' THEN 'credito' WHEN t.payment_method = 'debit' THEN 'debito' ELSE t.payment_method END
              LEFT JOIN receivable_types rt_fallback ON cc_fallback.receivable_type_id = rt_fallback.id
              LEFT JOIN cost_centers cc_cnt ON t.cost_center_id = cc_cnt.id
            WHERE t.company_id = ? AND t.type = ?
              AND (t.description NOT LIKE '%Juros de conv%' AND t.description NOT LIKE '%[ORIGIN_TX:%')
              AND (t.type != 'income' OR COALESCE(cu.hide_in_revenues_grid, sale_customer.hide_in_revenues_grid, 0) = 0)
            ORDER BY t.date DESC, t.created_at DESC`,
            [companyId, type]
        );
        return rows;
    }

    static async getTransactionByPublicId(client: DBClient, companyId: number, publicId: string, type?: string): Promise<RowDataPacket[]> {
        if (type) {
             const [rows] = await client.query<RowDataPacket[]>(
                'SELECT t.*, cc.public_id as card_configuration_public_id, cc_cnt.public_id as cost_center_public_id, cc_cnt.name as cost_center_name FROM transactions t LEFT JOIN card_configurations cc ON t.card_configuration_id = cc.id LEFT JOIN cost_centers cc_cnt ON t.cost_center_id = cc_cnt.id WHERE t.public_id = ? AND t.company_id = ? AND t.type = ? LIMIT 1',
                [publicId, companyId, type]
            );
            return rows;
        }
        const [rows] = await client.query<RowDataPacket[]>(
            'SELECT t.*, cc.public_id as card_configuration_public_id, cc_cnt.public_id as cost_center_public_id, cc_cnt.name as cost_center_name FROM transactions t LEFT JOIN card_configurations cc ON t.card_configuration_id = cc.id LEFT JOIN cost_centers cc_cnt ON t.cost_center_id = cc_cnt.id WHERE t.public_id = ? AND t.company_id = ? LIMIT 1',
            [publicId, companyId]
        );
        return rows;
    }

    static async updateTransaction(client: DBClient, companyId: number, id: number, data: any): Promise<void> {
        const { bank_account_id, category_id, customer_id, supplier_id, contact_id, related_user_id, cost_center_id, description, amount, original_amount, fine, interest, net_amount, payment_method, card_brand_id, card_configuration_id, date, date_launch, status, received_at, received_channel, scheduled_at, barcode, pix_code, pix_key, pdv, cdfilial, solidcon_quitado, solidcon_key, solidcon_interest_key } = data;
        let query = `UPDATE transactions SET bank_account_id = ?, category_id = ?, customer_id = ?, supplier_id = ?, contact_id = ?, related_user_id = ?, cost_center_id = ?, description = ?, amount = ?, original_amount = ?, fine = ?, interest = ?, net_amount = ?, payment_method = ?, card_brand_id = ?, card_configuration_id = ?, date = ?, date_launch = ?, status = ?, barcode = ?, pix_code = ?, pix_key = ?, pdv = ?, cdfilial = ?, solidcon_quitado = ?, solidcon_key = ?, solidcon_interest_key = ?, updated_at = NOW() WHERE id = ? AND company_id = ?`;
        let params = [bank_account_id, category_id, customer_id || null, supplier_id || null, contact_id || null, related_user_id || null, cost_center_id || null, description, amount, original_amount !== undefined && original_amount !== null ? original_amount : amount, fine !== undefined && fine !== null ? fine : 0, interest !== undefined && interest !== null ? interest : 0, net_amount !== undefined && net_amount !== null ? net_amount : amount, payment_method || null, card_brand_id || null, card_configuration_id || null, date, date_launch || date, status, barcode || null, pix_code || null, pix_key || null, pdv || null, cdfilial || null, solidcon_quitado !== undefined && solidcon_quitado !== null ? (solidcon_quitado ? 1 : 0) : 0, solidcon_key || null, solidcon_interest_key !== undefined ? solidcon_interest_key : null, id, companyId];

        if (received_at !== undefined) {
            query = query.replace('updated_at = NOW()', 'received_at = ?, updated_at = NOW()');
            params.splice(params.length - 2, 0, received_at || null);
        }
        if (received_channel !== undefined) {
            query = query.replace('updated_at = NOW()', 'received_channel = ?, updated_at = NOW()');
            params.splice(params.length - 2, 0, received_channel || null);
        }
        if (scheduled_at !== undefined) {
            query = query.replace('updated_at = NOW()', 'scheduled_at = ?, updated_at = NOW()');
            params.splice(params.length - 2, 0, scheduled_at || null);
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

    static async getCostCenterByPublicId(client: DBClient, companyId: number, publicId: string): Promise<RowDataPacket[]> {
        const [rows] = await client.query<RowDataPacket[]>(
            'SELECT id FROM cost_centers WHERE public_id = ? AND company_id = ? LIMIT 1',
            [publicId, companyId]
        );
        return rows;
    }
}
