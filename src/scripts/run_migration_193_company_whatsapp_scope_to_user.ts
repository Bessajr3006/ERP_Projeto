import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration193CompanyWhatsappScopeToUser() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_193_company_whatsapp_scope_to_user');

        // Update all existing companies to use 'user' scope for WhatsApp
        await pool.query(`
            UPDATE companies 
            SET whatsapp_business_scope = 'user'
        `);

        // Change column default to 'user'
        await pool.query(`
            ALTER TABLE companies 
            MODIFY COLUMN whatsapp_business_scope ENUM('company', 'user') NOT NULL DEFAULT 'user'
        `);

        logger.info('Migration run_migration_193_company_whatsapp_scope_to_user finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_193_company_whatsapp_scope_to_user');
    } finally {
        conn?.release();
    }
}
