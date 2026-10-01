import pool from './src/config/db';
import { BankAccountService } from './src/services/bankAccountService';
import { InterService } from './src/services/bankAccountApi/interService';

async function main() {
    const companyId = 2; // Let's check companyId for account 2. We can query first.
    try {
        const [accRows]: any = await pool.query(`SELECT * FROM bank_accounts WHERE id = 2`);
        if (accRows.length === 0) {
            console.error('Account 2 not found');
            return;
        }
        const bankAccount = accRows[0];
        console.log('Testing statement sync for account:', bankAccount.name, 'Company ID:', bankAccount.company_id);

        const today = new Date();
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(today.getDate() - 3);

        const startDate = threeDaysAgo.toISOString().slice(0, 10);
        const endDate = today.toISOString().slice(0, 10);

        console.log(`Syncing from ${startDate} to ${endDate}...`);
        
        const count = await InterService.syncStatements(bankAccount.company_id, bankAccount, startDate, endDate);
        console.log(`Sync completed. Synced ${count} new statements.`);

        // Query bank statements
        const [stmtRows]: any = await pool.query(
            `SELECT date, description, amount, type FROM bank_statements WHERE bank_account_id = 2 ORDER BY date DESC LIMIT 10`
        );
        console.log('Last 10 statements in DB:', JSON.stringify(stmtRows, null, 2));

    } catch (e: any) {
        console.error('Error during statement sync test:', e.message || e);
    } finally {
        await pool.end();
    }
}

main();
