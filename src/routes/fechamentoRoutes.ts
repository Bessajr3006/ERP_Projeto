import { Router } from 'express';
import { FechamentoController } from '../controllers/fechamentoController';
import { protectRoute } from '../middlewares/authMiddleware';
import { requireTenantContext } from '../middlewares/tenantMiddleware';

const router = Router();

// Apply auth & tenant context to all routes
router.use(protectRoute, requireTenantContext);

router.post('/import-sales-xml', (req, res, next) => FechamentoController.importSalesXml(req, res).catch(next));
router.post('/import-sped-fiscal', (req, res, next) => FechamentoController.importSpedFiscal(req, res).catch(next));
router.post('/', (req, res, next) => FechamentoController.create(req, res).catch(next));
router.get('/', (req, res, next) => FechamentoController.list(req, res).catch(next));
router.get('/faturamento-acumulado', (req, res, next) => FechamentoController.getFaturamentoAcumulado(req, res).catch(next));
router.get('/sped-vision', (req, res, next) => FechamentoController.getSpedVision(req, res).catch(next));
router.delete('/imported-sped-movement', (req, res, next) => FechamentoController.deleteImportedSpedMovement(req, res).catch(next));
router.get('/:id', (req, res, next) => FechamentoController.getByPublicId(req, res).catch(next));
router.put('/:id', (req, res, next) => FechamentoController.update(req, res).catch(next));
router.delete('/:id', (req, res, next) => FechamentoController.delete(req, res).catch(next));

export default router;
