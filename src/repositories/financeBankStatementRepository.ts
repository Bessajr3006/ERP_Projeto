import pool from '../config/db';
import { RowDataPacket, ResultSetHeader, PoolConnection, Pool } from 'mysql2/promise';

type DBClient = Pool | PoolConnection;

export class FinanceBankStatementRepository {
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

    static async getBankAccountByPublicId(client: DBClient, companyId: number, publicId: string): Promise<RowDataPacket[]> {
        const [rows] = await client.query<RowDataPacket[]>(
            'SELECT id, name FROM bank_accounts WHERE public_id = ? AND company_id = ? LIMIT 1',
            [publicId, companyId]
        );
        return rows;
    }

    static async upsertBankStatement(client: DBClient, companyId: number, bankAccountId: number, publicId: string, transactionId: string, safeDate: string, description: string, safeAmount: number, typeStr: string, rawData: string): Promise<number> {
        const [result] = await client.query<ResultSetHeader>(
            `INSERT INTO bank_statements 
            (public_id, company_id, bank_account_id, transaction_id, date, description, amount, type, raw_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                date = VALUES(date),
                description = VALUES(description),
                amount = VALUES(amount),
                type = VALUES(type),
                raw_data = VALUES(raw_data)`,
            [publicId, companyId, bankAccountId, transactionId, safeDate, description, safeAmount, typeStr, rawData]
        );
        return result.affectedRows;
    }

    static async checkStatementExists(client: DBClient, companyId: number, bankAccountId: number, data: any): Promise<boolean> {
        const txId = data.transaction_id || data.transactionId;
        if (txId) {
            const [existing] = await client.query<RowDataPacket[]>(
                `SELECT id FROM bank_statements 
                 WHERE company_id = ? AND bank_account_id = ? AND transaction_id = ?
                 LIMIT 1`,
                [companyId, bankAccountId, String(txId)]
            );
            return existing.length > 0;
        }

        const [existing] = await client.query<RowDataPacket[]>(
            `SELECT id FROM bank_statements 
             WHERE company_id = ? AND bank_account_id = ? AND date = ? AND amount = ? AND description = ? AND type = ?
             LIMIT 1`,
            [companyId, bankAccountId, data.date, data.amount, data.description, data.type]
        );
        return existing.length > 0;
    }

    static async listBankStatements(companyId: number, bankAccountPublicId?: string, startDate?: string, endDate?: string): Promise<RowDataPacket[]> {
        const params: any[] = [companyId];
        let query = `
            SELECT 
                bs.id,
                bs.public_id,
                bs.company_id,
                bs.bank_account_id,
                bs.transaction_id,
                DATE_FORMAT(bs.date, '%Y-%m-%d') as date,
                bs.description,
                bs.amount,
                bs.type,
                bs.raw_data,
                bs.status,
                bs.reconciled_transaction_id,
                bs.created_at,
                bs.updated_at,
                acc.name as bank_name,
                tx.public_id as reconciled_transaction_public_id,
                tx.description as reconciled_transaction_description,
                tx.type as reconciled_transaction_type
            FROM bank_statements bs
            JOIN bank_accounts acc ON bs.bank_account_id = acc.id
            LEFT JOIN transactions tx ON bs.reconciled_transaction_id = tx.id
            WHERE bs.company_id = ?
        `;

        if (bankAccountPublicId) {
            query += ' AND acc.public_id = ?';
            params.push(bankAccountPublicId);
        }

        if (startDate) {
            query += ' AND bs.date >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND bs.date <= ?';
            params.push(endDate);
        }

        query += ' ORDER BY bs.date DESC, bs.id DESC';

        const [statements] = await pool.query<RowDataPacket[]>(query, params);
        return statements;
    }

