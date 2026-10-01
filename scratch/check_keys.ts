import 'dotenv/config';
import pool from '../src/config/db';

async function main() {
    const [rows]: any = await pool.query(`
        SELECT * FROM transactions 
        WHERE description LIKE '%21917%' 
           OR solidcon_key IN ('70232', '133302') 
           OR solidcon_interest_key IN ('70232', '133302', '160791', '116955', '120514')
    `);
    console.log('Transactions matching keys:', rows);
    await pool.end();
}

main().catch(console.error);
