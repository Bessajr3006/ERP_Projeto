import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration() {
    let conn;
    try {
        conn = await pool.getConnection();

        logger.info('Running migration: run_migration_51_bank_accounts_pix_key');

        await conn.query(`
            ALTER TABLE bank_accounts
            ADD COLUMN IF NOT EXISTS pix_key VARCHAR(255) DEFAULT NULL AFTER account_number;
        `);

        logger.info('Migration run_migration_51_bank_accounts_pix_key finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_51_bank_accounts_pix_key');
        throw err;
    } finally {
        if (conn) conn.release();
    }
}
