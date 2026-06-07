import pool from '../config/db';
import logger from '../config/logger';

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
    const [rows] = await pool.query<any[]>(
        `SELECT COUNT(*) AS count
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?`,
        [tableName, columnName]
    );

    return Array.isArray(rows) && rows[0] && Number(rows[0].count) > 0;
}

async function indexExists(tableName: string, indexName: string): Promise<boolean> {
    const [rows] = await pool.query<any[]>(
        `SELECT COUNT(*) AS count
         FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND INDEX_NAME = ?`,
        [tableName, indexName]
    );

    return Array.isArray(rows) && rows[0] && Number(rows[0].count) > 0;
}

export default async function runMigration() {
    let conn;
    try {
        conn = await pool.getConnection();

        logger.info('Running migration: run_migration_55_soft_delete_sales_picking');

        if (!(await columnExists('sales_orders', 'is_deleted'))) {
            await conn.query(`
                ALTER TABLE sales_orders
                ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0 AFTER delivery_address
            `);
        }

        if (!(await columnExists('sales_items', 'is_deleted'))) {
            await conn.query(`
                ALTER TABLE sales_items
                ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0 AFTER total_price
            `);
        }

        if (!(await indexExists('sales_orders', 'idx_sales_orders_company_deleted'))) {
            await conn.query('CREATE INDEX idx_sales_orders_company_deleted ON sales_orders(company_id, is_deleted)');
        }

        if (!(await indexExists('sales_items', 'idx_sales_items_sale_deleted'))) {
            await conn.query('CREATE INDEX idx_sales_items_sale_deleted ON sales_items(sale_id, is_deleted)');
        }

        logger.info('Migration run_migration_55_soft_delete_sales_picking finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_55_soft_delete_sales_picking');
        throw err;
    } finally {
        if (conn) conn.release();
    }
}