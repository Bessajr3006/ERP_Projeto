import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import pool from '../config/db';

export interface AuditLogCreateData {
    companyId: number;
    userPublicId?: string | null;
    action: string;
    module: string;
    description: string;
    entityType?: string | null;
    entityId?: string | null;
    method?: string | null;
    path?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown> | null;
}

export interface AuditLogFilters {
    search?: string;
    userId?: string;
    action?: string;
    module?: string;
    dateFrom?: string;
    dateTo?: string;
    limit: number;
    offset: number;
}

export class AuditRepository {
    static async create(data: AuditLogCreateData): Promise<number> {
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO audit_logs (
                company_id, user_id, action, module, description, entity_type, entity_id,
                method, path, ip_address, user_agent, metadata
            ) VALUES (
                ?,
                (SELECT id FROM users WHERE company_id = ? AND public_id = ? LIMIT 1),
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )`,
            [
                data.companyId,
                data.companyId,
                data.userPublicId || null,
                data.action,
                data.module,
                data.description,
                data.entityType || null,
                data.entityId || null,
                data.method || null,
                data.path || null,
                data.ipAddress || null,
                data.userAgent || null,
                data.metadata ? JSON.stringify(data.metadata) : null,
            ]
        );

        return result.insertId;
    }

    static async listActivities(companyId: number, filters: AuditLogFilters): Promise<RowDataPacket[]> {
        const where = ['al.company_id = ?'];
        const params: any[] = [companyId];

        if (filters.search) {
            where.push('(al.description LIKE ? OR al.module LIKE ? OR al.path LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)');
            const term = `%${filters.search}%`;
            params.push(term, term, term, term, term);
        }

        if (filters.userId) {
            where.push('u.public_id = ?');
            params.push(filters.userId);
        }

        if (filters.action) {
            where.push('al.action = ?');
            params.push(filters.action);
        }

        if (filters.module) {
            where.push('al.module = ?');
            params.push(filters.module);
        }

        if (filters.dateFrom) {
            where.push('DATE(al.created_at) >= ?');
            params.push(filters.dateFrom);
        }

        if (filters.dateTo) {
            where.push('DATE(al.created_at) <= ?');
            params.push(filters.dateTo);
        }

        params.push(filters.limit, filters.offset);

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT
                al.id,
                al.action,
                al.module,
                al.description,
                al.entity_type,
                al.entity_id,
                al.method,
                al.path,
                al.ip_address,
                al.user_agent,
                al.metadata,
                al.created_at,
                u.public_id AS user_public_id,
                u.full_name AS user_name,
                u.email AS user_email,
                u.role AS user_role
             FROM audit_logs al
             LEFT JOIN users u ON u.id = al.user_id
             WHERE ${where.join(' AND ')}
             ORDER BY al.created_at DESC, al.id DESC
             LIMIT ? OFFSET ?`,
            params
        );

        return rows;
    }

    static async listUsersActivitySummary(companyId: number): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT
                u.public_id,
                u.full_name,
                u.email,
                u.role,
                u.is_active,
                COUNT(al.id) AS activities_count,
                MAX(al.created_at) AS last_activity_at
             FROM users u
             LEFT JOIN audit_logs al ON al.user_id = u.id AND al.company_id = u.company_id
             WHERE u.company_id = ?
             GROUP BY u.id, u.public_id, u.full_name, u.email, u.role, u.is_active
             ORDER BY last_activity_at DESC, u.full_name ASC`,
            [companyId]
        );

        return rows;
    }
}
