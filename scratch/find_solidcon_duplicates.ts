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

    console.log('=== BUSCANDO CUPONS COM MAIS DE 1 PAGAMENTO EM tbCrediarioCupomPagamento ===');
    const resDupPags = await poolMs.request().query(`
        SELECT p.cdCrediarioCupom, COUNT(*) as qtdPagamentos, SUM(p.vlPago) as totalPago, c.nrCupom, c.cdFilial, c.cdPDV, c.vlCrediario, c.vlQuitado
        FROM tbCrediarioCupomPagamento p
        JOIN tbCrediarioCupom c ON c.cdCrediarioCupom = p.cdCrediarioCupom
        GROUP BY p.cdCrediarioCupom, c.nrCupom, c.cdFilial, c.cdPDV, c.vlCrediario, c.vlQuitado
        HAVING COUNT(*) > 1
        ORDER BY p.cdCrediarioCupom DESC
    `);
    console.log('Cupons com múltiplos pagamentos:', resDupPags.recordset);

    console.log('\n=== DETALHES DE CADA UM DOS CUPONS DUPLICADOS ===');
    for (const dup of resDupPags.recordset || []) {
        console.log(`\n>>> Cupom #${dup.nrCupom} (cdCrediarioCupom = ${dup.cdCrediarioCupom}, Filial = ${dup.cdFilial}, PDV = ${dup.cdPDV}):`);
        const resP = await poolMs.request()
            .input('cdCupom', sql.Int, dup.cdCrediarioCupom)
            .query(`
                SELECT p.*, d.cdBancoContaMovimento, d.vlQuitado as vlDep, d.dtDeposito, m.Historico, m.dtLancamento
                FROM tbCrediarioCupomPagamento p
                LEFT JOIN tbCrediarioDeposito d ON d.cdCrediarioDeposito = p.cdCrediarioDeposito
                LEFT JOIN tbBancoContaMovimento m ON m.cdBancoContaMovimento = d.cdBancoContaMovimento
                WHERE p.cdCrediarioCupom = @cdCupom
            `);
        console.log(resP.recordset);
    }

    await poolMs.close();
}

main().catch(console.error);
