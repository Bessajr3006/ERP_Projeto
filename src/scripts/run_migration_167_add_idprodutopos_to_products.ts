import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration167AddIdprodutoposToProducts() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_167_add_idprodutopos_to_products');

        // Check if idprodutopos column exists in products table
        const [columns] = await pool.query<any[]>(
            `SHOW COLUMNS FROM products LIKE 'idprodutopos'`
        );

        if (columns.length === 0) {
            await pool.query(
                `ALTER TABLE products ADD COLUMN idprodutopos VARCHAR(255) DEFAULT NULL`
            );
            logger.info('Column idprodutopos added to products table.');
        } else {
            logger.info('Column idprodutopos already exists in products table.');
        }

        logger.info('Migration run_migration_167_add_idprodutopos_to_products finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_167_add_idprodutopos_to_products');
    } finally {
        conn?.release();
    }
}
