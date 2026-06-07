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
             c.name as cust_name, c.cnpj_cpf as cust_doc,
             comp.trade_name as comp_name, comp.cnpj as comp_doc, comp.logo_url as comp_logo_url, comp.logo_base64 as comp_logo_base64, comp.street as comp_address, comp.city as comp_city, comp.state as comp_state,
             b.name as bank_name, b.pix_key as pix_key,
             so.status as sale_status
             FROM transactions t 
             JOIN companies comp ON t.company_id = comp.id
             LEFT JOIN customers c ON t.customer_id = c.id
             LEFT JOIN bank_accounts b ON t.bank_account_id = b.id
             LEFT JOIN sales_orders so ON t.sale_id = so.id
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
            `SELECT t.*, b.api_certificate, b.api_key, b.api_client_id, b.api_client_secret, b.account_number,
             c.name as cust_name, c.cnpj_cpf as cust_doc,
             c.street as cust_street, c.number as cust_num, c.neighborhood as cust_neigh,
             c.city as cust_city, c.state as cust_uf, c.zipcode as cust_zip
             FROM transactions t 
             JOIN bank_accounts b ON t.bank_account_id = b.id 
             LEFT JOIN customers c ON t.customer_id = c.id
             WHERE t.public_id = ? AND t.company_id = ? LIMIT 1`,
            [transactionPublicId, companyId]
        );
        return rows[0] || null;
    }

    /**
     * Update billet details on a transaction after calling the bank API
     */
    static async updateBilletCode(client: DBClient, transactionId: number, barcode: string | null, pixCode: string | null, billetUrl: string | null): Promise<void> {
        await client.query(
            'UPDATE transactions SET barcode = ?, pix_code = ?, billet_url = ? WHERE id = ?',
            [barcode, pixCode, billetUrl, transactionId]
        );
    }

    /**
     * Batch clear billet data
     */
    static async batchCancelBillets(client: DBClient, companyId: number, publicIds: string[]): Promise<void> {
        if (!publicIds || publicIds.length === 0) return;
        const placeholders = publicIds.map(() => '?').join(',');
        await client.query(
            `UPDATE transactions SET barcode = NULL, pix_code = NULL, billet_url = NULL 
             WHERE public_id IN (${placeholders}) AND company_id = ?`,
            [...publicIds, companyId]
        );
    }
}