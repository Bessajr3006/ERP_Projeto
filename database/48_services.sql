-- Migration 48: Services table
CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    description TEXT DEFAULT NULL,
    service_type_id INT DEFAULT NULL,
    municipal_tax_reference_id VARCHAR(64) DEFAULT NULL,
    municipal_tax_reference_name VARCHAR(150) DEFAULT NULL,
    federal_tax_reference_id VARCHAR(64) DEFAULT NULL,
    federal_tax_reference_name VARCHAR(150) DEFAULT NULL,
    national_tax_code VARCHAR(30) DEFAULT NULL,
    municipal_tax_code VARCHAR(30) DEFAULT NULL,
    nbs_item VARCHAR(30) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_services_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_services_service_type FOREIGN KEY (service_type_id) REFERENCES service_types(id) ON DELETE SET NULL,
    UNIQUE KEY uk_services_company_name (company_id, name),
    INDEX idx_services_company_type (company_id, service_type_id),
    INDEX idx_services_company_name (company_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
