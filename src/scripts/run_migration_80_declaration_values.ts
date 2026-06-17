import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration80() {
    try {
        const conn = await pool.getConnection();

        logger.info('Starting migration: 80 - Add values columns to customer_declarations');

        try {
            // Check if amount_due exists
            const [cols]: any = await conn.query(`SHOW COLUMNS FROM customer_declarations LIKE 'amount_due'`);
            if (cols.length === 0) {
                await conn.query(`
                    ALTER TABLE customer_declarations 
                    ADD COLUMN amount_due DECIMAL(15,2) NULL,
                    ADD COLUMN due_date DATE NULL,
                    ADD COLUMN gross_revenue DECIMAL(15,2) NULL,
                    ADD COLUMN receipt_number VARCHAR(100) NULL
                `);
                logger.info('Added value columns to customer_declarations table.');
            } else {
                logger.info('Columns already exist in customer_declarations table.');
            }

            const migrationName = '80';
            await conn.query(
                `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
                [migrationName, 'Add value columns to customer_declarations']
            );

        } finally {
            conn.release();
        }

        logger.info('Migration 80 finished successfully.');
    } catch (error) {
        logger.error('Error running migration 80: ' + (error instanceof Error ? error.message : String(error)));
        throw error;
    }
}

// Executar se for chamado diretamente
if (require.main === module) {
    runMigration80().then(() => process.exit(0)).catch(() => process.exit(1));
}
