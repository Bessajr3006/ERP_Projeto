import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration() {
    let conn;
    try {
        conn = await pool.getConnection();

        logger.info('Running migration: run_migration_48_tasks');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                public_id CHAR(36) NOT NULL UNIQUE,
                company_id INT NOT NULL,
                title TEXT NOT NULL,
                due_date DATETIME DEFAULT NULL,
                assigned_user_public_id CHAR(36) DEFAULT NULL,
                status ENUM('pending', 'progress', 'completed') NOT NULL DEFAULT 'pending',
                person_type VARCHAR(40) DEFAULT NULL,
                person_id VARCHAR(80) DEFAULT NULL,
                attachments_json LONGTEXT DEFAULT NULL,
                completed_at DATETIME DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                INDEX idx_tasks_company_status (company_id, status),
                INDEX idx_tasks_company_due_date (company_id, due_date),
                INDEX idx_tasks_assigned_user (company_id, assigned_user_public_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        logger.info('Migration run_migration_48_tasks finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_48_tasks');
        throw err;
    } finally {
        if (conn) conn.release();
    }
}