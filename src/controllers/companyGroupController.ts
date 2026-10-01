import { Request, Response } from 'express';
import { z } from 'zod';
import { CompanyGroupService } from '../services/companyGroupService';
import { CompanyService } from '../services/companyService';
import { AppError } from '../errors/AppError';

const createCompanyGroupSchema = z.object({
    name: z.string().trim().min(1, 'Nome é obrigatório').max(150, 'Nome muito longo')
});

const updateCompanyGroupSchema = z.object({
    name: z.string().trim().min(1, 'Nome não pode ser vazio').max(150, 'Nome muito longo').optional()
});

const linkCompanySchema = z.object({
    company_public_id: z.string().uuid('ID da empresa inválido'),
    group_public_id: z.string().uuid('ID do grupo inválido').nullable().optional(),
    is_group_master: z.boolean().optional()
});

export class CompanyGroupController {
    static async create(req: Request, res: Response): Promise<any> {
        const validatedData = createCompanyGroupSchema.parse(req.body);
        const result = await CompanyGroupService.create(validatedData);

        return res.status(201).json({
            status: 'success',
            data: result
        });
    }

    static async list(req: Request, res: Response): Promise<any> {
        let isSuperAdmin = req.user?.role === 'super_admin' || Boolean(req.user?.general_admin_company_id);
        let userCompany: any = null;
        if (req.user?.company_id) {
            try {
                userCompany = await CompanyService.getById(req.user.company_id);
                if (userCompany.is_general_admin === true || (userCompany as any).is_general_admin === 1) {
                    isSuperAdmin = true;
                }
            } catch (e) {}
        }

        if (isSuperAdmin) {
            const result = await CompanyGroupService.list();
            return res.status(200).json({
                status: 'success',
                data: result
            });
        }

        let groupId = userCompany?.company_group_id;
        if (req.user?.group_master_company_id) {
            try {
                const master = await CompanyService.getById(req.user.group_master_company_id);
                groupId = master.company_group_id;
            } catch (e) {}
        }

        if (groupId) {
            try {
                const group = await CompanyGroupService.getById(groupId);
                return res.status(200).json({
                    status: 'success',
                    data: [group]
                });
            } catch (e) {}
        }

        return res.status(200).json({
            status: 'success',
            data: []
        });
    }

    static async getByPublicId(req: Request, res: Response): Promise<any> {
        const publicId = req.params.id;
        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        const result = await CompanyGroupService.getByPublicId(publicId);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async update(req: Request, res: Response): Promise<any> {
        const publicId = req.params.id;
        const validatedData = updateCompanyGroupSchema.parse(req.body);

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        const result = await CompanyGroupService.update(publicId, validatedData);

        return res.status(200).json({
            status: 'success',
            message: 'Grupo de empresa atualizado com sucesso',
            data: result
        });
    }

    static async delete(req: Request, res: Response): Promise<any> {
        const publicId = req.params.id;
        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        await CompanyGroupService.delete(publicId);

        return res.status(200).json({
            status: 'success',
            message: 'Grupo de empresa excluído com sucesso'
        });
    }

    static async listCompanies(req: Request, res: Response): Promise<any> {
        const publicId = req.params.id;
        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        const result = await CompanyGroupService.listCompaniesInGroup(publicId);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async linkCompany(req: Request, res: Response): Promise<any> {
        const { company_public_id, group_public_id, is_group_master } = linkCompanySchema.parse(req.body);

        await CompanyGroupService.linkCompanyToGroup(company_public_id, group_public_id || null, is_group_master);

        return res.status(200).json({
            status: 'success',
            message: 'Empresa vinculada ao grupo com sucesso'
        });
    }
}
