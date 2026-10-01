import pool from '../config/db';
import { randomUUID } from 'crypto';
import { EntityRepository } from './entityRepository';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export class ContactNotesRepository {
    static async create(companyId: number, contactPublicId: string, userPublicId: string | null, note: string): Promise<any> {
        const contact = await EntityRepository.getByPublicId('contacts', contactPublicId, companyId);
        
        let userId: number | null = null;
        if (userPublicId) {
            const [userRows] = await pool.query<RowDataPacket[]>(
                `SELECT id FROM users WHERE company_id = ? AND public_id = ? LIMIT 1`,
                [companyId, userPublicId]
            );
            if (userRows && userRows.length > 0) {
                userId = userRows[0]!.id;
            }
        }

        const publicId = randomUUID();
        await pool.query(
            `INSERT INTO contact_notes (public_id, company_id, contact_id, user_id, note)
             VALUES (?, ?, ?, ?, ?)`,
            [publicId, companyId, contact.id, userId, note]
        );
        return this.getByPublicId(companyId, publicId);
    }

    static async getByPublicId(companyId: number, publicId: string): Promise<any> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cn.*, u.full_name as user_name 
             FROM contact_notes cn
             LEFT JOIN users u ON cn.user_id = u.id
             WHERE cn.company_id = ? AND cn.public_id = ?`,
            [companyId, publicId]
        );
        if (!rows || rows.length === 0) return null;
        return rows[0];
    }

    static async list(companyId: number, contactPublicId: string): Promise<any[]> {
        const contact = await EntityRepository.getByPublicId('contacts', contactPublicId, companyId);
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cn.*, u.full_name as user_name 
             FROM contact_notes cn
             LEFT JOIN users u ON cn.user_id = u.id
             WHERE cn.company_id = ? AND cn.contact_id = ?
             ORDER BY cn.created_at DESC`,
            [companyId, contact.id]
        );
        return rows;
    }

    static async delete(companyId: number, publicId: string): Promise<boolean> {
        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM contact_notes WHERE company_id = ? AND public_id = ?`,
            [companyId, publicId]
        );
        return result.affectedRows > 0;
    }
}
