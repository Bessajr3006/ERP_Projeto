import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration117() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_117_transaction_payment_method_varchar');

        logger.info('Modifying payment_method to VARCHAR(50) in transactions...');
        await pool.query(`
            ALTER TABLE transactions 
            MODIFY COLUMN payment_method VARCHAR(50) NULL COMMENT 'Forma de Pagamento';
        `);

        logger.info('Migration run_migration_117_transaction_payment_method_varchar finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_117_transaction_payment_method_varchar');
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration117()
        .catch((err) => {
            logger.error({ err }, 'Migration 117 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
