import { Router } from 'express';
import multer from 'multer';
import { generateBackup } from '../controllers/backup.controller';
import { restoreBackup } from '../controllers/restore.controller';
import { protectRoute, requireAdminOrSuperAdmin } from '../middlewares/authMiddleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Endpoint protegido para admins e super admins
router.get('/', protectRoute, requireAdminOrSuperAdmin, generateBackup);
router.post('/restore', protectRoute, requireAdminOrSuperAdmin, upload.single('file'), restoreBackup);

export default router;
