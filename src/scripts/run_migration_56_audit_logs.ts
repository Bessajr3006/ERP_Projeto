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

async function seedAdminPermission(): Promise<void> {
    await pool.query(`
        INSERT INTO role_permissions (company_id, role, module, can_view)
        SELECT c.id, 'admin', 'audit', 1
        FROM companies c
        ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
    `);

    await pool.query(`
        INSERT INTO role_permissions (company_id, role, module, can_view)
        SELECT c.id, 'super_admin', 'audit', 1
        FROM companies c
        ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
    `);
}

export default async function runMigration() {
    let conn;
    try {
        conn = await pool.getConnection();

        logger.info('Running migration: run_migration_56_audit_logs');

        if (!(await tableExists('audit_logs'))) {
            await conn.query(`
                CREATE TABLE audit_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    company_id INT NOT NULL,
                    user_id INT DEFAULT NULL,
                    action VARCHAR(30) NOT NULL,
                    module VARCHAR(80) NOT NULL,
                    description VARCHAR(255) NOT NULL,
                    entity_type VARCHAR(80) DEFAULT NULL,
                    entity_id VARCHAR(100) DEFAULT NULL,
                    method VARCHAR(10) DEFAULT NULL,
                    path VARCHAR(255) DEFAULT NULL,
                    ip_address VARCHAR(45) DEFAULT NULL,
                    user_agent TEXT DEFAULT NULL,
                    metadata LONGTEXT DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                    INDEX idx_audit_logs_company_date (company_id, created_at),
                    INDEX idx_audit_logs_company_user_date (company_id, user_id, created_at),
                    INDEX idx_audit_logs_company_module_date (company_id, module, created_at),
                    INDEX idx_audit_logs_company_action_date (company_id, action, created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
        }

        await seedAdminPermission();

        logger.info('Migration run_migration_56_audit_logs finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_56_audit_logs');
        throw err;
    } finally {
        if (conn) conn.release();
    }
}
