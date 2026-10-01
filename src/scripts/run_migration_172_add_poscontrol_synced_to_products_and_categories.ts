import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration172AddPoscontrolSyncedToProductsAndCategories() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_172_add_poscontrol_synced_to_products_and_categories');

        // Check if column exists in products
        const [prodCols] = await pool.query<any[]>(
            `SHOW COLUMNS FROM products LIKE 'poscontrol_synced'`
        );
        if (prodCols.length === 0) {
            await pool.query(
                `ALTER TABLE products ADD COLUMN poscontrol_synced TINYINT(1) DEFAULT 0`
            );
            logger.info('Column poscontrol_synced added to products.');
        }

        // Check if column exists in product_categories
        const [catCols] = await pool.query<any[]>(
            `SHOW COLUMNS FROM product_categories LIKE 'poscontrol_synced'`
        );
        if (catCols.length === 0) {
            await pool.query(
                `ALTER TABLE product_categories ADD COLUMN poscontrol_synced TINYINT(1) DEFAULT 0`
            );
            logger.info('Column poscontrol_synced added to product_categories.');
        }

        logger.info('Migration run_migration_172_add_poscontrol_synced_to_products_and_categories finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_172_add_poscontrol_synced_to_products_and_categories');
    } finally {
        conn?.release();
    }
}
