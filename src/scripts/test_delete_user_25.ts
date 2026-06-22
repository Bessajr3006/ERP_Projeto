import 'dotenv/config';
import pool from '../config/db';

async function main() {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        console.log('Attempting to delete user 25 (public_id: 956e4b18-8587-43a5-bbad-a604c48eb4ca)...');
        const [result] = await connection.query<any>(
            `DELETE FROM users WHERE company_id = ? AND public_id = ?`,
            [4, '956e4b18-8587-43a5-bbad-a604c48eb4ca']
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
