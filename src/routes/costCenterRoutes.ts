import { Router } from 'express';
import { CostCenterController } from '../controllers/costCenterController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

// Apply auth & tenant context to all routes
router.use(protectRoute, requireTenantContext);

router.post('/', (req, res, next) => CostCenterController.create(req, res).catch(next));
router.get('/', (req, res, next) => CostCenterController.list(req, res).catch(next));
router.get('/:id', (req, res, next) => CostCenterController.getByPublicId(req, res).catch(next));
router.put('/:id', (req, res, next) => CostCenterController.update(req, res).catch(next));
router.delete('/:id', (req, res, next) => CostCenterController.delete(req, res).catch(next));

export default router;
