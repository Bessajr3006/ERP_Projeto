import 'dotenv/config';
import pool from '../config/db';

async function main() {
    try {
        console.log('Querying constraints referencing users table...');
        const [constraints] = await pool.query<any[]>(`
            SELECT 
                TABLE_NAME, 
                COLUMN_NAME, 
                CONSTRAINT_NAME, 
                REFERENCED_TABLE_NAME, 
                REFERENCED_COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE REFERENCED_TABLE_NAME = 'users'
        `);
        console.table(constraints);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

main();
