/**
 * middlewares/httpLogger.ts
 * ──────────────────────────
 * Middleware Express que loga cada requisição HTTP usando pino-http.
 *
 * Campos registrados por request:
 *   - method, url, statusCode, responseTime (ms)
 *   - req.id  → UUID único gerado por pino-http (X-Request-Id)
 *   - user.id / user.company_id → injetados após auth (campo customizado)
 *
 * Rotas silenciadas (não geram log):
 *   - GET /health  → healthcheck de infra (muito frequente, sem valor)
 *   - GET /favicon.ico
 *
 * Uso em app.ts:
 *   import httpLogger from './middlewares/httpLogger';
 *   app.use(httpLogger);
 */

import pinoHttp from 'pino-http';
import logger from '../config/logger';
import { IncomingMessage } from 'http';

const SILENT_ROUTES = new Set(['/health', '/favicon.ico']);

const httpLogger = pinoHttp({
    logger,

    // Gera um request-id único e o envia no header de resposta
    genReqId(req, res) {
        const existing = req.headers['x-request-id'];
        if (existing) return String(existing);
        const id = crypto.randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
    },

    // Customiza o que é logado por requisição
    customLogLevel(_req, res, err) {
        if (err) return 'error';
        if (res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
    },

    customSuccessMessage(req, res) {
        return `${(req as IncomingMessage).method} ${(req as IncomingMessage).url} → ${res.statusCode}`;
    },

    customErrorMessage(req, _res, err) {
        return `${(req as IncomingMessage).method} ${(req as IncomingMessage).url} → ${err.message}`;
    },

    // Campos extras no log de resposta
    customAttributeKeys: {
        req: 'request',
        res: 'response',
        err: 'error',
        responseTime: 'ms',
    },

    // Reduz o objeto req para campos úteis (sem body, sem headers sensíveis)
    serializers: {
        req(req) {
            return {
                id: req.id,
                method: req.method,
                url: req.url,
                remoteAddress: req.remoteAddress,
                userAgent: req.headers?.['user-agent'],
            };
        },
        res(res) {
            return {
                statusCode: res.statusCode,
            };
        },
    },

    // Silencia rotas de infra
    autoLogging: {
        ignore(req) {
            return SILENT_ROUTES.has((req as IncomingMessage).url ?? '');
        },
    },
});

export default httpLogger;
