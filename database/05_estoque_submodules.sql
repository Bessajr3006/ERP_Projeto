-- Tabelas e atualizações para os submódulos do Estoque

-- ERP Inventory: Categories
CREATE TABLE IF NOT EXISTS product_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_base64 LONGTEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ERP Inventory: Manufacturers
CREATE TABLE IF NOT EXISTS manufacturers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    cnpj VARCHAR(18),
    phone VARCHAR(20),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ERP Inventory: Tax Rules
CREATE TABLE IF NOT EXISTS tax_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    ncm VARCHAR(8) DEFAULT NULL,
    service_code VARCHAR(20) DEFAULT NULL,
    cest VARCHAR(7) DEFAULT NULL,
    cst_icms VARCHAR(5) DEFAULT NULL,
    icms_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    fecp_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    ipi_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    cst_pis VARCHAR(5) DEFAULT NULL,
    pis_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    cst_cofins VARCHAR(5) DEFAULT NULL,
    cofins_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    iss_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    cst_ibs VARCHAR(5) DEFAULT NULL,
    ibs_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    cst_cbs VARCHAR(5) DEFAULT NULL,
    cbs_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    cst_is VARCHAR(5) DEFAULT NULL,
    is_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ERP Inventory: Price Tables
CREATE TABLE IF NOT EXISTS price_tables (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    markup_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
