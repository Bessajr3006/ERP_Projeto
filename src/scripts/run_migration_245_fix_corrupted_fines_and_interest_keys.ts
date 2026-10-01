import pool from '../config/db';
import logger from '../config/logger';

export async function runMigration245FixCorruptedFinesAndInterestKeys() {
    try {
        logger.info('Starting migration: 245 - Fix corrupted fines and solidcon_interest_key pointing to principal accounts');

        // 1. Lista de contas do Solidcon que são de recebimento principal (NÃO são juros)
        const principalContaIds = [
            '120514', // Cupom 21917 - CHEFE RECREIO
            '120516', // Cupom 21138 - JC ATACADOS
            '120522', // Cupom 21188 - CHEFE RECREIO
            '120528', // Cupom 21171 / 21184 - LOJA CONVENIENCIA N1
            '120543', // Cupom 21862 - ALDINEY MELO
            '120612', // Cupom 21844 - JOSIVALDO
            '120614', // Cupom 21818 - MM COMÉRCIO & BALAS
            '120634', // Cupom 21825 - ASA VALQUEIRE
            '122868', // Cupom 21202 - BAR DO BELO
            '122879', // Cupom 21989 - PRIME DISTRIBUIDORA DE BEBIDAS
            '122889', // Cupom 21190 - DIEGO AMORIM
            '122890', // Cupom 21972 - DIEGO AMORIM
            '122893', // Cupom 21203 - BAR DO BELO
            '122894', // Cupom 21980 - TO COM SEDE 2.0
            '122895', // Cupom 22000 - DIB SUPERMERCADOS
            '122898', // Cupom 21204 - JC ATACADOS
            '122899'  // Cupom 22001 - JC ATACADOS
        ];

        const placeholders = principalContaIds.map(() => '?').join(',');
        const [res1]: any = await pool.query(`
            UPDATE transactions 
            SET solidcon_interest_key = NULL,
                fine = 0,
                interest = 0,
                amount = COALESCE(original_amount, amount),
                updated_at = NOW()
            WHERE solidcon_interest_key IN (${placeholders})
        `, principalContaIds);

        logger.info(`Migration 245: Cleaned ${res1.affectedRows || 0} transactions with principal accounts in solidcon_interest_key.`);

        // 2. Corrigir transações onde fine == original_amount ou amount == original_amount * 2 sem juros reais
        const [res2]: any = await pool.query(`
            UPDATE transactions 
            SET fine = 0,
                interest = 0,
                amount = COALESCE(original_amount, amount),
                solidcon_interest_key = NULL,
                updated_at = NOW()
            WHERE original_amount IS NOT NULL 
              AND original_amount > 0 
              AND (fine = original_amount OR amount = original_amount * 2)
              AND (solidcon_interest_key IS NULL OR solidcon_interest_key IN (${placeholders}))
        `, principalContaIds);

        logger.info(`Migration 245: Cleaned ${res2.affectedRows || 0} transactions with doubled amounts/fines.`);

        // 3. Garantir que Cupom #21917 específico está completamente normalizado
        await pool.query(`
            UPDATE transactions 
            SET fine = 0,
                interest = 0,
                original_amount = 21396.00,
                amount = 21396.00,
                solidcon_interest_key = NULL,
                updated_at = NOW()
            WHERE description LIKE '%21917%' OR solidcon_key = '133302'
        `);

        logger.info('Migration 245: Finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Error running migration 245');
    }
}
