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

export async function runMigration258FechamentosNullableCustomer(): Promise<void> {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_258_fechamentos_nullable_customer');

        if (await tableExists(conn, 'fechamentos')) {
            try {
                await conn.query(`
                    ALTER TABLE fechamentos MODIFY customer_id INT(11) NULL;
                `);
                logger.info('[OK] Modified customer_id to NULL in fechamentos table');
            } catch (e: any) {
                logger.warn({ err: e }, '[WARN] Failed or already modified customer_id in fechamentos');
            }
        }

        logger.info('Migration run_migration_258_fechamentos_nullable_customer finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_258_fechamentos_nullable_customer');
        throw err;
    } finally {
        conn?.release();
    }
}

export default runMigration258FechamentosNullableCustomer;

if (require.main === module) {
    runMigration258FechamentosNullableCustomer()
        .catch((err) => {
            logger.error({ err }, 'Migration 258 execution failed');
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
