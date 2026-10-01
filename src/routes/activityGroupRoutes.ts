import { Router } from 'express';
import { ActivityGroupController } from '../controllers/activityGroupController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

// Apply auth & tenant context to all routes
router.use(protectRoute, requireTenantContext);

router.post('/', (req, res, next) => ActivityGroupController.create(req, res).catch(next));
router.get('/', (req, res, next) => ActivityGroupController.list(req, res).catch(next));
router.get('/:id', (req, res, next) => ActivityGroupController.getByPublicId(req, res).catch(next));
router.put('/:id', (req, res, next) => ActivityGroupController.update(req, res).catch(next));
router.delete('/:id', (req, res, next) => ActivityGroupController.delete(req, res).catch(next));

export default router;
