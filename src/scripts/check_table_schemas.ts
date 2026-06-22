import 'dotenv/config';
import pool from '../config/db';

async function main() {
    try {
        const tables = ['email_config', 'ui_preferences', 'whatsapp_business_sessions', 'tasks'];
        for (const table of tables) {
            const [rows] = await pool.query<any[]>(`SHOW CREATE TABLE ${table}`);
            console.log(`\n--- CREATE TABLE ${table} ---`);
            console.log(rows[0]['Create Table']);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
