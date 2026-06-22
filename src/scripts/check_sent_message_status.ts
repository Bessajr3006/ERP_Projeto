import 'dotenv/config';
import pool from '../config/db';

async function main() {
    try {
        const [rows] = await pool.query(`
            SELECT id, contact_phone, direction, message_type, status, message_id, created_at, updated_at
            FROM whatsapp_business_messages
            WHERE company_id = 2
            ORDER BY id DESC
            LIMIT 5
        `);
        console.log('Recent WhatsApp Messages:');
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error('Error querying messages:', error);
    } finally {
        await pool.end();
    }
}

main();
