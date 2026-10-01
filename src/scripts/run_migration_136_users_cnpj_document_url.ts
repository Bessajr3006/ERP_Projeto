import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration136() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_136_users_cnpj_document_url');

        await conn.query(`
            ALTER TABLE users
                ADD COLUMN IF NOT EXISTS cnpj_document_url TEXT NULL;
        `);

        logger.info('Migration run_migration_136_users_cnpj_document_url finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_136_users_cnpj_document_url');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration136()
        .catch((err) => {
            logger.error({ err }, 'Migration 136 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
