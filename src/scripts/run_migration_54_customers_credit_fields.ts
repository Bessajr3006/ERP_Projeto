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

export default async function runMigration() {
    let conn;
    try {
        conn = await pool.getConnection();

        logger.info('Running migration: run_migration_54_customers_credit_fields');

        const hasDueDay = await columnExists('customers', 'vencimento_dia');
        if (!hasDueDay) {
            await conn.query(`
                ALTER TABLE customers
                ADD COLUMN vencimento_dia TINYINT DEFAULT NULL COMMENT 'Dia do mes para vencimento (1-31)' AFTER phone
            `);
        }

        const hasLimit = await columnExists('customers', 'limite');
        if (!hasLimit) {
            await conn.query(`
                ALTER TABLE customers
                ADD COLUMN limite DECIMAL(15, 2) NOT NULL DEFAULT 0.00 COMMENT 'Limite de credito' AFTER vencimento_dia
            `);
        }

        logger.info('Migration run_migration_54_customers_credit_fields finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_54_customers_credit_fields');
        throw err;
    } finally {
        if (conn) conn.release();
    }
}