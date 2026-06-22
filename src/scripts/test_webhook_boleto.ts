import 'dotenv/config';
import pool from '../config/db';
import * as https from 'https';
import * as http from 'http';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

async function test() {
    console.log('--- Starting Webhook Test ---');
    
    // 1. Find or create a test bank account
    let [accounts] = await pool.query<RowDataPacket[]>('SELECT id FROM bank_accounts LIMIT 1');
    let bankAccountId = accounts[0]?.id;
    if (!bankAccountId) {
        // Insert a dummy bank account
        const [res] = await pool.query<ResultSetHeader>(
            `INSERT INTO bank_accounts (public_id, company_id, name, type, initial_balance, current_balance) 
             VALUES ('test-account-uuid', 2, 'Test Account', 'checking', 1000.00, 1000.00)`
        );
        bankAccountId = res.insertId;
    }
    
    // 2. Insert a pending transaction
    const txPublicId = 'test-tx-uuid-' + Date.now();
    const nossoNumero = 'nosso-numero-' + Date.now();
    await pool.query(
        `INSERT INTO transactions (public_id, company_id, bank_account_id, category_id, user_id, description, amount, type, date, status, billet_url) 
         VALUES (?, 2, ?, 1, 1, 'Test Webhook Billet', 150.00, 'income', '2026-06-21', 'pending', ?)`,
        [txPublicId, bankAccountId, nossoNumero]
    );
    console.log(`Inserted pending transaction ${txPublicId} with nossoNumero ${nossoNumero}`);

    // Get current balance
    const [accBefore] = await pool.query<RowDataPacket[]>('SELECT current_balance FROM bank_accounts WHERE id = ?', [bankAccountId]);
    const balanceBefore = Number(accBefore[0]?.current_balance);
    console.log(`Bank account balance before: ${balanceBefore}`);

    // 3. Send mock webhook payload
    const payload = [
        {
            cobranca: {
                nossoNumero: nossoNumero,
                seuNumero: txPublicId,
                situacao: 'PAGO',
                valorNominal: 150.00
            }
        }
    ];
    const payloadStr = JSON.stringify(payload);
    
    const postOptionsHttps: https.RequestOptions = {
        hostname: 'localhost',
        port: 3020,
        path: '/api/v1/public/webhooks/inter/billing',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payloadStr)
        },
        rejectUnauthorized: false // bypass SSL verification for local dev server
    };

    const postOptionsHttp: http.RequestOptions = {
        hostname: 'localhost',
        port: 3020,
        path: '/api/v1/public/webhooks/inter/billing',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payloadStr)
        }
    };

    const callWebhook = () => {
        return new Promise<string>((resolve, reject) => {
            // Try HTTPS first since dev server runs on HTTPS
            const req = https.request(postOptionsHttps, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            });
            req.on('error', () => {
                // Fallback to HTTP if HTTPS fails
                const reqHttp = http.request(postOptionsHttp, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve(data));
                });
                reqHttp.on('error', reject);
                reqHttp.write(payloadStr);
                reqHttp.end();
            });
            req.write(payloadStr);
            req.end();
        });
    };

    try {
        console.log('Sending webhook POST request to /api/v1/public/webhooks/inter/billing...');
        const response = await callWebhook();
        console.log('Webhook Response:', response);

        // Wait 1 second to ensure DB transaction finishes
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 4. Verify transaction status in DB
        const [txAfter] = await pool.query<RowDataPacket[]>('SELECT status, received_at FROM transactions WHERE public_id = ?', [txPublicId]);
        console.log('Transaction after webhook:', txAfter[0]);

        const [accAfter] = await pool.query<RowDataPacket[]>('SELECT current_balance FROM bank_accounts WHERE id = ?', [bankAccountId]);
        const balanceAfter = Number(accAfter[0]?.current_balance);
        console.log(`Bank account balance after: ${balanceAfter}`);

        if (txAfter[0]?.status === 'paid' && balanceAfter === balanceBefore + 150.00) {
            console.log('SUCCESS: Transaction marked as paid and bank account balance updated!');
        } else {
            console.error('FAILURE: Status or balance check failed.');
        }

    } catch (e: any) {
        console.error('Error sending webhook:', e.message);
    } finally {
        // Cleanup test transaction
        await pool.query('DELETE FROM transactions WHERE public_id = ?', [txPublicId]);
        console.log('Cleaned up test transaction.');
        pool.end();
    }
}

test();
