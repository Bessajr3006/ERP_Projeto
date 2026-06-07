import { Router } from 'express';
import { EmailConfigController } from '../controllers/emailConfigController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

router.use(protectRoute, requireTenantContext);

/**
 * @openapi
 * /email-config:
 *   get:
 *     tags: [EmailConfig]
 *     summary: Retorna a configuração de e-mail da empresa
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Configuração de e-mail }
 */
router.get('/', (req, res, next) => EmailConfigController.get(req, res).catch(next));

/**
 * @openapi
 * /email-config:
 *   post:
 *     tags: [EmailConfig]
 *     summary: Salva a configuração de e-mail da empresa
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Configuração salva }
 */
router.post('/', (req, res, next) => EmailConfigController.save(req, res).catch(next));

router.get('/sync-inbox', (req, res, next) => EmailConfigController.syncInbox(req, res).catch(next));

export default router;
