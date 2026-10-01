import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration189BankAccountsBilletSettings() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_189_bank_accounts_billet_settings');

        const [columnsFine] = await pool.query<any[]>(
            `SHOW COLUMNS FROM bank_accounts LIKE 'billet_fine'`
        );
        if (columnsFine.length === 0) {
            await pool.query(`
                ALTER TABLE bank_accounts 
                ADD COLUMN billet_fine DECIMAL(5, 2) NULL DEFAULT NULL AFTER webhook_event_boleto
            `);
            logger.info('Column billet_fine added to bank_accounts.');
        }

        const [columnsInterest] = await pool.query<any[]>(
            `SHOW COLUMNS FROM bank_accounts LIKE 'billet_interest'`
        );
        if (columnsInterest.length === 0) {
            await pool.query(`
                ALTER TABLE bank_accounts 
                ADD COLUMN billet_interest DECIMAL(5, 2) NULL DEFAULT NULL AFTER billet_fine
            `);
            logger.info('Column billet_interest added to bank_accounts.');
        }

        const [columnsValidity] = await pool.query<any[]>(
            `SHOW COLUMNS FROM bank_accounts LIKE 'billet_validity'`
        );
        if (columnsValidity.length === 0) {
            await pool.query(`
                ALTER TABLE bank_accounts 
                ADD COLUMN billet_validity INT NULL DEFAULT NULL AFTER billet_interest
            `);
            logger.info('Column billet_validity added to bank_accounts.');
        }

        logger.info('Migration run_migration_189_bank_accounts_billet_settings finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_189_bank_accounts_billet_settings');
    } finally {
        conn?.release();
    }
}
