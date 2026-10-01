import pool from '../src/config/db';
import { PermissionService } from '../src/services/permissionService';

async function test() {
    console.log('Testing permission saving...');
    try {
        const companyId = 2; // Let's use company ID 2 from our query
        const role = 'operator';
        
        // Define test permissions
        const testPermissions = [
            { module: 'dashboard', can_view: true },
            { module: 'sales', can_view: false },
            { module: 'products', can_view: true }
        ];

        console.log('Updating permissions...');
        await PermissionService.updateByRole(companyId, role, testPermissions);
        console.log('Permissions updated successfully.');

        // Query database to verify
        const [rows]: any = await pool.query(
            'SELECT module, can_view FROM role_permissions WHERE company_id = ? AND role = ?',
            [companyId, role]
        );

        console.log('Permissions in database:', rows);
    } catch (error) {
        console.error('Error during test:', error);
    } finally {
        await pool.end();
    }
}

test();
