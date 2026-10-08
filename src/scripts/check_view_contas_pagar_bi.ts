import sql from 'mssql';
import pool from '../config/db';
import { decrypt } from '../utils/crypto';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    try {
        const [configs]: any = await pool.query(`
            SELECT serv_solidcon, bd_solidcon, login_solidcon, senha_solidcon, cdfilial, name
            FROM company_solidcon_configs
            WHERE serv_solidcon IS NOT NULL AND bd_solidcon IS NOT NULL
            LIMIT 1
        `);

        if (!configs || configs.length === 0) {
            console.log('Nenhuma configuração Solidcon encontrada.');
            process.exit(0);
        }

        const cfg = configs[0];
        console.log(`Conectando em ${cfg.serv_solidcon} -> ${cfg.bd_solidcon}...`);

        let server = cfg.serv_solidcon;
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

        let pass = cfg.senha_solidcon;
        try {
            if (pass) pass = decrypt(pass);
        } catch {
            // raw password
        }

        const mssqlPool = await sql.connect({
            user: cfg.login_solidcon,
            password: pass,
            database: cfg.bd_solidcon,
            server: server,
            port: port,
            options: {
                encrypt: false,
                trustServerCertificate: true
            },
            connectionTimeout: 10000,
            requestTimeout: 20000
        });

        console.log('Conectado ao SQL Server!');

        // 1. Verificar colunas da view
        const resCols = await mssqlPool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'RDUPHOLD_CONTAS_A_PAGAR_BI'
            ORDER BY ORDINAL_POSITION
        `);
        console.log('Colunas de RDUPHOLD_CONTAS_A_PAGAR_BI:', resCols.recordset);

        // 2. Pegar uma amostra de 3 registros
        const resSample = await mssqlPool.request().query(`
            SELECT TOP 3 * FROM RDUPHOLD_CONTAS_A_PAGAR_BI
        `);
        console.log('Amostra de 3 registros:', resSample.recordset);

        await mssqlPool.close();
        await pool.end();
        process.exit(0);
    } catch (err: any) {
        console.error('Erro:', err.message || err);
        process.exit(1);
    }
}

main();
