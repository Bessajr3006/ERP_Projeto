import 'dotenv/config';
import pool from '../src/config/db';

async function check() {
    const [rows]: any = await pool.query(`
        SELECT count(*) as total,
               SUM(CASE WHEN c.only_solidcon_baixa = 1 THEN 1 ELSE 0 END) as only_solidcon_count
        FROM transactions t
        LEFT JOIN customers c ON c.id = t.customer_id
        WHERE t.company_id = 12
          AND (c.only_solidcon_baixa = 1 OR t.solidcon_key IS NOT NULL OR t.description LIKE '%Cupom%')
    `);
    console.log('Matching transactions count:', rows[0]);
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
