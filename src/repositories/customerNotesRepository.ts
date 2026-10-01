import pool from '../config/db';
import { randomUUID } from 'crypto';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export class CustomerNotesRepository {
    static async create(companyId: number, customerPublicId: string, userPublicId: string | null, note: string): Promise<any> {
        const [custRows] = await pool.query<RowDataPacket[]>(
            `SELECT id, company_id FROM customers 
             WHERE public_id = ? 
               AND (company_id = ? OR company_id IN (SELECT id FROM companies WHERE is_general_admin = 1))
             LIMIT 1`,
            [customerPublicId, companyId]
        );
        if (!custRows || custRows.length === 0) {
            throw new Error('Customer not found');
        }
        const customer = custRows[0]!;
        
        let userId: number | null = null;
        if (userPublicId) {
            const [userRows] = await pool.query<RowDataPacket[]>(
                `SELECT id FROM users WHERE public_id = ? LIMIT 1`,
                [userPublicId]
            );
            if (userRows && userRows.length > 0) {
                userId = userRows[0]!.id;
            }
        }

        const publicId = randomUUID();
        await pool.query(
            `INSERT INTO customer_notes (public_id, company_id, customer_id, user_id, note)
             VALUES (?, ?, ?, ?, ?)`,
            [publicId, customer.company_id, customer.id, userId, note]
        );
        return this.getByPublicId(customer.company_id, publicId);
    }

    static async getByPublicId(_companyId: number, publicId: string): Promise<any> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cn.*, u.full_name as user_name 
             FROM customer_notes cn
             LEFT JOIN users u ON cn.user_id = u.id
             WHERE cn.public_id = ?`,
            [publicId]
        );
        if (!rows || rows.length === 0) return null;
        return rows[0];
    }

    static async list(companyId: number, customerPublicId: string): Promise<any[]> {
        const [custRows] = await pool.query<RowDataPacket[]>(
            `SELECT id, company_id FROM customers 
             WHERE public_id = ? 
               AND (company_id = ? OR company_id IN (SELECT id FROM companies WHERE is_general_admin = 1))
             LIMIT 1`,
            [customerPublicId, companyId]
        );
        if (!custRows || custRows.length === 0) {
            return [];
        }
        const customer = custRows[0]!;
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cn.*, u.full_name as user_name 
             FROM customer_notes cn
             LEFT JOIN users u ON cn.user_id = u.id
             WHERE cn.customer_id = ?
             ORDER BY cn.created_at DESC`,
            [customer.id]
        );
        return rows;
    }

    static async delete(companyId: number, publicId: string): Promise<boolean> {
        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM customer_notes 
             WHERE public_id = ? 
               AND (company_id = ? OR company_id IN (SELECT id FROM companies WHERE is_general_admin = 1))`,
            [publicId, companyId]
        );
        return result.affectedRows > 0;
    }
}
