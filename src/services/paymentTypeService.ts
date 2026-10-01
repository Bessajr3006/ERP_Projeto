import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { PaymentType, CreatePaymentTypeData, UpdatePaymentTypeData } from '../types/PaymentType';

export class PaymentTypeService {
    static async create(companyId: number, data: CreatePaymentTypeData): Promise<PaymentType> {
        const { name, bank_account_id } = data;
        const publicId = randomUUID();

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO payment_types (public_id, company_id, name, bank_account_id)
             VALUES (?, ?, ?, ?)`,
            [publicId, companyId, name.trim(), bank_account_id]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Failed to create payment type');
        }

        return this.getById(result.insertId, companyId);
    }

    static async getById(id: number, companyId: number): Promise<PaymentType> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT pt.*, ba.name as bank_account_name 
             FROM payment_types pt
             LEFT JOIN bank_accounts ba ON pt.bank_account_id = ba.id
             WHERE pt.id = ? AND pt.company_id = ? LIMIT 1`,
            [id, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Payment type not found');
        }

        return rows[0] as PaymentType;
    }

    static async getByPublicId(publicId: string, companyId: number): Promise<PaymentType> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT pt.*, ba.name as bank_account_name 
             FROM payment_types pt
             LEFT JOIN bank_accounts ba ON pt.bank_account_id = ba.id
             WHERE pt.public_id = ? AND pt.company_id = ? LIMIT 1`,
            [publicId, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Payment type not found');
        }

        return rows[0] as PaymentType;
    }

    static async listByCompany(companyId: number): Promise<PaymentType[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT pt.*, ba.name as bank_account_name 
             FROM payment_types pt
             LEFT JOIN bank_accounts ba ON pt.bank_account_id = ba.id
             WHERE pt.company_id = ? 
             ORDER BY pt.created_at DESC`,
            [companyId]
        );

        return rows as PaymentType[];
    }

    static async update(publicId: string, companyId: number, data: UpdatePaymentTypeData): Promise<PaymentType> {
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
            `UPDATE payment_types 
             SET ${updates.join(', ')} 
             WHERE public_id = ? AND company_id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            throw new Error('Payment type not found or nothing changed');
        }

        return this.getByPublicId(publicId, companyId);
    }

    static async delete(publicId: string, companyId: number): Promise<void> {
        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM payment_types WHERE public_id = ? AND company_id = ?`,
            [publicId, companyId]
        );

        if (result.affectedRows === 0) {
            throw new Error('Payment type not found');
        }
    }
}
