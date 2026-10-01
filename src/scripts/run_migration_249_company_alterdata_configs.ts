import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration249CompanyAlterdataConfigs() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_249_company_alterdata_configs');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS company_alterdata_configs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                name VARCHAR(150) NOT NULL,
                serv_alterdata VARCHAR(255) NOT NULL,
                porta_alterdata VARCHAR(10) NULL DEFAULT '1433',
                bd_alterdata VARCHAR(150) NOT NULL,
                cdempresa_alterdata VARCHAR(50) NULL,
                login_alterdata VARCHAR(150) NOT NULL,
                senha_alterdata VARCHAR(255) NOT NULL,
                is_default TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_company_alterdata_company_id (company_id),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Check if porta_alterdata exists, if not add it
        try {
            await pool.query(`ALTER TABLE company_alterdata_configs ADD COLUMN porta_alterdata VARCHAR(10) NULL DEFAULT '1433';`);
        } catch (e: any) {
            // Column already exists
        }

        // Check if cdempresa_alterdata exists, if not add it
        try {
            await pool.query(`ALTER TABLE company_alterdata_configs ADD COLUMN cdempresa_alterdata VARCHAR(50) NULL;`);
        } catch (e: any) {
            // Column already exists
        }

        // Backfill existing companies that have serv_alterdata and bd_alterdata configured
        await pool.query(`
            INSERT INTO company_alterdata_configs (company_id, name, serv_alterdata, porta_alterdata, bd_alterdata, cdempresa_alterdata, login_alterdata, senha_alterdata, is_default)
            SELECT c.id, 'Conexão Alterdata Principal', c.serv_alterdata, COALESCE(c.porta_alterdata, '1433'), c.bd_alterdata, c.cdempresa_alterdata, COALESCE(c.login_alterdata, ''), COALESCE(c.senha_alterdata, ''), 1
            FROM companies c
            WHERE c.serv_alterdata IS NOT NULL 
              AND c.serv_alterdata != '' 
              AND c.bd_alterdata IS NOT NULL 
              AND c.bd_alterdata != ''
              AND NOT EXISTS (
                  SELECT 1 FROM company_alterdata_configs ac WHERE ac.company_id = c.id
              )
        `);

        logger.info('Table company_alterdata_configs checked/created and backfilled successfully.');
        logger.info('Migration run_migration_249_company_alterdata_configs finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_249_company_alterdata_configs');
    } finally {
        conn?.release();
    }
}
