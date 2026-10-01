import 'dotenv/config';
import pool from '../src/config/db';

async function main() {
    const [companies]: any = await pool.query('SELECT id, company_name, serv_solidcon, bd_solidcon, login_solidcon, senha_solidcon FROM companies WHERE serv_solidcon IS NOT NULL');
    console.log('Companies configured with Solidcon:', companies.map((c: any) => ({ id: c.id, name: c.company_name, serv: c.serv_solidcon, bd: c.bd_solidcon, user: c.login_solidcon })));
    
    const [customers]: any = await pool.query('SELECT id, company_id, name, only_solidcon_baixa, exempt_interest_fine FROM customers WHERE only_solidcon_baixa = 1');
    console.log('Customers with only_solidcon_baixa = 1:', customers);

    // Let's also check transactions of these customers
    if (customers.length > 0) {
        const customerIds = customers.map((c: any) => c.id);
        const [txs]: any = await pool.query(
            `SELECT t.id, t.company_id, t.customer_id, t.description, t.solidcon_key, t.amount, t.status, t.solidcon_quitado, t.received_at, c.name as customer_name 
             FROM transactions t 
             JOIN customers c ON c.id = t.customer_id 
             WHERE t.customer_id IN (?)`,
            [customerIds]
        );
        console.log(`Found ${txs.length} transactions for customers with only_solidcon_baixa = 1:`, txs);
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
