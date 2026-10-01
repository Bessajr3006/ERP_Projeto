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

export async function runMigration187AddDateLaunchToTransactions(): Promise<void> {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_187_add_date_launch_to_transactions');

        if (!(await columnExists('transactions', 'date_launch'))) {
            logger.info('Adding date_launch column to transactions...');
            await pool.query(`
                ALTER TABLE transactions 
                ADD COLUMN date_launch DATE DEFAULT NULL AFTER date;
            `);
            // Initialize date_launch with date value for existing rows
            await pool.query(`
                UPDATE transactions SET date_launch = date;
            `);
        }

        logger.info('Migration run_migration_187_add_date_launch_to_transactions finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_187_add_date_launch_to_transactions');
    } finally {
        conn?.release();
    }
}
