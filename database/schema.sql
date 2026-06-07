-- Bessa ERP Initial Schema

CREATE DATABASE IF NOT EXISTS bessa_erp;
USE bessa_erp;

-- Companies table (ERP foundation)
CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL UNIQUE COMMENT 'UUID for public reference',
    trade_name VARCHAR(150) NOT NULL COMMENT 'Nome Fantasia',
    company_name VARCHAR(150) COMMENT 'Razão Social',
    cnpj VARCHAR(18) UNIQUE,
    tax_regime VARCHAR(100) DEFAULT NULL,
    email VARCHAR(255) DEFAULT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    zipcode VARCHAR(20) DEFAULT NULL,
    street VARCHAR(255) DEFAULT NULL,
    number VARCHAR(50) DEFAULT NULL,
    complement VARCHAR(150) DEFAULT NULL,
    neighborhood VARCHAR(100) DEFAULT NULL,
    city VARCHAR(100) DEFAULT NULL,
    state VARCHAR(50) DEFAULT NULL,
    certificate_base64 LONGTEXT DEFAULT NULL,
    certificate_password VARCHAR(255) DEFAULT NULL,
    certificate_expiration DATE DEFAULT NULL,
    certificate_name VARCHAR(255) DEFAULT NULL,
    logo_url VARCHAR(512) DEFAULT NULL,
    logo_filename VARCHAR(255) DEFAULT NULL,
    logo_base64 LONGTEXT DEFAULT NULL,
    api_token TEXT DEFAULT NULL,
    swagger_api_token TEXT DEFAULT NULL,
    solidcon_api_token TEXT DEFAULT NULL,
    solidcon_url_1 VARCHAR(500) DEFAULT NULL,
    solidcon_url_2 VARCHAR(500) DEFAULT NULL,
    solidcon_url_3 VARCHAR(500) DEFAULT NULL,
    solidcon_url_4 VARCHAR(500) DEFAULT NULL,
    solidcon_url_5 VARCHAR(500) DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    is_system TINYINT(1) NOT NULL DEFAULT 0,
    allow_print_without_confirmation TINYINT(1) NOT NULL DEFAULT 0,
    whatsapp_chat_provider ENUM('business_qr') NOT NULL DEFAULT 'business_qr',
    whatsapp_business_scope ENUM('company', 'user') NOT NULL DEFAULT 'company',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_public_id (public_id),
    INDEX idx_is_system (is_system)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- IBGE states and cities catalog
