import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration169CreateCompanyPoscontrolConfigsTable() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_169_create_company_poscontrol_configs_table');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS company_poscontrol_configs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                subscription_key VARCHAR(255) NULL,
                ocp_apim_subscription_key VARCHAR(255) NULL,
                url_token VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            )
        `);

        logger.info('Table company_poscontrol_configs checked/created successfully.');
        logger.info('Migration run_migration_169_create_company_poscontrol_configs_table finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_169_create_company_poscontrol_configs_table');
    } finally {
        conn?.release();
    }
}
