import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { CustomerGroup, CreateCustomerGroupData, UpdateCustomerGroupData } from '../types/CustomerGroup';

export class CustomerGroupService {
    static async create(companyId: number, data: CreateCustomerGroupData): Promise<CustomerGroup> {
        const { name } = data;
        const publicId = randomUUID();

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO customer_groups (public_id, company_id, name)
             VALUES (?, ?, ?)`,
            [publicId, companyId, name.trim()]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Failed to create customer group');
        }

        return this.getById(result.insertId, companyId);
    }

    static async getById(id: number, companyId: number): Promise<CustomerGroup> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cg.* 
             FROM customer_groups cg
             WHERE cg.id = ? AND cg.company_id = ? LIMIT 1`,
            [id, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Customer group not found');
        }

        return rows[0] as CustomerGroup;
    }

    static async getByPublicId(publicId: string, companyId: number): Promise<CustomerGroup> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cg.* 
             FROM customer_groups cg
             WHERE cg.public_id = ? AND cg.company_id = ? LIMIT 1`,
            [publicId, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Customer group not found');
        }

        return rows[0] as CustomerGroup;
    }

    static async listByCompany(companyId: number | number[]): Promise<CustomerGroup[]> {
        let rows: RowDataPacket[];
        if (Array.isArray(companyId)) {
            if (companyId.length === 0) return [];
            [rows] = await pool.query<RowDataPacket[]>(
                `SELECT cg.* 
                 FROM customer_groups cg
                 WHERE cg.company_id IN (${companyId.map(() => '?').join(',')})
                 ORDER BY cg.name ASC, cg.created_at DESC`,
                companyId
            );
        } else {
            [rows] = await pool.query<RowDataPacket[]>(
                `SELECT cg.* 
                 FROM customer_groups cg
                 WHERE cg.company_id = ? 
                 ORDER BY cg.name ASC, cg.created_at DESC`,
                [companyId]
            );
        }

        // Deduplicate groups by normalized name
        const seen = new Set<string>();
        const uniqueGroups: CustomerGroup[] = [];
        for (const g of (rows as CustomerGroup[])) {
            const norm = (g.name || '').toLowerCase().trim();
            if (norm && !seen.has(norm)) {
                seen.add(norm);
                uniqueGroups.push(g);
            }
        }

        return uniqueGroups;
    }

    static async update(publicId: string, companyId: number, data: UpdateCustomerGroupData): Promise<CustomerGroup> {
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
            `UPDATE customer_groups 
             SET ${updates.join(', ')} 
             WHERE public_id = ? AND company_id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            throw new Error('Customer group not found or nothing changed');
        }

        return this.getByPublicId(publicId, companyId);
    }

    static async delete(publicId: string, companyId: number): Promise<void> {
        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM customer_groups WHERE public_id = ? AND company_id = ?`,
            [publicId, companyId]
        );

        if (result.affectedRows === 0) {
            throw new Error('Customer group not found');
        }
    }
}
