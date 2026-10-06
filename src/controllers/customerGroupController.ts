import { Request, Response } from 'express';
import { z } from 'zod';
import { CustomerGroupService } from '../services/customerGroupService';
import { AppError } from '../errors/AppError';

import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';

const createCustomerGroupSchema = z.object({
    name: z.string().trim().min(1, 'Nome é obrigatório').max(150, 'Nome muito longo')
});

const updateCustomerGroupSchema = z.object({
    name: z.string().trim().min(1, 'Nome não pode ser vazio').max(150, 'Nome muito longo').optional()
});

export class CustomerGroupController {
    static async create(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const validatedData = createCustomerGroupSchema.parse(req.body);

        const result = await CustomerGroupService.create(companyId, validatedData);

        return res.status(201).json({
            status: 'success',
            data: result
        });
    }

    static async list(req: Request, res: Response): Promise<any> {
        const userCompanyId = req.user!.company_id;
        const [generalAdminRows] = await pool.query<RowDataPacket[]>(
            'SELECT is_general_admin FROM companies WHERE id = ? LIMIT 1',
            [userCompanyId]
        );
        const isGeneralAdmin = req.user?.role === 'super_admin' || 
                               Boolean(generalAdminRows?.[0]?.is_general_admin === 1 || generalAdminRows?.[0]?.is_general_admin === true);

        let targetCompanyIds: number | number[] = userCompanyId;

        if (isGeneralAdmin) {
            const [allComps] = await pool.query<RowDataPacket[]>('SELECT id FROM companies');
            targetCompanyIds = allComps.map(c => c.id);
        } else {
            // When NOT ADM Geral: strictly only the selected company
            targetCompanyIds = userCompanyId;
        }

        const result = await CustomerGroupService.listByCompany(targetCompanyIds);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async getByPublicId(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        const result = await CustomerGroupService.getByPublicId(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            data: result
        });
    }

    static async update(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;
        const validatedData = updateCustomerGroupSchema.parse(req.body);

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        const result = await CustomerGroupService.update(publicId, companyId, validatedData);

        return res.status(200).json({
            status: 'success',
            message: 'Grupo de cliente atualizado com sucesso',
            data: result
        });
    }

    static async delete(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const publicId = req.params.id;

        if (!publicId) {
            throw new AppError('Public ID is required', 400);
        }

        await CustomerGroupService.delete(publicId, companyId);

        return res.status(200).json({
            status: 'success',
            message: 'Grupo de cliente excluído com sucesso'
        });
    }
}
