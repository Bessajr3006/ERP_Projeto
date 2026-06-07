import { Request, Response } from 'express';
import { z } from 'zod';
import { CompanyService } from '../services/companyService';
import { UserService } from '../services/userService';
import { WhatsAppBusinessService } from '../services/whatsappBusinessService';
import { WhatsAppBusinessMessageService } from '../services/whatsappBusinessMessageService';
import logger from '../config/logger';

const companyWritableFieldSchemas = {
    company_name: z.string().max(150).optional(),
    cnpj: z.string().max(18).optional(),
    tax_regime: z.string().max(100).optional(),
    email: z.string().email('Invalid email').max(255).optional().or(z.literal('')),
    phone: z.string().max(20).optional(),
    zipcode: z.string().max(20).optional(),
    street: z.string().max(255).optional(),
    number: z.string().max(50).optional(),
    complement: z.string().max(150).optional(),
    neighborhood: z.string().max(100).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(50).optional(),
};

const initialUserSchema = z.object({
    full_name: z.string().trim().min(2, 'Nome do usuário deve ter no mínimo 2 caracteres').max(150),
    email: z.string().trim().email('Email do usuário inválido'),
    passwordRaw: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
    role: z.enum(['admin', 'user', 'operator', 'financial', 'manager', 'seller', 'contact', 'accountant', 'buyer', 'service_provider']).default('admin'),
});

const createCompanySchema = z.object({
    trade_name: z.string().min(2, 'Trade name must be at least 2 characters').max(150),
    ...companyWritableFieldSchemas,
    initial_user: initialUserSchema.optional(),
});

