ALTER TABLE tax_rules
CHANGE COLUMN pis_cofins_percentage pis_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
ADD COLUMN cofins_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00 AFTER pis_percentage;
