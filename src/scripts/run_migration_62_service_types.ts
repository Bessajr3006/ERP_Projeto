import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration62ServiceTypes() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_62_service_types');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS service_types (
                id INT AUTO_INCREMENT PRIMARY KEY,
                public_id CHAR(36) NOT NULL UNIQUE,
                company_id INT NOT NULL,
                name VARCHAR(150) NOT NULL,
                description TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                CONSTRAINT fk_service_types_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                UNIQUE KEY uk_service_types_company_name (company_id, name),
                INDEX idx_service_types_company_name (company_id, name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        logger.info('Migration run_migration_62_service_types finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_62_service_types');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration62ServiceTypes()
        .catch((err) => {
            logger.error({ err }, 'Migration 62 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
