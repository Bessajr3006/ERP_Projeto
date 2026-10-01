import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration228AddSolidconInterestKeyToTransactions(): Promise<void> {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Starting migration: 228 - Add solidcon_interest_key column to transactions');

        const [columns]: any = await conn.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'transactions' 
              AND COLUMN_NAME = 'solidcon_interest_key'
        `);

        if (!columns || columns.length === 0) {
            await conn.query(`
                ALTER TABLE transactions 
                ADD COLUMN solidcon_interest_key VARCHAR(50) DEFAULT NULL AFTER solidcon_key;
            `);
            logger.info('Migration 228: Column solidcon_interest_key added to transactions table.');
        } else {
            logger.info('Migration 228: Column solidcon_interest_key already exists on transactions.');
        }
    } catch (error: any) {
        logger.error({ err: error }, 'Error running migration 228: ' + error.message);
    } finally {
        conn?.release();
    }
}

export default runMigration228AddSolidconInterestKeyToTransactions;

if (require.main === module) {
    runMigration228AddSolidconInterestKeyToTransactions().then(() => process.exit(0)).catch(() => process.exit(1));
}
