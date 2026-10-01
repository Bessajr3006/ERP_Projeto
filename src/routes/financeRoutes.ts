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
router.get('/pix-charges', (req, res, next) => FinanceController.listPixCharges(req, res).catch(next));
router.post('/pix-charges', (req, res, next) => FinanceController.createPixCharge(req, res).catch(next));

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

// Category Types routes
router.post('/category-types', (req, res, next) => FinanceController.createCategoryType(req, res).catch(next));
router.get('/category-types', (req, res, next) => FinanceController.listCategoryTypes(req, res).catch(next));
router.put('/category-types/:id', (req, res, next) => FinanceController.updateCategoryType(req, res).catch(next));
router.delete('/category-types/:id', (req, res, next) => FinanceController.deleteCategoryType(req, res).catch(next));

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
router.post('/expenses/:id/pay', (req, res, next) => FinanceController.payExpense(req, res).catch(next));
router.post('/expenses/solidcon-import', (req, res, next) => FinanceController.importExpensesSolidcon(req, res).catch(next));
router.get('/expenses/:id/solidcon-details', (req, res, next) => FinanceController.getExpenseSolidconDetails(req, res).catch(next));
router.post('/expenses/:id/solidcon-fix-duplicates', (req, res, next) => FinanceController.fixExpenseSolidconDuplicates(req, res).catch(next));

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
 * /finance/revenues/solidcon-import:
 *   post:
 *     tags: [Finance]
 *     summary: Importar receitas da Solidcon
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Importacao concluida }
 */
/**
 * @openapi
 * /finance/revenues/sync-all:
 *   post:
 *     tags: [Finance]
 *     summary: Sincronizar todo o sistema com banco Inter, Solidcon e Keystone
 *     description: Executa a sincronização completa de status com o banco (Banco Inter / Boletos / PIX), baixas com a Solidcon, multas/juros e receitas/crediários.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startDate: { type: string, format: date, example: "2026-08-01" }
 *               endDate: { type: string, format: date, example: "2026-10-31" }
 *     responses:
 *       200: { description: Sincronização geral concluída com sucesso }
 */
router.post('/revenues/sync-all', (req, res, next) => FinanceController.syncAllRevenues(req, res).catch(next));
router.post('/revenues/solidcon-import', (req, res, next) => FinanceController.importRevenuesSolidcon(req, res).catch(next));
router.post('/revenues/solidcon-sync-baixas', (req, res, next) => FinanceController.syncSolidconBaixas(req, res).catch(next));
router.post('/revenues/solidcon-clean-duplicates', (req, res, next) => FinanceController.cleanDuplicateSolidconBaixas(req, res).catch(next));
router.post('/revenues/solidcon-sync-all-interest', (req, res, next) => FinanceController.syncAllSolidconInterestRevenues(req, res).catch(next));
router.get('/revenues/solidcon-untied-summary', (req, res, next) => FinanceController.scanUntiedSolidconMovements(req, res).catch(next));
router.post('/revenues/solidcon-tie-all', (req, res, next) => FinanceController.tieAllUntiedSolidconMovements(req, res).catch(next));
router.get('/revenues/solidcon-search', (req, res, next) => FinanceController.buscarReceitaSolidcon(req, res).catch(next));
router.post('/revenues/solidcon-search', (req, res, next) => FinanceController.buscarReceitaSolidcon(req, res).catch(next));
router.post('/revenues/batch-update', (req, res, next) => FinanceController.batchUpdateRevenues(req, res).catch(next));

/**
 * @openapi
 * /finance/solidcon-vision:
 *   get:
 *     tags: [Finance]
 *     summary: Visão Financeira Solidcon (Receitas vs Despesas por Mês/Ano)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: ano
 *         schema: { type: integer, example: 2025 }
 *       - in: query
 *         name: mes
 *         schema: { type: integer, example: 5 }
 *       - in: query
 *         name: cdFilial
 *         schema: { type: string }
 *       - in: query
 *         name: source
 *         schema: { type: string, enum: [conta_baixa, banco_movimento, consolidado] }
 *     responses:
 *       200: { description: Dados analíticos e gráficos da Visão Financeira Solidcon }
 */
