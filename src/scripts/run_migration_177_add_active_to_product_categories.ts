import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration177AddActiveToProductCategories() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_177_add_active_to_product_categories');

        // Check if active column exists in product_categories table
        const [columns] = await pool.query<any[]>(
            `SHOW COLUMNS FROM product_categories LIKE 'active'`
        );

        if (columns.length === 0) {
            await pool.query(
                `ALTER TABLE product_categories ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1`
            );
            logger.info('Column active added to product_categories table.');
        } else {
            logger.info('Column active already exists in product_categories table.');
        }

        logger.info('Migration run_migration_177_add_active_to_product_categories finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_177_add_active_to_product_categories');
    } finally {
        conn?.release();
    }
}
