ALTER TABLE companies
    ADD COLUMN logo_url VARCHAR(512) DEFAULT NULL AFTER certificate_name,
    ADD COLUMN logo_filename VARCHAR(255) DEFAULT NULL AFTER logo_url;