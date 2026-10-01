import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserPayload } from '../types/express'; // Importamos o tipo
import { UserPayloadSchema } from '../schemas/authSchemas';
import { AppError } from '../errors/AppError';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';
import logger from '../config/logger';
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

        // Verifica se a sessão do usuário ainda é a sessão ativa no banco
        const originCompanyId = decoded.group_master_company_id || decoded.general_admin_company_id;
        let userQuery = 'SELECT current_session_token, is_active FROM users WHERE public_id = ?';
        const queryParams: any[] = [decoded.id];

        if (originCompanyId) {
            userQuery += ' AND company_id = ? LIMIT 1';
            queryParams.push(originCompanyId);
        } else if (decoded.role === 'super_admin') {
            userQuery += ' LIMIT 1';
        } else {
            userQuery += ' AND company_id = ? LIMIT 1';
            queryParams.push(decoded.company_id);
        }

        let [userRows] = await pool.query<RowDataPacket[]>(userQuery, queryParams);

        // Fallback: se não encontrou pela empresa de origem, tenta por public_id diretamente
        if (userRows.length === 0) {
            const [fallbackRows] = await pool.query<RowDataPacket[]>(
                'SELECT current_session_token, is_active FROM users WHERE public_id = ? LIMIT 1',
                [decoded.id]
            );
            userRows = fallbackRows;
        }

        const userRecord = userRows[0];
        if (!userRecord || !userRecord.is_active) {
            res.status(401).json({
                status: 'error',
                code: 'USER_INACTIVE_OR_NOT_FOUND',
                error: 'Usuário inativo ou não encontrado.',
                message: 'Usuário inativo ou não encontrado.'
            });
            return;
        }

        const activeToken = userRecord.current_session_token;
        if (activeToken && activeToken !== token) {
            res.status(401).json({
                status: 'error',
                code: 'SESSION_TERMINATED',
                error: 'Sua sessão foi encerrada porque este usuário realizou login em outro local ou dispositivo.',
                message: 'Sua sessão foi encerrada porque este usuário realizou login em outro local ou dispositivo.'
            });
            return;
        }
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
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

export const requireSuperAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.user && req.user.role === 'super_admin') {
        next();
        return;
    }

    if (req.user) {
        if (req.user.general_admin_company_id) {
            next();
            return;
        }

        try {
            const [rows] = await pool.query<RowDataPacket[]>(
                'SELECT id FROM companies WHERE is_general_admin = 1 LIMIT 1'
            );
            const generalAdminCompanyId = rows[0]?.id;

            if (generalAdminCompanyId && req.user.company_id === generalAdminCompanyId) {
                next();
                return;
            }
        } catch (err) {
            logger.error({ err }, 'Error checking general admin company in middleware');
        }
    }

    res.status(403).json({ error: 'Acesso restrito ao super admin.' });
};

export const requireSuperAdminOrGroupMaster = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.user && req.user.role === 'super_admin') {
        next();
        return;
    }

    if (req.user) {
        if (req.user.general_admin_company_id) {
            next();
            return;
        }

        try {
            // 1. ADM Geral check (mantém lógica do ADM Geral 100% intacta)
            const [genRows] = await pool.query<RowDataPacket[]>(
                'SELECT id FROM companies WHERE is_general_admin = 1 LIMIT 1'
            );
            const generalAdminCompanyId = genRows[0]?.id;

            if (generalAdminCompanyId && req.user.company_id === generalAdminCompanyId) {
                next();
                return;
            }

            // 2. Verifica se a empresa atual do usuário é Empresa Master do Grupo
            const [companyRows] = await pool.query<RowDataPacket[]>(
                'SELECT id, company_group_id, is_group_master FROM companies WHERE id = ? LIMIT 1',
                [req.user.company_id]
            );
            const currentCompany = companyRows[0];
            if (currentCompany && currentCompany.company_group_id && (currentCompany.is_group_master === 1 || currentCompany.is_group_master === true)) {
                next();
                return;
            }

            // 3. Verifica se o usuário trocou de contexto a partir de uma Empresa Master do Grupo
            if (req.user.group_master_company_id) {
                const [masterRows] = await pool.query<RowDataPacket[]>(
                    'SELECT id, company_group_id, is_group_master FROM companies WHERE id = ? LIMIT 1',
                    [req.user.group_master_company_id]
                );
                const masterCompany = masterRows[0];
                if (masterCompany && masterCompany.company_group_id && (masterCompany.is_group_master === 1 || masterCompany.is_group_master === true)) {
                    next();
                    return;
                }
            }
        } catch (err) {
            logger.error({ err }, 'Error checking super admin / group master in middleware');
        }
    }

    res.status(403).json({ error: 'Acesso restrito ao super admin ou empresa master do grupo.' });
};

export const requireAdminOrSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
        next();
    } else {
        res.status(403).json({ error: 'Acesso restrito a administradores.' });
        return;
    }
};
