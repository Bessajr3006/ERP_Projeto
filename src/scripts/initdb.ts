import 'dotenv/config';
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import mysql, { ConnectionOptions, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../config/db';
import { runMigration18 } from './run_migration_18';
import { runMigration19 } from './run_migration_19';
import { runMigration21 } from './run_migration_21';
import { runMigration22 } from './run_migration_22';
import { runMigration23 } from './run_migration_23';
import { runMigration24 } from './run_migration_24';
import { runMigration25 } from './run_migration_25';
import { runMigration26 } from './run_migration_26';
import { runMigration27 } from './run_migration_27';
import { runMigration28 } from './run_migration_28';
import { runMigration29 } from './run_migration_29';
import { runMigration30 } from './run_migration_30';
import { runMigration31 } from './run_migration_31';
import { runMigration32 } from './run_migration_32';
import { runMigration33 } from './run_migration_33';
import { runMigration34 } from './run_migration_34';
import { runMigration35 } from './run_migration_35';
import { runMigration36 } from './run_migration_36';
import { runMigration37 } from './run_migration_37';
import { runMigration37 as runMigration37WhatsappMedia } from './run_migration_37_whatsapp_media_url';
import { runMigration38 as runMigration38Base64 } from './run_migration_38_base64_extract';
import { runMigration38 as runMigration38Nfe } from './run_migration_38_nfe_nfce';
import { runMigration39 } from './run_migration_39_whatsapp_queue';
import { runMigration40 } from './run_migration_40_nfe_emitted_at';
import runMigration41 from './run_migration_41_chart_of_accounts';
import runMigration42 from './run_migration_42_nature';
import runMigration43 from './run_migration_43_accounting_entries';
import { runMigration44 } from './run_migration_44_drop_company_whatsapp_official';
import { runMigration45 } from './run_migration_45_whatsapp_user_mode';
import runMigration44EasyCode from './run_migration_44_chart_of_accounts_easy_code';
import runMigration46 from './run_migration_46_whatsapp_phone_aliases';
import runMigration47 from './run_migration_47_whatsapp_normalize_alias_history';
import runMigration48 from './run_migration_48_tasks';
import runMigration49 from './run_migration_49_organizer_states';
import runMigration50 from './run_migration_50_whatsapp_sessions';
import runMigration51 from './run_migration_51_bank_accounts_pix_key';
import runMigration51SwaggerToken from './run_migration_51_swagger_token';
import runMigration52 from './run_migration_52_company_logo';
import runMigration53 from './run_migration_53_product_images';
import runMigration54 from './run_migration_54_customers_credit_fields';
import runMigration55 from './run_migration_55_soft_delete_sales_picking';
import runMigration56 from './run_migration_56_audit_logs';
import runMigration57EmailConfig from './run_migration_57_email_config';
import runMigration58 from './run_migration_58_sales_progress_status';
import runMigration59AjustePermissions from './run_migration_59_ajuste_permissions';
import { runMigration60 as runMigration60RawPassword } from './run_migration_60';
import runMigration60SalesNfeXmlFields from './run_migration_60_sales_nfe_xml_fields';
import { runMigration60 as runMigration60RelatedPersons } from './run_migration_60_transactions_related_persons';
import runMigration61ServiceTypesPermissions from './run_migration_61_service_types_permissions';
import runMigration62ServiceTypes from './run_migration_62_service_types';
import runMigration63Services from './run_migration_63_services';
import runMigration64ServicesTaxFields from './run_migration_64_services_tax_fields';
import runMigration65ServiceTaxPermissions from './run_migration_65_service_tax_permissions';
import runMigration66ServicesServiceTypeRelation from './run_migration_66_services_service_type_relation';
import runMigration67ServicesMunicipalTaxReference from './run_migration_67_services_municipal_tax_reference';
import runMigration68ServicesFederalTaxReference from './run_migration_68_services_federal_tax_reference';
import runMigration69ServiceLaunches from './run_migration_69_service_launches';
import runMigration70EmailConfigImap from './run_migration_70_email_config_imap';
import runMigration71StockVisionPermissions from './run_migration_71_stock_vision_permissions';
import runMigration72FinanceVisionPermissions from './run_migration_72_finance_vision_permissions';
import runMigration73StockTypes from './run_migration_73_stock_types';
import runMigration74ProductStockType from './run_migration_74_product_stock_type';
import runMigration75ServiceLaunchesNfseStatus from './run_migration_75_service_launches_nfse_status';
import runMigration76CustomerDiscount from './run_migration_76_customer_discount';
import runMigration77AccountingAutoEntries from './run_migration_77_accounting_auto_entries';
import runMigration78AccountingHistories from './run_migration_78_accounting_histories';
import runMigration79CustomerDeclarations from './run_migration_79_customer_declarations';
import runMigration80CustomerFields from './run_migration_80_customer_fields';
import runMigration80DeclarationValues from './run_migration_80_declaration_values';
import runMigration81AccumulatedRevenue from './run_migration_81_accumulated_revenue';
import runMigration82DocumentPeriod from './run_migration_82_document_period';
import runMigration83DeclarationTypes from './run_migration_83_declaration_types';
import runMigration84DeclarationRegistrationPermissions from './run_migration_84_declaration_registration_permissions';
import runMigration85AddTaxRegimeToDeclarationTypes from './run_migration_85_add_tax_regime_to_declaration_types';
import runMigration86QuoteStatus from './run_migration_86_quote_status';
import runMigration87QuotesFields from './run_migration_87_quotes_fields';
import runMigration88QuotesPermissions from './run_migration_88_quotes_permissions';
import { runMigration89QuoteServices } from './run_migration_89_quote_services';
import { runMigration90QuoteManualCustomerAndBrand } from './run_migration_90_quote_manual_customer_and_brand';
import { runMigration91QuotePaymentAndTerms } from './run_migration_91_quote_payment_and_terms';
import { runMigration92SolidconDorsalFields } from './run_migration_92_solidcon_dorsal_fields';
import { runMigration93AddCdfilial } from './run_migration_93_add_cdfilial';
import { runMigration94BankAccountsWebhookFields } from './run_migration_94_bank_accounts_webhook_fields';
import { runMigration95BankAccountsWebhookCerts } from './run_migration_95_bank_accounts_webhook_certs';
import { runMigration96FinanceCategoryTypes } from './run_migration_96_finance_category_types';
import { runMigration97BankAccountsWebhookBoleto } from './run_migration_97_bank_accounts_webhook_boleto';
import { runMigration98BankStatements } from './run_migration_98_bank_statements';



type SeedRole = 'admin' | 'operator' | 'financial' | 'seller' | 'contact' | 'accountant' | 'buyer' | 'service_provider' | 'user' | 'super_admin';

type CompanyRow = RowDataPacket & {
    id: number;
    public_id: string;
    trade_name: string;
    is_system: 0 | 1 | boolean;
};

const DB_NAME = process.env.DB_NAME || 'bessa_erp';
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '10', 10);
const DEFAULT_PASSWORD = '123';
const DEFAULT_VISIBLE_COMPANY_NAME = 'Empresa Padrao';
const SYSTEM_COMPANY_NAME = 'Sistema Keystone';

