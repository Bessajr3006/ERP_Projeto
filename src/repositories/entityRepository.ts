import { randomUUID } from 'crypto';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import {
    Entity,
    EntityTable,
    CreateEntityData,
    UpdateEntityData,
} from '../types/Entity';
import { StorageService } from '../utils/storageService';
import { AppError } from '../errors/AppError';
import forge from 'node-forge';

type ColumnExistsRow = RowDataPacket & { column_count: number };

const BASE_ENTITY_FIELDS = [
    'name', 'cnpj_cpf', 'email', 'phone', 'zipcode', 'street',
    'number', 'complement', 'neighborhood', 'city', 'state',
    'certificate_url', 'certificate_password', 'certificate_expiration', 'certificate_name',
    'social_contract_url', 'cnpj_document_url',
] as const;

const CUSTOMER_ENTITY_FIELDS = [...BASE_ENTITY_FIELDS, 'vencimento_dia', 'limite', 'seller_user_id', 'customer_group_id', 'discount_type', 'discount_value', 'opening_date', 'tax_regime', 'cd_municipio', 'contact', 'trade_name', 'phone_landline', 'inscricao_estadual', 'inscricao_municipal', 'only_pix', 'only_solidcon_baixa', 'exempt_interest_fine', 'hide_in_revenues_grid'] as const;
const CONTACT_ENTITY_FIELDS = [...BASE_ENTITY_FIELDS, 'birth_date'] as const;

function getPersistedFields(table: EntityTable): readonly string[] {
    if (table === 'customers') return CUSTOMER_ENTITY_FIELDS;
    if (table === 'contacts') return CONTACT_ENTITY_FIELDS;
    return BASE_ENTITY_FIELDS;
}

function getEntityLabel(table: EntityTable): string {
    if (table === 'customers') return 'Customer';
    if (table === 'contacts') return 'Contact';
    return 'Supplier';
}

export class EntityRepository {
    private static customerSchemaReady = false;
    private static customerColumnNames: Set<string> | null = null;

    private static async loadCustomerColumnNames(): Promise<Set<string>> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT COLUMN_NAME
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'customers'`
        );

        const columns = new Set(rows.map((row) => String(row.COLUMN_NAME)));
        this.customerColumnNames = columns;
        return columns;
    }

    private static customerHasColumn(columnName: string): boolean {
        return this.customerColumnNames ? this.customerColumnNames.has(columnName) : true;
    }

    private static async customerColumnExists(columnName: string): Promise<boolean> {
        if (this.customerColumnNames) {
            return this.customerColumnNames.has(columnName);
        }

        const [rows] = await pool.query<ColumnExistsRow[]>(
            `SELECT COUNT(*) AS column_count
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'customers'
               AND COLUMN_NAME = ?`,
            [columnName]
        );

        return Number(rows[0]?.column_count || 0) > 0;
    }

    private static async addCustomerColumnIfMissing(columnName: string, definition: string): Promise<void> {
        if (await this.customerColumnExists(columnName)) {
            return;
        }

        try {
            await pool.query(`ALTER TABLE customers ADD COLUMN ${definition}`);
        } catch (error: any) {
            if (error?.code !== 'ER_DUP_FIELDNAME') {
                console.warn(`[EntityRepository] Nao foi possivel adicionar customers.${columnName}:`, error?.message || error);
            }
        } finally {
            await this.loadCustomerColumnNames();
        }
    }

    private static async ensureCustomerSchema(): Promise<void> {
        if (this.customerSchemaReady) {
            return;
        }

        await this.loadCustomerColumnNames();
        await this.addCustomerColumnIfMissing('trade_name', `trade_name VARCHAR(150) DEFAULT NULL AFTER name`);
        await this.addCustomerColumnIfMissing('seller_user_id', `seller_user_id INT DEFAULT NULL AFTER phone`);
        await this.addCustomerColumnIfMissing('phone_landline', `phone_landline VARCHAR(20) DEFAULT NULL AFTER phone`);
        await this.addCustomerColumnIfMissing('vencimento_dia', `vencimento_dia TINYINT DEFAULT NULL COMMENT 'Dia do mes para vencimento (1-31)' AFTER phone`);
        await this.addCustomerColumnIfMissing('limite', `limite DECIMAL(15, 2) NOT NULL DEFAULT 0.00 COMMENT 'Limite de credito' AFTER vencimento_dia`);
        await this.addCustomerColumnIfMissing('only_pix', `only_pix TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Travar emissao de boleto (Somente PIX)' AFTER limite`);
        await this.addCustomerColumnIfMissing('only_solidcon_baixa', `only_solidcon_baixa TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Travar baixa no Keystone (Baixa Exclusiva Solidcon)' AFTER only_pix`);
        await this.addCustomerColumnIfMissing('exempt_interest_fine', `exempt_interest_fine TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Isentar juros e multa do cliente' AFTER only_solidcon_baixa`);
        await this.addCustomerColumnIfMissing('hide_in_revenues_grid', `hide_in_revenues_grid TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Não exibir no grid receita (revenues.html)' AFTER exempt_interest_fine`);
        await this.addCustomerColumnIfMissing('cd_municipio', `cd_municipio INT DEFAULT NULL AFTER state`);

