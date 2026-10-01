import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration112() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_112_services_cost_and_tax');

        await conn.query(`
            ALTER TABLE services
                ADD COLUMN IF NOT EXISTS cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER name,
                ADD COLUMN IF NOT EXISTS tax_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.00 AFTER cost,
                ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER tax_percent;
        `);

        logger.info('Migration run_migration_112_services_cost_and_tax finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_112_services_cost_and_tax');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration112()
        .catch((err) => {
            logger.error({ err }, 'Migration 112 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
