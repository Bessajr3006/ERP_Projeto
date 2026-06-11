import { Router } from 'express';
import { SellerController } from '../controllers/sellerController';
import { protectRoute } from '../middlewares/authMiddleware';

const router = Router();

// Todas as rotas de vendedores requerem autenticação
router.use(protectRoute);

/**
 * @openapi
 * /sellers:
 *   get:
 *     tags: [Vendedores]
 *     summary: Listar vendedores
 *     description: Retorna a lista de todos os usuários com o papel (role) de vendedor da empresa atual.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de vendedores }
 */
router.get('/', (req, res, next) => SellerController.getAll(req, res).catch(next));

/**
 * @openapi
 * /sellers:
 *   post:
 *     tags: [Vendedores]
 *     summary: Criar vendedor
 *     description: Cria um novo usuário automaticamente atribuído ao papel (role) de vendedor.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Vendedor criado com sucesso }
 */
router.post('/', (req, res, next) => SellerController.create(req, res).catch(next));

/**
 * @openapi
 * /sellers/{id}:
 *   get:
 *     tags: [Vendedores]
 *     summary: Obter vendedor
 *     description: Retorna os detalhes de um vendedor específico.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Detalhes do vendedor }
 */
router.get('/:id', (req, res, next) => SellerController.getById(req, res).catch(next));

/**
 * @openapi
 * /sellers/{id}/customers:
 *   get:
 *     tags: [Vendedores]
 *     summary: Listar clientes do vendedor
 *     description: Retorna a lista de clientes vinculados a um vendedor específico.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Lista de clientes do vendedor }
 */
router.get('/:id/customers', (req, res, next) => SellerController.getCustomers(req, res).catch(next));

/**
 * @openapi
 * /sellers/{id}:
 *   patch:
 *     tags: [Vendedores]
 *     summary: Atualizar vendedor
 *     description: Atualiza os dados de um vendedor existente.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Vendedor atualizado }
 */
router.patch('/:id', (req, res, next) => SellerController.update(req, res).catch(next));

/**
 * @openapi
 * /sellers/{id}/status:
 *   patch:
 *     tags: [Vendedores]
 *     summary: Ativar/desativar vendedor
 *     description: Altera o status (is_active) de um vendedor.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Status do vendedor atualizado }
 */
router.patch('/:id/status', (req, res, next) => SellerController.toggleActive(req, res).catch(next));

/**
 * @openapi
 * /sellers/{id}:
 *   delete:
 *     tags: [Vendedores]
 *     summary: Excluir vendedor
 *     description: "Remove o vendedor caso ele não possua vínculos (ex: transações)."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Vendedor excluído com sucesso }
 */
router.delete('/:id', (req, res, next) => SellerController.delete(req, res).catch(next));

export default router;
