-- Migration 70: campos IMAP na configuracao de e-mail
ALTER TABLE email_config
    ADD COLUMN IF NOT EXISTS imap_host VARCHAR(255) NOT NULL DEFAULT '' AFTER smtp_user,
    ADD COLUMN IF NOT EXISTS imap_port SMALLINT UNSIGNED NOT NULL DEFAULT 993 AFTER imap_host,
    ADD COLUMN IF NOT EXISTS imap_secure TINYINT(1) NOT NULL DEFAULT 1 AFTER imap_port;
