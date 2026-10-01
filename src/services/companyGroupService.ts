import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { CompanyGroup, CreateCompanyGroupData, UpdateCompanyGroupData } from '../types/CompanyGroup';
import { Company } from '../types/Company';
import { DatabaseCompanySchema } from '../schemas/companySchemas';

export class CompanyGroupService {
    static async create(data: CreateCompanyGroupData): Promise<CompanyGroup> {
        const { name } = data;
        const publicId = randomUUID();

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO company_groups (public_id, name)
             VALUES (?, ?)`,
            [publicId, name.trim()]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Failed to create company group');
        }

        return this.getById(result.insertId);
    }

    static async getById(id: number): Promise<CompanyGroup> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cg.* 
             FROM company_groups cg
             WHERE cg.id = ? LIMIT 1`,
            [id]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Company group not found');
        }

        return rows[0] as CompanyGroup;
    }

    static async getByPublicId(publicId: string): Promise<CompanyGroup> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cg.* 
             FROM company_groups cg
             WHERE cg.public_id = ? LIMIT 1`,
            [publicId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Company group not found');
        }

        return rows[0] as CompanyGroup;
    }

    static async list(): Promise<CompanyGroup[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cg.* 
             FROM company_groups cg
             ORDER BY cg.name ASC`
        );

        return rows as CompanyGroup[];
    }

    static async update(publicId: string, data: UpdateCompanyGroupData): Promise<CompanyGroup> {
        const { name } = data;
        const updates: string[] = [];
        const values: any[] = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name.trim());
        }

        if (updates.length === 0) {
            return this.getByPublicId(publicId);
        }

        values.push(publicId);

        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE company_groups 
             SET ${updates.join(', ')} 
             WHERE public_id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            throw new Error('Company group not found or nothing changed');
        }

        return this.getByPublicId(publicId);
    }

    static async delete(publicId: string): Promise<void> {
        const group = await this.getByPublicId(publicId);
        
        // Remove foreign key references from companies first (MySQL FOREIGN KEY ON DELETE SET NULL should handle this automatically, but doing it explicitly is safer)
        await pool.query(
            `UPDATE companies SET company_group_id = NULL, is_group_master = 0 WHERE company_group_id = ?`,
            [group.id]
        );

        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM company_groups WHERE id = ?`,
            [group.id]
        );

        if (result.affectedRows === 0) {
            throw new Error('Company group not found');
        }
    }

    static async listCompaniesInGroup(groupPublicId: string): Promise<Company[]> {
        const group = await this.getByPublicId(groupPublicId);

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT c.*, 
                    cgp.public_id AS company_group_public_id, cgp.name AS company_group_name
             FROM companies c
             LEFT JOIN company_groups cgp ON cgp.id = c.company_group_id
             WHERE c.company_group_id = ? AND c.is_system = FALSE
             ORDER BY c.trade_name ASC`,
            [group.id]
        );

        return rows.map(r => DatabaseCompanySchema.parse(r)) as Company[];
    }

    static async linkCompanyToGroup(companyPublicId: string, groupPublicId: string | null, isGroupMaster?: boolean): Promise<void> {
        let groupId: number | null = null;

        if (groupPublicId) {
            const group = await this.getByPublicId(groupPublicId);
            groupId = group.id;
        }

        const updates: string[] = ['company_group_id = ?'];
        const values: any[] = [groupId];

        if (groupId === null) {
            updates.push('is_group_master = 0');
        } else if (isGroupMaster !== undefined) {
            updates.push('is_group_master = ?');
            values.push(isGroupMaster ? 1 : 0);
        }

        values.push(companyPublicId);

        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE companies 
             SET ${updates.join(', ')} 
             WHERE public_id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            throw new Error('Company not found');
        }
    }
}
