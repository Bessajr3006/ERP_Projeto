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

        const colsPedido = await poolMs.request().query(
            "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbPedido'"
        );
        console.log('tbPedido columns:', colsPedido.recordset.map(r => `${r.COLUMN_NAME} (${r.DATA_TYPE})`).join(', '));

        const colsItem = await poolMs.request().query(
            "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbPedidoItem'"
        );
        console.log('tbPedidoItem columns:', colsItem.recordset.map(r => `${r.COLUMN_NAME} (${r.DATA_TYPE})`).join(', '));

        const countRes = await poolMs.request().query(
            "SELECT COUNT(*) as total, MIN(dtPedido) as minDate, MAX(dtPedido) as maxDate FROM tbPedido"
        );
        console.log('tbPedido stats:', countRes.recordset[0]);

        await poolMs.close();
        process.exit(0);

        // Check columns of tbpedido or similar
        const cols = await poolMs.request().query(
            "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbpedido' OR TABLE_NAME = 'tbPedido'"
        );
        console.log('Columns of tbpedido:', cols.recordset);

        // Get 3 sample rows
        const samples = await poolMs.request().query(
            "SELECT TOP 3 * FROM tbpedido"
        );
        console.log('Sample rows from tbpedido:', JSON.stringify(samples.recordset, null, 2));

        await poolMs.close();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

run();
