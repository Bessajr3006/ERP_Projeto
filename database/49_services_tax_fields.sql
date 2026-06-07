-- Migration 49: Add tax/NBS fields to services table
ALTER TABLE services
    ADD COLUMN IF NOT EXISTS national_tax_code VARCHAR(30) DEFAULT NULL AFTER description,
    ADD COLUMN IF NOT EXISTS municipal_tax_code VARCHAR(30) DEFAULT NULL AFTER national_tax_code,
    ADD COLUMN IF NOT EXISTS nbs_item VARCHAR(30) DEFAULT NULL AFTER municipal_tax_code;