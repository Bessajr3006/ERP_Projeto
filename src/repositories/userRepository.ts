import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

function parseMissingColumnFromError(error: unknown): string | null {
    const err = error as { code?: string; message?: string };
    if (err?.code !== 'ER_BAD_FIELD_ERROR') {
        return null;
    }

    const match = String(err?.message || '').match(/Unknown column '([^']+)'/i);
    return match?.[1] || null;
}

async function ensureUserColumn(column: string): Promise<boolean> {
    if (column !== 'default_page') {
        return false;
    }

    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS default_page VARCHAR(100) DEFAULT NULL');
    return true;
}

function removeListItem<T>(list: T[], predicate: (item: T, index: number) => boolean): { list: T[]; removed: boolean } {
    const nextList = list.filter((item, index) => !predicate(item, index));
    return { list: nextList, removed: nextList.length !== list.length };
}

function removeInsertColumn(
    columns: string[],
    placeholders: string[],
    values: any[],
    missingColumn: string,
): { columns: string[]; placeholders: string[]; values: any[]; removed: boolean } {
    const columnIndex = columns.findIndex((column) => column === missingColumn);
    if (columnIndex < 0) {
        return { columns, placeholders, values, removed: false };
    }

    const nextColumns = columns.filter((_, index) => index !== columnIndex);
    const nextPlaceholders = placeholders.filter((_, index) => index !== columnIndex);

    let valueIndexForColumn = -1;
    let currentValueIndex = 0;
    for (let i = 0; i < placeholders.length; i += 1) {
        if (placeholders[i] !== '?') {
            continue;
        }

        if (i === columnIndex) {
            valueIndexForColumn = currentValueIndex;
            break;
        }

        currentValueIndex += 1;
    }

    const nextValues = [...values];
    if (valueIndexForColumn >= 0) {
        nextValues.splice(valueIndexForColumn, 1);
    }

    return {
        columns: nextColumns,
        placeholders: nextPlaceholders,
        values: nextValues,
        removed: true,
    };
}

function removeUpdateColumn(
    updates: string[],
    values: any[],
    missingColumn: string,
): { updates: string[]; values: any[]; removed: boolean } {
    const nextUpdates: string[] = [];
    const nextValues: any[] = [];
    let removed = false;

    for (let i = 0; i < updates.length; i += 1) {
        const update = updates[i] || '';
        const updateColumn = update.split('=')[0]?.trim();
        if (updateColumn === missingColumn) {
            removed = true;
            continue;
        }

        nextUpdates.push(update);
        nextValues.push(values[i]);
    }

    return { updates: nextUpdates, values: nextValues, removed };
}

function isTransientDbDnsError(error: unknown): boolean {
    const err = error as { code?: string };
    const code = String(err?.code || '').toUpperCase();
    return code === 'EAI_AGAIN'
        || code === 'ENOTFOUND'
        || code === 'ECONNRESET'
        || code === 'ETIMEDOUT'
        || code === 'PROTOCOL_CONNECTION_LOST';
}

async function delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryRowsWithRetry(
    query: string,
    params: any[],
    attempts = 8,
    waitMs = 700,
): Promise<RowDataPacket[]> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            const [rows] = await pool.query<RowDataPacket[]>(query, params);
            return rows;
        } catch (error: unknown) {
            lastError = error;
            if (!isTransientDbDnsError(error) || attempt === attempts) {
                throw error;
            }

            // Backoff progressivo para dar tempo de DNS/rede estabilizar no runtime.
            const backoffMs = Math.min(waitMs * Math.pow(2, attempt - 1), 5000);
            await delay(backoffMs);
        }
    }

    throw lastError;
}

export class UserRepository {
    static async resolvePublicIdByIdentifier(companyId: number, identifier: string): Promise<string | null> {
        const normalized = String(identifier || '').trim();
        if (!normalized) {
            return null;
        }

        const [publicRows] = await pool.query<RowDataPacket[]>(
            `SELECT public_id
             FROM users
             WHERE company_id = ? AND public_id = ?
             LIMIT 1`,
            [companyId, normalized]
        );

        if (publicRows.length > 0) {
            return String(publicRows[0]!.public_id);
        }

        const numericId = Number(normalized);
        if (Number.isInteger(numericId) && numericId > 0) {
            const [legacyRows] = await pool.query<RowDataPacket[]>(
                `SELECT public_id
                 FROM users
                 WHERE company_id = ? AND id = ?
                 LIMIT 1`,
                [companyId, numericId]
            );

            if (legacyRows.length > 0) {
                return String(legacyRows[0]!.public_id);
            }
        }

        return null;
    }

    static async getAllByCompany(companyId: number): Promise<RowDataPacket[]> {
        const baseColumns = [
            'public_id',
            'email',
            'full_name',
            'cpf_cnpj',
            'phone',
            'zipcode',
            'street',
            'number',
            'complement',
            'neighborhood',
            'city',
            'state',
            'default_page',
            'whatsapp_auto_reply_mode',
            'role',
            'is_active',
            'created_at',
            'NOT EXISTS (SELECT 1 FROM transactions t WHERE t.company_id = users.company_id AND t.user_id = users.id LIMIT 1) AS is_deletable'
        ];
        let currentColumns = [...baseColumns];

        while (true) {
            try {
                const [rows] = await pool.query<RowDataPacket[]>(
                    `SELECT ${currentColumns.join(', ')}
                     FROM users
                     WHERE company_id = ?
                     ORDER BY full_name ASC`,
                    [companyId]
                );
                return rows;
            } catch (error: unknown) {
                const missingColumn = parseMissingColumnFromError(error);
                if (!missingColumn) {
                    throw error;
                }

                if (await ensureUserColumn(missingColumn)) {
                    continue;
                }

                const reduced = removeListItem(currentColumns, (column) => column === missingColumn);
                if (!reduced.removed) {
                    throw error;
                }

                currentColumns = reduced.list;
            }
        }
    }

