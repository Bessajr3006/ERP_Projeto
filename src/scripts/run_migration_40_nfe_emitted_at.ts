import 'dotenv/config';
import pool from '../config/db';

export async function runMigration40(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 40: Add nfe_emitted_at to sales_orders            │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    try {
        await pool.query(
            `ALTER TABLE sales_orders ADD COLUMN nfe_emitted_at DATETIME DEFAULT NULL AFTER date`
        );
        console.log('[OK] Column nfe_emitted_at added successfully.');
    } catch (error: any) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('[SKIP] Column nfe_emitted_at already exists.');
        } else {
            throw error;
        }
    }

    console.log('[OK] Migration 40 completed successfully.');
}

if (require.main === module) {
    runMigration40()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('[FAIL] Migration 40 failed:', error);
            process.exitCode = 1;
        });
}
