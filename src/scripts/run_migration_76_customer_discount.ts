import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration76CustomerDiscount() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_76_customer_discount');

        await conn.query(`
            ALTER TABLE customers
            ADD COLUMN IF NOT EXISTS discount_type ENUM('percentage', 'fixed') DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10,2) DEFAULT NULL
        `);

        logger.info('Migration run_migration_76_customer_discount finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_76_customer_discount');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration76CustomerDiscount()
        .catch((err) => {
            logger.error({ err }, 'Migration 76 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
