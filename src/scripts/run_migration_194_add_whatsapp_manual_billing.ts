import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration194AddWhatsappManualBilling() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_194_add_whatsapp_manual_billing');

        const [columns] = await conn.query(`
            SHOW COLUMNS FROM users LIKE 'whatsapp_enable_manual_billing'
        `);

        if (Array.isArray(columns) && columns.length > 0) {
            logger.info('[SKIP] users.whatsapp_enable_manual_billing already exists');
        } else {
            await conn.query(`
                ALTER TABLE users 
                ADD COLUMN whatsapp_enable_manual_billing TINYINT(1) NOT NULL DEFAULT 1
            `);
            logger.info('[OK] users.whatsapp_enable_manual_billing added successfully');
        }

        await conn.query(`
            UPDATE users 
            SET whatsapp_enable_manual_billing = 1 
            WHERE whatsapp_enable_manual_billing IS NULL 
               OR (whatsapp_enable_manual_billing = 0 AND role IN ('admin', 'super_admin', 'supervisor', 'financial', 'user'))
        `);

        logger.info('Migration run_migration_194_add_whatsapp_manual_billing finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_194_add_whatsapp_manual_billing');
    } finally {
        conn?.release();
    }
}
