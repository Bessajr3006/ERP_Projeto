import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
    const [rows] = await pool.query<any[]>(
        `SELECT COUNT(*) AS count
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?`,
        [tableName, columnName]
    );
    return Array.isArray(rows) && rows[0] && Number(rows[0].count) > 0;
}

export async function runMigration130ServiceLaunchesChecklist(): Promise<void> {
    const conn = await pool.getConnection();
    try {
        logger.info('Starting migration: run_migration_130_service_launches_checklist...');

        const exists = await columnExists('service_launches', 'checklist');
        if (!exists) {
            logger.info('Adding column checklist to service_launches table...');
            await pool.query(`
                ALTER TABLE service_launches 
                ADD COLUMN checklist JSON NULL DEFAULT NULL AFTER observation
            `);
            logger.info('Column checklist added successfully.');
        } else {
            logger.info('Column checklist already exists in service_launches table.');
        }

        // Register migration
        const migrationVersion = 130;
        const migrationDescription = 'Add checklist column to service_launches table';
        await pool.query(
            `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
            [migrationVersion, migrationDescription]
        );

        logger.info('Migration run_migration_130_service_launches_checklist finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_130_service_launches_checklist');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration130ServiceLaunchesChecklist()
        .then(() => {
            logger.info('Migration 130 completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            logger.error({ err }, 'Migration 130 execution failed');
            process.exit(1);
        });
}
