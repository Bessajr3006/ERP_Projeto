import { Router } from 'express';
import { AccountingController } from '../controllers/accountingController';
import { AccountingEntryController } from '../controllers/accountingEntryController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

router.use(protectRoute, requireTenantContext);

/**
 * @openapi
 * /accounting/chart-of-accounts:
 *   post:
 *     tags: [Accounting]
 *     summary: Criar conta contábil
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Conta criada }
 */
router.post('/chart-of-accounts', (req, res, next) => AccountingController.createAccount(req, res).catch(next));
/**
 * @openapi
 * /accounting/chart-of-accounts:
 *   get:
 *     tags: [Accounting]
 *     summary: Listar plano de contas
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Plano de contas retornado }
 */
router.get('/chart-of-accounts', (req, res, next) => AccountingController.listAccounts(req, res).catch(next));
/**
 * @openapi
 * /accounting/chart-of-accounts/{id}:
 *   put:
 *     tags: [Accounting]
 *     summary: Atualizar conta contábil
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
router.put('/chart-of-accounts/:id', (req, res, next) => AccountingController.updateAccount(req, res).catch(next));
/**
 * @openapi
 * /accounting/chart-of-accounts/{id}:
 *   delete:
 *     tags: [Accounting]
 *     summary: Remover conta contábil
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
router.delete('/chart-of-accounts/:id', (req, res, next) => AccountingController.deleteAccount(req, res).catch(next));
/**
 * @openapi
 * /accounting/chart-of-accounts/batch-delete:
 *   post:
 *     tags: [Accounting]
 *     summary: Remover contas em lote
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Contas removidas }
 */
router.post('/chart-of-accounts/batch-delete', (req, res, next) => AccountingController.batchDeleteAccounts(req, res).catch(next));
/**
 * @openapi
 * /accounting/chart-of-accounts/batch-import:
 *   post:
 *     tags: [Accounting]
 *     summary: Importar plano de contas em lote
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Contas importadas }
 */
router.post('/chart-of-accounts/batch-import', (req, res, next) => AccountingController.batchImportAccounts(req, res).catch(next));

/**
 * @openapi
 * /accounting/entries:
 *   post:
 *     tags: [Accounting]
 *     summary: Criar lançamento contábil
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Lancamento criado }
 */
router.post('/entries', (req, res, next) => AccountingEntryController.createEntry(req, res).catch(next));
/**
 * @openapi
 * /accounting/entries/batch-import:
 *   post:
 *     tags: [Accounting]
 *     summary: Importar lançamentos em lote
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lancamentos importados }
 */
router.post('/entries/batch-import', (req, res, next) => AccountingEntryController.batchImportEntries(req, res).catch(next));
/**
 * @openapi
 * /accounting/entries:
 *   get:
 *     tags: [Accounting]
 *     summary: Listar lançamentos contábeis
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lancamentos retornados }
 */
router.get('/entries', (req, res, next) => AccountingEntryController.listEntries(req, res).catch(next));
/**
 * @openapi
 * /accounting/entries/{id}:
 *   put:
 *     tags: [Accounting]
 *     summary: Atualizar lançamento contábil
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Lancamento atualizado }
 */
router.put('/entries/:id', (req, res, next) => AccountingEntryController.updateEntry(req, res).catch(next));
/**
 * @openapi
 * /accounting/entries/{id}:
 *   delete:
 *     tags: [Accounting]
 *     summary: Remover lançamento contábil
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Lancamento removido }
 */
router.delete('/entries/:id', (req, res, next) => AccountingEntryController.deleteEntry(req, res).catch(next));
export default router;
