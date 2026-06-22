import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export class FinanceCategoryTypeRepository {
    static async create(publicId: string, companyId: number, name: string, description: string | null): Promise<number> {
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO finance_category_types (public_id, company_id, name, description) VALUES (?, ?, ?, ?)`,
            [publicId, companyId, name, description]
        );
        return result.insertId;
    }

    static async getById(companyId: number, id: number): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT * FROM finance_category_types WHERE id = ? AND company_id = ? LIMIT 1`,
            [id, companyId]
        );
        return rows;
    }

    static async getByPublicId(companyId: number, publicId: string): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT * FROM finance_category_types WHERE public_id = ? AND company_id = ? LIMIT 1`,
            [publicId, companyId]
        );
        return rows;
    }

    static async getAllByCompany(companyId: number): Promise<RowDataPacket[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT * FROM finance_category_types WHERE company_id = ? ORDER BY name ASC`,
            [companyId]
        );
        return rows;
    }

    static async update(companyId: number, id: number, name: string, description: string | null): Promise<number> {
        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE finance_category_types SET name = ?, description = ? WHERE id = ? AND company_id = ?`,
            [name, description, id, companyId]
        );
        return result.affectedRows;
    }

    static async delete(companyId: number, id: number): Promise<number> {
        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM finance_category_types WHERE id = ? AND company_id = ?`,
            [id, companyId]
        );
        return result.affectedRows;
    }
}
