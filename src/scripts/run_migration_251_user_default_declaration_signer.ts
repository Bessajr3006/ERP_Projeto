import pool from '../config/db';
import logger from '../config/logger';

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
    const [rows] = await pool.query<any[]>(
        `SELECT COUNT(*) AS count
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?`,
        [tableName, columnName]
    );
    return Array.isArray(rows) && rows[0] && Number(rows[0].count) > 0;
}

export async function runMigration251UserDefaultDeclarationSigner(): Promise<void> {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_251_user_default_declaration_signer');

        if (!(await columnExists('users', 'is_default_declaration_signer'))) {
            logger.info('Adding is_default_declaration_signer column to users table...');
            await conn.query(`
                ALTER TABLE users
                ADD COLUMN is_default_declaration_signer TINYINT(1) NOT NULL DEFAULT 0;
            `);
            logger.info('Column is_default_declaration_signer added successfully.');
        } else {
            logger.info('Column is_default_declaration_signer already exists on users table.');
        }

        logger.info('Migration run_migration_251_user_default_declaration_signer finished successfully!');
    } catch (error: any) {
        logger.error({ err: error }, 'Failed to run migration: run_migration_251_user_default_declaration_signer');
        throw error;
    } finally {
        if (conn) conn.release();
    }
}
