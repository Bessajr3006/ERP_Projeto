import 'dotenv/config';
import pool from '../src/config/db';

async function main() {
    const [rows]: any = await pool.query(`SELECT * FROM customers WHERE id = 1865 OR name LIKE '%CHEFE RECREIO%'`);
    console.log(rows);
    await pool.end();
}

main().catch(console.error);
