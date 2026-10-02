import { Router } from 'express';
import { CompanyController } from '../controllers/companyController';
import { protectRoute, requireSuperAdmin, requireSuperAdminOrGroupMaster } from '../middlewares/authMiddleware';

import { SuperAdminController } from '../controllers/superAdminController';

const router = Router();

// To create a new company, ideally either public for new tenants or protected for admins. 
// For now making it public to bootstrap the first ERP tenant, but usually this is an onboarding flow or admin action.
/**
 * @openapi
 * /companies:
 *   post:
 *     tags: [Companies]
 *     summary: Criar empresa
 *     responses:
 *       201: { description: Empresa criada }
 */
router.post('/', protectRoute, requireSuperAdmin, (req, res, next) => CompanyController.create(req, res).catch(next));

// Protect viewing and updating information
/**
 * @openapi
 * /companies/states:
 *   get:
 *     tags: [Companies]
 *     summary: Listar estados
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de estados }
 */
router.get('/states', protectRoute, (req, res, next) => CompanyController.getStates(req, res).catch(next));
/**
 * @openapi
 * /companies:
 *   get:
 *     tags: [Companies]
 *     summary: Listar empresas (super admin / empresa master)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de empresas }
 */
router.get('/', protectRoute, requireSuperAdminOrGroupMaster, (req, res, next) => CompanyController.getAll(req, res).catch(next));

// Rota para Super Admin / Empresa Master trocar seu contexto para outra empresa
/**
 * @openapi
 * /companies/{id}/switch-context:
 *   post:
 *     tags: [Companies]
 *     summary: Trocar contexto da empresa (super admin / empresa master)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Contexto alterado }
 */
router.post('/:id/switch-context', protectRoute, requireSuperAdminOrGroupMaster, (req, res, next) => SuperAdminController.switchContext(req, res).catch(next));

/**
 * @openapi
 * /companies/proxy-consulta:
 *   post:
 *     tags: [Companies]
 *     summary: Proxy consulta de dados externos
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Consulta realizada }
 */
router.post('/proxy-consulta', protectRoute, (req, res, next) => CompanyController.proxyConsulta(req, res).catch(next));
/**
 * @openapi
 * /companies/{id}/whatsapp-business/session:
 *   get:
 *     tags: [Companies]
 *     summary: Sessao WhatsApp Business da empresa
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Sessao retornada }
 */
router.get('/:id/whatsapp-business/session', protectRoute, (req, res, next) => CompanyController.getWhatsAppBusinessSession(req, res).catch(next));
/**
 * @openapi
 * /companies/{id}/whatsapp-business/session:
 *   post:
 *     tags: [Companies]
 *     summary: Iniciar sessao WhatsApp Business da empresa
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Sessao iniciada }
 */
router.post('/:id/whatsapp-business/session', protectRoute, (req, res, next) => CompanyController.startWhatsAppBusinessSession(req, res).catch(next));
/**
 * @openapi
 * /companies/{id}/whatsapp-business/session:
 *   delete:
 *     tags: [Companies]
 *     summary: Encerrar sessao WhatsApp Business da empresa
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Sessao encerrada }
 */
router.delete('/:id/whatsapp-business/session', protectRoute, (req, res, next) => CompanyController.disconnectWhatsAppBusinessSession(req, res).catch(next));
/**
 * @openapi
 * /companies/{id}/whatsapp-business/conversations:
 *   get:
 *     tags: [Companies]
 *     summary: Listar conversas WhatsApp Business
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Conversas retornadas }
 */
router.get('/:id/whatsapp-business/conversations', protectRoute, (req, res, next) => CompanyController.getWhatsAppBusinessConversations(req, res).catch(next));
/**
 * @openapi
 * /companies/{id}/whatsapp-business/conversations/{phone}:
 *   delete:
 *     tags: [Companies]
 *     summary: Remover conversa WhatsApp Business
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: phone
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Conversa removida }
 */
router.delete('/:id/whatsapp-business/conversations/:phone', protectRoute, (req, res, next) => CompanyController.deleteWhatsAppBusinessConversation(req, res).catch(next));
/**
 * @openapi
 * /companies/{id}/whatsapp-business/messages:
 *   get:
 *     tags: [Companies]
 *     summary: Listar mensagens WhatsApp Business
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Mensagens retornadas }
 */
router.get('/:id/whatsapp-business/messages', protectRoute, (req, res, next) => CompanyController.getWhatsAppBusinessMessages(req, res).catch(next));
/**
 * @openapi
 * /companies/{id}/whatsapp-business/messages:
 *   post:
 *     tags: [Companies]
 *     summary: Enviar mensagem WhatsApp Business
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Mensagem enviada }
 */
