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

async function indexExists(connection: mysql.Connection, tableName: string, indexName: string): Promise<boolean> {
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT INDEX_NAME
         FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?
         LIMIT 1`,
        [DB_NAME, tableName, indexName]
    );

    return rows.length > 0;
}

export async function runMigration32(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 32: WhatsApp QR scope by company and user        │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    const connection = await mysql.createConnection(makeConnectionConfig());

    try {
        if (!(await columnExists(connection, 'companies', 'whatsapp_business_scope'))) {
            await connection.query(
                `ALTER TABLE companies
                 ADD COLUMN whatsapp_business_scope ENUM('company', 'user') NOT NULL DEFAULT 'company'
                 AFTER whatsapp_chat_provider`
            );
            console.log('[OK] companies.whatsapp_business_scope added');
        } else {
            console.log('[SKIP] companies.whatsapp_business_scope already exists');
        }

        if (!(await columnExists(connection, 'whatsapp_business_messages', 'owner_type'))) {
            await connection.query(
                `ALTER TABLE whatsapp_business_messages
                 ADD COLUMN owner_type ENUM('company', 'user') NOT NULL DEFAULT 'company'
                 AFTER company_id`
            );
            console.log('[OK] whatsapp_business_messages.owner_type added');
        } else {
            console.log('[SKIP] whatsapp_business_messages.owner_type already exists');
        }

        if (!(await columnExists(connection, 'whatsapp_business_messages', 'owner_id'))) {
            await connection.query(
                `ALTER TABLE whatsapp_business_messages
                 ADD COLUMN owner_id INT NULL
                 AFTER owner_type`
            );
            console.log('[OK] whatsapp_business_messages.owner_id added');
        } else {
            console.log('[SKIP] whatsapp_business_messages.owner_id already exists');
        }

        if (!(await columnExists(connection, 'whatsapp_business_messages', 'user_id'))) {
            await connection.query(
                `ALTER TABLE whatsapp_business_messages
                 ADD COLUMN user_id INT NULL
                 AFTER owner_id`
            );
            console.log('[OK] whatsapp_business_messages.user_id added');
        } else {
            console.log('[SKIP] whatsapp_business_messages.user_id already exists');
        }

        await connection.query(
            `UPDATE whatsapp_business_messages
             SET owner_type = 'company'
             WHERE owner_type IS NULL OR owner_type NOT IN ('company', 'user')`
        );
        await connection.query(
            `UPDATE whatsapp_business_messages
             SET owner_id = company_id
             WHERE owner_id IS NULL OR owner_id = 0`
        );
        await connection.query(
            `ALTER TABLE whatsapp_business_messages
             MODIFY COLUMN owner_id INT NOT NULL`
        );
        console.log('[OK] whatsapp_business_messages owner scope backfilled');

        if (await indexExists(connection, 'whatsapp_business_messages', 'uk_whatsapp_business_message')) {
            await connection.query('ALTER TABLE whatsapp_business_messages DROP INDEX uk_whatsapp_business_message');
            console.log('[OK] legacy uk_whatsapp_business_message dropped');
        } else {
            console.log('[SKIP] legacy uk_whatsapp_business_message not present');
        }

        if (!(await indexExists(connection, 'whatsapp_business_messages', 'uk_whatsapp_business_message_scope'))) {
            await connection.query(
                `ALTER TABLE whatsapp_business_messages
                 ADD UNIQUE KEY uk_whatsapp_business_message_scope (owner_type, owner_id, message_id)`
            );
            console.log('[OK] uk_whatsapp_business_message_scope added');
        } else {
            console.log('[SKIP] uk_whatsapp_business_message_scope already exists');
        }

        if (!(await indexExists(connection, 'whatsapp_business_messages', 'idx_wb_messages_company_owner_contact'))) {
            await connection.query(
                `ALTER TABLE whatsapp_business_messages
                 ADD INDEX idx_wb_messages_company_owner_contact (company_id, owner_type, owner_id, contact_phone)`
            );
            console.log('[OK] idx_wb_messages_company_owner_contact added');
        } else {
            console.log('[SKIP] idx_wb_messages_company_owner_contact already exists');
        }

        if (!(await indexExists(connection, 'whatsapp_business_messages', 'idx_wb_messages_company_owner_created'))) {
            await connection.query(
                `ALTER TABLE whatsapp_business_messages
                 ADD INDEX idx_wb_messages_company_owner_created (company_id, owner_type, owner_id, created_at)`
            );
            console.log('[OK] idx_wb_messages_company_owner_created added');
        } else {
            console.log('[SKIP] idx_wb_messages_company_owner_created already exists');
        }

        if (!(await indexExists(connection, 'whatsapp_business_messages', 'idx_wb_messages_company_owner_timestamp'))) {
            await connection.query(
                `ALTER TABLE whatsapp_business_messages
                 ADD INDEX idx_wb_messages_company_owner_timestamp (company_id, owner_type, owner_id, message_timestamp)`
            );
            console.log('[OK] idx_wb_messages_company_owner_timestamp added');
        } else {
            console.log('[SKIP] idx_wb_messages_company_owner_timestamp already exists');
        }

        if (!(await indexExists(connection, 'whatsapp_business_messages', 'idx_wb_messages_user_id'))) {
            await connection.query(
                `ALTER TABLE whatsapp_business_messages
                 ADD INDEX idx_wb_messages_user_id (user_id)`
            );
            console.log('[OK] idx_wb_messages_user_id added');
        } else {
            console.log('[SKIP] idx_wb_messages_user_id already exists');
        }

        console.log('[OK] Migration 32 completed successfully.');
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    runMigration32()
        .catch((error) => {
            console.error('[FAIL] Migration 32 failed:', error);
            process.exitCode = 1;
        });
}
