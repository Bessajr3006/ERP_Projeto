import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';
import { PoolConnection } from 'mysql2/promise';

export async function runMigration99AddAdminBasicRole() {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_99_add_admin_basic_role');

        await conn.beginTransaction();

        // 1. Alter table users to expand role ENUM to include 'admin_basic' if not varchar
        const [metaRows]: any = await conn.query(
            `SELECT COLUMN_TYPE, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`
        );
        const colType = String(metaRows?.[0]?.COLUMN_TYPE || metaRows?.[0]?.DATA_TYPE || '').toLowerCase();
        if (!colType.startsWith('varchar')) {
            try {
                await conn.query(`
                    ALTER TABLE users
                    MODIFY COLUMN role ENUM(
                        'admin', 'user', 'operator', 'financial', 'manager', 
                        'seller', 'accountant', 'buyer', 'service_provider', 
                        'super_admin', 'admin_basic'
                    ) NOT NULL DEFAULT 'user'
                `);
            } catch (alterErr: any) {
                logger.warn({ err: alterErr?.message || alterErr }, 'Could not alter users.role enum in migration 99');
            }
        }

        // 2. Insert default 'admin_basic' role for all companies if not exists
        await conn.query(`
            INSERT INTO roles (public_id, company_id, name, slug, description, is_active)
            SELECT UUID(), id, 'Administrador Básico', 'admin_basic', 'Acesso administrativo básico (editável)', TRUE
            FROM companies
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                description = VALUES(description),
                is_active = TRUE
        `);

        // 3. Seed default permissions for 'admin_basic' role by copying permissions of 'admin' role in each company
        await conn.query(`
            INSERT INTO role_permissions (company_id, role, module, can_view)
            SELECT company_id, 'admin_basic', module, can_view
            FROM role_permissions
            WHERE role = 'admin'
            ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
        `);

        await conn.commit();
        logger.info('Migration run_migration_99_add_admin_basic_role finished successfully!');
    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (rbErr) {
                logger.error({ err: rbErr }, 'Failed to rollback migration 99');
            }
        }
        logger.error({ err }, 'Failed to run migration: run_migration_99_add_admin_basic_role');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration99AddAdminBasicRole()
        .catch((err) => {
            logger.error({ err }, 'Migration 99 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
