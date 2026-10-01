import 'dotenv/config';
import '../src/config/runtimeEnv';
import '../src/config/timezone';
import pool from '../src/config/db';
import sql from 'mssql';

async function main() {
    const [companies]: any = await pool.query('SELECT * FROM companies WHERE serv_solidcon IS NOT NULL LIMIT 1');
    const company = companies[0];
    let server = company.serv_solidcon || company.serv_dorsal;
    let port = 1433;
    if (server.includes(',')) {
        const parts = server.split(',');
        server = parts[0].trim();
        port = parseInt(parts[1].trim(), 10) || 1433;
    }

    const sqlConfig: sql.config = {
        user: company.login_solidcon || company.login_dorsal,
        password: company.senha_solidcon || company.senha_dorsal,
        database: company.bd_solidcon || company.bd_dorsal,
        server,
        port,
        options: { encrypt: false, trustServerCertificate: true },
        connectionTimeout: 10000,
        requestTimeout: 15000
    };

    console.log(`Conectando em ${server}:${port}/${sqlConfig.database}...`);
    const mssqlPool = new sql.ConnectionPool(sqlConfig);
    await mssqlPool.connect();

    console.log('\n--- COLUNAS DE tbContaBaixa ---');
    const colsBaixa = await mssqlPool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'tbContaBaixa'
        ORDER BY ORDINAL_POSITION
    `);
    console.table(colsBaixa.recordset);

    console.log('\n--- COLUNAS DE tbContaParcela ---');
    const colsParcela = await mssqlPool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'tbContaParcela'
        ORDER BY ORDINAL_POSITION
    `);
    console.table(colsParcela.recordset);

    console.log('\n--- TODAS AS TABELAS CONTENDO "ContaBaixa" ---');
    const tables = await mssqlPool.request().query(`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%Conta%'
    `);
    console.table(tables.recordset);

    console.log('\n--- REGISTROS EM tbContaBaixa (119332, 119331, 117621, 117607) ---');
    const resBaixaRows = await mssqlPool.request().query(`
        SELECT * FROM tbContaBaixa WHERE cdContaBaixa IN (119332, 119331, 117621, 117607)
    `);
    console.table(resBaixaRows.recordset);

    console.log('\n--- BUSCA POR DOCUMENTO OU HISTORICO 21205 EM tbContaBaixa ---');
    const resBaixaDoc = await mssqlPool.request().query(`
        SELECT TOP 10 * FROM tbContaBaixa WHERE Documento LIKE '%21205%' OR Historico LIKE '%21205%'
    `);
    console.table(resBaixaDoc.recordset);

    console.log('\n--- BUSCA POR DOCUMENTO OU HISTORICO 21205 EM tbConta ---');
    const resContaDoc = await mssqlPool.request().query(`
        SELECT TOP 10 * FROM tbConta WHERE Documento LIKE '%21205%' OR Historico LIKE '%21205%'
    `);
    console.table(resContaDoc.recordset);

    console.log('\n--- BUSCA POR DOCUMENTO OU HISTORICO 21205 EM tbContaParcela ---');
    const resParcDoc = await mssqlPool.request().query(`
        SELECT TOP 10 * FROM tbContaParcela WHERE Historico LIKE '%21205%'
    `);
    console.table(resParcDoc.recordset);

    await mssqlPool.close();
    await pool.end();
}

main().catch(console.error);
