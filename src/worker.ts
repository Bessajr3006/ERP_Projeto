/**
 * worker.ts
 * ---------
 * Ponto de entrada dedicado para processos em Background e Filas (WhatsApp e SEFAZ).
 * Roda de forma independente da API principal.
 */
import 'dotenv/config';
import './config/runtimeEnv';
import logger from './config/logger';
import { startWhatsAppWorker } from './workers/whatsappWorker';
import { startSefazWorker } from './workers/sefazWorker';

// Captura erros fatias para não derrubar silenciosamente
process.on('unhandledRejection', (reason: unknown) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    logger.fatal({ err }, '[Worker UnhandledRejection] Promessa rejeitada não capturada');
});

process.on('uncaughtException', (err: Error) => {
    logger.fatal({ err }, '[Worker UncaughtException] Erro síncrono não capturado');
});

process.on('SIGTERM', () => {
    logger.info('SIGTERM recebido — encerrando worker graciosamente...');
    process.exit(0);
});

// Inicia os listeners e loop de polling
logger.info('Iniciando Container de Background Jobs (Worker)...');
startWhatsAppWorker();
startSefazWorker();
