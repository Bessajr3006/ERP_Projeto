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

async function userColumnExists(connection: Connection, column: string): Promise<boolean> {
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = ?
         LIMIT 1`,
        [DB_NAME, column]
    );

    return rows.length > 0;
}

export async function runMigration23(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 23: user profile and address fields              │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    const userColumns: Array<{ column: string; definition: string }> = [
        { column: 'cpf_cnpj', definition: 'VARCHAR(18) DEFAULT NULL' },
        { column: 'phone', definition: 'VARCHAR(20) DEFAULT NULL' },
        { column: 'zipcode', definition: 'VARCHAR(20) DEFAULT NULL' },
        { column: 'street', definition: 'VARCHAR(255) DEFAULT NULL' },
        { column: 'number', definition: 'VARCHAR(50) DEFAULT NULL' },
        { column: 'complement', definition: 'VARCHAR(150) DEFAULT NULL' },
        { column: 'neighborhood', definition: 'VARCHAR(100) DEFAULT NULL' },
        { column: 'city', definition: 'VARCHAR(100) DEFAULT NULL' },
        { column: 'state', definition: 'VARCHAR(50) DEFAULT NULL' },
        { column: 'default_page', definition: 'VARCHAR(100) DEFAULT NULL' },
    ];

    const connection = await mysql.createConnection(makeConnectionConfig());

    try {
        for (const { column, definition } of userColumns) {
            if (await userColumnExists(connection, column)) {
                console.log(`[SKIP] users.${column} already exists`);
                continue;
            }

            await connection.query(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
            console.log(`[OK] users.${column} added`);
        }

        console.log('[OK] Migration 23 completed successfully.');
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    runMigration23()
        .catch((error) => {
            console.error('[FAIL] Migration 23 failed:', error);
            process.exitCode = 1;
        });
}
