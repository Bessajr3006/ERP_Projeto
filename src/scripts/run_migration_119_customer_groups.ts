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

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
    const [rows] = await pool.query<any[]>(
        `SELECT COUNT(*) AS count
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?`,
        [tableName, columnName]
    );
    return Array.isArray(rows) && rows[0] && Number(rows[0].count) > 0;
}

async function createCustomerGroupsTable(): Promise<void> {
    logger.info('Creating customer_groups table...');
    await pool.query(`
        CREATE TABLE IF NOT EXISTS customer_groups (
            id INT AUTO_INCREMENT PRIMARY KEY,
            public_id VARCHAR(50) NOT NULL UNIQUE,
            company_id INT NOT NULL,
            name VARCHAR(150) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_customer_groups_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
}

async function seedCustomerGroupsPermissions(): Promise<void> {
    logger.info('Seeding customer_groups permissions...');
    const roles = ['admin', 'super_admin', 'admin_basic', 'financial', 'seller'];
    for (const role of roles) {
        await pool.query(`
            INSERT INTO role_permissions (company_id, role, module, can_view)
            SELECT c.id, ?, 'customer_groups', 1
            FROM companies c
            ON DUPLICATE KEY UPDATE 
                can_view = VALUES(can_view)
        `, [role]);
    }
}

export default async function runMigration119CustomerGroups() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_119_customer_groups');

        if (!(await tableExists('customer_groups'))) {
            await createCustomerGroupsTable();
        }

        if (await tableExists('role_permissions')) {
            await seedCustomerGroupsPermissions();
        }

        if (await tableExists('customers')) {
            if (!(await columnExists('customers', 'customer_group_id'))) {
                logger.info('Adding customer_group_id column to customers...');
                await pool.query(`
                    ALTER TABLE customers 
                    ADD COLUMN customer_group_id INT NULL AFTER company_id,
                    ADD CONSTRAINT fk_customers_customer_group FOREIGN KEY (customer_group_id) REFERENCES customer_groups(id) ON DELETE SET NULL;
                `);
            }
        }

        const migrationVersion = 119;
        const migrationDescription = 'Create customer_groups table and link customers';
        await pool.query(
            `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
            [migrationVersion, migrationDescription]
        );

        logger.info('Migration run_migration_119_customer_groups finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_119_customer_groups');
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration119CustomerGroups()
        .then(() => {
            logger.info('Migration 119 completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            logger.error({ err }, 'Migration 119 execution failed');
            process.exit(1);
        });
}
