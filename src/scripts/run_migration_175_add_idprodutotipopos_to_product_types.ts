import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration175AddIdprodutotipoposToProductTypes() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_175_add_idprodutotipopos_to_product_types');

        // Check if idprodutotipopos column exists in product_types table
        const [columns] = await pool.query<any[]>(
            `SHOW COLUMNS FROM product_types LIKE 'idprodutotipopos'`
        );

        if (columns.length === 0) {
            await pool.query(
                `ALTER TABLE product_types ADD COLUMN idprodutotipopos VARCHAR(255) DEFAULT NULL`
            );
            logger.info('Column idprodutotipopos added to product_types table.');
        } else {
            logger.info('Column idprodutotipopos already exists in product_types table.');
        }

        logger.info('Migration run_migration_175_add_idprodutotipopos_to_product_types finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_175_add_idprodutotipopos_to_product_types');
    } finally {
        conn?.release();
    }
}