    static async getById(companyId: number, publicId: string): Promise<RowDataPacket[]> {
        const baseColumns = [
            'public_id',
            'email',
            'full_name',
            'cpf_cnpj',
            'phone',
            'zipcode',
            'street',
            'number',
            'complement',
            'neighborhood',
            'city',
            'state',
            'default_page',
            'whatsapp_auto_reply_mode',
            'role',
            'is_active',
            'created_at',
            'NOT EXISTS (SELECT 1 FROM transactions t WHERE t.company_id = users.company_id AND t.user_id = users.id LIMIT 1) AS is_deletable'
        ];
        let currentColumns = [...baseColumns];

        while (true) {
            try {
                const [rows] = await pool.query<RowDataPacket[]>(
                    `SELECT ${currentColumns.join(', ')}
                     FROM users
                     WHERE company_id = ? AND public_id = ? LIMIT 1`,
                    [companyId, publicId]
                );
                return rows;
            } catch (error: unknown) {
                const missingColumn = parseMissingColumnFromError(error);
                if (!missingColumn) {
                    throw error;
                }

                if (await ensureUserColumn(missingColumn)) {
                    continue;
                }

                const reduced = removeListItem(currentColumns, (column) => column === missingColumn);
                if (!reduced.removed) {
                    throw error;
                }

                currentColumns = reduced.list;
            }
        }
    }

    static async getScoped(companyId: number, publicId: string): Promise<RowDataPacket[]> {
        const rows = await queryRowsWithRetry(
            `SELECT id, public_id, company_id, email, full_name, role, is_active
             FROM users
             WHERE company_id = ? AND public_id = ? LIMIT 1`,
            [companyId, publicId]
        );
        return rows;
    }

    static async getByEmail(email: string): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM users WHERE email = ? LIMIT 1`,
            [email]
        );
        return rows;
    }

    static async getFullByEmail(email: string): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT * FROM users WHERE email = ? LIMIT 1`,
            [email]
        );
        return rows;
    }

    static async getAdminUserForAuth(companyId: number, email: string): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, password_hash, role FROM users WHERE email = ? AND company_id = ? AND role = 'admin' LIMIT 1`,
            [email, companyId]
        );
        return rows;
    }

    static async create(columns: string[], placeholders: string[], values: any[]): Promise<number> {
        let currentColumns = [...columns];
        let currentPlaceholders = [...placeholders];
        let currentValues = [...values];

        while (true) {
            try {
                const [result] = await pool.query<ResultSetHeader>(
                    `INSERT INTO users (${currentColumns.join(', ')}) VALUES (${currentPlaceholders.join(', ')})`,
                    currentValues
                );
                return result.insertId;
            } catch (error: unknown) {
                const missingColumn = parseMissingColumnFromError(error);
                if (!missingColumn) {
                    throw error;
                }

                if (await ensureUserColumn(missingColumn)) {
                    continue;
                }

                const reduced = removeInsertColumn(currentColumns, currentPlaceholders, currentValues, missingColumn);
                if (!reduced.removed) {
                    throw error;
                }

                currentColumns = reduced.columns;
                currentPlaceholders = reduced.placeholders;
                currentValues = reduced.values;

                if (currentColumns.length === 0) {
                    throw error;
                }
            }
        }
    }

    static async createFull(publicId: string, company_id: number, email: string, passwordHash: string, full_name: string): Promise<number> {
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO users (public_id, company_id, email, password_hash, full_name, role, is_active) 
             VALUES (?, ?, ?, ?, ?, 'user', true)`,
            [publicId, company_id, email, passwordHash, full_name]
        );
        return result.affectedRows;
    }

    static async updateByCompanyAndPublicId(companyId: number, publicId: string, updates: string[], values: any[]): Promise<number> {
        let currentUpdates = [...updates];
        let currentValues = [...values];

        while (currentUpdates.length > 0) {
            try {
                const [result] = await pool.query<ResultSetHeader>(
                    `UPDATE users SET ${currentUpdates.join(', ')} WHERE company_id = ? AND public_id = ?`,
                    [...currentValues, companyId, publicId]
                );
                return result.affectedRows;
            } catch (error: unknown) {
                const missingColumn = parseMissingColumnFromError(error);
                if (!missingColumn) {
                    throw error;
                }

                if (await ensureUserColumn(missingColumn)) {
                    continue;
                }

                const reduced = removeUpdateColumn(currentUpdates, currentValues, missingColumn);
                if (!reduced.removed) {
                    throw error;
                }

                currentUpdates = reduced.updates;
                currentValues = reduced.values;
            }
        }

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM users WHERE company_id = ? AND public_id = ? LIMIT 1`,
            [companyId, publicId]
        );
        return rows.length > 0 ? 1 : 0;
    }

    static async deleteByCompanyAndPublicId(companyId: number, publicId: string): Promise<number> {
        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM users WHERE company_id = ? AND public_id = ?`,
            [companyId, publicId]
        );
        return result.affectedRows;
    }
}
