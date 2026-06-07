import { Request, Response } from 'express';
import { z } from 'zod';
import { PurchaseService } from '../services/purchaseService';
import { UserPayload } from '../types/express';

const itemSchema = z.object({
    product_public_id: z.string().uuid('Invalid product ID'),
    quantity: z.coerce.number().positive(),
    unit_price: z.coerce.number().min(0)
});

const createPurchaseSchema = z.object({
    supplier_public_id: z.string().uuid('Invalid supplier ID'),
    bank_account_public_id: z.string().uuid('Invalid bank account ID'),
    category_public_id: z.string().uuid('Invalid category ID'),
    date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
    items: z.array(itemSchema).min(1, 'Order must contain at least one item')
});

export class PurchaseController {

    static async getAll(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
            const purchases = await PurchaseService.getRecentPurchases(user.company_id, limit);
            res.json({ status: 'success', data: purchases });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    }

    static async create(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as UserPayload;
            const validatedData = createPurchaseSchema.parse(req.body);

            const order = await PurchaseService.createPurchaseOrder(user.company_id, String(user.id), validatedData);

            res.status(201).json({ status: 'success', data: order });
        } catch (error: any) {
            if (error instanceof z.ZodError) { res.status(400).json({ status: 'error', errors: error.errors }); return; }
            if (error instanceof Error) {
                if (error.message.includes('not found') || error.message.includes('Insufficient stock') || error.message.includes('User context')) {
                    res.status(400).json({ status: 'error', message: error.message });
                    return;
                }
            }
            res.status(500).json({ status: 'error', message: 'Internal Server Error' });
        }
    }

    static async getById(req: Request, res: Response): Promise<void> {
        const user = req.user as UserPayload;
        const result = await PurchaseService.getPurchaseById(req.params.id as string, user.company_id);
        res.json({ status: 'success', data: result });
    }

    static async delete(req: Request, res: Response): Promise<void> {
        const user = req.user as UserPayload;
        await PurchaseService.cancelPurchaseOrder(req.params.id as string, user.company_id);
        res.json({ status: 'success', message: 'Compra cancelada e transações revertidas.' });
    }
}
