CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    user_id INT DEFAULT NULL,
    action VARCHAR(30) NOT NULL,
    module VARCHAR(80) NOT NULL,
    description VARCHAR(255) NOT NULL,
    entity_type VARCHAR(80) DEFAULT NULL,
    entity_id VARCHAR(100) DEFAULT NULL,
    method VARCHAR(10) DEFAULT NULL,
    path VARCHAR(255) DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    metadata LONGTEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_logs_company_date (company_id, created_at),
    INDEX idx_audit_logs_company_user_date (company_id, user_id, created_at),
    INDEX idx_audit_logs_company_module_date (company_id, module, created_at),
    INDEX idx_audit_logs_company_action_date (company_id, action, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO role_permissions (company_id, role, module, can_view)
SELECT c.id, 'admin', 'audit', 1
FROM companies c
ON DUPLICATE KEY UPDATE can_view = VALUES(can_view);

INSERT INTO role_permissions (company_id, role, module, can_view)
SELECT c.id, 'super_admin', 'audit', 1
FROM companies c
ON DUPLICATE KEY UPDATE can_view = VALUES(can_view);
