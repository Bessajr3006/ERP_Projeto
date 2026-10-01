import 'dotenv/config';
import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration115() {
    try {
        const conn = await pool.getConnection();

        logger.info('Starting migration: 115 - Add contact to customers');

        try {
            await conn.query(`
                ALTER TABLE customers 
                ADD COLUMN IF NOT EXISTS contact VARCHAR(150) NULL;
            `);
            logger.info('Added contact to customers table.');

            const migrationVersion = 115;
            const migrationDescription = 'Add contact to customers';
            await conn.query(
                `INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version`,
                [migrationVersion, migrationDescription]
            );

        } finally {
            conn.release();
        }

        logger.info('Migration 115 finished successfully.');
    } catch (error) {
        logger.error('Error running migration 115: ' + (error instanceof Error ? error.message : String(error)));
        throw error;
    }
}

// Executar se for chamado diretamente
if (require.main === module) {
    runMigration115().then(() => process.exit(0)).catch(() => process.exit(1));
}
