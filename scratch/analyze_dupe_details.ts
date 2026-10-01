import 'dotenv/config';
import pool from '../src/config/db';
import sql from 'mssql';

async function main() {
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

    // Check cupons 133372, 133373, 133380
    const targetKeys = [133372, 133373, 133380];
    for (const key of targetKeys) {
        console.log(`\n==================================================`);
        console.log(`Analyzing Cupom ${key} in Solidcon:`);

        const resCupom = await poolMsSql.query(`
            SELECT cdCrediarioCupom, nrCupom, cdFilial, cdPDV, vlCrediario, vlQuitado, nrPagamentos, Obs
            FROM tbCrediarioCupom WHERE cdCrediarioCupom = ${key}
        `);
        console.log('tbCrediarioCupom:', resCupom.recordset[0]);

        const resPags = await poolMsSql.query(`
            SELECT * FROM tbCrediarioCupomPagamento WHERE cdCrediarioCupom = ${key}
        `);
        console.log('tbCrediarioCupomPagamento:', resPags.recordset);

        for (const p of resPags.recordset) {
            if (p.cdCrediarioDeposito) {
                const resDep = await poolMsSql.query(`SELECT * FROM tbCrediarioDeposito WHERE cdCrediarioDeposito = ${p.cdCrediarioDeposito}`);
                console.log(`  -> Deposito ${p.cdCrediarioDeposito}:`, resDep.recordset);

                if (resDep.recordset[0]?.cdBancoContaMovimento) {
                    const resMov = await poolMsSql.query(`SELECT * FROM tbBancoContaMovimento WHERE cdBancoContaMovimento = ${resDep.recordset[0].cdBancoContaMovimento}`);
                    console.log(`    -> Movimento ${resDep.recordset[0].cdBancoContaMovimento}:`, resMov.recordset);
                }
            }
        }
    }

    await poolMsSql.close();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
