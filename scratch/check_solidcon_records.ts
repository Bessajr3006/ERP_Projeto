import 'dotenv/config';
import pool from '../src/config/db';
import sql from 'mssql';

async function main() {
    const [companies]: any = await pool.query('SELECT * FROM companies WHERE id = 12');
    const comp = companies[0];
    console.log('Company 12:', comp.company_name, comp.serv_solidcon, comp.bd_solidcon, comp.login_solidcon);

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
    console.log('Connected to Solidcon SQL Server!');

    // Get all transactions for customer 1721 (LOJA CONVENIENCIA N1) that are status = paid
    const [txs]: any = await pool.query(
        `SELECT t.id, t.description, t.solidcon_key, t.amount, t.status, t.solidcon_quitado, t.received_at
         FROM transactions t
         WHERE t.customer_id = 1721 AND t.status = 'paid'`
    );
    console.log(`Checking ${txs.length} paid transactions for LOJA CONVENIENCIA N1...`);

    for (const tx of txs) {
        const cupomKey = tx.solidcon_key;
        const cupomMatch = String(tx.description || '').match(/Cupom\s*#?\s*(\d+)/i);
        const nrCupom = cupomMatch?.[1];

        console.log(`\n--- Tx ID ${tx.id} | Desc: ${tx.description} | solidcon_key: ${cupomKey} ---`);

        // Check tbCrediarioCupom
        const req1 = poolMsSql.request();
        req1.input('key', sql.Int, cupomKey ? parseInt(cupomKey, 10) : 0);
        req1.input('nrCupom', sql.VarChar, nrCupom || '');
        const res1 = await req1.query(`
            SELECT cdCrediarioCupom, nrCupom, cdFilial, cdPDV, vlCrediario, vlQuitado, nrPagamentos, Obs 
            FROM tbCrediarioCupom 
            WHERE cdCrediarioCupom = @key OR nrCupom = @nrCupom
        `);
        console.log('tbCrediarioCupom:', res1.recordset);

        if (res1.recordset?.[0]) {
            const actualKey = res1.recordset[0].cdCrediarioCupom;
            // Check tbCrediarioCupomPagamento
            const req2 = poolMsSql.request();
            req2.input('key', sql.Int, actualKey);
            const res2 = await req2.query(`
                SELECT * FROM tbCrediarioCupomPagamento WHERE cdCrediarioCupom = @key
            `);
            console.log('tbCrediarioCupomPagamento count:', res2.recordset?.length, res2.recordset);

            // For each payment, check deposito and movimento
            for (const p of res2.recordset || []) {
                if (p.cdCrediarioDeposito) {
                    const req3 = poolMsSql.request();
                    req3.input('depId', sql.Int, p.cdCrediarioDeposito);
                    const res3 = await req3.query(`SELECT * FROM tbCrediarioDeposito WHERE cdCrediarioDeposito = @depId`);
                    console.log('  -> tbCrediarioDeposito:', res3.recordset);

                    if (res3.recordset?.[0]?.cdBancoContaMovimento) {
                        const req4 = poolMsSql.request();
                        req4.input('movId', sql.Int, res3.recordset[0].cdBancoContaMovimento);
                        const res4 = await req4.query(`SELECT * FROM tbBancoContaMovimento WHERE cdBancoContaMovimento = @movId`);
                        console.log('    -> tbBancoContaMovimento:', res4.recordset);
                    }
                }
            }
        }
    }

    await poolMsSql.close();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
