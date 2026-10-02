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

export async function runMigration255DocumentsTable(): Promise<void> {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_255_documents_table');

        if (!(await tableExists('documents'))) {
            logger.info('Creating documents table...');
            await conn.query(`
                CREATE TABLE IF NOT EXISTS documents (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    public_id CHAR(36) NOT NULL UNIQUE COMMENT 'UUID for public reference',
                    company_id INT NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    file_path VARCHAR(512) NOT NULL,
                    file_size INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                    INDEX idx_company_id (company_id),
                    INDEX idx_public_id (public_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
            logger.info('Created documents table successfully.');
        }

        const migrationVersion = 255;
        const migrationDescription = 'Create documents table for secure multi-tenant attachments and documents';
        await conn.query(
            `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
            [migrationVersion, migrationDescription]
        );

        logger.info('Migration run_migration_255_documents_table finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_255_documents_table');
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration255DocumentsTable()
        .then(() => {
            logger.info('Migration 255 completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            logger.error({ err }, 'Migration 255 execution failed');
            process.exit(1);
        });
}
