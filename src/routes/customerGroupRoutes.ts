import { Router } from 'express';
import { CustomerGroupController } from '../controllers/customerGroupController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

// Apply auth & tenant context to all routes
router.use(protectRoute, requireTenantContext);

router.post('/', (req, res, next) => CustomerGroupController.create(req, res).catch(next));
router.get('/', (req, res, next) => CustomerGroupController.list(req, res).catch(next));
router.get('/:id', (req, res, next) => CustomerGroupController.getByPublicId(req, res).catch(next));
router.put('/:id', (req, res, next) => CustomerGroupController.update(req, res).catch(next));
router.delete('/:id', (req, res, next) => CustomerGroupController.delete(req, res).catch(next));

export default router;
