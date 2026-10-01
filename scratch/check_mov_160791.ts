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

    console.log('>>> tbBancoContaMovimento (cdBancoContaMovimento = 160791):');
    const resMov = await poolMs.request()
        .input('movId', sql.Int, 160791)
        .query('SELECT * FROM tbBancoContaMovimento WHERE cdBancoContaMovimento = @movId');
    console.log(resMov.recordset);

    console.log('\n>>> tbContaBaixa (cdBancoContaMovimento = 160791):');
    const resBaixa = await poolMs.request()
        .input('movId', sql.Int, 160791)
        .query('SELECT * FROM tbContaBaixa WHERE cdBancoContaMovimento = @movId');
    console.log(resBaixa.recordset);

    console.log('\n>>> tbContaParcela (cdBancoContaMovimento = 160791):');
    const resParcela = await poolMs.request()
        .input('movId', sql.Int, 160791)
        .query('SELECT * FROM tbContaParcela WHERE cdBancoContaMovimento = @movId');
    console.log(resParcela.recordset);

    if (resBaixa.recordset.length > 0) {
        const baixaId = resBaixa.recordset[0].cdContaBaixa;
        console.log('\n>>> tbContaParcela por cdContaBaixa =', baixaId);
        const resP2 = await poolMs.request()
            .input('baixaId', sql.Int, baixaId)
            .query('SELECT * FROM tbContaParcela WHERE cdContaBaixa = @baixaId');
        console.log(resP2.recordset);

        console.log('\n>>> tbConta por cdContaBaixa =', baixaId);
        const resConta = await poolMs.request()
            .input('baixaId', sql.Int, baixaId)
            .query('SELECT * FROM tbConta WHERE cdConta IN (SELECT cdConta FROM tbContaParcela WHERE cdContaBaixa = @baixaId)');
        console.log(resConta.recordset);
    }

    await poolMs.close();
}

main().catch(console.error);
