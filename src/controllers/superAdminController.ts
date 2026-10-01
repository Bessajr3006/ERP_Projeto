import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { CompanyService } from '../services/companyService';
import pool from '../config/db';
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

            // 2. Validação de privilégios: Super Admin, ADM Geral ou Empresa Master do Grupo
            const userCompany = await CompanyService.getById(req.user!.company_id);
            const isGeneralAdmin = userCompany.is_general_admin === true || (userCompany as any).is_general_admin === 1 || Boolean(req.user!.general_admin_company_id);
            const isSuperAdmin = req.user!.role === 'super_admin' || isGeneralAdmin;

            let masterCompanyId: number | undefined = undefined;
            let generalAdminCompanyId: number | undefined = undefined;

            if (isGeneralAdmin && req.user!.role !== 'super_admin') {
                generalAdminCompanyId = req.user!.general_admin_company_id || userCompany.id;
            }

            if (!isSuperAdmin) {
                let masterCompany = null;
                if (req.user!.group_master_company_id) {
                    masterCompany = await CompanyService.getById(req.user!.group_master_company_id);
                } else if (userCompany.is_group_master && userCompany.company_group_id) {
                    masterCompany = userCompany;
                }

                if (!masterCompany || !masterCompany.company_group_id || !masterCompany.is_group_master) {
                    res.status(403).json({ status: 'error', message: 'Acesso negado. Usuário não possui privilégios de Administrador Geral nem de Empresa Master do Grupo.' });
                    return;
                }

                if (targetCompany.company_group_id !== masterCompany.company_group_id) {
                    res.status(403).json({ status: 'error', message: 'Acesso negado. Você só tem permissão para acessar empresas pertencentes ao seu grupo.' });
                    return;
                }

                masterCompanyId = masterCompany.id;
            }

            const payload: any = {
                id: req.user!.id,
                role: isSuperAdmin && req.user!.role === 'super_admin' ? 'super_admin' : req.user!.role,
                company_id: targetCompany.id
            };

            if (generalAdminCompanyId) {
                payload.general_admin_company_id = generalAdminCompanyId;
            }

            if (masterCompanyId) {
                payload.group_master_company_id = masterCompanyId;
            }

            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] & string });

            // Atualiza a sessão ativa do usuário no banco para evitar conflito de sessão única
            try {
                await pool.query(
                    'UPDATE users SET current_session_token = ?, last_activity_at = NOW() WHERE public_id = ?',
                    [token, req.user!.id]
                );
            } catch (updateErr) {
                logger.warn({ err: updateErr, userId: req.user!.id }, '[SuperAdmin/switchContext] Failed to update current_session_token');
            }

            logger.info({ 
                userId: req.user!.id, 
                fromCompany: req.user!.company_id, 
                toCompany: targetCompany.id,
                masterCompanyId,
                generalAdminCompanyId
            }, '[SuperAdmin/GroupMaster] Context switch performed');

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
