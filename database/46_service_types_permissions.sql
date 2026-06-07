-- Migration 46: Permissão padrão do módulo Tipo de Serviço para admin e super_admin
INSERT INTO role_permissions (company_id, role, module, can_view)
SELECT c.id, 'admin', 'service_types', 1
FROM companies c
ON DUPLICATE KEY UPDATE can_view = VALUES(can_view);

INSERT INTO role_permissions (company_id, role, module, can_view)
SELECT c.id, 'super_admin', 'service_types', 1
FROM companies c
ON DUPLICATE KEY UPDATE can_view = VALUES(can_view);
