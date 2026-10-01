import { Request, Response } from 'express';
import { z } from 'zod';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';
import { CompanyService } from '../services/companyService';
import { UserService } from '../services/userService';
import { PosControlConfigService } from '../services/posControlConfigService';
import { PosControlSyncService } from '../services/posControlSyncService';
import { WhatsAppBusinessService } from '../services/whatsappBusinessService';
import { WhatsAppBusinessMessageService } from '../services/whatsappBusinessMessageService';
import { FinanceService } from '../services/financeService';
import { ExternalDbService } from '../services/externalDbService';
import logger from '../config/logger';

interface SolidconCacheEntry {
    products: any[];
    eanIndex: Map<string, any>;
    lastUpdated: number;
    isUpdating: boolean;
}

const solidconCache = new Map<number, SolidconCacheEntry>();

async function updateCompanyCacheInBackground(companyId: number, url: string, headers: any, cdFilial: string) {
    const entry = solidconCache.get(companyId);
    if (entry && entry.isUpdating) {
        return;
    }

    if (!entry) {
        solidconCache.set(companyId, {
            products: [],
            eanIndex: new Map(),
            lastUpdated: 0,
            isUpdating: true
        });
    } else {
        entry.isUpdating = true;
    }

    try {
        logger.info(`[SolidconCache] Iniciando atualizacao de cache em segundo plano para empresa ${companyId}...`);
        
        let currentUrl = new URL(url);
        if (cdFilial && !currentUrl.searchParams.has('cdFilial') && !currentUrl.searchParams.has('cdfilial') && !currentUrl.searchParams.has('filial')) {
            currentUrl.searchParams.set('cdFilial', cdFilial);
        }
        if (!currentUrl.searchParams.has('pagina') && !currentUrl.searchParams.has('page') && !currentUrl.searchParams.has('offset')) {
            currentUrl.searchParams.set('pagina', '1');
        }

        let allItems: any[] = [];
        let page = 1;
        let offset = 0;
        let limit = 100;
        
        if (currentUrl.searchParams.has('pagina')) {
            page = parseInt(currentUrl.searchParams.get('pagina') || '1', 10);
        } else if (currentUrl.searchParams.has('page')) {
            page = parseInt(currentUrl.searchParams.get('page') || '1', 10);
        }
        if (currentUrl.searchParams.has('offset')) {
            offset = parseInt(currentUrl.searchParams.get('offset') || '0', 10);
        }
        if (currentUrl.searchParams.has('limit')) {
            limit = parseInt(currentUrl.searchParams.get('limit') || '100', 10);
        }

        const maxPages = 300;
        let pageCount = 0;

        const normalizeItems = (value: any, depth = 0): any[] => {
            if (depth > 4) return [];
            if (Array.isArray(value)) return value;
            if (typeof value === 'object' && value !== null) {
                const containers = ['body', 'items', 'data', 'products', 'produtos', 'registros', 'resultado', 'results', 'rows'];
                for (const key of containers) {
                    if (value[key] !== undefined && value[key] !== null) {
                        const nestedItems = normalizeItems(value[key], depth + 1);
                        if (nestedItems.length) return nestedItems;
                    }
                }
            }
            return [];
        };

        while (pageCount < maxPages) {
            const targetUrlObj = new URL(currentUrl.toString());
            if (targetUrlObj.searchParams.has('pagina')) {
                targetUrlObj.searchParams.set('pagina', String(page));
            } else if (targetUrlObj.searchParams.has('page')) {
                targetUrlObj.searchParams.set('page', String(page));
            } else if (targetUrlObj.searchParams.has('offset')) {
                targetUrlObj.searchParams.set('offset', String(offset));
            } else {
                if (pageCount > 0) break;
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);

            try {
                const response = await fetch(targetUrlObj.toString(), {
                    method: 'GET',
                    headers,
                    signal: controller.signal,
                });
                clearTimeout(timeout);

                if (!response.ok) {
                    break;
                }

                const bodyText = await response.text();
                let parsedBody: any = null;
                try {
                    parsedBody = bodyText ? JSON.parse(bodyText) : null;
                } catch {
                    parsedBody = bodyText;
                }

                const pageItems = normalizeItems(parsedBody);
                if (!pageItems || pageItems.length === 0) {
                    break;
                }

                allItems.push(...pageItems);

                if (pageItems.length < limit) {
                    break;
                }

                page += 1;
                offset += pageItems.length;
                pageCount += 1;
            } catch (err) {
                clearTimeout(timeout);
                break;
            }
        }

        if (allItems.length > 0) {
            const newEanIndex = new Map<string, any>();
            const eanKeys = ['codigo_ean', 'ean', 'gtin', 'barcode', 'codigo_barras', 'cod_barra', 'cod_barras'];
            for (const item of allItems) {
                for (const key of eanKeys) {
                    if (item?.[key]) {
                        const val = String(item[key]).trim();
                        if (val) {
                            newEanIndex.set(val, item);
                        }
                    }
                }
            }

            solidconCache.set(companyId, {
                products: allItems,
                eanIndex: newEanIndex,
                lastUpdated: Date.now(),
                isUpdating: false
            });
            logger.info(`[SolidconCache] Cache atualizado para empresa ${companyId} com ${allItems.length} produtos.`);
        } else {
            const currentEntry = solidconCache.get(companyId);
            if (currentEntry) {
                currentEntry.isUpdating = false;
            }
            logger.warn(`[SolidconCache] Falha ao atualizar cache para empresa ${companyId} (lista vazia).`);
        }
    } catch (err) {
        const currentEntry = solidconCache.get(companyId);
        if (currentEntry) {
            currentEntry.isUpdating = false;
        }
        logger.error({ err }, `[SolidconCache] Erro ao atualizar cache para empresa ${companyId}`);
    }
}

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
    is_general_admin: z.boolean().optional(),
    is_group_master: z.boolean().optional(),
    waze_url: z.string().max(255).nullable().optional(),
    company_group_public_id: z.string().uuid().nullable().optional(),
};

