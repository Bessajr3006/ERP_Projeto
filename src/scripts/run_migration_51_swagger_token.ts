import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration() {
    let conn;
    try {
        conn = await pool.getConnection();

        logger.info('Running migration: run_migration_51_swagger_token');

        const [rows] = await conn.query<any[]>(
            `SELECT COUNT(*) AS count
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'companies'
               AND COLUMN_NAME = 'swagger_api_token'`
        );

        const exists = Array.isArray(rows) && rows[0] && Number(rows[0].count) > 0;
        if (!exists) {
            await conn.query(`
                ALTER TABLE companies
                ADD COLUMN swagger_api_token TEXT DEFAULT NULL AFTER api_token
            `);
        }

        logger.info('Migration run_migration_51_swagger_token finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_51_swagger_token');
        throw err;
    } finally {
        if (conn) conn.release();
    }
}
