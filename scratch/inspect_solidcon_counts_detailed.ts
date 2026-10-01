import sql from 'mssql';

async function main() {
    const config: sql.config = {
        server: '138.121.72.106',
        port: 1433,
        database: 'solidcon',
        user: 'sa',
        password: '30mariafn@',
        options: {
            encrypt: false,
            trustServerCertificate: true,
            connectTimeout: 15000,
            requestTimeout: 45000
        }
    };

    const pool = await sql.connect(config);

    try {
        console.log('\n=== 1. CONTAGEM POR ANO E MES EM tbCntLancamentoContabil (Últimos 12 meses) ===');
        const rCount = await pool.request().query(`
            SELECT TOP 24
                YEAR(l.dtLancamento) as ano, 
                MONTH(l.dtLancamento) as mes, 
                COUNT(DISTINCT l.cdLancamentoContabil) as qtd_lancamentos,
                COUNT(p.cdLancamentoContabilPartida) as qtd_partidas,
                SUM(CAST(p.Valor AS FLOAT)) / 2 as total_volume_financeiro
            FROM tbCntLancamentoContabil l WITH (NOLOCK)
            JOIN tbCntLancamentoContabilPartida p WITH (NOLOCK) ON p.cdLancamentoContabil = l.cdLancamentoContabil
            GROUP BY YEAR(l.dtLancamento), MONTH(l.dtLancamento)
            ORDER BY ano DESC, mes DESC
        `);
        console.table(rCount.recordset);

        console.log('\n=== 2. DIAS DO MÊS 06/2025 ===');
        const rJune = await pool.request().query(`
            SELECT 
                CONVERT(VARCHAR(10), l.dtLancamento, 120) as data,
                COUNT(DISTINCT l.cdLancamentoContabil) as qtd_lancamentos,
                COUNT(p.cdLancamentoContabilPartida) as qtd_partidas
            FROM tbCntLancamentoContabil l WITH (NOLOCK)
            JOIN tbCntLancamentoContabilPartida p WITH (NOLOCK) ON p.cdLancamentoContabil = l.cdLancamentoContabil
            WHERE l.dtLancamento >= '2025-06-01' AND l.dtLancamento <= '2025-06-30 23:59:59'
            GROUP BY CONVERT(VARCHAR(10), l.dtLancamento, 120)
            ORDER BY data ASC
        `);
        console.table(rJune.recordset);

        console.log('\n=== 3. TODOS OS LANÇAMENTOS DO DIA 01/06/2025 ===');
        const rDay = await pool.request().query(`
            SELECT 
                l.cdLancamentoContabil,
                CONVERT(VARCHAR(10), l.dtLancamento, 120) as data,
                l.nrDocumento,
                l.Descricao,
                COUNT(CASE WHEN p.inDebito = 1 THEN 1 END) as debits_count,
                COUNT(CASE WHEN p.inDebito = 0 THEN 1 END) as credits_count,
                SUM(CASE WHEN p.inDebito = 1 THEN CAST(p.Valor AS FLOAT) ELSE 0 END) as total_debito,
                SUM(CASE WHEN p.inDebito = 0 THEN CAST(p.Valor AS FLOAT) ELSE 0 END) as total_credito
            FROM tbCntLancamentoContabil l WITH (NOLOCK)
            JOIN tbCntLancamentoContabilPartida p WITH (NOLOCK) ON p.cdLancamentoContabil = l.cdLancamentoContabil
            WHERE CAST(l.dtLancamento AS DATE) = '2025-06-01'
            GROUP BY l.cdLancamentoContabil, CONVERT(VARCHAR(10), l.dtLancamento, 120), l.nrDocumento, l.Descricao
            ORDER BY l.cdLancamentoContabil ASC
        `);
        console.table(rDay.recordset);

    } catch (e: any) {
        console.error(e);
    } finally {
        await pool.close();
    }
}

main().catch(console.error);
