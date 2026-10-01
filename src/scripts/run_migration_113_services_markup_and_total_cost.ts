import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration113() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_113_services_markup_and_total_cost');

        await conn.query(`
            ALTER TABLE services
                ADD COLUMN IF NOT EXISTS total_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER tax_amount,
                ADD COLUMN IF NOT EXISTS markup DECIMAL(5, 2) NOT NULL DEFAULT 0.00 AFTER total_cost;
        `);

        logger.info('Migration run_migration_113_services_markup_and_total_cost finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_113_services_markup_and_total_cost');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration113()
        .catch((err) => {
            logger.error({ err }, 'Migration 113 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
