import sql from 'mssql';

async function testAllQueries() {
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

    console.log('Connecting...');
    const pool = await sql.connect(config);
    console.log('Connected!');

    const ano = 2026;
    const mes = 9; // Let's test month 9 / 2026 (current month)
    const cdFilial = undefined;
    const filialClauseView = '';

    // 1. Anual
    try {
        console.log('Testing Query 1: Anual');
        const reqAnual = pool.request();
        reqAnual.input('ano', sql.Int, ano);
        const queryAnual = `
            SELECT 
                mes,
                SUM(CASE WHEN tipo = 'Receitas' THEN vlbaixa ELSE 0 END) as receita,
                SUM(CASE WHEN tipo = 'Despesas' THEN vlbaixa ELSE 0 END) as despesa,
                COUNT(CASE WHEN tipo = 'Receitas' THEN 1 END) as qtd_receita,
                COUNT(CASE WHEN tipo = 'Despesas' THEN 1 END) as qtd_despesa
            FROM vwaporttec_contas WITH (NOLOCK)
            WHERE ano = @ano
              ${filialClauseView}
            GROUP BY mes
            ORDER BY mes ASC
        `;
        const resAnual = await reqAnual.query(queryAnual);
        console.log('Query 1 OK, rows:', resAnual.recordset.length);
    } catch (e) {
        console.error('ERROR in Query 1 (Anual):', e);
    }

    // 2. Diario
    try {
        console.log('Testing Query 2: Diario');
        const reqDiario = pool.request();
        reqDiario.input('ano', sql.Int, ano);
        reqDiario.input('mes', sql.Int, mes);
        const queryDiario = `
            SELECT 
                dia,
                CONVERT(VARCHAR(10), dtbaixa, 120) as data,
                SUM(CASE WHEN tipo = 'Receitas' THEN vlbaixa ELSE 0 END) as receita,
                SUM(CASE WHEN tipo = 'Despesas' THEN vlbaixa ELSE 0 END) as despesa,
                COUNT(CASE WHEN tipo = 'Receitas' THEN 1 END) as qtd_receita,
                COUNT(CASE WHEN tipo = 'Despesas' THEN 1 END) as qtd_despesa
            FROM vwaporttec_contas WITH (NOLOCK)
            WHERE ano = @ano AND mes = @mes
              ${filialClauseView}
            GROUP BY dia, CONVERT(VARCHAR(10), dtbaixa, 120)
            ORDER BY dia ASC
        `;
        const resDiario = await reqDiario.query(queryDiario);
        console.log('Query 2 OK, rows:', resDiario.recordset.length);
    } catch (e) {
        console.error('ERROR in Query 2 (Diario):', e);
    }

    // 3. Bancos
    try {
        console.log('Testing Query 3: Bancos');
        const reqBancos = pool.request();
        reqBancos.input('ano', sql.Int, ano);
        reqBancos.input('mes', sql.Int, mes);
        const queryBancos = `
            SELECT 
                ISNULL(nmbanco, 'Caixa / Outros') as banco,
                ISNULL(CAST(cdbanco AS VARCHAR), '') as conta_numero,
                SUM(CASE WHEN tipo = 'Receitas' THEN vlbaixa ELSE 0 END) as receita,
                SUM(CASE WHEN tipo = 'Despesas' THEN vlbaixa ELSE 0 END) as despesa,
                COUNT(*) as qtd
            FROM vwaporttec_contas WITH (NOLOCK)
            WHERE ano = @ano AND mes = @mes
              ${filialClauseView}
            GROUP BY ISNULL(nmbanco, 'Caixa / Outros'), ISNULL(CAST(cdbanco AS VARCHAR), '')
            ORDER BY (SUM(CASE WHEN tipo = 'Receitas' THEN vlbaixa ELSE 0 END) + SUM(CASE WHEN tipo = 'Despesas' THEN vlbaixa ELSE 0 END)) DESC
        `;
        const resBancos = await reqBancos.query(queryBancos);
        console.log('Query 3 OK, rows:', resBancos.recordset.length);
    } catch (e) {
        console.error('ERROR in Query 3 (Bancos):', e);
    }

    // 4. Categorias
    try {
        console.log('Testing Query 4: Categorias');
        const reqCats = pool.request();
        reqCats.input('ano', sql.Int, ano);
        reqCats.input('mes', sql.Int, mes);
        const resCats = await reqCats.query(`
            SELECT 
                CASE WHEN tipo = 'Receitas' THEN 'receita' ELSE 'despesa' END as tipo,
                ISNULL(tipoconta, 'Outros') as tipoconta,
                SUM(vlbaixa) as valor,
                COUNT(*) as qtd
            FROM vwaporttec_contas WITH (NOLOCK)
            WHERE ano = @ano AND mes = @mes
              ${filialClauseView}
            GROUP BY tipo, tipoconta
            ORDER BY valor DESC
        `);
        console.log('Query 4 OK, rows:', resCats.recordset.length);
    } catch (e) {
        console.error('ERROR in Query 4 (Categorias):', e);
    }

    // 5. Transacoes
    try {
        console.log('Testing Query 5: Transacoes');
        const reqTrans = pool.request();
        reqTrans.input('ano', sql.Int, ano);
        reqTrans.input('mes', sql.Int, mes);
        const queryTrans = `
            SELECT TOP 500
                cdcontabaixa as id,
                CONVERT(VARCHAR(10), dtbaixa, 120) as data,
                CAST(cdcontabaixa AS VARCHAR) as documento,
                ISNULL(tipoconta + ' - ' + conta + (CASE WHEN referencia IS NOT NULL AND referencia <> '' THEN ' (' + referencia + ')' ELSE '' END), ISNULL(referencia, 'Lançamento')) as historico,
                CASE WHEN tipo = 'Receitas' THEN 'receita' ELSE 'despesa' END as tipo,
                CAST(vlbaixa AS FLOAT) as valor,
                ISNULL(nmbanco, 'Geral') as banco,
                cdfilial as filial,
                ISNULL(filial, '') as nome_filial,
                ISNULL(tipoconta, '') as tipoconta,
                ISNULL(conta, '') as conta,
                ISNULL(referencia, '') as referencia
            FROM vwaporttec_contas WITH (NOLOCK)
            WHERE ano = @ano AND mes = @mes
              ${filialClauseView}
            ORDER BY dtbaixa DESC, cdcontabaixa DESC
        `;
        const resTrans = await reqTrans.query(queryTrans);
        console.log('Query 5 OK, rows:', resTrans.recordset.length);
    } catch (e) {
        console.error('ERROR in Query 5 (Transacoes):', e);
    }

    // 6. Filiais
    try {
        console.log('Testing Query 6: Filiais');
        const reqFiliais = pool.request();
        const resFiliais = await reqFiliais.query(`
            SELECT DISTINCT cdfilial as id, filial as nome
            FROM vwaporttec_contas WITH (NOLOCK)
            WHERE cdfilial IS NOT NULL
            ORDER BY cdfilial ASC
        `);
        console.log('Query 6 OK, rows:', resFiliais.recordset.length);
    } catch (e) {
        console.error('ERROR in Query 6 (Filiais):', e);
    }

    // Also test with other months / years (e.g. 2025, 2024, etc.)
    for (let y of [2023, 2024, 2025, 2026]) {
        for (let m of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
            try {
                const req = pool.request().input('ano', sql.Int, y).input('mes', sql.Int, m);
                await req.query(`
                    SELECT TOP 10 *
                    FROM vwaporttec_contas WITH (NOLOCK)
                    WHERE ano = @ano AND mes = @mes
                `);
            } catch (err: any) {
                console.error(`FAILED on y=${y}, m=${m}:`, err.message);
            }
        }
    }

    await pool.close();
}

testAllQueries().catch(console.error);
