import pool from '../config/db';
import logger from '../config/logger';

/**
 * Migration 60:
 * - Adiciona campos de metadata da NFe em sales_orders
 * - Adiciona campo com dados originais do item XML em sales_items
 */
export default async function runMigration(): Promise<void> {
    let conn;

    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_60_sales_nfe_xml_fields');

        await conn.query(`
            ALTER TABLE sales_orders
            ADD COLUMN IF NOT EXISTS nfe_key VARCHAR(44) NULL AFTER date
        `);

        await conn.query(`
            ALTER TABLE sales_orders
            ADD COLUMN IF NOT EXISTS nfe_issue_date DATE NULL AFTER nfe_key
        `);

        await conn.query(`
            ALTER TABLE sales_orders
            ADD COLUMN IF NOT EXISTS nfe_header_json LONGTEXT NULL AFTER nfe_issue_date
        `);

        await conn.query(`
            ALTER TABLE sales_items
            ADD COLUMN IF NOT EXISTS xml_item_data LONGTEXT NULL AFTER total_price
        `);

        logger.info('Migration run_migration_60_sales_nfe_xml_fields finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_60_sales_nfe_xml_fields');
        throw err;
    } finally {
        if (conn) conn.release();
    }
}
