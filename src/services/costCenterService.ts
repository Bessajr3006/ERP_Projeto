import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { CostCenter, CreateCostCenterData, UpdateCostCenterData } from '../types/CostCenter';

export class CostCenterService {
    static async create(companyId: number, data: CreateCostCenterData): Promise<CostCenter> {
        const { name, description, is_active } = data;
        const publicId = randomUUID();
        const activeVal = is_active !== undefined ? (is_active ? 1 : 0) : 1;

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO cost_centers (public_id, company_id, name, description, is_active)
             VALUES (?, ?, ?, ?, ?)`,
            [publicId, companyId, name.trim(), description || null, activeVal]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Failed to create cost center');
        }

        return this.getById(result.insertId, companyId);
    }

    static async getById(id: number, companyId: number): Promise<CostCenter> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cc.* 
             FROM cost_centers cc
             WHERE cc.id = ? AND cc.company_id = ? LIMIT 1`,
            [id, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Cost center not found');
        }

        return rows[0] as CostCenter;
    }

    static async getByPublicId(publicId: string, companyId: number): Promise<CostCenter> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cc.* 
             FROM cost_centers cc
             WHERE cc.public_id = ? AND cc.company_id = ? LIMIT 1`,
            [publicId, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Cost center not found');
        }

        return rows[0] as CostCenter;
    }

    static async listByCompany(companyId: number): Promise<CostCenter[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cc.* 
             FROM cost_centers cc
             WHERE cc.company_id = ? 
             ORDER BY cc.created_at DESC`,
            [companyId]
        );

        return rows as CostCenter[];
    }

    static async update(publicId: string, companyId: number, data: UpdateCostCenterData): Promise<CostCenter> {
        const { name, description, is_active } = data;
        const updates: string[] = [];
        const values: any[] = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name.trim());
        }

        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description || null);
        }

        if (is_active !== undefined) {
            updates.push('is_active = ?');
            values.push(is_active ? 1 : 0);
        }

        if (updates.length === 0) {
            return this.getByPublicId(publicId, companyId);
        }

        values.push(publicId, companyId);

        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE cost_centers 
             SET ${updates.join(', ')} 
             WHERE public_id = ? AND company_id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            throw new Error('Cost center not found or nothing changed');
        }

        return this.getByPublicId(publicId, companyId);
    }

    static async delete(publicId: string, companyId: number): Promise<void> {
        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM cost_centers WHERE public_id = ? AND company_id = ?`,
            [publicId, companyId]
        );

        if (result.affectedRows === 0) {
            throw new Error('Cost center not found');
        }
    }
}
