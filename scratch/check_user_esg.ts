import 'dotenv/config';
import pool from '../src/config/db';

async function checkUser() {
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', ['r@esg.com']) as any;
        console.log('USER INFO:', JSON.stringify(rows[0], null, 2));

        if (rows[0]) {
            const [perms] = await pool.query('SELECT * FROM role_permissions WHERE role = ? AND company_id = ?', [rows[0].role, rows[0].company_id]) as any;
            console.log('PERMISSIONS INFO:', JSON.stringify(perms, null, 2));
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkUser();
