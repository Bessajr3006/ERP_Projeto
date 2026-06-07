import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { EmailConfigController } from '../controllers/emailConfigController';
import { protectRoute } from '../middlewares/authMiddleware';

const router = Router();

// All user routes require authentication
router.use(protectRoute);

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Listar usuarios
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de usuarios }
 */
router.get('/',          (req, res, next) => UserController.getAll(req, res).catch(next));
/**
 * @openapi
 * /users:
 *   post:
 *     tags: [Users]
 *     summary: Criar usuario
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Usuario criado }
 */
router.post('/',         (req, res, next) => UserController.create(req, res).catch(next));
/**
 * @openapi
 * /users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: Atualizar usuario
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Usuario atualizado }
 */
router.patch('/:id',     (req, res, next) => UserController.update(req, res).catch(next));
/**
 * @openapi
 * /users/{id}/status:
 *   patch:
 *     tags: [Users]
 *     summary: Ativar/desativar usuario
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Status atualizado }
 */
router.patch('/:id/status', (req, res, next) => UserController.toggleActive(req, res).catch(next));
/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Excluir usuario
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Usuario excluido }
 */
router.delete('/:id',    (req, res, next) => UserController.delete(req, res).catch(next));
/**
 * @openapi
 * /users/{id}/whatsapp-business/session:
 *   get:
 *     tags: [Users]
 *     summary: Status da sessao WhatsApp Business
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
router.get('/:id/whatsapp-business/session', (req, res, next) => UserController.getWhatsAppBusinessSession(req, res).catch(next));
/**
 * @openapi
 * /users/{id}/whatsapp-business/session:
 *   post:
 *     tags: [Users]
 *     summary: Iniciar sessao WhatsApp Business
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
router.post('/:id/whatsapp-business/session', (req, res, next) => UserController.startWhatsAppBusinessSession(req, res).catch(next));
/**
 * @openapi
 * /users/{id}/whatsapp-business/session:
 *   delete:
 *     tags: [Users]
 *     summary: Encerrar sessao WhatsApp Business
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
router.delete('/:id/whatsapp-business/session', (req, res, next) => UserController.disconnectWhatsAppBusinessSession(req, res).catch(next));
/**
 * @openapi
 * /users/{id}/whatsapp-business/analytics:
 *   get:
 *     tags: [Users]
 *     summary: Analytics WhatsApp Business
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Analytics retornado }
 */
router.get('/:id/whatsapp-business/analytics', (req, res, next) => UserController.getWhatsAppBusinessAnalytics(req, res).catch(next));
/**
 * @openapi
 * /users/{id}/whatsapp-business/conversations:
 *   get:
 *     tags: [Users]
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
router.get('/:id/whatsapp-business/conversations', (req, res, next) => UserController.getWhatsAppBusinessConversations(req, res).catch(next));
/**
 * @openapi
 * /users/{id}/whatsapp-business/conversations/{phone}:
 *   delete:
 *     tags: [Users]
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
router.delete('/:id/whatsapp-business/conversations/:phone', (req, res, next) => UserController.deleteWhatsAppBusinessConversation(req, res).catch(next));
/**
 * @openapi
 * /users/{id}/whatsapp-business/messages:
 *   get:
 *     tags: [Users]
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
router.get('/:id/whatsapp-business/messages', (req, res, next) => UserController.getWhatsAppBusinessMessages(req, res).catch(next));
/**
 * @openapi
 * /users/{id}/whatsapp-business/messages:
 *   post:
 *     tags: [Users]
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
router.post('/:id/whatsapp-business/messages', (req, res, next) => UserController.sendWhatsAppBusinessMessage(req, res).catch(next));

router.get('/:id/email-config',  (req, res, next) => EmailConfigController.getForUser(req, res).catch(next));
router.post('/:id/email-config', (req, res, next) => EmailConfigController.saveForUser(req, res).catch(next));

export default router;
