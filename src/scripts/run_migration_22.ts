import 'dotenv/config';
import { readFile } from 'fs/promises';
import path from 'path';
import mysql, { ConnectionOptions } from 'mysql2/promise';

const DB_NAME = process.env.DB_NAME || 'bessa_erp';

function makeConnectionConfig(): ConnectionOptions {
    const config: ConnectionOptions = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: DB_NAME,
        port: parseInt(process.env.DB_PORT || '3306', 10),
        multipleStatements: true,
    };

    if (process.env.MYSQL_UNIX_PORT) {
        config.socketPath = process.env.MYSQL_UNIX_PORT;
    }

    return config;
}

export async function runMigration22(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 22: IBGE states and cities base tables           │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    const sqlPath = path.resolve(__dirname, '../../database/17_ibge_tables.sql');
    const sql = await readFile(sqlPath, 'utf8');
    const connection = await mysql.createConnection(makeConnectionConfig());

    try {
        await connection.query(sql);
        console.log('[OK] Migration 22 completed successfully.');
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    runMigration22()
        .catch((error) => {
            console.error('[FAIL] Migration 22 failed:', error);
            process.exitCode = 1;
        });
}
