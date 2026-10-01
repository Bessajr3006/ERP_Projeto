import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration192UserRoleToVarchar() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_192_user_role_to_varchar');

        // Modify users.role column from ENUM to VARCHAR(50) to allow new custom roles dynamically
        await pool.query(`
            ALTER TABLE users 
            MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'user'
        `);

        logger.info('Migration run_migration_192_user_role_to_varchar finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_192_user_role_to_varchar');
    } finally {
        conn?.release();
    }
}
