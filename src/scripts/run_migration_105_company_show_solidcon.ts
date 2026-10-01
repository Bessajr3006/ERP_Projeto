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

export default async function runMigration105CompanyShowSolidcon() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_105_company_show_solidcon');

        // Add show_solidcon column
        if (!(await columnExists('companies', 'show_solidcon'))) {
            logger.info('Adding show_solidcon column to companies...');
            await pool.query(`
                ALTER TABLE companies 
                ADD COLUMN show_solidcon TINYINT NOT NULL DEFAULT 1 AFTER senha_dorsal;
            `);
        }

        logger.info('Migration run_migration_105_company_show_solidcon finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_105_company_show_solidcon');
    } finally {
        conn?.release();
    }
}

if (require.main === module) {
    runMigration105CompanyShowSolidcon()
        .catch((err) => {
            logger.error({ err }, 'Migration 105 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
