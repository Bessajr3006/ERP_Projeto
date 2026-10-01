import pool from '../config/db';
import sql from 'mssql';

export async function runMigration223PopulateSolidconKeyInTransactions() {
    console.log('│  Migration 223: Populate solidcon_key and solidcon_quitado in transactions │');
    
    const conn = await pool.getConnection();

    try {
        // Step 1: Quick regex extraction from description directly in MariaDB
        console.log('│  [1/3] Extracting cupom codes from transaction descriptions in MariaDB...');
        const [rows]: any = await conn.query(`
            SELECT id, description, solidcon_key, solidcon_quitado, company_id 
            FROM transactions 
            WHERE (solidcon_key IS NULL OR solidcon_key = '') 
              AND (description LIKE '%Cupom%' OR description LIKE '%cupom%')
        `);

        let updatedFromDesc = 0;
        for (const row of rows) {
            const desc = String(row.description || '');
            const match = desc.match(/Cupom\s*#?\s*(\d+)/i);
            if (match && match[1]) {
                const cupomNum = match[1].trim();
                await conn.query(
                    'UPDATE transactions SET solidcon_key = ? WHERE id = ?',
                    [cupomNum, row.id]
                );
                updatedFromDesc++;
            }
        }
        console.log(`│  Updated ${updatedFromDesc} transactions from description regex.`);

        // Step 2: Query Solidcon SQL Server for each company with Solidcon configured
        const [pendingTxs]: any = await conn.query(`
            SELECT COUNT(*) as cnt 
            FROM transactions 
            WHERE (solidcon_key IS NULL OR solidcon_key = '')
              AND (description LIKE '%Cupom%' OR description LIKE '%cupom%')
        `);
        if (pendingTxs?.[0]?.cnt === 0) {
            console.log('│  [2/3] All transactions already have solidcon_key populated. Skipping external DB sync.');
            return;
        }

        console.log('│  [2/3] Connecting to Solidcon database to resolve cupom and baixa codes...');
        const [companies]: any = await conn.query(`
            SELECT id, trade_name, serv_solidcon, bd_solidcon, login_solidcon, senha_solidcon, cdfilial, cdpdv 
            FROM companies 
            WHERE serv_solidcon IS NOT NULL 
              AND bd_solidcon IS NOT NULL 
              AND login_solidcon IS NOT NULL 
              AND senha_solidcon IS NOT NULL
        `);

        for (const company of companies) {
            let server = company.serv_solidcon;
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
                user: company.login_solidcon,
                password: company.senha_solidcon,
                database: company.bd_solidcon,
                server,
                port,
                options: {
                    encrypt: false,
                    trustServerCertificate: true
                },
                connectionTimeout: 2000,
                requestTimeout: 4000
            };

            let poolMsSql: sql.ConnectionPool | null = null;
            try {
                poolMsSql = new sql.ConnectionPool(sqlConfig);
                await poolMsSql.connect();

                const [txs]: any = await conn.query(`
                    SELECT id, description, solidcon_key, solidcon_quitado, amount, cdfilial, pdv, status 
                    FROM transactions 
                    WHERE company_id = ? 
                      AND (solidcon_key IS NOT NULL OR description LIKE '%Cupom%' OR description LIKE '%cupom%')
                `, [company.id]);

                let companySynced = 0;
                for (const tx of txs) {
                    let cdCrediarioCupom: number | null = null;
                    if (tx.solidcon_key) {
                        cdCrediarioCupom = parseInt(tx.solidcon_key, 10);
                        if (isNaN(cdCrediarioCupom)) cdCrediarioCupom = null;
                    }

                    const desc = String(tx.description || '');
                    const cupomMatch = desc.match(/Cupom\s*#?\s*(\d+)/i);
                    const nrCupom = cupomMatch?.[1];

                    let resolvedRow: any = null;

                    // 1. Try by cdCrediarioCupom
                    if (cdCrediarioCupom) {
                        const req = poolMsSql.request();
                        req.input('cdCrediarioCupom', sql.Int, cdCrediarioCupom);
                        const res = await req.query(`
                            SELECT TOP 1 cdCrediarioCupom, cdFilial, cdPDV, nrCupom, vlQuitado, nrPagamentos 
                            FROM tbCrediarioCupom 
                            WHERE cdCrediarioCupom = @cdCrediarioCupom
                        `);
                        resolvedRow = res.recordset?.[0];
                    }

                    // 2. Try by nrCupom
                    const searchCupomNum = nrCupom || (!resolvedRow && cdCrediarioCupom ? cdCrediarioCupom : null);
                    if (!resolvedRow && searchCupomNum) {
                        const nrCupomNum = Number(searchCupomNum);
                        const nrCupomStr = String(searchCupomNum).trim();
                        const nrCupomPadded6 = nrCupomStr.padStart(6, '0');
                        const nrCupomPadded8 = nrCupomStr.padStart(8, '0');
                        const nrCupomPadded10 = nrCupomStr.padStart(10, '0');

                        const reqFallback = poolMsSql.request();
                        reqFallback.input('nrCupomStr', sql.VarChar, nrCupomStr);
                        reqFallback.input('nrCupomPadded6', sql.VarChar, nrCupomPadded6);
                        reqFallback.input('nrCupomPadded8', sql.VarChar, nrCupomPadded8);
                        reqFallback.input('nrCupomPadded10', sql.VarChar, nrCupomPadded10);
                        reqFallback.input('nrCupomNum', sql.BigInt, nrCupomNum);

                        const resFallback = await reqFallback.query(`
                            SELECT TOP 1 cdCrediarioCupom, cdFilial, cdPDV, nrCupom, vlQuitado, nrPagamentos 
                            FROM tbCrediarioCupom 
                            WHERE (
                                nrCupom = @nrCupomStr 
                                OR nrCupom = @nrCupomPadded6 
                                OR nrCupom = @nrCupomPadded8 
                                OR nrCupom = @nrCupomPadded10
                                OR TRY_CAST(nrCupom AS BIGINT) = @nrCupomNum 
                                OR CAST(nrCupom AS VARCHAR) = @nrCupomStr
                                OR nrCupom LIKE '%' + @nrCupomStr
                            )
                            ORDER BY cdCrediarioCupom DESC
                        `);
                        resolvedRow = resFallback.recordset?.[0];
                    }

                    if (resolvedRow) {
                        const cupomKeyResolved = String(resolvedRow.cdCrediarioCupom);
                        const filialResolved = resolvedRow.cdFilial ? String(resolvedRow.cdFilial) : null;
                        const pdvResolved = resolvedRow.cdPDV ? String(resolvedRow.cdPDV) : null;

                        // Check if paid in tbCrediarioCupomPagamento or vlQuitado > 0
                        let isPaidInSolidcon = false;
                        if (Number(resolvedRow.vlQuitado || 0) > 0 || Number(resolvedRow.nrPagamentos || 0) > 0) {
                            isPaidInSolidcon = true;
                        } else {
                            const reqPag = poolMsSql.request();
                            reqPag.input('cdCrediarioCupom', sql.Int, resolvedRow.cdCrediarioCupom);
                            const resPag = await reqPag.query(`
                                SELECT TOP 1 cdCrediarioCupom FROM tbCrediarioCupomPagamento 
                                WHERE cdCrediarioCupom = @cdCrediarioCupom
                            `);
                            if (resPag.recordset?.[0]) {
                                isPaidInSolidcon = true;
                            }
                        }

                        await conn.query(`
                            UPDATE transactions 
                            SET solidcon_key = ?,
                                cdfilial = COALESCE(cdfilial, ?),
                                pdv = COALESCE(pdv, ?),
                                solidcon_quitado = CASE WHEN ? = 1 THEN 1 ELSE solidcon_quitado END
                            WHERE id = ?
                        `, [cupomKeyResolved, filialResolved, pdvResolved, isPaidInSolidcon ? 1 : 0, tx.id]);

                        companySynced++;
                    }
                }
                console.log(`│  Company ${company.trade_name} (ID: ${company.id}): Synced ${companySynced} transactions with Solidcon DB.`);
            } catch (err: any) {
                console.warn(`│  Could not connect to Solidcon DB for company ${company.trade_name}: ${err.message}`);
            } finally {
                if (poolMsSql) {
                    await poolMsSql.close();
                }
            }
        }

        console.log('│  Migration 223 OK                                            │');
    } catch (error) {
        console.error('│  Migration 223 FAILED                                        │', error);
        throw error;
    } finally {
        conn.release();
    }
}
