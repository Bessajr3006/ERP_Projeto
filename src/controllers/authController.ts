import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/authService';
import logger from '../config/logger';
import { AuditService } from '../services/auditService';
import { GeoIpService } from '../services/geoIpService';
import { SessionConflictError } from '../errors/SessionConflictError';
import { ALLOWED_USER_ROLES, canManageRole } from '../utils/roleHierarchy';

// Zod Schemas for Validation
const registerSchema = z.object({
    company_id: z.number().int().positive().optional(),
    email: z.string().email('Invalid email format'),
    passwordRaw: z.string().min(10, 'A senha deve ter no mínimo 10 caracteres'),
    full_name: z.string().min(2, 'Name must be at least 2 characters long'),
    role: z.enum(ALLOWED_USER_ROLES).default('user'),
});

const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    passwordRaw: z.string().min(1, 'Password is required'), // Don't enforce min length on login, just presence
    force: z.boolean().optional()
});

const faceLoginSchema = z.object({
    descriptor: z.array(z.number()).length(128, 'Descriptor facial deve conter 128 números'),
    email: z.string().optional(),
    force: z.boolean().optional()
});

const changePasswordSchema = z.object({
    currentPasswordRaw: z.string().min(1, 'Senha atual é obrigatória'),
    newPasswordRaw: z.string().min(10, 'A nova senha deve ter no mínimo 10 caracteres')
});

export class AuthController {
    private static async recordAuthActivity(req: Request, result: any, action: 'CREATE' | 'LOGIN', description: string): Promise<void> {
        try {
            await AuditService.recordActivity({
                companyId: Number(result?.user?.company_id),
                userPublicId: result?.user?.public_id || null,
                action,
                module: 'auth',
                description,
                entityType: 'auth',
                entityId: result?.user?.public_id || null,
                method: req.method,
                path: req.originalUrl || req.url,
                ipAddress: GeoIpService.extractClientIp(req),
                userAgent: String(req.headers['user-agent'] || ''),
                metadata: { email: result?.user?.email || null },
            });
        } catch (err) {
            logger.warn({ err, path: req.originalUrl || req.url }, '[audit] Falha ao registrar atividade de autenticação');
        }
    }

    static async register(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({ status: 'error', message: 'Acesso negado. Não autenticado.' });
                return;
            }

            // Validate request body
            const validatedData = registerSchema.parse(req.body);
            const targetRole = validatedData.role;
            const callerRole = req.user.role;

            // Checagem de hierarquia: valida se o chamador pode gerenciar o papel alvo
            if (!canManageRole(callerRole, targetRole)) {
                res.status(403).json({
                    status: 'error',
                    message: 'Não é permitido criar usuário com papel superior ao seu'
                });
                return;
            }

            // SEMPRE usa o company_id do token autenticado (nunca o do corpo da requisição)
            const companyId = req.user.company_id;
            const ipAddress = GeoIpService.extractClientIp(req);
            const userAgent = String(req.headers['user-agent'] || '');

            // Call Service
            const result = await AuthService.register({
                ...validatedData,
                company_id: companyId,
                role: targetRole,
                ipAddress,
                userAgent
            });
            await AuthController.recordAuthActivity(req, result, 'CREATE', 'Criou acesso no sistema');

