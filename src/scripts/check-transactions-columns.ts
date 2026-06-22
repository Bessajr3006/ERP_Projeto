import 'dotenv/config';
import pool from '../config/db';

async function main() {
    try {
        const [rows]: any = await pool.query('SHOW COLUMNS FROM transactions');
        console.log('Columns in transactions table:');
        rows.forEach((row: any) => {
            console.log(`- ${row.Field} (${row.Type}) Null: ${row.Null}`);
        });
    } catch (e: any) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
    }
}

main();
