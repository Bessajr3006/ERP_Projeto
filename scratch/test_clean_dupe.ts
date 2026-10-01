import 'dotenv/config';
import pool from '../src/config/db';
import sql from 'mssql';

async function testCleanDupe() {
    const [companies]: any = await pool.query('SELECT * FROM companies WHERE id = 12');
    const comp = companies[0];

    let server = comp.serv_solidcon;
    let port = 1433;
    if (server.includes(',')) {
        const parts = server.split(',');
        server = (parts[0] || '').trim();
        port = parseInt((parts[1] || '').trim(), 10) || 1433;
    } else if (server.includes(':')) {
        const parts = server.split(':');
        server = (parts[0] || '').trim();
        port = parseInt((parts[1] || '').trim(), 10) || 1433;
    }

    const poolMsSql = new sql.ConnectionPool({
        user: comp.login_solidcon,
        password: comp.senha_solidcon,
        server,
        database: comp.bd_solidcon,
        port,
        options: {
            encrypt: false,
            trustServerCertificate: true
        }
    });

    await poolMsSql.connect();
    console.log('Connected to Solidcon.');

    const targetCupons = [133372, 133373, 133380];

    for (const cdCrediarioCupom of targetCupons) {
        console.log(`\n-----------------------------------------`);
        console.log(`Processing Cupom ${cdCrediarioCupom}...`);

        const transaction = new sql.Transaction(poolMsSql);
        await transaction.begin();

        try {
            // 1. Find payments on this cupom created by Keystone (Baixa Web / Nuvem or user 1)
            const reqFind = new sql.Request(transaction);
            reqFind.input('key', sql.Int, cdCrediarioCupom);
            const resFind = await reqFind.query(`
                SELECT p.cdFilial, p.cdCrediarioCupom, p.nrParcela, p.nrPagamento, p.vlPago, p.dtPago, p.Obs, p.cdCrediarioDeposito,
                       d.cdBancoContaMovimento, d.cdBancoConta
                FROM tbCrediarioCupomPagamento p
                LEFT JOIN tbCrediarioDeposito d ON d.cdCrediarioDeposito = p.cdCrediarioDeposito
                WHERE p.cdCrediarioCupom = @key
                  AND (p.Obs LIKE '%Baixa Web%' OR p.Obs LIKE '%Baixa Nuvem%' OR p.cdUsuarioQuitou = 1)
            `);

            const webPayments = resFind.recordset || [];
            console.log(`Found ${webPayments.length} Keystone payment(s) to remove for cupom ${cdCrediarioCupom}:`, webPayments);

            for (const pag of webPayments) {
                // Delete from tbCrediarioCupomPagamento
                const reqDelPag = new sql.Request(transaction);
                reqDelPag.input('key', sql.Int, cdCrediarioCupom);
                reqDelPag.input('depId', sql.Int, pag.cdCrediarioDeposito);
                reqDelPag.input('nrPagamento', sql.Int, pag.nrPagamento);
                await reqDelPag.query(`
                    DELETE FROM tbCrediarioCupomPagamento 
                    WHERE cdCrediarioCupom = @key 
                      AND (cdCrediarioDeposito = @depId OR nrPagamento = @nrPagamento)
                `);

                // Delete from tbCrediarioDeposito
                if (pag.cdCrediarioDeposito) {
                    const reqDelDep = new sql.Request(transaction);
                    reqDelDep.input('depId', sql.Int, pag.cdCrediarioDeposito);
                    await reqDelDep.query(`
                        DELETE FROM tbCrediarioDeposito WHERE cdCrediarioDeposito = @depId
                    `);
                }

                // Delete from tbBancoContaMovimento
                if (pag.cdBancoContaMovimento) {
                    const reqDelMov = new sql.Request(transaction);
                    reqDelMov.input('movId', sql.Int, pag.cdBancoContaMovimento);
                    await reqDelMov.query(`
                        DELETE FROM tbBancoContaMovimento WHERE cdBancoContaMovimento = @movId
                    `);
                }
            }

            // 2. Recalculate tbCrediarioCupom
            const reqRecalc = new sql.Request(transaction);
            reqRecalc.input('key', sql.Int, cdCrediarioCupom);
            await reqRecalc.query(`
                UPDATE tbCrediarioCupom
                SET 
                    vlQuitado = ISNULL((SELECT SUM(vlPago) FROM tbCrediarioCupomPagamento WHERE cdCrediarioCupom = @key), 0),
                    nrPagamentos = (SELECT COUNT(*) FROM tbCrediarioCupomPagamento WHERE cdCrediarioCupom = @key),
                    Obs = (
                        SELECT CASE 
                            WHEN COUNT(*) = 0 THEN NULL 
                            ELSE MAX(Obs) 
                        END 
                        FROM tbCrediarioCupomPagamento 
                        WHERE cdCrediarioCupom = @key
                    )
                WHERE cdCrediarioCupom = @key
            `);

            await transaction.commit();
            console.log(`Successfully cleaned cupom ${cdCrediarioCupom}!`);

            // Verify state now
            const resVerify = await poolMsSql.query(`
                SELECT c.cdCrediarioCupom, c.nrCupom, c.vlCrediario, c.vlQuitado, c.nrPagamentos, c.Obs as cupomObs
                FROM tbCrediarioCupom c WHERE c.cdCrediarioCupom = ${cdCrediarioCupom}
            `);
            console.log('Updated tbCrediarioCupom:', resVerify.recordset[0]);

            const resRemainingPags = await poolMsSql.query(`
                SELECT * FROM tbCrediarioCupomPagamento WHERE cdCrediarioCupom = ${cdCrediarioCupom}
            `);
            console.log('Remaining payments in Solidcon:', resRemainingPags.recordset);

        } catch (e) {
            await transaction.rollback();
            console.error(`Error cleaning cupom ${cdCrediarioCupom}:`, e);
        }
    }

    await poolMsSql.close();
}

testCleanDupe().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
