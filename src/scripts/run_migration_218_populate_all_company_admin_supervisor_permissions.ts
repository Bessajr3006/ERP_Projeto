import pool from '../config/db';
import logger from '../config/logger';

const ALL_MODULES = [
    'dashboard', 'sales', 'restaurant', 'picking', 'categories', 'products',
    'catalog', 'measures', 'purchases', 'notas_compras', 'manufacturers',
    'nota', 'quotes', 'audit', 'expenses', 'card_debits', 'card_expenses',
    'card_brands', 'card_configurations', 'payment_types', 'revenues',
    'finance_categories', 'finance_category_types', 'banks', 'statements',
    'suppliers', 'buyers', 'service_providers', 'service_launches',
    'service_types', 'prices', 'customers', 'contacts', 'customer_activities',
    'activity_groups', 'customer_groups', 'sellers', 'employees', 'company',
    'accountant', 'users', 'accounting', 'accounting_entries',
    'accounting_auto_entries', 'accounting_auto_history',
    'declaration_registration', 'declaration_control', 'fechamento',
    'sped_fiscal', 'sped_fiscal_vision', 'dre', 'balanco', 'balancete',
    'roles', 'tasks', 'organizer', 'ajuste', 'whatsapp', 'email',
    'email-config', 'whatsapp-info', 'whatsapp_sessions',
    'receivable_types', 'swagger', 'census-vision', 'mec-vision',
    'income-vision', 'rel_rafael', 'cost_centers', 'gera-pix', 'backup_restore'
] as const;

const DEFAULT_ROLES = [
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
];

const DEFAULT_ROLE_MODULES: Record<string, readonly string[]> = {
    admin: ALL_MODULES,
    super_admin: ALL_MODULES,
    supervisor: ALL_MODULES,
    admin_basic: ALL_MODULES,
    operator: ['dashboard', 'sales', 'restaurant', 'picking', 'nota', 'census-vision', 'mec-vision'],
    financial: [
        'dashboard', 'finance_vision', 'expenses', 'card_debits', 'card_expenses',
        'card_brands', 'card_configurations', 'payment_types', 'revenues',
        'finance_categories', 'finance_category_types', 'banks', 'statements',
        'purchases', 'notas_compras', 'accountant', 'receivable_types',
        'fechamento', 'sped_fiscal', 'sped_fiscal_vision', 'census-vision', 'mec-vision', 'rel_rafael', 'cost_centers'
    ],
    seller: [
        'dashboard', 'sales', 'customers', 'contacts', 'sellers',
        'customer_groups', 'employees', 'census-vision', 'mec-vision'
    ],
    contact: ['dashboard', 'contacts'],
    accountant: ['dashboard', 'company', 'accountant', 'fechamento', 'sped_fiscal', 'sped_fiscal_vision', 'census-vision', 'mec-vision'],
    buyer: ['dashboard', 'purchases', 'notas_compras', 'suppliers', 'buyers', 'census-vision', 'mec-vision'],
    service_provider: ['dashboard', 'service_providers', 'census-vision', 'mec-vision'],
    user: ['dashboard', 'census-vision', 'mec-vision'],
    pix_operator: ['dashboard', 'gera-pix'],
    solidcon: ['dashboard', 'rel_rafael'],
    auxiliar_contador: ['dashboard', 'company', 'fechamento', 'sped_fiscal', 'sped_fiscal_vision', 'census-vision', 'mec-vision'],
};

async function run() {
    logger.info('Iniciando migration 218: Alinhamento de permissões de Administrador e Supervisor em todas as empresas...');

    const [companies] = await pool.query<any[]>('SELECT id, trade_name, company_name FROM companies');
    logger.info(`Total de empresas encontradas: ${companies.length}`);

    for (const company of companies) {
        const companyId = company.id;
        const name = company.trade_name || company.company_name || `Empresa ${companyId}`;

        // 1. Inserir ou atualizar papéis padrão
        for (const role of DEFAULT_ROLES) {
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

        // 2. Garantir permissões de todos os módulos para admin, supervisor, super_admin e admin_basic
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

        logger.info(`Empresa ID ${companyId} (${name}) atualizada com sucesso.`);
    }

    logger.info('Migration 218 concluída com sucesso!');
    process.exit(0);
}

run().catch((err) => {
    logger.error({ err }, 'Erro ao executar migration 218');
    console.error(err);
    process.exit(1);
});
