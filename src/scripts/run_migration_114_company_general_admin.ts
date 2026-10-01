import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration114() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_114_company_general_admin');

        await conn.query(`
            ALTER TABLE companies
                ADD COLUMN IF NOT EXISTS is_general_admin BOOLEAN NOT NULL DEFAULT FALSE AFTER is_system;
        `);

        logger.info('Migration run_migration_114_company_general_admin finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_114_company_general_admin');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration114()
        .catch((err) => {
            logger.error({ err }, 'Migration 114 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
