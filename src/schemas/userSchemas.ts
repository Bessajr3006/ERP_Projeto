import { z } from 'zod';
import { UserRoleSchema } from './authSchemas';

export const PublicUserSchema = z.object({
    public_id: z.string().uuid(),
    email: z.string().email(),
    full_name: z.string(),
    cpf_cnpj: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    zipcode: z.string().nullable().optional(),
    street: z.string().nullable().optional(),
    number: z.string().nullable().optional(),
    complement: z.string().nullable().optional(),
    neighborhood: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    default_page: z.string().nullable().optional(),
    whatsapp_auto_reply_mode: z.enum(['automatic', 'manual']).nullable().optional(),
    role: UserRoleSchema,
    is_active: z.boolean().or(z.number().transform(val => Boolean(val))),
    is_deletable: z.boolean().or(z.number().transform(val => Boolean(val))).optional(),
    created_at: z.date().optional().or(z.string().optional())
}).passthrough();

export const PublicUserListSchema = z.array(PublicUserSchema);

export const ScopedUserSchema = z.object({
    id: z.number().int().positive(),
    public_id: z.string().uuid(),
    company_id: z.number().int().positive(),
    email: z.string().email(),
    full_name: z.string(),
    default_page: z.string().nullable().optional(),
    whatsapp_auto_reply_mode: z.enum(['automatic', 'manual']).nullable().optional(),
    role: UserRoleSchema,
    is_active: z.boolean().or(z.number().transform(val => Boolean(val))),
}).passthrough();

