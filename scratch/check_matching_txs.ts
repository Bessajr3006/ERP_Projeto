import 'dotenv/config';
import pool from '../src/config/db';

async function main() {
    const keys = ['133372', '133373', '133380', '133348', '133351', '133350', '133349', '133352'];
    const [rows]: any = await pool.query(
        `SELECT t.id, t.company_id, t.customer_id, c.name as customer_name, c.only_solidcon_baixa, t.description, t.solidcon_key, t.amount, t.status, t.solidcon_quitado, t.received_at
         FROM transactions t
         JOIN customers c ON c.id = t.customer_id
         WHERE t.solidcon_key IN (?)`,
        [keys]
    );
    console.log('Matching transactions in Keystone:', rows);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
