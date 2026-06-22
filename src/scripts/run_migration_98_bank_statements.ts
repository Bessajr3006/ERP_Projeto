import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';
import { PoolConnection } from 'mysql2/promise';

export async function runMigration98BankStatements() {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_98_bank_statements');

        await conn.beginTransaction();

        // 1. Create bank_statements table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS bank_statements (
                id INT AUTO_INCREMENT PRIMARY KEY,
                public_id CHAR(36) NOT NULL UNIQUE,
                company_id INT NOT NULL,
                bank_account_id INT NOT NULL,
                transaction_id VARCHAR(100) DEFAULT NULL,
                date DATE NOT NULL,
                description VARCHAR(255) NOT NULL,
                amount DECIMAL(15, 2) NOT NULL,
                type ENUM('income', 'expense') NOT NULL,
                raw_data LONGTEXT DEFAULT NULL,
                status ENUM('pending', 'reconciled') NOT NULL DEFAULT 'pending',
                reconciled_transaction_id INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                CONSTRAINT fk_bank_statements_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                CONSTRAINT fk_bank_statements_bank_account FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE,
                CONSTRAINT fk_bank_statements_reconciled_tx FOREIGN KEY (reconciled_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
                UNIQUE KEY uk_bank_statements_acc_tx (bank_account_id, transaction_id),
                INDEX idx_company_bank_date (company_id, bank_account_id, date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 2. Seed role permissions for 'statements' if not already done
        const roles = ['admin', 'super_admin', 'financial'];
        for (const role of roles) {
            await conn.query(`
                INSERT INTO role_permissions (company_id, role, module, can_view)
                SELECT c.id, ?, 'statements', 1
                FROM companies c
                ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
            `, [role]);
        }

        await conn.commit();
        logger.info('Migration run_migration_98_bank_statements finished successfully!');
    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (rbErr) {
                logger.error({ err: rbErr }, 'Failed to rollback migration 98');
            }
        }
        logger.error({ err }, 'Failed to run migration: run_migration_98_bank_statements');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration98BankStatements()
        .catch((err) => {
            logger.error({ err }, 'Migration 98 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
