import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';
import { PoolConnection } from 'mysql2/promise';

export default async function runMigration248FinSolidconVisionPermissions(): Promise<void> {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_248_fin_solidcon_vision_permissions');

        await conn.beginTransaction();

        const roles = ['admin', 'super_admin', 'supervisor', 'admin_basic', 'financial', 'solidcon', 'accountant', 'auxiliar_contador'];
        for (const role of roles) {
            await conn.query(`
                INSERT INTO role_permissions (company_id, role, module, can_view)
                SELECT c.id, ?, 'fin_solidcon_vision', 1
                FROM companies c
                ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
            `, [role]);
        }

        await conn.commit();
        logger.info('Migration run_migration_248_fin_solidcon_vision_permissions finished successfully!');
    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch {}
        }
        logger.error({ err }, 'Failed to run migration: run_migration_248_fin_solidcon_vision_permissions');
    } finally {
        if (conn) conn.release();
    }
}

if (require.main === module) {
    runMigration248FinSolidconVisionPermissions().then(() => process.exit(0));
}
