import 'dotenv/config';
import mysql, { Connection, ConnectionOptions, RowDataPacket } from 'mysql2/promise';

const DB_NAME = process.env.DB_NAME || 'bessa_erp';
const SELLER_INDEX_NAME = 'idx_customers_seller_user_id';
const SELLER_FK_NAME = 'fk_customers_seller_user';

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

async function indexExists(connection: Connection, indexName: string): Promise<boolean> {
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT INDEX_NAME
         FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customers' AND INDEX_NAME = ?
         LIMIT 1`,
        [DB_NAME, indexName]
    );

    return rows.length > 0;
}

async function foreignKeyExists(connection: Connection, constraintName: string): Promise<boolean> {
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT CONSTRAINT_NAME
         FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customers' AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = ?
         LIMIT 1`,
        [DB_NAME, constraintName]
    );

    return rows.length > 0;
}

export async function runMigration26(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 26: customer seller assignment                   │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    const connection = await mysql.createConnection(makeConnectionConfig());

    try {
        if (!(await customerColumnExists(connection, 'seller_user_id'))) {
            await connection.query('ALTER TABLE customers ADD COLUMN seller_user_id INT DEFAULT NULL AFTER phone');
            console.log('[OK] customers.seller_user_id added');
        } else {
            console.log('[SKIP] customers.seller_user_id already exists');
        }

        if (!(await indexExists(connection, SELLER_INDEX_NAME))) {
            await connection.query(`ALTER TABLE customers ADD INDEX ${SELLER_INDEX_NAME} (seller_user_id)`);
            console.log(`[OK] customers.${SELLER_INDEX_NAME} added`);
        } else {
            console.log(`[SKIP] customers.${SELLER_INDEX_NAME} already exists`);
        }

        if (!(await foreignKeyExists(connection, SELLER_FK_NAME))) {
            await connection.query(
                `ALTER TABLE customers
                 ADD CONSTRAINT ${SELLER_FK_NAME}
                 FOREIGN KEY (seller_user_id) REFERENCES users(id) ON DELETE SET NULL`
            );
            console.log(`[OK] customers.${SELLER_FK_NAME} added`);
        } else {
            console.log(`[SKIP] customers.${SELLER_FK_NAME} already exists`);
        }

        console.log('[OK] Migration 26 completed successfully.');
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    runMigration26()
        .catch((error) => {
            console.error('[FAIL] Migration 26 failed:', error);
            process.exitCode = 1;
        });
}
