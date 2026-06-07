import pool from '../config/db';
import logger from '../config/logger';

async function columnExists(columnName: string): Promise<boolean> {
    const [rows] = await pool.query<any[]>(
        `SELECT COUNT(*) AS count
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'companies'
           AND COLUMN_NAME = ?`,
        [columnName]
    );

    return Array.isArray(rows) && rows[0] && Number(rows[0].count) > 0;
}

export default async function runMigration52(): Promise<void> {
    logger.info('Running migration: run_migration_52_company_logo');

    if (!(await columnExists('logo_url'))) {
        await pool.query(`
            ALTER TABLE companies
            ADD COLUMN logo_url VARCHAR(512) DEFAULT NULL AFTER certificate_name
        `);
        logger.info('Added companies.logo_url');
    }

    if (!(await columnExists('logo_filename'))) {
        await pool.query(`
            ALTER TABLE companies
            ADD COLUMN logo_filename VARCHAR(255) DEFAULT NULL AFTER logo_url
        `);
        logger.info('Added companies.logo_filename');
    }

    if (!(await columnExists('logo_base64'))) {
        await pool.query(`
            ALTER TABLE companies
            ADD COLUMN logo_base64 LONGTEXT DEFAULT NULL AFTER logo_filename
        `);
        logger.info('Added companies.logo_base64');
    }

    logger.info('Migration run_migration_52_company_logo finished successfully!');
}
