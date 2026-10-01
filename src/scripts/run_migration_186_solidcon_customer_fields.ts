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

export async function runMigration186SolidconCustomerFields(): Promise<void> {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_186_solidcon_customer_fields');

        if (!(await columnExists('companies', 'solidcon_customer_cpf'))) {
            logger.info('Adding solidcon_customer_cpf column to companies...');
            await pool.query(`
                ALTER TABLE companies 
                ADD COLUMN solidcon_customer_cpf VARCHAR(20) DEFAULT NULL AFTER solidcon_url_5;
            `);
        }

        if (!(await columnExists('companies', 'solidcon_customer_name'))) {
            logger.info('Adding solidcon_customer_name column to companies...');
            await pool.query(`
                ALTER TABLE companies 
                ADD COLUMN solidcon_customer_name VARCHAR(255) DEFAULT NULL AFTER solidcon_customer_cpf;
            `);
        }

        logger.info('Migration run_migration_186_solidcon_customer_fields finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_186_solidcon_customer_fields');
    } finally {
        conn?.release();
    }
}
