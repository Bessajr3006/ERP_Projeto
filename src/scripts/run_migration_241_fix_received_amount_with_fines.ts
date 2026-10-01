import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration241FixReceivedAmountWithFines() {
    try {
        logger.info('Starting migration: 241 - Fix received amount (amount = original_amount + fine + interest) for paid transactions');

        // 1. Atualizações prioritárias diretas para cupons conhecidos
        await pool.query(`
            UPDATE transactions 
            SET original_amount = 31860.00, fine = 638.89, amount = 32498.89, solidcon_interest_key = '120431', updated_at = NOW()
            WHERE (id IN (1742, 3909) OR description LIKE '%21905%')
        `);

        await pool.query(`
            UPDATE transactions 
            SET original_amount = 13230.00, fine = 265.83, amount = 13495.83, solidcon_interest_key = '120329', updated_at = NOW()
            WHERE (id IN (1749, 3916) OR description LIKE '%21918%')
        `);

        await pool.query(`
            UPDATE transactions 
            SET original_amount = 3321.56, fine = 66.65, amount = 3388.21, solidcon_interest_key = '120429', updated_at = NOW()
            WHERE (id IN (1753, 3920) OR description LIKE '%21928%')
        `);

        // 2. Atualização geral para todas as transações pagas que possuem multa/juros mas cujo amount ainda era igual ao valor original
        await pool.query(`
            UPDATE transactions 
            SET original_amount = COALESCE(original_amount, amount),
                amount = COALESCE(original_amount, amount) + COALESCE(fine, 0) + COALESCE(interest, 0),
                updated_at = NOW()
            WHERE status = 'paid' 
              AND (fine > 0 OR interest > 0)
              AND (original_amount IS NULL OR amount = original_amount OR amount < (COALESCE(original_amount, amount) + COALESCE(fine, 0) + COALESCE(interest, 0)))
        `);

        // 3. Garantir original_amount preenchido onde estiver nulo
        await pool.query(`
            UPDATE transactions 
            SET original_amount = amount 
            WHERE original_amount IS NULL AND amount IS NOT NULL
        `);

        logger.info('[OK] Migration 241 completed successfully.');
    } catch (err: any) {
        logger.error({ err }, 'Error running migration 241');
        throw err;
    }
}
