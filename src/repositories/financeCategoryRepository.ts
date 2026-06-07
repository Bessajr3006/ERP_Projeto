import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export class FinanceCategoryRepository {
    static async create(publicId: string, companyId: number, name: string, type: string): Promise<number> {
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO categories (public_id, company_id, name, type) VALUES (?, ?, ?, ?)`,
            [publicId, companyId, name, type]
        );
        return result.insertId;
    }

    static async getById(companyId: number, id: number): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT * FROM categories WHERE id = ? AND company_id = ? LIMIT 1`,
            [id, companyId]
        );
        return rows;
    }

    static async getByPublicId(companyId: number, publicId: string): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, name, type FROM categories WHERE public_id = ? AND company_id = ? LIMIT 1`,
            [publicId, companyId]
        );
        return rows;
    }

    static async getAllByCompany(companyId: number): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT * FROM categories WHERE company_id = ? ORDER BY type ASC, name ASC`,
            [companyId]
        );
        return rows;
    }

    static async update(companyId: number, id: number, name: string, type: string): Promise<number> {
        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE categories SET name = ?, type = ? WHERE id = ? AND company_id = ?`,
            [name, type, id, companyId]
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
