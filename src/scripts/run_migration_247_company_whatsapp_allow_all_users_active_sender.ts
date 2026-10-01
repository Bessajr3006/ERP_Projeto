import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration247CompanyWhatsappAllowAllUsersActiveSender() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_247_company_whatsapp_allow_all_users_active_sender');

        const [cols] = await conn.query<any[]>(
            `SHOW COLUMNS FROM companies LIKE 'whatsapp_allow_all_users_active_sender'`
        );

        if (cols.length === 0) {
            await conn.query(`
                ALTER TABLE companies 
                ADD COLUMN whatsapp_allow_all_users_active_sender TINYINT(1) NOT NULL DEFAULT 1
            `);
            logger.info('Column whatsapp_allow_all_users_active_sender added to companies table.');
        } else {
            logger.info('Column whatsapp_allow_all_users_active_sender already exists in companies table.');
        }

        await conn.query(`
            UPDATE companies 
            SET whatsapp_allow_all_users_active_sender = 1 
            WHERE whatsapp_allow_all_users_active_sender IS NULL
        `);

        logger.info('Migration run_migration_247_company_whatsapp_allow_all_users_active_sender finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_247_company_whatsapp_allow_all_users_active_sender');
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration247CompanyWhatsappAllowAllUsersActiveSender()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
