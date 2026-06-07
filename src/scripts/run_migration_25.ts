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

async function customerColumnExists(connection: Connection, column: string): Promise<boolean> {
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customers' AND COLUMN_NAME = ?
         LIMIT 1`,
        [DB_NAME, column]
    );

    return rows.length > 0;
}

export async function runMigration25(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 25: customer profile and address fields          │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    const customerColumns: Array<{ column: string; definition: string }> = [
        { column: 'zipcode', definition: 'VARCHAR(15) DEFAULT NULL' },
        { column: 'street', definition: 'VARCHAR(255) DEFAULT NULL' },
        { column: 'number', definition: 'VARCHAR(20) DEFAULT NULL' },
        { column: 'complement', definition: 'VARCHAR(100) DEFAULT NULL' },
        { column: 'neighborhood', definition: 'VARCHAR(100) DEFAULT NULL' },
        { column: 'city', definition: 'VARCHAR(100) DEFAULT NULL' },
        { column: 'state', definition: 'VARCHAR(50) DEFAULT NULL' },
        { column: 'certificate_base64', definition: 'LONGTEXT DEFAULT NULL' },
        { column: 'certificate_password', definition: 'VARCHAR(255) DEFAULT NULL' },
        { column: 'certificate_expiration', definition: 'DATE DEFAULT NULL' },
        { column: 'social_contract_base64', definition: 'LONGTEXT DEFAULT NULL' },
        { column: 'cnpj_document_base64', definition: 'LONGTEXT DEFAULT NULL' },
    ];

    const connection = await mysql.createConnection(makeConnectionConfig());

    try {
        for (const { column, definition } of customerColumns) {
            if (await customerColumnExists(connection, column)) {
                console.log(`[SKIP] customers.${column} already exists`);
                continue;
            }

            await connection.query(`ALTER TABLE customers ADD COLUMN ${column} ${definition}`);
            console.log(`[OK] customers.${column} added`);
        }

        console.log('[OK] Migration 25 completed successfully.');
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    runMigration25()
        .catch((error) => {
            console.error('[FAIL] Migration 25 failed:', error);
            process.exitCode = 1;
        });
}
