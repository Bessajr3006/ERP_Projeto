import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration242CompanySolidconConfigs() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_242_company_solidcon_configs');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS company_solidcon_configs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                name VARCHAR(150) NOT NULL,
                serv_solidcon VARCHAR(255) NOT NULL,
                bd_solidcon VARCHAR(150) NOT NULL,
                login_solidcon VARCHAR(150) NOT NULL,
                senha_solidcon VARCHAR(255) NOT NULL,
                cdfilial VARCHAR(50) NULL,
                cdpdv VARCHAR(50) NULL,
                is_default TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_company_solidcon_company_id (company_id),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Check if cdfilial exists, if not add it
        try {
            await pool.query(`ALTER TABLE company_solidcon_configs ADD COLUMN cdfilial VARCHAR(50) NULL;`);
        } catch (e: any) {
            // Column already exists
        }

        // Check if cdpdv exists, if not add it
        try {
            await pool.query(`ALTER TABLE company_solidcon_configs ADD COLUMN cdpdv VARCHAR(50) NULL;`);
        } catch (e: any) {
            // Column already exists
        }

        // Backfill existing companies that have serv_solidcon and bd_solidcon configured
        await pool.query(`
            INSERT INTO company_solidcon_configs (company_id, name, serv_solidcon, bd_solidcon, login_solidcon, senha_solidcon, cdfilial, cdpdv, is_default)
            SELECT c.id, 'Conexão Principal', c.serv_solidcon, c.bd_solidcon, COALESCE(c.login_solidcon, ''), COALESCE(c.senha_solidcon, ''), c.cdfilial, c.cdpdv, 1
            FROM companies c
            WHERE c.serv_solidcon IS NOT NULL 
              AND c.serv_solidcon != '' 
              AND c.bd_solidcon IS NOT NULL 
              AND c.bd_solidcon != ''
              AND NOT EXISTS (
                  SELECT 1 FROM company_solidcon_configs sc WHERE sc.company_id = c.id
              )
        `);

        // Sync cdfilial and cdpdv to default config if missing
        await pool.query(`
            UPDATE company_solidcon_configs sc
            JOIN companies c ON sc.company_id = c.id
            SET sc.cdfilial = COALESCE(sc.cdfilial, c.cdfilial),
                sc.cdpdv = COALESCE(sc.cdpdv, c.cdpdv)
            WHERE sc.is_default = 1 AND (sc.cdfilial IS NULL OR sc.cdfilial = '' OR sc.cdpdv IS NULL OR sc.cdpdv = '');
        `);

        logger.info('Table company_solidcon_configs checked/created and backfilled successfully.');
        logger.info('Migration run_migration_242_company_solidcon_configs finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_242_company_solidcon_configs');
    } finally {
        conn?.release();
    }
}