const ALL_MODULES = [
    'sales',
    'service_launches',
    'restaurant',
    'dashboard',
    'finance_vision',
    'stock_vision',
    'whatsapp-info',
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
    'manifestation',
    'expenses',
    'revenues',
    'finance_categories',
    'finance_category_types',
    'banks',
    'statements',
    'customers',
    'contacts',
    'sellers',
    'buyers',
    'service_providers',
    'suppliers',
    'company',
    'accountant',
    'accounting',
    'accounting_entries',
    'dre',
    'balanco',
    'balancete',
    'roles',
    'users',
    'tasks',
    'organizer',
    'ajuste',
    'whatsapp',
    'email',
    'swagger'
] as const;

const ROLE_MODULES: Record<SeedRole, readonly string[]> = {
    admin: ALL_MODULES,
    operator: ['dashboard', 'sales', 'restaurant', 'picking', 'nota'],
    financial: ['dashboard', 'finance_vision', 'expenses', 'revenues', 'finance_categories', 'finance_category_types', 'banks', 'statements', 'purchases', 'accountant'],
    seller: ['dashboard', 'sales', 'customers', 'contacts', 'sellers'],
    contact: ['dashboard', 'contacts'],
    accountant: ['dashboard', 'company', 'accountant'],
    buyer: ['dashboard', 'purchases', 'suppliers', 'buyers'],
    service_provider: ['dashboard', 'service_providers'],
    user: ['dashboard'],
    super_admin: ALL_MODULES,
};

