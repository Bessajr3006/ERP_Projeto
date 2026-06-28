import { Router } from 'express';
import { ReceivableTypeController } from '../controllers/receivableTypeController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

// Apply auth & tenant context to all routes
router.use(protectRoute, requireTenantContext);

router.post('/', (req, res, next) => ReceivableTypeController.create(req, res).catch(next));
router.get('/', (req, res, next) => ReceivableTypeController.list(req, res).catch(next));
router.get('/:id', (req, res, next) => ReceivableTypeController.getByPublicId(req, res).catch(next));
router.put('/:id', (req, res, next) => ReceivableTypeController.update(req, res).catch(next));
router.delete('/:id', (req, res, next) => ReceivableTypeController.delete(req, res).catch(next));

export default router;
