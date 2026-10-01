import 'dotenv/config';
import pool from '../src/config/db';
import sql from 'mssql';

async function main() {
    console.log('--- 1. BUSCANDO NO MYSQL (ERP BESSA / KEYSTONE) ---');
    const [txRows] = await pool.query(`
        SELECT *
        FROM transactions
        WHERE description LIKE '%21917%' OR solidcon_key = '21917' OR solidcon_key LIKE '%21917%'
        ORDER BY id DESC
    `);
    console.log('Transações no MySQL:', JSON.stringify(txRows, null, 2));

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
    console.log('\n--- 2. CONECTADO AO SOLIDCON ---');

    console.log('\n>>> tbCrediarioCupom (nrCupom = 21917):');
    const resCupom = await poolMs.request()
        .input('nrCupom', sql.Int, 21917)
        .query(`SELECT * FROM tbCrediarioCupom WHERE nrCupom = @nrCupom`);
    console.log(resCupom.recordset);

    console.log('\n>>> tbCrediarioCupomPagamento:');
    const resPag = await poolMs.request()
        .input('nrCupom', sql.Int, 21917)
        .query(`
            SELECT p.* 
            FROM tbCrediarioCupomPagamento p
            JOIN tbCrediarioCupom c ON c.cdCrediarioCupom = p.cdCrediarioCupom
            WHERE c.nrCupom = @nrCupom
        `);
    console.log(resPag.recordset);

    console.log('\n>>> tbCrediarioDeposito:');
    if (resPag.recordset.length > 0) {
        const depIds = resPag.recordset.map((p: any) => p.cdCrediarioDeposito).filter(Boolean);
        if (depIds.length > 0) {
            const resDep = await poolMs.request()
                .query(`SELECT * FROM tbCrediarioDeposito WHERE cdCrediarioDeposito IN (${depIds.join(',')})`);
            console.log(resDep.recordset);
        }
    }

    console.log('\n>>> tbBancoContaMovimento (com 21917):');
    const resMov = await poolMs.request()
        .query(`SELECT TOP 10 * FROM tbBancoContaMovimento WHERE Historico LIKE '%21917%' OR Numero LIKE '%21917%' ORDER BY cdBancoContaMovimento DESC`);
    console.log(resMov.recordset);

    console.log('\n>>> tbConta / tbContaBaixa / tbContaParcela (com 21917):');
    const resConta = await poolMs.request()
        .query(`SELECT TOP 10 * FROM tbConta WHERE Documento LIKE '%21917%' OR Historico LIKE '%21917%'`);
    console.log('tbConta:', resConta.recordset);

    const resContaBaixa = await poolMs.request()
        .query(`SELECT TOP 10 * FROM tbContaBaixa WHERE Documento LIKE '%21917%' OR Historico LIKE '%21917%'`);
    console.log('tbContaBaixa:', resContaBaixa.recordset);

    await poolMs.close();
    await pool.end();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
