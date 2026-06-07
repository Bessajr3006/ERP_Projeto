import pool from '../config/db';
import logger from '../config/logger';

async function runMigration() {
    logger.info('Running migration: Add nature column to Chart of Accounts');
    
    const conn = await pool.getConnection();
    try {
        await conn.query(`
            ALTER TABLE chart_of_accounts 
            ADD COLUMN IF NOT EXISTS nature ENUM('debit', 'credit') NOT NULL DEFAULT 'debit' AFTER type
        `);
        logger.info('Migration run_migration_42_nature finished successfully!');
    } catch (error) {
        if ((error as any).code === 'ER_DUP_FIELDNAME') {
            logger.info('Column already exists!');
        } else {
            logger.error('Migration failed: ' + error);
        }
    } finally {
        conn.release();
    }
}

export default runMigration;
