import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration78() {
    try {
        const conn = await pool.getConnection();

        logger.info('Starting migration: 78 - Create accounting_histories table');

        try {
            await conn.query(`
                CREATE TABLE IF NOT EXISTS accounting_histories (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    public_id VARCHAR(36) NOT NULL UNIQUE,
                    company_id INT NOT NULL,
                    code VARCHAR(50) NOT NULL,
                    description VARCHAR(255) NOT NULL,
                    history_text TEXT NOT NULL,
                    active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
                    CONSTRAINT fk_accounting_histories_company_id
                        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                    UNIQUE KEY accounting_histories_code_company_unique (code, company_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
            logger.info('Created accounting_histories table.');

            const migrationName = 78;
            await conn.query(
                `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
                [migrationName, 'Create accounting_histories table']
            );

        } finally {
            conn.release();
        }

        logger.info('Migration 78 finished successfully.');
    } catch (error) {
        logger.error({ err: error }, 'Error running migration 78');
        throw error;
    }
}

// Executar se for chamado diretamente
if (require.main === module) {
    runMigration78().then(() => process.exit(0)).catch(() => process.exit(1));
}
