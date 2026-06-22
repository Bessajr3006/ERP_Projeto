import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration(): Promise<void> {
    let conn;
    try {
        conn = await pool.getConnection();

        logger.info('Running migration: run_migration_86_quote_status');

        // Adiciona o status 'quote' no ENUM de sales_orders
        await conn.query(`
            ALTER TABLE sales_orders
            MODIFY COLUMN status
                ENUM('quote', 'pending', 'progress', 'completed', 'cancelled', 'separated', 'invoiced')
                NOT NULL DEFAULT 'pending'
        `);

        logger.info('Migration run_migration_86_quote_status finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_86_quote_status');
        throw err;
    } finally {
        if (conn) conn.release();
    }
}
