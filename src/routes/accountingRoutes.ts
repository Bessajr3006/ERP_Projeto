import { Router } from 'express';
import { AccountingController } from '../controllers/accountingController';
import { AccountingEntryController } from '../controllers/accountingEntryController';
import { AccountingAutoEntryController } from '../controllers/accountingAutoEntryController';
import { AccountingClosingController } from '../controllers/accountingClosingController';
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
 * /accounting/solidcon-connections:
 *   get:
 *     tags: [Accounting]
 *     summary: Listar conexões Solidcon disponíveis
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de conexões retornada }
 */
router.get('/solidcon-connections', (req, res, next) => AccountingController.listSolidconConnections(req, res).catch(next));

/**
 * @openapi
 * /accounting/solidcon-chart-of-accounts:
 *   get:
 *     tags: [Accounting]
 *     summary: Consultar Plano de Contas direto do banco Solidcon
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Plano de contas retornado }
 */
router.get('/solidcon-chart-of-accounts', (req, res, next) => AccountingController.getSolidconChartOfAccounts(req, res).catch(next));

/**
 * @openapi
 * /accounting/solidcon-import:
 *   post:
 *     tags: [Accounting]
 *     summary: Importar contas do Solidcon para o Keystone
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Contas importadas com sucesso }
 */
router.post('/solidcon-import', (req, res, next) => AccountingController.importFromSolidcon(req, res).catch(next));

/**
 * @openapi
 * /accounting/solidcon-entries:
 *   get:
 *     tags: [Accounting]
 *     summary: Consultar movimentação e lançamentos do Solidcon por período
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Movimentações retornadas com sucesso }
 */
router.get('/solidcon-entries', (req, res, next) => AccountingEntryController.getSolidconAccountingEntries(req, res).catch(next));

/**
 * @openapi
 * /accounting/solidcon-entries/import:
 *   post:
 *     tags: [Accounting]
 *     summary: Importar lançamentos do Solidcon para o Keystone
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lançamentos importados com sucesso }
 */
router.post('/solidcon-entries/import', (req, res, next) => AccountingEntryController.importFromSolidcon(req, res).catch(next));

/**
 * @openapi
 * /accounting/solidcon-entries/verify:
 *   post:
 *     tags: [Accounting]
 *     summary: Verificar duplicidades e inconsistências de contas de lançamentos do Solidcon
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Resultado da verificação retornado }
 */
router.post('/solidcon-entries/verify', (req, res, next) => AccountingEntryController.verifySolidconEntries(req, res).catch(next));

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
 * /accounting/entries/apply-auto:
 *   post:
 *     tags: [Accounting]
 *     summary: Aplicar template de lançamento automático
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lançamentos gerados }
 */
router.post('/entries/apply-auto', (req, res, next) => AccountingEntryController.applyAutoTemplate(req, res).catch(next));
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

/**
 * @openapi
 * /accounting/auto-templates:
 *   get:
 *     tags: [Accounting]
 *     summary: Listar templates de lancamento automatico
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Templates retornados }
 */
router.get('/auto-templates', (req, res, next) => AccountingAutoEntryController.listTemplates(req, res).catch(next));

/**
 * @openapi
 * /accounting/auto-templates/{id}:
 *   get:
 *     tags: [Accounting]
 *     summary: Obter template e seus itens
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Template retornado }
 */
router.get('/auto-templates/:id', (req, res, next) => AccountingAutoEntryController.getTemplate(req, res).catch(next));

/**
 * @openapi
 * /accounting/auto-templates:
 *   post:
 *     tags: [Accounting]
 *     summary: Criar template de lancamento automatico
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Template criado }
 */
router.post('/auto-templates', (req, res, next) => AccountingAutoEntryController.createTemplate(req, res).catch(next));

/**
 * @openapi
 * /accounting/auto-templates/{id}:
 *   put:
 *     tags: [Accounting]
 *     summary: Atualizar template
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Template atualizado }
 */
router.put('/auto-templates/:id', (req, res, next) => AccountingAutoEntryController.updateTemplate(req, res).catch(next));

/**
 * @openapi
 * /accounting/auto-templates/{id}:
 *   delete:
 *     tags: [Accounting]
 *     summary: Remover template
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204: { description: Template removido }
 */
router.delete('/auto-templates/:id', (req, res, next) => AccountingAutoEntryController.deleteTemplate(req, res).catch(next));

/**
 * @openapi
 * /accounting/closings/overview:
 *   get:
 *     tags: [Accounting]
 *     summary: Visão geral de fechamentos contábeis e fiscais (Mensal, Trimestral, Semestral, Anual)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Visão geral retornada com sucesso }
 */
router.get('/closings/overview', (req, res, next) => AccountingClosingController.getClosingOverview(req, res).catch(next));

/**
 * @openapi
 * /accounting/closings/toggle-status:
 *   post:
 *     tags: [Accounting]
 *     summary: Alterar status de fechamento de um período
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Status atualizado com sucesso }
 */
router.post('/closings/toggle-status', (req, res, next) => AccountingClosingController.togglePeriodStatus(req, res).catch(next));

export default router;

// ==========================================
// HISTÓRICO AUTOMÁTICO (PADRÃO)
// ==========================================

router.get('/histories', (req, res, next) => {
    import('../controllers/accountingHistoryController').then(m => m.AccountingHistoryController.list(req, res)).catch(next);
});

router.get('/histories/:id', (req, res, next) => {
    import('../controllers/accountingHistoryController').then(m => m.AccountingHistoryController.get(req, res)).catch(next);
});

router.post('/histories', (req, res, next) => {
    import('../controllers/accountingHistoryController').then(m => m.AccountingHistoryController.create(req, res)).catch(next);
});

router.put('/histories/:id', (req, res, next) => {
    import('../controllers/accountingHistoryController').then(m => m.AccountingHistoryController.update(req, res)).catch(next);
});

router.delete('/histories/:id', (req, res, next) => {
    import('../controllers/accountingHistoryController').then(m => m.AccountingHistoryController.delete(req, res)).catch(next);
});

// ==========================================
// CONTROLE DE DECLARAÇÕES
// ==========================================

router.get('/declarations', (req, res, next) => {
    import('../controllers/declarationControlController').then(m => m.DeclarationControlController.list(req, res)).catch(next);
});

router.put('/declarations/:customerId', (req, res, next) => {
    import('../controllers/declarationControlController').then(m => m.DeclarationControlController.updateStatus(req, res)).catch(next);
});
router.delete('/declarations/:customerId', (req, res, next) => {
    import('../controllers/declarationControlController').then(m => m.DeclarationControlController.deleteDeclaration(req, res)).catch(next);
});

// ==========================================
// TIPOS DE DECLARAÇÃO
// ==========================================

router.get('/declaration-types', (req, res, next) => {
    import('../controllers/declarationTypeController').then(m => m.getAll(req, res, next)).catch(next);
});

router.get('/declaration-types/:id', (req, res, next) => {
    import('../controllers/declarationTypeController').then(m => m.getOne(req, res, next)).catch(next);
});

router.post('/declaration-types', (req, res, next) => {
    import('../controllers/declarationTypeController').then(m => m.create(req, res, next)).catch(next);
});

router.put('/declaration-types/:id', (req, res, next) => {
    import('../controllers/declarationTypeController').then(m => m.update(req, res, next)).catch(next);
});

router.delete('/declaration-types/:id', (req, res, next) => {
    import('../controllers/declarationTypeController').then(m => m.remove(req, res, next)).catch(next);
});
