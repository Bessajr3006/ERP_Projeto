import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { CompanyService } from '../services/companyService';
import logger from '../config/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export class SuperAdminController {
    /**
     * Permite que um Super Admin mude seu contexto para outra empresa.
     * Gera um novo token JWT com o ID da empresa alvo.
     */
    static async switchContext(req: Request, res: Response): Promise<void> {
        try {
            // Apenas super_admin pode usar esta rota (protegido pelo middleware no router)
            const targetCompanyPublicId = req.params.id;

            if (!targetCompanyPublicId) {
                res.status(400).json({ status: 'error', message: 'ID da empresa alvo é obrigatório.' });
                return;
            }

            // 1. Buscar a empresa alvo para obter o ID interno
            const targetCompany = await CompanyService.getByPublicId(targetCompanyPublicId);

            const payload = {
                id: req.user!.id,
                role: 'super_admin',
                company_id: targetCompany.id
            };

            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] & string });

            logger.info({ 
                superAdminId: req.user!.id, 
                fromCompany: req.user!.company_id, 
                toCompany: targetCompany.id 
            }, '[SuperAdmin] Context switch performed');

            res.status(200).json({
                status: 'success',
                data: {
                    token,
                    company: targetCompany
                }
            });
        } catch (error: any) {
            logger.error({ err: error, superAdminId: req.user?.id }, '[SuperAdmin/switchContext] Exception');
            res.status(500).json({ status: 'error', message: error.message || 'Erro ao trocar contexto da empresa.' });
        }
    }
}
