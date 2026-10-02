import 'dotenv/config';
import pool from '../config/db';

export async function runMigration60(): Promise<void> {
    console.log('[SKIP] Migration 60: raw_password is deprecated and removed (Migration 254).');
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
