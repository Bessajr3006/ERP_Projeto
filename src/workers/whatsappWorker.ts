import { WhatsAppBusinessService } from '../services/whatsappBusinessService';
import logger from '../config/logger';
import { WhatsappJobRepository } from '../repositories/whatsappJobRepository';

let isPolling = false;

// Retorna true se processou algo, false se fila vazia ou erro critico DB
async function processNextJob(): Promise<boolean> {
    try {
        return await WhatsappJobRepository.withTransaction(async (conn) => {
            const job = await WhatsappJobRepository.lockNextPendingJob(conn);
            if (!job) {
                // Sem jobs pendentes
                return false;
            }

            logger.info({ jobId: job.id, type: job.type, payload: job.payload }, '[WhatsAppWorker] Processando job (MySQL)');

            try {
                const data = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;

                switch (job.type) {
                    case 'start-company-session':
                        await WhatsAppBusinessService.startSession(data.companyId);
                        break;
                    case 'start-user-session':
                        await WhatsAppBusinessService.startUserSession(data.companyId, data.userId);
                        break;
                    case 'disconnect-company':
                        await WhatsAppBusinessService.disconnectSession(data.companyId);
                        break;
                    case 'disconnect-user':
                        await WhatsAppBusinessService.disconnectUserSession(data.companyId, data.userId);
                        break;
                    case 'send-company-message':
                        await WhatsAppBusinessService.sendMessage(data.companyId, data.payload);
                        break;
                    case 'send-user-message':
                        await WhatsAppBusinessService.sendUserMessage(data.companyId, data.userId, data.payload);
                        break;
                    default:
                        logger.warn(`[WhatsAppWorker] Job type desconhecido: ${job.type}`);
                }
                
                await WhatsappJobRepository.markJobCompleted(job.id);
                logger.info({ jobId: job.id, type: job.type }, '[WhatsAppWorker] Processado com sucesso no DB');

            } catch (error: any) {
                logger.error({ err: error, jobId: job.id, type: job.type }, '[WhatsAppWorker] Erro ao processar job');
                const errorMessage = error?.message?.substring(0, 1000) || 'Erro desconhecido';
                await WhatsappJobRepository.markJobFailed(job.id, errorMessage);
            }

            return true; // Retorna true pois um work foi consumido da fila
        });
    } catch (dbError) {
        logger.error({ err: dbError }, '[WhatsAppWorker] Erro ao acessar o banco de dados no worker nativo');
        return false;
    }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function startWhatsAppWorker(pollingIntervalMs = 3000) {
    if (isPolling) return;
    isPolling = true;
    logger.info('[WhatsAppWorker] Worker nativo (MySQL) iniciado! Loop Otimizado em andamento...');
    
    // Loop assíncrono blindado ao invés de setInterval (evita sobreposição e acúmulo de requisições pendentes na memória)
    // Se a fila tiver itens, ele esvazia tudo continuamente da forma mais rápida que o servidor suportar.
    // Se não tiver, aguarda o sleep() sem sugar recursos.
    setImmediate(async () => {
        while (isPolling) {
            try {
                const hasProcessedTask = await processNextJob();
                
                if (!hasProcessedTask) {
                    await sleep(pollingIntervalMs);
                } else {
                    // Cede o loop de eventos pro Node processar callbacks nativos rapidinho pra não travar o processo
                    await sleep(0); 
                }
            } catch (fatalError) {
                logger.error({ err: fatalError }, '[WhatsAppWorker] Loop Error');
                await sleep(pollingIntervalMs); // Se estourar a conexão, segura a emoção
            }
        }
    });
}

