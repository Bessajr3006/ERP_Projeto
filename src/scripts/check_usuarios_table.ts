import 'dotenv/config';
import pool from '../config/db';

async function main() {
    try {
        const [rows] = await pool.query<any[]>('SELECT * FROM usuarios');
        console.log('Rows in usuarios table:', rows.length);
        console.table(rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
