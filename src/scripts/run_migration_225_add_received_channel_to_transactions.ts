import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration225AddReceivedChannelToTransactions() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_225_add_received_channel_to_transactions');

        const [columns]: any = await conn.query(
            `SHOW COLUMNS FROM transactions LIKE 'received_channel'`
        );
        if (!Array.isArray(columns) || columns.length === 0) {
            await conn.query(`
                ALTER TABLE transactions 
                ADD COLUMN received_channel VARCHAR(30) NULL DEFAULT NULL AFTER received_at
            `);
            logger.info('Column received_channel added to transactions.');
        }

        logger.info('Migration run_migration_225_add_received_channel_to_transactions finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_225_add_received_channel_to_transactions');
    } finally {
        conn?.release();
    }
}
