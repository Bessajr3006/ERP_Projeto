import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration196AddInscricaoToCustomers() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_196_add_inscricao_to_customers');

        // Check/Add inscricao_estadual on customers
        const [ieColumns] = await conn.query(`
            SHOW COLUMNS FROM customers LIKE 'inscricao_estadual'
        `);

        if (Array.isArray(ieColumns) && ieColumns.length > 0) {
            logger.info('[SKIP] customers.inscricao_estadual already exists');
        } else {
            await conn.query(`
                ALTER TABLE customers 
                ADD COLUMN inscricao_estadual VARCHAR(50) DEFAULT NULL
            `);
            logger.info('[OK] customers.inscricao_estadual added successfully');
        }

        // Check/Add inscricao_municipal on customers
        const [imColumns] = await conn.query(`
            SHOW COLUMNS FROM customers LIKE 'inscricao_municipal'
        `);

        if (Array.isArray(imColumns) && imColumns.length > 0) {
            logger.info('[SKIP] customers.inscricao_municipal already exists');
        } else {
            await conn.query(`
                ALTER TABLE customers 
                ADD COLUMN inscricao_municipal VARCHAR(50) DEFAULT NULL
            `);
            logger.info('[OK] customers.inscricao_municipal added successfully');
        }

        logger.info('Migration run_migration_196_add_inscricao_to_customers finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_196_add_inscricao_to_customers');
    } finally {
        conn?.release();
    }
}
