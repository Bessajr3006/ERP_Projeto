import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration75ServiceLaunchesNfseStatus() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_75_service_launches_nfse_status');

        await conn.query(`
            ALTER TABLE service_launches
            ADD COLUMN IF NOT EXISTS nfse_status VARCHAR(20) NOT NULL DEFAULT 'draft',
            ADD COLUMN IF NOT EXISTS nfse_number VARCHAR(20) DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS nfse_verification_code VARCHAR(20) DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS nfse_issued_at TIMESTAMP DEFAULT NULL
        `);

        logger.info('Migration run_migration_75_service_launches_nfse_status finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_75_service_launches_nfse_status');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration75ServiceLaunchesNfseStatus()
        .catch((err) => {
            logger.error({ err }, 'Migration 75 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
