/**
 * config/logger.ts
 * ─────────────────
 * Logger estruturado baseado em Pino.
 *
 * • Em DESENVOLVIMENTO: saída pretty (colorida, legível) via pino-pretty.
 * • Em PRODUÇÃO / TESTES: saída ndjson pura (uma linha JSON por evento).
 *   → Compatível com Datadog, Grafana Loki, CloudWatch, etc.
 *
 * Uso:
 *   import logger from '../config/logger';
 *   logger.info('Servidor iniciado');
 *   logger.error({ err }, 'Erro ao criar pedido');
 *   logger.warn({ userId, action }, 'Tentativa de acesso negada');
 */

import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

// Em testes silenciamos o logger por padrão para não poluir o output do Jest.
// Para depurar testes, defina LOG_LEVEL=debug no .env.test ou na variável de ambiente.
const level = isTest
    ? (process.env.LOG_LEVEL ?? 'silent')
    : (process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'));

const transport =
    isDev && !isTest
        ? {
              target: 'pino-pretty',
              options: {
                  colorize: true,
                  translateTime: 'HH:MM:ss.l',
                  ignore: 'pid,hostname',
                  messageFormat: '{msg}',
                  singleLine: false,
              },
          }
        : undefined;

const logger = pino(
    {
        level,
        // Serializers padronizados — expõem apenas campos seguros de "err" e "req"
        serializers: {
            err: pino.stdSerializers.err,
            req: pino.stdSerializers.req,
            res: pino.stdSerializers.res,
        },
        // Redact: oculta campos sensíveis em qualquer log (GDPR / segurança)
        redact: {
            paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'body.password',
                'body.certificate_base64',
                'body.certificate_password',
                '*.password',
                '*.certificate_base64',
                '*.certificate_password',
            ],
            censor: '[REDACTED]',
        },
        // Campos base que aparecem em todos os logs
        base: {
            app: 'bessa-erp',
            env: process.env.NODE_ENV ?? 'production',
        },
        timestamp: pino.stdTimeFunctions.isoTime,
    },
    transport ? pino.transport(transport) : undefined,
);

export default logger;
