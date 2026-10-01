import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration208ActivityGroupsMonthlyFee() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_208_activity_groups_monthly_fee');

        // Check/Add monthly_fee on activity_groups
        const [feeColumns] = await conn.query(`
            SHOW COLUMNS FROM activity_groups LIKE 'monthly_fee'
        `);

        if (Array.isArray(feeColumns) && feeColumns.length > 0) {
            logger.info('[SKIP] activity_groups.monthly_fee already exists');
        } else {
            await conn.query(`
                ALTER TABLE activity_groups 
                ADD COLUMN monthly_fee DECIMAL(10,2) DEFAULT NULL
            `);
            logger.info('[OK] activity_groups.monthly_fee added successfully');
        }

        // Check/Add due_day on activity_groups
        const [dueDayColumns] = await conn.query(`
            SHOW COLUMNS FROM activity_groups LIKE 'due_day'
        `);

        if (Array.isArray(dueDayColumns) && dueDayColumns.length > 0) {
            logger.info('[SKIP] activity_groups.due_day already exists');
        } else {
            await conn.query(`
                ALTER TABLE activity_groups 
                ADD COLUMN due_day INT DEFAULT NULL
            `);
            logger.info('[OK] activity_groups.due_day added successfully');
        }

        logger.info('Migration run_migration_208_activity_groups_monthly_fee finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_208_activity_groups_monthly_fee');
    } finally {
        conn?.release();
    }
}
