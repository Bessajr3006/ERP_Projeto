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

export async function runMigration184TransactionCardConfiguration(): Promise<void> {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_184_transaction_card_configuration');

        if (!(await columnExists('transactions', 'card_configuration_id'))) {
            logger.info('Adding card_configuration_id column to transactions...');
            await pool.query(`
                ALTER TABLE transactions 
                ADD COLUMN card_configuration_id INT NULL AFTER card_brand_id,
                ADD CONSTRAINT fk_transactions_card_configuration FOREIGN KEY (card_configuration_id) REFERENCES card_configurations(id) ON DELETE SET NULL;
            `);
        }

        logger.info('Migration run_migration_184_transaction_card_configuration finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_184_transaction_card_configuration');
    } finally {
        conn?.release();
    }
}
