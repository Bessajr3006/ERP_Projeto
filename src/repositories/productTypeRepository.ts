import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { ProductType, CreateProductTypeData, UpdateProductTypeData } from '../types/ProductType';

export class ProductTypeRepository {
    static async list(companyId: number): Promise<ProductType[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM product_types WHERE company_id = ? ORDER BY name ASC',
            [companyId]
        );
        return rows as ProductType[];
    }

    static async getByPublicId(publicId: string, companyId: number): Promise<ProductType> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM product_types WHERE public_id = ? AND company_id = ? LIMIT 1',
            [publicId, companyId]
        );
        if (!rows || rows.length === 0) throw new Error('ProductType not found');
        return rows[0] as ProductType;
    }

    static async getByNameOrPosId(companyId: number, name: string, posId: string): Promise<ProductType | null> {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM product_types WHERE company_id = ? AND (name = ? OR (idprodutotipopos IS NOT NULL AND idprodutotipopos = ?)) LIMIT 1',
            [companyId, name, posId]
        );
        if (!rows || rows.length === 0) return null;
        return rows[0] as ProductType;
    }

    static async create(companyId: number, data: CreateProductTypeData): Promise<ProductType> {
        const publicId = randomUUID();
        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO product_types (public_id, company_id, name, description, idprodutotipopos) VALUES (?, ?, ?, ?, ?)',
            [publicId, companyId, data.name, data.description || null, data.idprodutotipopos || null]
        );
        if (result.affectedRows !== 1) throw new Error('Failed to create product type');
        return this.getByPublicId(publicId, companyId);
    }

    static async update(publicId: string, companyId: number, data: UpdateProductTypeData): Promise<ProductType> {
        const existing = await this.getByPublicId(publicId, companyId);
        const nameToSave = data.name || existing.name;
        const descriptionToSave = data.description !== undefined ? data.description : existing.description;
        const posIdToSave = data.idprodutotipopos !== undefined ? data.idprodutotipopos : existing.idprodutotipopos;

        await pool.query(
            'UPDATE product_types SET name = ?, description = ?, idprodutotipopos = ? WHERE public_id = ? AND company_id = ?',
            [nameToSave, descriptionToSave, posIdToSave, publicId, companyId]
        );
        return this.getByPublicId(publicId, companyId);
    }

    static async delete(publicId: string, companyId: number): Promise<void> {
        await this.getByPublicId(publicId, companyId);
        await pool.query('DELETE FROM product_types WHERE public_id = ? AND company_id = ?', [publicId, companyId]);
    }
}
