import 'dotenv/config';
import sql from 'mssql';
import { execSync } from 'child_process';

async function main() {
    console.log('=== BUSCANDO TRANSAÇÕES SEM PDV NA VPS ===');
    const rawOut = execSync(`ssh -o StrictHostKeyChecking=no root@187.77.24.126 'docker exec -i erp-bessa-db-1 mariadb -u root -p"30mariafn@" bessa_erp -e "SELECT id, description, amount, date, status, pdv, cdfilial, solidcon_key FROM transactions WHERE (type = \\"income\\" OR type = \\"revenue\\") AND (pdv IS NULL OR pdv = \\"\\" OR cdfilial IS NULL OR cdfilial = \\"\\") AND (description LIKE \\"%Cupom%\\" OR solidcon_key IS NOT NULL OR description LIKE \\"%Doc.%\\");"'`, { encoding: 'utf-8' });

    const lines = rawOut.trim().split('\n');
    if (lines.length <= 1) {
        console.log('Nenhuma transação sem PDV encontrada na VPS!');
        return;
    }

    const header = lines[0].split('\t');
    const rows = lines.slice(1).map(line => {
        const parts = line.split('\t');
        const obj: any = {};
        header.forEach((h, i) => {
            obj[h.trim()] = parts[i]?.trim();
        });
        return obj;
    });

    console.log(`Encontradas ${rows.length} transações sem PDV na VPS:`);

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
    console.log('Conectado ao Solidcon!');

    const updates: string[] = [];
    const foundReport: any[] = [];
    const notFoundReport: any[] = [];

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
                foundReport.push({
                    id: r.id,
                    description: r.description,
                    filial: cupomSolidcon.cdFilial,
                    pdv: cupomSolidcon.cdPDV,
                    cdCrediarioCupom: cupomSolidcon.cdCrediarioCupom
                });
                updates.push(`UPDATE transactions SET pdv = '${cupomSolidcon.cdPDV}', cdfilial = '${cupomSolidcon.cdFilial}', solidcon_key = COALESCE(NULLIF(solidcon_key, '${cupomNum}'), '${cupomSolidcon.cdCrediarioCupom}'), updated_at = NOW() WHERE id = ${r.id};`);
            } else {
                notFoundReport.push({
                    id: r.id,
                    description: r.description,
                    cupomNum
                });
            }
        }
    }

    console.log('\n--- RELATÓRIO DE ENCONTRADOS NO SOLIDCON ---');
    console.table(foundReport);

    if (notFoundReport.length > 0) {
        console.log('\n--- NÃO ENCONTRADOS EM tbCrediarioCupom ---');
        console.table(notFoundReport);
    }

    if (updates.length > 0) {
        console.log(`\nAplicando ${updates.length} atualizações no banco da VPS...`);
        const sqlCmd = updates.join(' ');
        execSync(`ssh -o StrictHostKeyChecking=no root@187.77.24.126 'docker exec -i erp-bessa-db-1 mariadb -u root -p"30mariafn@" bessa_erp -e "${sqlCmd}"'`);
        console.log('Todas as transações na VPS foram atualizadas com sucesso com seus respectivos PDV e Filial!');
    }

    await poolMs.close();
}

main().catch(console.error);
