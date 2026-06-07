import { z } from 'zod';

export const UserRoleSchema = z.string().trim().min(1).max(80).regex(/^[a-z0-9_]+$/);

export const UserPayloadSchema = z.object({
    id: z.string(),
    role: UserRoleSchema,
    company_id: z.number().int().positive(),
    iat: z.number().optional(),
    exp: z.number().optional()
}).passthrough(); // Permite outras propriedades do JwtPayload (como iss, aud, etc)

export const DatabaseUserSchema = z.object({
    id: z.number().int().positive(),
    public_id: z.string().uuid(),
    company_id: z.number().int().positive(),
    email: z.string().email(),
    password_hash: z.string(),
    full_name: z.string(),
    role: UserRoleSchema,
    is_active: z.boolean().or(z.number().transform(val => Boolean(val))),
    created_at: z.date().nullable().optional().or(z.string().nullable().optional()),
    updated_at: z.date().nullable().optional().or(z.string().nullable().optional()),
}).passthrough();
