import { Router } from 'express';
import { DocumentController } from '../controllers/documentController';
import { protectRoute } from '../middlewares/authMiddleware';

const router = Router();

/**
 * @openapi
 * /documents/{id}:
 *   get:
 *     tags: [Documents]
 *     summary: Obter documento anexado com validação de posse multi-tenant
 *     description: |
 *       Retorna o arquivo de documento solicitado após validação de autenticação e
 *       verificação de posse pela empresa (`company_id`) do usuário requisitante.
 *       Certificados digitais `.pfx` nunca são transferidos por esta rota.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Nome ou identificador do documento
 *     responses:
 *       200:
 *         description: Arquivo do documento
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso negado (outra empresa ou certificado .pfx bloqueado)
 *       404:
 *         description: Documento não encontrado
 */
router.get('/:id', protectRoute, (req, res, next) => DocumentController.getDocument(req, res).catch(next));

export default router;
