import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration() {
    let conn;
    try {
        conn = await pool.getConnection();

        logger.info('Running migration: run_migration_49_organizer_states');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS organizer_states (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                state_json LONGTEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                UNIQUE KEY uk_organizer_states_company (company_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        logger.info('Migration run_migration_49_organizer_states finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_49_organizer_states');
        throw err;
    } finally {
        if (conn) conn.release();
    }
}