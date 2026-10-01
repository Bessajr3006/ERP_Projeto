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

export async function runMigration123AddTempo(): Promise<void> {
    const conn = await pool.getConnection();
    try {
        logger.info('Starting migration: run_migration_123_add_tempo...');

        const exists = await columnExists('card_expenses', 'tempo');
        if (!exists) {
            logger.info('Adding column tempo to card_expenses table...');
            await pool.query(`
                ALTER TABLE card_expenses 
                ADD COLUMN tempo VARCHAR(20) DEFAULT NULL AFTER value
            `);
            logger.info('Column tempo added successfully.');
        } else {
            logger.info('Column tempo already exists in card_expenses table.');
        }

        // Register migration
        const migrationVersion = 123;
        const migrationDescription = 'Add tempo column to card_expenses table';
        await pool.query(
            `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
            [migrationVersion, migrationDescription]
        );

        logger.info('Migration run_migration_123_add_tempo finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_123_add_tempo');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration123AddTempo()
        .then(() => {
            logger.info('Migration 123 completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            logger.error({ err }, 'Migration 123 execution failed');
            process.exit(1);
        });
}
