import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import logger from '../config/logger';

export const errorMiddleware = (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
): void => {
    // 1. Zod Validation Errors
    if (err instanceof ZodError) {
        logger.warn({ err }, 'Zod Validation Error');
        res.status(400).json({
            status: 'error',
            message: 'Erro de validação nos dados enviados.',
            errors: err.errors.map((e) => ({
                path: e.path.join('.'),
                message: e.message
            }))
        });
        return;
    }

    // 2. Operational AppErrors (throw new AppError)
    if (err instanceof AppError) {
        logger.warn({ err }, 'Operational Error');
        res.status(err.statusCode).json({
            status: 'error',
            message: err.message
        });
        return;
    }

    // 3. Unknown / Unhandled Errors (e.g. Database constraints)
    logger.error({ err }, 'Unhandled Exception');
    
    // FORÇAR A MENSAGEM REAL PARA APARECER NO FRONTEND (temporário para debug)
    const message = err.stack ? err.stack : err.message;

    res.status(500).json({
        status: 'error',
        message
    });
    return;
};