router.post('/:id/whatsapp-business/messages', protectRoute, (req, res, next) => CompanyController.sendWhatsAppBusinessMessage(req, res).catch(next));
/**
 * @openapi
 * /companies/{id}:
 *   get:
 *     tags: [Companies]
 *     summary: Obter empresa por ID público (UUID)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: UUID público da empresa
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Empresa encontrada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: integer, example: 1 }
 *                     public_id: { type: string, format: uuid }
 *                     trade_name: { type: string, example: "Empresa Bessa" }
 *                     company_name: { type: string, example: "Empresa Bessa Ltda" }
 *                     cnpj: { type: string, example: "00.000.000/0001-00" }
 *                     tax_regime: { type: string, example: "Simples Nacional" }
 *                     email: { type: string, format: email }
 *                     phone: { type: string }
 *                     zipcode: { type: string }
 *                     street: { type: string }
 *                     number: { type: string }
 *                     complement: { type: string }
 *                     neighborhood: { type: string }
 *                     city: { type: string }
 *                     state: { type: string }
 *                     ie: { type: string, nullable: true }
 *                     im: { type: string, nullable: true }
 *                     cnae_principal: { type: string, nullable: true }
 *                     crt: { type: integer, nullable: true }
 *                     nfe_environment: { type: integer, nullable: true, description: "1 = Produção, 2 = Homologação" }
 *                     nfe_series: { type: integer, nullable: true }
 *                     nfe_number: { type: integer, nullable: true }
 *                     nfce_series: { type: integer, nullable: true }
 *                     nfce_number: { type: integer, nullable: true }
 *                     logo_url: { type: string, nullable: true }
 *                     logo_filename: { type: string, nullable: true }
 *                     certificate_name: { type: string }
 *                     certificate_expiration: { type: string, format: date-time }
 *                     whatsapp_chat_provider: { type: string, enum: [business_qr], nullable: true }
 *                     whatsapp_business_scope: { type: string, enum: [company, user], nullable: true }
 *                     allow_print_without_confirmation: { type: boolean }
 *                     is_active: { type: boolean }
 *                     created_at: { type: string, format: date-time }
 *                     updated_at: { type: string, format: date-time }
 *       400:
 *         description: ID ausente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: error }
 *                 message: { type: string, example: "Missing company ID" }
 *       403:
 *         description: Acesso negado à empresa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: error }
 *                 message: { type: string, example: "Access denied for this company" }
 *       404:
 *         description: Empresa não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: error }
 *                 message: { type: string, example: "Company not found" }
 */
router.get('/:id', protectRoute, (req, res, next) => CompanyController.getByPublicId(req, res).catch(next));
/**
 * @openapi
 * /companies/{id}:
 *   put:
 *     tags: [Companies]
 *     summary: Atualizar empresa
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Empresa atualizada }
 */
router.put('/:id', protectRoute, (req, res, next) => CompanyController.update(req, res).catch(next));
/**
 * @openapi
 * /companies/{id}:
 *   delete:
 *     tags: [Companies]
 *     summary: Remover empresa (super admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Empresa removida }
 */
router.delete('/:id', protectRoute, requireSuperAdmin, (req, res, next) => CompanyController.delete(req, res).catch(next));

// PosControl configuration routes
router.get('/:companyId/poscontrol-configs', protectRoute, (req, res, next) => CompanyController.listPosControlConfigs(req, res).catch(next));
router.post('/:companyId/poscontrol-configs', protectRoute, (req, res, next) => CompanyController.createPosControlConfig(req, res).catch(next));
router.put('/:companyId/poscontrol-configs/:id', protectRoute, (req, res, next) => CompanyController.updatePosControlConfig(req, res).catch(next));
router.delete('/:companyId/poscontrol-configs/:id', protectRoute, (req, res, next) => CompanyController.deletePosControlConfig(req, res).catch(next));

// Solidcon database configuration routes
router.get('/:companyId/solidcon-configs', protectRoute, (req, res, next) => CompanyController.listSolidconConfigs(req, res).catch(next));
router.post('/:companyId/solidcon-configs', protectRoute, (req, res, next) => CompanyController.createSolidconConfig(req, res).catch(next));
router.put('/:companyId/solidcon-configs/:id', protectRoute, (req, res, next) => CompanyController.updateSolidconConfig(req, res).catch(next));
router.delete('/:companyId/solidcon-configs/:id', protectRoute, (req, res, next) => CompanyController.deleteSolidconConfig(req, res).catch(next));
router.post('/:companyId/solidcon-configs/test', protectRoute, (req, res, next) => CompanyController.testSolidconConfig(req, res).catch(next));
router.post('/:companyId/solidcon-configs/:id/test', protectRoute, (req, res, next) => CompanyController.testSolidconConfig(req, res).catch(next));

