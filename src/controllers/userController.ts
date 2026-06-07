import { Request, Response } from 'express';
import { z } from 'zod';
import { UserService } from '../services/userService';
import { CompanyService } from '../services/companyService';
import { WhatsAppBusinessService } from '../services/whatsappBusinessService';
import { WhatsAppBusinessMessageService } from '../services/whatsappBusinessMessageService';
import { AppError } from '../errors/AppError';

const optionalTrimmedString = (max: number, min = 1, message = 'Invalid value') => z.preprocess(
    (value) => {
        if (typeof value !== 'string') return value;
        const trimmed = value.trim();
        return trimmed === '' ? undefined : trimmed;
    },
    z.string().min(min, message).max(max, message).optional()
);

const optionalNullableTrimmedString = (max: number, min = 1, message = 'Invalid value') => z.preprocess(
    (value) => {
        if (value === null || value === undefined) return value;
        if (typeof value !== 'string') return value;
        const trimmed = value.trim();
        return trimmed === '' ? null : trimmed;
    },
    z.string().min(min, message).max(max, message).nullable().optional()
);

const optionalEmail = z.preprocess(
    (value) => {
        if (typeof value !== 'string') return value;
        const trimmed = value.trim();
        return trimmed === '' ? undefined : trimmed;
    },
    z.string().email('Invalid email').optional()
);

const whatsappAutoReplyModeSchema = z.enum(['automatic', 'manual']);
const roleSlugSchema = z.string().trim().min(1, 'Role is required').max(80, 'Role is too long').regex(/^[a-z0-9_]+$/, 'Invalid role');

const createUserSchema = z.object({
    email: z.string().trim().email('Invalid email format'),
    full_name: z.string().trim().min(2, 'Name must be at least 2 characters').max(150, 'Name must be at most 150 characters'),
    passwordRaw: z.string().min(6, 'Password must be at least 6 characters'),
    role: roleSlugSchema.optional().default('user'),
    is_active: z.boolean().optional(),
    cpf_cnpj: optionalTrimmedString(18),
    phone: optionalTrimmedString(20),
    zipcode: optionalTrimmedString(20),
    street: optionalTrimmedString(255),
    number: optionalTrimmedString(50),
    complement: optionalTrimmedString(150),
    neighborhood: optionalTrimmedString(100),
    city: optionalTrimmedString(100),
    state: optionalTrimmedString(50),
    default_page: optionalNullableTrimmedString(100),
    whatsapp_auto_reply_mode: whatsappAutoReplyModeSchema.optional().default('automatic'),
});

const updateUserSchema = z.object({
    full_name: optionalTrimmedString(150, 2, 'Name must be at least 2 characters'),
    passwordRaw: z.string().optional().or(z.literal('')),
    email: optionalEmail,
    role: roleSlugSchema.optional(),
    is_active: z.boolean().optional(),
    cpf_cnpj: optionalTrimmedString(18),
    phone: optionalTrimmedString(20),
    zipcode: optionalTrimmedString(20),
    street: optionalTrimmedString(255),
    number: optionalTrimmedString(50),
    complement: optionalTrimmedString(150),
    neighborhood: optionalTrimmedString(100),
    city: optionalTrimmedString(100),
    state: optionalTrimmedString(50),
    default_page: optionalNullableTrimmedString(100),
    whatsapp_auto_reply_mode: whatsappAutoReplyModeSchema.optional(),
});

const toggleUserSchema = z.object({
    is_active: z.boolean()
});

const whatsappBusinessMessageSchema = z.object({
    to: z.string().min(8).max(30),
    to_chat_id: z.string().trim().min(5).max(120).optional(),
    message: z.string().max(4096).optional(),
    attachment_base64: z.string().min(1).optional(),
    attachment_name: z.string().trim().min(1).max(255).optional(),
    attachment_mime_type: z.string().trim().min(3).max(255).optional(),
}).superRefine((data, ctx) => {
    const hasMessage = !!String(data.message || '').trim();
    const hasAttachment = !!String(data.attachment_base64 || '').trim();

    if (!hasMessage && !hasAttachment) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['message'],
            message: 'Digite uma mensagem ou selecione um arquivo para enviar.',
        });
    }

    if (hasAttachment && !String(data.attachment_name || '').trim()) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['attachment_name'],
            message: 'Nome do arquivo nao informado.',
        });
    }

    if (hasAttachment && !String(data.attachment_mime_type || '').trim()) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['attachment_mime_type'],
            message: 'Tipo do arquivo nao informado.',
        });
    }
});

const whatsappBusinessSessionStartSchema = z.object({
    phone: z.string().min(10).max(30).optional(),
});

