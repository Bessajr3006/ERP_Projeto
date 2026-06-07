import 'dotenv/config';
import pool from '../config/db';

export async function runMigration37(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 37: Switch whatsapp media_base64 to media_url     │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    try {
        await pool.query(
            `ALTER TABLE whatsapp_business_messages 
             DROP COLUMN media_base64, 
             ADD COLUMN media_url VARCHAR(500) DEFAULT NULL AFTER media_file_name`
        );
        console.log('[OK] Column media_base64 dropped and media_url added successfully.');
    } catch (error: any) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('[SKIP] Column media_url already exists.');
        } else if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
            console.log('[SKIP] Column media_base64 already removed.');
        } else {
            throw error;
        }
    }

    console.log('[OK] Migration 37 completed successfully.');
}

if (require.main === module) {
    runMigration37()
        .catch((error) => {
            console.error('[FAIL] Migration 37 failed:', error);
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
