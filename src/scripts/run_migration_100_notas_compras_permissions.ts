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

async function seedNotasComprasPermissions(): Promise<void> {
    const roles = ['admin', 'super_admin', 'admin_basic', 'financial', 'buyer'];
    
    for (const role of roles) {
        await pool.query(`
            INSERT INTO role_permissions (company_id, role, module, can_view)
            SELECT c.id, ?, 'notas_compras', 1
            FROM companies c
            ON DUPLICATE KEY UPDATE 
                can_view = VALUES(can_view)
        `, [role]);
    }
}

export default async function runMigration100NotasComprasPermissions() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_100_notas_compras_permissions');

        if (!(await tableExists('role_permissions'))) {
            logger.warn('Table role_permissions not found. Skipping migration 100.');
            return;
        }

        await seedNotasComprasPermissions();

        logger.info('Migration run_migration_100_notas_compras_permissions finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_100_notas_compras_permissions');
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration100NotasComprasPermissions()
        .catch((err) => {
            logger.error({ err }, 'Migration 100 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
