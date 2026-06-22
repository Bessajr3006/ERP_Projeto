import 'dotenv/config';
import pool from '../config/db';

async function main() {
    try {
        const [rows] = await pool.query('SELECT * FROM whatsapp_business_sessions');
        console.log('WhatsApp Business Sessions in Database:');
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error('Error querying sessions:', error);
    } finally {
        await pool.end();
    }
}

main();
