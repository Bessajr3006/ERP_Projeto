import dotenv from 'dotenv';
dotenv.config({ override: true });
const pool = require('../config/db').default;

async function main() {
    try {
        const [companies]: any = await pool.query('SELECT * FROM companies');
        console.log('Companies:', companies);

        const [users]: any = await pool.query('SELECT id, public_id, company_id, email, role, full_name FROM users');
        console.log('\nUsers:', users);

        const [perms]: any = await pool.query(
            "SELECT * FROM role_permissions WHERE module = 'finance_category_types'"
        );
        console.log('\nRole Permissions for finance_category_types:', perms);
    } catch (e: any) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
    }
}

main();
