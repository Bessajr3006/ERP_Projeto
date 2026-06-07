-- Migration 52: Campos para vínculo com referência de tributação municipal
ALTER TABLE services
    ADD COLUMN IF NOT EXISTS municipal_tax_reference_id VARCHAR(64) DEFAULT NULL AFTER service_type_id,
    ADD COLUMN IF NOT EXISTS municipal_tax_reference_name VARCHAR(150) DEFAULT NULL AFTER municipal_tax_reference_id;
