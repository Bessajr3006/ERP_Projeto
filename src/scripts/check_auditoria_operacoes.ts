import 'dotenv/config';
import pool from '../config/db';

async function main() {
    try {
        const [rows] = await pool.query<any[]>(`SHOW CREATE TABLE auditoria_operacoes`);
        console.log(`\n--- CREATE TABLE auditoria_operacoes ---`);
        console.log(rows[0]['Create Table']);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
