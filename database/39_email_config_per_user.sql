-- Migration 39: Converter email_config de empresa para usuário
-- Adiciona user_public_id e torna company_id opcional
ALTER TABLE email_config
    ADD COLUMN user_public_id CHAR(36) DEFAULT NULL AFTER company_id,
    DROP FOREIGN KEY email_config_ibfk_1,
    MODIFY COLUMN company_id INT DEFAULT NULL,
    ADD UNIQUE KEY uk_email_config_user (user_public_id);
