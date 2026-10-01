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

export async function runMigration124CardExpensesCategory(): Promise<void> {
    const conn = await pool.getConnection();
    try {
        logger.info('Starting migration: run_migration_124_card_expenses_category...');

        const exists = await columnExists('card_expenses', 'category_id');
        if (!exists) {
            logger.info('Adding column category_id to card_expenses table...');
            await pool.query(`
                ALTER TABLE card_expenses 
                ADD COLUMN category_id INT NULL AFTER company_id,
                ADD CONSTRAINT fk_card_expenses_category_id FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
            `);
            logger.info('Column category_id and foreign key added successfully.');
        } else {
            logger.info('Column category_id already exists in card_expenses table.');
        }

        // Register migration
        const migrationVersion = 124;
        const migrationDescription = 'Add category_id column to card_expenses table';
        await pool.query(
            `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
            [migrationVersion, migrationDescription]
        );

        logger.info('Migration run_migration_124_card_expenses_category finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_124_card_expenses_category');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration124CardExpensesCategory()
        .then(() => {
            logger.info('Migration 124 completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            logger.error({ err }, 'Migration 124 execution failed');
            process.exit(1);
        });
}
