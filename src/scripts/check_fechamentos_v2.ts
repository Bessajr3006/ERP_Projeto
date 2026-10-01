import 'dotenv/config';
import pool from '../config/db';

async function main() {
    try {
        const [rows]: any = await pool.query('SELECT * FROM fechamentos');
        console.log('Fechamentos count:', rows.length);
        console.log('Rows:', rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
main();