// Dorsal database configuration routes
router.get('/:companyId/dorsal-configs', protectRoute, (req, res, next) => CompanyController.listDorsalConfigs(req, res).catch(next));
router.post('/:companyId/dorsal-configs', protectRoute, (req, res, next) => CompanyController.createDorsalConfig(req, res).catch(next));
router.put('/:companyId/dorsal-configs/:id', protectRoute, (req, res, next) => CompanyController.updateDorsalConfig(req, res).catch(next));
router.delete('/:companyId/dorsal-configs/:id', protectRoute, (req, res, next) => CompanyController.deleteDorsalConfig(req, res).catch(next));
router.post('/:companyId/dorsal-configs/test', protectRoute, (req, res, next) => CompanyController.testDorsalConfig(req, res).catch(next));
router.post('/:companyId/dorsal-configs/:id/test', protectRoute, (req, res, next) => CompanyController.testDorsalConfig(req, res).catch(next));

// Alterdata database configuration routes
router.get('/:companyId/alterdata-configs', protectRoute, (req, res, next) => CompanyController.listAlterdataConfigs(req, res).catch(next));
router.post('/:companyId/alterdata-configs', protectRoute, (req, res, next) => CompanyController.createAlterdataConfig(req, res).catch(next));
router.put('/:companyId/alterdata-configs/:id', protectRoute, (req, res, next) => CompanyController.updateAlterdataConfig(req, res).catch(next));
router.delete('/:companyId/alterdata-configs/:id', protectRoute, (req, res, next) => CompanyController.deleteAlterdataConfig(req, res).catch(next));
router.post('/:companyId/alterdata-configs/test', protectRoute, (req, res, next) => CompanyController.testAlterdataConfig(req, res).catch(next));
router.post('/:companyId/alterdata-configs/:id/test', protectRoute, (req, res, next) => CompanyController.testAlterdataConfig(req, res).catch(next));


// PosControl sync routes
router.post('/:companyId/poscontrol-sync/categories', protectRoute, (req, res, next) => CompanyController.syncPosControlCategories(req, res).catch(next));
router.post('/:companyId/poscontrol-sync/products', protectRoute, (req, res, next) => CompanyController.syncPosControlProducts(req, res).catch(next));
router.post('/:companyId/poscontrol-sync/import-unittypes', protectRoute, (req, res, next) => CompanyController.importPosControlUnitTypes(req, res).catch(next));
router.post('/:companyId/poscontrol-sync/import-producttypes', protectRoute, (req, res, next) => CompanyController.importPosControlProductTypes(req, res).catch(next));
router.post('/:companyId/poscontrol-sync/import-products', protectRoute, (req, res, next) => CompanyController.importPosControlProducts(req, res).catch(next));
router.post('/:companyId/poscontrol-sync/fetch-products', protectRoute, (req, res, next) => CompanyController.fetchPosControlProducts(req, res).catch(next));
router.post('/:companyId/poscontrol-sync/import-categories', protectRoute, (req, res, next) => CompanyController.importPosControlCategories(req, res).catch(next));
router.post('/:companyId/poscontrol-sync/fetch-categories', protectRoute, (req, res, next) => CompanyController.fetchPosControlCategories(req, res).catch(next));
router.post('/:companyId/poscontrol-sync/inactivate-categories', protectRoute, (req, res, next) => CompanyController.inactivatePosControlCategories(req, res).catch(next));
router.get('/:companyId/poscontrol-sync/debug-info', protectRoute, (req, res, next) => CompanyController.getPosControlDebugInfo(req, res).catch(next));
router.get('/:companyId/poscontrol-sync/sales', protectRoute, (req, res, next) => CompanyController.fetchPosControlSales(req, res).catch(next));
router.post('/:companyId/poscontrol-sync/sales/sync', protectRoute, (req, res, next) => CompanyController.syncPosControlSales(req, res).catch(next));

// Alterdata database connection test route
router.post('/:id/test-alterdata-connection', protectRoute, (req, res, next) => CompanyController.testAlterdataConnection(req, res).catch(next));

// Swagger token management (super admin only)
router.post('/:id/swagger-token/regenerate', protectRoute, requireSuperAdmin, (req, res, next) => CompanyController.regenerateSwaggerToken(req, res).catch(next));
router.post('/:id/swagger-token/revoke', protectRoute, requireSuperAdmin, (req, res, next) => CompanyController.revokeSwaggerToken(req, res).catch(next));

export default router;
