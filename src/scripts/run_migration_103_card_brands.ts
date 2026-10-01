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

async function createCardBrandsTable(): Promise<void> {
    logger.info('Creating card_brands table...');
    await pool.query(`
        CREATE TABLE IF NOT EXISTS card_brands (
            id INT AUTO_INCREMENT PRIMARY KEY,
            public_id VARCHAR(50) NOT NULL UNIQUE,
            company_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_card_brands_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
}

async function recreateCardConfigurationsTable(): Promise<void> {
    logger.info('Recreating card_configurations table with card_brand_id...');
    await pool.query(`DROP TABLE IF EXISTS card_configurations;`);
    await pool.query(`
        CREATE TABLE card_configurations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            public_id VARCHAR(50) NOT NULL UNIQUE,
            company_id INT NOT NULL,
            receivable_type_id INT NOT NULL,
            card_brand_id INT NOT NULL,
            tax_rate DECIMAL(5, 2) NOT NULL,
            due_days INT NOT NULL,
            service_fee DECIMAL(10, 2) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_card_configurations_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            CONSTRAINT fk_card_configurations_receivable_type FOREIGN KEY (receivable_type_id) REFERENCES receivable_types(id) ON DELETE CASCADE,
            CONSTRAINT fk_card_configurations_card_brand FOREIGN KEY (card_brand_id) REFERENCES card_brands(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
}

async function seedCardBrandsPermissions(): Promise<void> {
    logger.info('Seeding card_brands permissions...');
    const roles = ['admin', 'super_admin', 'admin_basic', 'financial'];
    for (const role of roles) {
        await pool.query(`
            INSERT INTO role_permissions (company_id, role, module, can_view)
            SELECT c.id, ?, 'card_brands', 1
            FROM companies c
            ON DUPLICATE KEY UPDATE 
                can_view = VALUES(can_view)
        `, [role]);
    }
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

export default async function runMigration103CardBrands() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_103_card_brands');

        if (!(await tableExists('card_brands'))) {
            await createCardBrandsTable();
        }

        if (!(await columnExists('card_configurations', 'card_brand_id'))) {
            await recreateCardConfigurationsTable();
        }

        if (await tableExists('role_permissions')) {
            await seedCardBrandsPermissions();
        }

        logger.info('Migration run_migration_103_card_brands finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_103_card_brands');
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration103CardBrands()
        .catch((err) => {
            logger.error({ err }, 'Migration 103 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
