import 'dotenv/config';
import pool from '../config/db';

async function main() {
    try {
        const [rows] = await pool.query('SELECT id, company_name, whatsapp_business_scope FROM companies WHERE id = 2');
        console.log('Company Scope Details:');
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error('Error querying company:', error);
    } finally {
        await pool.end();
    }
}

main();
