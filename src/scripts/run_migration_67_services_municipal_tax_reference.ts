import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration67ServicesMunicipalTaxReference() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_67_services_municipal_tax_reference');

        await conn.query(`
            ALTER TABLE services
                ADD COLUMN IF NOT EXISTS municipal_tax_reference_id VARCHAR(64) DEFAULT NULL AFTER service_type_id,
                ADD COLUMN IF NOT EXISTS municipal_tax_reference_name VARCHAR(150) DEFAULT NULL AFTER municipal_tax_reference_id
        `);

        logger.info('Migration run_migration_67_services_municipal_tax_reference finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_67_services_municipal_tax_reference');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration67ServicesMunicipalTaxReference()
        .catch((err) => {
            logger.error({ err }, 'Migration 67 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
