import 'dotenv/config';
import pool from '../config/db';

async function main() {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
        console.log('--- STARTING USER DELETION ROBUST TESTING ---');

        // Test Case 1: Create a totally clean user with no operations
        const cleanUserEmail = 'test_clean_user@keystone.local';
        const cleanUserPublicId = 'c0000000-0000-0000-0000-000000000001';
        await connection.query(
            `INSERT INTO users (id, public_id, company_id, email, password_hash, full_name, role, is_active) 
             VALUES (9001, ?, 9009, ?, 'hash', 'Clean User Test', 'user', TRUE)`,
            [cleanUserPublicId, cleanUserEmail]
        );

        // Test Case 2: Create a user with a transaction
        const txUserEmail = 'test_tx_user@keystone.local';
        const txUserPublicId = 'c0000000-0000-0000-0000-000000000002';
        await connection.query(
            `INSERT INTO users (id, public_id, company_id, email, password_hash, full_name, role, is_active) 
             VALUES (9002, ?, 9009, ?, 'hash', 'Tx User Test', 'user', TRUE)`,
            [txUserPublicId, txUserEmail]
        );
        // Add transaction
        await connection.query(
            `INSERT INTO transactions (public_id, company_id, bank_account_id, category_id, user_id, description, amount, type, date, status)
             VALUES ('t0000000-0000-0000-0000-000000000001', 9009, 1, 1, 9002, 'Test Transaction', 10.00, 'income', '2026-06-19', 'paid')`
        );

        // Test Case 3: Create a user with a sales order
        const salesUserEmail = 'test_sales_user@keystone.local';
        const salesUserPublicId = 'c0000000-0000-0000-0000-000000000003';
        await connection.query(
            `INSERT INTO users (id, public_id, company_id, email, password_hash, full_name, role, is_active) 
             VALUES (9003, ?, 9009, ?, 'hash', 'Sales User Test', 'user', TRUE)`,
            [salesUserPublicId, salesUserEmail]
        );
        // Add sales order
        await connection.query(
            `INSERT INTO sales_orders (id, public_id, company_id, customer_id, seller_id, date, status, total_amount)
             VALUES (9001, 's0000000-0000-0000-0000-000000000001', 9009, 1, 9003, '2026-06-19 12:00:00', 'completed', 150.00)`
        );

        // Test Case 4: Create a user with a customer association
        const customerUserEmail = 'test_customer_user@keystone.local';
        const customerUserPublicId = 'c0000000-0000-0000-0000-000000000004';
        await connection.query(
            `INSERT INTO users (id, public_id, company_id, email, password_hash, full_name, role, is_active) 
             VALUES (9004, ?, 9009, ?, 'hash', 'Customer User Test', 'user', TRUE)`,
            [customerUserPublicId, customerUserEmail]
        );
        // Add customer pointing to user 9004 as seller
        await connection.query(
            `INSERT INTO customers (id, public_id, company_id, name, seller_user_id)
             VALUES (9001, 'c0000000-0000-0000-0000-000000000001', 9009, 'Test Customer', 9004)`
        );

        // Test Case 5: Create a user with a task
        const taskUserEmail = 'test_task_user@keystone.local';
        const taskUserPublicId = 'c0000000-0000-0000-0000-000000000005';
        await connection.query(
            `INSERT INTO users (id, public_id, company_id, email, password_hash, full_name, role, is_active) 
             VALUES (9005, ?, 9009, ?, 'hash', 'Task User Test', 'user', TRUE)`,
            [taskUserPublicId, taskUserEmail]
        );
        // Add task
        await connection.query(
            `INSERT INTO tasks (public_id, company_id, title, assigned_user_public_id, status)
             VALUES ('tk000000-0000-0000-0000-000000000001', 9009, 'Test Task', ?, 'pending')`,
            [taskUserPublicId]
        );

        // Test Case 6: Create a clean user but with settings/preferences to test cascade deletion
        const settingsUserEmail = 'test_settings_user@keystone.local';
        const settingsUserPublicId = 'c0000000-0000-0000-0000-000000000006';
        await connection.query(
            `INSERT INTO users (id, public_id, company_id, email, password_hash, full_name, role, is_active) 
             VALUES (9006, ?, 9009, ?, 'hash', 'Settings User Test', 'user', TRUE)`,
            [settingsUserPublicId, settingsUserEmail]
        );
        // Add email_config, ui_preferences, whatsapp_business_sessions
        await connection.query(
            `INSERT INTO email_config (company_id, user_public_id, smtp_host, smtp_port, smtp_user, sender_name, sender_email)
             VALUES (9009, ?, 'smtp.mail.com', 587, 'user', 'Sender', 'sender@mail.com')`,
            [settingsUserPublicId]
        );
        await connection.query(
            `INSERT INTO ui_preferences (company_id, user_public_id, theme)
             VALUES (9009, ?, 'light')`,
            [settingsUserPublicId]
        );
        await connection.query(
            `INSERT INTO whatsapp_business_sessions (company_id, owner_type, owner_id, company_key, owner_key, session_key)
             VALUES (9009, 'user', 9006, 'key1', 'key2', 'key3')`
        );

        console.log('\n--- VERIFYING is_deletable CALCULATIONS ---');
        // Let's query using the database driver directly with the updated SELECT expression to see if values match:
        const checkIsDeletable = async (userId: number, label: string) => {
            const [rows] = await connection.query<any[]>(`
                SELECT (
                    NOT EXISTS (SELECT 1 FROM transactions t WHERE t.user_id = users.id LIMIT 1)
                    AND NOT EXISTS (SELECT 1 FROM sales_orders s WHERE s.seller_id = users.id LIMIT 1)
                    AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.seller_user_id = users.id LIMIT 1)
                    AND NOT EXISTS (SELECT 1 FROM tasks tk WHERE tk.assigned_user_public_id = users.public_id LIMIT 1)
                ) AS is_deletable
                FROM users
                WHERE id = ?
            `, [userId]);
            console.log(`User ID ${userId} (${label}): is_deletable = ${rows[0].is_deletable}`);
            return rows[0].is_deletable;
        };

        const d1 = await checkIsDeletable(9001, 'Totally Clean User');
        const d2 = await checkIsDeletable(9002, 'User with Transaction');
        const d3 = await checkIsDeletable(9003, 'User with Sales Order');
        const d4 = await checkIsDeletable(9004, 'User with Customer link');
        const d5 = await checkIsDeletable(9005, 'User with Task assigned');
        const d6 = await checkIsDeletable(9006, 'User with Settings configs only');

        // Assertions
        if (d1 !== 1) console.error('FAIL: Clean user should be deletable!');
        if (d2 !== 0) console.error('FAIL: User with transactions should NOT be deletable!');
        if (d3 !== 0) console.error('FAIL: User with sales order should NOT be deletable!');
        if (d4 !== 0) console.error('FAIL: User with customer link should NOT be deletable!');
        if (d5 !== 0) console.error('FAIL: User with task assigned should NOT be deletable!');
        if (d6 !== 1) console.error('FAIL: User with settings only should be deletable!');

        console.log('\n--- TESTING DELETION / CASCADE LOGIC ---');
        
        // Let's run a test deletion of User 9006 (Settings User) using the same statements as in deleteByCompanyAndPublicId
        console.log('Cascade-deleting Settings User (9006)...');
        await connection.query(`DELETE FROM email_config WHERE user_public_id = ?`, [settingsUserPublicId]);
        await connection.query(`DELETE FROM ui_preferences WHERE company_id = ? AND user_public_id = ?`, [9009, settingsUserPublicId]);
        await connection.query(`DELETE FROM whatsapp_business_sessions WHERE company_id = ? AND owner_type = 'user' AND owner_id = ?`, [9009, 9006]);
        const [delRes] = await connection.query<any>(`DELETE FROM users WHERE id = 9006`);
        console.log('Users delete affectedRows:', delRes.affectedRows);

        // Verify that they are gone from child tables:
        const [emailConf] = await connection.query<any[]>(`SELECT count(*) as count FROM email_config WHERE user_public_id = ?`, [settingsUserPublicId]);
        const [uiPref] = await connection.query<any[]>(`SELECT count(*) as count FROM ui_preferences WHERE user_public_id = ?`, [settingsUserPublicId]);
        const [waSession] = await connection.query<any[]>(`SELECT count(*) as count FROM whatsapp_business_sessions WHERE owner_type = 'user' AND owner_id = 9006`);
        console.log(`Remaining in email_config: ${emailConf[0].count}`);
        console.log(`Remaining in ui_preferences: ${uiPref[0].count}`);
        console.log(`Remaining in whatsapp_business_sessions: ${waSession[0].count}`);

        if (emailConf[0].count !== 0 || uiPref[0].count !== 0 || waSession[0].count !== 0) {
            console.error('FAIL: Configurations were not successfully cascade deleted!');
        } else {
            console.log('SUCCESS: All related configurations and sessions were successfully cleaned up!');
        }

        console.log('\nRolling back test transaction...');
        await connection.rollback();
        console.log('Rollback complete. DB cleaned.');

    } catch (err) {
        console.error('Test execution failed with error:', err);
        await connection.rollback();
    } finally {
        connection.release();
        await pool.end();
    }
}

main();
