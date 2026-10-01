import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { CardBrand, CreateCardBrandData, UpdateCardBrandData } from '../types/CardBrand';

export class CardBrandService {
    static async create(companyId: number, data: CreateCardBrandData): Promise<CardBrand> {
        const { name } = data;
        const publicId = randomUUID();

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO card_brands (public_id, company_id, name)
             VALUES (?, ?, ?)`,
            [publicId, companyId, name.trim()]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Failed to create card brand');
        }

        return this.getById(result.insertId, companyId);
    }

    static async getById(id: number, companyId: number): Promise<CardBrand> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cb.* 
             FROM card_brands cb
             WHERE cb.id = ? AND cb.company_id = ? LIMIT 1`,
            [id, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Card brand not found');
        }

        return rows[0] as CardBrand;
    }

    static async getByPublicId(publicId: string, companyId: number): Promise<CardBrand> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cb.* 
             FROM card_brands cb
             WHERE cb.public_id = ? AND cb.company_id = ? LIMIT 1`,
            [publicId, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Card brand not found');
        }

        return rows[0] as CardBrand;
    }

    static async listByCompany(companyId: number): Promise<CardBrand[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cb.* 
             FROM card_brands cb
             WHERE cb.company_id = ? 
             ORDER BY cb.created_at DESC`,
            [companyId]
        );

        return rows as CardBrand[];
    }

    static async update(publicId: string, companyId: number, data: UpdateCardBrandData): Promise<CardBrand> {
        const { name } = data;
        const updates: string[] = [];
        const values: any[] = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name.trim());
        }

        if (updates.length === 0) {
            return this.getByPublicId(publicId, companyId);
        }

        values.push(publicId, companyId);

        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE card_brands 
             SET ${updates.join(', ')} 
             WHERE public_id = ? AND company_id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            throw new Error('Card brand not found or nothing changed');
        }

        return this.getByPublicId(publicId, companyId);
    }

    static async delete(publicId: string, companyId: number): Promise<void> {
        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM card_brands WHERE public_id = ? AND company_id = ?`,
            [publicId, companyId]
        );

        if (result.affectedRows === 0) {
            throw new Error('Card brand not found');
        }
    }
}
