import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration191PixOperatorRole() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_191_pix_operator_role');

        // 1. Fetch all companies
        const [companies]: any = await pool.query('SELECT id FROM companies');

        // 2. Insert pix_operator role for all companies
        for (const company of companies) {
            await pool.query(`
                INSERT IGNORE INTO roles (public_id, company_id, name, slug, description, is_active)
                VALUES (UUID(), ?, 'Operador de Pix', 'pix_operator', 'Geração e controle de cobranças PIX', TRUE)
            `, [company.id]);

            // 3. Grant dashboard and gera-pix permissions
            await pool.query(`
                INSERT INTO role_permissions (company_id, role, module, can_view)
                VALUES 
                    (?, 'pix_operator', 'dashboard', 1),
                    (?, 'pix_operator', 'gera-pix', 1)
                ON DUPLICATE KEY UPDATE can_view = 1
            `, [company.id, company.id]);
        }

        logger.info('Migration run_migration_191_pix_operator_role finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_191_pix_operator_role');
    } finally {
        conn?.release();
    }
}
