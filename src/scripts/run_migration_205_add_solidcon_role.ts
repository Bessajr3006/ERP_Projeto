import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';
import { PoolConnection } from 'mysql2/promise';

export async function runMigration205AddSolidconRole() {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_205_add_solidcon_role');

        await conn.beginTransaction();

        // 1. Seed 'solidcon' role in the roles table for all existing companies
        await conn.query(`
            INSERT IGNORE INTO roles (public_id, company_id, name, slug, description)
            SELECT UUID(), id, 'Solidcon', 'solidcon', 'Perfil Solidcon'
            FROM companies
        `);

        // 2. Grant default permissions ('dashboard' and 'rel_rafael') to the 'solidcon' role for all companies
        await conn.query(`
            INSERT INTO role_permissions (company_id, role, module, can_view)
            SELECT id, 'solidcon', 'dashboard', 1 FROM companies
            UNION
            SELECT id, 'solidcon', 'rel_rafael', 1 FROM companies
            ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
        `);

        await conn.commit();
        logger.info('Migration run_migration_205_add_solidcon_role finished successfully!');
    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (rbErr) {
                logger.error({ err: rbErr }, 'Failed to rollback migration 205');
            }
        }
        logger.error({ err }, 'Failed to run migration: run_migration_205_add_solidcon_role');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration205AddSolidconRole()
        .catch((err) => {
            logger.error({ err }, 'Migration 205 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
