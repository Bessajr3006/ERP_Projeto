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

    const checkContaIds = [120516, 120514, 122890, 120528, 122894, 120522, 122889, 122879, 122895, 122899, 122868, 122893, 122898, 120614, 120634, 120612, 120543];
    const res = await poolMs.request().query(`
        SELECT c.cdConta, c.Documento, cp.vlParcela, cp.Historico
        FROM tbConta c
        LEFT JOIN tbContaParcela cp ON cp.cdConta = c.cdConta
        WHERE c.cdConta IN (${checkContaIds.join(',')})
    `);
    console.log(res.recordset);

    await poolMs.close();
}

main().catch(console.error);
