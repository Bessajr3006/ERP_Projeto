import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration224BankAccountsPixSettings() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_224_bank_accounts_pix_settings');

        const [columnsFine]: any = await conn.query(
            `SHOW COLUMNS FROM bank_accounts LIKE 'pix_fine'`
        );
        if (!Array.isArray(columnsFine) || columnsFine.length === 0) {
            await conn.query(`
                ALTER TABLE bank_accounts 
                ADD COLUMN pix_fine DECIMAL(5, 2) NULL DEFAULT NULL AFTER billet_validity
            `);
            logger.info('Column pix_fine added to bank_accounts.');
        }

        const [columnsInterest]: any = await conn.query(
            `SHOW COLUMNS FROM bank_accounts LIKE 'pix_interest'`
        );
        if (!Array.isArray(columnsInterest) || columnsInterest.length === 0) {
            await conn.query(`
                ALTER TABLE bank_accounts 
                ADD COLUMN pix_interest DECIMAL(5, 2) NULL DEFAULT NULL AFTER pix_fine
            `);
            logger.info('Column pix_interest added to bank_accounts.');
        }

        const [columnsValidity]: any = await conn.query(
            `SHOW COLUMNS FROM bank_accounts LIKE 'pix_validity'`
        );
        if (!Array.isArray(columnsValidity) || columnsValidity.length === 0) {
            await conn.query(`
                ALTER TABLE bank_accounts 
                ADD COLUMN pix_validity INT NULL DEFAULT NULL AFTER pix_interest
            `);
            logger.info('Column pix_validity added to bank_accounts.');
        }

        logger.info('Migration run_migration_224_bank_accounts_pix_settings finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_224_bank_accounts_pix_settings');
    } finally {
        conn?.release();
    }
}
