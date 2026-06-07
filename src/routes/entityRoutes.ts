import { Router } from 'express';
import { EntityController } from '../controllers/entityController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

router.use(protectRoute, requireTenantContext);

/**
 * @openapi
 * /entities/suppliers:
 *   post:
 *     tags: [Entities]
 *     summary: Criar fornecedor
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Fornecedor criado }
 */
router.post('/suppliers', (req, res, next) => EntityController.createSupplier(req, res).catch(next));
/**
 * @openapi
 * /entities/suppliers:
 *   get:
 *     tags: [Entities]
 *     summary: Listar fornecedores
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de fornecedores }
 */
router.get('/suppliers', (req, res, next) => EntityController.listSuppliers(req, res).catch(next));
/**
 * @openapi
 * /entities/suppliers/{id}:
 *   put:
 *     tags: [Entities]
 *     summary: Atualizar fornecedor
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Fornecedor atualizado }
 */
router.put('/suppliers/:id', (req, res, next) => EntityController.updateSupplier(req, res).catch(next));
/**
 * @openapi
 * /entities/suppliers/{id}:
 *   delete:
 *     tags: [Entities]
 *     summary: Remover fornecedor
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Fornecedor removido }
 */
router.delete('/suppliers/:id', (req, res, next) => EntityController.deleteSupplier(req, res).catch(next));

/**
 * @openapi
 * /entities/customers:
 *   post:
 *     tags: [Entities]
 *     summary: Criar cliente
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Cliente criado }
 */
router.post('/customers', (req, res, next) => EntityController.createCustomer(req, res).catch(next));
/**
 * @openapi
 * /entities/customers:
 *   get:
 *     tags: [Entities]
 *     summary: Listar clientes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de clientes }
 */
router.get('/customers', (req, res, next) => EntityController.listCustomers(req, res).catch(next));
/**
 * @openapi
 * /entities/customers/solidcon-import:
 *   post:
 *     tags: [Entities]
 *     summary: Importar clientes via Solidcon
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Importacao concluida }
 */
router.post('/customers/solidcon-import', (req, res, next) => EntityController.importCustomersSolidcon(req, res).catch(next));
/**
 * @openapi
 * /entities/customers/{id}:
 *   put:
 *     tags: [Entities]
 *     summary: Atualizar cliente
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Cliente atualizado }
 */
router.put('/customers/:id', (req, res, next) => EntityController.updateCustomer(req, res).catch(next));
/**
 * @openapi
 * /entities/customers/{id}:
 *   delete:
 *     tags: [Entities]
 *     summary: Remover cliente
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Cliente removido }
 */
router.delete('/customers/:id', (req, res, next) => EntityController.deleteCustomer(req, res).catch(next));

/**
 * @openapi
 * /entities/contacts:
 *   post:
 *     tags: [Entities]
 *     summary: Criar contato
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Contato criado }
 */
router.post('/contacts', (req, res, next) => EntityController.createContact(req, res).catch(next));
/**
 * @openapi
 * /entities/contacts:
 *   get:
 *     tags: [Entities]
 *     summary: Listar contatos
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de contatos }
 */
router.get('/contacts', (req, res, next) => EntityController.listContacts(req, res).catch(next));
/**
 * @openapi
 * /entities/contacts/{id}:
 *   put:
 *     tags: [Entities]
 *     summary: Atualizar contato
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Contato atualizado }
 */
router.put('/contacts/:id', (req, res, next) => EntityController.updateContact(req, res).catch(next));
/**
 * @openapi
 * /entities/contacts/{id}:
 *   delete:
 *     tags: [Entities]
 *     summary: Remover contato
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Contato removido }
 */
router.delete('/contacts/:id', (req, res, next) => EntityController.deleteContact(req, res).catch(next));

export default router;
