import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration179AddDefaultCustomerGroupToCompanies() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_179_add_default_customer_group_to_companies');

        // Check if default_customer_group_id column exists in companies table
        const [columns] = await pool.query<any[]>(
            `SHOW COLUMNS FROM companies LIKE 'default_customer_group_id'`
        );

        if (columns.length === 0) {
            await pool.query(
                `ALTER TABLE companies ADD COLUMN default_customer_group_id INT NULL,
                 ADD CONSTRAINT fk_companies_default_customer_group FOREIGN KEY (default_customer_group_id) REFERENCES customer_groups(id) ON DELETE SET NULL`
            );
            logger.info('Column default_customer_group_id added to companies table.');
        } else {
            logger.info('Column default_customer_group_id already exists in companies table.');
        }

        logger.info('Migration run_migration_179_add_default_customer_group_to_companies finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_179_add_default_customer_group_to_companies');
    } finally {
        conn?.release();
    }
}
