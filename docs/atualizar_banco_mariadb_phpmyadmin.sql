-- =========================================================
-- Script: atualizar_banco_mariadb_phpmyadmin.sql
-- Objetivo: atualizar outro banco MariaDB via phpMyAdmin
-- Compatível com importação simples no phpMyAdmin
-- Baseado nas migrações 18, 19 e 20 do ERP
--
-- COMO USAR
-- 1) Faça backup do banco de destino.
-- 2) No phpMyAdmin, selecione o banco.
-- 3) Vá em Importar e envie este arquivo.
-- 4) Execute preferencialmente uma vez.
--
-- OBSERVAÇÃO
-- - `ADD COLUMN IF NOT EXISTS` evita erro para colunas já existentes.
-- - As `FOREIGN KEY` devem existir só uma vez; se a constraint já existir,
--   o MariaDB pode avisar nessa etapa específica.
-- =========================================================

-- ---------------------------------------------------------
-- 1) bank_accounts
-- ---------------------------------------------------------
ALTER TABLE bank_accounts
    ADD COLUMN IF NOT EXISTS institution VARCHAR(255) DEFAULT NULL AFTER name;

-- ---------------------------------------------------------
-- 2) measures
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS measures (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id VARCHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    abbreviation VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_company_id (company_id),
    CONSTRAINT fk_measures_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------
-- 3) products
-- ---------------------------------------------------------
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS external_code VARCHAR(100) DEFAULT NULL AFTER ean,
    ADD COLUMN IF NOT EXISTS ncm VARCHAR(8) DEFAULT NULL AFTER external_code,
    ADD COLUMN IF NOT EXISTS cest VARCHAR(7) DEFAULT NULL AFTER ncm,
    ADD COLUMN IF NOT EXISTS min_stock INT DEFAULT 0 AFTER current_stock,
    ADD COLUMN IF NOT EXISTS max_stock INT DEFAULT 0 AFTER min_stock,
    ADD COLUMN IF NOT EXISTS category_id INT NULL AFTER max_stock,
    ADD COLUMN IF NOT EXISTS manufacturer_id INT NULL AFTER category_id,
    ADD COLUMN IF NOT EXISTS tax_rule_id INT NULL AFTER manufacturer_id,
    ADD COLUMN IF NOT EXISTS measure_id INT NULL AFTER tax_rule_id,
    ADD COLUMN IF NOT EXISTS image_url VARCHAR(512) NULL DEFAULT NULL AFTER image_base64;

-- Execute esta parte uma única vez se as FKs ainda não existirem
ALTER TABLE products
    ADD CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_product_manufacturer FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_product_tax_rule FOREIGN KEY (tax_rule_id) REFERENCES tax_rules(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_product_measure FOREIGN KEY (measure_id) REFERENCES measures(id) ON DELETE SET NULL;

-- ---------------------------------------------------------
-- 4) tax_rules
-- ---------------------------------------------------------
ALTER TABLE tax_rules
    ADD COLUMN IF NOT EXISTS csosn VARCHAR(4) DEFAULT NULL AFTER ncm,
    ADD COLUMN IF NOT EXISTS icms_type VARCHAR(20) DEFAULT 'Normal' AFTER csosn,
    ADD COLUMN IF NOT EXISTS mva_internal_percentage DECIMAL(5,2) DEFAULT 0.00 AFTER icms_percentage,
    ADD COLUMN IF NOT EXISTS mva_interstate_percentage DECIMAL(5,2) DEFAULT 0.00 AFTER mva_internal_percentage;

-- ---------------------------------------------------------
-- 5) sales_orders
-- ---------------------------------------------------------
ALTER TABLE sales_orders
    MODIFY COLUMN customer_id INT NULL,
    MODIFY COLUMN status ENUM('pending', 'completed', 'cancelled', 'separated', 'invoiced') NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS delivery_address TEXT NULL AFTER date;

-- ---------------------------------------------------------
-- 6) companies
-- ---------------------------------------------------------
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS allow_print_without_confirmation TINYINT(1) NOT NULL DEFAULT 0;

SELECT 'Atualização MariaDB concluída.' AS status;
