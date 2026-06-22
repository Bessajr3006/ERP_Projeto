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
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'transactions' AND COLUMN_NAME = ?
         LIMIT 1`,
        [DB_NAME, column]
    );

    return rows.length > 0;
}

export async function runMigration60(): Promise<void> {
    console.log('Running Migration 60: Adding contact_id and related_user_id to transactions');
    const connection = await mysql.createConnection(makeConnectionConfig());

    try {
        if (await columnExists(connection, 'contact_id')) {
            console.log('[SKIP] transactions.contact_id already exists');
        } else {
            await connection.query(
                `ALTER TABLE transactions
                 ADD COLUMN contact_id INT NULL COMMENT 'Vinculo com contato (Pessoas)' AFTER supplier_id`
            );
            console.log('[OK] transactions.contact_id added');
            
            await connection.query(
                `ALTER TABLE transactions
                 ADD CONSTRAINT fk_transactions_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL`
            );
            console.log('[OK] foreign key fk_transactions_contact added');
        }

        if (await columnExists(connection, 'related_user_id')) {
            console.log('[SKIP] transactions.related_user_id already exists');
        } else {
            await connection.query(
                `ALTER TABLE transactions
                 ADD COLUMN related_user_id INT NULL COMMENT 'Vinculo com usuario (Vendedor/Comprador/Prestador/Contador)' AFTER contact_id`
            );
            console.log('[OK] transactions.related_user_id added');
            
            await connection.query(
                `ALTER TABLE transactions
                 ADD CONSTRAINT fk_transactions_related_user FOREIGN KEY (related_user_id) REFERENCES users(id) ON DELETE SET NULL`
            );
            console.log('[OK] foreign key fk_transactions_related_user added');
        }

        console.log('[OK] Migration 60 completed successfully.');
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    runMigration60()
        .catch((error) => {
            console.error('[FAIL] Migration 60 failed:', error);
            process.exitCode = 1;
        });
}
