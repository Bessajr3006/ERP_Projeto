import { pool } from '../src/database/conn';

async function main() {
    try {
        const [rows] = await pool.query('SELECT * FROM company_poscontrol_configs');
        console.log('Configs:', JSON.stringify(rows, null, 2));
        
        const [companies] = await pool.query('SELECT id, name, public_id FROM companies');
        console.log('Companies:', JSON.stringify(companies, null, 2));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

main();
