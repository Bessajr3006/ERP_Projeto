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

    console.log('>>> tbConta (120229):');
    const resConta = await poolMs.request().query('SELECT * FROM tbConta WHERE cdConta = 120229');
    console.log(resConta.recordset);

    console.log('>>> tbContaParcela (120229):');
    const resParcela = await poolMs.request().query('SELECT * FROM tbContaParcela WHERE cdConta = 120229');
    console.log(resParcela.recordset);

    console.log('>>> tbBancoContaMovimento (160359):');
    const resMov = await poolMs.request().query('SELECT * FROM tbBancoContaMovimento WHERE cdBancoContaMovimento = 160359');
    console.log(resMov.recordset);

    console.log('>>> Qualquer movimento com Historico de CHEFE RECREIO ou 21917:');
    const resAll = await poolMs.request().query("SELECT TOP 20 * FROM tbBancoContaMovimento WHERE Historico LIKE '%CHEFE RECREIO%' OR Historico LIKE '%21917%' OR Numero LIKE '%21917%'");
    console.log(resAll.recordset);

    await poolMs.close();
}

main().catch(console.error);
