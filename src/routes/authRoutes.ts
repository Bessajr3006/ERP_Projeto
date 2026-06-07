import { Router, Request, Response } from 'express';
import { AuthController } from '../controllers/authController';
import { CompanyService } from '../services/companyService';
import { PermissionService } from '../services/permissionService';
import { UserService } from '../services/userService';
import { protectRoute } from '../middlewares/authMiddleware';
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
        fullUser = await UserService.getById(user.company_id, user.id);
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

    if (user.role === 'super_admin') {
        try {
            companies = await CompanyService.getAllVisible();
        } catch (err) {
            logger.warn({ err, userId: user.id }, '[/me] Não foi possível buscar lista global de empresas para o super admin');
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

export default router;
