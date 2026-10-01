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

export async function runMigration141CardExpensesCardDebit(): Promise<void> {
    const conn = await pool.getConnection();
    try {
        logger.info('Starting migration: run_migration_141_card_expenses_card_debit...');

        const exists = await columnExists('card_expenses', 'card_debit_id');
        if (!exists) {
            logger.info('Adding card_debit_id column to card_expenses table...');
            await pool.query(`
                ALTER TABLE card_expenses 
                ADD COLUMN card_debit_id INT NULL AFTER category_id,
                ADD CONSTRAINT fk_card_expenses_card_debit FOREIGN KEY (card_debit_id) REFERENCES card_debits(id) ON DELETE SET NULL
            `);
            logger.info('card_debit_id column and foreign key added successfully.');
        } else {
            logger.info('card_debit_id column already exists in card_expenses table.');
        }

        // Register migration
        const migrationVersion = 141;
        const migrationDescription = 'Add card_debit_id column to card_expenses table to link with card_debits';
        await pool.query(
            `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
            [migrationVersion, migrationDescription]
        );

        logger.info('Migration run_migration_141_card_expenses_card_debit finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_141_card_expenses_card_debit');
        throw err;
    } finally {
        conn.release();
    }
}
