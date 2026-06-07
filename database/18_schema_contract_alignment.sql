-- 18_schema_contract_alignment.sql
-- Alinha o banco com o contrato atual usado pelos services/controllers.

ALTER TABLE bank_accounts
ADD COLUMN institution VARCHAR(255) DEFAULT NULL AFTER name;

CREATE TABLE IF NOT EXISTS measures (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id VARCHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    abbreviation VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE products
ADD COLUMN external_code VARCHAR(100) DEFAULT NULL AFTER ean,
ADD COLUMN ncm VARCHAR(8) DEFAULT NULL AFTER external_code,
ADD COLUMN cest VARCHAR(7) DEFAULT NULL AFTER ncm,
ADD COLUMN min_stock INT DEFAULT 0 AFTER current_stock,
ADD COLUMN max_stock INT DEFAULT 0 AFTER min_stock,
ADD COLUMN category_id INT NULL AFTER max_stock,
ADD COLUMN manufacturer_id INT NULL AFTER category_id,
ADD COLUMN tax_rule_id INT NULL AFTER manufacturer_id,
ADD COLUMN measure_id INT NULL AFTER tax_rule_id,
ADD COLUMN image_url VARCHAR(512) NULL DEFAULT NULL AFTER image_base64;

ALTER TABLE products
ADD CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_product_manufacturer FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_product_tax_rule FOREIGN KEY (tax_rule_id) REFERENCES tax_rules(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_product_measure FOREIGN KEY (measure_id) REFERENCES measures(id) ON DELETE SET NULL;

ALTER TABLE tax_rules
ADD COLUMN csosn VARCHAR(4) DEFAULT NULL AFTER ncm,
ADD COLUMN icms_type VARCHAR(20) DEFAULT 'Normal' AFTER csosn,
ADD COLUMN mva_internal_percentage DECIMAL(5, 2) DEFAULT 0.00 AFTER icms_percentage,
ADD COLUMN mva_interstate_percentage DECIMAL(5, 2) DEFAULT 0.00 AFTER mva_internal_percentage;

ALTER TABLE sales_orders
MODIFY COLUMN customer_id INT NULL,
MODIFY COLUMN status ENUM('pending', 'completed', 'cancelled', 'separated', 'invoiced') NOT NULL DEFAULT 'pending',
ADD COLUMN delivery_address TEXT NULL AFTER date;
