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

async function columnExists(column: string): Promise<boolean> {
    const connection = await mysql.createConnection(makeConnectionConfig());

    try {
        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT COLUMN_NAME
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'companies' AND COLUMN_NAME = ?
             LIMIT 1`,
            [DB_NAME, column]
        );

        return rows.length > 0;
    } finally {
        await connection.end();
    }
}

export async function runMigration31(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 31: company WhatsApp QR provider                 │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    if (await columnExists('whatsapp_chat_provider')) {
        console.log('[SKIP] companies.whatsapp_chat_provider already exists');
        console.log('[OK] Migration 31 completed successfully.');
        return;
    }

    const connection = await mysql.createConnection(makeConnectionConfig());

    try {
        await connection.query(
            `ALTER TABLE companies
             ADD COLUMN whatsapp_chat_provider ENUM('business_qr') NOT NULL DEFAULT 'business_qr'
             AFTER allow_print_without_confirmation`
        );

        console.log('[OK] companies.whatsapp_chat_provider added');
        console.log('[OK] Migration 31 completed successfully.');
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    runMigration31()
        .catch((error) => {
            console.error('[FAIL] Migration 31 failed:', error);
            process.exitCode = 1;
        });
}
