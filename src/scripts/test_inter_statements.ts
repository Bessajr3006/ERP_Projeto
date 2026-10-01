import pool from '../config/db';
import { BankAccountService } from '../services/bankAccountService';
import { InterService } from '../services/bankAccountApi/interService';

async function main() {
    try {
        const bankAccount = await BankAccountService.getById(2, 2); // id = 2, company_id = 2
        console.log('Testing statement sync for account:', bankAccount.name, 'Company ID:', bankAccount.company_id);

        const startDate = '2026-06-01';
        const endDate = '2026-09-30';

        console.log(`Syncing from ${startDate} to ${endDate}...`);
        
        const count = await InterService.syncStatements(bankAccount.company_id, bankAccount, startDate, endDate);
        console.log(`Sync completed successfully. Synced ${count} new statements.`);

        const [stmtCountRows]: any = await pool.query(
            `SELECT count(*) as total FROM bank_statements WHERE bank_account_id = 2`
        );
        console.log('Total statements in DB for account 2:', stmtCountRows[0].total);

    } catch (e: any) {
        console.error('Error during statement sync test:', e.stack || e.message || e);
    } finally {
        await pool.end();
    }
}

main();

