import { Router } from 'express';
import { RoleController } from '../controllers/roleController';
import { protectRoute } from '../middlewares/authMiddleware';

const router = Router();
router.use(protectRoute);

/**
 * @openapi
 * /roles:
 *   get:
 *     tags: [Roles]
 *     summary: Listar perfis
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de perfis }
 */
router.get('/', RoleController.getAll);
/**
 * @openapi
 * /roles/{slug}:
 *   get:
 *     tags: [Roles]
 *     summary: Obter perfil por slug
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Perfil encontrado }
 */
router.get('/:slug', RoleController.getBySlug);
/**
 * @openapi
 * /roles:
 *   post:
 *     tags: [Roles]
 *     summary: Criar perfil
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Perfil criado }
 */
router.post('/', RoleController.create);
/**
 * @openapi
 * /roles/{slug}:
 *   put:
 *     tags: [Roles]
 *     summary: Atualizar perfil
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Perfil atualizado }
 */
router.put('/:slug', RoleController.update);
/**
 * @openapi
 * /roles/{slug}:
 *   delete:
 *     tags: [Roles]
 *     summary: Remover perfil
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Perfil removido }
 */
router.delete('/:slug', RoleController.delete);

export default router;
