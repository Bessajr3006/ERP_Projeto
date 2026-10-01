import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration164RecreateEnemStudentsWithFullNames() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_164_recreate_enem_students_with_full_names');

        // Delete all current students so they can be regenerated dynamically with full names (First + Middle + Last name)
        await pool.query(`DELETE FROM ibge_enem_students`);
        logger.info('Successfully cleared ibge_enem_students to allow dynamic regeneration with full names.');
    } catch (error) {
        logger.error({ err: error }, 'Error in runMigration164RecreateEnemStudentsWithFullNames');
        throw error;
    } finally {
        if (conn) conn.release();
    }
}
