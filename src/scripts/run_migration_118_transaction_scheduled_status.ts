import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration118() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_118_transaction_scheduled_status');

        logger.info('Modifying status column and adding scheduled_at to transactions table...');
        
        // 1. Modify enum to include 'scheduled'
        await pool.query(`
            ALTER TABLE transactions 
            MODIFY COLUMN status ENUM('pending', 'progress', 'paid', 'cancelled', 'scheduled') NOT NULL DEFAULT 'pending';
        `);

        // 2. Add scheduled_at column if it does not exist
        const [columns] = await pool.query<any[]>(
            `SELECT COUNT(*) AS count
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'transactions'
               AND COLUMN_NAME = 'scheduled_at'`
        );
        const exists = Array.isArray(columns) && columns[0] && Number(columns[0].count) > 0;
        if (!exists) {
            await pool.query(`
                ALTER TABLE transactions 
                ADD COLUMN scheduled_at DATETIME NULL AFTER received_at;
            `);
        }

        logger.info('Migration run_migration_118_transaction_scheduled_status finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_118_transaction_scheduled_status');
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration118()
        .catch((err) => {
            logger.error({ err }, 'Migration 118 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
