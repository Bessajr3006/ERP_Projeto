import { AuditRepository, AuditLogCreateData, AuditLogFilters } from '../repositories/auditRepository';

const ACTION_LABELS: Record<string, string> = {
    CREATE: 'Criou',
    UPDATE: 'Alterou',
    DELETE: 'Removeu',
    LOGIN: 'Entrou',
    ACTIVATE: 'Ativou',
    INACTIVATE: 'Inativou',
};

const MODULE_LABELS: Record<string, string> = {
    audit: 'Auditoria',
    auth: 'Autenticação',
    users: 'Usuários',
    roles: 'Perfis',
    permissions: 'Permissões',
    customers: 'Clientes',
    suppliers: 'Fornecedores',
    products: 'Produtos',
    estoque: 'Estoque',
    sales: 'Vendas',
    orders: 'Pedidos',
    purchases: 'Compras',
    finance: 'Financeiro',
    companies: 'Empresa',
    tasks: 'Tarefas',
    organizer: 'Organizador',
    nfe: 'NF-e',
    manifestation: 'Manifestação',
    accounting: 'Contabilidade',
};

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function normalizeText(value: unknown, max = 120): string | undefined {
    if (value === undefined || value === null) return undefined;
    const text = String(value).trim();
    if (!text) return undefined;
    return text.slice(0, max);
}

function parseMetadata(value: unknown): Record<string, unknown> | null {
    if (!value) return null;
    if (typeof value === 'object') return value as Record<string, unknown>;

    try {
        const parsed = JSON.parse(String(value));
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

export class AuditService {
    static normalizeAction(method: string): string {
        const normalized = String(method || '').toUpperCase();
        if (normalized === 'POST') return 'CREATE';
        if (normalized === 'PUT' || normalized === 'PATCH') return 'UPDATE';
        if (normalized === 'DELETE') return 'DELETE';
        return normalized || 'ACTION';
    }

    static inferModule(path: string): string {
        const cleaned = String(path || '').split('?')[0] || '';
        const segments = cleaned.split('/').filter(Boolean);
        const apiIndex = segments.findIndex((segment) => segment === 'v1');
        const moduleSegment = apiIndex >= 0 ? segments[apiIndex + 1] : segments[0];
        return (moduleSegment || 'system').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'system';
    }

    static buildDescription(action: string, module: string): string {
        const actionLabel = ACTION_LABELS[action] || action;
        const moduleLabel = MODULE_LABELS[module] || module;
        return `${actionLabel} registro em ${moduleLabel}`.slice(0, 255);
    }

    static async recordActivity(data: AuditLogCreateData): Promise<void> {
        await AuditRepository.create({
            ...data,
            action: normalizeText(data.action, 30) || 'ACTION',
            module: normalizeText(data.module, 80) || 'system',
            description: normalizeText(data.description, 255) || AuditService.buildDescription(data.action, data.module),
            entityType: normalizeText(data.entityType, 80) || null,
            entityId: normalizeText(data.entityId, 100) || null,
            method: normalizeText(data.method, 10) || null,
            path: normalizeText(data.path, 255) || null,
            ipAddress: normalizeText(data.ipAddress, 45) || null,
            userAgent: normalizeText(data.userAgent, 500) || null,
        });
    }

    static async listActivities(companyId: number, query: Record<string, unknown>) {
        const filters: AuditLogFilters = {
            limit: clampNumber(query.limit, 200, 1, 500),
            offset: clampNumber(query.offset, 0, 0, 100000),
        };

        const search = normalizeText(query.search, 120);
        const userId = normalizeText(query.user_id, 80);
        const action = normalizeText(query.action, 30);
        const module = normalizeText(query.module, 80);
        const dateFrom = normalizeText(query.date_from, 10);
        const dateTo = normalizeText(query.date_to, 10);

        if (search) filters.search = search;
        if (userId) filters.userId = userId;
        if (action) filters.action = action;
        if (module) filters.module = module;
        if (dateFrom) filters.dateFrom = dateFrom;
        if (dateTo) filters.dateTo = dateTo;

        const rows = await AuditRepository.listActivities(companyId, filters);
        return rows.map((row) => ({
            ...row,
            metadata: parseMetadata(row.metadata),
        }));
    }

    static async listUsersActivitySummary(companyId: number) {
        return AuditRepository.listUsersActivitySummary(companyId);
    }
}
