import 'dotenv/config';
import pool from '../src/config/db';
import sql from 'mssql';

async function main() {
    const [companies]: any = await pool.query('SELECT * FROM companies WHERE serv_solidcon IS NOT NULL');
    
    for (const comp of companies) {
        console.log(`\n==================================================`);
        console.log(`Checking Company: ${comp.id} - ${comp.company_name}`);

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

            // Find all customers with only_solidcon_baixa = 1
            const [custs]: any = await pool.query(
                `SELECT id, name FROM customers WHERE company_id = ? AND only_solidcon_baixa = 1`,
                [comp.id]
            );

            console.log(`Customers with only_solidcon_baixa = 1:`, custs.map((c: any) => ({ id: c.id, name: c.name })));

            if (custs.length === 0) continue;

            // Get all transactions for these customers in Keystone
            const [txs]: any = await pool.query(
                `SELECT t.id, t.description, t.solidcon_key, t.amount, t.status, t.solidcon_quitado, t.received_at, c.name as customer_name
                 FROM transactions t
                 JOIN customers c ON c.id = t.customer_id
                 WHERE t.company_id = ? AND t.customer_id IN (?)`,
                [comp.id, custs.map((c: any) => c.id)]
            );

            console.log(`Total transactions for these customers in Keystone: ${txs.length}`);

            const solidconKeys = txs.map((t: any) => parseInt(t.solidcon_key, 10)).filter((k: number) => !isNaN(k) && k > 0);

            // Let's check tbCrediarioCupomPagamento for all these keys
            if (solidconKeys.length > 0) {
                const resPags = await poolMsSql.query(`
                    SELECT p.cdFilial, p.cdCrediarioCupom, p.nrParcela, p.nrPagamento, p.vlQuitado, p.vlPago, p.dtPago, p.Obs, p.cdCrediarioDeposito,
                           c.nrCupom, c.vlCrediario, c.vlQuitado as cupomVlQuitado, c.nrPagamentos as cupomNrPagamentos, c.Obs as cupomObs
                    FROM tbCrediarioCupomPagamento p
                    JOIN tbCrediarioCupom c ON c.cdCrediarioCupom = p.cdCrediarioCupom
                    WHERE p.cdCrediarioCupom IN (${solidconKeys.join(',')})
                    ORDER BY p.cdCrediarioCupom, p.nrPagamento
                `);

                console.log(`Total payments in Solidcon for these cupons: ${resPags.recordset.length}`);

                // Group by cdCrediarioCupom
                const byCupom: Record<number, any[]> = {};
                for (const row of resPags.recordset) {
                    if (!byCupom[row.cdCrediarioCupom]) byCupom[row.cdCrediarioCupom] = [];
                    byCupom[row.cdCrediarioCupom].push(row);
                }

                // Check which ones have duplicate or Keystone payments
                for (const [key, pags] of Object.entries(byCupom)) {
                    const hasWebBaixa = pags.some(p => String(p.Obs || '').includes('Baixa Web') || String(p.Obs || '').includes('Baixa Nuvem'));
                    const isMultiple = pags.length > 1;

                    if (hasWebBaixa || isMultiple) {
                        console.log(`\n-> Cupom ${key} (nrCupom: ${pags[0].nrCupom}, vlCrediario: ${pags[0].vlCrediario}, cupomVlQuitado: ${pags[0].cupomVlQuitado}, nrPagamentos: ${pags[0].cupomNrPagamentos}):`);
                        for (const p of pags) {
                            console.log(`   - nrPagamento: ${p.nrPagamento}, vlPago: ${p.vlPago}, dtPago: ${p.dtPago}, Obs: "${p.Obs}", depId: ${p.cdCrediarioDeposito}`);
                        }
                    }
                }
            }

            await poolMsSql.close();
        } catch (err: any) {
            console.error(`Error with company ${comp.id}:`, err);
        }
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
