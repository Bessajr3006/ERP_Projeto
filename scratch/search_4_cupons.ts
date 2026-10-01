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

    const cupons = [148600, 148937, 176885, 178656];
    for (const c of cupons) {
        const res = await poolMs.request()
            .input('c', sql.Int, c)
            .query('SELECT cdCrediarioCupom, cdFilial, cdPDV, nrCupom, cdCrediario, vlCrediario FROM tbCrediarioCupom WHERE nrCupom = @c OR cdCrediarioCupom = @c');
        console.log(`Cupom ${c}:`, res.recordset);
    }

    await poolMs.close();
}

main().catch(console.error);
