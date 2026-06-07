import { Router } from 'express';
import { TaskController } from '../controllers/taskController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

router.use(protectRoute, requireTenantContext);

/**
 * @openapi
 * /tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: Listar tarefas
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Lista de tarefas }
 */
router.get('/', (req, res, next) => TaskController.list(req, res).catch(next));
/**
 * @openapi
 * /tasks:
 *   post:
 *     tags: [Tasks]
 *     summary: Criar tarefa
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Tarefa criada }
 */
router.post('/', (req, res, next) => TaskController.create(req, res).catch(next));
/**
 * @openapi
 * /tasks/{id}:
 *   put:
 *     tags: [Tasks]
 *     summary: Atualizar tarefa
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Tarefa atualizada }
 */
router.put('/:id', (req, res, next) => TaskController.update(req, res).catch(next));
/**
 * @openapi
 * /tasks/{id}:
 *   delete:
 *     tags: [Tasks]
 *     summary: Remover tarefa
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Tarefa removida }
 */
router.delete('/:id', (req, res, next) => TaskController.delete(req, res).catch(next));

export default router;