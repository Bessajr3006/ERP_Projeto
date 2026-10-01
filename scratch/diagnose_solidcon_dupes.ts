import 'dotenv/config';
import pool from '../src/config/db';
import sql from 'mssql';

async function main() {
    const [companies]: any = await pool.query('SELECT * FROM companies WHERE serv_solidcon IS NOT NULL');
    
    for (const comp of companies) {
        console.log(`\n==================================================`);
        console.log(`Checking Company: ${comp.id} - ${comp.company_name}`);
        console.log(`Solidcon Host: ${comp.serv_solidcon}, DB: ${comp.bd_solidcon}`);

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

        try {
            await poolMsSql.connect();
            console.log('Connected to Solidcon SQL Server!');

            // 1. Check tbCrediarioCupomPagamento for cupons with multiple payment entries
            const resDupes = await poolMsSql.query(`
                SELECT cdCrediarioCupom, COUNT(*) as qtdPagamentos, SUM(vlPago) as totalPago, MAX(vlQuitado) as maxQuitado
                FROM tbCrediarioCupomPagamento
                GROUP BY cdCrediarioCupom
                HAVING COUNT(*) > 1
                ORDER BY qtdPagamentos DESC
            `);
            console.log(`\n[1] Cupons with >1 record in tbCrediarioCupomPagamento: ${resDupes.recordset.length}`);
            if (resDupes.recordset.length > 0) {
                console.log('Top 10 cupons with multiple payment records:', resDupes.recordset.slice(0, 10));
            }

            // 2. Check cupons with Obs = 'Baixa Web' or 'Baixa Nuvem'
            const resWeb = await poolMsSql.query(`
                SELECT p.cdCrediarioCupom, p.cdFilial, p.vlPago, p.dtPago, p.Obs, p.cdCrediarioDeposito, c.nrCupom, c.vlCrediario, c.vlQuitado, c.nrPagamentos, c.Obs as cupomObs
                FROM tbCrediarioCupomPagamento p
                JOIN tbCrediarioCupom c ON c.cdCrediarioCupom = p.cdCrediarioCupom
                WHERE p.Obs LIKE '%Baixa Web%' OR p.Obs LIKE '%Baixa Nuvem%' OR c.Obs LIKE '%Baixa Nuvem%' OR c.Obs LIKE '%Baixa Web%'
                ORDER BY p.dtPago DESC
            `);
            console.log(`\n[2] Payments created by Keystone (Obs containing Baixa Web/Nuvem): ${resWeb.recordset.length}`);
            if (resWeb.recordset.length > 0) {
                console.log('Sample Keystone-created payments in Solidcon:', resWeb.recordset.slice(0, 10));
            }

            // 3. Find cupons where there is a Keystone payment AND another payment in Solidcon, OR where Keystone paid for customers with only_solidcon_baixa = 1
            const [exemptCusts]: any = await pool.query(
                `SELECT id, name FROM customers WHERE company_id = ? AND only_solidcon_baixa = 1`,
                [comp.id]
            );
            console.log(`\n[3] Customers with only_solidcon_baixa = 1 in Company ${comp.id}: ${exemptCusts.length}`, exemptCusts.map((c: any) => c.name));

            if (exemptCusts.length > 0) {
                const [exemptTxs]: any = await pool.query(
                    `SELECT id, description, solidcon_key, amount, status, solidcon_quitado, received_at 
                     FROM transactions 
                     WHERE company_id = ? AND customer_id IN (?)`,
                    [comp.id, exemptCusts.map((c: any) => c.id)]
                );
                console.log(`Total transactions in Keystone for these customers: ${exemptTxs.length}`);

                const solidconKeys = exemptTxs.map((t: any) => parseInt(t.solidcon_key, 10)).filter((k: number) => !isNaN(k) && k > 0);
                if (solidconKeys.length > 0) {
                    const reqCustCupons = poolMsSql.request();
                    // Query payments for these specific cupons
                    const resCustCupons = await poolMsSql.query(`
                        SELECT p.cdCrediarioCupom, p.cdFilial, p.vlPago, p.dtPago, p.Obs, p.cdCrediarioDeposito, c.nrCupom, c.vlCrediario, c.vlQuitado, c.nrPagamentos
                        FROM tbCrediarioCupomPagamento p
                        JOIN tbCrediarioCupom c ON c.cdCrediarioCupom = p.cdCrediarioCupom
                        WHERE p.cdCrediarioCupom IN (${solidconKeys.join(',')})
                        ORDER BY p.cdCrediarioCupom, p.dtPago
                    `);
                    console.log(`\nPayments found in Solidcon for cupons of customers with only_solidcon_baixa = 1: ${resCustCupons.recordset.length}`);
                    
                    // Group by cdCrediarioCupom
                    const grouped: Record<number, any[]> = {};
                    for (const row of resCustCupons.recordset) {
                        if (!grouped[row.cdCrediarioCupom]) grouped[row.cdCrediarioCupom] = [];
                        grouped[row.cdCrediarioCupom].push(row);
                    }

                    const multiplePayments = Object.entries(grouped).filter(([_, list]) => list.length > 1);
                    console.log(`Cupons of only_solidcon_baixa customers with MULTIPLE payments in Solidcon: ${multiplePayments.length}`);
                    for (const [key, list] of multiplePayments) {
                        console.log(`  Cupom key ${key} (nrCupom ${list[0].nrCupom}, vlCrediario ${list[0].vlCrediario}): ${list.length} payments:`, list.map(p => ({ vlPago: p.vlPago, dtPago: p.dtPago, obs: p.Obs, dep: p.cdCrediarioDeposito })));
                    }

                    const webPayments = resCustCupons.recordset.filter((p: any) => String(p.Obs || '').includes('Baixa Web') || String(p.Obs || '').includes('Baixa Nuvem'));
                    console.log(`\nCupons of only_solidcon_baixa customers that have 'Baixa Web' / 'Baixa Nuvem' from Keystone: ${webPayments.length}`);
                    for (const wp of webPayments) {
                        console.log(`  Cupom key ${wp.cdCrediarioCupom} (nrCupom ${wp.nrCupom}, vlCrediario ${wp.vlCrediario}, vlPago ${wp.vlPago}, dtPago ${wp.dtPago}, obs ${wp.Obs}, dep ${wp.cdCrediarioDeposito})`);
                    }
                }
            }

            await poolMsSql.close();
        } catch (err: any) {
            console.error(`Error connecting to Solidcon for company ${comp.id}:`, err.message);
        }
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
