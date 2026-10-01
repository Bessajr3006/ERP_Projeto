import pool from '../config/db';
import { BankAccountService } from '../services/bankAccountService';
import { X509Certificate } from 'crypto';

async function inspectCert(bankAccount: any) {
    console.log(`\n=== Inspecting: ${bankAccount.name} (ID: ${bankAccount.id}, Company: ${bankAccount.company_id}) ===`);
    try {
        if (!bankAccount.api_certificate) {
            console.log('No certificate found.');
            return;
        }

        const certPem = Buffer.from(bankAccount.api_certificate, 'base64').toString('ascii');
        const x509 = new X509Certificate(certPem);
        
        console.log('Subject:', x509.subject);
        console.log('Issuer:', x509.issuer);
        console.log('Valid From:', x509.validFrom);
        console.log('Valid To:', x509.validTo);
        
        const now = new Date();
        const expiry = new Date(x509.validTo);
        console.log('Expired?', expiry < now ? 'YES' : 'NO');
        
        console.log('Client ID length:', bankAccount.api_client_id ? bankAccount.api_client_id.trim().length : 0);
        console.log('Client Secret length:', bankAccount.api_client_secret ? bankAccount.api_client_secret.trim().length : 0);

    } catch (e: any) {
        console.error('Error inspecting cert:', e.message);
    }
}

async function main() {
    try {
        const acc2 = await BankAccountService.getById(2, 2);
        await inspectCert(acc2);

        const acc3 = await BankAccountService.getById(3, 3);
        await inspectCert(acc3);
    } catch (e: any) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

main();
