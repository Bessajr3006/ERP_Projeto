import 'dotenv/config';
import { UserService } from '../services/userService';
import pool from '../config/db';

async function main() {
    try {
        // Let's find a user without operations. We saw user ID 26 (company 4) has is_deletable = 1.
        // Let's get the user's details first.
        const companyId = 4;
        const targetPublicId = 'ce0fe699-2781-458c-b216-cda52e95a474';

        console.log(`Attempting to delete user ${targetPublicId} from company ${companyId}...`);
        await UserService.delete(companyId, targetPublicId);
        console.log('Success! User deleted.');
    } catch (err: any) {
        console.error('Failed to delete user:', err);
    } finally {
        await pool.end();
    }
}

main();
