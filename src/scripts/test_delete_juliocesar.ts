import 'dotenv/config';
import pool from '../config/db';
import { UserService } from '../services/userService';

async function main() {
    try {
        const [users] = await pool.query<any[]>(
            `SELECT company_id, public_id FROM users WHERE email = ?`,
            ['juliocesar@gmail.com']
        );
        if (users.length === 0) {
            console.log('User not found!');
            return;
        }
        const { company_id, public_id } = users[0];
        console.log(`Calling UserService.getById for company_id = ${company_id}, public_id = ${public_id}...`);
        
        const user = await UserService.getById(company_id, public_id);
        console.log('User retrieved successfully:', user);
    } catch (err) {
        console.error('UserService.getById failed with error:', err);
    } finally {
        await pool.end();
    }
}

main();
