-- Migration 38: Configuração de caixa de email (SMTP) por empresa
CREATE TABLE IF NOT EXISTS email_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    smtp_host VARCHAR(255) NOT NULL DEFAULT '',
    smtp_port SMALLINT UNSIGNED NOT NULL DEFAULT 587,
    smtp_secure TINYINT(1) NOT NULL DEFAULT 0,
    smtp_user VARCHAR(255) NOT NULL DEFAULT '',
    imap_host VARCHAR(255) NOT NULL DEFAULT '',
    imap_port SMALLINT UNSIGNED NOT NULL DEFAULT 993,
    imap_secure TINYINT(1) NOT NULL DEFAULT 1,
    smtp_password TEXT DEFAULT NULL,
    sender_name VARCHAR(120) NOT NULL DEFAULT '',
    sender_email VARCHAR(255) NOT NULL DEFAULT '',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uk_email_config_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