const DEFAULT_COMPANY_USERS: Array<{ fullName: string; role: Exclude<SeedRole, 'super_admin'>; emailPrefix: string }> = [
    { fullName: 'Administrador', role: 'admin', emailPrefix: 'administrador' },
    { fullName: 'Operador', role: 'operator', emailPrefix: 'operador' },
    { fullName: 'Financeiro', role: 'financial', emailPrefix: 'financeiro' },
    { fullName: 'Usuario Comum', role: 'user', emailPrefix: 'usuario' },
];

function makeBaseConnectionConfig(): ConnectionOptions {
    const config: ConnectionOptions = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        port: parseInt(process.env.DB_PORT || '3306', 10),
    };

    if (process.env.MYSQL_UNIX_PORT) {
        config.socketPath = process.env.MYSQL_UNIX_PORT;
    }

    return config;
}

function escapeIdentifier(identifier: string): string {
    return `\`${identifier.replace(/`/g, '``')}\``;
}

function normalizeSchemaDatabase(sql: string): string {
    const escapedDbName = escapeIdentifier(DB_NAME);

    return sql
        .replace(/CREATE DATABASE IF NOT EXISTS\s+`?[^`;]+`?;/i, `CREATE DATABASE IF NOT EXISTS ${escapedDbName};`)
        .replace(/USE\s+`?[^`;]+`?;/i, `USE ${escapedDbName};`);
}

function makeCompanySeedEmail(prefix: string, companyId: number): string {
    return `${prefix}+empresa-${companyId}@keystone.local`;
}

