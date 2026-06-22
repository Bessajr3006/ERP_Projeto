import 'dotenv/config';
import pool from '../config/db';

async function main() {
    try {
        console.log('Querying foreign keys referencing users table...');
        const [rows] = await pool.query<any[]>(`
            SELECT 
                TABLE_NAME, 
                COLUMN_NAME, 
                CONSTRAINT_NAME, 
                REFERENCED_TABLE_NAME, 
                REFERENCED_COLUMN_NAME
            FROM 
                INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE 
                REFERENCED_TABLE_NAME = 'users'
                AND TABLE_SCHEMA = DATABASE()
        `);

        console.table(rows);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

main();
