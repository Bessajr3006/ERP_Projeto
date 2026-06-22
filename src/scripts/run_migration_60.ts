import 'dotenv/config';
import pool from '../config/db';

export async function runMigration60(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 60: Add raw_password to users table               │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    try {
        await pool.query(`
            ALTER TABLE users
            ADD COLUMN raw_password VARCHAR(255) NULL AFTER password_hash;
        `);
        console.log('[OK] Coluna raw_password adicionada com sucesso.');
    } catch (error: any) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('[SKIP] Coluna raw_password já existe.');
        } else {
            throw error;
        }
    }
}

if (require.main === module) {
    runMigration60()
        .catch((error) => {
            console.error('[FAIL] Migration 60 failed:', error);
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
