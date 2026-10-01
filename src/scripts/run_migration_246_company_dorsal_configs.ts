import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration246CompanyDorsalConfigs() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_246_company_dorsal_configs');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS company_dorsal_configs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                name VARCHAR(150) NOT NULL,
                serv_dorsal VARCHAR(255) NOT NULL,
                bd_dorsal VARCHAR(150) NOT NULL,
                login_dorsal VARCHAR(150) NOT NULL,
                senha_dorsal VARCHAR(255) NOT NULL,
                cdfilial VARCHAR(50) NULL,
                cdpdv VARCHAR(50) NULL,
                is_default TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_company_dorsal_company_id (company_id),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Check if cdfilial exists, if not add it
        try {
            await pool.query(`ALTER TABLE company_dorsal_configs ADD COLUMN cdfilial VARCHAR(50) NULL;`);
        } catch (e: any) {
            // Column already exists
        }

        // Check if cdpdv exists, if not add it
        try {
            await pool.query(`ALTER TABLE company_dorsal_configs ADD COLUMN cdpdv VARCHAR(50) NULL;`);
        } catch (e: any) {
            // Column already exists
        }

        // Backfill existing companies that have serv_dorsal and bd_dorsal configured
        await pool.query(`
            INSERT INTO company_dorsal_configs (company_id, name, serv_dorsal, bd_dorsal, login_dorsal, senha_dorsal, cdfilial, cdpdv, is_default)
            SELECT c.id, 'Conexão Dorsal Principal', c.serv_dorsal, c.bd_dorsal, COALESCE(c.login_dorsal, ''), COALESCE(c.senha_dorsal, ''), c.cdfilial, c.cdpdv, 1
            FROM companies c
            WHERE c.serv_dorsal IS NOT NULL 
              AND c.serv_dorsal != '' 
              AND c.bd_dorsal IS NOT NULL 
              AND c.bd_dorsal != ''
              AND NOT EXISTS (
                  SELECT 1 FROM company_dorsal_configs dc WHERE dc.company_id = c.id
              )
        `);

        // Sync cdfilial and cdpdv to default config if missing
        await pool.query(`
            UPDATE company_dorsal_configs dc
            JOIN companies c ON dc.company_id = c.id
            SET dc.cdfilial = COALESCE(dc.cdfilial, c.cdfilial),
                dc.cdpdv = COALESCE(dc.cdpdv, c.cdpdv)
            WHERE dc.is_default = 1 AND (dc.cdfilial IS NULL OR dc.cdfilial = '' OR dc.cdpdv IS NULL OR dc.cdpdv = '');
        `);

        logger.info('Table company_dorsal_configs checked/created and backfilled successfully.');
        logger.info('Migration run_migration_246_company_dorsal_configs finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_246_company_dorsal_configs');
    } finally {
        conn?.release();
    }
}
