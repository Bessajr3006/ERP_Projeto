-- Migration 20: Adiciona campo default_page na tabela users
-- Permite definir a página padrão de redirecionamento após o login para cada usuário.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS default_page VARCHAR(100) DEFAULT NULL
        COMMENT 'Página padrão após login (ex: /pages/sales.html)'
    AFTER state;
