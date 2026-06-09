/**
 * server.ts
 * ---------
 * Ponto de entrada do servidor de produção.
 * Apenas importa o app configurado (app.ts) e inicia o .listen().
 * Os testes importam `app.ts` diretamente — sem abrir porta.
 */
import './config/runtimeEnv';
import app from './app';
import logger from './config/logger';
import { WhatsAppBusinessService } from './services/whatsappBusinessService';
import https from 'https';
import fs from 'fs';
import path from 'path';

const PORT = Number(process.env.PORT) || 3030;
const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 8443;
let isShuttingDown = false;
let server: ReturnType<typeof app.listen> | ReturnType<typeof https.createServer> | null = null;

function isIgnorableWhatsAppTargetClose(reason: unknown): boolean {
    const err = reason instanceof Error ? reason : null;
    if (!err) return false;

    const name = String(err.name || '').toLowerCase();
    const message = String(err.message || '').toLowerCase();
    const stack = String(err.stack || '').toLowerCase();

    const hasTargetClosed = name.includes('targetcloseerror') || message.includes('target closed');
    if (!hasTargetClosed) return false;

    const fromWhatsAppOrPuppeteer = stack.includes('whatsapp-web.js') || stack.includes('puppeteer');
    return fromWhatsAppOrPuppeteer;
}

const shutdown = async (signal: string, exitCode: number) => {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;
    logger.info({ signal }, 'Encerrando servidor graciosamente...');

    if (server) {
        server.close(() => {
            process.exit(exitCode);
        });
    }

    setTimeout(() => {
        process.exit(exitCode);
    }, 5000).unref();

    try {
        await WhatsAppBusinessService.shutdownAllSessions();
    } catch (error: unknown) {
        logger.error({ err: error, signal }, '[server] Falha ao encerrar sessoes do WhatsApp Business');
    }

    if (!server) {
        process.exit(exitCode);
    }
};

// Captura unhandledRejection (ex: throw error em async sem next(err))
process.on('unhandledRejection', (reason: unknown) => {
    if (isIgnorableWhatsAppTargetClose(reason)) {
        logger.warn({ err: reason }, '[UnhandledRejection] Erro transitorio do WhatsApp/Puppeteer ignorado (Target closed)');
        return;
    }

    const err = reason instanceof Error ? reason : new Error(String(reason));
    logger.fatal({ err }, '[UnhandledRejection] Promessa rejeitada não capturada');
    void shutdown('unhandledRejection', 1);
});

// Captura erros síncronos não tratados
process.on('uncaughtException', (err: Error) => {
    logger.fatal({ err }, '[UncaughtException] Erro síncrono não capturado');
    void shutdown('uncaughtException', 1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    void shutdown('SIGTERM', 0);
});

process.on('SIGINT', () => {
    void shutdown('SIGINT', 0);
});

const certPath = path.join(process.cwd(), 'certs', 'cert.pem');
const keyPath  = path.join(process.cwd(), 'certs', 'key.pem');
const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);
const useHttps = hasCerts && process.env.NODE_ENV !== 'production';

if (useHttps) {
    const httpsOptions = {
        key:  fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
    };
    server = https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
        logger.info({ port: HTTPS_PORT, protocol: 'https' }, `Servidor Bessa ERP iniciado em https://localhost:${HTTPS_PORT}`);
    });
} else {
    server = app.listen(PORT, () => {
        logger.info({ port: PORT }, `Servidor Bessa ERP iniciado na porta ${PORT}`);
    });
}

// O Polling Worker do WhatsApp foi extraído para src/worker.ts para rodar em seu próprio container/background process
// Garantindo que uso intensivo de CPU (Puppeteer/WhatsApp Web) não afete a API nem congele em ambientes serverless.

// End of file