router.get('/solidcon-vision', (req, res, next) => FinanceController.getSolidconFinanceVision(req, res).catch(next));

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
router.post('/revenues/:id/sync-boleto-status', (req, res, next) => FinanceController.syncBoletoStatus(req, res).catch(next));
router.get('/revenues/:id/solidcon-details', (req, res, next) => FinanceController.getRevenueSolidconDetails(req, res).catch(next));
router.post('/revenues/:id/solidcon-fix-duplicates', (req, res, next) => FinanceController.fixRevenueSolidconDuplicates(req, res).catch(next));
router.post('/revenues/:id/solidcon-tie-movement', (req, res, next) => FinanceController.tieRevenueSolidconMovement(req, res).catch(next));
router.post('/revenues/:id/solidcon-cancel-baixa', (req, res, next) => FinanceController.cancelRevenueSolidconBaixa(req, res).catch(next));
router.post('/revenues/batch-sync-payments', (req, res, next) => FinanceController.batchSyncPayments(req, res).catch(next));
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
router.get('/whatsapp/status', protectRoute, (req, res, next) => FinanceController.getWhatsAppStatus(req, res).catch(next));
router.get('/whatsapp/screenshot', protectRoute, (req, res, next) => FinanceController.getWhatsAppScreenshot(req, res).catch(next));
router.get('/revenues/whatsapp-audit', protectRoute, (req, res, next) => FinanceController.getWhatsAppAudits(req, res).catch(next));
router.get('/revenues/:id/whatsapp-audit', protectRoute, (req, res, next) => FinanceController.getTransactionWhatsAppAudits(req, res).catch(next));
router.get('/revenues/:id/receipt', (req, res, next) => FinanceController.getReceipt(req, res).catch(next));
router.get('/expenses/:id/receipt', (req, res, next) => FinanceController.getReceipt(req, res).catch(next));
router.post('/revenues/batch-send-whatsapp', protectRoute, (req, res, next) => FinanceController.batchSendWhatsApp(req, res).catch(next));
router.post('/revenues/:id/send-whatsapp', protectRoute, (req, res, next) => FinanceController.sendWhatsApp(req, res).catch(next));

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
router.post('/transactions/batch-delete', (req, res, next) => FinanceController.batchDeleteTransactions(req, res).catch(next));

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

// Card Statements Routes
router.get('/card-statements', (req, res, next) => FinanceController.listCardStatements(req, res).catch(next));
router.post('/card-statements/sync-ofx', (req, res, next) => FinanceController.syncCardStatementsOfx(req, res).catch(next));
router.post('/card-statements/batch-delete', (req, res, next) => FinanceController.batchDeleteCardStatements(req, res).catch(next));
router.post('/card-reconcile', (req, res, next) => FinanceController.reconcileCard(req, res).catch(next));
router.post('/card-reconcile/undo', (req, res, next) => FinanceController.undoReconcileCard(req, res).catch(next));
router.get('/card-transactions', (req, res, next) => FinanceController.listCardTransactions(req, res).catch(next));
/**
 * @openapi
 * /finance/reports/rafael:
 *   get:
 *     tags: [Finance, Relatórios]
 *     summary: Relatório Rafael - Vendas e Custos Consolidados por Produto
 *     description: Consulta dados analíticos consolidados de vendas e custos de produtos a partir do banco de dados externo (Solidcon/Dorsal), trazendo quantidade vendida, custo do dia, custo de venda, valor total líquido com rateios, acréscimos, descontos, preços cadastrais e classificação.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         description: Data inicial do período de vendas (formato AAAA-MM-DD)
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-09-01"
 *       - in: query
 *         name: endDate
 *         required: true
 *         description: Data final do período de vendas (formato AAAA-MM-DD)
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-09-30"
 *       - in: query
 *         name: cdFilial
 *         required: false
 *         description: Código da filial ou lista de filiais separadas por vírgula (se omitido, utiliza a filial cadastrada na empresa)
 *         schema:
 *           type: string
 *           example: "1,2,10"
 *     responses:
 *       200:
 *         description: Relatório de vendas e custos retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReportRafaelResponse'
 *       400:
 *         description: Parâmetros obrigatórios ausentes ou falha de comunicação com o banco de dados externo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         description: Não autorizado ou empresa não identificada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: Empresa não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Erro interno no processamento do relatório
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get('/reports/solidcon-connections', (req, res, next) => FinanceController.listSolidconConnections(req, res).catch(next));
router.get('/reports/dorsal-connections', (req, res, next) => FinanceController.listDorsalConnections(req, res).catch(next));
router.get('/reports/external-connections', (req, res, next) => FinanceController.listExternalConnections(req, res).catch(next));
router.get('/reports/rafael', (req, res, next) => FinanceController.getReportRafael(req, res).catch(next));

/**
 * @openapi
 * /finance/reports/rafael/detail:
 *   get:
 *     tags: [Finance, Relatórios]
 *     summary: Relatório Rafael - Detalhes dos Cupons de Venda por Produto
 *     description: Consulta as ocorrências detalhadas de cupons fiscais onde o produto foi comercializado no período, incluindo data/hora, quantidade, cliente, operador de caixa, valores unitários, totais e custos.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         description: Data inicial do período (formato AAAA-MM-DD)
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-09-01"
 *       - in: query
 *         name: endDate
 *         required: true
 *         description: Data final do período (formato AAAA-MM-DD)
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-09-30"
 *       - in: query
 *         name: cdProduto
 *         required: true
 *         description: Código numérico identificador do produto
 *         schema:
 *           type: string
 *           example: "1001"
 *       - in: query
 *         name: cdFilial
 *         required: false
 *         description: Código da filial ou lista de filiais separadas por vírgula
 *         schema:
 *           type: string
 *           example: "1"
 *     responses:
 *       200:
 *         description: Detalhes de cupons de venda do produto retornados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReportRafaelDetailResponse'
 *       400:
 *         description: Parâmetros obrigatórios ausentes ou erro na consulta externa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         description: Não autorizado ou empresa não identificada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: Empresa não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Erro interno no processamento dos detalhes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get('/reports/rafael/detail', (req, res, next) => FinanceController.getReportRafaelDetail(req, res).catch(next));

/**
 * @openapi
 * /finance/reports/rafael/costs:
 *   post:
 *     tags: [Finance, Relatórios]
 *     summary: Atualizar Custos do Produto e Vendas (Solidcon / Dorsal)
 *     description: Permite atualizar o Custo Unitário de Venda (tbCupomItem.vlCusto) e o Custo Unitário do Dia / Cadastro (tbSuperProduto.vlCusto) no banco de dados Solidcon/Dorsal.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cdProduto
 *             properties:
 *               cdProduto:
 *                 type: string
 *                 description: Código do produto a ser atualizado
 *               cdFilial:
 *                 type: string
 *                 description: Filial ou lista de filiais
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: Data inicial para atualização das vendas
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: Data final para atualização das vendas
 *               custoUnitarioVenda:
 *                 type: number
 *                 description: Novo custo unitário de venda
 *               custoUnitarioDia:
 *                 type: number
 *                 description: Novo custo unitário do dia (cadastro do produto)
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     gdCupom:
 *                       type: string
 *                     nrItem:
 *                       type: integer
 *                     custoUnitarioVenda:
 *                       type: number
 *     responses:
 *       200:
 *         description: Custos atualizados com sucesso
 *       400:
 *         description: Erro na validação ou na conexão externa
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno
 */
