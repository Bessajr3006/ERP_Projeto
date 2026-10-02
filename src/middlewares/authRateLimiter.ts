import { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';

/**
 * Rate limiter específico para endpoints de autenticação sensíveis (/login, /register, /login-by-face).
 * Limita a 5 tentativas por janela de 15 minutos por combinação de IP + E-mail.
 */
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    limit: 5, // 5 tentativas por IP + email
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req: Request): string => {
        const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const email = String(req.body?.email || '').trim().toLowerCase();
        return `${clientIp}_${email}`;
    },
    handler: (_req: Request, res: Response) => {
        res.status(429).json({
            status: 'error',
            code: 'AUTH_RATE_LIMIT_EXCEEDED',
            message: 'Muitas tentativas de autenticação. Por favor, aguarde 15 minutos antes de tentar novamente.'
        });
    }
});
