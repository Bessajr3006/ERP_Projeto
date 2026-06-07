import 'dotenv/config';
import mysql, { ConnectionOptions, RowDataPacket } from 'mysql2/promise';

const DB_NAME = process.env.DB_NAME || 'bessa_erp';

function makeConnectionConfig(): ConnectionOptions {
    const config: ConnectionOptions = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: DB_NAME,
        port: parseInt(process.env.DB_PORT || '3306', 10),
    };

    if (process.env.MYSQL_UNIX_PORT) {
        config.socketPath = process.env.MYSQL_UNIX_PORT;
    }

    return config;
}

async function columnExists(connection: mysql.Connection, tableName: string, columnName: string): Promise<boolean> {
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
         LIMIT 1`,
        [DB_NAME, tableName, columnName]
    );

    return rows.length > 0;
}

async function dropColumnIfExists(connection: mysql.Connection, columnName: string): Promise<void> {
    if (!(await columnExists(connection, 'companies', columnName))) {
        console.log(`[SKIP] companies.${columnName} not present`);
        return;
    }

    await connection.query(`ALTER TABLE companies DROP COLUMN ${columnName}`);
    console.log(`[OK] companies.${columnName} dropped`);
}

export async function runMigration44(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 44: drop company WhatsApp official columns       │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    const connection = await mysql.createConnection(makeConnectionConfig());

    try {
        const columnsToDrop = [
            'whatsapp_official_enabled',
            'whatsapp_official_access_token',
            'whatsapp_official_phone_number_id',
            'whatsapp_official_business_account_id',
            'whatsapp_official_verify_token',
            'whatsapp_official_webhook_url',
        ] as const;

        for (const columnName of columnsToDrop) {
            await dropColumnIfExists(connection, columnName);
        }

        if (await columnExists(connection, 'companies', 'whatsapp_chat_provider')) {
            await connection.query(
                `UPDATE companies
                 SET whatsapp_chat_provider = 'business_qr'
                 WHERE whatsapp_chat_provider IS NULL OR whatsapp_chat_provider = 'official'`
            );
            await connection.query(
                `ALTER TABLE companies
                 MODIFY COLUMN whatsapp_chat_provider ENUM('business_qr') NOT NULL DEFAULT 'business_qr'`
            );
            console.log('[OK] companies.whatsapp_chat_provider normalized to business_qr');
        } else {
            console.log('[SKIP] companies.whatsapp_chat_provider not present');
        }

        console.log('[OK] Migration 44 completed successfully.');
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    runMigration44()
        .catch((error) => {
            console.error('[FAIL] Migration 44 failed:', error);
            process.exitCode = 1;
        });
}