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

export default async function runMigration104CardConfigPaymentType() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_104_card_config_payment_type');

        // 1. Make card_brand_id nullable
        logger.info('Modifying card_brand_id to be nullable in card_configurations...');
        await pool.query(`
            ALTER TABLE card_configurations 
            MODIFY COLUMN card_brand_id INT NULL;
        `);

        // 2. Add payment_type column
        if (!(await columnExists('card_configurations', 'payment_type'))) {
            logger.info('Adding payment_type column to card_configurations...');
            await pool.query(`
                ALTER TABLE card_configurations 
                ADD COLUMN payment_type VARCHAR(30) NOT NULL DEFAULT 'credito' AFTER card_brand_id;
            `);
        }

        logger.info('Migration run_migration_104_card_config_payment_type finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_104_card_config_payment_type');
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration104CardConfigPaymentType()
        .catch((err) => {
            logger.error({ err }, 'Migration 104 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
