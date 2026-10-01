import pool from '../config/db';
import logger from '../config/logger';

async function tableExists(tableName: string): Promise<boolean> {
    const [rows] = await pool.query<any[]>(
        `SELECT COUNT(*) AS count
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?`,
        [tableName]
    );
    return Array.isArray(rows) && rows[0] && Number(rows[0].count) > 0;
}

async function seedSpedFiscalPermissions(): Promise<void> {
    await pool.query(`
        INSERT INTO role_permissions (company_id, role, module, can_view)
        SELECT c.id, 'admin', 'sped_fiscal', 1
        FROM companies c
        ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
    `);

    await pool.query(`
        INSERT INTO role_permissions (company_id, role, module, can_view)
        SELECT c.id, 'super_admin', 'sped_fiscal', 1
        FROM companies c
        ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
    `);

    // Give permission to accounting/financial roles if they exist
    await pool.query(`
        INSERT INTO role_permissions (company_id, role, module, can_view)
        SELECT c.id, 'financial', 'sped_fiscal', 1
        FROM companies c
        ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
    `);

    // Give permission to accountant and auxiliar_contador roles
    await pool.query(`
        INSERT INTO role_permissions (company_id, role, module, can_view)
        SELECT c.id, 'accountant', 'sped_fiscal', 1
        FROM companies c
        ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
    `);

    await pool.query(`
        INSERT INTO role_permissions (company_id, role, module, can_view)
        SELECT c.id, 'auxiliar_contador', 'sped_fiscal', 1
        FROM companies c
        ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
    `);
}

export default async function runMigration150SpedFiscalPermissions() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_150_sped_fiscal_permissions');

        if (!(await tableExists('role_permissions'))) {
            logger.warn('Table role_permissions not found. Skipping migration 150.');
            return;
        }

        await seedSpedFiscalPermissions();

        logger.info('Migration run_migration_150_sped_fiscal_permissions finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_150_sped_fiscal_permissions');
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration150SpedFiscalPermissions()
        .catch((err) => {
            logger.error({ err }, 'Migration 150 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
