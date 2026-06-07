import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration() {
    let conn;
    try {
        conn = await pool.getConnection();

        logger.info('Running migration: run_migration_50_whatsapp_sessions');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_business_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                owner_type ENUM('company', 'user') NOT NULL DEFAULT 'company',
                owner_id INT NOT NULL,
                user_id INT DEFAULT NULL,
                company_key VARCHAR(80) NOT NULL,
                owner_key VARCHAR(120) NOT NULL,
                session_key VARCHAR(160) NOT NULL,
                status ENUM('idle', 'initializing', 'awaiting_qr', 'authenticated', 'ready', 'auth_failure', 'disconnected', 'error') NOT NULL DEFAULT 'idle',
                has_qr_code TINYINT(1) NOT NULL DEFAULT 0,
                persisted_session TINYINT(1) NOT NULL DEFAULT 0,
                connected_number VARCHAR(40) DEFAULT NULL,
                connected_name VARCHAR(150) DEFAULT NULL,
                platform VARCHAR(80) DEFAULT NULL,
                wid VARCHAR(120) DEFAULT NULL,
                last_event_at DATETIME DEFAULT NULL,
                last_error TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                UNIQUE KEY uk_wb_session_scope (owner_type, owner_id),
                UNIQUE KEY uk_wb_session_key (session_key),
                INDEX idx_wb_session_company_status (company_id, status),
                INDEX idx_wb_session_user_id (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        logger.info('Migration run_migration_50_whatsapp_sessions finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_50_whatsapp_sessions');
        throw err;
    } finally {
        if (conn) conn.release();
    }
}