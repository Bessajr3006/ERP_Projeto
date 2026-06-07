-- Migration 41: Preferencias visuais por empresa e usuario
CREATE TABLE IF NOT EXISTS ui_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    user_public_id VARCHAR(80) NOT NULL,
    theme VARCHAR(20) NOT NULL DEFAULT 'dark',
    layout_align VARCHAR(20) NOT NULL DEFAULT 'responsive',
    layout_width VARCHAR(30) NOT NULL DEFAULT 'system',
    nav_color CHAR(7) NOT NULL DEFAULT '#0f172a',
    footer_color CHAR(7) NOT NULL DEFAULT '#0f172a',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uk_ui_preferences_company_user (company_id, user_public_id),
    INDEX idx_ui_preferences_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
