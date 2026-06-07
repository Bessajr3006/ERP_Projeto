import { Request, Response } from 'express';
import { PermissionService } from '../services/permissionService';
import { UserService } from '../services/userService';
import logger from '../config/logger';

export class PermissionController {
    static async getByRole(req: Request, res: Response): Promise<any> {
        try {
            const companyId = req.user!.company_id;
            const role = req.params.role;
            if (!role) {
                return res.status(400).json({ status: 'error', message: 'Role parameter required' });
            }

            const permissions = await PermissionService.getByRole(companyId, role);
            return res.status(200).json({ status: 'success', data: permissions });
        } catch (error: any) {
            return res.status(500).json({ status: 'error', message: error.message });
        }
    }

    static async updateByRole(req: Request, res: Response): Promise<any> {
        try {
            const companyId = req.user!.company_id;
            const role = req.params.role;
            if (!role) {
                return res.status(400).json({ status: 'error', message: 'Role parameter required' });
            }

            // Instead of trusting potentially cached JWT token, let's check the real role in the DB
            let realRole: string = req.user!.role;
            try {
                const currentUser = await UserService.getById(companyId, req.user!.id);
                if (currentUser && currentUser.role) {
                    realRole = currentUser.role;
                }
            } catch (err) {
                logger.warn({ err, userId: req.user!.id, companyId: req.user!.company_id }, '[permissionController] Não foi possível verificar role real do usuário');
            }

            // Apenas admin/super_admin podem modificar permissões
            if (realRole !== 'admin' && realRole !== 'super_admin') {
                return res.status(403).json({ status: 'error', message: 'Only admins can modify permissions' });
            }

            // Proteções por role alvo
            if (role === 'super_admin') {
                return res.status(400).json({ status: 'error', message: 'Cannot modify super_admin permissions' });
            }

            // Somente super_admin pode editar as permissões do role admin
            if (role === 'admin' && realRole !== 'super_admin') {
                return res.status(403).json({ status: 'error', message: 'Only super admin can modify admin permissions' });
            }

            const { permissions } = req.body;
            if (!Array.isArray(permissions)) {
                return res.status(400).json({ status: 'error', message: 'Permissions array required' });
            }

            if (role === 'admin' && realRole === 'super_admin') {
                const result = await PermissionService.updateByRoleAllCompanies(role, permissions, companyId);
                return res.status(200).json({
                    status: 'success',
                    message: `Permissions updated globally for admin role in ${result.updatedCompanies} companies`
                });
            }

            await PermissionService.updateByRole(companyId, role, permissions);
            return res.status(200).json({ status: 'success', message: 'Permissions updated' });
        } catch (error: any) {
            return res.status(500).json({ status: 'error', message: error.message });
        }
    }
}
