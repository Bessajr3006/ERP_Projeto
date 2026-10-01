import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration181AddAutoGenerateBilletsToCompanies() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_181_add_auto_generate_billets_to_companies');

        const [autoGenCols] = await pool.query<any[]>(
            `SHOW COLUMNS FROM companies LIKE 'auto_generate_billets'`
        );
        const [autoGenTimeCols] = await pool.query<any[]>(
            `SHOW COLUMNS FROM companies LIKE 'auto_generate_billets_time'`
        );

        if (autoGenCols.length === 0) {
            await pool.query(
                `ALTER TABLE companies ADD COLUMN auto_generate_billets TINYINT(1) NOT NULL DEFAULT 0`
            );
            logger.info('Column auto_generate_billets added to companies table.');
        } else {
            logger.info('Column auto_generate_billets already exists in companies table.');
        }

        if (autoGenTimeCols.length === 0) {
            await pool.query(
                `ALTER TABLE companies ADD COLUMN auto_generate_billets_time VARCHAR(5) NULL DEFAULT '08:00'`
            );
            logger.info('Column auto_generate_billets_time added to companies table.');
        } else {
            logger.info('Column auto_generate_billets_time already exists in companies table.');
        }

        logger.info('Migration run_migration_181_add_auto_generate_billets_to_companies finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_181_add_auto_generate_billets_to_companies');
    } finally {
        conn?.release();
    }
}
