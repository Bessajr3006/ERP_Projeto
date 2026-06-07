-- Migration 50: Permissões padrão das telas de tributação de Serviço
INSERT INTO role_permissions (company_id, role, module, can_view)
SELECT c.id, 'admin', 'service_tax_municipal', 1
FROM companies c
ON DUPLICATE KEY UPDATE can_view = VALUES(can_view);

INSERT INTO role_permissions (company_id, role, module, can_view)
SELECT c.id, 'admin', 'service_tax_federal', 1
FROM companies c
ON DUPLICATE KEY UPDATE can_view = VALUES(can_view);

INSERT INTO role_permissions (company_id, role, module, can_view)
SELECT c.id, 'super_admin', 'service_tax_municipal', 1
FROM companies c
ON DUPLICATE KEY UPDATE can_view = VALUES(can_view);

INSERT INTO role_permissions (company_id, role, module, can_view)
SELECT c.id, 'super_admin', 'service_tax_federal', 1
FROM companies c
ON DUPLICATE KEY UPDATE can_view = VALUES(can_view);
