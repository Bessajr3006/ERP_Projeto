-- Migration 43: Controle de exibicao do botao de tema na navbar
ALTER TABLE ui_preferences
    ADD COLUMN IF NOT EXISTS theme_toggle_visible TINYINT(1) NOT NULL DEFAULT 1 AFTER form_header_size;
