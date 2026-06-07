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

async function seedPermissions(): Promise<void> {
    await pool.query(`
        INSERT INTO role_permissions (company_id, role, module, can_view)
        SELECT c.id, 'admin', 'email-config', 1
        FROM companies c
        ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
    `);
    await pool.query(`
        INSERT INTO role_permissions (company_id, role, module, can_view)
        SELECT c.id, 'super_admin', 'email-config', 1
        FROM companies c
        ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
    `);
    await pool.query(`
        INSERT INTO role_permissions (company_id, role, module, can_view)
        SELECT c.id, 'admin', 'email', 1
        FROM companies c
        ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
    `);
    await pool.query(`
        INSERT INTO role_permissions (company_id, role, module, can_view)
        SELECT c.id, 'super_admin', 'email', 1
        FROM companies c
        ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
    `);
}
export default async function runMigration() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_57_email_config');

        if (!(await tableExists('email_config'))) {
            await conn.query(`
                CREATE TABLE IF NOT EXISTS email_config (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    company_id INT NOT NULL,
                    smtp_host VARCHAR(255) NOT NULL DEFAULT '',
                    smtp_port SMALLINT UNSIGNED NOT NULL DEFAULT 587,
                    smtp_secure TINYINT(1) NOT NULL DEFAULT 0,
                    smtp_user VARCHAR(255) NOT NULL DEFAULT '',
                    imap_host VARCHAR(255) NOT NULL DEFAULT '',
                    imap_port SMALLINT UNSIGNED NOT NULL DEFAULT 993,
                    imap_secure TINYINT(1) NOT NULL DEFAULT 1,
                    smtp_password TEXT DEFAULT NULL,
                    sender_name VARCHAR(120) NOT NULL DEFAULT '',
                    sender_email VARCHAR(255) NOT NULL DEFAULT '',
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                    UNIQUE KEY uk_email_config_company (company_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            logger.info('Table email_config created.');
        }

        await seedPermissions();

        logger.info('Migration run_migration_57_email_config finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_57_email_config');
    } finally {
        conn?.release();
    }
}
