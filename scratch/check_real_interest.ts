import 'dotenv/config';
import sql from 'mssql';

async function main() {
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

    const res = await poolMs.request().query(`
        SELECT TOP 30 c.cdConta, c.Documento, cp.vlParcela, cp.Historico
        FROM tbConta c
        JOIN tbContaParcela cp ON cp.cdConta = c.cdConta
        WHERE cp.Historico LIKE '%Juros%' OR cp.Historico LIKE '%Multa%' OR cp.Historico LIKE '%Mora%'
        ORDER BY c.cdConta DESC
    `);
    console.log(res.recordset);

    await poolMs.close();
}

main().catch(console.error);
