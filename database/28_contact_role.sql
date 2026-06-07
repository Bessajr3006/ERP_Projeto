ALTER TABLE users
    MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'user';

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

INSERT INTO roles (public_id, company_id, name, slug, description)
SELECT UUID(), c.id, 'Contato', 'contact', 'Acesso ao cadastro de contatos'
FROM companies c
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO role_permissions (company_id, role, module, can_view)
SELECT c.id, 'contact', 'dashboard', TRUE
FROM companies c
ON DUPLICATE KEY UPDATE
    can_view = VALUES(can_view),
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO role_permissions (company_id, role, module, can_view)
SELECT c.id, 'contact', 'contacts', TRUE
FROM companies c
ON DUPLICATE KEY UPDATE
    can_view = VALUES(can_view),
    updated_at = CURRENT_TIMESTAMP;