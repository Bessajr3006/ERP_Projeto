import 'dotenv/config';
import pool from '../config/db';

async function main() {
    try {
        console.log('Querying users...');
        const [users] = await pool.query<any[]>(`
            SELECT 
                u.id, 
                u.public_id, 
                u.email, 
                u.full_name, 
                u.role, 
                u.is_active,
                NOT EXISTS (SELECT 1 FROM transactions t WHERE t.company_id = u.company_id AND t.user_id = u.id LIMIT 1) AS is_deletable,
                (SELECT COUNT(*) FROM transactions t WHERE t.user_id = u.id) AS tx_count
            FROM users u
        `);

        console.log('Users in DB:');
        console.table(users.map(u => ({
            id: u.id,
            public_id: u.public_id,
            email: u.email,
            full_name: u.full_name,
            role: u.role,
            is_active: u.is_active,
            is_deletable: u.is_deletable,
            tx_count: u.tx_count
        })));

    } catch (err) {
        console.error('Error running check:', err);
    } finally {
        await pool.end();
    }
}

main();
