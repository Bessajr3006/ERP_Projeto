import { Router } from 'express';
import multer from 'multer';
import { generateBackup, getTables } from '../controllers/backup.controller';
import { restoreBackup, listBackupTables } from '../controllers/restore.controller';
import { protectRoute, requireRole, requireSuperAdmin } from '../middlewares/authMiddleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Listagem de tabelas e geração de backup (super_admin exporta global; admin exporta apenas sua company_id)
router.get('/tables', protectRoute, requireRole('admin', 'super_admin'), getTables);
router.get('/', protectRoute, requireRole('admin', 'super_admin'), generateBackup);

// Restauração de backup é restrita exclusivamente a super_admin
router.post('/restore/list', protectRoute, requireSuperAdmin, upload.single('file'), listBackupTables);
router.post('/restore', protectRoute, requireSuperAdmin, upload.single('file'), restoreBackup);

export default router;
