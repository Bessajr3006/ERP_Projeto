import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration() {
    let conn;
    try {
        conn = await pool.getConnection();

        logger.info('Running migration: run_migration_46_whatsapp_phone_aliases');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_business_phone_aliases (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                owner_type ENUM('company', 'user') NOT NULL DEFAULT 'company',
                owner_id INT NOT NULL,
                alias_phone VARCHAR(40) NOT NULL,
                canonical_phone VARCHAR(40) NOT NULL,
                source_chat_user VARCHAR(40) DEFAULT NULL,
                source_chat_id VARCHAR(120) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                UNIQUE KEY uk_wb_phone_alias_scope (owner_type, owner_id, alias_phone),
                INDEX idx_wb_phone_alias_scope_canonical (company_id, owner_type, owner_id, canonical_phone),
                INDEX idx_wb_phone_alias_scope_chat_user (company_id, owner_type, owner_id, source_chat_user)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        logger.info('Migration run_migration_46_whatsapp_phone_aliases finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_46_whatsapp_phone_aliases');
        throw err;
    } finally {
        if (conn) conn.release();
    }
}
