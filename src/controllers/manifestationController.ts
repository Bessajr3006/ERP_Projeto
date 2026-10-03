import { Request, Response } from 'express';
import { CompanyService } from '../services/companyService';
import { ManifestationService } from '../services/manifestationService';
import { enqueueSefazManifest } from '../queues/sefazQueue';
import pool from '../config/db';
import logger from '../config/logger';

export class ManifestationController {
    /**
     * Consulta documentos fiscais eletrônicos diretamente (modo síncrono para contornar erro de banco).
     */
    static async consultDestined(req: Request, res: Response): Promise<void> {
        try {
            const companyId = (req as any).user?.company_id;
            const lastNSU = (req.query.lastNSU as string) || '0';

            const company = await CompanyService.getById(companyId);
            if (!company?.cnpj) {
                res.status(400).json({ status: 'error', message: 'CNPJ da empresa não configurado.' });
                return;
            }

            const credentials = await CompanyService.getCertificateCredentials(companyId);
            if (!credentials) {
                res.status(400).json({ status: 'error', message: 'Certificado digital não configurado ou arquivo não encontrado.' });
                return;
            }

            const fs = await import('fs');
            const pfxBuffer = fs.readFileSync(credentials.pfxPath);
            const env = (company.nfe_environment as any) === 'producao' ? 'producao' : 'homologacao';
            
            logger.info({ companyId, env, cnpj: company.cnpj }, '[Manifestation] Iniciando consulta síncrona');

            const result = await ManifestationService.consultDestinedDocs(
                pfxBuffer,
                credentials.password,
                env,
                company.cnpj,
                company.state || 'SP',
                lastNSU
            );

            res.json({ 
                status: 'success', 
                data: result 
            });
        } catch (error: any) {
             logger.error({ err: error }, 'Erro ao consultar SEFAZ (Modo Sincrono)');
             res.status(500).json({ status: 'error', message: error.message || 'Erro ao processar consulta na SEFAZ.' });
        }
    }

    /**
     * Enfileira uma manifestação de nota.
     */
    static async manifest(req: Request, res: Response): Promise<void> {
        try {
            const companyId = (req as any).user?.company_id;
            const { chNFe, tpEvento, xJust } = req.body;

            if (!chNFe || !tpEvento) {
                res.status(400).json({ status: 'error', message: 'Dados incompletos.' });
                return;
            }

            const jobId = await enqueueSefazManifest(companyId, { chNFe, tpEvento, xJust });
            res.status(202).json({ 
                status: 'success', 
                message: 'Manifestacao enfileirada.', 
                jobId: jobId 
            });
        } catch (error: any) {
            logger.error({ err: error }, 'Erro ao enfileirar manifestacao');
            res.status(500).json({ status: 'error', message: 'Falha ao processar.' });
        }
    }

    /**
     * Consulta o status de um Job na fila.
     */
    static async checkStatus(req: Request, res: Response): Promise<void> {
        try {
            const { jobId } = req.params;
            const [rows] = await pool.query<any>('SELECT * FROM sefaz_jobs WHERE id = ? LIMIT 1', [jobId]);
            const job = rows[0];

            if (!job) {
                res.status(404).json({ status: 'error', message: 'Trabalho nao encontrado.' });
                return;
            }

            res.json({
                status: 'success',
                data: {
                    id: job.id,
                    status: job.status,
                    error: job.error_message,
                    result: job.result ? (typeof job.result === 'string' ? JSON.parse(job.result) : job.result) : null
                }
            });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: 'Erro ao consultar status.' });
        }
    }
}
