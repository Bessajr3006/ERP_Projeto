import 'dotenv/config';
import { RowDataPacket } from 'mysql2/promise';
import pool from '../config/db';

const REQUIRED_USER_ROLE_ENUM = "enum('admin','user','operator','financial','manager','seller','accountant','buyer','service_provider','super_admin')";

type ColumnMetaRow = RowDataPacket & {
    COLUMN_TYPE: string;
};

async function getUsersRoleMeta(): Promise<ColumnMetaRow | null> {
    const [rows] = await pool.query<ColumnMetaRow[]>(
        `SELECT COLUMN_TYPE
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'users'
           AND COLUMN_NAME = 'role'
         LIMIT 1`
    );

    return rows[0] || null;
}

export async function runMigration28(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 28: accountant user role support                 │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    const roleMeta = await getUsersRoleMeta();
    if (roleMeta && String(roleMeta.COLUMN_TYPE).toLowerCase() === REQUIRED_USER_ROLE_ENUM) {
        console.log('[SKIP] users.role enum already supports accountant');
        console.log('[OK] Migration 28 completed successfully.');
        return;
    }

    await pool.query(
        `ALTER TABLE users
         MODIFY COLUMN role ENUM('admin', 'user', 'operator', 'financial', 'manager', 'seller', 'accountant', 'buyer', 'service_provider', 'super_admin') NOT NULL DEFAULT 'user'`
    );

    console.log('[OK] users.role enum expanded with accountant');
    console.log('[OK] Migration 28 completed successfully.');
}

if (require.main === module) {
    runMigration28()
        .catch((error) => {
            console.error('[FAIL] Migration 28 failed:', error);
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
