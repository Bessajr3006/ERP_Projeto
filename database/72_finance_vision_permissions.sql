-- 72_finance_vision_permissions.sql
-- Concede permissao de visualizacao do modulo finance_vision
-- para perfis admin, super_admin e financial em todas as empresas.

INSERT INTO role_permissions (company_id, role, module, can_view)
SELECT c.id, 'admin', 'finance_vision', 1
FROM companies c
ON DUPLICATE KEY UPDATE can_view = VALUES(can_view);

INSERT INTO role_permissions (company_id, role, module, can_view)
SELECT c.id, 'super_admin', 'finance_vision', 1
FROM companies c
ON DUPLICATE KEY UPDATE can_view = VALUES(can_view);

INSERT INTO role_permissions (company_id, role, module, can_view)
SELECT c.id, 'financial', 'finance_vision', 1
FROM companies c
ON DUPLICATE KEY UPDATE can_view = VALUES(can_view);
