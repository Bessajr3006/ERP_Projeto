import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration171AddPoscontrolUsernameAndPasswordToCompanyPoscontrolConfigs() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_171_add_poscontrol_username_and_password_to_company_poscontrol_configs');

        // Check if columns exist
        const [usernameCols] = await pool.query<any[]>(
            `SHOW COLUMNS FROM company_poscontrol_configs LIKE 'poscontrol_username'`
        );
        const [passwordCols] = await pool.query<any[]>(
            `SHOW COLUMNS FROM company_poscontrol_configs LIKE 'poscontrol_password'`
        );

        if (usernameCols.length === 0) {
            await pool.query(
                `ALTER TABLE company_poscontrol_configs ADD COLUMN poscontrol_username VARCHAR(255) DEFAULT NULL`
            );
            logger.info('Column poscontrol_username added.');
        }

        if (passwordCols.length === 0) {
            await pool.query(
                `ALTER TABLE company_poscontrol_configs ADD COLUMN poscontrol_password VARCHAR(255) DEFAULT NULL`
            );
            logger.info('Column poscontrol_password added.');
        }

        logger.info('Migration run_migration_171_add_poscontrol_username_and_password_to_company_poscontrol_configs finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_171_add_poscontrol_username_and_password_to_company_poscontrol_configs');
    } finally {
        conn?.release();
    }
}
