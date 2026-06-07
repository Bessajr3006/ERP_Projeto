-- Migration 42: Campos de padrao de formulario em ui_preferences
ALTER TABLE ui_preferences
    ADD COLUMN IF NOT EXISTS form_company_name VARCHAR(150) DEFAULT NULL AFTER footer_color,
    ADD COLUMN IF NOT EXISTS form_profile VARCHAR(20) NOT NULL DEFAULT 'padrao' AFTER form_company_name,
    ADD COLUMN IF NOT EXISTS form_accent VARCHAR(30) NOT NULL DEFAULT 'brand' AFTER form_profile,
    ADD COLUMN IF NOT EXISTS form_header_size VARCHAR(20) NOT NULL DEFAULT 'medio' AFTER form_accent;
