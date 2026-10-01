import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration138() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_138_transaction_billet_batch_generated');

        await conn.query(`
            ALTER TABLE transactions
                ADD COLUMN IF NOT EXISTS billet_batch_generated TINYINT(1) NOT NULL DEFAULT 0;
        `);

        logger.info('Migration run_migration_138_transaction_billet_batch_generated finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_138_transaction_billet_batch_generated');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration138()
        .catch((err) => {
            logger.error({ err }, 'Migration 138 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
