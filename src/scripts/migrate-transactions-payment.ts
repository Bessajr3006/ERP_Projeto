import dotenv from 'dotenv';
dotenv.config();

import pool from '../config/db';

async function migrate() {
    console.log('Starting Transactions Payment Method migration...');
    const conn = await pool.getConnection();

    try {
        await conn.query('START TRANSACTION');

        console.log('Adding payment_method column to transactions...');
        await conn.query(`
            ALTER TABLE transactions 
            ADD COLUMN payment_method ENUM('pix', 'credit', 'debit', 'cash', 'transfer', 'boleto') NULL COMMENT 'Forma de Pagamento' AFTER type
        `);

        await conn.query('COMMIT');
        console.log('Migration successful: payment_method added!');
    } catch (e: any) {
        await conn.query('ROLLBACK');
        console.error('Migration failed:', e.message);
        // If column already exists
    } finally {
        conn.release();
        process.exit(0);
    }
}

migrate();
