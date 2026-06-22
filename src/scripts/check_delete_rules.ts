import 'dotenv/config';
import pool from '../config/db';

async function main() {
    try {
        console.log('Querying delete rules for foreign keys referencing users table...');
        const [rows] = await pool.query<any[]>(`
            SELECT 
                rc.CONSTRAINT_NAME, 
                rc.TABLE_NAME, 
                rc.REFERENCED_TABLE_NAME, 
                rc.DELETE_RULE, 
                rc.UPDATE_RULE
            FROM 
                INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
            WHERE 
                rc.REFERENCED_TABLE_NAME = 'users'
                AND rc.CONSTRAINT_SCHEMA = DATABASE()
        `);

        console.table(rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
