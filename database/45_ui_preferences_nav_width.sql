-- Migration 45: Largura da navbar separada do conteudo
ALTER TABLE ui_preferences
    ADD COLUMN IF NOT EXISTS nav_width VARCHAR(30) NOT NULL DEFAULT 'system' AFTER layout_width;
