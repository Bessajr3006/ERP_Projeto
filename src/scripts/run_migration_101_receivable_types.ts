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

async function createReceivableTypesTable(): Promise<void> {
    logger.info('Creating receivable_types table...');
    await pool.query(`
        CREATE TABLE IF NOT EXISTS receivable_types (
            id INT AUTO_INCREMENT PRIMARY KEY,
            public_id VARCHAR(50) NOT NULL UNIQUE,
            company_id INT NOT NULL,
            name VARCHAR(150) NOT NULL,
            bank_account_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_receivable_types_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            CONSTRAINT fk_receivable_types_bank_account FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
}

async function seedReceivableTypesPermissions(): Promise<void> {
    logger.info('Seeding receivable_types permissions...');
    const roles = ['admin', 'super_admin', 'admin_basic', 'financial'];
    for (const role of roles) {
        await pool.query(`
            INSERT INTO role_permissions (company_id, role, module, can_view)
            SELECT c.id, ?, 'receivable_types', 1
            FROM companies c
            ON DUPLICATE KEY UPDATE 
                can_view = VALUES(can_view)
        `, [role]);
    }
}

export default async function runMigration101ReceivableTypes() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_101_receivable_types');

        if (!(await tableExists('receivable_types'))) {
            await createReceivableTypesTable();
        }

        if (await tableExists('role_permissions')) {
            await seedReceivableTypesPermissions();
        }

        logger.info('Migration run_migration_101_receivable_types finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_101_receivable_types');
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration101ReceivableTypes()
        .catch((err) => {
            logger.error({ err }, 'Migration 101 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