const updateCompanySchema = z.object({
    trade_name: z.string().min(2, 'Trade name must be at least 2 characters').max(150).optional(),
    ...companyWritableFieldSchemas,
    certificate_base64: z.string().optional(),
    certificate_password: z.string().optional(),
    certificate_expiration: z.string().optional(),
    certificate_name: z.string().optional(),
    logo_base64: z.string().nullable().optional(),
    logo_filename: z.string().max(255).nullable().optional(),
    api_token: z.string().optional(),
    swagger_api_token: z.string().optional(),
    whatsapp_chat_provider: z.enum(['business_qr']).optional(),
    whatsapp_business_scope: z.enum(['company', 'user']).optional(),
    solidcon_api_token: z.string().optional(),
    solidcon_url_1: z.string().optional(),
    solidcon_url_2: z.string().optional(),
    solidcon_url_3: z.string().optional(),
    solidcon_url_4: z.string().optional(),
    solidcon_url_5: z.string().optional(),
    allow_print_without_confirmation: z.boolean().optional(),
    is_active: z.boolean().optional(),
    
    // Dados Notas Fiscais
    ie: z.string().max(50).nullable().optional(),
    im: z.string().max(50).nullable().optional(),
    cnae_principal: z.string().max(20).nullable().optional(),
    nfe_environment: z.number().int().nullable().optional(),
    nfe_series: z.number().int().nullable().optional(),
    nfe_number: z.number().int().nullable().optional(),
    nfce_series: z.number().int().nullable().optional(),
    nfce_number: z.number().int().nullable().optional(),
    csc_token: z.string().max(255).nullable().optional(),
    csc_id: z.string().max(50).nullable().optional(),
    initial_user: initialUserSchema.optional(),
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

export class CompanyController {
    static async getStates(_req: Request, res: Response): Promise<void> {
        const states = await CompanyService.getIbgeStates();

        res.status(200).json({
            status: 'success',
            data: states
        });
    }

    static async getAll(_req: Request, res: Response): Promise<void> {
        const companies = await CompanyService.getAllVisible();

        res.status(200).json({
            status: 'success',
            data: companies
        });
    }

    static async create(req: Request, res: Response): Promise<void> {
        try {
            const validatedData = createCompanySchema.parse(req.body);
            const { initial_user, ...companyData } = validatedData;
            const company = await CompanyService.create(companyData);

            if (initial_user) {
                await UserService.create(company.id, initial_user);
            }

            res.status(201).json({
                status: 'success',
                data: company
            });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ status: 'error', errors: error.errors });
                return;
            }

            if (error instanceof Error && error.message === 'CNPJ already registered') {
                res.status(409).json({ status: 'error', message: error.message });
                return;
            }

            if (error instanceof Error && error.message === 'Email already in use') {
                res.status(409).json({ status: 'error', message: 'Email do usuário já está em uso' });
                return;
            }

            throw error;
        }
    }

    static async getByPublicId(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            if (!id) {
                res.status(400).json({ status: 'error', message: 'Missing company ID' });
                return;
            }

            const company = await CompanyService.getByPublicId(id);
            if (req.user?.role !== 'super_admin' && req.user?.company_id !== company.id) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            res.status(200).json({
                status: 'success',
                data: company
            });
        } catch (error: any) {
            if (error instanceof Error && error.message === 'Company not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }

            throw error;
        }
    }
    static async update(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ status: 'error', message: 'Missing company ID' });
                return;
            }

            const currentCompany = await CompanyService.getByPublicId(id);
            if (req.user?.role !== 'super_admin' && req.user?.company_id !== currentCompany.id) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            const validatedData = updateCompanySchema.parse(req.body);
            const { initial_user, ...updateData } = validatedData;
            const company = await CompanyService.update(id, updateData);

            if (initial_user) {
                await UserService.create(company.id, initial_user);
            }

            res.status(200).json({
                status: 'success',
                data: company
            });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ status: 'error', errors: error.errors });
                return;
            }

            if (error instanceof Error && error.message === 'Company not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }

            if (error instanceof Error && error.message === 'CNPJ already registered by another company') {
                res.status(409).json({ status: 'error', message: error.message });
                return;
            }

            if (error instanceof Error && error.message === 'Email already in use') {
                res.status(409).json({ status: 'error', message: 'Email do usuário já está em uso' });
                return;
            }

            throw error;
        }
    }

    static async startWhatsAppBusinessSession(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ status: 'error', message: 'Missing company ID' });
                return;
            }

            const company = await CompanyService.getByPublicId(id);
            if (req.user?.role !== 'super_admin' && req.user?.company_id && company.id !== req.user.company_id) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            const result = await WhatsAppBusinessService.startSession(company.id);
            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            logger.error({ err: error, companyId: req.user?.company_id }, '[companyController] Erro ao iniciar sessao QR do WhatsApp Business');
            res.status(500).json({ status: 'error', message: error?.message || 'Failed to start WhatsApp Business session' });
        }
    }

    static async getWhatsAppBusinessSession(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ status: 'error', message: 'Missing company ID' });
                return;
            }

            const company = await CompanyService.getByPublicId(id);
            if (req.user?.role !== 'super_admin' && req.user?.company_id && company.id !== req.user.company_id) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            const result = await WhatsAppBusinessService.getSessionStatus(company.id);
            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            logger.error({ err: error, companyId: req.user?.company_id }, '[companyController] Erro ao consultar sessao QR do WhatsApp Business');
            res.status(500).json({ status: 'error', message: error?.message || 'Failed to fetch WhatsApp Business session' });
        }
    }

    static async getWhatsAppBusinessConversations(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ status: 'error', message: 'Missing company ID' });
                return;
            }

            const company = await CompanyService.getByPublicId(id);
            if (req.user?.role !== 'super_admin' && req.user?.company_id && company.id !== req.user.company_id) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            const querySchema = z.object({
                limit: z.coerce.number().int().min(1).max(200).optional()
            });
            const validatedQuery = querySchema.parse(req.query || {});
            const result = await WhatsAppBusinessMessageService.listConversations(company.id, validatedQuery.limit);

            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ status: 'error', errors: error.errors });
                return;
            }

            logger.error({ err: error, companyId: req.user?.company_id }, '[companyController] Erro ao listar conversas do WhatsApp Business');
            res.status(500).json({ status: 'error', message: error?.message || 'Failed to fetch WhatsApp Business conversations' });
        }
    }

    static async deleteWhatsAppBusinessConversation(req: Request, res: Response): Promise<void> {
        try {
            const { id, phone } = req.params;
            if (!id) {
                res.status(400).json({ status: 'error', message: 'Missing company ID' });
                return;
            }
            if (!phone) {
                res.status(400).json({ status: 'error', message: 'Missing contact phone' });
                return;
            }

            const company = await CompanyService.getByPublicId(id);
            if (req.user?.role !== 'super_admin' && req.user?.company_id && company.id !== req.user.company_id) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            if (req.user?.role === 'user' && req.user?.id) {
                 await WhatsAppBusinessMessageService.deleteUserMessages(company.id, Number(req.user.id), phone);
            } else {
                 await WhatsAppBusinessMessageService.deleteMessages(company.id, phone);
            }

            res.status(204).send();
        } catch (error: any) {
            logger.error({ err: error, companyId: req.user?.company_id }, '[companyController] Erro ao excluir conversa do WhatsApp Business');
            res.status(500).json({ status: 'error', message: error?.message || 'Failed to delete WhatsApp Business conversation' });
        }
    }

    static async getWhatsAppBusinessMessages(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ status: 'error', message: 'Missing company ID' });
                return;
            }

            const company = await CompanyService.getByPublicId(id);
            if (req.user?.role !== 'super_admin' && req.user?.company_id && company.id !== req.user.company_id) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            const querySchema = z.object({
                phone: z.string().min(1, 'Informe o numero da conversa'),
                limit: z.coerce.number().int().min(1).max(500).optional()
            });
            const validatedQuery = querySchema.parse(req.query || {});
            const result = await WhatsAppBusinessMessageService.listMessages(company.id, validatedQuery.phone, validatedQuery.limit);

            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ status: 'error', errors: error.errors });
                return;
            }

            logger.error({ err: error, companyId: req.user?.company_id }, '[companyController] Erro ao listar mensagens do WhatsApp Business');
            res.status(500).json({ status: 'error', message: error?.message || 'Failed to fetch WhatsApp Business messages' });
        }
    }

    static async disconnectWhatsAppBusinessSession(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ status: 'error', message: 'Missing company ID' });
                return;
            }

            const company = await CompanyService.getByPublicId(id);
            if (req.user?.role !== 'super_admin' && req.user?.company_id && company.id !== req.user.company_id) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            const result = await WhatsAppBusinessService.disconnectSession(company.id);
            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            logger.error({ err: error, companyId: req.user?.company_id }, '[companyController] Erro ao encerrar sessao QR do WhatsApp Business');
            res.status(500).json({ status: 'error', message: error?.message || 'Failed to disconnect WhatsApp Business session' });
        }
    }

    static async sendWhatsAppBusinessMessage(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ status: 'error', message: 'Missing company ID' });
                return;
            }

            const company = await CompanyService.getByPublicId(id);
            if (req.user?.role !== 'super_admin' && req.user?.company_id && company.id !== req.user.company_id) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            const validated = whatsappBusinessMessageSchema.parse(req.body || {});
            const { to, to_chat_id, message, attachment_base64, attachment_name, attachment_mime_type } = validated;

            const result = await WhatsAppBusinessService.sendMessage(company.id, {
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
                    res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ status: 'error', errors: error.errors });
                return;
            }

            const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500;
            if (statusCode !== 500) {
                res.status(400).json({ status: 'error', message: error.message || 'Failed to send WhatsApp Business message' });
                return;
            }

            logger.error({ err: error, companyId: req.user?.company_id }, '[companyController] Erro ao enviar mensagem pelo WhatsApp Business QR');
            res.status(500).json({ status: 'error', message: error?.message || 'Failed to send WhatsApp Business message' });
        }
    }

    static async proxyConsulta(req: Request, res: Response): Promise<void> {
        try {
            const schema = z.object({
                url: z.string().trim().url(),
            });
            const { url } = schema.parse(req.body || {});

            const companyId = req.user?.company_id;
            if (!companyId) {
                res.status(401).json({ status: 'error', message: 'Empresa não identificada para consulta.' });
                return;
            }

            const company = await CompanyService.getById(companyId);
            const allowedUrls = [
                company.solidcon_url_1,
                company.solidcon_url_2,
                company.solidcon_url_3,
                company.solidcon_url_4,
                company.solidcon_url_5,
            ].map((value) => String(value || '').trim()).filter(Boolean);

            if (!allowedUrls.includes(url)) {
                res.status(403).json({ status: 'error', message: 'URL não cadastrada na integração Solidcon desta empresa.' });
                return;
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 20000);

            const fetchOptions: RequestInit = {
                method: 'GET',
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            };

            const response = await fetch(url, fetchOptions);
            clearTimeout(timeout);
            const body = await response.text();
            const contentType = response.headers.get('content-type') || '';
            let parsedBody: unknown = body;

            try {
                parsedBody = body ? JSON.parse(body) : null;
            } catch {
                parsedBody = body;
            }

            res.status(200).json({
                status: 'success',
                data: {
                    ok: response.ok,
                    statusCode: response.status,
                    statusText: response.statusText,
                    contentType,
                    url,
                    body: parsedBody,
                },
            });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ status: 'error', errors: error.errors });
                return;
            }

            const message = error?.name === 'AbortError'
                ? 'Tempo limite excedido ao consultar a URL Solidcon.'
                : `Proxy connection failed: ${error.message}`;

            logger.error({ err: error, proxyUrl: req.body?.url }, '[companyController] Erro no proxy');
            res.status(500).json({
                status: 'error',
                message,
                data: {
                    url: req.body?.url || null,
                    error: message,
                },
            });
        }
    }

    static async delete(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ status: 'error', message: 'Missing company ID' });
                return;
            }

            // Segurança Redobrada: Apenas Super Admin pode deletar empresas
            if (req.user?.role !== 'super_admin') {
                res.status(403).json({ status: 'error', message: 'Only Super Administrators can permanently delete companies.' });
                return;
            }

            await CompanyService.delete(id);
            
            logger.info({ companyId: id, deletedBy: req.user?.id }, '[CompanyController] Empresa excluída permanentemente');

            res.status(200).json({
                status: 'success',
                message: 'Empresa e todos os dados relacionados foram excluídos com sucesso.'
            });
        } catch (error: any) {
            if (error instanceof Error && error.message === 'Company not found') {
                res.status(404).json({ status: 'error', message: error.message });
                return;
            }
            
            logger.error({ err: error, companyId: req.params.id }, '[CompanyController] Erro ao excluir empresa');
            res.status(500).json({ status: 'error', message: error.message || 'Falha ao excluir empresa.' });
        }
    }
}
