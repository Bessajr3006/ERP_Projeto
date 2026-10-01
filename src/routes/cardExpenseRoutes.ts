import { Router } from 'express';
import { CardExpenseController } from '../controllers/cardExpenseController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

// Apply auth & tenant context to all routes
router.use(protectRoute, requireTenantContext);

router.post('/', (req, res, next) => CardExpenseController.create(req, res).catch(next));
router.get('/', (req, res, next) => CardExpenseController.list(req, res).catch(next));
router.post('/parse-pdf', (req, res, next) => CardExpenseController.parsePdf(req, res).catch(next));
router.post('/bulk', (req, res, next) => CardExpenseController.createBulk(req, res).catch(next));
router.post('/bulk-delete', (req, res, next) => CardExpenseController.bulkDelete(req, res).catch(next));
router.get('/:id', (req, res, next) => CardExpenseController.getByPublicId(req, res).catch(next));
router.put('/:id', (req, res, next) => CardExpenseController.update(req, res).catch(next));
router.delete('/:id', (req, res, next) => CardExpenseController.delete(req, res).catch(next));

export default router;
