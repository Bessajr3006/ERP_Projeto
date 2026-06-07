import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/authService';
import logger from '../config/logger';
import { AuditService } from '../services/auditService';

// Zod Schemas for Validation
const registerSchema = z.object({
    company_id: z.number().int().positive('Invalid company ID'),
    email: z.string().email('Invalid email format'),
    passwordRaw: z.string().min(8, 'Password must be at least 8 characters long'),
    full_name: z.string().min(2, 'Name must be at least 2 characters long'),
});

const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    passwordRaw: z.string().min(1, 'Password is required'), // Don't enforce min length on login, just presence
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
                ipAddress: req.ip || req.socket.remoteAddress || null,
                userAgent: String(req.headers['user-agent'] || ''),
                metadata: { email: result?.user?.email || null },
            });
        } catch (err) {
            logger.warn({ err, path: req.originalUrl || req.url }, '[audit] Falha ao registrar atividade de autenticação');
        }
    }

    static async register(req: Request, res: Response): Promise<void> {
        try {
            // Validate request body
            const validatedData = registerSchema.parse(req.body);

            // Call Service
            const result = await AuthService.register(validatedData);
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

            // Call Service
            const result = await AuthService.login(validatedData);
            await AuthController.recordAuthActivity(req, result, 'LOGIN', 'Entrou no sistema');

            res.status(200).json({
                status: 'success',
                data: result
            });
        } catch (error: any) {
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
}
