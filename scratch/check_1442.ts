import 'dotenv/config';
import pool from '../src/config/db';

async function main() {
    const [rows]: any = await pool.query('SELECT * FROM transactions WHERE id = 1442');
    console.log(rows);
    await pool.end();
}

main().catch(console.error);
