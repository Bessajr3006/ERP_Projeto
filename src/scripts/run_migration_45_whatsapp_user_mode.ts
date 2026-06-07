import 'dotenv/config';
import mysql, { Connection, ConnectionOptions, RowDataPacket } from 'mysql2/promise';

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

async function columnExists(connection: Connection, column: string): Promise<boolean> {
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = ?
         LIMIT 1`,
        [DB_NAME, column]
    );

    return rows.length > 0;
}

export async function runMigration45(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 45: WhatsApp user auto/manual mode               │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    const connection = await mysql.createConnection(makeConnectionConfig());

    try {
        if (await columnExists(connection, 'whatsapp_auto_reply_mode')) {
            console.log('[SKIP] users.whatsapp_auto_reply_mode already exists');
        } else {
            await connection.query(
                `ALTER TABLE users
                 ADD COLUMN whatsapp_auto_reply_mode ENUM('automatic', 'manual') NOT NULL DEFAULT 'automatic'
                 AFTER default_page`
            );
            console.log('[OK] users.whatsapp_auto_reply_mode added');
        }

        console.log('[OK] Migration 45 completed successfully.');
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    runMigration45()
        .catch((error) => {
            console.error('[FAIL] Migration 45 failed:', error);
            process.exitCode = 1;
        });
}