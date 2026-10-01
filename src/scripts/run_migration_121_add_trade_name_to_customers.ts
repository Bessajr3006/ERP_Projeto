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

export async function runMigration121AddTradeNameToCustomers(): Promise<void> {
    const conn = await pool.getConnection();
    try {
        logger.info('Starting migration: run_migration_121_add_trade_name_to_customers...');

        const hasTradeName = await columnExists('customers', 'trade_name');
        if (!hasTradeName) {
            logger.info('Adding trade_name column to customers table...');
            await pool.query(
                `ALTER TABLE customers ADD COLUMN trade_name VARCHAR(150) DEFAULT NULL AFTER name`
            );
            logger.info('trade_name column added successfully!');
        } else {
            logger.info('Column trade_name already exists in customers table.');
        }

        // Register migration
        const migrationVersion = 121;
        const migrationDescription = 'Add trade_name column to customers table';
        await pool.query(
            `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
            [migrationVersion, migrationDescription]
        );

        logger.info('Migration run_migration_121_add_trade_name_to_customers finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_121_add_trade_name_to_customers');
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration121AddTradeNameToCustomers()
        .then(() => {
            logger.info('Migration 121 completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            logger.error({ err }, 'Migration 121 execution failed');
            process.exit(1);
        });
}
