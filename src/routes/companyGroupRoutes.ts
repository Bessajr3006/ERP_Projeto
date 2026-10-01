import { Router } from 'express';
import { CompanyGroupController } from '../controllers/companyGroupController';
import { protectRoute, requireSuperAdmin, requireSuperAdminOrGroupMaster } from '../middlewares/authMiddleware';

const router = Router();

router.post('/', protectRoute, requireSuperAdmin, (req, res, next) => CompanyGroupController.create(req, res).catch(next));
router.get('/', protectRoute, requireSuperAdminOrGroupMaster, (req, res, next) => CompanyGroupController.list(req, res).catch(next));
router.get('/:id', protectRoute, requireSuperAdminOrGroupMaster, (req, res, next) => CompanyGroupController.getByPublicId(req, res).catch(next));
router.put('/:id', protectRoute, requireSuperAdmin, (req, res, next) => CompanyGroupController.update(req, res).catch(next));
router.delete('/:id', protectRoute, requireSuperAdmin, (req, res, next) => CompanyGroupController.delete(req, res).catch(next));
router.get('/:id/companies', protectRoute, requireSuperAdminOrGroupMaster, (req, res, next) => CompanyGroupController.listCompanies(req, res).catch(next));
router.post('/link-company', protectRoute, requireSuperAdmin, (req, res, next) => CompanyGroupController.linkCompany(req, res).catch(next));

export default router;
