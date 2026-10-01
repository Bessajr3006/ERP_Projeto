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

async function createCustomerActivitiesTable(conn: PoolConnection): Promise<void> {
    logger.info('Creating customer_activities table...');
    await conn.query(`
        CREATE TABLE IF NOT EXISTS customer_activities (
            customer_id INT NOT NULL,
            activity_group_id INT NOT NULL,
            PRIMARY KEY (customer_id, activity_group_id),
            CONSTRAINT fk_customer_activities_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
            CONSTRAINT fk_customer_activities_activity_group FOREIGN KEY (activity_group_id) REFERENCES activity_groups(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
}

export async function runMigration207CustomerActivities() {
    let conn: PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_207_customer_activities');

        await conn.beginTransaction();

        if (!(await tableExists('customer_activities'))) {
            await createCustomerActivitiesTable(conn);
        }

        const migrationVersion = 207;
        const migrationDescription = 'Create customer_activities join table for N:N activity groups';
        await conn.query(
            `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
            [migrationVersion, migrationDescription]
        );

        await conn.commit();
        logger.info('Migration run_migration_207_customer_activities finished successfully!');
    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (rbErr) {
                logger.error({ err: rbErr }, 'Failed to rollback migration 207');
            }
        }
        logger.error({ err }, 'Failed to run migration: run_migration_207_customer_activities');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration207CustomerActivities()
        .then(() => {
            logger.info('Migration 207 completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            logger.error({ err }, 'Migration 207 execution failed');
            process.exit(1);
        });
}
