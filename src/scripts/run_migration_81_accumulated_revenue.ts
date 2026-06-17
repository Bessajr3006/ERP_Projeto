import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration81() {
    try {
        const conn = await pool.getConnection();

        logger.info('Starting migration: 81 - Add accumulated_revenue to customer_declarations');

        try {
            const [cols]: any = await conn.query(`SHOW COLUMNS FROM customer_declarations LIKE 'accumulated_revenue'`);
            if (cols.length === 0) {
                await conn.query(`
                    ALTER TABLE customer_declarations 
                    ADD COLUMN accumulated_revenue DECIMAL(15,2) NULL
                `);
                logger.info('Added accumulated_revenue column to customer_declarations table.');
            } else {
                logger.info('Column accumulated_revenue already exists.');
            }

            const migrationName = '81';
            await conn.query(
                `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
                [migrationName, 'Add accumulated_revenue']
            );

        } finally {
            conn.release();
        }

        logger.info('Migration 81 finished successfully.');
    } catch (error) {
        logger.error('Error running migration 81: ' + (error instanceof Error ? error.message : String(error)));
        throw error;
    }
}

if (require.main === module) {
    runMigration81().then(() => process.exit(0)).catch(() => process.exit(1));
}
