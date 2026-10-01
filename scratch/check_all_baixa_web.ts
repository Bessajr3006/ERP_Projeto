import 'dotenv/config';
import pool from '../src/config/db';
import sql from 'mssql';

async function main() {
    const [companies]: any = await pool.query('SELECT * FROM companies WHERE serv_solidcon IS NOT NULL');
    
    for (const comp of companies) {
        console.log(`\n==================================================`);
        console.log(`Checking ALL Baixa Web / Nuvem in Solidcon for Company: ${comp.id} - ${comp.company_name}`);

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

            // Query all payments where Obs is Baixa Web / Nuvem or other payments on the same cupom
            const resPags = await poolMsSql.query(`
                SELECT p.cdFilial, p.cdCrediarioCupom, p.nrParcela, p.nrPagamento, p.vlQuitado, p.vlPago, p.dtPago, p.Obs, p.cdCrediarioDeposito,
                       c.nrCupom, c.vlCrediario, c.vlQuitado as cupomVlQuitado, c.nrPagamentos as cupomNrPagamentos, c.Obs as cupomObs
                FROM tbCrediarioCupomPagamento p
                JOIN tbCrediarioCupom c ON c.cdCrediarioCupom = p.cdCrediarioCupom
                WHERE p.cdCrediarioCupom IN (
                    SELECT cdCrediarioCupom FROM tbCrediarioCupomPagamento WHERE Obs LIKE '%Baixa Web%' OR Obs LIKE '%Baixa Nuvem%'
                )
                ORDER BY p.cdCrediarioCupom, p.nrPagamento
            `);

            console.log(`Total payments for cupons with Baixa Web/Nuvem: ${resPags.recordset.length}`);

            const byCupom: Record<number, any[]> = {};
            for (const row of resPags.recordset) {
                if (!byCupom[row.cdCrediarioCupom]) byCupom[row.cdCrediarioCupom] = [];
                byCupom[row.cdCrediarioCupom].push(row);
            }

            for (const [key, pags] of Object.entries(byCupom)) {
                console.log(`\nCupom ${key} (nrCupom: ${pags[0].nrCupom}, vlCrediario: ${pags[0].vlCrediario}, cupomVlQuitado: ${pags[0].cupomVlQuitado}, nrPagamentos: ${pags[0].cupomNrPagamentos}, cupomObs: "${pags[0].cupomObs}"):`);
                for (const p of pags) {
                    console.log(`  - nrPagamento: ${p.nrPagamento}, vlPago: ${p.vlPago}, dtPago: ${p.dtPago}, Obs: "${p.Obs}", depId: ${p.cdCrediarioDeposito}`);
                }

                // Check in Keystone what customer this belongs to
                const [kTx]: any = await pool.query(
                    `SELECT t.id, t.description, t.amount, t.status, c.id as cust_id, c.name as cust_name, c.only_solidcon_baixa
                     FROM transactions t
                     JOIN customers c ON c.id = t.customer_id
                     WHERE t.company_id = ? AND t.solidcon_key = ?`,
                    [comp.id, key]
                );
                if (kTx.length > 0) {
                    console.log(`  -> Keystone: Tx ${kTx[0].id}, Customer: ${kTx[0].cust_name} (only_solidcon_baixa: ${kTx[0].only_solidcon_baixa}), Status: ${kTx[0].status}`);
                }
            }

            await poolMsSql.close();
        } catch (err: any) {
            console.error(`Error:`, err);
        }
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
