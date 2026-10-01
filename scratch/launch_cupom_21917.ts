import pool from '../src/config/db';
import sql from 'mssql';

async function run() {
    try {
        await pool.query('ALTER TABLE transactions ADD COLUMN solidcon_interest_key VARCHAR(50) DEFAULT NULL');
    } catch (e: any) {
        // ignore if exists
    }

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
    console.log('Connected to Solidcon.');

    const cupomNumStr = '21917';
    const histDesc = 'Juros de convênio pago em atraso (5 dias) - Ref: Cupom #21917 - CHEFE RECREIO';
    const totalInterest = 429.33;
    const cdBancoConta = '2023';
    const cdFilial = 1;
    const dtLancamento = new Date('2026-09-08T17:23:01Z');

    // Check if movement already exists
    const resCheck = await poolMs.request()
        .input('histPattern', sql.VarChar, '%Cupom #21917%')
        .query('SELECT TOP 1 cdBancoContaMovimento FROM tbBancoContaMovimento WHERE Historico LIKE @histPattern');

    let movId = resCheck.recordset?.[0]?.cdBancoContaMovimento;
    if (!movId) {
        console.log('Inserting into tbBancoContaMovimento on Solidcon...');
        const reqMov = poolMs.request();
        reqMov.input('dtLancamento', sql.DateTime, dtLancamento);
        reqMov.input('vlDebito', sql.Money, totalInterest);
        reqMov.input('Numero', sql.VarChar, cupomNumStr);
        reqMov.input('Historico', sql.VarChar, histDesc);
        reqMov.input('cdBancoConta', sql.VarChar, cdBancoConta);
        reqMov.input('cdPessoaFilialBancoConta', sql.Int, cdFilial);

        const resMov = await reqMov.query(`
            INSERT INTO tbBancoContaMovimento (
                dtLancamento, vlDebito, vlCredito, Numero, Historico, vlSaldo, nrProcessado, inPendencia,
                cdBancoContaMovimentoTipo, cdBancoConta, cdPessoaFilialBancoConta, cdBancoContaExtrato, inCancelado, cdUsuarioMovimento
            ) VALUES (
                @dtLancamento, @vlDebito, NULL, @Numero, @Historico, 0, NULL, NULL,
                '3', @cdBancoConta, @cdPessoaFilialBancoConta, NULL, NULL, '1'
            );
            SELECT SCOPE_IDENTITY() AS insertId;
        `);
        movId = resMov.recordset?.[0]?.insertId;
        if (!movId) {
            const resFallback = await poolMs.request().query('SELECT TOP 1 cdBancoContaMovimento FROM tbBancoContaMovimento ORDER BY cdBancoContaMovimento DESC');
            movId = resFallback.recordset?.[0]?.cdBancoContaMovimento;
        }
        console.log('Successfully inserted into Solidcon! cdBancoContaMovimento:', movId);
    } else {
        console.log('Movement already exists in Solidcon with ID:', movId);
    }

    // Update Keystone transaction
    if (movId) {
        await pool.query('UPDATE transactions SET solidcon_interest_key = ? WHERE id = 1442', [String(movId)]);
        console.log('Updated transaction 1442 with solidcon_interest_key =', movId);
    }

    // Verify created row in Solidcon
    const resVerify = await poolMs.request()
        .input('movId', sql.Int, movId)
        .query('SELECT cdBancoContaMovimento, dtLancamento, vlDebito, vlCredito, Numero, Historico, cdBancoConta, cdPessoaFilialBancoConta, cdBancoContaMovimentoTipo FROM tbBancoContaMovimento WHERE cdBancoContaMovimento = @movId');
    console.log('Solidcon Record:', resVerify.recordset[0]);

    await poolMs.close();
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