CREATE TABLE IF NOT EXISTS ibge_states (
    id SMALLINT UNSIGNED NOT NULL PRIMARY KEY,
    uf CHAR(2) NOT NULL,
    name VARCHAR(60) NOT NULL,
    region ENUM('Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul') NOT NULL,
    UNIQUE KEY uq_uf (uf)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ibge_cities (
    id MEDIUMINT UNSIGNED NOT NULL PRIMARY KEY,
    state_id SMALLINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    INDEX idx_state (state_id),
    INDEX idx_name (name),
    CONSTRAINT fk_city_state FOREIGN KEY (state_id) REFERENCES ibge_states(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO ibge_states (id, uf, name, region) VALUES
(11, 'RO', 'Rondônia', 'Norte'),
(12, 'AC', 'Acre', 'Norte'),
(13, 'AM', 'Amazonas', 'Norte'),
(14, 'RR', 'Roraima', 'Norte'),
(15, 'PA', 'Pará', 'Norte'),
(16, 'AP', 'Amapá', 'Norte'),
(17, 'TO', 'Tocantins', 'Norte'),
(21, 'MA', 'Maranhão', 'Nordeste'),
(22, 'PI', 'Piauí', 'Nordeste'),
(23, 'CE', 'Ceará', 'Nordeste'),
(24, 'RN', 'Rio Grande do Norte', 'Nordeste'),
(25, 'PB', 'Paraíba', 'Nordeste'),
(26, 'PE', 'Pernambuco', 'Nordeste'),
(27, 'AL', 'Alagoas', 'Nordeste'),
(28, 'SE', 'Sergipe', 'Nordeste'),
(29, 'BA', 'Bahia', 'Nordeste'),
(31, 'MG', 'Minas Gerais', 'Sudeste'),
(32, 'ES', 'Espírito Santo', 'Sudeste'),
(33, 'RJ', 'Rio de Janeiro', 'Sudeste'),
(35, 'SP', 'São Paulo', 'Sudeste'),
(41, 'PR', 'Paraná', 'Sul'),
(42, 'SC', 'Santa Catarina', 'Sul'),
(43, 'RS', 'Rio Grande do Sul', 'Sul'),
(50, 'MS', 'Mato Grosso do Sul', 'Centro-Oeste'),
(51, 'MT', 'Mato Grosso', 'Centro-Oeste'),
(52, 'GO', 'Goiás', 'Centro-Oeste'),
(53, 'DF', 'Distrito Federal', 'Centro-Oeste');

-- Platform users table (EAD & ERP focus)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL UNIQUE COMMENT 'UUID for public reference',
    company_id INT NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    cpf_cnpj VARCHAR(18) DEFAULT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    zipcode VARCHAR(20) DEFAULT NULL,
    street VARCHAR(255) DEFAULT NULL,
    number VARCHAR(50) DEFAULT NULL,
    complement VARCHAR(150) DEFAULT NULL,
    neighborhood VARCHAR(100) DEFAULT NULL,
    city VARCHAR(100) DEFAULT NULL,
    state VARCHAR(50) DEFAULT NULL,
    default_page VARCHAR(100) DEFAULT NULL,
    whatsapp_auto_reply_mode ENUM('automatic', 'manual') NOT NULL DEFAULT 'automatic',
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_public_id (public_id),
    INDEX idx_email (email),
    INDEX idx_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_company_slug (company_id, slug),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    title TEXT NOT NULL,
    due_date DATETIME DEFAULT NULL,
    assigned_user_public_id CHAR(36) DEFAULT NULL,
    status ENUM('pending', 'progress', 'completed') NOT NULL DEFAULT 'pending',
    person_type VARCHAR(40) DEFAULT NULL,
    person_id VARCHAR(80) DEFAULT NULL,
    attachments_json LONGTEXT DEFAULT NULL,
    completed_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_tasks_company_status (company_id, status),
    INDEX idx_tasks_company_due_date (company_id, due_date),
    INDEX idx_tasks_assigned_user (company_id, assigned_user_public_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organizer_states (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    state_json LONGTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uk_organizer_states_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Role Permissions Table for RBAC
CREATE TABLE IF NOT EXISTS role_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    role VARCHAR(50) NOT NULL,
    module VARCHAR(50) NOT NULL,
    can_view TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uk_role_module (company_id, role, module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    user_id INT DEFAULT NULL,
    action VARCHAR(30) NOT NULL,
    module VARCHAR(80) NOT NULL,
    description VARCHAR(255) NOT NULL,
    entity_type VARCHAR(80) DEFAULT NULL,
    entity_id VARCHAR(100) DEFAULT NULL,
    method VARCHAR(10) DEFAULT NULL,
    path VARCHAR(255) DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    metadata LONGTEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_logs_company_date (company_id, created_at),
    INDEX idx_audit_logs_company_user_date (company_id, user_id, created_at),
    INDEX idx_audit_logs_company_module_date (company_id, module, created_at),
    INDEX idx_audit_logs_company_action_date (company_id, action, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- WhatsApp Business QR messages and conversations (Multi-tenant)
CREATE TABLE IF NOT EXISTS whatsapp_business_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    owner_type ENUM('company', 'user') NOT NULL DEFAULT 'company',
    owner_id INT NOT NULL,
    user_id INT DEFAULT NULL,
    direction ENUM('inbound', 'outbound') NOT NULL,
    contact_phone VARCHAR(40) NOT NULL,
    contact_name VARCHAR(150) DEFAULT NULL,
    chat_id VARCHAR(120) DEFAULT NULL,
    message_id VARCHAR(255) DEFAULT NULL,
    message_type VARCHAR(50) DEFAULT NULL,
    message_text TEXT NOT NULL,
    media_mime_type VARCHAR(255) DEFAULT NULL,
    media_file_name VARCHAR(255) DEFAULT NULL,
    media_base64 LONGTEXT DEFAULT NULL,
    status VARCHAR(50) DEFAULT NULL,
    message_timestamp BIGINT DEFAULT NULL,
    raw_payload LONGTEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uk_whatsapp_business_message_scope (owner_type, owner_id, message_id),
    INDEX idx_wb_messages_company_owner_contact (company_id, owner_type, owner_id, contact_phone),
    INDEX idx_wb_messages_company_owner_created (company_id, owner_type, owner_id, created_at),
    INDEX idx_wb_messages_company_owner_timestamp (company_id, owner_type, owner_id, message_timestamp),
    INDEX idx_wb_messages_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- WhatsApp Business phone aliases (deterministic LID/phone reconciliation)
CREATE TABLE IF NOT EXISTS whatsapp_business_phone_aliases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    owner_type ENUM('company', 'user') NOT NULL DEFAULT 'company',
    owner_id INT NOT NULL,
    alias_phone VARCHAR(40) NOT NULL,
    canonical_phone VARCHAR(40) NOT NULL,
    source_chat_user VARCHAR(40) DEFAULT NULL,
    source_chat_id VARCHAR(120) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uk_wb_phone_alias_scope (owner_type, owner_id, alias_phone),
    INDEX idx_wb_phone_alias_scope_canonical (company_id, owner_type, owner_id, canonical_phone),
    INDEX idx_wb_phone_alias_scope_chat_user (company_id, owner_type, owner_id, source_chat_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- WhatsApp Business session status snapshot (auth data stays in .runtime/whatsapp-business)
CREATE TABLE IF NOT EXISTS whatsapp_business_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    owner_type ENUM('company', 'user') NOT NULL DEFAULT 'company',
    owner_id INT NOT NULL,
    user_id INT DEFAULT NULL,
    company_key VARCHAR(80) NOT NULL,
    owner_key VARCHAR(120) NOT NULL,
    session_key VARCHAR(160) NOT NULL,
    status ENUM('idle', 'initializing', 'awaiting_qr', 'authenticated', 'ready', 'auth_failure', 'disconnected', 'error') NOT NULL DEFAULT 'idle',
    has_qr_code TINYINT(1) NOT NULL DEFAULT 0,
    persisted_session TINYINT(1) NOT NULL DEFAULT 0,
    connected_number VARCHAR(40) DEFAULT NULL,
    connected_name VARCHAR(150) DEFAULT NULL,
    platform VARCHAR(80) DEFAULT NULL,
    wid VARCHAR(120) DEFAULT NULL,
    last_event_at DATETIME DEFAULT NULL,
    last_error TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uk_wb_session_scope (owner_type, owner_id),
    UNIQUE KEY uk_wb_session_key (session_key),
    INDEX idx_wb_session_company_status (company_id, status),
    INDEX idx_wb_session_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ERP Bank Accounts (Multi-tenant)
CREATE TABLE IF NOT EXISTS bank_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    institution VARCHAR(255) DEFAULT NULL,
    type ENUM('checking', 'savings', 'cash') NOT NULL DEFAULT 'checking',
    initial_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    current_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    agency_number VARCHAR(50) DEFAULT NULL,
    account_number VARCHAR(50) DEFAULT NULL,
    pix_key VARCHAR(255) DEFAULT NULL,
    api_client_id VARCHAR(255) DEFAULT NULL,
    api_client_secret VARCHAR(255) DEFAULT NULL,
    api_certificate TEXT DEFAULT NULL,
    api_key TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ERP Entities: Suppliers (Multi-tenant)
CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    cnpj_cpf VARCHAR(18),
    email VARCHAR(255),
    birth_date DATE DEFAULT NULL,
    phone VARCHAR(20),
    zipcode VARCHAR(15) DEFAULT NULL,
    street VARCHAR(255) DEFAULT NULL,
    number VARCHAR(20) DEFAULT NULL,
    complement VARCHAR(100) DEFAULT NULL,
    neighborhood VARCHAR(100) DEFAULT NULL,
    city VARCHAR(100) DEFAULT NULL,
    state VARCHAR(50) DEFAULT NULL,
    certificate_base64 LONGTEXT DEFAULT NULL,
    certificate_password VARCHAR(255) DEFAULT NULL,
    certificate_expiration DATE DEFAULT NULL,
    social_contract_base64 LONGTEXT DEFAULT NULL,
    cnpj_document_base64 LONGTEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ERP Entities: Customers (Multi-tenant)
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    cnpj_cpf VARCHAR(18),
    email VARCHAR(255),
    phone VARCHAR(20),
    vencimento_dia TINYINT DEFAULT NULL,
    limite DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    seller_user_id INT DEFAULT NULL,
    zipcode VARCHAR(15) DEFAULT NULL,
    street VARCHAR(255) DEFAULT NULL,
    number VARCHAR(20) DEFAULT NULL,
    complement VARCHAR(100) DEFAULT NULL,
    neighborhood VARCHAR(100) DEFAULT NULL,
    city VARCHAR(100) DEFAULT NULL,
    state VARCHAR(50) DEFAULT NULL,
    certificate_base64 LONGTEXT DEFAULT NULL,
    certificate_password VARCHAR(255) DEFAULT NULL,
    certificate_expiration DATE DEFAULT NULL,
    social_contract_base64 LONGTEXT DEFAULT NULL,
    cnpj_document_base64 LONGTEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_company_id (company_id),
    INDEX idx_customers_seller_user_id (seller_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ERP Entities: Contacts (Multi-tenant)
CREATE TABLE IF NOT EXISTS contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    cnpj_cpf VARCHAR(18),
    email VARCHAR(255),
    phone VARCHAR(20),
    zipcode VARCHAR(15) DEFAULT NULL,
    street VARCHAR(255) DEFAULT NULL,
    number VARCHAR(20) DEFAULT NULL,
    complement VARCHAR(100) DEFAULT NULL,
    neighborhood VARCHAR(100) DEFAULT NULL,
    city VARCHAR(100) DEFAULT NULL,
    state VARCHAR(50) DEFAULT NULL,
    certificate_url VARCHAR(512) DEFAULT NULL,
    certificate_password VARCHAR(255) DEFAULT NULL,
    certificate_expiration DATE DEFAULT NULL,
    social_contract_url VARCHAR(512) DEFAULT NULL,
    cnpj_document_url VARCHAR(512) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ERP Products (Multi-tenant)
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    sku VARCHAR(100),
    ean VARCHAR(100),
    external_code VARCHAR(100) DEFAULT NULL,
    is_imported TINYINT(1) NOT NULL DEFAULT 0,
    ncm VARCHAR(8) DEFAULT NULL,
    cest VARCHAR(7) DEFAULT NULL,
    cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    selling_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_promotional TINYINT(1) NOT NULL DEFAULT 0,
    promotional_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    current_stock DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    min_stock INT DEFAULT 0,
    max_stock INT DEFAULT 0,
    category_id INT DEFAULT NULL,
    manufacturer_id INT DEFAULT NULL,
    tax_rule_id INT DEFAULT NULL,
    measure_id INT DEFAULT NULL,
    image_base64 LONGTEXT DEFAULT NULL,
    image_url VARCHAR(512) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_company_sku (company_id, sku),
    INDEX idx_products_category_id (category_id),
    INDEX idx_products_manufacturer_id (manufacturer_id),
    INDEX idx_products_tax_rule_id (tax_rule_id),
    INDEX idx_products_measure_id (measure_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ERP Financial Categories (Multi-tenant)
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    type ENUM('income', 'expense') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_company_id (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ERP Purchasing: Purchase Orders (Multi-tenant)
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    supplier_id INT NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    status ENUM('pending', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    INDEX idx_company_date (company_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ERP Purchasing: Purchase Items
CREATE TABLE IF NOT EXISTS purchase_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(15, 2) NOT NULL,
    
    FOREIGN KEY (purchase_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ERP Sales: Sales Orders (Multi-tenant)
CREATE TABLE IF NOT EXISTS sales_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    customer_id INT NULL,
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    status ENUM('pending', 'progress', 'completed', 'cancelled', 'separated', 'invoiced') NOT NULL DEFAULT 'pending',
    date DATE NOT NULL,
    nfe_key VARCHAR(44) DEFAULT NULL,
    nfe_issue_date DATE DEFAULT NULL,
    nfe_header_json LONGTEXT DEFAULT NULL,
    delivery_address TEXT,
    is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    INDEX idx_company_date (company_id, date),
    INDEX idx_sales_orders_company_deleted (company_id, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ERP Sales: Sales Items
CREATE TABLE IF NOT EXISTS sales_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(15, 2) NOT NULL,
    xml_item_data LONGTEXT DEFAULT NULL,
    is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    
    FOREIGN KEY (sale_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_sales_items_sale_deleted (sale_id, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ERP Inventory Movements
CREATE TABLE IF NOT EXISTS inventory_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    product_id INT NOT NULL,
    type ENUM('in', 'out') NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    purchase_id INT NULL,
    sale_id INT NULL,
    date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (purchase_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
    FOREIGN KEY (sale_id) REFERENCES sales_orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ERP Financial Transactions (Multi-tenant)
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    bank_account_id INT NOT NULL,
    category_id INT NOT NULL,
    customer_id INT NULL COMMENT 'Vinculo com cliente (Receita)',
    supplier_id INT NULL COMMENT 'Vinculo com fornecedor (Despesa)',
    user_id INT NOT NULL COMMENT 'Usuário que registrou a transação',
    purchase_id INT NULL COMMENT 'Vinculo com ordem de compra (Despesa)',
    sale_id INT NULL COMMENT 'Vinculo com ordem de venda (Receita)',
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    type ENUM('income', 'expense') NOT NULL,
    payment_method ENUM('pix', 'credit', 'debit', 'cash', 'transfer', 'boleto') NULL COMMENT 'Forma de Pagamento',
    date DATE NOT NULL,
    status ENUM('pending', 'progress', 'paid', 'cancelled') NOT NULL DEFAULT 'paid',
    received_at DATETIME NULL,
    barcode VARCHAR(255) NULL,
    pix_code TEXT NULL,
    billet_url VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE RESTRICT,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (purchase_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
    FOREIGN KEY (sale_id) REFERENCES sales_orders(id) ON DELETE SET NULL,
    INDEX idx_company_date (company_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    image_base64 MEDIUMTEXT DEFAULT NULL,
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
    csosn VARCHAR(4) DEFAULT NULL,
    icms_type VARCHAR(20) DEFAULT 'Normal',
    service_code VARCHAR(20) DEFAULT NULL,
    cest VARCHAR(7) DEFAULT NULL,
    cst_icms VARCHAR(5) DEFAULT NULL,
    icms_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    mva_internal_percentage DECIMAL(5, 2) DEFAULT 0.00,
    mva_interstate_percentage DECIMAL(5, 2) DEFAULT 0.00,
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

-- ERP Inventory: Measures
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

-- ERP Services: Service Types
CREATE TABLE IF NOT EXISTS service_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uk_service_types_company_name (company_id, name),
    INDEX idx_service_types_company_name (company_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ERP Services: Services
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
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (service_type_id) REFERENCES service_types(id) ON DELETE SET NULL,
    UNIQUE KEY uk_services_company_name (company_id, name),
    INDEX idx_services_company_type (company_id, service_type_id),
    INDEX idx_services_company_name (company_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ERP Services: Service Launches
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
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT,
    INDEX idx_service_launches_company_date (company_id, created_at),
    INDEX idx_service_launches_company_customer (company_id, customer_id),
    INDEX idx_service_launches_company_service (company_id, service_id)
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
