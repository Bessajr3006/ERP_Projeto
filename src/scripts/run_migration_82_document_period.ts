import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration82() {
    try {
        const conn = await pool.getConnection();

        logger.info('Starting migration: 82 - Add document_period to customer_declarations');

        try {
            const [cols]: any = await conn.query(`SHOW COLUMNS FROM customer_declarations LIKE 'document_period'`);
            if (cols.length === 0) {
                await conn.query(`
                    ALTER TABLE customer_declarations 
                    ADD COLUMN document_period VARCHAR(20) NULL
                `);
                logger.info('Added document_period column to customer_declarations table.');
            } else {
                logger.info('Column document_period already exists.');
            }

            const migrationName = '82';
            await conn.query(
                `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
                [migrationName, 'Add document_period']
            );

        } finally {
            conn.release();
        }

        logger.info('Migration 82 finished successfully.');
    } catch (error) {
        logger.error('Error running migration 82: ' + (error instanceof Error ? error.message : String(error)));
        throw error;
    }
}

if (require.main === module) {
    runMigration82().then(() => process.exit(0)).catch(() => process.exit(1));
}
