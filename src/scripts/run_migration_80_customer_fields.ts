import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';

export default async function runMigration80() {
    try {
        const conn = await pool.getConnection();

        logger.info('Starting migration: 80 - Add opening_date and tax_regime to customers');

        try {
            await conn.query(`
                ALTER TABLE customers 
                ADD COLUMN IF NOT EXISTS opening_date DATE NULL,
                ADD COLUMN IF NOT EXISTS tax_regime VARCHAR(50) NULL;
            `);
            logger.info('Added opening_date and tax_regime to customers table.');

            const migrationVersion = 80;
            const migrationDescription = 'Add opening_date and tax_regime to customers';
            await conn.query(
                `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
                [migrationVersion, migrationDescription]
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
