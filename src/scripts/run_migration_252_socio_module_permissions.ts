import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';
import { PoolConnection } from 'mysql2/promise';

export default async function runMigration252SocioModulePermissions(): Promise<void> {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_252_socio_module_permissions');

        await conn.beginTransaction();

        // 1. Ensure default role 'socio' in roles table for all companies
        await conn.query(`
            INSERT INTO roles (public_id, company_id, name, slug, description, is_active)
            SELECT UUID(), c.id, 'Sócio', 'socio', 'Perfil de sócio / dono da empresa', TRUE
            FROM companies c
            WHERE NOT EXISTS (
                SELECT 1 FROM roles r WHERE r.company_id = c.id AND r.slug = 'socio'
            )
        `);

        // 2. Give 'socio' module permission to management roles
        const adminRoles = ['admin', 'super_admin', 'supervisor', 'admin_basic', 'financial', 'socio'];
        for (const role of adminRoles) {
            await conn.query(`
                INSERT INTO role_permissions (company_id, role, module, can_view)
                SELECT c.id, ?, 'socio', 1
                FROM companies c
                ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
            `, [role]);
        }

        // 3. Ensure default modules for 'socio' role
        const socioDefaultModules = ['dashboard', 'company', 'socio', 'census-vision', 'mec-vision'];
        for (const mod of socioDefaultModules) {
            await conn.query(`
                INSERT INTO role_permissions (company_id, role, module, can_view)
                SELECT c.id, 'socio', ?, 1
                FROM companies c
                ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
            `, [mod]);
        }

        await conn.commit();
        logger.info('Migration run_migration_252_socio_module_permissions finished successfully!');
    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch {}
        }
        logger.error({ err }, 'Failed to run migration: run_migration_252_socio_module_permissions');
    } finally {
        if (conn) conn.release();
    }
}

if (require.main === module) {
    runMigration252SocioModulePermissions().then(() => process.exit(0));
}
