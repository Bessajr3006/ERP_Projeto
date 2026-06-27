import 'dotenv/config';
import pool from '../config/db';
import { FinanceService } from '../services/financeService';

async function main() {
    console.log('--- PERFORMANCE MEASUREMENT FOR DASHBOARD ANALYTICS ---');
    
    const companyId = 2; // Let's use company 2 (Bessa Sistema) or another valid company ID
    
    console.log(`Measuring FinanceService.getDashboardAnalytics performance for company ${companyId} (5 runs):`);
    for (let i = 1; i <= 5; i++) {
        // Clear or ignore cache to measure database query times directly
        const start = performance.now();
        
        // We'll call the repository directly to bypass CacheService
        const { FinanceReportRepository } = require('../repositories/financeReportRepository');
        const { toBrazilDate } = require('../utils/date');
        const today = toBrazilDate(new Date());
        
        const data = await FinanceReportRepository.getDashboardAnalytics(companyId, today);
        const end = performance.now();
        console.log(`Run ${i}: Database getDashboardAnalytics took ${(end - start).toFixed(2)} ms`);
    }
    
    await pool.end();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
