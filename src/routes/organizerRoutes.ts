import { Router } from 'express';
import { OrganizerController } from '../controllers/organizerController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

router.use(protectRoute, requireTenantContext);

/**
 * @openapi
 * /organizer:
 *   get:
 *     tags: [Organizer]
 *     summary: Obter organizador
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Organizer retornado }
 */
router.get('/', (req, res, next) => OrganizerController.get(req, res).catch(next));
/**
 * @openapi
 * /organizer:
 *   put:
 *     tags: [Organizer]
 *     summary: Atualizar organizador
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Organizer atualizado }
 */
router.put('/', (req, res, next) => OrganizerController.update(req, res).catch(next));

export default router;