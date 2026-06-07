-- Migration 44: Alinhamento da navbar separado do conteudo
ALTER TABLE ui_preferences
    ADD COLUMN IF NOT EXISTS nav_align VARCHAR(20) NOT NULL DEFAULT 'responsive' AFTER layout_align;
