import 'dotenv/config';
import mysql, { ConnectionOptions } from 'mysql2/promise';

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

export async function runMigration33(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 33: WhatsApp Business image media storage        │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    const connection = await mysql.createConnection(makeConnectionConfig());

    try {
        await connection.query(
            `ALTER TABLE whatsapp_business_messages
                ADD COLUMN IF NOT EXISTS media_mime_type VARCHAR(255) DEFAULT NULL AFTER message_text,
                ADD COLUMN IF NOT EXISTS media_file_name VARCHAR(255) DEFAULT NULL AFTER media_mime_type,
                ADD COLUMN IF NOT EXISTS media_base64 LONGTEXT DEFAULT NULL AFTER media_file_name`
        );

        console.log('[OK] whatsapp_business_messages media columns are ready');
        console.log('[OK] Migration 33 completed successfully.');
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    runMigration33()
        .catch((error) => {
            console.error('[FAIL] Migration 33 failed:', error);
            process.exitCode = 1;
        });
}
