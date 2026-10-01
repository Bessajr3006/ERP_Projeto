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

    console.log('Conectando ao SQL Server Solidcon...');
    const pool = await sql.connect(config);
    console.log('Conectado!');

    try {
        // 1. Verificar colunas da view
        const colRes = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'vwaporttec_contas'
            ORDER BY ORDINAL_POSITION
        `);
        console.log('\n--- COLUNAS DE vwaporttec_contas ---');
        console.table(colRes.recordset);

        // 2. Obter definição da view (SQL create view) se disponível
        try {
            const defRes = await pool.request().query(`
                SELECT OBJECT_DEFINITION(OBJECT_ID('vwaporttec_contas')) as view_def
            `);
            console.log('\n--- DEFINIÇÃO DA VIEW ---');
            console.log(defRes.recordset[0]?.view_def);
        } catch (e: any) {
            console.log('Não foi possível obter a definição:', e.message);
        }

        // 3. Obter amostra de 5 linhas
        const sampleRes = await pool.request().query(`
            SELECT TOP 5 *
            FROM vwaporttec_contas WITH (NOLOCK)
        `);
        console.log('\n--- AMOSTRA DE DADOS (TOP 5) ---');
        console.dir(sampleRes.recordset, { depth: null });

        // 4. Testar agrupamento por ano/mes se houver campos de data
        const dateCols = colRes.recordset.filter(c => c.DATA_TYPE.includes('date') || c.DATA_TYPE.includes('time'));
        console.log('\nColunas de data encontradas:', dateCols.map(c => c.COLUMN_NAME));

    } catch (err: any) {
        console.error('Erro na consulta:', err);
    } finally {
        await pool.close();
    }
}

main().catch(console.error);
