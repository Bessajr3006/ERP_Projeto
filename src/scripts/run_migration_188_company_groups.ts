import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration188CompanyGroups() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_188_company_groups');

        // 1. Create company_groups table if it doesn't exist
        const [tables] = await pool.query<any[]>(
            `SHOW TABLES LIKE 'company_groups'`
        );

        if (tables.length === 0) {
            await pool.query(`
                CREATE TABLE company_groups (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    public_id VARCHAR(36) NOT NULL UNIQUE,
                    name VARCHAR(150) NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
            logger.info('Table company_groups created.');
        } else {
            logger.info('Table company_groups already exists.');
        }

        // 2. Add company_group_id to companies table if it doesn't exist
        const [columns] = await pool.query<any[]>(
            `SHOW COLUMNS FROM companies LIKE 'company_group_id'`
        );

        if (columns.length === 0) {
            await pool.query(`
                ALTER TABLE companies 
                ADD COLUMN company_group_id INT NULL AFTER is_general_admin,
                ADD CONSTRAINT fk_companies_company_group FOREIGN KEY (company_group_id) REFERENCES company_groups(id) ON DELETE SET NULL
            `);
            logger.info('Column company_group_id added to companies table.');
        } else {
            logger.info('Column company_group_id already exists in companies table.');
        }

        logger.info('Migration run_migration_188_company_groups finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_188_company_groups');
    } finally {
        conn?.release();
    }
}
