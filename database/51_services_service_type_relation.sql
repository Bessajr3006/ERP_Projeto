-- Migration 51: Relacionar serviços ao tipo de serviço
ALTER TABLE services
    ADD COLUMN IF NOT EXISTS service_type_id INT DEFAULT NULL AFTER description,
    ADD INDEX idx_services_company_type (company_id, service_type_id),
    ADD CONSTRAINT fk_services_service_type
        FOREIGN KEY (service_type_id)
        REFERENCES service_types(id)
        ON DELETE SET NULL;
