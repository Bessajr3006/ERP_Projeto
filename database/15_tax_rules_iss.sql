ALTER TABLE tax_rules
ADD COLUMN service_code VARCHAR(20) DEFAULT NULL AFTER cst_cofins,
ADD COLUMN iss_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00 AFTER cofins_percentage;
