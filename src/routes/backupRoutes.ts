import { Router } from 'express';
import multer from 'multer';
import { generateBackup, getTables } from '../controllers/backup.controller';
import { restoreBackup, listBackupTables } from '../controllers/restore.controller';
import { protectRoute, requireAdminOrSuperAdmin } from '../middlewares/authMiddleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Endpoint protegido para admins e super admins
router.get('/tables', protectRoute, requireAdminOrSuperAdmin, getTables);
router.get('/', protectRoute, requireAdminOrSuperAdmin, generateBackup);
router.post('/restore/list', protectRoute, requireAdminOrSuperAdmin, upload.single('file'), listBackupTables);
router.post('/restore', protectRoute, requireAdminOrSuperAdmin, upload.single('file'), restoreBackup);

export default router;
