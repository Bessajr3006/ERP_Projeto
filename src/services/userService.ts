import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { UserRole } from '../types/User';
import { AppError } from '../errors/AppError';
import { PublicUserSchema, PublicUserListSchema, ScopedUserSchema } from '../schemas/userSchemas';
import { UserRepository } from '../repositories/userRepository';
import { StorageService } from '../utils/storageService';
import pool from '../config/db';

async function resolveBankAccountId(companyId: number, bankAccountPublicId: string | null | undefined): Promise<number | null> {
    if (!bankAccountPublicId) return null;
    const [rows]: any = await pool.query(
        'SELECT id FROM bank_accounts WHERE public_id = ? AND company_id = ? LIMIT 1',
        [bankAccountPublicId, companyId]
    );
    return rows.length > 0 ? rows[0].id : null;
}

const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '10', 10);
const USER_PROFILE_FIELDS = ['cpf_cnpj', 'crc', 'phone', 'zipcode', 'street', 'number', 'complement', 'neighborhood', 'city', 'state', 'default_page', 'photo_base64', 'photo_filename', 'cnpj_document_url', 'face_descriptor'] as const;
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

function processUserCnpjDocuments(data: any, currentCnpjDocumentUrl?: string | null): string | null {
    const parseCnpjDocuments = (val: any): { name: string; url: string; attachedAt?: string }[] => {
        if (!val) return [];
        let list: any[] = [];
        if (Array.isArray(val)) {
            list = val;
        } else {
            try {
                if (typeof val === 'string' && val.trim().startsWith('[')) {
                    list = JSON.parse(val);
                } else if (typeof val === 'string' && val.trim() !== '') {
                    list = [val];
                }
            } catch (e) {}
        }
        return list.map(item => {
            if (typeof item === 'string') {
                const fileName = item.substring(item.lastIndexOf('/') + 1);
                return { name: fileName, url: item, attachedAt: new Date(2026, 0, 1).toISOString() };
            }
            if (item && typeof item === 'object' && item.url) {
                return {
                    name: item.name || item.url.substring(item.url.lastIndexOf('/') + 1),
                    url: item.url,
                    attachedAt: item.attachedAt || new Date().toISOString()
                };
            }
            return null;
        }).filter(Boolean) as { name: string; url: string; attachedAt: string }[];
    };

    const targetDocs = data.cnpj_document_url !== undefined ? parseCnpjDocuments(data.cnpj_document_url) : parseCnpjDocuments(currentCnpjDocumentUrl);

    // If some documents were deleted (compared to current), delete their files.
    if (currentCnpjDocumentUrl && data.cnpj_document_url !== undefined) {
        const currentDocs = parseCnpjDocuments(currentCnpjDocumentUrl);
        const targetUrls = new Set(targetDocs.map(d => d.url));
        for (const doc of currentDocs) {
            if (!targetUrls.has(doc.url)) {
                StorageService.delete(doc.url);
            }
        }
    }

    if (data.cnpj_document_uploads && Array.isArray(data.cnpj_document_uploads)) {
        for (const upload of data.cnpj_document_uploads) {
            if (upload && upload.base64) {
                const saved = StorageService.saveBase64('documents', upload.base64, upload.filename);
                if (saved) {
                    const displayName = upload.name || saved.filename || saved.url.substring(saved.url.lastIndexOf('/') + 1);
                    targetDocs.push({
                        name: displayName,
                        url: saved.url,
                        attachedAt: upload.attachedAt || new Date().toISOString()
                    });
                }
            }
        }
    }

    return targetDocs.length > 0 ? JSON.stringify(targetDocs) : null;
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

    static async getAllByRole(companyId: number, role: string) {
        const rows = await UserRepository.getAllByRole(companyId, role);
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
        profile.cnpj_document_url = processUserCnpjDocuments(data, null);
        const whatsappAutoReplyMode = normalizeWhatsAppAutoReplyMode(data.whatsapp_auto_reply_mode) || 'automatic';
        const whatsappEnableManualBilling = data.whatsapp_enable_manual_billing !== undefined ? (data.whatsapp_enable_manual_billing ? 1 : 0) : 1;
        const whatsappAutoSendBoleto = data.whatsapp_auto_send_boleto !== undefined ? (data.whatsapp_auto_send_boleto ? 1 : 0) : 0;

        // Check if email is already in use
        const existing = await UserRepository.getByEmail(email);
        if (existing.length > 0) throw new AppError('Email already in use', 409);

        const publicId = randomUUID();
        const passwordHash = await bcrypt.hash(passwordRaw || '12345678', SALT_ROUNDS); // Default password if none provided, though validation should catch it

        const defaultBankAccountId = data.default_bank_account_public_id
            ? await resolveBankAccountId(companyId, data.default_bank_account_public_id)
            : null;

        const isDefaultDeclarationSigner = data.is_default_declaration_signer ? 1 : 0;
        if (isDefaultDeclarationSigner && companyId) {
            if (role === 'socio') {
                await pool.query('UPDATE users SET is_default_declaration_signer = 0 WHERE company_id = ? AND role = ?', [companyId, 'socio']);
            } else if (role === 'accountant' || role === 'auxiliar_contador') {
                await pool.query('UPDATE users SET is_default_declaration_signer = 0 WHERE company_id = ? AND role IN (?, ?)', [companyId, 'accountant', 'auxiliar_contador']);
            } else {
                await pool.query('UPDATE users SET is_default_declaration_signer = 0 WHERE company_id = ? AND role = ?', [companyId, role]);
            }
        }

        const columns = [
            'public_id', 'company_id', 'email', 'password_hash', 'raw_password', 'full_name',
            'cpf_cnpj', 'crc', 'phone', 'zipcode', 'street', 'number', 'complement', 'neighborhood', 'city', 'state', 'default_page', 'whatsapp_auto_reply_mode', 'whatsapp_enable_manual_billing', 'whatsapp_auto_send_boleto',
            'role', 'is_active', 'photo_base64', 'photo_filename', 'cnpj_document_url', 'face_descriptor', 'default_bank_account_id', 'is_default_declaration_signer'
        ];
        const placeholders = columns.map(() => '?');
        const values = [
            publicId,
            companyId,
            email,
            passwordHash,
            passwordRaw || null,
            full_name,
            profile.cpf_cnpj,
            profile.crc,
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
            whatsappEnableManualBilling,
            whatsappAutoSendBoleto,
            role,
            is_active,
            profile.photo_base64,
            profile.photo_filename,
            profile.cnpj_document_url,
            profile.face_descriptor,
            defaultBankAccountId,
            isDefaultDeclarationSigner
        ];

        await UserRepository.create(columns, placeholders, values);

        return { public_id: publicId, email, full_name, role, is_active, is_default_declaration_signer: isDefaultDeclarationSigner, whatsapp_auto_reply_mode: whatsappAutoReplyMode, whatsapp_enable_manual_billing: whatsappEnableManualBilling, whatsapp_auto_send_boleto: whatsappAutoSendBoleto, password: passwordRaw, default_bank_account_public_id: data.default_bank_account_public_id, ...profile };
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
        const currentUser = await this.getById(companyId, publicId);

        const updates: string[] = [];
        const values: any[] = [];
        const typedData = data as Record<string, unknown>;

        if (hasOwnProperty(typedData, 'cnpj_document_url') || hasOwnProperty(typedData, 'cnpj_document_uploads')) {
            const newCnpjDocUrl = processUserCnpjDocuments(typedData, currentUser.cnpj_document_url);
            typedData.cnpj_document_url = newCnpjDocUrl;
        }
        
        if (hasOwnProperty(typedData, 'full_name') && typedData.full_name !== undefined) {
            updates.push('full_name = ?');
            values.push(String(typedData.full_name).trim());
        }
        if (typedData.passwordRaw) {
            const passwordHash = await bcrypt.hash(String(typedData.passwordRaw), SALT_ROUNDS);
            updates.push('password_hash = ?');
            values.push(passwordHash);
            updates.push('raw_password = ?');
            values.push(String(typedData.passwordRaw));
        }
        if (hasOwnProperty(typedData, 'role') && typedData.role !== undefined) {
            updates.push('role = ?');
            values.push(typedData.role as UserRole);
        }
        if (hasOwnProperty(typedData, 'email') && typedData.email !== undefined) {
            const newEmail = String(typedData.email).trim();
            const existing = await UserRepository.getFullByEmail(newEmail);
            const firstMatch = existing[0];
            if (firstMatch && firstMatch.public_id !== publicId) {
                throw new AppError('Email already in use', 409);
            }
            updates.push('email = ?');
            values.push(newEmail);
        }
        if (hasOwnProperty(typedData, 'is_active') && typedData.is_active !== undefined) {
            updates.push('is_active = ?');
            values.push(Boolean(typedData.is_active));
        }

        if (hasOwnProperty(typedData, 'is_default_declaration_signer') && typedData.is_default_declaration_signer !== undefined) {
            const isDef = typedData.is_default_declaration_signer ? 1 : 0;
            if (isDef && companyId) {
                const targetRole = (typedData.role as string) || currentUser.role;
                if (targetRole === 'socio') {
                    await pool.query('UPDATE users SET is_default_declaration_signer = 0 WHERE company_id = ? AND role = ?', [companyId, 'socio']);
                } else if (targetRole === 'accountant' || targetRole === 'auxiliar_contador') {
                    await pool.query('UPDATE users SET is_default_declaration_signer = 0 WHERE company_id = ? AND role IN (?, ?)', [companyId, 'accountant', 'auxiliar_contador']);
                } else {
                    await pool.query('UPDATE users SET is_default_declaration_signer = 0 WHERE company_id = ? AND role = ?', [companyId, targetRole]);
                }
            }
            updates.push('is_default_declaration_signer = ?');
            values.push(isDef);
        }

        if (hasOwnProperty(typedData, 'whatsapp_auto_reply_mode') && typedData.whatsapp_auto_reply_mode !== undefined) {
            updates.push('whatsapp_auto_reply_mode = ?');
            values.push(normalizeWhatsAppAutoReplyMode(typedData.whatsapp_auto_reply_mode) || 'automatic');
        }

        if (hasOwnProperty(typedData, 'whatsapp_enable_manual_billing') && typedData.whatsapp_enable_manual_billing !== undefined) {
            updates.push('whatsapp_enable_manual_billing = ?');
            values.push(typedData.whatsapp_enable_manual_billing ? 1 : 0);
        }

        if (hasOwnProperty(typedData, 'whatsapp_auto_send_boleto') && typedData.whatsapp_auto_send_boleto !== undefined) {
            updates.push('whatsapp_auto_send_boleto = ?');
            values.push(typedData.whatsapp_auto_send_boleto ? 1 : 0);
        }

        if (hasOwnProperty(typedData, 'default_bank_account_public_id')) {
            const defaultBankAccountId = typedData.default_bank_account_public_id
                ? await resolveBankAccountId(companyId, String(typedData.default_bank_account_public_id))
                : null;
            updates.push('default_bank_account_id = ?');
            values.push(defaultBankAccountId);
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
