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

export async function runMigration140CardDebitsFields(): Promise<void> {
    const conn = await pool.getConnection();
    try {
        logger.info('Starting migration: run_migration_140_card_debits_fields...');

        const exists = await columnExists('card_debits', 'card_name');
        if (!exists) {
            logger.info('Adding card columns to card_debits table...');
            await pool.query(`
                ALTER TABLE card_debits 
                ADD COLUMN card_name VARCHAR(100) NULL AFTER value,
                ADD COLUMN card_number VARCHAR(50) NULL AFTER card_name,
                ADD COLUMN due_date DATE NULL AFTER card_number,
                ADD COLUMN card_expense_id INT NULL AFTER due_date,
                ADD CONSTRAINT fk_card_debits_card_expense FOREIGN KEY (card_expense_id) REFERENCES card_expenses(id) ON DELETE SET NULL
            `);
            logger.info('Card columns and foreign key added successfully.');
        } else {
            logger.info('Card columns already exist in card_debits table.');
        }

        // Register migration
        const migrationVersion = 140;
        const migrationDescription = 'Add card_name, card_number, due_date, and card_expense_id columns to card_debits table';
        await pool.query(
            `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
            [migrationVersion, migrationDescription]
        );

        logger.info('Migration run_migration_140_card_debits_fields finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_140_card_debits_fields');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration140CardDebitsFields()
        .then(() => {
            logger.info('Migration 140 completed successfully');
            process.exit(0);
        })
        .catch((err) => {
            logger.error({ err }, 'Migration 140 execution failed');
            process.exit(1);
        });
}
