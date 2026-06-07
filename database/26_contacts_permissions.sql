INSERT INTO role_permissions (company_id, role, module, can_view)
SELECT company_id, role, 'contacts', can_view
FROM role_permissions
WHERE module = 'customers'
ON DUPLICATE KEY UPDATE
    can_view = VALUES(can_view),
    updated_at = CURRENT_TIMESTAMP;