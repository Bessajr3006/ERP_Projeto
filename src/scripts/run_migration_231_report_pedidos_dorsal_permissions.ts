import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';
import { PoolConnection } from 'mysql2/promise';

export async function runMigration231ReportPedidosDorsalPermissions() {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_231_report_pedidos_dorsal_permissions');

        await conn.beginTransaction();

        // Seed role permissions for 'rel_pedido_dorsal'
        const roles = ['admin', 'super_admin', 'supervisor', 'admin_basic', 'financial', 'solidcon'];
        for (const role of roles) {
            await conn.query(`
                INSERT INTO role_permissions (company_id, role, module, can_view)
                SELECT c.id, ?, 'rel_pedido_dorsal', 1
                FROM companies c
                ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
            `, [role]);
        }

        await conn.commit();
        logger.info('Migration run_migration_231_report_pedidos_dorsal_permissions finished successfully!');
    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (rbErr) {
                logger.error({ err: rbErr }, 'Failed to rollback migration 231');
            }
        }
        logger.error({ err }, 'Failed to run migration: run_migration_231_report_pedidos_dorsal_permissions');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration231ReportPedidosDorsalPermissions()
        .catch((err) => {
            logger.error({ err }, 'Migration 231 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
