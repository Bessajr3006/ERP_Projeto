import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration213CreateCostCentersTable() {
    try {
        logger.info('Running migration: run_migration_213_create_cost_centers_table');

        // 1. Create table cost_centers
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cost_centers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                public_id VARCHAR(80) NOT NULL UNIQUE,
                company_id INT NOT NULL,
                name VARCHAR(150) NOT NULL,
                description TEXT DEFAULT NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                UNIQUE KEY uk_cost_centers_company_name (company_id, name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 2. Add cost_center_id to transactions table if it doesn't exist
        const [columns]: any = await pool.query(`
            SHOW COLUMNS FROM transactions LIKE 'cost_center_id'
        `);

        if (columns.length === 0) {
            await pool.query(`
                ALTER TABLE transactions 
                ADD COLUMN cost_center_id INT DEFAULT NULL,
                ADD CONSTRAINT fk_transactions_cost_center FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL
            `);
            logger.info('Column cost_center_id added to transactions table successfully.');
        } else {
            logger.info('Column cost_center_id already exists in transactions table.');
        }

        logger.info('Migration run_migration_213_create_cost_centers_table finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_213_create_cost_centers_table');
        throw err;
    }
}
