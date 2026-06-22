import 'dotenv/config';
import pool from '../config/db';

async function main() {
    try {
        const [rows] = await pool.query<any[]>(`
            SELECT 
                u.id, 
                u.email, 
                (SELECT COUNT(*) FROM transactions WHERE user_id = u.id) AS tx_count_1,
                (SELECT COUNT(*) FROM transactions WHERE user_id = 31) AS tx_count_2
            FROM users u
            WHERE u.id = 31
        `);
        console.table(rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
