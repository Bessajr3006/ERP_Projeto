import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration178AddActiveToProducts() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_178_add_active_to_products');

        // Check if active column exists in products table
        const [columns] = await pool.query<any[]>(
            `SHOW COLUMNS FROM products LIKE 'active'`
        );

        if (columns.length === 0) {
            await pool.query(
                `ALTER TABLE products ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1`
            );
            logger.info('Column active added to products table.');
        } else {
            logger.info('Column active already exists in products table.');
        }

        logger.info('Migration run_migration_178_add_active_to_products finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_178_add_active_to_products');
    } finally {
        conn?.release();
    }
}
