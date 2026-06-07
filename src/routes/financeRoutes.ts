import { Router } from 'express';
import { FinanceController } from '../controllers/financeController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

router.use(protectRoute, requireTenantContext);

/**
 * @openapi
 * /finance/analytics/dashboard:
 *   get:
 *     tags: [Finance]
 *     summary: Dashboard financeiro
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Indicadores do dashboard }
 */
router.get('/analytics/dashboard', (req, res, next) => FinanceController.getDashboardAnalytics(req, res).catch(next));
/**
 * @openapi
 * /finance/revenues/recent-paid:
 *   get:
 *     tags: [Finance]
 *     summary: Listar receitas pagas recentemente
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de receitas pagas }
 */
router.get('/revenues/recent-paid', (req, res, next) => FinanceController.getRecentPaid(req, res).catch(next));

/**
 * @openapi
 * /finance/categories:
 *   post:
 *     tags: [Finance]
 *     summary: Criar categoria financeira
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Categoria criada }
 */
router.post('/categories', (req, res, next) => FinanceController.createCategory(req, res).catch(next));
/**
 * @openapi
 * /finance/categories:
 *   get:
 *     tags: [Finance]
 *     summary: Listar categorias financeiras
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de categorias }
 */
router.get('/categories', (req, res, next) => FinanceController.listCategories(req, res).catch(next));
/**
 * @openapi
 * /finance/categories/{id}:
 *   put:
 *     tags: [Finance]
 *     summary: Atualizar categoria financeira
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Categoria atualizada }
 */
router.put('/categories/:id', (req, res, next) => FinanceController.updateCategory(req, res).catch(next));
/**
 * @openapi
 * /finance/categories/{id}:
 *   delete:
 *     tags: [Finance]
 *     summary: Remover categoria financeira
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Categoria removida }
 */
router.delete('/categories/:id', (req, res, next) => FinanceController.deleteCategory(req, res).catch(next));

/**
 * @openapi
 * /finance/expenses:
 *   post:
 *     tags: [Finance]
 *     summary: Criar despesa
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Despesa criada }
 */
router.post('/expenses', (req, res, next) => FinanceController.createExpense(req, res).catch(next));
/**
 * @openapi
 * /finance/expenses:
 *   get:
 *     tags: [Finance]
 *     summary: Listar despesas
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de despesas }
 */
router.get('/expenses', (req, res, next) => FinanceController.listExpenses(req, res).catch(next));
/**
 * @openapi
 * /finance/expenses/{id}:
 *   put:
 *     tags: [Finance]
 *     summary: Atualizar despesa
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Despesa atualizada }
 */
router.put('/expenses/:id', (req, res, next) => FinanceController.updateExpense(req, res).catch(next));
/**
 * @openapi
 * /finance/expenses/{id}:
 *   delete:
 *     tags: [Finance]
 *     summary: Remover despesa
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Despesa removida }
 */
router.delete('/expenses/:id', (req, res, next) => FinanceController.deleteTransaction(req, res).catch(next));

/**
 * @openapi
 * /finance/revenues:
 *   post:
 *     tags: [Finance]
 *     summary: Criar receita
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description: { type: string }
 *               amount: { type: number }
 *               date: { type: string }
 *               category_public_id: { type: string }
 *               bank_account_public_id: { type: string }
 *               customer_public_id: { type: string }
 *               payment_method: { type: string }
 *               status: { type: string }
 *             required: [description, amount, date, category_public_id, bank_account_public_id]
 *     responses:
 *       201: { description: Receita criada }
 */
router.post('/revenues', (req, res, next) => FinanceController.createRevenue(req, res).catch(next));
/**
 * @openapi
 * /finance/revenues:
 *   get:
 *     tags: [Finance]
 *     summary: Listar receitas
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de receitas }
 */
router.get('/revenues', (req, res, next) => FinanceController.listRevenues(req, res).catch(next));
/**
 * @openapi
 * /finance/revenues/batch-generate-billets:
 *   post:
 *     tags: [Finance]
 *     summary: Gerar boletos em lote
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Boletos gerados }
 */
