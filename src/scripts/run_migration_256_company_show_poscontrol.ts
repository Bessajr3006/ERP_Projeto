import pool from '../config/db';
import logger from '../config/logger';

async function tableExists(conn: any, tableName: string): Promise<boolean> {
    try {
        const [rows]: any = await conn.query(`SHOW TABLES LIKE ?`, [tableName]);
        return Array.isArray(rows) && rows.length > 0;
    } catch {
        return false;
    }
}

async function columnExists(conn: any, tableName: string, columnName: string): Promise<boolean> {
    try {
        const [rows]: any = await conn.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
        return Array.isArray(rows) && rows.length > 0;
    } catch {
        return false;
    }
}

export async function runMigration256CompanyShowPoscontrol(): Promise<void> {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_256_company_show_poscontrol');

        if (await tableExists(conn, 'companies')) {
            const hasCol = await columnExists(conn, 'companies', 'show_poscontrol');
            if (!hasCol) {
                try {
                    await conn.query(`
                        ALTER TABLE companies
                        ADD COLUMN show_poscontrol TINYINT(1) NOT NULL DEFAULT 1 AFTER show_alterdata;
                    `);
                    logger.info('[OK] Added show_poscontrol column to companies table');
                } catch (e: any) {
                    if (e.code !== 'ER_DUP_FIELDNAME' && e.errno !== 1060) throw e;
                }
            }
        }

        logger.info('Migration run_migration_256_company_show_poscontrol finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_256_company_show_poscontrol');
        throw err;
    } finally {
        conn?.release();
    }
}

export default runMigration256CompanyShowPoscontrol;

if (require.main === module) {
    runMigration256CompanyShowPoscontrol()
        .catch((err) => {
            logger.error({ err }, 'Migration 256 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
