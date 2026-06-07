import 'dotenv/config';
import mysql from 'mysql2/promise';

async function run(): Promise<void> {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'bessa_erp',
    });

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chart_of_accounts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                public_id VARCHAR(36) UNIQUE NOT NULL,
                company_id INT NOT NULL,
                code VARCHAR(50) NOT NULL,
                name VARCHAR(150) NOT NULL,
                type ENUM('synthetic', 'analytic') NOT NULL DEFAULT 'analytic',
                nature ENUM('debit', 'credit') NOT NULL DEFAULT 'debit',
                status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                UNIQUE KEY uq_company_code (company_id, code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('Table created successfully.');
    } catch (error) {
        console.error('Error creating table:', error);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

run();
