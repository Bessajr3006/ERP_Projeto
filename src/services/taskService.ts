import { randomUUID } from 'crypto';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import pool from '../config/db';
import { AppError } from '../errors/AppError';
import { Task, TaskAttachment, TaskInput, TaskStatus } from '../types/Task';

type TaskRow = RowDataPacket & {
    id: number;
    public_id: string;
    company_id: number;
    title: string;
    due_date: Date | string | null;
    assigned_user_public_id: string | null;
    status: TaskStatus;
    person_type: string | null;
    person_id: string | null;
    attachments_json: string | null;
    created_at: Date | string;
    updated_at: Date | string | null;
    completed_at: Date | string | null;
};

function normalizeNullableText(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized || null;
}

function normalizeDateTime(value: unknown): string | null {
    const normalized = normalizeNullableText(value);
    if (!normalized) return null;
    return normalized.replace('T', ' ').slice(0, 19);
}

function formatDateTime(value: Date | string | null): string | null {
    if (!value) return null;

    if (value instanceof Date) {
        const pad = (part: number) => String(part).padStart(2, '0');
        return [
            value.getFullYear(),
            pad(value.getMonth() + 1),
            pad(value.getDate()),
        ].join('-') + `T${pad(value.getHours())}:${pad(value.getMinutes())}`;
    }

    const normalized = String(value).replace(' ', 'T');
    return normalized.slice(0, 16);
}

function parseAttachments(value: string | null): TaskAttachment[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
        return [];
    }
}

function serializeAttachments(value: unknown): string {
    return JSON.stringify(Array.isArray(value) ? value : []);
}

function mapTask(row: TaskRow): Task {
    return {
        id: row.public_id,
        public_id: row.public_id,
        company_id: row.company_id,
        title: row.title,
        dueDate: formatDateTime(row.due_date),
        userId: row.assigned_user_public_id,
        status: row.status,
        personType: row.person_type,
        personId: row.person_id,
        attachments: parseAttachments(row.attachments_json),
        createdAt: formatDateTime(row.created_at) || '',
        updatedAt: formatDateTime(row.updated_at),
        completedAt: formatDateTime(row.completed_at),
    };
}

export class TaskService {
    static async list(companyId: number): Promise<Task[]> {
        const [rows] = await pool.query<TaskRow[]>(
            `SELECT * FROM tasks WHERE company_id = ? ORDER BY COALESCE(due_date, created_at) ASC, created_at DESC`,
            [companyId]
        );

        return rows.map(mapTask);
    }

    static async getByPublicId(companyId: number, publicId: string): Promise<Task> {
        const [rows] = await pool.query<TaskRow[]>(
            `SELECT * FROM tasks WHERE company_id = ? AND public_id = ? LIMIT 1`,
            [companyId, publicId]
        );

        if (!rows.length) {
            throw new AppError('Tarefa nao encontrada.', 404);
        }

        const row = rows[0];
        if (!row) {
            throw new AppError('Tarefa nao encontrada.', 404);
        }

        return mapTask(row);
    }

    static async create(companyId: number, data: TaskInput): Promise<Task> {
        const publicId = randomUUID();
        const status = data.status || 'pending';
        const completedAt = status === 'completed'
            ? normalizeDateTime(data.completedAt) || normalizeDateTime(new Date().toISOString())
            : null;

        await pool.query<ResultSetHeader>(
            `INSERT INTO tasks (
                public_id, company_id, title, due_date, assigned_user_public_id,
                status, person_type, person_id, attachments_json, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                publicId,
                companyId,
                data.title,
                normalizeDateTime(data.dueDate),
                normalizeNullableText(data.userId),
                status,
                normalizeNullableText(data.personType),
                normalizeNullableText(data.personId),
                serializeAttachments(data.attachments),
                completedAt,
            ]
        );

        return this.getByPublicId(companyId, publicId);
    }

    static async update(companyId: number, publicId: string, data: TaskInput): Promise<Task> {
        await this.getByPublicId(companyId, publicId);

        const status = data.status || 'pending';
        const completedAt = status === 'completed'
            ? normalizeDateTime(data.completedAt) || normalizeDateTime(new Date().toISOString())
            : null;

        await pool.query<ResultSetHeader>(
            `UPDATE tasks
                SET title = ?, due_date = ?, assigned_user_public_id = ?, status = ?,
                    person_type = ?, person_id = ?, attachments_json = ?, completed_at = ?, updated_at = NOW()
              WHERE company_id = ? AND public_id = ?`,
            [
                data.title,
                normalizeDateTime(data.dueDate),
                normalizeNullableText(data.userId),
                status,
                normalizeNullableText(data.personType),
                normalizeNullableText(data.personId),
                serializeAttachments(data.attachments),
                completedAt,
                companyId,
                publicId,
            ]
        );

        return this.getByPublicId(companyId, publicId);
    }

    static async delete(companyId: number, publicId: string): Promise<void> {
        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM tasks WHERE company_id = ? AND public_id = ?`,
            [companyId, publicId]
        );

        if (result.affectedRows === 0) {
            throw new AppError('Tarefa nao encontrada.', 404);
        }
    }
}