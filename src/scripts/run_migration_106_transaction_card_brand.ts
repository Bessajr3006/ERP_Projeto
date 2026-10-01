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

export default async function runMigration106TransactionCardBrand() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_106_transaction_card_brand');

        if (!(await columnExists('transactions', 'card_brand_id'))) {
            logger.info('Adding card_brand_id column to transactions...');
            await pool.query(`
                ALTER TABLE transactions 
                ADD COLUMN card_brand_id INT NULL AFTER payment_method,
                ADD CONSTRAINT fk_transactions_card_brand FOREIGN KEY (card_brand_id) REFERENCES card_brands(id) ON DELETE SET NULL;
            `);
        }

        logger.info('Migration run_migration_106_transaction_card_brand finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_106_transaction_card_brand');
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration106TransactionCardBrand()
        .catch((err) => {
            logger.error({ err }, 'Migration 106 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
