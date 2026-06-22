import dotenv from 'dotenv';
dotenv.config({ override: true });
const pool = require('../config/db').default;
import { CategoryTypeSchema } from '../schemas/financeSchemas';
import { randomUUID } from 'crypto';

async function main() {
    try {
        const publicId = randomUUID();
        console.log('Inserting test category type...');
        const [result]: any = await pool.query(
            `INSERT INTO finance_category_types (public_id, company_id, name, description) VALUES (?, ?, ?, ?)`,
            [publicId, 2, 'Test Category Type ' + Date.now(), 'Test Description']
        );
        const insertId = result.insertId;
        console.log('Inserted ID:', insertId);

        const [rows]: any = await pool.query('SELECT * FROM finance_category_types WHERE id = ?', [insertId]);
        console.log('Row from DB:', rows[0]);

        try {
            CategoryTypeSchema.parse(rows[0]);
            console.log('Row parsed successfully!');
        } catch (e: any) {
            console.error('Row parsing failed:', e.errors || e.message);
        }

        // Clean up
        await pool.query('DELETE FROM finance_category_types WHERE id = ?', [insertId]);
        console.log('Cleaned up test row.');
    } catch (e: any) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
    }
}

main();
