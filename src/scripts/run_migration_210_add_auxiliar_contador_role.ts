import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';
import { PoolConnection } from 'mysql2/promise';

export async function runMigration210AddAuxiliarContadorRole() {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_210_add_auxiliar_contador_role');

        await conn.beginTransaction();

        // 1. Seed 'auxiliar_contador' role in the roles table for all existing companies
        await conn.query(`
            INSERT IGNORE INTO roles (public_id, company_id, name, slug, description)
            SELECT UUID(), id, 'Auxiliar-Contador', 'auxiliar_contador', 'Perfil de auxiliar de contador'
            FROM companies
        `);

        // 2. Grant default permissions to the 'auxiliar_contador' role for all companies
        await conn.query(`
            INSERT INTO role_permissions (company_id, role, module, can_view)
            SELECT id, 'auxiliar_contador', 'dashboard', 1 FROM companies
            UNION
            SELECT id, 'auxiliar_contador', 'company', 1 FROM companies
            UNION
            SELECT id, 'auxiliar_contador', 'fechamento', 1 FROM companies
            UNION
            SELECT id, 'auxiliar_contador', 'census-vision', 1 FROM companies
            UNION
            SELECT id, 'auxiliar_contador', 'mec-vision', 1 FROM companies
            ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
        `);

        await conn.commit();
        logger.info('Migration run_migration_210_add_auxiliar_contador_role finished successfully!');
    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (rbErr) {
                logger.error({ err: rbErr }, 'Failed to rollback migration 210');
            }
        }
        logger.error({ err }, 'Failed to run migration: run_migration_210_add_auxiliar_contador_role');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration210AddAuxiliarContadorRole()
        .catch((err) => {
            logger.error({ err }, 'Migration 210 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
