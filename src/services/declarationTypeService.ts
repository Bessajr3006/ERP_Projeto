import pool from '../config/db';
import { RowDataPacket } from 'mysql2/promise';
import crypto from 'crypto';
import { z } from 'zod';

export const declarationTypeSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório').max(100),
    description: z.string().max(255).optional().nullable(),
    frequency: z.enum(['MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL']),
    due_day: z.number().int().min(1).max(31).optional().nullable(),
    tax_regime: z.string().max(50).optional().nullable(),
    active: z.boolean().default(true)
});

export type DeclarationTypeData = z.infer<typeof declarationTypeSchema>;

export class DeclarationTypeService {
    static async getAll(companyId: number, includeInactive: boolean = false) {
        const query = includeInactive 
            ? `SELECT * FROM declaration_types WHERE company_id = ? ORDER BY name ASC`
            : `SELECT * FROM declaration_types WHERE company_id = ? AND active = 1 ORDER BY name ASC`;
        const [rows] = await pool.query<RowDataPacket[]>(query, [companyId]);
        return rows;
    }

    static async getByPublicId(companyId: number, publicId: string) {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT * FROM declaration_types WHERE company_id = ? AND public_id = ?`,
            [companyId, publicId]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    static async create(companyId: number, data: DeclarationTypeData) {
        const publicId = crypto.randomUUID();
        await pool.query(
            `INSERT INTO declaration_types (company_id, public_id, name, description, frequency, due_day, tax_regime, active) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [companyId, publicId, data.name, data.description || null, data.frequency, data.due_day || null, data.tax_regime || null, data.active ? 1 : 0]
        );
        return await this.getByPublicId(companyId, publicId);
    }

    static async update(companyId: number, publicId: string, data: DeclarationTypeData) {
        const current = await this.getByPublicId(companyId, publicId);
        if (!current) throw new Error('Tipo de declaração não encontrado');

        await pool.query(
            `UPDATE declaration_types 
             SET name = ?, description = ?, frequency = ?, due_day = ?, tax_regime = ?, active = ?
             WHERE id = ?`,
            [data.name, data.description || null, data.frequency, data.due_day || null, data.tax_regime || null, data.active ? 1 : 0, current.id]
        );
        return await this.getByPublicId(companyId, publicId);
    }

    static async delete(companyId: number, publicId: string) {
        const current = await this.getByPublicId(companyId, publicId);
        if (!current) throw new Error('Tipo de declaração não encontrado');

        // Em vez de deletar fisicamente, inativamos para não quebrar referências caso seja usado em outras tabelas
        await pool.query(`UPDATE declaration_types SET active = 0 WHERE id = ?`, [current.id]);
        return true;
    }
}
