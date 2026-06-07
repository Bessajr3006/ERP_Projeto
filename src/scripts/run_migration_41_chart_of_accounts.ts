import pool from '../config/db';
import logger from '../config/logger';

async function runMigration() {
    logger.info('Running migration: Create Chart of Accounts table');
    
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Check if table exists
        const [rows]: any = await conn.query("SHOW TABLES LIKE 'chart_of_accounts'");
        if (rows.length > 0) {
            logger.info('Table chart_of_accounts already exists. Skipping creation.');
        } else {
            await conn.query(`
                CREATE TABLE chart_of_accounts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    public_id VARCHAR(36) UNIQUE NOT NULL,
                    company_id INT NOT NULL,
                    code VARCHAR(50) NOT NULL,
                    name VARCHAR(150) NOT NULL,
                    type ENUM('synthetic', 'analytic') NOT NULL DEFAULT 'analytic',
                    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                    UNIQUE KEY uq_company_code (company_id, code)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
            logger.info('Created chart_of_accounts table.');
            
            // Add a permission block in permissions if not exists
            const [permRows]: any = await conn.query("SELECT id FROM permissions WHERE name = 'accounting_write'");
            if (permRows.length === 0) {
                await conn.query(`INSERT INTO permissions (name, label) VALUES ('accounting_write', 'Criar/Editar Menu de Contabilidade')`);
                logger.info('Registered accounting_write permission');
            }
        }

        await conn.commit();
        logger.info('Migration run_migration_41_chart_of_accounts finished successfully!');
    } catch (error) {
        await conn.rollback();
        logger.error('Migration failed: ' + error);
        throw error;
    } finally {
        conn.release();
    }
}

// Execute if run directly
if (require.main === module) {
    runMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

export default runMigration;
