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
 *             $ref: '#/components/schemas/CreateProductRequest'
 *     responses:
 *       201:
 *         description: Produto criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       400:
 *         description: Dados invalidos ou ausentes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       409:
 *         description: SKU ja cadastrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
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
 *       200:
 *         description: Lista de produtos recuperada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkUpdateProductsRequest'
 *     responses:
 *       200:
 *         description: Produtos atualizados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 message: { type: string, example: "X produtos atualizados com sucesso" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     count: { type: integer, example: 5 }
 */
router.post('/bulk-update', (req, res, next) => ProductController.bulkUpdate(req, res).catch(next));
router.post('/bulk-delete', (req, res, next) => ProductController.bulkDelete(req, res).catch(next));
/**
 * @openapi
 * /products/send-catalog:
 *   post:
 *     tags: [Products]
 *     summary: Enviar catálogo de produtos em PDF por WhatsApp
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone: { type: string }
 *             required: [phone]
 *     responses:
 *       200: { description: Catálogo enviado com sucesso }
 *       400: { description: Erro na solicitação }
 * */
router.post('/send-catalog', (req, res, next) => ProductController.sendCatalog(req, res).catch(next));

/**
 * @openapi
 * /products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Obter produto por ID publico (UUID)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Produto encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       404:
 *         description: Produto nao encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
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
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProductRequest'
 *     responses:
 *       200:
 *         description: Produto atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       400:
 *         description: Dados invalidos ou ausentes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: Produto nao encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
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
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Produto removido }
 *       404:
 *         description: Produto nao encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.delete('/:id', (req, res, next) => ProductController.delete(req, res).catch(next));

export default router;
