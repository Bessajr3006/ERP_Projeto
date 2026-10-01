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
        console.log('=== 1. TESTE RAW QUERY EM 06/2025 ===');
        const req = pool.request();
        req.input('startDate', sql.VarChar, '2025-06-01');
        req.input('endDate', sql.VarChar, '2025-06-30');

        const resRaw = await req.query(`
            SELECT 
                l.cdLancamentoContabil,
                CONVERT(VARCHAR(10), l.dtLancamento, 120) as entry_date,
                CAST(ISNULL(l.nrDocumento, l.cdLancamentoContabil) AS VARCHAR) as document_ref,
                ISNULL(l.Descricao, 'Lançamento Contábil') as history,
                p.cdLancamentoContabilPartida,
                p.cdContaContabil,
                c.Codigo as account_code,
                c.Nome as account_name,
                c.CodigoRapido as account_easy_code,
                CAST(p.Valor AS FLOAT) as amount,
                p.inDebito,
                p.HistoricoComplementar,
                l.cdPessoaFilial as cdFilial
            FROM tbCntLancamentoContabil l WITH (NOLOCK)
            JOIN tbCntLancamentoContabilPartida p WITH (NOLOCK) ON p.cdLancamentoContabil = l.cdLancamentoContabil
            OUTER APPLY (
                SELECT TOP 1 c.Codigo, c.Nome, c.CodigoRapido
                FROM tbCntContaContabil c WITH (NOLOCK)
                WHERE c.cdContaContabil = p.cdContaContabil
                ORDER BY c.inAnalitica DESC, c.cdPlanoContas DESC
            ) c
            WHERE CAST(l.dtLancamento AS DATE) BETWEEN @startDate AND @endDate
            ORDER BY l.dtLancamento ASC, l.cdLancamentoContabil ASC, p.cdLancamentoContabilPartida ASC
        `);

        const rawRows = resRaw.recordset || [];
        console.log(`Raw rows retornadas da query: ${rawRows.length}`);

        // Verificar por que tantas linhas sumiram
        const uniquePartidasMap = new Map<number, any>();
        rawRows.forEach((p: any) => {
            if (!uniquePartidasMap.has(p.cdLancamentoContabilPartida)) {
                uniquePartidasMap.set(p.cdLancamentoContabilPartida, p);
            }
        });
        console.log(`Partidas únicas pós-deduplicação: ${uniquePartidasMap.size}`);

        const distinctLaunches = new Set(rawRows.map(r => r.cdLancamentoContabil));
        console.log(`Lançamentos distintos retornados: ${distinctLaunches.size}`);

        console.log('\n=== 2. AMOSTRA DE PARTIDAS COM p.cdLancamentoContabilPartida ===');
        console.table(rawRows.slice(0, 10).map(r => ({
            launchId: r.cdLancamentoContabil,
            partidaId: r.cdLancamentoContabilPartida,
            inDebito: r.inDebito,
            valor: r.amount,
            account_code: r.account_code,
            hist: (r.HistoricoComplementar || r.history || '').substring(0, 30)
        })));

        console.log('\n=== 3. VERIFICAR SE cdLancamentoContabilPartida É ÚNICO POR TABELA OU APENAS SEQUENCIAL 1, 2, 3... DENTRO DE CADA LANÇAMENTO ===');
        const checkDup = await pool.request().query(`
            SELECT TOP 10 cdLancamentoContabilPartida, COUNT(*) as qtd
            FROM tbCntLancamentoContabilPartida WITH (NOLOCK)
            GROUP BY cdLancamentoContabilPartida
            HAVING COUNT(*) > 1
            ORDER BY qtd DESC
        `);
        console.table(checkDup.recordset);

    } catch (e: any) {
        console.error(e);
    } finally {
        await pool.close();
    }
}

main().catch(console.error);