const initialUserSchema = z.object({
    full_name: z.string().trim().min(2, 'Nome do usuário deve ter no mínimo 2 caracteres').max(150),
    email: z.string().trim().email('Email do usuário inválido'),
    passwordRaw: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
    role: z.string().trim().min(1, 'Role é obrigatório').max(80, 'Role muito longo').regex(/^[a-z0-9_]+$/, 'Role inválido').default('supervisor'),
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
    solidcon_customer_cpf: z.string().optional(),
    solidcon_customer_name: z.string().optional(),
    serv_solidcon: z.string().optional(),
    bd_solidcon: z.string().optional(),
    login_solidcon: z.string().optional(),
    senha_solidcon: z.string().optional(),
    serv_alterdata: z.string().optional(),
    bd_alterdata: z.string().optional(),
    login_alterdata: z.string().optional(),
    senha_alterdata: z.string().optional(),
    porta_alterdata: z.string().optional(),
    cdempresa_alterdata: z.string().optional(),
    show_alterdata: z.any().optional(),
    serv_dorsal: z.string().optional(),
    bd_dorsal: z.string().optional(),
    login_dorsal: z.string().optional(),
    senha_dorsal: z.string().optional(),
    cdfilial: z.string().optional(),
    cdpdv: z.string().optional(),
    allow_print_without_confirmation: z.boolean().optional(),
    show_new_measure_button: z.boolean().optional(),
    is_active: z.boolean().optional(),
    show_solidcon: z.any().optional(),
    default_customer_group_public_id: z.string().nullable().optional(),
    default_bank_account_public_id: z.string().nullable().optional(),
    default_receivable_type_public_id: z.string().nullable().optional(),
    auto_generate_billets: z.union([z.boolean(), z.number(), z.string()]).transform(v => {
        return (v === true || v === 1 || v === 'true' || v === '1') ? 1 : 0;
    }).optional(),
    auto_generate_billets_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    auto_send_boleto_whatsapp: z.union([z.boolean(), z.number(), z.string()]).transform(v => {
        return (v === true || v === 1 || v === 'true' || v === '1') ? 1 : 0;
    }).optional(),
    boleto_send_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    boleto_send_whatsapp_number: z.string().max(20).nullable().optional(),
    boleto_send_whatsapp_name: z.string().max(100).nullable().optional(),
    whatsapp_allow_all_users_active_sender: z.union([z.boolean(), z.number(), z.string()]).transform(v => {
        return (v === true || v === 1 || v === 'true' || v === '1') ? 1 : 0;
    }).optional(),
    
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
    cnpj_document_url: z.string().nullable().optional(),
    cnpj_document_uploads: z.array(z.object({
        name: z.string().optional(),
        base64: z.string(),
        attachedAt: z.string().optional(),
        filename: z.string().optional()
    })).optional(),
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
    static async hasAccess(req: Request, companyId: number): Promise<boolean> {
        if (req.user?.role === 'super_admin') return true;
        if (req.user?.company_id === companyId) return true;
        if (req.user?.general_admin_company_id) return true;
        
        try {
            const [rows] = await pool.query<RowDataPacket[]>(
                'SELECT id FROM companies WHERE is_general_admin = 1 LIMIT 1'
            );
            const generalAdminCompanyId = rows[0]?.id;
            if (generalAdminCompanyId && req.user?.company_id === generalAdminCompanyId) {
                return true;
            }
        } catch (err) {
            logger.error({ err }, 'Error checking general admin company in CompanyController.hasAccess');
        }

        const originCompanyId = req.user?.group_master_company_id || req.user?.company_id;
        if (originCompanyId) {
            try {
                const [targetRows] = await pool.query<RowDataPacket[]>(
                    'SELECT company_group_id FROM companies WHERE id = ? LIMIT 1',
                    [companyId]
                );
                const [masterRows] = await pool.query<RowDataPacket[]>(
                    'SELECT company_group_id, is_group_master FROM companies WHERE id = ? LIMIT 1',
                    [originCompanyId]
                );
                if (
                    masterRows[0] &&
                    (masterRows[0].is_group_master === 1 || masterRows[0].is_group_master === true) &&
                    masterRows[0].company_group_id &&
                    targetRows[0] &&
                    targetRows[0].company_group_id === masterRows[0].company_group_id
                ) {
                    return true;
                }
            } catch (err) {
                logger.error({ err }, 'Error checking group master company in CompanyController.hasAccess');
            }
        }

        return false;
    }

    static async getStates(_req: Request, res: Response): Promise<void> {
        const states = await CompanyService.getIbgeStates();

        res.status(200).json({
            status: 'success',
            data: states
        });
    }

    static async getAll(req: Request, res: Response): Promise<void> {
        let companies: any[] = [];

        let isSuperAdmin = req.user?.role === 'super_admin' || Boolean(req.user?.general_admin_company_id);
        let userCompany = null;
        if (req.user?.company_id) {
            try {
                userCompany = await CompanyService.getById(req.user.company_id);
                if (userCompany.is_general_admin === true || (userCompany as any).is_general_admin === 1) {
                    isSuperAdmin = true;
                }
            } catch (e) {
                // ignore
            }
        }

        if (isSuperAdmin) {
            companies = await CompanyService.getAllVisible();
        } else {
            let masterCompany = null;
            if (req.user?.group_master_company_id) {
                try {
                    masterCompany = await CompanyService.getById(req.user.group_master_company_id);
                } catch (e) {}
            } else if (userCompany && userCompany.is_group_master && userCompany.company_group_id) {
                masterCompany = userCompany;
            }

            if (masterCompany && masterCompany.company_group_id && (masterCompany.is_group_master === true || (masterCompany as any).is_group_master === 1)) {
                companies = await CompanyService.getAllInGroup(masterCompany.company_group_id);
            } else if (userCompany) {
                companies = [userCompany];
            }
        }

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
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            const [sessions] = await pool.query<any[]>(
                `SELECT connected_number, connected_name, status, owner_type, owner_id 
                 FROM whatsapp_business_sessions 
                 WHERE company_id = ? AND status IN ('authenticated', 'ready')`,
                [company.id]
            );

            const [users] = await pool.query<any[]>(
                `SELECT id, public_id, full_name, email, phone, whatsapp_auto_send_boleto 
                 FROM users 
                 WHERE company_id = ? AND is_active = 1 
                 ORDER BY full_name ASC`,
                [company.id]
            );

            res.status(200).json({
                status: 'success',
                data: {
                    ...company,
                    users,
                    whatsapp_sessions: sessions
                }
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
            if (!(await CompanyController.hasAccess(req, currentCompany.id))) {
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
            if (!(await CompanyController.hasAccess(req, company.id))) {
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
            if (!(await CompanyController.hasAccess(req, company.id))) {
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
            if (!(await CompanyController.hasAccess(req, company.id))) {
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
            if (!(await CompanyController.hasAccess(req, company.id))) {
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
            if (!(await CompanyController.hasAccess(req, company.id))) {
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
            if (!(await CompanyController.hasAccess(req, company.id))) {
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
            if (!(await CompanyController.hasAccess(req, company.id))) {
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
                url: z.string().trim().optional(),
                connectionType: z.enum(['api', 'solidcon_db', 'dorsal_db']).optional(),
                startDate: z.string().optional(),
                endDate: z.string().optional(),
                method: z.enum(['GET', 'POST', 'PUT']).optional(),
                payload: z.any().optional(),
                target: z.string().optional()
            });
            const { url, connectionType = 'api', startDate, endDate, method = 'GET', payload, target } = schema.parse(req.body || {});

            const companyId = req.user?.company_id;
            if (!companyId) {
                res.status(401).json({ status: 'error', message: 'Empresa não identificada para consulta.' });
                return;
            }

            const company = await CompanyService.getById(companyId);

            if (connectionType === 'solidcon_db' || connectionType === 'dorsal_db') {
                const isSolidcon = connectionType === 'solidcon_db';
                const server = isSolidcon ? company.serv_solidcon : company.serv_dorsal;
                const database = isSolidcon ? company.bd_solidcon : company.bd_dorsal;
                const user = isSolidcon ? company.login_solidcon : company.login_dorsal;
                const password = isSolidcon ? company.senha_solidcon : company.senha_dorsal;

                if (!server || !database || !user || !password) {
                    res.status(400).json({
                        status: 'error',
                        message: `Configurações de conexão para Banco de Dados ${isSolidcon ? 'Solidcon' : 'Dorsal'} incompletas no cadastro da empresa.`
                    });
                    return;
                }

                if (!startDate || !endDate) {
                    res.status(400).json({ status: 'error', message: 'Datas Inicial e Final são obrigatórias para consulta ao banco.' });
                    return;
                }

                const cdFilial = company.cdfilial ? String(company.cdfilial).trim() : '';
                if (!cdFilial) {
                    res.status(400).json({ status: 'error', message: 'Código da filial (cdfilial) não configurado no cadastro da empresa.' });
                    return;
                }

                try {
                    const { ExternalDbService } = await import('../services/externalDbService');
                    let rows: any[];
                    if (target === 'expenses') {
                        rows = await ExternalDbService.queryExternalExpensesSqlServer({
                            host: server,
                            database,
                            user,
                            password
                        }, startDate, endDate, cdFilial);
                    } else if (target === 'suppliers') {
                        rows = await ExternalDbService.queryExternalSuppliersSqlServer({
                            host: server,
                            database,
                            user,
                            password
                        }, startDate, endDate, cdFilial);
                    } else if (target === 'customers') {
                        rows = await ExternalDbService.queryExternalCustomersSqlServer({
                            host: server,
                            database,
                            user,
                            password
                        }, startDate, endDate, cdFilial);
                    } else {
                        rows = await ExternalDbService.queryExternalSqlServer({
                            host: server,
                            database,
                            user,
                            password
                        }, startDate, endDate, cdFilial);
                    }

                    res.status(200).json({
                        status: 'success',
                        data: rows
                    });
                } catch (dbError: any) {
                    const rawMsg = dbError?.message || '';
                    logger.error({ err: dbError, server, database }, '[companyController] Erro ao consultar banco de dados externo');
                    res.status(500).json({
                        status: 'error',
                        message: rawMsg || `Não foi possível conectar ao banco de dados ${isSolidcon ? 'Solidcon' : 'Dorsal'}. O servidor está fora do ar ou inacessível no momento.`
                    });
                }
                return;
            }

            if (!url) {
                res.status(400).json({ status: 'error', message: 'URL é obrigatória para consultas do tipo API.' });
                return;
            }

            let targetUrl = url;
            if (!/^https?:\/\//i.test(targetUrl)) {
                targetUrl = 'http://' + targetUrl;
            }

            try {
                new URL(targetUrl);
            } catch {
                res.status(400).json({ status: 'error', message: 'A URL informada não é válida.' });
                return;
            }

            const allowedUrls = [
                company.solidcon_url_1,
                company.solidcon_url_2,
                company.solidcon_url_3,
                company.solidcon_url_4,
                company.solidcon_url_5,
            ].map((value) => String(value || '').trim()).filter(Boolean);

            const cleanUrlBase = (uStr: string): string => {
                try {
                    const parsed = new URL(uStr);
                    return parsed.origin + parsed.pathname;
                } catch {
                    return uStr;
                }
            };

            const isUrlAllowed = (reqUrl: string, pattern: string): boolean => {
                if (reqUrl === pattern) return true;
                const reqBase = cleanUrlBase(reqUrl);
                const patternBase = cleanUrlBase(pattern);
                if (reqBase === patternBase) return true;

                if (pattern.includes('{') && pattern.includes('}')) {
                    const regexString = '^' + pattern
                        .replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
                        .replace(/\\\{[a-zA-Z0-9_-]+\\\}/g, '([^\\/]+)')
                        + '$';
                    const regex = new RegExp(regexString, 'i');
                    if (regex.test(reqUrl)) return true;

                    const patternBaseRegexString = '^' + patternBase
                        .replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
                        .replace(/\\\{[a-zA-Z0-9_-]+\\\}/g, '([^\\/]+)')
                        + '$';
                    const baseRegex = new RegExp(patternBaseRegexString, 'i');
                    if (baseRegex.test(reqBase)) return true;
                }

                if (reqUrl.startsWith(pattern)) return true;
                if (reqBase.startsWith(patternBase)) return true;

                return false;
            };

            const isAnyAllowed = allowedUrls.some(pattern => isUrlAllowed(targetUrl, pattern));

            if (!isAnyAllowed) {
                res.status(403).json({ status: 'error', message: 'URL não cadastrada na integração Solidcon desta empresa.' });
                return;
            }

            const solidconToken = company.solidcon_api_token ? String(company.solidcon_api_token).trim() : '';
            const reqHeaders: Record<string, string> = {
                Accept: 'application/json',
            };
            if (solidconToken) {
                reqHeaders['token'] = solidconToken;
                reqHeaders['Authorization'] = `Bearer ${solidconToken}`;
                reqHeaders['x-api-token'] = solidconToken;
            }

            let currentUrl = new URL(targetUrl);
            const cdFilial = company.cdfilial ? String(company.cdfilial).trim() : '';
            if (cdFilial) {
                currentUrl.searchParams.set('cdfilial', cdFilial);
                currentUrl.searchParams.set('cdFilial', cdFilial);
            }
            targetUrl = currentUrl.toString();

            if (method === 'POST' || method === 'PUT') {
                reqHeaders['Content-Type'] = 'application/json';
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 15000);
                try {
                    const fetchOptions: any = {
                        method: method,
                        headers: reqHeaders,
                        signal: controller.signal
                    };
                    if (payload !== undefined && payload !== null) {
                        fetchOptions.body = JSON.stringify(payload);
                    }
                    const response = await fetch(targetUrl, fetchOptions);
                    clearTimeout(timeout);
                    const bodyText = await response.text();
                    let parsedBody: any = null;
                    try {
                        parsedBody = bodyText ? JSON.parse(bodyText) : null;
                    } catch {
                        parsedBody = bodyText;
                    }
                    res.status(response.status).json({
                        status: response.ok ? 'success' : 'error',
                        data: parsedBody
                    });
                } catch (err: any) {
                    clearTimeout(timeout);
                    res.status(500).json({ status: 'error', message: err.message || `Erro de rede ao enviar requisição (${method}) ao Solidcon.` });
                }
                return;
            }

            // Restore currentUrl and append pagination params for GET requests
            currentUrl = new URL(targetUrl);
            if (!currentUrl.searchParams.has('pagina') && !currentUrl.searchParams.has('page') && !currentUrl.searchParams.has('offset')) {
                currentUrl.searchParams.set('pagina', '1');
            }

            // Trigger background cache update if needed
            const generalUrl = company.solidcon_url_1 ? String(company.solidcon_url_1).trim() : '';
            if (generalUrl) {
                const cache = solidconCache.get(companyId);
                const needsUpdate = !cache || (Date.now() - cache.lastUpdated > 10 * 60 * 1000); // 10 min
                if (needsUpdate) {
                    updateCompanyCacheInBackground(companyId, generalUrl, reqHeaders, cdFilial).catch(err => {
                        logger.error({ err }, '[SolidconCache] Erro disparado em background cache update');
                    });
                }
            }

            let allItems: any[] = [];
            let page = 1;
            let offset = 0;
            let limit = 100;

            if (currentUrl.searchParams.has('pagina')) {
                page = parseInt(currentUrl.searchParams.get('pagina') || '1', 10);
            } else if (currentUrl.searchParams.has('page')) {
                page = parseInt(currentUrl.searchParams.get('page') || '1', 10);
            }
            if (currentUrl.searchParams.has('offset')) {
                offset = parseInt(currentUrl.searchParams.get('offset') || '0', 10);
            }
            if (currentUrl.searchParams.has('limit')) {
                limit = parseInt(currentUrl.searchParams.get('limit') || '100', 10);
            }

            const eanMatch = targetUrl.match(/\b\d{8,14}\b/);
            const ean = eanMatch ? eanMatch[0] : '';
            const maxPages = ean ? 15 : 50;
            let pageCount = 0;
            let ok = true;
            let statusCode = 200;
            let statusText = 'OK';
            let contentType = 'application/json';
            let finalParsedBody: any = null;

            const normalizeItems = (value: any, depth = 0): any[] => {
                if (depth > 4) return [];
                if (Array.isArray(value)) return value;
                if (typeof value === 'object' && value !== null) {
                    const containers = ['body', 'items', 'data', 'products', 'produtos', 'registros', 'resultado', 'results', 'rows'];
                    for (const key of containers) {
                        if (value[key] !== undefined && value[key] !== null) {
                            const nestedItems = normalizeItems(value[key], depth + 1);
                            if (nestedItems.length) return nestedItems;
                        }
                    }
                }
                return [];
            };

            while (pageCount < maxPages) {
                const targetUrlObj = new URL(currentUrl.toString());
                if (targetUrlObj.searchParams.has('pagina')) {
                    targetUrlObj.searchParams.set('pagina', String(page));
                } else if (targetUrlObj.searchParams.has('page')) {
                    targetUrlObj.searchParams.set('page', String(page));
                } else if (targetUrlObj.searchParams.has('offset')) {
                    targetUrlObj.searchParams.set('offset', String(offset));
                } else {
                    if (pageCount > 0) break;
                }

                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout per request/page

                try {
                    const response = await fetch(targetUrlObj.toString(), {
                        method: 'GET',
                        headers: reqHeaders,
                        signal: controller.signal,
                    });
                    clearTimeout(timeout);

                    ok = response.ok;
                    statusCode = response.status;
                    statusText = response.statusText;
                    contentType = response.headers.get('content-type') || 'application/json';

                    const bodyText = await response.text();
                    let parsedBody: any = null;
                    try {
                        parsedBody = bodyText ? JSON.parse(bodyText) : null;
                    } catch {
                        parsedBody = bodyText;
                    }

                    if (!response.ok) {
                        if (pageCount === 0) {
                            finalParsedBody = parsedBody;
                        }
                        break;
                    }

                    const pageItems = normalizeItems(parsedBody);
                    if (!pageItems || pageItems.length === 0) {
                        if (pageCount === 0) {
                            finalParsedBody = parsedBody;
                        }
                        break;
                    }

                    if (ean) {
                        const eanKeys = ['codigo_ean', 'ean', 'gtin', 'barcode', 'codigo_barras', 'cod_barra', 'cod_barras'];
                        const foundItem = pageItems.find(item => {
                            return eanKeys.some(key => item?.[key] && String(item[key]).trim() === ean);
                        });
                        if (foundItem) {
                            logger.info(`[SolidconProxy] EAN ${ean} encontrado na pagina ${page}. Encerrando busca prematuramente.`);
                            allItems = [foundItem];
                            ok = true;
                            statusCode = 200;
                            break;
                        }
                    }

                    allItems.push(...pageItems);

                    if (pageItems.length < limit) {
                        break;
                    }

                    page += 1;
                    offset += pageItems.length;
                    pageCount += 1;
                } catch (err: any) {
                    clearTimeout(timeout);
                    if (pageCount === 0) {
                        throw err;
                    }
                    break;
                }
            }

            if (!ok && ean) {
                const cache = solidconCache.get(companyId);
                if (cache && cache.eanIndex.has(ean)) {
                    const cachedItem = cache.eanIndex.get(ean);
                    logger.info(`[SolidconCache] Cache HIT para o EAN ${ean} da empresa ${companyId}`);
                    res.status(200).json({
                        status: 'success',
                        data: {
                            ok: true,
                            statusCode: 200,
                            statusText: 'OK (Cache HIT)',
                            contentType: 'application/json',
                            url: targetUrl,
                            body: [cachedItem],
                        },
                    });
                    return;
                }
            }

            res.status(200).json({
                status: 'success',
                data: {
                    ok,
                    statusCode,
                    statusText,
                    contentType,
                    url: targetUrl,
                    body: allItems.length > 0 ? allItems : finalParsedBody,
                },
            });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ status: 'error', errors: error.errors });
                return;
            }

            const rawMsg = error?.message || '';
            let message = rawMsg;
            if (error?.name === 'AbortError' || rawMsg.includes('ETIMEDOUT') || rawMsg.includes('timeout') || rawMsg.includes('ECONNREFUSED') || rawMsg.includes('ENOTFOUND') || rawMsg.includes('Failed to connect') || rawMsg.includes('fetch failed')) {
                message = 'Não foi possível conectar ao Solidcon. O servidor está fora do ar ou inacessível no momento.';
            } else if (rawMsg.startsWith('Proxy connection failed:')) {
                message = rawMsg.replace('Proxy connection failed:', 'Falha de conexão:');
            }

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

    static async listPosControlConfigs(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            const configs = await PosControlConfigService.list(company.id);
            res.status(200).json({ status: 'success', data: configs });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async createPosControlConfig(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            const data = req.body;
            const config = await PosControlConfigService.create(company.id, data);
            res.status(201).json({ status: 'success', data: config });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async updatePosControlConfig(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const id = req.params.id as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            const data = req.body;
            const config = await PosControlConfigService.update(company.id, Number(id), data);
            res.status(200).json({ status: 'success', data: config });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async deletePosControlConfig(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const id = req.params.id as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            await PosControlConfigService.delete(company.id, Number(id));
            res.status(200).json({ status: 'success', message: 'PosControl config deleted' });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Internal Server Error' });
        }
    }

    static async syncPosControlCategories(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            let { configId, categories, categoryIds } = req.body;
            if (!configId || !categories) {
                res.status(400).json({ status: 'error', message: 'Faltam parâmetros obrigatórios (configId ou categorias).' });
                return;
            }

            const result = await PosControlSyncService.syncCategories(company.id, Number(configId), categories);

            logger.info({ result }, '[CompanyController] Resposta da sincronização de categorias');

            // Save idgrupopos returned by Pos-Controll into local database
            if (result && Array.isArray(result.details)) {
                for (const batch of result.details) {
                    let list: any[] = [];
                    if (Array.isArray(batch)) {
                        list = batch;
                    } else if (batch && Array.isArray(batch.Result)) {
                        list = batch.Result;
                    } else if (batch && Array.isArray(batch.ProductGroups)) {
                        list = batch.ProductGroups;
                    } else if (batch && typeof batch === 'object') {
                        const foundArray = Object.values(batch).find(val => Array.isArray(val));
                        if (foundArray) {
                            list = foundArray as any[];
                        }
                    }

                    logger.info({ list }, '[CompanyController] Processando lista de categorias do lote');

                    for (const item of list) {
                        const pg = item?.ProductGroup || item;
                        const name = pg?.Name;
                        const posGroupId = pg?.ProductGroupID;

                        logger.info({ item, pg, name, posGroupId }, '[CompanyController] Mapeando item de categoria');

                        if (posGroupId) {
                            const [upRes] = await pool.query<any>(
                                `UPDATE product_categories 
                                 SET idgrupopos = ?, poscontrol_synced = 1 
                                 WHERE company_id = ? 
                                   AND (
                                     (TRIM(name) = TRIM(?)) 
                                     OR (TRIM(LEFT(name, 30)) = TRIM(LEFT(?, 30)))
                                   )`,
                                [String(posGroupId), company.id, String(name || ''), String(name || '')]
                            );
                            logger.info({ affectedRows: upRes.affectedRows, name, posGroupId }, '[CompanyController] Resultado do update da categoria');
                        }
                    }
                }
            }

            if (Array.isArray(categoryIds) && categoryIds.length > 0) {
                await pool.query(
                    'UPDATE product_categories SET poscontrol_synced = 1 WHERE public_id IN (?) AND company_id = ?',
                    [categoryIds, company.id]
                );
            }

            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Erro ao sincronizar categorias.' });
        }
    }

    static async syncPosControlProducts(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            let { configId, products, productIds } = req.body;
            if (products && !Array.isArray(products)) {
                products = [products];
            }
            if (!configId || !Array.isArray(products)) {
                res.status(400).json({ status: 'error', message: 'Faltam parâmetros obrigatórios (configId ou produtos).' });
                return;
            }

            const result = await PosControlSyncService.syncProducts(company.id, Number(configId), products);

            logger.info({ result }, '[CompanyController] Resposta da sincronização de produtos');

            // Save idprodutopos returned by Pos-Controll into local database
            if (result && Array.isArray(result.details)) {
                for (const batch of result.details) {
                    let list: any[] = [];
                    if (Array.isArray(batch)) {
                        list = batch;
                    } else if (batch && Array.isArray(batch.Result)) {
                        list = batch.Result;
                    } else if (batch && Array.isArray(batch.Products)) {
                        list = batch.Products;
                    } else if (batch && typeof batch === 'object') {
                        const foundArray = Object.values(batch).find(val => Array.isArray(val));
                        if (foundArray) {
                            list = foundArray as any[];
                        }
                    }

                    logger.info({ list }, '[CompanyController] Processando lista de produtos do lote');

                    for (const item of list) {
                        const p = item?.Product || item;
                        const name = p?.Name;
                        const posProductId = p?.ProductID;
                        const internalCode = p?.InternalCode;
                        const barcode = p?.BarCode;

                        logger.info({ item, p, name, posProductId, internalCode, barcode }, '[CompanyController] Mapeando item de produto');

                        if (posProductId) {
                            const [upRes] = await pool.query<any>(
                                `UPDATE products 
                                 SET idprodutopos = ?, poscontrol_synced = 1 
                                 WHERE company_id = ? 
                                   AND (
                                     (TRIM(name) = TRIM(?)) 
                                     OR (sku = ? AND sku IS NOT NULL AND sku != '') 
                                     OR (external_code = ? AND external_code IS NOT NULL AND external_code != '') 
                                     OR (ean = ? AND ean IS NOT NULL AND ean != '')
                                     OR (TRIM(LEFT(name, 30)) = TRIM(LEFT(?, 30)))
                                   )`,
                                [
                                    String(posProductId),
                                    company.id,
                                    String(name || ''),
                                    String(internalCode || ''),
                                    String(internalCode || ''),
                                    String(barcode || ''),
                                    String(name || '')
                                ]
                            );
                            logger.info({ affectedRows: upRes.affectedRows, name, posProductId, internalCode, barcode }, '[CompanyController] Resultado do update do produto');
                        }
                    }
                }
            }

            let successProductIds = [...productIds];
            if (result && Array.isArray(result.failures) && result.failures.length > 0) {
                const failedSkus = result.failures.map((f: any) => f.sku);
                const [failedProds] = await pool.query<any>(
                    'SELECT public_id FROM products WHERE company_id = ? AND sku IN (?)',
                    [company.id, failedSkus]
                );
                if (failedProds.length > 0) {
                    const failedPublicIds = failedProds.map((p: any) => String(p.public_id));
                    successProductIds = productIds.filter((id: any) => !failedPublicIds.includes(String(id)));
                }
            }

            if (successProductIds.length > 0) {
                await pool.query(
                    'UPDATE products SET poscontrol_synced = 1 WHERE public_id IN (?) AND company_id = ?',
                    [successProductIds, company.id]
                );
            }

            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Erro ao sincronizar produtos.' });
        }
    }

    static async importPosControlUnitTypes(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            const { configId } = req.body;
            if (!configId) {
                res.status(400).json({ status: 'error', message: 'Falta o parâmetro obrigatório configId.' });
                return;
            }

            const result = await PosControlSyncService.importUnitTypes(company.id, Number(configId));
            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Erro ao importar tipos de unidade.' });
        }
    }

    static async importPosControlProductTypes(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            const { configId } = req.body;
            if (!configId) {
                res.status(400).json({ status: 'error', message: 'Falta o parâmetro obrigatório configId.' });
                return;
            }

            const result = await PosControlSyncService.importProductTypes(company.id, Number(configId));
            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Erro ao importar tipos de produto.' });
        }
    }

    static async fetchPosControlProducts(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            const { configId } = req.body;
            if (!configId) {
                res.status(400).json({ status: 'error', message: 'Falta o parâmetro obrigatório configId.' });
                return;
            }

            const result = await PosControlSyncService.fetchProducts(company.id, Number(configId));
            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Erro ao buscar produtos do Pos-Controll.' });
        }
    }

    static async importPosControlProducts(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            const { configId, products } = req.body;
            if (!configId) {
                res.status(400).json({ status: 'error', message: 'Falta o parâmetro obrigatório configId.' });
                return;
            }

            const result = await PosControlSyncService.importProducts(company.id, Number(configId), products);
            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Erro ao importar produtos.' });
        }
    }

    static async fetchPosControlCategories(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            const { configId } = req.body;
            if (!configId) {
                res.status(400).json({ status: 'error', message: 'Falta o parâmetro obrigatório configId.' });
                return;
            }

            const result = await PosControlSyncService.fetchCategories(company.id, Number(configId));
            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Erro ao buscar categorias do Pos-Controll.' });
        }
    }

    static async importPosControlCategories(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            const { configId, categories } = req.body;
            if (!configId) {
                res.status(400).json({ status: 'error', message: 'Falta o parâmetro obrigatório configId.' });
                return;
            }

            const result = await PosControlSyncService.importCategories(company.id, Number(configId), categories);
            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Erro ao importar categorias.' });
        }
    }

    static async inactivatePosControlCategories(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            const { configId, categoryIds } = req.body;
            if (!configId || !categoryIds || !Array.isArray(categoryIds)) {
                res.status(400).json({ status: 'error', message: 'Parâmetros configId e categoryIds (array) são obrigatórios.' });
                return;
            }

            const result = await PosControlSyncService.inactivateCategories(company.id, Number(configId), categoryIds);
            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Erro ao inativar categorias.' });
        }
    }

    static async getPosControlDebugInfo(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            const configs = await PosControlConfigService.list(company.id);
            const activeConfig = configs && configs.length > 0 ? configs[0] : null;
            if (!activeConfig) {
                res.status(404).json({ status: 'error', message: 'Nenhuma credencial do Pos-Controll configurada.' });
                return;
            }

            const jwt = await PosControlSyncService.getAuthToken(activeConfig);
            const endpoint = `https://api.poscontrole.com.br/v2/productgroups?subscription-key=${activeConfig.ocp_apim_subscription_key || activeConfig.subscription_key || ''}`;

            res.json({
                status: 'success',
                data: {
                    jwt,
                    endpoint
                }
            });
        } catch (err: any) {
            logger.error({ err }, '[CompanyController] Erro ao buscar informações de debug do Pos-Control');
            res.status(500).json({ status: 'error', message: err.message || 'Erro ao buscar dados do Pos-Control' });
        }
    }

    static async fetchPosControlSales(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!company) {
                res.status(404).json({ status: 'error', message: 'Empresa não encontrada.' });
                return;
            }
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            const { startDate, endDate } = req.query;
            if (!startDate || !endDate) {
                res.status(400).json({ status: 'error', message: 'Falta o parâmetro obrigatório startDate ou endDate.' });
                return;
            }

            const configs = await PosControlConfigService.list(company.id);
            const activeConfig = configs ? configs[0] : null;
            if (!activeConfig) {
                res.status(400).json({ status: 'error', message: 'Nenhuma credencial do Pos-Controll configurada.' });
                return;
            }

            const configId = activeConfig.id;
            const result = await PosControlSyncService.fetchSales(company.id, configId, String(startDate), String(endDate));
            res.status(200).json({ status: 'success', data: result });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Erro ao buscar vendas do Pos-Controll.' });
        }
    }

    static async syncPosControlSales(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!company) {
                res.status(404).json({ status: 'error', message: 'Empresa não encontrada.' });
                return;
            }
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Access denied for this company' });
                return;
            }

            const { startDate, endDate, category_public_id, bank_account_public_id, selectedSales } = req.body;
            if (!category_public_id || !bank_account_public_id || (!selectedSales && (!startDate || !endDate))) {
                res.status(400).json({ status: 'error', message: 'Falta um parâmetro obrigatório (selectedSales ou startDate/endDate, juntamente com category_public_id e bank_account_public_id).' });
                return;
            }

            const configs = await PosControlConfigService.list(company.id);
            const activeConfig = configs ? configs[0] : null;
            if (!activeConfig) {
                res.status(400).json({ status: 'error', message: 'Nenhuma credencial do Pos-Controll configurada.' });
                return;
            }

            const configId = activeConfig.id;
            
            // 1. Fetch sales if not provided
            let sales: any[] = [];
            if (selectedSales && Array.isArray(selectedSales)) {
                sales = selectedSales;
            } else {
                sales = await PosControlSyncService.fetchSales(company.id, configId, String(startDate), String(endDate));
            }

            // 2. Loop through sales and launch/update revenues in Keystone
            let importedCount = 0;
            let updatedCount = 0;
            const userId = req.user!.id;

            for (const sale of sales) {
                // Check if a transaction with this POS Code already exists in the transactions table
                const [existing] = await pool.query<RowDataPacket[]>(
                    'SELECT public_id FROM transactions WHERE company_id = ? AND description LIKE ? LIMIT 1',
                    [company.id, `%${sale.salePosCodeId}%`]
                );

                if (existing && existing.length > 0 && existing[0]) {
                    const txPublicId = existing[0].public_id;
                    
                    // Update the existing transaction details
                    await FinanceService.updateRevenue(company.id, txPublicId, {
                        description: `Venda POS-Controll ${sale.salePosCodeId}`,
                        amount: sale.total,
                        date: sale.date.split('T')[0],
                        received_at: sale.status === 'Finalizada' ? sale.date.split('T')[0] : undefined,
                        category_public_id,
                        bank_account_public_id,
                        payment_method: sale.paymentType,
                        status: sale.status === 'Finalizada' ? 'paid' : 'pending'
                    });

                    updatedCount++;
                    continue;
                }

                // Create the revenue launch
                await FinanceService.createRevenue(company.id, userId, {
                    description: `Venda POS-Controll ${sale.salePosCodeId}`,
                    amount: sale.total,
                    date: sale.date.split('T')[0],
                    received_at: sale.status === 'Finalizada' ? sale.date.split('T')[0] : undefined,
                    category_public_id,
                    bank_account_public_id,
                    payment_method: sale.paymentType,
                    status: sale.status === 'Finalizada' ? 'paid' : 'pending'
                });

                importedCount++;
            }

            res.status(200).json({
                status: 'success',
                message: `Sincronização concluída: ${importedCount} receitas lançadas, ${updatedCount} atualizadas.`,
                data: {
                    salesCount: sales.length,
                    importedCount,
                    updatedCount,
                    sales
                }
            });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Erro ao sincronizar vendas do Pos-Controll.' });
        }
    }

    static async testAlterdataConnection(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ status: 'error', message: 'ID da empresa não informado.' });
                return;
            }

            const currentCompany = await CompanyService.getByPublicId(id);
            if (!(await CompanyController.hasAccess(req, currentCompany.id))) {
                res.status(403).json({ status: 'error', message: 'Acesso negado para esta empresa.' });
                return;
            }

            const body = req.body || {};
            const host = body.serv_alterdata !== undefined ? body.serv_alterdata : currentCompany.serv_alterdata;
            const port = body.porta_alterdata !== undefined ? body.porta_alterdata : currentCompany.porta_alterdata;
            const database = body.bd_alterdata !== undefined ? body.bd_alterdata : currentCompany.bd_alterdata;
            const user = body.login_alterdata !== undefined ? body.login_alterdata : currentCompany.login_alterdata;
            const password = body.senha_alterdata !== undefined && body.senha_alterdata !== '' 
                ? body.senha_alterdata 
                : currentCompany.senha_alterdata;

            const result = await ExternalDbService.testAlterdataConnection({
                host,
                port,
                database,
                user,
                password
            });

            res.status(200).json({
                status: 'success',
                ...result
            });
        } catch (error: any) {
            res.status(400).json({
                status: 'error',
                message: error.message || 'Falha ao testar conexão com o banco Alterdata.'
            });
        }
    }

    static async listSolidconConfigs(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Acesso negado para esta empresa.' });
                return;
            }

            const { SolidconConfigService } = await import('../services/solidconConfigService');
            const configs = await SolidconConfigService.list(company.id);
            res.status(200).json({ status: 'success', data: configs });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Erro interno do servidor.' });
        }
    }

    static async createSolidconConfig(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Acesso negado para esta empresa.' });
                return;
            }

            const data = req.body;
            const { SolidconConfigService } = await import('../services/solidconConfigService');
            const config = await SolidconConfigService.create(company.id, data);
            res.status(201).json({ status: 'success', data: config });
        } catch (error: any) {
            res.status(400).json({ status: 'error', message: error.message || 'Erro ao criar conexão Solidcon.' });
        }
    }

    static async updateSolidconConfig(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const id = req.params.id as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Acesso negado para esta empresa.' });
                return;
            }

            const data = req.body;
            const { SolidconConfigService } = await import('../services/solidconConfigService');
            const config = await SolidconConfigService.update(company.id, Number(id), data);
            res.status(200).json({ status: 'success', data: config });
        } catch (error: any) {
            res.status(400).json({ status: 'error', message: error.message || 'Erro ao atualizar conexão Solidcon.' });
        }
    }

    static async deleteSolidconConfig(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const id = req.params.id as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Acesso negado para esta empresa.' });
                return;
            }

            const { SolidconConfigService } = await import('../services/solidconConfigService');
            await SolidconConfigService.delete(company.id, Number(id));
            res.status(200).json({ status: 'success', message: 'Conexão Solidcon excluída com sucesso.' });
        } catch (error: any) {
            res.status(400).json({ status: 'error', message: error.message || 'Erro ao excluir conexão Solidcon.' });
        }
    }

    static async testSolidconConfig(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Acesso negado para esta empresa.' });
                return;
            }

            const body = req.body || {};
            let host = body.serv_solidcon;
            let database = body.bd_solidcon;
            let user = body.login_solidcon;
            let password = body.senha_solidcon;

            // If an ID is passed in params or body and password wasn't provided, fill from existing config
            const configId = req.params.id || body.id;
            if (configId) {
                const { SolidconConfigService } = await import('../services/solidconConfigService');
                const existing = await SolidconConfigService.getById(Number(configId), company.id);
                if (existing) {
                    host = host !== undefined ? host : existing.serv_solidcon;
                    database = database !== undefined ? database : existing.bd_solidcon;
                    user = user !== undefined ? user : existing.login_solidcon;
                    if (!password) {
                        password = existing.senha_solidcon;
                    }
                }
            }

            const { ExternalDbService } = await import('../services/externalDbService');
            const result = await ExternalDbService.testSolidconConnection({
                host,
                database,
                user,
                password
            });

            res.status(200).json({
                status: 'success',
                ...result
            });
        } catch (error: any) {
            res.status(400).json({
                status: 'error',
                message: error.message || 'Falha ao testar conexão com o banco Solidcon.'
            });
        }
    }

    static async listDorsalConfigs(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Acesso negado para esta empresa.' });
                return;
            }

            const { DorsalConfigService } = await import('../services/dorsalConfigService');
            const configs = await DorsalConfigService.list(company.id);
            res.status(200).json({ status: 'success', data: configs });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Erro interno do servidor.' });
        }
    }

    static async createDorsalConfig(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Acesso negado para esta empresa.' });
                return;
            }

            const data = req.body;
            const { DorsalConfigService } = await import('../services/dorsalConfigService');
            const config = await DorsalConfigService.create(company.id, data);
            res.status(201).json({ status: 'success', data: config });
        } catch (error: any) {
            res.status(400).json({ status: 'error', message: error.message || 'Erro ao criar conexão Dorsal.' });
        }
    }

    static async updateDorsalConfig(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const id = req.params.id as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Acesso negado para esta empresa.' });
                return;
            }

            const data = req.body;
            const { DorsalConfigService } = await import('../services/dorsalConfigService');
            const config = await DorsalConfigService.update(company.id, Number(id), data);
            res.status(200).json({ status: 'success', data: config });
        } catch (error: any) {
            res.status(400).json({ status: 'error', message: error.message || 'Erro ao atualizar conexão Dorsal.' });
        }
    }

    static async deleteDorsalConfig(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const id = req.params.id as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Acesso negado para esta empresa.' });
                return;
            }

            const { DorsalConfigService } = await import('../services/dorsalConfigService');
            await DorsalConfigService.delete(company.id, Number(id));
            res.status(200).json({ status: 'success', message: 'Conexão Dorsal excluída com sucesso.' });
        } catch (error: any) {
            res.status(400).json({ status: 'error', message: error.message || 'Erro ao excluir conexão Dorsal.' });
        }
    }

    static async testDorsalConfig(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Acesso negado para esta empresa.' });
                return;
            }

            const body = req.body || {};
            let host = body.serv_dorsal;
            let database = body.bd_dorsal;
            let user = body.login_dorsal;
            let password = body.senha_dorsal;

            // If an ID is passed in params or body and password wasn't provided, fill from existing config
            const configId = req.params.id || body.id;
            if (configId) {
                const { DorsalConfigService } = await import('../services/dorsalConfigService');
                const existing = await DorsalConfigService.getById(Number(configId), company.id);
                if (existing) {
                    host = host !== undefined ? host : existing.serv_dorsal;
                    database = database !== undefined ? database : existing.bd_dorsal;
                    user = user !== undefined ? user : existing.login_dorsal;
                    if (!password) {
                        password = existing.senha_dorsal;
                    }
                }
            }

            const { ExternalDbService } = await import('../services/externalDbService');
            const result = await ExternalDbService.testDorsalConnection({
                host,
                database,
                user,
                password
            });

            res.status(200).json({
                status: 'success',
                ...result
            });
        } catch (error: any) {
            res.status(400).json({
                status: 'error',
                message: error.message || 'Falha ao testar conexão com o banco Dorsal.'
            });
        }
    }

    static async listAlterdataConfigs(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Acesso negado para esta empresa.' });
                return;
            }

            const { AlterdataConfigService } = await import('../services/alterdataConfigService');
            const configs = await AlterdataConfigService.list(company.id);
            res.status(200).json({ status: 'success', data: configs });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message || 'Erro interno do servidor.' });
        }
    }

    static async createAlterdataConfig(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Acesso negado para esta empresa.' });
                return;
            }

            const data = req.body;
            const { AlterdataConfigService } = await import('../services/alterdataConfigService');
            const config = await AlterdataConfigService.create(company.id, data);
            res.status(201).json({ status: 'success', data: config });
        } catch (error: any) {
            res.status(400).json({ status: 'error', message: error.message || 'Erro ao criar conexão Alterdata.' });
        }
    }

    static async updateAlterdataConfig(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const id = req.params.id as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Acesso negado para esta empresa.' });
                return;
            }

            const data = req.body;
            const { AlterdataConfigService } = await import('../services/alterdataConfigService');
            const config = await AlterdataConfigService.update(company.id, Number(id), data);
            res.status(200).json({ status: 'success', data: config });
        } catch (error: any) {
            res.status(400).json({ status: 'error', message: error.message || 'Erro ao atualizar conexão Alterdata.' });
        }
    }

    static async deleteAlterdataConfig(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const id = req.params.id as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Acesso negado para esta empresa.' });
                return;
            }

            const { AlterdataConfigService } = await import('../services/alterdataConfigService');
            await AlterdataConfigService.delete(company.id, Number(id));
            res.status(200).json({ status: 'success', message: 'Conexão Alterdata excluída com sucesso.' });
        } catch (error: any) {
            res.status(400).json({ status: 'error', message: error.message || 'Erro ao excluir conexão Alterdata.' });
        }
    }

    static async testAlterdataConfig(req: Request, res: Response): Promise<void> {
        try {
            const publicId = req.params.companyId as string;
            const company = await CompanyService.getByPublicId(publicId);
            if (!(await CompanyController.hasAccess(req, company.id))) {
                res.status(403).json({ status: 'error', message: 'Acesso negado para esta empresa.' });
                return;
            }

            const body = req.body || {};
            let host = body.serv_alterdata;
            let port = body.porta_alterdata;
            let database = body.bd_alterdata;
            let user = body.login_alterdata;
            let password = body.senha_alterdata;

            // If an ID is passed in params or body and password wasn't provided, fill from existing config
            const configId = req.params.id || body.id;
            if (configId) {
                const { AlterdataConfigService } = await import('../services/alterdataConfigService');
                const existing = await AlterdataConfigService.getById(Number(configId), company.id);
                if (existing) {
                    host = host !== undefined ? host : existing.serv_alterdata;
                    port = port !== undefined ? port : existing.porta_alterdata;
                    database = database !== undefined ? database : existing.bd_alterdata;
                    user = user !== undefined ? user : existing.login_alterdata;
                    if (!password) {
                        password = existing.senha_alterdata;
                    }
                }
            }

            const { ExternalDbService } = await import('../services/externalDbService');
            const result = await ExternalDbService.testAlterdataConnection({
                host,
                port,
                database,
                user,
                password
            });

            res.status(200).json({
                status: 'success',
                ...result
            });
        } catch (error: any) {
            res.status(400).json({
                status: 'error',
                message: error.message || 'Falha ao testar conexão com o banco Alterdata.'
            });
        }
    }
}
