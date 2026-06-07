import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration74ProductStockType() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_74_product_stock_type');

        await conn.query(`
            ALTER TABLE products
            ADD COLUMN IF NOT EXISTS stock_type_id INT NULL AFTER category_id
        `);

        await conn.query(`
            CREATE INDEX IF NOT EXISTS idx_products_stock_type_id ON products (stock_type_id)
        `);

        logger.info('Migration run_migration_74_product_stock_type finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_74_product_stock_type');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration74ProductStockType()
        .catch((err) => {
            logger.error({ err }, 'Migration 74 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
