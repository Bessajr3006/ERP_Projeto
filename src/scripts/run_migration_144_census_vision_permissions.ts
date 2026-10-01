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

async function seedCensusVisionPermissions(): Promise<void> {
    const roles = [
        'admin',
        'super_admin',
        'admin_basic',
        'supervisor',
        'operator',
        'financial',
        'seller',
        'accountant',
        'buyer',
        'service_provider',
        'user'
    ];

    for (const role of roles) {
        await pool.query(`
            INSERT INTO role_permissions (company_id, role, module, can_view)
            SELECT c.id, ?, 'census-vision', 1
            FROM companies c
            ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)
        `, [role]);
    }
}

async function migrationAlreadyExecuted(version: number): Promise<boolean> {
    try {
        if (!(await tableExists('schema_migrations'))) {
            return false;
        }
        const [rows] = await pool.query<any[]>(
            'SELECT COUNT(*) AS count FROM schema_migrations WHERE version = ?',
            [version]
        );
        return Array.isArray(rows) && rows[0] && Number(rows[0].count) > 0;
    } catch (err) {
        return false;
    }
}

export async function runMigration144CensusVisionPermissions() {
    let conn;
    try {
        conn = await pool.getConnection();

        const alreadyRun = await migrationAlreadyExecuted(144);
        if (alreadyRun) {
            logger.info('Migration 144 already executed. Skipping.');
            return;
        }

        logger.info('Running migration: run_migration_144_census_vision_permissions');

        if (!(await tableExists('role_permissions'))) {
            logger.warn('Table role_permissions not found. Skipping migration 144.');
            return;
        }

        await seedCensusVisionPermissions();

        await pool.query(
            'INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version',
            [144, 'run_migration_144_census_vision_permissions']
        );

        logger.info('Migration run_migration_144_census_vision_permissions finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_144_census_vision_permissions');
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration144CensusVisionPermissions()
        .catch((err) => {
            logger.error({ err }, 'Migration 144 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
