import pool from '../config/db';
import { RowDataPacket, ResultSetHeader, PoolConnection, Pool } from 'mysql2/promise';

type DBClient = Pool | PoolConnection;

export class FinanceCardStatementRepository {
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

    static async upsertCardStatement(client: DBClient, companyId: number, publicId: string, transactionId: string, safeDate: string, description: string, safeAmount: number, typeStr: string, rawData: string): Promise<number> {
        const [result] = await client.query<ResultSetHeader>(
            `INSERT INTO card_statements 
            (public_id, company_id, transaction_id, date, description, amount, type, raw_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                date = VALUES(date),
                description = VALUES(description),
                amount = VALUES(amount),
                type = VALUES(type),
                raw_data = VALUES(raw_data)`,
            [publicId, companyId, transactionId, safeDate, description, safeAmount, typeStr, rawData]
        );
        return result.affectedRows;
    }

    static async checkStatementExists(client: DBClient, companyId: number, data: any): Promise<boolean> {
        const [existing] = await client.query<RowDataPacket[]>(
            `SELECT id FROM card_statements 
             WHERE company_id = ? AND date = ? AND amount = ? AND description = ? AND type = ?
             LIMIT 1`,
            [companyId, data.date, data.amount, data.description, data.type]
        );
        return existing.length > 0;
    }

    static async listCardStatements(companyId: number): Promise<RowDataPacket[]> {
        const [statements] = await pool.query<RowDataPacket[]>(
            `SELECT * FROM card_statements
             WHERE company_id = ?
             ORDER BY date DESC, id DESC`,
            [companyId]
        );
        return statements;
    }

    static async deleteCardStatementsByPublicIds(client: DBClient, companyId: number, publicIds: string[]): Promise<void> {
        if (publicIds.length === 0) return;
        const placeholders = publicIds.map(() => '?').join(',');
        await client.query(
            `DELETE FROM card_statements WHERE company_id = ? AND public_id IN (${placeholders})`,
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
            `SELECT id, amount, type, reconciled_transaction_id FROM card_statements WHERE company_id = ? AND public_id IN (${placeholders})`,
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
                `UPDATE card_statements SET status = 'reconciled', reconciled_transaction_id = ?, updated_at = NOW() WHERE id IN (${placeholdersStmt})`,
                [primaryTransactionId, ...statementIds]
            );
        }
    }

    static async undoReconcile(client: DBClient, statementId: number, reconciledTransactionId: number | null): Promise<void> {
        if (reconciledTransactionId) {
            await client.query(
                `UPDATE transactions SET status = 'pending', updated_at = NOW() WHERE id = ?`,
                [reconciledTransactionId]
            );
        }

        await client.query(
            `UPDATE card_statements SET status = 'pending', reconciled_transaction_id = NULL, updated_at = NOW() WHERE id = ?`,
            [statementId]
        );
    }

    static async listCardTransactions(companyId: number): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT 
                t.public_id,
                t.date,
                t.description,
                t.amount,
                t.type,
                t.payment_method,
                t.status,
                c.name as category_name,
                ba.name as bank_account_name
             FROM transactions t
             LEFT JOIN categories c ON t.category_id = c.id
             LEFT JOIN bank_accounts ba ON t.bank_account_id = ba.id
             WHERE t.company_id = ? AND t.payment_method IN ('credit', 'debit')
             ORDER BY t.date DESC, t.id DESC`,
            [companyId]
        );
        return rows;
    }
}
