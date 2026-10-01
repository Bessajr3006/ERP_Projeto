import 'dotenv/config';
import pool from '../src/config/db';
import sql from 'mssql';

async function main() {
    console.log('=== 1. VERIFICANDO TRANSAÇÕES SEM PDV NO MYSQL LOCAL ===');
    const [rows]: any = await pool.query(`
        SELECT t.id, t.description, t.amount, t.date, t.status, t.pdv, t.cdfilial, t.solidcon_key, c.name as customer_name
        FROM transactions t
        LEFT JOIN customers c ON c.id = t.customer_id
        WHERE (t.type = 'income' OR t.type = 'revenue')
          AND (t.pdv IS NULL OR t.pdv = '' OR t.cdfilial IS NULL OR t.cdfilial = '')
          AND (t.description LIKE '%Cupom%' OR t.solidcon_key IS NOT NULL OR t.description LIKE '%Doc.%')
        ORDER BY t.id DESC
    `);
    console.log(`Encontrados ${rows.length} lançamentos sem PDV/Filial no MySQL local.`);

    const config: sql.config = {
        user: 'aporttec',
        password: '30mariafn@',
        server: 'n13884.ddns.net',
        database: 'solidcon',
        port: 1433,
        options: { encrypt: false, trustServerCertificate: true },
        connectionTimeout: 10000,
        requestTimeout: 15000
    };
    const poolMs = new sql.ConnectionPool(config);
    await poolMs.connect();
    console.log('Conectado ao Solidcon com sucesso!');

    let fixedCount = 0;
    for (const r of rows) {
        let cupomNum: string | null = null;
        const match = r.description.match(/Cupom\s*#?\s*(\d+)/i) || r.description.match(/Doc\.\s*#?\s*(\d+)/i);
        if (match) {
            cupomNum = match[1];
        } else if (r.solidcon_key && /^\d+$/.test(r.solidcon_key)) {
            cupomNum = r.solidcon_key;
        }

        if (cupomNum) {
            const resSolidcon = await poolMs.request()
                .input('cupomNum', sql.Int, parseInt(cupomNum, 10))
                .query(`
                    SELECT TOP 1 cdCrediarioCupom, cdFilial, cdPDV, nrCupom, vlCrediario, dtCrediario
                    FROM tbCrediarioCupom 
                    WHERE nrCupom = @cupomNum OR cdCrediarioCupom = @cupomNum
                    ORDER BY cdCrediarioCupom DESC
                `);

            const cupomSolidcon = resSolidcon.recordset?.[0];
            if (cupomSolidcon) {
                console.log(`-> ID ${r.id} (${r.description}): Encontrado no Solidcon -> Filial: ${cupomSolidcon.cdFilial}, PDV: ${cupomSolidcon.cdPDV}, ID Solidcon: #${cupomSolidcon.cdCrediarioCupom}`);
                await pool.query(`
                    UPDATE transactions 
                    SET pdv = ?, cdfilial = ?, solidcon_key = COALESCE(solidcon_key, ?), updated_at = NOW()
                    WHERE id = ?
                `, [
                    String(cupomSolidcon.cdPDV),
                    String(cupomSolidcon.cdFilial),
                    String(cupomSolidcon.cdCrediarioCupom),
                    r.id
                ]);
                fixedCount++;
            } else {
                console.log(`-> ID ${r.id} (${r.description}): Não encontrado em tbCrediarioCupom para Cupom #${cupomNum}`);
            }
        }
    }

    console.log(`\nAtualizados ${fixedCount} lançamentos no MySQL local.`);
    await poolMs.close();
    await pool.end();
}

main().catch(console.error);
