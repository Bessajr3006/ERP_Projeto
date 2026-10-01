import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';
import { PoolConnection } from 'mysql2/promise';

export async function runMigration232ReportSaldoBancoPermissions() {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_232_report_saldo_banco_permissions');

        await conn.beginTransaction();

        // Seed role permissions for 'rel_saldo_banco'
        const roles = ['admin', 'super_admin', 'supervisor', 'admin_basic', 'financial', 'operator', 'solidcon'];
        for (const role of roles) {
            await conn.query(`
                INSERT INTO role_permissions (company_id, role, module, can_view)
                SELECT c.id, ?, 'rel_saldo_banco', 1
                FROM companies c
                ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
            `, [role]);
        }

        await conn.commit();
        logger.info('Migration run_migration_232_report_saldo_banco_permissions finished successfully!');
    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (rbErr) {
                logger.error({ err: rbErr }, 'Failed to rollback migration 232');
            }
        }
        logger.error({ err }, 'Failed to run migration: run_migration_232_report_saldo_banco_permissions');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration232ReportSaldoBancoPermissions()
        .catch((err) => {
            logger.error({ err }, 'Migration 232 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
