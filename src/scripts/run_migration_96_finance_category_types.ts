import pool from '../config/db';
import logger from '../config/logger';
import { PoolConnection } from 'mysql2/promise';

export async function runMigration96FinanceCategoryTypes() {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_96_finance_category_types');

        await conn.beginTransaction();

        // 1. Create finance_category_types table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS finance_category_types (
                id INT AUTO_INCREMENT PRIMARY KEY,
                public_id CHAR(36) NOT NULL UNIQUE,
                company_id INT NOT NULL,
                name VARCHAR(150) NOT NULL,
                description TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                CONSTRAINT fk_finance_category_types_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                UNIQUE KEY uk_finance_category_types_company_name (company_id, name),
                INDEX idx_finance_category_types_company_name (company_id, name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Helper to check if a column exists
        const columnExists = async (tableName: string, columnName: string) => {
            const [rows] = await conn!.query<any[]>(
                `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [tableName, columnName]
            );
            return rows.length > 0;
        };

        // Helper to check if a constraint exists
        const constraintExists = async (tableName: string, constraintName: string) => {
            const [rows] = await conn!.query<any[]>(
                `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
                [tableName, constraintName]
            );
            return rows.length > 0;
        };

        // 2. Add finance_category_type_id column to categories
        if (!(await columnExists('categories', 'finance_category_type_id'))) {
            await conn!.query(`
                ALTER TABLE categories
                ADD COLUMN finance_category_type_id INT NULL AFTER company_id
            `);
        }

        // 3. Add constraint/index to categories
        if (!(await constraintExists('categories', 'fk_categories_finance_category_type_id'))) {
            await conn!.query(`
                ALTER TABLE categories
                ADD CONSTRAINT fk_categories_finance_category_type_id
                FOREIGN KEY (finance_category_type_id) REFERENCES finance_category_types(id) ON DELETE SET NULL
            `);
        }

        const indexExists = async (tableName: string, indexName: string) => {
            const [rows] = await conn!.query<any[]>(
                `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
                [tableName, indexName]
            );
            return rows.length > 0;
        };

        if (!(await indexExists('categories', 'idx_categories_finance_category_type_id'))) {
            await conn.query(`
                CREATE INDEX idx_categories_finance_category_type_id ON categories (finance_category_type_id)
            `);
        }

        // 4. Seed role permissions for 'finance_category_types'
        const roles = ['admin', 'super_admin', 'financial'];
        for (const role of roles) {
            await conn.query(`
                INSERT INTO role_permissions (company_id, role, module, can_view)
                SELECT c.id, ?, 'finance_category_types', 1
                FROM companies c
                ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
            `, [role]);
        }

        await conn.commit();
        logger.info('Migration run_migration_96_finance_category_types finished successfully!');
    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (rbErr) {
                logger.error({ err: rbErr }, 'Failed to rollback migration 96');
            }
        }
        logger.error({ err }, 'Failed to run migration: run_migration_96_finance_category_types');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration96FinanceCategoryTypes()
        .catch((err) => {
            logger.error({ err }, 'Migration 96 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
