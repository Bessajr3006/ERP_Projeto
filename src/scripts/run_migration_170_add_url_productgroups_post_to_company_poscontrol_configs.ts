import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration170AddUrlProductgroupsPostToCompanyPoscontrolConfigs() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_170_add_url_productgroups_post_to_company_poscontrol_configs');

        // Check if url_productgroups_post column exists
        const [columns] = await pool.query<any[]>(
            `SHOW COLUMNS FROM company_poscontrol_configs LIKE 'url_productgroups_post'`
        );

        if (columns.length === 0) {
            await pool.query(
                `ALTER TABLE company_poscontrol_configs ADD COLUMN url_productgroups_post VARCHAR(255) DEFAULT NULL`
            );
            logger.info('Column url_productgroups_post added to company_poscontrol_configs table.');
        } else {
            logger.info('Column url_productgroups_post already exists in company_poscontrol_configs table.');
        }

        logger.info('Migration run_migration_170_add_url_productgroups_post_to_company_poscontrol_configs finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_170_add_url_productgroups_post_to_company_poscontrol_configs');
    } finally {
        conn?.release();
    }
}
