import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration229UpdateSolidconInterestKeyToConta() {
    try {
        logger.info('Starting migration: 229 - Update solidcon_interest_key to tbConta cdConta');
        await pool.query(`
            UPDATE transactions 
            SET solidcon_interest_key = '120229' 
            WHERE (id = 1442 OR description LIKE '%21917%') AND (solidcon_interest_key = '160359' OR solidcon_interest_key IS NULL)
        `);
        logger.info('Migration 229: Completed update of solidcon_interest_key to tbConta cdConta.');
    } catch (err) {
        logger.error({ err }, 'Error running migration 229');
    }
}