async function ensureDatabaseExists(): Promise<void> {
    const connection = await mysql.createConnection(makeBaseConnectionConfig());

    try {
        await connection.query(
            `CREATE DATABASE IF NOT EXISTS ${escapeIdentifier(DB_NAME)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
    } finally {
        await connection.end();
    }
}

async function applyCanonicalSchema(): Promise<void> {
    const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
    const schemaSql = normalizeSchemaDatabase(await readFile(schemaPath, 'utf8'));
    const connection = await mysql.createConnection({
        ...makeBaseConnectionConfig(),
        database: DB_NAME,
        multipleStatements: true,
    });

    try {
        await connection.query(schemaSql);
    } finally {
        await connection.end();
    }
}

async function getCompanyById(id: number): Promise<CompanyRow> {
    const [rows] = await pool.query<CompanyRow[]>(
        'SELECT id, public_id, trade_name, is_system FROM companies WHERE id = ? LIMIT 1',
        [id]
    );

    if (!rows[0]) {
        throw new Error(`Company ${id} not found after insert`);
    }

    return rows[0];
}

async function ensureSystemCompany(): Promise<CompanyRow> {
    const [existingRows] = await pool.query<CompanyRow[]>(
        `SELECT id, public_id, trade_name, is_system
         FROM companies
         WHERE is_system = TRUE
         ORDER BY id ASC
         LIMIT 1`
    );

    if (existingRows[0]) {
        console.log(`[SKIP] system company already exists: ${existingRows[0].trade_name}`);
        return existingRows[0];
    }

    const publicId = randomUUID();
    const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO companies (public_id, trade_name, company_name, is_active, is_system)
         VALUES (?, ?, ?, TRUE, TRUE)`,
        [publicId, SYSTEM_COMPANY_NAME, SYSTEM_COMPANY_NAME]
    );

    console.log(`[OK] system company created: ${SYSTEM_COMPANY_NAME}`);
    return getCompanyById(result.insertId);
}

async function ensureAtLeastOneVisibleCompany(): Promise<void> {
    const [visibleCompanies] = await pool.query<CompanyRow[]>(
        `SELECT id, public_id, trade_name, is_system
         FROM companies
         WHERE is_system = FALSE
         LIMIT 1`
    );

    if (visibleCompanies[0]) {
        console.log('[SKIP] at least one visible company already exists');
        return;
    }

    const publicId = randomUUID();
    await pool.query<ResultSetHeader>(
        `INSERT INTO companies (public_id, trade_name, company_name, is_active, is_system)
         VALUES (?, ?, ?, TRUE, FALSE)`,
        [publicId, DEFAULT_VISIBLE_COMPANY_NAME, DEFAULT_VISIBLE_COMPANY_NAME]
    );

    console.log(`[OK] default visible company created: ${DEFAULT_VISIBLE_COMPANY_NAME}`);
}

async function getVisibleCompanies(): Promise<CompanyRow[]> {
    const [rows] = await pool.query<CompanyRow[]>(
        `SELECT id, public_id, trade_name, is_system
         FROM companies
         WHERE is_system = FALSE
         ORDER BY id ASC`
    );

    return rows;
}

async function ensureUser(companyId: number, fullName: string, email: string, role: SeedRole): Promise<void> {
    const [existingUsers] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE email = ? LIMIT 1',
        [email]
    );

    if (existingUsers.length > 0) {
        console.log(`[SKIP] user already exists: ${email}`);
        return;
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
    await pool.query<ResultSetHeader>(
        `INSERT INTO users (public_id, company_id, email, password_hash, full_name, role, is_active)
         VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
        [randomUUID(), companyId, email, passwordHash, fullName, role]
    );

    console.log(`[OK] user created: ${email} (${role})`);
}

async function ensureRolePermissions(companyId: number, role: SeedRole, modules: readonly string[]): Promise<void> {
    for (const module of modules) {
        await pool.query<ResultSetHeader>(
            `INSERT IGNORE INTO role_permissions (company_id, role, module, can_view)
             VALUES (?, ?, ?, TRUE)`,
            [companyId, role, module]
        );
    }
}

async function seedDefaultCompanyUsers(companies: CompanyRow[]): Promise<void> {
    for (const company of companies) {
        console.log(`[INFO] seeding users for company ${company.id} (${company.trade_name})`);

        await ensureRolePermissions(company.id, 'seller', ROLE_MODULES.seller);
        await ensureRolePermissions(company.id, 'accountant', ROLE_MODULES.accountant);

        for (const user of DEFAULT_COMPANY_USERS) {
            await ensureUser(
                company.id,
                user.fullName,
                makeCompanySeedEmail(user.emailPrefix, company.id),
                user.role
            );
            await ensureRolePermissions(company.id, user.role, ROLE_MODULES[user.role]);
        }
    }
}

async function seedSuperAdmin(systemCompanyId: number): Promise<void> {
    await ensureUser(systemCompanyId, 'Super Admin', 'superadmin@keystone.local', 'super_admin');
    await ensureRolePermissions(systemCompanyId, 'super_admin', ROLE_MODULES.super_admin);
}

async function runInitDb(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  initdb: canonical schema, migrations and seed              │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    console.log(`[INFO] target database: ${DB_NAME}`);
    await ensureDatabaseExists();
    await applyCanonicalSchema();

    await runMigration18();
    await runMigration19();
    await runMigration21();
    await runMigration22();
    await runMigration23();
    await runMigration24();
    await runMigration25();
    await runMigration26();
    await runMigration27();
    await runMigration28();
    await runMigration29();
    await runMigration30();
    await runMigration31();
    await runMigration32();
    await runMigration33();
    await runMigration34();
    await runMigration35();
    await runMigration36();
    await runMigration37();
    await runMigration37WhatsappMedia();
    await runMigration38Base64();
    await runMigration38Nfe();
    await runMigration39();
    await runMigration40();
    await runMigration41();
    await runMigration42();
    await runMigration43();
    await runMigration44();
    await runMigration45();
    await runMigration44EasyCode();
    await runMigration46();
    await runMigration47();
    await runMigration48();
    await runMigration49();
    await runMigration50();
    await runMigration51();
    await runMigration51SwaggerToken();
    await runMigration52();
    await runMigration53();
    await runMigration54();
    await runMigration55();
    await runMigration56();
    await runMigration57EmailConfig();
    await runMigration58();
    await runMigration59AjustePermissions();
    await runMigration60RawPassword();
    await runMigration60SalesNfeXmlFields();
    await runMigration60RelatedPersons();
    await runMigration61ServiceTypesPermissions();
    await runMigration62ServiceTypes();
    await runMigration63Services();
    await runMigration64ServicesTaxFields();
    await runMigration65ServiceTaxPermissions();
    await runMigration66ServicesServiceTypeRelation();
    await runMigration67ServicesMunicipalTaxReference();
    await runMigration68ServicesFederalTaxReference();
    await runMigration69ServiceLaunches();
    await runMigration70EmailConfigImap();
    await runMigration71StockVisionPermissions();
    await runMigration72FinanceVisionPermissions();
    await runMigration73StockTypes();
    await runMigration74ProductStockType();
    await runMigration75ServiceLaunchesNfseStatus();
    await runMigration76CustomerDiscount();
    await runMigration77AccountingAutoEntries();
    await runMigration78AccountingHistories();
    await runMigration79CustomerDeclarations();
    await runMigration80CustomerFields();
    await runMigration80DeclarationValues();
    await runMigration81AccumulatedRevenue();
    await runMigration82DocumentPeriod();
    await runMigration83DeclarationTypes();
    await runMigration84DeclarationRegistrationPermissions();
    await runMigration85AddTaxRegimeToDeclarationTypes();
    await runMigration86QuoteStatus();
    await runMigration87QuotesFields();
    await runMigration88QuotesPermissions();
    await runMigration89QuoteServices();
    await runMigration90QuoteManualCustomerAndBrand();
    await runMigration91QuotePaymentAndTerms();
    await runMigration92SolidconDorsalFields();
    await runMigration93AddCdfilial();
    await runMigration94BankAccountsWebhookFields();
    await runMigration95BankAccountsWebhookCerts();
    await runMigration96FinanceCategoryTypes();
    await runMigration97BankAccountsWebhookBoleto();
    await runMigration98BankStatements();



    const systemCompany = await ensureSystemCompany();
    await ensureAtLeastOneVisibleCompany();
    const visibleCompanies = await getVisibleCompanies();

    await seedDefaultCompanyUsers(visibleCompanies);
    await seedSuperAdmin(systemCompany.id);

    console.log('');
    console.log('[OK] initdb completed successfully.');
    console.log('[INFO] Default password for newly created seed users: 123');
    console.log('[INFO] Super admin login: superadmin@keystone.local');
    for (const company of visibleCompanies) {
        console.log(`[INFO] Seed users for company ${company.trade_name} (#${company.id}):`);
        console.log(`       administrador+empresa-${company.id}@keystone.local`);
        console.log(`       operador+empresa-${company.id}@keystone.local`);
        console.log(`       financeiro+empresa-${company.id}@keystone.local`);
        console.log(`       usuario+empresa-${company.id}@keystone.local`);
    }
}

runInitDb()
    .catch((error) => {
        console.error('[FAIL] initdb failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
