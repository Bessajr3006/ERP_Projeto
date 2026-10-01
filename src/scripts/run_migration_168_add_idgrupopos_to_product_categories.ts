import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration168AddIdgrupoposToProductCategories() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_168_add_idgrupopos_to_product_categories');

        // Check if idgrupopos column exists in product_categories table
        const [columns] = await pool.query<any[]>(
            `SHOW COLUMNS FROM product_categories LIKE 'idgrupopos'`
        );

        if (columns.length === 0) {
            await pool.query(
                `ALTER TABLE product_categories ADD COLUMN idgrupopos VARCHAR(255) DEFAULT NULL`
            );
            logger.info('Column idgrupopos added to product_categories table.');
        } else {
            logger.info('Column idgrupopos already exists in product_categories table.');
        }

        logger.info('Migration run_migration_168_add_idgrupopos_to_product_categories finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_168_add_idgrupopos_to_product_categories');
    } finally {
        conn?.release();
    }
}
