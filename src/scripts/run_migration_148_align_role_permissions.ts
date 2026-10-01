import pool from '../config/db';
import logger from '../config/logger';

async function tableExists(tableName: string): Promise<boolean> {
    const [rows] = await pool.query<any[]>(
        `SELECT COUNT(*) AS count
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?`,
        [tableName]
    );
    return Array.isArray(rows) && rows[0] && Number(rows[0].count) > 0;
}

const ALL_MAPPED_MODULES = [
    'sales',
    'quotes',
    'service_launches',
    'restaurant',
    'dashboard',
    'finance_vision',
    'stock_vision',
    'whatsapp-info',
    'census-vision',
    'mec-vision',
    'income-vision',
    'picking',
    'nota',
    'notas_vendidas',
    'products',
    'categories',
    'stock_types',
    'manufacturers',
    'taxes',
    'prices',
    'measures',
    'service_types',
    'services',
    'service_tax_municipal',
    'service_tax_federal',
    'purchases',
    'notas_compras',
    'manifestation',
    'expenses',
    'card_debits',
    'card_expenses',
    'card_brands',
    'card_configurations',
    'payment_types',
    'revenues',
    'finance_category_types',
    'finance_categories',
    'banks',
    'statements',
    'customers',
    'customer_groups',
    'contacts',
    'sellers',
    'buyers',
    'service_providers',
    'suppliers',
    'employees',
    'company',
    'accountant',
    'users',
    'accounting',
    'accounting_entries',
    'accounting_auto_entries',
    'accounting_auto_history',
    'declaration_registration',
    'declaration_control',
    'fechamento',
    'dre',
    'balanco',
    'balancete',
    'roles',
    'tasks',
    'organizer',
    'ajuste',
    'whatsapp',
    'email',
    'backup_restore',
    'swagger'
];

const ROLE_PERMISSIONS_MAPPING: Record<string, string[]> = {
    super_admin: ALL_MAPPED_MODULES,
    admin: ALL_MAPPED_MODULES,
    admin_basic: ALL_MAPPED_MODULES,
    supervisor: ALL_MAPPED_MODULES,
    financial: [
        'dashboard', 'finance_vision', 'expenses', 'card_debits', 'card_expenses', 
        'card_brands', 'card_configurations', 'payment_types', 'revenues', 
        'finance_category_types', 'finance_categories', 'banks', 'statements', 
        'purchases', 'notas_compras', 'accountant', 'receivable_types', 
        'fechamento', 'census-vision', 'mec-vision'
    ],
    seller: [
        'dashboard', 'sales', 'customers', 'contacts', 'sellers', 
        'customer_groups', 'employees', 'census-vision', 'mec-vision'
    ],
    operator: [
        'dashboard', 'sales', 'restaurant', 'picking', 'nota', 
        'census-vision', 'mec-vision'
    ],
    accountant: [
        'dashboard', 'company', 'accountant', 'fechamento', 
        'census-vision', 'mec-vision'
    ],
    buyer: [
        'dashboard', 'purchases', 'notas_compras', 'suppliers', 'buyers', 
        'census-vision', 'mec-vision'
    ],
    service_provider: [
        'dashboard', 'service_providers', 'census-vision', 'mec-vision'
    ],
    user: [
        'dashboard', 'census-vision', 'mec-vision'
    ]
};

async function alignRolePermissions(): Promise<void> {
    logger.info('Aligning system role permissions...');
    
    for (const [role, modules] of Object.entries(ROLE_PERMISSIONS_MAPPING)) {
        for (const moduleName of modules) {
            await pool.query(`
                INSERT INTO role_permissions (company_id, role, module, can_view)
                SELECT c.id, ?, ?, 1
                FROM companies c
                ON DUPLICATE KEY UPDATE can_view = 1
            `, [role, moduleName]);
        }
    }
    
    logger.info('System role permissions aligned successfully.');
}

async function migrationAlreadyExecuted(version: number): Promise<boolean> {
    try {
        if (!(await tableExists('schema_migrations'))) {
            return false;
        }
        const [rows] = await pool.query<any[]>(
            'SELECT COUNT(*) AS count FROM schema_migrations WHERE version = ?',
            [version]
        );
        return Array.isArray(rows) && rows[0] && Number(rows[0].count) > 0;
    } catch (err) {
        return false;
    }
}

export async function runMigration148AlignRolePermissions() {
    let conn;
    try {
        conn = await pool.getConnection();
        
        const alreadyRun = await migrationAlreadyExecuted(148);
        if (alreadyRun) {
            logger.info('Migration 148 already executed. Skipping.');
            return;
        }

        logger.info('Running migration: run_migration_148_align_role_permissions');

        if (!(await tableExists('role_permissions'))) {
            logger.warn('Table role_permissions not found. Skipping migration 148.');
            return;
        }

        await alignRolePermissions();

        await pool.query(
            'INSERT INTO schema_migrations (version, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE version=version',
            [148, 'run_migration_148_align_role_permissions']
        );

        logger.info('Migration run_migration_148_align_role_permissions finished successfully!');
    } catch (err) {
        logger.error({ err }, 'Failed to run migration: run_migration_148_align_role_permissions');
    } finally {
        conn?.release();
    }
}
