import { Router } from 'express';
import { AuditController } from '../controllers/auditController';
import { protectRoute } from '../middlewares/authMiddleware';

const router = Router();

router.use(protectRoute);

router.get('/activities', (req, res, next) => AuditController.getActivities(req, res).catch(next));
router.get('/users', (req, res, next) => AuditController.getUsers(req, res).catch(next));

export default router;
