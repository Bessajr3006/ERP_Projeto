import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';
import { PoolConnection } from 'mysql2/promise';

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

async function createActivityGroupsTable(conn: PoolConnection): Promise<void> {
    logger.info('Creating activity_groups table...');
    await conn.query(`
        CREATE TABLE IF NOT EXISTS activity_groups (
            id INT AUTO_INCREMENT PRIMARY KEY,
            public_id VARCHAR(50) NOT NULL UNIQUE,
            company_id INT NOT NULL,
            name VARCHAR(150) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_activity_groups_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
}

async function seedActivityGroupsPermissions(conn: PoolConnection): Promise<void> {
    logger.info('Seeding activity_groups permissions...');
    const roles = ['admin', 'super_admin', 'admin_basic', 'financial', 'seller'];
    for (const role of roles) {
        await conn.query(`
            INSERT INTO role_permissions (company_id, role, module, can_view)
            SELECT c.id, ?, 'activity_groups', 1
            FROM companies c
            ON DUPLICATE KEY UPDATE 
                can_view = VALUES(can_view)
        `, [role]);
    }
}

export async function runMigration206ActivityGroups() {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_206_activity_groups');

        await conn.beginTransaction();

        if (!(await tableExists('activity_groups'))) {
            await createActivityGroupsTable(conn);
        }

        if (await tableExists('role_permissions')) {
            await seedActivityGroupsPermissions(conn);
        }

        const migrationVersion = 206;
        const migrationDescription = 'Create activity_groups table';
        await conn.query(
            `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
            [migrationVersion, migrationDescription]
        );

        await conn.commit();
        logger.info('Migration run_migration_206_activity_groups finished successfully!');
    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (rbErr) {
                logger.error({ err: rbErr }, 'Failed to rollback migration 206');
            }
        }
        logger.error({ err }, 'Failed to run migration: run_migration_206_activity_groups');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration206ActivityGroups()
        .then(() => {
            logger.info('Migration 206 completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            logger.error({ err }, 'Migration 206 execution failed');
            process.exit(1);
        });
}
