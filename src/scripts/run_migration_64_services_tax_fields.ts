import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration64ServicesTaxFields() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_64_services_tax_fields');

        await conn.query(`
            ALTER TABLE services
                ADD COLUMN IF NOT EXISTS national_tax_code VARCHAR(30) DEFAULT NULL AFTER description,
                ADD COLUMN IF NOT EXISTS municipal_tax_code VARCHAR(30) DEFAULT NULL AFTER national_tax_code,
                ADD COLUMN IF NOT EXISTS nbs_item VARCHAR(30) DEFAULT NULL AFTER municipal_tax_code;
        `);

        logger.info('Migration run_migration_64_services_tax_fields finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_64_services_tax_fields');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration64ServicesTaxFields()
        .catch((err) => {
            logger.error({ err }, 'Migration 64 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
