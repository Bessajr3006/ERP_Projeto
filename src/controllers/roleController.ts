import { Request, Response } from 'express';
import { RoleService } from '../services/roleService';
import { UserService } from '../services/userService';

export class RoleController {
    static async getAll(req: Request, res: Response): Promise<any> {
        try {
            const companyId = req.user!.company_id;
            const roles = await RoleService.getAllByCompany(companyId);
            return res.status(200).json({ status: 'success', data: roles });
        } catch (error: any) {
            return res.status(500).json({ status: 'error', message: error.message });
        }
    }

    static async getBySlug(req: Request, res: Response): Promise<any> {
        try {
            const companyId = req.user!.company_id;
            const slug = req.params.slug || '';
            const role = await RoleService.getBySlug(companyId, slug);
            if (!role) {
                return res.status(404).json({ status: 'error', message: 'Role not found' });
            }
            return res.status(200).json({ status: 'success', data: role });
        } catch (error: any) {
            return res.status(500).json({ status: 'error', message: error.message });
        }
    }

    static async create(req: Request, res: Response): Promise<any> {
        try {
            const companyId = req.user!.company_id;
            let realRole: string = req.user!.role;
            try {
                const currentUser = await UserService.getById(companyId, req.user!.id);
                if (currentUser && currentUser.role) realRole = currentUser.role;
            } catch (err) {}

            if (realRole !== 'admin' && realRole !== 'super_admin') {
                return res.status(403).json({ status: 'error', message: 'Only admins can create roles' });
            }

            const { name, slug, description } = req.body;
            if (!name || !slug) {
                return res.status(400).json({ status: 'error', message: 'Name and slug are required' });
            }

            // check if exists
            const existing = await RoleService.getBySlug(companyId, slug);
            if (existing) {
                return res.status(400).json({ status: 'error', message: 'A role with this slug already exists' });
            }

            await RoleService.create(companyId, { name, slug, description });
            return res.status(201).json({ status: 'success', message: 'Role created' });
        } catch (error: any) {
            return res.status(500).json({ status: 'error', message: error.message });
        }
    }

    static async update(req: Request, res: Response): Promise<any> {
        try {
            const companyId = req.user!.company_id;
            const slug = req.params.slug || '';

            // Optional: protect admin from being renamed if needed, but for now just name & desc
            const { name, description } = req.body;
            if (!name) return res.status(400).json({ status: 'error', message: 'Name is required' });

            await RoleService.update(companyId, slug, { name, description });
            return res.status(200).json({ status: 'success', message: 'Role updated' });
        } catch (error: any) {
            return res.status(500).json({ status: 'error', message: error.message });
        }
    }

    static async delete(req: Request, res: Response): Promise<any> {
        try {
            const companyId = req.user!.company_id;
            const slug = req.params.slug || '';

            if (['admin', 'super_admin', 'operator', 'user', 'seller', 'contact', 'financial'].includes(slug)) {
                return res.status(400).json({ status: 'error', message: 'Cannot delete default roles' });
            }

            await RoleService.delete(companyId, slug);
            return res.status(200).json({ status: 'success', message: 'Role deleted' });
        } catch (error: any) {
            return res.status(500).json({ status: 'error', message: error.message });
        }
    }
}
