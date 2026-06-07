import { Router } from 'express';
import { EstoqueController } from '../controllers/estoqueController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

router.use(protectRoute, requireTenantContext);

router.get('/analytics/stock-vision', (req, res, next) => EstoqueController.getStockVisionAnalytics(req, res).catch(next));

// Categories
/**
 * @openapi
 * /estoque/categories:
 *   post:
 *     tags: [Estoque]
 *     summary: Criar categoria de produto
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProductCategoryRequest'
 *     responses:
 *       201:
 *         description: Categoria criada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   $ref: '#/components/schemas/ProductCategory'
 *       400:
 *         description: Nome obrigatorio
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         description: Nao autenticado
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.post('/categories',    (req, res, next) => EstoqueController.createCategory(req, res).catch(next));
/**
 * @openapi
 * /estoque/categories:
 *   get:
 *     tags: [Estoque]
 *     summary: Listar categorias de produto
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de categorias
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ProductCategory'
 *       401:
 *         description: Nao autenticado
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get('/categories',     (req, res, next) => EstoqueController.listCategories(req, res).catch(next));
/**
 * @openapi
 * /estoque/categories/{id}:
 *   put:
 *     tags: [Estoque]
 *     summary: Atualizar categoria de produto
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         description: Public ID da categoria
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProductCategoryRequest'
 *     responses:
 *       200:
 *         description: Categoria atualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   $ref: '#/components/schemas/ProductCategory'
 *       401:
 *         description: Nao autenticado
 *       404:
 *         description: Categoria nao encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.put('/categories/:id', (req, res, next) => EstoqueController.updateCategory(req, res).catch(next));
/**
 * @openapi
 * /estoque/categories/{id}:
 *   delete:
 *     tags: [Estoque]
 *     summary: Remover categoria de produto
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         description: Public ID da categoria
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Categoria removida
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 message: { type: string, example: Category deleted }
 *       401:
 *         description: Nao autenticado
 *       404:
 *         description: Categoria nao encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.delete('/categories/:id', (req, res, next) => EstoqueController.deleteCategory(req, res).catch(next));

// Stock Types
router.post('/stock-types', (req, res, next) => EstoqueController.createStockType(req, res).catch(next));
router.get('/stock-types', (req, res, next) => EstoqueController.listStockTypes(req, res).catch(next));
router.put('/stock-types/:id', (req, res, next) => EstoqueController.updateStockType(req, res).catch(next));
router.delete('/stock-types/:id', (req, res, next) => EstoqueController.deleteStockType(req, res).catch(next));

// Manufacturers
/**
 * @openapi
 * /estoque/manufacturers:
 *   post:
 *     tags: [Estoque]
 *     summary: Criar fabricante
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Fabricante criado }
 */
router.post('/manufacturers',    (req, res, next) => EstoqueController.createManufacturer(req, res).catch(next));
/**
 * @openapi
 * /estoque/manufacturers:
 *   get:
 *     tags: [Estoque]
 *     summary: Listar fabricantes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de fabricantes }
 */
router.get('/manufacturers',     (req, res, next) => EstoqueController.listManufacturers(req, res).catch(next));
/**
 * @openapi
 * /estoque/manufacturers/{id}:
 *   put:
 *     tags: [Estoque]
 *     summary: Atualizar fabricante
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Fabricante atualizado }
 */
router.put('/manufacturers/:id', (req, res, next) => EstoqueController.updateManufacturer(req, res).catch(next));
/**
 * @openapi
 * /estoque/manufacturers/{id}:
 *   delete:
 *     tags: [Estoque]
 *     summary: Remover fabricante
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Fabricante removido }
 */
router.delete('/manufacturers/:id', (req, res, next) => EstoqueController.deleteManufacturer(req, res).catch(next));

// Tax Rules
/**
 * @openapi
 * /estoque/taxes:
 *   post:
 *     tags: [Estoque]
 *     summary: Criar regra tributaria
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Regra criada }
 */
router.post('/taxes',    (req, res, next) => EstoqueController.createTaxRule(req, res).catch(next));
/**
 * @openapi
 * /estoque/taxes:
 *   get:
 *     tags: [Estoque]
 *     summary: Listar regras tributarias
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de regras }
 */
router.get('/taxes',     (req, res, next) => EstoqueController.listTaxRules(req, res).catch(next));
/**
 * @openapi
 * /estoque/taxes/{id}:
 *   put:
 *     tags: [Estoque]
 *     summary: Atualizar regra tributaria
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Regra atualizada }
 */
router.put('/taxes/:id', (req, res, next) => EstoqueController.updateTaxRule(req, res).catch(next));
/**
 * @openapi
 * /estoque/taxes/{id}:
 *   delete:
 *     tags: [Estoque]
 *     summary: Remover regra tributaria
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Regra removida }
 */
router.delete('/taxes/:id', (req, res, next) => EstoqueController.deleteTaxRule(req, res).catch(next));

