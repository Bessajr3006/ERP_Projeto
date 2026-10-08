import sql from 'mssql';
import { Client as PgClient } from 'pg';

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

        let pool: sql.ConnectionPool;
        try {
            pool = await sql.connect(sqlConfig);
        } catch (connErr: any) {
            const msg = connErr?.message || '';
            const code = connErr?.code || '';
            if (code === 'ETIMEOUT' || code === 'ESOCKET' || code === 'ECONNREFUSED' || msg.includes('timeout') || msg.includes('Failed to connect') || msg.includes('getaddrinfo') || msg.includes('ENOTFOUND') || msg.includes('connect')) {
                throw new Error(`Não foi possível conectar ao banco de dados Solidcon (${server}:${port}). O servidor está fora do ar ou inacessível no momento.`);
            }
            if (msg.includes('Login failed') || code === 'ELOGIN') {
                throw new Error(`Falha de autenticação ao conectar no banco de dados Solidcon (${server}:${port}). Verifique usuário e senha no cadastro da empresa.`);
            }
            throw new Error(`Não foi possível conectar ao banco de dados Solidcon (${server}:${port}): ${msg || 'O servidor está fora do ar ou inacessível'}`);
        }

        try {
            const request = pool.request();
            request.input('startDate', sql.VarChar, `${startDate} 00:00:00`);
            request.input('endDate', sql.VarChar, `${endDate} 23:59:59`);

            const filials = String(cdFilial || '1')
                .split(',')
                .map(f => parseInt(f.trim(), 10))
                .filter(f => !isNaN(f));
            
            const filialInClause = filials.length > 0 
                ? `(TRY_CAST(t1.cdFilial AS INT) IN (${filials.join(',')}) OR CAST(t1.cdFilial AS VARCHAR) IN (${filials.map(f => `'${f}'`).join(',')}))`
                : `1=1`;

            const query = `
                SELECT t1.*, t2.nome, t2.Endereco, t2.Bairro, t2.Cidade, t2.CEP, t2.Celular  
                FROM tbCrediarioCupom t1
                LEFT JOIN tbCrediario t2 ON t1.cdCrediario = t2.cdCrediario
                WHERE t1.dtCancelado IS NULL
                  AND t1.dtVencimento BETWEEN @startDate AND @endDate
                  AND t2.nome IS NOT NULL
                  AND ${filialInClause}
            `;

            const result = await request.query(query);
            return result.recordset || [];
        } catch (queryErr: any) {
            const msg = queryErr?.message || '';
            if (msg.includes('timeout') || msg.includes('closed') || msg.includes('Failed to connect') || msg.includes('Socket') || msg.includes('Connection')) {
                throw new Error(`Conexão perdida com o banco de dados Solidcon. O servidor está fora do ar ou instável.`);
            }
            throw queryErr;
        } finally {
            if (pool) {
                try {
                    await pool.close();
                } catch {
                    // ignore
                }
            }
        }
    }

    static async queryExternalExpensesSqlServer(config: {
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

        let pool: sql.ConnectionPool;
        try {
            pool = await sql.connect(sqlConfig);
        } catch (connErr: any) {
            const msg = connErr?.message || '';
            const code = connErr?.code || '';
            if (code === 'ETIMEOUT' || code === 'ESOCKET' || code === 'ECONNREFUSED' || msg.includes('timeout') || msg.includes('Failed to connect') || msg.includes('getaddrinfo') || msg.includes('ENOTFOUND') || msg.includes('connect')) {
                throw new Error(`Não foi possível conectar ao banco de dados Solidcon (${server}:${port}). O servidor está fora do ar ou inacessível no momento.`);
            }
            if (msg.includes('Login failed') || code === 'ELOGIN') {
                throw new Error(`Falha de autenticação ao conectar no banco de dados Solidcon (${server}:${port}). Verifique usuário e senha no cadastro da empresa.`);
            }
            throw new Error(`Não foi possível conectar ao banco de dados Solidcon (${server}:${port}): ${msg || 'O servidor está fora do ar ou inacessível'}`);
        }

        try {
            const request = pool.request();
            request.input('startDate', sql.VarChar, `${startDate} 00:00:00`);
            request.input('endDate', sql.VarChar, `${endDate} 23:59:59`);

            const filials = String(cdFilial || '1')
                .split(',')
                .map(f => parseInt(f.trim(), 10))
                .filter(f => !isNaN(f));
            
            const filialInClause = filials.length > 0 
                ? `(TRY_CAST(c.cdPessoaFilialConta AS INT) IN (${filials.join(',')}) OR CAST(c.cdPessoaFilialConta AS VARCHAR) IN (${filials.map(f => `'${f}'`).join(',')}) OR c.cdPessoaFilialConta IS NULL)`
                : `1=1`;

            const query = `
                SELECT 
                    c.*,
                    cp.cdContaParcela,
                    cp.dtParcela,
                    cp.vlParcela,
                    cp.Historico AS historicoParcela,
                    cb.cdContaBaixa,
                    cb.dtContaBaixa,
                    cb.vlContaBaixa,
                    cb.inRecebimento,
                    cb.Historico AS historicoBaixa
                FROM tbConta c
                LEFT JOIN tbContaParcela cp ON cp.cdConta = c.cdConta AND cp.cdPessoaFilialConta = c.cdPessoaFilialConta
                LEFT JOIN tbContaBaixa cb ON cb.cdContaBaixa = cp.cdContaBaixa AND cb.cdPessoaFilialContaBaixa = cp.cdPessoaFilialContaBaixa
                WHERE (c.cdContaTipo IN (1, 3))
                  AND (
                      (cp.dtParcela BETWEEN @startDate AND @endDate)
                      OR (c.dtInclusao BETWEEN @startDate AND @endDate)
                      OR (cb.dtContaBaixa BETWEEN @startDate AND @endDate)
                  )
                  AND ${filialInClause}
                ORDER BY c.cdConta DESC, cp.cdContaParcela ASC
            `;

            const result = await request.query(query);
            return result.recordset || [];
        } catch (queryErr: any) {
            const msg = queryErr?.message || '';
            if (msg.includes('timeout') || msg.includes('closed') || msg.includes('Failed to connect') || msg.includes('Socket') || msg.includes('Connection')) {
                throw new Error(`Conexão perdida com o banco de dados Solidcon. O servidor está fora do ar ou instável.`);
            }
            throw queryErr;
        } finally {
            if (pool) {
                try {
                    await pool.close();
                } catch {
                    // ignore
                }
            }
        }
    }

    static async queryExternalSuppliersSqlServer(config: {
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
            requestTimeout: 20000
        };

        let pool: sql.ConnectionPool;
        try {
            pool = await sql.connect(sqlConfig);
        } catch (connErr: any) {
            const msg = connErr?.message || '';
            const code = connErr?.code || '';
            if (code === 'ETIMEOUT' || code === 'ESOCKET' || code === 'ECONNREFUSED' || msg.includes('timeout') || msg.includes('Failed to connect') || msg.includes('getaddrinfo') || msg.includes('ENOTFOUND') || msg.includes('connect')) {
                throw new Error(`Não foi possível conectar ao banco de dados Solidcon (${server}:${port}). O servidor está fora do ar ou inacessível no momento.`);
            }
            if (msg.includes('Login failed') || code === 'ELOGIN') {
                throw new Error(`Falha de autenticação ao conectar no banco de dados Solidcon (${server}:${port}). Verifique usuário e senha no cadastro da empresa.`);
            }
            throw new Error(`Não foi possível conectar ao banco de dados Solidcon (${server}:${port}): ${msg || 'O servidor está fora do ar ou inacessível'}`);
        }

        try {
            const colsReq = pool.request();
            const colsRes = await colsReq.query(`
                SELECT TABLE_NAME, COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME IN ('tbFornecedor', 'tbPessoa', 'tbPessoaJuridica', 'tbPessoaFisica', 'tbEndereco', 'tbTelefone', 'tbConta', 'tbContaParcela', 'tbContaBaixa')
            `);
            const tableCols: Record<string, string[]> = {};
            for (const r of colsRes.recordset || []) {
                const t = String(r.TABLE_NAME || '').toLowerCase();
                const c = String(r.COLUMN_NAME || '');
                if (!tableCols[t]) tableCols[t] = [];
                tableCols[t].push(c);
            }

            const filials = String(cdFilial || '1')
                .split(',')
                .map(f => parseInt(f.trim(), 10))
                .filter(f => !isNaN(f));
            
            const filialInClause = filials.length > 0 
                ? `(TRY_CAST(c.cdPessoaFilialConta AS INT) IN (${filials.join(',')}) OR CAST(c.cdPessoaFilialConta AS VARCHAR) IN (${filials.map(f => `'${f}'`).join(',')}) OR c.cdPessoaFilialConta IS NULL)`
                : `1=1`;

            // Helper to check column existence (case-insensitive)
            const hasCol = (table: string, col: string) => {
                const cols = tableCols[table.toLowerCase()] || [];
                return cols.some(c => c.toLowerCase() === col.toLowerCase());
            };

            const request = pool.request();
            request.input('startDate', sql.VarChar, `${startDate} 00:00:00`);
            request.input('endDate', sql.VarChar, `${endDate} 23:59:59`);

            // Estratégia Principal: Solidcon relacional (tbPessoa + tbFornecedor + tbPessoaJuridica + tbPessoaFisica + tbEndereco + tbTelefone)
            if (tableCols['tbpessoa']) {
                const hasFornecedor = !!tableCols['tbfornecedor'];
                const hasPj = !!tableCols['tbpessoajuridica'];
                const hasPf = !!tableCols['tbpessoafisica'];
                const hasEnd = !!tableCols['tbendereco'];
                const hasTel = !!tableCols['tbtelefone'];
                const hasConta = !!tableCols['tbconta'];

                let selects = `
                    p.cdPessoa AS cdFornecedor,
                    COALESCE(${hasPj ? 'pj.RazaoSocial, ' : ''}${hasPf ? 'pf.nmCompleto, ' : ''}p.nmPessoa) AS name,
                    p.nmPessoa AS trade_name,
                    ${hasPj ? 'pj.RazaoSocial' : 'NULL'} AS razao_social,
                    ${hasPj || hasPf ? `
                    CASE 
                        ${hasPj ? 'WHEN pj.cdPessoaJuridica IS NOT NULL THEN CONCAT(pj.CNPJEmpresa, pj.CNPJFilial, pj.CNPJDV)' : ''}
                        ${hasPf ? 'WHEN pf.cdPessoaFisica IS NOT NULL THEN CONCAT(pf.CPF, pf.CPFDV)' : ''}
                        ELSE NULL 
                    END` : 'NULL'} AS cnpj_cpf,
                    ${hasPj || hasPf ? `COALESCE(${hasPj ? 'pj.InscricaoEstadual' : 'NULL'}, ${hasPf ? 'pf.InscricaoEstadual' : 'NULL'})` : 'NULL'} AS inscricao_estadual,
                    ${hasPj ? 'pj.InscricaoMunicipal' : 'NULL'} AS inscricao_municipal,
                    ${hasEnd ? `
                    e.Logradouro AS logradouro,
                    e.Numero AS numero,
                    e.Complemento AS complemento,
                    e.Bairro AS bairro,
                    e.Cidade AS cidade,
                    e.cdEstado AS estado,
                    e.CEP AS cep,
                    e.cdMunicipio AS cdMunicipio,` : `
                    NULL AS logradouro,
                    NULL AS numero,
                    NULL AS complemento,
                    NULL AS bairro,
                    NULL AS cidade,
                    NULL AS estado,
                    NULL AS cep,
                    NULL AS cdMunicipio,`}
                    ${hasTel ? `
                    CASE 
                        WHEN t.Numero IS NOT NULL THEN CONCAT(COALESCE(t.DDD, ''), t.Numero)
                        ELSE NULL 
                    END` : 'NULL'} AS telefone
                `;

                let joins = '';
                if (hasFornecedor) joins += ' LEFT JOIN tbFornecedor f ON f.cdPessoaComercial = p.cdPessoa ';
                if (hasPj) joins += ' LEFT JOIN tbPessoaJuridica pj ON pj.cdPessoaJuridica = p.cdPessoa ';
                if (hasPf) joins += ' LEFT JOIN tbPessoaFisica pf ON pf.cdPessoaFisica = p.cdPessoa ';
                if (hasEnd) joins += ' LEFT JOIN tbEndereco e ON e.cdPessoa = p.cdPessoa AND (e.cdEnderecoTipo = 1 OR e.cdEnderecoTipo IS NULL) ';
                if (hasTel) joins += ' LEFT JOIN tbTelefone t ON t.cdPessoa = p.cdPessoa AND (t.cdTelefone = 1 OR t.cdTelefone IS NULL) ';

                let whereConditions: string[] = [];
                if (hasFornecedor) whereConditions.push('f.cdPessoaComercial IS NOT NULL');
                if (hasCol('tbPessoa', 'inFornecedor')) whereConditions.push('p.inFornecedor = 1');
                if (hasConta) {
                    whereConditions.push('p.cdPessoa IN (SELECT DISTINCT c.cdPessoaComercial FROM tbConta c WHERE c.cdPessoaComercial IS NOT NULL)');
                }

                const whereClause = whereConditions.length > 0 ? whereConditions.join(' OR ') : '1=1';

                const query = `
                    SELECT DISTINCT
                        ${selects}
                    FROM tbPessoa p
                    ${joins}
                    WHERE ${whereClause}
                    ORDER BY name ASC;
                `;

                const result = await request.query(query);
                if (result.recordset && result.recordset.length > 0) {
                    return result.recordset;
                }
            }

            // Estratégia 2: Se tbConta existir isoladamente
            if (tableCols['tbconta']) {
                let pessoaJoin = '';
                let pessoaSelects = '';

                if (tableCols['tbpessoa']) {
                    pessoaJoin = ` LEFT JOIN tbPessoa p ON p.cdPessoa = c.cdPessoaComercial `;
                    if (hasCol('tbPessoa', 'nmPessoa')) pessoaSelects += ', p.nmPessoa AS nome ';
                    if (hasCol('tbPessoa', 'nmRazaoSocial')) pessoaSelects += ', p.nmRazaoSocial AS razao_social ';
                    if (hasCol('tbPessoa', 'nmFantasia')) pessoaSelects += ', p.nmFantasia AS nome_fantasia ';
                }

                let joins = '';
                if (tableCols['tbcontaparcela']) {
                    joins += ' LEFT JOIN tbContaParcela cp ON cp.cdConta = c.cdConta AND cp.cdPessoaFilialConta = c.cdPessoaFilialConta ';
                }
                if (tableCols['tbcontabaixa'] && tableCols['tbcontaparcela']) {
                    joins += ' LEFT JOIN tbContaBaixa cb ON cb.cdContaBaixa = cp.cdContaBaixa AND cb.cdPessoaFilialContaBaixa = cp.cdPessoaFilialContaBaixa ';
                }

                const query = `
                    SELECT 
                        c.*
                        ${tableCols['tbcontaparcela'] ? ', cp.Historico AS historicoParcela, cp.dtParcela, cp.vlParcela' : ''}
                        ${tableCols['tbcontabaixa'] ? ', cb.Historico AS historicoBaixa, cb.dtContaBaixa, cb.vlContaBaixa' : ''}
                        ${pessoaSelects}
                    FROM tbConta c
                    ${joins}
                    ${pessoaJoin}
                    WHERE (c.cdContaTipo IN (1, 3))
                      AND (
                          ${tableCols['tbcontaparcela'] ? '(cp.dtParcela BETWEEN @startDate AND @endDate) OR' : ''}
                          (c.dtInclusao BETWEEN @startDate AND @endDate)
                          ${tableCols['tbcontabaixa'] ? 'OR (cb.dtContaBaixa BETWEEN @startDate AND @endDate)' : ''}
                      )
                      AND ${filialInClause}
                    ORDER BY c.cdConta DESC;
                `;

                const result = await request.query(query);
                if (result.recordset && result.recordset.length > 0) {
                    return result.recordset;
                }
            }

            // Estratégia 3: Se tbFornecedor existir diretamente
            if (tableCols['tbfornecedor']) {
                const resForn = await pool.request().query('SELECT * FROM tbFornecedor');
                if (resForn.recordset && resForn.recordset.length > 0) {
                    return resForn.recordset;
                }
            }

            return [];
        } catch (queryErr: any) {
            const msg = queryErr?.message || '';
            if (msg.includes('timeout') || msg.includes('closed') || msg.includes('Failed to connect') || msg.includes('Socket') || msg.includes('Connection')) {
                throw new Error(`Conexão perdida com o banco de dados Solidcon. O servidor está fora do ar ou instável.`);
            }
            throw queryErr;
        } finally {
            if (pool) {
                try {
                    await pool.close();
                } catch {
                    // ignore
                }
            }
        }
    }

    static async queryExternalCustomersSqlServer(config: {
        host?: string | null;
        database?: string | null;
        user?: string | null;
        password?: string | null;
    }, startDate?: string, endDate?: string, _cdFilial?: string): Promise<any[]> {
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
            requestTimeout: 20000
        };

        let pool: sql.ConnectionPool;
        try {
            pool = await sql.connect(sqlConfig);
        } catch (connErr: any) {
            const msg = connErr?.message || '';
            const code = connErr?.code || '';
            if (code === 'ETIMEOUT' || code === 'ESOCKET' || code === 'ECONNREFUSED' || msg.includes('timeout') || msg.includes('Failed to connect') || msg.includes('getaddrinfo') || msg.includes('ENOTFOUND') || msg.includes('connect')) {
                throw new Error(`Não foi possível conectar ao banco de dados Solidcon (${server}:${port}). O servidor está fora do ar ou inacessível no momento.`);
            }
            if (msg.includes('Login failed') || code === 'ELOGIN') {
                throw new Error(`Falha de autenticação ao conectar no banco de dados Solidcon (${server}:${port}). Verifique usuário e senha no cadastro da empresa.`);
            }
            throw new Error(`Não foi possível conectar ao banco de dados Solidcon (${server}:${port}): ${msg || 'O servidor está fora do ar ou inacessível'}`);
        }

        try {
            const colsReq = pool.request();
            const colsRes = await colsReq.query(`
                SELECT TABLE_NAME, COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME IN ('tbCliente', 'tbCrediario', 'tbCrediarioCupom', 'tbPessoa', 'tbPessoaJuridica', 'tbPessoaFisica', 'tbEndereco', 'tbTelefone')
            `);
            const tableCols: Record<string, string[]> = {};
            for (const r of colsRes.recordset || []) {
                const t = String(r.TABLE_NAME || '').toLowerCase();
                const c = String(r.COLUMN_NAME || '');
                if (!tableCols[t]) tableCols[t] = [];
                tableCols[t].push(c);
            }

            const hasCol = (table: string, col: string) => {
                const cols = tableCols[table.toLowerCase()] || [];
                return cols.some(c => c.toLowerCase() === col.toLowerCase());
            };

            const request = pool.request();
            request.input('startDate', sql.VarChar, `${startDate} 00:00:00`);
            request.input('endDate', sql.VarChar, `${endDate} 23:59:59`);

            // Estratégia 1: Solidcon tbCrediario
            if (tableCols['tbcrediario']) {
                const query = `
                    SELECT DISTINCT
                        c.cdCrediario,
                        c.nome AS name,
                        c.nome AS trade_name,
                        ${hasCol('tbCrediario', 'nrCgcCpf') ? 'c.nrCgcCpf' : hasCol('tbCrediario', 'nrCpf') ? 'c.nrCpf' : hasCol('tbCrediario', 'nrCgc') ? 'c.nrCgc' : hasCol('tbCrediario', 'nrDocumento') ? 'c.nrDocumento' : 'NULL'} AS cnpj_cpf,
                        ${hasCol('tbCrediario', 'nrRgIe') ? 'c.nrRgIe' : hasCol('tbCrediario', 'nrInscricaoEstadual') ? 'c.nrInscricaoEstadual' : 'NULL'} AS inscricao_estadual,
                        c.Endereco AS logradouro,
                        c.Bairro AS bairro,
                        c.Cidade AS cidade,
                        c.CEP AS cep,
                        ${hasCol('tbCrediario', 'Celular') ? 'c.Celular' : hasCol('tbCrediario', 'Telefone') ? 'c.Telefone' : 'NULL'} AS telefone,
                        ${hasCol('tbCrediario', 'Email') ? 'c.Email' : 'NULL'} AS email
                    FROM tbCrediario c
                    WHERE c.nome IS NOT NULL AND RTRIM(LTRIM(c.nome)) != ''
                    ORDER BY c.nome ASC;
                `;
                const result = await request.query(query);
                if (result.recordset && result.recordset.length > 0) {
                    return result.recordset;
                }
            }

            // Estratégia 2: Solidcon relacional (tbPessoa + tbCliente + tbPessoaJuridica + tbPessoaFisica + tbEndereco + tbTelefone)
            if (tableCols['tbpessoa']) {
                const hasCliente = !!tableCols['tbcliente'];
                const hasPj = !!tableCols['tbpessoajuridica'];
                const hasPf = !!tableCols['tbpessoafisica'];
                const hasEnd = !!tableCols['tbendereco'];
                const hasTel = !!tableCols['tbtelefone'];

                let selects = `
                    p.cdPessoa AS cdCliente,
                    COALESCE(${hasPj ? 'pj.RazaoSocial, ' : ''}${hasPf ? 'pf.nmCompleto, ' : ''}p.nmPessoa) AS name,
                    p.nmPessoa AS trade_name,
                    ${hasPj ? 'pj.RazaoSocial' : 'NULL'} AS razao_social,
                    ${hasPj || hasPf ? `
                    CASE 
                        ${hasPj ? 'WHEN pj.cdPessoaJuridica IS NOT NULL THEN CONCAT(pj.CNPJEmpresa, pj.CNPJFilial, pj.CNPJDV)' : ''}
                        ${hasPf ? 'WHEN pf.cdPessoaFisica IS NOT NULL THEN CONCAT(pf.CPF, pf.CPFDV)' : ''}
                        ELSE NULL 
                    END` : 'NULL'} AS cnpj_cpf,
                    ${hasPj || hasPf ? `COALESCE(${hasPj ? 'pj.InscricaoEstadual' : 'NULL'}, ${hasPf ? 'pf.InscricaoEstadual' : 'NULL'})` : 'NULL'} AS inscricao_estadual,
                    ${hasPj ? 'pj.InscricaoMunicipal' : 'NULL'} AS inscricao_municipal,
                    ${hasEnd ? `
                    e.Logradouro AS logradouro,
                    e.Numero AS numero,
                    e.Complemento AS complemento,
                    e.Bairro AS bairro,
                    e.Cidade AS cidade,
                    e.cdEstado AS estado,
                    e.CEP AS cep,
                    e.cdMunicipio AS cdMunicipio,` : `
                    NULL AS logradouro,
                    NULL AS numero,
                    NULL AS complemento,
                    NULL AS bairro,
                    NULL AS cidade,
                    NULL AS estado,
                    NULL AS cep,
                    NULL AS cdMunicipio,`}
                    ${hasTel ? `
                    CASE 
                        WHEN t.Numero IS NOT NULL THEN CONCAT(COALESCE(t.DDD, ''), t.Numero)
                        ELSE NULL 
                    END` : 'NULL'} AS telefone
                `;

                let joins = '';
                if (hasCliente) joins += ' LEFT JOIN tbCliente cl ON cl.cdPessoa = p.cdPessoa ';
                if (hasPj) joins += ' LEFT JOIN tbPessoaJuridica pj ON pj.cdPessoaJuridica = p.cdPessoa ';
                if (hasPf) joins += ' LEFT JOIN tbPessoaFisica pf ON pf.cdPessoaFisica = p.cdPessoa ';
                if (hasEnd) joins += ' LEFT JOIN tbEndereco e ON e.cdPessoa = p.cdPessoa AND (e.cdEnderecoTipo = 1 OR e.cdEnderecoTipo IS NULL) ';
                if (hasTel) joins += ' LEFT JOIN tbTelefone t ON t.cdPessoa = p.cdPessoa AND (t.cdTelefone = 1 OR t.cdTelefone IS NULL) ';

                let whereConditions: string[] = [];
                if (hasCliente) whereConditions.push('cl.cdPessoa IS NOT NULL');
                if (hasCol('tbPessoa', 'inCliente')) whereConditions.push('p.inCliente = 1');

                const whereClause = whereConditions.length > 0 ? whereConditions.join(' OR ') : 'p.nmPessoa IS NOT NULL';

                const query = `
                    SELECT DISTINCT
                        ${selects}
                    FROM tbPessoa p
                    ${joins}
                    WHERE ${whereClause}
                    ORDER BY name ASC;
                `;

                const result = await request.query(query);
                if (result.recordset && result.recordset.length > 0) {
                    return result.recordset;
                }
            }

            // Estratégia 3: tbCliente isolado
            if (tableCols['tbcliente']) {
                const query = `
                    SELECT 
                        c.cdCliente,
                        c.Nome AS name,
                        c.Nome AS trade_name,
                        ${hasCol('tbCliente', 'nrCgcCpf') ? 'c.nrCgcCpf' : hasCol('tbCliente', 'nrCpf') ? 'c.nrCpf' : hasCol('tbCliente', 'nrCgc') ? 'c.nrCgc' : 'NULL'} AS cnpj_cpf,
                        ${hasCol('tbCliente', 'nrInscricaoEstadual') ? 'c.nrInscricaoEstadual' : hasCol('tbCliente', 'nrRgIe') ? 'c.nrRgIe' : 'NULL'} AS inscricao_estadual,
                        c.Endereco AS logradouro,
                        c.Bairro AS bairro,
                        c.Cidade AS cidade,
                        c.CEP AS cep,
                        ${hasCol('tbCliente', 'Celular') ? 'c.Celular' : hasCol('tbCliente', 'Telefone') ? 'c.Telefone' : 'NULL'} AS telefone
                    FROM tbCliente c
                    WHERE c.Nome IS NOT NULL
                    ORDER BY c.Nome ASC;
                `;
                const result = await request.query(query);
                if (result.recordset && result.recordset.length > 0) {
                    return result.recordset;
                }
            }

            return [];
        } catch (queryErr: any) {
            const msg = queryErr?.message || '';
            if (msg.includes('timeout') || msg.includes('closed') || msg.includes('Failed to connect') || msg.includes('Socket') || msg.includes('Connection')) {
                throw new Error(`Conexão perdida com o banco de dados Solidcon. O servidor está fora do ar ou instável.`);
            }
            throw queryErr;
        } finally {
            if (pool) {
                try {
                    await pool.close();
                } catch {
                    // ignore
                }
            }
        }
    }

    static async baixaCupomSolidcon(config: {
        host?: string | null;
        database?: string | null;
        user?: string | null;
        password?: string | null;
    }, cdCrediarioCupom: number | null, valor: number, bankAccountInfo?: {
        solidcon_bank_id?: string | null;
        name?: string;
        institution?: string | null;
        agency_number?: string | null;
        account_number?: string | null;
    }, fallbackInfo?: {
        nrCupom?: number | null;
        cdFilial?: string | null;
        cdPDV?: string | null;
    }, jurosInfo?: {
        totalFineInterest?: number;
        daysOverdue?: number;
        description?: string;
        customerName?: string;
        nrCupom?: number | string | null;
    }): Promise<{
        solidcon_interest_key?: string | null;
        solidcon_baixa_id?: string | null;
        cdCrediarioCupom?: string | null;
        cdBancoContaMovimento?: string | null;
    }> {
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

        const pool = new sql.ConnectionPool(sqlConfig);
        await pool.connect();
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();

            // 1. Fetch cupom data
            let cupom: any = null;
            const filialStr = fallbackInfo?.cdFilial ? String(fallbackInfo.cdFilial).trim() : null;
            const pdvStr = fallbackInfo?.cdPDV ? String(fallbackInfo.cdPDV).trim() : null;

            // Attempt 1: Search by cdCrediarioCupom if provided (with Filial & PDV verification)
            if (cdCrediarioCupom) {
                const reqCupom = new sql.Request(transaction);
                reqCupom.input('cdCrediarioCupom', sql.Int, cdCrediarioCupom);
                let filialFilter = '';
                let pdvFilter = '';
                if (filialStr) {
                    const filials = filialStr.split(',').map(f => parseInt(f.trim(), 10)).filter(f => !isNaN(f));
                    if (filials.length > 0) {
                        filialFilter = ` AND (TRY_CAST(cdFilial AS INT) IN (${filials.join(',')}) OR CAST(cdFilial AS VARCHAR) IN (${filials.map(f => `'${f}'`).join(',')}))`;
                    }
                }
                if (pdvStr) {
                    const pdvs = pdvStr.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
                    if (pdvs.length > 0) {
                        pdvFilter = ` AND (TRY_CAST(cdPDV AS INT) IN (${pdvs.join(',')}) OR CAST(cdPDV AS VARCHAR) IN (${pdvs.map(p => `'${p}'`).join(',')}))`;
                    }
                }
                const resCupom = await reqCupom.query(`
                    SELECT TOP 1 cdCrediarioCupom, cdFilial, cdPDV, cdCrediario, vlCrediario, nrCupom, vlQuitado, nrPagamentos 
                    FROM tbCrediarioCupom 
                    WHERE cdCrediarioCupom = @cdCrediarioCupom ${filialFilter} ${pdvFilter}
                `);
                if (resCupom.recordset?.[0]) {
                    cupom = resCupom.recordset[0];
                }

                // If not found with strict Filial/PDV on PK, try PK with filial only
                if (!cupom && filialFilter) {
                    const resCupomFilial = await reqCupom.query(`
                        SELECT TOP 1 cdCrediarioCupom, cdFilial, cdPDV, cdCrediario, vlCrediario, nrCupom, vlQuitado, nrPagamentos 
                        FROM tbCrediarioCupom 
                        WHERE cdCrediarioCupom = @cdCrediarioCupom ${filialFilter}
                    `);
                    if (resCupomFilial.recordset?.[0]) {
                        cupom = resCupomFilial.recordset[0];
                    }
                }

                // If not found with filial, try PK alone
                if (!cupom) {
                    const resCupomPk = await reqCupom.query(`
                        SELECT TOP 1 cdCrediarioCupom, cdFilial, cdPDV, cdCrediario, vlCrediario, nrCupom, vlQuitado, nrPagamentos 
                        FROM tbCrediarioCupom 
                        WHERE cdCrediarioCupom = @cdCrediarioCupom
                    `);
                    if (resCupomPk.recordset?.[0]) {
                        cupom = resCupomPk.recordset[0];
                    }
                }
            }

            // Attempt 2: Search by nrCupom (from fallbackInfo or cdCrediarioCupom as number)
            const searchCupomNum = fallbackInfo?.nrCupom || (!cupom && cdCrediarioCupom ? cdCrediarioCupom : null);
            if (!cupom && searchCupomNum) {
                const nrCupomNum = Number(searchCupomNum);
                const nrCupomStr = String(searchCupomNum).trim();
                const nrCupomPadded6 = nrCupomStr.padStart(6, '0');
                const nrCupomPadded8 = nrCupomStr.padStart(8, '0');
                const nrCupomPadded10 = nrCupomStr.padStart(10, '0');

                const reqFallback = new sql.Request(transaction);
                reqFallback.input('nrCupomStr', sql.VarChar, nrCupomStr);
                reqFallback.input('nrCupomPadded6', sql.VarChar, nrCupomPadded6);
                reqFallback.input('nrCupomPadded8', sql.VarChar, nrCupomPadded8);
                reqFallback.input('nrCupomPadded10', sql.VarChar, nrCupomPadded10);
                if (!isNaN(nrCupomNum)) {
                    reqFallback.input('nrCupomNum', sql.BigInt, nrCupomNum);
                }

                let baseCupomCondition = `(
                    nrCupom = @nrCupomStr 
                    OR nrCupom = @nrCupomPadded6 
                    OR nrCupom = @nrCupomPadded8 
                    OR nrCupom = @nrCupomPadded10
                    ${!isNaN(nrCupomNum) ? 'OR TRY_CAST(nrCupom AS BIGINT) = @nrCupomNum' : ''}
                    OR CAST(nrCupom AS VARCHAR) = @nrCupomStr
                )`;

                let filialClause = '';
                if (filialStr) {
                    const filials = filialStr.split(',').map(f => parseInt(f.trim(), 10)).filter(f => !isNaN(f));
                    if (filials.length > 0) {
                        filialClause = ` AND (TRY_CAST(cdFilial AS INT) IN (${filials.join(',')}) OR CAST(cdFilial AS VARCHAR) IN (${filials.map(f => `'${f}'`).join(',')}))`;
                    }
                }

                let pdvClause = '';
                if (pdvStr) {
                    const pdvs = pdvStr.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
                    if (pdvs.length > 0) {
                        pdvClause = ` AND (TRY_CAST(cdPDV AS INT) IN (${pdvs.join(',')}) OR CAST(cdPDV AS VARCHAR) IN (${pdvs.map(p => `'${p}'`).join(',')}))`;
                    }
                }

                // 2.1: Filial + PDV + nrCupom (busca exata)
                if (filialClause && pdvClause) {
                    const resStrict = await reqFallback.query(`
                        SELECT TOP 1 cdCrediarioCupom, cdFilial, cdPDV, cdCrediario, vlCrediario, nrCupom, vlQuitado, nrPagamentos 
                        FROM tbCrediarioCupom 
                        WHERE ${baseCupomCondition} ${filialClause} ${pdvClause}
                        ORDER BY cdCrediarioCupom DESC
                    `);
                    cupom = resStrict.recordset?.[0];
                }

                // 2.2: Apenas Filial + nrCupom (se PDV não foi informado ou não encontrado no PDV)
                if (!cupom && filialClause) {
                    const resFilial = await reqFallback.query(`
                        SELECT TOP 1 cdCrediarioCupom, cdFilial, cdPDV, cdCrediario, vlCrediario, nrCupom, vlQuitado, nrPagamentos 
                        FROM tbCrediarioCupom 
                        WHERE ${baseCupomCondition} ${filialClause}
                        ORDER BY cdCrediarioCupom DESC
                    `);
                    cupom = resFilial.recordset?.[0];
                }

                // 2.3: Fallback sem filial (apenas se filial não foi informada)
                if (!cupom && !filialClause) {
                    const resNoFilial = await reqFallback.query(`
                        SELECT TOP 1 cdCrediarioCupom, cdFilial, cdPDV, cdCrediario, vlCrediario, nrCupom, vlQuitado, nrPagamentos 
                        FROM tbCrediarioCupom 
                        WHERE ${baseCupomCondition}
                        ORDER BY cdCrediarioCupom DESC
                    `);
                    cupom = resNoFilial.recordset?.[0];
                }
            }

            if (!cupom) {
                const searchStr = cdCrediarioCupom 
                    ? `cdCrediarioCupom = ${cdCrediarioCupom}` 
                    : `nrCupom = ${fallbackInfo?.nrCupom || searchCupomNum} (Filial: ${filialStr || 'N/A'}, PDV: ${pdvStr || 'N/A'})`;
                throw new Error(`Cupom não encontrado na tabela tbCrediarioCupom da Solidcon (${searchStr}).`);
            }

            const cdCrediarioCupomResolved = cupom?.cdCrediarioCupom;
            const rawFilial = cupom?.cdFilial || fallbackInfo?.cdFilial || '1';
            const cdFilial = parseInt(String(rawFilial).split(',')[0] ?? '1', 10) || 1;
            const cdCrediario = cupom?.cdCrediario;
            const vlCrediario = cupom?.vlCrediario || valor;
            const today = new Date();

            // 2. Resolve cdBancoConta
            let cdBancoConta = bankAccountInfo?.solidcon_bank_id;
            if (!cdBancoConta) {
                const reqBank = new sql.Request(transaction);
                reqBank.input('accountNum', sql.VarChar, bankAccountInfo?.account_number || '');
                reqBank.input('bankName', sql.VarChar, bankAccountInfo?.name ? '%' + bankAccountInfo.name + '%' : '');
                reqBank.input('institution', sql.VarChar, bankAccountInfo?.institution ? '%' + bankAccountInfo.institution + '%' : '');
                const resBank = await reqBank.query(`
                    SELECT TOP 1 cdBancoConta FROM tbBancoConta 
                    WHERE (@bankName <> '' AND nmConta LIKE @bankName) 
                       OR (@institution <> '' AND nmConta LIKE @institution)
                       OR (@accountNum <> '' AND (CAST(ContaNumero AS VARCHAR) = @accountNum OR CAST(ContaNumero AS VARCHAR) LIKE '%' + @accountNum))
                    ORDER BY cdBancoConta ASC
                `);
                if (resBank.recordset?.[0]?.cdBancoConta) {
                    cdBancoConta = resBank.recordset[0].cdBancoConta;
                } else {
                    const reqFirstBank = new sql.Request(transaction);
                    const resFirstBank = await reqFirstBank.query(`SELECT TOP 1 cdBancoConta FROM tbBancoConta ORDER BY cdBancoConta ASC`);
                    cdBancoConta = resFirstBank.recordset?.[0]?.cdBancoConta || '1';
                }
            }

            // 3. Insert into tbBancoContaMovimento with trigger-safe identity
            const reqMov = new sql.Request(transaction);
            reqMov.input('dtLancamento', sql.DateTime, today);
            reqMov.input('vlDebito', sql.Money, vlCrediario);
            reqMov.input('Numero', sql.VarChar, String(cdCrediario || ''));
            reqMov.input('Historico', sql.VarChar, `Dep. de Cred. ${cdCrediario || ''}`);
            reqMov.input('cdBancoConta', sql.VarChar, String(cdBancoConta));
            reqMov.input('cdPessoaFilialBancoConta', sql.Int, cdFilial);

            const resMov = await reqMov.query(`
                INSERT INTO tbBancoContaMovimento (
                    dtLancamento, vlDebito, vlCredito, Numero, Historico, vlSaldo, nrProcessado, inPendencia,
                    cdBancoContaMovimentoTipo, cdBancoConta, cdPessoaFilialBancoConta, cdBancoContaExtrato, inCancelado, cdUsuarioMovimento
                ) VALUES (
                    @dtLancamento, @vlDebito, 0, @Numero, @Historico, 0, NULL, NULL,
                    '3', @cdBancoConta, @cdPessoaFilialBancoConta, NULL, NULL, '1'
                );
                DECLARE @NewMovId INT;
                SET @NewMovId = SCOPE_IDENTITY();
                IF @NewMovId IS NULL OR @NewMovId = 0
                    SET @NewMovId = @@IDENTITY;
                IF @NewMovId IS NULL OR @NewMovId = 0
                    SELECT TOP 1 @NewMovId = cdBancoContaMovimento FROM tbBancoContaMovimento ORDER BY cdBancoContaMovimento DESC;
                SELECT @NewMovId AS insertId;
            `);
            const xidcontamov = resMov.recordset?.[0]?.insertId;

            // 4. Insert into tbCrediarioDeposito with trigger-safe identity
            const reqDep = new sql.Request(transaction);
            reqDep.input('cdFilial', sql.Int, cdFilial);
            reqDep.input('cdBancoConta', sql.VarChar, String(cdBancoConta));
            reqDep.input('cdBancoContaMovimento', sql.Int, xidcontamov);
            reqDep.input('vlQuitado', sql.Money, vlCrediario);
            reqDep.input('dtDeposito', sql.DateTime, today);
            const qtCredVal = (cupom.nrPagamentos !== undefined && cupom.nrPagamentos !== null && !isNaN(Number(cupom.nrPagamentos))) 
                ? Number(cupom.nrPagamentos) 
                : 1;
            reqDep.input('qtCrediario', sql.Int, qtCredVal);

            const resDep = await reqDep.query(`
                INSERT INTO tbCrediarioDeposito (
                    cdPessoaFilialDeposito, cdPessoaFilialBancoConta, cdBancoConta, cdBancoContaMovimento,
                    cdBancoContaMovimentoTipo, vlQuitado, vlPago, qtCrediario, dtDeposito
                ) VALUES (
                    @cdFilial, @cdFilial, @cdBancoConta, @cdBancoContaMovimento,
                    '3', @vlQuitado, @vlQuitado, @qtCrediario, @dtDeposito
                );
                DECLARE @NewDepId INT;
                SET @NewDepId = SCOPE_IDENTITY();
                IF @NewDepId IS NULL OR @NewDepId = 0
                    SET @NewDepId = @@IDENTITY;
                IF @NewDepId IS NULL OR @NewDepId = 0
                    SELECT TOP 1 @NewDepId = cdCrediarioDeposito FROM tbCrediarioDeposito ORDER BY cdCrediarioDeposito DESC;
                SELECT @NewDepId AS insertId;
            `);
            const xiddeposito = resDep.recordset?.[0]?.insertId;

            // 5. Upsert tbCrediarioCupomPagamento
            const reqCheck = new sql.Request(transaction);
            reqCheck.input('cdCrediarioCupom', sql.Int, cdCrediarioCupomResolved);
            const resCheck = await reqCheck.query(`
                SELECT cdCrediarioCupom FROM tbCrediarioCupomPagamento 
                WHERE cdCrediarioCupom = @cdCrediarioCupom
            `);

            const reqPag = new sql.Request(transaction);
            reqPag.input('cdCrediarioCupom', sql.Int, cdCrediarioCupomResolved);
            reqPag.input('cdFilial', sql.Int, cdFilial);
            reqPag.input('vlPago', sql.Money, vlCrediario);
            reqPag.input('dtPago', sql.DateTime, today);
            reqPag.input('cdCrediarioDeposito', sql.Int, xiddeposito);

            if (resCheck.recordset?.[0]) {
                await reqPag.query(`
                    UPDATE tbCrediarioCupomPagamento SET 
                        vlQuitado = @vlPago,
                        vlPago = @vlPago,
                        vlDesconto = 0,
                        dtPago = @dtPago,
                        cdUsuarioQuitou = '1',
                        Obs = 'Baixa Web',
                        cdPessoaFilialDeposito = @cdFilial,
                        cdCrediarioDeposito = @cdCrediarioDeposito
                    WHERE cdCrediarioCupom = @cdCrediarioCupom
                `);
            } else {
                await reqPag.query(`
                    INSERT INTO tbCrediarioCupomPagamento (
                        cdFilial, cdCrediarioCupom, nrParcela, nrPagamento, vlQuitado, vlPago, vlDesconto, dtPago, cdUsuarioQuitou, Obs, cdPessoaFilialDeposito, cdCrediarioDeposito
                    ) VALUES (
                        @cdFilial, @cdCrediarioCupom, 0, 1, @vlPago, @vlPago, 0, @dtPago, '1', 'Baixa Web', @cdFilial, @cdCrediarioDeposito
                    )
                `);
            }

            // 6. Update tbCrediarioCupom
            const reqUpdateCupom = new sql.Request(transaction);
            reqUpdateCupom.input('cdCrediarioCupom', sql.Int, cdCrediarioCupomResolved);
            reqUpdateCupom.input('vlQuitado', sql.Money, vlCrediario);
            await reqUpdateCupom.query(`
                UPDATE tbCrediarioCupom 
                SET vlQuitado = @vlQuitado, nrPagamentos = 1, Obs = 'Baixa Nuvem' 
                WHERE cdCrediarioCupom = @cdCrediarioCupom
            `);

            // 6.1 Insert into tbConta, tbContaBaixa, and tbContaParcela for principal receipt (for Bank Reconciliation)
            let cdContaPrincipal: any = null;
            if (xidcontamov) {
                const movIdNum = parseInt(String(xidcontamov), 10);
                const cupomNumStr = String(cupom?.nrCupom || searchCupomNum || cdCrediario || '').trim();
                const histPrincipalReceb = `Recebimento Crediario Cupom #${cupom.nrCupom || cdCrediarioCupomResolved}`.substring(0, 80);

                // 1. tbConta
                let cdEmpresaResolved = 10;
                let cdPessoaComercialResolved = 1;
                const resPessCheck = await transaction.request()
                    .input('empHint', sql.Int, cupom?.cdEmpresa || 10)
                    .query(`
                        SELECT TOP 1 cdEmpresa, cdPessoaComercial 
                        FROM tbPessoaComercial 
                        ORDER BY CASE WHEN cdEmpresa = @empHint AND cdPessoaComercial = 1 THEN 0
                                      WHEN cdPessoaComercial = 1 THEN 1 
                                      ELSE 2 END, cdEmpresa ASC
                    `);
                if (resPessCheck.recordset?.[0]) {
                    cdEmpresaResolved = resPessCheck.recordset[0].cdEmpresa;
                    cdPessoaComercialResolved = resPessCheck.recordset[0].cdPessoaComercial;
                }

                const reqContaP = new sql.Request(transaction);
                reqContaP.input('cdFilial', sql.Int, cdFilial);
                reqContaP.input('cdEmpresa', sql.TinyInt, cdEmpresaResolved);
                reqContaP.input('cdPessoaComercial', sql.Int, cdPessoaComercialResolved);
                reqContaP.input('Documento', sql.VarChar, String(cupomNumStr || '').substring(0, 12));
                reqContaP.input('dtInclusao', sql.DateTime, today);

                const resContaP = await reqContaP.query(`
                    INSERT INTO tbConta (
                        cdPessoaFilialConta, cdEmpresa, cdPessoaComercial, cdContaTipo, Documento, cdPagamentoTipo, dtInclusao, inNaoInformaNoReinf, XmlNFSe
                    ) VALUES (
                        @cdFilial, @cdEmpresa, @cdPessoaComercial, 4, @Documento, 0, @dtInclusao, NULL, NULL
                    );
                    SELECT SCOPE_IDENTITY() AS insertId;
                `);
                cdContaPrincipal = resContaP.recordset?.[0]?.insertId;
                if (!cdContaPrincipal) {
                    const resF = await transaction.request().query('SELECT TOP 1 cdConta FROM tbConta ORDER BY cdConta DESC');
                    cdContaPrincipal = resF.recordset?.[0]?.cdConta;
                }

                // 2. tbContaBaixa
                const reqBaixaP = new sql.Request(transaction);
                reqBaixaP.input('cdFilial', sql.Int, cdFilial);
                reqBaixaP.input('cdBancoConta', sql.Int, parseInt(String(cdBancoConta), 10) || 1);
                reqBaixaP.input('cdBancoContaMovimento', sql.Int, movIdNum);
                reqBaixaP.input('dtContaBaixa', sql.DateTime, today);
                reqBaixaP.input('vlContaBaixa', sql.Money, vlCrediario);
                reqBaixaP.input('Documento', sql.VarChar, String(cupomNumStr || '').substring(0, 10));
                reqBaixaP.input('Historico', sql.VarChar, histPrincipalReceb);

                const resBaixaP = await reqBaixaP.query(`
                    INSERT INTO tbContaBaixa (
                        cdPessoaFilialContaBaixa, cdPessoaFilialBancoConta, cdBancoConta, cdBancoContaMovimento,
                        dtContaBaixa, vlContaBaixa, Documento, inRecebimento, Historico, cdPagamentoTipo, inAvista
                    ) VALUES (
                        @cdFilial, @cdFilial, @cdBancoConta, @cdBancoContaMovimento,
                        @dtContaBaixa, @vlContaBaixa, @Documento, 1, @Historico, 0, 1
                    );
                    SELECT SCOPE_IDENTITY() AS insertId;
                `);
                let cdContaBaixaP = resBaixaP.recordset?.[0]?.insertId;
                if (!cdContaBaixaP) {
                    const resF = await transaction.request().query('SELECT TOP 1 cdContaBaixa FROM tbContaBaixa ORDER BY cdContaBaixa DESC');
                    cdContaBaixaP = resF.recordset?.[0]?.cdContaBaixa;
                }

                // 3. tbContaParcela
                if (cdContaPrincipal && cdContaBaixaP) {
                    const reqParcelaP = new sql.Request(transaction);
                    reqParcelaP.input('cdFilial', sql.Int, cdFilial);
                    reqParcelaP.input('cdConta', sql.Int, cdContaPrincipal);
                    reqParcelaP.input('cdContaBaixa', sql.Int, cdContaBaixaP);
                    reqParcelaP.input('dtParcela', sql.DateTime, today);
                    reqParcelaP.input('vlParcela', sql.Money, vlCrediario);
                    reqParcelaP.input('Historico', sql.VarChar, histPrincipalReceb);
                    reqParcelaP.input('cdBancoContaMovimento', sql.Int, movIdNum);

                    await reqParcelaP.query(`
                        INSERT INTO tbContaParcela (
                            cdPessoaFilialConta, cdConta, cdContaParcela, cdPessoaFilialContaBaixa, cdContaBaixa,
                            cdIndice, dtParcela, vlParcela, vlMulta, vlMora, vlDesconto, inBoleto, Historico,
                            dtCompetencia, cdBancoContaMovimento, CNPJFactoring, vlTarifaBoletoBanco,
                            dtParcelaOriginal, vlParcelaOriginal, inEnviadoIntegrador
                        ) VALUES (
                            @cdFilial, @cdConta, '1 ', @cdFilial, @cdContaBaixa,
                            NULL, @dtParcela, @vlParcela, 0, 0, 0, 0, @Historico,
                            @dtParcela, @cdBancoContaMovimento, '', 0,
                            @dtParcela, @vlParcela, 0
                        );
                    `);
                }
            }

            // 7. Insert interest into tbBancoContaMovimento directly in Solidcon if applicable
            let intMovId: string | null = null;
            let cdConta: any = null;
            if (jurosInfo && jurosInfo.totalFineInterest && jurosInfo.totalFineInterest > 0) {
                const cupomNumberResolved = jurosInfo.nrCupom || cupom?.nrCupom || fallbackInfo?.nrCupom || '';
                const cupomNumStr = String(cupomNumberResolved).trim();
                const reqCheckInt = new sql.Request(transaction);
                reqCheckInt.input('cupomNumStr', sql.VarChar, cupomNumStr);
                reqCheckInt.input('histPattern', sql.VarChar, `%Cupom #${cupomNumStr}%`);
                const resCheckInt = await reqCheckInt.query(`
                    SELECT TOP 1 cdBancoContaMovimento FROM tbBancoContaMovimento 
                    WHERE (Historico LIKE '%Juros de conv%' OR Historico LIKE '%Juros de convênio%' OR Historico LIKE '%Juros de convenio%')
                      AND (@cupomNumStr <> '' AND Historico LIKE @histPattern)
                `);

                if (!resCheckInt.recordset?.[0]) {
                    const daysText = `${jurosInfo.daysOverdue || 1} ${jurosInfo.daysOverdue === 1 ? 'dia' : 'dias'}`;
                    const custName = jurosInfo.customerName ? ` - ${jurosInfo.customerName}` : '';
                    const histDesc = jurosInfo.description || `Juros de convênio pago em atraso (${daysText}) - Ref: Cupom #${cupomNumStr}${custName}`;

                    const reqIntMov = new sql.Request(transaction);
                    reqIntMov.input('dtLancamento', sql.DateTime, today);
                    reqIntMov.input('vlDebito', sql.Money, jurosInfo.totalFineInterest);
                    reqIntMov.input('Numero', sql.VarChar, String(cupomNumStr || cdCrediario || '').substring(0, 20));
                    reqIntMov.input('Historico', sql.VarChar, histDesc.substring(0, 200));
                    reqIntMov.input('cdBancoConta', sql.VarChar, String(cdBancoConta));
                    reqIntMov.input('cdPessoaFilialBancoConta', sql.Int, cdFilial);

                    const resMov = await reqIntMov.query(`
                        INSERT INTO tbBancoContaMovimento (
                            dtLancamento, vlDebito, vlCredito, Numero, Historico, vlSaldo, nrProcessado, inPendencia,
                            cdBancoContaMovimentoTipo, cdBancoConta, cdPessoaFilialBancoConta, cdBancoContaExtrato, inCancelado, cdUsuarioMovimento
                        ) VALUES (
                            @dtLancamento, @vlDebito, NULL, @Numero, @Historico, 0, NULL, NULL,
                            '3', @cdBancoConta, @cdPessoaFilialBancoConta, NULL, NULL, '1'
                        );
                        SELECT SCOPE_IDENTITY() AS insertId;
                    `);
                    intMovId = resMov.recordset?.[0]?.insertId ? String(resMov.recordset[0].insertId) : null;
                    if (!intMovId) {
                        const resFallback = await transaction.request().query('SELECT TOP 1 cdBancoContaMovimento FROM tbBancoContaMovimento ORDER BY cdBancoContaMovimento DESC');
                        intMovId = resFallback.recordset?.[0]?.cdBancoContaMovimento ? String(resFallback.recordset[0].cdBancoContaMovimento) : null;
                    }

                    // Insert into tbConta, tbContaBaixa, and tbContaParcela
                    if (intMovId) {
                        const intMovIdNum = parseInt(intMovId, 10);
                        let cdEmpresaInt = 10;
                        let cdPessoaComercialInt = 1;
                        const resPessCheckInt = await transaction.request()
                            .input('empHint', sql.Int, cupom?.cdEmpresa || 10)
                            .query(`
                                SELECT TOP 1 cdEmpresa, cdPessoaComercial 
                                FROM tbPessoaComercial 
                                ORDER BY CASE WHEN cdEmpresa = @empHint AND cdPessoaComercial = 1 THEN 0
                                              WHEN cdPessoaComercial = 1 THEN 1 
                                              ELSE 2 END, cdEmpresa ASC
                            `);
                        if (resPessCheckInt.recordset?.[0]) {
                            cdEmpresaInt = resPessCheckInt.recordset[0].cdEmpresa;
                            cdPessoaComercialInt = resPessCheckInt.recordset[0].cdPessoaComercial;
                        }

                        // 1. tbConta
                        const reqConta = new sql.Request(transaction);
                        reqConta.input('cdFilial', sql.Int, cdFilial);
                        reqConta.input('cdEmpresa', sql.TinyInt, cdEmpresaInt);
                        reqConta.input('cdPessoaComercial', sql.Int, cdPessoaComercialInt);
                        reqConta.input('Documento', sql.VarChar, String(cupomNumStr || '').substring(0, 12));
                        reqConta.input('dtInclusao', sql.DateTime, today);

                        const resConta = await reqConta.query(`
                            INSERT INTO tbConta (
                                cdPessoaFilialConta, cdEmpresa, cdPessoaComercial, cdContaTipo, Documento, cdPagamentoTipo, dtInclusao, inNaoInformaNoReinf, XmlNFSe
                            ) VALUES (
                                @cdFilial, @cdEmpresa, @cdPessoaComercial, 4, @Documento, 0, @dtInclusao, NULL, NULL
                            );
                            SELECT SCOPE_IDENTITY() AS insertId;
                        `);
                        cdConta = resConta.recordset?.[0]?.insertId;
                        if (!cdConta) {
                            const resF = await transaction.request().query('SELECT TOP 1 cdConta FROM tbConta ORDER BY cdConta DESC');
                            cdConta = resF.recordset?.[0]?.cdConta;
                        }

                        // 2. tbContaBaixa
                        const reqBaixa = new sql.Request(transaction);
                        reqBaixa.input('cdFilial', sql.Int, cdFilial);
                        reqBaixa.input('cdBancoConta', sql.Int, parseInt(String(cdBancoConta), 10) || 1);
                        reqBaixa.input('cdBancoContaMovimento', sql.Int, intMovIdNum);
                        reqBaixa.input('dtContaBaixa', sql.DateTime, today);
                        reqBaixa.input('vlContaBaixa', sql.Money, jurosInfo.totalFineInterest);
                        reqBaixa.input('Documento', sql.VarChar, String(cupomNumStr || '').substring(0, 10));
                        reqBaixa.input('Historico', sql.VarChar, histDesc.substring(0, 80));

                        const resBaixa = await reqBaixa.query(`
                            INSERT INTO tbContaBaixa (
                                cdPessoaFilialContaBaixa, cdPessoaFilialBancoConta, cdBancoConta, cdBancoContaMovimento,
                                dtContaBaixa, vlContaBaixa, Documento, inRecebimento, Historico, cdPagamentoTipo, inAvista
                            ) VALUES (
                                @cdFilial, @cdFilial, @cdBancoConta, @cdBancoContaMovimento,
                                @dtContaBaixa, @vlContaBaixa, @Documento, 1, @Historico, 0, 1
                            );
                            SELECT SCOPE_IDENTITY() AS insertId;
                        `);
                        let cdContaBaixa = resBaixa.recordset?.[0]?.insertId;
                        if (!cdContaBaixa) {
                            const resF = await transaction.request().query('SELECT TOP 1 cdContaBaixa FROM tbContaBaixa ORDER BY cdContaBaixa DESC');
                            cdContaBaixa = resF.recordset?.[0]?.cdContaBaixa;
                        }

                        // 3. tbContaParcela
                        if (cdConta && cdContaBaixa) {
                            const reqParcela = new sql.Request(transaction);
                            reqParcela.input('cdFilial', sql.Int, cdFilial);
                            reqParcela.input('cdConta', sql.Int, cdConta);
                            reqParcela.input('cdContaBaixa', sql.Int, cdContaBaixa);
                            reqParcela.input('dtParcela', sql.DateTime, today);
                            reqParcela.input('vlParcela', sql.Money, jurosInfo.totalFineInterest);
                            reqParcela.input('Historico', sql.VarChar, histDesc.substring(0, 80));
                            reqParcela.input('cdBancoContaMovimento', sql.Int, intMovIdNum);

                            await reqParcela.query(`
                                INSERT INTO tbContaParcela (
                                    cdPessoaFilialConta, cdConta, cdContaParcela, cdPessoaFilialContaBaixa, cdContaBaixa,
                                    cdIndice, dtParcela, vlParcela, vlMulta, vlMora, vlDesconto, inBoleto, Historico,
                                    dtCompetencia, cdBancoContaMovimento, CNPJFactoring, vlTarifaBoletoBanco,
                                    dtParcelaOriginal, vlParcelaOriginal, inEnviadoIntegrador
                                ) VALUES (
                                    @cdFilial, @cdConta, '1 ', @cdFilial, @cdContaBaixa,
                                    NULL, @dtParcela, @vlParcela, 0, 0, 0, 0, @Historico,
                                    @dtParcela, @cdBancoContaMovimento, '', 0,
                                    @dtParcela, @vlParcela, 0
                                );
                            `);
                        }
                    }
                } else {
                    intMovId = resCheckInt.recordset?.[0]?.cdBancoContaMovimento ? String(resCheckInt.recordset[0].cdBancoContaMovimento) : null;
                    if (intMovId) {
                        const reqFindConta = new sql.Request(transaction);
                        reqFindConta.input('intMovIdNum', sql.Int, parseInt(intMovId, 10));
                        reqFindConta.input('cupomNumStr', sql.VarChar, cupomNumStr);
                        const resFindConta = await reqFindConta.query(`
                            SELECT TOP 1 c.cdConta FROM tbConta c
                            LEFT JOIN tbContaParcela cp ON cp.cdConta = c.cdConta
                            WHERE cp.cdBancoContaMovimento = @intMovIdNum OR c.Documento = @cupomNumStr
                            ORDER BY c.cdConta DESC
                        `);
                        if (resFindConta.recordset?.[0]?.cdConta) {
                            cdConta = resFindConta.recordset[0].cdConta;
                        }
                    }
                }
            }

            await transaction.commit();
            const revenueCode = cdConta ? String(cdConta) : intMovId;
            return {
                solidcon_interest_key: revenueCode,
                solidcon_baixa_id: xiddeposito ? String(xiddeposito) : null,
                cdCrediarioCupom: cdCrediarioCupomResolved ? String(cdCrediarioCupomResolved) : null,
                cdBancoContaMovimento: xidcontamov ? String(xidcontamov) : null
            };
        } catch (err: any) {
            await transaction.rollback();
            const msg = err?.message || '';
            if (msg.includes('Invalid object name')) {
                const matchObj = msg.match(/Invalid object name '([^']+)'/i);
                const objName = matchObj ? matchObj[1] : 'tabela';
                throw new Error(`A tabela '${objName}' não existe no banco de dados '${config.database || 'padrão'}' (${server}). Verifique se o nome do Banco de Dados Solidcon (bd_solidcon) no cadastro da empresa está correto.`);
            }
            throw err;
        } finally {
            await pool.close();
        }
    }

    static async removerBaixaCupomSolidcon(config: {
        host?: string | null | undefined;
        database?: string | null | undefined;
        user?: string | null | undefined;
        password?: string | null | undefined;
        pool?: sql.ConnectionPool | undefined;
    }, cdCrediarioCupom: number, options?: {
        onlyKeystoneBaixas?: boolean | undefined;
        nrCupom?: string | number | null | undefined;
        cdFilial?: string | number | null | undefined;
        cdPDV?: string | number | null | undefined;
        interestKey?: string | number | null | undefined;
    }): Promise<{
        deletedPayments: number;
        remainingPayments: number;
        vlQuitado: number;
        removedDepIds: number[];
        removedMovIds: number[];
    }> {
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

        let pool = config.pool;
        let shouldClosePool = false;

        if (!pool) {
            const sqlConfig: sql.config = {
                user: config.user || '',
                password: config.password || '',
                database: config.database || '',
                server: server,
                port: port,
                options: {
                    encrypt: false,
                    trustServerCertificate: true
                },
                connectionTimeout: 10000,
                requestTimeout: 15000
            };
            pool = new sql.ConnectionPool(sqlConfig);
            await pool.connect();
            shouldClosePool = true;
        }

        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();

            const onlyKeystone = options?.onlyKeystoneBaixas !== false;

            // 1. Fetch cupom data
            let cupom: any = null;
            if (cdCrediarioCupom && cdCrediarioCupom > 0) {
                const reqCupom = new sql.Request(transaction);
                reqCupom.input('cdCrediarioCupom', sql.Int, cdCrediarioCupom);
                const resCupom = await reqCupom.query(`
                    SELECT TOP 1 cdCrediarioCupom, nrCupom, vlCrediario, vlQuitado, nrPagamentos, Obs, cdFilial, cdPDV
                    FROM tbCrediarioCupom WHERE cdCrediarioCupom = @cdCrediarioCupom
                `);
                cupom = resCupom.recordset?.[0];
            } else if (options?.nrCupom) {
                const nrCupomNum = Number(options.nrCupom);
                const nrCupomStr = String(options.nrCupom).trim();
                const filialStr = options.cdFilial ? String(options.cdFilial).trim() : null;
                const pdvStr = options.cdPDV ? String(options.cdPDV).trim() : null;

                const reqCupom = new sql.Request(transaction);
                reqCupom.input('nrCupomStr', sql.VarChar, nrCupomStr);
                if (!isNaN(nrCupomNum)) {
                    reqCupom.input('nrCupomNum', sql.BigInt, nrCupomNum);
                }

                let filialClause = '';
                if (filialStr) {
                    const filials = filialStr.split(',').map(f => parseInt(f.trim(), 10)).filter(f => !isNaN(f));
                    if (filials.length > 0) {
                        filialClause = ` AND (TRY_CAST(cdFilial AS INT) IN (${filials.join(',')}) OR CAST(cdFilial AS VARCHAR) IN (${filials.map(f => `'${f}'`).join(',')}))`;
                    }
                }
                let pdvClause = '';
                if (pdvStr) {
                    const pdvs = pdvStr.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
                    if (pdvs.length > 0) {
                        pdvClause = ` AND (TRY_CAST(cdPDV AS INT) IN (${pdvs.join(',')}) OR CAST(cdPDV AS VARCHAR) IN (${pdvs.map(p => `'${p}'`).join(',')}))`;
                    }
                }

                let baseCondition = `(nrCupom = @nrCupomStr ${!isNaN(nrCupomNum) ? 'OR TRY_CAST(nrCupom AS BIGINT) = @nrCupomNum' : ''} OR CAST(nrCupom AS VARCHAR) = @nrCupomStr)`;
                if (filialClause && pdvClause) {
                    const res = await reqCupom.query(`SELECT TOP 1 cdCrediarioCupom, nrCupom, vlCrediario, vlQuitado, nrPagamentos, Obs, cdFilial, cdPDV FROM tbCrediarioCupom WHERE ${baseCondition} ${filialClause} ${pdvClause} ORDER BY cdCrediarioCupom DESC`);
                    cupom = res.recordset?.[0];
                }
                if (!cupom && filialClause) {
                    const res = await reqCupom.query(`SELECT TOP 1 cdCrediarioCupom, nrCupom, vlCrediario, vlQuitado, nrPagamentos, Obs, cdFilial, cdPDV FROM tbCrediarioCupom WHERE ${baseCondition} ${filialClause} ORDER BY cdCrediarioCupom DESC`);
                    cupom = res.recordset?.[0];
                }
                if (!cupom && !filialClause) {
                    const res = await reqCupom.query(`SELECT TOP 1 cdCrediarioCupom, nrCupom, vlCrediario, vlQuitado, nrPagamentos, Obs, cdFilial, cdPDV FROM tbCrediarioCupom WHERE ${baseCondition} ORDER BY cdCrediarioCupom DESC`);
                    cupom = res.recordset?.[0];
                }
                if (cupom?.cdCrediarioCupom) {
                    cdCrediarioCupom = cupom.cdCrediarioCupom;
                }
            }
            const nrCupomResolved = options?.nrCupom || cupom?.nrCupom;

            // 2. Fetch payments to delete
            const reqPags = new sql.Request(transaction);
            reqPags.input('cdCrediarioCupom', sql.Int, cdCrediarioCupom);
            const resPags = await reqPags.query(`
                SELECT p.cdFilial, p.cdCrediarioCupom, p.nrParcela, p.nrPagamento, p.vlPago, p.dtPago, p.Obs, p.cdCrediarioDeposito,
                       d.cdBancoContaMovimento, d.cdBancoConta
                FROM tbCrediarioCupomPagamento p
                LEFT JOIN tbCrediarioDeposito d ON d.cdCrediarioDeposito = p.cdCrediarioDeposito
                WHERE p.cdCrediarioCupom = @cdCrediarioCupom
            `);

            const allPayments: any[] = resPags.recordset || [];
            let paymentsToDelete: any[] = allPayments;

            if (onlyKeystone) {
                // Filtra pagamentos gerados pelo Keystone (Obs 'Baixa Web', 'Baixa Nuvem' ou usuário 1)
                paymentsToDelete = allPayments.filter((p: any) => 
                    String(p.Obs || '').includes('Baixa Web') || 
                    String(p.Obs || '').includes('Baixa Nuvem') || 
                    String(p.cdUsuarioQuitou) === '1'
                );
            }

            const removedDepIds: number[] = [];
            const removedMovIds: number[] = [];

            for (const pag of paymentsToDelete) {
                // Delete from tbCrediarioCupomPagamento
                const reqDelPag = new sql.Request(transaction);
                reqDelPag.input('cdCrediarioCupom', sql.Int, cdCrediarioCupom);
                reqDelPag.input('depId', sql.Int, pag.cdCrediarioDeposito || 0);
                reqDelPag.input('nrPagamento', sql.Int, pag.nrPagamento || 0);
                await reqDelPag.query(`
                    DELETE FROM tbCrediarioCupomPagamento 
                    WHERE cdCrediarioCupom = @cdCrediarioCupom 
                      AND (cdCrediarioDeposito = @depId OR nrPagamento = @nrPagamento)
                `);

                // Delete from tbCrediarioDeposito
                if (pag.cdCrediarioDeposito) {
                    removedDepIds.push(pag.cdCrediarioDeposito);
                    const reqDelDep = new sql.Request(transaction);
                    reqDelDep.input('depId', sql.Int, pag.cdCrediarioDeposito);
                    await reqDelDep.query(`DELETE FROM tbCrediarioDeposito WHERE cdCrediarioDeposito = @depId`);
                }

                // Delete from tbBancoContaMovimento (with full FK unbind / cascade)
                if (pag.cdBancoContaMovimento) {
                    removedMovIds.push(pag.cdBancoContaMovimento);
                    const reqDelMov = new sql.Request(transaction);
                    reqDelMov.input('movId', sql.Int, pag.cdBancoContaMovimento);
                    await reqDelMov.query(`
                        IF OBJECT_ID('dbo.tbContaParcela', 'U') IS NOT NULL
                        BEGIN
                            UPDATE tbContaParcela SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;
                            DELETE FROM tbContaParcela WHERE cdContaBaixa IN (SELECT cdContaBaixa FROM tbContaBaixa WHERE cdBancoContaMovimento = @movId);
                        END

                        IF OBJECT_ID('dbo.tbContaBaixaConta', 'U') IS NOT NULL
                            DELETE FROM tbContaBaixaConta WHERE cdContaBaixa IN (SELECT cdContaBaixa FROM tbContaBaixa WHERE cdBancoContaMovimento = @movId);

                        IF OBJECT_ID('dbo.tbContaBaixa', 'U') IS NOT NULL
                        BEGIN
                            UPDATE tbContaBaixa SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;
                            DELETE FROM tbContaBaixa WHERE cdBancoContaMovimento = @movId;
                        END

                        IF OBJECT_ID('dbo.tbCrediarioDeposito', 'U') IS NOT NULL
                        BEGIN
                            UPDATE tbCrediarioDeposito SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;
                            DELETE FROM tbCrediarioDeposito WHERE cdBancoContaMovimento = @movId;
                        END

                        IF OBJECT_ID('dbo.tbValeCompra', 'U') IS NOT NULL
                        BEGIN
                            UPDATE tbValeCompra SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;
                            DELETE FROM tbValeCompra WHERE cdBancoContaMovimento = @movId;
                        END

                        IF OBJECT_ID('dbo.tbReceDespMovimento', 'U') IS NOT NULL
                            UPDATE tbReceDespMovimento SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;

                        IF OBJECT_ID('dbo.tbChequeMovimento', 'U') IS NOT NULL
                            UPDATE tbChequeMovimento SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;

                        IF OBJECT_ID('dbo.tbCartaoLoteMovimento', 'U') IS NOT NULL
                            UPDATE tbCartaoLoteMovimento SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;

                        DELETE FROM tbBancoContaMovimento WHERE cdBancoContaMovimento = @movId;
                    `);
                }
            }

            // 3. Delete interest movement if present or requested
            if (options?.interestKey) {
                const intMovNum = parseInt(String(options.interestKey), 10);
                if (!isNaN(intMovNum) && intMovNum > 0) {
                    const reqDelInt = new sql.Request(transaction);
                    reqDelInt.input('intMovId', sql.Int, intMovNum);
                    await reqDelInt.query(`
                        IF OBJECT_ID('dbo.tbContaParcela', 'U') IS NOT NULL
                        BEGIN
                            UPDATE tbContaParcela SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @intMovId;
                            DELETE FROM tbContaParcela WHERE cdContaBaixa IN (SELECT cdContaBaixa FROM tbContaBaixa WHERE cdBancoContaMovimento = @intMovId);
                        END

                        IF OBJECT_ID('dbo.tbContaBaixaConta', 'U') IS NOT NULL
                            DELETE FROM tbContaBaixaConta WHERE cdContaBaixa IN (SELECT cdContaBaixa FROM tbContaBaixa WHERE cdBancoContaMovimento = @intMovId);

                        IF OBJECT_ID('dbo.tbContaBaixa', 'U') IS NOT NULL
                        BEGIN
                            UPDATE tbContaBaixa SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @intMovId;
                            DELETE FROM tbContaBaixa WHERE cdBancoContaMovimento = @intMovId;
                        END

                        IF OBJECT_ID('dbo.tbCrediarioDeposito', 'U') IS NOT NULL
                        BEGIN
                            UPDATE tbCrediarioDeposito SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @intMovId;
                            DELETE FROM tbCrediarioDeposito WHERE cdBancoContaMovimento = @intMovId;
                        END

                        IF OBJECT_ID('dbo.tbValeCompra', 'U') IS NOT NULL
                        BEGIN
                            UPDATE tbValeCompra SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @intMovId;
                            DELETE FROM tbValeCompra WHERE cdBancoContaMovimento = @intMovId;
                        END

                        IF OBJECT_ID('dbo.tbReceDespMovimento', 'U') IS NOT NULL
                            UPDATE tbReceDespMovimento SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @intMovId;

                        IF OBJECT_ID('dbo.tbChequeMovimento', 'U') IS NOT NULL
                            UPDATE tbChequeMovimento SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @intMovId;

                        IF OBJECT_ID('dbo.tbCartaoLoteMovimento', 'U') IS NOT NULL
                            UPDATE tbCartaoLoteMovimento SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @intMovId;

                        DELETE FROM tbBancoContaMovimento WHERE cdBancoContaMovimento = @intMovId;
                    `);
                    removedMovIds.push(intMovNum);
                }
            } else if (nrCupomResolved && paymentsToDelete.length > 0) {
                // Tenta encontrar e limpar movimentação de juros associada a este cupom inserida pelo Keystone
                const reqFindInt = new sql.Request(transaction);
                reqFindInt.input('cupomStr', sql.VarChar, `%Cupom #${String(nrCupomResolved).trim()}%`);
                const resFindInt = await reqFindInt.query(`
                    SELECT cdBancoContaMovimento FROM tbBancoContaMovimento 
                    WHERE (Historico LIKE '%Juros de conv%' OR Historico LIKE '%Juros de convênio%' OR Historico LIKE '%Juros de convenio%')
                      AND Historico LIKE @cupomStr
                `);
                for (const row of resFindInt.recordset || []) {
                    if (row.cdBancoContaMovimento) {
                        const reqDelIntAuto = new sql.Request(transaction);
                        reqDelIntAuto.input('movId', sql.Int, row.cdBancoContaMovimento);
                        await reqDelIntAuto.query(`
                            IF OBJECT_ID('dbo.tbContaParcela', 'U') IS NOT NULL
                            BEGIN
                                UPDATE tbContaParcela SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;
                                DELETE FROM tbContaParcela WHERE cdContaBaixa IN (SELECT cdContaBaixa FROM tbContaBaixa WHERE cdBancoContaMovimento = @movId);
                            END

                            IF OBJECT_ID('dbo.tbContaBaixaConta', 'U') IS NOT NULL
                                DELETE FROM tbContaBaixaConta WHERE cdContaBaixa IN (SELECT cdContaBaixa FROM tbContaBaixa WHERE cdBancoContaMovimento = @movId);

                            IF OBJECT_ID('dbo.tbContaBaixa', 'U') IS NOT NULL
                            BEGIN
                                UPDATE tbContaBaixa SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;
                                DELETE FROM tbContaBaixa WHERE cdBancoContaMovimento = @movId;
                            END

                            IF OBJECT_ID('dbo.tbCrediarioDeposito', 'U') IS NOT NULL
                            BEGIN
                                UPDATE tbCrediarioDeposito SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;
                                DELETE FROM tbCrediarioDeposito WHERE cdBancoContaMovimento = @movId;
                            END

                            IF OBJECT_ID('dbo.tbValeCompra', 'U') IS NOT NULL
                            BEGIN
                                UPDATE tbValeCompra SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;
                                DELETE FROM tbValeCompra WHERE cdBancoContaMovimento = @movId;
                            END

                            IF OBJECT_ID('dbo.tbReceDespMovimento', 'U') IS NOT NULL
                                UPDATE tbReceDespMovimento SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;

                            IF OBJECT_ID('dbo.tbChequeMovimento', 'U') IS NOT NULL
                                UPDATE tbChequeMovimento SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;

                            IF OBJECT_ID('dbo.tbCartaoLoteMovimento', 'U') IS NOT NULL
                                UPDATE tbCartaoLoteMovimento SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;

                            DELETE FROM tbBancoContaMovimento WHERE cdBancoContaMovimento = @movId;
                        `);
                        removedMovIds.push(row.cdBancoContaMovimento);
                    }
                }
            }

            // 4. Recalculate tbCrediarioCupom
            const reqRecalc = new sql.Request(transaction);
            reqRecalc.input('cdCrediarioCupom', sql.Int, cdCrediarioCupom);
            await reqRecalc.query(`
                UPDATE tbCrediarioCupom
                SET 
                    vlQuitado = ISNULL((SELECT SUM(vlPago) FROM tbCrediarioCupomPagamento WHERE cdCrediarioCupom = @cdCrediarioCupom), 0),
                    nrPagamentos = (SELECT COUNT(*) FROM tbCrediarioCupomPagamento WHERE cdCrediarioCupom = @cdCrediarioCupom),
                    Obs = (
                        SELECT CASE 
                            WHEN COUNT(*) = 0 THEN NULL 
                            ELSE MAX(Obs) 
                        END 
                        FROM tbCrediarioCupomPagamento 
                        WHERE cdCrediarioCupom = @cdCrediarioCupom
                    )
                WHERE cdCrediarioCupom = @cdCrediarioCupom
            `);

            // 5. Query final state
            const reqFinal = new sql.Request(transaction);
            reqFinal.input('cdCrediarioCupom', sql.Int, cdCrediarioCupom);
            const resFinal = await reqFinal.query(`
                SELECT vlQuitado, nrPagamentos FROM tbCrediarioCupom WHERE cdCrediarioCupom = @cdCrediarioCupom
            `);
            const finalRow = resFinal.recordset?.[0] || { vlQuitado: 0, nrPagamentos: 0 };

            await transaction.commit();

            return {
                deletedPayments: paymentsToDelete.length,
                remainingPayments: finalRow.nrPagamentos || 0,
                vlQuitado: finalRow.vlQuitado || 0,
                removedDepIds,
                removedMovIds
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        } finally {
            if (shouldClosePool && pool) {
                await pool.close();
            }
        }
    }

    static async buscarReceitaSolidcon(config: {
        host?: string | null | undefined;
        database?: string | null | undefined;
        user?: string | null | undefined;
        password?: string | null | undefined;
    }, filter: {
        documento?: string | number | null | undefined;
        cdConta?: number | null | undefined;
        cdContaBaixa?: number | null | undefined;
        cdBancoContaMovimento?: number | null | undefined;
        startDate?: string | null | undefined;
        endDate?: string | null | undefined;
        cdFilial?: string | number | null | undefined;
    }): Promise<any[]> {
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

        const pool = new sql.ConnectionPool(sqlConfig);
        try {
            await pool.connect();
            const request = pool.request();

            const docStr = filter.documento !== undefined && filter.documento !== null ? String(filter.documento).trim() : null;
            request.input('documento', sql.VarChar, docStr);
            request.input('cdConta', sql.Int, filter.cdConta || null);
            request.input('cdContaBaixa', sql.Int, filter.cdContaBaixa || null);
            request.input('cdBancoContaMovimento', sql.Int, filter.cdBancoContaMovimento || null);
            request.input('startDate', sql.VarChar, filter.startDate ? `${filter.startDate} 00:00:00` : null);
            request.input('endDate', sql.VarChar, filter.endDate ? `${filter.endDate} 23:59:59` : null);

            let filialFilter = '1=1';
            if (filter.cdFilial) {
                const filials = String(filter.cdFilial)
                    .split(',')
                    .map(f => parseInt(f.trim(), 10))
                    .filter(f => !isNaN(f));
                if (filials.length > 0) {
                    filialFilter = `(TRY_CAST(c.cdPessoaFilialConta AS INT) IN (${filials.join(',')}) OR TRY_CAST(cb.cdPessoaFilialContaBaixa AS INT) IN (${filials.join(',')}) OR TRY_CAST(bcm.cdPessoaFilialBancoConta AS INT) IN (${filials.join(',')}))`;
                }
            }

            const query = `
                SELECT 
                    c.cdConta,
                    c.cdPessoaFilialConta,
                    c.cdEmpresa,
                    c.cdPessoaComercial,
                    c.cdContaTipo,
                    c.Documento,
                    c.cdPagamentoTipo,
                    c.dtInclusao,
                    cp.cdContaParcela,
                    cp.dtParcela,
                    cp.vlParcela,
                    cp.Historico AS historicoParcela,
                    ISNULL(cp.cdBancoContaMovimento, cb.cdBancoContaMovimento) AS cdBancoContaMovimento,
                    cb.cdContaBaixa,
                    cb.dtContaBaixa,
                    cb.vlContaBaixa,
                    cb.inRecebimento,
                    cb.inAvista,
                    ISNULL(cb.cdBancoConta, bcm.cdBancoConta) AS cdBancoConta,
                    bcm.dtLancamento,
                    bcm.vlCredito,
                    bcm.vlDebito,
                    bcm.Historico AS historicoMovimento,
                    bc.nmConta AS nomeBancoConta
                FROM tbConta c
                LEFT JOIN tbContaParcela cp ON cp.cdConta = c.cdConta AND cp.cdPessoaFilialConta = c.cdPessoaFilialConta
                LEFT JOIN tbContaBaixa cb ON cb.cdContaBaixa = cp.cdContaBaixa AND cb.cdPessoaFilialContaBaixa = cp.cdPessoaFilialContaBaixa
                LEFT JOIN tbBancoContaMovimento bcm ON bcm.cdBancoContaMovimento = ISNULL(cp.cdBancoContaMovimento, cb.cdBancoContaMovimento)
                LEFT JOIN tbBancoConta bc ON bc.cdBancoConta = ISNULL(cb.cdBancoConta, bcm.cdBancoConta)
                WHERE (c.cdContaTipo IN (1, 3))
                  AND ${filialFilter}
                  AND (
                      (@documento IS NOT NULL AND (
                          c.Documento = @documento 
                          OR cb.Documento = @documento 
                          OR bcm.Numero = @documento 
                          OR bcm.Historico LIKE '%' + @documento + '%'
                          OR cp.Historico LIKE '%' + @documento + '%'
                      ))
                      OR (@cdConta IS NOT NULL AND c.cdConta = @cdConta)
                      OR (@cdContaBaixa IS NOT NULL AND cb.cdContaBaixa = @cdContaBaixa)
                      OR (@cdBancoContaMovimento IS NOT NULL AND (
                          bcm.cdBancoContaMovimento = @cdBancoContaMovimento 
                          OR cp.cdBancoContaMovimento = @cdBancoContaMovimento 
                          OR cb.cdBancoContaMovimento = @cdBancoContaMovimento
                      ))
                      OR (@startDate IS NOT NULL AND @endDate IS NOT NULL AND (
                          c.dtInclusao BETWEEN @startDate AND @endDate 
                          OR cb.dtContaBaixa BETWEEN @startDate AND @endDate 
                          OR bcm.dtLancamento BETWEEN @startDate AND @endDate
                      ))
                  )
                ORDER BY ISNULL(c.cdConta, cb.cdContaBaixa) DESC
            `;

            const result = await request.query(query);
            return result.recordset || [];
        } catch (err: any) {
            const msg = err?.message || '';
            if (msg.includes('Invalid object name')) {
                const matchObj = msg.match(/Invalid object name '([^']+)'/i);
                const objName = matchObj ? matchObj[1] : 'tabela';
                throw new Error(`A tabela '${objName}' não existe no banco de dados '${config.database || 'padrão'}' (${server}).`);
            }
            throw err;
        } finally {
            if (pool) {
                try {
                    await pool.close();
                } catch {
                    // ignore
                }
            }
        }
    }

    static async getSolidconDetailedInspection(config: {
        host?: string | null | undefined;
        database?: string | null | undefined;
        user?: string | null | undefined;
        password?: string | null | undefined;
    }, params: {
        cdCrediarioCupom?: number | string | null | undefined;
        nrCupom?: number | string | null | undefined;
        customerCpf?: string | null | undefined;
        interestKey?: string | number | null | undefined;
        cdFilial?: string | number | null | undefined;
        cdPDV?: string | number | null | undefined;
        transaction?: any;
    }): Promise<{
        cupom: any | null;
        payments: any[];
        deposits: any[];
        movements: any[];
        extratos: any[];
        isReconciledSolidcon: boolean;
        interestConta: any[];
        conta?: any | null;
        contaBaixas?: any[];
        contaParcelas?: any[];
        tableIds: {
            tbCrediarioCupom: number | string | null;
            tbCrediarioCupomPagamento: any[];
            tbCrediarioDeposito: any[];
            tbBancoContaMovimento: any[];
            tbBancoContaExtrato: any[];
            tbConta: number | string | null;
            tbContaBaixa: any[];
            tbContaParcela: any[];
        };
        hasDuplicates: boolean;
        missingBaixaTie?: boolean;
        untiedMovements?: any[];
        duplicateAnalysis: {
            hasDuplicates: boolean;
            duplicatePaymentCount: number;
            duplicateDepositCount: number;
            duplicateMovementCount: number;
            missingBaixaTie?: boolean;
            untiedMovementCount?: number;
            reasons: string[];
        };
        duplicateReasons: string[];
        logLines: string[];
    }> {
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
            options: {
                encrypt: false,
                trustServerCertificate: true
            },
            connectionTimeout: 10000,
            requestTimeout: 15000
        };

        const pool = new sql.ConnectionPool(sqlConfig);
        await pool.connect();

        try {
            const logLines: string[] = [];
            const nowStr = new Date().toLocaleString('pt-BR');
            logLines.push(`[${nowStr}] 🔍 Iniciando consulta detalhada no banco Solidcon (${server}/${config.database})...`);

            let cdCrediarioCupomResolved: number | null = params.cdCrediarioCupom ? parseInt(String(params.cdCrediarioCupom), 10) : null;
            if (isNaN(cdCrediarioCupomResolved as number)) cdCrediarioCupomResolved = null;

            let nrCupomResolved: string | null = params.nrCupom ? String(params.nrCupom).trim() : null;
            const cdFilialResolved = params.cdFilial ? parseInt(String(params.cdFilial), 10) : null;
            const cdPDVResolved = params.cdPDV !== undefined && params.cdPDV !== null && String(params.cdPDV).trim() !== ''
                ? parseInt(String(params.cdPDV).trim(), 10)
                : null;

            // 1. Consultar tbCrediarioCupom
            let cupomRow: any = null;

            // Tentativa 1: Buscar diretamente por cdCrediarioCupom (PK exata)
            if (cdCrediarioCupomResolved) {
                const reqCupom = pool.request();
                reqCupom.input('cdCrediarioCupom', sql.Int, cdCrediarioCupomResolved);
                let filialFilter = '';
                if (cdFilialResolved && !isNaN(cdFilialResolved)) {
                    reqCupom.input('cdFilial', sql.Int, cdFilialResolved);
                    filialFilter = ' AND c.cdFilial = @cdFilial ';
                }
                const resCupom = await reqCupom.query(`
                    SELECT c.*, cl.Nome as nmCliente
                    FROM tbCrediarioCupom c
                    LEFT JOIN tbCrediario cl ON cl.cdCrediario = c.cdCrediario
                    WHERE c.cdCrediarioCupom = @cdCrediarioCupom ${filialFilter}
                `);
                cupomRow = resCupom.recordset?.[0] || null;

                // Se não achou com filialFilter, tentar sem filial
                if (!cupomRow && filialFilter) {
                    const reqCupomNoFilial = pool.request();
                    reqCupomNoFilial.input('cdCrediarioCupom', sql.Int, cdCrediarioCupomResolved);
                    const resNoFilial = await reqCupomNoFilial.query(`
                        SELECT c.*, cl.Nome as nmCliente
                        FROM tbCrediarioCupom c
                        LEFT JOIN tbCrediario cl ON cl.cdCrediario = c.cdCrediario
                        WHERE c.cdCrediarioCupom = @cdCrediarioCupom
                    `);
                    cupomRow = resNoFilial.recordset?.[0] || null;
                }
            }

            // Tentativa 2: Buscar com Filtro Estrito de Filial + PDV + nrCupom
            if (!cupomRow && (nrCupomResolved || cdCrediarioCupomResolved)) {
                const searchNr = nrCupomResolved || String(cdCrediarioCupomResolved);
                const cupomNum = parseInt(searchNr.replace(/\D/g, ''), 10);
                const nrCupomPadded6 = searchNr.padStart(6, '0');
                const nrCupomPadded8 = searchNr.padStart(8, '0');

                // 2.1: Filial + PDV
                if (cdFilialResolved && !isNaN(cdFilialResolved) && cdPDVResolved !== null && !isNaN(cdPDVResolved)) {
                    const reqStrict = pool.request();
                    reqStrict.input('cdFilial', sql.Int, cdFilialResolved);
                    reqStrict.input('cdPDV', sql.Int, cdPDVResolved);
                    reqStrict.input('nrCupomStr', sql.VarChar, searchNr);
                    reqStrict.input('nrCupomPadded6', sql.VarChar, nrCupomPadded6);
                    reqStrict.input('nrCupomPadded8', sql.VarChar, nrCupomPadded8);
                    if (!isNaN(cupomNum)) reqStrict.input('cupomNum', sql.BigInt, cupomNum);

                    const resStrict = await reqStrict.query(`
                        SELECT TOP 1 c.*, cl.Nome as nmCliente
                        FROM tbCrediarioCupom c
                        LEFT JOIN tbCrediario cl ON cl.cdCrediario = c.cdCrediario
                        WHERE c.cdFilial = @cdFilial 
                          AND (c.cdPDV = @cdPDV OR TRY_CAST(c.cdPDV AS INT) = @cdPDV)
                          AND (
                              c.nrCupom = @nrCupomStr
                              OR c.nrCupom = @nrCupomPadded6
                              OR c.nrCupom = @nrCupomPadded8
                              ${!isNaN(cupomNum) ? 'OR c.nrCupom = @cupomNum OR TRY_CAST(c.nrCupom AS BIGINT) = @cupomNum' : ''}
                          )
                        ORDER BY c.cdCrediarioCupom DESC
                    `);
                    cupomRow = resStrict.recordset?.[0] || null;
                }

                // 2.2: Apenas Filial (se não encontrou com PDV)
                if (!cupomRow && cdFilialResolved && !isNaN(cdFilialResolved)) {
                    const reqFilial = pool.request();
                    reqFilial.input('cdFilial', sql.Int, cdFilialResolved);
                    reqFilial.input('nrCupomStr', sql.VarChar, searchNr);
                    reqFilial.input('nrCupomPadded6', sql.VarChar, nrCupomPadded6);
                    reqFilial.input('nrCupomPadded8', sql.VarChar, nrCupomPadded8);
                    if (!isNaN(cupomNum)) reqFilial.input('cupomNum', sql.BigInt, cupomNum);

                    const resFilial = await reqFilial.query(`
                        SELECT TOP 1 c.*, cl.Nome as nmCliente
                        FROM tbCrediarioCupom c
                        LEFT JOIN tbCrediario cl ON cl.cdCrediario = c.cdCrediario
                        WHERE c.cdFilial = @cdFilial
                          AND (
                              c.nrCupom = @nrCupomStr
                              OR c.nrCupom = @nrCupomPadded6
                              OR c.nrCupom = @nrCupomPadded8
                              ${!isNaN(cupomNum) ? 'OR c.nrCupom = @cupomNum OR TRY_CAST(c.nrCupom AS BIGINT) = @cupomNum' : ''}
                          )
                        ORDER BY c.cdCrediarioCupom DESC
                    `);
                    cupomRow = resFilial.recordset?.[0] || null;
                }

                // 2.3: Fallback sem filial (apenas se realmente não achou)
                if (!cupomRow) {
                    const reqFallback = pool.request();
                    reqFallback.input('nrCupomStr', sql.VarChar, searchNr);
                    reqFallback.input('nrCupomPadded6', sql.VarChar, nrCupomPadded6);
                    reqFallback.input('nrCupomPadded8', sql.VarChar, nrCupomPadded8);
                    if (!isNaN(cupomNum)) reqFallback.input('cupomNum', sql.BigInt, cupomNum);

                    const resFallback = await reqFallback.query(`
                        SELECT TOP 1 c.*, cl.Nome as nmCliente
                        FROM tbCrediarioCupom c
                        LEFT JOIN tbCrediario cl ON cl.cdCrediario = c.cdCrediario
                        WHERE (
                            c.nrCupom = @nrCupomStr
                            OR c.nrCupom = @nrCupomPadded6
                            OR c.nrCupom = @nrCupomPadded8
                            ${!isNaN(cupomNum) ? 'OR c.nrCupom = @cupomNum OR TRY_CAST(c.nrCupom AS BIGINT) = @cupomNum' : ''}
                        )
                        ORDER BY c.cdCrediarioCupom DESC
                    `);
                    cupomRow = resFallback.recordset?.[0] || null;
                }
            }

            if (cupomRow) {
                cdCrediarioCupomResolved = cupomRow.cdCrediarioCupom;
                nrCupomResolved = String(cupomRow.nrCupom);
                const dtCredStr = cupomRow.dtCrediario ? new Date(cupomRow.dtCrediario).toLocaleDateString('pt-BR') : '-';
                logLines.push(`→ [tbCrediarioCupom] ID: ${cupomRow.cdCrediarioCupom} | Cupom #${cupomRow.nrCupom} | Filial: ${cupomRow.cdFilial} | PDV: ${cupomRow.cdPDV} | Data: ${dtCredStr} | Valor: R$ ${Number(cupomRow.vlCrediario || 0).toFixed(2)} | Quitado: R$ ${Number(cupomRow.vlQuitado || 0).toFixed(2)} | Pagamentos: ${cupomRow.nrPagamentos || 0}`);
            } else {
                logLines.push(`⚠️ [tbCrediarioCupom] Nenhum registro encontrado para ID: ${cdCrediarioCupomResolved || 'N/A'} / Cupom: #${nrCupomResolved || 'N/A'} (Filial: ${cdFilialResolved || 'N/A'}, PDV: ${cdPDVResolved || 'N/A'})`);
            }

            // 2. Consultar tbCrediarioCupomPagamento
            const payments: any[] = [];
            const depIds: number[] = [];
            const movIds: number[] = [];
            if (cdCrediarioCupomResolved) {
                const reqPags = pool.request();
                reqPags.input('cdCrediarioCupom', sql.Int, cdCrediarioCupomResolved);
                const resPags = await reqPags.query(`
                    SELECT p.*, d.cdBancoContaMovimento, d.cdBancoConta, bc.nmConta as nmBancoConta
                    FROM tbCrediarioCupomPagamento p
                    LEFT JOIN tbCrediarioDeposito d ON d.cdCrediarioDeposito = p.cdCrediarioDeposito
                    LEFT JOIN tbBancoConta bc ON bc.cdBancoConta = d.cdBancoConta
                    WHERE p.cdCrediarioCupom = @cdCrediarioCupom
                    ORDER BY p.nrPagamento ASC
                `);
                for (const p of resPags.recordset || []) {
                    payments.push(p);
                    if (p.cdCrediarioDeposito) {
                        depIds.push(Number(p.cdCrediarioDeposito));
                    }
                    if (p.cdBancoContaMovimento) {
                        movIds.push(Number(p.cdBancoContaMovimento));
                    }
                    const dtStr = p.dtPago ? new Date(p.dtPago).toLocaleDateString('pt-BR') : '-';
                    logLines.push(`→ [tbCrediarioCupomPagamento] Pagamento #${p.nrPagamento} | Filial: ${p.cdFilial} | Valor Pago: R$ ${Number(p.vlPago || 0).toFixed(2)} | Data: ${dtStr} | Usuário: ${p.cdUsuarioQuitou || p.cdUsuario || '-'} | Obs: "${p.Obs || ''}" | Depósito: #${p.cdCrediarioDeposito || '-'} | Movimento Banco: #${p.cdBancoContaMovimento || '-'}`);
                }
            }

            // 3. Consultar tbCrediarioDeposito
            const deposits: any[] = [];
            if (depIds.length > 0) {
                const uniqueDepIds = Array.from(new Set(depIds));
                const resDep = await pool.request().query(`
                    SELECT d.*, bc.nmConta as nmBancoConta
                    FROM tbCrediarioDeposito d
                    LEFT JOIN tbBancoConta bc ON bc.cdBancoConta = d.cdBancoConta
                    WHERE d.cdCrediarioDeposito IN (${uniqueDepIds.join(',')})
                `);
                for (const d of resDep.recordset || []) {
                    deposits.push(d);
                    if (d.cdBancoContaMovimento) {
                        movIds.push(Number(d.cdBancoContaMovimento));
                    }
                    const dtDepStr = d.dtDeposito ? new Date(d.dtDeposito).toLocaleDateString('pt-BR') : '-';
                    logLines.push(`→ [tbCrediarioDeposito] ID: ${d.cdCrediarioDeposito} | Conta: ${d.cdBancoConta} (${d.nmBancoConta || 'Conta Bancária'}) | Valor Quitado: R$ ${Number(d.vlQuitado || 0).toFixed(2)} | Data: ${dtDepStr} | Movimento Banco ID: #${d.cdBancoContaMovimento || '-'}`);
                }
            }

            // 4. Consultar tbBancoContaMovimento
            const movements: any[] = [];
            const uniqueMovIds = Array.from(new Set(movIds));
            let movWhere = '1=0';
            if (uniqueMovIds.length > 0) {
                movWhere = `m.cdBancoContaMovimento IN (${uniqueMovIds.join(',')})`;
            } else if (nrCupomResolved) {
                let filialMovFilter = (cdFilialResolved && !isNaN(cdFilialResolved))
                    ? ` AND (m.cdBancoConta IN (SELECT cdBancoConta FROM tbBancoConta WHERE cdPessoaFilial = ${cdFilialResolved}) OR m.cdPessoaFilialBancoConta = ${cdFilialResolved} OR m.cdBancoConta IS NULL)`
                    : '';
                movWhere = `(m.Historico LIKE '%Cupom #${nrCupomResolved}%' OR m.Numero = '${nrCupomResolved}') ${filialMovFilter}`;
            }

            const resMov = await pool.request().query(`
                SELECT m.*, bc.nmConta as nmBancoConta
                FROM tbBancoContaMovimento m
                LEFT JOIN tbBancoConta bc ON bc.cdBancoConta = m.cdBancoConta
                WHERE ${movWhere}
                ORDER BY m.cdBancoContaMovimento DESC
            `);
            for (const m of resMov.recordset || []) {
                movements.push(m);
                const dtMovStr = m.dtLancamento ? new Date(m.dtLancamento).toLocaleDateString('pt-BR') : '-';
                const valor = Number(m.vlDebito || m.vlCredito || 0);
                const extratoStatus = m.cdBancoContaExtrato ? `Conciliado Extrato #${m.cdBancoContaExtrato}` : 'Pendente de Conciliação no Extrato';
                logLines.push(`→ [tbBancoContaMovimento] ID: #${m.cdBancoContaMovimento} | Conta: ${m.cdBancoConta || '-'} (${m.nmBancoConta || 'Conta'}) | Valor: R$ ${valor.toFixed(2)} | Data: ${dtMovStr} | ${extratoStatus} | Histórico: "${m.Historico || ''}"`);
            }

            // 4.1 Consultar tbBancoContaExtrato (Conciliação com Extrato da Conta)
            const extratos: any[] = [];
            const extratoIds = movements
                .map((m: any) => m.cdBancoContaExtrato)
                .filter((id: any) => id !== null && id !== undefined && Number(id) > 0);

            if (extratoIds.length > 0) {
                const uniqueExtratoIds = Array.from(new Set(extratoIds));
                try {
                    const resExtratos = await pool.request().query(`
                        SELECT ext.*, bc.nmConta as nmBancoConta
                        FROM tbBancoContaExtrato ext
                        LEFT JOIN tbBancoConta bc ON bc.cdBancoConta = ext.cdBancoConta
                        WHERE ext.cdBancoContaExtrato IN (${uniqueExtratoIds.join(',')})
                    `);
                    for (const row of resExtratos.recordset || []) {
                        extratos.push(row);
                        const dtExtStr = row.dtExtrato ? new Date(row.dtExtrato).toLocaleDateString('pt-BR') : '-';
                        const valorExt = Number(row.vlDebito || row.vlCredito || row.vlMovimento || 0);
                        logLines.push(`→ [tbBancoContaExtrato] ID: #${row.cdBancoContaExtrato} | Conta: ${row.cdBancoConta || '-'} (${row.nmBancoConta || 'Conta'}) | Valor: R$ ${valorExt.toFixed(2)} | Data: ${dtExtStr} | Histórico: "${row.Historico || ''}"`);
                    }
                } catch (extratoErr) {
                    // Fallback se tbBancoContaExtrato não puder ser consultada diretamente
                }
            }

            // Análise de Conciliação com Extrato Bancário
            const isReconciledSolidcon = movements.some((m: any) => m.cdBancoContaExtrato && Number(m.cdBancoContaExtrato) > 0) || extratos.length > 0;
            if (isReconciledSolidcon) {
                logLines.push(`✅ [CONCILIAÇÃO COM EXTRATO] O movimento bancário ESTÁ CONCILIADO com o extrato da conta no Solidcon (Extrato #${extratoIds.join(', #')}).`);
            } else if (movements.length > 0) {
                logLines.push(`ℹ️ [CONCILIAÇÃO COM EXTRATO] Movimento bancário presente no Solidcon, mas AINDA NÃO CONCILIADO com o extrato da conta.`);
            }

            // 5. Consultar tbConta / tbContaBaixa / tbContaParcela (Juros ou Receitas)
            const interestConta: any[] = [];
            let interestKeyNum = params.interestKey ? parseInt(String(params.interestKey), 10) : null;
            if (isNaN(interestKeyNum as number)) interestKeyNum = null;

            const targetMovIds = Array.from(new Set(uniqueMovIds));
            let contaWhere = '1=0';
            if (interestKeyNum) {
                contaWhere += ` OR c.cdConta = ${interestKeyNum} OR cb.cdContaBaixa = ${interestKeyNum} `;
            }
            if (targetMovIds.length > 0) {
                contaWhere += ` OR cp.cdBancoContaMovimento IN (${targetMovIds.join(',')}) OR cb.cdBancoContaMovimento IN (${targetMovIds.join(',')}) `;
            } else if (nrCupomResolved) {
                let filialContaFilter = (cdFilialResolved && !isNaN(cdFilialResolved))
                    ? ` AND (c.cdPessoaFilialConta = ${cdFilialResolved} OR cb.cdPessoaFilialContaBaixa = ${cdFilialResolved}) `
                    : '';
                contaWhere += ` OR ((c.Documento = '${nrCupomResolved}' OR cb.Documento = '${nrCupomResolved}' OR cp.Historico LIKE '%#${nrCupomResolved}%') ${filialContaFilter}) `;
            }

            try {
                const resConta = await pool.request().query(`
                    SELECT c.cdConta, c.Documento, c.dtInclusao, c.cdPessoaFilialConta,
                           cp.cdContaParcela, cp.dtParcela, cp.vlParcela, cp.Historico as historicoParcela,
                           cp.cdBancoContaMovimento as cdMovParcela,
                           cb.cdContaBaixa, cb.dtContaBaixa, cb.vlContaBaixa, cb.Historico as historicoBaixa,
                           cb.cdBancoContaMovimento as cdMovBaixa,
                           bcm.cdBancoContaMovimento as cdMovJuros, bcm.dtLancamento as dtLancJuros, bcm.vlDebito as vlDebJuros
                    FROM tbConta c
                    LEFT JOIN tbContaParcela cp ON cp.cdConta = c.cdConta
                    LEFT JOIN tbContaBaixa cb ON cb.cdContaBaixa = cp.cdContaBaixa
                    LEFT JOIN tbBancoContaMovimento bcm ON bcm.cdBancoContaMovimento = cp.cdBancoContaMovimento OR bcm.cdBancoContaMovimento = cb.cdBancoContaMovimento
                    WHERE ${contaWhere}
                    ORDER BY c.cdConta DESC
                `);
                for (const row of resConta.recordset || []) {
                    interestConta.push(row);
                    logLines.push(`→ [tbConta/tbContaBaixa] Receita ID: #${row.cdConta} | Baixa ID: #${row.cdContaBaixa || '-'} | Parcela: ${row.cdContaParcela || '-'} | Valor: R$ ${Number(row.vlContaBaixa || row.vlParcela || 0).toFixed(2)} | Movimento ID: #${row.cdMovBaixa || row.cdMovParcela || row.cdMovJuros || '-'}`);
                }
            } catch (contaErr: any) {
                // Tabela pode não existir em versões específicas
            }

            // Análise de Conciliação Bancária (Amarração em tbConta / tbContaBaixa)
            const tiedMovIds = new Set<number>();
            interestConta.forEach((c: any) => {
                if (c.cdContaBaixa) {
                    if (c.cdMovBaixa) tiedMovIds.add(Number(c.cdMovBaixa));
                    if (c.cdMovParcela) tiedMovIds.add(Number(c.cdMovParcela));
                    if (c.cdMovJuros) tiedMovIds.add(Number(c.cdMovJuros));
                }
            });

            const untiedMovements = movements.filter((m: any) => !tiedMovIds.has(Number(m.cdBancoContaMovimento)));
            const missingBaixaTie = untiedMovements.length > 0 && payments.length > 0;
            if (missingBaixaTie) {
                untiedMovements.forEach((m: any) => {
                    logLines.push(`⚠️ [CONCILIAÇÃO BANCÁRIA] Movimento bancário #${m.cdBancoContaMovimento} (R$ ${Number(m.vlDebito || m.vlCredito || 0).toFixed(2)}) NÃO está amarrado a tbConta / tbContaBaixa. Isso impede a conciliação automática com o extrato bancário.`);
                });
            }

            // Análise de Duplicidade vs Pagamento Parcial / Fracionado
            const cupomTotal = Number(cupomRow?.vlCrediario || 0);
            const cupomQuitado = Number(cupomRow?.vlQuitado || 0);
            const totalPagamentos = payments.reduce((sum: number, p: any) => sum + Number(p.vlPago || 0), 0);
            const distinctPaymentNrs = new Set(payments.map((p: any) => p.nrPagamento)).size;
            const normalMovs = movements.filter((m: any) => !String(m.Historico || '').includes('Juros'));

            const duplicateReasons: string[] = [];

            // 1. Verifica se a soma dos pagamentos excede o valor do cupom
            if (cupomTotal > 0 && totalPagamentos > cupomTotal + 0.05) {
                duplicateReasons.push(`Soma dos pagamentos (R$ ${totalPagamentos.toFixed(2)}) ultrapassa o valor total do cupom (R$ ${cupomTotal.toFixed(2)}).`);
            }

            // 2. Verifica se há múltiplos registros com o mesmo nrPagamento
            if (payments.length > 1 && distinctPaymentNrs < payments.length) {
                duplicateReasons.push(`Existem registros com o mesmo número de pagamento (nrPagamento duplicado) em 'tbCrediarioCupomPagamento'.`);
            }

            // 3. Verifica se o cabeçalho do cupom está inconsistente (vlQuitado > vlCrediario)
            if (cupomRow && cupomTotal > 0 && cupomQuitado > cupomTotal + 0.05) {
                duplicateReasons.push(`Valor quitado no cupom (R$ ${cupomQuitado.toFixed(2)}) é maior que o valor total (R$ ${cupomTotal.toFixed(2)}).`);
            }

            // 4. Verifica se há mais depósitos do que pagamentos registrados
            if (deposits.length > payments.length && payments.length > 0) {
                duplicateReasons.push(`Detectados ${deposits.length} depósitos para ${payments.length} pagamento(s) em 'tbCrediarioDeposito'.`);
            }

            // 5. Verifica se há mais movimentações de conta corrente do que depósitos
            if (normalMovs.length > deposits.length && deposits.length > 0) {
                duplicateReasons.push(`Detectadas ${normalMovs.length} movimentações de conta corrente para ${deposits.length} depósito(s) em 'tbBancoContaMovimento'.`);
            }

            const isPartialPayment = payments.length > 1 && duplicateReasons.length === 0;
            const hasDuplicates = duplicateReasons.length > 0;

            if (isPartialPayment) {
                logLines.push(`ℹ️ [PAGAMENTO PARCIAL / FRACIONADO] O cupom foi liquidado em ${payments.length} pagamentos/depósitos parciais legítimos. Total pago: R$ ${totalPagamentos.toFixed(2)} (${cupomTotal > 0 && Math.abs(totalPagamentos - cupomTotal) <= 0.05 ? '100% quitado' : 'parcial'}).`);
            }

            if (hasDuplicates) {
                logLines.push(`⚠️ [DIAGNÓSTICO] DUPLICIDADE IDENTIFICADA:`);
                duplicateReasons.forEach(r => logLines.push(`   • ${r}`));
            } else {
                logLines.push(`✅ [DIAGNÓSTICO] Lançamento íntegro e sem duplicidades no Solidcon.`);
            }

            const allFoundContaBaixas = Array.from(new Set(interestConta.map((c: any) => c.cdContaBaixa).filter(Boolean)));
            const allFoundContaParcelas = Array.from(new Set(interestConta.map((c: any) => c.cdContaParcela).filter(Boolean)));

            // 5.1 Consultar tbContaBaixa de forma direta para capturar todas as baixas e detalhes bancários
            const detailedContaBaixas: any[] = [];
            const directBaixaIds: number[] = allFoundContaBaixas.map(Number);
            let baixaWhere = '1=0';
            if (directBaixaIds.length > 0) {
                baixaWhere += ` OR cb.cdContaBaixa IN (${directBaixaIds.join(',')}) `;
            }
            if (targetMovIds.length > 0) {
                baixaWhere += ` OR cb.cdBancoContaMovimento IN (${targetMovIds.join(',')}) `;
            } else if (nrCupomResolved) {
                let filialBaixaFilter = (cdFilialResolved && !isNaN(cdFilialResolved))
                    ? ` AND cb.cdPessoaFilialContaBaixa = ${cdFilialResolved} `
                    : '';
                baixaWhere += ` OR ((cb.Documento = '${nrCupomResolved}' OR cb.Historico LIKE '%#${nrCupomResolved}%') ${filialBaixaFilter}) `;
            }

            try {
                const resDirectBaixas = await pool.request().query(`
                    SELECT cb.cdContaBaixa, cb.cdPessoaFilialContaBaixa, cb.cdPessoaFilialBancoConta, cb.cdBancoConta,
                           cb.cdBancoContaMovimento, cb.dtContaBaixa, cb.vlContaBaixa, cb.Documento, cb.Historico,
                           cb.inRecebimento, cb.cdPagamentoTipo, cb.inAvista,
                           cp.cdConta, cp.cdContaParcela, cp.vlParcela, cp.dtParcela,
                           bc.nmConta as nmBancoConta
                    FROM tbContaBaixa cb
                    LEFT JOIN tbContaParcela cp ON cp.cdContaBaixa = cb.cdContaBaixa
                    LEFT JOIN tbBancoConta bc ON bc.cdBancoConta = cb.cdBancoConta
                    WHERE ${baixaWhere}
                    ORDER BY cb.cdContaBaixa DESC
                `);
                for (const r of resDirectBaixas.recordset || []) {
                    detailedContaBaixas.push(r);
                    if (!allFoundContaBaixas.includes(r.cdContaBaixa)) {
                        allFoundContaBaixas.push(r.cdContaBaixa);
                    }
                }
            } catch (baixaErr) {
                // ignore
            }

            const tableIds = {
                tbCrediarioCupom: cupomRow ? cupomRow.cdCrediarioCupom : null,
                tbCrediarioCupomPagamento: payments.map((p: any) => p.nrPagamento ?? p.cdCrediarioCupom),
                tbCrediarioDeposito: Array.from(new Set(deposits.map((d: any) => d.cdCrediarioDeposito).filter(Boolean))),
                tbBancoContaMovimento: Array.from(new Set(movements.map((m: any) => m.cdBancoContaMovimento).filter(Boolean))),
                tbBancoContaExtrato: Array.from(new Set(extratoIds)),
                tbConta: interestConta.length > 0 && interestConta[0].cdConta ? interestConta[0].cdConta : null,
                tbContaBaixa: allFoundContaBaixas,
                tbContaParcela: allFoundContaParcelas
            };

            const duplicateAnalysis = {
                hasDuplicates,
                isPartialPayment,
                totalPaid: totalPagamentos,
                cupomTotal: cupomTotal,
                duplicatePaymentCount: hasDuplicates ? Math.max(0, payments.length - 1) : 0,
                duplicateDepositCount: hasDuplicates ? Math.max(0, deposits.length - 1) : 0,
                duplicateMovementCount: hasDuplicates ? Math.max(0, normalMovs.length - 1) : 0,
                missingBaixaTie,
                untiedMovementCount: untiedMovements.length,
                reasons: duplicateReasons
            };

            return {
                cupom: cupomRow,
                payments,
                deposits,
                movements,
                extratos,
                isReconciledSolidcon,
                interestConta,
                conta: interestConta.length > 0 ? interestConta[0] : null,
                contaBaixas: detailedContaBaixas.length > 0 ? detailedContaBaixas : interestConta.filter((c: any) => c.cdContaBaixa),
                contaParcelas: interestConta.filter((c: any) => c.cdContaParcela),
                missingBaixaTie,
                untiedMovements,
                tableIds,
                hasDuplicates,
                duplicateAnalysis,
                duplicateReasons,
                logLines
            };
        } finally {
            if (pool) {
                try {
                    await pool.close();
                } catch {
                    // ignore
                }
            }
        }
    }

    static async cancelarContaBaixaSolidcon(config: {
        host?: string | null | undefined;
        database?: string | null | undefined;
        user?: string | null | undefined;
        password?: string | null | undefined;
        pool?: sql.ConnectionPool | undefined;
    }, params: {
        cdContaBaixa?: number | string | null | undefined;
        cdCrediarioCupom?: number | string | null | undefined;
        nrCupom?: string | number | null | undefined;
        cdBancoContaMovimento?: number | string | null | undefined;
        interestKey?: string | number | null | undefined;
        cancelCupomPayment?: boolean | undefined;
        cdFilial?: string | number | null | undefined;
        transaction?: any;
    }): Promise<{
        success: boolean;
        deletedContaBaixas: number[];
        deletedContaParcelas: string[];
        deletedContas: number[];
        deletedMovimentos: number[];
        deletedPagamentos: number[];
        deletedDepositos: number[];
        updatedCupom: any | null;
        logLines: string[];
    }> {
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

        let pool = config.pool;
        let shouldClosePool = false;

        if (!pool) {
            const sqlConfig: sql.config = {
                user: config.user || '',
                password: config.password || '',
                database: config.database || '',
                server: server,
                port: port,
                options: {
                    encrypt: false,
                    trustServerCertificate: true
                },
                connectionTimeout: 10000,
                requestTimeout: 15000
            };
            pool = new sql.ConnectionPool(sqlConfig);
            await pool.connect();
            shouldClosePool = true;
        }

        const logLines: string[] = [];
        const nowStr = new Date().toLocaleString('pt-BR');
        logLines.push(`[${nowStr}] 🛑 Iniciando cancelamento / estorno de baixa no Solidcon...`);

        const sqlTx = new sql.Transaction(pool);
        try {
            await sqlTx.begin();

            const deletedContaBaixas: number[] = [];
            const deletedContaParcelas: string[] = [];
            const deletedContas: number[] = [];
            const deletedMovimentos: number[] = [];
            const deletedPagamentos: number[] = [];
            const deletedDepositos: number[] = [];

            // 1. Identificar tbContaBaixa alvo
            const targetContaBaixaIds: number[] = [];
            if (params.cdContaBaixa) {
                const idNum = parseInt(String(params.cdContaBaixa), 10);
                if (!isNaN(idNum) && idNum > 0) targetContaBaixaIds.push(idNum);
            }

            const targetMovIds: number[] = [];
            if (params.cdBancoContaMovimento) {
                const movNum = parseInt(String(params.cdBancoContaMovimento), 10);
                if (!isNaN(movNum) && movNum > 0) targetMovIds.push(movNum);
            }

            const cupomNumStr = params.nrCupom ? String(params.nrCupom).trim() : null;

            // Se não especificou cdContaBaixa diretamente, buscar por movimento bancário ou documento
            if (targetContaBaixaIds.length === 0) {
                const whereParts: string[] = [];
                if (targetMovIds.length > 0) {
                    whereParts.push(`cdBancoContaMovimento IN (${targetMovIds.join(',')})`);
                }
                if (cupomNumStr) {
                    whereParts.push(`Documento = '${cupomNumStr}'`);
                    whereParts.push(`Historico LIKE '%#${cupomNumStr}%'`);
                }
                if (params.interestKey) {
                    const intNum = parseInt(String(params.interestKey), 10);
                    if (!isNaN(intNum)) whereParts.push(`cdContaBaixa = ${intNum}`);
                }
                if (whereParts.length > 0) {
                    const reqSearch = new sql.Request(sqlTx);
                    const resSearch = await reqSearch.query(`
                        SELECT cdContaBaixa, cdBancoContaMovimento 
                        FROM tbContaBaixa 
                        WHERE ${whereParts.join(' OR ')}
                    `);
                    for (const r of resSearch.recordset || []) {
                        if (r.cdContaBaixa) targetContaBaixaIds.push(Number(r.cdContaBaixa));
                        if (r.cdBancoContaMovimento) targetMovIds.push(Number(r.cdBancoContaMovimento));
                    }
                }
            }

            // Buscar dados detalhados das tbContaBaixa a serem canceladas
            const targetContas: number[] = [];
            if (targetContaBaixaIds.length > 0) {
                const uniqueBaixaIds = Array.from(new Set(targetContaBaixaIds));
                const reqDetails = new sql.Request(sqlTx);
                const resDetails = await reqDetails.query(`
                    SELECT cb.cdContaBaixa, cb.cdBancoContaMovimento, cb.vlContaBaixa, cb.Documento,
                           cp.cdConta, cp.cdContaParcela
                    FROM tbContaBaixa cb
                    LEFT JOIN tbContaParcela cp ON cp.cdContaBaixa = cb.cdContaBaixa
                    WHERE cb.cdContaBaixa IN (${uniqueBaixaIds.join(',')})
                `);

                for (const row of resDetails.recordset || []) {
                    if (row.cdBancoContaMovimento) targetMovIds.push(Number(row.cdBancoContaMovimento));
                    if (row.cdConta) targetContas.push(Number(row.cdConta));
                    if (row.cdContaParcela) deletedContaParcelas.push(String(row.cdContaParcela));
                }

                // Excluir de tbContaParcela
                const reqDelParcela = new sql.Request(sqlTx);
                await reqDelParcela.query(`
                    IF OBJECT_ID('dbo.tbContaParcela', 'U') IS NOT NULL
                    BEGIN
                        UPDATE tbContaParcela SET cdBancoContaMovimento = NULL WHERE cdContaBaixa IN (${uniqueBaixaIds.join(',')});
                        DELETE FROM tbContaParcela WHERE cdContaBaixa IN (${uniqueBaixaIds.join(',')});
                    END
                `);
                logLines.push(`→ [tbContaParcela] Excluída(s) parcela(s) vinculada(s) à(s) baixa(s) #${uniqueBaixaIds.join(', #')}.`);

                // Excluir de tbContaBaixaConta
                const reqDelBaixaConta = new sql.Request(sqlTx);
                await reqDelBaixaConta.query(`
                    IF OBJECT_ID('dbo.tbContaBaixaConta', 'U') IS NOT NULL
                        DELETE FROM tbContaBaixaConta WHERE cdContaBaixa IN (${uniqueBaixaIds.join(',')});
                `);

                // Excluir de tbContaBaixa
                const reqDelBaixa = new sql.Request(sqlTx);
                await reqDelBaixa.query(`
                    IF OBJECT_ID('dbo.tbContaBaixa', 'U') IS NOT NULL
                    BEGIN
                        UPDATE tbContaBaixa SET cdBancoContaMovimento = NULL WHERE cdContaBaixa IN (${uniqueBaixaIds.join(',')});
                        DELETE FROM tbContaBaixa WHERE cdContaBaixa IN (${uniqueBaixaIds.join(',')});
                    END
                `);
                deletedContaBaixas.push(...uniqueBaixaIds);
                logLines.push(`✅ [tbContaBaixa] Baixa(s) #${uniqueBaixaIds.join(', #')} cancelada(s) e excluída(s) com sucesso.`);

                // Excluir tbConta órfã (se não houver mais parcelas)
                if (targetContas.length > 0) {
                    const uniqueContas = Array.from(new Set(targetContas));
                    for (const cdConta of uniqueContas) {
                        const reqCheckConta = new sql.Request(sqlTx);
                        reqCheckConta.input('cdConta', sql.Int, cdConta);
                        const resCheck = await reqCheckConta.query(`
                            SELECT COUNT(*) as remainingParc FROM tbContaParcela WHERE cdConta = @cdConta
                        `);
                        if ((resCheck.recordset?.[0]?.remainingParc || 0) === 0) {
                            const reqDelConta = new sql.Request(sqlTx);
                            reqDelConta.input('cdConta', sql.Int, cdConta);
                            await reqDelConta.query(`DELETE FROM tbConta WHERE cdConta = @cdConta`);
                            deletedContas.push(cdConta);
                            logLines.push(`→ [tbConta] Registro #${cdConta} removido pois não possui mais parcelas.`);
                        }
                    }
                }
            }

            // 2. Excluir / desvincular movimentações bancárias (tbBancoContaMovimento) associadas
            const uniqueMovsToDelete = Array.from(new Set(targetMovIds));
            for (const movId of uniqueMovsToDelete) {
                const reqDelMov = new sql.Request(sqlTx);
                reqDelMov.input('movId', sql.Int, movId);
                await reqDelMov.query(`
                    IF OBJECT_ID('dbo.tbContaParcela', 'U') IS NOT NULL
                    BEGIN
                        UPDATE tbContaParcela SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;
                        DELETE FROM tbContaParcela WHERE cdContaBaixa IN (SELECT cdContaBaixa FROM tbContaBaixa WHERE cdBancoContaMovimento = @movId);
                    END

                    IF OBJECT_ID('dbo.tbContaBaixaConta', 'U') IS NOT NULL
                        DELETE FROM tbContaBaixaConta WHERE cdContaBaixa IN (SELECT cdContaBaixa FROM tbContaBaixa WHERE cdBancoContaMovimento = @movId);

                    IF OBJECT_ID('dbo.tbContaBaixa', 'U') IS NOT NULL
                    BEGIN
                        UPDATE tbContaBaixa SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;
                        DELETE FROM tbContaBaixa WHERE cdBancoContaMovimento = @movId;
                    END

                    IF OBJECT_ID('dbo.tbCrediarioDeposito', 'U') IS NOT NULL
                        UPDATE tbCrediarioDeposito SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;

                    IF OBJECT_ID('dbo.tbValeCompra', 'U') IS NOT NULL
                    BEGIN
                        UPDATE tbValeCompra SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;
                        DELETE FROM tbValeCompra WHERE cdBancoContaMovimento = @movId;
                    END

                    IF OBJECT_ID('dbo.tbReceDespMovimento', 'U') IS NOT NULL
                        UPDATE tbReceDespMovimento SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;

                    IF OBJECT_ID('dbo.tbChequeMovimento', 'U') IS NOT NULL
                        UPDATE tbChequeMovimento SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;

                    IF OBJECT_ID('dbo.tbCartaoLoteMovimento', 'U') IS NOT NULL
                        UPDATE tbCartaoLoteMovimento SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;

                    DELETE FROM tbBancoContaMovimento WHERE cdBancoContaMovimento = @movId;
                `);
                deletedMovimentos.push(movId);
                logLines.push(`→ [tbBancoContaMovimento] Movimento #${movId} estornado/excluído com sucesso.`);
            }

            // 3. Se solicitado, também remover pagamentos de cupom (tbCrediarioCupomPagamento e tbCrediarioDeposito)
            let cdCrediarioCupomResolved: number | null = params.cdCrediarioCupom ? parseInt(String(params.cdCrediarioCupom), 10) : null;
            if (isNaN(cdCrediarioCupomResolved as number)) cdCrediarioCupomResolved = null;

            if (!cdCrediarioCupomResolved && cupomNumStr) {
                const reqFindCupom = new sql.Request(sqlTx);
                reqFindCupom.input('nrCupom', sql.VarChar, cupomNumStr);
                const resCup = await reqFindCupom.query(`
                    SELECT TOP 1 cdCrediarioCupom FROM tbCrediarioCupom WHERE nrCupom = @nrCupom ORDER BY cdCrediarioCupom DESC
                `);
                if (resCup.recordset?.[0]?.cdCrediarioCupom) {
                    cdCrediarioCupomResolved = resCup.recordset[0].cdCrediarioCupom;
                }
            }

            let updatedCupom: any = null;
            if (params.cancelCupomPayment !== false && cdCrediarioCupomResolved) {
                // Localizar pagamentos a serem removidos
                const reqPags = new sql.Request(sqlTx);
                reqPags.input('cdCrediarioCupom', sql.Int, cdCrediarioCupomResolved);
                const resPags = await reqPags.query(`
                    SELECT cdCrediarioCupom, nrPagamento, cdCrediarioDeposito, cdBancoContaMovimento
                    FROM tbCrediarioCupomPagamento
                    WHERE cdCrediarioCupom = @cdCrediarioCupom
                `);

                const pagsList = resPags.recordset || [];
                for (const p of pagsList) {
                    const reqDelP = new sql.Request(sqlTx);
                    reqDelP.input('cdCrediarioCupom', sql.Int, cdCrediarioCupomResolved);
                    reqDelP.input('nrPagamento', sql.Int, p.nrPagamento);
                    await reqDelP.query(`
                        DELETE FROM tbCrediarioCupomPagamento 
                        WHERE cdCrediarioCupom = @cdCrediarioCupom AND nrPagamento = @nrPagamento
                    `);
                    deletedPagamentos.push(p.nrPagamento);

                    if (p.cdCrediarioDeposito) {
                        const reqDelD = new sql.Request(sqlTx);
                        reqDelD.input('depId', sql.Int, p.cdCrediarioDeposito);
                        await reqDelD.query(`DELETE FROM tbCrediarioDeposito WHERE cdCrediarioDeposito = @depId`);
                        deletedDepositos.push(p.cdCrediarioDeposito);
                    }
                }

                // Recalcular tbCrediarioCupom
                const reqRecalc = new sql.Request(sqlTx);
                reqRecalc.input('cdCrediarioCupom', sql.Int, cdCrediarioCupomResolved);
                const resRecalc = await reqRecalc.query(`
                    UPDATE tbCrediarioCupom 
                    SET vlQuitado = (SELECT COALESCE(SUM(vlPago), 0) FROM tbCrediarioCupomPagamento WHERE cdCrediarioCupom = @cdCrediarioCupom),
                        nrPagamentos = (SELECT COUNT(*) FROM tbCrediarioCupomPagamento WHERE cdCrediarioCupom = @cdCrediarioCupom),
                        dtQuitado = CASE WHEN (SELECT COALESCE(SUM(vlPago), 0) FROM tbCrediarioCupomPagamento WHERE cdCrediarioCupom = @cdCrediarioCupom) >= vlCrediario 
                                         AND (SELECT COALESCE(SUM(vlPago), 0) FROM tbCrediarioCupomPagamento WHERE cdCrediarioCupom = @cdCrediarioCupom) > 0 
                                         THEN dtQuitado ELSE NULL END
                    WHERE cdCrediarioCupom = @cdCrediarioCupom;

                    SELECT cdCrediarioCupom, nrCupom, vlCrediario, vlQuitado, nrPagamentos, dtQuitado
                    FROM tbCrediarioCupom
                    WHERE cdCrediarioCupom = @cdCrediarioCupom;
                `);

                updatedCupom = resRecalc.recordset?.[0] || null;
                logLines.push(`✅ [tbCrediarioCupom] Cupom #${cdCrediarioCupomResolved} recalculado com sucesso (vlQuitado = R$ ${Number(updatedCupom?.vlQuitado || 0).toFixed(2)}, Pagamentos = ${updatedCupom?.nrPagamentos || 0}).`);
            }

            await sqlTx.commit();
            logLines.push(`[${new Date().toLocaleString('pt-BR')}] ✅ Transação concluída e comitada no Solidcon com sucesso.`);

            return {
                success: true,
                deletedContaBaixas,
                deletedContaParcelas,
                deletedContas,
                deletedMovimentos,
                deletedPagamentos,
                deletedDepositos,
                updatedCupom,
                logLines
            };
        } catch (err: any) {
            await sqlTx.rollback();
            logLines.push(`[ERRO NO CANCELAMENTO] ${err.message || String(err)}`);
            throw err;
        } finally {
            if (shouldClosePool && pool) {
                try { await pool.close(); } catch {}
            }
        }
    }

    static async fixSolidconDuplicates(config: {
        host?: string | null | undefined;
        database?: string | null | undefined;
        user?: string | null | undefined;
        password?: string | null | undefined;
    }, params: {
        cdCrediarioCupom?: number | string | null | undefined;
        nrCupom?: number | string | null | undefined;
        interestKey?: string | number | null | undefined;
        cdFilial?: string | number | null | undefined;
    }): Promise<{
        success: boolean;
        deletedPaymentsCount: number;
        deletedDepositsCount: number;
        deletedMovementsCount: number;
        finalVlQuitado: number;
        finalNrPagamentos: number;
        logLines: string[];
    }> {
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
            options: {
                encrypt: false,
                trustServerCertificate: true
            },
            connectionTimeout: 10000,
            requestTimeout: 15000
        };

        const pool = new sql.ConnectionPool(sqlConfig);
        await pool.connect();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();
            const logLines: string[] = [];
            const nowStr = new Date().toLocaleString('pt-BR');
            logLines.push(`[${nowStr}] 🛠️ Iniciando ajuste e consolidação de duplicidades no Solidcon...`);

            let cdCrediarioCupomResolved = params.cdCrediarioCupom ? parseInt(String(params.cdCrediarioCupom), 10) : null;
            if (isNaN(cdCrediarioCupomResolved as number)) cdCrediarioCupomResolved = null;

            // Resolve cdCrediarioCupom se fornecido apenas nrCupom ou se cdCrediarioCupom não foi encontrado diretamente
            if (cdCrediarioCupomResolved) {
                const reqCheck = new sql.Request(transaction);
                reqCheck.input('cdCrediarioCupom', sql.Int, cdCrediarioCupomResolved);
                const resCheck = await reqCheck.query(`SELECT TOP 1 cdCrediarioCupom FROM tbCrediarioCupom WHERE cdCrediarioCupom = @cdCrediarioCupom`);
                if (!resCheck.recordset?.[0]) {
                    // Tenta como nrCupom
                    const reqAsNr = new sql.Request(transaction);
                    reqAsNr.input('nrCupom', sql.Int, cdCrediarioCupomResolved);
                    const resAsNr = await reqAsNr.query(`SELECT TOP 1 cdCrediarioCupom FROM tbCrediarioCupom WHERE nrCupom = @nrCupom ORDER BY cdCrediarioCupom DESC`);
                    cdCrediarioCupomResolved = resAsNr.recordset?.[0]?.cdCrediarioCupom || null;
                }
            }

            if (!cdCrediarioCupomResolved && params.nrCupom) {
                const cupomNum = parseInt(String(params.nrCupom).replace(/\D/g, ''), 10);
                const nrCupomStr = String(params.nrCupom).trim();
                const reqFind = new sql.Request(transaction);
                reqFind.input('nrCupomStr', sql.VarChar, nrCupomStr);
                if (!isNaN(cupomNum)) {
                    reqFind.input('cupomNum', sql.BigInt, cupomNum);
                }
                const resFind = await reqFind.query(`
                    SELECT TOP 1 cdCrediarioCupom 
                    FROM tbCrediarioCupom 
                    WHERE nrCupom = @nrCupomStr ${!isNaN(cupomNum) ? 'OR nrCupom = @cupomNum OR TRY_CAST(nrCupom AS BIGINT) = @cupomNum' : ''}
                    ORDER BY cdCrediarioCupom DESC
                `);
                cdCrediarioCupomResolved = resFind.recordset?.[0]?.cdCrediarioCupom || null;
            }

            if (!cdCrediarioCupomResolved) {
                throw new Error('Não foi possível identificar o código do cupom no Solidcon (cdCrediarioCupom).');
            }

            // 1. Obter informações do cupom e pagamentos existentes
            const reqCupomInfo = new sql.Request(transaction);
            reqCupomInfo.input('cdCrediarioCupom', sql.Int, cdCrediarioCupomResolved);
            const resCupomInfo = await reqCupomInfo.query(`
                SELECT cdCrediarioCupom, nrCupom, cdFilial, cdPDV, vlCrediario, vlQuitado, nrPagamentos
                FROM tbCrediarioCupom
                WHERE cdCrediarioCupom = @cdCrediarioCupom
            `);
            const cupomRow = resCupomInfo.recordset?.[0];
            const cupomVal = Number(cupomRow?.vlCrediario || 0);

            const reqPags = new sql.Request(transaction);
            reqPags.input('cdCrediarioCupom', sql.Int, cdCrediarioCupomResolved);
            const resPags = await reqPags.query(`
                SELECT p.*, d.cdBancoContaMovimento
                FROM tbCrediarioCupomPagamento p
                LEFT JOIN tbCrediarioDeposito d ON d.cdCrediarioDeposito = p.cdCrediarioDeposito
                WHERE p.cdCrediarioCupom = @cdCrediarioCupom
                ORDER BY 
                    CASE WHEN p.cdUsuarioQuitou != '1' THEN 0 ELSE 1 END ASC,
                    p.dtPago ASC,
                    p.nrPagamento ASC
            `);

            const allPags: any[] = resPags.recordset || [];
            const totalPago = allPags.reduce((acc, p) => acc + Number(p.vlPago || 0), 0);
            const distinctPaymentNrs = new Set(allPags.map((p: any) => p.nrPagamento)).size;
            logLines.push(`→ Total de pagamentos encontrados em tbCrediarioCupomPagamento: ${allPags.length} (Soma: R$ ${totalPago.toFixed(2)} | Cupom: R$ ${cupomVal.toFixed(2)})`);

            let deletedPaymentsCount = 0;
            let deletedDepositsCount = 0;
            let deletedMovementsCount = 0;

            if (allPags.length > 1 && totalPago <= cupomVal + 0.05 && distinctPaymentNrs === allPags.length) {
                logLines.push(`ℹ️ Os ${allPags.length} pagamentos encontrados são parcelas/depósitos parciais legítimos que somam R$ ${totalPago.toFixed(2)} (100% condizente com o valor de R$ ${cupomVal.toFixed(2)} do cupom). Nenhum pagamento foi excluído.`);
            } else if (allPags.length > 1) {
                // Há duplicidade real (soma excede o cupom ou há nrPagamento duplicado)
                const seenPags = new Set<number>();
                let runningSum = 0;
                const duplicatePags: any[] = [];
                const validPags: any[] = [];

                for (const p of allPags) {
                    const nr = Number(p.nrPagamento || 0);
                    const val = Number(p.vlPago || 0);
                    if (seenPags.has(nr) || (cupomVal > 0 && runningSum + val > cupomVal + 0.05 && validPags.length > 0)) {
                        duplicatePags.push(p);
                    } else {
                        seenPags.add(nr);
                        runningSum += val;
                        validPags.push(p);
                    }
                }

                const validDepIds = new Set(validPags.map((v: any) => v.cdCrediarioDeposito).filter(Boolean));
                const validMovIds = new Set(validPags.map((v: any) => v.cdBancoContaMovimento).filter(Boolean));

                logLines.push(`→ Pagamentos preservados (${validPags.length}): ${validPags.map((v: any) => `#${v.nrPagamento} (R$ ${Number(v.vlPago).toFixed(2)})`).join(', ')}`);

                for (const dup of duplicatePags) {
                    logLines.push(`→ Removendo pagamento duplicado: Pagamento #${dup.nrPagamento} | Valor: R$ ${Number(dup.vlPago).toFixed(2)} | Obs: "${dup.Obs || ''}"`);

                    // 1. Exclui de tbCrediarioCupomPagamento
                    const reqDelPag = new sql.Request(transaction);
                    reqDelPag.input('cdCrediarioCupom', sql.Int, cdCrediarioCupomResolved);
                    reqDelPag.input('nrPagamento', sql.Int, dup.nrPagamento);
                    await reqDelPag.query(`
                        DELETE FROM tbCrediarioCupomPagamento 
                        WHERE cdCrediarioCupom = @cdCrediarioCupom AND nrPagamento = @nrPagamento
                    `);
                    deletedPaymentsCount++;

                    // 2. Exclui de tbCrediarioDeposito se não compartilhado com pagamentos válidos
                    if (dup.cdCrediarioDeposito && !validDepIds.has(dup.cdCrediarioDeposito)) {
                        const reqDelDep = new sql.Request(transaction);
                        reqDelDep.input('depId', sql.Int, dup.cdCrediarioDeposito);
                        await reqDelDep.query(`DELETE FROM tbCrediarioDeposito WHERE cdCrediarioDeposito = @depId`);
                        deletedDepositsCount++;
                        logLines.push(`  ↳ Depósito duplicado excluído [tbCrediarioDeposito]: ID ${dup.cdCrediarioDeposito}`);
                    }

                    // 3. Exclui de tbBancoContaMovimento se não compartilhado com pagamentos válidos
                    if (dup.cdBancoContaMovimento && !validMovIds.has(dup.cdBancoContaMovimento)) {
                        const reqDelMov = new sql.Request(transaction);
                        reqDelMov.input('movId', sql.Int, dup.cdBancoContaMovimento);
                        await reqDelMov.query(`
                            IF OBJECT_ID('dbo.tbContaParcela', 'U') IS NOT NULL
                            BEGIN
                                UPDATE tbContaParcela SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;
                                DELETE FROM tbContaParcela WHERE cdContaBaixa IN (SELECT cdContaBaixa FROM tbContaBaixa WHERE cdBancoContaMovimento = @movId);
                            END

                            IF OBJECT_ID('dbo.tbContaBaixaConta', 'U') IS NOT NULL
                                DELETE FROM tbContaBaixaConta WHERE cdContaBaixa IN (SELECT cdContaBaixa FROM tbContaBaixa WHERE cdBancoContaMovimento = @movId);

                            IF OBJECT_ID('dbo.tbContaBaixa', 'U') IS NOT NULL
                            BEGIN
                                UPDATE tbContaBaixa SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;
                                DELETE FROM tbContaBaixa WHERE cdBancoContaMovimento = @movId;
                            END

                            IF OBJECT_ID('dbo.tbCrediarioDeposito', 'U') IS NOT NULL
                            BEGIN
                                UPDATE tbCrediarioDeposito SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;
                                DELETE FROM tbCrediarioDeposito WHERE cdBancoContaMovimento = @movId;
                            END

                            IF OBJECT_ID('dbo.tbValeCompra', 'U') IS NOT NULL
                            BEGIN
                                UPDATE tbValeCompra SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;
                                DELETE FROM tbValeCompra WHERE cdBancoContaMovimento = @movId;
                            END

                            IF OBJECT_ID('dbo.tbReceDespMovimento', 'U') IS NOT NULL
                                UPDATE tbReceDespMovimento SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;

                            IF OBJECT_ID('dbo.tbChequeMovimento', 'U') IS NOT NULL
                                UPDATE tbChequeMovimento SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;

                            IF OBJECT_ID('dbo.tbCartaoLoteMovimento', 'U') IS NOT NULL
                                UPDATE tbCartaoLoteMovimento SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;

                            DELETE FROM tbBancoContaMovimento WHERE cdBancoContaMovimento = @movId;
                        `);
                        deletedMovementsCount++;
                        logLines.push(`  ↳ Movimentação bancária duplicada excluída [tbBancoContaMovimento]: ID ${dup.cdBancoContaMovimento}`);
                    }
                }
            } else if (allPags.length === 1) {
                logLines.push(`→ Apenas 1 pagamento registrado no cupom. Nenhuma linha de pagamento duplicada.`);
            } else {
                logLines.push(`→ Nenhum pagamento encontrado no cupom.`);
            }

            // 2. Recalcular tbCrediarioCupom
            const reqRecalc = new sql.Request(transaction);
            reqRecalc.input('cdCrediarioCupom', sql.Int, cdCrediarioCupomResolved);
            await reqRecalc.query(`
                UPDATE tbCrediarioCupom
                SET 
                    vlQuitado = ISNULL((SELECT SUM(vlPago) FROM tbCrediarioCupomPagamento WHERE cdCrediarioCupom = @cdCrediarioCupom), 0),
                    nrPagamentos = (SELECT COUNT(*) FROM tbCrediarioCupomPagamento WHERE cdCrediarioCupom = @cdCrediarioCupom)
                WHERE cdCrediarioCupom = @cdCrediarioCupom
            `);

            const reqFinal = new sql.Request(transaction);
            reqFinal.input('cdCrediarioCupom', sql.Int, cdCrediarioCupomResolved);
            const resFinal = await reqFinal.query(`
                SELECT vlCrediario, vlQuitado, nrPagamentos FROM tbCrediarioCupom WHERE cdCrediarioCupom = @cdCrediarioCupom
            `);
            const finalCupom = resFinal.recordset?.[0] || { vlQuitado: 0, nrPagamentos: 0 };
            logLines.push(`✅ [tbCrediarioCupom] Recalculado com sucesso: vlQuitado = R$ ${Number(finalCupom.vlQuitado || 0).toFixed(2)} | nrPagamentos = ${finalCupom.nrPagamentos || 0}`);

            await transaction.commit();
            logLines.push(`🎉 Consolidação no Solidcon finalizada com sucesso!`);

            return {
                success: true,
                deletedPaymentsCount,
                deletedDepositsCount,
                deletedMovementsCount,
                finalVlQuitado: Number(finalCupom.vlQuitado || 0),
                finalNrPagamentos: Number(finalCupom.nrPagamentos || 0),
                logLines
            };
        } catch (err: any) {
            await transaction.rollback();
            throw err;
        } finally {
            if (pool) {
                try {
                    await pool.close();
                } catch {
                    // ignore
                }
            }
        }
    }

    static async createSolidconContaBaixaForMovement(config: {
        host?: string | null | undefined;
        database?: string | null | undefined;
        user?: string | null | undefined;
        password?: string | null | undefined;
    }, params: {
        cdBancoContaMovimento: number | string;
        cdFilial?: number | string | null;
        cdEmpresa?: number | string | null;
        cdPessoaComercial?: number | string | null;
        valor?: number | null;
        documento?: string | null;
        historico?: string | null;
        dtLancamento?: Date | string | null;
        cdBancoConta?: number | string | null;
    }): Promise<{
        cdConta: number;
        cdContaBaixa: number;
        cdContaParcela: string;
        cdBancoContaMovimento: number;
        alreadyExisted: boolean;
        logLines: string[];
    }> {
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
            options: {
                encrypt: false,
                trustServerCertificate: true
            },
            connectionTimeout: 10000,
            requestTimeout: 15000
        };

        const pool = new sql.ConnectionPool(sqlConfig);
        await pool.connect();
        const transaction = new sql.Transaction(pool);
        const logLines: string[] = [];
        const nowStr = new Date().toLocaleString('pt-BR');
        logLines.push(`[${nowStr}] 🔗 Iniciando amarração de tbConta/tbContaBaixa para conciliação bancária...`);

        try {
            await transaction.begin();

            const movIdNum = parseInt(String(params.cdBancoContaMovimento), 10);
            if (isNaN(movIdNum)) throw new Error('Cód. Movimento Banco inválido.');

            // 1. Buscar movimento bancário
            const reqMov = new sql.Request(transaction);
            reqMov.input('cdBancoContaMovimento', sql.Int, movIdNum);
            const resMov = await reqMov.query(`
                SELECT TOP 1 * FROM tbBancoContaMovimento WHERE cdBancoContaMovimento = @cdBancoContaMovimento
            `);
            const mov = resMov.recordset?.[0];
            if (!mov) {
                throw new Error(`Movimento bancário #${movIdNum} não encontrado na tabela tbBancoContaMovimento.`);
            }

            logLines.push(`→ Movimento bancário #${movIdNum} localizado: Conta ${mov.cdBancoConta} | Valor: R$ ${Number(mov.vlDebito || mov.vlCredito || 0).toFixed(2)} | Data: ${mov.dtLancamento ? new Date(mov.dtLancamento).toLocaleDateString('pt-BR') : 'N/A'}`);

            // 2. Verificar se já existe tbContaBaixa vinculada
            const reqCheck = new sql.Request(transaction);
            reqCheck.input('cdBancoContaMovimento', sql.Int, movIdNum);
            const resCheck = await reqCheck.query(`
                SELECT cb.cdContaBaixa, cb.cdPessoaFilialContaBaixa, cp.cdConta, cp.cdContaParcela
                FROM tbContaBaixa cb
                LEFT JOIN tbContaParcela cp ON cp.cdContaBaixa = cb.cdContaBaixa
                WHERE cb.cdBancoContaMovimento = @cdBancoContaMovimento
                   OR cp.cdBancoContaMovimento = @cdBancoContaMovimento
            `);

            if (resCheck.recordset?.[0]?.cdContaBaixa && resCheck.recordset?.[0]?.cdConta) {
                const existing = resCheck.recordset[0];
                logLines.push(`ℹ️ O movimento bancário #${movIdNum} já possui amarração existente (tbConta #${existing.cdConta}, tbContaBaixa #${existing.cdContaBaixa}).`);
                await transaction.commit();
                return {
                    cdConta: Number(existing.cdConta),
                    cdContaBaixa: Number(existing.cdContaBaixa),
                    cdContaParcela: String(existing.cdContaParcela || '1 '),
                    cdBancoContaMovimento: movIdNum,
                    alreadyExisted: true,
                    logLines
                };
            }

            // Resolver dados para inserção
            const rawFilial = params.cdFilial || mov.cdPessoaFilialBancoConta || 1;
            const cdFilial = parseInt(String(rawFilial).split(',')[0] ?? '1', 10) || 1;
            const cdBancoConta = params.cdBancoConta || mov.cdBancoConta || 1;
            const valor = (params.valor !== null && params.valor !== undefined && !isNaN(Number(params.valor)) && Number(params.valor) > 0)
                ? Number(params.valor)
                : Number(mov.vlDebito || mov.vlCredito || 0);
            const dtBaixa = params.dtLancamento ? new Date(params.dtLancamento) : (mov.dtLancamento ? new Date(mov.dtLancamento) : new Date());
            const doc = String(params.documento || mov.Numero || '').trim() || String(movIdNum);
            const hist = String(params.historico || mov.Historico || 'Recebimento Crediario').trim().substring(0, 80);
            const cdEmpresaHint = params.cdEmpresa ? parseInt(String(params.cdEmpresa), 10) : 10;
            const cdPessoaComercialHint = params.cdPessoaComercial ? parseInt(String(params.cdPessoaComercial), 10) : 1;

            let cdEmpresaResolved = 10;
            let cdPessoaComercialResolved = 1;
            const resPessCheck = await transaction.request()
                .input('empHint', sql.Int, cdEmpresaHint)
                .input('pessHint', sql.Int, cdPessoaComercialHint)
                .query(`
                    SELECT TOP 1 cdEmpresa, cdPessoaComercial 
                    FROM tbPessoaComercial 
                    ORDER BY CASE WHEN cdEmpresa = @empHint AND cdPessoaComercial = @pessHint THEN 0
                                  WHEN cdPessoaComercial = @pessHint THEN 1
                                  WHEN cdPessoaComercial = 1 THEN 2
                                  ELSE 3 END, cdEmpresa ASC
                `);
            if (resPessCheck.recordset?.[0]) {
                cdEmpresaResolved = resPessCheck.recordset[0].cdEmpresa;
                cdPessoaComercialResolved = resPessCheck.recordset[0].cdPessoaComercial;
            }

            // 3. Inserir tbConta (Tipo 4 = Receita)
            const reqConta = new sql.Request(transaction);
            reqConta.input('cdFilial', sql.Int, cdFilial);
            reqConta.input('cdEmpresa', sql.TinyInt, cdEmpresaResolved);
            reqConta.input('cdPessoaComercial', sql.Int, cdPessoaComercialResolved);
            reqConta.input('Documento', sql.VarChar, doc.substring(0, 12));
            reqConta.input('dtInclusao', sql.DateTime, dtBaixa);

            const resConta = await reqConta.query(`
                INSERT INTO tbConta (
                    cdPessoaFilialConta, cdEmpresa, cdPessoaComercial, cdContaTipo, Documento, cdPagamentoTipo, dtInclusao, inNaoInformaNoReinf, XmlNFSe
                ) VALUES (
                    @cdFilial, @cdEmpresa, @cdPessoaComercial, 4, @Documento, 0, @dtInclusao, NULL, NULL
                );
                SELECT SCOPE_IDENTITY() AS insertId;
            `);
            let cdConta = resConta.recordset?.[0]?.insertId;
            if (!cdConta) {
                const resF = await transaction.request().query('SELECT TOP 1 cdConta FROM tbConta ORDER BY cdConta DESC');
                cdConta = resF.recordset?.[0]?.cdConta;
            }
            logLines.push(`✅ Registro inserido em tbConta: ID #${cdConta} (Tipo: Receita, Doc: ${doc.substring(0, 12)})`);

            // 4. Inserir tbContaBaixa
            const reqBaixa = new sql.Request(transaction);
            reqBaixa.input('cdFilial', sql.Int, cdFilial);
            reqBaixa.input('cdBancoConta', sql.Int, parseInt(String(cdBancoConta), 10) || 1);
            reqBaixa.input('cdBancoContaMovimento', sql.Int, movIdNum);
            reqBaixa.input('dtContaBaixa', sql.DateTime, dtBaixa);
            reqBaixa.input('vlContaBaixa', sql.Money, valor);
            reqBaixa.input('Documento', sql.VarChar, doc.substring(0, 10));
            reqBaixa.input('Historico', sql.VarChar, hist);

            const resBaixa = await reqBaixa.query(`
                INSERT INTO tbContaBaixa (
                    cdPessoaFilialContaBaixa, cdPessoaFilialBancoConta, cdBancoConta, cdBancoContaMovimento,
                    dtContaBaixa, vlContaBaixa, Documento, inRecebimento, Historico, cdPagamentoTipo, inAvista
                ) VALUES (
                    @cdFilial, @cdFilial, @cdBancoConta, @cdBancoContaMovimento,
                    @dtContaBaixa, @vlContaBaixa, @Documento, 1, @Historico, 0, 1
                );
                SELECT SCOPE_IDENTITY() AS insertId;
            `);
            let cdContaBaixa = resBaixa.recordset?.[0]?.insertId;
            if (!cdContaBaixa) {
                const resF = await transaction.request().query('SELECT TOP 1 cdContaBaixa FROM tbContaBaixa ORDER BY cdContaBaixa DESC');
                cdContaBaixa = resF.recordset?.[0]?.cdContaBaixa;
            }
            logLines.push(`✅ Registro inserido em tbContaBaixa: ID #${cdContaBaixa} (Valor: R$ ${valor.toFixed(2)}, inRecebimento: 1, Movimento: #${movIdNum})`);

            // 5. Inserir tbContaParcela
            const reqParcela = new sql.Request(transaction);
            reqParcela.input('cdFilial', sql.Int, cdFilial);
            reqParcela.input('cdConta', sql.Int, cdConta);
            reqParcela.input('cdContaBaixa', sql.Int, cdContaBaixa);
            reqParcela.input('dtParcela', sql.DateTime, dtBaixa);
            reqParcela.input('vlParcela', sql.Money, valor);
            reqParcela.input('Historico', sql.VarChar, hist);
            reqParcela.input('cdBancoContaMovimento', sql.Int, movIdNum);

            await reqParcela.query(`
                INSERT INTO tbContaParcela (
                    cdPessoaFilialConta, cdConta, cdContaParcela, cdPessoaFilialContaBaixa, cdContaBaixa,
                    cdIndice, dtParcela, vlParcela, vlMulta, vlMora, vlDesconto, inBoleto, Historico,
                    dtCompetencia, cdBancoContaMovimento, CNPJFactoring, vlTarifaBoletoBanco,
                    dtParcelaOriginal, vlParcelaOriginal, inEnviadoIntegrador
                ) VALUES (
                    @cdFilial, @cdConta, '1 ', @cdFilial, @cdContaBaixa,
                    NULL, @dtParcela, @vlParcela, 0, 0, 0, 0, @Historico,
                    @dtParcela, @cdBancoContaMovimento, '', 0,
                    @dtParcela, @vlParcela, 0
                );
            `);
            logLines.push(`✅ Registro inserido em tbContaParcela: Conta #${cdConta} | Parcela #1 | Baixa #${cdContaBaixa} | Movimento #${movIdNum}`);

            await transaction.commit();
            logLines.push(`🎉 Amarração concluída com sucesso! O movimento #${movIdNum} agora está 100% pronto para conciliação no extrato bancário do Solidcon.`);

            return {
                cdConta: Number(cdConta),
                cdContaBaixa: Number(cdContaBaixa),
                cdContaParcela: '1 ',
                cdBancoContaMovimento: movIdNum,
                alreadyExisted: false,
                logLines
            };
        } catch (err: any) {
            await transaction.rollback();
            throw err;
        } finally {
            if (pool) {
                try {
                    await pool.close();
                } catch {
                    // ignore
                }
            }
        }
    }

    static async scanUntiedSolidconMovements(config: {
        host?: string | null | undefined;
        database?: string | null | undefined;
        user?: string | null | undefined;
        password?: string | null | undefined;
    }, params?: {
        cdFilial?: number | string | null | undefined;
        startDate?: string | null | undefined;
        limit?: number | null | undefined;
    }): Promise<{
        totalUntied: number;
        depositsCount: number;
        movementsCount: number;
        items: Array<{
            cdBancoContaMovimento: number;
            cdCrediarioDeposito?: number;
            cdFilial: number;
            cdBancoConta: number;
            valor: number;
            dtLancamento: string;
            numero?: string;
            historico?: string;
            nrCupom?: string;
            source: 'deposito' | 'movimento';
        }>;
    }> {
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
            options: {
                encrypt: false,
                trustServerCertificate: true
            },
            connectionTimeout: 10000,
            requestTimeout: 20000
        };

        const pool = new sql.ConnectionPool(sqlConfig);
        await pool.connect();

        try {
            const limit = params?.limit || 1000;
            const reqDep = new sql.Request(pool);
            reqDep.input('limit', sql.Int, limit);

            // 1. Untied from tbCrediarioDeposito
            const resDep = await reqDep.query(`
                SELECT TOP (@limit)
                    d.cdCrediarioDeposito,
                    d.cdPessoaFilialDeposito,
                    d.cdBancoConta,
                    d.cdBancoContaMovimento,
                    ISNULL(d.vlQuitado, d.vlPago) AS valor,
                    d.dtDeposito,
                    m.Numero,
                    m.Historico,
                    m.dtLancamento,
                    m.cdPessoaFilialBancoConta,
                    (SELECT TOP 1 c.nrCupom FROM tbCrediarioCupomPagamento p JOIN tbCrediarioCupom c ON c.cdCrediarioCupom = p.cdCrediarioCupom WHERE p.cdCrediarioDeposito = d.cdCrediarioDeposito) AS nrCupomExemplo,
                    (SELECT COUNT(*) FROM tbCrediarioCupomPagamento p WHERE p.cdCrediarioDeposito = d.cdCrediarioDeposito) AS qtPagamentos
                FROM tbCrediarioDeposito d
                INNER JOIN tbBancoContaMovimento m ON m.cdBancoContaMovimento = d.cdBancoContaMovimento
                LEFT JOIN tbContaBaixa cb ON cb.cdBancoContaMovimento = d.cdBancoContaMovimento
                LEFT JOIN tbContaParcela cp ON cp.cdBancoContaMovimento = d.cdBancoContaMovimento
                WHERE d.cdBancoContaMovimento IS NOT NULL
                  AND (cb.cdContaBaixa IS NULL OR cp.cdConta IS NULL)
                ORDER BY d.dtDeposito DESC
            `);

            // 2. Untied from tbBancoContaMovimento
            const reqMov = new sql.Request(pool);
            reqMov.input('limit', sql.Int, limit);
            const resMov = await reqMov.query(`
                SELECT TOP (@limit)
                    m.cdBancoContaMovimento,
                    m.cdBancoConta,
                    m.cdPessoaFilialBancoConta,
                    m.dtLancamento,
                    ISNULL(m.vlDebito, m.vlCredito) AS valor,
                    m.Numero,
                    m.Historico
                FROM tbBancoContaMovimento m
                LEFT JOIN tbContaBaixa cb ON cb.cdBancoContaMovimento = m.cdBancoContaMovimento
                LEFT JOIN tbContaParcela cp ON cp.cdBancoContaMovimento = m.cdBancoContaMovimento
                WHERE (cb.cdContaBaixa IS NULL OR cp.cdConta IS NULL)
                  AND (
                    m.Historico LIKE '%Dep. de Cred.%' 
                    OR m.Historico LIKE '%Crediario%' 
                    OR m.Historico LIKE '%Juros de conv%'
                    OR m.Historico LIKE '%Recebimento%'
                  )
                ORDER BY m.dtLancamento DESC
            `);

            const seenMovIds = new Set<number>();
            const items: any[] = [];

            for (const r of resDep.recordset || []) {
                const movId = Number(r.cdBancoContaMovimento);
                if (seenMovIds.has(movId)) continue;
                seenMovIds.add(movId);
                items.push({
                    cdBancoContaMovimento: movId,
                    cdCrediarioDeposito: r.cdCrediarioDeposito ? Number(r.cdCrediarioDeposito) : undefined,
                    cdFilial: Number(r.cdPessoaFilialBancoConta || r.cdPessoaFilialDeposito || 1),
                    cdBancoConta: Number(r.cdBancoConta || 1),
                    valor: Number(r.valor || 0),
                    dtLancamento: r.dtLancamento ? new Date(r.dtLancamento).toISOString() : (r.dtDeposito ? new Date(r.dtDeposito).toISOString() : new Date().toISOString()),
                    numero: r.Numero ? String(r.Numero).trim() : undefined,
                    historico: r.Historico ? String(r.Historico).trim() : undefined,
                    nrCupom: r.nrCupomExemplo ? String(r.nrCupomExemplo).trim() : undefined,
                    source: 'deposito'
                });
            }

            for (const r of resMov.recordset || []) {
                const movId = Number(r.cdBancoContaMovimento);
                if (seenMovIds.has(movId)) continue;
                seenMovIds.add(movId);
                items.push({
                    cdBancoContaMovimento: movId,
                    cdFilial: Number(r.cdPessoaFilialBancoConta || 1),
                    cdBancoConta: Number(r.cdBancoConta || 1),
                    valor: Number(r.valor || 0),
                    dtLancamento: r.dtLancamento ? new Date(r.dtLancamento).toISOString() : new Date().toISOString(),
                    numero: r.Numero ? String(r.Numero).trim() : undefined,
                    historico: r.Historico ? String(r.Historico).trim() : undefined,
                    source: 'movimento'
                });
            }

            return {
                totalUntied: items.length,
                depositsCount: (resDep.recordset || []).length,
                movementsCount: (resMov.recordset || []).length,
                items
            };
        } finally {
            try {
                await pool.close();
            } catch {
                // ignore
            }
        }
    }

    static async tieAllUntiedSolidconMovements(config: {
        host?: string | null | undefined;
        database?: string | null | undefined;
        user?: string | null | undefined;
        password?: string | null | undefined;
    }, params?: {
        cdFilial?: number | string | null | undefined;
        cdEmpresa?: number | string | null | undefined;
        limit?: number | null | undefined;
        specificMovementIds?: number[] | undefined;
    }): Promise<{
        totalFound: number;
        totalTied: number;
        alreadyTied: number;
        errorsCount: number;
        items: Array<{
            cdBancoContaMovimento: number;
            cdConta?: number;
            cdContaBaixa?: number;
            cdContaParcela?: string;
            documento?: string;
            valor?: number;
            dtLancamento?: string;
            historico?: string;
            status: 'tied' | 'already_tied' | 'error';
            error?: string;
        }>;
        logLines: string[];
    }> {
        const scan = await this.scanUntiedSolidconMovements(config, {
            cdFilial: params?.cdFilial,
            limit: params?.limit || 1000
        });

        let toProcess = scan.items;
        if (params?.specificMovementIds && params.specificMovementIds.length > 0) {
            const allowed = new Set(params.specificMovementIds);
            toProcess = toProcess.filter(i => allowed.has(i.cdBancoContaMovimento));
        }

        const logLines: string[] = [];
        const nowStr = new Date().toLocaleString('pt-BR');
        logLines.push(`[${nowStr}] 🔗 Iniciando amarração contábil em lote de ${toProcess.length} movimento(s) no Solidcon...`);

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
            options: {
                encrypt: false,
                trustServerCertificate: true
            },
            connectionTimeout: 10000,
            requestTimeout: 20000
        };

        const pool = new sql.ConnectionPool(sqlConfig);
        await pool.connect();

        let totalTied = 0;
        let alreadyTied = 0;
        let errorsCount = 0;
        const itemsResult: any[] = [];

        try {
            // Resolve Pessoa Comercial / Empresa
            let cdEmpresaResolved = 10;
            let cdPessoaComercialResolved = 1;
            const resPessCheck = await pool.request()
                .input('empHint', sql.Int, params?.cdEmpresa || 10)
                .input('pessHint', sql.Int, 1)
                .query(`
                    SELECT TOP 1 cdEmpresa, cdPessoaComercial 
                    FROM tbPessoaComercial 
                    ORDER BY CASE WHEN cdEmpresa = @empHint AND cdPessoaComercial = @pessHint THEN 0
                                  WHEN cdPessoaComercial = @pessHint THEN 1
                                  WHEN cdPessoaComercial = 1 THEN 2
                                  ELSE 3 END, cdEmpresa ASC
                `);
            if (resPessCheck.recordset?.[0]) {
                cdEmpresaResolved = resPessCheck.recordset[0].cdEmpresa;
                cdPessoaComercialResolved = resPessCheck.recordset[0].cdPessoaComercial;
            }

            for (const item of toProcess) {
                const movIdNum = item.cdBancoContaMovimento;
                try {
                    // Check if already tied
                    const reqCheck = new sql.Request(pool);
                    reqCheck.input('cdBancoContaMovimento', sql.Int, movIdNum);
                    const resCheck = await reqCheck.query(`
                        SELECT TOP 1 cb.cdContaBaixa, cp.cdConta, cp.cdContaParcela
                        FROM tbContaBaixa cb
                        LEFT JOIN tbContaParcela cp ON cp.cdContaBaixa = cb.cdContaBaixa
                        WHERE cb.cdBancoContaMovimento = @cdBancoContaMovimento
                           OR cp.cdBancoContaMovimento = @cdBancoContaMovimento
                    `);

                    if (resCheck.recordset?.[0]?.cdContaBaixa && resCheck.recordset?.[0]?.cdConta) {
                        const existing = resCheck.recordset[0];
                        alreadyTied++;
                        itemsResult.push({
                            cdBancoContaMovimento: movIdNum,
                            cdConta: Number(existing.cdConta),
                            cdContaBaixa: Number(existing.cdContaBaixa),
                            cdContaParcela: String(existing.cdContaParcela || '1 '),
                            documento: item.nrCupom || item.numero || String(movIdNum),
                            valor: item.valor,
                            dtLancamento: item.dtLancamento,
                            historico: item.historico,
                            status: 'already_tied'
                        });
                        continue;
                    }

                    const cdFilial = item.cdFilial || 1;
                    const cdBancoConta = item.cdBancoConta || 1;
                    const valor = item.valor || 0;
                    const dtBaixa = item.dtLancamento ? new Date(item.dtLancamento) : new Date();
                    const doc = (item.nrCupom || item.numero || String(movIdNum)).trim();
                    const hist = (item.historico || 'Recebimento Crediario').substring(0, 80);

                    // Execute all 3 inserts atomically in a single SQL statement batch
                    const reqInsert = new sql.Request(pool);
                    reqInsert.input('cdFilial', sql.Int, cdFilial);
                    reqInsert.input('cdEmpresa', sql.TinyInt, cdEmpresaResolved);
                    reqInsert.input('cdPessoaComercial', sql.Int, cdPessoaComercialResolved);
                    reqInsert.input('Documento', sql.VarChar, doc.substring(0, 12));
                    reqInsert.input('dtInclusao', sql.DateTime, dtBaixa);
                    reqInsert.input('cdBancoConta', sql.Int, parseInt(String(cdBancoConta), 10) || 1);
                    reqInsert.input('cdBancoContaMovimento', sql.Int, movIdNum);
                    reqInsert.input('dtContaBaixa', sql.DateTime, dtBaixa);
                    reqInsert.input('vlContaBaixa', sql.Money, valor);
                    reqInsert.input('docBaixa', sql.VarChar, doc.substring(0, 10));
                    reqInsert.input('Historico', sql.VarChar, hist);
                    reqInsert.input('dtParcela', sql.DateTime, dtBaixa);
                    reqInsert.input('vlParcela', sql.Money, valor);

                    const resBatch = await reqInsert.query(`
                        BEGIN TRANSACTION;
                        BEGIN TRY
                            INSERT INTO tbConta (
                                cdPessoaFilialConta, cdEmpresa, cdPessoaComercial, cdContaTipo, Documento, cdPagamentoTipo, dtInclusao, inNaoInformaNoReinf, XmlNFSe
                            ) VALUES (
                                @cdFilial, @cdEmpresa, @cdPessoaComercial, 4, @Documento, 0, @dtInclusao, NULL, NULL
                            );
                            DECLARE @newCdConta INT = SCOPE_IDENTITY();
                            IF @newCdConta IS NULL
                                SELECT TOP 1 @newCdConta = cdConta FROM tbConta ORDER BY cdConta DESC;

                            INSERT INTO tbContaBaixa (
                                cdPessoaFilialContaBaixa, cdPessoaFilialBancoConta, cdBancoConta, cdBancoContaMovimento,
                                dtContaBaixa, vlContaBaixa, Documento, inRecebimento, Historico, cdPagamentoTipo, inAvista
                            ) VALUES (
                                @cdFilial, @cdFilial, @cdBancoConta, @cdBancoContaMovimento,
                                @dtContaBaixa, @vlContaBaixa, @docBaixa, 1, @Historico, 0, 1
                            );
                            DECLARE @newCdContaBaixa INT = SCOPE_IDENTITY();
                            IF @newCdContaBaixa IS NULL
                                SELECT TOP 1 @newCdContaBaixa = cdContaBaixa FROM tbContaBaixa ORDER BY cdContaBaixa DESC;

                            INSERT INTO tbContaParcela (
                                cdPessoaFilialConta, cdConta, cdContaParcela, cdPessoaFilialContaBaixa, cdContaBaixa,
                                cdIndice, dtParcela, vlParcela, vlMulta, vlMora, vlDesconto, inBoleto, Historico,
                                dtCompetencia, cdBancoContaMovimento, CNPJFactoring, vlTarifaBoletoBanco,
                                dtParcelaOriginal, vlParcelaOriginal, inEnviadoIntegrador
                            ) VALUES (
                                @cdFilial, @newCdConta, '1 ', @cdFilial, @newCdContaBaixa,
                                NULL, @dtParcela, @vlParcela, 0, 0, 0, 0, @Historico,
                                @dtParcela, @cdBancoContaMovimento, '', 0,
                                @dtParcela, @vlParcela, 0
                            );

                            COMMIT TRANSACTION;
                            SELECT @newCdConta AS cdConta, @newCdContaBaixa AS cdContaBaixa;
                        END TRY
                        BEGIN CATCH
                            IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
                            THROW;
                        END CATCH;
                    `);

                    const row = resBatch.recordset?.[0];
                    const cdConta = row?.cdConta;
                    const cdContaBaixa = row?.cdContaBaixa;

                    totalTied++;
                    itemsResult.push({
                        cdBancoContaMovimento: movIdNum,
                        cdConta: Number(cdConta),
                        cdContaBaixa: Number(cdContaBaixa),
                        cdContaParcela: '1 ',
                        documento: doc,
                        valor: valor,
                        dtLancamento: item.dtLancamento,
                        historico: hist,
                        status: 'tied'
                    });
                    logLines.push(`✅ Movimento #${movIdNum} amarrado com sucesso (tbConta #${cdConta}, tbContaBaixa #${cdContaBaixa}, Doc: ${doc}).`);
                } catch (itemErr: any) {
                    errorsCount++;
                    itemsResult.push({
                        cdBancoContaMovimento: movIdNum,
                        documento: item.nrCupom || item.numero || String(movIdNum),
                        valor: item.valor,
                        dtLancamento: item.dtLancamento,
                        historico: item.historico,
                        status: 'error',
                        error: itemErr?.message || String(itemErr)
                    });
                    logLines.push(`❌ Erro ao amarrar movimento #${movIdNum}: ${itemErr?.message || itemErr}`);
                }
            }

            logLines.push(`🏁 Processamento finalizado: ${totalTied} amarrado(s) agora, ${alreadyTied} já estavam amarrados, ${errorsCount} erro(s).`);

            return {
                totalFound: toProcess.length,
                totalTied,
                alreadyTied,
                errorsCount,
                items: itemsResult,
                logLines
            };
        } finally {
            try {
                await pool.close();
            } catch {
                // ignore
            }
        }
    }

    static async getSolidconDetailedExpenseInspection(config: {
        host?: string | null | undefined;
        database?: string | null | undefined;
        user?: string | null | undefined;
        password?: string | null | undefined;
    }, params: {
        cdConta?: number | string | null | undefined;
        documento?: string | null | undefined;
        supplierCpfCnpj?: string | null | undefined;
        cdFilial?: string | number | null | undefined;
        transaction?: any;
    }): Promise<{
        conta: any | null;
        contas: any[];
        contaParcelas: any[];
        contaBaixas: any[];
        bankMovements: any[];
        tableIds: {
            tbConta: number | string | null;
            tbContaParcela: any[];
            tbContaBaixa: any[];
            tbBancoContaMovimento: any[];
        };
        hasDuplicates: boolean;
        duplicateAnalysis: {
            hasDuplicates: boolean;
            duplicateBaixaCount: number;
            duplicateMovementCount: number;
            reasons: string[];
        };
        duplicateReasons: string[];
        logLines: string[];
    }> {
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
            options: {
                encrypt: false,
                trustServerCertificate: true
            },
            connectionTimeout: 10000,
            requestTimeout: 15000
        };

        const pool = new sql.ConnectionPool(sqlConfig);
        await pool.connect();

        try {
            const logLines: string[] = [];
            const nowStr = new Date().toLocaleString('pt-BR');
            logLines.push(`[${nowStr}] 🔍 Iniciando consulta de despesa no banco Solidcon (${server}/${config.database})...`);

            let cdContaResolved: number | null = params.cdConta ? parseInt(String(params.cdConta), 10) : null;
            if (isNaN(cdContaResolved as number)) cdContaResolved = null;

            let documentoResolved: string | null = params.documento ? String(params.documento).trim() : null;
            if (!documentoResolved && params.transaction?.description) {
                const desc = String(params.transaction.description);
                const matchDoc = desc.match(/(?:doc|nf|fatura|titulo|cupom|duplicata|pedido)?\s*#?\s*(\d+)/i);
                if (matchDoc && matchDoc[1]) {
                    documentoResolved = matchDoc[1];
                }
            }
            if (!documentoResolved && params.transaction?.solidcon_key && /^\d+$/.test(String(params.transaction.solidcon_key).trim())) {
                documentoResolved = String(params.transaction.solidcon_key).trim();
            }

            // 1. Consultar tbConta
            let contaRow: any = null;
            const allContas: any[] = [];

            // Tentativa 1: Buscar por cdConta (PK)
            if (cdContaResolved) {
                const reqConta = pool.request();
                reqConta.input('cdConta', sql.Int, cdContaResolved);
                const resConta = await reqConta.query(`
                    SELECT TOP 1 c.*
                    FROM tbConta c
                    WHERE c.cdConta = @cdConta
                `);
                contaRow = resConta.recordset?.[0] || null;
                if (contaRow) allContas.push(contaRow);
            }

            // Tentativa 2: Buscar por Documento (com e sem filtro de filial)
            if (!contaRow && (documentoResolved || cdContaResolved)) {
                const searchDoc = documentoResolved || String(cdContaResolved);
                const docNum = parseInt(searchDoc.replace(/\D/g, ''), 10);
                const docPadded6 = searchDoc.padStart(6, '0');
                const docPadded8 = searchDoc.padStart(8, '0');

                const reqDoc = pool.request();
                reqDoc.input('searchDoc', sql.VarChar, searchDoc);
                reqDoc.input('docPadded6', sql.VarChar, docPadded6);
                reqDoc.input('docPadded8', sql.VarChar, docPadded8);
                if (!isNaN(docNum)) {
                    reqDoc.input('docNum', sql.BigInt, docNum);
                }

                let filialFilter = '';
                if (params.cdFilial) {
                    reqDoc.input('cdFilial', sql.Int, parseInt(String(params.cdFilial), 10));
                    filialFilter = ' AND (c.cdPessoaFilialConta = @cdFilial OR c.cdPessoaFilialConta IS NULL) ';
                }

                const resDoc = await reqDoc.query(`
                    SELECT TOP 5 c.*
                    FROM tbConta c
                    WHERE (
                        c.Documento = @searchDoc
                        OR c.Documento = @docPadded6
                        OR c.Documento = @docPadded8
                        ${!isNaN(docNum) ? 'OR c.Documento = CAST(@docNum AS VARCHAR(50))' : ''}
                        OR c.Documento LIKE '%' + @searchDoc
                    ) ${filialFilter}
                    ORDER BY c.cdConta DESC
                `);
                const docRows = resDoc.recordset || [];
                if (docRows.length > 0) {
                    contaRow = docRows[0];
                    allContas.push(...docRows);
                }

                if (!contaRow && filialFilter) {
                    const reqDocNoFilial = pool.request();
                    reqDocNoFilial.input('searchDoc', sql.VarChar, searchDoc);
                    reqDocNoFilial.input('docPadded6', sql.VarChar, docPadded6);
                    reqDocNoFilial.input('docPadded8', sql.VarChar, docPadded8);
                    if (!isNaN(docNum)) {
                        reqDocNoFilial.input('docNum', sql.BigInt, docNum);
                    }

                    const resDocNoFilial = await reqDocNoFilial.query(`
                        SELECT TOP 5 c.*
                        FROM tbConta c
                        WHERE (
                            c.Documento = @searchDoc
                            OR c.Documento = @docPadded6
                            OR c.Documento = @docPadded8
                            ${!isNaN(docNum) ? 'OR c.Documento = CAST(@docNum AS VARCHAR(50))' : ''}
                            OR c.Documento LIKE '%' + @searchDoc
                        )
                        ORDER BY c.cdConta DESC
                    `);
                    const noFilialRows = resDocNoFilial.recordset || [];
                    if (noFilialRows.length > 0) {
                        contaRow = noFilialRows[0];
                        allContas.push(...noFilialRows);
                    }
                }
            }

            if (contaRow) {
                cdContaResolved = contaRow.cdConta;
                if (!documentoResolved && contaRow.Documento) {
                    documentoResolved = String(contaRow.Documento);
                }
                const dtIncStr = contaRow.dtInclusao ? new Date(contaRow.dtInclusao).toLocaleDateString('pt-BR') : '-';
                logLines.push(`→ [tbConta] Encontrado ID: #${contaRow.cdConta} | Documento: "${contaRow.Documento || '-'}" | Filial: ${contaRow.cdPessoaFilialConta || '-'} | Cód. Fornecedor: ${contaRow.cdPessoaComercial || '-'} | Inclusão: ${dtIncStr} | Tipo: ${contaRow.cdContaTipo || 'Despesa'}`);
            } else {
                logLines.push(`⚠️ [tbConta] Nenhum registro encontrado para ID: ${cdContaResolved || 'N/A'} / Documento: "${documentoResolved || 'N/A'}"`);
            }

            const foundContaIds = Array.from(new Set(allContas.map((c: any) => c.cdConta).filter(Boolean)));
            if (cdContaResolved && !foundContaIds.includes(cdContaResolved)) {
                foundContaIds.push(cdContaResolved);
            }

            // 2. Consultar tbContaParcela
            const contaParcelas: any[] = [];
            const baixaIds: number[] = [];
            const movIds: number[] = [];

            if (foundContaIds.length > 0) {
                const resParc = await pool.request().query(`
                    SELECT cp.* 
                    FROM tbContaParcela cp
                    WHERE cp.cdConta IN (${foundContaIds.join(',')})
                    ORDER BY cp.cdContaParcela ASC
                `);
                for (const cp of resParc.recordset || []) {
                    contaParcelas.push(cp);
                    if (cp.cdContaBaixa) baixaIds.push(Number(cp.cdContaBaixa));
                    if (cp.cdBancoContaMovimento) movIds.push(Number(cp.cdBancoContaMovimento));
                    const dtVencStr = cp.dtParcela ? new Date(cp.dtParcela).toLocaleDateString('pt-BR') : '-';
                    const vlParc = Number(cp.vlParcela || 0);
                    logLines.push(`→ [tbContaParcela] Parcela #${cp.cdContaParcela} | Vencimento: ${dtVencStr} | Valor: R$ ${vlParc.toFixed(2)} | Baixa ID: ${cp.cdContaBaixa ? '#' + cp.cdContaBaixa : 'Nenhuma'} | Movimento Banco ID: ${cp.cdBancoContaMovimento ? '#' + cp.cdBancoContaMovimento : 'Nenhum'}`);
                }
            }

            // 3. Consultar tbContaBaixa
            const contaBaixas: any[] = [];
            let baixaWhereParts: string[] = [];
            const uniqueBaixaIds = Array.from(new Set(baixaIds));
            if (uniqueBaixaIds.length > 0) {
                baixaWhereParts.push(`cb.cdContaBaixa IN (${uniqueBaixaIds.join(',')})`);
            }
            if (documentoResolved) {
                baixaWhereParts.push(`cb.Documento = '${documentoResolved.replace(/'/g, "''")}'`);
            }

            if (baixaWhereParts.length > 0) {
                const resBaixas = await pool.request().query(`
                    SELECT cb.*, bc.nmConta as nmBancoConta
                    FROM tbContaBaixa cb
                    LEFT JOIN tbBancoConta bc ON bc.cdBancoConta = cb.cdBancoConta
                    WHERE ${baixaWhereParts.join(' OR ')}
                    ORDER BY cb.cdContaBaixa ASC
                `);
                for (const cb of resBaixas.recordset || []) {
                    contaBaixas.push(cb);
                    if (cb.cdBancoContaMovimento) movIds.push(Number(cb.cdBancoContaMovimento));
                    const dtBaixaStr = cb.dtContaBaixa ? new Date(cb.dtContaBaixa).toLocaleDateString('pt-BR') : '-';
                    const vlBaixa = Number(cb.vlContaBaixa || 0);
                    logLines.push(`→ [tbContaBaixa] Baixa ID: #${cb.cdContaBaixa} | Data: ${dtBaixaStr} | Valor Baixa: R$ ${vlBaixa.toFixed(2)} | Conta Banco: ${cb.cdBancoConta || '-'} (${cb.nmBancoConta || 'Conta Bancária'}) | Movimento ID: ${cb.cdBancoContaMovimento ? '#' + cb.cdBancoContaMovimento : '-'} | Histórico: "${cb.Historico || ''}"`);
                }
            }

            // 4. Consultar tbBancoContaMovimento
            const bankMovements: any[] = [];
            const uniqueMovIds = Array.from(new Set(movIds));
            let movWhereParts: string[] = [];
            if (uniqueMovIds.length > 0) {
                movWhereParts.push(`m.cdBancoContaMovimento IN (${uniqueMovIds.join(',')})`);
            }
            if (documentoResolved) {
                const safeDoc = documentoResolved.replace(/'/g, "''");
                movWhereParts.push(`(m.Numero = '${safeDoc}' OR m.Historico LIKE '%${safeDoc}%')`);
            }

            if (movWhereParts.length > 0) {
                const resMovs = await pool.request().query(`
                    SELECT m.*, bc.nmConta as nmBancoConta
                    FROM tbBancoContaMovimento m
                    LEFT JOIN tbBancoConta bc ON bc.cdBancoConta = m.cdBancoConta
                    WHERE ${movWhereParts.join(' OR ')}
                    ORDER BY m.cdBancoContaMovimento DESC
                `);
                for (const m of resMovs.recordset || []) {
                    bankMovements.push(m);
                    const dtMovStr = m.dtLancamento ? new Date(m.dtLancamento).toLocaleDateString('pt-BR') : '-';
                    const valorDeb = Number(m.vlDebito || 0);
                    const valorCred = Number(m.vlCredito || 0);
                    logLines.push(`→ [tbBancoContaMovimento] ID: #${m.cdBancoContaMovimento} | Conta: ${m.cdBancoConta || '-'} (${m.nmBancoConta || 'Conta'}) | Débito: R$ ${valorDeb.toFixed(2)} | Crédito: R$ ${valorCred.toFixed(2)} | Data: ${dtMovStr} | Histórico: "${m.Historico || ''}"`);
                }
            }

            // Análise de Duplicidade vs Baixa Parcial / Fracionada
            const totalBaixas = contaBaixas.reduce((sum, cb) => sum + Number(cb.vlContaBaixa || 0), 0);
            const expAmount = Number(params.transaction?.amount || 0);
            const debitMovs = bankMovements.filter(m => Number(m.vlDebito || 0) > 0);

            const duplicateReasons: string[] = [];
            if (expAmount > 0 && totalBaixas > expAmount + 0.05 && contaBaixas.length > 1) {
                duplicateReasons.push(`Valor total das baixas no Solidcon (R$ ${totalBaixas.toFixed(2)}) ultrapassa o valor da despesa (R$ ${expAmount.toFixed(2)}).`);
            }
            if (debitMovs.length > contaBaixas.length && contaBaixas.length > 0) {
                duplicateReasons.push(`Detectadas ${debitMovs.length} movimentações bancárias de débito para ${contaBaixas.length} baixa(s) em 'tbBancoContaMovimento'.`);
            }

            const isPartialBaixas = contaBaixas.length > 1 && duplicateReasons.length === 0;
            const hasDuplicates = duplicateReasons.length > 0;

            if (isPartialBaixas) {
                logLines.push(`ℹ️ [BAIXA PARCIAL / FRACIONADA] Despesa quitada em ${contaBaixas.length} baixas parciais legítimas. Total baixado: R$ ${totalBaixas.toFixed(2)} (${expAmount > 0 && Math.abs(totalBaixas - expAmount) <= 0.05 ? '100% quitada' : 'parcial'}).`);
            }

            if (hasDuplicates) {
                logLines.push(`⚠️ [DIAGNÓSTICO] DUPLICIDADE IDENTIFICADA:`);
                duplicateReasons.forEach(r => logLines.push(`   • ${r}`));
            } else if (contaBaixas.length > 0 || contaRow) {
                logLines.push(`✅ [DIAGNÓSTICO] Lançamento de despesa 100% íntegro e consistente no Solidcon.`);
            } else {
                logLines.push(`ℹ️ [DIAGNÓSTICO] Título ou baixa ainda não encontrados no Solidcon.`);
            }

            const tableIds = {
                tbConta: contaRow ? contaRow.cdConta : (foundContaIds[0] || null),
                tbContaParcela: Array.from(new Set(contaParcelas.map((cp: any) => cp.cdContaParcela).filter(Boolean))),
                tbContaBaixa: Array.from(new Set(contaBaixas.map((cb: any) => cb.cdContaBaixa).filter(Boolean))),
                tbBancoContaMovimento: Array.from(new Set(bankMovements.map((m: any) => m.cdBancoContaMovimento).filter(Boolean)))
            };

            const duplicateAnalysis = {
                hasDuplicates,
                isPartialBaixa: isPartialBaixas,
                totalBaixado: totalBaixas,
                expectedAmount: expAmount,
                duplicateBaixaCount: hasDuplicates ? Math.max(0, contaBaixas.length - 1) : 0,
                duplicateMovementCount: hasDuplicates ? Math.max(0, debitMovs.length - 1) : 0,
                reasons: duplicateReasons
            };

            return {
                conta: contaRow,
                contas: allContas,
                contaParcelas,
                contaBaixas,
                bankMovements,
                tableIds,
                hasDuplicates,
                duplicateAnalysis,
                duplicateReasons,
                logLines
            };
        } finally {
            if (pool) {
                try {
                    await pool.close();
                } catch {
                    // ignore
                }
            }
        }
    }

    static async fixSolidconExpenseDuplicates(config: {
        host?: string | null | undefined;
        database?: string | null | undefined;
        user?: string | null | undefined;
        password?: string | null | undefined;
    }, params: {
        cdConta?: number | string | null | undefined;
        documento?: string | null | undefined;
        cdFilial?: string | number | null | undefined;
        transaction?: any;
    }): Promise<{
        success: boolean;
        deletedBaixasCount: number;
        deletedMovementsCount: number;
        logLines: string[];
    }> {
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
            options: {
                encrypt: false,
                trustServerCertificate: true
            },
            connectionTimeout: 10000,
            requestTimeout: 15000
        };

        const pool = new sql.ConnectionPool(sqlConfig);
        await pool.connect();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();
            const logLines: string[] = [];
            const nowStr = new Date().toLocaleString('pt-BR');
            logLines.push(`[${nowStr}] 🛠️ Iniciando consolidação e correção de despesas duplicadas no Solidcon...`);

            let cdContaResolved = params.cdConta ? parseInt(String(params.cdConta), 10) : null;
            if (isNaN(cdContaResolved as number)) cdContaResolved = null;
            const docStr = params.documento ? String(params.documento).trim() : null;

            // Busca baixas associadas
            let whereParts: string[] = [];
            if (cdContaResolved) {
                whereParts.push(`cp.cdConta = ${cdContaResolved}`);
            }
            if (docStr) {
                const safeDoc = docStr.replace(/'/g, "''");
                whereParts.push(`cb.Documento = '${safeDoc}' OR c.Documento = '${safeDoc}'`);
            }

            if (whereParts.length === 0) {
                throw new Error('Nenhum identificador (cdConta ou Documento) informado para ajuste de despesa.');
            }

            const reqFind = new sql.Request(transaction);
            const resFind = await reqFind.query(`
                SELECT DISTINCT 
                    cb.cdContaBaixa,
                    cb.dtContaBaixa,
                    cb.vlContaBaixa,
                    cb.cdBancoContaMovimento,
                    cp.cdConta,
                    cp.cdContaParcela
                FROM tbContaBaixa cb
                LEFT JOIN tbContaParcela cp ON cp.cdContaBaixa = cb.cdContaBaixa
                LEFT JOIN tbConta c ON c.cdConta = cp.cdConta
                WHERE ${whereParts.join(' OR ')}
                ORDER BY cb.cdContaBaixa ASC
            `);

            const allBaixas: any[] = resFind.recordset || [];
            const totalBaixas = allBaixas.reduce((sum, b) => sum + Number(b.vlContaBaixa || 0), 0);
            const expAmount = Number(params.transaction?.amount || 0);
            logLines.push(`→ Total de baixas encontradas em tbContaBaixa: ${allBaixas.length} (Soma: R$ ${totalBaixas.toFixed(2)}${expAmount > 0 ? ` | Despesa: R$ ${expAmount.toFixed(2)}` : ''})`);

            let deletedBaixasCount = 0;
            let deletedMovementsCount = 0;

            if (allBaixas.length > 1 && expAmount > 0 && totalBaixas <= expAmount + 0.05) {
                logLines.push(`ℹ️ As ${allBaixas.length} baixas encontradas são parcelas parciais legítimas que somam R$ ${totalBaixas.toFixed(2)} (condizente com o valor de R$ ${expAmount.toFixed(2)} da despesa). Nenhuma baixa foi excluída.`);
            } else if (allBaixas.length > 1) {
                const canonical = allBaixas[0];
                logLines.push(`→ Baixa principal preservada: Baixa #${canonical.cdContaBaixa} | Valor: R$ ${Number(canonical.vlContaBaixa || 0).toFixed(2)} | Movimento: ${canonical.cdBancoContaMovimento ? '#' + canonical.cdBancoContaMovimento : 'Nenhum'}`);

                const duplicateBaixas = allBaixas.slice(1);
                for (const dup of duplicateBaixas) {
                    logLines.push(`→ Removendo baixa duplicada: Baixa #${dup.cdContaBaixa} | Valor: R$ ${Number(dup.vlContaBaixa || 0).toFixed(2)}`);

                    // 1. Atualiza referências em tbContaParcela para apontar para a baixa canônica
                    const reqUpdParc = new sql.Request(transaction);
                    reqUpdParc.input('canonicalBaixaId', sql.Int, canonical.cdContaBaixa);
                    reqUpdParc.input('canonicalMovId', sql.Int, canonical.cdBancoContaMovimento || null);
                    reqUpdParc.input('dupBaixaId', sql.Int, dup.cdContaBaixa);
                    await reqUpdParc.query(`
                        UPDATE tbContaParcela 
                        SET cdContaBaixa = @canonicalBaixaId,
                            cdBancoContaMovimento = ISNULL(@canonicalMovId, cdBancoContaMovimento)
                        WHERE cdContaBaixa = @dupBaixaId
                    `);

                    // 2. Exclui baixa de tbContaBaixa
                    const reqDelBaixa = new sql.Request(transaction);
                    reqDelBaixa.input('dupBaixaId', sql.Int, dup.cdContaBaixa);
                    await reqDelBaixa.query(`
                        IF OBJECT_ID('dbo.tbContaParcela', 'U') IS NOT NULL
                            DELETE FROM tbContaParcela WHERE cdContaBaixa = @dupBaixaId;
                        IF OBJECT_ID('dbo.tbContaBaixaConta', 'U') IS NOT NULL
                            DELETE FROM tbContaBaixaConta WHERE cdContaBaixa = @dupBaixaId;
                        DELETE FROM tbContaBaixa WHERE cdContaBaixa = @dupBaixaId;
                    `);
                    deletedBaixasCount++;
                    logLines.push(`  ↳ Baixa duplicada excluída [tbContaBaixa]: ID #${dup.cdContaBaixa}`);

                    // 3. Exclui movimento bancário duplicado se existir e não for compartilhado
                    if (dup.cdBancoContaMovimento && dup.cdBancoContaMovimento !== canonical.cdBancoContaMovimento) {
                        const reqDelMov = new sql.Request(transaction);
                        reqDelMov.input('movId', sql.Int, dup.cdBancoContaMovimento);
                        await reqDelMov.query(`
                            IF OBJECT_ID('dbo.tbContaParcela', 'U') IS NOT NULL
                            BEGIN
                                UPDATE tbContaParcela SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;
                                DELETE FROM tbContaParcela WHERE cdContaBaixa IN (SELECT cdContaBaixa FROM tbContaBaixa WHERE cdBancoContaMovimento = @movId);
                            END

                            IF OBJECT_ID('dbo.tbContaBaixaConta', 'U') IS NOT NULL
                                DELETE FROM tbContaBaixaConta WHERE cdContaBaixa IN (SELECT cdContaBaixa FROM tbContaBaixa WHERE cdBancoContaMovimento = @movId);

                            IF OBJECT_ID('dbo.tbContaBaixa', 'U') IS NOT NULL
                            BEGIN
                                UPDATE tbContaBaixa SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;
                                DELETE FROM tbContaBaixa WHERE cdBancoContaMovimento = @movId;
                            END

                            IF OBJECT_ID('dbo.tbCrediarioDeposito', 'U') IS NOT NULL
                            BEGIN
                                UPDATE tbCrediarioDeposito SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;
                                DELETE FROM tbCrediarioDeposito WHERE cdBancoContaMovimento = @movId;
                            END

                            IF OBJECT_ID('dbo.tbValeCompra', 'U') IS NOT NULL
                            BEGIN
                                UPDATE tbValeCompra SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;
                                DELETE FROM tbValeCompra WHERE cdBancoContaMovimento = @movId;
                            END

                            IF OBJECT_ID('dbo.tbReceDespMovimento', 'U') IS NOT NULL
                                UPDATE tbReceDespMovimento SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;

                            IF OBJECT_ID('dbo.tbChequeMovimento', 'U') IS NOT NULL
                                UPDATE tbChequeMovimento SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;

                            IF OBJECT_ID('dbo.tbCartaoLoteMovimento', 'U') IS NOT NULL
                                UPDATE tbCartaoLoteMovimento SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @movId;

                            DELETE FROM tbBancoContaMovimento WHERE cdBancoContaMovimento = @movId;
                        `);
                        deletedMovementsCount++;
                        logLines.push(`  ↳ Movimentação bancária duplicada excluída [tbBancoContaMovimento]: ID #${dup.cdBancoContaMovimento}`);
                    }
                }
            } else if (allBaixas.length === 1) {
                logLines.push(`→ Apenas 1 baixa registrada. Nenhuma duplicidade em tbContaBaixa.`);
            } else {
                logLines.push(`→ Nenhuma baixa encontrada.`);
            }

            await transaction.commit();
            logLines.push(`🎉 Consolidação de despesa no Solidcon finalizada com sucesso!`);

            return {
                success: true,
                deletedBaixasCount,
                deletedMovementsCount,
                logLines
            };
        } catch (err: any) {
            await transaction.rollback();
            throw err;
        } finally {
            if (pool) {
                try {
                    await pool.close();
                } catch {
                    // ignore
                }
            }
        }
    }

    static async registrarJurosSolidcon(config: {
        host?: string | null;
        database?: string | null;
        user?: string | null;
        password?: string | null;
    }, jurosInfo: {
        totalFineInterest: number;
        daysOverdue?: number;
        description?: string;
        customerName?: string;
        nrCupom?: number | string | null;
        cdCrediarioCupom?: number | null;
        cdFilial?: string | number | null;
        cdPDV?: string | number | null;
    }, bankAccountInfo?: {
        solidcon_bank_id?: string | null;
        name?: string;
        institution?: string | null;
        agency_number?: string | null;
        account_number?: string | null;
    }): Promise<string | null> {
        if (!jurosInfo || !jurosInfo.totalFineInterest || jurosInfo.totalFineInterest <= 0) return null;

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

        const pool = new sql.ConnectionPool(sqlConfig);
        await pool.connect();
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();

            const rawFilial = jurosInfo.cdFilial || '1';
            const cdFilial = parseInt(String(rawFilial).split(',')[0] ?? '1', 10) || 1;
            const cupomNumStr = jurosInfo.nrCupom ? String(jurosInfo.nrCupom).trim() : '';

            // Resolve cdBancoConta
            let cdBancoConta = bankAccountInfo?.solidcon_bank_id;
            if (!cdBancoConta) {
                const reqBank = new sql.Request(transaction);
                reqBank.input('accountNum', sql.VarChar, bankAccountInfo?.account_number || '');
                reqBank.input('bankName', sql.VarChar, bankAccountInfo?.name ? '%' + bankAccountInfo.name + '%' : '');
                reqBank.input('institution', sql.VarChar, bankAccountInfo?.institution ? '%' + bankAccountInfo.institution + '%' : '');
                const resBank = await reqBank.query(`
                    SELECT TOP 1 cdBancoConta FROM tbBancoConta 
                    WHERE (@bankName <> '' AND nmConta LIKE @bankName) 
                       OR (@institution <> '' AND nmConta LIKE @institution)
                       OR (@accountNum <> '' AND (CAST(ContaNumero AS VARCHAR) = @accountNum OR CAST(ContaNumero AS VARCHAR) LIKE '%' + @accountNum))
                    ORDER BY cdBancoConta ASC
                `);
                if (resBank.recordset?.[0]?.cdBancoConta) {
                    cdBancoConta = resBank.recordset[0].cdBancoConta;
                } else {
                    const reqFirstBank = new sql.Request(transaction);
                    const resFirstBank = await reqFirstBank.query(`SELECT TOP 1 cdBancoConta FROM tbBancoConta ORDER BY cdBancoConta ASC`);
                    cdBancoConta = resFirstBank.recordset?.[0]?.cdBancoConta || '1';
                }
            }

            // Check if movement already exists
            const reqCheck = new sql.Request(transaction);
            reqCheck.input('cupomNumStr', sql.VarChar, cupomNumStr);
            reqCheck.input('histPattern', sql.VarChar, `%Cupom #${cupomNumStr}%`);
            const resCheck = await reqCheck.query(`
                SELECT TOP 1 cdBancoContaMovimento FROM tbBancoContaMovimento 
                WHERE (Historico LIKE '%Juros de conv%' OR Historico LIKE '%Juros de convênio%' OR Historico LIKE '%Juros de convenio%')
                  AND (@cupomNumStr <> '' AND Historico LIKE @histPattern)
            `);

            let movId: string | null = null;
            let cdConta: any = null;
            if (!resCheck.recordset?.[0]) {
                const today = new Date();
                const daysText = `${jurosInfo.daysOverdue || 1} ${jurosInfo.daysOverdue === 1 ? 'dia' : 'dias'}`;
                const custName = jurosInfo.customerName ? ` - ${jurosInfo.customerName}` : '';
                const histDesc = jurosInfo.description || `Juros de convênio pago em atraso (${daysText}) - Ref: Cupom #${cupomNumStr}${custName}`;

                const reqMov = new sql.Request(transaction);
                reqMov.input('dtLancamento', sql.DateTime, today);
                reqMov.input('vlDebito', sql.Money, jurosInfo.totalFineInterest);
                reqMov.input('Numero', sql.VarChar, String(cupomNumStr || '').substring(0, 20));
                reqMov.input('Historico', sql.VarChar, histDesc.substring(0, 200));
                reqMov.input('cdBancoConta', sql.VarChar, String(cdBancoConta));
                reqMov.input('cdPessoaFilialBancoConta', sql.Int, cdFilial);

                const resMov = await reqMov.query(`
                    INSERT INTO tbBancoContaMovimento (
                        dtLancamento, vlDebito, vlCredito, Numero, Historico, vlSaldo, nrProcessado, inPendencia,
                        cdBancoContaMovimentoTipo, cdBancoConta, cdPessoaFilialBancoConta, cdBancoContaExtrato, inCancelado, cdUsuarioMovimento
                    ) VALUES (
                        @dtLancamento, @vlDebito, NULL, @Numero, @Historico, 0, NULL, NULL,
                        '3', @cdBancoConta, @cdPessoaFilialBancoConta, NULL, NULL, '1'
                    );
                    SELECT SCOPE_IDENTITY() AS insertId;
                `);
                movId = resMov.recordset?.[0]?.insertId ? String(resMov.recordset[0].insertId) : null;
                if (!movId) {
                    const resFallback = await transaction.request().query('SELECT TOP 1 cdBancoContaMovimento FROM tbBancoContaMovimento ORDER BY cdBancoContaMovimento DESC');
                    movId = resFallback.recordset?.[0]?.cdBancoContaMovimento ? String(resFallback.recordset[0].cdBancoContaMovimento) : null;
                }

                // Insert into tbConta, tbContaBaixa, and tbContaParcela
                if (movId) {
                    const movIdNum = parseInt(movId, 10);
                    let cdEmpresaResolved = 10;
                    try {
                        const resEmp = await transaction.request().query('SELECT TOP 1 cdEmpresa FROM tbEmpresa ORDER BY cdEmpresa ASC');
                        if (resEmp.recordset?.[0]?.cdEmpresa) {
                            cdEmpresaResolved = resEmp.recordset[0].cdEmpresa;
                        }
                    } catch {
                        cdEmpresaResolved = 10;
                    }

                    // 1. tbConta
                    const reqConta = new sql.Request(transaction);
                    reqConta.input('cdFilial', sql.Int, cdFilial);
                    reqConta.input('cdEmpresa', sql.TinyInt, cdEmpresaResolved);
                    reqConta.input('cdPessoaComercial', sql.Int, 1);
                    reqConta.input('Documento', sql.VarChar, String(cupomNumStr || '').substring(0, 12));
                    reqConta.input('dtInclusao', sql.DateTime, today);

                    const resConta = await reqConta.query(`
                        INSERT INTO tbConta (
                            cdPessoaFilialConta, cdEmpresa, cdPessoaComercial, cdContaTipo, Documento, cdPagamentoTipo, dtInclusao, inNaoInformaNoReinf, XmlNFSe
                        ) VALUES (
                            @cdFilial, @cdEmpresa, @cdPessoaComercial, 4, @Documento, 0, @dtInclusao, NULL, NULL
                        );
                        SELECT SCOPE_IDENTITY() AS insertId;
                    `);
                    cdConta = resConta.recordset?.[0]?.insertId;
                    if (!cdConta) {
                        const resF = await transaction.request().query('SELECT TOP 1 cdConta FROM tbConta ORDER BY cdConta DESC');
                        cdConta = resF.recordset?.[0]?.cdConta;
                    }

                    // 2. tbContaBaixa
                    const reqBaixa = new sql.Request(transaction);
                    reqBaixa.input('cdFilial', sql.Int, cdFilial);
                    reqBaixa.input('cdBancoConta', sql.Int, parseInt(String(cdBancoConta), 10) || 1);
                    reqBaixa.input('cdBancoContaMovimento', sql.Int, movIdNum);
                    reqBaixa.input('dtContaBaixa', sql.DateTime, today);
                    reqBaixa.input('vlContaBaixa', sql.Money, jurosInfo.totalFineInterest);
                    reqBaixa.input('Documento', sql.VarChar, String(cupomNumStr || '').substring(0, 10));
                    reqBaixa.input('Historico', sql.VarChar, histDesc.substring(0, 80));

                    const resBaixa = await reqBaixa.query(`
                        INSERT INTO tbContaBaixa (
                            cdPessoaFilialContaBaixa, cdPessoaFilialBancoConta, cdBancoConta, cdBancoContaMovimento,
                            dtContaBaixa, vlContaBaixa, Documento, inRecebimento, Historico, cdPagamentoTipo, inAvista
                        ) VALUES (
                            @cdFilial, @cdFilial, @cdBancoConta, @cdBancoContaMovimento,
                            @dtContaBaixa, @vlContaBaixa, @Documento, 1, @Historico, 0, 1
                        );
                        SELECT SCOPE_IDENTITY() AS insertId;
                    `);
                    let cdContaBaixa = resBaixa.recordset?.[0]?.insertId;
                    if (!cdContaBaixa) {
                        const resF = await transaction.request().query('SELECT TOP 1 cdContaBaixa FROM tbContaBaixa ORDER BY cdContaBaixa DESC');
                        cdContaBaixa = resF.recordset?.[0]?.cdContaBaixa;
                    }

                    // 3. tbContaParcela
                    if (cdConta && cdContaBaixa) {
                        const reqParcela = new sql.Request(transaction);
                        reqParcela.input('cdFilial', sql.Int, cdFilial);
                        reqParcela.input('cdConta', sql.Int, cdConta);
                        reqParcela.input('cdContaBaixa', sql.Int, cdContaBaixa);
                        reqParcela.input('dtParcela', sql.DateTime, today);
                        reqParcela.input('vlParcela', sql.Money, jurosInfo.totalFineInterest);
                        reqParcela.input('Historico', sql.VarChar, histDesc.substring(0, 80));
                        reqParcela.input('cdBancoContaMovimento', sql.Int, movIdNum);

                        await reqParcela.query(`
                            INSERT INTO tbContaParcela (
                                cdPessoaFilialConta, cdConta, cdContaParcela, cdPessoaFilialContaBaixa, cdContaBaixa,
                                cdIndice, dtParcela, vlParcela, vlMulta, vlMora, vlDesconto, inBoleto, Historico,
                                dtCompetencia, cdBancoContaMovimento, CNPJFactoring, vlTarifaBoletoBanco,
                                dtParcelaOriginal, vlParcelaOriginal, inEnviadoIntegrador
                            ) VALUES (
                                @cdFilial, @cdConta, '1 ', @cdFilial, @cdContaBaixa,
                                NULL, @dtParcela, @vlParcela, 0, 0, 0, 0, @Historico,
                                @dtParcela, @cdBancoContaMovimento, '', 0,
                                @dtParcela, @vlParcela, 0
                            );
                        `);
                    }
                }
            } else {
                movId = resCheck.recordset?.[0]?.cdBancoContaMovimento ? String(resCheck.recordset[0].cdBancoContaMovimento) : null;
                if (movId) {
                    const reqFindConta = new sql.Request(transaction);
                    reqFindConta.input('movIdNum', sql.Int, parseInt(movId, 10));
                    reqFindConta.input('cupomNumStr', sql.VarChar, cupomNumStr);
                    const resFindConta = await reqFindConta.query(`
                        SELECT TOP 1 c.cdConta FROM tbConta c
                        LEFT JOIN tbContaParcela cp ON cp.cdConta = c.cdConta
                        WHERE cp.cdBancoContaMovimento = @movIdNum OR c.Documento = @cupomNumStr
                        ORDER BY c.cdConta DESC
                    `);
                    if (resFindConta.recordset?.[0]?.cdConta) {
                        cdConta = resFindConta.recordset[0].cdConta;
                    }
                }
            }

            await transaction.commit();
            const revenueCode = cdConta ? String(cdConta) : movId;
            return revenueCode;
        } catch (err: any) {
            await transaction.rollback();
            throw err;
        } finally {
            await pool.close();
        }
    }

    static async removerReceitaSolidcon(config: {
        host?: string | null;
        database?: string | null;
        user?: string | null;
        password?: string | null;
    }, target: {
        cdConta?: number | string | null;
        cdBancoContaMovimento?: number | string | null;
        documento?: string | number | null;
    }): Promise<boolean> {
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

        const pool = new sql.ConnectionPool(sqlConfig);
        await pool.connect();
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();

            const cdContaNum = target.cdConta ? parseInt(String(target.cdConta), 10) : null;
            const cdMovNum = target.cdBancoContaMovimento ? parseInt(String(target.cdBancoContaMovimento), 10) : null;
            const docStr = target.documento ? String(target.documento).trim() : null;

            if (!cdContaNum && !cdMovNum && !docStr) {
                await transaction.rollback();
                return false;
            }

            const reqFind = new sql.Request(transaction);
            reqFind.input('cdConta', sql.Int, cdContaNum);
            reqFind.input('cdMov', sql.Int, cdMovNum);
            reqFind.input('documento', sql.VarChar, docStr);

            const resFind = await reqFind.query(`
                SELECT DISTINCT 
                    c.cdConta,
                    ISNULL(cp.cdContaBaixa, cb.cdContaBaixa) AS cdContaBaixa,
                    ISNULL(cp.cdBancoContaMovimento, cb.cdBancoContaMovimento) AS cdBancoContaMovimento
                FROM tbConta c
                LEFT JOIN tbContaParcela cp ON cp.cdConta = c.cdConta
                LEFT JOIN tbContaBaixa cb ON cb.cdContaBaixa = cp.cdContaBaixa
                WHERE (@cdConta IS NOT NULL AND c.cdConta = @cdConta)
                   OR (@cdMov IS NOT NULL AND (cp.cdBancoContaMovimento = @cdMov OR cb.cdBancoContaMovimento = @cdMov))
                   OR (@documento IS NOT NULL AND (c.Documento = @documento OR cb.Documento = @documento))
            `);

            const rows = resFind.recordset || [];
            const contasToDelete = new Set<number>();
            const baixasToDelete = new Set<number>();
            const movsToDelete = new Set<number>();

            if (cdContaNum) contasToDelete.add(cdContaNum);
            if (cdMovNum) movsToDelete.add(cdMovNum);

            for (const r of rows) {
                if (r.cdConta) contasToDelete.add(r.cdConta);
                if (r.cdContaBaixa) baixasToDelete.add(r.cdContaBaixa);
                if (r.cdBancoContaMovimento) movsToDelete.add(r.cdBancoContaMovimento);
            }

            if (docStr) {
                const reqMovDoc = new sql.Request(transaction);
                reqMovDoc.input('docPattern', sql.VarChar, `%Cupom #${docStr}%`);
                const resMovDoc = await reqMovDoc.query(`
                    SELECT cdBancoContaMovimento FROM tbBancoContaMovimento
                    WHERE (Historico LIKE '%Juros de conv%' OR Historico LIKE '%Juros de convênio%' OR Historico LIKE '%Juros de convenio%')
                      AND Historico LIKE @docPattern
                `);
                for (const r of resMovDoc.recordset || []) {
                    if (r.cdBancoContaMovimento) movsToDelete.add(r.cdBancoContaMovimento);
                }
            }

            // 1. Cascade delete/update references for all identified tbConta
            for (const cId of contasToDelete) {
                const reqDel = new sql.Request(transaction);
                reqDel.input('cdConta', sql.Int, cId);
                await reqDel.query(`
                    UPDATE tbNota SET cdConta = NULL WHERE cdConta = @cdConta;
                    UPDATE tbReceDespMovimento SET cdConta = NULL WHERE cdConta = @cdConta;
                    UPDATE tbContrato SET cdConta = NULL WHERE cdConta = @cdConta;
                    UPDATE tbDesoneracao SET cdConta = NULL WHERE cdConta = @cdConta;
                    UPDATE tbPalletGestao SET cdConta = NULL WHERE cdConta = @cdConta;
                    UPDATE tbPedidoVendaComissao SET cdConta = NULL WHERE cdConta = @cdConta;
                    DELETE FROM tbContaBaixaConta WHERE cdConta = @cdConta OR cdContaDesconto = @cdConta;
                    DELETE FROM tbNotaBaixaConta WHERE cdConta = @cdConta;
                    DELETE FROM tbContaParcelaAutorizacao WHERE cdConta = @cdConta;
                    DELETE FROM tbGestaoCobrancaBoletoOcorrencia WHERE cdConta = @cdConta;
                    DELETE FROM tbReceDespRecebivelComprovante WHERE cdConta = @cdConta;
                    DELETE FROM tbContaParcela WHERE cdConta = @cdConta;
                    DELETE FROM tbConta WHERE cdConta = @cdConta;
                `);
            }

            // 2. Cascade delete for all identified tbContaBaixa
            for (const cbId of baixasToDelete) {
                const reqDel = new sql.Request(transaction);
                reqDel.input('cdContaBaixa', sql.Int, cbId);
                await reqDel.query(`
                    DELETE FROM tbContaParcela WHERE cdContaBaixa = @cdContaBaixa;
                    DELETE FROM tbContaBaixa WHERE cdContaBaixa = @cdContaBaixa;
                `);
            }

            // 3. Cascade delete for all identified tbBancoContaMovimento
            for (const mId of movsToDelete) {
                const reqDel = new sql.Request(transaction);
                reqDel.input('cdMov', sql.Int, mId);
                await reqDel.query(`
                    IF OBJECT_ID('dbo.tbContaParcela', 'U') IS NOT NULL
                    BEGIN
                        UPDATE tbContaParcela SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @cdMov;
                        DELETE FROM tbContaParcela WHERE cdContaBaixa IN (SELECT cdContaBaixa FROM tbContaBaixa WHERE cdBancoContaMovimento = @cdMov);
                    END

                    IF OBJECT_ID('dbo.tbContaBaixaConta', 'U') IS NOT NULL
                        DELETE FROM tbContaBaixaConta WHERE cdContaBaixa IN (SELECT cdContaBaixa FROM tbContaBaixa WHERE cdBancoContaMovimento = @cdMov);

                    IF OBJECT_ID('dbo.tbContaBaixa', 'U') IS NOT NULL
                    BEGIN
                        UPDATE tbContaBaixa SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @cdMov;
                        DELETE FROM tbContaBaixa WHERE cdBancoContaMovimento = @cdMov;
                    END

                    IF OBJECT_ID('dbo.tbCrediarioDeposito', 'U') IS NOT NULL
                    BEGIN
                        UPDATE tbCrediarioDeposito SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @cdMov;
                        DELETE FROM tbCrediarioDeposito WHERE cdBancoContaMovimento = @cdMov;
                    END

                    IF OBJECT_ID('dbo.tbValeCompra', 'U') IS NOT NULL
                    BEGIN
                        UPDATE tbValeCompra SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @cdMov;
                        DELETE FROM tbValeCompra WHERE cdBancoContaMovimento = @cdMov;
                    END

                    IF OBJECT_ID('dbo.tbReceDespMovimento', 'U') IS NOT NULL
                        UPDATE tbReceDespMovimento SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @cdMov;

                    IF OBJECT_ID('dbo.tbChequeMovimento', 'U') IS NOT NULL
                        UPDATE tbChequeMovimento SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @cdMov;

                    IF OBJECT_ID('dbo.tbCartaoLoteMovimento', 'U') IS NOT NULL
                        UPDATE tbCartaoLoteMovimento SET cdBancoContaMovimento = NULL WHERE cdBancoContaMovimento = @cdMov;

                    DELETE FROM tbBancoContaMovimento WHERE cdBancoContaMovimento = @cdMov;
                `);
            }

            await transaction.commit();
            return true;
        } catch (err) {
            await transaction.rollback();
            throw err;
        } finally {
            await pool.close();
        }
    }

    static async updateBancoContaSolidcon(config: {
        host?: string | null;
        database?: string | null;
        user?: string | null;
        password?: string | null;
    }, cdCrediarioCupom: number, bankAccountInfo: {
        solidcon_bank_id?: string | null;
        name?: string;
        account_number?: string | null;
    }): Promise<void> {
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
            options: {
                encrypt: false,
                trustServerCertificate: true
            },
            connectionTimeout: 10000,
            requestTimeout: 15000
        };

        const pool = new sql.ConnectionPool(sqlConfig);
        await pool.connect();
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();

            // 1. Resolve cdBancoConta
            let cdBancoConta = bankAccountInfo?.solidcon_bank_id;
            if (!cdBancoConta) {
                const reqBank = new sql.Request(transaction);
                reqBank.input('accountNum', sql.VarChar, bankAccountInfo?.account_number || '');
                reqBank.input('bankName', sql.VarChar, '%' + (bankAccountInfo?.name || '') + '%');
                const resBank = await reqBank.query(`
                    SELECT TOP 1 cdBancoConta FROM tbBancoConta 
                    WHERE nmConta LIKE @bankName OR CAST(ContaNumero AS VARCHAR) = @accountNum
                `);
                cdBancoConta = resBank.recordset?.[0]?.cdBancoConta || '1';
            }

            // 2. Fetch existing payments for this cupom
            const reqCheck = new sql.Request(transaction);
            reqCheck.input('cdCrediarioCupom', sql.Int, cdCrediarioCupom);
            const resCheck = await reqCheck.query(`
                SELECT cdCrediarioDeposito, cdFilial FROM tbCrediarioCupomPagamento 
                WHERE cdCrediarioCupom = @cdCrediarioCupom
            `);

            for (const pag of resCheck.recordset || []) {
                const cdCrediarioDeposito = pag.cdCrediarioDeposito;
                if (!cdCrediarioDeposito) continue;

                // Fetch cdBancoContaMovimento from tbCrediarioDeposito
                const reqDep = new sql.Request(transaction);
                reqDep.input('cdCrediarioDeposito', sql.Int, cdCrediarioDeposito);
                const resDep = await reqDep.query(`
                    SELECT cdBancoContaMovimento FROM tbCrediarioDeposito 
                    WHERE cdCrediarioDeposito = @cdCrediarioDeposito
                `);
                const cdBancoContaMovimento = resDep.recordset?.[0]?.cdBancoContaMovimento;

                // Update tbCrediarioDeposito to NULL cdBancoContaMovimento first to avoid composite FK constraint conflict
                if (cdBancoContaMovimento) {
                    const reqSetNull = new sql.Request(transaction);
                    reqSetNull.input('cdCrediarioDeposito', sql.Int, cdCrediarioDeposito);
                    await reqSetNull.query(`
                        UPDATE tbCrediarioDeposito SET cdBancoContaMovimento = NULL 
                        WHERE cdCrediarioDeposito = @cdCrediarioDeposito
                    `);

                    // Update tbBancoContaMovimento
                    const reqUpdateMov = new sql.Request(transaction);
                    reqUpdateMov.input('cdBancoContaMovimento', sql.Int, cdBancoContaMovimento);
                    reqUpdateMov.input('cdBancoConta', sql.VarChar, String(cdBancoConta));
                    await reqUpdateMov.query(`
                        UPDATE tbBancoContaMovimento SET cdBancoConta = @cdBancoConta 
                        WHERE cdBancoContaMovimento = @cdBancoContaMovimento
                    `);
                }

                // Update tbCrediarioDeposito with new bank account and restore cdBancoContaMovimento link
                const reqUpdateDep = new sql.Request(transaction);
                reqUpdateDep.input('cdCrediarioDeposito', sql.Int, cdCrediarioDeposito);
                reqUpdateDep.input('cdBancoConta', sql.VarChar, String(cdBancoConta));
                reqUpdateDep.input('cdBancoContaMovimento', sql.Int, cdBancoContaMovimento || null);
                await reqUpdateDep.query(`
                    UPDATE tbCrediarioDeposito SET cdBancoConta = @cdBancoConta, cdBancoContaMovimento = @cdBancoContaMovimento 
                    WHERE cdCrediarioDeposito = @cdCrediarioDeposito
                `);
            }

            await transaction.commit();
        } catch (err) {
            await transaction.rollback();
            throw err;
        } finally {
            await pool.close();
        }
    }

    static async executeCustomQuery(config: {
        host?: string | null;
        database?: string | null;
        user?: string | null;
        password?: string | null;
    }, query: string): Promise<any[]> {
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
            const result = await pool.request().query(query);
            return result.recordset || [];
        } finally {
            await pool.close();
        }
    }

    static async executeAlterdataQuery(config: {
        host?: string | null | undefined;
        port?: string | number | null | undefined;
        database?: string | null | undefined;
        user?: string | null | undefined;
        password?: string | null | undefined;
    }, query: string): Promise<any[]> {
        let server = (config.host || '').trim();
        let port = Number(config.port) || 0;

        if (server.includes(',')) {
            const parts = server.split(',');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || port;
        } else if (server.includes(':')) {
            const parts = server.split(':');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || port;
        }

        const user = (config.user || '').trim();
        const password = config.password || '';
        const database = (config.database || '').trim();

        if (!server || !database || !user) {
            throw new Error('Configurações de conexão para o Banco Alterdata incompletas no cadastro da empresa.');
        }

        if (port === 1433) {
            return await this.executeCustomQuery({
                host: `${server}:${port}`,
                database,
                user,
                password
            }, query);
        }

        const pgPort = port || 5432;
        const client = new PgClient({
            host: server,
            port: pgPort,
            database: database,
            user: user,
            password: password,
            connectionTimeoutMillis: 10000,
            statement_timeout: 30000,
        });

        await client.connect();
        try {
            const res = await client.query(query);
            return res.rows || [];
        } finally {
            await client.end();
        }
    }

    static async getReportRafael(config: {
        host?: string | null;
        database?: string | null;
        user?: string | null;
        password?: string | null;
    }, startDate: string, endDate: string, cdFilial: string, isDorsal: boolean = false): Promise<any[]> {
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
                idleTimeoutMillis: 30000
            },
            options: {
                encrypt: false,
                trustServerCertificate: true,
                connectTimeout: 30000,
                requestTimeout: 60000
            },
            connectionTimeout: 30000,
            requestTimeout: 60000
        };

        const filials = cdFilial.split(',')
            .map(f => f.trim())
            .filter(f => /^[a-zA-Z0-9_-]+$/.test(f))
            .map(f => `'${f}'`)
            .join(',');

        if (!filials) {
            throw new Error('Nenhuma filial válida informada.');
        }

        let lastErr: any = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
            let pool: any = null;
            try {
                pool = await new sql.ConnectionPool(sqlConfig).connect();
                const request = pool.request();
                request.input('startDate', sql.VarChar, `${startDate} 00:00:00`);
                request.input('endDate', sql.VarChar, `${endDate} 23:59:59`);

                const filialJoin = isDorsal 
                    ? `AND tbSuperProduto.cdFilial = tbProduto.cdFilial` 
                    : ``;

                const selectSubclassificacao = isDorsal 
                    ? `CAST(NULL AS VARCHAR(100)) AS subclassificacao`
                    : `MAX(tbClassificacaoProduto.nmClassificacaoProduto) AS subclassificacao`;

                const joinSubclassificacao = isDorsal
                    ? ``
                    : `LEFT OUTER JOIN tbClassificacaoProduto ON tbSuperProduto.cdEmpresa = tbClassificacaoProduto.cdEmpresa
                                                           AND tbSuperProduto.cdClassificacaoProduto = tbClassificacaoProduto.cdClassificacaoProduto`;

                const query = `
                    SELECT SUM(tbCupomItem.qtItem) AS qtItem, 
                           SUM(tbSuperProduto.vlCusto * tbProduto.nrMultiplicador * tbCupomItem.qtItem) as vlCustodia, 
                           SUM(tbCupomItem.vlCusto * tbProduto.nrMultiplicador * tbCupomItem.qtItem) as vlCustovenda, 
                           SUM(round(tbCupomItem.vlItem * tbCupomItem.qtItem,2,1) - ISNULL(tbCupomItem.vlDesconto, 0)) + 
                           SUM((round(tbCupomItem.vlItem * tbCupomItem.qtItem,2,1) - ISNULL(tbCupomItem.vlDesconto, 0)) *  
                           tbCupom.Acrescimo / tbCupom.vlCupom) - SUM((round(tbCupomItem.vlItem * tbCupomItem.qtItem,2,1) 
                           - ISNULL(tbCupomItem.vlDesconto, 0)) * tbCupom.Desconto / tbCupom.vlCupom) AS vlVenda,
                           SUM((round(tbCupomItem.vlItem * tbCupomItem.qtItem,2,1) - ISNULL(tbCupomItem.vlDesconto, 0)) 
                           * tbCupom.Acrescimo / tbCupom.vlCupom) AS Acrescimos,
                           SUM(ISNULL(tbCupomItem.vlDesconto, 0)) +  SUM((round(tbCupomItem.vlItem * tbCupomItem.qtItem,2,1) 
                           - ISNULL(tbCupomItem.vlDesconto, 0)) * tbCupom.Desconto / tbCupom.vlCupom) AS Descontos, 
                          tbProduto.cdProduto, tbSuperProduto.cdSuperProduto as superProduto, 
                          tbSuperProduto.nmProduto + ' ' + COALESCE(tbProduto.nmVariacao, '') AS Produto, 
                          tbSuperProduto.vlCusto as vlunCusto, 
                          tbSuperProduto.vlVenda as vlunvenda,
                          MAX(tbSecao.nmSecao) AS classificacao,
                          ${selectSubclassificacao}
                    FROM tbSuperProduto 
                    INNER JOIN tbProduto ON tbSuperProduto.cdEmpresa = tbProduto.cdEmpresa 
                                        ${filialJoin}
                                        AND tbSuperProduto.cdSuperProduto = tbProduto.cdSuperProduto 
                    RIGHT OUTER JOIN tbCupom 
                    INNER JOIN tbCupomItem ON tbCupom.gdCupom = tbCupomItem.gdCupom 
                                          ON tbProduto.cdEmpresa = tbCupom.cdEmpresa  
                                         AND tbProduto.cdFilial = tbCupom.cdFilial 
                                         AND tbProduto.cdProduto = tbCupomItem.cdProduto
                    LEFT OUTER JOIN tbSecao ON tbSuperProduto.cdEmpresa = tbSecao.cdEmpresa
                                           AND tbCupom.cdFilial = tbSecao.cdFilial
                                           AND tbSuperProduto.cdSecao = tbSecao.cdSecao
                    ${joinSubclassificacao}
                    WHERE (tbCupom.dtCupom BETWEEN @startDate AND @endDate) 
                      AND (tbCupom.cdEmpresa = 10) 
                      AND (tbProduto.cdProduto IS NOT NULL) 
                      AND (tbCupom.cdFilial IN (${filials}))
                      AND (tbCupom.vlCupom > 0)
                    GROUP BY tbSuperProduto.vlCusto, 
                             tbSuperProduto.vlVenda, 
                             tbProduto.cdProduto, 
                             tbSuperProduto.cdSuperProduto,
                             tbSuperProduto.nmProduto + ' ' + COALESCE(tbProduto.nmVariacao, '')
                    ORDER BY tbSuperProduto.nmProduto + ' ' + COALESCE(tbProduto.nmVariacao, '')
                `;

                const result = await request.query(query);
                return result.recordset || [];
            } catch (err: any) {
                lastErr = err;
                if (attempt < 2) {
                    await new Promise(r => setTimeout(r, 800));
                }
            } finally {
                if (pool) {
                    try { await pool.close(); } catch (e) {}
                }
            }
        }
        throw lastErr;
    }

    static async getReportRafaelDetail(config: {
        host?: string | null;
        database?: string | null;
        user?: string | null;
        password?: string | null;
    }, startDate: string, endDate: string, cdFilial: string, cdProduto: string, isDorsal: boolean = false): Promise<any[]> {
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
                idleTimeoutMillis: 30000
            },
            options: {
                encrypt: false,
                trustServerCertificate: true,
                connectTimeout: 30000,
                requestTimeout: 60000
            },
            connectionTimeout: 30000,
            requestTimeout: 60000
        };

        const filials = cdFilial.split(',')
            .map(f => f.trim())
            .filter(f => /^[a-zA-Z0-9_-]+$/.test(f))
            .map(f => `'${f}'`)
            .join(',');

        if (!filials) {
            throw new Error('Nenhuma filial válida informada.');
        }

        let lastErr: any = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
            let pool: any = null;
            try {
                pool = await new sql.ConnectionPool(sqlConfig).connect();
                const request = pool.request();
                request.input('startDate', sql.VarChar, `${startDate} 00:00:00`);
                request.input('endDate', sql.VarChar, `${endDate} 23:59:59`);
                request.input('cdProduto', sql.BigInt, cdProduto);

                const filialJoin = isDorsal 
                    ? `AND tbSuperProduto.cdFilial = tbProduto.cdFilial` 
                    : ``;

                const query = `
                    SELECT 
                        tbCupom.dtCupom, 
                        tbCupomItem.gdCupom,
                        tbCupomItem.nrItem,
                        tbCupomItem.cdProduto,
                        tbProduto.cdSuperProduto,
                        ISNULL(tbProduto.nrMultiplicador, 1) as nrMultiplicador,
                        tbCupomItem.qtItem, 
                        tbCliente.Nome as Cliente, 
                        tbCupomItem.vlItem as valorUnitario,
                        (tbCupomItem.vlItem * tbCupomItem.qtItem - ISNULL(tbCupomItem.vlDesconto, 0)) as valorTotal,
                        (ISNULL(tbCupomItem.vlCusto, 0) * ISNULL(tbProduto.nrMultiplicador, 1)) as custoUnitarioVenda,
                        (ISNULL(tbCupomItem.vlCusto, 0) * ISNULL(tbProduto.nrMultiplicador, 1) * tbCupomItem.qtItem) as valorCustoVenda,
                        (tbSuperProduto.vlCusto * ISNULL(tbProduto.nrMultiplicador, 1)) as custoUnitarioDia,
                        (tbSuperProduto.vlCusto * ISNULL(tbProduto.nrMultiplicador, 1) * tbCupomItem.qtItem) as valorCustoDia,
                        tbOperador.nmOperador as Operador
                    FROM tbCupomItem
                    INNER JOIN tbCupom ON tbCupomItem.gdCupom = tbCupom.gdCupom
                    LEFT OUTER JOIN tbProduto ON tbProduto.cdEmpresa = tbCupom.cdEmpresa
                                             AND tbProduto.cdFilial = tbCupom.cdFilial
                                             AND tbProduto.cdProduto = tbCupomItem.cdProduto
                    LEFT OUTER JOIN tbSuperProduto ON tbSuperProduto.cdEmpresa = tbProduto.cdEmpresa
                                                 ${filialJoin}
                                                 AND tbSuperProduto.cdSuperProduto = tbProduto.cdSuperProduto
                    LEFT OUTER JOIN tbCliente ON tbCupom.cdCliente = tbCliente.cdCliente
                    LEFT OUTER JOIN tbOperador ON tbCupom.cdOperador = tbOperador.cdOperador 
                                            AND tbCupom.cdEmpresa = tbOperador.cdEmpresa
                                            AND tbCupom.cdFilial = tbOperador.cdFilial
                    WHERE tbCupomItem.cdProduto = @cdProduto
                      AND (tbCupom.dtCupom BETWEEN @startDate AND @endDate)
                      AND (tbCupom.cdEmpresa = 10)
                      AND (tbCupom.cdFilial IN (${filials}))
                    ORDER BY tbCupom.dtCupom DESC
                `;

                const result = await request.query(query);
                return result.recordset || [];
            } catch (err: any) {
                lastErr = err;
                if (attempt < 2) {
                    await new Promise(r => setTimeout(r, 800));
                }
            } finally {
                if (pool) {
                    try { await pool.close(); } catch (e) {}
                }
            }
        }
        throw lastErr;
    }

    static async updateReportRafaelCosts(
        config: {
            host?: string | null;
            database?: string | null;
            user?: string | null;
            password?: string | null;
        },
        params: {
            cdProduto: string;
            cdFilial: string;
            startDate?: string | null | undefined;
            endDate?: string | null | undefined;
            custoUnitarioVenda?: number | null | undefined;
            custoUnitarioDia?: number | null | undefined;
            items?: Array<{
                gdCupom: string;
                nrItem: number;
                custoUnitarioVenda: number;
            }> | undefined;
        },
        isDorsal: boolean = false
    ): Promise<{ updatedSalesItems: number; updatedProducts: number }> {
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
                idleTimeoutMillis: 30000
            },
            options: {
                encrypt: false,
                trustServerCertificate: true,
                connectTimeout: 30000,
                requestTimeout: 60000
            },
            connectionTimeout: 30000,
            requestTimeout: 60000
        };

        const filials = (params.cdFilial || '1').split(',')
            .map(f => f.trim())
            .filter(f => /^[a-zA-Z0-9_-]+$/.test(f))
            .map(f => `'${f}'`)
            .join(',');

        if (!filials) {
            throw new Error('Nenhuma filial válida informada.');
        }

        let updatedSalesItems = 0;
        let updatedProducts = 0;

        let lastErr: any = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
            let pool: any = null;
            try {
                pool = await new sql.ConnectionPool(sqlConfig).connect();

                // 1. Update Custo Unit. Dia in tbSuperProduto if provided
                if (params.custoUnitarioDia !== undefined && params.custoUnitarioDia !== null && !isNaN(Number(params.custoUnitarioDia))) {
                    const reqSuper = pool.request();
                    reqSuper.input('custoUnitarioDia', sql.Decimal(18, 4), Number(params.custoUnitarioDia));
                    reqSuper.input('cdProduto', sql.BigInt, params.cdProduto);

                    const filialSuperJoin = isDorsal 
                        ? `AND tbSuperProduto.cdFilial = tbProduto.cdFilial` 
                        : ``;

                    const querySuper = `
                        UPDATE tbSuperProduto
                        SET tbSuperProduto.vlCusto = @custoUnitarioDia / CASE WHEN ISNULL(tbProduto.nrMultiplicador, 1) = 0 THEN 1 ELSE ISNULL(tbProduto.nrMultiplicador, 1) END
                        FROM tbSuperProduto
                        INNER JOIN tbProduto ON tbSuperProduto.cdEmpresa = tbProduto.cdEmpresa
                                            ${filialSuperJoin}
                                            AND tbSuperProduto.cdSuperProduto = tbProduto.cdSuperProduto
                        WHERE tbProduto.cdProduto = @cdProduto
                          AND tbProduto.cdEmpresa = 10
                          AND (tbProduto.cdFilial IN (${filials}))
                    `;
                    const resSuper = await reqSuper.query(querySuper);
                    if (resSuper.rowsAffected && resSuper.rowsAffected.length > 0) {
                        updatedProducts += resSuper.rowsAffected.reduce((a: number, b: number) => a + b, 0);
                    }
                }

                // 2. Update specific items if provided
                if (Array.isArray(params.items) && params.items.length > 0) {
                    for (const item of params.items) {
                        if (item.gdCupom && item.nrItem !== undefined && item.custoUnitarioVenda !== undefined) {
                            const reqItem = pool.request();
                            reqItem.input('custoUnitarioVenda', sql.Decimal(18, 4), Number(item.custoUnitarioVenda));
                            reqItem.input('gdCupom', sql.UniqueIdentifier, item.gdCupom);
                            reqItem.input('nrItem', sql.Int, item.nrItem);

                            const queryItem = `
                                UPDATE tbCupomItem
                                SET tbCupomItem.vlCusto = @custoUnitarioVenda / CASE WHEN ISNULL(tbProduto.nrMultiplicador, 1) = 0 THEN 1 ELSE ISNULL(tbProduto.nrMultiplicador, 1) END
                                FROM tbCupomItem
                                INNER JOIN tbCupom ON tbCupomItem.gdCupom = tbCupom.gdCupom
                                LEFT OUTER JOIN tbProduto ON tbProduto.cdEmpresa = tbCupom.cdEmpresa
                                                         AND tbProduto.cdFilial = tbCupom.cdFilial
                                                         AND tbProduto.cdProduto = tbCupomItem.cdProduto
                                WHERE tbCupomItem.gdCupom = @gdCupom
                                  AND tbCupomItem.nrItem = @nrItem
                            `;
                            const resItem = await reqItem.query(queryItem);
                            if (resItem.rowsAffected && resItem.rowsAffected.length > 0) {
                                updatedSalesItems += resItem.rowsAffected.reduce((a: number, b: number) => a + b, 0);
                            }
                        }
                    }
                } else if (params.custoUnitarioVenda !== undefined && params.custoUnitarioVenda !== null && !isNaN(Number(params.custoUnitarioVenda))) {
                    // Update all sales items for cdProduto in date range
                    const reqAll = pool.request();
                    reqAll.input('custoUnitarioVenda', sql.Decimal(18, 4), Number(params.custoUnitarioVenda));
                    reqAll.input('cdProduto', sql.BigInt, params.cdProduto);
                    reqAll.input('startDate', sql.VarChar, `${params.startDate || '2000-01-01'} 00:00:00`);
                    reqAll.input('endDate', sql.VarChar, `${params.endDate || '2099-12-31'} 23:59:59`);

                    const queryAll = `
                        UPDATE tbCupomItem
                        SET tbCupomItem.vlCusto = @custoUnitarioVenda / CASE WHEN ISNULL(tbProduto.nrMultiplicador, 1) = 0 THEN 1 ELSE ISNULL(tbProduto.nrMultiplicador, 1) END
                        FROM tbCupomItem
                        INNER JOIN tbCupom ON tbCupomItem.gdCupom = tbCupom.gdCupom
                        LEFT OUTER JOIN tbProduto ON tbProduto.cdEmpresa = tbCupom.cdEmpresa
                                                 AND tbProduto.cdFilial = tbCupom.cdFilial
                                                 AND tbProduto.cdProduto = tbCupomItem.cdProduto
                        WHERE tbCupomItem.cdProduto = @cdProduto
                          AND (tbCupom.dtCupom BETWEEN @startDate AND @endDate)
                          AND (tbCupom.cdEmpresa = 10)
                          AND (tbCupom.cdFilial IN (${filials}))
                    `;
                    const resAll = await reqAll.query(queryAll);
                    if (resAll.rowsAffected && resAll.rowsAffected.length > 0) {
                        updatedSalesItems += resAll.rowsAffected.reduce((a: number, b: number) => a + b, 0);
                    }
                }

                return { updatedSalesItems, updatedProducts };
            } catch (err: any) {
                lastErr = err;
                if (attempt < 2) {
                    await new Promise(r => setTimeout(r, 800));
                }
            } finally {
                if (pool) {
                    try { await pool.close(); } catch (e) {}
                }
            }
        }
        throw lastErr;
    }

    static async getSolidconChartOfAccounts(
        config: {
            host?: string | null;
            database?: string | null;
            user?: string | null;
            password?: string | null;
        },
        cdPlanoContas?: number
    ): Promise<any[]> {
        let server = (config.host || '').trim();
        let port = 1433;
        if (server.includes('190.107.93.66')) {
            server = server.replace('190.107.93.66', 'n13884.ddns.net');
        }
        if (server.includes(',')) {
            const parts = server.split(',');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || 1433;
        } else if (server.includes(':')) {
            const parts = server.split(':');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || 1433;
        }

        let database = (config.database || 'solidcon').trim();
        if (database.toLowerCase() === 'dorsal' || !database) {
            database = 'solidcon';
        }

        const sqlConfig: sql.config = {
            user: (config.user || 'aporttec').trim(),
            password: config.password || '',
            database: database,
            server: server || 'n13884.ddns.net',
            port: port,
            pool: {
                max: 5,
                min: 0,
                idleTimeoutMillis: 30000
            },
            options: {
                encrypt: false,
                trustServerCertificate: true,
                connectTimeout: 20000,
                requestTimeout: 60000
            },
            connectionTimeout: 20000,
            requestTimeout: 60000
        };

        let lastErr: any = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
            let pool: any = null;
            try {
                const currentConfig = { ...sqlConfig };
                if (attempt === 2 && currentConfig.server !== 'n13884.ddns.net') {
                    currentConfig.server = 'n13884.ddns.net';
                    currentConfig.port = 1433;
                }
                pool = await new sql.ConnectionPool(currentConfig).connect();
                const request = pool.request();
                
                let filterClause = '';
                if (cdPlanoContas) {
                    request.input('cdPlanoContas', sql.Int, cdPlanoContas);
                    filterClause = 'WHERE c.cdPlanoContas = @cdPlanoContas';
                }

                const query = `
                    SELECT 
                        c.cdPlanoContas,
                        ISNULL(p.Nome, 'Plano de Contas') AS nmPlanoContas,
                        c.cdContaContabil,
                        c.Codigo,
                        c.Nome,
                        c.CodigoRapido,
                        c.cdContaContabilPai,
                        c.cdOrigem,
                        c.CodigoSPED,
                        c.inAnalitica,
                        c.inMensal,
                        c.dtInclusao,
                        c.dtAlteracao,
                        c.cdNaturezaDaConta,
                        CASE 
                            WHEN c.cdNaturezaDaConta = '01' THEN 'debit'
                            WHEN c.cdNaturezaDaConta = '02' THEN 'credit'
                            WHEN c.Codigo LIKE '1%' OR c.Codigo LIKE '5%' OR c.Codigo LIKE '6%' THEN 'debit'
                            ELSE 'credit'
                        END AS nature,
                        CASE 
                            WHEN c.inAnalitica = 1 THEN 'analytic'
                            ELSE 'synthetic'
                        END AS type
                    FROM tbCntContaContabil c WITH (NOLOCK)
                    LEFT JOIN tbCntPlanoContas p WITH (NOLOCK) ON p.cdPlanoContas = c.cdPlanoContas
                    ${filterClause}
                    ORDER BY c.Codigo ASC
                `;

                const result = await request.query(query);
                return result.recordset || [];
            } catch (err: any) {
                lastErr = err;
                if (attempt < 2) {
                    await new Promise(r => setTimeout(r, 600));
                }
            } finally {
                if (pool) {
                    try { await pool.close(); } catch (e) {}
                }
            }
        }
        throw lastErr;
    }

    static async getSolidconAccountingEntries(
        config: {
            host?: string | null;
            database?: string | null;
            user?: string | null;
            password?: string | null;
        },
        params: {
            startDate: string;
            endDate: string;
            source?: 'all' | 'cnt_lancamento' | 'banco_movimento' | 'conta_baixa' | string | null | undefined;
            cdFilial?: string | null | undefined;
        }
    ): Promise<any[]> {
        let server = (config.host || '').trim();
        let port = 1433;
        if (server.includes('190.107.93.66')) {
            server = server.replace('190.107.93.66', 'n13884.ddns.net');
        }
        if (server.includes(',')) {
            const parts = server.split(',');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || 1433;
        } else if (server.includes(':')) {
            const parts = server.split(':');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || 1433;
        }

        let database = (config.database || 'solidcon').trim();
        if (database.toLowerCase() === 'dorsal' || !database) {
            database = 'solidcon';
        }

        const sqlConfig: sql.config = {
            user: (config.user || 'aporttec').trim(),
            password: config.password || '',
            database: database,
            server: server || 'n13884.ddns.net',
            port: port,
            pool: {
                max: 5,
                min: 0,
                idleTimeoutMillis: 30000
            },
            options: {
                encrypt: false,
                trustServerCertificate: true,
                connectTimeout: 20000,
                requestTimeout: 60000
            },
            connectionTimeout: 20000,
            requestTimeout: 60000
        };

        const source = params.source || 'all';
        const cdFilial = params.cdFilial ? String(params.cdFilial).trim() : '';

        let lastErr: any = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
            let pool: any = null;
            try {
                const currentConfig = { ...sqlConfig };
                if (attempt === 2 && currentConfig.server !== 'n13884.ddns.net') {
                    currentConfig.server = 'n13884.ddns.net';
                    currentConfig.port = 1433;
                }
                pool = await new sql.ConnectionPool(currentConfig).connect();
                const results: any[] = [];

                const startClean = (String(params.startDate || '').split('T')[0] || '').trim().substring(0, 10);
                const endClean = (String(params.endDate || '').split('T')[0] || '').trim().substring(0, 10);

                // Helper para identificar débito / crédito em diversos formatos do Solidcon
                const isDebitPartida = (p: any): boolean => {
                    if (p.inDebito === true || p.inDebito === 1 || p.inDebito === '1') return true;
                    if (typeof p.inDebito === 'string') {
                        const val = p.inDebito.trim().toUpperCase();
                        return val === 'D' || val === 'S' || val === 'T' || val === 'TRUE' || val === 'SIM';
                    }
                    return false;
                };

                const isCreditPartida = (p: any): boolean => {
                    if (p.inDebito === false || p.inDebito === 0 || p.inDebito === '0') return true;
                    if (typeof p.inDebito === 'string') {
                        const val = p.inDebito.trim().toUpperCase();
                        return val === 'C' || val === 'N' || val === 'F' || val === 'FALSE' || val === 'NAO' || val === 'NÃO';
                    }
                    return false;
                };

                // 1. Lançamentos Contábeis do Módulo Contábil Solidcon (tbCntLancamentoContabil)
                if (source === 'all' || source === 'cnt_lancamento') {
                    const req1 = pool.request();
                    req1.input('startDate', sql.VarChar, startClean);
                    req1.input('endDate', sql.VarChar, endClean);

                    let filialClause1 = '';
                    if (cdFilial) {
                        req1.input('cdFilial', sql.Int, parseInt(cdFilial, 10));
                        filialClause1 = 'AND l.cdPessoaFilial = @cdFilial';
                    }

                    const query1 = `
                        SELECT 
                            l.cdLancamentoContabil,
                            CONVERT(VARCHAR(10), l.dtLancamento, 120) as entry_date,
                            CAST(ISNULL(l.nrDocumento, l.cdLancamentoContabil) AS VARCHAR) as document_ref,
                            ISNULL(l.Descricao, 'Lançamento Contábil') as history,
                            p.cdLancamentoContabilPartida,
                            p.cdContaContabil,
                            c.Codigo as account_code,
                            c.Nome as account_name,
                            c.CodigoRapido as account_easy_code,
                            CAST(p.Valor AS FLOAT) as amount,
                            p.inDebito,
                            p.HistoricoComplementar,
                            l.cdPessoaFilial as cdFilial
                        FROM tbCntLancamentoContabil l WITH (NOLOCK)
                        JOIN tbCntLancamentoContabilPartida p WITH (NOLOCK) ON p.cdLancamentoContabil = l.cdLancamentoContabil
                        OUTER APPLY (
                            SELECT TOP 1 c.Codigo, c.Nome, c.CodigoRapido
                            FROM tbCntContaContabil c WITH (NOLOCK)
                            WHERE c.cdContaContabil = p.cdContaContabil
                            ORDER BY c.inAnalitica DESC, c.cdPlanoContas DESC
                        ) c
                        WHERE CAST(l.dtLancamento AS DATE) BETWEEN @startDate AND @endDate
                          ${filialClause1}
                        ORDER BY l.dtLancamento ASC, l.cdLancamentoContabil ASC, p.cdLancamentoContabilPartida ASC
                    `;

                    try {
                        const res1 = await req1.query(query1);
                        const rawPartidas = res1.recordset || [];
                        
                        // Deduplicar partidas brutas por chave composta (cdLancamentoContabil + cdLancamentoContabilPartida)
                        const uniquePartidasMap = new Map<string, any>();
                        rawPartidas.forEach((p: any) => {
                            const key = `${p.cdLancamentoContabil}_${p.cdLancamentoContabilPartida}`;
                            if (!uniquePartidasMap.has(key)) {
                                uniquePartidasMap.set(key, p);
                            }
                        });

                        // Agrupar partidas por cdLancamentoContabil
                        const groupedByLaunch = new Map<number, any[]>();
                        uniquePartidasMap.forEach((p) => {
                            if (!groupedByLaunch.has(p.cdLancamentoContabil)) {
                                groupedByLaunch.set(p.cdLancamentoContabil, []);
                            }
                            groupedByLaunch.get(p.cdLancamentoContabil)!.push(p);
                        });

                        groupedByLaunch.forEach((partidas, launchId) => {
                            const debits = partidas.filter(p => isDebitPartida(p));
                            const credits = partidas.filter(p => isCreditPartida(p));
                            const base = partidas[0] || {};

                            if (debits.length > 0 && credits.length > 0) {
                                if (debits.length === 1 && credits.length === 1) {
                                    // 1 Débito para 1 Crédito (Lançamento Simples)
                                    const d = debits[0];
                                    const c = credits[0];
                                    results.push({
                                        id: `cnt_${launchId}_${d.cdLancamentoContabilPartida}_${c.cdLancamentoContabilPartida}`,
                                        entry_date: d.entry_date || base.entry_date,
                                        document_ref: String(d.document_ref || base.document_ref || launchId),
                                        history: d.HistoricoComplementar || c.HistoricoComplementar || base.history || 'Lançamento Contábil Solidcon',
                                        amount: Number(d.amount || c.amount || 0),
                                        debit_account_code: d.account_code || '',
                                        debit_account_name: d.account_name || '',
                                        debit_account_easy_code: d.account_easy_code ? String(d.account_easy_code) : '',
                                        credit_account_code: c.account_code || '',
                                        credit_account_name: c.account_name || '',
                                        credit_account_easy_code: c.account_easy_code ? String(c.account_easy_code) : '',
                                        source: 'cnt_lancamento',
                                        source_label: 'Lançamento Contábil',
                                        cdFilial: base.cdFilial || 1
                                    });
                                } else if (debits.length === 1 && credits.length > 1) {
                                    // 1 Débito para Vários Créditos
                                    const d = debits[0];
                                    credits.forEach(c => {
                                        results.push({
                                            id: `cnt_${launchId}_${d.cdLancamentoContabilPartida}_${c.cdLancamentoContabilPartida}`,
                                            entry_date: c.entry_date || base.entry_date,
                                            document_ref: String(c.document_ref || base.document_ref || launchId),
                                            history: c.HistoricoComplementar || d.HistoricoComplementar || base.history || 'Lançamento Contábil Solidcon',
                                            amount: Number(c.amount || 0),
                                            debit_account_code: d.account_code || '',
                                            debit_account_name: d.account_name || '',
                                            debit_account_easy_code: d.account_easy_code ? String(d.account_easy_code) : '',
                                            credit_account_code: c.account_code || '',
                                            credit_account_name: c.account_name || '',
                                            credit_account_easy_code: c.account_easy_code ? String(c.account_easy_code) : '',
                                            source: 'cnt_lancamento',
                                            source_label: 'Lançamento Contábil',
                                            cdFilial: base.cdFilial || 1
                                        });
                                    });
                                } else if (credits.length === 1 && debits.length > 1) {
                                    // Vários Débitos para 1 Crédito
                                    const c = credits[0];
                                    debits.forEach(d => {
                                        results.push({
                                            id: `cnt_${launchId}_${d.cdLancamentoContabilPartida}_${c.cdLancamentoContabilPartida}`,
                                            entry_date: d.entry_date || base.entry_date,
                                            document_ref: String(d.document_ref || base.document_ref || launchId),
                                            history: d.HistoricoComplementar || c.HistoricoComplementar || base.history || 'Lançamento Contábil Solidcon',
                                            amount: Number(d.amount || 0),
                                            debit_account_code: d.account_code || '',
                                            debit_account_name: d.account_name || '',
                                            debit_account_easy_code: d.account_easy_code ? String(d.account_easy_code) : '',
                                            credit_account_code: c.account_code || '',
                                            credit_account_name: c.account_name || '',
                                            credit_account_easy_code: c.account_easy_code ? String(c.account_easy_code) : '',
                                            source: 'cnt_lancamento',
                                            source_label: 'Lançamento Contábil',
                                            cdFilial: base.cdFilial || 1
                                        });
                                    });
                                } else {
                                    // Múltiplos Débitos (N) e Múltiplos Créditos (M):
                                    // Pareamento inteligente sem descarte de nenhuma partida!
                                    const usedDebitIndices = new Set<number>();
                                    const usedCreditIndices = new Set<number>();

                                    // Passo 1: Pareamento por valor exato
                                    debits.forEach((d, dIdx) => {
                                        const cIdx = credits.findIndex((c, idx) => !usedCreditIndices.has(idx) && Math.abs(Number(c.amount) - Number(d.amount)) < 0.01);
                                        if (cIdx !== -1) {
                                            usedDebitIndices.add(dIdx);
                                            usedCreditIndices.add(cIdx);
                                            const c = credits[cIdx];
                                            results.push({
                                                id: `cnt_${launchId}_${d.cdLancamentoContabilPartida}_${c.cdLancamentoContabilPartida}`,
                                                entry_date: d.entry_date || c.entry_date || base.entry_date,
                                                document_ref: String(d.document_ref || c.document_ref || base.document_ref || launchId),
                                                history: d.HistoricoComplementar || c.HistoricoComplementar || base.history || 'Lançamento Contábil Solidcon',
                                                amount: Number(d.amount || c.amount || 0),
                                                debit_account_code: d.account_code || '',
                                                debit_account_name: d.account_name || '',
                                                debit_account_easy_code: d.account_easy_code ? String(d.account_easy_code) : '',
                                                credit_account_code: c.account_code || '',
                                                credit_account_name: c.account_name || '',
                                                credit_account_easy_code: c.account_easy_code ? String(c.account_easy_code) : '',
                                                source: 'cnt_lancamento',
                                                source_label: 'Lançamento Contábil',
                                                cdFilial: d.cdFilial || c.cdFilial || base.cdFilial || 1
                                            });
                                        }
                                    });

                                    // Passo 2: Pareamento 1-a-1 das restantes
                                    const remainingDebits = debits.map((d, idx) => ({ d, idx })).filter(item => !usedDebitIndices.has(item.idx));
                                    const remainingCredits = credits.map((c, idx) => ({ c, idx })).filter(item => !usedCreditIndices.has(item.idx));
                                    const minRemaining = Math.min(remainingDebits.length, remainingCredits.length);

                                    for (let i = 0; i < minRemaining; i++) {
                                        const pairD = remainingDebits[i];
                                        const pairC = remainingCredits[i];
                                        if (!pairD || !pairC) continue;
                                        const { d, idx: dIdx } = pairD;
                                        const { c, idx: cIdx } = pairC;
                                        usedDebitIndices.add(dIdx);
                                        usedCreditIndices.add(cIdx);
                                        results.push({
                                            id: `cnt_${launchId}_${d.cdLancamentoContabilPartida}_${c.cdLancamentoContabilPartida}`,
                                            entry_date: d.entry_date || c.entry_date || base.entry_date,
                                            document_ref: String(d.document_ref || c.document_ref || base.document_ref || launchId),
                                            history: d.HistoricoComplementar || c.HistoricoComplementar || base.history || 'Lançamento Contábil Solidcon',
                                            amount: Number(d.amount || c.amount || 0),
                                            debit_account_code: d.account_code || '',
                                            debit_account_name: d.account_name || '',
                                            debit_account_easy_code: d.account_easy_code ? String(d.account_easy_code) : '',
                                            credit_account_code: c.account_code || '',
                                            credit_account_name: c.account_name || '',
                                            credit_account_easy_code: c.account_easy_code ? String(c.account_easy_code) : '',
                                            source: 'cnt_lancamento',
                                            source_label: 'Lançamento Contábil',
                                            cdFilial: d.cdFilial || c.cdFilial || base.cdFilial || 1
                                        });
                                    }

                                    // Passo 3: Débitos excedentes (se houver mais débitos que créditos)
                                    const leftoverDebits = remainingDebits.slice(minRemaining);
                                    const primaryCredit = credits[0];
                                    leftoverDebits.forEach(({ d }) => {
                                        results.push({
                                            id: `cnt_${launchId}_d_${d.cdLancamentoContabilPartida}`,
                                            entry_date: d.entry_date || base.entry_date,
                                            document_ref: String(d.document_ref || base.document_ref || launchId),
                                            history: d.HistoricoComplementar || base.history || 'Lançamento Contábil Solidcon',
                                            amount: Number(d.amount || 0),
                                            debit_account_code: d.account_code || '',
                                            debit_account_name: d.account_name || '',
                                            debit_account_easy_code: d.account_easy_code ? String(d.account_easy_code) : '',
                                            credit_account_code: primaryCredit?.account_code || '',
                                            credit_account_name: primaryCredit?.account_name || '',
                                            credit_account_easy_code: primaryCredit?.account_easy_code ? String(primaryCredit.account_easy_code) : '',
                                            source: 'cnt_lancamento',
                                            source_label: 'Lançamento Contábil',
                                            cdFilial: d.cdFilial || base.cdFilial || 1
                                        });
                                    });

                                    // Passo 4: Créditos excedentes (se houver mais créditos que débitos)
                                    const leftoverCredits = remainingCredits.slice(minRemaining);
                                    const primaryDebit = debits[0];
                                    leftoverCredits.forEach(({ c }) => {
                                        results.push({
                                            id: `cnt_${launchId}_c_${c.cdLancamentoContabilPartida}`,
                                            entry_date: c.entry_date || base.entry_date,
                                            document_ref: String(c.document_ref || base.document_ref || launchId),
                                            history: c.HistoricoComplementar || base.history || 'Lançamento Contábil Solidcon',
                                            amount: Number(c.amount || 0),
                                            debit_account_code: primaryDebit?.account_code || '',
                                            debit_account_name: primaryDebit?.account_name || '',
                                            debit_account_easy_code: primaryDebit?.account_easy_code ? String(primaryDebit.account_easy_code) : '',
                                            credit_account_code: c.account_code || '',
                                            credit_account_name: c.account_name || '',
                                            credit_account_easy_code: c.account_easy_code ? String(c.account_easy_code) : '',
                                            source: 'cnt_lancamento',
                                            source_label: 'Lançamento Contábil',
                                            cdFilial: c.cdFilial || base.cdFilial || 1
                                        });
                                    });
                                }
                            } else {
                                partidas.forEach(p => {
                                    const isDeb = isDebitPartida(p);
                                    results.push({
                                        id: `cnt_${launchId}_${p.cdLancamentoContabilPartida}`,
                                        entry_date: p.entry_date || base.entry_date,
                                        document_ref: String(p.document_ref || base.document_ref || launchId),
                                        history: p.HistoricoComplementar || p.history || 'Lançamento Contábil Solidcon',
                                        amount: Number(p.amount || 0),
                                        debit_account_code: isDeb ? (p.account_code || '') : '',
                                        debit_account_name: isDeb ? (p.account_name || '') : '',
                                        debit_account_easy_code: isDeb && p.account_easy_code ? String(p.account_easy_code) : '',
                                        credit_account_code: !isDeb ? (p.account_code || '') : '',
                                        credit_account_name: !isDeb ? (p.account_name || '') : '',
                                        credit_account_easy_code: !isDeb && p.account_easy_code ? String(p.account_easy_code) : '',
                                        source: 'cnt_lancamento',
                                        source_label: 'Lançamento Contábil',
                                        cdFilial: p.cdFilial || base.cdFilial || 1
                                    });
                                });
                            }
                        });
                    } catch (e) {
                        // ignore table error if not populated
                    }
                }

                // 2. Movimentações Bancárias / Caixa (tbBancoContaMovimento)
                if (source === 'all' || source === 'banco_movimento') {
                    const req2 = pool.request();
                    req2.input('startDate', sql.VarChar, startClean);
                    req2.input('endDate', sql.VarChar, endClean);

                    let filialClause2 = '';
                    if (cdFilial) {
                        req2.input('cdFilial', sql.Int, parseInt(cdFilial, 10));
                        filialClause2 = 'AND m.cdPessoaFilialBancoConta = @cdFilial';
                    }

                    const query2 = `
                        SELECT 
                            m.cdBancoContaMovimento as id,
                            CONVERT(VARCHAR(10), m.dtLancamento, 120) as entry_date,
                            CAST(ISNULL(m.Numero, m.cdBancoContaMovimento) AS VARCHAR) as document_ref,
                            ISNULL(m.Historico, 'Movimento Bancário') as history,
                            CAST(CASE WHEN ISNULL(m.vlDebito, 0) > 0 THEN m.vlDebito ELSE m.vlCredito END AS FLOAT) as amount,
                            CASE WHEN ISNULL(m.vlDebito, 0) > 0 THEN 'debit' ELSE 'credit' END as bank_operation,
                            bc.nmConta as bank_name,
                            bc.ContaNumero as bank_account_number,
                            bc.txContaContabil as bank_accounting_code,
                            m.cdPessoaFilialBancoConta as cdFilial
                        FROM tbBancoContaMovimento m WITH (NOLOCK)
                        LEFT JOIN tbBancoConta bc WITH (NOLOCK) ON bc.cdBancoConta = m.cdBancoConta
                        WHERE CAST(m.dtLancamento AS DATE) BETWEEN @startDate AND @endDate
                          AND (m.inCancelado IS NULL OR m.inCancelado = 0)
                          AND (ISNULL(m.vlDebito, 0) > 0 OR ISNULL(m.vlCredito, 0) > 0)
                          ${filialClause2}
                        ORDER BY m.dtLancamento ASC, m.cdBancoContaMovimento ASC
                    `;

                    try {
                        const res2 = await req2.query(query2);
                        const bcmRows = res2.recordset || [];
                        bcmRows.forEach((m: any) => {
                            const isDeb = m.bank_operation === 'debit';
                            const bankDesc = m.bank_name ? ` (${m.bank_name})` : '';
                            results.push({
                                id: `bcm_${m.id}`,
                                entry_date: m.entry_date,
                                document_ref: String(m.document_ref || m.id),
                                history: `${m.history || 'Movimento Bancário'}${bankDesc}`,
                                amount: Number(m.amount || 0),
                                debit_account_code: isDeb ? (m.bank_accounting_code || '') : '',
                                debit_account_name: isDeb ? (m.bank_name ? `Banco/Caixa: ${m.bank_name}` : '') : '',
                                debit_account_easy_code: '',
                                credit_account_code: !isDeb ? (m.bank_accounting_code || '') : '',
                                credit_account_name: !isDeb ? (m.bank_name ? `Banco/Caixa: ${m.bank_name}` : '') : '',
                                credit_account_easy_code: '',
                                bank_operation: m.bank_operation,
                                bank_name: m.bank_name,
                                source: 'banco_movimento',
                                source_label: 'Movimento Bancário / Caixa',
                                cdFilial: m.cdFilial || 1
                            });
                        });
                    } catch (e) {
                        // ignore
                    }
                }

                // 3. Baixas de Contas a Pagar / Receber (vwaporttec_contas com fallback para tbContaBaixa)
                if (source === 'all' || source === 'conta_baixa') {
                    let queriedView = false;
                    try {
                        const req3View = pool.request();
                        req3View.input('startDate', sql.VarChar, startClean);
                        req3View.input('endDate', sql.VarChar, endClean);

                        let filialClause3View = '';
                        if (cdFilial) {
                            req3View.input('cdFilial', sql.Int, parseInt(cdFilial, 10));
                            filialClause3View = 'AND cb.cdfilial = @cdFilial';
                        }

                        const query3View = `
                            SELECT 
                                cb.cdcontabaixa as id,
                                CONVERT(VARCHAR(10), cb.dtbaixa, 120) as entry_date,
                                CAST(cb.cdcontabaixa AS VARCHAR) as document_ref,
                                ISNULL(
                                    NULLIF(
                                        CONCAT(
                                            ISNULL(cb.tipoconta, ''),
                                            CASE WHEN cb.tipoconta IS NOT NULL AND cb.conta IS NOT NULL THEN ' - ' ELSE '' END,
                                            ISNULL(cb.conta, ''),
                                            CASE WHEN cb.referencia IS NOT NULL AND cb.referencia <> '' THEN ' (' + cb.referencia + ')' ELSE '' END
                                        ),
                                        ''
                                    ),
                                    ISNULL(cb.referencia, 'Baixa Financeira')
                                ) as history,
                                CAST(cb.vlbaixa AS FLOAT) as amount,
                                CASE WHEN cb.tipo = 'Receitas' THEN 'receipt' ELSE 'payment' END as operation,
                                ISNULL(cb.nmbanco, 'Caixa/Banco') as bank_name,
                                cb.cdfilial as cdFilial
                            FROM vwaporttec_contas cb WITH (NOLOCK)
                            WHERE CAST(cb.dtbaixa AS DATE) BETWEEN @startDate AND @endDate
                              AND cb.vlbaixa > 0
                              ${filialClause3View}
                            ORDER BY cb.dtbaixa ASC, cb.cdcontabaixa ASC
                        `;

                        const res3View = await req3View.query(query3View);
                        const viewRows = res3View.recordset || [];
                        if (viewRows.length > 0) {
                            queriedView = true;
                            viewRows.forEach((cb: any) => {
                                const isReceipt = cb.operation === 'receipt';
                                const bankDesc = cb.bank_name ? ` via ${cb.bank_name}` : '';
                                results.push({
                                    id: `cb_${cb.id}`,
                                    entry_date: cb.entry_date,
                                    document_ref: String(cb.document_ref || cb.id),
                                    history: `${cb.history || 'Baixa de Título'}${bankDesc}`,
                                    amount: Number(cb.amount || 0),
                                    debit_account_code: isReceipt ? '' : '',
                                    debit_account_name: isReceipt ? (cb.bank_name ? `Banco: ${cb.bank_name}` : '') : '',
                                    debit_account_easy_code: '',
                                    credit_account_code: !isReceipt ? '' : '',
                                    credit_account_name: !isReceipt ? (cb.bank_name ? `Banco: ${cb.bank_name}` : '') : '',
                                    credit_account_easy_code: '',
                                    operation: cb.operation,
                                    source: 'conta_baixa',
                                    source_label: 'Baixa Financeira',
                                    cdFilial: cb.cdFilial || 1
                                });
                            });
                        }
                    } catch (e) {
                        // ignore view error and fallback
                    }

                    if (!queriedView) {
                        const req3 = pool.request();
                        req3.input('startDate', sql.VarChar, startClean);
                        req3.input('endDate', sql.VarChar, endClean);

                        let filialClause3 = '';
                        if (cdFilial) {
                            req3.input('cdFilial', sql.Int, parseInt(cdFilial, 10));
                            filialClause3 = 'AND cb.cdPessoaFilialContaBaixa = @cdFilial';
                        }

                        const query3 = `
                            SELECT 
                                cb.cdContaBaixa as id,
                                CONVERT(VARCHAR(10), cb.dtContaBaixa, 120) as entry_date,
                                CAST(ISNULL(cb.Documento, cb.cdContaBaixa) AS VARCHAR) as document_ref,
                                ISNULL(cb.Historico, CASE WHEN cb.inRecebimento = 1 THEN 'Recebimento de Conta' ELSE 'Pagamento de Conta' END) as history,
                                CAST(cb.vlContaBaixa AS FLOAT) as amount,
                                CASE WHEN cb.inRecebimento = 1 THEN 'receipt' ELSE 'payment' END as operation,
                                bc.nmConta as bank_name,
                                bc.txContaContabil as bank_accounting_code,
                                cb.cdPessoaFilialContaBaixa as cdFilial
                            FROM tbContaBaixa cb WITH (NOLOCK)
                            LEFT JOIN tbBancoConta bc WITH (NOLOCK) ON bc.cdBancoConta = cb.cdBancoConta
                            WHERE CAST(cb.dtContaBaixa AS DATE) BETWEEN @startDate AND @endDate
                              AND cb.vlContaBaixa > 0
                              ${filialClause3}
                            ORDER BY cb.dtContaBaixa ASC, cb.cdContaBaixa ASC
                        `;

                        try {
                            const res3 = await req3.query(query3);
                            const cbRows = res3.recordset || [];
                            cbRows.forEach((cb: any) => {
                                const isReceipt = cb.operation === 'receipt';
                                const bankDesc = cb.bank_name ? ` via ${cb.bank_name}` : '';
                                results.push({
                                    id: `cb_${cb.id}`,
                                    entry_date: cb.entry_date,
                                    document_ref: String(cb.document_ref || cb.id),
                                    history: `${cb.history || 'Baixa de Título'}${bankDesc}`,
                                    amount: Number(cb.amount || 0),
                                    debit_account_code: isReceipt ? (cb.bank_accounting_code || '') : '',
                                    debit_account_name: isReceipt ? (cb.bank_name ? `Banco: ${cb.bank_name}` : '') : '',
                                    debit_account_easy_code: '',
                                    credit_account_code: !isReceipt ? (cb.bank_accounting_code || '') : '',
                                    credit_account_name: !isReceipt ? (cb.bank_name ? `Banco: ${cb.bank_name}` : '') : '',
                                    credit_account_easy_code: '',
                                    operation: cb.operation,
                                    source: 'conta_baixa',
                                    source_label: 'Baixa Financeira',
                                    cdFilial: cb.cdFilial || 1
                                });
                            });
                        } catch (e) {
                            // ignore
                        }
                    }
                }

                // Deduplicação final por chave única
                const seenIds = new Set<string>();
                const uniqueResults: any[] = [];
                results.forEach(r => {
                    if (!seenIds.has(r.id)) {
                        seenIds.add(r.id);
                        uniqueResults.push(r);
                    }
                });

                return uniqueResults;
            } catch (err: any) {
                lastErr = err;
                if (attempt < 2) {
                    await new Promise(r => setTimeout(r, 600));
                }
            } finally {
                if (pool) {
                    try { await pool.close(); } catch (e) {}
                }
            }
        }
        throw lastErr;
    }

    static async testSolidconConnection(config: {
        host?: string | null | undefined;
        port?: string | number | null | undefined;
        database?: string | null | undefined;
        user?: string | null | undefined;
        password?: string | null | undefined;
    }): Promise<{ success: boolean; message: string; details?: any }> {
        let server = (config.host || '').trim();
        let port = Number(config.port) || 1433;

        if (server.includes(',')) {
            const parts = server.split(',');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || 1433;
        } else if (server.includes(':')) {
            const parts = server.split(':');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || 1433;
        }

        const user = (config.user || '').trim();
        const password = config.password || '';
        const database = (config.database || '').trim();

        if (!server) {
            throw new Error('Servidor Solidcon (IP/Host) não informado.');
        }
        if (!database) {
            throw new Error('Banco de Dados Solidcon não informado.');
        }
        if (!user) {
            throw new Error('Login/Usuário Solidcon não informado.');
        }

        const sqlConfig: sql.config = {
            user: user,
            password: password,
            database: database,
            server: server,
            port: port,
            pool: { max: 1, min: 0, idleTimeoutMillis: 5000 },
            options: { encrypt: false, trustServerCertificate: true },
            connectionTimeout: 8000,
            requestTimeout: 8000
        };

        try {
            const pool = await sql.connect(sqlConfig);
            try {
                const req = pool.request();
                const res = await req.query('SELECT @@VERSION as version, DB_NAME() as current_db');
                const versionStr = res.recordset?.[0]?.version || 'SQL Server';
                const currentDb = res.recordset?.[0]?.current_db || database;
                return {
                    success: true,
                    message: `Conexão com o banco de dados Solidcon (${currentDb}) estabelecida com sucesso!`,
                    details: {
                        server: server,
                        port: port,
                        database: currentDb,
                        version: versionStr
                    }
                };
            } finally {
                await pool.close();
            }
        } catch (err: any) {
            let msg = err.message || String(err);
            if (msg.includes('ELOGIN') || msg.includes('Login failed')) {
                msg = `Falha de autenticação ao conectar no banco Solidcon (${server}:${port}). Verifique o usuário e a senha.`;
            } else if (msg.includes('ETIMEOUT') || msg.includes('ESOCKET') || msg.includes('ECONNREFUSED')) {
                msg = `Não foi possível conectar ao servidor Solidcon (${server}:${port}). Verifique o IP/Host e se o servidor está acessível.`;
            }
            throw new Error(msg);
        }
    }

    static async testDorsalConnection(config: {
        host?: string | null | undefined;
        port?: string | number | null | undefined;
        database?: string | null | undefined;
        user?: string | null | undefined;
        password?: string | null | undefined;
    }): Promise<{ success: boolean; message: string; details?: any }> {
        let server = (config.host || '').trim();
        let port = Number(config.port) || 1433;

        if (server.includes(',')) {
            const parts = server.split(',');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || 1433;
        } else if (server.includes(':')) {
            const parts = server.split(':');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || 1433;
        }

        const user = (config.user || '').trim();
        const password = config.password || '';
        const database = (config.database || '').trim();

        if (!server) {
            throw new Error('Servidor Dorsal (IP/Host) não informado.');
        }
        if (!database) {
            throw new Error('Banco de Dados Dorsal não informado.');
        }
        if (!user) {
            throw new Error('Login/Usuário Dorsal não informado.');
        }

        const sqlConfig: sql.config = {
            user: user,
            password: password,
            database: database,
            server: server,
            port: port,
            pool: { max: 1, min: 0, idleTimeoutMillis: 5000 },
            options: { encrypt: false, trustServerCertificate: true },
            connectionTimeout: 8000,
            requestTimeout: 8000
        };

        try {
            const pool = await sql.connect(sqlConfig);
            try {
                const req = pool.request();
                const res = await req.query('SELECT @@VERSION as version, DB_NAME() as current_db');
                const versionStr = res.recordset?.[0]?.version || 'SQL Server';
                const currentDb = res.recordset?.[0]?.current_db || database;
                return {
                    success: true,
                    message: `Conexão com o banco de dados Dorsal (${currentDb}) estabelecida com sucesso!`,
                    details: {
                        server: server,
                        port: port,
                        database: currentDb,
                        version: versionStr
                    }
                };
            } finally {
                await pool.close();
            }
        } catch (err: any) {
            let msg = err.message || String(err);
            if (msg.includes('ELOGIN') || msg.includes('Login failed')) {
                msg = `Falha de autenticação ao conectar no banco Dorsal (${server}:${port}). Verifique o usuário e a senha.`;
            } else if (msg.includes('ETIMEOUT') || msg.includes('ESOCKET') || msg.includes('ECONNREFUSED')) {
                msg = `Não foi possível conectar ao servidor Dorsal (${server}:${port}). Verifique o IP/Host e se o servidor está acessível.`;
            }
            throw new Error(msg);
        }
    }

    static async testAlterdataConnection(config: {
        host?: string | null | undefined;
        port?: string | number | null | undefined;
        database?: string | null | undefined;
        user?: string | null | undefined;
        password?: string | null | undefined;
    }): Promise<{ success: boolean; message: string; details?: any }> {
        let server = (config.host || '').trim();
        let port = Number(config.port) || 0;

        if (server.includes(',')) {
            const parts = server.split(',');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || port;
        } else if (server.includes(':')) {
            const parts = server.split(':');
            server = (parts[0] || '').trim();
            port = parseInt((parts[1] || '').trim(), 10) || port;
        }

        const user = (config.user || '').trim();
        const password = config.password || '';
        const database = (config.database || '').trim();

        if (!server) {
            throw new Error('Servidor (Host/IP) não informado.');
        }
        if (!database) {
            throw new Error('Nome do banco de dados não informado.');
        }
        if (!user) {
            throw new Error('Usuário de conexão não informado.');
        }

        // Se porta for 1433, tenta SQL Server
        if (port === 1433) {
            return await this.testSqlServerDirect({ server, port, database, user, password });
        }

        // Por padrão tenta PostgreSQL (porta 5432 se não especificada)
        const pgPort = port || 5432;
        try {
            const client = new PgClient({
                host: server,
                port: pgPort,
                database: database,
                user: user,
                password: password,
                connectionTimeoutMillis: 8000,
                statement_timeout: 8000,
            });

            await client.connect();
            const res = await client.query('SELECT version();');
            await client.end();

            const versionStr = res.rows?.[0]?.version || 'PostgreSQL';
            return {
                success: true,
                message: 'Conexão com o banco de dados Alterdata estabelecida com sucesso!',
                details: {
                    type: 'PostgreSQL',
                    server,
                    port: pgPort,
                    database,
                    version: versionStr
                }
            };
        } catch (pgError: any) {
            // Se a porta não foi especificada ou foi 1433, tenta SQL Server como fallback
            if (!port || port === 1433) {
                try {
                    return await this.testSqlServerDirect({ server, port: port || 1433, database, user, password });
                } catch (_sqlErr) {
                    // Ignora fallback e prossegue com a mensagem do PostgreSQL
                }
            }

            let msg = pgError.message || String(pgError);
            if (msg.includes('ETIMEDOUT') || msg.includes('timeout')) {
                msg = `Tempo limite de conexão esgotado ao tentar alcançar ${server}:${pgPort}. Verifique se o servidor está online e acessível.`;
            } else if (msg.includes('ECONNREFUSED')) {
                msg = `Conexão recusada em ${server}:${pgPort}. Verifique se o banco de dados está ativo nesta porta.`;
            } else if (msg.includes('password authentication failed') || msg.includes('28P01')) {
                msg = `Falha de autenticação: usuário ou senha incorretos para "${user}".`;
            } else if (msg.includes('database') && msg.includes('does not exist')) {
                msg = `O banco de dados "${database}" não existe no servidor ${server}.`;
            }

            throw new Error(msg);
        }
    }

    private static async testSqlServerDirect(config: {
        server: string;
        port: number;
        database: string;
        user: string;
        password: string;
    }): Promise<{ success: boolean; message: string; details?: any }> {
        const sqlConfig: sql.config = {
            user: config.user,
            password: config.password,
            database: config.database,
            server: config.server,
            port: config.port || 1433,
            pool: { max: 1, min: 0, idleTimeoutMillis: 5000 },
            options: { encrypt: false, trustServerCertificate: true },
            connectionTimeout: 8000,
            requestTimeout: 8000
        };

        const pool = await sql.connect(sqlConfig);
        try {
            const req = pool.request();
            const res = await req.query('SELECT @@VERSION as version');
            const versionStr = res.recordset?.[0]?.version || 'SQL Server';
            return {
                success: true,
                message: 'Conexão com o banco de dados Alterdata estabelecida com sucesso!',
                details: {
                    type: 'SQL Server',
                    server: config.server,
                    port: config.port,
                    database: config.database,
                    version: versionStr
                }
            };
        } finally {
            await pool.close();
        }
    }

    static async getReportPedidosDorsal(config: {
        host?: string | null;
        database?: string | null;
        user?: string | null;
        password?: string | null;
    }, startDate: string, endDate: string, cdFilial?: string, inCancelado?: string): Promise<any[]> {
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
            connectionTimeout: 15000,
            requestTimeout: 30000
        };

        const pool = await sql.connect(sqlConfig);
        try {
            const request = pool.request();
            request.input('startDate', sql.VarChar, `${startDate} 00:00:00`);
            request.input('endDate', sql.VarChar, `${endDate} 23:59:59`);

            let filialFilter = '1=1';
            if (cdFilial && cdFilial.trim()) {
                const filials = cdFilial.split(',')
                    .map(f => f.trim())
                    .filter(f => /^[a-zA-Z0-9_-]+$/.test(f))
                    .map(f => `'${f}'`)
                    .join(',');
                if (filials) {
                    filialFilter = `(TRY_CAST(p.cdFilial AS VARCHAR) IN (${filials}) OR CAST(p.cdFilial AS VARCHAR) IN (${filials}))`;
                }
            }

            let cancelFilter = '';
            if (inCancelado === '1' || inCancelado === 'true' || inCancelado === 'cancelados') {
                cancelFilter = 'AND (p.inCancelado = 1 OR p.dtCancelado IS NOT NULL)';
            } else if (inCancelado === '0' || inCancelado === 'false' || inCancelado === 'ativos') {
                cancelFilter = 'AND (p.inCancelado = 0 OR p.inCancelado IS NULL) AND p.dtCancelado IS NULL';
            } else if (inCancelado === 'finalizados') {
                cancelFilter = 'AND (p.inCancelado = 0 OR p.inCancelado IS NULL) AND p.dtCancelado IS NULL AND (p.hrRegistro IS NOT NULL OR p.hrEmissao IS NOT NULL OR p.nrCupom IS NOT NULL OR p.COO IS NOT NULL OR p.ValorRegistrado IS NOT NULL)';
            } else if (inCancelado === 'nao_finalizados' || inCancelado === 'abertos' || inCancelado === 'pendentes') {
                cancelFilter = 'AND (p.inCancelado = 0 OR p.inCancelado IS NULL) AND p.dtCancelado IS NULL AND p.hrRegistro IS NULL AND p.hrEmissao IS NULL AND p.nrCupom IS NULL AND p.COO IS NULL AND p.ValorRegistrado IS NULL';
            }

            const query = `
                SELECT 
                    p.cdEmpresa,
                    p.cdFilial,
                    p.cdPedido,
                    p.cdCliente,
                    p.dtPedido,
                    p.hrInclusao,
                    p.hrSeparacaoInicio,
                    p.hrSeparacaoFim,
                    p.hrConferenciaInicio,
                    p.hrConferenciaFim,
                    p.hrEmissao,
                    p.hrRegistro,
                    p.hrEnvio,
                    p.hrEntrega,
                    p.cdPDV,
                    p.nrCupom,
                    p.nmCliente,
                    p.Endereco,
                    p.Bairro,
                    p.Cidade,
                    p.CEP,
                    p.Telefone,
                    p.txPagamento,
                    p.txEmbalagem,
                    p.COO,
                    p.inCancelado,
                    p.dtCancelado,
                    CASE 
                        WHEN p.inCancelado = 1 OR p.dtCancelado IS NOT NULL THEN 'CANCELADO'
                        WHEN p.hrRegistro IS NOT NULL OR p.hrEmissao IS NOT NULL OR p.nrCupom IS NOT NULL OR p.COO IS NOT NULL OR p.ValorRegistrado IS NOT NULL THEN 'FINALIZADO'
                        ELSE 'NAO_FINALIZADO'
                    END AS statusPedido,
                    ISNULL(p.vlTotal, (
                        SELECT ISNULL(SUM(ISNULL(i.qtPedido, 0) * ISNULL(i.vlProduto, 0)), 0)
                        FROM tbPedidoItem i WITH (NOLOCK)
                        WHERE i.cdEmpresa = p.cdEmpresa 
                          AND i.cdFilial = p.cdFilial 
                          AND i.cdPedido = p.cdPedido
                    )) AS vlTotal,
                    p.vlDesconto,
                    p.vlFrete,
                    p.cdUsuario,
                    p.cdVendedor,
                    COALESCE(v.nmVendedor, op.nmOperador, CAST(p.cdVendedor AS VARCHAR), CAST(p.cdUsuario AS VARCHAR), 'LOJA') AS nmOperador,
                    v.nmVendedor,
                    op.nmOperador AS nmOperadorUsuario,
                    (
                        SELECT COUNT(*) 
                        FROM tbPedidoItem i WITH (NOLOCK)
                        WHERE i.cdEmpresa = p.cdEmpresa AND i.cdFilial = p.cdFilial AND i.cdPedido = p.cdPedido
                    ) AS totalItens,
                    STUFF((
                        SELECT ', ' + COALESCE(
                            NULLIF(i.nmProduto, ''),
                            NULLIF(spDirect.nmProduto, ''),
                            NULLIF(spDirect.nmProdutoPDV, ''),
                            NULLIF(spViaProd.nmProduto, ''),
                            NULLIF(spViaProd.nmProdutoPDV, ''),
                            'Prod #' + CAST(i.cdProdutoPedido AS VARCHAR)
                        )
                        FROM tbPedidoItem i WITH (NOLOCK)
                        LEFT JOIN tbSuperProduto spDirect WITH (NOLOCK)
                            ON spDirect.cdEmpresa = i.cdEmpresa AND spDirect.cdFilial = i.cdFilial AND spDirect.cdSuperProduto = i.cdProdutoPedido
                        LEFT JOIN tbProduto prod WITH (NOLOCK) 
                            ON prod.cdEmpresa = i.cdEmpresa AND prod.cdFilial = i.cdFilial AND CAST(prod.cdProduto AS VARCHAR) = CAST(i.cdProdutoPedido AS VARCHAR)
                        LEFT JOIN tbSuperProduto spViaProd WITH (NOLOCK) 
                            ON spViaProd.cdEmpresa = prod.cdEmpresa AND spViaProd.cdFilial = prod.cdFilial AND spViaProd.cdSuperProduto = prod.cdSuperProduto
                        WHERE i.cdEmpresa = p.cdEmpresa AND i.cdFilial = p.cdFilial AND i.cdPedido = p.cdPedido
                        ORDER BY i.cdItem ASC
                        FOR XML PATH(''), TYPE
                    ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS produtosResumo,
                    p.Obs,
                    p.ObsInterna,
                    p.idPedidoIFood,
                    p.inCanceladoIFood,
                    p.ValorRegistrado
                FROM tbPedido p WITH (NOLOCK)
                LEFT JOIN tbVendedor v WITH (NOLOCK) 
                    ON v.cdEmpresa = p.cdEmpresa AND v.cdFilial = p.cdFilial AND v.cdVendedor = p.cdVendedor
                LEFT JOIN tbOperador op WITH (NOLOCK) 
                    ON op.cdEmpresa = p.cdEmpresa AND op.cdFilial = p.cdFilial AND op.cdOperador = p.cdUsuario
                WHERE p.dtPedido BETWEEN @startDate AND @endDate
                  AND ${filialFilter}
                  ${cancelFilter}
                ORDER BY p.dtPedido DESC, p.cdPedido DESC
            `;

            const result = await request.query(query);
            return result.recordset || [];
        } finally {
            if (pool) {
                try {
                    await pool.close();
                } catch {
                    // ignore
                }
            }
        }
    }

    static async getReportPedidoDorsalItems(config: {
        host?: string | null;
        database?: string | null;
        user?: string | null;
        password?: string | null;
    }, cdPedido: string, cdFilial?: string): Promise<any[]> {
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
                max: 3,
                min: 0,
                idleTimeoutMillis: 10000
            },
            options: {
                encrypt: false,
                trustServerCertificate: true
            },
            connectionTimeout: 10000,
            requestTimeout: 20000
        };

        const pool = await sql.connect(sqlConfig);
        try {
            const request = pool.request();
            request.input('cdPedido', sql.VarChar, String(cdPedido));

            let filialFilter = '';
            if (cdFilial && cdFilial.trim()) {
                request.input('cdFilial', sql.VarChar, String(cdFilial));
                filialFilter = 'AND (i.cdFilial = @cdFilial OR CAST(i.cdFilial AS VARCHAR) = @cdFilial)';
            }

            const query = `
                SELECT 
                    i.cdEmpresa,
                    i.cdFilial,
                    i.cdPedido,
                    i.cdItem,
                    i.cdProdutoPedido,
                    COALESCE(
                        NULLIF(i.nmProduto, ''),
                        NULLIF(spDirect.nmProduto, ''),
                        NULLIF(spDirect.nmProdutoPDV, ''),
                        NULLIF(spViaProd.nmProduto, ''),
                        NULLIF(spViaProd.nmProdutoPDV, ''),
                        'Produto #' + CAST(i.cdProdutoPedido AS VARCHAR)
                    ) AS nmProduto,
                    i.qtPedido,
                    i.vlProduto,
                    i.qtAtendido,
                    i.vlProdutoVendaNormal,
                    i.vlDesconto,
                    i.inCancelado,
                    i.cdUnidade,
                    i.Obs
                FROM tbPedidoItem i WITH (NOLOCK)
                LEFT JOIN tbSuperProduto spDirect WITH (NOLOCK)
                    ON spDirect.cdEmpresa = i.cdEmpresa AND spDirect.cdFilial = i.cdFilial AND spDirect.cdSuperProduto = i.cdProdutoPedido
                LEFT JOIN tbProduto prod WITH (NOLOCK) 
                    ON prod.cdEmpresa = i.cdEmpresa AND prod.cdFilial = i.cdFilial AND CAST(prod.cdProduto AS VARCHAR) = CAST(i.cdProdutoPedido AS VARCHAR)
                LEFT JOIN tbSuperProduto spViaProd WITH (NOLOCK) 
                    ON spViaProd.cdEmpresa = prod.cdEmpresa AND spViaProd.cdFilial = prod.cdFilial AND spViaProd.cdSuperProduto = prod.cdSuperProduto
                WHERE i.cdPedido = @cdPedido
                  ${filialFilter}
                ORDER BY i.cdItem ASC
            `;

            const result = await request.query(query);
            return result.recordset || [];
        } finally {
            if (pool) {
                try {
                    await pool.close();
                } catch {
                    // ignore
                }
            }
        }
    }

    /**
     * Consulta dados consolidados da Visão Financeira Solidcon por Mês e Ano,
     * gerando dados para gráficos de Receitas vs Despesas, evolução diária,
     * comparativo anual, bancos e listagem de movimentações.
     */
    static async getSolidconFinanceVisionData(
        config: {
            host?: string | null;
            database?: string | null;
            user?: string | null;
            password?: string | null;
        },
        params: {
            ano: number;
            mes?: number | string | null;
            cdFilial?: string | null;
            source?: 'conta_baixa' | 'banco_movimento' | 'consolidado' | string | null;
            convDateFilter?: 'baixa' | 'emissao' | string | null;
            dtInicioCrediario?: string | null;
            dtFimCrediario?: string | null;
            tipoDataCrediario?: 'vencimento' | 'emissao' | string | null;
            includeCrediario?: boolean | string | null;
            includeCartoes?: boolean | string | null;
            dtInicioCartoes?: string | null;
            dtFimCartoes?: string | null;
            tipoDataCartoes?: 'previsao' | 'venda' | string | null;
            includeContasPagar?: boolean | string | null;
            dtInicioContasPagar?: string | null;
            dtFimContasPagar?: string | null;
            tipoDataContasPagar?: 'vencimento' | 'emissao' | string | null;
        }
    ): Promise<any> {
        let server = (config.host || '').trim();
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

        if (!server) {
            throw new Error('Servidor Solidcon não informado para esta empresa.');
        }

        let database = (config.database || 'solidcon').trim();
        if (database.toLowerCase() === 'dorsal' || !database) {
            database = 'solidcon';
        }

        const sqlConfig: sql.config = {
            user: (config.user || 'aporttec').trim(),
            password: config.password || '',
            database: database,
            server: server,
            port: port,
            pool: {
                max: 5,
                min: 0,
                idleTimeoutMillis: 30000
            },
            options: {
                encrypt: false,
                trustServerCertificate: true,
                connectTimeout: 20000,
                requestTimeout: 60000
            },
            connectionTimeout: 20000,
            requestTimeout: 60000
        };

        const ano = Number(params.ano) || new Date().getFullYear();
        let mes = params.mes ? parseInt(String(params.mes), 10) : (new Date().getMonth() + 1);
        if (isNaN(mes) || mes < 1 || mes > 12) {
            mes = new Date().getMonth() + 1;
        }
        const cdFilial = params.cdFilial ? String(params.cdFilial).trim() : '';
        const source = params.source || 'conta_baixa';

        const MONTH_NAMES = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];

        let pool: any = null;
        try {
            pool = await new sql.ConnectionPool(sqlConfig).connect();

                let filialClauseView = '';
                let filialClauseBcm = '';
                if (cdFilial) {
                    const filialNum = parseInt(cdFilial, 10);
                    if (!isNaN(filialNum)) {
                        filialClauseView = ` AND cdfilial = ${filialNum}`;
                        filialClauseBcm = ` AND m.cdPessoaFilialBancoConta = ${filialNum}`;
                    }
                }

                // Filtro para ocultar bancos/contas inativos (inInativo = 1 ou nome contendo INATIVO)
                const inactiveBankClauseView = " AND (cdbanco IS NULL OR cdbanco NOT IN (SELECT _bc.cdBancoConta FROM tbBancoConta _bc WITH (NOLOCK) WHERE _bc.inInativo = 1 OR _bc.nmConta LIKE '%INATIV%')) AND (nmbanco IS NULL OR nmbanco NOT LIKE '%INATIV%')";
                const inactiveBankClauseBcm = " AND (m.cdBancoConta IS NULL OR m.cdBancoConta NOT IN (SELECT _bc.cdBancoConta FROM tbBancoConta _bc WITH (NOLOCK) WHERE _bc.inInativo = 1 OR _bc.nmConta LIKE '%INATIV%')) AND (bc.nmConta IS NULL OR bc.nmConta NOT LIKE '%INATIV%')";

                // 1. Resumo Anual (12 Meses)
                const reqAnual = pool.request();
                reqAnual.input('ano', sql.Int, ano);

                let queryAnual = '';
                if (source === 'banco_movimento') {
                    queryAnual = `
                        SELECT 
                            MONTH(m.dtLancamento) as mes,
                            SUM(ISNULL(m.vlCredito, 0)) as receita,
                            SUM(ISNULL(m.vlDebito, 0)) as despesa,
                            COUNT(CASE WHEN ISNULL(m.vlCredito, 0) > 0 THEN 1 END) as qtd_receita,
                            COUNT(CASE WHEN ISNULL(m.vlDebito, 0) > 0 THEN 1 END) as qtd_despesa
                        FROM tbBancoContaMovimento m WITH (NOLOCK)
                        LEFT JOIN tbBancoConta bc WITH (NOLOCK) ON bc.cdBancoConta = m.cdBancoConta
                        WHERE YEAR(m.dtLancamento) = @ano
                          AND (m.inCancelado IS NULL OR m.inCancelado = 0)
                          ${filialClauseBcm}
                          ${inactiveBankClauseBcm}
                        GROUP BY MONTH(m.dtLancamento)
                        ORDER BY mes ASC
                    `;
                } else {
                    // vwaporttec_contas
                    queryAnual = `
                        SELECT 
                            mes,
                            SUM(CASE WHEN tipo = 'Receitas' THEN vlbaixa ELSE 0 END) as receita,
                            SUM(CASE WHEN tipo = 'Despesas' THEN vlbaixa ELSE 0 END) as despesa,
                            COUNT(CASE WHEN tipo = 'Receitas' THEN 1 END) as qtd_receita,
                            COUNT(CASE WHEN tipo = 'Despesas' THEN 1 END) as qtd_despesa
                        FROM vwaporttec_contas WITH (NOLOCK)
                        WHERE ano = @ano
                          ${filialClauseView}
                          ${inactiveBankClauseView}
                        GROUP BY mes
                        ORDER BY mes ASC
                    `;
                }

                const resAnual = await reqAnual.query(queryAnual);
                const anualRows = resAnual.recordset || [];

                // Mapeia todos os 12 meses (mesmo os zerados)
                const monthlyComparison = Array.from({ length: 12 }, (_, idx) => {
                    const mNum = idx + 1;
                    const found = anualRows.find((r: any) => r.mes === mNum);
                    const rec = found ? Number(found.receita || 0) : 0;
                    const desp = found ? Number(found.despesa || 0) : 0;
                    const qtdRec = found ? Number(found.qtd_receita || 0) : 0;
                    const qtdDesp = found ? Number(found.qtd_despesa || 0) : 0;
                    return {
                        mes: mNum,
                        mesNome: MONTH_NAMES[idx] || '',
                        mesSigla: (MONTH_NAMES[idx] || '').slice(0, 3),
                        receita: rec,
                        despesa: desp,
                        saldo: rec - desp,
                        qtd_receita: qtdRec,
                        qtd_despesa: qtdDesp
                    };
                });

                // 2. Evolução Diária do Mês Selecionado
                const reqDiario = pool.request();
                reqDiario.input('ano', sql.Int, ano);
                reqDiario.input('mes', sql.Int, mes);

                let queryDiario = '';
                if (source === 'banco_movimento') {
                    queryDiario = `
                        SELECT 
                            DAY(m.dtLancamento) as dia,
                            CONVERT(VARCHAR(10), m.dtLancamento, 120) as data,
                            SUM(ISNULL(m.vlCredito, 0)) as receita,
                            SUM(ISNULL(m.vlDebito, 0)) as despesa,
                            COUNT(CASE WHEN ISNULL(m.vlCredito, 0) > 0 THEN 1 END) as qtd_receita,
                            COUNT(CASE WHEN ISNULL(m.vlDebito, 0) > 0 THEN 1 END) as qtd_despesa
                        FROM tbBancoContaMovimento m WITH (NOLOCK)
                        LEFT JOIN tbBancoConta bc WITH (NOLOCK) ON bc.cdBancoConta = m.cdBancoConta
                        WHERE YEAR(m.dtLancamento) = @ano AND MONTH(m.dtLancamento) = @mes
                          AND (m.inCancelado IS NULL OR m.inCancelado = 0)
                          ${filialClauseBcm}
                          ${inactiveBankClauseBcm}
                        GROUP BY DAY(m.dtLancamento), CONVERT(VARCHAR(10), m.dtLancamento, 120)
                        ORDER BY dia ASC
                    `;
                } else {
                    // vwaporttec_contas
                    queryDiario = `
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
                          ${inactiveBankClauseView}
                        GROUP BY dia, CONVERT(VARCHAR(10), dtbaixa, 120)
                        ORDER BY dia ASC
                    `;
                }

                const resDiario = await reqDiario.query(queryDiario);
                const dailyRows = resDiario.recordset || [];

                // Descobrir dias no mês
                const daysInMonth = new Date(ano, mes, 0).getDate();
                const dailyEvolution = Array.from({ length: daysInMonth }, (_, idx) => {
                    const diaNum = idx + 1;
                    const found = dailyRows.find((r: any) => r.dia === diaNum);
                    const rec = found ? Number(found.receita || 0) : 0;
                    const desp = found ? Number(found.despesa || 0) : 0;
                    const dateFormatted = `${ano}-${String(mes).padStart(2, '0')}-${String(diaNum).padStart(2, '0')}`;
                    return {
                        dia: diaNum,
                        data: found?.data || dateFormatted,
                        receita: rec,
                        despesa: desp,
                        saldo: rec - desp,
                        qtd_receita: found ? Number(found.qtd_receita || 0) : 0,
                        qtd_despesa: found ? Number(found.qtd_despesa || 0) : 0
                    };
                });

                // 3. Distribuição por Banco / Conta no Mês
                const reqBancos = pool.request();
                reqBancos.input('ano', sql.Int, ano);
                reqBancos.input('mes', sql.Int, mes);

                let queryBancos = '';
                if (source === 'banco_movimento') {
                    queryBancos = `
                        SELECT 
                            ISNULL(bc.nmConta, 'Não Informado') as banco,
                            ISNULL(CAST(bc.ContaNumero AS VARCHAR(50)), '') as conta_numero,
                            SUM(ISNULL(m.vlCredito, 0)) as receita,
                            SUM(ISNULL(m.vlDebito, 0)) as despesa,
                            COUNT(*) as qtd
                        FROM tbBancoContaMovimento m WITH (NOLOCK)
                        LEFT JOIN tbBancoConta bc WITH (NOLOCK) ON bc.cdBancoConta = m.cdBancoConta
                        WHERE YEAR(m.dtLancamento) = @ano AND MONTH(m.dtLancamento) = @mes
                          AND (m.inCancelado IS NULL OR m.inCancelado = 0)
                          ${filialClauseBcm}
                          ${inactiveBankClauseBcm}
                        GROUP BY ISNULL(bc.nmConta, 'Não Informado'), ISNULL(CAST(bc.ContaNumero AS VARCHAR(50)), '')
                        ORDER BY (SUM(ISNULL(m.vlCredito, 0)) + SUM(ISNULL(m.vlDebito, 0))) DESC
                    `;
                } else {
                    // vwaporttec_contas
                    queryBancos = `
                        SELECT 
                            ISNULL(nmbanco, 'Caixa / Outros') as banco,
                            ISNULL(CAST(cdbanco AS VARCHAR(50)), '') as conta_numero,
                            SUM(CASE WHEN tipo = 'Receitas' THEN vlbaixa ELSE 0 END) as receita,
                            SUM(CASE WHEN tipo = 'Despesas' THEN vlbaixa ELSE 0 END) as despesa,
                            COUNT(*) as qtd
                        FROM vwaporttec_contas WITH (NOLOCK)
                        WHERE ano = @ano AND mes = @mes
                          ${filialClauseView}
                          ${inactiveBankClauseView}
                        GROUP BY ISNULL(nmbanco, 'Caixa / Outros'), ISNULL(CAST(cdbanco AS VARCHAR(50)), '')
                        ORDER BY (SUM(CASE WHEN tipo = 'Receitas' THEN vlbaixa ELSE 0 END) + SUM(CASE WHEN tipo = 'Despesas' THEN vlbaixa ELSE 0 END)) DESC
                    `;
                }

                const resBancos = await reqBancos.query(queryBancos);
                const byBank = (resBancos.recordset || []).map((b: any) => ({
                    banco: b.banco,
                    conta_numero: b.conta_numero,
                    receita: Number(b.receita || 0),
                    despesa: Number(b.despesa || 0),
                    saldo: Number(b.receita || 0) - Number(b.despesa || 0),
                    total_movimentado: Number(b.receita || 0) + Number(b.despesa || 0),
                    qtd: Number(b.qtd || 0)
                }));

                // 4. Distribuição por Categorias / Tipos de Conta
                let byCategory: any[] = [];
                if (source !== 'banco_movimento') {
                    try {
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
                              ${inactiveBankClauseView}
                            GROUP BY tipo, tipoconta
                            ORDER BY valor DESC
                        `);
                        byCategory = (resCats.recordset || []).map((c: any) => ({
                            tipo: c.tipo,
                            tipoconta: c.tipoconta,
                            valor: Number(c.valor || 0),
                            qtd: Number(c.qtd || 0)
                        }));
                    } catch {
                        byCategory = [];
                    }
                }

                // 4.1 Distribuição Anual por Categorias / Tipos de Conta (12 Meses)
                let annualByCategory: any[] = [];
                if (source !== 'banco_movimento') {
                    try {
                        const reqAnnualCats = pool.request();
                        reqAnnualCats.input('ano', sql.Int, ano);
                        const resAnnualCats = await reqAnnualCats.query(`
                            SELECT 
                                mes,
                                CASE WHEN tipo = 'Receitas' THEN 'receita' ELSE 'despesa' END as tipo,
                                ISNULL(tipoconta, 'Outros') as tipoconta,
                                SUM(vlbaixa) as valor,
                                COUNT(*) as qtd
                            FROM vwaporttec_contas WITH (NOLOCK)
                            WHERE ano = @ano
                              ${filialClauseView}
                              ${inactiveBankClauseView}
                            GROUP BY mes, tipo, tipoconta
                            ORDER BY mes ASC, valor DESC
                        `);
                        annualByCategory = (resAnnualCats.recordset || []).map((c: any) => ({
                            mes: Number(c.mes),
                            tipo: c.tipo,
                            tipoconta: c.tipoconta,
                            valor: Number(c.valor || 0),
                            qtd: Number(c.qtd || 0)
                        }));
                    } catch {
                        annualByCategory = [];
                    }
                }

                // 5. Listagem Detalhada das Movimentações do Mês (Top 500)
                const reqTrans = pool.request();
                reqTrans.input('ano', sql.Int, ano);
                reqTrans.input('mes', sql.Int, mes);

                let queryTrans = '';
                if (source === 'banco_movimento') {
                    queryTrans = `
                        SELECT TOP 500
                            m.cdBancoContaMovimento as id,
                            CONVERT(VARCHAR(10), m.dtLancamento, 120) as data,
                            COALESCE(CAST(m.Numero AS VARCHAR(50)), CAST(m.cdBancoContaMovimento AS VARCHAR(50)), '') as documento,
                            ISNULL(m.Historico, 'Movimento Bancário') as historico,
                            CASE WHEN ISNULL(m.vlCredito, 0) > 0 THEN 'receita' ELSE 'despesa' END as tipo,
                            CAST(CASE WHEN ISNULL(m.vlCredito, 0) > 0 THEN m.vlCredito ELSE m.vlDebito END AS FLOAT) as valor,
                            ISNULL(bc.nmConta, 'Caixa/Banco') as banco,
                            m.cdPessoaFilialBancoConta as filial,
                            '' as nome_filial,
                            '' as tipoconta,
                            '' as conta,
                            '' as referencia
                        FROM tbBancoContaMovimento m WITH (NOLOCK)
                        LEFT JOIN tbBancoConta bc WITH (NOLOCK) ON bc.cdBancoConta = m.cdBancoConta
                        WHERE YEAR(m.dtLancamento) = @ano AND MONTH(m.dtLancamento) = @mes
                          AND (m.inCancelado IS NULL OR m.inCancelado = 0)
                          AND (ISNULL(m.vlDebito, 0) > 0 OR ISNULL(m.vlCredito, 0) > 0)
                          ${filialClauseBcm}
                          ${inactiveBankClauseBcm}
                        ORDER BY m.dtLancamento DESC, m.cdBancoContaMovimento DESC
                    `;
                } else {
                    // vwaporttec_contas
                    queryTrans = `
                        SELECT TOP 500
                            cdcontabaixa as id,
                            cdcontabaixa,
                            CONVERT(VARCHAR(10), dtbaixa, 120) as data,
                            CAST(cdcontabaixa AS VARCHAR(50)) as documento,
                            ISNULL(
                                NULLIF(
                                    CONCAT(
                                        ISNULL(tipoconta, ''),
                                        CASE WHEN tipoconta IS NOT NULL AND conta IS NOT NULL THEN ' - ' ELSE '' END,
                                        ISNULL(conta, ''),
                                        CASE WHEN referencia IS NOT NULL AND referencia <> '' THEN ' (' + referencia + ')' ELSE '' END
                                    ),
                                    ''
                                ),
                                ISNULL(referencia, 'Lançamento')
                            ) as historico,
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
                          ${inactiveBankClauseView}
                        ORDER BY dtbaixa DESC, cdcontabaixa DESC
                    `;
                }

                const resTrans = await reqTrans.query(queryTrans);
                const transactions = (resTrans.recordset || []).map((t: any) => ({
                    id: t.id,
                    cdcontabaixa: t.cdcontabaixa ?? t.id ?? null,
                    data: t.data,
                    documento: String(t.documento || '-'),
                    historico: t.historico || '-',
                    tipo: t.tipo,
                    valor: Number(t.valor || 0),
                    banco: t.banco,
                    filial: t.filial || 1,
                    nome_filial: t.nome_filial || '',
                    tipoconta: t.tipoconta || '',
                    conta: t.conta || '',
                    referencia: t.referencia || ''
                }));

                // 6. Lista de Filiais Existentes
                let filiais: any[] = [];
                try {
                    const reqFiliais = pool.request();
                    const resFiliais = await reqFiliais.query(`
                        SELECT DISTINCT cdfilial as id, ISNULL(filial, CONCAT('Filial ', CAST(cdfilial AS VARCHAR(20)))) as nome
                        FROM vwaporttec_contas WITH (NOLOCK)
                        WHERE cdfilial IS NOT NULL
                          ${inactiveBankClauseView}
                        ORDER BY cdfilial ASC
                    `);
                    filiais = (resFiliais.recordset || []).map((f: any) => ({
                        id: f.id,
                        nome: f.nome || `Filial ${f.id}`
                    }));
                } catch {
                    filiais = [{ id: 1, nome: 'Filial 1' }];
                }

                // 7. Vendas por Modalidade (PDV / Caixa) - tbBoletimItemMovimento + tbBoletimItem
                let filialClauseBoletim = '';
                if (cdFilial) {
                    const filialNum = parseInt(cdFilial, 10);
                    if (!isNaN(filialNum)) {
                        filialClauseBoletim = ` AND (bim.cdPessoaFilial = ${filialNum} OR bim.cdPessoaFilialDeposito = ${filialNum})`;
                    }
                }

                let salesByModality: any[] = [];
                let salesSummary = {
                    totalBruto: 0,
                    totalLiquido: 0,
                    qtdOperacoes: 0,
                    ticketMedio: 0
                };
                let annualSalesByModality: any[] = [];

                try {
                    const reqSales = pool.request();
                    reqSales.input('ano', sql.Int, ano);
                    reqSales.input('mes', sql.Int, mes);

                    const querySales = `
                        SELECT 
                            ISNULL(bi.nmBoletimItem, 'Outros') as modalidade,
                            SUM(ISNULL(bim.vlBruto, 0)) as valor_bruto,
                            SUM(ISNULL(bim.vlLiquido, 0)) as valor_liquido,
                            SUM(ISNULL(bim.qtMovimento, 1)) as qtd_operacoes
                        FROM tbBoletimItemMovimento bim WITH (NOLOCK)
                        INNER JOIN tbBoletimItem bi WITH (NOLOCK) ON bim.cdBoletimItem = bi.cdBoletimItem AND bim.cdEmpresa = bi.cdEmpresa
                        LEFT JOIN tbBoletimMovimento bm WITH (NOLOCK) ON bm.cdBoletimMovimento = bim.cdBoletimMovimento AND bm.cdPessoaFilial = bim.cdPessoaFilial
                        WHERE YEAR(COALESCE(bm.dtMovimento, bim.dtPrevisao)) = @ano 
                          AND MONTH(COALESCE(bm.dtMovimento, bim.dtPrevisao)) = @mes
                          ${filialClauseBoletim}
                        GROUP BY bi.nmBoletimItem
                        ORDER BY valor_liquido DESC
                    `;

                    const resSales = await reqSales.query(querySales);
                    const rawSales = resSales.recordset || [];

                    let sumBruto = 0;
                    let sumLiquido = 0;
                    let sumQtd = 0;

                    rawSales.forEach((r: any) => {
                        sumBruto += Number(r.valor_bruto || 0);
                        sumLiquido += Number(r.valor_liquido || 0);
                        sumQtd += Number(r.qtd_operacoes || 0);
                    });

                    salesSummary = {
                        totalBruto: sumBruto,
                        totalLiquido: sumLiquido,
                        qtdOperacoes: sumQtd,
                        ticketMedio: sumQtd > 0 ? sumLiquido / sumQtd : 0
                    };

                    salesByModality = rawSales.map((r: any) => {
                        const vBruto = Number(r.valor_bruto || 0);
                        const vLiquido = Number(r.valor_liquido || 0);
                        const qtd = Number(r.qtd_operacoes || 0);
                        const pct = sumLiquido > 0 ? (vLiquido / sumLiquido) * 100 : 0;
                        const ticket = qtd > 0 ? vLiquido / qtd : 0;

                        return {
                            modalidade: String(r.modalidade || 'Outros').trim(),
                            valor_bruto: vBruto,
                            valor_liquido: vLiquido,
                            qtd_operacoes: qtd,
                            ticket_medio: ticket,
                            percentual: Number(pct.toFixed(2))
                        };
                    });
                } catch (salesErr: any) {
                    console.warn('Falha ao consultar vendas por modalidade (tbBoletimItemMovimento):', salesErr?.message || salesErr);
                    salesByModality = [];
                }

                // Vendas Anuais por Modalidade (12 Meses)
                try {
                    const reqAnnualSales = pool.request();
                    reqAnnualSales.input('ano', sql.Int, ano);

                    const queryAnnualSales = `
                        SELECT 
                            MONTH(COALESCE(bm.dtMovimento, bim.dtPrevisao)) as mes,
                            ISNULL(bi.nmBoletimItem, 'Outros') as modalidade,
                            SUM(ISNULL(bim.vlBruto, 0)) as valor_bruto,
                            SUM(ISNULL(bim.vlLiquido, 0)) as valor_liquido,
                            SUM(ISNULL(bim.qtMovimento, 1)) as qtd_operacoes
                        FROM tbBoletimItemMovimento bim WITH (NOLOCK)
                        INNER JOIN tbBoletimItem bi WITH (NOLOCK) ON bim.cdBoletimItem = bi.cdBoletimItem AND bim.cdEmpresa = bi.cdEmpresa
                        LEFT JOIN tbBoletimMovimento bm WITH (NOLOCK) ON bm.cdBoletimMovimento = bim.cdBoletimMovimento AND bm.cdPessoaFilial = bim.cdPessoaFilial
                        WHERE YEAR(COALESCE(bm.dtMovimento, bim.dtPrevisao)) = @ano
                          ${filialClauseBoletim}
                        GROUP BY MONTH(COALESCE(bm.dtMovimento, bim.dtPrevisao)), bi.nmBoletimItem
                        ORDER BY mes ASC, valor_liquido DESC
                    `;

                    const resAnnualSales = await reqAnnualSales.query(queryAnnualSales);
                    annualSalesByModality = (resAnnualSales.recordset || []).map((r: any) => ({
                        mes: Number(r.mes),
                        modalidade: String(r.modalidade || 'Outros').trim(),
                        valor_bruto: Number(r.valor_bruto || 0),
                        valor_liquido: Number(r.valor_liquido || 0),
                        qtd_operacoes: Number(r.qtd_operacoes || 0)
                    }));
                } catch {
                    annualSalesByModality = [];
                }

                // 8. Recebimentos e Emissões de Convênio (tbCrediarioCupom + tbCrediarioCupomPagamento + tbContaBaixa)
                const convDateFilter = (params.convDateFilter || 'baixa').toLowerCase() === 'emissao' ? 'emissao' : 'baixa';
                let filialClauseCupom = '';
                let filialClausePagamento = '';
                let filialClauseBaixa = '';
                if (cdFilial) {
                    const filialNum = parseInt(cdFilial, 10);
                    if (!isNaN(filialNum)) {
                        filialClauseCupom = ` AND cc.cdFilial = ${filialNum}`;
                        filialClausePagamento = ` AND p.cdFilial = ${filialNum}`;
                        filialClauseBaixa = ` AND cb.cdPessoaFilialBancoConta = ${filialNum}`;
                    }
                }
                const inactiveBankClauseBaixa = " AND (cb.cdBancoConta IS NULL OR cb.cdBancoConta NOT IN (SELECT _bc.cdBancoConta FROM tbBancoConta _bc WITH (NOLOCK) WHERE _bc.inInativo = 1 OR _bc.nmConta LIKE '%INATIV%'))";

                let convenioData: any = {
                    dateFilter: convDateFilter,
                    summary: {
                        totalEmitido: 0,
                        totalQuitado: 0,
                        totalPendente: 0,
                        qtdCupons: 0,
                        ticketMedio: 0,
                        totalRecebidoBaixas: 0,
                        totalJuros: 0,
                        qtdBaixas: 0,
                        pctQuitado: 0
                    },
                    topClientes: [],
                    dailyEvolution: [],
                    recentBaixas: [],
                    annualSummary: []
                };

                try {
                    const reqConv = pool.request();
                    reqConv.input('ano', sql.Int, ano);
                    reqConv.input('mes', sql.Int, mes);

                    let cTotalEmitido = 0;
                    let cTotalQuitado = 0;
                    let cQtdCupons = 0;

                    if (convDateFilter === 'emissao') {
                        // 8.1 Resumo de Cupons por Data de Emissão (cc.dtCrediario)
                        const resCupomSummary = await reqConv.query(`
                            SELECT 
                                COUNT(*) as qtd_cupons,
                                SUM(ISNULL(cc.vlCrediario, 0)) as total_emitido,
                                SUM(CASE 
                                    WHEN ISNULL(cc.vlQuitado, 0) > ISNULL(cc.vlCrediario, 0) THEN ISNULL(cc.vlCrediario, 0)
                                    WHEN ISNULL(cc.vlQuitado, 0) < 0 THEN 0
                                    ELSE ISNULL(cc.vlQuitado, 0) 
                                END) as total_quitado
                            FROM tbCrediarioCupom cc WITH (NOLOCK)
                            WHERE YEAR(cc.dtCrediario) = @ano AND MONTH(cc.dtCrediario) = @mes
                              ${filialClauseCupom}
                        `);
                        const cupomRow = resCupomSummary.recordset?.[0] || {};
                        cTotalEmitido = Number(cupomRow.total_emitido || 0);
                        cTotalQuitado = Number(cupomRow.total_quitado || 0);
                        cQtdCupons = Number(cupomRow.qtd_cupons || 0);
                    } else {
                        // 8.1 Resumo de Cupons por Data da Baixa / Pagamento (p.dtPago)
                        const resCupomSummary = await reqConv.query(`
                            SELECT 
                                COUNT(DISTINCT p.cdCrediarioCupom) as qtd_cupons,
                                SUM(ISNULL(p.vlPago, 0)) as total_quitado,
                                SUM(ISNULL(cc.vlCrediario, 0)) as total_emitido
                            FROM tbCrediarioCupomPagamento p WITH (NOLOCK)
                            INNER JOIN tbCrediarioCupom cc WITH (NOLOCK) ON cc.cdCrediarioCupom = p.cdCrediarioCupom
                            WHERE YEAR(p.dtPago) = @ano AND MONTH(p.dtPago) = @mes
                              ${filialClausePagamento}
                        `);
                        const cupomRow = resCupomSummary.recordset?.[0] || {};
                        cTotalQuitado = Number(cupomRow.total_quitado || 0);
                        cTotalEmitido = Number(cupomRow.total_emitido || 0);
                        if (cTotalEmitido === 0 && cTotalQuitado > 0) {
                            cTotalEmitido = cTotalQuitado;
                        }
                        cQtdCupons = Number(cupomRow.qtd_cupons || 0);
                    }

                    const cTotalPendente = Math.max(0, cTotalEmitido - cTotalQuitado);
                    const cTicketMedio = cQtdCupons > 0 ? (cTotalQuitado > 0 ? cTotalQuitado / cQtdCupons : cTotalEmitido / cQtdCupons) : 0;
                    const cPctQuitado = cTotalEmitido > 0 ? (cTotalQuitado / cTotalEmitido) * 100 : 0;

                    // 8.2 Resumo de Baixas Financeiras Efetivas de Convênio/Crediário (tbContaBaixa)
                    const resBaixaSummary = await reqConv.query(`
                        SELECT 
                            COUNT(*) as qtd_baixas,
                            SUM(ISNULL(cb.vlContaBaixa, 0)) as total_recebido_baixas,
                            SUM(CASE WHEN cb.Historico LIKE '%Juros%' THEN ISNULL(cb.vlContaBaixa, 0) ELSE 0 END) as total_juros
                        FROM tbContaBaixa cb WITH (NOLOCK)
                        WHERE YEAR(cb.dtContaBaixa) = @ano AND MONTH(cb.dtContaBaixa) = @mes
                          AND (cb.Historico LIKE '%CONV%' OR cb.Historico LIKE '%CREDIARIO%' OR cb.Historico LIKE '%CUPOM%')
                          AND cb.inRecebimento = 1
                          ${filialClauseBaixa}
                          ${inactiveBankClauseBaixa}
                    `);
                    const baixaRow = resBaixaSummary.recordset?.[0] || {};
                    const bTotalRecebido = Number(baixaRow.total_recebido_baixas || 0);
                    const bTotalJuros = Number(baixaRow.total_juros || 0);
                    const bQtdBaixas = Number(baixaRow.qtd_baixas || 0);

                    convenioData.summary = {
                        totalEmitido: cTotalEmitido,
                        totalQuitado: cTotalQuitado,
                        totalPendente: cTotalPendente,
                        qtdCupons: cQtdCupons,
                        ticketMedio: cTicketMedio,
                        totalRecebidoBaixas: bTotalRecebido,
                        totalJuros: bTotalJuros,
                        qtdBaixas: bQtdBaixas,
                        pctQuitado: Number(cPctQuitado.toFixed(1))
                    };

                    // 8.3 Top Clientes / Empresas Convênio do Mês
                    if (convDateFilter === 'emissao') {
                        const resTopClients = await reqConv.query(`
                            SELECT TOP 100
                                cc.cdCrediario,
                                ISNULL(NULLIF(RTRIM(LTRIM(c.Nome)), ''), 'Cliente não identificado') as cliente,
                                COUNT(*) as qtd_operacoes,
                                SUM(ISNULL(cc.vlCrediario, 0)) as total_valor,
                                SUM(CASE 
                                    WHEN ISNULL(cc.vlQuitado, 0) > ISNULL(cc.vlCrediario, 0) THEN ISNULL(cc.vlCrediario, 0)
                                    WHEN ISNULL(cc.vlQuitado, 0) < 0 THEN 0
                                    ELSE ISNULL(cc.vlQuitado, 0) 
                                END) as total_quitado
                            FROM tbCrediarioCupom cc WITH (NOLOCK)
                            LEFT JOIN tbCrediario c WITH (NOLOCK) ON c.cdCrediario = cc.cdCrediario
                            WHERE YEAR(cc.dtCrediario) = @ano AND MONTH(cc.dtCrediario) = @mes
                              ${filialClauseCupom}
                            GROUP BY cc.cdCrediario, c.Nome
                            ORDER BY total_valor DESC
                        `);
                        convenioData.topClientes = (resTopClients.recordset || []).map((tc: any) => {
                            const val = Number(tc.total_valor || 0);
                            const quit = Number(tc.total_quitado || 0);
                            const qtd = Number(tc.qtd_operacoes || 0);
                            const pend = Math.max(0, val - quit);
                            const pct = val > 0 ? (quit / val) * 100 : 0;
                            const ticket = qtd > 0 ? val / qtd : 0;
                            return {
                                cdCrediario: String(tc.cdCrediario || ''),
                                cliente: String(tc.cliente || 'Convênio').trim(),
                                qtd_operacoes: qtd,
                                ticket_medio: ticket,
                                total_valor: val,
                                total_quitado: quit,
                                saldo_pendente: pend,
                                pct_pago: Number(pct.toFixed(1))
                            };
                        });
                    } else {
                        const resTopClients = await reqConv.query(`
                            SELECT TOP 100
                                cc.cdCrediario,
                                ISNULL(NULLIF(RTRIM(LTRIM(c.Nome)), ''), 'Cliente não identificado') as cliente,
                                COUNT(DISTINCT p.cdCrediarioCupom) as qtd_operacoes,
                                SUM(ISNULL(p.vlPago, 0)) as total_quitado,
                                SUM(ISNULL(cc.vlCrediario, 0)) as total_valor
                            FROM tbCrediarioCupomPagamento p WITH (NOLOCK)
                            INNER JOIN tbCrediarioCupom cc WITH (NOLOCK) ON cc.cdCrediarioCupom = p.cdCrediarioCupom
                            LEFT JOIN tbCrediario c WITH (NOLOCK) ON c.cdCrediario = cc.cdCrediario
                            WHERE YEAR(p.dtPago) = @ano AND MONTH(p.dtPago) = @mes
                              ${filialClausePagamento}
                            GROUP BY cc.cdCrediario, c.Nome
                            ORDER BY total_quitado DESC, total_valor DESC
                        `);
                        convenioData.topClientes = (resTopClients.recordset || []).map((tc: any) => {
                            const quit = Number(tc.total_quitado || 0);
                            const val = Number(tc.total_valor || 0) || quit;
                            const qtd = Number(tc.qtd_operacoes || 0);
                            const pend = Math.max(0, val - quit);
                            const pct = val > 0 ? (quit / val) * 100 : 100;
                            const ticket = qtd > 0 ? quit / qtd : 0;
                            return {
                                cdCrediario: String(tc.cdCrediario || ''),
                                cliente: String(tc.cliente || 'Convênio').trim(),
                                qtd_operacoes: qtd,
                                ticket_medio: ticket,
                                total_valor: val,
                                total_quitado: quit,
                                saldo_pendente: pend,
                                pct_pago: Number(pct.toFixed(1))
                            };
                        });
                    }

                    // 8.4 Lista Detalhada de Cupons
                    if (convDateFilter === 'emissao') {
                        const resCuponsList = await reqConv.query(`
                            SELECT 
                                cc.cdCrediarioCupom as id,
                                cc.cdCrediario,
                                ISNULL(NULLIF(RTRIM(LTRIM(c.Nome)), ''), 'Cliente não identificado') as cliente,
                                cc.nrCupom,
                                CONVERT(VARCHAR(10), cc.dtCrediario, 120) as dtEmissao,
                                CONVERT(VARCHAR(10), cc.dtVencimento, 120) as dtVencimento,
                                (SELECT TOP 1 CONVERT(VARCHAR(10), p.dtPago, 120) 
                                 FROM tbCrediarioCupomPagamento p WITH (NOLOCK) 
                                 WHERE p.cdCrediarioCupom = cc.cdCrediarioCupom AND p.cdFilial = cc.cdFilial 
                                 ORDER BY p.dtPago DESC) as dtBaixa,
                                CAST(ISNULL(cc.vlCrediario, 0) AS FLOAT) as vlCrediario,
                                CAST(CASE 
                                    WHEN ISNULL(cc.vlQuitado, 0) > ISNULL(cc.vlCrediario, 0) THEN ISNULL(cc.vlCrediario, 0)
                                    WHEN ISNULL(cc.vlQuitado, 0) < 0 THEN 0
                                    ELSE ISNULL(cc.vlQuitado, 0) 
                                END AS FLOAT) as vlQuitado,
                                ISNULL(cc.Obs, '') as obs,
                                ISNULL(cc.nmOperador, '') as operador,
                                ISNULL(cc.cdPDV, 0) as pdv,
                                ISNULL(cc.cdFilial, 1) as filial
                            FROM tbCrediarioCupom cc WITH (NOLOCK)
                            LEFT JOIN tbCrediario c WITH (NOLOCK) ON c.cdCrediario = cc.cdCrediario
                            WHERE YEAR(cc.dtCrediario) = @ano AND MONTH(cc.dtCrediario) = @mes
                              ${filialClauseCupom}
                            ORDER BY cc.dtCrediario DESC, cc.nrCupom DESC
                        `);
                        convenioData.cuponsList = (resCuponsList.recordset || []).map((cp: any) => {
                            const emit = Number(cp.vlCrediario || 0);
                            const quit = Number(cp.vlQuitado || 0);
                            const pend = Math.max(0, emit - quit);
                            const status = quit >= emit && emit > 0 ? 'Quitado' : (quit > 0 ? 'Parcial' : 'Pendente');
                            return {
                                id: cp.id,
                                cdCrediario: String(cp.cdCrediario || ''),
                                cliente: String(cp.cliente || 'Convênio').trim(),
                                nrCupom: Number(cp.nrCupom || 0),
                                dtEmissao: cp.dtEmissao,
                                dtVencimento: cp.dtVencimento,
                                dtBaixa: cp.dtBaixa ? String(cp.dtBaixa) : null,
                                vlCrediario: emit,
                                vlQuitado: quit,
                                saldoPendente: pend,
                                status: status,
                                obs: String(cp.obs || ''),
                                operador: String(cp.operador || ''),
                                pdv: Number(cp.pdv || 0),
                                filial: Number(cp.filial || 1)
                            };
                        });
                    } else {
                        const resCuponsList = await reqConv.query(`
                            SELECT 
                                cc.cdCrediarioCupom as id,
                                cc.cdCrediario,
                                ISNULL(NULLIF(RTRIM(LTRIM(c.Nome)), ''), 'Cliente não identificado') as cliente,
                                cc.nrCupom,
                                CONVERT(VARCHAR(10), cc.dtCrediario, 120) as dtEmissao,
                                CONVERT(VARCHAR(10), cc.dtVencimento, 120) as dtVencimento,
                                CONVERT(VARCHAR(10), p.dtPago, 120) as dtBaixa,
                                CAST(ISNULL(cc.vlCrediario, 0) AS FLOAT) as vlCrediario,
                                CAST(ISNULL(p.vlPago, ISNULL(cc.vlQuitado, 0)) AS FLOAT) as vlQuitado,
                                CAST(CASE 
                                    WHEN ISNULL(cc.vlCrediario, 0) > ISNULL(cc.vlQuitado, 0) THEN ISNULL(cc.vlCrediario, 0) - ISNULL(cc.vlQuitado, 0)
                                    ELSE 0
                                END AS FLOAT) as saldoPendente,
                                ISNULL(cc.Obs, '') as obs,
                                ISNULL(cc.nmOperador, '') as operador,
                                ISNULL(cc.cdPDV, 0) as pdv,
                                ISNULL(cc.cdFilial, 1) as filial
                            FROM tbCrediarioCupomPagamento p WITH (NOLOCK)
                            INNER JOIN tbCrediarioCupom cc WITH (NOLOCK) ON cc.cdCrediarioCupom = p.cdCrediarioCupom
                            LEFT JOIN tbCrediario c WITH (NOLOCK) ON c.cdCrediario = cc.cdCrediario
                            WHERE YEAR(p.dtPago) = @ano AND MONTH(p.dtPago) = @mes
                              ${filialClausePagamento}
                            ORDER BY p.dtPago DESC, cc.nrCupom DESC
                        `);
                        convenioData.cuponsList = (resCuponsList.recordset || []).map((cp: any) => {
                            const emit = Number(cp.vlCrediario || 0);
                            const quit = Number(cp.vlQuitado || 0);
                            const pend = Math.max(0, Number(cp.saldoPendente || 0));
                            const status = (quit >= emit && emit > 0) || pend === 0 ? 'Quitado' : (quit > 0 ? 'Parcial' : 'Pendente');
                            return {
                                id: cp.id,
                                cdCrediario: String(cp.cdCrediario || ''),
                                cliente: String(cp.cliente || 'Convênio').trim(),
                                nrCupom: Number(cp.nrCupom || 0),
                                dtEmissao: cp.dtEmissao,
                                dtVencimento: cp.dtVencimento,
                                dtBaixa: cp.dtBaixa ? String(cp.dtBaixa) : null,
                                vlCrediario: emit,
                                vlQuitado: quit,
                                saldoPendente: pend,
                                status: status,
                                obs: String(cp.obs || ''),
                                operador: String(cp.operador || ''),
                                pdv: Number(cp.pdv || 0),
                                filial: Number(cp.filial || 1)
                            };
                        });
                    }

                    // 8.5 Evolução Diária de Convênio no Mês
                    if (convDateFilter === 'emissao') {
                        const resDailyConv = await reqConv.query(`
                            SELECT 
                                DAY(cc.dtCrediario) as dia,
                                CONVERT(VARCHAR(10), cc.dtCrediario, 120) as data,
                                COUNT(*) as qtd_cupons,
                                SUM(ISNULL(cc.vlCrediario, 0)) as total_emitido,
                                SUM(CASE 
                                    WHEN ISNULL(cc.vlQuitado, 0) > ISNULL(cc.vlCrediario, 0) THEN ISNULL(cc.vlCrediario, 0)
                                    WHEN ISNULL(cc.vlQuitado, 0) < 0 THEN 0
                                    ELSE ISNULL(cc.vlQuitado, 0) 
                                END) as total_quitado
                            FROM tbCrediarioCupom cc WITH (NOLOCK)
                            WHERE YEAR(cc.dtCrediario) = @ano AND MONTH(cc.dtCrediario) = @mes
                              ${filialClauseCupom}
                            GROUP BY DAY(cc.dtCrediario), CONVERT(VARCHAR(10), cc.dtCrediario, 120)
                            ORDER BY dia ASC
                        `);
                        convenioData.dailyEvolution = (resDailyConv.recordset || []).map((d: any) => ({
                            dia: Number(d.dia),
                            data: d.data,
                            qtd_cupons: Number(d.qtd_cupons || 0),
                            total_emitido: Number(d.total_emitido || 0),
                            total_quitado: Number(d.total_quitado || 0),
                            saldo_pendente: Math.max(0, Number(d.total_emitido || 0) - Number(d.total_quitado || 0))
                        }));
                    } else {
                        const resDailyConv = await reqConv.query(`
                            SELECT 
                                DAY(p.dtPago) as dia,
                                CONVERT(VARCHAR(10), p.dtPago, 120) as data,
                                COUNT(DISTINCT cc.cdCrediarioCupom) as qtd_cupons,
                                SUM(ISNULL(cc.vlCrediario, 0)) as total_emitido,
                                SUM(ISNULL(p.vlPago, 0)) as total_quitado
                            FROM tbCrediarioCupomPagamento p WITH (NOLOCK)
                            INNER JOIN tbCrediarioCupom cc WITH (NOLOCK) ON cc.cdCrediarioCupom = p.cdCrediarioCupom
                            WHERE YEAR(p.dtPago) = @ano AND MONTH(p.dtPago) = @mes
                              ${filialClausePagamento}
                            GROUP BY DAY(p.dtPago), CONVERT(VARCHAR(10), p.dtPago, 120)
                            ORDER BY dia ASC
                        `);
                        convenioData.dailyEvolution = (resDailyConv.recordset || []).map((d: any) => ({
                            dia: Number(d.dia),
                            data: d.data,
                            qtd_cupons: Number(d.qtd_cupons || 0),
                            total_emitido: Number(d.total_emitido || 0),
                            total_quitado: Number(d.total_quitado || 0),
                            saldo_pendente: Math.max(0, Number(d.total_emitido || 0) - Number(d.total_quitado || 0))
                        }));
                    }

                    // 8.6 Últimas Baixas / Liquidações Financeiras de Convênio (tbContaBaixa)
                    const resRecentBaixas = await reqConv.query(`
                        SELECT TOP 30
                            cb.cdContaBaixa as id,
                            CONVERT(VARCHAR(10), cb.dtContaBaixa, 120) as data,
                            ISNULL(cb.Documento, CAST(cb.cdContaBaixa AS VARCHAR(50))) as documento,
                            ISNULL(cb.Historico, 'Recebimento Convênio') as historico,
                            CAST(cb.vlContaBaixa AS FLOAT) as valor,
                            ISNULL(bc.nmConta, 'Caixa / Banco') as banco
                        FROM tbContaBaixa cb WITH (NOLOCK)
                        LEFT JOIN tbBancoConta bc WITH (NOLOCK) ON bc.cdBancoConta = cb.cdBancoConta
                        WHERE YEAR(cb.dtContaBaixa) = @ano AND MONTH(cb.dtContaBaixa) = @mes
                          AND (cb.Historico LIKE '%CONV%' OR cb.Historico LIKE '%CREDIARIO%' OR cb.Historico LIKE '%CUPOM%')
                          AND cb.inRecebimento = 1
                          ${filialClauseBaixa}
                          ${inactiveBankClauseBaixa}
                        ORDER BY cb.dtContaBaixa DESC, cb.cdContaBaixa DESC
                    `);
                    convenioData.recentBaixas = (resRecentBaixas.recordset || []).map((b: any) => ({
                        id: b.id,
                        data: b.data,
                        documento: String(b.documento || '-'),
                        historico: b.historico,
                        valor: Number(b.valor || 0),
                        banco: b.banco
                    }));

                    // 8.7 Comparativo Anual de Convênio (12 meses)
                    const reqAnualConv = pool.request();
                    reqAnualConv.input('ano', sql.Int, ano);
                    let resAnualConv: any;
                    if (convDateFilter === 'emissao') {
                        resAnualConv = await reqAnualConv.query(`
                            SELECT 
                                MONTH(cc.dtCrediario) as mes,
                                COUNT(*) as qtd_cupons,
                                SUM(ISNULL(cc.vlCrediario, 0)) as total_emitido,
                                SUM(CASE 
                                    WHEN ISNULL(cc.vlQuitado, 0) > ISNULL(cc.vlCrediario, 0) THEN ISNULL(cc.vlCrediario, 0)
                                    WHEN ISNULL(cc.vlQuitado, 0) < 0 THEN 0
                                    ELSE ISNULL(cc.vlQuitado, 0) 
                                END) as total_quitado
                            FROM tbCrediarioCupom cc WITH (NOLOCK)
                            WHERE YEAR(cc.dtCrediario) = @ano
                              ${filialClauseCupom}
                            GROUP BY MONTH(cc.dtCrediario)
                            ORDER BY mes ASC
                        `);
                    } else {
                        resAnualConv = await reqAnualConv.query(`
                            SELECT 
                                MONTH(p.dtPago) as mes,
                                COUNT(DISTINCT cc.cdCrediarioCupom) as qtd_cupons,
                                SUM(ISNULL(cc.vlCrediario, 0)) as total_emitido,
                                SUM(ISNULL(p.vlPago, 0)) as total_quitado
                            FROM tbCrediarioCupomPagamento p WITH (NOLOCK)
                            INNER JOIN tbCrediarioCupom cc WITH (NOLOCK) ON cc.cdCrediarioCupom = p.cdCrediarioCupom
                            WHERE YEAR(p.dtPago) = @ano
                              ${filialClausePagamento}
                            GROUP BY MONTH(p.dtPago)
                            ORDER BY mes ASC
                        `);
                    }
                    const anualConvMap: Record<number, any> = {};
                    (resAnualConv.recordset || []).forEach((r: any) => {
                        anualConvMap[Number(r.mes)] = r;
                    });

                    convenioData.annualSummary = Array.from({ length: 12 }, (_, idx) => {
                        const m = idx + 1;
                        const row = anualConvMap[m];
                        const emit = row ? Number(row.total_emitido || 0) : 0;
                        const quit = row ? Number(row.total_quitado || 0) : 0;
                        const qtd = row ? Number(row.qtd_cupons || 0) : 0;
                        return {
                            mes: m,
                            mesNome: MONTH_NAMES[idx] || '',
                            mesSigla: (MONTH_NAMES[idx] || '').slice(0, 3),
                            total_emitido: emit,
                            total_quitado: quit,
                            saldo_pendente: Math.max(0, emit - quit),
                            qtd_cupons: qtd,
                            pct_pago: emit > 0 ? Number(((quit / emit) * 100).toFixed(1)) : (quit > 0 ? 100 : 0)
                        };
                    });
                } catch (convErr: any) {
                    console.warn('Falha ao consultar dados de convênio no Solidcon:', convErr?.message || convErr);
                }

                // 8.8 Crediário e Convênio a Receber (Sob Demanda via Filtro)
                const shouldQueryCrediario = params.includeCrediario === true ||
                    params.includeCrediario === 'true' ||
                    params.includeCrediario === '1' ||
                    Boolean(params.dtInicioCrediario) ||
                    Boolean(params.dtFimCrediario);

                let crediarioReceber: any = {
                    loaded: shouldQueryCrediario,
                    summary: {
                        totalAReceber: 0,
                        totalEmitido: 0,
                        totalQuitado: 0,
                        totalVencido: 0,
                        totalAVencer: 0,
                        qtdCupons: 0,
                        qtdVencidos: 0,
                        qtdAVencer: 0,
                        qtdClientes: 0,
                        ticketMedio: 0
                    },
                    topClientes: [],
                    byFilial: [],
                    lancamentos: []
                };

                if (shouldQueryCrediario) {
                    try {
                        let filialClauseRec = '';
                        if (cdFilial) {
                            const filialNum = parseInt(cdFilial, 10);
                            if (!isNaN(filialNum)) {
                                filialClauseRec = ` AND cc.cdFilial = ${filialNum}`;
                            }
                        }

                        const dtInicioCrediario = params.dtInicioCrediario ? String(params.dtInicioCrediario).trim() : null;
                        const dtFimCrediario = params.dtFimCrediario ? String(params.dtFimCrediario).trim() : null;
                        const tipoDataCrediario = params.tipoDataCrediario === 'emissao' ? 'emissao' : 'vencimento';
                        const targetColRec = tipoDataCrediario === 'emissao' ? 'cc.dtCrediario' : 'cc.dtVencimento';

                        let dateFilterClauseRec = " AND cc.dtCrediario <= '2999-12-31'";
                        if (dtInicioCrediario && dtFimCrediario) {
                            dateFilterClauseRec = ` AND CAST(${targetColRec} AS DATE) >= @dtInicioCred AND CAST(${targetColRec} AS DATE) <= @dtFimCred`;
                        } else if (dtInicioCrediario) {
                            dateFilterClauseRec = ` AND CAST(${targetColRec} AS DATE) >= @dtInicioCred AND ${targetColRec} <= '2999-12-31'`;
                        } else if (dtFimCrediario) {
                            dateFilterClauseRec = ` AND CAST(${targetColRec} AS DATE) <= @dtFimCred`;
                        }

                        const reqRec = pool.request();
                        if (dtInicioCrediario) {
                            reqRec.input('dtInicioCred', sql.VarChar(10), dtInicioCrediario);
                        }
                        if (dtFimCrediario) {
                            reqRec.input('dtFimCred', sql.VarChar(10), dtFimCrediario);
                        }

                        crediarioReceber.filtrosAplicados = {
                            dtInicio: dtInicioCrediario || null,
                            dtFim: dtFimCrediario || null,
                            tipoData: tipoDataCrediario
                        };

                        // Resumo Geral
                        const resRecSummary = await reqRec.query(`
                            SELECT 
                                COUNT(*) as qtd_cupons,
                                COUNT(DISTINCT cc.cdCrediario) as qtd_clientes,
                                SUM(ISNULL(cc.vlCrediario, 0)) as total_emitido,
                                SUM(ISNULL(cc.vlQuitado, 0)) as total_quitado,
                                SUM(ISNULL(cc.vlCrediario, 0) - ISNULL(cc.vlQuitado, 0)) as total_a_receber,
                                SUM(CASE WHEN CAST(cc.dtVencimento AS DATE) < CAST(GETDATE() AS DATE) THEN (ISNULL(cc.vlCrediario, 0) - ISNULL(cc.vlQuitado, 0)) ELSE 0 END) as total_vencido,
                                SUM(CASE WHEN CAST(cc.dtVencimento AS DATE) >= CAST(GETDATE() AS DATE) THEN (ISNULL(cc.vlCrediario, 0) - ISNULL(cc.vlQuitado, 0)) ELSE 0 END) as total_a_vencer,
                                COUNT(CASE WHEN CAST(cc.dtVencimento AS DATE) < CAST(GETDATE() AS DATE) THEN 1 END) as qtd_vencidos,
                                COUNT(CASE WHEN CAST(cc.dtVencimento AS DATE) >= CAST(GETDATE() AS DATE) THEN 1 END) as qtd_a_vencer
                            FROM tbCrediarioCupom cc WITH (NOLOCK)
                            WHERE (ISNULL(cc.vlCrediario, 0) - ISNULL(cc.vlQuitado, 0)) > 0.01
                              ${dateFilterClauseRec}
                              ${filialClauseRec}
                        `);
                        const recRow = resRecSummary.recordset?.[0] || {};
                        const totVencido = Number(recRow.total_vencido || 0);
                        const totAVencer = Number(recRow.total_a_vencer || 0);
                        const totRec = (totVencido + totAVencer > 0) ? (totVencido + totAVencer) : Number(recRow.total_a_receber || 0);
                        const qtdVenc = Number(recRow.qtd_vencidos || 0);
                        const qtdAVenc = Number(recRow.qtd_a_vencer || 0);
                        const qtdTot = (qtdVenc + qtdAVenc > 0) ? (qtdVenc + qtdAVenc) : Number(recRow.qtd_cupons || 0);

                        crediarioReceber.summary = {
                            totalAReceber: totRec,
                            totalReceber: totRec,
                            totalEmitido: Number(recRow.total_emitido || 0),
                            totalQuitado: Number(recRow.total_quitado || 0),
                            totalVencido: totVencido,
                            totalAVencer: totAVencer,
                            qtdCupons: qtdTot,
                            qtdVencidos: qtdVenc,
                            qtdAVencer: qtdAVenc,
                            qtdClientes: Number(recRow.qtd_clientes || 0),
                            ticketMedio: qtdTot > 0 ? totRec / qtdTot : 0
                        };

                        // Top Clientes com maior saldo a receber
                        const resRecTop = await reqRec.query(`
                            SELECT TOP 10
                                cc.cdCrediario,
                                ISNULL(NULLIF(RTRIM(LTRIM(c.Nome)), ''), 'Cliente não identificado') as cliente,
                                COUNT(cc.cdCrediarioCupom) as qtd_cupons,
                                SUM(ISNULL(cc.vlCrediario, 0)) as total_emitido,
                                SUM(ISNULL(cc.vlQuitado, 0)) as total_quitado,
                                SUM(ISNULL(cc.vlCrediario, 0) - ISNULL(cc.vlQuitado, 0)) as total_a_receber
                            FROM tbCrediarioCupom cc WITH (NOLOCK)
                            LEFT JOIN tbCrediario c WITH (NOLOCK) ON c.cdCrediario = cc.cdCrediario
                            WHERE (ISNULL(cc.vlCrediario, 0) - ISNULL(cc.vlQuitado, 0)) > 0.01
                              ${dateFilterClauseRec}
                              ${filialClauseRec}
                            GROUP BY cc.cdCrediario, c.Nome
                            ORDER BY total_a_receber DESC
                        `);
                        crediarioReceber.topClientes = (resRecTop.recordset || []).map((t: any) => {
                            const val = Number(t.total_a_receber || 0);
                            const pct = totRec > 0 ? (val / totRec) * 100 : 0;
                            return {
                                cdCrediario: String(t.cdCrediario || ''),
                                cliente: String(t.cliente || 'Cliente').trim(),
                                qtdCupons: Number(t.qtd_cupons || 0),
                                totalEmitido: Number(t.total_emitido || 0),
                                totalQuitado: Number(t.total_quitado || 0),
                                totalAReceber: val,
                                percentual: Number(pct.toFixed(1))
                            };
                        });

                        // Agrupamento por Filial
                        const resRecFilial = await reqRec.query(`
                            SELECT 
                                cc.cdFilial as filial,
                                ISNULL(p.nmPessoa, CONCAT('Filial ', CAST(cc.cdFilial AS VARCHAR(20)))) as nomeFilial,
                                COUNT(*) as qtd_cupons,
                                SUM(ISNULL(cc.vlCrediario, 0) - ISNULL(cc.vlQuitado, 0)) as total_a_receber
                            FROM tbCrediarioCupom cc WITH (NOLOCK)
                            LEFT JOIN tbPessoa p WITH (NOLOCK) ON p.cdPessoa = cc.cdFilial
                            WHERE (ISNULL(cc.vlCrediario, 0) - ISNULL(cc.vlQuitado, 0)) > 0.01
                              ${dateFilterClauseRec}
                              ${filialClauseRec}
                            GROUP BY cc.cdFilial, p.nmPessoa
                            ORDER BY total_a_receber DESC
                        `);
                        crediarioReceber.byFilial = (resRecFilial.recordset || []).map((f: any) => ({
                            filial: Number(f.filial || 1),
                            nomeFilial: String(f.nomeFilial || `Filial ${f.filial}`).trim(),
                            qtdCupons: Number(f.qtd_cupons || 0),
                            totalAReceber: Number(f.total_a_receber || 0)
                        }));

                        // Lista detalhada dos cupons a receber (Top 2000)
                        const resRecList = await reqRec.query(`
                            SELECT TOP 2000
                                cc.cdCrediarioCupom as id,
                                cc.cdCrediario,
                                ISNULL(NULLIF(RTRIM(LTRIM(c.Nome)), ''), 'Cliente não identificado') as cliente,
                                cc.nrCupom,
                                CONVERT(VARCHAR(10), cc.dtCrediario, 120) as dtEmissao,
                                CONVERT(VARCHAR(10), cc.dtVencimento, 120) as dtVencimento,
                                CAST(ISNULL(cc.vlCrediario, 0) AS FLOAT) as vlCrediario,
                                CAST(ISNULL(cc.vlQuitado, 0) AS FLOAT) as vlQuitado,
                                CAST(ISNULL(cc.vlCrediario, 0) - ISNULL(cc.vlQuitado, 0) AS FLOAT) as saldoPendente,
                                CASE WHEN CAST(cc.dtVencimento AS DATE) < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END as isVencido,
                                CASE WHEN CAST(cc.dtVencimento AS DATE) < CAST(GETDATE() AS DATE) THEN DATEDIFF(day, cc.dtVencimento, GETDATE()) ELSE 0 END as diasAtraso,
                                ISNULL(cc.Obs, '') as obs,
                                ISNULL(cc.nmOperador, '') as operador,
                                ISNULL(cc.cdPDV, 0) as pdv,
                                ISNULL(cc.cdFilial, 1) as filial,
                                ISNULL(p.nmPessoa, CONCAT('Filial ', CAST(cc.cdFilial AS VARCHAR(20)))) as nomeFilial
                            FROM tbCrediarioCupom cc WITH (NOLOCK)
                            LEFT JOIN tbCrediario c WITH (NOLOCK) ON c.cdCrediario = cc.cdCrediario
                            LEFT JOIN tbPessoa p WITH (NOLOCK) ON p.cdPessoa = cc.cdFilial
                            WHERE (ISNULL(cc.vlCrediario, 0) - ISNULL(cc.vlQuitado, 0)) > 0.01
                              ${dateFilterClauseRec}
                              ${filialClauseRec}
                            ORDER BY saldoPendente DESC, cc.dtVencimento ASC
                        `);
                        crediarioReceber.lancamentos = (resRecList.recordset || []).map((cp: any) => ({
                            id: cp.id,
                            cdCrediario: String(cp.cdCrediario || ''),
                            cliente: String(cp.cliente || 'Convênio/Cliente').trim(),
                            nrCupom: Number(cp.nrCupom || 0),
                            dtEmissao: cp.dtEmissao,
                            dtVencimento: cp.dtVencimento,
                            vlCrediario: Number(cp.vlCrediario || 0),
                            vlQuitado: Number(cp.vlQuitado || 0),
                            saldoPendente: Number(cp.saldoPendente || 0),
                            isVencido: Boolean(cp.isVencido),
                            diasAtraso: Number(cp.diasAtraso || 0),
                            obs: String(cp.obs || ''),
                            operador: String(cp.operador || ''),
                            pdv: Number(cp.pdv || 0),
                            filial: Number(cp.filial || 1),
                            nomeFilial: String(cp.nomeFilial || `Filial ${cp.filial}`).trim()
                        }));
                    } catch (recErr: any) {
                        console.warn('Falha ao consultar crediário/convênio a receber no Solidcon:', recErr?.message || recErr);
                    }
                }

                // 9. Cartões Não Baixados do Solidcon (tbBoletimItemMovimento + tbBoletimItem + tbBoletimItemTipo + tbBoletimMovimento)
                let cartoesNaoBaixados: any = {
                    loaded: false,
                    summary: {
                        totalBruto: 0,
                        totalLiquido: 0,
                        totalTaxa: 0,
                        totalOperacoes: 0,
                        totalLancamentos: 0,
                        ticketMedio: 0,
                        totalAVencer: 0,
                        totalVencido: 0,
                        qtdAVencer: 0,
                        qtdVencidos: 0
                    },
                    byBandeira: [],
                    byModalidade: [],
                    byFilial: [],
                    lancamentos: []
                };

                const shouldQueryCartoes = params.includeCartoes === true || params.includeCartoes === '1' || params.includeCartoes === 'true';

                if (shouldQueryCartoes) {
                    try {
                        let filialClauseCartao = '';
                        if (cdFilial) {
                            const filialNum = parseInt(cdFilial, 10);
                            if (!isNaN(filialNum)) {
                                filialClauseCartao = ` AND (bim.cdPessoaFilial = ${filialNum} OR bim.cdPessoaFilialDeposito = ${filialNum})`;
                            }
                        }

                        const dtInicioCartoes = params.dtInicioCartoes ? String(params.dtInicioCartoes).trim() : null;
                        const dtFimCartoes = params.dtFimCartoes ? String(params.dtFimCartoes).trim() : null;
                        const tipoDataCartoes = params.tipoDataCartoes === 'venda' ? 'venda' : 'previsao';
                        const targetColCartao = tipoDataCartoes === 'venda' ? 'bm.dtMovimento' : 'bim.dtPrevisao';

                        let dateFilterClauseCartao = '';
                        if (dtInicioCartoes && dtFimCartoes) {
                            dateFilterClauseCartao = ` AND CAST(${targetColCartao} AS DATE) >= @dtInicioCartao AND CAST(${targetColCartao} AS DATE) <= @dtFimCartao`;
                        } else if (dtInicioCartoes) {
                            dateFilterClauseCartao = ` AND CAST(${targetColCartao} AS DATE) >= @dtInicioCartao`;
                        } else if (dtFimCartoes) {
                            dateFilterClauseCartao = ` AND CAST(${targetColCartao} AS DATE) <= @dtFimCartao`;
                        } else {
                            dateFilterClauseCartao = ` AND YEAR(bm.dtMovimento) = @ano AND MONTH(bm.dtMovimento) = @mes`;
                        }

                        const reqCards = pool.request();
                        reqCards.input('ano', sql.Int, ano);
                        reqCards.input('mes', sql.Int, mes);
                        if (dtInicioCartoes) {
                            reqCards.input('dtInicioCartao', sql.VarChar(10), dtInicioCartoes);
                        }
                        if (dtFimCartoes) {
                            reqCards.input('dtFimCartao', sql.VarChar(10), dtFimCartoes);
                        }

                        const queryCards = `
                            SELECT 
                                bim.cdBoletimItemMovimento as id,
                                bim.cdBoletimMovimento,
                                CONVERT(VARCHAR(10), bm.dtMovimento, 120) as dtVenda,
                                CONVERT(VARCHAR(10), bim.dtPrevisao, 120) as dtPrevisao,
                                ISNULL(bit.nmBoletimItemTipo, 'Outros') as modalidade,
                                ISNULL(bi.nmBoletimItem, 'Outros') as bandeira,
                                ISNULL(bim.qtMovimento, 1) as qtd,
                                CAST(ISNULL(bim.vlBruto, 0) AS FLOAT) as vlBruto,
                                CAST(ISNULL(bim.vlLiquido, 0) AS FLOAT) as vlLiquido,
                                CAST(ISNULL(bim.vlBruto, 0) - ISNULL(bim.vlLiquido, 0) AS FLOAT) as vlTaxa,
                                ISNULL(p.nmPessoa, CONCAT('Filial ', CAST(bim.cdPessoaFilial AS VARCHAR(20)))) as nome_filial,
                                bim.cdPessoaFilial as filial,
                                ISNULL(bim.Historico, '') as historico,
                                DATEDIFF(day, CAST(GETDATE() AS DATE), bim.dtPrevisao) as diasVencimento,
                                CASE WHEN CAST(bim.dtPrevisao AS DATE) >= CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END as isAVencer
                            FROM tbBoletimItemMovimento bim WITH (NOLOCK)
                            INNER JOIN tbBoletimItem bi WITH (NOLOCK) ON bi.cdBoletimItem = bim.cdBoletimItem AND bi.cdEmpresa = bim.cdEmpresa
                            INNER JOIN tbBoletimItemTipo bit WITH (NOLOCK) ON bit.cdBoletimItemTipo = bi.cdBoletimItemTipo
                            INNER JOIN tbBoletimMovimento bm WITH (NOLOCK) ON bm.cdBoletimMovimento = bim.cdBoletimMovimento AND bm.cdPessoaFilial = bim.cdPessoaFilial
                            LEFT JOIN tbBoletimDeposito bd WITH (NOLOCK) ON bd.cdBoletimDeposito = bim.cdBoletimDeposito AND bd.cdPessoaFilialDeposito = bim.cdPessoaFilialDeposito
                            LEFT JOIN tbPessoa p WITH (NOLOCK) ON p.cdPessoa = bim.cdPessoaFilial
                            WHERE bit.cdBoletimItemTipo IN (2, 6, 7)
                              AND (bim.cdBoletimDeposito IS NULL OR bd.dtDeposito IS NULL OR bd.cdBancoConta IS NULL)
                              ${dateFilterClauseCartao}
                              ${filialClauseCartao}
                            ORDER BY bm.dtMovimento DESC, bim.vlBruto DESC
                        `;

                        const resCards = await reqCards.query(queryCards);
                        const rawCards = resCards.recordset || [];

                        let sumBruto = 0;
                        let sumLiquido = 0;
                        let sumTaxa = 0;
                        let sumOperacoes = 0;
                        let sumAVencer = 0;
                        let sumVencido = 0;
                        let qtdAVencer = 0;
                        let qtdVencidos = 0;

                        const bandeiraMap: Record<string, any> = {};
                        const modalidadeMap: Record<string, any> = {};
                        const filialMap: Record<string, any> = {};

                        rawCards.forEach((c: any) => {
                            const vb = Number(c.vlBruto || 0);
                            const vl = Number(c.vlLiquido || 0);
                            const vt = Number(c.vlTaxa || 0);
                            const qtd = Number(c.qtd || 1);
                            const isAVencer = Boolean(c.isAVencer === 1 || c.isAVencer === true);

                            sumBruto += vb;
                            sumLiquido += vl;
                            sumTaxa += vt;
                            sumOperacoes += qtd;

                            if (isAVencer) {
                                sumAVencer += vl;
                                qtdAVencer += 1;
                            } else {
                                sumVencido += vl;
                                qtdVencidos += 1;
                            }

                            // Group by Bandeira
                            const banKey = c.bandeira || 'Outros';
                            if (!bandeiraMap[banKey]) {
                                bandeiraMap[banKey] = {
                                    bandeira: banKey,
                                    modalidade: c.modalidade || 'Cartão',
                                    totalBruto: 0,
                                    totalLiquido: 0,
                                    totalTaxa: 0,
                                    totalOperacoes: 0,
                                    totalLancamentos: 0
                                };
                            }
                            bandeiraMap[banKey].totalBruto += vb;
                            bandeiraMap[banKey].totalLiquido += vl;
                            bandeiraMap[banKey].totalTaxa += vt;
                            bandeiraMap[banKey].totalOperacoes += qtd;
                            bandeiraMap[banKey].totalLancamentos += 1;

                            // Group by Modalidade
                            const modKey = c.modalidade || 'Outros';
                            if (!modalidadeMap[modKey]) {
                                modalidadeMap[modKey] = {
                                    modalidade: modKey,
                                    totalBruto: 0,
                                    totalLiquido: 0,
                                    totalTaxa: 0,
                                    totalOperacoes: 0,
                                    totalLancamentos: 0
                                };
                            }
                            modalidadeMap[modKey].totalBruto += vb;
                            modalidadeMap[modKey].totalLiquido += vl;
                            modalidadeMap[modKey].totalTaxa += vt;
                            modalidadeMap[modKey].totalOperacoes += qtd;
                            modalidadeMap[modKey].totalLancamentos += 1;

                            // Group by Filial
                            const filKey = String(c.filial || 1);
                            if (!filialMap[filKey]) {
                                filialMap[filKey] = {
                                    filial: c.filial,
                                    nomeFilial: c.nome_filial || `Filial ${c.filial}`,
                                    totalBruto: 0,
                                    totalLiquido: 0,
                                    totalTaxa: 0,
                                    totalOperacoes: 0,
                                    totalLancamentos: 0
                                };
                            }
                            filialMap[filKey].totalBruto += vb;
                            filialMap[filKey].totalLiquido += vl;
                            filialMap[filKey].totalTaxa += vt;
                            filialMap[filKey].totalOperacoes += qtd;
                            filialMap[filKey].totalLancamentos += 1;
                        });

                        const byBandeira = Object.values(bandeiraMap).map((b: any) => ({
                            ...b,
                            percentual: sumLiquido > 0 ? Number(((b.totalLiquido / sumLiquido) * 100).toFixed(2)) : 0
                        })).sort((a: any, b: any) => b.totalLiquido - a.totalLiquido);

                        const byModalidade = Object.values(modalidadeMap).map((m: any) => ({
                            ...m,
                            percentual: sumLiquido > 0 ? Number(((m.totalLiquido / sumLiquido) * 100).toFixed(2)) : 0
                        })).sort((a: any, b: any) => b.totalLiquido - a.totalLiquido);

                        const byFilial = Object.values(filialMap).sort((a: any, b: any) => b.totalLiquido - a.totalLiquido);

                        cartoesNaoBaixados = {
                            loaded: true,
                            filtrosAplicados: {
                                dtInicio: dtInicioCartoes || null,
                                dtFim: dtFimCartoes || null,
                                tipoData: tipoDataCartoes
                            },
                            summary: {
                                totalBruto: sumBruto,
                                totalLiquido: sumLiquido,
                                totalTaxa: sumTaxa,
                                totalOperacoes: sumOperacoes,
                                totalLancamentos: rawCards.length,
                                ticketMedio: sumOperacoes > 0 ? sumLiquido / sumOperacoes : 0,
                                totalAVencer: sumAVencer,
                                totalVencido: sumVencido,
                                qtdAVencer,
                                qtdVencidos
                            },
                            byBandeira,
                            byModalidade,
                            byFilial,
                            lancamentos: rawCards
                        };
                    } catch (cardErr: any) {
                        console.warn('Falha ao consultar cartões não baixados no Solidcon:', cardErr?.message || cardErr);
                    }
                }

                // 10. Contas a Pagar do Solidcon (Sob Demanda via Filtro por Período)
                const shouldQueryContasPagar = params.includeContasPagar === true ||
                    params.includeContasPagar === 'true' ||
                    params.includeContasPagar === '1' ||
                    Boolean(params.dtInicioContasPagar) ||
                    Boolean(params.dtFimContasPagar);

                let contasPagar: any = {
                    loaded: shouldQueryContasPagar,
                    summary: {
                        totalAPagar: 0,
                        totalPagar: 0,
                        totalEmitido: 0,
                        totalPago: 0,
                        totalVencido: 0,
                        totalAVencer: 0,
                        qtdTitulos: 0,
                        qtdVencidos: 0,
                        qtdAVencer: 0,
                        qtdFornecedores: 0,
                        ticketMedio: 0
                    },
                    topFornecedores: [],
                    byFilial: [],
                    lancamentos: []
                };

                if (shouldQueryContasPagar) {
                    try {
                        let filialClausePagar = '';
                        if (cdFilial) {
                            const filialNum = parseInt(cdFilial, 10);
                            if (!isNaN(filialNum)) {
                                filialClausePagar = ` AND c.cdPessoaFilialConta = ${filialNum}`;
                            }
                        }

                        const dtInicioContasPagar = params.dtInicioContasPagar ? String(params.dtInicioContasPagar).trim() : null;
                        const dtFimContasPagar = params.dtFimContasPagar ? String(params.dtFimContasPagar).trim() : null;
                        const tipoDataContasPagar = params.tipoDataContasPagar === 'emissao' ? 'emissao' : 'vencimento';
                        const targetColPagar = tipoDataContasPagar === 'emissao' ? 'c.dtInclusao' : 'cp.dtParcela';

                        let dateFilterClausePagar = " AND cp.dtParcela <= '2999-12-31'";
                        if (dtInicioContasPagar && dtFimContasPagar) {
                            dateFilterClausePagar = ` AND CAST(${targetColPagar} AS DATE) >= @dtInicioPagar AND CAST(${targetColPagar} AS DATE) <= @dtFimPagar`;
                        } else if (dtInicioContasPagar) {
                            dateFilterClausePagar = ` AND CAST(${targetColPagar} AS DATE) >= @dtInicioPagar AND ${targetColPagar} <= '2999-12-31'`;
                        } else if (dtFimContasPagar) {
                            dateFilterClausePagar = ` AND CAST(${targetColPagar} AS DATE) <= @dtFimPagar`;
                        }

                        const reqPagar = pool.request();
                        if (dtInicioContasPagar) {
                            reqPagar.input('dtInicioPagar', sql.VarChar(10), dtInicioContasPagar);
                        }
                        if (dtFimContasPagar) {
                            reqPagar.input('dtFimPagar', sql.VarChar(10), dtFimContasPagar);
                        }

                        contasPagar.filtrosAplicados = {
                            dtInicio: dtInicioContasPagar || null,
                            dtFim: dtFimContasPagar || null,
                            tipoData: tipoDataContasPagar
                        };

                        // Resumo Geral Contas a Pagar (Incluindo Permutas e Todas as Contas em Aberto)
                        const resPagarSummary = await reqPagar.query(`
                            SELECT 
                                COUNT(*) as qtd_titulos,
                                COUNT(DISTINCT c.cdPessoaComercial) as qtd_fornecedores,
                                SUM(ISNULL(cp.vlParcela, 0)) as total_emitido,
                                SUM(ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0)) as total_pago,
                                SUM(ISNULL(cp.vlParcela, 0) - (ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0))) as total_a_pagar,
                                SUM(CASE WHEN CAST(cp.dtParcela AS DATE) < CAST(GETDATE() AS DATE) THEN (ISNULL(cp.vlParcela, 0) - (ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0))) ELSE 0 END) as total_vencido,
                                SUM(CASE WHEN CAST(cp.dtParcela AS DATE) >= CAST(GETDATE() AS DATE) THEN (ISNULL(cp.vlParcela, 0) - (ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0))) ELSE 0 END) as total_a_vencer,
                                COUNT(CASE WHEN CAST(cp.dtParcela AS DATE) < CAST(GETDATE() AS DATE) THEN 1 END) as qtd_vencidos,
                                COUNT(CASE WHEN CAST(cp.dtParcela AS DATE) >= CAST(GETDATE() AS DATE) THEN 1 END) as qtd_a_vencer,
                                SUM(CASE WHEN (UPPER(ISNULL(cp.Historico, '')) LIKE '%PERMUT%' OR UPPER(ISNULL(c.Documento, '')) LIKE '%PERMUT%' OR UPPER(ISNULL(cb.Historico, '')) LIKE '%PERMUT%') THEN (ISNULL(cp.vlParcela, 0) - (ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0))) ELSE 0 END) as total_permuta,
                                COUNT(CASE WHEN (UPPER(ISNULL(cp.Historico, '')) LIKE '%PERMUT%' OR UPPER(ISNULL(c.Documento, '')) LIKE '%PERMUT%' OR UPPER(ISNULL(cb.Historico, '')) LIKE '%PERMUT%') THEN 1 END) as qtd_permuta
                            FROM tbContaParcela cp WITH (NOLOCK)
                            INNER JOIN tbConta c WITH (NOLOCK) ON c.cdConta = cp.cdConta AND c.cdPessoaFilialConta = cp.cdPessoaFilialConta
                            LEFT JOIN tbContaBaixa cb WITH (NOLOCK) ON cb.cdContaBaixa = cp.cdContaBaixa AND cb.cdPessoaFilialContaBaixa = cp.cdPessoaFilialContaBaixa
                            WHERE (c.cdContaTipo IN (1, 3))
                              AND (ISNULL(cb.inRecebimento, 0) = 0)
                              AND (cp.cdContaBaixa IS NULL OR (ISNULL(cp.vlParcela, 0) - (ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0))) > 0.01)
                              ${dateFilterClausePagar}
                              ${filialClausePagar}
                        `);
                        const pagarRow = resPagarSummary.recordset?.[0] || {};
                        const totVencidoPagar = Number(pagarRow.total_vencido || 0);
                        const totAVencerPagar = Number(pagarRow.total_a_vencer || 0);
                        const totPagar = totVencidoPagar + totAVencerPagar;
                        const qtdVencPagar = Number(pagarRow.qtd_vencidos || 0);
                        const qtdAVencPagar = Number(pagarRow.qtd_a_vencer || 0);
                        const qtdTotPagar = (qtdVencPagar + qtdAVencPagar > 0) ? (qtdVencPagar + qtdAVencPagar) : Number(pagarRow.qtd_titulos || 0);

                        contasPagar.summary = {
                            totalAPagar: totPagar,
                            totalPagar: totPagar,
                            totalEmitido: Number(pagarRow.total_emitido || 0),
                            totalPago: Number(pagarRow.total_pago || 0),
                            totalVencido: totVencidoPagar,
                            totalAVencer: totAVencerPagar,
                            totalPermuta: Number(pagarRow.total_permuta || 0),
                            qtdPermuta: Number(pagarRow.qtd_permuta || 0),
                            qtdTitulos: qtdTotPagar,
                            qtdVencidos: qtdVencPagar,
                            qtdAVencer: qtdAVencPagar,
                            qtdFornecedores: Number(pagarRow.qtd_fornecedores || 0),
                            ticketMedio: qtdTotPagar > 0 ? totPagar / qtdTotPagar : 0
                        };

                        // Top Fornecedores com maior saldo a pagar
                        const resPagarTop = await reqPagar.query(`
                            SELECT TOP 10
                                c.cdPessoaComercial,
                                ISNULL(NULLIF(RTRIM(LTRIM(p.nmPessoa)), ''), 'Fornecedor não identificado') as fornecedor,
                                COUNT(cp.cdContaParcela) as qtd_titulos,
                                SUM(ISNULL(cp.vlParcela, 0)) as total_emitido,
                                SUM(ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0)) as total_pago,
                                SUM(ISNULL(cp.vlParcela, 0) - (ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0))) as total_a_pagar
                            FROM tbContaParcela cp WITH (NOLOCK)
                            INNER JOIN tbConta c WITH (NOLOCK) ON c.cdConta = cp.cdConta AND c.cdPessoaFilialConta = cp.cdPessoaFilialConta
                            LEFT JOIN tbContaBaixa cb WITH (NOLOCK) ON cb.cdContaBaixa = cp.cdContaBaixa AND cb.cdPessoaFilialContaBaixa = cp.cdPessoaFilialContaBaixa
                            LEFT JOIN tbPessoa p WITH (NOLOCK) ON p.cdPessoa = c.cdPessoaComercial
                            WHERE (c.cdContaTipo IN (1, 3))
                              AND (ISNULL(cb.inRecebimento, 0) = 0)
                              AND (cp.cdContaBaixa IS NULL OR (ISNULL(cp.vlParcela, 0) - (ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0))) > 0.01)
                              ${dateFilterClausePagar}
                              ${filialClausePagar}
                            GROUP BY c.cdPessoaComercial, p.nmPessoa
                            ORDER BY total_a_pagar DESC
                        `);
                        contasPagar.topFornecedores = (resPagarTop.recordset || []).map((t: any) => {
                            const val = Number(t.total_a_pagar || 0);
                            const pct = totPagar > 0 ? (val / totPagar) * 100 : 0;
                            return {
                                cdPessoaComercial: String(t.cdPessoaComercial || ''),
                                fornecedor: String(t.fornecedor || 'Fornecedor').trim(),
                                qtdTitulos: Number(t.qtd_titulos || 0),
                                totalEmitido: Number(t.total_emitido || 0),
                                totalPago: Number(t.total_pago || 0),
                                totalAPagar: val,
                                percentual: Number(pct.toFixed(1))
                            };
                        });

                        // Agrupamento por Filial
                        const resPagarFilial = await reqPagar.query(`
                            SELECT 
                                c.cdPessoaFilialConta as filial,
                                ISNULL(fil.nmPessoa, CONCAT('Filial ', CAST(c.cdPessoaFilialConta AS VARCHAR(20)))) as nomeFilial,
                                COUNT(*) as qtd_titulos,
                                SUM(ISNULL(cp.vlParcela, 0)) as total_emitido,
                                SUM(ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0)) as total_pago,
                                SUM(ISNULL(cp.vlParcela, 0) - (ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0))) as total_a_pagar,
                                SUM(CASE WHEN CAST(cp.dtParcela AS DATE) < CAST(GETDATE() AS DATE) THEN (ISNULL(cp.vlParcela, 0) - (ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0))) ELSE 0 END) as total_vencido,
                                SUM(CASE WHEN CAST(cp.dtParcela AS DATE) >= CAST(GETDATE() AS DATE) THEN (ISNULL(cp.vlParcela, 0) - (ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0))) ELSE 0 END) as total_a_vencer,
                                COUNT(CASE WHEN CAST(cp.dtParcela AS DATE) < CAST(GETDATE() AS DATE) THEN 1 END) as qtd_vencidos,
                                COUNT(CASE WHEN CAST(cp.dtParcela AS DATE) >= CAST(GETDATE() AS DATE) THEN 1 END) as qtd_a_vencer,
                                SUM(CASE WHEN (UPPER(ISNULL(cp.Historico, '')) LIKE '%PERMUT%' OR UPPER(ISNULL(c.Documento, '')) LIKE '%PERMUT%' OR UPPER(ISNULL(cb.Historico, '')) LIKE '%PERMUT%') THEN (ISNULL(cp.vlParcela, 0) - (ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0))) ELSE 0 END) as total_permuta,
                                COUNT(CASE WHEN (UPPER(ISNULL(cp.Historico, '')) LIKE '%PERMUT%' OR UPPER(ISNULL(c.Documento, '')) LIKE '%PERMUT%' OR UPPER(ISNULL(cb.Historico, '')) LIKE '%PERMUT%') THEN 1 END) as qtd_permuta
                            FROM tbContaParcela cp WITH (NOLOCK)
                            INNER JOIN tbConta c WITH (NOLOCK) ON c.cdConta = cp.cdConta AND c.cdPessoaFilialConta = cp.cdPessoaFilialConta
                            LEFT JOIN tbContaBaixa cb WITH (NOLOCK) ON cb.cdContaBaixa = cp.cdContaBaixa AND cb.cdPessoaFilialContaBaixa = cp.cdPessoaFilialContaBaixa
                            LEFT JOIN tbPessoa fil WITH (NOLOCK) ON fil.cdPessoa = c.cdPessoaFilialConta
                            WHERE (c.cdContaTipo IN (1, 3))
                              AND (ISNULL(cb.inRecebimento, 0) = 0)
                              AND (cp.cdContaBaixa IS NULL OR (ISNULL(cp.vlParcela, 0) - (ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0))) > 0.01)
                              ${dateFilterClausePagar}
                              ${filialClausePagar}
                            GROUP BY c.cdPessoaFilialConta, fil.nmPessoa
                            ORDER BY total_a_pagar DESC
                        `);
                        contasPagar.byFilial = (resPagarFilial.recordset || []).map((f: any) => {
                            const totVenc = Number(f.total_vencido || 0);
                            const totAVenc = Number(f.total_a_vencer || 0);
                            const totPagar = (totVenc + totAVenc > 0) ? (totVenc + totAVenc) : Number(f.total_a_pagar || 0);
                            const qtdVenc = Number(f.qtd_vencidos || 0);
                            const qtdAVenc = Number(f.qtd_a_vencer || 0);
                            const qtdTot = (qtdVenc + qtdAVenc > 0) ? (qtdVenc + qtdAVenc) : Number(f.qtd_titulos || 0);
                            return {
                                filial: Number(f.filial || 1),
                                nomeFilial: String(f.nomeFilial || `Filial ${f.filial}`).trim(),
                                qtdTitulos: qtdTot,
                                qtdVencidos: qtdVenc,
                                qtdAVencer: qtdAVenc,
                                totalAPagar: totPagar,
                                totalVencido: totVenc,
                                totalAVencer: totAVenc,
                                totalPermuta: Number(f.total_permuta || 0),
                                qtdPermuta: Number(f.qtd_permuta || 0),
                                totalEmitido: Number(f.total_emitido || 0),
                                totalPago: Number(f.total_pago || 0)
                            };
                        });

                        // Lista detalhada dos títulos a pagar (Top 2000)
                        let resPagarList: any = null;
                        try {
                            resPagarList = await reqPagar.query(`
                                SELECT TOP 2000
                                    cp.cdConta,
                                    cp.cdContaParcela,
                                    c.cdPessoaComercial,
                                    c.cdContaTipo,
                                    c.cdPagamentoTipo,
                                    COALESCE(NULLIF(RTRIM(LTRIM(pj.RazaoSocial)), ''), NULLIF(RTRIM(LTRIM(pf.nmCompleto)), ''), NULLIF(RTRIM(LTRIM(p.nmPessoa)), ''), 'Fornecedor não identificado') as fornecedor,
                                    COALESCE(
                                        CASE WHEN pj.cdPessoaJuridica IS NOT NULL THEN CONCAT(pj.CNPJEmpresa, pj.CNPJFilial, pj.CNPJDV) END,
                                        CASE WHEN pf.cdPessoaFisica IS NOT NULL THEN CONCAT(pf.CPF, pf.CPFDV) END,
                                        ''
                                    ) as documentoPessoa,
                                    c.Documento as numeroDocumento,
                                    CONVERT(VARCHAR(10), c.dtInclusao, 120) as dtEmissao,
                                    CONVERT(VARCHAR(10), cp.dtParcela, 120) as dtVencimento,
                                    CONVERT(VARCHAR(10), cp.dtCompetencia, 120) as dtCompetencia,
                                    CONVERT(VARCHAR(10), cb.dtContaBaixa, 120) as dtBaixa,
                                    CAST(ISNULL(cp.vlParcela, 0) AS FLOAT) as vlParcela,
                                    CAST(ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0) AS FLOAT) as vlPago,
                                    CAST(ISNULL(cp.vlParcela, 0) - (ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0)) AS FLOAT) as saldoPendente,
                                    CAST(ISNULL(cp.vlMulta, 0) AS FLOAT) as vlMulta,
                                    CAST(ISNULL(cp.vlMora, 0) AS FLOAT) as vlMora,
                                    CAST(ISNULL(cp.vlDesconto, 0) AS FLOAT) as vlDesconto,
                                    CASE WHEN CAST(cp.dtParcela AS DATE) < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END as isVencido,
                                    CASE WHEN CAST(cp.dtParcela AS DATE) < CAST(GETDATE() AS DATE) THEN DATEDIFF(day, cp.dtParcela, GETDATE()) ELSE 0 END as diasAtraso,
                                    CASE WHEN (UPPER(ISNULL(cp.Historico, '')) LIKE '%PERMUT%' OR UPPER(ISNULL(c.Documento, '')) LIKE '%PERMUT%' OR UPPER(ISNULL(cb.Historico, '')) LIKE '%PERMUT%') THEN 1 ELSE 0 END as isPermuta,
                                    ISNULL(cp.Historico, '') as historico,
                                    ISNULL(cb.Historico, '') as historicoBaixa,
                                    cp.cdContaBaixa,
                                    cp.cdBancoContaMovimento,
                                    ISNULL(m.inCancelado, 0) as inCancelado,
                                    ISNULL(c.cdPessoaFilialConta, 1) as filial,
                                    ISNULL(fil.nmPessoa, CONCAT('Filial ', CAST(c.cdPessoaFilialConta AS VARCHAR(20)))) as nomeFilial
                                FROM tbContaParcela cp WITH (NOLOCK)
                                INNER JOIN tbConta c WITH (NOLOCK) ON c.cdConta = cp.cdConta AND c.cdPessoaFilialConta = cp.cdPessoaFilialConta
                                LEFT JOIN tbContaBaixa cb WITH (NOLOCK) ON cb.cdContaBaixa = cp.cdContaBaixa AND cb.cdPessoaFilialContaBaixa = cp.cdPessoaFilialContaBaixa
                                LEFT JOIN tbBancoContaMovimento m WITH (NOLOCK) ON m.cdBancoContaMovimento = cp.cdBancoContaMovimento
                                LEFT JOIN tbPessoa p WITH (NOLOCK) ON p.cdPessoa = c.cdPessoaComercial
                                LEFT JOIN tbPessoaJuridica pj WITH (NOLOCK) ON pj.cdPessoaJuridica = p.cdPessoa
                                LEFT JOIN tbPessoaFisica pf WITH (NOLOCK) ON pf.cdPessoaFisica = p.cdPessoa
                                LEFT JOIN tbPessoa fil WITH (NOLOCK) ON fil.cdPessoa = c.cdPessoaFilialConta
                                WHERE (c.cdContaTipo IN (1, 3))
                                  AND (ISNULL(cb.inRecebimento, 0) = 0)
                                  AND (cp.cdContaBaixa IS NULL OR (ISNULL(cp.vlParcela, 0) - (ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0))) > 0.01)
                                  ${dateFilterClausePagar}
                                  ${filialClausePagar}
                                ORDER BY (ISNULL(cp.vlParcela, 0) - (ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0))) DESC, cp.dtParcela ASC
                            `);
                        } catch (errPjPf: any) {
                            console.warn('[Solidcon Pagar] Fallback sem tbPessoaJuridica/tbPessoaFisica:', errPjPf?.message);
                            resPagarList = await reqPagar.query(`
                                SELECT TOP 2000
                                    cp.cdConta,
                                    cp.cdContaParcela,
                                    c.cdPessoaComercial,
                                    c.cdContaTipo,
                                    c.cdPagamentoTipo,
                                    ISNULL(NULLIF(RTRIM(LTRIM(p.nmPessoa)), ''), 'Fornecedor não identificado') as fornecedor,
                                    '' as documentoPessoa,
                                    c.Documento as numeroDocumento,
                                    CONVERT(VARCHAR(10), c.dtInclusao, 120) as dtEmissao,
                                    CONVERT(VARCHAR(10), cp.dtParcela, 120) as dtVencimento,
                                    CONVERT(VARCHAR(10), cp.dtCompetencia, 120) as dtCompetencia,
                                    CONVERT(VARCHAR(10), cb.dtContaBaixa, 120) as dtBaixa,
                                    CAST(ISNULL(cp.vlParcela, 0) AS FLOAT) as vlParcela,
                                    CAST(ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0) AS FLOAT) as vlPago,
                                    CAST(ISNULL(cp.vlParcela, 0) - (ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0)) AS FLOAT) as saldoPendente,
                                    CAST(ISNULL(cp.vlMulta, 0) AS FLOAT) as vlMulta,
                                    CAST(ISNULL(cp.vlMora, 0) AS FLOAT) as vlMora,
                                    CAST(ISNULL(cp.vlDesconto, 0) AS FLOAT) as vlDesconto,
                                    CASE WHEN CAST(cp.dtParcela AS DATE) < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END as isVencido,
                                    CASE WHEN CAST(cp.dtParcela AS DATE) < CAST(GETDATE() AS DATE) THEN DATEDIFF(day, cp.dtParcela, GETDATE()) ELSE 0 END as diasAtraso,
                                    CASE WHEN (UPPER(ISNULL(cp.Historico, '')) LIKE '%PERMUT%' OR UPPER(ISNULL(c.Documento, '')) LIKE '%PERMUT%' OR UPPER(ISNULL(cb.Historico, '')) LIKE '%PERMUT%') THEN 1 ELSE 0 END as isPermuta,
                                    ISNULL(cp.Historico, '') as historico,
                                    ISNULL(cb.Historico, '') as historicoBaixa,
                                    cp.cdContaBaixa,
                                    cp.cdBancoContaMovimento,
                                    0 as inCancelado,
                                    ISNULL(c.cdPessoaFilialConta, 1) as filial,
                                    ISNULL(fil.nmPessoa, CONCAT('Filial ', CAST(c.cdPessoaFilialConta AS VARCHAR(20)))) as nomeFilial
                                FROM tbContaParcela cp WITH (NOLOCK)
                                INNER JOIN tbConta c WITH (NOLOCK) ON c.cdConta = cp.cdConta AND c.cdPessoaFilialConta = cp.cdPessoaFilialConta
                                LEFT JOIN tbContaBaixa cb WITH (NOLOCK) ON cb.cdContaBaixa = cp.cdContaBaixa AND cb.cdPessoaFilialContaBaixa = cp.cdPessoaFilialContaBaixa
                                LEFT JOIN tbPessoa p WITH (NOLOCK) ON p.cdPessoa = c.cdPessoaComercial
                                LEFT JOIN tbPessoa fil WITH (NOLOCK) ON fil.cdPessoa = c.cdPessoaFilialConta
                                WHERE (c.cdContaTipo IN (1, 3))
                                  AND (ISNULL(cb.inRecebimento, 0) = 0)
                                  AND (cp.cdContaBaixa IS NULL OR (ISNULL(cp.vlParcela, 0) - (ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0))) > 0.01)
                                  ${dateFilterClausePagar}
                                  ${filialClausePagar}
                                ORDER BY (ISNULL(cp.vlParcela, 0) - (ISNULL(cb.vlContaBaixa, 0) + ISNULL(cp.vlDesconto, 0))) DESC, cp.dtParcela ASC
                            `);
                        }

                        contasPagar.lancamentos = (resPagarList?.recordset || []).map((cp: any) => {
                            const isCancelado = Number(cp.inCancelado || 0) === 1;
                            
                            const histStr = String(cp.historico || '').toUpperCase();
                            const docStr = String(cp.numeroDocumento || '').toUpperCase();
                            const histBaixaStr = String(cp.historicoBaixa || '').toUpperCase();

                            const isPermuta = Boolean(cp.isPermuta) || 
                                histStr.includes('PERMUT') ||
                                docStr.includes('PERMUT') ||
                                histBaixaStr.includes('PERMUT');

                            const vlParcela = Number(cp.vlParcela || 0);
                            const vlPagoDb = Number(cp.vlPago || 0);

                            // Determinar o valor da permuta
                            let vlPermutado = 0;
                            if (isPermuta) {
                                if (vlPagoDb > 0 && histBaixaStr.includes('PERMUT')) {
                                    vlPermutado = vlPagoDb;
                                } else {
                                    const fullText = `${cp.historico || ''} ${cp.numeroDocumento || ''} ${cp.historicoBaixa || ''}`;
                                    const match = fullText.match(/PERMUT[A-Z0-9\s\.\:\-]*?([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})|[0-9]+(?:\.[0-9]{2}))/i);
                                    if (match && match[1]) {
                                        const parsedVal = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
                                        if (!isNaN(parsedVal) && parsedVal > 0 && parsedVal <= vlParcela) {
                                            vlPermutado = parsedVal;
                                        } else {
                                            vlPermutado = vlParcela;
                                        }
                                    } else {
                                        vlPermutado = vlParcela;
                                    }
                                }
                            }

                            // Regra de Permuta:
                            // Se o valor da parcela for igual ao valor permutado -> lança como pago (saldo = 0, status = Pago)
                            // Se for diferente -> lança o valor que falta para completar (saldoPendente = vlParcela - vlPermutado, vlPago = vlPermutado)
                            let vlPagoEfetivo = vlPagoDb;
                            let saldoPendente = Math.max(0, vlParcela - vlPagoDb);

                            if (isPermuta && vlPermutado > 0) {
                                if (Math.abs(vlParcela - vlPermutado) <= 0.01) {
                                    vlPagoEfetivo = vlParcela;
                                    saldoPendente = 0;
                                } else {
                                    vlPagoEfetivo = Math.max(vlPagoDb, vlPermutado);
                                    saldoPendente = Math.max(0, vlParcela - vlPagoEfetivo);
                                }
                            }

                            // Um título PAGO (inclusive por permuta) NUNCA é vencido!
                            const isPago = saldoPendente <= 0.01;
                            const isVencido = !isCancelado && !isPago && Boolean(cp.isVencido);
                            const diasAtraso = isVencido ? Number(cp.diasAtraso || 0) : 0;

                            const status = isCancelado
                                ? 'CANCELADO'
                                : (isPago ? 'PAGO' : (isVencido ? 'VENCIDO' : 'A_VENCER'));

                            const statusLabel = isCancelado
                                ? 'Cancelado'
                                : (isPago ? (isPermuta ? 'Pago (Permuta)' : 'Pago') : (isVencido ? 'Vencido' : 'A Vencer'));

                            const filialId = cp.filial !== undefined && cp.filial !== null ? cp.filial : (cp.cdPessoaFilialConta || 1);

                            return {
                                id: `${filialId}_${cp.cdConta}_${cp.cdContaParcela}`,
                                cdConta: Number(cp.cdConta || 0),
                                cdContaParcela: Number(cp.cdContaParcela || 1),
                                cdPessoaComercial: String(cp.cdPessoaComercial || ''),
                                cdContaTipo: cp.cdContaTipo !== undefined ? Number(cp.cdContaTipo) : null,
                                cdPagamentoTipo: cp.cdPagamentoTipo !== undefined ? Number(cp.cdPagamentoTipo) : null,
                                isPermuta: isPermuta,
                                vlPermutado: vlPermutado,
                                fornecedor: String(cp.fornecedor || 'Fornecedor').trim(),
                                documentoPessoa: String(cp.documentoPessoa || '').trim(),
                                numeroDocumento: String(cp.numeroDocumento || '').trim(),
                                dtEmissao: cp.dtEmissao,
                                dtVencimento: cp.dtVencimento,
                                dtCompetencia: cp.dtCompetencia,
                                dtBaixa: cp.dtBaixa,
                                vlParcela: vlParcela,
                                vlPago: vlPagoEfetivo,
                                saldoPendente: saldoPendente,
                                vlMulta: Number(cp.vlMulta || 0),
                                vlMora: Number(cp.vlMora || 0),
                                vlDesconto: Number(cp.vlDesconto || 0),
                                isVencido: isVencido,
                                isCancelado: isCancelado,
                                status: status,
                                statusLabel: statusLabel,
                                diasAtraso: diasAtraso,
                                historico: String(cp.historico || '').trim(),
                                historicoBaixa: String(cp.historicoBaixa || '').trim(),
                                cdContaBaixa: cp.cdContaBaixa ? Number(cp.cdContaBaixa) : null,
                                cdBancoContaMovimento: cp.cdBancoContaMovimento ? Number(cp.cdBancoContaMovimento) : null,
                                filial: Number(filialId),
                                nomeFilial: String(cp.nomeFilial || `Filial ${filialId}`).trim()
                            };
                        });

                        // Reconciliar sumários e agrupamentos com os saldos recalculados por permuta
                        if (contasPagar.lancamentos && contasPagar.lancamentos.length > 0) {
                            let totAPagar = 0;
                            let totVencido = 0;
                            let totAVencer = 0;
                            let totEmitido = 0;
                            let totPago = 0;
                            let totPermuta = 0;
                            let qtdVenc = 0;
                            let qtdAVenc = 0;
                            let qtdPerm = 0;

                            const filiaisMap: Record<string, any> = {};
                            const fornecedoresMap: Record<string, any> = {};

                            contasPagar.lancamentos.forEach((item: any) => {
                                const parcela = Number(item.vlParcela || 0);
                                const pago = Number(item.vlPago || 0);
                                const saldo = Number(item.saldoPendente || 0);
                                const permutado = Number(item.vlPermutado || 0);
                                const isPerm = Boolean(item.isPermuta);
                                const isCanc = Boolean(item.isCancelado);
                                const isItemPago = item.status === 'PAGO' || saldo <= 0.01;
                                const isVenc = !isCanc && !isItemPago && Boolean(item.isVencido);

                                totEmitido += parcela;
                                totPago += pago;
                                if (isPerm || permutado > 0) {
                                    totPermuta += permutado;
                                    qtdPerm += 1;
                                }

                                if (!isCanc && !isItemPago && saldo > 0.01) {
                                    totAPagar += saldo;
                                    if (isVenc) {
                                        totVencido += saldo;
                                        qtdVenc += 1;
                                    } else {
                                        totAVencer += saldo;
                                        qtdAVenc += 1;
                                    }
                                }

                                const fKey = String(item.filial || 1);
                                if (!filiaisMap[fKey]) {
                                    filiaisMap[fKey] = {
                                        filial: Number(item.filial || 1),
                                        nomeFilial: String(item.nomeFilial || `Filial ${item.filial}`).trim(),
                                        qtdTitulos: 0,
                                        qtdVencidos: 0,
                                        qtdAVencer: 0,
                                        totalAPagar: 0,
                                        totalVencido: 0,
                                        totalAVencer: 0,
                                        totalPermuta: 0,
                                        qtdPermuta: 0,
                                        totalEmitido: 0,
                                        totalPago: 0
                                    };
                                }
                                filiaisMap[fKey].qtdTitulos += 1;
                                filiaisMap[fKey].totalEmitido += parcela;
                                filiaisMap[fKey].totalPago += pago;
                                if (isPerm || permutado > 0) {
                                    filiaisMap[fKey].totalPermuta += permutado;
                                    filiaisMap[fKey].qtdPermuta += 1;
                                }
                                if (!isCanc && !isItemPago && saldo > 0.01) {
                                    filiaisMap[fKey].totalAPagar += saldo;
                                    if (isVenc) {
                                        filiaisMap[fKey].totalVencido += saldo;
                                        filiaisMap[fKey].qtdVencidos += 1;
                                    } else {
                                        filiaisMap[fKey].totalAVencer += saldo;
                                        filiaisMap[fKey].qtdAVencer += 1;
                                    }
                                }

                                const fForn = String(item.cdPessoaComercial || item.fornecedor || 'Fornecedor');
                                if (!fornecedoresMap[fForn]) {
                                    fornecedoresMap[fForn] = {
                                        cdPessoaComercial: String(item.cdPessoaComercial || ''),
                                        fornecedor: String(item.fornecedor || 'Fornecedor').trim(),
                                        qtdTitulos: 0,
                                        totalEmitido: 0,
                                        totalPago: 0,
                                        totalAPagar: 0,
                                        percentual: 0
                                    };
                                }
                                fornecedoresMap[fForn].qtdTitulos += 1;
                                fornecedoresMap[fForn].totalEmitido += parcela;
                                fornecedoresMap[fForn].totalPago += pago;
                                if (!isCanc && !isItemPago && saldo > 0.01) {
                                    fornecedoresMap[fForn].totalAPagar += saldo;
                                }
                            });

                            const qtdTit = (qtdVenc + qtdAVenc > 0) ? (qtdVenc + qtdAVenc) : contasPagar.lancamentos.length;
                            contasPagar.summary = {
                                totalAPagar: totAPagar,
                                totalPagar: totAPagar,
                                totalEmitido: totEmitido,
                                totalPago: totPago,
                                totalVencido: totVencido,
                                totalAVencer: totAVencer,
                                totalPermuta: totPermuta,
                                qtdPermuta: qtdPerm,
                                qtdTitulos: qtdTit,
                                qtdVencidos: qtdVenc,
                                qtdAVencer: qtdAVenc,
                                qtdFornecedores: Object.keys(fornecedoresMap).length,
                                ticketMedio: qtdTit > 0 ? totAPagar / qtdTit : 0
                            };

                            contasPagar.byFilial = Object.values(filiaisMap).map((f: any) => ({
                                ...f,
                                qtdTitulos: (Number(f.qtdVencidos || 0) + Number(f.qtdAVencer || 0) > 0) ? (Number(f.qtdVencidos || 0) + Number(f.qtdAVencer || 0)) : Number(f.qtdTitulos || 0)
                            })).sort((a: any, b: any) => b.totalAPagar - a.totalAPagar);

                            const topFornList = Object.values(fornecedoresMap).sort((a: any, b: any) => b.totalAPagar - a.totalAPagar).slice(0, 10);
                            topFornList.forEach((t: any) => {
                                t.percentual = totAPagar > 0 ? Number(((t.totalAPagar / totAPagar) * 100).toFixed(1)) : 0;
                            });
                            contasPagar.topFornecedores = topFornList;
                        }
                    } catch (pagarErr: any) {
                        console.warn('Falha ao consultar contas a pagar no Solidcon:', pagarErr?.message || pagarErr);
                    }
                }

                // Resumo do Mês
                const currentMonthData = monthlyComparison[mes - 1] || {
                    receita: 0,
                    despesa: 0,
                    saldo: 0,
                    qtd_receita: 0,
                    qtd_despesa: 0
                };

                const totalReceita = currentMonthData.receita;
                const totalDespesa = currentMonthData.despesa;
                const saldoLiquido = totalReceita - totalDespesa;
                const totalMovimentado = totalReceita + totalDespesa;
                const margemPercent = totalReceita > 0 ? ((saldoLiquido / totalReceita) * 100).toFixed(1) : '0.0';

                // Top 5 Maiores Receitas e Top 5 Maiores Despesas
                const topReceitas = transactions
                    .filter((t: any) => t.tipo === 'receita')
                    .sort((a: any, b: any) => b.valor - a.valor)
                    .slice(0, 5);

                const topDespesas = transactions
                    .filter((t: any) => t.tipo === 'despesa')
                    .sort((a: any, b: any) => b.valor - a.valor)
                    .slice(0, 5);

                return {
                    params: {
                        ano,
                        mes,
                        mesNome: MONTH_NAMES[mes - 1] || '',
                        cdFilial: cdFilial || null,
                        source
                    },
                    summary: {
                        totalReceita,
                        totalDespesa,
                        saldoLiquido,
                        totalMovimentado,
                        margemPercent: Number(margemPercent),
                        qtdReceita: currentMonthData.qtd_receita,
                        qtdDespesa: currentMonthData.qtd_despesa,
                        ticketMedioReceita: currentMonthData.qtd_receita > 0 ? totalReceita / currentMonthData.qtd_receita : 0,
                        ticketMedioDespesa: currentMonthData.qtd_despesa > 0 ? totalDespesa / currentMonthData.qtd_despesa : 0
                    },
                    salesSummary,
                    salesByModality,
                    annualSalesByModality,
                    convenioData,
                    crediarioReceber,
                    cartoesNaoBaixados,
                    contasPagar,
                    monthlyComparison,
                    annualByCategory,
                    dailyEvolution,
                    byBank,
                    byCategory,
                    topReceitas,
                    topDespesas,
                    transactions,
                    filiais
                };
        } catch (err: any) {
            throw new Error(`Falha ao conectar no banco Solidcon para Visão Financeira: ${err?.message || err}`);
        } finally {
            if (pool) {
                try {
                    await pool.close();
                } catch {
                    // ignore
                }
            }
        }
    }

    static mergeSolidconFinanceVisionResults(results: any[]): any {
        if (!results || results.length === 0) return null;
        if (results.length === 1) return results[0];

        const first = results[0];
        const params = first?.params || {};

        // 1. Monthly comparison
        const monthlyComparison = Array.from({ length: 12 }, (_, idx) => {
            const mNum = idx + 1;
            let rec = 0;
            let desp = 0;
            let qtdRec = 0;
            let qtdDesp = 0;
            let mesNome = '';
            let mesSigla = '';

            results.forEach(r => {
                const item = r.monthlyComparison?.[idx];
                if (item) {
                    rec += Number(item.receita || 0);
                    desp += Number(item.despesa || 0);
                    qtdRec += Number(item.qtd_receita || 0);
                    qtdDesp += Number(item.qtd_despesa || 0);
                    if (!mesNome && item.mesNome) mesNome = item.mesNome;
                    if (!mesSigla && item.mesSigla) mesSigla = item.mesSigla;
                }
            });

            return {
                mes: mNum,
                mesNome: mesNome || '',
                mesSigla: mesSigla || '',
                receita: rec,
                despesa: desp,
                saldo: rec - desp,
                qtd_receita: qtdRec,
                qtd_despesa: qtdDesp
            };
        });

        // 2. Daily evolution
        const maxDays = Math.max(...results.map(r => r.dailyEvolution?.length || 0), 1);
        const dailyEvolution = Array.from({ length: maxDays }, (_, idx) => {
            const diaNum = idx + 1;
            let rec = 0;
            let desp = 0;
            let qtdRec = 0;
            let qtdDesp = 0;
            let data = '';

            results.forEach(r => {
                const item = r.dailyEvolution?.[idx];
                if (item) {
                    rec += Number(item.receita || 0);
                    desp += Number(item.despesa || 0);
                    qtdRec += Number(item.qtd_receita || 0);
                    qtdDesp += Number(item.qtd_despesa || 0);
                    if (!data && item.data) data = item.data;
                }
            });

            return {
                dia: diaNum,
                data: data || '',
                receita: rec,
                despesa: desp,
                saldo: rec - desp,
                qtd_receita: qtdRec,
                qtd_despesa: qtdDesp
            };
        });

        // 3. Summary (Current Month)
        const mesIdx = (params.mes ? parseInt(String(params.mes), 10) : 1) - 1;
        const currentMonthData = monthlyComparison[mesIdx] || { receita: 0, despesa: 0, saldo: 0, qtd_receita: 0, qtd_despesa: 0 };
        const totalReceita = currentMonthData.receita;
        const totalDespesa = currentMonthData.despesa;
        const saldoLiquido = totalReceita - totalDespesa;
        const totalMovimentado = totalReceita + totalDespesa;
        const margemPercent = totalReceita > 0 ? Number(((saldoLiquido / totalReceita) * 100).toFixed(1)) : 0;
        const qtdReceita = currentMonthData.qtd_receita;
        const qtdDespesa = currentMonthData.qtd_despesa;

        const summary = {
            totalReceita,
            totalDespesa,
            saldoLiquido,
            totalMovimentado,
            margemPercent,
            qtdReceita,
            qtdDespesa,
            ticketMedioReceita: qtdReceita > 0 ? totalReceita / qtdReceita : 0,
            ticketMedioDespesa: qtdDespesa > 0 ? totalDespesa / qtdDespesa : 0
        };

        // 4. Sales Summary
        let totalVendas = 0;
        let qtdVendas = 0;
        let totalLiquidoSales = 0;
        let totalDesconto = 0;
        let totalAcrescimo = 0;

        results.forEach(r => {
            const ss = r.salesSummary || {};
            totalVendas += Number(ss.totalVendas || 0);
            qtdVendas += Number(ss.qtdVendas || 0);
            totalLiquidoSales += Number(ss.totalLiquido || 0);
            totalDesconto += Number(ss.totalDesconto || 0);
            totalAcrescimo += Number(ss.totalAcrescimo || 0);
        });

        const salesSummary = {
            totalVendas,
            qtdVendas,
            ticketMedio: qtdVendas > 0 ? totalVendas / qtdVendas : 0,
            totalLiquido: totalLiquidoSales,
            totalDesconto,
            totalAcrescimo
        };

        // 5. Sales by Modality
        const modalityMap: Record<string, any> = {};
        results.forEach(r => {
            (r.salesByModality || []).forEach((m: any) => {
                const key = String(m.cdModo || m.nmModo || 'Outros');
                if (!modalityMap[key]) {
                    modalityMap[key] = {
                        cdModo: m.cdModo,
                        nmModo: m.nmModo || key,
                        total: 0,
                        qtd: 0,
                        pct: 0
                    };
                }
                modalityMap[key].total += Number(m.total || 0);
                modalityMap[key].qtd += Number(m.qtd || 0);
            });
        });
        const salesByModality = Object.values(modalityMap).map((m: any) => ({
            ...m,
            pct: totalVendas > 0 ? Number(((m.total / totalVendas) * 100).toFixed(1)) : 0
        })).sort((a: any, b: any) => b.total - a.total);

        // 6. Annual Sales by Modality
        const annualSalesModMap: Record<string, any> = {};
        results.forEach(r => {
            (r.annualSalesByModality || []).forEach((m: any) => {
                const key = `${m.mes}_${m.cdModo || m.nmModo}`;
                if (!annualSalesModMap[key]) {
                    annualSalesModMap[key] = {
                        mes: Number(m.mes),
                        cdModo: m.cdModo,
                        nmModo: m.nmModo,
                        total: 0,
                        qtd: 0
                    };
                }
                annualSalesModMap[key].total += Number(m.total || 0);
                annualSalesModMap[key].qtd += Number(m.qtd || 0);
            });
        });
        const annualSalesByModality = Object.values(annualSalesModMap).sort((a: any, b: any) => a.mes - b.mes || b.total - a.total);

        // 7. By Bank
        const bankMap: Record<string, any> = {};
        results.forEach(r => {
            (r.byBank || []).forEach((b: any) => {
                const key = `${b.banco}_${b.conta_numero}`;
                if (!bankMap[key]) {
                    bankMap[key] = {
                        banco: b.banco,
                        conta_numero: b.conta_numero,
                        receita: 0,
                        despesa: 0,
                        saldo: 0,
                        total_movimentado: 0,
                        qtd: 0
                    };
                }
                bankMap[key].receita += Number(b.receita || 0);
                bankMap[key].despesa += Number(b.despesa || 0);
                bankMap[key].saldo += Number(b.saldo || 0);
                bankMap[key].total_movimentado += Number(b.total_movimentado || 0);
                bankMap[key].qtd += Number(b.qtd || 0);
            });
        });
        const byBank = Object.values(bankMap).sort((a: any, b: any) => b.total_movimentado - a.total_movimentado);

        // 8. By Category & Annual by Category
        const catMap: Record<string, any> = {};
        results.forEach(r => {
            (r.byCategory || []).forEach((c: any) => {
                const key = `${c.tipo}_${c.tipoconta}`;
                if (!catMap[key]) {
                    catMap[key] = {
                        tipo: c.tipo,
                        tipoconta: c.tipoconta,
                        valor: 0,
                        qtd: 0
                    };
                }
                catMap[key].valor += Number(c.valor || 0);
                catMap[key].qtd += Number(c.qtd || 0);
            });
        });
        const byCategory = Object.values(catMap).sort((a: any, b: any) => b.valor - a.valor);

        const annualCatMap: Record<string, any> = {};
        results.forEach(r => {
            (r.annualByCategory || []).forEach((c: any) => {
                const key = `${c.mes}_${c.tipo}_${c.tipoconta}`;
                if (!annualCatMap[key]) {
                    annualCatMap[key] = {
                        mes: Number(c.mes),
                        tipo: c.tipo,
                        tipoconta: c.tipoconta,
                        valor: 0,
                        qtd: 0
                    };
                }
                annualCatMap[key].valor += Number(c.valor || 0);
                annualCatMap[key].qtd += Number(c.qtd || 0);
            });
        });
        const annualByCategory = Object.values(annualCatMap).sort((a: any, b: any) => a.mes - b.mes || b.valor - a.valor);

        // 9. Transactions, Top Receitas, Top Despesas
        let allTransactions: any[] = [];
        results.forEach(r => {
            if (Array.isArray(r.transactions)) {
                allTransactions = allTransactions.concat(r.transactions);
            }
        });
        allTransactions.sort((a: any, b: any) => (b.data || '').localeCompare(a.data || '') || Number(b.valor || 0) - Number(a.valor || 0));
        const transactions = allTransactions.slice(0, 500);

        const topReceitas = allTransactions
            .filter((t: any) => t.tipo === 'receita')
            .sort((a: any, b: any) => Number(b.valor || 0) - Number(a.valor || 0))
            .slice(0, 5);

        const topDespesas = allTransactions
            .filter((t: any) => t.tipo === 'despesa')
            .sort((a: any, b: any) => Number(b.valor || 0) - Number(a.valor || 0))
            .slice(0, 5);

        // 10. Filiais
        const filiaisMap: Record<string, any> = {};
        results.forEach(r => {
            (r.filiais || []).forEach((f: any) => {
                const fId = typeof f === 'object' ? String(f.id) : String(f);
                const fNome = typeof f === 'object' ? (f.nome || `Filial ${f.id}`) : `Filial ${f}`;
                if (!filiaisMap[fId]) {
                    filiaisMap[fId] = { id: fId, nome: fNome };
                }
            });
        });
        const filiais = Object.values(filiaisMap);

        // 11. Convenio Data
        let convEmitido = 0;
        let convQuitado = 0;
        let convQtdCupons = 0;
        let convRecebidoBaixas = 0;
        let convJuros = 0;
        let convQtdBaixas = 0;
        const topClientesMap: Record<string, any> = {};
        let recentBaixas: any[] = [];
        const convDailyMap: Record<string, any> = {};
        const convAnnualMap: Record<number, any> = {};

        results.forEach(r => {
            const cd = r.convenioData;
            if (cd && cd.summary) {
                convEmitido += Number(cd.summary.totalEmitido || 0);
                convQuitado += Number(cd.summary.totalQuitado || 0);
                convQtdCupons += Number(cd.summary.qtdCupons || 0);
                convRecebidoBaixas += Number(cd.summary.totalRecebidoBaixas || 0);
                convJuros += Number(cd.summary.totalJuros || 0);
                convQtdBaixas += Number(cd.summary.qtdBaixas || 0);
            }
            (cd?.topClientes || []).forEach((tc: any) => {
                const k = tc.cliente || tc.cpf_cnpj || 'Outros';
                if (!topClientesMap[k]) {
                    topClientesMap[k] = { ...tc, total_emitido: 0, total_quitado: 0, total_pendente: 0, qtd_cupons: 0 };
                }
                topClientesMap[k].total_emitido += Number(tc.total_emitido || 0);
                topClientesMap[k].total_quitado += Number(tc.total_quitado || 0);
                topClientesMap[k].total_pendente += Number(tc.total_pendente || 0);
                topClientesMap[k].qtd_cupons += Number(tc.qtd_cupons || 0);
            });
            if (Array.isArray(cd?.recentBaixas)) {
                recentBaixas = recentBaixas.concat(cd.recentBaixas);
            }
            (cd?.dailyEvolution || []).forEach((de: any) => {
                const k = String(de.dia || de.data);
                if (!convDailyMap[k]) {
                    convDailyMap[k] = { ...de, total_emitido: 0, total_quitado: 0, qtd_cupons: 0 };
                }
                convDailyMap[k].total_emitido += Number(de.total_emitido || 0);
                convDailyMap[k].total_quitado += Number(de.total_quitado || 0);
                convDailyMap[k].qtd_cupons += Number(de.qtd_cupons || 0);
            });
            (cd?.annualSummary || []).forEach((as: any) => {
                const k = Number(as.mes);
                if (!convAnnualMap[k]) {
                    convAnnualMap[k] = { ...as, total_emitido: 0, total_quitado: 0, qtd_cupons: 0 };
                }
                convAnnualMap[k].total_emitido += Number(as.total_emitido || 0);
                convAnnualMap[k].total_quitado += Number(as.total_quitado || 0);
                convAnnualMap[k].qtd_cupons += Number(as.qtd_cupons || 0);
            });
        });

        const convTotalPendente = Math.max(0, convEmitido - convQuitado);
        const convenioData = {
            dateFilter: first.convenioData?.dateFilter || 'baixa',
            summary: {
                totalEmitido: convEmitido,
                totalQuitado: convQuitado,
                totalPendente: convTotalPendente,
                qtdCupons: convQtdCupons,
                ticketMedio: convQtdCupons > 0 ? (convQuitado > 0 ? convQuitado / convQtdCupons : convEmitido / convQtdCupons) : 0,
                totalRecebidoBaixas: convRecebidoBaixas,
                totalJuros: convJuros,
                qtdBaixas: convQtdBaixas,
                pctQuitado: convEmitido > 0 ? (convQuitado / convEmitido) * 100 : 0
            },
            topClientes: Object.values(topClientesMap).sort((a: any, b: any) => b.total_emitido - a.total_emitido).slice(0, 10),
            dailyEvolution: Object.values(convDailyMap).sort((a: any, b: any) => (a.dia || 0) - (b.dia || 0)),
            recentBaixas: recentBaixas.sort((a: any, b: any) => (b.dtContaBaixa || '').localeCompare(a.dtContaBaixa || '')).slice(0, 20),
            annualSummary: Object.values(convAnnualMap).sort((a: any, b: any) => a.mes - b.mes)
        };

        // 12. Crediario a Receber
        const credLoaded = results.some(r => r.crediarioReceber?.loaded);
        let crSumReceber = 0;
        let crSumAVencer = 0;
        let crSumVencido = 0;
        let crQtdCupons = 0;
        let crVencidos30 = 0;
        let crVencidos60 = 0;
        let crVencidos90 = 0;
        let crVencidosMais90 = 0;
        const crClientesMap: Record<string, any> = {};
        const crFiliaisMap: Record<string, any> = {};
        let crCupons: any[] = [];

        results.forEach(r => {
            const cr = r.crediarioReceber;
            if (cr && cr.summary) {
                const sVenc = Number(cr.summary.totalVencido || 0);
                const sAVenc = Number(cr.summary.totalAVencer || 0);
                const sRec = (sVenc + sAVenc > 0) ? (sVenc + sAVenc) : Number(cr.summary.totalAReceber || cr.summary.totalReceber || 0);
                crSumReceber += sRec;
                crSumAVencer += sAVenc;
                crSumVencido += sVenc;
                const qVenc = Number(cr.summary.qtdVencidos || 0);
                const qAVenc = Number(cr.summary.qtdAVencer || 0);
                const qTot = (qVenc + qAVenc > 0) ? (qVenc + qAVenc) : Number(cr.summary.qtdCupons || 0);
                crQtdCupons += qTot;
                crVencidos30 += Number(cr.summary.vencidos30 || 0);
                crVencidos60 += Number(cr.summary.vencidos60 || 0);
                crVencidos90 += Number(cr.summary.vencidos90 || 0);
                crVencidosMais90 += Number(cr.summary.vencidosMais90 || 0);
            }
            (cr?.byCliente || []).forEach((c: any) => {
                const k = String(c.cdCliente || c.nome || 'Outros');
                if (!crClientesMap[k]) {
                    crClientesMap[k] = { ...c, total: 0, totalAVencer: 0, totalVencido: 0, qtdCupons: 0 };
                }
                crClientesMap[k].total += Number(c.total || 0);
                crClientesMap[k].totalAVencer += Number(c.totalAVencer || 0);
                crClientesMap[k].totalVencido += Number(c.totalVencido || 0);
                crClientesMap[k].qtdCupons += Number(c.qtdCupons || 0);
            });
            (cr?.byFilial || []).forEach((f: any) => {
                const k = String(f.filial || f.nome_filial || 'Outros');
                if (!crFiliaisMap[k]) {
                    crFiliaisMap[k] = { ...f, total: 0, totalAVencer: 0, totalVencido: 0, qtdCupons: 0 };
                }
                crFiliaisMap[k].total += Number(f.total || 0);
                crFiliaisMap[k].totalAVencer += Number(f.totalAVencer || 0);
                crFiliaisMap[k].totalVencido += Number(f.totalVencido || 0);
                crFiliaisMap[k].qtdCupons += Number(f.qtdCupons || 0);
            });
            if (Array.isArray(cr?.cupons)) {
                crCupons = crCupons.concat(cr.cupons);
            }
        });

        const totalCrediarioReceber = (crSumVencido + crSumAVencer > 0) ? (crSumVencido + crSumAVencer) : crSumReceber;
        const crediarioReceber = {
            loaded: credLoaded,
            dateFilter: first.crediarioReceber?.dateFilter || 'vencimento',
            summary: {
                totalAReceber: totalCrediarioReceber,
                totalReceber: totalCrediarioReceber,
                totalAVencer: crSumAVencer,
                totalVencido: crSumVencido,
                qtdCupons: crQtdCupons,
                qtdClientes: Object.keys(crClientesMap).length,
                ticketMedio: crQtdCupons > 0 ? totalCrediarioReceber / crQtdCupons : 0,
                vencidos30: crVencidos30,
                vencidos60: crVencidos60,
                vencidos90: crVencidos90,
                vencidosMais90: crVencidosMais90
            },
            byCliente: Object.values(crClientesMap).sort((a: any, b: any) => b.total - a.total),
            byFilial: Object.values(crFiliaisMap).sort((a: any, b: any) => b.total - a.total),
            cupons: crCupons.sort((a: any, b: any) => (a.dtVencimento || '').localeCompare(b.dtVencimento || ''))
        };

        // 13. Cartoes Nao Baixados
        const cartoesLoaded = results.some(r => r.cartoesNaoBaixados?.loaded);
        let cbSumBruto = 0;
        let cbSumLiquido = 0;
        let cbSumTaxa = 0;
        let cbSumOperacoes = 0;
        let cbSumAVencer = 0;
        let cbSumVencido = 0;
        let cbQtdAVencer = 0;
        let cbQtdVencidos = 0;
        const cbBandeiraMap: Record<string, any> = {};
        const cbModalidadeMap: Record<string, any> = {};
        const cbFilialMap: Record<string, any> = {};
        let cbLancamentos: any[] = [];

        results.forEach(r => {
            const cb = r.cartoesNaoBaixados;
            if (cb && cb.summary) {
                cbSumBruto += Number(cb.summary.totalBruto || 0);
                cbSumLiquido += Number(cb.summary.totalLiquido || 0);
                cbSumTaxa += Number(cb.summary.totalTaxa || 0);
                cbSumOperacoes += Number(cb.summary.totalOperacoes || 0);
                cbSumAVencer += Number(cb.summary.totalAVencer || 0);
                cbSumVencido += Number(cb.summary.totalVencido || 0);
                cbQtdAVencer += Number(cb.summary.qtdAVencer || 0);
                cbQtdVencidos += Number(cb.summary.qtdVencidos || 0);
            }
            (cb?.byBandeira || []).forEach((b: any) => {
                const k = b.bandeira || 'Outros';
                if (!cbBandeiraMap[k]) {
                    cbBandeiraMap[k] = { ...b, totalBruto: 0, totalLiquido: 0, totalTaxa: 0, totalOperacoes: 0, totalLancamentos: 0 };
                }
                cbBandeiraMap[k].totalBruto += Number(b.totalBruto || 0);
                cbBandeiraMap[k].totalLiquido += Number(b.totalLiquido || 0);
                cbBandeiraMap[k].totalTaxa += Number(b.totalTaxa || 0);
                cbBandeiraMap[k].totalOperacoes += Number(b.totalOperacoes || 0);
                cbBandeiraMap[k].totalLancamentos += Number(b.totalLancamentos || 0);
            });
            (cb?.byModalidade || []).forEach((m: any) => {
                const k = m.modalidade || 'Outros';
                if (!cbModalidadeMap[k]) {
                    cbModalidadeMap[k] = { ...m, totalBruto: 0, totalLiquido: 0, totalTaxa: 0, totalOperacoes: 0, totalLancamentos: 0 };
                }
                cbModalidadeMap[k].totalBruto += Number(m.totalBruto || 0);
                cbModalidadeMap[k].totalLiquido += Number(m.totalLiquido || 0);
                cbModalidadeMap[k].totalTaxa += Number(m.totalTaxa || 0);
                cbModalidadeMap[k].totalOperacoes += Number(m.totalOperacoes || 0);
                cbModalidadeMap[k].totalLancamentos += Number(m.totalLancamentos || 0);
            });
            (cb?.byFilial || []).forEach((f: any) => {
                const k = String(f.filial || f.nome_filial || 'Outros');
                if (!cbFilialMap[k]) {
                    cbFilialMap[k] = { ...f, totalBruto: 0, totalLiquido: 0, totalTaxa: 0, totalOperacoes: 0, totalLancamentos: 0 };
                }
                cbFilialMap[k].totalBruto += Number(f.totalBruto || 0);
                cbFilialMap[k].totalLiquido += Number(f.totalLiquido || 0);
                cbFilialMap[k].totalTaxa += Number(f.totalTaxa || 0);
                cbFilialMap[k].totalOperacoes += Number(f.totalOperacoes || 0);
                cbFilialMap[k].totalLancamentos += Number(f.totalLancamentos || 0);
            });
            if (Array.isArray(cb?.lancamentos)) {
                cbLancamentos = cbLancamentos.concat(cb.lancamentos);
            }
        });

        const cartoesNaoBaixados = {
            loaded: cartoesLoaded,
            summary: {
                totalBruto: cbSumBruto,
                totalLiquido: cbSumLiquido,
                totalTaxa: cbSumTaxa,
                totalOperacoes: cbSumOperacoes,
                totalLancamentos: cbLancamentos.length,
                ticketMedio: cbSumOperacoes > 0 ? cbSumLiquido / cbSumOperacoes : 0,
                totalAVencer: cbSumAVencer,
                totalVencido: cbSumVencido,
                qtdAVencer: cbQtdAVencer,
                qtdVencidos: cbQtdVencidos
            },
            byBandeira: Object.values(cbBandeiraMap).sort((a: any, b: any) => b.totalLiquido - a.totalLiquido),
            byModalidade: Object.values(cbModalidadeMap).sort((a: any, b: any) => b.totalLiquido - a.totalLiquido),
            byFilial: Object.values(cbFilialMap).sort((a: any, b: any) => b.totalLiquido - a.totalLiquido),
            lancamentos: cbLancamentos.sort((a: any, b: any) => (b.dtVenda || '').localeCompare(a.dtVenda || ''))
        };

        // 14. Contas a Pagar
        const cpLoaded = results.some(r => r.contasPagar?.loaded);
        let cpSumPagar = 0;
        let cpSumAVencer = 0;
        let cpSumVencido = 0;
        let cpSumPermuta = 0;
        let cpQtdPermuta = 0;
        let cpQtdTitulos = 0;
        let cpSumEmitido = 0;
        let cpSumPago = 0;
        const cpFornecedoresMap: Record<string, any> = {};
        const cpFiliaisMap: Record<string, any> = {};
        let cpLancamentos: any[] = [];

        results.forEach(r => {
            const cp = r.contasPagar;
            if (cp && cp.summary) {
                const sVenc = Number(cp.summary.totalVencido || 0);
                const sAVenc = Number(cp.summary.totalAVencer || 0);
                const sPag = (sVenc + sAVenc > 0) ? (sVenc + sAVenc) : Number(cp.summary.totalAPagar || cp.summary.totalPagar || 0);
                cpSumPagar += sPag;
                cpSumAVencer += sAVenc;
                cpSumVencido += sVenc;
                cpSumPermuta += Number(cp.summary.totalPermuta || 0);
                cpQtdPermuta += Number(cp.summary.qtdPermuta || 0);
                cpSumEmitido += Number(cp.summary.totalEmitido || 0);
                cpSumPago += Number(cp.summary.totalPago || 0);
                const qVenc = Number(cp.summary.qtdVencidos || 0);
                const qAVenc = Number(cp.summary.qtdAVencer || 0);
                const qTot = (qVenc + qAVenc > 0) ? (qVenc + qAVenc) : Number(cp.summary.qtdTitulos || 0);
                cpQtdTitulos += qTot;
            }
            (cp?.topFornecedores || []).forEach((f: any) => {
                const k = String(f.cdPessoaComercial || f.fornecedor || 'Outros');
                if (!cpFornecedoresMap[k]) {
                    cpFornecedoresMap[k] = { ...f, totalAPagar: 0, totalEmitido: 0, totalPago: 0, qtdTitulos: 0 };
                }
                cpFornecedoresMap[k].totalAPagar += Number(f.totalAPagar || 0);
                cpFornecedoresMap[k].totalEmitido += Number(f.totalEmitido || 0);
                cpFornecedoresMap[k].totalPago += Number(f.totalPago || 0);
                cpFornecedoresMap[k].qtdTitulos += Number(f.qtdTitulos || 0);
            });
            (cp?.byFilial || []).forEach((f: any) => {
                const k = String(f.filial || f.nomeFilial || 'Outros');
                if (!cpFiliaisMap[k]) {
                    cpFiliaisMap[k] = { ...f, totalAPagar: 0, totalVencido: 0, totalAVencer: 0, totalPermuta: 0, qtdPermuta: 0, qtdTitulos: 0, qtdVencidos: 0, qtdAVencer: 0 };
                }
                cpFiliaisMap[k].totalAPagar += Number(f.totalAPagar || 0);
                cpFiliaisMap[k].totalVencido += Number(f.totalVencido || 0);
                cpFiliaisMap[k].totalAVencer += Number(f.totalAVencer || 0);
                cpFiliaisMap[k].totalPermuta += Number(f.totalPermuta || 0);
                cpFiliaisMap[k].qtdPermuta += Number(f.qtdPermuta || 0);
                cpFiliaisMap[k].qtdTitulos += Number(f.qtdTitulos || 0);
                cpFiliaisMap[k].qtdVencidos += Number(f.qtdVencidos || 0);
                cpFiliaisMap[k].qtdAVencer += Number(f.qtdAVencer || 0);
            });
        });

        const seenCpKeys = new Set<string>();
        results.forEach(r => {
            const cp = r.contasPagar;
            if (Array.isArray(cp?.lancamentos)) {
                cp.lancamentos.forEach((item: any) => {
                    const uniqueKey = String(item.id || `${item.filial}_${item.cdConta}_${item.cdContaParcela}`);
                    if (!seenCpKeys.has(uniqueKey)) {
                        seenCpKeys.add(uniqueKey);
                        cpLancamentos.push(item);
                    }
                });
            }
        });

        const totalContasPagar = cpSumVencido + cpSumAVencer;
        const contasPagar = {
            loaded: cpLoaded,
            filtrosAplicados: first.contasPagar?.filtrosAplicados || {
                dtInicio: null,
                dtFim: null,
                tipoData: 'vencimento'
            },
            summary: {
                totalAPagar: totalContasPagar,
                totalPagar: totalContasPagar,
                totalEmitido: cpSumEmitido,
                totalPago: cpSumPago,
                totalAVencer: cpSumAVencer,
                totalVencido: cpSumVencido,
                totalPermuta: cpSumPermuta,
                qtdPermuta: cpQtdPermuta,
                qtdTitulos: cpQtdTitulos,
                qtdVencidos: results.reduce((acc, r) => acc + Number(r.contasPagar?.summary?.qtdVencidos || 0), 0),
                qtdAVencer: results.reduce((acc, r) => acc + Number(r.contasPagar?.summary?.qtdAVencer || 0), 0),
                qtdFornecedores: Object.keys(cpFornecedoresMap).length,
                ticketMedio: cpQtdTitulos > 0 ? totalContasPagar / cpQtdTitulos : 0
            },
            topFornecedores: Object.values(cpFornecedoresMap).sort((a: any, b: any) => b.totalAPagar - a.totalAPagar),
            byFilial: Object.values(cpFiliaisMap).sort((a: any, b: any) => b.totalAPagar - a.totalAPagar),
            lancamentos: cpLancamentos.sort((a: any, b: any) => (a.dtVencimento || '').localeCompare(b.dtVencimento || ''))
        };

        if (cpLancamentos.length > 0) {
            let mTotAPagar = 0;
            let mTotVencido = 0;
            let mTotAVencer = 0;
            let mTotEmitido = 0;
            let mTotPago = 0;
            let mTotPermuta = 0;
            let mQtdVenc = 0;
            let mQtdAVenc = 0;
            let mQtdPerm = 0;

            const mFiliaisMap: Record<string, any> = {};
            const mFornecedoresMap: Record<string, any> = {};

            cpLancamentos.forEach((item: any) => {
                const parcela = Number(item.vlParcela || 0);
                const pago = Number(item.vlPago || 0);
                const saldo = Number(item.saldoPendente || 0);
                const permutado = Number(item.vlPermutado || 0);
                const isPerm = Boolean(item.isPermuta);
                const isCanc = Boolean(item.isCancelado);
                const isItemPago = item.status === 'PAGO' || saldo <= 0.01;
                const isVenc = !isCanc && !isItemPago && Boolean(item.isVencido);

                mTotEmitido += parcela;
                mTotPago += pago;
                if (isPerm || permutado > 0) {
                    mTotPermuta += permutado;
                    mQtdPerm += 1;
                }

                if (!isCanc && !isItemPago && saldo > 0.01) {
                    mTotAPagar += saldo;
                    if (isVenc) {
                        mTotVencido += saldo;
                        mQtdVenc += 1;
                    } else {
                        mTotAVencer += saldo;
                        mQtdAVenc += 1;
                    }
                }

                const fKey = String(item.filial || 1);
                if (!mFiliaisMap[fKey]) {
                    mFiliaisMap[fKey] = {
                        filial: Number(item.filial || 1),
                        nomeFilial: String(item.nomeFilial || `Filial ${item.filial}`).trim(),
                        qtdTitulos: 0,
                        qtdVencidos: 0,
                        qtdAVencer: 0,
                        totalAPagar: 0,
                        totalVencido: 0,
                        totalAVencer: 0,
                        totalPermuta: 0,
                        qtdPermuta: 0,
                        totalEmitido: 0,
                        totalPago: 0
                    };
                }
                mFiliaisMap[fKey].qtdTitulos += 1;
                mFiliaisMap[fKey].totalEmitido += parcela;
                mFiliaisMap[fKey].totalPago += pago;
                if (isPerm || permutado > 0) {
                    mFiliaisMap[fKey].totalPermuta += permutado;
                    mFiliaisMap[fKey].qtdPermuta += 1;
                }
                if (!isCanc && !isItemPago && saldo > 0.01) {
                    mFiliaisMap[fKey].totalAPagar += saldo;
                    if (isVenc) {
                        mFiliaisMap[fKey].totalVencido += saldo;
                        mFiliaisMap[fKey].qtdVencidos += 1;
                    } else {
                        mFiliaisMap[fKey].totalAVencer += saldo;
                        mFiliaisMap[fKey].qtdAVencer += 1;
                    }
                }

                const fForn = String(item.cdPessoaComercial || item.fornecedor || 'Fornecedor');
                if (!mFornecedoresMap[fForn]) {
                    mFornecedoresMap[fForn] = {
                        cdPessoaComercial: String(item.cdPessoaComercial || ''),
                        fornecedor: String(item.fornecedor || 'Fornecedor').trim(),
                        qtdTitulos: 0,
                        totalEmitido: 0,
                        totalPago: 0,
                        totalAPagar: 0,
                        percentual: 0
                    };
                }
                mFornecedoresMap[fForn].qtdTitulos += 1;
                mFornecedoresMap[fForn].totalEmitido += parcela;
                mFornecedoresMap[fForn].totalPago += pago;
                if (!isCanc && !isItemPago && saldo > 0.01) {
                    mFornecedoresMap[fForn].totalAPagar += saldo;
                }
            });

            const mQtdTit = (mQtdVenc + mQtdAVenc > 0) ? (mQtdVenc + mQtdAVenc) : cpLancamentos.length;
            contasPagar.summary = {
                totalAPagar: mTotAPagar,
                totalPagar: mTotAPagar,
                totalEmitido: mTotEmitido,
                totalPago: mTotPago,
                totalVencido: mTotVencido,
                totalAVencer: mTotAVencer,
                totalPermuta: mTotPermuta,
                qtdPermuta: mQtdPerm,
                qtdTitulos: mQtdTit,
                qtdVencidos: mQtdVenc,
                qtdAVencer: mQtdAVenc,
                qtdFornecedores: Object.keys(mFornecedoresMap).length,
                ticketMedio: mQtdTit > 0 ? mTotAPagar / mQtdTit : 0
            };
            contasPagar.byFilial = Object.values(mFiliaisMap).map((f: any) => ({
                ...f,
                qtdTitulos: (Number(f.qtdVencidos || 0) + Number(f.qtdAVencer || 0) > 0) ? (Number(f.qtdVencidos || 0) + Number(f.qtdAVencer || 0)) : Number(f.qtdTitulos || 0)
            })).sort((a: any, b: any) => b.totalAPagar - a.totalAPagar);
            const mTopForn = Object.values(mFornecedoresMap).sort((a: any, b: any) => b.totalAPagar - a.totalAPagar).slice(0, 10);
            mTopForn.forEach((t: any) => {
                t.percentual = mTotAPagar > 0 ? Number(((t.totalAPagar / mTotAPagar) * 100).toFixed(1)) : 0;
            });
            contasPagar.topFornecedores = mTopForn;
        }

        return {
            params,
            summary,
            salesSummary,
            salesByModality,
            annualSalesByModality,
            convenioData,
            crediarioReceber,
            cartoesNaoBaixados,
            contasPagar,
            monthlyComparison,
            annualByCategory,
            dailyEvolution,
            byBank,
            byCategory,
            topReceitas,
            topDespesas,
            transactions,
            filiais
        };
    }

    /**
     * Consulta os dados da view RDUPHOLD_CONTAS_A_PAGAR_BI no banco Solidcon (SQL Server)
     */
    static async getContasGeralSolidconBIData(
        config: {
            host?: string | null;
            database?: string | null;
            user?: string | null;
            password?: string | null;
        },
        params: {
            dtInicio?: string | null;
            dtFim?: string | null;
            tipoData?: 'vencimento' | 'pagamento' | 'emissao' | 'competencia' | string | null;
            cdFilial?: string | null;
            status?: 'all' | 'com_pagto' | 'sem_pagto' | 'vencidos' | 'a_vencer' | 'permutas' | string | null;
        }
    ): Promise<any> {
        let server = (config.host || '').trim();
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

        if (!server) {
            throw new Error('Servidor Solidcon não informado.');
        }

        let database = (config.database || 'solidcon').trim();
        if (database.toLowerCase() === 'dorsal' || !database) {
            database = 'solidcon';
        }

        const sqlConfig: sql.config = {
            user: (config.user || 'aporttec').trim(),
            password: config.password || '',
            database: database,
            server: server,
            port: port,
            pool: {
                max: 5,
                min: 0,
                idleTimeoutMillis: 30000
            },
            options: {
                encrypt: false,
                trustServerCertificate: true,
                connectTimeout: 30000,
                requestTimeout: 60000
            },
            connectionTimeout: 30000,
            requestTimeout: 60000
        };

        const poolMSSQL = new sql.ConnectionPool(sqlConfig);
        try {
            await poolMSSQL.connect();

            // 1. Verificar se a view existe
            const checkViewReq = poolMSSQL.request();
            const viewCheck = await checkViewReq.query(`
                SELECT 1 AS view_exists
                FROM INFORMATION_SCHEMA.VIEWS
                WHERE TABLE_NAME = 'RDUPHOLD_CONTAS_A_PAGAR_BI'
            `);

            if (!viewCheck.recordset || viewCheck.recordset.length === 0) {
                return {
                    isAvailable: false,
                    message: 'A view RDUPHOLD_CONTAS_A_PAGAR_BI não está disponível neste banco Solidcon.',
                    filtrosAplicados: params,
                    summary: {
                        totalEmitido: 0,
                        totalPago: 0,
                        totalAberto: 0,
                        totalVencido: 0,
                        totalAVencer: 0,
                        totalPermuta: 0,
                        totalDesconto: 0,
                        qtdTitulos: 0,
                        qtdPagos: 0,
                        qtdAberto: 0,
                        qtdVencidos: 0,
                        qtdAVencer: 0,
                        qtdPermuta: 0,
                        qtdFornecedores: 0,
                        qtdFiliais: 0
                    },
                    byFilial: [],
                    lancamentos: []
                };
            }

            // 2. Montar filtros
            const dtInicio = params.dtInicio ? String(params.dtInicio).trim() : null;
            const dtFim = params.dtFim ? String(params.dtFim).trim() : null;
            const tipoData = (params.tipoData || 'vencimento').toLowerCase();
            const cdFilial = params.cdFilial ? String(params.cdFilial).trim() : null;
            const status = (params.status || 'all').toLowerCase();

            let targetCol = 'dtParcela';
            if (tipoData === 'pagamento' || tipoData === 'pgto') {
                targetCol = 'Pagto';
            } else if (tipoData === 'emissao') {
                targetCol = 'dtEmissao';
            } else if (tipoData === 'competencia') {
                targetCol = 'dtCompetencia';
            }

            const whereClauses: string[] = ['1=1'];
            const reqSummary = poolMSSQL.request();
            const reqFilial = poolMSSQL.request();
            const reqList = poolMSSQL.request();

            if (dtInicio && dtFim) {
                whereClauses.push(`(${targetCol} >= @dtInicio AND ${targetCol} < DATEADD(day, 1, @dtFim))`);
                reqSummary.input('dtInicio', sql.VarChar(10), dtInicio);
                reqSummary.input('dtFim', sql.VarChar(10), dtFim);
                reqFilial.input('dtInicio', sql.VarChar(10), dtInicio);
                reqFilial.input('dtFim', sql.VarChar(10), dtFim);
                reqList.input('dtInicio', sql.VarChar(10), dtInicio);
                reqList.input('dtFim', sql.VarChar(10), dtFim);
            } else if (dtInicio) {
                whereClauses.push(`(${targetCol} >= @dtInicio)`);
                reqSummary.input('dtInicio', sql.VarChar(10), dtInicio);
                reqFilial.input('dtInicio', sql.VarChar(10), dtInicio);
                reqList.input('dtInicio', sql.VarChar(10), dtInicio);
            } else if (dtFim) {
                whereClauses.push(`(${targetCol} < DATEADD(day, 1, @dtFim))`);
                reqSummary.input('dtFim', sql.VarChar(10), dtFim);
                reqFilial.input('dtFim', sql.VarChar(10), dtFim);
                reqList.input('dtFim', sql.VarChar(10), dtFim);
            }

            if (cdFilial && cdFilial !== 'all' && cdFilial !== 'todas') {
                whereClauses.push(`(Filial = @cdFilial OR FilialDebito = @cdFilial)`);
                reqSummary.input('cdFilial', sql.VarChar(100), cdFilial);
                reqFilial.input('cdFilial', sql.VarChar(100), cdFilial);
                reqList.input('cdFilial', sql.VarChar(100), cdFilial);
            }

            if (status === 'com_pagto' || status === 'pagos') {
                whereClauses.push(`(Pagto IS NOT NULL)`);
            } else if (status === 'sem_pagto' || status === 'abertos') {
                whereClauses.push(`(Pagto IS NULL)`);
            } else if (status === 'vencidos') {
                whereClauses.push(`(Pagto IS NULL AND dtParcela < CAST(GETDATE() AS DATE))`);
            } else if (status === 'a_vencer') {
                whereClauses.push(`(Pagto IS NULL AND dtParcela >= CAST(GETDATE() AS DATE))`);
            } else if (status === 'permutas') {
                whereClauses.push(`(ISNULL(vlPermuta, 0) > 0)`);
            }

            const whereSql = whereClauses.join(' AND ');

            // 3. Query Resumo Agregado
            const querySummary = `
                SELECT 
                    COUNT(*) AS qtdTitulos,
                    ISNULL(SUM(CAST(vlParcela AS float)), 0) AS totalEmitido,
                    ISNULL(SUM(CASE WHEN Pagto IS NOT NULL THEN ISNULL(CAST(vlPago AS float), CAST(vlParcela AS float)) ELSE 0 END), 0) AS totalPago,
                    ISNULL(SUM(CASE WHEN Pagto IS NULL THEN (ISNULL(CAST(vlParcela AS float), 0) - ISNULL(CAST(vlPago AS float), 0) - ISNULL(CAST(vlDesconto AS float), 0)) ELSE 0 END), 0) AS totalAberto,
                    ISNULL(SUM(CASE WHEN Pagto IS NULL AND dtParcela < CAST(GETDATE() AS DATE) THEN (ISNULL(CAST(vlParcela AS float), 0) - ISNULL(CAST(vlPago AS float), 0) - ISNULL(CAST(vlDesconto AS float), 0)) ELSE 0 END), 0) AS totalVencido,
                    ISNULL(SUM(CASE WHEN Pagto IS NULL AND dtParcela >= CAST(GETDATE() AS DATE) THEN (ISNULL(CAST(vlParcela AS float), 0) - ISNULL(CAST(vlPago AS float), 0) - ISNULL(CAST(vlDesconto AS float), 0)) ELSE 0 END), 0) AS totalAVencer,
                    ISNULL(SUM(ISNULL(CAST(vlPermuta AS float), 0)), 0) AS totalPermuta,
                    ISNULL(SUM(ISNULL(CAST(vlDesconto AS float), 0)), 0) AS totalDesconto,
                    COUNT(CASE WHEN Pagto IS NOT NULL THEN 1 END) AS qtdPagos,
                    COUNT(CASE WHEN Pagto IS NULL THEN 1 END) AS qtdAberto,
                    COUNT(CASE WHEN Pagto IS NULL AND dtParcela < CAST(GETDATE() AS DATE) THEN 1 END) AS qtdVencidos,
                    COUNT(CASE WHEN Pagto IS NULL AND dtParcela >= CAST(GETDATE() AS DATE) THEN 1 END) AS qtdAVencer,
                    COUNT(CASE WHEN ISNULL(vlPermuta, 0) > 0 THEN 1 END) AS qtdPermuta,
                    COUNT(DISTINCT Fornecedor) AS qtdFornecedores,
                    COUNT(DISTINCT Filial) AS qtdFiliais
                FROM RDUPHOLD_CONTAS_A_PAGAR_BI WITH (NOLOCK)
                WHERE ${whereSql}
            `;

            // 4. Query Resumo por Filial
            const queryFilial = `
                SELECT 
                    ISNULL(Filial, 'Matriz / Geral') AS filial,
                    COUNT(*) AS qtdTitulos,
                    ISNULL(SUM(CAST(vlParcela AS float)), 0) AS totalEmitido,
                    ISNULL(SUM(CASE WHEN Pagto IS NOT NULL THEN ISNULL(CAST(vlPago AS float), CAST(vlParcela AS float)) ELSE 0 END), 0) AS totalPago,
                    ISNULL(SUM(CASE WHEN Pagto IS NULL THEN (ISNULL(CAST(vlParcela AS float), 0) - ISNULL(CAST(vlPago AS float), 0) - ISNULL(CAST(vlDesconto AS float), 0)) ELSE 0 END), 0) AS totalAberto,
                    ISNULL(SUM(CASE WHEN Pagto IS NULL AND dtParcela < CAST(GETDATE() AS DATE) THEN (ISNULL(CAST(vlParcela AS float), 0) - ISNULL(CAST(vlPago AS float), 0) - ISNULL(CAST(vlDesconto AS float), 0)) ELSE 0 END), 0) AS totalVencido,
                    ISNULL(SUM(CASE WHEN Pagto IS NULL AND dtParcela >= CAST(GETDATE() AS DATE) THEN (ISNULL(CAST(vlParcela AS float), 0) - ISNULL(CAST(vlPago AS float), 0) - ISNULL(CAST(vlDesconto AS float), 0)) ELSE 0 END), 0) AS totalAVencer,
                    ISNULL(SUM(ISNULL(CAST(vlPermuta AS float), 0)), 0) AS totalPermuta,
                    COUNT(CASE WHEN Pagto IS NOT NULL THEN 1 END) AS qtdPagos,
                    COUNT(CASE WHEN Pagto IS NULL THEN 1 END) AS qtdAberto,
                    COUNT(CASE WHEN Pagto IS NULL AND dtParcela < CAST(GETDATE() AS DATE) THEN 1 END) AS qtdVencidos,
                    COUNT(CASE WHEN Pagto IS NULL AND dtParcela >= CAST(GETDATE() AS DATE) THEN 1 END) AS qtdAVencer
                FROM RDUPHOLD_CONTAS_A_PAGAR_BI WITH (NOLOCK)
                WHERE ${whereSql}
                GROUP BY ISNULL(Filial, 'Matriz / Geral')
                ORDER BY totalAberto DESC, totalEmitido DESC
            `;

            // 5. Query Lançamentos Detalhados (TOP 10000)
            const queryList = `
                SELECT TOP 10000
                    Filial,
                    Fornecedor,
                    TipoFaturamento,
                    CNPJ_CPF,
                    cdConta,
                    dtParcela,
                    CAST(vlParcela AS float) AS vlParcela,
                    Historico,
                    Documento,
                    HistBaixa,
                    CAST(vlDesconto AS float) AS vlDesconto,
                    CAST(vlMulta AS float) AS vlMulta,
                    CAST(vlMora AS float) AS vlMora,
                    CAST(vlPermuta AS float) AS vlPermuta,
                    Comprador,
                    CAST(vlPago AS float) AS vlPago,
                    Pagto,
                    cdContaBaixa,
                    dtCompetencia,
                    dtEmissao,
                    dtMovimento,
                    ContaCorrente,
                    NumeroParcela,
                    FilialDebito,
                    SmartContabil,
                    OrigemModuloERP,
                    CentroCusto,
                    cdReceDesp,
                    cdReceDespTipo
                FROM RDUPHOLD_CONTAS_A_PAGAR_BI WITH (NOLOCK)
                WHERE ${whereSql}
                ORDER BY dtParcela ASC, dtEmissao ASC
            `;

            const [resSummary, resFilial, resList] = await Promise.all([
                reqSummary.query(querySummary),
                reqFilial.query(queryFilial),
                reqList.query(queryList)
            ]);

            const sumRow = resSummary.recordset?.[0] || {};
            const summary = {
                totalEmitido: Number(sumRow.totalEmitido || 0),
                totalPago: Number(sumRow.totalPago || 0),
                totalAberto: Number(sumRow.totalAberto || 0),
                totalVencido: Number(sumRow.totalVencido || 0),
                totalAVencer: Number(sumRow.totalAVencer || 0),
                totalPermuta: Number(sumRow.totalPermuta || 0),
                totalDesconto: Number(sumRow.totalDesconto || 0),
                qtdTitulos: Number(sumRow.qtdTitulos || 0),
                qtdPagos: Number(sumRow.qtdPagos || 0),
                qtdAberto: Number(sumRow.qtdAberto || 0),
                qtdVencidos: Number(sumRow.qtdVencidos || 0),
                qtdAVencer: Number(sumRow.qtdAVencer || 0),
                qtdPermuta: Number(sumRow.qtdPermuta || 0),
                qtdFornecedores: Number(sumRow.qtdFornecedores || 0),
                qtdFiliais: Number(sumRow.qtdFiliais || 0)
            };

            const byFilial = (resFilial.recordset || []).map((f: any) => ({
                filial: String(f.filial || 'Matriz / Geral'),
                totalEmitido: Number(f.totalEmitido || 0),
                totalPago: Number(f.totalPago || 0),
                totalAberto: Number(f.totalAberto || 0),
                totalVencido: Number(f.totalVencido || 0),
                totalAVencer: Number(f.totalAVencer || 0),
                totalPermuta: Number(f.totalPermuta || 0),
                qtdTitulos: Number(f.qtdTitulos || 0),
                qtdPagos: Number(f.qtdPagos || 0),
                qtdAberto: Number(f.qtdAberto || 0),
                qtdVencidos: Number(f.qtdVencidos || 0),
                qtdAVencer: Number(f.qtdAVencer || 0)
            }));

            const lancamentos = (resList.recordset || []).map((row: any) => {
                const vlParcela = Number(row.vlParcela || 0);
                const vlPago = Number(row.vlPago || 0);
                const vlDesconto = Number(row.vlDesconto || 0);
                const vlPermuta = Number(row.vlPermuta || 0);
                const vlMulta = Number(row.vlMulta || 0);
                const vlMora = Number(row.vlMora || 0);
                const hasPagto = row.Pagto !== null && row.Pagto !== undefined;
                const saldoAberto = hasPagto ? 0 : Math.max(0, vlParcela - vlPago - vlDesconto);

                let situacao = 'a_vencer';
                if (hasPagto) {
                    situacao = 'pago';
                } else if (row.dtParcela) {
                    const dtVenc = new Date(row.dtParcela);
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    if (dtVenc < hoje) {
                        situacao = 'vencido';
                    }
                }

                return {
                    ...row,
                    vlParcela,
                    vlPago,
                    vlDesconto,
                    vlPermuta,
                    vlMulta,
                    vlMora,
                    hasPagto,
                    saldoAberto,
                    situacao,
                    dtParcela: row.dtParcela ? new Date(row.dtParcela).toISOString().slice(0, 10) : null,
                    dtEmissao: row.dtEmissao ? new Date(row.dtEmissao).toISOString().slice(0, 10) : null,
                    dtCompetencia: row.dtCompetencia ? new Date(row.dtCompetencia).toISOString().slice(0, 10) : null,
                    dtMovimento: row.dtMovimento ? new Date(row.dtMovimento).toISOString().slice(0, 10) : null,
                    Pagto: row.Pagto ? new Date(row.Pagto).toISOString().slice(0, 10) : null
                };
            });

            return {
                isAvailable: true,
                filtrosAplicados: {
                    dtInicio,
                    dtFim,
                    tipoData,
                    cdFilial,
                    status
                },
                summary,
                byFilial,
                lancamentos
            };
        } finally {
            try {
                await poolMSSQL.close();
            } catch {}
        }
    }

    /**
     * Unifica os resultados de múltiplas conexões Solidcon para o relatório Contas Geral BI
     */
    static mergeContasGeralSolidconBIResults(results: any[]): any {
        if (!results || results.length === 0) {
            return {
                isAvailable: false,
                message: 'Nenhum dado retornado.',
                summary: {},
                byFilial: [],
                lancamentos: []
            };
        }

        const validResults = results.filter(r => r && r.isAvailable !== false);
        if (validResults.length === 0) {
            return results[0] || { isAvailable: false, message: 'Nenhum servidor com a view disponível.' };
        }

        const first = validResults[0];
        let totalEmitido = 0;
        let totalPago = 0;
        let totalAberto = 0;
        let totalVencido = 0;
        let totalAVencer = 0;
        let totalPermuta = 0;
        let totalDesconto = 0;
        let qtdTitulos = 0;
        let qtdPagos = 0;
        let qtdAberto = 0;
        let qtdVencidos = 0;
        let qtdAVencer = 0;
        let qtdPermuta = 0;

        const filiaisMap: Record<string, any> = {};
        const fornecedoresSet = new Set<string>();
        const allLancamentos: any[] = [];

        validResults.forEach(r => {
            const s = r.summary || {};
            totalEmitido += Number(s.totalEmitido || 0);
            totalPago += Number(s.totalPago || 0);
            totalAberto += Number(s.totalAberto || 0);
            totalVencido += Number(s.totalVencido || 0);
            totalAVencer += Number(s.totalAVencer || 0);
            totalPermuta += Number(s.totalPermuta || 0);
            totalDesconto += Number(s.totalDesconto || 0);
            qtdTitulos += Number(s.qtdTitulos || 0);
            qtdPagos += Number(s.qtdPagos || 0);
            qtdAberto += Number(s.qtdAberto || 0);
            qtdVencidos += Number(s.qtdVencidos || 0);
            qtdAVencer += Number(s.qtdAVencer || 0);
            qtdPermuta += Number(s.qtdPermuta || 0);

            (r.byFilial || []).forEach((f: any) => {
                const k = String(f.filial || 'Matriz / Geral').trim();
                if (!filiaisMap[k]) {
                    filiaisMap[k] = {
                        filial: k,
                        totalEmitido: 0,
                        totalPago: 0,
                        totalAberto: 0,
                        totalVencido: 0,
                        totalAVencer: 0,
                        totalPermuta: 0,
                        qtdTitulos: 0,
                        qtdPagos: 0,
                        qtdAberto: 0,
                        qtdVencidos: 0,
                        qtdAVencer: 0
                    };
                }
                filiaisMap[k].totalEmitido += Number(f.totalEmitido || 0);
                filiaisMap[k].totalPago += Number(f.totalPago || 0);
                filiaisMap[k].totalAberto += Number(f.totalAberto || 0);
                filiaisMap[k].totalVencido += Number(f.totalVencido || 0);
                filiaisMap[k].totalAVencer += Number(f.totalAVencer || 0);
                filiaisMap[k].totalPermuta += Number(f.totalPermuta || 0);
                filiaisMap[k].qtdTitulos += Number(f.qtdTitulos || 0);
                filiaisMap[k].qtdPagos += Number(f.qtdPagos || 0);
                filiaisMap[k].qtdAberto += Number(f.qtdAberto || 0);
                filiaisMap[k].qtdVencidos += Number(f.qtdVencidos || 0);
                filiaisMap[k].qtdAVencer += Number(f.qtdAVencer || 0);
            });

            (r.lancamentos || []).forEach((item: any) => {
                if (item.Fornecedor) {
                    fornecedoresSet.add(String(item.Fornecedor).trim());
                }
                allLancamentos.push(item);
            });
        });

        allLancamentos.sort((a, b) => {
            const dtA = a.dtParcela || a.dtEmissao || '';
            const dtB = b.dtParcela || b.dtEmissao || '';
            return dtA.localeCompare(dtB);
        });

        const byFilial = Object.values(filiaisMap).sort((a: any, b: any) => b.totalAberto - a.totalAberto);

        return {
            isAvailable: true,
            filtrosAplicados: first.filtrosAplicados || {},
            summary: {
                totalEmitido,
                totalPago,
                totalAberto,
                totalVencido,
                totalAVencer,
                totalPermuta,
                totalDesconto,
                qtdTitulos,
                qtdPagos,
                qtdAberto,
                qtdVencidos,
                qtdAVencer,
                qtdPermuta,
                qtdFornecedores: fornecedoresSet.size,
                qtdFiliais: Object.keys(filiaisMap).length
            },
            byFilial,
            lancamentos: allLancamentos.slice(0, 10000)
        };
    }
}

