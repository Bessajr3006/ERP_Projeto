-- Migration 53: Campos para vínculo com referência de tributação federal
ALTER TABLE services
    ADD COLUMN IF NOT EXISTS federal_tax_reference_id VARCHAR(64) DEFAULT NULL AFTER municipal_tax_reference_name,
    ADD COLUMN IF NOT EXISTS federal_tax_reference_name VARCHAR(150) DEFAULT NULL AFTER federal_tax_reference_id;
