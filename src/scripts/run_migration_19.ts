import 'dotenv/config';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

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

export async function runMigration19(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 19: company print preferences                    │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    if (await columnExists('companies', 'allow_print_without_confirmation')) {
        console.log('[SKIP] companies.allow_print_without_confirmation already exists');
        return;
    }

    await pool.query<ResultSetHeader>(
        `ALTER TABLE companies
         ADD COLUMN allow_print_without_confirmation BOOLEAN NOT NULL DEFAULT FALSE`
    );

    console.log('[OK] Migration 19 completed successfully.');
}

if (require.main === module) {
    runMigration19()
        .catch((error) => {
        console.error('[FAIL] Migration 19 failed:', error);
        process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
