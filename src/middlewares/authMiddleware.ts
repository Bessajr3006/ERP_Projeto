import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserPayload } from '../types/express'; // Importamos o tipo
import { UserPayloadSchema } from '../schemas/authSchemas';
import { AppError } from '../errors/AppError';
import { CompanyService } from '../services/companyService';
import { attachAuditActivityListener } from './auditMiddleware';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_production';

export const protectRoute = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // 1. Verifica se o header de autorização existe ou se o token está na query
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1] || '';
    } else if (req.query.token && typeof req.query.token === 'string') {
        token = req.query.token;
    }

    if (!token) {
        res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
        return;
    }

    // 3. Verifica e decodifica o token
    try {
        if (token.startsWith('swg_')) {
            const company = await CompanyService.getBySwaggerToken(token);
            const swaggerPayload: UserPayload = {
                id: `swagger:${company.public_id}`,
                role: 'admin',
                company_id: company.id,
            };
            req.user = swaggerPayload;
            attachAuditActivityListener(req, res);
            next();
            return;
        }

        const verifiedToken = jwt.verify(token, JWT_SECRET);
        const decoded = UserPayloadSchema.parse(verifiedToken) as UserPayload;
        req.user = decoded;
    } catch (error) {
        throw new AppError('Token inválido ou expirado.', 401);
    }

    // 4. Injeta o usuário na requisição!
    attachAuditActivityListener(req, res);
    next();
};

// Middleware extra para barrar usuários em rotas exclusivas de admin
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Acesso restrito a administradores.' });
        return;
    }
};

export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
    if (req.user && req.user.role === 'super_admin') {
        next();
    } else {
        res.status(403).json({ error: 'Acesso restrito ao super admin.' });
        return;
    }
};