// Price Tables
/**
 * @openapi
 * /estoque/prices:
 *   post:
 *     tags: [Estoque]
 *     summary: Criar tabela de preco
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Tabela criada }
 */
router.post('/prices',    (req, res, next) => EstoqueController.createPriceTable(req, res).catch(next));
/**
 * @openapi
 * /estoque/prices:
 *   get:
 *     tags: [Estoque]
 *     summary: Listar tabelas de preco
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de tabelas }
 */
router.get('/prices',     (req, res, next) => EstoqueController.listPriceTables(req, res).catch(next));
/**
 * @openapi
 * /estoque/prices/{id}:
 *   put:
 *     tags: [Estoque]
 *     summary: Atualizar tabela de preco
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Tabela atualizada }
 */
router.put('/prices/:id', (req, res, next) => EstoqueController.updatePriceTable(req, res).catch(next));
/**
 * @openapi
 * /estoque/prices/{id}:
 *   delete:
 *     tags: [Estoque]
 *     summary: Remover tabela de preco
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Tabela removida }
 */
router.delete('/prices/:id', (req, res, next) => EstoqueController.deletePriceTable(req, res).catch(next));

// Measures
/**
 * @openapi
 * /estoque/measures:
 *   post:
 *     tags: [Estoque]
 *     summary: Criar medida
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Medida criada }
 */
router.post('/measures',    (req, res, next) => EstoqueController.createMeasure(req, res).catch(next));
/**
 * @openapi
 * /estoque/measures:
 *   get:
 *     tags: [Estoque]
 *     summary: Listar medidas
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de medidas }
 */
router.get('/measures',     (req, res, next) => EstoqueController.listMeasures(req, res).catch(next));
/**
 * @openapi
 * /estoque/measures/{id}:
 *   put:
 *     tags: [Estoque]
 *     summary: Atualizar medida
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Medida atualizada }
 */
router.put('/measures/:id', (req, res, next) => EstoqueController.updateMeasure(req, res).catch(next));
/**
 * @openapi
 * /estoque/measures/{id}:
 *   delete:
 *     tags: [Estoque]
 *     summary: Remover medida
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Medida removida }
 */
router.delete('/measures/:id', (req, res, next) => EstoqueController.deleteMeasure(req, res).catch(next));

// Service Types
/**
 * @openapi
 * /estoque/service-types:
 *   post:
 *     tags: [Estoque]
 *     summary: Criar tipo de servico
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Tipo de servico criado }
 */
router.post('/service-types', (req, res, next) => EstoqueController.createServiceType(req, res).catch(next));
/**
 * @openapi
 * /estoque/service-types:
 *   get:
 *     tags: [Estoque]
 *     summary: Listar tipos de servico
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de tipos de servico }
 */
router.get('/service-types', (req, res, next) => EstoqueController.listServiceTypes(req, res).catch(next));
/**
 * @openapi
 * /estoque/service-types/{id}:
 *   put:
 *     tags: [Estoque]
 *     summary: Atualizar tipo de servico
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Tipo de servico atualizado }
 */
router.put('/service-types/:id', (req, res, next) => EstoqueController.updateServiceType(req, res).catch(next));
/**
 * @openapi
 * /estoque/service-types/{id}:
 *   delete:
 *     tags: [Estoque]
 *     summary: Remover tipo de servico
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Tipo de servico removido }
 */
router.delete('/service-types/:id', (req, res, next) => EstoqueController.deleteServiceType(req, res).catch(next));

// Services
/**
 * @openapi
 * /estoque/services:
 *   post:
 *     tags: [Estoque]
 *     summary: Criar servico
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Servico criado }
 */
router.post('/services', (req, res, next) => EstoqueController.createService(req, res).catch(next));
/**
 * @openapi
 * /estoque/services:
 *   get:
 *     tags: [Estoque]
 *     summary: Listar servicos
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de servicos }
 */
router.get('/services', (req, res, next) => EstoqueController.listServices(req, res).catch(next));
/**
 * @openapi
 * /estoque/services/{id}:
 *   put:
 *     tags: [Estoque]
 *     summary: Atualizar servico
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Servico atualizado }
 */
router.put('/services/:id', (req, res, next) => EstoqueController.updateService(req, res).catch(next));
/**
 * @openapi
 * /estoque/services/{id}:
 *   delete:
 *     tags: [Estoque]
 *     summary: Remover servico
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Servico removido }
 */
router.delete('/services/:id', (req, res, next) => EstoqueController.deleteService(req, res).catch(next));

// Service Launches
router.post('/service-launches', (req, res, next) => EstoqueController.createServiceLaunch(req, res).catch(next));
router.get('/service-launches', (req, res, next) => EstoqueController.listServiceLaunches(req, res).catch(next));
router.put('/service-launches/:id', (req, res, next) => EstoqueController.updateServiceLaunch(req, res).catch(next));
router.delete('/service-launches/:id', (req, res, next) => EstoqueController.deleteServiceLaunch(req, res).catch(next));

export default router;
