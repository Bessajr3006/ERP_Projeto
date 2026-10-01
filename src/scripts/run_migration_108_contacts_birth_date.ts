import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';

export async function runMigration108(): Promise<void> {
    console.log('│  Migration 108: Add birth_date to contacts if not exists    │');

    try {
        const [columns] = await pool.query<RowDataPacket[]>(
            `SHOW COLUMNS FROM contacts LIKE 'birth_date'`
        );
        
        if (columns.length > 0) {
            console.log('[SKIP] contacts.birth_date already exists');
            return;
        }

        await pool.query(
            `ALTER TABLE contacts ADD COLUMN birth_date DATE DEFAULT NULL AFTER email`
        );
        console.log('[OK] contacts.birth_date added');
    } catch (e: any) {
        console.error(`[ERROR] Migration 108 failed: ${e.message}`);
    }
}
