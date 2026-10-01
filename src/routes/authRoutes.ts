import { Router, Request, Response } from 'express';
import { AuthController } from '../controllers/authController';
import { CompanyService } from '../services/companyService';
import { PermissionService } from '../services/permissionService';
import { UserService } from '../services/userService';
import { WhatsAppBusinessService } from '../services/whatsappBusinessService';
import { protectRoute } from '../middlewares/authMiddleware';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';
import logger from '../config/logger';

const router = Router();

// Public Routes
// Passing explicitly to catch errors inside the promise and forward to next() if we weren't doing custom try/catch
// Note: Next version of express handles async natively, but here we invoke it directly.
/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Criar conta e empresa
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               company_name: { type: string }
 *             required: [name, email, password, company_name]
 *     responses:
 *       201: { description: Registrado com sucesso }
 */
router.post('/register', (req, res, next) => AuthController.register(req, res).catch(next));
/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Autenticar usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *             required: [email, password]
 *     responses:
 *       200: { description: Login bem-sucedido }
 *       401: { description: Credenciais invalidas }
 */
router.post('/login', (req, res, next) => AuthController.login(req, res).catch(next));
router.post('/login-by-face', (req, res, next) => AuthController.loginByFace(req, res).catch(next));

// Protected Route Example
/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Dados do usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Usuario autenticado }
 *       401: { description: Nao autorizado }
 */
router.get('/me', protectRoute, async (req: Request, res: Response) => {
    // At this point, req.user is guaranteed to exist and match UserPayload due to the middleware constraint.
    const user = req.user!;
    let fullUser: any = user;
    let companyDetails = null;
    let permissions: any[] = [];
    let companies: any[] = [];

    try {
        const originCompanyId = (user as any).group_master_company_id || (user as any).general_admin_company_id;
        let dbUser: any = null;
        if (originCompanyId) {
            try {
                dbUser = await UserService.getById(originCompanyId, user.id);
            } catch (_e) {}
        }
        if (!dbUser) {
            try {
                dbUser = await UserService.getById(user.company_id, user.id);
            } catch (_e) {}
        }
        if (!dbUser) {
            const [globalUsers] = await pool.query<RowDataPacket[]>(
                'SELECT public_id, email, full_name, role, is_active FROM users WHERE public_id = ? LIMIT 1',
                [user.id]
            );
            if (globalUsers.length > 0) {
                dbUser = globalUsers[0];
            }
        }
        let wsStatus = 'disconnected';
        let wsNumber: string | null = null;
        let wsName: string | null = null;
        try {
            const session = await WhatsAppBusinessService.getUserSessionStatus(user.company_id, user.id);
            wsStatus = session.status;
            wsNumber = session.connected_number;
            wsName = session.connected_name;
        } catch (sessionErr) {
            // Ignore session errors
        }
        fullUser = {
            ...dbUser,
            group_master_company_id: (user as any).group_master_company_id,
            general_admin_company_id: (user as any).general_admin_company_id,
            whatsapp_status: wsStatus,
            whatsapp_number: wsNumber,
            whatsapp_name: wsName
        };
    } catch (err) {
        logger.warn({ err, userId: user.id, companyId: user.company_id }, '[/me] Não foi possível buscar dados completos do usuário');
    }

    try {
        companyDetails = await CompanyService.getById(user.company_id);
    } catch (err) {
        logger.warn({ err, companyId: user.company_id }, '[/me] Não foi possível buscar dados da empresa');
    }

    try {
        permissions = await PermissionService.getByRole(user.company_id, user.role);
    } catch (err) {
        logger.warn({ err, role: user.role, companyId: user.company_id }, '[/me] Não foi possível buscar permissões do usuário');
    }

    if (user.role === 'super_admin' || companyDetails?.is_general_admin || (user as any).general_admin_company_id) {
        try {
            companies = await CompanyService.getAllVisible();
        } catch (err) {
            logger.warn({ err, userId: user.id }, '[/me] Não foi possível buscar lista global de empresas para o super admin');
        }
    } else if (companyDetails?.is_group_master && companyDetails?.company_group_id) {
        try {
            companies = await CompanyService.getAllInGroup(companyDetails.company_group_id);
        } catch (err) {
            logger.warn({ err, userId: user.id }, '[/me] Não foi possível buscar empresas do grupo para empresa master');
        }
    } else if ((user as any).group_master_company_id) {
        try {
            const master = await CompanyService.getById((user as any).group_master_company_id);
            if (master && master.company_group_id) {
                companies = await CompanyService.getAllInGroup(master.company_group_id);
            }
        } catch (err) {
            logger.warn({ err, userId: user.id }, '[/me] Não foi possível buscar empresas do grupo para contexto master');
        }
    }

    res.status(200).json({
        status: 'success',
        data: {
            message: 'You have access to this protected route.',
            user: fullUser,
            company: companyDetails,
            permissions: permissions,
            companies: companies
        }
    });
});

router.post('/change-password', protectRoute, (req, res, next) => AuthController.changePassword(req, res).catch(next));
router.post('/logout', protectRoute, (req, res, next) => AuthController.logout(req, res).catch(next));

export default router;
