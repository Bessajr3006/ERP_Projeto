import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration190UserDefaultBankAccount() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_190_user_default_bank_account');

        const [columns] = await pool.query<any[]>(
            `SHOW COLUMNS FROM users LIKE 'default_bank_account_id'`
        );
        if (columns.length === 0) {
            await pool.query(`
                ALTER TABLE users 
                ADD COLUMN default_bank_account_id INT NULL DEFAULT NULL,
                ADD CONSTRAINT fk_users_default_bank_account FOREIGN KEY (default_bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL
            `);
            logger.info('Column default_bank_account_id added to users table.');
        }

        logger.info('Migration run_migration_190_user_default_bank_account finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_190_user_default_bank_account');
    } finally {
        conn?.release();
    }
}
