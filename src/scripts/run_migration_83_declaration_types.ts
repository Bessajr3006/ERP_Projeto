import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration83() {
    try {
        const conn = await pool.getConnection();

        logger.info('Starting migration: 83 - Create declaration_types table');

        try {
            await conn.query(`
                CREATE TABLE IF NOT EXISTS declaration_types (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    company_id INT NOT NULL,
                    public_id VARCHAR(36) NOT NULL UNIQUE,
                    name VARCHAR(100) NOT NULL,
                    description VARCHAR(255) NULL,
                    frequency ENUM('MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL') NOT NULL DEFAULT 'MENSAL',
                    due_day INT NULL,
                    active TINYINT(1) DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
            logger.info('Created declaration_types table.');

            const migrationName = '83';
            await conn.query(
                `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
                [migrationName, 'Create declaration_types table']
            );

        } finally {
            conn.release();
        }

        logger.info('Migration 83 finished successfully.');
    } catch (error) {
        logger.error('Error running migration 83: ' + (error instanceof Error ? error.message : String(error)));
        throw error;
    }
}

if (require.main === module) {
    runMigration83().then(() => process.exit(0)).catch(() => process.exit(1));
}
