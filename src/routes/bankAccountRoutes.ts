import { Router } from 'express';
import { BankAccountController } from '../controllers/bankAccountController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

// Apply auth & tenant context to ALL bank routes 
router.use(protectRoute, requireTenantContext);

/**
 * @openapi
 * /bank-accounts:
 *   post:
 *     tags: [Bank Accounts]
 *     summary: Criar conta bancaria
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Conta criada }
 */
router.post('/', (req, res, next) => BankAccountController.create(req, res).catch(next));
/**
 * @openapi
 * /bank-accounts:
 *   get:
 *     tags: [Bank Accounts]
 *     summary: Listar contas bancarias
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de contas }
 */
router.get('/', (req, res, next) => BankAccountController.list(req, res).catch(next));
/**
 * @openapi
 * /bank-accounts/{id}:
 *   get:
 *     tags: [Bank Accounts]
 *     summary: Obter conta bancaria
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Conta encontrada }
 */
router.get('/:id', (req, res, next) => BankAccountController.getByPublicId(req, res).catch(next));
/**
 * @openapi
 * /bank-accounts/{id}:
 *   put:
 *     tags: [Bank Accounts]
 *     summary: Atualizar conta bancaria
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Conta atualizada }
 */
router.put('/:id', (req, res, next) => BankAccountController.update(req, res).catch(next));
/**
 * @openapi
 * /bank-accounts/{id}:
 *   delete:
 *     tags: [Bank Accounts]
 *     summary: Remover conta bancaria
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Conta removida }
 */
router.delete('/:id', (req, res, next) => BankAccountController.delete(req, res).catch(next));

// API Testing Route
/**
 * @openapi
 * /bank-accounts/{id}/test-connection:
 *   post:
 *     tags: [Bank Accounts]
 *     summary: Testar conexao da conta bancaria
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Teste executado }
 */
router.post('/:id/test-connection', (req, res, next) => BankAccountController.testConnection(req, res).catch(next));

export default router;
