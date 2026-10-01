import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';
import { PoolConnection } from 'mysql2/promise';

export async function runMigration203CardStatements() {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_203_card_statements');

        await conn.beginTransaction();

        // 1. Create card_statements table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS card_statements (
                id INT AUTO_INCREMENT PRIMARY KEY,
                public_id CHAR(36) NOT NULL UNIQUE,
                company_id INT NOT NULL,
                date DATE NOT NULL,
                description VARCHAR(255) NOT NULL,
                amount DECIMAL(15, 2) NOT NULL,
                type ENUM('income', 'expense') NOT NULL DEFAULT 'income',
                status ENUM('pending', 'reconciled') NOT NULL DEFAULT 'pending',
                reconciled_transaction_id INT DEFAULT NULL,
                raw_data LONGTEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                CONSTRAINT fk_card_statements_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                CONSTRAINT fk_card_statements_reconciled_tx FOREIGN KEY (reconciled_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
                INDEX idx_company_card_date (company_id, date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 2. Seed role permissions for 'card_statements'
        const roles = ['admin', 'super_admin', 'financial'];
        for (const role of roles) {
            await conn.query(`
                INSERT INTO role_permissions (company_id, role, module, can_view)
                SELECT c.id, ?, 'card_statements', 1
                FROM companies c
                ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
            `, [role]);
        }

        await conn.commit();
        logger.info('Migration run_migration_203_card_statements finished successfully!');
    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (rbErr) {
                logger.error({ err: rbErr }, 'Failed to rollback migration 203');
            }
        }
        logger.error({ err }, 'Failed to run migration: run_migration_203_card_statements');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration203CardStatements()
        .catch((err) => {
            logger.error({ err }, 'Migration 203 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
