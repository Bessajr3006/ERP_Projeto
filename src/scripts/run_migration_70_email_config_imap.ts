import pool from '../config/db';
import logger from '../config/logger';

/**
 * Migration 70:
 * - Adiciona campos IMAP na tabela email_config para sincronizacao da caixa.
 */
export default async function runMigration(): Promise<void> {
    let conn;

    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_70_email_config_imap');

        await conn.query(`
            ALTER TABLE email_config
            ADD COLUMN IF NOT EXISTS imap_host VARCHAR(255) NOT NULL DEFAULT '' AFTER smtp_user
        `);

        await conn.query(`
            ALTER TABLE email_config
            ADD COLUMN IF NOT EXISTS imap_port SMALLINT UNSIGNED NOT NULL DEFAULT 993 AFTER imap_host
        `);

        await conn.query(`
            ALTER TABLE email_config
            ADD COLUMN IF NOT EXISTS imap_secure TINYINT(1) NOT NULL DEFAULT 1 AFTER imap_port
        `);

        logger.info('Migration run_migration_70_email_config_imap finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_70_email_config_imap');
        throw err;
    } finally {
        if (conn) conn.release();
    }
}
