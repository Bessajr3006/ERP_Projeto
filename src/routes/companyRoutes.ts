import { Router } from 'express';
import { CompanyController } from '../controllers/companyController';
import { protectRoute, requireSuperAdmin } from '../middlewares/authMiddleware';

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
router.post('/', (req, res, next) => CompanyController.create(req, res).catch(next));

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
 *     summary: Listar empresas (super admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de empresas }
 */
router.get('/', protectRoute, requireSuperAdmin, (req, res, next) => CompanyController.getAll(req, res).catch(next));

// Rota exclusiva para Super Admin trocar seu contexto para outra empresa
/**
 * @openapi
 * /companies/{id}/switch-context:
 *   post:
 *     tags: [Companies]
 *     summary: Trocar contexto da empresa (super admin)
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
router.post('/:id/switch-context', protectRoute, requireSuperAdmin, (req, res, next) => SuperAdminController.switchContext(req, res).catch(next));

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

export default router;
