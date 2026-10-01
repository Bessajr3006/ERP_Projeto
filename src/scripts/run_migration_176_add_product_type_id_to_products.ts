import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration176AddProductTypeIdToProducts() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_176_add_product_type_id_to_products');

        // Check if product_type_id column exists in products table
        const [columns] = await pool.query<any[]>(
            `SHOW COLUMNS FROM products LIKE 'product_type_id'`
        );

        if (columns.length === 0) {
            // Add column
            await pool.query(
                `ALTER TABLE products ADD COLUMN product_type_id INT NULL DEFAULT NULL AFTER stock_type_id`
            );
            logger.info('Column product_type_id added to products table.');

            // Add index
            await pool.query(
                `CREATE INDEX idx_products_product_type_id ON products (product_type_id)`
            );
            logger.info('Index idx_products_product_type_id created on products table.');

            // Add foreign key constraint
            try {
                await pool.query(
                    `ALTER TABLE products ADD CONSTRAINT fk_products_product_type FOREIGN KEY (product_type_id) REFERENCES product_types(id) ON DELETE SET NULL`
                );
                logger.info('Foreign key constraint fk_products_product_type added to products table.');
            } catch (fkErr: any) {
                logger.warn({ err: fkErr }, 'Failed to add foreign key fk_products_product_type. Continuing anyway.');
            }
        } else {
            logger.info('Column product_type_id already exists in products table.');
        }

        logger.info('Migration run_migration_176_add_product_type_id_to_products finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_176_add_product_type_id_to_products');
    } finally {
        conn?.release();
    }
}
