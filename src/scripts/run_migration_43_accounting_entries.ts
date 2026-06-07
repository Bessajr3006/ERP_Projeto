import pool from '../config/db';
import logger from '../config/logger';

async function runMigration() {
    logger.info('Running migration: Create Accounting Entries table');
    
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Check if table exists
        const [rows]: any = await conn.query("SHOW TABLES LIKE 'accounting_entries'");
        if (rows.length > 0) {
            logger.info('Table accounting_entries already exists. Skipping creation.');
        } else {
            await conn.query(`
                CREATE TABLE accounting_entries (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    public_id VARCHAR(36) UNIQUE NOT NULL,
                    company_id INT NOT NULL,
                    entry_date DATE NOT NULL,
                    debit_account_id INT NOT NULL,
                    credit_account_id INT NOT NULL,
                    amount DECIMAL(15,2) NOT NULL,
                    document_ref VARCHAR(100),
                    history TEXT NOT NULL,
                    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                    FOREIGN KEY (debit_account_id) REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
                    FOREIGN KEY (credit_account_id) REFERENCES chart_of_accounts(id) ON DELETE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
            logger.info('Created accounting_entries table.');
        }

        await conn.commit();
        logger.info('Migration run_migration_43_accounting_entries finished successfully!');
    } catch (error) {
        await conn.rollback();
        logger.error('Migration failed: ' + error);
        throw error;
    } finally {
        conn.release();
    }
}

export default runMigration;