            res.status(201).json({
                status: 'success',
                data: result
            });
        } catch (error: any) {
            if (error instanceof z.ZodError || (error && error.name === 'ZodError')) {
                // Validation Error
                res.status(400).json({ status: 'error', errors: error.errors });
                return;
            }

            if (error instanceof Error && error.message === 'Email already registered') {
                // Conflict
                res.status(409).json({ status: 'error', message: error.message });
                return;
            }

            console.error('[AuthController/register] Exception:', error);
            // Propagate to global error handler
            throw error;
        }
    }

    static async login(req: Request, res: Response): Promise<void> {
        try {
            // Validate request body
            const validatedData = loginSchema.parse(req.body);
            const ipAddress = GeoIpService.extractClientIp(req);
            const userAgent = String(req.headers['user-agent'] || '');

            // Call Service
            const result = await AuthService.login({
                ...validatedData,
                ipAddress,
                userAgent
            });
            await AuthController.recordAuthActivity(req, result, 'LOGIN', 'Entrou no sistema');

            res.status(200).json({
                status: 'success',
                data: result
            });
        } catch (error: any) {
            if (error instanceof SessionConflictError) {
                res.status(409).json({
                    status: 'error',
                    code: 'SESSION_CONFLICT',
                    message: error.message,
                    data: error.sessionInfo
                });
                return;
            }

            if (error instanceof z.ZodError || (error && error.name === 'ZodError')) {
                // Validation Error
                res.status(400).json({ status: 'error', errors: error.errors });
                return;
            }

            if (error instanceof Error && (error.message === 'Invalid credentials' || error.message === 'User account is deactivated')) {
                // Unauthorized
                res.status(401).json({ status: 'error', message: error.message });
                return;
            }

            console.error('[AuthController/login] Exception:', error);
            // Propagate to global error handler
            throw error;
        }
    }

    static async logout(req: Request, res: Response): Promise<void> {
        try {
            const userPublicId = req.user?.id;
            if (userPublicId && !userPublicId.startsWith('swagger:')) {
                await AuthService.logout(userPublicId);
            }
            res.status(200).json({
                status: 'success',
                message: 'Sessão encerrada com sucesso.'
            });
        } catch (error: any) {
            console.error('[AuthController/logout] Exception:', error);
            res.status(200).json({ status: 'success', message: 'Sessão encerrada.' });
        }
    }

    static async changePassword(req: Request, res: Response): Promise<void> {
        try {
            const companyId = req.user!.company_id;
            const userPublicId = req.user!.id;
            
            const validatedData = changePasswordSchema.parse(req.body);
            
            await AuthService.changePassword(
                companyId,
                userPublicId,
                validatedData.currentPasswordRaw,
                validatedData.newPasswordRaw
            );
            
            res.status(200).json({
                status: 'success',
                message: 'Senha alterada com sucesso'
            });
        } catch (error: any) {
            if (error instanceof z.ZodError || (error && error.name === 'ZodError')) {
                res.status(400).json({ status: 'error', errors: error.errors });
                return;
            }
            if (error instanceof Error && error.message === 'Senha atual incorreta') {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }
            console.error('[AuthController/changePassword] Exception:', error);
            throw error;
        }
    }

    static async loginByFace(req: Request, res: Response): Promise<void> {
        try {
            const validatedData = faceLoginSchema.parse(req.body);
            const ipAddress = GeoIpService.extractClientIp(req);
            const userAgent = String(req.headers['user-agent'] || '');
            
            const result = await AuthService.loginByFace(
                validatedData.descriptor, 
                validatedData.email,
                validatedData.force,
                ipAddress,
                userAgent
            );
            await AuthController.recordAuthActivity(req, result, 'LOGIN', 'Entrou no sistema via reconhecimento facial');

            res.status(200).json({
                status: 'success',
                data: result
            });
        } catch (error: any) {
            if (error instanceof SessionConflictError) {
                res.status(409).json({
                    status: 'error',
                    code: 'SESSION_CONFLICT',
                    message: error.message,
                    data: error.sessionInfo
                });
                return;
            }

            if (error instanceof z.ZodError || (error && error.name === 'ZodError')) {
                res.status(400).json({ status: 'error', errors: error.errors });
                return;
            }
            if (error instanceof Error && (error.message.includes('falhou') || error.message.includes('não cadastrada') || error.message.includes('Nenhum usuário'))) {
                res.status(401).json({ status: 'error', message: error.message });
                return;
            }
            console.error('[AuthController/loginByFace] Exception:', error);
            res.status(500).json({ status: 'error', message: error.message || 'Erro no reconhecimento facial.' });
        }
    }

    static async refreshToken(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({ status: 'error', message: 'Acesso negado. Não autenticado.' });
                return;
            }

            const authHeader = req.headers.authorization;
            const currentToken = authHeader && authHeader.startsWith('Bearer ')
                ? authHeader.split(' ')[1]?.trim() || ''
                : '';

            if (!currentToken) {
                res.status(401).json({ status: 'error', message: 'Token não fornecido.' });
                return;
            }

            const ipAddress = GeoIpService.extractClientIp(req);
            const userAgent = String(req.headers['user-agent'] || '');

            const result = await AuthService.refreshToken(
                req.user,
                currentToken,
                ipAddress,
                userAgent
            );

            res.status(200).json({
                status: 'success',
                data: result
            });
        } catch (error: any) {
            console.error('[AuthController/refreshToken] Exception:', error);
            res.status(401).json({
                status: 'error',
                message: error.message || 'Falha ao renovar sessão.'
            });
        }
    }
}