router.post('/revenues/batch-generate-billets', (req, res, next) => FinanceController.batchGenerateBillets(req, res).catch(next));
/**
 * @openapi
 * /finance/revenues/batch-cancel-billets:
 *   post:
 *     tags: [Finance]
 *     summary: Cancelar boletos em lote
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Boletos cancelados }
 */
router.post('/revenues/batch-cancel-billets', (req, res, next) => FinanceController.batchCancelBillets(req, res).catch(next));
/**
 * @openapi
 * /finance/revenues/{id}:
 *   put:
 *     tags: [Finance]
 *     summary: Atualizar receita
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Receita atualizada }
 */
router.put('/revenues/:id', (req, res, next) => FinanceController.updateRevenue(req, res).catch(next));
/**
 * @openapi
 * /finance/revenues/{id}:
 *   delete:
 *     tags: [Finance]
 *     summary: Remover receita
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Receita removida }
 */
router.delete('/revenues/:id', (req, res, next) => FinanceController.deleteTransaction(req, res).catch(next));
/**
 * @openapi
 * /finance/revenues/{id}/generate-billet:
 *   post:
 *     tags: [Finance]
 *     summary: Gerar boleto da receita
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Boleto gerado }
 */
router.post('/revenues/:id/generate-billet', (req, res, next) => FinanceController.generateBillet(req, res).catch(next));
/**
 * @openapi
 * /finance/revenues/{id}/boleto-pdf:
 *   get:
 *     tags: [Finance]
 *     summary: Obter PDF do boleto
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: PDF do boleto }
 */
router.get('/revenues/:id/boleto-pdf', (req, res, next) => FinanceController.getBoletoPdf(req, res).catch(next));
/**
 * @openapi
 * /finance/revenues/{id}/receipt:
 *   get:
 *     tags: [Finance]
 *     summary: Recibo/recibo de cobranca da receita
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: HTML do recibo }
 *       400: { description: Erro ao gerar recibo }
 */
router.get('/revenues/:id/receipt', (req, res, next) => FinanceController.getReceipt(req, res).catch(next));

/**
 * @openapi
 * /finance/transactions/{id}:
 *   delete:
 *     tags: [Finance]
 *     summary: Remover transacao
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Transacao removida }
 */
router.delete('/transactions/:id', (req, res, next) => FinanceController.deleteTransaction(req, res).catch(next));

/**
 * @openapi
 * /finance/bank-statements/batch-delete:
 *   post:
 *     tags: [Finance]
 *     summary: Remover extratos em lote
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Extratos removidos }
 */
router.post('/bank-statements/batch-delete', (req, res, next) => FinanceController.batchDeleteBankStatements(req, res).catch(next));
/**
 * @openapi
 * /finance/bank-statements/sync-ofx:
 *   post:
 *     tags: [Finance]
 *     summary: Sincronizar extratos via OFX
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Sincronizacao iniciada }
 */
router.post('/bank-statements/sync-ofx', (req, res, next) => FinanceController.syncBankStatementsOfx(req, res).catch(next));
/**
 * @openapi
 * /finance/bank-statements/sync:
 *   post:
 *     tags: [Finance]
 *     summary: Sincronizar extratos via API
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Sincronizacao iniciada }
 */
router.post('/bank-statements/sync', (req, res, next) => FinanceController.syncBankStatements(req, res).catch(next));
/**
 * @openapi
 * /finance/bank-statements:
 *   get:
 *     tags: [Finance]
 *     summary: Listar extratos bancarios
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de extratos }
 */
router.get('/bank-statements', (req, res, next) => FinanceController.listBankStatements(req, res).catch(next));

/**
 * @openapi
 * /finance/reconcile:
 *   post:
 *     tags: [Finance]
 *     summary: Reconciliar transacoes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Reconciliacao realizada }
 */
router.post('/reconcile', (req, res, next) => FinanceController.reconcile(req, res).catch(next));
/**
 * @openapi
 * /finance/reconcile/undo:
 *   post:
 *     tags: [Finance]
 *     summary: Desfazer reconciliacao
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Reconciliacao desfeita }
 */
router.post('/reconcile/undo', (req, res, next) => FinanceController.undoReconcile(req, res).catch(next));

export default router;
