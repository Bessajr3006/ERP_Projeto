import 'dotenv/config';
import '../src/config/runtimeEnv';
import '../src/config/timezone';
import pool from '../src/config/db';
import sql from 'mssql';

async function main() {
    const [companies]: any = await pool.query('SELECT * FROM companies WHERE serv_solidcon IS NOT NULL LIMIT 1');
    if (!companies || companies.length === 0) {
        console.log('Nenhuma empresa encontrada com configuração Solidcon');
        process.exit(1);
    }
    const company = companies[0];
    let server = company.serv_solidcon || company.serv_dorsal;
    let port = 1433;
    if (server.includes(',')) {
        const parts = server.split(',');
        server = parts[0].trim();
        port = parseInt(parts[1].trim(), 10) || 1433;
    }

    const sqlConfig: sql.config = {
        user: company.login_solidcon || company.login_dorsal,
        password: company.senha_solidcon || company.senha_dorsal,
        database: company.bd_solidcon || company.bd_dorsal,
        server,
        port,
        options: { encrypt: false, trustServerCertificate: true },
        connectionTimeout: 10000,
        requestTimeout: 15000
    };

    console.log(`Conectando em ${server}:${port}/${sqlConfig.database}...`);
    const mssqlPool = new sql.ConnectionPool(sqlConfig);
    await mssqlPool.connect();

    console.log('\n--- 1. CONSULTA tbContaBaixa (119332, 119331, 117621, 117607) ---');
    const resBaixas = await mssqlPool.request().query(`
        SELECT cb.cdContaBaixa, cb.cdBancoConta, cb.cdBancoContaMovimento, cb.dtContaBaixa, cb.vlContaBaixa, cb.Documento, cb.Historico, cb.cdUsuarioQuitou,
               cp.cdConta, cp.cdContaParcela, cp.vlParcela, cp.dtParcela, cp.Historico as histParcela,
               c.Documento as docConta, c.cdContaTipo, c.dtInclusao
        FROM tbContaBaixa cb
        LEFT JOIN tbContaParcela cp ON cp.cdContaBaixa = cb.cdContaBaixa
        LEFT JOIN tbConta c ON c.cdConta = cp.cdConta
        WHERE cb.cdContaBaixa IN (119332, 119331, 117621, 117607)
        ORDER BY cb.cdContaBaixa DESC
    `);
    console.table(resBaixas.recordset);

    console.log('\n--- 2. CONSULTA tbCrediarioCupom (nrCupom = 21205 ou cdCrediarioCupom = 21205) ---');
    const resCupom = await mssqlPool.request().query(`
        SELECT c.cdCrediarioCupom, c.cdFilial, c.cdPDV, c.nrCupom, c.dtEmissao, c.vlCrediario, c.vlQuitado, c.nrPagamentos, cl.Nome as nmCliente, cl.CpfCgc
        FROM tbCrediarioCupom c
        LEFT JOIN tbCrediario cl ON cl.cdCrediario = c.cdCrediario
        WHERE c.nrCupom = 21205 OR c.cdCrediarioCupom = 21205
    `);
    console.table(resCupom.recordset);

    if (resCupom.recordset && resCupom.recordset.length > 0) {
        for (const cupom of resCupom.recordset) {
            const cdCrediarioCupom = cupom.cdCrediarioCupom;
            console.log(`\n--- 3. PAGAMENTOS DO CUPOM (cdCrediarioCupom = ${cdCrediarioCupom}, nrCupom = ${cupom.nrCupom}) ---`);
            const resPags = await mssqlPool.request().query(`
                SELECT p.nrPagamento, p.cdCrediarioCupom, p.cdFilial, p.vlPago, p.dtPago, p.cdUsuarioQuitou, p.cdCrediarioDeposito, p.Obs,
                       d.cdBancoContaMovimento, d.cdBancoConta, d.vlQuitado as vlDepositoQuitado
                FROM tbCrediarioCupomPagamento p
                LEFT JOIN tbCrediarioDeposito d ON d.cdCrediarioDeposito = p.cdCrediarioDeposito
                WHERE p.cdCrediarioCupom = ${cdCrediarioCupom}
            `);
            console.table(resPags.recordset);
        }
    }

    console.log('\n--- 4. CONSULTA NO KEYSTONE TRANSACTIONS PARA 21205 ---');
    const [keystoneTx]: any = await pool.query(`
        SELECT id, public_id, description, amount, original_amount, fine, interest, date, status, pdv, cdfilial, solidcon_key, solidcon_interest_key, solidcon_quitado
        FROM transactions
        WHERE description LIKE '%21205%' OR solidcon_key = '21205' OR solidcon_interest_key = '21205'
    `);
    console.table(keystoneTx);

    await mssqlPool.close();
    await pool.end();
}

main().catch(console.error);
