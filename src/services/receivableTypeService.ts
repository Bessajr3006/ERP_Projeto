import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { ReceivableType, CreateReceivableTypeData, UpdateReceivableTypeData } from '../types/ReceivableType';

export class ReceivableTypeService {
    static async create(companyId: number, data: CreateReceivableTypeData): Promise<ReceivableType> {
        const { name, bank_account_id } = data;
        const publicId = randomUUID();

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO receivable_types (public_id, company_id, name, bank_account_id)
             VALUES (?, ?, ?, ?)`,
            [publicId, companyId, name.trim(), bank_account_id]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Failed to create receivable type');
        }

        return this.getById(result.insertId, companyId);
    }

    static async getById(id: number, companyId: number): Promise<ReceivableType> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT rt.*, ba.name as bank_account_name 
             FROM receivable_types rt
             LEFT JOIN bank_accounts ba ON rt.bank_account_id = ba.id
             WHERE rt.id = ? AND rt.company_id = ? LIMIT 1`,
            [id, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Receivable type not found');
        }

        return rows[0] as ReceivableType;
    }

    static async getByPublicId(publicId: string, companyId: number): Promise<ReceivableType> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT rt.*, ba.name as bank_account_name 
             FROM receivable_types rt
             LEFT JOIN bank_accounts ba ON rt.bank_account_id = ba.id
             WHERE rt.public_id = ? AND rt.company_id = ? LIMIT 1`,
            [publicId, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Receivable type not found');
        }

        return rows[0] as ReceivableType;
    }

    static async listByCompany(companyId: number): Promise<ReceivableType[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT rt.*, ba.name as bank_account_name 
             FROM receivable_types rt
             LEFT JOIN bank_accounts ba ON rt.bank_account_id = ba.id
             WHERE rt.company_id = ? 
             ORDER BY rt.created_at DESC`,
            [companyId]
        );

        return rows as ReceivableType[];
    }

    static async update(publicId: string, companyId: number, data: UpdateReceivableTypeData): Promise<ReceivableType> {
        const { name, bank_account_id } = data;
        const updates: string[] = [];
        const values: any[] = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name.trim());
        }
        if (bank_account_id !== undefined) {
            updates.push('bank_account_id = ?');
            values.push(bank_account_id);
        }

        if (updates.length === 0) {
            return this.getByPublicId(publicId, companyId);
        }

        values.push(publicId, companyId);

        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE receivable_types 
             SET ${updates.join(', ')} 
             WHERE public_id = ? AND company_id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            throw new Error('Receivable type not found or nothing changed');
        }

        return this.getByPublicId(publicId, companyId);
    }

    static async delete(publicId: string, companyId: number): Promise<void> {
        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM receivable_types WHERE public_id = ? AND company_id = ?`,
            [publicId, companyId]
        );

        if (result.affectedRows === 0) {
            throw new Error('Receivable type not found');
        }
    }
}
