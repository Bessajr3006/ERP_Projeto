import { RowDataPacket, PoolConnection, Pool } from 'mysql2/promise';

type DBClient = Pool | PoolConnection;

export class FinanceDocumentRepository {
    /**
     * Get a transaction joined with its company and customer info
     * Useful for Receipts and Billets.
     */
    static async getTransactionForDocument(client: DBClient, companyId: number, transactionPublicId: string): Promise<RowDataPacket | null> {
        const [rows] = await client.query<RowDataPacket[]>(
            `SELECT t.*, 
             COALESCE(c.name, s.name, con.name, ru.full_name) as cust_name,
             c.only_pix as cust_only_pix,
             (CASE 
                WHEN COALESCE(c.cnpj_cpf, s.cnpj_cpf, con.cnpj_cpf, ru.cpf_cnpj) IS NULL THEN NULL 
                WHEN LENGTH(REPLACE(REPLACE(REPLACE(COALESCE(c.cnpj_cpf, s.cnpj_cpf, con.cnpj_cpf, ru.cpf_cnpj), '.', ''), '-', ''), '/', '')) <= 11 
                    THEN LPAD(REPLACE(REPLACE(REPLACE(COALESCE(c.cnpj_cpf, s.cnpj_cpf, con.cnpj_cpf, ru.cpf_cnpj), '.', ''), '-', ''), '/', ''), 11, '0') 
                ELSE LPAD(REPLACE(REPLACE(REPLACE(COALESCE(c.cnpj_cpf, s.cnpj_cpf, con.cnpj_cpf, ru.cpf_cnpj), '.', ''), '-', ''), '/', ''), 14, '0') 
             END) as cust_doc,
             COALESCE(c.phone, s.phone, con.phone, ru.phone) as cust_phone,
             COALESCE(c.street, s.street, con.street, ru.street) as cust_street,
             COALESCE(c.number, s.number, con.number, ru.number) as cust_num,
             COALESCE(c.neighborhood, s.neighborhood, con.neighborhood, ru.neighborhood) as cust_neigh,
             COALESCE(c.city, s.city, con.city, ru.city) as cust_city,
             COALESCE(c.state, s.state, con.state, ru.state) as cust_uf,
             COALESCE(c.zipcode, s.zipcode, con.zipcode, ru.zipcode) as cust_zip,
             comp.trade_name as comp_name, comp.cnpj as comp_doc, comp.phone as comp_phone, comp.logo_url as comp_logo_url, comp.logo_base64 as comp_logo_base64, comp.street as comp_address, comp.city as comp_city, comp.state as comp_state,
             b.name as bank_name, b.pix_key as pix_key,
             so.status as sale_status
             FROM transactions t 
             JOIN companies comp ON t.company_id = comp.id
             LEFT JOIN bank_accounts b ON t.bank_account_id = b.id
             LEFT JOIN sales_orders so ON t.sale_id = so.id
             LEFT JOIN customers c ON t.customer_id = c.id
             LEFT JOIN suppliers s ON t.supplier_id = s.id
             LEFT JOIN contacts con ON t.contact_id = con.id
             LEFT JOIN users ru ON t.related_user_id = ru.id
             WHERE t.public_id = ? AND t.company_id = ? LIMIT 1`,
            [transactionPublicId, companyId]
        );
        return rows[0] || null;
    }

    /**
     * Check multiple transactions existence
     */
    static async getTransactionsByPublicIds(client: DBClient, companyId: number, publicIds: string[]): Promise<RowDataPacket[]> {
        if (!publicIds || publicIds.length === 0) return [];
        const placeholders = publicIds.map(() => '?').join(',');
        const [rows] = await client.query<RowDataPacket[]>(
            `SELECT * FROM transactions WHERE company_id = ? AND public_id IN (${placeholders})`,
            [companyId, ...publicIds]
        );
        return rows;
    }

    /**
     * Get a transaction joined with bank account (for API credentials) and customer (for billing address)
     * Used for Boleto Generation
     */
    static async getTransactionForBillet(client: DBClient, companyId: number, transactionPublicId: string): Promise<RowDataPacket | null> {
        const [rows] = await client.query<RowDataPacket[]>(
            `SELECT t.*, b.api_certificate, b.api_key, b.api_client_id, b.api_client_secret, b.account_number, b.public_id as bank_acc_public_id, b.institution,
              c.name as cust_name, 
              c.only_pix as cust_only_pix,
              c.only_solidcon_baixa as cust_only_solidcon_baixa,
              c.exempt_interest_fine as cust_exempt_interest_fine,
              (CASE 
                 WHEN c.cnpj_cpf IS NULL THEN NULL 
                 WHEN LENGTH(REPLACE(REPLACE(REPLACE(c.cnpj_cpf, '.', ''), '-', ''), '/', '')) <= 11 
                     THEN LPAD(REPLACE(REPLACE(REPLACE(c.cnpj_cpf, '.', ''), '-', ''), '/', ''), 11, '0') 
                 ELSE LPAD(REPLACE(REPLACE(REPLACE(c.cnpj_cpf, '.', ''), '-', ''), '/', ''), 14, '0') 
              END) as cust_doc,
             c.street as cust_street, c.number as cust_num, c.neighborhood as cust_neigh,
             c.city as cust_city, c.state as cust_uf, c.zipcode as cust_zip
             FROM transactions t 
             LEFT JOIN bank_accounts b ON t.bank_account_id = b.id 
             LEFT JOIN customers c ON t.customer_id = c.id
             WHERE t.public_id = ? AND (t.company_id = ? OR t.company_id IN (SELECT c2.id FROM companies c1 JOIN companies c2 ON c1.company_group_id = c2.company_group_id WHERE c1.id = ? AND c1.company_group_id IS NOT NULL)) LIMIT 1`,
            [transactionPublicId, companyId, companyId]
        );
        return rows[0] || null;
    }

    /**
     * Update billet details on a transaction after calling the bank API
     */
    static async updateBilletCode(client: DBClient, transactionId: number, barcode: string | null, pixCode: string | null, billetUrl: string | null): Promise<void> {
        await client.query(
            'UPDATE transactions SET barcode = ?, pix_code = ?, billet_url = ?, billet_batch_generated = 0 WHERE id = ?',
            [barcode, pixCode, billetUrl, transactionId]
        );
    }

    static async updateBilletBatchGenerated(client: DBClient, transactionId: number, generated: boolean): Promise<void> {
        await client.query(
            'UPDATE transactions SET billet_batch_generated = ? WHERE id = ?',
            [generated ? 1 : 0, transactionId]
        );
    }

    /**
     * Batch clear billet data
     */
    static async batchCancelBillets(client: DBClient, companyId: number, publicIds: string[]): Promise<void> {
        if (!publicIds || publicIds.length === 0) return;
        const placeholders = publicIds.map(() => '?').join(',');
        await client.query(
            `UPDATE transactions SET barcode = NULL, pix_code = NULL, billet_url = NULL, billet_batch_generated = 0 
             WHERE public_id IN (${placeholders}) AND company_id = ?`,
            [...publicIds, companyId]
        );
    }
}