import 'dotenv/config';
import pool from '../config/db';

export async function runMigration39(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  Migration 39: whatsapp_jobs table (MySQL Queue replacement) │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS whatsapp_jobs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            type VARCHAR(100) NOT NULL,
            payload JSON NOT NULL,
            status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
            error_message TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP NULL DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    await pool.query(createTableQuery);

    console.log('[OK] Tabela whatsapp_jobs criada com sucesso.');
    console.log('[OK] Migration 39 completed successfully.');
}

if (require.main === module) {
    runMigration39()
        .catch((error) => {
            console.error('[FAIL] Migration 39 failed:', error);
            process.exitCode = 1;
        })
        .finally(async () => {
            await pool.end();
        });
}
