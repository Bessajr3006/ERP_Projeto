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
async function columnExists(tableName: string, columnName: string): Promise<boolean> {
    const [rows] = await pool.query<any[]>(
        `SELECT COUNT(*) AS count
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?`,
        [tableName, columnName]
    );
    return Array.isArray(rows) && rows[0] && Number(rows[0].count) > 0;
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
                    company_id INT DEFAULT NULL,
                    user_public_id CHAR(36) DEFAULT NULL,
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
                    UNIQUE KEY uk_email_config_user (user_public_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            logger.info('Table email_config created with user_public_id.');
        } else {
            if (!(await columnExists('email_config', 'user_public_id'))) {
                logger.info('Adding user_public_id column to email_config.');
                try {
                    await conn.query(`ALTER TABLE email_config ADD COLUMN user_public_id CHAR(36) DEFAULT NULL AFTER company_id`);
                } catch (e: any) {
                    logger.warn('Could not add user_public_id column to email_config: ' + e.message);
                }
                try {
                    await conn.query(`ALTER TABLE email_config MODIFY COLUMN company_id INT DEFAULT NULL`);
                } catch (e: any) {
                    logger.warn('Could not modify company_id in email_config: ' + e.message);
                }
                try {
                    await conn.query(`ALTER TABLE email_config DROP FOREIGN KEY email_config_ibfk_1`);
                } catch (e: any) {
                    // Ignore if constraint name is different or doesn't exist
                }
                try {
                    await conn.query(`ALTER TABLE email_config ADD UNIQUE KEY uk_email_config_user (user_public_id)`);
                } catch (e: any) {
                    logger.warn('Could not add unique key to email_config: ' + e.message);
                }
            }
        }

        await seedPermissions();

        logger.info('Migration run_migration_57_email_config finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_57_email_config');
    } finally {
        conn?.release();
    }
}
