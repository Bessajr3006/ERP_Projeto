import { Request, Response } from 'express';
import { z } from 'zod';
import { UserService } from '../services/userService';
import { EntityService } from '../services/entityService';
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

const createSellerSchema = z.object({
    email: z.string().trim().email('Invalid email format'),
    full_name: z.string().trim().min(2, 'Name must be at least 2 characters').max(150, 'Name must be at most 150 characters'),
    passwordRaw: z.string().min(6, 'Password must be at least 6 characters'),
    is_active: z.boolean().optional().default(true),
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

const updateSellerSchema = z.object({
    full_name: optionalTrimmedString(150, 2, 'Name must be at least 2 characters'),
    passwordRaw: z.string().optional().or(z.literal('')),
    email: optionalEmail,
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

const toggleSellerSchema = z.object({
    is_active: z.boolean()
});

export class SellerController {
    static async getAll(req: Request, res: Response) {
        const companyId = req.user!.company_id;
        const sellers = await UserService.getAllByRole(companyId, 'seller');
        res.status(200).json({ status: 'success', data: sellers });
    }

    static async getById(req: Request, res: Response) {
        const companyId = req.user!.company_id;
        const targetId = req.params.id as string;
        
        if (!targetId) {
            throw new AppError('Seller ID required', 400);
        }

        const user = await UserService.getById(companyId, targetId);
        if (user.role !== 'seller') {
            throw new AppError('Usuário não é um vendedor', 400);
        }

        res.status(200).json({ status: 'success', data: user });
    }

    static async getCustomers(req: Request, res: Response) {
        const companyId = req.user!.company_id;
        const targetId = req.params.id as string;
        
        if (!targetId) {
            throw new AppError('Seller ID required', 400);
        }

        const user = await UserService.getById(companyId, targetId);
        if (user.role !== 'seller') {
            throw new AppError('Usuário não é um vendedor', 400);
        }

        const customers = await EntityService.listCustomersBySeller(companyId, user.public_id);
        res.status(200).json({ status: 'success', data: customers });
    }

    static async create(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const validatedData = createSellerSchema.parse(req.body);
        
        const payload = {
            ...validatedData,
            role: 'seller'
        };

        const newSeller = await UserService.create(companyId, payload);
        return res.status(201).json({ status: 'success', data: newSeller });
    }

    static async update(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const targetId = req.params.id as string;
        
        if (!targetId) {
            throw new AppError('Seller ID required', 400);
        }

        const existing = await UserService.getById(companyId, targetId);
        if (existing.role !== 'seller') {
            throw new AppError('Usuário não é um vendedor', 400);
        }

        const validatedData = updateSellerSchema.parse(req.body);
        
        if (validatedData.passwordRaw === '') {
             delete validatedData.passwordRaw;
        } else if (validatedData.passwordRaw && validatedData.passwordRaw.length < 6) {
             throw new AppError('Password must be at least 6 characters', 400);
        }

        const updatedSeller = await UserService.update(companyId, targetId, validatedData);
        return res.status(200).json({ status: 'success', message: 'Vendedor atualizado com sucesso', data: updatedSeller });
    }

    static async toggleActive(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const targetId = req.params.id as string;

        if (!targetId) {
            throw new AppError('Seller ID required', 400);
        }

        const existing = await UserService.getById(companyId, targetId);
        if (existing.role !== 'seller') {
            throw new AppError('Usuário não é um vendedor', 400);
        }

        const validatedData = toggleSellerSchema.parse(req.body);
        await UserService.toggleActive(companyId, targetId, validatedData.is_active);

        return res.status(200).json({ status: 'success', message: 'Status do vendedor atualizado com sucesso' });
    }

    static async delete(req: Request, res: Response): Promise<any> {
        const companyId = req.user!.company_id;
        const targetId = req.params.id as string;

        if (!targetId) {
            throw new AppError('Seller ID required', 400);
        }

        const existing = await UserService.getById(companyId, targetId);
        if (existing.role !== 'seller') {
            throw new AppError('Usuário não é um vendedor', 400);
        }

        await UserService.delete(companyId, targetId);

        return res.status(204).send();
    }
}
