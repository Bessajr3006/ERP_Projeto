ALTER TABLE customers
ADD COLUMN IF NOT EXISTS vencimento_dia TINYINT DEFAULT NULL COMMENT 'Dia do mes para vencimento (1-31)' AFTER phone,
ADD COLUMN IF NOT EXISTS limite DECIMAL(15, 2) NOT NULL DEFAULT 0.00 COMMENT 'Limite de credito' AFTER vencimento_dia;