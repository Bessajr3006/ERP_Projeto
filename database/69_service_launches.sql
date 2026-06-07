-- Migration 69: Tabela de lançamentos de serviço
CREATE TABLE IF NOT EXISTS service_launches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    customer_id INT NOT NULL,
    service_id INT NOT NULL,
    quantity DECIMAL(12, 3) NOT NULL DEFAULT 1.000,
    unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    observation TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_service_launches_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_service_launches_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_service_launches_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT,

    INDEX idx_service_launches_company_date (company_id, created_at),
    INDEX idx_service_launches_company_customer (company_id, customer_id),
    INDEX idx_service_launches_company_service (company_id, service_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
