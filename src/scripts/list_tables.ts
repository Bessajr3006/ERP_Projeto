import 'dotenv/config';
import pool from '../config/db';

async function main() {
    try {
        const [tables] = await pool.query<any[]>('SHOW TABLES');
        console.log('Tables in DB:');
        console.log(tables.map(t => Object.values(t)[0]));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
