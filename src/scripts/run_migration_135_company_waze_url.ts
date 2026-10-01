import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration135() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_135_company_waze_url');

        await conn.query(`
            ALTER TABLE companies
                ADD COLUMN IF NOT EXISTS waze_url VARCHAR(255) NULL;
        `);

        logger.info('Migration run_migration_135_company_waze_url finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_135_company_waze_url');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration135()
        .catch((err) => {
            logger.error({ err }, 'Migration 135 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
