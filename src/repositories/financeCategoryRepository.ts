import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export class FinanceCategoryRepository {
    static async create(publicId: string, companyId: number, name: string, type: string, financeCategoryTypeId: number | null = null): Promise<number> {
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO categories (public_id, company_id, name, type, finance_category_type_id) VALUES (?, ?, ?, ?, ?)`,
            [publicId, companyId, name, type, financeCategoryTypeId]
        );
        return result.insertId;
    }

    static async getById(companyId: number, id: number): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT c.*, fct.name AS finance_category_type_name, fct.public_id AS finance_category_type_public_id
             FROM categories c
             LEFT JOIN finance_category_types fct ON c.finance_category_type_id = fct.id
             WHERE c.id = ? AND c.company_id = ? LIMIT 1`,
            [id, companyId]
        );
        return rows;
    }

    static async getByPublicId(companyId: number, publicId: string): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT c.*, fct.name AS finance_category_type_name, fct.public_id AS finance_category_type_public_id
             FROM categories c
             LEFT JOIN finance_category_types fct ON c.finance_category_type_id = fct.id
             WHERE c.public_id = ? AND c.company_id = ? LIMIT 1`,
            [publicId, companyId]
        );
        return rows;
    }

    static async getAllByCompany(companyId: number): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT c.*, fct.name AS finance_category_type_name, fct.public_id AS finance_category_type_public_id
             FROM categories c
             LEFT JOIN finance_category_types fct ON c.finance_category_type_id = fct.id
             WHERE c.company_id = ? ORDER BY c.type ASC, c.name ASC`,
            [companyId]
        );
        return rows;
    }

    static async update(companyId: number, id: number, name: string, type: string, financeCategoryTypeId: number | null = null): Promise<number> {
        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE categories SET name = ?, type = ?, finance_category_type_id = ? WHERE id = ? AND company_id = ?`,
            [name, type, financeCategoryTypeId, id, companyId]
        );
        return result.affectedRows;
    }

    static async delete(companyId: number, id: number): Promise<number> {
        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM categories WHERE id = ? AND company_id = ?`,
            [id, companyId]
        );
        return result.affectedRows;
    }
}
