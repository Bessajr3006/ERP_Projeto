import sql from 'mssql';

async function main() {
    const configsToTry = [
        { name: 'Forte do Vilar Matriz (138.121.72.106)', server: '138.121.72.106', port: 1433, database: 'solidcon', user: 'sa', password: '30mariafn@' },
        { name: 'N1 Loja (n13884.ddns.net:1400)', server: 'n13884.ddns.net', port: 1400, database: 'solidcon', user: 'sa', password: '30mariafn@' },
        { name: 'N1 Distribuidora (n13884.ddns.net:1433)', server: 'n13884.ddns.net', port: 1433, database: 'solidcon', user: 'aporttec', password: '30mariafn@' },
        { name: 'IP 190.107.93.66', server: '190.107.93.66', port: 1433, database: 'solidcon', user: 'aporttec', password: '30mariafn@' }
    ];

    let pool: sql.ConnectionPool | null = null;
    for (const c of configsToTry) {
        try {
            console.log(`Tentando conectar em ${c.server}:${c.port}/${c.database}...`);
            pool = await sql.connect({
                server: c.server,
                port: c.port,
                database: c.database,
                user: c.user,
                password: c.password,
                options: {
                    encrypt: false,
                    trustServerCertificate: true,
                    connectTimeout: 15000,
                    requestTimeout: 45000
                }
            });
            console.log(`Conectado com sucesso em ${c.server}!`);
            break;
        } catch (err: any) {
            console.error(`Falha ao conectar em ${c.server}:`, err.message);
        }
    }

    if (!pool) {
        console.error('Nao foi possivel conectar a nenhuma instancia do Solidcon.');
        process.exit(1);
    }

    try {
        console.log('\n=== 1. TABELAS CONTABEIS NO SOLIDCON ===');
        const rTables = await pool.request().query(`
            SELECT TABLE_NAME, TABLE_TYPE 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME LIKE 'tbCnt%' OR TABLE_NAME LIKE 'vwCnt%' OR TABLE_NAME LIKE '%Lancamento%'
            ORDER BY TABLE_NAME
        `);
        console.table(rTables.recordset);

        console.log('\n=== 2. COLUNAS DE tbCntLancamentoContabil ===');
        const rCols1 = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'tbCntLancamentoContabil'
            ORDER BY ORDINAL_POSITION
        `);
        console.table(rCols1.recordset);

        console.log('\n=== 3. COLUNAS DE tbCntLancamentoContabilPartida ===');
        const rCols2 = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'tbCntLancamentoContabilPartida'
            ORDER BY ORDINAL_POSITION
        `);
        console.table(rCols2.recordset);

        console.log('\n=== 4. CONTAGEM POR ANO E MES EM tbCntLancamentoContabil ===');
        const rCount = await pool.request().query(`
            SELECT 
                YEAR(dtLancamento) as ano, 
                MONTH(dtLancamento) as mes, 
                COUNT(*) as qtd_lancamentos,
                MIN(dtLancamento) as min_data,
                MAX(dtLancamento) as max_data
            FROM tbCntLancamentoContabil WITH (NOLOCK)
            GROUP BY YEAR(dtLancamento), MONTH(dtLancamento)
            ORDER BY ano DESC, mes DESC
        `);
        console.table(rCount.recordset);

        console.log('\n=== 5. AMOSTRA DE LANÇAMENTOS DO DIA 01/06/2025 (OU MAIS RECENTES) ===');
        const rSample = await pool.request().query(`
            SELECT TOP 20
                l.cdLancamentoContabil,
                l.dtLancamento,
                l.nrDocumento,
                l.Descricao,
                l.cdPessoaFilial,
                p.cdLancamentoContabilPartida,
                p.cdContaContabil,
                p.Valor,
                p.inDebito,
                p.HistoricoComplementar
            FROM tbCntLancamentoContabil l WITH (NOLOCK)
            JOIN tbCntLancamentoContabilPartida p WITH (NOLOCK) ON p.cdLancamentoContabil = l.cdLancamentoContabil
            WHERE CAST(l.dtLancamento AS DATE) = '2025-06-01'
            ORDER BY l.cdLancamentoContabil, p.cdLancamentoContabilPartida
        `);
        console.table(rSample.recordset);

        console.log('\n=== 6. CONTAGEM TOTAL DE PARTIDAS EM 01/06/2025 ===');
        const rPartidasCount = await pool.request().query(`
            SELECT 
                COUNT(DISTINCT l.cdLancamentoContabil) as qtd_lancamentos,
                COUNT(p.cdLancamentoContabilPartida) as qtd_partidas,
                SUM(CASE WHEN p.inDebito = 1 OR p.inDebito = '1' OR p.inDebito = 'D' THEN p.Valor ELSE 0 END) as total_debito,
                SUM(CASE WHEN p.inDebito = 0 OR p.inDebito = '0' OR p.inDebito = 'C' THEN p.Valor ELSE 0 END) as total_credito
            FROM tbCntLancamentoContabil l WITH (NOLOCK)
            JOIN tbCntLancamentoContabilPartida p WITH (NOLOCK) ON p.cdLancamentoContabil = l.cdLancamentoContabil
            WHERE CAST(l.dtLancamento AS DATE) = '2025-06-01'
        `);
        console.table(rPartidasCount.recordset);

        console.log('\n=== 7. CONTAGEM TOTAL DE PARTIDAS NO MÊS 06/2025 INTEIRO ===');
        const rMonthCount = await pool.request().query(`
            SELECT 
                CAST(l.dtLancamento AS DATE) as data,
                COUNT(DISTINCT l.cdLancamentoContabil) as qtd_lancamentos,
                COUNT(p.cdLancamentoContabilPartida) as qtd_partidas
            FROM tbCntLancamentoContabil l WITH (NOLOCK)
            JOIN tbCntLancamentoContabilPartida p WITH (NOLOCK) ON p.cdLancamentoContabil = l.cdLancamentoContabil
            WHERE CAST(l.dtLancamento AS DATE) BETWEEN '2025-06-01' AND '2025-06-30'
            GROUP BY CAST(l.dtLancamento AS DATE)
            ORDER BY data ASC
        `);
        console.table(rMonthCount.recordset);

        console.log('\n=== 8. VERIFICAR SE HÁ OUTRAS TABELAS DE LANÇAMENTOS (CUPOM / FISCAL / BAIXAS) ===');
        const rOther = await pool.request().query(`
            SELECT 
                (SELECT COUNT(*) FROM tbCupom WITH (NOLOCK) WHERE CAST(dtCupom AS DATE) = '2025-06-01') as qtd_cupons_01062025,
                (SELECT COUNT(*) FROM tbNota WITH (NOLOCK) WHERE CAST(dtNota AS DATE) = '2025-06-01') as qtd_notas_01062025,
                (SELECT COUNT(*) FROM tbContaBaixa WITH (NOLOCK) WHERE CAST(dtContaBaixa AS DATE) = '2025-06-01') as qtd_baixas_01062025,
                (SELECT COUNT(*) FROM tbBancoContaMovimento WITH (NOLOCK) WHERE CAST(dtLancamento AS DATE) = '2025-06-01') as qtd_bancarios_01062025
        `);
        console.table(rOther.recordset);

    } catch (e: any) {
        console.error('Erro na execucao:', e);
    } finally {
        await pool.close();
    }
}

main().catch(console.error);
