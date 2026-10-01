import pool from '../config/db';
import logger from '../config/logger';

async function tableExists(tableName: string): Promise<boolean> {
    const [rows] = await pool.query<any[]>(
        `SELECT COUNT(*) AS count
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?`,
        [tableName]
    );
    return Array.isArray(rows) && rows[0] && Number(rows[0].count) > 0;
}

export async function runMigration250AccountingClosings(): Promise<void> {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_250_accounting_closings');

        if (!(await tableExists('accounting_period_closings'))) {
            logger.info('Creating accounting_period_closings table...');
            await conn.query(`
                CREATE TABLE IF NOT EXISTS accounting_period_closings (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    public_id VARCHAR(50) NOT NULL UNIQUE,
                    company_id INT NOT NULL,
                    customer_id INT NULL,
                    period_type ENUM('monthly', 'quarterly', 'semiannual', 'annual') NOT NULL,
                    year INT NOT NULL,
                    period_number INT NOT NULL DEFAULT 1,
                    accounting_status ENUM('open', 'in_progress', 'closed', 'audited') NOT NULL DEFAULT 'open',
                    tax_status ENUM('open', 'calculated', 'closed', 'paid') NOT NULL DEFAULT 'open',
                    total_debit DECIMAL(15,2) DEFAULT 0.00,
                    total_credit DECIMAL(15,2) DEFAULT 0.00,
                    entries_count INT DEFAULT 0,
                    tax_revenue DECIMAL(15,2) DEFAULT 0.00,
                    tax_pis DECIMAL(15,2) DEFAULT 0.00,
                    tax_cofins DECIMAL(15,2) DEFAULT 0.00,
                    tax_icms DECIMAL(15,2) DEFAULT 0.00,
                    tax_fecp DECIMAL(15,2) DEFAULT 0.00,
                    tax_iss DECIMAL(15,2) DEFAULT 0.00,
                    tax_simples DECIMAL(15,2) DEFAULT 0.00,
                    tax_irpj DECIMAL(15,2) DEFAULT 0.00,
                    tax_csll DECIMAL(15,2) DEFAULT 0.00,
                    tax_total DECIMAL(15,2) DEFAULT 0.00,
                    closed_at DATETIME NULL,
                    closed_by_user_id INT NULL,
                    notes TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    CONSTRAINT fk_apc_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                    UNIQUE KEY uq_company_period (company_id, period_type, year, period_number)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
            logger.info('Created accounting_period_closings table successfully.');
        }

        if (await tableExists('role_permissions')) {
            logger.info('Seeding accounting_closing module permissions...');
            const roles = ['admin', 'super_admin', 'supervisor', 'admin_basic', 'financial', 'accountant', 'auxiliar_contador'];
            for (const role of roles) {
                await conn.query(`
                    INSERT INTO role_permissions (company_id, role, module, can_view)
                    SELECT c.id, ?, 'accounting_closing', 1
                    FROM companies c
                    ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
                `, [role]);
            }
        }

        const migrationVersion = 250;
        const migrationDescription = 'Create accounting_period_closings table and seed accounting_closing permissions';
        await conn.query(
            `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
            [migrationVersion, migrationDescription]
        );

        logger.info('Migration run_migration_250_accounting_closings finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_250_accounting_closings');
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration250AccountingClosings()
        .then(() => {
            logger.info('Migration 250 completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            logger.error({ err }, 'Migration 250 execution failed');
            process.exit(1);
        });
}
