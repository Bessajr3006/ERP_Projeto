import 'dotenv/config';
import pool from '../src/config/db';
import sql from 'mssql';

async function main() {
    console.log('=== 1. SOLIDCON DATABASE (tbCrediarioCupom WHERE nrCupom = 22014) ===');
    const config: sql.config = {
        user: 'aporttec',
        password: '30mariafn@',
        server: 'n13884.ddns.net',
        database: 'solidcon',
        port: 1433,
        options: { encrypt: false, trustServerCertificate: true },
        connectionTimeout: 10000,
        requestTimeout: 15000
    };
    const poolMs = new sql.ConnectionPool(config);
    await poolMs.connect();

    const resCupom = await poolMs.request()
        .input('nrCupom', sql.Int, 22014)
        .query('SELECT * FROM tbCrediarioCupom WHERE nrCupom = @nrCupom');
    console.log('Solidcon tbCrediarioCupom:', JSON.stringify(resCupom.recordset, null, 2));

    console.log('\n=== 2. SOLIDCON DATABASE (tbCrediarioCupomPagamento WHERE nrCupom = 22014) ===');
    const resPag = await poolMs.request()
        .input('nrCupom', sql.Int, 22014)
        .query(`
            SELECT p.*, c.nrCupom, c.cdPDV, c.cdFilial as filialCupom
            FROM tbCrediarioCupomPagamento p
            JOIN tbCrediarioCupom c ON c.cdCrediarioCupom = p.cdCrediarioCupom
            WHERE c.nrCupom = @nrCupom
        `);
    console.log('Solidcon tbCrediarioCupomPagamento:', JSON.stringify(resPag.recordset, null, 2));

    await poolMs.close();

    console.log('\n=== 3. KEYSTONE DATABASE (transactions WHERE description LIKE %22014%) ===');
    const [rows]: any = await pool.query(`
        SELECT id, public_id, description, amount, original_amount, fine, interest, date, received_at, status, pdv, cdfilial, solidcon_key, solidcon_quitado
        FROM transactions
        WHERE description LIKE '%22014%' OR solidcon_key = '22014' OR solidcon_key = '133397'
    `);
    console.log('Keystone transactions:', JSON.stringify(rows, null, 2));

    await pool.end();
}

main().catch(console.error);
