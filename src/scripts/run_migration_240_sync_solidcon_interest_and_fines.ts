import pool from '../config/db';
import logger from '../config/logger';
import sql from 'mssql';

export async function runMigration240SyncSolidconInterestAndFines() {
    try {
        logger.info('Starting migration: 240 - Sync Solidcon interest keys, tbConta and fines into Keystone transactions');

        // 1. Atualizações diretas prioritárias para cupons conhecidos com juros no Solidcon
        await pool.query(`
            UPDATE transactions 
            SET fine = 638.89, solidcon_interest_key = '120431', updated_at = NOW()
            WHERE (id = 1742 OR description LIKE '%21905%') AND (company_id = 12 OR company_id IS NULL)
        `);

        await pool.query(`
            UPDATE transactions 
            SET fine = 265.83, solidcon_interest_key = '120329', updated_at = NOW()
            WHERE (id = 1749 OR description LIKE '%21918%') AND (company_id = 12 OR company_id IS NULL)
        `);

        await pool.query(`
            UPDATE transactions 
            SET fine = 66.65, solidcon_interest_key = '120429', updated_at = NOW()
            WHERE (id = 1753 OR description LIKE '%21928%') AND (company_id = 12 OR company_id IS NULL)
        `);

        // 2. Varrer todas as empresas com Solidcon configurado para sincronizar automaticamente quaisquer outras contas de juros
        const [companies]: any = await pool.query(`
            SELECT id, serv_solidcon, bd_solidcon, login_solidcon, senha_solidcon 
            FROM companies 
            WHERE serv_solidcon IS NOT NULL AND bd_solidcon IS NOT NULL
        `);

        for (const company of companies || []) {
            try {
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

                const mssqlPool = new sql.ConnectionPool({
                    user: company.login_solidcon,
                    password: company.senha_solidcon,
                    database: company.bd_solidcon,
                    server: server,
                    port: port,
                    options: { encrypt: false, trustServerCertificate: true },
                    connectionTimeout: 10000,
                    requestTimeout: 15000
                });

                await mssqlPool.connect();

                try {
                    const resJuros = await mssqlPool.request().query(`
                        SELECT c.cdConta, c.Documento, cp.vlParcela, cp.Historico
                        FROM tbConta c
                        JOIN tbContaParcela cp ON cp.cdConta = c.cdConta
                        WHERE cp.Historico LIKE '%Juros%' OR cp.Historico LIKE '%Mora%'
                    `);

                    for (const row of resJuros.recordset || []) {
                        const hist = String(row.Historico || '');
                        const cupomMatch = hist.match(/Cupom\s*#?\s*(\d+)/i) || hist.match(/Ref:\s*(\d+)/i);
                        const cupomNum = cupomMatch ? cupomMatch[1] : (row.Documento ? String(row.Documento).trim() : null);
                        const valorJuros = Number(row.vlParcela || 0);

                        if (cupomNum && valorJuros > 0 && row.cdConta) {
                            await pool.query(`
                                UPDATE transactions 
                                SET solidcon_interest_key = ?, fine = ?, updated_at = NOW()
                                WHERE company_id = ? 
                                  AND (description LIKE ? OR description LIKE ? OR solidcon_key = ?)
                                  AND (fine = 0 OR solidcon_interest_key IS NULL OR solidcon_interest_key = '')
                            `, [
                                String(row.cdConta),
                                valorJuros,
                                company.id,
                                `%Cupom #${cupomNum}%`,
                                `%Doc. #${cupomNum}%`,
                                cupomNum
                            ]);
                        }
                    }
                } finally {
                    await mssqlPool.close();
                }
            } catch (compErr) {
                logger.warn({ compErr, companyId: company.id }, 'Warning scanning Solidcon interest in migration 240');
            }
        }

        logger.info('Migration 240: Completed sync of solidcon_interest_key, tbConta and fines into Keystone transactions.');
    } catch (err) {
        logger.error({ err }, 'Error running migration 240');
    }
}
