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

export async function runMigration132ContactNotes(): Promise<void> {
    const conn = await pool.getConnection();
    try {
        logger.info('Starting migration: run_migration_132_contact_notes...');

        const exists = await tableExists('contact_notes');
        if (!exists) {
            logger.info('Creating table contact_notes...');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS contact_notes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    public_id VARCHAR(36) NOT NULL UNIQUE,
                    company_id INT NOT NULL,
                    contact_id INT NOT NULL,
                    user_id INT NULL,
                    note TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
            logger.info('Table contact_notes created successfully.');
        } else {
            logger.info('Table contact_notes already exists.');
        }

        // Register migration
        const migrationVersion = 132;
        const migrationDescription = 'Create contact_notes table';
        await pool.query(
            `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
            [migrationVersion, migrationDescription]
        );

        logger.info('Migration run_migration_132_contact_notes finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_132_contact_notes');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration132ContactNotes()
        .then(() => {
            logger.info('Migration 132 completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            logger.error({ err }, 'Migration 132 execution failed');
            process.exit(1);
        });
}
