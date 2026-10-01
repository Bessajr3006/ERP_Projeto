import { Router } from 'express';
import { CardConfigurationController } from '../controllers/cardConfigurationController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

// Apply auth & tenant context to all routes
router.use(protectRoute, requireTenantContext);

router.post('/', (req, res, next) => CardConfigurationController.create(req, res).catch(next));
router.get('/', (req, res, next) => CardConfigurationController.list(req, res).catch(next));
router.get('/:id', (req, res, next) => CardConfigurationController.getByPublicId(req, res).catch(next));
router.put('/:id', (req, res, next) => CardConfigurationController.update(req, res).catch(next));
router.delete('/:id', (req, res, next) => CardConfigurationController.delete(req, res).catch(next));

export default router;
