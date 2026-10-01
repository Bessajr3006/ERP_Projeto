import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration180AddDefaultBankAndReceivableToCompanies() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_180_add_default_bank_and_receivable_to_companies');

        // Check columns in companies table
        const [bankCols] = await pool.query<any[]>(
            `SHOW COLUMNS FROM companies LIKE 'default_bank_account_id'`
        );
        const [recCols] = await pool.query<any[]>(
            `SHOW COLUMNS FROM companies LIKE 'default_receivable_type_id'`
        );

        if (bankCols.length === 0) {
            await pool.query(
                `ALTER TABLE companies ADD COLUMN default_bank_account_id INT NULL,
                 ADD CONSTRAINT fk_companies_default_bank FOREIGN KEY (default_bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL`
            );
            logger.info('Column default_bank_account_id added to companies table.');
        } else {
            logger.info('Column default_bank_account_id already exists in companies table.');
        }

        if (recCols.length === 0) {
            await pool.query(
                `ALTER TABLE companies ADD COLUMN default_receivable_type_id INT NULL,
                 ADD CONSTRAINT fk_companies_default_receivable_type FOREIGN KEY (default_receivable_type_id) REFERENCES receivable_types(id) ON DELETE SET NULL`
            );
            logger.info('Column default_receivable_type_id added to companies table.');
        } else {
            logger.info('Column default_receivable_type_id already exists in companies table.');
        }

        logger.info('Migration run_migration_180_add_default_bank_and_receivable_to_companies finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_180_add_default_bank_and_receivable_to_companies');
    } finally {
        conn?.release();
    }
}
