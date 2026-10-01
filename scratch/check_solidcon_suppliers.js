(async () => {
    try {
        const pool = require('./dist/config/db').default || require('./dist/config/db');
        const [companies] = await pool.query('SELECT * FROM companies');
        console.log('Company columns:', Object.keys(companies[0] || {}));
        const comp = companies.find(c => (c.serv_solidcon && c.serv_solidcon.trim()) || (c.serv_dorsal && c.serv_dorsal.trim()));
        console.log('Found comp with host:', comp ? { id: comp.id, name: comp.name || comp.razao_social, serv_solidcon: comp.serv_solidcon, bd_solidcon: comp.bd_solidcon, login_solidcon: comp.login_solidcon, serv_dorsal: comp.serv_dorsal, bd_dorsal: comp.bd_dorsal } : 'None');
        if (!comp) {
            console.log('No solidcon/dorsal company found');
            return;
        }
        const sql = require('mssql');
        let server = comp.serv_solidcon || '';
        let port = 1433;
        if (server.includes(',')) {
            const parts = server.split(',');
            server = parts[0].trim();
            port = parseInt(parts[1].trim(), 10) || 1433;
        } else if (server.includes(':')) {
            const parts = server.split(':');
            server = parts[0].trim();
            port = parseInt(parts[1].trim(), 10) || 1433;
        }
        const sqlConfig = {
            user: comp.login_solidcon,
            password: comp.senha_solidcon,
            database: comp.bd_solidcon,
            server,
            port,
            options: { encrypt: false, trustServerCertificate: true },
            connectionTimeout: 10000,
            requestTimeout: 15000
        };
        const mssqlPool = await sql.connect(sqlConfig);
        const res = await mssqlPool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%pess%' OR TABLE_NAME LIKE '%forn%' OR TABLE_NAME LIKE '%parc%' OR TABLE_NAME LIKE '%forne%' OR TABLE_NAME LIKE '%contat%' OR TABLE_NAME LIKE '%clie%' ORDER BY TABLE_NAME");
        console.log('Matching tables in Solidcon:', res.recordset.map(r => r.TABLE_NAME));
        
        // Let's check tbPessoa, tbFornecedor, etc.
        for (const t of ['tbPessoa', 'tbPessoaJuridica', 'tbPessoaFisica', 'tbFornecedor', 'tbPessoaComercial', 'tbPessoaEndereco', 'tbPessoaTelefone', 'tbConta']) {
            try {
                const cols = await mssqlPool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '" + t + "'");
                console.log('Columns in ' + t + ':', cols.recordset.map(c => c.COLUMN_NAME).join(', '));
            } catch (err) {}
        }
        
        // Let's see a sample of suppliers if any table matches
        try {
            const sample = await mssqlPool.request().query("SELECT TOP 3 * FROM tbFornecedor");
            console.log('Sample tbFornecedor:', sample.recordset);
        } catch (e) {
            console.log('tbFornecedor err:', e.message);
        }

        try {
            const sampleP = await mssqlPool.request().query("SELECT TOP 3 * FROM tbPessoa");
            console.log('Sample tbPessoa:', sampleP.recordset);
        } catch (e) {
            console.log('tbPessoa err:', e.message);
        }

        await mssqlPool.close();
        await pool.end();
    } catch(e) {
        console.error('Error:', e.message);
    }
})();
