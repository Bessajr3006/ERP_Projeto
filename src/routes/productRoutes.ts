import { Router } from 'express';
import { ProductController } from '../controllers/productController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

router.use(protectRoute, requireTenantContext);

/**
 * @openapi
 * /products:
 *   post:
 *     tags: [Products]
 *     summary: Criar produto
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               price: { type: number }
 *               category_id: { type: string }
 *             required: [name]
 *     responses:
 *       201: { description: Produto criado }
 */
router.post('/', (req, res, next) => ProductController.create(req, res).catch(next));
/**
 * @openapi
 * /products:
 *   get:
 *     tags: [Products]
 *     summary: Listar produtos
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de produtos }
 */
router.get('/', (req, res, next) => ProductController.list(req, res).catch(next));
/**
 * @openapi
 * /products/solidcon-import:
 *   post:
 *     tags: [Products]
 *     summary: Importar produtos (Solidcon)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Importacao iniciada }
 */
router.post('/solidcon-import', (req, res, next) => ProductController.importSolidcon(req, res).catch(next));
/**
 * @openapi
 * /products/bulk-update:
 *   post:
 *     tags: [Products]
 *     summary: Atualizar produtos em lote
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Produtos atualizados }
 */
router.post('/bulk-update', (req, res, next) => ProductController.bulkUpdate(req, res).catch(next));
/**
 * @openapi
 * /products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Obter produto por ID publico
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Produto encontrado }
 *       404: { description: Produto nao encontrado }
 */
router.get('/:id', (req, res, next) => ProductController.getByPublicId(req, res).catch(next));
/**
 * @openapi
 * /products/{id}:
 *   put:
 *     tags: [Products]
 *     summary: Atualizar produto
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Produto atualizado }
 */
router.put('/:id', (req, res, next) => ProductController.update(req, res).catch(next));
/**
 * @openapi
 * /products/{id}:
 *   delete:
 *     tags: [Products]
 *     summary: Remover produto
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Produto removido }
 */
router.delete('/:id', (req, res, next) => ProductController.delete(req, res).catch(next));

export default router;
