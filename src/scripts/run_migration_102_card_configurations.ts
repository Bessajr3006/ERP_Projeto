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

async function createCardConfigurationsTable(): Promise<void> {
    logger.info('Creating card_configurations table...');
    await pool.query(`
        CREATE TABLE IF NOT EXISTS card_configurations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            public_id VARCHAR(50) NOT NULL UNIQUE,
            company_id INT NOT NULL,
            receivable_type_id INT NOT NULL,
            tax_rate DECIMAL(5, 2) NOT NULL,
            due_days INT NOT NULL,
            service_fee DECIMAL(10, 2) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_card_configurations_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            CONSTRAINT fk_card_configurations_receivable_type FOREIGN KEY (receivable_type_id) REFERENCES receivable_types(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
}

async function seedCardConfigurationsPermissions(): Promise<void> {
    logger.info('Seeding card_configurations permissions...');
    const roles = ['admin', 'super_admin', 'admin_basic', 'financial'];
    for (const role of roles) {
        await pool.query(`
            INSERT INTO role_permissions (company_id, role, module, can_view)
            SELECT c.id, ?, 'card_configurations', 1
            FROM companies c
            ON DUPLICATE KEY UPDATE 
                can_view = VALUES(can_view)
        `, [role]);
    }
}

export default async function runMigration102CardConfigurations() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_102_card_configurations');

        if (!(await tableExists('card_configurations'))) {
            await createCardConfigurationsTable();
        }

        if (await tableExists('role_permissions')) {
            await seedCardConfigurationsPermissions();
        }

        logger.info('Migration run_migration_102_card_configurations finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_102_card_configurations');
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration102CardConfigurations()
        .catch((err) => {
            logger.error({ err }, 'Migration 102 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
