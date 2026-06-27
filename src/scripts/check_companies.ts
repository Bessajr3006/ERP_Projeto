import 'dotenv/config';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';

async function main() {
    console.log('--- DB STATS PER COMPANY ---');
    
    const [companies] = await pool.query<RowDataPacket[]>('SELECT id, trade_name FROM companies');
    for (const company of companies) {
        console.log(`\nCompany: ${company.trade_name} (ID: ${company.id})`);
        
        const [users] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM users WHERE company_id = ?', [company.id]);
        const [transactions] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM transactions WHERE company_id = ?', [company.id]);
        const [sales] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM sales_orders WHERE company_id = ?', [company.id]);
        const [products] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM products WHERE company_id = ?', [company.id]);
        const [customers] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM customers WHERE company_id = ?', [company.id]);
        
        console.log(`  Users: ${users[0].count}`);
        console.log(`  Transactions: ${transactions[0].count}`);
        console.log(`  Sales Orders: ${sales[0].count}`);
        console.log(`  Products: ${products[0].count}`);
        console.log(`  Customers: ${customers[0].count}`);
    }
    
    await pool.end();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
