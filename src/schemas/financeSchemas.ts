import { z } from 'zod';

export const CategoryTypeSchema = z.object({
    id: z.union([z.number(), z.string()]).optional().nullable(),
    public_id: z.string().optional().nullable(),
    company_id: z.union([z.number(), z.string()]).optional().nullable(),
    name: z.string().nullable().optional().transform(val => val || ''),
    description: z.string().nullable().optional(),
    created_at: z.date().optional().or(z.string().optional()).nullable(),
    updated_at: z.date().optional().or(z.string().optional()).nullable()
}).passthrough();

export const CategoryTypeListSchema = z.array(CategoryTypeSchema);

export const CategorySchema = z.object({
    id: z.union([z.number(), z.string()]).optional().nullable(),
    public_id: z.string().optional().nullable(),
    company_id: z.union([z.number(), z.string()]).optional().nullable(),
    name: z.string().nullable().optional().transform(val => val || ''),
    type: z.string().nullable().optional(),
    finance_category_type_id: z.union([z.number(), z.string()]).nullable().optional(),
    finance_category_type_public_id: z.string().nullable().optional(),
    finance_category_type_name: z.string().nullable().optional(),
    created_at: z.date().optional().or(z.string().optional()).nullable(),
    updated_at: z.date().optional().or(z.string().optional()).nullable()
}).passthrough();

export const TransactionSchema = z.object({
    id: z.union([z.number(), z.string()]).optional().nullable(),
    public_id: z.string().optional().nullable(),
    company_id: z.union([z.number(), z.string()]).optional().nullable(),
    bank_account_id: z.union([z.number(), z.string()]).optional().nullable(),
    category_id: z.union([z.number(), z.string()]).optional().nullable(),
    customer_id: z.union([z.number(), z.string()]).nullable().optional(),
    supplier_id: z.union([z.number(), z.string()]).nullable().optional(),
    contact_id: z.union([z.number(), z.string()]).nullable().optional(),
    related_user_id: z.union([z.number(), z.string()]).nullable().optional(),
    entity_name: z.string().nullable().optional(),
    entity_public_id: z.string().nullable().optional(),
    entity_type: z.string().nullable().optional(),
    customer_group_name: z.string().nullable().optional(),
    customer_group_public_id: z.string().nullable().optional(),
    customer_only_solidcon_baixa: z.union([z.number(), z.boolean(), z.string()]).optional().nullable().transform(val => typeof val === 'boolean' ? (val ? 1 : 0) : Number(val || 0)),
    customer_exempt_interest_fine: z.union([z.number(), z.boolean(), z.string()]).optional().nullable().transform(val => typeof val === 'boolean' ? (val ? 1 : 0) : Number(val || 0)),
    customer_hide_in_revenues_grid: z.union([z.number(), z.boolean(), z.string()]).optional().nullable().transform(val => typeof val === 'boolean' ? (val ? 1 : 0) : Number(val || 0)),
    customer_only_pix: z.union([z.number(), z.boolean(), z.string()]).optional().nullable().transform(val => typeof val === 'boolean' ? (val ? 1 : 0) : Number(val || 0)),
    finance_category_type_name: z.string().nullable().optional(),
    entity_cnpj_cpf: z.string().nullable().optional(),
    entity_phone: z.string().nullable().optional(),
    cost_center_public_id: z.string().nullable().optional(),
    cost_center_name: z.string().nullable().optional(),
    user_id: z.union([z.number(), z.string()]).nullable().optional(),
    description: z.string().nullable().optional().transform(val => val || ''),
    nsn: z.string().nullable().optional(),
    amount: z.union([z.string(), z.number()]).optional().nullable().transform(val => Number(val || 0)),
    original_amount: z.union([z.string(), z.number()]).nullable().optional().transform(val => val !== null && val !== undefined ? Number(val) : null),
    fine: z.union([z.string(), z.number()]).optional().nullable().transform(val => Number(val || 0)),
    interest: z.union([z.string(), z.number()]).optional().nullable().transform(val => Number(val || 0)),
    net_amount: z.union([z.string(), z.number()]).optional().nullable().transform(val => Number(val || 0)),
    type: z.string().nullable().optional(),
    payment_method: z.string().nullable().optional(),
    card_brand_id: z.union([z.number(), z.string()]).nullable().optional(),
    card_brand_public_id: z.string().nullable().optional(),
    card_brand_name: z.string().nullable().optional(),
    card_configuration_id: z.union([z.number(), z.string()]).nullable().optional(),
    card_configuration_public_id: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    date: z.union([z.string(), z.date()]).nullable().optional(),
    received_at: z.union([z.string(), z.date()]).nullable().optional(),
    received_channel: z.string().nullable().optional(),
    scheduled_at: z.union([z.string(), z.date()]).nullable().optional(),
    barcode: z.string().nullable().optional(),
    pix_code: z.string().nullable().optional(),
    pix_key: z.string().nullable().optional(),
    billet_url: z.string().nullable().optional(),
    pdv: z.string().nullable().optional(),
    cdfilial: z.string().nullable().optional(),
    solidcon_quitado: z.union([z.number(), z.boolean(), z.string()]).optional().nullable().transform(val => typeof val === 'boolean' ? (val ? 1 : 0) : Number(val || 0)),
    solidcon_key: z.string().nullable().optional(),
    solidcon_interest_key: z.string().nullable().optional(),
    whatsapp_sent: z.union([z.number(), z.boolean(), z.string()]).optional().nullable().transform(val => typeof val === 'boolean' ? (val ? 1 : 0) : Number(val || 0)),
    created_at: z.union([z.string(), z.date()]).nullable().optional(),
    updated_at: z.union([z.string(), z.date()]).nullable().optional(),
    is_reconciled: z.union([z.number(), z.boolean(), z.string()]).optional().nullable().transform(val => Boolean(val))
}).passthrough();

export const CategoryListSchema = z.array(CategorySchema);
export const TransactionListSchema = z.array(TransactionSchema);
