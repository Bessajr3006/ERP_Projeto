import pool from '../config/db';
import { BankAccountService } from '../services/bankAccountService';
import * as tls from 'tls';

async function main() {
    try {
        const bankAccount = await BankAccountService.getById(2, 2);
        
        const certBase64 = bankAccount.api_certificate || '';
        const keyBase64 = bankAccount.api_key || '';
        
        const certDecoded = Buffer.from(certBase64, 'base64').toString('ascii');
        const keyDecoded = Buffer.from(keyBase64, 'base64').toString('ascii');
        
        console.log('Testing tls.createSecureContext...');
        try {
            const ctx = tls.createSecureContext({
                cert: certDecoded,
                key: keyDecoded
            });
            console.log('Secure context created successfully!', !!ctx);
        } catch (err: any) {
            console.error('Failed to create secure context:', err.stack || err.message);
        }
        
    } catch (e: any) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

main();
