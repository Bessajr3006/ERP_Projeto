import sql from 'mssql';

export class ExternalDbService {
    static async queryExternalSqlServer(config: {
        host?: string | null;
        database?: string | null;
        user?: string | null;
        password?: string | null;
    }, startDate: string, endDate: string, cdFilial: string): Promise<any[]> {
        let server = config.host || '';
        let port = 1433;
        if (server.includes(',')) {
            const parts = server.split(',');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || 1433;
        } else if (server.includes(':')) {
            const parts = server.split(':');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || 1433;
        }

        const sqlConfig: sql.config = {
            user: config.user || '',
            password: config.password || '',
            database: config.database || '',
            server: server,
            port: port,
            pool: {
                max: 5,
                min: 0,
                idleTimeoutMillis: 15000
            },
            options: {
                encrypt: false,
                trustServerCertificate: true
            },
            connectionTimeout: 10000,
            requestTimeout: 15000
        };

        const pool = await sql.connect(sqlConfig);
        try {
            const request = pool.request();
            request.input('startDate', sql.VarChar, `${startDate} 00:00:00`);
            request.input('endDate', sql.VarChar, `${endDate} 23:59:59`);
            request.input('cdFilial', sql.VarChar, cdFilial);

            const query = `
                SELECT t1.*, t2.nome, t2.Endereco, t2.Bairro, t2.Cidade, t2.CEP, t2.Celular  
                FROM tbCrediarioCupom t1
                LEFT JOIN tbCrediario t2 ON t1.cdCrediario = t2.cdCrediario
                WHERE t1.dtCancelado IS NULL
                  AND t1.dtVencimento BETWEEN @startDate AND @endDate
                  AND t1.vlQuitado IS NULL
                  AND t2.nome IS NOT NULL
                  AND t1.cdFilial = @cdFilial
            `;

            const result = await request.query(query);
            return result.recordset || [];
        } finally {
            await pool.close();
        }
    }
}
