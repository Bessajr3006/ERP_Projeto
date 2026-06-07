import { Router } from 'express';
import { UiPreferenceController } from '../controllers/uiPreferenceController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

router.use(protectRoute, requireTenantContext);

router.get('/', (req, res, next) => UiPreferenceController.get(req, res).catch(next));
router.post('/', (req, res, next) => UiPreferenceController.save(req, res).catch(next));

export default router;
