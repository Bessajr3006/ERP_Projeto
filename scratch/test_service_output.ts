import { ExternalDbService } from './dist/services/externalDbService.js';

async function main() {
    try {
        const config = {
            host: '138.121.72.106',
            database: 'solidcon',
            user: 'sa',
            password: '30mariafn@'
        };

        console.log('=== TESTE 1: 01/06/2025 a 01/06/2025 (cnt_lancamento) ===');
        const res1 = await ExternalDbService.getSolidconAccountingEntries(config, {
            startDate: '2025-06-01',
            endDate: '2025-06-01',
            source: 'cnt_lancamento'
        });
        console.log(`Total de lançamentos contábeis retornados em 01/06/2025: ${res1.length}`);
        console.table(res1.slice(0, 15).map(r => ({
            id: r.id,
            date: r.entry_date,
            doc: r.document_ref,
            history: (r.history || '').substring(0, 40),
            amount: r.amount,
            debCode: r.debit_account_code,
            credCode: r.credit_account_code
        })));

        console.log('\n=== TESTE 2: 01/06/2025 a 01/06/2025 (all) ===');
        const resAll = await ExternalDbService.getSolidconAccountingEntries(config, {
            startDate: '2025-06-01',
            endDate: '2025-06-01',
            source: 'all'
        });
        console.log(`Total de movimentos retornados em 01/06/2025 (TODAS AS ORIGENS): ${resAll.length}`);

        console.log('\n=== TESTE 3: 01/06/2025 a 30/06/2025 (cnt_lancamento) ===');
        const resMonth = await ExternalDbService.getSolidconAccountingEntries(config, {
            startDate: '2025-06-01',
            endDate: '2025-06-30',
            source: 'cnt_lancamento'
        });
        console.log(`Total de lançamentos contábeis retornados no mês 06/2025: ${resMonth.length}`);

        console.log('\n=== TESTE 4: 01/09/2026 a 30/09/2026 (cnt_lancamento) ===');
        const resSep2026 = await ExternalDbService.getSolidconAccountingEntries(config, {
            startDate: '2026-09-01',
            endDate: '2026-09-30',
            source: 'cnt_lancamento'
        });
        console.log(`Total de lançamentos contábeis retornados no mês 09/2026: ${resSep2026.length}`);

    } catch (e: any) {
        console.error('Erro:', e);
    } finally {
        process.exit(0);
    }
}

main();
