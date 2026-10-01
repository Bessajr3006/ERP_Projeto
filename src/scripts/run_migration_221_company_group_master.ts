import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration221CompanyGroupMaster() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_221_company_group_master');

        // Check if is_group_master column already exists in companies
        const [columns] = await pool.query<any[]>(
            `SHOW COLUMNS FROM companies LIKE 'is_group_master'`
        );

        if (columns.length === 0) {
            await pool.query(`
                ALTER TABLE companies 
                ADD COLUMN is_group_master BOOLEAN NOT NULL DEFAULT FALSE AFTER company_group_id
            `);
            logger.info('Column is_group_master added to companies table.');
        } else {
            logger.info('Column is_group_master already exists in companies table.');
        }

        logger.info('Migration run_migration_221_company_group_master finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_221_company_group_master');
    } finally {
        conn?.release();
    }
}
