import pool from '../config/db';

export async function runMigration111(): Promise<void> {
    console.log('│  Migration 111: Add pix_key to transactions table             │');

    try {
        // Check if column already exists
        const [columns]: any = await pool.query(`SHOW COLUMNS FROM transactions LIKE 'pix_key'`);
        if (columns.length === 0) {
            await pool.query(`
                ALTER TABLE transactions 
                ADD COLUMN pix_key VARCHAR(255) NULL AFTER pix_code;
            `);
            console.log('[OK] Column pix_key added to transactions table');
        } else {
            console.log('[INFO] Column pix_key already exists in transactions table');
        }
    } catch (e: any) {
        console.error(`[ERROR] Migration 111 failed: ${e.message}`);
    }
}
