import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration85() {
    try {
        const conn = await pool.getConnection();

        logger.info('Starting migration: 85 - Add tax_regime to declaration_types table');

        try {
            await conn.query(`
                ALTER TABLE declaration_types 
                ADD COLUMN IF NOT EXISTS tax_regime VARCHAR(50) NULL;
            `);
            logger.info('Added tax_regime column to declaration_types table.');

            const migrationName = '85';
            await conn.query(
                `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
                [migrationName, 'Add tax_regime to declaration_types']
            );

        } finally {
            conn.release();
        }

        logger.info('Migration 85 finished successfully.');
    } catch (error) {
        logger.error({ err: error }, 'Error running migration 85');
        throw error;
    }
}

if (require.main === module) {
    runMigration85().then(() => process.exit(0)).catch(() => process.exit(1));
}
