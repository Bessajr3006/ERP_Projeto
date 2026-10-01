import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { CardConfiguration, CreateCardConfigurationData, UpdateCardConfigurationData } from '../types/CardConfiguration';

export class CardConfigurationService {
    static async create(companyId: number, data: CreateCardConfigurationData): Promise<CardConfiguration> {
        const { receivable_type_id, card_brand_id, payment_type, tax_rate, due_days, service_fee } = data;
        const publicId = randomUUID();

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO card_configurations (public_id, company_id, receivable_type_id, card_brand_id, payment_type, tax_rate, due_days, service_fee)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [publicId, companyId, receivable_type_id, card_brand_id || null, payment_type.trim(), tax_rate, due_days, service_fee]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Failed to create card configuration');
        }

        return this.getById(result.insertId, companyId);
    }

    static async getById(id: number, companyId: number): Promise<CardConfiguration> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cc.*, rt.name as receivable_type_name, cb.name as card_brand_name, cb.public_id as card_brand_public_id 
             FROM card_configurations cc
             LEFT JOIN receivable_types rt ON cc.receivable_type_id = rt.id
             LEFT JOIN card_brands cb ON cc.card_brand_id = cb.id
             WHERE cc.id = ? AND cc.company_id = ? LIMIT 1`,
            [id, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Card configuration not found');
        }

        return rows[0] as CardConfiguration;
    }

    static async getByPublicId(publicId: string, companyId: number): Promise<CardConfiguration> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cc.*, rt.name as receivable_type_name, cb.name as card_brand_name, cb.public_id as card_brand_public_id 
             FROM card_configurations cc
             LEFT JOIN receivable_types rt ON cc.receivable_type_id = rt.id
             LEFT JOIN card_brands cb ON cc.card_brand_id = cb.id
             WHERE cc.public_id = ? AND cc.company_id = ? LIMIT 1`,
            [publicId, companyId]
        );

        if (!rows || rows.length === 0) {
            throw new Error('Card configuration not found');
        }

        return rows[0] as CardConfiguration;
    }

    static async listByCompany(companyId: number): Promise<CardConfiguration[]> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT cc.*, rt.name as receivable_type_name, cb.name as card_brand_name, cb.public_id as card_brand_public_id 
             FROM card_configurations cc
             LEFT JOIN receivable_types rt ON cc.receivable_type_id = rt.id
             LEFT JOIN card_brands cb ON cc.card_brand_id = cb.id
             WHERE cc.company_id = ? 
             ORDER BY cc.created_at DESC`,
            [companyId]
        );

        return rows as CardConfiguration[];
    }

    static async update(publicId: string, companyId: number, data: UpdateCardConfigurationData): Promise<CardConfiguration> {
        const { receivable_type_id, card_brand_id, payment_type, tax_rate, due_days, service_fee } = data;
        const updates: string[] = [];
        const values: any[] = [];

        if (receivable_type_id !== undefined) {
            updates.push('receivable_type_id = ?');
            values.push(receivable_type_id);
        }
        if (card_brand_id !== undefined) {
            updates.push('card_brand_id = ?');
            values.push(card_brand_id || null);
        }
        if (payment_type !== undefined) {
            updates.push('payment_type = ?');
            values.push(payment_type.trim());
        }
        if (tax_rate !== undefined) {
            updates.push('tax_rate = ?');
            values.push(tax_rate);
        }
        if (due_days !== undefined) {
            updates.push('due_days = ?');
            values.push(due_days);
        }
        if (service_fee !== undefined) {
            updates.push('service_fee = ?');
            values.push(service_fee);
        }

        if (updates.length === 0) {
            return this.getByPublicId(publicId, companyId);
        }

        values.push(publicId, companyId);

        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE card_configurations 
             SET ${updates.join(', ')} 
             WHERE public_id = ? AND company_id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            throw new Error('Card configuration not found or nothing changed');
        }

        return this.getByPublicId(publicId, companyId);
    }

    static async delete(publicId: string, companyId: number): Promise<void> {
        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM card_configurations WHERE public_id = ? AND company_id = ?`,
            [publicId, companyId]
        );

        if (result.affectedRows === 0) {
            throw new Error('Card configuration not found');
        }
    }
}
