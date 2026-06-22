import dotenv from 'dotenv';
dotenv.config({ override: true });
const pool = require('../config/db').default;
import { randomUUID } from 'crypto';

async function main() {
    try {
        const publicId = randomUUID();
        const name = 'Combustível';
        const description = 'Despesas com combustível de veículos';
        
        console.log('Inserting test category type...');
        const [result]: any = await pool.query(
            `INSERT INTO finance_category_types (public_id, company_id, name, description) 
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE description = VALUES(description)`,
            [publicId, 2, name, description]
        );
        console.log('Inserted/Updated successfully! Result:', result);
    } catch (e: any) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
    }
}

main();
