import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration73StockTypes() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_73_stock_types');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS stock_types (
                id INT AUTO_INCREMENT PRIMARY KEY,
                public_id CHAR(36) NOT NULL UNIQUE,
                company_id INT NOT NULL,
                name VARCHAR(150) NOT NULL,
                description TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                CONSTRAINT fk_stock_types_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                UNIQUE KEY uk_stock_types_company_name (company_id, name),
                INDEX idx_stock_types_company_name (company_id, name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        logger.info('Migration run_migration_73_stock_types finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_73_stock_types');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration73StockTypes()
        .catch((err) => {
            logger.error({ err }, 'Migration 73 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
