import 'dotenv/config';
import { FinanceService } from '../src/services/financeService';

async function test() {
    console.log('Testing cleanDuplicateSolidconBaixas for company 12...');
    const res = await FinanceService.cleanDuplicateSolidconBaixas(12);
    console.log('Clean result:', JSON.stringify(res, null, 2));
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
