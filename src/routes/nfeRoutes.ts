import { Router } from 'express';
import { generateNFe, testCertificate } from '../controllers/nfeController';
import { protectRoute } from '../middlewares/authMiddleware';

const router = Router();

// Endpoint secured by auth token
/**
 * @openapi
 * /nfe/generate:
 *   post:
 *     tags: [NFe]
 *     summary: Gerar NFe
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: NFe gerada }
 */
router.post('/generate', protectRoute, generateNFe);
/**
 * @openapi
 * /nfe/test-certificate:
 *   post:
 *     tags: [NFe]
 *     summary: Testar certificado digital
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Certificado validado }
 */
router.post('/test-certificate', protectRoute, testCertificate);

export default router;
