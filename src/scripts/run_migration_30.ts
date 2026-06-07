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

export async function runMigration30(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 30: WhatsApp Business message storage            │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    const connection = await mysql.createConnection(makeConnectionConfig());

    try {
        await connection.query(
            `CREATE TABLE IF NOT EXISTS whatsapp_business_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                public_id CHAR(36) NOT NULL UNIQUE,
                company_id INT NOT NULL,
                direction ENUM('inbound', 'outbound') NOT NULL,
                contact_phone VARCHAR(40) NOT NULL,
                contact_name VARCHAR(150) DEFAULT NULL,
                chat_id VARCHAR(120) DEFAULT NULL,
                message_id VARCHAR(255) DEFAULT NULL,
                message_type VARCHAR(50) DEFAULT NULL,
                message_text TEXT NOT NULL,
                status VARCHAR(50) DEFAULT NULL,
                message_timestamp BIGINT DEFAULT NULL,
                raw_payload LONGTEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                UNIQUE KEY uk_whatsapp_business_message (company_id, message_id),
                INDEX idx_wb_messages_company_contact (company_id, contact_phone),
                INDEX idx_wb_messages_company_created (company_id, created_at),
                INDEX idx_wb_messages_company_timestamp (company_id, message_timestamp)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        );

        console.log('[OK] whatsapp_business_messages table is ready');
        console.log('[OK] Migration 30 completed successfully.');
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    runMigration30()
        .catch((error) => {
            console.error('[FAIL] Migration 30 failed:', error);
            process.exitCode = 1;
        });
}
