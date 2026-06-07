import { Router } from 'express';
import { PermissionController } from '../controllers/permissionController';
import { protectRoute } from '../middlewares/authMiddleware';

const router = Router();
router.use(protectRoute);

/**
 * @openapi
 * /permissions/{role}:
 *   get:
 *     tags: [Permissions]
 *     summary: Obter permissoes por perfil
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Permissoes retornadas }
 */
router.get('/:role', PermissionController.getByRole);
/**
 * @openapi
 * /permissions/{role}:
 *   post:
 *     tags: [Permissions]
 *     summary: Atualizar permissoes por perfil
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Permissoes atualizadas }
 */
router.post('/:role', PermissionController.updateByRole);

export default router;
