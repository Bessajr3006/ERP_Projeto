import pool from '../config/db';
import logger from '../config/logger';

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
    const [rows] = await pool.query<any[]>(
        `SELECT COUNT(*) AS count
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?`,
         [tableName, columnName]
    );
    return Array.isArray(rows) && rows[0] && Number(rows[0].count) > 0;
}

export async function runMigration183TransactionNetAmount(): Promise<void> {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_183_transaction_net_amount');

        if (!(await columnExists('transactions', 'net_amount'))) {
            logger.info('Adding net_amount column to transactions...');
            await pool.query(`
                ALTER TABLE transactions 
                ADD COLUMN net_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER amount;
            `);
            // Initialize net_amount equal to amount for existing rows
            await pool.query(`
                UPDATE transactions SET net_amount = amount;
            `);
        }

        logger.info('Migration run_migration_183_transaction_net_amount finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_183_transaction_net_amount');
    } finally {
        conn?.release();
    }
}