    static async deleteBankStatementsByPublicIds(client: DBClient, companyId: number, publicIds: string[]): Promise<void> {
        if (publicIds.length === 0) return;
        const placeholders = publicIds.map(() => '?').join(',');
        await client.query(
            `DELETE FROM bank_statements WHERE company_id = ? AND public_id IN (${placeholders})`,
            [companyId, ...publicIds]
        );
    }

    static async getTransactionsForReconciliation(client: DBClient, companyId: number, publicIds: string[]): Promise<RowDataPacket[]> {
        if (!publicIds || publicIds.length === 0) return [];
        const placeholders = publicIds.map(() => '?').join(',');
        const [rows] = await client.query<RowDataPacket[]>(
            `SELECT id, amount, type FROM transactions WHERE company_id = ? AND public_id IN (${placeholders})`,
            [companyId, ...publicIds]
        );
        return rows;
    }

    static async getStatementsForReconciliation(client: DBClient, companyId: number, publicIds: string[]): Promise<RowDataPacket[]> {
        if (!publicIds || publicIds.length === 0) return [];
        const placeholders = publicIds.map(() => '?').join(',');
        const [rows] = await client.query<RowDataPacket[]>(
            `SELECT id, amount, type, reconciled_transaction_id FROM bank_statements WHERE company_id = ? AND public_id IN (${placeholders})`,
            [companyId, ...publicIds]
        );
        return rows;
    }

    static async updateReconcile(client: DBClient, transactionIds: number[], statementIds: number[], primaryTransactionId: number): Promise<void> {
        if (transactionIds.length > 0) {
            const placeholdersTx = transactionIds.map(() => '?').join(',');
            await client.query(
                `UPDATE transactions SET status = 'paid', updated_at = NOW() WHERE id IN (${placeholdersTx})`,
                [...transactionIds]
            );
        }

        if (statementIds.length > 0) {
            const placeholdersStmt = statementIds.map(() => '?').join(',');
            await client.query(
                `UPDATE bank_statements SET status = 'reconciled', reconciled_transaction_id = ?, updated_at = NOW() WHERE id IN (${placeholdersStmt})`,
                [primaryTransactionId, ...statementIds]
            );
        }
    }

    static async undoReconcile(
        client: DBClient,
        statementId: number,
        reconciledTransactionId: number | null,
        deleteTransaction: boolean = true,
        companyId?: number
    ): Promise<void> {
        if (reconciledTransactionId) {
            if (deleteTransaction && companyId) {
                const [txRows] = await client.query<RowDataPacket[]>(
                    `SELECT id, amount, type, status, bank_account_id FROM transactions WHERE id = ? AND company_id = ? LIMIT 1`,
                    [reconciledTransactionId, companyId]
                );

                if (txRows && txRows.length > 0 && txRows[0]) {
                    const tx = txRows[0];
                    if (tx.status === 'paid' && tx.bank_account_id) {
                        if (tx.type === 'expense') {
                            await client.query(
                                `UPDATE bank_accounts SET current_balance = current_balance + ?, updated_at = NOW() WHERE id = ? AND company_id = ?`,
                                [tx.amount, tx.bank_account_id, companyId]
                            );
                        } else if (tx.type === 'income') {
                            await client.query(
                                `UPDATE bank_accounts SET current_balance = current_balance - ?, updated_at = NOW() WHERE id = ? AND company_id = ?`,
                                [tx.amount, tx.bank_account_id, companyId]
                            );
                        }
                    }

                    await client.query(
                        `DELETE FROM transactions WHERE id = ? AND company_id = ?`,
                        [reconciledTransactionId, companyId]
                    );
                }
            } else {
                await client.query(
                    `UPDATE transactions SET status = 'pending', updated_at = NOW() WHERE id = ?`,
                    [reconciledTransactionId]
                );
            }
        }

        await client.query(
            `UPDATE bank_statements SET status = 'pending', reconciled_transaction_id = NULL, updated_at = NOW() WHERE id = ?`,
            [statementId]
        );
    }
}