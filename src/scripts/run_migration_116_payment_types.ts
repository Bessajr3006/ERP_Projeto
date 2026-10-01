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

async function createPaymentTypesTable(): Promise<void> {
    logger.info('Creating payment_types table...');
    await pool.query(`
        CREATE TABLE IF NOT EXISTS payment_types (
            id INT AUTO_INCREMENT PRIMARY KEY,
            public_id VARCHAR(50) NOT NULL UNIQUE,
            company_id INT NOT NULL,
            name VARCHAR(150) NOT NULL,
            bank_account_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_payment_types_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            CONSTRAINT fk_payment_types_bank_account FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
}

async function seedPaymentTypesPermissions(): Promise<void> {
    logger.info('Seeding payment_types permissions...');
    const roles = ['admin', 'super_admin', 'admin_basic', 'financial'];
    for (const role of roles) {
        await pool.query(`
            INSERT INTO role_permissions (company_id, role, module, can_view)
            SELECT c.id, ?, 'payment_types', 1
            FROM companies c
            ON DUPLICATE KEY UPDATE 
                can_view = VALUES(can_view)
        `, [role]);
    }
}

export default async function runMigration116PaymentTypes() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_116_payment_types');

        if (!(await tableExists('payment_types'))) {
            await createPaymentTypesTable();
        }

        if (await tableExists('role_permissions')) {
            await seedPaymentTypesPermissions();
        }

        logger.info('Migration run_migration_116_payment_types finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_116_payment_types');
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration116PaymentTypes()
        .catch((err) => {
            logger.error({ err }, 'Migration 116 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
