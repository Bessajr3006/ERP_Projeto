import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration63Services() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_63_services');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS services (
                id INT AUTO_INCREMENT PRIMARY KEY,
                public_id CHAR(36) NOT NULL UNIQUE,
                company_id INT NOT NULL,
                name VARCHAR(150) NOT NULL,
                price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                description TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                CONSTRAINT fk_services_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                UNIQUE KEY uk_services_company_name (company_id, name),
                INDEX idx_services_company_name (company_id, name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        logger.info('Migration run_migration_63_services finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_63_services');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration63Services()
        .catch((err) => {
            logger.error({ err }, 'Migration 63 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
