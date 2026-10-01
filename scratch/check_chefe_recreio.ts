import 'dotenv/config';
import pool from '../src/config/db';

async function main() {
    console.log('--- TRANSAÇÕES DO CLIENTE CHEFE RECREIO (customer_id = 1865) ---');
    const [rows]: any = await pool.query(`
        SELECT id, public_id, description, amount, original_amount, fine, interest, net_amount, date, date_launch, received_at, status, type, payment_method, pdv, cdfilial, solidcon_key, solidcon_quitado, solidcon_interest_key
        FROM transactions
        WHERE customer_id = 1865 OR description LIKE '%CHEFE RECREIO%'
        ORDER BY date DESC, id DESC
    `);
    console.log(JSON.stringify(rows, null, 2));

    await pool.end();
}

main().catch(console.error);
