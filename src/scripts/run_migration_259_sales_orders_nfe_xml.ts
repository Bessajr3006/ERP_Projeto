import pool from '../config/db';
import logger from '../config/logger';

async function tableExists(conn: any, tableName: string): Promise<boolean> {
    try {
        const [rows]: any = await conn.query(`SHOW TABLES LIKE ?`, [tableName]);
        return Array.isArray(rows) && rows.length > 0;
    } catch {
        return false;
    }
}

export async function runMigration259SalesOrdersNfeXml(): Promise<void> {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_259_sales_orders_nfe_xml');

        if (await tableExists(conn, 'sales_orders')) {
            try {
                const [cols]: any = await conn.query(`SHOW COLUMNS FROM sales_orders LIKE 'nfe_xml'`);
                if (!Array.isArray(cols) || cols.length === 0) {
                    await conn.query(`
                        ALTER TABLE sales_orders
                        ADD COLUMN nfe_xml LONGTEXT DEFAULT NULL AFTER nfe_header_json;
                    `);
                    logger.info('[OK] Added nfe_xml column to sales_orders table');
                } else {
                    logger.info('[SKIP] Column nfe_xml already exists in sales_orders table');
                }
            } catch (e: any) {
                logger.warn({ err: e }, '[WARN] Failed or already added nfe_xml to sales_orders');
            }
        }

        logger.info('Migration run_migration_259_sales_orders_nfe_xml finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_259_sales_orders_nfe_xml');
        throw err;
    } finally {
        conn?.release();
    }
}

export default runMigration259SalesOrdersNfeXml;

if (require.main === module) {
    runMigration259SalesOrdersNfeXml()
        .catch((err) => {
            logger.error({ err }, 'Migration 259 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
