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
        const ano = 2026;
        const mes = 1;

        console.log(`\n=== 1. Testando Listagem Top 10 Detalhada (${mes}/${ano}) ===`);
        const resTrans = await pool.request()
            .input('ano', sql.Int, ano)
            .input('mes', sql.Int, mes)
            .query(`
                SELECT TOP 10
                    cdcontabaixa as id,
                    CONVERT(VARCHAR(10), dtbaixa, 120) as data,
                    CAST(cdcontabaixa AS VARCHAR) as documento,
                    ISNULL(tipoconta + ' - ' + conta + (CASE WHEN referencia IS NOT NULL AND referencia <> '' THEN ' (' + referencia + ')' ELSE '' END), ISNULL(referencia, 'Lançamento')) as historico,
                    CASE WHEN tipo = 'Receitas' THEN 'receita' ELSE 'despesa' END as tipo,
                    CAST(vlbaixa AS FLOAT) as valor,
                    ISNULL(nmbanco, 'Geral') as banco,
                    cdfilial as filial,
                    tipoconta,
                    conta,
                    empresa,
                    filial as nome_filial
                FROM vwaporttec_contas WITH (NOLOCK)
                WHERE ano = @ano AND mes = @mes
                ORDER BY dtbaixa DESC, cdcontabaixa DESC
            `);
        console.table(resTrans.recordset);

        console.log(`\n=== 2. Testando Filiais ===`);
        const resFiliais = await pool.request().query(`
            SELECT DISTINCT cdfilial as id, filial as nome
            FROM vwaporttec_contas WITH (NOLOCK)
            ORDER BY cdfilial ASC
        `);
        console.table(resFiliais.recordset);

        console.log(`\n=== 3. Testando Categorias (Tipos de Conta) ===`);
        const resCats = await pool.request()
            .input('ano', sql.Int, ano)
            .input('mes', sql.Int, mes)
            .query(`
                SELECT 
                    tipo,
                    tipoconta,
                    SUM(vlbaixa) as valor,
                    COUNT(*) as qtd
                FROM vwaporttec_contas WITH (NOLOCK)
                WHERE ano = @ano AND mes = @mes
                GROUP BY tipo, tipoconta
                ORDER BY valor DESC
            `);
        console.table(resCats.recordset);

    } catch (e: any) {
        console.error(e);
    } finally {
        await pool.close();
    }
}

main().catch(console.error);