router.post('/reports/rafael/costs', (req, res, next) => FinanceController.updateReportRafaelCosts(req, res).catch(next));

/**
 * @openapi
 * /finance/reports/pedidos-dorsal:
 *   get:
 *     tags: [Finance, Relatórios]
 *     summary: Relatório de Pedidos (Dorsal)
 *     description: Consulta a listagem de pedidos da tabela tbPedido do banco de dados Dorsal com filtros por período, filiais e status de cancelamento.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-09-01"
 *         description: Data inicial do período (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-09-30"
 *         description: Data final do período (YYYY-MM-DD)
 *       - in: query
 *         name: cdFilial
 *         required: false
 *         schema:
 *           type: string
 *           example: "1"
 *         description: Código da filial (ex 1 ou 1,2)
 *       - in: query
 *         name: inCancelado
 *         required: false
 *         schema:
 *           type: string
 *           enum: ["0", "1"]
 *           example: "0"
 *         description: Filtrar por status de cancelamento (0 para não cancelados, 1 para cancelados)
 *     responses:
 *       200:
 *         description: Listagem de pedidos Dorsal obtida com sucesso
 *       400:
 *         description: Parâmetros inválidos ou erro de conexão com o banco
 *       404:
 *         description: Empresa não encontrada
 *       500:
 *         description: Erro interno no processamento
 */
router.get('/reports/pedidos-dorsal', (req, res, next) => FinanceController.getReportPedidosDorsal(req, res).catch(next));

/**
 * @openapi
 * /finance/reports/pedidos-dorsal/items:
 *   get:
 *     tags: [Finance, Relatórios]
 *     summary: Itens do Pedido (Dorsal)
 *     description: Consulta os produtos/itens da tabela tbPedidoItem para um pedido específico do banco Dorsal.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cdPedido
 *         required: true
 *         schema:
 *           type: string
 *           example: "100"
 *         description: Número/Código do pedido (cdPedido)
 *       - in: query
 *         name: cdFilial
 *         required: false
 *         schema:
 *           type: string
 *           example: "1"
 *         description: Código da filial (cdFilial)
 *     responses:
 *       200:
 *         description: Lista de itens do pedido obtida com sucesso
 *       400:
 *         description: Parâmetro cdPedido não informado ou inválido
 *       500:
 *         description: Erro interno no processamento dos itens
 */
router.get('/reports/pedidos-dorsal/items', (req, res, next) => FinanceController.getReportPedidoDorsalItems(req, res).catch(next));

export default router;

