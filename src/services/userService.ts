import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { UserRole } from '../types/User';
import { AppError } from '../errors/AppError';
import { PublicUserSchema, PublicUserListSchema, ScopedUserSchema } from '../schemas/userSchemas';
import { UserRepository } from '../repositories/userRepository';

const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '10', 10);
const USER_PROFILE_FIELDS = ['cpf_cnpj', 'phone', 'zipcode', 'street', 'number', 'complement', 'neighborhood', 'city', 'state', 'default_page'] as const;
const WHATSAPP_AUTO_REPLY_MODES = ['automatic', 'manual'] as const;

type UserProfileField = typeof USER_PROFILE_FIELDS[number];

function normalizeNullableText(value: unknown): string | null {
    if (value === undefined || value === null) {
        return null;
    }

    const normalized = String(value).trim();
    return normalized === '' ? null : normalized;
}

function normalizeWhatsAppAutoReplyMode(value: unknown): 'automatic' | 'manual' | null {
    if (value === undefined || value === null) {
        return null;
    }

    const normalized = String(value).trim().toLowerCase();
    if (!normalized) {
        return null;
    }

    return WHATSAPP_AUTO_REPLY_MODES.includes(normalized as (typeof WHATSAPP_AUTO_REPLY_MODES)[number])
        ? normalized as 'automatic' | 'manual'
        : 'automatic';
}

function hasOwnProperty(data: Record<string, unknown>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(data, key);
}

function buildUserProfilePayload(data: Record<string, unknown>): Record<UserProfileField, string | null> {
    return USER_PROFILE_FIELDS.reduce((acc, field) => {
        acc[field] = normalizeNullableText(data[field]);
        return acc;
    }, {} as Record<UserProfileField, string | null>);
}

export class UserService {
    private static async resolveTargetPublicId(companyId: number, identifier: string): Promise<string> {
        const publicId = await UserRepository.resolvePublicIdByIdentifier(companyId, identifier);
        if (!publicId) {
            throw new AppError('Usuário não encontrado', 404);
        }
        return publicId;
    }

    static async getAllByCompany(companyId: number) {
        const rows = await UserRepository.getAllByCompany(companyId);
        return PublicUserListSchema.parse(rows);
    }

    static async getById(companyId: number, identifier: string) {
        const publicId = await this.resolveTargetPublicId(companyId, identifier);
        const rows = await UserRepository.getById(companyId, publicId);
        if (rows.length === 0) throw new AppError('Usuário não encontrado', 404);
        return PublicUserSchema.parse(rows[0]);
    }

    static async getScopedUser(companyId: number, identifier: string) {
        const publicId = await this.resolveTargetPublicId(companyId, identifier);
        const rows = await UserRepository.getScoped(companyId, publicId);
        if (rows.length === 0) throw new AppError('Usuário não encontrado', 404);
        return ScopedUserSchema.parse(rows[0]);
    }

    static async create(companyId: number, data: any) {
        const { email, full_name, passwordRaw, role = 'user', is_active = true } = data;
        const profile = buildUserProfilePayload(data);
        const whatsappAutoReplyMode = normalizeWhatsAppAutoReplyMode(data.whatsapp_auto_reply_mode) || 'automatic';

        // Check if email is already in use
        const existing = await UserRepository.getByEmail(email);
        if (existing.length > 0) throw new AppError('Email already in use', 409);

        const publicId = randomUUID();
        const passwordHash = await bcrypt.hash(passwordRaw || '12345678', SALT_ROUNDS); // Default password if none provided, though validation should catch it

        const columns = [
            'public_id', 'company_id', 'email', 'password_hash', 'full_name',
            'cpf_cnpj', 'phone', 'zipcode', 'street', 'number', 'complement', 'neighborhood', 'city', 'state', 'default_page', 'whatsapp_auto_reply_mode',
            'role', 'is_active'
        ];
        const placeholders = columns.map(() => '?');
        const values = [
            publicId,
            companyId,
            email,
            passwordHash,
            full_name,
            profile.cpf_cnpj,
            profile.phone,
            profile.zipcode,
            profile.street,
            profile.number,
            profile.complement,
            profile.neighborhood,
            profile.city,
            profile.state,
            profile.default_page,
            whatsappAutoReplyMode,
            role,
            is_active,
        ];

        await UserRepository.create(columns, placeholders, values);

        return { public_id: publicId, email, full_name, role, is_active, whatsapp_auto_reply_mode: whatsappAutoReplyMode, ...profile };
    }

    static async toggleActive(companyId: number, identifier: string, isActive: boolean) {
        const publicId = await this.resolveTargetPublicId(companyId, identifier);
        const affectedRows = await UserRepository.updateByCompanyAndPublicId(
            companyId, publicId, ['is_active = ?'], [isActive]
        );
        if (affectedRows === 0) throw new Error('User not found or nothing changed');
        return true;
    }

    static async update(companyId: number, identifier: string, data: any) {
        const publicId = await this.resolveTargetPublicId(companyId, identifier);
        const updates: string[] = [];
        const values: any[] = [];
        const typedData = data as Record<string, unknown>;
        
        if (hasOwnProperty(typedData, 'full_name') && typedData.full_name !== undefined) {
            updates.push('full_name = ?');
            values.push(String(typedData.full_name).trim());
        }
        if (typedData.passwordRaw) {
            const passwordHash = await bcrypt.hash(String(typedData.passwordRaw), SALT_ROUNDS);
            updates.push('password_hash = ?');
            values.push(passwordHash);
        }
        if (hasOwnProperty(typedData, 'role') && typedData.role !== undefined) {
            updates.push('role = ?');
            values.push(typedData.role as UserRole);
        }
        if (hasOwnProperty(typedData, 'email') && typedData.email !== undefined) {
            updates.push('email = ?');
            values.push(String(typedData.email).trim());
        }
        if (hasOwnProperty(typedData, 'is_active') && typedData.is_active !== undefined) {
            updates.push('is_active = ?');
            values.push(Boolean(typedData.is_active));
        }

        if (hasOwnProperty(typedData, 'whatsapp_auto_reply_mode') && typedData.whatsapp_auto_reply_mode !== undefined) {
            updates.push('whatsapp_auto_reply_mode = ?');
            values.push(normalizeWhatsAppAutoReplyMode(typedData.whatsapp_auto_reply_mode) || 'automatic');
        }

        for (const field of USER_PROFILE_FIELDS) {
            if (hasOwnProperty(typedData, field)) {
                updates.push(`${field} = ?`);
                values.push(normalizeNullableText(typedData[field]));
            }
        }
        
        if (updates.length > 0) {
            const affectedRows = await UserRepository.updateByCompanyAndPublicId(companyId, publicId, updates, values);
            if (affectedRows === 0) throw new Error('User not found or nothing changed');
        }

        return this.getById(companyId, publicId);
    }

    static async delete(companyId: number, identifier: string) {
        const publicId = await this.resolveTargetPublicId(companyId, identifier);
        // First, check if the user is deletable
        const user = await this.getById(companyId, publicId);
        if (!user.is_deletable) {
            throw new AppError('Este usuário não pode ser excluído.', 403);
        }

        const affectedRows = await UserRepository.deleteByCompanyAndPublicId(companyId, publicId);
        if (affectedRows === 0) {
            throw new AppError('Usuário não encontrado.', 404);
        }

        return true;
    }
}
