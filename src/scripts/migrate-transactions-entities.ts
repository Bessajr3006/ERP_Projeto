import dotenv from 'dotenv';
dotenv.config();

import pool from '../config/db';

async function migrate() {
    console.log('Starting Transactions Entities migration...');
    const conn = await pool.getConnection();

    try {
        await conn.query('START TRANSACTION');

        console.log('Adding customer_id and supplier_id columns...');
        await conn.query(`
            ALTER TABLE transactions 
            ADD COLUMN customer_id INT NULL COMMENT 'Vinculo com cliente (Receita)' AFTER category_id,
            ADD COLUMN supplier_id INT NULL COMMENT 'Vinculo com fornecedor (Despesa)' AFTER customer_id
        `);

        console.log('Adding Foreign Keys...');
        await conn.query(`
            ALTER TABLE transactions
            ADD CONSTRAINT fk_transactions_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
            ADD CONSTRAINT fk_transactions_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
        `);

        await conn.query('COMMIT');
        console.log('Migration successful!');
    } catch (e: any) {
        await conn.query('ROLLBACK');
        console.error('Migration failed:', e.message);
        // If column already exists, it might throw ER_DUP_FIELDNAME. We can ignore if it's already there.
    } finally {
        conn.release();
        process.exit(0);
    }
}

migrate();
