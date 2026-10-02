import { z } from 'zod';
import { UserRoleSchema } from './authSchemas';

export const PublicUserSchema = z.object({
    id: z.number().int().positive().optional(),
    public_id: z.string().uuid(),
    email: z.string().email(),
    full_name: z.string(),
    cpf_cnpj: z.string().nullable().optional(),
    crc: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    zipcode: z.string().nullable().optional(),
    street: z.string().nullable().optional(),
    number: z.string().nullable().optional(),
    complement: z.string().nullable().optional(),
    neighborhood: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    default_page: z.string().nullable().optional(),
    photo_base64: z.string().nullable().optional(),
    photo_filename: z.string().nullable().optional(),
    cnpj_document_url: z.string().nullable().optional(),
    whatsapp_auto_reply_mode: z.enum(['automatic', 'manual']).nullable().optional(),
    whatsapp_enable_manual_billing: z.boolean().or(z.number().transform(val => Boolean(val))).nullable().optional(),
    whatsapp_auto_send_boleto: z.boolean().or(z.number().transform(val => Boolean(val))).nullable().optional(),
    default_bank_account_public_id: z.string().nullable().optional(),
    is_default_declaration_signer: z.boolean().or(z.number().transform(val => Boolean(val))).nullable().optional(),
    role: UserRoleSchema,
    is_active: z.boolean().or(z.number().transform(val => Boolean(val))),
    is_deletable: z.boolean().or(z.number().transform(val => Boolean(val))).optional(),
    created_at: z.date().optional().or(z.string().optional())
});

export const PublicUserListSchema = z.array(PublicUserSchema);

export const ScopedUserSchema = z.object({
    id: z.number().int().positive(),
    public_id: z.string().uuid(),
    company_id: z.number().int().positive(),
    email: z.string().email(),
    full_name: z.string(),
    default_page: z.string().nullable().optional(),
    whatsapp_auto_reply_mode: z.enum(['automatic', 'manual']).nullable().optional(),
    whatsapp_enable_manual_billing: z.boolean().or(z.number().transform(val => Boolean(val))).nullable().optional(),
    whatsapp_auto_send_boleto: z.boolean().or(z.number().transform(val => Boolean(val))).nullable().optional(),
    default_bank_account_public_id: z.string().nullable().optional(),
    role: UserRoleSchema,
    is_active: z.boolean().or(z.number().transform(val => Boolean(val))),
}).passthrough();

