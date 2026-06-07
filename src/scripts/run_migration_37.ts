import pool from '../config/db';

export async function runMigration37() {
    console.log('[INFO] Running migration 37: convert user.role to VARCHAR and create roles table');
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS roles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                public_id CHAR(36) NOT NULL UNIQUE,
                company_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                slug VARCHAR(50) NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_company_slug (company_id, slug),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('[OK] "roles" table created');

        // Note: altering ENUM might fail if duplicate column def, but doing standard MODIFY
        try {
            await pool.query('ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT "user"');
            console.log('[OK] Column "users.role" converted to VARCHAR');
        } catch (e: any) {
            if (e.code === 'ER_DUP_KEY' || e.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
                console.log('[SKIP] Could not alter users.role. Maybe already VARCHAR? Details:', e.message);
            } else {
                console.log('[SKIP] Could not alter users.role. Unexpected error. Details:', e.message);
            }
        }

        // Seed basic roles for existing companies so the platform doesn't crash empty
        const [companies] = await pool.query('SELECT id FROM companies') as any;
        const defaultRoles = [
            { name: 'Administrador (ADM)', slug: 'admin', desc: 'Acesso total e configurações avançadas' },
            { name: 'Operador', slug: 'operator', desc: 'Operações diárias como PDV e Separação' },
            { name: 'Financeiro', slug: 'financial', desc: 'Contas a pagar, receber, bancos' },
            { name: 'Vendedor', slug: 'seller', desc: 'Realização de vendas e orçamentos' },
            { name: 'Contato', slug: 'contact', desc: 'Acesso ao cadastro de contatos' },
            { name: 'Contador', slug: 'accountant', desc: 'Painéis fiscais e contábeis' },
            { name: 'Comprador', slug: 'buyer', desc: 'Gestão de compras e fornecedores' },
            { name: 'Prestador de Serviço', slug: 'service_provider', desc: 'Consulta restrita' },
            { name: 'Usuário Comum', slug: 'user', desc: 'Acesso básico' }
        ];

        for (const company of companies) {
            for (const r of defaultRoles) {
                await pool.query(`
                    INSERT IGNORE INTO roles (public_id, company_id, name, slug, description)
                    VALUES (UUID(), ?, ?, ?, ?)
                `, [company.id, r.name, r.slug, r.desc]);
            }
        }
        console.log('[OK] Existing companies seeded with default roles');
        
    } catch (error) {
        console.error('[FAIL] Migration 37 execution error:', error);
        throw error;
    }
}
