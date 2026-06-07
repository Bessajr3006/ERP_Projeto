-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 17: Tabelas de estados e municípios do IBGE
-- Usado para: autocompletar endereços, NF-e (cMun), validação de cidade/UF
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ibge_states (
    id        SMALLINT UNSIGNED NOT NULL PRIMARY KEY,  -- código IBGE (ex: 35 = SP)
    uf        CHAR(2)     NOT NULL,                     -- sigla (ex: SP)
    name      VARCHAR(60) NOT NULL,                     -- nome completo
    region    ENUM('Norte','Nordeste','Centro-Oeste','Sudeste','Sul') NOT NULL,
    UNIQUE KEY uq_uf (uf)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ibge_cities (
    id        MEDIUMINT UNSIGNED NOT NULL PRIMARY KEY,  -- código IBGE 7 dígitos (ex: 3550308)
    state_id  SMALLINT UNSIGNED NOT NULL,               -- FK → ibge_states.id
    name      VARCHAR(100) NOT NULL,                    -- nome do município
    INDEX idx_state (state_id),
    INDEX idx_name  (name),
    CONSTRAINT fk_city_state FOREIGN KEY (state_id) REFERENCES ibge_states(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Estados (27 UFs) ──────────────────────────────────────────────────────────
INSERT IGNORE INTO ibge_states (id, uf, name, region) VALUES
(11, 'RO', 'Rondônia',              'Norte'),
(12, 'AC', 'Acre',                  'Norte'),
(13, 'AM', 'Amazonas',              'Norte'),
(14, 'RR', 'Roraima',               'Norte'),
(15, 'PA', 'Pará',                  'Norte'),
(16, 'AP', 'Amapá',                 'Norte'),
(17, 'TO', 'Tocantins',             'Norte'),
(21, 'MA', 'Maranhão',              'Nordeste'),
(22, 'PI', 'Piauí',                 'Nordeste'),
(23, 'CE', 'Ceará',                 'Nordeste'),
(24, 'RN', 'Rio Grande do Norte',   'Nordeste'),
(25, 'PB', 'Paraíba',               'Nordeste'),
(26, 'PE', 'Pernambuco',            'Nordeste'),
(27, 'AL', 'Alagoas',               'Nordeste'),
(28, 'SE', 'Sergipe',               'Nordeste'),
(29, 'BA', 'Bahia',                 'Nordeste'),
(31, 'MG', 'Minas Gerais',          'Sudeste'),
(32, 'ES', 'Espírito Santo',        'Sudeste'),
(33, 'RJ', 'Rio de Janeiro',        'Sudeste'),
(35, 'SP', 'São Paulo',             'Sudeste'),
(41, 'PR', 'Paraná',                'Sul'),
(42, 'SC', 'Santa Catarina',        'Sul'),
(43, 'RS', 'Rio Grande do Sul',     'Sul'),
(50, 'MS', 'Mato Grosso do Sul',    'Centro-Oeste'),
(51, 'MT', 'Mato Grosso',           'Centro-Oeste'),
(52, 'GO', 'Goiás',                 'Centro-Oeste'),
(53, 'DF', 'Distrito Federal',      'Centro-Oeste');
