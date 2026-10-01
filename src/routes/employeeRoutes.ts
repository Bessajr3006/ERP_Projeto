import { Router } from 'express';
import { EmployeeController } from '../controllers/employeeController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

// Apply auth & tenant context to all routes
router.use(protectRoute, requireTenantContext);

router.post('/', (req, res, next) => EmployeeController.create(req, res).catch(next));
router.get('/', (req, res, next) => EmployeeController.list(req, res).catch(next));
router.get('/:id', (req, res, next) => EmployeeController.getByPublicId(req, res).catch(next));
router.put('/:id', (req, res, next) => EmployeeController.update(req, res).catch(next));
router.delete('/:id', (req, res, next) => EmployeeController.delete(req, res).catch(next));

export default router;
