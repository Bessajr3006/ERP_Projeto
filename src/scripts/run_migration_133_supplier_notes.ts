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

export async function runMigration133SupplierNotes(): Promise<void> {
    const conn = await pool.getConnection();
    try {
        logger.info('Starting migration: run_migration_133_supplier_notes...');

        const exists = await tableExists('supplier_notes');
        if (!exists) {
            logger.info('Creating table supplier_notes...');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS supplier_notes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    public_id VARCHAR(36) NOT NULL UNIQUE,
                    company_id INT NOT NULL,
                    supplier_id INT NOT NULL,
                    user_id INT NULL,
                    note TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
            logger.info('Table supplier_notes created successfully.');
        } else {
            logger.info('Table supplier_notes already exists.');
        }

        // Register migration
        const migrationVersion = 133;
        const migrationDescription = 'Create supplier_notes table';
        await pool.query(
            `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
            [migrationVersion, migrationDescription]
        );

        logger.info('Migration run_migration_133_supplier_notes finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_133_supplier_notes');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration133SupplierNotes()
        .then(() => {
            logger.info('Migration 133 completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            logger.error({ err }, 'Migration 133 execution failed');
            process.exit(1);
        });
}
