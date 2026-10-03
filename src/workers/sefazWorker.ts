
import fs from 'fs';
import logger from '../config/logger';
import { SefazJobRepository } from '../repositories/sefazJobRepository';
import { CompanyService } from '../services/companyService';
import { ManifestationService } from '../services/manifestationService';

let isPolling = false;

async function processNextJob(): Promise<boolean> {
    try {
        return await SefazJobRepository.withTransaction(async (conn) => {
            const job = await SefazJobRepository.lockNextPendingJob(conn);
            if (!job) return false;

            logger.info({ jobId: job.id, type: job.type, companyId: job.company_id }, '[SefazWorker] Processando trabalho');

            try {
                const company = await CompanyService.getById(job.company_id);
                if (!company || !company.cnpj) {
                    throw new Error('Empresa sem configuracao de CNPJ');
                }

                const credentials = await CompanyService.getCertificateCredentials(job.company_id);
                if (!credentials) {
                    throw new Error('Empresa sem configuracao completa de Certificado ou arquivo nao encontrado');
                }

                const pfxBuffer = fs.readFileSync(credentials.pfxPath);
                const env = company.nfe_environment === 1 ? 'producao' : 'homologacao';
                const uf = company.state || 'SP';
                const data = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;

                let result;
                if (job.type === 'consult-destined') {
                    result = await ManifestationService.consultDestinedDocs(
                        pfxBuffer,
                        credentials.password,
                        env,
                        company.cnpj,
                        uf,
                        data.lastNSU || '0'
                    );
                } else if (job.type === 'manifest') {
                    result = await ManifestationService.sendManifestationEvent(
                        pfxBuffer,
                        credentials.password,
                        env,
                        company.cnpj,
                        uf,
                        data.chNFe,
                        data.tpEvento,
                        data.xJust
                    );
                }

                await SefazJobRepository.markJobCompleted(job.id, result);
                logger.info({ jobId: job.id }, '[SefazWorker] Trabalho concluído com sucesso');

            } catch (error: any) {
                logger.error({ err: error, jobId: job.id }, '[SefazWorker] Falha ao processar');
                await SefazJobRepository.markJobFailed(job.id, error.message || 'Erro desconhecido');
            }

            return true;
        });
    } catch (err) {
        logger.error({ err }, '[SefazWorker] Erro critico no banco');
        return false;
    }
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export function startSefazWorker(interval = 5000) {
    if (isPolling) return;
    isPolling = true;
    logger.info('[SefazWorker] Worker da SEFAZ iniciado!');

    setImmediate(async () => {
        while (isPolling) {
            const hasWorked = await processNextJob();
            if (!hasWorked) {
                await sleep(interval);
            } else {
                await sleep(500); // Pequena pausa entre jobs
            }
        }
    });
}
