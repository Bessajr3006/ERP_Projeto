import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration77() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_77_accounting_auto_entries');

        // Create accounting_auto_templates table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS accounting_auto_templates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                public_id VARCHAR(255) NOT NULL UNIQUE,
                company_id INT NOT NULL,
                code VARCHAR(50) NOT NULL,
                description VARCHAR(255) NOT NULL,
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY accounting_auto_templates_code_company_unique (code, company_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        logger.info('Created accounting_auto_templates table.');

        // Create accounting_auto_template_items table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS accounting_auto_template_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                public_id VARCHAR(255) NOT NULL UNIQUE,
                template_id INT NOT NULL,
                debit_account_id INT,
                credit_account_id INT,
                history_template VARCHAR(500) NOT NULL,
                CONSTRAINT fk_accounting_auto_template_items_template_id 
                    FOREIGN KEY (template_id) REFERENCES accounting_auto_templates(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        logger.info('Created accounting_auto_template_items table.');

        logger.info('Migration run_migration_77_accounting_auto_entries finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_77');
        throw err;
    } finally {
        if (conn) conn.release();
    }
}

if (require.main === module) {
    runMigration77()
        .catch((err) => {
            logger.error({ err }, 'Migration 77 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
