import pool from '../config/db';
import logger from '../config/logger';

/**
 * Migration 58: Garante que 'progress' existe nos ENUMs de status de
 * sales_orders e transactions.
 *
 * Contexto: em bancos criados a partir de schema.sql anterior à adição do valor
 * 'progress', as colunas de status não tinham esse valor, causando erro de
 * truncamento ao criar uma venda (INSERT com status='progress').
 *
 * O MODIFY COLUMN é idempotente: se o ENUM já contiver 'progress' (banco criado
 * do schema atual), a operação não altera dados existentes.
 */
export default async function runMigration(): Promise<void> {
    let conn;
    try {
        conn = await pool.getConnection();

        logger.info('Running migration: run_migration_58_sales_progress_status');

        // Corrige ENUM em sales_orders
        await conn.query(`
            ALTER TABLE sales_orders
            MODIFY COLUMN status
                ENUM('pending','progress','completed','cancelled','separated','invoiced')
                NOT NULL DEFAULT 'pending'
        `);

        // Corrige ENUM em transactions
        await conn.query(`
            ALTER TABLE transactions
            MODIFY COLUMN status
                ENUM('pending','progress','paid','cancelled')
                NOT NULL DEFAULT 'paid'
        `);

        logger.info('Migration run_migration_58_sales_progress_status finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_58_sales_progress_status');
        throw err;
    } finally {
        if (conn) conn.release();
    }
}
