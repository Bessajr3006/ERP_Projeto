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

    const pool = await sql.connect(config);

    try {
        console.log('=== TESTE DE CONTAGEM DE MOVIMENTOS SOLIDCON ===');
        
        // 1. Verificar datas recentes e contagens por ano/mês em tbCntLancamentoContabil
        const rCnt = await pool.request().query(`
            SELECT TOP 10 
                YEAR(dtLancamento) as ano, 
                MONTH(dtLancamento) as mes, 
                COUNT(*) as qtd_lancamentos
            FROM tbCntLancamentoContabil WITH (NOLOCK)
            GROUP BY YEAR(dtLancamento), MONTH(dtLancamento)
            ORDER BY ano DESC, mes DESC
        `);
        console.log('--- tbCntLancamentoContabil (Últimos meses) ---');
        console.table(rCnt.recordset);

        // 2. Verificar datas recentes e contagens em tbBancoContaMovimento
        const rBcm = await pool.request().query(`
            SELECT TOP 10 
                YEAR(dtLancamento) as ano, 
                MONTH(dtLancamento) as mes, 
                COUNT(*) as qtd_movimentos
            FROM tbBancoContaMovimento WITH (NOLOCK)
            GROUP BY YEAR(dtLancamento), MONTH(dtLancamento)
            ORDER BY ano DESC, mes DESC
        `);
        console.log('--- tbBancoContaMovimento (Últimos meses) ---');
        console.table(rBcm.recordset);

        // 3. Verificar datas recentes e contagens em vwaporttec_contas
        const rVw = await pool.request().query(`
            SELECT TOP 10 
                ano, 
                mes, 
                COUNT(*) as qtd_baixas
            FROM vwaporttec_contas WITH (NOLOCK)
            GROUP BY ano, mes
            ORDER BY ano DESC, mes DESC
        `);
        console.log('--- vwaporttec_contas (Últimos meses) ---');
        console.table(rVw.recordset);

        // 4. Testar data 2025-06-01 especificamente
        console.log('\n--- Teste 01/06/2025 ---');
        const rTestDate = await pool.request()
            .input('dt', sql.VarChar, '2025-06-01')
            .query(`
                SELECT 
                    (SELECT COUNT(*) FROM tbCntLancamentoContabil WHERE CAST(dtLancamento AS DATE) = '2025-06-01') as cnt_lancamentos,
                    (SELECT COUNT(*) FROM tbCntLancamentoContabilPartida p JOIN tbCntLancamentoContabil l ON l.cdLancamentoContabil = p.cdLancamentoContabil WHERE CAST(l.dtLancamento AS DATE) = '2025-06-01') as cnt_partidas,
                    (SELECT COUNT(*) FROM tbBancoContaMovimento WHERE CAST(dtLancamento AS DATE) = '2025-06-01') as bcm_movimentos,
                    (SELECT COUNT(*) FROM vwaporttec_contas WHERE CAST(dtbaixa AS DATE) = '2025-06-01') as vw_baixas,
                    (SELECT COUNT(*) FROM tbContaBaixa WHERE CAST(dtContaBaixa AS DATE) = '2025-06-01') as cb_baixas
            `);
        console.table(rTestDate.recordset);

        // 5. Testar mês 06/2025 completo
        console.log('\n--- Teste Mês 06/2025 Completo ---');
        const rTestMonth = await pool.request()
            .query(`
                SELECT 
                    (SELECT COUNT(*) FROM tbCntLancamentoContabil WHERE CAST(dtLancamento AS DATE) BETWEEN '2025-06-01' AND '2025-06-30') as cnt_lancamentos,
                    (SELECT COUNT(*) FROM tbCntLancamentoContabilPartida p JOIN tbCntLancamentoContabil l ON l.cdLancamentoContabil = p.cdLancamentoContabil WHERE CAST(l.dtLancamento AS DATE) BETWEEN '2025-06-01' AND '2025-06-30') as cnt_partidas,
                    (SELECT COUNT(*) FROM tbBancoContaMovimento WHERE CAST(dtLancamento AS DATE) BETWEEN '2025-06-01' AND '2025-06-30') as bcm_movimentos,
                    (SELECT COUNT(*) FROM vwaporttec_contas WHERE CAST(dtbaixa AS DATE) BETWEEN '2025-06-01' AND '2025-06-30') as vw_baixas,
                    (SELECT COUNT(*) FROM tbContaBaixa WHERE CAST(dtContaBaixa AS DATE) BETWEEN '2025-06-01' AND '2025-06-30') as cb_baixas
            `);
        console.table(rTestMonth.recordset);

    } catch (e: any) {
        console.error(e);
    } finally {
        await pool.close();
    }
}

main().catch(console.error);
