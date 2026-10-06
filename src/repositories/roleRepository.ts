import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export class RoleRepository {
    static async ensureDefaultRoles(companyId: number): Promise<void> {
        const defaults = [
            { name: 'Administrador', slug: 'admin', description: 'Acesso administrativo completo' },
            { name: 'Administrador Básico', slug: 'admin_basic', description: 'Acesso administrativo básico (editável)' },
            { name: 'Usuário', slug: 'user', description: 'Perfil padrão de usuário' },
            { name: 'Operador', slug: 'operator', description: 'Operações do dia a dia' },
            { name: 'Financeiro', slug: 'financial', description: 'Acesso ao módulo financeiro' },
            { name: 'Vendedor', slug: 'seller', description: 'Acesso de vendas' },
            { name: 'Contato', slug: 'contact', description: 'Acesso ao cadastro de contatos' },
            { name: 'Supervisor Completo', slug: 'supervisor', description: 'Acesso completo de supervisão' },
            { name: 'Operador de Pix', slug: 'pix_operator', description: 'Geração e controle de cobranças PIX' },
            { name: 'Solidcon', slug: 'solidcon', description: 'Perfil Solidcon' },
            { name: 'Auxiliar-Contador', slug: 'auxiliar_contador', description: 'Perfil de auxiliar de contador' },
            { name: 'Sócio', slug: 'socio', description: 'Perfil de sócio / dono da empresa' },
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

        const ALL_MODULES = [
            'dashboard', 'sales', 'restaurant', 'picking', 'categories', 'products',
            'catalog', 'measures', 'purchases', 'notas_compras', 'manufacturers',
            'nota', 'quotes', 'audit', 'expenses', 'card_debits', 'card_expenses',
            'card_brands', 'card_configurations', 'payment_types', 'revenues',
            'finance_categories', 'finance_category_types', 'banks', 'statements',
            'suppliers', 'buyers', 'service_providers', 'service_launches',
            'service_types', 'prices', 'customers', 'contacts', 'customer_activities',
            'activity_groups', 'customer_groups', 'sellers', 'employees', 'company',
            'accountant', 'socio', 'users', 'accounting', 'accounting_entries',
            'accounting_auto_entries', 'accounting_auto_history', 'accounting_closing',
            'declaration_registration', 'declaration_control', 'fechamento',
            'sped_fiscal', 'sped_fiscal_vision', 'dre', 'balanco', 'balancete',
            'roles', 'tasks', 'organizer', 'ajuste', 'whatsapp', 'email',
            'receivable_types', 'swagger', 'census-vision', 'mec-vision',
            'rel_rafael', 'rel_pedido_dorsal', 'rel_saldo_banco', 'cost_centers', 'gera-pix', 'fin_solidcon_vision', 'rel_valor_empresa'
        ] as const;

        const DEFAULT_ROLE_MODULES: Record<string, readonly string[]> = {
            admin: ALL_MODULES,
            super_admin: ALL_MODULES,
            supervisor: ALL_MODULES,
            admin_basic: ALL_MODULES,
            operator: ['dashboard', 'sales', 'restaurant', 'picking', 'nota', 'census-vision', 'mec-vision'],
            financial: [
                'dashboard', 'finance_vision', 'fin_solidcon_vision', 'rel_valor_empresa', 'expenses', 'card_debits', 'card_expenses',
                'card_brands', 'card_configurations', 'payment_types', 'revenues',
                'finance_categories', 'finance_category_types', 'banks', 'statements',
                'purchases', 'notas_compras', 'accountant', 'socio', 'receivable_types',
                'fechamento', 'sped_fiscal', 'sped_fiscal_vision', 'census-vision', 'mec-vision', 'rel_rafael', 'rel_saldo_banco', 'cost_centers'
            ],
            seller: [
                'dashboard', 'sales', 'customers', 'contacts', 'sellers',
                'customer_groups', 'employees', 'census-vision', 'mec-vision'
            ],
            contact: ['dashboard', 'contacts'],
            accountant: ['dashboard', 'company', 'accountant', 'accounting', 'accounting_entries', 'accounting_closing', 'fechamento', 'sped_fiscal', 'sped_fiscal_vision', 'dre', 'balanco', 'balancete', 'census-vision', 'mec-vision', 'fin_solidcon_vision', 'rel_valor_empresa'],
            socio: ['dashboard', 'company', 'socio', 'census-vision', 'mec-vision'],
            buyer: ['dashboard', 'purchases', 'notas_compras', 'suppliers', 'buyers', 'census-vision', 'mec-vision'],
            service_provider: ['dashboard', 'service_providers', 'census-vision', 'mec-vision'],
            user: ['dashboard', 'census-vision', 'mec-vision'],
            pix_operator: ['dashboard', 'gera-pix'],
            solidcon: ['dashboard', 'rel_rafael', 'fin_solidcon_vision', 'rel_valor_empresa'],
            auxiliar_contador: ['dashboard', 'company', 'accounting', 'accounting_entries', 'accounting_closing', 'fechamento', 'sped_fiscal', 'sped_fiscal_vision', 'dre', 'balanco', 'balancete', 'census-vision', 'mec-vision', 'fin_solidcon_vision', 'rel_valor_empresa'],
        };

        for (const [roleSlug, modules] of Object.entries(DEFAULT_ROLE_MODULES)) {
            for (const mod of modules) {
                await pool.query(
                    `INSERT INTO role_permissions (company_id, role, module, can_view)
                     VALUES (?, ?, ?, TRUE)
                     ON DUPLICATE KEY UPDATE can_view = TRUE`,
                    [companyId, roleSlug, mod]
                );
            }
        }
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