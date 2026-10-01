import { Router } from 'express';
import { CardDebitController } from '../controllers/cardDebitController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

// Apply auth & tenant context to all routes
router.use(protectRoute, requireTenantContext);

router.post('/', (req, res, next) => CardDebitController.create(req, res).catch(next));
router.get('/', (req, res, next) => CardDebitController.list(req, res).catch(next));
router.get('/:id', (req, res, next) => CardDebitController.getByPublicId(req, res).catch(next));
router.put('/:id', (req, res, next) => CardDebitController.update(req, res).catch(next));
router.delete('/:id', (req, res, next) => CardDebitController.delete(req, res).catch(next));

export default router;
