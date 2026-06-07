import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration() {
    let conn;
    try {
        conn = await pool.getConnection();

        logger.info('Running migration: run_migration_44_chart_of_accounts_easy_code');

        try {
            await conn.query(`
                ALTER TABLE chart_of_accounts 
                ADD COLUMN easy_code VARCHAR(50) DEFAULT NULL AFTER public_id;
            `);
        } catch(el: any) {
            if (el.code !== 'ER_DUP_FIELDNAME') {
                throw el;
            }
        }

        logger.info('Added easy_code column to chart_of_accounts table successfully.');

    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_44_chart_of_accounts_easy_code');
        throw err;
    } finally {
        if (conn) conn.release();
    }
}
