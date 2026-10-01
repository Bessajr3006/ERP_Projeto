import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { CardExpense, CreateCardExpenseData, UpdateCardExpenseData } from '../types/CardExpense';

export class CardExpenseService {
    static async create(companyId: number, data: CreateCardExpenseData): Promise<CardExpense> {
        const { date, description, period, value, tempo, category_public_id, card_debit_public_id, observation } = data;
        const publicId = randomUUID();

        let categoryId: number | null = null;
        if (category_public_id) {
            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT id FROM categories WHERE public_id = ? AND company_id = ? LIMIT 1`,
                [category_public_id, companyId]
            );
            if (rows && rows[0]) {
                categoryId = rows[0].id;
            }
        }

        let cardDebitId: number | null = null;
        if (card_debit_public_id) {
            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT id FROM card_debits WHERE public_id = ? AND company_id = ? LIMIT 1`,
                [card_debit_public_id, companyId]
            );
            if (rows && rows[0]) {
                cardDebitId = rows[0].id;
            }
        }

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO card_expenses (public_id, company_id, date, description, period, value, tempo, category_id, card_debit_id, observation)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [publicId, companyId, date, description.trim(), period.trim(), value, tempo ? tempo.trim() : null, categoryId, cardDebitId, observation ? observation.trim() : null]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Failed to create card expense');
        }

        return this.getById(result.insertId, companyId);
    }

    static async getById(id: number, companyId: number): Promise<CardExpense> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT ce.*, c.public_id AS category_public_id, c.name AS category_name,
                    cd.public_id AS card_debit_public_id, cd.description AS card_debit_description
             FROM card_expenses ce
             LEFT JOIN categories c ON ce.category_id = c.id
             LEFT JOIN card_debits cd ON ce.card_debit_id = cd.id
             WHERE ce.id = ? AND ce.company_id = ? LIMIT 1`,
            [id, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Card expense not found');
        }

        return rows[0] as CardExpense;
    }

    static async getByPublicId(publicId: string, companyId: number): Promise<CardExpense> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT ce.*, c.public_id AS category_public_id, c.name AS category_name,
                    cd.public_id AS card_debit_public_id, cd.description AS card_debit_description
             FROM card_expenses ce
             LEFT JOIN categories c ON ce.category_id = c.id
             LEFT JOIN card_debits cd ON ce.card_debit_id = cd.id
             WHERE ce.public_id = ? AND ce.company_id = ? LIMIT 1`,
            [publicId, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Card expense not found');
        }

        return rows[0] as CardExpense;
    }

    static async listByCompany(companyId: number): Promise<CardExpense[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT ce.*, c.public_id AS category_public_id, c.name AS category_name,
                    cd.public_id AS card_debit_public_id, cd.description AS card_debit_description
             FROM card_expenses ce
             LEFT JOIN categories c ON ce.category_id = c.id
             LEFT JOIN card_debits cd ON ce.card_debit_id = cd.id
             WHERE ce.company_id = ? 
             ORDER BY ce.date DESC, ce.created_at DESC`,
            [companyId]
        );

        return rows as CardExpense[];
    }

    static async update(publicId: string, companyId: number, data: UpdateCardExpenseData): Promise<CardExpense> {
        const { date, description, period, value, tempo, category_public_id, card_debit_public_id, observation } = data;
        const updates: string[] = [];
        const values: any[] = [];

        if (date !== undefined) {
            updates.push('date = ?');
            values.push(date);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description.trim());
        }
        if (period !== undefined) {
            updates.push('period = ?');
            values.push(period.trim());
        }
        if (value !== undefined) {
            updates.push('value = ?');
            values.push(value);
        }
        if (tempo !== undefined) {
            updates.push('tempo = ?');
            values.push(tempo ? tempo.trim() : null);
        }
        if (category_public_id !== undefined) {
            let categoryId: number | null = null;
            if (category_public_id) {
                const [rows] = await pool.query<RowDataPacket[]>(
                    `SELECT id FROM categories WHERE public_id = ? AND company_id = ? LIMIT 1`,
                    [category_public_id, companyId]
                );
                if (rows && rows[0]) {
                    categoryId = rows[0].id;
                }
            }
            updates.push('category_id = ?');
            values.push(categoryId);
        }
        if (card_debit_public_id !== undefined) {
            let cardDebitId: number | null = null;
            if (card_debit_public_id) {
                const [rows] = await pool.query<RowDataPacket[]>(
                    `SELECT id FROM card_debits WHERE public_id = ? AND company_id = ? LIMIT 1`,
                    [card_debit_public_id, companyId]
                );
                if (rows && rows[0]) {
                    cardDebitId = rows[0].id;
                }
            }
            updates.push('card_debit_id = ?');
            values.push(cardDebitId);
        }
        if (observation !== undefined) {
            updates.push('observation = ?');
            values.push(observation ? observation.trim() : null);
        }

        if (updates.length === 0) {
            return this.getByPublicId(publicId, companyId);
        }

        values.push(publicId, companyId);

        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE card_expenses 
             SET ${updates.join(', ')} 
             WHERE public_id = ? AND company_id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            throw new Error('Card expense not found or nothing changed');
        }

        return this.getByPublicId(publicId, companyId);
    }

    static async delete(publicId: string, companyId: number): Promise<void> {
        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM card_expenses WHERE public_id = ? AND company_id = ?`,
            [publicId, companyId]
        );

        if (result.affectedRows === 0) {
            throw new Error('Card expense not found');
        }
    }

    static async bulkDelete(publicIds: string[], companyId: number): Promise<{ deletedCount: number }> {
        if (!publicIds || publicIds.length === 0) {
            return { deletedCount: 0 };
        }

        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM card_expenses WHERE public_id IN (?) AND company_id = ?`,
            [publicIds, companyId]
        );

        return { deletedCount: result.affectedRows };
    }

    static async createBulk(companyId: number, items: CreateCardExpenseData[]): Promise<void> {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            for (const item of items) {
                const { date, description, period, value, tempo, category_public_id, card_debit_public_id, observation } = item;
                const publicId = randomUUID();

                let categoryId: number | null = null;
                if (category_public_id) {
                    const [rows] = await connection.query<RowDataPacket[]>(
                        `SELECT id FROM categories WHERE public_id = ? AND company_id = ? LIMIT 1`,
                        [category_public_id, companyId]
                    );
                    if (rows && rows[0]) {
                        categoryId = rows[0].id;
                    }
                }

                let cardDebitId: number | null = null;
                if (card_debit_public_id) {
                    const [rows] = await connection.query<RowDataPacket[]>(
                        `SELECT id FROM card_debits WHERE public_id = ? AND company_id = ? LIMIT 1`,
                        [card_debit_public_id, companyId]
                    );
                    if (rows && rows[0]) {
                        cardDebitId = rows[0].id;
                    }
                }

                await connection.query(
                    `INSERT INTO card_expenses (public_id, company_id, date, description, period, value, tempo, category_id, card_debit_id, observation)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [publicId, companyId, date, description.trim(), period.trim(), value, tempo ? tempo.trim() : null, categoryId, cardDebitId, observation ? observation.trim() : null]
                );
            }

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}
