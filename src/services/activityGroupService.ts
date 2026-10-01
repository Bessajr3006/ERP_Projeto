import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { ActivityGroup, CreateActivityGroupData, UpdateActivityGroupData } from '../types/ActivityGroup';

export class ActivityGroupService {
    static async create(companyId: number, data: CreateActivityGroupData): Promise<ActivityGroup> {
        const { name, monthly_fee, due_day, operation_cost } = data;
        const publicId = randomUUID();

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO activity_groups (public_id, company_id, name, monthly_fee, due_day, operation_cost)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                publicId,
                companyId,
                name.trim(),
                monthly_fee !== undefined ? monthly_fee : null,
                due_day !== undefined ? due_day : null,
                operation_cost !== undefined ? operation_cost : null
            ]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Failed to create activity group');
        }

        return this.getById(result.insertId, companyId);
    }

    static async getById(id: number, companyId: number): Promise<ActivityGroup> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT ag.* 
             FROM activity_groups ag
             WHERE ag.id = ? AND ag.company_id = ? LIMIT 1`,
            [id, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Activity group not found');
        }

        return rows[0] as ActivityGroup;
    }

    static async getByPublicId(publicId: string, companyId: number): Promise<ActivityGroup> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT ag.* 
             FROM activity_groups ag
             WHERE ag.public_id = ? AND ag.company_id = ? LIMIT 1`,
            [publicId, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Activity group not found');
        }

        return rows[0] as ActivityGroup;
    }

    static async listByCompany(companyId: number): Promise<ActivityGroup[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT ag.* 
             FROM activity_groups ag
             WHERE ag.company_id = ? 
             ORDER BY ag.created_at DESC`,
            [companyId]
        );

        return rows as ActivityGroup[];
    }

    static async update(publicId: string, companyId: number, data: UpdateActivityGroupData): Promise<ActivityGroup> {
        const { name, monthly_fee, due_day, operation_cost } = data;
        const updates: string[] = [];
        const values: any[] = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name.trim());
        }

        if (monthly_fee !== undefined) {
            updates.push('monthly_fee = ?');
            values.push(monthly_fee);
        }

        if (due_day !== undefined) {
            updates.push('due_day = ?');
            values.push(due_day);
        }

        if (operation_cost !== undefined) {
            updates.push('operation_cost = ?');
            values.push(operation_cost);
        }

        if (updates.length === 0) {
            return this.getByPublicId(publicId, companyId);
        }

        values.push(publicId, companyId);

        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE activity_groups 
             SET ${updates.join(', ')} 
             WHERE public_id = ? AND company_id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            throw new Error('Activity group not found or nothing changed');
        }

        return this.getByPublicId(publicId, companyId);
    }

    static async delete(publicId: string, companyId: number): Promise<void> {
        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM activity_groups WHERE public_id = ? AND company_id = ?`,
            [publicId, companyId]
        );

        if (result.affectedRows === 0) {
            throw new Error('Activity group not found');
        }
    }
}
