import pool from '../config/db';

export async function runMigration110(): Promise<void> {
    console.log('│  Migration 110: Create customer_notes table                   │');

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS customer_notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                public_id VARCHAR(36) NOT NULL UNIQUE,
                company_id INT NOT NULL,
                customer_id INT NOT NULL,
                user_id INT NULL,
                note TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('[OK] customer_notes table created');
    } catch (e: any) {
        console.error(`[ERROR] Migration 110 failed: ${e.message}`);
    }
}
