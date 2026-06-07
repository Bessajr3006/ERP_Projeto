import { Request, Response } from 'express';
import { z } from 'zod';
import { ProductService } from '../services/productService';

const createProductSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    description: z.string().optional(),
    sku: z.string().optional(),
    ean: z.string().max(100, 'EAN/Barcode cannot exceed 100 characters').optional(),
    external_code: z.string().optional(),
    is_imported: z.boolean().optional(),
    ncm: z.string().max(8, 'NCM cannot exceed 8 characters').optional(),
    cest: z.string().max(7, 'CEST cannot exceed 7 characters').optional(),
    cost_price: z.number().min(0).optional(),
    selling_price: z.number().min(0).optional(),
    initial_stock: z.number().min(0).optional(),
    min_stock: z.number().min(0).optional(),
    max_stock: z.number().min(0).optional(),
    category_id: z.number().nullable().optional(),
    stock_type_id: z.number().nullable().optional(),
    manufacturer_id: z.number().nullable().optional(),
    tax_rule_id: z.number().nullable().optional(),
    measure_id: z.number().nullable().optional(),
    image_base64: z.string().nullable().optional(),
    image_url: z.string().nullable().optional(),
});

const bulkUpdateSchema = z.object({
    productIds: z.array(z.string()).min(1, 'At least one product is required'),
    category_id: z.number().nullable().optional(),
    stock_type_id: z.number().nullable().optional(),
    manufacturer_id: z.number().nullable().optional(),
    tax_rule_id: z.number().nullable().optional(),
    measure_id: z.number().nullable().optional(),
    selling_price: z.number().min(0).optional(),
    cost_price: z.number().min(0).optional(),
    min_stock: z.number().min(0).optional(),
    max_stock: z.number().min(0).optional(),
});

export class ProductController {

    static async create(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const validatedData = createProductSchema.parse(req.body);

            const product = await ProductService.create(companyId, validatedData);

            res.status(201).json({
                status: 'success',
                data: product
            });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ status: 'error', errors: error.errors });
                return;
            }

            if (error instanceof Error && error.message.includes('SKU already registered')) {
                res.status(409).json({ status: 'error', message: error.message });
                return;
            }

            throw error;
        }
    }

    static async list(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const products = await ProductService.listByCompany(companyId);

            res.status(200).json({
                status: 'success',
                data: products
            });
        } catch (error) {
            throw error;
        }
    }

    static async getByPublicId(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const companyId = req.user!.company_id;

            if (!id) {
                res.status(400).json({ status: 'error', message: 'Missing product ID' });
                return;
            }

            const product = await ProductService.getByPublicId(id, companyId);

            res.status(200).json({
                status: 'success',
                data: product
            });
        } catch (error: any) {
            if (error instanceof Error && error.message === 'Product not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async update(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id as string;
            if (!id) {
                res.status(400).json({ status: 'error', message: 'Missing product ID' });
                return;
            }

            const companyId = req.user!.company_id;

            // Re-use create schema but as partial for updates
            const updateProductSchema = createProductSchema.partial();
            const validatedData = updateProductSchema.parse(req.body);

            const product = await ProductService.update(id, companyId, validatedData as any);

            res.status(200).json({
                status: 'success',
                data: product
            });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ status: 'error', errors: error.errors });
                return;
            }
            if (error instanceof Error && error.message.includes('SKU already registered')) {
                res.status(409).json({ status: 'error', message: error.message });
                return;
            }
            if (error instanceof Error && error.message === 'Product not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            throw error;
        }
    }

    static async delete(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id as string;
            if (!id) {
                res.status(400).json({ status: 'error', message: 'Missing product ID' });
                return;
            }

            const companyId = req.user!.company_id;

            await ProductService.delete(id, companyId);

            // 204 No Content
            res.status(204).send();
        } catch (error: any) {
            if (error instanceof Error && error.message === 'Product not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            // For foreign key errors (e.g. if a product is on an order)
            if (error?.code === 'ER_ROW_IS_REFERENCED_2') {
                res.status(409).json({ status: 'error', message: 'Não é possível excluir um produto que já possui movimentações ou pedidos atrelados.' });
                return;
            }
            throw error;
        }
    }

    static async bulkUpdate(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const validatedData = bulkUpdateSchema.parse(req.body);

            const updatedCount = await ProductService.bulkUpdate(companyId, validatedData);

            res.status(200).json({
                status: 'success',
                message: `${updatedCount} produtos atualizados com sucesso`,
                data: { count: updatedCount }
            });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ status: 'error', errors: error.errors });
                return;
            }
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async importSolidcon(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const payload = req.body?.payload ?? req.body?.items ?? req.body?.data ?? req.body;

            const normalizeItems = (value: any, depth = 0): any[] => {
                if (depth > 4) return [];
                if (Array.isArray(value)) return value;
                if (typeof value === 'string') {
                    try {
                        return normalizeItems(JSON.parse(value), depth + 1);
                    } catch {
                        return [];
                    }
                }
                const containers = ['body', 'items', 'data', 'products', 'produtos', 'registros', 'resultado', 'results', 'rows'];
                for (const key of containers) {
                    if (value?.[key] !== undefined && value?.[key] !== null) {
                        const nestedItems = normalizeItems(value[key], depth + 1);
                        if (nestedItems.length) return nestedItems;
                    }
                }
                return [];
            };

            const items = normalizeItems(payload);
            if (!items.length) {
                res.status(400).json({ status: 'error', message: 'Nenhum item valido encontrado para importacao.' });
                return;
            }

            const result = await ProductService.importSolidcon(companyId, items);

            res.status(200).json({
                status: 'success',
                data: result
            });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error?.message || 'Internal Server Error' });
        }
    }
}
