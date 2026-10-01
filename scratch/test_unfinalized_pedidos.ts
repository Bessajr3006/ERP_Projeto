import sql from 'mssql';

async function run() {
    try {
        const config: sql.config = {
            user: 'aporttec',
            password: '30mariafn@',
            server: 'n13884.ddns.net',
            database: 'dorsal',
            port: 1433,
            options: { encrypt: false, trustServerCertificate: true },
            connectionTimeout: 10000,
            requestTimeout: 15000
        };

        const poolMs = await sql.connect(config);
        console.log('Connected to Dorsal SQL Server!');

        // Check columns that might indicate finalization/status
        const cols = await poolMs.request().query(
            "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbPedido'"
        );
        console.log('tbPedido columns:', cols.recordset.map(r => r.COLUMN_NAME));

        // Check different statuses / timestamps of pedidos:
        // hrInclusao, hrEmissao, hrRegistro, hrEnvio, hrEntrega, inCancelado, nrCupom, cdPDV, COO, ValorRegistrado, etc.
        const samples = await poolMs.request().query(`
            SELECT TOP 20
                cdPedido, dtPedido, hrInclusao, hrEmissao, hrRegistro, hrEnvio, hrEntrega,
                nrCupom, cdPDV, COO, inCancelado, dtCancelado, ValorRegistrado, vlTotal
            FROM tbPedido
            ORDER BY cdPedido DESC
        `);
        console.log('Recent 20 pedidos status fields:');
        console.table(samples.recordset);

        // Check pedidos where hrRegistro IS NULL or hrEmissao IS NULL or nrCupom IS NULL or COO IS NULL
        const unfinalizedChecks = await poolMs.request().query(`
            SELECT 
                COUNT(*) AS total,
                SUM(CASE WHEN inCancelado = 1 OR dtCancelado IS NOT NULL THEN 1 ELSE 0 END) AS cancelados,
                SUM(CASE WHEN (inCancelado = 0 OR inCancelado IS NULL) AND dtCancelado IS NULL AND (hrRegistro IS NOT NULL OR hrEmissao IS NOT NULL OR nrCupom IS NOT NULL OR COO IS NOT NULL) THEN 1 ELSE 0 END) AS finalizados,
                SUM(CASE WHEN (inCancelado = 0 OR inCancelado IS NULL) AND dtCancelado IS NULL AND hrRegistro IS NULL AND hrEmissao IS NULL AND nrCupom IS NULL AND COO IS NULL THEN 1 ELSE 0 END) AS nao_finalizados_sem_cupom_registro,
                SUM(CASE WHEN (inCancelado = 0 OR inCancelado IS NULL) AND dtCancelado IS NULL AND hrRegistro IS NULL AND hrEmissao IS NULL THEN 1 ELSE 0 END) AS nao_finalizados_sem_registro_emissao,
                SUM(CASE WHEN (inCancelado = 0 OR inCancelado IS NULL) AND dtCancelado IS NULL AND hrEntrega IS NULL THEN 1 ELSE 0 END) AS sem_entrega
            FROM tbPedido
            WHERE dtPedido >= '2026-08-01'
        `);
        console.log('Unfinalized breakdown since August 2026:');
        console.table(unfinalizedChecks.recordset);

        // Check samples of unfinalized orders
        const unfinalizedSamples = await poolMs.request().query(`
            SELECT TOP 5
                cdPedido, dtPedido, hrInclusao, hrEmissao, hrRegistro, hrEnvio, hrEntrega,
                nrCupom, cdPDV, COO, inCancelado, dtCancelado, ValorRegistrado, vlTotal, nmCliente, Obs
            FROM tbPedido
            WHERE (inCancelado = 0 OR inCancelado IS NULL) 
              AND dtCancelado IS NULL 
              AND (hrRegistro IS NULL AND hrEmissao IS NULL)
            ORDER BY cdPedido DESC
        `);
        console.log('Sample unfinalized pedidos (sem registro / sem emissão):');
        console.dir(unfinalizedSamples.recordset, { depth: null });

        await poolMs.close();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

run();
