import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export class RoleRepository {
    static async ensureDefaultRoles(companyId: number): Promise<void> {
        const defaults = [
            { name: 'Administrador', slug: 'admin', description: 'Acesso administrativo completo' },
            { name: 'Usuário', slug: 'user', description: 'Perfil padrão de usuário' },
            { name: 'Operador', slug: 'operator', description: 'Operações do dia a dia' },
            { name: 'Financeiro', slug: 'financial', description: 'Acesso ao módulo financeiro' },
            { name: 'Vendedor', slug: 'seller', description: 'Acesso de vendas' },
            { name: 'Contato', slug: 'contact', description: 'Acesso ao cadastro de contatos' },
        ];

        for (const role of defaults) {
            await pool.query(
                `INSERT INTO roles (public_id, company_id, name, slug, description, is_active)
                 VALUES (UUID(), ?, ?, ?, ?, TRUE)
                 ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    description = VALUES(description),
                    is_active = TRUE,
                    updated_at = CURRENT_TIMESTAMP`,
                [companyId, role.name, role.slug, role.description]
            );
        }

        await pool.query(
            `INSERT INTO role_permissions (company_id, role, module, can_view)
             VALUES
                (?, 'contact', 'dashboard', 1),
                (?, 'contact', 'contacts', 1)
             ON DUPLICATE KEY UPDATE
                can_view = VALUES(can_view),
                updated_at = CURRENT_TIMESTAMP`,
            [companyId, companyId]
        );
    }

    static async getAllByCompany(companyId: number) {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT id, public_id, name, slug, description FROM roles WHERE company_id = ? AND is_active = TRUE ORDER BY name ASC',
            [companyId]
        );
        return rows;
    }

    static async getBySlug(companyId: number, slug: string) {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM roles WHERE company_id = ? AND slug = ? LIMIT 1',
            [companyId, slug]
        );
        return rows[0] || null;
    }

    static async create(companyId: number, data: { name: string; slug: string; description?: string }) {
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO roles (public_id, company_id, name, slug, description)
             VALUES (UUID(), ?, ?, ?, ?)`,
            [companyId, data.name, data.slug, data.description || '']
        );
        return result.insertId;
    }

    static async update(companyId: number, slug: string, data: { name: string; description?: string }) {
        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE roles SET name = ?, description = ? WHERE company_id = ? AND slug = ?`,
            [data.name, data.description || '', companyId, slug]
        );
        return result.affectedRows > 0;
    }

    static async delete(companyId: number, slug: string) {
        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE roles SET is_active = FALSE WHERE company_id = ? AND slug = ?`,
            [companyId, slug]
        );
        return result.affectedRows > 0;
    }
}