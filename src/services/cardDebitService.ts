import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { CardDebit, CreateCardDebitData, UpdateCardDebitData } from '../types/CardDebit';

export class CardDebitService {
    static async create(companyId: number, data: CreateCardDebitData): Promise<CardDebit> {
        const { date, description, period, value, card_name, card_number, due_date, card_expense_public_id, tempo, category_public_id, observation } = data;
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

        let cardExpenseId: number | null = null;
        if (card_expense_public_id) {
            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT id FROM card_expenses WHERE public_id = ? AND company_id = ? LIMIT 1`,
                [card_expense_public_id, companyId]
            );
            if (rows && rows[0]) {
                cardExpenseId = rows[0].id;
            }
        }

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO card_debits (public_id, company_id, date, description, period, value, card_name, card_number, due_date, card_expense_id, tempo, category_id, observation)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                publicId,
                companyId,
                date,
                description.trim(),
                period.trim(),
                value,
                card_name ? card_name.trim() : null,
                card_number ? card_number.trim() : null,
                due_date || null,
                cardExpenseId,
                tempo ? tempo.trim() : null,
                categoryId,
                observation ? observation.trim() : null
            ]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Failed to create card debit');
        }

        return this.getById(result.insertId, companyId);
    }

    static async getById(id: number, companyId: number): Promise<CardDebit> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT ce.*, c.public_id AS category_public_id, c.name AS category_name,
                    cx.public_id AS card_expense_public_id, cx.description AS card_expense_description
             FROM card_debits ce
             LEFT JOIN categories c ON ce.category_id = c.id
             LEFT JOIN card_expenses cx ON ce.card_expense_id = cx.id
             WHERE ce.id = ? AND ce.company_id = ? LIMIT 1`,
            [id, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Card debit not found');
        }

        return rows[0] as CardDebit;
    }

    static async getByPublicId(publicId: string, companyId: number): Promise<CardDebit> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT ce.*, c.public_id AS category_public_id, c.name AS category_name,
                    cx.public_id AS card_expense_public_id, cx.description AS card_expense_description
             FROM card_debits ce
             LEFT JOIN categories c ON ce.category_id = c.id
             LEFT JOIN card_expenses cx ON ce.card_expense_id = cx.id
             WHERE ce.public_id = ? AND ce.company_id = ? LIMIT 1`,
            [publicId, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Card debit not found');
        }

        return rows[0] as CardDebit;
    }

    static async listByCompany(companyId: number): Promise<CardDebit[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT ce.*, c.public_id AS category_public_id, c.name AS category_name,
                    cx.public_id AS card_expense_public_id, cx.description AS card_expense_description
             FROM card_debits ce
             LEFT JOIN categories c ON ce.category_id = c.id
             LEFT JOIN card_expenses cx ON ce.card_expense_id = cx.id
             WHERE ce.company_id = ? 
             ORDER BY ce.date DESC, ce.created_at DESC`,
            [companyId]
        );

        return rows as CardDebit[];
    }

    static async update(publicId: string, companyId: number, data: UpdateCardDebitData): Promise<CardDebit> {
        const { date, description, period, value, card_name, card_number, due_date, card_expense_public_id, tempo, category_public_id, observation } = data;
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
        if (card_name !== undefined) {
            updates.push('card_name = ?');
            values.push(card_name ? card_name.trim() : null);
        }
        if (card_number !== undefined) {
            updates.push('card_number = ?');
            values.push(card_number ? card_number.trim() : null);
        }
        if (due_date !== undefined) {
            updates.push('due_date = ?');
            values.push(due_date || null);
        }
        if (card_expense_public_id !== undefined) {
            let cardExpenseId: number | null = null;
            if (card_expense_public_id) {
                const [rows] = await pool.query<RowDataPacket[]>(
                    `SELECT id FROM card_expenses WHERE public_id = ? AND company_id = ? LIMIT 1`,
                    [card_expense_public_id, companyId]
                );
                if (rows && rows[0]) {
                    cardExpenseId = rows[0].id;
                }
            }
            updates.push('card_expense_id = ?');
            values.push(cardExpenseId);
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
        if (observation !== undefined) {
            updates.push('observation = ?');
            values.push(observation ? observation.trim() : null);
        }

        if (updates.length === 0) {
            return this.getByPublicId(publicId, companyId);
        }

        values.push(publicId, companyId);

        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE card_debits SET ${updates.join(', ')} WHERE public_id = ? AND company_id = ?`,
            values
        );

        if (result.affectedRows !== 1) {
            throw new Error('Failed to update card debit');
        }

        return this.getByPublicId(publicId, companyId);
    }

    static async delete(publicId: string, companyId: number): Promise<void> {
        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM card_debits WHERE public_id = ? AND company_id = ?`,
            [publicId, companyId]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Card debit not found or failed to delete');
        }
    }
}
