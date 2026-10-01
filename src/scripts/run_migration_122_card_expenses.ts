import 'dotenv/config';
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

async function createCardExpensesTable(): Promise<void> {
    logger.info('Creating card_expenses table...');
    await pool.query(`
        CREATE TABLE IF NOT EXISTS card_expenses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            public_id CHAR(36) NOT NULL UNIQUE,
            company_id INT NOT NULL,
            date DATE NOT NULL,
            description VARCHAR(255) NOT NULL,
            period VARCHAR(7) NOT NULL,
            value DECIMAL(10,2) NOT NULL,
            observation TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    logger.info('card_expenses table created successfully.');
}

async function seedCardExpensesPermissions(): Promise<void> {
    logger.info('Seeding card_expenses permissions...');
    const roles = ['admin', 'super_admin', 'admin_basic', 'financial'];
    for (const role of roles) {
        await pool.query(`
            INSERT INTO role_permissions (company_id, role, module, can_view)
            SELECT c.id, ?, 'card_expenses', 1
            FROM companies c
            ON DUPLICATE KEY UPDATE 
                can_view = VALUES(can_view)
        `, [role]);
    }
    logger.info('card_expenses permissions seeded successfully.');
}

export async function runMigration122CardExpenses(): Promise<void> {
    const conn = await pool.getConnection();
    try {
        logger.info('Starting migration: run_migration_122_card_expenses...');

        const exists = await tableExists('card_expenses');
        if (!exists) {
            await createCardExpensesTable();
        } else {
            logger.info('Table card_expenses already exists.');
        }

        if (await tableExists('role_permissions')) {
            await seedCardExpensesPermissions();
        } else {
            logger.warn('role_permissions table not found. Skipping permissions seed.');
        }

        // Register migration
        const migrationVersion = 122;
        const migrationDescription = 'Create card_expenses table and seed permissions';
        await pool.query(
            `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
            [migrationVersion, migrationDescription]
        );

        logger.info('Migration run_migration_122_card_expenses finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_122_card_expenses');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration122CardExpenses()
        .then(() => {
            logger.info('Migration 122 completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            logger.error({ err }, 'Migration 122 execution failed');
            process.exit(1);
        });
}
