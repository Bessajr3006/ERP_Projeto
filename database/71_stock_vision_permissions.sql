-- 71_stock_vision_permissions.sql
-- Concede permissao de visualizacao do modulo stock_vision
-- para perfis admin e super_admin em todas as empresas.

INSERT INTO role_permissions (company_id, role, module, can_view)
SELECT c.id, 'admin', 'stock_vision', 1
FROM companies c
ON DUPLICATE KEY UPDATE can_view = VALUES(can_view);

INSERT INTO role_permissions (company_id, role, module, can_view)
SELECT c.id, 'super_admin', 'stock_vision', 1
FROM companies c
ON DUPLICATE KEY UPDATE can_view = VALUES(can_view);
