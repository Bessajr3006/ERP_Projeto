import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration223AddFineInterestToTransactions() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('Running migration: run_migration_223_add_fine_interest_to_transactions');

        // 1. Check/Add original_amount on transactions
        const [colOrig]: any = await conn.query(`
            SHOW COLUMNS FROM transactions LIKE 'original_amount'
        `);
        if (Array.isArray(colOrig) && colOrig.length > 0) {
            logger.info('[SKIP] transactions.original_amount already exists');
        } else {
            await conn.query(`
                ALTER TABLE transactions 
                ADD COLUMN original_amount DECIMAL(15, 2) NULL DEFAULT NULL AFTER amount
            `);
            logger.info('[OK] transactions.original_amount added successfully');
        }

        // 2. Check/Add fine on transactions
        const [colFine]: any = await conn.query(`
            SHOW COLUMNS FROM transactions LIKE 'fine'
        `);
        if (Array.isArray(colFine) && colFine.length > 0) {
            logger.info('[SKIP] transactions.fine already exists');
        } else {
            await conn.query(`
                ALTER TABLE transactions 
                ADD COLUMN fine DECIMAL(15, 2) NOT NULL DEFAULT 0.00 AFTER original_amount
            `);
            logger.info('[OK] transactions.fine added successfully');
        }

        // 3. Check/Add interest on transactions
        const [colInterest]: any = await conn.query(`
            SHOW COLUMNS FROM transactions LIKE 'interest'
        `);
        if (Array.isArray(colInterest) && colInterest.length > 0) {
            logger.info('[SKIP] transactions.interest already exists');
        } else {
            await conn.query(`
                ALTER TABLE transactions 
                ADD COLUMN interest DECIMAL(15, 2) NOT NULL DEFAULT 0.00 AFTER fine
            `);
            logger.info('[OK] transactions.interest added successfully');
        }

        logger.info('Migration run_migration_223_add_fine_interest_to_transactions finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_223_add_fine_interest_to_transactions');
    } finally {
        conn?.release();
    }
}
