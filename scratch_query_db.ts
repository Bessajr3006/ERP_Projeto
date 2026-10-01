import pool from './src/config/db';

async function run() {
    try {
        const [companies] = await pool.query<any>('SELECT id, company_name, is_general_admin, cnpj FROM companies WHERE id = 12');
        console.log('Company 12 details:', companies);

        const [customers] = await pool.query<any>('SELECT id, name, cnpj_cpf, company_id FROM customers WHERE company_id = 12');
        console.log('Customers with company_id = 12:', customers);

        const [allCustomers] = await pool.query<any>('SELECT id, name, cnpj_cpf, company_id FROM customers LIMIT 5');
        console.log('Sample of all customers:', allCustomers);
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
