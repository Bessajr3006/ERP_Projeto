import 'dotenv/config';
import pool from '../config/db';

async function main() {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [users] = await connection.query<any[]>(
            `SELECT company_id FROM users WHERE public_id = ?`,
            ['7d7e870a-6467-4ab9-93b2-90c80f608e42']
        );
        if (users.length === 0) {
            console.log('User not found!');
            await connection.rollback();
            return;
        }
        const companyId = users[0].company_id;
        console.log(`User found in company_id: ${companyId}. Attempting delete...`);
        
        const [result] = await connection.query<any>(
            `DELETE FROM users WHERE company_id = ? AND public_id = ?`,
            [companyId, '7d7e870a-6467-4ab9-93b2-90c80f608e42']
        );
        console.log('Delete result:', result);
        await connection.rollback();
        console.log('Rollback successful.');
    } catch (err) {
        console.error('Delete failed with error:', err);
        await connection.rollback();
    } finally {
        connection.release();
        await pool.end();
    }
}

main();
