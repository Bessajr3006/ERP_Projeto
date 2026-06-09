import 'dotenv/config';
import pool from '../config/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

const REQUIRED_USER_ROLE_ENUM = "enum('admin','user','operator','financial','manager','seller','accountant','buyer','service_provider','super_admin')";

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1`,
        [tableName, columnName]
    );

    return rows.length > 0;
}

async function indexExists(tableName: string, indexName: string): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT INDEX_NAME
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND INDEX_NAME = ?
         LIMIT 1`,
        [tableName, indexName]
    );

    return rows.length > 0;
}

async function getColumnMeta(tableName: string, columnName: string): Promise<RowDataPacket | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT COLUMN_TYPE
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1`,
        [tableName, columnName]
    );

    return rows[0] || null;
}

async function runSql(label: string, sql: string): Promise<void> {
    console.log(`[RUN] ${label}`);
    await pool.query<ResultSetHeader>(sql);
}

async function addCompanyColumnIfMissing(columnName: string, columnDefinition: string): Promise<void> {
    if (await columnExists('companies', columnName)) {
        console.log(`[SKIP] companies.${columnName} already exists`);
        return;
    }

    const conn = await pool.getConnection();
    try {
        await conn.query('SET SESSION innodb_strict_mode = OFF');
        await conn.query(`ALTER TABLE companies ROW_FORMAT=DYNAMIC`);
        await conn.query(`ALTER TABLE companies ADD COLUMN ${columnName} ${columnDefinition}`);
        console.log(`[OK] add companies.${columnName}`);
    } catch (err: any) {
        console.error(`[ERROR] Falha ao adicionar companies.${columnName}:`, err.message);
        throw err;
    } finally {
        conn.release();
    }
}

async function ensureIsSystemIndex(): Promise<void> {
    if (await indexExists('companies', 'idx_is_system')) {
        console.log('[SKIP] idx_is_system already exists');
        return;
    }

    await runSql('add idx_is_system', 'ALTER TABLE companies ADD INDEX idx_is_system (is_system)');
}

async function ensureUsersRoleEnum(): Promise<void> {
    const roleMeta = await getColumnMeta('users', 'role');
    if (roleMeta && String(roleMeta.COLUMN_TYPE).toLowerCase() === REQUIRED_USER_ROLE_ENUM) {
        console.log('[SKIP] users.role enum already aligned');
        return;
    }

    try {
        await runSql(
            'sanitize users.role legacy values',
            `UPDATE users SET role = 'admin' WHERE role = 'administrador'`
        );
    } catch (e) {
        console.warn('Could not sanitize legacy role values:', e);
    }

    await runSql(
        'expand users.role enum',
        `ALTER TABLE users
         MODIFY COLUMN role ENUM('admin', 'user', 'operator', 'financial', 'manager', 'seller', 'accountant', 'buyer', 'service_provider', 'super_admin') NOT NULL DEFAULT 'user'`
    );
}

export async function runMigration21(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 21: initdb seed and super admin support          │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    const companyColumns: Array<{ column: string; definition: string }> = [
        { column: 'tax_regime', definition: 'VARCHAR(100) DEFAULT NULL' },
        { column: 'email', definition: 'VARCHAR(255) DEFAULT NULL' },
        { column: 'phone', definition: 'VARCHAR(20) DEFAULT NULL' },
        { column: 'zipcode', definition: 'VARCHAR(20) DEFAULT NULL' },
        { column: 'street', definition: 'VARCHAR(255) DEFAULT NULL' },
        { column: 'number', definition: 'VARCHAR(50) DEFAULT NULL' },
        { column: 'complement', definition: 'VARCHAR(150) DEFAULT NULL' },
        { column: 'neighborhood', definition: 'VARCHAR(100) DEFAULT NULL' },
        { column: 'city', definition: 'VARCHAR(100) DEFAULT NULL' },
        { column: 'state', definition: 'VARCHAR(50) DEFAULT NULL' },
        { column: 'certificate_base64', definition: 'LONGTEXT DEFAULT NULL' },
        { column: 'certificate_password', definition: 'VARCHAR(255) DEFAULT NULL' },
        { column: 'certificate_expiration', definition: 'DATE DEFAULT NULL' },
        { column: 'certificate_name', definition: 'VARCHAR(255) DEFAULT NULL' },
        { column: 'api_token', definition: 'TEXT DEFAULT NULL' },
        { column: 'solidcon_api_token', definition: 'TEXT DEFAULT NULL' },
        { column: 'solidcon_url_1', definition: 'VARCHAR(500) DEFAULT NULL' },
        { column: 'solidcon_url_2', definition: 'VARCHAR(500) DEFAULT NULL' },
        { column: 'solidcon_url_3', definition: 'VARCHAR(500) DEFAULT NULL' },
        { column: 'solidcon_url_4', definition: 'VARCHAR(500) DEFAULT NULL' },
        { column: 'solidcon_url_5', definition: 'VARCHAR(500) DEFAULT NULL' },
        { column: 'is_system', definition: 'BOOLEAN NOT NULL DEFAULT FALSE' },
    ];

    for (const { column, definition } of companyColumns) {
        await addCompanyColumnIfMissing(column, definition);
    }

    await ensureIsSystemIndex();
    await ensureUsersRoleEnum();

    console.log('[OK] Migration 21 completed successfully.');
}

if (require.main === module) {
    runMigration21()
        .catch((error) => {
            console.error('[FAIL] Migration 21 failed:', error);
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
