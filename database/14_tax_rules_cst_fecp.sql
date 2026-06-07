-- 14_tax_rules_cst_fecp.sql
ALTER TABLE tax_rules
ADD COLUMN cst_icms VARCHAR(5) DEFAULT NULL AFTER cest,
ADD COLUMN fecp_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00 AFTER icms_percentage,
ADD COLUMN cst_pis VARCHAR(5) DEFAULT NULL AFTER ipi_percentage,
ADD COLUMN cst_cofins VARCHAR(5) DEFAULT NULL AFTER pis_percentage;
