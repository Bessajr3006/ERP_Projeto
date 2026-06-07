import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import logger from '../config/logger';

function parseMissingColumnFromError(error: unknown): string | null {
    const err = error as { code?: string; message?: string };
    if (err?.code !== 'ER_BAD_FIELD_ERROR') {
        return null;
    }

    const match = String(err?.message || '').match(/Unknown column '([^']+)'/i);
    return match?.[1] || null;
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

    // Values representam apenas placeholders "?"; campos com literal (ex.: true) não consomem valor.
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

export class CompanyRepository {
    static async getIbgeStates(): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, uf, name, region FROM ibge_states ORDER BY name ASC, uf ASC`
        );
        return rows;
    }

    static async getAllVisible(): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT *
             FROM companies
             WHERE is_system = FALSE
             ORDER BY trade_name ASC, id ASC`
        );
        return rows;
    }

    static async getByCnpj(cnpj: string): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM companies WHERE cnpj = ? LIMIT 1',
            [cnpj]
        );
        return rows;
    }

    static async getByCnpjExcludingPublicId(cnpj: string, excludePublicId: string): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM companies WHERE cnpj = ? AND public_id != ? LIMIT 1',
            [cnpj, excludePublicId]
        );
        return rows;
    }

    static async getById(id: number): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM companies WHERE id = ? LIMIT 1',
            [id]
        );
        return rows;
    }

    static async getByPublicId(publicId: string): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM companies WHERE public_id = ? LIMIT 1',
            [publicId]
        );
        return rows;
    }

    static async getBySwaggerToken(swaggerToken: string): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM companies WHERE swagger_api_token = ? LIMIT 1',
            [swaggerToken]
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
                    `INSERT INTO companies (${currentColumns.join(', ')}) VALUES (${currentPlaceholders.join(', ')})`,
                    currentValues
                );
                return result.insertId;
            } catch (error: unknown) {
                const missingColumn = parseMissingColumnFromError(error);
                if (!missingColumn) {
                    throw error;
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

    static async update(publicId: string, updates: string[], values: any[]): Promise<void> {
        let currentUpdates = [...updates];
        let currentValues = [...values];

        while (currentUpdates.length > 0) {
            try {
                await pool.query<ResultSetHeader>(
                    `UPDATE companies SET ${currentUpdates.join(', ')} WHERE public_id = ?`,
                    [...currentValues, publicId]
                );
                return;
            } catch (error: unknown) {
                const missingColumn = parseMissingColumnFromError(error);
                if (!missingColumn) {
                    throw error;
                }

                const reduced = removeUpdateColumn(currentUpdates, currentValues, missingColumn);
                if (!reduced.removed) {
                    throw error;
                }

                currentUpdates = reduced.updates;
                currentValues = reduced.values;
            }
        }
    }

    /**
     * Exclui uma empresa e todos os dados relacionados em cascata resiliente.
     * Ignora erros se a tabela não existir, permitindo a limpeza parcial.
     */
    static async deleteCascading(id: number): Promise<void> {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const relatedTables = [
                'sefaz_jobs',
                'manifestation_events',
                'manifestation_docs',
                'finance_bank_reconciliation',
                'finance_bank_statements',
                'finance_transactions',
                'products',
                'customers',
                'vendors',
                'users'
            ];

            for (const table of relatedTables) {
                try {
                    if (table === 'users') {
                        await conn.query("DELETE FROM users WHERE company_id = ? AND role != 'super_admin'", [id]);
                    } else {
                        await conn.query(`DELETE FROM ${table} WHERE company_id = ?`, [id]);
                    }
                } catch (err) {
                    // Ignora erro se a tabela não existir
                    logger.warn({ table, err }, '[CompanyRepository] Falha ao limpar tabela (pode não existir)');
                }
            }

            // A exclusão da empresa deve ser fatal (se falhar, dá rollback)
            await conn.query('DELETE FROM companies WHERE id = ?', [id]);

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }
}
