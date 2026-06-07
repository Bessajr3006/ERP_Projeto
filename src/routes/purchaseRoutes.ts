import { Router } from 'express';
import { PurchaseController } from '../controllers/purchaseController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

// Apply auth & tenant context to ALL purchase routes (consistent with all other modules)
router.use(protectRoute, requireTenantContext);

/**
 * @openapi
 * /purchases:
 *   get:
 *     tags: [Purchases]
 *     summary: Listar compras
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de compras }
 */
router.get('/', (req, res, next) => PurchaseController.getAll(req, res).catch(next));
/**
 * @openapi
 * /purchases/{id}:
 *   get:
 *     tags: [Purchases]
 *     summary: Obter compra por ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Compra encontrada }
 *       404: { description: Compra nao encontrada }
 */
router.get('/:id', (req, res, next) => PurchaseController.getById(req, res).catch(next));
/**
 * @openapi
 * /purchases:
 *   post:
 *     tags: [Purchases]
 *     summary: Criar compra
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Compra criada }
 */
router.post('/', (req, res, next) => PurchaseController.create(req, res).catch(next));
/**
 * @openapi
 * /purchases/{id}:
 *   delete:
 *     tags: [Purchases]
 *     summary: Remover compra
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Compra removida }
 */
router.delete('/:id', (req, res, next) => PurchaseController.delete(req, res).catch(next));

export default router;
