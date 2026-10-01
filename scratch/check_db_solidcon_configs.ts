import { pool } from './dist/config/database';

async function main() {
    try {
        console.log('\n--- 1. COMPANY SOLIDCON CONFIGS ---');
        const [configs]: any = await pool.query(`
            SELECT id, company_id, name, serv_solidcon, bd_solidcon, login_solidcon, is_default, cdfilial, cdpdv 
            FROM company_solidcon_configs
        `);
        console.table(configs);

        console.log('\n--- 2. COMPANIES SOLIDCON CREDENTIALS ---');
        const [companies]: any = await pool.query(`
            SELECT id, trade_name, company_name, serv_solidcon, bd_solidcon, login_solidcon, serv_dorsal, bd_dorsal
            FROM companies
        `);
        console.table(companies);
    } catch (e: any) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

main();