export class UserController {
    private static async isSelfTarget(req: Request, targetId: string): Promise<boolean> {
        const requesterId = String(req.user?.id || '').trim();
        const normalizedTargetId = String(targetId || '').trim();

        if (!requesterId || !normalizedTargetId) {
            return false;
        }

        if (requesterId === normalizedTargetId) {
            return true;
        }

        try {
            const currentUser = await UserService.getScopedUser(req.user!.company_id, requesterId);
            return String(currentUser.public_id) === normalizedTargetId || String(currentUser.id) === normalizedTargetId;
        } catch (_error) {
            return false;
        }
    }

    private static async usesCompanyWhatsAppScope(companyId: number): Promise<boolean> {
        const company = await CompanyService.getById(companyId);
        return (company.whatsapp_business_scope || 'company') === 'company';
    }

    private static async resolveScopedUserTarget(req: Request): Promise<any> {
        const companyId = req.user!.company_id;
        const targetId = req.params.id as string;

        if (!targetId) {
            throw new AppError('User ID required', 400);
        }

        if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin' && !(await UserController.isSelfTarget(req, targetId))) {
            throw new AppError('Not authorized to manage this WhatsApp session', 403);
        }

        return UserService.getScopedUser(companyId, targetId);
    }

    static async getAll(req: Request, res: Response) {
        const companyId = req.user!.company_id;
        const users = await UserService.getAllByCompany(companyId);
        res.status(200).json({ status: 'success', data: users });
    }

    static async create(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        if (req.user!.role !== 'admin') {
            // Allowing for prototyping
        }

        const validatedData = createUserSchema.parse(req.body);
        if (validatedData.role === 'super_admin' && req.user!.role !== 'super_admin') {
            throw new AppError('Only the super admin can create a super admin user', 403);
        }
        const newUser = await UserService.create(companyId, validatedData);
        return res.status(201).json({ status: 'success', data: newUser });
    }

    static async toggleActive(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const targetId = req.params.id;

        if (!targetId) {
            throw new AppError('User ID required', 400);
        }

        if (await UserController.isSelfTarget(req, targetId)) {
            throw new AppError('Cannot deactivate your own account', 400);
        }

        const validatedData = toggleUserSchema.parse(req.body);
        await UserService.toggleActive(companyId, targetId, validatedData.is_active);

        return res.status(200).json({ status: 'success', message: 'User status updated successfully' });
    }

    static async update(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const targetId = req.params.id as string;
        
        if (!targetId) {
            throw new AppError('User ID required', 400);
        }
        if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin' && !(await UserController.isSelfTarget(req, targetId))) {
            throw new AppError('Not authorized to update this profile', 403);
        }

        const validatedData = updateUserSchema.parse(req.body);
        if (validatedData.role === 'super_admin' && req.user!.role !== 'super_admin') {
            throw new AppError('Only the super admin can assign the super admin role', 403);
        }
        
        if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin' && validatedData.role && validatedData.role !== req.user!.role) {
            throw new AppError('Not authorized to change role', 403);
        }

        if (validatedData.passwordRaw === '') {
             delete validatedData.passwordRaw;
        } else if (validatedData.passwordRaw && validatedData.passwordRaw.length < 6) {
             throw new AppError('Password must be at least 6 characters', 400);
        }

        const updatedUser = await UserService.update(companyId, targetId, validatedData);

        return res.status(200).json({ status: 'success', message: 'User updated successfully', data: updatedUser });
    }

    static async delete(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const targetId = req.params.id;

        if (!targetId) {
            throw new AppError('User ID required', 400);
        }

        if (targetId === req.user!.id) {
            throw new AppError('Cannot delete your own account', 400);
        }

        await UserService.delete(companyId, targetId);

        return res.status(204).send();
    }

    static async startWhatsAppBusinessSession(req: Request, res: Response): Promise<any> {
        const targetUser = await UserController.resolveScopedUserTarget(req);
        const validatedBody = whatsappBusinessSessionStartSchema.parse(req.body || {});
        if (await UserController.usesCompanyWhatsAppScope(targetUser.company_id)) {
            const result = await WhatsAppBusinessService.startSession(targetUser.company_id, validatedBody.phone);
            return res.status(200).json({ status: 'success', data: result });
        }
        const result = await WhatsAppBusinessService.startUserSession(targetUser.company_id, targetUser.id, validatedBody.phone);
        res.status(200).json({ status: 'success', data: result });
    }

    static async getWhatsAppBusinessSession(req: Request, res: Response): Promise<any> {
        const targetUser = await UserController.resolveScopedUserTarget(req);
        if (await UserController.usesCompanyWhatsAppScope(targetUser.company_id)) {
            const result = await WhatsAppBusinessService.getSessionStatus(targetUser.company_id);
            return res.status(200).json({ status: 'success', data: result });
        }
        const result = await WhatsAppBusinessService.getUserSessionStatus(targetUser.company_id, targetUser.id);
        return res.status(200).json({ status: 'success', data: result });
    }

    static async disconnectWhatsAppBusinessSession(req: Request, res: Response): Promise<any> {
        const targetUser = await UserController.resolveScopedUserTarget(req);
        if (await UserController.usesCompanyWhatsAppScope(targetUser.company_id)) {
            const result = await WhatsAppBusinessService.disconnectSession(targetUser.company_id);
            return res.status(200).json({ status: 'success', data: result });
        }
        const result = await WhatsAppBusinessService.disconnectUserSession(targetUser.company_id, targetUser.id);
        res.status(200).json({ status: 'success', data: result });
    }

    static async getWhatsAppBusinessConversations(req: Request, res: Response): Promise<any> {
        const targetUser = await UserController.resolveScopedUserTarget(req);
        const querySchema = z.object({
            limit: z.coerce.number().int().min(1).max(200).optional()
        });
        const validatedQuery = querySchema.parse(req.query || {});
        if (await UserController.usesCompanyWhatsAppScope(targetUser.company_id)) {
            const result = await WhatsAppBusinessMessageService.listConversations(targetUser.company_id, validatedQuery.limit);
            return res.status(200).json({ status: 'success', data: result });
        }
        const result = await WhatsAppBusinessMessageService.listUserConversations(targetUser.company_id, targetUser.id, validatedQuery.limit);
        return res.status(200).json({ status: 'success', data: result });
    }

    static async getWhatsAppBusinessMessages(req: Request, res: Response): Promise<any> {
        const targetUser = await UserController.resolveScopedUserTarget(req);
        const querySchema = z.object({
            phone: z.string().min(1, 'Informe o numero da conversa'),
            limit: z.coerce.number().int().min(1).max(500).optional()
        });
        const validatedQuery = querySchema.parse(req.query || {});
        if (await UserController.usesCompanyWhatsAppScope(targetUser.company_id)) {
            const result = await WhatsAppBusinessMessageService.listMessages(targetUser.company_id, validatedQuery.phone, validatedQuery.limit);
            return res.status(200).json({ status: 'success', data: result });
        }
        const result = await WhatsAppBusinessMessageService.listUserMessages(targetUser.company_id, targetUser.id, validatedQuery.phone, validatedQuery.limit);
        return res.status(200).json({ status: 'success', data: result });
    }

    static async getWhatsAppBusinessAnalytics(req: Request, res: Response): Promise<any> {
        const targetUser = await UserController.resolveScopedUserTarget(req);
        if (await UserController.usesCompanyWhatsAppScope(targetUser.company_id)) {
            const result = await WhatsAppBusinessMessageService.getAnalytics(targetUser.company_id);
            return res.status(200).json({ status: 'success', data: result });
        }
        const result = await WhatsAppBusinessMessageService.getUserAnalytics(targetUser.company_id, targetUser.id);
        return res.status(200).json({ status: 'success', data: result });
    }

    static async deleteWhatsAppBusinessConversation(req: Request, res: Response): Promise<any> {
        const targetUser = await UserController.resolveScopedUserTarget(req);
        const { phone } = req.params;

        if (!phone) {
            throw new AppError('Informe o numero do contato', 400);
        }

        if (await UserController.usesCompanyWhatsAppScope(targetUser.company_id)) {
            await WhatsAppBusinessMessageService.deleteMessages(targetUser.company_id, phone);
        } else {
            await WhatsAppBusinessMessageService.deleteUserMessages(targetUser.company_id, targetUser.id, phone);
        }

        return res.status(204).send();
    }

    static async sendWhatsAppBusinessMessage(req: Request, res: Response): Promise<any> {
        const targetUser = await UserController.resolveScopedUserTarget(req);
        const validated = whatsappBusinessMessageSchema.parse(req.body || {});
        const { to, to_chat_id, message, attachment_base64, attachment_name, attachment_mime_type } = validated;

        if (await UserController.usesCompanyWhatsAppScope(targetUser.company_id)) {
            const result = await WhatsAppBusinessService.sendMessage(targetUser.company_id, {
                to,
                ...(to_chat_id ? { toChatId: to_chat_id } : {}),
                messageBody: message || '',
                attachment: attachment_base64
                    ? {
                        base64: attachment_base64,
                        fileName: attachment_name || 'arquivo',
                        mimeType: attachment_mime_type || 'application/octet-stream',
                    }
                    : null,
            });

            return res.status(200).json({ status: 'success', data: result });
        }

        const result = await WhatsAppBusinessService.sendUserMessage(targetUser.company_id, targetUser.id, {
            to,
            ...(to_chat_id ? { toChatId: to_chat_id } : {}),
            messageBody: message || '',
            attachment: attachment_base64
                ? {
                    base64: attachment_base64,
                    fileName: attachment_name || 'arquivo',
                    mimeType: attachment_mime_type || 'application/octet-stream',
                }
                : null,
        });

            return res.status(200).json({ status: 'success', data: result });
    }
}
