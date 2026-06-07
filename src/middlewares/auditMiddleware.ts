import { NextFunction, Request, Response } from 'express';
import logger from '../config/logger';
import { AuditService } from '../services/auditService';

const AUDITED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function shouldSkipPath(path: string): boolean {
    return path.startsWith('/api/v1/audit') || path.startsWith('/api/v1/auth/me');
}

export function attachAuditActivityListener(req: Request, res: Response): void {
    const method = String(req.method || '').toUpperCase();
    const originalUrl = req.originalUrl || req.url || '';

    if (!AUDITED_METHODS.has(method) || shouldSkipPath(originalUrl)) {
        return;
    }

    if ((req as any).__auditActivityListenerAttached) {
        return;
    }

    (req as any).__auditActivityListenerAttached = true;

    res.on('finish', () => {
        if (!req.user || res.statusCode >= 400) {
            return;
        }

        const requestPath = originalUrl.split('?')[0] || originalUrl;
        const module = AuditService.inferModule(originalUrl);
        const isUiPreferencesUpdate = requestPath === '/api/v1/ui-preferences' && method === 'POST';
        const isActiveToggle = method === 'PATCH' && requestPath.endsWith('/active') && typeof req.body?.is_active === 'boolean';
        const action = isUiPreferencesUpdate
            ? 'UPDATE'
            : (isActiveToggle ? (req.body.is_active ? 'ACTIVATE' : 'INACTIVATE') : AuditService.normalizeAction(method));
        const isItemToggle = isActiveToggle && originalUrl.includes('/items/');

        const uiPreferencesMetadata = isUiPreferencesUpdate
            ? {
                theme: req.body?.theme,
                layout_align: req.body?.layout_align,
                layout_width: req.body?.layout_width,
                nav_color: req.body?.nav_color,
                footer_color: req.body?.footer_color,
            }
            : null;

        AuditService.recordActivity({
            companyId: req.user.company_id,
            userPublicId: String(req.user.id || ''),
            action,
            module,
            description: isUiPreferencesUpdate
                ? 'Alterou preferencias visuais do sistema'
                : (isActiveToggle
                    ? `${req.body.is_active ? 'Ativou' : 'Inativou'} ${isItemToggle ? 'item do pedido' : 'pedido'}`
                    : AuditService.buildDescription(action, module)),
            entityType: isItemToggle ? 'sales_item' : module,
            entityId: typeof req.params?.itemId === 'string' ? req.params.itemId : typeof req.params?.id === 'string' ? req.params.id : null,
            method,
            path: requestPath,
            ipAddress: req.ip || req.socket.remoteAddress || null,
            userAgent: String(req.headers['user-agent'] || ''),
            metadata: {
                statusCode: res.statusCode,
                params: req.params || {},
                ...(uiPreferencesMetadata ? { ui_preferences: uiPreferencesMetadata } : {}),
            },
        }).catch((err) => {
            logger.warn({ err, method, path: originalUrl }, '[audit] Falha ao registrar atividade');
        });
    });
}

export function auditActivityMiddleware(req: Request, res: Response, next: NextFunction): void {
    attachAuditActivityListener(req, res);
    next();
}
