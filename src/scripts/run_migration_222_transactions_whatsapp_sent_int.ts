import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration222TransactionsWhatsappSentInt() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_222_transactions_whatsapp_sent_int');

        // Check if whatsapp_sent column exists, ensure it is INT NOT NULL DEFAULT 0
        const [columns]: any = await conn.query(`
            SHOW COLUMNS FROM transactions LIKE 'whatsapp_sent'
        `);

        if (Array.isArray(columns) && columns.length > 0) {
            await conn.query(`
                ALTER TABLE transactions 
                MODIFY COLUMN whatsapp_sent INT NOT NULL DEFAULT 0
            `);
            logger.info('[OK] transactions.whatsapp_sent modified to INT NOT NULL DEFAULT 0');
        } else {
            await conn.query(`
                ALTER TABLE transactions 
                ADD COLUMN whatsapp_sent INT NOT NULL DEFAULT 0
            `);
            logger.info('[OK] transactions.whatsapp_sent added as INT NOT NULL DEFAULT 0');
        }

        logger.info('Migration run_migration_222_transactions_whatsapp_sent_int finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_222_transactions_whatsapp_sent_int');
    } finally {
        conn?.release();
    }
}
