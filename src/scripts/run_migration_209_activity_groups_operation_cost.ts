import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration209ActivityGroupsOperationCost() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_209_activity_groups_operation_cost');

        // Check/Add operation_cost on activity_groups
        const [columns] = await conn.query(`
            SHOW COLUMNS FROM activity_groups LIKE 'operation_cost'
        `);

        if (Array.isArray(columns) && columns.length > 0) {
            logger.info('[SKIP] activity_groups.operation_cost already exists');
        } else {
            await conn.query(`
                ALTER TABLE activity_groups 
                ADD COLUMN operation_cost DECIMAL(10,2) DEFAULT NULL
            `);
            logger.info('[OK] activity_groups.operation_cost added successfully');
        }

        logger.info('Migration run_migration_209_activity_groups_operation_cost finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_209_activity_groups_operation_cost');
    } finally {
        conn?.release();
    }
}
