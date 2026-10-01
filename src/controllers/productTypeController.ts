import { Request, Response } from 'express';
import { z } from 'zod';
import { ProductTypeService } from '../services/productTypeService';

const createProductTypeSchema = z.object({
    name: z.string().min(1, 'Name is required').max(150, 'Name cannot exceed 150 characters'),
    description: z.string().nullable().optional(),
    idprodutotipopos: z.string().nullable().optional(),
});

const updateProductTypeSchema = z.object({
    name: z.string().min(1, 'Name is required').max(150, 'Name cannot exceed 150 characters').optional(),
    description: z.string().nullable().optional(),
    idprodutotipopos: z.string().nullable().optional(),
});

export class ProductTypeController {
    static async create(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const validated = createProductTypeSchema.parse(req.body);
            const productType = await ProductTypeService.create(companyId, {
                name: validated.name,
                description: validated.description !== undefined ? validated.description : null,
                idprodutotipopos: validated.idprodutotipopos !== undefined ? validated.idprodutotipopos : null,
            });
            res.status(201).json({ status: 'success', data: productType });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ status: 'error', errors: error.errors });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async list(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const productTypes = await ProductTypeService.list(companyId);
            res.status(200).json({ status: 'success', data: productTypes });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async getByPublicId(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;
            const productType = await ProductTypeService.getByPublicId(id, companyId);
            res.status(200).json({ status: 'success', data: productType });
        } catch (error: any) {
            if (error.message === 'ProductType not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async update(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;
            const validated = updateProductTypeSchema.parse(req.body);
            
            const updateData: any = {};
            if (validated.name !== undefined) updateData.name = validated.name;
            if (validated.description !== undefined) updateData.description = validated.description;
            if (validated.idprodutotipopos !== undefined) updateData.idprodutotipopos = validated.idprodutotipopos;

            const productType = await ProductTypeService.update(id, companyId, updateData);
            res.status(200).json({ status: 'success', data: productType });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ status: 'error', errors: error.errors });
                return;
            }
            if (error.message === 'ProductType not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async delete(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const id = req.params.id as string;
            await ProductTypeService.delete(id, companyId);
            res.status(200).json({ status: 'success', message: 'Product type deleted' });
        } catch (error: any) {
            if (error.message === 'ProductType not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }
}
