import pool from '../config/db';

export async function runMigration109(): Promise<void> {
    console.log('│  Migration 109: Create employees table                       │');

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS employees (
                id INT AUTO_INCREMENT PRIMARY KEY,
                public_id VARCHAR(36) NOT NULL UNIQUE,
                company_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                cpf VARCHAR(20) DEFAULT NULL,
                rg VARCHAR(20) DEFAULT NULL,
                birth_date DATE DEFAULT NULL,
                admission_date DATE DEFAULT NULL,
                resignation_date DATE DEFAULT NULL,
                salary DECIMAL(12, 2) DEFAULT 0.00,
                position VARCHAR(255) DEFAULT NULL,
                phone VARCHAR(20) DEFAULT NULL,
                email VARCHAR(255) DEFAULT NULL,
                address VARCHAR(255) DEFAULT NULL,
                city VARCHAR(255) DEFAULT NULL,
                state VARCHAR(2) DEFAULT NULL,
                zip_code VARCHAR(10) DEFAULT NULL,
                status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('[OK] employees table created');

        // Insert default role permissions for 'employees' module for admins
        await pool.query(`
            INSERT IGNORE INTO role_permissions (company_id, role, module, can_view)
            SELECT id, 'admin', 'employees', 1 FROM companies
        `);
        await pool.query(`
            INSERT IGNORE INTO role_permissions (company_id, role, module, can_view)
            SELECT id, 'admin_basic', 'employees', 1 FROM companies
        `);
        console.log('[OK] default role permissions for employees module added');
    } catch (e: any) {
        console.error(`[ERROR] Migration 109 failed: ${e.message}`);
    }
}
