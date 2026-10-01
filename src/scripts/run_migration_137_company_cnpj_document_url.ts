import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration137() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_137_company_cnpj_document_url');

        await conn.query(`
            ALTER TABLE companies
                ADD COLUMN IF NOT EXISTS cnpj_document_url TEXT NULL;
        `);

        logger.info('Migration run_migration_137_company_cnpj_document_url finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_137_company_cnpj_document_url');
        throw err;
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration137()
        .catch((err) => {
            logger.error({ err }, 'Migration 137 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
