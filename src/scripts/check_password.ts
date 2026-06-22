import 'dotenv/config';
import pool from '../config/db';
import bcrypt from 'bcryptjs';

async function testPassword() {
    try {
        const email = 'admin@empresa1.com';
        const passwordRaw = '123';

        const [users] = await pool.query<any[]>('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            console.log('User not found in DB');
            return;
        }

        const user = users[0];
        console.log('User email:', user.email);
        console.log('Password Hash in DB:', user.password_hash);
        console.log('Is Active:', user.is_active);

        const isValid = await bcrypt.compare(passwordRaw, user.password_hash);
        console.log('Is Password valid (bcrypt.compare):', isValid);

        const newHash = await bcrypt.hash(passwordRaw, 10);
        console.log('New Hash generated from "123":', newHash);
        const isValidNew = await bcrypt.compare(passwordRaw, newHash);
        console.log('Is Password valid with new hash:', isValidNew);

    } catch (e: any) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}
testPassword();
