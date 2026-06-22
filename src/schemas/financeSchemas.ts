import { z } from 'zod';

export const CategoryTypeSchema = z.object({
    id: z.number().int().positive(),
    public_id: z.string().uuid(),
    company_id: z.number().int().positive(),
    name: z.string(),
    description: z.string().nullable().optional(),
    created_at: z.date().optional().or(z.string().optional()),
    updated_at: z.date().optional().or(z.string().optional())
}).passthrough();

export const CategoryTypeListSchema = z.array(CategoryTypeSchema);

export const CategorySchema = z.object({
    id: z.number().int().positive(),
    public_id: z.string().uuid(),
    company_id: z.number().int().positive(),
    name: z.string(),
    type: z.enum(['income', 'expense']),
    finance_category_type_id: z.number().nullable().optional(),
    finance_category_type_public_id: z.string().uuid().nullable().optional(),
    finance_category_type_name: z.string().nullable().optional(),
    created_at: z.date().optional().or(z.string().optional()),
    updated_at: z.date().optional().or(z.string().optional())
}).passthrough();

export const TransactionSchema = z.object({
    id: z.number().int().positive(),
    public_id: z.string().uuid(),
    company_id: z.number().int().positive(),
    bank_account_id: z.number().int().positive(),
    category_id: z.number().int().positive(),
    customer_id: z.number().nullable().optional(),
    supplier_id: z.number().nullable().optional(),
    contact_id: z.number().nullable().optional(),
    related_user_id: z.number().nullable().optional(),
    entity_name: z.string().nullable().optional(),
    entity_public_id: z.string().nullable().optional(),
    entity_type: z.string().nullable().optional(),
    user_id: z.number().nullable().optional(),
    description: z.string(),
    nsn: z.string().nullable().optional(),
    amount: z.string().or(z.number()).transform(val => Number(val)),
    type: z.enum(['income', 'expense']),
    payment_method: z.string().nullable().optional(),
    status: z.enum(['paid', 'progress', 'pending', 'cancelled']).optional(),
    date: z.union([z.string(), z.date()]),
    received_at: z.union([z.string(), z.date()]).nullable().optional(),
    barcode: z.string().nullable().optional(),
    pix_code: z.string().nullable().optional(),
    billet_url: z.string().nullable().optional(),
    created_at: z.union([z.string(), z.date()]).optional(),
    updated_at: z.union([z.string(), z.date()]).optional()
}).passthrough();

export const CategoryListSchema = z.array(CategorySchema);
export const TransactionListSchema = z.array(TransactionSchema);
