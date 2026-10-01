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

    console.log('=== CUPONS RECENTES (2026) COM DUPLICIDADE DE PAGAMENTO NO SOLIDCON ===');
    const res = await poolMs.request().query(`
        SELECT p.cdCrediarioCupom, COUNT(*) as qtdPagamentos, SUM(p.vlPago) as totalPago, 
               c.nrCupom, c.cdFilial, c.cdPDV, c.vlCrediario, c.vlQuitado, c.dtCrediario, cl.Nome as nmCliente
        FROM tbCrediarioCupomPagamento p
        JOIN tbCrediarioCupom c ON c.cdCrediarioCupom = p.cdCrediarioCupom
        LEFT JOIN tbCrediario cl ON cl.cdCrediario = c.cdCrediario
        WHERE c.dtCrediario >= '2026-01-01'
        GROUP BY p.cdCrediarioCupom, c.nrCupom, c.cdFilial, c.cdPDV, c.vlCrediario, c.vlQuitado, c.dtCrediario, cl.Nome
        HAVING COUNT(*) > 1
        ORDER BY c.dtCrediario DESC
    `);
    console.log(res.recordset);

    await poolMs.close();
}

main().catch(console.error);
