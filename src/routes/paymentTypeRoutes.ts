import { Router } from 'express';
import { PaymentTypeController } from '../controllers/paymentTypeController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

// Apply auth & tenant context to all routes
router.use(protectRoute, requireTenantContext);

router.post('/', (req, res, next) => PaymentTypeController.create(req, res).catch(next));
router.get('/', (req, res, next) => PaymentTypeController.list(req, res).catch(next));
router.get('/:id', (req, res, next) => PaymentTypeController.getByPublicId(req, res).catch(next));
router.put('/:id', (req, res, next) => PaymentTypeController.update(req, res).catch(next));
router.delete('/:id', (req, res, next) => PaymentTypeController.delete(req, res).catch(next));

export default router;
