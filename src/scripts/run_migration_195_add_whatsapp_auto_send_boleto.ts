import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration195AddWhatsappAutoSendBoleto() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_195_add_whatsapp_auto_send_boleto');

        // 1. Check/Add whatsapp_auto_send_boleto on users
        const [userColumns] = await conn.query(`
            SHOW COLUMNS FROM users LIKE 'whatsapp_auto_send_boleto'
        `);

        if (Array.isArray(userColumns) && userColumns.length > 0) {
            logger.info('[SKIP] users.whatsapp_auto_send_boleto already exists');
        } else {
            await conn.query(`
                ALTER TABLE users 
                ADD COLUMN whatsapp_auto_send_boleto TINYINT(1) NOT NULL DEFAULT 0
            `);
            logger.info('[OK] users.whatsapp_auto_send_boleto added successfully');
        }

        // 2. Check/Add whatsapp_sent on transactions
        const [txColumns] = await conn.query(`
            SHOW COLUMNS FROM transactions LIKE 'whatsapp_sent'
        `);

        if (Array.isArray(txColumns) && txColumns.length > 0) {
            logger.info('[SKIP] transactions.whatsapp_sent already exists');
        } else {
            await conn.query(`
                ALTER TABLE transactions 
                ADD COLUMN whatsapp_sent TINYINT(1) NOT NULL DEFAULT 0
            `);
            logger.info('[OK] transactions.whatsapp_sent added successfully');
        }

        logger.info('Migration run_migration_195_add_whatsapp_auto_send_boleto finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_195_add_whatsapp_auto_send_boleto');
    } finally {
        conn?.release();
    }
}
