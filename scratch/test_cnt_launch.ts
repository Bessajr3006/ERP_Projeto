import sql from 'mssql';

async function main() {
    const config: sql.config = {
        server: 'n13884.ddns.net',
        port: 1433,
        database: 'solidcon',
        user: 'aporttec',
        password: '30mariafn@',
        options: {
            encrypt: false,
            trustServerCertificate: true,
            connectTimeout: 15000,
            requestTimeout: 30000
        }
    };

    try {
        console.log('Conectando ao SQL Server Solidcon...');
        const pool = await sql.connect(config);
        console.log('Conectado!');

        const res = await pool.request().query(`
            SELECT 
                l.cdLancamentoContabil,
                CONVERT(VARCHAR(10), l.dtLancamento, 120) as dtLancamento,
                l.nrDocumento,
                l.Descricao as lanc_desc,
                p.cdLancamentoContabilPartida,
                p.cdContaContabil,
                c.Codigo as account_code,
                c.Nome as account_name,
                c.CodigoRapido as account_easy_code,
                p.Valor as amount,
                p.inDebito,
                p.HistoricoComplementar
            FROM tbCntLancamentoContabil l WITH (NOLOCK)
            JOIN tbCntLancamentoContabilPartida p WITH (NOLOCK) ON p.cdLancamentoContabil = l.cdLancamentoContabil
            LEFT JOIN tbCntContaContabil c WITH (NOLOCK) ON c.cdContaContabil = p.cdContaContabil
            WHERE l.cdLancamentoContabil = 2741 OR l.nrDocumento = '2741'
            ORDER BY p.cdLancamentoContabilPartida ASC
        `);

        console.log('Resultado para 2741:');
        console.table(res.recordset);

        if (res.recordset.length === 0) {
            console.log('Nenhum encontrado por 2741, buscando no dia 2025-06-01:');
            const res2 = await pool.request().query(`
                SELECT TOP 20
                    l.cdLancamentoContabil,
                    CONVERT(VARCHAR(10), l.dtLancamento, 120) as dtLancamento,
                    l.nrDocumento,
                    p.cdLancamentoContabilPartida,
                    p.cdContaContabil,
                    c.Codigo as account_code,
                    c.Nome as account_name,
                    p.Valor as amount,
                    p.inDebito,
                    p.HistoricoComplementar
                FROM tbCntLancamentoContabil l WITH (NOLOCK)
                JOIN tbCntLancamentoContabilPartida p WITH (NOLOCK) ON p.cdLancamentoContabil = l.cdLancamentoContabil
                LEFT JOIN tbCntContaContabil c WITH (NOLOCK) ON c.cdContaContabil = p.cdContaContabil
                WHERE l.dtLancamento BETWEEN '2025-06-01' AND '2025-06-01 23:59:59'
                ORDER BY l.cdLancamentoContabil ASC, p.cdLancamentoContabilPartida ASC
            `);
            console.table(res2.recordset);
        }

        await pool.close();
    } catch (err) {
        console.error('Erro:', err);
    }
}

main();
