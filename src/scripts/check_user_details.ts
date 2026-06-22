import 'dotenv/config';
import pool from '../config/db';

async function main() {
    try {
        console.log('Querying detailed user reference counts...');
        const [users] = await pool.query<any[]>(`
            SELECT 
                u.id, 
                u.public_id, 
                u.email, 
                u.full_name, 
                u.role,
                (SELECT COUNT(*) FROM transactions t WHERE t.user_id = u.id) AS tx_count,
                (SELECT COUNT(*) FROM sales_orders s WHERE s.seller_id = u.id) AS sales_count,
                (SELECT COUNT(*) FROM customers c WHERE c.seller_user_id = u.id) AS customer_count,
                (SELECT COUNT(*) FROM audit_logs a WHERE a.user_id = u.id) AS audit_count,
                (SELECT COUNT(*) FROM email_config e WHERE e.user_public_id = u.public_id) AS email_config_count,
                (SELECT COUNT(*) FROM ui_preferences p WHERE p.user_public_id = u.public_id) AS ui_pref_count,
                (SELECT COUNT(*) FROM whatsapp_business_sessions w WHERE w.user_id = u.id) AS wa_session_count
            FROM users u
        `);

        console.table(users.map(u => ({
            id: u.id,
            email: u.email,
            full_name: u.full_name,
            role: u.role,
            tx: u.tx_count,
            sales: u.sales_count,
            customers: u.customer_count,
            audit: u.audit_count,
            email_config: u.email_config_count,
            ui_pref: u.ui_pref_count,
            wa_session: u.wa_session_count
        })));

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
