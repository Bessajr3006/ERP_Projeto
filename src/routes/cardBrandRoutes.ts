import { Router } from 'express';
import { CardBrandController } from '../controllers/cardBrandController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

// Apply auth & tenant context to all routes
router.use(protectRoute, requireTenantContext);

router.post('/', (req, res, next) => CardBrandController.create(req, res).catch(next));
router.get('/', (req, res, next) => CardBrandController.list(req, res).catch(next));
router.get('/:id', (req, res, next) => CardBrandController.getByPublicId(req, res).catch(next));
router.put('/:id', (req, res, next) => CardBrandController.update(req, res).catch(next));
router.delete('/:id', (req, res, next) => CardBrandController.delete(req, res).catch(next));

export default router;
