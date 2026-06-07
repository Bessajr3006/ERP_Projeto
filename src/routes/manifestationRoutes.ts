import { Router } from 'express';
import { ManifestationController } from '../controllers/manifestationController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

// Endpoint secured by auth token and tenant
/**
 * @openapi
 * /manifestation/consult-destined:
 *   get:
 *     tags: [Manifestation]
 *     summary: Consultar notas destinadas
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Consulta realizada }
 */
router.get('/consult-destined', protectRoute, requireTenantContext, (req, res, next) => ManifestationController.consultDestined(req, res).catch(next));
/**
 * @openapi
 * /manifestation/manifest:
 *   post:
 *     tags: [Manifestation]
 *     summary: Manifestar nota
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Manifestacao registrada }
 */
router.post('/manifest', protectRoute, requireTenantContext, (req, res, next) => ManifestationController.manifest(req, res).catch(next));
/**
 * @openapi
 * /manifestation/status/{jobId}:
 *   get:
 *     tags: [Manifestation]
 *     summary: Consultar status da manifestacao
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Status retornado }
 */
router.get('/status/:jobId', protectRoute, requireTenantContext, (req, res, next) => ManifestationController.checkStatus(req, res).catch(next));

export default router;
