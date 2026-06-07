-- Migration 40: Permissão padrão do módulo Ajuste para admin e super_admin
INSERT INTO role_permissions (company_id, role, module, can_view)
SELECT c.id, 'admin', 'ajuste', 1
FROM companies c
ON DUPLICATE KEY UPDATE can_view = VALUES(can_view);

INSERT INTO role_permissions (company_id, role, module, can_view)
SELECT c.id, 'super_admin', 'ajuste', 1
FROM companies c
ON DUPLICATE KEY UPDATE can_view = VALUES(can_view);