        this.customerSchemaReady = true;
    }

    private static async ensureSchemaForTable(table: EntityTable): Promise<void> {
        if (table === 'customers') {
            await this.ensureCustomerSchema();
        }
    }

    private static async getPersistedFieldsForTable(table: EntityTable): Promise<readonly string[]> {
        await this.ensureSchemaForTable(table);

        const fields = getPersistedFields(table);
        if (table !== 'customers') {
            return fields;
        }

        return fields.filter((field) => this.customerHasColumn(field));
    }

    static async resolveCustomerSellerId(companyId: number, sellerPublicId: string | null | undefined): Promise<number | null | undefined> {
        await this.ensureCustomerSchema();

        if (sellerPublicId === undefined) return undefined;
        const normalizedSellerPublicId = String(sellerPublicId || '').trim();
        if (!normalizedSellerPublicId) return null;

        const [sellerRows] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM users WHERE public_id = ? AND company_id = ? AND role = 'seller' LIMIT 1`,
            [normalizedSellerPublicId, companyId]
        );
        if (!sellerRows[0]) throw new Error('Seller not found for this company');
        return Number(sellerRows[0].id);
    }

    static async resolveCustomerGroupId(companyId: number, customerGroupPublicId: string | null | undefined): Promise<number | null | undefined> {
        await this.ensureCustomerSchema();

        if (customerGroupPublicId === undefined) return undefined;
        const normalizedGroupPublicId = String(customerGroupPublicId || '').trim();
        if (!normalizedGroupPublicId) return null;

        const [groupRows] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM customer_groups WHERE public_id = ? AND company_id = ? LIMIT 1`,
            [normalizedGroupPublicId, companyId]
        );
        if (!groupRows[0]) throw new Error('Customer group not found for this company');
        return Number(groupRows[0].id);
    }

    static buildSelectQuery(table: EntityTable, whereSql: string, tailSql = ''): string {
        if (table === 'customers') {
            const hasSeller = this.customerHasColumn('seller_user_id');
            const selectParts = [
                'c.*',
                '(CASE WHEN c.cnpj_cpf IS NOT NULL AND c.cnpj_cpf != "" THEN (SELECT COUNT(*) FROM companies comp WHERE REPLACE(REPLACE(REPLACE(REPLACE(comp.cnpj, ".", ""), "-", ""), "/", ""), " ", "") = REPLACE(REPLACE(REPLACE(REPLACE(c.cnpj_cpf, ".", ""), "-", ""), "/", ""), " ", "")) > 0 ELSE 0 END) AS is_registered_as_company',
                '(SELECT comp.id FROM companies comp WHERE REPLACE(REPLACE(REPLACE(REPLACE(comp.cnpj, ".", ""), "-", ""), "/", ""), " ", "") = REPLACE(REPLACE(REPLACE(REPLACE(c.cnpj_cpf, ".", ""), "-", ""), "/", ""), " ", "") LIMIT 1) AS registered_company_id',
                '(SELECT COALESCE(comp.trade_name, comp.company_name) FROM companies comp WHERE REPLACE(REPLACE(REPLACE(REPLACE(comp.cnpj, ".", ""), "-", ""), "/", ""), " ", "") = REPLACE(REPLACE(REPLACE(REPLACE(c.cnpj_cpf, ".", ""), "-", ""), "/", ""), " ", "") LIMIT 1) AS registered_company_name',
                '(SELECT comp.cnpj FROM companies comp WHERE REPLACE(REPLACE(REPLACE(REPLACE(comp.cnpj, ".", ""), "-", ""), "/", ""), " ", "") = REPLACE(REPLACE(REPLACE(REPLACE(c.cnpj_cpf, ".", ""), "-", ""), "/", ""), " ", "") LIMIT 1) AS registered_company_cnpj',
                '(SELECT COUNT(*) FROM customer_notes cn WHERE cn.customer_id = c.id AND cn.company_id = c.company_id) AS notes_count',
                '(SELECT COUNT(*) FROM tasks t WHERE t.person_type = \'customer\' AND t.person_id = c.public_id AND t.company_id = c.company_id AND t.status != \'completed\') AS tasks_count'
            ];
            const joins = [];

            if (hasSeller) {
                selectParts.push('seller.public_id AS seller_public_id', 'seller.full_name AS seller_name');
                joins.push('LEFT JOIN users seller ON seller.id = c.seller_user_id AND seller.company_id = c.company_id');
            } else {
                selectParts.push('NULL AS seller_public_id', 'NULL AS seller_name');
            }

            if (this.customerHasColumn('customer_group_id')) {
                selectParts.push('cg.public_id AS customer_group_public_id', 'cg.name AS customer_group_name');
                joins.push('LEFT JOIN customer_groups cg ON cg.id = c.customer_group_id AND cg.company_id = c.company_id');
            } else {
                selectParts.push('NULL AS customer_group_public_id', 'NULL AS customer_group_name');
            }

            return `SELECT ${selectParts.join(', ')} FROM customers c ${joins.join(' ')} ${whereSql} ${tailSql}`;
        }
        const notesTable = table === 'contacts' ? 'contact_notes' : 'supplier_notes';
        const notesIdCol = table === 'contacts' ? 'contact_id' : 'supplier_id';
        const personType = table === 'contacts' ? 'contact' : 'supplier';

        const selectParts = [
            'e.*',
            `(SELECT COUNT(*) FROM ${notesTable} n WHERE n.${notesIdCol} = e.id AND n.company_id = e.company_id) AS notes_count`,
            `(SELECT COUNT(*) FROM tasks t WHERE t.person_type = '${personType}' AND t.person_id = e.public_id AND t.company_id = e.company_id AND t.status != 'completed') AS tasks_count`
        ];

        return `SELECT ${selectParts.join(', ')} FROM ${table} e ${whereSql} ${tailSql}`;
    }

    private static async loadActivitiesForCustomer(customer: Entity): Promise<Entity> {
        if (customer) {
            const [activityRows] = await pool.query<RowDataPacket[]>(
                `SELECT ag.public_id, ag.name 
                 FROM customer_activities ca
                 JOIN activity_groups ag ON ag.id = ca.activity_group_id
                 WHERE ca.customer_id = ?`,
                [customer.id]
            );
            customer.activity_groups = activityRows.map(r => ({ public_id: r.public_id, name: r.name }));
        }
        return customer;
    }

    private static async loadActivitiesForCustomers(customers: Entity[]): Promise<Entity[]> {
        if (customers.length === 0) return customers;
        
        const customerIds = customers.map(c => c.id);
        const [activityRows] = await pool.query<RowDataPacket[]>(
            `SELECT ca.customer_id, ag.public_id, ag.name 
             FROM customer_activities ca
             JOIN activity_groups ag ON ag.id = ca.activity_group_id
             WHERE ca.customer_id IN (?)`,
            [customerIds]
        );
        
        const activitiesMap: Record<number, { public_id: string; name: string }[]> = {};
        for (const row of activityRows) {
            if (!activitiesMap[row.customer_id]) {
                activitiesMap[row.customer_id] = [];
            }
            activitiesMap[row.customer_id]!.push({
                public_id: row.public_id,
                name: row.name
            });
        }
        
        for (const c of customers) {
            c.activity_groups = activitiesMap[c.id] || [];
        }
        return customers;
    }

    static async getById(table: EntityTable, id: number, companyId: number): Promise<Entity> {
        await this.ensureSchemaForTable(table);

        const tableAlias = table === 'customers' ? 'c' : 'e';
        const label = getEntityLabel(table);

        const [rows] = await pool.query<RowDataPacket[]>(
            this.buildSelectQuery(table, `WHERE ${tableAlias}.id = ? AND ${tableAlias}.company_id = ?`, 'LIMIT 1'),
            [id, companyId]
        );
        if (!rows || rows.length === 0) throw new Error(`${label} not found`);
        const customer = rows[0] as Entity;
        if (table === 'customers') {
            return this.loadActivitiesForCustomer(customer);
        }
        return customer;
    }

    static async getByPublicId(table: EntityTable, publicId: string, companyId: number): Promise<Entity> {
        await this.ensureSchemaForTable(table);

        const tableAlias = table === 'customers' ? 'c' : 'e';
        const label = getEntityLabel(table);

        const [rows] = await pool.query<RowDataPacket[]>(
            this.buildSelectQuery(table, `WHERE ${tableAlias}.public_id = ? AND ${tableAlias}.company_id = ?`, 'LIMIT 1'),
            [publicId, companyId]
        );
        if (!rows || rows.length === 0) throw new Error(`${label} not found`);
        const customer = rows[0] as Entity;
        if (table === 'customers') {
            return this.loadActivitiesForCustomer(customer);
        }
        return customer;
    }

    static async getCustomerByDocument(companyId: number, cnpjCpf: string): Promise<Entity | null> {
        await this.ensureCustomerSchema();

        const cleanDoc = String(cnpjCpf || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (!cleanDoc && !cnpjCpf) return null;

        const [rows] = await pool.query<RowDataPacket[]>(
            this.buildSelectQuery(
                'customers',
                `WHERE (c.cnpj_cpf = ? OR REPLACE(REPLACE(REPLACE(REPLACE(c.cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '') = ? OR c.cnpj_cpf = ?) AND c.company_id = ?`,
                'LIMIT 1'
            ),
            [cnpjCpf, cleanDoc, cleanDoc, companyId]
        );
        if (!rows || rows.length === 0) return null;
        return this.loadActivitiesForCustomer(rows[0] as Entity);
    }

    static async getCustomerByName(companyId: number, name: string): Promise<Entity | null> {
        await this.ensureCustomerSchema();

        const trimmed = String(name || '').trim();
        if (!trimmed) return null;

        const [rows] = await pool.query<RowDataPacket[]>(
            this.buildSelectQuery(
                'customers',
                'WHERE (LOWER(TRIM(c.name)) = LOWER(TRIM(?)) OR (c.trade_name IS NOT NULL AND LOWER(TRIM(c.trade_name)) = LOWER(TRIM(?)))) AND c.company_id = ?',
                'LIMIT 1'
            ),
            [trimmed, trimmed, companyId]
        );
        if (!rows || rows.length === 0) return null;
        return this.loadActivitiesForCustomer(rows[0] as Entity);
    }

    static async getSupplierByDocument(companyId: number, cnpjCpf: string): Promise<Entity | null> {
        await this.ensureSchemaForTable('suppliers');

        const cleanDoc = String(cnpjCpf || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (!cleanDoc && !cnpjCpf) return null;

        const [rows] = await pool.query<RowDataPacket[]>(
            this.buildSelectQuery(
                'suppliers',
                `WHERE (e.cnpj_cpf = ? OR REPLACE(REPLACE(REPLACE(REPLACE(e.cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '') = ? OR e.cnpj_cpf = ?) AND e.company_id = ?`,
                'LIMIT 1'
            ),
            [cnpjCpf, cleanDoc, cleanDoc, companyId]
        );
        if (!rows || rows.length === 0) return null;
        return rows[0] as Entity;
    }

    static async getSupplierByName(companyId: number, name: string): Promise<Entity | null> {
        await this.ensureSchemaForTable('suppliers');

        const trimmed = String(name || '').trim();
        if (!trimmed) return null;

        const [rows] = await pool.query<RowDataPacket[]>(
            this.buildSelectQuery(
                'suppliers',
                'WHERE (LOWER(TRIM(e.name)) = LOWER(TRIM(?)) OR (e.trade_name IS NOT NULL AND LOWER(TRIM(e.trade_name)) = LOWER(TRIM(?)))) AND e.company_id = ?',
                'LIMIT 1'
            ),
            [trimmed, trimmed, companyId]
        );
        if (!rows || rows.length === 0) return null;
        return rows[0] as Entity;
    }

    static async assertUniqueDocument(table: EntityTable, cnpjCpf: string, companyId: number, excludeId?: number): Promise<void> {
        await this.ensureSchemaForTable(table);

        const cleanDoc = String(cnpjCpf || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (!cleanDoc && !cnpjCpf) return;

        const sql = excludeId
            ? `SELECT id FROM ${table} WHERE (cnpj_cpf = ? OR REPLACE(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '') = ?) AND company_id = ? AND id != ? LIMIT 1`
            : `SELECT id FROM ${table} WHERE (cnpj_cpf = ? OR REPLACE(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', ''), ' ', '') = ?) AND company_id = ? LIMIT 1`;
        const params = excludeId ? [cnpjCpf, cleanDoc, companyId, excludeId] : [cnpjCpf, cleanDoc, companyId];
        const [existing] = await pool.query<RowDataPacket[]>(sql, params);
        if (existing && existing.length > 0) {
            const friendlyLabel = table === 'customers' ? 'Cliente' : table === 'suppliers' ? 'Fornecedor' : 'Contato';
            throw new AppError(`${friendlyLabel} com este CPF/CNPJ já cadastrado nesta empresa.`, 400);
        }
    }

    static async create(table: EntityTable, companyId: number, data: CreateEntityData): Promise<Entity> {
        await this.ensureSchemaForTable(table);

        if (data.cnpj_cpf) {
            let doc = String(data.cnpj_cpf).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            if (doc.length > 0) {
                if (doc.length <= 11) {
                    doc = doc.padStart(11, '0');
                } else if (doc.length <= 14) {
                    doc = doc.padStart(14, '0');
                }
            }
            data.cnpj_cpf = doc;
            await this.assertUniqueDocument(table, data.cnpj_cpf, companyId);
        }

        const publicId = randomUUID();
        let certUrl = data.certificate_url ?? null;
        if (!certUrl && data.certificate_base64) {
            const saved = StorageService.saveBase64('documents', data.certificate_base64);
            certUrl = saved ? saved.url : null;

            // Auto-extract expiration date from the PFX when password is available
            const pfxPassword = data.certificate_password || '';
            if (pfxPassword && data.certificate_base64) {
                try {
                    const dataUriMatch = data.certificate_base64.match(/^data:([^;]+);base64,(.+)$/);
                    const cleanB64 = dataUriMatch ? (dataUriMatch[2] || '') : data.certificate_base64;
                    const pfxBuf = Buffer.from(cleanB64, 'base64');
                    const p12Asn1 = forge.asn1.fromDer(pfxBuf.toString('binary'));
                    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, pfxPassword);
                    const certBags: any = p12.getBags({ bagType: forge.pki.oids.certBag });
                    const certBag = certBags[forge.pki.oids.certBag as string];
                    if (certBag && certBag.length > 0) {
                        const notAfter: Date = certBag[0].cert?.validity?.notAfter;
                        if (notAfter) {
                            data.certificate_expiration = notAfter.toISOString().split('T')[0];
                        }
                    }
                } catch (e) {
                    console.error('Failed to auto-extract expiration date from contact cert (create):', e);
                }
            }
        }

        let socialDestUrl = data.social_contract_url ?? null;
        if (!socialDestUrl && data.social_contract_base64) {
            const saved = StorageService.saveBase64('documents', data.social_contract_base64);
            socialDestUrl = saved ? saved.url : null;
        }

        const parseCnpjDocuments = (val: any): { name: string; url: string; attachedAt?: string }[] => {
            if (!val) return [];
            let list: any[] = [];
            if (Array.isArray(val)) {
                list = val;
            } else {
                try {
                    if (typeof val === 'string' && val.trim().startsWith('[')) {
                        list = JSON.parse(val);
                    } else if (typeof val === 'string' && val.trim() !== '') {
                        list = [val];
                    }
                } catch (e) {}
            }
            return list.map(item => {
                if (typeof item === 'string') {
                    const fileName = item.substring(item.lastIndexOf('/') + 1);
                    return { name: fileName, url: item, attachedAt: new Date(2026, 0, 1).toISOString() };
                }
                if (item && typeof item === 'object' && item.url) {
                    return {
                        name: item.name || item.url.substring(item.url.lastIndexOf('/') + 1),
                        url: item.url,
                        attachedAt: item.attachedAt || new Date().toISOString()
                    };
                }
                return null;
            }).filter(Boolean) as { name: string; url: string; attachedAt: string }[];
        };

        const targetDocs = parseCnpjDocuments(data.cnpj_document_url);

        if (data.cnpj_document_uploads && Array.isArray(data.cnpj_document_uploads)) {
            for (const upload of data.cnpj_document_uploads) {
                if (upload && upload.base64) {
                    const saved = StorageService.saveBase64('documents', upload.base64, upload.filename);
                    if (saved) {
                        const displayName = upload.name || saved.filename || saved.url.substring(saved.url.lastIndexOf('/') + 1);
                        targetDocs.push({
                            name: displayName,
                            url: saved.url,
                            attachedAt: upload.attachedAt || new Date().toISOString()
                        });
                    }
                }
            }
        }

        if (data.cnpj_document_base64) {
            const b64s = Array.isArray(data.cnpj_document_base64) ? data.cnpj_document_base64 : [data.cnpj_document_base64];
            for (const b64 of b64s) {
                const saved = StorageService.saveBase64('documents', b64);
                if (saved) {
                    const displayName = saved.filename || saved.url.substring(saved.url.lastIndexOf('/') + 1);
                    targetDocs.push({
                        name: displayName,
                        url: saved.url,
                        attachedAt: new Date().toISOString()
                    });
                }
            }
        }

        const cnpjDestUrl = targetDocs.length > 0 ? JSON.stringify(targetDocs) : null;

        const persistedFields = await this.getPersistedFieldsForTable(table);
        const persistedValues: Record<string, any> = Object.fromEntries(persistedFields.map((field) => [field, (data as any)[field] ?? null]));
        persistedValues.certificate_url = certUrl;
        persistedValues.social_contract_url = socialDestUrl;
        persistedValues.cnpj_document_url = cnpjDestUrl;

        if (table === 'customers') {
            if (this.customerHasColumn('seller_user_id')) {
                persistedValues.seller_user_id = (await this.resolveCustomerSellerId(companyId, data.seller_public_id)) ?? null;
            }
            if (this.customerHasColumn('customer_group_id')) {
                persistedValues.customer_group_id = (await this.resolveCustomerGroupId(companyId, data.customer_group_public_id)) ?? null;
            }
            if (this.customerHasColumn('limite')) {
                persistedValues.limite = data.limite ?? 0;
            }
            if (this.customerHasColumn('only_pix')) {
                persistedValues.only_pix = (data.only_pix === 1 || data.only_pix === true) ? 1 : 0;
            }
            if (this.customerHasColumn('only_solidcon_baixa')) {
                persistedValues.only_solidcon_baixa = (data.only_solidcon_baixa === 1 || data.only_solidcon_baixa === true) ? 1 : 0;
            }
            if (this.customerHasColumn('exempt_interest_fine')) {
                persistedValues.exempt_interest_fine = (data.exempt_interest_fine === 1 || data.exempt_interest_fine === true) ? 1 : 0;
            }
            if (this.customerHasColumn('hide_in_revenues_grid')) {
                persistedValues.hide_in_revenues_grid = (data.hide_in_revenues_grid === 1 || data.hide_in_revenues_grid === true) ? 1 : 0;
            }
        }

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO ${table} (public_id, company_id, ${persistedFields.join(', ')}) VALUES (?, ?, ${persistedFields.map(() => '?').join(', ')})`,
            [publicId, companyId, ...persistedFields.map((field) => persistedValues[field] ?? null)]
        );

        if (result.affectedRows !== 1) throw new Error(`Failed to create entity`);

        if (table === 'customers' && (data as any).activity_groups_public_ids) {
            const customerId = result.insertId;
            const activityGroupsPublicIds = (data as any).activity_groups_public_ids;
            if (Array.isArray(activityGroupsPublicIds) && activityGroupsPublicIds.length > 0) {
                const [activityGroups] = await pool.query<RowDataPacket[]>(
                    'SELECT id FROM activity_groups WHERE public_id IN (?) AND company_id = ?',
                    [activityGroupsPublicIds, companyId]
                );
                
                if (activityGroups.length > 0) {
                    const insertValues = activityGroups.map(ag => [customerId, ag.id]);
                    await pool.query(
                        'INSERT INTO customer_activities (customer_id, activity_group_id) VALUES ?',
                        [insertValues]
                    );
                }
            }
        }

        if (table === 'customers') {
            try {
                // Check if this company is the general administrator
                const [generalAdminRows] = await pool.query<RowDataPacket[]>(
                    'SELECT id FROM companies WHERE is_general_admin = 1 LIMIT 1'
                );
                const generalAdminCompanyId = generalAdminRows[0]?.id;

                const registerAsCompany = (data as any).register_as_company;
                const shouldRegisterAsCompany = registerAsCompany === true || registerAsCompany === 1 || registerAsCompany === 'true' || registerAsCompany === '1';

                if (generalAdminCompanyId && companyId === generalAdminCompanyId && shouldRegisterAsCompany) {
                    const companyPublicId = randomUUID();
                    const inputTradeName = (data as any).trade_name || '';
                    const inputName = data.name || '';
                    const trade_name = inputTradeName || inputName || 'Empresa Sem Nome';
                    const company_name = inputName || trade_name;
                    const cnpj = data.cnpj_cpf || null;

                    const columns = ['public_id', 'trade_name', 'company_name', 'cnpj', 'is_active', 'is_system', 'is_general_admin'];
                    const placeholders = ['?', '?', '?', '?', 'true', 'false', 'false'];
                    const values: any[] = [companyPublicId, trade_name, company_name, cnpj];

                    const extraFields = ['email', 'phone', 'zipcode', 'street', 'number', 'complement', 'neighborhood', 'city', 'state'];
                    for (const field of extraFields) {
                        if ((data as any)[field] !== undefined) {
                            columns.push(field);
                            placeholders.push('?');
                            values.push((data as any)[field] || null);
                        }
                    }

                    const { CompanyRepository } = await import('./companyRepository');
                    const { RoleService } = await import('../services/roleService');
                    const { UserService } = await import('../services/userService');

                    // Check if company with same CNPJ already exists
                    let skipCompanyCreation = false;
                    if (cnpj) {
                        const existingComp = await CompanyRepository.getByCnpj(cnpj);
                        if (existingComp && existingComp.length > 0) {
                            skipCompanyCreation = true;
                        }
                    }

                    if (!skipCompanyCreation) {
                        const newCompanyId = await CompanyRepository.create(columns, placeholders, values);
                        await RoleService.ensureDefaultRoles(newCompanyId);

                        const customUser = (data as any).company_user;
                        if (customUser && customUser.email && customUser.password) {
                            try {
                                await UserService.create(newCompanyId, {
                                    email: customUser.email,
                                    full_name: customUser.full_name || trade_name,
                                    passwordRaw: customUser.password,
                                    role: customUser.role || 'supervisor',
                                    is_active: true
                                });
                            } catch (userErr) {
                                console.error('Failed to create custom user for mirrored company:', userErr);
                            }
                        } else if (data.email) {
                            const cleanCnpjCpf = cnpj ? String(cnpj).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
                            const passwordRaw = cleanCnpjCpf.length >= 6 ? cleanCnpjCpf : 'keystone123';
                            try {
                                await UserService.create(newCompanyId, {
                                    email: data.email,
                                    full_name: trade_name,
                                    passwordRaw,
                                    role: 'supervisor',
                                    is_active: true
                                });
                            } catch (userErr) {
                                console.error('Failed to create default user for mirrored company:', userErr);
                            }
                        }
                    }
                }
            } catch (mirrorErr) {
                console.error('Error mirroring customer to company:', mirrorErr);
            }
        }

        return this.getById(table, result.insertId, companyId);
    }

    static async list(table: EntityTable, companyId: number): Promise<Entity[]> {
        await this.ensureSchemaForTable(table);

        const tableAlias = table === 'customers' ? 'c' : 'e';

        const [rows] = await pool.query<RowDataPacket[]>(
            this.buildSelectQuery(table, `WHERE ${tableAlias}.company_id = ?`, `ORDER BY ${tableAlias}.name ASC`),
            [companyId]
        );
        const entities = rows as Entity[];
        if (table === 'customers') {
            return this.loadActivitiesForCustomers(entities);
        }
        return entities;
    }

    static async listCustomersBySeller(companyId: number, sellerPublicId: string): Promise<Entity[]> {
        await this.ensureSchemaForTable('customers');
        const sellerId = await this.resolveCustomerSellerId(companyId, sellerPublicId);
        if (!sellerId) return [];

        const [rows] = await pool.query<RowDataPacket[]>(
            this.buildSelectQuery('customers', `WHERE c.company_id = ? AND c.seller_user_id = ?`, `ORDER BY c.name ASC`),
            [companyId, sellerId]
        );
        return this.loadActivitiesForCustomers(rows as Entity[]);
    }

    static async update(table: EntityTable, publicId: string, companyId: number, data: UpdateEntityData): Promise<Entity> {
        await this.ensureSchemaForTable(table);

        const label = getEntityLabel(table);
        const [currentRows] = await pool.query<RowDataPacket[]>(
            `SELECT * FROM ${table} WHERE public_id = ? AND company_id = ? LIMIT 1`,
            [publicId, companyId]
        );

        if (!currentRows || currentRows.length === 0) throw new Error(`${label} not found`);

        const currentId: number = currentRows[0]!.id;
        const currentCnpj: string | null = currentRows[0]!.cnpj_cpf;

        if (data.cnpj_cpf) {
            let doc = String(data.cnpj_cpf).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            if (doc.length > 0) {
                if (doc.length <= 11) {
                    doc = doc.padStart(11, '0');
                } else if (doc.length <= 14) {
                    doc = doc.padStart(14, '0');
                }
            }
            data.cnpj_cpf = doc;
        }

        if (data.cnpj_cpf && data.cnpj_cpf !== currentCnpj) {
            await this.assertUniqueDocument(table, data.cnpj_cpf, currentRows[0]!.company_id, currentId);
        }

        const updates: string[] = [];
        const values: any[] = [];
        const currentEnt = currentRows[0] as Record<string, any>;

        if (data.certificate_base64 !== undefined) {
            if (currentEnt.certificate_url) StorageService.delete(currentEnt.certificate_url);
            const saved = StorageService.saveBase64('documents', data.certificate_base64);
            updates.push('certificate_url = ?'); values.push(saved ? saved.url : null);

            // Auto-extract expiration date from the PFX when password is available
            const pfxPassword = data.certificate_password ?? currentEnt.certificate_password ?? '';
            if (pfxPassword && data.certificate_base64) {
                try {
                    const dataUriMatch = data.certificate_base64.match(/^data:([^;]+);base64,(.+)$/);
                    const cleanB64 = dataUriMatch ? (dataUriMatch[2] || '') : data.certificate_base64;
                    const pfxBuf = Buffer.from(cleanB64, 'base64');
                    const p12Asn1 = forge.asn1.fromDer(pfxBuf.toString('binary'));
                    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, pfxPassword);
                    const certBags: any = p12.getBags({ bagType: forge.pki.oids.certBag });
                    const certBag = certBags[forge.pki.oids.certBag as string];
                    if (certBag && certBag.length > 0) {
                        const notAfter: Date = certBag[0].cert?.validity?.notAfter;
                        if (notAfter) {
                            data.certificate_expiration = notAfter.toISOString().split('T')[0];
                        }
                    }
                } catch (e) {
                    console.error('Failed to auto-extract expiration date from contact cert (update):', e);
                }
            }
        } else if (data.certificate_url !== undefined) {
            updates.push('certificate_url = ?'); values.push(data.certificate_url || null);
        }

        if (data.social_contract_base64 !== undefined) {
            if (currentEnt.social_contract_url) StorageService.delete(currentEnt.social_contract_url);
            const saved = StorageService.saveBase64('documents', data.social_contract_base64);
            updates.push('social_contract_url = ?'); values.push(saved ? saved.url : null);
        } else if (data.social_contract_url !== undefined) {
            updates.push('social_contract_url = ?'); values.push(data.social_contract_url || null);
        }

        if (data.cnpj_document_base64 !== undefined || data.cnpj_document_url !== undefined || data.cnpj_document_uploads !== undefined) {
            const parseCnpjDocuments = (val: any): { name: string; url: string; attachedAt: string }[] => {
                if (!val) return [];
                let list: any[] = [];
                if (Array.isArray(val)) {
                    list = val;
                } else {
                    try {
                        if (typeof val === 'string' && val.trim().startsWith('[')) {
                            list = JSON.parse(val);
                        } else if (typeof val === 'string' && val.trim() !== '') {
                            list = [val];
                        }
                    } catch (e) {}
                }
                return list.map(item => {
                    if (typeof item === 'string') {
                        const fileName = item.substring(item.lastIndexOf('/') + 1);
                        return { name: fileName, url: item, attachedAt: new Date(2026, 0, 1).toISOString() };
                    }
                    if (item && typeof item === 'object' && item.url) {
                        return {
                            name: item.name || item.url.substring(item.url.lastIndexOf('/') + 1),
                            url: item.url,
                            attachedAt: item.attachedAt || new Date().toISOString()
                        };
                    }
                    return null;
                }).filter(Boolean) as { name: string; url: string; attachedAt: string }[];
            };

            const currentDocs = parseCnpjDocuments(currentEnt.cnpj_document_url);
            const targetDocs = data.cnpj_document_url !== undefined ? parseCnpjDocuments(data.cnpj_document_url) : [...currentDocs];

            // Delete files that were removed
            const targetUrls = targetDocs.map(d => d.url);
            for (const doc of currentDocs) {
                if (!targetUrls.includes(doc.url)) {
                    StorageService.delete(doc.url);
                }
            }

            if (data.cnpj_document_uploads && Array.isArray(data.cnpj_document_uploads)) {
                for (const upload of data.cnpj_document_uploads) {
                    if (upload && upload.base64) {
                        const saved = StorageService.saveBase64('documents', upload.base64, upload.filename);
                        if (saved) {
                            const displayName = upload.name || saved.filename || saved.url.substring(saved.url.lastIndexOf('/') + 1);
                            targetDocs.push({
                                name: displayName,
                                url: saved.url,
                                attachedAt: upload.attachedAt || new Date().toISOString()
                            });
                        }
                    }
                }
            }

            if (data.cnpj_document_base64) {
                const b64s = Array.isArray(data.cnpj_document_base64) ? data.cnpj_document_base64 : [data.cnpj_document_base64];
                for (const b64 of b64s) {
                    const saved = StorageService.saveBase64('documents', b64);
                    if (saved) {
                        const displayName = saved.filename || saved.url.substring(saved.url.lastIndexOf('/') + 1);
                        targetDocs.push({
                            name: displayName,
                            url: saved.url,
                            attachedAt: new Date().toISOString()
                        });
                    }
                }
            }

            const finalCnpjUrl = targetDocs.length > 0 ? JSON.stringify(targetDocs) : null;
            updates.push('cnpj_document_url = ?');
            values.push(finalCnpjUrl);
        }


        for (const field of await this.getPersistedFieldsForTable(table)) {
            if (['certificate_url', 'social_contract_url', 'cnpj_document_url'].includes(field)) continue;
            const val = (data as any)[field];
            if (val !== undefined) {
                updates.push(`${field} = ?`);
                values.push(val);
            }
        }

        if (table === 'customers' && this.customerHasColumn('seller_user_id') && data.seller_public_id !== undefined) {
            updates.push('seller_user_id = ?');
            values.push(await this.resolveCustomerSellerId(currentRows[0]!.company_id, data.seller_public_id));
        }

        if (table === 'customers' && this.customerHasColumn('customer_group_id') && data.customer_group_public_id !== undefined) {
            updates.push('customer_group_id = ?');
            values.push(await this.resolveCustomerGroupId(currentRows[0]!.company_id, data.customer_group_public_id));
        }

        if (updates.length > 0) {
            values.push(currentId, currentRows[0]!.company_id);
            await pool.query<ResultSetHeader>(`UPDATE ${table} SET ${updates.join(', ')} WHERE id = ? AND company_id = ?`, values);
        }

        if (table === 'customers' && (data as any).activity_groups_public_ids !== undefined) {
            const customerId = currentId;
            const activityGroupsPublicIds = (data as any).activity_groups_public_ids;
            
            await pool.query(
                'DELETE FROM customer_activities WHERE customer_id = ?',
                [customerId]
            );
            
            if (Array.isArray(activityGroupsPublicIds) && activityGroupsPublicIds.length > 0) {
                const [activityGroups] = await pool.query<RowDataPacket[]>(
                    'SELECT id FROM activity_groups WHERE public_id IN (?) AND company_id = ?',
                    [activityGroupsPublicIds, companyId]
                );
                
                if (activityGroups.length > 0) {
                    const insertValues = activityGroups.map(ag => [customerId, ag.id]);
                    await pool.query(
                        'INSERT INTO customer_activities (customer_id, activity_group_id) VALUES ?',
                        [insertValues]
                    );
                }
            }
        }

        if (table === 'customers') {
            try {
                // Check if this company is the general administrator
                const [generalAdminRows] = await pool.query<RowDataPacket[]>(
                    'SELECT id FROM companies WHERE is_general_admin = 1 LIMIT 1'
                );
                const generalAdminCompanyId = generalAdminRows[0]?.id;

                const registerAsCompany = (data as any).register_as_company;
                const shouldRegisterAsCompany = registerAsCompany === true || registerAsCompany === 1 || registerAsCompany === 'true' || registerAsCompany === '1';

                if (generalAdminCompanyId && companyId === generalAdminCompanyId && shouldRegisterAsCompany) {
                    const companyPublicId = randomUUID();
                    const inputTradeName = data.trade_name !== undefined ? data.trade_name : currentEnt.trade_name;
                    const inputName = data.name !== undefined ? data.name : currentEnt.name;
                    const trade_name = inputTradeName || inputName || 'Empresa Sem Nome';
                    const company_name = inputName || trade_name;
                    const cnpj = data.cnpj_cpf !== undefined ? data.cnpj_cpf : currentEnt.cnpj_cpf;
                    const email = data.email !== undefined ? data.email : currentEnt.email;

                    const columns = ['public_id', 'trade_name', 'company_name', 'cnpj', 'is_active', 'is_system', 'is_general_admin'];
                    const placeholders = ['?', '?', '?', '?', 'true', 'false', 'false'];
                    const insertValues: any[] = [companyPublicId, trade_name, company_name, cnpj];

                    const extraFields = ['email', 'phone', 'zipcode', 'street', 'number', 'complement', 'neighborhood', 'city', 'state'];
                    for (const field of extraFields) {
                        const val = (data as any)[field] !== undefined ? (data as any)[field] : currentEnt[field];
                        if (val !== undefined) {
                            columns.push(field);
                            placeholders.push('?');
                            insertValues.push(val || null);
                        }
                    }

                    const { CompanyRepository } = await import('./companyRepository');
                    const { RoleService } = await import('../services/roleService');
                    const { UserService } = await import('../services/userService');

                    // Check if company with same CNPJ already exists
                    let skipCompanyCreation = false;
                    if (cnpj) {
                        const existingComp = await CompanyRepository.getByCnpj(cnpj);
                        if (existingComp && existingComp.length > 0) {
                            skipCompanyCreation = true;
                        }
                    }

                    if (!skipCompanyCreation) {
                        const newCompanyId = await CompanyRepository.create(columns, placeholders, insertValues);
                        await RoleService.ensureDefaultRoles(newCompanyId);

                        const customUser = (data as any).company_user;
                        if (customUser && customUser.email && customUser.password) {
                            try {
                                await UserService.create(newCompanyId, {
                                    email: customUser.email,
                                    full_name: customUser.full_name || trade_name,
                                    passwordRaw: customUser.password,
                                    role: customUser.role || 'supervisor',
                                    is_active: true
                                });
                            } catch (userErr) {
                                console.error('Failed to create custom user for mirrored company inside update:', userErr);
                            }
                        } else if (email) {
                            const cleanCnpjCpf = cnpj ? String(cnpj).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
                            const passwordRaw = cleanCnpjCpf.length >= 6 ? cleanCnpjCpf : 'keystone123';
                            try {
                                await UserService.create(newCompanyId, {
                                    email: email,
                                    full_name: trade_name,
                                    passwordRaw,
                                    role: 'supervisor',
                                    is_active: true
                                });
                            } catch (userErr) {
                                console.error('Failed to create default user for mirrored company inside update:', userErr);
                            }
                        }
                    }
                }
            } catch (mirrorErr) {
                console.error('Error mirroring customer to company in update:', mirrorErr);
            }
        }

        return this.getById(table, currentId, companyId);
    }

    static async bulkUpdateCustomers(companyId: number, data: {
        customerIds: string[],
        seller_public_id?: string | null | undefined,
        customer_group_public_id?: string | null | undefined,
        vencimento_dia?: number | null | undefined,
        limite?: number | undefined,
        only_pix?: number | boolean | null | undefined,
        only_solidcon_baixa?: number | boolean | null | undefined,
        exempt_interest_fine?: number | boolean | null | undefined,
        hide_in_revenues_grid?: number | boolean | null | undefined
    }): Promise<number> {
        if (!data.customerIds || data.customerIds.length === 0) return 0;

        await this.ensureCustomerSchema();

        const updates: string[] = [];
        const values: any[] = [];

        if (data.seller_public_id !== undefined) {
            updates.push('seller_user_id = ?');
            values.push(await this.resolveCustomerSellerId(companyId, data.seller_public_id));
        }
        if (data.customer_group_public_id !== undefined) {
            updates.push('customer_group_id = ?');
            values.push(await this.resolveCustomerGroupId(companyId, data.customer_group_public_id));
        }
        if (data.vencimento_dia !== undefined) {
            updates.push('vencimento_dia = ?');
            values.push(data.vencimento_dia);
        }
        if (data.limite !== undefined) {
            updates.push('limite = ?');
            values.push(data.limite);
        }
        if (data.only_pix !== undefined) {
            updates.push('only_pix = ?');
            values.push(data.only_pix ? 1 : 0);
        }
        if (data.only_solidcon_baixa !== undefined) {
            updates.push('only_solidcon_baixa = ?');
            values.push(data.only_solidcon_baixa ? 1 : 0);
        }
        if (data.exempt_interest_fine !== undefined) {
            updates.push('exempt_interest_fine = ?');
            values.push(data.exempt_interest_fine ? 1 : 0);
        }
        if (data.hide_in_revenues_grid !== undefined) {
            updates.push('hide_in_revenues_grid = ?');
            values.push(data.hide_in_revenues_grid ? 1 : 0);
        }

        if (updates.length === 0) return 0;

        const placeholders = data.customerIds.map(() => '?').join(', ');
        values.push(companyId, ...data.customerIds);

        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE customers SET ${updates.join(', ')} WHERE company_id = ? AND public_id IN (${placeholders})`,
            values
        );

        return result.affectedRows;
    }

    static async bulkDeleteCustomers(companyId: number, customerIds: string[]): Promise<number> {
        if (!customerIds || customerIds.length === 0) return 0;

        await this.ensureCustomerSchema();

        const placeholders = customerIds.map(() => '?').join(', ');
        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM customers WHERE company_id = ? AND public_id IN (${placeholders})`,
            [companyId, ...customerIds]
        );

        return result.affectedRows;
    }

    static async delete(table: EntityTable, publicId: string, companyId: number): Promise<void> {
        await this.ensureSchemaForTable(table);

        await this.getByPublicId(table, publicId, companyId);
        const label = getEntityLabel(table);
        const [result] = await pool.query<ResultSetHeader>(
            `DELETE FROM ${table} WHERE public_id = ? AND company_id = ?`,
            [publicId, companyId]
        );
        if (result.affectedRows !== 1) throw new Error(`Failed to delete ${label.toLowerCase()}`);
    }
}